/**
 * mymyMarketing — MyMy Marketing: agent RIÊNG cho Founder, tách khỏi
 * runMyMyTurn/runMyMyTurnCN (index.js) vì 2 agent đó chạy theo uid của chính
 * khách hàng DN/CN, không có role check — không được phép chung allowlist
 * với tool có thể chi tiền / đăng công khai / đọc số liệu nội bộ.
 *
 * Pattern agent loop (vòng lặp gọi Claude, confirmation gate, tool allowlist)
 * tái dùng từ runMyMyTurn; session/allowlist/quyền cách ly hoàn toàn:
 * - Session: mymy_marketing_sessions/{founderUid} (không đụng mymy_sessions)
 * - Chỉ FOUNDER_UID gọi được (giống pattern postToFacebook trong index.js)
 *
 * GA4 Data API tái dùng đúng cơ chế access token (Application Default
 * Credentials, service account aln-platform@appspot.gserviceaccount.com) và
 * config settings/seoReport.ga4PropertyId đã có sẵn ở seoAnalytics.js — không
 * tạo config GA4 riêng.
 *
 * Buffer API: GraphQL (api.buffer.com), xác nhận trực tiếp từ
 * developers.buffer.com/reference.html ngày 20/07/2026 (API REST v1 cũ đã bị
 * Buffer khai tử — không dùng api.bufferapp.com/1/... nữa). Channel ID lấy
 * qua query `channels`, không phải "profile_id" của API cũ. Chưa test bằng
 * request thật (chưa có API key) — verify bằng 1 bài organic thật trước khi
 * dùng rộng.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { GoogleAuth } = require("google-auth-library");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");
const BUFFER_ACCESS_TOKEN = defineSecret("BUFFER_ACCESS_TOKEN");
const FOUNDER_UID = "h4kEguPEyMcwJwl89stc0Q6j2si2";
const MYMY_MKT_MAX_ITER = 8;
const VALID_CHANNELS = ["facebook", "instagram", "tiktok"];
const CONTENT_URL_HOSTS = ["firebasestorage.googleapis.com", "firebasestorage.app"];

const MYMY_MKT_ALLOWLIST = [
  "ask_user", "request_confirmation",
  "scheduleMarketingPost", "getMarketingReport", "cancelMarketingPost",
];
const MYMY_MKT_WRITE_TOOLS = ["scheduleMarketingPost", "cancelMarketingPost"];

const MYMY_MKT_TOOLS = [
  {
    name: "ask_user",
    description: "Hỏi Founder một thông tin còn thiếu (vd link nội dung, caption, kênh muốn đăng, ngân sách). Mỗi lần hỏi một ý. Kết thúc lượt sau khi gọi.",
    input_schema: { type: "object", properties: { question: { type: "string" }, field: { type: "string" } }, required: ["question"] },
  },
  {
    name: "request_confirmation",
    description: "BẮT BUỘC gọi trước scheduleMarketingPost hoặc cancelMarketingPost — kể cả bài organic không tốn tiền, vì đăng sai nội dung công khai khó gỡ. Tóm tắt rõ: caption rút gọn, kênh, giờ đăng, và NGÂN SÁCH DỰ KIẾN nếu is_paid=true. KHÔNG tự gọi tool ghi khi chưa được Founder xác nhận.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["scheduleMarketingPost", "cancelMarketingPost"] },
        summary: { type: "string" },
        payload: { type: "object" },
      },
      required: ["action", "summary", "payload"],
    },
  },
  {
    name: "scheduleMarketingPost",
    description: "Nhận brief + nội dung đã dựng xong (ảnh/video), đẩy lên Buffer theo lịch, gắn UTM để theo dõi. CHỈ gọi sau khi đã qua request_confirmation và Founder đã xác nhận.",
    input_schema: {
      type: "object",
      properties: {
        content_url: { type: "string", description: "Link Firebase Storage tới ảnh/video đã dựng xong" },
        caption: { type: "string" },
        channels: { type: "array", items: { type: "string", enum: VALID_CHANNELS } },
        campaign_tag: { type: "string", description: "vd: kts-recruit-jul26 — chỉ chữ thường/số, nối bằng gạch ngang" },
        schedule_mode: { type: "string", enum: ["golden_hour", "custom"] },
        custom_time: { type: "string", description: "ISO datetime, chỉ dùng khi schedule_mode=custom" },
        is_paid: { type: "boolean" },
        budget_vnd: { type: "number", description: "Ngân sách dự kiến (VNĐ) — BẮT BUỘC hỏi Founder trước nếu is_paid=true, không tự đoán" },
      },
      required: ["content_url", "caption", "channels", "campaign_tag", "schedule_mode", "is_paid"],
    },
  },
  {
    name: "getMarketingReport",
    description: "Đọc dữ liệu conversion GA4 theo campaign_tag, đối chiếu với marketing_posts, tổng hợp báo cáo. Chỉ đọc — không cần request_confirmation.",
    input_schema: {
      type: "object",
      properties: {
        campaign_tag: { type: "string" },
        date_range: { type: "string", enum: ["7d", "14d", "30d", "custom"] },
        custom_start: { type: "string" },
        custom_end: { type: "string" },
      },
      required: ["campaign_tag", "date_range"],
    },
  },
  {
    name: "cancelMarketingPost",
    description: "Huỷ một bài đã lên lịch trên Buffer (chỉ huỷ được nếu chưa tới giờ đăng). CHỈ gọi sau khi qua request_confirmation.",
    input_schema: { type: "object", properties: { post_id: { type: "string" } }, required: ["post_id"] },
  },
];

function mymyMktBuildSystemPrompt(founderCallName) {
  const addressAs = founderCallName ? `anh ${founderCallName}` : "Founder";
  return `Bạn là MyMy, trợ lý marketing NỘI BỘ của ALN (App Làm Nhà) — CHỈ phục vụ Founder, không phải khách hàng.

VAI TRÒ: hỗ trợ Founder phân phối nội dung marketing đã dựng xong (ảnh/video) lên Facebook/Instagram/TikTok qua Buffer, gắn UTM để theo dõi, và đọc báo cáo hiệu quả từ Google Analytics.

QUY TẮC BẮT BUỘC:
1. TRƯỚC MỌI lần gọi scheduleMarketingPost hoặc cancelMarketingPost: BẮT BUỘC gọi request_confirmation trước, kể cả bài đăng organic (không tốn tiền) — vì đăng sai nội dung công khai khó gỡ. Tóm tắt rõ: caption, kênh, giờ đăng, và NGÂN SÁCH DỰ KIẾN nếu is_paid=true.
2. Nếu is_paid=true mà Founder chưa cho biết ngân sách (budget_vnd), PHẢI hỏi bằng ask_user trước khi request_confirmation — không tự đoán số tiền, không tự chi tiền khi chưa xác nhận rõ.
3. Nội dung dựng (video/ảnh) do người dựng thủ công qua Gemini/Kling/CapCut — MyMy chỉ nhận link Firebase Storage đã dựng xong, KHÔNG tự tạo nội dung media.
4. campaign_tag chỉ gồm chữ thường/số nối bằng gạch ngang (vd: kts-recruit-jul26) — nếu Founder đặt tên khác định dạng, gợi ý chuẩn hoá lại trước khi dùng.
5. Hỏi từng ý một bằng ask_user — không hỏi dồn nhiều thứ cùng lúc.
6. getMarketingReport là tool chỉ đọc — dùng thoải mái để trả lời câu hỏi hiệu quả chiến dịch, không cần xác nhận.
7. Diễn giải báo cáo bằng tiếng Việt tự nhiên, có đề xuất cụ thể cho chiến dịch tiếp theo (kênh nào/giờ nào hiệu quả hơn). Nếu conversions = 0 nhưng có traffic, nhắc khả năng key event GA4 chưa cấu hình thay vì kết luận ngay là chiến dịch kém.

XƯNG HÔ: "em" — gọi Founder: "${addressAs}" (đây luôn là đúng 1 người cố định, không cần né tránh như bot chưa biết đối tượng), trừ khi Founder chủ động xưng hô khác thì theo Founder. Ngôn ngữ tự nhiên như người thật nhắn tin, không dùng dấu **, gạch đầu dòng, tiêu đề.
TUYỆT ĐỐI KHÔNG: tự động chạy quảng cáo trả phí khi chưa được xác nhận rõ ngân sách; tự nhận là AI/chatbot.`;
}

async function mymyMktSaveMessage(founderUid, role, text) {
  await db.collection("mymy_marketing_sessions").doc(founderUid).collection("messages").add({
    role, text, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function mymyMktCallClaude(apiKey, systemPrompt, messages, tools) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, system: systemPrompt, messages, tools }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("[runMyMyMarketingTurn] Claude error:", err);
    throw new HttpsError("internal", "Lỗi kết nối AI");
  }
  return resp.json();
}

/* ── Validate & helpers ── */

