// ── Costanti ──────────────────────────────────────────────────────────────
const CENTER = [13.35, 38.14692];
const ZOOM = 11;
const BOUNDS = [13.10, 37.94, 13.60, 38.33];

const DATA = {
  peba: 'dati/peba.geojson',
  pebaEdifici: 'dati/peba_edifici.geojson',
  pebaAreeVerdi: 'dati/peba_aree_verdi.geojson',
  reteArchi: 'dati/geojson/rete_archi.geojson',
  codiceOggettoPdf: 'dati/codice_oggetto_pdf.json',
};

// Dimensione in byte di ogni file dati/pdf/*.pdf (valore statico: evita una seconda fetch)
const PDF_SIZES = new Map(Object.entries({
  '1792335239_2026_08_18.pdf': 143717,
  '1792335239_2026_08_18_1.pdf': 142257,
  '1792335239_2026_08_18_2.pdf': 1968255,
  '1792335239_2026_08_18_3.pdf': 2882822,
  '1792335239_2026_08_18_4.pdf': 4563383,
  '1792335239_2026_08_18_5.pdf': 2268954,
  '1792335239_2026_08_18_6.pdf': 2779455,
  '1792335239_2026_08_18_7.pdf': 3108135,
  '1792335239_2026_08_18_8.pdf': 4124894,
  '1792335239_2026_08_18_9.pdf': 4520983,
  '1792335239_2026_08_18_10.pdf': 5119731,
  '1792335239_2026_08_18_11.pdf': 7711273,
  '1792335239_2026_08_18_12.pdf': 13218396,
  '1792335239_2026_08_18_13.pdf': 14791499,
  '1792335239_2026_08_18_14.pdf': 16558591,
  '1792335239_2026_08_18_15.pdf': 18513683,
  '1792335239_2026_08_18_16.pdf': 20083556,
  '1792335239_2026_08_18_17.pdf': 24134743,
  '1792335239_2026_08_18_18.pdf': 24299191,
  '1792335239_2026_08_18_19.pdf': 27713123,
  '1792335239_2026_08_18_20.pdf': 28156339,
  '1792335239_2026_08_18_21.pdf': 29789794,
  '1792335239_2026_08_18_22.pdf': 35324737,
  '1792335239_2026_08_18_23.pdf': 39042861,
  '1792335239_2026_08_18_24.pdf': 45073666,
  '1792335239_2026_08_18_25.pdf': 46793753,
}));

// Mappa Codice -> file_pdf (dati/codice_oggetto_pdf.json)
const CODICE_PDF = new Map();
fetch(DATA.codiceOggettoPdf).then((r) => r.json()).then((elenco) => {
  elenco.forEach((v) => { if (v.codice && v.file_pdf) CODICE_PDF.set(v.codice, v.file_pdf); });
}).catch(() => {});

function fmtDimensioneFile(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${fmtNum(mb, 1)} MB` : `${fmtNum(bytes / 1024, 0)} KB`;
}

// Sezione con link al PDF della scheda originale (dati/pdf/<file_pdf>)
function rpLinkPdf(codice) {
  const file = CODICE_PDF.get(codice);
  if (!file) return null;
  const s = rpSec('Scheda PDF');
  const row = document.createElement('div');
  row.className = 'rp-pdf-row';
  const href = `dati/pdf/${encodeURIComponent(file)}`;
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'rp-pdf-link';
  a.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><text x="7" y="19" font-size="7" font-weight="700" stroke="none" fill="currentColor">PDF</text></svg><span>Apri scheda PDF originale</span>`;
  const dim = fmtDimensioneFile(PDF_SIZES.get(file));
  const testoNota = dim ? `File pesante: ${dim} — il download potrebbe richiedere tempo.` : '';
  if (testoNota) a.title = testoNota;
  row.appendChild(a);
  if (testoNota) {
    const nota = document.createElement('p');
    nota.className = 'rp-pdf-note';
    nota.textContent = testoNota;
    row.appendChild(nota);
  }
  s.appendChild(row);
  return s;
}

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

const OSM_TILES_LIGHT = ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'];
const OSM_TILES_DARK = ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'];

