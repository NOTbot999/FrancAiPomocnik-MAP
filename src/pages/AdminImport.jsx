import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function AdminImport() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [totalInserted, setTotalInserted] = useState(0);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const runImport = async (offset, batchLimit) => {
    addLog(`🚀 Uvažam od offset ${offset}, batch ${batchLimit}...`);
    const res = await base44.functions.invoke('importCaves', { offset, batchLimit });
    const d = res.data;
    addLog(`✅ Vstavjeno: ${d.inserted}, Napake: ${d.errors}, Skupaj v bazi: ${offset + d.inserted} / ${d.total}`);
    return d;
  };

  const handleFullImport = async () => {
    setRunning(true);
    setLog([]);
    setTotalInserted(0);

    try {
      // Import in chunks of 2000 with delay between each
      const CHUNK = 2000;
      const TOTAL = 13344;
      let inserted = 0;

      for (let offset = 0; offset < TOTAL; offset += CHUNK) {
        const d = await runImport(offset, CHUNK);
        inserted += d.inserted;
        setTotalInserted(inserted);
        if (offset + CHUNK < TOTAL) {
          addLog(`⏳ Čakam 3 sekunde pred naslednjim chunkom...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      addLog(`🎉 Uvoz končan! Skupaj vstavljeno: ${inserted}`);
    } catch (e) {
      addLog(`❌ Napaka: ${e.message}`);
    }

    setRunning(false);
  };

  const handleCheckCount = async () => {
    addLog('🔍 Preverjam število jam v bazi...');
    const res = await base44.functions.invoke('getCaves', { skip: 0, limit: 1 });
    // Also try a bigger fetch to get real count
    const res2 = await base44.functions.invoke('getCaves', { skip: 0, limit: 20000 });
    addLog(`📊 getCaves(limit=1): count=${res.data?.count}, getCaves(limit=20000): count=${res2.data?.count}`);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', background: '#1a1a1a', color: '#00ff00', minHeight: '100vh' }}>
      <h2 style={{ color: '#fff' }}>Admin: Uvoz Jam</h2>
      
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={handleFullImport}
          disabled={running}
          style={{ padding: '10px 20px', background: running ? '#555' : '#006600', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}
        >
          {running ? '⏳ Uvoz v teku...' : '🚀 Začni celoten uvoz (13344 jam)'}
        </button>
        
        <button
          onClick={handleCheckCount}
          disabled={running}
          style={{ padding: '10px 20px', background: '#003366', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}
        >
          🔍 Preveri število jam
        </button>
      </div>

      {totalInserted > 0 && (
        <div style={{ marginBottom: 10, color: '#ffff00' }}>
          Skupaj vstavljeno: {totalInserted} / 13344
        </div>
      )}

      <div style={{ background: '#000', padding: 15, borderRadius: 4, maxHeight: 500, overflowY: 'auto', fontSize: 13 }}>
        {log.length === 0 ? <span style={{ color: '#555' }}>Kliknite gumb za začetek uvoza...</span> : null}
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}