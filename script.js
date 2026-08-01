/* 
   SECURITY & ANTI-INSPECTION OBFUSCATED MODULE 
   Samack D697 - Authorized Access Only
*/
(function() {
    // 1. Desativar Menu de Contexto (Botão Direito)
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    }, false);

    // 2. Bloquear Atalhos de Inspeção de Código (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S)
    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 123) { // F12
            e.preventDefault();
            return false;
        }
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            return false;
        }
        if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83)) { // Ctrl+U, Ctrl+S
            e.preventDefault();
            return false;
        }
    }, false);

    // 3. Anti-Debugger Trap (Interrompe a execução caso o DevTools seja forçado)
    setInterval(function() {
        try {
            (function() { return false; })["constructor"]("debugger")();
        } catch(e) {}
    }, 1000);
})();

// Constantes de modelo
const MODEL_CONFIGS = {
    model1: {
        width: 612.0,
        height: 792.0,
        rows: 3,
        cols: 3,
        base_w: 55.0,
        base_h: 53.94,
        cx: [138.0, 342.0, 546.0],
        cy: [42.0, 302.0, 553.0],
        ty: [77.5, 337.5, 588.5],
        fontSize: 12,
        bc_width: 20,
        bc_height: 700,
        bc_margin: 20
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
        bc_width: 20,
        bc_height: 210,
        bc_margin: 30
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
            resetErrorOnInput();
        });
    });

    // Character Count Logic
    const updateCount = (input, counterId) => {
        document.getElementById(counterId).innerText = `${input.value.length}/15`;
    };

    document.getElementById('textSup').addEventListener('input', (e) => updateCount(e.target, 'countSup'));
    document.getElementById('textInf').addEventListener('input', (e) => updateCount(e.target, 'countInf'));

    // Limpar erro automaticamente quando o usuário alterar qualquer campo
    const resetErrorOnInput = () => {
        const sb = document.getElementById('statusBox');
        if (sb && sb.classList.contains('error')) {
            const progressBarFill = document.getElementById('progressBarFill');
            const timerBadge = document.getElementById('timerBadge');
            if (progressBarFill) progressBarFill.style.width = '0%';
            if (timerBadge) {
                timerBadge.style.display = 'none';
                timerBadge.innerText = '⏱️ 0.0s';
            }
            setStatus('Pronto para gerar. Preencha os dados e clique no botão abaixo.', '');
        }
    };

    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', resetErrorOnInput);
        el.addEventListener('change', resetErrorOnInput);
    });

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
    if (!text) return null;
    const canvas = document.getElementById('barcodeCanvas');
    if (!canvas) return null;
    
    // Proteção 1: Higienização estrita para os padrões ISO Code 128 / Code 39 (Evita caracteres inválidos)
    let cleanText = String(text).trim();
    if (type === 'code39') {
        cleanText = cleanText.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
    } else {
        cleanText = cleanText.replace(/[^\x00-\x7F]/g, '');
    }
    if (!cleanText) return null;

    try {
        // Proteção 2: Desativar Anti-Aliasing no Canvas (Barras 100% Monocromáticas e Nítidas para Scanners)
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
        }

        // Margem limpa usando a configuração do modelo (bc_margin = 30)
        const quietZone = margin_px !== undefined ? margin_px : 10;

        let isValidBarcode = true;

        JsBarcode(canvas, cleanText, {
            format: type === 'code128' ? 'CODE128' : 'CODE39',
            displayValue: false,
            margin: quietZone,
            width: bc_width,
            height: bc_height,
            background: "#ffffff",
            lineColor: "#000000",
            valid: function(valid) {
                isValidBarcode = valid;
            }
        });

        if (!isValidBarcode) {
            console.warn("Aviso: Código de barras inválido para a numeração fornecida:", cleanText);
            return null;
        }

        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Erro na geração do código de barras:", e);
        return null;
    }
}

function setStatus(msg, type) {
    const sb = document.getElementById('statusBox');
    const sm = document.getElementById('statusMessage');
    const timerBadge = document.getElementById('timerBadge');
    const progressBarFill = document.getElementById('progressBarFill');
    
    if (type === 'error') {
        if (timerBadge) timerBadge.style.display = 'none';
        if (progressBarFill) progressBarFill.style.width = '0%';
    }
    
    if (sm) {
        sm.innerHTML = msg;
    }
    sb.className = 'status-container ' + (type || '');
}

