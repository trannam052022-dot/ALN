# ALN — Spec: Kỹ sư + Ma trận ký + Pipeline PDF + Khung bản vẽ
> Lưu để cập nhật sau. Chưa implement — chờ Founder duyệt.

---

## 1. VAI TRÒ KỸ SƯ TRONG HỆ THỐNG ALN

### 1.1 ALN là Tổng thầu thiết kế có pháp nhân
- ALN Corp. ký hợp đồng trực tiếp với CN/DN
- KTS và KS là thầu phụ của ALN
- ALN đóng dấu pháp nhân lên toàn bộ hồ sơ
- Giám đốc ALN: **Lý Mỹ Linh**

### 1.2 Hai loại KS trong hệ thống

| Loại | Mô tả | Rating |
|------|-------|--------|
| KS ALN | Thành viên chính thức, verify đầy đủ | Có |
| KS Cộng tác | Do KTS đề xuất, ALN verify giấy tờ | Không |

### 1.3 Giấy tờ verify bắt buộc (cả 2 loại)
- Bằng kỹ sư xây dựng / kết cấu / M&E
- Chứng chỉ hành nghề còn hiệu lực
- Đăng ký hành nghề đúng chuyên ngành

### 1.4 Tự động block khi chứng chỉ hết hạn
```js
// Cloud Function — chạy mỗi ngày
exports.checkCertExpiry = onSchedule("every 24 hours", async () => {
  const expired = await getDocs(query(
    collection(db, "users"),
    where("role", "in", ["KTS", "KS"]),
    where("certExpiry", "<", Timestamp.now())
  ));
  for (const doc of expired.docs) {
    await updateDoc(doc.ref, {
      certValid: false,
      canSign: false
    });
    // Gửi thông báo cho KS/KTS
  }
});
```

### 1.5 Thù lao KS từ phần C3

| Chuyên ngành | % từ giá trị C3 |
|-------------|----------------|
| Kết cấu | 15–20% |
| M&E (điện nước PCCC) | 10–15% |
| Dự toán | 8–10% |
| KS toàn phần (ký tất cả) | 25–30% |

---

## 2. MA TRẬN KÝ BẢN VẼ

Theo Nghị định 15/2021/NĐ-CP và Thông tư 06/2021/TT-BXD.

Hệ thống tự xác định ma trận ký dựa vào **folder** file được upload vào.

### 2.1 Bảng ma trận

| Loại bản vẽ | Mã | KTS | KS KC | KS M&E | KS DT | Chủ nhiệm |
|------------|-----|-----|-------|--------|-------|-----------|
| Tổng mặt bằng | KT-01 | ✓ | — | — | — | ✓ |
| Mặt bằng các tầng | KT-02..N | ✓ | — | — | — | ✓ |
| Mặt đứng · Mặt cắt | KT-MD/MC | ✓ | — | — | — | ✓ |
| Chi tiết kiến trúc | KT-CT | ✓ | — | — | — | ✓ |
| Mặt bằng móng | KC-01 | — | ✓ | — | — | ✓ |
| Mặt bằng kết cấu sàn | KC-02..N | — | ✓ | — | — | ✓ |
| Chi tiết cột dầm thang | KC-CT | — | ✓ | — | — | ✓ |
| Thống kê thép | KC-TK | — | ✓ | — | T | ✓ |
| Sơ đồ điện tổng | ME-D01 | — | — | ✓ | — | ✓ |
| Mặt bằng điện các tầng | ME-D02..N | — | — | ✓ | — | ✓ |
| Cấp thoát nước | ME-N01 | — | — | ✓ | — | ✓ |
| PCCC | ME-P01 | — | — | ✓ | — | ✓ |
| Dự toán chi phí | DT-01 | — | — | — | ✓ | ✓ |
| Thống kê vật tư | DT-VT | — | T | T | ✓ | ✓ |
| Hồ sơ nghiệm thu hoàn công | HC-01 | ✓ | ✓ | ✓ | ✓ | ✓ |

