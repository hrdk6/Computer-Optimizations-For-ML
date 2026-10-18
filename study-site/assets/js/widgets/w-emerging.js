/* Widgets for graphs, in-memory computing, chiplets and NPUs. */
(function () {
  'use strict';
  var h = K.h, s = K.s;

  /* ---------- ReRAM crossbar ---------- */
  CSO.widget('crossbar', function (el) {
    var f = K.frame(el, 'A ReRAM crossbar computes a matrix-vector product in one step', 'Weights are conductances G = 1/R; inputs are wordline voltages');
    var G = [[1, 3, 0], [2, 1, 2], [0, 2, 3]], V = [1.0, 0.5, 0.8];
    var LEV = [0, 1, 2, 3];
    V.forEach(function (v, i) { K.slider(f.ctrl, { label: 'V' + (i + 1), min: 0, max: 1, step: 0.1, value: v, fmt: function (x) { return x.toFixed(1) + ' V'; }, on: function (x) { V[i] = x; draw(); } }); });
    var sv = K.svg(620, 300); f.stage.appendChild(sv);
    var sI = [0, 1, 2].map(function (j) { return K.stat(f.out, 'Bitline current I' + (j + 1), 'c'); });
    function draw() {
      K.clear(sv); K.arrowDefs(sv, 'ah-xb', 'f-c');
      var ox = 120, oy = 50, P = 120;
      for (var i = 0; i < 3; i++) {
        var y = oy + i * P * 0.7;
        sv.appendChild(s('rect', { x: 10, y: y - 16, width: 70, height: 32, rx: 4, class: 'f-vs s-v w1' }));
        sv.appendChild(s('text', { x: 45, y: y + 4, 'text-anchor': 'middle', class: 't-sm t-b', text: 'DAC ' + V[i].toFixed(1) + 'V' }));
        sv.appendChild(s('line', { x1: 80, y1: y, x2: ox + 3 * P - 40, y2: y, class: 's-m w3' }));
      }
      for (var j = 0; j < 3; j++) {
        var x = ox + j * P + 20;
        sv.appendChild(s('line', { x1: x, y1: oy - 30, x2: x, y2: oy + 2 * P * 0.7 + 40, class: 's-c w3' }));
        var I = 0; for (i = 0; i < 3; i++) I += V[i] * G[i][j];
        sv.appendChild(s('rect', { x: x - 34, y: oy + 2 * P * 0.7 + 44, width: 68, height: 30, rx: 4, class: 'f-cs s-c w1' }));
        sv.appendChild(s('text', { x: x, y: oy + 2 * P * 0.7 + 64, 'text-anchor': 'middle', class: 't-sm t-b', text: 'ADC ' + I.toFixed(2) }));
        sI[j](I.toFixed(2) + ' (units of µA)');
      }
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
        (function (i, j) {
          var x = ox + j * P + 20, y = oy + i * P * 0.7;
          var g = s('g', { style: 'cursor:pointer', onclick: function () { G[i][j] = LEV[(LEV.indexOf(G[i][j]) + 1) % LEV.length]; draw(); } });
          g.appendChild(s('rect', { x: x - 26, y: y - 14, width: 52, height: 28, rx: 5, class: G[i][j] ? 'f-c' : 'f-panel s-line w1' }));
          if (G[i][j]) g.lastChild.setAttribute('opacity', (0.3 + 0.23 * G[i][j]).toFixed(2));
          g.appendChild(s('text', { x: x, y: y + 4, 'text-anchor': 'middle', class: 't-sm t-mono t-b', text: 'G=' + G[i][j] }));
          sv.appendChild(g);
        })(i, j);
      }
      sv.appendChild(s('text', { x: ox + 3 * P - 30, y: oy + 4, class: 't-sm t-m', text: 'wordlines' }));
      sv.appendChild(s('text', { x: ox + 20, y: oy - 36, class: 't-sm t-c', text: 'bitlines' }));
      var cells = []; for (j = 0; j < 3; j++) { cells.push('I' + (j + 1) + ' = ' + [0, 1, 2].map(function (i) { return V[i].toFixed(1) + '×' + G[i][j]; }).join(' + ')); }
      f.note.innerHTML = 'Ohm\'s law gives each cell a current V·G; Kirchhoff\'s current law adds the currents along every bitline. So all three dot products appear at once, right where the weights are stored: ' + cells.join('; ') + '. Select a cell to change its conductance level. In ISAAC the inputs are fed one bit at a time and the partial results are shifted and added, because a 16-bit DAC/ADC and 2¹⁶ resistance levels per cell are impractical.';
    }
    draw();
  });

  /* ---------- ISAAC buffer requirement ---------- */
  CSO.widget('isaacbuf', function (el) {
    var f = K.frame(el, 'Buffer needed between two pipelined layers (ISAAC)', 'Only the rows a K×K window still needs must be kept');
    var st = { N: 32, K: 3, C: 64 };
    K.number(f.ctrl, { label: 'Fmap Nx = Ny', value: st.N, on: function (v) { st.N = v; draw(); } });
    K.number(f.ctrl, { label: 'Kernel Kx = Ky', value: st.K, on: function (v) { st.K = v; draw(); } });
    K.number(f.ctrl, { label: 'Input maps N_if', value: st.C, on: function (v) { st.C = v; draw(); } });
    var a = K.stat(f.out, 'Pipelined: (Nx(Ky−1)+Kx)·N_if', 'c'), b = K.stat(f.out, 'Layer by layer: Nx·Ny·N_if', 'm'), c = K.stat(f.out, 'Saving', 'v');
    function draw() { var p = (st.N * (st.K - 1) + st.K) * st.C, q = st.N * st.N * st.C; a(K.fmt(p) + ' values'); b(K.fmt(q) + ' values'); c((q / p).toFixed(1) + '×'); f.note.innerHTML = 'As soon as the previous layer has produced Ky − 1 full rows plus Kx values, the next layer can compute one output. Each new input frees an old one, so the eDRAM buffer only holds a sliding band of rows.'; }
    draw();
  });

  /* ---------- GNN aggregation on the 8-node example ---------- */
  CSO.widget('gnnagg', function (el) {
    var f = K.frame(el, 'Aggregation is a sparse matrix product A·X', 'The 8-node graph and feature column f₁ from the lecture; select a node');
    var A = [[0, 1, 0, 1, 0, 0, 0, 0], [1, 0, 1, 0, 1, 0, 0, 0], [0, 1, 0, 1, 0, 1, 1, 1], [1, 0, 1, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0], [0, 0, 1, 0, 0, 1, 0, 1], [0, 0, 1, 0, 0, 0, 1, 0]];
    var X = [5, 8, 3, 2, 4, 9, 6, 7];
    var POS = [[80, 60], [190, 40], [250, 140], [120, 170], [300, 40], [200, 240], [330, 220], [370, 130]];
    var st = { v: 0 };
    var sv = K.svg(700, 290); f.stage.appendChild(sv);
    var sN = K.stat(f.out, 'Neighbours of selected node', 'm'), sS = K.stat(f.out, 'Sum aggregation (A·X)', 'c'), sM = K.stat(f.out, 'Mean aggregation', 'v');
    function draw() {
      K.clear(sv);
      for (var i = 0; i < 8; i++) for (var j = i + 1; j < 8; j++) if (A[i][j]) {
        var hot = i === st.v || j === st.v;
        sv.appendChild(s('line', { x1: POS[i][0], y1: POS[i][1], x2: POS[j][0], y2: POS[j][1], class: hot ? 's-m w3' : 's-line w2' }));
      }
      POS.forEach(function (p, i) {
        var nb = A[st.v][i], g = s('g', { style: 'cursor:pointer', onclick: function () { st.v = i; draw(); } });
        g.appendChild(s('circle', { cx: p[0], cy: p[1], r: 20, class: i === st.v ? 'f-c' : (nb ? 'f-ms s-m w2' : 'f-surf s-mut w15') }));
        g.appendChild(s('text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle', class: 't-sm t-b' + (i === st.v ? ' t-inv' : ''), text: i + 1 }));
        g.appendChild(s('text', { x: p[0] + 24, y: p[1] - 12, class: 't-sm t-mono t-mut', text: 'f=' + X[i] }));
        sv.appendChild(g);
      });
      // adjacency matrix
      var ox = 440, oy = 30, C = 26;
      sv.appendChild(s('text', { x: ox, y: 18, class: 't-sm t-mut', text: 'Row ' + (st.v + 1) + ' of A selects the neighbours' }));
      for (i = 0; i < 8; i++) for (j = 0; j < 8; j++) K.cell(sv, ox + j * C, oy + i * C, C - 2, C - 2, A[i][j], i === st.v ? (A[i][j] ? 'f-ms s-m w1' : 'f-panel s-m w1') : (A[i][j] ? 'f-surf s-mut w1' : 'f-panel s-line w1'), 't-sm t-mono');
      var nbrs = []; for (j = 0; j < 8; j++) if (A[st.v][j]) nbrs.push(j);
      var sum = nbrs.reduce(function (a, j) { return a + X[j]; }, 0);
      sN(nbrs.map(function (j) { return j + 1; }).join(', ')); sS(nbrs.map(function (j) { return X[j]; }).join(' + ') + ' = ' + sum); sM((sum / nbrs.length).toFixed(2));
      f.note.innerHTML = 'Aggregation gathers neighbour features: node ' + (st.v + 1) + ' reads rows ' + nbrs.map(function (j) { return j + 1; }).join(', ') + ' of X. Which rows are read depends on the graph, so the accesses are irregular and sparse. That is why aggregation is memory-bound, while the following combination step (a dense MLP shared by all nodes) is compute-bound.';
    }
    draw();
  });

  /* ---------- order of GCN products ---------- */
  CSO.widget('gcnorder', function (el) {
    var f = K.frame(el, 'Aggregate first or extract features first?', 'Output = A · X · W; matrix multiplication is associative');
    var st = { N: 65575, F: 5414, H: 16 };
    K.number(f.ctrl, { label: 'Nodes N', value: st.N, width: '100px', on: function (v) { st.N = v; draw(); } });
    K.number(f.ctrl, { label: 'Features F', value: st.F, width: '90px', on: function (v) { st.F = v; draw(); } });
    K.number(f.ctrl, { label: 'Hidden H', value: st.H, on: function (v) { st.H = v; draw(); } });
    var a = K.stat(f.out, '(A·X)·W: N²F + NFH', 'm'), b = K.stat(f.out, 'A·(X·W): NFH + N²H', 'c'), c = K.stat(f.out, 'Ratio', 'v');
    function sci(x) { var e = Math.floor(Math.log10(x)); return (x / Math.pow(10, e)).toFixed(1) + '×10^' + e; }
    function draw() { var p = st.N * st.N * st.F + st.N * st.F * st.H, q = st.N * st.F * st.H + st.N * st.N * st.H; a(sci(p)); b(sci(q)); c((p / q).toFixed(0) + '× fewer'); f.note.innerHTML = 'For the Nell dataset (N = 65,575, F = 5,414, H = 16) aggregation-first costs about 2.3×10¹³ multiplications and feature-extraction-first about 7.4×10¹⁰. Shrinking F to H before touching the huge N×N adjacency is what COIN\'s dataflow does: feature extraction, then aggregation, then on-chip communication. (Counts assume dense A; real graphs are sparse, but the ordering argument is the same.)'; }
    draw();
  });

  /* ---------- HALO / NoP mapping cost ---------- */
  CSO.widget('nocmap', function (el) {
    var f = K.frame(el, 'Map LLM phases onto a 3×3 chiplet mesh', 'Cost = Σ volume × Manhattan distance. Select two chiplets to swap them');
    var EDGES = [['E1.1', 'E1.2', 1], ['E1.2', 'E1.3', 1], ['E1.2', 'E1.4', 5], ['E1.3', 'E1.4', 1], ['E1.4', 'D1.1', 1], ['D1.1', 'D1.2', 1], ['D1.2', 'D1.3', 5], ['D1.3', 'D1.4', 1], ['D1.3', 'D1.5', 1], ['D1.4', 'D1.5', 1]];
    var NAIVE = ['E1.1', 'E1.2', 'E1.3', 'E1.4', 'D1.1', 'D1.2', 'D1.3', 'D1.4', 'D1.5'];
    var OPT = ['E1.1', 'E1.2', 'E1.3', 'D1.5', 'E1.4', 'D1.1', 'D1.4', 'D1.3', 'D1.2'];
    var st = { map: NAIVE.slice(), pick: null };
    K.button(f.ctrl, 'Naive row-major mapping', function () { st.map = NAIVE.slice(); st.pick = null; draw(); });
    K.button(f.ctrl, 'Mapping from the lecture', function () { st.map = OPT.slice(); st.pick = null; draw(); });
    var sC = K.stat(f.out, 'Total communication cost', 'm'), sH = K.stat(f.out, 'Cost of the two heavy edges', 'v');
    var sv = K.svg(640, 290); f.stage.appendChild(sv);
    function pos(name) { var i = st.map.indexOf(name); return [i % 3, Math.floor(i / 3)]; }
    function draw() {
      K.clear(sv);
      var C = 86, ox = 20, oy = 20, total = 0, heavy = 0;
      EDGES.forEach(function (e) {
        var a = pos(e[0]), b = pos(e[1]), d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        total += e[2] * d; if (e[2] > 1) heavy += e[2] * d;
        sv.appendChild(s('line', { x1: ox + a[0] * C + 34, y1: oy + a[1] * C + 34, x2: ox + b[0] * C + 34, y2: oy + b[1] * C + 34, class: e[2] > 1 ? 's-m w3' : 's-mut w1', opacity: 0.8 }));
      });
      st.map.forEach(function (name, i) {
        var x = ox + (i % 3) * C, y = oy + Math.floor(i / 3) * C;
        var g = s('g', { style: 'cursor:pointer', onclick: function () {
          if (st.pick == null) st.pick = i; else { var t = st.map[i]; st.map[i] = st.map[st.pick]; st.map[st.pick] = t; st.pick = null; }
          draw();
        } });
        g.appendChild(s('rect', { x: x, y: y, width: 68, height: 68, rx: 6, class: (name[0] === 'E' ? 'f-panel' : 'f-vs') + (st.pick === i ? ' s-m w3' : ' s-mut w1') }));
        g.appendChild(s('text', { x: x + 34, y: y + 39, 'text-anchor': 'middle', class: 't-md t-b', text: name }));
        sv.appendChild(g);
      });
      var tx = 300;
      sv.appendChild(s('text', { x: tx, y: 30, class: 't-sm t-b', text: 'Edge (volume v): distance → cost' }));
      EDGES.forEach(function (e, k) {
        var a = pos(e[0]), b = pos(e[1]), d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        sv.appendChild(s('text', { x: tx, y: 52 + k * 22, class: 't-sm t-mono' + (e[2] > 1 ? ' t-m' : ''), text: e[0] + '→' + e[1] + ' (v=' + e[2] + '): ' + d + ' → ' + e[2] * d }));
      });
      sC(total); sH(heavy);
      f.note.innerHTML = 'Encoder phases are grey, decoder phases violet. Two edges carry 5 units of data; the naive mapping puts them 2 and 3 hops apart (cost 36). Placing heavy pairs next to each other brings the total to 20, the optimum shown in the HALO lecture. HALO combines branch-and-bound with a faster sequential heuristic to find such mappings for 100 chiplets.' + (st.pick != null ? ' <b>Now select a second chiplet to swap with ' + st.map[st.pick] + '.</b>' : '');
    }
    draw();
  });

  /* ---------- minimum-latency custom interconnect ---------- */
  CSO.widget('mininter', function (el) {
    var f = K.frame(el, 'All-to-all between two layers in N cycles', 'Each router sends or receives one packet per cycle (N = 3)');
    var SCHED = [
      [1, [[1, 1, 'h'], [2, 2, 'h'], [3, 3, 'h']]],
      [2, [[1, 2, 'd', 1], [2, 3, 'd', 2], [3, 2, 'u', 3], [2, 1, 'u', 2]]],
      [3, [[1, 3, 'd', 2], [3, 1, 'u', 2]]]
    ];
    var sv = K.svg(640, 260); f.stage.appendChild(sv);
    var sC = K.stat(f.out, 'Cycle', 'v'), sD = K.stat(f.out, 'Packets delivered', 'c');
    var pl = K.player(f.ctrl, { max: function () { return 3; }, render: render, interval: 1300 });
    function render(t) {
      K.clear(sv); K.arrowDefs(sv, 'ah-mi', 'f-m');
      var LX = 80, RX = 260, Y = [50, 130, 210];
      sv.appendChild(s('text', { x: LX, y: 18, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'layer k' }));
      sv.appendChild(s('text', { x: RX, y: 18, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'layer k+1' }));
      [0, 1, 2].forEach(function (i) {
        sv.appendChild(s('line', { x1: LX + 20, y1: Y[i], x2: RX - 22, y2: Y[i], class: 's-line w2' }));
        if (i < 2) sv.appendChild(s('line', { x1: RX + 8, y1: Y[i] + 20, x2: RX + 8, y2: Y[i + 1] - 20, class: 's-line w2' }));
      });
      var delivered = 0, lines = [];
      SCHED.forEach(function (row) {
        if (row[0] > t) return;
        row[1].forEach(function (p) {
          var cur = row[0] === t;
          var cls = cur ? 's-m w3' : 's-mut w1';
          if (p[2] === 'h') sv.appendChild(s('line', { x1: LX + 20, y1: Y[p[0] - 1] - 4, x2: RX - 22, y2: Y[p[1] - 1] - 4, class: cls, 'marker-end': cur ? 'url(#ah-mi)' : null }));
          else { var y1 = Y[p[3] - 1], y2 = Y[p[1] - 1]; sv.appendChild(s('line', { x1: RX + 20, y1: y1 + (y2 > y1 ? 20 : -20), x2: RX + 20, y2: y2 + (y2 > y1 ? -22 : 22), class: cls, 'marker-end': cur ? 'url(#ah-mi)' : null })); }
          if (cur) lines.push('R' + p[0] + ',k → R' + p[1] + ',k+1');
          delivered++;
        });
      });
      [0, 1, 2].forEach(function (i) {
        sv.appendChild(s('circle', { cx: LX, cy: Y[i], r: 20, class: 'f-ms s-m w15' }));
        sv.appendChild(s('text', { x: LX, y: Y[i] + 4, 'text-anchor': 'middle', class: 't-sm t-b', text: i + 1 }));
        sv.appendChild(s('circle', { cx: RX, cy: Y[i], r: 20, class: 'f-cs s-c w15' }));
        sv.appendChild(s('text', { x: RX, y: Y[i] + 4, 'text-anchor': 'middle', class: 't-sm t-b', text: i + 1 }));
      });
      sv.appendChild(s('text', { x: 330, y: 50, class: 't-sm t-b', text: t ? 'Cycle ' + t + ' transactions:' : 'Press Step' }));
      lines.forEach(function (l, i) { sv.appendChild(s('text', { x: 330, y: 74 + i * 22, class: 't-sm t-mono t-m', text: l })); });
      sC(t + ' of 3'); sD(delivered + ' of 9');
      f.note.innerHTML = 'Cycle 1 uses the horizontal links (every router sends straight across). Later cycles forward packets up and down the vertical links in layer k+1, and no link carries two packets in the same direction in the same cycle, so there is no congestion. Nine packets need at least 3 cycles because each sending router injects one packet per cycle and has 3 to send: this schedule hits that lower bound, and the lecture proves by induction that N routers per layer need exactly N cycles.';
    }
    render(0);
  });

  /* ---------- COIN: number of compute elements ---------- */
  CSO.widget('coin', function (el) {
    var f = K.frame(el, 'Choosing the number of compute elements (COIN)', 'Intra-CE traffic falls as k grows; inter-CE traffic rises');
    var st = { N: 2708, w: 4 };
    K.select(f.ctrl, { label: 'Graph nodes N', value: '2708', options: [['2708', 'Cora 2,708'], ['3327', 'Citeseer 3,327'], ['19717', 'Pubmed 19,717']], on: function (v) { st.N = +v; draw(); } });
    K.slider(f.ctrl, { label: 'Inter-CE cost weight', min: 1, max: 10, value: st.w, on: function (v) { st.w = v; draw(); } });
    var sv = K.svg(600, 250); f.stage.appendChild(sv);
    var sK = K.stat(f.out, 'Best k (CEs)', 'v');
    function E(k) { var n = st.N / k; return n * (n - 1) * k * 1 + n * n * k * 0 + st.w * k * k; }
    function draw() {
      K.clear(sv);
      var ks = []; for (var k = 2; k <= 200; k++) ks.push(k);
      var es = ks.map(E), mx = Math.max.apply(null, es), mn = Math.min.apply(null, es), best = ks[es.indexOf(mn)];
      var X0 = 50, PW = 520, PH = 190;
      function px(k) { return X0 + (k - 2) / 198 * PW; } function py(e) { return 14 + (1 - (Math.log10(e) - Math.log10(mn)) / (Math.log10(mx) - Math.log10(mn) + 1e-9)) * PH; }
      var d = ''; ks.forEach(function (k, i) { d += (i ? 'L' : 'M') + px(k).toFixed(1) + ' ' + py(es[i]).toFixed(1); });
      sv.appendChild(s('line', { x1: X0, y1: 14 + PH, x2: X0 + PW, y2: 14 + PH, class: 's-mut w1' }));
      sv.appendChild(s('path', { d: d, class: 'f-none s-c w2' }));
      sv.appendChild(s('circle', { cx: px(best), cy: py(mn), r: 6, class: 'f-m' }));
      [2, 50, 100, 150, 200].forEach(function (k) { sv.appendChild(s('text', { x: px(k), y: 14 + PH + 16, 'text-anchor': 'middle', class: 't-sm t-mut', text: k })); });
      sv.appendChild(s('text', { x: X0 + PW / 2, y: 248, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'number of compute elements k (energy on a log scale)' }));
      sK(best);
      f.note.innerHTML = 'A toy version of COIN\'s energy model: traffic inside a CE grows like (N/k)² per CE, while the NoC between CEs costs more as k grows. The real expression, Σ over layers of (N/k)(N/k − 1)·a(i)·k for intra-CE plus (N/k)(N/k)·a(i)·k for inter-CE traffic, is convex in k, so COIN finds the best k with an interior-point solver.';
    }
    draw();
  });

  /* ---------- linear quantization ---------- */
  CSO.widget('quant', function (el) {
    var f = K.frame(el, '8-bit linear quantization: scale and zero point', 'x_q = round(x / scale) + zero_point');
    var st = { mode: 'asym', clip: false };
    var inp = h('input', { type: 'text', id: K.id('q'), value: '-1.2, -0.4, 0.0, 0.3, 0.9, 1.6, 2.4, 8.0' });
    f.ctrl.appendChild(h('label', { for: inp.id }, 'Tensor values', inp));
    inp.addEventListener('input', draw);
    K.seg(f.ctrl, { label: 'Scheme', value: 'asym', options: [['asym', 'Asymmetric (uint8)'], ['sym', 'Symmetric (int8)']], on: function (v) { st.mode = v; draw(); } });
    K.seg(f.ctrl, { label: 'Outlier', value: 'no', options: [['no', 'Use full range'], ['clip', 'Clip the outlier']], on: function (v) { st.clip = v === 'clip'; draw(); } });
    var sS = K.stat(f.out, 'scale', 'v'), sZ = K.stat(f.out, 'zero point', 'm'), sE = K.stat(f.out, 'Mean |error|', 'c');
    var tbl = h('div', { class: 'tbl-wrap' }); f.stage.appendChild(tbl);
    function draw() {
      var x = inp.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(function (v) { return !isNaN(v); });
      if (!x.length) return;
      var lo = Math.min.apply(null, x), hi = Math.max.apply(null, x);
      if (st.clip) { var sorted = x.slice().sort(function (a, b) { return a - b; }); hi = sorted[sorted.length - 2]; lo = Math.min(lo, sorted[0]); }
      var scale, zp, qmin, qmax;
      if (st.mode === 'asym') { qmin = 0; qmax = 255; scale = (hi - Math.min(0, lo)) / 255 || 1; zp = Math.round(-Math.min(0, lo) / scale); }
      else { qmin = -127; qmax = 127; scale = Math.max(Math.abs(lo), Math.abs(hi)) / 127 || 1; zp = 0; }
      var rows = x.map(function (v) { var q = Math.max(qmin, Math.min(qmax, Math.round(v / scale) + zp)); var dq = (q - zp) * scale; return [v, q, dq, Math.abs(dq - v)]; });
      var err = rows.reduce(function (a, r) { return a + r[3]; }, 0) / rows.length;
      sS(scale.toFixed(5)); sZ(zp); sE(err.toFixed(4));
      tbl.innerHTML = '<table class="tbl"><thead><tr><th class="num">x (float)</th><th class="num">x_q (int)</th><th class="num">dequantized</th><th class="num">error</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td class="num">' + r[0] + '</td><td class="num"><b>' + r[1] + '</b></td><td class="num">' + r[2].toFixed(3) + '</td><td class="num">' + r[3].toFixed(4) + '</td></tr>'; }).join('') + '</tbody></table>';
      f.note.innerHTML = 'The outlier 8.0 stretches the range, so every other value lands on a coarse grid. Clipping it (and accepting its own large error) shrinks the scale and the error for the rest, which is why calibration methods such as MinMax, MinMSE or percentile clipping matter. Static quantization fixes scale and zero point offline from calibration data; dynamic quantization computes them for activations at run time.';
    }
    draw();
  });
})();
