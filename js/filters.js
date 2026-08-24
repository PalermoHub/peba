// ════════════════════════════════════════════════════════════════════════
// Filtri intelligenti e interconnessi: Circoscrizione → Quartiere → UPL,
// Gruppo, Livello accessibilità, ricerca testuale. Ogni dimensione ricalcola
// le opzioni disponibili nelle altre in base ai filtri già attivi
// (comprese le voci di legenda, che funzionano anch'esse da filtro).
// ════════════════════════════════════════════════════════════════════════

let PF_FEATURES = []; // [{ p: properties, lng, lat }]

const pfState = {
  circ: '', quart: '', upl: '',
  gruppo: new Set(),
  livello: new Set(),
  rilevanza: new Set(),
  classe: new Set(),
  q: '',
};

const GRUPPO_ORDER = [
  'Percorso storico', 'Via cittadina', 'Scuola', 'Asilo',
  'Sede amministrativa/istituzionale', 'Area verde',
  'Sito UNESCO (edificio)', 'Percorso UNESCO', 'Piazza', 'Museo',
];
const LIVELLO_ORDER = [
  'Accessibile', 'Parzialmente accessibile', 'Parzialmente inaccessibile',
  'Inaccessibile', 'Non valutabile',
];
const RILEVANZA_ORDER = ['Alta', 'Bassa'];
const RILEVANZA_COLORS = { 'Alta': '#dc2626', 'Bassa': '#6b7280' };

// Classe priorità: ordinate per urgenza decrescente (vedi classePriorita in map.js)
const CLASSE_ORDER = ['4', '3', '2', '1', '8', '7', '6', '5'];
const CLASSE_LIVELLO = {
  '4': 'Inaccessibile', '3': 'Parzialmente inaccessibile', '2': 'Parzialmente accessibile', '1': 'Accessibile',
  '8': 'Inaccessibile', '7': 'Parzialmente inaccessibile', '6': 'Parzialmente accessibile', '5': 'Accessibile',
};
const CLASSE_LABELS = Object.fromEntries(CLASSE_ORDER.map((c) => [c, `Classe ${c}`]));
const CLASSE_COLORS = Object.fromEntries(CLASSE_ORDER.map((c) => [c, COLORI_ACCESSIBILITA[CLASSE_LIVELLO[c]]]));

// ── Match per dimensione, esclude eventualmente una o più dimensioni ─────
function pfPasses(p, except) {
  const skip = (d) => except.includes(d);
  if (!skip('circ')  && pfState.circ  && p.Circoscrizione !== pfState.circ)  return false;
  if (!skip('quart') && pfState.quart && p.Quartiere      !== pfState.quart) return false;
  if (!skip('upl')   && pfState.upl   && p.UPL            !== pfState.upl)   return false;
  if (!skip('gruppo')  && pfState.gruppo.size  && !pfState.gruppo.has(p.Gruppo)) return false;
  if (!skip('livello') && pfState.livello.size && !pfState.livello.has(p['Livello accessibilita'])) return false;
  if (!skip('rilevanza') && pfState.rilevanza.size && !pfState.rilevanza.has(p.Rilevanza)) return false;
  if (!skip('classe') && pfState.classe.size && !pfState.classe.has(p._classePriorita)) return false;
  if (!skip('q') && pfState.q) {
    const hay = `${p['Nome Immobile'] || ''} ${p.Indirizzo || ''} ${p.Codice || ''}`.toLowerCase();
    if (!hay.includes(pfState.q)) return false;
  }
  return true;
}
const pfMatchesAll = (p) => pfPasses(p, []);

// ── Popolamento select cascading (interconnesse su tutte le dimensioni) ──
function pfPopulateSelect(selectEl, dimKey, propKey, allLabel) {
  const counts = new Map();
  PF_FEATURES.forEach(({ p }) => {
    if (!pfPasses(p, [dimKey])) return;
    const v = p[propKey];
    if (!v) return;
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const values = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'it'));
  const current = pfState[dimKey];
  selectEl.innerHTML = `<option value="">${allLabel}</option>` +
    values.map((v) => `<option value="${esc(v)}">${esc(v)} (${counts.get(v)})</option>`).join('');
  if (current && counts.has(current)) {
    selectEl.value = current;
  } else if (current) {
    pfState[dimKey] = '';
    selectEl.value = '';
  }
}

