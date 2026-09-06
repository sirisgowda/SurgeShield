import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ShieldAlert, ArrowLeft, RefreshCw, Sparkles, Ticket } from 'lucide-react';
import { useState } from 'react';

export default function RoleGuard({ allowedRoles, children }) {
  const { user, role, loading, demoLogin } = useAuth();
  const [switching, setSwitching] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const requiredRole = allowedRoles[0];
    
    const handleSwitch = async () => {
      setSwitching(true);
      try {
        await demoLogin(requiredRole);
      } catch (e) {
        console.error(e);
      } finally {
        setSwitching(false);
      }
    };

    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="glass-panel p-8 rounded-3xl text-center space-y-5 border border-rose-500/20 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-rose-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Access Restricted</h2>
            <p className="text-sm text-stone-300">
              This area is reserved strictly for <span className="font-semibold text-orange-300 uppercase">{requiredRole}</span> accounts.
            </p>
            <p className="text-xs text-stone-400">
              You are currently authenticated as an <span className="font-semibold text-orange-400">{role}</span> ({user.email}).
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={handleSwitch}
              disabled={switching}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-orange-600 via-amber-500 to-rose-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {requiredRole === 'organizer' ? <Sparkles className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
              <span>{switching ? 'Switching Persona…' : `Switch to Demo ${requiredRole.toUpperCase()}`}</span>
            </button>

            <Link
              to="/events"
              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events Hub</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
