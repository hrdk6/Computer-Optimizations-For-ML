/* Silicon Syllabus: app engine. Content files call CSO.register(); widget files call CSO.widget(). */
(function () {
  'use strict';

  var CSO = window.CSO = {
    chapters: [],
    byId: {},
    widgets: {},
    lectures: [],
    register: function (ch) { this.chapters.push(ch); this.byId[ch.id] = ch; },
    widget: function (name, fn) { this.widgets[name] = fn; },
    setLectures: function (list) { this.lectures = list; }
  };

  CSO.PARTS = [
    { id: 'I', name: 'Foundations', weeks: 'Weeks 1–2' },
    { id: 'II', name: 'CNN hardware', weeks: 'Weeks 3–4' },
    { id: 'III', name: 'Training at scale', weeks: 'Weeks 4–5' },
    { id: 'IV', name: 'LLM systems', weeks: 'Weeks 5–7' },
    { id: 'V', name: 'Reliability', weeks: 'Weeks 7–8' },
    { id: 'VI', name: 'Graphs and emerging hardware', weeks: 'Weeks 8–11' },
    { id: 'VII', name: 'Measurement and real hardware', weeks: 'Weeks 11–12' }
  ];
  var KIND_VAR = { compute: 'var(--compute)', memory: 'var(--memory)', comm: 'var(--comm)' };

  /* ---------------- storage (optional; page works without it) ---------------- */
  var STORE_KEY = 'csoml.v1';
  function loadState() {
    try { var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; }
  }
  var state = loadState();
  state.done = state.done || {}; state.quiz = state.quiz || {}; state.cards = state.cards || {};
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  CSO.state = state; CSO.save = save;

  /* ---------------- helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  CSO.esc = esc; CSO.pad2 = pad2;
  function lecUrl(l) { return 'https://www.youtube.com/watch?v=' + l.vid; }
  CSO.lecUrl = lecUrl;
  function chapterOfLecture(n) {
    return CSO.chapters.filter(function (c) { return c.lectures.indexOf(n) >= 0; });
  }
  function textOf(html) {
    var t = document.createElement('template'); t.innerHTML = html;
    $$('svg, script, style', t.content).forEach(function (n) { n.remove(); });
    return (t.content.textContent || '').replace(/\s+/g, ' ').trim();
  }

  var ICON = {
    exam: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h7l3 3v11H3z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.5"/></svg>',
    insight: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 13.5h4" stroke="currentColor" stroke-width="1.5"/></svg>',
    def: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12M2 8h12M2 13h8" stroke="currentColor" stroke-width="1.5"/></svg>',
    paper: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h10v12H3z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5h6M5 8h6" stroke="currentColor" stroke-width="1.5"/></svg>'
  };
  var BOX_TITLE = { exam: 'Exam focus', insight: 'Why it matters', def: 'Definition', paper: 'From the paper' };

  /* Content authors write <div class="box exam" data-t="optional title">…</div>; we add the header. */
  function decorate(root) {
    $$('.box', root).forEach(function (b) {
      if (b.querySelector(':scope > .bh')) return;
      var kind = ['exam', 'insight', 'def', 'paper'].filter(function (k) { return b.classList.contains(k); })[0] || 'insight';
      var title = b.getAttribute('data-t') || BOX_TITLE[kind];
      var body = document.createElement('div'); body.className = 'bb';
      while (b.firstChild) body.appendChild(b.firstChild);
      var head = document.createElement('div'); head.className = 'bh'; head.innerHTML = ICON[kind] + '<span>' + esc(title) + '</span>';
      b.appendChild(head); b.appendChild(body);
    });
    $$('a[href^="http"]', root).forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    // A marker only lands on the last vertex of a path, so split "M…M…" arrow paths into one path per arrow.
    $$('.fig path[marker-end]', root).forEach(function (p) {
      var parts = (p.getAttribute('d') || '').trim().split(/(?=M)/);
      if (parts.length < 2) return;
      parts.forEach(function (d) { var q = p.cloneNode(false); q.setAttribute('d', d.trim()); p.parentNode.insertBefore(q, p); });
      p.parentNode.removeChild(p);
    });
  }

  function typeset(el) {
    if (window.MathJax && MathJax.typesetPromise) {
      try { MathJax.typesetClear && MathJax.typesetClear([el]); } catch (e) {}
      return MathJax.typesetPromise([el]).catch(function (e) { console.warn('MathJax', e); });
    }
    pendingTypeset.push(el);
  }
  var pendingTypeset = [];
  document.addEventListener('mathjax-ready', function () { pendingTypeset.splice(0).forEach(function (el) { if (document.body.contains(el)) typeset(el); }); });
  CSO.typeset = typeset;

  function mountWidgets(root) {
    $$('[data-w]', root).forEach(function (el) {
      var name = el.getAttribute('data-w'), opts = {};
      try { opts = JSON.parse(el.getAttribute('data-o') || '{}'); } catch (e) {}
      var fn = CSO.widgets[name];
      if (!fn) { el.innerHTML = '<div class="box exam" data-t="Widget missing"><p>Interactive "' + esc(name) + '" did not load.</p></div>'; decorate(el); return; }
      try { fn(el, opts); } catch (e) { console.error(e); el.innerHTML = '<p class="muted small">This interactive failed to start: ' + esc(e.message) + '</p>'; }
    });
  }

  /* ---------------- rail ---------------- */
  function chapterStatus(ch) {
    if (state.done[ch.id]) return 'done';
    if (state.quiz[ch.id] != null) return 'part';
    return '';
  }
  function buildRail() {
    var toc = $('#rail-toc'); var html = '';
    CSO.PARTS.forEach(function (p) {
      var chs = CSO.chapters.filter(function (c) { return c.part === p.id; });
      if (!chs.length) return;
      html += '<div class="part"><div class="part-label"><b>Part ' + p.id + ' ' + esc(p.name) + '</b><span>' + p.weeks + '</span></div>';
      chs.forEach(function (c) {
        html += '<a class="ch-link" data-ch="' + c.id + '" href="#' + c.id + '"><span class="n">' + pad2(c.num) + '</span><span class="t">' + esc(c.short || c.title) + '</span><span class="d ' + chapterStatus(c) + '" title="' + (chapterStatus(c) === 'done' ? 'Marked as studied' : 'Not marked yet') + '"></span></a>';
      });
      html += '</div>';
    });
    toc.innerHTML = html;
    var doneN = CSO.chapters.filter(function (c) { return state.done[c.id]; }).length;
    $('#progress-mini').textContent = doneN + ' of ' + CSO.chapters.length + ' studied';
  }
  function setActiveRail(route) {
    $$('.ch-link').forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-ch') === route); });
    $$('.rail-tools a').forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + route); });
  }
  function closeRail() {
    $('#rail').classList.remove('open'); $('#scrim').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false');
  }

  /* ---------------- search ---------------- */
  var INDEX = [];
  function buildIndex() {
    INDEX = [];
    CSO.chapters.forEach(function (c) {
      INDEX.push({ ch: c, href: '#' + c.id, title: c.title, text: c.summary || '', lower: (c.title + ' ' + (c.summary || '')).toLowerCase() });
      c.sections.forEach(function (s, i) {
        var t = textOf(s.html);
        INDEX.push({ ch: c, href: '#' + c.id + '-' + s.id, title: c.num + '.' + (i + 1) + ' ' + s.title, text: t, lower: (s.title + ' ' + t).toLowerCase() });
      });
    });
  }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!terms.length) return [];
    var res = [];
    INDEX.forEach(function (it) {
      var score = 0, ok = true;
      terms.forEach(function (t) {
        var i = it.lower.indexOf(t);
        if (i < 0) { ok = false; return; }
        score += (it.title.toLowerCase().indexOf(t) >= 0 ? 6 : 1) + Math.min(4, it.lower.split(t).length - 1);
      });
      if (ok) res.push({ it: it, score: score });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.slice(0, 12).map(function (r) {
      var it = r.it, lower = it.text.toLowerCase(), i = lower.indexOf(terms[0]);
      var snip = i >= 0 ? it.text.slice(Math.max(0, i - 50), i + 110) : it.text.slice(0, 140);
      var safe = esc(snip);
      terms.forEach(function (t) { safe = safe.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
      return '<a href="' + it.href + '"><span class="sr-ch">Ch ' + pad2(it.ch.num) + ' ' + esc(it.ch.short || it.ch.title) + '</span><span class="sr-t">' + esc(it.title) + '</span><span class="sr-s">' + (i > 50 ? '…' : '') + safe + '…</span></a>';
    });
  }
  function wireSearch() {
    var input = $('#search-input'), box = $('#search-results');
    var run = function () {
      var q = input.value.trim();
      if (q.length < 2) { box.hidden = true; return; }
      var r = search(q);
      box.innerHTML = r.length ? r.join('') : '<div class="search-empty">No matches for "' + esc(q) + '". Try a paper name (Eyeriss, Orca), a term (KV cache) or a unit (TOPS).</div>';
      box.hidden = false;
    };
    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { box.hidden = true; input.blur(); }
      if (e.key === 'Enter') { var a = box.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); box.hidden = true; } }
    });
    box.addEventListener('click', function (e) { if (e.target.closest('a')) { box.hidden = true; input.value = ''; closeRail(); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.search')) box.hidden = true; });
  }

  /* ---------------- quiz engine ---------------- */
  var LETTERS = 'ABCDEFG';
  function renderQuiz(container, questions, key, opts) {
    opts = opts || {};
    var answered = 0, correct = 0;
    var wrap = document.createElement('div'); wrap.className = 'quiz';
    var score = document.createElement('div'); score.className = 'quiz-score';
    function updateScore() {
      score.innerHTML = '<b>' + correct + ' / ' + questions.length + '</b><span>' + (answered < questions.length ? answered + ' answered so far' : 'All answered.') + '</span>';
      if (answered === questions.length && key) {
        var prev = state.quiz[key];
        if (prev == null || correct > prev) { state.quiz[key] = correct; save(); buildRail(); setActiveRail(currentRoute); }
        var reset = document.createElement('button'); reset.className = 'btn'; reset.textContent = 'Try these again';
        reset.addEventListener('click', function () { renderQuiz(container, questions, key, opts); });
        score.appendChild(reset);
      }
    }
    questions.forEach(function (q, qi) {
      var card = document.createElement('div'); card.className = 'q';
      var src = opts.showSource && q._ch ? ' <span class="pill c">Ch ' + pad2(q._ch.num) + '</span>' : '';
      card.innerHTML = '<div class="qt"><span class="qn">' + (qi + 1) + '</span><span>' + q.q + src + '</span></div>';
      var why = document.createElement('div'); why.className = 'why'; why.hidden = true;
      if (q.num != null) {
        var row = document.createElement('div'); row.className = 'num-row';
        row.innerHTML = '<input type="text" inputmode="decimal" aria-label="Your answer"> <span>' + (q.unit || '') + '</span>';
        var b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Check';
        row.appendChild(b); card.appendChild(row);
        var check = function () {
          var v = parseFloat(String(row.querySelector('input').value).replace(/,/g, ''));
          if (isNaN(v)) return;
          var tol = q.tol != null ? q.tol : Math.abs(q.num) * 0.02;
          var ok = Math.abs(v - q.num) <= tol;
          answered++; if (ok) correct++;
          b.disabled = true; row.querySelector('input').disabled = true;
          why.innerHTML = (ok ? '<b class="ok">Correct.</b> ' : '<b class="no">Not quite.</b> The answer is ' + q.num + (q.unit ? ' ' + q.unit : '') + '. ') + (q.why || '');
          why.hidden = false; typeset(why); updateScore();
        };
        b.addEventListener('click', check);
        row.querySelector('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
      } else {
        var opts2 = document.createElement('div'); opts2.className = 'opts';
        q.o.forEach(function (o, oi) {
          var btn = document.createElement('button'); btn.className = 'opt'; btn.type = 'button';
          btn.innerHTML = '<span class="ol">' + LETTERS[oi] + '</span><span>' + o + '</span>';
          btn.addEventListener('click', function () {
            var ok = oi === q.a;
            answered++; if (ok) correct++;
            $$('.opt', opts2).forEach(function (x, xi) { x.disabled = true; if (xi === q.a) x.classList.add('right'); });
            if (!ok) btn.classList.add('wrong');
            why.innerHTML = (ok ? '<b class="ok">Correct.</b> ' : '<b class="no">Not quite.</b> The answer is ' + LETTERS[q.a] + '. ') + (q.why || '');
            why.hidden = false; typeset(why); updateScore();
          });
          opts2.appendChild(btn);
        });
        card.appendChild(opts2);
      }
      card.appendChild(why);
      wrap.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(wrap); container.appendChild(score);
    updateScore();
    typeset(wrap);
  }
  CSO.renderQuiz = renderQuiz;

  function renderCards(container, cards) {
    container.innerHTML = '';
    var grid = document.createElement('div'); grid.className = 'cards';
    cards.forEach(function (c) {
      var b = document.createElement('button'); b.className = 'card'; b.type = 'button';
      b.setAttribute('aria-label', 'Flashcard: ' + textOf(c.f) + '. Select to flip.');
      b.innerHTML = '<div class="in"><div class="fa">' + (c._ch ? '<small>Ch ' + pad2(c._ch.num) + ' ' + esc(c._ch.short || c._ch.title) + '</small>' : '') + '<span>' + c.f + '</span></div><div class="fb">' + c.b + '</div></div>';
      b.addEventListener('click', function () { b.classList.toggle('flip'); });
      grid.appendChild(b);
    });
    container.appendChild(grid);
    typeset(grid);
  }

  /* ---------------- views ---------------- */
  var main;
  function lectureChip(n) {
    var l = CSO.lectures[n - 1]; if (!l) return '';
    return '<a class="lec-chip" href="' + lecUrl(l) + '" target="_blank" rel="noopener" title="Watch on YouTube: ' + esc(l.title) + '"><b>L' + pad2(n) + '</b>' + esc(l.title) + '</a>';
  }

  function viewHome() {
    var doneN = CSO.chapters.filter(function (c) { return state.done[c.id]; }).length;
    var nextCh = CSO.chapters.filter(function (c) { return !state.done[c.id]; })[0] || CSO.chapters[0];
    var blocks = CSO.chapters.map(function (c) {
      var lecs = c.lectures.length;
      return '<a class="block" href="#' + c.id + '" style="--span:' + (c.span || 3) + ';--kind:' + KIND_VAR[c.kind || 'compute'] + '">' +
        '<span class="bp ' + (state.done[c.id] ? 'done' : '') + '"></span>' +
        '<span class="bn">' + pad2(c.num) + '</span><span class="bt">' + esc(c.title) + '</span>' +
        '<span class="bl">' + lecs + (lecs === 1 ? ' lecture' : ' lectures') + ', L' + pad2(c.lectures[0]) + (lecs > 1 ? '–L' + pad2(c.lectures[lecs - 1]) : '') + '</span></a>';
    }).join('');
    main.innerHTML =
      '<div class="home">' +
      '<section class="hero" aria-label="Introduction"><img src="assets/img/hero.jpg" alt="A rendered 2.5D package: six glowing compute chiplets on a silicon interposer, linked by copper traces and flanked by stacked memory." width="2000" height="1000">' +
      '<div class="hero-copy"><h1>Computer System Optimization for ML</h1>' +
      '<p>A visual study guide to the NPTEL course from IISc Bangalore. Every chapter teaches the algorithm first, then the hardware and system tricks that make it fast, with diagrams you can play with.</p>' +
      '<div class="hero-actions"><a class="btn primary" href="#' + nextCh.id + '">' + (doneN ? 'Continue with chapter ' + nextCh.num : 'Start with chapter 1') + '</a><a class="btn" href="#lectures">Browse the 60 lectures</a></div>' +
      '<span class="credit">Built from the course slides and lecture transcripts (Prof. Sumit K. Mandal, IISc).</span></div></section>' +

      (doneN ? '<div class="resume"><span>You have marked ' + doneN + ' of ' + CSO.chapters.length + ' chapters as studied.</span><span class="bar"><i style="width:' + Math.round(100 * doneN / CSO.chapters.length) + '%"></i></span><a class="btn" href="#' + nextCh.id + '">Next: ' + esc(nextCh.short || nextCh.title) + '</a></div>' : '') +

      '<section class="home-sec"><header><h2>The course, drawn as a die</h2><p>Each block is a chapter, sized by how many lectures it spans. Its colour shows the bottleneck that chapter fights. Pick any block to open it.</p></header>' +
      '<div class="legend"><span><i style="background:var(--compute)"></i>Compute: doing the arithmetic faster or doing less of it</span><span><i style="background:var(--memory)"></i>Memory: moving and storing data</span><span><i style="background:var(--comm)"></i>Communication and scheduling</span></div>' +
      '<div class="floorplan">' + blocks + '</div></section>' +

      '<section class="home-sec"><header><h2>How to use this guide</h2><p>The chapters follow the lecture order. Theory is written out in full, so you can revise without rewatching, and each chapter links straight to its videos.</p></header>' +
      '<div class="use-grid">' +
      '<a class="use-item" href="#' + CSO.chapters[0].id + '"><h3>Read a chapter</h3><p>Concepts, worked numbers from the slides, and an "Exam focus" box for the points most likely to be tested.</p></a>' +
      '<a class="use-item" href="#ch05"><h3>Play with the hardware</h3><p>Step through a systolic array, a convolution, ring all-reduce, PagedAttention and more. Every widget uses the numbers from the lectures.</p></a>' +
      '<a class="use-item" href="#practice"><h3>Test yourself</h3><p>Each chapter ends with a quiz. The practice test mixes questions from the whole course, like the weekly assignments.</p></a>' +
      '<a class="use-item" href="#formulas"><h3>Revise fast</h3><p>The formula sheet, the numbers-to-know list and flashcards pull everything together for the night before the exam.</p></a>' +
      '</div></section></div>';
  }

  function sectionNumberedHTML(ch, s, i) {
    return '<section class="sec" id="' + ch.id + '-' + s.id + '" aria-labelledby="h-' + ch.id + '-' + s.id + '">' +
      '<h2 id="h-' + ch.id + '-' + s.id + '"><span class="sn">' + ch.num + '.' + (i + 1) + '</span><span>' + s.title + '</span><a class="anchor" href="#' + ch.id + '-' + s.id + '" aria-label="Link to this section">#</a></h2>' +
      s.html + '</section>';
  }

  var spy;
  function viewChapter(ch, anchor) {
    var idx = CSO.chapters.indexOf(ch);
    var prev = CSO.chapters[idx - 1], next = CSO.chapters[idx + 1];
    var part = CSO.PARTS.filter(function (p) { return p.id === ch.part; })[0];
    var isDone = !!state.done[ch.id];
    main.innerHTML =
      '<article class="chapter">' +
      '<header class="ch-head"><figure class="ch-cover"><img src="assets/img/' + (ch.cover || 'systolic') + '.jpg" alt="' + esc(ch.coverAlt || '') + '" width="1440" height="810"><span class="big" aria-hidden="true">' + pad2(ch.num) + '</span></figure>' +
      '<div class="ch-meta"><span class="ch-part"><b>Chapter ' + ch.num + '</b> in Part ' + part.id + ', ' + esc(part.name) + ' (' + part.weeks + ')</span>' +
      '<h1>' + esc(ch.title) + '</h1><p class="sum">' + ch.summary + '</p>' +
      '<div class="lec-chips" aria-label="Lectures covered">' + ch.lectures.map(lectureChip).join('') + '</div>' +
      '<div class="ch-actions"><a class="btn" href="#' + ch.id + '-review">Jump to the quiz</a><button class="btn" id="mark-done" aria-pressed="' + isDone + '">' + (isDone ? 'Studied ✓' : 'Mark as studied') + '</button></div></div></header>' +
      '<div class="ch-body"><div class="ch-text">' + ch.sections.map(function (s, i) { return sectionNumberedHTML(ch, s, i); }).join('') + '</div>' +
      '<aside class="ch-toc" aria-label="On this page"><span class="h">On this page</span>' + ch.sections.map(function (s, i) { return '<a href="#' + ch.id + '-' + s.id + '" data-sec="' + ch.id + '-' + s.id + '">' + ch.num + '.' + (i + 1) + ' ' + s.title + '</a>'; }).join('') + '<a href="#' + ch.id + '-review">Review and quiz</a></aside></div>' +
      '<section class="review" id="' + ch.id + '-review"><h2>Review</h2>' +
      (ch.takeaways ? '<div class="sec"><h3>Key takeaways</h3><ol class="takeaways">' + ch.takeaways.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol></div>' : '') +
      (ch.quiz && ch.quiz.length ? '<div class="sec"><h3>Quiz: ' + ch.quiz.length + ' questions</h3><div id="ch-quiz"></div></div>' : '') +
      (ch.cards && ch.cards.length ? '<div class="sec"><h3>Flashcards</h3><p class="muted small">Select a card to flip it.</p><div id="ch-cards"></div></div>' : '') +
      '</section>' +
      '<nav class="pager" aria-label="Chapter navigation">' +
      (prev ? '<a href="#' + prev.id + '"><span>Previous chapter</span><b>' + pad2(prev.num) + ' ' + esc(prev.title) + '</b></a>' : '<span></span>') +
      (next ? '<a class="next" href="#' + next.id + '"><span>Next chapter</span><b>' + pad2(next.num) + ' ' + esc(next.title) + '</b></a>' : '') +
      '</nav></article>';

    // number figures
    var fn = 0;
    $$('figure.fig figcaption', main).forEach(function (fc) { fn++; fc.insertAdjacentHTML('afterbegin', '<b>Figure ' + ch.num + '.' + fn + '</b> '); });
    decorate(main);
    if (ch.quiz && ch.quiz.length) renderQuiz($('#ch-quiz'), ch.quiz, ch.id);
    if (ch.cards && ch.cards.length) renderCards($('#ch-cards'), ch.cards);
    mountWidgets(main);
    typeset(main);

    $('#mark-done').addEventListener('click', function () {
      state.done[ch.id] = !state.done[ch.id]; save();
      this.textContent = state.done[ch.id] ? 'Studied ✓' : 'Mark as studied';
      this.setAttribute('aria-pressed', !!state.done[ch.id]);
      buildRail(); setActiveRail(ch.id);
    });

    // scrollspy
    if (spy) spy.disconnect();
    if ('IntersectionObserver' in window) {
      var links = {}; $$('.ch-toc a[data-sec]', main).forEach(function (a) { links[a.getAttribute('data-sec')] = a; });
      spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { $$('.ch-toc a.on', main).forEach(function (a) { a.classList.remove('on'); }); var l = links[e.target.id]; if (l) l.classList.add('on'); }
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      $$('.sec[id]', main).forEach(function (s) { spy.observe(s); });
    }

    if (anchor) {
      var target = document.getElementById(anchor);
      if (target) setTimeout(function () { target.scrollIntoView(); }, 30);
    } else { window.scrollTo(0, 0); }
  }

  function viewLectures() {
    var weeks = {};
    CSO.lectures.forEach(function (l) { (weeks[l.week] = weeks[l.week] || []).push(l); });
    var html = '<div class="page"><header><h1>All 60 lectures</h1><p>The NPTEL video list in order, with the chapter of this guide that covers each one. Video links open YouTube in a new tab.</p></header>';
    Object.keys(weeks).sort(function (a, b) { return a - b; }).forEach(function (w) {
      html += '<section class="week-block"><h2>Week ' + w + ': ' + esc(weeks[w][0].weekTitle) + '</h2>';
      weeks[w].forEach(function (l) {
        var chs = chapterOfLecture(l.n);
        html += '<div class="lec-row"><span class="ln">' + pad2(l.n) + '</span><span class="lt"><span>' + esc(l.title) + '</span><small>' + esc(l.topic || '') + '</small></span><span class="la">' +
          chs.map(function (c) { return '<a class="pill c" href="#' + c.id + '">Ch ' + pad2(c.num) + ' ' + esc(c.short || c.title) + '</a>'; }).join(' ') +
          ' <a class="btn" href="' + lecUrl(l) + '" target="_blank" rel="noopener">Watch</a></span></div>';
      });
      html += '</section>';
    });
    main.innerHTML = html + '</div>';
    window.scrollTo(0, 0);
  }

  function viewFormulas() {
    var html = '<div class="page"><header><h1>Formula sheet</h1><p>Every equation from the chapters in one place, grouped by chapter. Select a chapter title to read the explanation around it.</p></header>';
    CSO.chapters.forEach(function (c) {
      var t = document.createElement('template'); t.innerHTML = c.sections.map(function (s) { return s.html; }).join('');
      var fs = $$('.formula', t.content);
      if (!fs.length) return;
      html += '<section class="fs-group"><h2>' + pad2(c.num) + ' ' + esc(c.title) + ' <a href="#' + c.id + '">Open chapter</a></h2><div class="fs-grid">' + fs.map(function (f) { return f.outerHTML; }).join('') + '</div></section>';
    });
    main.innerHTML = html + '</div>';
    typeset(main); window.scrollTo(0, 0);
  }

  function viewNumbers() {
    var html = '<div class="page"><header><h1>Numbers to know</h1><p>Figures quoted in the lectures that are easy to examine: sizes, counts, speed-ups and ratios. Each row names the chapter it comes from.</p></header><div class="tbl-wrap"><table class="tbl"><thead><tr><th>What</th><th class="num">Value</th><th>Context</th><th>Ch</th></tr></thead><tbody>';
    CSO.chapters.forEach(function (c) {
      (c.numbers || []).forEach(function (n) {
        html += '<tr><td>' + n[0] + '</td><td class="num"><b>' + n[1] + '</b></td><td class="muted">' + (n[2] || '') + '</td><td><a href="#' + c.id + '">' + pad2(c.num) + '</a></td></tr>';
      });
    });
    main.innerHTML = html + '</tbody></table></div></div>';
    typeset(main); window.scrollTo(0, 0);
  }

  function chapterSelect(id, allLabel) {
    return '<label for="' + id + '">Chapter</label><select id="' + id + '"><option value="all">' + allLabel + '</option>' + CSO.chapters.map(function (c) { return '<option value="' + c.id + '">' + pad2(c.num) + ' ' + esc(c.title) + '</option>'; }).join('') + '</select>';
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function viewCards() {
    main.innerHTML = '<div class="page"><header><h1>Flashcards</h1><p>Short prompts for active recall. Say the answer out loud, then flip the card to check.</p></header>' +
      '<div class="filter-row">' + chapterSelect('fc-ch', 'All chapters') + '<button class="btn" id="fc-shuffle">Shuffle</button><span class="muted" id="fc-count"></span></div><div id="fc-area"></div></div>';
    var all = []; CSO.chapters.forEach(function (c) { (c.cards || []).forEach(function (k) { all.push(Object.assign({ _ch: c }, k)); }); });
    var current = all;
    function draw(list) { current = list; $('#fc-count').textContent = list.length + ' cards'; renderCards($('#fc-area'), list); }
    $('#fc-ch').addEventListener('change', function () { var v = this.value; draw(v === 'all' ? all : all.filter(function (k) { return k._ch.id === v; })); });
    $('#fc-shuffle').addEventListener('click', function () { draw(shuffle(current)); });
    draw(all); window.scrollTo(0, 0);
  }

  function viewPractice() {
    main.innerHTML = '<div class="page"><header><h1>Practice test</h1><p>A random set of questions drawn from the chapter quizzes. Pick a chapter to drill one topic, or keep "Whole course" for exam-style mixed practice.</p></header>' +
      '<div class="filter-row">' + chapterSelect('pt-ch', 'Whole course') + '<label for="pt-n">Questions</label><select id="pt-n"><option>10</option><option selected>20</option><option>40</option></select><button class="btn primary" id="pt-go">New test</button></div><div id="pt-area"></div></div>';
    var all = []; CSO.chapters.forEach(function (c) { (c.quiz || []).forEach(function (q) { all.push(Object.assign({ _ch: c }, q)); }); });
    function go() {
      var v = $('#pt-ch').value, n = +$('#pt-n').value;
      var pool = v === 'all' ? all : all.filter(function (q) { return q._ch.id === v; });
      renderQuiz($('#pt-area'), shuffle(pool).slice(0, n), null, { showSource: true });
    }
    $('#pt-go').addEventListener('click', go); go(); window.scrollTo(0, 0);
  }

  /* ---------------- router ---------------- */
  var currentRoute = 'home';
  function route() {
    var h = decodeURIComponent((location.hash || '#home').slice(1));
    var m = /^(ch\d\d)(?:-(.+))?$/.exec(h);
    if (m && CSO.byId[m[1]]) {
      var anchor = m[2] ? h : null;
      if (currentRoute === m[1] && anchor && document.getElementById(anchor)) {
        document.getElementById(anchor).scrollIntoView();
      } else {
        currentRoute = m[1]; viewChapter(CSO.byId[m[1]], anchor);
        document.title = 'Ch ' + CSO.byId[m[1]].num + ' ' + CSO.byId[m[1]].title + ' | Silicon Syllabus';
      }
    } else {
      var views = { home: viewHome, lectures: viewLectures, formulas: viewFormulas, numbers: viewNumbers, cards: viewCards, practice: viewPractice };
      var key = views[h] ? h : 'home';
      currentRoute = key; views[key]();
      document.title = key === 'home' ? 'Silicon Syllabus' : ({ lectures: 'Lectures', formulas: 'Formula sheet', numbers: 'Numbers to know', cards: 'Flashcards', practice: 'Practice test' }[key] + ' | Silicon Syllabus');
      if (key === 'home') window.scrollTo(0, 0);
    }
    setActiveRail(currentRoute);
    closeRail();
  }

  function toggleTheme() {
    var root = document.documentElement;
    var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('csoml.theme', next); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    main = $('#main');
    CSO.chapters.sort(function (a, b) { return a.num - b.num; });
    buildRail(); buildIndex(); wireSearch();
    $$('[data-theme-toggle]').forEach(function (b) { b.addEventListener('click', toggleTheme); });
    $('#menu-btn').addEventListener('click', function () {
      var open = !$('#rail').classList.contains('open');
      $('#rail').classList.toggle('open', open); $('#scrim').hidden = !open; this.setAttribute('aria-expanded', open);
    });
    $('#scrim').addEventListener('click', closeRail);
    window.addEventListener('hashchange', route);
    route();
  });
})();
