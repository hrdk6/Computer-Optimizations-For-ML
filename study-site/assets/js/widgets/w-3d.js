/* 3D interactive models. Three.js is loaded lazily the first time a 3D widget scrolls into view.
   Each model registers with CSO.widget() exactly like the 2D widgets and uses the same theme tokens. */
(function () {
  'use strict';
  var h = K.h;
  var THREE_SRC = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
  var loading = null, views = [], looping = false;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = THREE_SRC; sc.async = true; sc.crossOrigin = 'anonymous';
      sc.onload = function () { window.THREE ? res(window.THREE) : rej(new Error('THREE missing')); };
      sc.onerror = function () { loading = null; rej(new Error('3D library failed to load')); };
      document.head.appendChild(sc);
    });
    return loading;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  var ROLES = { c: '--compute', cs: '--compute-soft', m: '--memory', ms: '--memory-soft', v: '--comm', vs: '--comm-soft', ink: '--ink', ink2: '--ink-2', mut: '--ink-3', line: '--line', panel: '--panel', panel2: '--panel-2', bg: '--bg', surf: '--surface', good: '--good', bad: '--bad' };
  /* role → CSS colour. "h:i:n" is the i-th of n evenly spaced hues, tuned for the current theme. */
  function roleColor(role) {
    if (role.indexOf('h:') === 0) {
      var p = role.split(':'), i = +p[1], n = Math.max(1, +p[2]);
      var hue = Math.round((200 + 360 * i / n) % 360);
      return isDark() ? 'hsl(' + hue + ', 62%, 62%)' : 'hsl(' + hue + ', 58%, 46%)';
    }
    if (ROLES[role]) return cssVar(ROLES[role]);
    return role;
  }

  /* ------------------------------------------------------------------ view ------------------------------------------------------------------ */
  function View(stage, o, build) {
    var self = this;
    this.o = o || {}; this.build = build;
    this.visible = false; this.ready = false; this.dead = false; this.started = false;
    this.labels = []; this.pick = []; this.mats = {}; this.own = []; this.themeFns = []; this.tick = null; this.needs = true; this.spin = false;
    this.host = h('div', { class: 'v3d-canvas', tabindex: '0', role: 'img', 'aria-label': this.o.label || 'Interactive 3D model' });
    if (this.o.height) this.host.style.height = this.o.height;
    this.lay = h('div', { class: 'v3d-labels', 'aria-hidden': 'true' });
    this.tipEl = h('div', { class: 'v3d-tip' }); this.tipEl.hidden = true;
    this.msg = h('div', { class: 'v3d-msg', text: 'Loading 3D model…' });
    this.host.appendChild(this.lay); this.host.appendChild(this.tipEl); this.host.appendChild(this.msg);
    var bar = h('div', { class: 'v3d-bar' });
    K.button(bar, 'Reset view', function () { self.resetCam(); });
    this.spinBtn = K.button(bar, 'Spin', function () { self.setSpin(!self.spin); });
    this.spinBtn.setAttribute('aria-pressed', 'false');
    bar.appendChild(h('span', { class: 'v3d-hint', text: 'Drag to rotate · right-drag or Shift-drag to pan · Ctrl+scroll or pinch to zoom · arrow keys work too' + (this.o.pickHint ? ' · ' + this.o.pickHint : '') }));
    stage.appendChild(h('div', { class: 'v3d' }, this.host, bar));
    this.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { self.visible = e.isIntersecting; if (e.isIntersecting) { self.needs = true; self.lastT = 0; if (!self.started) self.start(); } });
    }, { rootMargin: '250px 0px' });
    this.io.observe(this.host);
    views.push(this); startLoop();
  }
  var P = View.prototype;
  P.setSpin = function (b) { this.spin = b; this.spinBtn.setAttribute('aria-pressed', b ? 'true' : 'false'); this.needs = true; };
  P.start = function () {
    var self = this; this.started = true;
    loadThree().then(function (T) {
      if (self.dead) return;
      try { self.init(T); } catch (e) { console.error(e); self.msg.textContent = 'This 3D model could not start (' + e.message + ').'; }
    }).catch(function () { self.msg.textContent = 'The 3D library could not be loaded. Check your connection and reload the page.'; });
  };
  P.init = function (T) {
    var self = this, o = this.o, r;
    try { r = new T.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { this.msg.textContent = 'WebGL is turned off in this browser, so the 3D view is unavailable.'; return; }
    this.T = T; this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(0x000000, 0);
    this.host.insertBefore(r.domElement, this.lay);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(o.fov || 36, 1.6, 0.1, 600);
    this.hemi = new T.HemisphereLight(0xffffff, 0x8a8f8d, 0.9); this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffffff, 0.65); this.sun.position.set(8, 16, 10); this.scene.add(this.sun);
    this.root = new T.Group(); this.scene.add(this.root);
    var c = o.cam || {};
    this.cam0 = { theta: c.theta != null ? c.theta : 0.7, phi: c.phi != null ? c.phi : 0.95, r: c.r || 16, target: c.target || [0, 0, 0] };
    this.geo = { box: new T.BoxGeometry(1, 1, 1), sph: new T.SphereGeometry(0.5, 20, 14), cyl: new T.CylinderGeometry(0.5, 0.5, 1, 22), cone: new T.ConeGeometry(0.5, 1, 18) };
    this.geo.edge = new T.EdgesGeometry(this.geo.box);
    this.ray = new T.Raycaster(); this.v2 = new T.Vector2(); this.tmp = new T.Vector3();
    this.resetCam();
    this.bindInput();
    this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(this.host);
    this.resize();
    this.msg.remove();
    this.ready = true;
    this.build(this, T);
    this.needs = true;
  };
  P.resetCam = function () {
    if (!this.T) return;
    var c = this.cam0; this.theta = c.theta; this.phi = c.phi; this.rad = c.r;
    this.target = new this.T.Vector3(c.target[0], c.target[1], c.target[2]); this.needs = true;
  };
  P.applyCam = function () {
    var t = this.target, sp = Math.sin(this.phi);
    var k = Math.max(1, (this.o.aspect || 1.55) / (this.camera.aspect || 1)) * this.rad;
    this.camera.position.set(t.x + k * sp * Math.sin(this.theta), t.y + k * Math.cos(this.phi), t.z + k * sp * Math.cos(this.theta));
    this.camera.lookAt(t);
  };
  P.resize = function () {
    var w = this.host.clientWidth, hh = this.host.clientHeight;
    if (!w || !hh) return;
    this.renderer.setSize(w, hh, false);
    this.camera.aspect = w / hh; this.camera.updateProjectionMatrix();
    this.W = w; this.H = hh; this.needs = true;
  };
  P.zoom = function (f) { this.rad = clamp(this.rad * f, this.cam0.r * 0.3, this.cam0.r * 3); this.needs = true; };
  P.pan = function (dx, dy) {
    var T = this.T, s = this.rad * 0.0017;
    var right = new T.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    var up = new T.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s); this.needs = true;
  };
  P.bindInput = function () {
    var self = this, el = this.renderer.domElement, ptrs = {}, n = 0, moved = 0, pinch = 0, mode = 'rot';
    function count() { return Object.keys(ptrs).length; }
    function dist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; n = count(); moved = 0;
      mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
      if (n === 2) pinch = dist();
      self.host.classList.add('dragging'); self.hideTip();
      if (self.spin) self.setSpin(false);
    });
    el.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId];
      if (!p) { self.hover(e); return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (n >= 2) { var d = dist(); if (pinch && d) self.zoom(pinch / d); pinch = d; }
      else if (mode === 'pan') self.pan(dx, dy);
      else { self.theta -= dx * 0.008; self.phi = clamp(self.phi - dy * 0.008, 0.08, 1.62); }
      self.needs = true;
    });
    function up(e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId]; n = count(); pinch = 0;
      if (!n) self.host.classList.remove('dragging');
      if (e.type === 'pointerup' && moved < 6 && !n) self.click(e);
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', function () { if (!n) self.hideTip(); });
    el.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); self.zoom(Math.exp(e.deltaY * 0.0015)); }, { passive: false });
    el.addEventListener('dblclick', function () { self.resetCam(); });
    this.host.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') self.theta += 0.12; else if (k === 'ArrowRight') self.theta -= 0.12;
      else if (k === 'ArrowUp') self.phi = clamp(self.phi - 0.1, 0.08, 1.62); else if (k === 'ArrowDown') self.phi = clamp(self.phi + 0.1, 0.08, 1.62);
      else if (k === '+' || k === '=') self.zoom(0.9); else if (k === '-' || k === '_') self.zoom(1.1);
      else if (k === '0') self.resetCam(); else used = false;
      if (used) { e.preventDefault(); self.needs = true; }
    });
  };
  P.attached = function (o) { while (o) { if (o === this.scene) return true; o = o.parent; } return false; };
  P.hit = function (e) {
    if (!this.pick.length) return null;
    var self = this, rect = this.renderer.domElement.getBoundingClientRect();
    this.pick = this.pick.filter(function (o) { return self.attached(o); });
    this.v2.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.v2, this.camera);
    var hits = this.ray.intersectObjects(this.pick, false);
    for (var i = 0; i < hits.length; i++) if (hits[i].object.visible) return hits[i].object;
    return null;
  };
  P.hover = function (e) {
    var o = this.hit(e);
    if (o && o.userData.tip) {
      var t = typeof o.userData.tip === 'function' ? o.userData.tip() : o.userData.tip;
      var rect = this.host.getBoundingClientRect();
      this.tipEl.innerHTML = t; this.tipEl.hidden = false;
      var x = e.clientX - rect.left + 14, y = e.clientY - rect.top + 14;
      var tw = this.tipEl.offsetWidth, th = this.tipEl.offsetHeight;
      if (x + tw > rect.width - 6) x = e.clientX - rect.left - tw - 10;
      if (y + th > rect.height - 6) y = e.clientY - rect.top - th - 10;
      this.tipEl.style.transform = 'translate(' + Math.max(4, x) + 'px,' + Math.max(4, y) + 'px)';
      this.renderer.domElement.style.cursor = o.userData.onClick ? 'pointer' : '';
    } else this.hideTip();
  };
  P.hideTip = function () { this.tipEl.hidden = true; if (this.renderer) this.renderer.domElement.style.cursor = ''; };
  P.click = function (e) { var o = this.hit(e); if (o && o.userData.onClick) { o.userData.onClick(); this.needs = true; this.hover(e); } };

  /* materials are cached per role and repainted when the theme changes */
  P.mat = function (role, opt) {
    opt = opt || {};
    var op = opt.o != null ? opt.o : 1;
    var key = role + '|' + op + '|' + (opt.glow || 0) + '|' + (opt.line ? 1 : 0) + '|' + (opt.flat ? 1 : 0);
    if (this.mats[key]) return this.mats[key].m;
    var T = this.T, m, tr = op < 1;
    if (opt.line) m = new T.LineBasicMaterial({ transparent: tr, opacity: op });
    else if (opt.flat) m = new T.MeshBasicMaterial({ transparent: tr, opacity: op });
    else m = new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04, transparent: tr, opacity: op });
    if (tr) m.depthWrite = false;
    this.mats[key] = { m: m, role: role, opt: opt }; this.paint(this.mats[key]);
    return m;
  };
  P.paint = function (e) {
    var col = roleColor(e.role);
    e.m.color.setStyle(col);
    if (e.opt.glow && e.m.emissive) { e.m.emissive.setStyle(col); e.m.emissiveIntensity = e.opt.glow; }
  };
  /* an un-cached material whose colour the widget sets itself (for gradients) */
  P.ownMat = function (opt) {
    opt = opt || {};
    var m = new this.T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04, transparent: opt.o != null && opt.o < 1, opacity: opt.o != null ? opt.o : 1 });
    this.own.push(m); return m;
  };
  P.color = function (role) { return new this.T.Color().setStyle(roleColor(role)); };
  P.retheme = function () {
    var self = this;
    Object.keys(this.mats).forEach(function (k) { self.paint(self.mats[k]); });
    this.themeFns.forEach(function (f) { f(); });
    this.needs = true;
  };

  /* geometry helpers: shared unit geometries scaled per mesh */
  P.add = function (obj, parent) { (parent || this.root).add(obj); return obj; };
  P.group = function (parent) { return this.add(new this.T.Group(), parent); };
  P.box = function (sx, sy, sz, mat, x, y, z, parent) {
    var m = new this.T.Mesh(this.geo.box, mat); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); return this.add(m, parent);
  };
  P.wire = function (sx, sy, sz, mat, x, y, z, parent) {
    var m = new this.T.LineSegments(this.geo.edge, mat); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); return this.add(m, parent);
  };
  P.ball = function (d, mat, x, y, z, parent) {
    var m = new this.T.Mesh(this.geo.sph, mat); m.scale.set(d, d, d); m.position.set(x || 0, y || 0, z || 0); return this.add(m, parent);
  };
  P.cyl = function (d, len, mat, x, y, z, parent) {
    var m = new this.T.Mesh(this.geo.cyl, mat); m.scale.set(d, len, d); m.position.set(x || 0, y || 0, z || 0); return this.add(m, parent);
  };
  P.cone = function (d, len, mat, x, y, z, parent) {
    var m = new this.T.Mesh(this.geo.cone, mat); m.scale.set(d, len, d); m.position.set(x || 0, y || 0, z || 0); return this.add(m, parent);
  };
  /* rod between two points (cylinder oriented along the segment) */
  P.rod = function (a, b, d, mat, parent) {
    var T = this.T, A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]);
    var dir = B.clone().sub(A), len = dir.length();
    var m = new T.Mesh(this.geo.cyl, mat); m.scale.set(d, len, d);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    return this.add(m, parent);
  };
  P.line = function (pts, mat, parent, segments) {
    var T = this.T, g = new T.BufferGeometry().setFromPoints(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
    var l = segments ? new T.LineSegments(g, mat) : new T.Line(g, mat); l.userData.ownGeo = true; return this.add(l, parent);
  };
  /* arrowhead cone at b pointing away from a */
  P.arrow = function (a, b, d, mat, parent) {
    var T = this.T, dir = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    var m = this.cone(d, d * 1.6, mat, b[0], b[1], b[2], parent);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); return m;
  };
  P.empty = function (g) {
    while (g.children.length) {
      var c = g.children.pop();
      c.traverse(function (x) { if (x.userData.ownGeo && x.geometry) x.geometry.dispose(); });
    }
  };
  P.tip = function (mesh, tip, onClick) { mesh.userData.tip = tip; if (onClick) mesh.userData.onClick = onClick; this.pick.push(mesh); return mesh; };

  /* HTML labels pinned to 3D points */
  P.label = function (text, x, y, z, cls) {
    var el = h('span', { class: cls || '' }); el.textContent = text; this.lay.appendChild(el);
    var self = this, L = {
      el: el, p: new this.T.Vector3(x, y, z), on: true,
      set: function (t) { t = String(t); if (el.textContent !== t) el.textContent = t; return L; },
      show: function (b) { b = !!b; if (L.on !== b) { L.on = b; self.needs = true; } return L; },
      at: function (x, y, z) { L.p.set(x, y, z); return L; }
    };
    this.labels.push(L); this.needs = true; return L;
  };
  P.dropLabels = function (list) {
    if (!list) return;
    list.forEach(function (L) { if (L.el.parentNode) L.el.parentNode.removeChild(L.el); });
    this.labels = this.labels.filter(function (L) { return list.indexOf(L) < 0; });
    list.length = 0;
  };
  P.placeLabels = function () {
    var W = this.W, H = this.H, v = this.tmp, cam = this.camera;
    this.labels.forEach(function (L) {
      var vis = L.on;
      if (vis) { v.copy(L.p).project(cam); vis = v.z < 1 && v.z > -1; }
      if (!vis) { if (L.vis !== false) { L.el.style.display = 'none'; L.vis = false; } return; }
      if (L.vis !== true) { L.el.style.display = ''; L.vis = true; }
      L.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * W).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * H).toFixed(1) + 'px) translate(-50%,-50%)';
    });
  };
  P.frame = function (t) {
    if (!this.ready || this.dead || !this.visible) return;
    var dt = this.lastT ? Math.min(0.1, (t - this.lastT) / 1000) : 0.016; this.lastT = t;
    var anim = false;
    if (this.tick) anim = this.tick(dt, t / 1000) === true;
    if (this.spin) { this.theta += dt * 0.3; anim = true; }
    if (!anim && !this.needs) return;
    this.needs = false;
    this.applyCam();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };
  P.destroy = function () {
    this.dead = true;
    try { this.io.disconnect(); } catch (e) {}
    if (this.ro) this.ro.disconnect();
    if (this.renderer) {
      var self = this;
      this.root && this.empty(this.root);
      Object.keys(this.mats).forEach(function (k) { self.mats[k].m.dispose(); });
      this.own.forEach(function (m) { m.dispose(); });
      Object.keys(this.geo).forEach(function (k) { self.geo[k].dispose(); });
      this.renderer.dispose();
      try { this.renderer.forceContextLoss(); } catch (e) {}
    }
  };

  function startLoop() {
    if (looping) return; looping = true;
    requestAnimationFrame(function loop(t) {
      for (var i = 0; i < views.length; i++) { try { views[i].frame(t); } catch (e) { console.error(e); views[i].dead = true; } }
      requestAnimationFrame(loop);
    });
  }
  /* free WebGL contexts when the page swaps chapters */
  function sweep() { views = views.filter(function (v) { if (document.body.contains(v.host)) return true; v.destroy(); return false; }); }
  var sweepT = 0;
  new MutationObserver(function () { clearTimeout(sweepT); sweepT = setTimeout(sweep, 400); }).observe(document.getElementById('main') || document.body, { childList: true });
  function rethemeAll() { requestAnimationFrame(function () { views.forEach(function (v) { if (v.ready) v.retheme(); }); }); }
  new MutationObserver(rethemeAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', rethemeAll); }

  /* time controller: Play / Step / Back / Reset with smooth tweening between integer steps */
  function clock(parent, o) {
    var C = { t: 0, target: 0, playing: false, view: null };
    var bPlay = K.button(parent, 'Play', function () {
      if (C.playing) return stop();
      if (C.target >= o.max() - 1e-6) { C.t = C.target = 0; o.on(0); }
      C.playing = true; bPlay.textContent = 'Pause'; poke();
    }, true);
    K.button(parent, 'Step', function () { stop(); C.target = Math.min(o.max(), Math.floor(C.target + 1e-6) + 1); poke(); });
    K.button(parent, 'Back', function () { stop(); C.target = Math.max(0, Math.ceil(C.target - 1e-6) - 1); poke(); });
    K.button(parent, 'Reset', function () { stop(); C.t = C.target = 0; o.on(0); poke(); });
    function stop() { C.playing = false; bPlay.textContent = 'Play'; }
    function poke() { if (C.view && C.view.ready) C.view.needs = true; else { C.t = C.target; o.on(C.t); } }
    C.tick = function (dt) {
      var sp = typeof o.speed === 'function' ? o.speed() : (o.speed || 1);
      if (C.playing) {
        C.target = Math.min(o.max(), C.target + dt * sp * (reduce ? 0.6 : 1));
        if (o.snap) C.target = Math.min(o.max(), C.target);
        C.t = o.snap ? Math.floor(C.target + 1e-6) : C.target;
        o.on(C.t);
        if (C.target >= o.max()) { C.t = C.target = o.max(); o.on(C.t); stop(); }
        return true;
      }
      if (Math.abs(C.t - C.target) > 1e-4) {
        var d = C.target - C.t, s = dt * 4.5;
        C.t = (reduce || o.snap || Math.abs(d) < s) ? C.target : C.t + (d > 0 ? s : -s);
        o.on(C.t); return true;
      }
      return false;
    };
    C.set = function (v) { stop(); C.t = C.target = v; o.on(v); poke(); };
    C.stop = stop;
    return C;
  }

  function frame3d(el, title, hint) { var f = K.frame(el, title, hint); f.root.classList.add('is-3d'); return f; }
  function mount(stage, o, build) { return new View(stage, o, build); }
  window.T3 = { mount: mount, clock: clock, frame: frame3d, color: roleColor };

  /* =============================================================== MODELS =============================================================== */

  /* ---------- 1. convolution volumes ---------- */
  CSO.widget('conv3d', function (el, o) {
    var f = frame3d(el, '3D model: one convolution layer as volumes', 'Each filter spans all C input channels and writes one output channel');
    var st = { H: 7, R: 3, C: o.C || 3, M: o.M || 2, U: 1 };
    function E() { return Math.floor((st.H - st.R) / st.U) + 1; }
    function steps() { return st.M * E() * E(); }
    K.slider(f.ctrl, { label: 'Input channels C', min: 1, max: 4, value: st.C, on: function (x) { st.C = x; rebuild(); } });
    K.slider(f.ctrl, { label: 'Filters M', min: 1, max: 4, value: st.M, on: function (x) { st.M = x; rebuild(); } });
    K.seg(f.ctrl, { label: 'Stride', value: '1', options: [['1', 'Stride 1'], ['2', 'Stride 2']], on: function (x) { st.U = +x; rebuild(); } });
    var clk = clock(f.ctrl, { max: steps, speed: function () { return Math.max(2, steps() / 14); }, on: draw });
    var sOut = K.stat(f.out, 'Output volume E × F × M', 'c'), sMac = K.stat(f.out, 'MACs per output = R·S·C', 'm'), sTot = K.stat(f.out, 'Total MACs = E·F·M·R·S·C', 'v'), sNow = K.stat(f.out, 'Now computing');
    var v = null, G = null, inVox = [], outVox = [], fg = null, proj = null, lbl = [], Lf = null, lay = null;
    T3.mount(f.stage, { cam: { theta: 0.62, phi: 1.08, r: 24, target: [0, 0, -1] }, label: 'Input fmap volume, a sliding filter volume and the output fmap volume', pickHint: 'hover an output cell' }, function (view) {
      v = view; view.tick = clk.tick; clk.view = view; rebuild();
    });
    function layout() { var Ev = E(), gap = 4.5, w = st.H + gap + Ev; return { x0: -w / 2 + 0.5, ox0: -w / 2 + 0.5 + st.H + gap, Ev: Ev }; }
    function rebuild() {
      clk.stop(); clk.t = clk.target = 0;
      var Ev = E();
      sOut(Ev + ' × ' + Ev + ' × ' + st.M); sMac(st.R + '·' + st.R + '·' + st.C + ' = ' + st.R * st.R * st.C); sTot((Ev * Ev * st.M * st.R * st.R * st.C).toLocaleString('en-US'));
      if (!v) { draw(0); return; }
      if (G) v.empty(G); else G = v.group();
      v.dropLabels(lbl); inVox = []; outVox = [];
      lay = layout(); var H = st.H;
      for (var c = 0; c < st.C; c++) for (var r = 0; r < H; r++) for (var q = 0; q < H; q++) {
        var b = v.box(0.84, 0.84, 0.84, v.mat('ms'), lay.x0 + q, (H - 1) / 2 - r, -c * 1.05, G); b.userData.rc = [r, q]; inVox.push(b);
      }
      for (var m = 0; m < st.M; m++) for (r = 0; r < Ev; r++) for (q = 0; q < Ev; q++) {
        (function (m, r, q) {
          var ob = v.box(0.84, 0.84, 0.84, v.mat('line', { o: 0.4 }), lay.ox0 + q, (Ev - 1) / 2 - r, -m * 1.05, G);
          v.tip(ob, function () { return '<b>out[' + m + '][' + r + '][' + q + ']</b><br>= Σ over a ' + st.R + '×' + st.R + '×' + st.C + ' window of the input<br>× filter ' + m + ' → ' + st.R * st.R * st.C + ' MACs'; });
          outVox.push(ob);
        })(m, r, q);
      }
      fg = v.group(G);
      v.box(st.R + 0.12, st.R + 0.12, st.C * 1.05 + 0.1, v.mat('v', { o: 0.2 }), 0, 0, 0, fg);
      v.wire(st.R + 0.12, st.R + 0.12, st.C * 1.05 + 0.1, v.mat('v', { line: true }), 0, 0, 0, fg);
      proj = v.line([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], v.mat('v', { line: true, o: 0.7 }), G, true);
      lbl.push(v.label('input fmap  H × W × C = ' + H + ' × ' + H + ' × ' + st.C, lay.x0 + (H - 1) / 2, -H / 2 - 1.0, 0.5, 'big m'));
      lbl.push(v.label('output fmap  E × F × M = ' + Ev + ' × ' + Ev + ' × ' + st.M, lay.ox0 + (Ev - 1) / 2, Ev / 2 + 1.6, 0, 'big c'));
      lbl.push(v.label('channels →', lay.x0 - 1.2, -(H - 1) / 2 - 0.9, -(st.C - 1) * 1.05, 'mut'));
      Lf = v.label('', 0, 0, 0, 'v'); lbl.push(Lf);
      draw(0);
    }
    function pos(idx) {
      var Ev = E(), m = Math.floor(idx / (Ev * Ev)), rr = idx % (Ev * Ev);
      return { m: m, r: Math.floor(rr / Ev), q: rr % Ev };
    }
    function winCenter(p) { var H = st.H; return [lay.x0 + p.q * st.U + (st.R - 1) / 2, (H - 1) / 2 - (p.r * st.U + (st.R - 1) / 2), -(st.C - 1) * 1.05 / 2]; }
    function draw(t) {
      var N = steps(), cur = t >= N - 1e-6 ? -1 : Math.floor(t + 1e-6), done = cur < 0 ? N : cur;
      var p = pos(cur < 0 ? N - 1 : cur);
      sNow(cur < 0 ? 'done: all ' + N + ' outputs' : 'out[' + p.m + '][' + p.r + '][' + p.q + ']  (' + (cur + 1) + ' of ' + N + ')');
      if (!v || !lay) return;
      var c0 = winCenter(p), fr = t - Math.floor(t);
      if (cur >= 0 && cur + 1 < N) {
        var p2 = pos(cur + 1), e = clamp((fr - 0.6) / 0.4, 0, 1);
        if (p2.m === p.m && p2.r === p.r && e > 0) { var c1 = winCenter(p2); c0 = [c0[0] + (c1[0] - c0[0]) * e, c0[1], c0[2]]; }
      }
      fg.position.set(c0[0], c0[1], c0[2]); fg.visible = cur >= 0;
      var r0 = p.r * st.U, q0 = p.q * st.U;
      inVox.forEach(function (b) {
        var on = cur >= 0 && b.userData.rc[0] >= r0 && b.userData.rc[0] < r0 + st.R && b.userData.rc[1] >= q0 && b.userData.rc[1] < q0 + st.R;
        b.material = on ? v.mat('m', { glow: 0.25 }) : v.mat('ms');
      });
      outVox.forEach(function (b, i) { b.material = i < done ? v.mat('cs') : i === cur ? v.mat('c', { glow: 0.35 }) : v.mat('line', { o: 0.4 }); });
      var Ev = E(), ox = lay.ox0 + p.q, oy = (Ev - 1) / 2 - p.r, oz = -p.m * 1.05 + 0.42;
      var hx = st.R / 2 + 0.06, fz = 0.5, a = proj.geometry.attributes.position, k = 0;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
        a.setXYZ(k++, c0[0] + s[0] * hx, c0[1] + s[1] * hx, fz);
        a.setXYZ(k++, ox + s[0] * 0.42, oy + s[1] * 0.42, oz);
      });
      a.needsUpdate = true; proj.geometry.computeBoundingSphere(); proj.visible = cur >= 0;
      Lf.at(c0[0], c0[1] + st.R / 2 + 0.7, 0.4).set('filter ' + p.m + ': ' + st.R + '×' + st.R + '×' + st.C).show(cur >= 0);
      f.note.innerHTML = cur < 0 ? 'All <b>' + N + '</b> outputs computed. Notice that every filter re-read the same input volume: that is the <b>fmap reuse</b> accelerators try to keep on chip.'
        : 'Filter <b>' + p.m + '</b> covers a <b>' + st.R + '×' + st.R + '×' + st.C + '</b> block (all ' + st.C + ' input channels at once). Its dot product with that block is one number in output channel <b>' + p.m + '</b>. Then it slides by stride <b>' + st.U + '</b>.';
      v.needs = true;
    }
  });

  /* ---------- 2. GEMM iteration space and tiling ---------- */
  CSO.widget('gemm3d', function (el) {
    var f = frame3d(el, '3D model: the M × N × K iteration cube of C = A·B, tile by tile', 'Every small cube is one multiply-add; a tile is a block of them that shares data in cache');
    var S = 8, st = { T: 2 };
    function nt() { return S / st.T; }
    function steps() { return Math.pow(nt(), 3); }
    K.seg(f.ctrl, { label: 'Tile', value: '2', options: [['1', 'No tiling (1)'], ['2', 'Tile 2'], ['4', 'Tile 4'], ['8', 'Whole (8)']], on: function (x) { st.T = +x; rebuild(); } });
    var clk = clock(f.ctrl, { max: steps, speed: function () { return Math.max(1.4, steps() / 16); }, on: draw });
    var sTr = K.stat(f.out, 'Elements moved from DRAM', 'm'), sNa = K.stat(f.out, 'Without tiling (2MNK + MN)', ''), sRe = K.stat(f.out, 'Reuse of each loaded element', 'c'), sBuf = K.stat(f.out, 'On-chip buffer needed (3T²)', 'v');
    var v = null, G = null, Ac = [], Bc = [], Cc = [], tg = null, lbl = [];
    T3.mount(f.stage, { cam: { theta: -0.62, phi: 0.98, r: 26, target: [0, 0.4, 0] }, label: 'Iteration cube with A on the left face, B on top and C on the front', pickHint: 'hover a cell' }, function (view) {
      v = view; view.tick = clk.tick; clk.view = view; rebuild();
    });
    var o = -(S - 1) / 2;
    function X(n) { return o + n; } function Y(m) { return -o - m; } function Z(k) { return -o - k; }
    function rebuild() {
      clk.stop(); clk.t = clk.target = 0;
      var T = st.T, MNK = S * S * S;
      sNa((2 * MNK + S * S).toLocaleString('en-US')); sRe(T + '×'); sBuf(3 * T * T + ' elements');
      if (!v) { draw(0); return; }
      if (G) v.empty(G); else G = v.group();
      v.dropLabels(lbl); Ac = []; Bc = []; Cc = [];
      v.wire(S, S, S, v.mat('mut', { line: true, o: 0.6 }), 0, 0, 0, G);
      for (var m = 0; m < S; m++) for (var k = 0; k < S; k++) Ac.push(v.tip(v.box(0.12, 0.88, 0.88, v.mat('ms'), o - 1.6, Y(m), Z(k), G), 'A[' + m + '][' + k + ']'));
      for (k = 0; k < S; k++) for (var n = 0; n < S; n++) Bc.push(v.tip(v.box(0.88, 0.12, 0.88, v.mat('vs'), X(n), -o + 1.6, Z(k), G), 'B[' + k + '][' + n + ']'));
      for (m = 0; m < S; m++) for (n = 0; n < S; n++) (function (m, n) { Cc.push(v.tip(v.box(0.88, 0.88, 0.12, v.mat('panel2'), X(n), Y(m), -o + 1.3, G), function () { return 'C[' + m + '][' + n + '] = Σₖ A[' + m + '][k]·B[k][' + n + ']'; })); })(m, n);
      tg = v.group(G);
      v.box(T, T, T, v.mat('c', { o: 0.3 }), 0, 0, 0, tg); v.wire(T, T, T, v.mat('c', { line: true }), 0, 0, 0, tg);
      lbl.push(v.label('A  (M × K)', o - 1.6, -o + 1.3, -0.5, 'big m'));
      lbl.push(v.label('B  (K × N)', -o + 1.2, -o + 2.2, -0.5, 'big v'));
      lbl.push(v.label('C = A·B  (M × N)', 0, o - 1.3, -o + 1.3, 'big c'));
      lbl.push(v.label('k (reduction) runs back →', o - 0.4, -o + 0.7, Z(S - 1) - 0.6, 'mut'));
      draw(0);
    }
    function tile(q) { var n = nt(); return { i: Math.floor(q / (n * n)), j: Math.floor(q / n) % n, k: q % n }; }
    function draw(t) {
      var Ns = steps(), cur = t >= Ns - 1e-6 ? -1 : Math.floor(t + 1e-6), done = cur < 0 ? Ns : cur, T = st.T, n = nt();
      var traffic = (done + (cur >= 0 ? 1 : 0)) * 2 * T * T, cdone = 0;
      for (var a = 0; a < n * n; a++) if (done >= (a + 1) * n) cdone++;
      sTr((traffic + cdone * T * T).toLocaleString('en-US') + ' of ' + (2 * S * S * S / T + S * S).toLocaleString('en-US'));
      if (!v || !tg) return;
      var p = tile(cur < 0 ? Ns - 1 : cur);
      tg.visible = cur >= 0;
      tg.position.set(X(p.j * T + (T - 1) / 2), Y(p.i * T + (T - 1) / 2), Z(p.k * T + (T - 1) / 2));
      Ac.forEach(function (b, idx) { var m = Math.floor(idx / S), k = idx % S; var on = cur >= 0 && m >= p.i * T && m < p.i * T + T && k >= p.k * T && k < p.k * T + T; b.material = on ? v.mat('m', { glow: 0.3 }) : v.mat('ms'); });
      Bc.forEach(function (b, idx) { var k = Math.floor(idx / S), nn = idx % S; var on = cur >= 0 && k >= p.k * T && k < p.k * T + T && nn >= p.j * T && nn < p.j * T + T; b.material = on ? v.mat('v', { glow: 0.3 }) : v.mat('vs'); });
      Cc.forEach(function (b, idx) {
        var m = Math.floor(idx / S), nn = idx % S, ti = Math.floor(m / T), tj = Math.floor(nn / T);
        var got = clamp(done - (ti * n + tj) * n, 0, n), isCur = cur >= 0 && ti === p.i && tj === p.j;
        b.material = isCur ? v.mat('c', { glow: 0.35, o: 0.85 }) : got === n ? v.mat('c') : got > 0 ? v.mat('cs', { o: 0.7 }) : v.mat('line', { o: 0.28 });
        b.scale.z = isCur ? 0.32 : 0.12;
      });
      f.note.innerHTML = cur < 0 ? 'Finished: every cube of the iteration space was visited once. Bigger tiles mean each element of A and B, once loaded, is used <b>' + T + '</b> times before it is evicted, so DRAM traffic falls by about <b>' + T + '×</b>, as long as 3 tiles fit in the cache.'
        : 'Tile (' + p.i + ', ' + p.j + ', ' + p.k + '): load a <b>' + T + '×' + T + '</b> block of A and of B, do <b>' + T * T * T + '</b> multiply-adds with them, and add the result into the ' + T + '×' + T + ' block of C. The k loop is innermost, so the C block stays on chip until it is complete.';
      v.needs = true;
    }
  });

  /* ---------- 3. systolic array ---------- */
  CSO.widget('systolic3d', function (el, o) {
    var f = frame3d(el, '3D model: data pulsing through a systolic array', 'A values move right, B values move down, every PE multiplies what passes through and keeps its own sum');
    var st = { N: o.N || 4, vals: true };
    function A(i, k) { return ((i + 1) * (k + 2)) % 5 + 1; }
    function B(k, j) { return ((k + 1) + 2 * (j + 1)) % 4 + 1; }
    function steps() { return 3 * st.N - 2; }
    K.select(f.ctrl, { label: 'Array', value: String(st.N), options: [['3', '3×3'], ['4', '4×4'], ['5', '5×5']], on: function (x) { st.N = +x; rebuild(); } });
    var clk = clock(f.ctrl, { max: function () { return steps() + 0.999; }, speed: 1.1, on: draw });
    var sC = K.stat(f.out, 'Clock cycle', 'v'), sB = K.stat(f.out, 'PEs busy this cycle', 'm'), sM = K.stat(f.out, 'MACs done', 'c'), sD = K.stat(f.out, 'Cycles to finish = 3N − 2');
    var v = null, G = null, pe = [], acc = [], aB = [], bB = [], lbl = [], accL = [], aL = [], bL = [], maxAcc = 1, S = 1.8;
    T3.mount(f.stage, { cam: { theta: 0.55, phi: 0.92, r: 17, target: [0, 0, 0] }, label: 'Grid of processing elements with A values flowing along rows and B values down columns', pickHint: 'hover a PE' }, function (view) {
      v = view; view.tick = clk.tick; clk.view = view; rebuild();
    });
    function accAt(i, j, t) { var s = 0, n = 0; for (var k = 0; k < st.N; k++) if (i + j + k + 1 <= t + 1e-6) { s += A(i, k) * B(k, j); n++; } return [s, n]; }
    function rebuild() {
      clk.stop(); clk.t = clk.target = 0; sD(steps());
      if (!v) { draw(0); return; }
      if (G) v.empty(G); else G = v.group();
      v.dropLabels(lbl); v.dropLabels(accL); v.dropLabels(aL); v.dropLabels(bL);
      pe = []; acc = []; aB = []; bB = [];
      var N = st.N, off = -(N - 1) * S / 2; G.position.set(off, 0, off);
      maxAcc = 1; for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) maxAcc = Math.max(maxAcc, accAt(i, j, 99)[0]);
      for (i = 0; i < N; i++) {
        v.rod([-2.6 * S, 0.55, i * S - 0.6], [(N - 0.4) * S, 0.55, i * S - 0.6], 0.05, v.mat('ms'), G);
        for (j = 0; j < N; j++) {
          (function (i, j) {
            var b = v.box(1.25, 0.32, 1.25, v.mat('panel2'), j * S, 0, i * S, G);
            v.tip(b, function () { var a = accAt(i, j, clk.t); return '<b>PE(' + i + ',' + j + ')</b> keeps C[' + i + '][' + j + ']<br>sum so far = ' + a[0] + ' after ' + a[1] + ' of ' + st.N + ' products'; });
            pe.push(b);
            var c = v.cyl(0.55, 1, v.mat('c'), j * S, 0.2, i * S, G); acc.push(c);
            accL.push(v.label('0', j * S, 1, i * S, 'c'));
          })(i, j);
        }
      }
      for (j = 0; j < N; j++) v.rod([j * S + 0.6, 0.55, -2.6 * S], [j * S + 0.6, 0.55, (N - 0.4) * S], 0.05, v.mat('vs'), G);
      for (i = 0; i < N; i++) for (var k = 0; k < N; k++) { aB.push({ i: i, k: k, m: v.ball(0.42, v.mat('m', { glow: 0.15 }), 0, 0, 0, G) }); aL.push(v.label(String(A(i, k)), 0, 0, 0, 'm')); }
      for (k = 0; k < N; k++) for (j = 0; j < N; j++) { bB.push({ k: k, j: j, m: v.ball(0.42, v.mat('v', { glow: 0.15 }), 0, 0, 0, G) }); bL.push(v.label(String(B(k, j)), 0, 0, 0, 'v')); }
      lbl.push(v.label('rows of A enter here →', off - 2.2 * S, 1.3, off - 0.6, 'm'));
      lbl.push(v.label('columns of B enter here ↓', off + 0.3, 1.3, off - 2.2 * S, 'v'));
      draw(0);
    }
    function draw(t) {
      var N = st.N, cyc = Math.min(steps(), Math.floor(t + 1e-6)), busy = 0, macs = 0;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) { var kk = cyc - 1 - i - j; if (cyc > 0 && kk >= 0 && kk < N) busy++; macs += accAt(i, j, t)[1]; }
      sC(cyc + ' of ' + steps()); sB(busy + ' of ' + N * N); sM(macs + ' of ' + N * N * N);
      f.note.innerHTML = cyc === 0 ? 'Rows of A are <b>skewed</b> by one cycle per row and columns of B by one cycle per column, so the right pair meets in each PE at the right time.'
        : cyc >= steps() ? 'Done after <b>' + steps() + '</b> cycles. Each value was fetched from memory <b>once</b> and then reused by N PEs as it travelled: that is why systolic arrays save memory bandwidth.'
          : 'Cycle ' + cyc + ': PE(i, j) is multiplying A[i][k]·B[k][j] with i + j + k = ' + (cyc - 1) + ', a diagonal wavefront. Busy PEs glow; tall columns show partial sums of C growing.';
      if (!v || !pe.length) return;
      var gx = G.position.x, gz = G.position.z;
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
        var idx = i * N + j, a = accAt(i, j, t), k2 = cyc - 1 - i - j, firing = cyc > 0 && k2 >= 0 && k2 < N && (t - cyc) < 0.55;
        pe[idx].material = firing ? v.mat('c', { glow: 0.4 }) : a[1] === N ? v.mat('cs') : v.mat('panel2');
        var hgt = 0.08 + 2.4 * a[0] / maxAcc; acc[idx].scale.y = hgt; acc[idx].position.y = 0.16 + hgt / 2;
        acc[idx].material = a[1] === N ? v.mat('c') : v.mat('c', { o: 0.55 });
        accL[idx].at(gx + j * S, 0.55 + hgt, gz + i * S).set(a[0]);
      }
      aB.forEach(function (b, n) {
        var x = t - 1 - b.i - b.k, vis = x > -2.6 && x < N - 0.45;
        b.m.visible = vis; b.m.position.set(x * S, 0.55, b.i * S - 0.6);
        aL[n].at(gx + x * S, 1.0, gz + b.i * S - 0.6).show(vis && st.N <= 4);
      });
      bB.forEach(function (b, n) {
        var z = t - 1 - b.j - b.k, vis = z > -2.6 && z < N - 0.45;
        b.m.visible = vis; b.m.position.set(b.j * S + 0.6, 0.55, z * S);
        bL[n].at(gx + b.j * S + 0.6, 1.0, gz + z * S).show(vis && st.N <= 4);
      });
      v.needs = true;
    }
  });

  /* ---------- 4. ring all-reduce ---------- */
  CSO.widget('ring3d', function (el) {
    var f = frame3d(el, '3D model: ring all-reduce, chunk by chunk', 'Each GPU splits its gradient into P chunks; a chunk column\'s height = how many GPUs\' gradients it already sums');
    var st = { P: 4 };
    function steps() { return 2 * (st.P - 1); }
    K.slider(f.ctrl, { label: 'GPUs P', min: 3, max: 6, value: st.P, on: function (x) { st.P = x; rebuild(); } });
    var clk = clock(f.ctrl, { max: steps, speed: 0.8, on: draw });
    var sPh = K.stat(f.out, 'Phase', 'v'), sSt = K.stat(f.out, 'Step', ''), sSent = K.stat(f.out, 'Sent per GPU so far', 'm'), sTot = K.stat(f.out, 'Total per GPU = 2(P−1)·N/P', 'c');
    var v = null, G = null, cols = [], pk = [], lbl = [], Lp = null;
    T3.mount(f.stage, { cam: { theta: 0.3, phi: 0.9, r: 19, target: [0, 0.6, 0] }, label: 'GPUs arranged in a ring passing gradient chunks to their neighbour', pickHint: 'hover a chunk' }, function (view) {
      v = view; view.tick = clk.tick; clk.view = view; rebuild();
    });
    function sendChunk(p, s) { var P = st.P; return s < P - 1 ? mod(p - s, P) : mod(p + 1 - (s - (P - 1)), P); }
    function stateAt(k) {
      var P = st.P, c = [], p, q;
      for (p = 0; p < P; p++) { c.push([]); for (q = 0; q < P; q++) c[p].push(1); }
      for (var s = 0; s < k; s++) {
        var nx = c.map(function (r) { return r.slice(); });
        for (p = 0; p < P; p++) { var ch = sendChunk(p, s), to = (p + 1) % P; nx[to][ch] = s < P - 1 ? c[to][ch] + c[p][ch] : P; }
        c = nx;
      }
      return c;
    }
    function R() { return 2.4 + 0.75 * st.P; }
    function gpuPos(p) { var a = -Math.PI / 2 + 2 * Math.PI * p / st.P; return [R() * Math.cos(a), 0, R() * Math.sin(a)]; }
    function rebuild() {
      clk.stop(); clk.t = clk.target = 0;
      sTot((2 * (st.P - 1)) + '/' + st.P + ' · N ≈ ' + (2 * (st.P - 1) / st.P).toFixed(2) + ' N');
      if (!v) { draw(0); return; }
      if (G) v.empty(G); else G = v.group();
      v.dropLabels(lbl); cols = []; pk = [];
      var P = st.P, w = 0.36;
      // ring arcs with arrowheads
      for (var p = 0; p < P; p++) {
        var pts = [], a0 = -Math.PI / 2 + 2 * Math.PI * p / P, a1 = a0 + 2 * Math.PI / P;
        for (var s = 0; s <= 24; s++) { var a = a0 + (a1 - a0) * (0.18 + 0.64 * s / 24); pts.push([R() * Math.cos(a), 0.2, R() * Math.sin(a)]); }
        v.line(pts, v.mat('v', { line: true, o: 0.8 }), G);
        v.arrow(pts[pts.length - 2], pts[pts.length - 1], 0.22, v.mat('v'), G);
      }
      for (p = 0; p < P; p++) {
        var g = gpuPos(p);
        v.box(P * (w + 0.08) + 0.5, 0.3, 1.0, v.mat('panel2'), g[0], 0, g[2], G);
        lbl.push(v.label('GPU ' + p, g[0], -0.55, g[2] + 0.8, 'big'));
        cols.push([]);
        for (var c = 0; c < P; c++) {
          (function (p, c) {
            var m = v.box(w, 1, 0.7, v.mat('h:' + c + ':' + P), g[0] + (c - (P - 1) / 2) * (w + 0.08), 0, g[2], G);
            v.tip(m, function () { var s = stateAt(Math.floor(clk.t + 1e-6)); var k = s[p][c]; return 'GPU ' + p + ', chunk ' + c + '<br>sums gradients of <b>' + k + ' of ' + st.P + '</b> GPUs' + (k === st.P ? ' ✓ final' : ''); });
            cols[p].push(m);
          })(p, c);
        }
        pk.push(v.box(w, 0.5, 0.7, v.mat('h:0:' + P, { glow: 0.3 }), 0, 0, 0, G));
      }
      draw(0);
    }
    function draw(t) {
      var P = st.P, k = Math.min(steps(), Math.floor(t + 1e-6)), fr = t - k, ph;
      if (k < P - 1) ph = 'Reduce-scatter'; else if (k < steps()) ph = 'All-gather'; else ph = 'Done';
      sPh(ph); sSt(k + ' of ' + steps()); sSent(k + '/' + P + ' · N');
      f.note.innerHTML = ph === 'Reduce-scatter' ? 'Each step, every GPU sends <b>one chunk (N/P)</b> to its right neighbour, which <b>adds</b> it to its own copy. After P − 1 steps each GPU owns one fully summed chunk (glowing).'
        : ph === 'All-gather' ? 'Now the finished chunks are <b>copied</b> around the ring. Every link is busy every step, and each GPU still sends only N/P per step.'
          : 'Every GPU holds the full summed gradient. Each sent <b>2(P − 1) · N/P</b> ≈ 2N, almost independent of P: that is why ring all-reduce scales.';
      if (!v || !cols.length) return;
      var s = stateAt(k);
      for (var p = 0; p < P; p++) for (var c = 0; c < P; c++) {
        var m = cols[p][c], hh = 0.3 + 0.42 * s[p][c], full = s[p][c] === P;
        m.scale.y = hh; m.position.y = 0.15 + hh / 2;
        m.material = v.mat('h:' + c + ':' + P, full ? { glow: 0.45 } : {});
      }
      var moving = k < steps() && fr > 0.001;
      for (p = 0; p < P; p++) {
        var b = pk[p]; b.visible = moving;
        if (!moving) continue;
        var ch = sendChunk(p, k), a0 = -Math.PI / 2 + 2 * Math.PI * p / P, a = a0 + (2 * Math.PI / P) * fr, lift = 1.2 + Math.sin(Math.PI * fr) * 1.0;
        b.position.set(R() * Math.cos(a), lift, R() * Math.sin(a));
        b.material = v.mat('h:' + ch + ':' + P, { glow: 0.3 });
        var hh2 = 0.3 + 0.42 * s[p][ch]; b.scale.y = hh2;
      }
      v.needs = true;
    }
  });

  /* ---------- 5. data × tensor × pipeline parallel GPU cube ---------- */
  CSO.widget('parallel3d', function (el) {
    var f = frame3d(el, '3D model: combining data, tensor and pipeline parallelism', 'Every box is a GPU; its position says which replica, which pipeline stage and which tensor shard it holds');
    var st = { dp: 2, tp: 2, pp: 3, mode: 'dp', sel: [0, 0, 0] };
    K.slider(f.ctrl, { label: 'Data-parallel replicas', min: 1, max: 4, value: st.dp, on: function (x) { st.dp = x; st.sel = [0, 0, 0]; rebuild(); } });
    K.slider(f.ctrl, { label: 'Pipeline stages', min: 1, max: 4, value: st.pp, on: function (x) { st.pp = x; st.sel = [0, 0, 0]; rebuild(); } });
    K.slider(f.ctrl, { label: 'Tensor shards', min: 1, max: 4, value: st.tp, on: function (x) { st.tp = x; st.sel = [0, 0, 0]; rebuild(); } });
    K.seg(f.ctrl, { label: 'Show group', value: 'dp', options: [['dp', 'Data-parallel group'], ['pp', 'Pipeline chain'], ['tp', 'Tensor group']], on: function (x) { st.mode = x; paint(); } });
    var sN = K.stat(f.out, 'GPUs = DP × PP × TP', 'v'), sW = K.stat(f.out, 'Weights per GPU', 'c'), sBt = K.stat(f.out, 'Batch per replica', 'm'), sG = K.stat(f.out, 'Selected group talks about', '');
    var v = null, G = null, L = null, gpus = [], lbl = [], SP = 2.3;
    T3.mount(f.stage, { cam: { theta: 0.62, phi: 1.12, r: 13.5, target: [0, -0.2, 0] }, label: 'A three dimensional grid of GPUs', pickHint: 'click a GPU to select it' }, function (view) { v = view; rebuild(); });
    function pos(d, p, t) { return [(t - (st.tp - 1) / 2) * SP, ((st.pp - 1) / 2 - p) * SP * 0.8, ((st.dp - 1) / 2 - d) * SP]; }
    function rebuild() {
      sN(st.dp + ' × ' + st.pp + ' × ' + st.tp + ' = ' + st.dp * st.pp * st.tp);
      sW('1/' + (st.pp * st.tp) + ' of the model'); sBt('1/' + st.dp + ' of the batch');
      if (!v) { paint(); return; }
      if (G) v.empty(G); else G = v.group();
      v.dropLabels(lbl); gpus = [];
      for (var d = 0; d < st.dp; d++) for (var p = 0; p < st.pp; p++) for (var t = 0; t < st.tp; t++) {
        (function (d, p, t) {
          var q = pos(d, p, t), b = v.box(1.15, 0.7, 1.15, v.mat('panel2'), q[0], q[1], q[2], G);
          b.userData.k = [d, p, t];
          v.tip(b, function () {
            var lay = Math.round(100 / st.pp);
            return '<b>GPU ' + ((d * st.pp + p) * st.tp + t) + '</b><br>replica ' + d + ' · stage ' + p + ' · shard ' + t + '<br>holds layers ' + (p * lay) + '–' + Math.min(100, (p + 1) * lay) + '% of the network,<br>column slice ' + (t + 1) + ' of ' + st.tp + ' of each weight matrix';
          }, function () { st.sel = [d, p, t]; paint(); });
          gpus.push(b);
        })(d, p, t);
      }
      L = v.group(G);
      var xm = (st.tp - 1) / 2 * SP, ym = (st.pp - 1) / 2 * SP * 0.8, zm = (st.dp - 1) / 2 * SP;
      lbl.push(v.label('tensor shards →', 0, ym + 1.0, zm + 0.6, 'c'));
      lbl.push(v.label('pipeline stages ↓', xm + 1.9, 0, zm, 'v'));
      lbl.push(v.label('↙ data-parallel replicas', -xm - 1.3, -ym - 0.9, 0, 'm'));
      paint();
    }
    function paint() {
      var s = st.sel, mode = st.mode;
      var desc = { dp: 'gradients (all-reduce once per step)', pp: 'activations forward, gradients backward', tp: 'partial results inside every layer (all-reduce, needs NVLink)' };
      sG(desc[mode]);
      f.note.innerHTML = mode === 'dp' ? 'The <b>data-parallel group</b> holds identical weights for the same stage and shard and sees different data. They all-reduce gradients once per iteration (' + st.dp + ' GPUs).'
        : mode === 'pp' ? 'The <b>pipeline chain</b> is one full copy of the model split by layers: stage 0 → … → stage ' + (st.pp - 1) + '. Micro-batches flow down the chain; idle time is the pipeline bubble.'
          : 'The <b>tensor group</b> splits each weight matrix by columns. They exchange partial results inside every layer, so this group is kept inside one server with fast links.';
      if (!v || !L) return;
      v.empty(L);
      var inG = function (k) { return mode === 'dp' ? k[1] === s[1] && k[2] === s[2] : mode === 'pp' ? k[0] === s[0] && k[2] === s[2] : k[0] === s[0] && k[1] === s[1]; };
      var role = { dp: 'm', pp: 'v', tp: 'c' }[mode], members = [];
      gpus.forEach(function (b) {
        var k = b.userData.k, me = k[0] === s[0] && k[1] === s[1] && k[2] === s[2];
        b.material = me ? v.mat(role, { glow: 0.45 }) : inG(k) ? v.mat(role) : v.mat('panel2', { o: 0.38 });
        if (inG(k)) members.push(b.position);
      });
      members.sort(function (a, b) { return mode === 'pp' ? b.y - a.y : mode === 'dp' ? b.z - a.z : a.x - b.x; });
      for (var i = 0; i + 1 < members.length; i++) {
        var a = [members[i].x, members[i].y, members[i].z], b = [members[i + 1].x, members[i + 1].y, members[i + 1].z];
        v.rod(a, b, 0.09, v.mat(role), L);
        if (mode === 'pp') { var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; v.arrow(a, m, 0.28, v.mat(role), L); }
      }
      if (mode !== 'pp' && members.length > 2) {
        var f0 = members[0], f1 = members[members.length - 1];
        var off = mode === 'dp' ? [0, 0.75, 0] : [0, 0.75, 0];
        v.line([[f0.x, f0.y, f0.z], [f0.x + off[0], f0.y + off[1], f0.z + off[2]], [f1.x + off[0], f1.y + off[1], f1.z + off[2]], [f1.x, f1.y, f1.z]], v.mat(role, { line: true }), L);
      }
      v.needs = true;
    }
  });

  /* ---------- 6. attention weights as a 3D bar field ---------- */
  CSO.widget('attn3d', function (el) {
    var f = frame3d(el, '3D model: the attention matrix softmax(QKᵀ/√dₖ) as a landscape', 'Bar height = how much the query word (row) attends to the key word (column); every row sums to 1');
    var W = ['The', 'cat', 'sat', 'on', 'the', 'mat'], n = W.length;
    var st = { head: 'meaning', mask: false, scale: true };
    var heads = {
      meaning: function (i, j) {
        var pairs = { '0-1': 2.4, '1-2': 2.2, '2-1': 2.6, '2-5': 1.6, '3-5': 2.5, '3-2': 1.2, '4-5': 2.6, '5-3': 2.0, '5-2': 1.3, '1-0': 0.9 };
        return (pairs[i + '-' + j] || 0) + (i === j ? 1.1 : 0);
      },
      previous: function (i, j) { return j === i - 1 ? 3 : j === i ? (i === 0 ? 3 : 1.2) : 0.1 * Math.abs(i - j) * -1; },
      self: function (i, j) { return i === j ? 2.6 : (W[i].toLowerCase() === W[j].toLowerCase() ? 2.2 : 0.2); }
    };
    K.seg(f.ctrl, { label: 'Head', value: 'meaning', options: [['meaning', 'Head 1: who did what'], ['previous', 'Head 2: previous word'], ['self', 'Head 3: same word']], on: function (x) { st.head = x; compute(); } });
    var cbM = h('input', { type: 'checkbox' }), cbS = h('input', { type: 'checkbox', checked: true });
    f.ctrl.appendChild(h('label', null, cbM, 'Causal mask (decoder)'));
    f.ctrl.appendChild(h('label', null, cbS, 'Divide by √dₖ = 8'));
    cbM.addEventListener('change', function () { st.mask = cbM.checked; compute(); });
    cbS.addEventListener('change', function () { st.scale = cbS.checked; compute(); });
    var sMax = K.stat(f.out, 'Strongest link', 'c'), sEnt = K.stat(f.out, 'Average row peak', 'v'), sMask = K.stat(f.out, 'Masked (−∞) cells', 'm');
    var v = null, G = null, bars = [], tiles = [], lbl = [], wt = [], logit = [], cur = [], lo = null, hi = null, S = 1.25;
    T3.mount(f.stage, { cam: { theta: 0.62, phi: 0.98, r: 16.5, target: [0, 0.9, 0] }, label: 'A 6 by 6 grid of bars showing attention weights between words', pickHint: 'hover a bar' }, function (view) {
      v = view;
      view.themeFns.push(recolor);
      view.tick = function (dt) {
        var moving = false;
        for (var i = 0; i < n * n; i++) { var tg = wt[i] || 0, d = tg - cur[i]; if (Math.abs(d) > 0.002) { cur[i] += d * Math.min(1, dt * (reduce ? 60 : 7)); moving = true; } else cur[i] = tg; }
        if (moving || view.needs) place();
        return moving;
      };
      build();
    });
    function compute() {
      wt = []; logit = []; var masked = 0, best = [0, 0, 0], peaks = 0;
      for (var i = 0; i < n; i++) {
        var row = [], mx = -1e9;
        for (var j = 0; j < n; j++) { var l = heads[st.head](i, j) * (st.scale ? 1 : 8); if (st.mask && j > i) { l = -Infinity; masked++; } row.push(l); if (l > mx) mx = l; }
        var ex = row.map(function (l) { return l === -Infinity ? 0 : Math.exp(l - mx); }), sum = ex.reduce(function (a, b) { return a + b; }, 0);
        var pk = 0;
        for (j = 0; j < n; j++) { var w = ex[j] / sum; wt.push(w); logit.push(row[j]); if (w > best[0]) best = [w, i, j]; if (w > pk) pk = w; }
        peaks += pk;
      }
      sMax('"' + W[best[1]] + '" → "' + W[best[2]] + '" ' + best[0].toFixed(2)); sEnt((peaks / n).toFixed(2)); sMask(masked + ' of ' + n * n);
      f.note.innerHTML = !st.scale ? 'Without dividing by √dₖ the dot products are 8× larger, so softmax becomes almost <b>one-hot</b>: each word attends to a single word and gradients through the others vanish.'
        : st.mask ? 'With the <b>causal mask</b> a word can only look at itself and earlier words (the upper triangle is −∞ before softmax, so its weight is exactly 0). This is how the decoder trains on a whole sentence at once without peeking ahead.'
          : 'Each row is one query word. Different <b>heads</b> learn different relations; multi-head attention concatenates all of them.';
      if (v && v.ready) v.needs = true;
    }
    function build() {
      if (G) v.empty(G); else G = v.group();
      v.dropLabels(lbl); bars = []; tiles = [];
      var o = -(n - 1) * S / 2;
      lo = v.color('cs'); hi = v.color('c');
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        (function (i, j) {
          var t = v.box(1.05, 0.06, 1.05, v.mat('panel2'), o + j * S, 0, o + i * S, G); tiles.push(t);
          var b = v.box(0.8, 1, 0.8, v.ownMat(), o + j * S, 0.5, o + i * S, G);
          v.tip(b, function () { var k = i * n + j; return 'query <b>"' + W[i] + '"</b> → key <b>"' + W[j] + '"</b><br>weight ' + wt[k].toFixed(3) + (logit[k] === -Infinity ? ' (masked)' : '<br>score ' + logit[k].toFixed(2)); });
          v.tip(t, function () { var k = i * n + j; return '"' + W[i] + '" → "' + W[j] + '": ' + (logit[k] === -Infinity ? 'masked, weight 0' : wt[k].toFixed(3)); });
          bars.push(b);
        })(i, j);
      }
      for (j = 0; j < n; j++) lbl.push(v.label(W[j], o + j * S, -0.1, o - 1.15, 'big'));
      for (i = 0; i < n; i++) lbl.push(v.label(W[i], o - 1.25, -0.1, o + i * S, 'big m'));
      lbl.push(v.label('keys →', o + (n - 1) * S + 1.1, -0.1, o - 1.15, 'mut'));
      lbl.push(v.label('queries ↓', o - 1.25, -0.1, o + (n - 1) * S + 1.0, 'mut'));
      cur = []; for (var k = 0; k < n * n; k++) cur.push(wt[k] || 0);
      place();
    }
    function recolor() { lo = v.color('cs'); hi = v.color('c'); place(); }
    function place() {
      if (!bars.length) return;
      for (var k = 0; k < n * n; k++) {
        var w = cur[k], hh = Math.max(0.02, w * 3.4), b = bars[k];
        b.scale.y = hh; b.position.y = 0.03 + hh / 2; b.visible = w > 0.004;
        b.material.color.copy(lo).lerp(hi, Math.min(1, Math.sqrt(w) * 1.15));
        tiles[k].material = logit[k] === -Infinity ? v.mat('bad', { o: 0.35 }) : v.mat('panel2');
      }
      v.needs = true;
    }
    compute();
  });

  /* ---------- 7. KV cache: contiguous reservation vs PagedAttention ---------- */
  CSO.widget('kv3d', function (el) {
    var f = frame3d(el, '3D model: KV-cache memory, reserved vs paged', 'Same GPU memory (16 blocks of 4 tokens) and the same request queue; left reserves max length, right allocates blocks on demand');
    var LEN = [6, 10, 5, 12, 7, 4, 9, 8, 11, 6, 5, 9], MAXLEN = 16, BS = 4, SLOTS = 16, MAXT = 40;
    var shuffle = [9, 2, 14, 5, 11, 0, 7, 13, 3, 15, 8, 1, 12, 6, 10, 4];
    var clk = clock(f.ctrl, { max: function () { return MAXT; }, speed: 1.6, snap: true, on: draw });
    var sA = K.stat(f.out, 'Reserved: running / finished', 'm'), sAw = K.stat(f.out, 'Reserved: memory wasted', 'm'), sB = K.stat(f.out, 'Paged: running / finished', 'c'), sBw = K.stat(f.out, 'Paged: memory wasted', 'c');
    var v = null, G = null, gridA = null, gridB = null, lbl = [];
    function sim(paged, T) {
      var mem = [], i, queue = [], run = [], fin = 0, pre = 0;
      for (i = 0; i < SLOTS; i++) mem.push(-1);
      for (i = 0; i < LEN.length; i++) queue.push(i);
      function free() { var o = []; for (var s = 0; s < SLOTS; s++) if (mem[shuffle[s]] < 0) o.push(shuffle[s]); return o; }
      function release(r) { r.blocks.forEach(function (b) { mem[b] = -1; }); }
      function admit() {
        while (queue.length) {
          var id = queue[0];
          if (paged) { var fr = free(); if (fr.length <= run.length / 3) return; mem[fr[0]] = id; run.push({ id: id, tok: 0, blocks: [fr[0]] }); queue.shift(); }
          else {
            var start = -1, need = MAXLEN / BS;
            for (var s = 0; s + need <= SLOTS; s++) { var ok = true; for (var u = 0; u < need; u++) if (mem[s + u] >= 0) { ok = false; break; } if (ok) { start = s; break; } }
            if (start < 0) return;
            var bl = []; for (u = 0; u < need; u++) { mem[start + u] = id; bl.push(start + u); }
            run.push({ id: id, tok: 0, blocks: bl }); queue.shift();
          }
        }
      }
      admit();
      for (var t = 0; t < T; t++) {
        for (var n = 0; n < run.length; n++) {
          var r = run[n];
          if (paged && r.tok > 0 && r.tok % BS === 0 && r.tok / BS >= r.blocks.length) {
            var fr = free();
            if (!fr.length) {
              // out of blocks: preempt the most recently admitted other request (vLLM recomputes it later)
              var victim = run[run.length - 1] === r ? null : run[run.length - 1];
              if (!victim) continue;
              release(victim); run.pop(); queue.unshift(victim.id); pre++; fr = free();
            }
            mem[fr[0]] = r.id; r.blocks.push(fr[0]);
          }
          r.tok++;
        }
        run = run.filter(function (r) { if (r.tok >= LEN[r.id]) { release(r); fin++; return false; } return true; });
        admit();
      }
      var used = 0, reserved = 0;
      run.forEach(function (r) { used += r.tok; reserved += r.blocks.length * BS; });
      return { run: run, fin: fin, used: used, reserved: reserved, mem: mem, pre: pre };
    }
    T3.mount(f.stage, { cam: { theta: 0.0, phi: 0.78, r: 25, target: [0, 0, 0.6] }, aspect: 1.9, label: 'Two grids of GPU memory blocks filling with tokens from requests', pickHint: 'hover a block' }, function (view) {
      v = view; view.tick = clk.tick; clk.view = view; build();
    });
    var SX = 2.5, SZ = 1.5;
    function slotPos(gx, s) { var c = s % 4, r = Math.floor(s / 4); return [gx + (c - 1.5) * SX, 0, (r - 1.5) * SZ]; }
    function build() {
      G = v.group();
      [-6.4, 6.4].forEach(function (gx, side) {
        var g = { base: [], tok: [], ghost: [], x: gx };
        for (var s = 0; s < SLOTS; s++) {
          var p = slotPos(gx, s);
          (function (s, side) {
            var b = v.box(2.25, 0.1, 1.3, v.mat('panel2'), p[0], -0.05, p[2], G);
            v.tip(b, function () { var r = sim(side === 1, Math.floor(clk.t + 1e-6)); var o = r.mem[s]; if (o < 0) return 'block ' + s + ': free'; var rq = r.run.filter(function (x) { return x.id === o; })[0]; var k = rq.blocks.indexOf(s); var filled = clamp(rq.tok - k * BS, 0, BS); return 'block ' + s + ': request R' + o + ' (logical block ' + k + ')<br>' + filled + ' of 4 token slots used'; });
            g.base.push(b);
          })(s, side);
          var tk = [], gh = [];
          for (var u = 0; u < BS; u++) {
            var x = p[0] + (u - 1.5) * 0.52;
            tk.push(v.box(0.44, 1.0, 1.1, v.mat('h:0:12'), x, 0.5, p[2], G));
            gh.push(v.box(0.44, 1.0, 1.1, v.mat('bad', { o: 0.16 }), x, 0.5, p[2], G));
          }
          g.tok.push(tk); g.ghost.push(gh);
        }
        if (side === 0) gridA = g; else gridB = g;
      });
      lbl.push(v.label('Reserve max length (16 tokens = 4 contiguous blocks)', -6.4, 1.8, -3.4, 'big m'));
      lbl.push(v.label('PagedAttention (allocate a 4-token block when needed)', 6.4, 1.8, -3.4, 'big c'));
      lbl.push(v.label('red ghosts = reserved but empty', -6.4, -0.4, 3.4, 'mut'));
      draw(clk.t);
    }
    function fill(g, r) {
      for (var s = 0; s < SLOTS; s++) for (var u = 0; u < BS; u++) { g.tok[s][u].visible = false; g.ghost[s][u].visible = false; }
      r.run.forEach(function (rq) {
        rq.blocks.forEach(function (s, k) {
          for (var u = 0; u < BS; u++) {
            var ti = k * BS + u, on = ti < rq.tok;
            g.tok[s][u].visible = on; g.ghost[s][u].visible = !on;
            if (on) g.tok[s][u].material = v.mat('h:' + rq.id + ':' + LEN.length);
          }
        });
      });
    }
    function draw(t) {
      var T = Math.floor(t + 1e-6), a = sim(false, T), b = sim(true, T);
      sA(a.run.length + ' / ' + a.fin); sB(b.run.length + ' / ' + b.fin);
      sAw(a.reserved ? Math.round(100 * (1 - a.used / a.reserved)) + '% of reserved' : '–');
      sBw(b.reserved ? Math.round(100 * (1 - b.used / b.reserved)) + '% of reserved' : '–');
      var tbl = b.run.map(function (r) { return 'R' + r.id + ' → [' + r.blocks.join(', ') + ']'; }).join(' &nbsp; ');
      f.note.innerHTML = 'Decode step <b>' + T + '</b>. Each request adds one token per step and frees its memory when done. Reserving the maximum length strands memory (red), so fewer requests fit; paging wastes at most 3 slots per request. ' + (tbl ? '<br>Paged block tables (logical → physical): <span class="mono">' + tbl + '</span>' : '');
      if (!v || !gridA) return;
      fill(gridA, a); fill(gridB, b);
      v.needs = true;
    }
  });

  /* ---------- 8. ReRAM crossbar dot product ---------- */
  CSO.widget('crossbar3d', function (el) {
    var f = frame3d(el, '3D model: a ReRAM crossbar doing a matrix-vector product in one step', 'Voltages on wordlines × cell conductances = currents that add up on each bitline');
    var N = 4, st = { V: [0.8, 0.3, 1.0, 0.5], G: [[3, 1, 0, 2], [1, 2, 3, 0], [2, 0, 1, 3], [0, 3, 2, 1]] };
    var sl = [];
    for (var i = 0; i < N; i++) (function (i) { sl.push(K.slider(f.ctrl, { label: 'V' + i, min: 0, max: 1, step: 0.1, value: st.V[i], fmt: function (x) { return x.toFixed(1); }, on: function (x) { st.V[i] = x; update(); } })); })(i);
    K.button(f.ctrl, 'Random weights', function () { for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) st.G[i][j] = Math.floor(Math.random() * 4); update(); });
    var sI = K.stat(f.out, 'Bitline currents I = Vᵀ·G', 'c'), sOps = K.stat(f.out, 'Multiply-adds in this single step', 'v'), sMax = K.stat(f.out, 'Cell levels (2-bit, as in ISAAC)', 'm');
    sOps(N * N + ' (all in parallel)'); sMax('G ∈ {0, 1, 2, 3}');
    var v = null, G = null, cells = [], dacs = [], outs = [], parts = [], Lv = [], Li = [], S = 1.6, H = 1.8, I = [];
    T3.mount(f.stage, { cam: { theta: -0.7, phi: 1.02, r: 19.5, target: [0, 0.6, 0.6] }, label: 'Crossbar of wordlines and bitlines with resistive cells at each crossing', pickHint: 'click a cell to change its weight' }, function (view) {
      v = view; build();
      view.tick = function (dt) {
        if (reduce) return false;
        parts.forEach(function (p) {
          var spd = p.kind === 'cell' ? st.V[p.i] * st.G[p.i][p.j] / 3 : I[p.j] / 4;
          if (spd <= 0.001) { p.m.visible = false; return; }
          p.m.visible = true; p.u = (p.u + dt * (0.25 + spd * 0.9)) % 1;
          var o = -(N - 1) * S / 2;
          if (p.kind === 'cell') p.m.position.set(o + p.j * S, H * (1 - p.u), o + p.i * S);
          else p.m.position.set(o + p.j * S, 0, o + (-0.3 + p.u * (N + 0.6)) * S);
        });
        return true;
      };
    });
    function compute() { I = []; for (var j = 0; j < N; j++) { var s = 0; for (var i = 0; i < N; i++) s += st.V[i] * st.G[i][j]; I.push(s); } }
    function build() {
      G = v.group(); var o = -(N - 1) * S / 2, end = o + (N - 0.4) * S;
      for (var i = 0; i < N; i++) {
        v.rod([o - 1.4 * S, H, o + i * S], [o + (N - 0.4) * S, H, o + i * S], 0.09, v.mat('m'), G);
        dacs.push(v.box(0.7, 1, 0.7, v.mat('m', { glow: 0.2 }), o - 1.8 * S, H, o + i * S, G));
        Lv.push(v.label('', o - 1.8 * S, H + 1.2, o + i * S, 'm'));
      }
      for (var j = 0; j < N; j++) {
        v.rod([o + j * S, 0, o - 0.6 * S], [o + j * S, 0, end + 0.2], 0.09, v.mat('v'), G);
        outs.push(v.box(0.75, 1, 0.75, v.mat('c', { glow: 0.2 }), o + j * S, 0, end + 1.0, G));
        Li.push(v.label('', o + j * S, 0, end + 1.0, 'c'));
        for (var k = 0; k < 3; k++) parts.push({ kind: 'line', j: j, u: k / 3, m: v.ball(0.18, v.mat('v', { glow: 0.6 }), 0, 0, 0, G) });
      }
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) (function (i, j) {
        var c = v.cyl(0.4, H - 0.12, v.mat('panel2'), o + j * S, H / 2, o + i * S, G);
        v.tip(c, function () { return '<b>cell (' + i + ', ' + j + ')</b>: conductance G = ' + st.G[i][j] + '<br>current = V' + i + ' × G = ' + st.V[i].toFixed(1) + ' × ' + st.G[i][j] + ' = ' + (st.V[i] * st.G[i][j]).toFixed(2) + '<br><i>click to change</i>'; },
          function () { st.G[i][j] = (st.G[i][j] + 1) % 4; update(); });
        cells.push(c);
        parts.push({ kind: 'cell', i: i, j: j, u: Math.random(), m: v.ball(0.14, v.mat('v', { glow: 0.6 }), 0, 0, 0, G) });
      })(i, j);
      v.label('wordlines carry input voltages V', o - 0.6 * S, H + 0.6, o - 0.9 * S, 'big m');
      v.label('bitlines sum the currents', o + (N - 1) * S + 0.9, -0.6, end + 1.9, 'big c');
      update();
    }
    function update() {
      compute();
      sI('[' + I.map(function (x) { return x.toFixed(2); }).join(', ') + ']');
      f.note.innerHTML = 'Ohm\'s law does the multiply (I = V·G in every cell) and Kirchhoff\'s law does the add (currents meeting on a bitline sum). One read gives the whole vector-matrix product; an ADC then digitises each bitline. Wider cells conduct more.';
      if (!v || !cells.length) return;
      var mx = Math.max(1, Math.max.apply(null, I)), o = -(N - 1) * S / 2;
      for (var i = 0; i < N; i++) {
        var hh = 0.15 + 1.4 * st.V[i]; dacs[i].scale.y = hh; Lv[i].set('V' + i + ' = ' + st.V[i].toFixed(1)).at(o - 1.8 * S, H + hh / 2 + 0.35, o + i * S);
        for (var j = 0; j < N; j++) { var c = cells[i * N + j], g = st.G[i][j]; c.scale.x = c.scale.z = 0.14 + 0.16 * g; c.material = g === 0 ? v.mat('line', { o: 0.5 }) : v.mat('h:' + (g - 1) + ':9'); }
      }
      for (var j2 = 0; j2 < N; j2++) {
        var hh2 = 0.1 + 1.9 * I[j2] / mx; outs[j2].scale.y = hh2; outs[j2].position.y = hh2 / 2 - 0.1;
        Li[j2].set('I' + j2 + ' = ' + I[j2].toFixed(2)).at(outs[j2].position.x, hh2 + 0.3, outs[j2].position.z);
      }
      v.needs = true;
    }
  });
})();
