const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

// ---------- Armazenamento ----------
const DATA = ipcRenderer.sendSync('get-user-data');
const STORE = path.join(DATA, 'store.json');
const DEF = { lists: [], favs: [], down: {}, last: null, dedupe: false, hideDown: false, seeded: false, volume: 1, quality: -1, onlyMovies: true, defV: 0, defRepo: '', favV: 0, rest: false, restA: 30, restB: 30, restT: 50, eqOn: false, eq: [0, 0, 0, 0, 0] };
let S = (() => { try { return Object.assign({}, DEF, JSON.parse(fs.readFileSync(STORE, 'utf8'))); } catch (e) { return { ...DEF }; } })();
const save = () => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(STORE, JSON.stringify(S)); } catch (e) {} };
const dir = (n) => { const p = path.join(DATA, n); fs.mkdirSync(p, { recursive: true }); return p; };
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Lista incluída (Globo / SBT): se carga en la primera ejecución (y se reintenta si falló)
const APP = ipcRenderer.sendSync('get-app-path');
if (!S.seed2) {
  try {
    const src = [path.join(APP, 'assets', 'Globo-SBT-BR.m3u'), path.join(__dirname, 'assets', 'Globo-SBT-BR.m3u')].find((p) => fs.existsSync(p));
    const txt = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(path.join(dir('lists'), 'seed.m3u'), txt);
    if (!S.lists.some((l) => l.id === 'seed')) S.lists.push({ id: 'seed', name: 'Globo-SBT-BR.m3u', local: true, enabled: false });
    S.seed2 = true; save();
  } catch (e) { console.error('seed', e); }
}
// La lista Globo-SBT queda desactivada (se activa con su casilla en «Listas»). Se aplica una sola vez, así no vuelve a apagarse si la activas.
if (!S.globoOff) {
  const g = S.lists.find((l) => l.id === 'seed');
  if (g) g.enabled = false;
  S.globoOff = true; save();
}

// Listas y favoritos que vienen de fábrica (igual que la app de Android)

