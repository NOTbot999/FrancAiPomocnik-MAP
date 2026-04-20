import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, User, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function AuthModal({ onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (login) => { setIsLogin(login); setError(''); setPassword(''); setConfirmPassword(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Vnesite podatke za prijavo'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('loginUser', { login: identifier, password });
      if (res.data.success) {
        localStorage.setItem('userAccountId', res.data.accountId);
        localStorage.setItem('userUsername', res.data.username);
        localStorage.setItem('userEmail', res.data.email || '');
        localStorage.setItem('userRole', res.data.role || 'user');
        localStorage.setItem('userIsPremium', res.data.is_premium ? 'true' : 'false');
        onSuccess?.(res.data);
        if (res.data.role === 'admin') window.location.href = '/admin';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Prijava ni uspela');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Uporabniško ime in geslo sta obvezna'); return; }
    if (password !== confirmPassword) { setError('Gesli se ne ujemata'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('registerUser', { username, password, email: email || null });
      if (res.data.success) {
        switchMode(true);
        setIdentifier(username);
        setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registracija ni uspela');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 z-10">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl mx-auto mb-2 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Slovenia GIS</h2>
          <p className="text-xs text-slate-500">Prijavite se za shranjevanje tras</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => switchMode(true)} className={`flex-1 py-1.5 rounded-lg font-semibold text-sm transition ${isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Prijava</button>
          <button onClick={() => switchMode(false)} className={`flex-1 py-1.5 rounded-lg font-semibold text-sm transition ${!isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Registracija</button>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-3">
          {isLogin ? (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Uporabniško ime ali e-mail" disabled={loading} className="pl-9" autoCapitalize="none" autoComplete="username" />
            </div>
          ) : (
            <>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Uporabniško ime" disabled={loading} className="pl-9" autoCapitalize="none" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail (priporočeno)" disabled={loading} className="pl-9" inputMode="email" />
              </div>
            </>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Geslo" disabled={loading} className="pl-9" autoComplete={isLogin ? 'current-password' : 'new-password'} />
          </div>

          {!isLogin && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ponovi geslo" disabled={loading} className="pl-9" autoComplete="new-password" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogin ? 'Prijava' : 'Ustvari račun'}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-3">Nadaljujte brez prijave — nekatere funkcije bodo omejene</p>
      </div>
    </div>
  );
}