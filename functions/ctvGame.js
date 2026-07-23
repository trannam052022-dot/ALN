/**
 * ctvGame — game nhiệm vụ công khai cho "Cộng tác viên" ẩn danh (không cần
 * đăng nhập/tài khoản). Khác với vai `ctv` có tài khoản Firebase Auth (đã bỏ) —
 * ở đây người chơi chỉ cần Tên + SĐT để tra/nhận Gạch, lưu trực tiếp vào
 * users/{sđt} (doc ID = số điện thoại, KHÔNG có Auth account tương ứng).
 *
 * Vì không có Firebase Auth, mọi đọc/ghi đi qua onCall (Admin SDK bypass
 * rules) — không cần mở firestore.rules cho phép ghi/đọc ẩn danh.
 *
 * Nhiệm vụ tự khai báo (honor system) — không xác minh thật đã follow/
 * comment hay chưa, chỉ chặn nộp trùng nhiều lần qua ledger idempotent.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const REGION = "asia-southeast1";

/* Danh sách nhiệm vụ hợp lệ + điểm — sửa ở đây khi thêm/bớt nhiệm vụ.
   PHẢI khớp id với danh sách hiển thị trong ctv_dashboard.html. */
const CTV_TASKS = {
  follow_fanpage: 5,
  follow_zalo: 5,
  comment_post: 10,
  share_link: 5,
};

/* Nhiệm vụ TUẦN — rotate tự động, KHÔNG cần cron/config Firestore: taskId nhúng
   số tuần (epoch/7 ngày) nên tự đổi bài mỗi tuần, ledger idempotent theo taskId
   tự nhiên cho phép làm lại đúng 1 lần/tuần/SĐT mà không cần thêm state nào. */
const WEEKLY_TASK_BANK = [
  { key: "comment_new", label: "Bình luận 1 bài viết MỚI trên Fanpage tuần này", desc: "Vào Fanpage ALN, chọn bài mới nhất và để lại bình luận thật.", url: "https://www.facebook.com/applamnha", pts: 20 },
  { key: "share_post", label: "Chia sẻ 1 bài viết của Fanpage ALN lên trang cá nhân", desc: "Chọn bất kỳ bài viết nào trên Fanpage và bấm Chia sẻ công khai.", url: "https://www.facebook.com/applamnha", pts: 20 },
  { key: "tag_friend", label: "Gắn thẻ 1 người bạn sắp xây nhà vào bình luận Fanpage", desc: "Bình luận dưới 1 bài viết và tag tên người bạn đang có ý định xây/sửa nhà.", url: "https://www.facebook.com/applamnha", pts: 20 },
  { key: "share_group", label: "Chia sẻ bài viết ALN vào 1 nhóm Facebook xây nhà/nội thất", desc: "Đăng lại 1 bài viết Fanpage ALN vào nhóm Facebook về xây nhà, nội thất mà bạn đang tham gia.", url: "https://www.facebook.com/applamnha", pts: 20 },
  { key: "review_fanpage", label: "Để lại đánh giá cho Fanpage ALN", desc: "Vào mục Đánh giá trên Fanpage và chia sẻ cảm nhận của bạn.", url: "https://www.facebook.com/applamnha", pts: 20 },
];

function currentWeeklyTask() {
  const wk = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const item = WEEKLY_TASK_BANK[wk % WEEKLY_TASK_BANK.length];
  return Object.assign({ taskId: "weekly_" + item.key + "_w" + wk, week: wk }, item);
}

/* Thưởng chuỗi tuần (streak): làm nhiệm vụ tuần N tuần LIÊN TIẾP → bonus tăng
   dần, mất chuỗi khi bỏ lỡ 1 tuần. Chuỗi 1 → 0, 2 → +5, 3 → +10... trần +25. */
function streakBonusOf(streak) {
  return Math.min(Math.max(0, streak - 1) * 5, 25);
}

/* Cập nhật chuỗi + cộng bonus sau khi nhiệm vụ tuần được nhận — idempotent
   theo ledger riêng ctv_streak_w{wk}_{sđt} (chạy lại không cộng đúp). */