// Repositorio de GitHub donde están las listas verificadas (usuario/repo).
// Lo escribe el workflow al compilar en GitHub; para «npm start» o el .bat se puede poner a mano en lists-config.json.
const REPO = (() => {
  for (const base of [APP, __dirname]) {
    try { const r = String(JSON.parse(fs.readFileSync(path.join(base, 'lists-config.json'), 'utf8')).repo || '').trim(); if (/^[\w.-]+\/[\w.-]+$/.test(r)) return r; } catch (e) {}
  }
  return '';
})();
const LISTS_BASE = REPO ? 'https://raw.githubusercontent.com/' + REPO + '/HEAD/listas/' : '';
const PLUTO = 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/';
// nombre del archivo verificado en GitHub -> URL original (fallback=false: listas generales de las que GitHub deja solo películas)
const SOURCES = [
  { name: 'mexico_lg', original: 'https://raw.githubusercontent.com/Llorchico/LG/refs/heads/main/mxlg.m3u', fallback: true },
  { name: 'espanol', original: 'https://iptv-org.github.io/iptv/languages/spa.m3u', fallback: true },
  { name: 'peliculas', original: 'https://iptv-org.github.io/iptv/categories/movies.m3u', fallback: true },
  { name: 'portugues', original: 'https://iptv-org.github.io/iptv/languages/por.m3u', fallback: true },
  { name: 'brasil_m3ucl', original: 'https://m3u.cl/lista/BR.m3u', fallback: true },
  { name: 'clasicos', original: 'https://iptv-org.github.io/iptv/categories/classic.m3u', fallback: true },
  { name: 'free_tv', original: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8', fallback: false },
  { name: 'pluto_mx', original: PLUTO + 'plutotv_mx.m3u', fallback: false },
  { name: 'pluto_ar', original: PLUTO + 'plutotv_ar.m3u', fallback: false },
  { name: 'pluto_cl', original: PLUTO + 'plutotv_cl.m3u', fallback: false },
  { name: 'plex_mx', original: PLUTO + 'plex_mx.m3u', fallback: false }
];
const verified = (name) => (LISTS_BASE ? LISTS_BASE + name + '.m3u' : null);
// Listas que vienen puestas: las verificadas en GitHub (o las originales si no hay repositorio)
const DEFAULT_URLS = SOURCES.map((x) => verified(x.name) || x.original);
// Si la lista verificada aún no existe o no responde, se usa la original
const FALLBACK = {};
for (const x of SOURCES) { const v = verified(x.name); if (x.fallback && v) FALLBACK[v] = x.original; }
const ORIGINAL_URLS = SOURCES.map((x) => x.original);
const DEFAULT_URL = DEFAULT_URLS[0]; // lista inicial (México): de ella se muestran solo las películas si el filtro está activo
const DEFAULTS_VERSION = 2;
const DEFAULT_FAVS = {"1": ["TV Globo Brasilia (1080p)"], "2": ["Warner Channel Colombia (1080p)", "Xtrema Cartoons", "Gospel Cartoon (360p)", "Record News (720p)", "RecordTV Interior SP", "Retro Cartoon (720p)", "SBT Cuiaba", "HBO Family Latin America (1080p)", "HBO Latin America (1080p)", "Historia (1080p)", "Historia Y Vida (720p)", "History 2 Latin America (1080p)", "Maxcine (720p)", "Maxcine Comedy (720p)", "ESPN Premium HD (1080p)", "Fox Sports (1080p)", "Fox Sports HD", "France 24 Spanish (1080p)", "Garage TV Latin America", "Golden Plus (1080p)", "HBO 2 Latin America HD (1080p)", "Cine Sony (720p)", "CNN en Espanol (1080p)", "Crimen & Historia (720p)", "Discovery Channel Latin America South", "Disney Jr. Latin America (1080p)", "El Chavo TV (720p)", "ESPN 2 Latin America (1080p)", "731 Pluto TV Cine Suspenso", "733 FreeTV Terror", "742 FreeTV Estelar", "Adrenalina Pura TV (720p)", "Bob Esponja (720p)", "Bob Esponja Pantalones Cuadrados (720p)", "Cine Friki (1080p)", "Gospel Cartoon | BR", "PRIDEtv Latam | CL", "708 FreeTV Accion", "711 FreeTV Familia", "713 Runtime Familia", "716 FreeTV Clásico", "729 Pluto TV Cine Crimen"]};
// Agrega las listas por defecto nuevas una sola vez (si las quitas, no vuelven) y cambia las originales por las verificadas.
// También se repite si la app pasa a usar otro repositorio de listas.
if (S.defV < DEFAULTS_VERSION || (REPO && S.defRepo !== REPO)) {
  const wasOff = new Set();
  const isOld = (u) => ORIGINAL_URLS.includes(u) || SOURCES.some((x) => u !== verified(x.name) && u.endsWith('/HEAD/listas/' + x.name + '.m3u'));
  if (REPO) {
    S.lists = S.lists.filter((l) => {
      if (!l.url || !isOld(l.url)) return true;
      if (!l.enabled) wasOff.add(l.url);
      return false;
    });
  }
  SOURCES.forEach((x, i) => {
    const u = DEFAULT_URLS[i];
    if (S.lists.some((l) => l.url === u)) return;
    const off = wasOff.has(x.original) || [...wasOff].some((w) => w.endsWith('/HEAD/listas/' + x.name + '.m3u'));
    S.lists.push({ id: hash(u), name: u, url: u, enabled: !off });
  });
  S.defV = DEFAULTS_VERSION; S.defRepo = REPO; save();
}
{
  const latest = Math.max(...Object.keys(DEFAULT_FAVS).map(Number));
  if (S.favV < latest) {
    const set = new Set(S.favs);
    for (const [v, names] of Object.entries(DEFAULT_FAVS)) if (+v > S.favV) names.forEach((n) => set.add(norm(n)));
    S.favs = [...set]; S.favV = latest; save();
  }
}

// ---------- Parser M3U ----------
const isManifest = (t) => t.includes('#EXT-X-STREAM-INF') || t.includes('#EXT-X-TARGETDURATION');
function parseM3u(text, base) {
  const out = []; let title = null, group = '', extGrp = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '').trim();
    if (!line) continue;
    if (/^#EXTINF/i.test(line)) {
      let q = false, t = '';
      for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') q = !q; else if (c === ',' && !q) { t = line.slice(i + 1).trim(); break; } }
      title = t; const m = /group-title="([^"]*)"/i.exec(line); group = m ? m[1].trim() : '';
    } else if (/^#EXTGRP:/i.test(line)) extGrp = line.split(':').slice(1).join(':').trim();
    else if (line.startsWith('#')) continue;
    else {
      let url = null;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(line)) url = line;
      else if (base) { try { url = new URL(line, base).toString(); } catch (e) {} }
      if (url) {
        const t = (title && title.trim()) || decodeURIComponent(url.split('/').pop().split('?')[0]) || url;
        out.push({ id: hash(url + t), title: t, url, group: group || extGrp, key: norm(t) });
      }
      title = null; group = ''; extGrp = '';
    }
  }
  return out;
}

