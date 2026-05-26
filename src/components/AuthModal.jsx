import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, User, Mail, Lock, Loader2, AlertCircle, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SetupAccountModal from '@/components/SetupAccountModal';

export default function AuthModal({ onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const [setupAccount, setSetupAccount] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const switchMode = (login) => { setIsLogin(login); setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Vnesite podatke za prijavo'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('loginUser', { login: identifier.trim(), password });
      const data = res.data;

      if (data?.error) {
        setError('Napačno uporabniško ime ali geslo');
        return;
      }

      // Admin pre-created account with no password yet → force setup
      if (data?.needsSetup) {
        setSetupAccount({ id: data.accountId, email: identifier.trim() });
        return;
      }

      localStorage.setItem('userAccountId', data.accountId);
      localStorage.setItem('userUsername', data.username);
      localStorage.setItem('userEmail', data.email || '');
      localStorage.setItem('userRole', data.role || 'user');
      localStorage.setItem('userIsPremium', data.is_premium ? 'true' : 'false');
      onSuccess?.(data);
      if (data.role === 'admin') window.location.href = '/admin';
    } catch (err) {
      setError('Prijava ni uspela');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Uporabniško ime in geslo sta obvezna'); return; }
    if (password.length < 6) { setError('Geslo mora imeti vsaj 6 znakov'); return; }
    if (password !== confirmPassword) { setError('Gesli se ne ujemata'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('registerUser', {
        username: username.trim().toLowerCase(),
        password,
        email: email.trim() || undefined,
      });
      if (res.data?.error) {
        const msg = res.data.error;
        if (msg.includes('already taken') || msg.includes('Username already')) {
          setError('Uporabniško ime že obstaja');
        } else {
          setError('Registracija ni uspela: ' + msg);
        }
        return;
      }
      setSuccess('Račun ustvarjen! Prijavite se.');
      switchMode(true);
      setIdentifier(username.trim().toLowerCase());
      setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
    } catch (err) {
      setError('Registracija ni uspela');
    } finally { setLoading(false); }
  };

  if (setupAccount) {
    return (
      <SetupAccountModal
        account={setupAccount}
        onComplete={(updatedAccount) => {
          setSetupAccount(null);
          onSuccess?.(updatedAccount);
          if (updatedAccount.role === 'admin') window.location.href = '/admin';
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
      >
        {/* Green header stripe */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 pt-6 pb-5">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Slovenia GIS</h2>
              <p className="text-xs text-white/70">Interaktivni GIS Explorer</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => switchMode(true)} className={`flex-1 py-1.5 rounded-lg font-semibold text-sm transition ${isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Prijava</button>
            <button onClick={() => switchMode(false)} className={`flex-1 py-1.5 rounded-lg font-semibold text-sm transition ${!isLogin ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Registracija</button>
          </div>

          <AnimatePresence mode="wait">
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs mb-3"
              >
                ✅ {success}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-3">
            {isLogin ? (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Uporabniško ime ali e-mail" disabled={loading} className="pl-9 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20" autoCapitalize="none" autoComplete="username" />
              </div>
            ) : (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Uporabniško ime" disabled={loading} className="pl-9 border-slate-200 focus:border-emerald-400" autoCapitalize="none" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail (priporočeno)" disabled={loading} className="pl-9 border-slate-200 focus:border-emerald-400" inputMode="email" />
                </div>
              </>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Geslo" disabled={loading} className="pl-9 border-slate-200 focus:border-emerald-400" autoComplete={isLogin ? 'current-password' : 'new-password'} />
            </div>

            {!isLogin && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ponovi geslo" disabled={loading} className="pl-9 border-slate-200 focus:border-emerald-400" autoComplete="new-password" />
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs"
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 py-2.5 transition-all">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? 'Prijava' : 'Ustvari račun'}
            </Button>
          </form>

          <button
            onClick={onClose}
            className="w-full mt-3 text-center text-xs text-slate-400 hover:text-slate-600 transition py-1"
          >
            Nadaljuj brez prijave →
          </button>
        </div>
      </motion.div>
    </div>
  );
}