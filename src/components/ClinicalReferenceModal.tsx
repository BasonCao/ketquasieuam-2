import React, { useState } from 'react';
import { BookOpen, X, Calculator, ShieldCheck, Heart, Droplet } from 'lucide-react';

interface ClinicalReferenceModalProps {
  onClose: () => void;
}

export const ClinicalReferenceModal: React.FC<ClinicalReferenceModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'biometry' | 'nt' | 'afi' | 'doppler'>('biometry');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm sm:text-base text-white">
              Bảng Tra Cứu Chuẩn Sinh Trắc Học & Doppler Sản Khoa
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4">
          <button
            onClick={() => setTab('biometry')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              tab === 'biometry'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sinh Trắc Học (Hadlock / EFW)
          </button>
          <button
            onClick={() => setTab('nt')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              tab === 'nt'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Đo Độ Mờ Da Gáy (NT & CRL)
          </button>
          <button
            onClick={() => setTab('afi')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              tab === 'afi'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Chỉ Số Ối (AFI & SDP)
          </button>
          <button
            onClick={() => setTab('doppler')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              tab === 'doppler'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Doppler ĐM Tử Cung & ĐM Rốn
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-slate-300 text-xs sm:text-sm space-y-4">
          {tab === 'biometry' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-cyan-300 text-sm mb-2">Công Thức Ước Tính Cân Nặng Hadlock (EFW)</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Ứng dụng tự động áp dụng công thức Hadlock 4 (BPD, HC, AC, FL) hoặc Hadlock 2 (AC, FL) chuẩn quốc tế với sai số ± 10 - 15%.
                </p>
                <div className="font-mono text-xs bg-slate-950 p-3 rounded-lg text-cyan-300 border border-slate-800">
                  Log10(EFW) = 1.3596 - 0.00386*(AC*FL) + 0.0064*HC + 0.00061*(BPD*AC) + 0.0424*AC + 0.174*FL
                </div>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-slate-200 text-sm mb-3">Bảng Cân Nặng Thai Chuẩn Theo Tuần (Hadlock 50th Percentile)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">12 tuần:</span> <b className="text-white">~58 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">16 tuần:</span> <b className="text-white">~146 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">20 tuần:</span> <b className="text-white">~331 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">24 tuần:</span> <b className="text-white">~670 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">28 tuần:</span> <b className="text-white">~1210 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">32 tuần:</span> <b className="text-white">~1953 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">36 tuần:</span> <b className="text-white">~2813 g</b></div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800"><span className="text-slate-400">40 tuần:</span> <b className="text-white">~3600 g</b></div>
                </div>
              </div>
            </div>
          )}

          {tab === 'nt' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-emerald-300 text-sm mb-2">Tiêu Chuẩn FMF Cho Đo Độ Mờ Da Gáy (NT)</h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                  <li>Thực hiện ở tuổi thai từ <b>11 tuần 0 ngày đến 13 tuần 6 ngày</b> (CRL: 45 mm - 84 mm).</li>
                  <li>Mặt cắt dọc giữa chuẩn (Mid-sagittal view), phóng đại hình ảnh chiếm 3/4 màn hình.</li>
                  <li><b>Ngưỡng an toàn:</b> NT &lt; 2.5 mm (Nguy cơ thấp lệch bội NST).</li>
                  <li><b>Nguy cơ cao:</b> NT ≥ 3.0 mm (Chỉ định làm NIPT chuyên sâu hoặc chọc ối xét nghiệm Karyotype / Microarray).</li>
                </ul>
              </div>
            </div>
          )}

          {tab === 'afi' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-blue-300 text-sm mb-2">Đánh Giá Chỉ Số Ối (AFI) & Xoang Ối Lớn Nhất (SDP)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="font-bold text-emerald-400 block mb-1">Bình thường:</span>
                    AFI từ 60 mm đến 240 mm (hoặc SDP từ 2.0 cm đến 8.0 cm).
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-1">Dư ối / Đa ối:</span>
                    AFI &gt; 240 mm hoặc SDP &gt; 8.0 cm. Cần kiểm tra đái tháo đường thai kỳ.
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="font-bold text-rose-400 block mb-1">Thiểu ối:</span>
                    AFI &lt; 50 mm hoặc SDP &lt; 2.0 cm. Cần theo dõi rỉ ối, chậm phát triển trong tử cung (FGR).
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="font-bold text-rose-500 block mb-1">Vô ối (Anhydramnios):</span>
                    AFI = 0 mm (Không thấy khoang ối trống). Cấp cứu sản khoa.
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'doppler' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-purple-300 text-sm mb-2">Doppler Động Mạch Tử Cung (UtA) & Động Mạch Rốn (UA)</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Khảo sát trở kháng dòng chảy nuôi thai để phát hiện sớm nguy cơ Tiền sản giật (Preeclampsia) và Thai chậm tăng trưởng (IUGR/FGR).
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <b className="text-white">ĐM Tử Cung 12 - 14 tuần:</b> Trung bình PI 1.5 - 2.3. Dấu hiệu khuyết tiền tâm trương (Notch) cần theo dõi nếu tồn tại sau 24 tuần.
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                    <b className="text-white">ĐM Rốn (UA):</b> Chỉ số S/D giảm dần theo tuổi thai (&lt; 3.0 ở quý 3). Sóng cuối tâm trương (ED) dương tính liên tục.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
