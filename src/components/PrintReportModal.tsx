import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Activity, 
  CheckCircle2, 
  FileText, 
  Image as ImageIcon, 
  Sparkles,
  Layers,
  ChevronDown,
  Loader2,
  Calendar,
  UserCheck,
  Check,
  Baby,
  Edit3,
  Save
} from 'lucide-react';
import { UltrasoundReport, PatientInfo, Measurements2D, FetalWeightEFW, DopplerValues, MorphologySurveyV2, ConclusionDetailsV2, AnatomyChecklist, AmnioticFluidData, PlacentaData } from '../types/ultrasound';
import { FORM_TEMPLATES, FormTemplateInfo, getTemplateById, detectBestTemplate, getStoredFormTemplates, parseGestationalAgeWeeks } from '../data/formTemplates';
import { TemplateManagerModal } from './TemplateManagerModal';
import { estimateWeightPercentile } from '../utils/clinicalCalculations';
import { exportReportToPdf, ExportPdfResult } from '../utils/pdfExport';
import { HardDrive, FolderCheck } from 'lucide-react';

interface PrintReportModalProps {
  report: UltrasoundReport;
  onUpdateReport?: (updatedReport: UltrasoundReport) => void;
  pcRootDirectoryHandle?: FileSystemDirectoryHandle | null;
  onOpenPcSettings?: () => void;
  onClose: () => void;
}

const EditableInput: React.FC<{
  value: string | number | null | undefined;
  onChange: (val: string) => void;
  isEditMode: boolean;
  className?: string;
  placeholder?: string;
  type?: string;
  displayPrefix?: string;
  displaySuffix?: string;
}> = ({ value, onChange, isEditMode, className = '', placeholder = '...', type = 'text', displayPrefix = '', displaySuffix = '' }) => {
  if (!isEditMode) {
    const valStr = value !== null && value !== undefined && value !== '' ? `${value}` : '';
    if (!valStr) return <span className="text-slate-400 italic font-normal">{placeholder}</span>;
    return <span className={className}>{displayPrefix}{valStr}{displaySuffix}</span>;
  }
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-amber-50/90 hover:bg-yellow-100 focus:bg-white focus:ring-2 focus:ring-blue-500 border border-amber-400 rounded px-1.5 py-0.5 text-slate-900 font-medium text-xs transition-colors print:border-none print:bg-transparent ${className}`}
    />
  );
};

const EditableTextarea: React.FC<{
  value: string | null | undefined;
  onChange: (val: string) => void;
  isEditMode: boolean;
  className?: string;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, isEditMode, className = '', placeholder = 'Nhập nội dung...', rows = 2 }) => {
  if (!isEditMode) {
    return <span className={`whitespace-pre-wrap ${className}`}>{value || placeholder}</span>;
  }
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-amber-50/90 hover:bg-yellow-100 focus:bg-white focus:ring-2 focus:ring-blue-500 border border-amber-400 rounded p-1.5 text-slate-900 font-medium leading-relaxed resize-y text-xs transition-colors print:border-none print:bg-transparent ${className}`}
    />
  );
};

function zToPercentile(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return Math.max(1, Math.min(99, Math.round(p * 1000) / 10));
}

