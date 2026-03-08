// Layer configuration for Slovenia Map Viewer
// Sources: ARSO, GURS/e-prostor, OSM, Mapbox alternatives

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
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    thumbnail: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=80&h=60&fit=crop"
  },
  {
    id: "topo",
    name: "Topographic",
    type: "tile",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenTopoMap',
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=60&fit=crop"
  },
  {
    id: "terrain",
    name: "Terrain Light",
    type: "tile",
    url: "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
    attribution: '&copy; Stamen Design',
    thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=80&h=60&fit=crop"
  },
  {
    id: "dark",
    name: "Dark Mode",
    type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; CartoDB',
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=60&fit=crop"
  }
];

export const OVERLAY_CATEGORIES = [
  {
    id: "gurs",
    name: "Kataster / GURS",
    icon: "Building2",
    description: "Cadastral data from e-Prostor",
    layers: [
      {
        id: "gurs_parcels",
        name: "Land Parcels (Parcele)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.KN:PARCELE_DKPN_MEJA,SI.GURS.KN:PARCELE_DKPN_SID",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.7,
        description: "Cadastral parcel boundaries"
      },
      {
        id: "gurs_buildings",
        name: "Buildings (Stavbe)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.KN:STAVBE_SLO",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.7,
        description: "Building footprints"
      },
      {
        id: "gurs_addresses",
        name: "House Numbers (Hišne št.)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.RPE:HISNE_STEVILKE",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.8,
        description: "Address house numbers"
      },
      {
        id: "gurs_ko",
        name: "Cadastral Areas (KO)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.KN:KO_SLO",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Cadastral municipality boundaries"
      },
      {
        id: "gurs_orthophoto",
        name: "Orthophoto (DOF)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.ZPDZ:DOF5",
        format: "image/jpeg",
        transparent: false,
        version: "1.3.0",
        opacity: 1,
        description: "High-res aerial photography"
      }
    ]
  },
  {
    id: "arso_water",
    name: "ARSO - Water",
    icon: "Droplets",
    description: "Water and hydrology layers",
    layers: [
      {
        id: "arso_flood_areas",
        name: "Flood Risk Areas",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:OPOZORILO_POPLAVE",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.6,
        description: "Flood hazard zones"
      },
      {
        id: "arso_water_bodies",
        name: "Water Bodies",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:VODNA_TELESA_PODZEM,SI.ARSO.VODE:VODNA_TELESA_POVRS",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.6,
        description: "Surface and groundwater bodies"
      },
      {
        id: "arso_water_protection",
        name: "Water Protection Areas",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:VVO_DRZAVNI",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Drinking water protection zones"
      },
      {
        id: "arso_hydrography",
        name: "Rivers & Streams",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.VODE:HIDROGRAFIJA_L",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.7,
        description: "Hydrographic network"
      }
    ]
  },
  {
    id: "arso_nature",
    name: "ARSO - Nature",
    icon: "Trees",
    description: "Nature protection & ecology",
    layers: [
      {
        id: "arso_natura2000",
        name: "Natura 2000",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.NV_POLI:NATURA2000_OBMOCJA",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Natura 2000 protected areas"
      },
      {
        id: "arso_protected_areas",
        name: "Nature Protection Areas",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.NV_POLI:ZAVAROVANA_OBMOCJA",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Protected natural areas"
      },
      {
        id: "arso_eco_important",
        name: "Ecologically Important",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.NV_POLI:EPO",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.4,
        description: "Ecologically important areas"
      }
    ]
  },
  {
    id: "arso_environment",
    name: "ARSO - Environment",
    icon: "CloudSun",
    description: "Environmental monitoring",
    layers: [
      {
        id: "arso_noise",
        name: "Noise Maps",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.HRUP:SN_SKUPNA_LDEN",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Strategic noise maps"
      },
      {
        id: "arso_geology",
        name: "Geological Map",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.GEOZS:GEOL_KARTA_250K",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Geology at 1:250,000"
      },
      {
        id: "arso_seismic",
        name: "Seismic Hazard",
        type: "wms",
        url: "https://gis.arso.gov.si/geoserver/ows",
        layers: "SI.ARSO.POTRS:POTRS_NEVAR_KRT_2021",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Earthquake hazard zones"
      }
    ]
  },
  {
    id: "arso_spatial",
    name: "Spatial Units",
    icon: "MapPin",
    description: "Administrative boundaries",
    layers: [
      {
        id: "arso_municipalities",
        name: "Municipalities (Občine)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.RPE:OBCINE",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.4,
        description: "Municipal boundaries"
      },
      {
        id: "arso_settlements",
        name: "Settlements (Naselja)",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/ows",
        layers: "SI.GURS.RPE:NASELJA",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.4,
        description: "Settlement boundaries"
      }
    ]
  },
  {
    id: "landuse",
    name: "Land Use / RABA",
    icon: "Wheat",
    description: "Agricultural land use from MKGP",
    layers: [
      {
        id: "raba_farmland",
        name: "Farmland Use (RABA-KGZ)",
        type: "tile",
        url: "https://wms.openstreetmap.de/tms/RABA/{z}/{x}/{y}.png",
        opacity: 0.6,
        description: "Agricultural land use classification"
      },
      {
        id: "raba_gozd",
        name: "Forest Areas",
        type: "wms",
        url: "https://storitve.eprostor.gov.si/ows-pub-wms/SI.MKGP.RABA/ows",
        layers: "SI.MKGP.RABA:RABA_GOZD",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.5,
        description: "Forest coverage"
      }
    ]
  },
  {
    id: "lidar",
    name: "LIDAR / Elevation",
    icon: "Mountain",
    description: "LIDAR derived elevation data",
    layers: [
      {
        id: "arso_lidar",
        name: "LIDAR Hillshade",
        type: "tile",
        url: "https://gistiles1.arso.gov.si/nukleus_tiles/api/nukleusTiles/v461/LIDAR_HILLSHADE/tile/{z}/{x}/{y}",
        opacity: 0.7,
        description: "High-resolution LIDAR terrain model",
        tileSize: 256
      }
    ]
  },
  {
    id: "historical",
    name: "Historical Maps",
    icon: "History",
    description: "Historical cartography overlays",
    layers: [
      {
        id: "franciscan_cadastre",
        name: "Franciscan Cadastre (~1825)",
        type: "tile",
        url: "https://maps.arcanum.com/en/synchron/cadastre/{z}/{x}/{y}.jpg",
        opacity: 0.7,
        description: "Habsburg Franciscan Cadastral Maps"
      },
      {
        id: "habsburg_military",
        name: "Habsburg Military Survey",
        type: "tile",
        url: "https://mapire.eu/en/synchron/secondsurvey/{z}/{x}/{y}.jpg",
        opacity: 0.7,
        description: "Second Military Survey of the Habsburg Empire"
      }
    ]
  }
];

export const SLOVENIA_CENTER = [46.1512, 14.9955];
export const SLOVENIA_BOUNDS = [[45.42, 13.37], [46.88, 16.62]];
export const DEFAULT_ZOOM = 9;