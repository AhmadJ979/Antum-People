(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var containers = Array.prototype.slice.call(document.querySelectorAll('div')).filter(function(e){
   return /bg-slate-50/.test(e.className) && /rounded-xl/.test(e.className) && /overflow-hidden/.test(e.className);
 });
 var out = containers.map(function(e){
   var name = e.querySelector('.text-sm.font-bold');
   var spans = Array.prototype.slice.call(e.querySelectorAll('span')).map(function(s){return norm(s.textContent);}).filter(function(t){return t && t.length<40;});
   var raised = Array.prototype.slice.call(e.querySelectorAll('div')).filter(function(d){return /bg-amber-50|bg-rose-50/.test(d.className);})[0];
   var toggle = e.querySelector('button');
   return {
     candidate: name?norm(name.textContent):null,
     row_chips: spans.slice(0,6),
     toggle: toggle?norm(toggle.textContent).slice(0,20):null,
     raised_flag: raised?norm(raised.innerText):null
   };
 });
 return JSON.stringify({row_count:out.length, rows:out});
})()
