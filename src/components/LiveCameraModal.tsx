import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Zap, ZapOff, AlertCircle, Plus, Check, Layers } from 'lucide-react';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onBatchCapture?: (dataUrls: string[]) => void;
  initialQueue?: string[];
  initialMode?: 'single' | 'batch';
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onBatchCapture,
  initialQueue = [],
  initialMode = 'batch',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [capturedBatch, setCapturedBatch] = useState<string[]>(initialQueue);
  const [mode, setMode] = useState<'single' | 'batch'>(initialMode);
  const [justSnapped, setJustSnapped] = useState(false);

  // Reset batch and mode on open if fresh
  useEffect(() => {
    if (isOpen) {
      setCapturedBatch(initialQueue);
      setMode(initialMode || (initialQueue.length > 0 ? 'batch' : 'single'));
    }
  }, [isOpen, initialQueue, initialMode]);

  // Start camera stream
  const startCamera = async (newFacingMode: 'environment' | 'user') => {
    setIsStarting(true);
    setErrorMsg(null);

    // Stop existing stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }

      // Check torch support
      const videoTrack = newStream.getVideoTracks()[0];
      const capabilities = (videoTrack as any).getCapabilities?.();
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings.'
          : 'Could not access camera. You can still upload or snap using your file picker.'
      );
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Helper to grab frame dataUrl from canvas
  const grabCurrentFrame = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // Capture single and close
  const handleSingleCapture = () => {
    const dataUrl = grabCurrentFrame();
    if (!dataUrl) return;

    if (navigator.vibrate) navigator.vibrate(50);
    onCapture(dataUrl);
    onClose();
  };

  // Add photo to batch sequence
  const handleAddBatchPhoto = () => {
    const dataUrl = grabCurrentFrame();
    if (!dataUrl) return;

    if (navigator.vibrate) navigator.vibrate([40, 40]);
    setJustSnapped(true);
    setTimeout(() => setJustSnapped(false), 200);
    setCapturedBatch((prev) => [...prev, dataUrl]);
  };

  // Finish batch and deliver array
  const handleFinishBatch = () => {
    if (capturedBatch.length === 0) {
      // If nothing queued yet, snap current and deliver
      const dataUrl = grabCurrentFrame();
      if (dataUrl) {
        if (onBatchCapture) onBatchCapture([dataUrl]);
        else onCapture(dataUrl);
        onClose();
      }
      return;
    }

    if (onBatchCapture) {
      onBatchCapture(capturedBatch);
    } else {
      onCapture(capturedBatch[0]);
    }
    onClose();
  };

  // Remove photo from batch tray
  const handleRemovePhoto = (idx: number) => {
    setCapturedBatch((prev) => prev.filter((_, i) => i !== idx));
  };

  // Fallback native input trigger (supports multiple selection!)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const readFiles: string[] = [];
      let loadedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            readFiles.push(reader.result);
          }
          loadedCount++;
          if (loadedCount === files.length) {
            if (readFiles.length > 1 && onBatchCapture) {
              onBatchCapture(readFiles);
            } else {
              onCapture(readFiles[0]);
            }
            onClose();
          }
        };
        reader.readAsDataURL(files[i]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top controls bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-10 text-white">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20 backdrop-blur-md"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mode selector: Single vs Batch */}
        <div className="flex items-center rounded-xl bg-white/15 p-0.5 backdrop-blur-md">
          <button
            onClick={() => setMode('single')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              mode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-white/80'
            }`}
          >
            Single
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              mode === 'batch' ? 'bg-blue-600 text-white shadow-xs' : 'text-white/80'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Multi-Page ({capturedBatch.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition ${
                torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'
              }`}
            >
              {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20 backdrop-blur-md"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Viewfinder area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {errorMsg ? (
          <div className="p-6 text-center max-w-sm text-white">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-400 mb-3" />
            <p className="text-sm font-medium">{errorMsg}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md"
            >
              Pick Images via System Picker
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFallbackFile}
              className="hidden"
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Document Frame Guide Overlay */}
            <div className="pointer-events-none absolute inset-x-8 inset-y-16 sm:inset-x-24 sm:inset-y-20 rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 h-8 w-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 h-8 w-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 h-8 w-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 h-8 w-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

              {/* Scanning crossline indicator */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-blue-400/40" />
            </div>

            {/* Batch mode helper overlay badge */}
            {mode === 'batch' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium text-white shadow-lg border border-white/20">
                Snap photos in sequence: Page {capturedBatch.length + 1}
              </div>
            )}

            {/* Shutter flash effect */}
            {justSnapped && (
              <div className="pointer-events-none absolute inset-0 bg-white/70 animate-out fade-out duration-200 z-20" />
            )}
          </>
        )}
      </div>

      {/* Captured Batch Strip (Visible if pages queued in batch mode) */}
      {mode === 'batch' && capturedBatch.length > 0 && (
        <div className="px-4 py-2 bg-black/80 backdrop-blur-md border-t border-white/10 z-10">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {capturedBatch.map((url, idx) => (
              <div key={idx} className="relative shrink-0 group">
                <img
                  src={url}
                  alt={`Page ${idx + 1}`}
                  className="h-14 w-11 object-cover rounded-lg border-2 border-blue-500 shadow-md"
                />
                <span className="absolute bottom-0 inset-x-0 bg-blue-600/90 text-[9px] font-bold text-center text-white rounded-b-md">
                  P.{idx + 1}
                </span>
                <button
                  onClick={() => handleRemovePhoto(idx)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] shadow"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="shrink-0 flex items-center text-xs text-white/60 pl-2">
              <span>{capturedBatch.length} page{capturedBatch.length > 1 ? 's' : ''} in sequence</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Shutter & Action Bar */}
      <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-t from-black/95 to-black/70 z-10">
        {/* Device File Picker (Supports Multiple Files) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 text-white/80 active:text-white"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <Camera className="h-5 w-5" />
          </div>
          <span className="text-[10px]">Files</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          onChange={handleFallbackFile}
          className="hidden"
        />

        {/* Center: Big Shutter Button / Add Button */}
        {mode === 'single' ? (
          <button
            onClick={handleSingleCapture}
            disabled={!stream || isStarting}
            className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white active:scale-95 transition disabled:opacity-50"
          >
            <div className="h-16 w-16 rounded-full bg-white group-active:scale-90 transition shadow-lg" />
          </button>
        ) : (
          /* Multi-Page Add Page Button */
          <button
            onClick={handleAddBatchPhoto}
            disabled={!stream || isStarting}
            className="group relative flex flex-col items-center justify-center gap-1 active:scale-95 transition disabled:opacity-50"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-blue-400 bg-blue-600 shadow-xl shadow-blue-500/40 group-active:scale-90 transition">
              <Plus className="h-10 w-10 text-white stroke-[2.5]" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">
              + Add Page {capturedBatch.length + 1}
            </span>
          </button>
        )}

        {/* Right side: Finish Batch button (or spacer for single mode) */}
        {mode === 'batch' && capturedBatch.length > 0 ? (
          <button
            onClick={handleFinishBatch}
            className="flex flex-col items-center gap-1 text-emerald-400 active:scale-95 transition"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>
            <span className="text-[11px] font-bold text-emerald-300">
              Done ({capturedBatch.length})
            </span>
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>
    </div>
  );
};
