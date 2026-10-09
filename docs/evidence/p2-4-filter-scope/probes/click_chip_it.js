(function(){
  var t=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(b){return /^IT \(\d+\)$/.test(String(b.textContent).replace(/\s+/g,' ').trim());})[0];
  if(!t) return 'no IT chip';
  t.click(); return 'clicked IT chip';
})()
