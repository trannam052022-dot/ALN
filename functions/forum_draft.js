/* ════════════════════════════════════════════════════════════════
   DIỄN ĐÀN ALN — BẢN NHÁP (forum_draft)
   ────────────────────────────────────────────────────────────────
   TOÀN BỘ ghi dữ liệu diễn đàn đi qua các callable trong file này
   (Admin SDK) → client KHÔNG ghi trực tiếp → bộ lọc chống lách sàn,
   phân quyền, moderation, điểm uy tín đều được cưỡng chế server-side.

   Mọi collection đều mang hậu tố _draft — KHÔNG đụng dữ liệu thật.
   Chỉ ĐỌC (không ghi) 2 collection thật: users/ (hồ sơ, role) và
   fcmTokens/ (gửi push). Khi nghiệm thu: đổi hằng số COL bên dưới.
════════════════════════════════════════════════════════════════ */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");
const VN_TZ = "Asia/Ho_Chi_Minh";

if (!admin.apps.length) admin.initializeApp();
const fdb = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const REGION = "asia-southeast1";
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const BASE_URL = "https://trannam052022-dot.github.io/ALN/";
const FORUM_URL = BASE_URL + "forum_draft.html";

/* Tên collection — đổi 1 chỗ này khi chuyển nháp → thật */
const COL = {
  posts:      "alnPosts_draft",
  reports:    "reports_draft",
  modLogs:    "modLogs_draft",
  invites:    "invites_draft",
  leads:      "leads_draft",
  config:     "forumConfig_draft",
  reputation: "ktsReputation_draft",
  userState:  "forumUserState_draft",
  notifBuf:   "notifBuffer_draft",
  modQueue:   "modQueue_draft",      // hàng chờ duyệt tập trung cho founder panel
  camNang:    "camNangForum_draft",  // Best Answer được đề cử đưa vào Cẩm nang (nháp)
  digest:     "forumDigest_draft",   // bản tin Q&A hằng tuần (nháp)
};

const CATEGORIES = ["hoi_dap", "vat_lieu", "showcase", "nghe", "bang_tin", "tu_van_du_an"];
const KTS_POST_CATEGORIES = ["hoi_dap", "vat_lieu", "showcase", "nghe"];
const OPEN_CATEGORIES = ["tu_van_du_an", "showcase", "bang_tin"]; // CN/DN xem được (P2)
const NEW_ACCOUNT_FREE_AFTER = 3;      // từ đóng góp thứ 4 đăng thẳng (hậu kiểm)
const NOTIF_BATCH_WINDOW_MS = 10 * 60 * 1000; // gộp thông báo 10 phút

const BLOCK_MSG = "Trao đổi dự án thực hiện qua kênh chat sàn ALN để được bảo vệ bởi Quy trình 4 bước.";

/* ── BỘ LỌC CHỐNG LÁCH SÀN (bản server — bản client chỉ để UX) ── */
const ALLOWED_HOSTS = ["applamnha.vn", "trannam052022-dot.github.io"];

/* Bỏ dấu tiếng Việt để bắt chữ số viết bằng chữ, không phân biệt hoa/thường */
function vnNormNoMark(s) {
  return String(s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d"); // đ → d
}
/* Đổi chữ số tiếng Việt → chữ số Ả Rập để bắt SĐT dạng "0909 tám hai chín sáu 90".
   Chỉ map 0–9 (ít false-positive: phải có chuỗi số dài liên tiếp mới khớp SĐT). */
const VN_NUM_WORDS = {
  khong: "0", mot: "1", hai: "2", ba: "3", bon: "4", tu: "4",
  nam: "5", lam: "5", sau: "6", bay: "7", tam: "8", chin: "9",
};
function vnDigitize(text) {
  return vnNormNoMark(text).replace(
    /\b(khong|mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin)\b/g,
    (m) => VN_NUM_WORDS[m]
  );
}

/* ── OCR ẢNH (Cloud Vision) — bắt SĐT/kênh ngoài dán bằng hình ── */
let _visionClient = null;
function visionClient() {
  if (!_visionClient) {
    const vision = require("@google-cloud/vision");
    _visionClient = new vision.ImageAnnotatorClient();
  }
  return _visionClient;
}
/* Đổi Firebase download URL → gs:// để service account đọc trực tiếp (không phụ thuộc token) */
function gsFromDownloadUrl(url) {
  const m = /\/v0\/b\/([^/]+)\/o\/([^?]+)/.exec(String(url || ""));
  if (!m) return null;
  return "gs://" + m[1] + "/" + decodeURIComponent(m[2]);
}
/* OCR từng ảnh, chạy lại bộ lọc text trên chữ đọc được. Trả 'phone'/'email'/... nếu vi phạm.
   Vision lỗi → KHÔNG chặn (tránh chặn oan vì hạ tầng), chỉ log; nút Báo cáo là lớp chặn dự phòng. */
async function ocrMediaViolation(media) {
  const imgs = (Array.isArray(media) ? media : [])
    .filter((m) => m && m.type === "image" && m.url).slice(0, 4);
  for (const m of imgs) {
    try {
      const uri = gsFromDownloadUrl(m.url) || m.url;
      const [res] = await visionClient().textDetection(uri);
      const txt = (res.fullTextAnnotation && res.fullTextAnnotation.text) || "";
      const v = txt ? forumFilterViolation(txt) : null;
      if (v) return v;
    } catch (e) {
      console.warn("[forum] OCR fail:", (e && e.message) || e);
    }
  }
  return null;
}

function forumFilterViolation(text) {
  if (!text) return null;
  const t = String(text);

  // 1. Email (kể cả né bằng " a còng "/" at "/"(a)" thay @ và " chấm " thay .)
  const deAt = t
    .replace(/\s*(\(|\[)?\s*(a còng|a cong|a móc|a moc|at)\s*(\)|\])?\s*/gi, "@")
    .replace(/\s+(chấm|cham|dot)\s+/gi, ".");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(deAt)) return "email";

  // 2. Từ khóa kênh ngoài
  if (/(zalo|viber|telegram|tele\b|whatsapp|wechat|s[đd]t\b|số\s*[đd]t|số\s*điện\s*thoại|gmail|hotmail|yahoo|facebook\.com|fb\.com|messenger|instagram|tiktok)/i.test(t)) {
    return "keyword";
  }

  // 3. Link ngoài (http/https/www không thuộc domain ALN)
  const linkRe = /(https?:\/\/|www\.)[^\s<>"']+/gi;
  let m;
  while ((m = linkRe.exec(t))) {
    let url = m[0];
    if (!/^https?:/i.test(url)) url = "http://" + url;
    try {
      const host = new URL(url).hostname.toLowerCase();
      const ok = ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
      if (!ok) return "link";
    } catch (e) {
      return "link";
    }
  }

  // 4. SĐT Việt Nam — chuẩn hóa bỏ khoảng trắng/chấm/gạch/ngoặc rồi dò
  const norm = t.replace(/[\s.\-_() ]/g, "");
  if (/(?:\+?84|0)\d{9,10}(?!\d)/.test(norm)) return "phone";
  // (b) chữ số viết bằng chữ xen kẽ số: "0909 tám hai chín sáu 90"
  const spelled = vnDigitize(t).replace(/[\s.\-_() ]/g, "");
  if (/(?:\+?84|0)\d{9,10}(?!\d)/.test(spelled)) return "phone";

  return null;
}

/* ── HELPERS ── */
function ts() { return FieldValue.serverTimestamp(); }
function inc(n) { return FieldValue.increment(n); }

async function getProfile(uid) {
  const snap = await fdb.collection("users").doc(uid).get();
  if (!snap.exists) {
    if (uid === FOUNDER_UID) {
      return { role: "founder", name: "KTS. Trần Đại Long", username: "founder.tranlong", status: "active", avatarUrl: "" };
    }
    return null;
  }
  return snap.data();
}

function isActive(profile) {
  return (profile.status || "active") === "active";
}

async function getP2Enabled() {
  const snap = await fdb.collection(COL.config).doc("flags").get();
  return snap.exists && !!snap.data().FORUM_P2_ENABLED;
}

function viewableCategories(role, p2) {
  if (role === "founder" || role === "kts") return CATEGORIES;
  if ((role === "cn" || role === "dn") && p2) return OPEN_CATEGORIES;
  return [];
}

function canPostCategory(role, cat, p2) {
  if (role === "founder") return true;
  if (role === "kts") return KTS_POST_CATEGORIES.includes(cat);
  if ((role === "cn" || role === "dn") && p2) return cat === "tu_van_du_an";
  return false;
}

/* Gửi push đến mọi FCM token của một uid — CHỈ ĐỌC fcmTokens, không dọn token hỏng (bản nháp) */
async function fdNotify(uid, title, body, extraData) {
  try {
    const snap = await fdb.collection("fcmTokens").where("uid", "==", uid).get();
    if (snap.empty) return;
    const tokens = snap.docs.map((d) => d.data().token).filter((t) => typeof t === "string" && t.length > 0);
    if (!tokens.length) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: { title, body, icon: "/ALN/icon-192.png", badge: "/ALN/icon-192.png" },
        fcmOptions: { link: FORUM_URL },
      },
      data: Object.assign({ click_action: FORUM_URL }, extraData || {}),
    });
  } catch (e) {
    console.error("[forum_draft notify]", e);
  }
}

