/**
 * bricks — hệ thống Gạch & Kim Cương ALN (P1: tích lũy, chưa có tiêu/rút)
 *
 * Định vị pháp lý (BẮT BUỘC giữ, xem CLAUDE.md mục "Gạch & Kim Cương"):
 * - Gạch = điểm thưởng khuyến mãi: KHÔNG mua bằng tiền, KHÔNG đổi ra tiền,
 *   KHÔNG chuyển nhượng giữa người dùng. Chỉ đổi ưu đãi dịch vụ trong ALN.
 * - Kim Cương = thưởng giới thiệu cho KẾT QUẢ mang doanh thu thật (CN được
 *   giới thiệu ký hợp đồng + tiền C1 đã thực nhận). Về sau quy được ra tiền
 *   chuyển khoản theo thể lệ (bản chất: hoa hồng giới thiệu — hợp pháp), có
 *   khấu trừ thuế TNCN theo quy định, Founder duyệt tay từng lệnh chi.
 * - KHÔNG có cơ chế hưởng thưởng đa tầng (tuyến dưới) — tránh mô hình đa cấp.
 *
 * Kiến trúc:
 * - bricksLedger/{ledgerId}: sổ cái bất biến, CHỈ Cloud Functions ghi (Admin
 *   SDK bypass rules — client không ghi được vì rules không mở collection này).
 *   ledgerId = `${type}_${refKey}` → idempotent tự nhiên: cùng sự kiện chỉ
 *   cộng đúng 1 lần dù trigger chạy lại.
 * - users/{uid}.alnBricks / alnDiamonds: số dư cache (rules users đã cho đọc
 *   khi signedIn — UI hiển thị không cần mở rules mới).
 */
const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const bdb = admin.firestore();

const REGION = "asia-southeast1";
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";

/* Bảng Gạch theo loại sự kiện — chỉnh 1 chỗ này khi cân bằng lại "kinh tế Gạch".
   Loại nào gắn sự kiện thật có giới hạn tự nhiên (dự án, chặng) thì không cần
   trần/ngày; loại hoạt động lặp được sẽ thêm trần khi mở ở P1.5 (forum...). */
const BRICK_AMOUNTS = {
  welcome: 10,           // đăng ký tài khoản mới (mọi vai)
  stage_approved_cn: 20, // CN/DN duyệt xong 1 chặng C1-C4 (mỗi chặng 1 lần)
  stage_done_kts: 30,    // KTS có chặng được duyệt (mỗi chặng 1 lần)
  ncc_ref_signup: 15,    // NCC có 1 CN đăng ký qua link ref của mình
};

/* Cộng Gạch idempotent: ledgerId cố định theo sự kiện — chạy lại không cộng đúp. */
async function awardBricks(uid, type, refKey, meta) {
  const amount = BRICK_AMOUNTS[type];
  if (!uid || !amount) return false;
  const ledgerId = (type + "_" + refKey).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900);
  const ledgerRef = bdb.collection("bricksLedger").doc(ledgerId);
  const userRef = bdb.collection("users").doc(uid);
  try {
    await bdb.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef);
      if (existing.exists) throw new Error("DUP");
      tx.set(ledgerRef, {
        uid, type, amount, unit: "brick",
        meta: meta || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(userRef, { alnBricks: admin.firestore.FieldValue.increment(amount) }, { merge: true });
    });
    return true;
  } catch (e) {
    if (e.message !== "DUP") console.error("[awardBricks]", type, uid, e);
    return false;
  }
}

/* Push FCM tối giản cho Founder — cùng nguồn fcmTokens với notifyUser (index.js). */
async function pushToFounder(title, body, extraData) {
  try {
    const snap = await bdb.collection("fcmTokens").where("uid", "==", FOUNDER_UID).get();
    const tokens = snap.docs.map((d) => d.data().token)
      .filter((t) => typeof t === "string" && t.length > 0);
    if (!tokens.length) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.assign({}, extraData || {}),
    });
  } catch (e) {
    console.error("[bricks pushToFounder]", e);
  }
}

/* Trao Kim Cương — chỉ từ sự kiện doanh thu thật hoặc Founder trao tay. */
async function awardDiamond(uid, refKey, meta) {
  if (!uid) return false;
  const ledgerId = ("diamond_" + refKey).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 900);
  const ledgerRef = bdb.collection("bricksLedger").doc(ledgerId);
  const userRef = bdb.collection("users").doc(uid);
  try {
    await bdb.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef);
      if (existing.exists) throw new Error("DUP");
      tx.set(ledgerRef, {
        uid, type: "diamond_referral_contract", amount: 1, unit: "diamond",
        meta: meta || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(userRef, { alnDiamonds: admin.firestore.FieldValue.increment(1) }, { merge: true });
    });
    return true;
  } catch (e) {
    if (e.message !== "DUP") console.error("[awardDiamond]", uid, e);
    return false;
  }
}

