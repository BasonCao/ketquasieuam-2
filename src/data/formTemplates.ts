import { UltrasoundReport } from '../types/ultrasound';

export interface FormTemplateInfo {
  id: string;
  name: string;
  code: string;
  badge: string;
  badgeColor: 'emerald' | 'amber' | 'cyan' | 'purple' | 'blue' | 'rose';
  ageBracket: '<12w' | '12-13w6d' | '14-32w' | '>32w' | 'custom' | 'gyn';
  description: string;
  applicableGestationalAge: string;
  primaryIndicators: string[];
  keySections: string[];
  recommendedConclusion: string;
  defaultDataPreset: Partial<UltrasoundReport>;
  isCustom?: boolean;
}

export const FORM_TEMPLATES: FormTemplateInfo[] = [
  // 0. Mẫu Chung Siêu Âm 5D Dynamic v2.0 (BS Cao Bá Sơn)
  {
    id: 'dynamic_v2',
    name: 'Mẫu Chung Siêu Âm 5D Dynamic v2.0 (BS Cao Bá Sơn)',
    code: 'FORM-5D-DYNAMIC-V2',
    badge: 'Mẫu Chung 5D V2.0 (Chuẩn Động BS Sơn)',
    badgeColor: 'cyan',
    ageBracket: 'custom',
    description:
      'Mẫu phiếu kết quả siêu âm 5D động toàn diện chuẩn BS Cao Bá Sơn theo mẫu Word Form_chung_Sieu_am_5D_Dynamic_v2. Tự động điền đầy đủ dữ liệu từ OCR/AI, ưu tiên tuyệt đối IVF/ART, hiển thị đầy đủ Sinh trắc học, Hình thái học, Doppler, Kết luận và Hình ảnh.',
    applicableGestationalAge: 'Tất cả các mốc thai kỳ (12T / Hình thái / Tăng trưởng / Tổng hợp)',
    primaryIndicators: ['GA IVF/LMP', 'EFW (GP%)', 'BPD', 'HC', 'AC', 'FL', 'HL', 'Foot', 'Cereb', 'CM', 'Vp', 'NBL', 'BOD', 'Doppler UA/MCA/UtA', 'Hình thái 5D'],
    keySections: [
      '1. Thông tin bệnh nhân & Thai kỳ / IVF Dating',
      '2. Thông tin điều khiển phiếu động',
      '3. Sinh trắc học thai & Cân nặng EFW',
      '4. Khảo sát hình thái học thai 5D chi tiết',
      '5. Doppler mạch máu & Thông số bổ sung',
      '6. Kết luận & Lời dặn dò',
      '7. Hình ảnh siêu âm lưu kèm',
    ],
    recommendedConclusion:
      'Trong buồng tử cung có 01 thai sống phát triển tương đương {GA}, cân nặng ước tính EFW = {EFW}g (ở bách phân vị {PERCENTILE}). Hiện tại không thấy bất thường về hình thái thai trên siêu âm.',
    defaultDataPreset: {
      detectedCategory: 'dynamic_v2',
      surveyMilestone: 'Hình thái học & Tăng trưởng',
      fetalMovement: 'Bình thường (+)',
      fetalPresentation: 'Đầu',
      fetalCount: 1,
      hideDoppler: false,
      hideCervix: false,
      patient: {
        indication: 'Siêu âm 5D - Khảo sát hình thái & tăng trưởng thai nhi',
        gender: 'Nữ',
        clinicHeader: 'BS CAO BÁ SƠN - SIÊU ÂM 5D CHUYÊN SÂU\nHD57 Hải Đăng 9 - Vinhomes Ocean Park\nHotline: 0967.275.799',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '1',
        para: '0',
        abortion: '0',
        ectopic: '0',
      },
      morphologyV2: {
        duong_giua: 'Cân đối, liên tục',
        vach_trong_suot: 'Hiện diện (+)',
        long_nguc_cot_song: 'Cân đối, liên tục',
        phoi: 'Nhu mô đều, không tràn dịch',
        thanh_bung_truoc: 'Kín, không thoát vị',
        tim_4_buong: 'Cân đối, 4 buồng rõ',
        vach_lien_that: 'Kín, không khuyết tật',
        mach_mau_lon: 'Xuất phát bình thường',
        threeVV: '3 mạch máu và khí quản bình thường',
        da_day: 'Dưới vòm hoành trái (+)',
        than: 'Hai thận vị trí bình thường, không giãn',
        bang_quang: 'Hiện diện trong tiểu khung (+)',
        day_ron: '3 mạch máu (2 ĐM, 1 TM)',
        cac_chi: 'Đủ 4 chi, mỗi chi 3 đoạn, bàn tay bàn chân (+)',
      },
      conclusionV2: {
        ket_luan_1: 'Trong buồng tử cung có 01 thai phát triển tương đương {GA}, bách phân vị {PERCENTILE}.',
        ket_luan_2: 'Hiện tại không thấy bất thường về hình thái thai trên siêu âm.',
        ket_luan_3: 'Chưa thấy bất thường đặc biệt.',
        hen_kham_lai: '4',
      },
    },
  },

  // 1. Thai < 12 tuần
  {
    id: 'early_pregnancy_under_12w',
    name: 'Mẫu 1: Siêu Âm Thai Sớm & Phôi Thai (< 12 tuần)',
    code: 'FORM-EARLY-UNDER-12W',
    badge: 'Thai < 12 tuần (GS, YS, CRL, Tim thai)',
    badgeColor: 'emerald',
    ageBracket: '<12w',
    description:
      'Chẩn đoán vị trí túi thai trong buồng tử cung, đường kính túi thai GS, túi noãn hoàng YS, chiều dài đầu mông phôi thai CRL, hoạt động tim thai sớm FHR và tỷ lệ tụ dịch/bóc tách màng nuôi.',
    applicableGestationalAge: 'Thai < 12 tuần (5w - 11w6d, CRL < 45mm)',
    primaryIndicators: ['GS', 'YS', 'CRL', 'FHR', 'Vị trí bám', 'Màng nuôi', 'Bóc tách (%)'],
    keySections: [
      'Vị trí & kích thước túi thai GS',
      'Túi noãn hoàng YS',
      'Phôi thai & Chiều dài đầu mông CRL',
      'Hoạt động tim thai FHR',
      'Buồng trứng & Túi cùng sau',
    ],
    recommendedConclusion:
      'Một thai sống trong buồng tử cung phát triển tương đương {GA}. Túi thai bờ đều, túi noãn hoàng YS và phôi thai phát triển tốt (CRL = {CRL}mm). Tim thai dương tính, tần số {FHR} lần/phút (Đều, rõ). Chưa thấy hình ảnh bóc tách màng nuôi quanh túi thai. Hai buồng trứng bình thường.',
    defaultDataPreset: {
      detectedCategory: 'early_pregnancy',
      patient: {
        indication: 'Kiểm tra vị trí túi thai, phôi thai và hoạt động tim thai sớm',
        gender: 'Nữ',
        clinicHeader: 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '1',
        para: '0',
        abortion: '0',
        ectopic: '0',
      },
      measurements: {
        gs: { value: 28.5, unit: 'mm', method: 'Rempen', gaAge: '7w6d', name: 'Đường kính túi thai (GS)' },
        ys: { value: 4.1, unit: 'mm', name: 'Túi noãn hoàng (YS)' },
        crl: { value: 14.8, unit: 'mm', method: 'Hadlock', gaAge: '7w6d', name: 'Chiều dài đầu mông (CRL)' },
        nt: { value: null, unit: 'mm' },
        bpd: { value: null, unit: 'mm' },
        ofd: { value: null, unit: 'mm' },
        hc: { value: null, unit: 'mm' },
        ac: { value: null, unit: 'mm' },
        fl: { value: null, unit: 'mm' },
        hl: { value: null, unit: 'mm' },
        tcd: { value: null, unit: 'mm' },
        cm: { value: null, unit: 'mm' },
        vp: { value: null, unit: 'mm' },
        nbl: { value: null, unit: 'mm' },
        bod: { value: null, unit: 'mm' },
        foot: { value: null, unit: 'mm' },
        cervixLength: { value: 3.6, unit: 'cm', name: 'Chiều dài kênh cổ tử cung' },
      },
      efw: { value: null, unit: 'g' },
      doppler: {
        fhr: { value: 152, unit: 'bpm', name: 'Ventricular FHR' },
        leftUterine: {},
        rightUterine: {},
        umbilicalArtery: {},
        middleCerebralArtery: {},
      },
      amnioticFluid: {
        q1: { value: null, unit: 'mm' },
        q2: { value: null, unit: 'cm' },
        q3: { value: null, unit: 'cm' },
        q4: { value: null, unit: 'cm' },
        afi: { value: null, unit: 'mm' },
        sdp: { value: null, unit: 'cm' },
        status: 'Bình thường',
      },
      placenta: {
        location: 'Đang hình thành',
        grade: 'Độ 0',
        thickness: null,
        abnormalities: 'Bờ túi thai căng tròn, phản ứng màng rụng tốt, không có tụ dịch quanh túi thai',
      },
      anatomy: {
        skullBrain: 'Phôi thai phát triển rõ trong buồng ối',
        faceEyesNose: 'Chưa khảo sát ở tuổi thai này',
        chestHeart: 'Hoạt động tim thai dương tính, tần số đều rõ 152 lần/phút',
        abdomenStomachBladder: 'Thành bụng kín',
        spine: 'Đang phát triển theo tuổi thai',
        limbs: 'Mầm chi đang phát triển',
      },
      conclusion:
        'Một thai sống trong buồng tử cung phát triển tương đương 7 tuần 6 ngày. Đã có túi noãn hoàng YS = 4.1 mm, chiều dài phôi CRL = 14.8 mm. Tim thai dương tính, tần số 152 lần/phút (Đều, rõ). Không thấy hình ảnh bóc tách màng nuôi quanh túi thai. Hai buồng trứng bình thường.',
      recommendations:
        'Uống bổ sung Acid Folic, dưỡng thai theo chỉ định. Tái khám và siêu âm mốc quan trọng 12 - 13 tuần 6 ngày để đo độ mờ da gáy NT và làm sàng lọc Double Test / NIPT.',
    },
  },

  // 2. Thai 12 - 13w6d
  {
    id: 'screening_1st_trimester_12_13w6d',
    name: 'Mẫu 2: Siêu Âm Sàng Lọc Quý 1 (12w - 13w6d)',
    code: 'FORM-1ST-TRIMESTER-12-13W6D',
    badge: 'Thai 12 - 13w6d (Đo NT, NBL & Doppler ĐMTC)',
    badgeColor: 'amber',
    ageBracket: '12-13w6d',
    description:
      'Chuyên biệt cho mốc vàng 12w0d - 13w6d: đo độ mờ da gáy NT, xương mũi NBL, góc trán hàm, sóng a ống tĩnh mạch (DV), Doppler ĐM tử cung hai bên tầm soát tiền sản giật sớm.',
    applicableGestationalAge: '12 tuần 0 ngày - 13 tuần 6 ngày (CRL 45 - 84mm)',
    primaryIndicators: ['CRL', 'NT', 'NBL', 'BPD', 'FHR', 'Doppler ĐMTC Trái/Phải', 'Ductus Venosus'],
    keySections: [
      'Chiều dài đầu mông CRL & GA',
      'Đo độ mờ da gáy NT chuẩn FMF',
      'Xương mũi NBL & Góc mặt',
      'Doppler ĐM Tử Cung tầm soát Tiền sản giật',
      'Đánh giá nguy cơ lệch bội',
    ],
    recommendedConclusion:
      'Một thai sống trong buồng tử cung phát triển tương đương {GA}. Chiều dài đầu mông CRL = {CRL} mm. Độ mờ da gáy NT = {NT} mm (Trong giới hạn bình thường < 2.5mm, nguy cơ thấp lệch bội NST Hội chứng Down). Xương mũi hiện diện (+). Doppler ĐM tử cung hai bên bình thường, không có khuyết tiền tâm trương.',
    defaultDataPreset: {
      detectedCategory: '1st_trimester_screening',
      patient: {
        indication: 'Siêu âm sàng lọc trước sinh 12 - 13 tuần 6 ngày (Đo NT, NBL, Doppler ĐMTC)',
        gender: 'Nữ',
        clinicHeader: 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '1',
        para: '0',
        abortion: '0',
        ectopic: '0',
      },
      measurements: {
        gs: { value: null, unit: 'mm' },
        ys: { value: null, unit: 'mm' },
        crl: { value: 65.2, unit: 'mm', method: 'Hadlock', gaAge: '12w6d', percentile: '48.0%', name: 'Chiều dài đầu mông (CRL)' },
        nt: { value: 1.38, unit: 'mm', name: 'Độ mờ da gáy (NT)' },
        bpd: { value: 20.4, unit: 'mm', method: 'Hadlock', gaAge: '13w1d', name: 'Đường kính lưỡng đỉnh (BPD)' },
        ofd: { value: null, unit: 'mm' },
        hc: { value: 74.0, unit: 'mm', method: 'INTERGRW', name: 'Chu vi đầu (HC)' },
        ac: { value: 64.5, unit: 'mm', method: 'Hadlock', gaAge: '12w6d', name: 'Chu vi bụng (AC)' },
        fl: { value: 7.6, unit: 'mm', method: 'Osaka', name: 'Chiều dài xương đùi (FL)' },
        hl: { value: 8.2, unit: 'mm', method: 'Jeanty', name: 'Xương cánh tay (HL)' },
        tcd: { value: null, unit: 'mm' },
        cm: { value: null, unit: 'mm' },
        vp: { value: null, unit: 'mm' },
        nbl: { value: 2.9, unit: 'mm', method: 'Sonek', name: 'Chiều dài xương mũi (NBL)' },
        bod: { value: 13.6, unit: 'mm', method: 'Jeanty', name: 'Đường kính 2 hốc mắt (BOD)' },
        foot: { value: 11.8, unit: 'mm', method: 'Chitty', name: 'Chiều dài bàn chân (Foot)' },
        cervixLength: { value: 3.7, unit: 'cm', name: 'Chiều dài kênh cổ tử cung' },
      },
      efw: {
        value: 68,
        unit: 'g',
        range: '± 10g',
        gaAge: '12w6d',
        percentile: 'AGA',
      },
      doppler: {
        fhr: { value: 162, unit: 'bpm', name: 'Ventricular FHR' },
        leftUterine: { ps: 80.5, ed: 15.2, ri: 0.81, pi: 2.02, sd: 5.3, notch: false },
        rightUterine: { ps: 72.0, ed: 13.8, ri: 0.80, pi: 1.98, sd: 5.2, notch: false },
        umbilicalArtery: {},
        middleCerebralArtery: {},
      },
      amnioticFluid: {
        q1: { value: null, unit: 'mm' },
        q2: { value: null, unit: 'cm' },
        q3: { value: null, unit: 'cm' },
        q4: { value: null, unit: 'cm' },
        afi: { value: null, unit: 'mm' },
        sdp: { value: 3.9, unit: 'cm' },
        status: 'Bình thường',
      },
      placenta: {
        location: 'Mặt sau tử cung',
        grade: 'Độ 0',
        thickness: 16,
        abnormalities: 'Bình thường, mép dưới chưa che lấp lỗ trong CTC',
      },
      anatomy: {
        skullBrain: 'Vòm sọ hình oval liên tục, cánh bướm đám rối màng mạch 2 bên cân đối',
        faceEyesNose: 'Góc trán - hàm bình thường, xương mũi hiện diện NBL = 2.9mm, vòm môi trên liên tục',
        chestHeart: 'Nhịp tim thai đều rõ 162 bpm, phổ Doppler ống tĩnh mạch (Ductus Venosus) sóng a dương tính',
        abdomenStomachBladder: 'Thành bụng đóng kín, bóng dạ dày thấy rõ trong ổ bụng, cuống rốn bám đúng vị trí',
        spine: 'Cột sống liên tục, da bao phủ đều',
        limbs: 'Cử động thai tích cực, quan sát đủ 4 chi với các đoạn chi phát triển tốt',
      },
      conclusion:
        'Một thai sống trong buồng tử cung phát triển tương đương 12 tuần 6 ngày. Chiều dài đầu mông CRL = 65.2 mm. Độ mờ da gáy NT = 1.38 mm (Trong giới hạn bình thường < 2.5mm, nguy cơ thấp lệch bội NST). Xương mũi hiện diện NBL = 2.9 mm. Doppler ĐM tử cung hai bên chỉ số trở kháng bình thường không có notch.',
      recommendations:
        'Làm xét nghiệm sàng lọc trước sinh (NIPT hoặc Double Test kết hợp). Tái khám và siêu âm hình thái học chi tiết ở mốc 20 - 22 tuần.',
    },
  },

  // 3. Thai 14 - 32 tuần
  {
    id: 'morphology_14_32w',
    name: 'Mẫu 3: Siêu Âm Hình Thái Học 4D Toàn Diện (14 - 32 tuần)',
    code: 'FORM-MORPHOLOGY-14-32W',
    badge: 'Thai 14 - 32 tuần (Hình thái 4D & 6 hệ cơ quan)',
    badgeColor: 'cyan',
    ageBracket: '14-32w',
    description:
      'Khảo sát chi tiết dị tật hình thái học 6 hệ cơ quan (não/thần kinh, mặt/môi, tim 4 buồng & đường thoát, bụng/thành bụng, cột sống, 4 chi đủ 3 đoạn), sinh trắc học Hadlock (BPD, HC, AC, FL, HL, TCD, Vp, CM, NBL, BOD, Bàn chân), ước tính cân nặng EFW Hadlock, bánh rau và nước ối.',
    applicableGestationalAge: '14w - 32w (Đặc biệt mốc vàng 20 - 22 tuần & 28 - 30 tuần)',
    primaryIndicators: ['BPD', 'HC', 'AC', 'FL', 'HL', 'TCD', 'Vp', 'CM', 'NBL', 'EFW', 'AFI', 'FHR'],
    keySections: [
      'Sinh trắc học 2D đầy đủ (Hadlock)',
      'Ước tính cân nặng Hadlock & Bách phân vị',
      'Khảo sát dị tật 6 hệ cơ quan',
      'Nước ối & Bánh rau',
      'Kết luận hình thái học',
    ],
    recommendedConclusion:
      'Một thai sống ngôi {POSITION} trong buồng tử cung phát triển tương đương {GA}. Nhịp tim thai đều rõ ({FHR} bpm). Cân nặng ước tính {EFW}g (Bách phân vị {PERCENTILE}). Khảo sát hình thái học các cơ quan thai nhi tại thời điểm hiện tại chưa thấy dấu hiệu bất thường.',
    defaultDataPreset: {
      detectedCategory: 'morphology_2d_3d_4d',
      patient: {
        indication: 'Siêu âm khảo sát hình thái học thai nhi 4D chi tiết & sinh trắc định kỳ',
        gender: 'Nữ',
        clinicHeader: 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '1',
        para: '0',
        abortion: '0',
        ectopic: '0',
      },
      measurements: {
        gs: { value: null, unit: 'mm' },
        ys: { value: null, unit: 'mm' },
        crl: { value: null, unit: 'mm' },
        nt: { value: null, unit: 'mm' },
        bpd: { value: 54.5, unit: 'mm', method: 'Hadlock', gaAge: '22w3d', percentile: '46.0%', name: 'Đường kính lưỡng đỉnh (BPD)' },
        ofd: { value: 68.8, unit: 'mm', method: 'Hadlock', name: 'Đường kính trán chẩm (OFD)' },
        hc: { value: 202.0, unit: 'mm', method: 'INTERGRW', gaAge: '22w2d', percentile: '50.0%', name: 'Chu vi đầu (HC)' },
        ac: { value: 179.2, unit: 'mm', method: 'Hadlock', gaAge: '22w4d', percentile: '52.0%', name: 'Chu vi bụng (AC)' },
        fl: { value: 38.8, unit: 'mm', method: 'Osaka', gaAge: '22w2d', percentile: '48.0%', name: 'Chiều dài xương đùi (FL)' },
        hl: { value: 36.5, unit: 'mm', method: 'Jeanty', gaAge: '22w2d', percentile: '46.0%', name: 'Xương cánh tay (HL)' },
        tcd: { value: 23.6, unit: 'mm', method: 'Hill', gaAge: '22w4d', name: 'Tiểu não (Cereb)' },
        cm: { value: 5.3, unit: 'mm', name: 'Bể lớn hố sau (CM)' },
        vp: { value: 6.2, unit: 'mm', name: 'Não thất bên (Vp)' },
        nbl: { value: 6.9, unit: 'mm', method: 'Sonek', name: 'Chiều dài xương mũi (NBL)' },
        bod: { value: 34.5, unit: 'mm', method: 'Jeanty', name: 'Đường kính 2 hốc mắt (BOD)' },
        foot: { value: 39.2, unit: 'mm', method: 'Chitty', name: 'Chiều dài bàn chân (Foot)' },
        cervixLength: { value: 3.85, unit: 'cm', name: 'Chiều dài kênh cổ tử cung' },
      },
      efw: {
        value: 535,
        unit: 'g',
        range: '± 75g',
        gaAge: '22w2d',
        percentile: '50th',
        formula: 'Hadlock (AC/FL/HC)',
      },
      doppler: {
        fhr: { value: 148, unit: 'bpm', name: 'Ventricular FHR' },
        leftUterine: { ri: 0.52, pi: 0.82, sd: 2.1 },
        rightUterine: { ri: 0.50, pi: 0.79, sd: 2.0 },
        umbilicalArtery: { ri: 0.65, pi: 0.98, sd: 2.8 },
        middleCerebralArtery: { ri: 0.78, pi: 1.62, psv: 32.4 },
      },
      amnioticFluid: {
        q1: { value: 35, unit: 'mm' },
        q2: { value: 38, unit: 'mm' },
        q3: { value: 32, unit: 'mm' },
        q4: { value: 35, unit: 'mm' },
        afi: { value: 140, unit: 'mm' },
        sdp: { value: 4.5, unit: 'cm' },
        status: 'Bình thường',
      },
      placenta: {
        location: 'Mặt sau đáy tử cung',
        grade: 'Độ I',
        thickness: 25,
        abnormalities: 'Bình thường, không thấy khối tụ dịch sau rau',
      },
      anatomy: {
        skullBrain: 'Hộp sọ hình oval liên tục, vách trong suốt hiện diện, não thất bên Vp = 6.2mm (<10mm), tiểu não và bể lớn bình thường',
        faceEyesNose: 'Hai hốc mắt cân đối, xương mũi hiện diện NBL = 6.9mm, môi trên liên tục không thấy sứt môi - hở hàm ếch',
        chestHeart: 'Cấu trúc 4 buồng tim cân đối, nhịp tim đều 148 bpm, đường thoát thất trái và thất phải bình thường, trục tim ~45 độ',
        abdomenStomachBladder: 'Dạ dày và bàng quang nằm trong ổ bụng, thành bụng đóng kín, 3 mạch máu dây rốn',
        spine: 'Cột sống liên tục, cung sau các đốt sống đều đặn từ cổ đến cùng cụt',
        limbs: 'Đủ 4 chi, mỗi chi đủ 3 đoạn, bàn tay bàn chân tư thế bình thường, cử động thai tốt',
      },
      conclusion:
        'Một thai sống ngôi đầu trong buồng tử cung phát triển tương đương 22 tuần 2 ngày. Nhịp tim thai đều rõ 148 lần/phút. Ước tính cân nặng 535g (Bách phân vị 50%). Hình thái học các cơ quan thai nhi tại thời điểm khảo sát chưa thấy dấu hiệu dị tật bất thường.',
      recommendations:
        'Tái khám và siêu âm kiểm tra tăng trưởng thai ở mốc 28 - 30 tuần. Uống bổ sung sắt, canxi, đa vi chất.',
    },
  },

  // 4. Thai > 32 tuần
  {
    id: 'growth_doppler_over_32w',
    name: 'Mẫu 4: Siêu Âm Tăng Trưởng Thai Quý 3 & Doppler Mạch Máu (> 32 tuần)',
    code: 'FORM-GROWTH-DOPPLER-OVER-32W',
    badge: 'Thai > 32 tuần (Tăng trưởng, AFI 4 khoang, Doppler CPR)',
    badgeColor: 'purple',
    ageBracket: '>32w',
    description:
      'Đánh giá tăng trưởng thai muộn & chậm phát triển (IUGR/FGR), Bách phân vị cân nặng EFW Hadlock, Đánh giá chi tiết 4 khoang ối AFI (Q1-Q4) / SDP, Doppler ĐM rốn UA (RI, PI, S/D, EDV), Doppler ĐM não giữa MCA (PSV, PI, MoM), Tỷ số Não - Rốn (CPR), Chiều dài kênh CTC và Ngôi thai chuẩn bị sinh.',
    applicableGestationalAge: 'Thai > 32 tuần (32w0d - 41w)',
    primaryIndicators: ['EFW', 'AFI (4 khoang)', 'Doppler UA (RI/PI/SD/EDV)', 'Doppler MCA (PSV/MoM)', 'CPR', 'BPD/AC/FL', 'Kênh CTC'],
    keySections: [
      'Sinh trắc học Quý 3 & Bách phân vị EFW',
      'Đánh giá nước ối 4 khoang (AFI Q1-Q4)',
      'Doppler huyết động học (UA, MCA, CPR)',
      'Bánh rau & Chiều dài kênh cổ tử cung',
      'Kết luận đánh giá sức khỏe thai trước sinh',
    ],
    recommendedConclusion:
      'Một thai sống ngôi đầu tương đương {GA}. Cân nặng ước tính {EFW}g (Bách phân vị {PERCENTILE}). Chỉ số ối 4 khoang AFI = {AFI} mm ({STATUS_OI}). Doppler ĐM Rốn (UA): RI = 0.58, PI = 0.86, S/D = 2.38 (Sóng cuối tâm trương dương tính). Doppler Não Giữa (MCA): PSV = 51.2 cm/s (Không thiếu máu thai). Tỷ số Não-Rốn CPR bình thường. Chưa thấy dấu hiệu suy thai hay suy bánh rau.',
    defaultDataPreset: {
      detectedCategory: 'doppler_afi',
      patient: {
        indication: 'Siêu âm đánh giá tăng trưởng thai quý 3, nước ối và Doppler mạch máu thai',
        gender: 'Nữ',
        clinicHeader: 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '1',
        para: '0',
        abortion: '0',
        ectopic: '0',
      },
      measurements: {
        gs: { value: null, unit: 'mm' },
        ys: { value: null, unit: 'mm' },
        crl: { value: null, unit: 'mm' },
        nt: { value: null, unit: 'mm' },
        bpd: { value: 85.5, unit: 'mm', method: 'Hadlock', gaAge: '34w2d', percentile: '50.0%', name: 'Đường kính lưỡng đỉnh (BPD)' },
        ofd: { value: 104.0, unit: 'mm', method: 'Hadlock', name: 'Đường kính trán chẩm (OFD)' },
        hc: { value: 310.0, unit: 'mm', method: 'Hadlock', gaAge: '34w1d', percentile: '51.0%', name: 'Chu vi đầu (HC)' },
        ac: { value: 298.5, unit: 'mm', method: 'Hadlock', gaAge: '34w0d', percentile: '49.0%', name: 'Chu vi bụng (AC)' },
        fl: { value: 65.8, unit: 'mm', method: 'Hadlock', gaAge: '34w1d', percentile: '50.0%', name: 'Chiều dài xương đùi (FL)' },
        hl: { value: 58.5, unit: 'mm', name: 'Xương cánh tay (HL)' },
        tcd: { value: 41.0, unit: 'mm', name: 'Tiểu não (TCD)' },
        cm: { value: 6.2, unit: 'mm', name: 'Bể lớn (CM)' },
        vp: { value: 6.5, unit: 'mm', name: 'Não thất bên (Vp)' },
        nbl: { value: null, unit: 'mm' },
        bod: { value: null, unit: 'mm' },
        foot: { value: 67.0, unit: 'mm', name: 'Bàn chân (Foot)' },
        cervixLength: { value: 3.65, unit: 'cm', name: 'Chiều dài kênh cổ tử cung' },
      },
      efw: {
        value: 2320,
        unit: 'g',
        range: '± 230g',
        gaAge: '34w1d',
        percentile: '50th',
        formula: 'Hadlock (AC/FL/HC)',
      },
      doppler: {
        fhr: { value: 145, unit: 'bpm', name: 'Ventricular FHR' },
        leftUterine: { ps: 76.0, ed: 22.5, ri: 0.50, pi: 0.76, sd: 2.01, notch: false },
        rightUterine: { ps: 74.0, ed: 21.8, ri: 0.49, pi: 0.74, sd: 1.98, notch: false },
        umbilicalArtery: { ri: 0.57, pi: 0.84, sd: 2.32, edv: 'Dương tính' },
        middleCerebralArtery: { ri: 0.72, pi: 1.45, psv: 53.5, mom: 1.04 },
      },
      amnioticFluid: {
        q1: { value: 38, unit: 'mm' },
        q2: { value: 42, unit: 'mm' },
        q3: { value: 35, unit: 'mm' },
        q4: { value: 39, unit: 'mm' },
        afi: { value: 154, unit: 'mm' },
        sdp: { value: 4.8, unit: 'cm' },
        status: 'Bình thường',
      },
      placenta: {
        location: 'Mặt sau tử cung nhóm I',
        grade: 'Độ II',
        thickness: 32,
        abnormalities: 'Bình thường, mép dưới cách lỗ trong CTC an toàn',
      },
      anatomy: {
        skullBrain: 'Cấu trúc não bộ bình thường, vòm sọ liên tục',
        faceEyesNose: 'Bình thường',
        chestHeart: 'Tim thai 4 buồng cân đối, nhịp tim đều 145 l/p',
        abdomenStomachBladder: 'Dạ dày, bàng quang bình thường',
        spine: 'Liên tục',
        limbs: 'Cử động thai tốt',
      },
      conclusion:
        'Một thai sống ngôi đầu phát triển tương đương 34 tuần 1 ngày. Cân nặng ước tính 2320g (Bách phân vị 50%). Chỉ số ối 4 khoang AFI = 154 mm (Lượng nước ối trong giới hạn bình thường). Doppler ĐM Rốn (UA: RI = 0.57, PI = 0.84, S/D = 2.32, sóng cuối tâm trương dương tính tốt); Doppler Não Giữa (MCA: PSV = 53.5 cm/s ~ 1.04 MoM); Tỷ số CPR bình thường. Chưa thấy dấu hiệu suy thai hay suy tuần hoàn bánh rau.',
      recommendations:
        'Theo dõi thai máy hằng ngày (tối thiểu 4 lần cử động rõ trong 1 giờ nghỉ ngơi). Tái khám sau 1 - 2 tuần hoặc khi có các dấu hiệu bất thường (đau bụng từng cơn, ra nước ối, ra máu).',
    },
  },

  // 5. Đánh giá ối & kênh CTC
  {
    id: 'amniotic_cervix',
    name: 'Mẫu 5: Đánh Giá 4 Khoang Ối (AFI) & Chiều Dài Kênh Cổ Tử Cung',
    code: 'FORM-AFI-CERVIX',
    badge: 'Theo dõi Nước ối & Kênh CTC phòng sinh non',
    badgeColor: 'blue',
    ageBracket: 'custom',
    description:
      'Đo chi tiết 4 góc ối Q1, Q2, Q3, Q4, tính tổng chỉ số ối AFI, độ sâu xoang ối lớn nhất SDP, chiều dài kênh cổ tử cung và hình thái lỗ trong CTC (T, Y, V, U shape).',
    applicableGestationalAge: '24w - 40w',
    primaryIndicators: ['Q1', 'Q2', 'Q3', 'Q4', 'AFI (mm)', 'SDP (cm)', 'Kênh CTC (cm)', 'Lỗ trong CTC'],
    keySections: ['Chỉ số ối 4 góc (AFI)', 'Xoang ối lớn nhất (SDP)', 'Chiều dài kênh cổ tử cung', 'Hình thái lỗ trong CTC'],
    recommendedConclusion:
      'Một thai sống ngôi đầu tương đương {GA}. Chỉ số ối 4 khoang AFI = {AFI} mm ({STATUS_OI}). Chiều dài kênh cổ tử cung = {CERVIX} cm (Lỗ trong CTC đóng kín dạng T-shape, nguy cơ sinh non thấp).',
    defaultDataPreset: {
      detectedCategory: 'doppler_afi',
      patient: {
        indication: 'Đánh giá lượng nước ối và đo chiều dài kênh cổ tử cung phòng ngừa sinh non',
        gender: 'Nữ',
        clinicHeader: 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '1',
        para: '0',
        abortion: '0',
        ectopic: '0',
      },
      measurements: {
        gs: { value: null, unit: 'mm' },
        ys: { value: null, unit: 'mm' },
        crl: { value: null, unit: 'mm' },
        nt: { value: null, unit: 'mm' },
        bpd: { value: 78.5, unit: 'mm', method: 'Hadlock', name: 'Đường kính lưỡng đỉnh (BPD)' },
        ofd: { value: null, unit: 'mm' },
        hc: { value: 286.0, unit: 'mm', method: 'Hadlock', name: 'Chu vi đầu (HC)' },
        ac: { value: 270.5, unit: 'mm', method: 'Hadlock', name: 'Chu vi bụng (AC)' },
        fl: { value: 59.8, unit: 'mm', method: 'Hadlock', name: 'Chiều dài xương đùi (FL)' },
        hl: { value: 54.0, unit: 'mm', name: 'Xương cánh tay (HL)' },
        tcd: { value: 37.0, unit: 'mm', name: 'Tiểu não (TCD)' },
        cm: { value: 5.6, unit: 'mm', name: 'Bể lớn (CM)' },
        vp: { value: 6.3, unit: 'mm', name: 'Não thất bên (Vp)' },
        nbl: { value: null, unit: 'mm' },
        bod: { value: null, unit: 'mm' },
        foot: { value: 62.0, unit: 'mm', name: 'Bàn chân (Foot)' },
        cervixLength: { value: 3.82, unit: 'cm', name: 'Chiều dài kênh cổ tử cung' },
      },
      efw: {
        value: 1750,
        unit: 'g',
        range: '± 180g',
        gaAge: '31w2d',
        percentile: '48.0%',
      },
      doppler: {
        fhr: { value: 150, unit: 'bpm', name: 'Ventricular FHR' },
        leftUterine: {},
        rightUterine: {},
        umbilicalArtery: { ri: 0.6, pi: 0.9, sd: 2.5 },
        middleCerebralArtery: { ri: 0.74, pi: 1.5, psv: 46.0 },
      },
      amnioticFluid: {
        q1: { value: 41.7, unit: 'mm' },
        q2: { value: 45.0, unit: 'mm' },
        q3: { value: 39.8, unit: 'mm' },
        q4: { value: 37.3, unit: 'mm' },
        afi: { value: 163.8, unit: 'mm' },
        sdp: { value: 4.8, unit: 'cm' },
        status: 'Bình thường',
      },
      placenta: {
        location: 'Mặt sau tử cung nhóm I',
        grade: 'Độ II',
        thickness: 30,
        abnormalities: 'Bình thường, mép dưới cách lỗ trong CTC an toàn',
      },
      anatomy: {
        skullBrain: 'Cấu trúc não thất và vòm sọ bình thường',
        faceEyesNose: 'Mặt bình thường',
        chestHeart: 'Tim 4 buồng cân đối, nhịp tim đều 150 l/p',
        abdomenStomachBladder: 'Dạ dày, bàng quang bình thường',
        spine: 'Cột sống liên tục',
        limbs: 'Cử động thai tốt',
      },
      conclusion:
        'Một thai sống ngôi đầu trong buồng tử cung phát triển tương đương 31 tuần 2 ngày. Nhịp tim thai đều rõ 150 lần/phút. Cân nặng ước tính 1750g. Chỉ số ối 4 khoang AFI = 163.80 mm (Lượng nước ối trong giới hạn bình thường). Chiều dài kênh cổ tử cung 3.82 cm (Lỗ trong CTC đóng kín dạng T-shape, nguy cơ sinh non thấp).',
      recommendations:
        'Theo dõi thai máy hằng ngày. Tái khám sau 2 tuần hoặc khi có các dấu hiệu bất thường (đau bụng từng cơn, ra dịch nhớt hồng, ra nước ối).',
    },
  },

  // 6. Siêu âm phụ khoa
  {
    id: 'gynecology',
    name: 'Mẫu 6: Siêu Âm Phụ Khoa Tử Cung & Phần Phụ',
    code: 'FORM-GYNECOLOGY',
    badge: 'Phụ Khoa (Tử cung, Nội mạc, Buồng trứng)',
    badgeColor: 'rose',
    ageBracket: 'gyn',
    description:
      'Khảo sát tử cung (tư thế, kích thước, cơ tử cung, niêm mạc nội mạc tử cung), buồng trứng phải, buồng trứng trái (nang noãn, khối u), cổ tử cung và dịch túi cùng sau Douglas.',
    applicableGestationalAge: 'Không mang thai / Khám phụ khoa',
    primaryIndicators: ['Tư thế tử cung', 'Kích thước DAP/Dọc/Ngang', 'Nội mạc (mm)', 'Buồng trứng P/T', 'Túi cùng Douglas'],
    keySections: ['Tử cung & Niêm mạc', 'Cơ tử cung & Cổ tử cung', 'Buồng trứng Phải', 'Buồng trứng Trái', 'Túi cùng Douglas'],
    recommendedConclusion:
      'Tử cung tư thế trung gian, kích thước và cấu trúc cơ tử cung bình thường. Niêm mạc tử cung dày 8.5 mm (Giai đoạn tăng sinh bình thường). Hai buồng trứng bình thường, chưa thấy hình ảnh u nang buồng trứng hay ứ dịch vòi trứng. Túi cùng Douglas không có dịch.',
    defaultDataPreset: {
      detectedCategory: 'general_obstetric',
      patient: {
        indication: 'Khám và siêu âm phụ khoa định kỳ / Đau bụng hạ vị',
        gender: 'Nữ',
        clinicHeader: 'PHÒNG KHÁM SẢN PHỤ KHOA CHUYÊN KHOA',
        sonographer: 'BS. CAO BÁ SƠN',
        examDate: new Date().toLocaleDateString('vi-VN'),
        name: '',
        yearOfBirth: '',
        age: '',
        patientId: '',
        phone: '',
        address: '',
        lmp: '',
        doc: '',
        gaClin: '',
        gaAua: '',
        edd: '',
        gravida: '',
        para: '',
        abortion: '',
        ectopic: '',
      },
      measurements: {
        gs: { value: null, unit: 'mm' },
        ys: { value: null, unit: 'mm' },
        crl: { value: null, unit: 'mm' },
        nt: { value: null, unit: 'mm' },
        bpd: { value: null, unit: 'mm' },
        ofd: { value: null, unit: 'mm' },
        hc: { value: null, unit: 'mm' },
        ac: { value: null, unit: 'mm' },
        fl: { value: null, unit: 'mm' },
        hl: { value: null, unit: 'mm' },
        tcd: { value: null, unit: 'mm' },
        cm: { value: null, unit: 'mm' },
        vp: { value: null, unit: 'mm' },
        nbl: { value: null, unit: 'mm' },
        bod: { value: null, unit: 'mm' },
        foot: { value: null, unit: 'mm' },
        cervixLength: { value: 3.2, unit: 'cm', name: 'Chiều dài cổ tử cung' },
      },
      efw: { value: null, unit: 'g' },
      doppler: {
        fhr: { value: null, unit: 'bpm' },
        leftUterine: {},
        rightUterine: {},
        umbilicalArtery: {},
        middleCerebralArtery: {},
      },
      amnioticFluid: {
        q1: { value: null, unit: 'mm' },
        q2: { value: null, unit: 'cm' },
        q3: { value: null, unit: 'cm' },
        q4: { value: null, unit: 'cm' },
        afi: { value: null, unit: 'mm' },
        sdp: { value: null, unit: 'cm' },
        status: 'Không áp dụng',
      },
      placenta: {
        location: 'Không áp dụng',
        grade: 'Không áp dụng',
        thickness: null,
        abnormalities: 'Không áp dụng',
      },
      anatomy: {
        skullBrain: 'Tử cung: Tư thế trung gian, kích thước DAP: 38mm, Chiều dọc: 52mm, Chiều ngang: 45mm',
        faceEyesNose: 'Cơ tử cung: Đồng nhất, không thấy hình ảnh nhân xơ tử cung hay khối u bất thường',
        chestHeart: 'Nội mạc tử cung: Dày 8.5 mm, hình ảnh 3 lá giai đoạn tăng sinh, bờ rõ nét',
        abdomenStomachBladder: 'Cổ tử cung: Kích thước bình thường, không thấy nang Naboth hay polyp',
        spine: 'Buồng trứng Phải: Kích thước 28 x 18 mm, có vài nang noãn nhỏ đang phát triển',
        limbs: 'Buồng trứng Trái: Kích thước 27 x 17 mm, nhu mô bình thường. Túi cùng Douglas: Không có dịch',
      },
      conclusion:
        'Tử cung tư thế trung gian, kích thước và cấu trúc cơ tử cung bình thường. Niêm mạc tử cung dày 8.5 mm (Giai đoạn tăng sinh bình thường). Hai buồng trứng bình thường, chưa thấy hình ảnh u nang buồng trứng hay ứ dịch vòi trứng. Túi cùng Douglas không có dịch.',
      recommendations:
        'Tái khám phụ khoa định kỳ 6 tháng - 1 năm/lần hoặc khi có các biểu hiện bất thường như rối loạn kinh nguyệt, đau bụng dưới nhiều.',
    },
  },
];

