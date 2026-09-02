import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Activity, 
  Heart, 
  Droplet, 
  ShieldCheck, 
  FileText, 
  Sparkles, 
  Calculator, 
  Check, 
  AlertTriangle, 
  Plus, 
  Save, 
  Printer, 
  RotateCcw,
  Info,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  Download,
  CheckCircle2,
  Wand2,
  Table,
  LayoutGrid,
  Building2,
  ShieldAlert,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { UltrasoundReport, Measurements2D, DopplerValues, AmnioticFluidData, PlacentaData, AnatomyChecklist, PatientInfo, FetalWeightEFW } from '../types/ultrasound';
import { calculateHadlockEFW, calculateGAFromCRL, calculateEDDFromLMP, calculateIvfDating, estimateWeightPercentile, generateAutoConclusion } from '../utils/clinicalCalculations';
import { generateClinicalConclusion } from '../services/geminiClient';
import { lookupPatientById, formatPatientVietnameseName, savePatientToDirectory } from '../data/patientDirectory';
import { 
  FORM_TEMPLATES, 
  FormTemplateInfo, 
  getTemplateById, 
  getTemplateForGestationalAge, 
  detectBestTemplate,
  parseGestationalAgeWeeks,
  getStoredFormTemplates
} from '../data/formTemplates';
import { TemplateManagerModal } from './TemplateManagerModal';

interface UltrasoundFormProps {
  report: UltrasoundReport;
  onChange: (updatedReport: UltrasoundReport) => void;
  onSaveToHistory: () => void;
  onOpenPrint: () => void;
}

