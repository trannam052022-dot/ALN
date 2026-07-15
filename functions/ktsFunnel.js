/**
 * ktsFunnel — phễu tuyển KTS + phễu lead chủ nhà chạy quảng cáo (asia-southeast1)
 *
 * 4 hàm phục vụ đo lường ads (2 hàm đầu cho KTS, hàm 3-4 cho chủ nhà — tái dùng
 * chung sendCapiEvent()):
 *
 * 1. submitKtsApplication (onCall) — kts-apply.html gọi sau khi đã tạo Auth user
 *    và upload file lên Storage phía client. Ghi users/{uid} + ktsApplications/{uid}
 *    SERVER-SIDE (không rơi rớt giữa chừng như 2 setDoc client cũ), cập nhật
 *    reservations/{uid} nếu KTS đi từ Phòng chờ, gửi email xác nhận ngay (giữ ấm lead),
 *    và bắn sự kiện CompleteRegistration lên Facebook Conversions API (server-side,
 *    không bị adblock/iOS chặn như Pixel).
 *
 * 2. onKtsReservationCreated (trigger reservations/{uid} onCreate) — bắn sự kiện Lead
 *    lên Conversions API khi có người giữ chỗ. event_id = 'lead-'+uid trùng với eventID
 *    Pixel phía client (phong-cho.html) → Facebook tự dedup, không đếm đôi.
 *
 * 4. onLeadCreated (trigger leads/{id} onCreate) — bắn sự kiện Lead lên Conversions
 *    API cho 3 phễu SEO chạy ads (tỉnh/mau/du-toan, xem functions/localLeads.js,
 *    mauLeads.js, duToanLeads.js) + lead diễn đàn (forum.js). event_id = 'lead-'+id
 *    trùng với eventID Pixel phía client ở 3 template tools/template-*.html.
 *
 * SECRET CẦN SET TRƯỚC KHI DEPLOY:
 *   firebase functions:secrets:set FB_CAPI_TOKEN
 *   (Token lấy ở Meta Events Manager → Pixel "ALN Pixel" 1656666692225878
 *    → Settings → Conversions API → Generate access token.)
 *   Nếu token rỗng: hàm vẫn chạy bình thường, chỉ bỏ qua phần bắn CAPI (log warn).
 *   SMTP_USER / SMTP_PASS dùng lại secret sẵn có của notifyKtsLeadEmail.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

if (!admin.apps.length) admin.initializeApp();

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const FB_CAPI_TOKEN = defineSecret("FB_CAPI_TOKEN");

const PIXEL_ID = "1656666692225878"; // ALN Pixel — trùng fbq('init') phía client
const SITE_URL = "https://applamnha.vn/";

/* ── Chuẩn hoá + băm SHA-256 theo yêu cầu user_data của Meta ── */
function sha256(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}
function hashPhone(phone) {
  // Meta yêu cầu SĐT dạng số kèm mã nước, không có 0 đầu: 0901... → 84901...
  let p = String(phone || "").replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = "84" + p.slice(1);
  else if (!p.startsWith("84")) p = "84" + p;
  return sha256(p);
}
function hashEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  return sha256(e);
}

/* Lọc object utm chỉ giữ 5 khoá chuẩn, cắt độ dài — chống ghi rác vào Firestore/CAPI */
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

/* ── Bắn 1 event lên Facebook Conversions API — lỗi KHÔNG được làm gãy flow chính ── */
async function sendCapiEvent(opts) {
  const token = FB_CAPI_TOKEN.value();
  if (!token || !token.trim()) {
    console.warn("[ktsFunnel] FB_CAPI_TOKEN chưa set — bỏ qua CAPI " + opts.eventName);
    return { ok: false, error: "no_token" };
  }
  const userData = {};
  const ph = hashPhone(opts.phone);
  const em = hashEmail(opts.email);
  if (ph) userData.ph = [ph];
  if (em) userData.em = [em];
  if (opts.fbp) userData.fbp = String(opts.fbp).slice(0, 200);
  if (opts.fbc) userData.fbc = String(opts.fbc).slice(0, 200);
  if (opts.ip) userData.client_ip_address = opts.ip;
  if (opts.ua) userData.client_user_agent = String(opts.ua).slice(0, 400);

  const utm = cleanUtm(opts.utm);
  const customData = {};
  if (utm.source) customData.utm_source = utm.source;
  if (utm.medium) customData.utm_medium = utm.medium;
  if (utm.campaign) customData.utm_campaign = utm.campaign;
  if (utm.content) customData.utm_content = utm.content;
  if (utm.term) customData.utm_term = utm.term;
  if (opts.contentName) customData.content_name = opts.contentName;

  const body = {
    data: [{
      event_name: opts.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      event_source_url: opts.sourceUrl || SITE_URL,
      action_source: "website",
      user_data: userData,
      custom_data: customData,
    }],
  };
  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = JSON.stringify(json).slice(0, 500);
    console.error("[ktsFunnel] CAPI " + opts.eventName + " lỗi:", msg);
    return { ok: false, error: msg };
  }
  console.log("[ktsFunnel] CAPI " + opts.eventName + " OK, event_id=" + opts.eventId);
  return { ok: true };
}

