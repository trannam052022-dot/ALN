/**
 * publish-thicong-scheduled.js — quét thicong/blog/_scheduled/, xuất bản mọi
 * bài đã tới ngày (giờ VN) sang vị trí live thicong/blog/<slug>/index.html,
 * cập nhật thicong/blog/index.html + thicong/sitemap.xml.
 *
 * Chạy bởi .github/workflows/auto-publish-thicong.yml (cron hàng ngày) hoặc
 * tay: node scripts/publish-thicong-scheduled.js
 *
 * Không tự sinh nội dung — chỉ MOVE file HTML đã có sẵn (do
 * scripts/gen-thicong-scheduled.js dựng từ nội dung Founder đã duyệt) sang
 * thư mục live. Nếu tên file sai định dạng hoặc ngày không hợp lệ, dừng và
 * báo lỗi rõ ràng thay vì đoán ý định (theo LENH_CODE_AUTO_PUBLISH_THICONG.md
 * mục 2).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCHEDULED_DIR = path.join(ROOT, "thicong", "blog", "_scheduled");
const BLOG_DIR = path.join(ROOT, "thicong", "blog");
const BLOG_INDEX = path.join(BLOG_DIR, "index.html");
const SITEMAP = path.join(ROOT, "thicong", "sitemap.xml");

const FNAME_RE = /^(\d{4})-(\d{2})-(\d{2})-([a-z0-9-]+)\.html$/;

function todayVN() {
  // GitHub Actions runner chạy UTC — quy đổi sang giờ VN (UTC+7) để so ngày.
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function extract(html, re, label) {
  const m = html.match(re);
  if (!m) throw new Error(`Không tìm thấy ${label} trong file HTML — dừng, kiểm tra lại file.`);
  return m[1];
}

function insertCard(indexHtml, { slug, tag, icon, title, desc }) {
  const marker = '<div class="cn-grid">';
  const idx = indexHtml.indexOf(marker);
  if (idx === -1) throw new Error("Không tìm thấy <div class=\"cn-grid\"> trong thicong/blog/index.html — cấu trúc trang đã đổi?");
  const insertAt = idx + marker.length;
  const card = `
      <a class="cn-card" href="${slug}/">
        <div class="cn-card-img"><i class="ph-duotone ${icon}" style="font-size:34px"></i></div>
        <div class="cn-card-body">
          <span class="tag-gold">${tag}</span>
          <h3>${title}</h3>
          <p>${desc}</p>
        </div>
      </a>
`;
  return indexHtml.slice(0, insertAt) + card + indexHtml.slice(insertAt);
}

function insertSitemapUrl(xml, { slug, date }) {
  const url = `  <url>
    <loc>https://applamnha.vn/thicong/blog/${slug}/</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  let out = xml.replace("</urlset>", url + "</urlset>");
  // Bump lastmod của trang danh sách blog + trang chủ thicong vì có bài mới.
  out = out.replace(
    /(<loc>https:\/\/applamnha\.vn\/thicong\/blog\/<\/loc>\s*<lastmod>)[^<]+(<\/lastmod>)/,
    `$1${date}$2`
  );
  out = out.replace(
    /(<loc>https:\/\/applamnha\.vn\/thicong\/<\/loc>\s*<lastmod>)[^<]+(<\/lastmod>)/,
    `$1${date}$2`
  );
  return out;
}

function main() {
  if (!fs.existsSync(SCHEDULED_DIR)) {
    console.log("Không có thư mục _scheduled — không có gì để đăng.");
    return { published: [] };
  }

  const today = todayVN();
  const files = fs.readdirSync(SCHEDULED_DIR).filter((f) => f.endsWith(".html"));

  const due = [];
  for (const f of files) {
    const m = f.match(FNAME_RE);
    if (!m) {
      throw new Error(`Tên file "${f}" trong _scheduled/ không đúng định dạng YYYY-MM-DD-slug.html — dừng lại, kiểm tra tay.`);
    }
    const [, y, mo, d, slug] = m;
    const date = `${y}-${mo}-${d}`;
    const dateObj = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(dateObj.getTime())) {
      throw new Error(`Ngày "${date}" trong tên file "${f}" không hợp lệ — dừng lại, kiểm tra tay.`);
    }
    if (date <= today) due.push({ file: f, date, slug });
  }

  due.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (due.length === 0) {
    console.log("Chưa có bài nào tới ngày đăng hôm nay (" + today + ").");
    return { published: [] };
  }

  let blogIndexHtml = fs.readFileSync(BLOG_INDEX, "utf8");
  let sitemapXml = fs.readFileSync(SITEMAP, "utf8");
  const published = [];

  for (const item of due) {
    const srcPath = path.join(SCHEDULED_DIR, item.file);
    const destDir = path.join(BLOG_DIR, item.slug);
    const destPath = path.join(destDir, "index.html");

    if (fs.existsSync(destPath)) {
      console.log(`Bỏ qua "${item.file}" — "${item.slug}/" đã tồn tại ở live (có thể đã đăng trước đó).`);
      continue;
    }

    const html = fs.readFileSync(srcPath, "utf8");
    const title = extract(html, /<title>([^<]+)<\/title>/, "title tag");
    const desc = extract(html, /<meta name="description" content="([^"]+)">/, "meta description");
    const metaMatch = html.match(/<!-- ALN-SCHEDULE-META: (\{[^}]+\}) -->/);
    if (!metaMatch) throw new Error(`File "${item.file}" thiếu comment ALN-SCHEDULE-META — không sinh bằng scripts/gen-thicong-scheduled.js?`);
    const meta = JSON.parse(metaMatch[1]);

    fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(srcPath, destPath);

    blogIndexHtml = insertCard(blogIndexHtml, {
      slug: item.slug,
      tag: meta.tag,
      icon: meta.icon,
      title: title.replace(/ \| ALN$/, ""),
      desc,
    });
    sitemapXml = insertSitemapUrl(sitemapXml, { slug: item.slug, date: item.date });

    published.push({ slug: item.slug, title, date: item.date });
    console.log(`Đã xuất bản: ${item.slug}/ (${item.date}) — ${title}`);
  }

  if (published.length > 0) {
    fs.writeFileSync(BLOG_INDEX, blogIndexHtml, "utf8");
    fs.writeFileSync(SITEMAP, sitemapXml, "utf8");
  } else {
    console.log("Không có bài nào mới cần xuất bản hôm nay.");
  }

  return { published };
}

if (require.main === module) {
  try {
    const { published } = main();
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `published_count=${published.length}\npublished_titles=${published.map((p) => p.title).join(" | ")}\n`
      );
    }
  } catch (err) {
    console.error("::error::" + err.message);
    process.exit(1);
  }
}

module.exports = { main };