T = Tùy chọn

### 2.2 Logic xuất hồ sơ
- Mỗi file bị **lock** cho đến khi đủ chữ ký theo ma trận
- Không thể download hay gửi cho DN/CN khi còn thiếu ký
- **Chủ nhiệm luôn ký sau cùng** — hệ thống tự lock ô này
- Khi đủ ký → ALN tạo Signed URL 15 phút kèm watermark

```js
// Kiểm tra đủ ký trước khi xuất
async function checkSigningComplete(drawingId) {
  const drawing = await getDoc(doc(db, "drawings", drawingId));
  const { signingMatrix, signatures } = drawing.data();

  const required = signingMatrix.filter(r => r.required);
  const signed = required.filter(r => signatures[r.role]);

  if (signed.length < required.length) {
    const missing = required.filter(r => !signatures[r.role]);
    return { complete: false, missing };
  }
  return { complete: true };
}
```

### 2.3 Hai loại trang trong hồ sơ

**Trang bản vẽ kỹ thuật:**
- Có số hiệu (KC-01, ME-D01...)
- Dùng khung bản vẽ đầy đủ
- Có ô ký theo ma trận bộ môn

**Trang thuyết minh:**
- Không có số hiệu bản vẽ
- Đánh số trang liên tục trong toàn bộ hồ sơ
- Dùng khung tên đơn giản hơn

Khi upload, bộ môn chọn:
```
Loại tài liệu:
● Bản vẽ kỹ thuật  →  hiện ô Số hiệu
○ Thuyết minh      →  không cần số hiệu
○ Bảng thống kê    →  không cần số hiệu
```

### 2.4 Đặt tên file theo quy ước
```
KC-01_MB-mong.pdf
KC-02_MB-san-tang2.pdf
ME-D01_So-do-dien-tong.pdf
TM-KC_Thuyet-minh-ket-cau.pdf   ← thuyết minh
```

Hệ thống tự parse tên file → lấy số hiệu và bộ môn.
Nếu không parse được → hiện form để bộ môn xác nhận.

---

## 3. PIPELINE PDF — PHƯƠNG ÁN B

KTS/KS upload PDF bất kỳ → ALN xử lý → Ký số → Xuất hoàn chỉnh.

### 3.1 Cloud Function xử lý khi upload

```js
exports.processDrawingUpload = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  const folder = detectFolder(filePath);
  const signingMatrix = MATRIX[folder];

  // 1. Tải PDF gốc
  const pdfBytes = await downloadFromStorage(filePath);

  // 2. Chèn khung chuẩn ALN vào cột phải 55mm
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    await insertTitleBlock(page, {
      projectId: metadata.projectId,
      projectName: metadata.projectName,
      clientName: metadata.clientName,
      drawingCode: generateDrawingCode(folder, index),
      drawingName: parseDrawingName(filePath),
      scale: metadata.scale,
      date: new Date().toLocaleDateString('vi-VN'),
      rev: metadata.revision || '01',
      pageNum: index + 1,
      totalPages: pages.length,
      signingMatrix,
      directorName: 'Lý Mỹ Linh'
    });
  }

  // 3. Lưu PDF đã có khung
  const processedPdf = await pdfDoc.save();
  await uploadToStorage(`processed/${filePath}`, processedPdf);

  // 4. Ghi vào Firestore
  await setDoc(doc(db, 'drawings', drawingId), {
    projectId: metadata.projectId,
    folder,
    signingMatrix,
    signatures: {},
    status: 'pending_signatures',
    uploadedAt: serverTimestamp()
  });
});
```

### 3.2 Chữ ký số — từ profile người dùng

Lúc onboarding, KTS/KS ký tên trên thiết bị → lưu vào profile:
```js
// users/{userId}
{
  signatureImage: "base64_png_transparent...",  // chữ ký tay
  signatureUpdatedAt: Timestamp,
  certNumber: "KTS-2021-04512",
  certExpiry: Timestamp,
  certValid: true,
  canSign: true
}
```