function mymyMktValidContentUrl(url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return false;
  return CONTENT_URL_HOSTS.some((h) => url.indexOf(h) !== -1);
}

function mymyMktValidCampaignTag(tag) {
  return typeof tag === "string" && tag.length <= 60 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(tag);
}

function mymyMktIdemKey(input) {
  const norm = JSON.stringify({
    content_url: input.content_url,
    campaign_tag: input.campaign_tag,
    channels: [...input.channels].sort(),
    schedule_mode: input.schedule_mode,
    custom_time: input.custom_time || null,
  });
  return crypto.createHash("sha256").update(norm).digest("hex");
}

/* Khung giờ vàng VN (UTC+7, không DST): 11:30–13:00 và 19:30–21:00. Trả về
   thời điểm bắt đầu khung gần nhất, cách hiện tại tối thiểu 10 phút. */
function mymyMktNextGoldenHour(now) {
  const vnOffsetMs = 7 * 3600 * 1000;
  const bufferMs = 10 * 60 * 1000;
  const vnNow = new Date(now.getTime() + vnOffsetMs);
  const y = vnNow.getUTCFullYear(), m = vnNow.getUTCMonth(), d = vnNow.getUTCDate();
  const mkVn = (day, h, mi) => new Date(Date.UTC(y, m, day, h, mi, 0) - vnOffsetMs);
  const earliest = new Date(now.getTime() + bufferMs);
  const candidates = [mkVn(d, 11, 30), mkVn(d, 19, 30), mkVn(d + 1, 11, 30)];
  return candidates.find((slot) => slot >= earliest) || candidates[candidates.length - 1];
}

