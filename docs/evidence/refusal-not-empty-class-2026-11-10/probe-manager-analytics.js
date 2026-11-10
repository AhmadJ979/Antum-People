(function(){
  var body = document.body.innerText || '';
  var nodes = [].slice.call(document.querySelectorAll('[data-refusal-panel]'));
  var refusal = nodes.map(function(n){ return n.getAttribute('data-refusal-panel') + ': ' + (n.innerText||'').trim().replace(/\s+/g,' '); });
  function has(s){ return body.indexOf(s) !== -1; }
  return JSON.stringify({
    url: location.href,
    viewport: window.innerWidth + 'x' + window.innerHeight,
    refusalNodes: refusal,
    hasBannerTitle: has('Strategic Workforce Intelligence'),
    hasRetentionClaim: has('Retention lift has stabilized'),
    hasTtvClaim: has('Average Time-to-Value is 0 days'),
    hasInsufficient: has('Insufficient productivity data'),
    hasForecastGrid: has('12-Month EOSB Liability Forecast'),
    h3s: [].slice.call(document.querySelectorAll('h3')).map(function(e){ return (e.innerText||'').trim(); }),
    bodyText: body
  }, null, 1);
})()
