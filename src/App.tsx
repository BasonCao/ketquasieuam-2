import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageScanner } from './components/ImageScanner';
import { UltrasoundForm } from './components/UltrasoundForm';
import { PrintReportModal } from './components/PrintReportModal';
import { ClinicalReferenceModal } from './components/ClinicalReferenceModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { PcFolderSettingsModal } from './components/PcFolderSettingsModal';
import { GeReportTab } from './components/GeReportTab';
import { PatientReceptionTab } from './components/PatientReceptionTab';
import { ManualEntryTab } from './components/ManualEntryTab';
import { ServicesTab } from './components/ServicesTab';
import { UltrasoundReport, PatientInfo, FetalWeightEFW, Measurements2D } from './types/ultrasound';
import { SAMPLE_CASES, EMPTY_REPORT } from './data/sampleCases';
import { calculateHadlockEFW, generateAutoConclusion } from './utils/clinicalCalculations';
import { FORM_TEMPLATES, detectBestTemplate, getTemplateForGestationalAge } from './data/formTemplates';
import { getSavedRootDirectory } from './utils/pcStorageService';
import { formatPatientVietnameseName, lookupPatientById, savePatientToDirectory } from './data/patientDirectory';
import { normalizeExtractedData } from './utils/normalizeReportData';
import { CheckCircle2, HardDrive, FolderCheck, Sparkles, FileText, LayoutTemplate, Scan, UserPlus, Keyboard } from 'lucide-react';

const STORAGE_KEY = 'sono_report_history_v1';

