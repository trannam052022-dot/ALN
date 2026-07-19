/**
 * contacts — Bảng liên hệ hợp nhất (spec ALN_SPEC_BANG_LIEN_HE_HOP_NHAT.md)
 *
 * upsertContact (onCall, public — không đòi request.auth vì MyMy trên
 * index.html gọi lúc khách chưa đăng nhập, giống pattern submitHomeLead) —
 * điểm ghi DUY NHẤT vào collection `contacts`. Lọc trùng XUYÊN NGUỒN theo
 * phone_normalized: nếu SĐT đã tồn tại, KHÔNG tạo bản ghi mới mà nối thêm
 * 1 phần tử vào lich_su_nguon của bản ghi cũ.
 *
 * upsertContactCore export riêng để các Cloud Function khác (ktsFunnel.js,
 * localLeads.js, mauLeads.js, duToanLeads.js, forum.js) gọi thẳng nội bộ —
 * khỏi phải tự HTTP-call lẫn nhau.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

// 3 loại gốc theo spec + 4 loại CTV mở rộng (dn/designer/ks/ncc — đăng ký
// đối tác, KHÔNG phải "kts_ung_tuyen" thật, tách riêng để thống kê GĐ4 không
// lẫn số liệu KTS ứng tuyển thật với các vai đối tác khác — Founder xác nhận
// 19/07/2026).
const LOAI_ENUM = [
  "khach_hang", "kts_ung_tuyen", "dien_dan",
  "dn_ung_tuyen", "designer_ung_tuyen", "ks_ung_tuyen", "ncc_ung_tuyen",
];
// Ưu tiên khi 1 SĐT chạm nhiều nguồn — nguồn ưu tiên cao hơn thắng, được
// gán làm loai_lien_he hiện hành + reset trang_thai về bước đầu của phễu đó
// (xem mục 2 của spec: "KTS ứng tuyển > diễn đàn, vì đây là bước tiến xa
// hơn trong phễu"; khach_hang xếp trên diễn đàn vì là lead có nhu cầu thật).
// Mọi loại "ứng tuyển CTV" (kts/dn/designer/ks/ncc) cùng bậc — hiếm khi 1
// người ứng tuyển 2 vai cùng lúc, giữ nguyên loại đăng ký trước nếu trùng bậc.
const PRIORITY = {
  kts_ung_tuyen: 3, dn_ung_tuyen: 3, designer_ung_tuyen: 3, ks_ung_tuyen: 3, ncc_ung_tuyen: 3,
  khach_hang: 2, dien_dan: 1,
};
const INITIAL_STATUS = {
  khach_hang: "moi", dien_dan: "chua_lien_he",
  kts_ung_tuyen: "moi_nop", dn_ung_tuyen: "moi_nop", designer_ung_tuyen: "moi_nop",
  ks_ung_tuyen: "moi_nop", ncc_ung_tuyen: "moi_nop",
};
// lich_su_nguon[].loai — mọi loại "ứng tuyển"/diễn đàn giữ nguyên nhãn để
// truy vết đúng nguồn; chỉ khach_hang gộp vào "khac" (theo enum hẹp mục 2 spec).
const HISTORY_LOAI_ENUM = LOAI_ENUM.filter((l) => l !== "khach_hang");

/** Nhận cả "+84901234567", "84901234567", "0901234567", có khoảng trắng/gạch/ngoặc → "0901234567". Trả null nếu không hợp lệ. */
function normalizePhone(raw) {
  let p = String(raw || "").replace(/[\s.\-()]/g, "").replace(/^\+/, "");
  if (p.startsWith("84") && p.length > 9) p = "0" + p.slice(2);
  if (!/^0\d{8,10}$/.test(p)) return null;
  return p;
}