Lúc ký bản vẽ:
```js
async function signDrawing(drawingId, userId, role) {
  // Lấy chữ ký từ profile
  const user = await getDoc(doc(db, "users", userId));
  const { signatureImage, canSign, certValid } = user.data();

  if (!canSign || !certValid) throw new Error("Chứng chỉ hết hạn");

  // Chèn chữ ký vào đúng ô trong PDF
  await embedSignatureIntoPdf(drawingId, role, signatureImage);

  // Ghi vào Firestore
  await updateDoc(doc(db, "drawings", drawingId), {
    [`signatures.${role}`]: {
      userId,
      signedAt: serverTimestamp(),
      ipAddress: context.rawRequest.ip
    }
  });

  // Tính hash PDF sau khi ký
  const hash = await computePdfHash(drawingId);
  await updateDoc(doc(db, "drawings", drawingId), { hash });

  // Kiểm tra đủ ký chưa
  const { complete } = await checkSigningComplete(drawingId);
  if (complete) await generateSignedUrl(drawingId);
}
```

### 3.3 Watermark trên mỗi trang
```
ALN · ALN-1042 · Ký ngày 10/06/2026 · Hash: A3F2B9C1
```

### 3.4 Trường nào tự động, trường nào bộ môn điền

| Trường | Nguồn | Ai điền |
|--------|-------|---------|
| Logo ALN | Static | Tự động |
| Tổng thầu thiết kế | Static | Tự động |
| Giám đốc · Lý Mỹ Linh | Config | Tự động |
| Chủ đầu tư | projects/{id}.clientName | Tự động |
| Công trình | projects/{id}.projectName + address | Tự động |
| Tên bản vẽ | Parse từ tên file | Tự động (hoặc confirm) |
| Số hiệu | Parse từ tên file | Tự động (hoặc confirm) |
| Tỷ lệ | Bộ môn chọn khi upload | Bộ môn (dropdown) |
| Rev. | Tự tăng mỗi lần upload lại | Tự động |
| Ngày | serverTimestamp() lúc upload | Tự động |
| Tên người ký + ngày ký | users/{id} + serverTimestamp() | Tự động khi ký |
| Mã dự án | projects/{id}.alnCode | Tự động |
| Tờ số / Tổng tờ | Đếm theo batch upload | Tự động |
| Hash | SHA-256 sau khi đủ ký | Tự động |

---

## 4. KHUNG BẢN VẼ ALN CHUẨN

### 4.1 Kích thước — Khổ A3

```
Tờ giấy A3:          420 × 297mm
Lề an toàn in:       5mm đều 4 phía
Khung bản vẽ thật:   410 × 287mm
Lề đóng quyển:       16mm từ biên khung (nét đứt trái)
Cột khung tên:       55mm từ biên phải (nét đứt phải đến biên)
Vùng vẽ:             329 × 287mm
```

### 4.2 Cột khung tên — thứ tự từ trên xuống

