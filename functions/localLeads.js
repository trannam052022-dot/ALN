/**
 * localLeads — Trang dịch vụ thiết kế theo tỉnh (thiet-ke-nha/{tinh}.html,
 * SEO_BAN_GIAO.md Phase 3)
 *
 * submitLocalLead (onCall) — form lead trên trang tỉnh gọi hàm này thay vì
 * setDoc thẳng vào Firestore. Cùng lý do và cùng pattern với
 * submitMauLead/submitDuToanLead/submitHomeLead: khách KHÔNG đăng nhập,
 * App Check token đôi khi không được cấp trên thiết bị thật → ghi client
 * trực tiếp dễ permission-denied, mất lead. Ghi server-side bằng Admin SDK.
 *
 * Ghi vào collection `leads` — CHUNG với lead diễn đàn/Kho mẫu/Dự toán,
 * đúng schema MARKETING.md. source luôn dạng "local-{tinh}" — TỰ TÍNH server
 * side từ slug tỉnh đã xác thực (không nhận thẳng chuỗi source từ client)
 * để tránh client tự ý gán source giả.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { scoreLead } = require("./forum");
const { upsertContactCore } = require("./contacts");

if (!admin.apps.length) admin.initializeApp();

const BUDGET_ENUM = ["<1ty", "1-2ty", ">=2ty"];
const PROJECT_TYPE_ENUM = ["xay_moi", "thiet_ke", "cai_tao"];
// Danh sách tỉnh hợp lệ — PHẢI khớp data/tinh.json (tools/gen-tinh.js đọc
// cùng nguồn khi build trang tĩnh). Thêm tỉnh mới ở CẢ 2 nơi.
const VALID_TINH_SLUGS = ["vung-tau", "ba-ria", "tp-hcm", "bien-hoa", "dong-nai", "binh-duong"];

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

exports.submitLocalLead = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const d = request.data || {};
    const name = String(d.name || "").trim().slice(0, 100);
    const phone = String(d.phone || "").replace(/[\s.\-()]/g, "");
    if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập họ tên.");
    if (!/^0\d{8,10}$/.test(phone)) throw new HttpsError("invalid-argument", "SĐT chưa đúng (VD: 0909xxxxxx).");

    const tinh = String(d.tinh || "");
    if (!VALID_TINH_SLUGS.includes(tinh)) throw new HttpsError("invalid-argument", "Thiếu khu vực hợp lệ.");
    const source = "local-" + tinh;

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
      console.warn("[submitLocalLead] check trùng lỗi (bỏ qua):", e.message);
    }

    const brief = {
      projectType: PROJECT_TYPE_ENUM.includes(d.projectType) ? d.projectType : "thiet_ke",
      area: Number(d.area) > 0 ? Number(d.area) : null,
      budget: BUDGET_ENUM.includes(d.budget) ? d.budget : null,
      hasLand: null,
      timeline: null,
      region: String(d.tinhTen || tinh).slice(0, 80),
    };
    const { score, tier } = scoreLead(brief);

    const raw = request.rawRequest || {};
    const headers = raw.headers || {};
    const ip = String(headers["x-forwarded-for"] || "").split(",")[0].trim() || raw.ip || "";

    const utm = cleanUtm(d.utm);
    const ref = db.collection("leads").doc();
    await ref.set({
      name, phone,
      projectType: brief.projectType,
      area: brief.area,
      budget: brief.budget,
      hasLand: brief.hasLand,
      timeline: brief.timeline,
      region: brief.region,
      score, tier,
      status: "new",
      source,
      tinh,
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
        chi_tiet_nguon: "Form lead trang tỉnh " + tinh,
      });
    } catch (e) {
      console.warn("[submitLocalLead] upsertContact:", e.message);
    }

    return { ok: true, id: ref.id };
  }
);
