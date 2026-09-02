/**
 * Doppler & Multi-Page OCR Validation Engine
 * Enforces physiological limits, anti-collision rules, and completeness scoring
 */

import { DopplerValues, DopplerCalculationsGroup, OcrCompleteness } from '../types/ultrasound';

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: OcrCompleteness;
}

/**
 * Validates Ductus Venosus values
 */
export function validateDuctusVenosus(dv?: DopplerValues['ductusVenosus']): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!dv) return { valid: true, warnings };

  if (dv.s !== null && dv.s !== undefined && (dv.s < 10 || dv.s > 150)) {
    warnings.push(`Ductus Venosus S wave (${dv.s} cm/s) nằm ngoài khoảng thông thường (15-120 cm/s)`);
  }
  if (dv.a !== null && dv.a !== undefined && (dv.a < 0 || dv.a > 80)) {
    warnings.push(`Ductus Venosus a wave (${dv.a} cm/s) bất thường hoặc đảo ngược`);
  }
  if (dv.pi !== null && dv.pi !== undefined && (dv.pi < 0.1 || dv.pi > 3.0)) {
    warnings.push(`Ductus Venosus PI (${dv.pi}) nằm ngoài khoảng sinh lý (0.2-2.5)`);
  }
  if (dv.hr !== null && dv.hr !== undefined && (dv.hr < 100 || dv.hr > 300)) {
    warnings.push(`Ductus Venosus HR (${dv.hr} bpm) cần kiểm tra lại`);
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Validates complete Doppler hemodynamic values
 */
export function validateDoppler(doppler: DopplerValues): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // FHR Check
  if (doppler.fhr.value !== null) {
    if (doppler.fhr.value < 80 || doppler.fhr.value > 220) {
      warnings.push(`Nhịp tim thai FHR (${doppler.fhr.value} bpm) nằm ngoài khoảng sinh lý`);
    }
  }

  // UA PI & RI
  if (doppler.umbilicalArtery.pi !== null && doppler.umbilicalArtery.pi !== undefined) {
    if (doppler.umbilicalArtery.pi < 0.3 || doppler.umbilicalArtery.pi > 4.5) {
      warnings.push(`UA PI (${doppler.umbilicalArtery.pi}) bất thường`);
    }
  }
  if (doppler.umbilicalArtery.ri !== null && doppler.umbilicalArtery.ri !== undefined) {
    if (doppler.umbilicalArtery.ri < 0.2 || doppler.umbilicalArtery.ri > 1.2) {
      warnings.push(`UA RI (${doppler.umbilicalArtery.ri}) bất thường`);
    }
  }

  // MCA PI & RI & PSV
  if (doppler.middleCerebralArtery.pi !== null && doppler.middleCerebralArtery.pi !== undefined) {
    if (doppler.middleCerebralArtery.pi < 0.5 || doppler.middleCerebralArtery.pi > 3.5) {
      warnings.push(`MCA PI (${doppler.middleCerebralArtery.pi}) bất thường`);
    }
  }
  if (doppler.middleCerebralArtery.psv !== null && doppler.middleCerebralArtery.psv !== undefined) {
    if (doppler.middleCerebralArtery.psv < 10 || doppler.middleCerebralArtery.psv > 150) {
      warnings.push(`MCA PSV (${doppler.middleCerebralArtery.psv} cm/s) cần kiểm tra lại`);
    }
  }

  // Ductus Venosus check
  if (doppler.ductusVenosus) {
    const dvVal = validateDuctusVenosus(doppler.ductusVenosus);
    warnings.push(...dvVal.warnings);
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Validates Doppler Calculations group
 */
export function validateDopplerCalculations(calc?: DopplerCalculationsGroup): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!calc) return { valid: true, warnings };

  if (calc.ductusVenosus?.pi?.value !== null && calc.ductusVenosus?.pi?.value !== undefined) {
    if (calc.ductusVenosus.pi.value < 0.1 || calc.ductusVenosus.pi.value > 2.5) {
      warnings.push(`DV PI Calculation (${calc.ductusVenosus.pi.value}) cần đối chiếu lâm sàng`);
    }
  }

  if (calc.middleCerebralArtery?.cpr?.value !== null && calc.middleCerebralArtery?.cpr?.value !== undefined) {
    if (calc.middleCerebralArtery.cpr.value < 0.5) {
      warnings.push(`Chỉ số não rốn CPR thấp (${calc.middleCerebralArtery.cpr.value}) - nguy cơ suy tuần hoàn nhau thai`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Assesses completeness across multi-page report OCR
 */
export function validateMultiPageOCR(
  pagesReceived: number,
  pagesStitched: number,
  rawReportText: string,
  detectedSections: string[]
): OcrCompleteness {
  const warnings: string[] = [];
  const expectedSections = ['patient', 'dating', 'efw', 'measurements', 'fhr'];
  
  // High-value optional sections
  const recommendedSections = ['ua', 'mca', 'uterine', 'dv', 'calculations', 'amnioticFluid'];

  const missingExpected: string[] = [];
  expectedSections.forEach(sec => {
    if (!detectedSections.includes(sec)) {
      missingExpected.push(sec);
    }
  });

  if (pagesReceived > 1 && rawReportText.length < pagesReceived * 200) {
    warnings.push(`POSSIBLE OCR INCOMPLETE: Nhận ${pagesReceived} ảnh nhưng dung lượng text trích xuất (${rawReportText.length} ký tự) có thể chưa đầy đủ.`);
  }

  if (pagesStitched < pagesReceived) {
    warnings.push(`Số trang ghép (${pagesStitched}) ít hơn số ảnh tải lên (${pagesReceived})`);
  }

  if (missingExpected.length > 0) {
    warnings.push(`Thiếu các nhóm thông tin cơ bản: ${missingExpected.join(', ')}`);
  }

  // Calculate score 0-100
  let score = 100;
  if (pagesStitched < pagesReceived) score -= 30;
  if (missingExpected.length > 0) score -= (missingExpected.length * 15);
  if (rawReportText.length < 300) score -= 25;
  score = Math.max(0, Math.min(100, score));

  return {
    pagesReceived,
    pagesStitched,
    ocrCompleted: rawReportText.length > 50 && missingExpected.length <= 1,
    sectionsDetected: detectedSections,
    missingExpectedSections: missingExpected,
    warnings,
    completenessScore: score,
  };
}
