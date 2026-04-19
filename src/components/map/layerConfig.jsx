// Layer configuration for Slovenia Map Viewer
// All URLs verified against actual service capabilities

// Layer configuration - all URLs and layer names verified from GetCapabilities / Layer Preview
// ARSO GeoServer: https://gis.arso.gov.si/geoserver/ARSO/wms (namespace ARSO:)
// GURS DTS WMS:   https://ipi.eprostor.gov.si/wms-si-gurs-dts/ows (namespace SI.GURS.*)
// Both support EPSG:3857

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
    id: "satellite",
    name: "Satellite",
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
  },
  {
    id: "lidar_hillshade",
    name: "LIDAR Hillshade",
    type: "arcgis_export",
    // Verified: https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer
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
    description: "Land registry & cadastral data from GURS/e-Prostor",
    layers: [
      {
        id: "gurs_orthophoto",
        name: "Orthophoto DOF050 (50cm)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.ZPDZ:DOF050",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "50cm resolution aerial orthophoto of Slovenia"
      },
      {
        id: "gurs_orthophoto_025",
        name: "Orthophoto DOF025 (25cm)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.ZPDZ:DOF025",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "25cm high-res aerial orthophoto (visible at z≥12)"
      },
      {
        id: "gurs_lidar",
        name: "LIDAR Hillshade (ARSO, 1m)",
        type: "arcgis_export",
        url: "https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export",
        opacity: 0.85,
        description: "Ultra-detailed 1m resolution LIDAR hillshade from ARSO national airborne survey"
      },
      {
        id: "gurs_dtk25",
        name: "Topographic Map 1:25,000 (DTK25)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.DK:DTK25",
        format: "image/png",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "Official Slovenian topographic map 1:25,000 (detailed)"
      },
      {
        id: "gurs_dtk50",
        name: "Topographic Map 1:50,000 (DTK50)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.DK:DTK50",
        format: "image/png",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "Official Slovenian topographic map 1:50,000"
      },
      {
        id: "gurs_dpk250",
        name: "Overview Map 1:250,000 (DPK250)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.DK:DPK250",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "State overview cartographic map 1:250,000"
      },
      {
        id: "gurs_dof_historical",
        name: "Historical Orthophotos Archive",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.ZPDZ:DOF050_ZZ",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        opacity: 0.9,
        description: "Historical aerial photos 1990–2025 from GURS"
      },
      {
        id: "gurs_ttn5",
        name: "Basic Topo Maps 1:5k–1:10k (TTN)",
        type: "wms",
        url: GURS_WMS,
        layers: "SI.GURS.DK:TTN5_TTN10",
        format: "image/png",
        transparent: false,
        version: "1.1.1",
        opacity: 1.0,
        description: "Combined TTN5 and TTN10 basic topographic maps"
      }
    ]
  },

  // ─── KATASTERJAM ──────────────────────────────────────────────
  {
    id: "katasterjam",
    name: "KatasterJam – Caves",
    icon: "Landmark",
    description: "Cave data from ARSO/IZRK via eKataster",
    layers: [
      {
        id: "arso_jame_epo",
        name: "Cave Locations (EPO_PNT)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:EPO_PNT",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.8,
        description: "Ecologically important cave points from ARSO registry (source for KatasterJam)"
      },
      {
        id: "arso_epo_plg",
        name: "Karst & Cave Areas (EPO_PLG)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:EPO_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "Ecologically important areas including karst zones"
      },
      {
        id: "arso_naravne_vrednote",
        name: "Natural Heritage Values (NV_PLG)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:NV_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "Natural heritage values register (includes caves)"
      }
    ]
  },

  // ─── ARSO – WATER ─────────────────────────────────────────────
  {
    id: "arso_water",
    name: "ARSO – Water & Floods",
    icon: "Droplets",
    description: "Flood hazard, water bodies, hydrology",
    layers: [
      {
        id: "arso_poplave_neposredno",
        name: "Direct Flood Hazard Areas",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:POPLAVE_NEPOSREDNO",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.65,
        description: "Areas of direct flood risk"
      },
      {
        id: "arso_poplave_vplivno",
        name: "Indirect Flood Influence Areas",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:POPLAVE_VPLIVNO",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "Broader flood influence and hazard zones"
      },
      {
        id: "arso_vvo",
        name: "Water Protection Zones (VVO)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:VVO",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.55,
        description: "Drinking water source protection areas"
      },
      {
        id: "arso_vodna_telesa",
        name: "Surface Water Bodies",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:VODNA_TELESA",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.6,
        description: "Surface water body classification"
      },
      {
        id: "arso_morje",
        name: "Adriatic Sea Quality",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:MORJE_KAKOVOST",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.6,
        description: "Sea water quality monitoring areas"
      }
    ]
  },

  // ─── ARSO – NATURE ────────────────────────────────────────────
  {
    id: "arso_nature",
    name: "ARSO – Nature & Natura 2000",
    icon: "Trees",
    description: "Protected areas, habitats, wildlife zones",
    layers: [
      {
        id: "arso_natura2000",
        name: "Natura 2000 Areas",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:NATURA2000",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "EU Natura 2000 protected habitats and bird areas"
      },
      {
        id: "arso_zavarovana",
        name: "Protected Natural Areas",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:ZAVAROVANA_OBMOCJA",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "National parks, landscape parks, nature reserves"
      },
      {
        id: "arso_epo_nature",
        name: "Ecologically Important Areas (EPO)",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:EPO_PLG",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.4,
        description: "Areas of ecological importance"
      }
    ]
  },

  // ─── ARSO – ENVIRONMENT ───────────────────────────────────────
  {
    id: "arso_env",
    name: "ARSO – Environment & Geology",
    icon: "CloudSun",
    description: "Geology, seismic hazard, soil, noise",
    layers: [
      {
        id: "arso_potres_nevarnost",
        name: "Seismic Hazard 2021",
        type: "wms",
        url: ARSO_WMS,
        layers: "ARSO:POTRS_NEVAR_KRT_2021",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.55,
        description: "Earthquake peak ground acceleration hazard map 2021"
      },
      {
        id: "arso_geol_250k",
        name: "Geological Map 1:250,000",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows", // This layer uses the generic OWS endpoint, not the ARSO_WMS specific one.
        layers: "SI.GEOZS:GEOL_KARTA_250K",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.5,
        description: "Geological bedrock map at 1:250,000 scale"
      },
      {
        id: "arso_tla_export",
        name: "Soil Types",
        type: "arcgis_export",
        url: `${ARSO_BASE}/Tla/MapServer/export`,
        opacity: 0.5,
        description: "Soil type and quality classification from ARSO"
      },
      {
        id: "arso_degradirana",
        name: "Degraded Areas",
        type: "arcgis_export",
        url: `${ARSO_BASE}/Degradirana_obmocja/MapServer/export`,
        opacity: 0.5,
        description: "Degraded and contaminated land areas"
      }
    ]
  },

  // ─── RABA – LAND USE ──────────────────────────────────────────
  {
    id: "landuse",
    name: "Land Use (RABA/MKGP)",
    icon: "Wheat",
    description: "Agricultural and forest land use from MKGP",
    layers: [
      {
        id: "raba_farmland",
        name: "Farmland Use RABA-KGZ",
        type: "tile",
        url: "https://wms.openstreetmap.de/tms/RABA/{z}/{x}/{y}.png",
        opacity: 0.65,
        description: "Agricultural land use from Ministry of Agriculture"
      }
    ]
  },

  // ─── HISTORICAL MAPS (Arcanum / Mapire) ───────────────────────
  {
    id: "historical",
    name: "Historical Maps (Arcanum)",
    icon: "History",
    description: "Habsburg-era military surveys & cadastral maps via maps.arcanum.com WMTS",
    layers: [
      {
        id: "arcanum_second_survey",
        name: "2nd Military Survey (1806–1869)",
        type: "tile",
        // Arcanum WMTS REST endpoint, GoogleCompatible (EPSG:3857), max zoom 15
        url: "https://maps.arcanum.com/en/map/europe-19century-secondsurvey/wmts/europe-19century-secondsurvey/GoogleCompatibleTileMatrixSet/{z}/{x}/{y}.png",
        opacity: 0.85,
        maxZoom: 15,
        description: "Second Habsburg Military Survey of Central Europe (Arcanum Maps)"
      },
      {
        id: "arcanum_third_survey_25k",
        name: "3rd Military Survey 1:25k (1869–1887)",
        type: "tile",
        url: "https://maps.arcanum.com/en/map/europe-19century-thirdsurvey-25000/wmts/europe-19century-thirdsurvey-25000/GoogleCompatibleTileMatrixSet/{z}/{x}/{y}.png",
        opacity: 0.85,
        maxZoom: 15,
        description: "Third Habsburg Military Survey 1:25,000 (Arcanum Maps)"
      },
      {
        id: "arcanum_third_survey_75k",
        name: "3rd Military Survey 1:75k (1869–1887)",
        type: "tile",
        url: "https://maps.arcanum.com/en/map/europe-19century-thirdsurvey-75000/wmts/europe-19century-thirdsurvey-75000/GoogleCompatibleTileMatrixSet/{z}/{x}/{y}.png",
        opacity: 0.85,
        maxZoom: 13,
        description: "Third Habsburg Military Survey 1:75,000 overview (Arcanum Maps)"
      }
    ]
  },

  // ─── WEATHER ─────────────────────────────────────────────────
  {
    id: "weather",
    name: "Weather (OpenWeatherMap)",
    icon: "CloudSun",
    description: "Live weather overlays from OpenWeatherMap",
    layers: [
      {
        id: "owm_precipitation",
        name: "Precipitation",
        type: "tile",
        url: "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.7,
        description: "Live precipitation layer from OpenWeatherMap"
      },
      {
        id: "owm_clouds",
        name: "Cloud Cover",
        type: "tile",
        url: "https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.6,
        description: "Cloud cover layer from OpenWeatherMap"
      },
      {
        id: "owm_wind",
        name: "Wind Speed",
        type: "tile",
        url: "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.7,
        description: "Wind speed layer from OpenWeatherMap"
      },
      {
        id: "owm_temp",
        name: "Temperature",
        type: "tile",
        url: "https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2",
        opacity: 0.6,
        description: "Temperature layer from OpenWeatherMap"
      }
    ]
  },

  // ─── ADMINISTRATIVE ───────────────────────────────────────────
  {
    id: "admin",
    name: "Administrative Boundaries",
    icon: "MapPin",
    description: "Municipal and regional boundaries",
    layers: [
      {
        id: "arso_drzavna_meja",
        name: "National Border (Državna meja)",
        type: "arcgis_export",
        url: `${ARSO_BASE}/DrzavnaMeja/MapServer/export`,
        opacity: 0.8,
        description: "Official state border of Slovenia"
      },
      {
        id: "arso_prostorske_enote",
        name: "Administrative Units",
        type: "arcgis_export",
        url: `${ARSO_BASE}/ProstorskeEnote/MapServer/export`,
        opacity: 0.5,
        description: "Municipalities and statistical regions"
      }
    ]
  }
];

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];
export const DEFAULT_ZOOM = 9;