/* Guard mềm — chặn trước khi gửi quá nhiều request/ngày sang Buffer. Buffer đã
   khai tử API REST cũ (cùng hạn mức 100/24h đã biết) và chuyển sang GraphQL
   (api.buffer.com) — hạn mức thật của API mới chưa được xác nhận, ngưỡng 90
   dưới đây chỉ là biên an toàn tạm, cần điều chỉnh nếu Buffer công bố số khác. */
async function mymyMktCheckRateLimit(incrementBy) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.collection("settings").doc("marketingRateLimit");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const count = d.date === today ? (d.count || 0) : 0;
    if (count + incrementBy > 90) {
      throw new Error("Đã gần chạm ngưỡng an toàn số request/ngày sang Buffer — thử lại sau vài giờ hoặc giảm số kênh.");
    }
    tx.set(ref, { date: today, count: count + incrementBy }, { merge: true });
  });
}

/* ── Buffer API (GraphQL, api.buffer.com) — schema xác nhận trực tiếp từ
   developers.buffer.com/reference.html ngày 20/07/2026 (API REST v1 cũ đã bị
   khai tử). Endpoint duy nhất, auth "Authorization: Bearer <token>". ── */

const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com";

async function bufferGraphQL(token, query, variables) {
  const resp = await fetch(BUFFER_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || (json.errors && json.errors.length)) {
    const msg = (json.errors && json.errors[0] && json.errors[0].message) || ("Buffer HTTP " + resp.status);
    throw new Error(msg);
  }
  return json.data;
}

const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i;

/* AssetInput: kiểu "chọn đúng 1 trong 4" (image/video/document/link) — chỉ
   phân biệt ảnh/video theo đuôi file URL vì content_url luôn là ảnh hoặc
   video đã dựng xong (theo phạm vi spec). */
function mymyMktAssetInput(url) {
  return VIDEO_EXT_RE.test(url) ? { video: { url } } : { image: { url } };
}

const CREATE_POST_MUTATION = `
  mutation MyMyCreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id } }
      ... on InvalidInputError { message }
      ... on LimitReachedError { message }
      ... on UnauthorizedError { message }
      ... on NotFoundError { message }
      ... on UnexpectedError { message }
      ... on RestProxyError { message }
    }
  }
`;