async function fetchText(url) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.text(); }
  finally { clearTimeout(to); }
}

const isMovie = (t) => { const m = /^\s*(\d{3})\b/.exec(t); return !!m && +m[1] >= 700 && +m[1] <= 799; };

async function loadOne(l, refresh) {
  let text = null, failed = 0;
  try {
    if (l.local) text = fs.readFileSync(path.join(dir('lists'), l.id + '.m3u'), 'utf8');
    else {
      const cache = path.join(dir('cache'), l.id + '.m3u');
      if (refresh || !fs.existsSync(cache)) {
        const bk = FALLBACK[l.url];
        try {
          text = await fetchText(l.url);
          if (bk && !/#EXTINF/i.test(text)) throw new Error('no es una lista M3U');
        } catch (e) {
          text = null;
          if (bk) { try { text = await fetchText(bk); } catch (e2) {} }
        }
        if (text) { try { fs.writeFileSync(cache, text); } catch (e) {} } else failed++;
      }
      if (text == null && fs.existsSync(cache)) text = fs.readFileSync(cache, 'utf8');
    }
  } catch (e) {}
  if (!text) return { items: [], failed };
  if (!l.local && isManifest(text)) return { items: [{ id: hash(l.url), title: l.name || l.url, url: l.url, group: '', key: norm(l.name || l.url) }], failed };
  const parsed = parseM3u(text, l.local ? null : l.url);
  const movies = (l.url === DEFAULT_URL || l.url === ORIGINAL_URLS[0]) && S.onlyMovies ? parsed.filter((c) => isMovie(c.title)) : parsed;
  return { items: movies.length ? movies : parsed, failed };
}

async function loadAll(refresh) {
  const res = await Promise.all(S.lists.filter((l) => l.enabled).map((l) => loadOne(l, refresh)));
  const map = new Map(); let failed = 0;
  for (const r of res) { failed += r.failed; for (const c of r.items) if (c.key && !map.has(c.url)) map.set(c.url, c); }
  return { all: [...map.values()], failed };
}

// ---------- Estado / UI ----------
const $ = (id) => document.getElementById(id);
const video = $('video');
let all = [], shown = [], current = null, playing = null, onlyFavs = true, query = '', group = '';
let hls = null, mpg = null, stallT = null, rendered = 0;
const tried = new Set();
const favs = new Set(S.favs);
const CHUNK = 250;

function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }
function status(msg) { $('status').textContent = msg || ''; }

