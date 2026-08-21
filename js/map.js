// ── Costanti ──────────────────────────────────────────────────────────────
const CENTER = [13.35, 38.14692];
const ZOOM = 11;
const BOUNDS = [13.10, 37.94, 13.60, 38.33];

const DATA = {
  peba: 'dati/peba.geojson',
  reteArchi: 'dati/geojson/rete_archi.geojson',
};

function makeAttribNode(text, href) {
  const frag = document.createDocumentFragment();
  if (href) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    frag.appendChild(a);
  } else {
    frag.appendChild(document.createTextNode(text));
  }
  frag.appendChild(document.createTextNode(' | Rete: OpenStreetMap contributors, elaborazione PalermoHub | Rilievo PEBA: Comune di Palermo'));
  return frag;
}

const BASEMAPS = {
  osm: {
    type: 'raster',
    tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
    tileSize: 256,
    attribution: '© OpenStreetMap contributors © CartoDB',
    attributionNode: makeAttribNode('© OpenStreetMap contributors © CartoDB', 'https://www.openstreetmap.org/copyright'),
    maxzoom: 19,
  },
  satellite: {
    type: 'raster',
    tiles: [
      'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    ],
    tileSize: 256,
    attribution: '© Google',
    attributionNode: makeAttribNode('© Google', null),
    maxzoom: 20,
  },
};

// ── Mappa (rotazione e beccheggio bloccati) ─────────────────────────────────
const map = new maplibregl.Map({
  container: 'map',
  hash: true,
  style: {
    version: 8,
    sources: {
      'basemap-osm': {
        type: BASEMAPS.osm.type,
        tiles: BASEMAPS.osm.tiles,
        tileSize: BASEMAPS.osm.tileSize,
        maxzoom: BASEMAPS.osm.maxzoom,
      },
    },
    layers: [
      { id: 'basemap-osm-layer', type: 'raster', source: 'basemap-osm', paint: { 'raster-opacity': 1.0 } },
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
  center: CENTER,
  zoom: ZOOM,
  maxZoom: 16,
  maxBounds: [[BOUNDS[0], BOUNDS[1]], [BOUNDS[2], BOUNDS[3]]],
  attributionControl: false,
  pitchWithRotate: false,
  dragRotate: false,
  touchPitch: false,
});

map.touchZoomRotate.disableRotation();

// Centra tenendo conto del pannello dx (aperto di default da >=640px, vedi panel.js)
map.on('load', () => {
  const rpOpen = document.getElementById('rp-wrap')?.classList.contains('open');
  if (rpOpen) {
    map.jumpTo({
      center: CENTER,
      zoom: ZOOM,
      padding: { top: 0, bottom: 0, left: 0, right: 406 },
    });
  }
});

// ── Colori per livello di accessibilità (usati solo nel pannello dettaglio/filtri, non per la classificazione in mappa) ──
const COLORI_ACCESSIBILITA = {
  'Accessibile': '#2b8a3e',
  'Parzialmente accessibile': '#94c93d',
  'Parzialmente inaccessibile': '#f0b429',
  'Inaccessibile': '#c92a2a',
  'Non valutabile': '#999999',
};

// ── Colori per gruppo (tipo di immobile/percorso) ────────────────────────
const COLORI_GRUPPO = {
  'Percorso UNESCO': '#e6370c',
  'Percorso storico': '#6d3ba0',
  'Via cittadina': '#3e548e',
  'Piazza': '#db8337',
  'Area verde': '#55af5e',
  'Asilo': '#c49bfc',
  'Scuola': '#ef9ffc',
  'Sede amministrativa/istituzionale': '#a4d060',
  'Museo': '#e336b7',
  'Sito UNESCO (edificio)': '#916a39',
};
const RAMP_GRUPPO = ['match', ['get', 'Gruppo']];
Object.entries(COLORI_GRUPPO).forEach(([k, v]) => { RAMP_GRUPPO.push(k, v); });
RAMP_GRUPPO.push('#999999');

// Stessa palette della legenda "Gruppo", applicata al tipo di via/percorso PEBA
const RAMP_GRUPPO_VIA = ['match', ['get', 'peba_tipo']];
Object.entries(COLORI_GRUPPO).forEach(([k, v]) => { RAMP_GRUPPO_VIA.push(k, v); });
RAMP_GRUPPO_VIA.push('#999999');

map.on('load', () => {
  // ── Sorgenti ──────────────────────────────────────────────────────────
  map.addSource('rete-archi', { type: 'geojson', data: DATA.reteArchi });
  map.addSource('peba-punti', { type: 'geojson', data: DATA.peba });

  // ── Rete stradale — sfondo di riferimento, non interattiva ──────────────
  map.addLayer({
    id: 'rete-archi-line', type: 'line', source: 'rete-archi',
    filter: ['!=', ['get', 'peba_via'], true],
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': '#9aa5c4',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 1.6],
      'line-opacity': 0,
    },
  });

  // ── Vie/percorsi PEBA — colorate per tipo, stessa palette della legenda ──
  map.addLayer({
    id: 'rete-archi-peba-line', type: 'line', source: 'rete-archi',
    filter: ['==', ['get', 'peba_via'], true],
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': RAMP_GRUPPO_VIA,
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 16, 4],
      'line-opacity': 0.9,
    },
  });

  // ── Immobili PEBA (colore = livello accessibilità) ───────────────────────
  map.addLayer({
    id: 'peba-punti-circle', type: 'circle', source: 'peba-punti',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9],
      'circle-color': RAMP_GRUPPO,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
      'circle-stroke-opacity': 1,
    },
  });

  updateMapScale();
});

