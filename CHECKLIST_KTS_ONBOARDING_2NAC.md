# CHECKLIST — ĐĂNG KÝ KTS HAI NẤC (TÁCH RIÊNG TỪ PASS 7)

> **Điều kiện tiên quyết:** CHỈ bắt đầu sau khi `CHECKLIST_PHANQUYEN_DIENDAN_ALN.md`
> (PASS 1–6) đã nghiệm thu xong.
>
> **Mục tiêu:** KTS vào cuộc trong 30 giây, đầu tư hồ sơ sớm, rồi mới xác minh chứng chỉ.
> Diễn đàn là tầng giữa của phễu tuyển "thế hệ KTS đầu tiên".
>
> **Kiến trúc tuân theo hệ thống hiện tại:** role đọc từ `users/{uid}.role`
> (KHÔNG custom claims); mọi lượt ghi nghiệp vụ đi qua Cloud Functions.

---

## ⚠️ QUY TẮC TRIỂN KHAI: BẢN NHÁP TRƯỚC — DUYỆT MỚI BẬT

- [ ] Toàn bộ tính năng xây sau **feature flag** `kts_two_tier_signup` (mặc định TẮT),
      dùng hệ thống feature flags role-based đã thiết kế (CN/KTS/DN/Founder).
- [ ] Khi flag TẮT: người dùng thường KHÔNG thấy bất kỳ UI nào của luồng mới —
      luồng đăng ký hiện tại giữ nguyên, không gián đoạn.
- [ ] Khi flag TẮT nhưng user là **Founder**: vẫn thấy và chạy thử được toàn bộ luồng
      (đăng ký nấc 1, upload hồ sơ, nộp chứng chỉ, hàng đợi duyệt) để nghiệm thu.
- [ ] Rules và Cloud Functions deploy trước được (không gây hại khi chưa ai gọi),
      nhưng KHÔNG được thay đổi hành vi của luồng đăng ký đang chạy.
- [ ] Hoàn thành → báo cáo + hướng dẫn Founder test → **CHỜ DUYỆT**. Chỉ khi TRANNAM
      xác nhận "OK bật" mới đổi flag sang BẬT công khai.
- [ ] Rollback: tắt flag là quay về luồng cũ ngay, không cần deploy lại.

---

## QUYẾT ĐỊNH CẦN CHỐT TRƯỚC KHI CODE

- [ ] **Phương án xác thực sđt** (TRANNAM chọn một):
  - **A. Firebase Phone Auth (OTP SMS):** tự động, nhưng tính phí theo SMS ở VN —
    cần bật billing, kiểm tra quota và ước lượng chi phí trước.
  - **B. Xác thực thủ công giai đoạn đầu:** KTS nhập sđt, đội ALN gọi/Zalo xác nhận
    khi duyệt nấc 2. Không tốn phí SMS, nâng cấp lên OTP sau khi có volume.

---

## GIAI ĐOẠN 1 — Nấc 1: Đăng ký nhanh (sđt + tên)

- [ ] Form đăng ký nấc 1 chỉ gồm: **Số điện thoại + Họ tên**. Không hỏi thêm gì khác.
- [ ] Xác thực sđt theo phương án đã chốt ở trên (A hoặc B).
- [ ] Tạo user với `users/{uid}.role = 'kts_pending'` (giá trị role MỚI, ghi qua
      Cloud Function bằng Admin SDK — nhất quán với cách toàn hệ thống xác định role).
- [ ] Quyền của `kts_pending` trên diễn đàn: như CN (đọc public, bình luận, thích, lưu)
      — CHƯA có huy hiệu, CHƯA vào khu nội bộ KTS, CHƯA nhận tin nhắn từ khách.
      Bình luận của `kts_pending` vẫn đi qua `forumComment` + bộ lọc chống lách sàn
      như mọi role khác.
- [ ] **Tải hồ sơ ngay tại nấc 1:**
  - [ ] Upload profile cá nhân (PDF, tối đa ~10MB)
  - [ ] Upload tối đa 3 bộ hồ sơ hoàn thiện đã làm (PDF/ảnh, giới hạn dung lượng mỗi bộ)
  - [ ] Lưu vào Storage path riêng: `kts_applications/{uid}/...`
  - [ ] Storage rules: chỉ chính chủ uid được write; chỉ chủ uid + Founder được read.
        TUYỆT ĐỐI không public — hồ sơ dự án là tài sản của KTS.
  - [ ] Firestore: tạo document `kts_applications/{uid}` với trạng thái
        `profile_uploaded`, timestamp, danh sách file.
