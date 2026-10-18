/* Widgets for Part I: perceptron, convolution, im2col, tiling, activations, pooling, separable convs. */
(function () {
  'use strict';
  var h = K.h, s = K.s;

  /* ---------- perceptron ---------- */
  CSO.widget('perceptron', function (el) {
    var f = K.frame(el, 'A single perceptron', 'Move the sliders; the output updates live');
    var st = { x1: 1, x2: -0.5, w1: 0.8, w2: -1.2, b: 0.3, act: 'relu' };
    var acts = {
      none: function (z) { return z; }, sigmoid: function (z) { return 1 / (1 + Math.exp(-z)); },
      tanh: function (z) { return Math.tanh(z); }, relu: function (z) { return Math.max(0, z); }
    };
    ['x1', 'x2', 'w1', 'w2', 'b'].forEach(function (k) {
      K.slider(f.ctrl, { label: k === 'b' ? 'bias w0' : k, min: -2, max: 2, step: 0.1, value: st[k], fmt: function (v) { return v.toFixed(1); }, on: function (v) { st[k] = v; draw(); } });
    });
    K.select(f.ctrl, { label: 'Activation', value: st.act, options: [['relu', 'ReLU'], ['sigmoid', 'Sigmoid'], ['tanh', 'tanh'], ['none', 'None (linear)']], on: function (v) { st.act = v; draw(); } });
    var setZ = K.stat(f.out, 'Weighted sum z = w0 + Σ wᵢxᵢ', 'm');
    var setY = K.stat(f.out, 'Output y = f(z)', 'c');
    var sv = K.svg(560, 200); f.stage.appendChild(sv);
    function draw() {
      K.clear(sv); K.arrowDefs(sv, 'ah-pc', 'f-mut');
      var z = st.b + st.w1 * st.x1 + st.w2 * st.x2, y = acts[st.act](z);
      var ins = [['1', st.b, 'w0'], ['x1 = ' + st.x1.toFixed(1), st.w1, 'w1'], ['x2 = ' + st.x2.toFixed(1), st.w2, 'w2']];
      ins.forEach(function (it, i) {
        var yy = 40 + i * 60;
        sv.appendChild(s('circle', { cx: 60, cy: yy, r: 24, class: 'f-surf s-mut w15' }));
        sv.appendChild(s('text', { x: 60, y: yy + 4, 'text-anchor': 'middle', class: 't-sm', text: it[0] }));
        var w = Math.abs(it[1]);
        sv.appendChild(s('line', { x1: 86, y1: yy, x2: 258, y2: 100, class: (it[1] >= 0 ? 's-c' : 's-m'), 'stroke-width': 1 + w * 2.2, 'stroke-linecap': 'round' }));
        var ly = yy + (100 - yy) * (150 - 86) / 172; sv.appendChild(s('text', { x: 150, y: ly + (i === 2 ? 18 : -9), 'text-anchor': 'middle', class: 't-sm t-mono ' + (it[1] >= 0 ? 't-c' : 't-m'), text: it[2] + '=' + it[1].toFixed(1) }));
      });
      sv.appendChild(s('circle', { cx: 285, cy: 100, r: 28, class: 'f-ms s-m w2' }));
      sv.appendChild(s('text', { x: 285, y: 107, 'text-anchor': 'middle', class: 't-lg t-b', text: 'Σ' }));
      sv.appendChild(s('line', { x1: 313, y1: 100, x2: 368, y2: 100, class: 's-mut w15', 'marker-end': 'url(#ah-pc)' }));
      sv.appendChild(s('rect', { x: 372, y: 72, width: 66, height: 56, rx: 6, class: 'f-cs s-c w2' }));
      sv.appendChild(s('text', { x: 405, y: 106, 'text-anchor': 'middle', class: 't-md t-b', text: 'f(z)' }));
      sv.appendChild(s('line', { x1: 438, y1: 100, x2: 486, y2: 100, class: 's-mut w15', 'marker-end': 'url(#ah-pc)' }));
      sv.appendChild(s('text', { x: 494, y: 105, class: 't-md t-mono t-b', text: 'y = ' + y.toFixed(2) }));
      sv.appendChild(s('text', { x: 285, y: 150, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'z = ' + z.toFixed(2) }));
      setZ(z.toFixed(3)); setY(y.toFixed(3));
      f.note.innerHTML = st.act === 'none'
        ? '<b>No activation:</b> y is just a weighted sum. Stack two such layers and you get y = W₂(W₁x) = (W₂W₁)x, which one layer with weights W₂W₁ computes exactly. Depth buys nothing without a non-linearity.'
        : 'Teal edges are positive weights, copper edges negative; thickness shows |w|. The non-linearity is what stops stacked layers from collapsing into one.';
    }
    draw();
  });

  /* ---------- convolution explorer ---------- */
  CSO.widget('conv', function (el, o) {
    var f = K.frame(el, 'Convolution, one output at a time', 'Slide the filter across the input fmap');
    var st = { H: o.H || 5, R: o.R || 3, U: o.U || 1 };
    var CELL = 30;
    var FILT = [1, 0, -1, 2, 1, 0, 1, -1, 1, 0, 2, 1, -1, 0, 1, 1];
    function input(i, j) { return (i * 7 + j * 3 + 5) % 10; }
    function filt(i, j) { return FILT[(i * st.R + j) % FILT.length]; }
    var sv = K.svg(700, 260); f.stage.appendChild(sv);
    K.select(f.ctrl, { label: 'Input H×W', value: String(st.H), options: [['5', '5×5'], ['6', '6×6'], ['7', '7×7']], on: function (v) { st.H = +v; pl.reset(); } });
    K.select(f.ctrl, { label: 'Filter R×S', value: String(st.R), options: [['2', '2×2'], ['3', '3×3']], on: function (v) { st.R = +v; pl.reset(); } });
    K.select(f.ctrl, { label: 'Stride U', value: String(st.U), options: [['1', '1'], ['2', '2']], on: function (v) { st.U = +v; pl.reset(); } });
    var setE = K.stat(f.out, 'Output size E = (H − R)/U + 1', 'c');
    var setM = K.stat(f.out, 'MACs so far', 'm');
    var setMax = K.stat(f.out, 'Total MACs = E·F·R·S', '');
    function E() { return Math.floor((st.H - st.R) / st.U) + 1; }
    var pl = K.player(f.ctrl, { max: function () { return E() * E(); }, render: render, interval: 650 });
    function render(t) {
      K.clear(sv);
      var e = E(), H = st.H, R = st.R;
      var x0 = 10, xF = x0 + H * CELL + 50, xO = xF + R * CELL + 60;
      var W = xO + e * CELL + 10; sv.setAttribute('viewBox', '0 0 ' + Math.max(W, 520) + ' ' + (H * CELL + 70)); sv.setAttribute('width', Math.max(W, 520)); sv.setAttribute('height', H * CELL + 70);
      sv.appendChild(s('text', { x: x0, y: 16, class: 't-sm t-mut', text: 'Input fmap ' + H + '×' + H }));
      sv.appendChild(s('text', { x: xF, y: 16, class: 't-sm t-mut', text: 'Filter ' + R + '×' + R }));
      sv.appendChild(s('text', { x: xO, y: 16, class: 't-sm t-mut', text: 'Output ' + e + '×' + e }));
      var cur = t > 0 ? t - 1 : -1, oy = Math.floor(cur / e), ox = cur % e;
      var g = s('g');
      for (var i = 0; i < H; i++) for (var j = 0; j < H; j++) {
        var inWin = cur >= 0 && i >= oy * st.U && i < oy * st.U + R && j >= ox * st.U && j < ox * st.U + R;
        K.cell(g, x0 + j * CELL, 26 + i * CELL, CELL - 2, CELL - 2, input(i, j), inWin ? 'f-ms s-m w15' : 'f-surf s-line w1');
      }
      if (cur >= 0) g.appendChild(s('rect', { x: x0 + ox * st.U * CELL - 2, y: 24 + oy * st.U * CELL, width: R * CELL + 2, height: R * CELL + 2, rx: 4, class: 'f-none s-m w3' }));
      for (i = 0; i < R; i++) for (j = 0; j < R; j++) K.cell(g, xF + j * CELL, 26 + i * CELL, CELL - 2, CELL - 2, filt(i, j), 'f-vs s-v w1');
      var done = 0;
      for (i = 0; i < e; i++) for (j = 0; j < e; j++) {
        var k = i * e + j, val = '';
        if (k < t) { val = 0; for (var a = 0; a < R; a++) for (var b = 0; b < R; b++) val += input(i * st.U + a, j * st.U + b) * filt(a, b); done++; }
        K.cell(g, xO + j * CELL, 26 + i * CELL, CELL - 2, CELL - 2, val, k === cur ? 'f-cs s-c w2' : (k < t ? 'f-surf s-c w1' : 'f-panel s-line w1'));
      }
      sv.appendChild(g);
      sv.appendChild(s('text', { x: xF + R * CELL / 2, y: 26 + R * CELL + 22, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'element-wise ×, then Σ' }));
      setE(e + ' × ' + e); setM(K.fmt(done * R * R)); setMax(K.fmt(e * e * R * R));
      if (cur >= 0) {
        var parts = [], sum = 0;
        for (a = 0; a < R; a++) for (b = 0; b < R; b++) { var p = input(oy * st.U + a, ox * st.U + b), w = filt(a, b); parts.push(p + '×' + (w < 0 ? '(' + w + ')' : w)); sum += p * w; }
        f.note.innerHTML = '<b>O[' + oy + '][' + ox + ']</b> = ' + parts.join(' + ') + ' = <b>' + sum + '</b>. Each output pixel is one dot product of the filter with one patch. The filter then moves by U = ' + st.U + '.';
      } else f.note.innerHTML = 'Press <b>Play</b> or <b>Step</b>. The copper window is the patch under the filter; the teal cell is the output it produces.';
    }
    render(0);
  });

  /* ---------- im2col / Toeplitz ---------- */
  CSO.widget('im2col', function (el) {
    var f = K.frame(el, 'Flattening convolution into a matrix product', 'Select a column or an output pixel');
    var IN = []; for (var i = 0; i < 16; i++) IN.push(i + 1);
    var K2 = [1, 2, 3, 4];
    var cols = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cols.push([r * 4 + c, r * 4 + c + 1, (r + 1) * 4 + c, (r + 1) * 4 + c + 1]);
    var outv = cols.map(function (col) { return col.reduce(function (a, idx, k) { return a + IN[idx] * K2[k]; }, 0); });
    var st = { sel: 0, dup: false };
    var sv = K.svg(760, 290); f.stage.appendChild(sv);
    K.button(f.ctrl, 'Show copies of each pixel', function () { st.dup = !st.dup; this.textContent = st.dup ? 'Hide copies' : 'Show copies of each pixel'; draw(); });
    var setMem = K.stat(f.out, 'Values stored: input → Toeplitz', 'm');
    var setOut = K.stat(f.out, 'Selected output', 'c');
    var count = {}; cols.forEach(function (col) { col.forEach(function (idx) { count[idx] = (count[idx] || 0) + 1; }); });
    function draw() {
      K.clear(sv);
      var C = 26, selCol = cols[st.sel];
      sv.appendChild(s('text', { x: 10, y: 16, class: 't-sm t-mut', text: 'Input 4×4' }));
      for (var i = 0; i < 16; i++) {
        var rr = Math.floor(i / 4), cc = i % 4, on = selCol.indexOf(i) >= 0;
        var cls = st.dup ? (count[i] === 4 ? 'f-ms s-m w1' : count[i] === 2 ? 'f-vs s-v w1' : 'f-surf s-line w1') : (on ? 'f-ms s-m w15' : 'f-surf s-line w1');
        K.cell(sv, 10 + cc * C, 24 + rr * C, C - 2, C - 2, IN[i], cls, 't-sm t-mono');
      }
      sv.appendChild(s('text', { x: 10, y: 150, class: 't-sm t-mut', text: 'Filter 2×2' }));
      [[1, 2], [3, 4]].forEach(function (row, a) { row.forEach(function (v, b) { K.cell(sv, 10 + b * C, 158 + a * C, C - 2, C - 2, v, 'f-vs s-v w1', 't-sm t-mono'); }); });
      var X = 160;
      sv.appendChild(s('text', { x: X, y: 16, class: 't-sm t-mut', text: 'Flattened filter (1×4)' }));
      K2.forEach(function (v, k) { K.cell(sv, X + k * C, 24, C - 2, C - 2, v, 'f-vs s-v w1', 't-sm t-mono'); });
      var MX = 300;
      sv.appendChild(s('text', { x: MX, y: 16, class: 't-sm t-mut', text: 'Toeplitz matrix (4×9): column p = patch p' }));
      cols.forEach(function (col, p) {
        var hit = s('g', { style: 'cursor:pointer', onclick: function () { st.sel = p; draw(); } });
        col.forEach(function (idx, k) {
          var cls = st.dup ? (count[idx] === 4 ? 'f-ms s-m w1' : count[idx] === 2 ? 'f-vs s-v w1' : 'f-surf s-line w1') : (p === st.sel ? 'f-ms s-m w15' : 'f-surf s-line w1');
          K.cell(hit, MX + p * C, 24 + k * C, C - 2, C - 2, IN[idx], cls, 't-sm t-mono');
        });
        hit.appendChild(s('text', { x: MX + p * C + 12, y: 24 + 4 * C + 14, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'p' + p }));
        sv.appendChild(hit);
      });
      sv.appendChild(s('text', { x: MX, y: 180, class: 't-sm t-mut', text: 'Output row (1×9) = filter row × matrix' }));
      outv.forEach(function (v, p) {
        var g = s('g', { style: 'cursor:pointer', onclick: function () { st.sel = p; draw(); } });
        K.cell(g, MX + p * C, 188, C - 2, C - 2, v, p === st.sel ? 'f-cs s-c w2' : 'f-surf s-c w1', 't-sm t-mono');
        sv.appendChild(g);
      });
      sv.appendChild(s('text', { x: MX, y: 245, class: 't-sm t-mut', text: 'Reshaped into the 3×3 output fmap' }));
      outv.forEach(function (v, p) { K.cell(sv, MX + 270 + (p % 3) * 34, 196 + Math.floor(p / 3) * 26, 32, 24, v, p === st.sel ? 'f-cs s-c w2' : 'f-surf s-line w1', 't-sm t-mono'); });
      var a = selCol.map(function (idx, k) { return K2[k] + '×' + IN[idx]; });
      setMem('16 → 36 (2.25×)'); setOut('p' + st.sel + ' = ' + outv[st.sel]);
      f.note.innerHTML = st.dup
        ? 'Copper pixels appear <b>4 times</b> in the matrix, violet ones twice, white ones once. This duplication is the memory price of turning convolution into one big GEMM.'
        : 'Patch p' + st.sel + ' = [' + selCol.map(function (i) { return IN[i]; }).join(', ') + '], so output = ' + a.join(' + ') + ' = <b>' + outv[st.sel] + '</b>. The seven nested loops become one vector × matrix product.';
    }
    draw();
  });

  /* ---------- tiled matmul with an LRU tile cache ---------- */
  CSO.widget('tiling', function (el) {
    var f = K.frame(el, 'Tiled matrix multiply: loop order decides reuse', 'O = F × I, each split into 2×2 tiles');
    var st = { order: 'ijk', cap: 2 };
    K.select(f.ctrl, { label: 'Loop order', value: st.order, options: [['ijk', 'i, j, k (one output tile at a time)'], ['ikj', 'i, k, j (keep F tile)'], ['kij', 'k, i, j'], ['jki', 'j, k, i (keep I tile)']], on: function (v) { st.order = v; pl.reset(); } });
    K.select(f.ctrl, { label: 'Cache holds', value: '2', options: [['2', '2 tiles'], ['3', '3 tiles'], ['4', '4 tiles']], on: function (v) { st.cap = +v; pl.reset(); } });
    var setL = K.stat(f.out, 'Tile loads from DRAM', 'm');
    var setH = K.stat(f.out, 'Cache hits', 'c');
    var sv = K.svg(640, 230); f.stage.appendChild(sv);
    function seq() {
      var out = [], idx = { i: 0, j: 0, k: 0 }, ord = st.order.split('');
      for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) for (var c = 0; c < 2; c++) {
        idx[ord[0]] = a; idx[ord[1]] = b; idx[ord[2]] = c;
        out.push({ i: idx.i, j: idx.j, k: idx.k });
      }
      return out;
    }
    var pl = K.player(f.ctrl, { max: function () { return 8; }, render: render, interval: 900 });
    function render(t) {
      K.clear(sv);
      var ops = seq(), cache = [], loads = 0, hits = 0, lastHit = [];
      for (var n = 0; n < t; n++) {
        var need = ['F' + ops[n].i + ops[n].k, 'I' + ops[n].k + ops[n].j]; lastHit = [];
        need.forEach(function (name) {
          var p = cache.indexOf(name);
          if (p >= 0) { hits++; cache.splice(p, 1); lastHit.push(name); } else { loads++; if (cache.length >= st.cap) cache.shift(); }
          cache.push(name);
        });
      }
      function grid(x, label, pre, cur, cls) {
        sv.appendChild(s('text', { x: x, y: 18, class: 't-sm t-mut', text: label }));
        for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) {
          var name = pre + a + b, on = cur && cur.indexOf(name) >= 0, inC = cache.indexOf(name) >= 0;
          K.cell(sv, x + b * 58, 26 + a * 58, 54, 54, name, on ? cls : (inC ? 'f-panel s-mut w15' : 'f-surf s-line w1'), 't-md t-mono');
        }
      }
      var curOp = t > 0 ? ops[t - 1] : null;
      var curNames = curOp ? ['F' + curOp.i + curOp.k, 'I' + curOp.k + curOp.j, 'O' + curOp.i + curOp.j] : null;
      grid(10, 'F (filters)', 'F', curNames, 'f-vs s-v w2');
      sv.appendChild(s('text', { x: 140, y: 90, class: 't-lg', text: '×' }));
      grid(165, 'I (input fmaps)', 'I', curNames, 'f-ms s-m w2');
      sv.appendChild(s('text', { x: 295, y: 90, class: 't-lg', text: '=' }));
      grid(320, 'O (outputs)', 'O', curNames, 'f-cs s-c w2');
      sv.appendChild(s('text', { x: 460, y: 18, class: 't-sm t-mut', text: 'Cache (LRU), ' + st.cap + ' tiles' }));
      for (var c = 0; c < st.cap; c++) K.cell(sv, 460 + c * 58, 26, 54, 40, cache[c] || '', cache[c] ? (cache[c][0] === 'F' ? 'f-vs s-v w1' : 'f-ms s-m w1') : 'f-panel s-line w1', 't-md t-mono');
      var listY = 160;
      sv.appendChild(s('text', { x: 10, y: listY, class: 't-sm t-mut', text: 'Order of tile products:' }));
      ops.forEach(function (op, n) {
        sv.appendChild(s('text', { x: 10 + (n % 4) * 150, y: listY + 22 + Math.floor(n / 4) * 20, class: 't-sm t-mono' + (n === t - 1 ? ' t-c t-b' : n < t ? '' : ' t-mut'), text: 'O' + op.i + op.j + ' += F' + op.i + op.k + '·I' + op.k + op.j }));
      });
      setL(loads + (t === 8 ? '' : ' so far')); setH(hits);
      f.note.innerHTML = t === 0 ? 'Each step multiplies one F tile by one I tile. A tile already in the cache is a hit; otherwise it is loaded from DRAM. Try each loop order with a 2-tile cache, then compare the totals.'
        : (lastHit.length ? 'Reused from cache this step: <b>' + lastHit.join(', ') + '</b>.' : 'No reuse this step: both tiles came from DRAM.') + ' Libraries such as cuBLAS and MKL pick tile sizes and orders like this from the matrix shape and the cache sizes.';
    }
    render(0);
  });

  /* ---------- activation functions ---------- */
  CSO.widget('activations', function (el) {
    var f = K.frame(el, 'Activation functions', 'Toggle curves; hover to read values');
    var defs = [
      ['sigmoid', 'Sigmoid', function (x) { return 1 / (1 + Math.exp(-x)); }, 'var(--comm)'],
      ['tanh', 'tanh', Math.tanh, 'var(--memory)'],
      ['relu', 'ReLU', function (x) { return Math.max(0, x); }, 'var(--compute)'],
      ['leaky', 'Leaky ReLU (α = 0.1)', function (x) { return x >= 0 ? x : 0.1 * x; }, 'var(--ink-2)'],
      ['elu', 'ELU (α = 1)', function (x) { return x >= 0 ? x : Math.exp(x) - 1; }, 'var(--ink)']
    ];
    var on = { sigmoid: true, tanh: true, relu: true, leaky: false, elu: false };
    defs.forEach(function (d) {
      var idc = K.id('act');
      var cb = h('input', { type: 'checkbox', id: idc }); cb.checked = on[d[0]];
      cb.addEventListener('change', function () { on[d[0]] = cb.checked; draw(); });
      f.ctrl.appendChild(h('label', { for: idc }, cb, h('span', { style: 'display:inline-block;width:14px;height:3px;background:' + d[3] }), d[1]));
    });
    var W = 560, H = 280, X0 = 40, Y0 = 20, PW = 500, PH = 240, xmin = -4, xmax = 4, ymin = -1.5, ymax = 4;
    var sv = K.svg(W, H); f.stage.appendChild(sv);
    function px(x) { return X0 + (x - xmin) / (xmax - xmin) * PW; }
    function py(y) { return Y0 + (ymax - y) / (ymax - ymin) * PH; }
    var readout = h('div', { class: 'wg-note' });
    function draw(hx) {
      K.clear(sv);
      for (var gx = -4; gx <= 4; gx++) {
        sv.appendChild(s('line', { x1: px(gx), y1: Y0, x2: px(gx), y2: Y0 + PH, class: gx === 0 ? 's-mut w1' : 's-line w1' }));
        sv.appendChild(s('text', { x: px(gx), y: Y0 + PH + 14, 'text-anchor': 'middle', class: 't-sm t-mut', text: gx }));
      }
      for (var gy = -1; gy <= 4; gy++) {
        sv.appendChild(s('line', { x1: X0, y1: py(gy), x2: X0 + PW, y2: py(gy), class: gy === 0 ? 's-mut w1' : 's-line w1' }));
        sv.appendChild(s('text', { x: X0 - 6, y: py(gy) + 4, 'text-anchor': 'end', class: 't-sm t-mut', text: gy }));
      }
      defs.forEach(function (d) {
        if (!on[d[0]]) return;
        var p = '';
        for (var i = 0; i <= 200; i++) { var x = xmin + (xmax - xmin) * i / 200, y = Math.max(ymin, Math.min(ymax, d[2](x))); p += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(y).toFixed(1); }
        var path = s('path', { d: p, fill: 'none', 'stroke-width': 2.5 }); path.style.stroke = d[3]; sv.appendChild(path);
      });
      if (hx != null) {
        sv.appendChild(s('line', { x1: px(hx), y1: Y0, x2: px(hx), y2: Y0 + PH, class: 's-ink w1 dash' }));
        readout.innerHTML = 'x = ' + hx.toFixed(2) + ': ' + defs.filter(function (d) { return on[d[0]]; }).map(function (d) { return d[1] + ' ' + d[2](hx).toFixed(3); }).join(', ');
      }
      var hit = s('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'transparent' });
      hit.addEventListener('mousemove', function (e) { var r = sv.getBoundingClientRect(); var x = xmin + ((e.clientX - r.left) * W / r.width - X0) / PW * (xmax - xmin); draw(Math.max(xmin, Math.min(xmax, x))); });
      sv.appendChild(hit);
    }
    f.out.replaceWith(readout);
    f.note.innerHTML = 'Sigmoid squashes into (0, 1) and tanh into (−1, 1); both flatten out for large |x|, so their gradients become tiny. ReLU keeps a gradient of 1 for x > 0, which is one reason it helps against vanishing gradients.';
    draw(1);
  });

  /* ---------- pooling ---------- */
  CSO.widget('pooling', function (el) {
    var f = K.frame(el, 'Max and average pooling', '2×2 window on the 4×4 example from the lecture');
    var X = [[23, 7, 7, 8], [10, 1, 9, 0], [4, 4, 11, 6], [2, 5, 12, 7]];
    var st = { mode: 'max', U: 2 };
    K.seg(f.ctrl, { label: 'Pooling type', value: 'max', options: [['max', 'Max'], ['avg', 'Average']], on: function (v) { st.mode = v; pl.reset(); } });
    K.select(f.ctrl, { label: 'Stride', value: '2', options: [['2', '2 (non-overlapping)'], ['1', '1 (overlapping)']], on: function (v) { st.U = +v; pl.reset(); } });
    var sv = K.svg(520, 160); f.stage.appendChild(sv);
    function E() { return Math.floor((4 - 2) / st.U) + 1; }
    var pl = K.player(f.ctrl, { max: function () { return E() * E(); }, render: render });
    function val(i, j) {
      var a = [X[i][j], X[i][j + 1], X[i + 1][j], X[i + 1][j + 1]];
      return st.mode === 'max' ? Math.max.apply(null, a) : a.reduce(function (p, q) { return p + q; }, 0) / 4;
    }
    function render(t) {
      K.clear(sv);
      var e = E(), cur = t - 1, oy = Math.floor(cur / e), ox = cur % e, C = 34;
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
        var inW = cur >= 0 && i >= oy * st.U && i < oy * st.U + 2 && j >= ox * st.U && j < ox * st.U + 2;
        K.cell(sv, 10 + j * C, 10 + i * C, C - 2, C - 2, X[i][j], inW ? 'f-ms s-m w15' : 'f-surf s-line w1');
      }
      for (i = 0; i < e; i++) for (j = 0; j < e; j++) {
        var k = i * e + j;
        K.cell(sv, 230 + j * 44, 10 + i * 36, 42, 34, k < t ? (st.mode === 'max' ? val(i * st.U, j * st.U) : val(i * st.U, j * st.U).toFixed(2).replace(/\.?0+$/, '')) : '', k === cur ? 'f-cs s-c w2' : 'f-surf s-line w1');
      }
      sv.appendChild(s('text', { x: 230, y: 10 + e * 36 + 18, class: 't-sm t-mut', text: 'Output ' + e + '×' + e + ' (no weights involved)' }));
      f.note.innerHTML = 'Pooling has no trainable weights: you only choose the window and stride. Lecture answer for stride 2: max pooling gives [[23, 9], [5, 12]] and average pooling gives [[10.25, 6], [3.75, 9]] (the slide rounds these to 10 and 4).';
    }
    render(0);
  });

  /* ---------- separable convolution calculator ---------- */
  CSO.widget('sepconv', function (el, o) {
    var f = K.frame(el, 'Regular vs depth-wise separable convolution', 'Change the layer shape and compare multiplications');
    var st = { H: 12, K: 5, C: 3, M: 256 };
    K.number(f.ctrl, { label: 'Input H', value: st.H, min: 3, max: 512, on: function (v) { st.H = v; draw(); } });
    K.number(f.ctrl, { label: 'Kernel K', value: st.K, min: 1, max: 11, on: function (v) { st.K = v; draw(); } });
    K.number(f.ctrl, { label: 'Channels C', value: st.C, min: 1, max: 2048, on: function (v) { st.C = v; draw(); } });
    K.number(f.ctrl, { label: 'Filters M', value: st.M, min: 1, max: 4096, on: function (v) { st.M = v; draw(); } });
    var setE = K.stat(f.out, 'Output E = H − K + 1');
    var setR = K.stat(f.out, 'Regular: M·K²·C·E²', 'm');
    var setD = K.stat(f.out, 'Depth-wise step: C·K²·E²', 'c');
    var setP = K.stat(f.out, 'Point-wise step: M·C·E²', 'c');
    var setX = K.stat(f.out, 'Saving', 'v');
    var sv = K.svg(560, 90); f.stage.appendChild(sv);
    function draw() {
      var E = st.H - st.K + 1;
      if (E < 1) { f.note.textContent = 'The kernel is larger than the input. Make H ≥ K.'; return; }
      var reg = st.M * st.K * st.K * st.C * E * E, dw = st.C * st.K * st.K * E * E, pw = st.M * st.C * E * E, tot = dw + pw;
      setE(E + ' × ' + E); setR(K.fmt(reg)); setD(K.fmt(dw)); setP(K.fmt(pw)); setX((reg / tot).toFixed(1) + '× fewer');
      K.clear(sv);
      var max = reg, W = 400;
      [['Regular', reg, 'f-m'], ['Separable', tot, 'f-c']].forEach(function (r, i) {
        sv.appendChild(s('text', { x: 0, y: 24 + i * 38, class: 't-sm', text: r[0] }));
        sv.appendChild(s('rect', { x: 80, y: 10 + i * 38, width: Math.max(2, W * r[1] / max), height: 22, rx: 3, class: r[2] }));
        sv.appendChild(s('text', { x: 86 + Math.max(2, W * r[1] / max), y: 26 + i * 38, class: 't-sm t-mono', text: K.fmt(r[1]) }));
      });
      f.note.innerHTML = 'Regular convolution transforms the image M times with big K×K×C kernels. Depth-wise separable transforms it once (one K×K kernel per channel, no sum across channels), then mixes channels with cheap 1×1×C point-wise filters. The ratio is about 1/M + 1/K².';
    }
    draw();
  });

  /* ---------- stacked filters ---------- */
  CSO.widget('stacked', function (el) {
    var f = K.frame(el, 'One big filter or a stack of 3×3 filters?', 'Same receptive field, different weight counts');
    var st = { n: 2, C: 1 };
    K.slider(f.ctrl, { label: 'Stacked 3×3 layers', min: 1, max: 5, value: 2, on: function (v) { st.n = v; draw(); } });
    K.select(f.ctrl, { label: 'Channels in = out', value: '1', options: [['1', '1'], ['64', '64'], ['256', '256']], on: function (v) { st.C = +v; draw(); } });
    var setRF = K.stat(f.out, 'Receptive field covered');
    var setBig = K.stat(f.out, 'One k×k filter: k²·C²', 'm');
    var setSt = K.stat(f.out, 'n stacked 3×3: 9n·C²', 'c');
    function draw() {
      var k = 2 * st.n + 1, C2 = st.C * st.C;
      setRF(k + ' × ' + k); setBig(K.fmt(k * k * C2)); setSt(K.fmt(9 * st.n * C2));
      f.note.innerHTML = 'A stack of n stride-1 3×3 convolutions sees a (2n+1)×(2n+1) patch. VGG uses this trick: for a 5×5 field, 25 weights become 18, with a non-linearity between the layers. The cost is extra layers (and extra activations to store).';
    }
    draw();
  });
})();
