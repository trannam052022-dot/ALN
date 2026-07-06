# MONETIZATION_KTS.md — LỘ TRÌNH BÁN GÓI TIỆN ÍCH CHO KTS

> **Trạng thái: DỰ TRÙ TƯƠNG LAI — CHƯA TRIỂN KHAI.**
> File này là định hướng chiến lược, mở ra dùng khi nền tảng đạt các mốc bên dưới.
> Doanh thu lõi của ALN vẫn là phí giao dịch escrow C1–C4. Gói tiện ích KTS là
> doanh thu tầng hai — chỉ bật khi không làm hại phễu tuyển KTS.

---

## NGUYÊN TẮC VÀNG (không bao giờ vi phạm)

**Miễn phí thứ tạo mật độ — thu tiền thứ tạo lợi thế.**

MIỄN PHÍ VĨNH VIỄN (mạch máu của marketplace):
- Đăng ký, hồ sơ KTS cơ bản, huy hiệu "KTS đã xác minh"
- Trả lời khách trên diễn đàn
- Nhận và trả lời tin nhắn đầu tiên từ khách
- Tham gia khu nội bộ KTS

THU TIỀN ĐƯỢC (lợi thế cạnh tranh giữa các KTS):
- Công cụ AI làm nghề vượt hạn mức miễn phí
- Vị trí nổi bật CÓ DÁN NHÃN
- Tiện ích quản lý công việc nâng cao

---

## BA TẦNG THU PHÍ — THEO THỨ TỰ TRIỂN KHAI

### TẦNG 1 — Trợ lý AI cho KTS (an toàn nhất, làm trước)

Đóng gói tài sản sẵn có thành công cụ:
- Enhance phối cảnh render (workflow ALN_PROMPT_ENHANCE_PHOICANH.md)
- CAD → 3D isometric (workflow nhà phố / biệt thự)
- MyMy hỗ trợ KTS: soạn brief, gợi ý trả lời khách, tóm tắt yêu cầu dự án

Mô hình: **freemium theo lượt**
- Miễn phí: X lượt/tháng (đủ để "nghiện", không đủ để làm nghề full)
- Gói trả phí: không giới hạn hoặc gói lượt lớn
- Chi phí API tỷ lệ thuận usage → gói trả phí tự bù chi phí vận hành

Vì sao an toàn: KTS trả tiền cho công cụ làm nghề — không ai thấy "bất công",
không ảnh hưởng niềm tin của chủ nhà vào nền tảng.

### TẦNG 2 — Gói nổi bật hồ sơ (làm sau, có 2 chốt bắt buộc)

- Hồ sơ KTS xuất hiện ở vị trí ưu tiên khi khách tìm kiếm / trong danh sách đề xuất.
- **CHỐT 1 — Minh bạch:** vị trí trả phí PHẢI dán nhãn "Nổi bật" / "Được tài trợ".
  Khách phát hiện kết quả bị thao túng ngầm = mất niềm tin vào escrow = mất tất cả.
- **CHỐT 2 — Chất lượng trước, tiền sau:** chỉ KTS đã xác minh + điểm chất lượng
  đạt ngưỡng (đánh giá khách, tỷ lệ hoàn thành milestone) mới được mua.
  Tiền không mua được cách vượt qua chất lượng — chỉ mua ánh đèn chiếu vào
  chất lượng sẵn có. Đây là điểm ALN khác nền tảng rao vặt.

### TẦNG 3 — Tiện ích quản lý nâng cao (xa hơn, khi KTS có nhiều dự án song song)

- Dashboard quản lý nhiều dự án, nhắc deadline milestone C1–C4
- Thống kê hiệu suất: tỷ lệ chốt khách, thời gian phản hồi so với mặt bằng
- Mẫu hồ sơ / khung bản vẽ A3 nâng cao theo Ma Trận Ký

### KHÔNG BAO GIỜ THU
- Phí để được trả lời khách trên diễn đàn
- Phí để nhận tin nhắn đầu tiên từ khách
- Phí "hoa hồng ngầm" không công bố

