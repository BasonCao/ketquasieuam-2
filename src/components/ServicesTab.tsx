import React, { useState, useEffect } from 'react';
import { Trash2, Plus, TrendingUp, Calendar, FileDown, Cloud, RefreshCw } from 'lucide-react';
import { Service, ServiceUsage } from '../types/ultrasound';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, addDoc } from 'firebase/firestore';

const INITIAL_SERVICES: Service[] = [
  { id: 's1', name: 'NIPT 6.9', price: 6900000 },
  { id: 's2', name: 'NIPT 5.9', price: 5900000 },
  { id: 's3', name: 'NIPT 3.8', price: 3800000 },
  { id: 's4', name: 'NIPT 5.3', price: 5300000 },
  { id: 's5', name: '18 gen lặn', price: 2500000 },
  { id: 's6', name: 'xn gen teo cơ', price: 4500000 },
  { id: 's7', name: 'Thalassemia', price: 2000000 },
  { id: 's8', name: 'TSG combo', price: 1800000 },
  { id: 's9', name: 'gói XY', price: 3000000 },
  { id: 's10', name: 'nước tiểu', price: 50000 },
  { id: 's11', name: 'nipt 2.9', price: 2900000 },
  { id: 's12', name: 'Giảm co', price: 30000 },
  { id: 's13', name: 'bổ bầu Heramama (T)', price: 450000 },
  { id: 's14', name: 'Bổ bầu mới (T)', price: 380000 },
  { id: 's15', name: 'canxi 60 (T)', price: 640000 },
  { id: 's16', name: 'Canxi MK7 (T)', price: 530000 },
  { id: 's17', name: 'thuốc táo bón (T)', price: 150000 },
  { id: 's18', name: 'Canxi nước (T)', price: 480000 },
  { id: 's19', name: 'Sắt nước (T)', price: 520000 },
  { id: 's20', name: 'Bổ bầu Orthomol (T)', price: 2150000 },
  { id: 's21', name: 'Sắt sinh học Mixaferrum (T)', price: 450000 },
  { id: 's22', name: 'Bổ trứng Orthomol Pre (T)', price: 800000 },
  { id: 's23', name: 'Bổ tinh trùng Orthomol fertil (T)', price: 2150000 },
  { id: 's24', name: 'Bổ bầu Selancy (T)', price: 450000 },
  { id: 's25', name: 'Canxi Litocal 60v (T)', price: 600000 },
  { id: 's26', name: 'Sắt sinh học Feromax Forte (T)', price: 340000 },
  { id: 's27', name: 'Canxi Litocal 30v (T)', price: 300000 },
  { id: 's28', name: 'Khám phụ khoa', price: 200000 },
  { id: 's29', name: 'Nhuộm soi pk', price: 200000 },
  { id: 's30', name: 'Monitor lẻ', price: 300000 },
  { id: 's31', name: 'Gói monitor 3 lần', price: 600000 },
  { id: 's32', name: 'Monitor lần 2', price: 0 },
  { id: 's33', name: 'Monitor lần 3', price: 0 },
  { id: 's34', name: 'Gói tầm soát Ung thư CTC (HPV 16 type + Thin Prep)', price: 1500000 },
  { id: 's35', name: 'vệ sinh phụ khoa', price: 150000 },
  { id: 's36', name: 'xn chlamydia', price: 180000 },
  { id: 's37', name: 'xn HbA1c', price: 170000 },
  { id: 's38', name: 'xn Nhóm máu ABO Rh', price: 120000 },
  { id: 's39', name: 'xn Test nhanh viêm gan B', price: 100000 },
  { id: 's40', name: 'xn sắt canxi', price: 400000 },
  { id: 's41', name: 'xn sắt + ferritin', price: 250000 },
  { id: 's42', name: 'xn canxi + canxi ion', price: 150000 },
  { id: 's43', name: 'xn beta hcg', price: 250000 },
  { id: 's44', name: 'xn Progesterone', price: 200000 },
  { id: 's45', name: 'Gói xn tổng thể', price: 1300000 },
  { id: 's46', name: 'xn tiểu đường', price: 300000 },
  { id: 's47', name: 'XN Công thức máu', price: 150000 },
  { id: 's48', name: 'XN nhiễm trùng (CMV, Toxo, Rubella)', price: 2000000 },
  { id: 's49', name: 'Liên cầu B pk', price: 700000 },
  { id: 's50', name: 'xn hormon tuyến giáp', price: 650000 },
  { id: 's51', name: 'Gói xn anti phospholipid', price: 2700000 },
  { id: 's52', name: 'Tải lượng virus Viêm gan B', price: 650000 },
  { id: 's53', name: 'xn AMH', price: 850000 },
  { id: 's54', name: 'thuê máy tiểu đường', price: 1000000 },
  { id: 's55', name: 'que test tiểu đường', price: 390000 },
  { id: 's56', name: 'Bán máy test tiểu đường', price: 800000 },
  { id: 's57', name: 'xn tinh dịch đồ', price: 400000 },
  { id: 's58', name: 'xn D-Dimer', price: 350000 },
  { id: 's59', name: 'xn Rubella IgG IgM', price: 600000 },
  { id: 's60', name: 'thai nhỏ', price: 250000 },
  { id: 's61', name: 'tcpp', price: 250000 },
  { id: 's62', name: '5d', price: 550000 },
  { id: 's63', name: '5d song thai hình thái', price: 1000000 },
  { id: 's64', name: 'thai nhỏ song thai', price: 350000 },
  { id: 's65', name: 'ổ bụng', price: 250000 },
  { id: 's66', name: 'tuyến vú', price: 250000 },
  { id: 's67', name: 'tuyến giáp', price: 250000 },
  { id: 's68', name: 'tinh hoàn', price: 250000 },
  { id: 's69', name: 'phần mềm', price: 250000 },
  { id: 's70', name: 'Đo CTC (qua s.a đầu dò)', price: 50000 },
];