async function updateWeeklyStreak(phone, name, wk) {
  const ledgerId = ("ctv_streak_w" + wk + "_" + phone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900);
  const ledgerRef = db.collection("bricksLedger").doc(ledgerId);
  const userRef = db.collection("users").doc(phone);
  try {
    return await db.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef);
      if (existing.exists) return null;
      const uSnap = await tx.get(userRef);
      const ud = uSnap.exists ? uSnap.data() : {};
      const lastWk = Number(ud.ctvLastWeeklyWeek);
      const streak = lastWk === wk - 1 ? (Number(ud.ctvWeeklyStreak) || 0) + 1 : 1;
      const bonus = streakBonusOf(streak);
      tx.set(ledgerRef, {
        uid: phone, type: "ctv_streak", amount: bonus, unit: "brick",
        meta: { week: wk, streak, name },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const patch = { ctvWeeklyStreak: streak, ctvLastWeeklyWeek: wk };
      if (bonus > 0) patch.alnBricks = admin.firestore.FieldValue.increment(bonus);
      tx.set(userRef, patch, { merge: true });
      return { streak, bonus };
    });
  } catch (e) {
    console.error("[updateWeeklyStreak]", phone, e);
    return null;
  }
}

/* Trạng thái vòng quay tuần này: đủ điều kiện khi đã làm nhiệm vụ tuần,
   mỗi tuần quay đúng 1 lần (ledger ctv_spin_w{wk}_{sđt}). */
async function spinStateOf(phone, tasksDone, weeklyTask) {
  const eligible = tasksDone.includes(weeklyTask.taskId);
  if (!eligible) return { eligible: false, used: false };
  const ledgerId = ("ctv_spin_w" + weeklyTask.week + "_" + phone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900);
  const snap = await db.collection("bricksLedger").doc(ledgerId).get();
  return { eligible: true, used: snap.exists };
}

/* Thưởng mời bạn cùng chơi — MỘT LẦN/người được mời, khi bạn được mời hoàn
   thành nhiệm vụ ĐẦU TIÊN (tài khoản users/{sđt} vừa được tạo). KHÔNG đa tầng
   (không ăn theo hoạt động về sau của người được mời) — xem CLAUDE.md mục
   "Gạch & Kim Cương ALN" (nguyên tắc "KHÔNG có thưởng đa tầng"). */
const CTV_INVITE_BONUS = 15;
/* Trần chống Sybil/farm (chốt 22/07/2026, xem thảo luận chống gian lận):
   tối đa 10 lượt thưởng mời/SĐT/ngày (giờ VN) — không chặn CTV mời thật, chỉ
   chặn kịch bản tự động sinh SĐT giả hàng loạt để cày +15 Gạch vô hạn. */
const CTV_INVITE_DAILY_CAP = 10;

function vnDateKey(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d || new Date());
}

async function awardCtvInviteBonus(referrerPhone, newPhone) {
  if (!referrerPhone || referrerPhone === newPhone) return;
  const ledgerId = ("ctv_invite_" + referrerPhone + "_" + newPhone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900);
  const ledgerRef = db.collection("bricksLedger").doc(ledgerId);
  const referrerRef = db.collection("users").doc(referrerPhone);
  const today = vnDateKey();
  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef);
      if (existing.exists) throw new Error("DUP");
      const refSnap = await tx.get(referrerRef);
      if (!refSnap.exists) throw new Error("NO_REFERRER"); // chỉ thưởng nếu người mời đã từng chơi thật
      const rd = refSnap.data() || {};
      const countToday = rd.ctvInviteDailyDate === today ? (Number(rd.ctvInviteDailyCount) || 0) : 0;
      if (countToday >= CTV_INVITE_DAILY_CAP) throw new Error("DAILY_CAP");
      tx.set(ledgerRef, {
        uid: referrerPhone, type: "ctv_invite_bonus", amount: CTV_INVITE_BONUS, unit: "brick",
        meta: { newPhone },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(referrerRef, {
        alnBricks: admin.firestore.FieldValue.increment(CTV_INVITE_BONUS),
        ctvInviteDailyDate: today,
        ctvInviteDailyCount: countToday + 1,
      }, { merge: true });
    });
  } catch (e) {
    if (e.message !== "DUP" && e.message !== "NO_REFERRER" && e.message !== "DAILY_CAP") {
      console.error("[awardCtvInviteBonus]", referrerPhone, newPhone, e);
    }
  }
}

