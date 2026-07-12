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

## 3. Quy trình thêm mẫu nhà mới (Trụ 1 — Kho mẫu)

Khi có mẫu nhà mới muốn đưa lên `mau/`:

1. Mở file `data/mau-nha.json`, thêm 1 object mới vào mảng `"mau"` (copy 1 mẫu
   có sẵn rồi sửa lại — theo đúng field: `id, maGoc, slug, ten, loai, ngang,
   dai, tang, phongNgu, phongTam, dienTichDat, dienTichSan, phongCach,
   duToanTu, duToanDen, anh, moTa, ktsTacGia, giaBanMau, tags`).
2. Nhờ Claude Code chạy 2 lệnh (dán nguyên văn dưới đây):
   ```
   node tools/gen-mau.js && node tools/gen-sitemap.js
   ```
3. Kiểm nhanh trang mới sinh ở `mau/{slug}.html`, rồi:
   ```
   git add -A && git commit -m "Them mau nha moi: {ten}" && git push
   ```

**Lưu ý:** nếu chưa có ảnh phối cảnh thật, để `"anh": []` — trang tự hiện khung
"Phối cảnh đang cập nhật", KHÔNG tự ý dùng ảnh của mẫu khác (từng bị lỗi này,
đã sửa — xem lịch sử commit "bo anh muon sai san pham").

---

## 4. Quy trình thêm tỉnh/thành mới (Trụ 2 + Trụ 3 — Dự toán & Thiết kế theo tỉnh)

1. Mở `data/tinh.json`, thêm 1 object mới vào mảng `"tinh"`:
   - `slug`: dùng trong URL (VD `can-tho`)
   - `ten`: tên hiển thị (VD `Cần Thơ`)
   - `heSoVungKey`: trỏ tới 1 khoá trong `data/don-gia.json` → `heSoVung`
     (nếu tỉnh mới chưa có hệ số riêng, thêm khoá mới vào `don-gia.json` trước)
   - `gioiThieu`: đoạn giới thiệu ~150-200 từ cho trang **dự toán** (góc nhìn
     chi phí/nền đất) — PHẢI viết riêng, không copy tỉnh khác
   - `gioiThieuThietKe`: đoạn giới thiệu ~150-200 từ cho trang **thiết kế
     theo tỉnh** (góc nhìn dịch vụ KTS/Escrow) — PHẢI khác với `gioiThieu`
     ở trên (2 trang khác mục đích, trùng nội dung bị Google phạt)
2. Nhờ Claude Code chạy 3 lệnh:
   ```
   node tools/gen-dutoan.js && node tools/gen-tinh.js && node tools/gen-sitemap.js
   ```
3. Kiểm nhanh `du-toan/xay-nha-tai-{slug}.html` và `thiet-ke-nha/{slug}.html`,
   rồi `git add -A && git commit -m "Them tinh moi: {ten}" && git push`.

---

## 5. Đăng ký Google Business Profile "App Làm Nhà" tại Vũng Tàu

Google Business Profile (trước đây gọi Google My Business) giúp ALN hiện trên
Google Maps + khối thông tin bên phải khi khách tìm "thiết kế nhà Vũng Tàu".

1. Vào `https://business.google.com` → đăng nhập bằng Gmail
   **trannam052022@gmail.com**.
2. Bấm **"Quản lý ngay"** (Manage now).
3. Gõ tên doanh nghiệp: **App Làm Nhà**.
4. Chọn danh mục: gõ tìm **"Kiến trúc sư"** (Architect) — nếu có thêm lựa
   chọn phụ, chọn thêm **"Dịch vụ thiết kế nhà ở"** (Home builder / Design
   service) nếu Google gợi ý.
5. Khi hỏi "Bạn có địa điểm khách đến được không?" — chọn theo thực tế văn
   phòng (nếu chỉ tư vấn online/qua điện thoại, chọn **"Không"**, chỉ khai
   khu vực phục vụ).
6. Khai khu vực phục vụ: gõ lần lượt **Vũng Tàu, Bà Rịa, TP.HCM, Biên Hòa,
   Đồng Nai, Bình Dương** (đúng 6 khu vực đã có trang riêng trên web).
