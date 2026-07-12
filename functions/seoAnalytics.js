/**
 * seoAnalytics — Kéo số liệu Google Search Console + GA4 về cho Founder
 *
 * Mục đích: Founder theo dõi "khi nào ALN lên trang đầu Google" ngay trong
 * founder_panel (tab SEO & Analytics) + nhận digest đẩy mỗi sáng, không phải
 * tự mở Search Console / Analytics.
 *
 * - buildSeoSnapshot(db): gọi 2 API, lưu seoReports/{YYYY-MM-DD} (lịch sử để
 *   vẽ xu hướng vị trí theo thời gian), trả snapshot. Dùng bởi cron
 *   seoDailyReport (index.js) và callable seoReportNow.
 * - seoReportNow (onCall, chỉ Founder): action 'refresh' → kéo số liệu mới
 *   ngay; action 'history' → 30 báo cáo gần nhất.
 *
 * Xác thực: Application Default Credentials của runtime service account
 * (aln-platform@appspot.gserviceaccount.com). Trước khi chạy được, Founder
 * phải cấp quyền cho email đó trong Search Console + GA4 và bật 2 API —
 * xem hướng dẫn từng bước ở docs/SEO_VIEC_TAY.md mục "Báo cáo SEO tự động".
 *
 * Cấu hình đọc từ settings/seoReport: { gscSiteUrl, ga4PropertyId } —
 * Founder điền trong tab SEO & Analytics, không cần deploy lại khi đổi.
 * Search Console có độ trễ dữ liệu ~2-3 ngày nên cửa sổ 7 ngày kết thúc
 * ở (hôm nay - 3 ngày); GA4 realtime hơn, lấy 7 ngày tới hôm nay.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");

if (!admin.apps.length) admin.initializeApp();

const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

async function getAccessToken() {
  const auth = new GoogleAuth({ scopes: SCOPES });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res || !res.token) throw new Error("Không lấy được access token từ service account");
  return res.token;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function apiPost(url, token, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = (await resp.text()).slice(0, 400);
    const err = new Error("HTTP " + resp.status + ": " + text);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

/* Lỗi 403 gần như chắc chắn là chưa cấp quyền/bật API — dịch sang tiếng Việt
   dễ hiểu để hiện thẳng trong panel thay vì bắt Founder đọc JSON lỗi. */
function friendlyError(e, service) {
  const msg = e.message || String(e);
  if (e.status === 403) {
    return service + ": service account chưa được cấp quyền hoặc API chưa bật — xem hướng dẫn trong docs/SEO_VIEC_TAY.md. (" + msg.slice(0, 200) + ")";
  }
  if (e.status === 404) {
    return service + ": không tìm thấy property — kiểm tra lại cấu hình (URL site / Property ID). (" + msg.slice(0, 200) + ")";
  }
  return service + ": " + msg.slice(0, 300);
}

/* ── Search Console: totals theo ngày + top truy vấn + top trang (7 ngày) ── */
async function fetchGsc(token, siteUrl) {
  const end = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const start = new Date(end.getTime() - 6 * 24 * 3600 * 1000);
  const base = "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(siteUrl) + "/searchAnalytics/query";
  const range = { startDate: isoDate(start), endDate: isoDate(end) };

  const [byDate, byQuery, byPage] = await Promise.all([
    apiPost(base, token, { ...range, dimensions: ["date"] }),
    apiPost(base, token, { ...range, dimensions: ["query"], rowLimit: 10 }),
    apiPost(base, token, { ...range, dimensions: ["page"], rowLimit: 10 }),
  ]);

  const daily = (byDate.rows || []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    position: Math.round((r.position || 0) * 10) / 10,
  }));
  const totals = daily.reduce(
    (acc, d) => {
      acc.clicks += d.clicks;
      acc.impressions += d.impressions;
      return acc;
    },
    { clicks: 0, impressions: 0 }
  );
  // Vị trí trung bình có trọng số theo lượt hiển thị (giống cách GSC tính)
  const wpos = daily.reduce((s, d) => s + d.position * d.impressions, 0);
  totals.position = totals.impressions
    ? Math.round((wpos / totals.impressions) * 10) / 10
    : 0;
  totals.ctr = totals.impressions
    ? Math.round((totals.clicks / totals.impressions) * 1000) / 10
    : 0;

  const mapRows = (rows) =>
    (rows || []).map((r) => ({
      key: r.keys[0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      position: Math.round((r.position || 0) * 10) / 10,
    }));

  return {
    ok: true,
    siteUrl,
    range,
    totals,
    daily,
    queries: mapRows(byQuery.rows),
    pages: mapRows(byPage.rows),
  };
}

