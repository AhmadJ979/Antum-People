(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
  var chipRe=/^(All|IT|Admin|HR|Manager) \(\d+\)$/;
  var chips=btns.filter(function(b){return chipRe.test(norm(b.textContent));});
  var out={chips:chips.map(function(b){return norm(b.textContent)+(/bg-slate-900/.test(String(b.className))?'[SEL]':'');})};
  var panel=null, el=chips[0];
  for(var i=0;i<7&&el;i++){el=el.parentElement; if(el&&/Workspace track/.test(norm(el.textContent))){panel=el;break;}}
  var pt=panel?norm(panel.innerText):'';
  out.panel_len=pt.length; out.panel_full=pt.slice(0,9000);
  var m=pt.match(/MANAGER · [^]*?(?=$)/);
  out.manager_tail=pt.slice(pt.indexOf('MANAGER'));
  out.dates=[];
  (pt.match(/due \d{4}-\d{2}-\d{2} \(D-\d\)/g)||[]).forEach(function(d){ if(out.dates.indexOf(d)<0) out.dates.push(d); });
  var bodies=Array.prototype.slice.call(document.querySelectorAll('p,div,span')).map(function(e){return norm(e.textContent);}).filter(function(t){return /items still open, with|start in 48 hours or less|These were due before day one/.test(t)&&t.length<160;});
  out.flag_bodies=Array.from(new Set(bodies));
  var consent=Array.prototype.slice.call(document.querySelectorAll('p,div,span')).map(function(e){return norm(e.textContent);}).filter(function(t){return /No PDPL consent record/.test(t)&&t.length<160;});
  out.consent_texts=Array.from(new Set(consent)).length;
  return out;
})()