/* ══════════════════════════════════════════════════════════════════
   1. submitKtsApplication — thay 2 setDoc client trong kts-apply.html
   Client vẫn tự: tạo Auth user (username@aln.vn) + upload file Storage.
   Hàm này nhận dữ liệu hồ sơ + URL file đã upload, ghi Firestore atomic.
══════════════════════════════════════════════════════════════════ */
const VALID_BOMON = ["ARC", "STR", "ELE", "PLU", "ALL"];
const VALID_YEARS = ["<1", "1-3", "3-5", "5-10", ">10"];

exports.submitKtsApplication = onCall(
  { region: "asia-southeast1", secrets: [SMTP_USER, SMTP_PASS, FB_CAPI_TOKEN] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
    const uid = request.auth.uid;
    const d = request.data || {};

    /* ── Validate — chặt hơn client vì đây là cửa cuối ── */
    const name = String(d.name || "").trim().slice(0, 120);
    const phone = String(d.phone || "").trim().slice(0, 20);
    const email = String(d.email || "").trim().slice(0, 200);
    const boMon = String(d.boMon || "");
    const years = String(d.years || "");
    const cchn = String(d.cchn || "").trim().slice(0, 60);
    const bio = String(d.bio || "").trim().slice(0, 600);
    const username = String(d.username || "").trim().toLowerCase();
    const provinceHome = String(d.province_home || "").slice(0, 20);
    const provincesWork = Array.isArray(d.provinces_work)
      ? d.provinces_work.filter((p) => typeof p === "string").map((p) => p.slice(0, 20)).slice(0, 20)
      : [];
    const specialties = Array.isArray(d.specialties)
      ? d.specialties.filter((s) => typeof s === "string").map((s) => s.slice(0, 30)).slice(0, 10)
      : [];
    const urlOk = (u) => typeof u === "string" && /^https:\/\//.test(u);
    const avatarUrl = urlOk(d.avatarUrl) ? d.avatarUrl : "";
    const cvUrl = urlOk(d.cvUrl) ? d.cvUrl : "";
    const driveUrl = urlOk(d.driveUrl) ? String(d.driveUrl).slice(0, 500) : "";
    const certUrls = Array.isArray(d.certUrls) ? d.certUrls.filter(urlOk).slice(0, 10) : [];
    const utm = cleanUtm(d.utm);

    if (!name) throw new HttpsError("invalid-argument", "Thiếu họ tên");
    if (phone.replace(/\D/g, "").length < 9) throw new HttpsError("invalid-argument", "SĐT chưa hợp lệ");
    if (!VALID_BOMON.includes(boMon)) throw new HttpsError("invalid-argument", "Bộ môn chưa hợp lệ");
    if (!VALID_YEARS.includes(years)) throw new HttpsError("invalid-argument", "Kinh nghiệm chưa hợp lệ");
    if (!cchn) throw new HttpsError("invalid-argument", "Thiếu mã CCHN");
    if (bio.length < 20) throw new HttpsError("invalid-argument", "Giới thiệu tối thiểu 20 ký tự");
    if (!provinceHome) throw new HttpsError("invalid-argument", "Thiếu tỉnh nơi ở");
    if (!provincesWork.length) throw new HttpsError("invalid-argument", "Chọn ít nhất 1 khu vực nhận dự án");
    if (!specialties.length) throw new HttpsError("invalid-argument", "Chọn ít nhất 1 chuyên môn");
    if (!/^kts\.[a-z0-9.]{2,40}$/.test(username)) throw new HttpsError("invalid-argument", "Username chưa hợp lệ");
    if (!cvUrl && !driveUrl) throw new HttpsError("invalid-argument", "Cần CV hoặc link Drive hồ sơ năng lực");

    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    /* Chống ghi đè hồ sơ người khác đã duyệt: nếu users/{uid} tồn tại với role khác kts → chặn */
    const uref = db.doc("users/" + uid);
    const usnap = await uref.get();
    if (usnap.exists) {
      const cur = usnap.data() || {};
      if (cur.role && cur.role !== "kts" && cur.role !== "architect") {
        throw new HttpsError("failed-precondition", "Tài khoản này đã đăng ký vai trò khác");
      }
      if (cur.status === "active") {
        throw new HttpsError("already-exists", "Tài khoản đã được duyệt — đăng nhập để dùng");
      }
    }

    const batch = db.batch();
    batch.set(uref, {
      username, name, role: "kts",
      email: email || (username + "@aln.vn"),
      province: provinceHome,
      homeProvince: provinceHome,
      serviceProvinces: provincesWork,
      nhanLeadEmail: true, // nhận email báo dự án mới trong khu vực (tắt được ở hồ sơ KTS)
      status: "pending", plan: "free", credits: {},
      createdAt: now,
    }, { merge: true });
    batch.set(db.doc("ktsApplications/" + uid), {
      uid, name, phone, email: email || "",
      boMon, years, specialties, cchn, bio,
      province_home: provinceHome, provinces_work: provincesWork,
      avatarUrl, cvUrl, certUrls, driveUrl,
      username, status: "pending",
      utm, source: utm.source || "direct",
      submittedAt: now,
    });
    await batch.commit();

    /* KTS đi từ Phòng chờ → đánh dấu đã nộp hồ sơ (reservationLifecycle ngừng nhắc) */
    try {
      const rref = db.doc("reservations/" + uid);
      const rsnap = await rref.get();
      if (rsnap.exists) {
        await rref.update({ profileSubmitted: true, status: "submitted", submittedAt: now });
      }
    } catch (e) {
      console.error("[submitKtsApplication] update reservation:", e.message);
    }

    /* CAPI CompleteRegistration — dedup với Pixel client qua event_id 'reg-'+uid */
    try {
      const raw = request.rawRequest || {};
      const headers = raw.headers || {};
      const fwd = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
      await sendCapiEvent({
        eventName: "CompleteRegistration",
        eventId: "reg-" + uid,
        sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl.slice(0, 300) : SITE_URL + "kts-apply.html",
        phone, email,
        fbp: typeof d.fbp === "string" ? d.fbp : "",
        fbc: typeof d.fbc === "string" ? d.fbc : "",
        ip: fwd || raw.ip || "",
        ua: headers["user-agent"] || "",
        utm,
        contentName: "kts-apply",
      });
    } catch (e) {
      console.error("[submitKtsApplication] CAPI:", e.message);
    }

    /* Email xác nhận ngay — giữ ấm lead trong lúc chờ Founder duyệt */
    if (email && email.includes("@")) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
        });
        await transporter.sendMail({
          from: '"ALN — App Làm Nhà" <' + SMTP_USER.value() + ">",
          to: email,
          subject: "[ALN] Đã nhận hồ sơ KTS — phản hồi trong 48 giờ",
          text:
            "Chào " + name + ",\n\n" +
            "ALN đã nhận đầy đủ hồ sơ đăng ký Kiến trúc sư của bạn:\n\n" +
            "  • Tên đăng nhập: " + username + "\n" +
            "  • Khu vực nhận dự án: " + provincesWork.join(", ") + "\n\n" +
            "Founder sẽ xét duyệt và phản hồi trong vòng 48 giờ làm việc " +
            "(tối đa 3 ngày nếu cần xác minh thêm). Khi hồ sơ được duyệt, " +
            "bạn sẽ nhận thông báo và đăng nhập tại:\n" +
            SITE_URL + "login.html\n\n" +
            "Trong lúc chờ, bạn có thể xem cách ALN vận hành tại diễn đàn:\n" +
            SITE_URL + "forum.html\n\n" +
            "— ALN · applamnha.vn · Hotline 0909 82 9696",
        });
      } catch (e) {
        console.error("[submitKtsApplication] email xác nhận:", e.message);
      }
    }

    return { ok: true };
  }
);