function normalizePhone(phone) {
  const p = String(phone || "").replace(/[\s.\-()]/g, "");
  return /^0\d{8,10}$/.test(p) ? p : null;
}

function tierOf(bricks) {
  const tiers = [
    { min: 0, name: "Nền Móng" },
    { min: 50, name: "Khung Nhà" },
    { min: 150, name: "Mái Ấm" },
    { min: 400, name: "Biệt Thự" },
    { min: 1000, name: "Dinh Thự" },
  ];
  let cur = tiers[0];
  for (const t of tiers) if (bricks >= t.min) cur = t;
  return cur.name;
}

/* Tra Gạch/Kim Cương theo SĐT — không cần đăng nhập. */
exports.ctvGetProfile = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const phone = normalizePhone((request.data || {}).phone);
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  const weeklyTask = currentWeeklyTask();
  const snap = await db.collection("users").doc(phone).get();
  if (!snap.exists) {
    return {
      exists: false, name: "", alnBricks: 0, alnDiamonds: 0, referralPendingVnd: 0,
      tasksDone: [], tier: tierOf(0), weeklyTask, streak: 0, spin: { eligible: false, used: false },
      chip: { eligible: false, usedToday: false },
    };
  }
  const d = snap.data() || {};
  const tasksDone = Array.isArray(d.ctvTasksDone) ? d.ctvTasksDone : [];
  /* Chuỗi chỉ còn "sống" nếu tuần gần nhất làm nhiệm vụ là tuần này hoặc tuần trước */
  const lastWk = Number(d.ctvLastWeeklyWeek);
  const streak = lastWk >= weeklyTask.week - 1 ? (Number(d.ctvWeeklyStreak) || 0) : 0;
  return {
    exists: true,
    name: d.name || "",
    alnBricks: d.alnBricks || 0,
    alnDiamonds: d.alnDiamonds || 0,
    referralPendingVnd: d.referralPendingVnd || 0,
    tasksDone,
    tier: tierOf(d.alnBricks || 0),
    weeklyTask,
    streak,
    spin: await spinStateOf(phone, tasksDone, weeklyTask),
    chip: await chipStateOf(phone),
  };
});

/* Trả nhiệm vụ tuần hiện tại — không cần SĐT, gọi ngay lúc vào trang để hiện
   cho cả khách chưa từng chơi (ctvGetProfile chỉ trả được sau khi có SĐT). */
exports.ctvGetWeeklyTask = onCall({ region: REGION, enforceAppCheck: true }, async () => currentWeeklyTask());

/* Bảng xếp hạng công khai theo Gạch — ẩn 3 số cuối SĐT. Lọc bằng where đơn
   (role) rồi sort trong bộ nhớ, KHÔNG orderBy trên Firestore để khỏi cần thêm
   composite index. */
exports.ctvLeaderboard = onCall({ region: REGION, enforceAppCheck: true }, async () => {
  const snap = await db.collection("users").where("role", "==", "ctv_lead").limit(300).get();
  const items = snap.docs.map((doc) => {
    const u = doc.data() || {};
    const phone = String(u.phone || doc.id || "");
    const phoneMasked = phone.length >= 5 ? phone.slice(0, phone.length - 3) + "***" : phone;
    return { name: u.name || "Người chơi ẩn danh", phoneMasked, alnBricks: u.alnBricks || 0, tier: tierOf(u.alnBricks || 0) };
  });
  items.sort((a, b) => b.alnBricks - a.alnBricks);
  return { items: items.slice(0, 20) };
});

/* Nộp nhiệm vụ đã làm + nhận Gạch — tạo/cập nhật users/{sđt}, idempotent
   theo từng nhiệm vụ (nộp lại nhiệm vụ cũ không cộng đúp). */
