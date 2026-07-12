#!/usr/bin/env node
/**
 * gen-tinh.js — Sinh trang dịch vụ thiết kế nhà theo tỉnh (Trụ 3 — SEO địa phương)
 *
 * Cách chạy (từ gốc repo): node tools/gen-tinh.js
 *
 * Đọc data/tinh.json + data/mau-nha.json + tools/template-tinh.html → sinh:
 *  - thiet-ke-nha/{tinh}.html   1 trang / tỉnh
 *  - thiet-ke-nha/index.html    trang danh mục nhỏ (liên kết nội bộ)
 *
 * Thêm tỉnh mới: thêm object vào data/tinh.json (nhớ viết "gioiThieuThietKe"
 * RIÊNG, không copy "gioiThieu" của trang dự toán) → chạy lại file này +
 * tools/gen-sitemap.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_FILE = path.join(__dirname, 'template-tinh.html');
const OUT_DIR = path.join(ROOT, 'thiet-ke-nha');
const BASE_URL = 'https://applamnha.vn';
const NAM = 2026;

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtMoney(n) {
  return Number(n).toLocaleString('vi-VN') + 'đ';
}

function loadData() {
  const tinhData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tinh.json'), 'utf8'));
  const mauData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mau-nha.json'), 'utf8'));
  return { tinhList: tinhData.tinh, mauList: mauData.mau };
}

function jsonLdLocalBusiness(t, canonical) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'App Làm Nhà — ' + t.ten,
    url: canonical,
    image: BASE_URL + '/icon-512.png',
    telephone: '+84909829696',
    areaServed: t.ten,
    priceRange: '$$',
    parentOrganization: {
      '@type': 'Organization',
      name: 'App Làm Nhà',
      url: BASE_URL + '/',
    },
  }, null, 2);
}

// 3 mẫu gợi ý — chọn đa dạng loại (không lặp cùng 1 loai) để trang tỉnh nào
// cũng thấy được nhiều lựa chọn, không thiên vị 1 dòng sản phẩm.
function pickMauSuggest(mauList, n) {
  const seenLoai = new Set();
  const picked = [];
  for (const m of mauList) {
    if (seenLoai.has(m.loai)) continue;
    seenLoai.add(m.loai);
    picked.push(m);
    if (picked.length >= n) break;
  }
  for (const m of mauList) {
    if (picked.length >= n) break;
    if (!picked.includes(m)) picked.push(m);
  }
  return picked.slice(0, n);
}
function mauCardsHtml(list) {
  return list.map((m) => (
    '        <a class="mn-cat-card" href="../mau/' + m.slug + '.html">\n' +
    '          <div class="mn-cat-thumb"><i class="ph-duotone ph-image"></i><span>Phối cảnh đang cập nhật</span></div>\n' +
    '          <div class="mn-cat-body">\n' +
    '            <h3>' + escHtml(m.ten) + '</h3>\n' +
    '            <div class="mn-cat-price"><span class="k">Giá hồ sơ</span><span class="v">' + fmtMoney(m.giaBanMau) + '</span></div>\n' +
    '          </div>\n' +
    '        </a>'
  )).join('\n');
}

// Ưu tiên tỉnh cùng heSoVungKey (cùng vùng) trước, sau đó lấp đầy bằng tỉnh khác.
function pickRelatedTinh(all, current, n) {
  const others = all.filter((x) => x.slug !== current.slug);
  others.sort((a, b) => {
    const sameA = a.heSoVungKey === current.heSoVungKey ? 0 : 1;
    const sameB = b.heSoVungKey === current.heSoVungKey ? 0 : 1;
    return sameA - sameB;
  });
  return others.slice(0, n);
}
function relatedTinhHtml(list) {
  return list.map((t) => (
    '        <a href="' + t.slug + '.html">Thiết kế nhà tại ' + escHtml(t.ten) + '</a>'
  )).join('\n');
}

function render(template, vars) {
  let html = template;
  for (const [k, v] of Object.entries(vars)) {
    html = html.split('{{' + k + '}}').join(String(v));
  }
  return html;
}

function renderIndexPage(tinhList) {
  const cards = tinhList.map((t) => (
    '      <a class="mn-cat-card" href="' + t.slug + '.html">\n' +
    '        <div class="mn-cat-thumb"><i class="ph-duotone ph-map-pin"></i><span>' + escHtml(t.ten) + '</span></div>\n' +
    '        <div class="mn-cat-body">\n' +
    '          <h3>Thiết kế nhà tại ' + escHtml(t.ten) + '</h3>\n' +
    '          <p style="font-size:var(--text-sm);color:var(--sub)">KTS xác thực, thanh toán theo Quy trình 4 bước đảm bảo</p>\n' +
    '        </div>\n' +
    '      </a>'
  )).join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<title>Thiết kế nhà theo tỉnh — KTS xác thực, 4 bước đảm bảo | ALN</title>
<meta name="description" content="App Làm Nhà kết nối kiến trúc sư đã xác thực chứng chỉ hành nghề theo từng tỉnh, hợp đồng trực tiếp, thanh toán theo Quy trình 4 bước đảm bảo C1–C4.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${BASE_URL}/thiet-ke-nha/">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/thiet-ke-nha/">
<meta property="og:title" content="Thiết kế nhà theo tỉnh — KTS xác thực, 4 bước đảm bảo | ALN">
<meta property="og:description" content="Kiến trúc sư đã xác thực chứng chỉ hành nghề theo từng tỉnh, thanh toán theo Quy trình 4 bước đảm bảo C1–C4.">
<meta property="og:site_name" content="App Làm Nhà">
<meta property="og:locale" content="vi_VN">
<meta name="twitter:card" content="summary_large_image">

<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/duotone/style.css">
<link rel="stylesheet" href="../aln-tokens.css">
<link rel="stylesheet" href="../cam-nang/cam-nang.css">
<link rel="stylesheet" href="../mau/mau-nha.css">
<link rel="stylesheet" href="thiet-ke-nha.css">
<link rel="icon" href="../icon-192.png" type="image/png">
<meta name="theme-color" content="#98690a">
<!-- Google Analytics 4 (ALN — G-5CSL1TF0RC, tách riêng khỏi property TK.HOUSE) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5CSL1TF0RC"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-5CSL1TF0RC');
</script>
<!-- End GA4 -->
</head>
<body>

<header id="cn-nav">
  <div class="wrap cn-nav-inner">
    <a href="/" class="cn-brand">
      <div class="cn-logo"><img src="../icon-192.png" alt="ALN"></div>
      <div class="cn-name">ALN<small>Thiết kế nhà theo tỉnh</small></div>
    </a>
    <div class="cn-nav-links">
      <a class="cn-nav-link" href="/">Trang chủ</a>
      <a class="cn-nav-link" href="../mau/">Kho mẫu</a>
      <a class="cn-nav-link" href="../du-toan/">Dự toán 60 giây</a>
    </div>
    <a class="btn btn-gold" href="/#pricing"><i class="ph-duotone ph-file-text"></i>Nhận báo giá</a>
  </div>
</header>

<main>
  <div class="wrap">
    <section class="cn-hero">
      <div class="eyebrow" style="justify-content:center"><span class="ln"></span>THIẾT KẾ NHÀ THEO KHU VỰC<span class="ln"></span></div>
      <h1>Kiến trúc sư <em>xác thực</em> theo từng tỉnh</h1>
      <p>Chọn khu vực bạn dự định xây nhà để xem kiến trúc sư ALN đang phục vụ tại đó, cùng thông tin quy hoạch và thủ tục địa phương cần lưu ý.</p>
    </section>
    <div class="mn-cat-grid">
${cards}
    </div>
  </div>
</main>

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <div class="cn-brand"><div class="cn-logo"><img src="../icon-192.png" alt="ALN"></div><div class="cn-name" style="font-size:15px">ALN</div></div>
        <p>ALN là nền tảng kết nối kiến trúc sư và đơn vị thi công đã thẩm định, thanh toán trực tiếp minh bạch từng chặng C1–C4.</p>
      </div>
      <div class="foot-col">
        <h5>Điều hướng</h5>
        <a href="/#why">Vì sao chọn ALN</a>
        <a href="/#process">Quy trình C1–C4</a>
        <a href="../mau/">Kho mẫu</a>
        <a href="../du-toan/">Dự toán 60 giây</a>
      </div>
      <div class="foot-col">
        <h5>Truy cập</h5>
        <a href="../login.html">Đăng nhập</a>
        <a href="../register.html">Đăng ký chủ nhà</a>
        <a href="../kts-apply.html">Đăng ký KTS</a>
      </div>
      <div class="foot-col">
        <h5>Liên hệ</h5>
        <a href="tel:0909829696"><i class="ph-duotone ph-phone" style="margin-right:6px;color:var(--gold)"></i>0909 82 9696</a>
        <a href="https://applamnha.vn" target="_blank" rel="noopener"><i class="ph-duotone ph-globe" style="margin-right:6px;color:var(--gold)"></i>applamnha.vn</a>
        <p><i class="ph-duotone ph-map-pin" style="margin-right:6px;color:var(--gold)"></i>TP. Hồ Chí Minh</p>
      </div>
    </div>
    <div class="foot-bottom">© ALN — App Làm Nhà Corp. · applamnha.vn</div>
  </div>
</footer>

</body>
</html>
`;
}

function main() {
  const { tinhList, mauList } = loadData();
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  for (const t of tinhList) {
    const canonical = BASE_URL + '/thiet-ke-nha/' + t.slug + '.html';
    const title = ('Thiết kế nhà tại ' + t.ten + ' — KTS xác thực, 4 bước đảm bảo | ALN').slice(0, 65);
    const description = ('Thiết kế nhà tại ' + t.ten + ': KTS đã xác thực chứng chỉ hành nghề, hợp đồng trực tiếp với ALN, thanh toán theo Quy trình 4 bước đảm bảo C1–C4. Tư vấn miễn phí.').slice(0, 158);
    const mauSuggest = pickMauSuggest(mauList, 3);
    const relatedTinh = pickRelatedTinh(tinhList, t, 3);

    const html = render(template, {
      TITLE: escHtml(title),
      DESCRIPTION: escHtml(description),
      CANONICAL: canonical,
      JSONLD_LOCALBUSINESS: jsonLdLocalBusiness(t, canonical),
      TEN: escHtml(t.ten),
      TEN_JS: t.ten.replace(/'/g, "\\'"),
      TINH_SLUG: t.slug,
      H1: 'Thiết kế nhà tại ' + escHtml(t.ten) + ' — KTS xác thực, thanh toán 4 bước đảm bảo',
      GIOI_THIEU: escHtml(t.gioiThieuThietKe),
      DUTOAN_HREF: '../du-toan/xay-nha-tai-' + t.slug + '.html',
      MAU_CARDS_HTML: mauCardsHtml(mauSuggest),
      RELATED_TINH_HTML: relatedTinhHtml(relatedTinh),
    });
    fs.writeFileSync(path.join(OUT_DIR, t.slug + '.html'), html, 'utf8');
    count++;
  }
  console.log('Đã sinh ' + count + ' trang thiết kế nhà theo tỉnh.');

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndexPage(tinhList), 'utf8');
  console.log('Đã sinh thiet-ke-nha/index.html');
}

main();
