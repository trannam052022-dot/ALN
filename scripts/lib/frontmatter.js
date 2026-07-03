// Parser YAML tối giản cho frontmatter bài Cẩm nang — KHÔNG dùng thư viện ngoài.
// Chỉ hỗ trợ đúng tập con cần dùng: chuỗi (có/không quote), số, mảng inline
// [a, b, c] và mảng khối "- item". Không hỗ trợ YAML lồng nhau/map trong map.

function stripQuotes(s) {
  var t = s.trim();
  if ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'")) {
    // Trong chuỗi có quote, hỗ trợ \n thành xuống dòng thật (dùng cho ctaMid 2 dòng).
    return t.slice(1, -1).replace(/\\n/g, '\n');
  }
  return t;
}

function parseScalar(raw) {
  var t = raw.trim();
  if (t === '') return '';
  if (t[0] === '[' && t[t.length - 1] === ']') {
    var inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return splitTopLevelComma(inner).map(function (v) { return stripQuotes(v); });
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  return stripQuotes(t);
}

function splitTopLevelComma(s) {
  var out = [];
  var cur = '';
  var quote = null;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function parseFrontmatterYaml(yamlText) {
  var lines = yamlText.split('\n');
  var data = {};
  var i = 0;
  while (i < lines.length) {
    var line = lines[i];
    if (line.trim() === '') { i++; continue; }
    var m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    var key = m[1];
    var rest = m[2];
    if (rest.trim() === '') {
      // Có thể là mảng khối "- item" ở các dòng thụt lề tiếp theo
      var items = [];
      var j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(stripQuotes(lines[j].replace(/^\s*-\s+/, '')));
        j++;
      }
      data[key] = items;
      i = j;
    } else {
      data[key] = parseScalar(rest);
      i++;
    }
  }
  return data;
}

// Tách frontmatter (giữa 2 dòng "---") khỏi nội dung Markdown.
function parseMarkdownFile(raw) {
  var text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) {
    throw new Error('File .md thiếu frontmatter mở đầu bằng "---"');
  }
  var end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error('File .md thiếu dòng "---" đóng frontmatter');
  }
  var yamlText = text.slice(4, end);
  var body = text.slice(end + 5);
  return { data: parseFrontmatterYaml(yamlText), body: body.trim() };
}

module.exports = { parseMarkdownFile: parseMarkdownFile };
