/**
 * Módulo de Telemetria, Geolocalização (IP Público / Cidade / Estado) e Kill-Switch Remoto via Supabase
 * Suporte Multi-Aplicação: Sams Club & Gerador de Etiquetas PRO
 * Autor: Samack 697
 */

const SUPABASE_CONFIG = {
    url: "https://euvhtrwbyxjezbwwwbxb.supabase.co",
    key: "sb_publishable_C_hnCysx4ulNklCJv0UO9g_YFGMgyBv",
    maxOfflineDays: 10
};

const SUPABASE_HEADERS = {
    "apikey": SUPABASE_CONFIG.key,
    "Authorization": `Bearer ${SUPABASE_CONFIG.key}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

/**
 * Obtém o IP público e geolocalização do usuário via múltiplos motores de alta disponibilidade
 */
async function fetchUserGeoData() {
    const defaultGeo = {
        ip: "Desconhecido",
        cidade: "Desconhecida",
        estado: "Desconhecido",
        pais: "Brasil",
        provedor: "Desconhecido"
    };

    // Motor 1: ipwho.is (Rápido, sem limites agressivos, suporte completo ao Brasil)
    try {
        const ctrl1 = new AbortController();
        const tid1 = setTimeout(() => ctrl1.abort(), 2500);
        const res1 = await fetch("https://ipwho.is/", { signal: ctrl1.signal });
        clearTimeout(tid1);
        if (res1.ok) {
            const d1 = await res1.json();
            if (d1 && d1.success !== false && d1.ip) {
                return {
                    ip: d1.ip || defaultGeo.ip,
                    cidade: d1.city || defaultGeo.cidade,
                    estado: d1.region || defaultGeo.estado,
                    pais: d1.country || defaultGeo.pais,
                    provedor: (d1.connection && (d1.connection.isp || d1.connection.org)) || defaultGeo.provedor
                };
            }
        }
    } catch (e1) {}

    // Motor 2: get.geojs.io (CDN Global Ilimitado e Ultra-Estável)
    try {
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), 2500);
        const res2 = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: ctrl2.signal });
        clearTimeout(tid2);
        if (res2.ok) {
            const d2 = await res2.json();
            if (d2 && d2.ip) {
                return {
                    ip: d2.ip || defaultGeo.ip,
                    cidade: d2.city || defaultGeo.cidade,
                    estado: d2.region || defaultGeo.estado,
                    pais: d2.country || defaultGeo.pais,
                    provedor: d2.organization_name || d2.organization || defaultGeo.provedor
                };
            }
        }
    } catch (e2) {}

    // Motor 3: freeipapi.com (Suporte a CORS)
    try {
        const ctrl3 = new AbortController();
        const tid3 = setTimeout(() => ctrl3.abort(), 2500);
        const res3 = await fetch("https://freeipapi.com/api/json/", { signal: ctrl3.signal });
        clearTimeout(tid3);
        if (res3.ok) {
            const d3 = await res3.json();
            if (d3 && d3.ipAddress) {
                return {
                    ip: d3.ipAddress || defaultGeo.ip,
                    cidade: d3.cityName || defaultGeo.cidade,
                    estado: d3.regionName || defaultGeo.estado,
                    pais: d3.countryName || defaultGeo.pais,
                    provedor: defaultGeo.provedor
                };
            }
        }
    } catch (e3) {}

    // Motor 4: api.ipify.org (Fallback final para IP)
    try {
        const res4 = await fetch("https://api.ipify.org?format=json");
        if (res4.ok) {
            const d4 = await res4.json();
            defaultGeo.ip = d4.ip || defaultGeo.ip;
        }
    } catch (e4) {}

    return defaultGeo;
}

/**
 * Registra o log de acesso na tabela 'logs_acesso' do Supabase com o nome do App
 */
async function logAccessToSupabase(geoData, statusAcesso, detalhesAcao = "", appName = "gerador_etiquetas") {
    const payload = {
        app_name: appName,
        data_hora: new Date().toISOString(),
        nome_pc: window.navigator.platform || "Navegador Web",
        usuario_win: window.navigator.userAgent.split(' ')[0] || "WebUser",
        os_info: window.navigator.userAgent,
        hwid: window.navigator.vendor || "Web-Browser",
        ip_publico: geoData.ip,
        cidade: geoData.cidade,
        estado: geoData.estado,
        pais: geoData.pais,
        provedor: geoData.provedor,
        acao: appName === 'sams_club' ? "Acesso Sams Club" : "Geração de Etiquetas",
        detalhes_geracao: detalhesAcao,
        status: statusAcesso
    };

    try {
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/logs_acesso`, {
            method: "POST",
            headers: SUPABASE_HEADERS,
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.warn("Aviso ao enviar log de telemetria para o Supabase:", e);
    }
}