const DELETE_POST_MUTATION = `
  mutation MyMyDeletePost($input: DeletePostInput!) {
    deletePost(input: $input) {
      __typename
      ... on DeletePostSuccess { id }
      ... on VoidMutationError { message }
    }
  }
`;

async function bufferCreatePost(token, { channelId, text, mediaUrl, scheduledAt }) {
  const data = await bufferGraphQL(token, CREATE_POST_MUTATION, {
    input: {
      channelId,
      text: text || "",
      assets: [mymyMktAssetInput(mediaUrl)],
      schedulingType: "automatic",
      mode: "customScheduled",
      dueAt: scheduledAt.toISOString(),
      source: "aln-mymy-marketing",
    },
  });
  const result = data.createPost;
  if (result.__typename !== "PostActionSuccess") {
    throw new Error(result.message || ("Buffer trả lỗi " + result.__typename));
  }
  return result.post.id;
}

async function bufferDeletePost(token, postId) {
  const data = await bufferGraphQL(token, DELETE_POST_MUTATION, { input: { id: postId } });
  const result = data.deletePost;
  if (result.__typename !== "DeletePostSuccess") {
    throw new Error(result.message || ("Buffer trả lỗi " + result.__typename));
  }
  return result.id;
}

/* ── GA4 Data API — tái dùng access token pattern của seoAnalytics.js ── */

async function mymyMktGa4Token() {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res || !res.token) throw new Error("Không lấy được access token GA4");
  return res.token;
}

async function mymyMktApiPost(url, token, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = (await resp.text()).slice(0, 400);
    throw new Error("HTTP " + resp.status + ": " + text);
  }
  return resp.json();
}

/* ── Exec: scheduleMarketingPost ── */