async function upsertContactCore(data) {
  const d = data || {};
  const phone = normalizePhone(d.phone);
  if (!phone) throw new HttpsError("invalid-argument", "SĐT chưa hợp lệ.");
  const loai = LOAI_ENUM.includes(d.loai_lien_he) ? d.loai_lien_he : null;
  if (!loai) throw new HttpsError("invalid-argument", "loai_lien_he chưa hợp lệ.");
  const name = String(d.name || "").trim().slice(0, 120) || null;
  const nguon = String(d.nguon || "khac").trim().slice(0, 40) || "khac";
  const campaignTag = d.campaign_tag ? String(d.campaign_tag).trim().slice(0, 80) : null;
  const chiTiet = String(d.chi_tiet_nguon || "").trim().slice(0, 200);

  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const historyEntry = {
    loai: HISTORY_LOAI_ENUM.includes(loai) ? loai : "khac",
    thoi_gian: admin.firestore.Timestamp.now(), // mảng không nhận sentinel serverTimestamp()
    chi_tiet: chiTiet,
  };

  const existing = await db.collection("contacts")
    .where("phone_normalized", "==", phone)
    .limit(1).get();

  if (existing.empty) {
    const ref = db.collection("contacts").doc();
    await ref.set({
      contact_id: ref.id,
      phone_normalized: phone,
      name,
      loai_lien_he: loai,
      trang_thai: INITIAL_STATUS[loai],
      nguon,
      campaign_tag: campaignTag,
      ghi_chu: null,
      lich_su_nguon: [historyEntry],
      created_at: now,
      updated_at: now,
    });
    return { ok: true, id: ref.id, created: true };
  }

  const docSnap = existing.docs[0];
  const cur = docSnap.data() || {};
  const update = {
    lich_su_nguon: admin.firestore.FieldValue.arrayUnion(historyEntry),
    updated_at: now,
  };
  if (name && !cur.name) update.name = name;
  if ((PRIORITY[loai] || 0) > (PRIORITY[cur.loai_lien_he] || 0)) {
    update.loai_lien_he = loai;
    update.trang_thai = INITIAL_STATUS[loai];
  }
  await docSnap.ref.update(update);
  return { ok: true, id: docSnap.id, created: false };
}

exports.normalizePhone = normalizePhone;
exports.upsertContactCore = upsertContactCore;

exports.upsertContact = onCall(
  { region: "asia-southeast1" },
  async (request) => upsertContactCore(request.data)
);

/* ══════════════════════════════════════════════════════════════════
   Founder_panel tab "Liên hệ" — mọi đọc/ghi dữ liệu contacts (chứa SĐT,
   là dữ liệu cá nhân) đi qua callable Founder-only dưới đây, KHÔNG mở
   firestore.rules cho client đọc thẳng collection này (giống pattern
   nccLeads/seoReportNow — đổi firestore.rules cần hỏi Founder trước,
   xem CLAUDE.md).
══════════════════════════════════════════════════════════════════ */
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
// Trần lấy dữ liệu 1 lần cho thống kê/segment — collection contacts hiện
// còn nhỏ, quét toàn bộ trong trần này là đủ; nếu sau này vượt trần cần
// chuyển sang phân trang thật (startAfter theo updated_at).
const MAX_FETCH = 5000;

function requireFounder(request) {
  if (!request.auth || request.auth.uid !== FOUNDER_UID) {
    throw new HttpsError("permission-denied", "Chỉ Founder mới xem được mục này.");
  }
}

function tsToMillis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

function serializeContact(id, c) {
  return {
    id,
    phone_normalized: c.phone_normalized || "",
    name: c.name || null,
    loai_lien_he: c.loai_lien_he || null,
    trang_thai: c.trang_thai || null,
    nguon: c.nguon || null,
    campaign_tag: c.campaign_tag || null,
    ghi_chu: c.ghi_chu || null,
    lich_su_nguon: Array.isArray(c.lich_su_nguon)
      ? c.lich_su_nguon.map((h) => ({
          loai: h.loai || "khac",
          thoi_gian: tsToMillis(h.thoi_gian),
          chi_tiet: h.chi_tiet || "",
        }))
      : [],
    created_at: tsToMillis(c.created_at),
    updated_at: tsToMillis(c.updated_at),
  };
}

/* Quét tối đa MAX_FETCH bản ghi mới cập nhật nhất — CHỈ orderBy (không
   where) để dùng single-field index tự động, tránh phải tạo composite
   index (đổi firestore.indexes.json cần hỏi Founder trước). Lọc theo
   loai_lien_he/trang_thai/nguon/campaign_tag làm trong bộ nhớ bên dưới. */
