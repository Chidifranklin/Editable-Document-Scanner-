import React, { useState } from 'react';
import {
  Search,
  Trash2,
  FileText,
  Clock,
  Zap,
  Cpu,
  ArrowRight,
  Download,
  AlertTriangle,
  FolderOpen,
  CloudCheck,
  CloudOff,
  User,
} from 'lucide-react';
import { ScanItem, deleteScanRecord } from '../services/scanStorage';
import { exportToDocx, exportToPdf, downloadBlob } from '../services/exportService';

interface ScanHistoryViewProps {
  scans: ScanItem[];
  onSelectScan: (scan: ScanItem) => void;
  onRefresh: () => void;
  onOpenAuth: () => void;
  user: any;
}

export const ScanHistoryView: React.FC<ScanHistoryViewProps> = ({
  scans,
  onSelectScan,
  onRefresh,
  onOpenAuth,
  user,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [engineFilter, setEngineFilter] = useState<'all' | 'cloud' | 'tesseract'>('all');
  const [itemToDelete, setItemToDelete] = useState<ScanItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter scans
  const filteredScans = scans.filter((scan) => {
    const matchesSearch =
      scan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.text.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEngine =
      engineFilter === 'all' ? true : scan.engine === engineFilter;

    return matchesSearch && matchesEngine;
  });

  // Delete confirmation handler
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteScanRecord(itemToDelete.id);
      setItemToDelete(null);
      onRefresh();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick export from history list
  const handleQuickExportDocx = async (scan: ScanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await exportToDocx(scan.title, scan.text);
      downloadBlob(blob, `${scan.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'scan'}.docx`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleQuickExportPdf = async (scan: ScanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await exportToPdf(scan.title, scan.text);
      downloadBlob(blob, `${scan.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'scan'}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] max-w-4xl mx-auto p-3 sm:p-5 overflow-hidden">
      {/* Header with Search and Engine Filters */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Scan History
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {scans.length} document{scans.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Guest Banner if not signed in */}
        {!user && (
          <div className="flex items-center justify-between rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-3.5 py-2 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-blue-500 shrink-0" />
              <span>Scans are saved on this device. Sign in with Google to sync them anywhere.</span>
            </div>
            <button
              onClick={onOpenAuth}
              className="ml-2 font-semibold underline hover:text-blue-600 whitespace-nowrap"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Search input & filter tabs */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents by title or text..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800 shrink-0">
            <button
              onClick={() => setEngineFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                engineFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setEngineFilter('cloud')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                engineFilter === 'cloud'
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Zap className="h-3 w-3" />
              <span>Cloud AI</span>
            </button>
            <button
              onClick={() => setEngineFilter('tesseract')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                engineFilter === 'tesseract'
                  ? 'bg-white text-emerald-600 shadow-xs dark:bg-slate-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Cpu className="h-3 w-3" />
              <span>Offline</span>
            </button>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 pb-20">
        {filteredScans.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 dark:text-slate-500">
            <FolderOpen className="h-12 w-12 mb-3 stroke-1 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {searchTerm ? 'No matching scans found' : 'No scans yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">
              {searchTerm
                ? 'Try a different search word or filter.'
                : 'Tap the big "Scan" button below to take a photo or upload an image/PDF!'}
            </p>
          </div>
        ) : (
          filteredScans.map((scan) => {
            const dateStr = new Date(scan.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = new Date(scan.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={scan.id}
                onClick={() => onSelectScan(scan)}
                className="group relative flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 cursor-pointer active:scale-99 transition"
              >
                {/* Thumbnail */}
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200/60 dark:border-slate-800">
                  {scan.thumbnailUrl ? (
                    <img
                      src={scan.thumbnailUrl}
                      alt={scan.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-6 w-6 text-slate-400" />
                  )}
                </div>

                {/* Info and Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {scan.title}
                    </h3>

                    {/* Engine Pill */}
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium shrink-0 ${
                        scan.engine === 'cloud'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {scan.engine === 'cloud' ? <Zap className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
                      {scan.engine === 'cloud' ? 'Cloud' : 'Offline'}
                    </span>
                  </div>

                  {/* Snippet */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {scan.text || 'No text extracted'}
                  </p>

                  {/* Metadata line */}
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {dateStr} {timeStr}
                    </span>
                    <span>•</span>
                    <span>{scan.wordCount || 0} words</span>
                  </div>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleQuickExportPdf(scan, e)}
                    className="flex h-8 px-1.5 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800 transition text-[10px] font-bold"
                    title="Export to .pdf"
                  >
                    PDF
                  </button>

                  <button
                    onClick={(e) => handleQuickExportDocx(scan, e)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 transition"
                    title="Export to .docx"
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(scan);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition"
                    title="Delete scan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition hidden sm:block" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Scan?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 truncate">
              "{itemToDelete.title}"
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 active:scale-95 transition"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
