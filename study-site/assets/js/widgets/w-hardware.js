/* Widgets for Part II: systolic arrays, dataflows, row stationary, RLC, pruning; plus a generic bar chart. */
(function () {
  'use strict';
  var h = K.h, s = K.s;

  /* ---------- generic horizontal bar chart (used for breakdowns and results) ---------- */
  CSO.widget('bars', function (el, o) {
    var f = K.frame(el, o.title || 'Chart', o.hint || '');
    f.ctrl.remove(); f.out.remove();
    var items = o.items || [], max = o.max || Math.max.apply(null, items.map(function (i) { return i[1]; }));
    var lw = o.labelWidth || 170, bw = o.barWidth || 360, row = 30;
    var sv = K.svg(lw + bw + 90, items.length * row + 10);
    items.forEach(function (it, i) {
      var y = 6 + i * row, w = Math.max(2, bw * it[1] / max);
      sv.appendChild(s('text', { x: lw - 8, y: y + 15, 'text-anchor': 'end', class: 't-sm', text: it[0] }));
      sv.appendChild(s('rect', { x: lw, y: y + 2, width: bw, height: 18, rx: 3, class: 'f-panel' }));
      sv.appendChild(s('rect', { x: lw, y: y + 2, width: w, height: 18, rx: 3, class: { c: 'f-c', m: 'f-m', v: 'f-v' }[it[2]] || 'f-mut' }));
      sv.appendChild(s('text', { x: lw + w + 6, y: y + 15, class: 't-sm t-mono', text: (it[3] || (it[1] + (o.unit || ''))) }));
    });
    f.stage.appendChild(sv);
    if (o.note) f.note.innerHTML = o.note; else f.note.remove();
  });

  /* ---------- systolic array ---------- */
  CSO.widget('systolic', function (el, o) {
    var f = K.frame(el, 'Systolic matrix multiply, cycle by cycle', 'A flows right, B flows down, each PE multiplies and accumulates');
    var st = { N: o.N || 3 };
    K.select(f.ctrl, { label: 'Array', value: String(st.N), options: [['3', '3×3'], ['4', '4×4']], on: function (v) { st.N = +v; pl.reset(); } });
    var setC = K.stat(f.out, 'Clock cycle', 'v');
    var setD = K.stat(f.out, 'Cycles to finish = 3N − 2', 'c');
    var setB = K.stat(f.out, 'Busy PEs this cycle', 'm');
    function A(i, k) { return ((i + 1) * (k + 2)) % 5 + 1; }
    function B(k, j) { return ((k + 1) + 2 * (j + 1)) % 4 + 1; }
    var sv = K.svg(620, 360); f.stage.appendChild(sv);
    var pl = K.player(f.ctrl, { max: function () { return 3 * st.N - 2; }, render: render, interval: 900 });
    function render(t) {
      K.clear(sv); K.arrowDefs(sv, 'ah-sys', 'f-mut');
      var N = st.N, P = N === 3 ? 74 : 60, ox = 170, oy = 110, busy = 0;
      sv.setAttribute('viewBox', '0 0 ' + (ox + N * P + 140) + ' ' + (oy + N * P + 20));
      // B queue above
      for (var j = 0; j < N; j++) {
        for (var q = 0; q < N + N - 1; q++) {
          var k = (t + q) - j; // value that will enter column j after q more cycles
          var kk = t + q - j; var idx = kk; // k index arriving at row 0 at cycle t+q+1
          var kin = t + q - j;
          if (kin >= 0 && kin < N && q < 3) {
            var yy = oy - 26 - q * 26;
            K.cell(sv, ox + j * P + P / 2 - 15, yy, 30, 22, B(kin, j), 'f-vs s-v w1', 't-sm t-mono');
          }
        }
        sv.appendChild(s('text', { x: ox + j * P + P / 2, y: 14, 'text-anchor': 'middle', class: 't-sm t-v', text: 'col ' + j + ' of B' }));
      }
      for (var i = 0; i < N; i++) {
        for (q = 0; q < 3; q++) {
          kin = t + q - i;
          if (kin >= 0 && kin < N) K.cell(sv, ox - 42 - q * 36, oy + i * P + P / 2 - 11, 32, 22, A(i, kin), 'f-ms s-m w1', 't-sm t-mono');
        }
        sv.appendChild(s('text', { x: 6, y: oy + i * P + P / 2 + 4, class: 't-sm t-m', text: 'row ' + i + ' of A' }));
      }
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
        var acc = 0, cur = null;
        for (var c = 1; c <= t; c++) { var kk2 = c - 1 - i - j; if (kk2 >= 0 && kk2 < N) { acc += A(i, kk2) * B(kk2, j); if (c === t) cur = kk2; } }
        var x = ox + j * P, y = oy + i * P, done = t >= i + j + N;
        if (cur != null) busy++;
        sv.appendChild(s('rect', { x: x + 4, y: y + 4, width: P - 8, height: P - 8, rx: 6, class: cur != null ? 'f-cs s-c w2' : (done ? 'f-surf s-c w1' : 'f-surf s-line w1') }));
        sv.appendChild(s('text', { x: x + P / 2, y: y + 20, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'PE' + i + j }));
        if (cur != null) sv.appendChild(s('text', { x: x + P / 2, y: y + P / 2 + 3, 'text-anchor': 'middle', class: 't-sm t-mono', text: A(i, cur) + '×' + B(cur, j) }));
        sv.appendChild(s('text', { x: x + P / 2, y: y + P - 12, 'text-anchor': 'middle', class: 't-md t-mono t-b' + (done ? ' t-c' : ''), text: acc }));
        if (j < N - 1) sv.appendChild(s('line', { x1: x + P - 4, y1: y + P / 2 + 14, x2: x + P + 4, y2: y + P / 2 + 14, class: 's-mut w1', 'marker-end': 'url(#ah-sys)' }));
        if (i < N - 1) sv.appendChild(s('line', { x1: x + P / 2 + 18, y1: y + P - 4, x2: x + P / 2 + 18, y2: y + P + 4, class: 's-mut w1', 'marker-end': 'url(#ah-sys)' }));
      }
      setC(t + ' of ' + (3 * N - 2)); setD(3 * N - 2); setB(busy + ' of ' + N * N);
      f.note.innerHTML = t === 0 ? 'Rows of A wait on the left and columns of B on top, each skewed by one cycle per row/column so the right pair meets in the right PE. Press <b>Step</b>.'
        : t >= 3 * N - 2 ? 'Done. Each PE holds one element of C = A·B (bold teal). PE(i, j) started at cycle i + j + 1 and needed N cycles, so the last PE finishes at cycle 3N − 2. A new multiplication can stream in right behind this one, which is the seamless pipelining the lecture highlights.'
          : 'Cycle ' + t + ': every highlighted PE multiplies the A value arriving from its left by the B value arriving from above and adds it to its stored sum, then passes both values on.';
    }
    render(0);
  });

  /* ---------- 1-D dataflows: OS / WS / IS ---------- */
  CSO.widget('dataflow', function (el, o) {
    var f = K.frame(el, 'Output, weight and input stationary on a 1-D convolution', 'Step through the loop nest and watch what stays put');
    var st = { mode: o.mode || 'OS', H: 8, R: 3 };
    K.seg(f.ctrl, { label: 'Dataflow', value: st.mode, options: [['OS', 'Output stationary'], ['WS', 'Weight stationary'], ['IS', 'Input stationary']], on: function (v) { st.mode = v; pl.reset(); } });
    K.slider(f.ctrl, { label: 'Input length H', min: 5, max: 12, value: st.H, on: function (v) { st.H = v; pl.reset(); } });
    K.slider(f.ctrl, { label: 'Filter length R', min: 2, max: 4, value: st.R, on: function (v) { st.R = v; pl.reset(); } });
    var code = h('pre', { class: 'wg-log', style: 'max-height:none' });
    f.stage.appendChild(code);
    var sv = K.svg(640, 200); f.stage.appendChild(sv);
    var sW = K.stat(f.out, 'Weight fetches', 'v'), sI = K.stat(f.out, 'Input fetches', 'm'), sOr = K.stat(f.out, 'Psum reads', 'c'), sOw = K.stat(f.out, 'Psum writes', 'c'), sM = K.stat(f.out, 'MACs');
    function iters() {
      var E = st.H - st.R + 1, out = [], e, r, hh;
      if (st.mode === 'OS') for (e = 0; e < E; e++) for (r = 0; r < st.R; r++) out.push({ e: e, r: r, h: e + r });
      if (st.mode === 'WS') for (r = 0; r < st.R; r++) for (e = 0; e < E; e++) out.push({ e: e, r: r, h: e + r });
      if (st.mode === 'IS') for (hh = 0; hh < st.H; hh++) for (r = 0; r < st.R; r++) { e = hh - r; if (e >= 0 && e < E) out.push({ e: e, r: r, h: hh }); }
      return out;
    }
    var CODE = {
      OS: 'for (e = 0; e < E; e++)        // output index outermost\n  for (r = 0; r < R; r++)\n    O[e] += I[e + r] * W[r];',
      WS: 'for (r = 0; r < R; r++)        // weight index outermost\n  for (e = 0; e < E; e++)\n    O[e] += I[e + r] * W[r];',
      IS: 'for (h = 0; h < H; h++)        // input index outermost\n  for (r = 0; r < R; r++)\n    if (0 <= h - r < E) O[h - r] += I[h] * W[r];'
    };
    var pl = K.player(f.ctrl, { max: function () { return iters().length; }, render: render, interval: 450 });
    function render(t) {
      var it = iters(), E = st.H - st.R + 1;
      code.textContent = CODE[st.mode] + '\n\nE = H − R + 1 = ' + E + (t > 0 ? '    current: e=' + it[t - 1].e + ', r=' + it[t - 1].r + ', h=' + it[t - 1].h : '');
      var wF = 0, iF = 0, oR = 0, oW = 0, prev = null, touched = {};
      for (var n = 0; n < t; n++) {
        var c = it[n];
        if (!prev || prev.r !== c.r) wF++;
        if (!prev || prev.h !== c.h) iF++;
        if (!prev || prev.e !== c.e) { if (prev) oW++; if (touched[c.e]) oR++; }
        touched[c.e] = true; prev = c;
      }
      if (t === it.length && t > 0) oW++;
      sW(wF); sI(iF); sOr(oR); sOw(oW); sM(t + ' / ' + E * st.R);
      K.clear(sv);
      var cur = t > 0 ? it[t - 1] : null, C = 34;
      function row(y, label, n, key, cls, val) {
        sv.appendChild(s('text', { x: 0, y: y + 21, class: 't-sm t-mut', text: label }));
        for (var i = 0; i < n; i++) {
          var on = cur && cur[key] === i;
          K.cell(sv, 90 + i * (C + 4), y, C, C, val(i), on ? cls : 'f-surf s-line w1', 't-sm t-mono');
        }
      }
      var acc = {}; for (n = 0; n < t; n++) acc[it[n].e] = (acc[it[n].e] || 0) + 1;
      row(10, 'W[r]', st.R, 'r', 'f-vs s-v w2', function (i) { return 'w' + i; });
      row(70, 'I[h]', st.H, 'h', 'f-ms s-m w2', function (i) { return 'i' + i; });
      row(130, 'O[e]', E, 'e', 'f-cs s-c w2', function (i) { return (acc[i] || 0) + '/' + st.R; });
      var held = { OS: 'output psum O[e]', WS: 'weight W[r]', IS: 'input I[h]' }[st.mode];
      f.note.innerHTML = 'The PE register keeps the <b>' + held + '</b> across consecutive iterations, so that data type is fetched least. Counts above use "fetch only when the index changes".' +
        '<br>Course table (1-D, W ≈ E): OS reads weights and inputs E·R times, writes outputs E times, reads psums 0 times. WS reads weights R times but reads and writes psums E·R times. IS reads inputs about E times but weights and psums E·R times.';
    }
    render(0);
  });

  /* ---------- Eyeriss row stationary ---------- */
  CSO.widget('rowstat', function (el) {
    var f = K.frame(el, 'Row stationary on a 3×3 PE set (Eyeriss)', '3×3 filter on a 5×5 ifmap, stride 1, gives a 3×3 ofmap');
    var sv = K.svg(700, 330); f.stage.appendChild(sv);
    var setS = K.stat(f.out, 'Sliding position (output column)', 'v');
    var pl = K.player(f.ctrl, { max: function () { return 3; }, render: render, interval: 1100 });
    function render(t) {
      K.clear(sv); K.arrowDefs(sv, 'ah-rs', 'f-c');
      var P = 96, ox = 150, oy = 40;
      sv.appendChild(s('text', { x: ox, y: 20, class: 't-sm t-mut', text: 'PE column j computes ofmap row j' }));
      for (var i = 0; i < 3; i++) {
        sv.appendChild(s('text', { x: ox - 10, y: oy + i * P + P / 2, 'text-anchor': 'end', class: 't-sm t-v', text: 'filter row ' + (i + 1) }));
        for (var j = 0; j < 3; j++) {
          var x = ox + j * P, y = oy + i * P;
          sv.appendChild(s('rect', { x: x + 4, y: y + 4, width: P - 8, height: P - 8, rx: 6, class: t > 0 ? 'f-cs s-c w15' : 'f-surf s-line w1' }));
          sv.appendChild(s('text', { x: x + P / 2, y: y + 24, 'text-anchor': 'middle', class: 't-sm t-v', text: 'W row ' + (i + 1) }));
          sv.appendChild(s('text', { x: x + P / 2, y: y + 42, 'text-anchor': 'middle', class: 't-sm t-m', text: 'I row ' + (i + j + 1) }));
          if (t > 0) sv.appendChild(s('text', { x: x + P / 2, y: y + 62, 'text-anchor': 'middle', class: 't-sm t-mono', text: 'cols ' + t + '–' + (t + 2) }));
          sv.appendChild(s('text', { x: x + P / 2, y: y + 78, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'psum' }));
          if (i > 0) sv.appendChild(s('line', { x1: x + P / 2 + 30, y1: y + 6, x2: x + P / 2 + 30, y2: y - 4, class: 's-c w2', 'marker-end': 'url(#ah-rs)' }));
        }
      }
      // ofmap
      var gx = ox + 3 * P + 40;
      sv.appendChild(s('text', { x: gx, y: 20, class: 't-sm t-mut', text: 'ofmap 3×3' }));
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) K.cell(sv, gx + j * 40, oy + i * 40, 38, 38, j < t ? 'O' + (i + 1) + (j + 1) : '', j === t - 1 ? 'f-cs s-c w2' : (j < t ? 'f-surf s-c w1' : 'f-panel s-line w1'), 't-sm t-mono');
      sv.appendChild(s('text', { x: gx, y: oy + 150, class: 't-sm t-mut', text: 'Row j = Σ of PE column j' }));
      setS(t === 0 ? 'not started' : t + ' of 3');
      f.note.innerHTML = '<b>Filter rows</b> are reused horizontally: every PE in a row holds the same filter row. <b>Ifmap rows</b> move diagonally: PE(i, j) gets ifmap row i + j. <b>Partial sums</b> flow up each column and add into one ofmap row. Each PE slides its filter row along its ifmap row (a 1-D convolution), holding S weights, S inputs and 1 psum in its scratchpad: 2S + 1 entries.';
    }
    render(0);
  });

  /* ---------- run-length coding ---------- */
  CSO.widget('rlc', function (el) {
    var f = K.frame(el, 'Run-length coding of sparse activations (Eyeriss)', '5-bit run of zeros + 16-bit level, three pairs and a terminal bit per 64-bit word');
    var inp = h('input', { type: 'text', id: K.id('rlc'), value: '0, 0, 12, 0, 0, 0, 0, 53, 0, 0, 22' });
    f.ctrl.appendChild(h('label', { for: inp.id }, 'Activations', inp));
    K.button(f.ctrl, 'Try a ReLU-like row', function () { inp.value = '0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 3, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5'; draw(); });
    var sRaw = K.stat(f.out, 'Uncompressed (16 bits each)', 'm');
    var sRlc = K.stat(f.out, 'RLC (64-bit words)', 'c');
    var sPairs = K.stat(f.out, '(run, level) pairs', 'v');
    var log = h('div', { class: 'wg-log' }); f.stage.appendChild(log);
    inp.addEventListener('input', draw);
    function draw() {
      var vals = inp.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(function (v) { return !isNaN(v); });
      var pairs = [], run = 0;
      vals.forEach(function (v) {
        if (v === 0) { run++; if (run === 32) { pairs.push([31, 0]); run = 0; } }
        else { pairs.push([run, v]); run = 0; }
      });
      if (run > 0) pairs.push([run - 1, 0]);
      var words = Math.ceil(pairs.length / 3) || 0;
      sRaw(vals.length * 16 + ' bits'); sRlc(words * 64 + ' bits (' + words + ' word' + (words === 1 ? '' : 's') + ')'); sPairs(pairs.length);
      log.textContent = pairs.map(function (p, i) { return (i % 3 === 0 ? 'word ' + (i / 3 + 1) + ': ' : '        ') + '(run ' + p[0] + ', level ' + p[1] + ')' + (i % 3 === 2 || i === pairs.length - 1 ? '  + term bit' : ''); }).join('\n');
      f.note.innerHTML = 'The lecture example packs 11 activations into one 64-bit word (3 × 21 bits + 1), where plain 16-bit storage fits only 4. A run longer than 31 zeros is split as (31, 0) followed by the rest. Eyeriss compresses traffic to and from DRAM this way and saw 1.2–1.9× less DRAM traffic on AlexNet.';
    }
    draw();
  });

  /* ---------- pruning playground ---------- */
  CSO.widget('prune', function (el) {
    var f = K.frame(el, 'Magnitude pruning: unstructured vs filter-level', 'Rows are filters, cells are weights; shade shows |w|');
    var R = 6, C = 10, W = [];
    var seed = 11; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < R; i++) { W.push([]); var scale = [1, 0.35, 0.9, 0.5, 1.2, 0.25][i]; for (var j = 0; j < C; j++) W[i].push(+(((rnd() - 0.5) * 2) * scale * (0.4 + rnd())).toFixed(2)); }
    var st = { p: 40, mode: 'unstructured' };
    K.seg(f.ctrl, { label: 'Granularity', value: st.mode, options: [['unstructured', 'Individual weights'], ['filter', 'Whole filters (L1 norm)']], on: function (v) { st.mode = v; draw(); } });
    K.slider(f.ctrl, { label: 'Prune', min: 0, max: 90, step: 10, value: st.p, fmt: function (v) { return v + '%'; }, on: function (v) { st.p = v; draw(); } });
    var sK = K.stat(f.out, 'Weights kept', 'c'), sZ = K.stat(f.out, 'Zeros (sparsity)', 'm'), sF = K.stat(f.out, 'Filters removed', 'v');
    var sv = K.svg(640, 230); f.stage.appendChild(sv);
    function draw() {
      K.clear(sv);
      var keep = {}, total = R * C, nPrune = Math.round(total * st.p / 100), norms = W.map(function (r) { return r.reduce(function (a, b) { return a + Math.abs(b); }, 0); });
      var removedRows = [];
      if (st.mode === 'unstructured') {
        var flat = []; for (var i = 0; i < R; i++) for (var j = 0; j < C; j++) flat.push([Math.abs(W[i][j]), i, j]);
        flat.sort(function (a, b) { return a[0] - b[0]; });
        flat.forEach(function (x, k) { if (k >= nPrune) keep[x[1] + ',' + x[2]] = 1; });
      } else {
        var rowsToPrune = Math.round(R * st.p / 100);
        var order = norms.map(function (n, i) { return [n, i]; }).sort(function (a, b) { return a[0] - b[0]; });
        removedRows = order.slice(0, rowsToPrune).map(function (x) { return x[1]; });
        for (i = 0; i < R; i++) if (removedRows.indexOf(i) < 0) for (j = 0; j < C; j++) keep[i + ',' + j] = 1;
      }
      var kept = Object.keys(keep).length, CW = 42, CH = 30;
      for (i = 0; i < R; i++) {
        sv.appendChild(s('text', { x: 0, y: 20 + i * (CH + 4) + 14, class: 't-sm t-mut', text: 'filter ' + (i + 1) }));
        for (j = 0; j < C; j++) {
          var k = keep[i + ',' + j], a = Math.min(1, Math.abs(W[i][j]) / 1.3);
          var r = s('rect', { x: 64 + j * CW, y: 20 + i * (CH + 4), width: CW - 4, height: CH, rx: 3, class: k ? (W[i][j] >= 0 ? 'f-c' : 'f-m') : 'f-panel' });
          if (k) r.style.opacity = (0.25 + 0.75 * a).toFixed(2);
          sv.appendChild(r);
          if (k) sv.appendChild(s('text', { x: 64 + j * CW + (CW - 4) / 2, y: 20 + i * (CH + 4) + 19, 'text-anchor': 'middle', class: 't-sm t-mono', text: W[i][j].toFixed(1) }));
        }
        sv.appendChild(s('text', { x: 64 + C * CW + 8, y: 20 + i * (CH + 4) + 19, class: 't-sm t-mono' + (removedRows.indexOf(i) >= 0 ? ' t-m' : ' t-mut'), text: 'Σ|w| = ' + norms[i].toFixed(1) }));
      }
      sK(kept + ' / ' + total); sZ(Math.round(100 * (total - kept) / total) + '%'); sF(st.mode === 'filter' ? removedRows.length + ' of ' + R : '0 (rows stay)');
      f.note.innerHTML = st.mode === 'unstructured'
        ? 'Unstructured pruning removes the smallest |w| anywhere. It reaches high sparsity for a given accuracy, but the zeros are scattered, so the 7-loop convolution still visits every position unless the hardware or kernel skips zeros.'
        : 'Filter-level pruning ranks filters by the L1 norm Σ|w| and drops whole rows. Fewer filters simply means a smaller loop bound M, so the speed-up is real on any hardware, but accuracy usually drops sooner.';
    }
    draw();
  });

  /* ---------- staircase execution time ---------- */
  CSO.widget('staircase', function (el) {
    var f = K.frame(el, 'Why pruning ratio and execution time do not move together', 'A layer with 256 channels on hardware that works in blocks of 32');
    var st = { p: 30, tile: 32 };
    K.slider(f.ctrl, { label: 'Pruning ratio', min: 0, max: 95, value: st.p, fmt: function (v) { return v + '%'; }, on: function (v) { st.p = v; draw(); } });
    K.select(f.ctrl, { label: 'Hardware block', value: '32', options: [['16', '16 channels'], ['32', '32 channels'], ['64', '64 channels']], on: function (v) { st.tile = +v; draw(); } });
    var sT = K.stat(f.out, 'Relative execution time', 'm'), sF = K.stat(f.out, 'Relative FLOPs', 'c'), sA = K.stat(f.out, 'Advice', 'v');
    var sv = K.svg(560, 260); f.stage.appendChild(sv);
    function time(p) { var ch = Math.max(1, Math.round(256 * (1 - p / 100))); return Math.ceil(ch / st.tile) * st.tile / 256; }
    function draw() {
      K.clear(sv);
      var X0 = 46, Y0 = 14, PW = 480, PH = 200;
      function px(p) { return X0 + p / 100 * PW; } function py(v) { return Y0 + (1 - v) * PH; }
      [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { sv.appendChild(s('line', { x1: X0, x2: X0 + PW, y1: py(v), y2: py(v), class: 's-line w1' })); sv.appendChild(s('text', { x: X0 - 6, y: py(v) + 4, 'text-anchor': 'end', class: 't-sm t-mut', text: v })); });
      [0, 20, 40, 60, 80, 100].forEach(function (p) { sv.appendChild(s('text', { x: px(p), y: Y0 + PH + 16, 'text-anchor': 'middle', class: 't-sm t-mut', text: p + '%' })); });
      sv.appendChild(s('text', { x: X0 + PW / 2, y: Y0 + PH + 34, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'pruning ratio of this layer' }));
      sv.appendChild(s('line', { x1: px(0), y1: py(1), x2: px(100), y2: py(0), class: 's-c w15 dash' }));
      var d = ''; for (var p = 0; p <= 99; p += 0.5) d += (p ? 'L' : 'M') + px(p).toFixed(1) + ' ' + py(time(p)).toFixed(1);
      sv.appendChild(s('path', { d: d, class: 'f-none s-m w2' }));
      sv.appendChild(s('circle', { cx: px(st.p), cy: py(time(st.p)), r: 6, class: 'f-m' }));
      sv.appendChild(s('text', { x: X0 + PW - 4, y: Y0 + 14, 'text-anchor': 'end', class: 't-sm t-c', text: 'FLOPs (linear)' }));
      sv.appendChild(s('text', { x: X0 + PW - 4, y: Y0 + 30, 'text-anchor': 'end', class: 't-sm t-m', text: 'execution time (staircase)' }));
      var t = time(st.p), tNextLess = null;
      for (var q = st.p + 1; q <= 95; q++) if (time(q) < t) { tNextLess = q; break; }
      var atDrop = st.p === 0 || time(st.p - 1) > t;
      sT(t.toFixed(3)); sF((1 - st.p / 100).toFixed(3));
      sA(atDrop ? 'At a drop point' : (tNextLess ? 'Go to ' + tNextLess + '% or back off' : 'Flat region'));
      f.note.innerHTML = 'Inside a flat step you lose accuracy without gaining time. Prune just past a drop (point A or C on the slide), never in the middle of a flat region (between A and B). The step positions depend on the platform (cache and vector sizes), which is why pruning must be platform-aware. FLOPs must also fall more than you might expect for the same speed-up.';
    }
    draw();
  });
})();