// ── Click → pannello destro (dettaglio immobile) ────────────────────────────
function fmtNum(v, d = 2) {
  return (v === null || v === undefined) ? '-' : Number(v).toLocaleString('it-IT', { maximumFractionDigits: d });
}

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function rpSec(label) {
  const s = document.createElement('div'); s.className = 'rp-punto-sec';
  const l = document.createElement('div'); l.className = 'rp-punto-sec-label'; l.textContent = label;
  s.appendChild(l); return s;
}
function rpRow(label, value) {
  const r = document.createElement('div'); r.className = 'rp-punto-row';
  const lEl = document.createElement('span'); lEl.className = 'rp-punto-row-label'; lEl.textContent = label;
  const vEl = document.createElement('span'); vEl.className = 'rp-punto-row-value'; vEl.textContent = value;
  r.appendChild(lEl); r.appendChild(vEl); return r;
}
function rpBadgeRow(label, text, colors) {
  const r = document.createElement('div'); r.className = 'rp-punto-row';
  const lEl = document.createElement('span'); lEl.className = 'rp-punto-row-label'; lEl.textContent = label;
  const badge = document.createElement('span'); badge.className = 'rp-punto-badge';
  badge.textContent = text;
  if (colors) { badge.style.background = colors.bg; badge.style.color = colors.text; badge.style.borderColor = colors.border; }
  r.appendChild(lEl); r.appendChild(badge); return r;
}

function badgeColori(livello) {
  const col = COLORI_ACCESSIBILITA[livello] || COLORI_ACCESSIBILITA['Non valutabile'];
  return { bg: `${col}22`, text: col, border: `${col}88` };
}

