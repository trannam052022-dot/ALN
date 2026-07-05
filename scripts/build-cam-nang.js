#!/usr/bin/env node
// Build script khu "Cẩm nang làm nhà" — Markdown → HTML tĩnh.
// KHÔNG dùng npm dependency ngoài, chỉ module built-in của Node.
//
// Chạy: node scripts/build-cam-nang.js
//
// Việc làm mỗi lần chạy (idempotent — chạy nhiều lần cho kết quả giống hệt):
//   1. Đọc mọi file content/cam-nang/*.md
//   2. Sinh cam-nang/{slug}/index.html cho từng bài
//   3. Sinh cam-nang/index.html (trang danh mục)
//   4. Sinh sitemap.xml (toàn site — bài Cẩm nang + danh sách trang public tĩnh)
//   5. Sinh robots.txt
//
// Founder KHÔNG cần chạy lệnh này — Claude Code chạy mỗi khi thêm bài mới
// rồi commit thẳng HTML sinh ra (xem CHANGES.md Pass 1, mục "Kiến trúc build").
//
// Hẹn ngày đăng: thêm "publishDate: YYYY-MM-DD" vào frontmatter bài viết.
// Bài chưa tới ngày (theo giờ VN) sẽ KHÔNG được build ra (không tồn tại URL,
// không vào sitemap/danh mục/trang chủ) cho tới khi script chạy lại đúng/qua
// ngày đó — xem .github/workflows/publish-cam-nang.yml (cron tự chạy 6h sáng
// mỗi ngày). Không có "publishDate" = xuất bản ngay như trước giờ.
//
// Đăng Facebook tự động: thêm "facebook: true" vào frontmatter để khi bài
// tới publishDate và lên web, hệ thống TỰ ĐỘNG đăng luôn lên Fanpage "App Làm
// Nhà" (không cần duyệt lại — nội dung Cẩm nang đã duyệt lúc soạn). Không có
// trường này hoặc "facebook: false" = mặc định an toàn, chỉ lên web, không
// đăng FB. Chống đăng trùng bằng content/cam-nang/.fb-posted.json (mỗi slug
// chỉ đăng đúng 1 lần — xem postDueArticlesToFacebook bên dưới). Cần thiết
// lập secret CAM_NANG_FB_SECRET (GitHub Actions + Firebase) trước khi dùng —
// xem CHANGES.md.

var fs = require('fs');
var path = require('path');

var frontmatter = require('./lib/frontmatter');
var markdown = require('./lib/markdown');
var templates = require('./lib/templates');

var ROOT = path.join(__dirname, '..');
var CONTENT_DIR = path.join(ROOT, 'content', 'cam-nang');
var OUT_DIR = path.join(ROOT, 'cam-nang');
var SITE_BASE = 'https://applamnha.vn';

// ── Tự đăng Facebook khi bài Cẩm nang có "facebook: true" vừa xuất bản ──
// Endpoint Cloud Function postCamNangToFacebook (functions/index.js), xác thực
// bằng secret CAM_NANG_FB_SECRET (khác Firebase Auth vì chạy từ GitHub Actions).
// Có thể override URL qua env CAM_NANG_FB_POST_URL nếu cần (vd. test cục bộ).
var FB_POST_URL = process.env.CAM_NANG_FB_POST_URL ||
  'https://asia-southeast1-aln-platform.cloudfunctions.net/postCamNangToFacebook';
var FB_POSTED_STATE_FILE = path.join(CONTENT_DIR, '.fb-posted.json');

// ── Danh sách trang public tĩnh ngoài Cẩm nang — liệt kê thủ công (KHÔNG
// quét toàn bộ *.html) vì repo có nhiều trang nội bộ/admin cần đăng nhập
// (client_CN, client_DN, kts_dashboard, designer_dashboard, founder_panel,
// ks_dashboard, seed, kho-du-an, board-editor, aln_patch, aln_community,
// profile...) — KHÔNG được đưa vào sitemap để tránh Google index nhầm
// trang nội bộ. Nếu Founder muốn thêm/bớt trang, sửa mảng dưới đây.
var STATIC_PUBLIC_PAGES = [
  { url: '/home.html', priority: '1.0', changefreq: 'weekly' },
  { url: '/register.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/login.html', priority: '0.4', changefreq: 'monthly' },
  { url: '/kts-apply.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/dn-studio.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/designer-apply.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/ks-apply.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/recruit.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/tuyen-kts.html', priority: '0.6', changefreq: 'monthly' },
  { url: '/aln-giu-cho/phong-cho.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/aln-giu-cho/giu-cho.html', priority: '0.5', changefreq: 'monthly' },
  { url: '/privacy.html', priority: '0.3', changefreq: 'yearly' },
];

