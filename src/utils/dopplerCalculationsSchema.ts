/**
 * Phase 6 — single-source-of-truth resolution for Doppler Calculations.
 *
 * There used to be two parallel representations in this codebase:
 *   1. report.doppler.calculations  (DopplerCalculationsGroup) — canonical.
 *      Populated end-to-end by the OCR pipelines (Phase 5) and read by
 *      PrintReportModal.tsx for PDF export.
 *   2. report.dopplerCalculations   (DopplerCalculationsItem[]) — legacy.
 *      Only ever read/written by GeReportTab.tsx's own editable table; never
 *      populated by OCR and never read by the PDF.
 *
 * This module is the ONLY place that knows about the legacy array shape from
 * here on. It never writes report.dopplerCalculations — it only reads it, for
 * one-way migration, so a page loading an old saved report doesn't lose data
 * the user previously entered in that legacy table.
 */
import { DopplerCalculationsGroup, DopplerCalculationsItem } from '../types/ultrasound';

export type DopplerCalcGroupKey = 'ductusVenosus' | 'umbilicalArtery' | 'middleCerebralArtery' | 'leftUterine' | 'rightUterine';

export interface DopplerCalcRowConfig {
  id: string;
  parameter: string;
  groupKey: DopplerCalcGroupKey;
  field: string;
}

// The 13 rows GeReportTab.tsx has always shown, now defined once and used
// both for legacy-array migration and for rendering the canonical group.
export const DOPPLER_CALC_ROW_CONFIG: DopplerCalcRowConfig[] = [
  { id: 'dv_as', parameter: 'DV a/S', groupKey: 'ductusVenosus', field: 'aS' },
  { id: 'dv_pi', parameter: 'DV PI', groupKey: 'ductusVenosus', field: 'pi' },
  { id: 'dv_pli', parameter: 'DV PLI', groupKey: 'ductusVenosus', field: 'pli' },
  { id: 'dv_pviv', parameter: 'DV PVIV', groupKey: 'ductusVenosus', field: 'pviv' },
  { id: 'dv_sa', parameter: 'DV S/a', groupKey: 'ductusVenosus', field: 'sa' },
  { id: 'ua_pi', parameter: 'UmbArt PI', groupKey: 'umbilicalArtery', field: 'pi' },
  { id: 'ua_ri', parameter: 'UmbArt RI', groupKey: 'umbilicalArtery', field: 'ri' },
  { id: 'mca_pi', parameter: 'MCA PI', groupKey: 'middleCerebralArtery', field: 'pi' },
  { id: 'mca_ri', parameter: 'MCA RI', groupKey: 'middleCerebralArtery', field: 'ri' },
  { id: 'mca_ps', parameter: 'MCA PS', groupKey: 'middleCerebralArtery', field: 'ps' },
  { id: 'cpr', parameter: 'CPR (MCA PI / UA PI)', groupKey: 'middleCerebralArtery', field: 'cpr' },
  { id: 'uta_l_pi', parameter: 'Left UtArt PI', groupKey: 'leftUterine', field: 'pi' },
  { id: 'uta_r_pi', parameter: 'Right UtArt PI', groupKey: 'rightUterine', field: 'pi' },
];

const ROW_CONFIG_BY_ID: Record<string, DopplerCalcRowConfig> = Object.fromEntries(
  DOPPLER_CALC_ROW_CONFIG.map((c) => [c.id, c])
);

function hasAnyData(group: DopplerCalculationsGroup | undefined | null): boolean {
  if (!group) return false;
  return Object.values(group).some(
    (g) => g && typeof g === 'object' && Object.values(g as object).some((item: any) => item && item.value !== null && item.value !== undefined)
  );
}

/**
 * One-way migration: legacy flat array rows -> canonical group shape.
 * Only rows matching a known id (DOPPLER_CALC_ROW_CONFIG) are migrated; rows
 * with an unrecognized id or a null/undefined value are skipped rather than
 * guessed at. Never mutates or writes back to the legacy array.
 */
export function migrateLegacyDopplerCalculations(legacyItems: DopplerCalculationsItem[] | undefined | null): DopplerCalculationsGroup {
  const group: any = {};
  for (const item of legacyItems || []) {
    const cfg = item?.id ? ROW_CONFIG_BY_ID[item.id] : undefined;
    if (!cfg || item.value === null || item.value === undefined) continue;
    if (!group[cfg.groupKey]) group[cfg.groupKey] = {};
    group[cfg.groupKey][cfg.field] = {
      value: item.value,
      unit: item.unit,
      method: item.method,
      percentile: item.percentile,
      mom: item.mom,
      includeInPdf: item.includeInPdf ?? false,
      pdfVisible: item.pdfVisible ?? item.includeInPdf ?? false,
    } as DopplerCalculationsItem;
  }
  return group;
}

