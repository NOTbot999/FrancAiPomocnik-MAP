import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Clock, Smartphone, Monitor, Globe, TrendingUp, LogOut, Map, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.UserAccount.list('-created_date', 200);
    setAccounts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    localStorage.removeItem('userUsername');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    window.location.href = '/auth';
  };

  // Analytics calculations
  const totalUsers = accounts.length;
  const activeToday = accounts.filter(a => {
    if (!a.last_login) return false;
    const diff = Date.now() - new Date(a.last_login).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length;
  const activeThisWeek = accounts.filter(a => {
    if (!a.last_login) return false;
    const diff = Date.now() - new Date(a.last_login).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const neverLoggedIn = accounts.filter(a => !a.last_login).length;

  // Device breakdown
  const deviceCounts = accounts.reduce((acc, a) => {
    const d = a.device_type || 'unknown';
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#6b7280'];

  // OS breakdown
  const osCounts = accounts.reduce((acc, a) => {
    const os = a.os || 'unknown';
    acc[os] = (acc[os] || 0) + 1;
    return acc;
  }, {});
  const osData = Object.entries(osCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Registrations by day (last 14 days)
  const regByDay = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('sl-SI', { month: 'short', day: 'numeric' });
    const count = accounts.filter(a => {
      const cd = new Date(a.created_date);
      return cd.toDateString() === d.toDateString();
    }).length;
    regByDay.push({ label, count });
  }

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const StatCard = ({ icon: IconComp, label, value, color }) => (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <IconComp className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">
            <RefreshCw className="w-4 h-4" /> Osveži
          </button>
          <a href="/" className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition">
            <Map className="w-4 h-4" /> Zemljevid
          </a>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
            <LogOut className="w-4 h-4" /> Odjava
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon={Users} label="Skupaj uporabnikov" value={totalUsers} color="bg-emerald-500" />
              <StatCard icon={Clock} label="Aktivni danes" value={activeToday} color="bg-blue-500" />
              <StatCard icon={TrendingUp} label="Aktivni ta teden" value={activeThisWeek} color="bg-violet-500" />
              <StatCard icon={Globe} label="Nikoli prijavljeni" value={neverLoggedIn} color="bg-amber-500" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {['overview', 'users', 'devices'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === t ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                  {t === 'overview' ? 'Pregled' : t === 'users' ? 'Uporabniki' : 'Naprave'}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Registracije (zadnjih 14 dni)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={regByDay}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Tip naprave</h3>
                  {deviceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={deviceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-400 text-center mt-10">Ni podatkov o napravah</p>}
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 md:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Operacijski sistemi</h3>
                  <div className="space-y-2">
                    {osData.map((os, i) => (
                      <div key={os.name} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-24 truncate">{os.name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(os.value / totalUsers) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-6 text-right">{os.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Users tab */}
            {tab === 'users' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Uporabnik', 'Email', 'Naprava', 'OS', 'Registriran', 'Zadnja prijava'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a, i) => (
                      <tr key={a.id} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="px-4 py-3 font-medium text-slate-800">{a.username}</td>
                        <td className="px-4 py-3 text-slate-500">{a.email || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-slate-600">
                            {a.device_type === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                            {a.device_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{a.os || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(a.created_date)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(a.last_login)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Devices tab */}
            {tab === 'devices' && (
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(deviceCounts).map(([device, count], i) => (
                  <div key={device} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center">
                    {device === 'mobile' ? <Smartphone className="w-8 h-8 mx-auto mb-2 text-emerald-500" /> : <Monitor className="w-8 h-8 mx-auto mb-2 text-blue-500" />}
                    <p className="text-3xl font-bold text-slate-800">{count}</p>
                    <p className="text-sm text-slate-500 capitalize">{device}</p>
                    <p className="text-xs text-slate-400 mt-1">{((count / totalUsers) * 100).toFixed(1)}% vseh</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}