exports.ctvClaimTasks = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const d = request.data || {};
  const phone = normalizePhone(d.phone);
  const name = String(d.name || "").trim().slice(0, 80);
  const taskIds = Array.isArray(d.taskIds) ? d.taskIds : [];
  const refBy = normalizePhone(d.refBy); // SĐT người mời (nếu vào bằng link mời), optional
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập tên");
  const weeklyTask = currentWeeklyTask();
  const taskAmounts = Object.assign({}, CTV_TASKS, { [weeklyTask.taskId]: weeklyTask.pts });
  const validTasks = taskIds.filter((t) => Object.prototype.hasOwnProperty.call(taskAmounts, t));
  if (!validTasks.length) throw new HttpsError("invalid-argument", "Chưa chọn nhiệm vụ nào hợp lệ");

  const userRef = db.collection("users").doc(phone);
  const preSnap = await userRef.get();
  const isNewPlayer = !preSnap.exists;
  if (isNewPlayer) {
    await userRef.set({
      username: phone, name, phone, role: "ctv_lead", status: "active",
      alnBricks: 0, alnDiamonds: 0, ctvTasksDone: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  let totalAwarded = 0;
  const newlyDone = [];

  for (const taskId of validTasks) {
    const ledgerId = ("ctv_task_" + taskId + "_" + phone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900);
    const ledgerRef = db.collection("bricksLedger").doc(ledgerId);
    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(ledgerRef);
        if (existing.exists) throw new Error("DUP");
        const amount = taskAmounts[taskId];
        tx.set(ledgerRef, {
          uid: phone, type: "ctv_task_" + taskId, amount, unit: "brick",
          meta: { taskId, name },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(userRef, {
          username: phone, name, phone, role: "ctv_lead", status: "active",
          alnBricks: admin.firestore.FieldValue.increment(amount),
          ctvTasksDone: admin.firestore.FieldValue.arrayUnion(taskId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      totalAwarded += taskAmounts[taskId];
      newlyDone.push(taskId);
    } catch (e) {
      if (e.message !== "DUP") console.error("[ctvClaimTasks]", taskId, phone, e);
      // DUP: nhiệm vụ đã nộp trước đó — bỏ qua êm, không báo lỗi cho client.
    }
  }

  /* Vừa nhận nhiệm vụ TUẦN lần đầu → cập nhật chuỗi + bonus streak */
  let streakInfo = null;
  if (newlyDone.includes(weeklyTask.taskId)) {
    streakInfo = await updateWeeklyStreak(phone, name, weeklyTask.week);
  }

  /* Người chơi MỚI vừa hoàn thành nhiệm vụ đầu tiên qua link mời → thưởng người mời */
  if (isNewPlayer && newlyDone.length && refBy) {
    await awardCtvInviteBonus(refBy, phone);
  }

  const snap = await userRef.get();
  const ud = snap.data() || {};
  const tasksDone = Array.isArray(ud.ctvTasksDone) ? ud.ctvTasksDone : [];
  const lastWk = Number(ud.ctvLastWeeklyWeek);
  const streak = lastWk >= weeklyTask.week - 1 ? (Number(ud.ctvWeeklyStreak) || 0) : 0;
  return {
    ok: true,
    newlyAwarded: totalAwarded,
    newlyDone,
    alnBricks: ud.alnBricks || 0,
    alnDiamonds: ud.alnDiamonds || 0,
    referralPendingVnd: ud.referralPendingVnd || 0,
    tasksDone,
    tier: tierOf(ud.alnBricks || 0),
    weeklyTask,
    streak,
    streakBonus: streakInfo ? streakInfo.bonus : 0,
    spin: await spinStateOf(phone, tasksDone, weeklyTask),
    chip: await chipStateOf(phone),
  };
});

/* Vòng quay may mắn — 1 lượt/tuần, mở khoá khi đã làm nhiệm vụ tuần.
   Giải ngẫu nhiên có trọng số, cộng thẳng Gạch; ledger ctv_spin_w{wk}_{sđt}
   vừa là chống quay lặp vừa là sổ ghi giải trúng. */
const SPIN_PRIZES = [
  { amount: 5, weight: 40 },
  { amount: 10, weight: 30 },
  { amount: 15, weight: 15 },
  { amount: 20, weight: 10 },
  { amount: 50, weight: 5 },
];
function pickSpinPrize() {
  const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of SPIN_PRIZES) { r -= p.weight; if (r < 0) return p.amount; }
  return SPIN_PRIZES[0].amount;
}

exports.ctvSpinWheel = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const phone = normalizePhone((request.data || {}).phone);
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  const weeklyTask = currentWeeklyTask();
  const wk = weeklyTask.week;
  const spinLedgerRef = db.collection("bricksLedger")
    .doc(("ctv_spin_w" + wk + "_" + phone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900));
  const taskLedgerRef = db.collection("bricksLedger")
    .doc(("ctv_task_" + weeklyTask.taskId + "_" + phone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900));
  const userRef = db.collection("users").doc(phone);
  const prize = pickSpinPrize();
  try {
    await db.runTransaction(async (tx) => {
      const [spinSnap, taskSnap] = await Promise.all([tx.get(spinLedgerRef), tx.get(taskLedgerRef)]);
      if (spinSnap.exists) throw new HttpsError("failed-precondition", "Tuần này bạn đã quay rồi — quay tiếp vào tuần sau nhé!");
      if (!taskSnap.exists) throw new HttpsError("failed-precondition", "Hoàn thành nhiệm vụ tuần trước đã rồi mới được quay nhé!");
      tx.set(spinLedgerRef, {
        uid: phone, type: "ctv_spin", amount: prize, unit: "brick",
        meta: { week: wk },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(userRef, { alnBricks: admin.firestore.FieldValue.increment(prize) }, { merge: true });
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("[ctvSpinWheel]", phone, e);
    throw new HttpsError("internal", "Có lỗi khi quay — thử lại sau nhé");
  }
  const snap = await userRef.get();
  const ud = snap.data() || {};
  return {
    ok: true,
    prize,
    alnBricks: ud.alnBricks || 0,
    alnDiamonds: ud.alnDiamonds || 0,
    referralPendingVnd: ud.referralPendingVnd || 0,
    tier: tierOf(ud.alnBricks || 0),
  };
});

/* ── Bốc Chip May Mắn — trò chơi phản xạ, 1 lượt/ngày, mở khoá vĩnh viễn
   ngay sau khi đã hoàn thành ≥1 nhiệm vụ bất kỳ (tức đã tồn tại users/{sđt},
   luôn đúng vì doc chỉ được tạo qua ctvClaimTasks). Giá trị Gạch đúng bằng
   quy đổi thật 1 Gạch=100đ (xem CLAUDE.md "1000 Gạch→100k"), nhưng trọng số
   xuất hiện GIẢM DẦN theo giá trị (thay vì giảm số Gạch) để chip vẫn "đúng
   nghĩa" mà không lạm phát thang tier — chốt cùng Founder 23/07/2026.
   Timing xác thực SERVER-SIDE: ctvChipStart ghi lại mốc giờ + độ khó (ô nào,
   trễ bao lâu, cửa sổ bao rộng); ctvChipClick đối chiếu thời điểm gọi thực
   tế + ô client báo đã bấm với dữ liệu đã chốt — client không tự báo trúng
   được. */
const CHIP_PRIZES = [
  { amount: 10, weight: 55, windowMs: 800, label: "1.000đ" },
  { amount: 20, weight: 30, windowMs: 600, label: "2.000đ" },
  { amount: 50, weight: 12, windowMs: 400, label: "5.000đ" },
  { amount: 100, weight: 3, windowMs: 250, label: "10.000đ" },
];
const CHIP_CLICK_GRACE_MS = 150; // bù độ trễ mạng lúc gọi ctvChipClick

function pickChipPrize() {
  const total = CHIP_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < CHIP_PRIZES.length; i++) {
    r -= CHIP_PRIZES[i].weight;
    if (r < 0) return Object.assign({ idx: i }, CHIP_PRIZES[i]);
  }
  return Object.assign({ idx: 0 }, CHIP_PRIZES[0]);
}

function chipLedgerRef(phone) {
  const today = vnDateKey();
  return db.collection("bricksLedger").doc(("ctv_chip_" + today + "_" + phone).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900));
}

async function chipStateOf(phone) {
  const snap = await chipLedgerRef(phone).get();
  return { eligible: true, usedToday: snap.exists };
}

/* Bắt đầu 1 lượt: server chọn sẵn ô + độ trễ + cửa sổ trúng, lưu tạm vào
   ctvChipRounds/{sđt} — client chỉ nhận đủ dữ liệu để chạy animation, không
   nhận trước biết mình trúng gì. */
exports.ctvChipStart = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const phone = normalizePhone((request.data || {}).phone);
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  const userSnap = await db.collection("users").doc(phone).get();
  if (!userSnap.exists) throw new HttpsError("failed-precondition", "Hoàn thành ít nhất 1 nhiệm vụ trước đã rồi mới được chơi Chip nhé!");
  const { usedToday } = await chipStateOf(phone);
  if (usedToday) throw new HttpsError("failed-precondition", "Hôm nay bạn chơi Chip rồi — quay lại vào ngày mai nhé!");
  const prize = pickChipPrize();
  const delayMs = 2000 + Math.floor(Math.random() * 2000);
  await db.collection("ctvChipRounds").doc(phone).set({
    idx: prize.idx, amount: prize.amount, windowMs: prize.windowMs, delayMs,
    startedAtMs: Date.now(), consumed: false,
  });
  return { idx: prize.idx, amount: prize.amount, label: prize.label, delayMs, windowMs: prize.windowMs };
});

/* Chốt kết quả 1 lượt: hit chỉ khi client bấm ĐÚNG ô server đã chọn VÀ đúng
   lúc gọi hàm này nằm trong cửa sổ [flashStart, flashEnd] (+ grace mạng). */
exports.ctvChipClick = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const phone = normalizePhone((request.data || {}).phone);
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  const clickedIdx = Number((request.data || {}).idx);
  const roundRef = db.collection("ctvChipRounds").doc(phone);
  const roundSnap = await roundRef.get();
  if (!roundSnap.exists || roundSnap.data().consumed) {
    throw new HttpsError("failed-precondition", "Chưa có lượt chơi nào đang chờ — bấm Bắt đầu trước nhé!");
  }
  const round = roundSnap.data();
  await roundRef.set({ consumed: true }, { merge: true });

  const now = Date.now();
  const flashStart = round.startedAtMs + round.delayMs;
  const flashEnd = flashStart + round.windowMs;
  const inWindow = now >= (flashStart - CHIP_CLICK_GRACE_MS) && now <= (flashEnd + CHIP_CLICK_GRACE_MS);
  const hit = inWindow && clickedIdx === round.idx;
  const amount = hit ? round.amount : 0;

  const ledgerRef = chipLedgerRef(phone);
  const userRef = db.collection("users").doc(phone);
  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef);
      if (existing.exists) throw new Error("DUP");
      tx.set(ledgerRef, {
        uid: phone, type: "ctv_chip", amount, unit: "brick",
        meta: { hit, targetIdx: round.idx, targetAmount: round.amount, clickedIdx },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (amount > 0) tx.set(userRef, { alnBricks: admin.firestore.FieldValue.increment(amount) }, { merge: true });
    });
  } catch (e) {
    if (e.message !== "DUP") {
      console.error("[ctvChipClick]", phone, e);
      throw new HttpsError("internal", "Có lỗi khi ghi nhận lượt chơi — thử lại sau nhé");
    }
    // DUP: hôm nay đã tính rồi (vd 2 tab cùng lúc) — trả trạng thái hiện tại, không cộng thêm.
  }
  const snap = await userRef.get();
  const ud = snap.data() || {};
  return {
    hit, idx: round.idx, amount, alnBricks: ud.alnBricks || 0, alnDiamonds: ud.alnDiamonds || 0,
    referralPendingVnd: ud.referralPendingVnd || 0, tier: tierOf(ud.alnBricks || 0),
  };
});

