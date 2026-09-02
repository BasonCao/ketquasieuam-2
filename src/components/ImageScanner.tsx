import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  Scan, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FileCheck,
  Plus
} from 'lucide-react';
import { SAMPLE_CASES, SampleCase } from '../data/sampleCases';
import { 
  UltrasoundReport, 
  OcrImageJob, 
  OcrCoverage, 
  RawPage 
} from '../types/ultrasound';
import { runMultiImageOcrPipeline } from '../services/multiImageOcrPipeline';
import { MultiImageOcrTracker } from './MultiImageOcrTracker';

interface ImageScannerProps {
  isOfflineMode: boolean;
  onExtractionComplete: (extractedData: any, sourceImages: string[], mode: 'online_ai' | 'offline_ocr') => void;
  onLoadSample: (sampleData: Partial<UltrasoundReport>) => void;
}

export const ImageScanner: React.FC<ImageScannerProps> = ({
  isOfflineMode,
  onExtractionComplete,
  onLoadSample,
}) => {
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Multi-image OCR jobs & coverage tracking
  const [ocrJobs, setOcrJobs] = useState<OcrImageJob[]>([]);
  const [ocrCoverage, setOcrCoverage] = useState<OcrCoverage | null>(null);
  const [rawPages, setRawPages] = useState<RawPage[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Global paste handler (Ctrl+V to paste screenshot from ultrasound workstation)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setImages((prev) => [...prev, event.target!.result as string]);
                setSuccessMessage('Đã dán ảnh từ Clipboard (Ctrl+V)');
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WebP)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImages((prev) => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setOcrJobs((prev) => prev.filter((_, i) => i !== index));
    if (previewImage === images[index]) {
      setPreviewImage(null);
    }
  };

  const handleStartExtraction = async (retryOnlyFailed: boolean = false) => {
    if (images.length === 0) {
      setErrorMessage('Vui lòng tải lên ít nhất 1 ảnh màn hình siêu âm.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingProgress(10);
    setProcessingStep(`Bắt đầu OCR từng ảnh (${images.length} ảnh)...`);

    try {
      const result = await runMultiImageOcrPipeline({
        images,
        isOfflineMode,
        maxRetries: 2,
        concurrency: 2,
        existingJobs: ocrJobs,
        retryOnlyFailed,
        onJobUpdate: (updatedJob, allJobs) => {
          setOcrJobs(allJobs);
        },
        onProgress: (prog, step) => {
          setProcessingProgress(prog);
          setProcessingStep(step);
        },
      });

      setOcrJobs(result.jobs);
      setOcrCoverage(result.coverage);
      setRawPages(result.rawPages);

      if (result.success && result.report) {
        const isFullCoverage = result.coverage.successfulImages === images.length;
        setProcessingProgress(100);
        setProcessingStep('Hoàn tất trích xuất sinh trắc học!');
        setTimeout(() => {
          onExtractionComplete(result.report, images, isOfflineMode ? 'offline_ocr' : 'online_ai');
          setIsProcessing(false);
          if (isFullCoverage) {
            setSuccessMessage(`Đã OCR và trích xuất thành công toàn bộ ${result.coverage.successfulImages}/${images.length} trang!`);
          } else {
            // Partial coverage: data was preserved (I.A) but user must know some pages failed.
            setSuccessMessage(null);
            setErrorMessage(
              `Đã trích xuất một phần: ${result.coverage.successfulImages}/${images.length} trang thành công. ` +
              `Dữ liệu các trang thành công đã được giữ lại trên form — bấm "Retry failed images" để đọc lại trang lỗi.`
            );
          }
        }, 300);
      } else {
        setIsProcessing(false);
        setErrorMessage(
          result.error ||
            `OCR chưa hoàn thành (${result.coverage.successfulImages}/${images.length} ảnh). Vui lòng kiểm tra hoặc bấm OCR lại ảnh lỗi.`
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi quét hình ảnh. Bạn có thể nhập thủ công.');
    }
  };

  const handleRetryFailedJobs = () => {
    handleStartExtraction(true);
  };

  const handleRetryAll = () => {
    handleStartExtraction(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl mb-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Scan className="w-5 h-5 text-cyan-400" />
            Trích Xuất Chỉ Số Tự Động Từ Ảnh Siêu Âm
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hỗ trợ máy GE Voluson, Samsung WS80A/HERA, Philips, Mindray. Nhận diện Trang 1, Trang 2 (Doppler & Ối).
          </p>
        </div>

        {/* Quick Sample Selector Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Ca mẫu có sẵn:
          </span>
          {SAMPLE_CASES.slice(0, 3).map((s) => (
            <button
              key={s.id}
              onClick={() => onLoadSample(s.data)}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition font-medium"
            >
              {s.badge}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Zone & Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-7 border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all min-h-[190px] cursor-pointer ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
              : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-500/20">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div className="text-sm font-semibold text-slate-200">
            Kéo thả ảnh báo cáo siêu âm vào đây, hoặc{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="text-cyan-400 hover:underline font-bold focus:outline-none"
            >
              chọn từ máy
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Hỗ trợ chụp màn hình, ảnh JPG/PNG, chụp từ điện thoại hoặc dán trực tiếp <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-mono">Ctrl + V</kbd>
          </p>

          <div className="flex items-center gap-2 mt-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              onClick={(e) => e.stopPropagation()}
              accept="image/*"
              multiple
              className="hidden"
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs rounded-xl font-bold transition shadow-md active:scale-95"
            >
              <ImageIcon className="w-4 h-4" />
              Thêm Ảnh Mới
            </button>
          </div>
        </div>

        {/* Uploaded Images List & Actions */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                Ảnh đã tải lên ({images.length})
              </span>
              {images.length > 0 && (
                <button
                  onClick={() => setImages([])}
                  className="text-xs text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Xóa hết
                </button>
              )}
            </div>

            {images.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="h-28 flex flex-col items-center justify-center text-slate-400 text-xs cursor-pointer border border-dashed border-slate-700 hover:border-cyan-500 rounded-lg p-3 text-center bg-slate-900/40 hover:bg-slate-900/80 transition group"
              >
                <span className="group-hover:text-cyan-300 font-medium">Chưa có ảnh nào được chọn. Bấm vào đây để chọn ảnh</span>
                <span className="text-[11px] mt-1 text-cyan-400 font-bold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Thêm ảnh mới
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-lg overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center"
                  >
                    <img
                      src={img}
                      alt={`Ultrasound page ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"
                      onClick={() => setPreviewImage(img)}
                    />
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded">
                      Trang {idx + 1}
                    </div>
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-rose-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                      title="Xóa ảnh này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trigger Scan Button */}
          <div className="mt-3 pt-3 border-t border-slate-700/60">
            <button
              onClick={handleStartExtraction}
              disabled={isProcessing || images.length === 0}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                images.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : isProcessing
                  ? 'bg-cyan-600 text-white cursor-wait opacity-80'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{processingStep || 'Đang xử lý chỉ số...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>
                    {isOfflineMode ? 'Quét Chỉ Số Bằng Offline OCR' : 'AI Tự Động Lọc Chỉ Số & Điền Form'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scanning Progress Bar */}
      {isProcessing && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span className="font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              {processingStep}
            </span>
            <span className="font-bold text-cyan-400">{processingProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Multi-Image OCR Tracker & Debug Drawer */}
      {images.length > 0 && (
        <MultiImageOcrTracker
          jobs={ocrJobs}
          coverage={ocrCoverage}
          rawPages={rawPages}
          isProcessing={isProcessing}
          processingProgress={processingProgress}
          processingStep={processingStep}
          onRetryFailed={handleRetryFailedJobs}
          onRetryAll={handleRetryAll}
        />
      )}

      {/* Messages */}
      {successMessage && (
        <div className="mt-3 p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Interactive Image Zoom / Inspection Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 text-slate-200">
              <span className="text-xs font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                Đối Chiếu Ảnh Báo Cáo Siêu Âm Gốc
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-300"
                >
                  Mặc định
                </button>
                <button
                  onClick={() => {
                    setPreviewImage(null);
                    setZoomLevel(1);
                  }}
                  className="px-2.5 py-1 rounded text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium ml-2"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Image Viewer Area */}
            <div className="flex-1 overflow-auto bg-black p-4 flex items-center justify-center">
              <img
                src={previewImage}
                alt="Ultrasound Preview"
                style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                className="max-w-full max-h-[70vh] object-contain rounded select-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
