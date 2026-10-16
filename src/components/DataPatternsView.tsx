import React, { useState } from 'react';
import {
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ExternalLink,
  Copy,
  Check,
  Calculator,
  PlusCircle,
  PhoneCall,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  DetectedEntity,
  EntitySummary,
  getGoogleCalendarUrl,
} from '../utils/entityDetector';
import { copyToClipboard } from '../services/exportService';

interface DataPatternsViewProps {
  text: string;
  entities: DetectedEntity[];
  summary: EntitySummary;
  onSelectEntity?: (entity: DetectedEntity) => void;
}

export const DataPatternsView: React.FC<DataPatternsViewProps> = ({
  text,
  entities,
  summary,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'email' | 'phone' | 'date' | 'currency' | 'url'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeEntityModal, setActiveEntityModal] = useState<DetectedEntity | null>(null);

  const handleCopy = async (id: string, value: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const success = await copyToClipboard(value);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyAll = async (type: string, items: DetectedEntity[]) => {
    const combined = items.map((i) => i.value).join('\n');
    await copyToClipboard(combined);
    setCopiedId(`all_${type}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered list of entity cards
  const filteredEntities = entities.filter((e) =>
    selectedFilter === 'all' ? true : e.type === selectedFilter
  );

  // Render text with highlighted inline badges
  const renderHighlightedText = () => {
    if (entities.length === 0) {
      return (
        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {text}
        </div>
      );
    }

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    entities.forEach((entity, idx) => {
      // Plain text before entity
      if (entity.startIndex > currentIndex) {
        elements.push(
          <span key={`text_${currentIndex}`}>
            {text.substring(currentIndex, entity.startIndex)}
          </span>
        );
      }

      // Styled entity badge
      let badgeClasses = '';
      let icon = null;

      if (entity.type === 'email') {
        badgeClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800';
        icon = <Mail className="inline h-3 w-3 mr-1" />;
      } else if (entity.type === 'phone') {
        badgeClasses = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
        icon = <Phone className="inline h-3 w-3 mr-1" />;
      } else if (entity.type === 'date') {
        badgeClasses = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800';
        icon = <Calendar className="inline h-3 w-3 mr-1" />;
      } else if (entity.type === 'currency') {
        badgeClasses = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold';
        icon = <DollarSign className="inline h-3 w-3 mr-0.5" />;
      } else if (entity.type === 'url') {
        badgeClasses = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
        icon = <ExternalLink className="inline h-3 w-3 mr-1" />;
      }

      elements.push(
        <button
          key={entity.id || `ent_${idx}`}
          onClick={() => setActiveEntityModal(entity)}
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium cursor-pointer transition hover:opacity-85 shadow-2xs mx-0.5 text-xs ${badgeClasses}`}
          title={`Click for one-tap action on ${entity.label}`}
        >
          {icon}
          {entity.raw}
        </button>
      );

      currentIndex = entity.endIndex;
    });

    // Remainder of text
    if (currentIndex < text.length) {
      elements.push(
        <span key={`text_end_${currentIndex}`}>{text.substring(currentIndex)}</span>
      );
    }

    return (
      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200">
        {elements}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
      {/* Top Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All Patterns ({entities.length})
          </button>

          {summary.dates.length > 0 && (
            <button
              onClick={() => setSelectedFilter('date')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedFilter === 'date'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300'
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>Dates ({summary.dates.length})</span>
            </button>
          )}

          {summary.phones.length > 0 && (
            <button
              onClick={() => setSelectedFilter('phone')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedFilter === 'phone'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
              }`}
            >
              <Phone className="h-3 w-3" />
              <span>Phones ({summary.phones.length})</span>
            </button>
          )}

          {summary.emails.length > 0 && (
            <button
              onClick={() => setSelectedFilter('email')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedFilter === 'email'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300'
              }`}
            >
              <Mail className="h-3 w-3" />
              <span>Emails ({summary.emails.length})</span>
            </button>
          )}

          {summary.currencies.length > 0 && (
            <button
              onClick={() => setSelectedFilter('currency')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedFilter === 'currency'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
            >
              <DollarSign className="h-3 w-3" />
              <span>Amounts ({summary.currencies.length})</span>
            </button>
          )}

          {summary.urls.length > 0 && (
            <button
              onClick={() => setSelectedFilter('url')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedFilter === 'url'
                  ? 'bg-cyan-600 text-white shadow-2xs'
                  : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-300'
              }`}
            >
              <ExternalLink className="h-3 w-3" />
              <span>Links ({summary.urls.length})</span>
            </button>
          )}
        </div>

        {/* Total Calculation pill for receipts/invoices */}
        {summary.totalCurrencyAmount && summary.totalCurrencyAmount > 0 ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Calculator className="h-3.5 w-3.5" />
            <span>
              Total: {summary.currencySymbol}
              {summary.totalCurrencyAmount.toFixed(2)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Two Panes or Stacked: Highlighted Text View & Action Cards Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left pane: Highlighted interactive text */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Interactive Text (Tap any badge to act)
            </span>
            <span className="text-[11px] text-slate-400">
              {entities.length} item{entities.length === 1 ? '' : 's'} identified
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800">
            {renderHighlightedText()}
          </div>
        </div>

        {/* Right pane: One-Tap Quick Actions List */}
        <div className="lg:w-80 p-3 sm:p-4 overflow-y-auto bg-slate-50/60 dark:bg-slate-950/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                One-Tap Action Items
              </span>
              {filteredEntities.length > 1 && (
                <button
                  onClick={() => handleCopyAll(selectedFilter, filteredEntities)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copiedId === `all_${selectedFilter}` ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>Copied all!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {filteredEntities.length === 0 ? (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500">
                <Sparkles className="mx-auto h-8 w-8 mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No {selectedFilter === 'all' ? 'patterns' : selectedFilter} detected
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Extracted text doesn't contain recognized {selectedFilter === 'all' ? 'dates, emails, phones, or prices' : selectedFilter}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEntities.map((entity) => {
                  return (
                    <div
                      key={entity.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs hover:border-blue-400 dark:hover:border-blue-500 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          {entity.type === 'phone' && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                              Phone
                            </span>
                          )}
                          {entity.type === 'email' && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                              Email
                            </span>
                          )}
                          {entity.type === 'date' && (
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                              Date
                            </span>
                          )}
                          {entity.type === 'currency' && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                              Amount
                            </span>
                          )}
                          {entity.type === 'url' && (
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                              Link
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {entity.raw}
                        </p>
                      </div>

                      {/* One-Tap Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {entity.type === 'phone' && (
                          <a
                            href={`tel:${entity.value.replace(/\s+/g, '')}`}
                            className="flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 transition"
                            title="Call Phone Number"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                            <span>Call</span>
                          </a>
                        )}

                        {entity.type === 'email' && (
                          <a
                            href={`mailto:${entity.value}`}
                            className="flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition"
                            title="Send Email"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Email</span>
                          </a>
                        )}

                        {entity.type === 'date' && (
                          <a
                            href={getGoogleCalendarUrl(entity.value)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 items-center gap-1 rounded-lg bg-purple-600 px-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-700 active:scale-95 transition"
                            title="Add Event to Google Calendar"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span>Calendar</span>
                          </a>
                        )}

                        {entity.type === 'url' && (
                          <a
                            href={entity.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 items-center gap-1 rounded-lg bg-cyan-600 px-2 text-xs font-semibold text-white shadow-2xs hover:bg-cyan-700 active:scale-95 transition"
                            title="Open Link"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Open</span>
                          </a>
                        )}

                        {/* Copy Button */}
                        <button
                          onClick={(e) => handleCopy(entity.id, entity.value, e)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          title="Copy to clipboard"
                        >
                          {copiedId === entity.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal on clicking an inline badge */}
      {activeEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              One-Tap Action: {activeEntityModal.label}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 break-all font-mono">
              {activeEntityModal.raw}
            </p>

            <div className="flex flex-col gap-2">
              {activeEntityModal.type === 'phone' && (
                <a
                  href={`tel:${activeEntityModal.value.replace(/\s+/g, '')}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Call {activeEntityModal.value}</span>
                </a>
              )}

              {activeEntityModal.type === 'email' && (
                <a
                  href={`mailto:${activeEntityModal.value}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                  <span>Compose Email</span>
                </a>
              )}

              {activeEntityModal.type === 'date' && (
                <a
                  href={getGoogleCalendarUrl(activeEntityModal.value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Create Calendar Event</span>
                </a>
              )}

              {activeEntityModal.type === 'url' && (
                <a
                  href={activeEntityModal.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-cyan-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Website</span>
                </a>
              )}

              <button
                onClick={(e) => {
                  handleCopy(activeEntityModal.id, activeEntityModal.value, e);
                  setTimeout(() => setActiveEntityModal(null), 700);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copiedId === activeEntityModal.id ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy to Clipboard</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setActiveEntityModal(null)}
                className="mt-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