// "Hôm nay" theo giờ Việt Nam (UTC+7) — KHÔNG phụ thuộc múi giờ máy chạy script
// (quan trọng vì GitHub Actions runner chạy giờ UTC). Dịch epoch hiện tại +7h
// rồi lấy ngày theo UTC là ra đúng ngày lịch ở VN, không cần thư viện ngoài.
function todayVN() {
  var vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10); // YYYY-MM-DD
}

function readArticles() {
  var files = fs.readdirSync(CONTENT_DIR).filter(function (f) { return f.endsWith('.md'); });
  var articles = files.map(function (file) {
    var raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    var parsed = frontmatter.parseMarkdownFile(raw);
    var data = parsed.data;
    if (!data.slug) throw new Error(file + ': thiếu "slug" trong frontmatter');
    if (!templates.CATEGORIES[data.category]) {
      throw new Error(file + ': category "' + data.category + '" không hợp lệ. Hợp lệ: ' + Object.keys(templates.CATEGORIES).join(', '));
    }
    var rendered = markdown.renderMarkdown(parsed.body, data);
    data.bodyHtml = rendered.html;
    // Ưu tiên hộp tóm tắt trích từ blockquote "> **Nội dung chính**" trong
    // nội dung bài; fallback về frontmatter "summary" nếu bài không có (ví dụ
    // bài mẫu Pass 3 cũ dùng frontmatter thay vì blockquote).
    if (rendered.summary) data.summary = rendered.summary;
    data.sourceFile = file;
    return data;
  });

  // Hẹn ngày đăng: frontmatter "publishDate: YYYY-MM-DD" (tuỳ chọn). Không có
  // → xuất bản ngay (tương thích ngược, không cần sửa bài cũ). Có nhưng còn ở
  // tương lai → ẩn hoàn toàn (KHÔNG sinh file HTML, KHÔNG vào sitemap/danh mục/
  // khối trang chủ) cho tới đúng ngày. So sánh chuỗi "YYYY-MM-DD" là đủ, không
  // cần parse Date.
  var today = todayVN();
  var upcoming = articles.filter(function (a) { return a.publishDate && a.publishDate > today; });
  if (upcoming.length) {
    console.log('Bài chưa tới ngày đăng (' + upcoming.length + '): ' + upcoming.map(function (a) {
      return a.slug + ' (publishDate: ' + a.publishDate + ')';
    }).join(', '));
  }
  var published = articles.filter(function (a) { return !a.publishDate || a.publishDate <= today; });

  // Bài mới nhất trước — sort theo "updated" (fallback "date"), dạng YYYY-MM-DD nên so sánh chuỗi là đủ.
  published.sort(function (a, b) {
    var da = a.updated || a.date || '';
    var db = b.updated || b.date || '';
    return db.localeCompare(da);
  });
  return published;
}