/* Dùng chung cho GĐ3 (bảng) lẫn GĐ4 (segment/export/thống kê) — segmentContacts
   không truyền filter nào = trả về tất cả (đủ cho bảng chính của tab "Liên hệ"). */
async function fetchRawContacts() {
  const snap = await admin.firestore().collection("contacts")
    .orderBy("updated_at", "desc").limit(MAX_FETCH).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
}

exports.updateContact = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const d = request.data || {};
  const id = String(d.id || "").trim();
  if (!id) throw new HttpsError("invalid-argument", "Thiếu id liên hệ.");
  const update = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
  if (typeof d.trang_thai === "string" && d.trang_thai.trim()) {
    update.trang_thai = d.trang_thai.trim().slice(0, 40);
  }
  if (typeof d.ghi_chu === "string") {
    update.ghi_chu = d.ghi_chu.trim().slice(0, 2000) || null;
  }
  await admin.firestore().collection("contacts").doc(id).update(update);
  return { ok: true };
});

exports.getContactStats = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const raw = await fetchRawContacts();
  const byLoai = {};
  const byTrangThai = {};
  const byNguon = {};
  const byCampaign = {};
  const byWeek = {}; // "YYYY-Www" → count, dựa trên created_at

  for (const { data: c } of raw) {
    byLoai[c.loai_lien_he || "khac"] = (byLoai[c.loai_lien_he || "khac"] || 0) + 1;
    byTrangThai[c.trang_thai || "khac"] = (byTrangThai[c.trang_thai || "khac"] || 0) + 1;
    byNguon[c.nguon || "khac"] = (byNguon[c.nguon || "khac"] || 0) + 1;
    if (c.campaign_tag) byCampaign[c.campaign_tag] = (byCampaign[c.campaign_tag] || 0) + 1;

    const ms = tsToMillis(c.created_at);
    if (ms) {
      const dt = new Date(ms);
      const onejan = new Date(dt.getFullYear(), 0, 1);
      const week = Math.ceil((((dt - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      const key = dt.getFullYear() + "-W" + String(week).padStart(2, "0");
      byWeek[key] = (byWeek[key] || 0) + 1;
    }
  }

  return {
    total: raw.length,
    byLoai, byTrangThai, byNguon, byCampaign,
    byWeek,
    scannedCapped: raw.length >= MAX_FETCH,
  };
});

exports.segmentContacts = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const d = request.data || {};
  const fromMs = Number(d.from) || null;
  const toMs = Number(d.to) || null;
  const raw = await fetchRawContacts();
  const filtered = raw.filter(({ data: c }) => {
    if (d.loai_lien_he && c.loai_lien_he !== d.loai_lien_he) return false;
    if (d.trang_thai && c.trang_thai !== d.trang_thai) return false;
    if (d.nguon && c.nguon !== d.nguon) return false;
    if (d.campaign_tag && c.campaign_tag !== d.campaign_tag) return false;
    const ms = tsToMillis(c.created_at);
    if (fromMs && (!ms || ms < fromMs)) return false;
    if (toMs && (!ms || ms > toMs)) return false;
    return true;
  });
  return { items: filtered.map(({ id, data: c }) => serializeContact(id, c)) };
});

exports.tagCampaignBulk = onCall({ region: "asia-southeast1" }, async (request) => {
  requireFounder(request);
  const d = request.data || {};
  const ids = Array.isArray(d.ids) ? d.ids.filter((x) => typeof x === "string" && x).slice(0, 2000) : [];
  const campaignTag = String(d.campaign_tag || "").trim().slice(0, 80);
  if (!ids.length) throw new HttpsError("invalid-argument", "Chưa chọn liên hệ nào.");
  if (!campaignTag) throw new HttpsError("invalid-argument", "Thiếu nhãn chiến dịch.");

  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  // Firestore giới hạn 500 ghi/batch — chia nhỏ nếu chọn nhiều hơn
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch();
    for (const id of ids.slice(i, i + 400)) {
      batch.update(db.collection("contacts").doc(id), { campaign_tag: campaignTag, updated_at: now });
    }
    await batch.commit();
  }
  return { ok: true, count: ids.length };
});
