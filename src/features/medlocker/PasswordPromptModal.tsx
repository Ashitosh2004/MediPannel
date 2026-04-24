import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onVerified: () => void;
}

/**
 * PasswordPromptModal
 * Re-authenticates the currently signed-in patient using Firebase Auth.
 * Never stores or transmits the password — it's only used locally for
 * Firebase's reauthenticateWithCredential() call.
 */
export function PasswordPromptModal({ onClose, onVerified }: Props) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function verify() {
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No authenticated user');
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      onVerified();
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-muted-foreground hover:text-foreground"
          >
            <X size={15} />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Lock size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-black text-foreground text-base leading-tight">Verify Identity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Enter your account password to proceed</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Your password is verified locally via Firebase Authentication. It is{' '}
            <span className="font-bold text-foreground">never stored or transmitted</span> by this app.
          </p>

          {/* Password input */}
          <div className="relative mb-3">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && verify()}
              placeholder="Your account password"
              autoFocus
              className={`w-full border rounded-xl px-4 py-3 text-sm bg-background text-foreground placeholder:text-muted-foreground pr-11 focus:outline-none transition-colors ${
                error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary/50'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-destructive mb-3 font-medium">{error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={verify}
              disabled={loading || !password}
              className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</>
              ) : (
                <><Lock size={14} />Unlock File</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
