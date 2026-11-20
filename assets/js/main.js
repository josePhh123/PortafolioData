/* Portafolio · interacciones (sin librerías) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = () => matchMedia('(max-width: 820px)').matches;
  const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- Menú móvil ---------- */
  const menu = $('#menu'), menuBtn = $('#menuBtn'), menuClose = $('#menuClose');
  function openMenu() {
    menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    $('nav a', menu).focus();
  }
  function closeMenu(focusBtn = true) {
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (focusBtn) menuBtn.focus();
  }
  if (menu) {
    menuBtn.addEventListener('click', openMenu);
    menuClose.addEventListener('click', () => closeMenu());
    $$('nav a', menu).forEach(a => a.addEventListener('click', () => closeMenu(false)));
    menu.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('a,button', menu), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    addEventListener('resize', () => { if (!menu.hidden && !isMobile()) closeMenu(false); });
  }

  /* ---------- Revelado por secciones ---------- */
  const sections = $$('.sec');
  sections.forEach(sec => $$('[data-reveal]', sec).slice(0, 4).forEach((el, i) => el.style.setProperty('--d', i)));
  const onVisible = new Map();
  if (hasIO) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      io.unobserve(e.target);
      const cb = onVisible.get(e.target); if (cb) cb();
    }), { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    sections.forEach(s => io.observe(s));
  } else sections.forEach(s => s.classList.add('visible'));

  /* ---------- Cifras que cuentan ---------- */
  const cifras = $('.cifras');
  if (cifras && hasIO && !reduce) {
    const nums = $$('[data-count]', cifras);
    nums.forEach(n => n.textContent = '0');
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / 900), k = easeOutQuart(p);
        nums.forEach(n => n.textContent = Math.round(+n.dataset.count * k));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: .5 });
    io.observe(cifras);
  }

  /* ---------- Arquitectura interactiva ---------- */
  const diag = $('#arqDiag'), svg = $('#arqEdges'), panel = $('#arqPanel');
  if (diag && svg && panel) {
    const NS = 'http://www.w3.org/2000/svg';
    const EDGES = [['oracle','cdc'],['oracle','foto'],['pg','cdc'],['pg','foto'],['cdc','bronce'],['foto','bronce'],['bronce','inter'],
      ['inter','dim'],['inter','tareo'],['inter','avance'],['dim','pbi'],['tareo','pbi'],['avance','pbi'],['dim','lightdash'],['avance','lightdash'],['tareo','ia']];
    const INFO = {
      oracle: ['Fuentes · Oracle', 'Sistemas transaccionales. Se mapean vistas de producción a la capa bronze; no se toca el origen.', 'vistas de producción'],
      pg: ['Fuentes · PostgreSQL', 'Sistemas transaccionales. Se leen tal como están; el origen no se modifica.', 'solo lectura'],
      cdc: ['Captura · CDC', 'CDC para tablas transaccionales: captura solo lo que cambia y conserva el historial. ETLs en Python; Kafka en evaluación.', 'CDC'],
      foto: ['Captura · foto', '“Foto” periódica para maestras y dimensiones: son pequeñas y más simples de recargar completas.', 'carga foto'],
      bronce: ['Bronze', 'Copia fiel del origen. Es la base para reprocesar sin volver a la fuente.', 'crudo, tal cual'],
      inter: ['Silver (capa intermedia)', 'Limpieza, tipos, llaves y reglas de negocio. Aquí se resuelven los errores, no en el dashboard.', 'reglas de negocio'],
      dim: ['Gold · dimensiones', 'Dimensiones conformadas, recargadas completas para no arrastrar deriva.', 'carga full'],
      tareo: ['Gold · fct_tareo', 'Hecho de tareo (mano de obra) con sus dimensiones. Carga incremental con versionamiento y campos de auditoría.', 'versionamiento'],
      avance: ['Gold · fct_avance', 'Avance físico de obra: elemento → especialidad → disciplina; actividad → hito con peso; metrado.', 'modelo estrella'],
      pbi: ['Consumo · Power BI', 'Tableros que leen de un modelo ya validado: cada medida tiene una sola definición.', 'BI'],
      lightdash: ['Consumo · Lightdash', 'Exploración de datos sobre las capas de la plataforma.', 'BI'],
      ia: ['Consumo · IA local', 'Proyecto de IA local: un LLM en servidor propio que consulta datos de trabajadores.', 'LLM local']
    };
    const nodes = $$('.node', diag), byId = Object.fromEntries(nodes.map(n => [n.dataset.id, n]));
    const stageOf = id => +byId[id].closest('.arq__col').dataset.stage;
    const paths = EDGES.map(([a, b]) => {
      const base = document.createElementNS(NS, 'path'), flow = document.createElementNS(NS, 'path');
      base.setAttribute('class', 'edge'); flow.setAttribute('class', 'edge-flow');
      svg.append(base, flow);
      return { a, b, base, flow };
    });
    const panelHome = { parent: panel.parentNode, next: panel.nextSibling };
    const pTitle = $('.arq__title', panel), pText = $('.arq__text', panel), pPill = $('.pill', panel), pKick = $('.arq__kicker', panel);

    function layout() {
      const box = diag.getBoundingClientRect();
      const horizontal = getComputedStyle(diag).display === 'grid';
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      paths.forEach(p => {
        const ra = byId[p.a].getBoundingClientRect(), rb = byId[p.b].getBoundingClientRect();
        let d;
        if (horizontal) {
          const x1 = ra.right - box.left, y1 = ra.top + ra.height / 2 - box.top, x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top, m = (x2 - x1) / 2;
          d = `M${x1},${y1} C${x1 + m},${y1} ${x2 - m},${y2} ${x2},${y2}`;
        } else {
          const x1 = ra.left + ra.width / 2 - box.left, y1 = ra.bottom - box.top, x2 = rb.left + rb.width / 2 - box.left, y2 = rb.top - box.top, m = (y2 - y1) / 2;
          d = `M${x1},${y1} C${x1},${y1 + m} ${x2},${y2 - m} ${x2},${y2}`;
        }
        p.base.setAttribute('d', d); p.flow.setAttribute('d', d);
      });
    }
    function lineage(id) {
      const set = new Set([id]);
      const walk = (cur, dir) => EDGES.forEach(([a, b]) => {
        const [from, to] = dir ? [a, b] : [b, a];
        if (from === cur && !set.has(to)) { set.add(to); walk(to, dir); }
      });
      walk(id, true); walk(id, false);
      // solo aguas arriba y aguas abajo directas del linaje
      return set;
    }
    let active = null, introDone = false, introTimers = [];
    function clearIntro() { introTimers.forEach(clearTimeout); introTimers = []; }
    function activate(id, fromClick) {
      clearIntro();
      active = id;
      const rel = lineage(id);
      diag.classList.add('has-active');
      nodes.forEach(n => { n.classList.toggle('rel', rel.has(n.dataset.id)); n.classList.toggle('act', n.dataset.id === id); n.setAttribute('aria-pressed', n.dataset.id === id ? 'true' : 'false'); });
      paths.forEach(p => p.flow.classList.toggle('on', rel.has(p.a) && rel.has(p.b) && (stageOf(p.b) > stageOf(p.a))));
      const [t, x, pill] = INFO[id];
      pKick.textContent = 'nodo activo · ' + String(stageOf(id) + 1).padStart(2, '0');
      pTitle.textContent = t; pText.textContent = x; pPill.textContent = pill;
      const vertical = getComputedStyle(diag).display !== 'grid';
      if (vertical && fromClick) {
        const col = byId[id].closest('.arq__col');
        if (panel.previousElementSibling !== col) { col.after(panel); panel.classList.add('inline'); requestAnimationFrame(layout); }
      }
    }
    function deactivate() {
      active = null;
      diag.classList.remove('has-active');
      nodes.forEach(n => n.classList.remove('rel', 'act'));
      paths.forEach(p => p.flow.classList.remove('on'));
    }
    nodes.forEach(n => {
      n.setAttribute('aria-pressed', 'false');
      if (fine) n.addEventListener('pointerenter', () => activate(n.dataset.id));
      n.addEventListener('focus', () => activate(n.dataset.id));
      n.addEventListener('click', () => activate(n.dataset.id, true));
    });
    if (fine) diag.addEventListener('pointerleave', () => { if (!diag.contains(document.activeElement)) deactivate(); });
    diag.addEventListener('focusout', e => { if (!diag.contains(e.relatedTarget)) deactivate(); });

    function placePanel() {
      const vertical = getComputedStyle(diag).display !== 'grid';
      if (!vertical && panel.classList.contains('inline')) {
        panelHome.parent.insertBefore(panel, panelHome.next); panel.classList.remove('inline');
      }
    }
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { placePanel(); layout(); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe(diag);
    layout();

    // recorrido de enseñanza la primera vez que entra en pantalla
    const sec = $('#arquitectura');
    onVisible.set(sec, () => {
      if (reduce || introDone) return; introDone = true;
      for (let s = 0; s <= 5; s++) introTimers.push(setTimeout(() => {
        if (active) return;
        paths.forEach(p => p.flow.classList.toggle('on', stageOf(p.a) < s));
      }, 300 + s * 340));
      introTimers.push(setTimeout(() => { if (!active) paths.forEach(p => p.flow.classList.remove('on')); }, 300 + 6 * 340 + 600));
    });
  }

  /* ---------- Marquee: pausa fuera de pantalla ---------- */
  const marquee = $('.marquee');
  if (marquee && hasIO) new IntersectionObserver(([e]) => marquee.classList.toggle('paused', !e.isIntersecting)).observe(marquee);

  /* ---------- Filtro de proyectos ---------- */
  const fBtns = $$('[data-filter]'), cards = $$('.proy-grid .card'), fLive = $('#filtroLive');
  fBtns.forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    fBtns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    let n = 0;
    cards.forEach(c => {
      const show = f === 'todos' || c.dataset.cat === f;
      c.classList.toggle('is-out', !show);
      c.classList.remove('is-in');
      if (show) { n++; if (!reduce) { void c.offsetWidth; c.classList.add('is-in'); } }
    });
    if (fLive) fLive.textContent = `${n} ${n === 1 ? 'proyecto' : 'proyectos'}`;
  }));

  /* ---------- Línea de tiempo de experiencia ---------- */
  const expList = $('.exp__list'), expFill = $('.exp__line span');
  if (expList && expFill) {
    if (reduce || !hasIO) expFill.style.transform = 'scaleY(1)';
    else {
      let on = false, tick = false;
      const upd = () => {
        tick = false;
        const r = expList.getBoundingClientRect(), vh = innerHeight;
        const p = Math.max(0, Math.min(1, (vh * .65 - r.top) / r.height));
        expFill.style.transform = `scaleY(${p.toFixed(3)})`;
      };
      const onScroll = () => { if (on && !tick) { tick = true; requestAnimationFrame(upd); } };
      new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) upd(); }).observe(expList);
      addEventListener('scroll', onScroll, { passive: true });
      $$('.rol').forEach(d => d.addEventListener('toggle', () => requestAnimationFrame(upd)));
    }
  }

  /* ---------- Stack: consulta ---------- */
  const q = $('#stackQuery'), tablas = $$('.tabla'), chips = $$('.qchip'), sLive = $('#stackLive');
  const rows = [];
  tablas.forEach(t => $$('tbody tr', t).forEach(tr => rows.push({ tr, t, name: tr.cells[0].textContent.toLowerCase(), lvl: tr.cells[1].textContent.toLowerCase(), tags: (t.dataset.group + ' ' + (tr.dataset.tags || '')).toLowerCase().split(/\s+/) })));
  function runQuery(raw) {
    const s = raw.trim().toLowerCase();
    let test = null;
    const mg = s.match(/grupo\s*=\s*['"]([^'"]+)['"]/), ml = s.match(/nivel\s*=\s*['"]([^'"]+)['"]/);
    if (mg) test = r => r.tags.includes(mg[1].trim());
    else if (ml) test = r => r.lvl.includes(ml[1].trim());
    else if (s) { const term = s.replace(/^where\s+/, '').replace(/['"%]/g, '').trim(); test = r => r.name.includes(term) || r.lvl.includes(term) || r.tags.includes(term); }
    let total = 0;
    tablas.forEach(t => t._n = 0);
    rows.forEach(r => {
      const hit = test ? test(r) : true;
      r.tr.classList.toggle('dim', !!test && !hit);
      r.tr.classList.toggle('hit', !!test && hit);
      if (hit) { r.t._n++; total++; }
    });
    tablas.forEach(t => {
      const c = $('.cnt', t); c.textContent = `${t._n} ${t._n === 1 ? 'fila' : 'filas'}`;
      if (test && t._n && t.classList.contains('closed')) toggleTabla(t, true);
    });
    if (sLive) sLive.textContent = test ? `${total} herramientas coinciden` : '';
    chips.forEach(c => c.setAttribute('aria-pressed', String(chipQuery(c) === raw.trim())));
  }
  const chipQuery = c => c.dataset.q === '' ? '' : c.dataset.q[0] === '@' ? `where grupo = '${c.dataset.q.slice(1)}'` : `where nivel = '${c.dataset.q}'`;
  chips.forEach(c => c.addEventListener('click', () => { q.value = chipQuery(c); runQuery(q.value); }));
  if (q) q.addEventListener('input', () => runQuery(q.value));
  function toggleTabla(t, open) {
    const b = $('h3 button', t);
    const willOpen = open ?? t.classList.contains('closed');
    t.classList.toggle('closed', !willOpen);
    b.setAttribute('aria-expanded', String(willOpen));
  }
  tablas.forEach((t, i) => {
    $('h3 button', t).addEventListener('click', () => toggleTabla(t));
    if (isMobile() && i > 3) toggleTabla(t, false); // móvil: abiertas ingeniería, bases de datos, lenguajes y nube
  });

  /* ---------- Nombre gigante: letras + ajuste al ancho ---------- */
  const gig = $('#gigante');
  if (gig) {
    let i = 0;
    $$('.gigante__row', gig).forEach(r => { r.innerHTML = [...r.textContent].map(c => `<span class="ch" style="--i:${i++}">${c}</span>`).join(''); });
    const range = document.createRange();
    const width = el => { range.selectNodeContents(el); return range.getBoundingClientRect().width; };
    function fit() {
      gig.style.fontSize = '100px';
      const cs = getComputedStyle(gig), avail = gig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const w = isMobile() ? Math.max(...$$('.gigante__row', gig).map(width)) : width(gig);
      gig.style.fontSize = Math.min(220, Math.floor(100 * avail / w * .985)) + 'px';
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fit, 120); });
    if (hasIO && !reduce) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return; io.disconnect();
        gig.classList.add('visible');
        setTimeout(() => gig.classList.add('done'), 1300);
      }, { threshold: .2 });
      io.observe(gig);
    } else gig.classList.add('visible', 'done');
  }

  /* ---------- Nombre del hero: nunca desborda ---------- */
  const heroRows = $$('.hero__name .row'), heroBody = $('.hero__body');
  function fitHero() {
    if (!heroBody) return;
    heroRows.forEach(r => r.style.fontSize = '');
    const cs = getComputedStyle(heroBody), avail = heroBody.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const range = document.createRange();
    const w = Math.max(...heroRows.map(r => { range.selectNodeContents(r); return range.getBoundingClientRect().width; }));
    if (w > avail) { const fs = parseFloat(getComputedStyle(heroRows[0]).fontSize); heroRows.forEach(r => r.style.fontSize = Math.floor(fs * avail / w * .98) + 'px'); }
  }
  fitHero();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHero);
  addEventListener('resize', fitHero);

  /* ---------- Barra de progreso de lectura ---------- */
  const prog = $('.progress'), progBar = $('.progress span'), heroEl = $('#inicio');
  let pt = false;
  function updProg() {
    pt = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    prog.classList.toggle('on', y > heroEl.offsetHeight * .9);
    progBar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
  }
  if (prog) { addEventListener('scroll', () => { if (!pt) { pt = true; requestAnimationFrame(updProg); } }, { passive: true }); updProg(); }

  /* ---------- Título de pestaña vivo ---------- */
  const baseTitle = document.title;
  document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'Pipeline en pausa · Joseph Guadalupe' : baseTitle; });

  /* ---------- Volver arriba = volver a correr el pipeline ---------- */
  const toTop = $('#toTop');
  if (toTop) toTop.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    $('.brand', heroEl).focus({ preventScroll: true });
    setTimeout(() => window.heroPipeline && window.heroPipeline.replay(), reduce ? 0 : 450);
  });

  /* ---------- Cursor de datos (solo puntero fino) ---------- */
  const cur = $('#cursor');
  if (cur && fine && !reduce) {
    const sq = cur.firstElementChild;
    let x = -100, y = -100, tx = -100, ty = -100, raf = 0, label = '';
    const loop = () => {
      x += (tx - x) * .2; y += (ty - y) * .2;
      cur.style.transform = `translate3d(${(x + 12).toFixed(1)}px,${(y + 14).toFixed(1)}px,0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > .3 ? requestAnimationFrame(loop) : 0;
    };
    const labelFor = el => {
      if (!el) return '';
      if (el.dataset.cursor) return el.dataset.cursor;
      if (el.tagName === 'A') { const h = el.getAttribute('href') || ''; return h[0] === '#' ? '→ ' + (h.slice(1) || 'inicio') : '↗ abrir'; }
      return '';
    };
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      const t = e.target instanceof Element ? e.target : null;
      const inHero = t && t.closest('#inicio') && !t.closest('a,button');
      cur.classList.toggle('off', !!inHero);
      const l = labelFor(t && t.closest('a,button,[data-cursor]'));
      if (l !== label) { label = l; sq.textContent = l; cur.classList.toggle('label', !!l); }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.add('off'));
  }
})();
