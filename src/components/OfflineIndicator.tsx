import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:right-auto sm:max-w-md z-40 flex items-center justify-between gap-3 rounded-xl bg-amber-500/95 px-3.5 py-2.5 text-xs font-medium text-white shadow-lg backdrop-blur-xs animate-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-2">
        <span className="flex h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Weak or No Internet — Offline OCR (Tesseract) active</span>
      </div>
    </div>
  );
};
