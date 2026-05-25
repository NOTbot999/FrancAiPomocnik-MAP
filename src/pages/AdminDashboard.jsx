import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Shield, Crown, User, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const COLS = [
  { key: 'username', label: 'Username' },
  { key: 'email', label: 'Email' },
  { key: 'password', label: 'Password' },
  { key: 'password_hash', label: 'Password Hash' },
  { key: 'login_method', label: 'Login Method' },
  { key: 'last_login', label: 'Last Login' },
  { key: 'device_type', label: 'Device' },
  { key: 'os', label: 'OS' },
  { key: 'browser', label: 'Browser' },
  { key: 'role', label: 'Role' },
  { key: 'is_premium', label: 'Premium' },
  { key: 'premium_since', label: 'Premium Since' },
  { key: 'premium_until', label: 'Premium Until' },
  { key: 'is_base44_user', label: 'Base44' },
];

function formatVal(key, val) {
  if (val === null || val === undefined || val === '') return <span className="text-slate-300">—</span>;
  if (key === 'last_login' || key === 'premium_since' || key === 'premium_until') {
    try { return <span className="whitespace-nowrap">{format(new Date(val), 'dd.MM.yy HH:mm')}</span>; } catch { return val; }
  }
  if (key === 'is_premium' || key === 'is_base44_user') {
    return val
      ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Da</Badge>
      : <Badge variant="outline" className="text-slate-400 text-[10px]">Ne</Badge>;
  }
  if (key === 'role') {
    return val === 'admin'
      ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1"><Shield className="w-3 h-3" />Admin</Badge>
      : <Badge variant="outline" className="text-slate-500 text-[10px] gap-1"><User className="w-3 h-3" />User</Badge>;
  }
  if (key === 'password_hash') {
    return <span className="font-mono text-[10px] text-slate-400 truncate max-w-[80px] block" title={val}>{val}</span>;
  }
  return <span className="text-xs">{String(val)}</span>;
}

export default function AdminDashboard() {
  const { user, isLoadingAuth } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('username');
  const [sortAsc, setSortAsc] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('adminGetUsers', {});
      setAccounts(res.data?.accounts || []);
    } catch (e) {
      setError('Napaka pri nalaganju: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchAccounts();
    else if (!isLoadingAuth) setLoading(false);
  }, [isAdmin, isLoadingAuth]);

  if (isLoadingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-4">
        <Shield className="w-12 h-12 text-red-400" />
        <h1 className="text-xl font-bold">Dostop zavrnjen</h1>
        <p className="text-slate-400 text-sm">Samo administratorji imajo dostop do tega panela.</p>
        <Button variant="outline" onClick={() => window.location.href = '/'} className="border-slate-700 text-slate-300">
          Nazaj na karto
        </Button>
      </div>
    );
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = accounts
    .filter(a => {
      const s = search.toLowerCase();
      return !s || (a.username || '').toLowerCase().includes(s) || (a.email || '').toLowerCase().includes(s);
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      const cmp = String(va).localeCompare(String(vb));
      return sortAsc ? cmp : -cmp;
    });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Admin Panel</h1>
            <p className="text-xs text-slate-400">Upravljanje uporabnikov</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{filtered.length} / {accounts.length} uporabnikov</span>
          <Button size="sm" variant="ghost" onClick={fetchAccounts} className="text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.href = '/'} className="border-slate-700 text-slate-300 text-xs">
            ← Karta
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Išči po username ali email..."
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="px-6 pb-8 overflow-x-auto">
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key
                        ? sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        : null
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-8 text-center text-slate-500">
                    Ni uporabnikov
                  </td>
                </tr>
              ) : filtered.map((acc, i) => (
                <tr
                  key={acc.id}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
                    i % 2 === 0 ? 'bg-slate-900/20' : ''
                  }`}
                >
                  {COLS.map(col => (
                    <td key={col.key} className="px-3 py-2 max-w-[150px] truncate">
                      {formatVal(col.key, acc[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}