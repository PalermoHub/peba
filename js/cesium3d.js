// Vista 3D come base map alternativa a schermo intero: Google Photorealistic 3D Tiles
// + marker/etichetta per ogni punto PEBA (PF_FEATURES, filters.js).
// Toggle da toolbar (#tb-3d): nasconde #map (MapLibre), mostra #cesium-container.
(function () {
  const container = document.getElementById('cesium-container');
  const statusEl = document.getElementById('cesium-status');
  const mapEl = document.getElementById('map');
  const toggleBtn = document.getElementById('tb-3d');
  if (!container || !toggleBtn) return;

  const token = window.CESIUM_ION_TOKEN;
  let viewer = null;
  let initPromise = null;
  let active = false;
  const propsByCodice = new Map();
  let markerEntities = [];
  let viaEntities = [];

  function coloreVia(props) {
    if (typeof currentMapTheme !== 'undefined' && currentMapTheme === 'gruppo') {
      return (typeof COLORI_GRUPPO !== 'undefined' && COLORI_GRUPPO[props.peba_tipo]) || '#999999';
    }
    return (typeof COLORI_ACCESSIBILITA !== 'undefined'
      && (COLORI_ACCESSIBILITA[props.livello_via] || COLORI_ACCESSIBILITA['Non valutabile'])) || '#999999';
  }

  function refreshVie() {
    if (!viewer) return;
    viaEntities.forEach((e) => viewer.entities.remove(e));
    viaEntities = [];
    const vie = window.PF_VIE_PEBA || [];
    vie.forEach((f) => {
      const colore = coloreVia(f.properties);
      const segmenti = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
      segmenti.forEach((coords) => {
        if (!coords || coords.length < 2) return;
        const positions = coords.flatMap(([lng, lat]) => [lng, lat]);
        const entity = viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(positions),
            width: 4,
            material: Cesium.Color.fromCssColorString(colore),
            clampToGround: true,
          },
        });
        viaEntities.push(entity);
      });
    });
  }
  window.pf3dRefreshVie = refreshVie;

  // Conversione approssimata zoom (slippy map, stile MapLibre/Google) <-> quota camera Cesium.
  // Correzione coseno-latitudine: la formula base è tarata sull'equatore (dove un tile
  // slippy copre la massima estensione al suolo); a Palermo (~38°N) senza il coseno la
  // quota risulterebbe ~21% troppo alta, cioè lo zoom 3D apparirebbe "più lontano" del 2D.
  const ZOOM_ALTITUDE_K = 591657527.591555;
  function zoomAAltitudine(zoom, latDeg) {
    return (ZOOM_ALTITUDE_K * Math.cos(Cesium.Math.toRadians(latDeg))) / Math.pow(2, zoom);
  }
  function altitudineAZoom(alt, latDeg) {
    return Math.log2((ZOOM_ALTITUDE_K * Math.cos(Cesium.Math.toRadians(latDeg))) / Math.max(alt, 1));
  }

  function coloreMarker(p) {
    if (typeof currentMapTheme !== 'undefined' && currentMapTheme === 'gruppo') {
      return (typeof COLORI_GRUPPO !== 'undefined' && COLORI_GRUPPO[p.Gruppo]) || '#999999';
    }
    return (typeof COLORI_ACCESSIBILITA !== 'undefined'
      && (COLORI_ACCESSIBILITA[p['Livello accessibilita']] || COLORI_ACCESSIBILITA['Non valutabile'])) || '#999999';
  }

  function initViewer() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      Cesium.Ion.defaultAccessToken = token;
      viewer = new Cesium.Viewer('cesium-container', {
        timeline: false, animation: false, homeButton: false,
        sceneModePicker: false, baseLayerPicker: false,
        navigationHelpButton: false, geocoder: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false,
        skyAtmosphere: false,
        // Niente layer immagini di base: coperto interamente dal tileset fotorealistico,
        // ma di default Viewer scarica comunque un layer ion/Bing — banda sprecata che
        // rallenta il caricamento e appesantisce ogni frame.
        imageryProvider: false,
        // Ridisegna solo quando qualcosa cambia (camera, tile) invece che ad ogni frame:
        // con un tileset pesante il render continuo di default è il principale motivo
        // dei frame-drop segnalati in console (requestAnimationFrame handler > 400ms).
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      });
      // Globo reso invisibile via translucency (NON show=false): con show=false
      // Cesium smette di aggiornare i tile del globo, e ScreenSpaceCameraController
      // usa proprio quei tile per calcolare il pivot di orbit/tilt (Globe.pickWorldCoordinates
      // itera this._surface._tilesRenderedThisFrame, vuoto se show=false) — risultato:
      // rotazione e beccheggio smettono di rispondere al trascinamento del mouse.
      // Con alpha=0 il globo resta "attivo" per il picking ma non si vede (coperto dal tileset).
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.frontFaceAlpha = 0;
      viewer.scene.globe.translucency.backFaceAlpha = 0;
      Cesium.RequestScheduler.requestsByServer['tile.googleapis.com:443'] = 18;
      const tileset = await Cesium.createGooglePhotorealistic3DTileset();
      // Caricamento più veloce: tile più grossolani (SSE più alto) e priorità dinamica
      // in base alla distanza dalla camera, invece del default fine/uniforme.
      tileset.maximumScreenSpaceError = 24;
      tileset.dynamicScreenSpaceError = true;
      viewer.scene.primitives.add(tileset);

      // Il binding di default per il beccheggio (tasto centrale, o Ctrl+sinistro) non è
      // scopribile: la mappa 2D qui ha pitch/rotate disattivati (map.js), quindi l'utente
      // arriva al 3D senza alcuna aspettativa pregressa. Uso la convenzione Google Maps/
      // Mapbox — trascinamento con tasto destro — molto più intuitiva col mouse.
      const controller = viewer.scene.screenSpaceCameraController;
      controller.tiltEventTypes = [
        Cesium.CameraEventType.RIGHT_DRAG,
        Cesium.CameraEventType.MIDDLE_DRAG,
        Cesium.CameraEventType.PINCH,
        { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
      ];

      const canvas = viewer.scene.canvas;
      const handler = new Cesium.ScreenSpaceEventHandler(canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.drillPick(click.position);
        for (const obj of picked) {
          const codice = obj.id && obj.id.properties && obj.id.properties.codice && obj.id.properties.codice.getValue();
          if (codice && propsByCodice.has(codice)) {
            const p = propsByCodice.get(codice);
            const pos = obj.id.position.getValue(viewer.clock.currentTime);
            const carto = Cesium.Cartographic.fromCartesian(pos);
            const lngLat = { lng: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) };
            if (typeof window.showPebaDetail === 'function') window.showPebaDetail(p, lngLat);
            return;
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      const tooltipEl = document.getElementById('pf3d-tooltip');
      const canvasRect = () => canvas.getBoundingClientRect();
      handler.setInputAction((movement) => {
        const picked = viewer.scene.drillPick(movement.endPosition, 5);
        const hit = picked.find((obj) => obj.id && obj.id.properties && obj.id.properties.codice);
        canvas.style.cursor = hit ? 'pointer' : '';
        if (!hit || !tooltipEl) { if (tooltipEl) tooltipEl.hidden = true; return; }
        const codice = hit.id.properties.codice.getValue();
        const p = propsByCodice.get(codice);
        if (!p) { tooltipEl.hidden = true; return; }
        const nome = esc(p['Nome Immobile']) || esc(p.Gruppo) || '(senza nome)';
        const label = codice ? `${esc(codice)} – ${nome}` : nome;
        const colGruppo = COLORI_GRUPPO[p.Gruppo] || '#999999';
        const livello = p['Livello accessibilita'];
        const colLivello = badgeColori(livello);
        const badgeHtml = livello
          ? `<span class="mp-badge" style="background:${colLivello.bg};color:${colLivello.text};border-color:${colLivello.border};">${esc(livello)}</span>`
          : '';
        tooltipEl.innerHTML = `
          <div class="mp-title"><span class="mp-dot" style="background:${colGruppo};"></span>${label}</div>
          ${badgeHtml}
        `;
        const rect = canvasRect();
        tooltipEl.style.left = `${rect.left + movement.endPosition.x}px`;
        tooltipEl.style.top = `${rect.top + movement.endPosition.y}px`;
        tooltipEl.hidden = false;
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    })();
    return initPromise;
  }

  function refreshMarkers() {
    if (!viewer) return;
    markerEntities.forEach((e) => viewer.entities.remove(e));
    markerEntities = [];
    propsByCodice.clear();

    const fonte = (typeof pfLastMatched !== 'undefined' && pfLastMatched.length)
      ? pfLastMatched
      : (typeof PF_FEATURES !== 'undefined' ? PF_FEATURES : []);

    fonte.forEach(({ p, lng, lat }, idx) => {
      if (lng == null || lat == null) return;
      const codice = p.Codice || `_${idx}`;
      propsByCodice.set(codice, p);
      const badge = p.Codice || p.Gruppo || '';
      const colore = coloreMarker(p);
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        // CLAMP_TO_GROUND: senza, il punto resta a quota 0 (ellissoide) mentre gli edifici
        // reali dei 3D Tiles svettano sopra — ruotando/inclinando la proiezione screen-space
        // scivola visivamente su un altro edificio anche se la posizione 3D non si è mossa.
        point: {
          pixelSize: 9,
          color: Cesium.Color.fromCssColorString(colore),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: badge,
          font: '700 14px "Titillium Web", sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(colore).withAlpha(0.92),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          pixelOffset: new Cesium.Cartesian2(0, -18),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          // Rimpicciolisce coi grandi zoom-out ma non sparisce mai del tutto
          // (a differenza del vecchio far=3000/scale=0, troppo vicino per una vista città).
          scaleByDistance: new Cesium.NearFarScalar(300, 1.0, 30000, 0.35),
        },
        properties: { codice },
      });
      markerEntities.push(entity);
    });
  }

  function sincronizzaCameraDa2D() {
    if (typeof map === 'undefined') return;
    const center = map.getCenter();
    const altitudine = zoomAAltitudine(map.getZoom(), center.lat);
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, altitudine),
      orientation: {
        heading: Cesium.Math.toRadians(map.getBearing()),
        pitch: Cesium.Math.toRadians(map.getPitch() - 90),
        roll: 0,
      },
    });
  }

  function sincronizzaMappaDa3D() {
    if (typeof map === 'undefined' || !viewer) return;
    const carto = viewer.camera.positionCartographic;
    const zoom = altitudineAZoom(carto.height, Cesium.Math.toDegrees(carto.latitude));
    const pitch = Cesium.Math.toDegrees(viewer.camera.pitch) + 90;
    map.jumpTo({
      center: [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)],
      zoom: Math.max(0, Math.min(22, zoom)),
      bearing: Cesium.Math.toDegrees(viewer.camera.heading),
      pitch: Math.max(0, Math.min(60, pitch)),
    });
  }

  async function enable() {
    if (!token) {
      statusEl.textContent = 'Token Cesium ion mancante: crea js/cesium-config.local.js con window.CESIUM_ION_TOKEN.';
      statusEl.hidden = false;
      return;
    }
    if (typeof window.pfDeactivateSatellite === 'function') window.pfDeactivateSatellite();
    active = true;
    toggleBtn.classList.add('active');
    mapEl.style.display = 'none';
    container.hidden = false;
    statusEl.hidden = false;
    statusEl.textContent = 'Caricamento vista 3D…';
    try {
      await initViewer();
      sincronizzaCameraDa2D();
      refreshMarkers();
      refreshVie();
      viewer.resize();
      if (!window.localStorage.getItem('pf3dHintShown')) {
        statusEl.textContent = 'Trascina col sinistro per ruotare, col destro per inclinare la vista.';
        window.localStorage.setItem('pf3dHintShown', '1');
        setTimeout(() => { statusEl.textContent = ''; statusEl.hidden = true; }, 4000);
      } else {
        statusEl.textContent = '';
        statusEl.hidden = true;
      }
    } catch (err) {
      statusEl.textContent = 'Errore caricamento vista 3D: ' + (err && err.message ? err.message : err);
    }
  }

  function disable() {
    sincronizzaMappaDa3D();
    active = false;
    toggleBtn.classList.remove('active');
    mapEl.style.display = '';
    container.hidden = true;
    statusEl.hidden = true;
    const tooltipEl = document.getElementById('pf3d-tooltip');
    if (tooltipEl) tooltipEl.hidden = true;
    if (typeof map !== 'undefined') map.resize();
  }

  toggleBtn.addEventListener('click', () => { active ? disable() : enable(); });
  window.pf3dDisable = () => { if (active) disable(); };
  window.pf3dRefreshMarkers = refreshMarkers;
})();
