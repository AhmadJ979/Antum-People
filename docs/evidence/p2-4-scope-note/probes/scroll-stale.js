(function(){
  var ps=Array.prototype.slice.call(document.querySelectorAll('p'));
  var t=ps.filter(function(el){return String(el.textContent).indexOf('not built yet')>=0;})[0];
  if(!t) return 'no stale paragraph on screen';
  t.scrollIntoView({block:'center'});
  return 'scrolled to stale paragraph: '+String(t.className);
})()
