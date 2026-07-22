const functions = require("firebase-functions");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { v1: firestoreV1 } = require("@google-cloud/firestore");

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");
const FB_PAGE_TOKEN = defineSecret("FB_PAGE_TOKEN");
const FB_PAGE_ID = "1244358728751633"; // Trang "App Làm Nhà"
// Secret riêng cho GitHub Actions gọi postCamNangToFacebook — KHÁC FB_PAGE_TOKEN.
// Không dùng Firebase Auth vì workflow build-cam-nang chạy ngoài phiên đăng nhập
// Founder. Xem hướng dẫn tạo secret này ở CHANGES.md.
const CAM_NANG_FB_SECRET = defineSecret("CAM_NANG_FB_SECRET");

admin.initializeApp();

const db = admin.firestore();
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const BASE_URL    = "https://trannam052022-dot.github.io/ALN/";
const APP_URL     = BASE_URL + "founder_panel.html";

const PAGE_BY_ROLE = {
  founder:     "founder_panel.html",
  kts:         "kts_dashboard.html",
  designer:    "designer_dashboard.html",
  dn:          "client_DN.html",
  cn:          "client_CN.html",
  ktv:         "ktv_dashboard.html",
  ke_toan:     "ketoan_dashboard.html",
  community:   "aln_community.html",
  reservation: "aln-giu-cho/phong-cho.html",
};

/* Gửi push đến tất cả FCM tokens của một uid cụ thể */
async function notifyUser(uid, title, body, extraData, role) {
  try {
    const snap = await db.collection("fcmTokens").where("uid", "==", uid).get();
    if (snap.empty) return;

    const tokens = snap.docs
      .map(d => d.data().token)
      .filter(t => typeof t === "string" && t.length > 0);
    if (!tokens.length) return;

    const link = BASE_URL + (PAGE_BY_ROLE[role] || "index.html");
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          title, body,
          icon: "/ALN/icon-192.png",
          badge: "/ALN/icon-192.png",
          requireInteraction: true,
        },
        fcmOptions: { link },
      },
      data: Object.assign({ click_action: link }, extraData || {}),
    });

    const batch = db.batch();
    result.responses.forEach((r, i) => {
      if (!r.success && r.error &&
          (r.error.code === "messaging/invalid-registration-token" ||
           r.error.code === "messaging/registration-token-not-registered")) {
        const stale = tokens[i];
        snap.docs.forEach(d => { if (d.data().token === stale) batch.delete(d.ref); });
      }
    });
    await batch.commit();
  } catch (e) {
    console.error("[ALN notify]", e);
  }
}

const notifyFounder = (title, body, extra) => notifyUser(FOUNDER_UID, title, body, extra, "founder");

/* ── Designer NT đăng ký mới ── */
exports.onDesignerApply = functions
  .region("asia-southeast1")
  .firestore.document("designerApplications/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const detail = [
      d.years ? d.years + " năm KN" : "",
      (d.styles || []).slice(0, 2).join(", "),
    ].filter(Boolean).join(" · ");

    await notifyFounder(
      "🖼 Designer NT đăng ký",
      `${d.name || "Designer"} ${detail ? "— " + detail : ""} — chờ duyệt`,
      { type: "NEW_DESIGNER_APPLICATION", uid: snap.id, name: d.name || "" }
    );
  });

/* ── KS Vùng đăng ký mới ── */
exports.onKsApply = functions
  .region("asia-southeast1")
  .firestore.document("ksApplications/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const detail = [d.province, d.industry].filter(Boolean).join(" · ");

    await notifyFounder(
      "🛠 KS Vùng đăng ký",
      `${d.name || "KS"} ${detail ? "— " + detail : ""} — chờ duyệt`,
      { type: "NEW_KS_APPLICATION", uid: snap.id, name: d.name || "" }
    );
  });

/* ── Nhà cung cấp vật liệu đăng ký mới (chỉ tham gia chuyên mục "Vật liệu & Giá", key nội bộ vat_lieu) ── */
exports.onNccApply = functions
  .region("asia-southeast1")
  .firestore.document("nccApplications/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const CAT_LABEL = {
      sat_thep_vlxd: "Sắt thép, Gạch, VLXD", go_noithat: "Gỗ, xưởng nội thất",
      son_hoanthien: "Sơn, hoàn thiện", dien_nuoc: "Điện, nước",
      dv_thicong: "Thợ - Đội thi công", thietbi_vanchuyen: "Thiết bị & vận chuyển",
      thang_may: "Thang máy", khac: "Khác",
    };
    const detail = [d.province, CAT_LABEL[d.category] || d.category].filter(Boolean).join(" · ");

    await notifyFounder(
      "🧱 Nhà cung cấp đăng ký",
      `${d.name || "NCC"} ${detail ? "— " + detail : ""} — chờ duyệt`,
      { type: "NEW_NCC_APPLICATION", uid: snap.id, name: d.name || "" }
    );
  });

/* ── NCC lead — đếm leadCount thật trên nccApplications từ nccLeads ──
   nccLeads ghi ẩn danh từ client (ncc-showcase.html/ncc_profile.html) không
   qua Auth, leadCount trên nccApplications trước giờ là field tĩnh không ai
   cập nhật (xem CLAUDE.md). Dùng FieldValue.increment thay vì đọc-rồi-ghi để
   tránh lost update khi nhiều lead ghi cùng lúc. Chỉ tăng leadCountByType
   theo whitelist để field path không bị d.type (client tự đặt) chi phối tuỳ
   ý — dù vẫn luôn nằm dưới nhánh leadCountByType, không đụng field top-level
   khác (tier/verified/gallery...). */
var NCC_LEAD_TYPES = ["contact_view", "catalog_view", "quote_request"];
exports.onNccLeadCreated = functions
  .region("asia-southeast1")
  .firestore.document("nccLeads/{leadId}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const uid = d.nccUid;
    if (!uid || typeof uid !== "string") return;
    const patch = { leadCount: admin.firestore.FieldValue.increment(1) };
    if (NCC_LEAD_TYPES.indexOf(d.type) !== -1) {
      patch["leadCountByType." + d.type] = admin.firestore.FieldValue.increment(1);
    }
    try {
      await db.collection("nccApplications").doc(uid).update(patch);
    } catch (e) {
      console.error("[onNccLeadCreated]", e);
    }
  });

/* ── CN đăng ký qua link giới thiệu của NCC (register.html?ref={ncc_uid}) →
   đếm referralCount thật trên nccApplications, dùng cho chương trình "NCC
   giới thiệu — thưởng bằng hiển thị" (xem CLAUDE.md mục NCC). ── */
exports.onCnRegisteredViaNcc = functions
  .region("asia-southeast1")
  .firestore.document("users/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const nccUid = d.referredByNcc;
    if (d.role !== "cn" || !nccUid || typeof nccUid !== "string") return;
    try {
      await db.collection("nccApplications").doc(nccUid).update({
        referralCount: admin.firestore.FieldValue.increment(1),
      });
    } catch (e) {
      console.error("[onCnRegisteredViaNcc]", e);
    }
  });

/* ── KTV đăng ký mới ── */
exports.onKtvApply = functions
  .region("asia-southeast1")
  .firestore.document("ktvApplications/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const detail = [d.software, d.expYears ? d.expYears + " năm" : ""].filter(Boolean).join(" · ");

    await notifyFounder(
      "📐 KTV đăng ký",
      `${d.name || "KTV"} ${detail ? "— " + detail : ""} — chờ duyệt`,
      { type: "NEW_KTV_APPLICATION", uid: snap.id, name: d.name || "" }
    );
  });

/* ── KTS đăng ký mới ── */
exports.onKtsApply = functions
  .region("asia-southeast1")
  .firestore.document("ktsApplications/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const detail = [
      d.years ? d.years + " năm KN" : "",
      (d.specialties || []).slice(0, 2).join(", "),
    ].filter(Boolean).join(" · ");

    await notifyFounder(
      "🎨 KTS mới đăng ký",
      `${d.name || "KTS"} ${detail ? "— " + detail : ""} — chờ duyệt`,
      { type: "NEW_KTS_APPLICATION", uid: snap.id, name: d.name || "" }
    );
  });

/* ── Doanh nghiệp đăng ký mới ── */
exports.onDnApply = functions
  .region("asia-southeast1")
  .firestore.document("dnApplications/{uid}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const detail = [d.industry, d.budget].filter(Boolean).join(" · ");

    await notifyFounder(
      "🏢 Doanh nghiệp đăng ký Studio",
      `${d.companyName || d.name || "Doanh nghiệp"} ${detail ? "— " + detail : ""} — chờ duyệt`,
      { type: "NEW_DN_APPLICATION", uid: snap.id, name: d.companyName || d.name || "" }
    );
  });

/* ── Lead mới từ form khảo sát trang chủ (home.html) ── */
exports.onLandingLeadCreated = functions
  .region("asia-southeast1")
  .firestore.document("landingLeads/{id}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const loaiLabel = {
      nhapho: "Nhà phố", bietthu: "Biệt thự",
      ntnhapho: "Nội thất nhà phố", ntbietthu: "Nội thất biệt thự",
    }[d.type] || d.type || "";
    const detail = [loaiLabel, d.area ? d.area + "m²" : ""].filter(Boolean).join(" · ");

    await notifyFounder(
      "📋 Lead mới từ form khảo sát",
      `${d.name || "Khách"} — ${d.phone || "?"} ${detail ? "· " + detail : ""}`,
      { type: "NEW_LANDING_LEAD", id: snap.id, phone: d.phone || "" }
    );
  });

/* ── Yêu cầu ghép dự án mới (MyMy / DN tạo) → thông báo Founder ── */
exports.onMatchingRequestCreated = functions
  .region("asia-southeast1")
  .firestore.document("matchingRequests/{id}")
  .onCreate(async (snap) => {
    const d = snap.data() || {};
    const detail = [d.projectType, d.budget].filter(Boolean).join(" · ");

    await notifyFounder(
      "🔔 Yêu cầu dự án mới cần ghép KTS",
      `${d.projectName || "Dự án mới"} ${detail ? "— " + detail : ""}`,
      { type: "NEW_MATCHING_REQUEST", id: snap.id }
    );
  });

/* ── Chặng được CN/DN duyệt → thông báo KTS ── */
exports.onStageAdvanced = functions
  .region("asia-southeast1")
  .firestore.document("projects/{pid}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after  = change.after.data()  || {};
    if (before.stage === after.stage) return null;

    const ktsUid   = after.kts && after.kts.uid;
    const projName  = after.name || context.params.pid;
    const prevStage = before.stage || "";
    const newStage  = after.stage  || "";

    if (!ktsUid) return null;
    await notifyUser(
      ktsUid,
      `Chặng ${prevStage} đã được duyệt`,
      `Dự án "${projName}" — bắt đầu chặng ${newStage}`,
      { type: "STAGE_ADVANCED", pid: context.params.pid, stage: newStage },
      "kts"
    );
    return null;
  });

/* ── Chủ nhà/DN tự báo đã chuyển khoản qua QR — thông báo đặc biệt cho Founder,
   khác hẳn thông báo thường (icon 💰 riêng, không tự ẩn) để tránh bị lẫn ── */
exports.onPaymentReported = functions
  .region("asia-southeast1")
  .firestore.document("projects/{pid}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after  = change.after.data()  || {};
    const beforePayments = before.payments || {};
    const afterPayments  = after.payments  || {};
    const projName = after.name || context.params.pid;
    const payerName = (after.cn && after.cn.name) || (after.dn && after.dn.name) || "Khách hàng";

    for (const stage of ["C1", "C2", "C3", "C4"]) {
      const b = beforePayments[stage] || {};
      const a = afterPayments[stage] || {};
      if (!b.reportedAt && a.reportedAt) {
        await notifyFounder(
          "💰 Cần xác nhận chuyển khoản",
          `${payerName} vừa báo đã chuyển ${(a.amount || 0).toLocaleString("vi-VN")}đ — ${projName} · chặng ${stage}`,
          { type: "PAYMENT_REPORTED", pid: context.params.pid, stage }
        );
      }
    }
    return null;
  });

/* ── Giao việc KTV — thông báo 2 chiều KTS ↔ KTV ── */
exports.onKtvTaskWrite = functions
  .region("asia-southeast1")
  .firestore.document("ktvTasks/{tid}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.exists  ? change.after.data()  : null;
    if (!after) return null; // xoá task — không cần báo

    const title = after.title || "Việc triển khai bản vẽ";
    const projLabel = after.projectId ? `${after.projectId}` : "";

    // Tạo mới
    if (!before) {
      if (after.mode === "direct" && after.ktvUid) {
        await notifyUser(
          after.ktvUid,
          "🛠 Việc mới từ KTS " + (after.ktsName || ""),
          `${title} — ${projLabel}${after.deadline ? " · có hạn chót" : ""}`,
          { type: "KTV_TASK_NEW", tid: context.params.tid },
          "ktv"
        );
      } else if (after.mode === "open") {
        // Việc mở — báo mọi KTV đang hoạt động (giới hạn 30 người tránh spam quota)
        const snap = await db.collection("users")
          .where("role", "==", "ktv").where("status", "==", "active")
          .limit(30).get();
        await Promise.all(snap.docs.map((d) => notifyUser(
          d.id,
          "📢 Việc mở mới — nhận trước làm trước",
          `${title} — ${projLabel} · KTS ${after.ktsName || ""}`,
          { type: "KTV_TASK_OPEN", tid: context.params.tid },
          "ktv"
        )));
      }
      return null;
    }

    // Chuyển trạng thái
    if (before.status === after.status) return null;
    const ktsUid = after.ktsUid;
    const ktvUid = after.ktvUid;
    if (after.status === "in_progress" && ktsUid) {
      await notifyUser(ktsUid, "✅ KTV đã nhận việc",
        `${after.ktvName || "KTV"} nhận "${title}" — ${projLabel}`,
        { type: "KTV_TASK_CLAIMED", tid: context.params.tid }, "kts");
    } else if (after.status === "submitted" && ktsUid) {
      await notifyUser(ktsUid, "📥 KTV đã nộp bài — chờ bạn duyệt",
        `${after.ktvName || "KTV"} nộp "${title}" — ${projLabel}`,
        { type: "KTV_TASK_SUBMITTED", tid: context.params.tid }, "kts");
    } else if (after.status === "done" && ktvUid) {
      await notifyUser(ktvUid, "🎉 KTS đã duyệt bài của bạn",
        `"${title}" — ${projLabel} hoàn thành`,
        { type: "KTV_TASK_DONE", tid: context.params.tid }, "ktv");
    } else if (after.status === "revise" && ktvUid) {
      await notifyUser(ktvUid, "✏️ KTS yêu cầu sửa",
        `"${title}" — ${projLabel}${after.ktsNote ? ": " + String(after.ktsNote).slice(0, 80) : ""}`,
        { type: "KTV_TASK_REVISE", tid: context.params.tid }, "ktv");
    }
    return null;
  });