function refreshShown() {
  const q = norm(query);
  let list = all;
  if (S.dedupe) { const seen = new Set(); list = list.filter((c) => !seen.has(c.key) && seen.add(c.key)); }
  if (S.hideDown) list = list.filter((c) => !S.down[c.id]);
  if (onlyFavs) list = list.filter((c) => favs.has(c.key));
  if (group) list = list.filter((c) => c.group === group);
  if (q) list = list.filter((c) => norm(c.title).includes(q));
  shown = list;
  $('count').textContent = shown.length + ' canales';
  $('btnAll').classList.toggle('on', !onlyFavs);
  $('btnFavs').classList.toggle('on', onlyFavs);
  $('chlist').scrollTop = 0; rendered = 0; $('chlist').innerHTML = ''; renderMore();
}

function renderMore() {
  const box = $('chlist'); const end = Math.min(shown.length, rendered + CHUNK);
  const frag = document.createDocumentFragment();
  for (let i = rendered; i < end; i++) {
    const c = shown[i]; const d = document.createElement('div');
    d.className = 'ch' + (current && current.id === c.id ? ' cur' : '') + (S.down[c.id] ? ' down' : '');
    d.dataset.id = c.id;
    d.innerHTML = '<span class="t"></span><span class="g"></span><span class="s' + (favs.has(c.key) ? ' on' : '') + '">' + (favs.has(c.key) ? '★' : '☆') + '</span>';
    d.children[0].textContent = c.title; d.children[1].textContent = c.group;
    d.onclick = () => pick(c);
    d.children[2].onclick = (e) => { e.stopPropagation(); toggleFav(c); };
    frag.appendChild(d);
  }
  box.appendChild(frag); rendered = end;
}
$('chlist').addEventListener('scroll', (e) => { const el = e.target; if (rendered < shown.length && el.scrollTop + el.clientHeight > el.scrollHeight - 300) renderMore(); });

function buildGroups() {
  const gs = [...new Set(all.map((c) => c.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sel = $('groupSel'); sel.innerHTML = '<option value="">Todos os grupos</option>';
  gs.forEach((g) => { const o = document.createElement('option'); o.value = g; o.textContent = g; sel.appendChild(o); });
  sel.value = gs.includes(group) ? group : ''; group = sel.value;
  sel.classList.toggle('hidden', gs.length === 0);
}

function toggleFav(c) {
  if (favs.has(c.key)) favs.delete(c.key); else favs.add(c.key);
  S.favs = [...favs]; save(); refreshShown(); updateTop();
}
function updateTop() {
  $('title').textContent = current ? current.title : '';
  $('bFav').textContent = current && favs.has(current.key) ? '★' : '☆';
  document.querySelectorAll('.ch').forEach((e) => e.classList.toggle('cur', current && e.dataset.id === current.id));
}

// ---------- Reproducción ----------
function destroyEngines() {
  clearTimeout(stallT);
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  if (mpg) { try { mpg.destroy(); } catch (e) {} mpg = null; }
  video.removeAttribute('src'); video.load();
  $('qual').innerHTML = '<option value="-1">Auto</option>';
}

function pick(c) {
  current = c; tried.clear(); tried.add(c.id);
  S.last = c.id; save(); updateTop(); startStream(c);
}

function startStream(c) {
  destroyEngines(); playing = c; status('Cargando…\n' + c.title);
  const u = c.url;
  stallT = setTimeout(fail, 25000);
  try {
    if (/\.m3u8(\?|#|$)/i.test(u) && window.Hls && Hls.isSupported()) {
      let netRetries = 0;
      hls = new Hls({ maxBufferLength: 30, enableWorker: true });
      hls.loadSource(u); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { buildQuality(); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries++ < 2) hls.startLoad();
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && netRetries++ < 2) hls.recoverMediaError();
        else fail();
      });
    } else if (!/\.(mp4|webm|mkv|m3u8)(\?|#|$)/i.test(u) && window.mpegts && mpegts.isSupported()) {
      mpg = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: u }, { enableStashBuffer: true });
      mpg.attachMediaElement(video); mpg.load();
      mpg.on(mpegts.Events.ERROR, fail);
      video.play().catch(() => {});
    } else { video.src = u; video.play().catch(() => {}); }
  } catch (e) { fail(); }
}

