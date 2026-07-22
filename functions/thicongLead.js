/**
 * thicongLead — Form đăng ký nhận tư vấn trên subdomain SEO "Thi công"
 * (thicong/lead-form.html, LỆNH_CODE_SEO_THICONG.md)
 *
 * submitThicongLead (onCall) — form lead ẩn danh gọi hàm này thay vì addDoc
 * thẳng vào Firestore. Cùng lý do và cùng pattern với
 * submitLocalLead/submitMauLead/submitDuToanLead: khách KHÔNG đăng nhập,
 * collection `leads` có allow write: if false trong firestore.rules (chỉ
 * Cloud Function/Admin SDK được ghi) — ghi client trực tiếp sẽ luôn bị
 * permission-denied. Ghi server-side bằng Admin SDK.
 *
 * Ghi vào collection `leads` — CHUNG với lead trang tỉnh/Kho mẫu/Dự toán,
 * source cố định "thicong-seo" (server tự gán, KHÔNG nhận chuỗi source từ
 * client, để tránh client tự ý gán source giả).
 *
 * Không tính score/tier (scoreLead ở forum.js cần budget/timeline/hasLand —
 * form thi công không thu các trường này, ép vào sẽ ra điểm không có ý nghĩa).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { upsertContactCore } = require("./contacts");

if (!admin.apps.length) admin.initializeApp();

const PROJECT_TYPE_ENUM = ["Nhà phố", "Biệt thự", "Nhà cấp 4", "Căn hộ / cải tạo nội thất", "Khác"];
const DESIGN_STAGE_ENUM = [
  "Đã có bản vẽ, đang tìm đơn vị thi công",
  "Đang thiết kế, chưa xong bản vẽ",
  "Chưa bắt đầu, đang tìm hiểu",
];

function cleanUtm(raw) {
  const out = {};
  const keys = ["source", "medium", "campaign", "content", "term"];
  if (raw && typeof raw === "object") {
    for (const k of keys) {
      if (typeof raw[k] === "string" && raw[k].trim()) out[k] = raw[k].trim().slice(0, 120);
    }
  }
  return out;
}

exports.submitThicongLead = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const d = request.data || {};
    const name = String(d.name || "").trim().slice(0, 100);
    const phone = String(d.phone || "").replace(/[\s.\-()]/g, "");
    if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập họ tên.");
    if (!/^0\d{8,10}$/.test(phone)) throw new HttpsError("invalid-argument", "SĐT chưa đúng (VD: 0909xxxxxx).");

    const area = String(d.area || "").trim().slice(0, 80);
    if (!area) throw new HttpsError("invalid-argument", "Vui lòng chọn khu vực công trình.");

    const projectType = PROJECT_TYPE_ENUM.includes(d.projectType) ? d.projectType : "Khác";
    const designStage = DESIGN_STAGE_ENUM.includes(d.designStage) ? d.designStage : null;
    const source = "thicong-seo";

    const db = admin.firestore();

    try {
      const dup = await db.collection("leads")
        .where("phone", "==", phone)
        .where("source", "==", source)
        .limit(5).get();
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const docSnap of dup.docs) {
        const t = docSnap.get("createdAt");
        if (t && typeof t.toMillis === "function" && t.toMillis() > cutoff) {
          return { ok: true, id: docSnap.id, dup: true };
        }
      }
    } catch (e) {
      console.warn("[submitThicongLead] check trùng lỗi (bỏ qua):", e.message);
    }

    const raw = request.rawRequest || {};
    const headers = raw.headers || {};
    const ip = String(headers["x-forwarded-for"] || "").split(",")[0].trim() || raw.ip || "";

    const utm = cleanUtm(d.utm);
    const ref = db.collection("leads").doc();
    await ref.set({
      name, phone,
      area,
      projectType,
      designStage,
      status: "new",
      source,
      utm,
      sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl.slice(0, 300) : "",
      fbp: typeof d.fbp === "string" ? d.fbp.slice(0, 200) : "",
      fbc: typeof d.fbc === "string" ? d.fbc.slice(0, 200) : "",
      ip: String(ip).slice(0, 60),
      ua: String(headers["user-agent"] || "").slice(0, 400),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    /* Bảng liên hệ hợp nhất (contacts/) — song song, không chặn luồng lead chính */
    try {
      await upsertContactCore({
        phone, name,
        loai_lien_he: "khach_hang",
        nguon: utm.source || "direct",
        campaign_tag: utm.campaign || null,
        chi_tiet_nguon: "Form lead thicong SEO (" + projectType + ")",
      });
    } catch (e) {
      console.warn("[submitThicongLead] upsertContact:", e.message);
    }

    return { ok: true, id: ref.id };
  }
);