export function ServicesTab() {
  const [services, setServices] = useState<Service[]>(() => {
    const saved = localStorage.getItem('sono_services');
    return saved ? JSON.parse(saved) : INITIAL_SERVICES;
  });
  const [usage, setUsage] = useState<ServiceUsage[]>(() => {
    const saved = localStorage.getItem('sono_usage');
    return saved ? JSON.parse(saved) : [];
  });
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'offline'>('offline');

  // Real-time synchronization with Firestore
  useEffect(() => {
    if (!db) {
      setSyncStatus('offline');
      return;
    }

    try {
      // Listen to services collection
      const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
        if (!snapshot.empty) {
          const cloudServices: Service[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            cloudServices.push({
              id: docSnap.id,
              name: data.name,
              price: data.price
            });
          });
          setServices(cloudServices);
          localStorage.setItem('sono_services', JSON.stringify(cloudServices));
          setIsCloudSynced(true);
          setSyncStatus('connected');
        } else {
          // If Firestore is empty, seed initial services
          INITIAL_SERVICES.forEach(async (s) => {
            await setDoc(doc(db, 'services', s.id), { name: s.name, price: s.price });
          });
        }
      }, (error) => {
        console.warn("Cloud sync services error, falling back to local:", error);
        setSyncStatus('offline');
      });

      // Listen to usage collection
      const unsubUsage = onSnapshot(collection(db, 'service_usage'), (snapshot) => {
        const cloudUsage: ServiceUsage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudUsage.push({
            id: docSnap.id,
            serviceId: data.serviceId,
            date: data.date,
            count: data.count
          });
        });
        setUsage(cloudUsage);
        localStorage.setItem('sono_usage', JSON.stringify(cloudUsage));
      }, (error) => {
        console.warn("Cloud sync usage error:", error);
      });

      return () => {
        unsubServices();
        unsubUsage();
      };
    } catch (e) {
      console.warn("Firebase snapshot error:", e);
      setSyncStatus('offline');
    }
  }, []);

  const addService = async () => {
    if (!newServiceName || !newServicePrice) return;
    const id = 's_' + Date.now();
    const newService: Service = {
      id,
      name: newServiceName,
      price: Number(newServicePrice),
    };

    // Update local immediately
    const updated = [...services, newService];
    setServices(updated);
    localStorage.setItem('sono_services', JSON.stringify(updated));
    setNewServiceName('');
    setNewServicePrice('');

    // Sync to Firestore if available
    if (db) {
      try {
        await setDoc(doc(db, 'services', id), { name: newService.name, price: newService.price });
      } catch (e) {
        console.error("Error saving service to cloud:", e);
      }
    }
  };

  const deleteService = async (id: string) => {
    const updated = services.filter(s => s.id !== id);
    setServices(updated);
    localStorage.setItem('sono_services', JSON.stringify(updated));

    if (db) {
      try {
        await deleteDoc(doc(db, 'services', id));
      } catch (e) {
        console.error("Error deleting service from cloud:", e);
      }
    }
  };

  const logUsage = async (serviceId: string) => {
    const id = 'u_' + Date.now();
    const dateStr = new Date().toISOString().split('T')[0];
    const newUsage: ServiceUsage = {
      id,
      serviceId,
      date: dateStr,
      count: 1,
    };

    const updated = [...usage, newUsage];
    setUsage(updated);
    localStorage.setItem('sono_usage', JSON.stringify(updated));

    if (db) {
      try {
        await setDoc(doc(db, 'service_usage', id), {
          serviceId: newUsage.serviceId,
          date: newUsage.date,
          count: newUsage.count
        });
      } catch (e) {
        console.error("Error logging usage to cloud:", e);
      }
    }
  };

  const getFilteredUsage = () => {
    return usage.filter(u => {
      if (startDate && u.date < startDate) return false;
      if (endDate && u.date > endDate) return false;
      return true;
    });
  };

  const exportToExcel = () => {
    const filtered = getFilteredUsage();
    const data = filtered.map(u => {
      const service = services.find(s => s.id === u.serviceId);
      return {
        'Ngày': u.date,
        'Dịch vụ': service?.name || 'Không xác định',
        'Giá': service?.price || 0,
        'Số lượng': u.count
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Thống kê");
    XLSX.writeFile(workbook, "BaoCaoDichVu.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Cloud Sync Status Banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${syncStatus === 'connected' ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
        <div className="flex items-center gap-3">
          <Cloud className={`w-5 h-5 ${syncStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          <div>
            <div className="font-bold text-sm">
              {syncStatus === 'connected' ? 'Đã kết nối đồng bộ đám mây thời gian thực (Multi-PC Sync Active)' : 'Chế độ lưu trữ cục bộ (Local Storage)'}
            </div>
            <div className="text-xs opacity-80">
              {syncStatus === 'connected' 
                ? 'Mọi thay đổi về dịch vụ và doanh thu sẽ được đồng bộ tức thì giữa các máy tính.' 
                : 'Đang hoạt động ngoại tuyến hoặc đang kết nối lại...'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          <span className="font-medium">{syncStatus === 'connected' ? 'Đang đồng bộ' : 'Cục bộ'}</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Quản lý Dịch vụ</h3>
        <div className="flex gap-2 mb-4">
          <input 
            value={newServiceName} 
            onChange={(e) => setNewServiceName(e.target.value)} 
            placeholder="Tên dịch vụ" 
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
          />
          <input 
            value={newServicePrice} 
            onChange={(e) => setNewServicePrice(e.target.value)} 
            type="number"
            placeholder="Giá" 
            className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
          />
          <button onClick={addService} className="bg-cyan-600 px-4 py-2 rounded-lg text-white font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Thêm
          </button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {services.map(service => (
            <div key={service.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
              <span className="text-white">{service.name} - {service.price.toLocaleString()} VNĐ</span>
              <div className="flex gap-3">
                <button onClick={() => logUsage(service.id)} className="text-cyan-400 hover:text-cyan-300 font-medium text-sm">Đã dùng</button>
                <button onClick={() => deleteService(service.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp /> Thống kê dịch vụ</h3>
            <button onClick={exportToExcel} className="bg-green-600 px-4 py-2 rounded-lg text-white font-bold flex items-center gap-2">
                <FileDown className="w-4 h-4" /> Xuất Excel
            </button>
        </div>
        
        <div className="flex gap-2 mb-4">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-300" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-300" />
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {getFilteredUsage().map((u, i) => (
            <div key={u.id || i} className="flex justify-between items-center text-slate-300 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-400" /> {u.date}</span>
              <span className="font-medium text-white">{services.find(s => s.id === u.serviceId)?.name || 'Dịch vụ đã xóa'}</span>
              <span className="text-emerald-400">Số lượng: {u.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
