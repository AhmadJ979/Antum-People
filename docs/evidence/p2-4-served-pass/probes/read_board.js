(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var out={}; var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
  var chipRe=/^(All|IT|Admin|HR|Manager) \(\d+\)$/;
  var chips=btns.filter(function(b){return chipRe.test(norm(b.textContent));});
  out.chips=chips.map(function(b){return norm(b.textContent)+(/bg-slate-900/.test(String(b.className))?' [SELECTED]':'');});
  var panel=null, el=chips[0];
  for(var i=0;i<7 && el;i++){ el=el.parentElement; if(el && /Workspace track/.test(norm(el.textContent))) {panel=el; break;} }
  out.panel_found=Boolean(panel);
  out.panel_text=panel?norm(panel.innerText||panel.textContent).slice(0,3000):null;
  var due=Array.prototype.slice.call(document.querySelectorAll('div,span,li')).filter(function(e){return /D-\d/.test(norm(e.textContent)) && norm(e.textContent).length<160;});
  out.due_blocks=Array.from(new Set(due.map(function(e){return norm(e.textContent);}))).slice(0,30);
  out.rollup_rows=btns.filter(function(b){return /OFR-2026-DEMO/.test(norm(b.textContent));}).map(function(b){return norm(b.textContent);});
  var body=norm(document.body.innerText||document.body.textContent);
  out.body_len=body.length;
  out.track_count_texts=Array.from(new Set(body.match(/[0-9]+ of [0-9]+ done/g)||[]));
  out.items_texts=Array.from(new Set(body.match(/[0-9]+ (?:items outstanding|items verified|items|Without consent)/g)||[]));
  return out;
})()
