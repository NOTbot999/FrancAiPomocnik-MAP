import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, LogIn, Crown } from "lucide-react";

/**
 * Premium gate modal — shown when a non-premium user tries to open a
 * premium-only feature (AI, 3D Pogled, AR Pogled, Skupno delo).
 *
 * - Not logged in → prompt to log in (calls onLogin).
 * - Logged in but not premium → inform that the feature requires a premium account.
 */
export default function PremiumGateModal({ feature, isLoggedIn, onLogin, onClose }) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
              {!isLoggedIn ? (
                <LogIn className="w-8 h-8 text-amber-500" />
              ) : (
                <Lock className="w-8 h-8 text-amber-500" />
              )}
            </div>

            <div>
              <p className="text-base font-bold text-slate-800 mb-1.5 flex items-center justify-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                {feature} — Premium
              </p>
              {!isLoggedIn ? (
                <p className="text-sm text-slate-500 leading-relaxed">
                  Za dostop do funkcije <span className="font-semibold text-slate-700">{feature}</span> se prijavite v svoj račun.
                </p>
              ) : (
                <p className="text-sm text-slate-500 leading-relaxed">
                  <span className="font-semibold text-slate-700">{feature}</span> je na voljo samo za premium uporabnike. Kontaktirajte skrbnika za aktivacijo premium računa.
                </p>
              )}
            </div>

            {!isLoggedIn ? (
              <button
                onClick={onLogin}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl py-2.5 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Prijava
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl py-2.5 transition-all"
              >
                V redu
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}