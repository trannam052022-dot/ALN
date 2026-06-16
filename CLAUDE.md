# CLAUDE.md — Dự án ALN (App Làm Nhà)

> File này giúp Claude Code tự nạp context mỗi phiên. Đặt ở thư mục gốc repo: `C:\Users\HP\Documents\ALN\CLAUDE.md`

## Tổng quan

Nền tảng theo dõi công trình xây dựng. **Frontend tĩnh** (HTML/JS thuần) host trên **GitHub Pages**, **backend Firebase** (Auth + Firestore + Storage + FCM).

- GitHub repo: `https://github.com/trannam052022-dot/ALN` (public)
- GitHub Pages: `https://trannam052022-dot.github.io/ALN/`
- Firebase project: `aln-platform` (gói Blaze), region `asia-southeast1`, SDK **10.12.0** (giữ đồng bộ version ở mọi nơi import)

## Cấu trúc file

| File | Vai trò |
|------|--------|
| `login.html` | Đăng nhập (ghép `username + "@aln.vn"` = email ảo) |
| `client_CN.html` | Trang Chủ nhà (CN) |
| `client_DN.html` | Trang Doanh nghiệp (DN) |
| `kts_dashboard.html` | Trang Kiến trúc sư (KTS) |
| `founder_panel.html` | Trang quản trị founder (xem/giám sát mọi vai) |
| `seed.html` | Nạp dữ liệu mẫu lên Firestore |
| `firebase-config.js` | Khởi tạo Firebase + export hàm dùng chung |
| `firebase-messaging-sw.js` | Service worker cho web push |
| `index.html`, `manifest.json`, `icon-*.png` | PWA |

## firebase-config.js — exports

CÓ export: `app, auth, db, usernameToEmail, signIn/createUser, onAuthStateChanged, signOut, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, orderBy, limit, limitToLast, onSnapshot, serverTimestamp, storage, storageRef, uploadBytes, getDownloadURL`.

**KHÔNG export** `writeBatch` / `Timestamp` → nếu cần (như trong `seed.html`) phải import trực tiếp từ cùng version SDK 10.12.0.

Quy ước: `username + "@aln.vn"` = email đăng nhập (email ảo).

## 4 tài khoản thật (Auth + Firestore `users/{uid}`)

Mật khẩu chung: `Test@1234`

| Vai | Username | UID | name |
|-----|----------|-----|------|
| founder | `founder.tranlong` | `h4kEguPEyMcwJwl89stc0Q6j2si2` | KTS. Trần Đại Long |
| kts | `kts.tranlong` | `kw5TgVDggIfboEqERS1cAphn3263` | (giống founder) |
| dn | `dn.tkhouse` | `aTyHR3oQw6P87xpA9p8hTr2NbGA2` | Công ty TK House |
| cn | `cn.trannam` | `G4RhRH5ECMYcE9aFcKYVn5Wdy952` | Trần Nam |

Mỗi `users/{uid}` có: `username, name, role, email`.

## Dữ liệu mẫu

`projects/ALN-9921` "Biệt thự Vườn Tân Cổ Điển" (stage C2, sla_warn, totalFee 125tr, escrow 75tr, progress C1=1/C2=0.4/C3=0/C4=0) + 4 stages + 3 documents + 1 proposal + 1 pin + 1 comment. `cn.uid` = UID của cn.trannam, `kts.uid` = UID của kts.

## Quy ước làm việc (QUAN TRỌNG)

1. **GOM TẤT CẢ LỖI ĐỂ SỬA MỘT LẦN**: audit toàn bộ trước (`node --check` phần script, grep tìm hàm/biến thiếu), sửa một lần, không vá lẻ tẻ.
2. **Khi sửa nhiều: LUÔN làm lại từ bản gốc**, tránh chồng sửa lên file đã chỉnh (dễ hỏng scope/cấu trúc).
3. **Hai scope tách biệt trong mỗi trang**:
   - `<script>` thường: KHÔNG được dùng optional chaining `?.` hay object shorthand → gây SyntaxError. Các hàm UI (`renderSidebar/renderMain/selectProj`) định nghĩa ở đây.
   - `<script type="module">`: chứa Firestore listener; được dùng cú pháp hiện đại.
   - Để module gọi hàm UI, phải đưa ra `window.*`. Khai báo sớm các biến `window.PROJECTS_CLIENT/activeProj/...` trong `<head>`. Guard mảng rỗng lúc init (`PROJECTS_CLIENT[0]?.id`).
