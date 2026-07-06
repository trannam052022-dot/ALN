/**
 * notifyKtsLeadEmail — Firestore trigger (asia-southeast1)
 * ⚠️ FILE RIÊNG ĐỂ REVIEW — CHƯA wire vào index.js, CHƯA deploy. Không ảnh hưởng gì tới hệ thống.
 *
 * MỤC ĐÍCH: khi có LEAD mới từ diễn đàn (chủ nhà đăng bài Tư vấn Dự án → forumPost tạo
 * doc trong `leads`), gửi EMAIL cho các KTS đã BẬT nhận lead + phục vụ khu vực đó, mời họ
 * vào thread trả lời. Bổ sung kênh email cho hệ thông báo push (FCM) sẵn có — email đáng
 * tin hơn để kéo KTS quay lại trả lời.
 *
 * VIẾT ĐÚNG SCHEMA ALN THẬT (khác kit generic):
 *   - Lead: collection `leads` (do functions/forum.js tạo) — có sẵn:
 *       { name, phone, projectType, area, budget, hasLand, timeline, region,
 *         score, tier, status:'new', source:'forum', threadId, cnUid, createdAt }
 *   - KTS: `users/{uid}` role='kts', status='active', email, name, serviceProvinces[], homeProvince
 *   - Opt-in MỚI cần thêm: `users/{uid}.nhanLeadEmail = true` (toggle "Nhận thông báo dự án mới")
 *
 * NGUYÊN TẮC ALN: KHÔNG email SĐT/thông tin liên hệ của khách (chống lách sàn) — chỉ nêu
 * loại/diện tích/ngân sách/khu vực + link thread để KTS vào trả lời TRÊN SÀN.
 *
 * KÍCH HOẠT KHI SẴN SÀNG (làm sau khi TRANNAM duyệt):
 *   1. functions/index.js thêm:
 *        exports.notifyKtsLeadEmail = require('./notifyKtsLeadEmail').notifyKtsLeadEmail;
 *   2. cd functions && npm install nodemailer
 *   3. Set secret (Gmail: dùng App Password, KHÔNG dùng mật khẩu thường; verify ngay):
 *        firebase functions:secrets:set SMTP_USER
 *        firebase functions:secrets:set SMTP_PASS
 *        firebase functions:secrets:access SMTP_USER   # kiểm tra sạch ASCII
 *   4. Thêm field opt-in cho KTS: toggle `nhanLeadEmail` ở kts-apply.html / hồ sơ KTS
 *      (mặc định KHÔNG gửi nếu chưa === true → không spam KTS chưa đồng ý).
 *   5. firebase deploy --only functions:notifyKtsLeadEmail
 *
 * INDEX: query dưới dùng 3 filter '==' (role, status, nhanLeadEmail) không orderBy →
 *   Firestore phục vụ bằng single-field index (zigzag), KHÔNG cần composite index mới.
 *   Khớp khu vực làm CLIENT-SIDE (region của lead là quận/tỉnh tự do, không array-contains được).
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

if (!admin.apps.length) admin.initializeApp();

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

/* Chuẩn hoá chuỗi khu vực để so khớp: bỏ dấu tiếng Việt, thường hoá, gộp khoảng trắng */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

const TYPE_LABEL = { xay_moi: 'Xây mới', thiet_ke: 'Thiết kế', cai_tao: 'Cải tạo' };
const BUDGET_LABEL = { '<1ty': 'Dưới 1 tỷ', '1-2ty': '1 – 2 tỷ', '>=2ty': 'Từ 2 tỷ' };

exports.notifyKtsLeadEmail = onDocumentCreated(
  {
    document: 'leads/{leadId}',
    region: 'asia-southeast1',
    secrets: [SMTP_USER, SMTP_PASS],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const lead = snap.data();
    const leadId = event.params.leadId;

    // Chỉ xử lý lead từ diễn đàn, chưa gửi, có khu vực
    if (lead.source !== 'forum') return;
    if (lead.ktsEmailNotified === true) return;               // dedupe
    if (!lead.region) {
      await snap.ref.update({ ktsEmailNotified: true, ktsEmailCount: 0 });
      return;
    }

    const db = admin.firestore();

    // KTS active đã BẬT nhận email lead (lọc khu vực client-side)
    const ktsSnap = await db.collection('users')
      .where('role', '==', 'kts')
      .where('status', '==', 'active')
      .where('nhanLeadEmail', '==', true)
      .get();

    if (ktsSnap.empty) {
      console.log(`[notifyKtsLeadEmail][${leadId}] Không có KTS nào bật nhận lead.`);
      await snap.ref.update({ ktsEmailNotified: true, ktsEmailCount: 0 });
      return;
    }

    const regionN = norm(lead.region);
    const targets = ktsSnap.docs.map((d) => d.data()).filter((k) => {
      if (!k.email) return false;
      const provs = Array.isArray(k.serviceProvinces) && k.serviceProvinces.length
        ? k.serviceProvinces
        : (k.homeProvince ? [k.homeProvince] : []);
      // Khớp nếu 1 tỉnh KTS phục vụ nằm trong chuỗi khu vực của lead (hoặc ngược lại):
      // vd tỉnh "TP.HCM" ⊂ khu vực "Thủ Đức, TP.HCM"
      return provs.some((p) => {
        const pn = norm(p);
        return pn && (regionN.includes(pn) || pn.includes(regionN));
      });
    });

    if (!targets.length) {
      console.log(`[notifyKtsLeadEmail][${leadId}] Không KTS nào phục vụ khu vực "${lead.region}".`);
      await snap.ref.update({ ktsEmailNotified: true, ktsEmailCount: 0 });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });

    const threadUrl = 'https://applamnha.vn/forum.html?thread=' + (lead.threadId || '');
    const info = [
      lead.projectType ? 'Loại dự án: ' + (TYPE_LABEL[lead.projectType] || lead.projectType) : null,
      lead.area ? 'Diện tích: ' + lead.area + ' m²' : null,
      lead.budget ? 'Ngân sách: ' + (BUDGET_LABEL[lead.budget] || lead.budget) : null,
      'Khu vực: ' + lead.region,
    ].filter(Boolean).join('\n');
    const subject = '[Lead mới · ' + lead.region + '] Có chủ nhà cần tư vấn thiết kế';

    let sent = 0;
    for (const k of targets) {
      try {
        await transporter.sendMail({
          from: '"ALN — App Làm Nhà" <' + SMTP_USER.value() + '>',
          to: k.email,
          subject,
          text:
            'Chào ' + (k.name || 'KTS') + ',\n\n' +
            'Có chủ nhà vừa đăng yêu cầu thiết kế trong khu vực bạn phục vụ:\n\n' +
            info + '\n\n' +
            'Vào trả lời sớm trên diễn đàn để tăng cơ hội được chủ nhà chọn ' +
            '(mọi trao đổi & giao dịch qua sàn ALN mới được bảo vệ bởi Quy trình 4 bước):\n' +
            threadUrl + '\n\n' +
            '— ALN · applamnha.vn\n' +
            '(Muốn tắt email này: cập nhật hồ sơ KTS, tắt "Nhận thông báo dự án mới".)',
        });
        sent++;
      } catch (err) {
        console.error(`[notifyKtsLeadEmail][${leadId}] Lỗi gửi ${k.email}:`, err.message);
      }
    }

    await snap.ref.update({
      ktsEmailNotified: true,
      ktsEmailCount: sent,
      ktsEmailAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[notifyKtsLeadEmail][${leadId}] Đã gửi ${sent}/${targets.length} KTS khu vực "${lead.region}".`);
  }
);
