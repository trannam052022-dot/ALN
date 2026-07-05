# BÀN GIAO — DIỄN ĐÀN ALN (P1 + P2, BẢN NHÁP)

> Ngày bàn giao: 05/07/2026. Toàn bộ diễn đàn xây trên **bản nháp cách ly**: trang `*_draft.html`, collection `*_draft`, Cloud Functions `*Draft`. **Không đụng** aln_community.html, alnPosts, users, leads thật.

## 1. Đường dẫn trang nháp

| Trang | URL | Dành cho |
|---|---|---|
| Diễn đàn | `https://trannam052022-dot.github.io/ALN/forum_draft.html` | Mọi role active |
| Hồ sơ công khai KTS | `.../kts_profile_draft.html?uid=<uid KTS>` | CN/DN/founder xem, có nút Mời KTS |
| Quản trị diễn đàn | `.../founder_forum_draft.html` | Chỉ Founder |

**Bước 0 (bắt buộc trước khi kiểm):** mở `founder_forum_draft.html` → tab **Công cụ** → bấm **"Nạp dữ liệu mẫu"**. Seed idempotent (chạy lại không nhân đôi dữ liệu).

**Công tắc P2:** góc phải topbar diễn đàn (chỉ founder thấy) hoặc tab Công cụ trang quản trị. Mặc định **TẮT**.

## 2. Checklist nghiệm thu (Founder tự tick)

### P1.1 — Bình luận theo luồng
- [ ] Mở bài "bậc chịu lửa QCVN 06" → thấy 3 bình luận, 1 reply lồng đúng 1 cấp (reply của reply tự phẳng về comment gốc)
- [ ] Số bình luận hiện trên card bài; bấm card mở thread đầy đủ; comment mới hiện realtime (mở 2 tab thử)
- [ ] Trường dữ liệu comment: authorUid/Name/Role, text, replyToId, isBestAnswer, flagged, createdAt ✔ (xem Firestore `alnPosts_draft/draft_p01/comments`)

### P1.2 — Chuyên mục
- [ ] Tab: Hỏi đáp / Vật liệu & Giá / Showcase / Nghề & CC / Bảng tin / (Tư vấn Dự án khi P2 bật)
- [ ] Bài cũ chỉ có `tag`, không có `category` (bài "Hoàng hôn trên công trình mái dốc") hiển thị như **Showcase** — không mất dữ liệu
- [ ] Bảng tin: chỉ Founder đăng được (thử đăng bằng tài khoản kts → không có lựa chọn Bảng tin)

### P1.3 — Chống lách sàn (điều kiện ra mắt)
- [ ] Gõ thử SĐT dạng `0909 82 96 96` / `+84.909.829.696` → cảnh báo ngay khi gõ + CHẶN khi đăng
- [ ] Gõ `zalo`, `gmail`, email, link `facebook.com/...` → chặn với thông báo: *"Trao đổi dự án thực hiện qua kênh chat sàn ALN…"*
- [ ] Kiểm tra 2 lớp: tắt JS/lách client vẫn bị **server chặn** (mọi ghi đi qua Cloud Function, không có đường ghi thẳng Firestore)
- [ ] Lượt chặn ghi vào `modLogs_draft` → tab "Chặn lách sàn" trang quản trị; người lách ≥3 lần bị nêu tên đầu tab

### P1.4 — Báo cáo vi phạm
- [ ] Nút Báo cáo trên post + comment, 4 lý do chọn nhanh
- [ ] Trang quản trị tab "Báo cáo": xem nội dung bị báo cáo, hành động Gỡ nội dung / Bỏ qua, trạng thái new → resolved

### P1.5 — Quyền truy cập
- [ ] Tài khoản `status: pending` → màn chặn "Tài khoản đang chờ duyệt"
- [ ] Tài khoản mới (<3 đóng góp): bài/comment vào trạng thái CHỜ DUYỆT (bài demo `draft_p11` có sẵn trong tab Chờ duyệt) — Duyệt / Từ chối hoạt động; từ đóng góp thứ 4 đăng thẳng

### P1.6 — Thông báo
- [ ] Comment vào bài của mình / reply comment của mình / được Best Answer → có push FCM (cần đã cấp quyền thông báo + có token)
- [ ] Chống spam: cùng 1 thread, cùng 1 người nhận → tối đa 1 push / 10 phút, push kế tiếp gộp số bình luận dồn

