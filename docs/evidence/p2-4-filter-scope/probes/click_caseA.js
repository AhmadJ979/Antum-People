(function(){
  var ref='OFR-2026-DEMO-03';
  var t=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(b){return String(b.textContent).indexOf(ref)>=0;})[0];
  if(!t) return 'no row for '+ref;
  t.click(); return 'clicked row '+ref;
})()