async function handleGenerate() {
    const progressBarFill = document.getElementById('progressBarFill');
    const timerBadge = document.getElementById('timerBadge');
    const statusMessage = document.getElementById('statusMessage');

    progressBarFill.style.width = '0%';
    timerBadge.style.display = 'inline-flex';
    setStatus('Iniciando processamento...', '');

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        timerBadge.innerText = `⏱️ ${elapsed}s`;
    }, 100);

    const cancelAndError = (errMsg) => {
        clearInterval(timerInterval);
        progressBarFill.style.width = '0%';
        setStatus(errMsg, 'error');
    };

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
                cancelAndError('Erro: Digite ao menos um texto superior ou inferior.');
                return;
            }
            endNum = model === 'model1' ? 9 : 80;
        } else {
            prefix = document.getElementById('prefix').value.trim();
            startStr = document.getElementById('startNum').value.trim();
            suffix = document.getElementById('suffix').value.trim();
            endStr = document.getElementById('endNum').value.trim();
            
            if (!startStr) {
                cancelAndError('Erro: Preencha o número inicial.');
                return;
            }

            // Regra: Desconsiderar QUALQUER zero à esquerda antes de uma numeração
            const cleanLeadingZeroes = (str) => {
                if (!str) return str;
                const cleaned = str.trim().replace(/^0+/, '');
                return cleaned !== '' ? cleaned : '0';
            };

            startStr = cleanLeadingZeroes(startStr);
            if (endStr) {
                endStr = cleanLeadingZeroes(endStr);
            }

            // Validação de Caracteres Apenas Numéricos
            if (!/^\d+$/.test(startStr)) {
                cancelAndError('Erro: O campo número inicial deve conter apenas algarismos numéricos (0-9).');
                return;
            }
            if (endStr && !/^\d+$/.test(endStr)) {
                cancelAndError('Erro: O campo número final deve conter apenas algarismos numéricos (0-9).');
                return;
            }

            startNum = parseInt(startStr, 10);
            endNum = endStr ? parseInt(endStr, 10) : startNum;
            
            if (startNum < 0 || endNum < 0) {
                cancelAndError('Erro: Os números não podem ser negativos.');
                return;
            }

            // Validação: Número final menor que o inicial
            if (endNum < startNum) {
                cancelAndError(`Erro: O número final (${endNum}) é menor que o número inicial (${startNum}). O número final deve ser maior ou igual ao inicial.`);
                return;
            }
        }

        // Estimativa total de folhas para a barra de progresso
        let totalEstPages = 1;
        if (currentTab === 'tab-text') {
            totalEstPages = 1;
        } else if (printMode === 'seq') {
            const labelsPerPage = model === 'model1' ? 9 : 80;
            totalEstPages = Math.ceil((endNum - startNum + 1) / labelsPerPage);
        } else if (printMode === 'same') {
            totalEstPages = (endNum - startNum + 1);
        }

        // Validação de limite de segurança (máximo 500 folhas)
        if (totalEstPages > 500) {
            cancelAndError(`Erro: A seleção geraria ${totalEstPages} folhas. O limite de segurança por lote é de 500 folhas.`);
            return;
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
        
        let margin_v = model === 'model1' ? 1.5 : 0.0;
        let margin_h = model === 'model1' ? -4.5 + 5.0 : 5.0;
        
        let y_offset = margin_v * 2.83465;
        let x_offset = margin_h * 2.83465;

        // Pre-calcular dimensões de referência exatas para 4 dígitos (ex: "0000")
        const ref4Str = "0000";
        const ref4B64 = generateBarcodeBase64(ref4Str, bcType, config.bc_width, config.bc_height, config.bc_margin);
        let ref4FinalW = null;
        let ref4FinalH = null;
        if (ref4B64) {
            const ref4Png = await newPdf.embedPng(ref4B64);
            const ref4ScaleX = config.base_w / ref4Png.width;
            const ref4ScaleY = config.base_h / ref4Png.height;
            const ref4Scale = Math.min(ref4ScaleX, ref4ScaleY);
            ref4FinalW = ref4Png.width * ref4Scale;
            ref4FinalH = ref4Png.height * ref4Scale;
        }

        // Cache em memória de imagens de código de barras embutidas no PDF (Ultra-rápido para 100+ páginas)
        const pngEmbedCache = new Map();

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
                
                const pdflib_by = height - by - config.base_h;
                const pdflib_ty = height - ty;
                
                return { bx, pdflib_by, pdflib_ty, cx, fitz_by: by, fitz_ty: ty };
            };

            // Passo 1: Desenhar TODOS os retângulos brancos primeiro
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const { bx, fitz_by, fitz_ty } = getCellPos(r, c);
                    
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
                }
            }

            // Passo 2: Desenhar os códigos de barras e textos por cima
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const { bx, pdflib_by, pdflib_ty, cx } = getCellPos(r, c);
                    
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
                    const baseStr = targetNum.toString(); // Sem forçar zeros à esquerda
                    const fullBcStr = `${prefix}${baseStr}${suffix}`;
                    
                    let displayText = fullBcStr;
                    if (model === 'model1') {
                        const checkDigit = calcCheckDigit(baseStr);
                        displayText = `${prefix}${baseStr}-${checkDigit}${suffix}`;
                    }
                    
                    // Geração Código de Barras com Cache em Memória
                    let pngImage = pngEmbedCache.get(baseStr);
                    if (!pngImage) {
                        const b64Image = generateBarcodeBase64(baseStr, bcType, config.bc_width, config.bc_height, config.bc_margin);
                        if (b64Image) {
                            pngImage = await newPdf.embedPng(b64Image);
                            pngEmbedCache.set(baseStr, pngImage);
                        }
                    }
                    
                    if (pngImage) {
                        const imgW = pngImage.width;
                        const imgH = pngImage.height;
                        
                        let finalW, finalH;
                        if (ref4FinalW && ref4FinalH) {
                            if (baseStr.length <= 4) {
                                finalW = ref4FinalW;
                                finalH = ref4FinalH;
                            } else {
                                const extraRatio = 1.0 + 0.12 * (baseStr.length - 4);
                                finalW = Math.min(config.base_w, ref4FinalW * extraRatio);
                                finalH = ref4FinalH;
                            }
                        } else {
                            const scaleX = config.base_w / imgW;
                            const scaleY = config.base_h / imgH;
                            const scale = Math.min(scaleX, scaleY);
                            finalW = imgW * scale;
                            finalH = imgH * scale;
                        }
                        
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
            return page;
        };

        let pageCounter = 0;
        const updateProgressUI = async () => {
            pageCounter++;
            const pct = Math.min(98, Math.round((pageCounter / totalEstPages) * 100));
            progressBarFill.style.width = `${pct}%`;
            setStatus(`⚙️ Processando folha <b>${pageCounter}</b> de <b>${totalEstPages}</b> (${pct}%)`, '');
            await new Promise(r => setTimeout(r, 0));
        };

        if (customSup || customInf) {
            const page = createPage();
            await processPage(page);
            await updateProgressUI();
        } else if (printMode === 'seq') {
            while (c_num <= endNum) {
                const page = createPage();
                c_num = await processPage(page);
                await updateProgressUI();
            }
        } else if (printMode === 'same') {
            while (currentNum <= endNum) {
                const page = createPage();
                await processPage(page);
                currentNum++;
                await updateProgressUI();
            }
        }

        // Pós-processamento do cabeçalho em todas as páginas
        const allPages = newPdf.getPages();
        const totalPages = allPages.length;
        allPages.forEach((pg, idx) => {
            const pageNum = idx + 1;
            const pageStr = `Page ${pageNum}/${totalPages}`;
            
            // Para o Modelo 1 (9 etiquetas), elevar o cabeçalho no topo da folha (y = height - 12, rect = height - 18, width = 75) para 0% de sobreposição
            const isModel1 = model === 'model1';
            const rectY = isModel1 ? height - 18 : height - 44;
            const textY = isModel1 ? height - 12 : height - 34;
            const rectH = isModel1 ? 16 : 28;
            const rectW = isModel1 ? 75 : 85;
            
            // 1. Canto Superior Esquerdo: Restaurar o texto original "Samack D697"
            pg.drawRectangle({
                x: 10,
                y: rectY,
                width: rectW,
                height: rectH,
                color: rgb(1, 1, 1)
            });
            pg.drawText("Samack D697", {
                x: 18,
                y: textY,
                size: isModel1 ? 9 : 10,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });
            
            // 2. Canto Superior Direito: Apagar TOTALMENTE o "Page 1/1" estático do modelo e desenhar "Page X/N"
            const pw = helveticaBold.widthOfTextAtSize(pageStr, 10);
            pg.drawRectangle({
                x: width - 140,
                y: rectY,
                width: 130,
                height: rectH,
                color: rgb(1, 1, 1)
            });
            pg.drawText(pageStr, {
                x: width - 20 - pw,
                y: textY,
                size: 10,
                font: helveticaBold,
                color: rgb(0, 0, 0)
            });
        });

        // Otimização de salvamento sem compressão pesada de streams (3x a 5x mais rápido no Xeon)
        const pdfBytesArray = await newPdf.save({ useObjectStreams: false });
        const blob = new Blob([pdfBytesArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        let fileName = 'Etiquetas.pdf';
        if (customSup || customInf) {
            const textLabel = customSup ? customSup : customInf;
            fileName = `Etiquetas_Texto_${textLabel}_${model}.pdf`;
        } else {
            const finalEndStr = endStr ? endStr : startStr;
            fileName = `Etiquetas_${prefix}${startStr}${suffix}_a_${prefix}${finalEndStr}${suffix}_${model}.pdf`;
        }

        // Finalizar cronômetro e barra de progresso em 100%
        clearInterval(timerInterval);
        const finalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        progressBarFill.style.width = '100%';
        timerBadge.innerText = `⏱️ ${finalTime}s`;
        
        // Download automático
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Abrir em Nova Guia APENAS quando o PDF estiver 100% pronto (Sem aba 'about:blank' vazia inicial!)
        window.open(url, '_blank');
        
        setStatus(`🎉 Sucesso! PDF com ${totalPages} folha(s) baixado e aberto em nova aba.`, 'success');
        
    } catch (e) {
        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        progressBarFill.style.width = '0%';
        console.error(e);
        setStatus(`Erro Crítico: ${e.message}`, 'error');
    }
}
