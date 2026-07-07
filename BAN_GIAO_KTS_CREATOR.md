# BÀN GIAO — CHƯƠNG TRÌNH "KTS CREATOR ALN" (BẢN NHÁP)

> Ngày bàn giao: 07/07/2026. Căn cứ: `TONG_HOP_PHUONG_AN_KTS_CREATOR.md` (PHẦN II — Hạng mục A/B/C/D).
> **Kỷ luật draft-first đã tuân thủ:** không ghi/sửa bất kỳ collection live nào, không sửa
> `index.html` / `kts_dashboard.html` / `founder_panel.html` / `aln_community.html`. Toàn bộ
> nằm trên 3 trang mới `*_draft.html` + 3 collection Firestore mới hậu tố `_draft`.

---

## ⚠️ DỪNG THEO ĐIỀU KIỆN #5 — HẠNG MỤC D (DIỄN ĐÀN) CHƯA LÀM

`TONG_HOP_PHUONG_AN_KTS_CREATOR.md` viết Hạng mục D dựa trên giả định diễn đàn còn ở
`forum_draft.html` + collection `*_draft` (đúng tình trạng hồi 05/07/2026). **Thực tế hiện
tại đã khác, có mâu thuẫn thật với đề bài:**

1. Diễn đàn đã **lên production** từ 05–06/07/2026: trang thật là `forum.html`
   (không phải `forum_draft.html`), collection thật `forumPosts`/`comments`/`ktsReputation`/...
   (xem `BAN_GIAO_DIEN_DAN.md` mục 0). Không còn "`forum_draft.html`" để build thêm lên đó.
