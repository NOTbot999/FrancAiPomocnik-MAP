/**
 * Cave Dataset Configuration
 * 
 * Source: Kataster jam Slovenije (13,344 jam)
 * Last imported: 2026-05-25
 * 
 * HOW TO RE-IMPORT (če je treba znova uvoziti):
 * 1. Pobriši vse Cave zapise v bazi (Admin → Entity → Cave → Delete All)
 * 2. Odpri AdminImport stran (/admin-import)
 * 3. Klikni "Uvozi jame" - uvozi v batchih po 2000
 * 4. Ko je končano, klikni "Obnovi cave cache"
 * 
 * ALI pa ročno prek backend funkcij:
 *   importCaves({ offset: 0, limit: 2000 })
 *   importCaves({ offset: 2000, limit: 2000 })
 *   importCaves({ offset: 4000, limit: 2000 })
 *   importCaves({ offset: 6000, limit: 2000 })
 *   importCaves({ offset: 8000, limit: 2000 })
 *   importCaves({ offset: 10000, limit: 2000 })
 *   importCaves({ offset: 12000, limit: 2000 })
 *   buildCaveCache({})
 */

export const CAVE_DATA_CONFIG = {
  // Originalni JSON file URL (13,344 jam)
  SOURCE_FILE_URL: 'https://media.base44.com/files/public/69ad3ce309822f8e71f66838/9cc867130_kataster_jame_13344.json',

  // Skupno število jam v datasetu
  TOTAL_CAVES: 13344,

  // Batch velikost za import (ne preseži 2000 due to rate limits)
  IMPORT_BATCH_SIZE: 2000,

  // Batchi za celoten import (copy-paste v AdminImport ali test_backend_function)
  IMPORT_BATCHES: [
    { offset: 0,     limit: 2000 },
    { offset: 2000,  limit: 2000 },
    { offset: 4000,  limit: 2000 },
    { offset: 6000,  limit: 2000 },
    { offset: 8000,  limit: 2000 },
    { offset: 10000, limit: 2000 },
    { offset: 12000, limit: 2000 },
  ],

  // CachedLayer category_id za jame
  CACHE_CATEGORY_ID: 'cave',

  // Polja v Cave entiteti
  ENTITY_NAME: 'Cave',
  ENTITY_FIELDS: ['cave_id', 'name', 'latitude', 'longitude', 'length_m', 'depth_m', 'area_m2'],
};

export default CAVE_DATA_CONFIG;