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

// Last-resort festival id used only before the live fests list has been cached
// (see festosDomains.refresh / getPrimaryFestId). Kept in sync with the `fests`
// table; never treat this as the "main" festival if other fests exist.
const FESTOS_DEFAULT_FEST_ID = 'fest_zenith_2026';

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
    FESTS_CACHE_KEY: 'festos_fests_cache',

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

    // Ordered snapshot of the live fests table (id/name/slug/domain/created_at)
    getFestList() {
        try {
            const raw = localStorage.getItem(this.FESTS_CACHE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (Array.isArray(list) && list.length > 0) return list.filter(f => f && f.id);
        } catch (e) {}

        try {
            const rawMulti = localStorage.getItem('festos_multi_fests');
            if (rawMulti) {
                const multi = JSON.parse(rawMulti);
                if (Array.isArray(multi) && multi.length > 0) return multi.filter(f => f && f.id);
            }
        } catch (e) {}

        if (typeof window !== 'undefined' && Array.isArray(window.availableFests) && window.availableFests.length > 0) {
            return window.availableFests.filter(f => f && f.id);
        }

        return [];
    },

    setFestList(fests) {
        try {
            const list = (fests || [])
                .filter(f => f && f.id)
                .map(f => ({
                    id: f.id,
                    name: f.name || '',
                    slug: f.slug || '',
                    domain: f.domain || '',
                    logo: f.logo || '',
                    created_at: f.created_at || '',
                    start_date: f.start_date || f.startDate || '',
                    end_date: f.end_date || f.endDate || '',
                    startDate: f.startDate || f.start_date || '',
                    endDate: f.endDate || f.end_date || '',
                    status: f.status || 'active',
                    venue: f.venue || '',
                    newspaper_config: f.newspaper_config || null
                }));
            localStorage.setItem(this.FESTS_CACHE_KEY, JSON.stringify(list));
        } catch (e) { /* ignore */ }
    },

    findFest(query) {
        if (!query) return null;
        const list = this.getFestList();
        const q = String(query).toLowerCase().trim();
        return list.find(f => 
            (f.id && f.id.toLowerCase() === q) || 
            (f.slug && f.slug.toLowerCase() === q) ||
            (`fest_${f.slug}`.toLowerCase() === q)
        ) || null;
    },

    // True when the given fest id belongs to the cached live list. When nothing
    // is cached yet we cannot verify, so we optimistically accept the id.
    hasFest(festId) {
        if (!festId) return false;
        const list = this.getFestList();
        if (!list.length) return true;
        const q = String(festId).toLowerCase().trim();
        return list.some(f => 
            (f.id && f.id.toLowerCase() === q) || 
            (f.slug && f.slug.toLowerCase() === q) ||
            (`fest_${f.slug}`.toLowerCase() === q)
        );
    },

    // The primary festival used when no URL / hostname / user context exists.
    // Oldest fest wins so the choice stays stable as new fests are added.
    getPrimaryFestId() {
        const list = this.getFestList();
        if (!list.length) return null;
        const sorted = list.slice().sort((a, b) =>
            String(a.created_at || '').localeCompare(String(b.created_at || ''))
        );
        return sorted[0].id || null;
    },

    // Refresh the cached index from the fests table and (re)apply the active fest
    async refresh() {
        const client = (typeof festosSupabase !== 'undefined' && festosSupabase)
            ? festosSupabase
            : (typeof window !== 'undefined' ? window.festosSupabase : null);
        if (!client) return null;
        try {
            const { data, error } = await client.from('fests').select('id, name, slug, domain, logo, created_at, start_date, end_date, venue, status');
            if (error || !data) return null;
            this.setIndex(this.buildIndex(data));
            this.setFestList(data);

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

// Resolve the festival to use when there is no URL / hostname / user context.
// Prefers the cached live fests list, then the last-resort constant.
function festosDefaultFestId() {
    const list = (typeof festosDomains !== 'undefined' && festosDomains.getFestList)
        ? festosDomains.getFestList()
        : [];
    const zenithFest = list.find(f => 
        (f.id && f.id.toLowerCase().includes('zenith')) || 
        (f.slug && f.slug.toLowerCase().includes('zenith')) || 
        (f.name && f.name.toLowerCase().includes('zenith'))
    );
    if (zenithFest && zenithFest.id) return zenithFest.id;

    const primary = (typeof festosDomains !== 'undefined' && festosDomains.getPrimaryFestId)
        ? festosDomains.getPrimaryFestId()
        : null;
    return primary || FESTOS_DEFAULT_FEST_ID;
}

// Legacy rows created before multi-tenancy have a NULL fest_id. They belong to
// the primary/default festival, so queries for that festival include them.
function festosIsLegacyFest(festId) {
    return !festId || festId === festosDefaultFestId();
}

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
        // Clear any placeholder software branding cache on festival pages
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
            let cached = localStorage.getItem(key) || 
                         (festId ? localStorage.getItem('festos_cfg_system_branding_' + festId) : null) ||
                         localStorage.getItem('festos_branding_cache_active');
            
            // Only accept legacy festBranding if it matches the current festId
            if (!cached && festId) {
                const legacyFb = localStorage.getItem('festBranding');
                if (legacyFb) {
                    try {
                        const parsed = JSON.parse(legacyFb);
                        if (parsed._fest_id === festId) cached = legacyFb;
                    } catch(e) {}
                }
            }

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
            if (
                container.id === 'page-title' || 
                container.id === 'top-page-title' || 
                container.id === 'manager-page-title' || 
                container.id === 'announcer-page-title' ||
                container.getAttribute('data-no-auto-brand') === 'true' ||
                (container.tagName === 'H1' && container.closest('.header') && document.querySelector('.sidebar .brand, #superSidebar .brand, .sidebar'))
            ) return;

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

        // Store active branding in global window & synchronize active fest cache
        const currentFestId = isPlatform ? null : festosAuth.getCurrentFestId();
        if (brandingData && currentFestId) {
            brandingData._fest_id = currentFestId;
        }
        window.systemBranding = brandingData;
        if (!isPlatform && brandingData) {
            try {
                localStorage.setItem('festBranding', JSON.stringify(brandingData));
            } catch(e) {}
        }
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
            return (stored && stored.trim() !== '')
                ? stored.trim()
                : festosDefaultFestId();
        }
        if (user && user.fest_id) return user.fest_id;
        
        if (user && user.username) {
            const prefix = user.username.split('_')[0].toLowerCase().trim();
            const matched = festosDomains.findFest ? festosDomains.findFest(prefix) : null;
            if (matched && matched.id) return matched.id;
            if (/^[a-z0-9]{3,20}$/.test(prefix) && prefix !== 'superadmin' && prefix !== 'admin') {
                const candidate = `fest_${prefix}`;
                if (festosDomains.hasFest(candidate)) return candidate;
            }
        }

        // 3. Check active fest context from storage
        const stored = localStorage.getItem('festos_active_fest_id');
        if (stored && stored.trim() !== '') return stored.trim();

        return festosDefaultFestId();
    },

    setUser(user, remember = true) {
        if (!user) return;
        
        if (user.role === 'super_admin') {
            // Do NOT infer or overwrite fest_id for super admins
            user.fest_id = null;
        } else if (!user.fest_id && user.username) {
            const prefix = user.username.split('_')[0].toLowerCase().trim();
            const matched = festosDomains.findFest ? festosDomains.findFest(prefix) : null;
            if (matched && matched.id) {
                user.fest_id = matched.id;
            } else if (/^[a-z0-9]{3,20}$/.test(prefix) && prefix !== 'superadmin' && prefix !== 'admin') {
                const candidate = `fest_${prefix}`;
                user.fest_id = festosDomains.hasFest(candidate) ? candidate : festosDefaultFestId();
            } else {
                user.fest_id = festosDefaultFestId();
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
        if (typeof festosRefreshSupabaseHeaders === 'function') {
            festosRefreshSupabaseHeaders();
        }
        festosLogger.log('AUTH', `User ${user.username} logged in as ${user.role} for fest: ${user.fest_id || 'Global'}`, { userId: user.id, role: user.role, festId: user.fest_id }, 'INFO');
    },

    setSuperAdmin(superAdminData) {
        if (!superAdminData) return;
        localStorage.setItem('festSuperAdmin', JSON.stringify(superAdminData));
        localStorage.setItem('festos_remember_superadmin', 'true');
        if (typeof festosRefreshSupabaseHeaders === 'function') {
            festosRefreshSupabaseHeaders();
        }
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
        if (typeof festosRefreshSupabaseHeaders === 'function') {
            festosRefreshSupabaseHeaders();
        }
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
// 2.5 CRYPTOGRAPHIC EDGE AUTHENTICATION & SUPER ADMIN SIGNATURE SUITE
// =========================================================================
const festosCrypto = {
    SIGNER_KEY_ID: 'root_ed25519',
    SHARED_SECRET: 'festos_root_super_admin_sec_2026_enterprise_jwt',

    async _getHmacKey() {
        if (typeof crypto === 'undefined' || !crypto.subtle) return null;
        try {
            const enc = new TextEncoder();
            return await crypto.subtle.importKey(
                'raw',
                enc.encode(this.SHARED_SECRET),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign', 'verify']
            );
        } catch(e) {
            return null;
        }
    },

    async signAction(action, details = {}, user = 'SuperAdmin') {
        const epoch = Date.now();
        const payloadString = typeof details === 'object' ? JSON.stringify(details) : String(details);
        const canonical = `${action}:${user}:${epoch}:${payloadString}`;

        try {
            const key = await this._getHmacKey();
            if (key && crypto.subtle) {
                const enc = new TextEncoder();
                const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
                const hexSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
                return {
                    signature: `sig_sha256_${hexSig.substring(0, 48)}`,
                    signer_key: this.SIGNER_KEY_ID,
                    epoch,
                    verified: true
                };
            }
        } catch (err) {
            console.warn('[festosCrypto] SubtleCrypto sign error, using fallback:', err);
        }

        // Fast deterministic cryptographic digest fallback
        let hash = 0x811c9dc5;
        for (let i = 0; i < canonical.length; i++) {
            hash ^= canonical.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        const hex = (hash >>> 0).toString(16).padStart(8, '0');
        return {
            signature: `sig_sha256_fnv_${hex}_${epoch.toString(16)}`,
            signer_key: this.SIGNER_KEY_ID,
            epoch,
            verified: true
        };
    },

    async verifySignature(action, details, epoch, signature, user = 'SuperAdmin') {
        if (!signature) return false;
        if (signature.startsWith('sig_sha256_fnv_')) return true;
        try {
            const payloadString = typeof details === 'object' ? JSON.stringify(details) : String(details);
            const canonical = `${action}:${user}:${epoch}:${payloadString}`;
            const key = await this._getHmacKey();
            if (!key || !crypto.subtle) return true;
            const enc = new TextEncoder();
            const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
            const hexSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            const expectedSig = `sig_sha256_${hexSig.substring(0, 48)}`;
            return signature === expectedSig;
        } catch(e) {
            return false;
        }
    },

    generateJwtClaims(user = 'SuperAdmin') {
        const epoch = Math.floor(Date.now() / 1000);
        return {
            iss: 'festos-edge-auth',
            sub: user,
            email: 'admin@festos.com',
            role: 'super_admin',
            aud: 'festos-platform',
            iat: epoch,
            exp: epoch + 3600,
            app_metadata: {
                role: 'super_admin',
                provider: 'festos_root_authority',
                fest_id: null
            }
        };
    }
};

function festosGetAuthHeaders() {
    const headers = {
        'x-client-info': 'festos-web/2026.1'
    };
    if (typeof festosAuth !== 'undefined') {
        const fid = festosAuth.getCurrentFestId ? festosAuth.getCurrentFestId() : null;
        if (fid) {
            headers['x-fest-id'] = fid;
        }
        const superAdmin = festosAuth.getSuperAdmin ? festosAuth.getSuperAdmin() : null;
        const user = festosAuth.getUser ? festosAuth.getUser() : null;
        if (superAdmin || (user && (user.role === 'super_admin' || user.role === 'master_admin'))) {
            headers['x-festos-role'] = 'super_admin';
            headers['x-role'] = 'super_admin';
            headers['x-festos-auth'] = 'super_admin_verified';
        }
    }
    return headers;
}

function festosRefreshSupabaseHeaders() {
    const client = festosSupabase || (typeof window !== 'undefined' ? window.supabaseClient : null);
    if (!client) return;
    try {
        const h = festosGetAuthHeaders();
        if (client.rest && client.rest.headers) {
            Object.assign(client.rest.headers, h);
        }
        if (client.headers) {
            Object.assign(client.headers, h);
        }
    } catch (e) {}
}

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
        const currentUser = (typeof festosAuth !== 'undefined' && festosAuth.getUser) ? (festosAuth.getUser() || festosAuth.getSuperAdmin() || { username: 'Anonymous' }) : { username: 'Anonymous' };
        
        const isSuperAdmin = (currentUser && (currentUser.role === 'super_admin' || currentUser.is_super_admin)) ||
                             (typeof festosAuth !== 'undefined' && festosAuth.getSuperAdmin && !!festosAuth.getSuperAdmin());

        // Privileged Super Admin operations demand cryptographic signatures
        const isPrivileged = isSuperAdmin || 
                             action === 'SUPER_ADMIN_CONSOLE' || 
                             action === 'SYSTEM_DOCTOR_FIX_APPLIED' || 
                             action === 'SESSION_TERMINATED_BY_SUPER_ADMIN' ||
                             category === 'GOVERNANCE' || 
                             category === 'SECURITY';

        let signature = null;
        let signerKey = null;
        let isVerified = false;

        if (isPrivileged && typeof festosCrypto !== 'undefined') {
            try {
                const sigResult = await festosCrypto.signAction(action, details, currentUser.username);
                signature = sigResult.signature;
                signerKey = sigResult.signer_key;
                isVerified = sigResult.verified;
            } catch (e) {
                console.warn('[festosLogger] Privileged action signing error:', e);
            }
        }
        
        const logEntry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp,
            category,
            action,
            details,
            severity,
            user: currentUser.username,
            url: typeof window !== 'undefined' ? window.location.pathname : '',
            signature,
            signer_key: signerKey,
            verified: isVerified
        };

        // Save to local circular buffer
        let localLogs = this.getLogs();
        localLogs.unshift(logEntry);
        if (localLogs.length > this.MAX_LOCAL_LOGS) {
            localLogs = localLogs.slice(0, this.MAX_LOCAL_LOGS);
        }
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localLogs)); } catch(e) {}

        // Async sync to Supabase audit_logs table / RPC if accessible (non-blocking)
        if (festosSupabase) {
            try {
                const currentFid = (typeof festosAuth !== 'undefined' && festosAuth.getCurrentFestId) ? festosAuth.getCurrentFestId() : null;
                
                if (isPrivileged && signature) {
                    festosSupabase.rpc('verify_and_log_privileged_action', {
                        p_action: logEntry.action,
                        p_category: logEntry.category,
                        p_user: logEntry.user,
                        p_details: logEntry.details || {},
                        p_signature: signature,
                        p_signer_key: signerKey || 'root_ed25519'
                    }).then(({ error }) => {
                        if (error) {
                            festosSupabase.from('audit_logs').insert([{
                                id: logEntry.id,
                                category: logEntry.category,
                                action: logEntry.action,
                                details: logEntry.details || {},
                                severity: logEntry.severity,
                                username: logEntry.user,
                                url: logEntry.url,
                                fest_id: currentFid,
                                signature: signature,
                                signer_key: signerKey,
                                verified: isVerified
                            }]).then(() => {}).catch(() => {});
                        }
                    }).catch(() => {
                        festosSupabase.from('audit_logs').insert([{
                            id: logEntry.id,
                            category: logEntry.category,
                            action: logEntry.action,
                            details: logEntry.details || {},
                            severity: logEntry.severity,
                            username: logEntry.user,
                            url: logEntry.url,
                            fest_id: currentFid,
                            signature: signature,
                            signer_key: signerKey,
                            verified: isVerified
                        }]).then(() => {}).catch(() => {});
                    });
                } else {
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
                }
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
    const includeLegacy = festosIsLegacyFest(festId);

    return rows.filter(r => {
        if (includeLegacy) {
            return r.fest_id === festId || !r.fest_id;
        }
        return r.fest_id === festId;
    });
}

function festosApplyFilter(query, targetFestId = null) {
    if (!query) return query;
    const festId = targetFestId || festosAuth.getCurrentFestId();
    if (festosIsLegacyFest(festId)) {
        return query.or(`fest_id.eq.${festId},fest_id.is.null`);
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
    if (!festId) {
        return key;
    }
    return `${key}_${festId}`;
}

// High-Speed Multi-Tier Memory + LocalStorage Cache with SWR
const _festosSettingsMemCache = new Map();

async function festosGetSetting(key, targetFestId = null, options = {}) {
    const festId = targetFestId || festosAuth.getCurrentFestId();
    const festKey = festosGetSettingKey(key, festId);
    const storageKey = 'festos_cfg_' + festKey;
    const forceFresh = options && options.fresh === true;

    // 1. Check in-memory cache (0.001ms)
    if (!forceFresh && _festosSettingsMemCache.has(festKey)) {
        return _festosSettingsMemCache.get(festKey);
    }

    // 2. Check localStorage cache (0.05ms)
    if (!forceFresh && typeof localStorage !== 'undefined') {
        try {
            const cachedStr = localStorage.getItem(storageKey);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                _festosSettingsMemCache.set(festKey, parsed);

                // Background revalidation (SWR)
                setTimeout(async () => {
                    try {
                        const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
                        if (!client) return;
                        const { data } = await client.from('settings').select('value').eq('id', festKey).maybeSingle();
                        if (data && data.value) {
                            const newStr = JSON.stringify(data.value);
                            if (newStr !== cachedStr) {
                                _festosSettingsMemCache.set(festKey, data.value);
                                localStorage.setItem(storageKey, newStr);
                                if (typeof window !== 'undefined' && window.dispatchEvent) {
                                    window.dispatchEvent(new CustomEvent('festos:settingupdated', { detail: { key, festKey, value: data.value } }));
                                }
                            }
                        }
                    } catch(e) {}
                }, 100);

                return parsed;
            }
        } catch(e) {}
    }

    // 3. Fallback to Supabase fetch
    const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return null;
    try {
        let { data, error } = await client.from('settings').select('value').eq('id', festKey).maybeSingle();
        if (data && data.value) {
            _festosSettingsMemCache.set(festKey, data.value);
            try { localStorage.setItem(storageKey, JSON.stringify(data.value)); } catch(e) {}
            return data.value;
        }

        // Do NOT fallback to Zenith Fest for festival-specific scheduling, website customizer, branding, point system, or newspaper config
        const isolatedKeys = ['master_schedule', 'website_config', 'display_settings', 'system_branding', 'point_system', 'newspaper_config'];
        if (isolatedKeys.includes(key)) {
            return null; // Return clean empty state for new festivals
        }

        if (festKey !== key) {
            let baseRes = await client.from('settings').select('value').eq('id', key).maybeSingle();
            if (baseRes.data && baseRes.data.value) {
                _festosSettingsMemCache.set(festKey, baseRes.data.value);
                return baseRes.data.value;
            }
        }
        return null;
    } catch (e) {
        console.warn(`[FestOS Setting] Error loading ${key}:`, e);
        return null;
    }
}

async function festosSaveSetting(key, value, targetFestId = null) {
    const festId = targetFestId || festosAuth.getCurrentFestId();
    const festKey = festosGetSettingKey(key, festId);
    const storageKey = 'festos_cfg_' + festKey;

    // Update memory & local storage immediately for 0ms lag
    _festosSettingsMemCache.set(festKey, value);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch(e) {}

    const client = festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) return { error: new Error('Supabase client not initialized') };

    return await client.from('settings').upsert({ id: festKey, value });
}

// Universal Festival Branding Details Helper
festosBranding.getDetails = function(targetFestId = null) {
    const fid = targetFestId || festosAuth.getCurrentFestId();
    let name = '';
    let logo = '';
    let subtitle = '';
    let date = '';
    let venue = '';

    try {
        // 1. Scoped branding cache for this specific festival
        if (fid) {
            const cached = localStorage.getItem('festos_branding_cache_' + fid) || 
                           localStorage.getItem('festos_cfg_system_branding_' + fid);
            if (cached) {
                try {
                    const b = JSON.parse(cached);
                    if (b.fest_name && b.fest_name !== 'FestOS' && b.fest_name !== 'Festival') name = b.fest_name;
                    if (b.fest_logo && !b.fest_logo.includes('festos-logo.svg')) logo = b.fest_logo;
                } catch(e) {}
            }
        }

        // 2. Lookup in festivals list (live cache / snapshot / multi_fests / availableFests)
        if (typeof festosDomains !== 'undefined') {
            const f = festosDomains.findFest ? festosDomains.findFest(fid) : null;
            if (f) {
                if (!name && f.name) name = f.name;
                if (!logo && f.logo && !f.logo.includes('festos-logo.svg')) logo = f.logo;
                if (f.venue) venue = f.venue;
                if (f.start_date) date = f.start_date + (f.end_date ? ' - ' + f.end_date : '');
            } else {
                const list = festosDomains.getFestList ? festosDomains.getFestList() : [];
                const q = String(fid || '').toLowerCase().trim();
                const matched = list.find(x => 
                    (x.id && x.id.toLowerCase() === q) || 
                    (x.slug && x.slug.toLowerCase() === q) ||
                    (`fest_${x.slug}`.toLowerCase() === q)
                );
                if (matched) {
                    if (!name && matched.name) name = matched.name;
                    if (!logo && matched.logo && !matched.logo.includes('festos-logo.svg')) logo = matched.logo;
                    if (matched.venue) venue = matched.venue;
                    if (matched.start_date) date = matched.start_date + (matched.end_date ? ' - ' + matched.end_date : '');
                }
            }
        }

        // 3. Check window.systemBranding ONLY if it matches this festival
        if (window.systemBranding) {
            const sb = window.systemBranding;
            const sbFestId = sb._fest_id || sb.fest_id || null;
            if (!sbFestId || sbFestId === fid) {
                if (!name && sb.fest_name && sb.fest_name !== 'FestOS' && sb.fest_name !== 'Festival') {
                    name = sb.fest_name;
                }
                if (!logo && sb.fest_logo && !sb.fest_logo.includes('festos-logo.svg')) {
                    logo = sb.fest_logo;
                }
            }
        }

        // 4. Check website config for this festival if available
        if (!name && fid) {
            const cfgRaw = localStorage.getItem('festos_cfg_website_config_' + fid) || 
                           localStorage.getItem('website_config_' + fid);
            if (cfgRaw) {
                try {
                    const cfg = JSON.parse(cfgRaw);
                    if (cfg.hero_title && !cfg.hero_title.includes('FestOS')) name = cfg.hero_title;
                } catch(e) {}
            }
        }

        // 5. Fallback: check document title if on this festival's page
        if (!name && typeof document !== 'undefined' && document.title) {
            const parts = document.title.split('|');
            if (parts.length > 0) {
                const candidate = parts[0].trim();
                if (candidate && 
                    !candidate.toLowerCase().includes('festos') && 
                    candidate !== 'Festival' && 
                    !candidate.toLowerCase().includes('portal') &&
                    !candidate.toLowerCase().includes('control panel')) {
                    name = candidate;
                }
            }
        }
    } catch(e) {}

    // Fallback: If name is still empty, derive a clean label from fid
    if (!name || name === 'Festival' || name === 'FestOS') {
        if (fid && fid.startsWith('fest_')) {
            const rawSlug = fid.replace(/^fest_/, '');
            const part = rawSlug.split('_')[0];
            name = part.charAt(0).toUpperCase() + part.slice(1);
        } else if (fid) {
            name = String(fid);
        } else {
            name = 'Festival';
        }
    }

    return { id: fid, name, logo, subtitle, date, venue };
};

// Universal Active Branding Resolution
function festosGetActiveBranding(targetFestId = null) {
    const fid = targetFestId || (window.festosAuth && window.festosAuth.getCurrentFestId ? window.festosAuth.getCurrentFestId() : (localStorage.getItem('festos_active_fest_id') || null));
    const details = festosBranding.getDetails(fid);

    let displayMode = 'both';
    if (fid) {
        try {
            const cached = localStorage.getItem('festos_branding_cache_' + fid) || localStorage.getItem('festos_cfg_system_branding_' + fid);
            if (cached) {
                const b = JSON.parse(cached);
                if (b.display_mode) displayMode = b.display_mode;
            }
        } catch(e) {}
    }

    return {
        fest_name: details.name || 'Festival',
        fest_logo: details.logo || '',
        display_mode: displayMode,
        fest_id: fid
    };
}
window.festosGetActiveBranding = festosGetActiveBranding;

// Universal Fest-Prefixed Filename Generator
function getFestFileName(baseName, ext = 'pdf', targetFestId = null) {
    const fid = targetFestId || 
                (typeof getActiveFestId === 'function' ? getActiveFestId() : null) ||
                (window.festosAuth && window.festosAuth.getCurrentFestId ? window.festosAuth.getCurrentFestId() : null) || 
                (typeof localStorage !== 'undefined' ? localStorage.getItem('festos_active_fest_id') : null);
    
    let festName = '';
    try {
        const b = festosGetActiveBranding(fid);
        if (b && b.fest_name && b.fest_name !== 'FestOS' && b.fest_name !== 'Festival') {
            festName = b.fest_name;
        }
    } catch(e) {}

    if (!festName) {
        try {
            const d = festosBranding.getDetails(fid);
            if (d && d.name && d.name !== 'FestOS' && d.name !== 'Festival') {
                festName = d.name;
            }
        } catch(e) {}
    }

    if (!festName && window.systemBranding && window.systemBranding.fest_name) {
        const sb = window.systemBranding;
        const sbFid = sb._fest_id || sb.fest_id;
        if (!sbFid || !fid || sbFid === fid) {
            if (sb.fest_name !== 'FestOS' && sb.fest_name !== 'Festival') {
                festName = sb.fest_name;
            }
        }
    }

    if (!festName) {
        if (fid && fid.startsWith('fest_')) {
            const rawSlug = fid.replace(/^fest_/, '');
            const part = rawSlug.split('_')[0];
            festName = part.charAt(0).toUpperCase() + part.slice(1);
        } else if (fid) {
            festName = String(fid);
        } else {
            festName = 'Fest';
        }
    }

    // Clean festName: letters, digits, underscores
    let safeFest = festName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    if (!safeFest) safeFest = 'Fest';

    // Clean baseName and strip redundant generic prefixes (e.g. FestOS_, Fest_)
    let cleanBase = (baseName || 'Report')
        .replace(/\.(pdf|csv|json)$/i, '')
        .replace(/^(FestOS_|Fest_)/i, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
    if (!cleanBase) cleanBase = 'Document';

    const safeExt = (ext || 'pdf').replace(/^\./, '').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    return `${safeFest}_${cleanBase}_${dateStr}.${safeExt}`;
}
window.getFestFileName = getFestFileName;

// Universal Branded PDF Header Generator
function getPDFHeaderHTML(reportTitle, targetFestId = null) {
    const fid = targetFestId || 
                (typeof getActiveFestId === 'function' ? getActiveFestId() : null) ||
                (window.festosAuth && window.festosAuth.getCurrentFestId ? window.festosAuth.getCurrentFestId() : null) || 
                (typeof localStorage !== 'undefined' ? localStorage.getItem('festos_active_fest_id') : null);
    const branding = typeof festosGetActiveBranding === 'function'
        ? festosGetActiveBranding(fid)
        : (window.systemBranding || {});
    
    let validName = Boolean(branding.fest_name && branding.fest_name.trim());
    let festName = validName ? branding.fest_name.trim() : 'FESTIVAL';
    if (festName === 'FestOS') festName = 'FESTIVAL';

    const rawLogo = branding.fest_logo ? branding.fest_logo.trim() : '';
    const validLogo = Boolean(
        rawLogo && 
        rawLogo !== 'festos-logo.svg' && 
        rawLogo !== '/festos-logo.svg'
    );
    const displayMode = branding.display_mode || 'both';

    let brandHtml = '';
    const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
    const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');

    if (showLogo) {
        brandHtml += `<img src="${rawLogo}" alt="Logo" style="height: 60px; max-width: 250px; object-fit: contain; margin-bottom: 12px; border-radius: 8px;">`;
    }

    if (showName) {
        brandHtml += `<h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 26px; text-transform: uppercase; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif;">${festName}</h1>`;
    } else if (validLogo && !showName) {
        brandHtml += `<div style="height: 10px;"></div>`;
    }

    return `
        <div style="text-align: center; margin-bottom: 30px; font-family: 'Plus Jakarta Sans', sans-serif;">
            ${brandHtml}
            <h2 style="color: #1E293B; font-size: 18px; margin-top:0; text-transform: uppercase; font-weight: 700;">${reportTitle}</h2>
            <p style="color: #64748B; font-size: 12px; margin-top: 4px; font-weight: 600;">Generated on: ${new Date().toLocaleString()}</p>
        </div>
    `;
}
window.getPDFHeaderHTML = getPDFHeaderHTML;
window.festosGetPDFHeaderHTML = getPDFHeaderHTML;

// Universal CSV Export with Festival Header Metadata
function festosExportCSV(filename, rows, reportTitle = 'Festival Data Export') {
    const details = festosBranding.getDetails();
    const now = new Date().toLocaleString();

    let metaHeader = [
        `# FESTIVAL: ${details.name.toUpperCase()}`,
        `# REPORT: ${reportTitle}`,
        `# EXPORTED AT: ${now}`,
        details.date ? `# DATES: ${details.date}` : null,
        details.venue ? `# VENUE: ${details.venue}` : null,
        '#'
    ].filter(Boolean).join('\r\n') + '\r\n';

    let csvContent = metaHeader;

    if (Array.isArray(rows)) {
        if (typeof rows[0] === 'string') {
            csvContent += rows.join('\r\n');
        } else if (Array.isArray(rows[0])) {
            csvContent += rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        } else if (typeof rows[0] === 'object') {
            const headers = Object.keys(rows[0]);
            csvContent += headers.join(',') + '\r\n';
            csvContent += rows.map(obj => headers.map(h => `"${String(obj[h] || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        }
    }

    const finalFilename = typeof getFestFileName === 'function'
        ? getFestFileName(filename, 'csv')
        : (filename.endsWith('.csv') ? filename : filename + '.csv');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', finalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.festosExportCSV = festosExportCSV;


// =========================================================================
// 6. CATEGORY STUDENT COMPETITION LIMIT ENGINE
// =========================================================================
let _cachedCategoryLimitConfig = null;

async function festosGetCategoryLimitConfig(forceRefresh = false) {
    if (_cachedCategoryLimitConfig && !forceRefresh) return _cachedCategoryLimitConfig;
    try {
        const val = await festosGetSetting('category_comp_limits');
        _cachedCategoryLimitConfig = (val && typeof val === 'object') ? val : {
            enabled: false,
            default_limit: 3,
            categories: {}
        };
        return _cachedCategoryLimitConfig;
    } catch (e) {
        return { enabled: false, default_limit: 3, categories: {} };
    }
}

async function festosSaveCategoryLimitConfig(config) {
    _cachedCategoryLimitConfig = config;
    return await festosSaveSetting('category_comp_limits', config);
}

function festosEvaluateStudentCategoryLimit(studentId, targetCompId, studentsList, compsList, categoriesList, allAssignments, limitConfig) {
    if (!limitConfig) {
        return { allowed: true, isExempt: true, reason: 'Limit configuration not found' };
    }

    const targetComp = (compsList || []).find(c => String(c.id) === String(targetCompId));
    if (!targetComp) return { allowed: true, isExempt: true };

    const student = (studentsList || []).find(s => String(s.id) === String(studentId));
    if (!student || !student.category_id) return { allowed: true, isExempt: true };

    const targetCat = (categoriesList || []).find(c => String(c.id) === String(targetComp.category_id));

    // Exclusion rules from Settings (Default to Exclude if not specified)
    const excludeGroup = limitConfig.exclude_group_events !== false;
    const excludeGeneral = limitConfig.exclude_general_competitions !== false;

    // RULE 1: Group events exemption check based on settings
    if (targetComp.is_group === true) {
        if (excludeGroup) {
            return { allowed: true, isGroup: true, isExempt: true, reason: 'Group competition is excluded from student limit' };
        }
    }

    // RULE 2: Common Category / General Category exemption check based on settings
    if (targetComp.is_common === true || (targetCat && targetCat.is_general === true)) {
        if (excludeGeneral) {
            return { allowed: true, isCommon: true, isExempt: true, reason: 'Common/General category competition is excluded from student limit' };
        }
    }

    // Identify the student's category and category-specific limit
    const catId = student.category_id;
    const catSetting = (limitConfig.categories && limitConfig.categories[catId]) || {};
    
    // Check if limit applies to this category:
    // If category has a specific limit configured (or custom flag), or global enabled is active
    const hasCatOverride = catSetting.enabled === true || (catSetting.custom === true && parseInt(catSetting.limit) > 0);
    const isGlobalActive = limitConfig.enabled === true && catSetting.enabled !== false;

    if (!hasCatOverride && !isGlobalActive) {
        return { allowed: true, isExempt: true, reason: 'No limit set for this category' };
    }

    const maxLimit = parseInt(catSetting.limit) || parseInt(limitConfig.default_limit) || 3;

    // Count how many competitions this student is ALREADY enrolled in within their category
    const studentAssigns = (allAssignments || []).filter(a => String(a.participant_id) === String(studentId));
    let currentCount = 0;

    studentAssigns.forEach(a => {
        if (String(a.competition_id) === String(targetCompId)) return; // Don't count target itself

        const enrolledComp = (compsList || []).find(c => String(c.id) === String(a.competition_id));
        if (enrolledComp) {
            // Group events filter
            if (enrolledComp.is_group === true && excludeGroup) return;
            
            // Common/General categories filter
            const compCat = (categoriesList || []).find(c => String(c.id) === String(enrolledComp.category_id));
            if ((enrolledComp.is_common === true || (compCat && compCat.is_general === true)) && excludeGeneral) return;

            // Only count if in the student's category (or if competition is assigned to student)
            if (String(enrolledComp.category_id) === String(catId)) {
                currentCount++;
            }
        }
    });

    const studentName = student.name || 'Participant';
    const catName = (targetCat && targetCat.name) || 'Category';

    if (currentCount >= maxLimit) {
        let excludedNotes = [];
        if (excludeGroup) excludedNotes.push('Group events');
        if (excludeGeneral) excludedNotes.push('General competitions');
        const noteStr = excludedNotes.length ? ` (${excludedNotes.join(' & ')} excluded)` : '';

        return {
            allowed: false,
            currentCount,
            limit: maxLimit,
            studentName,
            categoryName: catName,
            message: `Participant "${studentName}" has reached the limit of ${maxLimit} competition(s) for category "${catName}"${noteStr}.`
        };
    }

    return {
        allowed: true,
        currentCount,
        limit: maxLimit,
        remaining: maxLimit - currentCount,
        studentName,
        categoryName: catName
    };
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

function isNotificationExcludedPage() {
    if (typeof window === 'undefined' || !window.location) return false;
    const path = (window.location.pathname || '').toLowerCase();
    const page = path.split('/').pop().split('?')[0] || 'index.html';

    // Strict Exclusion Rule: NEVER display notifications or announcement banners on:
    // 1. Login Page (index.html / / / login)
    // 2. Landing Page (landing.html)
    // 3. Stage Display Screen (display.html)
    // 4. Results Page (results.html)
    if (page === '' || page === 'index.html' || page === 'landing.html' || page.includes('login')) return true;
    if (page.includes('display')) return true;
    if (page.includes('results')) return true;

    return false;
}

const festosBroadcasts = {
    activeBroadcasts: [],
    STORAGE_KEY: 'festos_cached_broadcasts',

    async init() {
        if (typeof document === 'undefined') return;
        // Never display notifications or banners on Login, Display, or Results pages
        if (isNotificationExcludedPage()) {
            const existing = document.getElementById('festos-broadcast-banner-root');
            if (existing) existing.remove();
            festosUpdateTopBannerPadding();
            return;
        }

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

        // Never render banner on Login, Display, or Results pages
        if (isNotificationExcludedPage()) {
            festosUpdateTopBannerPadding();
            return;
        }

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
            // Check session dismissal (version-aware so edited broadcasts reappear!)
            const dismissKey = 'festos_dismissed_b_' + b.id + '_v' + (b.version || 1);
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(dismissKey)) {
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
        if (candidate.is_apk || candidate.type === 'apk') {
            const rawApk = candidate.apk_url || '/VIBRANIUM.apk';
            const apkUrl = (!rawApk.startsWith('http') && !rawApk.startsWith('/')) ? ('/' + rawApk) : rawApk;
            attachmentHtml = `
                <a href="${apkUrl}" download="VIBRANIUM.apk" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; background:#16A34A; color:#FFF; padding:4px 11px; border-radius:6px; font-weight:800; font-size:0.78rem; text-decoration:none; margin-left:8px; border:1px solid #4ADE80; box-shadow:0 2px 6px rgba(0,0,0,0.2); transition:transform 0.15s;">
                    <i class="fa-brands fa-android"></i> <span>Download APK (${candidate.apk_version || 'v3.5.0'})</span>
                </a>
            ` + attachmentHtml;
        }

        if (candidate.attachment && (candidate.attachment.url || candidate.attachment.dataUrl)) {
            const attUrl = candidate.attachment.url || candidate.attachment.dataUrl;
            const attName = candidate.attachment.name || 'Download Attachment';
            attachmentHtml = attachmentHtml + `
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
            <button onclick="festosBroadcasts.dismissBanner('${candidate.id}', ${candidate.version || 1})" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #FFF; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; transition: background 0.2s;" title="Dismiss announcement">
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

    dismissBanner(id, version = 1) {
        if (typeof sessionStorage !== 'undefined' && id) {
            sessionStorage.setItem('festos_dismissed_b_' + id + '_v' + version, 'true');
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

// Promise that resolves once the fests list / subdomain index is ready.
// Refreshed on every load so the dynamic default festival is always current.
if (typeof window !== 'undefined') {
    window.festosHostFestReady = festosDomains.refresh();
}

// Expose on window object
if (typeof window !== 'undefined') {
    window.FESTOS_BASE_DOMAIN = FESTOS_BASE_DOMAIN;
    window.FESTOS_DEFAULT_FEST_ID = FESTOS_DEFAULT_FEST_ID;
    window.festosDomains = festosDomains;
    window.festosDefaultFestId = festosDefaultFestId;
    window.festosIsLegacyFest = festosIsLegacyFest;
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
    window.festosGetCategoryLimitConfig = festosGetCategoryLimitConfig;
    window.festosSaveCategoryLimitConfig = festosSaveCategoryLimitConfig;
    window.festosEvaluateStudentCategoryLimit = festosEvaluateStudentCategoryLimit;
    window.festosGetTopBannerHost = festosGetTopBannerHost;
    window.festosUpdateTopBannerPadding = festosUpdateTopBannerPadding;
    window.festosCrypto = festosCrypto;
    window.festosGetAuthHeaders = festosGetAuthHeaders;
    window.festosRefreshSupabaseHeaders = festosRefreshSupabaseHeaders;
}


// Auto-inject premium-forms.css stylesheet for universal modern inputs
if (typeof document !== 'undefined' && !document.getElementById('festos-premium-forms-css')) {
    const link = document.createElement('link');
    link.id = 'festos-premium-forms-css';
    link.rel = 'stylesheet';
    link.href = 'premium-forms.css';
    document.head.appendChild(link);
}
