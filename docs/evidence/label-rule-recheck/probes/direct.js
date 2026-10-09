(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var direct=function(e){var t='';for(var n=e.firstChild;n;n=n.nextSibling){if(n.nodeType===3)t+=n.nodeValue;}return t;};
 var out=[];
 Array.prototype.forEach.call(document.querySelectorAll('*'),function(e){
   var d=norm(direct(e));
   if(d&&/illustrative|sample demo data/i.test(d)) out.push(d.slice(0,90));
 });
 return JSON.stringify({labels:out});
})()
