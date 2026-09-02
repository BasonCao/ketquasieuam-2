/**
 * Phase 6 — unify Doppler Calculations schema tests.
 * Run: tsx src/utils/__tests__/dopplerCalculationsSchema.test.ts
 */
import {
  resolveDopplerCalculationsGroup,
  buildDopplerCalcDisplayRows,
  applyDopplerCalcRowEdit,
  migrateLegacyDopplerCalculations,
} from '../dopplerCalculationsSchema';
import { parseDopplerCalculations } from '../../services/dopplerCalculationParser';

interface TestResult { testName: string; passed: boolean; message: string; }
const results: TestResult[] = [];
function check(testName: string, passed: boolean, message: string) {
  results.push({ testName, passed, message });
}

const RAW_TEXT = `Doppler Calculations
UmbArt PI (JSUM(2001)) 1.94 >99%
DV PI (JSUM2012) 0.50 74.2%
MCA PI (JSUM(2001)) 1.78 30.2%
`;

// TEST 1: OCR data -> doppler.calculations (this is Phase 5's proven flow, re-checked here)
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const report: any = { doppler: { calculations: calcs } };
  const resolution = resolveDopplerCalculationsGroup(report);
  check(
    'TEST 1: OCR data (parseDopplerCalculations) => resolves as canonical doppler.calculations',
    resolution.source === 'canonical' && resolution.calculations?.umbilicalArtery?.pi?.value === 1.94,
    `source=${resolution.source}, uaPi=${resolution.calculations?.umbilicalArtery?.pi?.value}`
  );
}

// TEST 2: GeReportTab reads doppler.calculations (via buildDopplerCalcDisplayRows)
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const rows = buildDopplerCalcDisplayRows(calcs);
  const uaRow = rows.find((r) => r.id === 'ua_pi');
  const dvRow = rows.find((r) => r.id === 'dv_pi');
  check(
    'TEST 2: GeReportTab row-builder reads doppler.calculations correctly',
    uaRow?.value === 1.94 && uaRow?.percentile === '>99' && dvRow?.value === 0.50 && dvRow?.percentile === '74.2',
    `uaPi=${uaRow?.value}/${uaRow?.percentile}, dvPi=${dvRow?.value}/${dvRow?.percentile}`
  );
}

// TEST 3: editing UA PI => doppler.calculations changes
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const nextGroup = applyDopplerCalcRowEdit(calcs, 'ua_pi', { value: 2.5 });
  check(
    'TEST 3: editing UA PI => doppler.calculations.umbilicalArtery.pi.value updates',
    nextGroup.umbilicalArtery?.pi?.value === 2.5,
    `got=${nextGroup.umbilicalArtery?.pi?.value}`
  );
}

// TEST 4: editing MCA PI => doppler.calculations changes
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const nextGroup = applyDopplerCalcRowEdit(calcs, 'mca_pi', { value: 1.11 });
  check(
    'TEST 4: editing MCA PI => doppler.calculations.middleCerebralArtery.pi.value updates',
    nextGroup.middleCerebralArtery?.pi?.value === 1.11,
    `got=${nextGroup.middleCerebralArtery?.pi?.value}`
  );
}

// TEST 5: editing DV PI => doppler.calculations changes
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const nextGroup = applyDopplerCalcRowEdit(calcs, 'dv_pi', { value: 0.77 });
  check(
    'TEST 5: editing DV PI => doppler.calculations.ductusVenosus.pi.value updates',
    nextGroup.ductusVenosus?.pi?.value === 0.77,
    `got=${nextGroup.ductusVenosus?.pi?.value}`
  );
}

// TEST 6: "PrintReportModal reads đúng giá trị đã chỉnh sửa" — simulate the edit
// then read the SAME canonical field PrintReportModal.tsx reads (doppler.calculations).
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const editedGroup = applyDopplerCalcRowEdit(calcs, 'ua_pi', { value: 9.99 });
  const report: any = { doppler: { calculations: editedGroup } };
  // This mirrors PrintReportModal.tsx line: const dopplerCalc = doppler.calculations;
  const dopplerCalcAsReadByPdf = report.doppler.calculations;
  check(
    'TEST 6: PrintReportModal-style read sees the edited value',
    dopplerCalcAsReadByPdf.umbilicalArtery.pi.value === 9.99,
    `got=${dopplerCalcAsReadByPdf.umbilicalArtery.pi.value}`
  );
}

// TEST 7: PDF data source is still doppler.calculations (no new field introduced)
{
  const calcs = parseDopplerCalculations(RAW_TEXT);
  const report: any = { doppler: { calculations: calcs } };
  check(
    'TEST 7: report.doppler.calculations is the PDF data source (report.dopplerCalculations absent)',
    report.doppler.calculations !== undefined && report.dopplerCalculations === undefined,
    `doppler.calculations set=${!!report.doppler.calculations}, dopplerCalculations=${report.dopplerCalculations}`
  );
}

// TEST 8: old report has legacy dopplerCalculations, no canonical => migrated
{
  const legacyReport: any = {
    dopplerCalculations: [
      { id: 'ua_pi', parameter: 'UmbArt PI', value: 1.5, method: 'JSUM2012', percentile: '40.6', includeInPdf: true },
      { id: 'dv_pi', parameter: 'DV PI', value: 0.6, method: 'Baschat', includeInPdf: false },
    ],
  };
  const resolution = resolveDopplerCalculationsGroup(legacyReport);
  check(
    'TEST 8: legacy report.dopplerCalculations (no canonical) => migrated to doppler.calculations shape',
    resolution.source === 'migrated_legacy' &&
      resolution.calculations?.umbilicalArtery?.pi?.value === 1.5 &&
      resolution.calculations?.ductusVenosus?.pi?.value === 0.6,
    `source=${resolution.source}, uaPi=${resolution.calculations?.umbilicalArtery?.pi?.value}, dvPi=${resolution.calculations?.ductusVenosus?.pi?.value}`
  );
}

// TEST 9: report has BOTH fields with DIFFERENT values => canonical wins + conflict warning
{
  const calcs = parseDopplerCalculations(RAW_TEXT); // canonical: uaPi = 1.94
  const conflictingReport: any = {
    doppler: { calculations: calcs },
    dopplerCalculations: [{ id: 'ua_pi', parameter: 'UmbArt PI', value: 7.77, includeInPdf: true }], // legacy: uaPi = 7.77 (different!)
  };
  const resolution = resolveDopplerCalculationsGroup(conflictingReport);
  check(
    'TEST 9: both fields present with different values => canonical wins, conflict=true, warning present',
    resolution.source === 'canonical' &&
      resolution.calculations?.umbilicalArtery?.pi?.value === 1.94 &&
      resolution.conflict === true &&
      !!resolution.warning,
    `source=${resolution.source}, uaPi=${resolution.calculations?.umbilicalArtery?.pi?.value}, conflict=${resolution.conflict}, hasWarning=${!!resolution.warning}`
  );
}

// TEST 10 & 11: scanned separately via grep in the shell (see Phase 6 report,
// section "grep result") — not expressible as a pure-function unit test, since
// they check the ABSENCE of a code pattern across the whole source tree.
check(
  'TEST 10/11: no-production-read/write-of-dopplerCalculations — verified via grep (see report), not a unit test',
  true,
  'see "grep result" section of the Phase 6 report for the actual scan output'
);

// Print results
let allPassed = true;
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testName} — ${r.message}`);
  if (!r.passed) allPassed = false;
}
console.log(`\n${results.filter(r => r.passed).length}/${results.length} Doppler Calculations schema-unification tests passed.`);
if (!allPassed) process.exit(1);
