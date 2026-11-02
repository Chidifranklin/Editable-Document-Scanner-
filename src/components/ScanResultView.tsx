import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Share2,
  FileDown,
  Sparkles,
  Save,
  RotateCw,
  Eye,
  X,
  FileText,
  BookmarkCheck,
  Loader2,
  Globe,
  Zap,
  Cpu,
  Undo2,
  Plus,
} from 'lucide-react';
import {
  exportToDocx,
  exportMultiPageToDocx,
  exportToPdf,
  exportMultiPageToPdf,
  exportToTxt,
  downloadBlob,
  copyToClipboard,
  shareContent,
} from '../services/exportService';
import { runAICleanup, SUPPORTED_LANGUAGES, OCRLanguage } from '../services/ocrService';
import { saveScanRecord, ScanItem } from '../services/scanStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { detectEntities } from '../utils/entityDetector';
import { DataPatternsView } from './DataPatternsView';

export interface PageResultItem {
  pageNumber: number;
  text: string;
  image: string;
}

interface ScanResultViewProps {
  originalImage: string;
  initialText: string;
  engine: 'cloud' | 'tesseract';
  selectedLanguage: string;
  mode?: 'document' | 'handwriting';
  pageResults?: PageResultItem[];
  onLanguageChange: (lang: string) => void;
  onRescan: (engineToUse: 'cloud' | 'tesseract') => void;
  onModeChange?: (mode: 'document' | 'handwriting') => void;
  onNewScan: () => void;
  onSaved?: (scan: ScanItem) => void;
  onAddMorePages?: () => void;
}

