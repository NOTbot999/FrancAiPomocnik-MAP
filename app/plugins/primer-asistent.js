// Primer vtičnika za Franc Map — "Asistent za karto"
// Deluje brez interneta: odgovarja na vprašanja o tem, kar je trenutno na zaslonu.
// Spodaj je označeno mesto, kjer lahko povežeš pravi AI model (lokalni ali spletni).
//
// Vtičnik je ES modul z:  export default { name, description, activate(api), deactivate() }

const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default {
  name: "Asistent za karto",
  description: "Odgovarja o jamah in točkah v pogledu; prostor za povezavo AI modela.",

  async activate(api) {
    // ── (neobvezno) povezava pravega AI modela ─────────────────────────────
    // Shrani nastavitve z api.storage.set("ai", { url, key, model }) in v askModel()
    // pokliči svoj API prek api.http(...). Kontekst karte dobiš z api.getVisibleFeatures().
    const ai = await api.storage.get("ai", null);

    async function askModel(question, history) {
      const context = { view: api.getView(), layers: api.activeLayers(), features: api.getVisibleFeatures(80) };
      const res = await api.http(ai.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.key}` },
        body: JSON.stringify({ model: ai.model, messages: [
          { role: "system", content: "Si pomočnik za zemljevid Slovenije. Kontekst karte (JSON): " + JSON.stringify(context) },
          ...history,
        ] }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 500);
    }

    // ── lokalni odgovori (brez AI) ─────────────────────────────────────────
    function localAnswer(q) {
      const t = q.toLowerCase();
      const feats = api.getVisibleFeatures(2000);
      const caves = feats.filter((f) => f.kind === "jama");
      if (/najglob/.test(t) && caves.length) {
        const c = [...caves].sort((a, b) => b.depth_m - a.depth_m)[0];
        api.flyTo(c.lat, c.lng, 15);
        return `Najgloblja jama v pogledu: ${c.name} — globina ${c.depth_m} m, dolžina ${c.length_m} m (kataster št. ${c.ref}).`;
      }
      if (/najdalj|najdaljš/.test(t) && caves.length) {
        const c = [...caves].sort((a, b) => b.length_m - a.length_m)[0];
        api.flyTo(c.lat, c.lng, 15);
        return `Najdaljša jama v pogledu: ${c.name} — dolžina ${c.length_m} m, globina ${c.depth_m} m.`;
      }
      if (/najbli|blizu/.test(t) && feats.length) {
        const f = feats[0];
        return `Najbližje središču karte: ${f.name || f.kind} (${f.kind}), ${fmt(f.distance_m)} stran.`;
      }
      if (/jam/.test(t)) return `V pogledu je ${caves.length} jam${caves.length ? `; najbližja je ${caves[0].name} (${fmt(caves[0].distance_m)}).` : ". Vklopi Točke → Jame."}`;
      if (/sloj|karta/.test(t)) {
        const l = api.activeLayers();
        return `Osnovna karta: ${l.base}. Vklopljeni sloji: ${l.overlays.join(", ") || "nobeden"}.`;
      }
      const kinds = {};
      for (const f of feats) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
      const list = Object.entries(kinds).map(([k, n]) => `${k}: ${n}`).join(", ");
      return list
        ? `V pogledu vidim ${feats.length} točk (${list}). Vprašaj npr. »katera jama je najgloblja«, »kaj je najbližje« ali »kateri sloji so vklopljeni«.`
        : "V pogledu ni točk. Vklopi Točke (npr. Jame) ali premakni karto.";
    }

    api.chat({
      placeholder: "Npr. katera jama je najgloblja?",
      greeting: ai
        ? "Povezan z AI modelom. Vprašaj me o karti."
        : "Živjo! Odgovarjam na vprašanja o tem, kar je na zaslonu (brez interneta). AI model lahko povežeš v tem vtičniku.",
      onSend: async (text, history) => (ai ? askModel(text, history) : localAnswer(text)),
    });
  },

  deactivate() {},
};
