import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { 
  Calendar, 
  PlusCircle, 
  LogOut, 
  ChevronDown,
  Zap,
  Ticket,
  Sparkles
} from 'lucide-react';

export default function Navbar() {
  const { user, role, isOrganizer, isAttendee, logout, demoLogin } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  const handleRoleSwitch = async (targetRole) => {
    setSwitching(true);
    setMenuOpen(false);
    try {
      await demoLogin(targetRole);
      nav(targetRole === 'organizer' ? '/ops' : '/events');
    } catch (e) {
      console.error(e);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#171210] border-b border-[#2e2622]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/events" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-[#ea580c] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-orange-400 transition-colors">
                Surge<span className="text-orange-500">Shield</span>
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#2e2622] text-orange-400 border border-[#3e342f]">
                BURST PRO
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-medium -mt-1 hidden sm:block">Event Ingestion Engine</p>
          </div>
        </Link>

        {/* Navigation links based on RBAC */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/events"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/events')
                ? 'bg-[#261f1b] text-orange-400 border border-[#3e342f]'
                : 'text-stone-400 hover:text-white hover:bg-[#201a17]'
            }`}
          >
            <Calendar className="w-4 h-4 text-orange-500" />
            <span>Events</span>
          </Link>

          {/* Attendee Link */}
          <Link
            to="/me"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/me')
                ? 'bg-[#261f1b] text-orange-400 border border-[#3e342f]'
                : 'text-stone-400 hover:text-white hover:bg-[#201a17]'
            }`}
          >
            <Ticket className="w-4 h-4 text-orange-500" />
            <span>My Tickets</span>
          </Link>

          {/* Organizer-only Link */}
          {isOrganizer && (
            <Link
              to="/ops"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/ops')
                  ? 'bg-[#ea580c] text-white'
                  : 'bg-[#2a221e] text-orange-300 hover:bg-[#332a25]'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-orange-300" />
              <span>Create Event</span>
            </Link>
          )}
        </nav>

        {/* User Role Badge & Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              disabled={switching}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#382f29] bg-[#1c1714] hover:border-orange-500 transition-colors cursor-pointer"
            >
              {isOrganizer ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-orange-300">Organizer</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-amber-300">Attendee</span>
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* Role Switcher Menu */}
            {menuOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 rounded-2xl solid-panel p-2 shadow-xl z-50 bg-[#1c1714]"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-[#2e2622] mb-1">
                  <p className="text-xs font-medium text-stone-400">Active Role Account</p>
                  <p className="text-xs font-semibold text-orange-200 truncate">{user.email}</p>
                </div>

                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Switch Demo Persona
                </p>

                <button
                  onClick={() => handleRoleSwitch('attendee')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                    isAttendee 
                      ? 'bg-[#2a221e] text-orange-300 border border-orange-600' 
                      : 'text-stone-300 hover:bg-[#241e1a]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Ticket className="w-3.5 h-3.5 text-orange-500" />
                    <span>Attendee Persona</span>
                  </div>
                  {isAttendee && <span className="text-[10px] text-orange-400 font-bold">ACTIVE</span>}
                </button>

                <button
                  onClick={() => handleRoleSwitch('organizer')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors mt-1 ${
                    isOrganizer 
                      ? 'bg-[#2a221e] text-orange-300 border border-orange-600' 
                      : 'text-stone-300 hover:bg-[#241e1a]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                    <span>Organizer Persona</span>
                  </div>
                  {isOrganizer && <span className="text-[10px] text-orange-400 font-bold">ACTIVE</span>}
                </button>
              </div>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            title="Log out"
            className="p-2 rounded-lg text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
