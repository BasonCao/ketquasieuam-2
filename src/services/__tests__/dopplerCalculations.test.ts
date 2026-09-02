/**
 * Phase 5 — Doppler Calculations data-flow tests.
 * Run: tsx src/services/__tests__/dopplerCalculations.test.ts
 */
import { parseDopplerCalculations } from '../dopplerCalculationParser';
import { normalizeExtractedData, createCleanMeasurements, createCleanDoppler, createCleanAmniotic } from '../../utils/normalizeReportData';
import { UltrasoundReport } from '../../types/ultrasound';

interface TestResult { testName: string; passed: boolean; message: string; }
const results: TestResult[] = [];
function check(testName: string, passed: boolean, message: string) {
  results.push({ testName, passed, message });
}

// Exact raw text fixture from the Phase 5 task
const RAW_TEXT = `Doppler Calculations

UmbArt PI (JSUM(2001)) 1.94 >99%

DV a/S (JSUM2012) 0.57 13.2%

DV PI (JSUM2012) 0.50 74.2%

DV PLI (Baschat) 0.43 23.8%

DV PVIV (Baschat) 0.66 76.5%

DV S/a (Baschat) 1.76 22.6%

Left
UtArt PI (Merz) 3.10 >99%

Right
UtArt PI (Merz) 1.88 >99%

MCA PI (JSUM(2001)) 1.78 30.2%

MCA PS (Mari) 52.40cm/s MoM: 1.24

CPR (Ebbing) 0.92 <1%

MCA TAMX (Schaffer) 24.17cm/s 81.0%
`;

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
  anatomy: { skullBrain: '', faceEyesNose: '', chestHeart: '', abdomenStomachBladder: '', spine: '', limbs: '' } as any,
} as any;

// TEST 1: parseDopplerCalculations(rawText) => full set of values
{
  const calc = parseDopplerCalculations(RAW_TEXT);
  const ok =
    calc.umbilicalArtery?.pi?.value === 1.94 &&
    calc.ductusVenosus?.aS?.value === 0.57 &&
    calc.ductusVenosus?.pi?.value === 0.50 &&
    calc.ductusVenosus?.pi?.percentile === '74.2%' &&
    calc.ductusVenosus?.pli?.value === 0.43 &&
    calc.ductusVenosus?.pviv?.value === 0.66 &&
    calc.ductusVenosus?.sa?.value === 1.76 &&
    calc.leftUterine?.pi?.value === 3.10 &&
    calc.rightUterine?.pi?.value === 1.88 &&
    calc.middleCerebralArtery?.pi?.value === 1.78 &&
    calc.middleCerebralArtery?.ps?.value === 52.40 &&
    calc.middleCerebralArtery?.ps?.mom === 1.24 &&
    calc.middleCerebralArtery?.tamax?.value === 24.17 &&
    (calc.middleCerebralArtery as any)?.cpr?.value === 0.92;
  check(
    'TEST 1: parseDopplerCalculations extracts all fields from fixture',
    ok,
    `uaPi=${calc.umbilicalArtery?.pi?.value}, dvPi=${calc.ductusVenosus?.pi?.value}, dvPi%=${calc.ductusVenosus?.pi?.percentile}, mcaPi=${calc.middleCerebralArtery?.pi?.value}, mcaPs=${calc.middleCerebralArtery?.ps?.value}, mcaPsMoM=${calc.middleCerebralArtery?.ps?.mom}, cpr=${(calc.middleCerebralArtery as any)?.cpr?.value}, leftUt=${calc.leftUterine?.pi?.value}, rightUt=${calc.rightUterine?.pi?.value}`
  );
}

// TEST 2: normalizeExtractedData wiring => extractedData.doppler.calculations lands in report.doppler.calculations
{
  const directDopplerCalcs = parseDopplerCalculations(RAW_TEXT);
  const extractedData: any = { doppler: { calculations: directDopplerCalcs } };
  const normalized = normalizeExtractedData(extractedData, baseReport, [], 'online_ai');
  const ok = normalized.doppler.calculations?.umbilicalArtery?.pi?.value === 1.94;
  check(
    'TEST 2: stitched-pipeline-style wiring => doppler.calculations reaches normalized report',
    ok,
    `normalized.doppler.calculations.umbilicalArtery.pi.value=${normalized.doppler.calculations?.umbilicalArtery?.pi?.value}`
  );
}

