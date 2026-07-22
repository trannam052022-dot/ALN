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
  const snap = await db.collection("users").doc(phone).get();
  if (!snap.exists) {
    return { exists: false, name: "", alnBricks: 0, alnDiamonds: 0, tasksDone: [], tier: tierOf(0) };
  }
  const d = snap.data() || {};
  return {
    exists: true,
    name: d.name || "",
    alnBricks: d.alnBricks || 0,
    alnDiamonds: d.alnDiamonds || 0,
    tasksDone: Array.isArray(d.ctvTasksDone) ? d.ctvTasksDone : [],
    tier: tierOf(d.alnBricks || 0),
  };
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
  const validTasks = taskIds.filter((t) => Object.prototype.hasOwnProperty.call(CTV_TASKS, t));
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
        const amount = CTV_TASKS[taskId];
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
      totalAwarded += CTV_TASKS[taskId];
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
    tasksDone: Array.isArray(ud.ctvTasksDone) ? ud.ctvTasksDone : [],
    tier: tierOf(ud.alnBricks || 0),
  };
});
