import React, { useState, useRef, useEffect } from 'react';
import { 
  UltrasoundReport, 
  Measurements2D, 
  OcrImageJob, 
  OcrCoverage, 
  RawPage,
  StitchedImageInfo,
  DopplerCalculationItem
} from '../types/ultrasound';
import { resolveDopplerCalculationsGroup, buildDopplerCalcDisplayRows, applyDopplerCalcRowEdit } from '../utils/dopplerCalculationsSchema';
import { 
  Sparkles, 
  Edit3, 
  Save, 
  RefreshCw, 
  Scan, 
  UploadCloud, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Image as ImageIcon,
  ZoomIn,
  Bug,
  Terminal,
  Check,
  Layers,
  FileCheck,
  Settings
} from 'lucide-react';
import { runMultiImageOcrPipeline } from '../services/multiImageOcrPipeline';
import { runImageFirstOcrPipeline } from '../services/stitchedOcrPipeline';
import { MultiImageOcrTracker } from './MultiImageOcrTracker';
import { runPipelineVerificationTests } from '../utils/__tests__/extractionPipeline.test';

export type OCRMode = "PER_IMAGE" | "STITCH_THEN_OCR";

interface GeReportTabProps {
  report: UltrasoundReport;
  onChange: (report: UltrasoundReport) => void;
  onLoadOcrCase?: () => void;
  isOfflineMode: boolean;
  showToast: (msg: string) => void;
}