// ── Chipset (Gruppo / Livello / Rilevanza / Classe): checkbox multiple con conteggio live ─
function pfBuildChipset(container, dimKey, propKey, order, colorMap, labelMap) {
  container.innerHTML = order.map((v) => `
    <button type="button" class="pf-chip-opt" data-dim="${dimKey}" data-value="${esc(v)}">
      <span class="pf-chip-dot" style="background:${(colorMap && colorMap[v]) || '#999'}"></span>
      <span class="pf-chip-lbl">${esc((labelMap && labelMap[v]) || v)}</span>
      <span class="pf-chip-cnt"></span>
    </button>
  `).join('');
  container.querySelectorAll('.pf-chip-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const set = pfState[dimKey];
      const v = btn.dataset.value;
      if (set.has(v)) set.delete(v); else set.add(v);
      pfRenderAll();
    });
  });
}

function pfUpdateChipset(container, dimKey, propKey) {
  const counts = new Map();
  PF_FEATURES.forEach(({ p }) => {
    if (!pfPasses(p, [dimKey])) return;
    const v = p[propKey];
    if (!v) return;
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  container.querySelectorAll('.pf-chip-opt').forEach((btn) => {
    const v = btn.dataset.value;
    const n = counts.get(v) || 0;
    btn.querySelector('.pf-chip-cnt').textContent = n;
    btn.classList.toggle('active', pfState[dimKey].has(v));
    btn.classList.toggle('empty', n === 0);
  });
}

// ── Legenda sulla mappa (livello o gruppo): raddoppia da filtro ──────────
const LEGEND_DIMS = {
  livello: {
    propKey: 'Livello accessibilita', order: LIVELLO_ORDER, colors: COLORI_ACCESSIBILITA, title: 'Accessibilità',
    labels: {
      'Accessibile': 'accessibile',
      'Parzialmente accessibile': 'parzialmente accessibile',
      'Parzialmente inaccessibile': 'parzialmente inaccessibile',
      'Inaccessibile': 'inaccessibile',
      'Non valutabile': 'non valutabile',
    },
  },
  gruppo: { propKey: 'Gruppo', order: GRUPPO_ORDER, colors: COLORI_GRUPPO, title: 'Gruppo' },
};
let legendDim = 'livello';

function pfBuildLegend(dim) {
  legendDim = dim;
  const cfg = LEGEND_DIMS[dim];
  const colors = dim === 'gruppo' ? coloriGruppoAttivi() : cfg.colors;
  const rowsEl = document.getElementById('legend-rows');
  const titleEl = document.getElementById('legend-gruppo-toggle');
  const cbfBtn = dim === 'gruppo'
    ? `<button type="button" id="legend-cbf-toggle" class="legend-cbf-btn${isGruppoPaletteCBF() ? ' active' : ''}" title="Palette alternativa per daltonici">Daltonici</button>`
    : '';
  titleEl.innerHTML = `<span class="legend-title-txt"><span class="legend-toggle-arrow">▾</span>${esc(cfg.title)} <span class="map-legend-hint">(clic per filtrare)</span></span>${cbfBtn}`;
  rowsEl.innerHTML = cfg.order.map((v) => `
    <div class="legend-row" data-dim="${dim}" data-value="${esc(v)}"><span class="legend-dot" style="background:${colors[v] || '#999999'}"></span><span class="legend-label">${esc((cfg.labels && cfg.labels[v]) || v)}</span><span class="legend-count"></span></div>
  `).join('');
  rowsEl.querySelectorAll('.legend-row[data-dim]').forEach((row) => {
    row.addEventListener('click', () => {
      const d = row.dataset.dim;
      const v = row.dataset.value;
      const set = pfState[d];
      if (set.has(v)) set.delete(v); else set.add(v);
      pfRenderAll();
      pfZoomToMatched();
    });
  });
  const cbfEl = document.getElementById('legend-cbf-toggle');
  if (cbfEl) {
    cbfEl.addEventListener('click', (e) => {
      e.stopPropagation();
      pfToggleGruppoPalette();
    });
  }
  pfUpdateLegend();
}
window.pfBuildLegend = pfBuildLegend;

// ── Switch palette "Gruppo" ufficiale ↔ daltonica: ricostruisce legenda e
// chipset filtro con i nuovi colori (la mappa/3D si aggiornano da soli via
// setGruppoPaletteCBF, definita in map.js) ────────────────────────────────
function pfToggleGruppoPalette() {
  setGruppoPaletteCBF(!isGruppoPaletteCBF());
  pfBuildChipset(document.getElementById('pf-gruppo-set'), 'gruppo', 'Gruppo', GRUPPO_ORDER, coloriGruppoAttivi());
  if (legendDim === 'gruppo') pfBuildLegend('gruppo');
  pfRenderAll();
}

function pfUpdateLegend() {
  const cfg = LEGEND_DIMS[legendDim];
  document.querySelectorAll('#map-legends .legend-row[data-dim]').forEach((row) => {
    const dim = row.dataset.dim;
    const val = row.dataset.value;
    const count = PF_FEATURES.filter(({ p }) => pfPasses(p, [dim]) && p[cfg.propKey] === val).length;
    const countEl = row.querySelector('.legend-count');
    if (countEl) countEl.textContent = `(${count})`;
    const active = pfState[dim].has(val);
    row.classList.toggle('active', active);
    row.classList.toggle('dimmed', pfState[dim].size > 0 && !active);
    row.classList.toggle('empty', count === 0);
  });
}

// ── Chip attivi (barra di ricerca) ────────────────────────────────────────
function pfUpdateChips() {
  const chipsEl = document.getElementById('pf-chips');
  const badge = document.getElementById('pf-filter-badge');
  const btn = document.getElementById('pf-filter-btn');
  const active = [];
  if (pfState.circ)  active.push({ label: pfState.circ,  clear: () => { pfState.circ = ''; } });
  if (pfState.quart) active.push({ label: pfState.quart, clear: () => { pfState.quart = ''; } });
  if (pfState.upl)   active.push({ label: pfState.upl,   clear: () => { pfState.upl = ''; } });
  pfState.gruppo.forEach((v)  => active.push({ label: v, clear: () => pfState.gruppo.delete(v) }));
  pfState.livello.forEach((v) => active.push({ label: v, clear: () => pfState.livello.delete(v) }));
  pfState.rilevanza.forEach((v) => active.push({ label: `Rilevanza ${v}`, clear: () => pfState.rilevanza.delete(v) }));
  pfState.classe.forEach((v)    => active.push({ label: CLASSE_LABELS[v] || v, clear: () => pfState.classe.delete(v) }));
  if (pfState.q) active.push({ label: `“${pfState.q}”`, clear: () => { pfState.q = ''; document.getElementById('pf-search-input').value = ''; } });

  badge.style.display = active.length ? 'flex' : 'none';
  badge.textContent = active.length;
  btn.classList.toggle('active', active.length > 0);

  chipsEl.style.display = active.length ? 'flex' : 'none';
  chipsEl.innerHTML = active.map((f, i) => `
    <span class="pf-chip">${esc(f.label)}<button class="pf-chip-close" data-i="${i}">✕</button></span>
  `).join('') + (active.length > 1 ? `<button class="pf-chip pf-chip-resetall" id="pf-chips-resetall">✕ tutti</button>` : '');

  chipsEl.querySelectorAll('.pf-chip-close').forEach((b) => {
    b.addEventListener('click', () => { active[+b.dataset.i].clear(); pfRenderAll(); });
  });
  const ra = document.getElementById('pf-chips-resetall');
  if (ra) ra.addEventListener('click', pfResetAll);
}

// ── Applica filtro al layer mappa + contatore risultati ───────────────────
function pfApplyMapFilter() {
  const matched = PF_FEATURES.filter(({ p }) => pfMatchesAll(p));
  const codes = matched.map(({ p }) => p.Codice);
  const filterExpr = codes.length
    ? ['in', ['get', 'Codice'], ['literal', codes]]
    : ['==', ['get', 'Codice'], '__nessuno__'];
  ['peba-punti-circle', 'peba-edifici-fill', 'peba-edifici-outline', 'peba-aree-verdi-fill', 'peba-aree-verdi-outline'].forEach((id) => {
    if (map.getLayer(id)) map.setFilter(id, filterExpr);
  });
  const rc = document.getElementById('pf-result-count');
  if (rc) rc.textContent = `${matched.length} di ${PF_FEATURES.length} immobili`;
  const zoomBtn = document.getElementById('pf-zoom');
  if (zoomBtn) zoomBtn.disabled = matched.length === 0;
  pfLastMatched = matched;
  if (typeof window.pf3dRefreshMarkers === 'function') window.pf3dRefreshMarkers();
}
let pfLastMatched = [];

// ── Zoom automatico sugli immobili filtrati ────────────────────────────────
function pfZoomToMatched() {
  if (!pfLastMatched.length) return;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  pfLastMatched.forEach(({ lng, lat }) => {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  });
  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 17 });
  if (typeof window.pf3dZoomToMatched === 'function') window.pf3dZoomToMatched();
}

