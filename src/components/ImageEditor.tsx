import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCw,
  Sliders,
  Crop,
  Check,
  ArrowLeft,
  Sparkles,
  Zap,
  Layers,
  RotateCcw,
} from 'lucide-react';
import {
  ImageAdjustments,
  DEFAULT_ADJUSTMENTS,
  renderProcessedImage,
} from '../utils/imageUtils';

interface ImageEditorProps {
  imageSrc: string;
  onConfirm: (adjustments: ImageAdjustments) => void;
  onCancel: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageSrc,
  onConfirm,
  onCancel,
}) => {
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    ...DEFAULT_ADJUSTMENTS,
  });

  const [activeTab, setActiveTab] = useState<'crop' | 'enhance'>('crop');
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Cropping drag state
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; crop: typeof adjustments.crop }>({
    clientX: 0,
    clientY: 0,
    crop: { ...DEFAULT_ADJUSTMENTS.crop },
  });

  // Calculate loaded image aspect ratio and container dimensions
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageSrc]);

  const handleRotate = (angle: number) => {
    setAdjustments((prev) => ({
      ...prev,
      rotation: (prev.rotation + angle + 360) % 360,
      crop: { x: 0, y: 0, width: 1, height: 1 }, // reset crop upon rotation
    }));
  };

  const applyPresetFilter = (filter: ImageAdjustments['filter']) => {
    if (filter === 'bw') {
      setAdjustments((prev) => ({
        ...prev,
        filter: 'bw',
        contrast: 30,
        brightness: 10,
      }));
    } else if (filter === 'high_contrast') {
      setAdjustments((prev) => ({
        ...prev,
        filter: 'high_contrast',
        contrast: 40,
        brightness: 0,
      }));
    } else {
      setAdjustments((prev) => ({
        ...prev,
        filter: 'none',
        contrast: 0,
        brightness: 0,
      }));
    }
  };

  const setAspectRatioPreset = (ratioName: 'free' | '1:1' | 'a4' | 'receipt') => {
    if (ratioName === 'free') {
      setAdjustments((prev) => ({ ...prev, crop: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 } }));
      return;
    }
    let targetRatio = 1;
    if (ratioName === '1:1') targetRatio = 1;
    if (ratioName === 'a4') targetRatio = 1 / 1.414;
    if (ratioName === 'receipt') targetRatio = 9 / 16;

    // Center crop based on ratio
    const width = 0.8;
    const height = Math.min(0.9, width / targetRatio);
    setAdjustments((prev) => ({
      ...prev,
      crop: {
        x: Math.max(0, (1 - width) / 2),
        y: Math.max(0, (1 - height) / 2),
        width,
        height,
      },
    }));
  };

  // Pointer event handlers for responsive touch crop handles
  const handlePointerDown = (handle: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      crop: { ...adjustments.crop },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragHandle || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = (e.clientX - dragStartRef.current.clientX) / rect.width;
    const deltaY = (e.clientY - dragStartRef.current.clientY) / rect.height;

    const orig = dragStartRef.current.crop;
    let { x, y, width, height } = orig;

    const minSize = 0.1;

    if (dragHandle === 'move') {
      x = Math.max(0, Math.min(1 - width, orig.x + deltaX));
      y = Math.max(0, Math.min(1 - height, orig.y + deltaY));
    } else if (dragHandle === 'tl') {
      const newX = Math.min(orig.x + orig.width - minSize, Math.max(0, orig.x + deltaX));
      const newY = Math.min(orig.y + orig.height - minSize, Math.max(0, orig.y + deltaY));
      width = orig.x + orig.width - newX;
      height = orig.y + orig.height - newY;
      x = newX;
      y = newY;
    } else if (dragHandle === 'tr') {
      const newY = Math.min(orig.y + orig.height - minSize, Math.max(0, orig.y + deltaY));
      width = Math.max(minSize, Math.min(1 - orig.x, orig.width + deltaX));
      height = orig.y + orig.height - newY;
      y = newY;
    } else if (dragHandle === 'bl') {
      const newX = Math.min(orig.x + orig.width - minSize, Math.max(0, orig.x + deltaX));
      width = orig.x + orig.width - newX;
      height = Math.max(minSize, Math.min(1 - orig.y, orig.height + deltaY));
      x = newX;
    } else if (dragHandle === 'br') {
      width = Math.max(minSize, Math.min(1 - orig.x, orig.width + deltaX));
      height = Math.max(minSize, Math.min(1 - orig.y, orig.height + deltaY));
    }

    setAdjustments((prev) => ({
      ...prev,
      crop: { x, y, width, height },
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragHandle) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setDragHandle(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] max-w-4xl mx-auto bg-slate-900 text-white select-none">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retake / Back</span>
        </button>

        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <button
            onClick={() => setActiveTab('crop')}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'crop' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crop className="h-3.5 w-3.5" />
            <span>Crop & Rotate</span>
          </button>
          <button
            onClick={() => setActiveTab('enhance')}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'enhance' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Enhance Contrast</span>
          </button>
        </div>

        <button
          onClick={() => onConfirm(adjustments)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 active:scale-95 transition"
        >
          <Check className="h-4 w-4" />
          <span>Done</span>
        </button>
      </div>

      {/* Center Image Display area with Crop Box Overlay */}
      <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-slate-950">
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative max-h-full max-w-full flex items-center justify-center touch-none"
        >
          {/* Image with rotation and visual css filters for real-time smoothness */}
          <img
            src={imageSrc}
            alt="Scan preview"
            style={{
              transform: `rotate(${adjustments.rotation}deg)`,
              filter: `contrast(${1 + adjustments.contrast / 100}) brightness(${
                1 + adjustments.brightness / 100
              }) ${
                adjustments.filter === 'bw'
                  ? 'grayscale(100%) contrast(150%)'
                  : adjustments.filter === 'high_contrast'
                  ? 'contrast(180%)'
                  : ''
              }`,
              maxHeight: 'calc(100vh - 240px)',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
            className="rounded-lg shadow-2xl pointer-events-none transition-transform duration-200"
          />

          {/* Active interactive Crop Box (only shown in crop tab) */}
          {activeTab === 'crop' && (
            <div
              style={{
                position: 'absolute',
                left: `${adjustments.crop.x * 100}%`,
                top: `${adjustments.crop.y * 100}%`,
                width: `${adjustments.crop.width * 100}%`,
                height: `${adjustments.crop.height * 100}%`,
              }}
              className="border-2 border-blue-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-20"
            >
              {/* Inner grid lines for document alignment */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                <div className="border-r border-b border-blue-400/25" />
                <div className="border-r border-b border-blue-400/25" />
                <div className="border-b border-blue-400/25" />
                <div className="border-r border-b border-blue-400/25" />
                <div className="border-r border-b border-blue-400/25" />
                <div className="border-b border-blue-400/25" />
                <div className="border-r border-blue-400/25" />
                <div className="border-r border-blue-400/25" />
                <div />
              </div>

              {/* Move Area */}
              <div
                onPointerDown={(e) => handlePointerDown('move', e)}
                className="absolute inset-3 cursor-move"
                title="Drag to reposition crop"
              />

              {/* 4 Corner Touch Handles */}
              <div
                onPointerDown={(e) => handlePointerDown('tl', e)}
                className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nwse-resize z-30"
              />
              <div
                onPointerDown={(e) => handlePointerDown('tr', e)}
                className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nesw-resize z-30"
              />
              <div
                onPointerDown={(e) => handlePointerDown('bl', e)}
                className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nesw-resize z-30"
              />
              <div
                onPointerDown={(e) => handlePointerDown('br', e)}
                className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-nwse-resize z-30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tool Controls Drawer */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4">
        {activeTab === 'crop' ? (
          <div className="space-y-3">
            {/* Rotation and aspect presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleRotate(90)}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 transition"
                >
                  <RotateCw className="h-4 w-4 text-blue-400" />
                  <span>Rotate 90°</span>
                </button>

                <button
                  onClick={() => setAdjustments((prev) => ({ ...prev, crop: { x: 0, y: 0, width: 1, height: 1 } }))}
                  className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 transition"
                >
                  Full Image
                </button>
              </div>

              {/* Aspect Ratio Presets */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Presets:</span>
                <button
                  onClick={() => setAspectRatioPreset('free')}
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Free
                </button>
                <button
                  onClick={() => setAspectRatioPreset('a4')}
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  A4
                </button>
                <button
                  onClick={() => setAspectRatioPreset('receipt')}
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Receipt
                </button>
                <button
                  onClick={() => setAspectRatioPreset('1:1')}
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  1:1
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Filter Presets */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400">Scan Filter:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => applyPresetFilter('none')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    adjustments.filter === 'none'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => applyPresetFilter('bw')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    adjustments.filter === 'bw'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-amber-300" />
                  <span>B&W Document</span>
                </button>
                <button
                  onClick={() => applyPresetFilter('high_contrast')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    adjustments.filter === 'high_contrast'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  High Contrast
                </button>
              </div>
            </div>

            {/* Contrast Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300 w-16">Contrast</span>
              <input
                type="range"
                min="-30"
                max="80"
                value={adjustments.contrast}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, contrast: parseInt(e.target.value, 10) }))
                }
                className="flex-1 accent-blue-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs text-slate-400 w-8 text-right">{adjustments.contrast}</span>
            </div>

            {/* Brightness Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300 w-16">Brightness</span>
              <input
                type="range"
                min="-40"
                max="50"
                value={adjustments.brightness}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, brightness: parseInt(e.target.value, 10) }))
                }
                className="flex-1 accent-blue-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs text-slate-400 w-8 text-right">{adjustments.brightness}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
