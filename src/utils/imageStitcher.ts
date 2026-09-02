/**
 * Image-First Multi-Page Stitcher & Page Sorter for Ultrasound Reports
 * Pipeline: INPUT IMAGES -> SORT BY PAGE -> NORMALIZE WIDTH -> VERTICAL STITCH -> UNIFIED IMAGE
 */

export interface PageMetadata {
  pageNumber: number;
  totalPages?: number | null;
  originalIndex: number;
  fileName?: string;
  width: number;
  height: number;
  yStart: number;
  yEnd: number;
}

export interface StitchedImageResult {
  stitchedImageSrc: string; // Base64 data URL
  totalWidth: number;
  totalHeight: number;
  pageCount: number;
  pages: PageMetadata[];
  sortedImageSources: string[];
  pageOrderDescription: string;
}

/**
 * Loads an image from a data URL or path and returns HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Không thể tải hình ảnh để ghép: ' + err));
    img.src = src;
  });
}

/**
 * Attempts to detect page number from image top header or filename
 */
export function detectPageNumberFromMetadata(
  imageSrc: string,
  fileName?: string,
  index: number = 0
): { pageNumber: number; totalPages: number | null } {
  // 1. Try filename regex: e.g. "page_1.png", "page-02.jpg", "trang3.png", "01_report.jpg"
  if (fileName) {
    const match = fileName.match(/(?:page|trang|p|img|image)[_\-\s]*0*(\d+)/i) ||
                  fileName.match(/\b0*(\d+)(?:\s*(?:of|\/)\s*0*(\d+))?\b/i);
    if (match) {
      const p = parseInt(match[1], 10);
      const total = match[2] ? parseInt(match[2], 10) : null;
      if (p > 0 && p < 100) {
        return { pageNumber: p, totalPages: total };
      }
    }
  }

  // Fallback to sequential 1-indexed order based on upload
  return { pageNumber: index + 1, totalPages: null };
}

/**
 * Sorts images based on detected page number, preserving order for ties
 */
export async function sortUltrasoundPages(
  images: string[],
  fileNames: string[] = []
): Promise<{ sortedImages: string[]; sortedFileNames: string[]; detectedPages: number[] }> {
  const items = images.map((img, idx) => {
    const fn = fileNames[idx] || `Trang_${idx + 1}`;
    const detected = detectPageNumberFromMetadata(img, fn, idx);
    return {
      src: img,
      fileName: fn,
      originalIndex: idx,
      pageNumber: detected.pageNumber,
      totalPages: detected.totalPages,
    };
  });

  // Check if all page numbers are distinct or default
  const distinctPages = new Set(items.map(i => i.pageNumber));
  const hasDistinctOrdering = distinctPages.size === items.length && distinctPages.size > 1;

  if (hasDistinctOrdering) {
    items.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  return {
    sortedImages: items.map(i => i.src),
    sortedFileNames: items.map(i => i.fileName),
    detectedPages: items.map(i => i.pageNumber),
  };
}

/**
 * Normalizes widths and vertically stitches all report pages into ONE long image
 * with prominent non-destructive page separator banners
 */
export async function stitchUltrasoundPagesVertically(
  images: string[],
  fileNames: string[] = [],
  options: {
    targetWidth?: number;
    separatorHeight?: number;
    quality?: number;
  } = {}
): Promise<StitchedImageResult> {
  if (!images || images.length === 0) {
    throw new Error('Không có hình ảnh để ghép.');
  }

  // 1. Sort pages
  const { sortedImages, sortedFileNames, detectedPages } = await sortUltrasoundPages(images, fileNames);

  // 2. Load all images
  const loadedImages = await Promise.all(sortedImages.map(src => loadImage(src)));

  // Target width: default 1400px (high-res enough for small sub-script tables & measurements)
  const maxOriginalWidth = Math.max(...loadedImages.map(img => img.naturalWidth || img.width || 1200));
  const targetWidth = options.targetWidth || Math.min(Math.max(maxOriginalWidth, 1200), 1600);
  const separatorHeight = options.separatorHeight || 44; // px for page banner

  // 3. Compute normalized heights & Y offsets
  const pageMeta: PageMetadata[] = [];
  let currentY = 0;

  const normalizedHeights = loadedImages.map((img, idx) => {
    const origW = img.naturalWidth || img.width || 1200;
    const origH = img.naturalHeight || img.height || 1600;
    const scale = targetWidth / origW;
    const scaledHeight = Math.round(origH * scale);

    const pageNum = detectedPages[idx] || (idx + 1);
    const yStart = currentY + (idx > 0 ? separatorHeight : 0);
    const yEnd = yStart + scaledHeight;

    pageMeta.push({
      pageNumber: pageNum,
      originalIndex: idx,
      fileName: sortedFileNames[idx],
      width: targetWidth,
      height: scaledHeight,
      yStart,
      yEnd,
    });

    currentY = yEnd;
    return scaledHeight;
  });

  const totalHeight = currentY;

  // 4. Create master canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas 2D để ghép ảnh.');
  }

  // Fill background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, targetWidth, totalHeight);

  // 5. Draw each page & separator banner
  loadedImages.forEach((img, idx) => {
    const meta = pageMeta[idx];

    // Draw separator if page > 0 or even for page 1 for clear anchor
    if (idx > 0) {
      const sepY = meta.yStart - separatorHeight;
      // Draw banner background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, sepY, targetWidth, separatorHeight);

      // Draw accent border
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, sepY, targetWidth, 2);
      ctx.fillRect(0, sepY + separatorHeight - 2, targetWidth, 2);

      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `========== PAGE ${meta.pageNumber} (${meta.fileName || `Trang ${meta.pageNumber}`}) ==========`,
        targetWidth / 2,
        sepY + separatorHeight / 2
      );
    }

    // Draw page image with crisp smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, meta.yStart, targetWidth, meta.height);
  });

  // 6. Convert canvas to base64 JPEG
  const quality = options.quality || 0.92;
  const stitchedImageSrc = canvas.toDataURL('image/jpeg', quality);

  const pageOrderDescription = pageMeta.map(p => `P${p.pageNumber}`).join(' → ');

  return {
    stitchedImageSrc,
    totalWidth: targetWidth,
    totalHeight,
    pageCount: images.length,
    pages: pageMeta,
    sortedImageSources: sortedImages,
    pageOrderDescription,
  };
}
