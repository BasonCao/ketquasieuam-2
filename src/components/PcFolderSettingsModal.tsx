import React, { useState } from 'react';
import {
  Folder,
  FolderCheck,
  FolderPlus,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  Smartphone,
  Calendar,
  FileText,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  isFileSystemAccessSupported,
  promptSelectRootDirectory,
  clearSavedRootDirectory,
} from '../utils/pcStorageService';

interface PcFolderSettingsModalProps {
  currentHandle: FileSystemDirectoryHandle | null;
  onDirectoryChanged: (handle: FileSystemDirectoryHandle | null) => void;
  onClose: () => void;
}

export const PcFolderSettingsModal: React.FC<PcFolderSettingsModalProps> = ({
  currentHandle,
  onDirectoryChanged,
  onClose,
}) => {
  const isSupported = isFileSystemAccessSupported();
  const [isSelecting, setIsSelecting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    setErrorMessage(null);
    try {
      const result = await promptSelectRootDirectory();
      if (result.success && result.handle) {
        onDirectoryChanged(result.handle);
        setTestStatus(`Đã kết nối thành công với thư mục: "${result.handle.name}"`);
      } else if (result.error && result.error !== 'Đã hủy chọn thư mục.') {
        setErrorMessage(result.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi chọn thư mục');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleDisconnect = async () => {
    await clearSavedRootDirectory();
    onDirectoryChanged(null);
    setTestStatus('Đã ngắt kết nối thư mục lưu trên PC.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                Cài Đặt Thư Mục Lưu Trữ Kết Quả Trên PC
              </h3>
              <p className="text-xs text-slate-400">
                Tự động tạo thư mục theo SĐT bệnh nhân và lưu file PDF theo tuần thai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser compatibility check */}
        {!isSupported && (
          <div className="p-3 bg-amber-950/70 border border-amber-500/50 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Trình duyệt chưa hỗ trợ File System Access API</p>
              <p className="mt-0.5 text-amber-300/90">
                Vui lòng mở phần mềm trên <b>Google Chrome</b>, <b>Microsoft Edge</b> hoặc <b>Opera</b> trên máy tính Windows/Mac để sử dụng tính năng lưu trực tiếp vào ổ đĩa.
              </p>
            </div>
          </div>
        )}

        {/* Current status card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Trạng thái kết nối ổ đĩa:</span>
            {currentHandle ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
                Đang kết nối: {currentHandle.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                Chưa chọn thư mục gốc
              </span>
            )}
          </div>

          {currentHandle && (
            <div className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1 font-mono">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Folder className="w-3.5 h-3.5" />
                <span>Thư mục gốc: {currentHandle.name}/</span>
              </div>
              <div className="pl-4 text-slate-400 flex items-center gap-2">
                <Smartphone className="w-3 h-3 text-amber-400" />
                <span>└── [SĐT_BenhNhan]/ (VD: 0912345678/)</span>
              </div>
              <div className="pl-8 text-slate-400 flex items-center gap-2">
                <FileText className="w-3 h-3 text-emerald-400" />
                <span>└── KQSieuAm_Thai_22w2d_NguyenThiA_2026-08-27.pdf</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSelectFolder}
              disabled={isSelecting || !isSupported}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow transition disabled:opacity-50"
            >
              {isSelecting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderPlus className="w-3.5 h-3.5" />
              )}
              <span>{currentHandle ? 'Đổi Thư Mục Khác Trên PC' : 'Chọn Thư Mục Lưu Gốc Trên PC'}</span>
            </button>

            {currentHandle && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-semibold border border-slate-700 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ngắt kết nối</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback message */}
        {testStatus && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{testStatus}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Workflow explanation */}
        <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 space-y-2">
          <p className="font-bold text-slate-300">Quy trình tự động lưu thông minh:</p>
          <ul className="space-y-1.5 pl-1">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Bác sĩ chỉ cần chọn Thư mục lưu gốc 1 lần (VD: ổ <code>D:/SieuAm_KetQua</code>).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Khi bấm <b>"Xuất File PDF"</b>, phần mềm tự động lấy <b>Số Điện Thoại</b> của sản phụ để tạo thư mục riêng trên PC (VD: <code>D:/SieuAm_KetQua/0987654321/</code>).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>File PDF được lưu tự động theo <b>Tuần thai & Ngày khám</b> (VD: <code>KQSieuAm_Thai_12w4d_TranThiB_2026-08-27.pdf</code>).</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