// ── Render completo (chiamato ad ogni cambio stato) ───────────────────────
function pfRenderAll() {
  pfPopulateSelect(document.getElementById('pf-circ'),  'circ',  'Circoscrizione', '— Tutte —');
  pfPopulateSelect(document.getElementById('pf-quart'), 'quart', 'Quartiere',      '— Tutti —');
  pfPopulateSelect(document.getElementById('pf-upl'),   'upl',   'UPL',            '— Tutte —');
  pfUpdateChipset(document.getElementById('pf-gruppo-set'),  'gruppo',  'Gruppo');
  pfUpdateChipset(document.getElementById('pf-livello-set'), 'livello', 'Livello accessibilita');
  pfUpdateChipset(document.getElementById('pf-rilevanza-set'), 'rilevanza', 'Rilevanza');
  pfUpdateChipset(document.getElementById('pf-classe-set'), 'classe', '_classePriorita');
  pfUpdateLegend();
  pfUpdateChips();
  pfApplyMapFilter();
  if (typeof window.pfBuildStatisticheTab === 'function') window.pfBuildStatisticheTab();
}

function pfResetAll() {
  pfState.circ = ''; pfState.quart = ''; pfState.upl = '';
  pfState.gruppo.clear(); pfState.livello.clear();
  pfState.rilevanza.clear(); pfState.classe.clear();
  pfState.q = '';
  const si = document.getElementById('pf-search-input');
  if (si) si.value = '';
  document.getElementById('pf-search-clear').style.display = 'none';
  pfRenderAll();
}