- [ ] UX sau upload: màn hình "Hồ sơ đã ghi nhận" + CTA rõ ràng dẫn sang nấc 2:
      "Nộp chứng chỉ hành nghề để mở khóa toàn bộ quyền lợi KTS".

**Commit:** `feat(kts-onboarding): nấc 1 — đăng ký sđt+tên, upload hồ sơ (sau flag)`

---

## GIAI ĐOẠN 2 — Nấc 2: Nộp chứng chỉ xác minh

- [ ] Form nộp chứng chỉ hành nghề (theo NĐ 15/2021): ảnh/PDF chứng chỉ + số chứng chỉ
      + hạng. Lưu vào cùng `kts_applications/{uid}`, trạng thái → `pending_verification`.
- [ ] Giao diện KTS trong lúc chờ: badge **"Đang xác minh"** cạnh tên + panel liệt kê
      quyền lợi sắp mở khóa:
  - Huy hiệu vàng "KTS đã xác minh"
  - Quyền trả lời nổi bật câu hỏi của khách
  - Truy cập khu nội bộ KTS
  - Nhận tin nhắn trực tiếp từ khách hàng
- [ ] Founder Admin: hàng đợi duyệt xác minh — xem profile + 3 bộ hồ sơ + chứng chỉ
      trên cùng một màn hình, nút Duyệt / Từ chối (kèm lý do), ghi log người duyệt
      + thời điểm.
- [ ] Khi Duyệt: Cloud Function (Admin SDK) cập nhật `users/{uid}.role` từ
      `'kts_pending'` → `'kts'`, gửi thông báo (Zalo/SMS hoặc in-app)
      "Chúc mừng, bạn đã là KTS xác minh trên ALN".
      Quyền mới có hiệu lực NGAY ở lần đọc rules kế tiếp (rules get() từ users doc,
      không cần refresh token).
- [ ] Khi Từ chối: giữ `kts_pending`, hiện lý do + cho nộp lại.

**Commit:** `feat(kts-onboarding): nấc 2 — xác minh chứng chỉ + hàng đợi duyệt Founder Admin`

---

## GIAI ĐOẠN 3 — Nối vào phễu hiện có & cập nhật rules

- [ ] Nút "Trở thành KTS trên ALN" ở chuyên mục khóa (PASS 4 file diễn đàn) và ở landing
      `kts-apply.html` đều dẫn về cùng luồng nấc 1 — một phễu duy nhất, không tách đôi.
- [ ] Quay lại rules diễn đàn: bổ sung role `kts_pending` và ca test tương ứng:
  - [ ] `kts_pending` đọc bài public → PASS
  - [ ] `kts_pending` đọc khu KTS → DENY
  - [ ] `kts_pending` ghi thẳng vào `forumPosts` → DENY (như mọi role)
- [ ] Cập nhật Cloud Function `forumPost`/`forumComment`: nhận diện `kts_pending`
      với quyền ngang CN (không được đăng vào khu KTS/DN).
- [ ] Không đề cập mục tiêu 100 KTS ở bất kỳ nội dung công khai nào — dùng
      "thế hệ KTS đầu tiên" theo đúng quy ước.
- [ ] Cập nhật CHANGES.md, lưu checkpoint vào `D:\2 - CLAUDE - WORKSPACE\MARKETING`.

**Commit cuối:** `feat(kts-onboarding): hoàn tất đăng ký hai nấc — chờ TRANNAM duyệt để bật flag`

---

## GHI CHÚ CHO CLAUDE CODE

1. Làm tuần tự Giai đoạn 1 → 3. Commit sau mỗi giai đoạn.
2. Role đọc/ghi qua `users/{uid}.role` bằng Admin SDK — KHÔNG đưa custom claims
   vào hệ thống.
3. Hồ sơ trong `kts_applications/` là dữ liệu nhạy cảm: không bao giờ để read public,
   không log nội dung file, không đưa URL download vào bất kỳ document công khai nào.
4. Không chạm vào bộ lọc chống lách sàn. Không nới lỏng rule của collection khác.
5. Dừng lại chờ TRANNAM chốt phương án xác thực sđt (A/B) trước khi code Giai đoạn 1.
6. KHÔNG tự ý bật flag `kts_two_tier_signup` — chờ TRANNAM duyệt.
