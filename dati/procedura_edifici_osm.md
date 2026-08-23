# Procedura: aggiornare i poligoni edifici da OSM

Quando un punto PEBA di tipo edificio (`Gruppo` = Asilo, Museo, Sede
amministrativa/istituzionale, Sito UNESCO (edificio), ecc.) cambia
coordinate in `dati/peba.geojson`, il poligono corrispondente in
`dati/peba_edifici.geojson` va rifatto: il vecchio footprint OSM non è
più quello giusto.

## 1. Trova il punto cambiato

```bash
git diff --cached dati/peba.geojson   # o git diff se non è in stage
```

Prendi `Codice` e le nuove coordinate (`Longitudine`, `Latitudine` /
`geometry.coordinates`).

## 2. Interroga Overpass per i building vicini

```bash
curl -s "https://overpass-api.de/api/interpreter" \
  --data-urlencode 'data=[out:json][timeout:25];(way["building"](around:60,LAT,LON);relation["building"](around:60,LAT,LON););out geom;' \
  -o overpass.json
```

- `around:60` = raggio 60 m dal punto. Se non trova nulla, allarga (es. 120).
- Se il server risponde 504, riprova (a volte il primo tentativo va in timeout).

## 3. Scegli il building più vicino

Calcola il centroide di ogni `way`/`relation` restituito e la distanza
dal punto (formula equirettangolare va bene su scala urbana). Prendi il
più vicino. Se il più vicino è a più di ~15-20 m, controllare a mano
(potrebbe essere un errore di digitalizzazione o un edificio non
mappato su OSM — in tal caso si resta sul fallback `edificato.pmtiles`,
vedi sotto).

## 4. Aggiorna `dati/peba_edifici.geojson`

Per la feature con lo stesso `Codice`:

- `properties.osm_id` → `"way/<id>"` o `"relation/<id>"`
- `properties.name` → tag `name` OSM se presente, altrimenti `null`
- `geometry` → poligono con i nodi restituiti da Overpass (`geometry`
  di ogni nodo ha già `lat`/`lon`, basta impacchettarli in
  `[[lon, lat], ...]`)
- **Non toccare** `Codice`, `Gruppo`, `altezza` (vengono dal rilievo
  PEBA, non da OSM)
- **Rimuovi** `properties.quota` e `properties.tetto` se presenti: sono
  quote precotte per la vecchia posizione/geometria e non sono più
  valide. La vista 3D (`js/cesium3d.js`) le ricampiona automaticamente
  al volo quando mancano — non è un passaggio obbligatorio rifarle a
  mano.
- Se la stessa feature esiste come chiave in `dati/quote_edifici.json`
  (snapshot delle quote già cotte), rimuovi anche quella voce per
  coerenza.

## 5. (Opzionale) Ricuoci quota/tetto

Se si vuole precalcolare le quote invece di lasciarle campionare a
runtime: aprire l'app, attivare la vista 3D, aprire la console
browser e lanciare:

```js
pf3dBakeQuote()
```

Scarica un JSON `{Codice: {quota, tetto}}` per **tutti** gli edifici
PEBA correntemente caricati — prendere solo la voce del `Codice`
interessato e incollarla nei campi `quota`/`tetto` della feature in
`peba_edifici.geojson` (e in `quote_edifici.json` se lo si tiene
aggiornato come snapshot).

## Edifici a più corpi di fabbrica (MultiPolygon)

Alcuni edifici PEBA corrispondono a più way OSM separati (es. `A_10`,
NIDO GIRASOLE: 5 corpi disposti a croce). In questo caso:

- `geometry` della feature diventa `"type": "MultiPolygon"` con un
  poligono per corpo (`coordinates: [[ring1], [ring2], ...]`)
- `osm_id` elenca tutti gli id separati da `;` (es.
  `"way/111;way/222;way/333"`)
