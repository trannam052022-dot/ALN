/* ALN — helper tracking dùng chung cho các trang phễu (kts-apply, index, forum,
   recruit, tuyen-kts, giữ chỗ). KHÔNG thay UTM/Pixel hiện có ở từng trang —
   chỉ bổ sung dataLayer cho các điểm chạm mới theo spec FB Pixel + UTM (2026-07-14).
   Load bằng <script src="aln-tracking.js"></script> (ES5, không optional chaining). */
(function(){

  window.alnAdTypeHint = function(){
    try{
      var ref = document.referrer || '';
      if (/m\.me|messenger\.com/i.test(ref)) return 'ctm';
      return 'unknown';
    }catch(e){ return 'unknown'; }
  };

  /* Bắn dataLayer khi cuộn qua các mốc % chiều cao trang (1 lần / mốc). */
  window.alnScrollDepth = function(pageLabel, thresholds){
    thresholds = thresholds || [25, 50, 75, 100];
    var fired = {};
    function check(){
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var height = doc.scrollHeight - doc.clientHeight;
      if (height <= 0) return;
      var pct = Math.round((scrollTop / height) * 100);
      for (var i = 0; i < thresholds.length; i++) {
        var t = thresholds[i];
        if (pct >= t && !fired[t]) {
          fired[t] = true;
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'aln_scroll_depth', aln_scroll_pct: t, aln_source_page: pageLabel });
        }
      }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
  };

  /* Bắn dataLayer khi video xem qua các mốc % thời lượng (1 lần / mốc / lượt tải trang). */
  window.alnVideoProgress = function(videoEl, label, thresholds){
    if (!videoEl) return;
    thresholds = thresholds || [25, 50, 75, 100];
    var fired = {};
    videoEl.addEventListener('timeupdate', function(){
      if (!videoEl.duration) return;
      var pct = Math.round((videoEl.currentTime / videoEl.duration) * 100);
      for (var i = 0; i < thresholds.length; i++) {
        var t = thresholds[i];
        if (pct >= t && !fired[t]) {
          fired[t] = true;
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'aln_video_progress', aln_video_pct: t, aln_video_label: label || '' });
        }
      }
    });
  };

})();