// TEST 2b: `calculations` (ratio field) must remain untouched / separate from doppler.calculations
{
  const directDopplerCalcs = parseDopplerCalculations(RAW_TEXT);
  const extractedData: any = {
    doppler: { calculations: directDopplerCalcs },
    measurements: { hcAc: 1.2 },
  };
  const normalized = normalizeExtractedData(extractedData, baseReport, [], 'online_ai');
  const ok = normalized.doppler.calculations !== undefined && normalized.calculations !== normalized.doppler.calculations;
  check(
    'TEST 2b: doppler.calculations (Doppler) stays separate from report.calculations (ratios)',
    ok,
    `doppler.calculations set=${!!normalized.doppler.calculations}, calculations !== doppler.calculations=${normalized.calculations !== normalized.doppler.calculations}`
  );
}

// TEST 3: multiImage-pipeline-style wiring — parse directly from a merged (P1+P2+P3) text
{
  const merged = [
    '=== PAGE 1 ===',
    'Patient: TEST',
    '',
    '=== PAGE 2 ===',
    'BPD 60.33mm',
    '',
    '=== PAGE 3 ===',
    'Doppler Calculations',
    'UmbArt PI (JSUM(2001)) 1.94 >99%',
    'DV PI (JSUM2012) 0.50 74.2%',
  ].join('\n');
  const calcs = parseDopplerCalculations(merged);
  const ok = calcs.umbilicalArtery?.pi?.value === 1.94 && calcs.ductusVenosus?.pi?.value === 0.50;
  check('TEST 3: multiImage-style merged text (3 pages) => Doppler Calculations found', ok, `uaPi=${calcs.umbilicalArtery?.pi?.value}, dvPi=${calcs.ductusVenosus?.pi?.value}`);
}

// TEST 4: Doppler Calculations on page 2 of a merged 3-page text
{
  const merged = ['=== PAGE 1 ===', 'Patient: TEST', '', '=== PAGE 2 ===', 'MCA PI (JSUM(2001)) 1.78 30.2%', '', '=== PAGE 3 ===', 'BPD 60.33mm'].join('\n');
  const calcs = parseDopplerCalculations(merged);
  check('TEST 4: Doppler Calculations on page 2 => still found after merge', calcs.middleCerebralArtery?.pi?.value === 1.78, `mcaPi=${calcs.middleCerebralArtery?.pi?.value}`);
}

// TEST 5: Doppler Calculations on page 3 of a merged 4-page text
{
  const merged = ['=== PAGE 1 ===', 'Patient: TEST', '', '=== PAGE 2 ===', 'BPD 60.33mm', '', '=== PAGE 3 ===', 'CPR (Ebbing) 0.92 <1%', '', '=== PAGE 4 ===', 'HC 225.96mm'].join('\n');
  const calcs = parseDopplerCalculations(merged);
  check('TEST 5: Doppler Calculations on page 3 of 4 => still found after merge', (calcs.middleCerebralArtery as any)?.cpr?.value === 0.92, `cpr=${(calcs.middleCerebralArtery as any)?.cpr?.value}`);
}

// TEST 6: 3-page report — existing measurements (BPD/HC) must not be lost by the new Doppler Calculations wiring
{
  const extractedData: any = {
    measurements: { bpd: { value: 60.33, unit: 'mm' }, hc: { value: 225.96, unit: 'mm' } },
    doppler: { calculations: parseDopplerCalculations(RAW_TEXT) },
  };
  const normalized = normalizeExtractedData(extractedData, baseReport, [], 'online_ai');
  const ok = normalized.measurements.bpd.value === 60.33 && normalized.measurements.hc.value === 225.96 && normalized.doppler.calculations?.umbilicalArtery?.pi?.value === 1.94;
  check('TEST 6: BPD/HC measurements unaffected by Doppler Calculations wiring', ok, `bpd=${normalized.measurements.bpd.value}, hc=${normalized.measurements.hc.value}, uaPi=${normalized.doppler.calculations?.umbilicalArtery?.pi?.value}`);
}

// TEST 7: DV PI = 0.50 preserved exactly
{
  const calc = parseDopplerCalculations(RAW_TEXT);
  check('TEST 7: DV PI = 0.50 preserved exactly', calc.ductusVenosus?.pi?.value === 0.50, `dvPi=${calc.ductusVenosus?.pi?.value}`);
}

