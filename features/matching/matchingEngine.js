/* ALN Matching Engine — Layer 1 (Province-based, no Maps API needed) */
(function(){
  var NEARBY_MAP = {
    HCM:   ['BD','DNai','BR-VT','LA','TG'],
    HN:    ['HP','NA','TH'],
    DN:    ['KH','BDinh'],
    CT:    ['AG','KG','TG','LA'],
    HP:    ['HN','NA'],
    BD:    ['HCM','DNai','LA'],
    DNai:  ['HCM','BD','BR-VT'],
    'BR-VT': ['HCM','DNai'],
    LA:    ['HCM','CT','TG'],
    TG:    ['HCM','CT','LA'],
    AG:    ['CT','KG'],
    KG:    ['CT','AG'],
    KH:    ['DN','BDinh','DL'],
    BDinh: ['DN','KH'],
    DL:    ['KH'],
    NA:    ['HN','TH'],
    TH:    ['HN','NA'],
  };

  var PROV_LABEL = {
    HCM:'TP. Hồ Chí Minh', HN:'Hà Nội', DN:'Đà Nẵng', CT:'Cần Thơ',
    HP:'Hải Phòng', BD:'Bình Dương', DNai:'Đồng Nai', 'BR-VT':'Vũng Tàu',
    LA:'Long An', TG:'Tiền Giang', AG:'An Giang', KG:'Kiên Giang',
    DL:'Đắk Lắk', KH:'Khánh Hòa', BDinh:'Bình Định', NA:'Nghệ An',
    TH:'Thanh Hóa', OTHER:'Tỉnh khác'
  };

  /* Trả về tỉnh hiện tại của KTS: tạm thời (nếu còn hiệu lực) hoặc gốc */
  function effectiveProvince(kts) {
    var tl = kts.temporaryLocation;
    if (tl && tl.province) {
      var untilMs = tl.until
        ? (tl.until.seconds ? tl.until.seconds * 1000 : +new Date(tl.until))
        : 0;
      if (untilMs > Date.now()) return tl.province;
    }
    return kts.homeProvince || kts.province || '';
  }

  function proximityScore(homeProvince, meetProvince) {
    if (!homeProvince || !meetProvince) return 20;
    if (homeProvince === meetProvince) return 100;
    var nearby = NEARBY_MAP[meetProvince] || [];
    return nearby.indexOf(homeProvince) >= 0 ? 60 : 20;
  }

  function scoreKts(kts, meetProvince) {
    var prox   = proximityScore(effectiveProvince(kts), meetProvince);
    var rating = Math.min(5, Math.max(0, kts.rating || 3)) / 5 * 100;
    // weights: proximity 40%, rating 60%
    return Math.round(prox * 0.4 + rating * 0.6);
  }

  function rankKts(ktsList, meetProvince, limit) {
    return ktsList
      .map(function(k){
        return {
          kts: k,
          score: scoreKts(k, meetProvince),
          effectiveProv: effectiveProvince(k),
        };
      })
      .sort(function(a, b){ return b.score - a.score; })
      .slice(0, limit || 5);
  }

  window.ALNMatching = {
    rankKts: rankKts,
    effectiveProvince: effectiveProvince,
    PROV_LABEL: PROV_LABEL,
    NEARBY_MAP: NEARBY_MAP,
  };
})();