/* Thông báo GỘP: mỗi (người nhận, thread) tối đa 1 push / 10 phút.
   Trong cửa sổ 10' chỉ đếm dồn; push kế tiếp kèm số bình luận đã dồn. */
async function fdNotifyBatched(uid, postId, title, body, extraData) {
  const key = uid + "__" + postId;
  const ref = fdb.collection(COL.notifBuf).doc(key);
  const snap = await ref.get();
  const now = Date.now();
  const last = snap.exists ? snap.data().lastSentAt || 0 : 0;
  const pending = snap.exists ? snap.data().pendingCount || 0 : 0;
  if (now - last > NOTIF_BATCH_WINDOW_MS) {
    await ref.set({ lastSentAt: now, pendingCount: 0 }, { merge: true });
    const suffix = pending > 0 ? ` (+${pending} bình luận trong 10 phút qua)` : "";
    await fdNotify(uid, title, body + suffix, extraData);
  } else {
    await ref.set({ pendingCount: inc(1) }, { merge: true });
  }
}

/* Điểm uy tín — CHỈ server cộng, client không ghi được (rules write:false) */
const REP_POINTS = { bestAnswer: 5, heart: 1, pin: 3, firstAnswer: 5 };

async function addRep(uid, type, sign, refPath) {
  const pts = (REP_POINTS[type] || 0) * sign;
  if (!pts) return;
  const ref = fdb.collection(COL.reputation).doc(uid);
  await ref.set({
    points: inc(pts),
    ["counts." + type]: inc(sign),
    updatedAt: ts(),
  }, { merge: true });
  await ref.collection("events").add({ type, delta: pts, refPath: refPath || null, createdAt: ts() });
}

/* Chính sách 3 bước: Cảnh báo (1-2) → Đề nghị khóa 90 ngày (3-4) → Đề nghị khóa vĩnh viễn (≥5).
   Bản nháp CHỈ ghi cờ đề nghị + báo Founder — KHÔNG tự khóa tài khoản thật. */
function modStageFromCount(n) {
  if (n >= 5) return { stage: "suggest_permanent", label: "Đề nghị khóa vĩnh viễn" };
  if (n >= 3) return { stage: "suggest_lock90",   label: "Đề nghị khóa 90 ngày" };
  return { stage: "warned", label: "Cảnh báo" };
}
async function logBlocked(uid, profile, kind, reason, text) {
  await fdb.collection(COL.modLogs).add({
    uid,
    name: (profile && profile.name) || "",
    role: (profile && profile.role) || "",
    kind,                              // 'post' | 'comment'
    reason,                            // 'phone' | 'keyword' | 'link' | 'email' | 'image:*'
    snippet: String(text || "").slice(0, 200),
    createdAt: ts(),
  });
  // Đếm dồn số lần lách sàn + tính bậc xử lý
  const stRef = fdb.collection(COL.userState).doc(uid);
  await stRef.set({ blockCount: inc(1), lastBlockAt: ts() }, { merge: true });
  const stSnap = await stRef.get();
  const n = (stSnap.exists && stSnap.data().blockCount) || 1;
  const { stage, label } = modStageFromCount(n);
  await stRef.set({ modStage: stage }, { merge: true });
  if (n === 3 || n === 5) {
    await fdNotify(FOUNDER_UID, "⚠️ Tái phạm lách sàn (" + n + " lần)",
      `${(profile && profile.name) || uid} — ${label}. Vào quản trị diễn đàn để xử lý.`,
      { type: "FORUM_REPEAT_OFFENDER", uid });
  }
}

/* Chấm điểm lead theo MARKETING.md */
function scoreLead(brief) {
  let s = 0;
  if (brief.budget === ">=2ty") s += 3; else if (brief.budget === "1-2ty") s += 2; else s += 1;
  if (brief.timeline === "<3thang") s += 3; else if (brief.timeline === "3-6thang") s += 2; else s += 1;
  if (brief.hasLand) s += 2;
  if (brief.projectType === "xay_moi") s += 2; else s += 1;
  const tier = s >= 7 ? "nong" : s >= 4 ? "am" : "nguoi";
  return { score: s, tier };
}

/* ── Hạng KTS suy từ điểm uy tín (đồng bộ nhãn với kts_profile_draft) ── */
const RANK_TIERS = [
  { key: "vip",       label: "VIP",       min: 40 },
  { key: "pro",       label: "PRO",       min: 20 },
  { key: "tieuchuan", label: "Tiêu chuẩn", min: 8 },
  { key: "coban",     label: "Cơ bản",    min: 0 },
];
function rankFromPoints(points) {
  const p = Number(points) || 0;
  for (const t of RANK_TIERS) if (p >= t.min) return t.key;
  return "coban";
}
async function getRepPoints(uid) {
  try {
    const s = await fdb.collection(COL.reputation).doc(uid).get();
    return s.exists ? (Number(s.data().points) || 0) : 0;
  } catch (e) { return 0; }
}
/* Hạng chỉ áp cho KTS; CN/DN/founder → null */
async function safeRank(uid, role) {
  if (role !== "kts") return null;
  return rankFromPoints(await getRepPoints(uid));
}

/* ── Tách từ khóa tiếng Việt (bỏ dấu, bỏ stopword, ≥3 ký tự) để dò câu hỏi tương tự ── */
const VN_STOP = new Set(("cua co la va cho khong nhu the nao nay do gi khi thi mot cac nhung duoc" +
  " minh ban toi anh chi em nha xay dung thiet ke can hoi xin moi voi tren duoi ra vao lam sao bao nhieu").split(/\s+/));
function vnKeywordTokens(text) {
  const norm = vnNormNoMark(text).replace(/[^a-z0-9\s]/g, " ");
  const out = [];
  for (const w of norm.split(/\s+/)) {
    if (w.length >= 3 && !VN_STOP.has(w) && !out.includes(w)) out.push(w);
    if (out.length >= 24) break;
  }
  return out;
}

/* ── Gợi ý KTS đang hoạt động tích cực trong diễn đàn (denormalized từ bài đăng) ── */
const RANK_ORDER = { vip: 3, pro: 2, tieuchuan: 1, coban: 0 };
async function suggestKtsFromForum(excludeUid, limitN) {
  try {
    const snap = await fdb.collection(COL.posts)
      .where("authorRole", "==", "kts")
      .orderBy("createdAt", "desc").limit(80).get();
    const byUid = new Map();
    snap.forEach((doc) => {
      const p = doc.data();
      if (!p.authorUid || p.authorUid === excludeUid) return;
      const cur = byUid.get(p.authorUid) || {
        uid: p.authorUid, name: p.authorName || "KTS ALN",
        rank: p.authorRank || "coban", posts: 0,
      };
      cur.posts += 1;
      if ((RANK_ORDER[p.authorRank] || 0) > (RANK_ORDER[cur.rank] || 0)) cur.rank = p.authorRank;
      byUid.set(p.authorUid, cur);
    });
    return Array.from(byUid.values())
      .sort((a, b) => (RANK_ORDER[b.rank] - RANK_ORDER[a.rank]) || (b.posts - a.posts))
      .slice(0, limitN || 3);
  } catch (e) {
    console.warn("[forum] suggestKts fail:", e.message);
    return [];
  }
}

/* ── Gọi Claude (Anthropic Messages API) — dùng chung cho nháp trả lời & tóm tắt ── */
async function callClaude(apiKey, model, system, userText, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 700,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpsError("internal", "AI lỗi: " + (data.error && data.error.message || res.status));
  return (data.content && data.content[0] && data.content[0].text || "").trim();
}

async function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
  const uid = request.auth.uid;
  const profile = await getProfile(uid);
  if (!profile) throw new HttpsError("permission-denied", "Không tìm thấy hồ sơ người dùng");
  if (!isActive(profile)) throw new HttpsError("permission-denied", "Tài khoản chưa được duyệt — chưa vào được diễn đàn");
  return { uid, profile };
}

