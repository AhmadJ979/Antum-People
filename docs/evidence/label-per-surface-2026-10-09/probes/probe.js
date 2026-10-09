(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var T=document.body.innerText||''; var low=T.toLowerCase();
  var cnt=function(s){var n=0,i=0;while((i=low.indexOf(s,i))>=0){n++;i+=s.length;}return n;};
  var labels=[];
  Array.prototype.forEach.call(document.querySelectorAll('*'),function(e){
    if(e.children.length) return;
    var t=norm(e.textContent); if(!t) return;
    if(/illustrative|sample demo data/i.test(t)) labels.push(t);
  });
  var heads=[];
  Array.prototype.forEach.call(document.querySelectorAll('h1,h2,h3'),function(e){
    var t=norm(e.textContent); if(t) heads.push(t.slice(0,60));
  });
  return JSON.stringify({
    sidebar_clicked: window.__tab || null,
    len_T: T.length,
    sample_demo_data: cnt('sample demo data'),
    illustrative: cnt('illustrative'),
    labels: labels,
    headings: heads.slice(0,8),
    text_head: norm(T).slice(0,120)
  });
})()
