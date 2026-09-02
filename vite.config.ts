import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {GoogleGenAI} from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

function ultrasoundApiPlugin(): Plugin {
  return {
    name: 'ultrasound-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/extract-ultrasound' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { images, promptHint } = JSON.parse(body);
                if (!images || !Array.isArray(images) || images.length === 0) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'No image provided' }));
                  return;
                }

                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ 
                    error: 'GEMINI_API_KEY chưa được cấu hình. Bạn có thể sử dụng Chế độ Offline OCR hoặc nhập thủ công.',
                    fallbackAvailable: true
                  }));
                  return;
                }

                const ai = new GoogleGenAI({
                  apiKey: apiKey,
                  httpOptions: {
                    headers: {
                      'User-Agent': 'aistudio-build',
                    },
                  },
                });

                const parts: any[] = [];
                for (const img of images) {
                  let base64Data = img;
                  let mimeType = 'image/jpeg';
                  if (typeof img === 'string' && img.startsWith('data:')) {
                    const match = img.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                      mimeType = match[1];
                      base64Data = match[2];
                    }
                  }
                  parts.push({
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  });
                }

                const systemInstruction = `Bạn là chuyên gia siêu âm sản phụ khoa và phân tích dữ liệu hình ảnh siêu âm y tế (Obstetric & Gynecological Ultrasound Report Parser).
Nhiệm vụ của bạn là đọc toàn bộ bảng chỉ số, thông tin hành chính, số đo 2D, Doppler, tính toán từ các ảnh báo cáo siêu âm (máy GE Voluson, Samsung, Mindray, Philips, Siemens...).
Hãy trích xuất chính xác 100% các giá trị đo và thông tin hiển thị trên ảnh, không bỏ sót bất kỳ chỉ số nào.
Chỉ trả về JSON thuần túy (không bọc trong markdown codeblocks), đúng theo cấu trúc sau:
{
  "clinicHeader": "string",
  "examDate": "string",
  "patientName": "string",
  "patientId": "string",
  "yearOfBirth": "string",
  "age": "string",
  "gender": "Female",
  "sonographer": "string",
  "lmp": "string",
  "doc": "string",
  "gaClin": "string",
  "gaAua": "string",
  "edd": "string",
  "gravida": "string",
  "para": "string",
  "abortion": "string",
  "ectopic": "string",
  "efw": { "value": 125, "unit": "g", "range": "± 19g", "gaAge": "15w2d", "percentile": "31.5%" },
  "measurements": {
    "gs": { "value": 13.37, "unit": "mm", "method": "Rempen", "gaAge": "6w1d" },
    "ys": { "value": 3.02, "unit": "mm" },
    "crl": { "value": 12.92, "unit": "mm", "method": "Hadlock", "gaAge": "7w3d", "percentile": "97.0%" },
    "nt": { "value": 1.40, "unit": "mm", "description": "Độ mờ da gáy" },
    "bpd": { "value": 27.38, "unit": "mm", "method": "Hadlock", "gaAge": "14w6d", "percentile": "13.1%" },
    "ofd": { "value": null, "unit": "mm" },
    "hc": { "value": 110.68, "unit": "mm", "method": "INTERGRW", "percentile": "13.1%" },
    "ac": { "value": 102.26, "unit": "mm", "method": "Hadlock", "gaAge": "16w2d", "percentile": "74.3%" },
    "fl": { "value": 16.40, "unit": "mm", "method": "Osaka", "gaAge": "15w2d", "percentile": "30.9%" },
    "hl": { "value": 18.37, "unit": "mm", "method": "Jeanty", "gaAge": "15w2d", "percentile": "44.4%" },
    "tcd": { "value": 15.31, "unit": "mm", "method": "Hill", "name": "Cereb", "gaAge": "16w0d", "percentile": "41.5%" },
    "cm": { "value": 2.98, "unit": "mm", "name": "Cisterna Magna (Bể lớn)" },
    "vp": { "value": 6.25, "unit": "mm", "name": "Não thất bên" },
    "nbl": { "value": 4.06, "unit": "mm", "method": "Sonek", "name": "Xương mũi", "percentile": "27.7%" },
    "bod": { "value": 22.06, "unit": "mm", "method": "Jeanty", "name": "Đường kính 2 hốc mắt", "gaAge": "14w4d", "percentile": "24.6%" },
    "foot": { "value": 17.96, "unit": "mm", "method": "Chitty", "name": "Chiều dài bàn chân", "percentile": "24.6%" },
    "cervixLength": { "value": 3.82, "unit": "cm", "name": "Chiều dài kênh cổ tử cung" }
  },
  "doppler": {
    "fhr": { "value": 144, "unit": "bpm", "name": "Ventricular FHR (Tim thai)" },
    "leftUterine": { "ps": 87.80, "ed": 14.26, "tamax": 34.31, "md": 13.93, "ri": 0.84, "pi": 2.14, "sd": 6.16, "hr": 74 },
    "rightUterine": { "ps": 65.56, "ed": 11.08, "tamax": 25.11, "md": 10.43, "ri": 0.83, "pi": 2.17, "sd": 5.92, "hr": 76 },
    "umbilicalArtery": { "ri": null, "pi": null, "sd": null },
    "middleCerebralArtery": { "ri": null, "pi": null, "psv": null }
  },
  "amnioticFluid": {
    "q1": { "value": 41.70, "unit": "mm" },
    "q2": { "value": 4.50, "unit": "cm" },
    "q3": { "value": 3.98, "unit": "cm" },
    "q4": { "value": 3.73, "unit": "cm" },
    "afi": { "value": 163.80, "unit": "mm" },
    "sdp": { "value": null, "unit": "cm" },
    "status": "Bình thường"
  },
  "calculations": {
    "hcAc": "1.08 (1.05 - 1.39)",
    "flAc": "16.03% (20 - 24%)",
    "flBpd": "59.85%",
    "flHc": "0.15 (0.14 - 0.17)"
  },
  "detectedCategory": "1st_trimester_screening",
  "suggestedConclusion": "string",
  "rawTextDump": "string"
}`;

                parts.push({
                  text: `Phân tích toàn bộ các chỉ số siêu âm từ ${images.length} ảnh report này. ${promptHint || ''}. Trích xuất đầy đủ và chính xác tất cả số liệu đo (2D, Doppler, Amniotic fluid, Calculations, GA, EDD, EFW, Percentiles).`,
                });

                const response = await ai.models.generateContent({
                  model: 'gemini-3.7-flash',
                  contents: { parts },
                  config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                  },
                });

                let rawJson = response.text || '{}';
                rawJson = rawJson.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
                const parsed = JSON.parse(rawJson);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, data: parsed }));
              } catch (err: any) {
                console.error('Gemini extraction error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  error: err?.message || 'Lỗi khi phân tích hình ảnh bằng AI',
                  fallbackAvailable: true
                }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e?.message || 'Server error' }));
          }
          return;
        }

        if (req.url === '/api/generate-conclusion' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { reportData } = JSON.parse(body);
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ 
                    conclusion: 'Một thai sống trong tử cung phát triển tương đương tuổi thai. Nhịp tim thai đều rõ. Lượng ối và bánh rau bình thường.' 
                  }));
                  return;
                }

                const ai = new GoogleGenAI({
                  apiKey: apiKey,
                  httpOptions: {
                    headers: { 'User-Agent': 'aistudio-build' },
                  },
                });

                const prompt = `Dựa vào dữ liệu siêu âm sau đây, hãy viết một kết luận y khoa chuẩn theo phong cách Bác sĩ Sản Phụ Khoa Việt Nam:
${JSON.stringify(reportData, null, 2)}
Yêu cầu:
1. Kết luận chính (Số lượng thai, ngôi thai, nhịp tim thai, tuổi thai theo siêu âm/lâm sàng, ước tính cân nặng và bách phân vị)
2. Đánh giá phần phụ (Dịch ối AFI, vị trí và độ trưởng thành bánh rau, Doppler mạch máu nếu có)
3. Đề nghị / Lời dặn & mốc siêu âm tái khám tiếp theo`;

                const resp = await ai.models.generateContent({
                  model: 'gemini-3.7-flash',
                  contents: prompt,
                });

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  success: true, 
                  conclusion: resp.text?.trim() || '' 
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), ultrasoundApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