/* ════════════════════════════════════════════
   1. ĐĂNG BÀI — forumPostDraft
════════════════════════════════════════════ */
exports.forumPostDraft = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const category = String(d.category || "");
  const text = String(d.text || "").trim();
  const media = Array.isArray(d.media) ? d.media.slice(0, 4) : [];
  const tag = ["arch", "land", "nat"].includes(d.tag) ? d.tag : null;

  if (!CATEGORIES.includes(category)) throw new HttpsError("invalid-argument", "Chuyên mục không hợp lệ");
  const p2 = await getP2Enabled();
  if (!canPostCategory(profile.role, category, p2)) {
    throw new HttpsError("permission-denied", "Dạ, vai trò của anh/chị không đăng được vào chuyên mục này");
  }
  if (!text && media.length === 0) throw new HttpsError("invalid-argument", "Nhập nội dung hoặc chọn ảnh");

  /* Bộ lọc chống lách sàn — áp cho MỌI vai, MỌI chuyên mục */
  const violation = forumFilterViolation(text);
  if (violation) {
    await logBlocked(uid, profile, "post", violation, text);
    throw new HttpsError("failed-precondition", BLOCK_MSG, { reason: violation });
  }
  /* OCR ảnh: bắt SĐT/kênh ngoài dán bằng hình (Cloud Vision) */
  const imgViolation = await ocrMediaViolation(media);
  if (imgViolation) {
    await logBlocked(uid, profile, "post", "image:" + imgViolation, "(ảnh chứa " + imgViolation + ")");
    throw new HttpsError("failed-precondition", BLOCK_MSG, { reason: imgViolation, via: "image" });
  }

  /* Mini-brief bắt buộc với Tư vấn Dự án (CN/DN) */
  let brief = null;
  if (category === "tu_van_du_an" && profile.role !== "founder") {
    const b = d.brief || {};
    if (!["xay_moi", "thiet_ke", "cai_tao"].includes(b.projectType)) throw new HttpsError("invalid-argument", "Chọn loại dự án");
    const area = Number(b.area);
    if (!area || area <= 0 || area > 100000) throw new HttpsError("invalid-argument", "Diện tích không hợp lệ");
    if (!["<1ty", "1-2ty", ">=2ty"].includes(b.budget)) throw new HttpsError("invalid-argument", "Chọn ngân sách");
    if (!["<3thang", "3-6thang", ">6thang"].includes(b.timeline)) throw new HttpsError("invalid-argument", "Chọn thời gian dự kiến");
    const region = String(b.region || "").trim().slice(0, 80);
    if (!region) throw new HttpsError("invalid-argument", "Nhập khu vực (quận/tỉnh)");
    if (b.consent !== true) throw new HttpsError("failed-precondition", "Cần đồng ý xử lý dữ liệu cá nhân (NĐ 13/2023) trước khi đăng");
    const regionViolation = forumFilterViolation(region);
    if (regionViolation) {
      await logBlocked(uid, profile, "post", regionViolation, region);
      throw new HttpsError("failed-precondition", BLOCK_MSG, { reason: regionViolation });
    }
    brief = {
      projectType: b.projectType,
      area,
      region,                       // CHỈ cấp quận/tỉnh — không địa chỉ cụ thể
      budget: b.budget,
      timeline: b.timeline,
      hasLand: b.hasLand === true,
      consentNd13: true,
    };
  }

  /* Tiền kiểm: 3 đóng góp đầu HOẶC người hay bị chặn lách sàn (≥2 lần) → chờ duyệt.
     Người sạch, đã qua 3 bài → đăng thẳng (hậu kiểm). */
  let pending = false;
  if (profile.role !== "founder") {
    const stSnap = await fdb.collection(COL.userState).doc(uid).get();
    const st = stSnap.exists ? stSnap.data() : {};
    const contrib = st.contribCount || 0;
    const blocks = st.blockCount || 0;
    pending = contrib < NEW_ACCOUNT_FREE_AFTER || blocks >= 2;
  }

  const authorRank = await safeRank(uid, profile.role);   // hạng KTS (trust signal)

  const post = {
    authorUid: uid,
    authorName: profile.name || "",
    authorRole: profile.role,
    authorRank,
    authorAvatar: profile.avatarUrl || "",
    category,
    tag,
    text,
    media,
    images: media.filter((m) => m && m.type === "image").map((m) => m.url),
    suggestedKts: [],                 // điền sau khi tạo (thread Tư vấn Dự án)
    aiSummary: null, aiSummaryAt: null,
    heartCount: 0,
    heartedBy: [],
    pinned: false,
    hidden: false,
    status: pending ? "pending" : "visible",   // 'visible' | 'pending' | 'removed'
    commentCount: 0,
    bestAnswerId: null,
    brief,
    createdAt: ts(),
    updatedAt: ts(),
  };

  const postRef = await fdb.collection(COL.posts).add(post);
  await fdb.collection(COL.userState).doc(uid).set({ contribCount: inc(1), updatedAt: ts() }, { merge: true });

  /* Đồng bộ thread Tư vấn Dự án → lead (Speed-to-Lead Loop) */
  if (brief) {
    const { score, tier } = scoreLead(brief);
    const leadRef = await fdb.collection(COL.leads).add({
      name: profile.name || "",
      phone: profile.phone || "",     // lấy từ hồ sơ user — KHÔNG hiển thị trong thread
      projectType: brief.projectType,
      area: brief.area,
      budget: brief.budget,
      hasLand: brief.hasLand,
      timeline: brief.timeline,
      region: brief.region,
      score,
      tier,
      status: "new",
      source: "forum",
      threadId: postRef.id,
      cnUid: uid,
      createdAt: ts(),
    });
    await postRef.update({ leadId: leadRef.id });
    await fdNotify(FOUNDER_UID, "🔥 Lead mới từ diễn đàn (" + tier + ")",
      `${profile.name || "Khách"} — ${brief.projectType}, ${brief.area}m², ${brief.region}`,
      { type: "FORUM_LEAD", postId: postRef.id });

    /* Phễu chốt: gợi ý 3 KTS hoạt động tích cực + báo cho họ có lead phù hợp */
    if (!pending) {
      const kts = await suggestKtsFromForum(uid, 3);
      if (kts.length) {
        await postRef.update({ suggestedKts: kts });
        for (const k of kts) {
          await fdNotify(k.uid, "🤝 Có khách cần tư vấn dự án",
            `${brief.projectType} · ${brief.area}m² · ${brief.region} — mở diễn đàn để nhận lời mời`,
            { type: "FORUM_SUGGESTED", postId: postRef.id });
        }
      }
    }
  }

  if (pending) {
    await fdb.collection(COL.modQueue).doc(postRef.id).set({
      kind: "post", postId: postRef.id, commentId: null,
      authorUid: uid, authorName: profile.name || "", authorRole: profile.role,
      snippet: text.slice(0, 200) || "(ảnh)", category, createdAt: ts(),
    });
    await fdNotify(FOUNDER_UID, "📝 Bài diễn đàn chờ duyệt",
      `${profile.name || uid} (${profile.role}) — ${text.slice(0, 60) || "(ảnh)"}`,
      { type: "FORUM_PENDING_POST", postId: postRef.id });
  }

  return { id: postRef.id, status: post.status };
});

/* ════════════════════════════════════════════
   2. BÌNH LUẬN — forumCommentDraft
════════════════════════════════════════════ */
exports.forumCommentDraft = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const postId = String(d.postId || "");
  const text = String(d.text || "").trim();
  let replyToId = d.replyToId ? String(d.replyToId) : null;
  const aiAssisted = d.aiAssisted === true;   // KTS có dùng trợ lý AI soạn nháp (đã tự xác nhận đọc)

  if (!postId || !text) throw new HttpsError("invalid-argument", "Thiếu nội dung");
  const postRef = fdb.collection(COL.posts).doc(postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
  const post = postSnap.data();
  if (post.status !== "visible") throw new HttpsError("failed-precondition", "Bài viết chưa mở bình luận");

  /* Phân quyền bình luận */
  const p2 = await getP2Enabled();
  if (profile.role === "founder" || profile.role === "kts") {
    // KTS/Founder bình luận mọi chuyên mục
  } else if ((profile.role === "cn" || profile.role === "dn") && p2) {
    if (post.authorUid !== uid) throw new HttpsError("permission-denied", "Dạ, anh/chị chỉ bình luận được trong thread của mình");
  } else {
    throw new HttpsError("permission-denied", "Dạ, vai trò của anh/chị chưa bình luận được trong diễn đàn");
  }

  /* Bộ lọc chống lách sàn */
  const violation = forumFilterViolation(text);
  if (violation) {
    await logBlocked(uid, profile, "comment", violation, text);
    throw new HttpsError("failed-precondition", BLOCK_MSG, { reason: violation });
  }

  /* Trả lời lồng đúng 1 cấp: reply của reply tự phẳng về comment gốc */
  let rootAuthorUid = null;
  if (replyToId) {
    const parentSnap = await postRef.collection("comments").doc(replyToId).get();
    if (!parentSnap.exists) throw new HttpsError("not-found", "Bình luận gốc không tồn tại");
    const parent = parentSnap.data();
    if (parent.replyToId) replyToId = parent.replyToId;
    rootAuthorUid = parent.authorUid;
  }

  /* Tiền kiểm: 3 đóng góp đầu HOẶC hay bị chặn lách sàn (≥2) */
  let pending = false;
  if (profile.role !== "founder") {
    const stSnap = await fdb.collection(COL.userState).doc(uid).get();
    const st = stSnap.exists ? stSnap.data() : {};
    pending = (st.contribCount || 0) < NEW_ACCOUNT_FREE_AFTER || (st.blockCount || 0) >= 2;
  }

  const authorRank = await safeRank(uid, profile.role);

  const comment = {
    authorUid: uid,
    authorName: profile.name || "",
    authorRole: profile.role,
    authorRank,
    authorAvatar: profile.avatarUrl || "",
    text,
    replyToId: replyToId || null,
    aiAssisted,
    isBestAnswer: false,
    flagged: false,
    status: pending ? "pending" : "visible",
    heartCount: 0,
    heartedBy: [],
    createdAt: ts(),
  };

  const cRef = await postRef.collection("comments").add(comment);
  await fdb.collection(COL.userState).doc(uid).set({ contribCount: inc(1), updatedAt: ts() }, { merge: true });

  if (!pending) {
    await postRef.update({ commentCount: inc(1), updatedAt: ts() });

    /* Thông báo gộp 10 phút — cho chủ thớt + người được trả lời */
    const preview = text.length > 60 ? text.slice(0, 60) + "..." : text;
    const notified = new Set([uid]);
    if (post.authorUid && !notified.has(post.authorUid)) {
      notified.add(post.authorUid);
      await fdNotifyBatched(post.authorUid, postId,
        "💬 " + (profile.name || "Ai đó") + " bình luận bài của anh/chị", preview,
        { type: "FORUM_COMMENT", postId });
    }
    if (rootAuthorUid && !notified.has(rootAuthorUid)) {
      notified.add(rootAuthorUid);
      await fdNotifyBatched(rootAuthorUid, postId,
        "↩️ " + (profile.name || "Ai đó") + " trả lời bình luận của anh/chị", preview,
        { type: "FORUM_REPLY", postId });
    }
  } else {
    await fdb.collection(COL.modQueue).doc(postId + "__" + cRef.id).set({
      kind: "comment", postId, commentId: cRef.id,
      authorUid: uid, authorName: profile.name || "", authorRole: profile.role,
      snippet: text.slice(0, 200), category: post.category || null, createdAt: ts(),
    });
    await fdNotify(FOUNDER_UID, "📝 Bình luận chờ duyệt",
      `${profile.name || uid} (${profile.role}) — ${text.slice(0, 60)}`,
      { type: "FORUM_PENDING_COMMENT", postId, commentId: cRef.id });
  }

  return { id: cRef.id, status: comment.status };
});

