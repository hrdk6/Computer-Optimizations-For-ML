/* Widgets for training at scale: ring all-reduce, pipeline schedules, Alpa latency, CheckFreq. */
(function () {
  'use strict';
  var h = K.h, s = K.s;
  var CHUNK_CLS = ['f-c', 'f-m', 'f-v', 'f-mut', 'f-ink', 'f-cs'];

  /* ---------- ring all-reduce ---------- */
  CSO.widget('ring', function (el) {
    var f = K.frame(el, 'Ring all-reduce, step by step', 'Each process owns a gradient array split into P chunks');
    var st = { P: 4 };
    K.select(f.ctrl, { label: 'Processes P', value: '4', options: ['3', '4', '5', '6'], on: function (v) { st.P = +v; pl.reset(); } });
    var sStep = K.stat(f.out, 'Step', 'v'), sSent = K.stat(f.out, 'Data sent per process so far', 'm'), sTot = K.stat(f.out, 'Total per process: 2N(P−1)/P', 'c'), sNaive = K.stat(f.out, 'All-to-all messages: P(P−1)', '');
    var sv = K.svg(640, 300); f.stage.appendChild(sv);
    var pl = K.player(f.ctrl, { max: function () { return 2 * (st.P - 1); }, render: render, interval: 1100 });
    function simulate(t) {
      var P = st.P, have = [];
      for (var p = 0; p < P; p++) { have.push([]); for (var c = 0; c < P; c++) have[p].push(1 << p); }
      var moves = [];
      for (var step = 0; step < t; step++) {
        moves = [];
        var snap = have.map(function (r) { return r.slice(); });
        for (p = 0; p < P; p++) {
          var to = (p + 1) % P, chunk;
          if (step < P - 1) { chunk = ((p - step) % P + P) % P; have[to][chunk] = snap[to][chunk] | snap[p][chunk]; }
          else { var k = step - (P - 1); chunk = ((p + 1 - k) % P + P) % P; have[to][chunk] = snap[p][chunk]; }
          moves.push([p, to, chunk]);
        }
      }
      return { have: have, moves: moves };
    }
    function bits(x) { var n = 0; while (x) { n += x & 1; x >>= 1; } return n; }
    function render(t) {
      var P = st.P, r = simulate(t);
      K.clear(sv); K.arrowDefs(sv, 'ah-ring', 'f-m');
      var cw = 52, rh = 40, ox = 110, oy = 34;
      sv.setAttribute('viewBox', '0 0 ' + (ox + P * cw + 170) + ' ' + (oy + P * rh + 30));
      for (var c = 0; c < P; c++) sv.appendChild(s('text', { x: ox + c * cw + cw / 2 - 2, y: 20, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'chunk ' + c }));
      for (var p = 0; p < P; p++) {
        sv.appendChild(s('text', { x: 0, y: oy + p * rh + 24, class: 't-sm t-b', text: 'GPU ' + p }));
        for (c = 0; c < P; c++) {
          var n = bits(r.have[p][c]), full = n === P;
          var g = s('g');
          g.appendChild(s('rect', { x: ox + c * cw, y: oy + p * rh, width: cw - 6, height: rh - 8, rx: 4, class: full ? 'f-cs s-c w2' : 'f-surf s-line w1' }));
          for (var q = 0; q < P; q++) if (r.have[p][c] & (1 << q)) g.appendChild(s('rect', { x: ox + c * cw + 4 + q * ((cw - 14) / P), y: oy + p * rh + rh - 18, width: (cw - 14) / P - 1, height: 6, class: CHUNK_CLS[q % CHUNK_CLS.length] }));
          g.appendChild(s('text', { x: ox + c * cw + (cw - 6) / 2, y: oy + p * rh + 17, 'text-anchor': 'middle', class: 't-sm t-mono', text: n + '/' + P }));
          sv.appendChild(g);
        }
      }
      if (t > 0) r.moves.forEach(function (m) {
        var y1 = oy + m[0] * rh + 16, y2 = oy + m[1] * rh + 16, x = ox + P * cw + 14 + (m[0] % 2) * 18;
        if (m[1] === 0) { sv.appendChild(s('path', { d: 'M' + (x + 30) + ' ' + y1 + ' C ' + (x + 90) + ' ' + y1 + ', ' + (x + 90) + ' ' + y2 + ', ' + (x + 30) + ' ' + y2, class: 'f-none s-m w15 dash', 'marker-end': 'url(#ah-ring)' })); }
        else sv.appendChild(s('line', { x1: x, y1: y1 + 4, x2: x, y2: y2 - 6, class: 's-m w15', 'marker-end': 'url(#ah-ring)' }));
        sv.appendChild(s('text', { x: x + 6, y: (y1 + y2) / 2 + 4, class: 't-sm t-m', text: 'c' + m[2] }));
      });
      var phase = t === 0 ? 'Start' : t <= P - 1 ? 'Scatter-reduce ' + t + '/' + (P - 1) : 'All-gather ' + (t - P + 1) + '/' + (P - 1);
      sStep(phase); sSent((t) + ' × N/' + P); sTot('2(' + P + '−1)·N/' + P + ' = ' + (2 * (P - 1) / P).toFixed(2) + 'N'); sNaive(P * (P - 1));
      f.note.innerHTML = t === 0 ? 'The small bars inside a cell show which GPUs\' gradients are already summed into that chunk. Every step, each GPU sends one chunk (size N/P) to its right neighbour.'
        : t < P - 1 ? 'Scatter-reduce: the receiver adds the incoming chunk to its own copy. Links are all busy at once and every message is only N/P long.'
          : t === P - 1 ? 'After P − 1 steps each GPU owns one fully reduced chunk (teal). Now the all-gather phase passes those finished chunks around the ring.'
            : t < 2 * (P - 1) ? 'All-gather: receivers overwrite their copy with the finished chunk.' : 'Every GPU now holds the full summed gradient. Each sent 2(P − 1) chunks of N/P, about 2N in total, almost independent of P. What limits scaling is N itself (the model and gradient size).';
    }
    render(0);
  });

  /* ---------- pipeline schedules ---------- */
  CSO.widget('pipeline', function (el) {
    var f = K.frame(el, 'Model parallel vs GPipe vs PipeDream (1F1B)', '4 GPUs, each holding a quarter of the layers');
    var st = { mode: 'gpipe', M: 4, bw: 2 };
    K.seg(f.ctrl, { label: 'Schedule', value: st.mode, options: [['mp', 'Model parallel'], ['gpipe', 'GPipe'], ['pipedream', 'PipeDream 1F1B']], on: function (v) { st.mode = v; draw(); } });
    K.select(f.ctrl, { label: 'Micro-batches', value: '4', options: ['2', '4', '6', '8'], on: function (v) { st.M = +v; draw(); } });
    K.select(f.ctrl, { label: 'Backward cost', value: '2', options: [['1', '= forward'], ['2', '2 × forward']], on: function (v) { st.bw = +v; draw(); } });
    var sSpan = K.stat(f.out, 'Time for the work shown', 'v'), sUtil = K.stat(f.out, 'GPU utilization', 'c'), sBub = K.stat(f.out, 'Idle (bubble) share', 'm');
    var sv = K.svg(720, 220); f.stage.appendChild(sv);
    var S = 4;
    function schedule() {
      var M = st.M, F = 1, B = st.bw, orders = [], tasks = {};
      if (st.mode === 'mp') {
        // one big batch: forward of the whole batch on each stage, then backward
        for (var sI = 0; sI < S; sI++) orders.push([['F', 0, M * F], ['B', 0, M * B]]);
      } else if (st.mode === 'gpipe') {
        for (sI = 0; sI < S; sI++) { var o = []; for (var m = 0; m < M; m++) o.push(['F', m, F]); for (m = M - 1; m >= 0; m--) o.push(['B', m, B]); orders.push(o); }
      } else {
        var total = 2 * M; // stream of micro-batches without a flush
        for (sI = 0; sI < S; sI++) {
          o = []; var warm = Math.min(S - sI - 1, total), fi = 0, bi = 0;
          for (; fi < warm; fi++) o.push(['F', fi, F]);
          while (fi < total) { o.push(['F', fi, F]); fi++; o.push(['B', bi, B]); bi++; }
          while (bi < total) { o.push(['B', bi, B]); bi++; }
          orders.push(o);
        }
      }
      // simulate with dependencies
      var end = {}, free = [0, 0, 0, 0], ptr = [0, 0, 0, 0], out = [], guard = 0;
      while (ptr.some(function (p, i) { return p < orders[i].length; }) && guard++ < 5000) {
        var progressed = false;
        for (sI = 0; sI < S; sI++) {
          if (ptr[sI] >= orders[sI].length) continue;
          var tk = orders[sI][ptr[sI]], dep = null;
          if (tk[0] === 'F') dep = sI === 0 ? 0 : end['F' + tk[1] + '_' + (sI - 1)];
          else dep = sI === S - 1 ? end['F' + tk[1] + '_' + sI] : end['B' + tk[1] + '_' + (sI + 1)];
          if (dep === undefined) continue;
          var start = Math.max(free[sI], dep), fin = start + tk[2];
          end[tk[0] + tk[1] + '_' + sI] = fin; free[sI] = fin; ptr[sI]++; progressed = true;
          out.push({ s: sI, k: tk[0], m: tk[1], a: start, b: fin });
        }
        if (!progressed) break;
      }
      return out;
    }
    function draw() {
      var tasks = schedule(), span = Math.max.apply(null, tasks.map(function (t) { return t.b; }));
      var busy = tasks.reduce(function (a, t) { return a + t.b - t.a; }, 0);
      K.clear(sv);
      var X0 = 64, PW = 640, unit = PW / span, RH = 40;
      for (var sI = 0; sI < S; sI++) {
        sv.appendChild(s('text', { x: 0, y: 26 + sI * RH + 16, class: 't-sm t-b', text: 'GPU ' + (sI + 1) }));
        sv.appendChild(s('rect', { x: X0, y: 26 + sI * RH, width: PW, height: RH - 8, class: 'f-panel' }));
      }
      tasks.forEach(function (t) {
        var x = X0 + t.a * unit, w = (t.b - t.a) * unit;
        sv.appendChild(s('rect', { x: x + 0.5, y: 26 + t.s * RH, width: Math.max(1, w - 1), height: RH - 8, rx: 2, class: t.k === 'F' ? 'f-c' : 'f-m' }));
        if (w > 16) sv.appendChild(s('text', { x: x + w / 2, y: 26 + t.s * RH + 20, 'text-anchor': 'middle', class: 't-sm t-inv t-b', text: st.mode === 'mp' ? (t.k === 'F' ? 'forward' : 'backward') : t.k + (t.m + 1) }));
      });
      for (var g = 0; g <= span; g += Math.max(1, Math.round(span / 12))) sv.appendChild(s('text', { x: X0 + g * unit, y: 26 + S * RH + 12, 'text-anchor': 'middle', class: 't-sm t-mut', text: g }));
      var util = busy / (S * span);
      sSpan(span + ' units'); sUtil(Math.round(util * 100) + '%'); sBub(Math.round((1 - util) * 100) + '%');
      f.note.innerHTML = {
        mp: '<b>Model parallelism:</b> the model is split by layers, so only one GPU works at a time. Communication is point-to-point and memory capacity grows with the number of GPUs, but most of the timeline is idle.',
        gpipe: '<b>GPipe</b> splits the batch into micro-batches and pipelines them: all forwards, then all backwards, then one weight update. Bubbles shrink as micro-batches grow but never vanish. Gradients are exact (no staleness), like batch SGD with batch = micro-batch size × workers.',
        pipedream: '<b>PipeDream 1F1B</b> alternates one forward and one backward per GPU after a short warm-up and keeps streaming new micro-batches with no flush, so the steady state has almost no bubbles. The price: a micro-batch\'s forward and backward may see different weight versions, so PipeDream keeps several weight copies (weight stashing).'
      }[st.mode];
    }
    draw();
  });

  /* ---------- Alpa pipeline latency ---------- */
  CSO.widget('pipelat', function (el) {
    var f = K.frame(el, 'Pipeline latency of a stage assignment (Alpa)', 'T = Σ tᵢ + (B − 1) · max tᵢ');
    var st = { t: [2, 3, 5, 2], B: 5 };
    st.t.forEach(function (v, i) { K.slider(f.ctrl, { label: 'Stage ' + (i + 1), min: 1, max: 6, value: v, on: function (x) { st.t[i] = x; draw(); } }); });
    K.slider(f.ctrl, { label: 'Batches B', min: 1, max: 8, value: st.B, on: function (x) { st.B = x; draw(); } });
    var sT = K.stat(f.out, 'Pipeline latency T', 'v'), sSum = K.stat(f.out, 'One batch through all stages Σt', 'c'), sMax = K.stat(f.out, 'Slowest stage max t', 'm');
    var sv = K.svg(700, 210); f.stage.appendChild(sv);
    function draw() {
      var n = st.t.length, B = st.B, end = [], blocks = [];
      for (var b = 0; b < B; b++) { end.push([]); for (var i = 0; i < n; i++) { var a = Math.max(i ? end[b][i - 1] : 0, b ? end[b - 1][i] : 0); end[b].push(a + st.t[i]); blocks.push([i, b, a, a + st.t[i]]); } }
      var span = end[B - 1][n - 1], sum = st.t.reduce(function (x, y) { return x + y; }), mx = Math.max.apply(null, st.t);
      K.clear(sv);
      var X0 = 70, PW = 610, unit = PW / span, RH = 38;
      for (i = 0; i < n; i++) { sv.appendChild(s('text', { x: 0, y: 14 + i * RH + 18, class: 't-sm', text: 'Stage ' + (i + 1) })); sv.appendChild(s('rect', { x: X0, y: 14 + i * RH, width: PW, height: RH - 8, class: 'f-panel' })); }
      blocks.forEach(function (k) {
        var slow = st.t[k[0]] === mx;
        sv.appendChild(s('rect', { x: X0 + k[2] * unit + 0.5, y: 14 + k[0] * RH, width: (k[3] - k[2]) * unit - 1, height: RH - 8, rx: 2, class: slow ? 'f-m' : 'f-c' }));
        if ((k[3] - k[2]) * unit > 18) sv.appendChild(s('text', { x: X0 + (k[2] + k[3]) / 2 * unit, y: 14 + k[0] * RH + 19, 'text-anchor': 'middle', class: 't-sm t-inv t-b', text: 'b' + (k[1] + 1) }));
      });
      sv.appendChild(s('text', { x: X0, y: 14 + n * RH + 14, class: 't-sm t-mut', text: '0' }));
      sv.appendChild(s('text', { x: X0 + PW, y: 14 + n * RH + 14, 'text-anchor': 'end', class: 't-sm t-mut', text: 'T = ' + span }));
      sT(span); sSum(sum); sMax(mx);
      f.note.innerHTML = 'Simulated finish time ' + span + ' = ' + sum + ' + (' + B + ' − 1) × ' + mx + '. The slowest stage (copper) sets the beat of the whole pipeline, so Alpa\'s dynamic program enumerates the possible max-stage latency and then packs operators into (stage, submesh) pairs to minimise Σt for that bound, a 2-D knapsack.';
    }
    draw();
  });

  /* ---------- CheckFreq timeline ---------- */
  CSO.widget('ckpt', function (el) {
    var f = K.frame(el, 'Checkpoint stalls: synchronous vs pipelined (CheckFreq)', 'Checkpoint every 3 iterations; snapshot copies GPU → CPU, persist writes CPU → disk');
    var st = { mode: 'sync', snap: 1.5, persist: 4 };
    K.seg(f.ctrl, { label: 'Mechanism', value: 'sync', options: [['sync', 'Synchronous'], ['persist', 'Persist pipelined'], ['both', 'Snapshot + persist pipelined']], on: function (v) { st.mode = v; draw(); } });
    K.slider(f.ctrl, { label: 'Snapshot time', min: 0.5, max: 3, step: 0.5, value: st.snap, on: function (v) { st.snap = v; draw(); } });
    K.slider(f.ctrl, { label: 'Persist time', min: 1, max: 8, step: 0.5, value: st.persist, on: function (v) { st.persist = v; draw(); } });
    var sTot = K.stat(f.out, 'Time for 9 iterations', 'v'), sSt = K.stat(f.out, 'GPU stall', 'm'), sBase = K.stat(f.out, 'Without checkpoints', 'c');
    var sv = K.svg(720, 150); f.stage.appendChild(sv);
    function draw() {
      var Fw = 1, Bw = 1.5, Uw = 0.5, iters = 9, every = 3;
      var gpu = [], cpu = [], t = 0, snapEnd = -1, persistEnd = 0, stall = 0;
      for (var it = 1; it <= iters; it++) {
        gpu.push(['F', t, t + Fw, it]); t += Fw;
        gpu.push(['B', t, t + Bw, it]); t += Bw;
        var uStart = t;
        if (st.mode === 'both' && snapEnd > t) { stall += snapEnd - t; gpu.push(['wait', t, snapEnd]); uStart = snapEnd; }
        gpu.push(['U', uStart, uStart + Uw, it]); t = uStart + Uw;
        if (it % every === 0) {
          if (st.mode === 'sync') {
            gpu.push(['snap', t, t + st.snap]); cpu.push(['snap', t, t + st.snap]); t += st.snap;
            gpu.push(['persist', t, t + st.persist]); cpu.push(['persist', t, t + st.persist]); stall += st.snap + st.persist; t += st.persist;
          } else if (st.mode === 'persist') {
            var start = t; if (persistEnd > t) { stall += persistEnd - t; gpu.push(['wait', t, persistEnd]); start = persistEnd; }
            gpu.push(['snap', start, start + st.snap]); cpu.push(['snap', start, start + st.snap]); stall += st.snap; t = start + st.snap;
            cpu.push(['persist', t, t + st.persist]); persistEnd = t + st.persist;
          } else {
            var s0 = Math.max(t, persistEnd);
            cpu.push(['snap', s0, s0 + st.snap]); snapEnd = s0 + st.snap;
            cpu.push(['persist', snapEnd, snapEnd + st.persist]); persistEnd = snapEnd + st.persist;
          }
        }
      }
      var span = Math.max(t, persistEnd), base = iters * (Fw + Bw + Uw);
      K.clear(sv);
      var X0 = 92, PW = 610, unit = PW / span;
      [['GPU (training)', gpu, 20], ['CPU (checkpoint)', cpu, 70]].forEach(function (lane) {
        sv.appendChild(s('text', { x: 0, y: lane[2] + 20, class: 't-sm', text: lane[0] }));
        sv.appendChild(s('rect', { x: X0, y: lane[2], width: PW, height: 32, class: 'f-panel' }));
        lane[1].forEach(function (b) {
          var cls = { F: 'f-c', B: 'f-cs', U: 'f-v', snap: 'f-m', persist: 'f-ms', wait: 'f-mut' }[b[0]];
          var r = s('rect', { x: X0 + b[1] * unit, y: lane[2] + 2, width: Math.max(1, (b[2] - b[1]) * unit - 0.6), height: 28, rx: 2, class: cls });
          if (b[0] === 'wait' || (lane[2] === 20 && (b[0] === 'snap' || b[0] === 'persist'))) r.setAttribute('opacity', '0.55');
          sv.appendChild(r);
        });
      });
      var lg = [['f-c', 'forward'], ['f-cs', 'backward'], ['f-v', 'weight update'], ['f-m', 'snapshot'], ['f-ms', 'persist'], ['f-mut', 'stall']];
      lg.forEach(function (l, i) { sv.appendChild(s('rect', { x: X0 + i * 100, y: 120, width: 12, height: 12, class: l[0] })); sv.appendChild(s('text', { x: X0 + i * 100 + 16, y: 131, class: 't-sm', text: l[1] })); });
      sTot(span.toFixed(1)); sSt(stall.toFixed(1)); sBase(base.toFixed(1));
      f.note.innerHTML = {
        sync: 'Synchronous checkpointing halts training for the whole snapshot and the whole disk write. This is why people only checkpointed at epoch boundaries.',
        persist: 'With persist pipelined, training only stops for the GPU → CPU copy; the disk write overlaps with the next iterations. CheckFreq reports about 2× lower cost this way, but the snapshot still stalls.',
        both: 'Fully pipelined: the next iteration\'s forward and backward run during the snapshot. Only its weight update must wait until the copy finishes, otherwise the checkpoint would mix old and new weights. The remaining stall is tiny.'
      }[st.mode];
    }
    draw();
  });
})();
