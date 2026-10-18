/* Small toolkit shared by every interactive widget. */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i]; if (c == null) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c) el.appendChild(c); }
    return el;
  }
  function svg(w, hgt, extra) {
    var el = s('svg', Object.assign({ viewBox: '0 0 ' + w + ' ' + hgt, width: w, height: hgt, role: 'img' }, extra || {}));
    el.style.maxWidth = '100%'; el.style.height = 'auto';
    return el;
  }
  function arrowDefs(el, id, cls) {
    var defs = s('defs');
    var m = s('marker', { id: id || 'ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    m.appendChild(s('path', { d: 'M0 0L10 5L0 10z', class: cls || 'f-ink' }));
    defs.appendChild(m); el.appendChild(defs);
    return 'url(#' + (id || 'ah') + ')';
  }
  var uid = 0;
  function id(prefix) { uid++; return (prefix || 'w') + uid; }

  /* frame: standard widget chrome */
  function frame(el, title, hint) {
    el.innerHTML = '';
    var wg = h('div', { class: 'wg' });
    var head = h('div', { class: 'wg-head' }, h('h4', { text: title }), hint ? h('span', { class: 'hint', text: hint }) : null);
    var body = h('div', { class: 'wg-body' });
    var ctrl = h('div', { class: 'wg-ctrl' });
    var stage = h('div', { class: 'wg-stage' });
    var out = h('div', { class: 'wg-out' });
    var note = h('div', { class: 'wg-note' });
    body.appendChild(ctrl); body.appendChild(stage); body.appendChild(out); body.appendChild(note);
    wg.appendChild(head); wg.appendChild(body); el.appendChild(wg);
    return { root: wg, body: body, ctrl: ctrl, stage: stage, out: out, note: note };
  }

  function slider(parent, o) {
    var inputId = id('rng');
    var input = h('input', { type: 'range', id: inputId, min: o.min, max: o.max, step: o.step || 1, value: o.value });
    var outp = h('output', { for: inputId, text: (o.fmt || String)(o.value) });
    var lab = h('label', { for: inputId }, o.label, input, outp);
    input.addEventListener('input', function () { outp.textContent = (o.fmt || String)(+input.value); o.on(+input.value); });
    parent.appendChild(lab);
    return { input: input, set: function (v) { input.value = v; outp.textContent = (o.fmt || String)(v); } };
  }
  function number(parent, o) {
    var inputId = id('num');
    var input = h('input', { type: 'number', id: inputId, min: o.min, max: o.max, step: o.step || 'any', value: o.value });
    if (o.width) input.style.width = o.width;
    input.addEventListener('input', function () { var v = parseFloat(input.value); if (!isNaN(v)) o.on(v); });
    parent.appendChild(h('label', { for: inputId }, o.label, input, o.unit ? h('span', { text: o.unit }) : null));
    return input;
  }
  function select(parent, o) {
    var inputId = id('sel');
    var sel = h('select', { id: inputId });
    o.options.forEach(function (op) { var v = Array.isArray(op) ? op[0] : op; var t = Array.isArray(op) ? op[1] : op; sel.appendChild(h('option', { value: v, text: t })); });
    sel.value = o.value;
    sel.addEventListener('change', function () { o.on(sel.value); });
    parent.appendChild(h('label', { for: inputId }, o.label, sel));
    return sel;
  }
  function seg(parent, o) {
    var wrap = h('div', { class: 'seg', role: 'group', 'aria-label': o.label || 'Options' });
    var btns = o.options.map(function (op) {
      var v = Array.isArray(op) ? op[0] : op; var t = Array.isArray(op) ? op[1] : op;
      var b = h('button', { type: 'button', 'aria-pressed': v === o.value ? 'true' : 'false', text: t });
      b.addEventListener('click', function () { btns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); o.on(v); });
      wrap.appendChild(b); return b;
    });
    if (o.label && o.showLabel) parent.appendChild(h('label', null, o.label, wrap)); else parent.appendChild(wrap);
    return { set: function (v) { btns.forEach(function (b, i) { var ov = o.options[i]; ov = Array.isArray(ov) ? ov[0] : ov; b.setAttribute('aria-pressed', ov === v ? 'true' : 'false'); }); } };
  }
  function button(parent, text, on, primary) {
    var b = h('button', { type: 'button', class: 'btn' + (primary ? ' primary' : ''), text: text });
    b.addEventListener('click', on); parent.appendChild(b); return b;
  }
  function stat(parent, label, cls) {
    var b = h('b', { text: '–' });
    parent.appendChild(h('div', { class: 'stat ' + (cls || '') }, h('span', { text: label }), b));
    return function (v) { b.textContent = v; };
  }
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '–';
    if (Math.abs(n) >= 1e6 && d == null) return n.toLocaleString('en-US');
    return (d != null ? n.toFixed(d) : Math.round(n * 100) / 100).toLocaleString('en-US');
  }
  function bytes(b) {
    var u = ['B', 'KB', 'MB', 'GB', 'TB']; var i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return (b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + ' ' + u[i];
  }
  /* a play/step/reset controller for step-based animations */
  function player(parent, o) {
    var t = 0, timer = null;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var bPlay = button(parent, 'Play', function () { timer ? stop() : play(); }, true);
    var bStep = button(parent, 'Step', function () { stop(); step(); });
    var bBack = o.back !== false ? button(parent, 'Back', function () { stop(); if (t > 0) { t--; o.render(t); } }) : null;
    var bReset = button(parent, 'Reset', function () { stop(); t = 0; o.render(t); });
    function step() { if (t < o.max()) { t++; o.render(t); } else stop(); }
    function play() {
      if (t >= o.max()) { t = 0; o.render(t); }
      bPlay.textContent = 'Pause';
      timer = setInterval(step, reduce ? 900 : (o.interval || 700));
    }
    function stop() { if (timer) clearInterval(timer); timer = null; bPlay.textContent = 'Play'; }
    return { reset: function () { stop(); t = 0; o.render(0); }, get t() { return t; }, set: function (v) { t = v; o.render(t); }, stop: stop };
  }
  /* rect cell with centered text */
  function cell(g, x, y, w, hh, text, cls, tcls) {
    g.appendChild(s('rect', { x: x, y: y, width: w, height: hh, rx: 3, class: cls || 'f-surf s-line w1' }));
    if (text != null && text !== '') g.appendChild(s('text', { x: x + w / 2, y: y + hh / 2 + 4, 'text-anchor': 'middle', class: tcls || 't-md t-mono', text: String(text) }));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  window.K = { h: h, s: s, svg: svg, arrowDefs: arrowDefs, id: id, frame: frame, slider: slider, number: number, select: select, seg: seg, button: button, stat: stat, fmt: fmt, bytes: bytes, player: player, cell: cell, clear: clear };
})();