function fail() {
  clearTimeout(stallT);
  if (!playing || !current) return;
  const alt = all.find((c) => c.key === current.key && !tried.has(c.id));
  if (alt) { tried.add(alt.id); toast('Fuente no disponible, probando otra…'); startStream(alt); return; }
  S.down[current.id] = Date.now(); save();
  destroyEngines(); status('Canal caído.\nElige otro de la lista.');
  const el = document.querySelector('.ch[data-id="' + current.id + '"]'); if (el) el.classList.add('down');
}

video.addEventListener('playing', () => {
  clearTimeout(stallT); status('');
  if (current && S.down[current.id]) { delete S.down[current.id]; save(); }
  $('bPlay').textContent = '⏸';
});
video.addEventListener('pause', () => { $('bPlay').textContent = '▶'; });
video.addEventListener('error', () => { if (!hls && !mpg) fail(); });

function buildQuality() {
  const sel = $('qual'); sel.innerHTML = '<option value="-1">Auto</option>';
  if (!hls) return;
  hls.levels.forEach((l, i) => { if (l.height) { const o = document.createElement('option'); o.value = i; o.dataset.h = l.height; o.textContent = l.height + 'p'; sel.appendChild(o); } });
  if (S.quality > 0) { const o = [...sel.options].find((x) => +x.dataset.h === S.quality); if (o) { sel.value = o.value; hls.currentLevel = +o.value; } }
}
$('qual').onchange = (e) => {
  const v = +e.target.value; if (hls) hls.currentLevel = v;
  const o = e.target.selectedOptions[0]; S.quality = v < 0 ? -1 : +o.dataset.h; save();
};

function step(d) {
  const list = shown.length ? shown : all; if (!list.length) return;
  let i = current ? list.findIndex((c) => c.id === current.id) : -1;
  i = (i + d + list.length) % list.length;
  pick(list[i]);
  const el = document.querySelector('.ch[data-id="' + list[i].id + '"]'); if (el) el.scrollIntoView({ block: 'nearest' });
}

// ---------- Controles ----------
$('bPrev').onclick = () => step(-1);
$('bNext').onclick = () => step(1);
$('bPlay').onclick = () => (video.paused ? video.play() : video.pause());
$('bFav').onclick = () => current && toggleFav(current);
$('bFull').onclick = toggleFull;
video.ondblclick = toggleFull;
video.onclick = () => (video.paused ? video.play() : video.pause());
function toggleFull() { document.fullscreenElement ? document.exitFullscreen() : $('player').requestFullscreen(); }
$('vol').value = S.volume; video.volume = S.volume;
$('vol').oninput = (e) => { video.volume = +e.target.value; video.muted = false; S.volume = +e.target.value; save(); $('volIcon').textContent = video.volume === 0 ? '🔇' : '🔊'; };
$('volIcon').onclick = () => { video.muted = !video.muted; $('volIcon').textContent = video.muted ? '🔇' : '🔊'; };

let idleT; const player = $('player');
function wake() { player.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!video.paused) player.classList.add('idle'); }, 3000); }
player.addEventListener('mousemove', wake); wake();

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.target.tagName === 'SELECT') return;
  switch (e.key) {
    case ' ': e.preventDefault(); video.paused ? video.play() : video.pause(); break;
    case 'ArrowUp': case 'PageUp': e.preventDefault(); step(-1); break;
    case 'ArrowDown': case 'PageDown': e.preventDefault(); step(1); break;
    case 'Enter': case 'f11': toggleFull(); break;
    case 'F11': e.preventDefault(); toggleFull(); break;
    case 'f': case 'F': current && toggleFav(current); break;
    case 'm': case 'M': $('volIcon').click(); break;
  }
  wake();
});

// ---------- Filtros ----------
$('btnAll').onclick = () => { onlyFavs = false; refreshShown(); };
$('btnFavs').onclick = () => { onlyFavs = true; refreshShown(); };
$('search').oninput = (e) => { query = e.target.value.trim(); refreshShown(); };
$('groupSel').onchange = (e) => { group = e.target.value; refreshShown(); };
$('optDup').checked = S.dedupe; $('optDown').checked = S.hideDown;
$('optDup').onchange = (e) => { S.dedupe = e.target.checked; save(); refreshShown(); };
$('optDown').onchange = (e) => { S.hideDown = e.target.checked; save(); refreshShown(); };
$('site').onclick = (e) => { e.preventDefault(); ipcRenderer.send('open-external', 'https://www.luisdornellez.com'); };

