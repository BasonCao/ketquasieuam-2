/**
 * Phase 4 — PDF data-logic verification.
 *
 * IMPORTANT LIMITATION (reported honestly per Phase 4 Section 17/19):
 * exportReportToPdf() in pdfExport.ts works by screenshotting a live DOM node
 * (html2canvas) then embedding that image into a jsPDF document — it does not
 * take report data as input at all. A true end-to-end test ("render the
 * report, export a PDF, extract its text") would require React + jsdom + a
 * canvas implementation, none of which are installed in this sandbox and
 * cannot be installed here (no network access to npm registry — confirmed
 * 403 in earlier phases). That kind of test could not be run here.
 *
 * What IS tested here, verbatim against the real logic in
 * PrintReportModal.tsx (copied 1:1, not reimplemented from a description),
 * is the pure, DOM-free data-shaping logic that decides WHAT reaches the
 * screen (and therefore the PDF screenshot): `formatPdfValue` and the
 * `pushCalcRow`/`dopplerCalcRows` builder for the Doppler Calculations
 * section (lines 593-629 of PrintReportModal.tsx). Everything else relevant
 * (EFW, CM, Vp/NBL/BOD/Foot/CRL/NT, Cervix/YS, AFI, IVF dating) was verified
 * by static code citation in the Phase 4 report rather than executed here,
 * since it lives inside JSX that requires React to evaluate.
 */

interface TestResult { testName: string; passed: boolean; message: string; }
const results: TestResult[] = [];
function check(testName: string, passed: boolean, message: string) {
  results.push({ testName, passed, message });
}

// --- verbatim copy of PrintReportModal.tsx lines 593-629 ---
const formatPdfValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && isNaN(value)) return '';
  return `${value}`;
};

type CalcItem = { value: number | null; percentile?: string | null; mom?: number | null } | null | undefined;
type CalcGroup = {
  umbilicalArtery?: { pi?: CalcItem };
  middleCerebralArtery?: { pi?: CalcItem; ps?: CalcItem; tamax?: CalcItem; cpr?: CalcItem };
  leftUterine?: { pi?: CalcItem };
  rightUterine?: { pi?: CalcItem };
  ductusVenosus?: { pi?: CalcItem; pli?: CalcItem; pviv?: CalcItem; sa?: CalcItem; aS?: CalcItem };
};

function buildDopplerCalcRows(dopplerCalc: CalcGroup | undefined | null) {
  const dopplerCalcRows: { key: string; label: string; value: string; extra?: string }[] = [];
  const pushCalcRow = (key: string, label: string, item?: CalcItem, extraLabel?: string) => {
    if (!item || item.value === null || item.value === undefined || (typeof item.value === 'number' && isNaN(item.value))) return;
    const extraParts: string[] = [];
    if (item.percentile) extraParts.push(`${item.percentile}`);
    if (item.mom !== null && item.mom !== undefined) extraParts.push(`MoM ${item.mom}`);
    dopplerCalcRows.push({ key, label, value: formatPdfValue(item.value), extra: extraParts.length ? extraParts.join(', ') : undefined });
  };
  if (dopplerCalc) {
    pushCalcRow('uaPi', 'UA PI', dopplerCalc.umbilicalArtery?.pi);
    pushCalcRow('mcaPi', 'MCA PI', dopplerCalc.middleCerebralArtery?.pi);
    pushCalcRow('mcaPs', 'MCA PS', dopplerCalc.middleCerebralArtery?.ps);
    pushCalcRow('mcaTamax', 'MCA TAMX', dopplerCalc.middleCerebralArtery?.tamax);
    pushCalcRow('cpr', 'CPR', dopplerCalc.middleCerebralArtery?.cpr);
    pushCalcRow('leftUtPi', 'Left Ut PI', dopplerCalc.leftUterine?.pi);
    pushCalcRow('rightUtPi', 'Right Ut PI', dopplerCalc.rightUterine?.pi);
    pushCalcRow('dvPi', 'DV PI', dopplerCalc.ductusVenosus?.pi);
    pushCalcRow('dvPli', 'DV PLI', dopplerCalc.ductusVenosus?.pli);
    pushCalcRow('dvPviv', 'DV PVIV', dopplerCalc.ductusVenosus?.pviv);
    pushCalcRow('dvSa', 'DV S/a', dopplerCalc.ductusVenosus?.sa);
    pushCalcRow('dvAs', 'DV a/S', dopplerCalc.ductusVenosus?.aS);
  }
  return dopplerCalcRows;
}
// --- end verbatim copy ---

