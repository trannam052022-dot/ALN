#!/usr/bin/env node
/**
 * gen-dutoan.js — Sinh trang tool "Dự toán xây nhà 60 giây" (Trụ 2 — programmatic SEO)
 *
 * Cách chạy (từ gốc repo): node tools/gen-dutoan.js
 *
 * Đọc data/don-gia.json + data/tinh.json + data/mau-nha.json + tools/template-dutoan.html
 * → sinh:
 *  - du-toan/index.html                trang chính (không khoá sẵn khu vực)
 *  - du-toan/xay-nha-tai-{tinh}.html    1 trang / tỉnh trong data/tinh.json
 *
 * Sửa đơn giá: sửa data/don-gia.json → chạy lại file này (KHÔNG sửa số trong
 * template hay script — mọi số đều đọc từ JSON tại thời điểm build).
 * Thêm tỉnh mới: thêm object vào data/tinh.json → chạy lại file này.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_FILE = path.join(__dirname, 'template-dutoan.html');
const OUT_DIR = path.join(ROOT, 'du-toan');
const BASE_URL = 'https://applamnha.vn';
const NAM = 2026;

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loadData() {
  const donGia = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'don-gia.json'), 'utf8'));
  const tinhData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tinh.json'), 'utf8'));
  const mauData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mau-nha.json'), 'utf8'));
  return { donGia, tinhList: tinhData.tinh, mauList: mauData.mau };
}

function tinhOptionsHtml(tinhList) {
  return tinhList.map((t) => (
    '          <option value="' + t.slug + '">' + escHtml(t.ten) + '</option>'
  )).join('\n');
}

/* Chỉ nhúng field cần cho tính toán client-side — KHÔNG nhúng moTa dài của
   từng mẫu vào script (giữ trang nhẹ, mô tả đầy đủ đã có ở trang mau/). */
function slimMauList(mauList) {
  return mauList.map((m) => ({
    slug: m.slug, ten: m.ten, loai: m.loai,
    dienTichSan: m.dienTichSan, giaBanMau: m.giaBanMau,
  }));
}
/* Chỉ nhúng field cần cho tính toán client-side từ tinh.json — KHÔNG nhúng
   gioiThieu dài (đã render sẵn thành HTML tĩnh riêng cho mỗi trang tỉnh). */
function slimTinhList(tinhList) {
  return tinhList.map((t) => ({ slug: t.slug, ten: t.ten, heSoVungKey: t.heSoVungKey }));
}

function jsonLdWebApp(name, url, description) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url,
    description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any (web)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
  }, null, 2);
}
function jsonLdFaq(faqs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }, null, 2);
}

function faqMain() {
  return [
    {
      q: 'Dự toán 60 giây này có chính xác không?',
      a: 'Đây là con số ước tính tham khảo theo đơn giá thị trường, dùng để bạn hình dung nhanh khoảng chi phí trước khi lên kế hoạch. Dự toán chính xác cần kiến trúc sư khảo sát thực tế lô đất, nền đất và nhu cầu cụ thể của gia đình.',
    },
    {
      q: 'Chi phí xây nhà gồm những khoản nào?',
      a: 'Ba khoản chính: phần thô (móng, khung, tường, mái — chiếm khoảng 60%), hoàn thiện (sơn, ốp lát, cửa, thiết bị vệ sinh — khoảng 30%) và dự phòng phát sinh (khoảng 10%). Chi phí thiết kế và nội thất rời thường tính riêng.',
    },
    {
      q: 'Làm sao nhận báo giá chi tiết hơn?',
      a: 'Sau khi xem kết quả tạm tính, bạn có thể để lại tên và số điện thoại để nhận bảng dự toán chi tiết cùng tư vấn miễn phí từ kiến trúc sư khu vực ALN.',
    },
  ];
}
function faqTinh(tenTinh) {
  return [
    {
      q: 'Dự toán xây nhà tại ' + tenTinh + ' có chính xác không?',
      a: 'Đây là con số ước tính tham khảo theo đơn giá thị trường chung của khu vực ' + tenTinh + ', dùng để hình dung nhanh khoảng chi phí. Dự toán chính xác cần kiến trúc sư khảo sát thực tế lô đất tại ' + tenTinh + '.',
    },
    {
      q: 'Chi phí xây nhà tại ' + tenTinh + ' gồm những khoản nào?',
      a: 'Ba khoản chính: phần thô (khoảng 60%), hoàn thiện (khoảng 30%) và dự phòng phát sinh (khoảng 10%). Đơn giá có thể chênh lệch theo đặc điểm nền đất và giá nhân công tại ' + tenTinh + ' so với khu vực khác.',
    },
    {
      q: 'Làm sao nhận báo giá chi tiết hơn tại ' + tenTinh + '?',
      a: 'Sau khi xem kết quả tạm tính, bạn có thể để lại tên và số điện thoại để nhận bảng dự toán chi tiết cùng tư vấn miễn phí từ kiến trúc sư khu vực ALN tại ' + tenTinh + '.',
    },
  ];
}

