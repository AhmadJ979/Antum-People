(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
  var out={};
  out.rows=btns.filter(function(b){return /OFR-2026-DEMO/.test(norm(b.textContent));}).map(function(b){return norm(b.textContent);});
  out.h1=norm(document.querySelector('h1,h2')?document.querySelector('h1,h2').textContent:'');
  var scope=Array.prototype.slice.call(document.querySelectorAll('p')).map(function(p){return norm(p.textContent);}).filter(function(t){return /Derived from every item/.test(t);});
  out.scope_notes_distinct=Array.from(new Set(scope)).length;
  out.scope_note=scope[0]||null;
  var body=norm(document.body.innerText||document.body.textContent);
  out.jurisdiction_chips=['UAE','KSA'].filter(function(j){return body.indexOf(j)>=0;});
  out.counts=Array.from(new Set(body.match(/[0-9]+ (?:items|items outstanding|lines|of [0-9]+ done)/g)||[]));
  var m=body.match(/Workspace: [^·]*done[^·]*open/g)||[]; out.workspace_rows=m;
  return out;
})()
