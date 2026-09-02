import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PatientInfo } from '../types/ultrasound';
import { savePdfToPatientPcFolder, getReportFileNameByGestationalAge } from './pcStorageService';

export interface ExportPdfOptions {
  fileName?: string;
  patient?: PatientInfo;
  patientName?: string;
  examDate?: string;
  gaAge?: string;
  categoryName?: string;
  pcRootDirectoryHandle?: FileSystemDirectoryHandle | null;
  onProgress?: (status: string) => void;
}

export interface ExportPdfResult {
  success: boolean;
  savedToPc: boolean;
  patientFolder?: string;
  gaFolder?: string;
  fileName: string;
  fullPathHint?: string;
  error?: string;
}

/**
 * Cleanly exports a DOM element (the ultrasound medical report sheet) to a PDF file.
 * Automatically saves into patient's phone folder on PC if directory handle is provided,
 * or downloads directly via browser.
 */
export async function exportReportToPdf(
  element: HTMLElement,
  options: ExportPdfOptions = {}
): Promise<ExportPdfResult> {
  try {
    const patientObj = options.patient || {
      name: options.patientName || 'BenhNhan',
      examDate: options.examDate || new Date().toLocaleDateString('vi-VN'),
      gaClin: options.gaAge || '',
      phone: '',
      patientId: '',
      yearOfBirth: '',
      age: '',
      address: '',
      gender: 'Nữ',
      clinicHeader: '',
      sonographer: '',
      indication: '',
      lmp: '',
      doc: '',
      gaAua: '',
      edd: '',
      gravida: '',
      para: '',
      abortion: '',
      ectopic: '',
    };

    const rawId = (patientObj.patientId || patientObj.phone || 'BN').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawDate = (patientObj.examDate || new Date().toLocaleDateString('vi-VN')).trim().replace(/[\/]/g, '.');
    const sonoReportFileName = `SONO_REPORT_${rawId}_${rawDate}.pdf`;

    const finalFileName = options.fileName || sonoReportFileName;

    if (options.onProgress) options.onProgress('Đang chuẩn bị trang in chất lượng cao...');

    // 1. Pre-flight boundary check: Ensure the report element exists and is rendered
    const rectBefore = element.getBoundingClientRect();
    console.log("EXPORT START, text length:", element.textContent?.length || 0, "size:", rectBefore.width, "x", rectBefore.height);

    if (rectBefore.width <= 0 || rectBefore.height <= 0) {
      const errorMsg = "Không tìm thấy nội dung report để xuất PDF.";
      alert(errorMsg);
      return {
        success: false,
        savedToPc: false,
        fileName: finalFileName,
        error: errorMsg
      };
    }

    // 2. Map all nodes in the element with unique IDs to prevent html2canvas clone index misalignment
    const originalNodes = [element, ...Array.from(element.querySelectorAll('*'))] as HTMLElement[];
    originalNodes.forEach((node, idx) => {
      node.setAttribute('data-export-id', idx.toString());
    });

    // 3. Save current inline style properties to restore them perfectly post-render
    const originalStyle: { [key: string]: string } = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      minWidth: element.style.minWidth,
      height: element.style.height,
      minHeight: element.style.minHeight,
      transform: element.style.transform,
      zoom: element.style.zoom,
      position: element.style.position,
      margin: element.style.margin,
      padding: element.style.padding,
      borderRadius: element.style.borderRadius,
      boxShadow: element.style.boxShadow,
      display: element.style.display,
      visibility: element.style.visibility,
      opacity: element.style.opacity,
    };

    let canvas: HTMLCanvasElement;

    try {
      // 4. Temporarily force standard A4 desktop dimensions directly on the live element
      // This ensures html2canvas parses the DOM in full A4 landscape/portrait context,
      // completely independent of mobile viewport dimensions.
      element.style.setProperty('width', '210mm', 'important');
      element.style.setProperty('maxWidth', '210mm', 'important');
      element.style.setProperty('minWidth', '210mm', 'important');
      element.style.setProperty('height', 'auto', 'important');
      element.style.setProperty('transform', 'none', 'important');
      element.style.setProperty('zoom', '1', 'important');
      element.style.setProperty('position', 'relative', 'important');
      element.style.setProperty('margin', '0 auto', 'important');
      element.style.setProperty('padding', '24px', 'important');
      element.style.setProperty('borderRadius', '0px', 'important');
      element.style.setProperty('boxShadow', 'none', 'important');
      element.style.setProperty('display', 'block', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
      element.style.setProperty('opacity', '1', 'important');

      // 5. Wait for React render loops and styles to settle at the new dimensions
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      }));

      await document.fonts.ready;

      const images = Array.from(element.querySelectorAll("img"));
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      // 6. Invoke html2canvas directly on the resized live element
      canvas = await html2canvas(element, {
        scale: 2.2, // 2.2x scale for sharp, high-DPI lines and crisp text
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
          try {
            // Create a dummy canvas context to resolve modern color spaces like oklch/color-mix
            const dummyCanvas = clonedDoc.createElement('canvas');
            const canvasCtx = dummyCanvas.getContext('2d');

            const sanitizeColorString = (str: string): string => {
              if (!str || !/(oklch|oklab|color-mix|light-dark|lab|lch|hwb|color)/i.test(str)) {
                return str;
              }
              return str.replace(/(oklch|oklab|color-mix|light-dark|lab|lch|hwb|color)\s*\((?:[^\(\)]+|\([^\(\)]*\))*\)/gi, (match) => {
                if (canvasCtx) {
                  try {
                    canvasCtx.fillStyle = '#00000000';
                    canvasCtx.fillStyle = match;
                    const converted = canvasCtx.fillStyle;
                    if (converted && converted !== '#00000000' && !/(oklch|oklab|color-mix|light-dark|lab|lch|hwb|color)/i.test(converted)) {
                      return converted;
                    }
                  } catch {}
                }
                return 'transparent';
              });
            };

            // Inline the computed styles of live original nodes onto sandboxed cloned nodes using data-export-id
            const propsToInline = [
              'color',
              'background-color',
              'border-top-color',
              'border-right-color',
              'border-bottom-color',
              'border-left-color',
              'outline-color',
              'text-decoration-color',
              'fill',
              'stroke',
              'box-shadow',
              'font-family',
              'font-size',
              'font-weight',
              'font-style',
              'line-height',
              'letter-spacing',
              'text-align',
              'padding-top',
              'padding-right',
              'padding-bottom',
              'padding-left',
              'margin-top',
              'margin-right',
              'margin-bottom',
              'margin-left',
              'width',
              'height',
              'min-width',
              'max-width',
              'min-height',
              'max-height',
              'display',
              'flex-direction',
              'flex-wrap',
              'justify-content',
              'align-items',
              'grid-template-columns',
              'gap',
              'border-top-width',
              'border-right-width',
              'border-bottom-width',
              'border-left-width',
              'border-top-style',
              'border-right-style',
              'border-bottom-style',
              'border-left-style',
              'border-top-left-radius',
              'border-top-right-radius',
              'border-bottom-left-radius',
              'border-bottom-right-radius',
              'opacity',
              'visibility',
              'overflow'
            ];

            const clonedNodesWithId = clonedElement.querySelectorAll('[data-export-id]');
            clonedNodesWithId.forEach((clonedNode) => {
              const htmlClone = clonedNode as HTMLElement;
              const exportId = htmlClone.getAttribute('data-export-id');
              if (!exportId) return;

              const origNode = originalNodes[parseInt(exportId, 10)];
              if (!origNode) return;

              try {
                const computed = window.getComputedStyle(origNode);
                for (const prop of propsToInline) {
                  const val = computed.getPropertyValue(prop);
                  if (val) {
                    const sanitizedVal = sanitizeColorString(val);
                    htmlClone.style.setProperty(prop, sanitizedVal);
                  }
                }
              } catch {}
            });

            // Prevent CORS style fetching inside the html2canvas sandbox iframe
            const linkTags = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
            for (const link of linkTags) {
              link.remove();
            }

            // Sanitize styles
            const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
            for (const styleTag of styleTags) {
              if (styleTag.textContent) {
                styleTag.textContent = sanitizeColorString(styleTag.textContent);
              }
            }

            // Sanitize all inline styles in the cloned document
            const allClonedElements = Array.from(clonedElement.querySelectorAll('*')) as HTMLElement[];
            for (const htmlEl of allClonedElements) {
              if (htmlEl.style && htmlEl.style.cssText) {
                htmlEl.style.cssText = sanitizeColorString(htmlEl.style.cssText);
              }
            }
          } catch (e) {
            console.warn('HTML2Canvas clone sanitize notice:', e);
          }
        },
      });
    } finally {
      // 7. Strip the temporary custom data-export-id attribute from live elements
      originalNodes.forEach((node) => {
        node.removeAttribute('data-export-id');
      });

      // 8. Restore the original inline styling of the live element instantly
      Object.entries(originalStyle).forEach(([key, val]) => {
        element.style[key as any] = val;
      });
    }

    if (options.onProgress) options.onProgress('Đang tạo file PDF chuẩn A4...');

    // 9. Post-flight validation of the generated Canvas
    console.log("CANVAS:", {
      width: canvas?.width || 0,
      height: canvas?.height || 0
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      const errorMsg = "PDF renderer không nhận được nội dung report.";
      alert(errorMsg);
      return {
        success: false,
        savedToPc: false,
        fileName: finalFileName,
        error: errorMsg
      };
    }

    console.log("PDF EXPORT COMPLETE");

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeightMm = (imgProps.height * pdfWidth) / imgProps.width;

    if (imgHeightMm <= pageHeight + 2) {
      // Single page fits cleanly on A4
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeightMm, undefined, 'FAST');
    } else {
      // Multi-page handling with clean margin split
      let heightLeft = imgHeightMm;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightMm, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position = -(imgHeightMm - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightMm, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
    }

    // Check if PC Root Directory Handle is available
    if (options.pcRootDirectoryHandle) {
      if (options.onProgress) options.onProgress('Đang lưu vào thư mục SĐT bệnh nhân trên PC...');
      const pdfBlob = pdf.output('blob');

      const pcResult = await savePdfToPatientPcFolder(
        options.pcRootDirectoryHandle,
        patientObj,
        pdfBlob,
        {
          customGa: options.gaAge,
          customCategory: options.categoryName,
          onProgress: options.onProgress,
        }
      );

      if (pcResult.success) {
        return {
          success: true,
          savedToPc: true,
          patientFolder: pcResult.patientFolder,
          fileName: pcResult.fileName,
          fullPathHint: pcResult.fullPathHint,
        };
      } else {
        console.warn('Could not write directly to PC folder, fallback to browser download:', pcResult.error);
      }
    }

    // Fallback: direct browser download
    if (options.onProgress) options.onProgress('Đang tải file PDF về máy...');
    pdf.save(finalFileName);

    return {
      success: true,
      savedToPc: false,
      fileName: finalFileName,
    };
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return {
      success: false,
      savedToPc: false,
      fileName: options.fileName || 'report.pdf',
      error: error.message || 'Lỗi tạo PDF',
    };
  }
}