/* ── 1. Gạch chào mừng khi tạo tài khoản (mọi vai) ── */
exports.bricksOnUserCreated = functions
  .region(REGION)
  .firestore.document("users/{uid}")
  .onCreate(async (snap, context) => {
    const uid = context.params.uid;
    await awardBricks(uid, "welcome", uid, { note: "Gạch chào mừng thành viên mới" });

    /* NCC giới thiệu CN đăng ký → NCC được Gạch (song song referralCount đã có) */
    const d = snap.data() || {};
    if (d.role === "cn" && typeof d.referredByNcc === "string" && d.referredByNcc) {
      await awardBricks(d.referredByNcc, "ncc_ref_signup", uid, {
        note: "CN đăng ký qua link giới thiệu", cnUid: uid,
      });
    }
  });

/* ── 2. Gạch khi chặng dự án được duyệt (CN + KTS mỗi bên 1 phần) ── */
exports.bricksOnStageAdvanced = functions
  .region(REGION)
  .firestore.document("projects/{pid}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    if (before.stage === after.stage) return null;
    const pid = context.params.pid;
    const stageDone = before.stage || ""; // chặng vừa được duyệt xong
    if (!stageDone) return null;
    const cnUid = after.cn && after.cn.uid;
    const ktsUid = after.kts && after.kts.uid;
    if (cnUid) await awardBricks(cnUid, "stage_approved_cn", pid + "_" + stageDone, { pid, stage: stageDone });
    if (ktsUid) await awardBricks(ktsUid, "stage_done_kts", pid + "_" + stageDone, { pid, stage: stageDone });
    return null;
  });

/* ── 3. Kim Cương khi tiền C1 THẬT về của CN được giới thiệu ──
   Chỉ C1 (lần tiền đầu tiên của hợp đồng) — mỗi dự án tối đa 1 Kim Cương cho
   người giới thiệu, idempotent theo pid. Hiện hỗ trợ người giới thiệu là NCC
   (referredByNcc); mở rộng kts_ref/CN-mời-CN ở giai đoạn sau. */
exports.bricksOnFirstPayment = functions
  .region(REGION)
  .firestore.document("projects/{pid}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const bp = (before.payments || {}).C1 || {};
    const ap = (after.payments || {}).C1 || {};
    if (bp.status === "paid" || ap.status !== "paid") return null;
    const pid = context.params.pid;
    const cnUid = after.cn && after.cn.uid;
    if (!cnUid) return null;
    try {
      const cnSnap = await bdb.collection("users").doc(cnUid).get();
      const cn = cnSnap.exists ? cnSnap.data() : {};
      // Người giới thiệu có thể là NCC (uid Firebase Auth) hoặc Cộng tác viên
      // ẩn danh (định danh bằng SĐT — xem functions/ctvGame.js). Ưu tiên NCC
      // nếu cả 2 field cùng có giá trị (trường hợp hiếm, tránh trao đúp).
      const referrer = typeof cn.referredByNcc === "string" && cn.referredByNcc
        ? cn.referredByNcc
        : (typeof cn.referredByCtv === "string" ? cn.referredByCtv : "");
      if (!referrer) return null;
      const ok = await awardDiamond(referrer, "c1paid_" + pid, {
        pid, cnUid, note: "CN được giới thiệu đã ký HĐ + tiền C1 thực nhận",
      });
      if (ok) {
        /* Push cho Founder biết có Kim Cương mới (cùng pattern fcmTokens của notifyUser) */
        await pushToFounder(
          "💎 Kim Cương mới",
          "Dự án " + pid + " (C1 đã thu) có người giới thiệu — 1 Kim Cương đã trao, chờ thể lệ chi thưởng.",
          { type: "DIAMOND_AWARDED", pid, referrer }
        );
      }
    } catch (e) {
      console.error("[bricksOnFirstPayment]", pid, e);
    }
    return null;
  });

/* ── 4. Founder trao/thu hồi Gạch tay (duyệt nhiệm vụ chưa có luồng tự động:
   "đi chợ giùm", nhật ký xây nhà, thử thách tuần...) ── */
exports.founderAwardBricks = onCall({ region: REGION }, async (request) => {
  if (!request.auth || request.auth.uid !== FOUNDER_UID) {
    throw new HttpsError("permission-denied", "Chỉ Founder được trao Gạch");
  }
  const d = request.data || {};
  const uid = String(d.uid || "");
  const amount = Math.trunc(Number(d.amount));
  const reason = String(d.reason || "").slice(0, 300);
  if (!uid || !amount || Math.abs(amount) > 1000 || !reason) {
    throw new HttpsError("invalid-argument", "Cần uid, amount (≠0, ≤1000), reason");
  }
  const ledgerId = "manual_" + Date.now() + "_" + uid.slice(0, 8);
  await bdb.runTransaction(async (tx) => {
    tx.set(bdb.collection("bricksLedger").doc(ledgerId), {
      uid, type: "manual", amount, unit: "brick",
      meta: { reason, by: "founder" },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(bdb.collection("users").doc(uid),
      { alnBricks: admin.firestore.FieldValue.increment(amount) }, { merge: true });
  });
  return { ok: true, ledgerId };
});

module.exports = Object.assign(module.exports, {});