const TEMPLATES_STORAGE_KEY = 'sono_custom_form_templates_v2';

export function getStoredFormTemplates(): FormTemplateInfo[] {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(TEMPLATES_STORAGE_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load custom form templates', e);
  }
  return FORM_TEMPLATES;
}

export function saveFormTemplates(templates: FormTemplateInfo[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
      window.dispatchEvent(new CustomEvent('sono_templates_updated', { detail: templates }));
    }
  } catch (e) {
    console.error('Failed to save form templates', e);
  }
}

/**
 * Helper to get template by ID
 */
export function getTemplateById(id: string): FormTemplateInfo {
  const currentTemplates = getStoredFormTemplates();
  return currentTemplates.find((t) => t.id === id) || FORM_TEMPLATES.find((t) => t.id === id) || FORM_TEMPLATES[2]; // Default to morphology
}

/**
 * Parse gestational age string to numeric weeks and days
 * e.g. "12w3d" -> { weeks: 12, days: 3, totalWeeks: 12.43 }
 * e.g. "15 tuần 4 ngày" -> { weeks: 15, days: 4, totalWeeks: 15.57 }
 * e.g. "12.5w" -> { weeks: 12, days: 3, totalWeeks: 12.5 }
 */
export function parseGestationalAgeWeeks(gaStr?: string): { weeks: number; days: number; totalWeeks: number } | null {
  if (!gaStr || typeof gaStr !== 'string') return null;

  const clean = gaStr.toLowerCase().trim();
  if (!clean) return null;

  // Pattern: 12w3d or 12w+3d or 12w 3d or 12W3D
  const matchWd = clean.match(/(\d+)\s*(?:w|tuần|t)\s*(?:\+|\s*|\,)?\s*(\d+)?\s*(?:d|ngày|n)?/);
  if (matchWd && matchWd[1]) {
    const weeks = parseInt(matchWd[1], 10);
    const days = matchWd[2] ? parseInt(matchWd[2], 10) : 0;
    if (!isNaN(weeks) && weeks > 0 && weeks <= 45) {
      return {
        weeks,
        days: isNaN(days) ? 0 : days,
        totalWeeks: weeks + (isNaN(days) ? 0 : days / 7),
      };
    }
  }

  // Pattern: decimal weeks like 12.5 or 12,5
  const matchDec = clean.match(/(\d+[.,]\d+)/);
  if (matchDec) {
    const total = parseFloat(matchDec[1].replace(',', '.'));
    if (!isNaN(total) && total > 0 && total <= 45) {
      const weeks = Math.floor(total);
      const days = Math.round((total - weeks) * 7);
      return { weeks, days, totalWeeks: total };
    }
  }

  // Pattern: plain number like "12" or "22"
  const matchNum = clean.match(/^(\d+)$/);
  if (matchNum) {
    const weeks = parseInt(matchNum[1], 10);
    if (!isNaN(weeks) && weeks > 0 && weeks <= 45) {
      return { weeks, days: 0, totalWeeks: weeks };
    }
  }

  return null;
}