/* ════════════════════════════════════════════
   3. THẢ TIM — forumHeartDraft (bài hoặc bình luận)
════════════════════════════════════════════ */
exports.forumHeartDraft = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireAuth(request);
  const d = request.data || {};
  const postId = String(d.postId || "");
  const commentId = d.commentId ? String(d.commentId) : null;
  if (!postId) throw new HttpsError("invalid-argument", "Thiếu postId");

  const ref = commentId
    ? fdb.collection(COL.posts).doc(postId).collection("comments").doc(commentId)
    : fdb.collection(COL.posts).doc(postId);

  const result = await fdb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy nội dung");
    const data = snap.data();
    const hearted = Array.isArray(data.heartedBy) && data.heartedBy.includes(uid);
    tx.update(ref, {
      heartedBy: hearted ? FieldValue.arrayRemove(uid) : FieldValue.arrayUnion(uid),
      heartCount: inc(hearted ? -1 : 1),
    });
    return { nowHearted: !hearted, authorUid: data.authorUid, authorRole: data.authorRole };
  });

  /* P2.6 — comment được tim: +1 điểm uy tín cho KTS (không tự tim cho mình) */
  if (commentId && result.authorRole === "kts" && result.authorUid !== uid) {
    await addRep(result.authorUid, "heart", result.nowHearted ? 1 : -1, COL.posts + "/" + postId + "/comments/" + commentId);
  }

  return { hearted: result.nowHearted };
});

/* ════════════════════════════════════════════
   4. BEST ANSWER — forumBestAnswerDraft
════════════════════════════════════════════ */
exports.forumBestAnswerDraft = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const postId = String(d.postId || "");
  const commentId = String(d.commentId || "");
  if (!postId || !commentId) throw new HttpsError("invalid-argument", "Thiếu tham số");

  const postRef = fdb.collection(COL.posts).doc(postId);
  const info = await fdb.runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
    const post = postSnap.data();

    /* CHỈ chủ thớt hoặc Founder — server cưỡng chế, client không tự đánh được */
    if (post.authorUid !== uid && profile.role !== "founder") {
      throw new HttpsError("permission-denied", "Chỉ chủ thớt hoặc Founder đánh dấu được Best Answer");
    }

    const cRef = postRef.collection("comments").doc(commentId);
    const cSnap = await tx.get(cRef);
    if (!cSnap.exists) throw new HttpsError("not-found", "Bình luận không tồn tại");
    const comment = cSnap.data();
    if (comment.authorUid === uid && profile.role !== "founder") {
      throw new HttpsError("permission-denied", "Không thể tự đánh dấu Best Answer cho chính mình");
    }

    let prev = null;
    if (post.bestAnswerId && post.bestAnswerId !== commentId) {
      const prevRef = postRef.collection("comments").doc(post.bestAnswerId);
      const prevSnap = await tx.get(prevRef);
      if (prevSnap.exists) {
        prev = { id: post.bestAnswerId, authorUid: prevSnap.data().authorUid, authorRole: prevSnap.data().authorRole };
        tx.update(prevRef, { isBestAnswer: false });
      }
    }
    tx.update(cRef, { isBestAnswer: true });
    tx.update(postRef, { bestAnswerId: commentId, updatedAt: ts() });
    return { prev, authorUid: comment.authorUid, authorRole: comment.authorRole };
  });

  /* P2.6 — Best Answer +5 (server cộng), gỡ điểm người bị thay thế */
  if (info.prev && info.prev.authorRole === "kts") {
    await addRep(info.prev.authorUid, "bestAnswer", -1, COL.posts + "/" + postId);
  }
  if (info.authorRole === "kts") {
    await addRep(info.authorUid, "bestAnswer", 1, COL.posts + "/" + postId + "/comments/" + commentId);
  }
  await fdNotify(info.authorUid, "🏆 Câu trả lời của anh/chị được chọn Best Answer",
    "Chủ thớt đã đánh dấu câu trả lời hay nhất — +5 điểm uy tín",
    { type: "FORUM_BEST_ANSWER", postId, commentId });

  return { ok: true };
});

/* ════════════════════════════════════════════
   5. BÁO CÁO VI PHẠM — forumReportDraft
════════════════════════════════════════════ */
exports.forumReportDraft = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const targetType = d.targetType === "comment" ? "comment" : "post";
  const postId = String(d.postId || "");
  const commentId = targetType === "comment" ? String(d.commentId || "") : null;
  const reason = ["lach_san", "spam", "xau", "khac"].includes(d.reason) ? d.reason : "khac";
  if (!postId || (targetType === "comment" && !commentId)) throw new HttpsError("invalid-argument", "Thiếu tham số");

  const targetRef = targetType === "comment"
    ? fdb.collection(COL.posts).doc(postId).collection("comments").doc(commentId)
    : fdb.collection(COL.posts).doc(postId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError("not-found", "Nội dung không tồn tại");
  const target = targetSnap.data();

  const repRef = await fdb.collection(COL.reports).add({
    reporterUid: uid,
    reporterName: profile.name || "",
    targetType,
    targetPath: targetRef.path,
    postId,
    commentId: commentId || null,
    targetAuthorUid: target.authorUid || "",
    targetAuthorName: target.authorName || "",
    targetSnippet: String(target.text || "").slice(0, 200),
    reason,
    note: String(d.note || "").slice(0, 300),
    status: "new",                 // 'new' | 'resolved'
    resolution: null,
    createdAt: ts(),
  });

  if (targetType === "comment") await targetRef.update({ flagged: true });

  await fdNotify(FOUNDER_UID, "🚩 Báo cáo diễn đàn mới",
    `${profile.name || uid} báo cáo 1 ${targetType === "comment" ? "bình luận" : "bài viết"} (${reason})`,
    { type: "FORUM_REPORT", reportId: repRef.id });

  return { id: repRef.id };
});

/* ════════════════════════════════════════════
   6. MỜI KTS TƯ VẤN — forumInviteDraft (điểm chốt phễu)
════════════════════════════════════════════ */
exports.forumInviteDraft = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const ktsUid = String(d.ktsUid || "");
  const threadId = d.threadId ? String(d.threadId) : null;
  if (!ktsUid) throw new HttpsError("invalid-argument", "Thiếu ktsUid");

  const p2 = await getP2Enabled();
  if (!(profile.role === "founder" || ((profile.role === "cn" || profile.role === "dn") && p2))) {
    throw new HttpsError("permission-denied", "Chỉ Chủ nhà / Doanh nghiệp (khi P2 mở) mời được KTS");
  }

  const ktsProfile = await getProfile(ktsUid);
  if (!ktsProfile || ktsProfile.role !== "kts") throw new HttpsError("not-found", "Không tìm thấy KTS");

  /* Chống trùng: đã có invite đang mở giữa 2 người thì trả lại invite cũ */
  const dup = await fdb.collection(COL.invites)
    .where("cnUid", "==", uid).where("ktsUid", "==", ktsUid)
    .where("status", "in", ["new", "quoted"]).limit(1).get();
  if (!dup.empty) return { id: dup.docs[0].id, existing: true };

  const invRef = await fdb.collection(COL.invites).add({
    cnUid: uid,
    cnName: profile.name || "",
    cnRole: profile.role,
    ktsUid,
    ktsName: ktsProfile.name || "",
    threadId,
    status: "new",                 // new → quoted → contracted → won/lost
    createdAt: ts(),
    updatedAt: ts(),
  });

  await fdNotify(ktsUid, "🤝 Anh/chị được mời tư vấn dự án",
    `${profile.name || "Khách"} vừa mời anh/chị tư vấn qua diễn đàn — mở kênh chat sàn để trao đổi`,
    { type: "FORUM_INVITE", inviteId: invRef.id });
  await fdNotify(FOUNDER_UID, "📈 Invite mới trong phễu diễn đàn",
    `${profile.name || uid} mời ${ktsProfile.name || ktsUid}`,
    { type: "FORUM_INVITE_ADMIN", inviteId: invRef.id });

  return { id: invRef.id, existing: false };
});

