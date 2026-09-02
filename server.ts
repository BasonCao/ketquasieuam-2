import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Resilient helper to call Gemini with automatic retry and model fallback on 503 / high demand
async function generateWithFallback(
  client: GoogleGenAI,
  contents: any
) {
  const candidateModels = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          // Short delay on retry for rate-limiting/concurrency spikes
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        const response = await client.models.generateContent({
          model,
          contents,
        });
        if (response?.text) {
          (response as any).modelUsed = model;
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        console.warn(`[Gemini API] Model ${model} attempt ${attempt + 1} failed: ${msg}`);
        
        const isQuotaExceeded = msg.includes('quota') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429');
        if (isQuotaExceeded) {
          console.warn(`[Gemini API] Model ${model} daily/quota limit exceeded. Switching to next model immediately.`);
          break; // Move to next model immediately without wasting time on retry
        }

        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
        if (!isTransient) {
          break; // move to next model immediately for other non-transient errors (e.g. 404 Not Found)
        }
      }
    }
  }

  throw lastError || new Error('Dịch vụ AI đang bận. Hệ thống sẽ tự động chuyển sang chế độ quét Offline.');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for ultrasound images (multi-page)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Route: Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
  });

  // API Route: Extract Ultrasound Data from Images using Gemini 3.7 Flash Vision
  app.post('/api/extract-ultrasound', async (req, res) => {
    try {
      const { images, promptHint } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Không có hình ảnh để phân tích', fallbackAvailable: true });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.status(500).json({
          error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ',
          fallbackAvailable: true,
        });
      }

      // Convert images to GenAI Part format
      const contentsParts: any[] = [];

      for (const imgStr of images) {
        if (typeof imgStr === 'string' && imgStr.startsWith('data:')) {
          const match = imgStr.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            contentsParts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        }
      }

      const systemPrompt = `Bạn là một chuyên gia Y khoa - Bác sĩ chẩn đoán hình ảnh và siêu âm sản phụ khoa cao cấp.
Nhiệm vụ của bạn là đọc và trích xuất TOÀN BỘ số liệu y khoa từ các ảnh màn hình / phiếu in máy siêu âm (GE Voluson, Samsung WS80/HERA, Philips Epiq, Mindray, Aloka, v.v.).

LƯU Ý CỰC KỲ QUAN TRỌNG:
1. CHỈ TRẢ VỀ CÁC CHỈ SỐ CÓ XUẤT HIỆN TRONG ẢNH.
2. NẾU MỘT CHỈ SỐ KHÔNG CÓ TRONG ẢNH, BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA RA HAY ĐƯA CHỈ SỐ ĐÓ VÀO KẾT QUẢ JSON BẰNG NULL.
3. TUYỆT ĐỐI KHÔNG NHẦM CÂN NẶNG EFW VỚI CHỈ SỐ SINH TRẮC HOẶC TÊN BẢNG BÁCH PHÂN VỊ:
   - Dòng EFW (ví dụ "EFW 890g", "AC/FL/HC 890g ±132g 25w6d <1%") là CÂN NẶNG THAI NHI (gam).
   - Tên bảng bách phân vị / reference chart như "Intergrowth(2018/201...)" hay "Hadlock(2018)" KHÔNG PHẢI LÀ CÂN NẶNG EFW = 201g! Cấm trích xuất số "201" trong tên chart thành EFW!
   - Cấm dùng con số EFW (như 890, 741, 65) để gán cho BPD, HC, AC, FL, HL, BOD, Foot!
4. GIỮ NGUYÊN TOÀN BỘ KÝ TỰ BÁCH PHÂN VỊ (<1%, >99%, 1%, 17.5%, 25.6%):
   - Tuyệt đối KHÔNG bỏ dấu '<' hay '>' trong bách phân vị (ví dụ "<1%" KHÔNG được biến thành "1%", ">99%" KHÔNG được biến thành "99%").
5. TUYỆT ĐỐI KHÔNG NHẦM ĐƠN VỊ 'cm' VỚI BỂ LỚN HỐ SAU (CM / Cisterna Magna):
   - Chữ 'cm' trong '1.07 cm' hay '4.5 cm' là ĐƠN VỊ Centimét. Cấm trích xuất thành key 'cm' (Cisterna Magna).
   - Chỉ lấy key 'cm' (Bể lớn hố sau) khi có nhãn đo cấu trúc não thai "CM" hoặc "Cisterna Magna".
6. ĐỐI VỚI CÂN NẶNG EFW (efw):
   - BẮT BUỘC lấy GA/Age (gaAge, ví dụ "25w6d"), Range (ví dụ "±132g") và GP% (percentile, ví dụ "<1%") trực tiếp từ dòng EFW.
   - KHÔNG tự tính toán lại hay làm tròn khác đi. Nếu phiếu ghi "<1%" thì giữ đúng "<1%".

CÁC VÙNG CHỈ SỐ CẦN LƯU Ý TRÍCH XUẤT:
1. VÙNG CÂN NẶNG EFW (Top measurement):
   - Công thức/tổ hợp: ví dụ AC/FL/HC, Hadlock, Hadlock 3.
   - Khối lượng: Lấy chính xác số gam (g), ví dụ: 890g hoặc 741g.
   - Sai số (Range): ví dụ ±132g hoặc ± 110g hoặc ± 15%.
   - Bách phân vị (GP): ví dụ <1% hoặc 33.6% hoặc >99%.
   - Tuổi thai theo EFW (Age): ví dụ 25w6d.

2. VÙNG BẢNG ĐO SINH TRẮC (2D Measurements):
   - BPD, HC, Vp, Cereb/TCD, CM, BOD, NBL, HL, AC, FL, Foot, CRL, NT, GS, YS: Lấy đúng giá trị Value (mm).
   - Giữ nguyên phương pháp đo (method) nếu có (như Hadlock, ASUM, Sonek, Jeanty, Nicolaides, Hill, Chitty).
   - MVP/SDP (Single Deepest Pocket) và AFI: nước ối (mm).
   - Cervix Length (CL): Chiều dài kênh cổ tử cung (mm).

3. VÙNG DOPPLER (Doppler Measurements):
   - Fetal Heart Rate / Ventricular FHR: Nhịp tim thai (fhr) (đơn vị bpm).
   - Umbilical Artery (Động mạch rốn - UA / Umbilical Art.): PS, ED, TAmax, VTI, PI, RI, S/D, HR.
   - Middle Cerebral Artery (Động mạch não giữa - MCA): PS, ED, TAmax, VTI, PI, RI, S/D, HR.
   - Left Uterine & Right Uterine (Động mạch tử cung trái / phải): PS, ED, TAmax, VTI, PI, RI, S/D, HR. Giữ riêng 2 động mạch tử cung trái và phải.
   - Ductus Venosus (Ống tĩnh mạch - DV): S, TAmax, A, D, PI.
   - Doppler Calculations / Ratios: Lấy các tỷ lệ và bách phân vị Doppler nếu có (UmbArt PI, DV a/S, DV PI, DV PLI, DV PVIV, DV S/a, Left UtArt PI, Right UtArt PI, MCA PI, MCA PS, MCA MoM, CPR).

4. THÔNG TIN HÀNH CHÍNH Ở PHẦN ĐẦU:
   - Họ tên, Pat. ID, DOB, Date of Exam, Bác sĩ siêu âm, Tên phòng khám, Tuổi thai lâm sàng GA(EDD), EDD, LMP, IVF Day 3 / Day 5 transfer date.

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc (VÍ DỤ SAU ĐÂY LÀ MẪU, HÃY BỎ NHỮNG TRƯỜNG NÀO TRONG ẢNH KHÔNG CÓ):
{
  "patientName": "Họ và tên bệnh nhân",
  "patientId": "Mã ID bệnh nhân",
  "phone": "Số điện thoại",
  "yearOfBirth": "Năm sinh nếu có",
  "examDate": "Ngày siêu âm DD/MM/YYYY",
  "sonographer": "Bác sĩ siêu âm",
  "clinicHeader": "Tên phòng khám / Bệnh viện",
  "gaClin": "Tuổi thai theo lâm sàng/EDD (ví dụ 30w6d)",
  "edd": "Ngày dự sinh (EDD)",
  "lmp": "Kinh cuối (LMP)",
  "measurements": {
    "bpd": { "value": 70.6, "unit": "mm", "method": "Hadlock", "percentile": "18.6%", "gaAge": "28w2d" },
    "hc": { "value": 255.8, "unit": "mm", "method": "INTERGROWTH-21st", "percentile": "37.3%" },
    "ac": { "value": 215.4, "unit": "mm", "method": "Hadlock", "percentile": "46.2%", "gaAge": "26w0d" },
    "fl": { "value": 46.3, "unit": "mm", "method": "Osaka", "percentile": "60.0%", "gaAge": "25w2d" },
    "hl": { "value": 40.7, "unit": "mm", "method": "ASUM" },
    "bod": { "value": 43.2, "unit": "mm", "method": "Jeanty" },
    "nbl": { "value": 9.1, "unit": "mm", "method": "Sonek" },
    "foot": { "value": 51.5, "unit": "mm", "method": "Chitty" }
  },
  "efw": {
    "value": 890,
    "unit": "g",
    "range": "±132g",
    "percentile": "<1%",
    "method": "Hadlock",
    "formula": "AC/FL/HC",
    "gaAge": "25w6d"
  },
  "doppler": {
    "fhr": { "value": 141, "unit": "bpm" },
    "leftUterine": { "ps": 83.91, "ed": 9.30, "tamax": 24.08, "vti": 197.4, "pi": 3.10, "hr": 73 },
    "rightUterine": { "ps": 65.42, "ed": 15.06, "tamax": 26.85, "vti": 213.1, "pi": 1.88, "hr": 75 },
    "umbilicalArtery": { "ps": 38.88, "ed": 2.20, "tamax": 18.86, "vti": 72.6, "pi": 1.94, "hr": 156 },
    "middleCerebralArtery": { "ps": 52.40, "ed": 9.47, "tamax": 24.17, "vti": 95.8, "pi": 1.78, "hr": 151 },
    "ductusVenosus": { "s": 66.04, "tamax": 57.09, "a": 37.62, "d": 43.37, "pi": 0.50 }
  },
  "calculations": {
    "umbArtPi": 1.94, "umbArtPiPercentile": ">99%",
    "dvAS": 0.57, "dvASPercentile": "13.2%",
    "dvPi": 0.50, "dvPiPercentile": "74.2%",
    "dvPli": 0.43, "dvPliPercentile": "23.8%",
    "dvPviv": 0.66, "dvPvivPercentile": "76.5%",
    "dvSa": 1.76, "dvSaPercentile": "22.6%",
    "leftUtArtPi": 3.10, "leftUtArtPiPercentile": ">99%",
    "rightUtArtPi": 1.88, "rightUtArtPiPercentile": ">99%",
    "mcaPi": 1.78, "mcaPiPercentile": "30.2%",
    "mcaPs": 52.40, "mcaMom": 1.24,
    "cpr": 0.92, "cprPercentile": "<1%"
  }
}`;

      contentsParts.push({
        text: `${systemPrompt}\n${promptHint ? `Lưu ý bổ sung: ${promptHint}` : ''}`,
      });

      const response = await generateWithFallback(client, contentsParts);

      const rawText = response.text || '';
      let parsedData: any = {};

      try {
        const cleanJsonStr = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        parsedData = JSON.parse(cleanJsonStr);
      } catch (parseErr) {
        console.error('Failed to parse Gemini JSON output:', rawText);
        return res.status(500).json({
          error: 'Không thể chuyển đổi dữ liệu từ AI',
          rawText,
          fallbackAvailable: true,
        });
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Error in /api/extract-ultrasound:', err);
      return res.status(500).json({
        error: err.message || 'Lỗi xử lý hình ảnh',
        fallbackAvailable: true,
      });
    }
  });

  // API Route: OCR Stitched Multi-Page Long Image (Image-First Single Vision OCR)
  app.post('/api/ocr-stitched-image', async (req, res) => {
    const startTime = Date.now();
    const payloadSize = Buffer.byteLength(JSON.stringify(req.body));
    console.log('\n[OCR SERVER]\nREQUEST RECEIVED');
    
    try {
      const { stitchedImage, pageCount, width, height } = req.body;
      console.log(`\n[OCR SERVER]\nIMAGE SIZE:\nwidth=${width || 'unknown'}\nheight=${height || 'unknown'}`);
      console.log(`\n[OCR SERVER]\nPAYLOAD SIZE=${payloadSize}`);
      
      if (!stitchedImage || typeof stitchedImage !== 'string') {
        const elapsed = Date.now() - startTime;
        console.log('\n[OCR SERVER]\nRESPONSE');
        console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
        console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
        return res.status(400).json({ error: 'Không có dữ liệu ảnh ghép để OCR', fallbackAvailable: true });
      }

      const client = getGeminiClient();
      if (!client) {
        const elapsed = Date.now() - startTime;
        console.log('\n[OCR SERVER]\nRESPONSE');
        console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
        console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
        return res.status(500).json({
          error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ',
          fallbackAvailable: true,
        });
      }

      const match = stitchedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        const elapsed = Date.now() - startTime;
        console.log('\n[OCR SERVER]\nRESPONSE');
        console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
        console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
        return res.status(400).json({ error: 'Định dạng ảnh không hợp lệ', fallbackAvailable: true });
      }

      const inlinePart = {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };

      const systemPrompt = `Bạn là hệ thống OCR Y khoa Sản Phụ khoa Cao Cấp chuyên dụng cho các phiếu báo cáo siêu âm (GE Voluson, Samsung WS80/HERA, Philips Epiq, Mindray, Aloka).
Ảnh đính kèm là một ảnh báo cáo dài đã được ghép dọc từ ${pageCount || 'nhiều'} trang siêu âm liên tiếp, được phân tách bằng các thanh đánh dấu "========== PAGE X ==========".

Nhiệm vụ:
1. Đọc và trích xuất TOÀN BỘ ký tự, chữ, số, bảng đo 2D, Doppler, Ductus Venosus, Doppler Calculations, thông tin hành chính, tuổi thai theo đúng thứ tự từ trên xuống dưới.
2. BẮT BUỘC giữ nguyên:
   - Các dòng phân tách trang: "========== PAGE X =========="
   - Từng ngắt dòng (line breaks), tên chỉ số, số đo thập phân (ví dụ: 70.6, 255.8, 215.4, 46.3, 40.7, 9.1, 51.5, 66.04, 57.09, 37.62, 43.37, 0.50, 1.76, 0.57, 0.66, 0.43, 268)
   - Ký hiệu bách phân vị (<1%, >99%, 18.6%, 74.2%, 13.2%), dấu so sánh (<, >), dấu chia (/), tỷ lệ (a/S, S/a, S/D, HC/AC, FL/AC, FL/BPD, CPR, MoM)
   - Đơn vị: mm, cm, cm/s, g, bpm, %
3. KHÔNG được bỏ sót bất kỳ trang nào, đặc biệt là các trang phía dưới chứa Ductus Venosus (DV), Doppler Calculations, nước ối (AFI).

Hãy trả về duy nhất một đối tượng JSON hợp lệ:
{
  "rawReportText": "Nội dung OCR đầy đủ của toàn bộ báo cáo từ đầu đến cuối, giữ nguyên phân tách ========== PAGE X ==========",
  "detectedSections": ["patient", "dating", "efw", "measurements", "calculations", "fhr", "ua", "mca", "uterine", "dv", "dopplerCalculations", "amnioticFluid", "cervix", "placenta"]
}`;

      console.log(`\n[OCR SERVER]\nMODEL=gemini-3.7-flash (multiplexed)`);
      console.log('\n[OCR SERVER]\nSTART');
      
      const response = await generateWithFallback(client, [inlinePart, { text: systemPrompt }]);
      const modelUsed = (response as any).modelUsed || 'gemini-3.7-flash';
      console.log(`\n[OCR SERVER]\nMODEL=${modelUsed}`);
      
      const rawOutput = response.text || '';
      let rawReportText = '';
      let detectedSections: string[] = [];

      try {
        const cleanJson = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        rawReportText = parsed.rawReportText || rawOutput;
        detectedSections = Array.isArray(parsed.detectedSections) ? parsed.detectedSections : [];
      } catch {
        rawReportText = rawOutput;
      }

      // Split rawReportText into page chunks based on page markers
      const pageBlocks: { page: number; text: string }[] = [];
      const pageSeparatorRegex = /={5,}\s*PAGE\s*(\d+)[^=]*={5,}/gi;
      let matchMarker;
      const markers: { index: number; pageNumber: number; rawMatch: string }[] = [];

      while ((matchMarker = pageSeparatorRegex.exec(rawReportText)) !== null) {
        markers.push({
          index: matchMarker.index,
          pageNumber: parseInt(matchMarker[1], 10),
          rawMatch: matchMarker[0],
        });
      }

      if (markers.length > 0) {
        for (let i = 0; i < markers.length; i++) {
          const currentMarker = markers[i];
          const startIndex = currentMarker.index + currentMarker.rawMatch.length;
          const endIndex = i + 1 < markers.length ? markers[i + 1].index : rawReportText.length;
          const pageText = rawReportText.substring(startIndex, endIndex).trim();
          pageBlocks.push({
            page: currentMarker.pageNumber,
            text: pageText,
          });
        }
      } else {
        pageBlocks.push({
          page: 1,
          text: rawReportText,
        });
      }

      const elapsed = Date.now() - startTime;
      console.log('\n[OCR SERVER]\nRESPONSE');
      console.log(`\n[OCR SERVER]\nTEXT LENGTH=${rawReportText.length}`);
      console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);

      return res.json({
        success: true,
        rawReportText,
        pages: pageBlocks,
        detectedSections,
        characterCount: rawReportText.length,
      });
    } catch (err: any) {
      console.error('Error in /api/ocr-stitched-image:', err);
      const elapsed = Date.now() - startTime;
      console.log('\n[OCR SERVER]\nRESPONSE');
      console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
      console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
      return res.status(500).json({
        error: err.message || 'Lỗi OCR ảnh ghép',
        fallbackAvailable: true,
      });
    }
  });

  // API Route: OCR Single Image (Job-based per page OCR with page detection)
  app.post('/api/ocr-single-image', async (req, res) => {
    const startTime = Date.now();
    const payloadSize = Buffer.byteLength(JSON.stringify(req.body));
    console.log('\n[OCR SERVER]\nREQUEST RECEIVED');

    try {
      const { image, imageIndex, fileName, width, height } = req.body;
      console.log(`\n[OCR SERVER]\nIMAGE SIZE:\nwidth=${width || 'unknown'}\nheight=${height || 'unknown'}`);
      console.log(`\n[OCR SERVER]\nPAYLOAD SIZE=${payloadSize}`);

      if (!image || typeof image !== 'string') {
        const elapsed = Date.now() - startTime;
        console.log('\n[OCR SERVER]\nRESPONSE');
        console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
        console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
        return res.status(400).json({ error: 'Không có dữ liệu ảnh để OCR', fallbackAvailable: true });
      }

      const client = getGeminiClient();
      if (!client) {
        const elapsed = Date.now() - startTime;
        console.log('\n[OCR SERVER]\nRESPONSE');
        console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
        console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
        return res.status(500).json({
          error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ',
          fallbackAvailable: true,
        });
      }

      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        const elapsed = Date.now() - startTime;
        console.log('\n[OCR SERVER]\nRESPONSE');
        console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
        console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
        return res.status(400).json({ error: 'Định dạng ảnh không hợp lệ (cần data:image/...;base64,...)', fallbackAvailable: true });
      }

      const inlinePart = {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };

      const ocrPrompt = `Bạn là hệ thống OCR y tế chuyên nghiệp cho phiếu siêu âm sản phụ khoa (GE Voluson, Samsung, Mindray, Philips).
Nhiệm vụ:
1. Đọc và trích xuất TOÀN BỘ ký tự, chữ, số, bảng đo, Doppler, tiêu đề trên ảnh này một cách chính xác 100%. Giữ nguyên từng dòng, từng giá trị, không tóm tắt, không bỏ sót bất kỳ dòng nào.
2. Tìm số trang nếu có trên phiếu (ví dụ: "Page 1 / 11", "Page 2 / 11", "Page 1 / 4", "Trang 1 / 2", "1 of 3").
3. Nhận diện các section y tế xuất hiện trên trang này (chọn từ: "patient", "dating", "efw", "measurements", "calculations", "fhr", "ua", "mca", "uterine", "dv", "amnioticFluid", "cervix", "placenta").

Hãy trả về duy nhất một đối tượng JSON hợp lệ theo định dạng:
{
  "pageNumber": 1,
  "totalPages": 11,
  "text": "Nội dung OCR đầy đủ của trang...",
  "detectedSections": ["patient", "efw", "measurements"]
}
Nếu không tìm thấy số trang, để pageNumber: null và totalPages: null.`;

      console.log(`\n[OCR SERVER]\nMODEL=gemini-3.7-flash (multiplexed)`);
      console.log('\n[OCR SERVER]\nSTART');

      const response = await generateWithFallback(client, [inlinePart, { text: ocrPrompt }]);
      const modelUsed = (response as any).modelUsed || 'gemini-3.7-flash';
      console.log(`\n[OCR SERVER]\nMODEL=${modelUsed}`);

      const rawText = response.text || '';
      let parsedData: any = {};

      try {
        const cleanJsonStr = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        parsedData = JSON.parse(cleanJsonStr);
      } catch (parseErr) {
        // Fallback if AI returned raw text directly
        parsedData = {
          pageNumber: null,
          totalPages: null,
          text: rawText,
          detectedSections: [],
        };
      }

      // Regex sanity check for page number if null or missing
      if (!parsedData.pageNumber && parsedData.text) {
        const pageMatch = parsedData.text.match(/(?:Page|Trang)\s*[:\s]*(\d+)(?:\s*[\/|\\]\s*(\d+))?/i) ||
                          parsedData.text.match(/\b(\d+)\s+of\s+(\d+)\b/i);
        if (pageMatch) {
          parsedData.pageNumber = parseInt(pageMatch[1], 10);
          if (pageMatch[2]) parsedData.totalPages = parseInt(pageMatch[2], 10);
        }
      }

      const responseText = parsedData.text || rawText;
      const elapsed = Date.now() - startTime;
      console.log('\n[OCR SERVER]\nRESPONSE');
      console.log(`\n[OCR SERVER]\nTEXT LENGTH=${responseText.length}`);
      console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);

      return res.json({
        success: true,
        imageIndex: imageIndex ?? 0,
        fileName: fileName || `image_${(imageIndex ?? 0) + 1}`,
        pageNumber: parsedData.pageNumber ?? null,
        totalPages: parsedData.totalPages ?? null,
        text: responseText,
        detectedSections: Array.isArray(parsedData.detectedSections) ? parsedData.detectedSections : [],
        characterCount: responseText.length,
      });
    } catch (err: any) {
      console.error('Error in /api/ocr-single-image:', err);
      const elapsed = Date.now() - startTime;
      console.log('\n[OCR SERVER]\nRESPONSE');
      console.log(`\n[OCR SERVER]\nTEXT LENGTH=0`);
      console.log(`\n[OCR SERVER]\nELAPSED=${elapsed}\n`);
      return res.status(500).json({
        error: err.message || 'Lỗi OCR ảnh đơn',
        fallbackAvailable: true,
      });
    }
  });

  // API Route: Extract Full Structured Report from Merged Raw Text
  app.post('/api/extract-report-from-text', async (req, res) => {
    try {
      const { mergedRawText, promptHint } = req.body;
      if (!mergedRawText || typeof mergedRawText !== 'string') {
        return res.status(400).json({ error: 'Không có dữ liệu text báo cáo để trích xuất' });
      }

      const client = getGeminiClient();
      if (!client) {
        return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ' });
      }

      const prompt = `Bạn là Bác sĩ Chẩn đoán hình ảnh Sản Phụ khoa cao cấp.
Nhiệm vụ: Trích xuất TOÀN BỘ dữ liệu cấu trúc y khoa từ nội dung text đầy đủ của tất cả các trang báo cáo siêu âm sau đây:

${mergedRawText}

${promptHint ? `Lưu ý thêm: ${promptHint}` : ''}

LƯU Ý CỰC KỲ QUAN TRỌNG:
1. CHỈ TRẢ VỀ CÁC CHỈ SỐ CÓ XUẤT HIỆN TRONG TEXT.
2. NẾU MỘT CHỈ SỐ KHÔNG CÓ TRONG TEXT, BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA RA HAY ĐƯA CHỈ SỐ ĐÓ VÀO KẾT QUẢ JSON BẰNG NULL.
3. TUYỆT ĐỐI KHÔNG NHẦM CÂN NẶNG EFW VỚI CHỈ SỐ SINH TRẮC HOẶC TÊN BẢNG BÁCH PHÂN VỊ:
   - Dòng EFW (ví dụ "EFW 890g", "AC/FL/HC 890g ±132g 25w6d <1%") là CÂN NẶNG THAI NHI (gam).
   - Tên bảng bách phân vị / reference chart như "Intergrowth(2018/201...)" hay "Hadlock(2018)" KHÔNG PHẢI LÀ CÂN NẶNG EFW = 201g! Cấm trích xuất số "201" trong tên chart thành EFW!
   - Cấm dùng con số EFW (như 890, 741, 65) để gán cho BPD, HC, AC, FL, HL, BOD, Foot!
4. GIỮ NGUYÊN TOÀN BỘ KÝ TỰ BÁCH PHÂN VỊ (<1%, >99%, 1%, 17.5%, 25.6%):
   - Tuyệt đối KHÔNG bỏ dấu '<' hay '>' trong bách phân vị (ví dụ "<1%" KHÔNG được biến thành "1%", ">99%" KHÔNG được biến thành "99%").
5. TUYỆT ĐỐI KHÔNG NHẦM ĐƠN VỊ 'cm' VỚI BỂ LỚN HỐ SAU (CM / Cisterna Magna):
   - Chữ 'cm' trong '1.07 cm' hay '4.5 cm' là ĐƠN VỊ Centimét. Cấm trích xuất thành key 'cm' (Cisterna Magna).
   - Chỉ lấy key 'cm' (Bể lớn hố sau) khi có nhãn đo cấu trúc não thai "CM" hoặc "Cisterna Magna".
6. ĐỐI VỚI CÂN NẶNG EFW (efw):
   - BẮT BUỘC lấy GA/Age (gaAge, ví dụ "25w6d"), Range (ví dụ "±132g") và GP% (percentile, ví dụ "<1%") trực tiếp từ dòng EFW.
   - KHÔNG tự tính toán lại hay làm tròn khác đi. Nếu phiếu ghi "<1%" thì giữ đúng "<1%".
7. ĐỐI VỚI DOPPLER:
   - FHR: Nhịp tim thai (bpm) giữ riêng biệt với nhịp mạch máu.
   - Umbilical Artery (UA), Middle Cerebral Artery (MCA), Left Uterine, Right Uterine: PS, ED, TAmax, VTI, PI, RI, S/D, HR.
   - Ductus Venosus (DV / Ống tĩnh mạch): BẮT BUỘC lấy đầy đủ S, TAmax, a, D, PI, S/a, a/S, PVIV, PLI, HR.
   - Doppler Calculations: Lấy toàn bộ tỷ lệ, bách phân vị và phương pháp (DV a/S, DV PI, DV PLI, DV PVIV, DV S/a, UA PI, UA RI, MCA PI, MCA RI, MCA PS, MCA MoM, MCA TAMax, CPR, Left UtArt PI, Right UtArt PI).

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ (bỏ những key không có trong text):
{
  "patientName": "Họ và tên",
  "patientId": "Mã bệnh nhân",
  "dob": "Ngày sinh DD/MM/YYYY",
  "examDate": "Ngày siêu âm DD/MM/YYYY",
  "sonographer": "Bác sĩ siêu âm",
  "clinicHeader": "Tên phòng khám / Bệnh viện",
  "gaClin": "Tuổi thai theo lâm sàng/EDD (ví dụ 30w6d)",
  "edd": "Ngày dự sinh (EDD)",
  "lmp": "Kinh cuối (LMP)",
  "transferDate": "Ngày chuyển phôi IVF nếu có",
  "embryoDay": 3 hoặc 5 nếu có,
  "measurements": {
    "bpd": { "value": 70.6, "unit": "mm", "method": "Hadlock", "percentile": "18.6%", "gaAge": "28w2d" },
    "hc": { "value": 255.8, "unit": "mm", "method": "INTERGROWTH-21st", "percentile": "37.3%" },
    "ac": { "value": 215.4, "unit": "mm", "method": "Hadlock", "percentile": "46.2%", "gaAge": "26w0d" },
    "fl": { "value": 46.3, "unit": "mm", "method": "Osaka", "percentile": "60.0%", "gaAge": "25w2d" },
    "hl": { "value": 40.7, "unit": "mm", "method": "ASUM" },
    "bod": { "value": 43.2, "unit": "mm", "method": "Jeanty" },
    "nbl": { "value": 9.1, "unit": "mm", "method": "Sonek" },
    "foot": { "value": 51.5, "unit": "mm", "method": "Chitty" }
  },
  "efw": {
    "value": 890,
    "unit": "g",
    "range": "±132g",
    "percentile": "<1%",
    "method": "Hadlock",
    "formula": "AC/FL/HC",
    "gaAge": "25w6d"
  },
  "doppler": {
    "fhr": { "value": 141, "unit": "bpm" },
    "leftUterine": { "ps": 83.91, "ed": 9.30, "tamax": 24.08, "vti": 197.4, "pi": 3.10, "ri": 0.89, "hr": 73 },
    "rightUterine": { "ps": 65.42, "ed": 15.06, "tamax": 26.85, "vti": 213.1, "pi": 1.88, "ri": 0.77, "hr": 75 },
    "umbilicalArtery": { "ps": 38.88, "ed": 2.20, "tamax": 18.86, "vti": 72.6, "pi": 1.94, "ri": 0.94, "hr": 156 },
    "middleCerebralArtery": { "ps": 52.40, "ed": 9.47, "tamax": 24.17, "vti": 95.8, "pi": 1.78, "ri": 0.82, "mom": 1.24, "hr": 151 },
    "ductusVenosus": { "s": 66.04, "tamax": 57.09, "a": 37.62, "d": 43.37, "pi": 0.50, "sa": 1.76, "as": 0.57, "pviv": 0.66, "pli": 0.43, "hr": 268 }
  },
  "calculations": {
    "umbArtPi": 1.94, "umbArtPiPercentile": ">99%",
    "dvAS": 0.57, "dvASPercentile": "13.2%",
    "dvPi": 0.50, "dvPiPercentile": "74.2%",
    "dvPli": 0.43, "dvPliPercentile": "23.8%",
    "dvPviv": 0.66, "dvPvivPercentile": "76.5%",
    "dvSa": 1.76, "dvSaPercentile": "22.6%",
    "leftUtArtPi": 3.10, "leftUtArtPiPercentile": ">99%",
    "rightUtArtPi": 1.88, "rightUtArtPiPercentile": ">99%",
    "mcaPi": 1.78, "mcaPiPercentile": "30.2%",
    "mcaPs": 52.40, "mcaMom": 1.24,
    "cpr": 0.92, "cprPercentile": "<1%"
  },
  "amnioticFluid": {
    "afi": { "value": 163.8, "unit": "mm" },
    "sdp": { "value": 71.05, "unit": "mm" }
  }
}`;

      const response = await generateWithFallback(client, prompt);
      const rawText = response.text || '';
      let parsedData: any = {};

      try {
        const cleanJsonStr = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        parsedData = JSON.parse(cleanJsonStr);
      } catch (parseErr) {
        console.error('Failed to parse text extraction JSON output:', rawText);
        return res.status(500).json({
          error: 'Không thể chuyển đổi dữ liệu từ AI',
          rawText,
        });
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Error in /api/extract-report-from-text:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route: Generate Clinical Conclusion
  app.post('/api/generate-conclusion', async (req, res) => {
    try {
      const { reportData } = req.body;
      const client = getGeminiClient();

      if (!client) {
        return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY' });
      }

      const prompt = `Bạn là Bác sĩ Chuyên khoa II Siêu âm Sản Phụ khoa.
Dựa trên dữ liệu siêu âm sau đây, hãy viết phần KẾT LUẬN & ĐỀ NGHỊ chuẩn y khoa, súc tích, trang trọng cho phiếu kết quả:
${JSON.stringify(reportData, null, 2)}

QUY TẮC BẮT BUỘC:
- TUỔI THAI KHI KẾT LUẬN: Luôn ưu tiên lấy theo GA(EDD) (tuổi thai theo ngày dự sinh / lâm sàng ví dụ: ${reportData?.patient?.gaClin || reportData?.patient?.gaAua || 'tuổi thai'}).
- Cân nặng EFW giữ nguyên đơn vị gam (g) và kèm bách phân vị (GP).
- Định dạng trả về:
  * Một đoạn Kết luận cô đọng: tình trạng thai, tuổi thai theo GA(EDD), cân nặng ước tính (g) và bách phân vị, Doppler mạch máu, nước ối và bánh rau.
  * Một đoạn Đề nghị: lịch hẹn khám định kỳ hoặc siêu âm khảo sát mốc tiếp theo.`;

      const response = await generateWithFallback(client, prompt);

      return res.json({
        success: true,
        conclusion: response.text?.trim() || '',
      });
    } catch (err: any) {
      console.error('Error in /api/generate-conclusion:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ultrasound AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