7. Nhập số điện thoại: **0909 82 9696**, website: **https://applamnha.vn**.
8. Google sẽ yêu cầu xác minh (qua tin nhắn/gọi điện hoặc video xác minh vị
   trí) — làm theo hướng dẫn trên màn hình. Xác minh xong hồ sơ mới hiện
   công khai trên Google Maps/Tìm kiếm.

---

## 6. Quy trình xin review Google sau khi nghiệm thu chặng C4

Review Google giúp hồ sơ Google Business Profile đáng tin hơn, xếp hạng tốt
hơn trong tìm kiếm địa phương. Xin review **ngay sau khi chủ nhà nghiệm thu
chặng C4** (thi công xong) — lúc họ hài lòng nhất.

**Mẫu tin nhắn Zalo gửi chủ nhà:**

> Chào anh/chị {tên_chủ_nhà}, cảm ơn anh/chị đã tin tưởng đồng hành cùng ALN
> từ những bước đầu tiên đến khi hoàn thiện ngôi nhà 🏡
> Nếu anh/chị hài lòng với trải nghiệm cùng ALN, anh/chị dành 1 phút đánh giá
> giúp ALN trên Google được không ạ? Đánh giá thật của anh/chị sẽ giúp nhiều
> gia đình khác yên tâm hơn khi tìm hiểu dịch vụ.
> Link đánh giá: {link_google_review}
> (Link đánh giá lấy trong Google Business Profile → mục "Nhận thêm đánh giá"
> → copy link, dán vào chỗ {link_google_review} ở trên trước khi gửi.)

Gửi tin nhắn này thủ công qua Zalo trong vòng 1-2 ngày sau khi ký biên bản
nghiệm thu C4 — không gửi hàng loạt tự động để giữ cảm giác cá nhân hoá.

---

## 7. Hiệu chỉnh đơn giá TRƯỚC khi chạy quảng cáo

`data/don-gia.json` và các trang `mau-nha.json` hiện có **SỐ LIỆU GIẢ ĐỊNH**
(xem `_ghiChu` trong từng file) — dùng để dựng xong tool, KHÔNG phải giá thật.

**Trước khi chạy bất kỳ quảng cáo trả phí nào** vào `du-toan/` hoặc `mau/`:
1. Hỏi 2-3 đơn vị thi công/KTS đối tác về đơn giá thật hiện tại theo mức
   hoàn thiện (cơ bản/khá/cao cấp) và theo loại công trình.
2. Sửa các số trong `data/don-gia.json` (`donGiaThoM2`, `heSoLoai`,
   `heSoVung`) cho khớp giá thật.
3. Nhờ Claude Code chạy: `node tools/gen-dutoan.js && node tools/gen-sitemap.js`
4. Kiểm tra lại 1-2 trang dự toán xem kết quả có hợp lý không rồi mới chạy ads.

---

## 8. Domain tuỳ chỉnh (đã xong — chỉ để tham khảo)

Site đã chạy trên domain thật **applamnha.vn** (không còn ở địa chỉ GitHub
Pages mặc định). Nếu sau này đổi sang domain khác, báo Claude Code để cập
nhật lại toàn bộ URL trong `robots.txt`, `sitemap.xml`, thẻ `canonical` và
`og:url` trên tất cả các trang — đây là việc Claude Code làm được, không
cần làm tay.

## 9. Báo cáo SEO tự động trong Founder Panel (cấp quyền 1 lần — 5 phút)

Tab **Vận hành → SEO & Analytics** trong founder_panel kéo số liệu Search
Console (vị trí, hiển thị, nhấp) + Google Analytics (khách vào trang nào)
về một chỗ, và cron `seoDailyReport` 08:30 mỗi sáng tự lưu lịch sử + đẩy
thông báo. Trước khi có số liệu, cần cấp quyền cho service account của
Firebase — làm đúng 4 bước, mỗi bước 1 phút:

### Bước 1 — Bật 2 API (đăng nhập trannam052022@gmail.com)
- Mở https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=aln-platform → bấm **Enable**.
- Mở https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=aln-platform → bấm **Enable**.

### Bước 2 — Cấp quyền Search Console
- Vào https://search.google.com/search-console → chọn property applamnha.vn
- **Cài đặt (Settings) → Người dùng và quyền (Users and permissions) → Thêm người dùng**
- Email: `aln-platform@appspot.gserviceaccount.com` — quyền **Đầy đủ (Full)**.