// TEST 8: DV PI percentile = 74.2% preserved exactly
{
  const calc = parseDopplerCalculations(RAW_TEXT);
  check('TEST 8: DV PI percentile = 74.2% preserved exactly', calc.ductusVenosus?.pi?.percentile === '74.2%', `dvPi%=${calc.ductusVenosus?.pi?.percentile}`);
}

// TEST 9: MCA PS MoM = 1.24 preserved exactly
{
  const calc = parseDopplerCalculations(RAW_TEXT);
  check('TEST 9: MCA PS MoM = 1.24 preserved exactly', calc.middleCerebralArtery?.ps?.mom === 1.24, `mom=${calc.middleCerebralArtery?.ps?.mom}`);
}

// TEST 10: CPR = 0.92 preserved exactly
{
  const calc = parseDopplerCalculations(RAW_TEXT);
  check('TEST 10: CPR = 0.92 preserved exactly', (calc.middleCerebralArtery as any)?.cpr?.value === 0.92, `cpr=${(calc.middleCerebralArtery as any)?.cpr?.value}`);
}

// TEST 11: UA PI = 1.94 with percentile >99% preserved (this is the exact case that
// was broken by the nested-parenthesis "(JSUM(2001))" method bug before this phase)
{
  const calc = parseDopplerCalculations(RAW_TEXT);
  check(
    'TEST 11: UA PI = 1.94, percentile >99% preserved (nested-paren method fix)',
    calc.umbilicalArtery?.pi?.value === 1.94 && calc.umbilicalArtery?.pi?.percentile === '>99%',
    `uaPi=${calc.umbilicalArtery?.pi?.value}, uaPi%=${calc.umbilicalArtery?.pi?.percentile}, method=${calc.umbilicalArtery?.pi?.method}`
  );
}

// TEST 12: No Doppler Calculations in text => doppler.calculations stays empty/valid, no fake data
{
  const calc = parseDopplerCalculations('Kham thai dinh ky, khong co doppler calculations.');
  const allEmpty =
    Object.keys(calc.umbilicalArtery || {}).length === 0 &&
    Object.keys(calc.middleCerebralArtery || {}).length === 0 &&
    Object.keys(calc.ductusVenosus || {}).length === 0 &&
    Object.keys(calc.leftUterine || {}).length === 0 &&
    Object.keys(calc.rightUterine || {}).length === 0;
  check('TEST 12: no Doppler Calculations text => empty groups, no fabricated data', allEmpty, JSON.stringify(calc));
}

// ============================================================
// E2E ASSERTIONS (task section 6) — every field checked by name
// against result.doppler.calculations after full normalizeExtractedData,
// not just against the raw parser output.
// ============================================================
{
  const directDopplerCalcs = parseDopplerCalculations(RAW_TEXT);
  const extractedData: any = { doppler: { calculations: directDopplerCalcs } };
  const result = normalizeExtractedData(extractedData, baseReport, [], 'online_ai');
  const c = result.doppler.calculations!;

  const assertions: [string, boolean, string][] = [
    ['UA PI === 1.94', c.umbilicalArtery?.pi?.value === 1.94, `${c.umbilicalArtery?.pi?.value}`],
    ['UA PI percentile === >99%', c.umbilicalArtery?.pi?.percentile === '>99%', `${c.umbilicalArtery?.pi?.percentile}`],
    ['DV PI === 0.50', c.ductusVenosus?.pi?.value === 0.50, `${c.ductusVenosus?.pi?.value}`],
    ['DV PI percentile === 74.2%', c.ductusVenosus?.pi?.percentile === '74.2%', `${c.ductusVenosus?.pi?.percentile}`],
    ['DV PLI === 0.43', c.ductusVenosus?.pli?.value === 0.43, `${c.ductusVenosus?.pli?.value}`],
    ['DV PVIV === 0.66', c.ductusVenosus?.pviv?.value === 0.66, `${c.ductusVenosus?.pviv?.value}`],
    ['DV S/a === 1.76', c.ductusVenosus?.sa?.value === 1.76, `${c.ductusVenosus?.sa?.value}`],
    ['DV a/S === 0.57', c.ductusVenosus?.aS?.value === 0.57, `${c.ductusVenosus?.aS?.value}`],
    ['Left Ut PI === 3.10', c.leftUterine?.pi?.value === 3.10, `${c.leftUterine?.pi?.value}`],
    ['Right Ut PI === 1.88', c.rightUterine?.pi?.value === 1.88, `${c.rightUterine?.pi?.value}`],
    ['MCA PI === 1.78', c.middleCerebralArtery?.pi?.value === 1.78, `${c.middleCerebralArtery?.pi?.value}`],
    ['MCA PS === 52.40', c.middleCerebralArtery?.ps?.value === 52.40, `${c.middleCerebralArtery?.ps?.value}`],
    ['MCA PS MoM === 1.24', c.middleCerebralArtery?.ps?.mom === 1.24, `${c.middleCerebralArtery?.ps?.mom}`],
    ['MCA TAMX === 24.17', c.middleCerebralArtery?.tamax?.value === 24.17, `${c.middleCerebralArtery?.tamax?.value}`],
    ['CPR === 0.92', (c.middleCerebralArtery as any)?.cpr?.value === 0.92, `${(c.middleCerebralArtery as any)?.cpr?.value}`],
    ['CPR percentile === <1%', (c.middleCerebralArtery as any)?.cpr?.percentile === '<1%', `${(c.middleCerebralArtery as any)?.cpr?.percentile}`],
  ];
  for (const [label, ok, got] of assertions) {
    check(`E2E (result.doppler.calculations): ${label}`, ok, `got=${got}`);
  }
}

