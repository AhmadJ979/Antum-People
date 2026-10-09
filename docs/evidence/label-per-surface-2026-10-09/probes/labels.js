(function(){
  var out=[];
  var w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var n; while(n=w.nextNode()){
    var t=String(n.nodeValue||'').replace(/\s+/g,' ').trim();
    if(!t) continue;
    if(/illustrative|sample demo data/i.test(t)) out.push(t);
  }
  var heads=[];
  Array.prototype.forEach.call(document.querySelectorAll('h1,h2,h3,h4'),function(e){
    var t=String(e.textContent||'').replace(/\s+/g,' ').trim(); if(t) heads.push(t.slice(0,50));
  });
  return JSON.stringify({tab: window.__tab||null, label_text_nodes: out, n: out.length, headings: heads.slice(0,6)});
})()
