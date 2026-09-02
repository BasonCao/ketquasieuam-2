import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  Layers,
  Droplet,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Settings,
  Eye,
  EyeOff,
  Baby
} from 'lucide-react';
import { UltrasoundReport } from '../types/ultrasound';

interface ManualEntryTabProps {
  report: UltrasoundReport;
  onChange: (updated: UltrasoundReport) => void;
  onSwitchTab: (tab: 'reception' | 'ocr_ge' | 'form_editor' | 'manual_entry') => void;
  showToast: (message: string) => void;
}

export interface IndicatorConfig {
  id: string;
  label: string;
  category: 'biometry' | 'fluid_heart' | 'doppler';
  unit: string;
  visible: boolean;
  isCustom?: boolean;
}

export type BiometryPresetType = 'early' | 'twelve_weeks' | 'basic' | 'morphology';

interface BiometryFieldDefinition {
  id: string;
  label: string;
  unit: string;
}

const BIOMETRY_PRESETS_MAP: Record<BiometryPresetType, BiometryFieldDefinition[]> = {
  early: [
    { id: 'gs', label: 'Túi thai (GS)', unit: 'mm' },
    { id: 'ys', label: 'Túi noãn hoàng (YS)', unit: 'mm' },
    { id: 'crl', label: 'Chiều dài đầu mông (CRL)', unit: 'mm' },
  ],
  twelve_weeks: [
    { id: 'crl', label: 'CRL (Hadlock)', unit: 'mm' },
    { id: 'nt', label: 'NT', unit: 'mm' },
    { id: 'bpd', label: 'BPD (Hadlock)', unit: 'mm' },
    { id: 'hc', label: 'HC (INTERGRW)', unit: 'mm' },
    { id: 'bod', label: 'BOD (Jeanty)', unit: 'mm' },
    { id: 'nbl', label: 'NBL (Sonek)', unit: 'mm' },
    { id: 'hl', label: 'HL (Jeanty)', unit: 'mm' },
    { id: 'ac', label: 'AC (Hadlock)', unit: 'mm' },
    { id: 'fl', label: 'FL (Osaka)', unit: 'mm' },
    { id: 'foot', label: 'Foot (Chitty)', unit: 'mm' },
    { id: 'cervixLength', label: 'Kênh Cổ Tử Cung (CL)', unit: 'mm' },
  ],
  basic: [
    { id: 'bpd', label: 'Đường kính lưỡng đỉnh (BPD)', unit: 'mm' },
    { id: 'hc', label: 'Chu vi đầu (HC)', unit: 'mm' },
    { id: 'ac', label: 'Chu vi bụng (AC)', unit: 'mm' },
    { id: 'fl', label: 'Chiều dài xương đùi (FL)', unit: 'mm' },
  ],
  morphology: [
    { id: 'bpd', label: 'BPD (Hadlock)', unit: 'mm' },
    { id: 'hc', label: 'HC (INTERGRW)', unit: 'mm' },
    { id: 'vp', label: 'Vp (Não thất bên)', unit: 'mm' },
    { id: 'tcd', label: 'Cereb (Hill)', unit: 'mm' },
    { id: 'cm', label: 'CM (Bể lớn hố sau)', unit: 'mm' },
    { id: 'bod', label: 'BOD (Jeanty)', unit: 'mm' },
    { id: 'nbl', label: 'NBL (Sonek)', unit: 'mm' },
    { id: 'hl', label: 'HL (Jeanty)', unit: 'mm' },
    { id: 'ac', label: 'AC (Hadlock)', unit: 'mm' },
    { id: 'fl', label: 'FL (Osaka)', unit: 'mm' },
    { id: 'foot', label: 'Foot (Chitty)', unit: 'mm' },
    { id: 'cervixLength', label: 'Kênh Cổ Tử Cung (CL)', unit: 'mm' },
  ],
};

const DEFAULT_FLUID_DOPPLER_INDICATORS: IndicatorConfig[] = [
  // Nước ối & Tim thai
  { id: 'fhr', label: 'Nhịp tim thai (FHR)', category: 'fluid_heart', unit: 'bpm', visible: true },
  { id: 'sdp', label: 'Xoang lớn nhất (MVP/SDP)', category: 'fluid_heart', unit: 'mm', visible: true },
  { id: 'afi', label: 'Chỉ số ối (AFI)', category: 'fluid_heart', unit: 'mm', visible: true },

  // Doppler
  { id: 'ua_pi', label: 'ĐM Rốn (UA) PI', category: 'doppler', unit: 'PI', visible: true },
  { id: 'left_uta_pi', label: 'ĐM Tử cung Trái PI', category: 'doppler', unit: 'PI', visible: true },
  { id: 'right_uta_pi', label: 'ĐM Tử cung Phải PI', category: 'doppler', unit: 'PI', visible: true },
  { id: 'dv_pi', label: 'Ống tĩnh mạch (DV) PI', category: 'doppler', unit: 'PI', visible: true },
  { id: 'mca_ps', label: 'ĐM Não giữa (MCA) PS', category: 'doppler', unit: 'PS', visible: true },
  { id: 'mca_pi', label: 'ĐM Não giữa (MCA) PI', category: 'doppler', unit: 'PI', visible: true },
];

