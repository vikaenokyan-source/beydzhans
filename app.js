(() => {
  const root = document.documentElement;
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

  /* close the compact section menu after a jump */
  document.querySelectorAll('.nav__drop a').forEach((a) => a.addEventListener('click', () => a.closest('details').removeAttribute('open')));

  /* ---------- tabs: arrow keys, instant swap (browsed often, no motion) ---------- */
  document.querySelectorAll('[data-switch]').forEach((sw) => {
    const tabs = [...sw.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t, false));
      t.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
    select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0], false);
  });

  /* ---------- the menu by size: prices on reels ----------
     Without script the table shows all three columns. With it, one column,
     each digit a strip of 0 to 9 moved with transform, so a size change
     retargets mid-roll instead of restarting. */
  const table = document.querySelector('[data-sized]');
  const seg = document.querySelector('[data-size]');
  if (table && seg) {
    const DIGITS = 3;
    const rows = [...table.querySelectorAll('tbody tr:not(.sized__group)')].map((tr) => {
      const cells = [...tr.querySelectorAll('td')];
      const values = cells.map((td) => td.textContent.trim());
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
        if (!raw) {
          price.hidden = true; none.hidden = false; spoken.textContent = '';
          return;
        }
        price.hidden = false; none.hidden = true;
        spoken.textContent = `${values[index]} рублей`;
        const padded = raw.padStart(DIGITS, ' ');
        reels.forEach(({ reel, strip }, i) => {
          const ch = padded[i];
          const blank = ch === ' ';
          reel.dataset.blank = String(blank);
          strip.style.transform = `translateY(${blank ? 0 : -Number(ch)}em)`;
        });
      });
    };

    table.classList.add('is-sized');
    seg.hidden = false;
    const checked = seg.querySelector('input:checked');
    setSize(Number(checked ? checked.value : 1));
    seg.addEventListener('change', (e) => { if (e.target.name === 'size') setSize(Number(e.target.value)); });
  }

  /* ---------- one reveal, and the neon switching on ---------- */
  if (!('IntersectionObserver' in window) || reduce.matches) return;
  root.classList.add('js-motion');
  const blocks = document.querySelectorAll('[data-reveal]');
  blocks.forEach((el) => {
    [...el.children].forEach((child, i) => child.style.setProperty('--i', String(Math.min(i, 6))));
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  blocks.forEach((el) => io.observe(el));

  const neon = document.querySelector('[data-neon]');
  if (neon) {
    const nio = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      neon.classList.add('is-lit');
      nio.disconnect();
    }, { threshold: 0.6 });
    nio.observe(neon);
  }
})();
