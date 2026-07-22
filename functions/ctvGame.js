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
  { key: "forum_comment", label: "Bình luận 1 câu hỏi trên Diễn đàn ALN", desc: "Vào mục Hỏi KTS trên Diễn đàn, để lại vài dòng góp ý thật.", url: "forum.html", pts: 20 },
  { key: "review_fanpage", label: "Để lại đánh giá cho Fanpage ALN", desc: "Vào mục Đánh giá trên Fanpage và chia sẻ cảm nhận của bạn.", url: "https://www.facebook.com/applamnha", pts: 20 },
];

function currentWeeklyTask() {
  const wk = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const item = WEEKLY_TASK_BANK[wk % WEEKLY_TASK_BANK.length];
  return Object.assign({ taskId: "weekly_" + item.key + "_w" + wk }, item);
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
exports.ctvGetProfile = onCall({ region: REGION }, async (request) => {
  const phone = normalizePhone((request.data || {}).phone);
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  const weeklyTask = currentWeeklyTask();
  const snap = await db.collection("users").doc(phone).get();
  if (!snap.exists) {
    return {
      exists: false, name: "", alnBricks: 0, alnDiamonds: 0, ctvReferralPendingVnd: 0,
      tasksDone: [], tier: tierOf(0), weeklyTask,
    };
  }
  const d = snap.data() || {};
  return {
    exists: true,
    name: d.name || "",
    alnBricks: d.alnBricks || 0,
    alnDiamonds: d.alnDiamonds || 0,
    ctvReferralPendingVnd: d.ctvReferralPendingVnd || 0,
    tasksDone: Array.isArray(d.ctvTasksDone) ? d.ctvTasksDone : [],
    tier: tierOf(d.alnBricks || 0),
    weeklyTask,
  };
});

/* Trả nhiệm vụ tuần hiện tại — không cần SĐT, gọi ngay lúc vào trang để hiện
   cho cả khách chưa từng chơi (ctvGetProfile chỉ trả được sau khi có SĐT). */
exports.ctvGetWeeklyTask = onCall({ region: REGION }, async () => currentWeeklyTask());

/* Bảng xếp hạng công khai theo Gạch — ẩn 3 số cuối SĐT. Lọc bằng where đơn
   (role) rồi sort trong bộ nhớ, KHÔNG orderBy trên Firestore để khỏi cần thêm
   composite index. */
exports.ctvLeaderboard = onCall({ region: REGION }, async () => {
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
exports.ctvClaimTasks = onCall({ region: REGION }, async (request) => {
  const d = request.data || {};
  const phone = normalizePhone(d.phone);
  const name = String(d.name || "").trim().slice(0, 80);
  const taskIds = Array.isArray(d.taskIds) ? d.taskIds : [];
  if (!phone) throw new HttpsError("invalid-argument", "Số điện thoại chưa hợp lệ");
  if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập tên");
  const weeklyTask = currentWeeklyTask();
  const taskAmounts = Object.assign({}, CTV_TASKS, { [weeklyTask.taskId]: weeklyTask.pts });
  const validTasks = taskIds.filter((t) => Object.prototype.hasOwnProperty.call(taskAmounts, t));
  if (!validTasks.length) throw new HttpsError("invalid-argument", "Chưa chọn nhiệm vụ nào hợp lệ");

  const userRef = db.collection("users").doc(phone);
  const preSnap = await userRef.get();
  if (!preSnap.exists) {
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

  const snap = await userRef.get();
  const ud = snap.data() || {};
  return {
    ok: true,
    newlyAwarded: totalAwarded,
    newlyDone,
    alnBricks: ud.alnBricks || 0,
    alnDiamonds: ud.alnDiamonds || 0,
    ctvReferralPendingVnd: ud.ctvReferralPendingVnd || 0,
    tasksDone: Array.isArray(ud.ctvTasksDone) ? ud.ctvTasksDone : [],
    tier: tierOf(ud.alnBricks || 0),
    weeklyTask,
  };
});
