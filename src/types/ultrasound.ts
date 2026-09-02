export interface PatientInfo {
  name: string;
  yearOfBirth: string;
  age: string;
  patientId: string;
  phone: string;
  address: string;
  gender: string;
  clinicHeader: string;
  sonographer: string;
  examDate: string;
  indication: string;
  // Obstetrics dates
  lmp: string; // Kinh cuối (Last Menstrual Period)
  doc: string; // Ngày thụ thai / Chuyển phôi (Date of Conception)
  gaClin: string; // Tuổi thai lâm sàng (w+d)
  gaAua: string; // Tuổi thai theo siêu âm (w+d)
  edd: string; // Ngày dự sinh (Estimated Due Date)
  ga?: string; // Tuổi thai chính thức của thai kỳ (w+d)
  eddSource?: string; // Nguồn EDD (ví dụ: IVF_DAY5, IVF_DAY3, CLINICAL, LMP, AUA)
  gaSource?: string; // Nguồn GA (ví dụ: IVF_DAY5, IVF_DAY3, CLINICAL, LMP, AUA)
  datingSource?: string; // Nguồn Dating chung (ví dụ: IVF_DAY5, IVF_DAY3, CLINICAL, LMP, AUA)
  transferDate?: string; // Ngày chuyển phôi (ET)
  embryoDay?: number | null; // Tuổi phôi (3 hoặc 5)
  // Para
  gravida: string; // Số lần mang thai
  para: string; // Số lần sinh đủ tháng/thiếu tháng
  abortion: string; // Sảy / Hút
  ectopic: string; // Chửa ngoài tử cung
  // Reception & Intake specific fields
  dob?: string; // Ngày tháng năm sinh đầy đủ (dd/mm/yyyy)
  previousAbnormalities?: string; // Lần khám trước có bất thường gì không (Nêu bật cảnh báo)
  plannedDeliveryLocation?: string; // Dự định sinh ở đâu
  notes?: string; // Ghi chú khác
  obstetricHistoryNotes?: string; // Chi tiết tiền sử sản/phụ khoa
  firstVisitDate?: string; // Ngày tiếp đón lần đầu
  visitCount?: number; // Thống kê số lần thăm khám tại phòng khám
  height?: number | null; // Chiều cao (cm)
  weight?: number | null; // Cân nặng (kg)
  bloodPressure?: string; // Huyết áp (e.g. "120/80")
  pulse?: number | null; // Mạch (lần/phút)
}

export interface MeasurementItem {
  value: number | null;
  unit: string;
  method?: string;
  gaAge?: string;
  percentile?: string;
  m1?: number | null;
  m2?: number | null;
  m3?: number | null;
  name?: string;
  isExtracted?: boolean;
  sourceEvidence?: string;
}

export interface Measurements2D {
  gs: MeasurementItem; // Túi thai (Gestational Sac)
  ys: MeasurementItem; // Túi noãn hoàng (Yolk Sac)
  crl: MeasurementItem; // Chiều dài đầu mông (Crown Rump Length)
  nt: MeasurementItem; // Độ mờ da gáy (Nuchal Translucency)
  bpd: MeasurementItem; // Đường kính lưỡng đỉnh (Biparietal Diameter)
  ofd: MeasurementItem; // Đường kính trán chẩm (Occipitofrontal Diameter)
  hc: MeasurementItem; // Chu vi đầu (Head Circumference)
  ac: MeasurementItem; // Chu vi bụng (Abdominal Circumference)
  fl: MeasurementItem; // Chiều dài xương đùi (Femur Length)
  hl: MeasurementItem; // Chiều dài xương cánh tay (Humerus Length)
  tcd: MeasurementItem; // Đường kính ngang tiểu não (Cerebellum / Cereb)
  cm: MeasurementItem; // Bể lớn hố sau (Cisterna Magna)
  vp: MeasurementItem; // Não thất bên (Lateral Ventricle)
  nbl: MeasurementItem; // Chiều dài xương mũi (Nasal Bone Length)
  bod: MeasurementItem; // Đường kính gian 2 hốc mắt (Binocular Distance)
  foot: MeasurementItem; // Chiều dài bàn chân (Foot Length)
  cervixLength: MeasurementItem; // Chiều dài kênh cổ tử cung
}