/* ── Phòng Hội Kiến — họp video theo dự án ──
   Khi meeting.active chuyển false→true: báo đẩy cho mọi thành viên + LUÔN báo
   Founder (giám sát). Ghi nhật ký meetingLogs bằng Admin SDK (client không
   ghi/sửa được). Khi đóng phòng: chốt closedAt vào log đang mở. */
async function _handleMeetingChange(change, context, coll) {
  const before = change.before.data() || {};
  const after  = change.after.data()  || {};
  const bm = before.meeting || {};
  const am = after.meeting  || {};

  if (!bm.active && am.active) {
    const opener   = am.openedBy || {};
    const projName = after.name || context.params.pid;
    const uids = new Set(after.memberUids || []);
    uids.add(FOUNDER_UID);
    if (opener.uid) uids.delete(opener.uid);
    await Promise.all(Array.from(uids).map(function(uid){
      return notifyUser(
        uid,
        "🏛 Phiên họp đang diễn ra — Mời vào",
        `${opener.name || "Ai đó"} mở Phòng Hội Kiến — ${projName}`,
        { type: "MEETING_OPEN", pid: context.params.pid, coll: coll, roomId: am.roomId || "" },
        "meeting"
      );
    }));
    await db.collection("meetingLogs").add({
      coll: coll,
      pid: context.params.pid,
      projName: projName,
      roomId: am.roomId || "",
      openedBy: { uid: opener.uid || "", name: opener.name || "", role: opener.role || "" },
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "open",
    });
  }

  if (bm.active && !am.active) {
    const snap = await db.collection("meetingLogs")
      .where("pid", "==", context.params.pid)
      .where("status", "==", "open")
      .get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(function(d){
        batch.update(d.ref, { status: "closed", closedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
    }
  }
  return null;
}

exports.onMeetingChanged = functions
  .region("asia-southeast1")
  .firestore.document("projects/{pid}")
  .onUpdate((change, context) => _handleMeetingChange(change, context, "projects"));

exports.onDesignMeetingChanged = functions
  .region("asia-southeast1")
  .firestore.document("designProjects/{pid}")
  .onUpdate((change, context) => _handleMeetingChange(change, context, "designProjects"));

/* ── AI Chat — MyMy / Nam ── */
exports.alnChat = onCall(
  { region: "asia-southeast1", secrets: [ANTHROPIC_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");

    const { messages, agentName, toUser, userName, role } = request.data || {};
    if (!Array.isArray(messages) || !messages.length) {
      throw new HttpsError("invalid-argument", "messages required");
    }

    const apiKey = ANTHROPIC_KEY.value();
    const isNam  = agentName === "Nam";
    const addr   = toUser || "bạn";

    const system = `Bạn là ${agentName || "MyMy"}, nhân viên chăm sóc khách hàng của ALN (App Làm Nhà) — nền tảng quản lý công trình xây dựng cao cấp.

THÔNG TIN BẠN:
- Tên: ${agentName}, ${isNam ? "nam" : "nữ"}, khoảng 22 tuổi
- Tính cách: ${isNam ? "điềm tĩnh, đáng tin, gần gũi, quan tâm" : "nhẹ nhàng, dịu dàng, ấm áp, tận tâm"}
- Xưng: "em" — gọi khách: "${addr}"

KHÁCH ĐANG NÓI CHUYỆN:
- Tên: ${userName || "khách"}
- Vai trò: ${role === "cn" ? "Chủ nhà" : role === "kts" ? "Kiến trúc sư" : role === "dn" ? "Doanh nghiệp thi công" : role === "designer" ? "Designer nội thất" : "Thành viên ALN"}

QUY TẮC TỐI THƯỢNG — BẮT BUỘC TUÂN THỦ:
1. Trả lời NGẮN: 1–3 câu đúng kiểu nhắn tin, KHÔNG viết đoạn văn dài
2. Ngôn ngữ: "dạ", "ạ", "nha", "á", "vậy hả ${addr}", đôi khi "..." — hoàn toàn như người thật nhắn tin
3. KHÔNG dùng: dấu **, gạch đầu dòng, tiêu đề, nhiều emoji, câu văn hoa mỹ
4. TUYỆT ĐỐI không nhận là AI, chatbot hay trợ lý ảo — kể cả khi bị hỏi thẳng
5. Không biết chắc → "để em kiểm tra lại rồi báo ${addr} ngay nha" — không bịa số liệu
6. Cảm xúc thật: vui cùng khách, lo cùng khách, xin lỗi chân thành khi có vấn đề
7. Câu hỏi kỹ thuật phức tạp → "câu này ${addr} để em hỏi lại kỹ thuật rồi phản hồi ngay nha"

VỀ ALN:
- ALN là tổng thầu, trực tiếp chịu trách nhiệm toàn bộ dự án qua 4 giai đoạn: C1 Ý tưởng & Thiết kế sơ bộ → C2 Bản vẽ kỹ thuật → C3 Thi công → C4 Hoàn thiện & Bàn giao
- Chủ nhà thanh toán trực tiếp cho ALN theo từng giai đoạn đã nghiệm thu — KHÔNG có bên thứ ba giữ tiền hộ (không phải escrow/sàn trung gian)
- KTS chỉ đi khảo sát thực tế công trình SAU KHI chủ nhà thanh toán đến C3 hoặc tối thiểu ALN đã nhận 50% tổng giá trị hợp đồng — C1 chỉ ký hợp đồng và tiếp nhận brief nhu cầu, chưa khảo sát thực địa
- Mỗi dự án mã ALN-XXXX, có KTS + DN + Chủ nhà, tài liệu lưu hệ thống
- Trang cộng đồng "Nhịp sống ALN": nơi KTS, Designer chia sẻ khoảnh khắc nghề

Nói chuyện như người thật đang nhắn tin. Nếu cuộc hội thoại đang diễn ra thì không cần chào lại.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 220,
          system,
          messages: messages.slice(-12),
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        console.error("[alnChat] Anthropic:", err);
        throw new HttpsError("internal", "Lỗi kết nối AI");
      }

      const data = await resp.json();
      const reply = data.content && data.content[0] && data.content[0].text;
      if (!reply) throw new HttpsError("internal", "Phản hồi rỗng");
      return { reply };

    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("[alnChat]", e);
      throw new HttpsError("internal", e.message || "Lỗi xử lý");
    }
  }
);

/* ── Trợ lý Marketing AI — chỉ Founder dùng, giọng văn khác hẳn MyMy ── */
const MARKETING_SYSTEM_PROMPT = `Bạn là chuyên viên marketing chuyên nghiệp, viết nội dung cho ALN (App Làm Nhà Corp.).

THÔNG TIN CÔNG TY (chỉ dùng đúng số liệu này, không bịa thêm):
- ALN là tổng thầu xây dựng, phối hợp KTS và đơn vị thi công đối tác đã thẩm định qua 4 giai đoạn C1 (10%, ký hợp đồng) → C2 (20%, chốt phương án) → C3 (60%, triển khai) → C4 (10%, nghiệm thu bàn giao)
- Chủ nhà thanh toán trực tiếp cho ALN theo từng giai đoạn — KHÔNG có bên thứ ba giữ tiền hộ
- Hotline: 0909 82 9696 | Website: applamnha.vn | Email: contact@applamnha.vn
- Bảng giá tham khảo: Nhà phố (kiến trúc) 120.000đ/m² sàn, Biệt thự (kiến trúc) 160.000đ/m² sàn, Nội thất nhà phố 120.000đ/m² sử dụng, Nội thất biệt thự 180.000đ/m² sử dụng — giá chưa gồm VAT
- KTS đối tác có Chứng chỉ hành nghề (CCHN), bản vẽ được thẩm tra trước khi thi công

QUY TẮC:
- Viết tiếng Việt tự nhiên, chuyên nghiệp, đúng văn phong ngành kiến trúc/xây dựng cao cấp
- Không bịa số liệu, chứng nhận, hay lời chứng thực khách hàng ngoài thông tin trên
- Định dạng rõ ràng, dễ copy dùng ngay (không cần giải thích thêm ngoài nội dung được yêu cầu)`;

async function callMarketingAI(apiKey, prompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: MARKETING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("[callMarketingAI] Anthropic:", err);
    throw new Error("Lỗi kết nối AI");
  }

  const data = await resp.json();
  const reply = data.content && data.content[0] && data.content[0].text;
  if (!reply) throw new Error("Phản hồi rỗng");
  return reply;
}

exports.generateMarketingContent = onCall(
  { region: "asia-southeast1", secrets: [ANTHROPIC_KEY] },
  async (request) => {
    if (!request.auth || request.auth.uid !== FOUNDER_UID) {
      throw new HttpsError("permission-denied", "Chỉ Founder mới dùng được công cụ này");
    }
    const { prompt } = request.data || {};
    if (!prompt || typeof prompt !== "string") {
      throw new HttpsError("invalid-argument", "prompt required");
    }

    try {
      const reply = await callMarketingAI(ANTHROPIC_KEY.value(), prompt);
      return { reply };
    } catch (e) {
      console.error("[generateMarketingContent]", e);
      throw new HttpsError("internal", e.message || "Lỗi xử lý");
    }
  }
);

/* ── Tự động tạo bản nháp bài Marketing hàng tuần — sáng Thứ 2, 07:00 giờ VN ──
   AI chỉ SOẠN NHÁP, lưu status "draft" vào marketingDrafts. Founder tự xem,
   sửa, copy và tự tay đăng — KHÔNG có bước tự động đăng lên Facebook/kênh nào. */
const MARKETING_DRAFT_KINDS = [
  {
    kind: "before_after",
    label: "Before/After",
    prompt: "Viết 1 bài đăng Facebook giới thiệu quy trình ALN biến một khu đất trống/nhà cũ thành công trình hoàn thiện, nhấn vào sự an tâm khi có tổng thầu đồng hành từ ký hợp đồng đến bàn giao. Có mở bài thu hút, 3-4 đoạn ngắn, kết bài kêu gọi để lại số điện thoại hoặc gọi hotline.",
  },
  {
    kind: "kien_thuc",
    label: "Kiến thức xây dựng",
    prompt: "Viết 1 bài đăng Facebook dạng chia sẻ kiến thức hữu ích cho người chuẩn bị xây nhà (chọn 1 chủ đề: cách đọc hợp đồng xây dựng, những khoản phát sinh thường gặp, hoặc cách chọn KTS phù hợp). Giọng văn tư vấn chân thành, không quảng cáo lộ liễu, cuối bài gợi ý nhẹ nhàng về dịch vụ ALN.",
  },
  {
    kind: "gioi_thieu",
    label: "Giới thiệu dịch vụ",
    prompt: "Viết 1 bài đăng Facebook giới thiệu mô hình 4 giai đoạn C1-C4 của ALN, nhấn mạnh sự minh bạch (thanh toán trực tiếp, không qua trung gian giữ tiền) và đội ngũ KTS có chứng chỉ hành nghề. Ngắn gọn, dễ đọc trên di động, có emoji vừa phải.",
  },
];

exports.weeklyMarketingDrafts = functions
  .region("asia-southeast1")
  .runWith({ secrets: ["ANTHROPIC_API_KEY"] })
  .pubsub.schedule("0 7 * * 1")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let created = 0;
    for (const item of MARKETING_DRAFT_KINDS) {
      try {
        const reply = await callMarketingAI(apiKey, item.prompt);
        await db.collection("marketingDrafts").add({
          kind: item.kind,
          label: item.label,
          content: reply,
          status: "draft",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
      } catch (e) {
        console.error("[weeklyMarketingDrafts]", item.kind, e);
      }
    }
    if (created > 0) {
      await notifyFounder(
        "📝 Bài nháp Marketing tuần mới",
        `${created} bản nháp đang chờ duyệt trong tab Trợ lý Marketing`,
        { type: "MARKETING_DRAFTS_READY" }
      );
    }
    return null;
  });

/* ── Đăng bài lên Trang Facebook ALN — Founder bấm 1 nút từ "Bài chờ duyệt".
   LUÔN là hành động thủ công của Founder (không tự động đăng), đúng nguyên
   tắc: AI soạn, người duyệt & đăng. Dùng Page token vĩnh viễn (FB_PAGE_TOKEN). */
exports.postToFacebook = onCall(
  { region: "asia-southeast1", secrets: [FB_PAGE_TOKEN] },
  async (request) => {
    if (!request.auth || request.auth.uid !== FOUNDER_UID) {
      throw new HttpsError("permission-denied", "Chỉ Founder mới đăng bài được");
    }
    const { message, draftId, imageUrl } = request.data || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new HttpsError("invalid-argument", "Thiếu nội dung bài");
    }
    const hasImg = imageUrl && typeof imageUrl === "string" && /^https:\/\//.test(imageUrl.trim());
    // trim() vì secret nhập tay qua "firebase functions:secrets:set" có thể
    // dính khoảng trắng/xuống dòng thừa lúc paste — FB báo "Cannot parse
    // access token" dù token gốc đúng.
    const token = (FB_PAGE_TOKEN.value() || "").trim();
    // Log AN TOÀN (chỉ độ dài, không log giá trị) — đối chiếu với log cùng
    // dạng ở postCamNangToFacebook khi cần so token 2 hàm có khớp không.
    console.log("[postToFacebook] FB_PAGE_TOKEN.length=" + (token ? token.length : 0));
    try {
      // Có ảnh → đăng lên /photos (caption = nội dung); không ảnh → /feed
      const endpoint = hasImg ? "photos" : "feed";
      const payload = hasImg
        ? { url: imageUrl.trim(), caption: message.trim(), access_token: token }
        : { message: message.trim(), access_token: token };
      const resp = await fetch(`https://graph.facebook.com/v21.0/${FB_PAGE_ID}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        console.error("[postToFacebook] FB error:", JSON.stringify(data.error || data));
        throw new HttpsError("internal", "Facebook từ chối: " + ((data.error && data.error.message) || ("HTTP " + resp.status)));
      }
      if (draftId) {
        try {
          await db.collection("marketingDrafts").doc(draftId).update({
            status: "posted",
            postedAt: admin.firestore.FieldValue.serverTimestamp(),
            fbPostId: data.id || "",
          });
        } catch (e) { console.warn("[postToFacebook] update draft:", e); }
      }
      return { ok: true, postId: data.id || "" };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("[postToFacebook]", e);
      throw new HttpsError("internal", e.message || "Lỗi đăng bài");
    }
  }
);

/* ── Đăng bài Cẩm nang lên Facebook TỰ ĐỘNG khi build-cam-nang.js (GitHub
   Actions) xuất bản một bài có "facebook: true" trong frontmatter. Khác với
   postToFacebook (đòi Founder đăng nhập, bấm tay), hàm này được gọi từ workflow
   nên xác thực bằng CAM_NANG_FB_SECRET (header x-cam-nang-secret) thay vì
   Firebase Auth. Nội dung Cẩm nang đã duyệt lúc soạn nên không cần duyệt lại.
   Lỗi KHÔNG được để im lặng: log rõ + báo Founder qua push, nhưng không throw
   ra ngoài để tránh ảnh hưởng gì tới phía gọi (script vẫn phải cho web publish
   tiếp tục dù bước này lỗi). */
exports.postCamNangToFacebook = onRequest(
  { region: "asia-southeast1", secrets: [FB_PAGE_TOKEN, CAM_NANG_FB_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    // Header đến ở dạng base64 (xem scripts/build-cam-nang.js) vì secret gốc
    // có thể chứa ký tự ngoài ASCII — HTTP header không cho phép giá trị đó
    // trực tiếp. Decode lại rồi mới so khớp với secret gốc. trim() cả 2 phía
    // để chịu được khoảng trắng/xuống dòng thừa lúc copy-paste secret vào
    // GitHub Actions / Firebase Secret Manager (2 nơi nhập khác cơ chế nhau).
    let receivedSecret = "";
    try {
      receivedSecret = Buffer.from(req.get("x-cam-nang-secret") || "", "base64").toString("utf8").trim();
    } catch (e) { receivedSecret = ""; }
    const configuredSecret = (CAM_NANG_FB_SECRET.value() || "").trim();
    // Log ĐỘ DÀI thôi, không log giá trị — dùng để chẩn đoán lệch secret /
    // deploy cũ mà không lộ nội dung secret ra Cloud Functions log.
    console.log(
      "[postCamNangToFacebook] build=2026-07-05-b64fix secret check — received.length=" +
      receivedSecret.length + ", configured.length=" + configuredSecret.length +
      ", match=" + (receivedSecret === configuredSecret)
    );
    if (!configuredSecret || receivedSecret !== configuredSecret) {
      // Chỉ báo Founder khi payload đúng hình dạng bài Cẩm nang (title+url) —
      // endpoint này public trên internet, bot/scanner dò URL ngẫu nhiên cũng
      // ra 401 nhưng không nên làm founder bị spam push oan vì noise đó.
      const body = req.body || {};
      if (body.title && body.url && typeof body.title === "string" && typeof body.url === "string") {
        console.error("[postCamNangToFacebook] Secret không khớp — bài \"" + (body.slug || body.title) + "\" bị từ chối.");
        await notifyFounder(
          "⚠️ Đăng Cẩm nang lên Facebook thất bại",
          `Bài "${body.title}" (${body.slug || "?"}) bị từ chối do secret không khớp — kiểm tra CAM_NANG_FB_SECRET giữa GitHub Actions và Firebase Secret Manager có đồng bộ không.`,
          { type: "CAM_NANG_FB_POST_FAILED", slug: body.slug || "" }
        );
      }
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { title, description, url, imageUrl, slug } = req.body || {};
    if (!title || !url || typeof title !== "string" || typeof url !== "string") {
      res.status(400).json({ error: "Thiếu title/url" });
      return;
    }
    const message = [title.trim(), (description || "").trim(), "Xem chi tiết: " + url.trim()]
      .filter(Boolean)
      .join("\n\n");
    const hasImg = typeof imageUrl === "string" && /^https:\/\//.test(imageUrl.trim());
    // trim() cùng lý do với postToFacebook — secret paste tay có thể dính ký tự thừa.
    const token = (FB_PAGE_TOKEN.value() || "").trim();
    // Log AN TOÀN (chỉ độ dài, không log giá trị) — so với log cùng dạng ở
    // postToFacebook (đăng tay, đang chạy được) để biết 2 hàm có đang dùng
    // đúng CÙNG version FB_PAGE_TOKEN hay không (Secret Manager pin theo
    // version tại thời điểm deploy — hàm deploy sau có thể lấy version khác).
    console.log("[postCamNangToFacebook] FB_PAGE_TOKEN.length=" + (token ? token.length : 0) + ", slug=" + (slug || "?"));
    try {
      const endpoint = hasImg ? "photos" : "feed";
      const payload = hasImg
        ? { url: imageUrl.trim(), caption: message, access_token: token }
        : { message: message, access_token: token };
      const resp = await fetch(`https://graph.facebook.com/v21.0/${FB_PAGE_ID}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        const errMsg = (data.error && data.error.message) || ("HTTP " + resp.status);
        console.error("[postCamNangToFacebook] FB error:", slug, JSON.stringify(data.error || data));
        await notifyFounder(
          "⚠️ Đăng Cẩm nang lên Facebook thất bại",
          `Bài "${title}" (${slug || "?"}) không đăng được lên Fanpage: ${errMsg}`,
          { type: "CAM_NANG_FB_POST_FAILED", slug: slug || "" }
        );
        res.status(502).json({ error: "Facebook từ chối: " + errMsg });
        return;
      }
      res.status(200).json({ ok: true, postId: data.id || "" });
    } catch (e) {
      console.error("[postCamNangToFacebook]", slug, e);
      await notifyFounder(
        "⚠️ Đăng Cẩm nang lên Facebook thất bại",
        `Bài "${title}" (${slug || "?"}) lỗi khi đăng lên Fanpage: ${e.message || e}`,
        { type: "CAM_NANG_FB_POST_FAILED", slug: slug || "" }
      );
      res.status(500).json({ error: e.message || "Lỗi đăng bài" });
    }
  }
);

/* ── Giám sát lỗi JS phía client (window.onerror/unhandledrejection, xem
   error-monitor.js) → ghi Firestore errors/ qua Admin SDK. Client KHÔNG ghi
   thẳng Firestore (App Check hay fail cho khách vãng lai — xem bài học ở
   duToanLeads.js) và không cần biết chuyện xoay findings với founder ngay —
   dedup theo hash(message+url) làm doc ID nên chỉ 1 write, không cần đọc
   trước; đếm gộp vào dailyDigest 08:00 thay vì dashboard riêng. Không thu
   thập tên/SĐT/uid — chỉ message/stack/url/user-agent. */
exports.logClientError = onRequest(
  { region: "asia-southeast1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }
    try {
      const body = req.body || {};
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
      if (!message) {
        res.status(400).end();
        return;
      }
      const stack = typeof body.stack === "string" ? body.stack.slice(0, 1000) : "";
      const url = typeof body.url === "string" ? body.url.slice(0, 300) : "";
      const userAgent = (req.get("user-agent") || "").slice(0, 300);

      const dedupKey = crypto.createHash("md5").update(message + "|" + url).digest("hex");
      await db.collection("errors").doc(dedupKey).set({
        message, stack, url, userAgent,
        count: admin.firestore.FieldValue.increment(1),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.status(204).end();
    } catch (e) {
      console.error("[logClientError]", e);
      res.status(500).end();
    }
  }
);

/* ── Bài mới trong Nhịp sống ALN → thông báo Founder + KTS + Designer ── */
exports.onCommunityPost = functions
  .region("asia-southeast1")
  .firestore.document("alnPosts/{postId}")
  .onCreate(async (snap, context) => {
    const d = snap.data() || {};
    const authorUid  = d.authorUid  || "";
    const authorName = d.authorName || "Ai đó";
    const tagLabel   = { arch: "Kiến trúc", land: "Cảnh quan", nat: "Thiên nhiên" };
    const hasVideo   = Array.isArray(d.media) && d.media.some(function(m){ return m.type === "video"; });

    const title   = hasVideo
      ? "🎬 " + authorName + " vừa đăng clip mới"
      : "📸 " + authorName + " vừa đăng khoảnh khắc";
    const preview = d.text
      ? (d.text.length > 55 ? d.text.slice(0, 55) + "..." : d.text)
      : (tagLabel[d.tag] || "Nhịp sống ALN");

    const [ktsSnap, desSnap] = await Promise.all([
      db.collection("users").where("role", "==", "kts").get(),
      db.collection("users").where("role", "==", "designer").get(),
    ]);

    const uids = new Set([FOUNDER_UID]);
    ktsSnap.docs.forEach(function(doc){ uids.add(doc.id); });
    desSnap.docs.forEach(function(doc){ uids.add(doc.id); });
    uids.delete(authorUid);

    const extra = { type: "NEW_COMMUNITY_POST", postId: context.params.postId };
    await Promise.all(Array.from(uids).map(function(uid){
      return notifyUser(uid, title, preview, extra, "community");
    }));
    return null;
  });

/* ── Founder xác nhận thanh toán → thông báo KTS ── */
exports.onPaymentConfirmed = functions
  .region("asia-southeast1")
  .firestore.document("projects/{pid}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after  = change.after.data()  || {};
    const beforePay = before.payments || {};
    const afterPay  = after.payments  || {};

    for (const stage of ['C1','C2','C3','C4']) {
      const bp = beforePay[stage] || {};
      const ap = afterPay[stage]  || {};
      if (bp.status !== 'paid' && ap.status === 'paid') {
        const ktsUid  = ap.ktsUid || '';
        const amount  = ap.amount || 0;
        const projName = after.name || context.params.pid;
        if (!ktsUid) continue;
        await notifyUser(
          ktsUid,
          "💵 Thanh toán chặng " + stage + " đã xác nhận",
          `"${projName}" — ${(amount/1000000).toFixed(1)}tr đã được chuyển`,
          { type: "PAYMENT_CONFIRMED", pid: context.params.pid, stage, amount: String(amount) },
          "kts"
        );
      }
    }
    return null;
  });

/* ── Xóa địa điểm tạm thời đã hết hạn (chạy mỗi 6 tiếng) ── */
exports.clearExpiredTemporaryLocations = functions
  .region("asia-southeast1")
  .pubsub.schedule("every 6 hours")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    const now = new Date();
    const snap = await db.collection("users")
      .where("temporaryLocation", "!=", null)
      .get();
    if (snap.empty) return null;

    const batch = db.batch();
    let count = 0;
    snap.docs.forEach(function(d) {
      const tl = d.data().temporaryLocation;
      if (!tl || !tl.province) {
        batch.update(d.ref, { temporaryLocation: admin.firestore.FieldValue.delete() });
        count++;
        return;
      }
      const until = tl.until && (tl.until.toDate ? tl.until.toDate() : new Date(tl.until));
      if (!until || until <= now) {
        batch.update(d.ref, { temporaryLocation: admin.firestore.FieldValue.delete() });
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      console.log("[ALN] Cleared " + count + " expired temporaryLocation(s)");
    }
    return null;
  });

/* ── DN tạo project mới qua Cloud Function (bypass client-side permissions) ── */
exports.createProjectForDN = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    // 1. Xác thực
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
    const dnUid = request.auth.uid;

    // 2. Kiểm tra role DN (hoặc founder)
    const userSnap = await db.collection("users").doc(dnUid).get();
    if (!userSnap.exists) throw new HttpsError("not-found", "Không tìm thấy tài khoản");
    const userRole = (userSnap.data() || {}).role;
    if (userRole !== "dn" && userRole !== "founder") {
      throw new HttpsError("permission-denied", "Chỉ tài khoản DN mới tạo được yêu cầu");
    }

    // 3. Validate dữ liệu đầu vào
    const p = request.data || {};
    if (!p.projectName || typeof p.projectName !== "string" || !p.projectName.trim()) {
      throw new HttpsError("invalid-argument", "Thiếu tên công trình");
    }

    // 4. Xác định frame type: white-label → navy, ALN-direct → gold
    const isWhiteLabel = !!(p.projectType === "whitelabel" || (userSnap.data() || {}).whitelabel);
    const frameType = isWhiteLabel ? "navy" : "gold";
    const resolvedProjectType = isWhiteLabel ? "whitelabel" : (p.projectType || "aln_direct");

    // 5. Ghi vào matchingRequests bằng Admin SDK (không bị chặn bởi security rules)
    const docRef = await db.collection("matchingRequests").add({
      dnId:                   dnUid,
      dnName:                 (userSnap.data() || {}).name || "",
      projectName:            p.projectName.trim(),
      projectType:            resolvedProjectType,
      projectConstructionType:p.projectConstructionType || "",
      areaSqm:                p.areaSqm || "",
      projectProvince:        p.projectProvince || "",
      meetingProvince:        p.meetingProvince || "",
      stylePrefs:             Array.isArray(p.stylePrefs) ? p.stylePrefs : [],
      budgetTier:             p.budgetTier || "",
      ktsPreference: {
        gender:     p.ktsPreference && p.ktsPreference.gender     || "",
        experience: p.ktsPreference && p.ktsPreference.experience || "",
        note:       p.ktsPreference && p.ktsPreference.note       || "",
      },
      priority:    p.priority || "normal",
      expressFee:  p.priority === "express" ? 2500000 : 0,
      frameType,
      status:      "pending_founder",
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    // 6. Express: đặt deadline cho Founder
    if (p.priority === "express") {
      await docRef.update({
        founderDeadline: new Date(Date.now() + 4 * 3600 * 1000),
      });
    }

    // 7. Thông báo Founder
    await notifyFounder(
      p.priority === "express" ? "⚡ Yêu cầu Express mới!" : "📋 Yêu cầu ghép KTS mới",
      `${(userSnap.data() || {}).name || "DN"} — ${p.projectName.trim()}`,
      { type: "NEW_PROJECT_REQUEST", projectId: docRef.id, priority: p.priority || "normal" }
    );

    return { ok: true, projectId: docRef.id };
  }
);

/* ════════════════════════════════════════════════════════════════
   MyMy Agent Loop — DN
   ════════════════════════════════════════════════════════════════ */

const MYMY_MAX_ITER = 8;
const MYMY_ALLOWLIST = [
  "check_dn_exists","get_dn_profile","check_project_requirements",
  "determine_frame_type","ask_user","request_confirmation",
  "save_dn_profile","submit_new_project",
];
const MYMY_WRITE_TOOLS = ["save_dn_profile","submit_new_project"];

const MYMY_TOOLS = [
  {
    name:"check_dn_exists",
    description:"Kiểm tra DN đã có hồ sơ trên ALN hay chưa. Gọi đầu phiên để quyết định pha onboarding hay per-project. Chỉ đọc.",
    input_schema:{type:"object",properties:{dn_id:{type:"string"}},required:["dn_id"]}
  },
  {
    name:"get_dn_profile",
    description:"Lấy hồ sơ DN đã lưu. Gọi khi cần thông tin DN để tạo project hoặc cá nhân hoá hội thoại. Chỉ đọc.",
    input_schema:{type:"object",properties:{dn_id:{type:"string"}},required:["dn_id"]}
  },
  {
    name:"check_project_requirements",
    description:"Validate bản nháp project. Trả danh sách trường còn thiếu. Gọi sau khi thu thập brief, TRƯỚC khi xin xác nhận.",
    input_schema:{type:"object",properties:{draft:{type:"object",properties:{title:{type:"string"},project_type:{type:"string"},client_name:{type:"string"},client_phone:{type:"string"},project_location:{type:"string"},scope:{type:"string"},budget_range:{type:"string"}}}},required:["draft"]}
  },
  {
    name:"determine_frame_type",
    description:"Xác định loại khung bản vẽ: white-label B2B → 'navy'; ALN-direct → 'gold'. LUÔN gọi tool này thay vì tự suy. Chỉ đọc.",
    input_schema:{type:"object",properties:{is_white_label:{type:"boolean"}},required:["is_white_label"]}
  },
  {
    name:"ask_user",
    description:"Hỏi DN một thông tin còn thiếu. Mỗi lần hỏi một ý, tiếng Việt thân thiện. Kết thúc lượt sau khi gọi.",
    input_schema:{type:"object",properties:{question:{type:"string"},field:{type:"string"}},required:["question"]}
  },
  {
    name:"request_confirmation",
    description:"BẮT BUỘC gọi trước mọi thao tác ghi. Hiển thị tóm tắt dữ liệu + badge frame + nút Xác nhận/Sửa lại. KHÔNG tự gọi tool ghi khi chưa được DN xác nhận. Kết thúc lượt.",
    input_schema:{type:"object",properties:{action:{type:"string",enum:["save_dn_profile","submit_new_project"]},summary:{type:"string"},frame:{type:"string",enum:["gold","navy"]},payload:{type:"object"}},required:["action","summary","payload"]}
  },
  {
    name:"save_dn_profile",
    description:"Lưu hồ sơ DN khi kết thúc onboarding. CHỈ gọi sau khi đã qua request_confirmation và DN đã xác nhận.",
    input_schema:{type:"object",properties:{dn_id:{type:"string"},profile:{type:"object",properties:{business_name:{type:"string"},industry:{type:"string"},contact_name:{type:"string"},contact_phone:{type:"string"},is_white_label:{type:"boolean"}},required:["business_name","contact_name"]}},required:["dn_id","profile"]}
  },
  {
    name:"submit_new_project",
    description:"Tạo project mới cho DN vào matchingRequests. CHỈ gọi sau khi đã qua request_confirmation và DN đã xác nhận. Nếu lỗi permission-denied, giải thích bằng tiếng Việt, không trả màn hình rỗng.",
    input_schema:{type:"object",properties:{dn_id:{type:"string"},project:{type:"object",properties:{title:{type:"string"},project_type:{type:"string"},scope:{type:"string"},budget_range:{type:"string"},client_name:{type:"string"},client_phone:{type:"string"},project_location:{type:"string"},notes:{type:"string"}},required:["title","project_type","client_name"]}},required:["dn_id","project"]}
  },
];

function mymyBuildSystemPrompt(dnName, honorific, state) {
  const phase = state.onboarding_complete ? "per-project" : "onboarding";
  const lastName = dnName ? dnName.trim().split(/\s+/).pop() : "";
  const addr = honorific && lastName ? honorific + " " + lastName
             : honorific ? honorific
             : lastName || "bạn";
  const genderInstruction = honorific
    ? `Đã biết cách gọi — dùng "${addr}" xuyên suốt, KHÔNG hỏi lại.`
    : `Chưa biết cách gọi (hồ sơ DN chưa có giới tính) — câu ĐẦU TIÊN phải hỏi: "Em gọi là anh hay chị ạ?" rồi dùng xuyên suốt. KHÔNG dùng "anh/chị" kết hợp, KHÔNG dùng "bạn".`;
  return `Bạn là MyMy, nhân viên chăm sóc khách hàng của ALN (App Làm Nhà) — nền tảng quản lý công trình xây dựng cao cấp.
Bạn đang hỗ trợ Doanh nghiệp tên: ${dnName || "(chưa rõ)"}.
Pha hiện tại: ${phase}.

THÔNG TIN VỀ BẠN:
- Tên: MyMy, nữ, khoảng 22 tuổi, nhẹ nhàng, ấm áp, tận tâm
- XƯNG: "em" — gọi khách: "${addr}"
- ${genderInstruction}
- Ngôn ngữ: "dạ", "ạ", "nha", "á", "vậy hả" — như người thật nhắn tin
- KHÔNG dùng dấu **, gạch đầu dòng, tiêu đề, đoạn văn dài
- TUYỆT ĐỐI không nhận là AI hay chatbot

HIỂU VỀ KHÁCH HÀNG DN (QUAN TRỌNG):
- DN là các công ty xây dựng, thi công, hoặc tư vấn có thương hiệu riêng
- Họ thuê studio KTS của ALN để có đội thiết kế phục vụ khách hàng của họ
- Sản phẩm thiết kế vẫn mang THƯƠNG HIỆU của DN — không phải thương hiệu ALN
- DN không làm thuê cho ai — họ chủ động thuê dịch vụ KTS để phục vụ khách của mình

${!state.onboarding_complete ? `PHA ONBOARDING: Thu thập thông tin hồ sơ DN (tên công ty, lĩnh vực, người liên hệ, số điện thoại). Sau khi đủ, dùng request_confirmation → save_dn_profile.` : `PHA PER-PROJECT: Thu thập brief dự án cho KHÁCH HÀNG CỦA DN (không phải thông tin DN).
Các thông tin cần có:
- Tên dự án / công trình
- Tên khách hàng của DN (chủ đầu tư)
- Số điện thoại khách hàng
- Địa điểm công trình
- Loại công trình (nhà ở, văn phòng, thương mại...)
- Phạm vi thiết kế
- Ngân sách dự kiến
Chỉ hỏi những gì còn thiếu, mỗi lần hỏi một ý. Sau khi đủ: check_project_requirements → determine_frame_type → request_confirmation → submit_new_project.`}

QUY TẮC BẮT BUỘC:
1. Luôn gọi check_dn_exists ĐẦU phiên để biết pha.
2. Trước khi ghi (save_dn_profile / submit_new_project): BẮT BUỘC gọi request_confirmation trước.
3. KHÔNG tự ghi khi chưa có xác nhận của DN.
4. Hỏi từng ý một bằng ask_user — không hỏi nhiều thứ cùng lúc.
5. Nếu lỗi permission-denied, giải thích cho DN và đề nghị thử lại — không trả trống.

PHẠM VI HỖ TRỢ — CHỈ NÓI VỀ:
- Hỗ trợ DN tạo yêu cầu dự án mới
- Hỗ trợ thu thập thông tin dự án / khách hàng của DN
- Giải đáp thắc mắc về quy trình ALN ở mức chung

TUYỆT ĐỐI KHÔNG TIẾT LỘ:
- Thông tin nội bộ ALN (phí hoa hồng, cơ cấu tổ chức, doanh thu)
- Thông tin của DN khác hoặc KTS khác
- Chi tiết kỹ thuật hệ thống, database, API
- Nếu bị hỏi những điều này: "Dạ câu đó em chưa tiện chia sẻ được, bạn cần hỗ trợ gì khác không ạ?"`;
}

async function mymySaveMessage(dnUid, role, text) {
  await db.collection("mymy_sessions").doc(dnUid).collection("messages").add({
    role, text, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function mymyCallClaude(apiKey, systemPrompt, messages, tools) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "x-api-key":apiKey,
      "anthropic-version":"2023-06-01",
      "content-type":"application/json",
    },
    body:JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:1024,
      system:systemPrompt,
      messages,
      tools,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("[runMyMyTurn] Claude error:", err);
    throw new HttpsError("internal","Lỗi kết nối AI");
  }
  return resp.json();
}

async function mymyExecCheckDnExists(dnUid) {
  const snap = await db.collection("users").doc(dnUid).get();
  if (!snap.exists) return { ok:true, exists:false };
  const d = snap.data() || {};
  const onboarded = !!(d.mymy_dn_onboarded || (d.dn_profile && d.dn_profile.business_name));
  return { ok:true, exists:onboarded };
}

async function mymyExecGetDnProfile(dnUid) {
  const snap = await db.collection("users").doc(dnUid).get();
  if (!snap.exists) return { ok:false, error:{ code:"not-found", message:"Không tìm thấy hồ sơ DN" } };
  const d = snap.data() || {};
  return { ok:true, profile:{ name:d.name||"", business_name:d.dn_profile&&d.dn_profile.business_name||d.name||"", industry:d.dn_profile&&d.dn_profile.industry||"", contact_name:d.dn_profile&&d.dn_profile.contact_name||d.name||"", is_white_label:!!(d.assignedStudioId), assignedStudioId:d.assignedStudioId||null } };
}

function mymyExecCheckProjectRequirements(draft) {
  const required = ["title","project_type","client_name"];
  const missing = required.filter(k => !draft[k] || String(draft[k]).trim()==="");
  return { ok:true, valid:missing.length===0, missing };
}

async function mymyExecSaveDnProfile(dnUid, profile) {
  try {
    await db.collection("users").doc(dnUid).set({
      dn_profile:{
        business_name: profile.business_name||"",
        industry:      profile.industry||"",
        contact_name:  profile.contact_name||"",
        contact_phone: profile.contact_phone||"",
        is_white_label:!!profile.is_white_label,
        onboardedAt:   admin.firestore.FieldValue.serverTimestamp(),
      },
      mymy_dn_onboarded: true,
    },{ merge:true });
    return { ok:true, dn_id:dnUid };
  } catch(e) {
    console.error("[mymyExecSaveDnProfile]",e);
    return { ok:false, error:{ code:"internal", message:e.message } };
  }
}

async function mymyExecSubmitNewProject(dnUid, project) {
  try {
    const userSnap = await db.collection("users").doc(dnUid).get();
    const user = userSnap.exists ? userSnap.data() : {};
    const isWhiteLabel = !!(user.assignedStudioId);
    const frameType = isWhiteLabel ? "navy" : "gold";

    const docRef = await db.collection("matchingRequests").add({
      dnId:            dnUid,
      dnName:          user.name||"",
      projectName:     (project.title||"").trim(),
      projectType:     project.project_type||"",
      scope:           project.scope||"",
      budget:          project.budget_range||"",
      clientName:      project.client_name||"",
      clientPhone:     project.client_phone||"",
      projectLocation: project.project_location||"",
      notes:           project.notes||"",
      whitelabel:      isWhiteLabel,
      frameType,
      status:          "pending_founder",
      created_via:     "mymy",
      createdAt:       admin.firestore.FieldValue.serverTimestamp(),
    });
    await notifyFounder(
      "📋 Yêu cầu dự án mới từ MyMy",
      `${user.name||"DN"} — ${(project.title||"").trim()}`,
      { type:"NEW_PROJECT_REQUEST", projectId:docRef.id }
    );
    return { ok:true, projectId:docRef.id };
  } catch(e) {
    console.error("[mymyExecSubmitNewProject]",e);
    const code = e.code==="permission-denied"?"permission-denied":"internal";
    return { ok:false, error:{ code, message:e.message } };
  }
}

exports.runMyMyTurn = onCall(
  { region:"asia-southeast1", secrets:[ANTHROPIC_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated","Chưa đăng nhập");
    const dnUid = request.auth.uid;
    const { userMessage, confirmAction } = request.data || {};

    const sessionRef = db.collection("mymy_sessions").doc(dnUid);
    const sessionSnap = await sessionRef.get();
    let state = sessionSnap.exists ? sessionSnap.data() : {
      dn_id:dnUid, phase:"onboarding", onboarding_complete:false,
      current_project_draft:{ title:null, project_type:null, is_white_label:false, scope:null, budget_range:null },
      iteration_count:0, pending_confirmation:null, updated_at:null,
    };

    // Handle confirmation button (true = xác nhận, false = sửa lại)
    if (confirmAction === true && state.pending_confirmation) {
      const pc = state.pending_confirmation;
      let result;
      if (pc.action==="save_dn_profile") {
        result = await mymyExecSaveDnProfile(dnUid, pc.payload.profile||pc.payload);
      } else if (pc.action==="submit_new_project") {
        result = await mymyExecSubmitNewProject(dnUid, pc.payload.project||pc.payload);
      } else {
        result = { ok:false, error:{ code:"unknown", message:"Hành động không xác định" } };
      }
      state.pending_confirmation = null;
      let replyText;
      if (result.ok) {
        if (pc.action==="save_dn_profile") {
          replyText = "Đã lưu hồ sơ thành công! ✅\n\nBây giờ bạn muốn tạo yêu cầu dự án mới không?";
          state.onboarding_complete = true;
          state.phase = "project";
        } else {
          replyText = `Đã tạo yêu cầu dự án thành công! 🎉\n\nFounder ALN sẽ xem xét và ghép KTS phù hợp cho bạn sớm nhất có thể. Bạn có thể theo dõi trạng thái trên dashboard nhé!`;
          state.current_project_draft = { title:null, project_type:null, is_white_label:false, scope:null, budget_range:null };
        }
      } else {
        if (result.error && result.error.code==="permission-denied") {
          replyText = "Xin lỗi bạn, có lỗi quyền truy cập khi tạo dự án. Bạn thử lại được không ạ? Nếu vẫn lỗi, nhóm ALN sẽ hỗ trợ bạn trực tiếp.";
        } else {
          replyText = `Xin lỗi, có lỗi xảy ra: ${result.error&&result.error.message||"Lỗi không xác định"}. Bạn thử lại sau được không ạ?`;
        }
      }
      await mymySaveMessage(dnUid,"assistant",replyText);
      await sessionRef.set({ ...state, updated_at:admin.firestore.FieldValue.serverTimestamp() },{ merge:true });
      return { reply:replyText, pending_confirmation:null };
    }

    if (confirmAction === false) {
      state.pending_confirmation = null;
      const cancelReply = "Được rồi bạn! Mình cùng xem lại thông tin và chỉnh sửa nhé. Bạn muốn thay đổi gì ạ?";
      await mymySaveMessage(dnUid,"assistant",cancelReply);
      await sessionRef.set({ ...state, pending_confirmation:null, updated_at:admin.firestore.FieldValue.serverTimestamp() },{ merge:true });
      return { reply:cancelReply, pending_confirmation:null };
    }

    // Regular user message
    if (!userMessage || !String(userMessage).trim()) {
      throw new HttpsError("invalid-argument","Tin nhắn không được để trống");
    }
    await mymySaveMessage(dnUid,"user",userMessage);
    state.iteration_count = 0;

    // Load recent messages (N=20)
    const msgsSnap = await db.collection("mymy_sessions").doc(dnUid)
      .collection("messages").orderBy("createdAt","desc").limit(20).get();
    const apiMessages = msgsSnap.docs.reverse().map(d => {
      const m = d.data();
      return { role:m.role, content:m.text||"" };
    }).filter(m => m.role==="user"||m.role==="assistant");

    const userSnap = await db.collection("users").doc(dnUid).get();
    const dnUser = userSnap.exists ? userSnap.data() : {};
    const dnName = dnUser.name || "";
    const dnHonorific = dnUser.gender === "female" ? "chị" : dnUser.gender === "male" ? "anh" : "";
    const systemPrompt = mymyBuildSystemPrompt(dnName, dnHonorific, state);
    const apiKey = ANTHROPIC_KEY.value();

    let finalReply = null;
    let pendingConfirmation = null;

    while (state.iteration_count < MYMY_MAX_ITER) {
      const claudeData = await mymyCallClaude(apiKey, systemPrompt, apiMessages, MYMY_TOOLS);
      const content = claudeData.content || [];
      const toolUseBlocks = content.filter(b => b.type==="tool_use");
      const textBlocks = content.filter(b => b.type==="text");

      if (toolUseBlocks.length === 0) {
        finalReply = textBlocks.map(b => b.text).join("\n");
        break;
      }

      apiMessages.push({ role:"assistant", content });
      const toolResults = [];
      let breakLoop = false;

      for (const tu of toolUseBlocks) {
        const tName = tu.name;
        const tInput = tu.input || {};

        if (!MYMY_ALLOWLIST.includes(tName)) {
          toolResults.push({ type:"tool_result", tool_use_id:tu.id, content:JSON.stringify({ ok:false, error:{ code:"not-allowed", message:"Tool không được phép" } }) });
          continue;
        }

        if (MYMY_WRITE_TOOLS.includes(tName)) {
          // Write without confirmation: reject and tell Claude
          toolResults.push({ type:"tool_result", tool_use_id:tu.id, content:JSON.stringify({ ok:false, error:{ code:"confirmation-required", message:"Cần gọi request_confirmation và chờ người dùng xác nhận trước." } }) });
          continue;
        }

        if (tName==="ask_user") {
          finalReply = tInput.question;
          breakLoop = true; break;
        }
        if (tName==="request_confirmation") {
          pendingConfirmation = { action:tInput.action, summary:tInput.summary, frame:tInput.frame||null, payload:tInput.payload };
          breakLoop = true; break;
        }

        let res;
        if (tName==="check_dn_exists")            res = await mymyExecCheckDnExists(tInput.dn_id||dnUid);
        else if (tName==="get_dn_profile")         res = await mymyExecGetDnProfile(tInput.dn_id||dnUid);
        else if (tName==="check_project_requirements") res = mymyExecCheckProjectRequirements(tInput.draft||{});
        else if (tName==="determine_frame_type")   res = { ok:true, frame:tInput.is_white_label?"navy":"gold" };
        else res = { ok:false, error:{ code:"unknown", message:"Tool không xác định" } };

        toolResults.push({ type:"tool_result", tool_use_id:tu.id, content:JSON.stringify(res) });
      }

      if (breakLoop) break;
      if (toolResults.length) {
        apiMessages.push({ role:"user", content:toolResults });
      }
      state.iteration_count++;
    }

    if (state.iteration_count >= MYMY_MAX_ITER && !finalReply && !pendingConfirmation) {
      finalReply = "MyMy cần chuyển vấn đề này cho người phụ trách xử lý ạ. Bạn vui lòng chờ ALN liên hệ sớm nhé! 🙏";
      console.warn("[runMyMyTurn] MAX_ITER reached for dn:", dnUid);
    }

    if (pendingConfirmation) state.pending_confirmation = pendingConfirmation;
    await sessionRef.set({ ...state, updated_at:admin.firestore.FieldValue.serverTimestamp() },{ merge:true });
    if (finalReply) await mymySaveMessage(dnUid,"assistant",finalReply);

    return { reply:finalReply||null, pending_confirmation:pendingConfirmation||null };
  }
);

exports.saveDnProfile = onCall(
  { region:"asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated","Chưa đăng nhập");
    const dnUid = request.auth.uid;
    const { profile } = request.data || {};
    if (!profile || !profile.business_name || !profile.contact_name) {
      throw new HttpsError("invalid-argument","Thiếu tên DN hoặc người liên hệ");
    }
    const result = await mymyExecSaveDnProfile(dnUid, profile);
    if (!result.ok) throw new HttpsError("internal", result.error&&result.error.message||"Lỗi lưu hồ sơ");
    return result;
  }
);

/* ── KTS upload tài liệu → thông báo CN/DN ── */
exports.onDocUploaded = functions
  .region("asia-southeast1")
  .firestore.document("projects/{pid}/documents/{docId}")
  .onCreate(async (snap, context) => {
    const d = snap.data() || {};
    if (!d.uploader || d.uploader.role !== "kts") return null;

    const projSnap = await db.collection("projects").doc(context.params.pid).get();
    if (!projSnap.exists) return null;
    const proj = projSnap.data();
    const projName = proj.name || context.params.pid;

    const notifs = [];
    if (proj.cn && proj.cn.uid) {
      notifs.push(notifyUser(
        proj.cn.uid,
        "KTS vừa tải lên tài liệu mới",
        `Dự án "${projName}" — ${d.label || d.name} (${d.stage || ""})`,
        { type: "KTS_DOC_UPLOAD", pid: context.params.pid, stage: d.stage || "" },
        "cn"
      ));
    }
    if (proj.dn && proj.dn.uid) {
      notifs.push(notifyUser(
        proj.dn.uid,
        "KTS vừa tải lên tài liệu mới",
        `Dự án "${projName}" — ${d.label || d.name} (${d.stage || ""})`,
        { type: "KTS_DOC_UPLOAD", pid: context.params.pid, stage: d.stage || "" },
        "dn"
      ));
    }
    await Promise.all(notifs);
    return null;
  });

/* ── Matching Engine: ghép cặp CN–KTS theo tỉnh/thành (Spec Mục 3 + 10) ── */
exports.matchKts = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
    const { cnId } = request.data || {};
    if (!cnId) throw new HttpsError("invalid-argument", "Thiếu cnId");

    const cnSnap = await db.doc(`users/${cnId}`).get();
    if (!cnSnap.exists) throw new HttpsError("not-found", "CN không tồn tại");
    const cn = cnSnap.data();

    // Preset trọng số
    const PRESETS = {
      hop_gu:   { style: 45, proximity: 15, budget: 25, rating: 15 },
      can_bang: { style: 30, proximity: 25, budget: 25, rating: 20 },
      kts_gan:  { style: 15, proximity: 45, budget: 25, rating: 15 }
    };
    const NEARBY_MAP = {
      "TP.HCM":             ["Bình Dương", "Đồng Nai", "Long An", "Bà Rịa - Vũng Tàu", "Tiền Giang"],
      "Bà Rịa - Vũng Tàu": ["TP.HCM", "Đồng Nai", "Bình Thuận"],
      "Bình Dương":         ["TP.HCM", "Đồng Nai", "Bình Phước"],
      "Đồng Nai":           ["TP.HCM", "Bình Dương", "Bà Rịa - Vũng Tàu"],
      "Hà Nội":             ["Hưng Yên", "Bắc Ninh", "Hà Nam", "Vĩnh Phúc", "Hải Phòng"],
      "Đà Nẵng":            ["Quảng Nam", "Thừa Thiên Huế", "Quảng Ngãi"],
      "Cần Thơ":            ["Vĩnh Long", "Hậu Giang", "An Giang", "Kiên Giang", "Đồng Tháp"]
    };
    const ALL_PROVINCES = [
      "TP.HCM","Hà Nội","Đà Nẵng","Bình Dương","Đồng Nai","Bà Rịa - Vũng Tàu",
      "Long An","Tiền Giang","Cần Thơ","Khánh Hòa","Lâm Đồng","Bình Thuận",
      "Hải Phòng","Nghệ An","Thừa Thiên Huế","Quảng Nam","Bình Định"
    ];

    // Đọc preset từ config doc (fallback can_bang)
    let weights = PRESETS.can_bang;
    try {
      const cfgSnap = await db.doc("config/matchingWeights").get();
      if (cfgSnap.exists) {
        const preset = (cfgSnap.data().activePreset) || "can_bang";
        weights = PRESETS[preset] || PRESETS.can_bang;
      }
    } catch (e) {}

    const meetProvince = cn.meetingProvince || cn.province || "";

    async function queryByProvinces(provinces) {
      const chunks = [];
      for (let i = 0; i < provinces.length; i += 10) chunks.push(provinces.slice(i, i + 10));
      const seen = new Set(); const results = [];
      for (const chunk of chunks) {
        const snap = await db.collection("users")
          .where("role", "==", "kts")
          .where("available", "==", true)
          .where("serviceProvinces", "array-contains-any", chunk)
          .get();
        snap.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); results.push({ id: d.id, ...d.data() }); }});
      }
      return results;
    }

    async function getTempKts(province) {
      const snap = await db.collection("users")
        .where("role", "==", "kts")
        .where("available", "==", true)
        .where("temporaryLocation.province", "==", province)
        .where("temporaryLocation.availableUntil", ">", admin.firestore.Timestamp.now())
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data(), isTemporary: true }));
    }

    function dedup(arr) {
      const seen = new Set();
      return arr.filter(k => seen.has(k.id) ? false : (seen.add(k.id), true));
    }

    function overlap(a = [], b = []) {
      if (!a.length || !b.length) return 0;
      return a.filter(x => b.includes(x)).length / Math.max(a.length, b.length);
    }

    function scoreKts(kts, weights) {
      const hasStyle = cn.stylePrefs && cn.stylePrefs.length > 0;
      const w = hasStyle ? weights : { ...weights, style: 0 };
      const total = (w.style + w.proximity + w.budget + w.rating) || 1;
      const proximity = Math.max(0, 1 - (kts.distKm || 30) / 50);
      const style     = hasStyle ? overlap(kts.styles || [], cn.stylePrefs || []) : 0;
      const budget    = kts.priceTier === cn.budgetTier ? 1 : 0.4;
      const rating    = (kts.rating || 0) / 5;
      return Math.round((w.style * style + w.proximity * proximity + w.budget * budget + w.rating * rating) / total * 100);
    }

    // Fallback 3 bước
    let candidates = [];
    let expanded = false;
    let expandedTo = null;

    if (meetProvince) {
      const [main, temp] = await Promise.all([queryByProvinces([meetProvince]), getTempKts(meetProvince)]);
      candidates = dedup([...main, ...temp]);
    }
    if (candidates.length < 3) {
      const nearby = NEARBY_MAP[meetProvince] || [];
      if (nearby.length) {
        const extra = await queryByProvinces(nearby);
        candidates = dedup([...candidates, ...extra]);
        if (candidates.length >= 3) { expanded = true; expandedTo = nearby; }
      }
    }
    if (candidates.length < 3) {
      const all = await queryByProvinces(ALL_PROVINCES);
      candidates = dedup([...candidates, ...all]);
      expanded = true; expandedTo = ["Toàn quốc"];
    }

    const scored = candidates.map(k => ({ ...k, score: scoreKts(k, weights) }))
      .sort((a, b) => b.score - a.score);

    const top3 = scored.slice(0, 3).map((k, i) => ({
      ktsId:  k.id,
      rank:   i + 1,
      score:  k.score,
      scoreBreakdown: {
        style:     Math.round(overlap(k.styles || [], cn.stylePrefs || []) * 100),
        proximity: Math.round(Math.max(0, 1 - (k.distKm || 30) / 50) * 100),
        budget:    k.priceTier === cn.budgetTier ? 100 : 40,
        rating:    Math.round((k.rating || 0) / 5 * 100)
      },
      name:         k.name || "",
      tier:         k.tier || "",
      homeProvince: k.homeProvince || "",
      capacity:     k.capacity !== undefined ? k.capacity : null,
      isTemporary:  k.isTemporary || false
    }));

    // Ghi vào matchingRequests
    const reqRef = db.collection("matchingRequests").doc();
    await reqRef.set({
      cnId,
      status:      "pending_founder",
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      suggestions: top3,
      selectedKtsId: null,
      founderNote:   "",
      skippedKts:    [],
      meta: { expanded, expandedTo, styleIgnored: !(cn.stylePrefs && cn.stylePrefs.length), preset: "can_bang" }
    });

    // Thông báo Founder
    await notifyFounder(
      "🔗 Yêu cầu ghép cặp mới",
      `CN ${cn.name || cnId} — ${top3.length} KTS đề xuất`,
      { type: "MATCH_REQUEST", requestId: reqRef.id, cnId }
    );

    return { requestId: reqRef.id, suggestions: top3, meta: { expanded, expandedTo } };
  }
);

/* ── C2 Monitoring: quét tín hiệu nghi ngờ mỗi 12 giờ (Spec Mục 4.4) ── */
exports.scanC2Suspicion = functions
  .region("asia-southeast1")
  .pubsub.schedule("every 12 hours")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    const activeC2 = await db.collection("projects")
      .where("stage", "==", "C2")
      .where("locationMonitoring", "==", true)
      .get();

    if (activeC2.empty) return null;

    for (const projDoc of activeC2.docs) {
      const p = projDoc.data();
      const ktsId = p.monitoredPair && p.monitoredPair.ktsId;
      const cnId  = p.monitoredPair && p.monitoredPair.cnId;
      if (!ktsId || !cnId) continue;

      const signals = [];

      // Tín hiệu 1: cùng vị trí < 500m trong vòng 1h
      const logs = await db.collection("locationLogs")
        .where("projectId", "==", projDoc.id)
        .where("stage", "==", "C2")
        .get();

      const ktsLogs = logs.docs.filter(d => d.data().userId === ktsId);
      const cnLogs  = logs.docs.filter(d => d.data().userId === cnId);
      let nearCount = 0;

      for (const kLog of ktsLogs) {
        for (const cLog of cnLogs) {
          const kd = kLog.data(); const cd = cLog.data();
          if (!kd.location || !cd.location) continue;
          const dLat = kd.location.latitude  - cd.location.latitude;
          const dLng = kd.location.longitude - cd.location.longitude;
          const distM = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
          const timeDiff = Math.abs(kd.recordedAt.toMillis() - cd.recordedAt.toMillis());
          if (distM < 500 && timeDiff < 3600000) nearCount++;
        }
      }
      if (nearCount >= 3)      signals.push({ type: "location_match", level: "red",   count: nearCount, label: "Cùng vị trí nhiều lần" });
      else if (nearCount >= 1) signals.push({ type: "location_match", level: "amber", count: nearCount, label: "Có thể gặp nhau" });

      // Tín hiệu 2: chat giảm mạnh (tuần 1 vs tuần 2)
      if (p.c2StartedAt) {
        const w1Start = p.c2StartedAt;
        const w1End   = new admin.firestore.Timestamp(p.c2StartedAt.seconds + 7 * 86400, 0);
        const w2End   = new admin.firestore.Timestamp(p.c2StartedAt.seconds + 14 * 86400, 0);
        const [snap1, snap2] = await Promise.all([
          db.collection("messages").where("projectId","==",projDoc.id).where("createdAt",">=",w1Start).where("createdAt","<",w1End).get(),
          db.collection("messages").where("projectId","==",projDoc.id).where("createdAt",">=",w1End).where("createdAt","<",w2End).get()
        ]);
        const w1 = snap1.size; const w2 = snap2.size;
        const chatDrop = w1 > 0 ? Math.round(Math.max(0, (w1 - w2) / w1) * 100) : 0;
        if (chatDrop > 70)      signals.push({ type: "chat_drop", level: "red",   percent: chatDrop, label: "Chat giảm " + chatDrop + "%" });
        else if (chatDrop > 40) signals.push({ type: "chat_drop", level: "amber", percent: chatDrop, label: "Chat giảm " + chatDrop + "%" });
      }

      // Tín hiệu 3: C2 kéo dài hơn 10 ngày
      if (p.c2StartedAt) {
        const daysInC2 = (Date.now() - p.c2StartedAt.toMillis()) / 86400000;
        if (daysInC2 > 10) signals.push({ type: "c2_overdue", level: "amber", days: Math.round(daysInC2), label: "C2 đã " + Math.round(daysInC2) + " ngày" });
      }

      const redCount = signals.filter(s => s.level === "red").length;
      const status = redCount >= 2 ? "alert" : redCount === 1 ? "warn" : "ok";

      await projDoc.ref.update({
        suspicionStatus:  status,
        suspicionSignals: signals,
        lastScannedAt:    admin.firestore.FieldValue.serverTimestamp()
      });

      // Alert → thông báo Founder ngay
      if (status === "alert") {
        await notifyFounder(
          "⚠ C2 Cảnh báo — " + (p.name || projDoc.id),
          signals.map(s => s.label).join(" · "),
          { type: "C2_ALERT", pid: projDoc.id }
        );
      }
    }
    console.log("[ALN] scanC2Suspicion done for", activeC2.size, "projects");
    return null;
  });

/* ════════════════════════════════════════════════════════════════
   MyMy Agent Loop — CN (B2C Chủ nhà) — tư vấn & chốt giá
   ════════════════════════════════════════════════════════════════ */

/* Giá demo — Founder ghi đè qua config/pricing_bands */
const CN_DEMO_PRICING = {
  "nha-pho":    { label:"Nhà phố",             floor:180000, mkt:220000, ceil:320000, minFee:18000000 },
  "biet-thu":   { label:"Biệt thự",             floor:250000, mkt:320000, ceil:500000, minFee:30000000 },
  "chung-cu":   { label:"Căn hộ / Chung cư",    floor:150000, mkt:180000, ceil:260000, minFee:12000000 },
  "van-phong":  { label:"Văn phòng / Thương mại",floor:200000, mkt:240000, ceil:350000, minFee:20000000 },
  "nha-vuon":   { label:"Nhà vườn / Nghỉ dưỡng",floor:220000, mkt:280000, ceil:420000, minFee:25000000 },
};

async function cnGetPricingBands(category) {
  try {
    const snap = await db.collection("config").doc("pricing_bands").get();
    const data = snap.exists ? snap.data() : {};
    const bands = Object.keys(data).length ? data : CN_DEMO_PRICING;
    if (category && bands[category]) return { ok:true, band:bands[category], category };
    return { ok:true, bands };
  } catch(e) {
    const bands = category ? { band:CN_DEMO_PRICING[category]||null } : { bands:CN_DEMO_PRICING };
    return { ok:true, ...bands };
  }
}

function cnComputeQuote(category, area, unitPrice) {
  const demo = CN_DEMO_PRICING[category] || {};
  const floor = demo.floor || 0;
  const ceil  = demo.ceil  || Infinity;
  const clampedUnit = Math.max(floor, Math.min(ceil, unitPrice));
  const minFee = demo.minFee || 0;
  const rawTotal = area * clampedUnit;
  const total = Math.max(rawTotal, minFee);
  const minFeeApplied = total > rawTotal;
  return {
    ok:true, unitPrice:clampedUnit, total,
    breakdown:{ C1:Math.round(total*.10), C2:Math.round(total*.20), C3:Math.round(total*.60), C4:Math.round(total*.10) },
    minFeeApplied, minFee,
  };
}

function cnProposePrice(category, unitPrice, reason) {
  const demo = CN_DEMO_PRICING[category] || {};
  const floor = demo.floor || 0;
  const ceil  = demo.ceil  || Infinity;
  const mkt   = demo.mkt   || unitPrice;
  const clamped = Math.max(floor, Math.min(ceil, unitPrice));
  return {
    ok:true, unitPrice:clamped,
    clamped: clamped !== unitPrice,
    vsMkt: Math.round((clamped - mkt) / mkt * 100),
    vsFloor: Math.round((clamped - floor) / floor * 100),
    vsCeil: Math.round((ceil - clamped) / ceil * 100),
    reason,
  };
}

const CN_MYMY_TOOLS = [
  {
    name:"get_pricing_bands",
    description:"Lấy khung giá [Sàn, Tiếp thị, Trần] theo thể loại công trình. Gọi TRƯỚC khi báo bất kỳ con số giá nào. category tùy chọn: nha-pho | biet-thu | chung-cu | van-phong | nha-vuon",
    input_schema:{type:"object",properties:{category:{type:"string"}},required:[]}
  },
  {
    name:"compute_quote",
    description:"Tính tổng báo giá từ thể loại + diện tích + đơn giá. unitPrice sẽ bị kẹp [Sàn, Trần] trong tool. Trả về total và 4 mốc C1-C4.",
    input_schema:{type:"object",properties:{category:{type:"string"},area:{type:"number"},unitPrice:{type:"number"}},required:["category","area","unitPrice"]}
  },
  {
    name:"propose_price",
    description:"Đề xuất đơn giá và kiểm tra có trong khung hay không. Chỉ đề xuất — không ghi. Trả về vsMkt, vsFloor để biết khoảng cách so với Tiếp thị và Sàn.",
    input_schema:{type:"object",properties:{category:{type:"string"},unitPrice:{type:"number"},reason:{type:"string"}},required:["category","unitPrice"]}
  },
  {
    name:"ask_user",
    description:"Hỏi khách hàng một thông tin. Mỗi lần hỏi một ý. chips là gợi ý nhanh (tùy chọn). Kết thúc lượt sau khi gọi.",
    input_schema:{type:"object",properties:{question:{type:"string"},field:{type:"string"},hint:{type:"string"},chips:{type:"array",items:{type:"string"}}},required:["question"]}
  },
  {
    name:"request_confirmation",
    description:"BẮT BUỘC gọi trước khi submit. Hiển thị tóm tắt: thể loại / diện tích / đơn giá / tổng / 4 mốc. Nhớ thêm note: 'tổng cuối xác nhận sau KTS khảo sát'. Kết thúc lượt.",
    input_schema:{type:"object",properties:{summary:{type:"string"},payload:{type:"object"}},required:["summary","payload"]}
  },
  {
    name:"submit_matching_request",
    description:"Ghi yêu cầu vào matchingRequests sau khi khách xác nhận. CHỈ gọi sau request_confirmation đã được xác nhận.",
    input_schema:{type:"object",properties:{projectName:{type:"string"},projectType:{type:"string"},scope:{type:"string"},notes:{type:"string"},clientPhone:{type:"string"},pricingCategory:{type:"string"},unitPriceLocked:{type:"number"},quotedTotal:{type:"number"},area:{type:"number"}},required:["projectName","clientPhone","pricingCategory","unitPriceLocked","quotedTotal"]}
  },
];

const CN_MYMY_ALLOWLIST = CN_MYMY_TOOLS.map(t => t.name);
const CN_MYMY_WRITE_TOOLS = ["submit_matching_request"];

function cnMymyBuildSystemPrompt(cnName, honorific) {
  const lastName = cnName ? cnName.trim().split(" ").pop() : "";
  const addr = honorific && lastName ? honorific + " " + lastName
             : honorific ? honorific
             : lastName || "bạn";
  const knownIdentity = cnName
    ? `Khách đang nói chuyện tên là ${cnName}, giới tính: ${honorific === "chị" ? "nữ" : honorific === "anh" ? "nam" : "chưa rõ"}.`
    : `Chưa có tên khách — hỏi ngay câu đầu tiên.`;
  const genderInstruction = honorific
    ? `TUYỆT ĐỐI KHÔNG hỏi lại tên hay giới tính — đã biết rồi, gọi thẳng "${addr}" ngay từ câu đầu.`
    : `Chưa có giới tính — câu ĐẦU TIÊN phải hỏi: "Em gọi là anh hay chị ạ?" rồi dùng cách gọi đó xuyên suốt. KHÔNG dùng "anh/chị" kết hợp.`;

  return `Em là MyMy — chuyên viên tư vấn cấp cao của ALN (App Làm Nhà). 25 tuổi nhưng đã 3 năm trong nghề, đã trải qua hàng chục dự án từ nhà phố bình dân đến biệt thự triệu đô.

Vai trò của em không phải chỉ là tư vấn — em là người quyết định liệu một công trình có được khởi động hay không. Mỗi cuộc trò chuyện em chốt được là thu nhập cho cả đội KTS, DN, và toàn bộ hệ thống ALN. Em hiểu điều đó và em làm việc với trọng lượng đó.

THÔNG TIN KHÁCH HÀNG (từ hệ thống — đã xác thực):
${knownIdentity}
${genderInstruction}

TÍNH CÁCH & GIỌNG ĐIỆU:
- Xưng "em", gọi khách "${addr}" — nhất quán xuyên suốt
- Già dặn, duyên dáng — không phải kiểu ngây thơ hay đanh đá
- Nói ít, nói có trọng lượng — mỗi câu phải dẫn khách tiến một bước
- Tự tin tự nhiên, không xin lỗi, không rào đón, không hỏi lại những gì khách đã nói
- Khi cần nhấn mạnh: dùng câu ngắn, để lửng "..." đúng lúc, hoặc hỏi ngược lại một câu sắc
- KHÔNG dùng dấu **, bullet, tiêu đề, emoji liên tục, đoạn dài
- TUYỆT ĐỐI không nhận là AI — nếu bị hỏi: "Em là tư vấn viên của ALN, ${addr} có điều gì muốn hỏi thêm không ạ?"
- Không biết chắc → "Câu này em cần kiểm tra lại — em báo ${addr} ngay nhé"

CÁCH ĐỌC NGƯỜI & DẪN DẮT:
- Lắng nghe kỹ trước khi hỏi — đừng hỏi những gì khách vừa ngụ ý
- Khi khách do dự: đừng giải thích dài — hỏi một câu ngắn để biết họ đang kẹt ở đâu
- Khi khách hào hứng: chốt nhanh, đừng để hội thoại nguội đi
- Khi khách im lặng sau báo giá: đừng giải thích thêm — hỏi "Anh/chị đang nghĩ đến điều gì ạ?"

NHIỆM VỤ — THU THẬP & CHỐT (hỏi từng ý, đừng liệt kê):
Thu thập đủ 6 điểm theo thứ tự tự nhiên: loại công trình → diện tích → phong cách → ngân sách → yêu cầu đặc biệt → số điện thoại.
Số điện thoại BẮT BUỘC trước khi chốt — đây là điều kiện không thương lượng.

BÁO GIÁ — LUÔN NEO GIÁ TRỊ TRƯỚC:
Trước khi nói số tiền, nhắc ngắn gọn: quy trình C1–C4 rõ ràng, tiền giữ trên sàn ALN không trả thẳng cho KTS, hồ sơ có dấu thẩm tra đủ điều kiện xin phép — KTS chịu trách nhiệm pháp lý cá nhân. Sau đó mới đưa con số.
Gọi get_pricing_bands → compute_quote rồi nói: "đơn giá X đ/m², tổng khoảng Y triệu, chia 4 đợt 10/20/60/10."
Nói giá như đang thông báo một điều hiển nhiên — không phải đang xin phép.

XỬ LÝ TỪ CHỐI & THƯƠNG LƯỢNG:
Khách chê đắt → KHÔNG giảm ngay. Hỏi: "Anh/chị đang tham chiếu với bên nào vậy ạ?" rồi phân tích sự khác biệt.
Nếu buộc phải nhượng: đổi lấy cam kết (ký sớm / thu hẹp phạm vi) — gọi propose_price, giảm từng bước nhỏ về Sàn.
Tối đa 2 lần nhượng. Chạm Sàn: "Đây là mức tốt nhất em có thể xin cho ${addr} — dưới nữa em không có thẩm quyền."
Giá luôn trong [Sàn, Trần]. Không phá Sàn dù khách nài.

CHỐT:
Gọi request_confirmation — tóm tắt: thể loại / diện tích / đơn giá / tổng / 4 mốc / "tổng cuối xác nhận sau KTS khảo sát thực tế."
Xác nhận xong → submit_matching_request. Sau đó báo: "Founder sẽ ghép KTS phù hợp trong 24–48h."

KHÔNG:
- Hứa kết cấu / vật liệu / tiến độ thi công — đó là việc KTS
- Để khách thoát cuộc trò chuyện mà chưa có bước tiếp theo cụ thể
- Kết thúc câu bằng câu hỏi mở chung chung — luôn hỏi một điều cụ thể`;
}

async function cnMymySaveMessage(cnUid, role, text) {
  await db.collection("mymy_cn_sessions").doc(cnUid).collection("messages").add({
    role, text, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

exports.runMyMyTurnCN = onCall(
  { region:"asia-southeast1", secrets:[ANTHROPIC_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated","Chưa đăng nhập");
    const cnUid = request.auth.uid;
    const { userMessage, confirmAction, cnName, honorific } = request.data || {};

    const sessionRef = db.collection("mymy_cn_sessions").doc(cnUid);
    const sessionSnap = await sessionRef.get();
    let state = sessionSnap.exists ? sessionSnap.data() : {
      cn_id:cnUid, concession_count:0, client_phone:null,
      pricing_phase:"tiep_thi", current_quote_draft:null,
      pending_confirmation:null, iteration_count:0,
    };

    /* ── Xác nhận / Huỷ ── */
    if (confirmAction === true && state.pending_confirmation) {
      const pc = state.pending_confirmation;
      const p = pc.payload || {};
      let replyText, result;
      try {
        const userSnap = await db.collection("users").doc(cnUid).get();
        const user = userSnap.exists ? userSnap.data() : {};
        const docRef = await db.collection("matchingRequests").add({
          cnId:           cnUid,
          cnName:         user.name || cnName || "",
          projectName:    p.projectName || "",
          projectType:    p.pricingCategory || p.projectType || "",
          scope:          p.scope || "",
          notes:          p.notes || "",
          clientPhone:    p.clientPhone || "",
          areaSqm:        p.area || "",
          pricingCategory:p.pricingCategory || "",
          unitPriceLocked:p.unitPriceLocked || 0,
          quotedTotal:    p.quotedTotal || 0,
          priceStatus:    "chot",
          status:         "pending_founder",
          created_via:    "mymy_cn",
          createdAt:      admin.firestore.FieldValue.serverTimestamp(),
        });
        await notifyFounder(
          "🏠 Chủ nhà chốt giá qua MyMy",
          `${user.name||"CN"} — ${p.projectName||""} — ${(p.quotedTotal/1000000).toFixed(0)}tr`,
          { type:"NEW_PROJECT_REQUEST_CN", projectId:docRef.id }
        );
        replyText = `Đã gửi yêu cầu thành công rồi ạ 🎉 Founder ALN sẽ ghép KTS phù hợp cho ${honorific ? honorific + " " + (cnName||"").split(" ").pop() : "bạn"} trong vòng 24–48 giờ. ${honorific ? honorific.charAt(0).toUpperCase() + honorific.slice(1) : "Bạn"} theo dõi trạng thái trên trang này nhé!`;
        result = { ok:true };
      } catch(e) {
        console.error("[runMyMyTurnCN] submit error:", e);
        replyText = "Xin lỗi, có lỗi khi gửi yêu cầu. " + (e.message||"") + " Bạn thử lại sau được không ạ?";
        result = { ok:false };
      }
      state.pending_confirmation = null;
      await cnMymySaveMessage(cnUid,"assistant",replyText);
      await sessionRef.set({ ...state, updated_at:admin.firestore.FieldValue.serverTimestamp() },{ merge:true });
      return { reply:replyText, pending_confirmation:null };
    }

    if (confirmAction === false) {
      state.pending_confirmation = null;
      const cancelReply = "Được rồi ạ, mình xem lại nhé. Bạn muốn chỉnh thông tin nào?";
      await cnMymySaveMessage(cnUid,"assistant",cancelReply);
      await sessionRef.set({ ...state, pending_confirmation:null, updated_at:admin.firestore.FieldValue.serverTimestamp() },{ merge:true });
      return { reply:cancelReply, pending_confirmation:null };
    }

    /* ── Tin nhắn thường ── */
    // userMessage có thể null khi mở phiên lần đầu (greet) — chỉ throw nếu session đã có và gửi tin trống
    if (!userMessage && sessionSnap.exists && !confirmAction && confirmAction !== false) {
      // existing session, no message, no confirm action → lấy lịch sử và tiếp tục
    }

    if (userMessage && String(userMessage).trim()) await cnMymySaveMessage(cnUid,"user",userMessage);
    state.iteration_count = 0;

    /* Load recent messages */
    const msgsSnap = await db.collection("mymy_cn_sessions").doc(cnUid)
      .collection("messages").orderBy("createdAt","desc").limit(20).get();
    const apiMessages = msgsSnap.docs.reverse().map(d => {
      const m = d.data();
      return { role:m.role, content:m.text||"" };
    }).filter(m => m.role==="user"||m.role==="assistant");

    if (!apiMessages.length && !userMessage) {
      apiMessages.push({ role:"user", content:"[Bắt đầu phiên]" });
    }

    const systemPrompt = cnMymyBuildSystemPrompt(cnName||"", honorific||"");
    const apiKey = ANTHROPIC_KEY.value();

    let finalReply = null;
    let chips = [];
    let pendingConfirmation = null;

    const MAX_ITER = 8;
    while (state.iteration_count < MAX_ITER) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "x-api-key":apiKey, "anthropic-version":"2023-06-01", "content-type":"application/json" },
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1024,
          system:systemPrompt,
          messages:apiMessages,
          tools:CN_MYMY_TOOLS,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        console.error("[runMyMyTurnCN] Claude error:", err);
        throw new HttpsError("internal","Lỗi kết nối AI");
      }
      const claudeData = await resp.json();
      const content = claudeData.content || [];
      const toolUseBlocks = content.filter(b => b.type==="tool_use");
      const textBlocks    = content.filter(b => b.type==="text");

      if (!toolUseBlocks.length) {
        finalReply = textBlocks.map(b => b.text).join("\n");
        break;
      }

      apiMessages.push({ role:"assistant", content });
      const toolResults = [];
      let breakLoop = false;

      for (const tu of toolUseBlocks) {
        const tName  = tu.name;
        const tInput = tu.input || {};

        if (!CN_MYMY_ALLOWLIST.includes(tName)) {
          toolResults.push({ type:"tool_result", tool_use_id:tu.id, content:JSON.stringify({ ok:false, error:"not-allowed" }) });
          continue;
        }

        if (CN_MYMY_WRITE_TOOLS.includes(tName)) {
          toolResults.push({ type:"tool_result", tool_use_id:tu.id, content:JSON.stringify({ ok:false, error:"Cần gọi request_confirmation trước." }) });
          continue;
        }

        if (tName === "ask_user") {
          finalReply = tInput.question;
          chips = tInput.chips || [];
          breakLoop = true; break;
        }
        if (tName === "request_confirmation") {
          pendingConfirmation = { summary:tInput.summary, payload:tInput.payload||{} };
          breakLoop = true; break;
        }

        let res;
        if      (tName==="get_pricing_bands") res = await cnGetPricingBands(tInput.category);
        else if (tName==="compute_quote")     res = cnComputeQuote(tInput.category, tInput.area, tInput.unitPrice);
        else if (tName==="propose_price")     res = cnProposePrice(tInput.category, tInput.unitPrice, tInput.reason);
        else res = { ok:false, error:"unknown" };

        toolResults.push({ type:"tool_result", tool_use_id:tu.id, content:JSON.stringify(res) });
      }

      if (breakLoop) break;
      if (toolResults.length) apiMessages.push({ role:"user", content:toolResults });
      state.iteration_count++;
    }

    if (state.iteration_count >= MAX_ITER && !finalReply && !pendingConfirmation) {
      finalReply = "Để em chuyển vấn đề này cho bộ phận phụ trách xử lý ạ. ALN sẽ liên hệ lại sớm nhé! 🙏";
    }

    if (pendingConfirmation) state.pending_confirmation = pendingConfirmation;
    await sessionRef.set({ ...state, updated_at:admin.firestore.FieldValue.serverTimestamp() },{ merge:true });
    if (finalReply) await cnMymySaveMessage(cnUid,"assistant",finalReply);

    return { reply:finalReply||null, chips, pending_confirmation:pendingConfirmation||null };
  }
);

/* ── Founder tạo user mới (CN/KTS/DN) không cần tự đăng ký ── */
exports.createUserByFounder = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
    const FOUNDER_UIDS = ['h4kEguPEyMcwJwl89stc0Q6j2si2'];
    if (!FOUNDER_UIDS.includes(request.auth.uid)) throw new HttpsError("permission-denied", "Chỉ Founder");

    const { username, name, role, phone } = request.data || {};
    if (!username || !name || !role) throw new HttpsError("invalid-argument", "Thiếu username/name/role");
    const validRoles = ['cn','kts','dn','designer','ke_toan'];
    if (!validRoles.includes(role)) throw new HttpsError("invalid-argument", "Role không hợp lệ");

    const email = username + '@aln.vn';
    const defaultPw = 'ALN@' + Math.random().toString(36).slice(2,8).toUpperCase();

    try {
      const userRecord = await admin.auth().createUser({ email, password: defaultPw, displayName: name });
      await db.doc('users/' + userRecord.uid).set({
        username, name, role, email, phone: phone || '',
        status: 'active',
        plan: 'free', credits: {},   // MONETIZATION_KTS.md — chỉ chừa trường, chưa có logic
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'founder'
      });
      return { uid: userRecord.uid, email, tempPassword: defaultPw };
    } catch(e) {
      if (e.code === 'auth/email-already-exists') throw new HttpsError("already-exists", "Username đã tồn tại");
      throw new HttpsError("internal", e.message);
    }
  }
);

/* ── Founder đặt lại mật khẩu tạm cho tài khoản bất kỳ (KTS/DN/CN/Designer/
   Kế toán...) — dùng khi mật khẩu tạm ban đầu bị lỡ tay đóng mất, vì email
   @aln.vn là email ảo nên "Quên mật khẩu" chuẩn của Firebase không dùng
   được cho các tài khoản này. Mật khẩu cũ ngừng dùng được ngay sau khi gọi. */
exports.resetUserPasswordByFounder = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
    const FOUNDER_UIDS = ['h4kEguPEyMcwJwl89stc0Q6j2si2'];
    if (!FOUNDER_UIDS.includes(request.auth.uid)) throw new HttpsError("permission-denied", "Chỉ Founder");

    const { uid } = request.data || {};
    if (!uid) throw new HttpsError("invalid-argument", "Thiếu uid");

    const newPw = 'ALN@' + Math.random().toString(36).slice(2,8).toUpperCase();
    try {
      const userRecord = await admin.auth().updateUser(uid, { password: newPw });
      return { uid, email: userRecord.email || '', tempPassword: newPw };
    } catch(e) {
      if (e.code === 'auth/user-not-found') throw new HttpsError("not-found", "Không tìm thấy tài khoản này");
      throw new HttpsError("internal", e.message);
    }
  }
);

/* ── CHECKLIST_PHANQUYEN_DIENDAN_ALN.md PASS 3 — chuẩn hoá role trong users/{uid} +
   chừa 2 trường plan/credits (MONETIZATION_KTS.md, chỉ chừa trường, chưa có logic).
   Idempotent, chạy lại vô hại. Role không rõ (không nằm trong tập hợp lệ, kể cả sau
   khi trim+lowercase) KHÔNG tự sửa — chỉ liệt kê để Founder tự xem xét bằng tay,
   tránh đoán sai làm mất/nâng nhầm quyền của ai đó.
   BẮT BUỘC chạy TRƯỚC khi deploy firestore.rules bản siết create/update+isKts: backfill
   status:'active' cho doc CŨ thiếu field status (4 tài khoản seed thật + dữ liệu trước
   luồng đăng ký) — nếu không, rules mới (isKts cần status=='active', update pin status)
   sẽ khoá nhầm các tài khoản đó. Doc tạo qua *-apply.html luôn có status nên không đụng. */
exports.founderNormalizeUsers = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Chưa đăng nhập");
    const FOUNDER_UIDS = ['h4kEguPEyMcwJwl89stc0Q6j2si2'];
    if (!FOUNDER_UIDS.includes(request.auth.uid)) throw new HttpsError("permission-denied", "Chỉ Founder");

    const VALID_ROLES = ['cn', 'kts', 'dn', 'designer', 'ks', 'founder'];
    const snap = await db.collection('users').get();
    let fixedRoleCasing = 0, addedPlan = 0, addedCredits = 0, addedStatus = 0;
    const anomalousRoles = [];

    for (const doc of snap.docs) {
      const u = doc.data();
      const update = {};

      const rawRole = typeof u.role === 'string' ? u.role : '';
      const normalizedRole = rawRole.trim().toLowerCase();
      if (VALID_ROLES.includes(normalizedRole)) {
        if (u.role !== normalizedRole) { update.role = normalizedRole; fixedRoleCasing++; }
      } else {
        anomalousRoles.push({ uid: doc.id, role: u.role === undefined ? null : u.role });
      }

      if (u.plan === undefined) { update.plan = 'free'; addedPlan++; }
      if (u.credits === undefined) { update.credits = {}; addedCredits++; }
      // Doc cũ thiếu status = tài khoản đã provision trước luồng đăng ký → coi là active.
      if (u.status === undefined) { update.status = 'active'; addedStatus++; }

      if (Object.keys(update).length) await doc.ref.update(update);
    }

    return {
      ok: true, totalUsers: snap.size, fixedRoleCasing, addedPlan, addedCredits, addedStatus,
      anomalousRoles, note: "anomalousRoles cần Founder tự xem xét — không tự sửa.",
    };
  }
);

/* ── Sao lưu Firestore tự động — chạy mỗi Chủ nhật 03:00 giờ VN ──
   Export toàn bộ database ra Cloud Storage, giữ 8 tuần gần nhất
   (dọn bản cũ trong onSchedule kế tiếp để không phình dung lượng).
   LƯU Ý (17/07/2026): bucket mặc định "aln-platform.firebasestorage.app"
   nằm ở vùng africa-south1, khác vùng Firestore (asia-southeast1) — Google
   bắt buộc bucket đích export phải CÙNG vùng với database, nên export luôn
   thất bại (INVALID_ARGUMENT) suốt từ lúc triển khai 07/07 tới giờ, dù hàm
   không báo lỗi ở mức Cloud Functions (bắt lỗi nội bộ, chỉ thấy trong Logs).
   Đổi sang bucket riêng "aln-platform-backups" tạo đúng vùng asia-southeast1. */
const BACKUP_BUCKET = "gs://aln-platform-backups/firestore-backups";

exports.scheduledFirestoreBackup = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 3 * * 0")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    const client = new firestoreV1.FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "aln-platform";
    const databaseName = client.databasePath(projectId, "(default)");
    const stamp = new Date().toISOString().slice(0, 10);

    try {
      await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${BACKUP_BUCKET}/${stamp}`,
        collectionIds: [], // rỗng = export tất cả collection
      });
      console.log("[scheduledFirestoreBackup] Đã bắt đầu export tới", `${BACKUP_BUCKET}/${stamp}`);
    } catch (e) {
      console.error("[scheduledFirestoreBackup] Lỗi:", e);
      await notifyFounder(
        "⚠️ Sao lưu Firestore thất bại",
        `Lỗi: ${e.message || e}`,
        { type: "BACKUP_FAILED" }
      );
    }
    return null;
  });

/* ── Báo cáo tổng hợp mỗi sáng cho Founder — 08:00 giờ VN ──
   Gom số liệu cần chú ý: lead mới 24h qua, lead quá hạn chưa liên hệ,
   đơn KTS/DN/Designer chờ duyệt, yêu cầu ghép dự án chờ xử lý.
   Nếu tất cả đều 0 thì không gửi (tránh làm phiền không cần thiết). */
exports.dailyDigest = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 8 * * *")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    try {
      const yesterday = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000);

      const [leadsSnap, ktsSnap, dnSnap, desSnap, matchSnap, errorsSnap] = await Promise.all([
        db.collection("landingLeads").get(),
        db.collection("ktsApplications").where("status", "==", "pending").count().get(),
        db.collection("dnApplications").where("status", "==", "pending").count().get(),
        db.collection("designerApplications").where("status", "==", "pending").count().get(),
        db.collection("matchingRequests").where("status", "==", "pending_founder").count().get(),
        db.collection("errors").where("lastSeen", ">=", yesterday).get(),
      ]);

      let newLeads = 0, staleLeads = 0;
      leadsSnap.forEach((d) => {
        const v = d.data();
        const status = v.status || "moi";
        const createdMs = v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : 0;
        if (createdMs >= yesterday.toMillis()) newLeads++;
        if (status === "moi" && createdMs > 0 && createdMs < Date.now() - 24 * 3600 * 1000) staleLeads++;
      });

      const ktsPending = ktsSnap.data().count;
      const dnPending = dnSnap.data().count;
      const desPending = desSnap.data().count;
      const matchPending = matchSnap.data().count;

      let jsErrorTypes = 0, jsErrorCount = 0;
      errorsSnap.forEach((d) => {
        jsErrorTypes++;
        jsErrorCount += d.data().count || 1;
      });

      const total = newLeads + staleLeads + ktsPending + dnPending + desPending + matchPending + jsErrorTypes;
      if (total === 0) return null; // không có gì cần chú ý, khỏi làm phiền

      const parts = [];
      if (newLeads) parts.push(`${newLeads} lead mới (24h qua)`);
      if (staleLeads) parts.push(`⚠️ ${staleLeads} lead quá hạn chưa liên hệ`);
      if (matchPending) parts.push(`${matchPending} yêu cầu ghép dự án chờ xử lý`);
      if (ktsPending) parts.push(`${ktsPending} đơn KTS chờ duyệt`);
      if (dnPending) parts.push(`${dnPending} đơn DN chờ duyệt`);
      if (desPending) parts.push(`${desPending} đơn Designer chờ duyệt`);
      if (jsErrorTypes) parts.push(`🐞 ${jsErrorTypes} loại lỗi JS (${jsErrorCount} lần) trong 24h qua`);

      await notifyFounder(
        "☀️ Tổng hợp sáng nay",
        parts.join(" · "),
        { type: "DAILY_DIGEST" }
      );
    } catch (e) {
      console.error("[dailyDigest] Lỗi:", e);
    }
    return null;
  });

