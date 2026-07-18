/* ════════════════════════════════════════════════════════════════
   HỢP ĐỒNG ĐIỆN TỬ ALN — BẢN NHÁP (contracts_draft)
   KHÔNG import vào functions/index.js — chưa deploy.
   Chỉ đọc/ghi collection contracts_draft / signatures_draft / auditLog_draft
   (KHÔNG đụng contracts thật — collection đó chưa tồn tại, xem
   firestore_rules_PROPOSAL.txt cho khi lên production).

   contracts_draft chưa có rule trong firestore.rules (mặc định deny) và
   theo yêu cầu KHÔNG được sửa firestore.rules trực tiếp ở giai đoạn draft
   → MỌI đọc/ghi collection này đi qua các Cloud Function dưới đây (Admin
   SDK, bỏ qua rules), kể cả đọc để hiển thị (draftGetContract/
   draftListContracts/draftGetAuditLog) — nhiều hơn 3 hàm nêu trong lệnh
   gốc (draftRequestOtp/draftVerifyOtp/draftFinalizeContract) vì lý do đó.

   Bên A (ALN) xác nhận trực tiếp qua draftConfirmPartyA (Founder bấm nút
   trong founder_contracts_draft.html, không qua OTP — Founder đã đăng
   nhập sẵn). Bên B ký qua OTP (draftRequestOtp/draftVerifyOtp) vì Bên B
   (CTV KTS / DN / Chủ nhà) có thể mở link ký mà không cần tài khoản ALN.
════════════════════════════════════════════════════════════════ */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
// Import trực tiếp thay vì FieldValue/.Timestamp — namespace
// compat đó có lúc chưa gắn kịp khi module này được require() gián tiếp
// (qua import tạm ở cuối index.js để chạy Emulator), gây TypeError undefined.
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const CONTRACT_TYPES = ["ktsCollaborator", "businessClient", "homeowner"];

function requireFounder(request) {
  if (!request.auth || request.auth.uid !== FOUNDER_UID) {
    throw new HttpsError("permission-denied", "Chỉ Founder được thực hiện thao tác này");
  }
}

function reqIp(request) {
  return (request.rawRequest && request.rawRequest.ip) || null;
}

function reqUserAgent(request) {
  return (request.rawRequest && request.rawRequest.get && request.rawRequest.get("user-agent")) || null;
}

async function writeAudit(contractId, action, opts) {
  opts = opts || {};
  await db.collection("contracts_draft").doc(contractId)
    .collection("auditLog_draft").add({
      action: action,
      party: opts.party || null,
      actorUid: opts.actorUid || null,
      actorRole: opts.actorRole || null,
      timestamp: FieldValue.serverTimestamp(),
      ipAddress: opts.ipAddress || null,
      userAgent: opts.userAgent || null,
    });
}

/* Cả A và B đã confirmed:true → khoá status 'signed_all' + ghi audit cuối.
   Idempotent — gọi lại nhiều lần không sao (không ghi trùng nếu đã signed_all). */
