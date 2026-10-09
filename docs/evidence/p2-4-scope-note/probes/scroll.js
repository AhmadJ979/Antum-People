(function(){
  var ps=Array.prototype.slice.call(document.querySelectorAll('p'));
  var t=ps.filter(function(el){return String(el.textContent).indexOf('Derived from every item')>=0;})[0];
  if(!t) return 'no paragraph on screen';
  t.scrollIntoView({block:'center'});
  return 'scrolled to: '+String(t.className);
})()
