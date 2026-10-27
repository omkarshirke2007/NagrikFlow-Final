import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './components/Dashboard';
import { TasksManager } from './components/TasksManager';
import { CollectionMap } from './components/CollectionMap';
import { ComplaintsManager } from './components/ComplaintsManager';
import { AuthModal } from './components/AuthModal';
import { UserRole } from './types';
import {
  LayoutDashboard,
  ClipboardList,
  MapPin,
  AlertTriangle,
  LogOut,
  LogIn,
  Menu,
  X,
  Shield,
  Truck,
  UserCheck,
  CheckCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

type NavTab = 'dashboard' | 'tasks' | 'map' | 'complaints';

const MainLayout: React.FC = () => {
  const { user, profile, effectiveRole, setEffectiveRole, quickDemoSignIn, logout, isFirebaseConnected } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [roleInfoModalOpen, setRoleInfoModalOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Collection Tasks', icon: ClipboardList },
    { id: 'map', label: 'Collection Map', icon: MapPin },
    { id: 'complaints', label: 'Citizen Complaints', icon: AlertTriangle },
  ] as const;

  const handleNav = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const getRoleBadgeStyle = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'worker':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'citizen':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getRoleIcon = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return <Shield className="w-3.5 h-3.5" />;
      case 'worker':
        return <Truck className="w-3.5 h-3.5" />;
      case 'citizen':
      default:
        return <UserCheck className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 p-5 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 block leading-tight">
                NagrikFlow
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase">
                नागरिक प्रवाह • Urban Waste
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-700/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Role Evaluation / View-As Switcher (For college project grading convenience) */}
          {user && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Active Role View
                </span>
                <button
                  onClick={() => setRoleInfoModalOpen(true)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Role capabilities info"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(['admin', 'worker', 'citizen'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setEffectiveRole(r)}
                    className={`py-1 px-1.5 text-[10px] font-bold rounded-lg capitalize transition-all cursor-pointer border ${
                      effectiveRole === r
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Switch perspective to verify Worker or Citizen permissions.
              </p>
            </div>
          )}
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-200/80 space-y-3">
          {user ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="truncate mr-2">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {profile?.displayName || user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                    effectiveRole
                  )}`}
                >
                  {getRoleIcon(effectiveRole)}
                  <span>{effectiveRole}</span>
                </span>
              </div>

              <button
                onClick={logout}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}

          {/* Firestore Connection Indicator */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isFirebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{isFirebaseConnected ? 'Firestore Connected' : 'Offline / Connecting'}</span>
            </span>
            <span className="text-[10px] font-mono">v1.0-prod</span>
          </div>
        </div>
      </aside>

      {/* MOBILE TOPBAR */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900 leading-none block">
              NagrikFlow
            </span>
            <span className="text-[9px] font-semibold text-emerald-700 uppercase">
              Urban Waste Management
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                effectiveRole
              )}`}
            >
              {effectiveRole}
            </span>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
            >
              Login
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-3 z-30 shadow-lg">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {user && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Switch Role View:</span>
              <div className="flex gap-1">
                {(['admin', 'worker', 'citizen'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setEffectiveRole(r);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-2 py-1 text-[11px] rounded font-bold capitalize ${
                      effectiveRole === r
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!user && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>One-Click Demo Evaluation:</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    quickDemoSignIn('admin');
                    setMobileMenuOpen(false);
                  }}
                  className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold text-center cursor-pointer"
                >
                  Admin
                </button>
                <button
                  onClick={() => {
                    quickDemoSignIn('worker');
                    setMobileMenuOpen(false);
                  }}
                  className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold text-center cursor-pointer"
                >
                  Worker
                </button>
                <button
                  onClick={() => {
                    quickDemoSignIn('citizen');
                    setMobileMenuOpen(false);
                  }}
                  className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold text-center cursor-pointer"
                >
                  Citizen
                </button>
              </div>
            </div>
          )}

          {user && (
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 text-xs font-semibold text-rose-700 bg-rose-50 rounded-xl flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar for Desktop */}
        <header className="hidden md:flex bg-white border-b border-slate-200/80 px-8 py-4 items-center justify-between sticky top-0 z-20 shadow-xs">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              NagrikFlow • Municipal Waste System
            </span>
            <div className="text-sm font-bold text-slate-800 capitalize">
              {activeTab === 'dashboard'
                ? 'Executive Operations Dashboard'
                : activeTab === 'tasks'
                ? 'Task Dispatch & Field Worker Table'
                : activeTab === 'map'
                ? 'Verified Collection Point Geolocation'
                : 'Citizen Waste Complaints & Grievance Redressal'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-400 px-2 hidden xl:inline">
                    Role View:
                  </span>
                  {(['admin', 'worker', 'citizen'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setEffectiveRole(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                        effectiveRole === r
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-slate-800 max-w-[140px] truncate">
                    {profile?.displayName || user.email}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getRoleBadgeStyle(
                      effectiveRole
                    )}`}
                  >
                    {effectiveRole}
                  </span>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 px-2 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Demo Login:</span>
                  </span>
                  <button
                    onClick={() => quickDemoSignIn('admin')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-900 border border-slate-200 hover:border-amber-300 rounded-lg font-semibold text-xs transition-all shadow-2xs cursor-pointer"
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => quickDemoSignIn('worker')}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-300 rounded-lg font-semibold text-xs transition-all shadow-2xs cursor-pointer"
                  >
                    Worker
                  </button>
                  <button
                    onClick={() => quickDemoSignIn('citizen')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-lg font-semibold text-xs transition-all shadow-2xs cursor-pointer"
                  >
                    Citizen
                  </button>
                </div>

                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'tasks' && <TasksManager />}
          {activeTab === 'map' && <CollectionMap />}
          {activeTab === 'complaints' && <ComplaintsManager />}
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Role Information Modal */}
      {roleInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>NagrikFlow User Roles</span>
              </h3>
              <button
                onClick={() => setRoleInfoModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                <span className="font-bold text-amber-900 block">Municipal Staff / Admin</span>
                <p>
                  Full access: Dispatches collection tasks, adds verified geographic points to the map, reviews all citizen complaints, and updates resolution remarks.
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
                <span className="font-bold text-blue-900 block">Collection Worker</span>
                <p>
                  Operational access: Views assigned collection tasks, updates statuses (In Progress, Completed, Missed), and enters mandatory notes for missed pickups.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-900 block">Citizen</span>
                <p>
                  Civic access: Reports waste grievances with category, GPS coordinates, photo, and tracks personal complaint resolution timeline.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setRoleInfoModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
