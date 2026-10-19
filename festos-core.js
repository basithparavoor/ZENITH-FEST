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

// Single source of truth for the wildcard base domain (GoDaddy -> Vercel).
// Every festival lives on <subdomain>.<FESTOS_BASE_DOMAIN> and its public
// results page on <subdomain>.<FESTOS_BASE_DOMAIN>/<results-slug>.
const FESTOS_BASE_DOMAIN = 'festos.clubad.space';

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
// 0. FESTIVAL DOMAIN / SUBDOMAIN RESOLUTION
// =========================================================================
const festosDomains = {
    BASE: FESTOS_BASE_DOMAIN,
    INDEX_KEY: 'festos_domain_index',

    getHostname() {
        if (typeof window === 'undefined' || !window.location) return '';
        return (window.location.hostname || '').toLowerCase();
    },

    // Returns the subdomain label when the current host is
    // <label>.<FESTOS_BASE_DOMAIN>, otherwise an empty string.
    getSubdomain() {
        const host = this.getHostname();
        const base = this.BASE;
        if (!host || host === base) return '';
        if (host.endsWith('.' + base)) return host.slice(0, -(base.length + 1));
        return '';
    },

    getIndex() {
        try {
            return JSON.parse(localStorage.getItem(this.INDEX_KEY) || '{}');
        } catch (e) {
            return {};
        }
    },

    setIndex(map) {
        try { localStorage.setItem(this.INDEX_KEY, JSON.stringify(map || {})); } catch (e) { /* ignore */ }
    },

    // Normalize any stored domain value into a bare hostname (no scheme/path)
    normalizeDomain(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .replace(/:\d+$/, '');
    },

    // Build a lookup table { host-or-subdomain: festId } from fests rows
    buildIndex(fests) {
        const map = {};
        (fests || []).forEach(f => {
            if (!f || !f.id) return;
            const dom = this.normalizeDomain(f.domain);
            if (dom) map[dom] = f.id;
            if (f.slug) {
                const slug = String(f.slug).toLowerCase();
                if (!map[slug]) map[slug] = f.id;
            }
        });
        return map;
    },

    // Synchronous resolution from the cached index
    getHostFestId() {
        const host = this.getHostname();
        if (!host) return null;
        const index = this.getIndex();
        if (index[host]) return index[host];
        const sub = this.getSubdomain();
        if (sub && index[sub]) return index[sub];
        return null;
    },

    // Refresh the cached index from the fests table and (re)apply the active fest
    async refresh() {
        const client = (typeof festosSupabase !== 'undefined' && festosSupabase)
            ? festosSupabase
            : (typeof window !== 'undefined' ? window.festosSupabase : null);
        if (!client) return null;
        try {
            const { data, error } = await client.from('fests').select('id, slug, domain');
            if (error || !data) return null;
            this.setIndex(this.buildIndex(data));
            const hostFest = this.getHostFestId();
            if (hostFest) {
                const prev = localStorage.getItem('festos_active_fest_id');
                localStorage.setItem('festos_active_fest_id', hostFest);
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('festos:festresolved', {
                        detail: { festId: hostFest, changed: prev !== hostFest }
                    }));
                }
            }
            return this.getIndex();
        } catch (e) {
            console.warn('[FestOS Domains] Index refresh failed:', e);
            return null;
        }
    },

    // Build a public URL. `target` may be a full domain or a bare subdomain label.
    festUrl(target, path = '') {
        let host = this.normalizeDomain(target);
        if (!host) host = this.BASE;
        else if (!host.includes('.')) host = `${host}.${this.BASE}`;
        const cleanPath = path ? '/' + String(path).replace(/^\//, '') : '';
        return `https://${host}${cleanPath}`;
    },

    resultsUrl(target, resultsSlug = 'results') {
        return this.festUrl(target, resultsSlug || 'results');
    }
};

