/**
 * mauLeads — Kho mẫu nhà (mau/{slug}.html, Trụ 1 SEO_BAN_GIAO.md Phase 1)
 *
 * submitMauLead (onCall) — 2 CTA trên trang mẫu ("Mua mẫu này" / "Tư vấn miễn
 * phí") gọi hàm này thay vì setDoc thẳng vào Firestore. Lý do giống hệt
 * submitHomeLead (xem functions/ktsFunnel.js): khách trên trang mẫu KHÔNG đăng
 * nhập, App Check token đôi khi không được cấp trên thiết bị thật (reCAPTCHA
 * bị chặn/điểm thấp) → ghi client trực tiếp dễ permission-denied, mất lead.
 * Ghi server-side bằng Admin SDK, không phụ thuộc App Check phía khách.
 *
 * Ghi vào collection `leads` — CHUNG với lead diễn đàn (functions/forum.js) và
 * đúng schema MARKETING.md, KHÔNG tách collection riêng — để loop Speed-to-Lead
 * và founder_panel (tab "Lead") dùng chung một nguồn. Thêm source:'mau' + mauId
 * để phân biệt kênh. Dùng lại scoreLead() từ forum.js, không tính điểm riêng.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { scoreLead } = require("./forum");
const { upsertContactCore } = require("./contacts");

if (!admin.apps.length) admin.initializeApp();

const BUDGET_ENUM = ["<1ty", "1-2ty", ">=2ty"];

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

exports.submitMauLead = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const d = request.data || {};
    const name = String(d.name || "").trim().slice(0, 100);
    const phone = String(d.phone || "").replace(/[\s.\-()]/g, "");
    if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập họ tên.");
    if (!/^0\d{8,10}$/.test(phone)) throw new HttpsError("invalid-argument", "SĐT chưa đúng (VD: 0909xxxxxx).");

    const mauId = String(d.mauId || "").trim().slice(0, 40);
    if (!mauId) throw new HttpsError("invalid-argument", "Thiếu mẫu nhà.");

    const db = admin.firestore();

    /* Chống gửi trùng: cùng SĐT + cùng mẫu trong 10 phút → trả lại lead cũ */
    try {
      const dup = await db.collection("leads")
        .where("phone", "==", phone)
        .where("mauId", "==", mauId)
        .limit(5).get();
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const docSnap of dup.docs) {
        const t = docSnap.get("createdAt");
        if (t && typeof t.toMillis === "function" && t.toMillis() > cutoff) {
          return { ok: true, id: docSnap.id, dup: true };
        }
      }
    } catch (e) {
      console.warn("[submitMauLead] check trùng lỗi (bỏ qua):", e.message);
    }

    const brief = {
      projectType: "thiet_ke",
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
      source: "mau",
      mauId,
      mauTen: String(d.mauTen || "").trim().slice(0, 160),
      cta: d.cta === "tuvan" ? "tuvan" : "mua",
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
        chi_tiet_nguon: "Form lead Kho mẫu (" + mauId + ")",
      });
    } catch (e) {
      console.warn("[submitMauLead] upsertContact:", e.message);
    }

    return { ok: true, id: ref.id };
  }
);