```
1. Ô ALN + Tổng thầu
   - Dòng 1: TỔNG THẦU THIẾT KẾ (chữ nhỏ, vàng nhạt)
   - Dòng 2: ALN (chữ to, màu vàng gold gradient)
   - Dòng 3: App Làm Nhà Corp. (chữ nhỏ)
   - Tất cả căn giữa ô

2. Ô Giám đốc (cùng chiều cao với ô Chủ đầu tư)
   - Label: GIÁM ĐỐC (chữ nhỏ sát góc trên trái)
   - Tên: Lý Mỹ Linh
   - Vùng ký dưới
   - Ngày: ___/___/______

3. Ô Chủ đầu tư (cùng chiều cao với ô Giám đốc)
   - Label: CHỦ ĐẦU TƯ (chữ nhỏ sát góc trên trái)
   - Tên chủ đầu tư: viết hoa, căn giữa ô
   - Loại hình DN: sát đáy ô

4. Ô Công trình
   - Label: CÔNG TRÌNH (sát góc trên trái)
   - Tên công trình: viết hoa, căn giữa ô
   - Địa chỉ: sát đáy ô

5. Ô Tên bản vẽ
   - Label: TÊN BẢN VẼ (sát góc trên trái)
   - Tên: viết hoa, căn giữa ô

6. Grid 2×2: Số hiệu | Tỷ lệ / Rev. | Ngày
   - Label sát góc trên trái mỗi ô
   - Giá trị bên dưới label

7. Ô ký KTS
   - Header: KIẾN TRÚC SƯ (trái) · Tên KTS (phải)
   - Vùng ký + ngày ký

8. Ô ký KS Kết cấu
   - Header: KS. KẾT CẤU (trái) · Tên KS (phải)
   - Vùng ký + ngày ký

9. Ô ký KS M&E
   - Header: KS. M&E (trái) · Tên KS (phải)
   - Vùng ký + ngày ký

10. Ô ký Chủ nhiệm đồ án
    - Dòng trên: CHỦ NHIỆM ĐỒ ÁN
    - Dòng dưới: Tên KTS
    - Vùng ký + ngày ký
    - Lock cho đến khi đủ bộ môn ký

11. Footer 1 hàng ngang: Mã dự án | Tờ số
```

### 4.3 Màu sắc khung tên

```css
/* Nền ô ALN */
background: #f5f0e0;

/* Chữ ALN — gradient vàng gold */
background: linear-gradient(135deg, #b8860b, #d4a017, #f0c040, #c9a84c);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;

/* Label nhỏ vàng nâu */
color: #7a5c10;

/* Ô Chủ đầu tư */
background: #fafaf7;

/* Đường viền vàng */
border-color: #c9a84c;

/* Vùng ký Giám đốc */
border: 0.5px dashed #c9a84c;
background: #fffdf5;
```

### 4.4 Font
```
Logo ALN:  Syne 800 — font-size 16px (trên bản vẽ thật ~6mm)
Label nhỏ: DM Sans 700 — 4.5px — uppercase — letter-spacing .12em
Giá trị:   DM Sans 700 — 7px — uppercase
Chữ phụ:   DM Sans 400 — 4.5px — sát đáy ô
```

### 4.5 Nét vẽ
```
Khung ngoài:        1.5px solid #2a2a2a
Đường nét đứt trái: 1px dashed #777  (lề 16mm)
Đường nét đứt phải: 1px dashed #777  (cột khung tên 55mm)
Đường ngăn ô:       1px solid #aaa
Grid trong ô:       0.5px solid #ddd
Đường viền vàng GĐ: 0.5px solid #c9a84c55
Ô ALN viền dưới:    1.5px solid #2a2a2a
```

---

## 5. THƯ VIỆN KỸ THUẬT

### 5.1 PDF processing
```
pdf-lib          ← chèn khung, chữ ký, watermark vào PDF
@pdf-lib/fontkit ← nhúng font tùy chỉnh
sharp            ← xử lý chữ ký image (resize, optimize)
crypto           ← tính SHA-256 hash
```

### 5.2 Storage structure
```
/drawings/
  original/{projectId}/{drawingId}.pdf     ← file gốc
  processed/{projectId}/{drawingId}.pdf    ← đã có khung
  signed/{projectId}/{drawingId}.pdf       ← đã đủ chữ ký
  signatures/{userId}/signature.png        ← chữ ký cá nhân
```

### 5.3 Firestore collections
```
/drawings/{drawingId}
  projectId, folder, drawingCode, drawingName
  scale, rev, uploadedAt, uploadedBy
  signingMatrix: [{role, required}]
  signatures: {kts: {userId, signedAt}, ks_kc: {...}}
  status: pending_signatures | complete
  hash: string
  signedUrl: string (15 phút)
  signedUrlExpiry: Timestamp

/signatureLogs/{logId}
  drawingId, userId, role
  signedAt, ipAddress, deviceId
  pdfHashBefore, pdfHashAfter
```

