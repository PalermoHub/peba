// Vista 3D come base map alternativa a schermo intero: Google Photorealistic 3D Tiles
// + marker/etichetta per ogni punto PEBA (PF_FEATURES, filters.js).
// Toggle da toolbar (#tb-3d): nasconde #map (MapLibre), mostra #cesium-container.
(function () {
  const container = document.getElementById('cesium-container');
  const statusEl = document.getElementById('cesium-status');
  const mapEl = document.getElementById('map');
  const toggleBtn = document.getElementById('tb-3d');
  const poligoniBtn = document.getElementById('tb-poligoni');
  const navEl = document.getElementById('pf3d-nav');
  const compassEl = document.getElementById('pf3d-compass');
  const compassRoseEl = document.getElementById('pf3d-compass-rose');
  const compassResetEl = document.getElementById('pf3d-compass-reset');
  const zoomTrackEl = document.getElementById('pf3d-zoom-track');
  const zoomHandleEl = document.getElementById('pf3d-zoom-handle');
  if (!container || !toggleBtn) return;

  // Range altitudine coperto dallo slider zoom (bussola/slider stile Cesium
  // Navigation): da pochi metri sopra i tetti alla vista dell'intera città.
  const NAV_ZOOM_MIN_H = 40;
  const NAV_ZOOM_MAX_H = 4000000;
  const NAV_ZOOM_TRACK_H = 74; // deve combaciare con l'altezza .pf3d-zoom-track in CSS

  const token = window.CESIUM_ION_TOKEN;
  let viewer = null;
  let initPromise = null;
  let active = false;
  const propsByCodice = new Map();
  let markerEntities = [];
  let viaEntities = [];
  let poligonoEntities = [];
  let areaEntities = [];
  const edificiByCodice = new Map();
  const areeVerdiByCodice = new Map();
  // Edifici/aree verdi/cimiteri: attivi di default in 3D, ma disattivabili
  // dallo stesso bottone toolbar "Poligoni" usato in 2D (stato indipendente).
  let poligoniVisible = true;
  function setPoligoniVisible3D(on) {
    poligoniVisible = on;
    poligonoEntities.forEach((e) => { if (e.polygon) e.polygon.show = on; });
    areaEntities.forEach((e) => { if (e.polygon) e.polygon.show = on; });
  }
  window.pf3dIsActive = () => active;
  window.pf3dSetPoligoniVisible = setPoligoniVisible3D;
  window.pf3dPoligoniVisible = () => poligoniVisible;

  fetch(DATA.pebaEdifici).then((r) => r.json()).then((geo) => {
    geo.features.forEach((f) => edificiByCodice.set(f.properties.Codice, f));
    if (active) refreshMarkers();
  });

  fetch(DATA.pebaAreeVerdi).then((r) => r.json()).then((geo) => {
    geo.features.forEach((f) => areeVerdiByCodice.set(f.properties.Codice, f));
    if (active) refreshMarkers();
  });

  function coloreVia(props) {
    if (typeof currentMapTheme !== 'undefined' && currentMapTheme === 'gruppo') {
      const palette = typeof coloriGruppoAttivi === 'function' ? coloriGruppoAttivi() : COLORI_GRUPPO;
      return (palette && palette[props.peba_tipo]) || '#999999';
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
      const palette = typeof coloriGruppoAttivi === 'function' ? coloriGruppoAttivi() : COLORI_GRUPPO;
      return (palette && palette[p.Gruppo]) || '#999999';
    }
    return (typeof COLORI_ACCESSIBILITA !== 'undefined'
      && (COLORI_ACCESSIBILITA[p['Livello accessibilita']] || COLORI_ACCESSIBILITA['Non valutabile'])) || '#999999';
  }

  // ── Bussola + slider zoom (navigazione 3D stile Cesium Navigation) ───────
  function updateNavUI() {
    if (!viewer) return;
    if (compassRoseEl) {
      const headingDeg = Cesium.Math.toDegrees(viewer.camera.heading);
      compassRoseEl.style.transform = `rotate(${-headingDeg}deg)`;
    }
    if (zoomHandleEl) {
      const h = Cesium.Math.clamp(viewer.camera.positionCartographic.height, NAV_ZOOM_MIN_H, NAV_ZOOM_MAX_H);
      const t = (Math.log(h) - Math.log(NAV_ZOOM_MIN_H)) / (Math.log(NAV_ZOOM_MAX_H) - Math.log(NAV_ZOOM_MIN_H));
      zoomHandleEl.style.top = `${t * NAV_ZOOM_TRACK_H}px`;
    }
  }

  function navHeightFromTrackT(t) {
    const clamped = Cesium.Math.clamp(t, 0, 1);
    return Math.exp(Math.log(NAV_ZOOM_MIN_H) + clamped * (Math.log(NAV_ZOOM_MAX_H) - Math.log(NAV_ZOOM_MIN_H)));
  }

  // heading/height in un colpo solo: mantiene sempre posizione e pitch correnti,
  // così bussola e slider non si pestano i piedi a vicenda né con l'orbit manuale.
  function navSetView({ heading, height }) {
    if (!viewer) return;
    const carto = viewer.camera.positionCartographic;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height ?? carto.height),
      orientation: { heading: heading ?? viewer.camera.heading, pitch: viewer.camera.pitch, roll: 0 },
    });
    viewer.scene.requestRender();
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

      // Tiene bussola/slider sincronizzati con la camera, sia per drag diretto
      // sui controlli sia per orbit/tilt/wheel-zoom fatti a mano sulla scena.
      viewer.scene.postRender.addEventListener(updateNavUI);
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
            // pickPosition invece di entity.position: funziona sia per i marker
            // (point) sia per i poligoni edificio, che non hanno una .position.
            const pos = viewer.scene.pickPosition(click.position);
            let lngLat;
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos);
              lngLat = { lng: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) };
            }
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
        const palette = typeof coloriGruppoAttivi === 'function' ? coloriGruppoAttivi() : COLORI_GRUPPO;
        const colGruppo = palette[p.Gruppo] || '#999999';
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

    const fonte = typeof pfLastMatched !== 'undefined'
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

    refreshEdifici(fonte);
    refreshAreeVerdi(fonte);
  }

  // Poligoni piatti (aree verdi/cimiteri, dati/peba_aree_verdi.geojson, join
  // offline punto PEBA -> OSM): niente estrusione né campionamento quota come
  // per gli edifici, classificationType fa aderire la forma al terreno/mesh
  // fotorealistica qualunque sia la superficie sottostante.
  function refreshAreeVerdi(fonte) {
    if (!viewer) return;
    areaEntities.forEach((e) => viewer.entities.remove(e));
    areaEntities = [];

    fonte.forEach(({ p }) => {
      const feature = p.Codice && areeVerdiByCodice.get(p.Codice);
      if (!feature) return;
      const colore = coloreMarker(p);
      const poligoni = feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];
      poligoni.forEach((rings) => {
        const [outer, ...holes] = rings;
        const positions = Cesium.Cartesian3.fromDegreesArray(outer.flatMap(([lng, lat]) => [lng, lat]));
        const holePolys = holes.map((ring) => new Cesium.PolygonHierarchy(
          Cesium.Cartesian3.fromDegreesArray(ring.flatMap(([lng, lat]) => [lng, lat])),
        ));
        const entity = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions, holePolys),
            material: Cesium.Color.fromCssColorString(colore).withAlpha(0.45),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(colore),
            classificationType: Cesium.ClassificationType.BOTH,
            show: poligoniVisible,
          },
          properties: { codice: p.Codice },
        });
        areaEntities.push(entity);
      });
    });
  }

  function centroideAnello(ring) {
    let sx = 0, sy = 0;
    ring.forEach(([x, y]) => { sx += x; sy += y; });
    return [sx / ring.length, sy / ring.length];
  }

  // Spinge il vertice oltre il perimetro dell'edificio (verso il marciapiede):
  // campionare la quota esattamente sul vertice intercetta il tetto (il tileset
  // fotorealistico è una mesh piena), non la strada sottostante.
  function spingiFuori(vertex, centroid, metri) {
    const [vlng, vlat] = vertex;
    const [clng, clat] = centroid;
    const mPerDegLng = 111320 * Math.cos((vlat * Math.PI) / 180);
    const mPerDegLat = 111320;
    const dxM = (vlng - clng) * mPerDegLng;
    const dyM = (vlat - clat) * mPerDegLat;
    const lenM = Math.hypot(dxM, dyM) || 1;
    const nDxM = dxM + (dxM / lenM) * metri;
    const nDyM = dyM + (dyM / lenM) * metri;
    return [clng + nDxM / mPerDegLng, clat + nDyM / mPerDegLat];
  }

  function mediana(nums) {
    const s = nums.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  let edificiRequestId = 0;
  // Cache runtime: fallback per gli edifici senza "quota" precotta nel geojson
  // (la quota reale non cambia mai — una volta cotta col comando pf3dBakeQuote()
  // in console e incollata in dati/peba_edifici.geojson, si campiona zero volte).
  const quotaTerrenoByCodice = new Map();
  // Cache runtime: quota del TETTO reale (mesh fotorealistica), per correggere
  // il campo "altezza" quando sottostima l'edificio vero (es. dato PEBA riferito
  // solo alla porzione occupata, non all'intero condominio/torre che la ospita).
  const quotaTettoByCodice = new Map();

  // Campiona la quota-marciapiede (mediana di pochi punti spinti fuori dalla
  // sagoma, vedi spingiFuori) per gli edifici passati e la mette in cache.
  // Ritorna false se l'ultima richiesta refreshEdifici è stata superata da una
  // più recente (filtro cambiato nel frattempo) — chi chiama deve abortire.
  async function campionaQuote(entries, requestId) {
    if (!viewer.scene.sampleHeightSupported || !entries.length) return true;
    const MAX_VERTICI = 4; // sottocampiona: basta il perimetro, non ogni vertice
    const samples = []; // Cartographic
    const ranges = []; // [start, end) in samples, per edificio
    entries.forEach(({ feature }) => {
      const outer = feature.geometry.coordinates[0];
      const centroid = centroideAnello(outer);
      const passo = Math.max(1, Math.floor(outer.length / MAX_VERTICI));
      const start = samples.length;
      for (let vi = 0; vi < outer.length; vi += passo) {
        const [lng, lat] = spingiFuori(outer[vi], centroid, 3);
        samples.push(Cesium.Cartographic.fromDegrees(lng, lat));
      }
      ranges.push([start, samples.length]);
    });

    try {
      await viewer.scene.sampleHeightMostDetailed(samples);
    } catch { /* tileset non pronto: fallback quota 0 sotto */ }
    if (requestId != null && requestId !== edificiRequestId) return false;

    entries.forEach(({ codice }, i) => {
      const [start, end] = ranges[i];
      const valid = samples.slice(start, end).map((c) => c.height).filter((h) => Number.isFinite(h));
      quotaTerrenoByCodice.set(codice, valid.length ? mediana(valid) : 0);
    });
    return true;
  }

  // Campiona la quota del TETTO (mediante sampleHeightMostDetailed dritto sui
  // vertici/centroide, senza spingerli fuori come in campionaQuote: qui il colpire
  // il tetto è voluto, non un bug) e tiene il massimo tra i campioni — un tetto
  // spiovente o a più livelli deve restare comunque tutto dentro il poligono.
  async function campionaTetti(entries, requestId) {
    if (!viewer.scene.sampleHeightSupported || !entries.length) return true;
    const MAX_VERTICI = 4;
    const samples = [];
    const ranges = [];
    entries.forEach(({ feature }) => {
      const outer = feature.geometry.coordinates[0];
      const centroid = centroideAnello(outer);
      const passo = Math.max(1, Math.floor(outer.length / MAX_VERTICI));
      const start = samples.length;
      samples.push(Cesium.Cartographic.fromDegrees(centroid[0], centroid[1]));
      for (let vi = 0; vi < outer.length; vi += passo) {
        samples.push(Cesium.Cartographic.fromDegrees(outer[vi][0], outer[vi][1]));
      }
      ranges.push([start, samples.length]);
    });

    try {
      await viewer.scene.sampleHeightMostDetailed(samples);
    } catch { /* tileset non pronto: niente correzione, si resta sull'altezza nominale */ }
    if (requestId != null && requestId !== edificiRequestId) return false;

    entries.forEach(({ codice }, i) => {
      const [start, end] = ranges[i];
      const valid = samples.slice(start, end).map((c) => c.height).filter((h) => Number.isFinite(h));
      if (valid.length) quotaTettoByCodice.set(codice, Math.max(...valid));
    });
    return true;
  }

  // Comando manuale, una tantum: da console (`pf3dBakeQuote()`) a vista 3D
  // attiva, campiona la quota di TUTTI gli edifici PEBA e scarica un JSON
  // {Codice: quota} da incollare come campo "quota" in peba_edifici.geojson —
  // dopo, refreshEdifici legge quel campo e non campiona più a runtime.
  window.pf3dBakeQuote = async function pf3dBakeQuote() {
    if (!viewer) { console.warn('Attiva prima la vista 3D.'); return; }
    const entries = Array.from(edificiByCodice.entries()).map(([codice, feature]) => ({ codice, feature }));
    await Promise.all([
      campionaQuote(entries, null),
      campionaTetti(entries, null),
    ]);
    const out = {};
    entries.forEach(({ codice }) => {
      out[codice] = { quota: quotaTerrenoByCodice.get(codice), tetto: quotaTettoByCodice.get(codice) };
    });
    console.log('Quote/tetti calcolati:', out);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quote_edifici.json';
    a.click();
    return out;
  };

  // Poligoni estrusi solo per gli edifici PEBA attualmente in vista (stesso
  // filtro/fonte dei marker): footprint reale da dati/peba_edifici.geojson
  // (join offline punto PEBA -> edificato.pmtiles), non dal tileset
  // fotorealistico che essendo mesh unica non è stilizzabile per edificio.
  //
  // La base non usa HeightReference.CLAMP_TO_GROUND: quel clamp campiona la
  // quota esattamente sotto ogni vertice, che per un tetto pieno è la quota
  // del TETTO, non della strada — risultato: il poligono galleggiava in aria
  // sopra l'edificio. Si usa invece la quota reale del marciapiede: dal campo
  // "quota" pre-cotto nel geojson se presente, altrimenti campionata al volo.
  async function refreshEdifici(fonte) {
    const myRequest = ++edificiRequestId;
    if (!viewer) return;

    const targets = [];
    fonte.forEach(({ p }) => {
      const feature = p.Codice && edificiByCodice.get(p.Codice);
      if (feature) targets.push({ p, feature });
    });

    if (!targets.length) {
      poligonoEntities.forEach((e) => viewer.entities.remove(e));
      poligonoEntities = [];
      return;
    }

    const daCampionare = targets.filter(({ p, feature }) => !Number.isFinite(feature.properties.quota)
      && !quotaTerrenoByCodice.has(p.Codice));
    const daCampionareTetto = targets.filter(({ p, feature }) => !Number.isFinite(feature.properties.tetto)
      && !quotaTettoByCodice.has(p.Codice));

    const [okQuote, okTetti] = await Promise.all([
      daCampionare.length
        ? campionaQuote(daCampionare.map(({ p, feature }) => ({ codice: p.Codice, feature })), myRequest)
        : true,
      daCampionareTetto.length
        ? campionaTetti(daCampionareTetto.map(({ p, feature }) => ({ codice: p.Codice, feature })), myRequest)
        : true,
    ]);
    if (!okQuote || !okTetti) return; // filtro cambiato nel frattempo

    const groundByTarget = targets.map(({ p, feature }) => (Number.isFinite(feature.properties.quota)
      ? feature.properties.quota
      : quotaTerrenoByCodice.get(p.Codice)) || 0);

    poligonoEntities.forEach((e) => viewer.entities.remove(e));
    poligonoEntities = [];

    targets.forEach(({ p, feature }, i) => {
      const colore = coloreMarker(p);
      const [outer, ...holes] = feature.geometry.coordinates;
      const positions = Cesium.Cartesian3.fromDegreesArray(outer.flatMap(([lng, lat]) => [lng, lat]));
      const holePolys = holes.map((ring) => new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray(ring.flatMap(([lng, lat]) => [lng, lat])),
      ));
      const altezza = feature.properties.altezza > 1 ? feature.properties.altezza : 8;
      // La quota è un'unica mediana per tutto il footprint: su terreno in pendenza
      // (o con lo scarto tra mesh fotorealistica Google e campione Cesium) non
      // combacia esattamente col reale a ogni angolo. Margini generosi sotto/sopra
      // fanno sì che il poligono inglobi comunque l'edificio reale del tileset
      // invece di sfiorarlo per un soffio — è un involucro indicativo, non un calco.
      const MARGINE_BASSO = 2;
      const MARGINE_ALTO = 4;
      const base = groundByTarget[i] - MARGINE_BASSO;
      // Il campo "altezza" a volte sottostima di molto (es. sede al piano terra
      // di una torre residenziale più alta): il tetto campionato sul tileset,
      // quando disponibile, vince se è più alto della stima nominale.
      const cimaNominale = groundByTarget[i] + altezza;
      const cimaTetto = Number.isFinite(feature.properties.tetto)
        ? feature.properties.tetto
        : quotaTettoByCodice.get(p.Codice);
      const cima = Number.isFinite(cimaTetto) ? Math.max(cimaNominale, cimaTetto) : cimaNominale;
      const entity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions, holePolys),
          height: base,
          extrudedHeight: cima + MARGINE_ALTO,
          material: Cesium.Color.fromCssColorString(colore).withAlpha(0.55),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(colore),
          show: poligoniVisible,
        },
        properties: { codice: p.Codice },
      });
      poligonoEntities.push(entity);
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
    // Stato "Poligoni" indipendente dal 2D: di default attivo in 3D, ma
    // resta cliccabile per disattivarlo (window.pf3dSetPoligoniVisible).
    if (poligoniBtn) poligoniBtn.classList.toggle('active', poligoniVisible);
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
      if (navEl) navEl.hidden = false;
      updateNavUI();
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
    if (poligoniBtn) {
      poligoniBtn.classList.toggle('active', typeof window.pfPoligoni2DOn === 'function' && window.pfPoligoni2DOn());
    }
    mapEl.style.display = '';
    container.hidden = true;
    statusEl.hidden = true;
    if (navEl) navEl.hidden = true;
    const tooltipEl = document.getElementById('pf3d-tooltip');
    if (tooltipEl) tooltipEl.hidden = true;
    if (typeof map !== 'undefined') map.resize();
  }

  toggleBtn.addEventListener('click', () => { active ? disable() : enable(); });
  window.pf3dDisable = () => { if (active) disable(); };
  window.pf3dRefreshMarkers = refreshMarkers;

  // Bussola: trascina per ruotare l'heading, clic sul pallino centrale riazzera nord+pitch.
  if (compassEl) {
    let draggingCompass = false;
    const headingFromEvent = (e) => {
      const rect = compassEl.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      return Math.atan2(dx, -dy); // 0 = su = nord, orario positivo (convenzione heading Cesium)
    };
    compassEl.addEventListener('pointerdown', (e) => {
      if (e.target === compassResetEl) return;
      draggingCompass = true;
      compassEl.setPointerCapture(e.pointerId);
      navSetView({ heading: headingFromEvent(e) });
    });
    compassEl.addEventListener('pointermove', (e) => {
      if (draggingCompass) navSetView({ heading: headingFromEvent(e) });
    });
    ['pointerup', 'pointercancel'].forEach((ev) => compassEl.addEventListener(ev, () => { draggingCompass = false; }));
  }
  if (compassResetEl) {
    compassResetEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!viewer) return;
      const carto = viewer.camera.positionCartographic;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      });
      viewer.scene.requestRender();
    });
  }

  // Slider zoom: trascina la manopola o clicca sulla traccia per impostare l'altitudine,
  // +/- per un passo relativo alla quota corrente.
  if (zoomTrackEl && zoomHandleEl) {
    const heightFromClientY = (clientY) => {
      const rect = zoomTrackEl.getBoundingClientRect();
      return navHeightFromTrackT((clientY - rect.top) / rect.height);
    };
    let draggingZoom = false;
    zoomHandleEl.addEventListener('pointerdown', (e) => {
      draggingZoom = true;
      zoomHandleEl.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    zoomHandleEl.addEventListener('pointermove', (e) => {
      if (draggingZoom) navSetView({ height: heightFromClientY(e.clientY) });
    });
    ['pointerup', 'pointercancel'].forEach((ev) => zoomHandleEl.addEventListener(ev, () => { draggingZoom = false; }));
    zoomTrackEl.addEventListener('pointerdown', (e) => {
      if (e.target !== zoomHandleEl) navSetView({ height: heightFromClientY(e.clientY) });
    });
  }
  const navZoomBtn = document.getElementById('pf3d-nav-in');
  const navZoomOutBtn = document.getElementById('pf3d-nav-out');
  if (navZoomBtn) navZoomBtn.addEventListener('click', () => {
    if (!viewer) return;
    navSetView({ height: viewer.camera.positionCartographic.height * 0.5 });
  });
  if (navZoomOutBtn) navZoomOutBtn.addEventListener('click', () => {
    if (!viewer) return;
    navSetView({ height: viewer.camera.positionCartographic.height * 2 });
  });
  // Sincronizza lo zoom-su-filtro (legenda/#pf-zoom) anche sulla camera 3D:
  // pfZoomToMatched in filters.js muove solo la camera 2D (map.fitBounds),
  // che in vista 3D è nascosta e non influenza Cesium — senza questo la
  // camera 3D resta ferma dov'era e i marker filtrati finiscono fuori vista.
  window.pf3dZoomToMatched = () => {
    if (!active || !viewer || !markerEntities.length) return;
    viewer.flyTo(markerEntities, { duration: 1.2 });
  };
})();
