/* =====================================================================
   Mt. Olive Church of Plano — progressive enhancement
   The page is fully usable without this file. Each module is
   self-contained and guarded so later features can be added safely.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  const TIME_ZONE = 'America/Chicago';

  /* Weekly gatherings: dow 0 = Sunday. minutes = minutes after midnight, Plano time */
  const SERVICES = [
    { dow: 0, minutes: 9 * 60,  label: 'Sunday Worship',   time: '9:00 am' },
    { dow: 3, minutes: 19 * 60, label: 'Mid-Week Service', time: '7:00 pm' },
    { dow: 6, minutes: 17 * 60, label: 'Saturday Service', time: '5:00 pm' },
  ];
  const SERVICE_LENGTH = 90;
  const LIVE_URL = 'https://youtube.com/@mtolivechurchofplano';
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* --- Plano wall-clock time, regardless of the visitor's time zone -- */
  function planoNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { dow, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  }

  /* --- Header: solid background once the page scrolls ------------- */
  function initHeader() {
    const header = document.querySelector('[data-header]');
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* --- Mobile nav ---------------------------------------------------
     Upgrades the anchor link into a disclosure button. While open,
     main + footer are inert and Tab wraps inside the menu.          */
  function initMobileNav() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;

    const outside = [document.querySelector('main'), document.querySelector('footer')].filter(Boolean);
    const desktop = window.matchMedia('(min-width: 900px)');

    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.removeAttribute('href');
    toggle.tabIndex = 0;

    const isOpen = () => root.classList.contains('nav-open');
    const setOpen = (open, { returnFocus = false } = {}) => {
      root.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      outside.forEach((el) => { el.inert = open; });
      if (open) setTimeout(() => nav.querySelector('a')?.focus(), 60);
      else if (returnFocus) toggle.focus();
    };

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { setOpen(false, { returnFocus: true }); return; }
      if (e.key === 'Tab') {
        const cycle = [...nav.querySelectorAll(FOCUSABLE), toggle];
        const i = cycle.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? cycle.length - 1 : i - 1) : (i + 1) % cycle.length;
        e.preventDefault();
        cycle[next].focus();
      }
    });

    desktop.addEventListener('change', (e) => { if (e.matches && isOpen()) setOpen(false); });
  }

  /* --- Scroll reveals ---------------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    // Stagger siblings that enter together
    items.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
      const idx = siblings.indexOf(el);
      if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 5) * 90}ms`;
      io.observe(el);
    });
  }

  /* --- Next gathering countdown ------------------------------------ */
  function initNextService() {
    const box = document.querySelector('[data-next-service]');
    if (!box) return;
    const label = box.querySelector('[data-next-label]');
    const when = box.querySelector('[data-next-when]');
    const WEEK = 7 * 24 * 60;

    const render = () => {
      const now = planoNow();
      if (now.dow < 0) return;
      const nowMin = now.dow * 24 * 60 + now.minutes;

      const live = SERVICES.find((s) => {
        const start = s.dow * 24 * 60 + s.minutes;
        return nowMin >= start && nowMin < start + SERVICE_LENGTH;
      });
      box.classList.toggle('is-live', Boolean(live));
      if (live) {
        label.textContent = 'Happening now';
        when.innerHTML = `${live.label} is live. <a href="${LIVE_URL}" target="_blank" rel="noopener">Watch online</a>`;
        return;
      }

      const upcoming = SERVICES
        .map((s) => ({ ...s, wait: ((s.dow * 24 * 60 + s.minutes) - nowMin + WEEK) % WEEK }))
        .sort((a, b) => a.wait - b.wait)[0];

      const days = Math.floor(upcoming.wait / (24 * 60));
      const hours = Math.floor((upcoming.wait % (24 * 60)) / 60);
      const mins = upcoming.wait % 60;
      let countdown;
      if (days > 0) countdown = `${days} day${days > 1 ? 's' : ''}, ${hours} hr${hours === 1 ? '' : 's'}`;
      else if (hours > 0) countdown = `${hours} hr${hours === 1 ? '' : 's'}, ${mins} min`;
      else countdown = `${mins} min`;

      const dayWord = days === 0 && upcoming.dow === now.dow ? 'Today' : DAY_NAMES[upcoming.dow];
      label.textContent = `Next gathering in ${countdown}`;
      when.textContent = `${dayWord} at ${upcoming.time} · ${upcoming.label}`;
    };

    render();
    setInterval(render, 30 * 1000);
  }

  /* --- Highlight today in the weekly rhythm ------------------------ */
  function initWeek() {
    const week = document.querySelector('[data-week]');
    if (!week) return;
    const { dow } = planoNow();
    week.querySelector(`[data-dow="${dow}"]`)?.classList.add('is-today');
  }

  /* --- Click-to-load sermon player (keeps the third-party embed off the critical path) */
  function initPlayer() {
    document.querySelectorAll('[data-player]').forEach((player) => {
      const btn = player.querySelector('button');
      btn?.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = player.dataset.src;
        iframe.title = 'Most recent Mt. Olive service';
        iframe.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write';
        iframe.allowFullscreen = true;
        player.append(iframe);
        player.classList.add('is-playing');
        iframe.focus();
      });
    });
  }

  /* --- Subtle parallax on hero arches ------------------------------ */
  function initParallax() {
    if (prefersReducedMotion) return;
    const arches = [...document.querySelectorAll('.hero__art .arch')];
    if (!arches.length) return;
    const rates = arches.map((a) => (a.classList.contains('arch--center') ? -0.06 : 0.08));
    let ticking = false;
    const update = () => {
      const y = Math.min(window.scrollY, window.innerHeight);
      arches.forEach((a, i) => a.style.setProperty('--drift', `${(y * rates[i]).toFixed(1)}px`));
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  function initYear() {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  initHeader();
  initMobileNav();
  initReveal();
  initNextService();
  initWeek();
  initPlayer();
  initParallax();
  initYear();
})();
