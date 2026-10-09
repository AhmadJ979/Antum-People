(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var T=document.body.innerText||''; var low=T.toLowerCase();
 var cnt=function(s){var n=0,i=0;while((i=low.indexOf(s,i))>=0){n++;i+=s.length;}return n;};
 var hits=[];
 Array.prototype.forEach.call(document.querySelectorAll('*'),function(e){
   if(e.children.length) return;
   var t=norm(e.textContent); if(!t) return;
   if(/illustrative|sample demo data/i.test(t)){
     var h='',p=e; while(p&&!h){p=p.parentElement; if(!p)break; var hh=p.querySelector('h1,h2,h3,h4'); if(hh) h=norm(hh.textContent).slice(0,50);}
     hits.push({text:t.slice(0,80),near:h});
   }
 });
 return JSON.stringify({screen:norm((document.querySelector('h1,h2')||{}).textContent).slice(0,50),len:T.length,
  sample:cnt('sample demo data'),ill:cnt('illustrative'),ill_caps:cnt('Illustrative'),
  sample_caps:cnt('Sample Demo Data'),hits:hits});
})()
