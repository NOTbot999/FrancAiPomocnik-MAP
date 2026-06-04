// Konfiguracija slojev za GIS Explorer Slovenije

const ARSO_WMS   = "https://gis.arso.gov.si/geoserver/ARSO/wms";
const GURS_WMS   = "https://ipi.eprostor.gov.si/wms-si-gurs-dts/ows";
const ARSO_BASE  = "https://gis.arso.gov.si/arcgis/rest/services";

export const BASE_LAYERS = [
  {
    id: "osm",
    name: "OpenStreetMap",
    type: "tile",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap',
    thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop"
  },
  {
    id: "carto_voyager",
    name: "Carto Voyager",
    type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap &copy; CARTO',
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
    maxNativeZoom: 17,
    maxZoom: 21,
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=60&fit=crop"
  },
  {
    id: "esri_topo",
    name: "ESRI Topo",
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
    url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
    bboxSR: 3857,
    imageSR: 3857,
    maxNativeZoom: 19,
    enhance: true,
    attribution: "&copy; ARSO LIDAR",
    thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop"
  },
  {
    id: "arso_topo_nova",
    name: "ARSO Topo",
    type: "arcgis_export",
    arcgisUrl: "https://gis.arso.gov.si/arcgis/rest/services/Topografske_karte_ARSO_nova/MapServer/export",
    bboxSR: 4326,
    imageSR: 4326,
    attribution: "&copy; ARSO",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop"
  },
];

