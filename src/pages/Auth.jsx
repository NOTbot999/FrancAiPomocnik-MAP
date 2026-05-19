import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState(''); // username OR email for login
  const [username, setUsername] = useState('');      // only for register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Uporabniško ime in geslo sta obvezna'); return; }
    if (password !== confirmPassword) { setError('Gesli se ne ujemata'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('registerUser', { username, password, email: email || null });
      if (res.data.success) {
        base44.analytics.track({ eventName: "user_registered", properties: { has_email: !!(email) } });
        setIsLogin(true);
        setIdentifier(username);
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registracija ni uspela');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Vnesite podatke za prijavo'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('loginUser', { login: identifier, password });
      if (res.data.success) {
        base44.analytics.track({ eventName: "user_logged_in", properties: { role: res.data.role || 'user', is_premium: res.data.is_premium || false } });
        localStorage.setItem('userAccountId', res.data.accountId);
        localStorage.setItem('userUsername', res.data.username);
        localStorage.setItem('userEmail', res.data.email || '');
        localStorage.setItem('userRole', res.data.role || 'user');
        localStorage.setItem('userIsPremium', res.data.is_premium ? 'true' : 'false');
        if (res.data.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Prijava ni uspela');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login) => {
    setIsLogin(login);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "url('https://media.base44.com/images/public/69ad3ce309822f8e71f66838/b15473e19_5992128811794894233.jpg')",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#e8ede8"
      }}
    >
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Slovenia GIS</h1>
          <p className="text-sm text-slate-500 mt-1">Interaktivni zemljevid</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => switchMode(true)}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
              isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Prijava
          </button>
          <button
            onClick={() => switchMode(false)}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
              !isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Registracija
          </button>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-3">
          {/* Login: identifier (username or email) */}
          {isLogin && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">
                Uporabniško ime ali e-mail
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="janez123 ali janez@email.com"
                  disabled={loading}
                  className="pl-9"
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
            </div>
          )}

          {/* Register: username */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">
                Uporabniško ime
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="janez123"
                  disabled={loading}
                  className="pl-9"
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
            </div>
          )}

          {/* Register: email (optional but recommended for premium) */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">
                E-mail <span className="text-slate-400 normal-case font-normal">(priporočeno za premium)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="janez@email.com"
                  disabled={loading}
                  className="pl-9"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">
              Geslo
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="pl-9"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          {/* Confirm password */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">
                Ponovi geslo
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pl-9"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogin ? 'Prijava' : 'Ustvari račun'}
          </Button>

          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-700 transition text-center"
          >
            Nadaljuj brez prijave →
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-4 px-2">
          💡 Prijava ni obvezna — brez nje ne morete shranjevati tras in risb
        </p>
      </div>
    </div>
  );
}