export interface FetalWeightEFW {
  value: number | null;
  unit: string;
  range?: string;
  gaAge?: string;
  percentile?: string;
  formula?: string; // e.g. Hadlock (BPD, HC, AC, FL) or Hadlock (AC, FL)
  method?: string; // e.g. Hadlock, INTERGROWTH, Warsof, Shepard
  isExtracted?: boolean;
  isManual?: boolean;
  source?: 'report' | 'calculated' | 'manual';
}

export interface DopplerVesselItem {
  ps?: number | null;
  ed?: number | null;
  tamax?: number | null;
  taMax?: number | null;
  vti?: number | null;
  s?: number | null;
  a?: number | null;
  d?: number | null;
  pli?: number | null;
  pviv?: number | null;
  sa?: number | null;
  aS?: number | null;
  md?: number | null;
  ri?: number | null;
  pi?: number | null;
  sd?: number | null;
  sD?: number | null;
  hr?: number | null;
  notch?: boolean | null;
  psv?: number | null;
  mom?: number | null;
  edv?: string;
  aWave?: number | null;
  pv?: number | null;
  m1?: { ps?: number; ed?: number; tamax?: number; md?: number; ri?: number; pi?: number; sd?: number; hr?: number };
  m2?: { ps?: number; ed?: number; tamax?: number; md?: number; ri?: number; pi?: number; sd?: number; hr?: number };
}

export interface DopplerCalculationsItem {
  id?: string;
  parameter?: string;
  value: number | null;
  percentile?: string | null;
  method?: string | null;
  unit?: string;
  mom?: number | null;
  sourcePage?: number | null;
  sourceSection?: string | null;
  sourceEvidence?: string | null;
  pdfVisible?: boolean;
  includeInPdf?: boolean;
}

export type DopplerCalculationItem = DopplerCalculationsItem;

export interface DopplerCalculationsGroup {
  ductusVenosus?: {
    aS?: DopplerCalculationsItem;
    pi?: DopplerCalculationsItem;
    pli?: DopplerCalculationsItem;
    pviv?: DopplerCalculationsItem;
    sa?: DopplerCalculationsItem;
    [key: string]: any;
  };
  umbilicalArtery?: {
    pi?: DopplerCalculationsItem;
    ri?: DopplerCalculationsItem;
    sd?: DopplerCalculationsItem;
    [key: string]: any;
  };
  middleCerebralArtery?: {
    pi?: DopplerCalculationsItem;
    ri?: DopplerCalculationsItem;
    ps?: DopplerCalculationsItem;
    tamax?: DopplerCalculationsItem;
    cpr?: DopplerCalculationsItem;
    [key: string]: any;
  };
  leftUterine?: {
    pi?: DopplerCalculationsItem;
    ri?: DopplerCalculationsItem;
    [key: string]: any;
  };
  rightUterine?: {
    pi?: DopplerCalculationsItem;
    ri?: DopplerCalculationsItem;
    [key: string]: any;
  };
  combined?: Record<string, any>;
}

export interface DopplerValues {
  fhr: MeasurementItem; // Ventricular FHR (bpm)
  leftUterine: DopplerVesselItem;
  rightUterine: DopplerVesselItem;
  umbilicalArtery: DopplerVesselItem;
  middleCerebralArtery: DopplerVesselItem;
  ductusVenosus?: DopplerVesselItem;
  calculations?: DopplerCalculationsGroup;
}

export interface AmnioticFluidData {
  q1: MeasurementItem;
  q2: MeasurementItem;
  q3: MeasurementItem;
  q4: MeasurementItem;
  afi: MeasurementItem; // Tổng AFI
  sdp: MeasurementItem; // Single Deepest Pocket
  status: string; // Bình thường, Dư ối, Đa ối, Thiểu ối
}

