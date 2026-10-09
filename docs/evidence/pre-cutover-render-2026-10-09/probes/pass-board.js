(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var want = window.__caseName || 'Omar Al-Farsi';
 var rows = Array.prototype.slice.call(document.querySelectorAll('div')).filter(function(e){
   return /bg-slate-50/.test(e.className) && /rounded-xl/.test(e.className) && /overflow-hidden/.test(e.className) && (e.innerText||'').indexOf(want)>=0;
 });
 var row = rows[0] || null;
 var btns = row ? Array.prototype.slice.call(row.querySelectorAll('button')).map(function(b){return norm(b.textContent);}) : [];
 var chips = btns.filter(function(t){return /^(All|IT|Admin|HR|Manager)( \(\d+\))?$/.test(t);});
 var txt = row ? norm(row.innerText) : '';
 var i = txt.indexOf('Workspace track');
 var region = i >= 0 ? txt.slice(i) : '';
 var groups = region.match(/(IT|Admin|HR|Manager) · \d+\/\d+/g) || [];
 var selected = Array.prototype.slice.call(row ? row.querySelectorAll('button') : []).filter(function(b){
   return /bg-slate-900/.test(b.className);
 }).map(function(b){return norm(b.textContent);});
 var h = 5381; for (var k = 0; k < region.length; k++) { h = ((h * 33) ^ region.charCodeAt(k)) >>> 0; }
 return JSON.stringify({
   case: want,
   row_found: !!row,
   chips: chips,
   chip_selected_dark: selected,
   panel_head: (region.match(/Workspace track[^]{0,110}/)||[])[0] || null,
   function_groups: groups,
   board_region_len: region.length,
   board_region_fnv: h,
   board_region: region
 });
})()
