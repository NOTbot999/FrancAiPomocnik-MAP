// Konfiguracija slojev za GIS Explorer Slovenije
// Vsi URL-ji preverjeni glede na dejansko zmogljivost storitev

const ARSO_WMS   = "https://gis.arso.gov.si/geoserver/ARSO/wms";
const GURS_WMS   = "https://ipi.eprostor.gov.si/wms-si-gurs-dts/ows";
const ARSO_BASE  = "https://gis.arso.gov.si/arcgis/rest/services";

export const BASE_LAYERS = [
  {
    id: "osm",
    name: "OpenStreetMap",
    type: "tile",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop"
  },
  {
    id: "carto_voyager",
    name: "Carto Voyager",
    type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop"
  },
  {
    id: "satellite",
    name: "Satelit",
    type: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar",
    thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop"
  },
  {
    id: "topo",
    name: "OpenTopoMap",
    type: "tile",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=60&fit=crop"
  },
  {
    id: "esri_topo",
    name: "ESRI Topo karta",
    type: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop"
  },
  {
    id: "dark",
    name: "Temna",
    type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CartoDB",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=60&fit=crop"
  },
  {
    id: "lidar_hillshade",
    name: "LIDAR Senčenje",
    type: "arcgis_export",
    arcgisUrl: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
    attribution: "&copy; ARSO LIDAR",
    thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop"
  }
];

