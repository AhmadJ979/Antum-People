(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var all=function(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));};
  var mode=window.__mode||'nav';
  if(mode==='nav'){
    var w=window.__want;
    var scopes=[document.querySelector('nav'),document.querySelector('aside'),document].filter(Boolean);
    for(var s=0;s<scopes.length;s++){
      var cands=all('button,a,li,span,div',scopes[s]).filter(function(n){return n.children.length===0 && norm(n.textContent)===w;});
      if(cands.length){cands[0].click();return 'clicked nav:'+w+' (scope '+s+')';}
    }
    return 'NOT_FOUND nav:'+w;
  }
  if(mode==='row'){
    var nm=window.__caseName;
    var btns=all('button').filter(function(b){var t=norm(b.textContent);return t.indexOf(nm)>=0 && /Open|Close/.test(t);});
    if(!btns.length){btns=all('button').filter(function(b){return norm(b.textContent).indexOf(nm)>=0;});}
    if(!btns.length)return 'NOT_FOUND row:'+nm;
    btns[0].click();return 'clicked row:'+nm;
  }
  if(mode==='chip'){
    var c=window.__chip;
    var b=all('button').filter(function(x){var t=norm(x.textContent);return t===c || new RegExp('^'+c+' \\(\\d+\\)$').test(t);});
    if(!b.length)return 'NOT_FOUND chip:'+c;
    b[0].click();return 'clicked chip:'+c;
  }
  if(mode==='jur'){
    var j=window.__jur;
    var bj=all('button').filter(function(x){var t=norm(x.textContent);return t.indexOf(j)>=0 && t.length<12;});
    if(!bj.length)return 'NOT_FOUND jur:'+j;
    bj[0].click();return 'clicked jur:'+j;
  }
  return 'unknown mode:'+mode;
})()
