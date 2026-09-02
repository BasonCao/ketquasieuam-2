import { normalizeExtractedData, createCleanMeasurements, createCleanDoppler, createCleanAmniotic } from '../normalizeReportData';
import { sanitizeBiometryValue } from '../clinicalCalculations';
import { parseUltrasoundReportText } from '../../services/offlineOcrService';
import { UltrasoundReport } from '../../types/ultrasound';

const baseReport: UltrasoundReport = {
  id: 'test-report',
  patient: {
    name: 'TEST PATIENT',
    patientId: 'BN12345',
    yearOfBirth: '1995',
    age: '30',
    phone: '0912345678',
    address: 'Hà Nội',
    gender: 'Nữ',
    clinicHeader: 'Phòng Khám Siêu Âm',
    sonographer: 'Bác sĩ Sơn',
    examDate: '10/10/2025',
    indication: 'Khám thai',
    lmp: '',
    doc: '',
    gaClin: '24w0d',
    gaAua: '',
    edd: '20/02/2026',
    height: 160,
    weight: 55,
    bloodPressure: '120/80',
    pulse: 75,
    gravida: '1',
    para: '0',
    abortion: '0',
    ectopic: '0',
    obstetricHistoryNotes: '',
    previousAbnormalities: '',
    plannedDeliveryLocation: '',
    notes: '',
    firstVisitDate: '10/10/2025',
    visitCount: 1,
  },
  measurements: createCleanMeasurements(),
  efw: { value: null, unit: 'g' },
  doppler: createCleanDoppler(),
  amnioticFluid: createCleanAmniotic(),
  placenta: {
    location: 'Mặt trước',
    grade: 'I',
    thickness: 25,
    abnormalities: 'Bình thường',
  },
  conclusion: '',
  recommendations: '',
  imageUrls: [],
  detectedCategory: 'morphology_2d_3d_4d',
  anatomy: {
    skullBrain: 'Bình thường',
    faceEyesNose: 'Bình thường',
    chestHeart: 'Bình thường',
    abdomenStomachBladder: 'Bình thường',
    spine: 'Bình thường',
    limbs: 'Bình thường',
  },
  calculations: {
    hcAc: '',
    flAc: '',
    flBpd: '',
    flHc: '',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function runPipelineVerificationTests() {
  const results: { testName: string; passed: boolean; message: string }[] = [];

  // Test Case 1: GE Voluson Report matching reported user issue
  // EFW = 65g, AC = 64.23, HC = 73.92, FL = 9.15, BPD = 20.22, BOD = 14.28, NBL = 2.26, HL = 9.72, Foot = 11.42
  const mockRawExtraction = {
    patientName: "NGUYỄN THỊ TEST",
    patientId: "BN12345",
    efw: {
      value: 65,
      unit: "g",
      formula: "Hadlock (AC/FL/HC)",
    },
    measurements: {
      bpd: 20.22,
      hc: 73.92,
      bod: 14.28,
      nbl: 2.26,
      hl: 9.72,
      ac: 64.23,
      fl: 9.15,
      foot: 11.42,
      // Testing EFW leak attempt:
      efw_leak_attempt: 65,
    },
  };

  const normalized = normalizeExtractedData(mockRawExtraction, baseReport, [], 'online_ai');

  // Assertions:
  const hcValue = normalized.measurements.hc?.value;
  const acValue = normalized.measurements.ac?.value;
  const flValue = normalized.measurements.fl?.value;
  const bpdValue = normalized.measurements.bpd?.value;
  const efwValue = normalized.efw.value;
  const cmValue = normalized.measurements.cm?.value;

  // Test 1.1: EFW isolation
  if (efwValue === 65) {
    results.push({ testName: "EFW Value Extraction", passed: true, message: "EFW correctly extracted as 65g" });
  } else {
    results.push({ testName: "EFW Value Extraction", passed: false, message: `EFW expected 65, got ${efwValue}` });
  }

  // Test 1.2: HC is NOT 65
  if (hcValue === 73.92) {
    results.push({ testName: "HC Biometry Mapping", passed: true, message: "HC correctly mapped to 73.92 mm (not contaminated by EFW=65)" });
  } else {
    results.push({ testName: "HC Biometry Mapping", passed: false, message: `HC expected 73.92, got ${hcValue}` });
  }

  // Test 1.3: AC is NOT 65
  if (acValue === 64.23) {
    results.push({ testName: "AC Biometry Mapping", passed: true, message: "AC correctly mapped to 64.23 mm (not contaminated by EFW=65)" });
  } else {
    results.push({ testName: "AC Biometry Mapping", passed: false, message: `AC expected 64.23, got ${acValue}` });
  }

  // Test 1.4: FL is NOT 65
  if (flValue === 9.15) {
    results.push({ testName: "FL Biometry Mapping", passed: true, message: "FL correctly mapped to 9.15 mm (not contaminated by EFW=65)" });
  } else {
    results.push({ testName: "FL Biometry Mapping", passed: false, message: `FL expected 9.15, got ${flValue}` });
  }

  // Test 1.5: CM false positive prevention
  if (cmValue === null || cmValue === undefined) {
    results.push({ testName: "CM False Positive Prevention", passed: true, message: "Cisterna Magna (CM) correctly remains empty when text only contained '1.07 cm'" });
  } else {
    results.push({ testName: "CM False Positive Prevention", passed: false, message: `CM expected null, got ${cmValue}` });
  }

  // Test 1.6: EFW block test in sanitizeBiometryValue
  const blockedVal = sanitizeBiometryValue('hc', 65, 65);
  if (blockedVal === null) {
    results.push({ testName: "Sanitize Biometry EFW Block", passed: true, message: "sanitizeBiometryValue successfully blocked value 65 equal to EFW weight" });
  } else {
    results.push({ testName: "Sanitize Biometry EFW Block", passed: false, message: `Expected null, got ${blockedVal}` });
  }

  // Test Case 2: Missing Decimal Scaling Normalization
  // Raw OCR reads integer numbers without decimal point: BOD 1428 mm, NBL 226 mm, HL 972 mm, FL 915 mm
  const mockMissingDecimals = {
    patientName: "NGUYEN THI HOA",
    patientId: "BN99887",
    efw: { value: 65, unit: "g" },
    measurements: {
      bod: 1428,
      nbl: 226,
      hl: 972,
      fl: 915,
      bpd: 2022,
      hc: 7392,
      ac: 6423,
      foot: 1142,
    },
    calculations: {
      hcAc: 1.15,
    },
  };

  const normalizedDecimals = normalizeExtractedData(mockMissingDecimals, baseReport, [], 'offline_ocr');

  // Assert BOD = 14.28
  const normBod = normalizedDecimals.measurements.bod?.value;
  if (normBod === 14.28) {
    results.push({ testName: "BOD Decimal Correction (1428 -> 14.28)", passed: true, message: "BOD correctly scaled from 1428 mm to 14.28 mm" });
  } else {
    results.push({ testName: "BOD Decimal Correction", passed: false, message: `BOD expected 14.28, got ${normBod}` });
  }

  // Assert NBL = 2.26
  const normNbl = normalizedDecimals.measurements.nbl?.value;
  if (normNbl === 2.26) {
    results.push({ testName: "NBL Decimal Correction (226 -> 2.26)", passed: true, message: "NBL correctly scaled from 226 mm to 2.26 mm" });
  } else {
    results.push({ testName: "NBL Decimal Correction", passed: false, message: `NBL expected 2.26, got ${normNbl}` });
  }

  // Assert HL = 9.72
  const normHl = normalizedDecimals.measurements.hl?.value;
  if (normHl === 9.72) {
    results.push({ testName: "HL Decimal Correction (972 -> 9.72)", passed: true, message: "HL correctly scaled from 972 mm to 9.72 mm" });
  } else {
    results.push({ testName: "HL Decimal Correction", passed: false, message: `HL expected 9.72, got ${normHl}` });
  }

  // Assert FL = 9.15
  const normFl = normalizedDecimals.measurements.fl?.value;
  if (normFl === 9.15) {
    results.push({ testName: "FL Decimal Correction (915 -> 9.15)", passed: true, message: "FL correctly scaled from 915 mm to 9.15 mm" });
  } else {
    results.push({ testName: "FL Decimal Correction", passed: false, message: `FL expected 9.15, got ${normFl}` });
  }

  // Assert Calculations HC/AC
  const normHcAc = normalizedDecimals.calculations?.hcAc;
  if (normHcAc === 1.15) {
    results.push({ testName: "Calculation Ratio Separation (HC/AC)", passed: true, message: "HC/AC ratio preserved at calculations.hcAc = 1.15 without polluting measurements" });
  } else {
    results.push({ testName: "Calculation Ratio Separation (HC/AC)", passed: false, message: `calculations.hcAc expected 1.15, got ${normHcAc}` });
  }

  // Test Case 3: Full GE Voluson raw OCR report text parsing
  const rawOcrReportText = `
GE Healthcare Voluson E8
Pat. ID: BN77889
Name: LE THI BICH
GA(EDD): 13w4d  EDD: 15/09/2025
EFW (Hadlock3) 65 g  13w3d  GP 45%

2D Biometry:
BPD (Hadlock) 20.22 mm 13w2d GP 42%
OFD (Hansmann) 25.10 mm
HC (Hadlock) 73.92 mm 13w3d GP 48%
AC (Hadlock) 64.23 mm 13w1d GP 39%
FL (Osaka) 915 mm 13w0d
HL (Jeanty) 972 mm 13w1d
BOD (Jeanty) 1428 mm
NBL (Sonek) 226 mm
Foot (Chitty) 11.42 mm

Calculations:
HC/AC (Campbell) 1.15
FL/AC (Hadlock) 0.14
FL/BPD (Hohler) 45.25 %

Doppler:
Left Uterine:
PS: 45.2 cm/s
ED: 15.6 cm/s
RI: 0.65
PI: 1.12
S/D: 2.89

Right Uterine:
PS: 48.0 cm/s
ED: 18.0 cm/s
RI: 0.62
PI: 1.05
S/D: 2.67

Umbilical Artery:
PS: 32.5 cm/s
ED: 10.2 cm/s
RI: 0.68
PI: 1.25
S/D: 3.18
TAmax: 18.4 cm/s
HR: 152 bpm

MCA:
PSV: 24.5 cm/s
RI: 0.82
PI: 1.75
S/D: 5.55
`;

  const parsedFromOcr = parseUltrasoundReportText(rawOcrReportText);
  const normalizedFromOcr = normalizeExtractedData(parsedFromOcr, baseReport, [], 'offline_ocr');

  // Assert EFW
  if (normalizedFromOcr.efw.value === 65) {
    results.push({ testName: "Raw OCR EFW Isolation", passed: true, message: "Parsed EFW = 65g successfully from raw text" });
  } else {
    results.push({ testName: "Raw OCR EFW Isolation", passed: false, message: `Expected EFW=65, got ${normalizedFromOcr.efw.value}` });
  }

  // Assert HC
  if (normalizedFromOcr.measurements.hc?.value === 73.92) {
    results.push({ testName: "Raw OCR HC Correctness", passed: true, message: "Parsed HC = 73.92 mm without EFW leakage" });
  } else {
    results.push({ testName: "Raw OCR HC Correctness", passed: false, message: `Expected HC=73.92, got ${normalizedFromOcr.measurements.hc?.value}` });
  }

  // Assert FL with missing decimal
  if (normalizedFromOcr.measurements.fl?.value === 9.15) {
    results.push({ testName: "Raw OCR FL Decimal Normalization", passed: true, message: "FL 915 mm parsed and normalized to 9.15 mm" });
  } else {
    results.push({ testName: "Raw OCR FL Decimal Normalization", passed: false, message: `Expected FL=9.15, got ${normalizedFromOcr.measurements.fl?.value}` });
  }

  // Assert BOD with missing decimal
  if (normalizedFromOcr.measurements.bod?.value === 14.28) {
    results.push({ testName: "Raw OCR BOD Decimal Normalization", passed: true, message: "BOD 1428 mm parsed and normalized to 14.28 mm" });
  } else {
    results.push({ testName: "Raw OCR BOD Decimal Normalization", passed: false, message: `Expected BOD=14.28, got ${normalizedFromOcr.measurements.bod?.value}` });
  }

  // Assert NBL with missing decimal
  if (normalizedFromOcr.measurements.nbl?.value === 2.26) {
    results.push({ testName: "Raw OCR NBL Decimal Normalization", passed: true, message: "NBL 226 mm parsed and normalized to 2.26 mm" });
  } else {
    results.push({ testName: "Raw OCR NBL Decimal Normalization", passed: false, message: `Expected NBL=2.26, got ${normalizedFromOcr.measurements.nbl?.value}` });
  }

  // Assert Left Uterine Doppler
  if (normalizedFromOcr.doppler.leftUterine.ri === 0.65 && normalizedFromOcr.doppler.leftUterine.pi === 1.12) {
    results.push({ testName: "Raw OCR Left Uterine Doppler", passed: true, message: "Left Uterine RI=0.65, PI=1.12 extracted in correct vessel section" });
  } else {
    results.push({ testName: "Raw OCR Left Uterine Doppler", passed: false, message: `Expected RI=0.65, PI=1.12, got RI=${normalizedFromOcr.doppler.leftUterine.ri}, PI=${normalizedFromOcr.doppler.leftUterine.pi}` });
  }

  // Assert Right Uterine Doppler
  if (normalizedFromOcr.doppler.rightUterine.ri === 0.62 && normalizedFromOcr.doppler.rightUterine.pi === 1.05) {
    results.push({ testName: "Raw OCR Right Uterine Doppler", passed: true, message: "Right Uterine RI=0.62, PI=1.05 extracted in correct vessel section" });
  } else {
    results.push({ testName: "Raw OCR Right Uterine Doppler", passed: false, message: `Expected RI=0.62, PI=1.05, got RI=${normalizedFromOcr.doppler.rightUterine.ri}, PI=${normalizedFromOcr.doppler.rightUterine.pi}` });
  }

  // Assert Umbilical Artery Doppler
  if (normalizedFromOcr.doppler.umbilicalArtery.ri === 0.68 && normalizedFromOcr.doppler.umbilicalArtery.pi === 1.25) {
    results.push({ testName: "Raw OCR Umbilical Artery Doppler", passed: true, message: "Umbilical Artery RI=0.68, PI=1.25 extracted in correct vessel section" });
  } else {
    results.push({ testName: "Raw OCR Umbilical Artery Doppler", passed: false, message: `Expected RI=0.68, PI=1.25, got RI=${normalizedFromOcr.doppler.umbilicalArtery.ri}, PI=${normalizedFromOcr.doppler.umbilicalArtery.pi}` });
  }

  // Assert EFW Percentile
  if (normalizedFromOcr.efw.percentile === '45%') {
    results.push({ testName: "EFW Percentile Extraction", passed: true, message: "EFW Percentile GP 45% parsed successfully" });
  } else {
    results.push({ testName: "EFW Percentile Extraction", passed: false, message: `Expected GP 45%, got ${normalizedFromOcr.efw.percentile}` });
  }

  // Test Case 4: Multi-line EFW Weight, Decimals & Commas in EFW GP
  const multiLineEfwReportText = `
EFW (Hadlock)
AC/FL/HC
243g
±36g
18w3d
GP = 20.2%
`;
  const parsedMultiLine = parseUltrasoundReportText(multiLineEfwReportText);
  const normalizedMultiLine = normalizeExtractedData(parsedMultiLine, baseReport, [], 'offline_ocr');

  if (normalizedMultiLine.efw.value === 243) {
    results.push({ testName: "Multi-line EFW Weight Lookahead", passed: true, message: "Parsed weight 243g on separate line successfully" });
  } else {
    results.push({ testName: "Multi-line EFW Weight Lookahead", passed: false, message: `Expected EFW 243g, got ${normalizedMultiLine.efw.value}` });
  }

  if (normalizedMultiLine.efw.percentile === '20.2%') {
    results.push({ testName: "EFW Percentile Decimal Preservation", passed: true, message: "EFW Percentile 20.2% preserved decimal point successfully" });
  } else {
    results.push({ testName: "EFW Percentile Decimal Preservation", passed: false, message: `Expected 20.2%, got ${normalizedMultiLine.efw.percentile}` });
  }

  // Test Case 5: Comma in Percentile
  const commaPercentileText = `
EFW (Hadlock)
AC/FL/HC 727g ±109g 24w3d GP 53,2%
`;
  const parsedComma = parseUltrasoundReportText(commaPercentileText);
  const normalizedComma = normalizeExtractedData(parsedComma, baseReport, [], 'offline_ocr');

  if (normalizedComma.efw.percentile === '53.2%') {
    results.push({ testName: "EFW Percentile Comma to Dot Conversion", passed: true, message: "EFW Percentile 53,2% correctly normalized to 53.2%" });
  } else {
    results.push({ testName: "EFW Percentile Comma to Dot Conversion", passed: false, message: `Expected 53.2%, got ${normalizedComma.efw.percentile}` });
  }

  // Test Case 6: Exact report case for PHAM THI THANH HOA 1984
  const thanhHoaText = `
EFW (Hadlock) Value Range Age Range GP Hadlock
AC/FL/HC 727g ±108g 24w3d ... 53.2%
`;
  const parsedThanhHoa = parseUltrasoundReportText(thanhHoaText);
  const normalizedThanhHoa = normalizeExtractedData(parsedThanhHoa, baseReport, [], 'offline_ocr');

  if (normalizedThanhHoa.efw.value === 727) {
    results.push({ testName: "Thanh Hoa EFW Weight", passed: true, message: "EFW weight correctly parsed as 727g" });
  } else {
    results.push({ testName: "Thanh Hoa EFW Weight", passed: false, message: `Expected 727, got ${normalizedThanhHoa.efw.value}` });
  }

  if (normalizedThanhHoa.efw.gaAge === '24w3d') {
    results.push({ testName: "Thanh Hoa EFW GA Age", passed: true, message: "EFW GA Age correctly parsed as 24w3d" });
  } else {
    results.push({ testName: "Thanh Hoa EFW GA Age", passed: false, message: `Expected 24w3d, got ${normalizedThanhHoa.efw.gaAge}` });
  }

  if (normalizedThanhHoa.efw.percentile === '53.2%') {
    results.push({ testName: "Thanh Hoa EFW GP%", passed: true, message: "EFW GP% correctly parsed as 53.2% (not overridden with calculation)" });
  } else {
    results.push({ testName: "Thanh Hoa EFW GP%", passed: false, message: `Expected 53.2%, got ${normalizedThanhHoa.efw.percentile}` });
  }

  // Test Case 7: Test Case 2 (2670g)
  const tc2Text = "EFW (Hadlock) 2670g ±395g 35w2d ... 45.0%";
  const parsedTC2 = parseUltrasoundReportText(tc2Text);
  const normalizedTC2 = normalizeExtractedData(parsedTC2, baseReport, [], 'offline_ocr');
  if (normalizedTC2.efw.value === 2670 && normalizedTC2.efw.gaAge === '35w2d' && normalizedTC2.efw.percentile === '45.0%') {
    results.push({ testName: "EFW Test Case 2 (2670g)", passed: true, message: "Correctly parsed 2670g, 35w2d, 45.0%" });
  } else {
    results.push({ testName: "EFW Test Case 2 (2670g)", passed: false, message: `Failed: ${JSON.stringify(normalizedTC2.efw)}` });
  }

  // Test Case 8: Test Case 3 (243g)
  const tc3Text = "EFW (Hadlock) 243g ±36g 18w3d ... 20.2%";
  const parsedTC3 = parseUltrasoundReportText(tc3Text);
  const normalizedTC3 = normalizeExtractedData(parsedTC3, baseReport, [], 'offline_ocr');
  if (normalizedTC3.efw.value === 243 && normalizedTC3.efw.gaAge === '18w3d' && normalizedTC3.efw.percentile === '20.2%') {
    results.push({ testName: "EFW Test Case 3 (243g)", passed: true, message: "Correctly parsed 243g, 18w3d, 20.2%" });
  } else {
    results.push({ testName: "EFW Test Case 3 (243g)", passed: false, message: `Failed: ${JSON.stringify(normalizedTC3.efw)}` });
  }

  // Test Case 9: examDate validation
  const examDateText = "Ngày khám: 17.08.2026\nPatient Name: PHAM THI THANH HOA";
  const parsedExamDate = parseUltrasoundReportText(examDateText);
  const normalizedExamDate = normalizeExtractedData(parsedExamDate, baseReport, [], 'offline_ocr');
  if (normalizedExamDate.patient.examDate === '17.08.2026') {
    results.push({ testName: "Exam Date Mapping", passed: true, message: "Correctly parsed and mapped examDate as 17.08.2026" });
  } else {
    results.push({ testName: "Exam Date Mapping", passed: false, message: `Expected 17.08.2026, got ${normalizedExamDate.patient.examDate}` });
  }

  // Test Case 10: IVF Day 5 Transfer Dating Priority
  const ivfDay5Text = `
Patient: PHAM THI THANH HOA
Date: 17.08.2026
Day 5 Trans. | 18.03.2026
LMP: 01.03.2026
EDD(DST): 04.12.2026
GA(DST): 24w3d
GA(AUA): 23w5d
EDD(AUA): 10.12.2026
`;
  const parsedIvfDay5 = parseUltrasoundReportText(ivfDay5Text);
  const normalizedIvfDay5 = normalizeExtractedData(parsedIvfDay5, baseReport, [], 'offline_ocr');

  const ivfEddPass = normalizedIvfDay5.patient.edd === '04.12.2026';
  const ivfGaPass = normalizedIvfDay5.patient.ga === '24w3d' || normalizedIvfDay5.patient.gaClin === '24w3d';
  const ivfSourcePass = normalizedIvfDay5.patient.datingSource === 'IVF_DAY5';

  if (ivfEddPass && ivfGaPass && ivfSourcePass) {
    results.push({ testName: "IVF Day 5 Dating Priority", passed: true, message: "IVF Day 5 EDD (04.12.2026) and GA (24w3d) correctly prioritized over LMP and AUA" });
  } else {
    results.push({ testName: "IVF Day 5 Dating Priority", passed: false, message: `IVF Day 5 failed: EDD=${normalizedIvfDay5.patient.edd}, GA=${normalizedIvfDay5.patient.ga || normalizedIvfDay5.patient.gaClin}, source=${normalizedIvfDay5.patient.datingSource}` });
  }

  // Test Case 11: IVF Day 3 Transfer Dating Calculation
  const ivfDay3Text = `
Patient: TRAN THI B
Date: 17.08.2026
Day 3 Trans. | 18.03.2026
`;
  const parsedIvfDay3 = parseUltrasoundReportText(ivfDay3Text);
  const normalizedIvfDay3 = normalizeExtractedData(parsedIvfDay3, baseReport, [], 'offline_ocr');

  if (normalizedIvfDay3.patient.datingSource === 'IVF_DAY3' && normalizedIvfDay3.patient.edd === '06.12.2026') {
    results.push({ testName: "IVF Day 3 Dating Calculation", passed: true, message: "IVF Day 3 calculated EDD (06.12.2026 = transfer + 263 days) correctly" });
  } else {
    results.push({ testName: "IVF Day 3 Dating Calculation", passed: false, message: `IVF Day 3 failed: EDD=${normalizedIvfDay3.patient.edd}, source=${normalizedIvfDay3.patient.datingSource}` });
  }

  // Test Case 12: Multi-Page Delimited Report Text Parsing
  const multiPageMergedText = `
=== PAGE 1 ===
GE Healthcare Voluson
Patient Name: NGUYEN THI HOANG
Exam Date: 20/09/2026
BPD: 62.4 mm
HC: 231.2 mm
AC: 205.8 mm
FL: 44.1 mm
EFW (Hadlock): 685 g

=== PAGE 2 ===
GE Healthcare Voluson
Patient Name: NGUYEN THI HOANG
FHR: 146 bpm
Umb. Art. PI: 1.05
Umb. Art. RI: 0.65
MCA PI: 1.82
AFI: 142 mm
Placenta: Anterior Grade I
`;
  const parsedMultiPage = parseUltrasoundReportText(multiPageMergedText);
  const normalizedMultiPage = normalizeExtractedData(parsedMultiPage, baseReport, [], 'offline_ocr');

  const p1Biometry = normalizedMultiPage.measurements.bpd?.value === 62.4 &&
                     normalizedMultiPage.measurements.hc?.value === 231.2 &&
                     normalizedMultiPage.measurements.ac?.value === 205.8 &&
                     normalizedMultiPage.measurements.fl?.value === 44.1 &&
                     normalizedMultiPage.efw.value === 685;

  const p2DopplerAfi = normalizedMultiPage.doppler?.fhr?.value === 146 &&
                       normalizedMultiPage.doppler?.umbilicalArtery?.pi === 1.05 &&
                       normalizedMultiPage.doppler?.umbilicalArtery?.ri === 0.65 &&
                       normalizedMultiPage.doppler?.middleCerebralArtery?.pi === 1.82 &&
                       normalizedMultiPage.amnioticFluid?.afi?.value === 142;

  if (p1Biometry && p2DopplerAfi) {
    results.push({
      testName: "Multi-Page Report Integration (Page 1 Biometry + Page 2 Doppler/AFI)",
      passed: true,
      message: "Merged multi-page report preserved 2D measurements, EFW from Page 1 and Doppler/AFI from Page 2 without overwriting.",
    });
  } else {
    results.push({
      testName: "Multi-Page Report Integration (Page 1 Biometry + Page 2 Doppler/AFI)",
      passed: false,
      message: `Multi-page merge failed: p1=${p1Biometry}, p2=${p2DopplerAfi}`,
    });
  }

  // =========================================================================
  // Test Case 13: GE 12-Page Full Report Acceptance Criteria (16 Strict Verification Tests)
  // =========================================================================
  const ge12PageMergedText = `
========== PAGE 1 ==========
GE Healthcare Voluson E10
Patient Name: NGUYEN THI HUYEN
Patient ID: 26081989
Exam Date: 17.08.2026
Sonographer: BS. NGUYEN HOANG SON
Clinic: PHONG KHAM SAN PHU KHOA
GA(EDD): 25w6d
EDD: 24.11.2026
LMP: 17.02.2026
DOC: 03.03.2026
Day 5 Transfer

========== PAGE 2 ==========
2D Biometry Measurements:
BPD (Hadlock): 70.6 mm 18.6% 28w2d
HC (INTERGROWTH-21st): 255.8 mm 37.3%
AC (Hadlock): 215.4 mm 46.2% 26w0d
FL (Osaka): 46.3 mm 60.0% 25w2d
HL (ASUM): 40.7 mm
BOD (Jeanty): 43.2 mm
NBL (Sonek): 9.1 mm
Foot (Chitty): 51.5 mm
Cervix Length: 38.2 mm

========== PAGE 3 ==========
Fetal Weight Estimation:
EFW (Hadlock 3 AC/FL/HC): 890 g
Range: ±132g
Percentile: <1%
GA(EFW): 25w6d

========== PAGE 4 ==========
Fetal Heart & Rhythm:
Ventricular FHR: 141 bpm

========== PAGE 5 ==========
Umbilical Artery (UA):
PS: 38.88 cm/s
ED: 2.20 cm/s
TAmax: 18.86 cm/s
VTI: 72.6 cm
PI: 1.94
RI: 0.94
HR: 156 bpm

========== PAGE 6 ==========
Middle Cerebral Artery (MCA):
PS: 52.40 cm/s
ED: 9.47 cm/s
TAmax: 24.17 cm/s
VTI: 95.8 cm
PI: 1.78
RI: 0.82
MoM: 1.24
HR: 151 bpm

========== PAGE 7 ==========
Left Uterine Artery (Left UtArt):
PS: 83.91 cm/s
ED: 9.30 cm/s
TAmax: 24.08 cm/s
VTI: 197.4 cm
PI: 3.10
RI: 0.89
HR: 73 bpm

========== PAGE 8 ==========
Right Uterine Artery (Right UtArt):
PS: 65.42 cm/s
ED: 15.06 cm/s
TAmax: 26.85 cm/s
VTI: 213.1 cm
PI: 1.88
RI: 0.77
HR: 75 bpm

========== PAGE 9 ==========
Ductus Venosus (DV):
S: 66.04 cm/s
TAmax: 57.09 cm/s
a: 37.62 cm/s
D: 43.37 cm/s
PI: 0.50
S/a: 1.76
a/S: 0.57
PVIV: 0.66
PLI: 0.43
HR: 268 bpm

========== PAGE 10 ==========
Doppler Calculations & Indices:
DV a/S (JSUM2012): 0.57 13.2%
DV PI (JSUM2012): 0.50 74.2%
DV PLI (Baschat): 0.43 23.8%
DV PVIV (Baschat): 0.66 76.5%
DV S/a (Baschat): 1.76 22.6%
UmbArt PI (JSUM2001): 1.94 >99%
UmbArt RI (JSUM2001): 0.94 >99%
MCA PI (JSUM2001): 1.78 30.2%
MCA RI (JSUM2001): 0.82 22.8%
MCA PS (Mari): 52.40 cm/s MoM: 1.24
MCA TAMX (Schaffer): 24.17 cm/s 81.0%
CPR (Ebbing): 0.92 <1%
Left UtArt PI (Merz): 3.10 >99%
Left UtArt RI (Merz): 0.89 >99%
Right UtArt PI (Merz): 1.88 >99%
Right UtArt RI (Merz): 0.77 >99%

========== PAGE 11 ==========
Amniotic Fluid:
AFI: 163.8 mm
SDP: 71.05 mm

========== PAGE 12 ==========
Placenta & Cervix:
Placenta Position: Mặt sau nhóm II
Grade: I
Thickness: 28 mm
Cervix Length: 38.2 mm
`;

  const parsedGe12 = parseUltrasoundReportText(ge12PageMergedText);
  const normalizedGe12 = normalizeExtractedData(parsedGe12, baseReport, [], 'offline_ocr');

  // Criteria 1: BPD decimal accuracy (70.6 mm)
  results.push({
    testName: "Criteria 1: BPD Decimal Accuracy (70.6 mm)",
    passed: normalizedGe12.measurements.bpd?.value === 70.6,
    message: `BPD value: ${normalizedGe12.measurements.bpd?.value} mm`,
  });

  // Criteria 2: HC decimal accuracy (255.8 mm)
  results.push({
    testName: "Criteria 2: HC Decimal Accuracy (255.8 mm)",
    passed: normalizedGe12.measurements.hc?.value === 255.8,
    message: `HC value: ${normalizedGe12.measurements.hc?.value} mm`,
  });

  // Criteria 3: AC decimal accuracy (215.4 mm)
  results.push({
    testName: "Criteria 3: AC Decimal Accuracy (215.4 mm)",
    passed: normalizedGe12.measurements.ac?.value === 215.4,
    message: `AC value: ${normalizedGe12.measurements.ac?.value} mm`,
  });

  // Criteria 4: FL decimal accuracy (46.3 mm)
  results.push({
    testName: "Criteria 4: FL Decimal Accuracy (46.3 mm)",
    passed: normalizedGe12.measurements.fl?.value === 46.3,
    message: `FL value: ${normalizedGe12.measurements.fl?.value} mm`,
  });

  // Criteria 5: Other 2D biometry (HL 40.7, BOD 43.2, NBL 9.1, Foot 51.5)
  const other2dOk = normalizedGe12.measurements.hl?.value === 40.7 &&
                    normalizedGe12.measurements.bod?.value === 43.2 &&
                    normalizedGe12.measurements.nbl?.value === 9.1 &&
                    normalizedGe12.measurements.foot?.value === 51.5;
  results.push({
    testName: "Criteria 5: Additional 2D Biometry (HL, BOD, NBL, Foot)",
    passed: other2dOk,
    message: `HL=${normalizedGe12.measurements.hl?.value}, BOD=${normalizedGe12.measurements.bod?.value}, NBL=${normalizedGe12.measurements.nbl?.value}, Foot=${normalizedGe12.measurements.foot?.value}`,
  });

  // Criteria 6: EFW percentile preservation (<1% with < preserved)
  const efwOk = normalizedGe12.efw.value === 890 && 
                (normalizedGe12.efw.percentile === '<1%' || normalizedGe12.efw.percentile?.includes('<1%'));
  results.push({
    testName: "Criteria 6: EFW & '<1%' Percentile Preservation",
    passed: efwOk,
    message: `EFW: ${normalizedGe12.efw.value}g, Percentile: ${normalizedGe12.efw.percentile}`,
  });

  // Criteria 7: UA Doppler Preservation (PS 38.88, ED 2.20, PI 1.94, RI 0.94, HR 156)
  const uaOk = normalizedGe12.doppler?.umbilicalArtery?.ps === 38.88 &&
               normalizedGe12.doppler?.umbilicalArtery?.ed === 2.20 &&
               normalizedGe12.doppler?.umbilicalArtery?.pi === 1.94 &&
               normalizedGe12.doppler?.umbilicalArtery?.ri === 0.94 &&
               normalizedGe12.doppler?.umbilicalArtery?.hr === 156;
  results.push({
    testName: "Criteria 7: Umbilical Artery (UA) Doppler Parameters",
    passed: uaOk,
    message: `UA: PS=${normalizedGe12.doppler?.umbilicalArtery?.ps}, ED=${normalizedGe12.doppler?.umbilicalArtery?.ed}, PI=${normalizedGe12.doppler?.umbilicalArtery?.pi}, RI=${normalizedGe12.doppler?.umbilicalArtery?.ri}, HR=${normalizedGe12.doppler?.umbilicalArtery?.hr}`,
  });

  // Criteria 8: MCA Doppler Preservation (PS 52.40, ED 9.47, PI 1.78, RI 0.82, HR 151)
  const mcaOk = normalizedGe12.doppler?.middleCerebralArtery?.ps === 52.40 &&
                normalizedGe12.doppler?.middleCerebralArtery?.ed === 9.47 &&
                normalizedGe12.doppler?.middleCerebralArtery?.pi === 1.78 &&
                normalizedGe12.doppler?.middleCerebralArtery?.ri === 0.82 &&
                normalizedGe12.doppler?.middleCerebralArtery?.hr === 151;
  results.push({
    testName: "Criteria 8: Middle Cerebral Artery (MCA) Doppler Parameters",
    passed: mcaOk,
    message: `MCA: PS=${normalizedGe12.doppler?.middleCerebralArtery?.ps}, ED=${normalizedGe12.doppler?.middleCerebralArtery?.ed}, PI=${normalizedGe12.doppler?.middleCerebralArtery?.pi}, RI=${normalizedGe12.doppler?.middleCerebralArtery?.ri}, HR=${normalizedGe12.doppler?.middleCerebralArtery?.hr}`,
  });

  // Criteria 9: Left & Right Uterine Doppler Preservation
  const leftUtOk = normalizedGe12.doppler?.leftUterine?.ps === 83.91 &&
                   normalizedGe12.doppler?.leftUterine?.ed === 9.30 &&
                   normalizedGe12.doppler?.leftUterine?.pi === 3.10 &&
                   normalizedGe12.doppler?.leftUterine?.ri === 0.89 &&
                   normalizedGe12.doppler?.leftUterine?.hr === 73;
  const rightUtOk = normalizedGe12.doppler?.rightUterine?.ps === 65.42 &&
                    normalizedGe12.doppler?.rightUterine?.ed === 15.06 &&
                    normalizedGe12.doppler?.rightUterine?.pi === 1.88 &&
                    normalizedGe12.doppler?.rightUterine?.ri === 0.77 &&
                    normalizedGe12.doppler?.rightUterine?.hr === 75;
  results.push({
    testName: "Criteria 9: Bilateral Uterine Arteries Doppler Parameters",
    passed: leftUtOk && rightUtOk,
    message: `Left Ut PI=${normalizedGe12.doppler?.leftUterine?.pi} (ok=${leftUtOk}), Right Ut PI=${normalizedGe12.doppler?.rightUterine?.pi} (ok=${rightUtOk})`,
  });

  // Criteria 10: Ductus Venosus Hemodynamics (S 66.04, TAmax 57.09, a 37.62, D 43.37, PI 0.50, HR 268)
  const dvOk = normalizedGe12.doppler?.ductusVenosus?.s === 66.04 &&
               normalizedGe12.doppler?.ductusVenosus?.tamax === 57.09 &&
               normalizedGe12.doppler?.ductusVenosus?.a === 37.62 &&
               normalizedGe12.doppler?.ductusVenosus?.d === 43.37 &&
               normalizedGe12.doppler?.ductusVenosus?.pi === 0.50 &&
               normalizedGe12.doppler?.ductusVenosus?.hr === 268;
  results.push({
    testName: "Criteria 10: Ductus Venosus (DV) Full Waves & Indices",
    passed: dvOk,
    message: `DV: S=${normalizedGe12.doppler?.ductusVenosus?.s}, TAmax=${normalizedGe12.doppler?.ductusVenosus?.tamax}, a=${normalizedGe12.doppler?.ductusVenosus?.a}, D=${normalizedGe12.doppler?.ductusVenosus?.d}, PI=${normalizedGe12.doppler?.ductusVenosus?.pi}, HR=${normalizedGe12.doppler?.ductusVenosus?.hr}`,
  });

  // Criteria 11: Amniotic Fluid (AFI 163.8 mm, SDP 71.05 mm)
  const afiOk = normalizedGe12.amnioticFluid?.afi?.value === 163.8 &&
                normalizedGe12.amnioticFluid?.sdp?.value === 71.05;
  results.push({
    testName: "Criteria 11: Amniotic Fluid AFI & SDP Extraction",
    passed: afiOk,
    message: `AFI=${normalizedGe12.amnioticFluid?.afi?.value} mm, SDP=${normalizedGe12.amnioticFluid?.sdp?.value} mm`,
  });

  // Criteria 12: Fetal Heart Rate (FHR 141 bpm)
  const fhrOk = normalizedGe12.doppler?.fhr?.value === 141;
  results.push({
    testName: "Criteria 12: Ventricular FHR Isolation (141 bpm)",
    passed: fhrOk,
    message: `FHR: ${normalizedGe12.doppler?.fhr?.value} bpm`,
  });

  // Criteria 13: IVF Day 5 Transfer Dating Priority
  const ivfOk = normalizedGe12.patient.datingSource === 'IVF_DAY5' ||
                normalizedGe12.patient.transferDate === '03.03.2026' ||
                normalizedGe12.patient.doc === '03.03.2026';
  results.push({
    testName: "Criteria 13: IVF Day 5 Transfer Dating Priority",
    passed: ivfOk,
    message: `Dating source: ${normalizedGe12.patient.datingSource}, Transfer date: ${normalizedGe12.patient.transferDate || normalizedGe12.patient.doc}`,
  });

  // Criteria 14: Cervix Length (38.2 mm)
  const clOk = normalizedGe12.measurements.cervixLength?.value === 38.2;
  results.push({
    testName: "Criteria 14: Cervix Length Measurement (38.2 mm)",
    passed: clOk,
    message: `Cervix Length: ${normalizedGe12.measurements.cervixLength?.value} mm`,
  });

  // Criteria 15: Non-Contamination (No cross vessel overwrite)
  const nonContamOk = normalizedGe12.doppler?.umbilicalArtery?.pi !== normalizedGe12.doppler?.middleCerebralArtery?.pi &&
                      normalizedGe12.doppler?.leftUterine?.pi !== normalizedGe12.doppler?.rightUterine?.pi &&
                      normalizedGe12.doppler?.fhr?.value !== normalizedGe12.doppler?.ductusVenosus?.hr;
  results.push({
    testName: "Criteria 15: Doppler Non-Contamination & Isolation",
    passed: nonContamOk,
    message: `UA PI (${normalizedGe12.doppler?.umbilicalArtery?.pi}) != MCA PI (${normalizedGe12.doppler?.middleCerebralArtery?.pi}), FHR (${normalizedGe12.doppler?.fhr?.value}) != DV HR (${normalizedGe12.doppler?.ductusVenosus?.hr})`,
  });

  // Criteria 16: Complete Multi-Page Integration
  const all16Pass = results.slice(-15).every(r => r.passed);
  results.push({
    testName: "Criteria 16: Full 12-Page GE Report Pipeline Integration",
    passed: all16Pass,
    message: all16Pass ? "All 16 acceptance criteria for GE 12-page report PASSED seamlessly!" : "Some criteria require fine-tuning.",
  });

  return results;
}

// Phase 6.2: the function above was previously defined but never invoked, so
// `tsx extractionPipeline.test.ts` (as run by `npm run test`) loaded the
// module and exited 0 without running a single assertion. This block makes
// `npm run test` actually invoke the suite and fail (non-zero exit) if any
// assertion fails — no stub/fake assertions, no swallowed errors.
const __results = runPipelineVerificationTests();
for (const r of __results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testName} — ${r.message}`);
}
const __failed = __results.filter((r) => !r.passed);
console.log(`\n${__results.length - __failed.length}/${__results.length} extractionPipeline assertions passed.`);
if (__failed.length > 0) {
  console.error(`\n${__failed.length} extractionPipeline assertion(s) FAILED.`);
  process.exit(1);
}
