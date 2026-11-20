/* Hero: "Del caos a gold" — canvas 2D, sin librerías.
   Truco de rendimiento: los hilos ordenados se trazan en blanco opaco y se tiñen con el
   degradado en una sola pasada (globalCompositeOperation = 'source-in'). */
(() => {
  const hero = document.getElementById('inicio');
  const cv = document.getElementById('heroCanvas');
  if (!hero || !cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const labelsEl = document.getElementById('heroLabels');
  const statusEl = document.getElementById('heroStatus');
  const liveEl = document.getElementById('heroLive');
  const replayBtn = document.getElementById('replay');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = mqReduce.matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.connection && navigator.connection.saveData);


  // llegada a gold en ~1.8 s (el nombre y el rol ya están visibles desde el primer frame)
  const T = { tejer: 250, tejerDur: 1050, asienta: 1350, aterriza: 1650, fin: 1900, hilo: .5, cola: 220 };
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  let W = 0, H = 0, DPR = 1, mobile = false, S = null, threads = [], packets = [], grad = null;
  let t0 = performance.now(), landed = false, done = false, running = false, visible = true, inView = true, raf = 0;
  let run = 1, lastStatus = 0, nThreads = 0, nPts = 0;
  const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };

  function series() {
    const a = [];
    for (let i = 0; i < 4; i++) a.push({ f: 1 + Math.random() * (3 + i * 4), p: Math.random() * 6.28, a: 1 / (i + 1.2) });
    const trend = (Math.random() - .5) * 1.4, spike = Math.random() < .25 ? Math.random() : -1;
    return (u, t) => {
      let v = trend * (u - .5);
      for (const s of a) v += s.a * Math.sin(s.f * u * 6.28 + s.p + t * .0006 * s.f);
      if (spike > 0) v += 2.2 * Math.exp(-Math.pow((u - spike) * 18, 2));
      return v;
    };
  }

  // geometría del haz en fracciones del canvas (.hero__viz): escritorio = columna derecha, móvil = franja bajo el texto
  const VIZ = {
    d: { lx: .30, y: .48, xs: [0, .34, .56, .80, 1.04], spread: [.36, .10, .055, .02, .008] },
    m: { lx: .26, y: .50, xs: [0, .30, .55, .80, 1.06], spread: [.40, .13, .07, .024, .01] }
  };
  function stages() {
    const G = VIZ[mobile ? 'm' : 'd'];
    return { y: H * G.y, B: H, xs: G.xs, spread: G.spread, lx: G.lx };
  }
  const STAGE_NAMES = ['oracle · sql server · apis · json', 'bronze', 'silver', 'gold'];

  function pathPoint(u, lane) {
    const xs = S.xs, n = xs.length - 1;
    const f = u * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const c = j => Math.max(0, Math.min(n, j));
    const y = j => S.y + lane * S.spread[c(j)] * S.B;
    const x = j => xs[c(j)] * W;
    const cr = (p0, p1, p2, p3) => .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    return [cr(x(i - 1), x(i), x(i + 1), x(i + 2)), cr(y(i - 1), y(i), y(i + 1), y(i + 2))];
  }

  function size() {
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    mobile = window.innerWidth <= 820;
    DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    grad = null;
    S = stages();
  }

  function build() {
    size();
    const N = mobile ? (lowEnd ? 40 : 64) : 180, K = mobile ? 28 : 56;
    nThreads = N; nPts = N * K;
    threads = [];
    for (let i = 0; i < N; i++) {
      const lane = (i / (N - 1)) * 2 - 1 + (Math.random() - .5) * .02;
      const r01 = Math.random();
      const col = r01 < .08 ? 2 : r01 < .30 ? 1 : 0;
      const pts = [];
      for (let j = 0; j < K; j++) pts.push({ u: j / (K - 1), x: 0, y: 0, ox: 0, oy: 0, vx: 0, vy: 0 });
      threads.push({
        lane, col, s: series(), pts, k: 0,
        cx: Math.random() * W, cy: H * (.08 + Math.random() * .84), ang: (Math.random() - .5) * 2.4,
        len: (mobile ? 120 : 220) + Math.random() * (mobile ? 160 : 360), amp: 10 + Math.random() * 34,
        delay: (Math.abs(lane) * 380 + Math.random() * 260) * T.hilo
      });
    }
    packets = [];
    const P = mobile ? 30 : 90;
    for (let i = 0; i < P; i++) packets.push({ th: (Math.random() * N) | 0, u: Math.random(), v: .00010 + Math.random() * .00016 });
    buildLabels();
  }

  function buildLabels() {
    if (!labelsEl) return;
    labelsEl.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('span');
      el.className = 'lbl' + (i === 3 ? ' lbl--gold' : '') + (landed ? ' on' : '');
      const x = i === 0 ? S.lx : S.xs[i];
      el.style.left = (x * 100) + '%';
      const off = i === 0 ? S.spread[0] * S.B + 14 : S.spread[i] * S.B + 26;
      el.style.top = Math.max(12, S.y - off) + 'px';
      el.textContent = i === 0 ? (mobile ? 'fuentes' : STAGE_NAMES[0]) : String(i).padStart(2, '0') + ' ' + STAGE_NAMES[i];
      labelsEl.appendChild(el);
    }
  }

  function poseChaos(th, p, t) {
    const along = (p.u - .5) * th.len, perp = th.s(p.u, t) * th.amp * .5;
    const c = Math.cos(th.ang), s = Math.sin(th.ang);
    const dx = Math.sin(t * .00025 + th.cy) * 18, dy = Math.cos(t * .0002 + th.cx) * 12;
    return [th.cx + along * c - perp * s + dx, th.cy + along * s + perp * c + dy];
  }
  function poseOrder(th, p, t) {
    const xy = pathPoint(p.u, th.lane);
    const resid = (1 - p.u) * (1 - p.u) * (mobile ? 10 : 18);
    xy[1] += th.s(p.u, t) * resid;
    return xy;
  }

  const GROUPS = ['rgba(246,244,239,.30)', 'rgba(168,164,158,.22)', 'rgba(255,212,0,.72)'];

  function strokeGroup(g) {
    ctx.beginPath();
    for (const th of threads) {
      if ((th.k > .55 ? 3 : th.col) !== g) continue;
      const P = th.pts;
      ctx.moveTo(P[0].x, P[0].y);
      for (let j = 1; j < P.length; j++) ctx.lineTo(P[j].x, P[j].y);
    }
    ctx.stroke();
  }

  function draw(t) {
    mouse.x += (mouse.tx - mouse.x) * .18; mouse.y += (mouse.ty - mouse.y) * .18;
    const R = mobile ? 90 : 150, R2 = R * R;
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    for (const th of threads) {
      const P = th.pts, mid = P.length >> 1;
      for (let j = 0; j < P.length; j++) {
        const p = P[j];
        const kk = easeInOut(clamp01((t - T.tejer - th.delay - (1 - p.u) * T.cola) / T.tejerDur));
        let x, y;
        if (kk >= 1) { const b = poseOrder(th, p, t); x = b[0]; y = b[1]; }
        else {
          const a = poseChaos(th, p, t), b = kk > 0 ? poseOrder(th, p, t) : a;
          x = a[0] + (b[0] - a[0]) * kk; y = a[1] + (b[1] - a[1]) * kk;
        }
        if (!reduce) {
          const dx = x + p.ox - mouse.x, dy = y + p.oy - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const f = (1 - d2 / R2) * 2.4, d = Math.sqrt(d2) || 1;
            p.vx += dx / d * f; p.vy += dy / d * f + Math.sin(p.u * 30 + t * .01) * f * .6;
          }
          p.vx += -p.ox * .06; p.vy += -p.oy * .06; p.vx *= .84; p.vy *= .84;
          p.ox += p.vx; p.oy += p.vy;
        }
        p.x = x + p.ox; p.y = y + p.oy;
        if (j === mid) th.k = kk;
      }
    }

    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(246,244,239,.20)');
      grad.addColorStop(S.xs[1] * .9, 'rgba(246,244,239,.46)');
      grad.addColorStop(S.xs[2], 'rgba(246,244,239,.72)');
      grad.addColorStop((S.xs[2] + S.xs[3]) / 2, 'rgba(255,212,0,.9)');
      grad.addColorStop(1, 'rgba(255,212,0,1)');
    }
    // grupo ordenado: blanco opaco + teñido source-in (1 fillRect en vez de stroke con gradiente)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; strokeGroup(3);
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    for (let g = 0; g < 3; g++) { ctx.strokeStyle = GROUPS[g]; ctx.lineWidth = g === 2 ? 1.2 : 1; strokeGroup(g); }

    const settle = clamp01((t - T.asienta) / 600);
    if (settle > 0) {
      ctx.globalAlpha = easeOut(settle);
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        const x = S.xs[i] * W, h = S.spread[i] * S.B * 2 + 14;
        ctx.strokeStyle = i === 3 ? '#FFD400' : 'rgba(246,244,239,.55)';
        ctx.strokeRect(x - 5, S.y - h / 2, 10, h);
        if (i === 3) { ctx.fillStyle = '#FFD400'; ctx.fillRect(x - 5, S.y - h / 2, 10, h); }
      }
      ctx.fillStyle = '#FFD400';
      for (const pk of packets) {
        if (!reduce) pk.u = (pk.u + pk.v * 16) % 1;
        const th = threads[pk.th], f = pk.u * (th.pts.length - 1), j = f | 0, r = f - j;
        const a = th.pts[j], b = th.pts[Math.min(j + 1, th.pts.length - 1)];
        ctx.globalAlpha = settle * (pk.u < .1 ? pk.u * 10 : 1);
        ctx.fillRect(a.x + (b.x - a.x) * r - 1.5, a.y + (b.y - a.y) * r - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    }
    if (t > T.aterriza && !landed) land();
    const fl = clamp01((t - T.aterriza) / 600);
    if (fl > 0 && fl < 1) {
      const x = S.xs[3] * W, y = S.y, g = ctx.createRadialGradient(x, y, 0, x, y, 220 * easeOut(fl) + 1);
      g.addColorStop(0, `rgba(255,212,0,${.45 * (1 - fl)})`); g.addColorStop(1, 'rgba(255,212,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // estado en vivo
    if (statusEl && !done && (t - lastStatus > 100 || t >= T.fin)) {
      lastStatus = t;
      const secs = Math.min(t, T.fin) / 1000;
      const ok = t >= T.fin;
      statusEl.textContent = `run #${run} · ${nThreads} series · ${fmt(nPts)} filas · ${secs.toFixed(1)} s · ${ok ? 'ok' : 'corriendo…'}`;
      if (ok) {
        done = true;
        if (run > 1 && liveEl) liveEl.textContent = 'Pipeline ejecutado de nuevo';
      }
    }
  }

  function land() {
    landed = true;
    hero.classList.add('landed');
    if (labelsEl) labelsEl.querySelectorAll('.lbl').forEach((l, i) => setTimeout(() => l.classList.add('on'), reduce ? 0 : i * 90));
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    draw(now - t0);
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (reduce || running || !visible || !inView) return;
    running = true; raf = requestAnimationFrame(frame);
  }
  function pause() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function renderStatic() {
    pause();
    landed = false; done = false;
    draw(1e5);
    land();
  }

  function start() {
    build();
    t0 = performance.now(); landed = false; done = false; lastStatus = -1e9;
    hero.classList.remove('landed');
    if (labelsEl) labelsEl.querySelectorAll('.lbl').forEach(l => l.classList.remove('on'));
    if (reduce) { renderStatic(); return; }
    pause(); play();
  }

  function replay() {
    if (reduce) return;
    run++;
    if (liveEl) liveEl.textContent = '';
    threads.forEach(th => th.pts.forEach(p => { p.vx += (Math.random() - .5) * 40; p.vy += (Math.random() - .5) * 40; }));
    play();
    setTimeout(start, 120);
  }

  // cursor (puntero fino) y toque puntual
  if (fine) {
    hero.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; }, { passive: true });
    hero.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = -1e4; });
  } else {
    hero.addEventListener('pointerdown', e => {
      if (e.target.closest('a,button')) return;
      const r = cv.getBoundingClientRect();
      mouse.x = mouse.tx = e.clientX - r.left; mouse.y = mouse.ty = e.clientY - r.top;
      setTimeout(() => { mouse.tx = mouse.ty = -1e4; }, 260);
    }, { passive: true });
  }
  if (replayBtn) replayBtn.addEventListener('click', replay);

  // redimensionar sin repetir la intro
  let rz, lastW = 0, lastH = 0;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const r = cv.getBoundingClientRect();
      if (Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 120) { size(); buildLabels(); if (reduce || !running) draw(reduce ? 1e5 : performance.now() - t0); return; }
      lastW = r.width; lastH = r.height;
      const keep = performance.now() - t0;
      build();
      t0 = performance.now() - Math.max(keep, 4000);
      if (reduce) renderStatic();
    }, 150);
  });

  // pausa: pestaña oculta o hero fuera de pantalla
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; visible ? play() : pause(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? play() : pause(); }).observe(hero);
  }

  // parallax del canvas (solo transform/opacity)
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking || reduce) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY, hh = hero.offsetHeight || 1;
      if (y > hh * 1.2) return;
      const prog = Math.min(1, y / hh);
      cv.style.transform = `translate3d(0,${(y * .25).toFixed(1)}px,0)`;
      cv.style.opacity = (1 - prog * .6).toFixed(3);
    });
  }, { passive: true });

  mqReduce.addEventListener && mqReduce.addEventListener('change', e => { reduce = e.matches; start(); });

  window.heroPipeline = { replay, pause, play };
  const r0 = cv.getBoundingClientRect(); lastW = r0.width; lastH = r0.height;
  start();
})();
