import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  FileUp,
  FileText,
  Zap,
  Cpu,
  Globe,
  Sparkles,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Layers,
  Plus,
  Check,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Header } from './components/Header';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LiveCameraModal } from './components/LiveCameraModal';
import { ImageEditor } from './components/ImageEditor';
import { ScanResultView, PageResultItem } from './components/ScanResultView';
import { ScanHistoryView } from './components/ScanHistoryView';
import { AuthModal } from './components/AuthModal';
import { BatchPageQueue, BatchPageItem } from './components/BatchPageQueue';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { renderPdfToImage } from './services/pdfService';
import { runCloudOCR, runTesseractOCR, SUPPORTED_LANGUAGES } from './services/ocrService';
import { ImageAdjustments, getOptimizedBase64, createThumbnail } from './utils/imageUtils';
import { fetchUserScans, ScanItem } from './services/scanStorage';

export default function App() {
  const isOnline = useOnlineStatus();

  // App Navigation & Step Flow
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');
  const [step, setStep] = useState<'home' | 'editor' | 'batch_queue' | 'scanning' | 'result'>('home');
  const [batchPages, setBatchPages] = useState<BatchPageItem[]>([]);
  const [batchResults, setBatchResults] = useState<PageResultItem[]>([]);
  const [cameraMode, setCameraMode] = useState<'single' | 'batch'>('batch');
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(0);

  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('scantext_theme') === 'dark' ||
      (!('scantext_theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('scantext_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('scantext_theme', 'light');
    }
  }, [darkMode]);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      loadScans();
    });
    return () => unsubscribe();
  }, []);

  // Scan History
  const [scans, setScans] = useState<ScanItem[]>([]);
  const loadScans = async () => {
    try {
      const list = await fetchUserScans();
      setScans(list);
    } catch (e) {
      console.warn('Error loading scans:', e);
    }
  };

  useEffect(() => {
    loadScans();
  }, [user]);

  // Image & Scan Flow State
  const [rawImageSrc, setRawImageSrc] = useState<string>('');
  const [processedImageSrc, setProcessedImageSrc] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<'cloud' | 'tesseract'>('cloud');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('eng');
  const [ocrMode, setOcrMode] = useState<'document' | 'handwriting'>('document');

  // Modals & Loaders
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ status: string; progress: number }>({
    status: '',
    progress: 0,
  });
  const [scanError, setScanError] = useState<string | null>(null);

  // File Inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Handle single image capture / selection
  const handleImageSelected = (dataUrl: string) => {
    if (step === 'batch_queue') {
      // Append to current batch queue
      setBatchPages((prev) => [
        ...prev,
        {
          id: `batch_${Date.now()}_${prev.length}`,
          dataUrl,
          pageNumber: prev.length + 1,
        },
      ]);
      return;
    }
    setRawImageSrc(dataUrl);
    setProcessedImageSrc(dataUrl);
    setStep('editor');
    setScanError(null);
  };

  // Handle batch capture (array of photos from camera or file picker)
  const handleBatchCapture = (dataUrls: string[]) => {
    if (dataUrls.length === 0) return;
    if (dataUrls.length === 1 && step !== 'batch_queue') {
      handleImageSelected(dataUrls[0]);
      return;
    }
    const newItems: BatchPageItem[] = dataUrls.map((url, i) => ({
      id: `batch_${Date.now()}_${batchPages.length + i}`,
      dataUrl: url,
      pageNumber: batchPages.length + i + 1,
    }));
    setBatchPages((prev) => [...prev, ...newItems]);
    setStep('batch_queue');
  };

  const handleMoveBatchPage = (index: number, direction: 'up' | 'down') => {
    setBatchPages((prev) => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((item, idx) => ({ ...item, pageNumber: idx + 1 }));
    });
  };

  const handleRemoveBatchPage = (id: string) => {
    setBatchPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.map((item, idx) => ({ ...item, pageNumber: idx + 1 }));
    });
  };

  // Sequential batch OCR extraction loop
  const executeBatchSequentialOCR = async () => {
    if (batchPages.length === 0) return;

    setStep('scanning');
    setScanError(null);
    const actualEngine = !isOnline ? 'tesseract' : ocrEngine;
    const results: PageResultItem[] = [];

    for (let i = 0; i < batchPages.length; i++) {
      const currentPage = batchPages[i];
      const pageNum = i + 1;
      setActiveBatchIndex(i);
      setProcessedImageSrc(currentPage.dataUrl);

      setScanProgress({
        status: `Extracting Page ${pageNum} of ${batchPages.length} in document sequence...`,
        progress: (i / batchPages.length) * 0.9 + 0.05,
      });

      let pageText = '';
      try {
        if (actualEngine === 'cloud') {
          const cloudRes = await runCloudOCR(currentPage.dataUrl, selectedLanguage, ocrMode);
          pageText = cloudRes.text;
        } else {
          const tessRes = await runTesseractOCR(currentPage.dataUrl, selectedLanguage);
          pageText = tessRes.text;
        }
      } catch (err: any) {
        console.warn(`Error on page ${pageNum}, attempting offline fallback:`, err);
        try {
          const fallbackRes = await runTesseractOCR(currentPage.dataUrl, selectedLanguage);
          pageText = fallbackRes.text;
        } catch (fErr) {
          pageText = `[Page ${pageNum}: Text recognition failed]`;
        }
      }

      results.push({
        pageNumber: pageNum,
        text: pageText,
        image: currentPage.dataUrl,
      });
    }

    // Compile full document in original sequence
    const consolidatedText = results
      .map((r) => `=== Page ${r.pageNumber} ===\n${r.text}`)
      .join('\n\n\n');

    setBatchResults(results);
    setExtractedText(consolidatedText);
    setProcessedImageSrc(results[0]?.image || '');
    setOcrEngine(actualEngine);
    setStep('result');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1 && step !== 'batch_queue') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          handleImageSelected(reader.result);
        }
      };
      reader.readAsDataURL(files[0]);
    } else {
      // Multiple files or adding to batch
      const readUrls: string[] = [];
      let loaded = 0;
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            readUrls.push(reader.result);
          }
          loaded++;
          if (loaded === files.length) {
            handleBatchCapture(readUrls);
          }
        };
        reader.readAsDataURL(files[i]);
      }
    }
    e.target.value = '';
  };

  // Handle PDF upload
  const handlePdfInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStep('scanning');
      setScanProgress({ status: 'Rasterizing PDF page to high-res image...', progress: 0.1 });
      const { dataUrl } = await renderPdfToImage(file, 1);
      handleImageSelected(dataUrl);
    } catch (err: any) {
      console.error('PDF render error:', err);
      setScanError('Failed to read PDF. Please ensure the PDF is not password protected.');
      setStep('home');
    } finally {
      e.target.value = '';
    }
  };

  // Confirm image adjustments from Editor and run OCR
  const handleEditorConfirm = async (adjustments: ImageAdjustments) => {
    try {
      const optimized = await getOptimizedBase64(rawImageSrc, adjustments, 0.9);
      setProcessedImageSrc(optimized);
      executeOCR(optimized, ocrEngine, selectedLanguage);
    } catch (e: any) {
      console.error('Image processing failed:', e);
      executeOCR(rawImageSrc, ocrEngine, selectedLanguage);
    }
  };

  // Perform OCR extraction
  const executeOCR = async (
    imageSource: string,
    engineToUse: 'cloud' | 'tesseract',
    lang: string,
    modeParam?: 'document' | 'handwriting'
  ) => {
    setStep('scanning');
    setScanError(null);
    const activeMode = modeParam || ocrMode;

    // Auto fallback to tesseract if offline
    const actualEngine = !isOnline ? 'tesseract' : engineToUse;

    try {
      if (actualEngine === 'cloud') {
        setScanProgress({
          status: activeMode === 'handwriting'
            ? 'Analyzing handwriting & cursive with Cloud Vision AI...'
            : 'Connecting to Cloud Vision AI model...',
          progress: 0.25,
        });

        try {
          const result = await runCloudOCR(imageSource, lang, activeMode);
          setExtractedText(result.text);
          setOcrEngine('cloud');
          setStep('result');
          return;
        } catch (cloudErr: any) {
          console.warn('Cloud Vision OCR timed out or unavailable, automatically falling back to offline Tesseract.js:', cloudErr);
          setScanProgress({
            status: 'Cloud Vision busy/timed out. Switching to offline Tesseract OCR...',
            progress: 0.35,
          });

          // Automatic fallback to Tesseract.js
          const fallbackResult = await runTesseractOCR(imageSource, lang, (status, progress) => {
            setScanProgress({
              status: `Offline fallback: ${status}`,
              progress: 0.35 + progress * 0.65,
            });
          });

          setExtractedText(fallbackResult.text);
          setOcrEngine('tesseract');
          setStep('result');
          return;
        }
      } else {
        setScanProgress({
          status: 'Initializing offline Tesseract.js engine...',
          progress: 0.1,
        });

        const result = await runTesseractOCR(imageSource, lang, (status, progress) => {
          setScanProgress({ status, progress });
        });

        setExtractedText(result.text);
        setOcrEngine('tesseract');
        setStep('result');
      }
    } catch (err: any) {
      console.error('OCR failure:', err);
      setScanError(err.message || 'Offline OCR encountered an issue. You can try adjusting image contrast.');
    }
  };

  // Handle retry with other engine
  const handleRescan = (targetEngine: 'cloud' | 'tesseract') => {
    executeOCR(processedImageSrc || rawImageSrc, targetEngine, selectedLanguage);
  };

  // Sample templates for testing without taking a photo
  const loadDemoSample = (type: 'receipt' | 'handwriting' | 'document') => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, 800, 1000);

    // Subtle paper lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let y = 100; y < 950; y += 40) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(740, y);
      ctx.stroke();
    }

    if (type === 'receipt') {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('COFFEE & BISTRO ROASTERS', 150, 120);
      ctx.font = '22px monospace';
      ctx.fillText('Order #4928   Date: 2026-10-12', 150, 170);
      ctx.fillText('-----------------------------------', 120, 220);
      ctx.fillText('1x Flat White (Oat Milk)    $4.75', 120, 270);
      ctx.fillText('2x Almond Croissant         $8.50', 120, 320);
      ctx.fillText('1x Avocado Sourdough Toast  $12.00', 120, 370);
      ctx.fillText('-----------------------------------', 120, 430);
      ctx.fillText('Subtotal:                   $25.25', 120, 480);
      ctx.fillText('Tax (8.5%):                 $2.15', 120, 530);
      ctx.font = 'bold 26px monospace';
      ctx.fillText('TOTAL:                      $27.40', 120, 600);
      ctx.font = '20px monospace';
      ctx.fillText('Thank you for dining with us!', 180, 700);
    } else if (type === 'handwriting') {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'italic 34px serif';
      ctx.fillText('Meeting Action Items:', 100, 130);
      ctx.font = 'italic 26px serif';
      ctx.fillText('1. Complete client presentation by Thursday 3pm', 100, 210);
      ctx.fillText('2. Review quarterly budget forecast with Sarah', 100, 290);
      ctx.fillText('3. Check sensor calibration logs in Lab 4', 100, 370);
      ctx.fillText('4. Schedule follow-up sprint planning for next week', 100, 450);
      ctx.fillText('Note: Remember to email Frank the updated slides!', 100, 540);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('ScanText Project Specification', 100, 130);
      ctx.font = '22px sans-serif';
      ctx.fillText('Abstract:', 100, 190);
      ctx.font = '19px sans-serif';
      ctx.fillText(
        'ScanText is a progressive web app designed for mobile document capture.',
        100,
        240
      );
      ctx.fillText(
        'It features offline-first OCR via Tesseract.js alongside Cloud Vision AI.',
        100,
        280
      );
      ctx.fillText(
        'Users can rotate, crop, adjust contrast, and export clean DOCX and TXT files.',
        100,
        320
      );
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Key Architecture Components:', 100, 400);
      ctx.font = '19px sans-serif';
      ctx.fillText('• Client-side image enhancement and contrast filter pipeline', 120, 450);
      ctx.fillText('• Server-side Vision proxy for secure AI without browser API keys', 120, 490);
      ctx.fillText('• Persistent Firestore history syncing with strict RBAC rules', 120, 530);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    handleImageSelected(dataUrl);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Sticky Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'scan' && step === 'result') {
            // Keep in result or switch
          }
        }}
        historyCount={scans.length}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenAuth={() => setShowAuthModal(true)}
        user={user}
      />

      {/* Connectivity Banner */}
      <OfflineIndicator />

      {/* Main Container */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'history' ? (
          <ScanHistoryView
            scans={scans}
            onSelectScan={(scan) => {
              setProcessedImageSrc(scan.thumbnailUrl || '');
              setExtractedText(scan.text);
              setOcrEngine(scan.engine);
              setSelectedLanguage(scan.language || 'eng');
              setStep('result');
              setActiveTab('scan');
            }}
            onRefresh={loadScans}
            onOpenAuth={() => setShowAuthModal(true)}
            user={user}
          />
        ) : step === 'editor' ? (
          <ImageEditor
            imageSrc={rawImageSrc}
            onConfirm={handleEditorConfirm}
            onCancel={() => setStep('home')}
          />
        ) : step === 'batch_queue' ? (
          <BatchPageQueue
            pages={batchPages}
            onAddMorePhotos={() => {
              setCameraMode('batch');
              setShowCameraModal(true);
            }}
            onUploadMorePhotos={() => {
              imageInputRef.current?.click();
            }}
            onRemovePage={handleRemoveBatchPage}
            onMovePage={handleMoveBatchPage}
            onStartBatchOCR={executeBatchSequentialOCR}
            onCancel={() => {
              setBatchPages([]);
              setStep('home');
            }}
          />
        ) : step === 'scanning' ? (
          /* High Polish Scanning Loading & Progress State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
            {scanError ? (
              <div className="space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-red-200 dark:border-red-900/60">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950 text-red-600">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Recognition Issue
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {scanError}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (batchPages.length > 1) {
                        setOcrEngine('tesseract');
                        executeBatchSequentialOCR();
                      } else {
                        executeOCR(processedImageSrc || rawImageSrc, 'tesseract', selectedLanguage);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
                  >
                    <Cpu className="h-4 w-4" />
                    <span>Try Offline OCR</span>
                  </button>
                  <button
                    onClick={() => {
                      if (batchPages.length > 1) {
                        setOcrEngine('cloud');
                        executeBatchSequentialOCR();
                      } else {
                        executeOCR(processedImageSrc || rawImageSrc, 'cloud', selectedLanguage);
                      }
                    }}
                    disabled={!isOnline}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry Cloud</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (batchPages.length > 1) setStep('batch_queue');
                    else setStep('editor');
                  }}
                  className="w-full text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 pt-1"
                >
                  {batchPages.length > 1 ? 'Back to Batch Queue' : 'Back to Adjust Image'}
                </button>
              </div>
            ) : (
              <div className="space-y-6 w-full">
                {/* Visual Laser Scanner Animation Container */}
                <div className="relative mx-auto h-48 w-40 overflow-hidden rounded-2xl border-2 border-blue-500/50 bg-black/5 shadow-2xl dark:bg-slate-900">
                  {processedImageSrc && (
                    <img
                      src={processedImageSrc}
                      alt="Scanning Target"
                      className="h-full w-full object-cover opacity-60"
                    />
                  )}
                  {/* Laser line moving vertically */}
                  <div className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_12px_#38bdf8] animate-[bounce_2s_infinite]" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {ocrEngine === 'cloud' && isOnline
                      ? 'Analyzing with Cloud Vision AI...'
                      : 'Scanning with Tesseract.js (Offline)...'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {scanProgress.status || 'Deciphering words, handwriting, and layout...'}
                  </p>
                  {batchPages.length > 1 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <span>Sequential Extraction: Page {activeBatchIndex + 1} of {batchPages.length}</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(15, Math.round(scanProgress.progress * 100))}%`,
                    }}
                  />
                </div>

                <p className="text-[11px] text-slate-400">
                  {ocrEngine === 'cloud'
                    ? 'Transcribing text, complex fonts, and handwriting...'
                    : 'Processing locally in browser using WebAssembly worker.'}
                </p>
              </div>
            )}
          </div>
        ) : step === 'result' ? (
          <ScanResultView
            originalImage={processedImageSrc || rawImageSrc}
            initialText={extractedText}
            engine={ocrEngine}
            selectedLanguage={selectedLanguage}
            mode={ocrMode}
            pageResults={batchResults}
            onLanguageChange={(lang) => {
              setSelectedLanguage(lang);
              if (batchResults.length > 1) {
                executeBatchSequentialOCR();
              } else {
                executeOCR(processedImageSrc || rawImageSrc, ocrEngine, lang, ocrMode);
              }
            }}
            onModeChange={(newMode) => {
              setOcrMode(newMode);
              if (batchResults.length > 1) {
                executeBatchSequentialOCR();
              } else {
                executeOCR(processedImageSrc || rawImageSrc, 'cloud', selectedLanguage, newMode);
              }
            }}
            onRescan={(targetEngine) => {
              if (batchResults.length > 1) {
                setOcrEngine(targetEngine);
                executeBatchSequentialOCR();
              } else {
                executeOCR(processedImageSrc || rawImageSrc, targetEngine, selectedLanguage, ocrMode);
              }
            }}
            onNewScan={() => {
              setBatchPages([]);
              setBatchResults([]);
              setStep('home');
            }}
            onSaved={() => loadScans()}
            onAddMorePages={() => {
              setCameraMode('batch');
              setShowCameraModal(true);
            }}
          />
        ) : (
          /* Step === 'home': Clean, Mobile-First Landing View */
          <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-5 sm:py-8 justify-between">
            {/* Top Branding & Mode Settings */}
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Document & Handwriting OCR
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Extract readable text in seconds. Works offline on weak internet.
                </p>
              </div>

              {/* OCR Engine & Language Options Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Recognition Settings</span>
                  <span className="text-[10px] text-slate-400">Customizable</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Language Selector */}
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Language
                    </label>
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                      <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code} className="dark:bg-slate-900">
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Recognition Engine Preference */}
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Engine Engine
                    </label>
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                      {ocrEngine === 'cloud' && isOnline ? (
                        <Zap className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <Cpu className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <select
                        value={ocrEngine}
                        onChange={(e) => setOcrEngine(e.target.value as 'cloud' | 'tesseract')}
                        className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="cloud" className="dark:bg-slate-900">
                          {isOnline ? 'Cloud Vision AI (Handwriting)' : 'Cloud AI (Requires Online)'}
                        </option>
                        <option value="tesseract" className="dark:bg-slate-900">
                          Tesseract.js (Offline Fallback)
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Document Type hint */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">Mode:</span>
                  <button
                    onClick={() => setOcrMode('document')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      ocrMode === 'document'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    Printed Document / Book
                  </button>
                  <button
                    onClick={() => setOcrMode('handwriting')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      ocrMode === 'handwriting'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    Handwritten Notes
                  </button>
                </div>
              </div>

              {/* Try with Sample Cards */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Or Test with Sample Document:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => loadDemoSample('document')}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 active:scale-95 transition shadow-2xs"
                  >
                    <FileText className="h-4 w-4 text-blue-600 mb-1" />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      Standard Page
                    </span>
                  </button>
                  <button
                    onClick={() => loadDemoSample('receipt')}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 active:scale-95 transition shadow-2xs"
                  >
                    <FileUp className="h-4 w-4 text-emerald-600 mb-1" />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      Store Receipt
                    </span>
                  </button>
                  <button
                    onClick={() => loadDemoSample('handwriting')}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 active:scale-95 transition shadow-2xs"
                  >
                    <Sparkles className="h-4 w-4 text-amber-500 mb-1" />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      Handwritten
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Batch Queue Resume Banner if pages already taken */}
            {batchPages.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-50 p-3 border border-blue-200 dark:bg-blue-950/60 dark:border-blue-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                    {batchPages.length}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">
                      {batchPages.length} Photo{batchPages.length === 1 ? '' : 's'} in Sequence
                    </h4>
                    <p className="text-[11px] text-blue-700/80 dark:text-blue-300">
                      Ready to extract in document order
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStep('batch_queue')}
                  className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
                >
                  <span>Review Queue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Giant Thumb-Friendly Scan and Capture Bar */}
            <div className="mt-6 space-y-3 pb-6">
              {/* Primary: Batch Multi-Page Scan Card */}
              <button
                onClick={() => {
                  setCameraMode('batch');
                  setShowCameraModal(true);
                }}
                className="group relative flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 text-white shadow-xl shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-98 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs group-hover:scale-105 transition shrink-0">
                    <Layers className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">Batch Multi-Page Scan</span>
                      <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                        + Add Mode
                      </span>
                    </div>
                    <p className="text-xs text-blue-100 mt-0.5">
                      Take multiple photos in sequence by clicking "Add", then extract all pages in document order
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/70 group-hover:translate-x-1 transition shrink-0" />
              </button>

              {/* Secondary: Single Page Scan & Uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setCameraMode('single');
                    setShowCameraModal(true);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition"
                >
                  <Camera className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  <span>Single Photo</span>
                </button>

                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition"
                >
                  <Upload className="h-4 w-4 text-blue-500" />
                  <span>Upload Photos</span>
                </button>
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition"
                >
                  <FileUp className="h-4 w-4 text-red-500" />
                  <span>Upload PDF</span>
                </button>
                <input
                  type="file"
                  ref={pdfInputRef}
                  accept="application/pdf"
                  onChange={handlePdfInputChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleImageSelected}
        onBatchCapture={handleBatchCapture}
        initialQueue={batchPages.map((p) => p.dataUrl)}
        initialMode={cameraMode}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={loadScans}
      />
    </div>
  );
}
