#!/usr/bin/env node
/**
 * gen-mau.js — Sinh trang mẫu nhà tự động (Trụ 1 — programmatic SEO)
 *
 * Cách chạy (từ gốc repo): node tools/gen-mau.js
 *
 * Đọc data/mau-nha.json + tools/template-mau.html → sinh:
 *  - mau/{slug}.html          1 trang / mẫu
 *  - mau/index.html           trang danh mục tổng (lưới + lọc client-side)
 *  - mau/{loai}.html          trang danh mục con, chỉ sinh cho loai có ≥1 mẫu
 *
 * Thêm mẫu mới: thêm object vào data/mau-nha.json rồi chạy lại file này
 * và tools/gen-sitemap.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'mau-nha.json');
const TEMPLATE_FILE = path.join(__dirname, 'template-mau.html');
const OUT_DIR = path.join(ROOT, 'mau');
const BASE_URL = 'https://applamnha.vn';

const LOAI_LABEL = {
  'nha-pho': 'Nhà phố',
  'nha-cap-4': 'Nhà cấp 4',
  'biet-thu': 'Biệt thự',
  'nha-2-tang': 'Nhà 2 tầng',
  'nha-3-tang': 'Nhà 3 tầng',
};
const PHONG_CACH_LABEL = {
  'hien-dai': 'Hiện đại',
  'tan-co-dien': 'Tân cổ điển',
  'mai-thai': 'Mái Thái',
  'toi-gian': 'Tối giản',
};

function fmtTy(n) {
  const ty = n / 1e9;
  return ty.toFixed(1).replace('.', ',') + ' tỷ';
}
function fmtMoney(n) {
  return Number(n).toLocaleString('vi-VN') + 'đ';
}
function budgetBucket(duToanTu) {
  if (duToanTu >= 2e9) return '>=2ty';
  if (duToanTu >= 1e9) return '1-2ty';
  return '<1ty';
}
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function moTaToHtml(moTa) {
  return moTa.split(/\n\n+/).map((p) => '<p>' + p.trim() + '</p>').join('\n');
}
function galleryCaptions(m) {
  if (m.tang <= 1) return ['Phối cảnh mặt tiền', 'Mặt bằng tổng thể', 'Phối cảnh sân vườn'];
  const caps = ['Phối cảnh mặt tiền', 'Mặt bằng tầng trệt'];
  for (let i = 2; i < m.tang; i++) caps.push('Mặt bằng tầng ' + i);
  caps.push('Mặt bằng tầng ' + m.tang + (m.tang > 1 ? ' (trên cùng)' : ''));
  return caps.slice(0, 4);
}
function galleryHtml(m) {
  const icons = ['ph-image', 'ph-ruler', 'ph-ruler', 'ph-ruler'];
  return galleryCaptions(m).map((cap, i) => (
    '      <div class="mn-shot"><div class="mn-shot-ph"><i class="ph-duotone ' + icons[i % icons.length] + '"></i><span>' + escHtml(cap) + '<br>đang cập nhật</span></div></div>'
  )).join('\n');
}

function pickRelated(all, current, n) {
  const others = all.filter((x) => x.id !== current.id);
  const scored = others.map((x) => {
    let score = 0;
    if (x.loai === current.loai) score += 10;
    const budgetDiff = Math.abs(x.duToanTu - current.duToanTu) / current.duToanTu;
    score += Math.max(0, 5 - budgetDiff * 5);
    return { m: x, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((s) => s.m);
}
function relatedHtml(list) {
  return list.map((m) => (
    '      <a class="cn-related-card" href="' + m.slug + '.html">\n' +
    '        <span class="tag-gold">' + LOAI_LABEL[m.loai] + '</span>\n' +
    '        <h4>' + escHtml(m.ten) + '</h4>\n' +
    '        <div class="mn-related-meta">' + m.ngang + '×' + m.dai + 'm · ' + m.tang + ' tầng · ' + m.phongNgu + ' PN · từ ' + fmtMoney(m.giaBanMau) + '</div>\n' +
    '      </a>'
  )).join('\n');
}

function faqFor(m) {
  const ten = m.ten;
  return [
    {
      q: 'Mẫu này xây hết bao nhiêu?',
      a: 'Dự toán xây dựng tham khảo cho ' + ten + ' khoảng ' + fmtTy(m.duToanTu) + ' – ' + fmtTy(m.duToanDen) + ', tuỳ mức hoàn thiện và đơn giá thực tế tại khu vực. Con số này chưa gồm phí mua hồ sơ mẫu (' + fmtMoney(m.giaBanMau) + ') và cần kiến trúc sư khảo sát lô đất thật để có con số chính xác.',
    },
    {
      q: 'Có sửa theo đất của tôi được không?',
      a: 'Có. Sau khi mua hồ sơ mẫu, kiến trúc sư khu vực ALN sẽ điều chỉnh lại theo hướng đất, kích thước thực tế và quy định xây dựng địa phương trước khi hoàn thiện hồ sơ xin phép.',
    },
    {
      q: 'Bao lâu nhận hồ sơ?',
      a: 'Với mẫu có sẵn như ' + ten + ', ALN cam kết gửi hồ sơ trong vòng 48 giờ sau khi xác nhận mua, KTS khu vực sẽ liên hệ trực tiếp để trao đổi các điều chỉnh cần thiết.',
    },
  ];
}

function jsonLdProduct(m, canonical, ogImage) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: m.ten,
    image: ogImage,
    description: metaDescription(m),
    sku: m.id,
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'VND',
      price: m.giaBanMau,
      availability: 'https://schema.org/InStock',
    },
  }, null, 2);
}
function jsonLdFaq(m) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqFor(m).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }, null, 2);
}

function metaDescription(m) {
  const s = m.ten + ': ' + m.ngang + '×' + m.dai + 'm, ' + m.tang + ' tầng, ' + m.phongNgu +
    ' phòng ngủ, phong cách ' + PHONG_CACH_LABEL[m.phongCach] + '. Dự toán tham khảo ' +
    fmtTy(m.duToanTu) + ' – ' + fmtTy(m.duToanDen) + '.';
  return s.length > 158 ? s.slice(0, 155) + '...' : s;
}

function buildTitle(m) {
  const base = m.ten + ' — Dự toán ' + fmtTy(m.duToanTu) + '–' + fmtTy(m.duToanDen);
  const withBrand = base + ' | App Làm Nhà';
  return withBrand.length <= 65 ? withBrand : base;
}

function renderMauPage(template, m, all) {
  const canonical = BASE_URL + '/mau/' + m.slug + '.html';
  const title = buildTitle(m);
  const description = metaDescription(m);
  const ogImage = BASE_URL + '/assets/demo/aln-demo-biet-thu-vuon.jpg'; // fallback tạm — thay khi có ảnh thật từng mẫu
  const related = pickRelated(all, m, 4);

  const map = {
    TITLE: escHtml(title),
    DESCRIPTION: escHtml(description),
    CANONICAL: canonical,
    OG_IMAGE: ogImage,
    JSONLD_PRODUCT: jsonLdProduct(m, canonical, ogImage),
    JSONLD_FAQ: jsonLdFaq(m),
    LOAI_SLUG: m.loai,
    LOAI_LABEL: LOAI_LABEL[m.loai],
    TEN: escHtml(m.ten),
    TEN_JS: m.ten.replace(/'/g, "\\'"),
    ID: m.id,
    KTS_TAC_GIA: escHtml(m.ktsTacGia),
    GALLERY_HTML: galleryHtml(m),
    NGANG: m.ngang,
    DAI: m.dai,
    TANG: m.tang,
    PHONG_NGU: m.phongNgu,
    PHONG_TAM: m.phongTam,
    DIEN_TICH_DAT: m.dienTichDat,
    DIEN_TICH_SAN: m.dienTichSan,
    PHONG_CACH_LABEL: PHONG_CACH_LABEL[m.phongCach],
    DU_TOAN_TU: fmtTy(m.duToanTu),
    DU_TOAN_DEN: fmtTy(m.duToanDen),
    GIA_BAN_MAU: fmtMoney(m.giaBanMau),
    BUDGET_BUCKET: budgetBucket(m.duToanTu),
    MO_TA_HTML: moTaToHtml(m.moTa),
    RELATED_HTML: relatedHtml(related),
  };

  let html = template;
  for (const [k, v] of Object.entries(map)) {
    html = html.split('{{' + k + '}}').join(String(v));
  }
  return html;
}

function catCardHtml(m) {
  return (
    '      <a class="mn-cat-card" href="' + m.slug + '.html">\n' +
    '        <div class="mn-cat-thumb"><i class="ph-duotone ph-image"></i><span>Phối cảnh đang cập nhật</span></div>\n' +
    '        <div class="mn-cat-body">\n' +
    '          <div class="mn-cat-code">' + m.id + '</div>\n' +
    '          <h3>' + escHtml(m.ten) + '</h3>\n' +
    '          <div class="mn-cat-specs"><span>' + m.ngang + '×' + m.dai + 'm</span><span>' + m.tang + ' tầng</span><span>' + m.phongNgu + ' PN</span></div>\n' +
    '          <div class="mn-cat-price"><span class="k">Giá hồ sơ</span><span class="v">' + fmtMoney(m.giaBanMau) + '</span></div>\n' +
    '        </div>\n' +
    '      </a>'
  );
}

function pageShell({ title, description, canonical, heading, intro, filtersHtml, cardsHtml }) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:site_name" content="App Làm Nhà">
<meta property="og:locale" content="vi_VN">
<meta name="twitter:card" content="summary_large_image">

<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/duotone/style.css">
<link rel="stylesheet" href="../aln-tokens.css">
<link rel="stylesheet" href="../cam-nang/cam-nang.css">
<link rel="stylesheet" href="mau-nha.css">
<link rel="icon" href="../icon-192.png" type="image/png">
<meta name="theme-color" content="#98690a">
</head>
<body>

<header id="cn-nav">
  <div class="wrap cn-nav-inner">
    <a href="/" class="cn-brand">
      <div class="cn-logo"><img src="../icon-192.png" alt="ALN"></div>
      <div class="cn-name">ALN<small>Kho mẫu nhà</small></div>
    </a>
    <div class="cn-nav-links">
      <a class="cn-nav-link" href="/">Trang chủ</a>
      <a class="cn-nav-link" href="index.html">Kho mẫu</a>
      <a class="cn-nav-link" href="../cam-nang/index.html">Cẩm nang</a>
    </div>
    <a class="btn btn-gold" href="/#pricing"><i class="ph-duotone ph-file-text"></i>Nhận báo giá</a>
  </div>
</header>

<main>
  <div class="wrap">
    <section class="cn-hero">
      <div class="eyebrow" style="justify-content:center"><span class="ln"></span>KHO MẪU NHÀ<span class="ln"></span></div>
      <h1>${heading}</h1>
      <p>${intro}</p>
    </section>
${filtersHtml}
    <div class="mn-cat-grid">
${cardsHtml}
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
        <a href="/#pricing">Bảng giá</a>
        <a href="../cam-nang/index.html">Cẩm nang</a>
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

function renderIndexPage(all) {
  const filters = ['all', ...Object.keys(LOAI_LABEL)];
  const filtersHtml =
    '    <nav class="cn-filters" aria-label="Lọc theo loại nhà">\n' +
    filters.map((f) => (
      '      <button class="cn-filter' + (f === 'all' ? ' active' : '') + '" data-filter="' + f + '">' +
      (f === 'all' ? 'Tất cả' : LOAI_LABEL[f]) + '</button>'
    )).join('\n') +
    '\n    </nav>';
  const cardsHtml = all.map((m) => (
    '      <a class="mn-cat-card" href="' + m.slug + '.html" data-category="' + m.loai + '">\n' +
    '        <div class="mn-cat-thumb"><i class="ph-duotone ph-image"></i><span>Phối cảnh đang cập nhật</span></div>\n' +
    '        <div class="mn-cat-body">\n' +
    '          <div class="mn-cat-code">' + m.id + '</div>\n' +
    '          <h3>' + escHtml(m.ten) + '</h3>\n' +
    '          <div class="mn-cat-specs"><span>' + m.ngang + '×' + m.dai + 'm</span><span>' + m.tang + ' tầng</span><span>' + m.phongNgu + ' PN</span></div>\n' +
    '          <div class="mn-cat-price"><span class="k">Giá hồ sơ</span><span class="v">' + fmtMoney(m.giaBanMau) + '</span></div>\n' +
    '        </div>\n' +
    '      </a>'
  )).join('\n');

  const html = pageShell({
    title: 'Kho mẫu nhà — Hồ sơ thiết kế có sẵn, nhận trong 48h | App Làm Nhà',
    description: 'Kho mẫu nhà App Làm Nhà: nhà phố, biệt thự, nhà cấp 4, nhà vườn — hồ sơ thiết kế có sẵn, kiến trúc sư khu vực chỉnh theo lô đất thật, nhận hồ sơ trong 48h.',
    canonical: BASE_URL + '/mau/',
    heading: 'Kho mẫu nhà <em>có sẵn</em> — nhận hồ sơ trong 48h',
    intro: 'Chọn mẫu phù hợp với lô đất và ngân sách, kiến trúc sư khu vực sẽ điều chỉnh lại theo hướng đất, quy định xây dựng địa phương trước khi bàn giao hồ sơ xin phép — tiết kiệm thời gian hơn thiết kế mới hoàn toàn.',
    filtersHtml,
    cardsHtml,
  }).replace('</main>', `  <script>
  (function(){
    var filters = document.querySelectorAll('.cn-filter');
    var cards = document.querySelectorAll('.mn-cat-card[data-category]');
    for (var i = 0; i < filters.length; i++) {
      filters[i].addEventListener('click', function(e){
        var f = e.currentTarget.getAttribute('data-filter');
        for (var j = 0; j < filters.length; j++) { filters[j].classList.remove('active'); }
        e.currentTarget.classList.add('active');
        for (var k = 0; k < cards.length; k++) {
          var cat = cards[k].getAttribute('data-category');
          cards[k].style.display = (f === 'all' || f === cat) ? '' : 'none';
        }
      });
    }
  })();
  </script>
</main>`);
  return html;
}

const CATEGORY_INTRO = {
  'nha-pho': 'Nhà phố là lựa chọn phổ biến nhất tại các khu dân cư đô thị, xây trên lô đất mặt tiền hẹp (thường 4–6m) nhưng chiều sâu lớn, tận dụng tối đa diện tích xây dựng theo chiều cao thay vì chiều ngang. Các mẫu dưới đây phù hợp gia đình 1–2 thế hệ, có thể kết hợp một phần diện tích tầng trệt cho kinh doanh nếu nhà nằm trên trục đường thuận lợi. Mỗi mẫu đã có sẵn bản vẽ cơ bản, kiến trúc sư khu vực sẽ điều chỉnh lại theo hướng đất và quy định lộ giới cụ thể trước khi hoàn thiện hồ sơ xin phép xây dựng.',
  'biet-thu': 'Biệt thự phù hợp với lô đất rộng, có khoảng lùi xung quanh để bố trí sân vườn, chỗ đậu xe ngoài trời — khác với nhà phố xây kín đất. Các mẫu biệt thự dưới đây tập trung vào không gian sống rộng rãi, nhiều phòng chức năng cho gia đình đông thành viên, mặt đứng được xử lý theo hướng tân cổ điển hoặc hiện đại tuỳ gu thẩm mỹ. Khi mua mẫu, kiến trúc sư khu vực sẽ khảo sát lô đất thật để điều chỉnh vị trí sân vườn và các chi tiết mặt đứng cho phù hợp.',
  'nha-cap-4': 'Nhà cấp 4 chỉ xây 1 tầng, phù hợp lô đất rộng ở khu vực ven đô, ngoại thành hoặc các tỉnh có quỹ đất lớn. Kết cấu móng đơn giản hơn nhà nhiều tầng nên thời gian và chi phí thi công thường thấp hơn, phù hợp gia đình muốn tiết kiệm ngân sách kết cấu để dồn cho sân vườn, cảnh quan hoặc dùng làm nhà nghỉ dưỡng. Các mẫu dưới đây thường đi kèm sân vườn bao quanh, mái dốc thoát nước tốt cho khí hậu nhiệt đới.',
  'nha-2-tang': 'Nhà 2 tầng cân bằng giữa diện tích sử dụng và chi phí xây dựng — đủ phòng chức năng cho gia đình đông thành viên mà không phải xây cao tầng như nhà phố đô thị. Phù hợp cả lô đất vừa và lô đất rộng có sân vườn xung quanh. Các mẫu dưới đây thường tách tầng trệt cho sinh hoạt chung, tầng trên cho khu vực nghỉ ngơi riêng tư, kiến trúc sư khu vực sẽ điều chỉnh theo hướng đất thực tế trước khi bàn giao hồ sơ.',
  'nha-3-tang': 'Nhà 3 tầng phù hợp gia đình cần nhiều phòng chức năng trên lô đất có diện tích vừa phải, thường gặp ở khu dân cư đô thị nơi đất hẹp nhưng nhu cầu sử dụng cao. Bố cục thường tách khu sinh hoạt chung ở tầng trệt, các tầng trên dành cho phòng ngủ riêng tư. Kiến trúc sư khu vực sẽ khảo sát kết cấu móng phù hợp và điều chỉnh mặt đứng theo quy định xây dựng địa phương trước khi hoàn thiện hồ sơ.',
};

function renderCategoryPage(loai, items, all) {
  const label = LOAI_LABEL[loai];
  const cardsHtml = items.map(catCardHtml).join('\n');
  return pageShell({
    title: (label + ' — Mẫu nhà có sẵn, dự toán rõ ràng | App Làm Nhà').slice(0, 68),
    description: ('Mẫu ' + label.toLowerCase() + ' có sẵn tại App Làm Nhà: hồ sơ thiết kế đầy đủ, dự toán tham khảo rõ ràng, kiến trúc sư khu vực điều chỉnh theo lô đất thật, nhận hồ sơ trong 48h.').slice(0, 158),
    canonical: BASE_URL + '/mau/' + loai + '.html',
    heading: 'Mẫu <em>' + label + '</em> có sẵn',
    intro: CATEGORY_INTRO[loai] || (label + ' — hồ sơ thiết kế có sẵn tại App Làm Nhà.'),
    filtersHtml: '',
    cardsHtml,
  });
}

/* ── main ── */
function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const all = data.mau;
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  for (const m of all) {
    const html = renderMauPage(template, m, all);
    fs.writeFileSync(path.join(OUT_DIR, m.slug + '.html'), html, 'utf8');
    count++;
  }
  console.log('Đã sinh ' + count + ' trang mẫu vào mau/*.html');

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndexPage(all), 'utf8');
  console.log('Đã sinh mau/index.html');

  const byLoai = {};
  for (const m of all) {
    (byLoai[m.loai] = byLoai[m.loai] || []).push(m);
  }
  let catCount = 0;
  for (const [loai, items] of Object.entries(byLoai)) {
    fs.writeFileSync(path.join(OUT_DIR, loai + '.html'), renderCategoryPage(loai, items, all), 'utf8');
    catCount++;
  }
  console.log('Đã sinh ' + catCount + ' trang danh mục: ' + Object.keys(byLoai).join(', '));
}

main();
