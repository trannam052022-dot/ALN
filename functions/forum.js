/* ════════════════════════════════════════════════════════════════
   DIỄN ĐÀN ALN (forum)
   ────────────────────────────────────────────────────────────────
   TOÀN BỘ ghi dữ liệu diễn đàn đi qua các callable trong file này
   (Admin SDK) → client KHÔNG ghi trực tiếp → bộ lọc chống lách sàn,
   phân quyền, moderation, điểm uy tín đều được cưỡng chế server-side.

   Collection riêng cho diễn đàn (posts: forumPosts) — KHÔNG dùng
   chung với alnPosts của aln_community.html (Nhịp sống, tính năng
   khác). Chỉ ĐỌC (không ghi) 2 collection thật: users/ (hồ sơ, role)
   và fcmTokens/ (gửi push).
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
const FORUM_URL = BASE_URL + "forum.html";

/* Tên collection production của diễn đàn */
const COL = {
  posts:      "forumPosts",
  reports:    "reports",
  modLogs:    "modLogs",
  invites:    "invites",
  leads:      "leads",
  config:     "forumConfig",
  reputation: "ktsReputation",
  userState:  "forumUserState",
  notifBuf:   "notifBuffer",
  modQueue:   "modQueue",      // hàng chờ duyệt tập trung cho founder panel
  camNang:    "camNangForum",  // Best Answer được đề cử đưa vào Cẩm nang
  digest:     "forumDigest",   // bản tin Q&A hằng tuần
  hoiKtsQueue:"hoiKtsQueue",   // kho hàng chờ để RẢI bài Hỏi KTS theo ngày (drip)
};

/* Tên collection _draft cũ — CHỈ dùng cho action "migrateFromDraft" (chạy 1 lần khi nghiệm thu).
   notifBuffer_draft không migrate: chỉ là debounce tạm thời, mang state cũ sang không có ích. */
const LEGACY_DRAFT_COL = {
  posts:       "alnPosts_draft",
  reports:     "reports_draft",
  modLogs:     "modLogs_draft",
  invites:     "invites_draft",
  leads:       "leads_draft",
  config:      "forumConfig_draft",
  reputation:  "ktsReputation_draft",
  userState:   "forumUserState_draft",
  modQueue:    "modQueue_draft",
  camNang:     "camNangForum_draft",
  digest:      "forumDigest_draft",
  hoiKtsQueue: "hoiKtsQueue_draft",
};

const CATEGORIES = ["hoi_kts", "hoi_dap", "vat_lieu", "showcase", "nghe", "bang_tin", "tu_van_du_an"];
const KTS_POST_CATEGORIES = ["hoi_kts", "hoi_dap", "vat_lieu", "showcase", "nghe"];
const OPEN_CATEGORIES = ["hoi_kts", "tu_van_du_an", "showcase", "bang_tin"]; // CN/DN xem được (P2)

/* CHECKLIST_PHANQUYEN_DIENDAN_ALN.md PASS 1 — quyền ĐỌC theo category, denormalize
   vào field categoryVisibility của mỗi forumPosts để rules không phải get() chéo.
   hoi_dap/vat_lieu/nghe giữ nguyên KTS-only như đang chạy (không nằm trong
   OPEN_CATEGORIES); các category còn lại mặc định 'public' theo đúng chỉ định
   trong checklist. Chưa có category nào dành riêng cho DN trong hệ thống hiện tại. */
const CATEGORY_VISIBILITY = {
  hoi_kts:       "public",
  hoi_dap:       "kts",
  vat_lieu:      "kts",
  showcase:      "public",
  nghe:          "kts",
  bang_tin:      "public",
  tu_van_du_an:  "public",
};
function categoryVisibilityOf(cat) { return CATEGORY_VISIBILITY[cat] || "kts"; }

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
  if ((role === "cn" || role === "dn") && p2) return cat === "tu_van_du_an" || cat === "hoi_kts";
  return false;
}

