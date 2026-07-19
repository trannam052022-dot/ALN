/**
 * duToanLeads — Tool "Dự toán xây nhà 60 giây" (du-toan/*.html, Trụ 2
 * SEO_BAN_GIAO.md Phase 2)
 *
 * submitDuToanLead (onCall) — nút "Nhận bảng dự toán chi tiết PDF + tư vấn
 * miễn phí" gọi hàm này thay vì setDoc thẳng vào Firestore. Cùng lý do và
 * cùng pattern với submitMauLead/submitHomeLead (xem functions/mauLeads.js,
 * functions/ktsFunnel.js): khách trên trang tool KHÔNG đăng nhập, App Check
 * token đôi khi không được cấp trên thiết bị thật → ghi client trực tiếp dễ
 * permission-denied, mất lead. Ghi server-side bằng Admin SDK.
 *
 * Ghi vào collection `leads` — CHUNG với lead diễn đàn (functions/forum.js)
 * và Kho mẫu (functions/mauLeads.js), đúng schema MARKETING.md, KHÔNG tách
 * collection riêng. Thêm source:'du-toan' để phân biệt kênh. Dùng lại
 * scoreLead() từ forum.js, không tính điểm riêng.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { scoreLead } = require("./forum");
const { upsertContactCore } = require("./contacts");

if (!admin.apps.length) admin.initializeApp();

const BUDGET_ENUM = ["<1ty", "1-2ty", ">=2ty"];
const PROJECT_TYPE_ENUM = ["xay_moi", "thiet_ke", "cai_tao"];

/* Lọc object utm chỉ giữ 5 khoá chuẩn, cắt độ dài — chống ghi rác vào Firestore */
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

exports.submitDuToanLead = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const d = request.data || {};
    const name = String(d.name || "").trim().slice(0, 100);
    const phone = String(d.phone || "").replace(/[\s.\-()]/g, "");
    if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập họ tên.");
    if (!/^0\d{8,10}$/.test(phone)) throw new HttpsError("invalid-argument", "SĐT chưa đúng (VD: 0909xxxxxx).");

    const db = admin.firestore();

    /* Chống gửi trùng: cùng SĐT trong 10 phút → trả lại lead cũ */
    try {
      const dup = await db.collection("leads")
        .where("phone", "==", phone)
        .where("source", "==", "du-toan")
        .limit(5).get();
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const docSnap of dup.docs) {
        const t = docSnap.get("createdAt");
        if (t && typeof t.toMillis === "function" && t.toMillis() > cutoff) {
          return { ok: true, id: docSnap.id, dup: true };
        }
      }
    } catch (e) {
      console.warn("[submitDuToanLead] check trùng lỗi (bỏ qua):", e.message);
    }

    const brief = {
      projectType: PROJECT_TYPE_ENUM.includes(d.projectType) ? d.projectType : "xay_moi",
      area: Number(d.area) > 0 ? Number(d.area) : null,
      budget: BUDGET_ENUM.includes(d.budget) ? d.budget : null,
      hasLand: null,
      timeline: null,
      region: String(d.region || "").trim().slice(0, 80),
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
      region: brief.region || null,
      score, tier,
      status: "new",
      source: "du-toan",
      duToanKetQua: {
        loai: String(d.loai || "").slice(0, 40),
        tang: Number(d.tang) > 0 ? Number(d.tang) : null,
        mucHoanThien: String(d.mucHoanThien || "").slice(0, 40),
        tinh: String(d.tinh || "").slice(0, 60),
        min: Number(d.tongMin) > 0 ? Number(d.tongMin) : null,
        max: Number(d.tongMax) > 0 ? Number(d.tongMax) : null,
      },
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
        chi_tiet_nguon: "Form lead Dự toán 60 giây",
      });
    } catch (e) {
      console.warn("[submitDuToanLead] upsertContact:", e.message);
    }

    return { ok: true, id: ref.id };
  }
);
