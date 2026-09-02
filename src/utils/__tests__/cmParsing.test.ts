/**
 * Phase 3 — CM (Cisterna Magna) Parsing/Normalization Tests
 * Run: tsx src/utils/__tests__/cmParsing.test.ts
 *
 * NOTE: offlineOcrService.ts imports 'tesseract.js' (a large browser OCR
 * dependency not needed for text-parsing logic). This test harness relies on
 * a lightweight local stub at node_modules/tesseract.js (test-only, not part
 * of the app) so the REAL parseUltrasoundReportText() can be exercised
 * end-to-end instead of re-implementing its regexes here.
 */
import { sanitizeBiometryValue, normalizeMeasurementValue } from '../clinicalCalculations';
import { parseUltrasoundReportText } from '../../services/offlineOcrService';
import { normalizeExtractedData, createCleanMeasurements, createCleanDoppler, createCleanAmniotic } from '../normalizeReportData';
import { UltrasoundReport } from '../../types/ultrasound';

interface TestResult { testName: string; passed: boolean; message: string; }
const results: TestResult[] = [];
function check(testName: string, passed: boolean, message: string) {
  results.push({ testName, passed, message });
}

const baseReport: UltrasoundReport = {
  id: 'test-report',
  patient: {
    name: 'TEST', patientId: 'BN1', yearOfBirth: '1995', age: '30', phone: '',
    address: '', gender: 'Nữ', clinicHeader: '', sonographer: '', examDate: '10/10/2025',
    indication: '', lmp: '', doc: '', gaClin: '', gaAua: '', edd: '',
    height: 160, weight: 55, bloodPressure: '', pulse: 75, gravida: '1', para: '0',
    abortion: '0', ectopic: '0', obstetricHistoryNotes: '', previousAbnormalities: '',
    plannedDeliveryLocation: '', notes: '', firstVisitDate: '10/10/2025', visitCount: 1,
  },
  measurements: createCleanMeasurements(),
  efw: { value: null, unit: 'g' },
  doppler: createCleanDoppler(),
  amnioticFluid: createCleanAmniotic(),
  placenta: { location: '', grade: '', thickness: 0, abnormalities: '' },
  conclusion: '', recommendations: '', imageUrls: [],
  detectedCategory: 'morphology_2d_3d_4d',
  anatomy: {
    skullBrain: '', faceEyesNose: '', chestHeart: '', abdomenStomachBladder: '',
    spine: '', limbs: '',
  } as any,
} as any;

// TEST 1: CM 5.92 mm -> 5.92 mm
{
  const v = sanitizeBiometryValue('cm', 5.92, null, 'CM 5.92 mm', 'CM');
  check('TEST 1: CM 5.92 mm => 5.92', v === 5.92, `got ${v}`);
}

// TEST 2: CM 5.92mm (no space) -> 5.92 mm
{
  const v = sanitizeBiometryValue('cm', 5.92, null, 'CM 5.92mm', 'CM');
  check('TEST 2: CM 5.92mm => 5.92', v === 5.92, `got ${v}`);
}

// TEST 3: CM 592mm -> xử lý đúng theo context hiện tại (out-of-range => rejected, NOT auto-divided)
{
  const v = sanitizeBiometryValue('cm', 592, null, 'CM 592mm', 'CM');
  check(
    'TEST 3: CM 592mm => rejected (null), NOT auto-guessed as 5.92',
    v === null,
    `got ${v} (must be null — no blind /100 heuristic for CM)`
  );
}

// TEST 4: CM (Nicolaides) 4.2mm -> 4.2 mm
{
  const v = sanitizeBiometryValue('cm', 4.2, null, 'CM (Nicolaides) 4.2mm', 'CM (Nicolaides)');
  check('TEST 4: CM (Nicolaides) 4.2mm => 4.2', v === 4.2, `got ${v}`);
}

// TEST 5: CM (Nicolaides) 42mm -> không tự chia nếu không đủ evidence
{
  const v = sanitizeBiometryValue('cm', 42, null, 'CM (Nicolaides) 42mm', 'CM (Nicolaides)');
  check(
    'TEST 5: CM (Nicolaides) 42mm => rejected (null), NOT auto-divided to 4.2',
    v === null,
    `got ${v} (must be null — no blind /10 heuristic for CM)`
  );
}

// TEST 6: cM 592mm (lowercase c) via REAL offline text parser -> same as CM, sourceEvidence preserved
{
  const r = parseUltrasoundReportText('Patient: TEST\ncM 592mm');
  const cm = r.measurements?.cm;
  check(
    'TEST 6: "cM 592mm" (case-insensitive) => value null but sourceEvidence preserved',
    cm?.value === null && cm?.isExtracted === false && cm?.sourceEvidence === 'cM 592mm',
    `got ${JSON.stringify(cm)}`
  );
}