function writeFileIfChanged(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  var existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Gỡ bài: xoá thư mục cam-nang/{slug}/ của những bài KHÔNG còn nằm trong danh
// sách xuất bản hiện tại — ví dụ publishDate bị đẩy về tương lai (ẩn lại 1
// bài đang live), hoặc file .md nguồn bị xoá hẳn. Không đụng cam-nang/index.html
// hay cam-nang/cam-nang.css (đều là file, không phải thư mục, nên bỏ qua tự
// nhiên nhờ kiểm tra isDirectory()).
function cleanupOrphanedArticles(articles) {
  if (!fs.existsSync(OUT_DIR)) return 0;
  var validSlugs = {};
  articles.forEach(function (a) { validSlugs[a.slug] = true; });

  var removed = 0;
  fs.readdirSync(OUT_DIR, { withFileTypes: true }).forEach(function (entry) {
    if (!entry.isDirectory() || validSlugs[entry.name]) return;
    fs.rmSync(path.join(OUT_DIR, entry.name), { recursive: true, force: true });
    console.log('Đã gỡ bài (không còn xuất bản): ' + entry.name);
    removed++;
  });
  return removed;
}

function buildArticles(articles) {
  var changed = 0;
  articles.forEach(function (article) {
    var html = templates.renderArticlePage(article, article.bodyHtml, articles, SITE_BASE);
    var outPath = path.join(OUT_DIR, article.slug, 'index.html');
    if (writeFileIfChanged(outPath, html)) changed++;
  });
  return changed;
}

function buildIndex(articles) {
  var html = templates.renderIndexPage(articles, SITE_BASE);
  var outPath = path.join(OUT_DIR, 'index.html');
  return writeFileIfChanged(outPath, html);
}

function buildSitemap(articles) {
  var urls = STATIC_PUBLIC_PAGES.map(function (p) {
    return { url: p.url, priority: p.priority, changefreq: p.changefreq };
  });
  urls.push({ url: '/cam-nang/', priority: '0.9', changefreq: 'weekly' });
  articles.forEach(function (a) {
    urls.push({
      url: '/cam-nang/' + a.slug + '/',
      priority: '0.8',
      changefreq: 'monthly',
      lastmod: a.updated || a.date,
    });
  });

  var body = urls.map(function (u) {
    var lines = ['  <url>', '    <loc>' + SITE_BASE + u.url + '</loc>'];
    if (u.lastmod) lines.push('    <lastmod>' + u.lastmod + '</lastmod>');
    lines.push('    <changefreq>' + u.changefreq + '</changefreq>');
    lines.push('    <priority>' + u.priority + '</priority>');
    lines.push('  </url>');
    return lines.join('\n');
  }).join('\n');

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body + '\n' +
    '</urlset>\n';

  return writeFileIfChanged(path.join(ROOT, 'sitemap.xml'), xml);
}

function buildRobots() {
  var txt = 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE_BASE + '/sitemap.xml\n';
  return writeFileIfChanged(path.join(ROOT, 'robots.txt'), txt);
}

// ── Section "Cẩm nang làm nhà" trên home.html — CHỈ ghi đè phần nằm giữa
// 2 marker dưới đây (danh sách thẻ 3 bài mới nhất). Không đụng gì khác
// trong home.html. Nếu marker không tồn tại (home.html chưa có section
// Cẩm nang — ví dụ trước Pass 4), bỏ qua bước này thay vì lỗi.
var HOME_CARDS_START = '<!-- CAM_NANG_CARDS_START -->';
var HOME_CARDS_END = '<!-- CAM_NANG_CARDS_END -->';

function renderHomeCard(article) {
  var img = article.image
    ? '<img src="' + article.image + '" alt="' + (article.imageAlt || article.title) + '">'
    : 'Ảnh minh hoạ 16:9';
  return (
    '      <a class="cn-home-card" href="cam-nang/' + article.slug + '/">\n' +
    '        <div class="cn-home-img">' + img + '</div>\n' +
    '        <div class="cn-home-body">\n' +
    '          <span class="cn-home-tag">' + templates.categoryLabel(article.category) + '</span>\n' +
    '          <h3>' + article.title + '</h3>\n' +
    '        </div>\n' +
    '      </a>'
  );
}

function buildHomeSection(articles) {
  var homePath = path.join(ROOT, 'home.html');
  if (!fs.existsSync(homePath)) return false;
  var html = fs.readFileSync(homePath, 'utf8');
  var startIdx = html.indexOf(HOME_CARDS_START);
  var endIdx = html.indexOf(HOME_CARDS_END);
  if (startIdx === -1 || endIdx === -1) return false;

  var top3 = articles.slice(0, 3);
  var cards = top3.map(renderHomeCard).join('\n\n');
  var newHtml =
    html.slice(0, startIdx + HOME_CARDS_START.length) +
    '\n' + cards + '\n' +
    html.slice(endIdx);

  return writeFileIfChanged(homePath, newHtml);
}

function loadFbPostedState() {
  if (!fs.existsSync(FB_POSTED_STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FB_POSTED_STATE_FILE, 'utf8'));
  } catch (e) {
    console.error('::error::Không đọc được ' + FB_POSTED_STATE_FILE + ' (' + e.message + ') — coi như chưa có bài nào đăng.');
    return {};
  }
}

function saveFbPostedState(state) {
  var content = JSON.stringify(state, null, 2) + '\n';
  writeFileIfChanged(FB_POSTED_STATE_FILE, content);
}

