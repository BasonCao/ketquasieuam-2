import { Measurements2D, DopplerValues, AmnioticFluidData, PlacentaData, FetalWeightEFW, PatientInfo, MeasurementEvidence, PregnancyDating } from '../types/ultrasound';

export interface MeasurementNormalizationContext {
  key: string;
  rawValue: number | string | null | undefined;
  rawText?: string;
  unit?: string;
  label?: string;
  page?: number;
  section?: 'BIOMETRY' | 'CALCULATIONS' | 'EFW' | 'DOPPLER' | 'AMNIOTIC' | 'PATIENT' | string;
  expectedType?: 'distance' | 'circumference' | 'weight' | 'ratio' | 'velocity' | 'index' | 'heart_rate';
  efwVal?: number | null;
}

// Canonical Normalizer with full anatomical range knowledge and ratio rejection
export function normalizeMeasurementValue(context: MeasurementNormalizationContext): MeasurementEvidence {
  const { key, rawValue, rawText = '', unit = 'mm', label = '', page = 1, section = 'BIOMETRY', efwVal } = context;
  const cleanK = (key || '').toLowerCase().replace(/[\s\.\-_]/g, '');

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return {
      key: cleanK,
      value: null,
      unit,
      label,
      sourceText: rawText,
      page,
      section,
      confidence: 0,
      isExtracted: false,
    };
  }

  // 1. REJECT RATIO / CALCULATION FROM BEING STORED AS 2D BIOMETRY
  const combinedContext = `${cleanK} ${label} ${rawText}`.toLowerCase();
  if (
    combinedContext.includes('hc/ac') ||
    combinedContext.includes('hc / ac') ||
    combinedContext.includes('fl/ac') ||
    combinedContext.includes('fl / ac') ||
    combinedContext.includes('fl/bpd') ||
    combinedContext.includes('fl / bpd') ||
    combinedContext.includes('fl/hc') ||
    combinedContext.includes('fl / hc') ||
    combinedContext.includes('campbell') ||
    combinedContext.includes('ratio')
  ) {
    // If the indicator is being mapped to basic 2D biometry (ac, fl, bpd, hc), reject!
    if (['ac', 'fl', 'bpd', 'hc'].includes(cleanK)) {
      return {
        key: cleanK,
        value: null,
        unit,
        label,
        sourceText: `[REJECTED_RATIO_COLLISION] ${rawText}`,
        page,
        section: 'CALCULATIONS',
        confidence: 0,
        isExtracted: false,
      };
    }
  }

  // 3. PARSE RAW NUMERIC VALUE
  let numVal: number;
  if (typeof rawValue === 'number') {
    numVal = rawValue;
  } else {
    // Try to extract exact decimal from rawText first if present (e.g. "14.28 mm" or "14,28")
    const textDecimalMatch = rawText.match(/(\d+)[\.,](\d{1,3})/);
    if (textDecimalMatch) {
      numVal = parseFloat(`${textDecimalMatch[1]}.${textDecimalMatch[2]}`);
    } else {
      const cleaned = String(rawValue).replace(/,/g, '.').replace(/[^\d\.]/g, '');
      numVal = parseFloat(cleaned);
    }
  }

  if (isNaN(numVal) || numVal <= 0) {
    return {
      key: cleanK,
      value: null,
      unit,
      label,
      sourceText: rawText,
      page,
      section,
      confidence: 0,
      isExtracted: false,
    };
  }

  // 4. STRICT EFW REJECTION: If number matches EFW weight (e.g. 65 g, 741 g)
  // 'cm' (Cisterna Magna) is treated as a distinct biometry measurement and ignores EFW validations
  if (cleanK === 'cm') {
    // Explicitly bypass EFW weight validation
  } else if (efwVal && efwVal > 0) {
    if (
      Math.abs(numVal - efwVal) < 0.5 ||
      Math.abs(numVal - efwVal * 10) < 20 ||
      Math.abs(numVal - (efwVal * 10 + 9)) < 2 ||
      (numVal >= 1000 && Math.abs(numVal - (efwVal * 10 + 9)) < 20)
    ) {
      if (['hc', 'ac', 'fl', 'hl', 'bpd', 'bod', 'foot', 'nbl', 'tcd', 'vp', 'nt', 'crl', 'gs', 'ys'].includes(cleanK)) {
        return {
          key: cleanK,
          value: null,
          unit,
          label,
          sourceText: `[REJECTED_EFW_CONTAMINATION] ${rawText}`,
          page,
          section,
          confidence: 0,
          isExtracted: false,
        };
      }
    }
  }

  // 5. ANATOMICAL RANGE & DECIMAL NORMALIZATION
  // Rule: If number is already within valid biological range in mm, DO NOT touch it!
  // If outside range, try dividing by 10 first. If that's in range, use /10. Only try /100 if /10 is still out of range.
  let normalizedValue = numVal;

  const tryScale = (val: number, minValid: number, maxValid: number): number => {
    if (val >= minValid && val <= maxValid) {
      if (val > 100 && (val / 100) >= minValid && (val / 100) <= maxValid && Number.isInteger(val)) {
        return Math.round((val / 100) * 100) / 100;
      }
      return val;
    }
    if (val / 10 >= minValid && val / 10 <= maxValid) {
      if (val > 100 && (val / 100) >= minValid && (val / 100) <= maxValid && Number.isInteger(val)) {
        return Math.round((val / 100) * 100) / 100;
      }
      return Math.round((val / 10) * 100) / 100;
    }
    if (val / 100 >= minValid && val / 100 <= maxValid) {
      return Math.round((val / 100) * 100) / 100;
    }
    return val;
  };

  switch (cleanK) {
    case 'nt': // Nuchal translucency: 0.3 - 15.0 mm
      normalizedValue = tryScale(normalizedValue, 0.3, 15.0);
      if (normalizedValue < 0.3 || normalizedValue > 15.0) normalizedValue = NaN;
      break;

    case 'nbl':
    case 'nb': // Nasal bone length: 0.8 - 25.0 mm
      normalizedValue = tryScale(normalizedValue, 0.8, 25.0);
      if (normalizedValue < 0.8 || normalizedValue > 25.0) normalizedValue = NaN;
      break;

    case 'bod': // Binocular distance: 5.0 - 90.0 mm
      normalizedValue = tryScale(normalizedValue, 5.0, 90.0);
      if (normalizedValue < 5.0 || normalizedValue > 90.0) normalizedValue = NaN;
      break;

    case 'hl':
    case 'hum': // Humerus length: 4.0 - 110.0 mm
      normalizedValue = tryScale(normalizedValue, 4.0, 110.0);
      if (normalizedValue < 4.0 || normalizedValue > 110.0) normalizedValue = NaN;
      break;

    case 'fl': // Femur length: 4.0 - 120.0 mm
      normalizedValue = tryScale(normalizedValue, 4.0, 120.0);
      if (normalizedValue < 4.0 || normalizedValue > 120.0) normalizedValue = NaN;
      break;

    case 'foot': // Foot length: 4.0 - 120.0 mm
      normalizedValue = tryScale(normalizedValue, 4.0, 120.0);
      if (normalizedValue < 4.0 || normalizedValue > 120.0) normalizedValue = NaN;
      break;

    case 'crl': // Crown-rump length: 5.0 - 130.0 mm
      normalizedValue = tryScale(normalizedValue, 5.0, 130.0);
      if (normalizedValue < 5.0 || normalizedValue > 130.0) normalizedValue = NaN;
      break;

    case 'bpd': // Biparietal diameter: 10.0 - 140.0 mm
      normalizedValue = tryScale(normalizedValue, 10.0, 140.0);
      if (normalizedValue < 10.0 || normalizedValue > 140.0) normalizedValue = NaN;
      break;

    case 'hc': // Head circumference: 30.0 - 500.0 mm
      normalizedValue = tryScale(normalizedValue, 30.0, 500.0);
      if (normalizedValue < 30.0 || normalizedValue > 500.0) normalizedValue = NaN;
      break;

    case 'ac': // Abdominal circumference: 20.0 - 500.0 mm
      normalizedValue = tryScale(normalizedValue, 20.0, 500.0);
      if (normalizedValue < 20.0 || normalizedValue > 500.0) normalizedValue = NaN;
      break;

    case 'cm': {
      // Cisterna Magna: valid physiological range 1.0 - 18.0 mm.
      // Phase 3 fix: previously used the generic tryScale() heuristic, which
      // blindly divided by 10/100 whenever that landed the number back in
      // range (e.g. raw "592" -> 592/100 = 5.92, raw "42" -> 42/10 = 4.2).
      // That fabricates a decimal position with no real evidence (no access
      // to sourceEvidence/report context at this call site to justify it).
      // We now only accept the raw OCR number as-is when it is already within
      // the valid range (covers "5.92 mm" / "5.92mm" / "4.2mm" where OCR read
      // the decimal correctly). Out-of-range raw numbers (e.g. "592mm",
      // "42mm") are left unresolved rather than guessed.
      if (normalizedValue < 1.0 || normalizedValue > 18.0) {
        normalizedValue = NaN;
      }
      break;
    }

    case 'vp':
    case 'lv':
    case 'va': // Lateral ventricle: 1.0 - 18.0 mm
      normalizedValue = tryScale(normalizedValue, 1.0, 18.0);
      if (normalizedValue < 1.0 || normalizedValue > 18.0) normalizedValue = NaN;
      break;

    case 'tcd':
    case 'cereb': // Cerebellar diameter: 5.0 - 95.0 mm
      normalizedValue = tryScale(normalizedValue, 5.0, 95.0);
      if (normalizedValue < 5.0 || normalizedValue > 95.0) normalizedValue = NaN;
      break;

    case 'gs': // Gestational sac: 3.0 - 90.0 mm
      normalizedValue = tryScale(normalizedValue, 3.0, 90.0);
      break;

    case 'ys': // Yolk sac: 1.5 - 10.0 mm
      normalizedValue = tryScale(normalizedValue, 1.5, 10.0);
      break;

    case 'cervixlength': // Cervical length: 15 - 65 mm or 1.5 - 6.5 cm
      if (normalizedValue > 65 && normalizedValue <= 650) {
        normalizedValue = Math.round((normalizedValue / 10) * 100) / 100;
      }
      break;

    default:
      break;
  }

  if (isNaN(normalizedValue)) {
    return {
      key: cleanK,
      value: null,
      unit,
      label,
      sourceText: `[OUT_OF_RANGE_OR_INVALID] ${rawText}`,
      page,
      section,
      confidence: 0,
      isExtracted: false,
    };
  }

  normalizedValue = Math.round(normalizedValue * 100) / 100;

  return {
    key: cleanK,
    value: normalizedValue,
    unit,
    label: label || key,
    sourceText: rawText || `${key} = ${normalizedValue} ${unit}`,
    page,
    section,
    confidence: 0.98,
    isExtracted: true,
  };
}