function breadcrumbHtml(items) {
  // items: [{label, href?}] — item cuối không có href (trang hiện tại)
  return items.map((it, i) => {
    const isLast = i === items.length - 1;
    const sep = i > 0 ? '<span class="sep">›</span>\n        ' : '';
    if (isLast) return '        ' + sep + '<span class="cur">' + escHtml(it.label) + '</span>';
    return '        ' + sep + '<a href="' + it.href + '">' + escHtml(it.label) + '</a>';
  }).join('\n');
}

function render(template, vars) {
  let html = template;
  for (const [k, v] of Object.entries(vars)) {
    html = html.split('{{' + k + '}}').join(String(v));
  }
  return html;
}

function main() {
  const { donGia, tinhList, mauList } = loadData();
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const donGiaJson = JSON.stringify(donGia);
  const tinhListJson = JSON.stringify(slimTinhList(tinhList));
  const mauListJson = JSON.stringify(slimMauList(mauList));
  const tinhOptions = tinhOptionsHtml(tinhList);

  // ── Trang chính ──
  const mainTitle = 'Dự toán chi phí xây nhà 60 giây — Bảng giá ' + NAM + ' | App Làm Nhà';
  const mainDesc = 'Dự toán chi phí xây nhà miễn phí trong 60 giây: chọn loại nhà, số tầng, diện tích, mức hoàn thiện và khu vực để có ngay khoảng giá tham khảo ' + NAM + '.';
  const mainCanonical = BASE_URL + '/du-toan/';
  const mainHtml = render(template, {
    TITLE: escHtml(mainTitle),
    DESCRIPTION: escHtml(mainDesc),
    CANONICAL: mainCanonical,
    JSONLD_WEBAPP: jsonLdWebApp(mainTitle, mainCanonical, mainDesc),
    JSONLD_FAQ: jsonLdFaq(faqMain()),
    BREADCRUMB_HTML: breadcrumbHtml([
      { label: 'Trang chủ', href: '/' },
      { label: 'Dự toán 60 giây' },
    ]),
    H1: 'Dự toán chi phí xây nhà 60 giây — miễn phí, có ngay khoảng giá',
    HERO_SUB: 'Trả lời 5 câu hỏi nhanh (chọn nút, không cần gõ) để xem ngay khoảng chi phí xây nhà tham khảo.',
    TINH_OPTIONS_HTML: tinhOptions,
    INTRO_SECTION_HTML: '',
    DON_GIA_JSON: donGiaJson,
    TINH_LIST_JSON: tinhListJson,
    MAU_LIST_JSON: mauListJson,
    PRESELECT_TINH: '',
  });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), mainHtml, 'utf8');
  console.log('Đã sinh du-toan/index.html');

  // ── Trang biến thể theo tỉnh ──
  let count = 0;
  for (const t of tinhList) {
    const slug = 'xay-nha-tai-' + t.slug;
    const title = ('Dự toán chi phí xây nhà tại ' + t.ten + ' ' + NAM + ' — 60 giây | App Làm Nhà');
    const desc = ('Dự toán chi phí xây nhà tại ' + t.ten + ' ' + NAM + ' miễn phí trong 60 giây — chọn loại nhà, diện tích, mức hoàn thiện để xem ngay khoảng giá tham khảo theo khu vực ' + t.ten + '.').slice(0, 158);
    const canonical = BASE_URL + '/du-toan/' + slug + '.html';
    const introHtml = '  <div class="wrap">\n' +
      '    <div class="cn-article-body" style="max-width:760px;margin:0 auto 10px">\n' +
      '      <div class="cn-prose"><p>' + escHtml(t.gioiThieu) + '</p></div>\n' +
      '    </div>\n' +
      '  </div>\n';

    const html = render(template, {
      TITLE: escHtml(title),
      DESCRIPTION: escHtml(desc),
      CANONICAL: canonical,
      JSONLD_WEBAPP: jsonLdWebApp(title, canonical, desc),
      JSONLD_FAQ: jsonLdFaq(faqTinh(t.ten)),
      BREADCRUMB_HTML: breadcrumbHtml([
        { label: 'Trang chủ', href: '/' },
        { label: 'Dự toán 60 giây', href: 'index.html' },
        { label: t.ten },
      ]),
      H1: 'Dự toán chi phí xây nhà tại ' + t.ten + ' ' + NAM,
      HERO_SUB: 'Trả lời 5 câu hỏi nhanh (chọn nút, không cần gõ) để xem ngay khoảng chi phí xây nhà tham khảo tại ' + t.ten + '.',
      TINH_OPTIONS_HTML: tinhOptions,
      INTRO_SECTION_HTML: introHtml,
      DON_GIA_JSON: donGiaJson,
      TINH_LIST_JSON: tinhListJson,
      MAU_LIST_JSON: mauListJson,
      PRESELECT_TINH: t.slug,
    });
    fs.writeFileSync(path.join(OUT_DIR, slug + '.html'), html, 'utf8');
    count++;
  }
  console.log('Đã sinh ' + count + ' trang dự toán theo tỉnh.');
}

main();