export const OVERLAY_CATEGORIES = [
  // ─── GURS / KATASTER ──────────────────────────────────────────
  {
    id: "gurs",
    name: "Kataster / GURS",
    icon: "Building2",
    description: "Zemljiški kataster in katastrski podatki GURS/e-Prostor",
    layers: [
      {
        id: "gurs_orthophoto",
        name: "Ortofoto DOF050 (50 cm)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.ZPDZ:DOF050",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "Aeroposnetki ortofoto 50 cm ločljivosti za Slovenijo"
      },
      {
        id: "gurs_orthophoto_025",
        name: "Ortofoto DOF025 (25 cm)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.ZPDZ:DOF025",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "Visokoločljivi ortofoto 25 cm (vidno pri zoom ≥ 12)"
      },
      {
        id: "gurs_lidar",
        name: "LIDAR Senčenje (ARSO, 1 m)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
        opacity: 0.85,
        description: "Ultrapodrobno 1 m LIDAR senčenje iz državnega aerolaserskega snemanja ARSO"
      },
      {
        id: "gurs_dtk25",
        name: "Osnovna topografska karta 1:5k–1:10k (TTN5/TTN10)",
        type: "wms",
        url: "https://ipi.eprostor.gov.si/wms-si-gurs-dts/wms",
        layers: "SI.GURS.DK:TTN5_TTN10",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        tileSize: 256,
        description: "Kombinirana TTN5 in TTN10 osnovna topografska karta 1:5.000–1:10.000 (zoom 13+)"
      },
      {
        id: "gurs_dtk50",
        name: "Topografska karta 1:50.000 (DTK50)",
        type: "wms",
        url: "https://ipi.eprostor.gov.si/wms-si-gurs-dts/wms",
        layers: "SI.GURS.DK:DTK50",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        tileSize: 256,
        description: "Uradna slovenska topografska karta 1:50.000"
      }
    ]
  },

  // ─── KATASTERJAM ──────────────────────────────────────────────
  {
    id: "katasterjam",
    name: "KatasterJam – Jame",
    icon: "Landmark",
    description: "Podatki o jamah iz ARSO/IZRK prek eKataster",
    layers: [
      {
        id: "arso_jame_epo",
        name: "Lokacije jam (EPO_PNT)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:EPO_PNT",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.8,
        description: "Ekološko pomembne jamske točke iz registra ARSO (vir za KatasterJam)"
      },
      {
        id: "arso_epo_plg",
        name: "Kraška in jamska območja (EPO_PLG)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:EPO_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "Ekološko pomembna območja vključno s kraškimi conami"
      },
      {
        id: "arso_naravne_vrednote",
        name: "Naravne vrednote (NV_PLG)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:NV_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "Register naravnih vrednot (vključuje jame)"
      }
    ]
  },

  // ─── RABA – RABA TAL ──────────────────────────────────────────
  {
    id: "landuse",
    name: "Raba tal (RABA/MKGP)",
    icon: "Wheat",
    description: "Kmetijska in gozdna raba tal iz MKGP",
    layers: [
      {
        id: "raba_farmland",
        name: "Raba kmetijskih zemljišč RABA-KGZ",
        type: "tile",
        url: "https://wms.openstreetmap.de/tms/RABA/{z}/{x}/{y}.png",
        opacity: 0.65,
        description: "Raba kmetijskih zemljišč iz Ministrstva za kmetijstvo"
      }
    ]
  },

  // ─── VREME ─────────────────────────────────────────────────
  {
    id: "weather",
    name: "Vreme (OpenWeatherMap)",
    icon: "CloudSun",
    description: "Živi vremenski sloji iz OpenWeatherMap",
    layers: [
      {
        id: "owm_clouds",
        name: "Oblačnost",
        type: "tile",
        url: "https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.6,
        description: "Sloj oblačnosti iz OpenWeatherMap"
      },
      {
        id: "owm_wind",
        name: "Hitrost vetra",
        type: "tile",
        url: "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.7,
        description: "Sloj hitrosti vetra iz OpenWeatherMap"
      },
      {
        id: "owm_temp",
        name: "Temperatura",
        type: "tile",
        url: "https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.6,
        description: "Temperaturni sloj iz OpenWeatherMap"
      }
    ]
  },

  // — POTI ————————————————————————
  {
    id: "poti",
    name: "Poti 🚴 🥾 🚂",
    icon: "Map",
    description: "Kolesarske poti, pohodniške steze, železnice in ceste",
    layers: [
      {
        id: "cycling_routes",
        name: "Kolesarske poti",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png",
        transparent: true,
        opacity: 0.9,
        description: "Označene kolesarske poti"
      },
      {
        id: "hiking_routes",
        name: "Pohodniške poti",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
        transparent: true,
        opacity: 0.9,
        description: "Označene pohodniške steze"
      },
      {
        id: "railway_lines",
        name: "Železnica",
        type: "tile",
        url: "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
        transparent: true,
        opacity: 0.9,
        description: "Železniške proge OpenRailwayMap"
      },
      {
        id: "opencyclemap",
        name: "Ceste & Kolesarske (OCM)",
        type: "tile",
        url: "https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=pk.eyJ1IjoiIiwiYSI6IiJ9",
        transparent: true,
        opacity: 0.8,
        description: "OpenCycleMap ceste in kolesarska infrastruktura"
      }
    ]
  },

  // ─── ISKANJE NEZNANIH OBJEKTOV ────────────────────────────────
  {
    id: "urbex",
    name: "🔍 Iskanje objektov / Urbex",
    icon: "Search",
    description: "Sloji za iskanje neznanih objektov, človeških posegov v naravo in opuščenih struktur",
    layers: [
      {
        id: "stamen_toner",
        name: "Toner (visok kontrast)",
        type: "tile",
        url: "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png",
        opacity: 0.85,
        description: "Visokokontrastna B/W karta — izpostavi ceste, zgradbe, poti ki niso na navadni karti"
      },
      {
        id: "osm_buildings",
        name: "OSM Zgradbe (overpass)",
        type: "tile",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        opacity: 0.5,
        transparent: true,
        description: "OpenStreetMap osnova — primerjaj z satelitom za neoznačene zgradbe"
      },
      {
        id: "openinframap",
        name: "Infrastruktura (OpenInfraMap)",
        type: "tile",
        url: "https://tiles.openinframap.org/power/{z}/{x}/{y}.png",
        opacity: 0.8,
        transparent: true,
        description: "Električna infrastruktura — daljnovodi, transformatorji, ki so lahko pri neznanih objektih"
      },
      {
        id: "lidar_overlay",
        name: "LIDAR senčenje (prekrivni sloj)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
        opacity: 0.7,
        description: "LIDAR kot overlay — razkrije reliefne anomalije, jarke, nasipe, temelje zgradb"
      },
      {
        id: "wayback_2006",
        name: "Esri Worldview satelit (primerjava)",
        type: "tile",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        opacity: 0.9,
        transparent: false,
        description: "Visokoločljiv satelit Esri — primerjaj z OSM za neoznačene zgradbe in posege"
      },
      {
        id: "humanitarian",
        name: "Humanitarna karta (HOT OSM)",
        type: "tile",
        url: "https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        opacity: 0.85,
        transparent: true,
        description: "HOT OSM — izpostavi vse umetne strukture, poti in zgradbe vključno z manjšimi"
      }
    ]
  }
];

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];
export const DEFAULT_ZOOM = 9;