/**
 * Salva o cache de licença válida no localStorage do navegador
 */
function saveOfflineCache(appName = "gerador_etiquetas") {
    try {
        const cacheData = {
            app_name: appName,
            last_online: new Date().toISOString(),
            status: "VALIDATED"
        };
        localStorage.setItem(`barcode_license_cache_${appName}`, btoa(JSON.stringify(cacheData)));
    } catch (e) {}
}

/**
 * Lê o cache de licença off-line
 */
function readOfflineCache(appName = "gerador_etiquetas") {
    try {
        const b64 = localStorage.getItem(`barcode_license_cache_${appName}`);
        if (!b64) return null;
        const jsonStr = atob(b64);
        const data = JSON.parse(jsonStr);
        return new Date(data.last_online);
    } catch (e) {
        return null;
    }
}

/**
 * Executa a checagem remota no Supabase (Kill-Switch) e validações off-line
 * @param {string} detalhesAcao Detalhes adicionais para o log
 * @param {string} appName Nome da aplicação ('gerador_etiquetas' ou 'sams_club')
 * @returns {Promise<{allowed: boolean, message: string, offline: boolean}>}
 */
async function checkSupabaseRemoteAccess(detalhesAcao = "", appName = "gerador_etiquetas") {
    const urlCheck = `${SUPABASE_CONFIG.url}/rest/v1/controle_acesso?app_name=eq.${appName}&select=*&limit=1`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(urlCheck, {
            headers: SUPABASE_HEADERS,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const config = data[0];
                const sistemaAtivo = config.sistema_ativo !== false;
                const msgBloqueio = config.mensagem_bloqueio || `Acesso ao ${appName} desativado pela administração (Samack 697).`;

                const geo = await fetchUserGeoData();

                if (!sistemaAtivo) {
                    await logAccessToSupabase(geo, "BLOQUEADO", detalhesAcao, appName);
                    return { allowed: false, message: msgBloqueio, offline: false };
                }

                // Acesso Liberado Online
                saveOfflineCache(appName);
                await logAccessToSupabase(geo, "LIBERADO", detalhesAcao, appName);
                return { allowed: true, message: "Acesso autorizado online.", offline: false };
            }
        }

        saveOfflineCache(appName);
        return { allowed: true, message: "Acesso autorizado online.", offline: false };

    } catch (e) {
        // Conexão Indisponível -> Modo Off-line (10 Dias de Tolerância)
        const lastOnlineDate = readOfflineCache(appName);
        if (!lastOnlineDate) {
            return {
                allowed: false,
                message: "Não foi possível conectar ao servidor de licenças para a primeira validação online.\nPor favor, conecte a internet para iniciar pela primeira vez.",
                offline: true
            };
        }

        const diffDays = Math.floor((new Date() - lastOnlineDate) / (1000 * 60 * 60 * 24));
        if (diffDays > SUPABASE_CONFIG.maxOfflineDays) {
            return {
                allowed: false,
                message: `Licença off-line expirada (${diffDays} dias sem conexão).\nO limite máximo off-line é de ${SUPABASE_CONFIG.maxOfflineDays} dias. Conecte-se à internet para revalidar.`,
                offline: true
            };
        }

        return {
            allowed: true,
            message: `Acesso off-line autorizado (Última validação há ${diffDays} dia(s)).`,
            offline: true
        };
    }
}
