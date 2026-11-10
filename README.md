# FrancAiMap — GIS Explorer Slovenije

Interaktivni zemljevid Slovenije (React + Vite + Leaflet): ~60 kartografskih slojev
(OSM, satelit, ARSO LIDAR, GURS ortofoto/kataster, DTK50, pohodniške in kolesarske poti,
vode, raba tal, geologija …), ~55 kategorij točk zanimanja za celo Slovenijo, kataster jam
(13.344 jam), občine, načrtovalnik poti, GPS sledenje, risanje in merjenje, 3D pogled ter AR.

## Deluje brez povezave (offline)

Aplikacija je samostojna PWA in **ne potrebuje Base44 zaledja**:

- **Podatki so priloženi** v `public/data/*.json` (jame, vse POI kategorije, občine, kraji,
  3. razvojna os, Wikidata/Wikipedia/OpenChargeMap). Nalagajo se najprej iz paketa, šele nato
  iz živih virov (Overpass …), če paketa ni.
- **Service worker** (`public/sw.js`) shrani lupino aplikacije in podatke po prvem obisku ter
  predpomni ploščice *vseh* kartografnih gostiteljev (OSM, Carto, ESRI, ARSO, GURS, WaymarkedTrails …).
- **„Brez povezave“ plošča** v aplikaciji: *Shrani vse podatke za offline* (vsi JSON paketi) in
  *Shrani trenutni pogled* (ploščice vseh trenutno aktivnih slojev — podlaga + prekrivni — za
  izbrani izrez in razpon zoomov).
- Uporabniški računi, risbe, sledi in nastavitve se hranijo lokalno (localStorage).
- **AI pomočnik** (Franc, analiza terena ipd.) potrebuje Base44 in v offline načinu ni na voljo.

### Osvežitev podatkov

```bash
npm run fetch-data            # prenese/osveži vse pakete v public/data (preskoči mlajše od 7 dni)
npm run fetch-data -- --force # ponovno prenese vse
npm run fetch-data -- --only caves,castle,municipalities
```

Vir jam je javna datoteka katastra, POI kategorije pridejo iz Overpass (OSM) — skripta
rotira med zrcali in spoštuje omejitve (zaporedno, z zamikom). Datoteke v `public/data` se
commitajo v repozitorij, da svež klon deluje offline.

## Razvoj

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # produkcijska gradnja v ./dist (statična — deluje na poljubnem strežniku)
npm run preview
```

### Base44 način (neobvezno)

Za uporabo Base44 zaledja (računi v oblaku, AI) ustvari `.env.local` po vzoru `.env.example`
z `VITE_OFFLINE_MODE=false` in `VITE_BASE44_APP_ID`. Glej
[docs.base44.com](https://docs.base44.com/Integrations/Using-GitHub).