export const GeReportTab: React.FC<GeReportTabProps> = ({ 
  report, 
  onChange, 
  onLoadOcrCase, 
  isOfflineMode,
  showToast 
}) => {
  const p = report.patient;
  const m = report.measurements;
  const efw = report.efw;

  // Image scanner internal states
  const [images, setImages] = useState<string[]>(report.imageUrls || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Multi-image OCR jobs & coverage tracking
  const [ocrJobs, setOcrJobs] = useState<OcrImageJob[]>(report.ocrJobs || []);
  const [ocrCoverage, setOcrCoverage] = useState<OcrCoverage | null>(report.ocrCoverage || null);
  const [rawPages, setRawPages] = useState<RawPage[]>(report.rawPages || []);
  const [stitchedInfo, setStitchedInfo] = useState<StitchedImageInfo | null>(report.stitchedImage || null);
  const [showStitchedModal, setShowStitchedModal] = useState(false);
  const [ocrMode, setOcrMode] = useState<OCRMode>("STITCH_THEN_OCR");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [testResults, setTestResults] = useState<{ testName: string; passed: boolean; message: string }[]>([]);

  const handleRunPipelineTests = () => {
    const res = runPipelineVerificationTests();
    setTestResults(res);
    setShowDebugLogs(true);
    showToast('Đã chạy xong kiểm thử tự động Pipeline GE Voluson!');
  };

  // Sync internal images state when report.imageUrls is updated externally
  useEffect(() => {
    setImages(report.imageUrls || []);
  }, [report.imageUrls]);

  useEffect(() => {
    setOcrJobs(report.ocrJobs || []);
    setOcrCoverage(report.ocrCoverage || { sectionsDetected: [], coveragePercent: 0, confidence: 0 });
    setRawPages(report.rawPages || []);
    setStitchedInfo(report.stitchedImage || null);
  }, [report.ocrJobs, report.ocrCoverage, report.rawPages, report.stitchedImage]);

  // Global paste handler (Ctrl+V)
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
                const newImg = event.target!.result as string;
                setImages((prev) => {
                  const updated = [...prev, newImg];
                  setTimeout(() => onChange({ ...report, imageUrls: updated }), 0);
                  return updated;
                });
                showToast('Đã thêm ảnh từ Clipboard (Ctrl+V)');
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [report, onChange, showToast]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const newImgs: string[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WebP)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newImgs.push(e.target!.result as string);
          if (newImgs.length === files.length) {
            setImages((prev) => {
              const updated = [...prev, ...newImgs];
              setTimeout(() => onChange({ ...report, imageUrls: updated }), 0);
              return updated;
            });
            showToast(`Đã thêm ${files.length} ảnh mới vào danh sách OCR`);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setTimeout(() => onChange({ ...report, imageUrls: updated }), 0);
      return updated;
    });
    setOcrJobs((prev) => prev.filter((_, i) => i !== index));
    if (previewImage === images[index]) {
      setPreviewImage(null);
    }
  };

  // --- PRIMARY PIPELINE: Image-First Vertical Stitched OCR ---
  const handleStartImageFirstExtraction = async () => {
    if (images.length === 0) {
      setErrorMessage('Vui lòng thêm ít nhất 1 ảnh màn hình siêu âm trước khi chạy OCR.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingProgress(5);
    setProcessingStep(`Khởi tạo pipeline Image-First (${images.length} ảnh)...`);

    try {
      const result = await runImageFirstOcrPipeline(
        images,
        [],
        {
          currentReport: report,
          ocrMode: ocrMode,
          onProgress: (step: string, prog: number) => {
            setProcessingProgress(prog);
            setProcessingStep(step);
          }
        }
      );

      if (result.stitchedResult) {
        setStitchedInfo(result.stitchedResult);
      }

      if (result.success && result.report) {
        onChange(result.report);
        setIsProcessing(false);
        const pageCount = result.stitchedResult?.pageCount || images.length;
        setSuccessMessage(`Đã OCR và ghép ${pageCount} trang báo cáo thành công theo quy trình Image-First!`);
        showToast(`Hoàn tất OCR ${pageCount} trang thành 1 dòng dữ liệu hoàn chỉnh!`);
      } else {
        setIsProcessing(false);
        setErrorMessage(
          result.error ||
            'Không thể trích xuất dữ liệu từ ảnh báo cáo. Vui lòng kiểm tra lại chất lượng ảnh.'
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi xử lý pipeline ghép dọc.');
    }
  };

  // Secondary fallback: Job-based Multi-Image OCR Extraction
  const handleStartExtraction = async (retryOnlyFailed: boolean = false) => {
    if (images.length === 0) {
      setErrorMessage('Vui lòng thêm ít nhất 1 ảnh màn hình siêu âm trước khi chạy OCR.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingProgress(10);
    setProcessingStep(`Bắt đầu OCR từng ảnh độc lập (${images.length} ảnh)...`);

    try {
      const result = await runMultiImageOcrPipeline(
        {
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
        },
        report
      );

      setOcrJobs(result.jobs);
      setOcrCoverage(result.coverage);
      setRawPages(result.rawPages);

      if (result.success && result.report) {
        const isFullCoverage = result.coverage.successfulImages === images.length;
        onChange(result.report);
        setIsProcessing(false);
        if (isFullCoverage) {
          setSuccessMessage(`Đã OCR thành công toàn bộ ${result.coverage.successfulImages}/${images.length} ảnh vào bảng!`);
          showToast(`Hoàn tất OCR & Ghép ${result.coverage.successfulImages} trang báo cáo!`);
        } else {
          // Partial coverage (I.A): keep the successful pages' data on the form,
          // but make sure the user knows some pages still need a retry.
          setErrorMessage(
            `Đã OCR một phần: ${result.coverage.successfulImages}/${images.length} ảnh. Dữ liệu các ảnh thành công đã được đưa vào bảng — bấm "Retry failed images" cho các ảnh còn lại.`
          );
          showToast(`OCR một phần: ${result.coverage.successfulImages}/${images.length} trang.`);
        }
      } else {
        setIsProcessing(false);
        setErrorMessage(
          result.error ||
            `OCR chưa hoàn thành (${result.coverage.successfulImages}/${images.length} ảnh). Vui lòng kiểm tra hoặc bấm OCR lại ảnh lỗi.`
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi OCR hình ảnh.');
    }
  };

  const handleRetryFailedJobs = () => {
    handleStartExtraction(true);
  };

  const handleRetryAll = () => {
    handleStartExtraction(false);
  };

  const isValueDifferent = (current: any, original: any) => {
    if (original === undefined || original === null) return false;
    
    const normalize = (v: any) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return v.toString();
      return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
    };

    return normalize(current) !== normalize(original);
  };

  const getOcrDiff = (section: 'patient' | 'measurements' | 'efw' | 'doppler' | 'amnioticFluid', field: string, currentValue: any) => {
    if (!report.originalOcrData) return null;
    
    let originalValue: any = null;
    if (section === 'patient') {
      originalValue = report.originalOcrData.patient?.[field as keyof typeof report.originalOcrData.patient];
    } else if (section === 'measurements') {
      originalValue = report.originalOcrData.measurements?.[field];
    } else if (section === 'efw') {
      originalValue = report.originalOcrData.efw;
    } else if (section === 'doppler') {
      if (field === 'fhr') {
        originalValue = report.originalOcrData.fhr;
      } else if (field === 'uaPi') {
        originalValue = report.originalOcrData.uaPi;
      } else if (field === 'uaRi') {
        originalValue = report.originalOcrData.uaRi;
      } else if (field === 'mcaPi') {
        originalValue = report.originalOcrData.mcaPi;
      }
    } else if (section === 'amnioticFluid') {
      if (field === 'afi') {
        originalValue = report.originalOcrData.afi;
      }
    }

    if (originalValue === undefined || originalValue === null) {
      return null;
    }

    const isDifferent = isValueDifferent(currentValue, originalValue);
    return isDifferent ? originalValue : null;
  };

  const getInputClassName = (section: 'patient' | 'measurements' | 'efw' | 'doppler' | 'amnioticFluid', field: string, baseClass: string, currentValue: any) => {
    const ocrDiff = getOcrDiff(section, field, currentValue);
    if (ocrDiff !== null) {
      return `${baseClass} border-amber-500/80 bg-amber-950/20 text-amber-200 focus:border-amber-400 ring-1 ring-amber-500/50`;
    }
    return baseClass;
  };

  const renderOcrWarningIndicator = (section: 'patient' | 'measurements' | 'efw' | 'doppler' | 'amnioticFluid', field: string, currentValue: any, onRestore: () => void) => {
    const originalValue = getOcrDiff(section, field, currentValue);
    if (originalValue === null) return null;

    return (
      <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400 font-sans font-semibold bg-amber-950/40 border border-amber-800/40 rounded px-1.5 py-0.5 animate-pulse select-none">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Gốc: {originalValue}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
            showToast(`Khôi phục chỉ số gốc từ OCR: ${originalValue}`);
          }}
          className="ml-1 hover:text-white underline text-cyan-400 hover:text-cyan-300 font-bold"
          title="Khôi phục giá trị OCR gốc"
        >
          Khôi phục
        </button>
      </div>
    );
  };

  const getDifferences = () => {
    if (!report.originalOcrData) return [];
    const diffs: { field: string; label: string; current: any; original: any; restore: () => void }[] = [];

    const ocr = report.originalOcrData;

    // Demographics
    if (ocr.patient) {
      if (isValueDifferent(p.name, ocr.patient.name)) {
        diffs.push({
          field: 'patient.name',
          label: 'Họ và tên',
          current: p.name || 'Trống',
          original: ocr.patient.name,
          restore: () => updatePatient('name', ocr.patient?.name)
        });
      }
      if (isValueDifferent(p.patientId, ocr.patient.patientId)) {
        diffs.push({
          field: 'patient.patientId',
          label: 'Mã BN (Pat. ID)',
          current: p.patientId || 'Trống',
          original: ocr.patient.patientId,
          restore: () => updatePatient('patientId', ocr.patient?.patientId)
        });
      }
      if (isValueDifferent(p.yearOfBirth, ocr.patient.yearOfBirth)) {
        diffs.push({
          field: 'patient.yearOfBirth',
          label: 'Năm sinh (DOB)',
          current: p.yearOfBirth || 'Trống',
          original: ocr.patient.yearOfBirth,
          restore: () => updatePatient('yearOfBirth', ocr.patient?.yearOfBirth)
        });
      }
      if (isValueDifferent(p.lmp, ocr.patient.lmp)) {
        diffs.push({
          field: 'patient.lmp',
          label: 'Kỳ kinh cuối (LMP)',
          current: p.lmp || 'Trống',
          original: ocr.patient.lmp,
          restore: () => updatePatient('lmp', ocr.patient?.lmp)
        });
      }
      if (isValueDifferent(p.gaClin, ocr.patient.gaClin)) {
        diffs.push({
          field: 'patient.gaClin',
          label: 'Tuổi thai lâm sàng (GA Clin)',
          current: p.gaClin || 'Trống',
          original: ocr.patient.gaClin,
          restore: () => updatePatient('gaClin', ocr.patient?.gaClin)
        });
      }
      if (isValueDifferent(p.edd, ocr.patient.edd)) {
        diffs.push({
          field: 'patient.edd',
          label: 'Dự kiến sinh (EDD)',
          current: p.edd || 'Trống',
          original: ocr.patient.edd,
          restore: () => updatePatient('edd', ocr.patient?.edd)
        });
      }
    }

    // Measurements
    if (ocr.measurements) {
      Object.keys(ocr.measurements).forEach((mKey) => {
        const currentVal = m[mKey as keyof Measurements2D]?.value;
        const originalVal = ocr.measurements?.[mKey];
        if (originalVal !== undefined && originalVal !== null && isValueDifferent(currentVal, originalVal)) {
          diffs.push({
            field: `measurements.${mKey}`,
            label: `Chỉ số 2D: ${mKey.toUpperCase()}`,
            current: currentVal !== null && currentVal !== undefined ? `${currentVal} mm` : 'Trống',
            original: `${originalVal} mm`,
            restore: () => updateMeasurement(mKey as any, 'value', originalVal)
          });
        }
      });
    }

    // EFW
    if (ocr.efw !== undefined && ocr.efw !== null && isValueDifferent(efw.value, ocr.efw)) {
      diffs.push({
        field: 'efw',
        label: 'Cân nặng ước tính (EFW)',
        current: efw.value ? `${efw.value} g` : 'Trống',
        original: `${ocr.efw} g`,
        restore: () => updateEfw('value', ocr.efw)
      });
    }

    // Doppler FHR
    if (ocr.fhr !== undefined && ocr.fhr !== null && isValueDifferent(report.doppler?.fhr?.value, ocr.fhr)) {
      diffs.push({
        field: 'fhr',
        label: 'Nhịp tim thai (FHR)',
        current: report.doppler?.fhr?.value ? `${report.doppler.fhr.value} bpm` : 'Trống',
        original: `${ocr.fhr} bpm`,
        restore: () => updateDoppler('fhr', 'value', ocr.fhr)
      });
    }

    // Doppler UA Pi
    const currentUaPi = report.doppler?.umbilicalArtery?.pi;
    if (ocr.uaPi !== undefined && ocr.uaPi !== null && isValueDifferent(currentUaPi, ocr.uaPi)) {
      diffs.push({
        field: 'uaPi',
        label: 'Động mạch rốn (UA PI)',
        current: currentUaPi ?? 'Trống',
        original: ocr.uaPi,
        restore: () => updateDoppler('umbilicalArtery', 'pi', ocr.uaPi)
      });
    }

    // Doppler UA Ri
    const currentUaRi = report.doppler?.umbilicalArtery?.ri;
    if (ocr.uaRi !== undefined && ocr.uaRi !== null && isValueDifferent(currentUaRi, ocr.uaRi)) {
      diffs.push({
        field: 'uaRi',
        label: 'Động mạch rốn (UA RI)',
        current: currentUaRi ?? 'Trống',
        original: ocr.uaRi,
        restore: () => updateDoppler('umbilicalArtery', 'ri', ocr.uaRi)
      });
    }

    // Doppler MCA Pi
    const currentMcaPi = report.doppler?.middleCerebralArtery?.pi;
    if (ocr.mcaPi !== undefined && ocr.mcaPi !== null && isValueDifferent(currentMcaPi, ocr.mcaPi)) {
      diffs.push({
        field: 'mcaPi',
        label: 'Động mạch não giữa (MCA PI)',
        current: currentMcaPi ?? 'Trống',
        original: ocr.mcaPi,
        restore: () => updateDoppler('middleCerebralArtery', 'pi', ocr.mcaPi)
      });
    }

    // AFI
    const currentAfi = report.amnioticFluid?.afi?.value;
    if (ocr.afi !== undefined && ocr.afi !== null && isValueDifferent(currentAfi, ocr.afi)) {
      diffs.push({
        field: 'afi',
        label: 'Chỉ số nước ối (AFI)',
        current: currentAfi ? `${currentAfi} mm` : 'Trống',
        original: `${ocr.afi} mm`,
        restore: () => updateAfi('afi', 'value', ocr.afi)
      });
    }

    return diffs;
  };

  const updatePatient = (field: string, val: any) => {
    onChange({
      ...report,
      patient: { ...p, [field]: val },
    });
  };

  const updateEfw = (field: string, val: any) => {
    onChange({
      ...report,
      efw: { ...efw, [field]: val },
    });
  };

  const updateMeasurement = (key: keyof typeof m, field: string, val: any) => {
    onChange({
      ...report,
      measurements: {
        ...m,
        [key]: {
          ...(m[key] || { unit: 'mm' }),
          [field]: val,
        },
      },
    });
  };

  const updateAfi = (field: 'q1' | 'q2' | 'q3' | 'q4' | 'afi' | 'sdp', subField: string, val: any) => {
    const af = report.amnioticFluid || {
      q1: { value: null, unit: 'mm' },
      q2: { value: null, unit: 'mm' },
      q3: { value: null, unit: 'mm' },
      q4: { value: null, unit: 'mm' },
      afi: { value: null, unit: 'mm' },
      sdp: { value: null, unit: 'cm' },
      status: 'Bình thường'
    };
    onChange({
      ...report,
      amnioticFluid: {
        ...af,
        [field]: {
          ...(af[field] || { unit: field === 'afi' || field.startsWith('q') ? 'mm' : 'cm' }),
          [subField]: val,
        },
      },
    });
  };

  const updateDoppler = (section: 'middleCerebralArtery' | 'umbilicalArtery' | 'fhr', field: string, val: any) => {
    const dop = report.doppler || {
      fhr: { value: null, unit: 'bpm' },
      leftUterine: {},
      rightUterine: {},
      umbilicalArtery: {},
      middleCerebralArtery: {},
    };

    if (section === 'fhr') {
      onChange({
        ...report,
        doppler: {
          ...dop,
          fhr: {
            ...(dop.fhr || { unit: 'bpm' }),
            [field]: val,
          }
        }
      });
    } else {
      onChange({
        ...report,
        doppler: {
          ...dop,
          [section]: {
            ...(dop[section] || {}),
            [field]: val,
          }
        }
      });
    }
  };

  return (
    <div className="bg-[#0b0f19] text-[#e2e8f0] p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl font-mono text-xs space-y-6">
      
      {/* Top Banner Notice & Quick Action Buttons */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-cyan-400">
          <Scan className="w-5 h-5 animate-pulse" />
          <span className="font-bold text-sm sm:text-base tracking-wide font-sans">
            Quét Ảnh AI & Bảng Biểu OCR GE Voluson (Chỉnh Sửa Toàn Diện)
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRunPipelineTests}
            className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700 font-sans text-xs font-bold shadow transition flex items-center gap-1.5"
            title="Chạy kiểm thử tự động GE Voluson"
          >
            <Bug className="w-3.5 h-3.5 text-purple-400" />
            Kiểm Thử Pipeline
          </button>
          <button
            type="button"
            onClick={() => setShowDebugLogs(!showDebugLogs)}
            className={`px-3 py-1.5 rounded-xl font-sans text-xs font-bold shadow transition flex items-center gap-1.5 border ${
              showDebugLogs
                ? 'bg-cyan-600 text-white border-cyan-400'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            {showDebugLogs ? 'Ẩn Debug Mode' : 'Hiện Debug Mode'}
          </button>
          {onLoadOcrCase && (
            <button
              onClick={onLoadOcrCase}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-sans text-xs font-semibold shadow transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải Mẫu OCR Gần Nhất
            </button>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-sans text-xs font-medium flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Đồng bộ thời gian thực
          </span>
        </div>
      </div>

      {/* --- PIPELINE DEBUG MODE PANEL --- */}
      {showDebugLogs && (
        <div className="bg-slate-950 border border-cyan-800/80 rounded-2xl p-5 shadow-2xl space-y-4 font-mono text-xs animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h3 className="text-sm font-bold text-cyan-300 font-sans">
                PIPELINE DEBUG AUDITOR (RAW OCR $\rightarrow$ GEMINI $\rightarrow$ MAPPING $\rightarrow$ VALIDATION)
              </h3>
            </div>
            <button
              onClick={() => setShowDebugLogs(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700"
            >
              Đóng
            </button>
          </div>

          {/* Test Suite Verification Results */}
          {testResults.length > 0 && (
            <div className="bg-slate-900 border border-purple-800/60 rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5 font-sans">
                <Bug className="w-4 h-4 text-purple-400" />
                Kết Quả Regression Test (GE Voluson):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {testResults.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border flex items-center justify-between ${
                      t.passed
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                    }`}
                  >
                    <span className="font-semibold text-[11px]">{t.testName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-black/40">
                      {t.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline Log Summary */}
          {report._validationLogs ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Mapped Fields & Source Evidence */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="text-emerald-400 font-bold font-sans text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Chỉ số Đã Map ({report._validationLogs.mappedFieldsCount || 0})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 text-[11px]">
                  {report._validationLogs.mappedFields?.map((item, i) => (
                    <div key={i} className="text-emerald-300/90 bg-emerald-950/30 p-1 rounded px-2 border border-emerald-900/40">
                      {item}
                    </div>
                  )) || <span className="text-slate-500 italic">Chưa có chỉ số nào được map</span>}
                </div>
              </div>

              {/* Warnings & Blocked EFW Leaks */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="text-amber-400 font-bold font-sans text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Cảnh Báo & Từ Chối Nhầm Lẫn ({report._validationLogs.warnings?.length || 0})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 text-[11px]">
                  {report._validationLogs.warnings?.map((w, i) => (
                    <div key={i} className="text-amber-300/90 bg-amber-950/30 p-1 rounded px-2 border border-amber-900/40">
                      {w}
                    </div>
                  )) || <span className="text-slate-500 italic">Không có cảnh báo vi phạm</span>}
                </div>
              </div>

              {/* Raw JSON Extracted Output */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="text-cyan-400 font-bold font-sans text-xs flex items-center justify-between">
                  <span>RAW JSON từ OCR / Gemini</span>
                  <span className="text-[10px] text-slate-400">{report._validationLogs.timestamp?.slice(11, 19)}</span>
                </div>
                <pre className="max-h-48 overflow-y-auto bg-black p-2 rounded text-[10px] text-cyan-200/90 whitespace-pre-wrap border border-cyan-900/30">
                  {JSON.stringify(report._validationLogs.rawExtractedData || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center p-4 text-slate-400 font-sans">
              Chưa chạy OCR cho bản ghi này. Vui lòng bấm "Mở Ca Khám" hoặc "Bắt Đầu Trích Xuất OCR".
            </div>
          )}
        </div>
      )}

      {/* --- SECTION 1: MULTI-IMAGE UPLOAD & OCR EXECUTION CONTROLS --- */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              1. Quản Lý Ảnh Chụp Máy Siêu Âm ({images.length} ảnh)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
              Thêm nhiều ảnh màn hình (Trang 1: Sinh trắc, Trang 2: Doppler & Ối) rồi bấm Chạy OCR Tự Động.
            </p>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              multiple
              accept="image/*"
              className="hidden"
            />
            
            {/* BUTTON 1: THÊM ẢNH */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-sans text-xs font-bold border border-slate-700 shadow-md transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Thêm Ảnh Mới</span>
            </button>

            {/* BUTTON: XEM ẢNH GHÉP DỌC (NẾU CÓ) */}
            {stitchedInfo && stitchedInfo.stitchedImageSrc && (
              <button
                onClick={() => setShowStitchedModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-purple-200 font-sans text-xs font-bold border border-purple-800 shadow-md transition flex items-center gap-1.5"
                title="Xem ảnh ghép dọc đa trang và bounding box"
              >
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Xem Ảnh Ghép ({stitchedInfo.totalPages} trang)</span>
              </button>
            )}

            {/* BUTTON 1B: XÓA TẤT CẢ ẢNH */}
            {images.length > 0 && (
              <button
                onClick={() => {
                  setImages([]);
                  setStitchedInfo(null);
                  onChange({ ...report, imageUrls: [], stitchedImage: undefined });
                  showToast('Đã xóa toàn bộ ảnh');
                }}
                className="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 font-sans text-xs font-bold border border-red-800/60 shadow-md transition flex items-center gap-1.5"
                title="Xóa tất cả ảnh đã tải lên"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Xóa Tất Cả</span>
              </button>
            )}

            {/* BUTTON 2: CHẠY OCR */}
            <button
              onClick={handleStartImageFirstExtraction}
              disabled={isProcessing || images.length === 0}
              className={`px-4 py-2 rounded-xl font-sans text-xs font-bold shadow-lg transition flex items-center gap-2 ${
                isProcessing || images.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-900/50'
              }`}
            >
              <Sparkles className={`w-4 h-4 text-cyan-100 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Đang Xử Lý...' : '⚡ Chạy OCR'}</span>
            </button>
          </div>
        </div>

        {/* OCR Mode Selection */}
        <div className="bg-[#0b0f19] border border-slate-700/60 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h4 className="text-slate-300 text-xs font-bold font-sans flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              PHƯƠNG THỨC OCR
            </h4>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 self-stretch sm:self-auto w-full sm:w-auto">
            <button
              onClick={() => setOcrMode("STITCH_THEN_OCR")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                ocrMode === "STITCH_THEN_OCR" 
                  ? "bg-cyan-900/60 text-cyan-300 border border-cyan-800 shadow-sm" 
                  : "text-slate-400 hover:text-slate-300 border border-transparent"
              }`}
            >
              <div className="font-bold">Ghép ảnh rồi OCR</div>
              <div className="text-[10px] font-normal opacity-80">Giữ ngữ cảnh liên tục</div>
            </button>
            <button
              onClick={() => setOcrMode("PER_IMAGE")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                ocrMode === "PER_IMAGE" 
                  ? "bg-cyan-900/60 text-cyan-300 border border-cyan-800 shadow-sm" 
                  : "text-slate-400 hover:text-slate-300 border border-transparent"
              }`}
            >
              <div className="font-bold">OCR từng ảnh</div>
              <div className="text-[10px] font-normal opacity-80">Ổn định nhiều trang</div>
            </button>
          </div>
        </div>

        {/* Drag and Drop Zone / Image Thumbnails Grid */}
        <div
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-4 bg-slate-950/60 transition flex flex-col items-center justify-center text-center gap-3"
        >
          {images.length === 0 ? (
            <div className="py-4 space-y-2">
              <UploadCloud className="w-10 h-10 text-cyan-500 mx-auto animate-bounce" />
              <div className="font-sans text-xs text-slate-300 font-medium">
                Kéo thả nhiều ảnh siêu âm vào đây, bấm <span className="text-cyan-400 font-bold">"Thêm Ảnh Mới"</span> hoặc dán ảnh (<span className="text-cyan-400">Ctrl+V</span>)
              </div>
              <div className="text-[10px] text-slate-500">Hỗ trợ PNG, JPG, WEBP (nhiều trang siêu âm)</div>
            </div>
          ) : (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative group bg-slate-900 border border-slate-700 rounded-lg overflow-hidden aspect-[4/3] shadow">
                  <img src={img} alt={`Ultrasound ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewImage(img)}
                      title="Phóng to"
                      className="p-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeImage(idx)}
                      title="Xóa ảnh"
                      className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 bg-slate-900/80 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
                    Trang {idx + 1}
                  </span>
                </div>
              ))}
              
              {/* Add more button tile */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-cyan-300 aspect-[4/3] transition bg-slate-900/40"
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-sans font-bold">Thêm ảnh</span>
              </button>
            </div>
          )}
        </div>

        {/* Processing Progress Bar */}
        {isProcessing && (
          <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-cyan-500/30">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-sans">
              <span className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin text-cyan-400" />
                {processingStep}
              </span>
              <span className="font-mono font-bold">{processingProgress}%</span>
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

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>


      {/* --- SECTION 2: GE VOLUSON SCREEN & EDITABLE TABLE --- */}
      <div className="bg-[#111827] border-2 border-slate-700/80 rounded-xl p-3 sm:p-5 shadow-2xl space-y-4">
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-700 pb-2 text-slate-300">
          <div className="flex items-center gap-3">
            <span className="bg-white text-slate-950 font-black px-2 py-0.5 rounded text-sm tracking-tighter">GE</span>
            <input
              type="text"
              value={p.clinicHeader || 'DR CAO BA SON 57 HD9 VIN 1'}
              onChange={(e) => updatePatient('clinicHeader', e.target.value)}
              className="bg-[#0b0f19] border border-slate-700 text-slate-100 font-bold px-2 py-1 rounded text-xs w-64 uppercase"
            />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <span>Date of Exam:</span>
              <input
                type="text"
                value={p.examDate || ''}
                onChange={(e) => updatePatient('examDate', e.target.value)}
                className="bg-[#0b0f19] border border-slate-700 text-white font-bold px-1.5 py-0.5 rounded w-24 text-center"
              />
            </div>
            <div>Page <span className="text-white font-bold">1 / {images.length || 1}</span></div>
          </div>
        </div>

        {/* REAL-TIME OCR COMPARISON AND ACCORDION PANEL */}
        {report.originalOcrData && (() => {
          const diffList = getDifferences();
          if (diffList.length === 0) {
            return (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 text-emerald-200">
                <div className="flex items-center gap-2 font-sans">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-xs sm:text-sm">Tất cả dữ liệu khớp hoàn hảo!</span>
                    <p className="text-[10px] text-emerald-400/80 mt-0.5">Không phát hiện sự khác biệt nào giữa dữ liệu biểu mẫu hiện tại và kết quả quét OCR gốc.</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-amber-950/20 border-2 border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
                <div className="flex items-center gap-2 font-sans">
                  <AlertCircle className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-amber-200">Phát hiện {diffList.length} trường có sự khác biệt so với OCR gốc!</span>
                    <p className="text-[10px] text-amber-300/70 mt-0.5 font-sans">Các giá trị đã bị sửa đổi trong biểu mẫu khám. Dưới đây là bảng đối chiếu chi tiết:</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    diffList.forEach(d => d.restore());
                    showToast(`Đã đồng bộ lại toàn bộ ${diffList.length} chỉ số từ OCR gốc!`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-sans text-xs font-bold shadow-md transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Đồng bộ tất cả về OCR gốc
                </button>
              </div>

              {/* Comparison Grid */}
              <div className="max-h-60 overflow-y-auto scrollbar-thin border border-amber-500/20 rounded-lg bg-slate-950/60 divide-y divide-amber-500/10">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead>
                    <tr className="bg-slate-900/80 text-amber-300 font-sans font-bold">
                      <th className="p-2 w-1/3">Tên trường thông tin</th>
                      <th className="p-2 w-1/4">Kết quả quét OCR gốc</th>
                      <th className="p-2 w-1/4">Dữ liệu biểu mẫu hiện tại</th>
                      <th className="p-2 text-center w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffList.map((d) => (
                      <tr key={d.field} className="hover:bg-amber-500/5 transition border-b border-amber-500/10">
                        <td className="p-2 font-sans font-bold text-amber-100">{d.label}</td>
                        <td className="p-2 text-emerald-400 font-bold">{d.original}</td>
                        <td className="p-2 text-amber-400 font-bold">{d.current}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              d.restore();
                              showToast(`Đã khôi phục ${d.label} về giá trị OCR gốc!`);
                            }}
                            className="px-2 py-0.5 rounded bg-amber-950 border border-amber-600/50 text-amber-300 hover:bg-amber-600 hover:text-white transition font-sans text-[10px]"
                          >
                            Khôi phục
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Patient Demographics Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 bg-[#1f2937]/60 p-3 rounded-lg border border-slate-700">
          <div className="flex flex-col gap-0.5 w-full">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-20 shrink-0 font-sans">Name</span>
              <input
                type="text"
                value={p.name || ''}
                onChange={(e) => updatePatient('name', e.target.value)}
                placeholder="Tên bệnh nhân..."
                className={getInputClassName('patient', 'name', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 text-cyan-300 px-2 py-1 rounded w-full font-bold uppercase", p.name)}
              />
            </div>
            {renderOcrWarningIndicator('patient', 'name', p.name, () => updatePatient('name', report.originalOcrData?.patient?.name))}
          </div>

          <div className="flex flex-col gap-0.5 w-full">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-16 shrink-0 font-sans">DOB</span>
              <input
                type="text"
                value={p.yearOfBirth || ''}
                onChange={(e) => updatePatient('yearOfBirth', e.target.value)}
                placeholder="Năm sinh..."
                className={getInputClassName('patient', 'yearOfBirth', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 text-slate-300 px-2 py-1 rounded w-full", p.yearOfBirth)}
              />
            </div>
            {renderOcrWarningIndicator('patient', 'yearOfBirth', p.yearOfBirth, () => updatePatient('yearOfBirth', report.originalOcrData?.patient?.yearOfBirth))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-12 shrink-0 font-sans">Sex</span>
            <input
              type="text"
              value={p.gender || 'Female'}
              onChange={(e) => updatePatient('gender', e.target.value)}
              className="bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 text-slate-300 px-2 py-1 rounded w-full"
            />
          </div>

          <div className="flex flex-col gap-0.5 w-full">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-20 shrink-0 font-sans">Pat. ID</span>
              <input
                type="text"
                value={p.patientId || ''}
                onChange={(e) => updatePatient('patientId', e.target.value)}
                placeholder="Mã BN..."
                className={getInputClassName('patient', 'patientId', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 text-cyan-300 px-2 py-1 rounded w-full font-bold", p.patientId)}
              />
            </div>
            {renderOcrWarningIndicator('patient', 'patientId', p.patientId, () => updatePatient('patientId', report.originalOcrData?.patient?.patientId))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-24 shrink-0 font-sans">Perf. Phys.</span>
            <input
              type="text"
              value=""
              onChange={() => {}}
              readOnly
              placeholder=""
              className="bg-[#0b0f19] border border-slate-600 text-slate-300 px-2 py-1 rounded w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-20 shrink-0 font-sans">Sonogr.</span>
            <input
              type="text"
              value={p.sonographer || 'DR CAO BA SON'}
              onChange={(e) => updatePatient('sonographer', e.target.value)}
              className="bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 text-slate-300 px-2 py-1 rounded w-full font-bold"
            />
          </div>
        </div>

        {/* Gestational Age / LMP / DOC Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#1f2937]/40 p-2.5 rounded-lg border border-slate-700 text-[11px]">
          {(report.pregnancyDating?.type === 'IVF' || report.patient.datingSource?.startsWith('IVF')) && (
            <div className="col-span-full bg-cyan-950/60 border border-cyan-700/80 p-2.5 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-cyan-200">
              <div className="flex items-center gap-2">
                <span className="bg-cyan-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">IVF Pregnancy</span>
                <span className="font-semibold text-white">Dating: {report.patient.datingSource === 'IVF_DAY3' ? 'IVF Day 3' : 'IVF Day 5'}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                <span>Transfer: <strong className="text-white">{report.patient.transferDate || report.pregnancyDating?.transferDate || p.doc || '--'}</strong></span>
                <span>GA: <strong className="text-cyan-300">{p.ga || report.pregnancyDating?.ga || p.gaClin || '--'}</strong></span>
                <span>EDD: <strong className="text-emerald-400">{p.edd || report.pregnancyDating?.edd || '--'}</strong></span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0.5 w-full">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 w-12 font-sans">LMP</span>
              <input 
                type="text" 
                value={p.lmp || ''} 
                onChange={(e) => updatePatient('lmp', e.target.value)}
                className={getInputClassName('patient', 'lmp', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 px-2 py-0.5 rounded w-full text-slate-300", p.lmp)} 
              />
            </div>
            {renderOcrWarningIndicator('patient', 'lmp', p.lmp, () => updatePatient('lmp', report.originalOcrData?.patient?.lmp))}
          </div>

          <div className="flex flex-col gap-0.5 w-full">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 w-16 font-sans">
                {report.pregnancyDating?.type === 'IVF' || report.patient.datingSource?.startsWith('IVF') ? 'GA(IVF)' : 'GA(Clin)'}
              </span>
              <input 
                type="text" 
                value={p.ga || p.gaClin || ''} 
                onChange={(e) => {
                  updatePatient('gaClin', e.target.value);
                  updatePatient('ga', e.target.value);
                }}
                className={getInputClassName('patient', 'gaClin', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 px-2 py-0.5 rounded w-full text-cyan-300 font-bold", p.ga || p.gaClin)} 
              />
            </div>
            {renderOcrWarningIndicator('patient', 'gaClin', p.gaClin, () => updatePatient('gaClin', report.originalOcrData?.patient?.gaClin))}
          </div>

          <div className="flex flex-col gap-0.5 w-full">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 w-16 font-sans">
                {report.pregnancyDating?.type === 'IVF' || report.patient.datingSource?.startsWith('IVF') ? 'EDD(IVF)' : 'EDD(GA)'}
              </span>
              <input 
                type="text" 
                value={p.edd || ''} 
                onChange={(e) => updatePatient('edd', e.target.value)}
                className={getInputClassName('patient', 'edd', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 px-2 py-0.5 rounded w-full text-cyan-300 font-bold", p.edd)} 
              />
            </div>
            {renderOcrWarningIndicator('patient', 'edd', p.edd, () => updatePatient('edd', report.originalOcrData?.patient?.edd))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans">G</span>
              <input 
                type="text" 
                value={p.gravida || ''} 
                onChange={(e) => updatePatient('gravida', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 w-10 px-1 py-0.5 rounded text-center text-slate-300" 
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans">Ab</span>
              <input 
                type="text" 
                value={p.abortion || ''} 
                onChange={(e) => updatePatient('abortion', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 w-10 px-1 py-0.5 rounded text-center text-slate-300" 
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 w-12 font-sans truncate">
              {report.pregnancyDating?.type === 'IVF' 
                ? `Day ${report.pregnancyDating.embryoAge || 5} Trans.` 
                : 'DOC'}
            </span>
            <input 
              type="text" 
              value={p.doc || ''} 
              onChange={(e) => updatePatient('doc', e.target.value)}
              className="bg-[#0b0f19] border border-slate-600 px-2 py-0.5 rounded w-full text-slate-300 font-bold" 
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 w-16 font-sans">GA(AUA)</span>
            <input 
              type="text" 
              value={p.gaAua || ''} 
              onChange={(e) => updatePatient('gaAua', e.target.value)}
              className="bg-[#0b0f19] border border-slate-600 px-2 py-0.5 rounded w-full text-slate-300" 
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 w-16 font-sans">EDD(AUA)</span>
            <input 
              type="text" 
              value="" 
              onChange={() => {}}
              readOnly
              className="bg-[#0b0f19] border border-slate-600 px-2 py-0.5 rounded w-full text-slate-300" 
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans">P</span>
              <input 
                type="text" 
                value={p.para || ''} 
                onChange={(e) => updatePatient('para', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 w-10 px-1 py-0.5 rounded text-center text-slate-300" 
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans">Ec</span>
              <input 
                type="text" 
                value={p.ectopic || ''} 
                onChange={(e) => updatePatient('ectopic', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 w-10 px-1 py-0.5 rounded text-center text-slate-300" 
              />
            </div>
          </div>
        </div>

        {/* EFW (Hadlock) Row */}
        <div className="bg-[#1f2937]/80 border border-slate-600 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-200 font-sans">EFW (Hadlock)</span>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-600 text-[10px]">AC/FL/HC</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">Value:</span>
                <input
                  type="number"
                  value={efw.value ?? ''}
                  onChange={(e) => updateEfw('value', e.target.value ? Number(e.target.value) : null)}
                  className={getInputClassName('efw', 'value', "bg-[#0b0f19] border border-slate-600 focus:border-cyan-400 text-cyan-300 font-bold w-20 px-1.5 py-0.5 rounded text-right", efw.value)}
                />
                <span className="text-cyan-300">g</span>
              </div>
              {renderOcrWarningIndicator('efw', 'value', efw.value, () => updateEfw('value', report.originalOcrData?.efw))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Range:</span>
              <input
                type="text"
                value={efw.range || ''}
                onChange={(e) => updateEfw('range', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 text-slate-300 w-24 px-1.5 py-0.5 rounded text-center"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Age:</span>
              <input
                type="text"
                value={efw.gaAge || ''}
                onChange={(e) => updateEfw('gaAge', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 text-cyan-300 w-20 px-1.5 py-0.5 rounded text-center font-bold"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">GP%:</span>
              <input
                type="text"
                value={efw.percentile || ''}
                onChange={(e) => updateEfw('percentile', e.target.value)}
                className="bg-[#0b0f19] border border-slate-600 text-emerald-400 w-16 px-1.5 py-0.5 rounded text-center font-bold"
              />
            </div>
          </div>
        </div>

        {/* 2D Measurements Table (Fully Editable Labels & Values as requested) */}
        <div className="overflow-x-auto border border-slate-700 rounded-lg bg-[#0f172a]">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#1e293b] text-slate-300 border-b border-slate-700 font-bold font-sans">
                <th className="p-2.5 w-52">2D Measurements</th>
                <th className="p-2.5 w-12 text-center">AUA</th>
                <th className="p-2.5 text-right">Value (mm)</th>
                <th className="p-2.5 text-right">m1</th>
                <th className="p-2.5 text-right">m2</th>
                <th className="p-2.5 text-right">m3</th>
                <th className="p-2.5 w-16 text-center">Meth.</th>
                <th className="p-2.5 text-center w-28">GP (%)</th>
                <th className="p-2.5 text-left w-28">Age (Tuổi thai)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[
                { key: 'crl', defaultLabel: 'CRL (Hadlock)' },
                { key: 'nt', defaultLabel: 'NT' },
                { key: 'bpd', defaultLabel: 'BPD (Hadlock)' },
                { key: 'hc', defaultLabel: 'HC (INTERGRW)' },
                { key: 'vp', defaultLabel: 'Vp' },
                { key: 'tcd', defaultLabel: 'Cereb (Hill)' },
                { key: 'cm', defaultLabel: 'CM' },
                { key: 'bod', defaultLabel: 'BOD (Jeanty)' },
                { key: 'nbl', defaultLabel: 'NBL (Sonek)' },
                { key: 'hl', defaultLabel: 'HL (Jeanty)' },
                { key: 'ac', defaultLabel: 'AC (Hadlock)' },
                { key: 'fl', defaultLabel: 'FL (Osaka)' },
                { key: 'foot', defaultLabel: 'Foot (Chitty)' },
                { key: 'cervixLength', defaultLabel: 'Cervix Length' },
                { key: 'gs', defaultLabel: 'GS' },
                { key: 'ys', defaultLabel: 'YS' },
              ].map(({ key, defaultLabel }) => {
                const item = m[key as keyof typeof m] || { value: null, unit: 'mm' };

                return (
                  <tr key={key} className="hover:bg-slate-800/50">
                    {/* READ-ONLY STATIC LABEL AS REQUESTED */}
                    <td className="p-2.5 font-bold text-slate-200 font-sans pl-3.5">
                      {defaultLabel}
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="rounded bg-slate-800 border-slate-600 text-cyan-500" />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(() => {
                          const originalVal = getOcrDiff('measurements', key, item.value);
                          return (
                            <>
                              {originalVal !== null && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateMeasurement(key as any, 'value', originalVal);
                                    showToast(`Khôi phục chỉ số gốc ${key.toUpperCase()}: ${originalVal} mm`);
                                  }}
                                  className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-800/60 rounded px-1 py-0.5 hover:bg-amber-600 hover:text-white font-sans font-semibold transition shrink-0"
                                  title={`Giá trị OCR gốc: ${originalVal} mm. Click để khôi phục.`}
                                >
                                  Gốc: {originalVal}
                                </button>
                              )}
                              <input
                                type="number"
                                step="0.01"
                                value={item.value ?? ''}
                                onChange={(e) => updateMeasurement(key as any, 'value', e.target.value ? Number(e.target.value) : null)}
                                className={getInputClassName('measurements', key, "bg-[#0b0f19] border border-slate-700 focus:border-cyan-400 text-cyan-300 font-bold w-20 px-1.5 py-0.5 rounded text-right", item.value)}
                              />
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.m1 ?? ''}
                        onChange={(e) => updateMeasurement(key as any, 'm1', e.target.value ? Number(e.target.value) : null)}
                        className="bg-[#0b0f19] border border-slate-700 text-slate-300 w-20 px-1.5 py-0.5 rounded text-right"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="-"
                        value={item.m2 ?? ''}
                        onChange={(e) => updateMeasurement(key as any, 'm2', e.target.value ? Number(e.target.value) : null)}
                        className="bg-[#0b0f19] border border-slate-700 text-slate-300 w-20 px-1.5 py-0.5 rounded text-right placeholder:text-slate-600"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="-"
                        value={item.m3 ?? ''}
                        onChange={(e) => updateMeasurement(key as any, 'm3', e.target.value ? Number(e.target.value) : null)}
                        className="bg-[#0b0f19] border border-slate-700 text-slate-300 w-20 px-1.5 py-0.5 rounded text-right placeholder:text-slate-600"
                      />
                    </td>
                    <td className="p-2 text-center text-slate-400 bg-slate-900/50">{item.method || 'last'}</td>
                    <td className="p-2 text-center">
                      <input
                        type="text"
                        value={item.percentile || ''}
                        onChange={(e) => updateMeasurement(key as any, 'percentile', e.target.value)}
                        placeholder="VD: 27.0%"
                        className="bg-[#0b0f19] border border-slate-700 text-cyan-300 w-20 px-1.5 py-0.5 rounded text-center"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.gaAge || ''}
                        onChange={(e) => updateMeasurement(key as any, 'gaAge', e.target.value)}
                        placeholder="VD: 26w6d"
                        className="bg-[#0b0f19] border border-slate-700 text-slate-300 w-24 px-1.5 py-0.5 rounded font-semibold"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Doppler Measurements Table matching the uploaded image */}
        <div className="overflow-x-auto border border-slate-700 rounded-lg bg-[#0f172a] mt-4">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#1e293b] text-slate-300 border-b border-slate-700 font-bold font-sans">
                <th className="p-2.5 w-60">Doppler Measurements</th>
                <th className="p-2.5 text-right w-36">Value</th>
                <th className="p-2.5 text-right w-24">m1</th>
                <th className="p-2.5 text-right w-20">m2</th>
                <th className="p-2.5 text-right w-20">m3</th>
                <th className="p-2.5 text-right w-20">m4</th>
                <th className="p-2.5 text-right w-20">m5</th>
                <th className="p-2.5 text-right w-20">m6</th>
                <th className="p-2.5 w-20 text-center">Meth.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[
                {
                  category: 'Fetal Heart Rate (Nhịp tim thai)',
                  items: [
                    { key: 'value', label: 'Ventricular FHR', section: 'fhr', unit: 'bpm', defaultMeth: 'avg' },
                  ]
                },
                {
                  category: 'Left Uterine (Động mạch tử cung trái)',
                  items: [
                    { key: 'ps', label: 'PS', section: 'leftUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ed', label: 'ED', section: 'leftUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'tamax', label: 'TAmax', section: 'leftUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'md', label: 'MD', section: 'leftUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ri', label: 'RI', section: 'leftUterine', defaultMeth: 'avg' },
                    { key: 'pi', label: 'PI', section: 'leftUterine', defaultMeth: 'avg' },
                    { key: 'sd', label: 'S/D', section: 'leftUterine', defaultMeth: 'avg' },
                    { key: 'hr', label: 'HR', section: 'leftUterine', unit: 'bpm', defaultMeth: 'max' },
                  ]
                },
                {
                  category: 'Right Uterine (Động mạch tử cung phải)',
                  items: [
                    { key: 'ps', label: 'PS', section: 'rightUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ed', label: 'ED', section: 'rightUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'tamax', label: 'TAmax', section: 'rightUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'md', label: 'MD', section: 'rightUterine', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ri', label: 'RI', section: 'rightUterine', defaultMeth: 'avg' },
                    { key: 'pi', label: 'PI', section: 'rightUterine', defaultMeth: 'avg' },
                    { key: 'sd', label: 'S/D', section: 'rightUterine', defaultMeth: 'avg' },
                    { key: 'hr', label: 'HR', section: 'rightUterine', unit: 'bpm', defaultMeth: 'max' },
                  ]
                },
                {
                  category: 'Umbilical Art. (Động mạch rốn - UA)',
                  items: [
                    { key: 'ps', label: 'PS', section: 'umbilicalArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ed', label: 'ED', section: 'umbilicalArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'tamax', label: 'TAmax', section: 'umbilicalArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'md', label: 'MD', section: 'umbilicalArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ri', label: 'RI', section: 'umbilicalArtery', defaultMeth: 'avg' },
                    { key: 'pi', label: 'PI', section: 'umbilicalArtery', defaultMeth: 'avg' },
                    { key: 'sd', label: 'S/D', section: 'umbilicalArtery', defaultMeth: 'avg' },
                    { key: 'hr', label: 'HR', section: 'umbilicalArtery', unit: 'bpm', defaultMeth: 'max' },
                  ]
                },
                {
                  category: 'Mid Cereb Artery (Động mạch não giữa - MCA)',
                  items: [
                    { key: 'ps', label: 'PS', section: 'middleCerebralArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ed', label: 'ED', section: 'middleCerebralArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'tamax', label: 'TAmax', section: 'middleCerebralArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'md', label: 'MD', section: 'middleCerebralArtery', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'ri', label: 'RI', section: 'middleCerebralArtery', defaultMeth: 'avg' },
                    { key: 'pi', label: 'PI', section: 'middleCerebralArtery', defaultMeth: 'avg' },
                    { key: 'sd', label: 'S/D', section: 'middleCerebralArtery', defaultMeth: 'avg' },
                    { key: 'hr', label: 'HR', section: 'middleCerebralArtery', unit: 'bpm', defaultMeth: 'max' },
                  ]
                },
                {
                  category: 'Ductus Venosus (Ống tĩnh mạch - DV)',
                  items: [
                    { key: 's', label: 'S (S wave)', section: 'ductusVenosus', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'tamax', label: 'TAmax', section: 'ductusVenosus', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'a', label: 'a (a wave)', section: 'ductusVenosus', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'd', label: 'D (D wave)', section: 'ductusVenosus', unit: 'cm/s', defaultMeth: 'max' },
                    { key: 'pi', label: 'PI', section: 'ductusVenosus', defaultMeth: 'avg' },
                    { key: 'sa', label: 'S/a', section: 'ductusVenosus', defaultMeth: 'avg' },
                    { key: 'aS', label: 'a/S', section: 'ductusVenosus', defaultMeth: 'avg' },
                    { key: 'pviv', label: 'PVIV', section: 'ductusVenosus', defaultMeth: 'avg' },
                    { key: 'pli', label: 'PLI', section: 'ductusVenosus', defaultMeth: 'avg' },
                    { key: 'hr', label: 'HR', section: 'ductusVenosus', unit: 'bpm', defaultMeth: 'max' },
                  ]
                }
              ].map((grp) => (
                <React.Fragment key={grp.category}>
                  {/* Category Header Row */}
                  <tr className="bg-slate-900/80 border-y border-slate-800">
                    <td colSpan={9} className="p-2 font-bold text-purple-300 font-sans pl-3.5 tracking-wide text-[10px] uppercase">
                      {grp.category}
                    </td>
                  </tr>
                  {grp.items.map((row) => {
                    const d = report.doppler || {};
                    let currentVal: number | null = null;
                    if (row.section === 'fhr') {
                      currentVal = d.fhr?.value ?? null;
                    } else {
                      const sec = d[row.section] || {};
                      currentVal = (sec as any)[row.key] ?? null;
                    }

                    let fieldKey = '';
                    let onRestoreDoppler = () => {};
                    if (row.section === 'fhr') {
                      fieldKey = 'fhr';
                      onRestoreDoppler = () => updateDoppler('fhr', 'value', report.originalOcrData?.fhr);
                    } else if (row.section === 'umbilicalArtery' && row.key === 'pi') {
                      fieldKey = 'uaPi';
                      onRestoreDoppler = () => updateDoppler('umbilicalArtery', 'pi', report.originalOcrData?.uaPi);
                    } else if (row.section === 'umbilicalArtery' && row.key === 'ri') {
                      fieldKey = 'uaRi';
                      onRestoreDoppler = () => updateDoppler('umbilicalArtery', 'ri', report.originalOcrData?.uaRi);
                    } else if (row.section === 'middleCerebralArtery' && row.key === 'pi') {
                      fieldKey = 'mcaPi';
                      onRestoreDoppler = () => updateDoppler('middleCerebralArtery', 'pi', report.originalOcrData?.mcaPi);
                    }

                    const originalVal = fieldKey ? getOcrDiff('doppler', fieldKey, currentVal) : null;

                    return (
                      <tr key={`${row.section}-${row.key}`} className="hover:bg-slate-800/30">
                        {/* Static sub-label */}
                        <td className="p-2 font-semibold text-slate-300 font-sans pl-5">
                          {row.label}
                        </td>
                        {/* Value Input + Unit */}
                        <td className="p-2 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end w-full">
                            {originalVal !== null && (
                              <button
                                type="button"
                                onClick={() => {
                                  onRestoreDoppler();
                                  showToast(`Khôi phục chỉ số gốc ${row.label}: ${originalVal}`);
                                }}
                                className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-800/60 rounded px-1 py-0.5 hover:bg-amber-600 hover:text-white font-sans font-semibold transition shrink-0"
                                title={`Giá trị OCR gốc: ${originalVal}. Click để khôi phục.`}
                              >
                                Gốc: {originalVal}
                              </button>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              value={currentVal ?? ''}
                              onChange={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                updateDoppler(row.section as any, row.key, v);
                              }}
                              className={fieldKey ? getInputClassName('doppler', fieldKey, "bg-[#0b0f19] border border-slate-700 focus:border-cyan-400 text-cyan-300 font-bold w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]", currentVal) : "bg-[#0b0f19] border border-slate-700 focus:border-cyan-400 text-cyan-300 font-bold w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]"}
                            />
                            {row.unit && (
                              <span className="text-[10px] text-slate-400 font-semibold w-10 text-left">
                                {row.unit}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* m1 (synchronized with Value) */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={currentVal ?? ''}
                            onChange={(e) => {
                              const v = e.target.value ? Number(e.target.value) : null;
                              updateDoppler(row.section as any, row.key, v);
                            }}
                            className="bg-[#0b0f19] border border-slate-700 text-slate-400 w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]"
                          />
                        </td>
                        {/* m2 to m6: Blank inputs conforming to GE Voluson layout */}
                        <td className="p-2 text-right text-slate-500">
                          <input
                            type="text"
                            disabled
                            placeholder=""
                            className="bg-transparent border-0 text-slate-600 w-16 px-1 py-0.5 rounded text-right cursor-not-allowed font-mono text-[10px]"
                          />
                        </td>
                        <td className="p-2 text-right text-slate-500">
                          <input
                            type="text"
                            disabled
                            placeholder=""
                            className="bg-transparent border-0 text-slate-600 w-16 px-1 py-0.5 rounded text-right cursor-not-allowed font-mono text-[10px]"
                          />
                        </td>
                        <td className="p-2 text-right text-slate-500">
                          <input
                            type="text"
                            disabled
                            placeholder=""
                            className="bg-transparent border-0 text-slate-600 w-16 px-1 py-0.5 rounded text-right cursor-not-allowed font-mono text-[10px]"
                          />
                        </td>
                        <td className="p-2 text-right text-slate-500">
                          <input
                            type="text"
                            disabled
                            placeholder=""
                            className="bg-transparent border-0 text-slate-600 w-16 px-1 py-0.5 rounded text-right cursor-not-allowed font-mono text-[10px]"
                          />
                        </td>
                        <td className="p-2 text-right text-slate-500">
                          <input
                            type="text"
                            disabled
                            placeholder=""
                            className="bg-transparent border-0 text-slate-600 w-16 px-1 py-0.5 rounded text-right cursor-not-allowed font-mono text-[10px]"
                          />
                        </td>
                        {/* Meth. standard badge */}
                        <td className="p-2 text-center">
                          <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {row.defaultMeth}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Doppler Calculations & Indices Table (Calculations: DV, UA, MCA, CPR, UtA) */}
        <div className="overflow-x-auto border border-purple-900/60 rounded-lg bg-[#0d1224] mt-4 shadow-md">
          <div className="p-3 bg-purple-950/40 border-b border-purple-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
              <span className="font-bold text-xs text-purple-200 uppercase tracking-wide font-sans">
                Doppler Calculations & Chỉ Số Tính Toán
              </span>
              <span className="text-[10px] text-purple-300/70 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-700/50">
                Lưu đầy đủ trong Form • Chọn tick để đưa vào PDF
              </span>
            </div>
          </div>
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-purple-950/30 text-purple-200 border-b border-purple-900/40 font-bold font-sans">
                <th className="p-2.5 w-14 text-center">In PDF</th>
                <th className="p-2.5 w-60">Parameter (Chỉ Số Tính)</th>
                <th className="p-2.5 w-40">Method (Phương Pháp)</th>
                <th className="p-2.5 text-right w-32">Value (Giá Trị)</th>
                <th className="p-2.5 text-center w-24">GP (%)</th>
                <th className="p-2.5 text-center w-24">MoM</th>
                <th className="p-2.5 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/40">
              {/* Phase 6: single source of truth is report.doppler.calculations
                  (canonical DopplerCalculationsGroup). Legacy report.dopplerCalculations
                  (array) is only ever read, one-way, when canonical is empty — see
                  utils/dopplerCalculationsSchema.ts. Edits here write only to
                  report.doppler.calculations; report.dopplerCalculations is never
                  written by production code anymore. */}
              {(() => {
                const resolution = resolveDopplerCalculationsGroup(report);
                if (resolution.conflict && resolution.warning) {
                  console.warn(resolution.warning);
                }
                const calcItems: DopplerCalculationItem[] = buildDopplerCalcDisplayRows(resolution.calculations);

                const writeCalculations = (nextGroup: ReturnType<typeof applyDopplerCalcRowEdit>) => {
                  onChange({ ...report, doppler: { ...report.doppler, calculations: nextGroup } });
                };

                const handleTogglePdf = (index: number) => {
                  const item = calcItems[index];
                  const nextGroup = applyDopplerCalcRowEdit(resolution.calculations, item.id!, {
                    includeInPdf: !item.includeInPdf,
                  });
                  writeCalculations(nextGroup);
                };

                const handleUpdateCalcValue = (index: number, val: number | null) => {
                  const item = calcItems[index];
                  const nextGroup = applyDopplerCalcRowEdit(resolution.calculations, item.id!, { value: val });
                  writeCalculations(nextGroup);
                };

                return calcItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-purple-950/20">
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={item.includeInPdf ?? false}
                        onChange={() => handleTogglePdf(idx)}
                        className="w-4 h-4 rounded border-purple-700 bg-slate-900 text-purple-500 focus:ring-purple-400 cursor-pointer"
                        title="Tick để in chỉ số này ra kết quả PDF"
                      />
                    </td>
                    <td className="p-2.5 font-bold text-purple-200 font-sans pl-3.5">
                      {item.parameter}
                    </td>
                    <td className="p-2.5 text-slate-400 font-mono text-[10px]">
                      {item.method || '-'}
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end w-full">
                        <input
                          type="number"
                          step="0.01"
                          value={item.value ?? ''}
                          onChange={(e) => handleUpdateCalcValue(idx, e.target.value ? Number(e.target.value) : null)}
                          className="bg-[#0b0f19] border border-purple-900/70 focus:border-purple-400 text-purple-300 font-bold w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]"
                        />
                        {item.unit && <span className="text-[10px] text-slate-400 font-semibold w-10 text-left">{item.unit}</span>}
                      </div>
                    </td>
                    <td className="p-2.5 text-center text-slate-300 font-mono text-[10px]">
                      {item.percentile ? `${item.percentile}%` : '-'}
                    </td>
                    <td className="p-2.5 text-center text-emerald-400 font-mono text-[10px]">
                      {item.mom ? `${item.mom} MoM` : '-'}
                    </td>
                    <td className="p-2.5 text-slate-400 text-[10px]">
                      {item.includeInPdf ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <Check className="w-3 h-3" /> Sẽ in ra PDF
                        </span>
                      ) : (
                        <span className="text-slate-500">Chỉ lưu trong Form</span>
                      )}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* AFI Quadrants & Total AFI Table (Q1, Q2, Q3, Q4, AFI) */}
        <div className="overflow-x-auto border border-slate-700 rounded-lg bg-[#0f172a] mt-4">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#1e293b] text-slate-300 border-b border-slate-700 font-bold font-sans">
                <th className="p-2.5 w-52">AFI Measurements (Nước ối 4 khoang)</th>
                <th className="p-2.5 w-12 text-center">AUA</th>
                <th className="p-2.5 text-right">Value (mm)</th>
                <th className="p-2.5 text-right">m1</th>
                <th className="p-2.5 text-right">m2</th>
                <th className="p-2.5 text-right">m3</th>
                <th className="p-2.5 w-16 text-center">Meth.</th>
                <th className="p-2.5 text-center w-28">GP (%)</th>
                <th className="p-2.5 text-left w-28">Age (Tuổi thai)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[
                { key: 'q1', label: 'Q1' },
                { key: 'q2', label: 'Q2' },
                { key: 'q3', label: 'Q3' },
                { key: 'q4', label: 'Q4' },
                { key: 'afi', label: 'AFI (Tổng 4 khoang)' },
                { key: 'sdp', label: 'MVP (Xoang ối lớn nhất)' },
              ].map(({ key, label }) => {
                const item = (report.amnioticFluid as any)?.[key] || { value: null, unit: 'mm' };
                const originalVal = key === 'afi' ? getOcrDiff('amnioticFluid', 'afi', item.value) : null;

                return (
                  <tr key={key} className="hover:bg-slate-800/50">
                    <td className="p-2.5 font-bold text-cyan-300 font-sans pl-3.5">{label}</td>
                    <td className="p-2 text-center">-</td>
                    <td className="p-2 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end w-full">
                        {originalVal !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              updateAfi('afi', 'value', originalVal);
                              showToast(`Khôi phục chỉ số nước ối gốc: ${originalVal} mm`);
                            }}
                            className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-800/60 rounded px-1 py-0.5 hover:bg-amber-600 hover:text-white font-sans font-semibold transition shrink-0"
                            title={`Giá trị OCR gốc: ${originalVal} mm. Click để khôi phục.`}
                          >
                            Gốc: {originalVal}
                          </button>
                        )}
                        <input
                          type="number"
                          step="0.01"
                          value={item.value ?? ''}
                          onChange={(e) => updateAfi(key as any, 'value', e.target.value ? Number(e.target.value) : null)}
                          className={key === 'afi' ? getInputClassName('amnioticFluid', 'afi', "bg-[#0b0f19] border border-slate-700 focus:border-cyan-400 text-cyan-300 font-bold w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]", item.value) : "bg-[#0b0f19] border border-slate-700 focus:border-cyan-400 text-cyan-300 font-bold w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]"}
                        />
                        <span className="text-[10px] text-slate-400 font-semibold w-8 text-left">
                          mm
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end w-full">
                        <input
                          type="number"
                          step="0.01"
                          value={item.value ?? ''}
                          onChange={(e) => updateAfi(key as any, 'value', e.target.value ? Number(e.target.value) : null)}
                          className="bg-[#0b0f19] border border-slate-700 text-slate-400 w-20 px-1.5 py-0.5 rounded text-right font-mono text-[11px]"
                        />
                        <span className="text-[10px] text-slate-500 font-semibold w-8 text-left">
                          mm
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-right text-slate-500">-</td>
                    <td className="p-2 text-right text-slate-500">-</td>
                    <td className="p-2 text-center text-slate-400 bg-slate-900/50 text-[10px]">last</td>
                    <td className="p-2 text-center text-slate-500">-</td>
                    <td className="p-2 text-slate-500">-</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer instructions */}
        <div className="text-[11px] text-slate-400 italic pt-1 font-sans">
          * Mọi thay đổi về tên chỉ số, giá trị và thông tin trên bảng biểu này sẽ được đồng bộ trực tiếp vào toàn bộ hệ thống báo cáo và form khám.
        </div>

      </div>

      {/* Stitched Image Preview Modal */}
      {showStitchedModal && stitchedInfo && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative bg-slate-900 border border-purple-800 rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="font-bold text-white font-sans text-sm">
                    Ảnh Báo Cáo Ghép Dọc ({stitchedInfo.pageCount || stitchedInfo.totalPages} Trang - {stitchedInfo.totalWidth || stitchedInfo.canvasWidth}x{stitchedInfo.totalHeight || stitchedInfo.canvasHeight}px)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Pipeline Image-First đã sắp xếp thứ tự trang và ghép toàn bộ thành một ảnh liên tục trước khi OCR.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStitchedModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-sans text-xs font-semibold"
              >
                Đóng
              </button>
            </div>

            {/* Page order badges */}
            <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-semibold">Thứ tự trang đã ghép:</span>
              {(stitchedInfo.pages || []).map((pg, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700 font-mono text-[11px]"
                >
                  Trang {pg.pageNumber} ({pg.originalIndex !== undefined ? pg.originalIndex + 1 : (pg.sourceIndex !== undefined ? pg.sourceIndex + 1 : idx + 1)}) - Y: {Math.round(pg.yStart ?? pg.yOffset ?? 0)}px
                </span>
              ))}
            </div>

            {/* Scrollable image container */}
            <div className="overflow-y-auto flex-1 bg-black rounded-xl p-2 border border-slate-800 flex justify-center">
              <img
                src={stitchedInfo.stitchedImageSrc || stitchedInfo.dataUrl}
                alt="Stitched Ultrasound Report"
                className="max-w-full h-auto rounded shadow-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white font-sans text-sm">Xem Chi Tiết Ảnh Màn Hình Siêu Âm</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-sans text-xs"
              >
                Đóng
              </button>
            </div>
            <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden max-h-[75vh]">
              <img src={previewImage} alt="Preview" className="max-h-[75vh] object-contain" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