// =========================================================================
// 1. DYNAMIC AUTO-REBRANDING ENGINE
// =========================================================================
const festosBranding = {
    DEFAULT_NAME: 'FestOS',
    DEFAULT_LOGO: 'festos-logo.svg',

    isSuperAdminPage() {
        return typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('superadmin');
    },

    isLoginPage() {
        if (typeof window === 'undefined' || !window.location) return false;
        const p = window.location.pathname.toLowerCase();
        return p.endsWith('index.html') || p === '/' || p.endsWith('/') || p.includes('login') || p.endsWith('index');
    },

    isPlatformPage() {
        return this.isSuperAdminPage() || this.isLoginPage() || (typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('landing'));
    },

    getCacheKey(festId) {
        if (this.isPlatformPage()) {
            return 'festos_super_branding_cache';
        }
        return festId ? `festos_branding_cache_${festId}` : 'festos_branding_cache_active';
    },

    init() {
        // Clear any contaminated unscoped branding cache on festival pages
        try {
            if (!this.isPlatformPage()) {
                const legacy = localStorage.getItem('festos_branding_cache');
                if (legacy) {
                    try {
                        const parsed = JSON.parse(legacy);
                        if (parsed.fest_name === 'FestOS' || parsed.fest_logo === 'festos-logo.svg') {
                            localStorage.removeItem('festos_branding_cache');
                        }
                    } catch(e) {
                        localStorage.removeItem('festos_branding_cache');
                    }
                }
            }
        } catch(e) {}

        this.applyFromCache();
        this.fetchAndSubscribe();
    },

    applyFromCache() {
        try {
            if (this.isPlatformPage()) {
                const cached = localStorage.getItem('festos_super_branding_cache');
                if (cached) {
                    const data = JSON.parse(cached);
                    this.apply(data);
                } else {
                    this.apply({ fest_name: 'FestOS', fest_logo: 'festos-logo.svg', display_mode: 'both' });
                }
                return;
            }

            const festId = festosAuth.getCurrentFestId();
            const key = this.getCacheKey(festId);
            const cached = localStorage.getItem(key);
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

        if (this.isPlatformPage()) {
            // Super Admin & Login portals: Fetch global software branding added by Super Admin
            try {
                const { data } = await festosSupabase
                    .from('settings')
                    .select('value')
                    .eq('id', 'system_branding')
                    .maybeSingle();

                if (data && data.value) {
                    localStorage.setItem('festos_super_branding_cache', JSON.stringify(data.value));
                    this.apply(data.value);
                }

                festosSupabase
                    .channel('festos_super_branding_realtime')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'settings',
                        filter: 'id=eq.system_branding'
                    }, (payload) => {
                        if (payload && payload.new && payload.new.value) {
                            localStorage.setItem('festos_super_branding_cache', JSON.stringify(payload.new.value));
                            this.apply(payload.new.value);
                        }
                    })
                    .subscribe();
            } catch (err) {
                console.warn('[FestOS Branding] Platform branding fetch error:', err);
            }
            return;
        }

        // FESTIVAL PAGES:
        // Must fetch ONLY the current festival's branding (system_branding_<festId> or fests table)
        // NEVER fetch or apply the super admin's 'system_branding'
        try {
            const festId = festosAuth.getCurrentFestId();
            if (!festId) return;

            const festKey = festosGetSettingKey('system_branding', festId);

            const fetchAndApplyFestBranding = async () => {
                let branding = null;

                // 1. Check festival-specific custom branding setting (system_branding_<festId>)
                const { data: sData } = await festosSupabase
                    .from('settings')
                    .select('value')
                    .eq('id', festKey)
                    .maybeSingle();

                if (sData && sData.value && (sData.value.fest_name || sData.value.fest_logo)) {
                    branding = { ...sData.value };
                }

                // 2. Fetch festival row from fests table for defaults/fallbacks
                const { data: fData } = await festosSupabase
                    .from('fests')
                    .select('name, logo, slug')
                    .eq('id', festId)
                    .maybeSingle();

                if (fData) {
                    if (!branding) {
                        branding = {
                            fest_name: fData.name || 'Festival',
                            fest_logo: fData.logo || '',
                            display_mode: fData.logo ? 'both' : 'name'
                        };
                    } else {
                        if (!branding.fest_logo && fData.logo) branding.fest_logo = fData.logo;
                        if (!branding.fest_name && fData.name) branding.fest_name = fData.name;
                    }
                }

                if (branding) {
                    // Prevent Super Admin software logo from leaking into festival portals
                    if (branding.fest_logo === 'festos-logo.svg' || branding.fest_logo === '/festos-logo.svg') {
                        branding.fest_logo = '';
                    }
                    localStorage.setItem(this.getCacheKey(festId), JSON.stringify(branding));
                    this.apply(branding);
                }
            };

            await fetchAndApplyFestBranding();

            // Realtime subscriptions scoped ONLY to this festival's settings and fests record
            festosSupabase
                .channel(`festos_branding_realtime_${festId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'settings',
                    filter: `id=eq.${festKey}`
                }, () => {
                    fetchAndApplyFestBranding();
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'fests',
                    filter: `id=eq.${festId}`
                }, () => {
                    fetchAndApplyFestBranding();
                })
                .subscribe();

        } catch (err) {
            console.warn('[FestOS Branding] Festival branding fetch error:', err);
        }
    },

    apply(brandingData) {
        if (!brandingData) return;
        const isLogin = this.isLoginPage();
        const isSuper = this.isSuperAdminPage();
        const isPlatform = this.isPlatformPage();

        let festName = brandingData.fest_name ? brandingData.fest_name.trim() : '';
        let festLogo = brandingData.fest_logo ? brandingData.fest_logo.trim() : '';
        const displayMode = brandingData.display_mode || 'both';

        if (isPlatform) {
            // Platform pages (login, superadmin, landing) use Super Admin software branding:
            // If Super Admin added a custom logo, use it! Otherwise fallback to DEFAULT_LOGO
            if (!festName) festName = this.DEFAULT_NAME;
            if (!festLogo) festLogo = this.DEFAULT_LOGO;
        } else {
            // NEVER allow 'festos-logo.svg' on festival pages
            if (festLogo === 'festos-logo.svg' || festLogo === '/festos-logo.svg') {
                festLogo = '';
            }
            if (!festName) {
                festName = 'Festival';
            }
        }

        const validName = festName !== '';
        const validLogo = festLogo !== '';

        // 1. Update Title Dynamically
        if (isLogin) {
            document.title = `${festName} | Secure Login`;
        } else if (isSuper) {
            document.title = `${festName} | Super Admin Control Panel`;
        } else {
            const currentTitle = document.title || 'FestOS';
            const titleParts = currentTitle.split('|');
            const pageContext = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : 'Portal';
            document.title = `${festName} | ${pageContext}`;
        }

        // 2. Dynamic Global Favicon Injection (Super Admin, Login, and all portals)
        if (validLogo) {
            this.updateFavicon(festLogo);
        } else if (isPlatform) {
            this.updateFavicon(this.DEFAULT_LOGO);
        }

        // 3. Update all Brand Containers & Logos on page
        const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1, .brand-container, .brand-logo-text');
        brandContainers.forEach(container => {
            if (container.id === 'page-title' || container.getAttribute('data-no-auto-brand') === 'true') return;

            let html = '';
            if (isLogin) {
                // In login page, render the SuperAdmin-configured software logo & name
                const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
                const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');

                if (showLogo) {
                    html += `<img src="${festLogo}" alt="${festName} Logo" class="festos-dynamic-logo" style="height: 44px; width: auto; max-width: 180px; object-fit: contain; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
                }
                if (showName) {
                    html += `<span class="festos-dynamic-name" style="letter-spacing: -0.5px; font-weight: 800; display: inline-block; vertical-align: middle;">${festName}</span>`;
                }
            } else if (isSuper) {
                const logoSrc = validLogo ? festLogo : this.DEFAULT_LOGO;
                html += `<img src="${logoSrc}" alt="${festName}" class="festos-dynamic-logo" style="width: 30px; height: 30px; object-fit: contain; margin-right: 8px; vertical-align: middle;">`;
                html += `<span class="festos-dynamic-name" style="font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif;">${festName}</span>`;
                html += `<span class="brand-badge" style="margin-left: 8px;">Super</span>`;
            } else {
                const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
                const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');

                if (showLogo) {
                    html += `<img src="${festLogo}" alt="${festName} Logo" class="festos-dynamic-logo" style="height: 36px; width: auto; max-width: 180px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
                } else if (isPlatform) {
                    html += `<img src="festos-logo.svg" alt="FestOS" style="height: 32px; width: 32px; margin-right: 8px; vertical-align: middle;">`;
                }

                if (showName) {
                    let textToDisplay = festName;
                    if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                        textToDisplay += ' Reports Engine';
                    }
                    html += `<span class="festos-dynamic-name" style="letter-spacing: -0.5px; font-weight: 700; display: inline-block; vertical-align: middle;">${textToDisplay}</span>`;
                }
            }

            container.innerHTML = html;
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.flexWrap = 'nowrap';
            if (isLogin) {
                container.style.justifyContent = 'center';
            }
        });

        // Store active branding in global window
        window.systemBranding = brandingData;
    },

    updateFavicon(iconUrl) {
        if (!iconUrl) return;
        let iconLinks = document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']");
        if (iconLinks.length === 0) {
            const newIcon = document.createElement('link');
            newIcon.rel = 'icon';
            document.head.appendChild(newIcon);
            iconLinks = [newIcon];
        }
        iconLinks.forEach(link => {
            link.href = iconUrl;
            if (iconUrl.startsWith('data:image/')) {
                const endMime = iconUrl.indexOf(';');
                if (endMime !== -1) {
                    link.type = iconUrl.substring(5, endMime);
                }
            }
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

        // 1.5. Resolve from the hostname / festival subdomain (e.g. sahi26.festos.clubad.space)
        const hostFestId = festosDomains.getHostFestId();
        if (hostFestId) return hostFestId;

        // 2. Check logged-in user context
        const user = this.getUser();
        if (user && user.role === 'super_admin') {
            // Super admins have global context; fall back to stored active fest or default
            const stored = localStorage.getItem('festos_active_fest_id');
            return (stored && stored.trim() !== '') ? stored.trim() : 'fest_zenith_2026';
        }
        if (user && user.fest_id) return user.fest_id;
        
        if (user && user.username) {
            const prefix = user.username.split('_')[0].toLowerCase().trim();
            if (prefix === 'zenith26' || prefix === 'zenith') return 'fest_zenith_2026';
            if (/^[a-z0-9]{3,20}$/.test(prefix) && prefix !== 'superadmin' && prefix !== 'admin') {
                return `fest_${prefix}`;
            }
        }

        // 3. Check active fest context from storage
        const stored = localStorage.getItem('festos_active_fest_id');
        if (stored && stored.trim() !== '') return stored.trim();

        return 'fest_zenith_2026';
    },

    setUser(user, remember = true) {
        if (!user) return;
        
        if (user.role === 'super_admin') {
            // Do NOT infer or overwrite fest_id for super admins
            user.fest_id = null;
        } else if (!user.fest_id && user.username) {
            const prefix = user.username.split('_')[0].toLowerCase().trim();
            if (prefix === 'zenith26' || prefix === 'zenith') {
                user.fest_id = 'fest_zenith_2026';
            } else if (/^[a-z0-9]{3,20}$/.test(prefix) && prefix !== 'superadmin' && prefix !== 'admin') {
                user.fest_id = `fest_${prefix}`;
            } else {
                user.fest_id = 'fest_zenith_2026';
            }
        }

        localStorage.setItem('festUser', JSON.stringify(user));
        if (user.fest_id && user.role !== 'super_admin') {
            localStorage.setItem('festos_active_fest_id', user.fest_id);
        }
        if (remember) {
            localStorage.setItem('festSavedUsername', user.username || '');
            localStorage.setItem('festos_remember_session', 'true');
        }
        festosLogger.log('AUTH', `User ${user.username} logged in as ${user.role} for fest: ${user.fest_id || 'Global'}`, { userId: user.id, role: user.role, festId: user.fest_id }, 'INFO');
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
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localLogs)); } catch(e) {}

        // Async sync to Supabase audit_logs table if accessible (non-blocking)
        if (festosSupabase) {
            try {
                const currentFid = (typeof festosAuth !== 'undefined' && festosAuth.getCurrentFestId) ? festosAuth.getCurrentFestId() : null;
                festosSupabase.from('audit_logs').insert([{
                    id: logEntry.id,
                    category: logEntry.category,
                    action: logEntry.action,
                    details: logEntry.details || {},
                    severity: logEntry.severity,
                    username: logEntry.user,
                    url: logEntry.url,
                    fest_id: currentFid
                }]).then(() => {}).catch(() => {});
            } catch(dbErr) {}
        }

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

// =========================================================================
// 5. EMERGENCY BROADCASTS & MASTER NOTIFICATIONS ENGINE
// =========================================================================
// Universal Top Banner Host Engine (prevents layout disruption in flexbox dashboards)
function festosGetTopBannerHost() {
    if (typeof document === 'undefined') return null;
    let host = document.getElementById('festos-top-banner-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'festos-top-banner-host';
        host.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:999999; display:flex; flex-direction:column; width:100%; box-sizing:border-box; pointer-events:auto;';
        if (document.body) {
            document.body.appendChild(host);
        }
    }
    return host;
}

function festosUpdateTopBannerPadding() {
    if (typeof document === 'undefined' || !document.body) return;
    const host = document.getElementById('festos-top-banner-host');
    if (!document.body.dataset) document.body.dataset = {};
    if (typeof document.body.dataset.festosBasePaddingTop === 'undefined') {
        const computedPad = (typeof window !== 'undefined' && window.getComputedStyle) ? parseInt(window.getComputedStyle(document.body).paddingTop, 10) || 0 : 0;
        document.body.dataset.festosBasePaddingTop = computedPad;
    }
    const basePad = parseInt(document.body.dataset.festosBasePaddingTop, 10) || 0;
    const bannerHeight = (host && host.children && host.children.length > 0) ? (host.offsetHeight || 0) : 0;
    if (!document.body.style) document.body.style = {};
    document.body.style.paddingTop = (basePad + bannerHeight) + 'px';
    document.body.style.boxSizing = 'border-box';
}

const festosBroadcasts = {
    activeBroadcasts: [],
    STORAGE_KEY: 'festos_cached_broadcasts',

    async init() {
        if (typeof document === 'undefined') return;
        await this.fetchActive();
        this.renderActiveBanner();
        this.listenRealtime();

        // Cross-tab synchronization via storage event
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === this.STORAGE_KEY) {
                    try {
                        const parsed = JSON.parse(e.newValue || '[]');
                        this.activeBroadcasts = Array.isArray(parsed) ? parsed.filter(b => b.is_active !== false) : [];
                        this.renderActiveBanner();
                    } catch(err) {}
                }
            });
        }
    },

    async fetchActive() {
        const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        let list = [];

        if (client) {
            try {
                // 1. Try public.broadcasts table
                const { data, error } = await client
                    .from('broadcasts')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    list = data;
                }
            } catch (err) {}

            // 2. Fallback to settings table if broadcasts table empty or error
            if (list.length === 0) {
                try {
                    const { data: stData } = await client
                        .from('settings')
                        .select('value')
                        .eq('id', 'system_broadcast_active')
                        .maybeSingle();

                    if (stData && stData.value) {
                        const val = stData.value;
                        list = Array.isArray(val) ? val : [val];
                    }
                } catch (stErr) {}
            }
        }

        if (list.length > 0) {
            this.activeBroadcasts = list.filter(b => b.is_active !== false);
            try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list)); } catch(e) {}
        } else {
            try {
                const cached = localStorage.getItem(this.STORAGE_KEY);
                const parsed = cached ? JSON.parse(cached) : [];
                this.activeBroadcasts = Array.isArray(parsed) ? parsed.filter(b => b.is_active !== false) : [];
            } catch(e) {
                this.activeBroadcasts = [];
            }
        }
        return this.activeBroadcasts;
    },

    renderActiveBanner() {
        if (typeof document === 'undefined') return;
        // Check if banner already rendered
        const existing = document.getElementById('festos-broadcast-banner-root');
        if (existing) existing.remove();

        if (!this.activeBroadcasts || this.activeBroadcasts.length === 0) {
            festosUpdateTopBannerPadding();
            return;
        }

        const currentFid = festosAuth.getCurrentFestId();
        const user = festosAuth.getUser() || festosAuth.getSuperAdmin();
        const userRole = user ? user.role : 'public';

        // Find the top banner candidate that matches target and hasn't been dismissed
        const candidate = this.activeBroadcasts.find(b => {
            if (!b || b.is_banner === false || b.is_active === false) return false;
            // Check session dismissal
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('festos_dismissed_b_' + b.id)) {
                return false;
            }
            // Check target festival
            if (b.target_fest_id && b.target_fest_id !== 'all' && b.target_fest_id !== currentFid) {
                return false;
            }
            // Check target role
            if (b.target_role && b.target_role !== 'all') {
                if (b.target_role === 'master_admin') {
                    if (userRole !== 'master_admin' && userRole !== 'admin' && userRole !== 'super_admin') return false;
                } else if (b.target_role !== userRole) {
                    return false;
                }
            }
            return true;
        });

        if (!candidate) {
            festosUpdateTopBannerPadding();
            return;
        }

        // Visual styles based on severity
        const themes = {
            danger: { bg: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)', text: '#FFF', icon: 'fa-triangle-exclamation', border: '#B91C1C' },
            warning: { bg: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', text: '#FFF', icon: 'fa-triangle-exclamation', border: '#D97706' },
            success: { bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)', text: '#FFF', icon: 'fa-circle-check', border: '#059669' },
            info: { bg: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', text: '#FFF', icon: 'fa-bullhorn', border: '#1D4ED8' }
        };
        const theme = themes[candidate.severity] || themes.info;

        const banner = document.createElement('div');
        banner.id = 'festos-broadcast-banner-root';
        banner.style.cssText = `
            width: 100%;
            background: ${theme.bg};
            color: ${theme.text};
            padding: 8px 16px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.18);
            border-bottom: 1px solid rgba(255,255,255,0.25);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 0.85rem;
            animation: festosSlideDown 0.3s ease-out;
            box-sizing: border-box;
            line-height: 1.4;
            flex-shrink: 0;
        `;

        let attachmentHtml = '';
        if (candidate.attachment && (candidate.attachment.url || candidate.attachment.dataUrl)) {
            const attUrl = candidate.attachment.url || candidate.attachment.dataUrl;
            const attName = candidate.attachment.name || 'Download Attachment';
            attachmentHtml = `
                <a href="${attUrl}" download="${attName}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.2); hover:background:rgba(255,255,255,0.3); color:#FFF; padding:3px 9px; border-radius:6px; font-weight:700; font-size:0.75rem; text-decoration:none; margin-left:8px; border:1px solid rgba(255,255,255,0.3); transition:background 0.2s;">
                    <i class="fa-solid fa-paperclip"></i> <span>${attName}</span>
                </a>
            `;
        }

        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                <div style="width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.85rem;">
                    <i class="fa-solid ${theme.icon}"></i>
                </div>
                <div style="min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis;">
                    <strong style="font-weight: 800; letter-spacing: 0.01em;">${candidate.title || 'System Notice'}:</strong>
                    <span style="opacity: 0.95; margin-left: 4px;">${candidate.message || ''}</span>
                    ${attachmentHtml}
                </div>
            </div>
            <button onclick="festosBroadcasts.dismissBanner('${candidate.id}')" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #FFF; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; transition: background 0.2s;" title="Dismiss announcement">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        const host = festosGetTopBannerHost();
        if (host) {
            host.prepend(banner);
            festosUpdateTopBannerPadding();
        } else if (document.body) {
            document.body.prepend(banner);
        }
    },

    dismissBanner(id) {
        if (typeof sessionStorage !== 'undefined' && id) {
            sessionStorage.setItem('festos_dismissed_b_' + id, 'true');
        }
        const b = document.getElementById('festos-broadcast-banner-root');
        if (b) {
            b.style.transition = 'all 0.25s ease';
            b.style.opacity = '0';
            b.style.transform = 'translateY(-100%)';
            setTimeout(() => {
                b.remove();
                festosUpdateTopBannerPadding();
            }, 260);
        }
    },

    listenRealtime() {
        const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        if (!client) return;

        try {
            client.channel('festos_global_broadcasts_realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.system_broadcast_active' }, async () => {
                    await this.fetchActive();
                    this.renderActiveBanner();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, async () => {
                    await this.fetchActive();
                    this.renderActiveBanner();
                })
                .subscribe();
        } catch(e) {}
    }
};

// Auto-run branding and core initialization on DOM Ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            festosBranding.init();
            festosDomains.refresh();
            festosBroadcasts.init();
        });
    } else {
        festosBranding.init();
        festosDomains.refresh();
        festosBroadcasts.init();
    }
}

// Promise that resolves once the subdomain -> fest index is ready.
if (typeof window !== 'undefined') {
    window.festosHostFestReady = (festosDomains.getSubdomain() ? festosDomains.refresh() : Promise.resolve(null));
}

// Expose on window object
if (typeof window !== 'undefined') {
    window.FESTOS_BASE_DOMAIN = FESTOS_BASE_DOMAIN;
    window.festosDomains = festosDomains;
    window.festosSupabase = festosSupabase;
    window.festosBranding = festosBranding;
    window.festosAuth = festosAuth;
    window.festosLogger = festosLogger;
    window.festosBroadcasts = festosBroadcasts;
    window.festosFeatures = festosFeatures;
    window.festosFilterRows = festosFilterRows;
    window.festosApplyFilter = festosApplyFilter;
    window.festosWithFest = festosWithFest;
    window.festosGetSettingKey = festosGetSettingKey;
    window.festosGetSetting = festosGetSetting;
    window.festosSaveSetting = festosSaveSetting;
    window.festosGetTopBannerHost = festosGetTopBannerHost;
    window.festosUpdateTopBannerPadding = festosUpdateTopBannerPadding;
}
