import { 
  UltrasoundReport, 
  OcrImageJob, 
  OcrJobStatus, 
  RawPage, 
  OcrCoverage 
} from '../types/ultrasound';
import { ocrSingleImage, extractReportFromMergedText } from './geminiClient';
import { runClientOfflineOcr, parseUltrasoundReportText } from './offlineOcrService';
import { parseDopplerCalculations } from './dopplerCalculationParser';
import { normalizeExtractedData } from '../utils/normalizeReportData';

export interface MultiImageOcrOptions {
  images: string[];
  fileNames?: string[];
  isOfflineMode?: boolean;
  maxRetries?: number;
  concurrency?: number;
  promptHint?: string;
  existingJobs?: OcrImageJob[];
  retryOnlyFailed?: boolean;
  onJobUpdate?: (updatedJob: OcrImageJob, allJobs: OcrImageJob[]) => void;
  onProgress?: (progressPercent: number, stepText: string) => void;
}

export interface MultiImageOcrResult {
  success: boolean;
  isComplete: boolean;
  jobs: OcrImageJob[];
  rawPages: RawPage[];
  mergedRawText: string;
  coverage: OcrCoverage;
  report?: UltrasoundReport;
  rawExtractedData?: any;
  error?: string;
}

// Medical section detector in raw text
export function detectSectionsInText(text: string): string[] {
  const sections: string[] = [];
  const lower = text.toLowerCase();

  // Patient
  if (/patient|name|họ\s*tên|bệnh\s*nhân|dob|exam\s*date|ngày\s*khám|id\s*:/i.test(lower)) {
    sections.push('patient');
  }

  // Dating & IVF
  if (/ivf|transfer|chuyển\s*phôi|lmp|doc|edd|ga\(|tuổi\s*thai/i.test(lower)) {
    sections.push('dating');
  }

  // EFW (Estimated Fetal Weight)
  if (/efw|hadlock|intergrowth|cân\s*nặng|est\.\s*fetal\s*weight/i.test(lower)) {
    sections.push('efw');
  }

  // 2D Biometry Measurements
  if (/bpd|hc|ac|fl|hl|tcd|cereb|cm|cisterna|vp|lateral\s*vent|nbl|nasal|bod|foot|daumong|crl|nt\b/i.test(lower)) {
    sections.push('measurements');
  }

  // 2D Calculations & Ratios
  if (/hc\/ac|fl\/ac|fl\/bpd|fl\/hc|ci\b|cpr|cepha/i.test(lower)) {
    sections.push('calculations');
  }

  // Fetal Heart Rate
  if (/fhr|heart\s*rate|nhịp\s*tim|ventricular\s*fhr/i.test(lower)) {
    sections.push('fhr');
  }

  // Umbilical Artery (UA)
  if (/umbilical|umb\s*art|đm\s*rốn|động\s*mạch\s*rốn|ua\s*pi|ua\s*ri/i.test(lower)) {
    sections.push('ua');
  }

  // Middle Cerebral Artery (MCA)
  if (/middle\s*cerebral|cerebri\s*media|mca|đm\s*não\s*giữa|não\s*giữa/i.test(lower)) {
    sections.push('mca');
  }

  // Uterine Arteries (Left / Right)
  if (/uterine|uterina|ut\s*art|uta|đm\s*tử\s*cung|tử\s*cung\s*trái|tử\s*cung\s*phải/i.test(lower)) {
    sections.push('uterine');
  }

  // Ductus Venosus (DV)
  if (/ductus\s*venosus|tĩnh\s*mạch|dv\s*pi|dv\s*pli|dv\s*pviv|a\/s|s\/a/i.test(lower)) {
    sections.push('dv');
  }

  // Amniotic Fluid (AFI / SDP)
  if (/amniotic|afi|sdp|deepest\s*pocket|nước\s*ối|khoang\s*ối/i.test(lower)) {
    sections.push('amnioticFluid');
  }

  // Cervix
  if (/cervix|cervical|cổ\s*tử\s*cung/i.test(lower)) {
    sections.push('cervix');
  }

  // Placenta
  if (/placenta|bánh\s*rau|vị\s*trí\s*rau/i.test(lower)) {
    sections.push('placenta');
  }

  return sections;
}

// Minimum signal check per requirement II: OCR success must not be confused with
// parser success. Merged text that is too short or has none of the standard
// ultrasound report markers is treated as an OCR failure, not a valid report.
const REPORT_SIGNAL_PATTERN = /name|pat\.?\s*id|date\s*of\s*exam|bpd|hc\b|ac\b|fl\b|efw|doppler|họ\s*tên|bệnh\s*nhân|ngày\s*khám/i;
const MIN_MERGED_TEXT_LENGTH = 20;

export function hasMinimumReportSignal(mergedText: string): boolean {
  const trimmed = (mergedText || '').trim();
  if (trimmed.length < MIN_MERGED_TEXT_LENGTH) return false;
  return REPORT_SIGNAL_PATTERN.test(trimmed);
}

// Regex to extract page number from OCR text
export function detectPageNumberFromText(text: string): { pageNumber: number | null; totalPages: number | null } {
  // Matches "Page 1 / 11", "Page 2/11", "Trang 1 / 4", "1 of 4", "Page 1 of 11"
  const patterns = [
    /(?:Page|Trang)\s*[:\s]*(\d+)\s*(?:[\/|\\]|\bof\b)\s*(\d+)/i,
    /(?:Page|Trang)\s*[:\s]*(\d+)/i,
    /\b(\d+)\s+of\s+(\d+)\b/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const pageNumber = parseInt(match[1], 10);
      const totalPages = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(pageNumber) && pageNumber > 0 && pageNumber < 100) {
        return { pageNumber, totalPages };
      }
    }
  }

  return { pageNumber: null, totalPages: null };
}