- Nessun'altra modifica di codice necessaria per il layer 2D
  (MapLibre disegna MultiPolygon nativamente); per la vista 3D
  (`js/cesium3d.js`) il rendering, il campionamento quota (`quota`) e
  tetto (`tetto`) gestiscono già MultiPolygon (un'entity per corpo,
  campionamento su tutti i corpi insieme per un'unica quota/tetto).

## Cap altezza per gruppo

In `js/cesium3d.js`, `refreshEdifici`, `ESTRUSIONE_MAX_M` è il tetto
massimo di estrusione sopra la base (in metri). Di norma è 25 m; per
`Gruppo === 'Asilo'` è ridotto a 6 m, perché gli asili sono
generalmente edifici a un solo livello fuori terra e il campo
`altezza` di quei punti (dal rilievo PEBA) a volte eredita per errore
la quota di un edificio vicino più alto — senza cap l'estrusione 3D
risultava sproporzionata rispetto a un asilo reale.

## Scansione batch: trovare edifici con corpi mancanti

Per verificare in un colpo solo se altri edifici PEBA (non solo quello
appena cambiato) hanno corpi di fabbrica OSM adiacenti non catturati
dal match esistente:

1. Costruisci **una sola** query Overpass che unisce, per ognuno degli
   ~81 edifici in `peba_edifici.geojson`, un filtro
   `way["building"](around:20,LAT,LON);` sul punto PEBA corrispondente
   (in `peba.geojson`). Un'unica richiesta con tutti gli `around` in
   union è molto più veloce di 81 richieste separate.
2. In locale, assegna ogni `way` restituito al punto PEBA più vicino
   (nearest-centroid), poi confronta con gli `osm_id` già salvati:
   quelli non presenti sono "candidati extra".
3. Filtra i candidati per **adiacenza reale**, non solo vicinanza: calcola
   il gap tra il bounding box del poligono già salvato e quello del
   candidato. Un gap ≈ 0 m (bbox che si toccano/sovrappongono) è un
   indizio di stesso complesso; una semplice distanza piccola (anche
   5-10 m) NON basta, perché in centro storico gli edifici confinano
   quasi sempre pur essendo edifici diversi.
4. **Prima di unire**, controlla i tag OSM del candidato
   (`building=apartments`/`retail`, `addr:*`, `name`, `tourism=*`):
   se indicano un uso o un'identità diversa da quella del sito PEBA,
   è un edificio a sé, non un corpo dello stesso plesso — va escluso.
   Esempio reale: per `SU_02` (San Cataldo, sito UNESCO) il gap-check
   aveva proposto un edificio adiacente che in realtà è un
   `tourism=information` con `name=Ufficio Informazioni` — scartato.
   Stesso discorso per `U_16`/`U_17`/`U_10`/`U_14`/`M_02`: in centro
   storico denso il gap ≈ 0 è quasi sempre solo un muro in comune con
   un edificio diverso, non lo stesso corpo di fabbrica — da NON
   unire senza controllo puntuale.
5. Gli edifici a padiglioni separati (asili, scuole, alcune sedi
   amministrative in zone meno dense) sono invece plausibili: più
   corpi con lo stesso `source: Comune di Palermo` e nessun tag che
   contraddica l'uso del sito PEBA.

## Note

- Il join punto-PEBA → building OSM è sempre stato fatto "offline"
  (query Overpass + aggiornamento manuale del geojson), non c'è uno
  script committato nel repo che lo automatizzi end-to-end.
- Alcuni edifici PEBA (storicamente 3, vedi commento in
  `js/cesium3d.js` intorno a `refreshEdifici`) non hanno un match OSM
  soddisfacente entro soglia: per quelli si usa ancora il footprint di
  `dati/edificato.pmtiles` come fallback, marcato con
  `properties.fonte` nel geojson.
- Fonte dati Overpass: `overpass-api.de`, tag `building=*`, licenza
  ODbL (OpenStreetMap contributors).
