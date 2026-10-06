// Демо-режим без сервера: «бэкенд» живёт в браузере посетителя (localStorage + IndexedDB).
// Подключается только в статической сборке (GitHub Pages). Изменения видны только тому, кто их сделал.
(() => {
  const realFetch = window.fetch.bind(window);
  const K = { content: 'demo.content', leads: 'demo.leads', admin: 'demo.admin' };
  const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

  // --- файлы в IndexedDB
  const db = new Promise(ok => { const r = indexedDB.open('demo-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f', { keyPath: 'key' }); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
  const tx = async (mode, fn) => { const d = await db; if (!d) return null; return new Promise(ok => { const t = d.transaction('f', mode); const r = fn(t.objectStore('f')); t.oncomplete = () => ok(r && r.result); t.onerror = () => ok(null); }); };
  const keyToBlob = new Map(), blobToKey = new Map();
  const reg = (key, blob) => { const u = URL.createObjectURL(blob); keyToBlob.set(key, u); blobToKey.set(u, key); return u; };
  const loadFiles = (async () => { const all = await tx('readonly', s => s.getAll()) || []; all.forEach(f => reg(f.key, f.blob)); return all; })();
  const swap = (obj, map) => JSON.parse(JSON.stringify(obj, (k, v) => typeof v === 'string' && map.has(v) ? map.get(v) : v));

  const base = realFetch('data/content.json').then(r => r.json());
  const getContent = async () => { await loadFiles; const c = ls.get(K.content, null) || await base; return swap(c, keyToBlob); };

  window.fetch = async (url, opt = {}) => {
    const u = String(url);
    const m = /\/api\/(.*)$/.exec(u.split('?')[0]);
    if (!m) return realFetch(url, opt);
    const route = m[1], method = (opt.method || 'GET').toUpperCase();
    const body = () => { try { return JSON.parse(opt.body || '{}'); } catch { return {}; } };
    const admin = !!sessionStorage.getItem(K.admin);

    if (route === 'content' && method === 'GET') return json(await getContent());
    if (route === 'me') return json({ admin });
    if (route === 'login') { if (body().password !== 'demo123') return json({ error: 'Неверный пароль' }, 401); sessionStorage.setItem(K.admin, '1'); return json({ ok: true }); }
    if (route === 'logout') { sessionStorage.removeItem(K.admin); return json({ ok: true }); }
    if (route === 'lead') {
      const b = body(); if (!/^\d{10,12}$/.test(String(b.phone || '').replace(/\D/g, ''))) return json({ error: 'Укажите телефон' }, 400);
      const all = ls.get(K.leads, []); all.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), name: b.name || '', phone: b.phone, comment: b.comment || '', calc: b.calc || '', source: b.source || '' });
      ls.set(K.leads, all); return json({ ok: true });
    }
    if (!admin) return json({ error: 'Нужен вход' }, 401);
    if (route === 'content' && method === 'PUT') { ls.set(K.content, swap(body(), blobToKey)); return json({ ok: true }); }
    if (route === 'leads' && method === 'GET') return json(ls.get(K.leads, []));
    if (route.startsWith('leads/') && method === 'DELETE') { const id = route.split('/')[1]; ls.set(K.leads, ls.get(K.leads, []).filter(l => l.id !== id)); return json({ ok: true }); }
    if (route === 'uploads' && method === 'GET') { const all = await loadFiles; const out = []; for (const [k, v] of keyToBlob) { const f = (await tx('readonly', s => s.get(k))); out.push({ url: v, size: f ? f.blob.size : 0 }); } return json(out); }
    if (route.startsWith('uploads/') && method === 'DELETE') { return json({ ok: true }); }
    return json({ error: 'Нет такого метода' }, 404);
  };

  // загрузка файла: админка шлёт XMLHttpRequest на /api/upload — подменяем
  const RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const x = new RealXHR(); let target = null; const self = this;
    const props = {};
    this.upload = {};
    this.open = (method, url) => { if (/\/api\/upload\?/.test(url)) target = new URL(url, location.href).searchParams.get('name'); else { target = null; x.open(method, url); } };
    this.send = async blob => {
      if (target === null) return x.send(blob);
      if (blob.size > 150 * 1024 * 1024) { self.status = 413; self.responseText = JSON.stringify({ error: 'В демо-режиме файлы до 150 МБ' }); return self.onload && self.onload(); }
      const key = 'local:' + Date.now().toString(36) + '-' + target;
      await tx('readwrite', s => s.put({ key, blob }));
      const url = reg(key, blob);
      self.upload.onprogress && self.upload.onprogress({ lengthComputable: true, loaded: 1, total: 1 });
      self.status = 200; self.responseText = JSON.stringify({ url, name: target }); self.onload && self.onload();
    };
    this.setRequestHeader = () => {};
    return this;
  };
})();