// Backwards-compatible wrapper
export function sanitizeBiometryValue(
  key: string,
  rawNum: number | null,
  efwVal?: number | null,
  rawText?: string,
  label?: string
): number | null {
  if (rawNum === null || rawNum === undefined || isNaN(rawNum)) return null;
  const res = normalizeMeasurementValue({
    key,
    rawValue: rawNum,
    rawText: rawText || `${key} ${rawNum}`,
    label: label || key,
    efwVal,
  });
  return res.value;
}

// Hadlock formulas for EFW (Default Hadlock 3: HC, AC, FL)
export function calculateHadlockEFW(
  acMm: number | null,
  flMm: number | null,
  bpdMm: number | null,
  hcMm: number | null
): { efwGrams: number | null; rangeGrams: number | null; formulaUsed: string } {
  if (!acMm || !flMm) return { efwGrams: null, rangeGrams: null, formulaUsed: '' };

  const acCm = acMm / 10;
  const flCm = flMm / 10;
  let log10Weight: number;
  let formulaUsed = 'Hadlock 3 (HC, AC, FL)';

  if (hcMm) {
    // Hadlock 3 (HC, AC, FL) - standard 3-parameter formula
    const hcCm = hcMm / 10;
    log10Weight =
      1.326 - 0.00326 * (acCm * flCm) + 0.0107 * hcCm + 0.0438 * acCm + 0.158 * flCm;
    formulaUsed = 'Hadlock 3 (HC, AC, FL)';
  } else if (bpdMm) {
    // Hadlock 2 (BPD, AC, FL)
    const bpdCm = bpdMm / 10;
    log10Weight =
      1.335 - 0.0034 * (acCm * flCm) + 0.0316 * bpdCm + 0.0457 * acCm + 0.1623 * flCm;
    formulaUsed = 'Hadlock 2 (BPD, AC, FL)';
  } else {
    // Hadlock 1 (AC, FL)
    log10Weight = 1.304 + 0.05281 * acCm + 0.18 * flCm - 0.00384 * (acCm * flCm);
    formulaUsed = 'Hadlock 1 (AC, FL)';
  }

  const weight = Math.round(Math.pow(10, log10Weight));
  if (isNaN(weight) || weight < 10 || weight > 6000) {
    return { efwGrams: null, rangeGrams: null, formulaUsed: '' };
  }

  // 95% confidence interval ± 15%
  const range = Math.round(weight * 0.15);
  return { efwGrams: weight, rangeGrams: range, formulaUsed };
}

