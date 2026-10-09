/* identity.js — added 2026-10-09 (third cutover re-ground). Pure DOM read: no writes, no network.
   Purpose: let each capture name its own screen from the DOM, so "which surface was this?" is not
   an inference from the order the nav was clicked. Read alongside count.js, never instead of it:
   count.js/direct.js stay byte-identical so the sections of the register remain comparable. */
(function(){
 var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
 var T=document.body.innerText||'';
 var active=[];
 Array.prototype.forEach.call(document.querySelectorAll('button[aria-current],button[aria-selected],[aria-current="page"]'),function(e){
   var t=norm(e.innerText); if(t) active.push(t.slice(0,40));
 });
 if(!active.length) Array.prototype.forEach.call(document.querySelectorAll('nav button,nav a'),function(e){
   if(e.className&&/active|current|bg-(slate|indigo|blue)-/i.test(String(e.className))){var t=norm(e.innerText); if(t) active.push(t.slice(0,40));}
 });
 return JSON.stringify({
  len:T.length,
  active_nav:active.slice(0,3),
  anchors:{ /* one per screen; exactly the ones true should name the screen that was read */
    exec_onboarding:/Onboarding Pipeline/i.test(T),
    exec_offboarding:/Offboarding Pipeline/i.test(T),
    dir_heading:/Employee Directory/i.test(T),
    transitions_ramping:/Ramping/i.test(T),
    preboarding_heading:/Pre-boarding Intelligence/i.test(T),
    strategic_retention:/Retention Insight/i.test(T),
    strategic_forecast:/Illustrative forecast/i.test(T)
  },
  head:norm(T).slice(0,140)
 });
})()
