/* identity2.js — added 2026-10-09, supersedes identity.js for the identity claim.
   Why identity.js is not enough: its dir_heading anchor (/Employee Directory/i over body text)
   matched the SIDEBAR nav label on all five surfaces, and its active_nav fallback listed the
   NON-clicked labels — two fields that would have let me caption the wrong screen. Diagnosis:
   the sidebar is a real <aside> (client/src/App.tsx:1080) wrapping a <nav> (:1108).
   What this does instead: reads only the CONTENT region (body clone with aside/nav/header
   removed) and returns its text. Identity is then established by cross-comparing the five
   captures of one pass — a screen-exclusive line is a fingerprint no click order can fake.
   Pure DOM read: no writes, no network, no storage access. */
(function(){
 var norm=function(s){return String(s==null?'':s).replace(/[ \t]+/g,' ').trim();};
 var clone=document.body.cloneNode(true);
 Array.prototype.forEach.call(clone.querySelectorAll('aside,nav,header,[role="navigation"]'),function(e){e.parentNode&&e.parentNode.removeChild(e);});
 var T=norm(clone.innerText||'');
 var lines=(clone.innerText||'').split('\n').map(norm).filter(function(x){return x.length>0;});
 var uniq=[]; lines.forEach(function(l){ if(uniq.indexOf(l)===-1) uniq.push(l); });
 return JSON.stringify({len:T.length, line_count:lines.length, lines:uniq.slice(0,45), head:T.slice(0,160)});
})()
