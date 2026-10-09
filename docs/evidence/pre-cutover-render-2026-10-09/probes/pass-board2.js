(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var want = window.__caseName || 'Omar Al-Farsi';
 var rows = Array.prototype.slice.call(document.querySelectorAll('div')).filter(function(e){
   return /bg-slate-50/.test(e.className) && /rounded-xl/.test(e.className) && /overflow-hidden/.test(e.className) && (e.innerText||'').indexOf(want)>=0;
 });
 var row = rows[0] || null;
 var txt = row ? norm(row.innerText) : '';
 var i = txt.toLowerCase().indexOf('workspace track');
 var region = i >= 0 ? txt.slice(i) : '';
 var groups = region.match(/(IT|Admin|HR|Manager) · \d+\/\d+/gi) || [];
 var ownerless = (region.match(/carry no owner field/g) || []).length;
 var h = 5381; for (var k = 0; k < region.length; k++) { h = ((h * 33) ^ region.charCodeAt(k)) >>> 0; }
 return JSON.stringify({
   case: want,
   row_found: !!row,
   region_found: i >= 0,
   groups: groups,
   group_count: groups.length,
   ownerless_lines: ownerless,
   region_len: region.length,
   region_fnv: h,
   region: region
 });
})()
