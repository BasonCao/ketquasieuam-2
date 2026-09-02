import { UltrasoundReport, PatientInfo, Measurements2D, DopplerValues, AmnioticFluidData, PlacentaData, FetalWeightEFW, UltrasoundValidationLog, CalculatedRatios } from '../types/ultrasound';
import { formatPatientVietnameseName, savePatientToDirectory } from '../data/patientDirectory';
import { calculateHadlockEFW, generateAutoConclusion, sanitizeBiometryValue, normalizeMeasurementValue, normalizeDopplerVelocity, normalizeDopplerIndex, normalizeDopplerSectionHeader, estimateWeightPercentile, resolvePregnancyDating } from './clinicalCalculations';
import { detectBestTemplate } from '../data/formTemplates';

// Key aliases mapping to standard Measurements2D keys
const MEASUREMENT_KEY_MAP: Record<string, keyof Measurements2D> = {
  // BPD
  bpd: 'bpd',
  bpdhadlock: 'bpd',
  bpdhad: 'bpd',
  'b.p.d': 'bpd',
  biparietal: 'bpd',
  luongdinh: 'bpd',

  // HC
  hc: 'hc',
  hcintergrw: 'hc',
  hcintergrowth: 'hc',
  hchadlock: 'hc',
  'h.c': 'hc',
  headcircumference: 'hc',
  chuvidau: 'hc',

  // AC
  ac: 'ac',
  achadlock: 'ac',
  'a.c': 'ac',
  abdominalcircumference: 'ac',
  chuvibung: 'ac',

  // FL
  fl: 'fl',
  flosaka: 'fl',
  flhadlock: 'fl',
  'f.l': 'fl',
  femurlength: 'fl',
  xuongdui: 'fl',

  // HL
  hl: 'hl',
  hljeanty: 'hl',
  'h.l': 'hl',
  hum: 'hl',
  humerus: 'hl',
  xuongcanhtay: 'hl',

  // TCD / Cereb
  tcd: 'tcd',
  't.c.d': 'tcd',
  cereb: 'tcd',
  cerebhill: 'tcd',
  cerebellum: 'tcd',
  cerebellar: 'tcd',
  tieunao: 'tcd',

  // CM
  cm: 'cm',
  'c.m': 'cm',
  cisternamagna: 'cm',
  cisterna: 'cm',
  belon: 'cm',

  // Vp
  vp: 'vp',
  'v.p': 'vp',
  va: 'vp',
  lv: 'vp',
  lateralventricle: 'vp',
  latvent: 'vp',
  naothatben: 'vp',

  // NBL
  nbl: 'nbl',
  'n.b.l': 'nbl',
  nb: 'nbl',
  nasalbone: 'nbl',
  nasal: 'nbl',
  nblsonek: 'nbl',
  xuongmui: 'nbl',

  // BOD
  bod: 'bod',
  'b.o.d': 'bod',
  iod: 'bod',
  binocular: 'bod',
  bodjeanty: 'bod',
  hocmat: 'bod',

  // Foot
  foot: 'foot',
  ft: 'foot',
  footchitty: 'foot',
  banchan: 'foot',

  // CRL
  crl: 'crl',
  'c.r.l': 'crl',
  crownrump: 'crl',
  daumong: 'crl',

  // NT
  nt: 'nt',
  'n.t': 'nt',
  nuchaltranslucency: 'nt',
  dagay: 'nt',
  domodagay: 'nt',

  // GS
  gs: 'gs',
  'g.s': 'gs',
  gestationalsac: 'gs',
  tuithai: 'gs',

  // YS
  ys: 'ys',
  'y.s': 'ys',
  yolksac: 'ys',
  noanhoang: 'ys',

  // OFD
  ofd: 'ofd',
  'o.f.d': 'ofd',
  trancham: 'ofd',

  // Cervix Length
  cervixlength: 'cervixLength',
  cervix: 'cervixLength',
  cl: 'cervixLength',
  'c.l': 'cervixLength',
  kenhctc: 'cervixLength',
  cotucung: 'cervixLength',
};

// Clean helper to extract measurement key by stripping parenthetical/bracketed methods
export function getCanonicalMeasurementKey(rawKey: string): keyof Measurements2D | null {
  if (!rawKey) return null;

  const trimmed = rawKey.trim();

  // Reject calculations / ratios (HC/AC, FL/AC, FL/BPD, FL/HC, Campbell, etc.)
  if (/\b(?:hc[\s\/]*ac|fl[\s\/]*ac|fl[\s\/]*bpd|fl[\s\/]*hc|bpd[\s\/]*ofd|campbell|ratio)\b/i.test(trimmed)) {
    return null;
  }

  // Reject strings that are pure numbers or numbers with units (e.g. "1.07 cm", "65 g", "120/80")
  if (/^\d+(?:[\.,]\d+)?\s*(?:cm|mm|g|kg|bpm|\%)?$/i.test(trimmed)) {
    return null;
  }
  // Reject measurement value strings ending with unit cm unless explicit Cisterna Magna / Bể lớn / CM key
  if (/\d+(?:[\.,]\d+)?\s*cm$/i.test(trimmed) && !/cisterna|belon|^cm\b/i.test(trimmed)) {
    return null;
  }

  // 1. Strip parenthetical method text: e.g. "BPD (Hadlock)" -> "BPD", "HC [INTERGRW]" -> "HC"
  const stripped = trimmed
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .toLowerCase()
    .replace(/[\s\.\-_]/g, '');

  if (MEASUREMENT_KEY_MAP[stripped]) {
    return MEASUREMENT_KEY_MAP[stripped];
  }

  // 2. Fallback: try direct cleaned raw string
  const direct = trimmed.toLowerCase().replace(/[\s\.\-_]/g, '');
  if (MEASUREMENT_KEY_MAP[direct]) {
    return MEASUREMENT_KEY_MAP[direct];
  }

  // 3. Fallback: try stripping numbers and units e.g. "cm5.92mm" -> "cm"
  const strippedNoNum = stripped.replace(/[\d\.,]+/g, '').replace(/(mm|cm)$/g, '');
  if (MEASUREMENT_KEY_MAP[strippedNoNum]) {
    return MEASUREMENT_KEY_MAP[strippedNoNum];
  }

  return null;
}

