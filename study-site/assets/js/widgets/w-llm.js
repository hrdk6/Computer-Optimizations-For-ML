/* Widgets for LLM systems: attention, KV cache, PagedAttention, batching, Sarathi, speculative sampling, roofline, FlashAttention. */
(function () {
  'use strict';
  var h = K.h, s = K.s;

  /* ---------- self-attention heatmap ---------- */
  CSO.widget('attention', function (el) {
    var f = K.frame(el, 'Self-attention on "YOUR CAT IS A LOVELY CAT"', 'softmax(QKᵀ/√d) with Q = K = V = embedding + position');
    var EMB = { YOUR: [0.9, 0.1, 0.3, -0.2, 0.4, 0.0], CAT: [0.1, 1.0, -0.3, 0.6, 0.0, 0.3], IS: [-0.4, 0.2, 0.9, 0.1, 0.2, -0.3], A: [0.0, -0.3, 0.4, 0.8, -0.2, 0.2], LOVELY: [0.6, 0.5, 0.1, -0.1, 0.9, 0.4] };
    var BASE = ['YOUR', 'CAT', 'IS', 'A', 'LOVELY', 'CAT'];
    var st = { pe: true, mask: false, order: BASE.slice(), row: 1 };
    var d = 6;
    function pe(pos, i) { var ang = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / d); return 0.45 * (i % 2 === 0 ? Math.sin(ang) : Math.cos(ang)); }
    K.seg(f.ctrl, { label: 'Positional encoding', value: 'on', options: [['on', 'With positional encoding'], ['off', 'Without']], on: function (v) { st.pe = v === 'on'; draw(); } });
    K.seg(f.ctrl, { label: 'Mask', value: 'off', options: [['off', 'Encoder (no mask)'], ['on', 'Decoder (causal mask)']], on: function (v) { st.mask = v === 'on'; draw(); } });
    K.button(f.ctrl, 'Shuffle the words', function () { st.order = st.order.slice().sort(function () { return Math.random() - 0.5; }); draw(); });
    K.button(f.ctrl, 'Original order', function () { st.order = BASE.slice(); draw(); });
    var sv = K.svg(640, 330); f.stage.appendChild(sv);
    function draw() {
      var X = st.order.map(function (w, pos) { return EMB[w].map(function (v, i) { return v + (st.pe ? pe(pos, i) : 0); }); });
      var n = X.length, S = [], P = [];
      for (var i = 0; i < n; i++) {
        S.push([]); for (var j = 0; j < n; j++) { var dot = 0; for (var k = 0; k < d; k++) dot += X[i][k] * X[j][k]; S[i].push(dot / Math.sqrt(d)); }
        var row = S[i].map(function (v, j) { return st.mask && j > i ? -Infinity : v; });
        var mx = Math.max.apply(null, row.filter(isFinite)), ex = row.map(function (v) { return isFinite(v) ? Math.exp(v - mx) : 0; }), sum = ex.reduce(function (a, b) { return a + b; }, 0);
        P.push(ex.map(function (v) { return v / sum; }));
      }
      K.clear(sv);
      var C = 58, ox = 100, oy = 70;
      for (j = 0; j < n; j++) sv.appendChild(s('text', { x: ox + j * C + C / 2, y: oy - 10, 'text-anchor': 'middle', class: 't-sm t-b', text: st.order[j] }));
      sv.appendChild(s('text', { x: ox + n * C / 2, y: 24, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'keys K (what each word offers)' }));
      for (i = 0; i < n; i++) {
        var g = s('g', { style: 'cursor:pointer', onclick: (function (ii) { return function () { st.row = ii; draw(); }; })(i) });
        g.appendChild(s('text', { x: ox - 10, y: oy + i * 40 + 24, 'text-anchor': 'end', class: 't-sm t-b' + (i === st.row ? ' t-c' : ''), text: st.order[i] }));
        for (j = 0; j < n; j++) {
          var masked = st.mask && j > i, v = P[i][j];
          var r = s('rect', { x: ox + j * C, y: oy + i * 40, width: C - 3, height: 37, rx: 3, class: masked ? 'f-panel' : 'f-c' });
          if (!masked) r.setAttribute('opacity', (0.12 + 0.88 * v).toFixed(2));
          g.appendChild(r);
          g.appendChild(s('text', { x: ox + j * C + (C - 3) / 2, y: oy + i * 40 + 23, 'text-anchor': 'middle', class: 't-sm t-mono' + (v > 0.45 ? ' t-inv' : ''), text: masked ? '−∞' : v.toFixed(2) }));
        }
        if (i === st.row) g.appendChild(s('rect', { x: ox - 2, y: oy + i * 40 - 2, width: n * C + 1, height: 41, rx: 4, class: 'f-none s-m w2' }));
        sv.appendChild(g);
      }
      sv.appendChild(s('text', { x: 14, y: oy + n * 20, class: 't-sm t-mut', transform: 'rotate(-90 14 ' + (oy + n * 20) + ')', 'text-anchor': 'middle', text: 'queries Q' }));
      var top = P[st.row].map(function (v, j) { return [v, j]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 3);
      f.note.innerHTML = 'Row <b>' + st.order[st.row] + '</b> (position ' + st.row + '): its output is ' + top.map(function (t) { return t[0].toFixed(2) + '·V(' + st.order[t[1]] + ')'; }).join(' + ') + ' + …. Each row sums to 1. ' +
        (st.pe ? 'The two CAT rows differ only because of their positions.' : '<b>Without positional encoding the two CAT rows are identical</b>, and shuffling words only permutes rows and columns: self-attention alone is permutation invariant.') +
        (st.mask ? ' With the causal mask, future positions are set to −∞ before softmax, so they get weight 0.' : ' The diagonal is usually the largest entry: a word is most similar to itself.') + ' Select a row to inspect it.';
    }
    draw();
  });

  /* ---------- sinusoidal positional encoding ---------- */
  CSO.widget('posenc', function (el) {
    var f = K.frame(el, 'Sinusoidal positional encoding', 'Rows are positions, columns are embedding dimensions');
    var st = { d: 64, pos: 3 };
    K.select(f.ctrl, { label: 'd_model (shown)', value: '64', options: ['32', '64', '128'], on: function (v) { st.d = +v; draw(); } });
    K.slider(f.ctrl, { label: 'Highlight position', min: 0, max: 23, value: st.pos, on: function (v) { st.pos = v; draw(); } });
    var P = 24, sv = K.svg(640, 312); f.stage.appendChild(sv);
    function pe(p, i, d) { var ang = p / Math.pow(10000, (2 * Math.floor(i / 2)) / d); return i % 2 === 0 ? Math.sin(ang) : Math.cos(ang); }
    function draw() {
      K.clear(sv);
      var ox = 56, oy = 22, cw = Math.min(16, 560 / st.d), ch = 11;
      for (var p = 0; p < P; p++) {
        for (var i = 0; i < st.d; i++) {
          var v = pe(p, i, st.d);
          sv.appendChild(s('rect', { x: ox + i * cw, y: oy + p * ch, width: Math.max(1, cw - 1), height: ch - 1, class: v >= 0 ? 'f-c' : 'f-m', opacity: (0.08 + 0.92 * Math.abs(v)).toFixed(2) }));
        }
        if (p % 4 === 0) sv.appendChild(s('text', { x: ox - 6, y: oy + p * ch + 9, 'text-anchor': 'end', class: 't-sm t-mut', text: p }));
      }
      sv.appendChild(s('rect', { x: ox - 2, y: oy + st.pos * ch - 1, width: st.d * cw + 3, height: ch + 1, class: 'f-none s-ink w15' }));
      sv.appendChild(s('text', { x: ox, y: 14, class: 't-sm t-mut', text: 'dim 0 (fast wave)' }));
      sv.appendChild(s('text', { x: ox + st.d * cw, y: 14, 'text-anchor': 'end', class: 't-sm t-mut', text: 'dim ' + (st.d - 1) + ' (slow wave)' }));
      sv.appendChild(s('text', { x: ox, y: oy + P * ch + 18, class: 't-sm t-mut', text: 'teal = positive, copper = negative, stronger colour = larger |value|' }));
      var first = [0, 1, 2, 3].map(function (i) { return pe(st.pos, i, st.d).toFixed(3); });
      f.note.innerHTML = 'Position ' + st.pos + ' starts with [' + first.join(', ') + ', …]. Even dimensions use sin, odd ones cos, and the wavelength grows with the dimension index, so every position gets a unique pattern and nearby positions get similar ones. Nothing here is learned: the same matrix is computed once and added to every sentence\'s embeddings.';
    }
    draw();
  });

  /* ---------- KV cache calculator ---------- */
  CSO.widget('kvcalc', function (el) {
    var f = K.frame(el, 'How many requests fit on one GPU?', 'KV cache per request = 2 × bytes × layers × d_model × sequence length');
    var st = { P: 7, b: 2, L: 32, d: 4096, seq: 4096, mem: 80 };
    var ins = {};
    function num(key, label, unit, w) { ins[key] = K.number(f.ctrl, { label: label, value: st[key], unit: unit, width: w || '86px', on: function (v) { st[key] = v; draw(); } }); }
    num('P', 'Parameters', 'B');
    K.select(f.ctrl, { label: 'Precision', value: '2', options: [['4', 'FP32 (4 B)'], ['2', 'FP16 (2 B)'], ['1', 'INT8 (1 B)']], on: function (v) { st.b = +v; draw(); } });
    num('L', 'Layers'); num('d', 'd_model', '', '96px'); num('seq', 'Sequence', 'tokens', '96px'); num('mem', 'GPU memory', 'GB');
    K.button(f.ctrl, 'Lecture example: Llama2-7B on A100', function () { st = { P: 7, b: 2, L: 32, d: 4096, seq: 4096, mem: 80 }; Object.keys(ins).forEach(function (k) { ins[k].value = st[k]; }); draw(); });
    var sW = K.stat(f.out, 'Weights = bytes × params', 'm'), sKV = K.stat(f.out, 'KV cache per request', 'c'), sFree = K.stat(f.out, 'Memory left for KV', ''), sB = K.stat(f.out, 'Max batch (requests)', 'v');
    var sv = K.svg(620, 70); f.stage.appendChild(sv);
    var GiB = Math.pow(2, 30);
    function draw() {
      var w = st.P * 1e9 * st.b / GiB, kv = 2 * st.b * st.L * st.d * st.seq / GiB, free = st.mem - w, maxB = Math.max(0, Math.floor(free / kv));
      sW(w.toFixed(1) + ' GB'); sKV(kv.toFixed(2) + ' GB'); sFree(free.toFixed(1) + ' GB'); sB(free <= 0 ? 'model does not fit' : maxB);
      K.clear(sv);
      var W = 600, x = 0;
      sv.appendChild(s('rect', { x: 0, y: 10, width: W, height: 30, rx: 4, class: 'f-panel' }));
      var ww = Math.min(W, W * w / st.mem); sv.appendChild(s('rect', { x: 0, y: 10, width: ww, height: 30, rx: 3, class: 'f-m' })); x = ww;
      for (var i = 0; i < Math.min(maxB, 200); i++) { var kw = W * kv / st.mem; if (x + kw > W + 0.1) break; sv.appendChild(s('rect', { x: x + 0.5, y: 12, width: Math.max(0.5, kw - 1), height: 26, class: 'f-c' })); x += kw; }
      sv.appendChild(s('text', { x: 4, y: 58, class: 't-sm t-m', text: 'weights' }));
      sv.appendChild(s('text', { x: Math.min(ww + 6, 480), y: 58, class: 't-sm t-c', text: 'one block per request\'s KV cache' }));
      f.note.innerHTML = 'For the lecture setting: 2 × 2 B × 32 × 4096 × 4096 = 2³¹ bytes = 2 GB per request, and (80 − 14) / 2 ≈ 33 requests. (Here 1 GB = 2³⁰ bytes, so 7B × 2 B shows as 13.0 GB.) An 80 GB A100 serves only about 33 requests at once: the limit is memory, not compute. And 33 assumes the caches pack perfectly, which static allocation does not achieve.';
    }
    draw();
  });

  /* ---------- PagedAttention memory simulator ---------- */
  CSO.widget('paged', function (el) {
    var f = K.frame(el, 'KV cache memory: reserve-max vs exact vs paged', '32 token slots, max model length 12, block size 4');
    var REQ = [
      { id: 'A', arr: 0, prompt: 3, out: 2, text: 'How was your → day ⟨eos⟩' },
      { id: 'B', arr: 0, prompt: 4, out: 2, text: 'Help me write a → poem ⟨eos⟩' },
      { id: 'C', arr: 1, prompt: 2, out: 6 }, { id: 'D', arr: 1, prompt: 5, out: 4 },
      { id: 'E', arr: 2, prompt: 3, out: 7 }, { id: 'F', arr: 3, prompt: 4, out: 3 }, { id: 'G', arr: 3, prompt: 1, out: 2 }
    ];
    var CLS = { A: 'f-c', B: 'f-m', C: 'f-v', D: 'f-c', E: 'f-m', F: 'f-v', G: 'f-c' };
    var SOFT = { 'f-c': 'f-cs', 'f-m': 'f-ms', 'f-v': 'f-vs' };
    var MEM = 32, MAXLEN = 12, BS = 4;
    var st = { mode: 'static' };
    K.seg(f.ctrl, { label: 'Allocation', value: 'static', options: [['static', 'Reserve max length'], ['exact', 'Reserve exact length'], ['paged', 'Paged (vLLM)']], on: function (v) { st.mode = v; pl.reset(); } });
    var sUsed = K.stat(f.out, 'Slots holding KV', 'c'), sInt = K.stat(f.out, 'Reserved but empty (internal frag.)', 'm'), sWait = K.stat(f.out, 'Requests waiting', 'v'), sDone = K.stat(f.out, 'Finished', '');
    var sv = K.svg(640, 230); f.stage.appendChild(sv);
    function simulate(T) {
      var mem = new Array(MEM).fill(null), run = [], wait = [], done = [], frames = [];
      var reqs = REQ.map(function (r) { return Object.assign({ len: 0, slots: [] }, r); });
      function freeRuns() { var runs = [], i = 0; while (i < MEM) { if (mem[i] === null) { var j = i; while (j < MEM && mem[j] === null) j++; runs.push([i, j - i]); i = j; } else i++; } return runs; }
      function allocContig(r, n) { var f2 = freeRuns().filter(function (x) { return x[1] >= n; })[0]; if (!f2) return false; for (var k = 0; k < n; k++) { mem[f2[0] + k] = r.id; r.slots.push(f2[0] + k); } return true; }
      function freeBlocks() { var b = []; for (var k = 0; k < MEM / BS; k++) { var empty = true; for (var q = 0; q < BS; q++) if (mem[k * BS + q] !== null) empty = false; if (empty) b.push(k); } return b; }
      function allocBlock(r) { var fb = freeBlocks(); if (!fb.length) return false; for (var q = 0; q < BS; q++) { mem[fb[0] * BS + q] = r.id; r.slots.push(fb[0] * BS + q); } return true; }
      for (var t = 0; t <= T; t++) {
        reqs.forEach(function (r) { if (r.arr === t) wait.push(r); });
        // admit
        wait = wait.filter(function (r) {
          var ok;
          if (st.mode === 'static') ok = allocContig(r, MAXLEN);
          else if (st.mode === 'exact') ok = allocContig(r, r.prompt + r.out);
          else { var need = Math.ceil((r.prompt + 1) / BS); var fb = freeBlocks(); ok = fb.length >= need; if (ok) for (var k = 0; k < need; k++) allocBlock(r); }
          if (ok) { r.len = r.prompt; run.push(r); }
          return !ok;
        });
        frames.push({ mem: mem.slice(), run: run.map(function (r) { return { id: r.id, len: r.len, slots: r.slots.slice() }; }), wait: wait.map(function (r) { return r.id; }), done: done.slice() });
        if (t === T) break;
        // decode one token each
        run.forEach(function (r) {
          if (st.mode === 'paged' && r.len + 1 > r.slots.length) { if (!allocBlock(r)) return; }
          r.len++;
        });
        run = run.filter(function (r) {
          if (r.len >= r.prompt + r.out) { r.slots.forEach(function (i) { mem[i] = null; }); r.slots = []; done.push(r.id); return false; }
          return true;
        });
      }
      return frames[frames.length - 1];
    }
    var pl = K.player(f.ctrl, { max: function () { return 16; }, render: render, interval: 800 });
    function render(t) {
      var fr = simulate(t);
      K.clear(sv);
      var C = 34, cols = 16;
      sv.appendChild(s('text', { x: 0, y: 14, class: 't-sm t-mut', text: 'GPU KV memory, iteration ' + t + (st.mode === 'paged' ? ' (thick lines mark 4-slot blocks)' : '') }));
      var owner = {}; fr.run.forEach(function (r) { r.slots.forEach(function (sl, k) { owner[sl] = { id: r.id, filled: k < r.len }; }); });
      var internal = 0, used = 0;
      for (var i = 0; i < MEM; i++) {
        var x = (i % cols) * (C + 3), y = 24 + Math.floor(i / cols) * (C + 12), o = owner[i];
        var cls = o ? (o.filled ? CLS[o.id] : SOFT[CLS[o.id]]) : 'f-panel';
        if (o && o.filled) used++; else if (o) internal++;
        sv.appendChild(s('rect', { x: x, y: y, width: C, height: C, rx: 3, class: cls + (o ? '' : ' s-line w1') }));
        if (o) sv.appendChild(s('text', { x: x + C / 2, y: y + C / 2 + 4, 'text-anchor': 'middle', class: 't-sm t-b' + (o.filled ? ' t-inv' : ''), text: o.id }));
        if (st.mode === 'paged' && i % BS === 0) sv.appendChild(s('line', { x1: x - 2, y1: y - 3, x2: x - 2, y2: y + C + 3, class: 's-ink w2' }));
      }
      var y0 = 24 + 2 * (C + 12) + 10;
      sv.appendChild(s('text', { x: 0, y: y0 + 4, class: 't-sm', text: 'Running: ' + (fr.run.map(function (r) { return r.id + ' (' + r.len + ' tokens)'; }).join(', ') || 'none') }));
      sv.appendChild(s('text', { x: 0, y: y0 + 24, class: 't-sm t-v', text: 'Waiting: ' + (fr.wait.join(', ') || 'none') }));
      sv.appendChild(s('text', { x: 0, y: y0 + 44, class: 't-sm t-mut', text: 'Finished: ' + (fr.done.join(', ') || 'none') }));
      sUsed(used + ' / ' + MEM); sInt(internal); sWait(fr.wait.length); sDone(fr.done.length + ' / ' + REQ.length);
      f.note.innerHTML = {
        static: 'Each request grabs 12 contiguous slots up front. Most of them stay empty (light cells): internal fragmentation. Only two requests fit, so the rest wait even though few slots hold real data.',
        exact: 'Even if we knew each output length exactly, contiguous reservation leaves holes between requests. A newcomer that needs a longer run cannot use them: external fragmentation, plus space reserved for tokens that do not exist yet.',
        paged: 'vLLM allocates fixed 4-slot blocks on demand, anywhere in memory, and keeps a block table per request. Waste is limited to the unfilled part of each request\'s last block, so more requests run at once and more finish within the same iterations.'
      }[st.mode];
    }
    render(0);
  });

  /* ---------- static vs continuous batching ---------- */
  CSO.widget('batching', function (el) {
    var f = K.frame(el, 'Static vs continuous (iteration-level) batching', 'Batch size 4; violet = prefill, teal = generated token, copper = end of sequence');
    var GEN = [3, 6, 2, 4, 3, 5, 2, 3];
    var st = { mode: 'static' };
    K.seg(f.ctrl, { label: 'Scheduler', value: 'static', options: [['static', 'Static batching'], ['cont', 'Continuous (Orca)']], on: function (v) { st.mode = v; draw(); } });
    var sT = K.stat(f.out, 'Iterations to finish all 8', 'v'), sU = K.stat(f.out, 'Slot utilization', 'c'), sW = K.stat(f.out, 'Average wait before start', 'm');
    var sv = K.svg(700, 210); f.stage.appendChild(sv);
    function plan() {
      var slots = [[], [], [], []], next = 0, t = 0, starts = [];
      if (st.mode === 'static') {
        while (next < GEN.length) {
          var batch = GEN.slice(next, next + 4).map(function (g, k) { return { id: next + k, g: g }; });
          var len = Math.max.apply(null, batch.map(function (b) { return b.g + 1; }));
          batch.forEach(function (b, k) { slots[k].push({ id: b.id, start: t, g: b.g }); starts[b.id] = t; });
          t += len; next += 4;
        }
        return { slots: slots, end: t, starts: starts };
      }
      var free = [0, 0, 0, 0];
      while (next < GEN.length) {
        var k = free.indexOf(Math.min.apply(null, free));
        slots[k].push({ id: next, start: free[k], g: GEN[next] }); starts[next] = free[k];
        free[k] += GEN[next] + 1; next++;
      }
      return { slots: slots, end: Math.max.apply(null, free), starts: starts };
    }
    function draw() {
      var p = plan(); K.clear(sv);
      var C = Math.min(30, 620 / p.end), X0 = 60;
      var busy = 0;
      p.slots.forEach(function (sl, k) {
        sv.appendChild(s('text', { x: 0, y: 30 + k * 40 + 18, class: 't-sm', text: 'slot ' + (k + 1) }));
        for (var t = 0; t < p.end; t++) sv.appendChild(s('rect', { x: X0 + t * C, y: 30 + k * 40, width: C - 2, height: 30, rx: 2, class: 'f-panel' }));
        sl.forEach(function (r) {
          for (var q = 0; q <= r.g; q++) {
            var cls = q === 0 ? 'f-vs' : (q === r.g ? 'f-m' : 'f-c');
            var rect = s('rect', { x: X0 + (r.start + q) * C, y: 30 + k * 40, width: C - 2, height: 30, rx: 2, class: cls });
            sv.appendChild(rect); busy++;
            if (q === 0 && C > 18) sv.appendChild(s('text', { x: X0 + (r.start + q) * C + (C - 2) / 2, y: 30 + k * 40 + 20, 'text-anchor': 'middle', class: 't-sm t-b', text: 'S' + (r.id + 1) }));
          }
        });
      });
      for (var t = 0; t <= p.end; t += 2) sv.appendChild(s('text', { x: X0 + t * C, y: 22, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'T' + t }));
      var avgWait = p.starts.reduce(function (a, b) { return a + b; }, 0) / p.starts.length;
      sT(p.end); sU(Math.round(100 * busy / (4 * p.end)) + '%'); sW(avgWait.toFixed(1) + ' iterations');
      f.note.innerHTML = st.mode === 'static'
        ? 'A static batch runs until its longest sequence ends. Slots whose request already emitted ⟨eos⟩ sit idle (grey), and requests S5–S8 cannot start until the whole first batch is done.'
        : 'Orca schedules at the granularity of one iteration: as soon as a request finishes, a waiting request takes its slot in the next iteration. Same hardware, fewer idle slots, earlier starts.';
    }
    draw();
  });

  /* ---------- stall-free scheduling (Sarathi) ---------- */
  CSO.widget('stallfree', function (el) {
    var f = K.frame(el, 'Decode stalls when a new prefill arrives', 'Request A is decoding; request B arrives with a long prompt');
    var st = { P: 1000, c: 128, slo: 10 };
    K.slider(f.ctrl, { label: 'B prompt tokens', min: 250, max: 4000, step: 250, value: st.P, on: function (v) { st.P = v; draw(); } });
    K.slider(f.ctrl, { label: 'Sarathi chunk', min: 64, max: 1024, step: 64, value: st.c, on: function (v) { st.c = v; draw(); } });
    K.slider(f.ctrl, { label: 'TBT SLO (ms)', min: 9, max: 30, value: st.slo, on: function (v) { st.slo = v; draw(); } });
    var sv = K.svg(700, 220); f.stage.appendChild(sv);
    var out = h('div', { class: 'tbl-wrap' }); f.out.replaceWith(out);
    function iter(prefTok) { return 8 + 0.008 * prefTok; } // decode-only iteration = 8 ms; each prefill token adds compute
    function draw() {
      var rows = [];
      // vLLM: prefill alone, then joint decode
      var v1 = iter(st.P), vT = v1 + 8;
      rows.push(['vLLM (prefill first)', [['B prefill', v1, 'p'], ['A + B decode', 8, 'd']], vT, v1]);
      var m1 = iter(st.P);
      rows.push(['Mixed batch (whole prefill)', [['A decode + B prefill', m1, 'p']], m1, m1]);
      var nC = Math.ceil(st.P / st.c), it = iter(st.c), segs = [];
      for (var i = 0; i < Math.min(nC, 12); i++) segs.push(['A + chunk ' + (i + 1), it, 'c']);
      rows.push(['Sarathi (chunked prefill)', segs, it, nC * it]);
      K.clear(sv);
      var maxT = Math.max(vT, m1, Math.min(nC, 12) * it), X0 = 190, PW = 490, u = PW / maxT;
      rows.forEach(function (r, k) {
        sv.appendChild(s('text', { x: 0, y: 30 + k * 60 + 20, class: 't-sm t-b', text: r[0] }));
        var x = X0;
        r[1].forEach(function (sg) {
          var w = sg[1] * u;
          sv.appendChild(s('rect', { x: x, y: 30 + k * 60, width: Math.max(1, w - 2), height: 30, rx: 3, class: sg[2] === 'p' ? 'f-m' : sg[2] === 'c' ? 'f-c' : 'f-cs' }));
          if (w > 70) sv.appendChild(s('text', { x: x + w / 2, y: 30 + k * 60 + 20, 'text-anchor': 'middle', class: 't-sm t-b' + (sg[2] === 'd' ? '' : ' t-inv'), text: sg[0] + ' ' + sg[1].toFixed(0) + 'ms' }));
          x += w;
        });
      });
      sv.appendChild(s('line', { x1: X0 + st.slo * u, y1: 20, x2: X0 + st.slo * u, y2: 200, class: 's-v w2 dash' }));
      sv.appendChild(s('text', { x: X0 + st.slo * u + 4, y: 16, class: 't-sm t-v', text: 'SLO ' + st.slo + ' ms' }));
      out.innerHTML = '<table class="tbl"><thead><tr><th>Policy</th><th class="num">A\'s gap between tokens</th><th class="num">B\'s prefill done after</th><th>Meets TBT SLO?</th></tr></thead><tbody>' +
        rows.map(function (r) { var ok = r[2] <= st.slo; return '<tr><td>' + r[0] + '</td><td class="num">' + r[2].toFixed(1) + ' ms</td><td class="num">' + r[3].toFixed(1) + ' ms</td><td>' + (ok ? '<span class="pill c">yes</span>' : '<span class="pill m">no</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
      f.note.innerHTML = 'Model: a decode-only iteration costs 8 ms (reading the weights dominates) and every prefill token adds 0.008 ms of compute, which reproduces the lecture numbers: 24 ms for vLLM, 16 ms mixed, 9 ms for a 125-token chunk. Smaller chunks protect A\'s token rate but take more iterations to finish B\'s prefill and add per-chunk overhead.';
    }
    draw();
  });

  /* ---------- speculative sampling ---------- */
  CSO.widget('specsample', function (el) {
    var f = K.frame(el, 'Speculative sampling: accept with probability min(1, q/p)', 'Draft model p proposes, target model q verifies in one pass');
    var T = [['dogs', 0.8, 0.9], ['love', 0.7, 0.8], ['chasing', 0.9, 0.8], ['after', 0.8, 0.3], ['cars', 0.7, 0.8]];
    var res = null, stats = null;
    K.button(f.ctrl, 'Run one verification', function () { res = sample(); draw(); }, true);
    K.button(f.ctrl, 'Simulate 10,000 rounds', function () {
      var hist = [0, 0, 0, 0, 0, 0], tot = 0;
      for (var i = 0; i < 10000; i++) { var r = sample(); hist[r.accepted]++; tot += r.accepted; }
      stats = { hist: hist, mean: tot / 10000 }; draw();
    });
    var sv = K.svg(660, 190); f.stage.appendChild(sv);
    var sA = K.stat(f.out, 'Accepted this round', 'c'), sE = K.stat(f.out, 'Average accepted (+1 from target)', 'v');
    function sample() {
      var out = [], accepted = 0, stop = false;
      T.forEach(function (t) {
        if (stop) { out.push({ r: null, ok: null }); return; }
        var pr = Math.min(1, t[2] / t[1]), r = Math.random(), ok = r < pr;
        out.push({ r: r, ok: ok, pr: pr }); if (ok) accepted++; else stop = true;
      });
      return { out: out, accepted: accepted };
    }
    function draw() {
      K.clear(sv);
      var C = 120;
      sv.appendChild(s('text', { x: 0, y: 40, class: 't-sm t-mut', text: 'draft p(x)' }));
      sv.appendChild(s('text', { x: 0, y: 70, class: 't-sm t-mut', text: 'target q(x)' }));
      sv.appendChild(s('text', { x: 0, y: 100, class: 't-sm t-mut', text: 'accept prob.' }));
      sv.appendChild(s('text', { x: 0, y: 140, class: 't-sm t-mut', text: 'this round' }));
      T.forEach(function (t, i) {
        var x = 90 + i * C, pr = Math.min(1, t[2] / t[1]);
        sv.appendChild(s('text', { x: x + C / 2 - 8, y: 16, 'text-anchor': 'middle', class: 't-md t-b', text: t[0] }));
        sv.appendChild(s('text', { x: x + C / 2 - 8, y: 40, 'text-anchor': 'middle', class: 't-sm t-mono t-v', text: t[1].toFixed(1) }));
        sv.appendChild(s('text', { x: x + C / 2 - 8, y: 70, 'text-anchor': 'middle', class: 't-sm t-mono t-c', text: t[2].toFixed(1) }));
        sv.appendChild(s('rect', { x: x + 8, y: 86, width: C - 32, height: 18, rx: 3, class: 'f-panel' }));
        sv.appendChild(s('rect', { x: x + 8, y: 86, width: (C - 32) * pr, height: 18, rx: 3, class: pr >= 1 ? 'f-c' : 'f-m' }));
        sv.appendChild(s('text', { x: x + C / 2 - 8, y: 99, 'text-anchor': 'middle', class: 't-sm t-mono t-b', text: pr >= 1 ? '1 (q ≥ p)' : t[2] + '/' + t[1] + ' = ' + pr.toFixed(2) }));
        if (res) {
          var o = res.out[i];
          var label = o.ok == null ? 'discarded' : (o.ok ? 'accept' : 'reject');
          sv.appendChild(s('rect', { x: x + 8, y: 122, width: C - 32, height: 28, rx: 4, class: o.ok == null ? 'f-panel' : (o.ok ? 'f-cs s-c w15' : 'f-ms s-m w15') }));
          sv.appendChild(s('text', { x: x + C / 2 - 8, y: 141, 'text-anchor': 'middle', class: 't-sm t-b', text: label }));
          if (o.r != null) sv.appendChild(s('text', { x: x + C / 2 - 8, y: 168, 'text-anchor': 'middle', class: 't-sm t-mono t-mut', text: 'r = ' + o.r.toFixed(2) }));
        }
      });
      sA(res ? res.accepted + ' of 5' : '–');
      sE(stats ? stats.mean.toFixed(2) + ' (+1)' : '–');
      f.note.innerHTML = 'If the target is at least as confident as the draft (q ≥ p) the token is always accepted. Otherwise draw r ∈ [0, 1) and accept if r < q/p: "chasing" survives 89% of the time, "after" only 37.5%. The first rejection ends the round; that position is re-sampled from the target, so every target pass yields at least one token.' +
        (stats ? ' Over 10,000 rounds the accepted-count histogram is [' + stats.hist.join(', ') + '] for 0…5 tokens.' : '');
    }
    draw();
  });

  /* ---------- roofline ---------- */
  CSO.widget('roofline', function (el) {
    var f = K.frame(el, 'Roofline: why decode is memory-bound and prefill is compute-bound', 'Linear layer y = xW with W of size d×d in FP16');
    var st = { peak: 312, bw: 2.0, d: 4096, b: 8, n: 1024 };
    K.slider(f.ctrl, { label: 'Peak compute (TFLOP/s)', min: 50, max: 1000, step: 10, value: st.peak, on: function (v) { st.peak = v; draw(); } });
    K.slider(f.ctrl, { label: 'Memory BW (TB/s)', min: 0.5, max: 8, step: 0.1, value: st.bw, fmt: function (v) { return v.toFixed(1); }, on: function (v) { st.bw = v; draw(); } });
    K.slider(f.ctrl, { label: 'Decode batch', min: 1, max: 512, value: st.b, on: function (v) { st.b = v; draw(); } });
    K.slider(f.ctrl, { label: 'Prefill tokens', min: 64, max: 8192, step: 64, value: st.n, on: function (v) { st.n = v; draw(); } });
    var sR = K.stat(f.out, 'Ridge point (FLOP/byte)', 'v'), sD = K.stat(f.out, 'Decode intensity', 'm'), sP = K.stat(f.out, 'Prefill intensity', 'c');
    var sv = K.svg(620, 300); f.stage.appendChild(sv);
    function ai(T) { var flops = 2 * T * st.d * st.d, bytes = 2 * st.d * st.d + 2 * 2 * T * st.d; return flops / bytes; }
    function draw() {
      K.clear(sv);
      var X0 = 60, Y0 = 16, PW = 530, PH = 230, lx0 = -1, lx1 = 4, ly0 = 0, ly1 = 3.3;
      var ridge = st.peak * 1e12 / (st.bw * 1e12);
      function px(a) { return X0 + (Math.log10(a) - lx0) / (lx1 - lx0) * PW; }
      function py(tf) { return Y0 + (ly1 - Math.log10(tf)) / (ly1 - ly0) * PH; }
      [0.1, 1, 10, 100, 1000, 10000].forEach(function (a) { sv.appendChild(s('line', { x1: px(a), y1: Y0, x2: px(a), y2: Y0 + PH, class: 's-line w1' })); sv.appendChild(s('text', { x: px(a), y: Y0 + PH + 14, 'text-anchor': 'middle', class: 't-sm t-mut', text: a })); });
      [1, 10, 100, 1000].forEach(function (v) { sv.appendChild(s('line', { x1: X0, y1: py(v), x2: X0 + PW, y2: py(v), class: 's-line w1' })); sv.appendChild(s('text', { x: X0 - 6, y: py(v) + 4, 'text-anchor': 'end', class: 't-sm t-mut', text: v })); });
      sv.appendChild(s('text', { x: X0 + PW / 2, y: Y0 + PH + 32, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'arithmetic intensity (FLOPs per byte moved), log scale' }));
      sv.appendChild(s('text', { x: 12, y: Y0 + PH / 2, class: 't-sm t-mut', transform: 'rotate(-90 12 ' + (Y0 + PH / 2) + ')', 'text-anchor': 'middle', text: 'attainable TFLOP/s' }));
      var d = ''; for (var i = 0; i <= 100; i++) { var a = Math.pow(10, lx0 + (lx1 - lx0) * i / 100), perf = Math.min(st.peak, st.bw * a); d += (i ? 'L' : 'M') + px(a).toFixed(1) + ' ' + py(Math.max(1, perf)).toFixed(1); }
      sv.appendChild(s('path', { d: d, class: 'f-none s-ink w2' }));
      sv.appendChild(s('line', { x1: px(ridge), y1: Y0, x2: px(ridge), y2: Y0 + PH, class: 's-v w1 dash' }));
      sv.appendChild(s('text', { x: px(ridge) + 4, y: Y0 + 12, class: 't-sm t-v', text: 'ridge ' + ridge.toFixed(0) }));
      sv.appendChild(s('text', { x: px(0.15), y: py(1.6), class: 't-sm t-mut', text: 'memory-bound' }));
      sv.appendChild(s('text', { x: px(1500), y: py(st.peak) - 8, class: 't-sm t-mut', text: 'compute-bound' }));
      var aD = ai(st.b), aP = ai(st.n);
      [[aD, 'decode (batch ' + st.b + ')', 'f-m'], [aP, 'prefill (' + st.n + ' tokens)', 'f-c']].forEach(function (p, k) {
        var perf = Math.min(st.peak, st.bw * p[0]);
        sv.appendChild(s('circle', { cx: px(p[0]), cy: py(Math.max(1, perf)), r: 7, class: p[2] }));
        sv.appendChild(s('text', { x: px(p[0]) + (k ? -10 : 10), y: py(Math.max(1, perf)) + (k ? 22 : -10), 'text-anchor': k ? 'end' : 'start', class: 't-sm t-b', text: p[1] }));
      });
      sR(ridge.toFixed(0)); sD(aD.toFixed(1) + (aD < ridge ? ' (memory-bound)' : ' (compute-bound)')); sP(aP.toFixed(0) + (aP < ridge ? ' (memory-bound)' : ' (compute-bound)'));
      f.note.innerHTML = 'Each token processed in one pass reuses the same d² weights, so the intensity is roughly the number of tokens in the pass. Decode handles one token per request, so it sits far left of the ridge: the GPU waits on memory and adding requests to the batch is almost free. A long prefill sits right of the ridge. Sarathi exploits this "arithmetic intensity slack" by piggybacking prefill chunks on decode batches.';
    }
    draw();
  });

  /* ---------- FlashAttention: online softmax ---------- */
  CSO.widget('flash', function (el) {
    var f = K.frame(el, 'FlashAttention\'s trick: softmax one block at a time', 'One query row, 9 keys split into 3 blocks of 3');
    var S = [1.2, 0.3, 2.5, -0.4, 3.1, 0.8, 1.9, -1.0, 2.2], V = [4, -2, 1, 3, 6, 0, -1, 2, 5];
    var sv = K.svg(680, 250); f.stage.appendChild(sv);
    var sM = K.stat(f.out, 'Running max m', 'v'), sL = K.stat(f.out, 'Running sum ℓ', 'm'), sO = K.stat(f.out, 'Running output o', 'c'), sX = K.stat(f.out, 'Exact softmax(S)·V', '');
    var exact = (function () { var m = Math.max.apply(null, S), e = S.map(function (x) { return Math.exp(x - m); }), z = e.reduce(function (a, b) { return a + b; }); return e.reduce(function (a, b, i) { return a + b * V[i]; }, 0) / z; })();
    var pl = K.player(f.ctrl, { max: function () { return 3; }, render: render, interval: 1300 });
    function render(t) {
      var m = -Infinity, l = 0, o = 0, rows = [];
      for (var b = 0; b < t; b++) {
        var blk = S.slice(b * 3, b * 3 + 3), vb = V.slice(b * 3, b * 3 + 3);
        var mb = Math.max.apply(null, blk), mNew = Math.max(m, mb);
        var pb = blk.map(function (x) { return Math.exp(x - mNew); }), lb = pb.reduce(function (a, c) { return a + c; });
        var scale = isFinite(m) ? Math.exp(m - mNew) : 0;
        var lNew = scale * l + lb;
        o = (scale * l * o + pb.reduce(function (a, c, i) { return a + c * vb[i]; }, 0)) / lNew;
        m = mNew; l = lNew;
        rows.push('block ' + (b + 1) + ': m = ' + m.toFixed(2) + ', rescale old terms by e^(m_old − m_new) = ' + scale.toFixed(3) + ', ℓ = ' + l.toFixed(3) + ', o = ' + o.toFixed(4));
      }
      K.clear(sv);
      var C = 64;
      sv.appendChild(s('text', { x: 0, y: 34, class: 't-sm t-mut', text: 'scores S' }));
      sv.appendChild(s('text', { x: 0, y: 74, class: 't-sm t-mut', text: 'values V' }));
      S.forEach(function (x, i) {
        var blk = Math.floor(i / 3), cls = blk < t ? (blk === t - 1 ? 'f-cs s-c w2' : 'f-surf s-c w1') : 'f-panel s-line w1';
        K.cell(sv, 80 + i * C + blk * 10, 14, C - 6, 30, x.toFixed(1), cls);
        K.cell(sv, 80 + i * C + blk * 10, 54, C - 6, 30, V[i], blk < t ? 'f-ms s-m w1' : 'f-panel s-line w1');
      });
      [0, 1, 2].forEach(function (b) { sv.appendChild(s('text', { x: 80 + b * (3 * C + 10) + 1.5 * C - 3, y: 104, 'text-anchor': 'middle', class: 't-sm t-mut', text: 'block ' + (b + 1) + (b < t ? ' loaded to SRAM' : '') })); });
      rows.forEach(function (r, i) { sv.appendChild(s('text', { x: 0, y: 140 + i * 22, class: 't-sm t-mono', text: r })); });
      sM(isFinite(m) ? m.toFixed(2) : '−∞'); sL(l ? l.toFixed(3) : '0'); sO(t ? o.toFixed(4) : '–'); sX(exact.toFixed(4));
      f.note.innerHTML = t < 3 ? 'Softmax needs the max and the sum over the whole row, but only one block fits in SRAM. FlashAttention keeps two small statistics per row (the running max m and running sum ℓ) and rescales its partial output whenever the max grows. Step through the blocks.'
        : 'After the last block the running output equals the exact answer: no approximation, and S and P never had to be written to HBM. In the backward pass FlashAttention recomputes S and P block by block instead of storing them.';
    }
    render(0);
  });

  /* ---------- Linformer cost ---------- */
  CSO.widget('linformer', function (el) {
    var f = K.frame(el, 'Attention cost: n × n vs n × k (Linformer)', 'n = sequence length, k = projected length');
    var st = { n: 4096, k: 256 };
    K.select(f.ctrl, { label: 'Sequence n', value: '4096', options: ['512', '1024', '4096', '16384', '65536'], on: function (v) { st.n = +v; draw(); } });
    K.select(f.ctrl, { label: 'Projection k', value: '256', options: ['128', '256', '512', '1024', '2048'], on: function (v) { st.k = +v; draw(); } });
    var s1 = K.stat(f.out, 'Entries in P (standard): n²', 'm'), s2 = K.stat(f.out, 'Entries in P (Linformer): n·k', 'c'), s3 = K.stat(f.out, 'Reduction', 'v');
    function draw() { s1(K.fmt(st.n * st.n)); s2(K.fmt(st.n * st.k)); s3((st.n / st.k).toFixed(1) + '×'); f.note.innerHTML = 'Linformer projects K and V with E, F of size k × n, so softmax(Q(EK)ᵀ/√d) is n × k. Because self-attention is low-rank, k can be chosen independent of n (k ≈ d/ε²), making the cost linear in n. Measured savings grow with n: at n = 16384 the paper reports up to 7.8× time and 48× memory saving for k = 256.'; }
    draw();
  });
})();