async function maybeFinalize(contractId, request) {
  const ref = db.collection("contracts_draft").doc(contractId);
  const sigSnap = await ref.collection("signatures_draft").get();
  const state = {};
  sigSnap.forEach(function (d) { state[d.id] = !!d.data().confirmed; });
  if (!(state.A && state.B)) return false;

  const contractSnap = await ref.get();
  if (!contractSnap.exists) return false;
  if (contractSnap.data().status === "signed_all") return true;

  await ref.update({
    status: "signed_all",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(contractId, "signed", {
    actorUid: (request && request.auth && request.auth.uid) || null,
    actorRole: "system",
    ipAddress: request ? reqIp(request) : null,
    userAgent: request ? reqUserAgent(request) : null,
  });
  return true;
}

/* ── Founder tạo hợp đồng ────────────────────────────────────────── */
exports.draftCreateContract = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const p = request.data || {};
  if (!CONTRACT_TYPES.includes(p.type)) {
    throw new HttpsError("invalid-argument", "Loại hợp đồng không hợp lệ");
  }
  const partyB = p.partyB || {};
  if (!partyB.name || !partyB.phone) {
    throw new HttpsError("invalid-argument", "Thiếu tên hoặc SĐT Bên B");
  }

  const docRef = db.collection("contracts_draft").doc();
  await docRef.set({
    type: p.type,
    status: "draft",
    projectId: p.projectId || null,
    partyA: { name: "CÔNG TY TNHH MTV ALN", repName: "Lý Mỹ Linh", title: "Giám đốc" },
    partyB: {
      name: partyB.name,
      idNumber: partyB.idNumber || "",
      phone: partyB.phone,
      email: partyB.email || "",
      uid: partyB.uid || null,
    },
    contractData: p.contractData || {},
    pdfDraftURL: null,
    pdfSignedURL: null,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    sentAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await docRef.collection("signatures_draft").doc("A").set({
    signerName: "", signerIdNumber: "", method: "manual",
    otpVerifiedAt: null, ipAddress: null, userAgent: null, confirmed: false,
  });
  await docRef.collection("signatures_draft").doc("B").set({
    signerName: "", signerIdNumber: "", method: "otp",
    otpVerifiedAt: null, ipAddress: null, userAgent: null, confirmed: false,
    otpHash: null, otpExpiresAt: null, otpAttempts: 0,
  });

  await writeAudit(docRef.id, "created", {
    actorUid: request.auth.uid, actorRole: "founder",
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });

  return { contractId: docRef.id };
});

/* ── Founder gửi cho Bên B (sinh link ký) ────────────────────────── */
exports.draftSendContract = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const { contractId } = request.data || {};
  if (!contractId) throw new HttpsError("invalid-argument", "Thiếu contractId");

  const ref = db.collection("contracts_draft").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy hợp đồng");

  await ref.update({
    status: "sent",
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(contractId, "sent", {
    actorUid: request.auth.uid, actorRole: "founder",
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });

  return { ok: true, signPath: "contract-sign_draft.html?id=" + contractId };
});

/* ── Founder xác nhận Bên A (thay ALN ký, không qua OTP) ─────────── */
exports.draftConfirmPartyA = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const { contractId } = request.data || {};
  if (!contractId) throw new HttpsError("invalid-argument", "Thiếu contractId");

  const ref = db.collection("contracts_draft").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy hợp đồng");
  const contract = snap.data();

  await ref.collection("signatures_draft").doc("A").set({
    signerName: contract.partyA.repName,
    signerIdNumber: "",
    method: "manual",
    otpVerifiedAt: FieldValue.serverTimestamp(),
    ipAddress: reqIp(request),
    userAgent: reqUserAgent(request),
    confirmed: true,
  }, { merge: true });

  await ref.update({ updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(contractId, "signed", {
    party: "A", actorUid: request.auth.uid, actorRole: "founder",
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });

  const finalized = await maybeFinalize(contractId, request);
  return { ok: true, finalized: finalized };
});

/* ── Đọc hợp đồng cho trang ký (không cần đăng nhập — bearer link) ─ */
exports.draftGetContract = onCall({ region: "asia-southeast1" }, async (request) => {
  const { contractId } = request.data || {};
  if (!contractId) throw new HttpsError("invalid-argument", "Thiếu contractId");

  const ref = db.collection("contracts_draft").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy hợp đồng");
  const contract = snap.data();

  if (contract.status === "sent") {
    await ref.update({ status: "viewed", updatedAt: FieldValue.serverTimestamp() });
    contract.status = "viewed";
  }

  await writeAudit(contractId, "viewed", {
    actorUid: (request.auth && request.auth.uid) || null,
    actorRole: (request.auth && request.auth.uid === FOUNDER_UID) ? "founder" : "partyB",
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });

  const sigSnap = await ref.collection("signatures_draft").get();
  const signatures = {};
  sigSnap.forEach(function (d) {
    const v = d.data();
    signatures[d.id] = {
      confirmed: !!v.confirmed,
      signerName: v.signerName || "",
      otpVerifiedAt: v.otpVerifiedAt || null,
    };
  });

  return {
    contractId: contractId,
    type: contract.type,
    status: contract.status,
    projectId: contract.projectId,
    partyA: contract.partyA,
    partyB: contract.partyB,
    contractData: contract.contractData,
    signatures: signatures,
    createdAt: contract.createdAt,
    sentAt: contract.sentAt,
  };
});

/* ── Bước 1: sinh OTP demo (chưa gửi SMS/email thật) ─────────────── */
exports.draftRequestOtp = onCall({ region: "asia-southeast1" }, async (request) => {
  const { contractId, party } = request.data || {};
  if (!contractId || (party !== "A" && party !== "B")) {
    throw new HttpsError("invalid-argument", "Thiếu contractId hoặc party không hợp lệ");
  }

  const ref = db.collection("contracts_draft").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy hợp đồng");

  const sigRef = ref.collection("signatures_draft").doc(party);
  const sigSnap = await sigRef.get();
  if (sigSnap.exists && sigSnap.data().confirmed) {
    throw new HttpsError("failed-precondition", "Bên này đã ký rồi");
  }

  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const otpHash = crypto.createHash("sha256").update(contractId + ":" + party + ":" + otp).digest("hex");
  const expiresAt = Timestamp.fromMillis(Date.now() + OTP_TTL_MS);

  await sigRef.set({
    otpHash: otpHash,
    otpExpiresAt: expiresAt,
    otpAttempts: 0,
    method: "otp",
  }, { merge: true });

  if (party === "B") {
    await ref.update({ status: "otp_pending", updatedAt: FieldValue.serverTimestamp() });
  }

  await writeAudit(contractId, "otp_requested", {
    party: party, actorUid: (request.auth && request.auth.uid) || null,
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });

  // DEMO ONLY — chưa gửi SMS/email thật, trả OTP thẳng về response + log console.
  console.log("[contracts_draft] OTP demo — hợp đồng " + contractId + " bên " + party + ": " + otp);

  return { ok: true, otpDemo: otp, expiresInSec: OTP_TTL_MS / 1000 };
});

/* ── Bước 2: xác thực OTP → ký ────────────────────────────────────
   Hàm DUY NHẤT được phép đổi trạng thái sang đã ký — client không tự ghi. */
exports.draftVerifyOtp = onCall({ region: "asia-southeast1" }, async (request) => {
  const { contractId, party, otp } = request.data || {};
  if (!contractId || (party !== "A" && party !== "B") || !otp) {
    throw new HttpsError("invalid-argument", "Thiếu dữ liệu xác thực OTP");
  }

  const ref = db.collection("contracts_draft").doc(contractId);
  const sigRef = ref.collection("signatures_draft").doc(party);
  const sigSnap = await sigRef.get();
  if (!sigSnap.exists) throw new HttpsError("not-found", "Không tìm thấy chữ ký");
  const sig = sigSnap.data();

  if (sig.confirmed) throw new HttpsError("failed-precondition", "Bên này đã ký rồi");
  if (!sig.otpHash || !sig.otpExpiresAt) {
    throw new HttpsError("failed-precondition", "Chưa yêu cầu OTP, vui lòng bấm Ký hợp đồng lại");
  }
  if (sig.otpExpiresAt.toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Mã OTP đã hết hạn, vui lòng gửi lại");
  }
  if ((sig.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new HttpsError("resource-exhausted", "Nhập sai quá số lần cho phép, vui lòng gửi lại OTP");
  }

  const otpHash = crypto.createHash("sha256").update(contractId + ":" + party + ":" + String(otp)).digest("hex");
  if (otpHash !== sig.otpHash) {
    await sigRef.update({ otpAttempts: FieldValue.increment(1) });
    throw new HttpsError("permission-denied", "Mã OTP không đúng");
  }

  const contractSnap = await ref.get();
  if (!contractSnap.exists) throw new HttpsError("not-found", "Không tìm thấy hợp đồng");
  const contract = contractSnap.data();
  const partyInfo = party === "A" ? contract.partyA : contract.partyB;

  await sigRef.update({
    confirmed: true,
    signerName: partyInfo.name || partyInfo.repName || "",
    signerIdNumber: partyInfo.idNumber || "",
    otpVerifiedAt: FieldValue.serverTimestamp(),
    ipAddress: reqIp(request),
    userAgent: reqUserAgent(request),
  });

  const newStatus = party === "B" ? "signed_partyB" : contract.status;
  await ref.update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });

  await writeAudit(contractId, "otp_verified", {
    party: party, actorUid: (request.auth && request.auth.uid) || null,
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });
  await writeAudit(contractId, "signed", {
    party: party, actorUid: (request.auth && request.auth.uid) || null,
    ipAddress: reqIp(request), userAgent: reqUserAgent(request),
  });

  const finalized = await maybeFinalize(contractId, request);
  return { ok: true, finalized: finalized };
});

/* ── Bước 3: chốt hợp đồng khi cả 2 bên đã ký (idempotent) ───────── */
exports.draftFinalizeContract = onCall({ region: "asia-southeast1" }, async (request) => {
  const { contractId } = request.data || {};
  if (!contractId) throw new HttpsError("invalid-argument", "Thiếu contractId");
  const finalized = await maybeFinalize(contractId, request);
  return { ok: true, finalized: finalized };
});

/* ── Founder: danh sách hợp đồng ─────────────────────────────────── */
exports.draftListContracts = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const snap = await db.collection("contracts_draft").orderBy("updatedAt", "desc").limit(100).get();
  const items = [];
  snap.forEach(function (d) {
    const c = d.data();
    items.push({
      contractId: d.id, type: c.type, status: c.status,
      partyB: c.partyB, createdAt: c.createdAt, sentAt: c.sentAt, updatedAt: c.updatedAt,
    });
  });
  return { items: items };
});

/* ── Founder: timeline auditLog_draft của 1 hợp đồng ─────────────── */
exports.draftGetAuditLog = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const { contractId } = request.data || {};
  if (!contractId) throw new HttpsError("invalid-argument", "Thiếu contractId");
  const snap = await db.collection("contracts_draft").doc(contractId)
    .collection("auditLog_draft").orderBy("timestamp", "asc").get();
  const items = [];
  snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
  return { items: items };
});