// Gọi Cloud Function postCamNangToFacebook cho 1 bài. Trả về { ok, error }
// — KHÔNG BAO GIỜ throw, để một bài đăng FB lỗi không chặn các bài khác/web.
function postArticleToFacebook(article, secret) {
  var url = SITE_BASE + '/cam-nang/' + article.slug + '/?utm_source=facebook&utm_medium=social';
  var imageUrl = article.image
    ? (/^https?:\/\//.test(article.image) ? article.image : SITE_BASE + article.image)
    : undefined;

  // Header HTTP chỉ chấp nhận ByteString (Latin-1, 0-255) — nếu secret có ký tự
  // tiếng Việt/Unicode (Founder tự chọn, không bắt buộc chỉ dùng hex/ASCII) thì
  // gán thẳng vào header sẽ crash "Cannot convert argument to a ByteString".
  // Encode base64 (luôn thuần ASCII) trước khi đặt vào header; phía Cloud
  // Function decode lại rồi mới so khớp — xem functions/index.js.
  var secretHeader = Buffer.from(secret, 'utf8').toString('base64');

  return fetch(FB_POST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cam-nang-secret': secretHeader },
    body: JSON.stringify({
      title: article.title,
      description: article.description || article.summary || '',
      url: url,
      imageUrl: imageUrl,
      slug: article.slug,
    }),
  }).then(function (resp) {
    return resp.json().then(function (data) {
      if (!resp.ok || data.error) {
        return { ok: false, error: (data && data.error) || ('HTTP ' + resp.status) };
      }
      return { ok: true, postId: data.postId || '' };
    });
  }).catch(function (e) {
    return { ok: false, error: e.message || String(e) };
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Bài đủ điều kiện: facebook:true trong frontmatter + đã ở trong danh sách
// xuất bản hôm nay (đã qua bộ lọc publishDate ở readArticles) + CHƯA từng
// đăng FB (chống trùng qua .fb-posted.json). Bài chưa tới ngày không nằm
// trong "articles" nên tự nhiên chỉ được xét đúng lúc "vừa xuất bản".
async function postDueArticlesToFacebook(articles) {
  // trim() phòng trường hợp GitHub Actions secret bị dính khoảng trắng/xuống
  // dòng thừa lúc copy-paste — phải khớp trim() ở phía Cloud Function.
  var secret = (process.env.CAM_NANG_FB_SECRET || '').trim();
  var state = loadFbPostedState();
  var candidates = articles.filter(function (a) {
    return a.facebook === true && !state[a.slug];
  });

  if (!candidates.length) return { attempted: 0, failed: 0 };
  if (!secret) {
    console.error('::error::Có ' + candidates.length + ' bài Cẩm nang cần đăng Facebook nhưng thiếu env CAM_NANG_FB_SECRET — bỏ qua bước đăng FB (web vẫn xuất bản bình thường). Xem CHANGES.md để tạo secret.');
    return { attempted: 0, failed: candidates.length };
  }
  console.log('Đang gọi postCamNangToFacebook cho ' + candidates.length + ' bài — secret.length=' + secret.length + ' (chẩn đoán, không phải giá trị thật).');

  var failed = 0;
  for (var i = 0; i < candidates.length; i++) {
    var article = candidates[i];
    var result = await postArticleToFacebook(article, secret);
    if (result.ok) {
      state[article.slug] = { postedAt: new Date().toISOString(), fbPostId: result.postId || '' };
      console.log('Đã đăng Facebook: ' + article.slug + (result.postId ? ' (post ' + result.postId + ')' : ''));
    } else {
      failed++;
      var errText = typeof result.error === 'string' ? result.error : (result.error && result.error.message) || JSON.stringify(result.error);
      console.error('::error::Đăng Facebook thất bại cho bài "' + article.slug + '": ' + errText);
    }
    // Nghỉ giữa các lần đăng để tránh bị Facebook coi là spam khi nhiều bài cùng ngày.
    if (i < candidates.length - 1) await sleep(2000);
  }

  saveFbPostedState(state);
  return { attempted: candidates.length, failed: failed };
}

async function main() {
  var articles = readArticles();
  var removedCount = cleanupOrphanedArticles(articles);
  var articlesChanged = buildArticles(articles);
  var indexChanged = buildIndex(articles);
  var sitemapChanged = buildSitemap(articles);
  var robotsChanged = buildRobots();
  var homeChanged = buildHomeSection(articles);

  console.log('Cẩm nang build xong — ' + articles.length + ' bài.');
  console.log('  Bài viết đổi: ' + articlesChanged);
  console.log('  Bài gỡ (không còn xuất bản): ' + removedCount);
  console.log('  Trang danh mục đổi: ' + (indexChanged ? 'có' : 'không'));
  console.log('  home.html (khối 3 bài mới nhất) đổi: ' + (homeChanged ? 'có' : 'không'));
  console.log('  sitemap.xml đổi: ' + (sitemapChanged ? 'có' : 'không'));
  console.log('  robots.txt đổi: ' + (robotsChanged ? 'có' : 'không'));

  // Đăng Facebook chạy SAU CÙNG, sau khi web đã build xong — lỗi ở bước này
  // (token hết hạn, mạng lỗi...) không được phép chặn/ảnh hưởng phần web ở trên.
  var fbResult = await postDueArticlesToFacebook(articles);
  console.log('  Bài đăng Facebook: ' + fbResult.attempted + ' (lỗi: ' + fbResult.failed + ')');
  // Báo cho step sau của workflow biết có lỗi FB để hiện đỏ tab Actions —
  // KHÔNG exit(1) ở đây vì bước commit+push web phải chạy sau bước này trước đã.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'fb_failures=' + fbResult.failed + '\n');
  }
}

main().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