// ============================================================
// TEST 13 (task section 7) — 3-page regression via the actual
// multiImageOcrPipeline-style flow: parse Doppler Calculations once from the
// merged text, and separately feed vessel-level Doppler measurements +
// 2D measurements + patient info through normalizeExtractedData, exactly as
// multiImageOcrPipeline.ts now does. Confirms nothing is lost when merging.
// ============================================================
{
  const page1 = '=== PAGE 1 ===\nPatient: NGUYEN THI B\nBPD 60.33mm\nHC 225.96mm';
  const page2 = `=== PAGE 2 ===\n${RAW_TEXT}`;
  const page3 = '=== PAGE 3 ===\nUmbilical Artery PI 0.86\nMCA PI 1.48';
  const merged = [page1, page2, page3].join('\n\n');

  // Mirrors multiImageOcrPipeline.ts's Phase 5 wiring: parse once on the
  // full merged text, then hand off measurements/patient (as the local
  // regex parser would already have found them) plus the parsed calculations.
  const dopplerCalcs = parseDopplerCalculations(merged);
  const extractedData: any = {
    patient: { name: 'NGUYEN THI B' },
    measurements: { bpd: { value: 60.33, unit: 'mm' }, hc: { value: 225.96, unit: 'mm' } },
    doppler: {
      umbilicalArtery: { pi: 0.86 },
      middleCerebralArtery: { pi: 1.48 },
      calculations: dopplerCalcs,
    },
  };
  const result = normalizeExtractedData(extractedData, baseReport, [], 'online_ai');

  const patientOk = result.patient.name === 'NGUYEN THI B';
  const measurementsOk = result.measurements.bpd.value === 60.33 && result.measurements.hc.value === 225.96;
  const dopplerMeasurementsOk = result.doppler.umbilicalArtery.pi === 0.86 && result.doppler.middleCerebralArtery.pi === 1.48;
  const dopplerCalcsOk = result.doppler.calculations?.umbilicalArtery?.pi?.value === 1.94 && result.doppler.calculations?.ductusVenosus?.pi?.value === 0.50;

  check('TEST 13a (3-page merge): patient survives', patientOk, `patient.name=${result.patient.name}`);
  check('TEST 13b (3-page merge): 2D measurements survive', measurementsOk, `bpd=${result.measurements.bpd.value}, hc=${result.measurements.hc.value}`);
  check('TEST 13c (3-page merge): Doppler vessel measurements survive', dopplerMeasurementsOk, `uaPi=${result.doppler.umbilicalArtery.pi}, mcaPi=${result.doppler.middleCerebralArtery.pi}`);
  check('TEST 13d (3-page merge): doppler.calculations survives (page 2 content)', dopplerCalcsOk, `uaCalcPi=${result.doppler.calculations?.umbilicalArtery?.pi?.value}, dvCalcPi=${result.doppler.calculations?.ductusVenosus?.pi?.value}`);
}

// Print results
let allPassed = true;
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testName} — ${r.message}`);
  if (!r.passed) allPassed = false;
}
console.log(`\n${results.filter(r => r.passed).length}/${results.length} Doppler Calculations tests passed.`);
if (!allPassed) process.exit(1);
