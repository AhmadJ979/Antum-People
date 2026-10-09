(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var want=window.__caseName||'Omar Al-Farsi';
 var rows=Array.prototype.slice.call(document.querySelectorAll('div')).filter(function(e){
   return /bg-slate-50/.test(e.className)&&/rounded-xl/.test(e.className)&&/overflow-hidden/.test(e.className)&&(e.innerText||'').indexOf(want)>=0;});
 var row=rows[0];
 if(!row) return 'ROW_NOT_FOUND:'+want;
 var hasBoard=/workspace track/i.test(row.innerText||'');
 if(hasBoard) return 'already expanded';
 var btn=row.querySelector('button');
 if(!btn) return 'NO_BUTTON';
 btn.click();
 return 'clicked to expand';
})()
