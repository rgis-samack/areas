// Constantes de modelo
const MODEL_CONFIGS = {
    model1: {
        width: 595.28,
        height: 841.89,
        rows: 3,
        cols: 3,
        base_w: 55.0,
        base_h: 53.94, // 31.0 * 1.74 (default scale from python)
        cx: [150.4, 348.8, 544.1],
        cy: [46.4, 316.2, 586.0],
        ty: [81.9, 351.7, 621.5],
        fontSize: 12,
        bc_width: 2,
        bc_height: 70,
        bc_margin: 10
    },
    model2: {
        width: 612.0,
        height: 792.0,
        rows: 20,
        cols: 4,
        base_w: 210.0,
        base_h: 18.0,
        col_centers: [82.512, 217.016, 351.52, 486.024],
        get_by: (r) => 41.0 + r * 36.0,
        get_ty: (r) => 67.5 + r * 36.0,
        fontSize: 11,
        bc_width: 2,
        bc_height: 21,
        bc_margin: 15
    }
};

// State
let currentTab = 'tab-bc';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Tabs Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            document.getElementById(currentTab).classList.add('active');
        });
    });

    // Character Count Logic
    const updateCount = (input, counterId) => {
        document.getElementById(counterId).innerText = `${input.value.length}/15`;
    };

    document.getElementById('textSup').addEventListener('input', (e) => updateCount(e.target, 'countSup'));
    document.getElementById('textInf').addEventListener('input', (e) => updateCount(e.target, 'countInf'));

    // Generate Button
    document.getElementById('btnGenerate').addEventListener('click', handleGenerate);
});

function calcCheckDigit(numStr) {
    let mult = 2;
    let total = 0;
    for (let i = numStr.length - 1; i >= 0; i--) {
        total += parseInt(numStr[i]) * mult;
        mult++;
        if (mult > 9) mult = 2;
    }
    let rem = total % 11;
    if (rem <= 1) return 0;
    return 11 - rem;
}

