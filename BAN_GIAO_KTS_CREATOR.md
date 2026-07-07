# BÀN GIAO — CHƯƠNG TRÌNH "KTS CREATOR ALN" (BẢN NHÁP)

> Ngày bàn giao: 07/07/2026. Căn cứ: `TONG_HOP_PHUONG_AN_KTS_CREATOR.md` (PHẦN II — Hạng mục A/B/C/D).
> **Kỷ luật draft-first ban đầu:** không sửa `index.html` / `kts_dashboard.html` /
> `founder_panel.html` / `aln_community.html`, mọi thứ trên trang `*_draft.html` riêng.

## ⚠️ CẬP NHẬT 07/07/2026 (sau bàn giao) — đã NHÚNG phần C vào `kts_dashboard.html` thật

Theo yêu cầu trực tiếp của Founder ("đơn giản nhất có thể, đồng bộ với hệ thống ALN, trang
này nằm trong trang của KTS để họ tiện sử dụng"), phần **Hạng mục C** (link định danh, nộp
clip, kho kit) đã được **rút gọn tối đa** và **nhúng thẳng vào `kts_dashboard.html` thật**
(tab mới "KTS Creator" trong sidebar, cạnh "Uy tín") — KHÔNG còn dùng trang vệ tinh
`kts_creator_draft.html` nữa (đã xoá file này). Đây là ngoại lệ CÓ CHỦ ĐÍCH đối với nguyên
tắc draft-first ban đầu, làm theo chỉ đạo trực tiếp của Founder trong phiên chat — không
phải tự ý vi phạm ĐIỀU KIỆN DỪNG CỨNG #2.

Chi tiết thay đổi:
- `kts_dashboard.html`: thêm 1 nav-item `data-tab="ktscreator"` + 1 khối nội dung
  (`sec-label ktscreator-section`) đặt giữa "Uy tín" và "Cài đặt", dùng đúng token màu/CSS
  của trang (`.card`, `var(--gold)`, `var(--ink3)`...) — không đổi CSS/HTML nào khác.
  Thêm 1 `<script type="module">` độc lập (không đụng script auth-guard chính, theo đúng
  convention nhiều module riêng lẻ đã có trong file — vd khối "GỬI PHƯƠNG ÁN"), tự
  `onAuthStateChanged` riêng, tự cấp mã `KTS-XXXX`, nộp/xem clip.
  Vẫn dùng ĐÚNG 3 collection `_draft` cũ (`kts_profiles_draft`/`leads_draft`/`clips_draft`)
  — KHÔNG collection live nào bị đụng, rules không đổi thêm.
- Đã bỏ bớt cho gọn (so với `kts_creator_draft.html` cũ): không còn ribbon "BẢN NHÁP" riêng
  (tab nằm trong trang thật, không cần cảnh báo), không còn card giới thiệu dài dòng — chỉ
  còn 4 khối: Link định danh / Nộp clip / Clip của tôi / Kho kit.
- `kts_landing_draft.html` (Hạng mục A, khách xem) và `founder_kts_creator_draft.html`
  (Hạng mục B, Founder duyệt) **giữ nguyên là trang `_draft` riêng** — không đổi, vì
  landing công khai không thể nhúng vào trang cần đăng nhập KTS, và trang duyệt vẫn chờ
  Founder xác nhận trước khi tích hợp `founder_panel.html`.
- `robots.txt`: bỏ dòng `Disallow` của `kts_creator_draft.html` (file không còn tồn tại).

---

## ✅ CẬP NHẬT 07/07/2026 — HẠNG MỤC D ĐÃ LÀM (sau khi xác minh lại PASS 1-6 đã merge)

Ban đầu tôi DỪNG Hạng mục D vì tưởng `CHECKLIST_PHANQUYEN_DIENDAN_ALN.md` (PASS 1-6) còn
đang chạy dở trên `forum.html` — kiểm tra lại git log kỹ hơn thì PASS 1-6 **đã merge xong**
vào `main` từ trước (file `.md` chỉ ghi chú lỗi thời "chờ merge"). Vì vậy đã tiến hành D trên
nền `forum.html`/`functions/forum.js` thật, phạm vi đã thu hẹp cho khớp hệ thống hiện có:

- **D1 (đọc công khai)** — coi như đã xong từ PASS 1-6, không làm lại.
- **D2 (mở rộng anti-bypass)** — `functions/forum.js`: thêm cụm từ khoá **"liên hệ riêng"**
  (bắt cả không dấu) vào bộ lọc `forumFilterViolation`; thêm danh sách `SHORTENER_HOSTS`
  (bit.ly, tinyurl.com, cutt.ly, t.co, is.gd...) → link rút gọn bị chặn với lý do riêng
  `link_rut_gon` (trước đây rơi chung vào `"link"`) để mod log rõ ràng hơn. Đã mirror y hệt
  sang bộ lọc client-side trong `forum.html` (chỉ UX cảnh báo sớm, chốt chặn vẫn ở server).
  Đã viết 8 test case xác nhận không phá hành vi cũ (link/từ khoá/SĐT đã chặn từ trước vẫn
  chặn đúng, link applamnha.vn vẫn qua được).
  ⚠️ **Cần Founder tự chạy `firebase deploy --only functions` để có hiệu lực** — code mới
  merge vào `main` chỉ cập nhật frontend GitHub Pages ngay, KHÔNG tự động deploy Cloud
  Functions.
  *Phạm vi đã thu hẹp so với đề bài gốc:* không build tính năng "nhúng clip vào bài diễn đàn"
  (không tồn tại trong `forum.html` hiện tại, sẽ là một tính năng lớn riêng — nếu Founder
  muốn KTS chia sẻ clip TikTok/FB ngay trong bài đăng diễn đàn, cần thêm một quyết định
  kiến trúc riêng vì link TikTok/Facebook hiện đang bị bộ lọc chặn như "kênh ngoài").
- **D3 (badge "KTS Sáng lập")** — `forum.html`: đọc `kts_profiles_draft` (collection có sẵn
  từ Hạng mục A, `allow read: if true`) 1 lần khi tải trang, hiện badge cạnh tên KTS có
  `badgeFounder:true` trên mọi bài đăng + bình luận (thread lẫn feed). Không cần sửa
  `functions/forum.js` hay rules — thuần đọc client-side, có hiệu lực ngay khi trang build
  lại qua GitHub Pages, không cần deploy Functions/Rules.
- **D4 (leaderboard điểm uy tín)** — Widget mới trên `forum.html` (dưới banner disclaimer,
  trên feed), đọc top 10 từ `ktsReputation` (collection thật, `orderBy('points','desc')`,
  không cần index mới vì chỉ 1 field orderBy). **Chỉ hiện với user đã đăng nhập** (khách
  vãng lai không thấy — vì rules `ktsReputation` yêu cầu `signedIn()`, đổi rules này cần
  hỏi Founder trước nên tôi không đổi). Bỏ chữ "tháng" so với đề bài gốc — hiện xếp hạng theo
  **tổng điểm luỹ kế** (đơn giản, không cần hạ tầng tính điểm-theo-tháng); nếu Founder muốn
  đúng "theo tháng", cần thêm tổng hợp từ subcollection `events` (việc lớn hơn, để sau).

**Việc Founder cần làm để D2 có hiệu lực đầy đủ:** `firebase deploy --only functions`. D3/D4
đã chạy được ngay khi GitHub Pages build lại (không phụ thuộc deploy Functions/Rules).

---

## ĐÃ LÀM — HẠNG MỤC A, B, C

### File mới tạo (đều có ribbon "⚠ BẢN NHÁP" + `<meta name="robots" content="noindex,nofollow">`,
đã thêm 3 dòng `Disallow` tương ứng trong `robots.txt`):

