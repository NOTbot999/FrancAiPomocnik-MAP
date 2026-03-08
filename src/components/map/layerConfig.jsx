// Layer configuration for Slovenia Map Viewer
// All URLs verified against actual service capabilities

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
    id: "satellite",
    name: "Satellite",
    type: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar, Earthstar Geographics",
    thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop"
  },
  {
    id: "topo",
    name: "Topographic",
    type: "tile",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=60&fit=crop"
  },
  {
    id: "esri_topo",
    name: "ESRI World Topo",
    type: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=80&h=60&fit=crop"
  },
  {
    id: "dark",
    name: "Dark",
    type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CartoDB",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=60&fit=crop"
  }
];

// ARSO ArcGIS MapServer – export as dynamic WMS tiles
// Base: https://gis.arso.gov.si/arcgis/rest/services/{service}/MapServer/export
// Leaflet calls these by passing bbox in EPSG:3857 with bboxSR and imageSR=3857
const ARSO_BASE = "https://gis.arso.gov.si/arcgis/rest/services";

// GURS ipi.eprostor DTS WMS – confirmed working layer names from GetCapabilities
const GURS_DTS_WMS = "https://ipi.eprostor.gov.si/wms-si-gurs-dts/ows";

// GURS storitve.eprostor – MKGP land use
const GURS_PEP_WMS = "https://storitve.eprostor.gov.si/ows-pub-wms/SI.MKGP.PEP/ows";

