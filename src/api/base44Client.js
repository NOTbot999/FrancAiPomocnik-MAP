// Picks the backend client:
//   - offline/standalone (default): local client backed by localStorage + bundled /data json
//   - Base44 cloud: set VITE_OFFLINE_MODE=false and VITE_BASE44_APP_ID in .env.local
import { appParams } from '@/lib/app-params';
import { localClient } from './localClient';

export const OFFLINE_MODE =
  import.meta.env.VITE_OFFLINE_MODE !== 'false' || !import.meta.env.VITE_BASE44_APP_ID;

let client = localClient;

if (!OFFLINE_MODE) {
  const { createClient } = await import('@base44/sdk');
  const { appId, token, functionsVersion, appBaseUrl } = appParams;
  client = createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl
  });
}

export const base44 = client;