export function createCleanMeasurements(): Measurements2D {
  return {
    gs: { value: null, unit: 'mm', name: 'Đường kính túi thai (GS)' },
    ys: { value: null, unit: 'mm', name: 'Túi noãn hoàng (YS)' },
    crl: { value: null, unit: 'mm', name: 'Chiều dài đầu mông (CRL)' },
    nt: { value: null, unit: 'mm', name: 'Độ mờ da gáy (NT)' },
    bpd: { value: null, unit: 'mm', name: 'Đường kính lưỡng đỉnh (BPD)' },
    ofd: { value: null, unit: 'mm', name: 'Đường kính trán chẩm (OFD)' },
    hc: { value: null, unit: 'mm', name: 'Chu vi đầu (HC)' },
    ac: { value: null, unit: 'mm', name: 'Chu vi bụng (AC)' },
    fl: { value: null, unit: 'mm', name: 'Chiều dài xương đùi (FL)' },
    hl: { value: null, unit: 'mm', name: 'Chiều dài xương cánh tay (HL)' },
    tcd: { value: null, unit: 'mm', name: 'Đường kính ngang tiểu não (TCD)' },
    cm: { value: null, unit: 'mm', name: 'Bể lớn hố sau (CM)' },
    vp: { value: null, unit: 'mm', name: 'Não thất bên (Vp)' },
    nbl: { value: null, unit: 'mm', name: 'Chiều dài xương mũi (NBL)' },
    bod: { value: null, unit: 'mm', name: 'Đường kính 2 hốc mắt (BOD)' },
    foot: { value: null, unit: 'mm', name: 'Chiều dài bàn chân (Foot)' },
    cervixLength: { value: null, unit: 'mm', name: 'Chiều dài kênh cổ tử cung (Cervix Length)' },
  };
}

export function createCleanDoppler(): DopplerValues {
  return {
    fhr: { value: null, unit: 'bpm', name: 'Ventricular FHR' },
    leftUterine: { ps: null, ed: null, ri: null, pi: null, sd: null, tamax: null, taMax: null, md: null, hr: null },
    rightUterine: { ps: null, ed: null, ri: null, pi: null, sd: null, tamax: null, taMax: null, md: null, hr: null },
    umbilicalArtery: { ps: null, ed: null, ri: null, pi: null, sd: null, tamax: null, taMax: null, md: null, hr: null },
    middleCerebralArtery: { ps: null, ed: null, ri: null, pi: null, sd: null, psv: null, tamax: null, taMax: null, md: null, hr: null },
    ductusVenosus: { s: null, tamax: null, a: null, d: null, pi: null, sa: null, aS: null, pviv: null, pli: null, hr: null },
  };
}

export function createCleanAmniotic(): AmnioticFluidData {
  return {
    q1: { value: null, unit: 'mm' },
    q2: { value: null, unit: 'mm' },
    q3: { value: null, unit: 'mm' },
    q4: { value: null, unit: 'mm' },
    afi: { value: null, unit: 'mm' },
    sdp: { value: null, unit: 'cm' },
    status: 'Bình thường',
  };
}

// Clean helper to extract numeric value from string or number (preserves negative signs)
export function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    return isNaN(raw) ? null : raw;
  }
  if (typeof raw === 'string') {
    const normalizedStr = raw
      .replace(/[−–—]/g, '-')
      .replace(/-\s+(\d)/g, '-$1')
      .replace(/,/g, '.');
    const match = normalizedStr.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? null : num;
    }
    return null;
  }
  return null;
}

// Clean helper for EFW in grams
export function parseEfwValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (raw < 10 && raw > 0.03) return Math.round(raw * 1000); // in kg -> g
    return Math.round(raw);
  }
  if (typeof raw === 'string') {
    const isKg = /kg/i.test(raw);
    const cleaned = raw.replace(/,/g, '.').replace(/[^\d\.]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    if (isKg || (num < 10 && num > 0.03)) {
      return Math.round(num * 1000);
    }
    return Math.round(num);
  }
  return null;
}

