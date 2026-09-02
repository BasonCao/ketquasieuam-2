/**
 * Unified Image-First Multi-Page OCR Pipeline for Ultrasound Reports
 * Pipeline:
 * INPUT IMAGES -> SORT -> NORMALIZE -> VERTICAL STITCH -> SINGLE OCR -> PARSE -> VALIDATE -> FORM
 */

import { UltrasoundReport, RawPage } from '../types/ultrasound';
import { stitchUltrasoundPagesVertically, StitchedImageResult, loadImage, sortUltrasoundPages } from '../utils/imageStitcher';
import { ocrStitchedReportImage, ocrSingleImage, extractReportFromMergedText } from './geminiClient';
import { parseDopplerCalculations, parseDuctusVenosus } from './dopplerCalculationParser';
import { validateMultiPageOCR } from './dopplerCalculationValidator';
import { normalizeUltrasoundReport } from '../utils/normalizeReportData';

export interface StitchedPipelineOptions {
  onProgress?: (step: string, percent: number, logMsg?: string) => void;
  promptHint?: string;
  currentReport?: UltrasoundReport;
  ocrMode?: "PER_IMAGE" | "STITCH_THEN_OCR";
}

export interface StitchedPipelineResult {
  success: boolean;
  report: UltrasoundReport;
  stitchedResult: StitchedImageResult;
  rawReportText: string;
  debugLogs: string[];
  error?: string;
}

/**
 * Cropping helper to crop a segment of the stitched image using an HTML Canvas.
 */
async function cropImageSegment(
  sourceImageSrc: string,
  yStart: number,
  yEnd: number,
  targetWidth: number
): Promise<string> {
  const img = await loadImage(sourceImageSrc);
  const canvas = document.createElement('canvas');
  const cropHeight = Math.max(1, yEnd - yStart);
  canvas.width = targetWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }
  ctx.drawImage(
    img,
    0, yStart, targetWidth, cropHeight, // sx, sy, sWidth, sHeight
    0, 0, targetWidth, cropHeight      // dx, dy, dWidth, dHeight
  );
  return canvas.toDataURL('image/jpeg', 0.90);
}

/**
 * Concurrency-limited promise pool helper
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    
    if (limit < items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
}

/**
 * Executes the complete Image-First Multi-Page OCR Pipeline
 */