// 3 skupne kategorije namesto 8
export const OVERLAY_CATEGORIES = [
  // ── KARTE & KATASTER ─────────────────────────────────────────
  {
    id: "karte",
    name: "Karte & Kataster",
    icon: "Map",
    thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop",
    description: "Topografske karte, kataster, ortofoto, LIDAR in raba tal",
    layers: [
      // Ortofoto
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
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
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
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
        description: "Visokoločljivi ortofoto 25 cm (vidno pri zoom ≥ 12)"
      },
      // LIDAR
      {
        id: "gurs_lidar",
        name: "LIDAR Senčenje (<1 m)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
        opacity: 0.85,
        bboxSR: 3857,
        imageSR: 3857,
        maxNativeZoom: 19,
        enhance: true,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
        description: "1 m LIDAR senčenje iz državnega aerolaserskega snemanja ARSO"
      },
      {
        id: "arso_lidar_fishnet",
        name: "LIDAR pokritost (mreža)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_fishnet_D96/MapServer/export",
        opacity: 0.6,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: true,
        format: "png32",
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
        description: "Mreža LIDAR blokov — katera območja so bila snemana"
      },
      // Topografske karte
      {
        id: "gurs_dtk25",
        name: "TTN5/TTN10 (1:5k–1:10k)",
        type: "wms",
        url: "https://ipi.eprostor.gov.si/wms-si-gurs-dts/wms",
        layers: "SI.GURS.DK:TTN5_TTN10",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        tileSize: 256,
        thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop",
        description: "Osnovna topografska karta 1:5.000–1:10.000 (zoom 13+)"
      },
      {
        id: "gurs_dtk50",
        name: "DTK50 (1:50.000)",
        type: "wms",
        url: "https://ipi.eprostor.gov.si/wms-si-gurs-dts/wms",
        layers: "SI.GURS.DK:DTK50",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        tileSize: 256,
        thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop",
        description: "Uradna slovenska topografska karta 1:50.000"
      },
      {
        id: "arso_topo_overlay",
        name: "ARSO Topografska karta",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Topografske_karte_ARSO_nova/MapServer/export",
        opacity: 0.9,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop",
        description: "Nova ARSO topografska karta z OSM, GURS in PZS podatki"
      },
    ]
  },

  // ── INFRASTRUKTURA ───────────────────────────────────────────
  {
    id: "infrastruktura",
    name: "Infrastruktura & Poti",
    icon: "Route",
    thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&h=60&fit=crop",
    description: "Kolesarske poti, pohodniške steze, železnica, daljnovodi, vodovod",
    layers: [
      {
        id: "cycling_routes",
        name: "Kolesarske poti",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png",
        transparent: true,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&h=60&fit=crop",
        description: "Označene kolesarske poti"
      },
      {
        id: "hiking_routes",
        name: "Pohodniške poti",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
        transparent: true,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=80&h=60&fit=crop",
        description: "Označene pohodniške steze"
      },
      {
        id: "railway_lines",
        name: "Železnica",
        type: "tile",
        url: "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
        transparent: true,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=80&h=60&fit=crop",
        description: "Železniške proge OpenRailwayMap"
      },
      {
        id: "humanitarian_osm",
        name: "HOT OSM (Detajli)",
        type: "tile",
        url: "https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        opacity: 0.85,
        transparent: true,
        thumbnail: "https://images.unsplash.com/photo-1527489377706-5bf97e608852?w=80&h=60&fit=crop",
        description: "Humanitarna OSM — gasilni domovi, avtobusne postaje, pipe, razni objekti"
      },
      {
        id: "openinframap_power",
        name: "Daljnovodi (OSM Energy)",
        type: "tile",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        transparent: false,
        opacity: 0.8,
        thumbnail: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=80&h=60&fit=crop",
        description: "OSM standardna karta (daljnovodi vidni pri zoom 14+)"
      },
      {
        id: "openinframap_water",
        name: "Vodovod & Kanalizacija",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:PV_VOD",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.8,
        thumbnail: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=80&h=60&fit=crop",
        description: "Vodotoki iz ARSO registra voda"
      },
      {
        id: "slopes_waymarked",
        name: "Smučišča & Tereni",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png",
        attribution: "&copy; WaymarkedTrails, &copy; OpenStreetMap",
        transparent: true,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=80&h=60&fit=crop",
        description: "Smučišča, tekaški tereni in zimske poti iz OSM"
      },
      {
        id: "mtb_waymarked",
        name: "MTB poti",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png",
        attribution: "&copy; WaymarkedTrails, &copy; OpenStreetMap",
        transparent: true,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&h=60&fit=crop",
        description: "Označene MTB kolesarske poti"
      },
      {
        id: "equestrian_waymarked",
        name: "Konjeniške poti",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/riding/{z}/{x}/{y}.png",
        attribution: "&copy; WaymarkedTrails, &copy; OpenStreetMap",
        transparent: true,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=80&h=60&fit=crop",
        description: "Označene konjeniške poti"
      },
      {
        id: "openrailway_maxspeed",
        name: "Železnica — hitrosti",
        type: "tile",
        url: "https://tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png",
        attribution: "&copy; OpenRailwayMap",
        transparent: true,
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=80&h=60&fit=crop",
        description: "Železniške proge z barvnim prikazom hitrosti"
      },
      {
        id: "openrailway_signals",
        name: "Železnica — signali",
        type: "tile",
        url: "https://tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png",
        attribution: "&copy; OpenRailwayMap",
        transparent: true,
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=80&h=60&fit=crop",
        description: "Železniški signali in varnostni sistemi"
      },
      {
        id: "carto_roads_only",
        name: "Ceste (samo ceste)",
        type: "tile",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        attribution: "&copy; CARTO, &copy; OpenStreetMap",
        transparent: true,
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=80&h=60&fit=crop",
        description: "Samo oznake cest in ulic (transparentni sloj)"
      },
      {
        id: "osm_roads_transparent",
        name: "Ceste & Infrastruktura (OSM)",
        type: "tile",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        attribution: "&copy; CARTO, &copy; OpenStreetMap",
        transparent: true,
        opacity: 0.75,
        thumbnail: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=80&h=60&fit=crop",
        description: "Cestna mreža brez ozadja — za prekrivanje na satelitu ali LIDARu"
      }
    ]
  },

  // ── NARAVA & OKOLJE ──────────────────────────────────────────
  {
    id: "narava",
    name: "Narava & Okolje",
    icon: "Trees",
    thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=60&fit=crop",
    description: "Jame, naravne vrednote, vreme, ekološka območja",
    layers: [
      // Vodne površine — WMS iz ARSO
      {
        id: "arso_vode_povrsine",
        name: "Vodne površine (jezera, reke)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:PV_POV",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=80&h=60&fit=crop",
        description: "Vodne površine iz ARSO registra voda — jezera, akumulacije, ribniki"
      },
      {
        id: "arso_vodotoki",
        name: "Vodotoki (reke, potoki)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:PV_VOD",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=80&h=60&fit=crop",
        description: "Vodotoki iz ARSO registra voda — vse reke in potoki v Sloveniji"
      },
      {
        id: "arso_poplave",
        name: "Poplavna območja",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:PV_OPO",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.6,
        thumbnail: "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=80&h=60&fit=crop",
        description: "Poplavna tvegana območja iz ARSO"
      },
      // Raba tal — MKGP WMS (pravi vir, ne pokvarjen TMS)
      {
        id: "raba_farmland",
        name: "Raba kmetijskih zemljišč",
        type: "wms",
        url: "https://rkg.gov.si/GERK/wms/",
        layers: "RABA",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.65,
        thumbnail: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=80&h=60&fit=crop",
        description: "Raba kmetijskih zemljišč iz MKGP RABA registra"
      },
      // Jame
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
        thumbnail: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=80&h=60&fit=crop",
        description: "Ekološko pomembne jamske točke iz registra ARSO"
      },
      {
        id: "arso_epo_plg",
        name: "Kraška območja (EPO_PLG)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:EPO_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        thumbnail: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=80&h=60&fit=crop",
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
        thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=60&fit=crop",
        description: "Register naravnih vrednot (vključuje jame)"
      },
      // Vreme — OpenWeatherMap
      {
        id: "owm_clouds",
        name: "Oblačnost",
        type: "tile",
        url: "https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.6,
        thumbnail: "https://images.unsplash.com/photo-1419833173245-f59e1b93f9ee?w=80&h=60&fit=crop",
        description: "Sloj oblačnosti iz OpenWeatherMap"
      },
      {
        id: "owm_wind",
        name: "Hitrost vetra",
        type: "tile",
        url: "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.7,
        thumbnail: "https://images.unsplash.com/photo-1527482937786-6608f6e14c15?w=80&h=60&fit=crop",
        description: "Sloj hitrosti vetra iz OpenWeatherMap"
      },
      {
        id: "owm_temp",
        name: "Temperatura",
        type: "tile",
        url: "https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.6,
        thumbnail: "https://images.unsplash.com/photo-1561484930-974b10b12338?w=80&h=60&fit=crop",
        description: "Temperaturni sloj iz OpenWeatherMap"
      }
    ]
  },

  // ── OSNOVNI SLOJI (kot overlay) ──────────────────────────────
  {
    id: "osnovni",
    name: "Osnovni sloji",
    icon: "Map",
    thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop",
    description: "Osnovne karte kot prekrivni sloji (OSM, satelit, topo, LIDAR...)",
    layers: [
      {
        id: "ol_osm",
        name: "OpenStreetMap",
        type: "tile",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; OpenStreetMap',
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop",
        description: "OpenStreetMap kot prekrivni sloj"
      },
      {
        id: "ol_carto_voyager",
        name: "Carto Voyager",
        type: "tile",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=80&h=60&fit=crop",
        description: "Carto Voyager kot prekrivni sloj"
      },
      {
        id: "ol_satellite",
        name: "Satelit",
        type: "tile",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri, Maxar",
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
        description: "Satelitski posnetek kot prekrivni sloj"
      },
      {
        id: "ol_topo",
        name: "OpenTopoMap",
        type: "tile",
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenTopoMap",
        maxNativeZoom: 17,
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=60&fit=crop",
        description: "Topografska karta kot prekrivni sloj"
      },
      {
        id: "ol_esri_topo",
        name: "ESRI Topo",
        type: "tile",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri",
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop",
        description: "ESRI World Topo kot prekrivni sloj"
      },
      {
        id: "ol_dark",
        name: "Temna",
        type: "tile",
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; CartoDB",
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=60&fit=crop",
        description: "Temna karta kot prekrivni sloj"
      },
      {
        id: "ol_lidar",
        name: "LIDAR Senčenje",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
        opacity: 0.8,
        bboxSR: 3857,
        imageSR: 3857,
        maxNativeZoom: 19,
        enhance: true,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
        description: "LIDAR senčenje kot prekrivni sloj"
      },
      {
        id: "ol_arso_topo",
        name: "ARSO Topo",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Topografske_karte_ARSO_nova/MapServer/export",
        opacity: 0.9,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop",
        description: "ARSO topografska karta kot prekrivni sloj"
      },
      {
        id: "ol_esri_hillshade",
        name: "Hillshade (ESRI Global)",
        type: "tile",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri, USGS, NGA, NASA",
        opacity: 0.8,
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
        description: "ESRI globalno senčenje reliefa kot prekrivni sloj"
      },
      {
        id: "ol_esri_hillshade_dark",
        name: "Hillshade Dark (ESRI)",
        type: "tile",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri, USGS, NGA, NASA",
        opacity: 0.8,
        thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=60&fit=crop",
        description: "ESRI temno senčenje reliefa kot prekrivni sloj"
      },
      {
        id: "ol_maptiler_hillshade",
        name: "Hillshade (MapTiler)",
        type: "maptiler_tile",
        urlTemplate: "https://api.maptiler.com/tiles/hillshade/{z}/{x}/{y}.webp?key={key}",
        attribution: "&copy; MapTiler, &copy; OpenStreetMap contributors",
        opacity: 0.75,
        maxNativeZoom: 12,
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
        description: "Globalno senčenje reliefa — MapTiler, transparentni webp sloj (do zoom 12)"
      },
      {
        id: "ol_waymarked_slopes",
        name: "Smučišča & Tereni (WaymarkedTrails)",
        type: "tile",
        url: "https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png",
        attribution: "&copy; WaymarkedTrails, &copy; OpenStreetMap",
        opacity: 0.9,
        transparent: true,
        thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=60&fit=crop",
        description: "Smučišča in terenski tereni iz WaymarkedTrails"
      }
    ]
  },

  // ── ARHEOLOGIJA & KULTURNA DEDIŠČINA ────────────────────────
  {
    id: "dediscina",
    name: "Arheologija & Dediščina",
    icon: "Landmark",
    thumbnail: "https://images.unsplash.com/photo-1548013146-72479768bada?w=80&h=60&fit=crop",
    description: "Kulturna dediščina, arheološka najdišča, register nepremičnin kulturne dediščine",
    layers: [
      {
        id: "zvkds_rkd_tocke",
        name: "Kulturna dediščina — enote (točke)",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:KD_PNT",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.9,
        thumbnail: "https://images.unsplash.com/photo-1548013146-72479768bada?w=80&h=60&fit=crop",
        description: "Točke kulturne dediščine iz ARSO geoportala"
      },
      {
        id: "zvkds_rkd_obmocja",
        name: "Kulturna dediščina — območja",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:KD_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        thumbnail: "https://images.unsplash.com/photo-1548013146-72479768bada?w=80&h=60&fit=crop",
        description: "Območja kulturne dediščine iz ARSO geoportala"
      },
      {
        id: "arso_zavarovana_obmocja",
        name: "Zavarovana območja narave",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:ZO_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=60&fit=crop",
        description: "Narodni parki, naravni rezervati, krajinski parki"
      },
      {
        id: "arso_natura2000_plg",
        name: "Natura 2000 območja",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:NA2000",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.45,
        thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=60&fit=crop",
        description: "Omrežje Natura 2000 — posebna varstvena območja EU"
      },
      {
        id: "arso_nv_tocke",
        name: "Naravne vrednote (točke)",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:NV_PNT",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=80&h=60&fit=crop",
        description: "Točkovne naravne vrednote — jame, izviri, posebna drevesa, geotopi"
      },
      {
        id: "arso_nv_obmocja",
        name: "Naravne vrednote (območja)",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ARSO/wms",
        layers: "ARSO:NV_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.45,
        thumbnail: "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=80&h=60&fit=crop",
        description: "Območja naravnih vrednot — reke, doline, kraški svet"
      },
    ]
  },

  // ── ZGODOVINSKI & URBEX ──────────────────────────────────────
  {
    id: "zgodovinski",
    name: "Zgodovinski & Urbex",
    icon: "History",
    thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=80&h=60&fit=crop",
    description: "Zgodovinski ortofoto ARSO, primerjava let, iskanje opuščenih objektov",
    layers: [
      {
        id: "dof_2022_2024",
        name: "Ortofoto 2022–2024 (najnovejši)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2022_2023_2024/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2022–2024, najnovejši posnetki"
      },
      {
        id: "dof_2019",
        name: "Ortofoto 2019",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2019/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2019, ločljivost 25 cm"
      },
      {
        id: "dof_2018_2021",
        name: "Ortofoto 2018–2021",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2018_2021/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2018–2021"
      },
      {
        id: "dof_2016",
        name: "Ortofoto 2016",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2016/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2016"
      },
      {
        id: "dof_2014_2015",
        name: "Ortofoto 2014–2015",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2014_2015/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2014–2015"
      },
      {
        id: "dof_2009_2011",
        name: "Ortofoto 2009–2011",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2009_2011/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2009–2011"
      },
      {
        id: "dof_2006",
        name: "Ortofoto 2006",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2006/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2006"
      },
      {
        id: "dof_2001_2005",
        name: "Ortofoto 2001–2005",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_2001_2005/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 2001–2005 — pred moderno urbanizacijo"
      },
      {
        id: "dof_1997_2000",
        name: "Ortofoto 1997–2000",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_1997_2000/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=80&h=60&fit=crop",
        description: "ARSO ortofoto 1997–2000"
      },
      {
        id: "dof_1990_1994",
        name: "Ortofoto 1990–1994 (najstarejši)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/DOF_D96TM_1990_1994/MapServer/export",
        opacity: 1.0,
        bboxSR: 4326,
        imageSR: 4326,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=80&h=60&fit=crop",
        description: "Najstarejši ARSO ortofoto 1990–1994"
      },
      // Urbex sloji
      {
        id: "stamen_toner",
        name: "Toner (visok kontrast)",
        type: "tile",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; CartoDB, &copy; OpenStreetMap",
        opacity: 0.85,
        thumbnail: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=80&h=60&fit=crop",
        description: "Visokokontrastna svetla karta — izpostavi ceste in zgradbe"
      },
      {
        id: "lidar_overlay",
        name: "LIDAR overlay (iskanje)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
        opacity: 0.7,
        bboxSR: 3857,
        imageSR: 3857,
        maxNativeZoom: 19,
        enhance: true,
        transparent: false,
        format: "jpg",
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop",
        description: "LIDAR kot overlay — jarki, nasipi, temelji zgradb"
      },
      {
        id: "openinframap",
        name: "Energetska infrastruktura (OSM)",
        type: "tile",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        opacity: 0.8,
        transparent: false,
        thumbnail: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=80&h=60&fit=crop",
        description: "OSM karta — električna infrastruktura vidna pri zoom 14+"
      }
    ]
  }
];

export const CUSTOM_MARKERS = [
  {
    id: "custom_striptiz_psi",
    name: "🐶🦮💃 striptiz bar za pse",
    lat: 46.27760,
    lng: 15.00911,
  }
];

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];
export const DEFAULT_ZOOM = 9;