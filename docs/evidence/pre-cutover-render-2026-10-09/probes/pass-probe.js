(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var it=document.body.innerText||'';
 var tc=document.body.textContent||'';
 var lowI=it.toLowerCase(), lowT=tc.toLowerCase();
 var cnt=function(hay,s){var n=0,i=0;while((i=hay.indexOf(s,i))>=0){n++;i+=s.length;}return n;};
 var labels=[];
 Array.prototype.forEach.call(document.querySelectorAll('*'),function(e){
   if(e.children.length) return;
   var t=norm(e.textContent); if(!t) return;
   if(/illustrative|sample demo data/i.test(t)) labels.push(t);
 });
 var heads=[];
 Array.prototype.forEach.call(document.querySelectorAll('h1,h2,h3,h4'),function(e){var t=norm(e.textContent); if(t) heads.push(t.slice(0,60));});
 var scr=document.querySelector('script[src*="/assets/"]');
 var navItems=[];
 Array.prototype.forEach.call(document.querySelectorAll('nav button, nav a, aside button, aside a'),function(e){var t=norm(e.textContent); if(t&&t.length<40) navItems.push(t);});
 var refs=[]; var m=it.match(/OFR-[A-Z0-9-]+/g)||[]; m.forEach(function(x){ if(refs.indexOf(x)<0) refs.push(x); });
 var tiles={};
 Array.prototype.forEach.call(document.querySelectorAll('div'),function(e){
   if(e.children.length) return;
   var t=norm(e.textContent);
   if(/^(Cases open|Items outstanding|Items verified|Without consent|Total Outstanding|Verified Items)$/.test(t)){
     var prev=e.previousElementSibling; tiles[t]= prev?norm(prev.textContent):null;
   }
 });
 var btnShort=[];
 Array.prototype.forEach.call(document.querySelectorAll('button'),function(b){var t=norm(b.textContent); if(t&&t.length<24) btnShort.push(t);});
 var caseNames=(it.match(/(Omar Al-Farsi|Mariam Al-Kaabi|Yousef Al-Hammadi)/g)||[]).filter(function(x,i,a){return a.indexOf(x)===i;});
 return JSON.stringify({
   page_url:location.href,
   page_title:document.title,
   page_script_src:scr?scr.getAttribute('src'):null,
   headings:heads.slice(0,6),
   nav_items:navItems,
   len_innerText:it.length,
   len_textContent:tc.length,
   sample_demo_data_innerText:cnt(lowI,'sample demo data'),
   illustrative_innerText:cnt(lowI,'illustrative'),
   sample_demo_data_textContent:cnt(lowT,'sample demo data'),
   illustrative_textContent:cnt(lowT,'illustrative'),
   illustrative_caps_innerText:cnt(it,'Illustrative'),
   sample_caps_innerText:cnt(it,'Sample Demo Data'),
   labels:labels,
   tiles:tiles,
   buttons_short:btnShort.slice(0,25),
   case_names:caseNames,
   ofr_refs:refs,
   text_head:norm(it).slice(0,150)
 });
})()
