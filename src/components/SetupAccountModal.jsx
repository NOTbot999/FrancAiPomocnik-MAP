import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Lock, Loader2, AlertCircle, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Shown when admin pre-created user has no username/password set yet
export default function SetupAccountModal({ account, onComplete }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Vnesite uporabniško ime'); return; }
    if (username.trim().length < 3) { setError('Uporabniško ime mora imeti vsaj 3 znake'); return; }
    if (!password) { setError('Vnesite geslo'); return; }
    if (password.length < 6) { setError('Geslo mora imeti vsaj 6 znakov'); return; }
    if (password !== confirmPassword) { setError('Gesli se ne ujemata'); return; }

    setLoading(true);
    try {
      // Check username uniqueness
      const existing = await base44.entities.UserAccount.filter({ username: username.trim().toLowerCase() });
      if (existing.length > 0) { setError('Uporabniško ime že obstaja'); setLoading(false); return; }

      // Update the account
      await base44.entities.UserAccount.update(account.id, {
        username: username.trim().toLowerCase(),
        password: password,
        login_method: account.email ? 'both' : 'username',
      });

      // Update localStorage
      localStorage.setItem('userUsername', username.trim().toLowerCase());
      localStorage.setItem('userAccountId', account.id);
      localStorage.setItem('userEmail', account.email || '');
      localStorage.setItem('userRole', account.role || 'user');
      localStorage.setItem('userIsPremium', account.is_premium ? 'true' : 'false');

      onComplete?.({ ...account, username: username.trim().toLowerCase(), password });
    } catch (err) {
      setError('Napaka pri shranjevanju. Poskusite znova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Dobrodošli!</h2>
              <p className="text-xs text-white/70">Nastavite svoj račun</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500 mb-4">
            Vaš račun je bil ustvarjen. Pred nadaljevanjem nastavite uporabniško ime in geslo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Izberite uporabniško ime"
                disabled={loading}
                className="pl-9 border-slate-200 focus:border-emerald-400"
                autoCapitalize="none"
                autoFocus
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Izberite geslo"
                disabled={loading}
                className="pl-9 border-slate-200 focus:border-emerald-400"
                autoComplete="new-password"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ponovi geslo"
                disabled={loading}
                className="pl-9 border-slate-200 focus:border-emerald-400"
                autoComplete="new-password"
              />
            </div>

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

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 py-2.5 transition-all"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Shrani in nadaljuj
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}