(function () {
  var clean = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; };
  var out = {};
  var h4s = Array.from(document.querySelectorAll('h4'));
  var panel = h4s.find(function (h) { return /HR roll-up/i.test(clean(h)); });
  out.panelHeading = clean(panel);
  var card = panel ? panel.closest('div.bg-white') : null;
  var grid = card ? card.querySelector('.grid') : null;
  out.tiles = grid ? Array.from(grid.children).map(function (c) {
    return { number: clean(c.children[0]), label: clean(c.children[1]) };
  }) : null;

  // the accessibility/DOM view: exact textContent, then the rendered innerText
  var labels = Array.from(document.querySelectorAll('div')).filter(function (d) {
    return /notice not shown/i.test(d.textContent || '') && d.children.length === 0;
  }).map(clean);
  out.exactLabelNodes = labels;
  var body = document.body.innerText || '';
  out.retiredWordingOnScreen = /WITHOUT CONSENT|without consent/i.test(body);
  out.newLabelOnScreenIgnoreCase = /cases · notice not shown/i.test(body);
  out.linesWithNotice = (body.match(/[^\n]*notice not shown[^\n]*/gi) || []).slice(0, 6);
  out.casesOpenHeader = (body.match(/[^\n]*CASES OPEN[^\n]*/i) || []).slice(0, 2);
  return JSON.stringify(out, null, 1);
})()
