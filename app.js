(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- today in Moscow: the status chip and the hours table ---------- */
  const HOURS = { 0: [480, 1320], 1: [450, 1320], 2: [450, 1320], 3: [450, 1320], 4: [450, 1320], 5: [450, 1320], 6: [480, 1320] };
  const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const moscowNow = () => {
    const now = new Date();
    const msk = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    return { day: msk.getDay(), minutes: msk.getHours() * 60 + msk.getMinutes() };
  };
  const paintToday = () => {
    const { day, minutes } = moscowNow();
    const [open, close] = HOURS[day];
    const status = document.querySelector('[data-status]');
    if (status) {
      let text;
      let isOpen = false;
      if (minutes < open) text = `Откроемся в ${fmt(open)}`;
      else if (minutes < close) { text = `Открыто до ${fmt(close)}`; isOpen = true; }
      else text = `Закрыто, завтра с ${fmt(HOURS[(day + 1) % 7][0])}`;
      if (status.textContent !== text) status.textContent = text;
      status.dataset.open = String(isOpen);
    }
    document.querySelectorAll('[data-hours] tr').forEach((tr) => {
      if (Number(tr.dataset.day) === day) tr.setAttribute('aria-current', 'date');
      else tr.removeAttribute('aria-current');
    });
  };
  paintToday();
  setInterval(paintToday, 60000);

  /* ---------- nav: out of the way while reading down, back on the way up ---------- */
  const nav = document.querySelector('[data-nav]');
  let lastY = window.scrollY;
  let navTick = false;
  window.addEventListener('scroll', () => {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const open = nav.querySelector('details[open]');
      nav.classList.toggle('is-hidden', y > lastY && y > 240 && !open);
      lastY = y;
      navTick = false;
    });
  }, { passive: true });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  document.querySelectorAll('.nav__drop a').forEach((a) => a.addEventListener('click', () => a.closest('details').removeAttribute('open')));

  /* ---------- the menu shelf: spines are tabs, books are panels ---------- */
  const shelf = document.querySelector('[data-shelf]');
  if (shelf) {
    const spines = [...shelf.querySelectorAll('[role="tab"]')];
    const select = (spine, { focus = false, animate = true } = {}) => {
      spines.forEach((s) => {
        const on = s === spine;
        s.setAttribute('aria-selected', String(on));
        s.tabIndex = on ? 0 : -1;
        const page = document.getElementById(s.getAttribute('aria-controls'));
        page.hidden = !on;
        if (on && animate) {
          page.classList.remove('is-opening');
          void page.offsetWidth;
          page.classList.add('is-opening');
        }
      });
      if (focus) spine.focus();
      const sr = shelf.getBoundingClientRect();
      const r = spine.getBoundingClientRect();
      if (r.left < sr.left || r.right > sr.right) shelf.scrollBy({ left: r.left - sr.left - sr.width / 2 + r.width / 2, behavior: reduce.matches ? 'auto' : 'smooth' });
    };
    spines.forEach((s, i) => {
      s.addEventListener('click', () => select(s));
      s.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (step) { e.preventDefault(); select(spines[(i + step + spines.length) % spines.length], { focus: true }); }
        if (e.key === 'Home') { e.preventDefault(); select(spines[0], { focus: true }); }
        if (e.key === 'End') { e.preventDefault(); select(spines[spines.length - 1], { focus: true }); }
      });
    });
    select(spines.find((s) => s.getAttribute('aria-selected') === 'true') || spines[0], { animate: false });

    // a link to a book (#shelf, #signature) pulls that spine and scrolls to the shelf
    const openFromHash = () => {
      const spine = spines.find((s) => `#${s.getAttribute('aria-controls')}` === location.hash);
      if (!spine) return;
      select(spine);
      document.getElementById('menu').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' });
    };
    window.addEventListener('hashchange', openFromHash);
    openFromHash();
  }

  /* ---------- classic drinks by size: prices on reels ----------
     Without script the table shows all three columns. With it, one column,
     each digit a strip of 0 to 9 moved with transform, so a size change
     retargets mid-roll instead of restarting. */
  const table = document.querySelector('[data-sized]');
  const seg = document.querySelector('[data-size]');
  if (table && seg) {
    const DIGITS = 3;
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => {
      const values = [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
      const plus = values.some((v) => v.startsWith('+'));
      const roll = document.createElement('td');
      roll.className = 'roll num';
      const price = document.createElement('span');
      price.className = 'reel-price';
      price.setAttribute('aria-hidden', 'true');
      const sign = document.createElement('span');
      sign.textContent = plus ? '+' : '';
      price.append(sign);
      const reels = [];
      for (let i = 0; i < DIGITS; i += 1) {
        const reel = document.createElement('span');
        reel.className = 'reel';
        const strip = document.createElement('span');
        strip.className = 'reel__strip';
        strip.style.setProperty('--d', String(i));
        for (let n = 0; n <= 9; n += 1) { const s = document.createElement('span'); s.textContent = String(n); strip.append(s); }
        reel.append(strip);
        price.append(reel);
        reels.push({ reel, strip });
      }
      const unit = document.createElement('span');
      unit.className = 'reel-price__unit';
      unit.textContent = ' ₽';
      price.append(unit);
      const none = document.createElement('span');
      none.className = 'reel-price__none';
      none.textContent = 'нет в этом объёме';
      const spoken = document.createElement('span');
      spoken.className = 'visually-hidden';
      roll.append(price, none, spoken);
      tr.append(roll);
      return { values, reels, price, none, spoken };
    });

    const setSize = (index) => {
      rows.forEach(({ values, reels, price, none, spoken }) => {
        const raw = values[index].replace('+', '');
        if (!raw) { price.hidden = true; none.hidden = false; spoken.textContent = ''; return; }
        price.hidden = false; none.hidden = true;
        spoken.textContent = `${values[index]} рублей`;
        const padded = raw.padStart(DIGITS, ' ');
        reels.forEach(({ reel, strip }, i) => {
          const ch = padded[i];
          const blank = ch === ' ';
          reel.dataset.blank = String(blank);
          strip.style.transform = `translateY(${blank ? 0 : -Number(ch) * 1.3}em)`;
        });
      });
    };

    table.classList.add('is-sized');
    seg.hidden = false;
    const checked = seg.querySelector('input:checked');
    setSize(Number(checked ? checked.value : 1));
    seg.addEventListener('change', (e) => { if (e.target.name === 'size') setSize(Number(e.target.value)); });
  }

  /* ---------- one reveal: blocks rise, photographs wipe, bars fill ---------- */
  const revealables = document.querySelectorAll('[data-reveal], .scores');
  revealables.forEach((el) => [...el.children].forEach((c, i) => c.style.setProperty('--i', String(Math.min(i, 6)))));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- the stage: the curtain follows the scroll, then the neon comes on ---------- */
  const stage = document.querySelector('[data-stage]');
  if (stage && !reduce.matches) {
    const left = stage.querySelector('[data-curtain="l"]');
    const right = stage.querySelector('[data-curtain="r"]');
    const neon = stage.querySelector('[data-neon]');
    stage.classList.add('is-live');
    let tick = false;
    const paint = () => {
      const r = stage.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, (-r.top) / (travel * 0.7)));
      const eased = 1 - Math.pow(1 - p, 2);
      left.style.transform = `translateX(${-eased * 100}%)`;
      right.style.transform = `translateX(${eased * 100}%)`;
      if (eased > 0.6) neon.classList.add('is-lit');
      else if (eased < 0.1) neon.classList.remove('is-lit');
      tick = false;
    };
    let near = false;
    const onScroll = () => { if (near && !tick) { tick = true; requestAnimationFrame(paint); } };
    // only follow the scroll while the stage is on screen
    new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) onScroll(); }, { rootMargin: '20% 0px' }).observe(stage);
    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }
})();