// Galleria foto: img/foto/<Codice>/01.{jpg|png} .. NN (NN = "N. foto rilievo")
function rpGalleriaFoto(codice, nFoto) {
  if (!nFoto || nFoto <= 0) return null;
  const s = rpSec('Foto sopralluogo');
  const grid = document.createElement('div');
  grid.className = 'rp-photo-grid';
  const srcs = [];
  for (let i = 1; i <= nFoto; i++) {
    const num = String(i).padStart(2, '0');
    const base = `img/foto/${encodeURIComponent(codice)}/${num}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rp-photo-thumb';
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = `Foto ${i} — ${esc(codice)}`;
    img.dataset.tried = 'jpg';
    img.src = `${base}.jpg`;
    img.onerror = () => {
      if (img.dataset.tried === 'jpg') {
        img.dataset.tried = 'png';
        img.src = `${base}.png`;
      } else {
        btn.remove();
      }
    };
    img.onload = () => { srcs[i - 1] = img.src; };
    btn.appendChild(img);
    btn.addEventListener('click', () => openPhotoModal(srcs, i - 1, codice));
    grid.appendChild(btn);
  }
  s.appendChild(grid);
  return s;
}

// ── Modale galleria foto (avanti/indietro, esc, click fuori) ─────────────
(function initPhotoModal() {
  const modal = document.getElementById('photo-modal');
  if (!modal) return;
  const imgEl = document.getElementById('photo-modal-img');
  const counterEl = document.getElementById('photo-modal-counter');
  const thumbsEl = document.getElementById('photo-modal-thumbs');
  const prevBtn = document.getElementById('photo-modal-prev');
  const nextBtn = document.getElementById('photo-modal-next');
  const closeBtn = document.getElementById('photo-modal-close');
  const rotateLeftBtn = document.getElementById('photo-modal-rotate-left');
  const rotateRightBtn = document.getElementById('photo-modal-rotate-right');
  let srcs = [];
  let idx = 0;
  let rotations = [];

  function applyRotation() {
    imgEl.style.transform = `rotate(${rotations[idx] || 0}deg)`;
  }
  function rotate(delta) {
    if (!srcs.length) return;
    rotations[idx] = ((rotations[idx] || 0) + delta + 360) % 360;
    applyRotation();
  }
  function show() {
    const src = srcs[idx];
    if (!src) return;
    imgEl.src = src;
    applyRotation();
    counterEl.textContent = `${idx + 1} / ${srcs.length}`;
    thumbsEl.querySelectorAll('.photo-modal-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === idx);
    });
    const activeThumb = thumbsEl.children[idx];
    if (activeThumb) activeThumb.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function step(delta) {
    if (!srcs.length) return;
    idx = (idx + delta + srcs.length) % srcs.length;
    show();
  }
  function close() {
    modal.hidden = true;
    imgEl.src = '';
  }
  function buildThumbs() {
    thumbsEl.innerHTML = '';
    srcs.forEach((src, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-modal-thumb';
      const img = document.createElement('img');
      img.src = src; img.loading = 'lazy'; img.alt = `Foto ${i + 1}`;
      btn.appendChild(img);
      btn.addEventListener('click', () => { idx = i; show(); });
      thumbsEl.appendChild(btn);
    });
  }
  window.openPhotoModal = (list, startIdx) => {
    srcs = list.filter(Boolean);
    idx = Math.max(0, srcs.indexOf(list[startIdx]));
    rotations = srcs.map(() => 0);
    if (!srcs.length) return;
    modal.hidden = false;
    buildThumbs();
    show();
  };
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  closeBtn.addEventListener('click', close);
  rotateLeftBtn.addEventListener('click', () => rotate(-90));
  rotateRightBtn.addEventListener('click', () => rotate(90));
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === '[' ) rotate(-90);
    else if (e.key === ']') rotate(90);
  });
})();

function openFeaturePanel(title, lngLat, sections) {
  const body = document.getElementById('rp-punto-body');
  body.innerHTML = '';
  sections.forEach((s) => s && body.appendChild(s));

  document.getElementById('rp-punto-title').textContent = title;
  document.getElementById('rp-punto-coords').textContent = lngLat
    ? `${lngLat.lat.toFixed(4)}° N  ${lngLat.lng.toFixed(4)}° E` : '';

  document.getElementById('rp-gallery').style.display = 'none';
  document.getElementById('rp-punto').style.display = '';
  if (typeof window.openRightPanel === 'function') window.openRightPanel();
}

// ── Tooltip hover (nome immobile) ───────────────────────────────────────
const hoverPopup = new maplibregl.Popup({
  closeButton: false, closeOnClick: false, offset: 10, className: 'peba-hover-popup',
});
map.on('mousemove', 'peba-punti-circle', (e) => {
  const f = e.features[0];
  if (!f) return;
  const nome = esc(f.properties['Nome Immobile']) || esc(f.properties.Gruppo) || '(senza nome)';
  const codice = esc(f.properties.Codice);
  const label = codice ? `${codice} – ${nome}` : nome;
  hoverPopup.setLngLat(e.lngLat).setHTML(`<div class="mp-title">${label}</div>`).addTo(map);
});
map.on('mouseleave', 'peba-punti-circle', () => { hoverPopup.remove(); });

function showPebaDetail(p, lngLat) {
  const anagrafica = rpSec('Anagrafica');
  anagrafica.appendChild(rpRow('Nome', esc(p['Nome Immobile']) || esc(p.Gruppo) || '(senza nome)'));
  anagrafica.appendChild(rpRow('Indirizzo', esc(p.Indirizzo)));
  anagrafica.appendChild(rpRow('Gruppo', esc(p.Gruppo)));
  if (p.Categoria) anagrafica.appendChild(rpRow('Categoria', esc(p.Categoria)));
  if (p.Circoscrizione) anagrafica.appendChild(rpRow('Circoscrizione', esc(p.Circoscrizione)));
  if (p.Quartiere) anagrafica.appendChild(rpRow('Quartiere', esc(p.Quartiere)));
  if (p.UPL) anagrafica.appendChild(rpRow('UPL', esc(p.UPL)));

  const accessibilita = rpSec('Accessibilità');
  accessibilita.appendChild(rpBadgeRow('Livello', esc(p['Livello accessibilita']) || 'non valutabile', badgeColori(p['Livello accessibilita'])));
  accessibilita.appendChild(rpRow('Punteggio', p.Punteggio != null ? `${fmtNum(p.Punteggio, 0)} / 100` : 'n/d'));
  if (p.Rilevanza) accessibilita.appendChild(rpRow('Rilevanza', esc(p.Rilevanza)));

  const sections = [anagrafica, accessibilita];

  if (p['Criticità Rilevate']) {
    const crit = rpSec('Criticità rilevate');
    const txt = document.createElement('div');
    txt.className = 'rp-punto-note';
    txt.textContent = p['Criticità Rilevate'];
    crit.appendChild(txt);
    sections.push(crit);
  }

  const foto = rpGalleriaFoto(p.Codice, p['N. foto rilievo']);
  if (foto) sections.push(foto);

  openFeaturePanel(esc(p['Nome Immobile']) || esc(p.Gruppo) || '(senza nome)', lngLat, sections);
}
window.showPebaDetail = showPebaDetail;

map.on('click', 'peba-punti-circle', (e) => {
  const f = e.features[0];
  if (!f) return;
  showPebaDetail(f.properties, e.lngLat);
});
map.on('mouseenter', 'peba-punti-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'peba-punti-circle', () => { map.getCanvas().style.cursor = ''; });

// ── Scala metrica ─────────────────────────────────────────────────────────
function updateMapScale() {
  const scaleBar = document.getElementById('map-scale-bar');
  const scaleLabel = document.getElementById('map-scale-label');
  if (!scaleBar || !scaleLabel) return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const mpp = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
  const maxPx = 120;
  const maxM = mpp * maxPx;
  const exp = Math.pow(10, Math.floor(Math.log10(maxM)));
  const nice = [1, 2, 5, 10].map((f) => f * exp).find((v) => v <= maxM) || exp;
  const barW = Math.round(nice / mpp);
  scaleBar.style.width = barW + 'px';
  scaleLabel.textContent = nice >= 1000 ? (nice / 1000) + ' km' : Math.round(nice) + ' m';
}
map.on('move', updateMapScale);

// ── Toolbar: home ─────────────────────────────────────────────────────────
document.getElementById('tb-home').addEventListener('click', () => {
  const rpOpen = document.getElementById('rp-wrap')?.classList.contains('open');
  map.flyTo({
    center: CENTER,
    zoom: ZOOM,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: rpOpen ? 406 : 0 },
  });
});

// ── Toolbar: basemap (attivabili singolarmente, non esclusivi) ───────────
let activeBasemaps = ['osm'];
let topBasemapOpacity = 1;

function renderBasemaps() {
  Object.keys(BASEMAPS).forEach((key) => {
    if (map.getLayer(`basemap-${key}-layer`)) map.removeLayer(`basemap-${key}-layer`);
  });
  const firstLayerId = map.getStyle().layers[0]?.id;
  activeBasemaps.forEach((key, i) => {
    const layerId = `basemap-${key}-layer`;
    const sourceId = `basemap-${key}`;
    if (!map.getSource(sourceId)) {
      const bm = BASEMAPS[key];
      map.addSource(sourceId, { type: 'raster', tiles: bm.tiles, tileSize: bm.tileSize, maxzoom: bm.maxzoom });
    }
    const isTop = i === activeBasemaps.length - 1;
    const opacity = (activeBasemaps.length > 1 && isTop) ? topBasemapOpacity : 1;
    map.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: { 'raster-opacity': opacity } }, firstLayerId);
  });
  const opacityWrap = document.getElementById('tb-basemap-opacity-wrap');
  if (opacityWrap) opacityWrap.hidden = activeBasemaps.length < 2;
  updateAttribution(activeBasemaps);
}

document.getElementById('tb-basemaps').addEventListener('click', (e) => {
  const btn = e.target.closest('.tb-radio');
  if (!btn) return;
  const key = btn.dataset.basemap;
  const idx = activeBasemaps.indexOf(key);
  if (idx !== -1) {
    if (activeBasemaps.length === 1) return; // almeno una mappa base sempre attiva
    activeBasemaps.splice(idx, 1);
    btn.classList.remove('active');
  } else {
    activeBasemaps.push(key);
    btn.classList.add('active');
  }
  renderBasemaps();
});

document.getElementById('tb-basemap-opacity').addEventListener('input', (e) => {
  topBasemapOpacity = Number(e.target.value) / 100;
  document.getElementById('tb-basemap-opacity-val').textContent = e.target.value + '%';
  renderBasemaps();
});

function updateAttribution(keys) {
  const text = document.getElementById('attrib-text');
  if (!text) return;
  text.innerHTML = '';
  const list = Array.isArray(keys) ? keys : [keys];
  list.forEach((key, i) => {
    if (i > 0) text.appendChild(document.createTextNode(' · '));
    text.appendChild(BASEMAPS[key].attributionNode.cloneNode(true));
  });
}
map.on('load', () => renderBasemaps());

// ── Toolbar: rete stradale on/off ───────────────────────────────────────
document.getElementById('tb-vie').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const on = !btn.classList.contains('active');
  btn.classList.toggle('active', on);
  if (map.getLayer('rete-archi-line')) {
    map.setPaintProperty('rete-archi-line', 'line-opacity', on ? 0.55 : 0);
  }
});

// ── Fullscreen ────────────────────────────────────────────────────────────
document.getElementById('tb-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
});

// ── Attribuzioni collassabili ─────────────────────────────────────────────
(function initAttrib() {
  const btn = document.getElementById('attrib-btn');
  const panel = document.getElementById('attrib-panel');
  btn.addEventListener('click', () => {
    const open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', String(open));
  });
})();