// TEST: formatPdfValue never leaks null/undefined/NaN (requirement 13, TEST 10)
{
  const cases: [unknown, string][] = [
    [null, ''], [undefined, ''], [NaN, ''], [0, '0'], ['', ''], ['5.92', '5.92'], [727, '727'],
  ];
  const allOk = cases.every(([input, expected]) => formatPdfValue(input) === expected);
  check('TEST 10: formatPdfValue never prints "undefined"/"null"/"NaN"', allOk, JSON.stringify(cases.map(([i]) => [i, formatPdfValue(i)])));
}

// TEST 7 (adapted to Doppler Calculations): full data => section renders all rows
{
  const rows = buildDopplerCalcRows({
    umbilicalArtery: { pi: { value: 0.86 } },
    middleCerebralArtery: { pi: { value: 1.48 }, ps: { value: 51.2 }, tamax: { value: 30.1 }, cpr: { value: 1.72 } },
    leftUterine: { pi: { value: 0.9 } },
    rightUterine: { pi: { value: 0.95 } },
    ductusVenosus: { pi: { value: 0.62 }, pli: { value: 1.1 }, pviv: { value: 0.4 }, sa: { value: 2.1 }, aS: { value: 0.48 } },
  });
  check(
    'TEST 7: full Doppler Calculations data => all 12 rows built',
    rows.length === 12 && rows.find(r => r.key === 'dvPi')?.value === '0.62',
    `rows=${rows.length}, dvPi=${rows.find(r => r.key === 'dvPi')?.value}`
  );
}

// TEST: no data => empty rows => section does not render (requirement 10 "không render section rỗng")
{
  const rowsUndefined = buildDopplerCalcRows(undefined);
  const rowsEmpty = buildDopplerCalcRows({});
  check(
    'TEST: no Doppler Calculations data => 0 rows (section stays hidden)',
    rowsUndefined.length === 0 && rowsEmpty.length === 0,
    `undefined=${rowsUndefined.length}, empty={}=${rowsEmpty.length}`
  );
}

// TEST 6 (adapted): DV present, only PI required per spec — PI still renders correctly
// even if other DV sub-fields (S/D/a/PLI/PVIV) are absent.
{
  const rows = buildDopplerCalcRows({ ductusVenosus: { pi: { value: 0.55 } } });
  check(
    'TEST 6: DV with only PI present => DV PI row renders, others absent',
    rows.length === 1 && rows[0].key === 'dvPi' && rows[0].value === '0.55',
    `rows=${JSON.stringify(rows)}`
  );
}

// TEST: percentile/MoM extras attach correctly without leaking null
{
  const rows = buildDopplerCalcRows({
    middleCerebralArtery: { ps: { value: 51.2, mom: 1.05, percentile: null } },
  });
  check(
    'TEST: percentile null is omitted, MoM present is included',
    rows[0].extra === 'MoM 1.05',
    `extra=${rows[0].extra}`
  );
}

// TEST: NaN value item is skipped entirely (not just formatted as empty string row)
{
  const rows = buildDopplerCalcRows({ umbilicalArtery: { pi: { value: NaN } } });
  check('TEST: NaN item is skipped, not pushed as a blank row', rows.length === 0, `rows=${rows.length}`);
}

// Print results
let allPassed = true;
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testName} — ${r.message}`);
  if (!r.passed) allPassed = false;
}
console.log(`\n${results.filter(r => r.passed).length}/${results.length} PDF data-logic tests passed.`);
if (!allPassed) process.exit(1);