| File | Vai trò | Ai dùng |
|---|---|---|
| `kts_landing_draft.html` | Hạng mục A — landing công khai `?code=KTS-XXXX`, hiện hồ sơ + badge + CTA "Bắt đầu Bước 1" (modal lead) + nút Zalo OA chính thức (`zalo.me/alnsanthietke`, không SĐT/Zalo cá nhân) | Khách vãng lai (không cần đăng nhập) |
| `founder_kts_creator_draft.html` | Hạng mục B — dashboard Founder: tab Lead (B1+B2, lọc theo mã KTS/nền tảng/ngày, đếm hiệu quả — KHÔNG tự cộng điểm), tab Duyệt Clip (checklist 5 điểm C3, nút Đạt chuẩn/Từ chối), tab quản lý hồ sơ KTS Creator (thêm KTS vào chương trình, sinh mã, gắn badge Sáng lập, tạm ngưng/bật lại) | Chỉ Founder |

**Hạng mục C không còn là trang riêng** — theo chỉ đạo Founder (xem mục "CẬP NHẬT
07/07/2026" ở trên), đã nhúng thẳng thành tab **"KTS Creator"** trong sidebar của
`kts_dashboard.html` thật (giữa "Uy tín" và "Cài đặt"): link định danh + copy, form nộp clip
rút gọn (tiêu đề/format/URL/cam kết), danh sách clip đã nộp + trạng thái, kho kit (logo tạm +
4 kịch bản tải `.txt`). Dùng 1 `<script type="module">` riêng, độc lập với script auth-guard
chính của trang (đúng convention nhiều module tự trị đã có sẵn trong file).

### Collection Firestore mới (đã thêm block rules tương ứng vào `firestore.rules`,
**CHƯA CHẠY** `firebase deploy --only firestore:rules` — theo đúng CLAUDE.md phải hỏi
Founder trước khi deploy rules; Founder tự chạy lệnh này khi đồng ý):

- **`kts_profiles_draft/{uid}`** — `ktsCode` (KTS-XXXX), `name`, `avatarUrl`, `portfolioSummary`,
  `badgeFounder` (bool), `active` (bool). Đọc công khai (landing cần đọc không auth), ghi:
  chính chủ KTS active hoặc Founder.
- **`leads_draft/{id}`** — `name`, `phone`, `utm_source`, `kts_ref`, `clip_ref` (optional),
  `status` (`moi`/`da_lien_he`/`khong_phan_hoi`/`chuyen_doi`), `createdAt`. Tạo được bởi khách
  ẩn danh (qua `signInAnonymously` — giống hệt pattern `landingLeads` hiện có), chỉ Founder đọc lại.
- **`clips_draft/{id}`** — `ktsUid`, `ktsCode`, `ktsName`, `title`, `format` (1-4), `urls[]`,
  `commitNoContact`, `status` (`cho_duyet`/`dat_chuan`/`tu_choi`), `checklist{}`, `rejectReason`,
  `createdAt`, `reviewedAt`, `reviewedBy`. KTS tạo của mình, chỉ Founder duyệt/sửa/xoá.

> ⚠️ **Lưu ý đặt tên `leads_draft`:** collection nháp cũ của diễn đàn (trước khi lên production)
> từng dùng tên `leads_draft` cho lead từ forum — đã migrate sang `leads` thật và (theo
> `BAN_GIAO_DIEN_DAN.md` mục 0.1) collection `leads_draft` cũ **CHƯA bị xoá** trên Firestore
> Console (nằm trong danh sách "13 collection `*_draft` cũ — an toàn để xoá"). Nếu Founder
> chưa xoá nó, **tên `leads_draft` mới của KTS Creator sẽ dùng CHUNG collection đó** — schema
> khác nhau nhưng không phạm phải dữ liệu live (rules cũ của nó không tồn tại nữa nên không
> xung đột quyền). Đề nghị Founder xoá 13 collection cũ đó trên Console TRƯỚC khi test tính
> năng này, để tránh lẫn dữ liệu cũ khi xem danh sách lead trong `founder_kts_creator_draft.html`.

