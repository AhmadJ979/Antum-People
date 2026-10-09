(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var d=window.__p24||null;
  var out={payload_loaded:Boolean(d)};
  var cases=(d&&d.cases)?d.cases:[];
  var payload=cases.length?norm(cases[0].flag.scope_note):null;
  out.payload=payload;
  out.payload_case=cases.length?cases[0].offer_reference:null;
  out.distinct_scope_notes=cases.length?Array.from(new Set(cases.map(function(c){return norm(c.flag.scope_note);}))).length:null;
  var ps=Array.prototype.slice.call(document.querySelectorAll('p'));
  out.p_elements_on_screen=ps.length;
  var hit=ps.filter(function(el){return norm(el.textContent)===payload;});
  out.paragraph_matches_payload=hit.length;
  var el=hit.length?hit[0]:null;
  out.dom_para=el?norm(el.textContent):null;
  out.identical=Boolean(el)&&out.dom_para===payload;
  out.para_class=el?String(el.className):null;
  var body=norm(document.body.textContent);
  out.body_contains_not_built_yet=body.indexOf('not built yet')>=0;
  out.body_contains_workspace_track=body.indexOf('workspace track')>=0;
  var i=body.indexOf('Derived from every item');
  out.body_slice_at_sentence=i>=0?body.slice(Math.max(0,i-100),i+260):null;
  return out;
})()