const BASEMAPS = {
  osm: {
    type: 'raster',
    tiles: document.documentElement.getAttribute('data-theme') === 'dark' ? OSM_TILES_DARK : OSM_TILES_LIGHT,
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

// ── Colori per livello di accessibilità (classificazione mappa, legenda e pannello dettaglio) ──
const COLORI_ACCESSIBILITA = {
  'Accessibile': '#0072b2',
  'Parzialmente accessibile': '#56b4e9',
  'Parzialmente inaccessibile': '#e69f00',
  'Inaccessibile': '#d55e00',
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
// Icona (paths SVG, stroke, viewBox 24) per Gruppo — usata nell'header della scheda
const DEFAULT_ICON_PATHS = '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>';
const ICONE_GRUPPO = {
  'Asilo': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  'Scuola': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  'Sede amministrativa/istituzionale': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'Museo': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'Sito UNESCO (edificio)': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'Piazza': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
  'Area verde': '<circle cx="12" cy="9" r="6"/><line x1="12" y1="15" x2="12" y2="21"/>',
  'Percorso UNESCO': '<polygon points="12 2 19 21 12 17 5 21 12 2"/>',
  'Percorso storico': '<polygon points="12 2 19 21 12 17 5 21 12 2"/>',
  'Via cittadina': '<polygon points="12 2 19 21 12 17 5 21 12 2"/>',
};
function rpIconePerGruppo(gruppo) {
  return ICONE_GRUPPO[gruppo] || DEFAULT_ICON_PATHS;
}

// Permalink scheda (?scheda=Codice) — usa un search param, non tocca l'hash di MapLibre
function updateSchedaUrl(codice) {
  const url = new URL(window.location.href);
  if (codice) url.searchParams.set('scheda', codice);
  else url.searchParams.delete('scheda');
  history.replaceState(null, '', url);
}
window.updateSchedaUrl = updateSchedaUrl;

// Stessa palette della legenda "Accessibilità", applicata ai punti immobile
const RAMP_LIVELLO = ['match', ['get', 'Livello accessibilita']];
Object.entries(COLORI_ACCESSIBILITA).forEach(([k, v]) => { RAMP_LIVELLO.push(k, v); });
RAMP_LIVELLO.push(COLORI_ACCESSIBILITA['Non valutabile']);

// Stessa palette della legenda "Gruppo", applicata ai punti immobile
const RAMP_GRUPPO = ['match', ['get', 'Gruppo']];
Object.entries(COLORI_GRUPPO).forEach(([k, v]) => { RAMP_GRUPPO.push(k, v); });
RAMP_GRUPPO.push('#999999');

// Stessa palette "Gruppo", applicata alle vie/percorsi PEBA (proprietà peba_tipo)
const RAMP_GRUPPO_VIA = ['match', ['get', 'peba_tipo']];
Object.entries(COLORI_GRUPPO).forEach(([k, v]) => { RAMP_GRUPPO_VIA.push(k, v); });
RAMP_GRUPPO_VIA.push('#999999');

// Stessa palette "Livello accessibilità", applicata alle vie/percorsi PEBA
// (proprietà livello_via, ricavata per match nome via ↔ Nome/Localizzazione immobile)
const RAMP_LIVELLO_VIA = ['match', ['get', 'livello_via']];
Object.entries(COLORI_ACCESSIBILITA).forEach(([k, v]) => { RAMP_LIVELLO_VIA.push(k, v); });
RAMP_LIVELLO_VIA.push(COLORI_ACCESSIBILITA['Non valutabile']);

// Tema colore mappa (e legenda): 'livello' (default) o 'gruppo'
let currentMapTheme = 'livello';
function setMapTheme(theme) {
  currentMapTheme = theme;
  if (map.getLayer('peba-punti-circle')) {
    map.setPaintProperty('peba-punti-circle', 'circle-color', theme === 'gruppo' ? RAMP_GRUPPO : RAMP_LIVELLO);
  }
  if (map.getLayer('rete-archi-peba-line')) {
    map.setPaintProperty('rete-archi-peba-line', 'line-color', theme === 'gruppo' ? RAMP_GRUPPO_VIA : RAMP_LIVELLO_VIA);
  }
  if (typeof window.pf3dRefreshVie === 'function') window.pf3dRefreshVie();
  if (typeof window.pf3dRefreshMarkers === 'function') window.pf3dRefreshMarkers();
}
window.setMapTheme = setMapTheme;

// Nome via/piazza (maiuscolo) → Livello accessibilità dell'immobile-percorso PEBA
// corrispondente. Un percorso (es. "VIA MAGIONE - VIA DELLA PACE - ...") copre più
// vie: ogni componente eredita il livello dell'intero percorso.
const NOME_TO_LIVELLO = {};
function indicizzaLivelloVie(pebaGeo) {
  pebaGeo.features.forEach((f) => {
    const p = f.properties;
    const loc = p['Nome/Localizzazione'] || '';
    loc.split(' - ').forEach((parte) => {
      const chiave = parte.trim().toUpperCase();
      if (chiave) NOME_TO_LIVELLO[chiave] = p['Livello accessibilita'];
    });
  });
}

map.on('load', () => {
  fetch(DATA.peba).then((r) => r.json()).then((pebaGeo) => {
    indicizzaLivelloVie(pebaGeo);

    // ── Immobili PEBA — sorgente piccola (144 KB), caricata subito ──────────
    map.addSource('peba-punti', { type: 'geojson', data: pebaGeo });
    map.addLayer({
      id: 'peba-punti-circle', type: 'circle', source: 'peba-punti',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9],
        'circle-color': RAMP_LIVELLO,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
        'circle-stroke-opacity': 1,
      },
    });

    updateMapScale();

    // ── Rete stradale — sorgente grande (~7.7 MB), differita dopo il primo
    // rendering per non contendere banda/priorità col caricamento dei punti ──
    map.once('idle', () => {
      if (map.getSource('rete-archi')) return;
      fetch(DATA.reteArchi).then((r) => r.json()).then((reteGeo) => {
        reteGeo.features.forEach((f) => {
          const p = f.properties;
          if (p.peba_via) {
            const chiave = (p.nome || '').trim().toUpperCase();
            p.livello_via = NOME_TO_LIVELLO[chiave] || 'Non valutabile';
          }
        });
        map.addSource('rete-archi', { type: 'geojson', data: reteGeo });
        window.PF_VIE_PEBA = reteGeo.features.filter((f) => f.properties.peba_via);
        if (typeof window.pf3dRefreshVie === 'function') window.pf3dRefreshVie();

        // Rete stradale — sfondo di riferimento, non interattiva
        map.addLayer({
          id: 'rete-archi-line', type: 'line', source: 'rete-archi',
          filter: ['!=', ['get', 'peba_via'], true],
          layout: { 'line-cap': 'round' },
          paint: {
            'line-color': '#9aa5c4',
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 1.6],
            'line-opacity': 0,
          },
        }, 'peba-punti-circle');

        // Vie/percorsi PEBA — colorate come i punti, per gruppo o livello di accessibilità
        map.addLayer({
          id: 'rete-archi-peba-line', type: 'line', source: 'rete-archi',
          filter: ['==', ['get', 'peba_via'], true],
          layout: { 'line-cap': 'round' },
          paint: {
            'line-color': currentMapTheme === 'gruppo' ? RAMP_GRUPPO_VIA : RAMP_LIVELLO_VIA,
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 16, 4],
            'line-opacity': 0.9,
          },
        }, 'peba-punti-circle');
      });
    });
  });
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

// Schiarisce un colore brand finché non raggiunge un contrasto WCAG AA (4.5:1)
// sullo sfondo scuro del pannello (#0a1022). I colori brand sono tarati per il
// tema chiaro: su sfondo quasi nero molti scendono sotto 3:1 senza questo aggiustamento.
const DARK_PANEL_BG = [10, 16, 34];
function relLuminance([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(rgb1, rgb2) {
  const l1 = relLuminance(rgb1), l2 = relLuminance(rgb2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}
const _darkColorCache = {};
function darkThemeSafeColor(hex) {
  if (_darkColorCache[hex]) return _darkColorCache[hex];
  let rgb = hexToRgb(hex);
  for (let i = 0; i < 40 && contrastRatio(rgb, DARK_PANEL_BG) < 4.5; i++) {
    rgb = rgb.map((c) => c + (255 - c) * 0.06);
  }
  const result = rgbToHex(rgb);
  _darkColorCache[hex] = result;
  return result;
}
function badgeTextColor(hex) {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? darkThemeSafeColor(hex) : hex;
}

function badgeColori(livello) {
  const col = COLORI_ACCESSIBILITA[livello] || COLORI_ACCESSIBILITA['Non valutabile'];
  return { bg: `${col}22`, text: badgeTextColor(col), border: `${col}88` };
}

function badgeColoriGruppo(gruppo) {
  const col = COLORI_GRUPPO[gruppo] || '#999999';
  return { bg: `${col}22`, text: badgeTextColor(col), border: `${col}88` };
}

// Barra orizzontale del punteggio (0-100), colorata come il badge livello
function rpScoreBar(value, colorHex) {
  const wrap = document.createElement('div'); wrap.className = 'rp-score-bar';
  const track = document.createElement('div'); track.className = 'rp-score-bar-track';
  const fill = document.createElement('div'); fill.className = 'rp-score-bar-fill';
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  fill.style.background = colorHex;
  track.appendChild(fill);
  wrap.appendChild(track);
  return wrap;
}

// Lista puntata delle criticità (il campo dato è testo con voci separate da ";")
function rpCriticitaList(testo) {
  const voci = testo.split(';').map((v) => v.trim()).filter(Boolean);
  const ul = document.createElement('ul'); ul.className = 'rp-crit-list';
  voci.forEach((v) => {
    const li = document.createElement('li');
    li.textContent = v;
    ul.appendChild(li);
  });
  return ul;
}

// Galleria foto: img/foto/<Codice>/01.{jpg|png} .. NN (NN = "N. foto rilievo")
function rpGalleriaFoto(codice, nFoto) {
  if (!nFoto || nFoto <= 0) return null;
  const s = rpSec(`Foto sopralluogo (${nFoto})`);
  const grid = document.createElement('div');
  grid.className = 'rp-photo-grid';
  const srcs = [];
  for (let i = 1; i <= nFoto; i++) {
    const num = String(i).padStart(2, '0');
    const base = `img/foto/${encodeURIComponent(codice)}/${num}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = i === 1 ? 'rp-photo-thumb rp-photo-thumb-cover' : 'rp-photo-thumb';
    const full = `${base}.jpg`;
    srcs[i - 1] = full;
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = `Foto ${i} — ${esc(codice)}`;
    img.dataset.tried = 'thumb';
    img.src = `${base}_thumb.jpg`;
    img.onerror = () => {
      if (img.dataset.tried === 'thumb') {
        img.dataset.tried = 'jpg';
        img.src = full;
      } else if (img.dataset.tried === 'jpg') {
        img.dataset.tried = 'png';
        img.src = `${base}.png`;
      } else {
        btn.remove();
      }
    };
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
  const colGruppo = COLORI_GRUPPO[f.properties.Gruppo] || '#999999';
  const livello = f.properties['Livello accessibilita'];
  const colLivello = badgeColori(livello);
  const badgeHtml = livello
    ? `<span class="mp-badge" style="background:${colLivello.bg};color:${colLivello.text};border-color:${colLivello.border};">${esc(livello)}</span>`
    : '';
  hoverPopup.setLngLat(e.lngLat).setHTML(`
    <div class="mp-title"><span class="mp-dot" style="background:${colGruppo};"></span>${label}</div>
    ${badgeHtml}
  `).addTo(map);
});
map.on('mouseleave', 'peba-punti-circle', () => { hoverPopup.remove(); });

// Media punteggio della circoscrizione di p, calcolata sui punti già caricati per la ricerca (PF_FEATURES, filters.js)
function mediaPunteggioCircoscrizione(circoscrizione) {
  if (!circoscrizione || typeof PF_FEATURES === 'undefined' || !PF_FEATURES.length) return null;
  const vals = PF_FEATURES
    .map((f) => f.p)
    .filter((pp) => pp.Circoscrizione === circoscrizione && pp.Punteggio != null)
    .map((pp) => pp.Punteggio);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function showPebaDetail(p, lngLat) {
  const anagrafica = rpSec('Anagrafica');
  if (p.Codice) anagrafica.appendChild(rpBadgeRow('Codice', esc(p.Codice), badgeColoriGruppo(p.Gruppo)));
  anagrafica.appendChild(rpRow('Nome', esc(p['Nome Immobile']) || esc(p.Gruppo) || '(senza nome)'));
  anagrafica.appendChild(rpRow('Indirizzo', esc(p.Indirizzo) || esc(p['Nome/Localizzazione'])));
  anagrafica.appendChild(rpRow('Gruppo', esc(p.Gruppo)));
  if (p.Categoria) anagrafica.appendChild(rpRow('Categoria', esc(p.Categoria)));
  if (p['Contesto urbano']) anagrafica.appendChild(rpRow('Contesto urbano', esc(p['Contesto urbano'])));
  if (p.Elemento) anagrafica.appendChild(rpRow('Elemento', esc(p.Elemento)));

  const territorio = rpSec('Territorio');
  if (p.Circoscrizione) territorio.appendChild(rpRow('Circoscrizione', esc(p.Circoscrizione)));
  if (p.Quartiere) territorio.appendChild(rpRow('Quartiere', esc(p.Quartiere)));
  if (p.UPL) territorio.appendChild(rpRow('UPL', esc(p.UPL)));

  const accessibilita = rpSec('Accessibilità');
  accessibilita.appendChild(rpBadgeRow('Livello', esc(p['Livello accessibilita']) || 'non valutabile', badgeColori(p['Livello accessibilita'])));
  accessibilita.appendChild(rpRow('Punteggio di inaccessibilità', p.Punteggio != null ? `${fmtNum(p.Punteggio, 0)} / 100` : 'n/d'));
  if (p.Punteggio != null) {
    const col = COLORI_ACCESSIBILITA[p['Livello accessibilita']] || COLORI_ACCESSIBILITA['Non valutabile'];
    accessibilita.appendChild(rpScoreBar(p.Punteggio, badgeTextColor(col)));
  }
  if (p.Rilevanza) accessibilita.appendChild(rpRow('Rilevanza', esc(p.Rilevanza)));
  if (p['Non valutabile'] === 'Si') {
    accessibilita.appendChild(rpBadgeRow('Dato', 'Non valutabile', { bg: '#99999922', text: '#666', border: '#99999988' }));
  }
  const media = mediaPunteggioCircoscrizione(p.Circoscrizione);
  if (media != null && p.Punteggio != null) {
    const diff = p.Punteggio - media;
    const segno = diff >= 0 ? '+' : '';
    accessibilita.appendChild(rpRow(`Media circ. ${esc(p.Circoscrizione)}`, `${fmtNum(media, 0)} (${segno}${fmtNum(diff, 0)})`));
  }

  const sections = [anagrafica, territorio, accessibilita];

  if (p['Criticità Rilevate']) {
    const crit = rpSec('Criticità rilevate');
    crit.appendChild(rpCriticitaList(p['Criticità Rilevate']));
    sections.push(crit);
  }

  const linkPdf = rpLinkPdf(p.Codice);
  if (linkPdf) sections.push(linkPdf);

  const foto = rpGalleriaFoto(p.Codice, p['N. foto rilievo']);
  if (foto) sections.push(foto);

  const iconEl = document.getElementById('rp-punto-icon');
  if (iconEl) {
    iconEl.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${rpIconePerGruppo(p.Gruppo)}</svg>`;
  }
  updateSchedaUrl(p.Codice || null);

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
    if (key === 'satellite' && typeof window.pf3dDisable === 'function') window.pf3dDisable();
  }
  renderBasemaps();
});

window.pfDeactivateSatellite = function () {
  const idx = activeBasemaps.indexOf('satellite');
  if (idx === -1) return;
  activeBasemaps.splice(idx, 1);
  const btn = document.querySelector('#tb-basemaps [data-basemap="satellite"]');
  if (btn) btn.classList.remove('active');
  if (activeBasemaps.length === 0) {
    activeBasemaps.push('osm');
    const osmBtn = document.querySelector('#tb-basemaps [data-basemap="osm"]');
    if (osmBtn) osmBtn.classList.add('active');
  }
  renderBasemaps();
};

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

// ── Toolbar: tema colore mappa + legenda (livello / gruppo, esclusivi) ────
document.getElementById('tb-theme').addEventListener('click', (e) => {
  const btn = e.target.closest('.tb-radio');
  if (!btn || btn.classList.contains('active')) return;
  document.querySelectorAll('#tb-theme .tb-radio').forEach((b) => b.classList.toggle('active', b === btn));
  const theme = btn.dataset.theme;
  setMapTheme(theme);
  if (window.pfBuildLegend) window.pfBuildLegend(theme);
});

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

// ── Tema scuro (attivato dall'inline script in <body>, qui solo il toggle) ─
(function initDarkToggle() {
  const btn = document.getElementById('tb-dark');
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  btn.classList.toggle('active', isDark());
  btn.addEventListener('click', () => {
    const on = !isDark();
    if (on) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('peba-theme', on ? 'dark' : 'light');
    btn.classList.toggle('active', on);

    // La mappa base OSM è tile CartoDB: passa da light_all a dark_all.
    // È una raster source, va ricreata (il tile url non è modificabile in place).
    BASEMAPS.osm.tiles = on ? OSM_TILES_DARK : OSM_TILES_LIGHT;
    if (map.getLayer('basemap-osm-layer')) map.removeLayer('basemap-osm-layer');
    if (map.getSource('basemap-osm')) map.removeSource('basemap-osm');
    if (map.isStyleLoaded()) renderBasemaps();
  });
})();

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