// Calculate GA from CRL (Hadlock / Robinson)
export function calculateGAFromCRL(crlMm: number | null): { weeks: number; days: number; text: string } | null {
  if (!crlMm || crlMm < 2 || crlMm > 100) return null;
  // Robinson & Fleming: GA (days) = 8.052 * sqrt(CRL) + 23.73
  const totalDays = Math.round(8.052 * Math.sqrt(crlMm) + 23.73);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return {
    weeks,
    days,
    text: `${weeks}w${days}d`,
  };
}

// Date Parsing & Formatting Helpers
export function parseDateComponents(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  // Match DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  let match = trimmed.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})$/);
  if (match) {
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  // Match YYYY-MM-DD or YYYY.MM.DD
  match = trimmed.match(/^(\d{4})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})$/);
  if (match) {
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let day = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  return null;
}

export function formatDateComponents(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

// Calculate EDD from LMP (Naegele rule: LMP + 280 days)
export function calculateEDDFromLMP(lmpStr: string, examDateStr?: string): { eddStr: string; gaText: string } | null {
  if (!lmpStr) return null;
  const lmpComp = parseDateComponents(lmpStr);
  if (!lmpComp) return null;

  const lmpUtcMs = Date.UTC(lmpComp.year, lmpComp.month - 1, lmpComp.day);
  const eddUtcMs = lmpUtcMs + 280 * 24 * 60 * 60 * 1000;
  const eddDate = new Date(eddUtcMs);

  const eddStr = formatDateComponents(
    eddDate.getUTCFullYear(),
    eddDate.getUTCMonth() + 1,
    eddDate.getUTCDate()
  );

  let examUtc = Date.now();
  if (examDateStr) {
    const exComp = parseDateComponents(examDateStr);
    if (exComp) {
      examUtc = Date.UTC(exComp.year, exComp.month - 1, exComp.day);
    }
  }

  const diffTime = examUtc - lmpUtcMs;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const gaWeeks = Math.floor(diffDays / 7);
  const gaDays = diffDays % 7;

  return {
    eddStr,
    gaText: diffDays > 0 && diffDays < 310 ? `${gaWeeks}w${gaDays}d` : '',
  };
}

// Calculate EDD and GA for IVF from Transfer Date and embryo age (Day 5 / Day 3)
// - Day 5 embryo transfer: EDD = transfer date + 261 days
// - Day 3 embryo transfer: EDD = transfer date + 263 days
// - GA at exam date: GA = 280 days - (EDD - examDate)
export function calculateIvfDating(
  transferDateStr: string,
  embryoAge: number = 5,
  examDateStr?: string
): { eddStr: string; gaText: string; totalDays: number } | null {
  if (!transferDateStr) return null;
  const tComp = parseDateComponents(transferDateStr);
  if (!tComp) return null;

  const daysToAdd = 266 - (embryoAge || 5);
  const transferUtcMs = Date.UTC(tComp.year, tComp.month - 1, tComp.day);
  const eddUtcMs = transferUtcMs + daysToAdd * 24 * 60 * 60 * 1000;
  const eddDate = new Date(eddUtcMs);

  const eddStr = formatDateComponents(
    eddDate.getUTCFullYear(),
    eddDate.getUTCMonth() + 1,
    eddDate.getUTCDate()
  );

  let examUtc = Date.now();
  if (examDateStr) {
    const eComp = parseDateComponents(examDateStr);
    if (eComp) {
      examUtc = Date.UTC(eComp.year, eComp.month - 1, eComp.day);
    }
  } else {
    const now = new Date();
    examUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Formula: GA = 280 days - (EDD - examDate)
  const diffDaysToEdd = Math.round((eddUtcMs - examUtc) / (24 * 60 * 60 * 1000));
  const gaDaysTotal = 280 - diffDaysToEdd;

  let gaText = '';
  if (gaDaysTotal > 0 && gaDaysTotal <= 310) {
    const weeks = Math.floor(gaDaysTotal / 7);
    const days = gaDaysTotal % 7;
    gaText = `${weeks}w${days}d`;
  }

  return {
    eddStr,
    gaText,
    totalDays: gaDaysTotal,
  };
}

// Legacy wrapper for calculateEDDForIVF
export function calculateEDDForIVF(transferDateStr: string, embryoAge: number): string | null {
  const result = calculateIvfDating(transferDateStr, embryoAge);
  return result ? result.eddStr : null;
}

// IVF / ART Pattern Recognition
export function detectIvfFromText(text: string): {
  isIvf: boolean;
  embryoDay: number;
  transferDate?: string;
  gaDst?: string;
  eddDst?: string;
} {
  if (!text) return { isIvf: false, embryoDay: 5 };

  const clean = text;

  // Check IVF / ART keywords
  // NOTE (requirement 10 - "KHÔNG SUY ĐOÁN"): bare "Transfer" was previously an
  // accepted trigger on its own, which caused false-positive IVF detection on
  // reports that just mention "transfer" in an unrelated context. IVF/ART
  // evidence must be tied to an embryo/IVF-specific term.
  const isIvfKeyword = /(?:\bIVF\b|\bICSI\b|\bART\b|Embryo\s*Transfer|\bET\b|\bFET\b|Fresh\s*Transfer|Day\s*\d+\s*(?:Trans\.?|Transfer)|\bD[35]\b|ngày\s*chuyển\s*phôi|phôi\s*ngày|chuyển\s*phôi)/i.test(clean);

  // Check Day 5 vs Day 3
  let embryoDay = 5;
  if (/(?:Day\s*3\s*(?:Trans\.?|Transfer)|ngày\s*chuyển\s*phôi\s*(?:ngày)?\s*3|phôi\s*ngày\s*3|\bD3\b)/i.test(clean)) {
    embryoDay = 3;
  } else if (/(?:Day\s*5\s*(?:Trans\.?|Transfer)|ngày\s*chuyển\s*phôi\s*(?:ngày)?\s*5|phôi\s*ngày\s*5|\bD5\b)/i.test(clean)) {
    embryoDay = 5;
  }

  // Find transfer date
  let transferDate: string | undefined;
  const transferMatch = clean.match(/(?:Day\s*(\d+)\s*(?:Trans\.?|Transfer)|Embryo\s*Transfer|\bET\b|IVF|FET|Transfer|ngày\s*chuyển\s*phôi)\s*[:\|\s=-]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  if (transferMatch) {
    transferDate = transferMatch[2].trim();
    if (transferMatch[1]) {
      const parsedDay = parseInt(transferMatch[1], 10);
      if (parsedDay === 3 || parsedDay === 5) embryoDay = parsedDay;
    }
  }

  if (!transferDate) {
    const directMatch = clean.match(/Day\s*(\d+)\s*Trans\.?\s*[:\|\s-]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
    if (directMatch) {
      transferDate = directMatch[2].trim();
      embryoDay = parseInt(directMatch[1], 10) || 5;
    }
  }

  // Check machine-extracted GA(DST) and EDD(DST)
  let gaDst: string | undefined;
  const gaDstMatch = clean.match(/GA\s*\(DST\)\s*[:\|\s]*(\d+w\d+d|\d+\s*w\s*\d+\s*d|\d+\s*tuần\s*\d+\s*ngày)/i);
  if (gaDstMatch) {
    gaDst = gaDstMatch[1].replace(/\s+/g, '');
  }

  let eddDst: string | undefined;
  const eddDstMatch = clean.match(/EDD\s*\(DST\)\s*[:\|\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  if (eddDstMatch) {
    eddDst = eddDstMatch[1].trim();
  }

  return {
    isIvf: isIvfKeyword,
    embryoDay,
    transferDate,
    gaDst,
    eddDst,
  };
}

export interface DatingResult {
  finalGA: string;
  finalEDD: string;
  datingSource: string; // 'IVF_DAY5' | 'IVF_DAY3' | 'IVF_OTHER' | 'CLINICAL' | 'LMP' | 'AUA' | 'UNKNOWN'
  gaSource: string;
  eddSource: string;
  transferDate?: string;
  embryoDay?: number;
  isIvf: boolean;
}

// Pregnancy Dating Priority Resolver:
// PRIORITY 1: IVF/ART + ngày chuyển phôi (EDD = transfer + 261/263d, GA = 280 - (EDD - examDate))
// PRIORITY 2: GA/EDD đã được máy siêu âm xác định theo IVF/ART (GA(DST)/EDD(DST))
// PRIORITY 3: GA/EDD lâm sàng (GA Clin, EDD)
// PRIORITY 4: GA/EDD tính từ LMP
// PRIORITY 5: GA/AUA từ sinh trắc học
export function resolvePregnancyDating(input: {
  rawText?: string;
  examDate?: string;
  extractedPatient?: Partial<PatientInfo>;
  extractedGaClin?: string;
  extractedEdd?: string;
  extractedGaAua?: string;
  extractedEddAua?: string;
  extractedDoc?: string;
  extractedLmp?: string;
  pregnancyDating?: PregnancyDating;
}): DatingResult {
  const {
    rawText = '',
    examDate = '',
    extractedPatient = {},
    extractedGaClin = '',
    extractedEdd = '',
    extractedGaAua = '',
    extractedEddAua = '',
    extractedDoc = '',
    extractedLmp = '',
    pregnancyDating,
  } = input;

  const combinedText = `${rawText} ${extractedPatient.doc || ''} ${extractedDoc || ''} ${pregnancyDating?.source || ''} ${pregnancyDating?.type || ''}`;
  const ivfInfo = detectIvfFromText(combinedText);

  const isPreviouslyIvf = 
    pregnancyDating?.type === 'IVF' || 
    (pregnancyDating?.source && pregnancyDating.source.startsWith('IVF')) ||
    (extractedPatient && typeof extractedPatient.datingSource === 'string' && extractedPatient.datingSource.startsWith('IVF')) ||
    (extractedPatient && typeof extractedPatient.eddSource === 'string' && extractedPatient.eddSource.startsWith('IVF'));

  if (isPreviouslyIvf) {
    ivfInfo.isIvf = true;
  }

  const transferDate =
    ivfInfo.transferDate ||
    pregnancyDating?.transferDate ||
    extractedPatient.transferDate ||
    (ivfInfo.isIvf ? (extractedDoc || extractedPatient.doc) : undefined);

  const embryoDay =
    ivfInfo.embryoDay ||
    pregnancyDating?.embryoAge ||
    extractedPatient.embryoDay ||
    5;

  const gaDst = ivfInfo.gaDst || pregnancyDating?.ga;
  const eddDst = ivfInfo.eddDst || pregnancyDating?.edd;

  let finalGA = '';
  let finalEDD = '';
  let datingSource = 'UNKNOWN';
  let gaSource = 'UNKNOWN';
  let eddSource = 'UNKNOWN';

  // PRIORITY 1: IVF/ART + ngày chuyển phôi
  if (ivfInfo.isIvf && transferDate) {
    const ivfDating = calculateIvfDating(transferDate, embryoDay, examDate);
    const sourceTag = embryoDay === 3 ? 'IVF_DAY3' : 'IVF_DAY5';
    datingSource = sourceTag;
    gaSource = sourceTag;
    eddSource = sourceTag;
    finalEDD = eddDst || ivfDating?.eddStr || '';
    finalGA = gaDst || ivfDating?.gaText || '';
  }
  // PRIORITY 2: GA/EDD đã được máy siêu âm xác định theo IVF/ART (GA(DST)/EDD(DST))
  // Phase 2.1 audit finding: GA(DST)/EDD(DST) alone is WEAK evidence — some OCR
  // paths (offlineOcrService's generic GA(Clin|LMP|EDD|KCC|DST) capture) treat
  // "DST" as just another bracketed label, with no semantic guarantee it means
  // IVF. This branch must only fire when DST is corroborated by real IVF/ART
  // evidence from detectIvfFromText() — DST alone must NOT fabricate IVF.
  else if ((gaDst || eddDst) && ivfInfo.isIvf) {
    const sourceTag = embryoDay === 3 ? 'IVF_DAY3' : 'IVF_DAY5';
    datingSource = sourceTag;
    gaSource = sourceTag;
    eddSource = sourceTag;
    finalGA = gaDst || pregnancyDating?.ga || extractedGaClin || extractedPatient.gaClin || '';
    finalEDD = eddDst || pregnancyDating?.edd || extractedEdd || extractedPatient.edd || '';
  }
  // PRIORITY 3: GA/EDD lâm sàng (GA Clin / EDD)
  else if (extractedGaClin || extractedEdd || extractedPatient.gaClin || extractedPatient.edd) {
    datingSource = 'CLINICAL';
    gaSource = (extractedGaClin || extractedPatient.gaClin) ? 'CLINICAL' : 'UNKNOWN';
    eddSource = (extractedEdd || extractedPatient.edd) ? 'CLINICAL' : 'UNKNOWN';
    finalGA = extractedGaClin || extractedPatient.gaClin || '';
    finalEDD = extractedEdd || extractedPatient.edd || '';
  }
  // PRIORITY 4: GA/EDD tính từ LMP
  else if (extractedLmp || extractedPatient.lmp) {
    const lmpVal = extractedLmp || extractedPatient.lmp || '';
    const lmpCalc = calculateEDDFromLMP(lmpVal, examDate);
    if (lmpCalc) {
      datingSource = 'LMP';
      gaSource = 'LMP';
      eddSource = 'LMP';
      finalEDD = lmpCalc.eddStr;
      finalGA = lmpCalc.gaText;
    }
  }
  // PRIORITY 5: GA/AUA từ sinh trắc học
  else if (extractedGaAua || extractedEddAua || extractedPatient.gaAua) {
    datingSource = 'AUA';
    gaSource = 'AUA';
    eddSource = 'AUA';
    finalGA = extractedGaAua || extractedPatient.gaAua || '';
    finalEDD = extractedEddAua || '';
  }

  // Fallback: If finalEDD exists but finalGA is missing, calculate GA from EDD & examDate
  if (finalEDD && !finalGA) {
    const eComp = parseDateComponents(finalEDD);
    if (eComp) {
      const eddUtcMs = Date.UTC(eComp.year, eComp.month - 1, eComp.day);
      let examUtc = Date.now();
      if (examDate) {
        const exComp = parseDateComponents(examDate);
        if (exComp) examUtc = Date.UTC(exComp.year, exComp.month - 1, exComp.day);
      }
      const diffDaysToEdd = Math.round((eddUtcMs - examUtc) / (24 * 60 * 60 * 1000));
      const gaDaysTotal = 280 - diffDaysToEdd;
      if (gaDaysTotal > 0 && gaDaysTotal <= 310) {
        finalGA = `${Math.floor(gaDaysTotal / 7)}w${gaDaysTotal % 7}d`;
      }
    }
  }

  // DEBUG LOG (Requirement 13)
  console.log("DATING SOURCE:", datingSource);
  console.log("IVF TRANSFER:", transferDate);
  console.log("EMBRYO DAY:", embryoDay);
  console.log("FINAL GA:", finalGA);
  console.log("FINAL EDD:", finalEDD);

  return {
    finalGA,
    finalEDD,
    datingSource,
    gaSource,
    eddSource,
    transferDate,
    embryoDay,
    isIvf: datingSource.startsWith('IVF') || ivfInfo.isIvf,
  };
}

// Determine growth percentile rank based on EFW and GA
export function estimateWeightPercentile(efwG: number | null, gaWeeks: number): { percentile: string; category: 'SGA' | 'AGA' | 'LGA' } {
  if (!efwG || gaWeeks < 12 || gaWeeks > 42) {
    return { percentile: 'N/A', category: 'AGA' };
  }

  // Hadlock 50th percentile reference table (approx)
  const medianWeights: Record<number, number> = {
    12: 58,
    13: 73,
    14: 93,
    15: 117,
    16: 146,
    17: 181,
    18: 223,
    19: 273,
    20: 331,
    21: 399,
    22: 478,
    23: 568,
    24: 670,
    25: 785,
    26: 913,
    27: 1055,
    28: 1210,
    29: 1379,
    30: 1559,
    31: 1751,
    32: 1953,
    33: 2162,
    34: 2377,
    35: 2595,
    36: 2813,
    37: 3028,
    38: 3236,
    39: 3430,
    40: 3600,
  };

  const median = medianWeights[gaWeeks] || 1500;
  const ratio = efwG / median;

  let pctNumber = 50;
  if (ratio <= 0.75) pctNumber = Math.max(1, Math.round(ratio * 5));
  else if (ratio <= 0.85) pctNumber = Math.round(5 + ((ratio - 0.75) / 0.1) * 5);
  else if (ratio <= 1.0) pctNumber = Math.round(10 + ((ratio - 0.85) / 0.15) * 40);
  else if (ratio <= 1.15) pctNumber = Math.round(50 + ((ratio - 1.0) / 0.15) * 40);
  else pctNumber = Math.min(99, Math.round(90 + (ratio - 1.15) * 40));

  let category: 'SGA' | 'AGA' | 'LGA' = 'AGA';
  if (pctNumber < 10) category = 'SGA'; // Thai nhỏ so với tuổi thai
  else if (pctNumber > 90) category = 'LGA'; // Thai to so với tuổi thai

  return {
    percentile: `${pctNumber}%`,
    category,
  };
}

// Generate clinical auto-conclusion text
export function generateAutoConclusion(
  patient: PatientInfo,
  measurements: Measurements2D,
  efw: FetalWeightEFW,
  doppler: DopplerValues,
  amniotic: AmnioticFluidData,
  placenta: PlacentaData
): { conclusion: string; recommendations: string } {
  const parts: string[] = [];

  // Gestational age priority: Prioritize GA(EDD) as requested by user
  const effectiveGA = patient.gaClin || patient.gaAua || efw.gaAge || measurements.crl.gaAge || 'tuổi thai';

  // 1. Early pregnancy vs Morphology
  if (measurements.gs.value && !measurements.bpd.value && !measurements.crl.value) {
    parts.push(
      `Một túi thai trong buồng tử cung (GS: ${measurements.gs.value} mm), tương đương ${measurements.gs.gaAge || effectiveGA || 'thai sớm'}.`
    );
    if (measurements.ys.value) {
      parts.push(`Đã quan sát thấy túi noãn hoàng (YS: ${measurements.ys.value} mm).`);
    }
  } else if (measurements.crl.value && (!measurements.bpd.value || (measurements.crl.value < 85 && (measurements.bpd.value || 0) < 25))) {
    // 1st trimester
    parts.push(
      `Một thai sống trong buồng tử cung, phát triển tương đương ${effectiveGA} (CRL: ${measurements.crl.value} mm).`
    );
    if (doppler.fhr.value) {
      parts.push(`Tim thai: ${doppler.fhr.value} lần/phút (đều, rõ).`);
    }
    if (measurements.nt.value) {
      parts.push(
        `Độ mờ da gáy (NT): ${measurements.nt.value} mm (${measurements.nt.value <= 2.5 ? 'trong giới hạn bình thường' : 'nguy cơ cao, cần theo dõi'}).`
      );
    }
    if (measurements.nbl.value) {
      parts.push(`Xương mũi (NBL): ${measurements.nbl.value} mm (hiện diện).`);
    }
  } else {
    // 2nd / 3rd trimester - Priority GA(EDD)
    parts.push(
      `Một thai sống trong buồng tử cung phát triển tương đương ${effectiveGA}.`
    );
    if (doppler.fhr.value) {
      parts.push(`Tim thai: ${doppler.fhr.value} lần/phút.`);
    }
    if (efw.value) {
      parts.push(
        `Cân nặng ước tính: ${efw.value} g ${efw.range ? `(${efw.range})` : ''} ${efw.percentile ? `- Bách phân vị: ${efw.percentile}` : ''}.`
      );
    }
    // Biometry check
    parts.push('Các chỉ số sinh trắc học thai nhi (BPD, HC, AC, FL) nằm trong bách phân vị bình thường theo tuổi thai.');
  }

  // 2. Amniotic & Placenta
  if (amniotic.afi.value || amniotic.q1.value) {
    const afiVal = amniotic.afi.value || (
      (amniotic.q1.value || 0) + (amniotic.q2.value || 0) * (amniotic.q2.unit === 'cm' ? 10 : 1) +
      (amniotic.q3.value || 0) * (amniotic.q3.unit === 'cm' ? 10 : 1) + (amniotic.q4.value || 0) * (amniotic.q4.unit === 'cm' ? 10 : 1)
    );
    if (afiVal > 0) {
      parts.push(`Chỉ số ối (AFI): ${afiVal} mm (${amniotic.status || 'Bình thường'}).`);
    }
  }

  if (placenta.location) {
    parts.push(`Vị trí bánh rau: ${placenta.location}, Độ trưởng thành: ${placenta.grade || 'Độ I'}.`);
  }

  if (measurements.cervixLength.value) {
    parts.push(`Chiều dài kênh cổ tử cung: ${measurements.cervixLength.value} ${measurements.cervixLength.unit} (bình thường, lỗ trong đóng kín).`);
  }

  // Doppler note
  if (doppler.leftUterine.pi || doppler.rightUterine.pi) {
    parts.push(`Doppler ĐM tử cung: Trái (PI: ${doppler.leftUterine.pi}, RI: ${doppler.leftUterine.ri}), Phải (PI: ${doppler.rightUterine.pi}, RI: ${doppler.rightUterine.ri}) - Chưa thấy dấu hiệu tăng trở kháng.`);
  }

  // Recommendations
  let rec = 'Khám thai định kỳ theo lịch hẹn của Bác sĩ chuyên khoa.';
  if (measurements.nt.value) {
    rec = 'Làm xét nghiệm sàng lọc trước sinh (NIPT / Double Test), khám thai và siêu âm hình thái học mốc 18 - 22 tuần.';
  } else if (measurements.gs.value && !doppler.fhr.value) {
    rec = 'Hẹn siêu âm kiểm tra lại sau 1-2 tuần để đánh giá sự xuất hiện của tim thai và phôi thai.';
  } else if (patient.gaClin && patient.gaClin.startsWith('15') || patient.gaClin?.startsWith('16')) {
    rec = 'Hẹn siêu âm khảo sát dị tật hình thái học chi tiết (4D/5D) ở mốc 20 - 22 tuần thai.';
  } else if (patient.gaClin && parseInt(patient.gaClin, 10) >= 30) {
    rec = 'Theo dõi cử động thai (đếm thai máy), theo dõi dấu hiệu chuyển dạ, tái khám sau 2 tuần hoặc khi có dấu hiệu bất thường.';
  }

  return {
    conclusion: parts.join(' '),
    recommendations: rec,
  };
}

// ==========================================
// DOPPLER NORMALIZATION & SECTION RECOGNITION
// ==========================================

/**
 * Normalize Doppler flow velocities (PS, ED, TAmax, MD, PSV in cm/s).
 * Fixes OCR missing decimal point errors (e.g. 3831 cm/s -> 38.31 cm/s, 5929 -> 59.29, -6690 -> -66.90).
 * Preserves correct negative velocities (e.g. -66.90, -5.01, -16.68, -4.51).
 */
export function normalizeDopplerVelocity(val: number | null | undefined): number | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }

  // Preserve the sign for negative flow velocities (e.g. Right Uterine PS -66.90 cm/s)
  const sign = val < 0 ? -1 : 1;
  const absVal = Math.abs(val);

  let num = absVal;
  // 4-digit integers without decimal point (e.g. 3831, 5929, 1561, 2990, 1134, 1712, 2599, 1670, 6690)
  if (num >= 1000 && num <= 15000 && Number.isInteger(num)) {
    num = num / 100;
  } else if (num >= 200 && num < 1000 && Number.isInteger(num)) {
    num = num / 10;
  }

  return (Math.round(num * 100) / 100) * sign;
}

/**
 * Normalize Doppler ratios and indices (RI, PI, S/D).
 * Fixes OCR missing decimal errors for indices.
 */
export function normalizeDopplerIndex(val: number | null | undefined, type: 'ri' | 'pi' | 'sd'): number | null {
  if (val === null || val === undefined || isNaN(val) || val <= 0) {
    return null;
  }

  let num = val;
  if (type === 'ri') {
    // Normal RI is 0.10 to 1.50 (typically 0.40 - 0.90)
    if (num >= 10 && num <= 99 && Number.isInteger(num)) {
      num = num / 100;
    }
  } else if (type === 'pi') {
    // Normal PI is 0.30 to 4.50
    if (num >= 100 && num <= 999 && Number.isInteger(num)) {
      num = num / 100;
    } else if (num >= 40 && num <= 99 && Number.isInteger(num)) {
      num = num / 100;
    }
  } else if (type === 'sd') {
    // Normal S/D is 1.00 to 15.00
    if (num >= 100 && num <= 999 && Number.isInteger(num)) {
      num = num / 100;
    }
  }

  return Math.round(num * 100) / 100;
}

/**
 * Identifies Doppler section headers from raw OCR text lines.
 * Robustly recognizes GE Voluson variants:
 * - MCA: "Right Mid Cereb Artery", "Left Mid Cereb Artery", "Mid Cereb Artery", "Middle Cerebral Artery", "MCA"
 * - UA: "Umbilical Art.", "Umbilical Art", "Umbilical Artery", "UA"
 * - Uterine: "Left Uterine", "Right Uterine"
 * - FHR: "Fetal Heart Rate", "Ventricular FHR"
 */
export function normalizeDopplerSectionHeader(
  line: string
): 'middleCerebralArtery' | 'umbilicalArtery' | 'leftUterine' | 'rightUterine' | 'ductusVenosus' | 'fhr' | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // FHR Section
  if (/(?:VENTRICULAR\s*FHR|FETAL\s*HEART\s*RATE|\bFHR\b|TIM\s*THAI)/i.test(trimmed)) {
    return 'fhr';
  }

  // Middle Cerebral Artery (MCA)
  if (
    /(?:(?:RIGHT|LEFT|RT|LT|R|L)?\s*(?:MID\s*CEREB(?:RAL)?|MIDDLE\s*CEREBRAL)\s*ART(?:ERY|\.)?|\bMCA\b|ĐM\s*NÃO\s*GIỮA|ĐỘNG\s*MẠCH\s*NÃO\s*GIỮA)/i.test(
      trimmed
    )
  ) {
    return 'middleCerebralArtery';
  }

  // Umbilical Artery (UA)
  if (
    /(?:UMBILICAL\s*ART(?:ERY|\.)?|UMB\.?\s*ART\.?|\bUA\b(?:\s*DOPPLER)?|ĐM\s*RỐN|ĐỘNG\s*MẠCH\s*RỐN)/i.test(trimmed)
  ) {
    return 'umbilicalArtery';
  }

  // Left Uterine
  if (
    /(?:(?:LEFT|LT|L)\s*UTERINE(?:\s*ART(?:ERY|\.)?)?|ĐM\s*TỬ\s*CUNG\s*TRÁI|ĐỘNG\s*MẠCH\s*TỬ\s*CUNG\s*TRÁI|UTA\s*L|LEFT\s*UTA|LEFT\s*UTART)/i.test(
      trimmed
    )
  ) {
    return 'leftUterine';
  }

  // Right Uterine
  if (
    /(?:(?:RIGHT|RT|R)\s*UTERINE(?:\s*ART(?:ERY|\.)?)?|ĐM\s*TỬ\s*CUNG\s*PHẢI|ĐỘNG\s*MẠCH\s*TỬ\s*CUNG\s*PHẢI|UTA\s*R|RIGHT\s*UTA|RIGHT\s*UTART)/i.test(
      trimmed
    )
  ) {
    return 'rightUterine';
  }

  // Ductus Venosus
  if (/(?:DUCTUS\s*VENOSUS|\bDV\b(?:\s*DOPPLER)?|ỐNG\s*TĨNH\s*MẠCH)/i.test(trimmed)) {
    return 'ductusVenosus';
  }

  return null;
}
