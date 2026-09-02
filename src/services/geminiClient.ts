import { UltrasoundReport } from '../types/ultrasound';

export interface StitchedImageOcrResponse {
  success: boolean;
  rawReportText?: string;
  pages?: { page: number; text: string }[];
  detectedSections?: string[];
  characterCount?: number;
  error?: string;
  fallbackAvailable?: boolean;
  status?: number;
}

export async function ocrStitchedReportImage(
  stitchedImageBase64: string,
  pageCount: number = 1,
  timeoutMs: number = 60000,
  width?: number,
  height?: number
): Promise<StitchedImageOcrResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/ocr-stitched-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stitchedImage: stitchedImageBase64,
        pageCount,
        width,
        height,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await res.json();
    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error || 'Lỗi OCR ảnh báo cáo siêu âm ghép dọc',
        fallbackAvailable: json.fallbackAvailable !== false,
        status: res.status,
      };
    }

    return {
      success: true,
      rawReportText: json.rawReportText,
      pages: json.pages || [],
      detectedSections: json.detectedSections || [],
      characterCount: json.characterCount || 0,
      status: res.status,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? `Quá thời gian OCR báo cáo ghép (${timeoutMs / 1000}s)` : (err?.message || 'Lỗi kết nối OCR'),
      fallbackAvailable: true,
      status: isTimeout ? 408 : 500,
    };
  }
}

export interface SingleImageOcrResponse {
  success: boolean;
  imageIndex?: number;
  fileName?: string;
  pageNumber?: number | null;
  totalPages?: number | null;
  text?: string;
  detectedSections?: string[];
  characterCount?: number;
  error?: string;
  fallbackAvailable?: boolean;
  status?: number;
}

export async function ocrSingleImage(
  imageBase64: string,
  imageIndex: number = 0,
  fileName?: string,
  timeoutMs: number = 30000,
  width?: number,
  height?: number
): Promise<SingleImageOcrResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/ocr-single-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
        imageIndex,
        fileName: fileName || `Image ${imageIndex + 1}`,
        width,
        height,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await res.json();
    if (!res.ok || json.error) {
      return {
        success: false,
        imageIndex,
        fileName,
        error: json.error || `Lỗi OCR ảnh trang ${imageIndex + 1}`,
        fallbackAvailable: json.fallbackAvailable !== false,
        status: res.status,
      };
    }

    return {
      success: true,
      imageIndex: json.imageIndex ?? imageIndex,
      fileName: json.fileName || fileName,
      pageNumber: json.pageNumber,
      totalPages: json.totalPages,
      text: json.text,
      detectedSections: json.detectedSections || [],
      characterCount: json.characterCount || 0,
      status: res.status,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      imageIndex,
      fileName,
      error: isTimeout ? `Quá thời gian OCR ảnh (${timeoutMs / 1000}s)` : (err?.message || 'Lỗi kết nối OCR'),
      fallbackAvailable: true,
      status: isTimeout ? 408 : 500,
    };
  }
}

export async function extractReportFromMergedText(
  mergedRawText: string,
  promptHint?: string,
  timeoutMs: number = 45000
): Promise<{ success: boolean; data?: any; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/extract-report-from-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mergedRawText,
        promptHint: promptHint || '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await res.json();
    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error || 'Lỗi trích xuất cấu trúc báo cáo từ text',
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? `Quá thời gian trích xuất cấu trúc (${timeoutMs / 1000}s)` : (err?.message || 'Lỗi kết nối trích xuất AI'),
    };
  }
}

export async function extractUltrasoundFromImages(
  imagesBase64: string[],
  promptHint?: string
): Promise<{ success: boolean; data?: any; error?: string; fallbackAvailable?: boolean }> {
  try {
    const res = await fetch('/api/extract-ultrasound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: imagesBase64,
        promptHint: promptHint || '',
      }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error || 'Lỗi xử lý hình ảnh',
        fallbackAvailable: json.fallbackAvailable !== false,
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Không thể kết nối đến máy chủ AI',
      fallbackAvailable: true,
    };
  }
}

export async function generateClinicalConclusion(reportData: Partial<UltrasoundReport>): Promise<string> {
  try {
    const res = await fetch('/api/generate-conclusion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportData }),
    });

    const json = await res.json();
    if (json.success && json.conclusion) {
      return json.conclusion;
    }
    return '';
  } catch (err) {
    console.error('Error generating conclusion:', err);
    return '';
  }
}
