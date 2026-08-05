import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Module-level cache so many leaf components share one fetch.
let _cache = null;
let _fetching = false;
const subscribers = new Set();

async function fetchLatest() {
  if (_fetching) return;
  _fetching = true;
  try {
    const reports = await base44.entities.LayerHealthReport.list("-run_at", 1);
    const latest = reports?.[0];
    const map = {};
    if (latest?.results) {
      for (const r of latest.results) {
        if (r.layer_id && r.status) map[r.layer_id] = r.status;
      }
    }
    _cache = map;
    subscribers.forEach((fn) => fn(map));
  } catch {
    // ignore — health badges are non-critical
  } finally {
    _fetching = false;
  }
}

/**
 * Returns a map { layer_id -> status } from the most recent LayerHealthReport.
 * Fetches once per app session (cached module-level); all components share it.
 */
export function useLayerHealthStatus() {
  const [status, setStatus] = useState(_cache || {});
  useEffect(() => {
    if (_cache === null && !_fetching) fetchLatest();
    const fn = (m) => setStatus(m || {});
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);
  return status;
}

/** Force re-fetch after a fresh test run. */
export function refreshLayerHealthStatus() {
  _cache = null;
  fetchLatest();
}