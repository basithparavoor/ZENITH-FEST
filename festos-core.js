/**
 * FestOS Universal Core Engine (festos-core.js)
 * Provides:
 * 1. Real-time dynamic auto-rebranding (Favicon, Logo, Title, App Icon)
 * 2. Persistent Universal Session & Auth Management
 * 3. Centralized System Audit & Error Logging with Auto-Diagnostics
 * 4. Multi-Tenant Festival Context & Feature Flag Matrix Evaluator
 */

const FESTOS_SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const FESTOS_SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';

// Initialize or reuse Supabase client
let festosSupabase = null;
if (typeof window !== 'undefined') {
    if (window.supabaseClient) {
        festosSupabase = window.supabaseClient;
    } else if (window.supabase && typeof window.supabase.createClient === 'function') {
        festosSupabase = window.supabase.createClient(FESTOS_SUPABASE_URL, FESTOS_SUPABASE_KEY);
        window.supabaseClient = festosSupabase;
    }
}

// =========================================================================
// 1. DYNAMIC AUTO-REBRANDING ENGINE
// =========================================================================
const festosBranding = {
    DEFAULT_NAME: 'FestOS',
    DEFAULT_LOGO: 'festos-logo.svg',

    init() {
        this.applyFromCache();
        this.fetchAndSubscribe();
    },

    applyFromCache() {
        try {
            const cached = localStorage.getItem('festos_branding_cache');
            if (cached) {
                const data = JSON.parse(cached);
                this.apply(data);
            }
        } catch (e) {
            console.warn('[FestOS Branding] Cache read warning:', e);
        }
    },

    async fetchAndSubscribe() {
        if (!festosSupabase) return;
        try {
            const { data, error } = await festosSupabase
                .from('settings')
                .select('value')
                .eq('id', 'system_branding')
                .maybeSingle();

            if (!error && data && data.value) {
                localStorage.setItem('festos_branding_cache', JSON.stringify(data.value));
                this.apply(data.value);
            }

            // Real-time listener for instant dynamic rebranding everywhere
            festosSupabase
                .channel('festos_branding_realtime')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'settings',
                    filter: 'id=eq.system_branding'
                }, (payload) => {
                    if (payload && payload.new && payload.new.value) {
                        localStorage.setItem('festos_branding_cache', JSON.stringify(payload.new.value));
                        this.apply(payload.new.value);
                        if (typeof showToast === 'function') {
                            showToast('Branding updated in real-time!', 'success');
                        }
                    }
                })
                .subscribe();
        } catch (err) {
            console.warn('[FestOS Branding] Fetch error:', err);
        }
    },

    apply(brandingData) {
        if (!brandingData) return;
        const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
        const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
        const displayMode = brandingData.display_mode || 'both';

        const festName = validName ? brandingData.fest_name.trim() : this.DEFAULT_NAME;
        const festLogo = validLogo ? brandingData.fest_logo.trim() : this.DEFAULT_LOGO;

        // 1. Update Title Dynamically
        const currentTitle = document.title || 'FestOS';
        const titleParts = currentTitle.split('|');
        const pageContext = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : 'Portal';
        document.title = `${festName} | ${pageContext}`;

        // 2. Dynamic Global Favicon Injection
        this.updateFavicon(festLogo);

        // 3. Update all Brand Containers & Logos on page
        const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1, .brand-container, .brand-logo-text');
        brandContainers.forEach(container => {
            if (container.id === 'page-title' || container.getAttribute('data-no-auto-brand') === 'true') return;

            let html = '';
            const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
            const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');

            if (showLogo) {
                html += `<img src="${festLogo}" alt="${festName} Logo" class="festos-dynamic-logo" style="height: 36px; width: auto; max-width: 180px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
            } else if (!validLogo && displayMode !== 'name') {
                html += `<img src="festos-logo.svg" alt="FestOS" style="height: 32px; width: 32px; margin-right: 8px; vertical-align: middle;">`;
            }

            if (showName) {
                let textToDisplay = festName;
                if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                    textToDisplay += ' Reports Engine';
                }
                html += `<span class="festos-dynamic-name" style="letter-spacing: -0.5px; font-weight: 700; display: inline-block; vertical-align: middle;">${textToDisplay}</span>`;
            }

            container.innerHTML = html;
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.flexWrap = 'nowrap';
        });

        // Store active branding in global window
        window.systemBranding = brandingData;
    },

    updateFavicon(iconUrl) {
        if (!iconUrl) return;
        let iconLinks = document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']");
        if (iconLinks.length === 0) {
            const newIcon = document.createElement('link');
            newIcon.rel = 'icon';
            document.head.appendChild(newIcon);
            iconLinks = [newIcon];
        }
        iconLinks.forEach(link => {
            link.href = iconUrl;
        });
    }
};

// =========================================================================
// 2. PERSISTENT UNIVERSAL AUTH & SESSION CONTROLLER
// =========================================================================
const festosAuth = {
    getUser() {
        try {
            const userStr = localStorage.getItem('festUser');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    },

    getSuperAdmin() {
        try {
            const saStr = localStorage.getItem('festSuperAdmin');
            return saStr ? JSON.parse(saStr) : null;
        } catch (e) {
            return null;
        }
    },

    isLoggedIn() {
        return !!this.getUser() || !!this.getSuperAdmin();
    },

    getCurrentFestId() {
        // 1. Check URL parameters first (e.g., results.html?fest=fest_vib26... or spectator.html?fest=...)
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            const urlFest = params.get('fest') || params.get('fest_id');
            if (urlFest && urlFest.trim() !== '') {
                return urlFest.trim();
            }
        }

        // 2. Check logged-in user context
        const user = this.getUser();
        if (user && user.fest_id) return user.fest_id;
        
        if (user && user.username) {
            const prefix = user.username.split('_')[0].toLowerCase();
            if (prefix === 'zenith26' || prefix === 'zenith') return 'fest_zenith_2026';
            if (prefix.length > 2) return `fest_${prefix}`;
        }

        // 3. Check active fest context from storage
        const stored = localStorage.getItem('festos_active_fest_id');
        if (stored && stored.trim() !== '') return stored.trim();

        return 'fest_zenith_2026';
    },

    setUser(user, remember = true) {
        if (!user) return;
        
        if (!user.fest_id && user.username) {
            const prefix = user.username.split('_')[0].toLowerCase();
            if (prefix === 'zenith26' || prefix === 'zenith') {
                user.fest_id = 'fest_zenith_2026';
            } else if (prefix.length > 2) {
                user.fest_id = `fest_${prefix}`;
            } else {
                user.fest_id = 'fest_zenith_2026';
            }
        }

        localStorage.setItem('festUser', JSON.stringify(user));
        if (user.fest_id) {
            localStorage.setItem('festos_active_fest_id', user.fest_id);
        }
        if (remember) {
            localStorage.setItem('festSavedUsername', user.username || '');
            localStorage.setItem('festos_remember_session', 'true');
        }
        festosLogger.log('AUTH', `User ${user.username} logged in as ${user.role} for fest: ${user.fest_id || 'Default'}`, { userId: user.id, role: user.role, festId: user.fest_id }, 'INFO');
    },

    setSuperAdmin(superAdminData) {
        if (!superAdminData) return;
        localStorage.setItem('festSuperAdmin', JSON.stringify(superAdminData));
        localStorage.setItem('festos_remember_superadmin', 'true');
        festosLogger.log('AUTH', `Super Admin ${superAdminData.username || 'Master'} logged in`, superAdminData, 'INFO');
    },

    logout(redirectUrl = 'index.html') {
        const user = this.getUser() || this.getSuperAdmin();
        if (user) {
            festosLogger.log('AUTH', `User ${user.username || 'Admin'} logged out`, {}, 'INFO');
        }
        localStorage.removeItem('festUser');
        localStorage.removeItem('festSuperAdmin');
        localStorage.removeItem('festos_remember_session');
        localStorage.removeItem('festos_remember_superadmin');
        window.location.href = redirectUrl;
    },

    requireRole(allowedRoles = [], redirectUrl = 'index.html') {
        const user = this.getUser();
        const superAdmin = this.getSuperAdmin();

        // Super Admin has global bypass
        if (superAdmin) return true;

        if (!user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    }
};

// =========================================================================
// 3. SYSTEM LOGGING & AUTO-DIAGNOSTICS ENGINE
// =========================================================================
const festosLogger = {
    STORAGE_KEY: 'festos_audit_logs',
    MAX_LOCAL_LOGS: 250,

    getLogs() {
        try {
            const logs = localStorage.getItem(this.STORAGE_KEY);
            return logs ? JSON.parse(logs) : [];
        } catch (e) {
            return [];
        }
    },

    async log(category, action, details = {}, severity = 'INFO') {
        const timestamp = new Date().toISOString();
        const currentUser = festosAuth.getUser() || festosAuth.getSuperAdmin() || { username: 'Anonymous' };
        
        const logEntry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp,
            category,
            action,
            details,
            severity,
            user: currentUser.username,
            url: typeof window !== 'undefined' ? window.location.pathname : ''
        };

        // Save to local circular buffer
        let localLogs = this.getLogs();
        localLogs.unshift(logEntry);
        if (localLogs.length > this.MAX_LOCAL_LOGS) {
            localLogs = localLogs.slice(0, this.MAX_LOCAL_LOGS);
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localLogs));

        return logEntry;
    },

    clearLogs() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    exportLogsJSON() {
        const logs = this.getLogs();
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `festos_logs_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Global Error & Promise Rejection Trapper
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        festosLogger.log('ERROR', event.message || 'Uncaught Script Error', {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error ? event.error.stack : null
        }, 'ERROR');
    });

    window.addEventListener('unhandledrejection', (event) => {
        festosLogger.log('ERROR', 'Unhandled Promise Rejection', {
            reason: event.reason ? (event.reason.message || event.reason.toString()) : 'Unknown reason',
            stack: event.reason && event.reason.stack ? event.reason.stack : null
        }, 'ERROR');
    });
}

// =========================================================================
// 4. MULTI-TENANCY & FEATURE FLAG MATRIX EVALUATOR
// =========================================================================
const festosFeatures = {
    DEFAULT_FEATURES: {
        feature_judging: true,
        feature_stage_display: true,
        feature_spectator_qr: true,
        feature_poster_generator: true,
        feature_participant_portal: true,
        feature_squad_roster: true,
        feature_website_customizer: true,
        feature_program_reports: true,
        feature_announcements: true,
        feature_wall_of_fame: true
    },

    getActiveFestId() {
        return festosAuth.getCurrentFestId();
    },

    setActiveFestId(festId) {
        localStorage.setItem('festos_active_fest_id', festId);
        festosLogger.log('SYSTEM', `Switched active festival context to ${festId}`, { festId }, 'INFO');
    },

    async getFestFeatureFlags(festId = null) {
        const targetFestId = festId || this.getActiveFestId();
        try {
            const cached = localStorage.getItem(`festos_features_${targetFestId}`);
            if (cached) return JSON.parse(cached);

            if (festosSupabase) {
                const { data } = await festosSupabase
                    .from('settings')
                    .select('value')
                    .eq('id', `features_${targetFestId}`)
                    .maybeSingle();

                if (data && data.value) {
                    localStorage.setItem(`festos_features_${targetFestId}`, JSON.stringify(data.value));
                    return data.value;
                }
            }
        } catch (e) {
            console.warn('[FestOS Features] Read error:', e);
        }
        return this.DEFAULT_FEATURES;
    },

    async isEnabled(featureKey) {
        const flags = await this.getFestFeatureFlags();
        return flags[featureKey] !== false;
    }
};

function festosFilterRows(rows, targetFestId = null) {
    if (!rows || !Array.isArray(rows)) return [];
    const festId = targetFestId || festosAuth.getCurrentFestId();
    const isZenith = festId === 'fest_zenith_2026';

    return rows.filter(r => {
        if (isZenith) {
            return r.fest_id === 'fest_zenith_2026' || !r.fest_id;
        } else {
            return r.fest_id === festId;
        }
    });
}

function festosApplyFilter(query, targetFestId = null) {
    if (!query) return query;
    const festId = targetFestId || festosAuth.getCurrentFestId();
    if (festId === 'fest_zenith_2026') {
        return query.or('fest_id.eq.fest_zenith_2026,fest_id.is.null');
    }
    return query.eq('fest_id', festId);
}

function festosWithFest(payload, targetFestId = null) {
    const festId = targetFestId || festosAuth.getCurrentFestId();
    if (!payload) return payload;
    if (Array.isArray(payload)) {
        return payload.map(item => ({ ...item, fest_id: item.fest_id || festId }));
    }
    if (typeof payload === 'object') {
        return { ...payload, fest_id: payload.fest_id || festId };
    }
    return payload;
}

function festosGetSettingKey(key, targetFestId = null) {
    const festId = targetFestId || festosAuth.getCurrentFestId();
    if (festId === 'fest_zenith_2026' || !festId) {
        return key;
    }
    return `${key}_${festId}`;
}

async function festosGetSetting(key, targetFestId = null) {
    const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return null;
    const festId = targetFestId || festosAuth.getCurrentFestId();
    const festKey = festosGetSettingKey(key, festId);
    try {
        let { data, error } = await client.from('settings').select('value').eq('id', festKey).maybeSingle();
        if (data && data.value) return data.value;

        // Do NOT fallback to Zenith Fest for festival-specific scheduling, website customizer, branding, or point system
        const isolatedKeys = ['master_schedule', 'website_config', 'display_settings', 'system_branding', 'point_system'];
        if (isolatedKeys.includes(key)) {
            return null; // Return clean empty state for new festivals
        }

        if (festKey !== key) {
            let baseRes = await client.from('settings').select('value').eq('id', key).maybeSingle();
            if (baseRes.data && baseRes.data.value) return baseRes.data.value;
        }
        return null;
    } catch (e) {
        console.warn(`[FestOS Setting] Error loading ${key}:`, e);
        return null;
    }
}

async function festosSaveSetting(key, value, targetFestId = null) {
    const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return { error: new Error('Supabase client not initialized') };
    const festId = targetFestId || festosAuth.getCurrentFestId();
    const festKey = festosGetSettingKey(key, festId);
    return await client.from('settings').upsert({ id: festKey, value });
}

// Auto-run branding and core initialization on DOM Ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => festosBranding.init());
    } else {
        festosBranding.init();
    }
}

// Expose on window object
if (typeof window !== 'undefined') {
    window.festosSupabase = festosSupabase;
    window.festosBranding = festosBranding;
    window.festosAuth = festosAuth;
    window.festosLogger = festosLogger;
    window.festosFeatures = festosFeatures;
    window.festosFilterRows = festosFilterRows;
    window.festosApplyFilter = festosApplyFilter;
    window.festosWithFest = festosWithFest;
    window.festosGetSettingKey = festosGetSettingKey;
    window.festosGetSetting = festosGetSetting;
    window.festosSaveSetting = festosSaveSetting;
}