/**
 * Executes a single image OCR job with retry handling and timeout
 */
async function processSingleJob(
  job: OcrImageJob,
  isOfflineMode: boolean,
  maxRetries: number,
  onJobUpdate?: (updated: OcrImageJob) => void
): Promise<OcrImageJob> {
  let updatedJob: OcrImageJob = { ...job };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    updatedJob.status = attempt === 0 ? 'processing' : 'retrying';
    updatedJob.retryCount = attempt;
    if (onJobUpdate) onJobUpdate(updatedJob);

    try {
      if (!isOfflineMode) {
        // Online AI Single Image Vision OCR
        const ocrRes = await ocrSingleImage(
          updatedJob.imageSrc,
          updatedJob.imageIndex,
          updatedJob.fileName,
          30000 // 30s timeout per image
        );

        if (ocrRes.success && ocrRes.text && ocrRes.text.trim().length > 0) {
          const pageInfo = ocrRes.pageNumber 
            ? { pageNumber: ocrRes.pageNumber, totalPages: ocrRes.totalPages || null }
            : detectPageNumberFromText(ocrRes.text);

          const sections = ocrRes.detectedSections && ocrRes.detectedSections.length > 0
            ? ocrRes.detectedSections
            : detectSectionsInText(ocrRes.text);

          updatedJob = {
            ...updatedJob,
            status: 'success',
            text: ocrRes.text,
            pageNumber: pageInfo.pageNumber,
            totalPages: pageInfo.totalPages,
            detectedSections: sections,
            confidence: 0.95,
            durationMs: Date.now() - startTime,
            error: undefined,
          };
          if (onJobUpdate) onJobUpdate(updatedJob);
          return updatedJob;
        } else {
          throw new Error(ocrRes.error || `OCR ảnh ${updatedJob.imageIndex + 1} không thành công`);
        }
      } else {
        // Client-side Offline OCR (Tesseract.js)
        const ocrRes = await runClientOfflineOcr(updatedJob.imageSrc);
        if (ocrRes && ocrRes.rawText && ocrRes.rawText.trim().length > 0) {
          const pageInfo = detectPageNumberFromText(ocrRes.rawText);
          const sections = detectSectionsInText(ocrRes.rawText);

          updatedJob = {
            ...updatedJob,
            status: 'success',
            text: ocrRes.rawText,
            pageNumber: pageInfo.pageNumber,
            totalPages: pageInfo.totalPages,
            detectedSections: sections,
            confidence: 0.85,
            durationMs: Date.now() - startTime,
            error: undefined,
          };
          if (onJobUpdate) onJobUpdate(updatedJob);
          return updatedJob;
        } else {
          throw new Error(`Offline OCR không đọc được chữ từ ảnh ${updatedJob.imageIndex + 1}`);
        }
      }
    } catch (err: any) {
      const isLastAttempt = attempt >= maxRetries;
      updatedJob.error = err?.message || 'Lỗi đọc ảnh';
      updatedJob.durationMs = Date.now() - startTime;

      if (isLastAttempt) {
        updatedJob.status = 'failed';
        if (onJobUpdate) onJobUpdate(updatedJob);
        return updatedJob;
      } else {
        // Wait briefly before retrying
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  updatedJob.status = 'failed';
  if (onJobUpdate) onJobUpdate(updatedJob);
  return updatedJob;
}

/**
 * Main Multi-Image OCR Pipeline:
 * 1. Creates/tracks per-image OCR jobs.
 * 2. Runs OCR on each image independently.
 * 3. Handles automatic retry per failed image.
 * 4. Detects page numbers and sorts by pageNumber (or imageIndex fallback).
 * 5. Builds merged rawText with standard delimiters (`=== PAGE X ===`).
 * 6. Calculates OCR coverage & missing page detection.
 * 7. Extracts complete structured report from merged text without partial overwriting.
 */
export async function runMultiImageOcrPipeline(
  options: MultiImageOcrOptions,
  currentReport?: UltrasoundReport
): Promise<MultiImageOcrResult> {
  const {
    images,
    fileNames = [],
    isOfflineMode = false,
    maxRetries = 2,
    concurrency = 2,
    promptHint = '',
    existingJobs = [],
    retryOnlyFailed = false,
    onJobUpdate,
    onProgress,
  } = options;

  if (!images || images.length === 0) {
    return {
      success: false,
      isComplete: false,
      jobs: [],
      rawPages: [],
      mergedRawText: '',
      coverage: {
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0,
        totalPagesDetected: 0,
        pagesMissing: [],
        sectionsDetected: [],
        isComplete: false,
        warnings: ['Không có ảnh nào được tải lên.'],
      },
      error: 'Vui lòng tải lên ít nhất 1 ảnh siêu âm.',
    };
  }

  // Initialize or synchronize jobs
  let jobs: OcrImageJob[] = images.map((src, index) => {
    const existing = existingJobs.find((j) => j.imageIndex === index && j.imageSrc === src);
    if (existing && retryOnlyFailed) {
      if (existing.status === 'success') {
        return existing; // Keep passed job
      }
      // Reset failed/pending job for retry
      return {
        ...existing,
        status: 'pending' as OcrJobStatus,
        error: undefined,
        retryCount: 0,
      };
    }
    return {
      id: `ocr_job_${index}_${Date.now()}`,
      imageIndex: index,
      fileName: fileNames[index] || `Ảnh ${index + 1}`,
      imageSrc: src,
      pageNumber: null,
      totalPages: null,
      status: 'pending' as OcrJobStatus,
      text: '',
      retryCount: 0,
      detectedSections: [],
    };
  });

  const notifyJobUpdate = (updated: OcrImageJob) => {
    jobs = jobs.map((j) => (j.imageIndex === updated.imageIndex ? updated : j));
    if (onJobUpdate) {
      onJobUpdate(updated, [...jobs]);
    }
  };

  if (onProgress) {
    onProgress(10, `Khởi tạo tiến trình OCR cho ${images.length} ảnh...`);
  }

  // Jobs that need execution
  const pendingJobs = jobs.filter((j) => j.status !== 'success');

  // Execute jobs with controlled concurrency
  for (let i = 0; i < pendingJobs.length; i += concurrency) {
    const batch = pendingJobs.slice(i, i + concurrency);
    const batchPromises = batch.map((job) =>
      processSingleJob(job, isOfflineMode, maxRetries, (updated) => {
        notifyJobUpdate(updated);
      })
    );

    const completedBatch = await Promise.all(batchPromises);
    completedBatch.forEach((resJob) => {
      notifyJobUpdate(resJob);
    });

    const overallDone = jobs.filter((j) => j.status === 'success' || j.status === 'failed').length;
    const progressPercent = Math.min(85, 15 + Math.round((overallDone / images.length) * 65));
    if (onProgress) {
      onProgress(
        progressPercent,
        `Đã hoàn tất OCR ${overallDone}/${images.length} ảnh (${jobs.filter((j) => j.status === 'success').length} thành công)...`
      );
    }
  }

  // Check completeness
  const successfulJobs = jobs.filter((j) => j.status === 'success');
  const failedJobs = jobs.filter((j) => j.status === 'failed');
  const isAllSuccessful = successfulJobs.length === images.length;

  // Sorting pages by pageNumber (if detected), otherwise fallback to imageIndex
  const sortedSuccessfulJobs = [...successfulJobs].sort((a, b) => {
    if (a.pageNumber !== null && b.pageNumber !== null) {
      return a.pageNumber - b.pageNumber;
    }
    if (a.pageNumber !== null) return -1;
    if (b.pageNumber !== null) return 1;
    return a.imageIndex - b.imageIndex;
  });

  // Assemble rawPages
  const rawPages: RawPage[] = sortedSuccessfulJobs.map((j, idx) => ({
    pageNumber: j.pageNumber ?? (idx + 1),
    imageIndex: j.imageIndex,
    fileName: j.fileName,
    text: j.text,
    characterCount: j.text.length,
    detectedSections: j.detectedSections,
  }));

  // Build merged raw text with distinct page delimiters
  const mergedRawText = sortedSuccessfulJobs
    .map((j, idx) => {
      const pNum = j.pageNumber ?? (idx + 1);
      return `=== PAGE ${pNum} ===\n${j.text.trim()}`;
    })
    .join('\n\n');

  // Detect missing pages if pageNumbers were recognized
  const detectedPageNums = sortedSuccessfulJobs
    .map((j) => j.pageNumber)
    .filter((p): p is number => typeof p === 'number')
    .sort((a, b) => a - b);

  const pagesMissing: number[] = [];
  if (detectedPageNums.length > 1) {
    const minPage = detectedPageNums[0];
    const maxPage = detectedPageNums[detectedPageNums.length - 1];
    for (let p = minPage; p <= maxPage; p++) {
      if (!detectedPageNums.includes(p)) {
        pagesMissing.push(p);
      }
    }
  }

  // Collect all unique detected sections across all pages
  const allDetectedSections = Array.from(
    new Set(sortedSuccessfulJobs.flatMap((j) => j.detectedSections))
  );

  // Warnings
  const warnings: string[] = [];
  if (failedJobs.length > 0) {
    warnings.push(`OCR thất bại ${failedJobs.length}/${images.length} ảnh (${failedJobs.map((f) => f.fileName).join(', ')}).`);
  }
  if (pagesMissing.length > 0) {
    warnings.push(`Phát hiện thiếu trang ${pagesMissing.join(', ')} trong báo cáo.`);
  }

  // Key clinical sections check
  const expectedKeySections = [
    { key: 'patient', name: 'Thông tin bệnh nhân' },
    { key: 'dating', name: 'Tuổi thai & Dự sinh' },
    { key: 'measurements', name: 'Chỉ số sinh trắc học 2D' },
    { key: 'efw', name: 'Cân nặng EFW' },
    { key: 'fhr', name: 'Nhịp tim thai (FHR)' },
    { key: 'ua', name: 'Động mạch rốn (UA)' },
  ];

  expectedKeySections.forEach(({ key, name }) => {
    if (!allDetectedSections.includes(key)) {
      warnings.push(`Chưa tìm thấy phần "${name}" trong các ảnh đã OCR.`);
    }
  });

  const coverage: OcrCoverage = {
    totalImages: images.length,
    successfulImages: successfulJobs.length,
    failedImages: failedJobs.length,
    totalPagesDetected: detectedPageNums.length,
    pagesMissing,
    sectionsDetected: allDetectedSections,
    isComplete: isAllSuccessful && pagesMissing.length === 0,
    warnings,
  };

  // Requirement II: OCR failure must never be reported as parser success.
  // successfulOcrPages === 0 (or text with no report signal) => hard failure, no extraction attempted.
  if (successfulJobs.length === 0 || !hasMinimumReportSignal(mergedRawText)) {
    if (onProgress) {
      onProgress(100, `OCR thất bại: không có trang nào đọc được dữ liệu báo cáo hợp lệ.`);
    }
    return {
      success: false,
      isComplete: false,
      jobs,
      rawPages,
      mergedRawText,
      coverage,
      error:
        successfulJobs.length === 0
          ? `OCR thất bại toàn bộ (0/${images.length} ảnh). Vui lòng thử lại.`
          : `OCR không nhận diện được nội dung báo cáo hợp lệ từ ${successfulJobs.length}/${images.length} ảnh đã đọc được.`,
    };
  }

  // Requirement I.A: if some (not all) images succeeded, we must NOT discard the
  // successful pages just because others failed. Proceed to extract/normalize
  // using whatever text was successfully OCR'd, and report the result as
  // partial (isComplete=false) rather than throwing everything away.
  if (onProgress) {
    onProgress(
      88,
      isAllSuccessful
        ? 'Đang trích xuất cấu trúc báo cáo từ toàn bộ các trang...'
        : `Đang trích xuất cấu trúc báo cáo từ ${successfulJobs.length}/${images.length} trang đã OCR thành công (một phần)...`
    );
  }

  let extractedStructuredData: any = {};

  try {
    if (!isOfflineMode) {
      // AI Full-Text Structured Extraction
      const aiExtractRes = await extractReportFromMergedText(mergedRawText, promptHint);
      if (aiExtractRes.success && aiExtractRes.data) {
        extractedStructuredData = aiExtractRes.data;
      } else {
        // Fallback to local regex medical parser on merged text
        extractedStructuredData = parseUltrasoundReportText(mergedRawText);
      }
    } else {
      // Offline local regex parser on merged text
      extractedStructuredData = parseUltrasoundReportText(mergedRawText);
    }
  } catch (extractErr: any) {
    console.warn('[MultiImageOcrPipeline] Structured extraction error, using regex fallback:', extractErr);
    extractedStructuredData = parseUltrasoundReportText(mergedRawText);
  }

  // Phase 5: Doppler Calculations (UA PI, MCA PI/PS/TAMX, CPR, Left/Right Ut PI,
  // DV PI/PLI/PVIV/S-a/a-S) is a specialized section that neither the AI JSON
  // extraction nor the offline regex parser (parseUltrasoundReportText, which
  // only extracts unrelated ratio `calculations` like HC/AC, FL/AC) populate.
  // Per architecture, it must land at the canonical `doppler.calculations`
  // (DopplerCalculationsGroup) — the same field PrintReportModal.tsx reads —
  // parsed once from the already-merged text so P1+P2+P3 pages are covered
  // regardless of which page the Doppler Calculations section is on.
  console.log('[DOPPLER CALCULATIONS]');
  console.log('PARSER START');
  const dopplerCalcs = parseDopplerCalculations(mergedRawText);
  const dopplerCalcFieldCount = Object.values(dopplerCalcs || {}).filter(
    (group) => group && typeof group === 'object' && Object.keys(group).length > 0
  ).length;
  if (dopplerCalcFieldCount > 0) {
    console.log('[DOPPLER CALCULATIONS]');
    console.log(`FOUND: ${dopplerCalcFieldCount} groups`);
    if (!extractedStructuredData.doppler) extractedStructuredData.doppler = {};
    extractedStructuredData.doppler.calculations = {
      ...(extractedStructuredData.doppler.calculations || {}),
      ...dopplerCalcs,
    };
    console.log('[DOPPLER CALCULATIONS]');
    console.log('TARGET: doppler.calculations');
    console.log('[DOPPLER CALCULATIONS]');
    console.log('ASSIGN: PASS');
  } else {
    console.log('[DOPPLER CALCULATIONS]');
    console.log('FOUND: 0');
  }

  // Normalize and merge field-by-field with current report
  const normalizedReport = normalizeExtractedData(
    extractedStructuredData,
    currentReport,
    images,
    isOfflineMode ? 'offline_ocr' : 'online_ai'
  );

  // Attach multi-image OCR metadata to report
  normalizedReport.rawPages = rawPages;
  normalizedReport.ocrCoverage = coverage;
  normalizedReport.ocrJobs = jobs;
  normalizedReport.rawTextDump = mergedRawText;

  if (onProgress) {
    onProgress(
      100,
      isAllSuccessful
        ? `Đã hoàn tất OCR và trích xuất thành công ${images.length}/${images.length} trang!`
        : `Đã trích xuất một phần: ${successfulJobs.length}/${images.length} trang (${failedJobs.length} trang lỗi, có thể "Retry failed images").`
    );
  }

  return {
    // success=true means "we have a usable report" — true both for full and
    // partial coverage, since partial data must still reach the form (I.A).
    success: true,
    isComplete: coverage.isComplete,
    jobs,
    rawPages,
    mergedRawText,
    coverage,
    report: normalizedReport,
    rawExtractedData: extractedStructuredData,
    error: isAllSuccessful
      ? undefined
      : `Đã OCR một phần (${successfulJobs.length}/${images.length} ảnh). Các trang lỗi: ${failedJobs.map((f) => f.fileName).join(', ')}. Bạn có thể "Retry failed images".`,
  };
}