function calculatePercentileForMeasurement(
  id: string,
  value: number,
  gaWeeks?: number,
  method?: string
): string {
  if (!gaWeeks || gaWeeks <= 0 || isNaN(value) || value <= 0) {
    return '--';
  }
  const w = Math.round(gaWeeks);
  const cleanId = id.toLowerCase();
  const std =
    method ||
    (cleanId === 'bpd' || cleanId === 'hc' || cleanId === 'ac'
      ? 'INTERGROWTH-21st'
      : cleanId === 'fl' || cleanId === 'hl'
      ? 'Hadlock'
      : cleanId === 'crl'
      ? 'Robinson'
      : cleanId === 'nt'
      ? 'FMF London'
      : 'Hadlock');

  if (cleanId === 'efw') {
    const calc = estimateWeightPercentile(value, w);
    return `${calc.percentile} theo ${std || 'Hadlock 3'}`;
  }

  const stats: Record<string, Record<number, { med: number; sd: number }>> = {
    bpd: {
      12: { med: 19, sd: 2.0 }, 13: { med: 23, sd: 2.2 }, 14: { med: 26, sd: 2.4 }, 15: { med: 30, sd: 2.5 },
      16: { med: 34, sd: 2.7 }, 17: { med: 38, sd: 2.8 }, 18: { med: 41, sd: 3.0 }, 19: { med: 44, sd: 3.1 },
      20: { med: 47, sd: 3.2 }, 21: { med: 50, sd: 3.3 }, 22: { med: 53, sd: 3.4 }, 23: { med: 56, sd: 3.5 },
      24: { med: 59, sd: 3.6 }, 25: { med: 62, sd: 3.7 }, 26: { med: 65, sd: 3.8 }, 27: { med: 68, sd: 3.9 },
      28: { med: 71, sd: 4.0 }, 29: { med: 74, sd: 4.1 }, 30: { med: 76, sd: 4.2 }, 31: { med: 79, sd: 4.3 },
      32: { med: 81, sd: 4.4 }, 33: { med: 83, sd: 4.5 }, 34: { med: 85, sd: 4.6 }, 35: { med: 87, sd: 4.7 },
      36: { med: 89, sd: 4.8 }, 37: { med: 91, sd: 4.9 }, 38: { med: 92, sd: 5.0 }, 39: { med: 94, sd: 5.1 },
      40: { med: 95, sd: 5.2 },
    },
    hc: {
      12: { med: 70, sd: 6.0 }, 13: { med: 84, sd: 7.0 }, 14: { med: 95, sd: 8.0 }, 15: { med: 108, sd: 8.5 },
      16: { med: 122, sd: 9.0 }, 17: { med: 136, sd: 9.2 }, 18: { med: 149, sd: 9.5 }, 19: { med: 162, sd: 9.8 },
      20: { med: 175, sd: 10.0 }, 21: { med: 188, sd: 10.2 }, 22: { med: 200, sd: 10.5 }, 23: { med: 212, sd: 10.8 },
      24: { med: 223, sd: 11.0 }, 25: { med: 234, sd: 11.2 }, 26: { med: 245, sd: 11.5 }, 27: { med: 255, sd: 11.8 },
      28: { med: 265, sd: 12.0 }, 29: { med: 275, sd: 12.2 }, 30: { med: 284, sd: 12.5 }, 31: { med: 293, sd: 12.8 },
      32: { med: 301, sd: 13.0 }, 33: { med: 309, sd: 13.2 }, 34: { med: 316, sd: 13.5 }, 35: { med: 323, sd: 13.8 },
      36: { med: 329, sd: 14.0 }, 37: { med: 335, sd: 14.2 }, 38: { med: 340, sd: 14.5 }, 39: { med: 345, sd: 14.8 },
      40: { med: 350, sd: 15.0 },
    },
    ac: {
      12: { med: 56, sd: 6.0 }, 13: { med: 69, sd: 7.0 }, 14: { med: 80, sd: 8.0 }, 15: { med: 92, sd: 8.5 },
      16: { med: 104, sd: 9.0 }, 17: { med: 116, sd: 9.5 }, 18: { med: 128, sd: 10.0 }, 19: { med: 140, sd: 10.5 },
      20: { med: 152, sd: 11.0 }, 21: { med: 164, sd: 11.5 }, 22: { med: 175, sd: 12.0 }, 23: { med: 187, sd: 12.5 },
      24: { med: 198, sd: 13.0 }, 25: { med: 209, sd: 13.5 }, 26: { med: 220, sd: 14.0 }, 27: { med: 231, sd: 14.5 },
      28: { med: 242, sd: 15.0 }, 29: { med: 253, sd: 15.5 }, 30: { med: 263, sd: 16.0 }, 31: { med: 273, sd: 16.5 },
      32: { med: 283, sd: 17.0 }, 33: { med: 293, sd: 17.5 }, 34: { med: 302, sd: 18.0 }, 35: { med: 311, sd: 18.5 },
      36: { med: 320, sd: 19.0 }, 37: { med: 328, sd: 19.5 }, 38: { med: 336, sd: 20.0 }, 39: { med: 343, sd: 20.5 },
      40: { med: 350, sd: 21.0 },
    },
    fl: {
      12: { med: 9, sd: 1.5 }, 13: { med: 11, sd: 1.6 }, 14: { med: 14, sd: 1.8 }, 15: { med: 17, sd: 2.0 },
      16: { med: 21, sd: 2.2 }, 17: { med: 24, sd: 2.4 }, 18: { med: 27, sd: 2.5 }, 19: { med: 30, sd: 2.6 },
      20: { med: 33, sd: 2.7 }, 21: { med: 36, sd: 2.8 }, 22: { med: 38, sd: 2.9 }, 23: { med: 41, sd: 3.0 },
      24: { med: 43, sd: 3.1 }, 25: { med: 46, sd: 3.2 }, 26: { med: 48, sd: 3.3 }, 27: { med: 51, sd: 3.4 },
      28: { med: 53, sd: 3.5 }, 29: { med: 55, sd: 3.6 }, 30: { med: 57, sd: 3.7 }, 31: { med: 60, sd: 3.8 },
      32: { med: 62, sd: 3.9 }, 33: { med: 64, sd: 4.0 }, 34: { med: 66, sd: 4.1 }, 35: { med: 68, sd: 4.2 },
      36: { med: 69, sd: 4.3 }, 37: { med: 71, sd: 4.4 }, 38: { med: 72, sd: 4.5 }, 39: { med: 74, sd: 4.6 },
      40: { med: 75, sd: 4.7 },
    },
    hl: {
      12: { med: 8, sd: 1.5 }, 13: { med: 10, sd: 1.6 }, 14: { med: 13, sd: 1.8 }, 15: { med: 16, sd: 2.0 },
      16: { med: 20, sd: 2.2 }, 17: { med: 23, sd: 2.4 }, 18: { med: 26, sd: 2.5 }, 19: { med: 29, sd: 2.6 },
      20: { med: 32, sd: 2.7 }, 21: { med: 34, sd: 2.8 }, 22: { med: 36, sd: 2.9 }, 23: { med: 38, sd: 3.0 },
      24: { med: 40, sd: 3.1 }, 25: { med: 42, sd: 3.2 }, 26: { med: 44, sd: 3.3 }, 27: { med: 46, sd: 3.4 },
      28: { med: 48, sd: 3.5 }, 29: { med: 50, sd: 3.6 }, 30: { med: 52, sd: 3.7 }, 31: { med: 54, sd: 3.8 },
      32: { med: 55, sd: 3.9 }, 33: { med: 57, sd: 4.0 }, 34: { med: 58, sd: 4.1 }, 35: { med: 60, sd: 4.2 },
      36: { med: 61, sd: 4.3 }, 37: { med: 62, sd: 4.4 }, 38: { med: 63, sd: 4.5 }, 39: { med: 64, sd: 4.6 },
      40: { med: 65, sd: 4.7 },
    },
    ofd: {
      14: { med: 31, sd: 2.8 }, 16: { med: 41, sd: 3.2 }, 18: { med: 51, sd: 3.6 }, 20: { med: 60, sd: 4.0 },
      22: { med: 69, sd: 4.4 }, 24: { med: 78, sd: 4.8 }, 26: { med: 86, sd: 5.2 }, 28: { med: 93, sd: 5.6 },
      30: { med: 100, sd: 6.0 }, 32: { med: 106, sd: 6.4 }, 34: { med: 111, sd: 6.8 }, 36: { med: 116, sd: 7.2 },
      38: { med: 120, sd: 7.6 }, 40: { med: 123, sd: 8.0 },
    },
    crl: {
      7: { med: 10, sd: 2.0 }, 8: { med: 15, sd: 2.5 }, 9: { med: 23, sd: 3.0 }, 10: { med: 31, sd: 3.5 },
      11: { med: 42, sd: 4.0 }, 12: { med: 54, sd: 4.5 }, 13: { med: 67, sd: 5.0 }, 14: { med: 80, sd: 5.5 },
    }
  };

  const st = stats[cleanId]?.[w];
  if (!st) {
    return `Theo ${std}`;
  }

  const z = (value - st.med) / st.sd;
  const pct = zToPercentile(z);
  return `${pct.toFixed(1)}% theo ${std}`;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  report,
  onUpdateReport,
  pcRootDirectoryHandle,
  onOpenPcSettings,
  onClose,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [editableReport, setEditableReport] = useState<UltrasoundReport>(report);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return report.detectedCategory || detectBestTemplate(report).template.id;
  });
  const [templatesList, setTemplatesList] = useState<FormTemplateInfo[]>(getStoredFormTemplates);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);

  useEffect(() => {
    const handleTemplatesUpdated = () => {
      setTemplatesList(getStoredFormTemplates());
    };
    window.addEventListener('sono_templates_updated', handleTemplatesUpdated);
    return () => window.removeEventListener('sono_templates_updated', handleTemplatesUpdated);
  }, []);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeDoctorSignature, setIncludeDoctorSignature] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState<string | null>(null);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<ExportPdfResult | null>(null);

  const activeTemplate = getTemplateById(selectedTemplateId);

  // Sync prop changes into local state
  useEffect(() => {
    setEditableReport(report);
  }, [report]);

  // Helper to update report and notify parent
  const updateReport = (keyOrUpdater: any, value?: any) => {
    setEditableReport(prev => {
      let next: UltrasoundReport;
      if (typeof keyOrUpdater === 'function') {
        next = keyOrUpdater(prev);
      } else {
        next = { ...prev, [keyOrUpdater]: value };
      }
      if (onUpdateReport) {
        onUpdateReport(next);
      }
      return next;
    });
  };

  const updatePatientField = (field: keyof PatientInfo, value: any) => {
    updateReport(prev => ({
      ...prev,
      patient: {
        ...prev.patient,
        [field]: value
      }
    }));
  };

  const updateMeasurementValue = (key: keyof Measurements2D, value: any) => {
    updateReport(prev => ({
      ...prev,
      measurements: {
        ...prev.measurements,
        [key]: {
          ...(prev.measurements[key] || {}),
          value: value === '' ? null : (isNaN(Number(value)) ? value : Number(value))
        }
      }
    }));
  };

  const updateEfwField = (field: keyof FetalWeightEFW, value: any) => {
    updateReport(prev => ({
      ...prev,
      efw: {
        ...prev.efw,
        [field]: field === 'value' ? (value === '' ? null : Number(value)) : value
      }
    }));
  };

  const updateDopplerValue = (vessel: keyof DopplerValues, field: string, value: any) => {
    updateReport(prev => ({
      ...prev,
      doppler: {
        ...prev.doppler,
        [vessel]: typeof prev.doppler[vessel] === 'object' && prev.doppler[vessel] !== null
          ? { ...(prev.doppler[vessel] as any), [field]: value === '' ? null : (isNaN(Number(value)) ? value : Number(value)) }
          : { [field]: value === '' ? null : (isNaN(Number(value)) ? value : Number(value)) }
      }
    }));
  };

  const updateDopplerVessel = updateDopplerValue;

  const updateMorphologyV2Field = (field: keyof MorphologySurveyV2, value: string) => {
    updateReport(prev => ({
      ...prev,
      morphologyV2: {
        ...(prev.morphologyV2 || {}),
        [field]: value
      }
    }));
  };

  const updateConclusionV2Field = (field: keyof ConclusionDetailsV2, value: string) => {
    updateReport(prev => ({
      ...prev,
      conclusionV2: {
        ...(prev.conclusionV2 || {}),
        [field]: value
      }
    }));
  };

  const updateAnatomyField = (field: keyof AnatomyChecklist, value: string) => {
    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      anatomy: {
        ...(prev.anatomy || {}),
        [field]: value,
      },
    }));
  };

  const updateAmnioticFluidField = (field: keyof AmnioticFluidData, value: any) => {
    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      amnioticFluid: {
        ...(prev.amnioticFluid || {}),
        [field]: value,
      },
    }));
  };

  const updatePlacentaField = (field: keyof PlacentaData, value: any) => {
    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      placenta: {
        ...(prev.placenta || {}),
        [field]: value,
      },
    }));
  };

  const getGaWeeks = (): number | undefined => {
    const gaParsed =
      parseGestationalAgeWeeks(editableReport.patient?.gaClin) ||
      parseGestationalAgeWeeks(editableReport.patient?.gaAua) ||
      parseGestationalAgeWeeks(editableReport.patient?.ga);
    return gaParsed?.totalWeeks;
  };

  const handleUpdateBiometryValue = (id: keyof Measurements2D, rawVal: string) => {
    const numVal = rawVal === '' ? null : (isNaN(Number(rawVal)) ? rawVal : Number(rawVal));
    const gaW = getGaWeeks();
    const currentMeas = editableReport.measurements?.[id];
    const method = currentMeas?.method;

    let newPercentile = currentMeas?.percentile;
    if (typeof numVal === 'number' && gaW && gaW > 0) {
      newPercentile = calculatePercentileForMeasurement(id as string, numVal, gaW, method);
    }

    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      measurements: {
        ...(prev.measurements || {}),
        [id]: {
          ...(prev.measurements?.[id] || {}),
          value: numVal as any,
          percentile: newPercentile,
        }
      }
    }));
  };

  const handleUpdateBiometryPercentile = (id: keyof Measurements2D, newPercentile: string) => {
    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      measurements: {
        ...(prev.measurements || {}),
        [id]: {
          ...(prev.measurements?.[id] || {}),
          percentile: newPercentile,
        }
      }
    }));
  };

  const handleUpdateEfwValue = (rawVal: string) => {
    const numVal = rawVal === '' ? null : Number(rawVal);
    const gaW = getGaWeeks();
    const currentEfw = editableReport.efw;
    let newPercentile = currentEfw?.percentile;
    if (numVal && gaW && gaW > 0) {
      const calc = estimateWeightPercentile(numVal, Math.round(gaW));
      newPercentile = `${calc.percentile} theo ${currentEfw?.method || 'Hadlock 3'}`;
    }

    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      efw: {
        ...(prev.efw || {}),
        value: numVal,
        percentile: newPercentile,
      }
    }));
  };

  const handleUpdateEfwPercentile = (newPercentile: string) => {
    updateReport((prev: UltrasoundReport) => ({
      ...prev,
      efw: {
        ...(prev.efw || {}),
        percentile: newPercentile,
      }
    }));
  };

  const handleUpdateFetusBiometryValue = (fetusIdx: number, id: string, rawVal: string) => {
    const numVal = rawVal === '' ? null : (isNaN(Number(rawVal)) ? rawVal : Number(rawVal));
    const gaW = getGaWeeks();
    updateReport((prev: UltrasoundReport) => {
      const fetuses = [...(prev.fetuses || [])];
      if (!fetuses[fetusIdx]) return prev;
      const currentMeas = fetuses[fetusIdx].measurements?.[id as keyof Measurements2D];
      let newPercentile = currentMeas?.percentile;
      if (typeof numVal === 'number' && gaW && gaW > 0) {
        newPercentile = calculatePercentileForMeasurement(id, numVal, gaW, currentMeas?.method);
      }
      fetuses[fetusIdx] = {
        ...fetuses[fetusIdx],
        measurements: {
          ...(fetuses[fetusIdx].measurements || {}),
          [id]: {
            ...(currentMeas || {}),
            value: numVal as any,
            percentile: newPercentile,
          }
        } as Measurements2D
      };
      return { ...prev, fetuses };
    });
  };

  const handleUpdateFetusBiometryPercentile = (fetusIdx: number, id: string, newPercentile: string) => {
    updateReport((prev: UltrasoundReport) => {
      const fetuses = [...(prev.fetuses || [])];
      if (!fetuses[fetusIdx]) return prev;
      const currentMeas = fetuses[fetusIdx].measurements?.[id as keyof Measurements2D];
      fetuses[fetusIdx] = {
        ...fetuses[fetusIdx],
        measurements: {
          ...(fetuses[fetusIdx].measurements || {}),
          [id]: {
            ...(currentMeas || {}),
            percentile: newPercentile,
          }
        } as Measurements2D
      };
      return { ...prev, fetuses };
    });
  };

  const handleUpdateFetusEfwValue = (fetusIdx: number, rawVal: string) => {
    const numVal = rawVal === '' ? null : Number(rawVal);
    const gaW = getGaWeeks();
    updateReport((prev: UltrasoundReport) => {
      const fetuses = [...(prev.fetuses || [])];
      if (!fetuses[fetusIdx]) return prev;
      const currentEfw: Partial<FetalWeightEFW> = fetuses[fetusIdx].efw || {};
      let newPercentile = currentEfw.percentile;
      if (numVal && gaW && gaW > 0) {
        const calc = estimateWeightPercentile(numVal, Math.round(gaW));
        newPercentile = `${calc.percentile} theo ${currentEfw.method || 'Hadlock 3'}`;
      }
      fetuses[fetusIdx] = {
        ...fetuses[fetusIdx],
        efw: {
          unit: 'g',
          ...currentEfw,
          value: numVal,
          percentile: newPercentile,
        }
      };
      return { ...prev, fetuses };
    });
  };

  const handleUpdateFetusEfwPercentile = (fetusIdx: number, newPercentile: string) => {
    updateReport((prev: UltrasoundReport) => {
      const fetuses = [...(prev.fetuses || [])];
      if (!fetuses[fetusIdx]) return prev;
      const currentEfw: Partial<FetalWeightEFW> = fetuses[fetusIdx].efw || {};
      fetuses[fetusIdx] = {
        ...fetuses[fetusIdx],
        efw: {
          value: null,
          unit: 'g',
          ...currentEfw,
          percentile: newPercentile,
        }
      };
      return { ...prev, fetuses };
    });
  };



  // Auto detect best template on mount if not matched
  useEffect(() => {
    if (!selectedTemplateId) {
      const best = detectBestTemplate(editableReport);
      setSelectedTemplateId(best.template.id);
    }
  }, [editableReport, selectedTemplateId]);

  const handlePrint = () => {
    const wasEditing = isEditMode;
    setIsEditMode(false);
    setTimeout(() => {
      window.print();
      if (wasEditing) setIsEditMode(true);
    }, 120);
  };

  const handleExportPdf = async () => {
    if (!printAreaRef.current) return;
    const wasEditing = isEditMode;
    setIsEditMode(false);
    await new Promise(resolve => setTimeout(resolve, 120));

    setIsExportingPdf(true);
    setPdfProgressText('Đang khởi tạo tài liệu PDF...');
    setExportSuccessInfo(null);

    try {
      const result = await exportReportToPdf(printAreaRef.current, {
        patient: editableReport.patient,
        patientName: editableReport.patient.name || 'BenhNhan',
        examDate: editableReport.patient.examDate,
        gaAge: editableReport.patient.gaClin || editableReport.patient.gaAua,
        categoryName: activeTemplate?.name,
        pcRootDirectoryHandle: pcRootDirectoryHandle,
        onProgress: (status) => setPdfProgressText(status),
      });

      if (result.success) {
        setExportSuccessInfo(result);
        setTimeout(() => {
          setExportSuccessInfo(null);
          setPdfProgressText(null);
        }, 5000);
      } else {
        alert('Lỗi tạo PDF: ' + (result.error || 'Vui lòng thử lại'));
      }
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Có lỗi khi tạo file PDF. Bạn có thể sử dụng nút "In Phiếu" và chọn "Lưu dạng PDF" (Save as PDF).');
    } finally {
      setIsExportingPdf(false);
      if (wasEditing) setIsEditMode(true);
    }
  };

  const { patient, measurements, efw, doppler, amnioticFluid, placenta, anatomy, conclusion, recommendations, imageUrls } = editableReport;

  const currentFetalCount = editableReport.fetalCount || 1;

  const isDynamicV2 = selectedTemplateId === 'dynamic_v2' || selectedTemplateId === 'general_obstetric';
  const isEarlyPregnancy = selectedTemplateId === 'early_pregnancy_under_12w' || selectedTemplateId === 'early_pregnancy';
  const is1stTrimester = selectedTemplateId === 'screening_1st_trimester_12_13w6d' || selectedTemplateId === '1st_trimester_screening';
  const isMorphology = selectedTemplateId === 'morphology_14_32w' || selectedTemplateId === 'morphology_2d_3d_4d';
  const isGrowthDoppler = selectedTemplateId === 'growth_doppler_over_32w' || selectedTemplateId === 'doppler_fetal' || selectedTemplateId === 'doppler_afi';
  const isAmnioticCervix = selectedTemplateId === 'amniotic_cervix';
  const isGynecology = selectedTemplateId === 'gynecology';

  // Helper to format percentile with reference standard (e.g. 50% theo INTERGROWTH)
  const formatPercentileAndMethod = (
    percentile?: string,
    method?: string,
    defaultStandard?: string
  ): string => {
    const std = method || defaultStandard || '';
    if (percentile && std) {
      if (percentile.toLowerCase().includes(std.toLowerCase())) {
        return percentile;
      }
      return `${percentile} theo ${std}`;
    }
    if (percentile) return percentile;
    if (std) return `Theo ${std}`;
    return '--';
  };

  // Phase 4: safe formatter — never let null/undefined/NaN reach the PDF as text.
  const formatPdfValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && isNaN(value)) return '';
    return `${value}`;
  };

  // Phase 4 (PDF only): render doppler.calculations (DopplerCalculationsGroup),
  // which is populated by dopplerCalculationParser but was never read anywhere
  // in this file before — the section simply never appeared in the PDF.
  // Reads strictly from the canonical `doppler.calculations` field and is kept
  // entirely separate from the raw Doppler vessel measurements above; only
  // rows with an actual value are included, so the section renders nothing
  // when there is no calculations data.
  const dopplerCalc = doppler.calculations;
  const dopplerCalcRows: { key: string; label: string; value: string; extra?: string }[] = [];
  const pushCalcRow = (key: string, label: string, item?: { value: number | null; percentile?: string | null; mom?: number | null } | null, extraLabel?: string) => {
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

  const getFetusBiometryList = (fetusIdx: number) => {
    const list: any[] = [];
    const fetus = report.fetuses?.[fetusIdx];
    const fetusMeas = fetus?.measurements || (fetusIdx === 0 ? report.measurements : {});
    const fetusEfw = fetus?.efw || (fetusIdx === 0 ? report.efw : {});

    const pushItem = (id: string, code: string, name: string, defaultStandard: string, refNote: string) => {
      const fieldVal = fetusMeas[id]?.value;
      if (fieldVal) {
        list.push({
          id,
          code,
          name,
          value: fieldVal,
          unit: fetusMeas[id]?.unit || 'mm',
          gaAge: fetusMeas[id]?.gaAge,
          percentileText: formatPercentileAndMethod(fetusMeas[id]?.percentile, fetusMeas[id]?.method, defaultStandard),
          referenceNote: refNote,
        });
      }
    };

    pushItem('bpd', 'BPD', 'Đường kính lưỡng đỉnh (BPD)', 'INTERGROWTH', 'Đo ngang qua đồi thị, vách trong suốt');
    pushItem('ofd', 'OFD', 'Đường kính trán chẩm (OFD)', 'Hansmann', 'Bình thường');
    pushItem('hc', 'HC', 'Chu vi đầu (HC)', 'INTERGROWTH', 'Hình oval cân đối, bờ xương sọ liên tục');
    pushItem('ac', 'AC', 'Chu vi bụng (AC)', 'INTERGROWTH', 'Mặt cắt ngang qua tĩnh mạch rốn & dạ dày');
    pushItem('fl', 'FL', 'Chiều dài xương đùi (FL)', 'Hadlock', 'Trục xương thẳng, cốt hóa tốt');
    pushItem('hl', 'HL', 'Chiều dài xương cánh tay (HL)', 'Hadlock', 'Phát triển cân đối với FL');
    pushItem('crl', 'CRL', 'Chiều dài đầu mông (CRL)', 'Robinson', 'Chuẩn xác định tuổi thai quý 1 (Robinson)');
    if (fetusMeas['nt']?.value) {
      pushItem('nt', 'NT', 'Độ mờ da gáy (NT)', 'FMF London', (Number(fetusMeas['nt']?.value) || 0) <= 2.5 ? '< 2.5 mm (Ngưỡng an toàn)' : '≥ 2.5 mm (Cần tư vấn)');
    }
    pushItem('nbl', 'NBL', 'Chiều dài xương mũi (NBL)', 'Sonek', 'Hiện diện (+), cốt hóa rõ');
    pushItem('tcd', 'TCD', 'Đường kính ngang tiểu não (TCD)', 'Hill', 'Hình cánh bướm cân đối');
    if (fetusMeas['vp']?.value) {
      pushItem('vp', 'VP', 'Não thất bên (Vp)', 'Cardoza', (Number(fetusMeas['vp']?.value) || 0) < 10 ? '< 10 mm (Bình thường)' : 'Giãn não thất bên');
    }
    pushItem('cm', 'CM', 'Bể lớn hố sau (CM)', 'Mahony', '2.0 - 10.0 mm (Bình thường)');
    pushItem('bod', 'BOD', 'Khoảng cách 2 hốc mắt ngoài (BOD)', 'Trout', 'Cân đối');
    pushItem('foot', 'Foot', 'Chiều dài bàn chân (Foot)', 'Mercer', 'Tỷ lệ FL/Foot bình thường');
    pushItem('cervixLength', 'CL', 'Chiều dài kênh cổ tử cung (CL)', 'Cervix', '> 25 mm (Nguy cơ sinh non thấp)');
    pushItem('gs', 'GS', 'Đường kính túi thai (GS)', 'Rempen', 'Túi thai tròn đều');
    pushItem('ys', 'YS', 'Túi noãn hoàng (YS)', 'Lindsay', '3.0 - 6.0 mm (Bình thường)');

    return { list, efw: fetusEfw };
  };

  // Build active biometry measurements list with percentile & reference standards
  const activeBiometryList: {
    id: string;
    code: string;
    name: string;
    value: number | string;
    unit: string;
    gaAge?: string;
    percentileText?: string;
    referenceNote?: string;
  }[] = [];

  if (measurements.bpd?.value) {
    activeBiometryList.push({
      id: 'bpd',
      code: 'BPD',
      name: 'Đường kính lưỡng đỉnh (BPD)',
      value: measurements.bpd.value,
      unit: measurements.bpd.unit || 'mm',
      gaAge: measurements.bpd.gaAge,
      percentileText: formatPercentileAndMethod(measurements.bpd.percentile, measurements.bpd.method, 'INTERGROWTH'),
      referenceNote: 'Đo ngang qua đồi thị, vách trong suốt',
    });
  }

  if (measurements.ofd?.value) {
    activeBiometryList.push({
      id: 'ofd',
      code: 'OFD',
      name: 'Đường kính trán chẩm (OFD)',
      value: measurements.ofd.value,
      unit: measurements.ofd.unit || 'mm',
      gaAge: measurements.ofd.gaAge,
      percentileText: formatPercentileAndMethod(measurements.ofd.percentile, measurements.ofd.method, 'Hansmann'),
      referenceNote: 'Bình thường',
    });
  }

  if (measurements.hc?.value) {
    activeBiometryList.push({
      id: 'hc',
      code: 'HC',
      name: 'Chu vi đầu (HC)',
      value: measurements.hc.value,
      unit: measurements.hc.unit || 'mm',
      gaAge: measurements.hc.gaAge,
      percentileText: formatPercentileAndMethod(measurements.hc.percentile, measurements.hc.method, 'INTERGROWTH'),
      referenceNote: 'Hình oval cân đối, bờ xương sọ liên tục',
    });
  }

  if (measurements.ac?.value) {
    activeBiometryList.push({
      id: 'ac',
      code: 'AC',
      name: 'Chu vi bụng (AC)',
      value: measurements.ac.value,
      unit: measurements.ac.unit || 'mm',
      gaAge: measurements.ac.gaAge,
      percentileText: formatPercentileAndMethod(measurements.ac.percentile, measurements.ac.method, 'INTERGROWTH'),
      referenceNote: 'Mặt cắt ngang qua tĩnh mạch rốn & dạ dày',
    });
  }

  if (measurements.fl?.value) {
    activeBiometryList.push({
      id: 'fl',
      code: 'FL',
      name: 'Chiều dài xương đùi (FL)',
      value: measurements.fl.value,
      unit: measurements.fl.unit || 'mm',
      gaAge: measurements.fl.gaAge,
      percentileText: formatPercentileAndMethod(measurements.fl.percentile, measurements.fl.method, 'Hadlock'),
      referenceNote: 'Trục xương thẳng, cốt hóa tốt',
    });
  }

  if (measurements.hl?.value) {
    activeBiometryList.push({
      id: 'hl',
      code: 'HL',
      name: 'Chiều dài xương cánh tay (HL)',
      value: measurements.hl.value,
      unit: measurements.hl.unit || 'mm',
      gaAge: measurements.hl.gaAge,
      percentileText: formatPercentileAndMethod(measurements.hl.percentile, measurements.hl.method, 'Hadlock'),
      referenceNote: 'Phát triển cân đối với FL',
    });
  }

  if (measurements.crl?.value) {
    activeBiometryList.push({
      id: 'crl',
      code: 'CRL',
      name: 'Chiều dài đầu mông (CRL)',
      value: measurements.crl.value,
      unit: measurements.crl.unit || 'mm',
      gaAge: measurements.crl.gaAge,
      percentileText: formatPercentileAndMethod(measurements.crl.percentile, measurements.crl.method, 'Robinson'),
      referenceNote: 'Chuẩn xác định tuổi thai quý 1 (Robinson)',
    });
  }

  if (measurements.nt?.value) {
    activeBiometryList.push({
      id: 'nt',
      code: 'NT',
      name: 'Độ mờ da gáy (NT / Nuchal Translucency)',
      value: measurements.nt.value,
      unit: measurements.nt.unit || 'mm',
      gaAge: measurements.nt.gaAge,
      percentileText: formatPercentileAndMethod(measurements.nt.percentile, measurements.nt.method, 'FMF London'),
      referenceNote: measurements.nt.value <= 2.5 ? '< 2.5 mm (Ngưỡng an toàn / Nguy cơ thấp)' : '≥ 2.5 mm (Cần tư vấn sàng lọc)',
    });
  }

  if (measurements.nbl?.value) {
    activeBiometryList.push({
      id: 'nbl',
      code: 'NBL',
      name: 'Chiều dài xương mũi (NBL)',
      value: measurements.nbl.value,
      unit: measurements.nbl.unit || 'mm',
      gaAge: measurements.nbl.gaAge,
      percentileText: formatPercentileAndMethod(measurements.nbl.percentile, measurements.nbl.method, 'Sonek'),
      referenceNote: 'Hiện diện (+), cốt hóa rõ',
    });
  }

  if (measurements.tcd?.value) {
    activeBiometryList.push({
      id: 'tcd',
      code: 'TCD',
      name: 'Đường kính ngang tiểu não (TCD / Cereb)',
      value: measurements.tcd.value,
      unit: measurements.tcd.unit || 'mm',
      gaAge: measurements.tcd.gaAge,
      percentileText: formatPercentileAndMethod(measurements.tcd.percentile, measurements.tcd.method, 'Hill'),
      referenceNote: 'Hình cánh bướm cân đối, rãnh liên bán cầu rõ',
    });
  }

  if (measurements.vp?.value) {
    activeBiometryList.push({
      id: 'vp',
      code: 'Vp',
      name: 'Não thất bên (Vp / LV)',
      value: measurements.vp.value,
      unit: measurements.vp.unit || 'mm',
      gaAge: measurements.vp.gaAge,
      percentileText: formatPercentileAndMethod(measurements.vp.percentile, measurements.vp.method, 'Cardoza'),
      referenceNote: measurements.vp.value < 10 ? '< 10 mm (Bình thường)' : 'Giãn não thất bên',
    });
  }

  if (measurements.cm?.value) {
    activeBiometryList.push({
      id: 'cm',
      code: 'CM',
      name: 'Bể lớn hố sau (Cisterna Magna)',
      value: measurements.cm.value,
      unit: measurements.cm.unit || 'mm',
      gaAge: measurements.cm.gaAge,
      percentileText: formatPercentileAndMethod(measurements.cm.percentile, measurements.cm.method, 'Mahony'),
      referenceNote: '2.0 - 10.0 mm (Bình thường)',
    });
  }

  if (measurements.bod?.value) {
    activeBiometryList.push({
      id: 'bod',
      code: 'BOD',
      name: 'Khoảng cách 2 hốc mắt ngoài (BOD)',
      value: measurements.bod.value,
      unit: measurements.bod.unit || 'mm',
      gaAge: measurements.bod.gaAge,
      percentileText: formatPercentileAndMethod(measurements.bod.percentile, measurements.bod.method, 'Trout'),
      referenceNote: 'Cân đối',
    });
  }

  if (measurements.foot?.value) {
    activeBiometryList.push({
      id: 'foot',
      code: 'Foot',
      name: 'Chiều dài bàn chân (Foot)',
      value: measurements.foot.value,
      unit: measurements.foot.unit || 'mm',
      gaAge: measurements.foot.gaAge,
      percentileText: formatPercentileAndMethod(measurements.foot.percentile, measurements.foot.method, 'Mercer'),
      referenceNote: 'Tỷ lệ FL/Foot bình thường',
    });
  }

  if (measurements.gs?.value) {
    activeBiometryList.push({
      id: 'gs',
      code: 'GS',
      name: 'Đường kính túi thai (GS)',
      value: measurements.gs.value,
      unit: measurements.gs.unit || 'mm',
      gaAge: measurements.gs.gaAge,
      percentileText: formatPercentileAndMethod(measurements.gs.percentile, measurements.gs.method, 'Rempen'),
      referenceNote: 'Túi thai tròn đều, viền màng rụng dày',
    });
  }

  if (measurements.ys?.value) {
    activeBiometryList.push({
      id: 'ys',
      code: 'YS',
      name: 'Túi noãn hoàng (YS / Yolk Sac)',
      value: measurements.ys.value,
      unit: measurements.ys.unit || 'mm',
      percentileText: formatPercentileAndMethod(measurements.ys.percentile, measurements.ys.method, 'Lindsay'),
      referenceNote: '3.0 - 6.0 mm (Bình thường)',
    });
  }

  if (measurements.cervixLength?.value) {
    activeBiometryList.push({
      id: 'cervixLength',
      code: 'CL',
      name: 'Chiều dài kênh cổ tử cung (CL)',
      value: measurements.cervixLength.value,
      unit: measurements.cervixLength.unit || 'mm',
      referenceNote: '> 25 mm (Nguy cơ sinh non thấp)',
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-h-none print:rounded-none print:bg-white">
        
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 print:hidden space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  Xem Trước & Xuất Phiếu Kết Quả Siêu Âm
                </h3>
                <p className="text-[11px] text-slate-400">
                  Chuẩn hóa theo mẫu phiếu kết quả sản phụ khoa Việt Nam (Khổ A4 chuẩn)
                </p>
              </div>
            </div>

            {/* Action Buttons: Export PDF & Print */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Edit Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                  isEditMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                    : 'bg-slate-700 hover:bg-slate-600 text-amber-300 border border-slate-600'
                }`}
                title="Bật/Tắt chế độ chỉnh sửa trực tiếp kết quả siêu âm"
              >
                <Edit3 className="w-4 h-4" />
                <span>{isEditMode ? '✓ Đang bật Sửa' : '✏️ Bật Sửa Trực Tiếp'}</span>
              </button>

              {/* Export PDF Button */}
              <button
                id="btn-export-pdf"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50"
                title="Xuất file PDF (tự động lưu vào thư mục SĐT bệnh nhân trên PC)"
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang tạo PDF...</span>
                  </>
                ) : exportSuccessInfo ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>{exportSuccessInfo.savedToPc ? 'Đã lưu vào PC!' : 'Đã tải PDF!'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Xuất File PDF</span>
                  </>
                )}
              </button>

              {/* Print Button */}
              <button
                id="btn-print-report"
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md transition active:scale-95"
                title="In trực tiếp ra máy in hoặc Lưu dạng PDF của trình duyệt"
              >
                <Printer className="w-4 h-4" />
                <span>In Phiếu (Ctrl + P)</span>
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                title="Đóng cửa sổ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-bar: Template selector and print options */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              <span className="text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Form Mẫu:
              </span>
              <button
                type="button"
                onClick={() => setIsTemplateManagerOpen(true)}
                className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-800/80 transition flex items-center gap-1 shrink-0"
                title="Quản lý và chỉnh sửa form mẫu"
              >
                <Edit3 className="w-3 h-3 text-yellow-300" />
                <span>Quản Lý Mẫu</span>
              </button>
              {templatesList.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                    selectedTemplateId === tmpl.id
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  <span>{tmpl.code.replace('FORM-', '')}</span>
                  {tmpl.isCustom && <span className="text-[9px] text-amber-300">(tự tạo)</span>}
                  {selectedTemplateId === tmpl.id && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>

            {/* Checkbox Options */}
            <div className="flex items-center gap-4 text-[11px] text-slate-300">
              {imageUrls && imageUrls.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-0"
                  />
                  <span>Đính kèm ảnh ({imageUrls.length})</span>
                </label>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDoctorSignature}
                  onChange={(e) => setIncludeDoctorSignature(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-0"
                />
                <span>Chữ ký Bác sĩ</span>
              </label>
            </div>
          </div>
        </div>

        {/* Status notice when exporting */}
        {pdfProgressText && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-1.5 text-xs text-emerald-300 flex items-center justify-center gap-2 print:hidden animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{pdfProgressText}</span>
          </div>
        )}

        {/* Printable Medical Sheet Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/40 print:p-0 print:bg-white print:overflow-visible">
          {/* Edit Mode Notice Banner */}
          {isEditMode && (
            <div className="max-w-[210mm] mx-auto mb-3 bg-amber-500/15 border border-amber-500/40 text-amber-200 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between shadow-sm print:hidden">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Đang ở Chế Độ Chỉnh Sửa Trực Tiếp:</strong> Nhấp trực tiếp vào bất kỳ ô chữ, chỉ số hay kết luận nào bên dưới để chỉnh sửa theo ý muốn trước khi in hay xuất PDF.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="text-[11px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-2.5 py-1 rounded-lg ml-2 whitespace-nowrap shadow-sm transition-colors"
              >
                Hoàn tất sửa
              </button>
            </div>
          )}

          <div
            ref={printAreaRef}
            id="ultrasound-printable-document"
            className="bg-white text-slate-900 mx-auto max-w-[210mm] min-h-[297mm] p-6 sm:p-8 rounded-xl shadow-lg print:shadow-none print:p-0 print:w-full print:rounded-none font-sans text-xs"
            style={{ colorScheme: 'light' }}
          >
            {/* 1. Medical Header */}
            <div className="flex items-start justify-between border-b-2 border-blue-900 pb-2.5 mb-2.5">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-blue-800 text-white flex items-center justify-center font-black text-xl shadow-sm">
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black text-blue-900 uppercase tracking-tight whitespace-pre-line">
                    <EditableInput
                      value={patient.clinicHeader || (isDynamicV2 ? 'BS CAO BÁ SƠN - SIÊU ÂM 5D CHUYÊN SÂU\nHD57 Hải Đăng 9 - Vinhomes Ocean Park' : 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA')}
                      onChange={(v) => updatePatientField('clinicHeader', v)}
                      isEditMode={isEditMode}
                      className="font-black text-blue-900 uppercase w-full"
                    />
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {isDynamicV2 ? 'Hotline: 0967.275.799 • Chuyên sâu Siêu âm Hình thái & Tăng trưởng Thai' : 'Chuyên khoa Siêu âm Chẩn đoán Hình ảnh & Sàng lọc Trước Sinh'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Bác sĩ phụ trách:{' '}
                    <EditableInput
                      value={patient.sonographer || 'BS. CAO BÁ SƠN'}
                      onChange={(v) => updatePatientField('sonographer', v)}
                      isEditMode={isEditMode}
                      className="font-semibold text-slate-800"
                    />
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-mono font-bold text-slate-700">
                  MÃ BN:{' '}
                  <EditableInput
                    value={patient.patientId || patient.phone || '0353279368'}
                    onChange={(v) => { updatePatientField('patientId', v); updatePatientField('phone', v); }}
                    isEditMode={isEditMode}
                    className="font-mono font-bold text-slate-700 w-24"
                  />
                </div>
                <div className="text-[10px] text-slate-500">
                  Ngày khám:{' '}
                  <EditableInput
                    value={patient.examDate || new Date().toLocaleDateString('vi-VN')}
                    onChange={(v) => updatePatientField('examDate', v)}
                    isEditMode={isEditMode}
                    className="text-slate-600 w-24"
                  />
                </div>
                <div className="text-[9px] bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded border border-blue-200 mt-1 inline-block font-mono font-bold">
                  {activeTemplate.code}
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-2">
              <h2 className="text-base sm:text-lg font-black text-blue-950 uppercase tracking-wider">
                {selectedTemplateId === 'gynecology'
                  ? 'PHIẾU KẾT QUẢ SIÊU ÂM PHỤ KHOA'
                  : isDynamicV2
                  ? 'KẾT QUẢ SIÊU ÂM'
                  : 'PHIẾU KẾT QUẢ SIÊU ÂM SẢN PHỤ KHOA'}
              </h2>
              <div className="text-[11px] font-bold text-blue-800 uppercase mt-0.5">
                {isDynamicV2 ? 'SIÊU ÂM 5D – HÌNH THÁI & TĂNG TRƯỞNG THAI NHI' : `(${activeTemplate.name})`}
              </div>
            </div>

            {/* 2. Patient Demographics Box */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-[11px] mb-3 leading-relaxed">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-1.5 gap-x-3">
                <div>
                  <span className="text-slate-500">Họ và tên:</span>{' '}
                  <EditableInput
                    value={patient.name}
                    onChange={(v) => updatePatientField('name', v)}
                    isEditMode={isEditMode}
                    placeholder="---"
                    className="font-bold text-slate-900 uppercase w-32"
                  />
                </div>
                <div>
                  <span className="text-slate-500">Năm sinh / Tuổi:</span>{' '}
                  <EditableInput
                    value={patient.yearOfBirth}
                    onChange={(v) => updatePatientField('yearOfBirth', v)}
                    isEditMode={isEditMode}
                    placeholder="--"
                    className="font-semibold text-slate-800 w-12"
                  />{' '}
                  <EditableInput
                    value={patient.age}
                    onChange={(v) => updatePatientField('age', v)}
                    isEditMode={isEditMode}
                    placeholder="--"
                    displayPrefix="("
                    displaySuffix="t)"
                    className="font-semibold text-slate-800 w-10"
                  />
                </div>
                <div>
                  <span className="text-slate-500">Điện thoại / ID:</span>{' '}
                  <EditableInput
                    value={patient.patientId || patient.phone}
                    onChange={(v) => { updatePatientField('patientId', v); updatePatientField('phone', v); }}
                    isEditMode={isEditMode}
                    placeholder="--"
                    className="font-semibold font-mono text-slate-800 w-28"
                  />
                </div>
                <div>
                  <span className="text-slate-500">Địa chỉ:</span>{' '}
                  <EditableInput
                    value={patient.address}
                    onChange={(v) => updatePatientField('address', v)}
                    isEditMode={isEditMode}
                    placeholder="Hà Nội"
                    className="font-semibold text-slate-800 w-28"
                  />
                </div>

                {(patient.height || patient.weight || patient.bloodPressure || patient.pulse) && (
                  <div className="col-span-2 sm:col-span-4 bg-slate-50 p-1.5 rounded border border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
                    <span className="font-bold text-slate-700">Chỉ số sinh tồn:</span>
                    {patient.height && (
                      <span>Cao: <EditableInput value={patient.height} onChange={(v) => updatePatientField('height', v)} isEditMode={isEditMode} className="w-12 font-bold" displaySuffix=" cm" /></span>
                    )}
                    {patient.weight && (
                      <span>Nặng: <EditableInput value={patient.weight} onChange={(v) => updatePatientField('weight', v)} isEditMode={isEditMode} className="w-12 font-bold" displaySuffix=" kg" /></span>
                    )}
                    {patient.height && patient.weight && (
                      <span>
                        BMI: <strong>{(patient.weight / Math.pow(patient.height / 100, 2)).toFixed(1)}</strong>
                      </span>
                    )}
                    {patient.bloodPressure && (
                      <span>Huyết áp: <EditableInput value={patient.bloodPressure} onChange={(v) => updatePatientField('bloodPressure', v)} isEditMode={isEditMode} className="w-20 font-bold" displaySuffix=" mmHg" /></span>
                    )}
                    {patient.pulse && (
                      <span>Mạch: <EditableInput value={patient.pulse} onChange={(v) => updatePatientField('pulse', v)} isEditMode={isEditMode} className="w-12 font-bold" displaySuffix=" bpm" /></span>
                    )}
                  </div>
                )}

                {selectedTemplateId !== 'gynecology' && (
                  <>
                    {(report.pregnancyDating?.type === 'IVF' || patient.datingSource?.startsWith('IVF') || patient.eddSource?.startsWith('IVF')) ? (
                      <>
                        <div>
                          <span className="text-slate-500">Hình thức thai:</span>{' '}
                          <span className="font-semibold text-slate-800">IVF – Day <EditableInput value={patient.embryoDay || editableReport.pregnancyDating?.embryoAge || 5} onChange={(v) => updatePatientField('embryoDay', v)} isEditMode={isEditMode} className="w-8 font-bold" /> Transfer</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Ngày chuyển phôi (ET):</span>{' '}
                          <EditableInput value={patient.transferDate || editableReport.pregnancyDating?.transferDate || patient.doc} onChange={(v) => updatePatientField('transferDate', v)} isEditMode={isEditMode} placeholder="--" className="font-semibold text-slate-800 w-24" />
                        </div>
                        <div>
                          <span className="text-slate-500">Tuổi thai GA(IVF):</span>{' '}
                          <EditableInput value={patient.ga || editableReport.pregnancyDating?.ga || patient.gaClin} onChange={(v) => updatePatientField('ga', v)} isEditMode={isEditMode} placeholder="--" className="font-bold text-blue-800 w-20" />
                        </div>
                        <div>
                          <span className="text-slate-500">Dự sinh EDD(IVF):</span>{' '}
                          <EditableInput value={patient.edd || editableReport.pregnancyDating?.edd} onChange={(v) => updatePatientField('edd', v)} isEditMode={isEditMode} placeholder="--" className="font-bold text-blue-800 w-24" />
                        </div>
                        {patient.lmp && (
                          <div>
                            <span className="text-slate-500">Kỳ kinh cuối (LMP):</span>{' '}
                            <EditableInput value={patient.lmp} onChange={(v) => updatePatientField('lmp', v)} isEditMode={isEditMode} className="font-semibold text-slate-700 w-24" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-slate-500">Kỳ kinh cuối (LMP):</span>{' '}
                          <EditableInput value={patient.lmp} onChange={(v) => updatePatientField('lmp', v)} isEditMode={isEditMode} placeholder="--" className="font-semibold text-slate-800 w-24" />
                        </div>
                        <div>
                          <span className="text-slate-500">Ngày thụ thai (DOC):</span>{' '}
                          <EditableInput value={patient.doc} onChange={(v) => updatePatientField('doc', v)} isEditMode={isEditMode} placeholder="--" className="font-semibold text-slate-800 w-24" />
                        </div>
                        <div>
                          <span className="text-slate-500">Tuổi thai (GA):</span>{' '}
                          <EditableInput value={patient.ga || patient.gaClin || patient.gaAua} onChange={(v) => { updatePatientField('ga', v); updatePatientField('gaClin', v); }} isEditMode={isEditMode} placeholder="--" className="font-bold text-blue-800 w-20" />
                        </div>
                        <div>
                          <span className="text-slate-500">Dự sinh (EDD):</span>{' '}
                          <EditableInput value={patient.edd} onChange={(v) => updatePatientField('edd', v)} isEditMode={isEditMode} placeholder="--" className="font-bold text-blue-800 w-24" />
                        </div>
                      </>
                    )}
                  </>
                )}

                {selectedTemplateId === 'gynecology' && (
                  <>
                    <div>
                      <span className="text-slate-500">Chỉ định:</span>{' '}
                      <EditableInput value={patient.indication || 'Khám phụ khoa định kỳ'} onChange={(v) => updatePatientField('indication', v)} isEditMode={isEditMode} className="font-semibold text-slate-800 w-28" />
                    </div>
                    <div>
                      <span className="text-slate-500">Kinh cuối (LMP):</span>{' '}
                      <EditableInput value={patient.lmp} onChange={(v) => updatePatientField('lmp', v)} isEditMode={isEditMode} placeholder="Không rõ" className="font-semibold text-slate-800 w-24" />
                    </div>
                    <div>
                      <span className="text-slate-500">Tiền sử Para:</span>{' '}
                      <EditableInput value={patient.para || '0000'} onChange={(v) => updatePatientField('para', v)} isEditMode={isEditMode} className="font-semibold text-slate-800 w-16" />
                    </div>
                    <div>
                      <span className="text-slate-500">Phương pháp:</span>{' '}
                      <span className="font-semibold text-slate-800">Đầu dò âm đạo / Đầu dò bụng</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ================= BODY CONTENT TAILORED PER TEMPLATE ================= */}

            {currentFetalCount > 1 ? (
              <div className="space-y-4">
                {Array.from({ length: currentFetalCount }).map((_, fetusIdx) => {
                  const { list: fetusBiometryList, efw: fetusEfw } = getFetusBiometryList(fetusIdx);
                  const fetus = report.fetuses?.[fetusIdx];
                  const name = fetus?.name || (fetusIdx === 0 ? 'Thai A' : fetusIdx === 1 ? 'Thai B' : 'Thai C');
                  const fetusDoppler = fetus?.doppler || (fetusIdx === 0 ? report.doppler : {});

                  return (
                    <div key={fetusIdx} className="mb-4 border border-blue-100 rounded-lg p-3 bg-white space-y-3">
                      {/* Section Title for each Fetus */}
                      <div className="bg-blue-50/60 text-blue-900 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-between border border-blue-100">
                        <span className="flex items-center gap-1.5">
                          <Baby className="w-4 h-4 text-blue-600" />
                          <span>KẾT QUẢ KHẢO SÁT: {name.toUpperCase()} (CHỈ SỐ SINH TRẮC & DOPPLER)</span>
                        </span>
                      </div>

                      {/* Biometry list */}
                      {fetusBiometryList.length > 0 && (
                        <div>
                          <div className="overflow-hidden border border-slate-300 rounded-lg">
                            <table className="w-full border-collapse text-left text-[10px]">
                              <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                                  <th className="p-1.5 w-7 text-center">STT</th>
                                  <th className="p-1.5">Thông số sinh trắc học</th>
                                  <th className="p-1.5 text-right">Giá trị đo</th>
                                  <th className="p-1.5 text-left">Bách phân vị & Tiêu chuẩn</th>
                                  <th className="p-1.5 text-left">Đánh giá / Ghi chú</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fetusBiometryList.map((item, idx) => {
                                  const noteKey = `fetus_${fetusIdx}_${item.id}`;
                                  const defaultNote = item.referenceNote || 'Phát triển bình thường';
                                  return (
                                    <tr key={item.id} className="border-b border-slate-200">
                                      <td className="p-1.5 text-center font-mono text-slate-500 text-[9.5px]">{idx + 1}</td>
                                      <td className="p-1.5 font-semibold text-slate-900">{item.name}</td>
                                      <td className="p-1.5 text-right font-bold text-blue-900 whitespace-nowrap">
                                        <EditableInput
                                          value={item.value !== undefined && item.value !== null ? `${item.value}` : ''}
                                          onChange={(v) => handleUpdateFetusBiometryValue(fetusIdx, item.id, v)}
                                          isEditMode={isEditMode}
                                          displaySuffix={` ${item.unit}`}
                                          className="w-14 text-right font-bold text-blue-900"
                                        />
                                      </td>
                                      <td className="p-1.5 font-medium text-emerald-800">
                                        <EditableInput
                                          value={item.percentileText || '--'}
                                          onChange={(v) => handleUpdateFetusBiometryPercentile(fetusIdx, item.id, v)}
                                          isEditMode={isEditMode}
                                          className="w-28 text-emerald-800 font-medium"
                                        />
                                      </td>
                                      <td className="p-1.5 text-slate-600 text-[9.5px]">
                                        <EditableInput
                                          value={editableReport.biometryNotes?.[noteKey] !== undefined ? editableReport.biometryNotes[noteKey] : defaultNote}
                                          onChange={(v) => {
                                            updateReport((prev: UltrasoundReport) => ({
                                              ...prev,
                                              biometryNotes: {
                                                ...(prev.biometryNotes || {}),
                                                [noteKey]: v
                                              }
                                            }));
                                          }}
                                          isEditMode={isEditMode}
                                          className="w-full text-slate-700 font-medium text-[9.5px]"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                                {fetusEfw?.value && (
                                  <tr className="bg-blue-50 font-bold border-t border-blue-200">
                                    <td className="p-1.5 text-center text-blue-900">★</td>
                                    <td className="p-1.5 text-blue-950 font-bold">Cân nặng ước tính (EFW)</td>
                                    <td className="p-1.5 text-right text-blue-900 font-extrabold whitespace-nowrap">
                                      <EditableInput
                                        value={fetusEfw.value ? `${fetusEfw.value}` : ''}
                                        onChange={(v) => handleUpdateFetusEfwValue(fetusIdx, v)}
                                        isEditMode={isEditMode}
                                        displaySuffix=" g"
                                        className="w-16 text-right font-extrabold text-blue-900"
                                      />
                                    </td>
                                    <td className="p-1.5 text-blue-950 font-bold">
                                      <EditableInput
                                        value={fetusEfw.percentile || '—'}
                                        onChange={(v) => handleUpdateFetusEfwPercentile(fetusIdx, v)}
                                        isEditMode={isEditMode}
                                        className="w-28 font-bold text-blue-950"
                                      />
                                    </td>
                                    <td className="p-1.5 text-blue-950 text-[9.5px]">
                                      <EditableInput
                                        value={editableReport.biometryNotes?.[`fetus_${fetusIdx}_efw`] !== undefined ? editableReport.biometryNotes[`fetus_${fetusIdx}_efw`] : 'AGA'}
                                        onChange={(v) => {
                                          updateReport((prev: UltrasoundReport) => ({
                                            ...prev,
                                            biometryNotes: {
                                              ...(prev.biometryNotes || {}),
                                              [`fetus_${fetusIdx}_efw`]: v
                                            }
                                          }));
                                        }}
                                        isEditMode={isEditMode}
                                        className="w-full text-blue-950 font-medium text-[9.5px]"
                                      />
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Doppler, amniotic fluid and heart rate for this fetus */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed">
                        {fetusDoppler?.fhr?.value && (
                          <div>
                            <span className="font-bold text-slate-700">Tim thai (FHR):</span>{' '}
                            <span className="text-blue-900 font-bold">{fetusDoppler.fhr.value} lần/phút (Đều, rõ)</span>
                          </div>
                        )}
                        {report.amnioticFluid?.afi?.value && fetusIdx === 0 && (
                          <div>
                            <span className="font-bold text-slate-700">Chỉ số ối (AFI):</span>{' '}
                            <span className="text-blue-900 font-bold">{report.amnioticFluid.afi.value} mm</span>
                          </div>
                        )}
                        {placenta.location && fetusIdx === 0 && (
                          <div>
                            <span className="font-bold text-slate-700">Vị trí rau:</span>{' '}
                            <span className="text-slate-800 font-medium">{placenta.location} {placenta.grade ? `, ${placenta.grade}` : ''}</span>
                          </div>
                        )}
                        {fetusDoppler?.umbilicalArtery?.pi !== undefined && fetusDoppler?.umbilicalArtery?.pi !== null && (
                          <div className="col-span-1 sm:col-span-3 border-t border-slate-200 pt-1 mt-1">
                            <span className="font-bold text-blue-950">ĐM Rốn (UA):</span> PI = {fetusDoppler.umbilicalArtery.pi}
                            {fetusDoppler.umbilicalArtery.ri !== undefined && fetusDoppler.umbilicalArtery.ri !== null && `, RI = ${fetusDoppler.umbilicalArtery.ri}`}
                          </div>
                        )}
                        {fetusDoppler?.middleCerebralArtery?.pi !== undefined && fetusDoppler?.middleCerebralArtery?.pi !== null && (
                          <div className="col-span-1 sm:col-span-3">
                            <span className="font-bold text-blue-950">ĐM/Não giữa (MCA):</span> PI = {fetusDoppler.middleCerebralArtery.pi}
                            {fetusDoppler.middleCerebralArtery.ps && `, PS = ${fetusDoppler.middleCerebralArtery.ps}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isDynamicV2 ? (
              <div className="space-y-3 text-[11px]">
                {/* 1. THÔNG TIN THAI KỲ */}
                <div>
                  <h3 className="font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5 flex items-center justify-between">
                    <span>I. THÔNG TIN THAI KỲ</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 gap-x-4 bg-slate-50 border border-slate-300 rounded-lg p-2 leading-relaxed">
                    <div>
                      <span className="font-semibold text-slate-700">Số lượng thai:</span>{' '}
                      <EditableInput value={editableReport.fetalCount ? (editableReport.fetalCount === 1 ? '01' : `${editableReport.fetalCount}`) : '01'} onChange={(v) => updateReport('fetalCount', parseInt(v) || 1)} isEditMode={isEditMode} className="text-slate-900 font-bold w-12" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Cử động thai:</span>{' '}
                      <EditableInput value={editableReport.fetalMovement || 'Bình thường (+)'} onChange={(v) => updateReport('fetalMovement', v)} isEditMode={isEditMode} className="text-slate-900 font-medium w-28" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Ngôi thai:</span>{' '}
                      <EditableInput value={editableReport.fetalPresentation || 'Đầu'} onChange={(v) => updateReport('fetalPresentation', v)} isEditMode={isEditMode} className="text-slate-900 font-medium w-20" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Tần số tim thai:</span>{' '}
                      <EditableInput value={doppler.fhr.value ? `${doppler.fhr.value}` : '145'} onChange={(v) => updateDopplerValue('fhr', 'value', parseFloat(v) || v)} isEditMode={isEditMode} displaySuffix=" lần/phút (Đều, rõ)" className="text-blue-900 font-bold w-16" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">CRL:</span>{' '}
                      <EditableInput value={measurements.crl?.value ? `${measurements.crl.value}` : '—'} onChange={(v) => updateMeasurementValue('crl', parseFloat(v) || v)} isEditMode={isEditMode} displaySuffix=" mm" className="text-slate-900 font-medium w-16" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Dự kiến sinh:</span>{' '}
                      <EditableInput value={patient.edd || editableReport.pregnancyDating?.edd} onChange={(v) => updatePatientField('edd', v)} isEditMode={isEditMode} placeholder="--" className="text-blue-900 font-bold w-24" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Rau bám:</span>{' '}
                      <EditableInput value={placenta.location || 'Mặt sau tử cung'} onChange={(v) => updateReport('placenta', { ...placenta, location: v })} isEditMode={isEditMode} className="text-slate-900 font-medium w-32" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Nước ối (AFI):</span>{' '}
                      <EditableInput value={amnioticFluid.afi?.value ? `${amnioticFluid.afi.value}` : (amnioticFluid.status || 'Bình thường')} onChange={(v) => updateReport('amnioticFluid', { ...amnioticFluid, status: v, afi: { value: parseFloat(v) || v, unit: 'mm' } })} isEditMode={isEditMode} className="text-blue-900 font-bold w-24" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Cổ tử cung:</span>{' '}
                      <EditableInput value={editableReport.cervicalLength?.length ? `${editableReport.cervicalLength.length}` : measurements.cervixLength?.value ? `${measurements.cervixLength.value}` : 'Đóng kín, bình thường'} onChange={(v) => updateMeasurementValue('cervixLength', parseFloat(v) || v)} isEditMode={isEditMode} className="text-slate-900 font-medium w-36" />
                    </div>
                  </div>
                </div>

                {/* 2. SINH TRẮC HỌC THAI */}
                <div>
                  <h3 className="font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5 flex items-center justify-between">
                    <span>II. SINH TRẮC HỌC THAI</span>
                    <span className="text-[9.5px] font-normal text-slate-500 lowercase">
                      (chuẩn Hadlock / INTERGROWTH-21st)
                    </span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">BPD:</span> <EditableInput value={measurements.bpd?.value} onChange={(v) => handleUpdateBiometryValue('bpd', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                      {measurements.bpd?.gaAge && <span className="text-[9.5px] text-slate-500 ml-1">({measurements.bpd.gaAge})</span>}
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">HC:</span> <EditableInput value={measurements.hc?.value} onChange={(v) => handleUpdateBiometryValue('hc', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                      {measurements.hc?.gaAge && <span className="text-[9.5px] text-slate-500 ml-1">({measurements.hc.gaAge})</span>}
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">AC:</span> <EditableInput value={measurements.ac?.value} onChange={(v) => handleUpdateBiometryValue('ac', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                      {measurements.ac?.gaAge && <span className="text-[9.5px] text-slate-500 ml-1">({measurements.ac.gaAge})</span>}
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">FL:</span> <EditableInput value={measurements.fl?.value} onChange={(v) => handleUpdateBiometryValue('fl', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                      {measurements.fl?.gaAge && <span className="text-[9.5px] text-slate-500 ml-1">({measurements.fl.gaAge})</span>}
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">HL:</span> <EditableInput value={measurements.hl?.value} onChange={(v) => handleUpdateBiometryValue('hl', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                      {measurements.hl?.gaAge && <span className="text-[9.5px] text-slate-500 ml-1">({measurements.hl.gaAge})</span>}
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">Foot:</span> <EditableInput value={measurements.foot?.value} onChange={(v) => handleUpdateBiometryValue('foot', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">BOD:</span> <EditableInput value={measurements.bod?.value} onChange={(v) => handleUpdateBiometryValue('bod', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">NBL:</span> <EditableInput value={measurements.nbl?.value} onChange={(v) => handleUpdateBiometryValue('nbl', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">Vp:</span> <EditableInput value={measurements.vp?.value} onChange={(v) => handleUpdateBiometryValue('vp', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">Cereb:</span> <EditableInput value={measurements.tcd?.value} onChange={(v) => handleUpdateBiometryValue('tcd', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">CM:</span> <EditableInput value={measurements.cm?.value} onChange={(v) => handleUpdateBiometryValue('cm', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5">
                      <span className="text-slate-600 font-semibold">NT:</span> <EditableInput value={measurements.nt?.value} onChange={(v) => handleUpdateBiometryValue('nt', v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" mm" className="text-blue-900 font-bold w-12" />
                    </div>
                  </div>

                  {/* EFW Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-blue-50/80 border border-blue-200 rounded-lg p-2">
                    <div>
                      <span className="font-semibold text-blue-950">Cân nặng ước tính (EFW):</span>{' '}
                      <EditableInput value={efw.value} onChange={(v) => handleUpdateEfwValue(v)} isEditMode={isEditMode} placeholder="—" displaySuffix=" g (±10%)" className="text-blue-900 font-bold text-xs w-16" />
                    </div>
                    <div>
                      <span className="font-semibold text-blue-950">Bách phân vị EFW:</span>{' '}
                      <EditableInput value={efw.percentile} onChange={(v) => handleUpdateEfwPercentile(v)} isEditMode={isEditMode} placeholder="—" className="text-emerald-800 font-bold text-xs w-28" />
                    </div>
                    <div>
                      <span className="font-semibold text-blue-950">Tuổi thai theo SA (GA_US):</span>{' '}
                      <EditableInput value={efw.gaAge || patient.gaAua || patient.gaClin} onChange={(v) => updateReport('efw', { ...efw, gaAge: v })} isEditMode={isEditMode} placeholder="—" className="text-blue-900 font-bold text-xs w-20" />
                    </div>
                  </div>
                </div>

                {/* 3. KHẢO SÁT HÌNH THÁI THAI */}
                <div>
                  <h3 className="font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5">
                    III. KHẢO SÁT HÌNH THÁI THAI
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] bg-slate-50 border border-slate-300 rounded-lg p-2">
                    <div><span className="font-semibold text-slate-800">• Cấu trúc đường giữa:</span> <EditableInput value={editableReport.morphologyV2?.duong_giua || 'Cân đối, liên tục'} onChange={(v) => updateMorphologyV2Field('duong_giua', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Tim 4 buồng:</span> <EditableInput value={editableReport.morphologyV2?.tim_4_buong || 'Cân đối, 4 buồng rõ'} onChange={(v) => updateMorphologyV2Field('tim_4_buong', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Vách trong suốt:</span> <EditableInput value={editableReport.morphologyV2?.vach_trong_suot || 'Hiện diện (+)'} onChange={(v) => updateMorphologyV2Field('vach_trong_suot', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Vách liên thất:</span> <EditableInput value={editableReport.morphologyV2?.vach_lien_that || 'Kín, không khuyết tật'} onChange={(v) => updateMorphologyV2Field('vach_lien_that', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Lồng ngực, cột sống:</span> <EditableInput value={editableReport.morphologyV2?.long_nguc_cot_song || 'Cân đối, liên tục'} onChange={(v) => updateMorphologyV2Field('long_nguc_cot_song', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Xuất phát mạch máu lớn:</span> <EditableInput value={editableReport.morphologyV2?.mach_mau_lon || 'Bình thường'} onChange={(v) => updateMorphologyV2Field('mach_mau_lon', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Phổi hai bên:</span> <EditableInput value={editableReport.morphologyV2?.phoi || 'Nhu mô đều, không tràn dịch'} onChange={(v) => updateMorphologyV2Field('phoi', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Mặt cắt 3 mạch máu (3VV):</span> <EditableInput value={editableReport.morphologyV2?.threeVV || '3VV & khí quản bình thường'} onChange={(v) => updateMorphologyV2Field('threeVV', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Thành bụng trước:</span> <EditableInput value={editableReport.morphologyV2?.thanh_bung_truoc || 'Kín, không thoát vị'} onChange={(v) => updateMorphologyV2Field('thanh_bung_truoc', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Dạ dày:</span> <EditableInput value={editableReport.morphologyV2?.da_day || 'Dưới vòm hoành trái (+)'} onChange={(v) => updateMorphologyV2Field('da_day', v)} isEditMode={isEditMode} className="text-slate-900 w-28" /> | <span className="font-semibold text-slate-800">Thận:</span> <EditableInput value={editableReport.morphologyV2?.than || 'Hai bên vị trí bình thường'} onChange={(v) => updateMorphologyV2Field('than', v)} isEditMode={isEditMode} className="text-slate-900 w-28" /></div>
                    <div><span className="font-semibold text-slate-800">• Khoảng cách hốc mắt (BOD):</span> <EditableInput value={editableReport.morphologyV2?.bod !== undefined ? editableReport.morphologyV2.bod : (measurements.bod?.value ? `${measurements.bod.value} mm (Cân đối)` : 'Cân đối')} onChange={(v) => updateMorphologyV2Field('bod', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Bàng quang:</span> <EditableInput value={editableReport.morphologyV2?.bang_quang || 'Hiện diện trong tiểu khung (+)'} onChange={(v) => updateMorphologyV2Field('bang_quang', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Xương sống mũi (NBL):</span> <EditableInput value={editableReport.morphologyV2?.nbl !== undefined ? editableReport.morphologyV2.nbl : (measurements.nbl?.value ? `${measurements.nbl.value} mm (Hiện diện +)` : 'Hiện diện (+)')} onChange={(v) => updateMorphologyV2Field('nbl', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div><span className="font-semibold text-slate-800">• Dây rốn:</span> <EditableInput value={editableReport.morphologyV2?.day_ron || '3 mạch máu (2 ĐM, 1 TM)'} onChange={(v) => updateMorphologyV2Field('day_ron', v)} isEditMode={isEditMode} className="text-slate-900 w-36" /></div>
                    <div className="col-span-1 sm:col-span-2"><span className="font-semibold text-slate-800">• Các chi:</span> <EditableInput value={editableReport.morphologyV2?.cac_chi || 'Đủ 4 chi, mỗi chi 3 đoạn, bàn tay bàn chân bình thường'} onChange={(v) => updateMorphologyV2Field('cac_chi', v)} isEditMode={isEditMode} className="text-slate-900 w-full" /></div>
                  </div>
                </div>

                {/* 4. DOPPLER & THÔNG SỐ BỔ SUNG */}
                {!report.hideDoppler && (
                  <div>
                    <h3 className="font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5 flex items-center justify-between">
                      <span>IV. KHẢO SÁT DOPPLER & HUYẾT ĐỘNG THAI</span>
                      <span className="text-[9.5px] font-normal text-slate-500 lowercase">
                        (chỉ số trở kháng & xung mạch)
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-4 gap-y-1.5 bg-slate-50 border border-slate-300 rounded-lg p-2 text-[10.5px]">
                      <div>
                        <span className="font-semibold text-slate-800">ĐM rốn (UA) - PI:</span>{' '}
                        <EditableInput value={doppler.umbilicalArtery?.pi !== undefined && doppler.umbilicalArtery?.pi !== null ? doppler.umbilicalArtery.pi : ''} onChange={(v) => updateDopplerValue('umbilicalArtery', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="text-blue-900 font-bold w-12" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">ĐM não giữa (MCA) - PI:</span>{' '}
                        <EditableInput value={doppler.middleCerebralArtery?.pi !== undefined && doppler.middleCerebralArtery?.pi !== null ? doppler.middleCerebralArtery.pi : ''} onChange={(v) => updateDopplerValue('middleCerebralArtery', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="text-blue-900 font-bold w-12" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">ĐM tử cung trái (UtA-L) - PI:</span>{' '}
                        <EditableInput value={doppler.leftUterine?.pi !== undefined && doppler.leftUterine?.pi !== null ? doppler.leftUterine.pi : ''} onChange={(v) => updateDopplerValue('leftUterine', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="text-blue-900 font-bold w-12" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">ĐM tử cung phải (UtA-R) - PI:</span>{' '}
                        <EditableInput value={doppler.rightUterine?.pi !== undefined && doppler.rightUterine?.pi !== null ? doppler.rightUterine.pi : ''} onChange={(v) => updateDopplerValue('rightUterine', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="text-blue-900 font-bold w-12" />
                      </div>

                      {/* Ductus Venosus (Ống tĩnh mạch) & CPR */}
                      {(doppler.ductusVenosus?.pi || doppler.cpr?.value) && (
                        <>
                          {doppler.ductusVenosus?.pi !== undefined && doppler.ductusVenosus?.pi !== null && (
                            <div>
                              <span className="font-semibold text-slate-800">Ống tĩnh mạch (DV) - PI:</span>{' '}
                              <EditableInput value={doppler.ductusVenosus.pi} onChange={(v) => updateDopplerValue('ductusVenosus', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="text-blue-900 font-bold w-12" />
                            </div>
                          )}
                          {(doppler.cpr?.value || (doppler.middleCerebralArtery?.pi && doppler.umbilicalArtery?.pi)) && (
                            <div>
                              <span className="font-semibold text-slate-800">Tỉ số não - rốn (CPR):</span>{' '}
                              <span className="text-blue-900 font-bold">
                                {doppler.cpr?.value ?? (doppler.middleCerebralArtery?.pi && doppler.umbilicalArtery?.pi ? (doppler.middleCerebralArtery.pi / doppler.umbilicalArtery.pi).toFixed(2) : '--')}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* DOPPLER CALCULATIONS (Phase 4): distinct from the raw vessel PI above.
                        Reads from the canonical doppler.calculations group only — never mixed
                        with the raw Doppler measurements block. Renders nothing if empty. */}
                    {dopplerCalcRows.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[10px] font-bold text-slate-700 uppercase mb-1">Doppler Calculations</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-[10.5px]">
                          {dopplerCalcRows.map((row) => (
                            <div key={row.key}>
                              <span className="font-semibold text-slate-800">{row.label}:</span>{' '}
                              <span className="text-blue-900 font-bold">{row.value}</span>
                              {row.extra && <span className="text-slate-500"> ({row.extra})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. KẾT LUẬN */}
                <div className="border-2 border-blue-800 rounded-lg p-2.5 bg-blue-50/50">
                  <div className="text-[11px] font-black text-blue-900 uppercase tracking-wide mb-1 flex items-center justify-between">
                    <span>V. KẾT LUẬN:</span>
                    <span className="text-[9px] font-normal text-slate-500 font-mono">BS. CAO BÁ SƠN</span>
                  </div>
                  <div className="text-slate-900 space-y-1 leading-relaxed">
                    <div className="font-bold flex items-start gap-1">
                      <span className="shrink-0">•</span>
                      <EditableTextarea
                        value={conclusion || (
                          editableReport.conclusionV2?.ket_luan_1 
                            ? editableReport.conclusionV2.ket_luan_1
                                .replace('{GA}', patient.ga || patient.gaClin || patient.gaAua || 'tuổi thai')
                                .replace('{PERCENTILE}', efw.percentile || '50% (bình thường)')
                                .replace('{EFW}', efw.value ? `${efw.value}` : '500')
                            : `Trong buồng tử cung có 01 thai phát triển tương đương ${patient.ga || patient.gaClin || patient.gaAua || 'tuổi thai'}, cân nặng ước tính EFW = ${efw.value || '500'}g (ở bách phân vị ${efw.percentile || '50%'}).`
                        )}
                        onChange={(v) => {
                          updateReport('conclusion', v);
                          if (editableReport.conclusionV2) {
                            updateReport('conclusionV2', { ...editableReport.conclusionV2, ket_luan_1: v });
                          }
                        }}
                        isEditMode={isEditMode}
                        className="font-bold w-full text-slate-900"
                      />
                    </div>
                    <div className="font-medium text-slate-800 flex items-start gap-1">
                      <span className="shrink-0">•</span>
                      <EditableTextarea
                        value={editableReport.conclusionV2?.ket_luan_2 || 'Hiện tại không thấy bất thường về hình thái thai trên siêu âm.'}
                        onChange={(v) => {
                          if (editableReport.conclusionV2) {
                            updateReport('conclusionV2', { ...editableReport.conclusionV2, ket_luan_2: v });
                          } else {
                            updateReport('conclusionV2', { ket_luan_1: conclusion || '', ket_luan_2: v });
                          }
                        }}
                        isEditMode={isEditMode}
                        className="font-medium text-slate-800 w-full"
                      />
                    </div>
                    {editableReport.conclusionV2?.ket_luan_3 && (
                      <div className="text-slate-700 flex items-start gap-1">
                        <span className="shrink-0">• Bất thường / nhận xét đặc biệt:</span>
                        <EditableTextarea
                          value={editableReport.conclusionV2.ket_luan_3}
                          onChange={(v) => {
                            if (editableReport.conclusionV2) {
                              updateReport('conclusionV2', { ...editableReport.conclusionV2, ket_luan_3: v });
                            }
                          }}
                          isEditMode={isEditMode}
                          className="text-slate-700 w-full"
                        />
                      </div>
                    )}
                    <div className="pt-1 mt-1 border-t border-blue-200/80 flex flex-wrap items-center justify-between text-[10.5px] font-semibold text-blue-950">
                      <div>
                        <span>Dự kiến sinh:</span> <EditableInput value={patient.edd || editableReport.pregnancyDating?.edd} onChange={(v) => updatePatientField('edd', v)} isEditMode={isEditMode} placeholder="--" className="text-blue-900 font-bold w-24" />
                        {(editableReport.pregnancyDating?.type === 'IVF' || patient.datingSource?.startsWith('IVF') || patient.eddSource?.startsWith('IVF')) && (
                          <span className="text-slate-600 font-normal ml-1">
                            (Theo IVF Ngày {patient.embryoDay || 5} - Chuyển phôi {patient.transferDate || editableReport.pregnancyDating?.transferDate || patient.doc})
                          </span>
                        )}
                      </div>
                      <div>
                        <span>Hẹn khám lại sau:</span> <EditableInput value={editableReport.conclusionV2?.hen_kham_lai || '4'} onChange={(v) => {
                          if (editableReport.conclusionV2) {
                            updateReport('conclusionV2', { ...editableReport.conclusionV2, hen_kham_lai: v });
                          } else {
                            updateReport('conclusionV2', { ket_luan_1: conclusion || '', hen_kham_lai: v });
                          }
                        }} isEditMode={isEditMode} className="text-blue-900 font-bold w-8 text-center" displaySuffix=" tuần" />. (Nếu đau bụng, ra dịch/máu bất thường khám lại ngay).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* A. BIOMETRIC MEASUREMENTS TABLE (For all Obstetric templates when measurements exist) */}
            {!isGynecology && activeBiometryList.length > 0 && (
              <div className="mb-3">
                <h3 className="text-[11px] font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5 flex items-center justify-between">
                  <span>I. CÁC CHỈ SỐ SINH TRẮC HỌC THAI NHI (BIOMETRY 2D & HADLOCK)</span>
                  <span className="text-[9px] font-normal text-slate-500 lowercase">
                    (bách phân vị theo INTERGROWTH-21st / Hadlock / FMF / Robinson)
                  </span>
                </h3>

                <div className="overflow-hidden border border-slate-300 rounded-lg">
                  <table className="w-full border-collapse text-left text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-1.5 w-7 text-center">STT</th>
                        <th className="p-1.5">Thông số sinh trắc học</th>
                        <th className="p-1.5 text-right">Giá trị đo</th>
                        <th className="p-1.5 text-left">Bách phân vị & Tiêu chuẩn</th>
                        <th className="p-1.5 text-left">Đánh giá / Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBiometryList.map((item, idx) => {
                        const defaultNote = item.referenceNote || 'Phát triển bình thường';
                        return (
                          <tr
                            key={item.id}
                            className={`border-b border-slate-200 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                            }`}
                          >
                            <td className="p-1.5 text-center font-mono text-slate-500 text-[10px]">{idx + 1}</td>
                            <td className="p-1.5 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="p-1.5 text-right font-bold text-blue-900 whitespace-nowrap">
                              <EditableInput
                                value={item.value !== undefined && item.value !== null ? `${item.value}` : ''}
                                onChange={(v) => handleUpdateBiometryValue(item.id as keyof Measurements2D, v)}
                                isEditMode={isEditMode}
                                displaySuffix={` ${item.unit}`}
                                className="w-16 text-right font-bold text-blue-900 text-xs"
                              />
                            </td>
                            <td className="p-1.5 font-medium text-emerald-800">
                              <EditableInput
                                value={item.percentileText || '--'}
                                onChange={(v) => handleUpdateBiometryPercentile(item.id as keyof Measurements2D, v)}
                                isEditMode={isEditMode}
                                className="w-32 text-emerald-800 font-medium text-xs"
                              />
                            </td>
                            <td className="p-1.5 text-slate-600 text-[10px]">
                              <EditableInput
                                value={editableReport.biometryNotes?.[item.id] !== undefined ? editableReport.biometryNotes[item.id] : defaultNote}
                                onChange={(v) => {
                                  updateReport((prev: UltrasoundReport) => ({
                                    ...prev,
                                    biometryNotes: {
                                      ...(prev.biometryNotes || {}),
                                      [item.id]: v
                                    }
                                  }));
                                }}
                                isEditMode={isEditMode}
                                className="w-full text-slate-700 font-medium text-[10px]"
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {/* EFW ROW HIGHLIGHT */}
                      {efw.value && (
                        <tr className="bg-blue-50/90 font-bold border-t-2 border-blue-300">
                          <td className="p-1.5 text-center text-blue-900">★</td>
                          <td className="p-1.5 text-blue-950 font-bold">
                            Ước tính cân nặng thai nhi (EFW)
                          </td>
                          <td className="p-1.5 text-right text-blue-900 font-extrabold whitespace-nowrap">
                            <EditableInput
                              value={efw.value ? `${efw.value}` : ''}
                              onChange={(v) => handleUpdateEfwValue(v)}
                              isEditMode={isEditMode}
                              displaySuffix={` g (${efw.range ? (efw.range.includes('±') ? efw.range : `± ${efw.range}`) : '± 15%'})`}
                              className="w-16 text-right font-extrabold text-blue-900 text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-blue-900 font-bold">
                            <EditableInput
                              value={efw.percentile ? (efw.percentile.includes('theo') ? efw.percentile : `${efw.percentile} theo ${efw.method || 'Hadlock 3'}`) : '—'}
                              onChange={(v) => handleUpdateEfwPercentile(v)}
                              isEditMode={isEditMode}
                              className="w-32 font-bold text-blue-900 text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-blue-950 text-[10px]">
                            <EditableInput
                              value={editableReport.biometryNotes?.efw !== undefined ? editableReport.biometryNotes.efw : (efw.formula ? `Công thức: ${efw.formula}` : `Tiêu chuẩn: ${efw.method || 'Hadlock 3'}`)}
                              onChange={(v) => {
                                updateReport((prev: UltrasoundReport) => ({
                                  ...prev,
                                  biometryNotes: {
                                    ...(prev.biometryNotes || {}),
                                    efw: v
                                  }
                                }));
                              }}
                              isEditMode={isEditMode}
                              className="w-full text-blue-950 font-medium text-[10px]"
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* === TEMPLATE 1 & 4: Morphology 14-32w & Growth/Doppler >32w === */}
            {(isMorphology || isGrowthDoppler) && (
              <>
                {/* 4. Doppler, Amniotic & Placenta */}
                <div className="mb-3 text-[11px]">
                  <h3 className="font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5">
                    II. KHẢO SÁT TIM THAI, NƯỚC ỐI, BÁNH RAU & DOPPLER
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 border border-slate-300 rounded-lg p-2">
                    <div>
                      <span className="font-bold text-slate-800">Tim thai (FHR):</span>{' '}
                      <EditableInput
                        value={doppler.fhr.value}
                        onChange={(v) => updateDopplerValue('fhr', 'value', parseFloat(v) || v)}
                        isEditMode={isEditMode}
                        placeholder="145"
                        displaySuffix=" lần/phút (Đều, rõ)"
                        className="text-blue-900 font-bold w-12"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800">Chỉ số ối (AFI):</span>{' '}
                      <EditableInput
                        value={amnioticFluid.afi.value}
                        onChange={(v) => updateAmnioticFluidField('afi', { ...amnioticFluid.afi, value: parseFloat(v) || v })}
                        isEditMode={isEditMode}
                        placeholder="150"
                        displaySuffix=" mm"
                        className="text-blue-900 font-bold w-12"
                      />{' '}
                      (<EditableInput
                        value={amnioticFluid.status || 'Bình thường'}
                        onChange={(v) => updateAmnioticFluidField('status', v)}
                        isEditMode={isEditMode}
                        className="text-blue-900 font-bold w-20"
                      />)
                    </div>
                    <div>
                      <span className="font-bold text-slate-800">Bánh rau:</span>{' '}
                      <EditableInput
                        value={placenta.location || 'Mặt sau tử cung'}
                        onChange={(v) => updatePlacentaField('location', v)}
                        isEditMode={isEditMode}
                        className="text-slate-800 font-medium w-28"
                      />, <EditableInput
                        value={placenta.grade || 'Độ I'}
                        onChange={(v) => updatePlacentaField('grade', v)}
                        isEditMode={isEditMode}
                        className="text-slate-800 font-medium w-16"
                      />
                    </div>
                  </div>

                  {/* Cervical Length info inside Morphology / Growth template */}
                  {(report.cervicalLength?.length || report.cervicalLength?.patientRefused || isEditMode) && (
                    <div className="mt-2 bg-slate-50 border border-slate-300 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] leading-relaxed gap-2">
                      <div>
                        <span className="font-bold text-slate-700">Cổ tử cung (Cervix):</span>{' '}
                        {report.cervicalLength?.patientRefused ? (
                          <span className="text-rose-700 font-bold">Bệnh nhân từ chối thực hiện siêu âm qua đầu dò âm đạo</span>
                        ) : (
                          <span className="text-slate-900 font-medium">
                            Chiều dài cổ tử cung:{' '}
                            <EditableInput
                              value={report.cervicalLength?.length || measurements.cervixLength?.value}
                              onChange={(v) => {
                                updateReport(prev => ({
                                  ...prev,
                                  cervicalLength: { ...(prev.cervicalLength || {}), length: parseFloat(v) || v }
                                }));
                              }}
                              isEditMode={isEditMode}
                              placeholder="38"
                              displaySuffix=" mm"
                              className="text-blue-900 font-bold w-12"
                            />
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 italic">
                        <EditableInput
                          value={report.cervicalLength?.notes || 'Đóng kín hoàn toàn'}
                          onChange={(v) => {
                            updateReport(prev => ({
                              ...prev,
                              cervicalLength: { ...(prev.cervicalLength || {}), notes: v }
                            }));
                          }}
                          isEditMode={isEditMode}
                          className="w-48 text-slate-600"
                        />
                      </div>
                    </div>
                  )}

                  {/* Doppler Details if Growth/Doppler */}
                  {isGrowthDoppler && (
                    <div className="grid grid-cols-2 gap-2 mt-2 bg-blue-50/50 border border-blue-200 rounded-lg p-2 text-[10.5px]">
                      <div>
                        <span className="font-bold text-blue-950">ĐM Rốn (UA):</span> PI = <EditableInput value={doppler.umbilicalArtery.pi || '0.86'} onChange={(v) => updateDopplerValue('umbilicalArtery', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />, RI = <EditableInput value={doppler.umbilicalArtery.ri || '0.58'} onChange={(v) => updateDopplerValue('umbilicalArtery', 'ri', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />, S/D = <EditableInput value={doppler.umbilicalArtery.sd || '2.38'} onChange={(v) => updateDopplerValue('umbilicalArtery', 'sd', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />
                      </div>
                      <div>
                        <span className="font-bold text-blue-950">ĐM Não Giữa (MCA):</span> PSV = <EditableInput value={doppler.middleCerebralArtery.psv || '51.2'} onChange={(v) => updateDopplerValue('middleCerebralArtery', 'psv', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" /> cm/s (MoM = <EditableInput value={doppler.middleCerebralArtery.mom || '1.05'} onChange={(v) => updateDopplerValue('middleCerebralArtery', 'mom', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />), PI = <EditableInput value={doppler.middleCerebralArtery.pi || '1.48'} onChange={(v) => updateDopplerValue('middleCerebralArtery', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Morphology Anatomy Checklist */}
                <div className="mb-3 text-[11px]">
                  <h3 className="font-bold text-blue-900 uppercase border-b border-blue-200 pb-0.5 mb-1.5">
                    III. KHẢO SÁT HÌNH THÁI HỌC CÁC CƠ QUAN THAI NHI
                  </h3>

                  <div className="space-y-1 text-slate-700 text-[10.5px]">
                    <div>
                      <span className="font-semibold text-slate-900">• Sọ não & Mặt:</span>{' '}
                      <EditableInput value={anatomy.skullBrain} onChange={(v) => updateAnatomyField('skullBrain', v)} isEditMode={isEditMode} className="w-64" /> - <EditableInput value={anatomy.faceEyesNose} onChange={(v) => updateAnatomyField('faceEyesNose', v)} isEditMode={isEditMode} className="w-64" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">• Tim & Lồng ngực:</span>{' '}
                      <EditableInput value={anatomy.chestHeart} onChange={(v) => updateAnatomyField('chestHeart', v)} isEditMode={isEditMode} className="w-[80%]" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">• Ổ bụng & Cột sống:</span>{' '}
                      <EditableInput value={anatomy.abdomenStomachBladder} onChange={(v) => updateAnatomyField('abdomenStomachBladder', v)} isEditMode={isEditMode} className="w-64" /> - <EditableInput value={anatomy.spine} onChange={(v) => updateAnatomyField('spine', v)} isEditMode={isEditMode} className="w-64" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">• Tứ chi:</span>{' '}
                      <EditableInput value={anatomy.limbs} onChange={(v) => updateAnatomyField('limbs', v)} isEditMode={isEditMode} className="w-[80%]" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* === TEMPLATE 2: 1st Trimester NT & Screening === */}
            {is1stTrimester && (
              <>
                <div className="mb-3">
                  <h3 className="text-[11px] font-bold text-emerald-900 uppercase border-b border-emerald-300 pb-0.5 mb-1.5">
                    II. SÀNG LỌC ĐỘ MỜ DA GÁY (NT) & DẤU HIỆU LỆCH BỘI SỚM
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-emerald-950 font-semibold mb-1">Độ Mờ Da Gáy (Nuchal Translucency):</div>
                      <div className="text-base font-black text-emerald-900 flex items-baseline gap-1">
                        <EditableInput value={measurements.nt.value} onChange={(v) => updateMeasurementValue('nt', parseFloat(v) || v)} isEditMode={isEditMode} placeholder="1.4" displaySuffix=" mm" className="text-emerald-900 font-extrabold text-base w-16" />
                        <span className="text-[10px] text-emerald-700 font-normal ml-2">
                          (Ngưỡng an toàn &lt; 2.5mm)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1">
                        CRL tương ứng: <EditableInput value={measurements.crl.value} onChange={(v) => updateMeasurementValue('crl', parseFloat(v) || v)} isEditMode={isEditMode} placeholder="62" displaySuffix=" mm" className="font-bold text-slate-900 w-12" /> ({measurements.crl.gaAge || patient.gaClin || '--'})
                      </div>
                    </div>

                    <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-blue-950 font-semibold mb-1">Xương Mũi & Tim Thai:</div>
                      <div className="text-xs font-bold text-blue-900">
                        Xương mũi (NBL): <EditableInput value={measurements.nbl.value || '1.8'} onChange={(v) => updateMeasurementValue('nbl', parseFloat(v) || v)} isEditMode={isEditMode} displaySuffix=" mm (Hiện diện +)" className="w-28 text-blue-900 font-bold" />
                      </div>
                      <div className="text-xs font-bold text-blue-900 mt-1">
                        Tim thai (FHR): <EditableInput value={doppler.fhr.value || '158'} onChange={(v) => updateDopplerValue('fhr', 'value', parseFloat(v) || v)} isEditMode={isEditMode} displaySuffix=" lần/phút (Đều, rõ)" className="w-28 text-blue-900 font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Doppler Uterine Arteries */}
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-[10.5px]">
                    <div className="font-bold text-slate-900 mb-1">Doppler Động Mạch Tử Cung (Tầm soát Tiền sản giật sớm):</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-semibold">ĐM Tử Cung Trái:</span> PI = <EditableInput value={doppler.leftUterine.pi || '0.84'} onChange={(v) => updateDopplerValue('leftUterine', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />, RI = <EditableInput value={doppler.leftUterine.ri || '0.52'} onChange={(v) => updateDopplerValue('leftUterine', 'ri', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />
                      </div>
                      <div>
                        <span className="font-semibold">ĐM Tử Cung Phải:</span> PI = <EditableInput value={doppler.rightUterine.pi || '0.83'} onChange={(v) => updateDopplerValue('rightUterine', 'pi', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />, RI = <EditableInput value={doppler.rightUterine.ri || '0.50'} onChange={(v) => updateDopplerValue('rightUterine', 'ri', parseFloat(v) || v)} isEditMode={isEditMode} className="w-10 font-bold text-blue-900" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-3 text-[11px]">
                  <h3 className="font-bold text-emerald-900 uppercase border-b border-emerald-300 pb-0.5 mb-1.5">
                    III. KHẢO SÁT HÌNH THÁI SỚM QUÝ 1
                  </h3>
                  <div className="space-y-1 text-[10.5px] text-slate-700">
                    <div><span className="font-bold">• Sọ não & Mặt:</span> <EditableInput value={anatomy.skullBrain} onChange={(v) => updateAnatomyField('skullBrain', v)} isEditMode={isEditMode} className="w-[75%]" /></div>
                    <div><span className="font-bold">• Lồng ngực & Tim:</span> <EditableInput value={anatomy.chestHeart} onChange={(v) => updateAnatomyField('chestHeart', v)} isEditMode={isEditMode} className="w-[75%]" /></div>
                    <div><span className="font-bold">• Ổ bụng & Tứ chi:</span> <EditableInput value={anatomy.limbs} onChange={(v) => updateAnatomyField('limbs', v)} isEditMode={isEditMode} className="w-[75%]" /></div>
                  </div>
                </div>
              </>
            )}

            {/* === TEMPLATE 3: Early Pregnancy < 12w === */}
            {isEarlyPregnancy && (
              <>
                <div className="mb-3">
                  <h3 className="text-[11px] font-bold text-amber-900 uppercase border-b border-amber-300 pb-0.5 mb-1.5">
                    II. KHẢO SÁT TÚI THAI, PHÔI THAI & TÌNH TRẠNG BÓC TÁCH
                  </h3>

                  <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50 w-1/3">Vị trí làm tổ</td>
                        <td className="border border-slate-300 p-1.5 font-bold text-slate-900">
                          <EditableInput value={anatomy.skullBrain || 'Trong buồng tử cung (Vị trí bình thường)'} onChange={(v) => updateAnatomyField('skullBrain', v)} isEditMode={isEditMode} className="w-full text-slate-900 font-bold" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Tình trạng bóc tách màng nuôi</td>
                        <td className="border border-slate-300 p-1.5 text-emerald-800 font-bold">
                          <EditableInput value={anatomy.faceEyesNose || 'Chưa thấy hình ảnh bóc tách màng nuôi quanh túi thai (0%)'} onChange={(v) => updateAnatomyField('faceEyesNose', v)} isEditMode={isEditMode} className="w-full text-emerald-800 font-bold" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Tử cung & Phần phụ</td>
                        <td className="border border-slate-300 p-1.5 text-slate-800">
                          <EditableInput value={anatomy.chestHeart || 'Cơ tử cung đồng nhất, hai buồng trứng bình thường, cùng đồ không có dịch tự do'} onChange={(v) => updateAnatomyField('chestHeart', v)} isEditMode={isEditMode} className="w-full text-slate-800" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* === TEMPLATE 5: Amniotic Fluid AFI & Cervical Length === */}
            {isAmnioticCervix && (
              <>
                <div className="mb-3">
                  <h3 className="text-[11px] font-bold text-blue-900 uppercase border-b border-blue-300 pb-0.5 mb-1.5">
                    II. ĐÁNH GIÁ CHI TIẾT 4 KHOANG ỐI (AFI) & KÊNH CỔ TỬ CUNG
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                      <div className="text-[10px] text-slate-600">Góc 1 (Q1)</div>
                      <div className="text-sm font-bold text-blue-900">
                        <EditableInput value={amnioticFluid.q1?.value || '41.7'} onChange={(v) => updateReport(prev => ({ ...prev, amnioticFluid: { ...prev.amnioticFluid, q1: { ...prev.amnioticFluid.q1, value: parseFloat(v) || v } } }))} isEditMode={isEditMode} displaySuffix=" mm" className="font-bold text-blue-900 w-16 text-center" />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                      <div className="text-[10px] text-slate-600">Góc 2 (Q2)</div>
                      <div className="text-sm font-bold text-blue-900">
                        <EditableInput value={amnioticFluid.q2?.value || '45.0'} onChange={(v) => updateReport(prev => ({ ...prev, amnioticFluid: { ...prev.amnioticFluid, q2: { ...prev.amnioticFluid.q2, value: parseFloat(v) || v } } }))} isEditMode={isEditMode} displaySuffix=" mm" className="font-bold text-blue-900 w-16 text-center" />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                      <div className="text-[10px] text-slate-600">Góc 3 (Q3)</div>
                      <div className="text-sm font-bold text-blue-900">
                        <EditableInput value={amnioticFluid.q3?.value || '39.8'} onChange={(v) => updateReport(prev => ({ ...prev, amnioticFluid: { ...prev.amnioticFluid, q3: { ...prev.amnioticFluid.q3, value: parseFloat(v) || v } } }))} isEditMode={isEditMode} displaySuffix=" mm" className="font-bold text-blue-900 w-16 text-center" />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                      <div className="text-[10px] text-slate-600">Góc 4 (Q4)</div>
                      <div className="text-sm font-bold text-blue-900">
                        <EditableInput value={amnioticFluid.q4?.value || '37.3'} onChange={(v) => updateReport(prev => ({ ...prev, amnioticFluid: { ...prev.amnioticFluid, q4: { ...prev.amnioticFluid.q4, value: parseFloat(v) || v } } }))} isEditMode={isEditMode} displaySuffix=" mm" className="font-bold text-blue-900 w-16 text-center" />
                      </div>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50 w-1/3">Tổng chỉ số ối (AFI)</td>
                        <td className="border border-slate-300 p-1.5 font-bold text-blue-900">
                          <EditableInput value={amnioticFluid.afi.value || '163.8'} onChange={(v) => updateAmnioticFluidField('afi', { ...amnioticFluid.afi, value: parseFloat(v) || v })} isEditMode={isEditMode} displaySuffix=" mm" className="font-bold text-blue-900 w-16" /> (<EditableInput value={amnioticFluid.status || 'Bình thường'} onChange={(v) => updateAmnioticFluidField('status', v)} isEditMode={isEditMode} className="w-36 font-semibold" />)
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Chiều dài kênh CTC (CL)</td>
                        <td className="border border-slate-300 p-1.5 font-bold text-blue-900">
                          <EditableInput value={measurements.cervixLength.value || '3.82'} onChange={(v) => updateMeasurementValue('cervixLength', parseFloat(v) || v)} isEditMode={isEditMode} displaySuffix=" cm (Bình thường > 2.5cm)" className="font-bold text-blue-900 w-28" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* === TEMPLATE 6: Gynecology === */}
            {isGynecology && (
              <>
                <div className="mb-3">
                  <h3 className="text-[11px] font-bold text-purple-900 uppercase border-b border-purple-300 pb-0.5 mb-1.5">
                    I. KHẢO SÁT TỬ CUNG & NIÊM MẠC NỘI MẠC TỬ CUNG
                  </h3>

                  <table className="w-full border-collapse border border-slate-300 text-left text-[11px] mb-2">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50 w-1/3">Tư thế tử cung</td>
                        <td className="border border-slate-300 p-1.5 font-bold text-slate-900">
                          <EditableInput value={anatomy.skullBrain || 'Trung gian (Ngả trước sinh lý)'} onChange={(v) => updateAnatomyField('skullBrain', v)} isEditMode={isEditMode} className="w-full text-slate-900 font-bold" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Cơ tử cung (Myometrium)</td>
                        <td className="border border-slate-300 p-1.5 text-slate-900">
                          <EditableInput value={anatomy.faceEyesNose || 'Cấu trúc âm đồng nhất, không thấy hình ảnh nhân xơ tử cung'} onChange={(v) => updateAnatomyField('faceEyesNose', v)} isEditMode={isEditMode} className="w-full text-slate-900" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Nội mạc tử cung (Endometrium)</td>
                        <td className="border border-slate-300 p-1.5 text-purple-900 font-bold">
                          <EditableInput value={anatomy.chestHeart || 'Dày 8.5 mm (Hình ảnh 3 lá giai đoạn tăng sinh, bờ đều rõ)'} onChange={(v) => updateAnatomyField('chestHeart', v)} isEditMode={isEditMode} className="w-full text-purple-900 font-bold" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-3">
                  <h3 className="text-[11px] font-bold text-purple-900 uppercase border-b border-purple-300 pb-0.5 mb-1.5">
                    II. KHẢO SÁT HAI BUỒNG TRỨNG & CÙNG ĐỒ DOUGLAS
                  </h3>

                  <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50 w-1/3">Buồng trứng Phải</td>
                        <td className="border border-slate-300 p-1.5 text-slate-900">
                          <EditableInput value={anatomy.spine || 'Kích thước 28 x 18 mm, nhu mô bình thường'} onChange={(v) => updateAnatomyField('spine', v)} isEditMode={isEditMode} className="w-full text-slate-900" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Buồng trứng Trái</td>
                        <td className="border border-slate-300 p-1.5 text-slate-900">
                          <EditableInput value={anatomy.limbs || 'Kích thước 27 x 17 mm, không thấy u nang'} onChange={(v) => updateAnatomyField('limbs', v)} isEditMode={isEditMode} className="w-full text-slate-900" />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-1.5 font-semibold bg-slate-50">Túi cùng sau Douglas</td>
                        <td className="border border-slate-300 p-1.5 text-emerald-800 font-bold">
                          <EditableInput value={anatomy.abdomenStomachBladder || 'Không có dịch tự do'} onChange={(v) => updateAnatomyField('abdomenStomachBladder', v)} isEditMode={isEditMode} className="w-full text-emerald-800 font-bold" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 6. Official Conclusion Box */}
            <div className="mb-3 border-2 border-blue-800 rounded-lg p-2.5 bg-blue-50/50">
              <div className="text-[11px] font-black text-blue-900 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>KẾT LUẬN (CONCLUSION):</span>
                <span className="text-[9px] font-normal text-slate-500 font-mono">BS. CAO BÁ SƠN</span>
              </div>
              <div className="text-[11px] font-bold text-slate-900 leading-relaxed">
                <EditableTextarea
                  value={conclusion || activeTemplate.recommendedConclusion
                    .replace('{GA}', patient.gaClin || patient.gaAua || 'tuổi thai')
                    .replace('{FHR}', doppler.fhr.value ? `${doppler.fhr.value}` : '145')
                    .replace('{EFW}', efw.value ? `${efw.value}` : '500')
                    .replace('{PERCENTILE}', efw.percentile || '—')
                    .replace('{NT}', measurements.nt.value ? `${measurements.nt.value}` : '1.4')
                    .replace('{CRL}', measurements.crl.value ? `${measurements.crl.value}` : '62.9')
                    .replace('{AFI}', amnioticFluid.afi.value ? `${amnioticFluid.afi.value}` : '160')
                    .replace('{STATUS_OI}', amnioticFluid.status || 'Bình thường')
                    .replace('{CERVIX}', measurements.cervixLength.value ? `${measurements.cervixLength.value}` : '3.8')
                    .replace('{ENDOMETRIUM}', '8.5')
                  }
                  onChange={(v) => updateReport('conclusion', v)}
                  isEditMode={isEditMode}
                  className="font-bold w-full text-slate-900 text-[11px]"
                />
              </div>

              {(recommendations || isEditMode) && (
                <div className="mt-1.5 pt-1.5 border-t border-blue-200 text-[10.5px] text-slate-700 flex items-start gap-1">
                  <span className="font-bold text-blue-900 shrink-0">Lời dặn & Hẹn khám:</span>{' '}
                  <EditableInput
                    value={recommendations || ''}
                    onChange={(v) => updateReport('recommendations', v)}
                    isEditMode={isEditMode}
                    placeholder="Nhập lời dặn bác sĩ..."
                    className="w-full text-slate-800 text-[10.5px]"
                  />
                </div>
              )}
            </div>
          </>
        )}

            {/* 7. Ultrasound Images Attachments (if enabled) */}
            {includeImages && imageUrls && imageUrls.length > 0 && (
              <div className="mb-3 break-inside-avoid">
                <div className="text-[10px] font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Hình ảnh siêu âm lưu kèm:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {imageUrls.slice(0, 4).map((img, i) => (
                    <div key={i} className="border border-slate-300 rounded overflow-hidden aspect-video bg-black flex items-center justify-center">
                      <img src={img} alt={`Ultrasound capture ${i + 1}`} className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Images Attachments (if enabled) */}
            {includeImages && report.additionalImages && report.additionalImages.length > 0 && (
              <div className="mb-3 break-inside-avoid border-t border-slate-200 pt-2.5">
                <div className="text-[10px] font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-cyan-700" /> Hình ảnh & Chú thích bổ sung khác:
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {report.additionalImages.map((img, i) => (
                    <div key={i} className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50 p-1.5 flex flex-col justify-between">
                      {img.url ? (
                        <div className="aspect-video bg-black flex items-center justify-center rounded overflow-hidden">
                          <img src={img.url} alt={img.description || `Ảnh bổ sung ${i + 1}`} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="aspect-video bg-slate-100 flex items-center justify-center rounded border border-dashed border-slate-300 text-slate-400 text-[9px]">
                          [Không có ảnh]
                        </div>
                      )}
                      {img.description && (
                        <p className="text-[9.5px] font-semibold text-slate-800 text-center mt-1 pt-1 border-t border-slate-150">
                          {img.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Doctor Signature Block */}
            {includeDoctorSignature && (
              <div className="flex justify-between items-end mt-4 pt-2 text-[11px] break-inside-avoid">
                <div className="text-center text-slate-500 text-[9px] leading-tight">
                  <p>Hệ Thống Trả Kết Quả SonoReport AI Standard v3.7</p>
                  <p>Khám lại ngay khi có dấu hiệu bất thường</p>
                </div>

                <div className="text-center w-52">
                  <p className="text-slate-600 italic text-[10px]">Ngày {patient.examDate || new Date().toLocaleDateString('vi-VN')}</p>
                  <p className="font-bold text-blue-950 uppercase mt-0.5">BÁC SĨ SIÊU ÂM</p>
                  <div className="h-12 flex items-center justify-center text-slate-300 italic text-[10px]">
                    (Ký và ghi rõ họ tên)
                  </div>
                  <p className="font-bold text-slate-900">{patient.sonographer || 'BS. CAO BÁ SƠN'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Manager Modal inside Print Modal */}
      <TemplateManagerModal
        isOpen={isTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
        onSelectTemplate={(tmpl) => {
          setSelectedTemplateId(tmpl.id);
          setIsTemplateManagerOpen(false);
        }}
        onTemplatesChange={(tmpls) => {
          setTemplatesList(tmpls);
        }}
      />
    </div>
  );
};
