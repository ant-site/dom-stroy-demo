// Общие части сайта: загрузка контента из админки, шапка, подвал, заявки
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const telHref = p => 'tel:+' + String(p).replace(/\D/g, '').replace(/^8/, '7');

const SITE = {
  ready: fetch('/api/content', { cache: 'no-store' }).then(r => r.json()).then(c => { SITE.c = c; SITE.theme(c); SITE.chrome(c); return c; }),
  theme(c) {
    const k = c.brand.colors || {}, s = document.documentElement.style;
    if (k.accent) s.setProperty('--accent', k.accent);
    if (k.ink) s.setProperty('--ink', k.ink);
    if (k.canvas) s.setProperty('--canvas', k.canvas);
    if (k.accent) { // читаемый цвет текста на кнопке
      const [r, g, b] = [1, 3, 5].map(i => parseInt(k.accent.slice(i, i + 2), 16));
      s.setProperty('--accent-ink', (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#171a1d' : '#fbf6ef');
    }
    if (c.brand.name) document.title = document.title.replace('{brand}', c.brand.name);
  },
  chrome(c) {
    const b = c.brand, here = location.pathname.replace(/\/$/, '').split('/').pop() || 'index';
    const link = (h, t, id) => `<a href="${h}"${here.replace('.html', '') === id ? ' aria-current="page"' : ''}>${t}</a>`;
    const logo = b.logo ? `<img src="${esc(b.logo)}" alt="">` : `<i>${esc((b.name || 'С')[0])}</i>`;
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="demo-for">Демо-версия для <b>rtzakir</b> · по заказу «Сайт. Строительство домов». Админ-панель: <a href="admin.html"><b>admin.html</b></a></div>
      <header class="bar"><div class="wrap">
        <a class="logo" href="index.html">${logo}<span>${esc(b.name)}</span></a>
        <button class="burger" aria-label="Меню" aria-expanded="false">☰</button>
        <nav class="nav" aria-label="Основное">${link('index.html', 'О компании', 'index')}${link('projects.html', 'Проекты домов', 'projects')}${link('video.html', 'Видео и камеры', 'video')}</nav>
        <a class="tel" href="${telHref(b.phone)}">${esc(b.phone)}</a>
        <a class="btn btn--sm" href="index.html#zayavka">Заявка</a>
      </div></header>`);
    const bu = document.querySelector('.burger'), nav = document.querySelector('.nav');
    bu.onclick = () => { const o = nav.classList.toggle('open'); bu.setAttribute('aria-expanded', o); };
    document.body.insertAdjacentHTML('beforeend', `
      <footer class="foot"><div class="wrap">
        <div class="foot__top">
          <div><a class="logo" href="index.html">${logo}<span>${esc(b.name)}</span></a><p style="margin-top:12px;max-width:34ch">${esc(b.tagline)}</p></div>
          <div class="foot__nav"><a href="index.html">О компании</a><a href="projects.html">Проекты домов</a><a href="video.html">Видео и камеры</a></div>
          <div><a href="${telHref(b.phone)}" style="color:#fff;font-weight:600">${esc(b.phone)}</a><br>${esc(b.email)}<br>${esc(b.address)}<br>${esc(b.hours)}</div>
        </div>
        <div class="sign"><img src="assets/brand-mark.webp" alt=""><span>Автор сайта: Антонина Логутенкова</span></div>
      </div></footer>`);
    // появление блоков при прокрутке
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: .12 });
    SITE.reveal = (root = document) => root.querySelectorAll('[data-in]:not(.seen)').forEach(el => io.observe(el));
    SITE.reveal();
  },
  // форма заявки: sel — форма, calcText() — строка с расчётом
  bindLead(form, source, calcText) {
    const msg = form.querySelector('.msg-slot');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(form), btn = form.querySelector('button[type=submit]');
      btn.disabled = true; msg.innerHTML = '';
      try {
        const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: f.get('name'), phone: f.get('phone'), comment: f.get('comment'), calc: calcText ? calcText() : '', source }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Ошибка');
        form.reset(); msg.innerHTML = '<div class="msg ok" role="status">Спасибо! Заявка получена, перезвоним в рабочее время.</div>';
      } catch (err) { msg.innerHTML = `<div class="msg err" role="alert">${esc(err.message)}</div>`; }
      btn.disabled = false;
    });
  }
};
