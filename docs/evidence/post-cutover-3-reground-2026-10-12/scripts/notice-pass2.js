(function () {
  var p = window.__p || {};
  var mode = p.mode || 'page';
  var norm = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var btnState = function (b) { return norm(b.innerText) + (b.disabled ? ' [DISABLED]' : ' [enabled]') + (b.title ? ' title="' + b.title + '"' : ''); };
  var rowBtn = function (name) {
    return all('button').filter(function (b) { return norm(b.innerText).indexOf(name) === 0; })[0] || null;
  };

  if (mode === 'expand2') {
    var b = rowBtn(p.caseName);
    if (!b) return 'NO ROW BUTTON ' + p.caseName;
    if (p.closeFirst) {
      var other = rowBtn(p.closeFirst);
      if (other && norm(other.innerText).indexOf('Close') >= 0) { other.click(); }
    }
    var label = norm(b.innerText).slice(0, 60) + ' || tail: ' + norm(b.innerText).slice(-60);
    b.click();
    return 'clicked row toggle for ' + p.caseName + ' :: ' + label;
  }

  if (mode === 'page') {
    var body = norm(document.body.innerText);
    var i = p.anchor ? body.indexOf(p.anchor) : 0;
    if (i < 0) i = 0;
    var seg = body.slice(i, i + (p.len || 3000));
    return JSON.stringify({
      url: location.pathname,
      buttons: all('button').map(btnState).filter(function (t) { return t.length < 120; }),
      segment: seg
    });
  }

  if (mode === 'click') {
    var target = all('button').filter(function (x) { return new RegExp(p.re).test(norm(x.innerText)); })[0];
    if (!target) return 'NO BUTTON matching ' + p.re;
    if (target.disabled) return 'DISABLED: ' + btnState(target);
    target.click();
    return 'clicked: ' + btnState(target);
  }

  if (mode === 'itemrow') {
    var rows = all('div').filter(function (e) {
      return /justify-between/.test(e.className) && /rounded-lg/.test(e.className) && norm(e.innerText).indexOf(p.itemLabel) >= 0;
    });
    if (!rows.length) return 'NO ITEM ROW ' + p.itemLabel;
    var r = rows[0];
    return JSON.stringify({ item: p.itemLabel, text: norm(r.innerText), buttons: all('button', r).map(btnState) });
  }

  if (mode === 'itemreq') {
    var rows2 = all('div').filter(function (e) {
      return /justify-between/.test(e.className) && /rounded-lg/.test(e.className) && norm(e.innerText).indexOf(p.itemLabel) >= 0;
    });
    if (!rows2.length) return 'NO ITEM ROW ' + p.itemLabel;
    var rb = all('button', rows2[0]).filter(function (x) { return norm(x.innerText) === p.button; })[0];
    if (!rb) return 'NO BUTTON ' + p.button + ' in ' + p.itemLabel;
    if (rb.disabled) return 'DISABLED: ' + btnState(rb);
    rb.click();
    return 'clicked ' + p.button + ' on ' + p.itemLabel;
  }

  if (mode === 'modal') {
    var m = document.querySelector('[role="dialog"]') || all('div').filter(function (e) { return /fixed/.test(e.className) && /inset-0/.test(e.className); })[0];
    return m ? norm(m.innerText).slice(0, 1200) : 'NO MODAL';
  }

  return 'UNKNOWN ' + mode;
})()