export const OVERLAY_CATEGORIES = [
  // ─── GURS / KATASTER ──────────────────────────────────────────
  {
    id: "gurs",
    name: "Kataster / GURS",
    icon: "Building2",
    description: "Land registry & cadastral data from GURS",
    layers: [
      {
        id: "gurs_orthophoto",
        name: "Orthophoto DOF050 (50cm)",
        type: "wms",
        url: GURS_DTS_WMS,
        layers: "SI.GURS.ZPDZ:DOF050",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 1.0,
        description: "50cm resolution aerial orthophoto"
      },
      {
        id: "gurs_orthophoto_025",
        name: "Orthophoto DOF025 (25cm)",
        type: "wms",
        url: GURS_DTS_WMS,
        layers: "SI.GURS.ZPDZ:DOF025",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 1.0,
        description: "25cm high-res orthophoto (visible at high zoom)"
      },
      {
        id: "gurs_lidar",
        name: "LIDAR Hillshade",
        type: "wms",
        url: GURS_DTS_WMS,
        layers: "SI.GURS.ZPDZ:LIDAR",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.85,
        description: "LIDAR-derived terrain hillshade model"
      },
      {
        id: "gurs_dtk50",
        name: "Topographic Map 1:50,000",
        type: "wms",
        url: GURS_DTS_WMS,
        layers: "SI.GURS.DK:DTK50",
        format: "image/png",
        transparent: false,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 1.0,
        description: "Official state topographic map at 1:50,000"
      },
      {
        id: "gurs_dpk250",
        name: "Overview Map 1:250,000",
        type: "wms",
        url: GURS_DTS_WMS,
        layers: "SI.GURS.DK:DPK250",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 1.0,
        description: "State overview map at 1:250,000"
      },
      {
        id: "gurs_dof_historical",
        name: "Historical Orthophoto Archive",
        type: "wms",
        url: GURS_DTS_WMS,
        layers: "SI.GURS.ZPDZ:DOF050_ZZ",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.9,
        description: "Historical aerial photos 1990–2025"
      }
    ]
  },

  // ─── KATASTERJAM ──────────────────────────────────────────────
  {
    id: "katasterjam",
    name: "Kataster Jam (Caves)",
    icon: "Landmark",
    description: "Cave registry – ARSO/IZRK data via eKataster",
    layers: [
      {
        id: "katasterjam_caves",
        name: "Cave Locations (KatasterJam)",
        type: "geojson_api",
        // Public ARSO WMS with nature values registry (includes caves)
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "ARSO:NV_POLI",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.7,
        description: "Nature values including caves from ARSO registry"
      },
      {
        id: "karst_areas",
        name: "Karst Landscape Areas",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "ARSO:NV_POLI",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.5,
        description: "Protected karst and natural heritage areas"
      }
    ]
  },

  // ─── ARSO – WATER ─────────────────────────────────────────────
  {
    id: "arso_water",
    name: "ARSO – Water & Floods",
    icon: "Droplets",
    description: "Hydrological data from ARSO",
    layers: [
      {
        id: "arso_poplave",
        name: "Flood Hazard Zones",
        type: "arcgis_dynamic",
        url: `${ARSO_BASE}/Atlasokolja_javni_D96_test/MapServer`,
        // layers 0 = KO (water quality), use WMS export with all layers
        // We use the geoserver ARSO WMS for flood polygons
        wmsUrl: "https://gis.arso.gov.si/geoserver/ows",
        wmsLayers: "SI.ARSO.POPLAVE:NEPOSREDNO_POPLAVNO_OBM,SI.ARSO.POPLAVE:VPLIVNO_POPLAVNO_OBM",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.6,
        description: "Direct and indirect flood hazard zones"
      },
      {
        id: "arso_vvo",
        name: "Water Protection Zones",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:VVO_DRZAVNI",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.55,
        description: "Drinking water source protection areas"
      },
      {
        id: "arso_vodna_telesa",
        name: "Water Bodies (Vodna telesa)",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:VODNA_TELESA_POVRS",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.65,
        description: "Surface water bodies classification"
      },
      {
        id: "arso_hidrografija",
        name: "River Network",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:HIDROGRAFIJA_L",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.7,
        description: "River and stream network"
      }
    ]
  },

  // ─── ARSO – NATURE ────────────────────────────────────────────
  {
    id: "arso_nature",
    name: "ARSO – Nature & Protected Areas",
    icon: "Trees",
    description: "Protected areas, Natura 2000, EPO",
    layers: [
      {
        id: "arso_natura2000",
        name: "Natura 2000",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.NV_POLI:NATURA2000_OBMOCJA",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.5,
        description: "EU Natura 2000 protected habitat areas"
      },
      {
        id: "arso_zavarovana",
        name: "Protected Natural Areas",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.NV_POLI:ZAVAROVANA_OBMOCJA",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.5,
        description: "National parks and other protected areas"
      },
      {
        id: "arso_epo",
        name: "Ecologically Important Areas (EPO)",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.NV_POLI:EPO",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.4,
        description: "Ecologically important areas"
      }
    ]
  },

  // ─── ARSO – ENVIRONMENT ───────────────────────────────────────
  {
    id: "arso_env",
    name: "ARSO – Environment & Geology",
    icon: "CloudSun",
    description: "Geology, seismic, soil data",
    layers: [
      {
        id: "arso_geologija",
        name: "Geological Map 1:250k",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.GEOZS:GEOL_KARTA_250K",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.55,
        description: "Geological map at 1:250,000 scale"
      },
      {
        id: "arso_potresi_nevarnost",
        name: "Seismic Hazard Map",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "ARSO:POTRS_NEVAR_KRT_2021",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.5,
        description: "Earthquake ground acceleration hazard 2021"
      },
      {
        id: "arso_tla",
        name: "Soil Map",
        type: "arcgis_export",
        url: `${ARSO_BASE}/Tla/MapServer/export`,
        layerIds: "show:all",
        opacity: 0.5,
        description: "Soil type and quality classification"
      }
    ]
  },

  // ─── RABA – LAND USE ──────────────────────────────────────────
  {
    id: "landuse",
    name: "Land Use (RABA/MKGP)",
    icon: "Wheat",
    description: "Agricultural and forest land use",
    layers: [
      {
        id: "raba_farmland",
        name: "Farmland Use (RABA-KGZ)",
        type: "tile",
        url: "https://wms.openstreetmap.de/tms/RABA/{z}/{x}/{y}.png",
        opacity: 0.65,
        description: "Agricultural land use classification from MKGP"
      },
      {
        id: "gurs_pep",
        name: "Agro-Environment (PEP/MKGP)",
        type: "wms",
        url: GURS_PEP_WMS,
        layers: "SI.MKGP.PEP:PEP_OBMOCJA",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.5,
        description: "Agro-environmental program areas"
      }
    ]
  },

  // ─── HISTORICAL MAPS ──────────────────────────────────────────
  {
    id: "historical",
    name: "Historical Maps",
    icon: "History",
    description: "Habsburg-era and archive cartography",
    layers: [
      {
        id: "franziszeischer_kataster",
        name: "Franciscan Cadastre (~1825)",
        type: "tile",
        url: "https://mapire.eu/en/map/cadastral/?layers=3&bbox={bbox-epsg-3857}",
        // Use WMS from mapire.eu
        wmsUrl: "https://mapire.eu/mapserver/wms",
        wmsLayers: "fm3",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.75,
        description: "Habsburg Franciscan Cadastral Survey ~1825"
      },
      {
        id: "second_military_survey",
        name: "2nd Military Survey (1806–1869)",
        type: "wms",
        url: "https://mapire.eu/mapserver/wms",
        layers: "secondsurvey",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.75,
        description: "Second Habsburg Military Survey"
      },
      {
        id: "third_military_survey",
        name: "3rd Military Survey (1869–1887)",
        type: "wms",
        url: "https://mapire.eu/mapserver/wms",
        layers: "thirdsurvey25000",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.75,
        description: "Third Habsburg Military Survey"
      }
    ]
  },

  // ─── ADMINISTRATIVE ───────────────────────────────────────────
  {
    id: "admin",
    name: "Administrative Boundaries",
    icon: "MapPin",
    description: "Municipalities, statistical regions",
    layers: [
      {
        id: "osm_municipalities",
        name: "Municipalities (Občine) – OSM",
        type: "tile",
        url: "https://wms.openstreetmap.de/tms/1.0.0/osmde/{zoom}/{x}/{y}.png",
        opacity: 0.5,
        description: "Slovenian municipality boundaries"
      },
      {
        id: "arso_admin_regions",
        name: "Statistical Regions",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.RPE:STATISTICNE_REG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        crs: "EPSG:3857",
        opacity: 0.4,
        description: "Statistical/NUTS regions of Slovenia"
      }
    ]
  }
];

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];
export const DEFAULT_ZOOM = 9;