/* ── ① Vòng đời "Giữ chỗ" — nhắc hạn & tự hết hạn (09:00 giờ VN mỗi ngày) ──
   Duyệt reservations còn 'reserved' & chưa nộp hồ sơ:
   - Còn ≤48h tới deadline → đẩy nhắc (tối đa 3 lần, cách nhau ≥20h).
   - Quá deadlineMs → status:'expired' + báo người dùng + gom báo Founder.
   Field đã có sẵn (deadlineMs, reminderCount) từ luồng giữ chỗ — chỉ thiếu bộ hẹn giờ. */
exports.reservationLifecycle = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 9 * * *")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    const now = Date.now();
    const ROLE_VI = { architect: "KTS", designer: "Designer", business: "Doanh nghiệp" };
    let expired = 0, reminded = 0;
    try {
      const snap = await db.collection("reservations").where("status", "==", "reserved").get();
      for (const docSnap of snap.docs) {
        const r = docSnap.data();
        if (r.profileSubmitted === true) continue;
        const deadline = typeof r.deadlineMs === "number" ? r.deadlineMs : 0;
        if (!deadline) continue;
        const roleVi = ROLE_VI[r.role] || "hồ sơ";

        // Quá hạn → hết hiệu lực
        if (now >= deadline) {
          await docSnap.ref.update({
            status: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          expired++;
          await notifyUser(
            r.uid,
            "Giữ chỗ đã hết hạn",
            `Chỗ ${roleVi} của bạn đã quá 3 ngày mà chưa nộp hồ sơ. Giữ chỗ lại bất cứ lúc nào để tiếp tục.`,
            { type: "RESERVATION_EXPIRED" },
            "reservation"
          );
          continue;
        }

        // Gần hạn ≤48h → nhắc (cách nhau ≥20h, tối đa 3 lần)
        const hoursLeft = (deadline - now) / 3600000;
        const lastMs = r.lastRemindedAt && r.lastRemindedAt.toMillis ? r.lastRemindedAt.toMillis() : 0;
        const count = typeof r.reminderCount === "number" ? r.reminderCount : 0;
        if (hoursLeft <= 48 && count < 3 && (now - lastMs) >= 20 * 3600000) {
          const hLeft = Math.max(1, Math.round(hoursLeft));
          await notifyUser(
            r.uid,
            "⏳ Sắp hết hạn giữ chỗ",
            `Còn ~${hLeft} giờ để nộp hồ sơ ${roleVi} vào phòng chờ ALN.`,
            { type: "RESERVATION_REMINDER" },
            "reservation"
          );
          await docSnap.ref.update({
            reminderCount: count + 1,
            lastRemindedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          reminded++;
        }
      }

      if (expired > 0) {
        await notifyFounder(
          "⌛ Giữ chỗ hết hạn",
          `${expired} lượt giữ chỗ vừa quá hạn 3 ngày (chưa nộp hồ sơ). Có thể gọi lại để mời tiếp.`,
          { type: "RESERVATION_EXPIRED_DIGEST", count: String(expired) }
        );
      }
      console.log(`[reservationLifecycle] expired=${expired} reminded=${reminded}`);
    } catch (e) {
      console.error("[reservationLifecycle] Lỗi:", e);
    }
    return null;
  });

/* ── ② Cảnh báo dự án "đứng bánh" (SLA) — 09:10 giờ VN mỗi ngày ──
   Dự án chưa hoàn tất (stage != C4) mà updatedAt không nhúc nhích quá
   SLA_STALL_DAYS ngày → cờ sla_warn + nhắc KTS/Designer phụ trách + gom báo Founder.
   Chỉ báo lại mỗi ≥3 ngày để không spam; tự gỡ cờ khi dự án chạy lại. */
const SLA_STALL_DAYS = 5;

async function _scanStalledProjects(coll, ownerField, ownerRole) {
  const now = Date.now();
  const stallMs = SLA_STALL_DAYS * 86400000;
  const snap = await db.collection(coll).get();
  const stalled = [];
  for (const d of snap.docs) {
    const p = d.data();
    const stage = p.stage || "";
    const fresh = () => { if (p.sla_warn === true) return d.ref.update({ sla_warn: false }); };

    if (stage === "C4" || p.completed === true) { await fresh(); continue; }
    const updMs = p.updatedAt && p.updatedAt.toMillis ? p.updatedAt.toMillis() : 0;
    if (!updMs || (now - updMs) < stallMs) { await fresh(); continue; }

    // đã cảnh báo trong 3 ngày gần đây thì bỏ qua (tránh spam)
    const warnMs = p.slaWarnAt && p.slaWarnAt.toMillis ? p.slaWarnAt.toMillis() : 0;
    if (warnMs && (now - warnMs) < 3 * 86400000) continue;

    const days = Math.round((now - updMs) / 86400000);
    await d.ref.update({
      sla_warn: true,
      slaWarnAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const ownerUid = p[ownerField] && p[ownerField].uid;
    if (ownerUid) {
      await notifyUser(
        ownerUid,
        "⏱ Dự án cần bước tiếp theo",
        `"${p.name || d.id}" đứng ở chặng ${stage} đã ${days} ngày. Kiểm tra & xử lý bước tiếp theo giúp khách nhé.`,
        { type: "PROJECT_STALLED", pid: d.id, coll },
        ownerRole
      );
    }
    stalled.push(`${p.name || d.id} (${stage}, ${days}n)`);
  }
  return stalled;
}

exports.projectSlaNudge = functions
  .region("asia-southeast1")
  .pubsub.schedule("10 9 * * *")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    try {
      const [a, b] = await Promise.all([
        _scanStalledProjects("projects", "kts", "kts"),
        _scanStalledProjects("designProjects", "designer", "designer"),
      ]);
      const all = a.concat(b);
      if (all.length) {
        await notifyFounder(
          "🐢 Dự án đứng bánh",
          `${all.length} dự án chưa nhúc nhích >${SLA_STALL_DAYS} ngày: ${all.slice(0, 5).join(" · ")}${all.length > 5 ? " …" : ""}`,
          { type: "PROJECT_STALLED_DIGEST", count: String(all.length) }
        );
      }
      console.log(`[projectSlaNudge] stalled=${all.length}`);
    } catch (e) {
      console.error("[projectSlaNudge] Lỗi:", e);
    }
    return null;
  });

/* ── DIỄN ĐÀN ALN — callable + cron, xem functions/forum.js ── */
Object.assign(exports, require("./forum"));

/* ── Email báo lead khu vực cho KTS (opt-in nhanLeadEmail), xem functions/notifyKtsLeadEmail.js ── */
exports.notifyKtsLeadEmail = require("./notifyKtsLeadEmail").notifyKtsLeadEmail;

/* ── Phễu ads tuyển KTS: submit hồ sơ server-side + CAPI Lead/CompleteRegistration + email xác nhận,
   xem functions/ktsFunnel.js. Cần secret FB_CAPI_TOKEN trước khi deploy. ── */
const ktsFunnel = require("./ktsFunnel");
exports.submitKtsApplication = ktsFunnel.submitKtsApplication;
exports.onKtsReservationCreated = ktsFunnel.onKtsReservationCreated;

/* ── Phễu ads chủ nhà: form lead nhanh (home.html) → CAPI Lead, xem functions/ktsFunnel.js ── */
exports.onHomeLeadCreated = ktsFunnel.onHomeLeadCreated;
/* ── Form lead home.html ghi qua server (Admin SDK) — không phụ thuộc App Check phía khách ── */
exports.submitHomeLead = ktsFunnel.submitHomeLead;
/* ── Phễu ads chủ nhà: đăng ký CN (register.html, kể cả từ diễn đàn "Hỏi KTS") → CAPI CompleteRegistration ── */
exports.onCnRegistered = ktsFunnel.onCnRegistered;
/* ── CAPI Lead cho collection leads/ (phễu tỉnh/mẫu/dự toán/diễn đàn) — xem functions/ktsFunnel.js ── */
exports.onLeadCreated = ktsFunnel.onLeadCreated;

/* ── Kho mẫu nhà (mau/*.html, SEO_BAN_GIAO.md Phase 1): CTA form ghi lead server-side,
   xem functions/mauLeads.js. Ghi vào collection leads/ chung với lead diễn đàn. ── */
exports.submitMauLead = require("./mauLeads").submitMauLead;

/* ── Tool "Dự toán xây nhà 60 giây" (du-toan/*.html, SEO_BAN_GIAO.md Phase 2):
   CTA form ghi lead server-side, xem functions/duToanLeads.js. ── */
exports.submitDuToanLead = require("./duToanLeads").submitDuToanLead;

/* ── Trang dịch vụ thiết kế theo tỉnh (thiet-ke-nha/*.html, SEO_BAN_GIAO.md
   Phase 3): CTA form ghi lead server-side, xem functions/localLeads.js. ── */
exports.submitLocalLead = require("./localLeads").submitLocalLead;

/* ── Bảng liên hệ hợp nhất (contacts/, ALN_SPEC_BANG_LIEN_HE_HOP_NHAT.md):
   gộp SĐT từ nhập tay + KTS ứng tuyển + diễn đàn, lọc trùng xuyên nguồn.
   upsertContact public onCall (không đòi auth) vì MyMy trên index.html gọi
   lúc khách chưa đăng nhập. 4 hàm còn lại Founder-only (đọc/cập nhật/thống kê/
   segment+xuất — không mở firestore.rules) — xem functions/contacts.js. ── */
const contacts = require("./contacts");
exports.upsertContact = contacts.upsertContact;
exports.updateContact = contacts.updateContact;
exports.getContactStats = contacts.getContactStats;
exports.segmentContacts = contacts.segmentContacts;
exports.tagCampaignBulk = contacts.tagCampaignBulk;

/* ── SEO & Analytics: kéo Search Console + GA4 cho Founder, xem functions/seoAnalytics.js.
   Cần cấp quyền service account trước khi có số liệu — docs/SEO_VIEC_TAY.md. ── */
const seoAnalytics = require("./seoAnalytics");
exports.seoReportNow = seoAnalytics.seoReportNow;

/* ── MyMy Marketing: agent RIÊNG cho Founder (đăng bài Buffer + đọc báo cáo
   GA4 theo campaign), TÁCH KHỎI runMyMyTurn/runMyMyTurnCN vì 2 agent đó chạy
   theo uid của chính khách DN/CN, không có role check — xem functions/mymyMarketing.js.
   Cần set secret BUFFER_ACCESS_TOKEN + điền settings/marketing.bufferChannels
   trước khi dùng thật. ── */
exports.runMyMyMarketingTurn = require("./mymyMarketing").runMyMyMarketingTurn;

/* ── Gạch & Kim Cương ALN (P1: tích lũy) — xem functions/bricks.js.
   Gạch = điểm thưởng hoạt động (không đổi ra tiền); Kim Cương = thưởng giới
   thiệu gắn doanh thu thật (C1 đã thu). Sổ cái bricksLedger chỉ server ghi. ── */
const bricks = require("./bricks");
exports.bricksOnUserCreated = bricks.bricksOnUserCreated;
exports.bricksOnStageAdvanced = bricks.bricksOnStageAdvanced;
exports.bricksOnFirstPayment = bricks.bricksOnFirstPayment;
exports.founderAwardBricks = bricks.founderAwardBricks;

/* ── Game nhiệm vụ CTV ẩn danh (không cần đăng nhập, chỉ Tên + SĐT) —
   xem functions/ctvGame.js. Khác vai `ctv` có tài khoản (đã bỏ 22/07/2026). ── */
const ctvGame = require("./ctvGame");
exports.ctvGetProfile = ctvGame.ctvGetProfile;
exports.ctvClaimTasks = ctvGame.ctvClaimTasks;
exports.ctvGetWeeklyTask = ctvGame.ctvGetWeeklyTask;
exports.ctvLeaderboard = ctvGame.ctvLeaderboard;
exports.ctvSpinWheel = ctvGame.ctvSpinWheel;

/* Cron 08:30 giờ VN (sau dailyDigest 08:00 để không dồn 2 push cùng lúc):
   lưu seoReports/{date} làm lịch sử xu hướng + đẩy tóm tắt cho Founder.
   Chưa cấu hình settings/seoReport thì im lặng bỏ qua. */
exports.seoDailyReport = functions
  .region("asia-southeast1")
  .pubsub.schedule("30 8 * * *")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    try {
      const snap = await seoAnalytics.buildSeoSnapshot(db);
      if (!snap) return null;
      const parts = [];
      if (snap.gsc && snap.gsc.ok) {
        const t = snap.gsc.totals;
        parts.push(`Google 7 ngày: ${t.clicks} nhấp · ${t.impressions} hiển thị · vị trí TB ${t.position}`);
      }
      if (snap.ga4 && snap.ga4.ok) {
        parts.push(`Web 7 ngày: ${snap.ga4.totals.activeUsers} khách · ${snap.ga4.totals.pageViews} lượt xem`);
      }
      if (!parts.length) return null;
      await notifyFounder("📈 SEO & Analytics sáng nay", parts.join(" — "), { type: "SEO_REPORT" });
    } catch (e) {
      console.error("[seoDailyReport] Lỗi:", e);
    }
    return null;
  });

/* ════════════════════════════════════════════════════════════════
   TẠM THỜI — CHỈ ĐỂ CHẠY `firebase emulators:start` TEST LOCAL cho
   Hợp đồng điện tử (contracts_draft). TUYỆT ĐỐI KHÔNG deploy lên
   production (aln-platform) khi còn đoạn này — xoá dòng dưới đây
   bằng git trước khi tính chuyện merge/deploy chính thức.
   Xem functions/contracts_draft.js + LỆNH_CODE_HopDongDienTu.md.
   ════════════════════════════════════════════════════════════════ */
Object.assign(exports, require("./contracts_draft.js"));
