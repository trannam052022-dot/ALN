const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const APP_URL = "https://trannam052022-dot.github.io/ALN/founder_panel.html";

/* Lấy tất cả FCM token của founder rồi gửi push */
async function notifyFounder(title, body, extraData) {
  try {
    const snap = await db.collection("fcmTokens")
      .where("uid", "==", FOUNDER_UID).get();
    if (snap.empty) return;

    const tokens = snap.docs
      .map(d => d.data().token)
      .filter(t => typeof t === "string" && t.length > 0);
    if (!tokens.length) return;

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: "/ALN/icon-192.png",
          badge: "/ALN/icon-192.png",
          requireInteraction: true,
        },
        fcmOptions: { link: APP_URL },
      },
      data: Object.assign({ click_action: APP_URL }, extraData),
    });

    // Xóa token lỗi khỏi Firestore
    const batch = db.batch();
    result.responses.forEach((r, i) => {
      if (!r.success && r.error &&
          (r.error.code === "messaging/invalid-registration-token" ||
           r.error.code === "messaging/registration-token-not-registered")) {
        const staleToken = tokens[i];
        snap.docs.forEach(d => {
          if (d.data().token === staleToken) batch.delete(d.ref);
        });
      }
    });
    await batch.commit();
  } catch (e) {
    console.error("[ALN notify]", e);
  }
}

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
