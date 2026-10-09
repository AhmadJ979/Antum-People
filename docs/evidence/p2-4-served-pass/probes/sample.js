(function(){var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
var chipRe=/^(All|IT|Admin|HR|Manager) \(\d+\)$/;
var chips=btns.filter(function(b){return chipRe.test(norm(b.textContent));}).map(function(b){return norm(b.textContent)+(/bg-slate-900/.test(String(b.className))?'[SEL]':'');});
var panel=null, el=btns.filter(function(b){return chipRe.test(norm(b.textContent));})[0];
for(var i=0;i<7&&el;i++){el=el.parentElement; if(el&&/Workspace track/.test(norm(el.textContent))){panel=el;break;}}
var pt=panel?norm(panel.innerText):'';
var groups=['IT · 0/6','IT · 0/5','ADMIN · 0/3','HR · 0/2','MANAGER · 0/4'].filter(function(g){return pt.indexOf(g)>=0;});
var s={t:Date.now()%100000, chips:chips, groups:groups, head:pt.slice(0,60)};
window.__samples.push(s); return s;})()