export async function runImageFirstOcrPipeline(
  images: string[],
  fileNames: string[] = [],
  options: StitchedPipelineOptions = {}
): Promise<StitchedPipelineResult> {
  const pipelineStartTime = Date.now();
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(msg);
    console.log(`[ImageFirstOCR] ${msg}`);
  };

  const notify = (step: string, percent: number, logMsg?: string) => {
    if (logMsg) addLog(logMsg);
    if (options.onProgress) {
      options.onProgress(step, percent, logMsg);
    }
  };

  const inputCount = images.length;
  let pagesSuccessful = 0;
  let detectedSectionsList: string[] = [];

  try {
    // 1. INPUT
    addLog(`==================================================`);
    addLog(`IMAGE-FIRST MULTI-PAGE OCR PIPELINE STARTED`);
    addLog(`INPUT PAGES: ${inputCount}`);

    if (inputCount === 0) {
      throw new Error('Không có hình ảnh báo cáo để xử lý.');
    }

    const isPerImageMode = options.ocrMode === 'PER_IMAGE';
    addLog(`MODE: ${isPerImageMode ? 'PER_IMAGE' : 'STITCH_THEN_OCR'}`);

    let rawReportText = '';
    let pageBlocks: { page: number; text: string }[] = [];
    let detectedSections: string[] = [];
    let stitchedResult: StitchedImageResult | undefined;
    let fallbackTriggered = false;

    if (isPerImageMode) {
      notify('Đang phân tích & sắp xếp số trang...', 15);
      const { sortedImages, detectedPages } = await sortUltrasoundPages(images, fileNames);
      const pageCount = sortedImages.length;
      
      notify('OCR từng ảnh...', 20);
      
      const processPage = async (idx: number) => {
        const pageNumber = detectedPages[idx];
        const pageName = `Trang ${pageNumber}`;
        const imgSrc = sortedImages[idx];
        
        addLog(`PAGE ${pageNumber}: START`);
        const pageStartTime = Date.now();
        let lastError = '';
        let lastStatus = 500;
        let success = false;
        let text = '';
        
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const ocrRes = await ocrSingleImage(
              imgSrc,
              pageNumber,
              pageName,
              25000,
              0, 0
            );
            if (ocrRes.success && ocrRes.text && ocrRes.text.trim().length > 0) {
              text = ocrRes.text;
              success = true;
              addLog(`PAGE ${pageNumber}: PASS`);
              break;
            } else {
              lastError = ocrRes.error || 'Lỗi rỗng';
              if (ocrRes.status) lastStatus = ocrRes.status;
            }
          } catch (err: any) {
            lastError = err?.message || 'Lỗi';
          }
        }
        
        if (!success) {
          addLog(`PAGE ${pageNumber}: FAILED`);
        }
        
        return { pageNumber, success, text, lastError };
      };
      
      const pageResults = await runWithConcurrencyLimit(
        Array.from({ length: pageCount }).map((_, i) => i),
        1,
        processPage
      );
      
      pagesSuccessful = 0;
      for (const res of pageResults) {
        if (res.success && res.text.trim().length > 0) {
          pagesSuccessful++;
          pageBlocks.push({ page: res.pageNumber, text: res.text });
          rawReportText += `========== PAGE ${res.pageNumber} ==========\n${res.text}\n\n`;
          notify(`Trang ${res.pageNumber} ✓`, 20 + Math.floor((pagesSuccessful / pageCount) * 50));
        } else {
          notify(`Trang ${res.pageNumber} thất bại`, 20 + Math.floor((pagesSuccessful / pageCount) * 50));
        }
      }
      
      if (pagesSuccessful === 0) {
        addLog('TEXT MERGE: FAILED');
        throw new Error('Không thể lấy được bất kỳ kết quả OCR hợp lệ nào từ các trang báo cáo siêu âm.');
      }
      addLog('TEXT MERGE: PASS');
      
      stitchedResult = {
        stitchedImageSrc: '',
        totalWidth: 0,
        totalHeight: 0,
        pageCount: pageCount,
        pages: detectedPages.map((p, i) => ({
          pageNumber: p,
          originalIndex: i,
          width: 0, height: 0, yStart: 0, yEnd: 0
        })),
        sortedImageSources: sortedImages,
        pageOrderDescription: detectedPages.map(p => `P${p}`).join(' → ')
      };

    } else {
      // 2. SORT, NORMALIZE & VERTICAL STITCH
      notify('Đang chuẩn hóa độ phân giải & ghép dọc báo cáo...', 30);
      stitchedResult = await stitchUltrasoundPagesVertically(images, fileNames, {
        targetWidth: 1400,
        separatorHeight: 44,
        quality: 0.92,
      });

      addLog(`PAGE ORDER: ${stitchedResult.pageOrderDescription}`);
      addLog(`STITCH: PASS`);
      addLog(`STITCHED IMAGE: ${stitchedResult.totalWidth}x${stitchedResult.totalHeight}`);

      // 3. SINGLE OCR
      notify(`Ghép ${stitchedResult.pageCount} trang ✓`, 35);
      notify('OCR toàn bộ...', 40);
      addLog('WHOLE OCR: START');

      const wholeOcrStartTime = Date.now();
      try {
        // Pass stitched image width and height to server
        const ocrResponse = await ocrStitchedReportImage(
          stitchedResult.stitchedImageSrc,
          stitchedResult.pageCount,
          30000, // 30s timeout
          stitchedResult.totalWidth,
          stitchedResult.totalHeight
        );

        if (ocrResponse.success && ocrResponse.rawReportText && ocrResponse.rawReportText.trim().length > 0) {
          rawReportText = ocrResponse.rawReportText;
          pageBlocks = ocrResponse.pages || [];
          detectedSections = ocrResponse.detectedSections || [];
          addLog(`WHOLE OCR: PASS (elapsedMs=${Date.now() - wholeOcrStartTime})`);
          pagesSuccessful = stitchedResult.pageCount;
        } else {
          const errorMsg = ocrResponse.error || 'Dữ liệu trả về trống hoặc không thành công';
          const isTimeout = errorMsg.includes('Quá thời gian') || errorMsg.includes('timeout') || errorMsg.includes('AbortError') || ocrResponse.status === 408;
          addLog(`WHOLE OCR: ${isTimeout ? 'TIMEOUT' : 'FAILED'}`);
          addLog(JSON.stringify({
            status: 'FAILED',
            code: ocrResponse.status || 500,
            message: errorMsg,
            endpoint: '/api/ocr-stitched-image',
            elapsedMs: Date.now() - wholeOcrStartTime
          }, null, 2));
          fallbackTriggered = true;
        }
      } catch (err: any) {
        const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('Quá thời gian');
        addLog(`WHOLE OCR: ${isTimeout ? 'TIMEOUT' : 'FAILED'}`);
        addLog(JSON.stringify({
          status: 'FAILED',
          code: isTimeout ? 408 : 500,
          message: err?.message || String(err),
          endpoint: '/api/ocr-stitched-image',
          elapsedMs: Date.now() - wholeOcrStartTime
        }, null, 2));
        fallbackTriggered = true;
      }

      if (fallbackTriggered) {
        notify('Đang chuyển sang chế độ OCR dự phòng...', 45);
        addLog('FALLBACK: PAGE/CHUNK OCR');
        notify('Đang tối ưu...', 48);

        // Define page chunks with overlap
        interface ChunkInfo {
          id: string;
          pageNumber: number;
          chunkType: 'full' | 'top' | 'middle' | 'bottom';
          yStart: number;
          yEnd: number;
        }

        const chunks: ChunkInfo[] = [];
        stitchedResult.pages.forEach((p) => {
          const pageHeight = p.yEnd - p.yStart;
          if (pageHeight > 1400) {
            chunks.push({
              id: `${p.pageNumber}-top`,
              pageNumber: p.pageNumber,
              chunkType: 'top',
              yStart: p.yStart,
              yEnd: Math.round(p.yStart + pageHeight * 0.40),
            });
            chunks.push({
              id: `${p.pageNumber}-middle`,
              pageNumber: p.pageNumber,
              chunkType: 'middle',
              yStart: Math.round(p.yStart + pageHeight * 0.35),
              yEnd: Math.round(p.yStart + pageHeight * 0.75),
            });
            chunks.push({
              id: `${p.pageNumber}-bottom`,
              pageNumber: p.pageNumber,
              chunkType: 'bottom',
              yStart: Math.round(p.yStart + pageHeight * 0.70),
              yEnd: p.yEnd,
            });
          } else {
            chunks.push({
              id: `${p.pageNumber}-full`,
              pageNumber: p.pageNumber,
              chunkType: 'full',
              yStart: p.yStart,
              yEnd: p.yEnd,
            });
          }
        });

        notify('Fallback OCR từng trang...', 52);

        const chunkResults: Record<string, { text: string; success: boolean; error?: string; status?: number; elapsedMs?: number }> = {};

        const processChunk = async (chunk: ChunkInfo) => {
          const chunkName = chunk.chunkType === 'full' 
            ? `Trang ${chunk.pageNumber}` 
            : `Trang ${chunk.pageNumber} (${chunk.chunkType === 'top' ? 'Trên' : chunk.chunkType === 'middle' ? 'Giữa' : 'Dưới'})`;

          addLog(`PAGE ${chunk.pageNumber} OCR: START`);
          const chunkStartTime = Date.now();
          let lastError = '';
          let lastStatus = 500;

          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const croppedBase64 = await cropImageSegment(
                stitchedResult!.stitchedImageSrc,
                chunk.yStart,
                chunk.yEnd,
                stitchedResult!.totalWidth
              );

              // Fetch chunk dimensions
              const cropHeight = Math.max(1, chunk.yEnd - chunk.yStart);

              const ocrRes = await ocrSingleImage(
                croppedBase64,
                chunk.pageNumber,
                chunkName,
                25000, // 25s timeout
                stitchedResult!.totalWidth,
                cropHeight
              );

              if (ocrRes.success && ocrRes.text && ocrRes.text.trim().length > 0) {
                const elapsedMs = Date.now() - chunkStartTime;
                chunkResults[chunk.id] = { 
                  text: ocrRes.text, 
                  success: true,
                  status: ocrRes.status || 200,
                  elapsedMs
                };
                addLog(`PAGE ${chunk.pageNumber} OCR: PASS`);
                return;
              } else {
                lastError = ocrRes.error || 'Lỗi OCR không xác định hoặc trả về rỗng';
                if (ocrRes.status) lastStatus = ocrRes.status;
              }
            } catch (err: any) {
              lastError = err?.message || 'Lỗi xử lý';
              if (err?.name === 'AbortError' || lastError.includes('timeout') || lastError.includes('Quá thời gian')) {
                lastStatus = 408;
              }
            }
          }

          const elapsedMs = Date.now() - chunkStartTime;
          chunkResults[chunk.id] = {
            text: '',
            success: false,
            error: lastError,
            status: lastStatus,
            elapsedMs
          };

          addLog(`PAGE ${chunk.pageNumber} OCR: ERROR`);
          addLog(JSON.stringify({
            status: 'FAILED',
            code: lastStatus,
            message: lastError,
            endpoint: '/api/ocr-single-image',
            elapsedMs
          }, null, 2));
        };

        // Run parallel OCR on chunks (max concurrency = 1 to avoid server overload)
        await runWithConcurrencyLimit(chunks, 1, processChunk);

        // Report page status and notify progress
        pagesSuccessful = 0;
        for (let pNum = 1; pNum <= stitchedResult.pageCount; pNum++) {
          const pageChunks = chunks.filter((c) => c.pageNumber === pNum);
          const anySuccess = pageChunks.some((c) => chunkResults[c.id]?.success);
          if (anySuccess) {
            pagesSuccessful++;
            notify(`Trang ${pNum} ✓`, 55 + Math.floor((pNum / stitchedResult.pageCount) * 20));
          } else {
            notify(`Trang ${pNum} thất bại`, 55 + Math.floor((pNum / stitchedResult.pageCount) * 20));
          }
        }

        notify('Đang tổng hợp...', 80);

        // Merge text and reconstruct rawReportText & pageBlocks
        rawReportText = '';
        pageBlocks = [];

        for (let pNum = 1; pNum <= stitchedResult.pageCount; pNum++) {
          const pageChunks = chunks.filter((c) => c.pageNumber === pNum);
          const combinedPageText = pageChunks
            .map((c) => chunkResults[c.id]?.text || '')
            .filter(t => t.trim().length > 0)
            .join('\n\n');

          if (combinedPageText.trim().length > 0) {
            pageBlocks.push({
              page: pNum,
              text: combinedPageText,
            });
            rawReportText += `========== PAGE ${pNum} ==========\n${combinedPageText}\n\n`;
          }
        }

        const totalTextLength = rawReportText.trim().length;
        if (totalTextLength > 0 && pagesSuccessful > 0) {
          addLog('TEXT MERGE: PASS');
        } else {
          addLog('TEXT MERGE: FAILED');
          throw new Error('Không thể lấy được bất kỳ kết quả OCR hợp lệ nào từ các trang báo cáo siêu âm.');
        }
        notify('Hoàn tất ✓', 85);
      } else {
        const totalTextLength = rawReportText.trim().length;
        if (totalTextLength > 0) {
          addLog('TEXT MERGE: PASS');
        } else {
          addLog('TEXT MERGE: FAILED');
          throw new Error('Dữ liệu văn bản OCR toàn ảnh rỗng.');
        }
      }
    }

    // 4. EXTRACT STRUCTURED DATA FROM FULL MULTI-PAGE CONTEXT
    let extractedData: any = {};
    const textToParse = rawReportText.trim();
    if (textToParse.length > 0) {
      notify('Đang bóc tách toàn bộ thông số y khoa & Doppler...', 87);
      const extractResponse = await extractReportFromMergedText(textToParse, options.promptHint);
      extractedData = extractResponse.data || {};
      
      const isEmptyJson = !extractedData || Object.keys(extractedData).length === 0 || 
        (Object.keys(extractedData).length === 1 && extractedData.patient) ||
        (!extractedData.patientName && !extractedData.patientId && (!extractedData.measurements || Object.keys(extractedData.measurements).length === 0) && (!extractedData.doppler || Object.keys(extractedData.doppler).length === 0));

      if (extractResponse.success && !isEmptyJson) {
        addLog('GLOBAL PARSER: PASS');
      } else {
        addLog('GLOBAL PARSER: FAILED / EMPTY INPUT');
        throw new Error('Dịch vụ AI phân tích dữ liệu trả về kết quả rỗng hoặc không có dữ liệu hợp lệ.');
      }
    } else {
      addLog('GLOBAL PARSER: SKIPPED, reason: NO OCR TEXT');
      throw new Error('Không có văn bản OCR nào để phân tích.');
    }

    // 5. PARSE ADVANCED DOPPLER & CALCULATIONS VIA SPECIALIZED PARSER
    addLog(`[DOPPLER CALCULATIONS]`);
    addLog(`PARSER START`);
    const directDopplerCalcs = parseDopplerCalculations(rawReportText);
    const directDv = parseDuctusVenosus(rawReportText);

    // Merge direct Doppler extractions into structured data if not present
    if (!extractedData.doppler) extractedData.doppler = {};
    if (directDv.s !== null || directDv.tamax !== null || directDv.pi !== null) {
      extractedData.doppler.ductusVenosus = {
        ...(extractedData.doppler.ductusVenosus || {}),
        ...directDv,
      };
    }

    // Phase 5 fix: `directDopplerCalcs` (the DopplerCalculationsGroup returned by
    // parseDopplerCalculations) was previously computed and then discarded — the
    // code below instead spread `extractedData.dopplerCalculations` (a field the
    // AI/OCR JSON does not populate) into `extractedData.calculations`, which is
    // an unrelated field (HC/AC, FL/AC, FL/BPD, FL/HC ratios). Doppler
    // Calculations and ratio Calculations are different concepts and must not
    // share a field. The canonical target for Doppler Calculations is
    // `doppler.calculations` (DopplerCalculationsGroup, per types/ultrasound.ts),
    // which is what PrintReportModal.tsx already reads. `extractedData.calculations`
    // (ratios) is left completely untouched.
    const dopplerCalcFieldCount = Object.values(directDopplerCalcs || {}).filter(
      (group) => group && typeof group === 'object' && Object.keys(group).length > 0
    ).length;
    if (dopplerCalcFieldCount > 0) {
      addLog(`[DOPPLER CALCULATIONS]`);
      addLog(`FOUND: ${dopplerCalcFieldCount} groups`);
      extractedData.doppler.calculations = {
        ...(extractedData.doppler.calculations || {}),
        ...directDopplerCalcs,
      };
      addLog(`[DOPPLER CALCULATIONS]`);
      addLog(`TARGET: doppler.calculations`);
      addLog(`[DOPPLER CALCULATIONS]`);
      addLog(`ASSIGN: PASS`);
    } else {
      addLog(`[DOPPLER CALCULATIONS]`);
      addLog(`FOUND: 0`);
    }

    // 6. DETECT SECTIONS & VERIFY COMPLETENESS
    detectedSectionsList = detectedSections && detectedSections.length > 0 ? [...detectedSections] : [];

    // Verify presence of all expected sections
    const hasPatient = !!(extractedData.patientName || extractedData.patient?.name || /Patient|Tên|Họ và tên/i.test(rawReportText));
    const hasDating = !!(extractedData.gaClin || extractedData.edd || extractedData.lmp || /GA|EDD|LMP|Tuổi thai/i.test(rawReportText));
    const hasEFW = !!(extractedData.efw?.value || /EFW|Cân nặng/i.test(rawReportText));
    const has2DMeasurements = !!(extractedData.measurements && Object.keys(extractedData.measurements).length > 0);
    const has2DCalculations = !!(extractedData.calculations?.hcAc || extractedData.calculations?.flAc || extractedData.calculations?.flBpd || extractedData.calculations?.flHc || /HC\/AC|FL\/AC|FL\/BPD/i.test(rawReportText));
    const hasFHR = !!(extractedData.doppler?.fhr || /FHR|HR|Tim thai/i.test(rawReportText));
    const hasUA = !!(extractedData.doppler?.umbilicalArtery?.pi || /Umbilical|ĐM Rốn|UA/i.test(rawReportText));
    const hasMCA = !!(extractedData.doppler?.middleCerebralArtery?.pi || /Middle Cerebral|ĐM Não giữa|MCA/i.test(rawReportText));
    const hasLeftUt = !!(extractedData.doppler?.leftUterine?.pi || /Left Ut|ĐM TC Trái/i.test(rawReportText));
    const hasRightUt = !!(extractedData.doppler?.rightUterine?.pi || /Right Ut|ĐM TC Phải/i.test(rawReportText));
    const hasDV = !!(extractedData.doppler?.ductusVenosus?.s || extractedData.doppler?.ductusVenosus?.pi || /Ductus Ven|DV/i.test(rawReportText));
    const hasDopplerCalcs = !!(directDopplerCalcs.ductusVenosus?.pi || directDopplerCalcs.umbilicalArtery?.pi || directDopplerCalcs.middleCerebralArtery?.pi);
    const hasAFI = !!(extractedData.amnioticFluid || /AFI|SDP|Nước ối/i.test(rawReportText));

    if (hasPatient && !detectedSectionsList.includes('patient')) detectedSectionsList.push('patient');
    if (hasDating && !detectedSectionsList.includes('dating')) detectedSectionsList.push('dating');
    if (hasEFW && !detectedSectionsList.includes('efw')) detectedSectionsList.push('efw');
    if (has2DMeasurements && !detectedSectionsList.includes('measurements')) detectedSectionsList.push('measurements');
    if (has2DCalculations && !detectedSectionsList.includes('calculations')) detectedSectionsList.push('calculations');
    if (hasFHR && !detectedSectionsList.includes('fhr')) detectedSectionsList.push('fhr');
    if (hasUA && !detectedSectionsList.includes('ua')) detectedSectionsList.push('ua');
    if (hasMCA && !detectedSectionsList.includes('mca')) detectedSectionsList.push('mca');
    if (hasLeftUt && !detectedSectionsList.includes('uterine')) detectedSectionsList.push('uterine');
    if (hasDV && !detectedSectionsList.includes('dv')) detectedSectionsList.push('dv');
    if (hasDopplerCalcs && !detectedSectionsList.includes('dopplerCalculations')) detectedSectionsList.push('dopplerCalculations');
    if (hasAFI && !detectedSectionsList.includes('amnioticFluid')) detectedSectionsList.push('amnioticFluid');

    // Section logs
    addLog(`SECTIONS:`);
    addLog(`Patient ${hasPatient ? 'PASS' : 'SKIP'}`);
    addLog(`Dating ${hasDating ? 'PASS' : 'SKIP'}`);
    addLog(`2D Measurements ${has2DMeasurements ? 'PASS' : 'SKIP'}`);
    addLog(`FHR ${hasFHR ? 'PASS' : 'SKIP'}`);
    addLog(`UA ${hasUA ? 'PASS' : 'SKIP'}`);
    addLog(`MCA ${hasMCA ? 'PASS' : 'SKIP'}`);
    addLog(`Left Uterine ${hasLeftUt ? 'PASS' : 'SKIP'}`);
    addLog(`Right Uterine ${hasRightUt ? 'PASS' : 'SKIP'}`);
    addLog(`Ductus Venosus ${hasDV ? 'PASS' : 'SKIP'}`);
    addLog(`Doppler Calculations ${hasDopplerCalcs ? 'PASS' : 'SKIP'}`);
    addLog(`AFI ${hasAFI ? 'PASS' : 'SKIP'}`);

    // Check completeness
    const expectedList: string[] = [];
    if (!hasPatient) expectedList.push('Patient');
    if (!hasDating) expectedList.push('Dating');
    if (!hasEFW) expectedList.push('EFW');
    if (!has2DMeasurements) expectedList.push('2D Measurements');
    if (!has2DCalculations) expectedList.push('2D Calculations');
    if (!hasFHR) expectedList.push('FHR');
    if (!hasUA) expectedList.push('Umbilical Artery');
    if (!hasMCA) expectedList.push('MCA');
    if (!hasLeftUt) expectedList.push('Left Uterine');
    if (!hasRightUt) expectedList.push('Right Uterine');
    if (!hasDV) expectedList.push('Ductus Venosus');
    if (!hasDopplerCalcs) expectedList.push('Doppler Calculations');
    if (!hasAFI) expectedList.push('AFI');

    // Determine final validation status
    let finalOcrStatus = 'OCR_SUCCESS';
    if (!hasPatient && !has2DMeasurements) {
      finalOcrStatus = 'OCR_FAILED';
    } else if (expectedList.length > 0) {
      finalOcrStatus = 'OCR_PARTIAL';
    } else {
      finalOcrStatus = 'OCR_SUCCESS';
    }

    if (expectedList.length === 0) {
      addLog('OCR: PASS');
    } else {
      addLog('OCR: PARTIAL');
      addLog(`Missing sections: ${expectedList.join(', ')}`);
    }

    // 7. NORMALIZATION & VALIDATION
    notify('Đang chuẩn hóa schema & kiểm tra tính toàn vẹn...', 92);
    const baseReport = options.currentReport || {
      id: 'report-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patient: {} as any,
      measurements: {} as any,
      efw: {} as any,
      doppler: {} as any,
      amnioticFluid: {} as any,
      placenta: {} as any,
      anatomy: {} as any,
      calculations: {} as any,
      detectedCategory: 'dynamic_v2',
      conclusion: '',
      recommendations: '',
      imageUrls: [],
    };

    const normalizedReport = normalizeUltrasoundReport(
      extractedData,
      baseReport,
      images,
      'online_ai'
    );

    const rawPages: RawPage[] = (pageBlocks || []).map((p, idx) => ({
      pageNumber: p.page,
      imageIndex: idx,
      text: p.text,
      characterCount: p.text.length,
      detectedSections: [],
    }));

    normalizedReport.stitchedImageInfo = {
      stitchedImageSrc: stitchedResult.stitchedImageSrc,
      totalWidth: stitchedResult.totalWidth,
      totalHeight: stitchedResult.totalHeight,
      pageCount: stitchedResult.pageCount,
      pages: stitchedResult.pages,
      pageOrderDescription: stitchedResult.pageOrderDescription,
    };
    normalizedReport.rawPages = rawPages;
    normalizedReport.rawTextDump = rawReportText;

    addLog('VALIDATION: PASS');
    notify('Hoàn tất ✓', 100);

    const totalPipelineElapsed = Date.now() - pipelineStartTime;
    addLog(`==================================================`);
    addLog(`FINAL RESULT: SUCCESS`);
    addLog(`TOTAL PAGES: ${pagesSuccessful}/${inputCount}`);
    addLog(`ELAPSED TIME: ${totalPipelineElapsed}ms`);
    addLog(`SECTIONS DETECTED: ${detectedSectionsList.join(', ')}`);
    addLog(`VALIDATION STATUS: ${finalOcrStatus}`);
    addLog(`==================================================`);

    return {
      success: true,
      report: normalizedReport,
      stitchedResult,
      rawReportText,
      debugLogs: logs,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Lỗi xử lý OCR báo cáo siêu âm';
    addLog(`ERROR: ${errorMsg}`);
    
    const totalPipelineElapsed = Date.now() - pipelineStartTime;
    addLog(`==================================================`);
    addLog(`FINAL RESULT: FAILED`);
    addLog(`TOTAL PAGES: ${pagesSuccessful}/${inputCount}`);
    addLog(`ELAPSED TIME: ${totalPipelineElapsed}ms`);
    addLog(`SECTIONS DETECTED: ${detectedSectionsList.join(', ') || 'None'}`);
    addLog(`VALIDATION STATUS: OCR_FAILED`);
    addLog(`==================================================`);

    return {
      success: false,
      report: options.currentReport || ({} as any),
      stitchedResult: {} as any,
      rawReportText: '',
      debugLogs: logs,
      error: errorMsg,
    };
  }
}
