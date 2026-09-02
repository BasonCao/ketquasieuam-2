// Patient Directory mapping Patient ID (Phone/CCCD/Mã BN) to full Vietnamese accented names
// Enables instant auto-fill of accented names and auto-capitalization with Vietnamese diacritics

export interface PatientDirectoryRecord {
  id: string;
  name: string;
  yearOfBirth?: string;
  dob?: string;
  phone?: string;
  address?: string;
  gender?: string;
  edd?: string;
  gaClin?: string;
  // Obstetrical History
  gravida?: string;
  para?: string;
  abortion?: string;
  ectopic?: string;
  obstetricHistoryNotes?: string;
  // Reception & Alert fields
  previousAbnormalities?: string; // Highlighting previous alerts
  plannedDeliveryLocation?: string; // Nơi dự định sinh
  notes?: string; // Ghi chú khác
  firstVisitDate?: string; // Ngày tiếp đón lần đầu
  visitCount?: number;
  lastExamDate?: string;
  lastGa?: string;
  lastConclusion?: string;
  // Vital Signs
  height?: number | null;
  weight?: number | null;
  bloodPressure?: string;
  pulse?: number | null;
}

export const INITIAL_PATIENT_DIRECTORY: Record<string, PatientDirectoryRecord> = {
  // Existing known clinic cases with rich reception info
  '0988386607': {
    id: '0988386607',
    name: 'NGHIÊM THỊ NHƯ QUỲNH',
    yearOfBirth: '1993',
    dob: '12/04/1993',
    phone: '0988386607',
    address: 'Hà Nội',
    gender: 'Nữ',
    gravida: '1',
    para: '0',
    abortion: '0',
    ectopic: '0',
    obstetricHistoryNotes: 'Con so, thai tự nhiên',
    previousAbnormalities: 'Lần siêu âm 22 tuần phát hiện Rau bám thấp mặt sau nhóm I. Cần theo dõi chiều dài cổ tử cung.',
    plannedDeliveryLocation: 'Bệnh viện Phụ sản Hà Nội (Đê La Thành)',
    notes: 'Bệnh nhân đăng ký gói theo dõi thai sản trọn gói tại phòng khám.',
    firstVisitDate: '10/01/2025',
    visitCount: 4,
    lastExamDate: '16.07.2025',
    lastGa: '25w3d',
    lastConclusion: 'Một thai sống trong tử cung 25 tuần 3 ngày, phát triển tương đương tuổi thai.'
  },
  '0989293589': {
    id: '0989293589',
    name: 'DƯƠNG THỊ THU HUYỀN',
    yearOfBirth: '1989',
    dob: '18/09/1989',
    phone: '0989293589',
    address: 'Hà Nội',
    gender: 'Nữ',
    gravida: '2',
    para: '1',
    abortion: '0',
    ectopic: '0',
    obstetricHistoryNotes: 'Tiền sử mổ đẻ cũ năm 2021 (con nặng 3.4kg). Vết mổ tốt.',
    previousAbnormalities: 'Theo dõi sẹo mổ cũ tử cung mỏng (2.8mm ở tuần 32). Thai khỏe.',
    plannedDeliveryLocation: 'Bệnh viện Phụ sản Trung Ương (Bệnh viện C)',
    notes: 'Ưu tiên siêu âm kiểm tra vết mổ đẻ cũ và trọng lượng thai.',
    firstVisitDate: '15/02/2025',
    visitCount: 3,
    lastExamDate: '20.06.2025',
    lastGa: '32w1d'
  },
  '0862522683': {
    id: '0862522683',
    name: 'NGÔ QUỲNH ANH',
    yearOfBirth: '2003',
    dob: '05/11/2003',
    phone: '0862522683',
    address: 'Hà Nội',
    gender: 'Nữ',
    gravida: '1',
    para: '0',
    abortion: '0',
    ectopic: '0',
    obstetricHistoryNotes: 'Con so',
    previousAbnormalities: 'Không có bất thường ghi nhận.',
    plannedDeliveryLocation: 'Bệnh viện Vinmec Times City',
    notes: 'Yêu cầu trả kết quả siêu âm qua Zalo.',
    firstVisitDate: '01/03/2025',
    visitCount: 2
  },
  '0353279368': {
    id: '0353279368',
    name: 'ĐÀO NGỌC KHÁNH LINH',
    yearOfBirth: '1995',
    dob: '22/07/1995',
    phone: '0353279368',
    address: 'Hà Nội',
    gender: 'Nữ',
    gravida: '2',
    para: '1',
    abortion: '0',
    ectopic: '0',
    previousAbnormalities: 'Tiền sử đái tháo đường thai kỳ lần 1. Đã test OGTT bình thường tuần 24.',
    plannedDeliveryLocation: 'Bệnh viện Bưu Điện',
    notes: 'Theo dõi sát cân nặng thai.',
    firstVisitDate: '12/04/2025',
    visitCount: 3
  },
  '0912345678': {
    id: '0912345678',
    name: 'NGUYỄN THỊ THU HƯƠNG',
    yearOfBirth: '1997',
    dob: '15/03/1997',
    phone: '0912345678',
    address: 'Hà Nội',
    gender: 'Nữ',
    gravida: '1',
    para: '0',
    abortion: '0',
    ectopic: '0',
    previousAbnormalities: 'Bình thường',
    plannedDeliveryLocation: 'Bệnh viện Phụ sản Hà Nội',
    notes: '',
    firstVisitDate: '20/05/2025',
    visitCount: 1
  }
};

