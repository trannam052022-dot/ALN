#!/usr/bin/env node
// Lint content ALN — chặn câu chữ vi phạm định vị thương hiệu (xem CLAUDE.md).
// KHÔNG dùng npm dependency ngoài, chỉ module built-in của Node.
//
// Chạy toàn bộ content công khai:  node scripts/lint-content.js
// Chạy trên file cụ thể:           node scripts/lint-content.js content/cam-nang/bai-moi.md
//
// Exit code: 0 = sạch (WARN vẫn = 0), 1 = có ERROR (vi phạm định vị).
//
// Hai mức:
//   ERROR — câu khẳng định ALN làm thi công / xây trọn gói / giữ tiền trung gian.
//           Vi phạm nguyên tắc "ALN là Tổng thầu THIẾT KẾ" → phải sửa mới được publish.
//   WARN  — cụm nhạy cảm nhưng có thể hợp lệ theo ngữ cảnh (vd bài SEO nói về
//           GIÁ trọn gói trên thị trường, hoặc "đơn vị thi công đối tác").
//           Người/Claude review từng dòng: chỉ cần đảm bảo KHÔNG gán cho ALN.
//
// exceptRe: dòng khớp regex này thì bỏ qua (phủ định "không...", "đối tác"...).

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

// Chủ thể ALN xuất hiện gần cụm cấm → thành ERROR
var ALN = '(ALN|App Làm Nhà|chúng tôi)';

var RULES = [
  // --- ERROR: khẳng định ALN thi công / trọn gói ---
  {
    re: new RegExp(ALN + '[^.!?\\n]{0,60}(là|nhận|cung cấp|triển khai)[^.!?\\n]{0,30}(nhà thầu|tổng thầu) thi công', 'i'),
    level: 'ERROR',
    note: 'ALN KHÔNG phải nhà thầu/tổng thầu thi công — chỉ là Tổng thầu Thiết kế.'
  },
  {
    re: new RegExp(ALN + '[^.!?\\n]{0,40}(là|nhận|làm|cung cấp|triển khai|thi công|xây)[^.!?\\n]{0,40}trọn gói', 'i'),
    level: 'ERROR',
    note: 'Không được nói ALN làm "trọn gói" — mảng thi công chưa được phép triển khai.',
    exceptRe: /không/i
  },
  {
    re: /giữ tiền trung gian|bên trung gian|giữ hộ tiền|giữ tiền hộ/i,
    level: 'ERROR',
    note: 'Cấm mô tả ALN kiểu "trung gian giữ tiền" — dùng câu chuẩn: "ALN ký hợp đồng trực tiếp, thanh toán theo Quy trình 4 bước đảm bảo (C1-C4)".',
    exceptRe: /không/i // phủ định ("không có bên thứ ba giữ tiền hộ") là hợp lệ
  },

  // --- WARN: cần review ngữ cảnh ---
  {
    re: /xây nhà trọn gói/i,
    level: 'WARN',
    note: 'SEO keyword hoặc nói về giá thị trường thì OK — miễn là KHÔNG gán cho ALN.'
  },
  {
    re: /(nhà thầu|tổng thầu) thi công/i,
    level: 'WARN',
    note: 'Nếu nhắc thi công, chủ thể phải là "đơn vị thi công đối tác" (khác ALN).',
    exceptRe: /đối tác/i
  }
];

// Content công khai cần lint (dashboard nội bộ như founder_panel/client_* không lint)
var SCAN_DIRS = ['content', 'cam-nang', 'thiet-ke-nha', 'mau', 'du-toan', 'features', 'kts', 'aln-giu-cho'];
var SCAN_ROOT_FILES = [
  'index.html', 'home.html', 'register.html', 'login.html',
  'kts-apply.html', 'dn-studio.html', 'designer-apply.html', 'ks-apply.html'
];
var SCAN_EXTRA = ['scripts/template-tinh.html', 'scripts/template-mau.html', 'scripts/template-dutoan.html'];

function walk(dir, out) {
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (ent) {
    var p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(html|md)$/i.test(ent.name)) out.push(p);
  });
  return out;
}

function defaultFileList() {
  var files = [];
  SCAN_DIRS.forEach(function (d) { walk(path.join(ROOT, d), files); });
  SCAN_ROOT_FILES.concat(SCAN_EXTRA).forEach(function (f) {
    var p = path.join(ROOT, f);
    if (fs.existsSync(p)) files.push(p);
  });
  return files;
}

function lintFile(file, counts) {
  var text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  var lines = text.split('\n');
  lines.forEach(function (line, i) {
    var lineHasError = false;
    RULES.forEach(function (rule) {
      if (!rule.re.test(line)) return;
      if (rule.exceptRe && rule.exceptRe.test(line)) return;
      // Dòng đã dính ERROR thì khỏi báo thêm WARN trùng
      if (rule.level === 'WARN' && lineHasError) return;
      if (rule.level === 'ERROR') lineHasError = true;
      counts[rule.level]++;
      var rel = path.relative(ROOT, file);
      console.log('[' + rule.level + '] ' + rel + ':' + (i + 1));
      console.log('    ' + line.trim().slice(0, 160));
      console.log('    → ' + rule.note);
    });
  });
}

var args = process.argv.slice(2);
var files = args.length
  ? args.map(function (f) { return path.resolve(f); })
  : defaultFileList();

var counts = { ERROR: 0, WARN: 0 };
files.forEach(function (f) { lintFile(f, counts); });

console.log('');
console.log('Lint content xong — ' + files.length + ' file, ' + counts.ERROR + ' ERROR, ' + counts.WARN + ' WARN.');
if (counts.ERROR > 0) {
  console.log('Có vi phạm định vị — sửa hết ERROR trước khi publish (xem CLAUDE.md).');
  process.exit(1);
}