// ── Ricerca testuale + suggerimenti immobili ──────────────────────────────
function pfRenderSuggestions(query) {
  const dd = document.getElementById('pf-search-dd');
  const q = query.trim().toLowerCase();
  if (!q) { dd.classList.remove('open'); dd.innerHTML = ''; return; }
  const matches = PF_FEATURES.filter(({ p }) =>
    (p['Nome Immobile'] || '').toLowerCase().includes(q) ||
    (p.Indirizzo || '').toLowerCase().includes(q)
  ).slice(0, 8);
  if (!matches.length) {
    dd.innerHTML = `<div class="pf-dd-empty">Nessun risultato per &ldquo;${esc(query)}&rdquo;</div>`;
    dd.classList.add('open');
    return;
  }
  dd.innerHTML = matches.map(({ p }, i) => `
    <div class="pf-dd-item" data-i="${i}">
      <span class="pf-dd-name">${esc(p['Nome Immobile'] || '(senza nome)')}</span>
      <span class="pf-dd-badge">${esc(p.Gruppo || '')}</span>
    </div>
  `).join('');
  dd.classList.add('open');
  dd.querySelectorAll('.pf-dd-item').forEach((el) => {
    el.addEventListener('click', () => {
      const m = matches[+el.dataset.i];
      map.flyTo({ center: [m.lng, m.lat], zoom: Math.max(map.getZoom(), 16) });
      window.showPebaDetail(m.p, { lat: m.lat, lng: m.lng });
      dd.classList.remove('open');
      document.getElementById('pf-search-input').value = '';
      document.getElementById('pf-search-clear').style.display = 'none';
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────
fetch(DATA.peba).then((r) => r.json()).then((geo) => {
  PF_FEATURES = geo.features.map((f) => {
    const p = f.properties;
    const classe = classePriorita(p);
    p._classePriorita = classe != null ? String(classe) : null;
    return { p, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
  });
  window.tryBuildTerritorioTab && window.tryBuildTerritorioTab();

  pfBuildChipset(document.getElementById('pf-gruppo-set'),  'gruppo',  'Gruppo', GRUPPO_ORDER, coloriGruppoAttivi());
  pfBuildChipset(document.getElementById('pf-livello-set'), 'livello', 'Livello accessibilita', LIVELLO_ORDER, COLORI_ACCESSIBILITA);
  pfBuildChipset(document.getElementById('pf-rilevanza-set'), 'rilevanza', 'Rilevanza', RILEVANZA_ORDER, RILEVANZA_COLORS);
  pfBuildChipset(document.getElementById('pf-classe-set'), 'classe', '_classePriorita', CLASSE_ORDER, CLASSE_COLORS, CLASSE_LABELS);
  pfBuildLegend('livello');

  const start = () => { pfRenderAll(); };
  if (map.loaded()) start(); else map.on('load', start);

  // Permalink: ?scheda=Codice apre direttamente la scheda corrispondente
  const codiceUrl = new URLSearchParams(window.location.search).get('scheda');
  if (codiceUrl) {
    const match = PF_FEATURES.find((f) => f.p.Codice === codiceUrl);
    if (match) {
      const openScheda = () => {
        map.flyTo({ center: [match.lng, match.lat], zoom: Math.max(map.getZoom(), 16) });
        window.showPebaDetail(match.p, { lat: match.lat, lng: match.lng });
      };
      if (map.loaded()) openScheda(); else map.on('load', openScheda);
    }
  }

  // Select cascading
  ['circ', 'quart', 'upl'].forEach((dim) => {
    const propKey = dim === 'circ' ? 'Circoscrizione' : dim === 'quart' ? 'Quartiere' : 'UPL';
    document.getElementById(`pf-${dim}`).addEventListener('change', (e) => {
      pfState[dim] = e.target.value;
      pfRenderAll();
    });
  });

  // Ricerca
  const searchInput = document.getElementById('pf-search-input');
  const searchClear = document.getElementById('pf-search-clear');
  searchInput.addEventListener('input', () => {
    searchClear.style.display = searchInput.value ? '' : 'none';
    pfState.q = searchInput.value.trim().toLowerCase();
    pfRenderSuggestions(searchInput.value);
    pfRenderAll();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = ''; searchClear.style.display = 'none';
    pfState.q = '';
    document.getElementById('pf-search-dd').classList.remove('open');
    pfRenderAll();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#pf-searchbar')) document.getElementById('pf-search-dd').classList.remove('open');
  });

  // Modale filtri
  const modal = document.getElementById('pf-modal');
  const overlay = document.getElementById('pf-overlay');
  const openModal = () => { modal.classList.add('open'); overlay.classList.add('open'); };
  const closeModal = () => { modal.classList.remove('open'); overlay.classList.remove('open'); };
  document.getElementById('pf-filter-btn').addEventListener('click', openModal);
  document.getElementById('pf-modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  document.getElementById('pf-reset').addEventListener('click', pfResetAll);

  document.getElementById('pf-zoom').addEventListener('click', pfZoomToMatched);

  // Legenda collassabile su mobile (aperta di default su desktop)
  const legendGruppo = document.getElementById('legend-gruppo');
  const legendToggle = document.getElementById('legend-gruppo-toggle');
  if (window.matchMedia('(max-width: 640px)').matches) legendGruppo.classList.add('collapsed');
  legendToggle.addEventListener('click', () => legendGruppo.classList.toggle('collapsed'));
});