export interface PlacentaData {
  location: string; // Mặt trước, Mặt sau, Đáy tử cung, Bám thấp, Tiền đạo...
  grade: string; // Độ 0, Độ I, Độ II, Độ III
  thickness: number | null; // mm
  abnormalities: string; // Không thấy tụ máu sau rau / Bình thường
}

export interface AnatomyChecklist {
  skullBrain: string; // Hộp sọ liên tục, cấu trúc não thất, tiểu não bình thường
  faceEyesNose: string; // 2 hốc mắt cân đối, xương mũi hiện diện, môi trên liên tục
  chestHeart: string; // Cấu trúc 4 buồng tim cân đối, trục tim ~45 độ
  abdomenStomachBladder: string; // Dạ dày và bàng quang trong ổ bụng, thành bụng kín
  spine: string; // Cột sống liên tục, cong sinh lý
  limbs: string; // Đủ 4 chi, mỗi chi đủ 3 đoạn, bàn tay bàn chân bình thường
}

export interface UltrasoundValidationLog {
  timestamp: string;
  mappedFieldsCount: number;
  mappedFields: string[];
  unmappedKeys: string[];
  warnings: string[];
  rawExtractedData?: any;
}

export interface FetusInfo {
  id: string; // 'A', 'B', 'C'
  name: string; // 'Thai A', 'Thai B', 'Thai C'
  measurements: Measurements2D;
  efw: FetalWeightEFW;
  doppler: DopplerValues;
  customMeasurements?: Record<string, any>;
}

export interface OriginalOcrData {
  patient?: {
    name?: string;
    patientId?: string;
    yearOfBirth?: string;
    lmp?: string;
    gaClin?: string;
    edd?: string;
    examDate?: string;
    ga?: string;
    eddSource?: string;
    gaSource?: string;
    datingSource?: string;
    transferDate?: string;
    embryoDay?: number | null;
  };
  measurements?: Record<string, number | null>;
  efw?: number | null;
  fhr?: number | null;
  uaPi?: number | null;
  uaRi?: number | null;
  mcaPi?: number | null;
  afi?: number | null;
}

export interface CervicalLengthData {
  method?: 'abdominal' | 'transvaginal' | null; // 'abdominal' | 'transvaginal'
  length?: number | null; // mm
  patientRefused?: boolean; // Bệnh nhân từ chối đo qua siêu âm đầu dò âm đạo
  notes?: string; // Ghi chú thêm
}

export interface MeasurementEvidence {
  key: string;
  value: number | null;
  unit: string;
  label?: string;
  sourceText?: string;
  page?: number;
  section?: string;
  confidence: number;
  isExtracted: boolean;
}

export interface CalculatedRatios {
  hcAc?: string | number | null;
  flAc?: string | number | null;
  flBpd?: string | number | null;
  flHc?: string | number | null;
  ci?: string | number | null;
  [key: string]: any;
}

export interface PregnancyDating {
  type: 'IVF' | 'natural' | string;
  transferDate?: string;
  embryoAge?: number;
  ga?: string;
  edd?: string;
  source?: string;
}

export type OcrJobStatus = 'pending' | 'processing' | 'retrying' | 'success' | 'failed';

export interface OcrImageJob {
  id: string;
  imageIndex: number;
  fileName: string;
  imageSrc: string;
  pageNumber?: number | null;
  totalPages?: number | null;
  status: OcrJobStatus;
  text: string;
  confidence?: number;
  error?: string;
  retryCount: number;
  durationMs?: number;
  detectedSections: string[];
}

export interface RawPage {
  pageNumber: number;
  imageIndex: number;
  fileName?: string;
  text: string;
  characterCount: number;
  detectedSections: string[];
}

export interface StitchedPageMetadata {
  pageNumber: number;
  totalPages?: number | null;
  originalIndex: number;
  sourceIndex?: number;
  fileName?: string;
  width: number;
  height: number;
  yStart: number;
  yEnd: number;
  yOffset?: number;
}