/* ── GA4 Data API: khách & lượt xem 7 ngày + top trang ── */
async function fetchGa4(token, propertyId) {
  const base = "https://analyticsdata.googleapis.com/v1beta/properties/" +
    String(propertyId).replace(/[^0-9]/g, "") + ":runReport";
  const dateRanges = [{ startDate: "7daysAgo", endDate: "today" }];
  const metrics = [{ name: "activeUsers" }, { name: "screenPageViews" }];

  const [byDate, byPage] = await Promise.all([
    apiPost(base, token, { dateRanges, metrics, dimensions: [{ name: "date" }] }),
    apiPost(base, token, {
      dateRanges,
      metrics,
      dimensions: [{ name: "pagePath" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
  ]);

  const daily = (byDate.rows || [])
    .map((r) => ({
      date: r.dimensionValues[0].value.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
      activeUsers: Number(r.metricValues[0].value) || 0,
      pageViews: Number(r.metricValues[1].value) || 0,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const totals = daily.reduce(
    (acc, d) => {
      acc.activeUsers += d.activeUsers;
      acc.pageViews += d.pageViews;
      return acc;
    },
    { activeUsers: 0, pageViews: 0 }
  );

  const pages = (byPage.rows || []).map((r) => ({
    path: r.dimensionValues[0].value,
    activeUsers: Number(r.metricValues[0].value) || 0,
    pageViews: Number(r.metricValues[1].value) || 0,
  }));

  return { ok: true, propertyId: String(propertyId), totals, daily, pages };
}

/* ── Gom snapshot + lưu lịch sử. Trả null nếu chưa cấu hình gì cả. ── */
async function buildSeoSnapshot(db) {
  const cfgSnap = await db.collection("settings").doc("seoReport").get();
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const gscSiteUrl = (cfg.gscSiteUrl || "").trim();
  const ga4PropertyId = String(cfg.ga4PropertyId || "").trim();
  if (!gscSiteUrl && !ga4PropertyId) return null;

  const snapshot = {
    date: isoDate(new Date()),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    gsc: { ok: false, error: "Chưa cấu hình URL site Search Console" },
    ga4: { ok: false, error: "Chưa cấu hình GA4 Property ID" },
  };

  // Token hỏng (thiếu quyền IAM, metadata…) không được đánh sập cả hàm —
  // ghi lỗi vào cả 2 mục để panel hiện nguyên nhân thật thay vì "INTERNAL".
  let token = null;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.error("[seoAnalytics] getAccessToken:", e);
    const msg = "Không lấy được token service account: " + (e.message || e).toString().slice(0, 300);
    snapshot.gsc = { ok: false, error: msg };
    snapshot.ga4 = { ok: false, error: msg };
    await db.collection("seoReports").doc(snapshot.date).set(snapshot, { merge: true });
    return snapshot;
  }

  if (gscSiteUrl) {
    try {
      snapshot.gsc = await fetchGsc(token, gscSiteUrl);
    } catch (e) {
      console.error("[seoAnalytics] GSC:", e);
      snapshot.gsc = { ok: false, error: friendlyError(e, "Search Console") };
    }
  }
  if (ga4PropertyId) {
    try {
      snapshot.ga4 = await fetchGa4(token, ga4PropertyId);
    } catch (e) {
      console.error("[seoAnalytics] GA4:", e);
      snapshot.ga4 = { ok: false, error: friendlyError(e, "Google Analytics") };
    }
  }

  await db.collection("seoReports").doc(snapshot.date).set(snapshot, { merge: true });
  return snapshot;
}

/* ── Callable cho founder_panel (rules Firestore không cần mở collection mới:
      đọc/ghi đều qua Admin SDK ở đây, chỉ Founder gọi được) ── */
const seoReportNow = onCall({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth || request.auth.uid !== FOUNDER_UID) {
    throw new HttpsError("permission-denied", "Chỉ Founder mới xem được báo cáo này");
  }
  const db = admin.firestore();
  const action = (request.data && request.data.action) || "refresh";

  try {
    if (action === "history") {
      const snap = await db
        .collection("seoReports")
        .orderBy(admin.firestore.FieldPath.documentId(), "desc")
        .limit(30)
        .get();
      return { reports: snap.docs.map((d) => { const v = d.data(); delete v.createdAt; return v; }) };
    }

    const snapshot = await buildSeoSnapshot(db);
    if (!snapshot) return { notConfigured: true };
    delete snapshot.createdAt; // FieldValue không serialize được qua callable
    return { snapshot };
  } catch (e) {
    // Luôn trả HttpsError có message thật — client mà thấy "INTERNAL" trần
    // nghĩa là crash ngoài handler (xem firebase functions:log)
    console.error("[seoReportNow]", action, e);
    throw new HttpsError("internal", (e.message || String(e)).slice(0, 400));
  }
});

module.exports = { buildSeoSnapshot, seoReportNow };