// Validation function that logs raw AI output against expected schema to pinpoint parsing failures
export function validateAndLogExtractedData(
  extracted: any,
  normalized: UltrasoundReport
): UltrasoundValidationLog {
  const mappedFields: string[] = [];
  const unmappedKeys: string[] = [];
  const warnings: string[] = [];

  // 1. Check mapped patient info
  if (normalized.patient.name) mappedFields.push('patient.name');
  if (normalized.patient.patientId) mappedFields.push('patient.patientId');
  if (normalized.patient.gaClin) mappedFields.push('patient.gaClin');
  if (normalized.patient.edd) mappedFields.push('patient.edd');
  if (normalized.patient.sonographer) mappedFields.push('patient.sonographer');
  if (normalized.patient.examDate) mappedFields.push('patient.examDate');

  // 2. Check 2D measurements
  Object.keys(normalized.measurements).forEach((mKey) => {
    const item = normalized.measurements[mKey as keyof Measurements2D];
    if (item && item.value !== null && item.value !== undefined) {
      mappedFields.push(`measurements.${mKey}`);
    }
  });

  // 3. Check EFW
  if (normalized.efw.value) mappedFields.push('efw.value');

  // 4. Check Doppler & Amniotic Fluid
  if (normalized.doppler.fhr.value) mappedFields.push('doppler.fhr');
  if (normalized.amnioticFluid.afi.value) mappedFields.push('amnioticFluid.afi');
  if (normalized.amnioticFluid.sdp.value) mappedFields.push('amnioticFluid.sdp');
  if (normalized.amnioticFluid.q1.value) mappedFields.push('amnioticFluid.q1');

  // 5. Detect raw keys that were unmapped or ignored
  const scanUnmappedKeys = (obj: any, parentPrefix = '') => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach((k) => {
      const fullPath = parentPrefix ? `${parentPrefix}.${k}` : k;
      const cleanKey = k.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s\.\-_]/g, '');

      const isTopLevelKnown = [
        'patient', 'patientname', 'patientid', 'measurements', 'efw', 'doppler',
        'amnioticfluid', 'placenta', 'conclusion', 'recommendations', 'gaclin',
        'gaaua', 'edd', 'doc', 'lmp', 'sonographer', 'clinicheader', 'phone',
        'yearofbirth', 'age', 'fhr', 'rawtextdump', 'success', 'data', 'calculations',
        'examdate'
      ].includes(cleanKey);

      const isMeasurementKnown = !!getCanonicalMeasurementKey(k);

      if (!isTopLevelKnown && !isMeasurementKnown) {
        unmappedKeys.push(fullPath);
      }
    });
  };

  scanUnmappedKeys(extracted);
  if (extracted?.measurements) {
    scanUnmappedKeys(extracted.measurements, 'measurements');
  }

  // 6. Clinical & Parsing warnings
  if (!normalized.patient.patientId) {
    warnings.push('Thiếu Patient ID (Mã BN) trong kết quả trích xuất.');
  }
  if (!normalized.measurements.bpd?.value && !normalized.measurements.ac?.value) {
    warnings.push('Chưa tìm thấy chỉ số sinh trắc học 2D chính (BPD/AC) trong ảnh.');
  }
  if (!normalized.efw.value) {
    warnings.push('Không có EFW trực tiếp từ ảnh, hệ thống tự động tính EFW bằng công thức Hadlock.');
  }

  const validationLog: UltrasoundValidationLog = {
    timestamp: new Date().toISOString(),
    mappedFieldsCount: mappedFields.length,
    mappedFields,
    unmappedKeys: Array.from(new Set(unmappedKeys)),
    warnings,
    rawExtractedData: extracted,
  };

  // Log to browser developer console
  if (typeof console !== 'undefined' && console.group) {
    console.group(`🔍 [OCR Schema Validation] ${validationLog.timestamp}`);
    console.log(`✅ Chỉ số trích xuất khớp Schema thành công (${validationLog.mappedFieldsCount}):`, mappedFields);
    if (validationLog.unmappedKeys.length > 0) {
      console.warn(`⚠️ Key lạ từ AI/OCR chưa được map (${validationLog.unmappedKeys.length}):`, validationLog.unmappedKeys);
    }
    if (validationLog.warnings.length > 0) {
      console.info(`ℹ️ Thông báo kiểm định:`, validationLog.warnings);
    }
    console.log(`📦 Raw AI/OCR Data Output:`, extracted);
    console.groupEnd();
  }

  return validationLog;
}

