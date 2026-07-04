# ALN — Module Giữ chỗ & Phòng chờ

Thư mục **độc lập**, không đụng tới collection/trang nào của dự án ALN hiện tại.
Chỉ thêm 2 collection mới: `reservations` và (ghi tối thiểu vào) `users`.

```
aln-giu-cho/
├── giu-cho.html              ← Form giữ chỗ (3 ô: tên · SĐT · chọn phòng)
├── phong-cho.html            ← Phòng chờ (đăng nhập SĐT → dashboard khóa → nộp hồ sơ)
├── firebase-config.js        ← ⚠️ DÁN KEY FIREBASE THẬT CỦA BẠN VÀO ĐÂY
├── manifest.webmanifest      ← Cấu hình PWA (icon, mở ra vào phòng chờ)
├── sw.js                     ← Service worker (để cài được icon lên màn hình)
├── icons/                    ← Icon ALN (192 / 512 / maskable / apple-touch)
└── README.md
```

---

## 1. Cài đặt (3 bước)

**Bước 1 — Dán cấu hình Firebase.**
Mở `firebase-config.js`, thay block `firebaseConfig` bằng đúng thông tin từ file
`firebase-config.js` đang chạy trong dự án ALN (cùng 1 project → dữ liệu dùng chung).

**Bước 2 — Đưa lên Firebase Hosting.**
Copy cả thư mục `aln-giu-cho/` vào thư mục public của bạn (vd `public/aln-giu-cho/`), rồi:
```bash
firebase deploy --only hosting
```
Truy cập: `https://applamnha.vn/aln-giu-cho/giu-cho.html`

**Bước 3 — Bật các dịch vụ Firebase cần dùng** (nếu chưa):
- **Authentication** → bật **Email/Password**.
- **Firestore** + **Storage** → áp Security Rules ở mục 3 bên dưới.

---

## 2. Luồng hoạt động

```
QUẢNG CÁO → giu-cho.html (giữ chỗ 30s) → cài PWA về máy
                                              │
        bấm icon ALN  ───────────────────────┘
                │
                ▼
        phong-cho.html ── đăng nhập SĐT ──► PHÒNG CHỜ (khóa)
                                              │ đếm ngược 3 ngày
                                              │ [Nộp hồ sơ] → theo phòng:
                                              │   • KTS/Designer: portfolio / 3 dự án
                                              │   • Doanh nghiệp: GPKD · MST · quy mô Studio
                                              ▼
                                         ALN duyệt → ĐẠT → mở khóa
```

**Đăng nhập = SĐT.** Mật khẩu tự gán = chính SĐT đó. Người dùng không phải nhớ gì.

**Cờ điều khiển khóa/mở:** `profileSubmitted` (false = phòng chờ khóa, true = đã nộp → đang duyệt).

---

## 3. ⚠️ Security Rules (BẮT BUỘC — bảo mật nằm ở đây, không ở link)

Vì giai đoạn giữ chỗ dùng "mật khẩu = SĐT", phải đảm bảo **mỗi người chỉ đọc/ghi
được bản ghi của chính mình**. Dán vào **Firestore Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // mỗi user chỉ thao tác trên hồ sơ của chính mình
    match /reservations/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // 👉 Thêm quyền admin để duyệt hồ sơ (tùy hệ thống của bạn):
    // allow read, write: if isAdmin();
  }
}
```

**Storage Rules** (file hồ sơ chỉ chủ nhân được tải lên/đọc):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /reservations/{uid}/{file=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 4. 🔴 Việc PHẢI làm khi lên "Tầng 2" (hồ sơ thật, có ví tiền/uy tín)

Mật khẩu = SĐT **chỉ chấp nhận được ở giai đoạn giữ chỗ** (dữ liệu chưa nhạy cảm).
Khi user được duyệt và vào không gian thật (có ví, điểm uy tín như dashboard chính),
**bắt buộc yêu cầu họ đặt mật khẩu riêng** (hoặc bật OTP). Đừng để mật khẩu = SĐT ở
giai đoạn có tiền — ai biết SĐT cũng đăng nhập được.

Chỗ nối: hàm `goWorkspace()` trong `phong-cho.html` — thêm bước "đặt mật khẩu mới"
trước khi dẫn sang workspace thật.

---

## 5. Gắn vào bài tuyển dụng

Cuối bài đăng tuyển KTS/Designer/DN, CTA trỏ về:
```
👉 Giữ chỗ khu vực của bạn: https://applamnha.vn/aln-giu-cho/giu-cho.html
```

---

## 6. Tùy chỉnh nhanh

| Muốn đổi | Sửa ở |
|---|---|
| Số ngày giữ chỗ (mặc định 3) | `giu-cho.html` → `RESERVE_DAYS` |
| Đường dẫn workspace sau khi đạt | `phong-cho.html` → hàm `goWorkspace()` |
| Tên hiển thị dưới icon | `manifest.webmanifest` → `short_name` (đang để "ALN") |
| Trang mở ra khi bấm icon | `manifest.webmanifest` → `start_url` (đang là phong-cho.html) |

> Phần **nhắc tự động** (bắn thông báo 🔔 khi +1 ngày / sắp hết hạn) cần Cloud
> Functions đọc `reservations` lọc `profileSubmitted == false` — làm sau, mình hỗ trợ khi bạn cần.
