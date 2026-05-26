/**
 * MobileBottomNav — persistent bottom navigation bar for mobile.
 * Tabs: Map (home), Layers, Saved Tracks, Settings.
 * Rendered outside the Leaflet portal so it sits above the map.
 */
import React from "react";
import { Map, Layers, Route, Settings } from "lucide-react";
import { loadTheme } from "@/components/map/ThemeCustomizer";

const TABS = [
  { id: "map",      Icon: Map,      label: "Karta" },
  { id: "layers",   Icon: Layers,   label: "Sloji" },
  { id: "tracks",   Icon: Route,    label: "Sledi" },
  { id: "settings", Icon: Settings, label: "Nastavitve" },
];

export default function MobileBottomNav({ activeTab, onTabChange }) {
  const theme = loadTheme();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[980] flex items-stretch border-t"
      style={{
        backgroundColor: theme.toolbarBg,
        borderColor: `${theme.toolbarText}22`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map(({ id, Icon, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all"
            style={{
              color: isActive ? theme.buttonActiveBg : theme.toolbarText,
              opacity: isActive ? 1 : 0.55,
              minHeight: 52,
            }}
          >
            <Icon style={{ width: 22, height: 22 }} />
            <span className="text-[10px] font-medium">{label}</span>
            {isActive && (
              <span
                className="absolute bottom-0 w-6 h-0.5 rounded-full"
                style={{ backgroundColor: theme.buttonActiveBg }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}