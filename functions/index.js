const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");

admin.initializeApp();

const db = admin.firestore();
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const BASE_URL    = "https://trannam052022-dot.github.io/ALN/";
const APP_URL     = BASE_URL + "founder_panel.html";

const PAGE_BY_ROLE = {
  founder:   "founder_panel.html",
  kts:       "kts_dashboard.html",
  designer:  "designer_dashboard.html",
  dn:        "client_DN.html",
  cn:        "client_CN.html",
  community: "aln_community.html",
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
- 4 giai đoạn: C1 Ý tưởng & Thiết kế sơ bộ → C2 Bản vẽ kỹ thuật → C3 Thi công → C4 Hoàn thiện & Bàn giao
- Escrow: tiền giữ an toàn, giải ngân khi từng giai đoạn được duyệt
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