2. **D1 (đọc công khai)** và một phần **D2 (anti-bypass)**/**D3 (badge)** đang được làm bởi
   một luồng công việc RIÊNG, đang chạy dở: `CHECKLIST_PHANQUYEN_DIENDAN_ALN.md` — PASS 1-3
   đã xong (chờ deploy), PASS 4 (khách vãng lai đọc công khai forum.html) đã code xong chờ
   merge/test, PASS 5-6 cũng đã code-level xong. Badge 3 bậc (Tân binh/Cố vấn/Chuyên gia ALN)
   **đã có sẵn** trong hệ thống thật (không phải "KTS Sáng lập" nhưng cùng vị trí hiển thị).
3. Sửa `forum.html` / `functions/forum.js` ngay bây giờ để thêm D1-D4 sẽ **đụng trực tiếp**
   vào file đang được một luồng khác chỉnh sửa dở dang → rủi ro xung đột/ghi đè cao.

**Theo ĐIỀU KIỆN DỪNG CỨNG #5 của đề bài, tôi DỪNG toàn bộ Hạng mục D, chưa code gì, chờ
Founder quyết định một trong các hướng sau:**

- **(a)** Gộp yêu cầu D vào `CHECKLIST_PHANQUYEN_DIENDAN_ALN.md` làm tiếp theo (PASS 4 đã
  gần đúng D1; D3 "KTS Sáng lập" có thể thêm như 1 field boolean bên cạnh badge 3 bậc có sẵn;
  D4 leaderboard + D2 mở rộng anti-bypass cho clip embed làm sau khi PASS 1-6 nghiệm thu xong).
- **(b)** Làm D trên một bản sao cách ly hoàn toàn mới (vd `forum_kts_creator_draft.html`
  + collection riêng) — tốn công trùng lặp, không tái dùng được badge/reputation/anti-bypass
  đã có, không khuyến nghị.
- **(c)** Founder tự chốt phạm vi khác cho D.

Khi có quyết định, quay lại làm tiếp Hạng mục D theo đúng hướng được chọn.

---

## ĐÃ LÀM — HẠNG MỤC A, B, C

### File mới tạo (đều có ribbon "⚠ BẢN NHÁP" + `<meta name="robots" content="noindex,nofollow">`,
đã thêm 3 dòng `Disallow` tương ứng trong `robots.txt`):

| File | Vai trò | Ai dùng |
|---|---|---|
| `kts_landing_draft.html` | Hạng mục A — landing công khai `?code=KTS-XXXX`, hiện hồ sơ + badge + CTA "Bắt đầu Bước 1" (modal lead) + nút Zalo OA chính thức (`zalo.me/alnsanthietke`, không SĐT/Zalo cá nhân) | Khách vãng lai (không cần đăng nhập) |
| `kts_creator_draft.html` | Hạng mục C — dashboard riêng cho KTS Creator: xem link định danh, nộp clip (form C1), xem trạng thái clip đã nộp (C2), kho kit watermark tạm + 4 kịch bản tải `.txt` (C4) | KTS đã đăng nhập (role `kts`, hoặc `founder` để test) |
| `founder_kts_creator_draft.html` | Hạng mục B — dashboard Founder: tab Lead (B1+B2, lọc theo mã KTS/nền tảng/ngày, đếm hiệu quả — KHÔNG tự cộng điểm), tab Duyệt Clip (checklist 5 điểm C3, nút Đạt chuẩn/Từ chối), tab quản lý hồ sơ KTS Creator (thêm KTS vào chương trình, sinh mã, gắn badge Sáng lập, tạm ngưng/bật lại) | Chỉ Founder |

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
5. **`kts_creator_draft.html` là trang vệ tinh riêng, không nhúng trực tiếp trong
   `kts_dashboard.html`** — vì không được sửa trang production đó. KTS Creator pilot cần
   được gửi link riêng (`kts_creator_draft.html`) trong giai đoạn thử; khi nghiệm thu sẽ
   gắn 1 nút/tab trong `kts_dashboard.html` thật trỏ sang.
6. **Tự cấp mã `KTS-XXXX` (self-service)** — bất kỳ user role `kts` nào mở
   `kts_creator_draft.html` lần đầu sẽ TỰ được cấp hồ sơ + mã (không giới hạn đúng 3-5 KTS
   pilot như đề bài "Pilot 3-5 KTS trong 30 ngày"). Founder kiểm soát phạm vi thực tế bằng
   cách **chỉ gửi link `kts_creator_draft.html` cho đúng 3-5 KTS đã chọn** (PHẦN III mục 3)
   — không giới hạn cứng trong code. Có thể tạm ngưng (`active:false`) hồ sơ bất kỳ lúc nào
   trong tab "Hồ sơ KTS Creator". Sinh mã không hoàn toàn atomic (đọc toàn bộ collection rồi
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
2. Đăng nhập bằng `kts.tranlong` → mở `kts_creator_draft.html` → xác nhận tự động có mã
   `KTS-0001`, copy link hoạt động.
3. Mở `kts_landing_draft.html?code=KTS-0001` (tab ẩn danh, KHÔNG đăng nhập) → thấy tên, KHÔNG
   thấy SĐT/Zalo cá nhân → bấm "Bắt đầu Bước 1" → điền tên/SĐT + tick đồng ý → gửi thành công.
4. Mở `founder_kts_creator_draft.html` (đăng nhập `founder.tranlong`) → tab Lead thấy lead vừa
   tạo, lọc theo mã KTS/nền tảng/ngày hoạt động đúng.
5. Từ `kts_creator_draft.html`, nộp 1 clip (điền tiêu đề, chọn format, thêm 1-2 URL, tick cam
   kết) → sang tab Duyệt Clip của Founder, thấy clip "Chờ duyệt", tick đủ 5 checklist → bấm
   Đạt chuẩn → xác nhận trạng thái chuyển "Đạt chuẩn" và hiện lại bên KTS.
6. Thử bấm Đạt chuẩn khi CHƯA tick đủ 5 checklist → phải bị chặn (alert).
7. Thử Từ chối 1 clip, nhập lý do → xác nhận KTS thấy lý do từ chối.
8. Tab "Hồ sơ KTS Creator": thêm 1 KTS khác bằng username, xác nhận sinh mã mới không trùng;
   thử "Tạm ngưng" 1 hồ sơ → xác nhận landing của mã đó báo "tạm ngưng hiển thị".
9. Xác nhận `kts_landing_draft.html` / `kts_creator_draft.html` / `founder_kts_creator_draft.html`
   đều có ribbon BẢN NHÁP + không lọt vào `sitemap.xml` (chưa thêm, đúng ý).

## CÁC ĐIỂM CHỜ FOUNDER QUYẾT ĐỊNH

- [ ] Hướng xử lý Hạng mục D (xem mục DỪNG ở đầu file) — (a)/(b)/(c)?
- [ ] Xoá 13 collection `*_draft` cũ của diễn đàn trên Firestore Console trước khi test (tránh
      lẫn với `leads_draft` mới — xem lưu ý đặt tên ở trên), HOẶC đổi tên collection lead mới
      (vd `kts_creator_leads_draft`) nếu Founder muốn tách bạch tuyệt đối — báo lại để đổi.
- [ ] Xác nhận Founder tự chạy `firebase deploy --only firestore:rules` khi đã đọc block mới.
- [ ] URL đẹp `/kts/[mã]` — cấu hình redirect tầng hạ tầng (ngoài code) hay giữ query string?
- [ ] Danh sách 3-5 KTS pilot cụ thể (PHẦN III mục 3, PT Kinh doanh chọn) — gửi username để
      thêm vào tab "Hồ sơ KTS Creator" (hoặc để họ tự mở `kts_creator_draft.html`).
