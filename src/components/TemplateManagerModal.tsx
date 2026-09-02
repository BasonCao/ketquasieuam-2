import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  RotateCcw, 
  Check, 
  Layers, 
  Sparkles, 
  Info,
  Save,
  FileText,
  Tag,
  Clock
} from 'lucide-react';
import { 
  FormTemplateInfo, 
  FORM_TEMPLATES, 
  getStoredFormTemplates, 
  saveFormTemplates 
} from '../data/formTemplates';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (tmpl: FormTemplateInfo) => void;
  onTemplatesChange?: (templates: FormTemplateInfo[]) => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onTemplatesChange,
}) => {
  const [templates, setTemplates] = useState<FormTemplateInfo[]>(getStoredFormTemplates);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplateInfo | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveTemplatesList = (newTemplates: FormTemplateInfo[]) => {
    setTemplates(newTemplates);
    saveFormTemplates(newTemplates);
    if (onTemplatesChange) {
      onTemplatesChange(newTemplates);
    }
  };

  const showNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleStartCreate = () => {
    const newId = `custom_form_${Date.now()}`;
    const newTmpl: FormTemplateInfo = {
      id: newId,
      name: 'Mẫu Siêu Âm Mới',
      code: `FORM-CUSTOM-${templates.length + 1}`,
      badge: 'Mẫu Tùy Chỉnh',
      badgeColor: 'cyan',
      ageBracket: 'custom',
      description: 'Mẫu kết quả siêu âm tùy chỉnh mới do bác sĩ tạo.',
      applicableGestationalAge: 'Theo chỉ định lâm sàng',
      primaryIndicators: ['BPD', 'HC', 'AC', 'FL', 'EFW'],
      keySections: ['1. Thông tin bệnh nhân', '2. Sinh trắc học', '3. Kết luận'],
      recommendedConclusion: 'Trong buồng tử cung có 01 thai phát triển tương đương {GA}. Hiện tại chưa thấy bất thường.',
      defaultDataPreset: {
        surveyMilestone: 'Khảo sát tùy chỉnh',
        conclusionV2: {
          ket_luan_1: 'Trong buồng tử cung có 01 thai phát triển tương đương {GA}.',
          ket_luan_2: 'Hiện tại chưa thấy bất thường.',
          hen_kham_lai: '4',
        },
      },
      isCustom: true,
    };
    setEditingTemplate(newTmpl);
    setIsCreatingNew(true);
  };

  const handleDuplicate = (tmpl: FormTemplateInfo) => {
    const dup: FormTemplateInfo = {
      ...tmpl,
      id: `custom_form_${Date.now()}`,
      name: `${tmpl.name} (Bản sao)`,
      code: `${tmpl.code}-COPY`,
      isCustom: true,
    };
    const updated = [dup, ...templates];
    handleSaveTemplatesList(updated);
    showNotice(`Đã nhân bản mẫu "${tmpl.name}"!`);
  };

  const handleStartEdit = (tmpl: FormTemplateInfo) => {
    setEditingTemplate({ ...tmpl });
    setIsCreatingNew(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (templates.length <= 1) {
      alert('Không thể xoá form mẫu cuối cùng!');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xoá form mẫu "${name}" không?`)) {
      const updated = templates.filter(t => t.id !== id);
      handleSaveTemplatesList(updated);
      showNotice(`Đã xoá form mẫu "${name}"!`);
      if (editingTemplate?.id === id) {
        setEditingTemplate(null);
      }
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Khôi phục danh sách form mẫu mặc định chuẩn Y Khoa? Tất cả mẫu đã chỉnh sửa/tạo mới sẽ được đặt lại.')) {
      setTemplates(FORM_TEMPLATES);
      saveFormTemplates(FORM_TEMPLATES);
      if (onTemplatesChange) onTemplatesChange(FORM_TEMPLATES);
      setEditingTemplate(null);
      showNotice('Đã khôi phục danh sách form mẫu chuẩn y khoa!');
    }
  };

  const handleSaveFormEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    if (!editingTemplate.name.trim() || !editingTemplate.code.trim()) {
      alert('Vui lòng điền tên mẫu và mã form!');
      return;
    }

    let updatedList: FormTemplateInfo[];
    const existingIndex = templates.findIndex(t => t.id === editingTemplate.id);
    
    if (existingIndex >= 0) {
      updatedList = [...templates];
      updatedList[existingIndex] = { ...editingTemplate, isCustom: true };
    } else {
      updatedList = [editingTemplate, ...templates];
    }

    handleSaveTemplatesList(updatedList);
    showNotice(isCreatingNew ? 'Đã tạo mẫu form mới thành công!' : 'Đã cập nhật form mẫu thành công!');
    setEditingTemplate(null);
    setIsCreatingNew(false);
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.badge.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-800/80 px-4 sm:px-6 py-4 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-inner">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Quản Lý Mẫu Form Siêu Âm</span>
                <span className="text-xs bg-cyan-950 text-cyan-400 border border-cyan-700 px-2 py-0.5 rounded-full font-mono font-medium">
                  {templates.length} Mẫu
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Thêm mới, sửa đổi cấu trúc nội dung, xóa hoặc nhân bản các biểu mẫu siêu âm chuẩn phòng khám.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleStartCreate}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Form Mới</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        {successNotice && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 px-4 py-2 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Template List (5 cols) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm mẫu form..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-400 hover:text-amber-300 flex items-center space-x-1 shrink-0 transition"
                title="Khôi phục mặc định"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[550px]">
              {filteredTemplates.map((tmpl) => {
                const isEditing = editingTemplate?.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isEditing
                        ? 'bg-cyan-950/60 border-cyan-500 ring-1 ring-cyan-500/40 shadow-lg'
                        : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-mono font-bold bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded">
                            {tmpl.code}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-medium truncate max-w-[120px]">
                            {tmpl.badge}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-white line-clamp-2">
                          {tmpl.name}
                        </h3>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                      {onSelectTemplate && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTemplate(tmpl);
                            onClose();
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Chọn mẫu này</span>
                        </button>
                      )}

                      <div className="flex items-center space-x-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(tmpl)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition"
                          title="Nhân bản mẫu này"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(tmpl)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition"
                          title="Chỉnh sửa mẫu này"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tmpl.id, tmpl.name)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                          title="Xoá mẫu này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredTemplates.length === 0 && (
                <div className="p-8 text-center bg-slate-800/30 rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs">
                  Không tìm thấy form mẫu nào phù hợp.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Template Editor Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-800/40 border border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col">
            {editingTemplate ? (
              <form onSubmit={handleSaveFormEdit} className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                    <span>{isCreatingNew ? 'Tạo Mẫu Form Mới' : `Chỉnh Sửa Form: ${editingTemplate.code}`}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Hủy sửa
                  </button>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Mã Form (Code)</label>
                      <input
                        type="text"
                        value={editingTemplate.code}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, code: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        placeholder="FORM-5D-CUSTOM"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Mã Tuổi Thai / Nhóm</label>
                      <select
                        value={editingTemplate.ageBracket}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, ageBracket: e.target.value as any })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="custom">Tùy chọn / Mọi mốc thai</option>
                        <option value="<12w">Thai &lt; 12 tuần</option>
                        <option value="12-13w6d">Sàng lọc 12 - 13w6d</option>
                        <option value="14-32w">Hình thái 14 - 32 tuần</option>
                        <option value=">32w">Tăng trưởng & Doppler &gt; 32 tuần</option>
                        <option value="gyn">Phụ khoa</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Tên Form Mẫu</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                      placeholder="Nhập tên hiển thị mẫu siêu âm..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Huy Hiệu (Badge)</label>
                      <input
                        type="text"
                        value={editingTemplate.badge}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, badge: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                        placeholder="Mẫu 5D V2.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Tuổi Thai Áp Dụng</label>
                      <input
                        type="text"
                        value={editingTemplate.applicableGestationalAge}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, applicableGestationalAge: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                        placeholder="14 - 32 tuần"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Mô Tả Ngắn Về Form</label>
                    <textarea
                      rows={2}
                      value={editingTemplate.description}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                      placeholder="Mô tả mục đích và đặc điểm form mẫu này..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Mẫu Kết Luận Chuẩn Mặc Định</span>
                      <span className="text-[10px] text-cyan-400 font-normal">Có thể dùng biến {'{GA}'}, {'{EFW}'}, {'{PERCENTILE}'}</span>
                    </label>
                    <textarea
                      rows={4}
                      value={editingTemplate.recommendedConclusion}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, recommendedConclusion: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-cyan-100 font-medium leading-relaxed focus:outline-none focus:border-cyan-500"
                      placeholder="Nhập mẫu kết luận gợi ý..."
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700 flex items-center justify-end space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Form Mẫu</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                  <FileText className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Chọn hoặc Tạo Form Mẫu Mới</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Nhấp vào nút <strong className="text-cyan-400">"Chỉnh sửa"</strong> trên bất kỳ mẫu form nào ở danh sách bên trái hoặc nhấn <strong className="text-cyan-400">"Thêm Form Mới"</strong> để tự tạo mẫu kết quả riêng cho phòng khám của bạn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg transition active:scale-95 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Form Mới Ngay</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