async function mymyMktExecSchedulePost(founderUid, bufferToken, input) {
  try {
    if (!mymyMktValidContentUrl(input.content_url)) {
      return { ok: false, error: { code: "invalid-argument", message: "content_url phải là link Firebase Storage hợp lệ của ALN" } };
    }
    if (!mymyMktValidCampaignTag(input.campaign_tag)) {
      return { ok: false, error: { code: "invalid-argument", message: "campaign_tag chỉ gồm chữ thường/số, nối bằng gạch ngang, vd: kts-recruit-jul26" } };
    }
    const channels = Array.isArray(input.channels) ? input.channels.filter((c) => VALID_CHANNELS.includes(c)) : [];
    if (!channels.length) {
      return { ok: false, error: { code: "invalid-argument", message: "Cần ít nhất 1 kênh hợp lệ (facebook/instagram/tiktok)" } };
    }

    const idemKey = mymyMktIdemKey({ ...input, channels });
    const existingSnap = await db.collection("marketing_posts").where("idemKey", "==", idemKey).limit(1).get();
    let retryDocRef = null;
    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const d = existingDoc.data();
      if (d.status === "scheduled") {
        return { ok: true, post_id: existingDoc.id, status: d.status, channels: d.channels, deduped: true };
      }
      // Lần trước thất bại/dở dang (failed/partial) — không coi là trùng, cho thử lại và ghi đè lên đúng doc cũ.
      retryDocRef = existingDoc.ref;
    }

    let scheduledAt;
    if (input.schedule_mode === "custom") {
      scheduledAt = new Date(input.custom_time);
      if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
        return { ok: false, error: { code: "invalid-argument", message: "custom_time không hợp lệ hoặc đã ở quá khứ" } };
      }
    } else {
      scheduledAt = mymyMktNextGoldenHour(new Date());
    }

    const isPaid = !!input.is_paid;
    if (isPaid && !(input.budget_vnd > 0)) {
      return { ok: false, error: { code: "invalid-argument", message: "Thiếu budget_vnd — phải hỏi Founder ngân sách trước khi đăng bài trả phí" } };
    }

    const cfgSnap = await db.collection("settings").doc("marketing").get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    const bufferChannels = cfg.bufferChannels || {};
    const missingChannels = channels.filter((c) => !bufferChannels[c]);
    if (missingChannels.length) {
      return { ok: false, error: { code: "failed-precondition", message: "Chưa cấu hình Buffer channel ID cho kênh: " + missingChannels.join(", ") + " (settings/marketing.bufferChannels — lấy qua GraphQL query channels)" } };
    }

    await mymyMktCheckRateLimit(channels.length);

    const perChannel = {};
    for (const ch of channels) {
      const utm = { utm_source: ch, utm_medium: isPaid ? "paid" : "organic", utm_campaign: input.campaign_tag };
      try {
        const bufferPostId = await bufferCreatePost(bufferToken, {
          channelId: bufferChannels[ch],
          text: input.caption,
          mediaUrl: input.content_url,
          scheduledAt,
        });
        perChannel[ch] = { status: "scheduled", buffer_post_id: bufferPostId || null, utm_params: utm };
      } catch (e) {
        console.error("[mymyMktExecSchedulePost] Buffer error channel=" + ch, e);
        perChannel[ch] = { status: "failed", error: e.message, utm_params: utm };
      }
    }

    const statuses = Object.values(perChannel).map((c) => c.status);
    const aggStatus = statuses.every((s) => s === "scheduled") ? "scheduled"
      : statuses.some((s) => s === "scheduled") ? "partial" : "failed";

    const postData = {
      idemKey,
      channels: perChannel,
      campaign_tag: input.campaign_tag,
      content_url: input.content_url,
      caption: input.caption || "",
      is_paid: isPaid,
      budget_vnd: input.budget_vnd || null,
      schedule_mode: input.schedule_mode,
      scheduled_time: admin.firestore.Timestamp.fromDate(scheduledAt),
      status: aggStatus,
      created_by: founderUid,
    };
    let docRef;
    if (retryDocRef) {
      docRef = retryDocRef;
      await docRef.set({ ...postData, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } else {
      docRef = await db.collection("marketing_posts").add({ ...postData, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    return { ok: true, post_id: docRef.id, status: aggStatus, channels: perChannel, scheduled_time: scheduledAt.toISOString() };
  } catch (e) {
    console.error("[mymyMktExecSchedulePost]", e);
    return { ok: false, error: { code: "internal", message: e.message } };
  }
}

/* ── Exec: cancelMarketingPost ── */

async function mymyMktExecCancelPost(bufferToken, payload) {
  try {
    const postId = payload.post_id;
    if (!postId) return { ok: false, error: { code: "invalid-argument", message: "Thiếu post_id" } };
    const ref = db.collection("marketing_posts").doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: { code: "not-found", message: "Không tìm thấy bài này" } };
    const d = snap.data();
    const channels = d.channels || {};
    const updated = {};
    for (const [ch, info] of Object.entries(channels)) {
      if (info.status !== "scheduled" || !info.buffer_post_id) { updated[ch] = info; continue; }
      try {
        await bufferDeletePost(bufferToken, info.buffer_post_id);
        updated[ch] = { ...info, status: "cancelled" };
      } catch (e) {
        updated[ch] = { ...info, cancel_error: e.message };
      }
    }
    const allSettled = Object.values(updated).every((c) => c.status === "cancelled" || c.status === "failed");
    await ref.update({ channels: updated, status: allSettled ? "cancelled" : "partial_cancel" });
    return { ok: true, post_id: postId, channels: updated };
  } catch (e) {
    console.error("[mymyMktExecCancelPost]", e);
    return { ok: false, error: { code: "internal", message: e.message } };
  }
}

/* ── Exec: getMarketingReport ── */

async function mymyMktExecGetReport(input) {
  try {
    const campaignTag = input.campaign_tag;
    if (!campaignTag) return { ok: false, error: { code: "invalid-argument", message: "Thiếu campaign_tag" } };
    const dateRange = input.date_range || "7d";
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = [campaignTag, dateRange, input.custom_start || "", input.custom_end || "", today].join("_");
    const cacheRef = db.collection("marketing_reports").doc(cacheKey);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) return { ok: true, ...cacheSnap.data(), cached: true };

    const cfgSnap = await db.collection("settings").doc("seoReport").get();
    const propertyId = cfgSnap.exists ? String(cfgSnap.data().ga4PropertyId || "").trim() : "";
    if (!propertyId) {
      return { ok: false, error: { code: "failed-precondition", message: "Chưa cấu hình GA4 Property ID (settings/seoReport.ga4PropertyId)" } };
    }

    let startDate, endDate;
    if (dateRange === "custom" && input.custom_start && input.custom_end) {
      startDate = input.custom_start; endDate = input.custom_end;
    } else {
      const days = dateRange === "30d" ? 30 : dateRange === "14d" ? 14 : 7;
      startDate = days + "daysAgo"; endDate = "today";
    }

    const token = await mymyMktGa4Token();
    const base = "https://analyticsdata.googleapis.com/v1beta/properties/" + propertyId.replace(/[^0-9]/g, "") + ":runReport";
    // "conversions" là tên metric ổn định qua các version GA4 Data API tính
    // đến khi viết code này — nếu API đổi tên (vd "keyEvents"), verify lại
    // trước khi tin số liệu (checklist mục 4.5).
    const data = await mymyMktApiPost(base, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionSource" }, { name: "hour" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
      dimensionFilter: { filter: { fieldName: "sessionCampaignName", stringFilter: { matchType: "EXACT", value: campaignTag } } },
    });

    const rows = (data.rows || []).map((r) => ({
      source: r.dimensionValues[0].value,
      hour: Number(r.dimensionValues[1].value),
      sessions: Number(r.metricValues[0].value) || 0,
      conversions: Number(r.metricValues[1].value) || 0,
    }));

    const byChannel = {};
    rows.forEach((r) => {
      byChannel[r.source] = byChannel[r.source] || { sessions: 0, conversions: 0 };
      byChannel[r.source].sessions += r.sessions;
      byChannel[r.source].conversions += r.conversions;
    });

    const isGolden = (h) => (h >= 11 && h < 13) || (h >= 19 && h < 21);
    const goldenAgg = { sessions: 0, conversions: 0 };
    const offAgg = { sessions: 0, conversions: 0 };
    rows.forEach((r) => {
      const b = isGolden(r.hour) ? goldenAgg : offAgg;
      b.sessions += r.sessions; b.conversions += r.conversions;
    });

    const postsSnap = await db.collection("marketing_posts").where("campaign_tag", "==", campaignTag).get();

    const report = {
      campaign_tag: campaignTag,
      date_range: { startDate, endDate },
      totals: rows.reduce((a, r) => ({ sessions: a.sessions + r.sessions, conversions: a.conversions + r.conversions }), { sessions: 0, conversions: 0 }),
      by_channel: byChannel,
      golden_hour_vs_other: { golden_hour: goldenAgg, other_hours: offAgg },
      posts_count: postsSnap.size,
      generated_at: new Date().toISOString(),
    };

    await cacheRef.set(report);
    return { ok: true, ...report };
  } catch (e) {
    console.error("[mymyMktExecGetReport]", e);
    return { ok: false, error: { code: "internal", message: e.message } };
  }
}

