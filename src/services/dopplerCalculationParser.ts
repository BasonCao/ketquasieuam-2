/**
 * Doppler & Doppler Calculations Parser for GE Voluson & Standard Ultrasound Reports
 * Extracts all hemodynamic parameters and specialized calculation indexes
 */

import { DopplerValues, DopplerCalculationsGroup, DopplerVesselItem } from '../types/ultrasound';

export interface ParsedDopplerCalculationsResult {
  doppler: DopplerValues;
  calculations: DopplerCalculationsGroup;
  extractedSections: string[];
}

/**
 * Parses numeric value safely from regex match
 */
function parseNum(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const clean = String(val).replace(/,/g, '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/**
 * Extracts percentage / percentile string with preserving < and > symbols
 */
function parsePercentileStr(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  const match = str.match(/([<>≤≥]?\s*\d+(?:\.\d+)?\s*%)/);
  return match ? match[1].replace(/\s+/g, '') : null;
}

/**
 * Parses Ductus Venosus raw wave and Doppler measurements from text
 */
export function parseDuctusVenosus(text: string, pageNumber: number = 1): DopplerVesselItem {
  const result: DopplerVesselItem = {
    s: null,
    tamax: null,
    a: null,
    d: null,
    pi: null,
    sa: null,
    aS: null,
    pviv: null,
    pli: null,
    hr: null,
  };

  // Check for Ductus Venosus section
  const dvSectionRegex = /(?:Ductus\s*Ven(?:osus|\.)?|DV)[\s\S]{1,400}?(?=(?:Umbilical|MCA|Middle\s*Cerebral|Uterine|FHR|AFI|Page|===|\n\n[A-Z]|$))/i;
  const dvSectionMatch = text.match(dvSectionRegex);
  const dvText = dvSectionMatch ? dvSectionMatch[0] : text;

  // S wave: S 66.04 cm/s or S: 66.04
  const sMatch = dvText.match(/\bS\s*[:\s=]+(\d+(?:\.\d+)?)\s*(?:cm\/s)?/i);
  if (sMatch) result.s = parseNum(sMatch[1]);

  // TAmax: TAmax 57.09 cm/s or TAMAX 57.09
  const tamaxMatch = dvText.match(/(?:TAmax|TAMAX|TAMX)\s*[:\s=]+(\d+(?:\.\d+)?)\s*(?:cm\/s)?/i);
  if (tamaxMatch) result.tamax = parseNum(tamaxMatch[1]);

  // a wave: a 37.62 cm/s
  const aMatch = dvText.match(/\ba\s*[:\s=]+(\d+(?:\.\d+)?)\s*(?:cm\/s)?/i);
  if (aMatch) result.a = parseNum(aMatch[1]);

  // D wave: D 43.37 cm/s
  const dMatch = dvText.match(/\bD\s*[:\s=]+(\d+(?:\.\d+)?)\s*(?:cm\/s)?/i);
  if (dMatch) result.d = parseNum(dMatch[1]);

  // PI: PI 0.50
  const piMatch = dvText.match(/\bPI\s*[:\s=]+(\d+(?:\.\d+)?)/i);
  if (piMatch) result.pi = parseNum(piMatch[1]);

  // S/a: S/a 1.76
  const saMatch = dvText.match(/(?:S\/a|S-a|S\/A)\s*[:\s=]+(\d+(?:\.\d+)?)/i);
  if (saMatch) result.sa = parseNum(saMatch[1]);

  // a/S: a/S 0.57
  const asMatch = dvText.match(/(?:a\/S|a-S|A\/S)\s*[:\s=]+(\d+(?:\.\d+)?)/i);
  if (asMatch) result.aS = parseNum(asMatch[1]);

  // PVIV: PVIV 0.66
  const pvivMatch = dvText.match(/\bPVIV\s*[:\s=]+(\d+(?:\.\d+)?)/i);
  if (pvivMatch) result.pviv = parseNum(pvivMatch[1]);

  // PLI: PLI 0.43
  const pliMatch = dvText.match(/\bPLI\s*[:\s=]+(\d+(?:\.\d+)?)/i);
  if (pliMatch) result.pli = parseNum(pliMatch[1]);

  // HR: HR 268 bpm or HR 268
  const hrMatch = dvText.match(/\bHR\s*[:\s=]+(\d+)\s*(?:bpm)?/i);
  if (hrMatch) result.hr = parseNum(hrMatch[1]);

  return result;
}

/**
 * Extracts Doppler Calculations module from GE Report text
 *
 * Phase 5 fix: the method-name capture group in every regex below used to be
 * `\(([^)]+)\)`, which cannot match a method label containing its own nested
 * parentheses — e.g. "UmbArt PI (JSUM(2001)) 1.94 >99%". `[^)]+` is forced to
 * stop at the FIRST ')' it sees (the inner one closing "(2001)"), which then
 * leaves a stray ')' immediately before the numeric value and makes the whole
 * regex fail to match — so UA PI / MCA PI (both commonly reported with a
 * "(JSUM(2001))" style method) were silently dropped even though the value
 * was right there in the text. Replaced with
 * `\(((?:[^()]|\([^()]*\))*)\)`, which additionally accepts one level of
 * nested "(...)" inside the method label. Values/percentiles/MoM extraction
 * and every other regex are unchanged.
 */
export function parseDopplerCalculations(text: string): DopplerCalculationsGroup {
  const calculations: DopplerCalculationsGroup = {
    ductusVenosus: {},
    umbilicalArtery: {},
    middleCerebralArtery: {},
    leftUterine: {},
    rightUterine: {},
    combined: {},
  };

  // 1. Ductus Venosus Calculations
  // DV a/S (JSUM2012) 0.57 13.2%
  const dvAsMatch = text.match(/(?:DV\s*a\/S|Ductus\s*Ven(?:osus)?\s*a\/S)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (dvAsMatch) {
    calculations.ductusVenosus!.aS = {
      value: parseNum(dvAsMatch[2]),
      method: dvAsMatch[1]?.trim() || 'JSUM2012',
      percentile: parsePercentileStr(dvAsMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: dvAsMatch[0],
      pdfVisible: false,
    };
  }

  // DV PI (JSUM2012) 0.50 74.2%
  const dvPiMatch = text.match(/(?:DV\s*PI|Ductus\s*Ven(?:osus)?\s*PI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (dvPiMatch) {
    calculations.ductusVenosus!.pi = {
      value: parseNum(dvPiMatch[2]),
      method: dvPiMatch[1]?.trim() || 'JSUM2012',
      percentile: parsePercentileStr(dvPiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: dvPiMatch[0],
      pdfVisible: true, // Default true for PDF summary
    };
  }

  // DV PLI (Baschat) 0.43 23.8%
  const dvPliMatch = text.match(/(?:DV\s*PLI|Ductus\s*Ven(?:osus)?\s*PLI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (dvPliMatch) {
    calculations.ductusVenosus!.pli = {
      value: parseNum(dvPliMatch[2]),
      method: dvPliMatch[1]?.trim() || 'Baschat',
      percentile: parsePercentileStr(dvPliMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: dvPliMatch[0],
      pdfVisible: false,
    };
  }

  // DV PVIV (Baschat) 0.66 76.5%
  const dvPvivMatch = text.match(/(?:DV\s*PVIV|Ductus\s*Ven(?:osus)?\s*PVIV)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (dvPvivMatch) {
    calculations.ductusVenosus!.pviv = {
      value: parseNum(dvPvivMatch[2]),
      method: dvPvivMatch[1]?.trim() || 'Baschat',
      percentile: parsePercentileStr(dvPvivMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: dvPvivMatch[0],
      pdfVisible: false,
    };
  }

  // DV S/a (Baschat) 1.76 22.6%
  const dvSaMatch = text.match(/(?:DV\s*S\/a|Ductus\s*Ven(?:osus)?\s*S\/a)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (dvSaMatch) {
    calculations.ductusVenosus!.sa = {
      value: parseNum(dvSaMatch[2]),
      method: dvSaMatch[1]?.trim() || 'Baschat',
      percentile: parsePercentileStr(dvSaMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: dvSaMatch[0],
      pdfVisible: false,
    };
  }

  // 2. Umbilical Artery Calculations
  // UmbArt PI (JSUM2001) 1.94 >99%
  const uaPiMatch = text.match(/(?:UmbArt\s*PI|Umbilical\s*Art(?:\.|ery)?\s*PI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (uaPiMatch) {
    calculations.umbilicalArtery!.pi = {
      value: parseNum(uaPiMatch[2]),
      method: uaPiMatch[1]?.trim() || 'JSUM2001',
      percentile: parsePercentileStr(uaPiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: uaPiMatch[0],
      pdfVisible: true,
    };
  }

  // UmbArt RI (JSUM2001) 0.94 >99%
  const uaRiMatch = text.match(/(?:UmbArt\s*RI|Umbilical\s*Art(?:\.|ery)?\s*RI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (uaRiMatch) {
    calculations.umbilicalArtery!.ri = {
      value: parseNum(uaRiMatch[2]),
      method: uaRiMatch[1]?.trim() || 'JSUM2001',
      percentile: parsePercentileStr(uaRiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: uaRiMatch[0],
      pdfVisible: false,
    };
  }

  // 3. MCA Calculations
  // MCA PI (JSUM(2001)) 1.78 30.2%
  const mcaPiMatch = text.match(/(?:MCA\s*PI|Middle\s*Cerebral\s*Artery\s*PI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (mcaPiMatch) {
    calculations.middleCerebralArtery!.pi = {
      value: parseNum(mcaPiMatch[2]),
      method: mcaPiMatch[1]?.trim() || 'JSUM2001',
      percentile: parsePercentileStr(mcaPiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: mcaPiMatch[0],
      pdfVisible: true,
    };
  }

  // MCA RI (JSUM(2001)) 0.82 22.8%
  const mcaRiMatch = text.match(/(?:MCA\s*RI|Middle\s*Cerebral\s*Artery\s*RI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (mcaRiMatch) {
    calculations.middleCerebralArtery!.ri = {
      value: parseNum(mcaRiMatch[2]),
      method: mcaRiMatch[1]?.trim() || 'JSUM2001',
      percentile: parsePercentileStr(mcaRiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: mcaRiMatch[0],
      pdfVisible: false,
    };
  }

  // MCA PS (Mari) 52.40 cm/s MoM: 1.24
  const mcaPsMatch = text.match(/(?:MCA\s*PS|Middle\s*Cerebral\s*Artery\s*PS)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)\s*(?:cm\/s)?(?:\s*MoM[:\s=]*(\d+(?:\.\d+)?))?/i);
  if (mcaPsMatch) {
    calculations.middleCerebralArtery!.ps = {
      value: parseNum(mcaPsMatch[2]),
      unit: 'cm/s',
      method: mcaPsMatch[1]?.trim() || 'Mari',
      mom: parseNum(mcaPsMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: mcaPsMatch[0],
      pdfVisible: false,
    };
  }

  // MCA TAMX (Schaffer) 24.17 cm/s 81.0%
  const mcaTamxMatch = text.match(/(?:MCA\s*TAMX|MCA\s*TAmax)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)\s*(?:cm\/s)?(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (mcaTamxMatch) {
    calculations.middleCerebralArtery!.tamax = {
      value: parseNum(mcaTamxMatch[2]),
      unit: 'cm/s',
      method: mcaTamxMatch[1]?.trim() || 'Schaffer',
      percentile: parsePercentileStr(mcaTamxMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: mcaTamxMatch[0],
      pdfVisible: false,
    };
  }

  // CPR (Ebbing) 0.92 <1%
  const cprMatch = text.match(/(?:CPR|Cerebroplacental\s*Ratio)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (cprMatch) {
    calculations.middleCerebralArtery!.cpr = {
      value: parseNum(cprMatch[2]),
      method: cprMatch[1]?.trim() || 'Ebbing',
      percentile: parsePercentileStr(cprMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: cprMatch[0],
      pdfVisible: false,
    };
  }

  // 4. Left Uterine Calculations
  // Left UtArt PI (Merz) 3.10 >99%
  const leftUtPiMatch = text.match(/(?:Left\s*UtArt\s*PI|Left\s*Uterine\s*Art(?:\.|ery)?\s*PI|UtArt\s*L\s*PI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (leftUtPiMatch) {
    calculations.leftUterine!.pi = {
      value: parseNum(leftUtPiMatch[2]),
      method: leftUtPiMatch[1]?.trim() || 'Merz',
      percentile: parsePercentileStr(leftUtPiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: leftUtPiMatch[0],
      pdfVisible: true,
    };
  }

  // Left UtArt RI (Merz) 0.89 >99%
  const leftUtRiMatch = text.match(/(?:Left\s*UtArt\s*RI|Left\s*Uterine\s*Art(?:\.|ery)?\s*RI|UtArt\s*L\s*RI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (leftUtRiMatch) {
    calculations.leftUterine!.ri = {
      value: parseNum(leftUtRiMatch[2]),
      method: leftUtRiMatch[1]?.trim() || 'Merz',
      percentile: parsePercentileStr(leftUtRiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: leftUtRiMatch[0],
      pdfVisible: false,
    };
  }

  // 5. Right Uterine Calculations
  // Right UtArt PI (Merz) 1.88 >99%
  const rightUtPiMatch = text.match(/(?:Right\s*UtArt\s*PI|Right\s*Uterine\s*Art(?:\.|ery)?\s*PI|UtArt\s*R\s*PI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (rightUtPiMatch) {
    calculations.rightUterine!.pi = {
      value: parseNum(rightUtPiMatch[2]),
      method: rightUtPiMatch[1]?.trim() || 'Merz',
      percentile: parsePercentileStr(rightUtPiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: rightUtPiMatch[0],
      pdfVisible: true,
    };
  }

  // Right UtArt RI (Merz) 0.77 >99%
  const rightUtRiMatch = text.match(/(?:Right\s*UtArt\s*RI|Right\s*Uterine\s*Art(?:\.|ery)?\s*RI|UtArt\s*R\s*RI)(?:\s*\(((?:[^()]|\([^()]*\))*)\))?\s*[:\s=]*(\d+(?:\.\d+)?)(?:\s*([<>≤≥]?\s*\d+(?:\.\d+)?%))?/i);
  if (rightUtRiMatch) {
    calculations.rightUterine!.ri = {
      value: parseNum(rightUtRiMatch[2]),
      method: rightUtRiMatch[1]?.trim() || 'Merz',
      percentile: parsePercentileStr(rightUtRiMatch[3]),
      sourceSection: 'Doppler Calculations',
      sourceEvidence: rightUtRiMatch[0],
      pdfVisible: false,
    };
  }

  return calculations;
}
