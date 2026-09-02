import { createWorker } from 'tesseract.js';
import { Measurements2D, DopplerValues, AmnioticFluidData, PatientInfo, FetalWeightEFW, CalculatedRatios, PregnancyDating } from '../types/ultrasound';
import {
  calculateHadlockEFW,
  generateAutoConclusion,
  normalizeMeasurementValue,
  normalizeDopplerSectionHeader,
  normalizeDopplerVelocity,
  normalizeDopplerIndex,
  calculateEDDForIVF,
  calculateIvfDating,
  resolvePregnancyDating,
} from '../utils/clinicalCalculations';

export interface OfflineOcrResult {
  patient: Partial<PatientInfo>;
  measurements: Partial<Measurements2D>;
  efw: Partial<FetalWeightEFW>;
  doppler: Partial<DopplerValues>;
  amnioticFluid: Partial<AmnioticFluidData>;
  calculations?: CalculatedRatios;
  rawText: string;
  pregnancyDating?: PregnancyDating;
}

// Preprocess image on canvas to boost OCR accuracy for ultrasound dark background text
export async function preprocessUltrasoundImage(imageSource: string | File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource as Blob));
        return;
      }

      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);

      // Invert if background is dark, enhance contrast
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample background color average
      let darkPixels = 0;
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < 70 && g < 70 && b < 70) {
          darkPixels++;
        }
      }

      const isDarkTheme = darkPixels > (data.length / 40) * 0.5;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        // Grayscale
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // If dark theme, invert so text is black on white
        if (isDarkTheme) {
          gray = 255 - gray;
        }

        // Increase contrast
        gray = gray < 130 ? Math.max(0, gray - 30) : Math.min(255, gray + 30);

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource as Blob));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