---

## 6. THỨ TỰ IMPLEMENT

```
Bước 1: Onboarding KS — form khai chuyên ngành + CCHN
Bước 2: Cloud Function checkCertExpiry — tự block khi hết hạn
Bước 3: Upload chữ ký cá nhân vào profile
Bước 4: Cloud Function processDrawingUpload — chèn khung vào PDF
Bước 5: Màn hình upload bản vẽ cho KTS/KS
         — chọn loại tài liệu (bản vẽ / thuyết minh)
         — xác nhận số hiệu và tỷ lệ
Bước 6: Flow ký số theo ma trận
Bước 7: Tự động tạo Signed URL khi đủ ký
Bước 8: Màn hình xem hồ sơ cho DN/CN
```

---

## 7. LƯU Ý QUAN TRỌNG

- Khung bản vẽ ALN cung cấp dưới dạng **template DWG + PDF**
- Bộ môn vẽ nội dung vào **vùng vẽ 329×287mm**, không động vào cột phải
- Khi upload, hệ thống chèn khung tên vào vị trí cố định (cột phải 55mm)
- **Chủ nhiệm luôn ký sau cùng** — hệ thống tự enforce
- **Giám đốc ALN (Lý Mỹ Linh) ký bằng con dấu vật lý** — không ký số
- Hồ sơ nghiệm thu hoàn công (HC-01) yêu cầu đủ 5 bộ môn + Giám đốc

---

*Spec này chưa implement. Lưu để cập nhật và bổ sung trước khi đưa cho Claude Code.*

---

## 8. FONT CHUẨN HỒ SƠ KỸ THUẬT ALN

### 8.1 Font duy nhất — Oswald
Toàn bộ chữ trong bản vẽ kỹ thuật và khung tên dùng **Oswald** (Google Fonts).
Không dùng font khác trong hồ sơ kỹ thuật.

```
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap');
```

Riêng logo **ALN** trong khung tên vẫn dùng **Syne 800** — đây là nhận diện thương hiệu,
không phải nội dung kỹ thuật.

### 8.2 Bảng cỡ chữ chuẩn

| Dùng cho | Cỡ chữ | Weight | Kiểu |
|----------|--------|--------|------|
| Tiêu đề bản vẽ lớn | 5mm | 700 Bold | Hoa |
| Tên phòng / khu vực | 3.5mm | 500 Medium | Hoa |
| Ghi chú chung | 2.5mm | 400 Regular | Thường |
| Dim kích thước | 2mm | 400 Regular | Thường |
| Chú thích nhỏ | 1.8mm | 300 Light | Thường |
| Khung tên — tên BV | 3.5mm | 600 SemiBold | Hoa |
| Khung tên — label nhỏ | 1.5mm | 600 SemiBold | Hoa |
| Khung tên — giá trị | 2mm | 500 Medium | Hoa |
| Khung tên — chữ phụ | 1.5mm | 300 Light | Hoa |

### 8.3 Quy tắc chữ
- **Hoa hoàn toàn** — tiêu đề, khung tên, tên phòng, dim
- **Thường** — ghi chú dài, thuyết minh
- **Màu chữ** — đen #000000 toàn bộ, không dùng màu khác
- **Letter-spacing** — 0.06em cho label, 0.04em cho giá trị

### 8.4 Nhúng font khi xuất PDF
```js
// Bắt buộc nhúng font vào PDF để in không bị lỗi
const oswaldBytes = await fetch('/fonts/Oswald-Regular.ttf')
  .then(r => r.arrayBuffer());
const oswaldFont = await pdfDoc.embedFont(oswaldBytes);
// Tương tự cho Bold, Medium, Light
```

### 8.5 Xuất 2 version
```
Bản màn hình:  màu vàng gold ALN, nền ô vàng nhạt
Bản in:        tất cả về đen trắng, không gradient
               logo ALN → đen
               nền ô giám đốc → trắng
```