function generateBarcodeBase64(text, type, bc_width, bc_height, margin_px) {
    const canvas = document.getElementById('barcodeCanvas');
    try {
        JsBarcode(canvas, text, {
            format: type === 'code128' ? 'CODE128' : 'CODE39',
            displayValue: false,
            margin: margin_px,
            width: bc_width,
            height: bc_height,
            background: "#ffffff",
            lineColor: "#000000"
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Barcode generation error", e);
        return null;
    }
}

function setStatus(msg, type) {
    const sb = document.getElementById('statusBox');
    sb.innerHTML = `<p>${msg}</p>`;
    sb.className = 'status-container ' + type;
}

async function handleGenerate() {
    setStatus('Gerando PDF, aguarde...', '');
    
    try {
        const model = document.querySelector('input[name="model"]:checked').value;
        const bcType = document.querySelector('input[name="bctype"]:checked').value;
        const printMode = document.querySelector('input[name="printMode"]:checked').value;
        
        let startNum = 1, endNum = 1;
        let prefix = '', suffix = '', startStr = '', endStr = '';
        let customSup = '', customInf = '';
        
        if (currentTab === 'tab-text') {
            customSup = document.getElementById('textSup').value.trim();
            customInf = document.getElementById('textInf').value.trim();
            if (!customSup && !customInf) {
                setStatus('Erro: Digite ao menos um texto.', 'error');
                return;
            }
            endNum = model === 'model1' ? 9 : 80;
        } else {
            prefix = document.getElementById('prefix').value.trim();
            startStr = document.getElementById('startNum').value.trim();
            suffix = document.getElementById('suffix').value.trim();
            endStr = document.getElementById('endNum').value.trim();
            
            if (!startStr) {
                setStatus('Erro: Preencha o número inicial.', 'error');
                return;
            }
            startNum = parseInt(startStr);
            endNum = endStr ? parseInt(endStr) : startNum;
            
            if (endNum < startNum) {
                setStatus('Erro: O número final deve ser maior ou igual ao inicial.', 'error');
                return;
            }
        }

        // Setup PDF-lib
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfBytes = model === 'model1' ? MODEL1_B64 : MODEL2_B64;
        const basePdf = await PDFDocument.load(pdfBytes);
        const newPdf = await PDFDocument.create();
        
        const basePage = basePdf.getPage(0);
        const [embeddedPage] = await newPdf.embedPdf(basePdf, [0]);
        const helveticaBold = await newPdf.embedFont(StandardFonts.HelveticaBold);

        const config = MODEL_CONFIGS[model];
        const { width, height, rows, cols } = config;
        
        // Emulando mm e pt (1mm = 2.83465pt). Deixamos as margens originais padrão (M1: V=1.5, H=-4.5).
        let margin_v = model === 'model1' ? 1.5 : 0.0;
        let margin_h = model === 'model1' ? -4.5 + 5.0 : 5.0; // Padrão
        
        let y_offset = margin_v * 2.83465;
        let x_offset = margin_h * 2.83465;
        
        let currentNum = startNum;
        let c_num = startNum;
        
        const processPage = async (page) => {
            const getCellPos = (r, c) => {
                let bx, by, ty, cx;
                if (model === 'model1') {
                    cx = config.cx[c] + x_offset;
                    cy = config.cy[r] + y_offset;
                    bx = cx - config.base_w / 2.0;
                    by = cy - config.base_h / 2.0;
                    ty = config.ty[r] + y_offset;
                } else {
                    cx = config.col_centers[c] + x_offset;
                    bx = cx - config.base_w / 2.0;
                    by = config.get_by(r) + y_offset;
                    ty = config.get_ty(r) + y_offset;
                }
                
                // Conversão Fitz -> PDF-lib (Inverte o Y)
                // Fitz: Y=0 é o topo
                // PDF-lib: Y=0 é a base
                // ty do fitz = linha de base do texto. pdf-lib a origem do texto é a linha de base.
                const pdflib_by = height - by - config.base_h;
                const pdflib_ty = height - ty;
                
                return { bx, pdflib_by, pdflib_ty, cx, fitz_by: by, fitz_ty: ty };
            };

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const { bx, pdflib_by, pdflib_ty, cx, fitz_by, fitz_ty } = getCellPos(r, c);
                    
                    // Apagar template original de fundo (White Rectangle)
                    const rect_width = config.base_w + 20.0;
                    const rect_height = (fitz_ty + 10.0) - (fitz_by - 5.0);
                    const rect_x = bx - 10.0;
                    const rect_y = height - (fitz_ty + 10.0);
                    
                    page.drawRectangle({
                        x: rect_x,
                        y: rect_y,
                        width: rect_width,
                        height: rect_height,
                        color: rgb(1, 1, 1)
                    });
                    
                    if (customSup || customInf) {
                        const getFontSize = (text) => {
                            const l = text.length;
                            if (l <= 8) return 11;
                            if (l <= 12) return 9;
                            return 7.5;
                        };
                        
                        if (customSup && customInf) {
                            const wSup = helveticaBold.widthOfTextAtSize(customSup, getFontSize(customSup));
                            page.drawText(customSup, { x: cx - wSup/2, y: pdflib_ty + 13, size: getFontSize(customSup), font: helveticaBold, color: rgb(0,0,0) });
                            
                            const wInf = helveticaBold.widthOfTextAtSize(customInf, getFontSize(customInf));
                            page.drawText(customInf, { x: cx - wInf/2, y: pdflib_ty, size: getFontSize(customInf), font: helveticaBold, color: rgb(0,0,0) });
                        } else {
                            const text = customSup || customInf;
                            const l = text.length;
                            const fs = l <= 8 ? 15 : (l <= 12 ? 12 : 10);
                            const w = helveticaBold.widthOfTextAtSize(text, fs);
                            page.drawText(text, { x: cx - w/2, y: pdflib_ty + 8, size: fs, font: helveticaBold, color: rgb(0,0,0) });
                        }
                        continue;
                    }
                    
                    if (printMode === 'seq' && c_num > endNum) return c_num;
                    
                    const targetNum = printMode === 'seq' ? c_num : currentNum;
                    const baseStr = targetNum.toString().padStart(Math.max(4, startStr.length), '0');
                    const fullBcStr = `${prefix}${baseStr}${suffix}`;
                    
                    let displayText = fullBcStr;
                    if (model === 'model1') {
                        const checkDigit = calcCheckDigit(baseStr);
                        displayText = `${prefix}${baseStr}-${checkDigit}${suffix}`;
                    }
                    
                    // Geração Código de Barras
                    const b64Image = generateBarcodeBase64(baseStr, bcType, config.bc_width, config.bc_height, config.bc_margin);
                    if (b64Image) {
                        const pngImage = await newPdf.embedPng(b64Image);
                        
                        // Manter a proporção (keep_proportion=True igual PyMuPDF)
                        const imgW = pngImage.width;
                        const imgH = pngImage.height;
                        const scaleX = config.base_w / imgW;
                        const scaleY = config.base_h / imgH;
                        const scale = Math.min(scaleX, scaleY);
                        
                        const finalW = imgW * scale;
                        const finalH = imgH * scale;
                        
                        const drawX = bx + (config.base_w - finalW) / 2.0;
                        const drawY = pdflib_by + (config.base_h - finalH) / 2.0;

                        page.drawImage(pngImage, {
                            x: drawX,
                            y: drawY,
                            width: finalW,
                            height: finalH
                        });
                    }
                    
                    // Draw Text
                    const tw = helveticaBold.widthOfTextAtSize(displayText, config.fontSize);
                    page.drawText(displayText, {
                        x: cx - tw / 2.0,
                        y: pdflib_ty,
                        size: config.fontSize,
                        font: helveticaBold,
                        color: rgb(0, 0, 0)
                    });
                    
                    if (printMode === 'seq') c_num++;
                }
            }
            return c_num;
        };
        
        const createPage = () => {
            const page = newPdf.addPage([width, height]);
            page.drawPage(embeddedPage, { x: 0, y: 0, width, height });
            // Header
            page.drawRectangle({ x: 10, y: height - 10 - 27, width: 150, height: 27, color: rgb(1,1,1) });
            page.drawText("Samack D697", { x: 20, y: height - 21, size: 10, font: helveticaBold, color: rgb(0,0,0) });
            return page;
        };

        if (customSup || customInf) {
            const page = createPage();
            await processPage(page);
        } else if (printMode === 'seq') {
            while (c_num <= endNum) {
                const page = createPage();
                c_num = await processPage(page);
            }
        } else if (printMode === 'same') {
            while (currentNum <= endNum) {
                const page = createPage();
                await processPage(page);
                currentNum++;
            }
        }

        const pdfBytesArray = await newPdf.save();
        const blob = new Blob([pdfBytesArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setStatus(`Sucesso! O PDF foi gerado e aberto em uma nova guia.`, 'success');
        
    } catch (e) {
        console.error(e);
        setStatus(`Erro Crítico: ${e.message}`, 'error');
    }
}