// ---------- Listas ----------
async function reload(refresh, notify) {
  status('Cargando listas…');
  const r = await loadAll(refresh); all = r.all; buildGroups();
  if (onlyFavs && !all.some((c) => favs.has(c.key))) onlyFavs = false;
  refreshShown(); status('');
  if (!all.length) status('Sin canales.\nAbre "Listas" y agrega una URL o un archivo M3U.');
  else if (!current) {
    const last = all.find((c) => c.id === S.last);
    pick((last && favs.has(last.key) && last) || all.find((c) => favs.has(c.key)) || last || all[0]);
  }
  if (notify || (refresh && r.failed)) toast(all.length + ' canales' + (r.failed ? ' · ' + r.failed + ' lista(s) sin conexión, uso la copia guardada' : ''));
}

function drawLists() {
  const box = $('lists'); box.innerHTML = '';
  if (!S.lists.length) box.innerHTML = '<div class="li">Ninguna lista. Agrega una abajo.</div>';
  S.lists.forEach((l, i) => {
    const d = document.createElement('div'); d.className = 'li';
    d.innerHTML = '<input type="checkbox"><span class="n"></span><button title="Quitar">🗑</button>';
    d.children[0].checked = l.enabled; d.children[1].textContent = (l.local ? '📄 ' : '🌐 ') + (l.local ? l.name : l.url); d.children[1].title = l.url || l.name;
    d.children[0].onchange = (e) => { l.enabled = e.target.checked; save(); reload(false, true); };
    d.children[2].onclick = () => { S.lists.splice(i, 1); save(); drawLists(); reload(false, true); };
    box.appendChild(d);
  });
}
const openDlg = () => { drawLists(); $('modal').classList.remove('hidden'); };
$('btnLists').onclick = openDlg;
$('closeDlg').onclick = () => $('modal').classList.add('hidden');
$('modal').onclick = (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); };