/* ════════════════════════════════════════════
   7. XÓA (mềm) — forumDeleteDraft (tác giả hoặc Founder)
════════════════════════════════════════════ */
exports.forumDeleteDraft = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const postId = String(d.postId || "");
  const commentId = d.commentId ? String(d.commentId) : null;
  if (!postId) throw new HttpsError("invalid-argument", "Thiếu postId");

  const postRef = fdb.collection(COL.posts).doc(postId);
  if (commentId) {
    const cRef = postRef.collection("comments").doc(commentId);
    const cSnap = await cRef.get();
    if (!cSnap.exists) throw new HttpsError("not-found", "Bình luận không tồn tại");
    const c = cSnap.data();
    if (c.authorUid !== uid && profile.role !== "founder") throw new HttpsError("permission-denied", "Không có quyền xóa");
    const wasVisible = c.status === "visible";
    await cRef.update({ status: "removed" });
    if (wasVisible) await postRef.update({ commentCount: inc(-1) });
  } else {
    const pSnap = await postRef.get();
    if (!pSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
    const p = pSnap.data();
    if (p.authorUid !== uid && profile.role !== "founder") throw new HttpsError("permission-denied", "Không có quyền xóa");
    await postRef.update({ status: "removed", updatedAt: ts() });
  }
  return { ok: true };
});

