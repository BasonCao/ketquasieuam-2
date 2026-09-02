import React from 'react';
import {
  Activity,
  WifiOff,
  Printer,
  History,
  BookOpen,
  PlusCircle,
  Sparkles,
  Layers,
  ChevronDown,
  HardDrive,
  FolderCheck,
} from 'lucide-react';
import { SAMPLE_CASES } from '../data/sampleCases';
import { UltrasoundReport } from '../types/ultrasound';

interface HeaderProps {
  isOfflineMode: boolean;
  onToggleOfflineMode: (offline: boolean) => void;
  onNewReport: () => void;
  onOpenPrint: () => void;
  onOpenHistory: () => void;
  onOpenReference: () => void;
  onOpenPcStorageSettings: () => void;
  onLoadSample: (sampleData: Partial<UltrasoundReport>) => void;
  currentPatientName?: string;
  pcDirectoryName?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  isOfflineMode,
  onToggleOfflineMode,
  onNewReport,
  onOpenPrint,
  onOpenHistory,
  onOpenReference,
  onOpenPcStorageSettings,
  onLoadSample,
  currentPatientName,
  pcDirectoryName,
}) => {
  const [showSampleDropdown, setShowSampleDropdown] = React.useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Software Name */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-inner shadow-cyan-300/30">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1">
                  SONO<span className="text-cyan-400">REPORT</span> AI
                </h1>
                <span className="bg-cyan-500/20 text-cyan-300 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium border border-cyan-500/30">
                  v3.8 Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Hệ thống tự động lọc chỉ số siêu âm & Đánh kết quả chuẩn y khoa
              </p>
            </div>
          </div>

          {/* Current Patient info */}
          {currentPatientName && (
            <div className="hidden lg:flex items-center px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <span className="text-slate-400 mr-1.5">Bệnh nhân:</span>
              <span className="font-semibold text-cyan-300 truncate max-w-[160px]">
                {currentPatientName}
              </span>
            </div>
          )}

          {/* Actions & Mode Selector */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Online / Offline Mode Toggle */}
            <button
              onClick={() => onToggleOfflineMode(!isOfflineMode)}
              className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isOfflineMode
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              }`}
              title={
                isOfflineMode
                  ? 'Đang dùng chế độ Offline OCR trên trình duyệt (Tesseract.js)'
                  : 'Đang dùng chế độ Online AI độ chính xác cao (Gemini 3.7)'
              }
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xl:inline">Chế độ</span> Offline
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden xl:inline">AI Online</span> Siêu Tốc
                </>
              )}
            </button>

            {/* PC Storage Directory Config Button */}
            <button
              onClick={onOpenPcStorageSettings}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                pcDirectoryName
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={
                pcDirectoryName
                  ? `Đang lưu tự động vào PC: ${pcDirectoryName}/[SĐT_BN]/`
                  : 'Chọn thư mục lưu gốc trên PC để tự động tạo thư mục theo SĐT'
              }
            >
              {pcDirectoryName ? (
                <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {pcDirectoryName ? `📁 ${pcDirectoryName}` : 'Thư mục PC'}
              </span>
            </button>

            {/* Sample Cases Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSampleDropdown(!showSampleDropdown)}
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xl:inline">Ca mẫu</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showSampleDropdown && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2"
                  onMouseLeave={() => setShowSampleDropdown(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 mb-1">
                    Dữ liệu mẫu từ 7 ảnh thực tế
                  </div>
                  {SAMPLE_CASES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onLoadSample(s.data);
                        setShowSampleDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700/70 transition flex flex-col group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                          {s.patientName}
                        </span>
                        <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800">
                          {s.ga}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reference Table */}
            <button
              onClick={onOpenReference}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Bảng tra cứu chuẩn sinh trắc học & Doppler"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden xl:inline ml-1">Tra cứu chuẩn</span>
            </button>

            {/* History */}
            <button
              onClick={onOpenHistory}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Tra cứu lịch sử khám bệnh nhân"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline ml-1">Lịch sử</span>
            </button>

            {/* New Report */}
            <button
              onClick={onNewReport}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 transition"
              title="Tạo mới phiếu siêu âm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline ml-1">Tạo mới</span>
            </button>

            {/* Print / Export PDF Report */}
            <button
              onClick={onOpenPrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition active:scale-95"
              title="Xuất file PDF hoặc In phiếu kết quả trực tiếp"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Xuất PDF / In</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
