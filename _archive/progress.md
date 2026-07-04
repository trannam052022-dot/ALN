# TIẾN ĐỘ DỰ ÁN ALN (App Làm Nhà)

Cập nhật: 2026-06-19

---

## Tổng quan
Nền tảng theo dõi công trình xây dựng. Frontend tĩnh HTML/JS trên GitHub Pages, backend Firebase (Auth + Firestore + Storage + FCM).

- GitHub Pages: https://trannam052022-dot.github.io/ALN/
- Branch chính: `main` — push lên là Pages tự build (~1-2 phút)

---

## Tài khoản test (mật khẩu: Test@1234)

| Vai | Username | UID |
|-----|----------|-----|
| founder | founder.tranlong | h4kEguPEyMcwJwl89stc0Q6j2si2 |
| kts | kts.tranlong | kw5TgVDggIfboEqERS1cAphn3263 |
| dn | dn.tkhouse | aTyHR3oQw6P87xpA9p8hTr2NbGA2 |
| cn | cn.trannam | G4RhRH5ECMYcE9aFcKYVn5Wdy952 |

---

## Đã hoàn thành (các phiên trước)

### client_DN.html
- Ảnh phương án hiển thị đúng trong modal (dùng `window._dnImgMap` + `data-img` attr)
- Avatar KTS: đọc `avatarURL` từ Firestore `users/{ktsUid}` (qua `_dnLoadKtsAvatar`)
- Thông báo PROPOSAL_SENT hiện đúng khi reload (inject từ Firestore snapshot)
- Debounce 80ms + lazy subscription proposals (chỉ subscribe khi mở Bảng Review)
- **[Phiên 19/06]** Xoá 9 slot upload per-proposal ra khỏi review-panel
- **[Phiên 19/06]** Thêm card "Tài liệu bàn giao KTS" (1 vùng kéo-thả duy nhất)
  - Tab: "Nộp hồ sơ" (data-aln-tab="c4")
  - Upload → Firebase Storage `uploads/{pid}/dn/{ts}_{file}`
  - Ghi Firestore `projects/{pid}/documents` (role:"dn")
  - Gửi ALNRealtime `DN_FILE_UPLOADED` → KTS nhận thông báo

### kts_dashboard.html
- Avatar KTS upload lên Storage + ghi `users/{uid}/avatarURL` Firestore
- **[Phiên 19/06]** Handler `DN_FILE_UPLOADED`: toast + refresh `_alnWatchDocs`
  (KTS thấy file DN gửi trong danh sách tài liệu, labeled "DN")

---

## LỖI DATA — cần sửa tay trong Firebase Console

**projects/ALN-9921** có dữ liệu sai:
- `stage` → đang là `"C3"`, phải đổi lại `"C2"`
- `kts.name` → đang là `"Trần Nam"`, phải đổi lại `"KTS. Trần Đại Long"`
- `kts.uid` → kiểm tra = `kw5TgVDggIfboEqERS1cAphn3263`

Cách sửa: Firebase Console → Firestore → projects → ALN-9921 → Edit fields

---

## Việc cần làm tiếp (ưu tiên)

1. **Tạo index Firestore KTS**: `kts.uid` ASC + `updatedAt` DESC
   → mở khóa trang kts_dashboard.html (đang lỗi `failed-precondition`)

2. **Test luồng DN gửi file → KTS nhận**:
   - Đăng nhập DN, vào "Nộp hồ sơ", kéo file vào zone, bấm Gửi
   - Kiểm tra Storage có file không, Firestore `documents` có doc mới không
   - Đăng nhập KTS, kiểm tra toast + danh sách tài liệu có file DN không

3. **Làm client_CN.html** (trang Chủ nhà):
   - Copy từ client_DN.html, điều chỉnh cho vai CN
   - Query Firestore: `where('cn.uid','==',uid)` (founder bỏ where)
   - Không có tab "Bảng Review" và upload; chỉ xem tài liệu + tiến độ

4. **Làm designer_dashboard.html** (trang Designer/DESIGNER):
   - Copy từ kts_dashboard.html

5. **Mở Rules FCM/settings** (lỗi vàng `permission-denied` vô hại):
   ```
   match /fcmTokens/{tokenId} { allow create, update: if signedIn() ... }
   match /settings/{docId}    { allow read: if signedIn(); }
   ```

6. **Bước "Nối nút GHI"**:
   - Upload tài liệu KTS (C3 submit đã làm)
   - Duyệt chặng (approvePA đã làm phía DN)
   - Gửi góp ý / pin (đã bỏ khỏi scope — KHÔNG làm lại)

7. **Điều tra App Check** → bỏ bypass founder UID cứng → siết Firestore Rules

8. **register.html** (GĐ2): 3 vai tự đăng ký, OTP điện thoại, KTS/DN chờ duyệt

---

## Kiến trúc quan trọng cần nhớ

### 2 scope script trong mỗi trang
- `<script>` thường: KHÔNG dùng `?.` (optional chaining) hay object shorthand
- `<script type="module">`: Firebase APIs, modern JS OK
- Để module gọi hàm UI: expose qua `window.*`

### Tab system (cnApplyTabs IIFE) — client_DN.html
- `up` = Tổng quan (default, stat cards, progress)
- `rv` = Bảng Review (review-panel)
- `c4` = Nộp hồ sơ (Kho Tài liệu + DN Upload card)
- Phân loại: text "bàn giao|kho tài liệu" → c4; "phương án|review" → rv; còn lại → up
- `data-aln-tab="c4"` trực tiếp trên element → bỏ qua classify()

### Firestore paths chính
- `projects/{pid}` — dữ liệu dự án
- `projects/{pid}/documents/{docId}` — tài liệu (KTS role:"kts", DN role:"dn")
- `projects/{pid}/stages/{stage}/proposals/{paId}` — phương án KTS
- `users/{uid}` — hồ sơ user (avatarURL, name, role...)
- `fcmTokens/{token}` — FCM push token

### ALNRealtime events đã dùng
- `PROPOSAL_SENT` (KTS → DN/CN): KTS gửi phương án
- `DN_FILE_UPLOADED` (DN → KTS): DN gửi tài liệu
- `KTS_DOC_UPLOAD` (KTS → DN): KTS upload bản vẽ
- `CN_FILE_UPLOADED` (DN → KTS): legacy, có thể bỏ
- `ALN_CHAT`: tin nhắn chat 2 chiều
