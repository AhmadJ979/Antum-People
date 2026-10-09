(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var ps=Array.prototype.slice.call(document.querySelectorAll('p'));
  var out={};
  var stale=ps.filter(function(el){return String(el.textContent).indexOf('not built yet')>=0;})[0];
  var derived=ps.filter(function(el){return String(el.textContent).indexOf('Derived from every item')>=0;})[0];
  out.stale_para_present=Boolean(stale);
  out.stale_para_text=stale?norm(stale.textContent):null;
  out.derived_para_present=Boolean(derived);
  out.derived_para_text=derived?norm(derived.textContent):null;
  out.p_elements_on_screen=ps.length;
  var d=window.__p24||null;
  out.payload_loaded=Boolean(d);
  if(d&&d.cases&&d.cases.length){
    out.payload=norm(d.cases[0].flag.scope_note);
    out.payload_case=d.cases[0].offer_reference;
    out.distinct_scope_notes=Array.from(new Set(d.cases.map(function(c){return norm(c.flag.scope_note);}))).length;
    out.rendered_equals_payload=out.derived_para_text===out.payload;
  }
  return out;
})()