/**
 * Automatically select the clinical form template based on Gestational Age in Weeks
 * - Thai < 12 tuần (ga < 12w0d)
 * - Thai 12 - 13w6d (12w0d <= ga <= 13w6d)
 * - Thai 14 - 32 tuần (14w0d <= ga <= 32w0d)
 * - Thai > 32 tuần (ga > 32w0d)
 */
export function getTemplateForGestationalAge(gaWeeks: number): FormTemplateInfo {
  if (gaWeeks < 12.0) {
    return getTemplateById('early_pregnancy_under_12w');
  } else if (gaWeeks >= 12.0 && gaWeeks < 14.0) {
    // 12w0d to 13w6d
    return getTemplateById('screening_1st_trimester_12_13w6d');
  } else if (gaWeeks >= 14.0 && gaWeeks <= 32.0) {
    // 14w0d to 32w0d
    return getTemplateById('morphology_14_32w');
  } else {
    // > 32 tuần
    return getTemplateById('growth_doppler_over_32w');
  }
}

/**
 * Smartly detect the best form template from an ultrasound report
 */
export function detectBestTemplate(report: Partial<UltrasoundReport>): {
  template: FormTemplateInfo;
  reason: string;
  detectedAgeWeeks?: number;
} {
  // 1. Try checking patient gestational age string (gaClin or gaAua)
  const gaParsed =
    parseGestationalAgeWeeks(report.patient?.gaClin) ||
    parseGestationalAgeWeeks(report.patient?.gaAua);

  if (gaParsed) {
    const tmpl = getTemplateForGestationalAge(gaParsed.totalWeeks);
    return {
      template: tmpl,
      reason: `Tự động nhận diện theo tuổi thai: ${gaParsed.weeks} tuần ${gaParsed.days > 0 ? `${gaParsed.days} ngày` : ''} (${tmpl.badge})`,
      detectedAgeWeeks: gaParsed.totalWeeks,
    };
  }

  const m = report.measurements;
  if (!m) {
    return {
      template: FORM_TEMPLATES[2], // default morphology 14-32w
      reason: 'Mẫu mặc định: Hình thái 14 - 32 tuần',
    };
  }

  // 2. If NT is present -> 12-13w6d screening
  if (m.nt && m.nt.value && m.nt.value > 0) {
    return {
      template: getTemplateById('screening_1st_trimester_12_13w6d'),
      reason: 'Có chỉ số độ mờ da gáy NT -> Tự động chọn Mẫu Sàng Lọc Quý 1 (12 - 13w6d)',
      detectedAgeWeeks: 12.5,
    };
  }

  // 3. If GS/YS present or CRL < 45mm and no BPD -> Early pregnancy <12w
  if (
    (m.gs?.value || m.ys?.value || (m.crl?.value && m.crl.value < 45)) &&
    !m.bpd?.value &&
    !m.fl?.value
  ) {
    return {
      template: getTemplateById('early_pregnancy_under_12w'),
      reason: 'Có chỉ số túi thai GS / noãn hoàng YS / CRL < 45mm -> Mẫu Thai < 12 tuần',
      detectedAgeWeeks: 8,
    };
  }

  // 4. If CRL is between 45mm and 84mm -> 12-13w6d
  if (m.crl?.value && m.crl.value >= 45 && m.crl.value <= 84 && (!m.fl?.value || m.fl.value < 15)) {
    return {
      template: getTemplateById('screening_1st_trimester_12_13w6d'),
      reason: 'Chiều dài phôi CRL = 45 - 84mm -> Mẫu Sàng Lọc Quý 1 (12 - 13w6d)',
      detectedAgeWeeks: 12.5,
    };
  }

  // 5. If late gestational signs: Doppler MCA / UA or BPD > 82mm or FL > 62mm or EFW > 2000g -> >32w
  if (
    (report.efw?.value && report.efw.value >= 1900) ||
    (m.bpd?.value && m.bpd.value >= 82) ||
    (m.fl?.value && m.fl.value >= 62) ||
    report.doppler?.middleCerebralArtery?.psv ||
    (report.amnioticFluid?.q1?.value && report.amnioticFluid?.q4?.value)
  ) {
    return {
      template: getTemplateById('growth_doppler_over_32w'),
      reason: 'Chỉ số sinh trắc lớn & Doppler mạch máu -> Mẫu Tăng Trưởng Thai Quý 3 (> 32 tuần)',
      detectedAgeWeeks: 34,
    };
  }

  // 6. Default to Morphology 14 - 32 weeks
  return {
    template: getTemplateById('morphology_14_32w'),
    reason: 'Khảo sát hình thái học toàn diện 2D/3D/4D (14 - 32 tuần)',
    detectedAgeWeeks: 22,
  };
}