const DIRECTORY_STORAGE_KEY = 'sono_patient_directory_v1';

// Get patient directory from local storage merged with initials
export function getPatientDirectory(): Record<string, PatientDirectoryRecord> {
  try {
    const saved = localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (saved) {
      return { ...INITIAL_PATIENT_DIRECTORY, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return { ...INITIAL_PATIENT_DIRECTORY };
}

// Lookup patient by ID (phone number, national ID, or patient code)
export function lookupPatientById(patientId: string): PatientDirectoryRecord | null {
  if (!patientId) return null;
  const cleanId = patientId.replace(/[\s\.\-_]/g, '').trim();
  const dir = getPatientDirectory();

  // Direct exact match
  if (dir[cleanId]) return dir[cleanId];

  // Try matching phone or id
  const found = Object.values(dir).find(
    (p) => p.id.replace(/[\s\.\-_]/g, '') === cleanId || p.phone?.replace(/[\s\.\-_]/g, '') === cleanId
  );
  return found || null;
}

// Convert unaccented uppercase name to known Vietnamese accented form or smart format
export function formatPatientVietnameseName(rawName: string, patientId?: string): string {
  if (!rawName) return '';
  
  // First check if ID matches a registered patient
  if (patientId) {
    const record = lookupPatientById(patientId);
    if (record?.name) {
      return record.name;
    }
  }

  // Strip trailing 4-digit birth year if concatenated in machine (e.g. "NGO QUYNH ANH 2003" -> "NGO QUYNH ANH")
  let cleanName = rawName.replace(/\s+\b(19\d{2}|20\d{2})\b\s*$/, '').trim();

  // If there's an exact match in the dictionary by unaccented name
  const dir = getPatientDirectory();
  for (const record of Object.values(dir)) {
    if (removeVietnameseTones(record.name).toUpperCase() === cleanName.toUpperCase()) {
      return record.name;
    }
  }

  return cleanName.toUpperCase();
}

// Save or update a patient in the directory
export function savePatientToDirectory(record: PatientDirectoryRecord) {
  if (!record.id) return;
  const cleanId = record.id.replace(/[\s\.\-_]/g, '').trim();
  const dir = getPatientDirectory();
  dir[cleanId] = {
    ...record,
    id: cleanId
  };
  try {
    localStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(dir));
  } catch {
    // ignore
  }
}

// Utility to remove Vietnamese tones for comparison
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