/* ════════════════════════════════════════════
   8. QUẢN TRỊ FOUNDER — forumAdminDraft (gồm seed)
════════════════════════════════════════════ */
exports.forumAdminDraft = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
  const uid = request.auth.uid;
  const profile = await getProfile(uid);
  if (!profile || profile.role !== "founder") throw new HttpsError("permission-denied", "Chỉ Founder");

  const d = request.data || {};
  const action = String(d.action || "");
  const postRef = d.postId ? fdb.collection(COL.posts).doc(String(d.postId)) : null;

  switch (action) {

    case "toggleP2": {
      await fdb.collection(COL.config).doc("flags").set({
        FORUM_P2_ENABLED: d.enabled === true,
        updatedAt: ts(),
        updatedBy: uid,
      }, { merge: true });
      return { ok: true, FORUM_P2_ENABLED: d.enabled === true };
    }

    case "approve": {
      if (!postRef) throw new HttpsError("invalid-argument", "Thiếu postId");
      if (d.commentId) {
        const cRef = postRef.collection("comments").doc(String(d.commentId));
        const cSnap = await cRef.get();
        if (!cSnap.exists) throw new HttpsError("not-found", "Bình luận không tồn tại");
        if (cSnap.data().status === "pending") {
          await cRef.update({ status: "visible" });
          await postRef.update({ commentCount: inc(1), updatedAt: ts() });
          await fdNotify(cSnap.data().authorUid, "✅ Bình luận của anh/chị đã được duyệt", "Bình luận đã hiển thị trên diễn đàn", { type: "FORUM_APPROVED", postId: d.postId });
        }
        await fdb.collection(COL.modQueue).doc(String(d.postId) + "__" + String(d.commentId)).delete();
      } else {
        const pSnap = await postRef.get();
        if (!pSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
        if (pSnap.data().status === "pending") {
          await postRef.update({ status: "visible", updatedAt: ts() });
          await fdNotify(pSnap.data().authorUid, "✅ Bài của anh/chị đã được duyệt", "Bài đã hiển thị trên diễn đàn", { type: "FORUM_APPROVED", postId: d.postId });
        }
        await fdb.collection(COL.modQueue).doc(String(d.postId)).delete();
      }
      return { ok: true };
    }

    case "remove": {
      if (!postRef) throw new HttpsError("invalid-argument", "Thiếu postId");
      if (d.commentId) {
        const cRef = postRef.collection("comments").doc(String(d.commentId));
        const cSnap = await cRef.get();
        if (cSnap.exists && cSnap.data().status === "visible") await postRef.update({ commentCount: inc(-1) });
        await cRef.update({ status: "removed" });
        await fdb.collection(COL.modQueue).doc(String(d.postId) + "__" + String(d.commentId)).delete();
      } else {
        await postRef.update({ status: "removed", updatedAt: ts() });
        await fdb.collection(COL.modQueue).doc(String(d.postId)).delete();
      }
      return { ok: true };
    }

    case "resolveReport": {
      const repId = String(d.reportId || "");
      if (!repId) throw new HttpsError("invalid-argument", "Thiếu reportId");
      await fdb.collection(COL.reports).doc(repId).update({
        status: "resolved",
        resolution: ["removed", "ignored"].includes(d.resolution) ? d.resolution : "ignored",
        resolvedAt: ts(),
        resolvedBy: uid,
      });
      return { ok: true };
    }

    case "setInviteStatus": {
      const invId = String(d.inviteId || "");
      const status = String(d.status || "");
      if (!invId || !["new", "quoted", "contracted", "won", "lost"].includes(status)) {
        throw new HttpsError("invalid-argument", "Trạng thái invite không hợp lệ");
      }
      await fdb.collection(COL.invites).doc(invId).update({ status, updatedAt: ts() });
      return { ok: true };
    }

    case "togglePin": {
      if (!postRef) throw new HttpsError("invalid-argument", "Thiếu postId");
      const pSnap = await postRef.get();
      if (!pSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
      const p = pSnap.data();
      const nowPinned = !p.pinned;
      const update = { pinned: nowPinned, updatedAt: ts() };
      /* P2.6 — Showcase được Founder ghim: +3 (chỉ thưởng 1 lần) */
      if (nowPinned && p.category === "showcase" && p.authorRole === "kts" && !p.pinRewarded) {
        update.pinRewarded = true;
        await addRep(p.authorUid, "pin", 1, COL.posts + "/" + d.postId);
      }
      await postRef.update(update);
      return { ok: true, pinned: nowPinned };
    }

    case "toggleHidden": {
      if (!postRef) throw new HttpsError("invalid-argument", "Thiếu postId");
      const pSnap = await postRef.get();
      if (!pSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
      await postRef.update({ hidden: !pSnap.data().hidden });
      return { ok: true };
    }

    case "rewardFirstAnswer": {
      /* P2.6 — câu trả lời ĐẦU TIÊN trong thread tu_van_du_an đạt chất lượng: x2 điểm (bonus +5) */
      if (!postRef || !d.commentId) throw new HttpsError("invalid-argument", "Thiếu tham số");
      const pSnap = await postRef.get();
      if (!pSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
      const p = pSnap.data();
      if (p.category !== "tu_van_du_an") throw new HttpsError("failed-precondition", "Chỉ áp dụng cho thread Tư vấn Dự án");
      if (p.firstAnswerRewarded) throw new HttpsError("failed-precondition", "Thread này đã thưởng câu trả lời đầu tiên");
      const cSnap = await postRef.collection("comments").doc(String(d.commentId)).get();
      if (!cSnap.exists || cSnap.data().authorRole !== "kts") throw new HttpsError("failed-precondition", "Bình luận không hợp lệ");
      await postRef.update({ firstAnswerRewarded: true });
      await addRep(cSnap.data().authorUid, "firstAnswer", 1, COL.posts + "/" + d.postId + "/comments/" + d.commentId);
      await fdNotify(cSnap.data().authorUid, "⭐ Câu trả lời đầu tiên đạt chất lượng",
        "Founder xác nhận — anh/chị nhận thêm điểm uy tín x2", { type: "FORUM_FIRST_ANSWER", postId: d.postId });
      return { ok: true };
    }

    case "seed":
      return await seedDraftData();

    default:
      throw new HttpsError("invalid-argument", "Hành động không hợp lệ: " + action);
  }
});

/* ════════════════════════════════════════════
   SEED DỮ LIỆU MẪU — idempotent (set theo id cố định)
════════════════════════════════════════════ */
async function seedDraftData() {
  const KTS_UID = "kw5TgVDggIfboEqERS1cAphn3263";   // kts.tranlong
  const CN_UID = "G4RhRH5ECMYcE9aFcKYVn5Wdy952";    // cn.trannam
  const DN_UID = "aTyHR3oQw6P87xpA9p8hTr2NbGA2";    // dn.tkhouse

  const [ktsP, cnP] = await Promise.all([getProfile(KTS_UID), getProfile(CN_UID)]);
  const KTS_NAME = (ktsP && ktsP.name) || "KTS. Trần Đại Long";
  const CN_NAME = (cnP && cnP.name) || "Trần Nam";
  const FOUNDER_NAME = "KTS. Trần Đại Long";

  const now = Date.now();
  const T = (hoursAgo) => Timestamp.fromMillis(now - hoursAgo * 3600 * 1000);
  const img = (seed) => ({ url: "https://picsum.photos/seed/" + seed + "/900/640", type: "image" });

  const base = {
    heartCount: 0, heartedBy: [], pinned: false, hidden: false,
    status: "visible", commentCount: 0, bestAnswerId: null, brief: null, tag: null,
    authorAvatar: "", authorRank: null, suggestedKts: [], aiSummary: null, aiSummaryAt: null,
  };
  const ktsAuthor = { authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts", authorRank: "pro" };
  const cnAuthor = { authorUid: CN_UID, authorName: CN_NAME, authorRole: "cn" };
  const founderAuthor = { authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder" };

  const posts = fdb.collection(COL.posts);
  const batch1 = fdb.batch();

  /* P1 — Hỏi đáp kỹ thuật (có Best Answer) */
  batch1.set(posts.doc("draft_p01"), Object.assign({}, base, ktsAuthor, {
    category: "hoi_dap",
    text: "Nhà phố 5 tầng + tum, diện tích sàn 400m² — bậc chịu lửa yêu cầu theo QCVN 06:2022 là bao nhiêu? Có bắt buộc thang thoát hiểm riêng không khi mặt tiền chỉ 4m? Anh em nào vừa làm hồ sơ PCCC loại này chia sẻ giúp.",
    media: [], images: [],
    heartCount: 2, heartedBy: [FOUNDER_UID, CN_UID],
    commentCount: 3, bestAnswerId: "draft_c02",
    createdAt: T(50), updatedAt: T(20),
  }));
  batch1.set(posts.doc("draft_p01").collection("comments").doc("draft_c01"), {
    authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder", authorAvatar: "",
    text: "Câu này nhiều KTS mới hay vướng — mời anh em có kinh nghiệm hồ sơ PCCC vào chia sẻ.",
    replyToId: null, isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 0, heartedBy: [], createdAt: T(48),
  });
  batch1.set(posts.doc("draft_p01").collection("comments").doc("draft_c02"), {
    authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts", authorRank: "pro", authorAvatar: "",
    text: "Nhà ở riêng lẻ ≤7 tầng và <5.000m² sàn thì thuộc diện thẩm duyệt đơn giản. Với 5 tầng + tum, bậc chịu lửa tối thiểu bậc III; thang bộ hở trong nhà được chấp nhận nếu có lối lên mái + thang V3 ngoài ban công từ tầng 3. Mặt tiền 4m vẫn bố trí được, quan trọng là chiều rộng vế thang ≥0,9m.",
    replyToId: null, isBestAnswer: true, flagged: false, status: "visible",
    heartCount: 3, heartedBy: [FOUNDER_UID, CN_UID, DN_UID], createdAt: T(46),
  });
  batch1.set(posts.doc("draft_p01").collection("comments").doc("draft_c03"), {
    authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder", authorAvatar: "",
    text: "Chuẩn — lưu ý thêm bản vẽ mặt cắt thể hiện rõ lối lên mái, quận hay soi chi tiết này.",
    replyToId: "draft_c02", isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 1, heartedBy: [KTS_UID], createdAt: T(44),
  });

  batch1.set(posts.doc("draft_p02"), Object.assign({}, base, ktsAuthor, {
    category: "hoi_dap",
    text: "Đơn giá phần thô 4,5tr/m² hiện nay thường đã gồm ép cọc chưa, hay tách riêng? Khách hỏi mà mỗi nhà thầu báo một kiểu, muốn nghe mặt bằng chung anh em đang áp.",
    media: [], images: [],
    commentCount: 1, createdAt: T(30), updatedAt: T(28),
  }));
  batch1.set(posts.doc("draft_p02").collection("comments").doc("draft_c04"), {
    authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder", authorAvatar: "",
    text: "Mặt bằng chung là CHƯA gồm ép cọc — cọc tính theo khối lượng thực tế vì địa chất mỗi nơi mỗi khác. Báo khách nên tách hạng mục cọc + thí nghiệm để minh bạch.",
    replyToId: null, isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 2, heartedBy: [KTS_UID, DN_UID], createdAt: T(28),
  });

  /* P1 — Vật liệu & Giá */
  batch1.set(posts.doc("draft_p03"), Object.assign({}, base, ktsAuthor, {
    category: "vat_lieu",
    text: "Cập nhật giá gạch không nung khu vực Bình Dương tháng 7/2026: gạch block 390x190x190 dao động 12.5k–13.8k/viên tại bãi, tăng nhẹ ~4% so với quý trước. Anh em khu vực khác cập nhật giúp để có mặt bằng chung.",
    media: [img("alnvl1")], images: ["https://picsum.photos/seed/alnvl1/900/640"],
    heartCount: 1, heartedBy: [FOUNDER_UID],
    commentCount: 1, createdAt: T(26), updatedAt: T(24),
  }));
  batch1.set(posts.doc("draft_p03").collection("comments").doc("draft_c05"), {
    authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder", authorAvatar: "",
    text: "Khu Đồng Nai đang thấy 13k–14.2k/viên, chênh chủ yếu do phí vận chuyển. Cảm ơn anh cập nhật.",
    replyToId: null, isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 0, heartedBy: [], createdAt: T(24),
  });

  batch1.set(posts.doc("draft_p04"), Object.assign({}, base, ktsAuthor, {
    category: "vat_lieu",
    text: "So sánh nhanh 3 dòng sơn ngoại thất phổ thông sau 2 năm thi công thực tế: độ phai màu hướng Tây khác biệt rõ. Kết luận cá nhân: khu vực nắng gắt nên tư vấn khách lên dòng cao cấp hơn 1 bậc, chênh chi phí ~8% nhưng tuổi thọ màng sơn gần gấp rưỡi.",
    media: [], images: [],
    commentCount: 0, createdAt: T(22), updatedAt: T(22),
  }));

  /* P1 — Showcase (1 bài được ghim) */
  batch1.set(posts.doc("draft_p05"), Object.assign({}, base, ktsAuthor, {
    category: "showcase",
    text: "Biệt thự vườn Tân Cổ Điển tại Thủ Đức vừa hoàn thiện phần thô — nhịp cột đôi sảnh chính và vòm cong tầng 2 là hai chi tiết mất nhiều công nhất. Cảm ơn đội thi công đã theo sát bản vẽ từng cm.",
    media: [img("alnsc1"), img("alnsc2")],
    images: ["https://picsum.photos/seed/alnsc1/900/640", "https://picsum.photos/seed/alnsc2/900/640"],
    pinned: true, pinRewarded: true,
    heartCount: 4, heartedBy: [FOUNDER_UID, CN_UID, DN_UID, "seed_x"],
    commentCount: 0, createdAt: T(70), updatedAt: T(70),
  }));
  batch1.set(posts.doc("draft_p06"), Object.assign({}, base, ktsAuthor, {
    category: "showcase",
    text: "Góc cầu thang giếng trời nhà phố 4x16m — ánh sáng tự nhiên đủ cho cả 3 tầng giữa, không cần đèn ban ngày. Giải pháp lam gỗ chắn nắng hướng Tây hoạt động tốt hơn kỳ vọng.",
    media: [img("alnsc3")], images: ["https://picsum.photos/seed/alnsc3/900/640"],
    heartCount: 2, heartedBy: [FOUNDER_UID, CN_UID],
    commentCount: 0, createdAt: T(18), updatedAt: T(18),
  }));

  /* P1 — Nghề & Chứng chỉ */
  batch1.set(posts.doc("draft_p07"), Object.assign({}, base, ktsAuthor, {
    category: "nghe",
    text: "Lộ trình thi CCHN kiến trúc hạng II năm nay có thay đổi: sát hạch trực tuyến trước, phỏng vấn sau. Anh em chuẩn bị hồ sơ năng lực nhớ kèm xác nhận tham gia tối thiểu 2 công trình đã nghiệm thu.",
    media: [], images: [],
    commentCount: 1, createdAt: T(15), updatedAt: T(14),
  }));
  batch1.set(posts.doc("draft_p07").collection("comments").doc("draft_c06"), {
    authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder", authorAvatar: "",
    text: "Bổ sung: các dự án làm qua sàn ALN đều xuất được xác nhận tham gia công trình — anh em cần thì nhắn Founder.",
    replyToId: null, isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 1, heartedBy: [KTS_UID], createdAt: T(14),
  });

  /* P1 — Bảng tin ALN (chỉ Founder đăng) */
  batch1.set(posts.doc("draft_p08"), Object.assign({}, base, founderAuthor, {
    category: "bang_tin",
    text: "📌 DIỄN ĐÀN ALN phiên bản mới: bình luận theo luồng, Best Answer, chuyên mục riêng cho KTS. Quy tắc duy nhất — mọi trao đổi dự án thực hiện qua kênh chat sàn ALN để được bảo vệ bởi Quy trình 4 bước. Nhận tiền ngoài sàn = khóa tài khoản vĩnh viễn + thu hồi Quỹ bảo đảm.",
    media: [], images: [],
    pinned: true,
    heartCount: 3, heartedBy: [KTS_UID, CN_UID, DN_UID],
    commentCount: 0, createdAt: T(72), updatedAt: T(72),
  }));

  /* P2 — Thread Tư vấn Dự án (CN đăng, KTS trả lời, có invite + lead) */
  batch1.set(posts.doc("draft_p09"), Object.assign({}, base, cnAuthor, {
    category: "tu_van_du_an",
    text: "Gia đình em có lô đất 6x20m ở TP. Thủ Đức, muốn xây nhà 3 tầng cho 2 thế hệ ở chung (ông bà + vợ chồng con nhỏ). Ưu tiên thông thoáng, có sân trước để xe. Nhờ các anh KTS tư vấn hướng bố trí công năng ạ.",
    media: [], images: [],
    brief: {
      projectType: "xay_moi", area: 120, region: "TP. Thủ Đức, TP.HCM",
      budget: "1-2ty", timeline: "3-6thang", hasLand: true, consentNd13: true,
    },
    leadId: "draft_lead01",
    suggestedKts: [{ uid: KTS_UID, name: KTS_NAME, rank: "pro" }],
    commentCount: 2, createdAt: T(10), updatedAt: T(6),
    firstAnswerRewarded: true,
  }));
  batch1.set(posts.doc("draft_p09").collection("comments").doc("draft_c07"), {
    authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts", authorRank: "pro", authorAvatar: "",
    text: "Với 6x20m và nhu cầu 2 thế hệ, anh gợi ý phòng ông bà đặt tầng trệt phía sau (gần WC chung, tránh leo thang), khối bếp + ăn thông sân sau lấy gió. Tầng 2 là 2 phòng ngủ + sinh hoạt chung, tầng 3 phòng thờ + sân phơi. Chừa sân trước 4m là đậu được ô tô 7 chỗ.",
    replyToId: null, isBestAnswer: true, flagged: false, status: "visible",
    heartCount: 2, heartedBy: [CN_UID, FOUNDER_UID], createdAt: T(9),
  });
  batch1.set(posts.doc("draft_p09").collection("comments").doc("draft_c08"), {
    authorUid: CN_UID, authorName: CN_NAME, authorRole: "cn", authorAvatar: "",
    text: "Cảm ơn anh, phương án phòng ông bà tầng trệt đúng ý gia đình em. Em muốn trao đổi sâu hơn về dự toán ạ.",
    replyToId: "draft_c07", isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 0, heartedBy: [], createdAt: T(6),
  });
  // đồng bộ bestAnswerId cho p09
  batch1.update(posts.doc("draft_p09"), { bestAnswerId: "draft_c07" });

  /* Bài CŨ không có category — hiển thị như showcase (demo migration) */
  const p10 = Object.assign({}, base, ktsAuthor, {
    tag: "arch",
    text: "(Bài dạng CŨ — chỉ có tag, chưa có category — để kiểm tra migration hiển thị như Showcase) Hoàng hôn trên công trình mái dốc hôm nay.",
    media: [img("alnold1")], images: ["https://picsum.photos/seed/alnold1/900/640"],
    heartCount: 1, heartedBy: [FOUNDER_UID],
    commentCount: 0, createdAt: T(200), updatedAt: T(200),
  });
  batch1.set(posts.doc("draft_p10"), p10);

  /* Bài CHỜ DUYỆT — demo hàng chờ moderation */
  batch1.set(posts.doc("draft_p11"), Object.assign({}, base, ktsAuthor, {
    category: "hoi_dap",
    text: "(Demo bài chờ duyệt của tài khoản mới) Xin kinh nghiệm chống thấm sân thượng lát gạch — nên màng khò hay gốc xi măng 2 thành phần?",
    media: [], images: [],
    status: "pending",
    commentCount: 0, createdAt: T(2), updatedAt: T(2),
  }));
  batch1.set(fdb.collection(COL.modQueue).doc("draft_p11"), {
    kind: "post", postId: "draft_p11", commentId: null,
    authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts",
    snippet: "(Demo bài chờ duyệt của tài khoản mới) Xin kinh nghiệm chống thấm sân thượng lát gạch...",
    category: "hoi_dap", createdAt: T(2),
  });

  await batch1.commit();

  /* p10: đảm bảo KHÔNG có field category (đúng dạng bài cũ, kể cả khi seed lại) */
  await posts.doc("draft_p10").update({ category: FieldValue.delete() });

  const batch2 = fdb.batch();

  /* Lead từ thread p09 — theo schema MARKETING.md, source: forum */
  batch2.set(fdb.collection(COL.leads).doc("draft_lead01"), {
    name: CN_NAME,
    phone: (cnP && cnP.phone) || "",
    projectType: "xay_moi", area: 120, budget: "1-2ty",
    hasLand: true, timeline: "3-6thang", region: "TP. Thủ Đức, TP.HCM",
    score: 9, tier: "nong", status: "new", source: "forum",
    threadId: "draft_p09", cnUid: CN_UID, createdAt: T(10),
  });

  /* Invite mẫu — CN mời KTS từ thread p09, đang ở bước quoted */
  batch2.set(fdb.collection(COL.invites).doc("draft_inv01"), {
    cnUid: CN_UID, cnName: CN_NAME, cnRole: "cn",
    ktsUid: KTS_UID, ktsName: KTS_NAME,
    threadId: "draft_p09", status: "quoted",
    createdAt: T(6), updatedAt: T(3),
  });

  /* Báo cáo mẫu — chờ xử lý */
  batch2.set(fdb.collection(COL.reports).doc("draft_rep01"), {
    reporterUid: KTS_UID, reporterName: KTS_NAME,
    targetType: "comment",
    targetPath: COL.posts + "/draft_p02/comments/draft_c04",
    postId: "draft_p02", commentId: "draft_c04",
    targetAuthorUid: FOUNDER_UID, targetAuthorName: FOUNDER_NAME,
    targetSnippet: "Mặt bằng chung là CHƯA gồm ép cọc — cọc tính theo khối lượng thực tế...",
    reason: "khac", note: "(Báo cáo DEMO để kiểm tra luồng xử lý)",
    status: "new", resolution: null, createdAt: T(5),
  });

  /* Nhật ký chặn lách sàn mẫu */
  batch2.set(fdb.collection(COL.modLogs).doc("draft_mod01"), {
    uid: DN_UID, name: "Công ty TK House", role: "dn",
    kind: "comment", reason: "phone",
    snippet: "(DEMO) Liên hệ mình qua 09xx xxx xxx để báo giá nhanh nhé",
    createdAt: T(4),
  });

  /* Điểm uy tín KTS mẫu: BestAnswer(p01) 5 + BestAnswer(p09) 5 + FirstAnswer(p09) 5 + Pin(p05) 3 + 5 tim comment = 23 */
  batch2.set(fdb.collection(COL.reputation).doc(KTS_UID), {
    points: 23,
    counts: { bestAnswer: 2, heart: 5, pin: 1, firstAnswer: 1 },
    projectsDone: 3,
    region: "TP.HCM & Đông Nam Bộ",
    updatedAt: ts(),
  });

  /* Trạng thái đóng góp — KTS/CN đã qua tiền kiểm, demo mượt */
  batch2.set(fdb.collection(COL.userState).doc(KTS_UID), { contribCount: 9, updatedAt: ts() });
  batch2.set(fdb.collection(COL.userState).doc(CN_UID), { contribCount: 3, updatedAt: ts() });

  await batch2.commit();

  /* Cờ P2 — chỉ đặt mặc định nếu chưa có (không ghi đè công tắc Founder đang thử) */
  const flagSnap = await fdb.collection(COL.config).doc("flags").get();
  if (!flagSnap.exists) {
    await fdb.collection(COL.config).doc("flags").set({ FORUM_P2_ENABLED: false, updatedAt: ts() });
  }

  return { ok: true, posts: 11, note: "Seed idempotent — chạy lại sẽ ghi đè đúng các doc draft_*" };
}

/* ════════════════════════════════════════════
   9. DIỄN ĐÀN THÔNG MINH (P3 nháp)
   Nguyên tắc: AI chỉ tạo NHÁP/tóm tắt — người thật xác nhận;
   chỉ Best Answer (đã kiểm chứng) mới được đề cao / đưa Cẩm nang.
════════════════════════════════════════════ */

/* 9.1 — Chống trùng: tìm câu hỏi tương tự đã có (ưu tiên bài có Best Answer) */
exports.forumSimilarDraft = onCall({ region: REGION }, async (request) => {
  const { profile } = await requireAuth(request);
  const d = request.data || {};
  const tokens = vnKeywordTokens(String(d.text || ""));
  if (tokens.length < 2) return { items: [] };
  const p2 = await getP2Enabled();
  const cats = viewableCategories(profile.role, p2);
  if (!cats.length) return { items: [] };
  const snap = await fdb.collection(COL.posts).orderBy("createdAt", "desc").limit(120).get();
  const scored = [];
  snap.forEach((doc) => {
    const p = doc.data();
    if (p.status !== "visible" || !cats.includes(p.category)) return;
    const hay = vnNormNoMark(p.text || "");
    let overlap = 0;
    for (const t of tokens) if (hay.includes(t)) overlap++;
    if (overlap >= 2) scored.push({
      id: doc.id, overlap, hasBest: !!p.bestAnswerId,
      title: (p.text || "").slice(0, 90), category: p.category, commentCount: p.commentCount || 0,
    });
  });
  scored.sort((a, b) => (b.hasBest - a.hasBest) || (b.overlap - a.overlap) || (b.commentCount - a.commentCount));
  return { items: scored.slice(0, 3) };
});

/* 9.2 — Trợ lý AI soạn NHÁP câu trả lời cho KTS (KTS tự kiểm chứng & gửi) */
exports.forumAiDraftAnswer = onCall({ region: REGION, secrets: [ANTHROPIC_KEY] }, async (request) => {
  const { profile } = await requireAuth(request);
  if (profile.role !== "kts" && profile.role !== "founder")
    throw new HttpsError("permission-denied", "Chỉ KTS/Founder dùng trợ lý soạn nháp");
  const postId = String((request.data || {}).postId || "");
  const replyToId = (request.data || {}).replyToId ? String((request.data).replyToId) : null;
  const postRef = fdb.collection(COL.posts).doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Bài không tồn tại");
  const p = snap.data();

  /* Đọc luồng bình luận để AI bám ĐÚNG ngữ cảnh (nhất là câu đang được trả lời) */
  const cs = await postRef.collection("comments").orderBy("createdAt", "asc").limit(30).get();
  let convo = "";
  let replyingTo = null;
  cs.forEach((c) => {
    const x = c.data();
    if (x.status !== "visible") return;
    convo += "- " + (x.authorName || "") + " (" + (x.authorRole || "") + ")"
      + (x.isBestAnswer ? " [Best Answer]" : "") + ": " + (x.text || "") + "\n";
    if (replyToId && c.id === replyToId) replyingTo = x;
  });

  let userMsg = "BÀI GỐC (" + (p.authorRole || "") + "):\n" + (p.text || "") + "\n";
  if (convo) userMsg += "\nCÁC BÌNH LUẬN ĐÃ CÓ:\n" + convo;
  if (replyingTo) {
    userMsg += "\n>>> KTS ĐANG TRẢ LỜI TRỰC TIẾP bình luận này của "
      + (replyingTo.authorName || "") + ":\n\"" + (replyingTo.text || "") + "\"\n"
      + "Hãy soạn nháp trả lời ĐÚNG điều họ vừa hỏi ở bình luận này (không lặp lại câu hỏi gốc nếu đã được trả lời).";
  } else {
    userMsg += "\nHãy soạn nháp trả lời cho nội dung MỚI NHẤT đang cần chuyên gia (nếu câu hỏi gốc đã có Best Answer thì trả lời phần đang thảo luận tiếp).";
  }

  const system =
    "Bạn viết giúp một KIẾN TRÚC SƯ Việt Nam bản nháp trả lời trên diễn đàn, để chính KTS đó đọc lại rồi gửi. " +
    "Viết như KTS đang NHẮN TIN trò chuyện tự nhiên với đồng nghiệp/khách: giọng thân thiện, xưng 'mình', gọn gàng, đi thẳng vào ý — như người thật nói, KHÔNG phải văn bản hành chính. " +
    "TUYỆT ĐỐI KHÔNG dùng ký hiệu markdown: không dùng **, ##, ###, gạch ngang bảng, hay tiêu đề in đậm. Viết văn xuôi tự nhiên; nếu cần liệt kê thì tối đa vài gạch đầu dòng bằng dấu '-' ngắn gọn, đừng lạm dụng. " +
    "Độ dài vừa phải (khoảng 4–8 câu), không dàn trải. " +
    "Bám ĐÚNG điều đang được hỏi trong ngữ cảnh luồng (đọc kỹ bình luận mới nhất / câu đang được trả lời) — KHÔNG trả lời lạc sang câu hỏi cũ đã xong. " +
    "Đúng chuyên môn xây dựng/kiến trúc VN. Khi thật sự liên quan mới nhắc TCVN/QCVN, CHỈ ghi mã số nếu chắc chắn, TUYỆT ĐỐI không bịa số hiệu; chỗ nào không chắc thì nói tự nhiên kiểu 'cái này bạn kiểm tra lại theo...'. " +
    "Nếu người ta hỏi về DỰ TOÁN / báo giá / chi phí: nói chuyện tự nhiên về vài đầu mục chính rồi rủ họ trao đổi chi tiết qua nút 'Mời KTS tư vấn' / kênh chat trên sàn ALN cho chuẩn và được bảo vệ — KHÔNG báo giá chi tiết hay mặc cả tiền công khai trên diễn đàn. " +
    "Không ghi số điện thoại, email, link ngoài, zalo. " +
    "KHÔNG tự thêm dòng cảnh báo/disclaimer nào ở cuối — hệ thống tự lo phần đó.";
  const draft = await callClaude(ANTHROPIC_KEY.value(), "claude-sonnet-4-6", system, userMsg, 700);
  return { draft };
});

/* 9.3 — Tóm tắt AI (TL;DR) thread dài, CACHE để tiết kiệm chi phí */
exports.forumSummarizeDraft = onCall({ region: REGION, secrets: [ANTHROPIC_KEY] }, async (request) => {
  await requireAuth(request);
  const postId = String((request.data || {}).postId || "");
  const postRef = fdb.collection(COL.posts).doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Bài không tồn tại");
  const p = snap.data();
  const sMs = p.aiSummaryAt && p.aiSummaryAt.toMillis ? p.aiSummaryAt.toMillis() : 0;
  const uMs = p.updatedAt && p.updatedAt.toMillis ? p.updatedAt.toMillis() : 0;
  if (p.aiSummary && sMs >= uMs) return { summary: p.aiSummary, cached: true };
  const cs = await postRef.collection("comments").orderBy("createdAt", "asc").limit(24).get();
  let convo = "CÂU HỎI:\n" + (p.text || "") + "\n\nCÁC TRẢ LỜI:\n";
  cs.forEach((c) => {
    const x = c.data();
    if (x.status !== "visible") return;
    convo += "- " + (x.authorName || "") + (x.isBestAnswer ? " (Best Answer)" : "") + ": " + (x.text || "") + "\n";
  });
  const system =
    "Tóm tắt luồng thảo luận diễn đàn kiến trúc/xây dựng thành TL;DR tiếng Việt: 2-4 gạch đầu dòng ngắn (mỗi dòng bắt đầu bằng '- '), " +
    "nêu vấn đề + kết luận/đáp án chính. TUYỆT ĐỐI KHÔNG dùng ký hiệu markdown (**, ##, bảng). CHỈ tóm tắt nội dung đã có, KHÔNG thêm thông tin mới. Không ghi SĐT/email/link.";
  const summary = await callClaude(ANTHROPIC_KEY.value(), "claude-haiku-4-5-20251001", system, convo, 400);
  await postRef.update({ aiSummary: summary, aiSummaryAt: ts() });
  return { summary, cached: false };
});

/* 9.4 — Đề cử Best Answer vào Cẩm nang (Founder; chỉ nội dung đã kiểm chứng) */
exports.forumToCamNangDraft = onCall({ region: REGION }, async (request) => {
  const { profile } = await requireAuth(request);
  if (profile.role !== "founder") throw new HttpsError("permission-denied", "Chỉ Founder đề cử Cẩm nang");
  const postId = String((request.data || {}).postId || "");
  const postRef = fdb.collection(COL.posts).doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Bài không tồn tại");
  const p = snap.data();
  if (!p.bestAnswerId) throw new HttpsError("failed-precondition", "Chưa có Best Answer — chỉ đề cử nội dung đã kiểm chứng");
  const baSnap = await postRef.collection("comments").doc(p.bestAnswerId).get();
  const ba = baSnap.exists ? baSnap.data() : null;
  const ref = await fdb.collection(COL.camNang).add({
    sourcePostId: postId, category: p.category,
    question: p.text || "", answer: (ba && ba.text) || "",
    answerBy: (ba && ba.authorName) || "", answerByUid: (ba && ba.authorUid) || "",
    status: "draft", createdAt: ts(),
  });
  await postRef.update({ camNangId: ref.id });
  return { ok: true, id: ref.id };
});

/* 9.5 — SLA: câu hỏi KTS quá 2 ngày chưa ai trả lời → nhắc top KTS + báo Founder */
exports.forumUnansweredNudgeDraft = onSchedule(
  { schedule: "20 9 * * *", timeZone: VN_TZ, region: REGION },
  async () => {
    const KTS_CATS = ["hoi_dap", "vat_lieu", "nghe", "showcase"];
    const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const snap = await fdb.collection(COL.posts).orderBy("createdAt", "desc").limit(150).get();
    const stale = [];
    snap.forEach((d) => {
      const p = d.data();
      const ms = p.createdAt && p.createdAt.toMillis ? p.createdAt.toMillis() : Date.now();
      if (p.status === "visible" && KTS_CATS.includes(p.category) && (p.commentCount || 0) === 0 && ms < cutoff) {
        stale.push({ id: d.id, text: p.text || "" });
      }
    });
    if (!stale.length) return;
    const kts = await suggestKtsFromForum(null, 5);
    for (const k of kts) {
      await fdNotify(k.uid, "❓ " + stale.length + " câu hỏi chưa ai trả lời",
        "Có câu hỏi kỹ thuật đang chờ chuyên gia — vào diễn đàn giúp đồng nghiệp nhé.", { type: "FORUM_SLA" });
    }
    await fdNotify(FOUNDER_UID, "❓ " + stale.length + " câu hỏi quá 2 ngày chưa trả lời",
      stale.slice(0, 3).map((s) => "• " + s.text.slice(0, 40)).join("\n"), { type: "FORUM_SLA_DIGEST" });
  }
);

/* 9.6 — Bản tin Q&A hằng tuần (Thứ 2 07:30) cho toàn mạng KTS */
exports.forumWeeklyDigestDraft = onSchedule(
  { schedule: "30 7 * * 1", timeZone: VN_TZ, region: REGION },
  async () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snap = await fdb.collection(COL.posts).orderBy("createdAt", "desc").limit(150).get();
    const items = [];
    snap.forEach((d) => {
      const p = d.data();
      const ms = p.createdAt && p.createdAt.toMillis ? p.createdAt.toMillis() : 0;
      if (p.status === "visible" && ms >= weekAgo) {
        items.push({
          id: d.id, text: (p.text || "").slice(0, 80), category: p.category,
          score: (p.heartCount || 0) * 2 + (p.commentCount || 0) + (p.bestAnswerId ? 3 : 0),
        });
      }
    });
    items.sort((a, b) => b.score - a.score);
    const top = items.slice(0, 5);
    const ref = await fdb.collection(COL.digest).add({ count: items.length, top, createdAt: ts() });
    if (top.length) {
      await fdNotify(FOUNDER_UID, "📰 Bản tin diễn đàn tuần (" + items.length + " bài)",
        top.map((t) => "• " + t.text).join("\n"), { type: "FORUM_WEEKLY", digestId: ref.id });
    }
  }
);
