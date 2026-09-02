import { parseUltrasoundReportText } from '../../services/offlineOcrService';
import { normalizeExtractedData, createCleanMeasurements, createCleanDoppler, createCleanAmniotic } from '../normalizeReportData';
import { normalizeDopplerSectionHeader, normalizeDopplerVelocity, normalizeDopplerIndex } from '../clinicalCalculations';
import { UltrasoundReport } from '../../types/ultrasound';

const baseReport: UltrasoundReport = {
  id: 'test-doppler',
  patient: {
    name: 'NGUYEN THI TEST',
    patientId: 'BN99999',
    yearOfBirth: '1996',
    age: '29',
    phone: '0912345678',
    address: 'Hà Nội',
    gender: 'Nữ',
    clinicHeader: 'Phòng Khám Sản Phụ Khoa',
    sonographer: 'Bác sĩ',
    examDate: '02/01/2026',
    indication: 'Khám thai',
    lmp: '',
    doc: '',
    gaClin: '28w0d',
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
    firstVisitDate: '02/01/2026',
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

export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
}

export function runDopplerVerificationTests(): TestResult[] {
  const results: TestResult[] = [];

  const assertEqual = (name: string, actual: any, expected: any, description?: string) => {
    const passed = actual === expected;
    results.push({
      testName: name,
      passed,
      message: passed 
        ? `${description || name} passed (${actual})`
        : `${description || name} FAILED: expected ${expected}, got ${actual}`,
    });
  };

  // 1. Header Classification Tests
  assertEqual("Header MCA 1", normalizeDopplerSectionHeader('Right Mid Cereb Artery'), 'middleCerebralArtery');
  assertEqual("Header MCA 2", normalizeDopplerSectionHeader('Left Mid Cereb Artery'), 'middleCerebralArtery');
  assertEqual("Header MCA 3", normalizeDopplerSectionHeader('Mid Cereb Artery'), 'middleCerebralArtery');
  assertEqual("Header MCA 4", normalizeDopplerSectionHeader('Middle Cerebral Artery'), 'middleCerebralArtery');
  assertEqual("Header MCA 5", normalizeDopplerSectionHeader('MCA'), 'middleCerebralArtery');
  assertEqual("Header UA 1", normalizeDopplerSectionHeader('Umbilical Art.'), 'umbilicalArtery');
  assertEqual("Header UA 2", normalizeDopplerSectionHeader('Umbilical Art'), 'umbilicalArtery');
  assertEqual("Header UA 3", normalizeDopplerSectionHeader('Umbilical Artery'), 'umbilicalArtery');
  assertEqual("Header UA 4", normalizeDopplerSectionHeader('UA'), 'umbilicalArtery');
  assertEqual("Header FHR 1", normalizeDopplerSectionHeader('FETAL HEART RATE'), 'fhr');
  assertEqual("Header FHR 2", normalizeDopplerSectionHeader('Ventricular FHR'), 'fhr');

  // 2. Decimal & Sign Normalization Tests for Doppler Velocity
  assertEqual("Velocity 3831 -> 38.31", normalizeDopplerVelocity(3831), 38.31);
  assertEqual("Velocity 5929 -> 59.29", normalizeDopplerVelocity(5929), 59.29);
  assertEqual("Velocity 1561 -> 15.61", normalizeDopplerVelocity(1561), 15.61);
  assertEqual("Velocity 2990 -> 29.90", normalizeDopplerVelocity(2990), 29.90);
  assertEqual("Velocity 1134 -> 11.34", normalizeDopplerVelocity(1134), 11.34);
  assertEqual("Velocity 1712 -> 17.12", normalizeDopplerVelocity(1712), 17.12);
  assertEqual("Velocity 2599 -> 25.99", normalizeDopplerVelocity(2599), 25.99);
  assertEqual("Velocity 1670 -> 16.70", normalizeDopplerVelocity(1670), 16.70);
  assertEqual("Velocity Decimal Preserved 59.29", normalizeDopplerVelocity(59.29), 59.29);
  assertEqual("Velocity Decimal Preserved 38.31", normalizeDopplerVelocity(38.31), 38.31);
  // Negative velocities
  assertEqual("Negative Velocity -66.90 Preserved", normalizeDopplerVelocity(-66.90), -66.90);
  assertEqual("Negative Velocity -5.01 Preserved", normalizeDopplerVelocity(-5.01), -5.01);
  assertEqual("Negative Velocity -16.68 Preserved", normalizeDopplerVelocity(-16.68), -16.68);
  assertEqual("Negative Velocity -4.51 Preserved", normalizeDopplerVelocity(-4.51), -4.51);
  assertEqual("Negative Velocity -6690 -> -66.90", normalizeDopplerVelocity(-6690), -66.90);

  // 3. Doppler Index Normalization Tests (RI, PI, S/D)
  assertEqual("RI 74 -> 0.74", normalizeDopplerIndex(74, 'ri'), 0.74);
  assertEqual("RI 0.74 Preserved", normalizeDopplerIndex(0.74, 'ri'), 0.74);
  assertEqual("RI 55 -> 0.55", normalizeDopplerIndex(55, 'ri'), 0.55);
  assertEqual("PI 146 -> 1.46", normalizeDopplerIndex(146, 'pi'), 1.46);
  assertEqual("PI 82 -> 0.82", normalizeDopplerIndex(82, 'pi'), 0.82);
  assertEqual("PI 1.46 Preserved", normalizeDopplerIndex(1.46, 'pi'), 1.46);
  assertEqual("S/D 380 -> 3.80", normalizeDopplerIndex(380, 'sd'), 3.80);
  assertEqual("S/D 224 -> 2.24", normalizeDopplerIndex(224, 'sd'), 2.24);
  assertEqual("S/D 3.80 Preserved", normalizeDopplerIndex(3.80, 'sd'), 3.80);

  // 4. End-to-End GE Voluson OCR Text Parsing Test (User's Exact Case)
  const rawOcrReport = `
GE Healthcare Voluson E8
Patient: TRAN THI B   ID: 123456   GA: 28w2d

2D Measurements
BPD (Hadlock) 72.5 mm
HC (Hadlock) 265.4 mm
AC (Hadlock) 242.1 mm
FL (Hadlock) 54.3 mm

RIGHT MID CEREB ARTERY
PS 59.29 cm/s
ED 15.61 cm/s
TAmax 29.90 cm/s
MD 11.34 cm/s
RI 0.74
PI 1.46
S/D 3.80
HR 168 bpm

FETAL HEART RATE
Ventricular FHR 183 bpm

UMBILICAL ART.
PS 38.31 cm/s
ED 17.12 cm/s
TAmax 25.99 cm/s
MD 16.70 cm/s
RI 0.55
PI 0.82
S/D 2.24
HR 186 bpm
`;

  const parsed = parseUltrasoundReportText(rawOcrReport);
  const mca = parsed.doppler.middleCerebralArtery!;
  const ua = parsed.doppler.umbilicalArtery!;

  assertEqual("Parsed MCA PS", mca?.ps, 59.29);
  assertEqual("Parsed MCA ED", mca?.ed, 15.61);
  assertEqual("Parsed MCA TAmax", mca?.tamax, 29.90);
  assertEqual("Parsed MCA MD", mca?.md, 11.34);
  assertEqual("Parsed MCA RI", mca?.ri, 0.74);
  assertEqual("Parsed MCA PI", mca?.pi, 1.46);
  assertEqual("Parsed MCA S/D", mca?.sd, 3.80);
  assertEqual("Parsed MCA HR", mca?.hr, 168);

  assertEqual("Parsed UA PS", ua?.ps, 38.31);
  assertEqual("Parsed UA ED", ua?.ed, 17.12);
  assertEqual("Parsed UA TAmax", ua?.tamax, 25.99);
  assertEqual("Parsed UA MD", ua?.md, 16.70);
  assertEqual("Parsed UA RI", ua?.ri, 0.55);
  assertEqual("Parsed UA PI", ua?.pi, 0.82);
  assertEqual("Parsed UA S/D", ua?.sd, 2.24);
  assertEqual("Parsed UA HR", ua?.hr, 186);

  assertEqual("Parsed FHR Value", parsed.doppler.fhr?.value, 183);

  // Biometry assertions (ensuring zero regression)
  assertEqual("Biometry BPD", parsed.measurements.bpd?.value, 72.5);
  assertEqual("Biometry HC", parsed.measurements.hc?.value, 265.4);
  assertEqual("Biometry AC", parsed.measurements.ac?.value, 242.1);
  assertEqual("Biometry FL", parsed.measurements.fl?.value, 54.3);

  // 5. OCR with Decimal Drop & Aliases Test
  const rawOcrWithErrorAndAliases = `
RIGHT MID CEREB ARTERY
PS 5929 cm/s
ED 1561 cm/s
TA Max 2990 cm/s
MD 1134 cm/s
RI 74
Pl 146
S / D 380
HR 168 bpm

FETAL HEART RATE
Ventricular FHR 183 bpm

UMBILICAL ART.
PS 3831 cm/s
ED 1712 cm/s
TAMax. 2599 cm/s
MD 1670 cm/s
RI 55
PI 82
S-D 224
HR 186 bpm
`;

  const parsedErr = parseUltrasoundReportText(rawOcrWithErrorAndAliases);
  const mcaErr = parsedErr.doppler.middleCerebralArtery!;
  const uaErr = parsedErr.doppler.umbilicalArtery!;

  assertEqual("Fixed MCA PS (5929->59.29)", mcaErr?.ps, 59.29);
  assertEqual("Fixed MCA ED (1561->15.61)", mcaErr?.ed, 15.61);
  assertEqual("Fixed MCA TA Max alias (2990->29.90)", mcaErr?.tamax, 29.90);
  assertEqual("Fixed MCA MD (1134->11.34)", mcaErr?.md, 11.34);
  assertEqual("Fixed MCA RI (74->0.74)", mcaErr?.ri, 0.74);
  assertEqual("Fixed MCA Pl alias (146->1.46)", mcaErr?.pi, 1.46);
  assertEqual("Fixed MCA S / D alias (380->3.80)", mcaErr?.sd, 3.80);
  assertEqual("MCA HR 168", mcaErr?.hr, 168);

  assertEqual("Fixed UA PS (3831->38.31)", uaErr?.ps, 38.31);
  assertEqual("Fixed UA ED (1712->17.12)", uaErr?.ed, 17.12);
  assertEqual("Fixed UA TAMax. alias (2599->25.99)", uaErr?.tamax, 25.99);
  assertEqual("Fixed UA MD (1670->16.70)", uaErr?.md, 16.70);
  assertEqual("Fixed UA RI (55->0.55)", uaErr?.ri, 0.55);
  assertEqual("Fixed UA PI (82->0.82)", uaErr?.pi, 0.82);
  assertEqual("Fixed UA S-D alias (224->2.24)", uaErr?.sd, 2.24);
  assertEqual("UA HR 186", uaErr?.hr, 186);

  assertEqual("Ventricular FHR (183)", parsedErr.doppler.fhr?.value, 183);

  // 6. normalizeExtractedData Integration Test
  const mockExtracted = {
    ventricularFHR: 183,
    doppler: {
      'Right Mid Cereb Artery': {
        ps: 5929,
        ed: 1561,
        tamax: 2990,
        md: 1134,
        ri: 0.74,
        pi: 1.46,
        sd: 3.80,
        hr: 168,
      },
      'Umbilical Art.': {
        ps: 3831,
        ed: 1712,
        tamax: 2599,
        md: 1670,
        ri: 0.55,
        pi: 0.82,
        sd: 2.24,
        hr: 186,
      },
    },
  };

  const normalized = normalizeExtractedData(mockExtracted, baseReport, [], 'online_ai');

  assertEqual("Normalized MCA PS", normalized.doppler.middleCerebralArtery.ps, 59.29);
  assertEqual("Normalized MCA ED", normalized.doppler.middleCerebralArtery.ed, 15.61);
  assertEqual("Normalized MCA TAmax", normalized.doppler.middleCerebralArtery.tamax, 29.90);
  assertEqual("Normalized MCA MD", normalized.doppler.middleCerebralArtery.md, 11.34);
  assertEqual("Normalized MCA RI", normalized.doppler.middleCerebralArtery.ri, 0.74);
  assertEqual("Normalized MCA PI", normalized.doppler.middleCerebralArtery.pi, 1.46);
  assertEqual("Normalized MCA SD", normalized.doppler.middleCerebralArtery.sd, 3.80);
  assertEqual("Normalized MCA HR", normalized.doppler.middleCerebralArtery.hr, 168);

  assertEqual("Normalized UA PS", normalized.doppler.umbilicalArtery.ps, 38.31);
  assertEqual("Normalized UA ED", normalized.doppler.umbilicalArtery.ed, 17.12);
  assertEqual("Normalized UA TAmax", normalized.doppler.umbilicalArtery.tamax, 25.99);
  assertEqual("Normalized UA MD", normalized.doppler.umbilicalArtery.md, 16.70);
  assertEqual("Normalized UA RI", normalized.doppler.umbilicalArtery.ri, 0.55);
  assertEqual("Normalized UA PI", normalized.doppler.umbilicalArtery.pi, 0.82);
  assertEqual("Normalized UA SD", normalized.doppler.umbilicalArtery.sd, 2.24);
  assertEqual("Normalized UA HR", normalized.doppler.umbilicalArtery.hr, 186);

  assertEqual("Normalized FHR", normalized.doppler.fhr.value, 183);

  // 7. User's Mandatory Negative Doppler Test (Right Uterine)
  const rawNegativeUterineReport = `
Right Uterine
PS -66.90 cm/s
ED -5.01 cm/s
TAmax -16.68 cm/s
MD -4.51 cm/s
RI 0.93
PI 3.71
S/D 13.35
HR 66 bpm

Left Uterine
PS 87.80 cm/s
ED 14.26 cm/s
TAmax 34.31 cm/s
MD 13.93 cm/s
RI 0.84
PI 2.14
S/D 6.16
HR 74 bpm
`;

  const parsedNegative = parseUltrasoundReportText(rawNegativeUterineReport);
  const ru = parsedNegative.doppler.rightUterine!;
  const lu = parsedNegative.doppler.leftUterine!;

  assertEqual("Negative Right Uterine PS (-66.90)", ru?.ps, -66.90);
  assertEqual("Negative Right Uterine ED (-5.01)", ru?.ed, -5.01);
  assertEqual("Negative Right Uterine TAmax (-16.68)", ru?.tamax, -16.68);
  assertEqual("Negative Right Uterine MD (-4.51)", ru?.md, -4.51);
  assertEqual("Negative Right Uterine RI (0.93)", ru?.ri, 0.93);
  assertEqual("Negative Right Uterine PI (3.71)", ru?.pi, 3.71);
  assertEqual("Negative Right Uterine S/D (13.35)", ru?.sd, 13.35);
  assertEqual("Negative Right Uterine HR (66)", ru?.hr, 66);

  assertEqual("Left Uterine PS (87.80)", lu?.ps, 87.80);
  assertEqual("Left Uterine ED (14.26)", lu?.ed, 14.26);
  assertEqual("Left Uterine TAmax (34.31)", lu?.tamax, 34.31);
  assertEqual("Left Uterine MD (13.93)", lu?.md, 13.93);
  assertEqual("Left Uterine RI (0.84)", lu?.ri, 0.84);
  assertEqual("Left Uterine PI (2.14)", lu?.pi, 2.14);
  assertEqual("Left Uterine S/D (6.16)", lu?.sd, 6.16);
  assertEqual("Left Uterine HR (74)", lu?.hr, 74);

  // 8. Unicode Minus & Spaced Minus Test
  const rawUnicodeMinusReport = `
Right Uterine
PS − 66.90 cm/s
ED −5.01 cm/s
TAmax - 16.68 cm/s
MD − 4.51 cm/s
RI 0.93
PI 3.71
S/D 13.35
HR 66 bpm
`;

  const parsedUnicode = parseUltrasoundReportText(rawUnicodeMinusReport);
  const ruUnicode = parsedUnicode.doppler.rightUterine!;

  assertEqual("Unicode Minus PS (-66.90)", ruUnicode?.ps, -66.90);
  assertEqual("Unicode Minus ED (-5.01)", ruUnicode?.ed, -5.01);
  assertEqual("Unicode Minus TAmax (-16.68)", ruUnicode?.tamax, -16.68);
  assertEqual("Unicode Minus MD (-4.51)", ruUnicode?.md, -4.51);

  // 9. normalizeExtractedData with Negative Right Uterine
  const mockNegativeExtracted = {
    doppler: {
      'Right Uterine': {
        ps: -66.90,
        ed: -5.01,
        tamax: -16.68,
        md: -4.51,
        ri: 0.93,
        pi: 3.71,
        sd: 13.35,
        hr: 66,
      },
    },
  };

  const normalizedNeg = normalizeExtractedData(mockNegativeExtracted, baseReport, [], 'online_ai');
  assertEqual("Normalized Neg RU PS", normalizedNeg.doppler.rightUterine.ps, -66.90);
  assertEqual("Normalized Neg RU ED", normalizedNeg.doppler.rightUterine.ed, -5.01);
  assertEqual("Normalized Neg RU TAmax", normalizedNeg.doppler.rightUterine.tamax, -16.68);
  assertEqual("Normalized Neg RU MD", normalizedNeg.doppler.rightUterine.md, -4.51);
  assertEqual("Normalized Neg RU RI", normalizedNeg.doppler.rightUterine.ri, 0.93);
  assertEqual("Normalized Neg RU PI", normalizedNeg.doppler.rightUterine.pi, 3.71);
  assertEqual("Normalized Neg RU SD", normalizedNeg.doppler.rightUterine.sd, 13.35);
  assertEqual("Normalized Neg RU HR", normalizedNeg.doppler.rightUterine.hr, 66);

  return results;
}

// Phase 6.2: same fix as extractionPipeline.test.ts — actually invoke the
// suite so `npm run test` runs real assertions and exits non-zero on failure.
const __results = runDopplerVerificationTests();
for (const r of __results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testName} — ${r.message}`);
}
const __failed = __results.filter((r) => !r.passed);
console.log(`\n${__results.length - __failed.length}/${__results.length} dopplerParsing assertions passed.`);
if (__failed.length > 0) {
  console.error(`\n${__failed.length} dopplerParsing assertion(s) FAILED.`);
  process.exit(1);
}
