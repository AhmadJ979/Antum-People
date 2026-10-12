(function () {
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; };
  var btns = Array.from(document.querySelectorAll('button'));
  var nav = btns.find(function (b) { return txt(b) === 'Pre-boarding'; });
  if (!nav) return JSON.stringify({ clicked: null, buttons: btns.map(txt).slice(0, 25) });
  nav.click();
  return JSON.stringify({ clicked: 'Pre-boarding' });
})()
