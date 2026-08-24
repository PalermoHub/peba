// ── Apertura/chiusura pannello inferiore (info/crediti) ───────────────────
function panelToggle() {
  document.getElementById('info-panel').classList.toggle('open');
}

// ── Tab pannello inferiore (Info / Metodologia) ────────────────────────────
document.getElementById('panel-nav')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ptab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  document.querySelectorAll('#panel-nav .ptab').forEach(t => t.classList.toggle('active', t === btn));
  document.querySelectorAll('#panel-body .tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
});

// ── Pulsante "torna in cima" nel pannello inferiore ────────────────────────
(function initPanelBackTop() {
  const btn = document.getElementById('panel-back-top');
  if (!btn) return;
  const activePane = () => document.querySelector('#panel-body .tab-pane.active');
  const updateVisibility = () => {
    const pane = activePane();
    btn.classList.toggle('visible', !!pane && pane.scrollTop > 200);
  };
  document.getElementById('panel-body').addEventListener('scroll', updateVisibility, true);
  document.getElementById('panel-nav')?.addEventListener('click', () => setTimeout(updateVisibility, 0));
  btn.addEventListener('click', () => {
    activePane()?.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ── Apertura/chiusura pannello destro (dettaglio immobile) ────────────────
(function initRightPanel() {
  const rpWrap = document.getElementById('rp-wrap');
  const rpToggle = document.getElementById('rp-toggle');
  if (!rpWrap || !rpToggle) return;
  let open = window.innerWidth >= 640;
  if (open) rpWrap.classList.add('open');
  rpToggle.addEventListener('click', () => {
    open = !open;
    rpWrap.classList.toggle('open', open);
  });
  window.openRightPanel = () => {
    open = true;
    rpWrap.classList.add('open');
  };
  window.closeRightPanel = () => {
    open = false;
    rpWrap.classList.remove('open');
  };
  document.getElementById('rp-mobile-close')?.addEventListener('click', window.closeRightPanel);
})();

// ── Tab pannello destro: "Scheda" (gallery/immobile) vs "Statistiche" ─────
let rpSchedaSubview = 'gallery'; // 'gallery' | 'punto'
function rpApplyView(view) {
  document.querySelectorAll('#rp-nav .rp-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('rp-gallery').style.display = (view === 'scheda' && rpSchedaSubview === 'gallery') ? '' : 'none';
  document.getElementById('rp-punto').style.display = (view === 'scheda' && rpSchedaSubview === 'punto') ? '' : 'none';
  document.getElementById('rp-stats').style.display = view === 'stats' ? '' : 'none';
  document.getElementById('rp-filtri').style.display = view === 'filtri' ? '' : 'none';
  if (view === 'stats' && typeof window.pfBuildStatisticheTab === 'function') window.pfBuildStatisticheTab();
}
window.rpShowScheda = (subview) => { rpSchedaSubview = subview; rpApplyView('scheda'); };
window.rpShowFiltri = () => {
  rpApplyView('filtri');
  if (typeof window.openRightPanel === 'function') window.openRightPanel();
};
document.getElementById('rp-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.rp-tab');
  if (!btn) return;
  rpApplyView(btn.dataset.view);
  if (typeof window.openRightPanel === 'function') window.openRightPanel();
});

// ── Vista "immobile selezionato" nel pannello destro (click su mappa) ─────
document.getElementById('rp-punto-back').addEventListener('click', () => {
  window.rpShowScheda('gallery');
  if (typeof window.updateSchedaUrl === 'function') window.updateSchedaUrl(null);
});
