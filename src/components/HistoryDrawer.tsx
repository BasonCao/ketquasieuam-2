import React, { useState, useMemo } from 'react';
import {
  History,
  X,
  Search,
  Trash2,
  Download,
  Eye,
  FileText,
  Calendar,
  User,
  Phone,
  Layers,
  Baby,
  Activity,
  ArrowRight,
  TrendingUp,
  UserCheck,
  PlusCircle,
  Clock,
  Sparkles,
  Printer,
  ChevronRight,
  CheckCircle2,
  FolderDown,
} from 'lucide-react';
import { UltrasoundReport } from '../types/ultrasound';
import { parseGestationalAgeWeeks } from '../data/formTemplates';

interface HistoryDrawerProps {
  records: UltrasoundReport[];
  onSelectRecord: (report: UltrasoundReport) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onNewExamForPatient: (patientInfo: UltrasoundReport['patient']) => void;
  onQuickPrintRecord?: (report: UltrasoundReport) => void;
  onClose: () => void;
}

type FilterAgeTab = 'all' | '<12w' | '12-13w6d' | '14-32w' | '>32w';

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  records,
  onSelectRecord,
  onDeleteRecord,
  onClearAll,
  onNewExamForPatient,
  onQuickPrintRecord,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgeTab, setSelectedAgeTab] = useState<FilterAgeTab>('all');
  const [viewMode, setViewMode] = useState<'timeline_by_patient' | 'flat_list'>('timeline_by_patient');
  const [selectedPatientKey, setSelectedPatientKey] = useState<string | null>(null);

  // Normalize string for accent-free search
  const normalize = (str: string = '') =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Filtered flat records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const term = normalize(searchTerm);
      const nameMatch = normalize(r.patient.name).includes(term);
      const idMatch = normalize(r.patient.patientId).includes(term);
      const phoneMatch = (r.patient.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
      const dateMatch = (r.patient.examDate || '').includes(term);
      const gaMatch = normalize(r.patient.gaClin || r.patient.gaAua || '').includes(term);

      const matchesSearch = !term || nameMatch || idMatch || phoneMatch || dateMatch || gaMatch;
      if (!matchesSearch) return false;

      if (selectedAgeTab === 'all') return true;

      const gaParsed = parseGestationalAgeWeeks(r.patient.gaClin || r.patient.gaAua);
      const weeks = gaParsed?.totalWeeks || 0;

      if (selectedAgeTab === '<12w') return weeks > 0 && weeks < 12.0;
      if (selectedAgeTab === '12-13w6d') return weeks >= 12.0 && weeks < 14.0;
      if (selectedAgeTab === '14-32w') return weeks >= 14.0 && weeks <= 32.0;
      if (selectedAgeTab === '>32w') return weeks > 32.0;

      return true;
    });
  }, [records, searchTerm, selectedAgeTab]);

  // Group records by unique patient (Key: Phone or PatientId or Clean Name)
  const patientGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        patientKey: string;
        latestPatient: UltrasoundReport['patient'];
        records: UltrasoundReport[];
      }
    >();

    (records || []).forEach((rec) => {
      if (!rec || !rec.patient) return;
      const phoneClean = (rec.patient.phone || '').trim().replace(/\D/g, '');
      const key = phoneClean
        ? `phone_${phoneClean}`
        : rec.patient.patientId?.trim()
        ? `id_${rec.patient.patientId.trim()}`
        : `name_${normalize(rec.patient.name || 'chua_co_ten')}`;

      if (!map.has(key)) {
        map.set(key, {
          patientKey: key,
          latestPatient: rec.patient,
          records: [],
        });
      }

      map.get(key)!.records.push(rec);
    });

    // Sort records inside each patient group by gestational age / date
    map.forEach((group) => {
      group.records.sort((a, b) => {
        const gaA = parseGestationalAgeWeeks(a.patient?.gaClin || a.patient?.gaAua)?.totalWeeks || 0;
        const gaB = parseGestationalAgeWeeks(b.patient?.gaClin || b.patient?.gaAua)?.totalWeeks || 0;
        if (gaA !== gaB) return gaA - gaB;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
    });

    return Array.from(map.values()).filter((group) => {
      if (!searchTerm) return true;
      const term = normalize(searchTerm);
      const nameMatch = normalize(group.latestPatient?.name || '').includes(term);
      const phoneMatch = (group.latestPatient?.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
      const idMatch = normalize(group.latestPatient?.patientId || '').includes(term);
      return nameMatch || phoneMatch || idMatch;
    });
  }, [records, searchTerm]);

  // Export JSON backup
  const exportToJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lich_su_kham_sieu_am_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-end backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-2xl h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Tra Cứu Lịch Sử Khám Bệnh Nhân</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full font-mono">
                  {records.length} hồ sơ
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Tìm kiếm theo SĐT, Tên, Mã BN & Theo dõi tiến trình thai kỳ qua các tuần
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Mode Switcher */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="🔍 Gõ Số Điện Thoại (SĐT), Họ tên sản phụ, Mã BN, Tuần thai..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs bg-slate-800 rounded px-1.5 py-0.5"
              >
                Xóa
              </button>
            )}
          </div>

          {/* View Mode & Filter Age Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('timeline_by_patient')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'timeline_by_patient'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                👥 Theo Từng Bệnh Nhân ({patientGroups.length})
              </button>
              <button
                onClick={() => setViewMode('flat_list')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'flat_list'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 Tất Cả Ca Khám ({filteredRecords.length})
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              {records.length > 0 && (
                <>
                  <button
                    onClick={exportToJson}
                    className="text-slate-300 hover:text-cyan-300 flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px]"
                    title="Xuất file sao lưu JSON"
                  >
                    <Download className="w-3 h-3" /> Xuất File
                  </button>
                  <button
                    onClick={onClearAll}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-950/50 hover:bg-rose-950 px-2.5 py-1 rounded-lg border border-rose-800/50 text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" /> Xóa tất cả
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Age Bracket Filter Chips (for flat list) */}
          {viewMode === 'flat_list' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] scrollbar-none">
              <span className="text-slate-500 shrink-0 font-medium">Lọc tuần:</span>
              {[
                { id: 'all', label: 'Tất cả' },
                { id: '<12w', label: 'Thai < 12w' },
                { id: '12-13w6d', label: 'Thai 12-13w6d' },
                { id: '14-32w', label: 'Thai 14-32w' },
                { id: '>32w', label: 'Thai > 32w' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedAgeTab(tab.id as FilterAgeTab)}
                  className={`px-2.5 py-0.5 rounded-full whitespace-nowrap transition border ${
                    selectedAgeTab === tab.id
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {(records || []).length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6">
              <FileText className="w-10 h-10 text-slate-600 mb-2" />
              <span className="font-bold text-slate-400 text-sm">Chưa có hồ sơ khám nào được lưu</span>
              <span className="text-slate-500 text-xs mt-1 max-w-sm">
                Sau khi điền form hoặc quét ảnh siêu âm, bấm <b>"Lưu Phiếu"</b> hoặc <b>"Xuất File PDF"</b> để hệ thống tự động ghi nhận vào lịch sử khám.
              </span>
            </div>
          ) : viewMode === 'timeline_by_patient' ? (
            /* Mode 1: Grouped by Patient with Pregnancy Timeline */
            (patientGroups || []).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Không tìm thấy bệnh nhân nào khớp với từ khóa "{searchTerm}".
              </div>
            ) : (
              (patientGroups || []).map((group) => {
                const { patientKey, latestPatient, records: pRecords } = group;
                const isExpanded = selectedPatientKey === patientKey || (patientGroups || []).length === 1;

                return (
                  <div
                    key={patientKey}
                    className="bg-slate-800/80 border border-slate-700/90 rounded-2xl p-4 shadow-lg transition hover:border-slate-600 space-y-3"
                  >
                    {/* Patient Header Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                          {latestPatient?.name ? latestPatient.name.charAt(0).toUpperCase() : 'BN'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{latestPatient?.name || 'Bệnh nhân chưa đặt tên'}</span>
                            {latestPatient?.age && (
                              <span className="text-[11px] text-slate-400 font-normal">({latestPatient.age} tuổi)</span>
                            )}
                            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-semibold">
                              {(pRecords || []).length} lần siêu âm
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {latestPatient?.phone && (
                              <span className="flex items-center gap-1 text-amber-300 font-mono font-medium">
                                <Phone className="w-3 h-3 text-amber-400" />
                                {latestPatient.phone}
                              </span>
                            )}
                            {latestPatient?.patientId && (
                              <span>Mã BN: <b className="text-slate-300 font-mono">{latestPatient.patientId}</b></span>
                            )}
                            {latestPatient?.lmp && (
                              <span>Kinh cuối: {latestPatient.lmp}</span>
                            )}
                            {latestPatient?.edd && (
                              <span>Dự sinh: <b className="text-cyan-300">{latestPatient.edd}</b></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action for this patient */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onNewExamForPatient(latestPatient);
                            onClose();
                          }}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 text-xs font-bold transition"
                          title="Tạo lần khám mới giữ nguyên thông tin hành chính của bệnh nhân này"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Khám Lần Mới</span>
                        </button>
                      </div>
                    </div>

                    {/* Timeline of Pregnancy Exams */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Tiến Trình Phát Triển Thai Nhi Qua Các Tuần Khám:</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {(pRecords || []).map((rec, idx) => {
                          const gaParsed = parseGestationalAgeWeeks(rec.patient?.gaClin || rec.patient?.gaAua);
                          const gaLabel = rec.patient?.gaClin || rec.patient?.gaAua || `Lần ${idx + 1}`;

                          return (
                            <div
                              key={rec.id}
                              className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition"
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                                  #{idx + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-cyan-300">
                                      Tuần thai: {gaLabel}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      • Ngày khám: {rec.patient.examDate || new Date(rec.createdAt).toLocaleDateString('vi-VN')}
                                    </span>
                                  </div>

                                  {/* Key biometrics badges */}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
                                    {rec.efw.value && (
                                      <span className="bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded border border-blue-800/60 font-semibold">
                                        EFW: {rec.efw.value}g {rec.efw.percentile ? `(${rec.efw.percentile})` : ''}
                                      </span>
                                    )}
                                    {rec.measurements.crl.value && (
                                      <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/60">
                                        CRL: {rec.measurements.crl.value}mm
                                      </span>
                                    )}
                                    {rec.measurements.nt.value && (
                                      <span className="bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-800/60 font-semibold">
                                        NT: {rec.measurements.nt.value}mm
                                      </span>
                                    )}
                                    {rec.measurements.bpd.value && (
                                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                        BPD: {rec.measurements.bpd.value}mm
                                      </span>
                                    )}
                                    {rec.measurements.ac.value && (
                                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                        AC: {rec.measurements.ac.value}mm
                                      </span>
                                    )}
                                    {rec.measurements.fl.value && (
                                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                        FL: {rec.measurements.fl.value}mm
                                      </span>
                                    )}
                                    {rec.doppler.fhr.value && (
                                      <span className="bg-rose-950/80 text-rose-300 px-2 py-0.5 rounded border border-rose-800/60">
                                        Tim thai: {rec.doppler.fhr.value} bpm
                                      </span>
                                    )}
                                    {rec.amnioticFluid.afi.value && (
                                      <span className="bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/60">
                                        AFI: {rec.amnioticFluid.afi.value}mm
                                      </span>
                                    )}
                                  </div>

                                  {rec.conclusion && (
                                    <p className="text-[11px] text-slate-300 mt-1.5 line-clamp-1 italic text-slate-400">
                                      KL: {rec.conclusion}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Record Actions */}
                              <div className="flex items-center justify-end space-x-1.5 shrink-0 pt-1 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectRecord(rec);
                                    onClose();
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 shadow transition active:scale-95"
                                  title="Mở ca này vào form để xem hoặc sửa"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Mở xem</span>
                                </button>

                                {onQuickPrintRecord && (
                                  <button
                                    type="button"
                                    onClick={() => onQuickPrintRecord(rec)}
                                    className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 transition"
                                    title="In / Xuất file PDF ca này"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onDeleteRecord(rec.id)}
                                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950 transition"
                                  title="Xóa phiếu này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* Mode 2: Flat List of All Records */
            (filteredRecords || []).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Không tìm thấy ca khám nào khớp với bộ lọc.
              </div>
            ) : (
              (filteredRecords || []).map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-xl p-3.5 transition group flex flex-col justify-between space-y-2.5 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-white group-hover:text-cyan-300 transition flex items-center gap-2">
                        <span>{rec.patient?.name || 'Bệnh nhân chưa đặt tên'}</span>
                        {rec.patient?.phone && (
                          <span className="text-xs text-amber-300 font-mono font-normal">
                            ({rec.patient.phone})
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>Mã BN: <b className="text-slate-300 font-mono">{rec.patient?.patientId || '--'}</b></span>
                        {rec.patient?.gaClin && (
                          <span className="text-cyan-300 font-semibold">• GA: {rec.patient.gaClin}</span>
                        )}
                        {rec.efw?.value && (
                          <span className="text-blue-300">• EFW: {rec.efw.value}g</span>
                        )}
                        {rec.measurements?.nt?.value && (
                          <span className="text-amber-300">• NT: {rec.measurements.nt.value}mm</span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {rec.patient?.examDate || new Date(rec.createdAt || 0).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {rec.conclusion && (
                    <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      {rec.conclusion}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                    <div className="text-[11px] text-slate-500">
                      BS: {rec.patient?.sonographer || 'BS. CAO BÁ SƠN'}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRecord(rec);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Mở xem & Chỉnh sửa</span>
                      </button>

                      {onQuickPrintRecord && (
                        <button
                          type="button"
                          onClick={() => onQuickPrintRecord(rec)}
                          className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 transition"
                          title="In / Xuất PDF ca này"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDeleteRecord(rec.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950 transition"
                        title="Xóa phiếu này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
