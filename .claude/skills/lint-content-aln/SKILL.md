---
name: lint-content-aln
description: Dùng BẮT BUỘC trước khi viết mới hoặc publish bất kỳ content công khai nào của ALN — bài Cẩm nang, trang tỉnh, trang mẫu nhà, trang chủ, bài đăng Facebook, content marketing. Kiểm tra câu chữ vi phạm định vị thương hiệu (ALN là Tổng thầu Thiết kế, không phải thi công, không "trung gian giữ tiền").
---

# Lint content ALN — kiểm định vị thương hiệu trước khi publish

## Khi nào dùng

- Trước khi viết bài Cẩm nang mới (`content/cam-nang/*.md`)
- Trước khi sửa/thêm trang công khai (index, home, trang tỉnh, trang mẫu, form đăng ký)
- Trước khi soạn caption Facebook, nội dung marketing
- Sau khi sinh trang hàng loạt bằng `gen-tinh.js` / `gen-mau.js` / `gen-dutoan.js`

## Quy trình

1. **Viết/sửa content xong → chạy lint:**
   ```bash
   node scripts/lint-content.js                       # toàn bộ content công khai
   node scripts/lint-content.js content/cam-nang/bai-moi.md   # file cụ thể
   ```
2. **ERROR → phải sửa hết** (exit code 1). Không commit/publish khi còn ERROR.
3. **WARN → review từng dòng theo ngữ cảnh:** cụm nhạy cảm nhưng có thể hợp lệ.
   Tiêu chí duy nhất: **cụm đó có đang gán cho ALN không?**
   - "giá xây nhà trọn gói tại TP.HCM khoảng 5,5–8 triệu/m²" → OK (nói giá thị trường)
   - keyword SEO `xây nhà trọn gói tphcm` trong frontmatter → OK (nhắm cụm tìm kiếm)
   - "ALN nhận xây nhà trọn gói" → VI PHẠM, phải sửa
4. Caption Facebook và nội dung không nằm trong file (chat, email) → tự đối chiếu
   bảng dưới bằng mắt, vì script chỉ quét file.

## Nguyên tắc định vị (nguồn: CLAUDE.md — không suy diễn)

**ALN là Tổng thầu THIẾT KẾ** — ký hợp đồng trực tiếp với khách hàng, chịu trách nhiệm
toàn bộ hợp đồng, KTS là CTV/nhà thầu phụ theo Quy trình 4 bước C1–C4.
Mảng thi công CHƯA được phép triển khai (chưa có chứng chỉ năng lực).

### Bảng cấm → thay thế

| ❌ Cấm | ✅ Thay bằng |
|--------|-------------|
| "ALN xây nhà trọn gói" | ALN chỉ nhận thiết kế; nếu nói giá thị trường thì ghi rõ là giá tham khảo thị trường |
| "ALN là nhà thầu / tổng thầu thi công" | "ALN là Tổng thầu Thiết kế"; phần thi công → **"đơn vị thi công đối tác"** |
| "giữ tiền trung gian" / "bên trung gian" / "giữ hộ tiền" | "ALN ký hợp đồng trực tiếp với khách hàng, thanh toán theo Quy trình 4 bước đảm bảo (C1–C4)" |

### Câu chuẩn (dùng nguyên văn khi giới thiệu ALN)

> "ALN là Tổng thầu Thiết kế — ký hợp đồng trực tiếp với khách hàng, trực tiếp chịu
> trách nhiệm toàn bộ dự án. Thanh toán theo Quy trình 4 bước đảm bảo (C1–C4)."

Bản rút gọn: *"Tổng thầu Thiết kế — hợp đồng trực tiếp, thanh toán theo Quy trình 4 bước đảm bảo."*

### Thuật ngữ theo đối tượng (không lẫn nhau)

| Nói với ai | Dùng cụm |
|-----------|----------|
| Khách hàng | "Quy trình 4 bước đảm bảo" |
| KTS | "Tiền đã có sẵn tại ALN chờ bạn" |
| Nội bộ | "Quỹ bảo đảm 4 bước" |

## Phạm vi script

Script quét file `.md`/`.html` trong: `content/`, `cam-nang/`, `thiet-ke-nha/`, `mau/`,
`du-toan/`, `features/`, `kts/`, `aln-giu-cho/` + các trang gốc công khai (index, home,
register, login, form apply) + 3 template sinh trang. Dashboard nội bộ
(founder_panel, client_*, kts_dashboard...) KHÔNG quét — ngôn ngữ vận hành nội bộ
không phải content công khai. Muốn thêm/bớt phạm vi: sửa `SCAN_DIRS` /
`SCAN_ROOT_FILES` trong `scripts/lint-content.js`.