---

## MỐC KÍCH HOẠT (điều kiện cần trước khi bật từng tầng)

| Tầng | Điều kiện tối thiểu | Lý do |
|---|---|---|
| Tầng 1 | ~50+ KTS xác minh hoạt động; công cụ AI bản miễn phí đã dùng ổn định 2–3 tháng | Cần "nghiện" trước khi giới hạn |
| Tầng 2 | ~100+ KTS xác minh; hệ thống điểm chất lượng chạy được (cần dữ liệu đánh giá thật từ dự án escrow) | Không có điểm chất lượng thì Chốt 2 vô nghĩa |
| Tầng 3 | KTS trung bình có 3+ dự án song song trên sàn | Chưa nhiều dự án thì dashboard không có gì để quản |

**Chưa đạt mốc → không bật.** Bật sớm: mỗi đồng thu được đổi bằng một KTS bỏ đi,
trong khi doanh thu escrow cần đông KTS. Lỗ kép.

---

## KHUNG GIÁ THAM CHIẾU (gợi ý ban đầu, chốt lại khi triển khai)

Neo theo mặt bằng giá thiết kế hiện hành (nhà phố 120k/m², biệt thự 160k/m²,
nội thất 120–180k/m²): một dự án nhà phố 100m² ≈ 12 triệu doanh thu thiết kế.

- **Tầng 1 (AI):** ~199k–399k/tháng. Logic bán hàng: "chưa tới 3% doanh thu
  một dự án nhỏ — tiết kiệm nhiều giờ dựng phối cảnh mỗi dự án".
- **Tầng 2 (Nổi bật):** ~499k–999k/tháng hoặc theo gói tuần. Logic: "thêm 1 dự án
  chốt được mỗi quý là hoàn vốn cả năm".
- **Tầng 3:** gộp vào gói "KTS Pro" tổng ~699k–1.2tr/tháng (bao gồm Tầng 1).
- Giá cụ thể phải khảo sát KTS thật trước khi chốt. Nguyên tắc: giá gói tháng
  luôn < 10% doanh thu thiết kế một dự án nhỏ nhất.

---

## CHUẨN BỊ KỸ THUẬT TỪ BÂY GIỜ (chi phí ~0)

- [x] **XONG (06/07/2026, gộp vào PASS 3 diễn đàn):** chừa sẵn trường trong `users/{uid}`:
      `plan: 'free'` và `credits: {}` (map rỗng) — CHỈ chừa trường, không xây logic/UI/rules.
      Thêm vào 5 luồng tạo user mới (`register.html`, `kts-apply.html`, `dn-studio.html`,
      `designer-apply.html`, `ks-apply.html`, `createUserByFounder`) + backfill user cũ
      qua callable `founderNormalizeUsers` (nút "Chuẩn hoá dữ liệu users" trong
      `founder_forum.html` → Tools). Xem `CHECKLIST_PHANQUYEN_DIENDAN_ALN.md` PASS 3.
- [ ] **CHƯA làm** — không nằm trong phạm vi được giao lần này: log usage công cụ AI
      (enhance phối cảnh, MyMy hỗ trợ KTS...) theo uid vào collection `ai_usage`.
- [ ] Giá sàn/trần và giá gói: giữ nguyên tắc MyMy — không bao giờ xuất hiện
      phía client dưới dạng logic tính toán; hiển thị giá là dữ liệu server trả về.
      (Nguyên tắc đang giữ, không phải việc mới cần làm.)

---

## GHI CHÚ

- File này cất tại `D:\2 - CLAUDE - WORKSPACE\MARKETING`, xem lại mỗi khi
  đạt mốc KTS mới (50 / 100).
- Khi kích hoạt tầng nào, viết checklist triển khai riêng cho tầng đó theo
  đúng quy trình PASS + feature flag + TRANNAM duyệt mới bật.