### Bước 3 — Cấp quyền GA4
- Vào https://analytics.google.com → **Quản trị (Admin) → Quản lý quyền truy cập tài sản (Property access management)**
- Thêm cùng email trên, vai trò **Người xem (Viewer)**.
- Nhân tiện copy **Property ID**: Quản trị → Chi tiết tài sản (Property details) → dãy số ở góc phải (VD `456789123`).

### Bước 4 — Điền cấu hình trong Founder Panel
- Mở founder_panel → **Vận hành → SEO & Analytics**.
- URL site: điền đúng như dạng property trong Search Console
  (URL-prefix: `https://applamnha.vn/` — hoặc nếu là Domain property thì `sc-domain:applamnha.vn`).
- GA4 Property ID: dãy số vừa copy → **Lưu cấu hình** → **Cập nhật số liệu**.

Sau đó không phải làm gì nữa: mỗi sáng 08:30 hệ thống tự kéo số liệu, lưu
vào `seoReports/{ngày}` để vẽ xu hướng vị trí theo thời gian, và đẩy push
"SEO & Analytics sáng nay" cho Founder. Vị trí trung bình **≤ 10 = trang đầu**.

## 10. Xây backlink — checklist theo thứ tự dễ → khó (mỗi tuần làm 1-2 mục)

Backlink = trang web khác trỏ link về applamnha.vn. Với domain mới, vài chục
link nền tảng (foundation links) + vài link chất lượng là đủ tạo khác biệt.
KHÔNG mua backlink số lượng lớn giá rẻ — dễ bị Google phạt, mất công gỡ.

### Nhóm 1 — Miễn phí, làm ngay (link nền tảng)
- [ ] Google Business Profile (mục 5) — điền website applamnha.vn vào hồ sơ.
- [ ] Fanpage Facebook "App Làm Nhà": mục Giới thiệu → thêm website; mỗi bài
      đăng Cẩm nang kèm link bài viết (workflow FB tự làm nếu đã bật).
- [ ] Tạo kênh: YouTube / TikTok / Zalo OA (khi được duyệt) — phần mô tả kênh
      đều có link về site.
- [ ] Đăng ký doanh nghiệp trên các danh bạ: Trang Vàng (yellowpages.vn),
      1900.com.vn, các danh bạ doanh nghiệp tỉnh — điền đúng tên "App Làm Nhà",
      địa chỉ, SĐT 0909 82 9696, website (NAP nhất quán giúp SEO local).

### Nhóm 2 — Nội dung đi "làm khách" (mỗi tháng 1-2 bài)
- [ ] Diễn đàn xây dựng/nhà đất VN (webtretho, otofun mục nhà cửa, forum
      xây dựng...): trả lời câu hỏi thật về chi phí xây nhà, dẫn link bài
      Cẩm nang tương ứng khi đúng ngữ cảnh. KHÔNG spam link trần.
- [ ] Nhóm Facebook "xây nhà", "review kiến trúc sư" theo tỉnh: chia sẻ bài
      Cẩm nang tỉnh đó (bài chi phí theo tỉnh rất hợp).
- [ ] Guest post trên blog/báo địa phương về nhà cửa: chủ động gửi bài
      "Chi phí xây nhà tại X 2026" rút gọn, xin 1 link về bài gốc.

### Nhóm 3 — Chất lượng cao (khi có nguồn lực)
- [ ] Báo online mảng bất động sản/đời sống (CafeLand, Batdongsan.com.vn
      mục tin tức, báo tỉnh): bài PR hoặc trích dẫn chuyên gia — KTS ALN
      trả lời phỏng vấn về xu hướng xây nhà, kèm link.
- [ ] Đối tác: đơn vị thi công đối tác, cửa hàng VLXD, sàn BĐS địa phương —
      trao đổi đặt link giới thiệu lẫn nhau (chỉ đối tác thật).

**Đo kết quả:** Search Console → Liên kết (Links) ở menu trái — xem site nào
đang trỏ về. Số liên kết tăng đều + vị trí từ khóa cải thiện trong tab
SEO & Analytics của founder_panel là đúng hướng.
