# CHANGES.md — Khu "Cẩm nang làm nhà"

> Theo dõi tiến độ triển khai `applamnha.vn/cam-nang/` theo brief `CAM_NANG_ALN.md`.
> Quy trình: mỗi Pass ghi lại đây sau khi hoàn tất, commit riêng.

---

## Pass 1 — Khảo sát codebase + xác nhận kiến trúc (2026-07-03)

**Trạng thái:** Báo cáo, chưa code.

### Hiện trạng codebase liên quan

- **Không có build tool cho frontend.** Toàn bộ site là HTML/CSS/JS thuần, không có `package.json` ở root, không có bundler/SSG. `functions/package.json` chỉ phục vụ Cloud Functions (Node 22), không liên quan frontend.
- **Deploy:** GitHub Pages phục vụ tĩnh trực tiếp từ repo (branch `main`), tên miền tuỳ chỉnh qua file `CNAME` = `applamnha.vn`. Không có Jekyll bypass (`.nojekyll`) nhưng cũng không có nội dung dùng cú pháp Liquid nên chưa từng gây vấn đề — sẽ thêm `.nojekyll` khi tạo cấu trúc thư mục mới để tránh Jekyll xử lý ngầm thư mục `cam-nang/`.
- **`index.html`** hiện chỉ redirect sang `home.html` — đây là trang chủ thật (SEO, marketing, dark/light gold luxury theme).
- **Không có `sitemap.xml` / `robots.txt`** trong repo hiện tại.
- **3 bảng màu "gold" khác nhau đang tồn tại** trong site (phát hiện khi khảo sát, không có trong brief):
  - `home.html` (trang chủ đang chạy): gold `#98690a`, font DM Sans/Syne/Cormorant Garamond.
  - `tuyen-kts.html`: navy `#041020`, gold `#f6ca62`, font Oswald.
  - `aln-tokens.css` (dùng chung app nội bộ CN/DN/KTS): `--c-gold: #c9a84c`.
  - Brief `CAM_NANG_ALN.md` đề xuất thêm bảng màu thứ 4: navy `#0f2c52` / gold `#d4a017` / Oswald + Be Vietnam Pro.
- **`home.html`** có nav (`<nav id="nav">`, dòng ~489) với các mục: Mạng lưới KTS, Phòng Hội Kiến, Vì sao chọn ALN, Quy trình, Bảng giá, Ước tính, Thước Lỗ Ban, Phối cảnh, Kho mẫu, FAQ. Không có mục "Liên hệ" hay "Báo giá" (brief nhắc "giữa Báo giá và Liên hệ" — tên mục không khớp, sẽ chèn mục "Cẩm nang" cạnh "Bảng giá"/"FAQ" ở Pass 4). Footer ở dòng ~1034.
- **CI hiện có:** `code-check.yml` (kiểm tra emoji/thẻ HTML/kích thước file trên các trang app nội bộ, không đụng trang B2C) và `daily-report.yml` — không có workflow build/deploy nào cần tương thích.

### Quyết định kiến trúc đã xác nhận với Founder

1. **Bảng màu Cẩm nang:** đồng bộ theo `home.html` — gold `#98690a`, font DM Sans/Syne/Cormorant Garamond (KHÔNG dùng navy `#0f2c52`/gold `#d4a017`/Oswald như bản brief gốc đề xuất, để liền mạch với trang chủ đang chạy).
2. **Build Markdown → HTML:** viết script Node thuần (không thêm dependency npm ngoài), Claude Code tự chạy script mỗi khi thêm bài mới rồi commit thẳng HTML tĩnh sinh ra vào repo. Founder không cần chạy lệnh gì — giữ đúng mô hình "thuần tĩnh" hiện tại của site. Bài viết nguồn lưu ở `content/cam-nang/{slug}.md`, script build ra `cam-nang/{slug}/index.html` + cập nhật `cam-nang/index.html` (trang danh mục).
3. **Phạm vi `sitemap.xml`:** toàn site (không chỉ `/cam-nang/`) — liệt kê mọi trang public hiện có (`home.html`, `cam-nang/**`, các trang landing khác) để tối ưu SEO tổng thể luôn trong 1 lần làm.

### Nguyên tắc giữ nguyên (không đổi)

- Không sửa bất kỳ trang/chức năng app nội bộ nào (`client_CN`, `client_DN`, `kts_dashboard`, `founder_panel`, ...).
- Thay đổi DUY NHẤT trên trang đang chạy: thêm section "Cẩm nang" + mục nav trên `home.html` (Pass 4).
- Chưa deploy — chờ lệnh Founder sau khi duyệt giao diện Pass 2.

### Việc tiếp theo

→ Pass 2: build template bài viết + trang danh mục `/cam-nang/` với dữ liệu mẫu 1 bài giả (theo bảng màu home.html đã chốt), để Founder duyệt giao diện trước khi viết build script thật (Pass 3).
