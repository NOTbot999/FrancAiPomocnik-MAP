/**
 * Hook for loading and saving per-user map settings to UserAccount.map_settings
 * Falls back to localStorage for guests.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

const LOCAL_KEY = "mapSettings_guest";
const SAVE_DELAY = 2000; // debounce saves by 2s

function getUserAccountId() {
  return localStorage.getItem("userAccountId") || null;
}

export function useUserSettings() {
  const [settings, setSettings] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const saveTimer = useRef(null);

  // Load settings on mount
  useEffect(() => {
    const id = getUserAccountId();
    setAccountId(id);

    if (id) {
      // Load from UserAccount
      base44.entities.UserAccount.filter({ id }, "-created_date", 1)
        .then((records) => {
          const acc = records[0];
          if (acc?.map_settings) {
            setSettings(acc.map_settings);
          } else {
            setSettings({});
          }
        })
        .catch(() => {
          // fallback to localStorage
          try {
            const raw = localStorage.getItem(LOCAL_KEY);
            setSettings(raw ? JSON.parse(raw) : {});
          } catch {
            setSettings({});
          }
        });
    } else {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        setSettings(raw ? JSON.parse(raw) : {});
      } catch {
        setSettings({});
      }
    }
  }, []);

  // Debounced save
  const saveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const id = getUserAccountId();
      if (id) {
        try {
          await base44.entities.UserAccount.update(id, { map_settings: newSettings });
        } catch (e) {
          console.warn("Could not save settings to server, falling back to localStorage", e);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(newSettings));
        }
      } else {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(newSettings));
      }
    }, SAVE_DELAY);
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, [saveSettings]);

  return { settings, updateSettings, isLoaded: settings !== null };
}