### P2.1 — Phân quyền theo role (bật công tắc P2 rồi kiểm)
- [ ] P2 TẮT: đăng nhập `cn.trannam` → màn "Diễn đàn đang mở nội bộ KTS"
- [ ] P2 BẬT: CN thấy đúng 3 tab (Tư vấn Dự án / Showcase / Bảng tin) — KHÔNG thấy Hỏi đáp / Vật liệu / Nghề (thử gọi thẳng query cũng bị rules chặn — xem Khảo sát #3)
- [ ] CN chỉ đăng được Tư vấn Dự án; chỉ comment trong thread của mình; KTS comment được mọi nơi

### P2.2 — Mini-brief + lead
- [ ] CN đăng Tư vấn Dự án bằng FORM (loại/diện tích/khu vực/ngân sách/thời gian/đất) + checkbox NĐ 13/2023 bắt buộc
- [ ] Thread KHÔNG hiện SĐT/địa chỉ cụ thể — chỉ khu vực quận/tỉnh
- [ ] Đăng xong → tự sinh doc `leads_draft` đúng schema MARKETING.md (source: `forum`, có score/tier) — xem tab Leads trang quản trị (lead mẫu: Trần Nam, 9 điểm, NÓNG)

### P2.3 — Hồ sơ công khai KTS
- [ ] `kts_profile_draft.html?uid=kw5TgVDggIfboEqERS1cAphn3263` → hạng (PRO với 23 điểm mẫu), điểm uy tín, số dự án qua sàn, khu vực, lưới Showcase
- [ ] TUYỆT ĐỐI không có SĐT/email/Zalo/link ngoài của KTS trên trang

### P2.4 — Nút "Mời KTS tư vấn"
- [ ] Hiện dưới mỗi câu trả lời của KTS trong thread Tư vấn Dự án + trên trang hồ sơ KTS
- [ ] Bấm → tạo `invites_draft` (new → quoted → contracted → won/lost), KTS nhận FCM, mời trùng trả lại invite đang mở
- [ ] Trang quản trị tab "Phễu Invite": đếm theo 5 giai đoạn + chuyển trạng thái (invite mẫu đang ở ĐÃ BÁO GIÁ)

### P2.5 — Disclaimer pháp lý
- [ ] Ghim đầu chuyên mục Tư vấn Dự án + chân MỖI câu trả lời của KTS trong thread tư vấn (đúng câu chữ NĐ 175/2024)
- [ ] Bộ lọc lách sàn áp cho CẢ CN/DN lẫn KTS ở mọi chuyên mục

### P2.6 — Điểm uy tín
- [ ] Best Answer +5, tim comment +1, Founder ghim Showcase +3, "Thưởng trả lời đầu ×2" (+5, nút vàng chỉ founder thấy trong thread tư vấn)
- [ ] Client KHÔNG tự cộng được điểm / tự Best Answer (xem Khảo sát #4)

## 3. TRẢ LỜI 7 CÂU KHẢO SÁT

### #1 — Rules hiện tại với alnPosts + thay đổi cần cho bản thật

**Hiện trạng `alnPosts` (bản thật):** `read: signedIn()` (mọi role đọc tất cả — không phân chuyên mục); `create: signedIn()` (ai đăng nhập cũng GHI THẲNG được — bộ lọc lách sàn không thể cưỡng chế); `update/delete: founder hoặc tác giả`. Subcollection comments/reports/invites/leads-từ-forum: **chưa có rule nào**.

**Bản nháp đang chạy (đã THÊM vào firestore.rules, chỉ block `_draft`, ghi chú "DRAFT — sẽ gỡ khi nghiệm thu"):** toàn bộ collection `_draft` là **read-only theo role**, `write: false` — vì mọi ghi đi qua Cloud Functions (Admin SDK bỏ qua rules). Đây chính là kiến trúc đề xuất cho bản thật.

**BẢN NHÁP RULES CHO HỆ THỐNG THẬT (chờ duyệt — KHÔNG tự áp):**

```
// ═══ DIỄN ĐÀN ALN (bản thật — thay block alnPosts hiện tại) ═══
function fmProfile() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
function fmKtsActive() {
  return signedIn() && fmProfile().role == 'kts' &&
    fmProfile().get('status', 'active') == 'active';
}
function fmCnDnActive() {
  return signedIn() && fmProfile().role in ['cn', 'dn'] &&
    fmProfile().get('status', 'active') == 'active';
}
function fmP2On() {
  return get(/databases/$(database)/documents/forumConfig/flags)
    .data.FORUM_P2_ENABLED == true;
}
function fmOpenCategory(cat) { return cat in ['tu_van_du_an', 'showcase', 'bang_tin']; }

match /alnPosts/{postId} {
  // Bài cũ chưa migrate (không có category): sau khi chạy script migration
  // (mục 5) mọi doc đều có category nên điều kiện dưới an toàn.
  allow read: if isFounder() || fmKtsActive() ||
    (fmCnDnActive() && fmP2On() && fmOpenCategory(resource.data.category));
  allow write: if false;   // ⚠ THAY create:signedIn() cũ — mọi ghi qua Cloud Function
  match /comments/{commentId} {
    allow read: if isFounder() || fmKtsActive() ||
      (fmCnDnActive() && fmP2On() && fmOpenCategory(
        get(/databases/$(database)/documents/alnPosts/$(postId)).data.category));
    allow write: if false;
  }
}
match /forumConfig/{docId}     { allow read: if signedIn(); allow write: if false; }
match /reports/{id}            { allow read: if isFounder(); allow write: if false; }
match /modLogs/{id}            { allow read: if isFounder(); allow write: if false; }
match /modQueue/{id}           { allow read: if isFounder(); allow write: if false; }
match /invites/{id} {
  allow read: if isFounder() || (signedIn() &&
    (resource.data.cnUid == request.auth.uid || resource.data.ktsUid == request.auth.uid));
  allow write: if false;
}
// leads: bản thật ĐÃ có landingLeads; lead từ forum ghi qua Cloud Function
// nên collection leads chỉ cần: read isFounder, write false.
match /leads/{id}              { allow read: if isFounder(); allow write: if false; }
match /ktsReputation/{uid} {
  allow read: if signedIn(); allow write: if false;
  match /events/{eid} { allow read: if isFounder() || request.auth.uid == uid; allow write: if false; }
}
match /forumUserState/{uid}    { allow read: if isFounder() || request.auth.uid == uid; allow write: if false; }
```

Lưu ý khi áp bản thật: (a) trang aln_community.html hiện GHI THẲNG alnPosts (submitPost/toggleHeart/deletePost) — phải chuyển sang gọi callable trước khi đổi rules, nếu không sẽ gãy; (b) `heartedBy`/`heartCount` cũng chuyển qua callable `forumHeart*` như bản nháp.

### #2 — Chặn lách sàn server-side đặt ở đâu?

**Đã chọn: Callable Function làm CỔNG ĐĂNG DUY NHẤT** (`forumPostDraft` / `forumCommentDraft`) + rules `write: false` chặn mọi đường ghi thẳng.

So sánh 3 phương án:

| Phương án | Ưu | Nhược |
|---|---|---|
| **Callable gate (ĐÃ CHỌN)** | Chặn TRƯỚC khi dữ liệu tồn tại (SĐT không bao giờ nằm trên DB dù 1 giây); regex đầy đủ JS; ghi modLogs ngay; kiểm soát pending/lead/điểm trong cùng transaction logic | Thêm ~200–400ms latency mỗi lần đăng; tốn invocation (rẻ: 2M lượt free/tháng) |
| Trigger onCreate xóa bài vi phạm | Client giữ nguyên ghi thẳng | Bài vi phạm TỒN TẠI vài giây trên feed realtime (mọi người kịp thấy SĐT) → vô nghĩa với mục tiêu chống lách; xóa sau còn gây giật UI |
| Regex trong rules | Không cần function | Rules chỉ có `matches()` cơ bản, không normalize được "0 9 0 9. 8 2-9 6 9 6", không ghi log được, giới hạn độ phức tạp biểu thức → lách dễ |

Bộ lọc chặn: SĐT VN (normalize bỏ khoảng trắng/chấm/gạch/ngoặc rồi dò `(+84|0)\d{9,10}`), từ khóa (zalo/viber/telegram/tele/whatsapp/wechat/sđt/sdt/số điện thoại/gmail/hotmail/yahoo/facebook.com/fb.com/messenger/instagram/tiktok), email regex, link ngoài không thuộc applamnha.vn / trannam052022-dot.github.io. Bản client chỉ để UX cảnh báo sớm — chốt chặn thật là server.

**Nâng cấp chống né bằng chữ (05/07/2026):** thêm 2 lớp bắt kiểu ngụy trang:
- **SĐT viết bằng chữ số tiếng Việt xen kẽ** — vd `0909 TÁM HAI CHÍN SÁU 90` hoặc viết đủ chữ `không chín không chín tám hai...`: hàm `vnDigitize()` bỏ dấu + đổi không/một/hai/ba/bốn/tư/năm/lăm/sáu/bảy/tám/chín → chữ số rồi mới dò regex SĐT. Chỉ map 0–9 nên không chặn nhầm văn xuôi ("Ba mẹ tôi muốn xây năm sau, sáu phòng ngủ" → sạch — đã test).
- **Email né bằng chữ** — "a còng"/"at"/"(a)" thay `@`, "chấm"/"dot" thay `.` → chuẩn hóa lại trước khi dò.
- Đã kiểm 15/15 case (10 phải-chặn + 5 không-được-chặn) + test trực tiếp trên function đã deploy: chuỗi ví dụ bị chặn với `reason: phone`.

**Né bằng ẢNH chứa số/chữ (dán hình có SĐT) — ĐÃ CHẶN bằng OCR Cloud Vision (05/07/2026):**
- `forumPostDraft` sau khi lọc text sẽ OCR mọi ảnh đính kèm (`ocrMediaViolation`): đọc chữ trong ảnh bằng Google Cloud Vision `textDetection`, rồi chạy lại đúng bộ lọc text ở trên. Ảnh chứa SĐT/zalo/email/link ngoài → CHẶN đăng, ghi `modLogs_draft` với reason `image:phone` (hoặc image:keyword…).
- Chuyển Firebase download URL → `gs://` để service account đọc trực tiếp; tối đa 4 ảnh/bài.
- Vision lỗi hạ tầng → KHÔNG chặn oan (chỉ log warning); nút Báo cáo + Founder duyệt là lớp dự phòng.
- **Chi phí:** 1000 ảnh đầu/tháng miễn phí, sau đó ~$1.5/1000 ảnh. Chỉ chạy khi bài CÓ ảnh (bài chỉ-chữ không tốn). Đã bật API `vision.googleapis.com` cho project.
- **Đã test thật trên function đã deploy:** ảnh "0909 829 696" → chặn `reason: phone, via: image`; ảnh "Lien he Zalo…" → chặn `keyword`; ảnh sạch "Biệt thự 3 tầng…" → đăng bình thường (không chặn nhầm).
- Bình luận chỉ có chữ (không đính ảnh) nên không cần OCR.

### #3 — CN không bao giờ đọc được hoi_dap/vat_lieu/nghe kể cả gọi API thẳng

Không dựa client. Cấu trúc: **rules kiểm tra per-document** `fmOpenCategory(resource.data.category)` với role cn/dn. Firestore áp rule này cho cả `get` lẫn `list`: một query của CN chỉ được chấp nhận khi **mọi document có thể trả về** đều thỏa điều kiện — nghĩa là CN bắt buộc query kèm `where('category','in',['tu_van_du_an','showcase','bang_tin'])`; query không lọc, hoặc lọc `category=='hoi_dap'`, hoặc `get()` thẳng 1 doc hoi_dap → **permission-denied ở tầng server Firestore**, không phụ thuộc JS. Comments kế thừa qua `get(parent).category`. Đã kiểm chứng trong bản nháp (CN gọi query không where sẽ nhận lỗi). Đánh đổi: CN/DN query không dùng được orderBy server-side (tránh composite index) → sort client-side; khi diễn đàn đông, tạo composite index `category ASC + createdAt DESC` (1 index, khai trong firestore.indexes.json — sẽ HỎI trước khi đổi file này).

### #4 — Chống client tự cộng điểm / tự Best Answer

- `ktsReputation*`: rules `write: false` tuyệt đối — chỉ Cloud Function (Admin SDK) ghi, kèm subcollection `events` làm sổ cái audit từng lần cộng/trừ (type, delta, refPath, createdAt) → đối soát được tổng điểm.
- Best Answer: chỉ callable `forumBestAnswerDraft`; server kiểm `caller == post.authorUid || founder`, chặn tự đánh cho comment của chính mình, transaction bảo đảm mỗi thread đúng 1 Best Answer (gỡ điểm người bị thay thế).
- Tim: qua callable, không cộng điểm khi tự tim comment mình; bỏ tim trừ điểm lại — không farm được.
- Ghim +3 và Thưởng trả lời đầu ×2: chỉ action founder trong `forumAdminDraft`, có cờ `pinRewarded`/`firstAnswerRewarded` trên post chống thưởng lặp.

### #5 — Gộp thông báo FCM chống spam

Cơ chế đã cài (`notifBuffer_draft`, không cần hạ tầng mới): mỗi cặp (người nhận, thread) giữ 1 doc `{lastSentAt, pendingCount}`. Comment mới → nếu đã qua 10 phút từ push gần nhất: gửi push kèm `(+N bình luận trong 10 phút qua)` rồi reset; chưa qua: chỉ `pendingCount++`, không push. Ưu: 0 scheduled function, 0 chi phí thêm, tự dọn theo thread. Nhược chấp nhận được: comment cuối cùng trong cửa sổ im lặng chỉ được "nhắc" khi có sự kiện kế tiếp — nếu muốn đẩy nốt phần dồn, thêm 1 scheduled function 10 phút/lần quét notifBuffer có pendingCount>0 (tốn ~4.3k invocation/tháng, vẫn free tier) — đề xuất chỉ thêm khi diễn đàn đông thật.

### #6 — Rủi ro migration tag → category

Rủi ro **thấp**, vì: chỉ THÊM field `category` (map arch/land/nat → showcase, giữ nguyên `tag` làm sub-tag), không xóa/sửa field nào; script set batch 400 doc/lần, idempotent (doc có category rồi thì bỏ qua). Cần lưu ý: (a) chạy migration TRƯỚC khi áp rules mới — nếu áp rules trước, CN sẽ bị từ chối đọc doc thiếu category (rules per-doc lỗi → deny) và feed CN thiếu bài; (b) trigger `onCommunityPost` hiện có chỉ chạy onCreate nên update migration không bắn push; (c) backup Firestore hàng tuần (CN 03:00) đã có — chạy migration sau một bản backup. Script ở mục 5.

### #7 — Rủi ro khác cần lưu ý

1. **Chi phí đọc Firestore khi đông:** feed đang `onSnapshot` toàn collection. Với ~50 KTS xem 10 lần/ngày × 200 bài = 1M reads/tháng (~$0.4 sau free tier) — chưa đáng lo; khi >1.000 bài nên thêm `limit(50)` + phân trang và composite index như #3.
2. **Giới hạn subcollection:** không giới hạn số comment/subcollection; chỉ lưu ý doc post giữ `commentCount` bằng increment — đúng chuẩn, không đụng giới hạn 1 write/giây/doc trừ khi 1 thread có >1 comment/giây liên tục (rất khó ở quy mô hiện tại).
3. **Ảnh Storage `community/` ai xóa được:** storage.rules hiện cho MỌI user đã đăng nhập `write` (gồm ghi đè/xóa) toàn bộ `community/` — nên siết khi lên bản thật: cho `create` với mọi role đăng bài, `delete` chỉ founder (bản nháp rules storage KHÔNG đổi — sẽ trình cùng đợt duyệt rules). Ngoài ra bài bị gỡ không tự xóa ảnh → rác Storage; đề xuất job dọn định kỳ khi nghiệm thu.
4. **fcmTokens hỏng:** bản nháp không dọn token chết (tránh ghi collection thật). Bản thật dùng lại `notifyUser` sẵn có (đã dọn token).
5. **Callable + App Check:** các function *Draft chưa bật `enforceAppCheck` (đồng bộ với alnChat hiện tại). Khi lên thật có thể bật thêm để chặn bot gọi thẳng.
6. **Founder không có doc users:** đã fallback cứng UID founder trong function + client (đồng bộ cách làm login.html hiện tại).
7. **picsum.photos trong seed:** ảnh mẫu dùng dịch vụ ngoài — chỉ tồn tại ở bản nháp, dữ liệu thật là ảnh Storage.

## 4. Kiến trúc & file đã tạo

| File | Vai trò |
|---|---|
| `forum_draft.html` | Diễn đàn (P1+P2 sau cờ FORUM_P2_ENABLED) |
| `kts_profile_draft.html` | Hồ sơ công khai KTS + nút Mời |
| `founder_forum_draft.html` | Quản trị: báo cáo, chờ duyệt, phễu invite, leads, chặn lách sàn, công cụ (seed + P2) |
| `functions/forum_draft.js` | 8 callable: forumPostDraft, forumCommentDraft, forumHeartDraft, forumBestAnswerDraft, forumReportDraft, forumInviteDraft, forumDeleteDraft, forumAdminDraft (seed/duyệt/gỡ/ghim/invite status/P2/thưởng) |
| `functions/index.js` | +2 dòng cuối: `Object.assign(exports, require("./forum_draft"))` |
| `firestore.rules` | +block DRAFT read-only cho 10 collection `_draft` (ghi chú rõ, không sửa block cũ) |

Collections nháp: `alnPosts_draft` (+`comments`), `reports_draft`, `modLogs_draft`, `modQueue_draft`, `invites_draft`, `leads_draft`, `forumConfig_draft`, `ktsReputation_draft` (+`events`), `forumUserState_draft`, `notifBuffer_draft`.

## 5. Script migration tag → category (CHƯA CHẠY — chạy khi nghiệm thu)

```js
// migrate_tag_to_category.js — chạy: node migrate_tag_to_category.js
// Yêu cầu: GOOGLE_APPLICATION_CREDENTIALS trỏ service account aln-platform,
// hoặc chạy tạm bằng 1 callable founder-only tương tự seed.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "aln-platform" });
const db = admin.firestore();

(async () => {
  const snap = await db.collection("alnPosts").get();
  let batch = db.batch(), n = 0, done = 0;
  for (const d of snap.docs) {
    if (d.data().category) continue;          // idempotent
    batch.update(d.ref, {
      category: "showcase",                    // arch/land/nat đều là chia sẻ khoảnh khắc
      status: "visible",                       // chuẩn hóa cho rules/feed mới
      commentCount: 0,
      bestAnswerId: null,
    });
    n++; done++;
    if (n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log("Đã migrate", done, "bài (giữ nguyên tag làm sub-tag).");
})();
```

Thứ tự bắt buộc: **backup → migration → đổi trang sang callable → áp rules mới** (xem #6).

## 6. DANH SÁCH THAY ĐỔI KHI ĐƯỢC DUYỆT (nháp → thật)

Chỉ thực hiện SAU khi Founder trả lời: **"duyệt cập nhật diễn đàn vào hệ thống"**.

1. **Functions:** trong `forum_draft.js` đổi hằng `COL` bỏ hậu tố `_draft` (posts→`alnPosts`, leads→`leads`…), đổi `FORUM_URL` về trang thật, đổi tên file/hàm bỏ `Draft` (hoặc giữ tên hàm, chỉ đổi COL — ít rủi ro hơn); bật lại dọn fcmTokens chết (dùng notifyUser của index.js); deploy.
2. **Trang:** gắn diễn đàn vào `aln_community.html` (thay thân trang bằng forum, giữ MyMy chatbot + hành vi tim/ghim cũ) hoặc đặt `forum.html` riêng và trỏ menu; đổi mọi tham chiếu collection/callable tương ứng; `kts_profile_draft.html` → hợp nhất với `profile.html` sẵn có.
3. **founder_panel.html:** nhúng 5 tab của founder_forum_draft vào nhóm nav VẬN HÀNH (hoặc giữ trang riêng `founder_forum.html` link từ panel).
4. **Migration:** chạy script mục 5 trên `alnPosts` thật (sau backup).
5. **Rules:** áp bản nháp rules mục 3-#1 (thay block alnPosts, thêm block mới) + **GỠ toàn bộ block DRAFT** trong firestore.rules; trình storage.rules siết `community/` cùng đợt. → cần Founder duyệt riêng bước này.
6. **Index:** thêm composite `alnPosts: category ASC + createdAt DESC` khi bật P2 cho đông người (HỎI trước vì đụng firestore.indexes.json).
7. **Dọn nháp:** xóa các collection `_draft` trên Firestore (xóa tay trong console hoặc `firebase firestore:delete`), xóa 3 file `*_draft.html`, gỡ require forum_draft khỏi index.js nếu đã đổi tên.
8. **Seed thật:** KHÔNG seed dữ liệu mẫu vào collection thật.

## 7. Trạng thái deploy bản nháp

- [x] `firebase deploy --only functions:forum*Draft` (8 hàm, region asia-southeast1)
- [x] `firebase deploy --only firestore:rules` — chỉ THÊM block `_draft` (theo đúng ngoại lệ trong lệnh: "CHỈ được THÊM block rules mới cho các collection _draft")
- [x] Push các file nháp lên `main` (không trang thật nào tham chiếu tới chúng)

*(Nếu mục nào chưa tick — xem ghi chú cuối cùng trong tin nhắn bàn giao của Claude.)*

## 8. DIỄN ĐÀN THÔNG MINH (P3 — bổ sung 05/07/2026)

Nguyên tắc xuyên suốt: **hấp dẫn nhưng thông tin chính xác** — AI chỉ tạo *nháp/tóm tắt*, người thật (KTS) xác nhận; chỉ Best Answer (đã kiểm chứng) mới được đề cao / đưa Cẩm nang.

### A. Phễu chốt tự động (KPI ra tiền)
- **Gợi ý KTS** cho thread Tư vấn Dự án: `forumPostDraft` điền `suggestedKts` (top KTS hoạt động tích cực, denormalized từ bài đăng) + FCM báo các KTS đó. UI: khối "KTS phù hợp" có nút **Mời** → tạo invite như cũ.
- **Xếp hạng câu trả lời**: Best Answer → nhiều tim → cũ trước (thay vì chỉ theo thời gian).
- **Hạng uy tín KTS** (`authorRank`: Tiêu chuẩn/PRO/VIP) suy từ điểm uy tín, hiện badge cạnh tên ở card/thread/comment → tín hiệu tin cậy.

### B. Kho tri thức + AI
- **Chống trùng**: soạn bài → `forumSimilarDraft` hiện câu hỏi tương tự đã có (ưu tiên bài có Best Answer) để bấm xem trước.
- **AI soạn nháp trả lời** (KTS/founder): `forumAiDraftAnswer` (Claude Sonnet) — trích TCVN/QCVN khi phù hợp, KHÔNG bịa số hiệu, luôn kèm dòng "⚠️ Bản nháp AI — KTS kiểm chứng trước khi gửi". KHÔNG tự đăng; điền vào ô để KTS sửa.
- **Tóm tắt AI (TL;DR)** thread dài: `forumSummarizeDraft` (Claude Haiku), **CACHE** trong bài (`aiSummary`) để không gọi lại tốn phí.

### C. Kiểm duyệt thông minh
- **Leo thang 3 bước tự động** theo `blockCount` trong `forumUserState_draft`: Cảnh báo (1–2) → Đề nghị khóa 90 ngày (3–4) → Đề nghị khóa vĩnh viễn (≥5); báo Founder ở mốc 3 & 5. Bản nháp CHỈ đề xuất — Founder quyết định khóa thật. Trang quản trị hiện rõ bậc xử lý theo từng người.
- **Tiền/hậu kiểm theo độ tin cậy**: người hay bị chặn (≥2 lần) bị đưa lại diện tiền kiểm.

### D. Nuôi nội dung & SLA
- **Đưa Best Answer vào Cẩm nang**: Founder xem thread có Best Answer → nút "Đưa vào Cẩm nang" (`forumToCamNangDraft` → `camNangForum_draft`). Chỉ nội dung đã kiểm chứng.
- **SLA cron** `forumUnansweredNudgeDraft` (09:20 hằng ngày): câu hỏi KTS quá 2 ngày chưa ai trả lời → nhắc top KTS + báo Founder.
- **Bản tin tuần** `forumWeeklyDigestDraft` (Thứ 2 07:30): tổng hợp Q&A nổi bật (tim + comment + Best Answer) → `forumDigest_draft` + báo Founder.

### Đã kiểm chứng (trên function đã deploy)
- forumSimilarDraft ✅ (3 kết quả), forumSummarizeDraft ✅ (TL;DR trích QCVN 06:2022, có cache), forumAiDraftAnswer ✅ (nháp trích tiêu chuẩn + disclaimer), forumToCamNangDraft ✅.
- Seed đã bổ sung `authorRank`/`suggestedKts` → mở trang nháp thấy ngay badge PRO + khối KTS gợi ý.

### ⚠️ Chi phí (báo trước)
- **AI (Claude)** chỉ chạy KHI người dùng bấm nút (soạn nháp / tóm tắt) — không tự chạy nền. TL;DR có cache. Dùng secret `ANTHROPIC_API_KEY` sẵn có; tính phí theo token Anthropic.
- **2 cron mới** (SLA + bản tin tuần) chạy 1 lần/ngày & 1 lần/tuần — chi phí không đáng kể.
- **Gợi ý KTS**: chỉ đọc Firestore (rẻ), chạy khi đăng thread Tư vấn.
- Không đổi `firestore.rules` (functions ghi qua Admin SDK; client không đọc collection mới).

### Danh sách hàm mới (đều `*Draft`, tự export qua `Object.assign` trong index.js)
`forumSimilarDraft`, `forumAiDraftAnswer`, `forumSummarizeDraft`, `forumToCamNangDraft`, `forumUnansweredNudgeDraft` (cron), `forumWeeklyDigestDraft` (cron). Collection mới: `camNangForum_draft`, `forumDigest_draft`.

## 9. Bổ sung theo yêu cầu Founder (05/07/2026)

### 9.1 Nút "Chọn KTS này làm dự án" (chủ đầu tư)
- Callable `forumChooseKtsDraft({ threadId, ktsUid })` — CN/DN (khi P2) hoặc Founder.
- Nút GOLD "Chọn KTS này làm dự án" hiện dưới mỗi câu trả lời của KTS trong thread Tư vấn + trong khối "KTS phù hợp". Bấm → modal xác nhận (tóm tắt brief lấy sẵn từ câu hỏi + cam kết escrow C1→C4 + phí niêm yết + disclaimer) → xác nhận.
- Ghi `invites_draft` với `intent: "project"` (mạnh hơn "mời tư vấn"), copy `brief` sang để nghiệm thu tạo dự án không phải nhập lại; gắn `chosenKts` lên thread + báo KTS/Founder. Thread đã chọn → hiện banner "Đã chọn KTS X làm dự án", ẩn các nút chọn.
- **BẢN NHÁP CHƯA tạo dự án thật** (`projects/`). Khi nghiệm thu: nối vào `createProjectFromThread`/`createProjectForDN` (schema escrow C1–C4) để chuyển `intent:project` invite → dự án thật.

### 9.2 3 cấp bậc KTS + ưu tiên nhận dự án
- Huy hiệu 3 bậc (đồng bộ tinh thần spec): **Tân binh** (xám) → **Cố vấn** (navy #0f2c52, ≥20 điểm) → **Chuyên gia ALN** (gold ⭐, ≥60 điểm). Điểm từ Best Answer +5 / tim +1 / ghim Showcase +3 / trả lời đầu tu_van +5.
- Huy hiệu hiện cạnh tên KTS ở card/thread/bình luận + gợi ý KTS. Bậc cao được **ưu tiên** trong danh sách "KTS phù hợp" (sắp theo bậc) + tooltip "được ưu tiên nhận dự án".
- Trang hồ sơ KTS hiện bậc + **thanh gợi ý tiến độ** ("còn X điểm để lên Cố vấn / Chuyên gia") tạo động lực.
- Seed KTS mẫu để ở bậc Chuyên gia ALN (65 điểm) để demo bậc cao nhất.

## 10. Chuyên mục "Hỏi KTS Miễn Phí" + 20 câu mồi (05/07/2026)
- Thêm chuyên mục `hoi_kts` (mở cho CN/DN khi P2, KTS/Founder trả lời) — mặt public "Hỏi KTS Miễn Phí".
- Admin action `seedHoiKts` (nút "Nạp 20 câu Hỏi KTS" trong Tools): 20 câu hỏi chủ nhà giả lập + trả lời mẫu của 6 persona KTS (Tuấn Lộc/Trần Long/Anh Tuấn/Minh Trí/Phan Phúc/Ban Cố Vấn) kèm huy hiệu Cố vấn/Chuyên gia, rải ngày 14 ngày, vài Best Answer + tim; 1 bài Thể lệ ghim đầu chuyên mục. Idempotent (ghi đè `hoikts_*`).
- Nút "Chọn KTS này làm dự án" hoạt động cả trong hoi_kts. Persona seed dùng uid `seed_*` (không có users doc) → forumChooseKtsDraft nới cho bản nháp (fallback tên, cờ `seedKts:true`, không FCM). Khi nghiệm thu: chỉ cho chọn KTS thật đã xác minh.
- Nội dung 20 câu lấy từ FORUM_NOIDUNG_20CAU_THELE_UX.md; đơn giá thiết kế niêm yết (nhà phố/nội thất 120k, biệt thự 160k, nội thất biệt thự 180k đ/m²) xuất hiện trong lời KTS đúng như tài liệu.

## 11. RẢI BÀI THEO NGÀY (drip — diễn đàn trông như đang sống)
- **Kho hàng chờ** `hoiKtsQueue_draft`: câu hỏi + nhiều câu trả lời (mỗi câu có `delayHours`), trạng thái queued → published → done. Nội dung khởi tạo: 16 câu, mỗi câu 2–6 câu trả lời của nhiều KTS (pool ~28 persona, giọng đời), best-answer/đang-chờ phân bố tự nhiên. Dễ mở rộng: thêm phần tử vào `hoiKtsBank()`.
- **Cron `forumHoiKtsDrip`** chạy 8h·11h·14h·17h·20h (giờ VN), CHỈ khi cờ `FORUM_HOIKTS_DRIP_ENABLED` bật: mỗi lần đăng 0–2 câu hỏi ngẫu nhiên (đăng với thời gian hiện tại, không backdate) + trổ các câu trả lời đã tới hạn theo `delayHours` → mỗi câu hỏi từ ít đến nhiều bình luận, nhiều KTS vào bàn dần.
- **Điều khiển (Tools trang quản trị):** "Nạp kho drip" (`seedHoiKtsQueue`), "Bật/Tắt drip" (`toggleDrip`), "Đăng ngay 1 câu (test)" (`dripNow`). Mặc định drip TẮT tới khi Founder bật.
- Nhịp: ~2–4 câu hỏi/ngày → kho 16 câu chạy ~1 tuần; nạp thêm nội dung để kéo dài. Chi phí cron không đáng kể. Tất cả trên bản nháp.