export function App() {
  const [report, setReport] = useState<UltrasoundReport>(() => {
    // Start with the comprehensive 15w4d case from the user's sample data
    const sample = SAMPLE_CASES[0];
    return {
      ...EMPTY_REPORT,
      ...sample.data,
      id: 'sample-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as UltrasoundReport;
  });

  const [history, setHistory] = useState<UltrasoundReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    // Seed with the user sample cases
    return (SAMPLE_CASES || []).map((s, idx) => ({
      ...EMPTY_REPORT,
      ...s.data,
      id: `sample-history-${idx}`,
      createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    })) as UltrasoundReport[];
  });

  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showPcSettingsModal, setShowPcSettingsModal] = useState(false);
  const [pcRootDirectoryHandle, setPcRootDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'reception' | 'ocr_ge' | 'form_editor' | 'manual_entry' | 'services'>('reception');

  // Restore saved PC Root Directory on mount if available
  useEffect(() => {
    getSavedRootDirectory().then((handle) => {
      if (handle) {
        setPcRootDirectoryHandle(handle);
      }
    });
  }, []);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }, [history]);

  const showToast = (message: string) => {
    setToastNotification(message);
    setTimeout(() => {
      setToastNotification(null);
    }, 4000);
  };

  // Handle Extraction Result from ImageScanner (either Online AI or Offline OCR)
  const handleExtractionComplete = (
    extracted: any,
    sourceImages: string[],
    mode: 'online_ai' | 'offline_ocr'
  ) => {
    // Reliably normalize and merge extracted measurements, aliases, demographics, and calculations
    const finalReport = normalizeExtractedData(extracted, report, sourceImages, mode);

    setReport(finalReport);
    setActiveWorkspaceTab('ocr_ge');
    
    // Find template name for toast notification
    const detectedTmpl = FORM_TEMPLATES.find((t) => t.id === finalReport.detectedCategory);
    const tmplName = detectedTmpl ? detectedTmpl.name : 'phiếu khám';

    showToast(
      mode === 'online_ai'
        ? `AI đã tự động trích xuất đầy đủ các chỉ số & điền vào tab bảng biểu OCR!`
        : `Đã hoàn tất quét Offline OCR & điền vào tab bảng biểu OCR!`
    );
  };

  // Load a sample case from the dropdown or quick selector
  const handleLoadSample = (sampleData: Partial<UltrasoundReport>) => {
    const newReport: UltrasoundReport = {
      ...EMPTY_REPORT,
      ...sampleData,
      id: 'case-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as UltrasoundReport;

    const detected = detectBestTemplate(newReport);
    newReport.detectedCategory = detected.template.id;

    // Set originalOcrData baseline for sample cases so comparison works instantly
    newReport.originalOcrData = {
      patient: {
        name: newReport.patient.name,
        patientId: newReport.patient.patientId,
        yearOfBirth: newReport.patient.yearOfBirth,
        lmp: newReport.patient.lmp,
        gaClin: newReport.patient.gaClin,
        edd: newReport.patient.edd,
      },
      measurements: Object.keys(newReport.measurements).reduce((acc, key) => {
        acc[key] = newReport.measurements[key as keyof Measurements2D]?.value ?? null;
        return acc;
      }, {} as Record<string, number | null>),
      efw: newReport.efw.value,
      fhr: newReport.doppler.fhr.value,
      uaPi: newReport.doppler.umbilicalArtery.pi ?? null,
      uaRi: newReport.doppler.umbilicalArtery.ri ?? null,
      mcaPi: newReport.doppler.middleCerebralArtery.pi ?? null,
      afi: newReport.amnioticFluid.afi.value ?? null,
    };

    setReport(newReport);
    setActiveWorkspaceTab('ocr_ge');
    showToast(`Đã tải dữ liệu mẫu: ${sampleData.patient?.name || 'Ca khám'}`);
  };

  // Create fresh report
  const handleNewReport = () => {
    setReport({
      ...EMPTY_REPORT,
      id: 'report-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast('Đã tạo phiếu siêu âm mới!');
  };

  // Create a new exam for a returning patient (preserve administrative info)
  const handleNewExamForPatient = (patientInfo: PatientInfo) => {
    setReport({
      ...EMPTY_REPORT,
      id: 'report-' + Date.now(),
      patient: {
        ...patientInfo,
        examDate: new Date().toLocaleDateString('vi-VN'),
        gaClin: '',
        gaAua: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast(`Đã mở ca khám mới cho bệnh nhân ${patientInfo.name}!`);
  };

  // Save current report to local history
  const handleSaveToHistory = () => {
    const existingIndex = history.findIndex((h) => h.id === report.id);
    let updatedHistory: UltrasoundReport[];
    if (existingIndex >= 0) {
      updatedHistory = [...history];
      updatedHistory[existingIndex] = { ...report, updatedAt: new Date().toISOString() };
    } else {
      updatedHistory = [{ ...report, updatedAt: new Date().toISOString() }, ...history];
    }
    setHistory(updatedHistory);
    showToast('Đã lưu phiếu kết quả vào lịch sử thành công!');
  };

  // Delete a record from history
  const handleDeleteRecord = (id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    showToast('Đã xóa phiếu khám khỏi lịch sử.');
  };

  // Clear all history
  const handleClearAllHistory = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đã lưu không?')) {
      setHistory([]);
      showToast('Đã xóa toàn bộ lịch sử.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Main Navigation Header */}
      <Header
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={setIsOfflineMode}
        onNewReport={handleNewReport}
        onOpenPrint={() => setShowPrintModal(true)}
        onOpenHistory={() => setShowHistoryDrawer(true)}
        onOpenReference={() => setShowReferenceModal(true)}
        onOpenPcStorageSettings={() => setShowPcSettingsModal(true)}
        onLoadSample={handleLoadSample}
        currentPatientName={report.patient.name}
        pcDirectoryName={pcRootDirectoryHandle?.name}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast Notification Alert */}
        {toastNotification && (
          <div className="fixed bottom-6 right-6 z-50 bg-cyan-950 border border-cyan-400/50 text-cyan-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium animate-in slide-in-from-bottom-5">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>{toastNotification}</span>
          </div>
        )}

        {/* PC Storage Directory Banner Notification if not yet configured */}
        {!pcRootDirectoryHandle && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span>Tự Động Lưu Kết Quả PDF Vào Thư Mục Bệnh Nhân Trên PC</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
                    Mới
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Chọn thư mục lưu gốc 1 lần trên máy tính $\rightarrow$ Hệ thống tự động tạo thư mục riêng theo <b>Số Điện Thoại</b> của sản phụ và lưu file PDF theo <b>Tuần thai</b>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPcSettingsModal(true)}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow transition shrink-0"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Chọn Thư Mục Lưu Gốc Trên PC</span>
            </button>
          </div>
        )}

        {/* Workspace Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveWorkspaceTab('reception')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
              activeWorkspaceTab === 'reception'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4 text-cyan-300" />
            <span>Tab Tiếp Đón Bệnh Nhân</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('ocr_ge')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
              activeWorkspaceTab === 'ocr_ge'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>Tab Quét Ảnh & OCR GE Voluson</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('form_editor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
              activeWorkspaceTab === 'form_editor'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-300" />
            <span>Form Chỉnh Sửa & Khám</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('manual_entry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
              activeWorkspaceTab === 'manual_entry'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Keyboard className="w-4 h-4 text-cyan-300" />
            <span>Tab Nhập Thủ Công</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('services')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
              activeWorkspaceTab === 'services'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-300" />
            <span>Tab Dịch Vụ</span>
          </button>
        </div>

        {/* Tab Content Views */}
        {activeWorkspaceTab === 'reception' && (
          <PatientReceptionTab
            currentReport={report}
            onUpdateReport={setReport}
            onSwitchTab={setActiveWorkspaceTab}
            historyRecords={history}
            showToast={showToast}
          />
        )}

        {activeWorkspaceTab === 'ocr_ge' && (
          <GeReportTab
            report={report}
            onChange={setReport}
            onLoadOcrCase={() => handleLoadSample(SAMPLE_CASES[0].data)}
            isOfflineMode={isOfflineMode}
            showToast={showToast}
          />
        )}

        {activeWorkspaceTab === 'form_editor' && (
          <UltrasoundForm
            report={report}
            onChange={setReport}
            onSaveToHistory={handleSaveToHistory}
            onOpenPrint={() => setShowPrintModal(true)}
          />
        )}

        {activeWorkspaceTab === 'manual_entry' && (
          <ManualEntryTab
            report={report}
            onChange={setReport}
            onSwitchTab={setActiveWorkspaceTab}
            showToast={showToast}
          />
        )}

        {activeWorkspaceTab === 'services' && (
          <ServicesTab />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-4 px-4 text-center">
        <p>
          Hệ Thống Trả Kết Quả Siêu Âm Sản Phụ Khoa AI • Hỗ trợ máy GE Voluson / Samsung / Mindray / Philips • Tự động tạo thư mục SĐT & Lưu PDF chuẩn A4
        </p>
      </footer>

      {/* Modals & Drawers */}
      {showPrintModal && (
        <PrintReportModal
          report={report}
          onUpdateReport={(updated) => setReport(updated)}
          pcRootDirectoryHandle={pcRootDirectoryHandle}
          onOpenPcSettings={() => setShowPcSettingsModal(true)}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {showReferenceModal && (
        <ClinicalReferenceModal
          onClose={() => setShowReferenceModal(false)}
        />
      )}

      {showHistoryDrawer && (
        <HistoryDrawer
          records={history}
          onSelectRecord={(r) => {
            setReport(r);
            showToast(`Đã mở phiếu của bệnh nhân ${r.patient.name}`);
          }}
          onDeleteRecord={handleDeleteRecord}
          onClearAll={handleClearAllHistory}
          onNewExamForPatient={handleNewExamForPatient}
          onQuickPrintRecord={(r) => {
            setReport(r);
            setShowPrintModal(true);
          }}
          onClose={() => setShowHistoryDrawer(false)}
        />
      )}

      {showPcSettingsModal && (
        <PcFolderSettingsModal
          currentHandle={pcRootDirectoryHandle}
          onDirectoryChanged={(handle) => {
            setPcRootDirectoryHandle(handle);
            if (handle) {
              showToast(`Đã kết nối với thư mục: ${handle.name}`);
            }
          }}
          onClose={() => setShowPcSettingsModal(false)}
        />
      )}
    </div>
  );
}

export default App;
