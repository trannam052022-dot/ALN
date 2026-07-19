/* Floating badge "Mạng lưới Thiết bị - Vật tư ALN" — dùng chung trên nhiều trang (không có
   header/footer include trong site này). Style tự chứa (không phụ thuộc biến CSS
   của trang chủ) để tránh xung đột giữa các theme khác nhau của từng trang. */
(function(){
  if (document.getElementById('alnNccNetworkBadge')) return; // tránh chèn 2 lần

  var style = document.createElement('style');
  style.textContent =
    '.aln-ncc-badge{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:60;' +
      'display:flex;align-items:center;gap:10px;background:#0f2c52;color:#fff;text-decoration:none;' +
      'padding:12px 16px;border-radius:14px;box-shadow:0 4px 18px rgba(15,44,82,.28);' +
      'font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,"Inter",sans-serif}' +
    '.aln-ncc-badge .dot-wrap{position:relative;width:10px;height:10px;flex-shrink:0}' +
    '.aln-ncc-badge .dot-core{position:absolute;inset:0;border-radius:50%;background:#d4a017}' +
    '.aln-ncc-badge .dot-ring{position:absolute;inset:0;border-radius:50%;background:#d4a017;opacity:.55}' +
    '.aln-ncc-badge .txt{display:flex;flex-direction:column;line-height:1.25}' +
    '.aln-ncc-badge .txt strong{font-size:13px;font-weight:700}' +
    '.aln-ncc-badge .txt span{font-size:11px;color:#cfd8e3}' +
    '@media(prefers-reduced-motion:no-preference){.aln-ncc-badge .dot-ring{animation:aln-badge-ping 1.8s ease-out infinite}}' +
    '@keyframes aln-badge-ping{0%{transform:scale(1);opacity:.55}70%{transform:scale(2.6);opacity:0}100%{transform:scale(2.6);opacity:0}}' +
    '@media(max-width:640px){.aln-ncc-badge{right:12px;padding:11px;border-radius:50%}.aln-ncc-badge .txt{display:none}}';
  document.head.appendChild(style);

  var a = document.createElement('a');
  a.id = 'alnNccNetworkBadge';
  a.className = 'aln-ncc-badge';
  a.href = '/ncc-showcase.html';
  a.setAttribute('aria-label', 'Xem Mạng lưới Thiết bị - Vật tư ALN');
  a.innerHTML =
    '<span class="dot-wrap"><span class="dot-ring"></span><span class="dot-core"></span></span>' +
    '<span class="txt"><strong>Mạng lưới Thiết bị - Vật tư ALN</strong><span>Giá tận gốc, giao tận công trình</span></span>';
  document.body.appendChild(a);
})();
