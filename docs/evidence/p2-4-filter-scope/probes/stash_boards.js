(function(){
  var t=localStorage.getItem('antum_token');
  var h={Authorization:'Bearer '+t};
  window.__boards=null;
  return fetch('/api/preboarding/cases',{headers:h}).then(function(r){return r.json();}).then(function(cs){
    var list=(cs&&cs.cases)?cs.cases:(Array.isArray(cs)?cs:[]);
    return Promise.all(list.filter(function(c){return c.jurisdiction==='AE';}).map(function(c){
      return fetch('/api/preboarding/cases/'+c.id+'/workspace',{headers:h}).then(function(r){return r.json();}).then(function(all){
        return fetch('/api/preboarding/cases/'+c.id+'/workspace?function=IT',{headers:h}).then(function(r){return r.json();}).then(function(it){
          window.__boards=window.__boards||{};
          window.__boards[c.offer_reference]={all:all,IT:it};
        });
      });
    }));
  }).then(function(){return 'stashed';});
})()