export const UltrasoundForm: React.FC<UltrasoundFormProps> = ({
  report,
  onChange,
  onSaveToHistory,
  onOpenPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'biometry' | 'doppler' | 'amniotic' | 'anatomy' | 'conclusion'>('biometry');
  const [biometryViewMode, setBiometryViewMode] = useState<'both' | 'table' | 'cards'>('both');
  const [isGeneratingAiConclusion, setIsGeneratingAiConclusion] = useState(false);
  const [appliedTemplateNotification, setAppliedTemplateNotification] = useState<string | null>(null);
  const [formTemplatesList, setFormTemplatesList] = useState<FormTemplateInfo[]>(getStoredFormTemplates);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);

  useEffect(() => {
    const handleTemplatesUpdated = () => {
      setFormTemplatesList(getStoredFormTemplates());
    };
    window.addEventListener('sono_templates_updated', handleTemplatesUpdated);
    return () => window.removeEventListener('sono_templates_updated', handleTemplatesUpdated);
  }, []);

  // Apply a specialized template preset to auto-fill appropriate fields
  const handleApplyTemplate = (tmpl: FormTemplateInfo) => {
    const preset = tmpl.defaultDataPreset;
    
    // Preserve existing patient personal info if filled, but take template specifics
    const updatedPatient: PatientInfo = {
      ...report.patient,
      indication: preset.patient?.indication || report.patient.indication,
      clinicHeader: preset.patient?.clinicHeader || report.patient.clinicHeader,
      sonographer: preset.patient?.sonographer || report.patient.sonographer,
    };

    const updatedReport: UltrasoundReport = {
      ...report,
      detectedCategory: preset.detectedCategory || report.detectedCategory,
      patient: updatedPatient,
      measurements: {
        ...report.measurements,
        ...(preset.measurements || {}),
      },
      efw: preset.efw ? { ...report.efw, ...preset.efw } : report.efw,
      doppler: preset.doppler ? { ...report.doppler, ...preset.doppler } : report.doppler,
      amnioticFluid: preset.amnioticFluid ? { ...report.amnioticFluid, ...preset.amnioticFluid } : report.amnioticFluid,
      placenta: preset.placenta ? { ...report.placenta, ...preset.placenta } : report.placenta,
      anatomy: preset.anatomy ? { ...report.anatomy, ...preset.anatomy } : report.anatomy,
      morphologyV2: preset.morphologyV2 ? { ...report.morphologyV2, ...preset.morphologyV2 } : report.morphologyV2,
      conclusionV2: preset.conclusionV2 ? { ...report.conclusionV2, ...preset.conclusionV2 } : report.conclusionV2,
      fetalMovement: preset.fetalMovement !== undefined ? preset.fetalMovement : report.fetalMovement,
      fetalPresentation: preset.fetalPresentation !== undefined ? preset.fetalPresentation : report.fetalPresentation,
      surveyMilestone: preset.surveyMilestone !== undefined ? preset.surveyMilestone : report.surveyMilestone,
      hideDoppler: preset.hideDoppler !== undefined ? preset.hideDoppler : report.hideDoppler,
      hideCervix: preset.hideCervix !== undefined ? preset.hideCervix : report.hideCervix,
      conclusion: preset.conclusion || report.conclusion,
      recommendations: preset.recommendations || report.recommendations,
      updatedAt: new Date().toISOString(),
    };

    onChange(updatedReport);
    setAppliedTemplateNotification(`Đã tự động điền dữ liệu theo ${tmpl.name}`);
    setTimeout(() => {
      setAppliedTemplateNotification(null);
    }, 4000);
  };

  // Update EFW fields directly (from ultrasound report or manual input)
  const handleEfwChange = (field: keyof FetalWeightEFW, value: any) => {
    let finalVal = value;
    if (field === 'value') {
      finalVal = value === '' ? null : parseFloat(value) || null;
    }

    const updatedEfw: FetalWeightEFW = {
      ...report.efw,
      [field]: finalVal,
      isManual: true,
      source: 'manual',
    };

    onChange({
      ...report,
      efw: updatedEfw,
      updatedAt: new Date().toISOString(),
    });
  };

  // Explicitly recalculate EFW via Hadlock 3 formulas from HC, AC, FL
  const handleRecalculateHadlockEFW = () => {
    const acVal = report.measurements.ac?.value;
    const flVal = report.measurements.fl?.value;
    const bpdVal = report.measurements.bpd?.value;
    const hcVal = report.measurements.hc?.value;

    if (!acVal || !flVal) {
      alert('Cần có ít nhất 2 chỉ số AC (Chu vi bụng) và FL (Xương đùi) để tính cân nặng theo Hadlock.');
      return;
    }

    const calc = calculateHadlockEFW(acVal, flVal, bpdVal, hcVal);
    if (calc.efwGrams) {
      const gaWeeks = parseInt(report.patient.gaClin || report.patient.gaAua || '20', 10) || 20;
      const pct = estimateWeightPercentile(calc.efwGrams, gaWeeks);

      const updatedEfw: FetalWeightEFW = {
        ...report.efw,
        value: calc.efwGrams,
        range: `± ${calc.rangeGrams}g`,
        percentile: pct.percentile,
        formula: calc.formulaUsed || 'Hadlock 3 (HC, AC, FL)',
        method: 'Hadlock 3',
        source: 'calculated',
        isManual: false,
      };

      onChange({
        ...report,
        efw: updatedEfw,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Update measurement and only auto-calculate EFW if EFW has not been set from report/manual
  const handleMeasurementChange = (key: keyof Measurements2D, field: string, value: any) => {
    const currentItem = report.measurements[key] || { value: null, unit: 'mm' };
    const updatedMeasurements = {
      ...report.measurements,
      [key]: {
        ...currentItem,
        [field]: value === '' ? null : (field === 'value' ? parseFloat(value) || null : value),
        isExtracted: false, // Mark as manually edited
      },
    };

    // Only auto-calculate EFW if no EFW value is present
    let updatedEfw = { ...report.efw };
    if (!report.efw.value) {
      const acVal = key === 'ac' ? (value ? parseFloat(value) : null) : report.measurements.ac.value;
      const flVal = key === 'fl' ? (value ? parseFloat(value) : null) : report.measurements.fl.value;
      const bpdVal = key === 'bpd' ? (value ? parseFloat(value) : null) : report.measurements.bpd.value;
      const hcVal = key === 'hc' ? (value ? parseFloat(value) : null) : report.measurements.hc.value;

      if (acVal && flVal) {
        const calc = calculateHadlockEFW(acVal, flVal, bpdVal, hcVal);
        if (calc.efwGrams) {
          const gaWeeks = parseInt(report.patient.gaClin || report.patient.gaAua || '20', 10) || 20;
          const pct = estimateWeightPercentile(calc.efwGrams, gaWeeks);
          updatedEfw = {
            ...updatedEfw,
            value: calc.efwGrams,
            range: `± ${calc.rangeGrams}g`,
            percentile: pct.percentile,
            formula: calc.formulaUsed || 'Hadlock 3 (HC, AC, FL)',
            method: 'Hadlock 3',
            source: 'calculated',
          };
        }
      }
    }

    // CRL auto-calculate GA if CRL is edited
    let updatedPatient = { ...report.patient };
    if (key === 'crl' && value) {
      const crlGa = calculateGAFromCRL(parseFloat(value));
      if (crlGa) {
        updatedMeasurements.crl.gaAge = crlGa.text;
        if (!updatedPatient.gaAua) {
          updatedPatient.gaAua = crlGa.text;
        }
      }
    }

    onChange({
      ...report,
      patient: updatedPatient,
      measurements: updatedMeasurements,
      efw: updatedEfw,
      updatedAt: new Date().toISOString(),
    });
  };

  // Handle Patient Info change & auto LMP -> EDD & auto ID -> Name with accents
  const handlePatientChange = (field: keyof PatientInfo, value: any) => {
    let updated = { ...report.patient, [field]: value };

    // If Patient ID changes, automatically auto-fill accented Vietnamese name and birth year if in directory
    if (field === 'patientId' && typeof value === 'string' && value.trim().length >= 3) {
      const match = lookupPatientById(value.trim());
      if (match) {
        updated.name = match.name;
        if (match.yearOfBirth && !updated.yearOfBirth) {
          updated.yearOfBirth = match.yearOfBirth;
          const currentYear = new Date().getFullYear();
          const y = parseInt(match.yearOfBirth, 10);
          if (!isNaN(y) && y > 1940) {
            updated.age = String(currentYear - y);
          }
        }
        if (match.phone && !updated.phone) {
          updated.phone = match.phone;
        }
      }
    }

    // If user changes name, auto-save / update directory if ID exists
    if (field === 'name' && typeof value === 'string' && value.trim() && updated.patientId) {
      savePatientToDirectory({
        id: updated.patientId,
        name: value.trim(),
        yearOfBirth: updated.yearOfBirth,
        phone: updated.phone,
      });
    }

    // If LMP changes, auto-calculate EDD and GA (ONLY if not IVF dating)
    if (field === 'lmp' && value) {
      if (updated.datingSource !== 'IVF_DAY5' && updated.datingSource !== 'IVF_DAY3' && report.pregnancyDating?.type !== 'IVF') {
        const calc = calculateEDDFromLMP(value, updated.examDate);
        if (calc) {
          if (!updated.edd) updated.edd = calc.eddStr;
          if (!updated.gaClin && calc.gaText) updated.gaClin = calc.gaText;
          if (!updated.ga && calc.gaText) updated.ga = calc.gaText;
          updated.datingSource = 'LMP';
          updated.gaSource = 'LMP';
          updated.eddSource = 'LMP';
        }
      }
    }

    // If DOC / Transfer date changes for IVF, auto-calculate EDD and GA
    if ((field === 'doc' || field === 'transferDate') && value) {
      const embryoDay = updated.embryoDay || report.pregnancyDating?.embryoAge || 5;
      const isIvf = updated.datingSource?.startsWith('IVF') || report.pregnancyDating?.type === 'IVF';
      if (isIvf) {
        const ivfCalc = calculateIvfDating(value, embryoDay, updated.examDate);
        if (ivfCalc) {
          updated.edd = ivfCalc.eddStr;
          updated.gaClin = ivfCalc.gaText;
          updated.ga = ivfCalc.gaText;
          const sourceTag = embryoDay === 3 ? 'IVF_DAY3' : 'IVF_DAY5';
          updated.datingSource = sourceTag;
          updated.gaSource = sourceTag;
          updated.eddSource = sourceTag;
          updated.transferDate = value;
        }
      }
    }

    // If birth year changes, auto-calculate age
    if (field === 'yearOfBirth' && value.length === 4) {
      const y = parseInt(value, 10);
      const currentYear = new Date().getFullYear();
      if (!isNaN(y) && y > 1940 && y <= currentYear) {
        updated.age = String(currentYear - y);
      }
    }

    onChange({
      ...report,
      patient: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // Handle Doppler change
  const handleDopplerChange = (category: 'leftUterine' | 'rightUterine' | 'umbilicalArtery' | 'middleCerebralArtery', field: string, value: any) => {
    const numVal = value === '' ? null : parseFloat(value);
    const updatedVessel: any = {
      ...report.doppler[category],
      [field]: numVal,
    };
    if (field === 'psv') updatedVessel.ps = numVal;
    if (field === 'ps') updatedVessel.psv = numVal;
    if (field === 'tamax') updatedVessel.taMax = numVal;
    if (field === 'sd') updatedVessel.sD = numVal;

    onChange({
      ...report,
      doppler: {
        ...report.doppler,
        [category]: updatedVessel,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  // Handle AFI change
  const handleAmnioticChange = (quadrant: 'q1' | 'q2' | 'q3' | 'q4' | 'afi' | 'sdp' | 'status', value: any) => {
    let updatedAmniotic = { ...report.amnioticFluid };

    if (quadrant === 'status') {
      updatedAmniotic.status = value;
    } else {
      const numVal = value === '' ? null : parseFloat(value);
      updatedAmniotic[quadrant] = {
        ...updatedAmniotic[quadrant],
        value: numVal,
      };

      // Auto-sum AFI if Q1..Q4 are entered
      if (quadrant !== 'afi' && quadrant !== 'sdp') {
        const q1 = updatedAmniotic.q1.value || 0;
        const q2 = (updatedAmniotic.q2.value || 0) * (updatedAmniotic.q2.unit === 'cm' ? 10 : 1);
        const q3 = (updatedAmniotic.q3.value || 0) * (updatedAmniotic.q3.unit === 'cm' ? 10 : 1);
        const q4 = (updatedAmniotic.q4.value || 0) * (updatedAmniotic.q4.unit === 'cm' ? 10 : 1);
        const sum = q1 + q2 + q3 + q4;
        if (sum > 0) {
          updatedAmniotic.afi.value = Math.round(sum * 10) / 10;
          if (sum < 50) updatedAmniotic.status = 'Thiểu ối';
          else if (sum > 240) updatedAmniotic.status = 'Đa ối';
          else updatedAmniotic.status = 'Bình thường';
        }
      }
    }

    onChange({
      ...report,
      amnioticFluid: updatedAmniotic,
      updatedAt: new Date().toISOString(),
    });
  };

  // Quick normal preset for Anatomy
  const handleApplyNormalAnatomy = () => {
    onChange({
      ...report,
      anatomy: {
        skullBrain: 'Hộp sọ hình oval liên tục, cấu trúc não thất bên, đám rối màng mạch, tiểu não và bể lớn bình thường',
        faceEyesNose: 'Hai hốc mắt cân đối, xương mũi hiện diện, môi trên liên tục không thấy khe hở',
        chestHeart: 'Cấu trúc 4 buồng tim cân đối, nhịp tim thai đều, trục tim hướng trái bình thường',
        abdomenStomachBladder: 'Dạ dày và bàng quang nằm trong ổ bụng, thành bụng đóng kín, vị trí cuống rốn bám đúng',
        spine: 'Cột sống liên tục, cong sinh lý bình thường từ cổ đến cùng cụt',
        limbs: 'Quan sát đủ 4 chi, mỗi chi đủ 3 đoạn, bàn tay bàn chân bình thường, cử động thai tốt',
      },
      updatedAt: new Date().toISOString(),
    });
  };

  // Generate Conclusion with AI or fallback
  const handleAutoGenerateConclusion = async () => {
    setIsGeneratingAiConclusion(true);
    try {
      const aiText = await generateClinicalConclusion(report);
      if (aiText) {
        onChange({
          ...report,
          conclusion: aiText,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const local = generateAutoConclusion(
          report.patient,
          report.measurements,
          report.efw,
          report.doppler,
          report.amnioticFluid,
          report.placenta
        );
        onChange({
          ...report,
          conclusion: local.conclusion,
          recommendations: local.recommendations,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      const local = generateAutoConclusion(
        report.patient,
        report.measurements,
        report.efw,
        report.doppler,
        report.amnioticFluid,
        report.placenta
      );
      onChange({
        ...report,
        conclusion: local.conclusion,
        recommendations: local.recommendations,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsGeneratingAiConclusion(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-0">
      {/* Highlighted Previous Abnormalities Alert Banner for Doctor */}
      {report.patient.previousAbnormalities && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 border-b-2 border-amber-500 p-4 text-amber-100 flex items-start gap-3 shadow-xl">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-amber-300 tracking-wide uppercase">
                ⚠️ LẦN KHÁM TRƯỚC CÓ BẤT THƯỜNG (CẢNH BÁO TỪ TIẾP ĐÓN):
              </h4>
              <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.2 rounded font-black">
                NÊU BẬT CẢNH BÁO
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-1 bg-amber-950/60 p-2.5 rounded-xl border border-amber-600/50 shadow-inner">
              {report.patient.previousAbnormalities}
            </p>
            {report.patient.plannedDeliveryLocation && (
              <p className="text-xs text-amber-200/80 mt-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Nơi dự định sinh: <strong>{report.patient.plannedDeliveryLocation}</strong></span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 1. Specialized Form Templates Bar */}
      <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Chọn Mẫu Form Kết Quả Siêu Âm:</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/80">
                  {formTemplatesList.length} Form Mẫu
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Nhấn vào mẫu bên dưới để tự động điền các trường chỉ số và định dạng theo form chuẩn.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsTemplateManagerOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow transition active:scale-95 shrink-0"
              title="Thêm, sửa, xoá mẫu form theo nhu cầu"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Quản Lý & Tạo Form Mẫu</span>
            </button>

            <button
              type="button"
              id="btn-form-quick-pdf"
              onClick={onOpenPrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition active:scale-95 shrink-0"
              title="Xuất file kết quả PDF ngay"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất File PDF</span>
            </button>
          </div>
        </div>

        {/* Template Badges Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
          {formTemplatesList.map((tmpl) => {
            const isCurrentCategory = report.detectedCategory === tmpl.id || (!report.detectedCategory && tmpl.id === 'morphology_14_32w');
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className={`p-2.5 rounded-xl text-left transition border flex flex-col justify-between group relative ${
                  isCurrentCategory
                    ? 'bg-cyan-950/50 border-cyan-500/80 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/30'
                    : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isCurrentCategory ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {tmpl.code.replace('FORM-', '')}
                    </span>
                    {tmpl.isCustom && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-medium">
                        Tự tạo
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{tmpl.badge}</span>
                </div>
                <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition line-clamp-1">
                  {tmpl.name.includes(':') ? tmpl.name.split(':')[1]?.trim() : tmpl.name}
                </div>
                <div className="text-[10px] text-cyan-400 mt-1.5 flex items-center gap-1 font-medium">
                  <Wand2 className="w-3 h-3" />
                  <span>Điền theo form này</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Applied Template Toast Banner */}
        {appliedTemplateNotification && (
          <div className="bg-emerald-950/90 border border-emerald-500/60 rounded-lg px-3 py-1.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appliedTemplateNotification}</span>
          </div>
        )}
      </div>

      {/* Form Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('biometry')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'biometry'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>1. Sinh Trắc Học 2D & EFW</span>
          {report.efw.value && (
            <span className="ml-1 text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800">
              {report.efw.value}g
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'admin'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>2. Hành Chính & Ngày Thai</span>
        </button>

        <button
          onClick={() => setActiveTab('doppler')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'doppler'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>3. Doppler & Tim Thai</span>
          {report.doppler.fhr.value && (
            <span className="ml-1 text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800">
              {report.doppler.fhr.value} bpm
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('amniotic')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'amniotic'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Droplet className="w-4 h-4" />
          <span>4. Nước Ối, Bánh Rau & Cổ Tử Cung</span>
          {report.amnioticFluid.afi.value && (
            <span className="ml-1 text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">
              AFI {report.amnioticFluid.afi.value}mm
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('anatomy')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'anatomy'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>5. Khảo Sát Hình Thái</span>
        </button>

        <button
          onClick={() => setActiveTab('conclusion')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'conclusion'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>6. Kết Luận & Lời Dặn</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* ================= TAB 1: BIOMETRY ================= */}
        {activeTab === 'biometry' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Top Dedicated Panel: Cân Nặng Thai Nhi (EFW) Nhập Trực Tiếp Theo Report Máy Siêu Âm */}
            <div className="bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-cyan-950/40 p-4 sm:p-5 rounded-2xl border border-cyan-500/30 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Cân Nặng Thai Nhi (EFW) - Nhập Theo Chỉ Số Trên Report Máy
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Bác sĩ có thể nhập trực tiếp số cân nặng và bách phân vị từ bản in máy siêu âm, hoặc bấm nút tự động tính theo Hadlock
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {report.efw.isExtracted && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                      ✓ Nhận diện từ Report máy
                    </span>
                  )}
                  {report.efw.isManual && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-medium">
                      ✎ Nhập thủ công
                    </span>
                  )}
                  {report.efw.source === 'calculated' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
                      ⚡ Tính theo công thức Hadlock 3
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleRecalculateHadlockEFW}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-semibold transition active:scale-95 shadow-sm"
                    title="Tự động tính toán cân nặng thai nhi dựa trên công thức Hadlock 3 (HC, AC, FL)"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>⚡ Tính Lại Theo Hadlock 3</span>
                  </button>
                </div>
              </div>

              {/* Input Fields for EFW according to Report */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. EFW Value (Grams) */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-cyan-500/40 focus-within:border-cyan-400 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                      <span>Cân Nặng Thai (EFW)</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Trên Report</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      placeholder="VD: 1850"
                      value={report.efw.value ?? ''}
                      onChange={(e) => handleEfwChange('value', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-cyan-300 font-mono font-bold text-base focus:outline-none placeholder:text-slate-600"
                    />
                    <span className="text-xs font-bold text-slate-300">gam (g)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between">
                    <span>{report.efw.value ? `${report.efw.value} g (chuẩn report)` : 'Chưa có số liệu'}</span>
                    <span className="text-cyan-400 font-medium">Giữ nguyên chỉ số</span>
                  </div>
                </div>

                {/* 2. Error Range (± 15% or ± 270g) */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 focus-within:border-cyan-400 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">Độ Lệch / Sai Số</label>
                    <span className="text-[10px] text-slate-400">Range (±)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="VD: ± 270g hoặc ± 15%"
                      value={report.efw.range ?? ''}
                      onChange={(e) => handleEfwChange('range', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Mặc định khoảng tin cậy: ± 15%
                  </div>
                </div>

                {/* 3. Growth Percentile (GP) */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 focus-within:border-cyan-400 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">Bách Phân Vị (GP)</label>
                    <span className="text-[10px] text-blue-400 font-medium">Percentile</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="VD: 50.0% hoặc 13.1%"
                      value={report.efw.percentile ?? ''}
                      onChange={(e) => handleEfwChange('percentile', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-blue-300 font-mono font-bold text-sm focus:outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between">
                    <span>10% - 90%: Chuẩn AGA</span>
                    <span className="text-emerald-400">Bình thường</span>
                  </div>
                </div>

                {/* 4. Formula / Method */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 focus-within:border-cyan-400 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">Phương Pháp / Tiêu Chuẩn</label>
                    <span className="text-[10px] text-slate-400">Method</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={report.efw.formula || 'Hadlock 3 (HC, AC, FL)'}
                      onChange={(e) => {
                        handleEfwChange('formula', e.target.value);
                        handleEfwChange('method', e.target.value.includes('Hadlock') ? 'Hadlock 3' : (e.target.value.includes('INTERGROWTH') ? 'INTERGROWTH' : e.target.value));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-2.5 py-2 text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="Hadlock 3 (HC, AC, FL)">Hadlock 3 (HC, AC, FL) - Chuẩn</option>
                      <option value="Hadlock 4 (BPD, HC, AC, FL)">Hadlock 4 (BPD, HC, AC, FL)</option>
                      <option value="Hadlock 2 (BPD, AC, FL)">Hadlock 2 (BPD, AC, FL)</option>
                      <option value="Hadlock 1 (AC, FL)">Hadlock 1 (AC, FL)</option>
                      <option value="INTERGROWTH-21st">INTERGROWTH-21st Standard</option>
                      <option value="Warsof (BPD, AC)">Warsof (BPD, AC)</option>
                      <option value="Shepard (BPD, AC)">Shepard (BPD, AC)</option>
                    </select>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Chuẩn quy chiếu quốc tế
                  </div>
                </div>
              </div>
            </div>

            {/* View Mode Bar & Summary Counter */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Table className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    Bảng Tổng Hợp Chỉ Số Sinh Trắc Học Đã Điền
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold font-mono">
                      {Object.values(report.measurements).filter((m: any) => m?.value !== null && m?.value !== undefined).length} / 16 chỉ số
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Toàn bộ chỉ số trích xuất từ hình ảnh máy siêu âm được điền đầy đủ và hiển thị bên dưới
                  </p>
                </div>
              </div>

              {/* View Switcher: Both | Table | Cards */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setBiometryViewMode('both')}
                  className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                    biometryViewMode === 'both'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Bảng & Ô Nhập</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBiometryViewMode('table')}
                  className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                    biometryViewMode === 'table'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Chỉ Bảng Kết Quả</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBiometryViewMode('cards')}
                  className={`px-2.5 py-1 rounded-md transition font-medium flex items-center gap-1 ${
                    biometryViewMode === 'cards'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Chỉ Ô Nhập Liệu</span>
                </button>
              </div>
            </div>

            {/* LIVE BIOMETRY RESULT TABLE */}
            {(biometryViewMode === 'both' || biometryViewMode === 'table') && (
              <div className="bg-slate-900 border border-slate-700/90 rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-800 via-slate-850 to-slate-900 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <Table className="w-4 h-4 text-cyan-400" />
                    Bảng Kết Quả Chỉ Số Sinh Trắc Thai Nhi & Cân Nặng (Biometry Table)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Bác sĩ có thể chỉnh sửa trực tiếp giá trị vào bảng
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800/90 text-slate-300 font-semibold border-b border-slate-700">
                        <th className="py-2.5 px-3 w-10 text-center">STT</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Thông Số Sinh Trắc Học</th>
                        <th className="py-2.5 px-3 w-36 text-center">Giá Trị Đo</th>
                        <th className="py-2.5 px-3 w-32">Bách Phân Vị (GP)</th>
                        <th className="py-2.5 px-3 w-36">Tiêu Chuẩn / Phương Pháp</th>
                        <th className="py-2.5 px-3 w-32">Tuổi Thai (GA)</th>
                        <th className="py-2.5 px-3 w-28 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {[
                        { key: 'bpd' as const, code: 'BPD', name: 'Đường kính lưỡng đỉnh (BPD)', item: report.measurements.bpd, defaultMethod: 'Hadlock' },
                        { key: 'hc' as const, code: 'HC', name: 'Chu vi đầu (HC)', item: report.measurements.hc, defaultMethod: 'INTERGRW' },
                        { key: 'ac' as const, code: 'AC', name: 'Chu vi bụng (AC)', item: report.measurements.ac, defaultMethod: 'Hadlock' },
                        { key: 'fl' as const, code: 'FL', name: 'Chiều dài xương đùi (FL)', item: report.measurements.fl, defaultMethod: 'Osaka' },
                        { key: 'hl' as const, code: 'HL', name: 'Chiều dài xương cánh tay (HL)', item: report.measurements.hl, defaultMethod: 'Jeanty' },
                        { key: 'tcd' as const, code: 'TCD / Cereb', name: 'Đường kính ngang tiểu não (TCD)', item: report.measurements.tcd, defaultMethod: 'Hill' },
                        { key: 'cm' as const, code: 'CM', name: 'Bể lớn hố sau (Cisterna Magna)', item: report.measurements.cm, defaultMethod: 'Nicolaides' },
                        { key: 'vp' as const, code: 'Vp / LV', name: 'Não thất bên (Lateral Ventricle)', item: report.measurements.vp, defaultMethod: 'Cardoza' },
                        { key: 'nbl' as const, code: 'NBL', name: 'Chiều dài xương mũi (NBL)', item: report.measurements.nbl, defaultMethod: 'Sonek' },
                        { key: 'bod' as const, code: 'BOD', name: 'Khoảng cách 2 hốc mắt (BOD)', item: report.measurements.bod, defaultMethod: 'Jeanty' },
                        { key: 'foot' as const, code: 'Foot', name: 'Chiều dài bàn chân (Foot)', item: report.measurements.foot, defaultMethod: 'Chitty' },
                        { key: 'cervixLength' as const, code: 'CL', name: 'Kênh cổ tử cung (Cervix Length)', item: report.measurements.cervixLength, defaultMethod: 'Standard' },
                        { key: 'crl' as const, code: 'CRL', name: 'Chiều dài đầu mông (CRL)', item: report.measurements.crl, defaultMethod: 'Robinson' },
                        { key: 'nt' as const, code: 'NT', name: 'Độ mờ da gáy (NT / Nuchal Translucency)', item: report.measurements.nt, defaultMethod: 'FMF London' },
                        { key: 'gs' as const, code: 'GS', name: 'Đường kính túi thai (GS)', item: report.measurements.gs, defaultMethod: 'Rempen' },
                        { key: 'ys' as const, code: 'YS', name: 'Túi noãn hoàng (Yolk Sac)', item: report.measurements.ys, defaultMethod: 'Lindsay' },
                      ].map((row, idx) => {
                        const hasVal = row.item?.value !== null && row.item?.value !== undefined;
                        return (
                          <tr
                            key={row.key}
                            className={`hover:bg-slate-800/50 transition ${
                              hasVal ? 'bg-slate-900/60' : 'bg-slate-950/40 text-slate-500'
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`font-semibold ${hasVal ? 'text-white' : 'text-slate-400'}`}>
                                {row.name}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 justify-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="--"
                                  value={row.item?.value ?? ''}
                                  onChange={(e) => handleMeasurementChange(row.key, 'value', e.target.value)}
                                  className="w-24 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-right text-white font-mono font-bold text-xs focus:outline-none"
                                />
                                <span className="text-[11px] text-slate-400 w-6 font-medium">
                                  {row.item?.unit || 'mm'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="--"
                                value={row.item?.percentile ?? ''}
                                onChange={(e) => handleMeasurementChange(row.key, 'percentile', e.target.value)}
                                className="w-full bg-slate-950/60 border border-slate-700/60 focus:border-cyan-400 rounded px-2 py-1 text-emerald-400 font-mono text-xs focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder={row.defaultMethod}
                                value={row.item?.method ?? ''}
                                onChange={(e) => handleMeasurementChange(row.key, 'method', e.target.value)}
                                className="w-full bg-slate-950/60 border border-slate-700/60 focus:border-cyan-400 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="--"
                                value={row.item?.gaAge ?? ''}
                                onChange={(e) => handleMeasurementChange(row.key, 'gaAge', e.target.value)}
                                className="w-full bg-slate-950/60 border border-slate-700/60 focus:border-cyan-400 rounded px-2 py-1 text-blue-300 font-mono text-xs focus:outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.item?.isExtracted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  AI
                                </span>
                              ) : hasVal ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
                                  Đã điền
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600">Trống</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* EFW HIGHLIGHT ROW IN LIVE TABLE */}
                      <tr className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-cyan-950/70 border-t-2 border-cyan-500/50 font-semibold">
                        <td className="py-3 px-3 text-center text-cyan-400 font-bold">★</td>
                        <td className="py-3 px-3 text-cyan-200 font-bold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-cyan-400" />
                          <span>Ước Tính Cân Nặng Thai Nhi (EFW)</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 justify-center">
                            <input
                              type="number"
                              placeholder="VD: 741"
                              value={report.efw?.value ?? ''}
                              onChange={(e) => handleEfwChange('value', e.target.value)}
                              className="w-24 bg-slate-950 border border-cyan-400/80 rounded-lg px-2.5 py-1 text-right text-cyan-300 font-mono font-extrabold text-xs focus:outline-none shadow-sm"
                            />
                            <span className="text-[11px] text-cyan-300 w-6 font-bold">g</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            placeholder="33.6%"
                            value={report.efw?.percentile ?? ''}
                            onChange={(e) => handleEfwChange('percentile', e.target.value)}
                            className="w-full bg-slate-950/80 border border-cyan-500/50 rounded px-2 py-1 text-cyan-300 font-mono font-bold text-xs focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            placeholder="Hadlock 3"
                            value={report.efw?.formula || report.efw?.method || ''}
                            onChange={(e) => handleEfwChange('formula', e.target.value)}
                            className="w-full bg-slate-950/80 border border-cyan-500/50 rounded px-2 py-1 text-cyan-200 text-xs focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            placeholder="24w4d"
                            value={report.efw?.gaAge ?? ''}
                            onChange={(e) => handleEfwChange('gaAge', e.target.value)}
                            className="w-full bg-slate-950/80 border border-cyan-500/50 rounded px-2 py-1 text-cyan-300 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold">
                            {report.efw?.value ? 'Chuẩn EFW' : 'Chưa có'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DETAILED CARD INPUTS */}
            {(biometryViewMode === 'both' || biometryViewMode === 'cards') && (
              <>
                {/* Section A: 4 Core Biometry Parameters (BPD, HC, AC, FL) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-cyan-400" />
                      1. Bộ 4 Chỉ Số Sinh Trắc Cơ Bản (BPD - HC - AC - FL)
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Dùng để ước tính cân nặng và tuổi thai theo chuẩn Hadlock / INTERGROWTH-21st
                    </span>
                  </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* BPD */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 relative group hover:border-cyan-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">BPD (Lưỡng Đỉnh)</label>
                    {report.measurements.bpd.isExtracted && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                        AI Nhận diện
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 27.38"
                      value={report.measurements.bpd.value ?? ''}
                      onChange={(e) => handleMeasurementChange('bpd', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>Tuổi: {report.measurements.bpd.gaAge || '--'}</span>
                    <span>GP: {report.measurements.bpd.percentile || '--'}</span>
                  </div>
                </div>

                {/* HC */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 relative group hover:border-cyan-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">HC (Chu Vi Đầu)</label>
                    {report.measurements.hc.isExtracted && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                        AI Nhận diện
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 110.68"
                      value={report.measurements.hc.value ?? ''}
                      onChange={(e) => handleMeasurementChange('hc', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>PP: {report.measurements.hc.method || 'INTERGRW'}</span>
                    <span>GP: {report.measurements.hc.percentile || '--'}</span>
                  </div>
                </div>

                {/* AC */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 relative group hover:border-cyan-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">AC (Chu Vi Bụng)</label>
                    {report.measurements.ac.isExtracted && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                        AI Nhận diện
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 102.26"
                      value={report.measurements.ac.value ?? ''}
                      onChange={(e) => handleMeasurementChange('ac', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>Tuổi: {report.measurements.ac.gaAge || '--'}</span>
                    <span>GP: {report.measurements.ac.percentile || '--'}</span>
                  </div>
                </div>

                {/* FL */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 relative group hover:border-cyan-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">FL (Chiều Dài Xương Đùi)</label>
                    {report.measurements.fl.isExtracted && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                        AI Nhận diện
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 16.40"
                      value={report.measurements.fl.value ?? ''}
                      onChange={(e) => handleMeasurementChange('fl', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>Tuổi: {report.measurements.fl.gaAge || '--'}</span>
                    <span>GP: {report.measurements.fl.percentile || '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: 1st Trimester & Early Pregnancy (GS, YS, CRL, NT, NBL) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  2. Siêu Âm 3 Tháng Đầu (CRL - Độ Mờ Da Gáy NT - GS - YS)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CRL */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 hover:border-emerald-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">CRL (Chiều Dài Đầu Mông)</label>
                    {report.measurements.crl.isExtracted && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                        AI Nhận diện
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 62.90"
                      value={report.measurements.crl.value ?? ''}
                      onChange={(e) => handleMeasurementChange('crl', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Tuổi thai tính từ CRL: <span className="text-emerald-400 font-semibold">{report.measurements.crl.gaAge || '--'}</span>
                  </div>
                </div>

                {/* NT */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 hover:border-emerald-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">NT (Độ Mờ Da Gáy)</label>
                    {report.measurements.nt.value && report.measurements.nt.value > 2.5 && (
                      <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800 font-bold">
                        Cần lưu ý &gt; 2.5mm
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 1.40"
                      value={report.measurements.nt.value ?? ''}
                      onChange={(e) => handleMeasurementChange('nt', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Chuẩn: &lt; 2.5mm ở mốc 11w - 13w6d
                  </div>
                </div>

                {/* GS */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 hover:border-emerald-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">GS (Đường Kính Túi Thai)</label>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 13.37"
                      value={report.measurements.gs.value ?? ''}
                      onChange={(e) => handleMeasurementChange('gs', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Tuổi thai: {report.measurements.gs.gaAge || '--'}
                  </div>
                </div>

                {/* YS */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 hover:border-emerald-500/50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-200">YS (Túi Noãn Hoàng)</label>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 3.02"
                      value={report.measurements.ys.value ?? ''}
                      onChange={(e) => handleMeasurementChange('ys', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Bình thường: 3 - 6 mm
                  </div>
                </div>
              </div>
            </div>

            {/* Section C: Detailed Anatomy Biometry (HL, Cereb, CM, Vp, NBL, BOD, Foot, Cervix) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400" />
                  3. Chi Tiết Não Thất, Xương Mũi, Chi & Kênh CTC
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* HL */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">HL (Xương Cánh Tay)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="18.37"
                      value={report.measurements.hl.value ?? ''}
                      onChange={(e) => handleMeasurementChange('hl', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                {/* Cereb / TCD */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">TCD / Cereb (Tiểu Não)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="15.31"
                      value={report.measurements.tcd.value ?? ''}
                      onChange={(e) => handleMeasurementChange('tcd', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                {/* Vp */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">Vp (Não Thất Bên)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="6.25"
                      value={report.measurements.vp.value ?? ''}
                      onChange={(e) => handleMeasurementChange('vp', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                  <span className="text-[10px] text-slate-500">&lt; 10mm là bình thường</span>
                </div>

                {/* CM */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">CM (Bể Lớn Hố Sau)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="2.98"
                      value={report.measurements.cm.value ?? ''}
                      onChange={(e) => handleMeasurementChange('cm', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Chuẩn 2 - 10 mm</span>
                </div>

                {/* NBL */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">NBL (Chiều Dài Xương Mũi)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="4.06"
                      value={report.measurements.nbl.value ?? ''}
                      onChange={(e) => handleMeasurementChange('nbl', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                {/* BOD */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">BOD (Khoảng Cách 2 Mắt)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="22.06"
                      value={report.measurements.bod.value ?? ''}
                      onChange={(e) => handleMeasurementChange('bod', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                {/* Foot */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">Foot (Chiều Dài Bàn Chân)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="17.96"
                      value={report.measurements.foot.value ?? ''}
                      onChange={(e) => handleMeasurementChange('foot', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                {/* Cervix Length */}
                <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3">
                  <label className="text-xs font-medium text-slate-300">Cervix Length (Chiều Dài Kênh CTC)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="VD: 38.20"
                      value={report.measurements.cervixLength.value ?? ''}
                      onChange={(e) => handleMeasurementChange('cervixLength', 'value', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium">mm</span>
                  </div>
                  <span className="text-[10px] text-slate-500">&gt; 25mm nguy cơ sinh non thấp</span>
                </div>
              </div>
            </div>
          </>
        )}
          </div>
        )}

        {/* ================= TAB 2: PATIENT ADMIN & DATES ================= */}
        {activeTab === 'admin' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Patient Demographic Card */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
              <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Thông Tin Bệnh Nhân & Phòng Khám
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300">Họ và Tên Bệnh Nhân *</label>
                  <input
                    type="text"
                    placeholder="VD: ĐÀO NGỌC KHÁNH LINH"
                    value={report.patient.name}
                    onChange={(e) => handlePatientChange('name', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Mã Bệnh Nhân (ID / SĐT)</label>
                  <input
                    type="text"
                    placeholder="VD: 0353279368"
                    value={report.patient.patientId}
                    onChange={(e) => handlePatientChange('patientId', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-300">Năm Sinh</label>
                    <input
                      type="text"
                      placeholder="1995"
                      value={report.patient.yearOfBirth}
                      onChange={(e) => handlePatientChange('yearOfBirth', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">Tuổi</label>
                    <input
                      type="text"
                      placeholder="31"
                      value={report.patient.age}
                      onChange={(e) => handlePatientChange('age', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Bác Sĩ Siêu Âm</label>
                  <input
                    type="text"
                    placeholder="BS. CAO BÁ SƠN"
                    value={report.patient.sonographer}
                    onChange={(e) => handlePatientChange('sonographer', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Ngày Khám Siêu Âm</label>
                  <input
                    type="text"
                    placeholder="01.04.2026"
                    value={report.patient.examDate}
                    onChange={(e) => handlePatientChange('examDate', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Cơ Sở / Tiêu Đề Phòng Khám</label>
                  <input
                    type="text"
                    placeholder="DR CAO BA SON 57 HD9 VIN 1"
                    value={report.patient.clinicHeader}
                    onChange={(e) => handlePatientChange('clinicHeader', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Vital Signs Row inside Admin tab */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Chiều Cao (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="158"
                    value={report.patient.height ?? ''}
                    onChange={(e) => handlePatientChange('height', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-right font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Cân Nặng (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="54.5"
                    value={report.patient.weight ?? ''}
                    onChange={(e) => handlePatientChange('weight', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-right font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Huyết Áp (mmHg)</label>
                  <input
                    type="text"
                    placeholder="120/80"
                    value={report.patient.bloodPressure || ''}
                    onChange={(e) => handlePatientChange('bloodPressure', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-center font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Mạch (bpm)</label>
                  <input
                    type="number"
                    placeholder="78"
                    value={report.patient.pulse ?? ''}
                    onChange={(e) => handlePatientChange('pulse', e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm text-right font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {/* Gestational Dates & Para */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ngày Thai & Tiền Sử Sản Khoa (Para)
              </h3>

              {(report.pregnancyDating?.type === 'IVF' || report.patient.datingSource?.startsWith('IVF') || report.patient.eddSource?.startsWith('IVF')) && (
                <div className="mb-4 bg-cyan-950/60 border border-cyan-700/80 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-cyan-200 text-xs shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="bg-cyan-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider shadow-sm">IVF / ART</span>
                    <span className="font-semibold text-white">Dating: {report.patient.datingSource === 'IVF_DAY3' ? 'IVF Day 3' : 'IVF Day 5'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
                    <span>Transfer: <strong className="text-white font-bold">{report.patient.transferDate || report.pregnancyDating?.transferDate || report.patient.doc || '--'}</strong></span>
                    <span>Embryo age: <strong className="text-cyan-300 font-bold">Day {report.patient.embryoDay || report.pregnancyDating?.embryoAge || 5}</strong></span>
                    <span>GA: <strong className="text-cyan-300 font-bold">{report.patient.ga || report.pregnancyDating?.ga || report.patient.gaClin || '--'}</strong></span>
                    <span>EDD: <strong className="text-emerald-400 font-bold">{report.patient.edd || report.pregnancyDating?.edd || '--'}</strong></span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300">Kỳ Kinh Cuối (LMP)</label>
                  <input
                    type="text"
                    placeholder="dd.mm.yyyy"
                    value={report.patient.lmp || ''}
                    onChange={(e) => handlePatientChange('lmp', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-[10px] text-slate-400">
                    {report.patient.datingSource?.startsWith('IVF') ? 'Không dùng cho thai IVF' : 'Tự động tính Dự sinh + Tuổi thai'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">
                    {report.patient.datingSource?.startsWith('IVF') || report.pregnancyDating?.type === 'IVF' ? 'Ngày Chuyển Phôi (ET)' : 'Ngày Thụ Thai (DOC)'}
                  </label>
                  <input
                    type="text"
                    placeholder="18.03.2026"
                    value={report.patient.transferDate || report.patient.doc || ''}
                    onChange={(e) => {
                      handlePatientChange('doc', e.target.value);
                      handlePatientChange('transferDate', e.target.value);
                    }}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">
                    {report.patient.datingSource?.startsWith('IVF') || report.pregnancyDating?.type === 'IVF' ? 'Tuổi Thai GA (IVF)' : 'Tuổi Thai Lâm Sàng (GA Clin)'}
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 24w3d"
                    value={report.patient.ga || report.patient.gaClin || ''}
                    onChange={(e) => {
                      handlePatientChange('gaClin', e.target.value);
                      handlePatientChange('ga', e.target.value);
                    }}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-cyan-400 text-cyan-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">
                    {report.patient.datingSource?.startsWith('IVF') || report.pregnancyDating?.type === 'IVF' ? 'Ngày Dự Sinh EDD (IVF)' : 'Ngày Dự Sinh (EDD)'}
                  </label>
                  <input
                    type="text"
                    placeholder="04.12.2026"
                    value={report.patient.edd || ''}
                    onChange={(e) => handlePatientChange('edd', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Reception Intake Info & Abnormalities Card */}
              <div className="mt-4 pt-4 border-t border-slate-700/60 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-amber-950/30 border border-amber-500/50 rounded-xl p-3">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Lần Khám Trước Có Bất Thường Gì Không (Nêu Bật)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="VD: Tiền sử ĐTĐ thai kỳ, Dây rốn quấn cổ 1 vòng, Tiền sản giật..."
                      value={report.patient.previousAbnormalities || ''}
                      onChange={(e) => handlePatientChange('previousAbnormalities', e.target.value)}
                      className="w-full bg-slate-900 border border-amber-600/40 rounded-lg p-2 text-white font-medium text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3">
                    <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Dự Định Sinh Ở Đâu</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Bệnh viện Phụ sản Hà Nội, BV Từ Dũ..."
                      value={report.patient.plannedDeliveryLocation || ''}
                      onChange={(e) => handlePatientChange('plannedDeliveryLocation', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <div className="mt-2">
                      <label className="text-xs font-medium text-slate-400">Ghi Chú Khác Của Tiếp Đón</label>
                      <input
                        type="text"
                        placeholder="VD: Sản phụ có mang hồ sơ cũ, dị ứng penicillin..."
                        value={report.patient.notes || ''}
                        onChange={(e) => handlePatientChange('notes', e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: DOPPLER & HEART RATE ================= */}
        {activeTab === 'doppler' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Fetal Heart Rate */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
              <h3 className="text-xs sm:text-sm font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Tim Thai (Fetal Heart Rate - FHR)
              </h3>
              <div className="flex items-center gap-4 max-w-sm">
                <input
                  type="number"
                  placeholder="VD: 144"
                  value={report.doppler.fhr.value ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : null;
                    onChange({
                      ...report,
                      doppler: {
                        ...report.doppler,
                        fhr: { ...report.doppler.fhr, value: val },
                      },
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-base focus:border-rose-400 focus:outline-none"
                />
                <span className="text-sm text-slate-300 font-medium whitespace-nowrap">nhịp / phút (bpm)</span>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Bình thường: 120 - 160 lần/phút, đều rõ</span>
            </div>

            {/* Left & Right Uterine Doppler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Uterine */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-3">
                  Động Mạch Tử Cung Trái (Left Uterine)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400">PS (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="87.80"
                      value={report.doppler.leftUterine.ps ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'ps', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">ED (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="14.26"
                      value={report.doppler.leftUterine.ed ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'ed', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">TAmax</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="34.31"
                      value={report.doppler.leftUterine.tamax ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'tamax', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">MD (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="13.93"
                      value={report.doppler.leftUterine.md ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'md', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">RI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.84"
                      value={report.doppler.leftUterine.ri ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'ri', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">PI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="2.14"
                      value={report.doppler.leftUterine.pi ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'pi', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">S/D</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="6.16"
                      value={report.doppler.leftUterine.sd ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'sd', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">HR (bpm)</label>
                    <input
                      type="number"
                      placeholder="74"
                      value={report.doppler.leftUterine.hr ?? ''}
                      onChange={(e) => handleDopplerChange('leftUterine', 'hr', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Right Uterine */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-3">
                  Động Mạch Tử Cung Phải (Right Uterine)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400">PS (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="-66.90"
                      value={report.doppler.rightUterine.ps ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'ps', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">ED (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="-5.01"
                      value={report.doppler.rightUterine.ed ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'ed', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">TAmax</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="-16.68"
                      value={report.doppler.rightUterine.tamax ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'tamax', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">MD (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="-4.51"
                      value={report.doppler.rightUterine.md ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'md', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">RI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.93"
                      value={report.doppler.rightUterine.ri ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'ri', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">PI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="3.71"
                      value={report.doppler.rightUterine.pi ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'pi', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">S/D</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="13.35"
                      value={report.doppler.rightUterine.sd ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'sd', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">HR (bpm)</label>
                    <input
                      type="number"
                      placeholder="66"
                      value={report.doppler.rightUterine.hr ?? ''}
                      onChange={(e) => handleDopplerChange('rightUterine', 'hr', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Umbilical & MCA Doppler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
                <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-3">
                  Động Mạch Rốn (Umbilical Artery - UA)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400">PS (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="38.31"
                      value={report.doppler.umbilicalArtery.ps ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'ps', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">ED (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="17.12"
                      value={report.doppler.umbilicalArtery.ed ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'ed', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">TAmax (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="25.99"
                      value={report.doppler.umbilicalArtery.tamax ?? report.doppler.umbilicalArtery.taMax ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'tamax', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">MD (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="16.70"
                      value={report.doppler.umbilicalArtery.md ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'md', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">RI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.55"
                      value={report.doppler.umbilicalArtery.ri ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'ri', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">PI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.82"
                      value={report.doppler.umbilicalArtery.pi ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'pi', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">S/D</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="2.24"
                      value={report.doppler.umbilicalArtery.sd ?? report.doppler.umbilicalArtery.sD ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'sd', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">HR (bpm)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="186"
                      value={report.doppler.umbilicalArtery.hr ?? ''}
                      onChange={(e) => handleDopplerChange('umbilicalArtery', 'hr', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">
                  Động Mạch Não Giữa (Middle Cerebral Artery - MCA)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400">PS / PSV (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="59.29"
                      value={report.doppler.middleCerebralArtery.psv ?? report.doppler.middleCerebralArtery.ps ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'psv', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">ED (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="15.61"
                      value={report.doppler.middleCerebralArtery.ed ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'ed', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">TAmax (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="29.90"
                      value={report.doppler.middleCerebralArtery.tamax ?? report.doppler.middleCerebralArtery.taMax ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'tamax', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">MD (cm/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="11.34"
                      value={report.doppler.middleCerebralArtery.md ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'md', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">RI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.74"
                      value={report.doppler.middleCerebralArtery.ri ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'ri', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">PI</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1.46"
                      value={report.doppler.middleCerebralArtery.pi ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'pi', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">S/D</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="3.80"
                      value={report.doppler.middleCerebralArtery.sd ?? report.doppler.middleCerebralArtery.sD ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'sd', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">HR (bpm)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="168"
                      value={report.doppler.middleCerebralArtery.hr ?? ''}
                      onChange={(e) => handleDopplerChange('middleCerebralArtery', 'hr', e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: AMNIOTIC FLUID & PLACENTA ================= */}
        {activeTab === 'amniotic' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Amniotic Fluid (AFI 4 quadrants) */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-cyan-400" />
                  Chỉ Số Nước Ối (AFI - Amniotic Fluid Index)
                </h3>
                <span className="text-xs font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-full border border-cyan-800">
                  Tổng AFI: {report.amnioticFluid.afi.value || '--'} mm ({report.amnioticFluid.status || 'Bình thường'})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-slate-300">Khoang 1 (Q1)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="41.70"
                      value={report.amnioticFluid.q1.value ?? ''}
                      onChange={(e) => handleAmnioticChange('q1', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Khoang 2 (Q2)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="45"
                      value={report.amnioticFluid.q2.value ?? ''}
                      onChange={(e) => handleAmnioticChange('q2', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Khoang 3 (Q3)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="39.8"
                      value={report.amnioticFluid.q3.value ?? ''}
                      onChange={(e) => handleAmnioticChange('q3', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Khoang 4 (Q4)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="37.3"
                      value={report.amnioticFluid.q4.value ?? ''}
                      onChange={(e) => handleAmnioticChange('q4', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                    />
                    <span className="text-xs text-slate-400">mm</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-700/60">
                <div>
                  <label className="text-xs font-medium text-slate-300">Tổng AFI (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="163.8"
                    value={report.amnioticFluid.afi.value ?? ''}
                    onChange={(e) => handleAmnioticChange('afi', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Xoang ối lớn nhất (MVP/SDP - mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="45"
                    value={report.amnioticFluid.sdp.value ?? ''}
                    onChange={(e) => handleAmnioticChange('sdp', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Đánh Giá Lượng Ối</label>
                  <select
                    value={report.amnioticFluid.status || 'Bình thường'}
                    onChange={(e) => handleAmnioticChange('status', e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  >
                    <option value="Bình thường">Bình thường (AFI 60 - 240 mm)</option>
                    <option value="Dư ối nhẹ">Dư ối nhẹ (AFI 180 - 240 mm)</option>
                    <option value="Đa ối">Đa ối (AFI &gt; 240 mm)</option>
                    <option value="Thiểu ối">Thiểu ối (AFI &lt; 50 mm / SDP &lt; 20 mm)</option>
                    <option value="Vô ối">Vô ối (AFI = 0 mm)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Placenta (Bánh Rau) */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider mb-4">
                Bánh Rau (Placenta)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300">Vị Trí Bám Bánh Rau</label>
                  <select
                    value={report.placenta.location}
                    onChange={(e) =>
                      onChange({
                        ...report,
                        placenta: { ...report.placenta, location: e.target.value },
                      })
                    }
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="Mặt sau tử cung">Mặt sau tử cung</option>
                    <option value="Mặt trước tử cung">Mặt trước tử cung</option>
                    <option value="Đáy tử cung">Đáy tử cung</option>
                    <option value="Bám thấp mặt sau">Bám thấp mặt sau</option>
                    <option value="Bám thấp mặt trước">Bám thấp mặt trước</option>
                    <option value="Rau tiền đạo bán trung tâm">Rau tiền đạo bán trung tâm</option>
                    <option value="Rau tiền đạo trung tâm">Rau tiền đạo trung tâm</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Độ Trưởng Thành (Grade)</label>
                  <select
                    value={report.placenta.grade}
                    onChange={(e) =>
                      onChange({
                        ...report,
                        placenta: { ...report.placenta, grade: e.target.value },
                      })
                    }
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="Độ 0">Độ 0 (3 tháng đầu/giữa)</option>
                    <option value="Độ I">Độ I (Khoảng 28 - 32 tuần)</option>
                    <option value="Độ II">Độ II (Khoảng 32 - 36 tuần)</option>
                    <option value="Độ III">Độ III (Gần ngày sinh &gt; 37 tuần)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Độ Dày Bánh Rau (mm)</label>
                  <input
                    type="number"
                    placeholder="VD: 24"
                    value={report.placenta.thickness ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...report,
                        placenta: {
                          ...report.placenta,
                          thickness: e.target.value ? parseFloat(e.target.value) : null,
                        },
                      })
                    }
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Cervical Length (Chiều Dài Cổ Tử Cung) */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Chiều Dài Cổ Tử Cung (Cervical Length - CL)
                </h3>
                {report.cervicalLength?.patientRefused && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold animate-pulse">
                    ⚠️ Từ chối siêu âm đầu dò âm đạo
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Method Select */}
                <div>
                  <label className="text-xs font-medium text-slate-300">Phương Pháp Đo (Đường Đo)</label>
                  <select
                    value={report.cervicalLength?.method || ''}
                    disabled={report.cervicalLength?.patientRefused}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      onChange({
                        ...report,
                        cervicalLength: {
                          ...report.cervicalLength,
                          method: val as any,
                        }
                      });
                    }}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none disabled:opacity-50 disabled:bg-slate-950"
                  >
                    <option value="">-- Chưa chọn ngả đo --</option>
                    <option value="transvaginal">Siêu âm đầu dò âm đạo (Transvaginal - Khuyên dùng)</option>
                    <option value="abdominal">Siêu âm qua đường bụng (Abdominal)</option>
                  </select>
                </div>

                {/* 2. Length Input */}
                <div>
                  <label className="text-xs font-medium text-slate-300">Chiều Dài Cổ Tử Cung (mm)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      placeholder="VD: 38"
                      disabled={report.cervicalLength?.patientRefused}
                      value={report.cervicalLength?.length ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        onChange({
                          ...report,
                          cervicalLength: {
                            ...report.cervicalLength,
                            length: val,
                          }
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-cyan-400 disabled:opacity-50 disabled:bg-slate-950"
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">mm</span>
                  </div>
                  {report.cervicalLength?.length && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Tương đương: <span className="text-cyan-400 font-semibold">{(report.cervicalLength.length / 10).toFixed(2)} cm</span>
                    </span>
                  )}
                </div>

                {/* 3. Refused Checkbox */}
                <div className="flex items-center pt-5 sm:pt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!report.cervicalLength?.patientRefused}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        onChange({
                          ...report,
                          cervicalLength: {
                            ...report.cervicalLength,
                            patientRefused: isChecked,
                            ...(isChecked ? { length: null, method: null } : {})
                          }
                        });
                      }}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-200">BN Từ Chối Siêu Âm Đầu Dò</span>
                      <p className="text-[10px] text-slate-400">Bệnh nhân từ chối thực hiện qua ngả âm đạo</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notes about cervical length */}
              <div>
                <label className="text-xs font-medium text-slate-300">Mô Tả Chi Tiết / Ghi Chú Cổ Tử Cung</label>
                <input
                  type="text"
                  placeholder="VD: Lỗ trong đóng kín, hình thái bình thường, không có dấu hiệu mở hình phễu..."
                  value={report.cervicalLength?.notes || ''}
                  onChange={(e) => {
                    onChange({
                      ...report,
                      cervicalLength: {
                        ...report.cervicalLength,
                        notes: e.target.value,
                      }
                    });
                  }}
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: ANATOMY ================= */}
        {activeTab === 'anatomy' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Khảo Sát Chi Tiết Hình Thái Cơ Quan Thai Nhi
              </h3>
              <button
                type="button"
                onClick={handleApplyNormalAnatomy}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-medium transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Điền mẫu "Tất cả bình thường"
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
                <label className="text-xs font-bold text-slate-200">1. Hộp sọ & Não bộ</label>
                <textarea
                  rows={2}
                  value={report.anatomy.skullBrain}
                  onChange={(e) =>
                    onChange({
                      ...report,
                      anatomy: { ...report.anatomy, skullBrain: e.target.value },
                    })
                  }
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
                <label className="text-xs font-bold text-slate-200">2. Mặt, Mắt, Xương Mũi & Môi</label>
                <textarea
                  rows={2}
                  value={report.anatomy.faceEyesNose}
                  onChange={(e) =>
                    onChange({
                      ...report,
                      anatomy: { ...report.anatomy, faceEyesNose: e.target.value },
                    })
                  }
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
                <label className="text-xs font-bold text-slate-200">3. Tim & Lồng Ngực</label>
                <textarea
                  rows={2}
                  value={report.anatomy.chestHeart}
                  onChange={(e) =>
                    onChange({
                      ...report,
                      anatomy: { ...report.anatomy, chestHeart: e.target.value },
                    })
                  }
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
                <label className="text-xs font-bold text-slate-200">4. Ổ Bụng, Dạ Dày & Bàng Quang</label>
                <textarea
                  rows={2}
                  value={report.anatomy.abdomenStomachBladder}
                  onChange={(e) =>
                    onChange({
                      ...report,
                      anatomy: { ...report.anatomy, abdomenStomachBladder: e.target.value },
                    })
                  }
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
                <label className="text-xs font-bold text-slate-200">5. Cột Sống</label>
                <textarea
                  rows={2}
                  value={report.anatomy.spine}
                  onChange={(e) =>
                    onChange({
                      ...report,
                      anatomy: { ...report.anatomy, spine: e.target.value },
                    })
                  }
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
                <label className="text-xs font-bold text-slate-200">6. Tứ Chi & Bàn Tay / Bàn Chân</label>
                <textarea
                  rows={2}
                  value={report.anatomy.limbs}
                  onChange={(e) =>
                    onChange({
                      ...report,
                      anatomy: { ...report.anatomy, limbs: e.target.value },
                    })
                  }
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: CONCLUSION & RECOMMENDATIONS ================= */}
        {activeTab === 'conclusion' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Conclusion Header with AI Auto-Generator Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Kết Luận Siêu Âm Sản Phụ Khoa & Lời Dặn Bác Sĩ
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động tổng hợp từ các chỉ số đo đạc hoặc chỉnh sửa thủ công tự do.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAutoGenerateConclusion}
                disabled={isGeneratingAiConclusion}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 shrink-0"
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                {isGeneratingAiConclusion ? 'AI đang soạn thảo kết luận...' : 'Tự Động Sinh Kết Luận Y Khoa'}
              </button>
            </div>

            {/* Conclusion Text Area */}
            <div>
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between mb-2">
                <span>KẾT LUẬN (CONCLUSION) *</span>
                <span className="text-[11px] text-slate-400">Hiển thị nổi bật trên phiếu in</span>
              </label>
              <textarea
                rows={4}
                value={report.conclusion}
                onChange={(e) => onChange({ ...report, conclusion: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-sm text-white leading-relaxed focus:outline-none"
                placeholder="VD: Một thai sống trong buồng tử cung phát triển tương đương 15 tuần 4 ngày. Tim thai đều rõ (144 l/p). Cân nặng ước tính 125g. Các chỉ số đo trong giới hạn bình thường..."
              />
            </div>

            {/* Recommendations & Follow-up Schedule */}
            <div>
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between mb-2">
                <span>ĐỀ NGHỊ & HẸN TÁI KHÁM (RECOMMENDATIONS)</span>
              </label>
              <textarea
                rows={3}
                value={report.recommendations}
                onChange={(e) => onChange({ ...report, recommendations: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-sm text-white leading-relaxed focus:outline-none"
                placeholder="VD: Khám thai định kỳ. Hẹn siêu âm mốc hình thái 4D/5D ở tuần 20 - 22..."
              />
            </div>

            {/* Additional Images & Descriptions */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  Hình Ảnh & Ghi Chú Mô Tả Bổ Sung Ngoài Form (Other Images & Comments)
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  {report.additionalImages?.length || 0} hình ảnh bổ sung
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Thêm các hình ảnh chụp siêu âm đặc thù (ví dụ: ảnh dựng 3D gương mặt, hình ảnh cột sống, các lát cắt dị tật nếu có) kèm chú thích hiển thị riêng bên dưới phiếu kết quả in.
              </p>

              {/* List of current additional images */}
              {report.additionalImages && report.additionalImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.additionalImages.map((img, idx) => (
                    <div key={idx} className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/80 relative flex gap-3 hover:border-cyan-500/50 transition">
                      {/* Trash Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const updatedImgs = [...(report.additionalImages || [])];
                          updatedImgs.splice(idx, 1);
                          onChange({ ...report, additionalImages: updatedImgs });
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-850 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition"
                        title="Xóa hình ảnh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Image Preview */}
                      <div className="w-24 h-24 rounded-lg bg-slate-950 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center relative group">
                        {img.url ? (
                          <img
                            src={img.url}
                            alt={img.description || `Ảnh bổ sung ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-[10px] text-slate-500 text-center px-1">Chưa có URL ảnh</div>
                        )}
                      </div>

                      {/* URL and Description Editing */}
                      <div className="flex-1 space-y-2 pr-6">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ghi chú mô tả ảnh</label>
                          <input
                            type="text"
                            placeholder="VD: Gương mặt thai nhi cười..."
                            value={img.description || ''}
                            onChange={(e) => {
                              const updatedImgs = [...(report.additionalImages || [])];
                              updatedImgs[idx] = { ...updatedImgs[idx], description: e.target.value };
                              onChange({ ...report, additionalImages: updatedImgs });
                            }}
                            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Đường dẫn ảnh (URL)</label>
                          <input
                            type="text"
                            placeholder="https://..."
                            value={img.url || ''}
                            onChange={(e) => {
                              const updatedImgs = [...(report.additionalImages || [])];
                              updatedImgs[idx] = { ...updatedImgs[idx], url: e.target.value };
                              onChange({ ...report, additionalImages: updatedImgs });
                            }}
                            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-[10px] text-slate-300 font-mono focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const updatedImgs = [...(report.additionalImages || [])];
                    updatedImgs.push({ url: '', description: '' });
                    onChange({ ...report, additionalImages: updatedImgs });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  Thêm ô nhập ảnh trống
                </button>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-medium mr-1 uppercase">Thêm ảnh mẫu nhanh:</span>
                  {[
                    { label: '👶 Mặt 3D', url: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=400&auto=format&fit=crop&q=60', desc: 'Gương mặt thai nhi dựng hình 3D/4D' },
                    { label: '脊 Cột sống', url: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&auto=format&fit=crop&q=60', desc: 'Mặt dọc liên tục cột sống thai nhi' },
                    { label: '❤️ Tim 4 buồng', url: 'https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?w=400&auto=format&fit=crop&q=60', desc: 'Hình ảnh khảo sát 4 buồng tim thai cân đối' }
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        const updatedImgs = [...(report.additionalImages || [])];
                        updatedImgs.push({ url: preset.url, description: preset.desc });
                        onChange({ ...report, additionalImages: updatedImgs });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950 hover:text-cyan-300 border border-slate-800 text-[10px] font-medium text-slate-400 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-950 border-t border-slate-800">
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-300">
            {report.patient.name ? report.patient.name : 'Phiếu chưa lưu tên'}
          </span>
          {report.efw.value ? ` • EFW: ${report.efw.value}g` : ''}
          {report.patient.gaClin ? ` • GA: ${report.patient.gaClin}` : ''}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            type="button"
            onClick={onSaveToHistory}
            className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>Lưu Phiếu</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md transition active:scale-95"
            title="Mở xem trước và tải file PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất File PDF</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md transition active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In & Xuất Phiếu</span>
          </button>
        </div>
      </div>

      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={isTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
        onSelectTemplate={(tmpl) => {
          handleApplyTemplate(tmpl);
          setIsTemplateManagerOpen(false);
        }}
        onTemplatesChange={(tmpls) => {
          setFormTemplatesList(tmpls);
        }}
      />
    </div>
  );
};
