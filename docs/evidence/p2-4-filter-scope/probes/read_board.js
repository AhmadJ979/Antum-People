(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var out={};
  var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
  var chips=btns.filter(function(b){return /^(All|IT|Admin|HR|Manager) \(\d+\)$/.test(norm(b.textContent));});
  out.chips=chips.map(function(b){return norm(b.textContent)+(/bg-slate-900/.test(String(b.className))?' [SELECTED]':'');});
  var hdr=Array.prototype.slice.call(document.querySelectorAll('div,span')).filter(function(el){return /^Workspace track/.test(norm(el.textContent)) && norm(el.textContent).length<120;});
  out.panel_header=hdr.length?norm(hdr[0].textContent):null;
  out.workspace_row=Array.prototype.slice.call(document.querySelectorAll('span,div')).filter(function(el){return /^Workspace:/.test(norm(el.textContent)) && norm(el.textContent).length<80;}).map(function(el){return norm(el.textContent);});
  out.line_meta_blocks=Array.prototype.slice.call(document.querySelectorAll('div,span')).filter(function(el){return /due D-/.test(norm(el.textContent));}).length;
  var refs=norm(document.body.textContent).match(/OFR-\d{4}-DEMO-\d+/g);
  out.refs_on_page=refs?Array.from(new Set(refs)):[];
  var b=window.__boards;
  out.payload_stashed=Boolean(b);
  if(b){out.payload_summary=Object.keys(b).map(function(ref){
    var m=b[ref], f=function(x){return x?{totals:x.totals,mode:x.view.mode,is_access_control:x.view.is_access_control,functions:x.available_functions.map(function(q){return q.function+':'+q.open;}),func_open_sum:x.available_functions.reduce(function(s,q){return s+q.open;},0)}:null;};
    return {ref:ref, all:f(m.all), IT:f(m.IT)};
  });}
  return out;
})()
