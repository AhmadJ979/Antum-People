(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
  return {title:document.title, on_login: /Sign in|Password|Username/i.test(norm(document.body.textContent).slice(0,400)),
    n_buttons:btns.length, nav:btns.map(function(b){return norm(b.textContent);}).filter(function(t){return t.length<30;}).slice(0,10),
    rows:btns.filter(function(b){return /OFR-2026-DEMO/.test(norm(b.textContent));}).length,
    token_len:(localStorage.getItem('antum_token')||'').length,
    body_head:norm(document.body.textContent).slice(0,220)};
})()