/* ── Main agent loop — chỉ Founder gọi được ── */

const runMyMyMarketingTurn = onCall(
  { region: "asia-southeast1", secrets: [ANTHROPIC_KEY, BUFFER_ACCESS_TOKEN] },
  async (request) => {
    if (!request.auth || request.auth.uid !== FOUNDER_UID) {
      throw new HttpsError("permission-denied", "Chỉ Founder được dùng MyMy Marketing");
    }
    const founderUid = request.auth.uid;
    const { userMessage, confirmAction } = request.data || {};

    const sessionRef = db.collection("mymy_marketing_sessions").doc(founderUid);
    const sessionSnap = await sessionRef.get();
    let state = sessionSnap.exists ? sessionSnap.data() : {
      iteration_count: 0, pending_confirmation: null, updated_at: null,
    };

    if (confirmAction === true && state.pending_confirmation) {
      const pc = state.pending_confirmation;
      const bufferToken = BUFFER_ACCESS_TOKEN.value();
      let result;
      if (pc.action === "scheduleMarketingPost") {
        result = await mymyMktExecSchedulePost(founderUid, bufferToken, pc.payload);
      } else if (pc.action === "cancelMarketingPost") {
        result = await mymyMktExecCancelPost(bufferToken, pc.payload);
      } else {
        result = { ok: false, error: { code: "unknown", message: "Hành động không xác định" } };
      }
      state.pending_confirmation = null;
      let replyText;
      if (result.ok) {
        if (pc.action === "scheduleMarketingPost") {
          replyText = result.deduped
            ? `Bài này đã được lên lịch trước đó rồi (post_id ${result.post_id}), em không đăng trùng nha!`
            : `Đã lên lịch xong! Trạng thái: ${result.status}. post_id: ${result.post_id}, giờ đăng: ${result.scheduled_time}.`;
        } else {
          replyText = `Đã huỷ bài ${result.post_id} rồi ạ.`;
        }
      } else {
        replyText = `Xin lỗi, có lỗi xảy ra: ${(result.error && result.error.message) || "Lỗi không xác định"}.`;
      }
      await mymyMktSaveMessage(founderUid, "assistant", replyText);
      await sessionRef.set({ ...state, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { reply: replyText, pending_confirmation: null };
    }

    if (confirmAction === false) {
      state.pending_confirmation = null;
      const cancelReply = "Được rồi, mình xem lại thông tin nhé. Bạn muốn chỉnh gì ạ?";
      await mymyMktSaveMessage(founderUid, "assistant", cancelReply);
      await sessionRef.set({ ...state, pending_confirmation: null, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { reply: cancelReply, pending_confirmation: null };
    }

    if (!userMessage || !String(userMessage).trim()) {
      throw new HttpsError("invalid-argument", "Tin nhắn không được để trống");
    }
    await mymyMktSaveMessage(founderUid, "user", userMessage);
    state.iteration_count = 0;

    const msgsSnap = await sessionRef.collection("messages").orderBy("createdAt", "desc").limit(20).get();
    const apiMessages = msgsSnap.docs.reverse().map((d) => {
      const m = d.data();
      return { role: m.role, content: m.text || "" };
    }).filter((m) => m.role === "user" || m.role === "assistant");

    const userSnap = await db.collection("users").doc(founderUid).get();
    const founderName = (userSnap.exists ? userSnap.data().name : "") || "";
    const founderCallName = founderName.trim().split(/\s+/).pop() || "";
    const systemPrompt = mymyMktBuildSystemPrompt(founderCallName);
    const apiKey = ANTHROPIC_KEY.value();

    let finalReply = null;
    let pendingConfirmation = null;

    while (state.iteration_count < MYMY_MKT_MAX_ITER) {
      const claudeData = await mymyMktCallClaude(apiKey, systemPrompt, apiMessages, MYMY_MKT_TOOLS);
      const content = claudeData.content || [];
      const toolUseBlocks = content.filter((b) => b.type === "tool_use");
      const textBlocks = content.filter((b) => b.type === "text");

      if (toolUseBlocks.length === 0) {
        finalReply = textBlocks.map((b) => b.text).join("\n");
        break;
      }

      apiMessages.push({ role: "assistant", content });
      const toolResults = [];
      let breakLoop = false;

      for (const tu of toolUseBlocks) {
        const tName = tu.name;
        const tInput = tu.input || {};

        if (!MYMY_MKT_ALLOWLIST.includes(tName)) {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ ok: false, error: { code: "not-allowed", message: "Tool không được phép" } }) });
          continue;
        }
        if (MYMY_MKT_WRITE_TOOLS.includes(tName)) {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ ok: false, error: { code: "confirmation-required", message: "Cần gọi request_confirmation và chờ Founder xác nhận trước." } }) });
          continue;
        }
        if (tName === "ask_user") { finalReply = tInput.question; breakLoop = true; break; }
        if (tName === "request_confirmation") {
          pendingConfirmation = { action: tInput.action, summary: tInput.summary, payload: tInput.payload };
          breakLoop = true; break;
        }

        let res;
        if (tName === "getMarketingReport") res = await mymyMktExecGetReport(tInput);
        else res = { ok: false, error: { code: "unknown", message: "Tool không xác định" } };

        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(res) });
      }

      if (breakLoop) break;
      if (toolResults.length) apiMessages.push({ role: "user", content: toolResults });
      state.iteration_count++;
    }

    if (state.iteration_count >= MYMY_MKT_MAX_ITER && !finalReply && !pendingConfirmation) {
      finalReply = "Việc này hơi phức tạp, để em ghi lại và báo bạn xử lý trực tiếp nhé!";
      console.warn("[runMyMyMarketingTurn] MAX_ITER reached");
    }

    if (pendingConfirmation) state.pending_confirmation = pendingConfirmation;
    await sessionRef.set({ ...state, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (finalReply) await mymyMktSaveMessage(founderUid, "assistant", finalReply);

    return { reply: finalReply || null, pending_confirmation: pendingConfirmation || null };
  }
);

module.exports = { runMyMyMarketingTurn };
