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
  const ZOOM_ALTITUDE_K = 591657527.591555;
  function zoomAAltitudine(zoom) { return ZOOM_ALTITUDE_K / Math.pow(2, zoom); }
  function altitudineAZoom(alt) { return Math.log2(ZOOM_ALTITUDE_K / Math.max(alt, 1)); }

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
      });
      // Globo nascosto (il tileset fotorealistico copre la resa) ma non rimosso:
      // serve come ellissoide di riferimento per il pivot di orbit/tilt del mouse.
      viewer.scene.globe.show = false;
      const controller = viewer.scene.screenSpaceCameraController;
      controller.enableRotate = true;
      controller.enableTilt = true;
      controller.enableLook = true;
      // Beccheggio (tilt) di default richiede middle-drag o Ctrl+drag: poco scopribile.
      // Qui basta il tasto destro del mouse (senza modificatori), zoom resta sulla rotellina.
      controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
      controller.tiltEventTypes = [
        Cesium.CameraEventType.MIDDLE_DRAG,
        Cesium.CameraEventType.RIGHT_DRAG,
        Cesium.CameraEventType.PINCH,
        { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
      ];
      controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
      Cesium.RequestScheduler.requestsByServer['tile.googleapis.com:443'] = 18;
      const tileset = await Cesium.createGooglePhotorealistic3DTileset();
      viewer.scene.primitives.add(tileset);

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
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

      // Cursore a manina sopra un punto PEBA, come sull'equivalente layer 2D (map.js mouseenter/mouseleave).
      handler.setInputAction((movement) => {
        const picked = viewer.scene.pick(movement.endPosition);
        const suMarker = !!(picked && picked.id && picked.id.properties && picked.id.properties.codice);
        viewer.scene.canvas.style.cursor = suMarker ? 'pointer' : '';
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // Sync continua 3D -> 2D: ogni movimento camera (drag/zoom/tilt) riporta centro/zoom/
      // bearing/pitch sulla mappa MapLibre sottostante, cosi' resta coerente anche mentre e'
      // nascosta (es. legenda/filtri che leggono map.getCenter()/getZoom()).
      viewer.camera.percentageChanged = 0.02;
      viewer.camera.changed.addEventListener(() => { if (active) sincronizzaMappaDa3D(); });
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
    const altitudine = zoomAAltitudine(map.getZoom());
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
    const zoom = altitudineAZoom(carto.height);
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
      statusEl.textContent = '';
      statusEl.hidden = true;
      viewer.resize();
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
    if (typeof map !== 'undefined') map.resize();
  }

  toggleBtn.addEventListener('click', () => { active ? disable() : enable(); });
  window.pf3dDisable = () => { if (active) disable(); };
  window.pf3dRefreshMarkers = refreshMarkers;
})();
