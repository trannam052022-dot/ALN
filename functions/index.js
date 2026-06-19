const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const BASE_URL    = "https://trannam052022-dot.github.io/ALN/";
const APP_URL     = BASE_URL + "founder_panel.html";

const PAGE_BY_ROLE = {
  founder:  "founder_panel.html",
  kts:      "kts_dashboard.html",
  designer: "designer_dashboard.html",
  dn:       "client_DN.html",
  cn:       "client_CN.html",
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