$('addUrl').onclick = () => {
  let u = $('newUrl').value.trim(); if (!u) return;
  if (!u.includes('://')) u = 'https://' + u;
  if (!/^https?:\/\//i.test(u)) return toast('Usa un enlace http(s)://');
  if (S.lists.some((l) => l.url === u)) return toast('Esa lista ya fue agregada');
  S.lists.push({ id: hash(u), name: u, url: u, enabled: true }); save();
  $('newUrl').value = ''; drawLists(); reload(true, true);
};
$('optMovies').checked = S.onlyMovies;
$('optMovies').onchange = (e) => { S.onlyMovies = e.target.checked; save(); reload(false, true); };
$('refresh').onclick = () => reload(true, true);
$('clearDown').onclick = () => { S.down = {}; save(); refreshShown(); toast('Canales caídos limpiados'); };

$('impFile').onclick = () => $('fileM3u').click();
$('fileM3u').onchange = async (e) => {
  let ok = 0, bad = 0;
  for (const f of e.target.files) {
    const t = await f.text();
    if (!/#EXTINF/i.test(t)) { bad++; continue; }
    const id = 'l' + hash(f.name + Date.now());
    fs.writeFileSync(path.join(dir('lists'), id + '.m3u'), t);
    S.lists.push({ id, name: f.name, local: true, enabled: true }); ok++;
  }
  e.target.value = ''; save(); drawLists();
  toast(ok ? 'Importado: ' + ok + ' archivo(s)' + (bad ? ' · ' + bad + ' no válido(s)' : '') : 'Archivo M3U no válido');
  if (ok) reload(false, true);
};

$('bkSave').onclick = () => {
  const lists = S.lists.map((l) => l.local ? { ...l, text: (() => { try { return fs.readFileSync(path.join(dir('lists'), l.id + '.m3u'), 'utf8'); } catch (e) { return ''; } })() } : l);
  const blob = new Blob([JSON.stringify({ app: 'PelisLD', lists, favs: [...favs], down: S.down })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'PelisLD-copia.json'; a.click();
};
$('bkLoad').onclick = () => $('fileBk').click();
$('fileBk').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    let j = JSON.parse(await f.text());
    if (j.app === 'PelisLD-TV') { // copia de seguridad de la app de Android
      j = { app: 'PelisLD', favs: (j.favoritos || []).map((x) => x.key).filter(Boolean),
        lists: (j.listas || []).filter((l) => /^https?:\/\//i.test(l.url || '')).map((l) => ({ id: hash(l.url), name: l.url, url: l.url, enabled: l.activa !== false })) };
    }
    if (j.app !== 'PelisLD') throw 0;
    let nl = 0;
    for (const l of j.lists || []) {
      if (S.lists.some((x) => x.id === l.id)) continue;
      if (l.local && l.text) fs.writeFileSync(path.join(dir('lists'), l.id + '.m3u'), l.text);
      const { text, ...rest } = l; S.lists.push(rest); nl++;
    }
    let nf = 0; for (const k of j.favs || []) if (!favs.has(k)) { favs.add(k); nf++; }
    S.favs = [...favs]; save(); drawLists();
    toast('Restaurado: ' + nl + ' lista(s) y ' + nf + ' favorito(s) nuevos'); reload(true, false);
  } catch (err) { toast('Ese archivo no es una copia válida de Pelis LD'); }
};


// ---------- Descanso visual (filtro cálido + atenuación) ----------
function hsv2rgb(h) { // s=1, v=1
  const k = (n) => (n + h / 60) % 6, f = (n) => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [Math.round(255 * f(5)), Math.round(255 * f(3)), Math.round(255 * f(1))];
}
function applyRest() {
  const els = [$('restBody'), $('restPlayer')];
  els.forEach((e) => e.classList.toggle('hidden', !S.rest));
  if (S.rest) {
    const [r, g, b] = hsv2rgb(55 - S.restT * 0.45);
    const tint = 'rgba(' + r + ',' + g + ',' + b + ',' + (S.restA * 0.6 / 100).toFixed(3) + ')';
    const dim = 'rgba(0,0,0,' + ((100 - S.restB) / 100 * 0.7).toFixed(3) + ')';
    els.forEach((e) => { e.style.backgroundImage = 'linear-gradient(' + tint + ',' + tint + '),linear-gradient(' + dim + ',' + dim + ')'; });
  }
  $('btnRest').classList.toggle('on', S.rest);
}
function setRest(on) { S.rest = on; save(); applyRest(); }
$('btnRest').onclick = () => setRest(!S.rest);
function drawRestDialog() {
  const box = $('restBox'); box.innerHTML = '';
  const defs = [['restA', 'Intensidad del filtro', 0, 100, 30, '%'], ['restB', 'Brillo de la pantalla', 5, 100, 30, '%'], ['restT', 'Tono (amarillo a rojizo)', 0, 100, 50, '']];
  for (const [k, label, min, max, , unit] of defs) {
    const d = document.createElement('div'); d.className = 'sl';
    d.innerHTML = '<span></span><input type="range" min="' + min + '" max="' + max + '" step="1">';
    const sp = d.children[0], sl = d.children[1]; sl.value = S[k]; sp.textContent = label + ': ' + S[k] + unit;
    sl.oninput = () => { S[k] = +sl.value; sp.textContent = label + ': ' + S[k] + unit; applyRest(); };
    sl.onchange = save; box.appendChild(d);
  }
  $('restReset').onclick = () => { defs.forEach(([k, , , , def]) => { S[k] = def; }); save(); applyRest(); drawRestDialog(); };
}
$('btnRestTune').onclick = () => { if (!S.rest) setRest(true); drawRestDialog(); $('restModal').classList.remove('hidden'); };
$('restDone').onclick = () => { save(); $('restModal').classList.add('hidden'); };
$('restOff').onclick = () => { setRest(false); $('restModal').classList.add('hidden'); };
$('restModal').onclick = (e) => { if (e.target.id === 'restModal') { save(); $('restModal').classList.add('hidden'); } };
applyRest();

// ---------- Ecualizador (Web Audio, 5 bandas) ----------
const EQ_F = [60, 230, 910, 3600, 14000];
const EQ_PRESETS = { 'Normal': [3, 0, 0, 0, 3], 'Clásica': [5, 3, -2, 4, 4], 'Baile': [6, 0, 2, 4, 1], 'Plano': [0, 0, 0, 0, 0], 'Folk': [3, 0, 0, 2, -1], 'Heavy Metal': [4, 1, 9, 3, 0], 'Hip Hop': [5, 3, 0, 1, 3], 'Jazz': [4, 2, -2, 2, 5], 'Pop': [-1, 2, 5, 1, -2], 'Rock': [5, 3, -1, 3, 5] };
let actx = null, eqFilters = [];
function eqInit() {
  if (actx) { actx.resume && actx.resume(); return true; }
  try {
    actx = new AudioContext();
    let node = actx.createMediaElementSource(video);
    eqFilters = EQ_F.map((f, i) => {
      const b = actx.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : i === EQ_F.length - 1 ? 'highshelf' : 'peaking';
      b.frequency.value = f; b.Q.value = 1; b.gain.value = 0;
      node.connect(b); node = b; return b;
    });
    node.connect(actx.destination);
    eqApply(); actx.resume && actx.resume(); return true;
  } catch (e) { actx = null; return false; }
}
function eqApply() { eqFilters.forEach((b, i) => { b.gain.value = S.eqOn ? S.eq[i] : 0; }); }
video.addEventListener('playing', () => { if (S.eqOn) eqInit(); });
const fmtF = (hz) => (hz >= 1000 ? (hz / 1000).toFixed(1).replace('.0', '') + ' kHz' : hz + ' Hz');
const fmtDb = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB';
function drawEq() {
  $('eqOn').checked = S.eqOn;
  const pre = $('eqPre'); pre.innerHTML = '<option value="">Preajustes…</option>';
  Object.keys(EQ_PRESETS).forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; pre.appendChild(o); });
  const box = $('eqBox'); box.innerHTML = '';
  EQ_F.forEach((f, i) => {
    const d = document.createElement('div'); d.className = 'sl';
    d.innerHTML = '<span></span><input type="range" min="-15" max="15" step="0.5">';
    const sp = d.children[0], sl = d.children[1]; sl.value = S.eq[i]; sp.textContent = fmtF(f) + ': ' + fmtDb(S.eq[i]);
    sl.oninput = () => { S.eq[i] = +sl.value; sp.textContent = fmtF(f) + ': ' + fmtDb(S.eq[i]); turnOn(); eqApply(); };
    sl.onchange = save; box.appendChild(d);
  });
}
function turnOn() { if (!S.eqOn) { S.eqOn = true; $('eqOn').checked = true; } if (!eqInit()) { toast('No se pudo iniciar el ecualizador'); S.eqOn = false; $('eqOn').checked = false; } }
$('btnEq').onclick = () => { drawEq(); $('eqModal').classList.remove('hidden'); };
$('eqOn').onchange = (e) => { if (e.target.checked) turnOn(); else S.eqOn = false; eqApply(); save(); };
$('eqPre').onchange = (e) => { const p = EQ_PRESETS[e.target.value]; if (!p) return; S.eq = p.slice(); turnOn(); eqApply(); save(); drawEq(); };
$('eqReset').onclick = () => { S.eq = [0, 0, 0, 0, 0]; eqApply(); save(); drawEq(); };
$('eqDone').onclick = () => { save(); $('eqModal').classList.add('hidden'); };
$('eqModal').onclick = (e) => { if (e.target.id === 'eqModal') { save(); $('eqModal').classList.add('hidden'); } };

reload(true, false);