4. Sau mỗi sửa: `node --check` phần module + kiểm tra còn đủ `</head></body></html>`.

## Query theo trang

- `client_CN.html`: `where('cn.uid','==',uid) orderBy('updatedAt','desc')` — **trừ founder thì bỏ where, lấy tất cả** (đã sửa, xem bên dưới).
- `kts_dashboard.html`: `where('kts.uid','==',uid) orderBy('updatedAt','desc')` — **CẦN INDEX**.
- `client_DN.html`: `orderBy('updatedAt','desc')` (không where → mọi dự án).
- `founder_panel.html`: `orderBy('updatedAt')` → DN_PROJECTS + renderStats/renderTable.

## Firestore Rules & App Check

- `users` allow read = `if true` (mở tạm để debug).
- `isFounder()` dùng UID cứng `h4kEguPEyMcwJwl89stc0Q6j2si2` (tránh get() lồng nhau).
- founder bypass uploader/author check ở documents/pins/comments/proposals.
- **Nghi App Check chặn** `getDoc(users/{uid})` (trả exists:false dù UID đúng). GIẢI PHÁP TẠM: bypass Firestore cho founder UID cứng trong `login.html` + 4 dashboard (mock snap `role:founder`). → Cần điều tra gốc rễ App Check rồi bỏ bypass, siết Rules lại.

## Indexes

- `projects`: `cn.uid` ASC + `updatedAt` DESC — **Enabled**.
- `projects`: `kts.uid` ASC + `updatedAt` DESC — **CHƯA TẠO (pending)** → trang KTS lỗi `failed-precondition`. Tạo qua link trong console lỗi hoặc Firebase Console → Firestore → Indexes.
- DN + founder dùng `orderBy('updatedAt')` không where → không cần index.

## ĐÃ SỬA (phiên 15/06/2026)

- **client_CN.html**: `_startProjectsListen(uid, isFounder)` — nếu là founder thì query bỏ `where('cn.uid'==uid)` → founder xem được TẤT CẢ dự án. Call site truyền cờ `isFounder = (uid === UID founder)`.
- **client_DN.html**:
  - Thêm `_startProjectsListenDN()` vào cuối luồng `onAuthStateChanged` (trước đó nó bị nhét nhầm trong callback xin quyền thông báo → list dự án không bao giờ nạp).
  - Badge thương hiệu trên cùng `dnTopbarName` không còn bị ghi đè bằng tên user → luôn hiện "App Làm Nhà Corp." (giống các trang khác). Thẻ sidebar `dnSidebarName` vẫn theo user.

## CÒN LẠI (thứ tự ưu tiên)

1. **Tạo index KTS** (`kts.uid` ASC + `updatedAt` DESC) → mở khóa trang KTS. Sau đó test `kts.tranlong`.
2. Mở Rules cho `fcmTokens`/`settings` (lỗi vàng `[ALN Push] permission-denied` — vô hại, không ảnh hưởng hiển thị).
3. Điều tra gốc rễ App Check → bỏ bypass founder → siết Rules lại.
4. Test upload avatar KTS (Firebase Storage).
5. **Bước 3**: nối các nút GHI — upload tài liệu, gửi góp ý/pin, duyệt chặng.
6. (Sau) `register.html` đăng ký công khai: 3 vai tự đăng ký, OTP điện thoại (GĐ2), KTS/DN chờ founder duyệt (pending), CN dùng ngay. Username tự sinh từ tên bỏ dấu + số chống trùng, không lộ sđt. Dùng secondary Firebase app để founder tạo user không bị đá ra.

## Lệnh Git thường dùng

```bash
git add -A
git commit -m "mô tả thay đổi"
git push
```
GitHub Pages tự build lại sau ~1-2 phút. Kiểm tra ở tab ẩn danh hoặc Ctrl+Shift+R (tránh cache).