export const ScanResultView: React.FC<ScanResultViewProps> = ({
  originalImage,
  initialText,
  engine,
  selectedLanguage,
  mode = 'document',
  pageResults = [],
  onLanguageChange,
  onRescan,
  onModeChange,
  onNewScan,
  onSaved,
  onAddMorePages,
}) => {
  const isOnline = useOnlineStatus();
  const [text, setText] = useState(initialText);
  const [previousText, setPreviousText] = useState<string | null>(null);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number | 'all'>('all');
  const [title, setTitle] = useState(() => {
    const firstLine = initialText.trim().split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 3) {
      return firstLine.slice(0, 45);
    }
    return `Scan ${new Date().toLocaleDateString()}`;
  });

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'editor' | 'patterns'>('editor');

  // Detect data patterns (dates, emails, phones, currencies, links)
  const entityData = useMemo(() => detectEntities(text), [text]);

  // Copy handler
  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Share handler
  const handleShare = async () => {
    const shared = await shareContent(title, text);
    if (!shared) {
      handleCopy();
      setStatusMessage('Copied to clipboard (Share menu not available)');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Export PDF handler
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      let blob: Blob;
      if (pageResults && pageResults.length > 1) {
        blob = await exportMultiPageToPdf(title, pageResults);
      } else {
        blob = await exportToPdf(title, text);
      }
      const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'scan'}.pdf`;
      downloadBlob(blob, filename);
      setStatusMessage('Exported to .pdf document successfully');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setStatusMessage('Failed to export PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export DOCX handler
  const handleExportDocx = async () => {
    try {
      setIsExportingDocx(true);
      let blob: Blob;
      if (pageResults && pageResults.length > 1) {
        blob = await exportMultiPageToDocx(title, pageResults);
      } else {
        blob = await exportToDocx(title, text);
      }
      const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'scan'}.docx`;
      downloadBlob(blob, filename);
      setStatusMessage('Exported to .docx successfully');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Docx export error:', err);
      setStatusMessage('Failed to export DOCX');
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export TXT handler
  const handleExportTxt = () => {
    const blob = exportToTxt(text);
    const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'scan'}.txt`;
    downloadBlob(blob, filename);
  };

  // AI Cleanup handler
  const handleAICleanup = async () => {
    if (!text.trim()) return;
    setIsCleaning(true);
    setStatusMessage(null);
    try {
      setPreviousText(text);
      const cleaned = await runAICleanup(text, selectedLanguage);
      setText(cleaned);
      setStatusMessage('✨ AI cleaned up spelling and line breaks');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Cleanup failed:', err);
      setStatusMessage('AI cleanup requires an active internet connection');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleUndoCleanup = () => {
    if (previousText !== null) {
      setText(previousText);
      setPreviousText(null);
      setStatusMessage('Reverted to original OCR output');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Save to history & cloud
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const savedRecord = await saveScanRecord({
        title: title || 'Untitled Scan',
        text,
        engine,
        language: selectedLanguage,
        thumbnailUrl: originalImage,
        characterCount: text.length,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        userId: '',
      });
      setSaved(true);
      onSaved?.(savedRecord);
      setStatusMessage('Scan saved to history');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error('Failed to save scan:', e);
      setStatusMessage('Saved locally in offline mode');
    } finally {
      setIsSaving(false);
    }
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] max-w-4xl mx-auto bg-[#FAF6EE] dark:bg-slate-950">
      {/* Top Bar with Title, Engine badge and Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E0D0] bg-[#FFFDF8] px-3 py-2.5 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 items-center gap-2 min-w-[200px]">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document Title"
            className="w-full max-w-xs font-semibold text-sm sm:text-base text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none px-1 py-0.5"
          />

          {/* Engine Badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
              engine === 'cloud'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}
          >
            {engine === 'cloud' ? <Zap className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
            {engine === 'cloud' ? 'Cloud Vision' : 'Offline Tesseract'}
          </span>
        </div>

        {/* Rescan / Engine Selector Toggle */}
        <div className="flex items-center gap-1.5">
          {/* Language Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-[#E8E0D0] bg-[#F3EDE0]/70 px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-800">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="dark:bg-slate-900">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Handwriting / Document Mode Toggle */}
          {onModeChange && (
            <button
              onClick={() => onModeChange(mode === 'handwriting' ? 'document' : 'handwriting')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                mode === 'handwriting'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300'
              }`}
              title={mode === 'handwriting' ? 'Handwriting Focus active' : 'Click to rescan with Handwriting Focus'}
            >
              <span>✍️</span>
              <span className="hidden sm:inline">{mode === 'handwriting' ? 'Handwriting Focus' : 'Handwriting'}</span>
            </button>
          )}

          {/* Toggle between Cloud & Tesseract */}
          {engine === 'cloud' ? (
            <button
              onClick={() => onRescan('tesseract')}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              title="Rescan using offline Tesseract engine"
            >
              <Cpu className="h-3 w-3" />
              <span className="hidden sm:inline">Use Tesseract</span>
            </button>
          ) : (
            <button
              onClick={() => onRescan('cloud')}
              disabled={!isOnline}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-blue-950/40"
              title="Rescan using Cloud Vision AI model"
            >
              <Zap className="h-3 w-3" />
              <span className="hidden sm:inline">Use Cloud AI</span>
            </button>
          )}

          <button
            onClick={onNewScan}
            className="rounded-lg bg-[#F3EDE0] px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-[#E8E0D0] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
          >
            New Scan
          </button>
        </div>
      </div>

      {/* Multi-Page Batch Selector Strip */}
      {pageResults && pageResults.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EDE0] dark:bg-slate-800 border-b border-[#E8E0D0] dark:border-slate-700 overflow-x-auto text-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Batch Pages ({pageResults.length}):
          </span>
          <button
            onClick={() => {
              setSelectedPageIdx('all');
              setText(pageResults.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n'));
            }}
            className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 ${
              selectedPageIdx === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            All Pages Combined
          </button>
          {pageResults.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedPageIdx(idx);
                setText(p.text);
              }}
              className={`rounded-lg px-2.5 py-1 font-semibold transition shrink-0 ${
                selectedPageIdx === idx
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              Page {p.pageNumber}
            </button>
          ))}
          {onAddMorePages && (
            <button
              onClick={onAddMorePages}
              className="flex items-center gap-1 rounded-lg border border-dashed border-blue-400 bg-blue-50 px-2.5 py-1 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300 transition shrink-0 font-medium"
              title="Add more photos to this document"
            >
              <Plus className="h-3 w-3" />
              <span>Add Page</span>
            </button>
          )}
        </div>
      )}

      {/* Notification Toast */}
      {statusMessage && (
        <div className="bg-blue-600 px-4 py-1.5 text-center text-xs font-medium text-white shadow-xs animate-in fade-in duration-150">
          {statusMessage}
        </div>
      )}

      {/* Main Content Area: Side-by-side on tablet/desktop, stacked on mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Thumbnail of Original Scanned Image */}
        <div className="md:w-72 lg:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-[#E8E0D0] dark:border-slate-800 bg-[#F3EDE0]/60 dark:bg-slate-900/40 p-3 sm:p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {selectedPageIdx === 'all'
                  ? `Cover / First Page`
                  : `Page ${typeof selectedPageIdx === 'number' ? selectedPageIdx + 1 : 1}`}
              </span>
              <button
                onClick={() => setShowFullImage(true)}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Enlarge</span>
              </button>
            </div>

            {/* Thumbnail Box */}
            <div
              onClick={() => setShowFullImage(true)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black/10 dark:border-slate-800 max-h-48 md:max-h-80 flex items-center justify-center shadow-xs"
            >
              <img
                src={
                  typeof selectedPageIdx === 'number' && pageResults[selectedPageIdx]
                    ? pageResults[selectedPageIdx].image
                    : originalImage
                }
                alt="Original Document"
                className="max-h-48 md:max-h-80 w-auto object-contain transition group-hover:scale-102"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition backdrop-blur-2xs">
                <span className="flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
                  <Eye className="h-3.5 w-3.5" /> Click to View
                </span>
              </div>
            </div>

            {/* Text Stats */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-[#FFFDF8] p-2 border border-[#E8E0D0] dark:border-slate-800 dark:bg-slate-800/80">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  Characters
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {text.length}
                </span>
              </div>
              <div className="rounded-lg bg-[#FFFDF8] p-2 border border-[#E8E0D0] dark:border-slate-800 dark:bg-slate-800/80">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  Words
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {text.trim() ? text.trim().split(/\s+/).length : 0}
                </span>
              </div>
            </div>

            {/* Identified Data Patterns Quick Summary in Sidebar */}
            {entityData.all.length > 0 && (
              <div
                onClick={() => setViewTab('patterns')}
                className="mt-3 cursor-pointer rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/40 hover:border-blue-400 transition"
                title="View one-tap actions for detected data"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Data Insights</span>
                  </span>
                  <span className="rounded-full bg-blue-200 dark:bg-blue-900 px-1.5 py-0.2 text-[10px] font-bold text-blue-800 dark:text-blue-200">
                    {entityData.all.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 text-[11px]">
                  {entityData.summary.dates.length > 0 && (
                    <span className="rounded-md bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 text-purple-700 dark:text-purple-300 font-medium">
                      📅 {entityData.summary.dates.length} Date{entityData.summary.dates.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {entityData.summary.phones.length > 0 && (
                    <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300 font-medium">
                      📞 {entityData.summary.phones.length} Phone{entityData.summary.phones.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {entityData.summary.emails.length > 0 && (
                    <span className="rounded-md bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-blue-700 dark:text-blue-300 font-medium">
                      📧 {entityData.summary.emails.length} Email{entityData.summary.emails.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {entityData.summary.currencies.length > 0 && (
                    <span className="rounded-md bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 text-amber-700 dark:text-amber-300 font-bold">
                      💵 {entityData.summary.currencySymbol}{entityData.summary.totalCurrencyAmount?.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick AI Clean Up button on left sidebar (desktop) */}
          <div className="mt-3 space-y-2">
            <button
              onClick={handleAICleanup}
              disabled={isCleaning}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 active:scale-98 transition"
              title="Fix spelling, broken line breaks, and punctuation using AI"
            >
              {isCleaning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cleaning up...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Clean Up Text (AI)</span>
                </>
              )}
            </button>

            {previousText !== null && (
              <button
                onClick={handleUndoCleanup}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo AI Clean Up</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Tabbed Interface for Editable Text Area & Data Patterns */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden bg-[#FFFDF8] dark:bg-slate-900">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EAE2D3] dark:border-slate-800">
            {/* View Tabs: Edit Text vs Identified Patterns */}
            <div className="flex items-center rounded-xl bg-[#F3EDE0] p-1 dark:bg-slate-800">
              <button
                onClick={() => setViewTab('editor')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  viewTab === 'editor'
                    ? 'bg-[#FFFDF8] text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Edit Text</span>
              </button>
              <button
                onClick={() => setViewTab('patterns')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  viewTab === 'patterns'
                    ? 'bg-[#FFFDF8] text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Data Patterns & Actions</span>
                {entityData.all.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:text-blue-200">
                    {entityData.all.length}
                  </span>
                )}
              </button>
            </div>

            {/* In-header mobile AI cleanup if screen is narrow */}
            <div className="flex md:hidden items-center gap-1">
              <button
                onClick={handleAICleanup}
                disabled={isCleaning}
                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              >
                {isCleaning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                <span>Clean Up</span>
              </button>
            </div>
          </div>

          {/* Conditional Content: Editable Textarea vs Interactive Patterns View */}
          {viewTab === 'patterns' ? (
            <DataPatternsView
              text={text}
              entities={entityData.all}
              summary={entityData.summary}
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="No text detected. You can type or paste here, or adjust contrast and rescan."
              className="flex-1 w-full resize-none font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 bg-[#FAF6EE] dark:bg-slate-950/60 p-3 sm:p-4 rounded-xl border border-[#E8E0D0] dark:border-slate-800 focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* Bottom Floating Export & Action Bar */}
      <div className="border-t border-[#E8E0D0] bg-[#FFFDF8]/95 backdrop-blur-md px-3 py-2.5 sm:px-4 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left actions: Copy & Share */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 shadow-xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          </div>

          {/* Right actions: Export to PDF, DOCX, TXT, Save */}
          <div className="flex items-center gap-1.5">
            {/* Export to PDF */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 active:scale-95 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 transition shadow-xs"
              title="Download formatted PDF document with preserved layout (.pdf)"
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400" />
              ) : (
                <FileDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleExportDocx}
              disabled={isExportingDocx}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
              title="Download formatted Microsoft Word document (.docx)"
            >
              {isExportingDocx ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
              <span>Export .docx</span>
            </button>

            <button
              onClick={handleExportTxt}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
              title="Download plain text file (.txt)"
            >
              <FileDown className="h-4 w-4 text-slate-500" />
              <span>.txt</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || saved}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-md ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {saved ? (
                <>
                  <BookmarkCheck className="h-4 w-4" />
                  <span>Saved</span>
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Scan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Preview Lightbox */}
      {showFullImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="flex justify-end p-2">
            <button
              onClick={() => setShowFullImage(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <img
              src={originalImage}
              alt="Full size scan"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
