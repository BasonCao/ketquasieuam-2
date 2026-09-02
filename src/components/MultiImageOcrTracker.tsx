import React, { useState } from 'react';
import { 
  OcrImageJob, 
  RawPage, 
  OcrCoverage, 
  UltrasoundReport 
} from '../types/ultrasound';
import { 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  FileText, 
  Code, 
  Layers, 
  AlertTriangle, 
  Eye, 
  X, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface MultiImageOcrTrackerProps {
  jobs: OcrImageJob[];
  coverage?: OcrCoverage | null;
  rawPages?: RawPage[];
  isProcessing: boolean;
  processingProgress: number;
  processingStep: string;
  onRetryFailed: () => void;
  onRetryAll: () => void;
  onForceProceedPartial?: () => void;
}

export const MultiImageOcrTracker: React.FC<MultiImageOcrTrackerProps> = ({
  jobs,
  coverage,
  rawPages = [],
  isProcessing,
  processingProgress,
  processingStep,
  onRetryFailed,
  onRetryAll,
  onForceProceedPartial,
}) => {
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [selectedRawPage, setSelectedRawPage] = useState<RawPage | null>(null);
  const [copied, setCopied] = useState(false);

  if (!jobs || jobs.length === 0) return null;

  const successCount = jobs.filter((j) => j.status === 'success').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;
  const processingCount = jobs.filter((j) => j.status === 'processing' || j.status === 'retrying').length;
  const isAllDone = successCount === jobs.length;
  const hasFailed = failedCount > 0;

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (job: OcrImageJob) => {
    switch (job.status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {job.pageNumber ? `Trang ${job.pageNumber}` : 'Hoàn tất'} ({job.text.length} ký tự)
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md animate-pulse">
            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
            Đang OCR...
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
            Thử lại lần {job.retryCount}...
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-md">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Thất bại {job.retryCount > 0 ? `(${job.retryCount} lần thử)` : ''}
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-slate-400" />
            Chờ xử lý
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 my-4 shadow-lg text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Tiến Trình OCR Từng Trang ({successCount}/{jobs.length} ảnh)
          </h3>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {hasFailed && !isProcessing && (
            <button
              onClick={onRetryFailed}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 rounded-lg transition active:scale-95 shadow-sm"
              title="Chỉ OCR lại các ảnh bị lỗi"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              OCR Lại Ảnh Lỗi ({failedCount})
            </button>
          )}

          {!isProcessing && jobs.length > 0 && (
            <button
              onClick={onRetryAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition active:scale-95"
            >
              <RefreshCw className="w-3 h-3" />
              Quét Lại Toàn Bộ
            </button>
          )}

          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-300 bg-slate-800/80 hover:bg-slate-800 border border-cyan-500/30 rounded-lg transition"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Debug Panel</span>
            {showDebugPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Progress Bar (when active) */}
      {isProcessing && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              {processingStep}
            </span>
            <span className="font-mono text-cyan-400">{processingProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Per-Image Job Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-3">
        {(jobs || []).map((job, idx) => {
          const matchedRawPage = (rawPages || []).find((rp) => rp.imageIndex === job.imageIndex);
          return (
            <div
              key={job.id || idx}
              className={`p-2.5 rounded-lg border flex flex-col justify-between transition-all ${
                job.status === 'success'
                  ? 'bg-slate-800/50 border-emerald-500/30 hover:border-emerald-500/50'
                  : job.status === 'failed'
                  ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                  : job.status === 'processing' || job.status === 'retrying'
                  ? 'bg-cyan-950/20 border-cyan-500/40 animate-pulse'
                  : 'bg-slate-800/30 border-slate-700/60'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-300 shrink-0 border border-slate-700">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 truncate" title={job.fileName}>
                    {job.fileName || `Ảnh ${idx + 1}`}
                  </span>
                </div>
                {getStatusBadge(job)}
              </div>

              {/* Detected Sections & Snippet */}
              {job.status === 'success' && (
                <div className="mt-1">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {job.detectedSections && job.detectedSections.length > 0 ? (
                      (job.detectedSections || []).slice(0, 3).map((sec, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[9px] bg-slate-800 text-cyan-300 px-1.5 py-0.2 rounded font-mono border border-slate-700"
                        >
                          {sec}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Đã trích xuất ký tự</span>
                    )}
                    {job.detectedSections && job.detectedSections.length > 3 && (
                      <span className="text-[9px] text-slate-400">+{job.detectedSections.length - 3}</span>
                    )}
                  </div>

                  {matchedRawPage && (
                    <button
                      onClick={() => setSelectedRawPage(matchedRawPage)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1 underline hover:no-underline"
                    >
                      <Eye className="w-3 h-3" /> Xem OCR thô
                    </button>
                  )}
                </div>
              )}

              {/* Error Message */}
              {job.status === 'failed' && (
                <div className="mt-1 text-[10px] text-rose-300 bg-rose-950/40 p-1.5 rounded border border-rose-800/40">
                  {job.error || 'Không thể OCR ảnh này'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coverage & Incomplete Alert */}
      {hasFailed && !isProcessing && (
        <div className="mt-3 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">
                OCR chưa đầy đủ: {successCount}/{jobs.length} ảnh hoàn tất ({failedCount} ảnh thất bại)
              </p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Hệ thống không tự ý suy đoán dữ liệu thiếu. Bạn có thể OCR lại ảnh bị lỗi hoặc tiếp tục với số ảnh đã đọc được.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRetryFailed}
              className="px-3 py-1.5 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-lg transition active:scale-95 shadow"
            >
              OCR Lại Ảnh Lỗi
            </button>
            {onForceProceedPartial && (
              <button
                onClick={onForceProceedPartial}
                className="px-2.5 py-1.5 text-xs font-medium text-amber-300 bg-slate-800 hover:bg-slate-700 border border-amber-500/30 rounded-lg transition"
              >
                Tiếp tục với {successCount} ảnh
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success Steps Summary */}
      {isAllDone && !isProcessing && (
        <div className="mt-3 p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex flex-wrap items-center gap-3 text-xs text-emerald-300">
          <span className="font-semibold flex items-center gap-1 text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Đã OCR thành công {jobs.length}/{jobs.length} trang
          </span>
          <span className="text-[11px] text-slate-400">•</span>
          <span className="text-[11px] text-slate-300">Ghép báo cáo theo thứ tự trang</span>
          <span className="text-[11px] text-slate-400">•</span>
          <span className="text-[11px] text-slate-300">Trích xuất cấu trúc & Chuẩn hóa hoàn tất</span>
        </div>
      )}

      {/* Debug Panel Drawer */}
      {showDebugPanel && (
        <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              OCR Debug & Section Coverage Details
            </span>
          </div>

          {coverage && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
              <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Tổng số ảnh</span>
                <span className="font-bold text-slate-200">{coverage.totalImages}</span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Thành công / Thất bại</span>
                <span className="font-bold text-emerald-400">{coverage.successfulImages}</span>
                <span className="text-slate-500"> / </span>
                <span className="font-bold text-rose-400">{coverage.failedImages}</span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Trang phát hiện</span>
                <span className="font-bold text-cyan-400">{coverage.totalPagesDetected} trang</span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Trang bị thiếu</span>
                <span className={`font-bold ${coverage.pagesMissing.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {coverage.pagesMissing.length > 0 ? coverage.pagesMissing.join(', ') : 'Không'}
                </span>
              </div>
            </div>
          )}

          {/* Section Coverage Badges */}
          {coverage && coverage.sectionsDetected && coverage.sectionsDetected.length > 0 && (
            <div className="mb-3">
              <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Sections đã nhận diện:</span>
              <div className="flex flex-wrap gap-1.5">
                {(coverage.sectionsDetected || []).map((sec, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/20 font-mono"
                  >
                    ✓ {sec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Raw Pages List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {(rawPages || []).map((rp, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700 text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-semibold text-slate-200">
                    Trang {rp.pageNumber} ({rp.fileName || `Ảnh ${rp.imageIndex + 1}`})
                  </span>
                  <span className="text-[10px] text-slate-400">({rp.characterCount} ký tự)</span>
                </div>
                <button
                  onClick={() => setSelectedRawPage(rp)}
                  className="px-2 py-0.5 text-[11px] text-cyan-400 hover:text-cyan-300 bg-slate-900 border border-slate-700 rounded transition"
                >
                  Xem nội dung OCR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Page Text Inspection Modal */}
      {selectedRawPage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-xs sm:text-sm font-bold text-white">
                  Nội Dung OCR Thô — Trang {selectedRawPage.pageNumber} ({selectedRawPage.fileName})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyText(selectedRawPage.text)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
                <button
                  onClick={() => setSelectedRawPage(null)}
                  className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 bg-slate-950 whitespace-pre-wrap select-text leading-relaxed">
              {selectedRawPage.text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