// Normalize any raw extracted data into fully typed UltrasoundReport
export function normalizeExtractedData(
  extracted: any,
  currentReport: UltrasoundReport,
  sourceImages: string[] = [],
  mode: 'online_ai' | 'offline_ocr' = 'online_ai'
): UltrasoundReport {
  if (!extracted || typeof extracted !== 'object') {
    return currentReport;
  }

  // 1. Patient info extraction & normalization
  const rawId = 
    extracted.patientId || 
    extracted.patient?.patientId || 
    extracted.patId || 
    extracted.Pat_ID || 
    extracted['Pat. ID'] || 
    extracted['Pat.ID'] || 
    extracted.id || 
    currentReport.patient.patientId;

  let rawName = 
    extracted.patientName || 
    extracted.patient?.name || 
    extracted.name || 
    extracted.Name || 
    currentReport.patient.name;

  let extractedYearOfBirth = 
    extracted.yearOfBirth || 
    extracted.patient?.yearOfBirth || 
    currentReport.patient.yearOfBirth || 
    '';

  // Extract trailing birth year from Name string if present e.g. "DUONG THI THU HUYEN 1989"
  if (rawName && typeof rawName === 'string') {
    const yearMatch = rawName.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      if (!extractedYearOfBirth) {
        extractedYearOfBirth = yearMatch[1];
      }
      rawName = rawName.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();
    }
  }

  // Auto-resolve Vietnamese accented name from Patient ID
  if (rawId) {
    const formatted = formatPatientVietnameseName(rawName, rawId);
    if (formatted) rawName = formatted;
  } else if (rawName) {
    rawName = formatPatientVietnameseName(rawName);
  }

  const rawTextDumpCombined = `${extracted.rawTextDump || ''} ${extracted.rawText || ''} ${extracted.raw_text_dump || ''} ${extracted.text || ''}`;
  
  const datingResolution = resolvePregnancyDating({
    rawText: rawTextDumpCombined,
    examDate: extracted.examDate || extracted.patient?.examDate || currentReport.patient.examDate,
    extractedPatient: extracted.patient || {},
    extractedGaClin: extracted.gaClin || extracted.ga_edd || extracted.gaEdd || extracted['GA(EDD)'] || extracted.patient?.gaClin || currentReport.patient.gaClin,
    extractedEdd: extracted.edd || extracted.EDD || extracted.patient?.edd || currentReport.patient.edd,
    extractedGaAua: extracted.gaAua || extracted.ga_aua || extracted['GA(AUA)'] || extracted.patient?.gaAua || currentReport.patient.gaAua,
    extractedEddAua: extracted.eddAua || extracted['EDD(AUA)'],
    extractedDoc: extracted.doc || extracted.DOC || extracted.patient?.doc || currentReport.patient.doc,
    extractedLmp: extracted.lmp || extracted.LMP || extracted.patient?.lmp || currentReport.patient.lmp,
    pregnancyDating: extracted.pregnancyDating || currentReport.pregnancyDating,
  });

  const updatedPatient: PatientInfo = {
    ...currentReport.patient,
    name: rawName || '',
    patientId: rawId || '',
    phone: extracted.phone || extracted.patient?.phone || currentReport.patient.phone || rawId || '',
    yearOfBirth: extractedYearOfBirth,
    age: extracted.age || extracted.patient?.age || currentReport.patient.age || '',
    address: extracted.address || extracted.patient?.address || currentReport.patient.address || '',
    examDate: extracted.examDate || extracted.patient?.examDate || currentReport.patient.examDate || '',
    gaClin: datingResolution.finalGA || extracted.gaClin || extracted.ga_edd || extracted.gaEdd || extracted['GA(EDD)'] || extracted.patient?.gaClin || currentReport.patient.gaClin || '',
    ga: datingResolution.finalGA || extracted.ga || extracted.patient?.ga || currentReport.patient.ga || '',
    gaAua: extracted.gaAua || extracted.ga_aua || extracted['GA(AUA)'] || extracted.patient?.gaAua || currentReport.patient.gaAua || '',
    edd: datingResolution.finalEDD || extracted.edd || extracted.EDD || extracted.patient?.edd || currentReport.patient.edd || '',
    doc: datingResolution.transferDate || extracted.doc || extracted.DOC || extracted.patient?.doc || currentReport.patient.doc || '',
    lmp: extracted.lmp || extracted.LMP || extracted.patient?.lmp || currentReport.patient.lmp || '',
    sonographer: extracted.sonographer || extracted.sonogr || extracted['Sonogr.'] || extracted.patient?.sonographer || currentReport.patient.sonographer || '',
    clinicHeader: extracted.clinicHeader || extracted.header || extracted.patient?.clinicHeader || currentReport.patient.clinicHeader || '',
    indication: extracted.indication || extracted.patient?.indication || currentReport.patient.indication || '',
    gravida: extracted.gravida || extracted.patient?.gravida || currentReport.patient.gravida || '',
    para: extracted.para || extracted.patient?.para || currentReport.patient.para || '',
    datingSource: datingResolution.datingSource || currentReport.patient.datingSource,
    gaSource: datingResolution.gaSource || currentReport.patient.gaSource,
    eddSource: datingResolution.eddSource || currentReport.patient.eddSource,
    transferDate: datingResolution.transferDate || currentReport.patient.transferDate,
    embryoDay: datingResolution.embryoDay || currentReport.patient.embryoDay,
  };

  // Derive age from year of birth if missing
  if (updatedPatient.yearOfBirth && !updatedPatient.age) {
    const y = parseInt(updatedPatient.yearOfBirth, 10);
    if (!isNaN(y) && y > 1930) {
      updatedPatient.age = String(new Date().getFullYear() - y);
    }
  }

  // Save to persistent patient directory
  if (updatedPatient.patientId && updatedPatient.name) {
    savePatientToDirectory({
      id: updatedPatient.patientId,
      name: updatedPatient.name,
      yearOfBirth: updatedPatient.yearOfBirth,
      phone: updatedPatient.phone,
    });
  }

  // 2. Fetal Weight (EFW) normalization (DONE FIRST to help sanitize biometry)
  const rawEfw = extracted.efw || extracted.EFW || extracted.fetalWeight || {};
  let efwVal: number | null = null;
  let efwRange: string | undefined;
  let efwPercentile: string | undefined;
  let efwGaAge: string | undefined;
  let efwMethod: string | undefined;
  let efwFormula: string | undefined;

  if (typeof rawEfw === 'number' || typeof rawEfw === 'string') {
    efwVal = parseEfwValue(rawEfw);
  } else if (typeof rawEfw === 'object' && rawEfw !== null) {
    efwVal = parseEfwValue(rawEfw.value ?? rawEfw.val ?? rawEfw.weight);
    efwRange = rawEfw.range;
    efwPercentile = rawEfw.percentile ?? rawEfw.gp ?? rawEfw.pct ?? rawEfw.percent;
    efwGaAge = rawEfw.gaAge ?? rawEfw.age ?? rawEfw.ga;
    efwMethod = rawEfw.method;
    efwFormula = rawEfw.formula;
  }

  if (!efwPercentile) {
    efwPercentile = extracted.efwPercentile || extracted.efwGp || extracted.EfwGp || extracted.EFWPercentile || extracted.EFWGp || extracted.efw_percentile || extracted.efw_gp;
  }

  let formattedEfwPercentile: string = '';
  if (efwPercentile !== undefined && efwPercentile !== null && efwPercentile !== '') {
    const pStr = String(efwPercentile).trim();
    const pMatch = pStr.match(/(?:GP|percentile|pct)?\s*[:=]?\s*([<>]=?\s*\d+(?:[\.,]\d+)?|\d+(?:[\.,]\d+)?)\s*%?/i);
    if (pMatch) {
      let pctVal = pMatch[1].replace(/\s+/g, '').replace(',', '.');
      if (!pctVal.includes('%')) pctVal = `${pctVal}%`;
      formattedEfwPercentile = pctVal;
    } else {
      formattedEfwPercentile = pStr;
    }
  } else if (currentReport.efw?.percentile) {
    formattedEfwPercentile = currentReport.efw.percentile;
  }

  let updatedEfw: FetalWeightEFW = {
    value: efwVal,
    unit: 'g',
    range: efwRange || (currentReport.efw?.range ?? '± 110g'),
    percentile: formattedEfwPercentile,
    gaAge: efwGaAge || currentReport.efw?.gaAge || '',
    method: efwMethod || currentReport.efw?.method || 'Hadlock 3',
    formula: efwFormula || currentReport.efw?.formula || 'Hadlock 3 (AC/FL/HC)',
    isExtracted: efwVal !== null,
    source: efwVal !== null ? 'report' : currentReport.efw?.source,
  };

  // 3. Calculations / Ratios (HC/AC, FL/AC, FL/BPD, FL/HC, CI)
  const updatedCalculations: CalculatedRatios = {
    ...(currentReport.calculations || {}),
    ...(extracted.calculations || {}),
  };

  // Scan top-level keys for calculations
  Object.keys(extracted).forEach((k) => {
    const kLower = k.toLowerCase().replace(/[\s\.\-_]/g, '');
    if (kLower === 'hcac' || kLower === 'hc/ac' || kLower === 'campbell') {
      updatedCalculations.hcAc = parseNumericValue(extracted[k]) ?? extracted[k];
    } else if (kLower === 'flac' || kLower === 'fl/ac') {
      updatedCalculations.flAc = parseNumericValue(extracted[k]) ?? extracted[k];
    } else if (kLower === 'flbpd' || kLower === 'fl/bpd') {
      updatedCalculations.flBpd = parseNumericValue(extracted[k]) ?? extracted[k];
    } else if (kLower === 'flhc' || kLower === 'fl/hc') {
      updatedCalculations.flHc = parseNumericValue(extracted[k]) ?? extracted[k];
    } else if (kLower === 'ci' || kLower === 'bpdofd') {
      updatedCalculations.ci = parseNumericValue(extracted[k]) ?? extracted[k];
    }
  });

  // 4. Biometry 2D measurements normalization (RESET to fresh clean session)
  const updatedMeasurements: Measurements2D = createCleanMeasurements();
  const pipelineLog: UltrasoundValidationLog = {
    timestamp: new Date().toISOString(),
    mappedFieldsCount: 0,
    mappedFields: [],
    unmappedKeys: [],
    warnings: [],
    rawExtractedData: extracted,
  };

  // Helper to ingest single measurement item
  const ingestMeasurement = (rawKey: string, rawVal: any) => {
    if (rawVal === null || rawVal === undefined || rawVal === '') return;

    // Check if rawKey is actually a Calculation / Ratio
    const kLower = rawKey.toLowerCase().replace(/[\s\.\-_]/g, '');
    if (
      kLower.includes('hcac') ||
      kLower.includes('hc/ac') ||
      kLower.includes('flac') ||
      kLower.includes('fl/ac') ||
      kLower.includes('flbpd') ||
      kLower.includes('fl/bpd') ||
      kLower.includes('flhc') ||
      kLower.includes('fl/hc') ||
      kLower.includes('campbell')
    ) {
      if (kLower.includes('hcac') || kLower.includes('campbell')) updatedCalculations.hcAc = parseNumericValue(rawVal) ?? rawVal;
      if (kLower.includes('flac')) updatedCalculations.flAc = parseNumericValue(rawVal) ?? rawVal;
      if (kLower.includes('flbpd')) updatedCalculations.flBpd = parseNumericValue(rawVal) ?? rawVal;
      if (kLower.includes('flhc')) updatedCalculations.flHc = parseNumericValue(rawVal) ?? rawVal;
      return;
    }

    const canonicalKey = getCanonicalMeasurementKey(rawKey);
    if (!canonicalKey || !updatedMeasurements[canonicalKey]) {
      pipelineLog.unmappedKeys.push(`${rawKey}: ${JSON.stringify(rawVal)}`);
      return;
    }

    let numVal: number | null = null;
    let unit = 'mm';
    let gaAge: string | undefined;
    let percentile: string | undefined;
    let method: string | undefined;
    let m1Val: number | null = null;

    if (typeof rawVal === 'number' || typeof rawVal === 'string') {
      numVal = parseNumericValue(rawVal);
    } else if (typeof rawVal === 'object') {
      numVal = parseNumericValue(rawVal.value ?? rawVal.val ?? rawVal.num);
      m1Val = parseNumericValue(rawVal.m1);
      unit = rawVal.unit || 'mm';
      gaAge = rawVal.gaAge || rawVal.age || rawVal.ga;
      percentile = rawVal.percentile || rawVal.gp || rawVal.pct;
      method = rawVal.method || rawVal.meth || rawVal.standard;
    }

    // Apply rigorous normalizer
    const normResult = normalizeMeasurementValue({
      key: canonicalKey,
      rawValue: numVal,
      rawText: `${rawKey}: ${numVal}`,
      label: rawKey,
      unit,
      efwVal: updatedEfw.value,
    });

    if (normResult.value !== null && normResult.isExtracted) {
      updatedMeasurements[canonicalKey] = {
        ...updatedMeasurements[canonicalKey],
        value: normResult.value,
        m1: m1Val !== null ? m1Val : normResult.value,
        unit: unit,
        gaAge: gaAge || updatedMeasurements[canonicalKey]?.gaAge,
        percentile: percentile || updatedMeasurements[canonicalKey]?.percentile,
        method: method || updatedMeasurements[canonicalKey]?.method,
        isExtracted: true,
        sourceEvidence: `${rawKey}: ${numVal} -> ${normResult.value} ${unit}`,
      };
      pipelineLog.mappedFieldsCount++;
      pipelineLog.mappedFields.push(`${rawKey} -> ${canonicalKey} = ${normResult.value}`);
    } else if (numVal !== null) {
      pipelineLog.warnings.push(`Từ chối giá trị ${rawKey} = ${numVal} vì không hợp lệ / trùng EFW weight`);
      // Phase 3 (CM only): a rejected CM (e.g. out-of-range raw OCR like "592")
      // must not silently disappear — sourceEvidence has to survive so a
      // clinician can see what OCR actually read and decide manually.
      // Scoped strictly to 'cm' so no other measurement's behavior changes.
      if (canonicalKey === 'cm') {
        updatedMeasurements[canonicalKey] = {
          ...updatedMeasurements[canonicalKey],
          value: null,
          isExtracted: false,
          sourceEvidence: `${rawKey}: ${numVal} ${unit} [ngoài khoảng hợp lệ 1.0-18.0mm — giữ nguyên OCR gốc, không tự suy đoán dấu thập phân]`,
        };
      }
    }
  };

  // Search in extracted.measurements
  if (extracted.measurements && typeof extracted.measurements === 'object') {
    Object.keys(extracted.measurements).forEach((k) => {
      ingestMeasurement(k, extracted.measurements[k]);
    });
  }

  // Also check top-level keys in extracted (e.g. extracted.bpd, extracted.cereb, extracted.hc)
  Object.keys(extracted).forEach((k) => {
    if (k !== 'measurements' && k !== 'patient' && k !== 'doppler' && k !== 'efw' && k !== 'amnioticFluid' && k !== 'calculations') {
      if (getCanonicalMeasurementKey(k)) {
        ingestMeasurement(k, extracted[k]);
      }
    }
  });

  // If EFW is not in ultrasound report, calculate automatically from AC, FL, HC, BPD
  if (!updatedEfw.value && updatedMeasurements.ac?.value && updatedMeasurements.fl?.value) {
    const calc = calculateHadlockEFW(
      updatedMeasurements.ac.value,
      updatedMeasurements.fl.value,
      updatedMeasurements.bpd?.value || null,
      updatedMeasurements.hc?.value || null
    );
    if (calc.efwGrams) {
      updatedEfw = {
        ...updatedEfw,
        value: calc.efwGrams,
        range: `± ${calc.rangeGrams}g`,
        formula: calc.formulaUsed || 'Hadlock 3 (HC, AC, FL)',
        method: 'Hadlock 3',
        source: 'calculated',
      };
    }
  }

  // 5. Doppler normalization (RESET to fresh clean session)
  const rawDoppler = extracted.doppler || {};
  let fhrVal: number | null = parseNumericValue(
    extracted.ventricularFHR ||
    rawDoppler.ventricularFHR ||
    extracted.fhr || 
    extracted.FHR || 
    rawDoppler.fhr?.value || 
    rawDoppler.fhr || 
    extracted.measurements?.fhr?.value || 
    extracted.measurements?.fhr
  );

  const cleanDoppler = createCleanDoppler();

  const mergeVessel = (cleanVessel: any, ...rawVesselList: any[]) => {
    let result = { ...cleanVessel };
    for (const rawVessel of rawVesselList) {
      if (!rawVessel || typeof rawVessel !== 'object') continue;
      const ps = normalizeDopplerVelocity(parseNumericValue(rawVessel.ps ?? rawVessel.PS ?? rawVessel.psv ?? rawVessel.PSV));
      const ed = normalizeDopplerVelocity(parseNumericValue(rawVessel.ed ?? rawVessel.ED));
      const tamax = normalizeDopplerVelocity(parseNumericValue(rawVessel.tamax ?? rawVessel.taMax ?? rawVessel.TAmax ?? rawVessel.TAMax));
      const md = normalizeDopplerVelocity(parseNumericValue(rawVessel.md ?? rawVessel.MD));
      const ri = normalizeDopplerIndex(parseNumericValue(rawVessel.ri ?? rawVessel.RI), 'ri');
      const pi = normalizeDopplerIndex(parseNumericValue(rawVessel.pi ?? rawVessel.PI ?? rawVessel.pl ?? rawVessel.Pl), 'pi');
      const sd = normalizeDopplerIndex(parseNumericValue(rawVessel.sd ?? rawVessel.sD ?? rawVessel.SD ?? rawVessel['S/D'] ?? rawVessel['s/d'] ?? rawVessel['S-D']), 'sd');
      const hr = parseNumericValue(rawVessel.hr ?? rawVessel.HR ?? rawVessel.heartRate);
      const psv = normalizeDopplerVelocity(parseNumericValue(rawVessel.psv ?? rawVessel.PSV ?? rawVessel.ps ?? rawVessel.PS));

      const s = normalizeDopplerVelocity(parseNumericValue(rawVessel.s ?? rawVessel.S));
      const a = normalizeDopplerVelocity(parseNumericValue(rawVessel.a ?? rawVessel.A ?? rawVessel.aWave));
      const d = normalizeDopplerVelocity(parseNumericValue(rawVessel.d ?? rawVessel.D));
      const sa = parseNumericValue(rawVessel.sa ?? rawVessel.sA ?? rawVessel['S/a'] ?? rawVessel['S/A'] ?? rawVessel['S-a']);
      const aS = parseNumericValue(rawVessel.as ?? rawVessel.aS ?? rawVessel.As ?? rawVessel['a/S'] ?? rawVessel['A/S'] ?? rawVessel['a-S']);
      const pviv = parseNumericValue(rawVessel.pviv ?? rawVessel.PVIV);
      const pli = parseNumericValue(rawVessel.pli ?? rawVessel.PLI);

      if (ps !== null && ps !== undefined) result.ps = ps;
      if (ed !== null && ed !== undefined) result.ed = ed;
      if (s !== null && s !== undefined) result.s = s;
      if (a !== null && a !== undefined) result.a = a;
      if (d !== null && d !== undefined) result.d = d;
      if (sa !== null && sa !== undefined) result.sa = sa;
      if (aS !== null && aS !== undefined) result.aS = aS;
      if (pviv !== null && pviv !== undefined) result.pviv = pviv;
      if (pli !== null && pli !== undefined) result.pli = pli;
      if (tamax !== null && tamax !== undefined) {
        result.tamax = tamax;
        result.taMax = tamax;
      }
      if (md !== null && md !== undefined) result.md = md;
      if (ri !== null && ri !== undefined) result.ri = ri;
      if (pi !== null && pi !== undefined) result.pi = pi;
      if (sd !== null && sd !== undefined) {
        result.sd = sd;
        result.sD = sd;
      }
      if (hr !== null && hr !== undefined && hr > 40 && hr < 350) {
        result.hr = hr;
      }
      if (psv !== null && psv !== undefined) {
        result.psv = psv;
      }
    }
    return result;
  };

  const updatedDoppler: DopplerValues = {
    ...cleanDoppler,
    leftUterine: mergeVessel(
      cleanDoppler.leftUterine,
      rawDoppler.leftUterine,
      rawDoppler.leftUtA,
      rawDoppler['Left Uterine'],
      rawDoppler['Left Uterine Artery'],
      extracted.leftUterine,
      extracted.leftUtA
    ),
    rightUterine: mergeVessel(
      cleanDoppler.rightUterine,
      rawDoppler.rightUterine,
      rawDoppler.rightUtA,
      rawDoppler['Right Uterine'],
      rawDoppler['Right Uterine Artery'],
      extracted.rightUterine,
      extracted.rightUtA
    ),
    umbilicalArtery: mergeVessel(
      cleanDoppler.umbilicalArtery,
      rawDoppler.umbilicalArtery,
      rawDoppler.umbilical,
      rawDoppler.umbilicalArt,
      rawDoppler.ua,
      rawDoppler['Umbilical Art.'],
      rawDoppler['Umbilical Art'],
      rawDoppler['Umbilical Artery'],
      extracted.umbilicalArtery,
      extracted.umbilicalArt,
      extracted.umbilical,
      extracted.ua,
      extracted['Umbilical Art.']
    ),
    middleCerebralArtery: mergeVessel(
      cleanDoppler.middleCerebralArtery,
      rawDoppler.middleCerebralArtery,
      rawDoppler.rightMidCerebArtery,
      rawDoppler.leftMidCerebArtery,
      rawDoppler.midCerebArtery,
      rawDoppler.mca,
      rawDoppler.middleCerebral,
      rawDoppler['Right Mid Cereb Artery'],
      rawDoppler['Left Mid Cereb Artery'],
      rawDoppler['Mid Cereb Artery'],
      rawDoppler['Middle Cerebral Artery'],
      extracted.middleCerebralArtery,
      extracted.rightMidCerebArtery,
      extracted.leftMidCerebArtery,
      extracted.midCerebArtery,
      extracted.mca,
      extracted['Right Mid Cereb Artery']
    ),
    ductusVenosus: mergeVessel(
      cleanDoppler.ductusVenosus,
      rawDoppler.ductusVenosus,
      rawDoppler.dv,
      extracted.ductusVenosus,
      extracted.dv
    ),
    fhr: {
      ...cleanDoppler.fhr,
      value: fhrVal,
      unit: 'bpm',
      isExtracted: fhrVal !== null,
    },
    // Phase 5 fix: `calculations` (DopplerCalculationsGroup — UA/MCA/CPR/Ut/DV
    // calculation rows, populated by parseDopplerCalculations in
    // stitchedOcrPipeline.ts / multiImageOcrPipeline.ts) was previously never
    // read here at all, so it was silently dropped every time a report went
    // through normalization — even when the upstream pipelines correctly
    // produced it. Passed through from rawDoppler.calculations (merged over
    // whatever the report already had, so an OCR pass with no Doppler
    // Calculations section doesn't wipe out previously extracted ones).
    calculations:
      rawDoppler.calculations && Object.keys(rawDoppler.calculations).length > 0
        ? { ...(currentReport.doppler?.calculations || {}), ...rawDoppler.calculations }
        : currentReport.doppler?.calculations,
  };

  // 6. Amniotic Fluid & Placenta (RESET to fresh clean session)
  const rawAmnio = extracted.amnioticFluid || {};
  const parseAmiItem = (item: any, defaultUnit = 'mm') => {
    if (item === null || item === undefined) return { value: null, unit: defaultUnit };
    let val: number | null = null;
    let unit = defaultUnit;

    if (typeof item === 'number' || typeof item === 'string') {
      val = parseNumericValue(item);
    } else if (typeof item === 'object') {
      val = parseNumericValue(item.value ?? item.val);
      unit = item.unit || defaultUnit;
    }

    if (val !== null) {
      // If AFI value is in cm (e.g. 18.29 cm), convert to mm (182.9 mm)
      if (defaultUnit === 'mm' && (unit.toLowerCase() === 'cm' || (val < 35 && val > 3))) {
        val = Math.round(val * 10 * 10) / 10;
        unit = 'mm';
      }
    }

    return { value: val, unit, isExtracted: val !== null };
  };

  const cleanAmniotic = createCleanAmniotic();
  const updatedAmniotic: AmnioticFluidData = {
    ...cleanAmniotic,
    q1: parseAmiItem(rawAmnio.q1 || extracted.q1, 'mm'),
    q2: parseAmiItem(rawAmnio.q2 || extracted.q2, 'mm'),
    q3: parseAmiItem(rawAmnio.q3 || extracted.q3, 'mm'),
    q4: parseAmiItem(rawAmnio.q4 || extracted.q4, 'mm'),
    afi: parseAmiItem(rawAmnio.afi || extracted.afi, 'mm'),
    sdp: parseAmiItem(rawAmnio.sdp || rawAmnio.mvp || extracted.sdp, 'mm'),
    status: rawAmnio.status || cleanAmniotic.status,
  };

  const updatedPlacenta: PlacentaData = {
    ...currentReport.placenta,
    ...(extracted.placenta || {}),
  };

  // 7. Generate clinical conclusion if missing
  const autoConclusion = generateAutoConclusion(
    updatedPatient,
    updatedMeasurements,
    updatedEfw,
    updatedDoppler,
    updatedAmniotic,
    updatedPlacenta
  );

  const preliminary: UltrasoundReport = {
    ...currentReport,
    id: currentReport.id || ('report-' + Date.now()),
    patient: updatedPatient,
    measurements: updatedMeasurements,
    calculations: updatedCalculations,
    efw: updatedEfw,
    doppler: updatedDoppler,
    amnioticFluid: updatedAmniotic,
    placenta: updatedPlacenta,
    conclusion: extracted.conclusion || currentReport.conclusion || autoConclusion.conclusion,
    recommendations: extracted.recommendations || currentReport.recommendations || autoConclusion.recommendations,
    imageUrls: sourceImages.length > 0 ? sourceImages : currentReport.imageUrls,
    extractionSource: mode,
    updatedAt: new Date().toISOString(),
    pregnancyDating: datingResolution.isIvf
      ? {
          type: 'IVF',
          transferDate: datingResolution.transferDate || updatedPatient.doc,
          embryoAge: datingResolution.embryoDay || 5,
          ga: datingResolution.finalGA,
          edd: datingResolution.finalEDD,
          source: datingResolution.datingSource,
        }
      : (extracted.pregnancyDating || currentReport.pregnancyDating),
    originalOcrData: {
      patient: {
        name: updatedPatient.name,
        patientId: updatedPatient.patientId,
        yearOfBirth: updatedPatient.yearOfBirth,
        lmp: updatedPatient.lmp,
        gaClin: updatedPatient.gaClin,
        ga: updatedPatient.ga,
        edd: updatedPatient.edd,
        examDate: updatedPatient.examDate,
        datingSource: updatedPatient.datingSource,
        gaSource: updatedPatient.gaSource,
        eddSource: updatedPatient.eddSource,
        transferDate: updatedPatient.transferDate,
        embryoDay: updatedPatient.embryoDay,
      },
      measurements: Object.keys(updatedMeasurements).reduce((acc, key) => {
        acc[key] = updatedMeasurements[key as keyof Measurements2D]?.value ?? null;
        return acc;
      }, {} as Record<string, number | null>),
      efw: updatedEfw.value,
      fhr: updatedDoppler.fhr.value,
      uaPi: updatedDoppler.umbilicalArtery.pi ?? null,
      uaRi: updatedDoppler.umbilicalArtery.ri ?? null,
      mcaPi: updatedDoppler.middleCerebralArtery.pi ?? null,
      afi: updatedAmniotic.afi.value ?? null,
    }
  };

  // DEBUG BẮT BUỘC
  console.log("EFW RAW:", extracted.efw);
  console.log("EFW NORMALIZED:", preliminary.efw);
  console.log("EFW UI:", {
    value: preliminary.efw?.value,
    range: preliminary.efw?.range,
    gaAge: preliminary.efw?.gaAge,
    percentile: preliminary.efw?.percentile
  });

  // Run schema validation and log raw AI output vs expected schema
  const schemaValidationLog = validateAndLogExtractedData(extracted, preliminary);
  preliminary._validationLogs = {
    ...schemaValidationLog,
    mappedFieldsCount: pipelineLog.mappedFieldsCount,
    mappedFields: pipelineLog.mappedFields,
    unmappedKeys: pipelineLog.unmappedKeys,
    warnings: [...pipelineLog.warnings, ...schemaValidationLog.warnings],
  };

  // Automatically detect best matching form template
  const detected = detectBestTemplate(preliminary);
  return {
    ...preliminary,
    detectedCategory: detected.template.id,
  };
}

export const normalizeUltrasoundReport = normalizeExtractedData;