### Quyết định kỹ thuật đã tự chọn (không có trong đề bài gốc — cần Founder xác nhận)

1. **Không có Cloud Function mới** — lead + clip ghi thẳng client, theo đúng pattern
   `landingLeads` hiện có (anon-auth + rules validate field). Founder duyệt tay clip/lead
   (đúng ĐIỀU KIỆN DỪNG CỨNG #3 — không tự động cộng điểm).
2. **Không có index Firestore mới** — mọi query lọc dùng 1 field equality hoặc không where,
   sort/lọc còn lại làm client-side (giống cách `client_DN`/CN P2 forum đã làm) → không cần
   đụng `firestore.indexes.json` (phải hỏi trước theo CLAUDE.md).
3. **URL đẹp `applamnha.vn/kts/[mã-KTS]`** — GitHub Pages là static hosting, không tự rewrite
   path. Bản nháp dùng query string: `kts_landing_draft.html?code=KTS-0001`. Muốn có URL đẹp
   thật (`/kts/KTS-0001`) cần thêm rule redirect ở tầng CDN/DNS (Cloudflare Worker hoặc
   tương đương) trỏ `/kts/*` → `/kts_landing_draft.html?code=*` — **việc này ngoài phạm vi
   code, Founder/hạ tầng tự cấu hình** (ghi vào PHẦN III nếu cần).
4. **`founder_kts_creator_draft.html` thay vì `founder_panel_draft.html`** — đề bài gợi ý 2
   lựa chọn ("`founder_panel_draft.html` HOẶC feature flag P2 hiện có"). Nhân bản toàn bộ
   `founder_panel.html` (491KB) chỉ để thêm 1 tab là không cân xứng và dễ lỗi khi merge sau
   này → chọn trang vệ tinh riêng, nhẹ, độc lập. Khi Founder duyệt merge, sẽ nhúng 3 tab này
   thành 1 tab con trong nhóm nav VẬN HÀNH của `founder_panel.html` thật (như cách
   `founder_forum.html` đã làm).
5. **(CẬP NHẬT 07/07) Tab "KTS Creator" nhúng thẳng trong `kts_dashboard.html`** — theo chỉ
   đạo Founder, không còn trang vệ tinh riêng cho Hạng mục C nữa (xem mục cập nhật đầu file).
6. **Tự cấp mã `KTS-XXXX` (self-service)** — bất kỳ user role `kts` nào mở tab "KTS Creator"
   trong `kts_dashboard.html` lần đầu sẽ TỰ được cấp hồ sơ + mã (không giới hạn đúng 3-5 KTS
   pilot như đề bài "Pilot 3-5 KTS trong 30 ngày" — vì MỌI KTS active đều vào được tab này,
   không cách nào giới hạn hiển thị tab theo danh sách pilot mà không thêm điều kiện mới).
   Founder kiểm soát phạm vi thực tế bằng cách **chỉ thông báo/hướng dẫn dùng tab này cho
   đúng 3-5 KTS đã chọn** (PHẦN III mục 3) và có thể tạm ngưng (`active:false`) hồ sơ bất kỳ
   lúc nào trong tab "Hồ sơ KTS Creator" của `founder_kts_creator_draft.html`. Sinh mã không
   hoàn toàn atomic (đọc toàn bộ collection rồi
   +1) — chấp nhận được ở quy mô pilot vài KTS, rủi ro trùng mã gần như không xảy ra.
7. **Tham số `&clip=` tuỳ chọn trên link định danh** — đề bài chỉ định "1 link duy nhất";
   đã thêm khả năng gắn thêm `&clip=<tên>` để đo lead theo TỪNG clip (B2 "đếm lead/clip"),
   mặc định bỏ trống vẫn hoạt động đúng như "1 link duy nhất". KTS không bắt buộc dùng.
8. **Kho kit watermark (C4)** — hiện tạm dùng `icon-512.png` (logo app) làm placeholder vì
   chưa có file watermark chính thức. 4 kịch bản mẫu đã soạn ngắn gọn theo đúng 4 format —
   PT Kinh doanh (PHẦN III mục 3) nên thay bằng bản kịch bản chi tiết hơn khi có.

---

## CHECKLIST TEST (Founder tự làm trên bản nháp)

1. **Rules:** Founder tự chạy `firebase deploy --only firestore:rules` sau khi đọc & đồng ý
   block mới trong `firestore.rules` (đã đánh dấu rõ "KTS CREATOR ALN — BẢN NHÁP").
2. Đăng nhập bằng `kts.tranlong` vào `kts_dashboard.html` → mở tab "KTS Creator" (sidebar,
   cạnh "Uy tín") → xác nhận tự động có mã `KTS-0001`, copy link hoạt động.
3. Mở `kts_landing_draft.html?code=KTS-0001` (tab ẩn danh, KHÔNG đăng nhập) → thấy tên, KHÔNG
   thấy SĐT/Zalo cá nhân → bấm "Bắt đầu Bước 1" → điền tên/SĐT + tick đồng ý → gửi thành công.
4. Mở `founder_kts_creator_draft.html` (đăng nhập `founder.tranlong`) → tab Lead thấy lead vừa
   tạo, lọc theo mã KTS/nền tảng/ngày hoạt động đúng.
5. Từ tab "KTS Creator" trong `kts_dashboard.html`, nộp 1 clip (điền tiêu đề, chọn format,
   thêm 1-2 URL, tick cam kết) → sang tab Duyệt Clip của Founder, thấy clip "Chờ duyệt", tick
   đủ 5 checklist → bấm Đạt chuẩn → xác nhận trạng thái chuyển "Đạt chuẩn" và hiện lại bên KTS.
6. Thử bấm Đạt chuẩn khi CHƯA tick đủ 5 checklist → phải bị chặn (alert).
7. Thử Từ chối 1 clip, nhập lý do → xác nhận KTS thấy lý do từ chối.
8. Tab "Hồ sơ KTS Creator": thêm 1 KTS khác bằng username, xác nhận sinh mã mới không trùng;
   thử "Tạm ngưng" 1 hồ sơ → xác nhận landing của mã đó báo "tạm ngưng hiển thị".
9. Xác nhận `kts_landing_draft.html` / `founder_kts_creator_draft.html` đều có ribbon BẢN NHÁP
   + không lọt vào `sitemap.xml` (chưa thêm, đúng ý). Tab "KTS Creator" trong
   `kts_dashboard.html` KHÔNG có ribbon (nằm trong trang thật, chỉ KTS đăng nhập mới thấy).

## CÁC ĐIỂM CHỜ FOUNDER QUYẾT ĐỊNH

- [ ] Hướng xử lý Hạng mục D (xem mục DỪNG ở đầu file) — (a)/(b)/(c)?
- [ ] Xoá 13 collection `*_draft` cũ của diễn đàn trên Firestore Console trước khi test (tránh
      lẫn với `leads_draft` mới — xem lưu ý đặt tên ở trên), HOẶC đổi tên collection lead mới
      (vd `kts_creator_leads_draft`) nếu Founder muốn tách bạch tuyệt đối — báo lại để đổi.
- [ ] Xác nhận Founder tự chạy `firebase deploy --only firestore:rules` khi đã đọc block mới.
- [ ] URL đẹp `/kts/[mã]` — cấu hình redirect tầng hạ tầng (ngoài code) hay giữ query string?
- [ ] Danh sách 3-5 KTS pilot cụ thể (PHẦN III mục 3, PT Kinh doanh chọn) — gửi username để
      thêm vào tab "Hồ sơ KTS Creator", hoặc hướng dẫn họ tự mở tab "KTS Creator" trong
      `kts_dashboard.html` (mọi KTS active đều thấy tab này — xem lưu ý mục 6 ở trên).
