import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { BOOTSTRAP_ADMIN_EMAIL } from '../lib/firebase';
import { ShieldCheck, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword, quickDemoSignIn } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('citizen');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (isReset) {
        if (!email) throw new Error('Please enter your registered email address.');
        await resetPassword(email);
        setSuccessMsg('Password reset link sent to your email inbox.');
      } else if (isRegister) {
        if (!email || !password || !name) {
          throw new Error('Please fill in all required fields.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await registerWithEmail(email, password, name, role);
        onClose();
      } else {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        await loginWithEmail(email, password);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication operation failed.';
      // Make Firebase errors human-friendly
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        setError('Invalid email or password. Please verify and try again.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setError('This email is already registered. Please log in instead.');
      } else if (msg.includes('auth/weak-password')) {
        setError('Password should be at least 6 characters.');
      } else if (msg.includes('auth/user-not-found')) {
        setError('No account found with this email.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign in failed.';
      if (!msg.includes('auth/popup-closed-by-user')) {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick fill helper for college evaluator / demo convenience
  const fillDemoAccount = (demoType: 'admin' | 'worker' | 'citizen') => {
    if (demoType === 'admin') {
      setEmail(BOOTSTRAP_ADMIN_EMAIL);
      setPassword('Admin@123456');
      setName('Omkar Shirke (Admin)');
      setRole('admin');
    } else if (demoType === 'worker') {
      setEmail('worker.rajesh@nagrikflow.in');
      setPassword('Worker@123456');
      setName('Rajesh Kumar (Field Worker)');
      setRole('worker');
    } else {
      setEmail('citizen.priya@nagrikflow.in');
      setPassword('Citizen@123456');
      setName('Priya Sharma (Resident)');
      setRole('citizen');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md mb-3 border border-white/20">
            <ShieldCheck className="w-6 h-6 text-emerald-200" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {isReset
              ? 'Reset Password'
              : isRegister
              ? 'Register with NagrikFlow'
              : 'Sign in to NagrikFlow'}
          </h2>
          <p className="text-xs text-emerald-100 mt-1">
            {isReset
              ? 'Enter your email to receive recovery instructions'
              : isRegister
              ? 'Join your municipal waste management portal'
              : 'Access dispatch tasks, verified points & complaints'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@city.gov.in or citizen@domain.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {!isReset && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsReset(true);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            )}

            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['citizen', 'worker', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border text-center capitalize transition-all ${
                        role === r
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'admin' ? 'Admin' : r === 'worker' ? 'Worker' : 'Citizen'}
                    </button>
                  ))}
                </div>
                {role === 'admin' && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    * Admin role is verified against authorized municipal authority credentials ({BOOTSTRAP_ADMIN_EMAIL}).
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium text-sm rounded-xl shadow-sm shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {isReset
                      ? 'Send Reset Link'
                      : isRegister
                      ? 'Complete Registration'
                      : 'Sign In to Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {!isReset && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">or sign in with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

          {/* Quick Demo Pre-fill / 1-Click Login Links for Evaluators */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Evaluator 1-Click Instant Demo Login
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setError(null);
                  try {
                    await quickDemoSignIn('admin');
                    onClose();
                  } catch (e: any) {
                    setError(e.message || 'Demo login failed');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="py-1.5 px-2 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-semibold text-[11px] rounded-xl transition-all shadow-xs cursor-pointer"
                title="1-Click login as Municipal Administrator"
              >
                ⚡ Admin
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setError(null);
                  try {
                    await quickDemoSignIn('worker');
                    onClose();
                  } catch (e: any) {
                    setError(e.message || 'Demo login failed');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="py-1.5 px-2 bg-blue-50 text-blue-900 border border-blue-300 hover:bg-blue-100 font-semibold text-[11px] rounded-xl transition-all shadow-xs cursor-pointer"
                title="1-Click login as Collection Worker"
              >
                ⚡ Worker
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setError(null);
                  try {
                    await quickDemoSignIn('citizen');
                    onClose();
                  } catch (e: any) {
                    setError(e.message || 'Demo login failed');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="py-1.5 px-2 bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 font-semibold text-[11px] rounded-xl transition-all shadow-xs cursor-pointer"
                title="1-Click login as Citizen"
              >
                ⚡ Citizen
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Instantly signs in with verified test credentials & provisions demo data.
            </p>
          </div>

          {/* Switcher Footer */}
          <div className="mt-4 text-center">
            {isReset ? (
              <button
                type="button"
                onClick={() => {
                  setIsReset(false);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Back to Sign In
              </button>
            ) : isRegister ? (
              <p className="text-xs text-slate-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                >
                  Create one now
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