// TEST 7: CM không có dữ liệu -> null / not extracted
{
  const r = parseUltrasoundReportText('Patient: TEST\nBPD 60.33mm');
  const cm = r.measurements?.cm;
  check(
    'TEST 7: no CM in report => null / not extracted',
    !cm || cm.value === null,
    `got ${JSON.stringify(cm)}`
  );
}

// TEST 8: Report có CM + các measurement khác -> chỉ CM bị ảnh hưởng, các đo lường khác giữ nguyên
{
  const text = [
    'Patient: TEST',
    'CM 592mm',
    'BPD 60.33mm',
    'HC 225.96mm',
    'AC 212.64mm',
    'FL 40.86mm',
    'HL 42.55mm',
    'TCD 26.99mm',
    'Vp 5.65mm',
    'NBL 7.83mm',
    'BOD 39.64mm',
    'Foot 48.26mm',
  ].join('\n');
  const r = parseUltrasoundReportText(text);
  const m = r.measurements;
  const cmOk = m?.cm?.value === null && m?.cm?.sourceEvidence === 'CM 592mm';
  const othersOk =
    m?.bpd?.value === 60.33 &&
    m?.hc?.value === 225.96 &&
    m?.ac?.value === 212.64 &&
    m?.fl?.value === 40.86 &&
    m?.hl?.value === 42.55 &&
    m?.tcd?.value === 26.99 &&
    m?.vp?.value === 5.65 &&
    m?.nbl?.value === 7.83 &&
    m?.bod?.value === 39.64 &&
    m?.foot?.value === 48.26;
  check(
    'TEST 8: CM rejected, all 10 other measurements unaffected (regression)',
    cmOk && othersOk,
    `cm=${JSON.stringify(m?.cm)}, bpd=${m?.bpd?.value}, hc=${m?.hc?.value}, ac=${m?.ac?.value}, fl=${m?.fl?.value}, hl=${m?.hl?.value}, tcd=${m?.tcd?.value}, vp=${m?.vp?.value}, nbl=${m?.nbl?.value}, bod=${m?.bod?.value}, foot=${m?.foot?.value}`
  );
}

// TEST 9: Report 3 trang, CM nằm page 2 -> vẫn parse được sau merge (valid decimal case)
{
  const merged = [
    '=== PAGE 1 ===',
    'Patient: TEST',
    '',
    '=== PAGE 2 ===',
    'CM (Nicolaides) 5.92 mm',
    '',
    '=== PAGE 3 ===',
    'BPD 60.33mm',
  ].join('\n');
  const r = parseUltrasoundReportText(merged);
  check(
    'TEST 9: 3-page report, valid CM on page 2 => parsed after merge',
    r.measurements?.cm?.value === 5.92 && r.measurements?.cm?.isExtracted === true,
    `got cm=${JSON.stringify(r.measurements?.cm)}`
  );
}

// TEST 10: Report 4 trang, CM nằm page 3 -> vẫn parse được (valid decimal case)
{
  const merged = [
    '=== PAGE 1 ===', 'Patient: TEST', '',
    '=== PAGE 2 ===', 'BPD 60.33mm', '',
    '=== PAGE 3 ===', 'CM 4.2mm', '',
    '=== PAGE 4 ===', 'HC 225.96mm',
  ].join('\n');
  const r = parseUltrasoundReportText(merged);
  check(
    'TEST 10: 4-page report, valid CM on page 3 => parsed after merge',
    r.measurements?.cm?.value === 4.2 && r.measurements?.cm?.isExtracted === true,
    `got cm=${JSON.stringify(r.measurements?.cm)}`
  );
}

// Extra: AI/online-path regression via normalizeReportData.ingestMeasurement
// (this is the path multiImageOcrPipeline/stitchedOcrPipeline actually use
// after extractReportFromMergedText returns structured JSON).
{
  const extracted = {
    measurements: {
      cm: { value: 592, unit: 'mm' },
      bpd: { value: 60.33, unit: 'mm' },
      hc: { value: 225.96, unit: 'mm' },
    },
  };
  const normalized = normalizeExtractedData(extracted, baseReport, [], 'online_ai');
  const cmOk =
    normalized.measurements.cm.value === null &&
    normalized.measurements.cm.isExtracted === false &&
    !!normalized.measurements.cm.sourceEvidence;
  const othersOk = normalized.measurements.bpd.value === 60.33 && normalized.measurements.hc.value === 225.96;
  check(
    'EXTRA (AI/online path): rejected CM keeps sourceEvidence, BPD/HC unaffected',
    cmOk && othersOk,
    `cm=${JSON.stringify(normalized.measurements.cm)}, bpd=${normalized.measurements.bpd.value}, hc=${normalized.measurements.hc.value}`
  );
}

// Print results
let allPassed = true;
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testName} — ${r.message}`);
  if (!r.passed) allPassed = false;
}
console.log(`\n${results.filter(r => r.passed).length}/${results.length} CM parsing tests passed.`);
if (!allPassed) process.exit(1);
