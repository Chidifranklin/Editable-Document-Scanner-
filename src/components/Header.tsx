import React, { useState } from 'react';
import {
  Scan,
  History,
  Sun,
  Moon,
  Download,
  Wifi,
  WifiOff,
  User,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface HeaderProps {
  activeTab: 'scan' | 'history';
  setActiveTab: (tab: 'scan' | 'history') => void;
  historyCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenAuth: () => void;
  user: any;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
  darkMode,
  setDarkMode,
  onOpenAuth,
  user,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowUserMenu(false);
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#E8E0D0] bg-[#FFFDF8]/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 transition-colors">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-2.5 sm:px-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Scan className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                ScanText
              </span>
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                PWA
              </span>
            </div>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <div className="flex items-center rounded-xl bg-[#F3EDE0] p-1 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'scan'
                ? 'bg-[#FFFDF8] text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Scan className="h-3.5 w-3.5" />
            <span>Scan</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-[#FFFDF8] text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="ml-0.5 rounded-full bg-[#E8E0D0] px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-600 dark:text-slate-300">
                {historyCount}
              </span>
            )}
          </button>
        </div>

        {/* Right actions: Connectivity, Install, Theme, Auth */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Online/Offline status pill */}
          <div
            title={isOnline ? 'Online - Cloud Vision & Tesseract available' : 'Offline - Tesseract OCR available'}
            className={`hidden xs:flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="text-[10px]">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* In-App PWA Install Button */}
          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
              title="Install ScanText App"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Install</span>
            </button>
          )}

          {!isInstalled && isIOS && (
            <button
              onClick={() => setShowIOSModal(true)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Install on iPhone/iPad"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Install</span>
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 transition"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User Profile / Auth Button */}
          <div className="relative">
            {user ? (
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-blue-500/30 overflow-hidden active:scale-95 transition bg-blue-100 dark:bg-blue-900"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-200">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition active:scale-95"
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Sign In</span>
              </button>
            )}

            {/* Dropdown for signed in user */}
            {user && showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-800 z-50">
                <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {user.displayName || 'ScanText User'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* iOS Safari PWA install guide modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Install ScanText on iOS</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              To install ScanText on your iPhone or iPad for offline use:
            </p>
            <ol className="mt-3 space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <li>
                Tap the <span className="font-semibold text-blue-600">Share</span> icon at the bottom of Safari.
              </li>
              <li>Scroll down the menu.</li>
              <li>
                Tap <span className="font-semibold text-blue-600">Add to Home Screen</span>.
              </li>
            </ol>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
