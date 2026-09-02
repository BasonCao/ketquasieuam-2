import { PatientInfo } from '../types/ultrasound';

const DB_NAME = 'SonoReportAI_StorageDB';
const DB_VERSION = 1;
const STORE_NAME = 'directory_handles';
const ROOT_HANDLE_KEY = 'pc_root_directory_handle';

// Check if File System Access API is supported (Chromium browsers: Chrome, Edge, Opera, Brave, etc.)
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Open IndexedDB database
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trong môi trường này'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get saved root directory handle from IndexedDB
 */
export async function getSavedRootDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(ROOT_HANDLE_KEY);

      request.onsuccess = async () => {
        const handle = request.result as FileSystemDirectoryHandle | undefined;
        if (handle) {
          try {
            // Verify permission
            if (typeof (handle as any).queryPermission === 'function') {
              const permission = await (handle as any).queryPermission({ mode: 'readwrite' });
              if (permission === 'granted') {
                resolve(handle);
                return;
              }
            }
          } catch (e) {
            console.warn('Handle permission query failed:', e);
          }
          resolve(handle);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not read saved root directory:', err);
    return null;
  }
}

/**
 * Save root directory handle to IndexedDB
 */
export async function saveRootDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!isFileSystemAccessSupported()) return;

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(handle, ROOT_HANDLE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Could not save root directory handle:', err);
    throw err;
  }
}

/**
 * Clear saved root directory handle
 */
export async function clearSavedRootDirectory(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(ROOT_HANDLE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not clear root directory handle:', err);
  }
}

/**
 * Ask user to select a root directory on their PC
 */
export async function promptSelectRootDirectory(): Promise<{
  success: boolean;
  handle?: FileSystemDirectoryHandle;
  dirName?: string;
  error?: string;
}> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      error: 'Trình duyệt hiện tại chưa hỗ trợ File System Access API. Vui lòng sử dụng Google Chrome, Microsoft Edge hoặc Opera trên máy tính.',
    };
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Request readwrite permission explicitly if needed
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Người dùng không cấp quyền ghi vào thư mục đã chọn.',
      };
    }

    await saveRootDirectoryHandle(handle);

    return {
      success: true,
      handle,
      dirName: handle.name,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Đã hủy chọn thư mục.' };
    }
    return {
      success: false,
      error: err.message || 'Lỗi không xác định khi chọn thư mục.',
    };
  }
}

/**
 * Generate standard clean directory name for patient (by Phone Number)
 */
export function getPatientFolderName(patient: PatientInfo): string {
  const phone = (patient.phone || '').trim().replace(/[^0-9+]/g, '');
  if (phone && phone.length >= 8) {
    return phone;
  }

  const patientId = (patient.patientId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const nameClean = (patient.name || 'BenhNhan')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();

  if (patientId) {
    return `${patientId}_${nameClean}`;
  }

  return `BN_${nameClean || 'Chua_Dat_Ten'}`;
}

/**
 * Generate clean folder name for Gestational Age (tuần thai)
 * e.g. "16w5d", "12w3d", "8w", "22w4d"
 */
export function getGestationalAgeFolderName(patient: PatientInfo, customGa?: string): string {
  const rawGa = (customGa || patient.gaClin || patient.gaAua || '').trim();
  if (!rawGa) {
    return 'Kham_Thai';
  }

  // Extract pattern like 16w5d, 16w, 16t5n, etc.
  const cleanGa = rawGa
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .trim();

  return cleanGa || 'Kham_Thai';
}

/**
 * Generate standard clean file name: [sdt] [họ tên bn] [tuần thai].pdf
 * e.g. "0987654321 Trần Thị Mai 16w5d.pdf"
 */
export function getReportFileNameByGestationalAge(
  patient: PatientInfo,
  customGa?: string,
  _categoryName?: string
): string {
  const phone = (patient.phone || '').trim().replace(/[^0-9+]/g, '');
  const nameClean = (patient.name || 'BenhNhan')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();

  const gaRaw = (customGa || patient.gaClin || patient.gaAua || '').trim();
  const gaClean = gaRaw.replace(/[\\/:*?"<>|]/g, '').trim();

  const parts: string[] = [];
  if (phone) parts.push(phone);
  if (nameClean) parts.push(nameClean);
  if (gaClean) parts.push(gaClean);

  if (parts.length === 0) {
    parts.push('KQSieuAm');
    parts.push(new Date().toLocaleDateString('vi-VN').replace(/[\/.]/g, '-'));
  }

  return `${parts.join(' ')}.pdf`;
}

/**
 * Save PDF Blob into: [Thư Mục Gốc] / [SĐT_BệnhNhân] / [tuần thai] / [sdt_họ tên bn_tuầnthai.pdf]
 */
export async function savePdfToPatientPcFolder(
  rootHandle: FileSystemDirectoryHandle,
  patient: PatientInfo,
  pdfBlob: Blob,
  options?: {
    customGa?: string;
    customCategory?: string;
    onProgress?: (msg: string) => void;
  }
): Promise<{
  success: boolean;
  patientFolder: string;
  gaFolder: string;
  fileName: string;
  fullPathHint: string;
  error?: string;
}> {
  const patientFolder = getPatientFolderName(patient);
  const gaFolder = getGestationalAgeFolderName(patient, options?.customGa);
  const fileName = getReportFileNameByGestationalAge(patient, options?.customGa, options?.customCategory);

  try {
    if (options?.onProgress) {
      options.onProgress('Đang kiểm tra quyền ghi thư mục...');
    }

    // Verify permission
    if (typeof (rootHandle as any).queryPermission === 'function') {
      let permission = await (rootHandle as any).queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted' && typeof (rootHandle as any).requestPermission === 'function') {
        permission = await (rootHandle as any).requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          throw new Error('Chưa được cấp quyền ghi vào thư mục gốc trên PC.');
        }
      }
    }

    if (options?.onProgress) {
      options.onProgress(`Đang tạo thư mục SĐT: ${patientFolder}...`);
    }

    // Level 1: Subdirectory for patient phone: [SĐT_BệnhNhân]
    const patientDirHandle = await rootHandle.getDirectoryHandle(patientFolder, { create: true });

    if (options?.onProgress) {
      options.onProgress(`Đang tạo thư mục tuần thai: ${gaFolder}...`);
    }

    // Level 2: Subdirectory for gestational age: [tuần thai]
    const gaDirHandle = await patientDirHandle.getDirectoryHandle(gaFolder, { create: true });

    if (options?.onProgress) {
      options.onProgress(`Đang lưu file: ${fileName}...`);
    }

    // Create / overwrite file inside [tuần thai] folder
    const fileHandle = await gaDirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(pdfBlob);
    await writable.close();

    const fullPathHint = `${rootHandle.name}/${patientFolder}/${gaFolder}/${fileName}`;

    return {
      success: true,
      patientFolder,
      gaFolder,
      fileName,
      fullPathHint,
    };
  } catch (err: any) {
    console.error('Error saving to PC directory:', err);
    return {
      success: false,
      patientFolder,
      gaFolder,
      fileName,
      fullPathHint: '',
      error: err.message || 'Lỗi khi ghi file vào ổ đĩa PC.',
    };
  }
}
