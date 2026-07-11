# SEO — VIỆC TAY CHO CHỦ DỰ ÁN

> Đây là những việc Claude Code KHÔNG tự làm được — cần chủ dự án làm bằng tay.
> Làm theo thứ tự từ trên xuống. Mỗi mục có ghi rõ từng bước.

---

## 1. Đăng ký Google Search Console + nộp sitemap (LÀM NGAY — quan trọng nhất)

Google Search Console (GSC) là công cụ miễn phí của Google để theo dõi website
có được Google tìm thấy hay không. Chưa đăng ký = Google có thể chưa biết đến site.

### Bước 1 — Mở trang đăng ký
1. Mở trình duyệt, đăng nhập Gmail bằng tài khoản **trannam052022@gmail.com**.
2. Vào địa chỉ: `https://search.google.com/search-console`
3. Bấm nút **"Bắt đầu ngay"** (hoặc "Start now").

### Bước 2 — Thêm website
1. Màn hình hiện 2 ô. Chọn ô bên PHẢI: **"Tiền tố URL"** (URL prefix).
2. Gõ vào: `https://applamnha.vn` rồi bấm **Tiếp tục**.

### Bước 3 — Xác minh (verify)
1. Google hiện nhiều cách xác minh. Chọn cách **"Thẻ HTML"** (HTML tag).
2. Google đưa cho bạn 1 dòng mã dạng:
   `<meta name="google-site-verification" content="XXXXXXXX...">`
3. **Copy nguyên dòng đó**, gửi vào Claude Code và nói:
   *"Chèn thẻ meta verify Google này vào index.html rồi push"*
   (index.html là file mà địa chỉ applamnha.vn/ trả về — KHÔNG phải home.html).
4. Chờ 2–3 phút cho GitHub Pages cập nhật, quay lại Google bấm **"Xác minh"**.
   (Nếu báo lỗi, chờ thêm 5 phút rồi bấm lại — Pages build hơi chậm.)

### Bước 4 — Nộp sitemap
1. Sau khi xác minh xong, ở menu bên trái chọn **"Sơ đồ trang web"** (Sitemaps).
2. Ô "Thêm sơ đồ trang web mới" gõ: `sitemap.xml` → bấm **Gửi**.
3. Trạng thái hiện "Thành công" là xong. Google sẽ tự đọc các trang trong vài ngày.

### Sau đó (mỗi tuần xem 1 lần)
- Vào GSC → mục **"Hiệu suất"** (Performance): xem site được bao nhiêu lượt hiện
  trên Google, người ta gõ từ khóa gì mà thấy mình.

---

## 2. Kiểm tra dữ liệu có cấu trúc (schema) — 5 phút, làm sau khi Phase 1 xong

1. Mở trang cần kiểm (ví dụ 1 trang mẫu nhà) trên trình duyệt.
2. Copy địa chỉ trang.
3. Vào `https://validator.schema.org` → dán địa chỉ → bấm **"Run test"**.
4. Không có dòng đỏ (Error) là đạt. Dòng vàng (Warning) có thể bỏ qua.

---

*(File này sẽ được bổ sung thêm mục ở Phase 1–3: quy trình thêm mẫu nhà mới,
Google Business Profile, xin review Google, hiệu chỉnh đơn giá dự toán.)*