/* Gửi push đến mọi FCM token của một uid — dọn token hỏng sau khi gửi (giống notifyUser trong index.js) */
async function fdNotify(uid, title, body, extraData) {
  try {
    const snap = await fdb.collection("fcmTokens").where("uid", "==", uid).get();
    if (snap.empty) return;
    const tokens = snap.docs.map((d) => d.data().token).filter((t) => typeof t === "string" && t.length > 0);
    if (!tokens.length) return;
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: { title, body, icon: "/ALN/icon-192.png", badge: "/ALN/icon-192.png" },
        fcmOptions: { link: FORUM_URL },
      },
      data: Object.assign({ click_action: FORUM_URL }, extraData || {}),
    });
    const batch = fdb.batch();
    result.responses.forEach((r, i) => {
      if (!r.success && r.error &&
          (r.error.code === "messaging/invalid-registration-token" ||
           r.error.code === "messaging/registration-token-not-registered")) {
        const stale = tokens[i];
        snap.docs.forEach((d) => { if (d.data().token === stale) batch.delete(d.ref); });
      }
    });
    await batch.commit();
  } catch (e) {
    console.error("[forum notify]", e);
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

/* ── 3 CẤP BẬC KTS (huy hiệu) suy từ điểm uy tín — bậc cao được ưu tiên nhận dự án ──
   Điểm: Best Answer +5, được tim +1, Showcase ghim +3, trả lời đầu tu_van x2(+5). */
const RANK_TIERS = [
  { key: "chuyen_gia", label: "Chuyên gia ALN", min: 60 },
  { key: "co_van",     label: "Cố vấn",         min: 20 },
  { key: "tan_binh",   label: "Tân binh",       min: 0 },
];
function rankFromPoints(points) {
  const p = Number(points) || 0;
  for (const t of RANK_TIERS) if (p >= t.min) return t.key;
  return "tan_binh";
}
/* Mốc điểm để lên bậc kế (phục vụ thanh tiến độ tạo động lực) */
function nextRankInfo(points) {
  const p = Number(points) || 0;
  if (p >= 60) return null;                       // đã cao nhất
  if (p >= 20) return { next: "chuyen_gia", nextLabel: "Chuyên gia ALN", need: 60 - p, at: 60 };
  return { next: "co_van", nextLabel: "Cố vấn", need: 20 - p, at: 20 };
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
const RANK_ORDER = { chuyen_gia: 2, co_van: 1, tan_binh: 0 };
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
   1. ĐĂNG BÀI — forumPost
════════════════════════════════════════════ */
exports.forumPost = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const category = String(d.category || "");
  const text = String(d.text || "").trim();
  const media = Array.isArray(d.media) ? d.media.slice(0, 4) : [];
  const tag = ["arch", "land", "nat"].includes(d.tag) ? d.tag : null;

  if (!CATEGORIES.includes(category)) throw new HttpsError("invalid-argument", "Chuyên mục không hợp lệ");
  const p2 = await getP2Enabled();
  if (!canPostCategory(profile.role, category, p2)) {
    throw new HttpsError("permission-denied", "Vai trò của bạn không đăng được vào chuyên mục này");
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
    categoryVisibility: categoryVisibilityOf(category),
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
   2. BÌNH LUẬN — forumComment
════════════════════════════════════════════ */
exports.forumComment = onCall({ region: REGION }, async (request) => {
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
    if (post.authorUid !== uid) throw new HttpsError("permission-denied", "Bạn chỉ bình luận được trong thread của mình");
  } else {
    throw new HttpsError("permission-denied", "Vai trò của bạn chưa bình luận được trong diễn đàn");
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
    categoryVisibility: post.categoryVisibility || categoryVisibilityOf(post.category),
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
        "💬 " + (profile.name || "Ai đó") + " bình luận bài của bạn", preview,
        { type: "FORUM_COMMENT", postId });
    }
    if (rootAuthorUid && !notified.has(rootAuthorUid)) {
      notified.add(rootAuthorUid);
      await fdNotifyBatched(rootAuthorUid, postId,
        "↩️ " + (profile.name || "Ai đó") + " trả lời bình luận của bạn", preview,
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
   3. THẢ TIM — forumHeart (bài hoặc bình luận)
════════════════════════════════════════════ */
exports.forumHeart = onCall({ region: REGION }, async (request) => {
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
   4. BEST ANSWER — forumBestAnswer
════════════════════════════════════════════ */
exports.forumBestAnswer = onCall({ region: REGION }, async (request) => {
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
  await fdNotify(info.authorUid, "🏆 Câu trả lời của bạn được chọn Best Answer",
    "Chủ thớt đã đánh dấu câu trả lời hay nhất — +5 điểm uy tín",
    { type: "FORUM_BEST_ANSWER", postId, commentId });

  return { ok: true };
});

/* ════════════════════════════════════════════
   5. BÁO CÁO VI PHẠM — forumReport
════════════════════════════════════════════ */
exports.forumReport = onCall({ region: REGION }, async (request) => {
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
   6. MỜI KTS TƯ VẤN — forumInvite (điểm chốt phễu)
════════════════════════════════════════════ */
exports.forumInvite = onCall({ region: REGION }, async (request) => {
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

  await fdNotify(ktsUid, "🤝 Bạn được mời tư vấn dự án",
    `${profile.name || "Khách"} vừa mời bạn tư vấn qua diễn đàn — mở kênh chat sàn để trao đổi`,
    { type: "FORUM_INVITE", inviteId: invRef.id });
  await fdNotify(FOUNDER_UID, "📈 Invite mới trong phễu diễn đàn",
    `${profile.name || uid} mời ${ktsProfile.name || ktsUid}`,
    { type: "FORUM_INVITE_ADMIN", inviteId: invRef.id });

  return { id: invRef.id, existing: false };
});

/* ════════════════════════════════════════════
   6b. CHỌN KTS LÀM DỰ ÁN — forumChooseKts (điểm chốt mạnh của phễu)
   Chủ đầu tư chọn 1 KTS để thực hiện dự án → ghi ý định 'project' vào invites
   + gắn chosenKts lên thread + báo KTS/Founder.
   TODO (P3): CHƯA tạo dự án thật (projects/) — cần nối vào
   createProjectFromThread/createProjectForDN để copy brief sang escrow C1–C4.
════════════════════════════════════════════ */
exports.forumChooseKts = onCall({ region: REGION }, async (request) => {
  const { uid, profile } = await requireAuth(request);
  const d = request.data || {};
  const ktsUid = String(d.ktsUid || "");
  const threadId = String(d.threadId || "");
  const ktsNameHint = String(d.ktsName || "").slice(0, 80);
  if (!ktsUid || !threadId) throw new HttpsError("invalid-argument", "Thiếu KTS hoặc thread");

  const p2 = await getP2Enabled();
  if (!(profile.role === "founder" || ((profile.role === "cn" || profile.role === "dn") && p2))) {
    throw new HttpsError("permission-denied", "Chỉ Chủ đầu tư (CN/DN, khi P2 mở) chọn được KTS làm dự án");
  }

  const postRef = fdb.collection(COL.posts).doc(threadId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw new HttpsError("not-found", "Thread không tồn tại");
  const post = postSnap.data();
  if (!["tu_van_du_an", "hoi_kts"].includes(post.category)) throw new HttpsError("failed-precondition", "Chỉ chọn KTS trong thread Tư vấn / Hỏi KTS");
  if (post.chosenKtsUid) throw new HttpsError("failed-precondition", "Thread đã chọn KTS làm dự án rồi");

  const ktsProfile = await getProfile(ktsUid);
  let ktsName, badge, seedKts = false;
  if (ktsProfile && ktsProfile.role === "kts") {
    ktsName = ktsProfile.name || "";
    badge = await safeRank(ktsUid, "kts");
  } else {
    // KTS persona mồi (uid seed_*) không có trong users/ — dùng tên denormalized.
    // TODO (P3): khi có đủ KTS thật, chỉ cho chọn KTS đã xác minh chứng chỉ.
    seedKts = true;
    ktsName = ktsNameHint || "KTS ALN";
    badge = null;
  }

  const invRef = await fdb.collection(COL.invites).add({
    cnUid: uid,
    cnName: profile.name || "",
    cnRole: profile.role,
    ktsUid,
    ktsName,
    ktsBadge: badge,
    seedKts,
    threadId,
    intent: "project",             // 'project' = chọn làm dự án (mạnh hơn 'tuvan')
    brief: post.brief || null,     // copy brief để nghiệm thu tạo dự án không phải nhập lại
    status: "new",                 // new → quoted → contracted → won/lost
    createdAt: ts(),
    updatedAt: ts(),
  });

  await postRef.update({
    chosenKtsUid: ktsUid,
    chosenKts: { uid: ktsUid, name: ktsName, rank: badge },
    chosenInviteId: invRef.id,
    chosenAt: ts(),
    updatedAt: ts(),
  });

  if (!seedKts) {
    await fdNotify(ktsUid, "⭐ Bạn được CHỌN làm KTS dự án!",
      `${profile.name || "Chủ đầu tư"} đã chọn bạn thực hiện dự án — mở kênh chat sàn để xác nhận & vào Quy trình 4 bước`,
      { type: "FORUM_CHOOSE_KTS", inviteId: invRef.id, postId: threadId });
  }
  await fdNotify(FOUNDER_UID, "🎯 Chủ đầu tư CHỌN KTS làm dự án",
    `${profile.name || uid} chọn ${ktsName} (thread ${threadId})`,
    { type: "FORUM_CHOOSE_KTS_ADMIN", inviteId: invRef.id, postId: threadId });

  return { ok: true, inviteId: invRef.id };
});

/* ════════════════════════════════════════════
   7. XÓA (mềm) — forumDelete (tác giả hoặc Founder)
════════════════════════════════════════════ */
exports.forumDelete = onCall({ region: REGION }, async (request) => {
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
   8. QUẢN TRỊ FOUNDER — forumAdmin (gồm seed)
════════════════════════════════════════════ */
exports.forumAdmin = onCall({ region: REGION }, async (request) => {
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
          await fdNotify(cSnap.data().authorUid, "✅ Bình luận của bạn đã được duyệt", "Bình luận đã hiển thị trên diễn đàn", { type: "FORUM_APPROVED", postId: d.postId });
        }
        await fdb.collection(COL.modQueue).doc(String(d.postId) + "__" + String(d.commentId)).delete();
      } else {
        const pSnap = await postRef.get();
        if (!pSnap.exists) throw new HttpsError("not-found", "Bài viết không tồn tại");
        if (pSnap.data().status === "pending") {
          await postRef.update({ status: "visible", updatedAt: ts() });
          await fdNotify(pSnap.data().authorUid, "✅ Bài của bạn đã được duyệt", "Bài đã hiển thị trên diễn đàn", { type: "FORUM_APPROVED", postId: d.postId });
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

    /* P3 — Founder tạo dự án thật (projects/) từ invite intent:'project' của forumChooseKts.
       Project được tạo client-side ở founder_panel.html (modal "Tạo dự án", Founder tự
       nhập phí/escrow) — hàm này chỉ gắn projectId lên invite + báo KTS/CN, vì client
       không ghi thẳng được collection invites (rules write:false). */
    case "linkProjectToInvite": {
      const invId = String(d.inviteId || "");
      const projectId = String(d.projectId || "");
      if (!invId || !projectId) throw new HttpsError("invalid-argument", "Thiếu inviteId hoặc projectId");
      const invRef = fdb.collection(COL.invites).doc(invId);
      const invSnap = await invRef.get();
      if (!invSnap.exists) throw new HttpsError("not-found", "Invite không tồn tại");
      const inv = invSnap.data();
      await invRef.update({ status: "contracted", projectId, contractedAt: ts(), updatedAt: ts() });
      if (inv.threadId) {
        await fdb.collection(COL.posts).doc(inv.threadId).update({ chosenProjectId: projectId }).catch(() => {});
      }
      if (inv.ktsUid) {
        await fdNotify(inv.ktsUid, "🏗️ Dự án đã được tạo!",
          `Founder đã tạo dự án ${projectId} từ lời mời của ${inv.cnName || "khách"} — vào Dự án để bắt đầu`,
          { type: "FORUM_PROJECT_CREATED", inviteId: invId, projectId });
      }
      if (inv.cnUid) {
        await fdNotify(inv.cnUid, "🏗️ Dự án của bạn đã được tạo!",
          `Dự án ${projectId} với ${inv.ktsName || "KTS"} đã sẵn sàng — vào trang của bạn để theo dõi`,
          { type: "FORUM_PROJECT_CREATED", inviteId: invId, projectId });
      }
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
        "Founder xác nhận — bạn nhận thêm điểm uy tín x2", { type: "FORUM_FIRST_ANSWER", postId: d.postId });
      return { ok: true };
    }

    case "migrateFromDraft":
      return await migrateFromDraft();

    case "backfillCategoryVisibility":
      return await backfillCategoryVisibility();

    case "seed":
      return await seedForumData();

    case "seedHoiKts":
      return await seedHoiKtsData();

    case "seedHoiKtsQueue":
      return await seedHoiKtsQueueData();

    case "toggleDrip": {
      await fdb.collection(COL.config).doc("flags").set(
        { FORUM_HOIKTS_DRIP_ENABLED: d.enabled === true, updatedAt: ts() }, { merge: true });
      return { ok: true, enabled: d.enabled === true };
    }

    case "dripNow": {
      // Test: đăng ngay 1 câu hỏi từ kho + câu trả lời đầu, rồi trổ các câu đã tới hạn
      const qs = await fdb.collection(COL.hoiKtsQueue).where("status", "==", "queued").limit(25).get();
      let pid = null;
      if (!qs.empty) {
        const pick = qs.docs[Math.floor(Math.random() * qs.docs.length)];
        pid = await drip_makeQuestion(pick);
        const item = pick.data();
        if (item.answers && item.answers[0]) {
          await drip_postAnswer(pid, item.answers[0], 0);
          await pick.ref.update(Object.assign({ answersPosted: 1 }, item.answers.length <= 1 ? { status: "done" } : {}));
        }
      }
      const due = await drip_dueAnswers();
      return { ok: true, publishedNow: pid ? 1 : 0, dueAnswers: due };
    }

    default:
      throw new HttpsError("invalid-argument", "Hành động không hợp lệ: " + action);
  }
});

/* ════════════════════════════════════════════
   CHECKLIST_PHANQUYEN_DIENDAN_ALN.md PASS 1 — backfill categoryVisibility cho bài
   + bình luận đã tồn tại trước khi có field này (kể cả bài cũ chỉ có tag, không có
   category — mặc định 'kts' cho an toàn, không lộ ra công khai). Idempotent, chạy
   lại vô hại (luôn tính lại đúng theo category hiện tại của từng bài).
════════════════════════════════════════════ */
async function backfillCategoryVisibility() {
  const snap = await fdb.collection(COL.posts).get();
  let posts = 0, comments = 0, fixedHidden = 0, fixedStatus = 0;
  for (const doc of snap.docs) {
    const p = doc.data();
    const vis = categoryVisibilityOf(p.category);
    const upd = {};
    if (p.categoryVisibility !== vis) { upd.categoryVisibility = vis; posts++; }
    // Bài cũ (seed/migrate) thiếu hidden/status → khách + CN/DN không đọc được vì rules
    // đòi hidden==false && status=='visible'. Set mặc định an toàn: bài cũ vốn đang hiển thị.
    if (p.hidden === undefined) { upd.hidden = false; fixedHidden++; }
    if (p.status === undefined) { upd.status = "visible"; fixedStatus++; }
    if (Object.keys(upd).length) await doc.ref.update(upd);
    const cSnap = await doc.ref.collection("comments").get();
    for (const c of cSnap.docs) {
      const cd = c.data();
      const cupd = {};
      if (cd.categoryVisibility !== vis) { cupd.categoryVisibility = vis; comments++; }
      if (cd.status === undefined) { cupd.status = "visible"; }
      if (Object.keys(cupd).length) await c.ref.update(cupd);
    }
  }
  return { ok: true, totalPosts: snap.size, updatedPosts: posts, updatedComments: comments, fixedHidden, fixedStatus };
}

/* ════════════════════════════════════════════
   MIGRATE _draft → PRODUCTION — chạy 1 LẦN khi nghiệm thu (Tools → "Chuyển dữ liệu từ bản nháp").
   Idempotent (set theo đúng id cũ) — chạy lại an toàn, không nhân đôi.
   KHÔNG tự xoá collection _draft cũ — Founder tự dọn trên Firestore Console sau khi đối soát.
════════════════════════════════════════════ */
async function migrateFromDraft() {
  async function copyPlain(oldName, newName) {
    const snap = await fdb.collection(oldName).get();
    let batch = fdb.batch(), n = 0;
    const commits = [];
    snap.forEach((doc) => {
      batch.set(fdb.collection(newName).doc(doc.id), doc.data(), { merge: true });
      if (++n === 400) { commits.push(batch.commit()); batch = fdb.batch(); n = 0; }
    });
    if (n) commits.push(batch.commit());
    await Promise.all(commits);
    return snap.size;
  }

  async function copyWithSubcollection(oldName, newName, subName) {
    const snap = await fdb.collection(oldName).get();
    let subs = 0;
    for (const doc of snap.docs) {
      await fdb.collection(newName).doc(doc.id).set(doc.data(), { merge: true });
      const subSnap = await fdb.collection(oldName).doc(doc.id).collection(subName).get();
      for (const s of subSnap.docs) {
        await fdb.collection(newName).doc(doc.id).collection(subName).doc(s.id).set(s.data(), { merge: true });
        subs++;
      }
    }
    return { docs: snap.size, subs };
  }

  const posts = await copyWithSubcollection(LEGACY_DRAFT_COL.posts, COL.posts, "comments");
  const reputation = await copyWithSubcollection(LEGACY_DRAFT_COL.reputation, COL.reputation, "events");

  const counts = {
    posts: posts.docs,
    comments: posts.subs,
    reputation: reputation.docs,
    reputationEvents: reputation.subs,
    reports: await copyPlain(LEGACY_DRAFT_COL.reports, COL.reports),
    modLogs: await copyPlain(LEGACY_DRAFT_COL.modLogs, COL.modLogs),
    invites: await copyPlain(LEGACY_DRAFT_COL.invites, COL.invites),
    leads: await copyPlain(LEGACY_DRAFT_COL.leads, COL.leads),
    config: await copyPlain(LEGACY_DRAFT_COL.config, COL.config),
    userState: await copyPlain(LEGACY_DRAFT_COL.userState, COL.userState),
    modQueue: await copyPlain(LEGACY_DRAFT_COL.modQueue, COL.modQueue),
    camNang: await copyPlain(LEGACY_DRAFT_COL.camNang, COL.camNang),
    digest: await copyPlain(LEGACY_DRAFT_COL.digest, COL.digest),
    hoiKtsQueue: await copyPlain(LEGACY_DRAFT_COL.hoiKtsQueue, COL.hoiKtsQueue),
  };

  return { ok: true, migrated: counts, note: "Idempotent — chạy lại an toàn. KHÔNG tự xoá collection _draft cũ." };
}

/* ════════════════════════════════════════════
   SEED DỮ LIỆU MẪU — idempotent (set theo id cố định)
════════════════════════════════════════════ */
async function seedForumData() {
  const KTS_UID = "kw5TgVDggIfboEqERS1cAphn3263";   // kts.tranlong
  const CN_UID = "G4RhRH5ECMYcE9aFcKYVn5Wdy952";    // cn.trannam
  const DN_UID = "aTyHR3oQw6P87xpA9p8hTr2NbGA2";    // dn.tkhouse

  const [ktsP, cnP] = await Promise.all([getProfile(KTS_UID), getProfile(CN_UID)]);
  const KTS_NAME = (ktsP && ktsP.name) || "KTS. Trần Đại Long";
  const CN_NAME = (cnP && cnP.name) || "Trần Nam";
  const FOUNDER_NAME = "KTS. Trần Đại Long";

  const now = Date.now();
  const T = (hoursAgo) => Timestamp.fromMillis(now - hoursAgo * 3600 * 1000);
  // Ảnh demo ALN thật (đã deploy) — đẹp & liên quan chủ đề, thay ảnh ngẫu nhiên picsum.
  const IMGMAP = {
    alnvl1:  "aln-demo-office-tower.jpg",       // vật liệu/giá — bối cảnh công trình
    alnsc1:  "aln-demo-villa-tancodien.jpg",    // showcase biệt thự Tân Cổ Điển
    alnsc2:  "aln-demo-biet-thu-vuon.jpg",      // showcase biệt thự vườn
    alnsc3:  "aln-demo-biet-thu-vuon.jpg",      // showcase nhà phố/giếng trời
    alnold1: "aln-demo-office-tower.jpg",       // công trình mái dốc
  };
  const imgUrl = (seed) => "https://applamnha.vn/assets/demo/" + (IMGMAP[seed] || "aln-demo-biet-thu-vuon.jpg");
  const img = (seed) => ({ url: imgUrl(seed), type: "image" });

  const base = {
    heartCount: 0, heartedBy: [], pinned: false, hidden: false,
    status: "visible", commentCount: 0, bestAnswerId: null, brief: null, tag: null,
    authorAvatar: "", authorRank: null, suggestedKts: [], aiSummary: null, aiSummaryAt: null,
  };
  const ktsAuthor = { authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts", authorRank: "chuyen_gia" };
  const cnAuthor = { authorUid: CN_UID, authorName: CN_NAME, authorRole: "cn" };
  const founderAuthor = { authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder" };
  // Bài seed BẮT BUỘC có categoryVisibility (khớp category) — nếu không, query khách/CN
  // (lọc categoryVisibility=='public') sẽ loại sạch bài seed → Showcase/Tư vấn hiện rỗng.
  const P = (a, f) => Object.assign({}, base, a, f, { categoryVisibility: categoryVisibilityOf(f.category) });

  const posts = fdb.collection(COL.posts);
  const batch1 = fdb.batch();

  /* P1 — Hỏi đáp kỹ thuật (có Best Answer) */
  batch1.set(posts.doc("draft_p01"), P(ktsAuthor, {
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
    authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts", authorRank: "chuyen_gia", authorAvatar: "",
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

  batch1.set(posts.doc("draft_p02"), P(ktsAuthor, {
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
  batch1.set(posts.doc("draft_p03"), P(ktsAuthor, {
    category: "vat_lieu",
    text: "Cập nhật giá gạch không nung khu vực Bình Dương tháng 7/2026: gạch block 390x190x190 dao động 12.5k–13.8k/viên tại bãi, tăng nhẹ ~4% so với quý trước. Anh em khu vực khác cập nhật giúp để có mặt bằng chung.",
    media: [img("alnvl1")], images: [imgUrl("alnvl1")],
    heartCount: 1, heartedBy: [FOUNDER_UID],
    commentCount: 1, createdAt: T(26), updatedAt: T(24),
  }));
  batch1.set(posts.doc("draft_p03").collection("comments").doc("draft_c05"), {
    authorUid: FOUNDER_UID, authorName: FOUNDER_NAME, authorRole: "founder", authorAvatar: "",
    text: "Khu Đồng Nai đang thấy 13k–14.2k/viên, chênh chủ yếu do phí vận chuyển. Cảm ơn anh cập nhật.",
    replyToId: null, isBestAnswer: false, flagged: false, status: "visible",
    heartCount: 0, heartedBy: [], createdAt: T(24),
  });

  batch1.set(posts.doc("draft_p04"), P(ktsAuthor, {
    category: "vat_lieu",
    text: "So sánh nhanh 3 dòng sơn ngoại thất phổ thông sau 2 năm thi công thực tế: độ phai màu hướng Tây khác biệt rõ. Kết luận cá nhân: khu vực nắng gắt nên tư vấn khách lên dòng cao cấp hơn 1 bậc, chênh chi phí ~8% nhưng tuổi thọ màng sơn gần gấp rưỡi.",
    media: [], images: [],
    commentCount: 0, createdAt: T(22), updatedAt: T(22),
  }));

  /* P1 — Showcase (1 bài được ghim) */
  batch1.set(posts.doc("draft_p05"), P(ktsAuthor, {
    category: "showcase",
    text: "Biệt thự vườn Tân Cổ Điển tại Thủ Đức vừa hoàn thiện phần thô — nhịp cột đôi sảnh chính và vòm cong tầng 2 là hai chi tiết mất nhiều công nhất. Cảm ơn đội thi công đã theo sát bản vẽ từng cm.",
    media: [img("alnsc1"), img("alnsc2")],
    images: [imgUrl("alnsc1"), imgUrl("alnsc2")],
    pinned: true, pinRewarded: true,
    heartCount: 4, heartedBy: [FOUNDER_UID, CN_UID, DN_UID, "seed_x"],
    commentCount: 0, createdAt: T(70), updatedAt: T(70),
  }));
  batch1.set(posts.doc("draft_p06"), P(ktsAuthor, {
    category: "showcase",
    text: "Góc cầu thang giếng trời nhà phố 4x16m — ánh sáng tự nhiên đủ cho cả 3 tầng giữa, không cần đèn ban ngày. Giải pháp lam gỗ chắn nắng hướng Tây hoạt động tốt hơn kỳ vọng.",
    media: [img("alnsc3")], images: [imgUrl("alnsc3")],
    heartCount: 2, heartedBy: [FOUNDER_UID, CN_UID],
    commentCount: 0, createdAt: T(18), updatedAt: T(18),
  }));

  /* P1 — Nghề & Chứng chỉ */
  batch1.set(posts.doc("draft_p07"), P(ktsAuthor, {
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
  batch1.set(posts.doc("draft_p08"), P(founderAuthor, {
    category: "bang_tin",
    text: "📌 DIỄN ĐÀN ALN phiên bản mới: bình luận theo luồng, Best Answer, chuyên mục riêng cho KTS. Quy tắc duy nhất — mọi trao đổi dự án thực hiện qua kênh chat sàn ALN để được bảo vệ bởi Quy trình 4 bước. Nhận tiền ngoài sàn = khóa tài khoản vĩnh viễn + thu hồi Quỹ bảo đảm.",
    media: [], images: [],
    pinned: true,
    heartCount: 3, heartedBy: [KTS_UID, CN_UID, DN_UID],
    commentCount: 0, createdAt: T(72), updatedAt: T(72),
  }));

  /* P2 — Thread Tư vấn Dự án (CN đăng, KTS trả lời, có invite + lead) */
  batch1.set(posts.doc("draft_p09"), P(cnAuthor, {
    category: "tu_van_du_an",
    text: "Gia đình em có lô đất 6x20m ở TP. Thủ Đức, muốn xây nhà 3 tầng cho 2 thế hệ ở chung (ông bà + vợ chồng con nhỏ). Ưu tiên thông thoáng, có sân trước để xe. Nhờ các anh KTS tư vấn hướng bố trí công năng ạ.",
    media: [], images: [],
    brief: {
      projectType: "xay_moi", area: 120, region: "TP. Thủ Đức, TP.HCM",
      budget: "1-2ty", timeline: "3-6thang", hasLand: true, consentNd13: true,
    },
    leadId: "draft_lead01",
    suggestedKts: [{ uid: KTS_UID, name: KTS_NAME, rank: "chuyen_gia" }],
    commentCount: 2, createdAt: T(10), updatedAt: T(6),
    firstAnswerRewarded: true,
  }));
  batch1.set(posts.doc("draft_p09").collection("comments").doc("draft_c07"), {
    authorUid: KTS_UID, authorName: KTS_NAME, authorRole: "kts", authorRank: "chuyen_gia", authorAvatar: "",
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
  const p10 = P(ktsAuthor, {
    tag: "arch",
    text: "(Bài dạng CŨ — chỉ có tag, chưa có category — để kiểm tra migration hiển thị như Showcase) Hoàng hôn trên công trình mái dốc hôm nay.",
    media: [img("alnold1")], images: [imgUrl("alnold1")],
    heartCount: 1, heartedBy: [FOUNDER_UID],
    commentCount: 0, createdAt: T(200), updatedAt: T(200),
  });
  batch1.set(posts.doc("draft_p10"), p10);

  /* Bài CHỜ DUYỆT — demo hàng chờ moderation */
  batch1.set(posts.doc("draft_p11"), P(ktsAuthor, {
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

  /* Điểm uy tín KTS mẫu (đủ ≥60 → huy hiệu Chuyên gia ALN để demo bậc cao nhất) */
  batch2.set(fdb.collection(COL.reputation).doc(KTS_UID), {
    points: 65,
    counts: { bestAnswer: 6, heart: 22, pin: 2, firstAnswer: 1 },
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

/* Seed chuyên mục "Hỏi KTS Miễn Phí" — 20 câu hỏi mồi + trả lời mẫu (persona KTS).
   Câu hỏi đứng tên chủ nhà giả lập; trả lời đứng tên KTS phân công. Rải ngày 14 ngày. */
async function seedHoiKtsData() {
  const P = {
    bcv:   { uid: "seed_kts_bcv",      name: "Ban Cố Vấn ALN", badge: "chuyen_gia" },
    loc:   { uid: "seed_kts_tuanloc",  name: "KTS. Tuấn Lộc",  badge: "chuyen_gia" },
    long:  { uid: "seed_kts_tranlong", name: "KTS. Trần Long", badge: "chuyen_gia" },
    tuan:  { uid: "seed_kts_anhtuan",  name: "KTS. Anh Tuấn",  badge: "co_van" },
    tri:   { uid: "seed_kts_minhtri",  name: "KTS. Minh Trí",  badge: "co_van" },
    phuc:  { uid: "seed_kts_phanphuc", name: "KTS. Phan Phúc", badge: "co_van" },
  };
  const now = Date.now();
  const T = (h) => Timestamp.fromMillis(now - h * 3600 * 1000);

  const QA = [
    { asker: "Anh Hùng · Biên Hòa", by: P.loc, best: true, hearts: 7, h: 320,
      title: "Xây nhà phố 4x18m, 3 tầng ở Đồng Nai hết khoảng bao nhiêu tiền?",
      q: "Em có lô đất 4x18m ở Biên Hòa, định xây 3 tầng để ở, chưa biết nên chuẩn bị ngân sách bao nhiêu. Nhờ các anh KTS tư vấn giúp.",
      a: "Chào anh. Với lô 4x18m xây 3 tầng, nếu xây hết đất thì tổng diện tích sàn khoảng 200–216m². Chi phí xây thô + hoàn thiện cơ bản hiện dao động 5,5–7 triệu/m² tùy vật liệu và nhà thầu, tức phần xây dựng rơi vào khoảng 1,2–1,5 tỷ. Anh nên dự phòng thêm 10–15% cho phát sinh.\n\nRiêng phần thiết kế, nhiều chủ nhà hay bỏ qua nhưng đây là khoản rẻ nhất mà tiết kiệm nhiều nhất: một bộ hồ sơ đầy đủ (kiến trúc, kết cấu, điện nước) giúp anh khóa được khối lượng với nhà thầu, tránh phát sinh mơ hồ.\n\nCon số trên là ước tính chung. Nếu anh cho biết thêm nhu cầu (mấy phòng ngủ, có thang máy không, phong cách mong muốn), tôi tư vấn sát hơn. Khi cần bóc tách chi tiết cho đúng lô đất, anh có thể tạo dự án trên ALN để KTS làm việc trực tiếp." },
    { asker: "Anh Dũng · Long Thành", by: P.loc, best: false, hearts: 5, h: 300,
      title: "Nên xây nhà trọn gói hay tách riêng thiết kế và thi công?",
      q: "Nhà thầu gần nhà báo em giá trọn gói 'miễn phí thiết kế'. Vậy có nên thuê KTS riêng nữa không, hay để nhà thầu lo hết cho tiện?",
      a: "Câu hỏi này gần như chủ nhà nào cũng gặp. 'Miễn phí thiết kế' nghe hấp dẫn, nhưng bản chất: không có gì miễn phí — chi phí thiết kế đã nằm trong giá thi công, và quan trọng hơn, bản vẽ khi đó phục vụ lợi ích của nhà thầu trước tiên. Bản vẽ sơ sài đồng nghĩa khối lượng mơ hồ, phát sinh sẽ xuất hiện ở giai đoạn anh chị khó dừng lại.\n\nThuê KTS độc lập nghĩa là có một người đứng về phía chủ nhà: hồ sơ chi tiết để so sánh báo giá nhiều nhà thầu, có căn cứ nghiệm thu, có người giám sát quyền tác giả.\n\nKinh nghiệm của tôi: với nhà từ 1,5 tỷ trở lên, tách riêng thiết kế luôn có lợi. Với nhà nhỏ ngân sách rất sát, trọn gói có thể chấp nhận nhưng nên yêu cầu xem đủ hồ sơ kết cấu và điện nước trước khi ký." },
    { asker: "Chị Lan · Vũng Tàu", by: P.loc, best: false, hearts: 4, h: 280,
      title: "Đơn giá thiết kế 120.000đ/m² tính trên diện tích nào?",
      q: "Em thấy trên ALN ghi thiết kế nhà phố 120.000đ/m². Vậy m² này tính theo đất hay theo sàn? Nhà em đất 5x20m nhưng chỉ xây 2 tầng.",
      a: "Chào chị. Đơn giá thiết kế tính trên tổng diện tích sàn xây dựng, không phải diện tích đất. Ví dụ đất 5x20m (100m²), xây 2 tầng, mỗi tầng xây khoảng 80m² (chừa sân) thì tổng sàn 160m² — phí thiết kế khoảng 160 × 120.000đ = 19,2 triệu cho trọn bộ hồ sơ nhà phố.\n\nBộ hồ sơ gồm: phương án kiến trúc (mặt bằng, mặt đứng, mặt cắt, 3D), hồ sơ kết cấu, hồ sơ điện–nước, và dự toán khối lượng. Hồ sơ do KTS có chứng chỉ hành nghề ký theo quy định.\n\nSo với tổng giá trị căn nhà cỡ 1,3–1,5 tỷ thì phí thiết kế chiếm hơn 1% — nhưng là 1% quyết định 99% còn lại đi đúng hướng hay không. Chị tạo dự án để nhận báo phí chính xác theo số tầng và diện tích thực tế." },
    { asker: "Anh Phát · Bà Rịa", by: P.loc, best: false, hearts: 6, h: 250,
      title: "Có 900 triệu, nên xây 2 tầng hoàn thiện hay 3 tầng để thô dần?",
      q: "Vợ chồng em có 900 triệu, đất 4x16m ở Bà Rịa. Phân vân xây 2 tầng làm luôn nội thất, hay xây 3 tầng rồi hoàn thiện từ từ?",
      a: "Đây là bài toán rất thực tế. Quan điểm của tôi: ưu tiên phương án 2 tầng hoàn thiện gọn, trừ khi gia đình chắc chắn cần thêm phòng trong 2–3 năm tới.\n\nLý do: nhà xây thô để đó xuống cấp nhanh (thấm, nứt), ở trong nhà dở dang ảnh hưởng sinh hoạt kéo dài, và 'hoàn thiện từ từ' thường đội lên 20–30% so với làm một lần do thi công lắt nhắt. 900 triệu cho 4x16m xây 2 tầng (~128m² sàn) là vừa vặn làm tử tế.\n\nPhương án trung gian đáng cân nhắc: thiết kế ngay cho 3 tầng (móng, cột, chờ thép, chờ ống kỹ thuật) nhưng chỉ xây 2 tầng. Sau này lên tầng không phải đập phá — đó là giá trị của việc có KTS tham gia từ sớm." },
    { asker: "Chị Mai · TP.HCM", by: P.bcv, best: true, hearts: 9, h: 230,
      title: "Tiền thiết kế trả cho KTS qua ALN như thế nào, có an toàn không?",
      q: "Em chưa từng thuê KTS online bao giờ. Lỡ chuyển tiền xong KTS làm không đúng ý hoặc bỏ ngang thì sao?",
      a: "Chào anh/chị, lo lắng này rất chính đáng và đây chính là lý do ALN tồn tại. Trên ALN, anh/chị không chuyển tiền trực tiếp cho KTS. Tiền được giữ an toàn tại nền tảng và giải ngân theo 4 giai đoạn C1→C4, mỗi giai đoạn gắn với một sản phẩm cụ thể nghiệm thu được:\n\n- C1 — Phương án sơ bộ: mặt bằng công năng, duyệt mới đi tiếp.\n- C2 — Hồ sơ kiến trúc: mặt đứng, mặt cắt, phối cảnh 3D.\n- C3 — Hồ sơ kỹ thuật: kết cấu, điện–nước.\n- C4 — Bàn giao trọn bộ + dự toán.\n\nỞ mỗi bước, anh/chị xem sản phẩm trước, hài lòng thì xác nhận, tiền giai đoạn đó mới chuyển cho KTS. Có tranh chấp, ALN phân xử dựa trên hồ sơ lưu trên hệ thống — vì vậy nên trao đổi trong workspace dự án, không qua kênh riêng. Toàn bộ KTS đều được xác minh chứng chỉ hành nghề." },
    { asker: "Chị Hoa · Vũng Tàu", by: P.long, best: true, hearts: 8, h: 210,
      title: "Xây nhà ở riêng lẻ có bắt buộc phải có bản vẽ do KTS ký không?",
      q: "Nhà em cấp 4 lên 2 tầng ở TP. Vũng Tàu. Nghe nói giờ xin phép xây dựng phải có bản vẽ của người có chứng chỉ, đúng không ạ?",
      a: "Chào chị. Đúng vậy. Theo Nghị định 15/2021/NĐ-CP về quản lý dự án đầu tư xây dựng, hồ sơ thiết kế trong hồ sơ xin phép phải do tổ chức/cá nhân đủ điều kiện năng lực thực hiện — với nhà ở riêng lẻ, người chủ trì thiết kế phải có chứng chỉ hành nghề phù hợp và ký, đóng dấu.\n\nTrường hợp cải tạo nâng tầng còn cần lưu ý: phải khảo sát, đánh giá kết cấu móng hiện trạng có chịu được tầng mới không — phần này cần kỹ sư kết cấu xác nhận, liên quan trực tiếp an toàn.\n\nNhiều chủ nhà mua 'bản vẽ xin phép' trôi nổi ký khống — rủi ro là hồ sơ bị trả, hoặc xây sai bản vẽ được duyệt dẫn đến khó hoàn công. Trên ALN, mọi hồ sơ đều do KTS đứng tên chịu trách nhiệm theo quy định." },
    { asker: "Anh Nam · Biên Hòa", by: P.long, best: false, hearts: 5, h: 195,
      title: "Bản vẽ xin phép xây dựng và bản vẽ thi công khác nhau thế nào?",
      q: "Em tưởng có 1 bộ bản vẽ dùng chung, nhưng nhà thầu nói bản vẽ xin phép không thi công được. Vậy em phải làm mấy bộ hồ sơ?",
      a: "Câu hỏi rất hay, đây là điểm nhiều chủ nhà nhầm lẫn. Hai bộ hồ sơ khác nhau về mục đích và độ chi tiết:\n\nBản vẽ xin phép là hồ sơ pháp lý nộp cơ quan cấp phép: thể hiện quy mô, mật độ, chiều cao, khoảng lùi... đủ để xét duyệt có phù hợp quy hoạch không. Nó không đủ chi tiết để thợ làm theo.\n\nHồ sơ thi công mới là 'kim chỉ nam' ngoài công trường: chi tiết kết cấu từng cấu kiện, bố trí thép, sơ đồ điện–nước, chi tiết cầu thang, chống thấm... Thiếu bộ này, thợ làm theo kinh nghiệm và mọi tranh cãi đều từ đó.\n\nLưu ý: hai bộ phải thống nhất với nhau. Xây khác bản vẽ được duyệt là rủi ro khi hoàn công. Tốt nhất cùng một KTS làm cả hai." },
    { asker: "Anh Tài · Long Điền", by: P.long, best: false, hearts: 6, h: 175,
      title: "Xây nhà trên đất chưa lên thổ cư có xin phép được không?",
      q: "Đất em ở Long Điền là đất trồng cây lâu năm, có được xây nhà tạm hay nhà cấp 4 không? Có cách nào hợp thức không ạ?",
      a: "Chào anh. Tôi trả lời thẳng để anh tránh rủi ro: đất nông nghiệp (kể cả đất trồng cây lâu năm) không được phép xây nhà ở, kể cả nhà tạm hay cấp 4. Xây trên đất chưa chuyển mục đích là vi phạm, có thể bị buộc tháo dỡ và xử phạt.\n\nHướng đi đúng: làm thủ tục chuyển mục đích sử dụng đất sang đất ở tại Phòng TN&MT/bộ phận một cửa. Điều kiện tiên quyết là khu đất nằm trong quy hoạch cho phép đất ở — anh tra cứu quy hoạch hoặc hỏi UBND xã trước khi nộp. Chi phí chính là tiền sử dụng đất theo bảng giá địa phương.\n\nSau khi lên thổ cư và có giấy phép, lúc đó mới bàn chuyện thiết kế. KTS có thể tư vấn trước quy mô xây phù hợp quy hoạch để anh quyết diện tích chuyển mục đích tối ưu." },
    { asker: "Chị Yến · Q.9", by: P.long, best: false, hearts: 4, h: 160,
      title: "Hoàn công là gì, không hoàn công có sao không?",
      q: "Nhà em xây xong 2 năm rồi nhưng chưa làm hoàn công vì nghe nói thủ tục rắc rối. Để vậy luôn có sao không các anh?",
      a: "Chào chị. Hoàn công là thủ tục ghi nhận căn nhà vào sổ. Chưa hoàn công thì trên giấy tờ tài sản của chị chỉ có... miếng đất trống. Hệ quả: khó thế chấp vay ngân hàng đúng giá trị, mua bán chuyển nhượng bị vướng, tranh chấp thì căn nhà không được ghi nhận đầy đủ.\n\nHồ sơ hoàn công gồm: giấy phép xây dựng, bản vẽ được duyệt, bản vẽ hiện trạng hoàn công. Mấu chốt: nhà xây phải khớp với giấy phép. Nếu xây lệch (thêm tầng, lố diện tích), phải xử lý phần sai phạm trước.\n\nLời khuyên: làm sớm, để lâu quy định thay đổi càng phức tạp. Nếu nhà xây đúng phép, thủ tục không đáng ngại như lời đồn." },
    { asker: "Anh Sơn · Gia Lai", by: P.bcv, best: false, hearts: 7, h: 145,
      title: "Quy trình làm việc với KTS trên ALN diễn ra như thế nào?",
      q: "Em ở tỉnh xa, không tiện gặp mặt. Làm việc với KTS online từ A đến Z có ổn không, quy trình cụ thể ra sao?",
      a: "Chào anh. Hoàn toàn ổn — phần lớn dự án trên ALN diễn ra online toàn bộ:\n\n1. Tạo dự án & brief: anh mô tả nhu cầu (trợ lý MyMy hỏi từng câu đơn giản, anh chỉ việc trả lời).\n2. Ghép KTS phù hợp theo loại công trình và khu vực.\n3. C1 – Phương án sơ bộ: KTS gửi mặt bằng công năng, trao đổi ngay trong workspace, lưu lịch sử.\n4. C2 – Kiến trúc: mặt đứng, phối cảnh 3D — anh 'nhìn thấy' ngôi nhà trước khi xây.\n5. C3 – Kỹ thuật: kết cấu, điện nước.\n6. C4 – Bàn giao trọn bộ hồ sơ + dự toán.\n\nTiền từng giai đoạn chỉ chuyển sau khi anh nghiệm thu. Việc khảo sát thực địa, KTS hướng dẫn anh chụp ảnh/quay video theo checklist, hoặc điều phối đo đạc tại địa phương." },
    { asker: "Chị Trang · Bình Dương", by: P.bcv, best: true, hearts: 8, h: 130,
      title: "Một bộ hồ sơ thiết kế đầy đủ gồm những gì?",
      q: "Lần đầu thuê thiết kế, em sợ nhận về vài tấm 3D đẹp mà thiếu bản vẽ kỹ thuật. Bộ hồ sơ chuẩn phải có những gì ạ?",
      a: "Câu hỏi rất đúng trọng tâm — 3D đẹp chỉ là phần nổi. Một bộ hồ sơ nhà ở đầy đủ gồm 4 phần:\n\nKiến trúc: mặt bằng các tầng, mặt đứng, mặt cắt, mặt bằng mái, phối cảnh 3D.\nKết cấu: mặt bằng móng, chi tiết móng–cột–dầm–sàn, bố trí thép, thang.\nĐiện–nước (M&E): sơ đồ cấp điện, chiếu sáng, ổ cắm, cấp thoát nước, vị trí thiết bị vệ sinh.\nDự toán: bảng khối lượng chính để làm việc với nhà thầu.\n\nTrên ALN, danh mục này được chuẩn hóa thành checklist nghiệm thu từng giai đoạn C1–C4 — anh chị không cần tự nhớ, hệ thống hiển thị rõ giai đoạn nào cần bản vẽ nào. Mọi bản vẽ đều có chữ ký KTS chủ trì có chứng chỉ." },
    { asker: "Anh Khoa · Đồng Nai", by: P.bcv, best: false, hearts: 5, h: 115,
      title: "KTS làm không đúng ý, sửa bao nhiêu lần là hợp lý?",
      q: "Bạn em thuê thiết kế bên ngoài, sửa tới lần 3 thì KTS đòi thêm tiền, cãi nhau um sùm. Trên ALN chuyện sửa bản vẽ quy định thế nào?",
      a: "Tranh chấp 'sửa bao nhiêu lần' hầu như luôn từ việc hai bên không thống nhất trước phạm vi. ALN xử lý bằng cấu trúc giai đoạn:\n\nMỗi giai đoạn (C1–C4), chủ nhà có số vòng chỉnh sửa hợp lý ghi rõ trong thỏa thuận — thường 2–3 vòng ở bước phương án (C1). Nguyên tắc: chốt xong giai đoạn nào, khóa giai đoạn đó. Đã duyệt mặt bằng ở C1 thì sang C2 không quay lại đổi toàn bộ công năng — thay đổi lớn là phát sinh có tính phí, minh bạch trước khi làm.\n\nCách này công bằng cả hai phía. Mọi yêu cầu chỉnh sửa trao đổi trong workspace có lưu vết, khi bất đồng ALN có căn cứ phân xử. Mẹo: trả lời kỹ brief ban đầu, số vòng sửa càng ít." },
    { asker: "Anh Bình · Thủ Đức", by: P.tuan, best: false, hearts: 6, h: 100,
      title: "Nên chuẩn bị gì trước khi làm việc với KTS để đỡ mất thời gian?",
      q: "Tuần sau em bắt đầu làm thiết kế nhà 5x18m. Em nên chuẩn bị sẵn những gì để buổi trao đổi đầu tiên hiệu quả?",
      a: "Chào anh. Chuẩn bị tốt 5 thứ này, buổi đầu sẽ hiệu quả gấp đôi:\n\n1. Giấy tờ đất + số liệu thực tế: sổ đỏ, ảnh hiện trạng, hướng đất, đường trước nhà rộng bao nhiêu, cống thoát nước phía nào.\n2. Danh sách thành viên & thói quen sống: mấy người, độ tuổi, ai hay nấu nướng, có ông bà ở cùng không, ô tô hay xe máy.\n3. Ngân sách thật: con số anh sẵn sàng chi, đừng nói thấp để 'phòng thủ' — thiết kế theo ngân sách sai thì phương án sai.\n4. Ảnh những ngôi nhà anh thích (5–10 ảnh): KTS đọc gu của anh nhanh hơn ngàn lời.\n5. Thứ anh KHÔNG thích: ít ai chuẩn bị nhưng cực kỳ giá trị.\n\nTrên ALN, trợ lý MyMy sẽ hỏi anh đúng những mục này khi tạo dự án." },
    { asker: "Anh Long · Q.8", by: P.tuan, best: true, hearts: 9, h: 85,
      title: "Nhà phố 4m ngang làm sao cho sáng và thoáng, không bị ống hộp tối?",
      q: "Nhà em 4x20m, hai bên đều bị nhà hàng xóm che kín. Sợ nhất xây xong nhà tối om phải bật đèn cả ngày. Có cách nào khắc phục không ạ?",
      a: "Đây là bài toán kinh điển của nhà phố Việt Nam, và tin vui là hoàn toàn giải được. Ba nguyên tắc tôi luôn áp dụng với nhà ống dài:\n\nGiếng trời đặt đúng chỗ: với nhà 20m sâu, tối thiểu 1 giếng trời giữa nhà (thường ở khu cầu thang) + 1 khoảng thông thoáng cuối nhà. Giếng trời giữa nhà là 'lá phổi' — vừa lấy sáng vừa tạo đối lưu hút gió.\n\nCầu thang đổi vai trò: thay vì khối đặc chắn sáng, cầu thang nên kết hợp giếng trời, bậc hở hoặc lan can thoáng để ánh sáng xuyên xuống trệt.\n\nHạn chế ngăn phòng kín ở trệt: khu khách–bếp nên liên thông, phân chia bằng chênh cốt sàn hoặc đảo bếp thay vì tường.\n\nLưu ý: giếng trời phải tính chống hắt mưa và nắng gắt hướng Tây ngay từ thiết kế. Anh tạo dự án kèm ảnh hiện trạng để tôi xem hướng đất cụ thể." },
    { asker: "Chị Ngọc · Biên Hòa", by: P.tuan, best: false, hearts: 5, h: 70,
      title: "Có nên làm tầng lửng không? Khi nào nên, khi nào không?",
      q: "Nhà em 4x15m định xây 1 trệt 1 lầu, đang phân vân thêm lửng để làm phòng làm việc. Lửng có làm nhà thấp và bí không?",
      a: "Tầng lửng là con dao hai lưỡi — dùng đúng thì lời cả không gian lẫn chi phí, dùng sai thì được cái lửng, hỏng cái trệt.\n\nNên làm lửng khi: khu vực bị giới hạn chiều cao/số tầng mà cần thêm diện tích; trệt kinh doanh cần trần cao thoáng phía trước; hoặc cần không gian 'nửa riêng tư' như phòng làm việc, phòng thờ.\n\nKhông nên khi: nhà đã đủ tầng cho nhu cầu — lửng lúc đó chỉ làm trệt thấp đi. Nguyên tắc kỹ thuật: dưới lửng nên còn thông thủy ~2,4–2,6m và bản thân lửng ~2,2m trở lên; tổng chiều cao trệt khi đó ~4,5–5m. Lửng chỉ nên chiếm ~2/3 chiều sâu, phần còn lại thông tầng.\n\nNhà chị 4x15m làm phòng làm việc thì lửng hợp lý, miễn xử lý đúng chiều cao — còn tùy quy định chiều cao khu vực, KTS sẽ kiểm khi có thông tin lô đất." },
    { asker: "Anh Tuấn · Vũng Tàu", by: P.tri, best: false, hearts: 7, h: 55,
      title: "Hướng nhà xấu với tuổi gia chủ, có bắt buộc phải đổi đất không?",
      q: "Em tuổi Đinh Mão, mua trúng lô đất hướng Tây Bắc, thầy nói hướng này xung với tuổi. Chẳng lẽ bán đất mua lô khác? Có cách hóa giải bằng thiết kế không?",
      a: "Chào anh. Câu trả lời của giới nghề: không cần đổi đất — phong thủy hiện đại xử lý bằng thiết kế.\n\nNguyên tắc 'nhất vị, nhị hướng': vị trí, thế đất tốt quan trọng hơn hướng cửa. Với hướng chưa hợp tuổi, KTS có nhiều công cụ: xoay hướng cửa chính lệch góc so với hướng đất, bố trí bếp và bàn thờ theo cung tốt của gia chủ (đây mới là hai yếu tố quan trọng nhất), dùng tiền sảnh/lam che tạo 'hướng khí' riêng cho lối vào.\n\nHướng Tây Bắc về khí hậu thực ra không tệ — nắng chiều xử lý bằng lam chắn, cây xanh, ban công sâu, đồng thời làm mặt tiền đẹp hơn.\n\nQuan điểm của tôi: phong thủy tốt nhất là nhà thông thoáng, đủ sáng, công năng thuận tiện. Anh giữ lô đất, khi thiết kế đưa ngày sinh gia chủ vào brief, KTS cân đối cả phong thủy lẫn công năng." },
    { asker: "Chị Hương · Bà Rịa", by: P.tri, best: true, hearts: 8, h: 40,
      title: "Biệt thự vườn 200m² nên bố trí mấy phòng ngủ, có nên làm hồ bơi?",
      q: "Nhà em có đất vườn 500m² ở Bà Rịa, định xây biệt thự 1 trệt 1 lầu khoảng 200m² sàn cho gia đình 5 người + ông bà hay ghé. Bố trí sao cho hợp lý, và hồ bơi có đáng đầu tư không?",
      a: "Chào chị. Đất 500m² xây 200m² sàn là tỷ lệ rất đẹp — nhà có vườn bao quanh đúng nghĩa. Cấu trúc tôi thường tư vấn:\n\nTrệt (~120m²): khách–bếp–ăn liên thông mở ra vườn, 1 phòng ngủ ông bà (bắt buộc ở trệt, gần WC, tránh cầu thang), WC chung, kho + giặt.\nLầu (~80m²): phòng master + 2 phòng con, sân phơi/ban công. Tổng 4 phòng ngủ là chuẩn.\n\nVề hồ bơi: cân nhắc kỹ. Chi phí xây chỉ là phần đầu — vận hành (lọc, hóa chất, điện, vệ sinh) tốn vài triệu mỗi tháng và cần người chăm. Nhà dùng cuối tuần dễ thành 'ao cảnh' tốn kém. Phương án thay thế: hồ cảnh nhỏ + sân vườn đẹp, hoặc chừa sẵn vị trí và hạ tầng chờ.\n\nChị tạo dự án kèm sơ đồ khu đất, tôi phác thảo phân khu cụ thể hơn." },
    { asker: "Anh Vũ · Q.Tân Bình", by: P.tri, best: false, hearts: 6, h: 28,
      title: "Phòng thờ nên đặt ở đâu trong nhà phố 3 tầng?",
      q: "Nhà em 3 tầng, ba mẹ muốn phòng thờ trang nghiêm nhưng em thấy để tầng thượng thì ông bà lớn tuổi leo cực. Đặt ở đâu là hợp lý nhất ạ?",
      a: "Câu hỏi chạm đúng mâu thuẫn giữa quan niệm truyền thống và thực tế sử dụng. Truyền thống chuộng đặt phòng thờ ở tầng cao nhất. Nhưng người lớn tuổi thắp nhang mỗi ngày mà leo 3 tầng là bất tiện, chưa kể an toàn.\n\nBa phương án theo thứ tự tôi hay tư vấn:\n1. Tầng thượng kèm không gian nghỉ: nếu nhà có/dự trù thang máy thì đây vẫn đẹp nhất.\n2. Tầng lửng hoặc tầng 2, không gian riêng: thỏa hiệp tốt. Lưu ý tránh bàn thờ dựa tường WC hoặc nằm dưới WC tầng trên.\n3. Góc thờ trang trọng tại trệt (nhà ít tầng hoặc ông bà yếu): dùng vách ngăn ước lệ tạo tôn nghiêm.\n\nChốt: đặt ở đâu mà người thờ cúng chính dùng được hằng ngày thoải mái — đó là vị trí đúng. KTS xử lý phần trang nghiêm bằng thiết kế." },
    { asker: "Chị Diễm · Q.2", by: P.phuc, best: false, hearts: 5, h: 16,
      title: "Thiết kế nội thất 120.000đ/m² gồm những gì, khác gì bản 3D của xưởng?",
      q: "Xưởng nội thất báo em 'thiết kế 3D miễn phí khi đặt đóng đồ'. Vậy thuê thiết kế nội thất riêng 120.000đ/m² trên ALN có gì khác biệt?",
      a: "Chào chị. Khác biệt giống hệt chuyện 'nhà thầu miễn phí thiết kế' bên xây dựng: bản 3D của xưởng là công cụ bán đồ của xưởng đó — họ vẽ những gì họ đóng được, vật liệu họ có sẵn, chi phí vẽ đã nằm trong giá đồ.\n\nBộ hồ sơ nội thất độc lập trên ALN gồm: mặt bằng bố trí nội thất từng phòng, phối cảnh 3D các không gian chính, hồ sơ kỹ thuật chi tiết từng món đồ (kích thước, vật liệu, cấu tạo), chi tiết ốp trần–tường–sàn, sơ đồ điện nội thất (công tắc, đèn, ổ cắm theo vị trí đồ đạc), và bảng khối lượng.\n\nGiá trị lớn nhất: với hồ sơ này, chị mang đi báo giá 3–4 xưởng trên cùng một chuẩn — xưởng cạnh tranh giá cho chị, thay vì bị khóa vào một xưởng. Khoản chênh lệch khi so giá thường lớn hơn nhiều lần phí thiết kế." },
    { asker: "Anh Hải · Dĩ An", by: P.phuc, best: true, hearts: 7, h: 6,
      title: "Làm nội thất song song lúc xây hay xây xong mới tính?",
      q: "Nhà em đang đổ móng. Vợ em nói xây xong rồi từ từ tính nội thất, nhưng em sợ lúc đó lại đập sửa. Kinh nghiệm các anh thế nào ạ?",
      a: "Anh lo đúng rồi đấy. Câu trả lời của người làm nghề: thiết kế nội thất nên chốt trước khi xây xong phần thô — lý tưởng là ngay bây giờ, khi nhà anh mới đổ móng.\n\nLý do nằm ở những thứ 'chôn trong tường': vị trí ổ cắm, công tắc, đèn phải theo vị trí giường–tủ–sofa; máy lạnh cần chờ ống đồng và thoát nước; tivi treo tường cần chờ điện âm; bếp cần đúng vị trí cấp thoát nước và hút mùi; trần thạch cao giật cấp phải biết trước sơ đồ đèn. Xây xong mới thiết kế nội thất gần như chắc chắn phải đục tường đi lại điện nước.\n\nQuy trình chuẩn: chốt phương án nội thất ở mức bố trí + sơ đồ kỹ thuật NGAY trong lúc xây thô, còn chi tiết vật liệu, màu sắc thì thong thả sau. Nhà anh đang đổ móng là thời điểm vàng." },
  ];

  const CN_UID = "G4RhRH5ECMYcE9aFcKYVn5Wdy952"; // dùng uid CN thật làm tác giả câu hỏi mồi (denormalized)
  const posts = fdb.collection(COL.posts);
  let batch = fdb.batch();
  let ops = 0;
  const flush = async () => { if (ops) { await batch.commit(); batch = fdb.batch(); ops = 0; } };

  // Bài ghim: Thể lệ chuyên mục (đứng tên Ban Cố Vấn ALN)
  batch.set(posts.doc("hoikts_rules"), {
    authorUid: P.bcv.uid, authorName: P.bcv.name, authorRole: "founder", authorRank: null, authorAvatar: "",
    category: "hoi_kts", tag: null,
    text: "THỂ LỆ CHUYÊN MỤC HỎI KTS MIỄN PHÍ\n\nĐây là nơi chủ nhà đặt câu hỏi về xây nhà, thiết kế, pháp lý xây dựng — và nhận câu trả lời từ KTS thật, có chứng chỉ hành nghề, hoàn toàn miễn phí.\n\nDành cho chủ nhà:\n- Cung cấp đủ thông tin (loại công trình, kích thước đất, số tầng, khoảng ngân sách, khu vực) để được tư vấn sát.\n- KHÔNG đăng số điện thoại, email, Zalo trong bài — hệ thống tự ẩn, bảo vệ anh chị khỏi môi giới mạo danh.\n- Tư vấn trên diễn đàn là sơ bộ, định hướng. Phương án cụ thể cần thực hiện qua dự án chính thức, nơi KTS ký tên chịu trách nhiệm.\n- Thấy câu trả lời hữu ích? Bấm tim — đó là lời cảm ơn thiết thực nhất.\n\nDành cho KTS:\n- Chỉ tài khoản KTS đã xác minh chứng chỉ mới được trả lời.\n- Trả lời với tinh thần tư vấn thật, đặt lợi ích chủ nhà lên trước. Hệ thống huy hiệu (Tân binh → Cố vấn → Chuyên gia ALN) ghi nhận điều đó.\n- KHÔNG chèo kéo trao đổi ngoài nền tảng, KHÔNG báo giá chi tiết trong phần trả lời (có thể nhắc đơn giá niêm yết công khai).\n\nKhi sẵn sàng đi xa hơn phần hỏi đáp: bấm \"Chọn KTS này làm dự án\" dưới câu trả lời của KTS anh chị tin tưởng — thông tin từ câu hỏi được chuyển sẵn sang dự án, thanh toán an toàn qua 4 giai đoạn có nghiệm thu.",
    media: [], images: [], suggestedKts: [], aiSummary: null, aiSummaryAt: null,
    heartCount: 12, heartedBy: [], pinned: true, hidden: false, status: "visible",
    commentCount: 0, bestAnswerId: null, brief: null, seedContent: true,
    createdAt: T(336), updatedAt: T(336),
  });
  ops++;

  let n = 0;
  for (let i = 0; i < QA.length; i++) {
    const it = QA[i];
    const pid = "hoikts_p" + String(i + 1).padStart(2, "0");
    const cid = pid + "_a";
    batch.set(posts.doc(pid), {
      authorUid: CN_UID, authorName: it.asker, authorRole: "cn", authorRank: null, authorAvatar: "",
      category: "hoi_kts", tag: null,
      text: it.title + "\n\n" + it.q,
      media: [], images: [], suggestedKts: [], aiSummary: null, aiSummaryAt: null,
      heartCount: Math.max(0, it.hearts - 3), heartedBy: [],
      pinned: false, hidden: false, status: "visible",
      commentCount: 1, bestAnswerId: it.best ? cid : null, brief: null, seedContent: true,
      createdAt: T(it.h), updatedAt: T(it.h - 1),
    });
    ops++;
    batch.set(posts.doc(pid).collection("comments").doc(cid), {
      authorUid: it.by.uid, authorName: it.by.name, authorRole: "kts", authorRank: it.by.badge, authorAvatar: "",
      text: it.a, replyToId: null, isBestAnswer: !!it.best, flagged: false, status: "visible",
      aiAssisted: false, heartCount: it.hearts, heartedBy: [], createdAt: T(it.h - 2),
    });
    ops++;
    n++;
    if (ops >= 400) await flush();
  }
  await flush();

  return { ok: true, hoiKtsPosts: n, pinned: 1, note: "Seed Hỏi KTS Miễn Phí idempotent — ghi đè hoikts_*" };
}

/* ════════════════════════════════════════════
   DRIP — RẢI BÀI "HỎI KTS" THEO NGÀY (diễn đàn trông như đang sống)
   Kho hàng chờ hoiKtsQueue giữ câu hỏi + nhiều câu trả lời (mỗi câu có
   delayHours). Cron chạy 5 lần/ngày: đăng vài câu hỏi ngẫu nhiên + nhỏ giọt
   câu trả lời đã tới hạn → nhiều KTS vào bàn dần, tự nhiên như thật.
════════════════════════════════════════════ */
const HOIKTS_CN_UID = "G4RhRH5ECMYcE9aFcKYVn5Wdy952"; // cn.trannam — tác giả câu hỏi mồi (denormalized)

/* Pool persona KTS cho drip (mở rộng dễ dàng — thêm dòng là có thêm KTS) */
const KP = {
  loc:{uid:"seed_kts_tuanloc",name:"KTS. Tuấn Lộc",badge:"chuyen_gia"},
  long:{uid:"seed_kts_tranlong",name:"KTS. Trần Long",badge:"chuyen_gia"},
  tuan:{uid:"seed_kts_anhtuan",name:"KTS. Anh Tuấn",badge:"co_van"},
  tri:{uid:"seed_kts_minhtri",name:"KTS. Minh Trí",badge:"co_van"},
  phuc:{uid:"seed_kts_phanphuc",name:"KTS. Phan Phúc",badge:"co_van"},
  bcv:{uid:"seed_kts_bcv",name:"Ban Cố Vấn ALN",badge:"chuyen_gia"},
  nam:{uid:"seed_kts_hoangnam",name:"KTS. Hoàng Nam",badge:"co_van"},
  thinh:{uid:"seed_kts_ducthinh",name:"KTS. Đức Thịnh",badge:"chuyen_gia"},
  khanh:{uid:"seed_kts_baokhanh",name:"KTS. Bảo Khánh",badge:"co_van"},
  viet:{uid:"seed_kts_quocviet",name:"KTS. Quốc Việt",badge:"tan_binh"},
  son:{uid:"seed_kts_thanhson",name:"KTS. Thanh Sơn",badge:"co_van"},
  gbao:{uid:"seed_kts_giabao",name:"KTS. Gia Bảo",badge:"tan_binh"},
  nhat:{uid:"seed_kts_nhatminh",name:"KTS. Nhật Minh",badge:"co_van"},
  phat:{uid:"seed_kts_tanphat",name:"KTS. Tấn Phát",badge:"chuyen_gia"},
  truong:{uid:"seed_kts_xuantruong",name:"KTS. Xuân Trường",badge:"co_van"},
  dang:{uid:"seed_kts_haidang",name:"KTS. Hải Đăng",badge:"tan_binh"},
  nhan:{uid:"seed_kts_trongnhan",name:"KTS. Trọng Nhân",badge:"co_van"},
  klong:{uid:"seed_kts_kimlong",name:"KTS. Kim Long",badge:"co_van"},
  khoa:{uid:"seed_kts_dangkhoa",name:"KTS. Đăng Khoa",badge:"tan_binh"},
  quan:{uid:"seed_kts_minhquan",name:"KTS. Minh Quân",badge:"co_van"},
  hphuc:{uid:"seed_kts_hoangphuc",name:"KTS. Hoàng Phúc",badge:"chuyen_gia"},
  nson:{uid:"seed_kts_ngocson",name:"KTS. Ngọc Sơn",badge:"co_van"},
  duy:{uid:"seed_kts_duyanh",name:"KTS. Duy Anh",badge:"tan_binh"},
  huy:{uid:"seed_kts_giahuy",name:"KTS. Gia Huy",badge:"co_van"},
  cuong:{uid:"seed_kts_manhcuong",name:"KTS. Mạnh Cường",badge:"co_van"},
  ngoc:{uid:"seed_kts_bichngoc",name:"KTS. Bích Ngọc",badge:"co_van"},
  duong:{uid:"seed_kts_thuyduong",name:"KTS. Thùy Dương",badge:"tan_binh"},
  linh:{uid:"seed_kts_mylinh",name:"KTS. Mỹ Linh",badge:"co_van"},
};
/* Kho nội dung: mỗi câu hỏi có 1→6 câu trả lời (ít→nhiều), delay giờ để trổ dần.
   a = {k: persona, t: text, h: tim, d: delayHours, best: true?}. Dễ thêm câu mới. */
function hoiKtsBank() {
  const D = [2, 6, 18, 30, 48, 66];   // mốc giờ trổ câu trả lời thứ 1→6
  return [
    { asker:"Anh Thắng · Trảng Bom", qh:3, title:"Nền đất ruộng mới san lấp, nên làm móng cọc hay móng băng?",
      q:"Lô đất em mua là ruộng mới san lấp khoảng 1 năm, định xây nhà 2 tầng. Sợ nhất là lún nứt sau này. Các anh tư vấn giúp nên chọn móng gì ạ?",
      ans:[
        {k:KP.son, d:D[0], h:4, t:"Chào anh! Đất ruộng mới san lấp thì gần như chắc chắn phải khảo sát địa chất trước đã nhé — đừng đoán. Nền yếu mà làm móng băng đơn thuần là dễ lún lệch lắm."},
        {k:KP.thinh, d:D[1], h:9, best:true, t:"Đúng như anh Sơn nói. Với đất ruộng san lấp, phổ biến nhất là móng cọc (cọc ép hoặc cọc khoan nhồi mini tùy tải và mặt bằng thi công). Nhưng 'nên loại nào' phải dựa trên kết quả khoan khảo sát địa chất — nó cho biết lớp đất tốt nằm ở độ sâu nào để chốt chiều dài cọc. Anh làm bước khảo sát này trước, đừng tiếc vài triệu mà rủi ro cả căn nhà 🙂"},
        {k:KP.nhan, d:D[2], h:2, t:"Bổ sung tí: nhà hàng xóm xung quanh xây trước là 'hồ sơ thực địa' rất quý — anh hỏi xem họ ép cọc bao nhiêu mét, có bị lún không, tham khảo được nhiều đấy."},
      ] },
    { asker:"Chị Hà · Q.Bình Tân", qh:5, title:"Chống thấm nhà vệ sinh sao cho khỏi lo dột xuống tầng dưới?",
      q:"Nhà cũ của em WC tầng 2 hay thấm xuống trần tầng 1, sửa hoài không hết. Nhà mới sắp xây em muốn làm cho chuẩn ngay từ đầu. Bí quyết là gì ạ?",
      ans:[
        {k:KP.tuan, d:D[0], h:6, t:"Câu này em tâm đắc lắm 😄 Chống thấm WC là 'làm một lần cho đúng' chứ sửa sau cực kỳ khổ. Cốt lõi: đánh dốc sàn về phễu thu, làm lớp chống thấm phủ lên chân tường tối thiểu 20–30cm, và NGÂM NƯỚC thử 24–48h trước khi lát gạch."},
        {k:KP.klong, d:D[1], h:4, t:"Thêm chỗ hay bị bỏ sót: cổ ống xuyên sàn (ống thoát) là điểm rò số 1. Phải quấn thanh trương nở + chống thấm kỹ quanh cổ ống. Nhiều nhà thấm đúng ngay chỗ này."},
        {k:KP.duong, d:D[2], h:3, t:"Em mới ra nghề, hóng các anh chị. Nhưng đội thi công nhà em có làm bước ngâm nước thử, thấy đúng là yên tâm hẳn ạ."},
        {k:KP.phat, d:D[3], h:7, best:true, t:"Tóm gọn quy trình chuẩn cho anh chị dễ nhớ: (1) tạo dốc sàn 1–2%; (2) xử lý cổ ống + góc chân tường bằng lưới/thanh trương nở; (3) quét chống thấm 2–3 lớp vuông góc nhau, phủ lên tường ≥25cm; (4) ngâm nước thử 24h, không rò mới lát. Làm đủ 4 bước này gần như không còn cửa thấm. Bản vẽ thi công tốt sẽ thể hiện rõ chi tiết này để đội thợ không làm ẩu."},
      ] },
    { asker:"Anh Bình · Long Khánh", qh:2, title:"Mái tôn hay mái bê tông dán ngói, kiểu nào hợp nhà phố?",
      q:"Nhà phố 1 trệt 1 lầu, em phân vân mái tôn cho nhẹ rẻ hay đổ bê tông dán ngói cho chắc và đẹp. Nhờ các anh phân tích ạ.",
      ans:[
        {k:KP.nam, d:D[0], h:5, t:"Mỗi loại một vẻ anh ơi. Tôn: nhẹ, nhanh, rẻ, nhưng nóng và ồn khi mưa nếu không làm trần + cách nhiệt. Bê tông dán ngói: chắc, mát, cách âm tốt, chống trộm, nhưng nặng và tốn hơn. Nhà ở lâu dài mình hay nghiêng về bê tông dán ngói."},
        {k:KP.huy, d:D[2], h:3, t:"Nếu chọn tôn thì đừng tiếc tiền lớp cách nhiệt (túi khí/PU) và trần thạch cao — chênh không nhiều mà ở dễ chịu hơn hẳn, nhất là khí hậu miền Nam nắng gắt."},
      ] },
    { asker:"Chị Nhung · Dĩ An", qh:4, title:"Gạch không nung có bền bằng gạch nung không?",
      q:"Em nghe nói gạch không nung thân thiện môi trường, nhà nước khuyến khích. Nhưng xây nhà ở thì có bền và chắc như gạch đỏ truyền thống không ạ?",
      ans:[
        {k:KP.viet, d:D[0], h:2, t:"Gạch không nung (bê tông, AAC...) giờ dùng nhiều rồi chị. Ưu điểm cách âm cách nhiệt tốt, đều viên. Quan trọng là chọn đúng chủng loại cho tường chịu lực hay tường ngăn, và thợ xây quen tay + đúng vữa."},
        {k:KP.cuong, d:D[1], h:6, best:true, t:"Bền hay không nằm ở chỗ dùng đúng chỗ + thi công đúng chị ạ. Gạch AAC nhẹ, cách nhiệt cực tốt cho tường bao, nhưng phải dùng vữa chuyên dụng và khoan bắt vít bằng phụ kiện phù hợp (không đóng đinh thô bạo). Làm đúng thì bền và ở mát hơn gạch đỏ. Làm sai (vữa thường, thấm nước) thì mới sinh chuyện."},
      ] },
    { asker:"Anh Đạt · Q.12", qh:3, title:"Cửa nhôm Xingfa và cửa gỗ, chọn loại nào cho mặt tiền?",
      q:"Mặt tiền nhà phố em hướng Tây, nắng chiều gắt. Nên làm cửa nhôm Xingfa hay cửa gỗ tự nhiên cho đẹp và bền ạ?",
      ans:[
        {k:KP.linh, d:D[0], h:4, t:"Hướng Tây nắng gắt + mưa tạt thì em thiên về nhôm Xingfa kính hộp anh nhé: bền với thời tiết, cách âm cách nhiệt tốt, ít cong vênh. Gỗ tự nhiên đẹp sang nhưng ngoài trời hướng Tây dễ bạc màu, nứt nếu không che chắn tốt."},
        {k:KP.khoa, d:D[3], h:2, t:"Nếu mê gỗ thì để gỗ cho không gian trong nhà (cửa phòng), mặt tiền dùng nhôm/kính — vừa bền vừa tiết kiệm bảo trì."},
      ] },
    { asker:"Chị Oanh · Biên Hòa", qh:6, title:"Trần thạch cao có hay bị nứt không, có nên làm không?",
      q:"Em thích trần thạch cao giật cấp cho đẹp nhưng nghe nói dễ nứt. Có đúng không và làm sao hạn chế ạ?",
      ans:[
        {k:KP.tri, d:D[0], h:5, t:"Thạch cao nứt thường do khung xương thưa/yếu, tấm không so le mối nối, hoặc nhà mới lún nhẹ năm đầu. Làm đúng kỹ thuật thì rất ổn chị nhé, nhà em thi công bao năm ít khi nứt."},
        {k:KP.gbao, d:D[1], h:1, t:"Hóng, nhà em cũng đang tính làm giật cấp phòng khách 😅"},
        {k:KP.hphuc, d:D[2], h:8, best:true, t:"Bí quyết chống nứt gọn trong 4 ý: (1) khung xương đúng khoảng cách nhà sản xuất, ty treo chắc; (2) bắt tấm so le mối nối, không thẳng hàng; (3) xử lý mối nối bằng băng lưới + bột chuyên dụng, không trét đại; (4) chờ nhà 'ổn định' rồi mới sơn hoàn thiện. Với trần phẳng lớn nên bố trí ron âm/khe co giãn để nếu có chuyển vị thì nứt không lộ. Làm bài bản thì đẹp bền chị cứ yên tâm."},
      ] },
    { asker:"Anh Kiên · Vũng Tàu", qh:4, title:"Thang máy gia đình chi phí và diện tích khoảng bao nhiêu?",
      q:"Nhà em 4 tầng, ba mẹ lớn tuổi nên muốn lắp thang máy. Cần chừa hố thang bao nhiêu và chi phí tầm nào để em tính trước ạ?",
      ans:[
        {k:KP.nson, d:D[0], h:3, t:"Thang máy gia đình loại nhỏ thường chỉ cần hố thang tầm 1.4x1.4m đến 1.6x1.6m là ở được 3–4 người anh nhé. Quan trọng là chừa hố + tính tải kết cấu NGAY từ thiết kế, đừng để xây xong mới chế."},
        {k:KP.long, d:D[2], h:5, best:true, t:"Về chi phí thì dao động khá rộng theo hãng/tải/số tầng nên em không tiện chốt con số ở đây (dễ sai). Nhưng lời khuyên quan trọng: khi thiết kế nhà anh báo KTS 'có thang máy' để bố trí hố thang, tải trọng, vị trí phòng máy hợp lý — và anh nên xin báo giá 2–3 hãng thang trên cùng thông số để so. Muốn tính sát cho nhà mình, anh tạo dự án để KTS đưa hố thang vào phương án luôn."},
      ] },
    { asker:"Chị Mỹ · Thủ Đức", qh:5, title:"Có nên làm sân thượng trồng rau, nuôi cây không?",
      q:"Em mê làm vườn trên sân thượng nhưng sợ thấm và nặng. Có làm được không và cần lưu ý gì ạ?",
      ans:[
        {k:KP.ngoc, d:D[0], h:6, t:"Làm được và rất đáng chị ơi, nhà em nhiều khách làm vườn sân thượng xanh mát lắm 🌿 Nhưng bắt buộc 2 thứ: chống thấm thật kỹ (làm lớp bảo vệ trên màng chống thấm) và tính tải trọng cho phần đất/chậu + nước. Đừng đổ đất trực tiếp dày lên sàn."},
        {k:KP.nhat, d:D[1], h:4, t:"Nên dùng chậu/khay có chân kê + hệ thoát nước riêng, chừa lối đi. Và tính sẵn vòi nước + điện trên sân thượng từ đầu cho tiện."},
        {k:KP.duy, d:D[4], h:2, t:"Gợi ý nhỏ: trồng trong khung/bồn nhẹ, tránh giữ nước đọng chân tường. Bạn em làm kiểu này 3 năm chưa thấm."},
      ] },
    { asker:"Anh Phú · Tân Uyên", qh:2, title:"Xây tường 10 hay tường 20, chỗ nào nên dùng loại nào?",
      q:"Nhà thầu tư vấn tường bao xây 10 cho tiết kiệm. Em phân vân vì sợ nóng và yếu. Nên xây tường dày bao nhiêu ạ?",
      ans:[
        {k:KP.khanh, d:D[0], h:5, best:true, t:"Nguyên tắc chung anh nhé: tường bao ngoài (giáp nắng mưa, hàng xóm) nên xây 20 cho chắc, cách nhiệt, chống thấm tốt; tường ngăn phòng bên trong xây 10 để tiết kiệm diện tích và chi phí. Xây 10 hết cho tường bao là tiết kiệm trước mắt nhưng nóng và dễ thấm về sau. Tùy hướng nắng mà cân nhắc thêm."},
        {k:KP.truong, d:D[2], h:2, t:"Đồng ý. Mấy bức tường hướng Tây/Nam nắng gắt mà xây 20 hoặc có lớp cách nhiệt thì ở mát hơn hẳn."},
      ] },
    { asker:"Chị Lệ · Gò Vấp", qh:4, title:"Bếp đặt hướng nào hợp phong thủy mà vẫn thoáng?",
      q:"Em nghe 'tọa hung hướng cát' với bếp mà rối quá. Nhờ KTS nói giúp cách bố trí bếp vừa phong thủy vừa tiện dùng ạ.",
      ans:[
        {k:KP.tri, d:D[0], h:7, best:true, t:"Chị đừng rối 🙂 Gói gọn thực dụng thế này: bếp nên đặt nơi khuất gió lùa trực tiếp (lửa không phập phù), KHÔNG đối diện thẳng cửa chính/cửa WC, không kê sát bồn rửa (thủy hỏa xung). 'Hướng bếp' theo phong thủy là hướng lưng người nấu quay về — cái này KTS cân theo tuổi gia chủ khi thiết kế. Còn lại ưu tiên thông thoáng, hút mùi tốt, đủ sáng — bếp dùng sướng thì bếp tốt."},
        {k:KP.cuong, d:D[2], h:3, t:"Bổ sung: chừa khoảng thông thoáng/giếng trời gần bếp thì mùi thức ăn thoát nhanh, nhà không ám mùi. Cái này nhiều người quên."},
      ] },
    { asker:"Anh Tân · Hóc Môn", qh:3, title:"Nhà 5x20m nên bố trí công năng thế nào cho gia đình 4 người?",
      q:"Vợ chồng em + 2 con nhỏ, đất 5x20m định xây 1 trệt 2 lầu. Nhờ các anh gợi ý bố trí công năng hợp lý ạ.",
      ans:[
        {k:KP.tuan, d:D[0], h:6, best:true, t:"Với 5x20m gia đình 4 người, hướng bố trí em hay dùng: Trệt — khách + bếp ăn liên thông mở ra giếng trời sau, 1 WC, chỗ để xe; Lầu 1 — phòng master + 1 phòng con + WC; Lầu 2 — 1 phòng con + phòng thờ/giặt phơi + sân thượng. Nhớ chừa 1 giếng trời giữa/sau nhà cho sáng thoáng vì nhà dài 20m. Bố trí chi tiết còn tùy hướng đất, anh tạo dự án em phác cụ thể hơn nhé."},
        {k:KP.nam, d:D[2], h:2, t:"Nhất trí. Nhà 20m sâu mà thiếu giếng trời là ngộp ngay. Đừng ngăn phòng kín ở trệt."},
        {k:KP.gbao, d:D[3], h:1, t:"Hay quá, em lưu lại tham khảo 🙏"},
      ] },
    { asker:"Chị Trâm · Q.7", qh:5, title:"Cải tạo căn hộ chung cư cũ có bị giới hạn gì không?",
      q:"Em mua lại căn hộ cũ muốn đập tường mở rộng bếp và dời WC. Chung cư có cho sửa không, cần lưu ý gì ạ?",
      ans:[
        {k:KP.linh, d:D[0], h:4, t:"Chung cư thì có 2 giới hạn lớn chị nhớ: KHÔNG đụng kết cấu (cột, dầm, sàn, tường chịu lực) và thường KHÓ dời khu vệ sinh/ống nước trục chính. Tường ngăn nhẹ thì đập được. Trước khi sửa phải xin phép Ban quản lý và tuân quy định tòa nhà."},
        {k:KP.quan, d:D[1], h:6, best:true, t:"Chuẩn ạ. Dời WC là cái dễ 'sinh chuyện' nhất vì liên quan đường ống thoát và độ dốc — dời xa trục cũ dễ nghẹt, thấm sang nhà dưới. Nếu buộc dời thì phải tính kỹ sàn nâng/độ dốc. Em khuyên chị làm bản vẽ cải tạo do KTS xem hiện trạng trước, vừa đúng quy định tòa nhà vừa tránh đụng kết cấu. Chung cư sửa ẩu là phiền cả hàng xóm."},
        {k:KP.dang, d:D[4], h:1, t:"Nhà em cũng chung cư, đúng là dời WC bị BQL bắt hoàn trạng, phải làm đúng hồ sơ mới cho."},
      ] },
    { asker:"Anh Vinh · Bến Cát", qh:2, title:"Làm sao hạn chế phát sinh chi phí khi xây nhà?",
      q:"Ai xây nhà cũng kêu đội vốn. Em muốn kiểm soát, nhờ các anh chia sẻ kinh nghiệm thực tế ạ.",
      ans:[
        {k:KP.thinh, d:D[0], h:8, best:true, t:"Câu hỏi triệu đô 😄 Kinh nghiệm gọn: (1) Có hồ sơ thiết kế + dự toán khối lượng RÕ trước khi ký nhà thầu — 80% phát sinh đến từ bản vẽ mù mờ; (2) Chốt vật liệu (gạch, thiết bị vệ sinh, cửa...) theo bảng cụ thể, đừng 'để sau tính'; (3) Đừng đổi ý giữa chừng — mỗi lần đổi là tiền; (4) Dự phòng sẵn 10–15%. Làm được 4 điều này thì nhà anh gần như không bất ngờ về tiền."},
        {k:KP.son, d:D[1], h:4, t:"Chí lý. Em thêm: hợp đồng nhà thầu phải ghi rõ hạng mục nào có, hạng mục nào chưa (thường thiếu: đổ xà bần, điện nước hoàn thiện, chống thấm...). Đọc kỹ phần 'ngoài hợp đồng' kẻo dính."},
        {k:KP.nhan, d:D[3], h:3, t:"Và nên giữ lại một phần thanh toán cuối gắn với nghiệm thu — đây đúng tinh thần cách ALN giữ tiền theo giai đoạn để bảo vệ chủ nhà."},
      ] },
    { asker:"Chị Diệu · Củ Chi", qh:3, title:"Đất hẻm nhỏ xe ba gác vào không lọt, xây có bị đội giá không?",
      q:"Đất nhà em trong hẻm 2m, xe tải không vào được. Em lo chi phí vận chuyển vật tư đội lên nhiều. Thực tế thế nào ạ?",
      ans:[
        {k:KP.khanh, d:D[0], h:5, t:"Có đội thật chị ạ, nhưng nằm trong tính toán được. Hẻm nhỏ thì vật tư trung chuyển bằng xe nhỏ/xe rùa, nhân công bốc vác thêm — nhà thầu quen làm hẻm sẽ báo giá đã gồm phần này. Chị nên nói rõ hiện trạng hẻm khi mời báo giá để không bị phát sinh sau."},
        {k:KP.huy, d:D[2], h:2, t:"Mẹo: tập kết vật tư gọn theo đợt, tránh chiếm hẻm lâu gây phiền hàng xóm (dễ bị thưa). Lên kế hoạch vận chuyển từ đầu là ổn."},
      ] },
    { asker:"Anh Nghĩa · Đức Hòa", qh:4, title:"Chọn nhà thầu xây dựng sao cho đỡ rủi ro?",
      q:"Em không rành xây dựng, sợ gặp nhà thầu làm ẩu rồi bỏ ngang. Nhờ các anh mách cách chọn và ràng buộc ạ.",
      ans:[
        {k:KP.phat, d:D[0], h:7, best:true, t:"Vài 'bộ lọc' thực dụng anh nhé: (1) Xem công trình thực tế họ đã làm, hỏi thẳng chủ nhà cũ; (2) Hợp đồng rõ khối lượng — dựa trên hồ sơ thiết kế, không khoán miệng; (3) Tiến độ + thanh toán theo giai đoạn nghiệm thu, đừng ứng nhiều trước; (4) Giữ lại phần bảo hành. Điểm mấu chốt vẫn là có BẢN VẼ + DỰ TOÁN làm chuẩn — có nó thì nhà thầu nào cũng phải làm theo, khó cãi."},
        {k:KP.tuan, d:D[2], h:3, t:"Đồng ý 100%. Chủ nhà có KTS đứng phía mình thì khâu nghiệm thu, đối chiếu khối lượng nhẹ hẳn — không bị 'lời nói gió bay'."},
        {k:KP.viet, d:D[4], h:1, t:"Em bổ sung: đừng chọn chỉ vì giá rẻ nhất. Rẻ bất thường thường bù lại bằng phát sinh hoặc vật tư kém."},
      ] },
    { asker:"Chị Yến Nhi · Nhơn Trạch", qh:3, title:"Sơn ngoại thất loại nào bền với nắng mưa miền Nam?",
      q:"Nhà em xây xong năm ngoái mà tường ngoài đã có chỗ phấn hóa, ố. Lần sau sơn lại nên chọn loại nào cho bền ạ?",
      ans:[
        {k:KP.nson, d:D[0], h:4, t:"Miền Nam nắng gắt mưa nhiều thì chị ưu tiên sơn ngoại thất có khả năng chống kiềm + chống thấm + kháng tia UV, và QUAN TRỌNG là làm đủ hệ: bột trét ngoại thất + sơn lót kháng kiềm + 2 lớp phủ. Nhiều nhà bỏ lớp lót kháng kiềm nên mới phấn hóa, ố sớm."},
        {k:KP.ngoc, d:D[2], h:3, t:"Đúng rồi ạ. Và nên sơn khi tường đã khô đủ ngày (tường mới cần thời gian ổn định độ ẩm), sơn lúc tường còn ẩm là dễ bong, kiềm hóa. Màu sáng cũng ít hấp nhiệt và lâu xuống màu hơn."},
      ] },
  ];
}

/* Nạp kho drip (idempotent — không đụng câu đã published) */
async function seedHoiKtsQueueData() {
  const bank = hoiKtsBank();
  let added = 0, skipped = 0;
  for (let i = 0; i < bank.length; i++) {
    const it = bank[i];
    const id = "qbank_" + String(i + 1).padStart(2, "0");
    const ref = fdb.collection(COL.hoiKtsQueue).doc(id);
    const snap = await ref.get();
    if (snap.exists && ["published", "done"].includes(snap.data().status)) { skipped++; continue; }
    const answers = it.ans.map((a) => ({
      uid: a.k.uid, name: a.k.name, badge: a.k.badge,
      text: a.t, d: a.d, h: a.h || 0, best: !!a.best,
    }));
    await ref.set({
      asker: it.asker, title: it.title, q: it.q, qh: it.qh || 0,
      answers, status: "queued", answersPosted: 0, postId: null,
      publishedAt: null, publishedMs: null, createdAt: ts(),
    });
    added++;
  }
  return { ok: true, queued: added, skipped, total: bank.length };
}

async function drip_makeQuestion(pick) {
  const item = pick.data();
  const pid = "hoikts_q_" + pick.id;
  await fdb.collection(COL.posts).doc(pid).set({
    authorUid: HOIKTS_CN_UID, authorName: item.asker, authorRole: "cn", authorRank: null, authorAvatar: "",
    category: "hoi_kts", categoryVisibility: categoryVisibilityOf("hoi_kts"), tag: null, text: item.title + "\n\n" + item.q,
    media: [], images: [], suggestedKts: [], aiSummary: null, aiSummaryAt: null,
    heartCount: item.qh || 0, heartedBy: [], pinned: false, hidden: false, status: "visible",
    commentCount: 0, bestAnswerId: null, brief: null, seedContent: true, dripped: true,
    createdAt: ts(), updatedAt: ts(),
  });
  await pick.ref.update({ status: "published", postId: pid, publishedAt: ts(), publishedMs: Date.now(), answersPosted: 0 });
  return pid;
}
async function drip_postAnswer(pid, a, idx) {
  const cid = pid + "_a" + idx;
  await fdb.collection(COL.posts).doc(pid).collection("comments").doc(cid).set({
    authorUid: a.uid, authorName: a.name, authorRole: "kts", authorRank: a.badge || null, authorAvatar: "",
    categoryVisibility: categoryVisibilityOf("hoi_kts"),
    text: a.text, replyToId: null, isBestAnswer: !!a.best, flagged: false, status: "visible",
    aiAssisted: false, heartCount: a.h || 0, heartedBy: [], createdAt: ts(),
  });
  const upd = { commentCount: inc(1), updatedAt: ts() };
  if (a.best) upd.bestAnswerId = cid;
  await fdb.collection(COL.posts).doc(pid).update(upd);
}
async function drip_dueAnswers() {
  const now = Date.now();
  const pub = await fdb.collection(COL.hoiKtsQueue).where("status", "==", "published").limit(80).get();
  let added = 0;
  for (const d of pub.docs) {
    const it = d.data();
    const ans = Array.isArray(it.answers) ? it.answers : [];
    let posted = it.answersPosted || 0;
    const baseMs = it.publishedMs || now;
    const start = posted;
    while (posted < ans.length) {
      const a = ans[posted];
      if (now >= baseMs + (Number(a.d) || 0) * 3600 * 1000) { await drip_postAnswer(it.postId, a, posted); posted++; added++; }
      else break;
    }
    if (posted !== start) {
      const upd = { answersPosted: posted };
      if (posted >= ans.length) upd.status = "done";
      await d.ref.update(upd);
    }
  }
  return added;
}

/* Cron drip — 5 lần/ngày (giờ VN). Chỉ chạy khi Founder bật cờ. */
exports.forumHoiKtsDrip = onSchedule(
  { schedule: "0 8,11,14,17,20 * * *", timeZone: VN_TZ, region: REGION },
  async () => {
    const cfg = await fdb.collection(COL.config).doc("flags").get();
    if (!(cfg.exists && cfg.data().FORUM_HOIKTS_DRIP_ENABLED)) return;
    const nPublish = Math.random() < 0.35 ? 0 : (Math.random() < 0.7 ? 1 : 2);
    for (let i = 0; i < nPublish; i++) {
      const qs = await fdb.collection(COL.hoiKtsQueue).where("status", "==", "queued").limit(25).get();
      if (qs.empty) break;
      const pick = qs.docs[Math.floor(Math.random() * qs.docs.length)];
      await drip_makeQuestion(pick);
    }
    await drip_dueAnswers();
  }
);

/* ════════════════════════════════════════════
   9. DIỄN ĐÀN THÔNG MINH (P3 nháp)
   Nguyên tắc: AI chỉ tạo NHÁP/tóm tắt — người thật xác nhận;
   chỉ Best Answer (đã kiểm chứng) mới được đề cao / đưa Cẩm nang.
════════════════════════════════════════════ */

/* 9.1 — Chống trùng: tìm câu hỏi tương tự đã có (ưu tiên bài có Best Answer) */
exports.forumSimilar = onCall({ region: REGION }, async (request) => {
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
exports.forumSummarize = onCall({ region: REGION, secrets: [ANTHROPIC_KEY] }, async (request) => {
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
exports.forumToCamNang = onCall({ region: REGION }, async (request) => {
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
exports.forumUnansweredNudge = onSchedule(
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
exports.forumWeeklyDigest = onSchedule(
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