export interface DopplerCalculationsResolution {
  calculations: DopplerCalculationsGroup | undefined;
  source: 'canonical' | 'migrated_legacy' | 'none';
  conflict: boolean;
  warning?: string;
}

/**
 * Resolves the single Doppler Calculations group a UI/PDF should use.
 * Canonical `doppler.calculations` always wins when it has data. The legacy
 * array is only ever used (migrated, read-only) when canonical is empty.
 * If both exist with data, canonical wins and a conflict warning is
 * returned instead of silently merging two possibly-different sources.
 */
export function resolveDopplerCalculationsGroup(report: {
  doppler?: { calculations?: DopplerCalculationsGroup | null } | null;
  dopplerCalculations?: DopplerCalculationsItem[] | null;
}): DopplerCalculationsResolution {
  const canonical = report?.doppler?.calculations || undefined;
  const legacyArray = report?.dopplerCalculations || undefined;
  const canonicalHasData = hasAnyData(canonical);
  const legacyHasData = Array.isArray(legacyArray) && legacyArray.some((it) => it && it.value !== null && it.value !== undefined);

  if (canonicalHasData && legacyHasData) {
    return {
      calculations: canonical,
      source: 'canonical',
      conflict: true,
      warning:
        '[DOPPLER CALCULATIONS] CONFLICT: report has both legacy report.dopplerCalculations (array) ' +
        'and canonical report.doppler.calculations with data. Using canonical; legacy values are ignored ' +
        'and NOT auto-merged to avoid silently blending two possibly-different sources.',
    };
  }
  if (canonicalHasData) {
    return { calculations: canonical, source: 'canonical', conflict: false };
  }
  if (legacyHasData) {
    return { calculations: migrateLegacyDopplerCalculations(legacyArray), source: 'migrated_legacy', conflict: false };
  }
  return { calculations: undefined, source: 'none', conflict: false };
}

/**
 * Builds display rows (id/parameter/method/value/unit/percentile/mom/includeInPdf)
 * for the 13 known Doppler Calculations parameters from a resolved canonical
 * group. Values genuinely absent stay null — never fabricated with a
 * placeholder default.
 */
export function buildDopplerCalcDisplayRows(calculations: DopplerCalculationsGroup | undefined): DopplerCalculationsItem[] {
  return DOPPLER_CALC_ROW_CONFIG.map((cfg) => {
    const raw = (calculations as any)?.[cfg.groupKey]?.[cfg.field] as DopplerCalculationsItem | undefined;
    // GeReportTab's table has always rendered percentile as `${item.percentile}%`
    // (a bare number/comparator, no trailing '%'). The canonical group's parser
    // output already includes a trailing '%' (e.g. "74.2%", ">99%"), so strip it
    // here to keep that existing render convention working for both the
    // canonical and migrated-legacy paths without touching the JSX itself.
    const percentile = raw?.percentile ? String(raw.percentile).replace(/%\s*$/, '') : undefined;
    return {
      id: cfg.id,
      parameter: cfg.parameter,
      value: raw?.value ?? null,
      unit: raw?.unit,
      method: raw?.method,
      percentile,
      mom: raw?.mom,
      includeInPdf: raw?.includeInPdf ?? raw?.pdfVisible ?? false,
    };
  });
}

/**
 * Applies a single edited row's value back into a canonical group, returning
 * a NEW group object (does not mutate the input). Unknown ids are ignored.
 */
export function applyDopplerCalcRowEdit(
  calculations: DopplerCalculationsGroup | undefined,
  rowId: string,
  patch: Partial<Pick<DopplerCalculationsItem, 'value' | 'includeInPdf'>>
): DopplerCalculationsGroup {
  const cfg = ROW_CONFIG_BY_ID[rowId];
  const next: any = { ...(calculations || {}) };
  if (!cfg) return next;
  const groupObj = { ...(next[cfg.groupKey] || {}) };
  const existing = groupObj[cfg.field] || { value: null };
  groupObj[cfg.field] = { ...existing, ...patch };
  next[cfg.groupKey] = groupObj;
  return next;
}
