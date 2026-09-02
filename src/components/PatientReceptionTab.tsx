import React, { useState, useEffect } from 'react';
import {
  User,
  UserPlus,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  Building2,
  FileText,
  History,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Baby,
  ShieldAlert,
  Activity,
  HeartPulse,
  Scale,
  Search,
  Check,
  Plus,
  Clock,
  ChevronRight,
  UploadCloud,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { UltrasoundReport, PatientInfo } from '../types/ultrasound';
import {
  PatientDirectoryRecord,
  lookupPatientById,
  savePatientToDirectory,
  formatPatientVietnameseName,
  getPatientDirectory
} from '../data/patientDirectory';

interface PatientReceptionTabProps {
  currentReport: UltrasoundReport;
  onUpdateReport: (updatedReport: UltrasoundReport) => void;
  onSwitchTab: (tab: 'reception' | 'ocr_ge' | 'form_editor' | 'manual_entry') => void;
  historyRecords: UltrasoundReport[];
  showToast: (msg: string) => void;
}

const PRESET_HOSPITALS = [
  'Bệnh viện Tâm Anh',
  'Bệnh viện Bắc Hà',
  'Bệnh viện Phụ sản Hà Nội',
  'Bệnh viện Phụ sản Trung Ương (C)',
  'Bệnh viện Vinmec Times City',
  'Bệnh viện Bưu Điện',
  'Bệnh viện Bạch Mai',
  'Bệnh viện Hồng Ngọc',
  'Bệnh viện Thu Cúc',
  'Bệnh viện Từ Dũ (TP.HCM)',
  'Bệnh viện Hùng Vương (TP.HCM)',
];

const calculateBMIValue = (h: string | number, w: string | number): number | null => {
  const hNum = typeof h === 'number' ? h : parseFloat(String(h));
  const wNum = typeof w === 'number' ? w : parseFloat(String(w));
  if (!hNum || !wNum || hNum <= 0 || wNum <= 0) return null;
  const hMeters = hNum / 100;
  return parseFloat((wNum / (hMeters * hMeters)).toFixed(1));
};

const getBMILabel = (bmi: number) => {
  if (bmi < 18.5) return { label: 'Gầy', badge: 'bg-amber-950 text-amber-300 border-amber-800' };
  if (bmi <= 22.9) return { label: 'Bình thường', badge: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
  if (bmi <= 24.9) return { label: 'Thừa cân', badge: 'bg-amber-950 text-amber-300 border-amber-800' };
  return { label: 'Béo phì', badge: 'bg-rose-950 text-rose-300 border-rose-800' };
};

const evaluateBP = (bpStr: string) => {
  if (!bpStr) return null;
  const parts = bpStr.split('/');
  if (parts.length === 2) {
    const sys = parseInt(parts[0], 10);
    const dia = parseInt(parts[1], 10);
    if (!isNaN(sys) && !isNaN(dia)) {
      if (sys >= 140 || dia >= 90) {
        return { isHigh: true, text: 'Huyết áp cao (Cần chú ý Tiền giật)' };
      }
      if (sys < 90 || dia < 60) {
        return { isLow: true, text: 'Huyết áp thấp' };
      }
      return { isNormal: true, text: 'Huyết áp bình thường' };
    }
  }
  return null;
};

const calculateGAFromEDD = (eddStr: string): string => {
  if (!eddStr) return '';
  const cleanStr = eddStr.replace(/\s/g, '');
  const parts = cleanStr.split(/[\/\.\-]/);
  if (parts.length !== 3) return '';

  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return '';

  const fullY = y < 100 ? (y > (new Date().getFullYear() % 100) ? 1900 + y : 2000 + y) : y;
  const eddDate = new Date(fullY, m, d);
  if (isNaN(eddDate.getTime())) return '';

  // LMP Date is EDD minus 280 days
  const lmpTime = eddDate.getTime() - 280 * 24 * 60 * 60 * 1000;
  const lmpDate = new Date(lmpTime);

  // Clear hours to compare calendar days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lmpDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lmpDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays > 300) {
    return '';
  }

  const gaWeeks = Math.floor(diffDays / 7);
  const gaDays = diffDays % 7;

  return `${gaWeeks} tuần ${gaDays} ngày (${gaWeeks}w${gaDays}d)`;
};

const PRESET_ABNORMALITIES = [
  '🔴 Rau bám thấp / Rau tiền đạo',
  '🟠 Đa ối / Dư ối',
  '🟡 Thiểu ối',
  '🔴 Thai chậm phát triển (IUGR)',
  '🟣 Vòng dây rốn quấn cổ x2',
  '🔵 Sẹo mổ đẻ cũ mỏng',
  '🔴 Tiền giật / Huyết áp cao',
  '🟢 Bình thường',
];

export const PatientReceptionTab: React.FC<PatientReceptionTabProps> = ({
  currentReport,
  onUpdateReport,
  onSwitchTab,
  historyRecords,
  showToast,
}) => {
  // Form State
  const [patientIdInput, setPatientIdInput] = useState(currentReport.patient.patientId || '');
  const [name, setName] = useState(currentReport.patient.name || '');
  const [dob, setDob] = useState(currentReport.patient.dob || '');
  const [yearOfBirth, setYearOfBirth] = useState(currentReport.patient.yearOfBirth || '');
  const [age, setAge] = useState(currentReport.patient.age || '');
  const [phone, setPhone] = useState(currentReport.patient.phone || '');
  const [address, setAddress] = useState(currentReport.patient.address || '');
  const [gender, setGender] = useState(currentReport.patient.gender || 'Nữ');
  
  // Obstetrical history
  const [gravida, setGravida] = useState(currentReport.patient.gravida || '1');
  const [para, setPara] = useState(currentReport.patient.para || '0');
  const [abortion, setAbortion] = useState(currentReport.patient.abortion || '0');
  const [ectopic, setEctopic] = useState(currentReport.patient.ectopic || '0');
  const [obstetricHistoryNotes, setObstetricHistoryNotes] = useState(
    currentReport.patient.obstetricHistoryNotes || ''
  );

  // Vital signs (Chỉ số sinh tồn)
  const [height, setHeight] = useState<string | number>(currentReport.patient.height ?? '');
  const [weight, setWeight] = useState<string | number>(currentReport.patient.weight ?? '');
  const [bloodPressure, setBloodPressure] = useState<string>(currentReport.patient.bloodPressure || '');
  const [pulse, setPulse] = useState<string | number>(currentReport.patient.pulse ?? '');

  // Reception specific
  const [previousAbnormalities, setPreviousAbnormalities] = useState(
    currentReport.patient.previousAbnormalities || ''
  );
  const [plannedDeliveryLocation, setPlannedDeliveryLocation] = useState(
    currentReport.patient.plannedDeliveryLocation || ''
  );
  const [notes, setNotes] = useState(currentReport.patient.notes || '');
  const [edd, setEdd] = useState(currentReport.patient.edd || '');
  const [gaClin, setGaClin] = useState(currentReport.patient.gaClin || '');
  const [firstVisitDate, setFirstVisitDate] = useState(
    currentReport.patient.firstVisitDate || new Date().toLocaleDateString('vi-VN')
  );

  // Auto-filled status tracker
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [matchedRecord, setMatchedRecord] = useState<PatientDirectoryRecord | null>(null);

  // Sync with current report when switching into this tab
  useEffect(() => {
    if (currentReport.patient.patientId) {
      setPatientIdInput(currentReport.patient.patientId);
      setName(currentReport.patient.name);
      setYearOfBirth(currentReport.patient.yearOfBirth);
      setAge(currentReport.patient.age);
      setPhone(currentReport.patient.phone);
      setAddress(currentReport.patient.address);
      if (currentReport.patient.height !== undefined && currentReport.patient.height !== null) {
        setHeight(currentReport.patient.height);
      }
      if (currentReport.patient.weight !== undefined && currentReport.patient.weight !== null) {
        setWeight(currentReport.patient.weight);
      }
      if (currentReport.patient.bloodPressure) {
        setBloodPressure(currentReport.patient.bloodPressure);
      }
      if (currentReport.patient.pulse !== undefined && currentReport.patient.pulse !== null) {
        setPulse(currentReport.patient.pulse);
      }
      if (currentReport.patient.previousAbnormalities) {
        setPreviousAbnormalities(currentReport.patient.previousAbnormalities);
      }
      if (currentReport.patient.plannedDeliveryLocation) {
        setPlannedDeliveryLocation(currentReport.patient.plannedDeliveryLocation);
      }
      if (currentReport.patient.notes) {
        setNotes(currentReport.patient.notes);
      }
      if (currentReport.patient.edd) {
        setEdd(currentReport.patient.edd);
      }
      if (currentReport.patient.gaClin) {
        setGaClin(currentReport.patient.gaClin);
      }
    }
  }, [currentReport.patient.patientId]);

  // AUTO-JUMP LOOKUP LOGIC ("các lần sau các trường tự nhảy khi nhập id")
  const handleIdChange = (rawId: string) => {
    setPatientIdInput(rawId);
    setPhone(rawId); // Default phone to ID if phone format

    const cleanId = rawId.replace(/[\s\.\-_]/g, '').trim();
    if (!cleanId) {
      setIsExistingPatient(false);
      setMatchedRecord(null);
      return;
    }

    // Lookup in patient directory or clinic history
    const record = lookupPatientById(cleanId);

    if (record) {
      // AUTO-FILL ALL FIELDS!
      setIsExistingPatient(true);
      setMatchedRecord(record);
      if (record.name) setName(record.name);
      if (record.dob) setDob(record.dob);
      if (record.yearOfBirth) {
        setYearOfBirth(record.yearOfBirth);
        const y = parseInt(record.yearOfBirth, 10);
        if (!isNaN(y) && y > 1930) {
          setAge(String(new Date().getFullYear() - y));
        }
      }
      if (record.phone) setPhone(record.phone);
      if (record.address) setAddress(record.address);
      if (record.gender) setGender(record.gender);

      // Vital signs auto-jump
      if (record.height !== undefined && record.height !== null) setHeight(record.height);
      if (record.weight !== undefined && record.weight !== null) setWeight(record.weight);
      if (record.bloodPressure) setBloodPressure(record.bloodPressure);
      if (record.pulse !== undefined && record.pulse !== null) setPulse(record.pulse);

      // Obstetrical history auto-jump
      if (record.gravida !== undefined) setGravida(record.gravida);
      if (record.para !== undefined) setPara(record.para);
      if (record.abortion !== undefined) setAbortion(record.abortion);
      if (record.ectopic !== undefined) setEctopic(record.ectopic);
      if (record.obstetricHistoryNotes) setObstetricHistoryNotes(record.obstetricHistoryNotes);

      // Previous Abnormalities auto-jump
      if (record.previousAbnormalities) setPreviousAbnormalities(record.previousAbnormalities);

      // Delivery location & notes auto-jump
      if (record.plannedDeliveryLocation) setPlannedDeliveryLocation(record.plannedDeliveryLocation);
      if (record.notes) setNotes(record.notes);
      if (record.edd) {
        setEdd(record.edd);
        const calcGA = calculateGAFromEDD(record.edd);
        setGaClin(calcGA);
      } else {
        setEdd('');
        setGaClin('');
      }
      if (record.firstVisitDate) setFirstVisitDate(record.firstVisitDate);
    } else {
      setIsExistingPatient(false);
      setMatchedRecord(null);
    }
  };

  // Flexible DOB Handler supporting ddmmyyyy, ddmmyy, or dd/mm/yyyy with auto-slashes & age calculation
  const handleDobChange = (rawVal: string) => {
    setDob(rawVal);
    const digits = rawVal.replace(/\D/g, '');
    let formatted = rawVal;
    let derivedYear = '';

    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      formatted = `${d}/${m}/${y}`;
      derivedYear = y;
      setDob(formatted);
    } else if (digits.length === 6 && !rawVal.includes('/')) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const yy = parseInt(digits.slice(4, 6), 10);
      const currentYY = new Date().getFullYear() % 100;
      const fullYear = yy > currentYY ? 1900 + yy : 2000 + yy;
      formatted = `${d}/${m}/${fullYear}`;
      derivedYear = String(fullYear);
      setDob(formatted);
    } else {
      const parts = rawVal.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        derivedYear = parts[2];
      } else if (digits.length === 4 && parseInt(digits, 10) > 1930) {
        derivedYear = digits;
      }
    }

    if (derivedYear) {
      setYearOfBirth(derivedYear);
      const yNum = parseInt(derivedYear, 10);
      if (!isNaN(yNum) && yNum > 1930) {
        setAge(String(new Date().getFullYear() - yNum));
      }
    }
  };

  // Derive age when year of birth changes
  const handleYearChange = (yStr: string) => {
    setYearOfBirth(yStr);
    const y = parseInt(yStr, 10);
    if (!isNaN(y) && y > 1930) {
      setAge(String(new Date().getFullYear() - y));
    }
  };

  // Flexible EDD Handler supporting ddmmyyyy, ddmmyy, or dd/mm/yyyy with auto-slashes & gestational age calculation
  const handleEddChange = (rawVal: string) => {
    setEdd(rawVal);
    const digits = rawVal.replace(/\D/g, '');
    let formatted = rawVal;

    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      formatted = `${d}/${m}/${y}`;
      setEdd(formatted);
    } else if (digits.length === 6 && !rawVal.includes('/')) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const yy = parseInt(digits.slice(4, 6), 10);
      const currentYY = new Date().getFullYear() % 100;
      const fullYear = yy > currentYY ? 1900 + yy : 2000 + yy;
      formatted = `${d}/${m}/${fullYear}`;
      setEdd(formatted);
    }

    // Calculate gestational age from EDD
    const calculatedGA = calculateGAFromEDD(formatted);
    setGaClin(calculatedGA);
  };

  // Reset form for fresh intake ("Lấy thông tin lần đầu")
  const handleResetForm = () => {
    setPatientIdInput('');
    setName('');
    setDob('');
    setYearOfBirth('');
    setAge('');
    setPhone('');
    setAddress('');
    setGravida('1');
    setPara('0');
    setAbortion('0');
    setEctopic('0');
    setObstetricHistoryNotes('');
    setHeight('');
    setWeight('');
    setBloodPressure('');
    setPulse('');
    setPreviousAbnormalities('');
    setPlannedDeliveryLocation('');
    setNotes('');
    setEdd('');
    setGaClin('');
    setFirstVisitDate(new Date().toLocaleDateString('vi-VN'));
    setIsExistingPatient(false);
    setMatchedRecord(null);
    showToast('Đã làm mới form tiếp đón. Sẵn sàng nhập thông tin bệnh nhân mới.');
  };

  // Calculate patient visit statistics from history + directory records
  const getPatientExamsFromHistory = () => {
    if (!patientIdInput) return [];
    const cleanId = patientIdInput.replace(/[\s\.\-_]/g, '').trim();
    return (historyRecords || []).filter((rec) => {
      const recId = rec.patient?.patientId?.replace(/[\s\.\-_]/g, '').trim();
      const recPhone = rec.patient?.phone?.replace(/[\s\.\-_]/g, '').trim();
      return recId === cleanId || recPhone === cleanId;
    });
  };

  const patientExams = getPatientExamsFromHistory();
  const totalVisitCount = Math.max(patientExams.length, matchedRecord?.visitCount || (isExistingPatient ? 1 : 0));
  const latestExam = patientExams.length > 0 ? patientExams[0] : null;

  // Save profile to Patient Directory and update report
  const handleSaveReceptionProfile = () => {
    if (!patientIdInput || !name) {
      alert('Vui lòng nhập Mã bệnh nhân/SĐT và Họ tên bệnh nhân trước khi lưu!');
      return;
    }

    const cleanName = formatPatientVietnameseName(name, patientIdInput);
    setName(cleanName);

    const parsedHeight = height !== '' && height !== null ? parseFloat(String(height)) : null;
    const parsedWeight = weight !== '' && weight !== null ? parseFloat(String(weight)) : null;
    const parsedPulse = pulse !== '' && pulse !== null ? parseInt(String(pulse), 10) : null;

    const recordToSave: PatientDirectoryRecord = {
      id: patientIdInput.trim(),
      name: cleanName,
      dob: dob,
      yearOfBirth: yearOfBirth,
      phone: phone || patientIdInput,
      address: address,
      gender: gender,
      height: parsedHeight,
      weight: parsedWeight,
      bloodPressure: bloodPressure.trim(),
      pulse: parsedPulse,
      edd: edd,
      gaClin: gaClin,
      gravida: gravida,
      para: para,
      abortion: abortion,
      ectopic: ectopic,
      obstetricHistoryNotes: obstetricHistoryNotes,
      previousAbnormalities: previousAbnormalities,
      plannedDeliveryLocation: plannedDeliveryLocation,
      notes: notes,
      firstVisitDate: firstVisitDate,
      visitCount: totalVisitCount > 0 ? totalVisitCount : 1,
      lastExamDate: latestExam ? latestExam.patient.examDate : new Date().toLocaleDateString('vi-VN'),
      lastGa: latestExam ? (latestExam.patient.gaClin || latestExam.patient.gaAua) : (gaClin || ''),
      lastConclusion: latestExam ? latestExam.conclusion : '',
    };

    savePatientToDirectory(recordToSave);

    // Update current active report
    const updatedPatientInfo: PatientInfo = {
      ...currentReport.patient,
      patientId: patientIdInput.trim(),
      name: cleanName,
      dob: dob,
      yearOfBirth: yearOfBirth,
      age: age,
      phone: phone || patientIdInput,
      address: address,
      gender: gender,
      height: parsedHeight,
      weight: parsedWeight,
      bloodPressure: bloodPressure.trim(),
      pulse: parsedPulse,
      edd: edd,
      gaClin: gaClin,
      gravida: gravida,
      para: para,
      abortion: abortion,
      ectopic: ectopic,
      obstetricHistoryNotes: obstetricHistoryNotes,
      previousAbnormalities: previousAbnormalities,
      plannedDeliveryLocation: plannedDeliveryLocation,
      notes: notes,
      firstVisitDate: firstVisitDate,
      visitCount: totalVisitCount > 0 ? totalVisitCount : 1,
    };

    onUpdateReport({
      ...currentReport,
      patient: updatedPatientInfo,
    });

    setIsExistingPatient(true);
    setMatchedRecord(recordToSave);
    showToast(`Đã lưu hồ sơ tiếp đón bệnh nhân ${cleanName} vào danh mục phòng khám!`);
  };

  // Start new ultrasound session and switch tab
  const handleStartExamAndSwitch = (targetTab: 'ocr_ge' | 'form_editor') => {
    handleSaveReceptionProfile();
    onSwitchTab(targetTab);
    showToast(`Đã chuyển sang ${targetTab === 'ocr_ge' ? 'Tab Quét OCR' : 'Form Khám siêu âm'} cho bệnh nhân ${name}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Reception Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-900/40">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Hồ Sơ Tiếp Đón Bệnh Nhân Khi Đến Khám
              </h2>
              {isExistingPatient ? (
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Bệnh Nhân Tái Khám (Tự Động Nhảy)
                </span>
              ) : (
                <span className="bg-cyan-500/20 text-cyan-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-cyan-500/30 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Lấy Thông Tin Lần Đầu (BN Mới)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Nhập Số điện thoại/Mã BN $\rightarrow$ Hệ thống tự động nhảy thông tin đã lưu, cảnh báo bất thường lần khám trước & thống kê lượt khám.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetForm}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
            title="Xóa form để tiếp đón bệnh nhân mới"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tiếp Đón BN Mới</span>
          </button>

          <button
            type="button"
            onClick={handleSaveReceptionProfile}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Hồ Sơ Tiếp Đón</span>
          </button>

          <button
            type="button"
            onClick={() => handleStartExamAndSwitch('ocr_ge')}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Mở Ca Khám (Tab OCR)</span>
          </button>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Administrative & Obstetrical History */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Administrative Info & ID Lookup */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>1. Thông Tin Hành Chính & Định Danh</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Nhập ID/SĐT để tự nhảy thông tin cũ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Patient ID / Phone Lookup Input */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-cyan-400 mb-1 flex items-center gap-1">
                  <span>Mã Bệnh Nhân / SĐT *</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 rounded font-mono border border-cyan-800">
                    Tự nhảy
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientIdInput}
                    onChange={(e) => handleIdChange(e.target.value)}
                    placeholder="Nhập SĐT hoặc Mã BN..."
                    className="w-full bg-[#0b0f19] border-2 border-cyan-600/70 text-white text-sm font-bold rounded-xl px-3.5 py-2 pl-9 focus:outline-none focus:border-cyan-400 shadow-inner"
                  />
                  <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Họ và Tên Bệnh Nhân *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setName(formatPatientVietnameseName(name, patientIdInput))}
                  placeholder="Ví dụ: NGUYỄN THỊ THU HƯƠNG"
                  className="w-full bg-[#0b0f19] border border-slate-700 text-white font-semibold text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>

              {/* Date of Birth / Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ngày sinh
                </label>
                <input
                  type="text"
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  placeholder="dd/mm/yyyy (hoặc ddmmyyyy, ddmmyy)"
                  className="w-full bg-[#0b0f19] border border-slate-700 text-white text-sm rounded-xl px-3.5 py-2 text-center focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tuổi
                </label>
                <input
                  type="text"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Tuổi"
                  className="w-full bg-[#0b0f19] border border-slate-700 text-cyan-300 font-bold text-sm rounded-xl px-3 py-2 text-center"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số Điện Thoại Liên Hệ
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="098..."
                  className="w-full bg-[#0b0f19] border border-slate-700 text-white text-sm rounded-xl px-3.5 py-2 font-mono"
                />
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Địa Chỉ Thường Trú
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ví dụ: Quận Cầu Giấy, Hà Nội"
                  className="w-full bg-[#0b0f19] border border-slate-700 text-white text-sm rounded-xl px-3.5 py-2"
                />
              </div>

              {/* First Visit Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ngày Đăng Ký Lần Đầu
                </label>
                <input
                  type="text"
                  value={firstVisitDate}
                  onChange={(e) => setFirstVisitDate(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-700 text-slate-400 text-sm rounded-xl px-3 py-2 text-center font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 1.5: Current Pregnancy Info */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>1.5. Thông Tin Thai Kỳ Hiện Tại</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Tự động tính tuổi thai từ ngày dự sinh
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Expected Date of Delivery (EDD) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <span>Ngày Dự Kiến Sinh (EDD)</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 rounded font-mono border border-cyan-800">
                    Tự tính tuần
                  </span>
                </label>
                <input
                  type="text"
                  value={edd}
                  onChange={(e) => handleEddChange(e.target.value)}
                  placeholder="dd/mm/yyyy (hoặc ddmmyyyy, ddmmyy)"
                  className="w-full bg-[#0b0f19] border border-slate-700 text-white font-semibold text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-cyan-500 font-mono text-center"
                />
              </div>

              {/* Gestational Age (GA) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tuổi Thai Hiện Tại (Tính từ ngày dự sinh)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={gaClin}
                    readOnly
                    placeholder="Nhập ngày dự sinh để tự tính..."
                    className="w-full bg-[#0b0f19]/60 border border-slate-800 text-cyan-300 font-bold text-sm rounded-xl px-3.5 py-2 text-center font-medium"
                  />
                  {gaClin && (
                    <span className="absolute right-3 top-2.5 text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-900/50">
                      Đã tính
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1.7: Vital Signs (Chiều Cao, Cân Nặng, Huyết Áp & Mạch) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-cyan-400" />
                <span>1.7. Chỉ Số Sinh Tồn & Thể Trạng (Vital Signs)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Tự động tính chỉ số BMI & cảnh báo huyết áp
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Height */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Chiều Cao (cm)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    placeholder="VD: 158"
                    value={height ?? ''}
                    onChange={(e) => setHeight(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full bg-[#0b0f19] border border-slate-700 text-white font-bold text-sm rounded-xl px-3 py-2 pr-10 text-right focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                    cm
                  </span>
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Cân Nặng (kg)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="VD: 54.5"
                    value={weight ?? ''}
                    onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full bg-[#0b0f19] border border-slate-700 text-white font-bold text-sm rounded-xl px-3 py-2 pr-10 text-right focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                    kg
                  </span>
                </div>
              </div>

              {/* Blood Pressure */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  <span>Huyết Áp (mmHg)</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 120/80"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-700 text-white font-bold text-sm rounded-xl px-3 py-2 text-center focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Pulse */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                  <span>Mạch (lần/phút)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="VD: 78"
                    value={pulse ?? ''}
                    onChange={(e) => setPulse(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full bg-[#0b0f19] border border-slate-700 text-white font-bold text-sm rounded-xl px-3 py-2 pr-12 text-right focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-slate-500 font-mono pointer-events-none">
                    bpm
                  </span>
                </div>
              </div>
            </div>

            {/* Calculated BMI & Blood Pressure Status Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* BMI Card */}
              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Chỉ số thể trạng (BMI)</span>
                  {height && weight ? (
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-lg font-mono font-extrabold text-white">
                        {calculateBMIValue(height, weight)}
                      </span>
                      <span className="text-xs text-slate-400">kg/m²</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Nhập chiều cao & cân nặng</span>
                  )}
                </div>

                {height && weight && calculateBMIValue(height, weight) ? (
                  (() => {
                    const bmiVal = calculateBMIValue(height, weight)!;
                    const info = getBMILabel(bmiVal);
                    return (
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${info.badge}`}>
                        {info.label}
                      </span>
                    );
                  })()
                ) : null}
              </div>

              {/* Blood Pressure Evaluation Status */}
              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Đánh giá Huyết áp</span>
                  {bloodPressure ? (
                    <span className="text-sm font-mono font-bold text-cyan-300 block mt-0.5">
                      {bloodPressure} mmHg
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Chưa có chỉ số HA</span>
                  )}
                </div>

                {bloodPressure ? (
                  (() => {
                    const evalRes = evaluateBP(bloodPressure);
                    if (evalRes?.isHigh) {
                      return (
                        <span className="text-xs px-2 py-1 rounded-lg font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          HA Cao (Cần lưu ý)
                        </span>
                      );
                    }
                    if (evalRes?.isLow) {
                      return (
                        <span className="text-xs px-2 py-1 rounded-lg font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          HA Thấp
                        </span>
                      );
                    }
                    if (evalRes?.isNormal) {
                      return (
                        <span className="text-xs px-2 py-1 rounded-lg font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Bình thường
                        </span>
                      );
                    }
                    return null;
                  })()
                ) : null}
              </div>
            </div>
          </div>

          {/* SECTION 2: Obstetrical History (Para & Tiền Sử) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Baby className="w-4 h-4" />
                <span>2. Lịch Sử Sản Khoa (Para & Tiền Sử Bệnh Lý)</span>
              </h3>
              <span className="text-[11px] text-slate-400">Chỉ số Tiền sử sản phụ khoa</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 text-center">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Gravida (Mang thai)
                </label>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-cyan-400 font-bold text-base">G</span>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={gravida}
                    onChange={(e) => setGravida(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-700 text-white text-center font-bold text-base rounded-lg py-1"
                  />
                </div>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 text-center">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Para (Sinh con)
                </label>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-cyan-400 font-bold text-base">P</span>
                  <input
                    type="text"
                    value={para}
                    onChange={(e) => setPara(e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 text-white text-center font-bold text-base rounded-lg py-1"
                  />
                </div>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 text-center">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Sảy / Hút thai (A)
                </label>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-amber-400 font-bold text-base">A</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={abortion}
                    onChange={(e) => setAbortion(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-700 text-white text-center font-bold text-base rounded-lg py-1"
                  />
                </div>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 text-center">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Thai ngoài TC (E)
                </label>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-rose-400 font-bold text-base">E</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={ectopic}
                    onChange={(e) => setEctopic(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-700 text-white text-center font-bold text-base rounded-lg py-1"
                  />
                </div>
              </div>
            </div>

            {/* Detailed Obstetric History Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Chi Tiết Tiền Sử Sản / Phụ Khoa (Mổ đẻ cũ, IVF, bệnh nền...)
              </label>
              <textarea
                rows={2}
                value={obstetricHistoryNotes}
                onChange={(e) => setObstetricHistoryNotes(e.target.value)}
                placeholder="Ví dụ: Tiền sử mổ đẻ cũ năm 2021, vết mổ dọc. Thai IVF chuyển phôi ngày..."
                className="w-full bg-[#0b0f19] border border-slate-700 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* SECTION 3: PREVIOUS ABNORMALITIES (HIGHLIGHTED ALERT BANNER) */}
          <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-rose-950/30 border-2 border-amber-500/60 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-300 tracking-wide flex items-center gap-1.5">
                    <span>LẦN KHÁM TRƯỚC CÓ BẤT THƯỜNG GÌ KHÔNG</span>
                  </h3>
                  <p className="text-[11px] text-amber-200/80">
                    Nổi bật cảnh báo bất thường lần siêu âm trước để Bác sĩ lưu ý khi khám
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Preset Tags */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">
                Gợi ý nhanh bất thường thường gặp:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ABNORMALITIES.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!previousAbnormalities) {
                        setPreviousAbnormalities(tag);
                      } else if (!previousAbnormalities.includes(tag)) {
                        setPreviousAbnormalities((prev) => `${prev}; ${tag}`);
                      }
                    }}
                    className="text-[11px] bg-slate-900/90 hover:bg-amber-950 text-amber-200 border border-amber-700/60 hover:border-amber-400 px-2.5 py-1 rounded-lg transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Highlighted Alert Textarea */}
            <div className="relative">
              <textarea
                rows={3}
                value={previousAbnormalities}
                onChange={(e) => setPreviousAbnormalities(e.target.value)}
                placeholder="Ví dụ: Rau bám thấp mặt sau nhóm I. Đa ối nhẹ (AFI 210mm). Dây rốn quấn cổ 2 vòng..."
                className="w-full bg-[#0b0f19] border-2 border-amber-500/70 text-amber-100 font-medium text-xs sm:text-sm rounded-xl p-3.5 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 shadow-inner"
              />
              {previousAbnormalities && (
                <div className="mt-2 p-2.5 bg-amber-900/30 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <strong>Cảnh báo hiển thị trên kết quả siêu âm:</strong> {previousAbnormalities}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviousAbnormalities('')}
                    className="text-[10px] underline text-amber-400 hover:text-amber-200"
                  >
                    Xóa cảnh báo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Delivery Location, Notes & Visit Statistics */}
        <div className="space-y-6">
          {/* SECTION 4: Planned Delivery Location & Additional Notes */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>3. Dự Định Sinh Ở Đâu & Ghi Chú</span>
              </h3>
            </div>

            {/* Planned Delivery Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Dự Định Sinh Ở Đâu (Tỉnh / Bệnh viện sinh)
              </label>
              <input
                type="text"
                value={plannedDeliveryLocation}
                onChange={(e) => setPlannedDeliveryLocation(e.target.value)}
                placeholder="Ví dụ: Bệnh viện Phụ sản Hà Nội"
                className="w-full bg-[#0b0f19] border border-slate-700 text-white text-sm rounded-xl px-3.5 py-2 mb-2 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_HOSPITALS.slice(0, 8).map((hosp) => (
                  <button
                    key={hosp}
                    type="button"
                    onClick={() => setPlannedDeliveryLocation(hosp)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
                  >
                    {hosp.replace('Bệnh viện ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mục Ghi Chú Khác (Yêu cầu riêng, dị ứng, liên hệ)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú thêm từ lễ tân tiếp đón..."
                className="w-full bg-[#0b0f19] border border-slate-700 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* SECTION 5: CLINIC VISIT STATISTICS & EXAM HISTORY */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>4. Thống Kê Thăm Khám Tại Phòng Khám</span>
              </h3>
              <span className="text-[11px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-bold font-mono">
                {totalVisitCount} Lượt Khám
              </span>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Tổng số lần khám</span>
                <span className="text-xl font-extrabold text-cyan-400">{totalVisitCount} <span className="text-xs font-normal text-slate-400">lần</span></span>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Lần đầu tiếp đón</span>
                <span className="text-xs font-semibold text-white truncate block">{firstVisitDate || '---'}</span>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 col-span-2">
                <span className="text-[10px] text-slate-400 block">Lần khám gần nhất</span>
                {latestExam ? (
                  <div className="text-xs text-slate-200 mt-0.5 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-bold text-cyan-300">{latestExam.patient.examDate}</span>
                      <span className="text-amber-300 font-mono">{latestExam.patient.gaClin || latestExam.patient.gaAua || 'Chưa rõ GA'}</span>
                    </div>
                    {latestExam.efw?.value && (
                      <p className="text-[11px] text-slate-400">EFW: <strong className="text-white">{latestExam.efw.value}g</strong> ({latestExam.efw.percentile || ''})</p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">Chưa có dữ liệu siêu âm trong hệ thống</span>
                )}
              </div>
            </div>

            {/* Past Exam History Timeline List */}
            {patientExams.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Lịch sử các ca siêu âm tại phòng khám ({patientExams.length})</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {patientExams.map((ex, idx) => (
                    <div
                      key={ex.id || idx}
                      onClick={() => {
                        onUpdateReport(ex);
                        onSwitchTab('form_editor');
                        showToast(`Đã mở phiếu ngày ${ex.patient.examDate}`);
                      }}
                      className="bg-[#0b0f19] hover:bg-slate-800/80 border border-slate-800 p-2.5 rounded-xl text-xs cursor-pointer transition flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{ex.patient.examDate}</span>
                          <span className="text-[10px] bg-slate-800 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                            {ex.patient.gaClin || ex.patient.gaAua || 'Thai'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5">
                          {ex.conclusion || 'Siêu âm thai'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