/* ══════════════════════════════════════════════════════════════════
   2. onKtsReservationCreated — giữ chỗ ở phong-cho.html = Lead quảng cáo
   Bắn CAPI Lead server-side; dedup với Pixel client qua event_id 'lead-'+uid.
══════════════════════════════════════════════════════════════════ */
exports.onKtsReservationCreated = onDocumentCreated(
  {
    document: "reservations/{uid}",
    region: "asia-southeast1",
    secrets: [FB_CAPI_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const r = snap.data() || {};
    try {
      await sendCapiEvent({
        eventName: "Lead",
        eventId: "lead-" + event.params.uid,
        sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl.slice(0, 300) : SITE_URL + "aln-giu-cho/phong-cho.html",
        phone: r.phone || "",
        email: "",
        fbp: typeof r.fbp === "string" ? r.fbp : "",
        fbc: typeof r.fbc === "string" ? r.fbc : "",
        utm: r.utm,
        contentName: "giu-cho-" + (r.role || "unknown"),
      });
    } catch (e) {
      console.error("[onKtsReservationCreated] CAPI:", e.message);
    }
  }
);

/* ══════════════════════════════════════════════════════════════════
   3. onHomeLeadCreated — form lead nhanh (Tên+SĐT) trên home.html,
   dành cho chủ nhà. Bắn CAPI Lead server-side; dedup với Pixel client
   qua event_id 'lead-'+id (id = landingLeads doc id, sinh phía client
   trước khi setDoc, xem home.html hàm leadSubmit).
   LƯU Ý: đặt tên khác 'onLandingLeadCreated' vì tên đó đã có 1 Cloud
   Function 1st Gen cũ deploy sẵn trên production (không rõ nguồn gốc,
   chưa dám đụng) — Firebase chặn nâng cấp 1st→2nd Gen cùng tên.
══════════════════════════════════════════════════════════════════ */
exports.onHomeLeadCreated = onDocumentCreated(
  {
    document: "landingLeads/{id}",
    region: "asia-southeast1",
    secrets: [FB_CAPI_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const r = snap.data() || {};
    try {
      await sendCapiEvent({
        eventName: "Lead",
        eventId: "lead-" + event.params.id,
        sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl.slice(0, 300) : SITE_URL + "home.html",
        phone: r.phone || "",
        email: "",
        fbp: typeof r.fbp === "string" ? r.fbp : "",
        fbc: typeof r.fbc === "string" ? r.fbc : "",
        ip: typeof r.ip === "string" ? r.ip : "",
        ua: typeof r.ua === "string" ? r.ua : "",
        utm: r.utm,
        contentName: "home-lead-form",
      });
    } catch (e) {
      console.error("[onHomeLeadCreated] CAPI:", e.message);
    }
  }
);

/* ══════════════════════════════════════════════════════════════════
   3b. submitHomeLead (onCall) — home.html gọi thay vì setDoc thẳng vào
   landingLeads. Lý do: rules landingLeads đòi request.app != null
   (App Check) — trên thiết bị thật token hay không được cấp (reCAPTCHA
   bị chặn / điểm thấp) → permission-denied, MẤT LEAD dù khách là người
   thật. Ghi server-side bằng Admin SDK không phụ thuộc App Check phía
   khách; validate chặt tại đây (cửa cuối). CAPI Lead vẫn tự bắn qua
   onHomeLeadCreated (số 3) vì doc vẫn được tạo trong landingLeads —
   trả về id để client bắn Pixel với eventID 'lead-'+id (Meta dedup).
══════════════════════════════════════════════════════════════════ */
exports.submitHomeLead = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const d = request.data || {};
    const name = String(d.name || "").trim().slice(0, 100);
    const phone = String(d.phone || "").replace(/[\s.\-()]/g, "");
    if (!name) throw new HttpsError("invalid-argument", "Vui lòng nhập họ tên.");
    if (!/^0\d{8,10}$/.test(phone)) throw new HttpsError("invalid-argument", "SĐT chưa đúng (VD: 0909xxxxxx).");

    const db = admin.firestore();

    /* Chống gửi trùng: cùng SĐT trong 10 phút → trả lại lead cũ, không tạo
       mới (không orderBy để khỏi cần composite index — so createdAt tại đây) */
    try {
      const dup = await db.collection("landingLeads").where("phone", "==", phone).limit(5).get();
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const docSnap of dup.docs) {
        const t = docSnap.get("createdAt");
        if (t && typeof t.toMillis === "function" && t.toMillis() > cutoff) {
          return { ok: true, id: docSnap.id, dup: true };
        }
      }
    } catch (e) {
      console.warn("[submitHomeLead] check trùng lỗi (bỏ qua):", e.message);
    }

    const raw = request.rawRequest || {};
    const headers = raw.headers || {};
    const ip = String(headers["x-forwarded-for"] || "").split(",")[0].trim() || raw.ip || "";
    const utm = cleanUtm(d.utm);
    const ref = db.collection("landingLeads").doc();
    await ref.set({
      name, phone,
      status: "moi",
      utm,
      source: utm.source || "direct",
      fbp: typeof d.fbp === "string" ? d.fbp.slice(0, 200) : "",
      fbc: typeof d.fbc === "string" ? d.fbc.slice(0, 200) : "",
      sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl.slice(0, 300) : "",
      ip: String(ip).slice(0, 60),
      ua: String(headers["user-agent"] || "").slice(0, 400),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  }
);

/* ══════════════════════════════════════════════════════════════════
   4. onCnRegistered — đăng ký Chủ nhà qua register.html (role:'cn'),
   kể cả khi đi từ nút "Hỏi KTS Miễn Phí" trên diễn đàn (forum.html →
   requireLogin → register.html, xem forumGoRegister). Bắn CAPI
   CompleteRegistration server-side; dedup với Pixel client qua
   event_id 'cnreg-'+uid (xem register.html hàm doRegister).
══════════════════════════════════════════════════════════════════ */
exports.onCnRegistered = onDocumentCreated(
  {
    document: "users/{uid}",
    region: "asia-southeast1",
    secrets: [FB_CAPI_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const u = snap.data() || {};
    if (u.role !== "cn") return; // chỉ bắn cho Chủ nhà — KTS/DN đi phễu riêng (ktsFunnel/onKtsReservationCreated)
    try {
      await sendCapiEvent({
        eventName: "CompleteRegistration",
        eventId: "cnreg-" + event.params.uid,
        sourceUrl: typeof u.sourceUrl === "string" ? u.sourceUrl.slice(0, 300) : SITE_URL + "register.html",
        phone: u.phone || "",
        email: "",
        fbp: typeof u.fbp === "string" ? u.fbp : "",
        fbc: typeof u.fbc === "string" ? u.fbc : "",
        utm: u.utm,
        contentName: "register-cn",
      });
    } catch (e) {
      console.error("[onCnRegistered] CAPI:", e.message);
    }
  }
);

/* ══════════════════════════════════════════════════════════════════
   5. onLeadCreated — bắn CAPI Lead server-side cho MỌI doc mới trong
   collection `leads` (dùng chung bởi localLeads.js/mauLeads.js/
   duToanLeads.js/forum.js). Dedup với Pixel client qua event_id
   'lead-'+id — id = doc.id sinh server-side, trả về cho client trong
   response của submitLocalLead/submitMauLead/submitDuToanLead (xem 3
   template tools/template-tinh.html, template-mau.html, template-dutoan.html).
   Lead diễn đàn (source:'forum') không có fbp/fbc/Pixel phía client —
   CAPI vẫn bắn được nhờ SĐT đã băm, chỉ thiếu tín hiệu khớp fbp/fbc.

   Ghi lại capiStatus ('sent'/'failed') + capiError vào chính doc lead
   sau khi gọi xong, để founder tự query tỷ lệ CAPI lỗi trên Firestore
   thay vì phải lục log Cloud Functions.
══════════════════════════════════════════════════════════════════ */
exports.onLeadCreated = onDocumentCreated(
  {
    document: "leads/{id}",
    region: "asia-southeast1",
    secrets: [FB_CAPI_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const r = snap.data() || {};
    let result;
    try {
      result = await sendCapiEvent({
        eventName: "Lead",
        eventId: "lead-" + event.params.id,
        sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl.slice(0, 300) : SITE_URL,
        phone: r.phone || "",
        email: "",
        fbp: typeof r.fbp === "string" ? r.fbp : "",
        fbc: typeof r.fbc === "string" ? r.fbc : "",
        ip: typeof r.ip === "string" ? r.ip : "",
        ua: typeof r.ua === "string" ? r.ua : "",
        utm: r.utm,
        contentName: String(r.source || "leads").slice(0, 60),
      });
    } catch (e) {
      console.error("[onLeadCreated] CAPI:", e.message);
      result = { ok: false, error: String(e.message || "unknown").slice(0, 500) };
    }
    try {
      const update = { capiStatus: result.ok ? "sent" : "failed" };
      if (!result.ok) update.capiError = String(result.error || "unknown").slice(0, 500);
      await snap.ref.update(update);
    } catch (e) {
      console.error("[onLeadCreated] update capiStatus:", e.message);
    }
  }
);
