# PEBA Palermo — Mappa accessibilità immobili comunali

Web app statica che visualizza gli esiti del **PEBA** (Piano di Eliminazione delle Barriere
Architettoniche) del Comune di Palermo: 209 punti tra sedi amministrative, scuole, asili, aree
verdi, percorsi e siti UNESCO, ciascuno con livello di accessibilità, punteggio del rilievo,
criticità riscontrate e foto del sopralluogo.

Realizzata da [OpenDataSicilia.it](https://opendatasicilia.it/) in collaborazione con Claude AI
(Anthropic).

## Funzionalità

- Mappa interattiva ([MapLibre GL JS](https://maplibre.org/)) con basemap OpenStreetMap o
  satellite Google, rete stradale di sfondo e vista a schermo intero.
- Ricerca live per nome immobile o indirizzo.
- Filtri a cascata: circoscrizione → quartiere → UPL, più filtro per gruppo tematico e livello di
  accessibilità.
- Legenda cliccabile (filtro rapido per gruppo), comprimibile su mobile.
- Scheda di dettaglio per ogni immobile: anagrafica, accessibilità, criticità, miniature foto.
- Galleria foto a schermo intero con navigazione da tastiera, rotazione e zoom.
- Pannello Info con fonti dati, guida all'uso della mappa e metodologia di estrazione.

## Struttura del repo

```
index.html          punto d'ingresso, markup di mappa/pannelli/modali
css/                 stili (map, filtri, componenti app, MapLibre)
js/
  map.js             init mappa, layer, popup, marker
  filters.js          ricerca, filtri a cascata, modale filtri
  panel.js             tab pannello info, apertura/chiusura pannelli
  maplibre-gl.js      libreria MapLibre GL JS (vendored)
dati/
  peba.geojson              i 209 punti PEBA con tutti gli attributi
  geojson/rete_archi.geojson rete stradale di sfondo
  schede_completo.csv/json   dataset tabellare completo
  vie_percorsi_per_circoscrizione.csv  elenco vie/percorsi per circoscrizione
  foto_backup/                foto sopralluogo originali
  metodologia_estrazione.md   note sull'estrazione dati dai PDF di partenza
scripts/
  marca_vie_peba.py   marca in rete_archi.geojson gli archi che corrispondono
                       a vie/percorsi PEBA (proprietà `peba_via`)
img/                 loghi, favicon, screenshot della guida
```

## Avvio in locale

Nessuna build richiesta: è un sito statico. Basta un server HTTP qualsiasi dalla root del
progetto, ad esempio:

```bash
python3 -m http.server 8000
```

poi apri `http://localhost:8000/index.html`.

## Fonti dati

- Rilievo PEBA — Comune di Palermo (Delibera di Giunta Comunale n° 272 del 18/07/2026).
- Rete stradale: estratto OpenStreetMap, elaborazione PalermoHub.

**Progettisti del Comune di Palermo:**
- Arch. Irene Calabria — Redattore del Piano (Progettista)
- Ing. Fabio Granata — Responsabile Unico del Progetto (R.U.P.)
- Ing. Marco Ciralli — Capo Area Responsabile della Pianificazione
- Prof. Arch. Maurizio Carta — Assessore all'Urbanistica e alla Pianificazione

I dati sono stati estratti automaticamente da 25 PDF originali tramite PyMuPDF; dettagli completi
nella scheda "Metodologia" del pannello Info dell'app e in `dati/metodologia_estrazione.md`.

## Disclaimer

I contenuti di questa mappa hanno carattere informativo e divulgativo. Non costituiscono
documenti ufficiali né hanno valore legale: per la documentazione ufficiale fare riferimento agli
atti allegati alle relative deliberazioni degli organi competenti.
