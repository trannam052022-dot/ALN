# BÀN GIAO — Dự án ALN (để tiếp tục ở chat mới)

> Dán file này (hoặc nội dung) vào đầu chat mới để Claude nắm ngay bối cảnh. Trả lời bằng tiếng Việt. Người dùng ở TP.HCM, không phải dev.

## 1. Dự án ALN ("App Làm Nhà")
Sàn kết nối chủ nhà (CN) – kiến trúc sư (KTS) – doanh nghiệp xây dựng (DN).
- Firebase project: **aln-platform** (Blaze, region asia-southeast1, SDK 10.12.0).
- GitHub: **github.com/trannam052022-dot/ALN** (public), Pages: https://trannam052022-dot.github.io/ALN/
- Thư mục master (nguồn chân lý, đồng bộ GitHub): **C:\Users\HP\Documents\ALN**
- File chính: login.html, client_CN.html, client_DN.html, kts_dashboard.html, founder_panel.html, firebase-config.js, seed.html, firestore.rules, firebase.json, .firebaserc, CLAUDE.md, MARKETING.md, REFACTOR_PLAN.md.

## 2. Tài khoản test (mật khẩu Test@1234)
- founder: `founder.tranlong` (UID h4kEguPEyMcwJwl89stc0Q6j2si2) — "KTS. Trần Đại Long"
- kts: `kts.tranlong` (UID kw5TgVDggIfboEqERS1cAphn3263) — "KTS. Trần Đại Long"
- dn: `dn.tkhouse` (UID aTyHR3oQw6P87xpA9p8hTr2NbGA2) — "Công ty TK House"
- cn: `cn.trannam` (UID G4RhRH5ECMYcE9aFcKYVn5Wdy952) — "Trần Nam"
- Dự án thật để test: **ALN-9921** "Biệt thự Vườn Tân Cổ Điển", KTS Trần Đại Long, đang ở chặng C2.
- Quy ước: username + "@aln.vn" = email đăng nhập.

## 3. Quy trình làm việc
- **Plan B (chính, vì máy yếu 8.5GB hay crash):** Claude sửa file → người dùng tải file → ghi đè vào Documents\ALN → `git add/commit/push`. KHÔNG bắt máy xử lý nặng.
- **Claude Code:** đã cài (Pro, trannam052022@gmail.com). Quy trình: `cd Documents\ALN` → `git pull` → `claude` → giao việc → "commit và push". Lưu ý: Bun hay crash khi đọc file lớn → bảo nó "đừng đọc cả file, dùng grep/sed".
- **Firebase CLI:** đã cài + login (trannam052022@gmail.com) + `firebase init` xong. Deploy rules: `firebase deploy --only firestore:rules` (chạy ở PowerShell thật). Rules đổi phải DEPLOY mới có hiệu lực — push GitHub KHÔNG đủ.
- Mẹo máy yếu: đóng Chrome thừa/DevTools/Cowork, giữ RAM ~50%, làm từng việc nhỏ, commit sau mỗi việc. Crash → `git status` clean = không mất gì.

## 4. Đã hoàn thành
- Sửa 3 trang CN/DN/KTS (founder xem tất cả, listener, badge, progress+tab).
- Tạo index KTS; gom file rải rác về 1 master đồng bộ GitHub.
- Deploy Firestore rules cho fcmTokens + settings (hết lỗi vàng permission-denied).
- Chat "Nhắn tin qua sàn ALN" ghi/đọc THẬT Firestore (collection `messages`) — đã test OK.
- **client_CN: BỎ PIN** — modal phương án giờ là trình xem ảnh (ảnh + nút "Chốt/Duyệt" + gợi ý chat). md5 hiện tại: **dd6e0997**.
- **client_CN: sửa tên KTS ALN-9921** "Trần Lê Minh" → "Trần Đại Long" (30 chỗ). Các KTS giả định khác giữ nguyên.

## 5. Hướng sản phẩm đã chốt (quan trọng)
- **BỎ pin hoàn toàn.** Luồng: KTS gửi phương án bằng **ảnh jpg/png** → ảnh hiện → CN xem → **trao đổi qua "Nhắn tin qua sàn ALN" (chat thật) hoặc gọi điện** → chốt phương án → đi tiếp.
- Mọi trao đổi/góp ý dồn vào **chat thật** (không pin, không comment riêng).
- UI hiện vẫn chạy nhiều **dữ liệu mock** (REVIEW_DATA), giữ làm mẫu; chỉ chuyển sang Firestore thật theo từng tính năng. Người dùng OK "ít data nhưng đúng".

## 6. VIỆC TIẾP THEO (làm ở chat mới)
**Mảnh cuối để "phương án thật" chạy: flow KTS upload ảnh phương án.**
- Bên **kts_dashboard.html**: KTS chọn phương án → upload ảnh jpg/png → lưu Firebase **Storage** → ghi `imageURL` (+ name, desc, version, status) vào Firestore tại `projects/{pid}/stages/{C1-C4}/proposals/{autoId}`.
- Bên **client_CN.html**: modal ĐÃ sẵn sàng đọc `pa.imageURL` (nếu có → hiện ảnh; chưa có → placeholder). Sau khi có flow upload, cần cho thẻ + modal CN đọc proposals THẬT từ Firestore (thay REVIEW_DATA mock) để ảnh/tên/mô tả thật hiện ra.

## 7. Ghi chú kỹ thuật cần nhớ
- Schema thật (seed): `projects/{pid}/stages/{C1|C2|C3|C4}/proposals/{autoId}: {name,desc,version,folder,status,imagePath,imageURL,order,createdBy:{uid,name},createdAt}`. Comments: `stages/{sid}/comments`. (Pins đã bỏ.)
- Seed thật còn rất ít (1 proposal ở C2, imageURL trống) → UI thật sẽ nghèo cho tới khi có flow upload.
- **Scope:** `<script>` thường và `<script type="module">` TÁCH biệt. Hàm Firestore (addDoc, collection, serverTimestamp...) ở module; muốn script thường gọi thì đưa ra `window.*`.
- firebase-config.js export sẵn: addDoc, collection, serverTimestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, onSnapshot, storage, storageRef, uploadBytes, getDownloadURL... (KHÔNG có writeBatch/Timestamp).
- Dữ liệu thật lưu ở `window.PROJECTS_CLIENT` (mảng dự án từ Firestore); `p.kts` là chuỗi tên KTS.
- Sau mỗi sửa: `node --check` script module + kiểm `</head></body></html>` còn đủ + đối chiếu md5 live.
- REFACTOR_PLAN.md (trong repo) có lộ trình chi tiết mock→Firestore.

## 8. Việc tồn đọng khác (chưa gấp)
- Điều tra App Check → bỏ bypass founder → siết rules (users đang `if true`).
- Tài liệu (documents) client_CN đọc thật; lặp toàn bộ cho client_DN; dọn mock thừa + founder_panel.
- Cho phép gửi ảnh trong chat (Storage) — thay vai trò pin.
- Nút "duyệt chặng" ghi thật; trang register.html công khai (3 vai trò tự đăng ký).
- Dọn code pin chết còn lại trong client_CN; 2 cảnh báo vàng cosmetic (same-origin, meta PWA).
- Claude Code: chạy `/doctor` sửa auto-update (không gấp); có thể nâng lên 2.1.178.

## 9. File mới nhất
- client_CN.html: md5 **dd6e0997** (bỏ pin + tên KTS đúng). Chuỗi: 1ecbe5cf (gốc) → 6107ef93 (bỏ pin) → dd6e0997 (tên KTS).
- Cần push bản dd6e0997 lên GitHub nếu chưa.