// Medical regex scanner with robust Context & Section State
export function parseUltrasoundReportText(text: string): OfflineOcrResult {
  const clean = text
    .replace(/[−–—]/g, '-')
    .replace(/-\s+(\d)/g, '-$1')
    .replace(/\r/g, '\n');
  const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  const patient: Partial<PatientInfo> = {};
  const measurements: any = {};
  const calculations: CalculatedRatios = {};
  const doppler: any = {
    fhr: { value: null, unit: 'bpm', name: 'Ventricular FHR' },
    leftUterine: {},
    rightUterine: {},
    umbilicalArtery: {},
    middleCerebralArtery: {},
    ductusVenosus: {},
  };
  const amnioticFluid: any = {
    q1: { value: null, unit: 'mm' },
    q2: { value: null, unit: 'mm' },
    q3: { value: null, unit: 'mm' },
    q4: { value: null, unit: 'mm' },
    afi: { value: null, unit: 'mm' },
    sdp: { value: null, unit: 'mm' },
  };
  const efw: Partial<FetalWeightEFW> = { unit: 'g' };

  // 1. Patient Demographics
  const nameMatch = clean.match(/(?:Name|Họ\s*tên|Bệnh\s*nhân|Patient)\s*[:\s]+([A-ZÀ-Ỹ0-9\s]+?)(?=\s+(?:DOB|Pat|Sex|GA|Date|Tuổi|ID|\n|$))/i);
  if (nameMatch) {
    const rawName = nameMatch[1].trim();
    if (rawName.length > 1 && !/^(?:ID|GA|DATE|OB|PAGE)$/i.test(rawName)) {
      patient.name = rawName;
    }
    const yearMatch = rawName.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      patient.yearOfBirth = yearMatch[1];
      const birthYear = parseInt(yearMatch[1], 10);
      const currentYear = new Date().getFullYear();
      patient.age = String(currentYear - birthYear);
    }
  }

  const idMatch = clean.match(/(?:Pat\.?\s*ID|Patient\s*ID|ID|Mã\s*BN|Mã\s*bệnh\s*nhân)\s*[:\s]*([A-Z0-9\-_]+)/i);
  if (idMatch) {
    patient.patientId = idMatch[1].trim();
  }

  const examDateMatch = clean.match(/(?:Date\s*of\s*Exam|Exam\s*Date|Date|Ngày\s*khám|Ngày)\s*[:\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  if (examDateMatch) {
    patient.examDate = examDateMatch[1].trim();
  }

  const sonoMatch = clean.match(/(?:Sonogr\.?|BS|Doctor|Bác\s*sĩ)\s*[:\s]*([A-ZÀ-Ỹ\s\.]+)/i);
  if (sonoMatch) {
    const sName = sonoMatch[1].trim();
    if (sName.length > 2 && !/^(?:PAGE|DATE|HOSPITAL)$/i.test(sName)) {
      patient.sonographer = sName;
    }
  }

  // Clinic Header
  if (rawLines.length > 0 && /DR|BS|PK|PHÒNG|HOSPITAL|BỆNH\s*VIỆN|CLINIC|GE|VINMEC|TỪ\s*DŨ|HÙNG\s*VƯƠNG/i.test(rawLines[0])) {
    patient.clinicHeader = rawLines[0].replace(/Page\s*\d+\s*\/\s*\d+/i, '').trim();
  }

  // GA & EDD
  // Match GA(DST) or general Clin/LMP/EDD/KCC
  const gaClinMatch = clean.match(/GA\s*\((?:Clin|LMP|EDD|KCC|DST)\)\s*[:\s]*(\d+w\d+d|\d+\s*w\s*\d+\s*d|\d+\s*tuần\s*\d+\s*ngày)/i);
  if (gaClinMatch) {
    patient.gaClin = gaClinMatch[1].replace(/\s+/g, '');
  }

  const gaAuaMatch = clean.match(/GA\s*\((?:AUA|US|SA)\)\s*[:\s]*(\d+w\d+d|\d+\s*w\s*\d+\s*d|\d+\s*tuần\s*\d+\s*ngày)/i);
  if (gaAuaMatch) {
    patient.gaAua = gaAuaMatch[1].replace(/\s+/g, '');
  }

  // Look for specific EDD(DST) first, then EDD(AUA) specifically, then general EDD
  const eddDstMatch = clean.match(/EDD\s*\(DST\)\s*[:\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  const eddAuaMatch = clean.match(/EDD\s*\(AUA\)\s*[:\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  const eddMatch = clean.match(/(?:EDD|Dự\s*sinh)\s*(?:\([A-Z]+\))?\s*[:\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);

  if (eddDstMatch) {
    patient.edd = eddDstMatch[1].trim();
  } else if (eddMatch) {
    patient.edd = eddMatch[1].trim();
  }

  // Also parse doc and lmp
  const docMatch = clean.match(/(?:DOC|Ngày\s*thụ\s*thai)\s*[:\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  if (docMatch) {
    patient.doc = docMatch[1].trim();
  }

  const lmpMatch = clean.match(/(?:LMP|Kinh\s*cuối|KCC)\s*[:\s]*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  if (lmpMatch) {
    patient.lmp = lmpMatch[1].trim();
  }

  // Scan for IVF / Embryo Transfer patterns & resolve Dating Priority
  let pregnancyDating: PregnancyDating | undefined = undefined;

  const datingResolution = resolvePregnancyDating({
    rawText: clean,
    examDate: patient.examDate,
    extractedPatient: patient,
    extractedGaClin: gaClinMatch ? gaClinMatch[1].replace(/\s+/g, '') : patient.gaClin,
    extractedEdd: eddDstMatch ? eddDstMatch[1].trim() : (eddMatch ? eddMatch[1].trim() : patient.edd),
    extractedGaAua: patient.gaAua,
    extractedEddAua: eddAuaMatch ? eddAuaMatch[1].trim() : undefined,
    extractedDoc: patient.doc,
    extractedLmp: patient.lmp,
  });

  patient.ga = datingResolution.finalGA || patient.ga;
  patient.gaClin = datingResolution.finalGA || patient.gaClin;
  patient.edd = datingResolution.finalEDD || patient.edd;
  patient.datingSource = datingResolution.datingSource;
  patient.gaSource = datingResolution.gaSource;
  patient.eddSource = datingResolution.eddSource;
  if (datingResolution.transferDate) {
    patient.transferDate = datingResolution.transferDate;
    patient.doc = datingResolution.transferDate;
  }
  if (datingResolution.embryoDay) {
    patient.embryoDay = datingResolution.embryoDay;
  }

  if (datingResolution.isIvf) {
    pregnancyDating = {
      type: 'IVF',
      transferDate: datingResolution.transferDate || patient.doc,
      embryoAge: datingResolution.embryoDay || 5,
      ga: datingResolution.finalGA,
      edd: datingResolution.finalEDD,
      source: datingResolution.datingSource,
    };
  }

  // 2. EFW (Fetal Weight from ultrasound machine report)
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (/EFW|Estimated\s*Fetal\s*Weight|Cân\s*nặng|AC\/FL\/HC|AC\/FL|BPD\/HC\/AC\/FL|BPD\/AC\/FL/i.test(line)) {
      const methodMatch = line.match(/\(([^)]+)\)/);
      let methodStr = methodMatch ? methodMatch[1].trim() : '';
      if (!methodStr && /AC\/FL\/HC/i.test(line)) {
        methodStr = 'Hadlock 3 (AC/FL/HC)';
      } else if (!methodStr) {
        methodStr = 'Hadlock 3';
      }

      // Remove formula parentheses to avoid taking digits like '3' in '(Hadlock3)' or '4' in '(Hadlock 4)' as weight
      const cleanLineForWeight = line.replace(/\([^)]*\)/g, ' ');
      let weightNumMatch = cleanLineForWeight.match(/(?:EFW|Weight|Cân\s*nặng|AC\/FL\/HC|AC\/FL)[^\d]*(\d+(?:[\.,]\d+)?)\s*(g|kg|gam)?/i) ||
                           line.match(/(?:EFW|Weight|Cân\s*nặng)\s*[:=]?\s*(\d+(?:[\.,]\d+)?)\s*(g|kg|gam)?/i);

      // Lookahead: if no weight matched on current line, but current line has EFW keywords, try combining with the next line
      if (!weightNumMatch) {
        if (i + 1 < rawLines.length) {
          const nextLine = rawLines[i + 1];
          const combinedText = `${line} ${nextLine}`;
          const cleanCombined = combinedText.replace(/\([^)]*\)/g, ' ');
          weightNumMatch = cleanCombined.match(/(?:EFW|Weight|Cân\s*nặng|AC\/FL\/HC|AC\/FL)[^\d]*(\d+(?:[\.,]\d+)?)\s*(g|kg|gam)?/i) ||
                           combinedText.match(/(?:EFW|Weight|Cân\s*nặng)\s*[:=]?\s*(\d+(?:[\.,]\d+)?)\s*(g|kg|gam)?/i);
          
          if (!weightNumMatch) {
            // Also check for standalone numbers/weight on the next line (e.g. "243g")
            const standaloneMatch = nextLine.match(/^\s*(\d+(?:[\.,]\d+)?)\s*(g|gam)?\s*$/i);
            if (standaloneMatch) {
              const val = parseFloat(standaloneMatch[1].replace(',', '.'));
              if (val >= 30 && val <= 6500) {
                weightNumMatch = [nextLine, standaloneMatch[1], standaloneMatch[2] || 'g'];
              }
            }
          }
        }
      }

      if (weightNumMatch) {
        let wVal = parseFloat(weightNumMatch[1].replace(',', '.'));
        const unit = weightNumMatch[2]?.toLowerCase();
        if (unit === 'kg' || (wVal < 10 && wVal > 0.03)) {
          wVal = Math.round(wVal * 1000);
        } else {
          wVal = Math.round(wVal);
        }

        // Reject chart reference year 201 unless explicit 201g
        if (wVal === 201 && !/201\s*g/i.test(line)) {
          continue;
        }

        if (wVal >= 30 && wVal <= 6500) {
          efw.value = wVal;
          efw.unit = 'g';
          efw.isExtracted = true;
          efw.source = 'report';
          efw.formula = methodStr.includes('Hadlock') ? methodStr : `Hadlock (${methodStr})`;
          efw.method = methodStr.includes('Hadlock') ? 'Hadlock 3' : (methodStr.includes('INTERGROWTH') ? 'INTERGROWTH' : methodStr);

          // Prioritized parsing on the specific EFW line and its immediate lookahead
          const nextLineText = (i + 1 < rawLines.length) ? rawLines[i + 1] : '';
          const efwLineBlock = `${line} ${nextLineText}`;

          // 1. Range: Match ±108g or ± 108g or ±108 or +/-108g or ±132g
          const lineRangeMatch = efwLineBlock.match(/([±]|[\+]\s*[-]|[\+]\s*[\/]\s*[-])\s*(\d+)\s*g?/i);
          if (lineRangeMatch) {
            efw.range = `±${lineRangeMatch[2]}g`;
          }

          // 2. GA Age: Match formats like "24w3d" or "25w6d" or "24w" or "24 tuần 3 ngày"
          const lineGaMatch = efwLineBlock.match(/(\d+w\d+d|\d+\s*tuần\s*\d+\s*ngày)/i) ||
                              efwLineBlock.match(/(\d+w\d{1,2})/i);
          if (lineGaMatch) {
            efw.gaAge = lineGaMatch[1].replace(/\s+/g, '');
          }

          // 3. Percentile (GP%): Preserve <1%, >99%, 17.5%, 53.2%
          const linePctMatch = efwLineBlock.match(/(?:GP|percentile|pct)\s*[:=]?\s*([<>]=?\s*\d+(?:[\.,]\d+)?|\d+(?:[\.,]\d+)?)\s*%?/i) ||
                               efwLineBlock.match(/([<>]=?\s*\d+(?:[\.,]\d+)?|\d+(?:[\.,]\d+)?)\s*%/);
          if (linePctMatch) {
            let pctVal = linePctMatch[1].replace(/\s+/g, '').replace(',', '.');
            if (!pctVal.includes('%')) pctVal = `${pctVal}%`;
            efw.percentile = pctVal;
          }

          // If either GP% or GA Age are still missing, search context lines without matching biometry rows
          if (!efw.gaAge || !efw.percentile) {
            const contextLines = rawLines.slice(Math.max(0, i - 1), Math.min(rawLines.length, i + 6));
            const filteredContextLines = contextLines.filter(cl => {
              if (cl === line || cl === nextLineText) return true;
              const isOtherBiometryRow = /^\s*(?:BPD|HC|AC|FL|CRL|NT|NB|NBL|CM|TCD|Cereb|FHR|UA|MCA|AFI)\b/i.test(cl);
              return !isOtherBiometryRow;
            });
            const filteredContextBlock = filteredContextLines.join(' ');

            if (!efw.gaAge) {
              const contextGaMatch = filteredContextBlock.match(/(\d+w\d+d|\d+\s*tuần\s*\d+\s*ngày)/i) ||
                                     filteredContextBlock.match(/(\d+w\d{1,2})/i);
              if (contextGaMatch) {
                efw.gaAge = contextGaMatch[1].replace(/\s+/g, '');
              }
            }

            if (!efw.percentile) {
              const contextPctMatch = filteredContextBlock.match(/(?:GP|percentile|pct)\s*[:=]?\s*([<>]=?\s*\d+(?:[\.,]\d+)?|\d+(?:[\.,]\d+)?)\s*%?/i) ||
                                      filteredContextBlock.match(/([<>]=?\s*\d+(?:[\.,]\d+)?|\d+(?:[\.,]\d+)?)\s*%/);
              if (contextPctMatch) {
                let pctVal = contextPctMatch[1].replace(/\s+/g, '').replace(',', '.');
                if (!pctVal.includes('%')) pctVal = `${pctVal}%`;
                efw.percentile = pctVal;
              }
            }
          }
          break;
        }
      }
    }
  }

  // 3. Line-by-Line Calculations Parser (HC/AC, FL/AC, FL/BPD, FL/HC, CI)
  for (const line of rawLines) {
    // HC/AC (Campbell) 1.15 (1.14 - 1.31)
    const hcAcMatch = line.match(/(?:HC\/AC|HC\s*\/\s*AC)(?:\s*\([^)]*\))?\s*[:\s]+(\d+(?:[\.,]\d+)?)/i);
    if (hcAcMatch && calculations.hcAc === undefined) {
      calculations.hcAc = parseFloat(hcAcMatch[1].replace(',', '.'));
    }

    // FL/AC 14.33%
    const flAcMatch = line.match(/(?:FL\/AC|FL\s*\/\s*AC)(?:\s*\([^)]*\))?\s*[:\s]+(\d+(?:[\.,]\d+)?)\s*%?/i);
    if (flAcMatch && calculations.flAc === undefined) {
      calculations.flAc = parseFloat(flAcMatch[1].replace(',', '.'));
    }

    // FL/BPD 45.54%
    const flBpdMatch = line.match(/(?:FL\/BPD|FL\s*\/\s*BPD)(?:\s*\([^)]*\))?\s*[:\s]+(\d+(?:[\.,]\d+)?)\s*%?/i);
    if (flBpdMatch && calculations.flBpd === undefined) {
      calculations.flBpd = parseFloat(flBpdMatch[1].replace(',', '.'));
    }

    // FL/HC (Hadlock) 0.12
    const flHcMatch = line.match(/(?:FL\/HC|FL\s*\/\s*HC)(?:\s*\([^)]*\))?\s*[:\s]+(\d+(?:[\.,]\d+)?)/i);
    if (flHcMatch && calculations.flHc === undefined) {
      calculations.flHc = parseFloat(flHcMatch[1].replace(',', '.'));
    }

    // CI (BPD/OFD)
    const ciMatch = line.match(/(?:CI|Cephalic\s*Index)(?:\s*\([^)]*\))?\s*[:\s]+(\d+(?:[\.,]\d+)?)\s*%?/i);
    if (ciMatch && calculations.ci === undefined) {
      calculations.ci = parseFloat(ciMatch[1].replace(',', '.'));
    }
  }

  // 4. Line-by-Line Ultrasound Biometry Indicators Parser
  const indicatorConfigs: Array<{
    key: string;
    label: string;
    regexKey: RegExp;
  }> = [
    { key: 'bpd', label: 'Đường kính lưỡng đỉnh (BPD)', regexKey: /\b(?:BPD|B\.P\.D)\b/i },
    { key: 'hc', label: 'Chu vi đầu (HC)', regexKey: /\b(?:HC|H\.C)\b/i },
    { key: 'ac', label: 'Chu vi bụng (AC)', regexKey: /\b(?:AC|A\.C)\b/i },
    { key: 'fl', label: 'Chiều dài xương đùi (FL)', regexKey: /\b(?:FL|F\.L)\b/i },
    { key: 'hl', label: 'Chiều dài xương cánh tay (HL)', regexKey: /\b(?:HL|H\.L)\b/i },
    { key: 'crl', label: 'Chiều dài đầu mông (CRL)', regexKey: /\b(?:CRL|C\.R\.L)\b/i },
    { key: 'nt', label: 'Độ mờ da gáy (NT)', regexKey: /\b(?:NT|N\.T|Độ\s*mờ\s*da\s*gáy)\b/i },
    { key: 'nbl', label: 'Chiều dài xương mũi (NBL)', regexKey: /\b(?:NBL|N\.B\.L|Xương\s*mũi)\b/i },
    { key: 'tcd', label: 'Đường kính ngang tiểu não (TCD)', regexKey: /\b(?:TCD|T\.C\.D|Cereb|Cerebellum)\b/i },
    { key: 'cm', label: 'Bể lớn hố sau (CM)', regexKey: /\b(?:Cisterna\s*Magna|C\.M\.|Bể\s*lớn)\b|^\s*CM\b|\bCM\s*[:=\(]/i },
    { key: 'vp', label: 'Não thất bên (Vp)', regexKey: /\b(?:Vp|V\.p|Va|Vp1|Vp2)\b/i },
    { key: 'bod', label: 'Đường kính 2 hốc mắt (BOD)', regexKey: /\b(?:BOD|B\.O\.D|Binocular)\b/i },
    { key: 'foot', label: 'Chiều dài bàn chân (Foot)', regexKey: /\b(?:Foot|Bàn\s*chân)\b/i },
    { key: 'gs', label: 'Đường kính túi thai (GS)', regexKey: /\b(?:GS|G\.S|Túi\s*thai)\b/i },
    { key: 'ys', label: 'Túi noãn hoàng (YS)', regexKey: /\b(?:YS|Y\.S|Noãn\s*hoàng)\b/i },
    { key: 'cervixLength', label: 'Chiều dài kênh CTC (CL)', regexKey: /\b(?:CL|Cervix|Chiều\s*dài\s*CTC)\b/i },
  ];

  for (const line of rawLines) {
    // STRICT REJECTION: Skip EFW weight lines, formula headers, and calculations (HC/AC, FL/AC, FL/BPD, FL/HC)
    if (/EFW|Estimated\s*Fetal\s*Weight|AC\/FL\/HC|AC\/FL|BPD\/HC|BPD\/AC|Hadlock\s*\d/i.test(line) || /\d+\s*g\b/i.test(line)) continue;
    if (/\b(?:HC\/AC|FL\/AC|FL\/BPD|FL\/HC|BPD\/OFD|CI|RATIO)\b/i.test(line)) continue;

    for (const config of indicatorConfigs) {
      if (measurements[config.key]?.value) continue; // already parsed

      // For 'cm' (Cisterna Magna), verify line is not just a measurement unit like "1.07 cm"
      if (config.key === 'cm' && /\d+(?:[\.,]\d+)?\s*cm\b/i.test(line) && !/Cisterna|Bể\s*lớn|CM\s*[:=\(]/i.test(line)) {
        continue;
      }

      if (config.regexKey.test(line)) {
        // Extract method in parentheses: e.g. (Hadlock), (INTERGRW), (INTERGROWTH-21st), (Osaka), (Jeanty), (Sonek), (Hill), (Nicolaides), (Chitty)
        const methodMatch = line.match(/\(([A-Za-z0-9\s\.\-\/_]+)\)/);
        let method = methodMatch ? methodMatch[1].trim() : undefined;
        if (method && /INTERGRW/i.test(method)) {
          method = 'INTERGROWTH-21st';
        }

        // Remove the indicator tag and method from line to isolate numbers
        const cleanLine = line
          .replace(config.regexKey, '')
          .replace(/\([^)]+\)/, ' ');

        // Find value: "14.28 mm", "1428 mm", "64.23 mm", "915 mm", etc.
        const valMatch = cleanLine.match(/[:\s]+(\d+(?:[\.,]\d+)?)/i);
        if (valMatch) {
          const rawNum = parseFloat(valMatch[1].replace(',', '.'));

          // Normalize measurement value with full clinical context (preventing scale loss)
          const normResult = normalizeMeasurementValue({
            key: config.key,
            rawValue: rawNum,
            rawText: line,
            label: config.label,
            unit: 'mm',
            section: 'BIOMETRY',
            efwVal: efw.value,
          });

          if (normResult.value !== null && normResult.isExtracted) {
            // Find percentile %
            let percentile: string | undefined = undefined;
            const pctMatch = cleanLine.match(/(\d+(?:[\.,]\d+)?)\s*%/);
            if (pctMatch) {
              const pctVal = pctMatch[1].replace(',', '.');
              percentile = method ? `${pctVal}% theo ${method}` : `${pctVal}%`;
            }

            // Find GA: "14w6d", "24w2d", "25w4d"
            let gaAge: string | undefined = undefined;
            const gaMatch = cleanLine.match(/(\d+\s*w\s*\d+\s*d|\d+\s*tuần\s*\d+\s*ngày)/i);
            if (gaMatch) {
              gaAge = gaMatch[1].replace(/\s+/g, '');
            }

            measurements[config.key] = {
              value: normResult.value,
              unit: 'mm',
              name: config.label,
              method,
              percentile,
              gaAge,
              isExtracted: true,
              sourceEvidence: line,
            };
          } else if (config.key === 'cm') {
            // Phase 3 (CM only): CM rejected as out-of-range (e.g. raw OCR
            // "592mm") must still keep sourceEvidence instead of vanishing
            // silently. Value stays null/isExtracted false — no decimal is
            // guessed. Scoped strictly to 'cm'; every other key is unchanged.
            measurements[config.key] = {
              value: null,
              unit: 'mm',
              name: config.label,
              isExtracted: false,
              sourceEvidence: line,
            };
          }
        }
      }
    }
  }

  // 5. Fetal Heart Rate (FHR) - Specific match for Ventricular FHR / FHR without picking up vessel HR
  const fhrMatch = clean.match(/(?:Ventricular\s*FHR)\s*[:\s]+(\d+)\s*(?:bpm)?/i) ||
                   clean.match(/(?:Fetal\s*Heart\s*Rate|Tim\s*thai|FHR)\s*[:\s]+(\d+)\s*(?:bpm)?/i);
  if (fhrMatch) {
    const fhrVal = parseInt(fhrMatch[1], 10);
    if (!isNaN(fhrVal) && fhrVal > 50 && fhrVal < 240) {
      doppler.fhr.value = fhrVal;
      doppler.fhr.isExtracted = true;
    }
  }

  // 6. Amniotic Fluid (AFI & SDP / Q1 - Q4)
  const afiMatch = clean.match(/AFI\s*[:\s]+(\d+(?:[\.,]\d+)?)\s*(mm|cm)?/i);
  if (afiMatch) {
    let afiVal = parseFloat(afiMatch[1].replace(',', '.'));
    if (afiMatch[2]?.toLowerCase() === 'cm' || (afiVal < 35 && afiVal > 2)) {
      afiVal = Math.round(afiVal * 10); // convert cm to mm
    }
    amnioticFluid.afi.value = afiVal;
    amnioticFluid.afi.unit = 'mm';
    amnioticFluid.afi.isExtracted = true;
  }

  const q1Match = clean.match(/\bQ1\s*[:\s]+(\d+(?:[\.,]\d+)?)/i);
  if (q1Match) amnioticFluid.q1 = { value: parseFloat(q1Match[1].replace(',', '.')), unit: 'mm', isExtracted: true };

  const q2Match = clean.match(/\bQ2\s*[:\s]+(\d+(?:[\.,]\d+)?)/i);
  if (q2Match) amnioticFluid.q2 = { value: parseFloat(q2Match[1].replace(',', '.')), unit: 'mm', isExtracted: true };

  const q3Match = clean.match(/\bQ3\s*[:\s]+(\d+(?:[\.,]\d+)?)/i);
  if (q3Match) amnioticFluid.q3 = { value: parseFloat(q3Match[1].replace(',', '.')), unit: 'mm', isExtracted: true };

  const q4Match = clean.match(/\bQ4\s*[:\s]+(\d+(?:[\.,]\d+)?)/i);
  if (q4Match) amnioticFluid.q4 = { value: parseFloat(q4Match[1].replace(',', '.')), unit: 'mm', isExtracted: true };

  const sdpMatch = clean.match(/(?:SDP|DVP|MVP|Xoang\s*lớn\s*nhất)\s*[:\s]+(\d+(?:[\.,]\d+)?)\s*(mm|cm)?/i);
  if (sdpMatch) {
    let sdpVal = parseFloat(sdpMatch[1].replace(',', '.'));
    if (sdpMatch[2]?.toLowerCase() === 'cm' || sdpVal < 15) {
      sdpVal = Math.round(sdpVal * 10); // convert cm to mm
    }
    amnioticFluid.sdp.value = sdpVal;
    amnioticFluid.sdp.unit = 'mm';
    amnioticFluid.sdp.isExtracted = true;
  }

  // 7. Robust Context-Aware Doppler Line-by-Line Parser
  let activeDopplerSection: 'leftUterine' | 'rightUterine' | 'umbilicalArtery' | 'middleCerebralArtery' | 'ductusVenosus' | 'fhr' | null = null;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if current line is a Doppler section header
    const detectedSection = normalizeDopplerSectionHeader(trimmed);
    if (detectedSection) {
      activeDopplerSection = detectedSection;
      // If header is FHR or line contains ventricular FHR directly
      if (detectedSection === 'fhr') {
        const directFhrMatch = trimmed.match(/(?:Ventricular\s*FHR|FHR|Tim\s*thai|Heart\s*Rate|HR)\s*[:\s]+(\d+)/i);
        if (directFhrMatch) {
          const val = parseInt(directFhrMatch[1], 10);
          if (!isNaN(val) && val > 50 && val < 240) {
            doppler.fhr.value = val;
            doppler.fhr.isExtracted = true;
          }
        }
        continue;
      }

      // If line only contains section header and no numeric parameters, continue to next line
      const hasInlineParams = /(?:PI|RI|PS|PSV|ED|TAmax|TAMX|S\/D|SD|PVIV|PLI|S\/a|a\/S)\s*[:\s]+[+-]?\d/i.test(trimmed);
      if (!hasInlineParams) {
        continue;
      }
    }

    // Switch off active section if encountering biometry or non-Doppler sections
    if (/^(?:BPD|HC|AC|FL|HL|BOD|NBL|Foot|EFW|Name|Pat\b|Patient|Indication|GA\b|EDD|LMP|2D\s*Measurements|2D\s*Biometry|Calculations:|Amniotic|Placenta)/i.test(trimmed)) {
      activeDopplerSection = null;
      continue;
    }

    if (activeDopplerSection === 'fhr') {
      const fhrLineMatch = trimmed.match(/(?:Ventricular\s*FHR|FHR|Tim\s*thai)\s*[:\s]+(\d+)/i);
      if (fhrLineMatch) {
        const val = parseInt(fhrLineMatch[1], 10);
        if (!isNaN(val) && val > 50 && val < 240) {
          doppler.fhr.value = val;
          doppler.fhr.isExtracted = true;
        }
      }
      continue;
    }

    if (activeDopplerSection) {
      const target = doppler[activeDopplerSection];

      // Helper to extract first numeric token following parameter name (preserves negative/positive signs)
      const extractParamFromLine = (pattern: RegExp): number | null => {
        const m = trimmed.match(pattern);
        if (m) {
          const val = parseFloat(m[1].replace(',', '.'));
          return isNaN(val) ? null : val;
        }
        return null;
      };

      // PS / PSV (Peak Systolic Velocity) - allows negative/positive velocity
      if (/(?:^|\s)(?:PSV|PS)\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)(?:PSV|PS)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerVelocity(raw);
        if (norm !== null) {
          target.ps = norm;
          if (activeDopplerSection === 'middleCerebralArtery') {
            target.psv = norm;
          }
        }
      }

      // ED (End Diastolic Velocity) - Ensure not EDD or standalone EDV text - allows negative/positive velocity
      if (/(?:^|\s)ED\b/i.test(trimmed) && !/EDD/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)ED\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerVelocity(raw);
        if (norm !== null) {
          target.ed = norm;
        }
      }

      // TAmax / TA max / TAMax / TA MAX (Time-Averaged Maximum Velocity) - allows negative/positive velocity
      if (/(?:^|\s)(?:TAmax|TA\s*max|TAMax\.|tamax|TA\s*MAX|TAMX|TAM|TAV)\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)(?:TAmax|TA\s*max|TAMax\.|tamax|TA\s*MAX|TAMX|TAM|TAV)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerVelocity(raw);
        if (norm !== null) {
          target.tamax = norm;
          target.taMax = norm;
        }
      }

      // MD (Minimum Diastolic Velocity) - allows negative/positive velocity
      if (/(?:^|\s)MD\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)MD\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerVelocity(raw);
        if (norm !== null) {
          target.md = norm;
        }
      }

      // RI (Resistance Index)
      if (/(?:^|\s)(?:RI|Ri|ri|R\.I)\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)(?:RI|Ri|ri|R\.I)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerIndex(raw, 'ri');
        if (norm !== null) {
          target.ri = norm;
        }
      }

      // PI / Pl (Pulsatility Index) - Also matches 'Pl' due to common OCR 'I' -> 'l' confusion
      if (/(?:^|\s)(?:PI|Pl|Pi|pi|pl|P\.I)\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)(?:PI|Pl|Pi|pi|pl|P\.I)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerIndex(raw, 'pi');
        if (norm !== null) {
          target.pi = norm;
        }
      }

      // S/D or SD or S-D (Systolic/Diastolic ratio)
      if (/(?:^|\s)(?:S\/D|S\s*\/\s*D|S-D|SD)\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)(?:S\/D|S\s*\/\s*D|S-D|SD)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        const norm = normalizeDopplerIndex(raw, 'sd');
        if (norm !== null) {
          target.sd = norm;
          target.sD = norm;
        }
      }

      // HR (Heart Rate of this specific vessel) - e.g. "HR 168 bpm", "HR 186 bpm", "HR 268 bpm" (DV)
      if (/(?:^|\s)(?:HR|Heart\s*Rate)\b/i.test(trimmed) && !/Ventricular/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)(?:HR|Heart\s*Rate)\s*[:\s]+(\d+)/i);
        if (raw !== null && raw > 40 && raw <= 350) {
          target.hr = Math.round(raw);
        }
      }

      // VTI (Velocity Time Integral)
      if (/(?:^|\s)VTI\b/i.test(trimmed)) {
        const raw = extractParamFromLine(/(?:^|\s)VTI\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
        if (raw !== null) {
          target.vti = raw;
        }
      }

      // Ductus Venosus specific peaks: S, A, D, a/S, S/a, PVIV, PLI
      if (activeDopplerSection === 'ductusVenosus') {
        if (/(?:^|\s)S\b/i.test(trimmed) && !/S\/D|S\/a|S-D|SD/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)S\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.s = raw;
        }
        if (/(?:^|\s)A\b/i.test(trimmed) && !/A\/S|a\/S/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)A\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.a = raw;
        }
        if (/(?:^|\s)D\b/i.test(trimmed) && !/S\/D|SD|E\/D/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)D\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.d = raw;
        }
        if (/(?:^|\s)(?:S\/a|S\s*\/\s*a)\b/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)(?:S\/a|S\s*\/\s*a)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.sa = raw;
        }
        if (/(?:^|\s)(?:a\/S|a\s*\/\s*S)\b/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)(?:a\/S|a\s*\/\s*S)\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.aS = raw;
        }
        if (/(?:^|\s)PVIV\b/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)PVIV\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.pviv = raw;
        }
        if (/(?:^|\s)PLI\b/i.test(trimmed)) {
          const raw = extractParamFromLine(/(?:^|\s)PLI\s*[:\s]+([+-]?(?:\d+(?:[\.,]\d+)?|\.\d+))/i);
          if (raw !== null) target.pli = raw;
        }
      }
    }
  }

  // Recalculate EFW via Hadlock 3 if not parsed directly
  if (!efw.value && measurements.ac?.value && measurements.fl?.value) {
    const calc = calculateHadlockEFW(
      measurements.ac.value,
      measurements.fl.value,
      measurements.bpd?.value || null,
      measurements.hc?.value || null
    );
    if (calc.efwGrams) {
      efw.value = calc.efwGrams;
      efw.range = `± ${calc.rangeGrams}g`;
      efw.formula = calc.formulaUsed || 'Hadlock 3 (HC, AC, FL)';
      efw.method = 'Hadlock 3';
    }
  }

  return {
    patient,
    measurements,
    calculations,
    efw,
    doppler,
    amnioticFluid,
    rawText: text,
    pregnancyDating,
  };
}

// Complete Offline OCR function with Tesseract Worker
export async function runClientOfflineOcr(
  imageSource: string | File | Blob,
  onProgress?: (progress: number, status: string) => void
): Promise<OfflineOcrResult> {
  onProgress?.(10, 'Đang tiền xử lý hình ảnh siêu âm...');
  const processedImageUrl = await preprocessUltrasoundImage(imageSource);

  onProgress?.(30, 'Đang khởi động Tesseract OCR Offline...');
  const worker = await createWorker('eng');

  onProgress?.(60, 'Đang quét ký tự và số liệu siêu âm...');
  const ret = await worker.recognize(processedImageUrl);

  onProgress?.(90, 'Đang trích xuất chỉ số y khoa...');
  await worker.terminate();

  const parsed = parseUltrasoundReportText(ret.data.text);
  onProgress?.(100, 'Hoàn thành trích xuất!');

  return parsed;
}
