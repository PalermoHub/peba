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

// ── Vista "immobile selezionato" nel pannello destro (click su mappa) ─────
document.getElementById('rp-punto-back').addEventListener('click', () => {
  document.getElementById('rp-punto').style.display = 'none';
  document.getElementById('rp-gallery').style.display = '';
});