/* ── Quét bất thường hàng ngày (chống gian lận, chốt 22/07/2026) ──
   Cùng nguyên tắc scanC2Suspicion (functions/index.js): CHỈ CẢNH BÁO Founder,
   KHÔNG tự động khoá/thu hồi Gạch — tránh chặn nhầm CTV thật đang viral tốt.
   3 dấu hiệu: (1) tài khoản mới hoàn thành nhiệm vụ quá nhanh sau khi tạo
   (honor-system không thể xong thật trong vài giây), (2) nhiều SĐT tạo trong
   24h có số liền kề nhau (dấu hiệu sinh SĐT hàng loạt), (3) 1 người mời nhận
   nhiều thưởng mời trong ngày (dù đã có trần 10/ngày, ≥5 vẫn đáng chú ý). */
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";

async function pushToFounder(title, body, extraData) {
  try {
    const tokSnap = await db.collection("fcmTokens").where("uid", "==", FOUNDER_UID).get();
    const tokens = tokSnap.docs.map((d) => d.data().token).filter((t) => typeof t === "string" && t.length > 0);
    if (!tokens.length) return;
    await admin.messaging().sendEachForMulticast({
      tokens, notification: { title, body }, data: Object.assign({}, extraData || {}),
    });
  } catch (e) {
    console.error("[ctvGame pushToFounder]", e);
  }
}