const LOCAL_STORAGE_KEY = 'sono_manual_tab_fluid_doppler_indicators_v2';
const LOCAL_STORAGE_PRESET_KEY = 'sono_manual_tab_biometry_preset_v2';

export function ManualEntryTab({
  report,
  onChange,
  onSwitchTab,
  showToast
}: ManualEntryTabProps) {
  // Load customized Fluid/Doppler/Custom indicators
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load manual indicators configuration', e);
    }
    return DEFAULT_FLUID_DOPPLER_INDICATORS;
  });

  // Current biometry preset stage
  const [biometryPreset, setBiometryPreset] = useState<BiometryPresetType>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PRESET_KEY);
      if (saved && ['early', 'twelve_weeks', 'basic', 'morphology'].includes(saved)) {
        return saved as BiometryPresetType;
      }
    } catch (e) {}
    return 'basic';
  });

  // Mode state: is configuring the layout (toggle hide, add, reorder)
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [activeFetusIndex, setActiveFetusIndex] = useState(0);

  const currentFetalCount = report.fetalCount || 1;

  const handleFetalCountChange = (count: number) => {
    const updated = { ...report };
    updated.fetalCount = count;
    
    if (count > 1) {
      if (!updated.fetuses) {
        updated.fetuses = [];
      }
      if (!updated.fetuses[0]) {
        updated.fetuses[0] = {
          id: 'A',
          name: 'Thai A',
          measurements: { ...updated.measurements },
          efw: { ...updated.efw },
          doppler: { ...updated.doppler }
        };
      }
      if (count >= 2 && !updated.fetuses[1]) {
        updated.fetuses[1] = createEmptyFetus('B');
      }
      if (count === 3 && !updated.fetuses[2]) {
        updated.fetuses[2] = createEmptyFetus('C');
      }
    }
    
    onChange(updated);
    if (activeFetusIndex >= count) {
      setActiveFetusIndex(0);
    }
    showToast(`Đã chuyển sang chế độ khảo sát: ${count === 1 ? 'Thai đơn' : count === 2 ? 'Song thai' : 'Tam thai'}`);
  };

  // Form state for adding custom indicators
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<'biometry' | 'fluid_heart' | 'doppler'>('biometry');
  const [newUnit, setNewUnit] = useState('mm');

  // Save changes to local storage whenever indicators list changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(indicators));
  }, [indicators]);

  // Save active biometry preset
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PRESET_KEY, biometryPreset);
  }, [biometryPreset]);

  const createEmptyFetus = (char: 'B' | 'C') => {
    return {
      id: char,
      name: `Thai ${char}`,
      measurements: {
        gs: { value: null, unit: 'mm', name: 'Đường kính túi thai (GS)' },
        ys: { value: null, unit: 'mm', name: 'Túi noãn hoàng (YS)' },
        crl: { value: null, unit: 'mm', name: 'Chiều dài đầu mông (CRL)' },
        nt: { value: null, unit: 'mm', name: 'Độ mờ da gáy (NT)' },
        bpd: { value: null, unit: 'mm', name: 'Đường kính lưỡng đỉnh (BPD)' },
        ofd: { value: null, unit: 'mm', name: 'Đường kính trán chẩm (OFD)' },
        hc: { value: null, unit: 'mm', name: 'Chu vi đầu (HC)' },
        ac: { value: null, unit: 'mm', name: 'Chu vi bụng (AC)' },
        fl: { value: null, unit: 'mm', name: 'Chiều dài xương đùi (FL)' },
        hl: { value: null, unit: 'mm', name: 'Xương cánh tay (HL)' },
        tcd: { value: null, unit: 'mm', name: 'Tiểu não (TCD/Cereb)' },
        cm: { value: null, unit: 'mm', name: 'Bể lớn hố sau (CM)' },
        vp: { value: null, unit: 'mm', name: 'Não thất bên (Vp)' },
        nbl: { value: null, unit: 'mm', name: 'Chiều dài xương mũi (NBL)' },
        bod: { value: null, unit: 'mm', name: 'Đường kính 2 hốc mắt (BOD)' },
        foot: { value: null, unit: 'mm', name: 'Chiều dài bàn chân (Foot)' },
        cervixLength: { value: null, unit: 'cm', name: 'Chiều dài kênh cổ tử cung' },
      },
      efw: {
        value: null,
        unit: 'g',
        range: '',
        gaAge: '',
        percentile: '',
        formula: 'Hadlock',
      },
      doppler: {
        fhr: { value: null, unit: 'bpm', name: 'Ventricular FHR' },
        leftUterine: {},
        rightUterine: {},
        umbilicalArtery: {},
        middleCerebralArtery: {},
        ductusVenosus: {},
      },
      customMeasurements: {}
    };
  };

  const getRootValue = (
    source: {
      measurements?: any;
      efw?: any;
      doppler?: any;
      amnioticFluid?: any;
      customMeasurements?: Record<string, any>;
    },
    id: string,
    isCustom?: boolean
  ): string => {
    if (isCustom) {
      return (source.customMeasurements?.[id] ?? '').toString();
    }
    switch (id) {
      case 'gs': return (source.measurements?.gs?.value ?? '').toString();
      case 'ys': return (source.measurements?.ys?.value ?? '').toString();
      case 'crl': return (source.measurements?.crl?.value ?? '').toString();
      case 'nt': return (source.measurements?.nt?.value ?? '').toString();
      case 'bpd': return (source.measurements?.bpd?.value ?? '').toString();
      case 'hc': return (source.measurements?.hc?.value ?? '').toString();
      case 'ac': return (source.measurements?.ac?.value ?? '').toString();
      case 'fl': return (source.measurements?.fl?.value ?? '').toString();
      case 'vp': return (source.measurements?.vp?.value ?? '').toString();
      case 'tcd': return (source.measurements?.tcd?.value ?? '').toString();
      case 'cm': return (source.measurements?.cm?.value ?? '').toString();
      case 'bod': return (source.measurements?.bod?.value ?? '').toString();
      case 'nbl': return (source.measurements?.nbl?.value ?? '').toString();
      case 'hl': return (source.measurements?.hl?.value ?? '').toString();
      case 'foot': return (source.measurements?.foot?.value ?? '').toString();

      // Fluid & Heart keys
      case 'fhr': return (source.doppler?.fhr?.value ?? '').toString();
      case 'sdp': return (source.amnioticFluid?.sdp?.value ?? '').toString();
      case 'afi': return (source.amnioticFluid?.afi?.value ?? '').toString();

      // Doppler keys
      case 'ua_pi': return (source.doppler?.umbilicalArtery?.pi ?? '').toString();
      case 'left_uta_pi': return (source.doppler?.leftUterine?.pi ?? '').toString();
      case 'right_uta_pi': return (source.doppler?.rightUterine?.pi ?? '').toString();
      case 'dv_pi': return (source.doppler?.ductusVenosus?.pi ?? '').toString();
      case 'mca_ps': return (source.doppler?.middleCerebralArtery?.ps ?? '').toString();
      case 'mca_pi': return (source.doppler?.middleCerebralArtery?.pi ?? '').toString();
      default: return '';
    }
  };

  const setRootValue = (
    source: {
      measurements?: any;
      efw?: any;
      doppler?: any;
      amnioticFluid?: any;
      customMeasurements?: Record<string, any>;
    },
    id: string,
    valStr: string,
    isCustom?: boolean
  ) => {
    const numVal = valStr === '' ? null : parseFloat(valStr);
    
    if (isCustom) {
      if (!source.customMeasurements) {
        source.customMeasurements = {};
      }
      source.customMeasurements[id] = valStr === '' ? null : valStr;
      return source;
    }

    switch (id) {
      // Biometry keys
      case 'gs':
      case 'ys':
      case 'crl':
      case 'nt':
      case 'bpd':
      case 'hc':
      case 'ac':
      case 'fl':
      case 'vp':
      case 'tcd':
      case 'cm':
      case 'bod':
      case 'nbl':
      case 'hl':
      case 'foot':
        if (!source.measurements) source.measurements = {};
        if (!source.measurements[id]) source.measurements[id] = {};
        source.measurements[id].value = numVal;
        source.measurements[id].unit = 'mm';
        break;

      // Fluid & Heart keys
      case 'fhr':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.fhr) source.doppler.fhr = {};
        source.doppler.fhr.value = numVal;
        break;
      case 'sdp':
      case 'afi':
        if (!source.amnioticFluid) source.amnioticFluid = {};
        if (!source.amnioticFluid[id]) source.amnioticFluid[id] = {};
        source.amnioticFluid[id].value = numVal;
        if (id === 'afi') {
          source.amnioticFluid.afi.unit = 'mm';
        } else {
          source.amnioticFluid.sdp.unit = 'mm';
        }
        break;

      // Doppler keys
      case 'ua_pi':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.umbilicalArtery) source.doppler.umbilicalArtery = {};
        source.doppler.umbilicalArtery.pi = numVal;
        break;
      case 'left_uta_pi':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.leftUterine) source.doppler.leftUterine = {};
        source.doppler.leftUterine.pi = numVal;
        break;
      case 'right_uta_pi':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.rightUterine) source.doppler.rightUterine = {};
        source.doppler.rightUterine.pi = numVal;
        break;
      case 'dv_pi':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.ductusVenosus) source.doppler.ductusVenosus = {};
        source.doppler.ductusVenosus.pi = numVal;
        break;
      case 'mca_ps':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.middleCerebralArtery) source.doppler.middleCerebralArtery = {};
        source.doppler.middleCerebralArtery.ps = numVal;
        source.doppler.middleCerebralArtery.psv = numVal;
        break;
      case 'mca_pi':
        if (!source.doppler) source.doppler = {};
        if (!source.doppler.middleCerebralArtery) source.doppler.middleCerebralArtery = {};
        source.doppler.middleCerebralArtery.pi = numVal;
        break;
    }
    return source;
  };

  const getFetusValue = (fetusIndex: number, id: string, isCustom?: boolean): string => {
    if (fetusIndex === 0) {
      return getRootValue(report, id, isCustom);
    }
    const fetusObj = report.fetuses?.[fetusIndex - 1];
    if (!fetusObj) return '';
    return getRootValue(fetusObj, id, isCustom);
  };

  const setFetusValue = (fetusIndex: number, id: string, valStr: string, isCustom?: boolean) => {
    const updated = { ...report };
    
    if (fetusIndex === 0) {
      const modifiedRoot = setRootValue({
        measurements: updated.measurements,
        efw: updated.efw,
        doppler: updated.doppler,
        amnioticFluid: updated.amnioticFluid,
        customMeasurements: updated.customMeasurements
      }, id, valStr, isCustom);
      
      updated.measurements = modifiedRoot.measurements;
      updated.efw = modifiedRoot.efw;
      updated.doppler = modifiedRoot.doppler;
      updated.amnioticFluid = modifiedRoot.amnioticFluid;
      updated.customMeasurements = modifiedRoot.customMeasurements;
      
      if (updated.fetuses && updated.fetuses[0]) {
        updated.fetuses[0] = {
          ...updated.fetuses[0],
          measurements: updated.measurements,
          efw: updated.efw,
          doppler: updated.doppler
        };
      }
    } else {
      if (!updated.fetuses) {
        updated.fetuses = [];
      }
      const subIdx = fetusIndex - 1;
      if (!updated.fetuses[subIdx]) {
        updated.fetuses[subIdx] = createEmptyFetus(subIdx === 0 ? 'B' : 'C');
      }
      const subFetus = updated.fetuses[subIdx];
      const modifiedFetus = setRootValue({
        measurements: subFetus.measurements,
        efw: subFetus.efw,
        doppler: subFetus.doppler,
        customMeasurements: subFetus.customMeasurements
      }, id, valStr, isCustom);
      
      subFetus.measurements = modifiedFetus.measurements;
      subFetus.efw = modifiedFetus.efw;
      subFetus.doppler = modifiedFetus.doppler;
      subFetus.customMeasurements = modifiedFetus.customMeasurements;
    }
    onChange(updated);
  };

  const getIndicatorValue = (id: string, isCustom?: boolean): string => {
    return getFetusValue(0, id, isCustom);
  };

  const setIndicatorValue = (id: string, valStr: string, isCustom?: boolean) => {
    setFetusValue(0, id, valStr, isCustom);
  };

  // Reordering utility: move index up or down within indicators array
  const moveIndicator = (index: number, direction: 'up' | 'down') => {
    const updated = [...indicators];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= updated.length) return;

    // Swap elements
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    setIndicators(updated);
    showToast('Đã sắp xếp lại thứ tự chỉ số thành công!');
  };

  // Toggle visibility of an indicator (acting as toggle/soft-delete)
  const toggleVisibility = (id: string) => {
    setIndicators(prev =>
      prev.map(ind => (ind.id === id ? { ...ind, visible: !ind.visible } : ind))
    );
    showToast('Đã cập nhật trạng thái hiển thị chỉ số!');
  };

  // Fully delete an indicator (if custom)
  const deleteIndicator = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn chỉ số tùy chỉnh này không?')) {
      setIndicators(prev => prev.filter(ind => ind.id !== id));
      
      // Also clean up value in report if exists
      const updated = { ...report };
      if (updated.customMeasurements && updated.customMeasurements[id]) {
        delete updated.customMeasurements[id];
        onChange(updated);
      }
      showToast('Đã xóa vĩnh viễn chỉ số tùy chỉnh!');
    }
  };

  // Add custom indicator
  const handleAddCustomIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showToast('Vui lòng nhập tên chỉ số!');
      return;
    }

    // Generate clean ID
    const cleanId = 'custom_' + Date.now().toString(36);
    const newInd: IndicatorConfig = {
      id: cleanId,
      label: newLabel.trim(),
      category: newCategory,
      unit: newUnit.trim() || 'mm', // Standardize defaults to mm
      visible: true,
      isCustom: true
    };

    setIndicators(prev => [...prev, newInd]);
    setNewLabel('');
    setNewUnit('mm'); // standard unit
    showToast(`Đã thêm chỉ số tùy chỉnh "${newInd.label}" mới!`);
  };

  // Restore factory defaults
  const handleRestoreDefaults = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục thiết kế chỉ số về mặc định ban đầu không?')) {
      setIndicators(DEFAULT_FLUID_DOPPLER_INDICATORS);
      setBiometryPreset('basic');
      showToast('Đã khôi phục thiết lập chỉ số mặc định!');
    }
  };

  // Reset fields to empty
  const handleReset = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhanh toàn bộ các chỉ số vừa nhập không?')) {
      const updated = { ...report };
      
      // Clear all possible biometry measurements
      const biometryKeys = [
        'gs', 'ys', 'crl', 'nt', 'bpd', 'hc', 'ac', 'fl', 'vp', 'tcd', 'cm', 'bod', 'nbl', 'hl', 'foot'
      ];
      biometryKeys.forEach((k) => {
        if (updated.measurements?.[k as any]) {
          updated.measurements[k as any].value = null;
        }
      });

      // Clear amniotic fluid
      if (updated.amnioticFluid) {
        updated.amnioticFluid.sdp.value = null;
        updated.amnioticFluid.afi.value = null;
      }

      // Clear Doppler values
      if (updated.doppler) {
        updated.doppler.fhr.value = null;
        if (updated.doppler.leftUterine) updated.doppler.leftUterine.pi = null;
        if (updated.doppler.rightUterine) updated.doppler.rightUterine.pi = null;
        if (updated.doppler.umbilicalArtery) updated.doppler.umbilicalArtery.pi = null;
        if (updated.doppler.middleCerebralArtery) {
          updated.doppler.middleCerebralArtery.pi = null;
          updated.doppler.middleCerebralArtery.ps = null;
          updated.doppler.middleCerebralArtery.psv = null;
        }
        if (updated.doppler.ductusVenosus) {
          updated.doppler.ductusVenosus.pi = null;
        }
      }

      // Clear custom measurements
      updated.customMeasurements = {};

      onChange(updated);
      showToast('Đã đặt lại toàn bộ các chỉ số về trống!');
    }
  };

  // Current biometry list fields to show based on selected stage preset
  const activePresetFields = BIOMETRY_PRESETS_MAP[biometryPreset] || BIOMETRY_PRESETS_MAP.basic || [];

  // Group other indicators
  const customBiometryList = (indicators || []).filter(ind => ind.category === 'biometry');
  const fluidHeartList = (indicators || []).filter(ind => ind.category === 'fluid_heart');
  const dopplerList = (indicators || []).filter(ind => ind.category === 'doppler');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Nhập Chỉ Số Siêu Âm Nhanh</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hỗ trợ đo đạc nhanh, tự động chuẩn hóa đơn vị <b>mm</b>. Cho phép cấu hình, xóa trống và in ấn tức thời.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Configuration Mode */}
          <button
            type="button"
            onClick={() => setIsConfigMode(!isConfigMode)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              isConfigMode
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700/50'
            }`}
          >
            <Settings className={`w-3.5 h-3.5 ${isConfigMode ? 'animate-spin' : ''}`} />
            <span>{isConfigMode ? 'Xong Thiết Lập' : 'Cấu Hình Chỉ Số'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-800"
            title="Đặt lại các chỉ số"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Xóa Trống</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchTab('form_editor')}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-900/35"
          >
            <span>Mở Form Đầy Đủ</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fetal Count Selector (Thai đơn, Song thai, Tam thai) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-950 border border-violet-800/40 flex items-center justify-center text-violet-400">
            <Baby className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Khảo sát Số lượng Thai</h3>
            <p className="text-[11px] text-slate-400">Chuyển đổi giao diện nhập liệu cho thai đơn, song thai hoặc tam thai</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-center">
          <button
            type="button"
            onClick={() => handleFetalCountChange(1)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              currentFetalCount === 1
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Thai Đơn
          </button>
          <button
            type="button"
            onClick={() => handleFetalCountChange(2)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              currentFetalCount === 2
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Song Thai
          </button>
          <button
            type="button"
            onClick={() => handleFetalCountChange(3)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              currentFetalCount === 3
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tam Thai
          </button>
        </div>
      </div>

      {/* Active Fetus Selector (only when song thai/tam thai) */}
      {currentFetalCount > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
            <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider">Đang nhập liệu cho:</h4>
            <span className="text-xs font-extrabold bg-violet-950/80 border border-violet-800 text-violet-300 px-2.5 py-0.5 rounded-xl">
              {activeFetusIndex === 0 ? 'THAI A' : activeFetusIndex === 1 ? 'THAI B' : 'THAI C'}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
            <button
              type="button"
              onClick={() => setActiveFetusIndex(0)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                activeFetusIndex === 0
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Thai A (Chủ đạo)
            </button>
            <button
              type="button"
              onClick={() => setActiveFetusIndex(1)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                activeFetusIndex === 1
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Thai B
            </button>
            {currentFetalCount === 3 && (
              <button
                type="button"
                onClick={() => setActiveFetusIndex(2)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                  activeFetusIndex === 2
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Thai C
              </button>
            )}
          </div>
        </div>
      )}

      {/* Configuration Mode Help Panel */}
      {isConfigMode && (
        <div className="bg-slate-900 border border-dashed border-cyan-800/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wide">⚙️ Bảng Điều Khiển Cấu Hình Chỉ Số</h4>
            <button
              onClick={handleRestoreDefaults}
              className="text-[10px] bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg font-semibold transition"
            >
              Đặt Lại Mặc Định
            </button>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bạn đang ở <b>Chế độ Cấu hình</b>. Tại đây bạn có thể bấm các mũi tên <span className="inline-flex items-center text-cyan-400 font-bold bg-slate-950 px-1 py-0.2 rounded">↑</span> <span className="inline-flex items-center text-cyan-400 font-bold bg-slate-950 px-1 py-0.2 rounded">↓</span> để sắp xếp thứ tự chỉ số của Tim Thai & Doppler, bấm biểu tượng <span className="text-rose-400 bg-rose-950/40 px-1 rounded">Xóa/Ẩn</span> để tắt các chỉ số không dùng tới, hoặc điền form nhanh bên dưới để thêm các chỉ số riêng của phòng khám.
          </p>

          {/* Add custom index sub-form */}
          <form onSubmit={handleAddCustomIndicator} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#080d19] p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Tên chỉ số mới</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ví dụ: Chiều dài CTC (CL)"
                className="w-full bg-[#050810] text-white text-xs border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Nhóm phân loại</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full bg-[#050810] text-slate-300 text-xs border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="biometry">Sinh Trắc Học Thai Nhi</option>
                <option value="fluid_heart">Nước ối & Tim thai</option>
                <option value="doppler">Huyết Động Học Doppler</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Đơn vị đo</label>
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="mm, cm, bpm, PI, RI..."
                className="w-full bg-[#050810] text-white text-xs border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Chỉ Số</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* COLUMN 1: FETAL BIOMETRY */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Sinh Trắc Học Thai Nhi</h3>
                  <p className="text-[10px] text-slate-400">Đơn vị chuẩn hóa: <b>mm</b></p>
                </div>
              </div>
            </div>

            {/* Fast switching preset buttons (Segmented Tab Bar) */}
            <div className="mt-3 p-1 bg-slate-950 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-1 border border-slate-850">
              <button
                type="button"
                onClick={() => setBiometryPreset('early')}
                className={`px-1 py-1.5 text-[10px] font-bold rounded-lg transition text-center ${
                  biometryPreset === 'early'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Thai nhỏ
              </button>
              <button
                type="button"
                onClick={() => setBiometryPreset('twelve_weeks')}
                className={`px-1 py-1.5 text-[10px] font-bold rounded-lg transition text-center ${
                  biometryPreset === 'twelve_weeks'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Thai 12T
              </button>
              <button
                type="button"
                onClick={() => setBiometryPreset('basic')}
                className={`px-1 py-1.5 text-[10px] font-bold rounded-lg transition text-center ${
                  biometryPreset === 'basic'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cơ bản
              </button>
              <button
                type="button"
                onClick={() => setBiometryPreset('morphology')}
                className={`px-1 py-1.5 text-[10px] font-bold rounded-lg transition text-center ${
                  biometryPreset === 'morphology'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hình thái
              </button>
            </div>

            <div className="space-y-3.5 pt-4">
              {/* Render dynamic preset list */}
              {activePresetFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between gap-3 p-1 rounded-xl transition"
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-300 truncate">
                      {field.label}
                    </span>
                  </div>

                  <div className="relative flex items-center w-full max-w-[140px] shrink-0">
                    <input
                      type="number"
                      step="0.1"
                      value={getFetusValue(activeFetusIndex, field.id)}
                      onChange={(e) => setFetusValue(activeFetusIndex, field.id, e.target.value)}
                      placeholder="---"
                      className="w-full text-right bg-[#070a13] text-emerald-400 font-mono text-sm font-bold border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 pr-10 focus:outline-none transition"
                    />
                    <span className="absolute right-3 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                      {field.unit}
                    </span>
                  </div>
                </div>
              ))}

              {/* Custom indicators in Biometry category */}
              {customBiometryList.map((indicator) => {
                const globalIdx = indicators.findIndex(i => i.id === indicator.id);
                const isFieldVisible = indicator.visible;

                if (!isFieldVisible && !isConfigMode) return null;

                return (
                  <div
                    key={indicator.id}
                    className={`flex items-center justify-between gap-3 p-1 rounded-xl transition ${
                      isConfigMode ? 'bg-[#0a0f1d] border border-slate-800/60' : ''
                    } ${!isFieldVisible ? 'opacity-40 border-dashed border-slate-800' : ''}`}
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-300 truncate">
                        {indicator.label}
                      </span>
                      <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider mt-0.5">
                        Tự chọn
                      </span>
                    </div>

                    {isConfigMode ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleVisibility(indicator.id)}
                          className={`p-1 rounded transition ${
                            isFieldVisible ? 'bg-cyan-950/80 text-cyan-400 hover:bg-cyan-900' : 'bg-slate-850 text-slate-500'
                          }`}
                        >
                          {isFieldVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteIndicator(indicator.id)}
                          className="p-1 rounded bg-rose-950/80 text-rose-400 hover:bg-rose-900 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative flex items-center w-full max-w-[140px] shrink-0">
                        <input
                          type="text"
                          value={getFetusValue(activeFetusIndex, indicator.id, true)}
                          onChange={(e) => setFetusValue(activeFetusIndex, indicator.id, e.target.value, true)}
                          placeholder="---"
                          className="w-full text-right bg-[#070a13] text-emerald-400 font-mono text-sm font-bold border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 pr-10 focus:outline-none transition"
                        />
                        <span className="absolute right-3 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                          {indicator.unit}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: AMNIOTIC FLUID & HEART RATE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-950/50 border border-blue-800/40 flex items-center justify-center text-blue-400">
                <Droplet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Nước Ối & Tim Thai</h3>
                <p className="text-[10px] text-slate-400">Chỉ số ối và tần số nhịp đập</p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              {fluidHeartList.map((indicator, idx) => {
                const globalIdx = indicators.findIndex(i => i.id === indicator.id);
                const isFieldVisible = indicator.visible;

                if (!isFieldVisible && !isConfigMode) return null;

                return (
                  <div
                    key={indicator.id}
                    className={`flex items-center justify-between gap-3 p-1.5 rounded-xl transition ${
                      isConfigMode ? 'bg-[#0a0f1d] border border-slate-800/60' : ''
                    } ${!isFieldVisible ? 'opacity-40 border-dashed border-slate-800' : ''}`}
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-300 truncate flex items-center gap-1">
                        {indicator.id === 'fhr' && <Heart className="w-3 h-3 text-rose-500 shrink-0" />}
                        <span>{indicator.label}</span>
                      </span>
                      {indicator.isCustom && (
                        <span className="text-[9px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">
                          Tự chọn
                        </span>
                      )}
                    </div>

                    {isConfigMode ? (
                      /* Sort and Hide Buttons */
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveIndicator(globalIdx, 'up')}
                          disabled={globalIdx === 0}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-20 transition"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveIndicator(globalIdx, 'down')}
                          disabled={globalIdx === indicators.length - 1}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 disabled:opacity-20 transition"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(indicator.id)}
                          className={`p-1 rounded transition ${
                            isFieldVisible ? 'bg-cyan-950/80 text-cyan-400 hover:bg-cyan-900' : 'bg-slate-850 text-slate-500'
                          }`}
                          title={isFieldVisible ? 'Ẩn khỏi màn hình' : 'Hiện lên màn hình'}
                        >
                          {isFieldVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        {indicator.isCustom && (
                          <button
                            type="button"
                            onClick={() => deleteIndicator(indicator.id)}
                            className="p-1 rounded bg-rose-950/80 text-rose-400 hover:bg-rose-900 transition"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Input box for standard operation */
                      <div className="relative flex items-center w-full max-w-[140px] shrink-0">
                        <input
                          type={indicator.isCustom ? 'text' : 'number'}
                          step="0.1"
                          value={getFetusValue(activeFetusIndex, indicator.id, indicator.isCustom)}
                          onChange={(e) => setFetusValue(activeFetusIndex, indicator.id, e.target.value, indicator.isCustom)}
                          placeholder="---"
                          className={`w-full text-right bg-[#070a13] font-mono text-sm font-bold border border-slate-800 rounded-xl px-3 py-1.5 pr-10 focus:outline-none transition ${
                            indicator.id === 'fhr'
                              ? 'text-rose-400 focus:border-rose-500'
                              : 'text-blue-400 focus:border-blue-500'
                          }`}
                        />
                        <span className="absolute right-3 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                          {indicator.unit}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rapid Cervical Length Input in Manual Entry Tab */}
            <div className="border-t border-slate-800 pt-3 mt-3 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Chiều dài cổ tử cung (CL)
              </span>

              <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-300 font-medium">Bệnh nhân từ chối</span>
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
              </div>

              {!report.cervicalLength?.patientRefused && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-300">Chiều dài (mm)</span>
                    <div className="relative flex items-center w-full max-w-[140px] shrink-0">
                      <input
                        type="number"
                        placeholder="---"
                        value={report.cervicalLength?.length ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          onChange({
                            ...report,
                            cervicalLength: {
                              ...report.cervicalLength,
                              length: val
                            }
                          });
                        }}
                        className="w-full text-right bg-[#070a13] text-blue-400 font-mono text-sm font-bold border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-1.5 pr-10 focus:outline-none transition"
                      />
                      <span className="absolute right-3 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                        mm
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-300">Đường đo</span>
                    <select
                      value={report.cervicalLength?.method || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        onChange({
                          ...report,
                          cervicalLength: {
                            ...report.cervicalLength,
                            method: val as any
                          }
                        });
                      }}
                      className="w-full max-w-[140px] bg-[#070a13] text-slate-300 text-xs border border-slate-800 focus:border-blue-500 rounded-xl px-2 py-1.5 focus:outline-none transition"
                    >
                      <option value="">-- Chọn --</option>
                      <option value="transvaginal">Đầu dò âm đạo</option>
                      <option value="abdominal">Đường bụng</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3: DOPPLER SPECTRUM */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/50 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Huyết Động Học Doppler</h3>
                <p className="text-[10px] text-slate-400">Động mạch Rốn, Tử cung, MCA, DV</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-4">
              {dopplerList.map((indicator, idx) => {
                const globalIdx = indicators.findIndex(i => i.id === indicator.id);
                const isFieldVisible = indicator.visible;

                if (!isFieldVisible && !isConfigMode) return null;

                const isMcaField = indicator.id.startsWith('mca_');

                return (
                  <div
                    key={indicator.id}
                    className={`flex items-center justify-between gap-3 p-1.5 rounded-xl transition ${
                      isConfigMode ? 'bg-[#0a0f1d] border border-slate-800/60' : ''
                    } ${!isFieldVisible ? 'opacity-40 border-dashed border-slate-800' : ''}`}
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-300 truncate">
                        {indicator.label}
                      </span>
                      {indicator.isCustom && (
                        <span className="text-[9px] text-cyan-400 font-semibold uppercase tracking-wider mt-0.5">
                          Tự chọn
                        </span>
                      )}
                    </div>

                    {isConfigMode ? (
                      /* Sort and Hide Buttons */
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveIndicator(globalIdx, 'up')}
                          disabled={globalIdx === 0}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 disabled:opacity-20 transition"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveIndicator(globalIdx, 'down')}
                          disabled={globalIdx === indicators.length - 1}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 disabled:opacity-20 transition"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(indicator.id)}
                          className={`p-1 rounded transition ${
                            isFieldVisible ? 'bg-cyan-950/80 text-cyan-400 hover:bg-cyan-900' : 'bg-slate-850 text-slate-500'
                          }`}
                        >
                          {isFieldVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        {indicator.isCustom && (
                          <button
                            type="button"
                            onClick={() => deleteIndicator(indicator.id)}
                            className="p-1 rounded bg-rose-950/80 text-rose-400 hover:bg-rose-900 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Input box for standard operation */
                      <div className="relative flex items-center w-full max-w-[120px] shrink-0">
                        <input
                          type={indicator.isCustom ? 'text' : 'number'}
                          step="0.01"
                          value={getFetusValue(activeFetusIndex, indicator.id, indicator.isCustom)}
                          onChange={(e) => setFetusValue(activeFetusIndex, indicator.id, e.target.value, indicator.isCustom)}
                          placeholder="---"
                          className={`w-full text-right bg-[#070a13] font-mono text-sm font-bold border border-slate-800 rounded-xl px-3 py-1.5 focus:outline-none transition ${
                            isMcaField
                              ? 'text-indigo-400 focus:border-indigo-500'
                              : 'text-cyan-400 focus:border-cyan-500'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Comparative View Table (only when twins/triplets) */}
      {currentFetalCount > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Baby className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Bảng So Sánh Chỉ Số Giữa Các Thai</h3>
              <p className="text-[10px] text-slate-400">Xem và so sánh nhanh kết quả đo đạc giữa các thai</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/40">
                  <th className="py-2.5 px-3">Chỉ số sinh trắc (mm)</th>
                  <th className="py-2.5 px-3 text-center text-violet-300">Thai A (Chủ đạo)</th>
                  <th className="py-2.5 px-3 text-center text-indigo-300">Thai B</th>
                  {currentFetalCount === 3 && (
                    <th className="py-2.5 px-3 text-center text-blue-300">Thai C</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {activePresetFields.map((field) => (
                  <tr key={field.id} className="hover:bg-slate-850/30 transition animate-fade-in">
                    <td className="py-2 px-3 font-medium text-slate-300">{field.label}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-violet-400">
                      {getFetusValue(0, field.id) || '--'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-indigo-400">
                      {getFetusValue(1, field.id) || '--'}
                    </td>
                    {currentFetalCount === 3 && (
                      <td className="py-2 px-3 text-center font-mono font-bold text-blue-400">
                        {getFetusValue(2, field.id) || '--'}
                      </td>
                    )}
                  </tr>
                ))}
                {/* Fluid Heart Rate Row */}
                <tr className="hover:bg-slate-850/30 transition animate-fade-in">
                  <td className="py-2 px-3 font-medium text-slate-300 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Nhịp tim thai (FHR)</span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-rose-400">
                    {getFetusValue(0, 'fhr') || '--'}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-rose-400">
                    {getFetusValue(1, 'fhr') || '--'}
                  </td>
                  {currentFetalCount === 3 && (
                    <td className="py-2 px-3 text-center font-mono font-bold text-rose-400">
                      {getFetusValue(2, 'fhr') || '--'}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tip Box */}
      <div className="bg-[#0b1329]/50 border border-cyan-900/30 rounded-2xl p-4 text-center">
        <p className="text-[11px] text-cyan-300">
          💡 <b>Mẹo nhanh:</b> Các chỉ số sinh trắc học đã được chuẩn hóa về đơn vị <b>mm</b>. Bấm các tab đầu thai kì để lọc nhanh danh sách hiển thị!
        </p>
      </div>

    </div>
  );
}