export interface StitchedImageInfo {
  stitchedImageSrc: string;
  dataUrl?: string;
  totalWidth: number;
  totalHeight: number;
  canvasWidth?: number;
  canvasHeight?: number;
  pageCount: number;
  totalPages?: number;
  pages: StitchedPageMetadata[];
  pageOrderDescription: string;
}

export interface OcrCompleteness {
  pagesReceived: number;
  pagesStitched: number;
  ocrCompleted: boolean;
  sectionsDetected: string[];
  missingExpectedSections: string[];
  warnings: string[];
  completenessScore: number;
}

export interface OcrCoverage {
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  totalPagesDetected: number;
  pagesMissing: number[];
  sectionsDetected: string[];
  isComplete: boolean;
  warnings: string[];
}

export interface MorphologySurveyV2 {
  duong_giua?: string;
  vach_trong_suot?: string;
  long_nguc_cot_song?: string;
  phoi?: string;
  thanh_bung_truoc?: string;
  tim_4_buong?: string;
  vach_lien_that?: string;
  mach_mau_lon?: string;
  threeVV?: string;
  da_day?: string;
  than?: string;
  bang_quang?: string;
  day_ron?: string;
  cac_chi?: string;
  bod?: string;
  nbl?: string;
}

export interface ConclusionDetailsV2 {
  ket_luan_1?: string;
  ket_luan_2?: string;
  ket_luan_3?: string;
  hen_kham_lai?: string;
}

export interface UltrasoundReport {
  id: string;
  createdAt: string;
  updatedAt: string;
  patient: PatientInfo;
  measurements: Measurements2D;
  efw: FetalWeightEFW;
  doppler: DopplerValues;
  fetalCount?: number; // 1 = Đơn thai, 2 = Song thai, 3 = Tam thai
  fetuses?: FetusInfo[];
  amnioticFluid: AmnioticFluidData;
  placenta: PlacentaData;
  anatomy: AnatomyChecklist;
  calculations: CalculatedRatios;
  detectedCategory:
    | 'dynamic_v2'
    | 'early_pregnancy_under_12w'
    | 'screening_1st_trimester_12_13w6d'
    | 'morphology_14_32w'
    | 'growth_doppler_over_32w'
    | 'amniotic_cervix'
    | 'gynecology'
    | 'early_pregnancy'
    | '1st_trimester_screening'
    | 'morphology_2d_3d_4d'
    | 'doppler_afi'
    | 'general_obstetric'
    | string;
  conclusion: string;
  recommendations: string;
  imageUrls: string[];
  extractionSource?: 'online_ai' | 'offline_ocr' | 'manual';
  rawTextDump?: string;
  rawPages?: RawPage[];
  stitchedImageInfo?: StitchedImageInfo;
  stitchedImage?: StitchedImageInfo;
  dopplerCalculations?: DopplerCalculationsItem[];
  ocrCompleteness?: OcrCompleteness;
  ocrCoverage?: OcrCoverage;
  ocrJobs?: OcrImageJob[];
  _validationLogs?: UltrasoundValidationLog;
  customMeasurements?: Record<string, any>;
  originalOcrData?: OriginalOcrData;
  cervicalLength?: CervicalLengthData;
  additionalImages?: { url: string; description: string; }[];
  pregnancyDating?: PregnancyDating;
  // Dynamic V2 Word Template specific fields
  fetalMovement?: string; // Cử động thai: Bình thường / Tích cực / (+)
  fetalPresentation?: string; // Ngôi thai: Đầu / Mông / Ngang
  surveyMilestone?: string; // Mốc khảo sát: 12T / Hình thái / Tăng trưởng / Tổng hợp
  hideDoppler?: boolean; // Ẩn Doppler trên phiếu in
  hideCervix?: boolean; // Ẩn Cổ tử cung trên phiếu in
  morphologyV2?: MorphologySurveyV2;
  conclusionV2?: ConclusionDetailsV2;
  biometryNotes?: Record<string, string>;
}

export interface Service {
  id: string;
  name: string;
  price: number;
}

export interface ServiceUsage {
  id: string;
  serviceId: string;
  date: string; // ISO date string
  count: number;
}