exports.scanCtvSuspicion = onSchedule(
  { schedule: "20 8 * * *", timeZone: "Asia/Ho_Chi_Minh", region: REGION },
  async () => {
    const snap = await db.collection("users").where("role", "==", "ctv_lead").limit(1000).get();
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const recent = [];
    snap.forEach((doc) => {
      const u = doc.data() || {};
      const createdMs = u.createdAt && u.createdAt.toMillis ? u.createdAt.toMillis() : 0;
      if (!createdMs || now - createdMs > dayMs) return;
      const updatedMs = u.updatedAt && u.updatedAt.toMillis ? u.updatedAt.toMillis() : createdMs;
      recent.push({
        phone: u.phone || doc.id, createdMs, updatedMs,
        tasksDone: Array.isArray(u.ctvTasksDone) ? u.ctvTasksDone.length : 0,
      });
    });
    if (!recent.length) return;

    const fastDone = recent.filter((r) => r.tasksDone > 0 && (r.updatedMs - r.createdMs) < 15000);

    const sortedByPhone = recent.slice().sort((a, b) => Number(a.phone) - Number(b.phone));
    const sequentialSet = new Set();
    for (let i = 1; i < sortedByPhone.length; i++) {
      const diff = Number(sortedByPhone[i].phone) - Number(sortedByPhone[i - 1].phone);
      if (diff > 0 && diff <= 3) { sequentialSet.add(sortedByPhone[i - 1].phone); sequentialSet.add(sortedByPhone[i].phone); }
    }

    const ledgerSnap = await db.collection("bricksLedger").where("type", "==", "ctv_invite_bonus").limit(2000).get();
    const byReferrer = {};
    ledgerSnap.forEach((d) => {
      const l = d.data() || {};
      const ms = l.createdAt && l.createdAt.toMillis ? l.createdAt.toMillis() : 0;
      if (ms && now - ms <= dayMs) byReferrer[l.uid] = (byReferrer[l.uid] || 0) + 1;
    });
    const heavyReferrers = Object.entries(byReferrer).filter(([, c]) => c >= 5);

    if (!fastDone.length && !sequentialSet.size && !heavyReferrers.length) return;

    const lines = [];
    if (fastDone.length) lines.push(fastDone.length + " TK làm nhiệm vụ <15s sau khi tạo: " + fastDone.slice(0, 8).map((r) => r.phone).join(", "));
    if (sequentialSet.size) lines.push(sequentialSet.size + " SĐT liền kề tạo trong 24h: " + Array.from(sequentialSet).slice(0, 8).join(", "));
    if (heavyReferrers.length) lines.push(heavyReferrers.length + " người mời nhận ≥5 thưởng mời/ngày: " + heavyReferrers.map(([p, c]) => p + "(" + c + ")").join(", "));

    console.log("[scanCtvSuspicion]", lines.join(" | "));
    await pushToFounder(
      "⚠️ Nghi vấn gian lận game CTV",
      lines.join(" — "),
      { type: "CTV_SUSPICION" }
    );
  }
);
