import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Camera,
  Upload,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
  Eye,
  X,
} from 'lucide-react';

export interface BatchPageItem {
  id: string;
  dataUrl: string;
  pageNumber: number;
  label?: string;
}

interface BatchPageQueueProps {
  pages: BatchPageItem[];
  onAddMorePhotos: () => void;
  onUploadMorePhotos: () => void;
  onRemovePage: (id: string) => void;
  onMovePage: (index: number, direction: 'up' | 'down') => void;
  onStartBatchOCR: () => void;
  onCancel: () => void;
}

export const BatchPageQueue: React.FC<BatchPageQueueProps> = ({
  pages,
  onAddMorePhotos,
  onUploadMorePhotos,
  onRemovePage,
  onMovePage,
  onStartBatchOCR,
  onCancel,
}) => {
  const [previewPage, setPreviewPage] = useState<BatchPageItem | null>(null);
  return (
    <div className="flex flex-col h-[calc(100vh-60px)] max-w-4xl mx-auto p-3 sm:p-5 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Layers className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Batch Photo Extraction
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {pages.length} page{pages.length === 1 ? '' : 's'} queued. Text will be extracted sequentially in this exact order.
          </p>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            Clear / Cancel
          </button>

          <button
            onClick={onStartBatchOCR}
            disabled={pages.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition"
          >
            <span>Scan All ({pages.length} Pages)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Pages Queue List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 transition"
          >
            {/* Sequence Badge & Handle */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-xs dark:bg-blue-950 dark:text-blue-300">
                #{index + 1}
              </div>

              {/* Page Thumbnail with click to preview */}
              <button
                type="button"
                onClick={() => setPreviewPage(page)}
                className="group/thumb relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Click to preview page image"
              >
                <img
                  src={page.dataUrl}
                  alt={`Page ${index + 1}`}
                  className="h-full w-full object-cover group-hover/thumb:scale-105 transition"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition">
                  <Eye className="h-4 w-4 text-white" />
                </div>
              </button>

              {/* Title / Sequence Info */}
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Document Page {index + 1}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Will be extracted {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`}
                </p>
              </div>
            </div>

            {/* Reorder & Delete Actions */}
            <div className="flex items-center gap-1">
              {/* Move Up */}
              <button
                onClick={() => onMovePage(index, 'up')}
                disabled={index === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Move earlier in document sequence"
              >
                <ArrowUp className="h-4 w-4" />
              </button>

              {/* Move Down */}
              <button
                onClick={() => onMovePage(index, 'down')}
                disabled={index === pages.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Move later in document sequence"
              >
                <ArrowDown className="h-4 w-4" />
              </button>

              {/* Remove Page */}
              <button
                onClick={() => onRemovePage(page.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                title="Remove page from batch"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add More Photos Dropzone Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          {/* Add with Camera button */}
          <button
            onClick={onAddMorePhotos}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-4 text-xs font-semibold text-blue-700 hover:bg-blue-100/60 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 active:scale-98 transition shadow-xs"
          >
            <Camera className="h-4 w-4 text-blue-600" />
            <span>+ Add Next Page with Camera</span>
          </button>

          {/* Add by uploading photo button */}
          <button
            onClick={onUploadMorePhotos}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 active:scale-98 transition shadow-xs"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            <span>+ Add Photos from Files</span>
          </button>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/95 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Extracted text will be compiled into one sequential document.</span>
        </div>

        <button
          onClick={onStartBatchOCR}
          disabled={pages.length === 0}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 transition"
        >
          <span>Extract All {pages.length} Pages</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Full Page Image Preview Modal */}
      {previewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative max-h-[90vh] max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden flex flex-col border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 text-white">
              <span className="text-sm font-semibold">
                Page {previewPage.pageNumber} Preview
              </span>
              <button
                onClick={() => setPreviewPage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/60">
              <img
                src={previewPage.dataUrl}
                alt={`Page ${previewPage.pageNumber}`}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
