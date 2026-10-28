
// Universal 2-Line Split Canvas Text Renderer
function renderCanvasText(ctx, text, field) {
    if (!text) return;
    const str = String(text).trim();
    if (!field || !field.splitTwoLines || !str.includes(' ')) {
        ctx.fillText(str, field.x, field.y);
        return;
    }
    const words = str.split(/\s+/);
    if (words.length <= 1) {
        ctx.fillText(str, field.x, field.y);
        return;
    }
    const splitCount = Math.max(1, Math.min(words.length - 1, parseInt(field.splitWordsFirstLine) || 1));
    const line1 = words.slice(0, splitCount).join(' ');
    const line2 = words.slice(splitCount).join(' ');
    const gap = (field.lineGap !== undefined && field.lineGap !== null) ? Number(field.lineGap) : Math.round((field.size || 40) * 1.15);
    ctx.fillText(line1, field.x, field.y);
    ctx.fillText(line2, field.x, field.y + gap);
}
window.renderCanvasText = renderCanvasText;


// =========================================================================
// STUDENT CATEGORY COMPETITION LIMIT SYSTEM
// =========================================================================

window.cachedCategoryLimitConfig = null;

async function getCategoryLimitConfig(forceRefresh = false) {
    if (window.cachedCategoryLimitConfig && !forceRefresh) return window.cachedCategoryLimitConfig;
    if (typeof festosGetCategoryLimitConfig === 'function') {
        window.cachedCategoryLimitConfig = await festosGetCategoryLimitConfig(forceRefresh);
    } else {
        const val = window.festosGetSetting ? await window.festosGetSetting('category_comp_limits') : null;
        window.cachedCategoryLimitConfig = (val && typeof val === 'object') ? val : { enabled: false, default_limit: 3, categories: {} };
    }
    return window.cachedCategoryLimitConfig;
}

async function saveCategoryLimitConfig(config) {
    window.cachedCategoryLimitConfig = config;
    if (typeof festosSaveCategoryLimitConfig === 'function') {
        return await festosSaveCategoryLimitConfig(config);
    } else if (window.festosSaveSetting) {
        return await window.festosSaveSetting('category_comp_limits', config);
    }
}

function toggleMasterCategoryLimitUI(isChecked) {
    const controls = document.getElementById('master-cat-limit-controls');
    const label = document.getElementById('master-cat-limit-status-label');
    if (controls) controls.style.display = isChecked ? 'flex' : 'none';
    if (label) {
        label.innerText = isChecked ? 'Limit: ON' : 'Limit: OFF';
        label.style.color = isChecked ? 'var(--success)' : 'var(--text-muted)';
    }
}

async function initCategoryLimitUI() {
    const config = await getCategoryLimitConfig();
    const toggle = document.getElementById('master-cat-limit-toggle');
    const input = document.getElementById('master-cat-limit-input');

    if (toggle) toggle.checked = !!config.enabled;
    if (input) input.value = config.default_limit || 3;
    toggleMasterCategoryLimitUI(!!config.enabled);
}

async function saveMasterCategoryLimitSettings() {
    const toggle = document.getElementById('master-cat-limit-toggle');
    const input = document.getElementById('master-cat-limit-input');

    const enabled = toggle ? toggle.checked : false;
    const default_limit = input ? (parseInt(input.value) || 3) : 3;

    const currentConfig = await getCategoryLimitConfig();
    const newConfig = {
        ...currentConfig,
        enabled,
        default_limit,
        updated_at: new Date().toISOString()
    };

    try {
        await saveCategoryLimitConfig(newConfig);
        showToast(enabled ? `Student Category Limit enabled (Max ${default_limit} / student)!` : 'Student Category Limit disabled.', 'success');
        await loadCategories();
    } catch (err) {
        showToast('Failed to save category limit settings: ' + err.message, 'error');
    }
}

async function saveCategoryCompLimit(catId, customEnabled, limitNum) {
    const currentConfig = await getCategoryLimitConfig();
    if (!currentConfig.categories) currentConfig.categories = {};

    currentConfig.categories[catId] = {
        enabled: customEnabled,
        custom: customEnabled,
        limit: limitNum
    };

    await saveCategoryLimitConfig(currentConfig);
}

const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
window.supabaseClient = supabaseClient;
window.festosSupabase = supabaseClient;

// Initialize available fests for studio engines & tabs
try {
    let fList = (typeof festosDomains !== 'undefined' && festosDomains.getFestList) ? festosDomains.getFestList() : [];
    if (!fList.length) {
        const rawMulti = localStorage.getItem('festos_multi_fests');
        if (rawMulti) fList = JSON.parse(rawMulti);
    }
    window.availableFests = Array.isArray(fList) ? fList : [];
} catch(e) { window.availableFests = []; }

// Auth check (allow admin, master_admin, or super_admin)
const user = (typeof festosAuth !== 'undefined') ? (festosAuth.getUser() || festosAuth.getSuperAdmin()) : JSON.parse(localStorage.getItem('festUser') || localStorage.getItem('festSuperAdmin') || 'null');
const allowedAdminRoles = ['admin', 'master_admin', 'super_admin'];
if (!user || !allowedAdminRoles.includes(user.role)) {
    window.location.href = 'index.html';
}

// Super Admin Console Impersonation Bar
if (user && user.role === 'super_admin') {
    const renderSuperAdminConsoleBar = () => {
        if (document.getElementById('festos-superadmin-console-banner')) return;
        const activeFid = (typeof getActiveFestId === 'function') ? getActiveFestId() : 'active_fest';
        const bar = document.createElement('div');
        bar.id = 'festos-superadmin-console-banner';
        bar.style.cssText = 'width:100%; background:linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); color:#FFF; padding:7px 16px; display:flex; align-items:center; justify-content:space-between; font-size:0.85rem; border-bottom:2px solid #6366F1; box-shadow:0 2px 10px rgba(0,0,0,0.18); flex-wrap:wrap; gap:8px; box-sizing:border-box; flex-shrink:0;';
        bar.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:#4F46E5; color:white; padding:2px 8px; border-radius:999px; font-weight:800; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px;">Super Admin Impersonation</span>
                <span>Active Festival Scope: <strong style="color:#A5B4FC; font-family:monospace;">${activeFid}</strong></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <a href="superadmin.html" style="color:#C7D2FE; font-weight:700; text-decoration:none; display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.12); padding:4px 12px; border-radius:6px; font-size:0.8rem; border:1px solid rgba(255,255,255,0.2);">
                    <i class="fa-solid fa-arrow-left"></i> Return to Super Admin Hub
                </a>
            </div>
        `;
        const host = (window.festosGetTopBannerHost) ? window.festosGetTopBannerHost() : document.getElementById('festos-top-banner-host');
        if (host) {
            host.appendChild(bar);
            if (window.festosUpdateTopBannerPadding) window.festosUpdateTopBannerPadding();
        } else if (document.body) {
            let customHost = document.createElement('div');
            customHost.id = 'festos-top-banner-host';
            customHost.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:999999; display:flex; flex-direction:column; width:100%; box-sizing:border-box;';
            document.body.appendChild(customHost);
            customHost.appendChild(bar);
            document.body.style.paddingTop = customHost.offsetHeight + 'px';
            document.body.style.boxSizing = 'border-box';
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderSuperAdminConsoleBar);
    } else {
        renderSuperAdminConsoleBar();
    }
}

// Global cached data for dropdowns

// --- FESTOS MULTI-TENANCY HELPERS ---
function getActiveFestId() {
    if (window.festosAuth && typeof window.festosAuth.getCurrentFestId === 'function') {
        return window.festosAuth.getCurrentFestId();
    }
    const u = JSON.parse(localStorage.getItem('festUser') || '{}');
    return u.fest_id || localStorage.getItem('festos_active_fest_id') ||
        (window.festosDefaultFestId ? window.festosDefaultFestId() : 'fest_zenith_2026');
}

// Category Limit Helpers
async function festosGetAdminCategoryLimitConfig(...args) {
    if (typeof window.festosGetCategoryLimitConfig === 'function') {
        return await window.festosGetCategoryLimitConfig(...args);
    }
    if (typeof festosGetCategoryLimitConfig === 'function') {
        return await festosGetCategoryLimitConfig(...args);
    }
    return { enabled: false, default_limit: 3, categories: {} };
}

async function festosSaveAdminCategoryLimitConfig(...args) {
    if (typeof window.festosSaveCategoryLimitConfig === 'function') {
        return await window.festosSaveCategoryLimitConfig(...args);
    }
    if (typeof festosSaveCategoryLimitConfig === 'function') {
        return await festosSaveCategoryLimitConfig(...args);
    }
    return Promise.resolve();
}

function festQuery(query, targetFestId = null) {
    if (window.festosApplyFilter) {
        return window.festosApplyFilter(query, targetFestId);
    }
    const fid = targetFestId || getActiveFestId();
    if (window.festosIsLegacyFest ? window.festosIsLegacyFest(fid) : false) return query.or(`fest_id.eq.${fid},fest_id.is.null`);
    return query.eq('fest_id', fid);
}

function festPayload(payload, targetFestId = null) {
    if (window.festosWithFest) {
        return window.festosWithFest(payload, targetFestId);
    }
    const fid = targetFestId || getActiveFestId();
    if (Array.isArray(payload)) {
        return payload.map(i => ({ ...i, fest_id: i.fest_id || fid }));
    }
    return { ...payload, fest_id: payload.fest_id || fid };
}

let categoriesList = [];
let stagesList = [];
let teamsList = [];
let participantsList = [];
let filteredParticipantsList = [];
let competitionsList = [];
let availableControllers = [];
let currentCropper = null; // Added for image cropping
let dashRegChart = null; 
let dashTeamChart = null;

// Expose live dynamic accessors for external modules (e.g. ID Badge Engine)
try {
    Object.defineProperty(window, 'participantsList', { get: () => participantsList, set: v => { participantsList = v; }, configurable: true });
    Object.defineProperty(window, 'filteredParticipantsList', { get: () => filteredParticipantsList, set: v => { filteredParticipantsList = v; }, configurable: true });
    Object.defineProperty(window, 'teamsList', { get: () => teamsList, set: v => { teamsList = v; }, configurable: true });
    Object.defineProperty(window, 'categoriesList', { get: () => categoriesList, set: v => { categoriesList = v; }, configurable: true });
    Object.defineProperty(window, 'competitionsList', { get: () => competitionsList, set: v => { competitionsList = v; }, configurable: true });
} catch (e) {
    window.participantsList = participantsList;
    window.filteredParticipantsList = filteredParticipantsList;
    window.teamsList = teamsList;
    window.categoriesList = categoriesList;
    window.competitionsList = competitionsList;
}
window.getAdminParticipantsList = () => participantsList;
window.getAdminFilteredList = () => filteredParticipantsList;
window.getAdminTeamsList = () => teamsList;
window.getAdminCategoriesList = () => categoriesList;

// --- FESTOS CLASS SYSTEM MANAGEMENT ---
window.currentClassSystem = {
    enabled: false,
    mandatory: false,
    classes: []
};

async function getCategoryClassesMapping() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('category_classes') : null;
        return (val && typeof val === 'object') ? val : {};
    } catch (e) {
        return {};
    }
}

async function saveCategoryClassesMapping(catId, classesArr) {
    try {
        const mapping = await getCategoryClassesMapping();
        mapping[catId] = Array.isArray(classesArr) ? classesArr : [];
        if (window.festosSaveSetting) {
            await window.festosSaveSetting('category_classes', mapping);
        }
    } catch (e) {
        console.warn("Could not save category classes mapping:", e);
    }
}

async function getParticipantClassesMapping() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('participant_classes') : null;
        return (val && typeof val === 'object') ? val : {};
    } catch (e) {
        return {};
    }
}

async function saveParticipantClassMapping(partId, className) {
    try {
        const mapping = await getParticipantClassesMapping();
        mapping[partId] = className || '';
        if (window.festosSaveSetting) {
            await window.festosSaveSetting('participant_classes', mapping);
        }
    } catch (e) {
        console.warn("Could not save participant class mapping:", e);
    }
}

async function loadClassSystemSettings() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('class_system') : null;
        if (val) {
            window.currentClassSystem = {
                enabled: !!val.enabled,
                mandatory: !!val.mandatory,
                classes: Array.isArray(val.classes) ? val.classes : []
            };
        }
    } catch (e) {
        console.warn("Could not load class system settings:", e);
    }
}

window.toggleClassSettingsUI = function(enabled) {
    const details = document.getElementById('class-settings-details');
    const knob = document.getElementById('class-toggle-knob');
    if (details) details.style.display = enabled ? 'block' : 'none';
    if (knob) {
        knob.style.transform = enabled ? 'translateX(20px)' : 'translateX(0)';
        if (knob.previousElementSibling) {
            knob.previousElementSibling.style.backgroundColor = enabled ? 'var(--primary)' : '#D1D5DB';
        }
    }
    window.currentClassSystem.enabled = !!enabled;
    window.renderConfiguredClasses();
};

window.renderConfiguredClasses = function() {
    const container = document.getElementById('configured-classes-container');
    if (!container) return;
    const classes = window.currentClassSystem?.classes || [];
    if (classes.length === 0) {
        container.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No classes configured yet. Add classes above or load a standard preset.</span>';
        return;
    }
    container.innerHTML = classes.map((cls, idx) => `
        <span style="display: inline-flex; align-items: center; gap: 0.4rem; background: var(--bg-main); border: 1px solid var(--border); padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
            <i class="fa-solid fa-graduation-cap" style="color: var(--primary); font-size: 0.75rem;"></i>
            ${cls}
            <button type="button" onclick="window.removeClassTag(${idx})" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 0.9rem; padding: 0 0 0 2px; line-height: 1;">&times;</button>
        </span>
    `).join('');
};

window.addClassTag = function(customName) {
    const input = document.getElementById('new-class-input');
    const val = (customName || (input ? input.value : '')).trim();
    if (!val) return;
    if (!window.currentClassSystem.classes) window.currentClassSystem.classes = [];
    if (window.currentClassSystem.classes.some(c => c.toLowerCase() === val.toLowerCase())) {
        showToast(`Class "${val}" already exists!`, 'warning');
        return;
    }
    window.currentClassSystem.classes.push(val);
    if (input) input.value = '';
    window.renderConfiguredClasses();
};

window.removeClassTag = function(idx) {
    if (!window.currentClassSystem.classes) return;
    window.currentClassSystem.classes.splice(idx, 1);
    window.renderConfiguredClasses();
};

window.loadClassPreset = function(type) {
    if (!window.currentClassSystem.classes) window.currentClassSystem.classes = [];
    let preset = [];
    if (type === 'class-1-12') {
        preset = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
    } else if (type === 'grade-1-12') {
        preset = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);
    }
    preset.forEach(p => {
        if (!window.currentClassSystem.classes.some(c => c.toLowerCase() === p.toLowerCase())) {
            window.currentClassSystem.classes.push(p);
        }
    });
    window.renderConfiguredClasses();
    showToast(`Loaded ${preset.length} classes from preset!`);
};

// --- UI UTILITIES (PREMIUM UPGRADES) ---
// =========================================================================
// 3-STEP COLLAPSIBLE SIDEBAR ENGINE (ADMIN)
// Step 0: Expanded -> Step 1: Compact (Buttons Only) -> Step 2: Hidden -> Step 0
// =========================================================================
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        // Mobile off-canvas drawer
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        if (sidebar && overlay) {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        }
    } else {
        // Desktop 3-Step Cycle
        const body = document.body;
        let nextState = 'compact';
        if (body.classList.contains('sidebar-compact')) {
            body.classList.remove('sidebar-compact');
            body.classList.add('sidebar-hidden');
            nextState = 'hidden';
        } else if (body.classList.contains('sidebar-hidden') || body.classList.contains('sidebar-collapsed')) {
            body.classList.remove('sidebar-hidden', 'sidebar-collapsed', 'sidebar-compact');
            nextState = 'expanded';
        } else {
            body.classList.add('sidebar-compact');
            nextState = 'compact';
        }

        try {
            localStorage.setItem('festos_admin_sidebar_state', nextState);
        } catch (e) {}
        updateAdminSidebarTooltip(nextState);

        // Hide flyout if changing state
        hideSidebarFlyout();

        // Trigger resize events for Chart.js and grids so right cards are never pushed outside
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (typeof dashRegChart !== 'undefined' && dashRegChart) dashRegChart.resize();
            if (typeof dashTeamChart !== 'undefined' && dashTeamChart) dashTeamChart.resize();
        }, 320);
    }
}

// --- COMPACT SIDEBAR FLYOUT SUBMENU ENGINE ---
let flyoutHideTimeout = null;

function hideSidebarFlyout() {
    const flyout = document.getElementById('sidebar-compact-flyout');
    if (flyout) flyout.classList.remove('active');
}

function initCompactSidebarFlyout() {
    const flyout = document.getElementById('sidebar-compact-flyout');
    if (!flyout) return;

    flyout.addEventListener('mouseenter', () => {
        clearTimeout(flyoutHideTimeout);
    });
    flyout.addEventListener('mouseleave', () => {
        hideSidebarFlyout();
    });

    document.addEventListener('mouseover', (e) => {
        if (!document.body.classList.contains('sidebar-compact')) return;

        const navGroup = e.target.closest('.sidebar .nav-group, .sidebar #master-admin-portals');
        if (!navGroup) {
            if (!e.target.closest('#sidebar-compact-flyout')) {
                clearTimeout(flyoutHideTimeout);
                flyoutHideTimeout = setTimeout(hideSidebarFlyout, 150);
            }
            return;
        }

        clearTimeout(flyoutHideTimeout);
        const navMain = navGroup.querySelector('.nav-main');
        const navSub = navGroup.querySelector('.nav-sub');
        const portalLinks = navGroup.querySelectorAll('a.nav-main');

        let title = '';
        let items = [];

        if (navSub) {
            // Group with sub-items
            title = navMain ? navMain.innerText.trim() : 'Menu';
            const subItems = navSub.querySelectorAll('.nav-item');
            subItems.forEach(item => {
                items.push({
                    text: item.innerText.trim(),
                    onclick: item.getAttribute('onclick') || ''
                });
            });
        } else if (navGroup.id === 'master-admin-portals' && portalLinks.length > 0) {
            title = 'Cross-Portal Access';
            portalLinks.forEach(a => {
                items.push({
                    text: a.innerText.trim(),
                    href: a.getAttribute('href') || ''
                });
            });
        } else {
            hideSidebarFlyout();
            return;
        }

        if (items.length === 0) {
            hideSidebarFlyout();
            return;
        }

        // Populate and position flyout
        const rect = (navMain || navGroup).getBoundingClientRect();
        let html = `<div class="flyout-header">${title}</div>`;
        items.forEach(it => {
            if (it.onclick) {
                html += `<div class="flyout-item" onclick="${it.onclick}; hideSidebarFlyout();">${it.text}</div>`;
            } else if (it.href) {
                html += `<a href="${it.href}" class="flyout-item" style="text-decoration:none;" onclick="hideSidebarFlyout();">${it.text}</a>`;
            }
        });

        flyout.innerHTML = html;
        const topPos = Math.max(10, Math.min(rect.top, window.innerHeight - 300));
        flyout.style.top = topPos + 'px';
        flyout.style.left = '76px';
        flyout.classList.add('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sidebar') && !e.target.closest('#sidebar-compact-flyout')) {
            hideSidebarFlyout();
        }
    });
}

document.addEventListener('DOMContentLoaded', initCompactSidebarFlyout);


function updateAdminSidebarTooltip(state) {
    const btn = document.querySelector('.menu-toggle');
    if (!btn) return;
    if (state === 'compact') {
        btn.title = 'Sidebar: Buttons Only (Click to Hide) - Ctrl+B';
    } else if (state === 'hidden') {
        btn.title = 'Sidebar: Hidden (Click to Expand) - Ctrl+B';
    } else {
        btn.title = 'Sidebar: Expanded (Click for Buttons Only) - Ctrl+B';
    }
}

// Restore Admin desktop 3-step state on load
try {
    if (window.innerWidth > 768) {
        const savedState = localStorage.getItem('festos_admin_sidebar_state');
        if (savedState === 'compact') {
            document.body.classList.add('sidebar-compact');
            updateAdminSidebarTooltip('compact');
        } else if (savedState === 'hidden' || savedState === 'true' || localStorage.getItem('festos_admin_sidebar_collapsed') === 'true') {
            document.body.classList.add('sidebar-hidden');
            updateAdminSidebarTooltip('hidden');
        } else {
            updateAdminSidebarTooltip('expanded');
        }
    }
} catch (e) {}

// Ctrl+B shortcut for desktop sidebar collapse
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        toggleSidebar();
    }
});

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message); // Fallback

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:var(--success); font-size:1.25rem;"></i>' 
                                    : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger); font-size:1.25rem;"></i>';
    toast.innerHTML = `${icon} <span style="font-weight:500;">${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.animation = 'fadeOut 0.3s forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.innerHTML = btn.dataset.originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function toggleSubmenu(element) {
    const parent = element.parentElement;
    const submenu = parent.querySelector('.nav-sub');
    
    // Close all other main tabs and submenus
    document.querySelectorAll('.nav-main').forEach(nav => {
        if (nav !== element) nav.classList.remove('open');
    });
    document.querySelectorAll('.nav-sub').forEach(sub => {
        if (sub !== submenu) sub.classList.remove('open');
    });

    // Toggle the clicked one
    element.classList.toggle('open');
    if (element.classList.contains('open')) {
        submenu.classList.add('open');
    } else {
        submenu.classList.remove('open');
    }
}

function switchTab(tabId) {
    if (tabId === 'ai-newspaper') {
        const festId = (typeof getActiveFestId === 'function') ? getActiveFestId() : (window.festosAuth?.getCurrentFestId() || 'active_fest');
        let cfg = null;
        try {
            const raw = localStorage.getItem('festos_cfg_newspaper_config_' + festId) || localStorage.getItem('festMetadata_' + festId);
            if (raw) {
                const parsed = JSON.parse(raw);
                cfg = parsed.newspaper_config || parsed;
            }
        } catch(e) {}
        if (cfg && cfg.enabled === false) {
            showToast("Daily AI Newspaper is currently disabled by Super Admin.", "warning");
            syncNewspaperTabVisibility();
            return;
        }
    }

    // 1. Remove active states from EVERYTHING
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.nav-main').forEach(nav => nav.classList.remove('active'));
    
    // 2. Show the target content section
    document.getElementById(tabId).classList.add('active');
    
    // 3. Find the clicked nav item and highlight it
    const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if(activeNav) {
        activeNav.classList.add('active');
        
        // If it's a sub-item, ALSO highlight its parent main tab
        if (activeNav.classList.contains('nav-item')) {
            const parentGroup = activeNav.closest('.nav-group');
            if (parentGroup) {
                const mainItem = parentGroup.querySelector('.nav-main');
                if(mainItem) mainItem.classList.add('active');
            }
        } else if (activeNav.classList.contains('nav-main')) {
            // If it's a standalone main tab (like Dashboard), close all submenus
            document.querySelectorAll('.nav-main').forEach(nav => nav.classList.remove('open'));
            document.querySelectorAll('.nav-sub').forEach(sub => sub.classList.remove('open'));
        }
        
        // Update header title
        const pageTitle = document.getElementById('page-title');
        if(pageTitle) pageTitle.innerText = activeNav.innerText.trim();
    }

    // Auto-close sidebar on mobile
    if(window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.querySelector('.mobile-overlay')?.classList.remove('open');
    }

    try {
        if (tabId === 'dashboard') loadAdminDashboard();
        else if (tabId === 'categories') loadCategories();
        else if (tabId === 'competitions') loadCompetitions();
        else if (tabId === 'participants') loadParticipants();
        else if (tabId === 'stages') loadStagesAndTeams();
        else if (tabId === 'teams') loadStagesAndTeams();
        else if (tabId === 'users') loadUsers();
        else if (tabId === 'judges') loadJudgesManagement();
        else if (tabId === 'assignments') initAssignWorkspace();
        else if (tabId === 'direct-valuation') initDirectValuation();
        else if (tabId === 'point-settings') loadPointSettings(); 
        else if (tabId === 'branding-settings') loadBrandingSettings();
        else if (tabId === 'participant-points') loadParticipantPoints();
        else if (tabId === 'admin-appeals') loadAdminAppeals(); 
        else if (tabId === 'display-control') loadDisplaySettings();
        else if (tabId === 'schedule-mgmt') loadSchedules();
        else if (tabId === 'poster-templates') {
            const libView = document.getElementById('template-library-view');
            const studioView = document.getElementById('template-studio-view');
            if (libView) libView.style.display = 'block';
            if (studioView) studioView.style.display = 'none';
            if (typeof loadTemplatesList === 'function') loadTemplatesList();
        }
        else if (tabId === 'ai-newspaper') {
            if (typeof window.checkNewspaperPolicyStatus === 'function') {
                window.checkNewspaperPolicyStatus();
            } else if (typeof window.validateFestivalDateAccess === 'function') {
                window.validateFestivalDateAccess();
            }
            if (typeof window.loadOrCreateEdition === 'function') {
                const todayStr = document.getElementById('np-edition-date')?.value || new Date().toISOString().split('T')[0];
                window.loadOrCreateEdition(todayStr);
            }
            setTimeout(() => {
                if (typeof window.validateFestivalDateAccess === 'function') {
                    window.validateFestivalDateAccess();
                }
                if (typeof window.fitNewspaperToScreen === 'function') {
                    window.fitNewspaperToScreen();
                }
            }, 120);
        }
        else if (tabId === 'website-builder') {
            if (typeof switchBuilderTab === 'function') {
                switchBuilderTab('overview', document.querySelector('.builder-nav-item.active') || document.querySelectorAll('.builder-nav-item')[0]);
            }
            if (typeof loadWebsiteConfig === 'function') loadWebsiteConfig();
        }
    } catch (e) {
        showToast("Failed to fetch dashboard data.", "error");
    }
}
window.switchTab = switchTab;

function syncNewspaperTabVisibility() {
    try {
        const festId = (typeof getActiveFestId === 'function') ? getActiveFestId() : (window.festosAuth?.getCurrentFestId() || 'active_fest');
        const navItem = document.getElementById('nav-item-ai-newspaper') || document.querySelector('[onclick*="switchTab(\'ai-newspaper\')"]');
        if (!navItem) return;

        let config = null;
        try {
            const rawCfg = localStorage.getItem('festos_cfg_newspaper_config_' + festId);
            if (rawCfg) config = JSON.parse(rawCfg);
        } catch(e) {}
        if (!config) {
            try {
                const rawMeta = localStorage.getItem('festMetadata_' + festId);
                if (rawMeta) {
                    const parsed = JSON.parse(rawMeta);
                    if (parsed && parsed.newspaper_config) config = parsed.newspaper_config;
                }
            } catch(e) {}
        }
        if (!config && window.availableFests) {
            const f = window.availableFests.find(x => x.id === festId);
            if (f && f.newspaper_config) config = f.newspaper_config;
        }

        const isEnabled = config ? (config.enabled !== false) : true;
        if (!isEnabled) {
            navItem.style.display = 'none';
            const aiSec = document.getElementById('ai-newspaper');
            if (aiSec && aiSec.classList.contains('active')) {
                switchTab('dashboard');
                if (typeof showToast === 'function') {
                    showToast('Daily AI Newspaper is disabled by Super Admin.', 'warning');
                }
            }
        } else {
            navItem.style.display = '';
        }
    } catch(e) {
        console.warn('syncNewspaperTabVisibility error:', e);
    }
}
window.syncNewspaperTabVisibility = syncNewspaperTabVisibility;

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(syncNewspaperTabVisibility, 150);
});
window.addEventListener('storage', (e) => {
    if (e.key && (e.key.includes('newspaper_config') || e.key.includes('festMetadata') || e.key.includes('multi_fests'))) {
        syncNewspaperTabVisibility();
    }
});
window.addEventListener('festos_newspaper_config_updated', () => {
    syncNewspaperTabVisibility();
});


async function loadAdminDashboard() {
    try {
        if (window.festosHostFestReady) {
            try { await window.festosHostFestReady; } catch (e) {}
        }

        const [
            { count: compCount },
            { count: partCount },
            { count: catCount },
            { count: teamCount },
            { count: enrolCount },
            { data: allCompsData },
            schedDataVal,
            { data: teamsData },
            { data: judgementsData },
            { data: participantsData }
        ] = await Promise.all([
            festQuery(supabaseClient.from('competitions').select('*', { count: 'exact', head: true })),
            festQuery(supabaseClient.from('participants').select('*', { count: 'exact', head: true })),
            festQuery(supabaseClient.from('categories').select('*', { count: 'exact', head: true })),
            festQuery(supabaseClient.from('teams').select('*', { count: 'exact', head: true })),
            festQuery(supabaseClient.from('participant_competitions').select('*', { count: 'exact', head: true })),
            festQuery(supabaseClient.from('competitions').select('id, name, status, award_type, is_group, max_mark, max_participants, categories(name), stages(name)')),
            window.festosGetSetting ? window.festosGetSetting('master_schedule') : supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle().then(r => r.data?.value),
            festQuery(supabaseClient.from('teams').select('id, name')),
            festQuery(supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark')),
            festQuery(supabaseClient.from('participants').select('id, name, team_id')),
            loadPointSettings()
        ]);
        const schedData = { value: schedDataVal };

        const allComps = allCompsData || [];
        const liveComps = allComps.filter(c => c.status === 'ongoing');
        const publishedComps = allComps.filter(c => c.status === 'published');
        
        document.getElementById('dash-program-count').innerText = compCount || 0;
        document.getElementById('dash-live-count').innerText = liveComps.length || 0;
        document.getElementById('dash-participant-count').innerText = partCount || 0;
        document.getElementById('dash-registered-count').innerText = enrolCount || 0;
        document.getElementById('dash-category-count').innerText = catCount || 0;
        document.getElementById('dash-team-count').innerText = teamCount || 0;
        
        const publishRatio = `${publishedComps.length}/${compCount || 0}`;
        const publishPercent = compCount ? Math.round((publishedComps.length / compCount) * 100) : 0;
        
        document.getElementById('dash-results-ratio').innerText = publishRatio;
        document.getElementById('dash-results-percent').innerText = publishPercent;
        
        document.getElementById('pb-prog-val').innerText = `${enrolCount || 0}/${compCount || 0}`;
        document.getElementById('pb-prog-fill').style.width = compCount ? `${Math.min(100, (enrolCount / compCount) * 100)}%` : '0%';
        
        const completedComps = allComps.filter(c => c.status === 'judgement_complete' || c.status === 'published').length;
        document.getElementById('pb-gen-val').innerText = `${completedComps}/${compCount || 0}`;
        document.getElementById('pb-gen-fill').style.width = compCount ? `${Math.round((completedComps / compCount) * 100)}%` : '0%';
        
        document.getElementById('pb-pub-val').innerText = `${publishedComps.length}/${compCount || 0}`;
        document.getElementById('pb-pub-val-top').innerText = publishedComps.length;
        document.getElementById('pb-pub-fill').style.width = `${publishPercent}%`;

        // Calculate today's schedule
        const masterSchedule = schedData?.value || {};
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        Object.values(masterSchedule).forEach(s => { if(s.date === todayStr) todayCount++; });
        document.getElementById('dash-program-count-today').innerText = todayCount;

        const stageListEl = document.getElementById('dash-live-stage-list');
        document.getElementById('dash-live-stage-count').innerText = liveComps.length;
        document.getElementById('dash-live-stage-count-2').innerText = liveComps.length;
        
        if (liveComps.length > 0) {
            stageListEl.innerHTML = liveComps.map(c => `
                <div class="live-stage-item">
                    <div>
                        <h4>${c.name}</h4>
                        <p><i class="fa-solid fa-microphone-stage" style="color:var(--text-muted);"></i> ${c.stages?.name || 'TBD'} &nbsp;|&nbsp; <i class="fa-solid fa-folder" style="color:var(--text-muted);"></i> ${c.categories?.name || 'Gen'}</p>
                    </div>
                    <span class="live-badge-sm">Live</span>
                </div>
            `).join('');
        } else {
            stageListEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">No events running currently.</p>`;
        }

        const teams = teamsData || [];
        const judgements = judgementsData || [];
        const participants = participantsData || [];
        
        const pMap = {};
        (participants || []).forEach(p => pMap[p.id] = p);
        
        let compAverages = {}; 
        (judgements || []).forEach(j => {
           if(!compAverages[j.competition_id]) compAverages[j.competition_id] = {};
           if(!compAverages[j.competition_id][j.participant_id]) compAverages[j.competition_id][j.participant_id] = { marks_array: [] };
           compAverages[j.competition_id][j.participant_id].marks_array.push(parseFloat(j.awarded_mark));
        });

        let teamScores = {};
        let partScores = {};
        (teams || []).forEach(t => teamScores[t.id] = { name: t.name, score: 0 });
        (participants || []).forEach(p => partScores[p.id] = { name: p.name, score: 0, star: 0, pen: 0 });

        allComps.forEach(comp => {
            if(!compAverages[comp.id]) return;
            const participantsArr = Object.entries(compAverages[comp.id]).map(([pId, data]) => {
                let sortedMarks = data.marks_array.sort((a, b) => a - b);
                if (sortedMarks.length >= 3) sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
                const sum = sortedMarks.reduce((a, b) => a + b, 0);
                return { id: pId, mark: sum / sortedMarks.length };
            }).sort((a, b) => b.mark - a.mark);

            // CRITICAL FIX: Dynamically determine the size category just like the Points Ledger
            const limit = comp.max_participants || 1;
            const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            let currentRank = 1;
            let previousScore = -1;

            participantsArr.forEach((p, index) => {
                if (p.mark !== previousScore) currentRank = index + 1;
                previousScore = p.mark;

                // CRITICAL FIX: Calculate percent based on the competition's specific max_mark
                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let gradePts = 0; let posPts = 0;

                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].aplus) || 0;
                    else if (percent >= pointsAdminSettings.thresholds.a) gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].a) || 0;
                    else if (percent >= pointsAdminSettings.thresholds.b) gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].b) || 0;
                    else gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].c) || 0;
                }
                
                if (currentRank <= 3) {
                    if (currentRank === 1) posPts = Number(pointsAdminSettings.pos_points.p1) || 0;
                    else if (currentRank === 2) posPts = Number(pointsAdminSettings.pos_points.p2) || 0;
                    else if (currentRank === 3) posPts = Number(pointsAdminSettings.pos_points.p3) || 0;
                }
                
                const totalPts = gradePts + posPts;
                const tId = pMap[p.id] ? pMap[p.id].team_id : null;
                
                // Teams ALWAYS get points for both individual and group events
                if (tId && teamScores[tId]) teamScores[tId].score += totalPts;
                
                // CRITICAL FIX: Ignore group events when calculating individual scores
                if (!comp.is_group) {
                    if (partScores[p.id]) {
                        partScores[p.id].score += totalPts;
                        if (comp.award_type === 'star') partScores[p.id].star += totalPts;
                        if (comp.award_type === 'pen') partScores[p.id].pen += totalPts;
                    }
                }
            });
        });

        const sortedTeams = Object.values(teamScores).sort((a, b) => b.score - a.score);

        if (sortedTeams.length > 0) {
            document.getElementById('dash-top-team-name').innerText = sortedTeams[0].name;
            document.getElementById('dash-top-team-pts').innerText = `${sortedTeams[0].score}`;
        }

        window.globalDashCandidates = Object.values(partScores);
        
        if (typeof window.switchDashTopView === 'function') {
            window.switchDashTopView('all');
        }

        renderDashCharts(sortedTeams);
    } catch (error) { console.error("Dashboard Load Error:", error); }
}

// TOGGLE LOGIC FOR DASHBOARD TOP CANDIDATES
window.switchDashTopView = function(type) {
    // 1. Reset all buttons
    document.getElementById('btn-dash-top-all').className = 'btn btn-outline';
    document.getElementById('btn-dash-top-star').className = 'btn btn-outline';
    document.getElementById('btn-dash-top-pen').className = 'btn btn-outline';
    
    document.getElementById('btn-dash-top-star').style.background = 'transparent';
    document.getElementById('btn-dash-top-star').style.color = '#D97706';
    document.getElementById('btn-dash-top-pen').style.background = 'transparent';
    document.getElementById('btn-dash-top-pen').style.color = '#4338CA';

    let sortKey = 'score';
    let ptsColor = 'var(--primary)';
    
    // 2. Apply active styling and set parameters
    if (type === 'all') {
        document.getElementById('btn-dash-top-all').className = 'btn btn-primary';
        document.getElementById('dash-top-pts-label').innerText = 'TOTAL POINTS';
    } else if (type === 'star') {
        const btn = document.getElementById('btn-dash-top-star');
        btn.className = 'btn'; btn.style.background = '#D97706'; btn.style.color = 'white';
        sortKey = 'star';
        ptsColor = '#D97706';
        document.getElementById('dash-top-pts-label').innerText = 'STAR POINTS';
    } else if (type === 'pen') {
        const btn = document.getElementById('btn-dash-top-pen');
        btn.className = 'btn'; btn.style.background = '#4338CA'; btn.style.color = 'white';
        sortKey = 'pen';
        ptsColor = '#4338CA';
        document.getElementById('dash-top-pts-label').innerText = 'PEN POINTS';
    }

    if (!window.globalDashCandidates) return;
    
    // 3. Filter (greater than 0), Sort, and grab top 5
    let sortedParts = window.globalDashCandidates
        .filter(c => c[sortKey] > 0)
        .sort((a, b) => b[sortKey] - a[sortKey])
        .slice(0, 5);

    const candListEl = document.getElementById('dash-top-candidates');
    if (sortedParts.length > 0) {
        candListEl.innerHTML = sortedParts.map((c, i) => {
            let rClass = i===0 ? 'r1' : i===1 ? 'r2' : i===2 ? 'r3' : 'other';
            return `
            <div class="top-cand-row">
                <div style="display: flex; align-items: center;">
                    <div class="cand-rank ${rClass}">${i+1}</div>
                    <span style="font-weight: 600; font-size: 0.9rem; text-transform: uppercase;">${c.name}</span>
                </div>
                <span style="font-weight: 800; color: ${ptsColor}; font-size: 1.05rem;">${c[sortKey]}</span>
            </div>
        `}).join('');
    } else {
        const typeName = type === 'all' ? 'total' : type;
        candListEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem 1rem;">No ${typeName} points awarded yet.</p>`;
    }
};

function renderDashCharts(sortedTeams) {
    if (dashRegChart) dashRegChart.destroy();
    if (dashTeamChart) dashTeamChart.destroy();

    // Line Chart
    const ctxLine = document.getElementById('regDynamicChart').getContext('2d');
    dashRegChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                { label: 'Registrations', data: [120, 150, 180, 90, 30, 10, 5], borderColor: '#EF4444', backgroundColor: 'transparent', fill: false, tension: 0.4 },
                { label: 'Results', data: [0, 0, 10, 40, 100, 150, 200], borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Bar chart for Team Points
    const ctxBar = document.getElementById('teamPointsChart').getContext('2d');
    const teamLabels = sortedTeams.slice(0, 8).map(t => t.name.toUpperCase());
    const teamData = sortedTeams.slice(0, 8).map(t => t.score);
    const barColors = ['#EF4444', '#FCD34D', '#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#14B8A6', '#F43F5E'];

    dashTeamChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: teamLabels,
            datasets: [{
                data: teamData,
                backgroundColor: barColors,
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                x: { grid: { display: false } }
            }
        }
    });
}


// Custom Logout Logic
function logout() { document.getElementById('logoutModal').classList.add('show'); }

function confirmLogout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// --- MODAL UTILS ---
function closeModal() { 
    const modal = document.getElementById('formModal');
    if(modal) modal.classList.remove('show'); 
}

function openModal(title, bodyHTML, saveFunction) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    
    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.onclick = saveFunction;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    saveBtn.disabled = false;
    
    document.getElementById('formModal').classList.add('show');
}


// Function to handle viewing counts in a popup
async function viewRelationalData(fetchTable, filterColumn, filterId, displayColumn = 'name') {
    document.getElementById('listModalTable').parentElement.style.cssText = "max-height: 300px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm);";
    try {
        // Fetch the related data based on the ID clicked
        const { data, error } = await supabaseClient
            .from(fetchTable)
            .select('*')
            .eq(filterColumn, filterId);
            
        if (error) throw error;
        
        const tbody = document.getElementById('listModalTable');
        tbody.innerHTML = `<tr><th>${displayColumn.toUpperCase()}</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td style="color: var(--text-muted);">No records found.</td></tr>`;
        } else {
            data.forEach(item => {
                // Safely grab the requested column (name, username, unique_id, etc.)
                const displayText = item[displayColumn] || item.username || item.unique_id || 'Unknown';
                tbody.innerHTML += `<tr><td>${displayText}</td></tr>`;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Viewing ${fetchTable}`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast("Error loading data: " + e.message, 'error'); 
    }
}



function openCategoryModal(editData = null) {
    const isEdit = !!editData;
    const catId = isEdit ? editData.id : '';
    const catName = isEdit ? editData.name : '';
    const isGeneral = isEdit ? editData.is_general.toString() : 'false';
    const allowedGenerals = isEdit && editData.allowed_general_categories ? editData.allowed_general_categories : [];
    const allowedClasses = isEdit && editData.eligible_classes ? (Array.isArray(editData.eligible_classes) ? editData.eligible_classes : []) : [];
    
    // Capture the DOB period
    const catDobStart = isEdit && editData.dob_start ? editData.dob_start : '';
    const catDobEnd = isEdit && editData.dob_end ? editData.dob_end : ''; 

    let generalCats = categoriesList.filter(c => c.is_general && c.id !== catId);
    let generalOptsHtml = '';
    
    if (generalCats.length > 0) {
        generalOptsHtml = `
            <div class="form-group" id="general-eligibility-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border); ${isGeneral === 'true' ? 'display:none;' : 'display:block;'}">
                <label style="margin-bottom: 0.5rem; display: block; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">Eligible General Categories</label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">Select which general categories students from this standard category are allowed to participate in.</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding-right: 0.5rem;">
                    ${generalCats.map(gc => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
                            <input type="checkbox" class="cat-general-eligibility" value="${gc.id}" ${allowedGenerals.includes(gc.id) ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary);">
                            ${gc.name}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    let classEligibilityHtml = '';
    const classSystemActive = !!(window.currentClassSystem?.enabled && window.currentClassSystem.classes?.length > 0);
    if (classSystemActive) {
        classEligibilityHtml = `
            <div class="form-group" id="class-eligibility-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border); ${isGeneral === 'true' ? 'display:none;' : 'display:block;'}">
                <label style="margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
                    <span><i class="fa-solid fa-graduation-cap" style="color: var(--primary); margin-right: 4px;"></i> Eligible Classes / Grades</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Multi-select allowed classes</span>
                </label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">Check classes that belong to this category. Multiple categories can also share classes if needed.</p>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding: 0.75rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px;">
                    ${window.currentClassSystem.classes.map(cls => `
                        <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; background: white; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); user-select: none;">
                            <input type="checkbox" class="cat-class-eligibility" value="${cls}" ${allowedClasses.includes(cls) ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: var(--primary);">
                            ${cls}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    openModal(isEdit ? 'Edit Category' : 'Create Category', `
        <input type="hidden" id="catId" value="${catId}">
        <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="catName" value="${catName}" placeholder="E.G. SENIOR SECONDARY">
        </div>
        <div class="form-group">
            <label>Type</label>
            <select id="catGeneral" onchange="const el = document.getElementById('general-eligibility-section'); if(el) el.style.display = this.value === 'true' ? 'none' : 'block'; const cl = document.getElementById('class-eligibility-section'); if(cl) cl.style.display = this.value === 'true' ? 'none' : 'block';">
                <option value="false" ${isGeneral === 'false' ? 'selected' : ''}>Standard (Limits apply)</option>
                <option value="true" ${isGeneral === 'true' ? 'selected' : ''}>General (Anyone can participate)</option>
            </select>
        </div>
        <div class="form-group" style="padding-top: 0.5rem;">
            <label>Allowed Date of Birth Period (Optional)</label>
            <div class="cat-dob-range-row" style="display: flex; gap: 0.75rem; align-items: center;">
                <input type="date" id="catDobStart" value="${catDobStart}" style="flex: 1; min-width: 0; text-transform: none;">
                <span style="color: var(--text-muted); font-weight: 800; font-size: 0.8rem; text-align: center;">TO</span>
                <input type="date" id="catDobEnd" value="${catDobEnd}" style="flex: 1; min-width: 0; text-transform: none;">
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">If set, participants must be born between these dates to register.</p>
        </div>
        ${generalOptsHtml}
        ${classEligibilityHtml}
        <div class="form-group" id="category-student-limit-section" style="margin-top: 1rem; padding: 1rem; border-radius: 8px; background: var(--bg-main); border: 1px solid var(--border); ${isGeneral === 'true' ? 'display:none;' : 'display:block;'}">
            <label style="margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
                <span><i class="fa-solid fa-gauge-high" style="color: var(--primary); margin-right: 4px;"></i> Limit / Student in this Category</span>
            </label>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                Set a competition participation limit for individual students belonging to this category. (Rules for group events &amp; general competitions can be customized in Point Settings).
            </p>
            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
                    <input type="checkbox" id="catLimitCustomToggle" ${(window.cachedCategoryLimitConfig?.categories?.[catId]?.enabled !== false && window.cachedCategoryLimitConfig?.categories?.[catId]?.limit) ? 'checked' : ''} onchange="document.getElementById('catLimitInputWrap').style.display = this.checked ? 'block' : 'none';" style="width: 16px; height: 16px; accent-color: var(--primary);">
                    <span>Limit student registrations in this category</span>
                </label>
                <div id="catLimitInputWrap" style="${(window.cachedCategoryLimitConfig?.categories?.[catId]?.enabled !== false && window.cachedCategoryLimitConfig?.categories?.[catId]?.limit) ? 'display:block;' : 'display:none;'}">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <input type="number" id="catLimitVal" min="1" max="50" value="${window.cachedCategoryLimitConfig?.categories?.[catId]?.limit || 3}" style="width: 75px; padding: 0.4rem; font-size: 0.85rem; border-radius: 6px; border: 1px solid var(--border); text-align: center; font-weight:700;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Comps / Student</span>
                    </div>
                </div>
            </div>
        </div>
    `, saveCategory);
}

async function saveCategory() {
    const id = document.getElementById('catId').value;
    const name = document.getElementById('catName').value;
    const is_general = document.getElementById('catGeneral').value === 'true';
    const dob_start = document.getElementById('catDobStart').value || null;
    const dob_end = document.getElementById('catDobEnd').value || null;
    
    const allowed_general_categories = Array.from(document.querySelectorAll('.cat-general-eligibility:checked')).map(cb => cb.value);
    const eligible_classes = Array.from(document.querySelectorAll('.cat-class-eligibility:checked')).map(cb => cb.value);

    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { 
            name, 
            is_general, 
            dob_start,
            dob_end,
            allowed_general_categories: is_general ? [] : allowed_general_categories,
            eligible_classes: is_general ? [] : eligible_classes
        };
        if (id) payload.id = id;

        let { data, error } = await supabaseClient.from('categories').upsert([festPayload(payload)]).select();
        let targetCatId = id;
        if (error && error.message && error.message.includes('eligible_classes')) {
            delete payload.eligible_classes;
            const retry = await supabaseClient.from('categories').upsert([festPayload(payload)]).select();
            if (retry.error) throw retry.error;
            targetCatId = id || retry.data?.[0]?.id;
            if (targetCatId) await saveCategoryClassesMapping(targetCatId, eligible_classes);
        } else if (error) {
            throw error;
        } else {
            targetCatId = id || data?.[0]?.id;
            if (targetCatId) await saveCategoryClassesMapping(targetCatId, eligible_classes);
        }
        
        // Save category limit rule
        try {
            const isLimited = document.getElementById('catLimitCustomToggle')?.checked;
            const limitVal = parseInt(document.getElementById('catLimitVal')?.value) || 3;
            const limConfig = await festosGetAdminCategoryLimitConfig();
            if (!limConfig.categories) limConfig.categories = {};
            if (targetCatId) {
                if (isLimited && !is_general) {
                    limConfig.categories[targetCatId] = {
                        enabled: true,
                        custom: true,
                        limit: limitVal
                    };
                } else {
                    delete limConfig.categories[targetCatId];
                }
                await festosSaveAdminCategoryLimitConfig(limConfig);
                window.cachedCategoryLimitConfig = limConfig;
            }
        } catch(limErr) {
            console.warn('Error saving category limit in saveCategory:', limErr);
        }

        showToast(id ? 'Category updated!' : 'Category created!');
        closeModal(); 
        loadCategories();
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}



// --- NEW: Missing Categories Filter Function ---
function filterCategoriesTable() {
    const searchVal = document.querySelector('#categories .search-box input').value.toLowerCase();
    const typeVal = document.querySelector('#categories .filter-box select').value;
    const rows = document.querySelectorAll('#categories-tbody tr');

    rows.forEach(row => {
        const name = row.cells[1].innerText.toLowerCase();
        const typeBadge = row.cells[2].innerText; // Extracts "General" or "Standard"

        const matchSearch = name.includes(searchVal);
        const matchType = typeVal === "" || typeBadge === typeVal;

        row.style.display = (matchSearch && matchType) ? '' : 'none';
    });
}
// --- COMPETITIONS MANAGEMENT (PAGINATED) ---
let compCurrentPage = 1;
let compRowsPerPage = 10;
let filteredCompetitionsList = []; 

async function loadCompetitions() {
    try {
        const prereqs = [];
        if (stagesList.length === 0) prereqs.push(festQuery(supabaseClient.from('stages').select('*')).then(r => { stagesList = r.data || []; }));
        if (categoriesList.length === 0) prereqs.push(loadCategories());
        if (teamsList.length === 0) prereqs.push(festQuery(supabaseClient.from('teams').select('*')).then(r => { teamsList = r.data || []; }));
        if (prereqs.length > 0) await Promise.all(prereqs);

        const { data, error } = await festQuery(supabaseClient
            .from('competitions')
            .select(`*, categories(id, name, is_general, allowed_general_categories), stages(name), participant_competitions(count)`))
            .order('name');
            
        if(error) throw error;
        
        competitionsList = data || [];
        
        const filterCat = document.getElementById('filterCompCategory');
        if(filterCat && filterCat.options.length === 1) {
            categoriesList.forEach(c => filterCat.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // Populate new Stage Filter
        const filterStage = document.getElementById('filterCompStage');
        if(filterStage && filterStage.options.length === 1) {
            stagesList.forEach(s => filterStage.innerHTML += `<option value="${s.name}">${s.name}</option>`);
        }

        if (typeof populateBulkStageSelect === 'function') {
            populateBulkStageSelect();
        }

        if (window.compCurrentViewMode === 'sheet') {
            initCompetitionsSheet();
        } else {
            filterCompetitions(false);
        } 
    } catch(e) { showToast(e.message, 'error'); }
}

function filterCompetitions(resetPage = true) {
    const query = document.getElementById('searchCompInput').value.toLowerCase();
    const catFilter = document.getElementById('filterCompCategory').value;
    const stageFilter = document.getElementById('filterCompStage') ? document.getElementById('filterCompStage').value : "";
    
    filteredCompetitionsList = competitionsList.filter(comp => {
        const matchName = comp.name.toLowerCase().includes(query);
        const compCatName = comp.categories?.name || '';
        const matchCat = catFilter === "" || compCatName === catFilter;
        
        const compStageName = comp.stages?.name || '';
        const matchStage = stageFilter === "" || compStageName === stageFilter;
        
        return matchName && matchCat && matchStage;
    });
    
    if (resetPage) compCurrentPage = 1;
    renderCompetitionsTable();
}

function renderCompetitionsTable() {
    const tbody = document.getElementById('competitions-tbody');
    tbody.innerHTML = '';
    
    // Calculate page slices
    const start = (compCurrentPage - 1) * compRowsPerPage;
    const end = start + compRowsPerPage;
    const pageData = filteredCompetitionsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No competitions found.</td></tr>`;
    }

   pageData.forEach(comp => {
        const studentCount = comp.participant_competitions?.[0]?.count || 0; 
        const totalCapacity = (comp.max_participants || 0) * (teamsList.length || 0); 
        
        // NEW: Check if it's an offstage event
let stageDisplay = comp.stages?.name || 'Unassigned';
        if (comp.is_offstage) {
            stageDisplay += ` <br><span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; margin-top: 4px; display: inline-block; font-size: 0.65rem;"><i class="fa-solid fa-pen-nib"></i> OFFSTAGE</span>`;
        }    
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${comp.id}" ${globalSelections['competitions-tbody']?.has(comp.id) ? 'checked' : ''} onchange="handleRowSelection('competitions-tbody', this.value, this.checked)"></td>
                <td style="font-weight: 700;">${comp.name}</td>
                <td><span class="badge badge-primary">${comp.categories?.name || 'N/A'}</span></td>
                <td>${stageDisplay}</td>
                
                <td style="font-weight: 700; color: var(--text-main);">${comp.max_mark || '0'}</td>
                
                <td>
                    <span class="badge-count" onclick="viewCompParticipants('${comp.id}')" title="Click to view enrolled">
                        ${studentCount} / ${totalCapacity} Total
                    </span>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">(${comp.max_participants} PER TEAM)</div>
                </td>
               <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openCompModal(${JSON.stringify(comp).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})' title="Edit"><i class="fa-solid fa-pen"></i></button>
                        
                        
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--primary); border-color:var(--primary);" onclick="viewCompetitionLog('${comp.id}')" title="View Master Log"><i class="fa-solid fa-file-invoice"></i></button>
                        
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="bulkDownloadCertificates('${comp.id}')" title="Download Merit Certificates"><i class="fa-solid fa-award"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteCompetition('${comp.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    renderCompPagination();
}

function renderCompPagination() {
    const totalPages = Math.ceil(filteredCompetitionsList.length / compRowsPerPage) || 1;
    const paginationContainer = document.getElementById('comp-pagination');
    
    const startNum = filteredCompetitionsList.length === 0 ? 0 : ((compCurrentPage - 1) * compRowsPerPage) + 1;
    const endNum = Math.min(compCurrentPage * compRowsPerPage, filteredCompetitionsList.length);

    // Ensure the Select All box is unchecked visually when pages change
    const masterCb = document.querySelector('#competitions-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredCompetitionsList.length} entries
            <select onchange="compRowsPerPage = parseInt(this.value); compCurrentPage = 1; renderCompetitionsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${compRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${compRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${compRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${compRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changeCompPage(-1)" ${compCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: flex; align-items: center; padding: 0 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--primary);">Page ${compCurrentPage} of ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changeCompPage(1)" ${compCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

function changeCompPage(direction) {
    const totalPages = Math.ceil(filteredCompetitionsList.length / compRowsPerPage);
    compCurrentPage += direction;
    if (compCurrentPage < 1) compCurrentPage = 1;
    if (compCurrentPage > totalPages) compCurrentPage = totalPages;
    renderCompetitionsTable();
}

// ==========================================
// BULK EDIT STAGE FOR COMPETITIONS
// ==========================================
function populateBulkStageSelect() {
    const select = document.getElementById('bulkStageSelect');
    if (!select) return;
    const curVal = select.value;
    select.innerHTML = '<option value="">-- SELECT STAGE --</option>';
    (stagesList || []).forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
    select.innerHTML += '<option value="__unassigned__">-- UNASSIGN STAGE --</option>';
    if (curVal) select.value = curVal;
}
window.populateBulkStageSelect = populateBulkStageSelect;

async function bulkAssignStage() {
    const compIds = getSelectedIds('competitions-tbody');
    if (!compIds || compIds.length === 0) {
        return showToast('Please select at least one competition using the checkboxes.', 'error');
    }
    
    const stageSelect = document.getElementById('bulkStageSelect');
    const stageVal = stageSelect ? stageSelect.value : '';
    
    if (!stageVal) {
        return openBulkEditStageModal(compIds);
    }
    
    await executeBulkStageUpdate(compIds, stageVal);
}
window.bulkAssignStage = bulkAssignStage;

function openBulkEditStageModal(compIds) {
    if (!compIds || compIds.length === 0) {
        compIds = getSelectedIds('competitions-tbody');
    }
    if (!compIds || compIds.length === 0) {
        return showToast('Please select at least one competition using the checkboxes.', 'error');
    }
    
    // Only show the added stages from stagesList
    let stageOpts = (stagesList || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const noStages = !stagesList || stagesList.length === 0;
    
    openModal('Bulk Edit Stage for Competitions', `
        <div style="margin-bottom: 1.25rem; padding: 1rem; background: var(--primary-light); border-radius: var(--radius-md); color: var(--primary); font-weight: 700; font-size: 0.9rem;">
            <i class="fa-solid fa-layer-group"></i> Assigning stage to ${compIds.length} selected competition(s).
        </div>
        
        <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="font-weight: 700; margin-bottom: 0.35rem; display: block;">Select Stage</label>
            <select id="modalBulkStageSelect" style="width: 100%; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 0.95rem; background: var(--bg-surface);">
                <option value="">-- SELECT STAGE --</option>
                ${stageOpts}
                <option value="__unassigned__">-- REMOVE / UNASSIGN STAGE --</option>
            </select>
            ${noStages ? `<div style="font-size: 0.75rem; color: #DC2626; margin-top: 5px;"><i class="fa-solid fa-triangle-exclamation"></i> No stages added yet. Add stages under the Stages tab first.</div>` : ''}
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="font-weight: 700; margin-bottom: 0.35rem; display: block;">Event Type Action</label>
            <select id="modalBulkTypeAction" style="width: 100%; padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 0.95rem; background: var(--bg-surface);">
                <option value="keep" selected>Keep Current Type (Offstage stays Offstage, Stage stays Stage)</option>
                <option value="to_stage">Convert to STAGE Event (On-stage)</option>
                <option value="to_offstage">Convert to OFFSTAGE Event</option>
            </select>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                Selecting a stage preserves whether each event is Offstage or Stage unless you choose to convert above.
            </div>
        </div>
    `, async () => {
        const stageVal = document.getElementById('modalBulkStageSelect')?.value;
        const typeAction = document.getElementById('modalBulkTypeAction')?.value || 'keep';
        
        if (!stageVal && typeAction === 'keep') {
            return showToast('Please select a stage or choose an event type action.', 'error');
        }
        
        await executeBulkStageUpdate(compIds, stageVal, typeAction);
        closeModal();
    });
}
window.openBulkEditStageModal = openBulkEditStageModal;

async function executeBulkStageUpdate(compIds, stageVal, typeAction = 'keep') {
    setLoading('modalSaveBtn', true);
    try {
        let updateData = {};
        if (stageVal === '__unassigned__') {
            updateData.stage_id = null;
        } else if (stageVal) {
            updateData.stage_id = stageVal;
        }
        
        // Only modify is_offstage if explicitly requested
        if (typeAction === 'to_offstage') {
            updateData.is_offstage = true;
        } else if (typeAction === 'to_stage') {
            updateData.is_offstage = false;
        }
        
        if (Object.keys(updateData).length === 0) {
            return showToast('No changes to apply.', 'warning');
        }
        
        const { error } = await supabaseClient
            .from('competitions')
            .update(updateData)
            .in('id', compIds);
            
        if (error) throw error;
        
        showToast(`Successfully updated ${compIds.length} competition(s)!`);
        clearSelection('competitions-tbody');
        if (document.getElementById('bulkStageSelect')) {
            document.getElementById('bulkStageSelect').value = '';
        }
        await loadCompetitions();
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('modalSaveBtn', false);
    }
}
window.executeBulkStageUpdate = executeBulkStageUpdate;

// Dedicated Modal to Convert Event Type (Stage <-> Offstage)
function openBulkConvertTypeModal(compIds) {
    if (!compIds || compIds.length === 0) {
        compIds = getSelectedIds('competitions-tbody');
    }
    if (!compIds || compIds.length === 0) {
        return showToast('Please select at least one competition using the checkboxes.', 'error');
    }

    const selectedComps = (competitionsList || []).filter(c => compIds.includes(String(c.id)));
    const stageEventCount = selectedComps.filter(c => !c.is_offstage).length;
    const offstageEventCount = selectedComps.filter(c => c.is_offstage).length;

    // Smart default: if currently stage events, suggest converting to offstage, and vice versa
    const defaultMode = (stageEventCount > 0 && offstageEventCount === 0) ? 'offstage' : 'stage';

    openModal('Convert Event Type (Stage / Offstage)', `
        <div style="margin-bottom: 1.25rem; padding: 1rem; background: var(--primary-light); border-radius: var(--radius-md); color: var(--primary); font-size: 0.85rem; line-height: 1.5;">
            <div style="font-weight: 800; margin-bottom: 0.25rem; font-size: 0.95rem;">
                <i class="fa-solid fa-arrows-rotate"></i> Bulk Convert Event Type
            </div>
            Switch ${compIds.length} selected competition(s) between <strong>Stage (On-stage)</strong> and <strong>Offstage</strong> mode.
            <div style="margin-top: 0.5rem; display: flex; gap: 0.75rem; font-size: 0.8rem; flex-wrap: wrap;">
                <span class="badge" style="background: #E0E7FF; color: #4338CA; font-weight: 700; padding: 0.35rem 0.65rem;">🎭 ${stageEventCount} Stage Event(s)</span>
                <span class="badge" style="background: #FEF3C7; color: #D97706; font-weight: 700; padding: 0.35rem 0.65rem;">📝 ${offstageEventCount} Offstage Event(s)</span>
            </div>
        </div>

        <div style="margin-bottom: 0.5rem;">
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <!-- 1. Convert to Offstage -->
                <label id="cardModeOffstage" onclick="selectBulkConvertMode('offstage')" style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.15rem; border: 2px solid ${defaultMode === 'offstage' ? '#D97706' : 'var(--border)'}; border-radius: var(--radius-lg); cursor: pointer; background: ${defaultMode === 'offstage' ? '#FEF3C7' : 'var(--bg-surface)'}; transition: all 0.2s ease;">
                    <input type="radio" name="bulkTargetType" value="offstage" ${defaultMode === 'offstage' ? 'checked' : ''} style="width: 20px !important; min-width: 20px !important; height: 20px !important; margin: 0 !important; cursor: pointer; flex: none; accent-color: #D97706;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: #D97706; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                        <i class="fa-solid fa-pen-nib"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 800; font-size: 0.95rem; color: #78350F;">Convert to OFFSTAGE Event</div>
                        <div style="font-size: 0.75rem; color: #92400E; margin-top: 3px;">Events occur simultaneously (e.g. essay writing, drawing, tests).</div>
                    </div>
                </label>

                <!-- 2. Convert to Stage -->
                <label id="cardModeStage" onclick="selectBulkConvertMode('stage')" style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.15rem; border: 2px solid ${defaultMode === 'stage' ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius-lg); cursor: pointer; background: ${defaultMode === 'stage' ? 'var(--primary-light)' : 'var(--bg-surface)'}; transition: all 0.2s ease;">
                    <input type="radio" name="bulkTargetType" value="stage" ${defaultMode === 'stage' ? 'checked' : ''} style="width: 20px !important; min-width: 20px !important; height: 20px !important; margin: 0 !important; cursor: pointer; flex: none; accent-color: var(--primary);">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                        <i class="fa-solid fa-masks-theater"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">Convert to STAGE Event (On-stage)</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">Live on-stage presentations with duration scaled per participant.</div>
                    </div>
                </label>
            </div>
        </div>
    `, async () => {
        const mode = document.querySelector('input[name="bulkTargetType"]:checked')?.value || 'offstage';
        await executeBulkConvertEventType(compIds, mode);
        closeModal();
    });

    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) {
        saveBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Convert to ${defaultMode === 'offstage' ? 'Offstage' : 'Stage'}`;
        saveBtn.style.background = defaultMode === 'offstage' ? '#D97706' : 'var(--primary)';
        saveBtn.style.borderColor = defaultMode === 'offstage' ? '#B45309' : 'var(--primary)';
    }
}
window.openBulkConvertTypeModal = openBulkConvertTypeModal;

window.selectBulkConvertMode = function(mode) {
    const stageCard = document.getElementById('cardModeStage');
    const offstageCard = document.getElementById('cardModeOffstage');
    const stageRadio = document.querySelector('input[name="bulkTargetType"][value="stage"]');
    const offstageRadio = document.querySelector('input[name="bulkTargetType"][value="offstage"]');
    const saveBtn = document.getElementById('modalSaveBtn');

    if (mode === 'stage') {
        if (stageRadio) stageRadio.checked = true;
        if (stageCard) {
            stageCard.style.borderColor = 'var(--primary)';
            stageCard.style.background = 'var(--primary-light)';
        }
        if (offstageCard) {
            offstageCard.style.borderColor = 'var(--border)';
            offstageCard.style.background = 'var(--bg-surface)';
        }
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-masks-theater"></i> Convert to Stage Event';
            saveBtn.style.background = 'var(--primary)';
            saveBtn.style.borderColor = 'var(--primary)';
        }
    } else {
        if (offstageRadio) offstageRadio.checked = true;
        if (offstageCard) {
            offstageCard.style.borderColor = '#D97706';
            offstageCard.style.background = '#FEF3C7';
        }
        if (stageCard) {
            stageCard.style.borderColor = 'var(--border)';
            stageCard.style.background = 'var(--bg-surface)';
        }
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> Convert to Offstage Event';
            saveBtn.style.background = '#D97706';
            saveBtn.style.borderColor = '#B45309';
        }
    }
};

async function executeBulkConvertEventType(compIds, mode) {
    setLoading('modalSaveBtn', true);
    try {
        const isOffstage = (mode === 'offstage');
        const { error } = await supabaseClient
            .from('competitions')
            .update({ is_offstage: isOffstage })
            .in('id', compIds);

        if (error) throw error;
        showToast(`Successfully converted ${compIds.length} competition(s) to ${isOffstage ? 'Offstage' : 'Stage'} events!`);

        clearSelection('competitions-tbody');
        await loadCompetitions();
    } catch (e) {
        showToast('Convert failed: ' + e.message, 'error');
    } finally {
        setLoading('modalSaveBtn', false);
    }
}
window.executeBulkConvertEventType = executeBulkConvertEventType;

// =========================================================================
// COMPETITIONS SPREADSHEET SHEET VIEW (DESKTOP)
// =========================================================================
window.compCurrentViewMode = 'table';
window.compSheetData = {};
window.compSheetDirtyIds = new Set();

function escapeSheetHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function switchCompetitionsView(mode) {
    if (mode === window.compCurrentViewMode) return;

    if (mode === 'table' && window.compSheetDirtyIds && window.compSheetDirtyIds.size > 0) {
        openConfirmModal(
            'Unsaved Sheet Changes',
            `You have <strong>${window.compSheetDirtyIds.size} unsaved change(s)</strong> in Sheet View.<br>Switching to Table View will discard these unsaved edits.<br><br>Do you want to discard them and continue?`,
            () => {
                window.compSheetDirtyIds.clear();
                executeSwitchCompetitionsView(mode);
            },
            {
                confirmText: 'Discard & Switch',
                cancelText: 'Stay in Sheet',
                confirmBtnClass: 'btn-warning',
                icon: 'fa-solid fa-arrow-right-from-bracket',
                iconColor: '#D97706',
                iconBg: '#FEF3C7'
            }
        );
        return;
    }

    executeSwitchCompetitionsView(mode);
}

function executeSwitchCompetitionsView(mode) {
    window.compCurrentViewMode = mode;
    const standardView = document.getElementById('comp-standard-view');
    const sheetView = document.getElementById('comp-sheet-view');
    const btnTable = document.getElementById('btnCompViewTable');
    const btnSheet = document.getElementById('btnCompViewSheet');

    if (mode === 'sheet') {
        if (standardView) standardView.style.display = 'none';
        if (sheetView) sheetView.style.display = 'block';

        if (btnSheet) {
            btnSheet.style.background = 'white';
            btnSheet.style.color = 'var(--text-main)';
            btnSheet.style.boxShadow = 'var(--shadow-sm)';
        }
        if (btnTable) {
            btnTable.style.background = 'transparent';
            btnTable.style.color = 'var(--text-muted)';
            btnTable.style.boxShadow = 'none';
        }

        initCompetitionsSheet();
    } else {
        if (sheetView) sheetView.style.display = 'none';
        if (standardView) standardView.style.display = 'block';

        if (btnTable) {
            btnTable.style.background = 'white';
            btnTable.style.color = 'var(--text-main)';
            btnTable.style.boxShadow = 'var(--shadow-sm)';
        }
        if (btnSheet) {
            btnSheet.style.background = 'transparent';
            btnSheet.style.color = 'var(--text-muted)';
            btnSheet.style.boxShadow = 'none';
        }

        renderCompetitionsTable();
    }
}
window.switchCompetitionsView = switchCompetitionsView;

function initCompetitionsSheet() {
    const catFilter = document.getElementById('sheetCategoryFilter');
    if (catFilter) {
        catFilter.innerHTML = '<option value="">All Categories</option>';
        (categoriesList || []).forEach(c => {
            catFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    window.compSheetData = {};
    window.compSheetDirtyIds = new Set();

    (competitionsList || []).forEach(c => {
        window.compSheetData[c.id] = {
            id: c.id,
            name: c.name || '',
            category_id: c.category_id || '',
            stage_id: c.stage_id || '',
            is_offstage: !!c.is_offstage,
            max_mark: c.max_mark ?? 100,
            max_participants: c.max_participants ?? 1,
            time_per_student: c.time_per_student ?? 0,
            is_group: !!c.is_group,
            award_type: c.award_type || 'none',
            isNew: false
        };
    });

    updateCompSheetToolbarStatus();
    renderCompetitionsSheet();
}
window.initCompetitionsSheet = initCompetitionsSheet;

function renderCompetitionsSheet() {
    const tbody = document.getElementById('compSheetTbody');
    if (!tbody) return;

    const searchInput = document.getElementById('sheetSearchInput')?.value?.toLowerCase()?.trim() || '';
    const catFilter = document.getElementById('sheetCategoryFilter')?.value || '';
    const modeFilter = document.getElementById('sheetModeFilter')?.value || '';

    let rows = Object.values(window.compSheetData || {});

    // Live stat totals calculation across all items
    const totalComps = rows.length;
    const stageComps = rows.filter(r => !r.is_offstage).length;
    const offstageComps = rows.filter(r => !!r.is_offstage).length;

    const statTotalEl = document.getElementById('sheetStatTotal');
    const statStageEl = document.getElementById('sheetStatStage');
    const statOffstageEl = document.getElementById('sheetStatOffstage');
    if (statTotalEl) statTotalEl.innerText = `${totalComps} Total`;
    if (statStageEl) statStageEl.innerText = `🎭 ${stageComps} Stage`;
    if (statOffstageEl) statOffstageEl.innerText = `📝 ${offstageComps} Offstage`;

    // Filter by search, category, and mode
    if (searchInput) {
        rows = rows.filter(r => (r.name || '').toLowerCase().includes(searchInput));
    }
    if (catFilter) {
        rows = rows.filter(r => String(r.category_id) === String(catFilter));
    }
    if (modeFilter === 'stage') {
        rows = rows.filter(r => !r.is_offstage);
    } else if (modeFilter === 'offstage') {
        rows = rows.filter(r => !!r.is_offstage);
    }

    rows.sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '');
    });

    const rowCountEl = document.getElementById('sheetRowCount');
    if (rowCountEl) rowCountEl.innerText = rows.length;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-filter" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; opacity: 0.4;"></i>No competitions match the selected filter.</td></tr>`;
        return;
    }

    const catOptionsHtml = (categoriesList || []).map(c => `<option value="${c.id}">${escapeSheetHtml(c.name)}</option>`).join('');
    const stageOptionsHtml = `<option value="">-- No Stage --</option>` + (stagesList || []).map(s => `<option value="${s.id}">${escapeSheetHtml(s.name)}</option>`).join('');

    let html = '';
    rows.forEach((comp, idx) => {
        const isDirty = window.compSheetDirtyIds.has(comp.id);
        const rowClass = isDirty ? 'row-dirty' : '';

        let statusBadge = `<span style="color:#94A3B8; font-size:0.8rem;" title="Synced to database"><i class="fa-solid fa-check"></i></span>`;
        if (isDirty) {
            statusBadge = `<span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; font-size:0.65rem; padding: 2px 6px;">EDITED</span>`;
        }

        html += `
            <tr id="sheet-row-${comp.id}" class="${rowClass}">
                <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-size: 0.75rem;">${idx + 1}</td>
                <td id="sheet-status-${comp.id}" style="text-align: center;">${statusBadge}</td>
                <td>
                    <input type="text" class="sheet-cell-input" value="${escapeSheetHtml(comp.name)}" placeholder="Competition Name" oninput="markCompSheetDirty('${comp.id}', 'name', this.value)">
                </td>
                <td>
                    <select class="sheet-cell-select" onchange="markCompSheetDirty('${comp.id}', 'category_id', this.value)">
                        ${catOptionsHtml.replace(`value="${comp.category_id}"`, `value="${comp.category_id}" selected`)}
                    </select>
                </td>
                <td>
                    <select class="sheet-cell-select" onchange="markCompSheetDirty('${comp.id}', 'stage_id', this.value)">
                        ${comp.stage_id ? stageOptionsHtml.replace(`value="${comp.stage_id}"`, `value="${comp.stage_id}" selected`) : stageOptionsHtml}
                    </select>
                </td>
                <td>
                    <select class="sheet-cell-select" onchange="markCompSheetDirty('${comp.id}', 'is_offstage', this.value === 'offstage')">
                        <option value="stage" ${!comp.is_offstage ? 'selected' : ''}>🎭 Stage</option>
                        <option value="offstage" ${comp.is_offstage ? 'selected' : ''}>📝 Offstage</option>
                    </select>
                </td>
                <td>
                    <input type="number" class="sheet-cell-input" style="text-align: center;" value="${comp.max_mark ?? 100}" min="1" max="1000" oninput="markCompSheetDirty('${comp.id}', 'max_mark', this.value)">
                </td>
                <td>
                    <input type="number" class="sheet-cell-input" style="text-align: center;" value="${comp.max_participants ?? 1}" min="1" max="100" oninput="markCompSheetDirty('${comp.id}', 'max_participants', this.value)">
                </td>
                <td>
                    <input type="number" class="sheet-cell-input" style="text-align: center;" value="${comp.time_per_student ?? 0}" min="0" max="600" oninput="markCompSheetDirty('${comp.id}', 'time_per_student', this.value)">
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="sheet-cell-checkbox" ${comp.is_group ? 'checked' : ''} onchange="markCompSheetDirty('${comp.id}', 'is_group', this.checked)">
                </td>
                <td>
                    <select class="sheet-cell-select" onchange="markCompSheetDirty('${comp.id}', 'award_type', this.value)">
                        <option value="none" ${comp.award_type === 'none' ? 'selected' : ''}>Standard</option>
                        <option value="star" ${comp.award_type === 'star' ? 'selected' : ''}>⭐ Star Fest</option>
                        <option value="pen" ${comp.award_type === 'pen' ? 'selected' : ''}>🖋️ Pen Fest</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-outline" style="padding: 0.3rem 0.55rem; color: #DC2626; border-color: transparent; font-size: 0.85rem; border-radius: 6px;" onclick="deleteCompSheetRow('${comp.id}')" title="Delete competition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}
window.renderCompetitionsSheet = renderCompetitionsSheet;
window.filterCompSheetTable = renderCompetitionsSheet;

function markCompSheetDirty(id, field, value) {
    if (!window.compSheetData[id]) return;
    window.compSheetData[id][field] = value;
    window.compSheetDirtyIds.add(id);

    const row = document.getElementById(`sheet-row-${id}`);
    const statusCell = document.getElementById(`sheet-status-${id}`);
    if (row) {
        row.className = 'row-dirty';
        if (statusCell) statusCell.innerHTML = `<span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; font-size:0.65rem; padding: 2px 6px;">EDITED</span>`;
    }

    updateCompSheetToolbarStatus();
}
window.markCompSheetDirty = markCompSheetDirty;

function updateCompSheetToolbarStatus() {
    const dirtyCount = window.compSheetDirtyIds ? window.compSheetDirtyIds.size : 0;
    const saveBtn = document.getElementById('btnSheetSave');
    const discardBtn = document.getElementById('btnSheetDiscard');
    const badge = document.getElementById('sheetSaveStatusBadge');
    const dirtyCountSpan = document.getElementById('sheetDirtyCount');

    if (dirtyCountSpan) dirtyCountSpan.innerText = dirtyCount;

    if (dirtyCount > 0) {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.add('btn-sheet-save-active');
            saveBtn.style.background = '#059669';
            saveBtn.style.borderColor = '#047857';
        }
        if (discardBtn) discardBtn.style.display = 'inline-flex';
        if (badge) {
            badge.style.background = '#FEF3C7';
            badge.style.color = '#D97706';
            badge.style.borderColor = '#FDE68A';
            badge.innerHTML = `<i class="fa-solid fa-pen"></i> ${dirtyCount} Unsaved Change(s)`;
        }
    } else {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.remove('btn-sheet-save-active');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';
        }
        if (discardBtn) discardBtn.style.display = 'none';
        if (badge) {
            badge.style.background = '#ECFDF5';
            badge.style.color = '#059669';
            badge.style.borderColor = '#A7F3D0';
            badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> All Saved`;
        }
    }
}

function discardCompSheetChanges() {
    if (!window.compSheetDirtyIds || window.compSheetDirtyIds.size === 0) {
        return showToast('No changes to discard.', 'info');
    }
    openConfirmModal(
        'Discard Unsaved Edits?',
        `Are you sure you want to discard all <strong>${window.compSheetDirtyIds.size} unsaved edit(s)</strong> in the sheet?<br><br>The sheet values will be reset back to the saved database state.`,
        () => {
            window.compSheetDirtyIds.clear();
            initCompetitionsSheet();
            showToast('All unsaved changes in sheet discarded.', 'info');
        },
        {
            confirmText: 'Discard All',
            cancelText: 'Keep Editing',
            confirmBtnClass: 'btn-warning',
            icon: 'fa-solid fa-rotate-left',
            iconColor: '#D97706',
            iconBg: '#FEF3C7'
        }
    );
}
window.discardCompSheetChanges = discardCompSheetChanges;

async function saveCompSheetChanges() {
    if (!window.compSheetDirtyIds || window.compSheetDirtyIds.size === 0) {
        return showToast('No changes to save.', 'info');
    }

    const dirtyList = Array.from(window.compSheetDirtyIds);
    const toSave = [];

    for (const id of dirtyList) {
        const row = window.compSheetData[id];
        if (!row) continue;
        const name = String(row.name || '').trim();
        if (!name) {
            return showToast('Every competition must have a name.', 'error');
        }
        if (!row.category_id) {
            return showToast(`Please select a category for "${name}".`, 'error');
        }

        const payload = {
            id: id,
            name: name,
            category_id: row.category_id,
            stage_id: row.stage_id || null,
            max_mark: parseInt(row.max_mark) || 100,
            max_participants: parseInt(row.max_participants) || 1,
            time_per_student: parseInt(row.time_per_student) || 0,
            is_group: !!row.is_group,
            is_offstage: !!row.is_offstage,
            award_type: row.award_type || 'none'
        };

        toSave.push(festPayload(payload));
    }

    const saveBtn = document.getElementById('btnSheetSave');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const { error } = await supabaseClient.from('competitions').upsert(toSave);
        if (error) throw error;

        // 1. Instant Optimistic In-Memory Cache Update
        toSave.forEach(savedItem => {
            const idx = (competitionsList || []).findIndex(c => String(c.id) === String(savedItem.id));
            if (idx !== -1) {
                competitionsList[idx] = { ...competitionsList[idx], ...savedItem };
            }
        });

        // 2. Direct DOM update for instant zero-latency feedback
        dirtyList.forEach(id => {
            const rowEl = document.getElementById(`sheet-row-${id}`);
            const statusCell = document.getElementById(`sheet-status-${id}`);
            if (rowEl) rowEl.className = '';
            if (statusCell) statusCell.innerHTML = `<span style="color:#059669; font-size:0.85rem;"><i class="fa-solid fa-check"></i></span>`;
        });

        window.compSheetDirtyIds.clear();
        updateCompSheetToolbarStatus();

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            saveBtn.style.background = '#059669';
            saveBtn.style.borderColor = '#047857';
        }

        showToast(`Saved ${toSave.length} competition(s) successfully!`, 'success');

        // 3. Non-blocking background sync of full joined relations
        loadCompetitions().catch(err => console.warn('Background sync warning:', err));

        setTimeout(() => {
            if (saveBtn && (!window.compSheetDirtyIds || window.compSheetDirtyIds.size === 0)) {
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes (<span id="sheetDirtyCount">0</span>)';
                updateCompSheetToolbarStatus();
            }
        }, 1500);

    } catch (e) {
        console.error(e);
        showToast('Save failed: ' + e.message, 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            updateCompSheetToolbarStatus();
        }
    }
}
window.saveCompSheetChanges = saveCompSheetChanges;

async function deleteCompSheetRow(id) {
    const comp = window.compSheetData[id] || (competitionsList || []).find(c => String(c.id) === String(id));
    const compName = comp ? comp.name : 'this competition';

    openConfirmModal(
        'Delete Competition?',
        `Are you sure you want to permanently delete <strong>"${escapeSheetHtml(compName)}"</strong>?<br><span style="font-size: 0.82rem; color: #DC2626; margin-top: 0.6rem; display: block;"><i class="fa-solid fa-triangle-exclamation"></i> All participant marks, stage assignments, and schedule entries associated with this competition will also be deleted. This cannot be undone.</span>`,
        async () => {
            try {
                showToast(`Deleting "${compName}"...`, 'info');
                const { error } = await supabaseClient.from('competitions').delete().eq('id', id);
                if (error) throw error;

                delete window.compSheetData[id];
                if (window.compSheetDirtyIds) window.compSheetDirtyIds.delete(id);
                competitionsList = (competitionsList || []).filter(c => String(c.id) !== String(id));

                const rowEl = document.getElementById(`sheet-row-${id}`);
                if (rowEl) rowEl.remove();

                updateCompSheetToolbarStatus();
                renderCompetitionsSheet();
                showToast(`Competition "${compName}" deleted.`, 'success');

                // Background sync
                loadCompetitions().catch(console.warn);
            } catch (e) {
                showToast('Delete failed: ' + e.message, 'error');
            }
        },
        {
            confirmText: 'Yes, Delete',
            cancelText: 'Cancel',
            confirmBtnClass: 'btn-danger',
            icon: 'fa-solid fa-trash-can',
            iconColor: '#DC2626',
            iconBg: '#FEE2E2'
        }
    );
}
window.deleteCompSheetRow = deleteCompSheetRow;

// Desktop Admin Header Data Refresh
async function refreshAdminData(btn) {
    const icon = btn ? btn.querySelector('.refresh-icon') : null;
    if (icon) icon.classList.add('fa-spin');
    if (btn) btn.disabled = true;

    try {
        showToast('Refreshing system data...', 'info');
        const promises = [
            typeof loadCompetitions === 'function' ? loadCompetitions() : Promise.resolve(),
            typeof loadStagesAndTeams === 'function' ? loadStagesAndTeams() : Promise.resolve(),
            typeof loadCategories === 'function' ? loadCategories() : Promise.resolve(),
            typeof loadSchedules === 'function' ? loadSchedules() : Promise.resolve()
        ];
        if (typeof loadDashboardMetrics === 'function') promises.push(loadDashboardMetrics());
        await Promise.all(promises);

        if (window.compCurrentViewMode === 'sheet' && typeof initCompetitionsSheet === 'function') {
            initCompetitionsSheet();
        }
        if (window.schedCurrentViewMode === 'sheet' && typeof initScheduleSheet === 'function') {
            initScheduleSheet();
        }

        showToast('System data refreshed successfully!', 'success');
    } catch (err) {
        console.error('Refresh error:', err);
        showToast('Failed to refresh data: ' + (err.message || err), 'error');
    } finally {
        if (icon) icon.classList.remove('fa-spin');
        if (btn) btn.disabled = false;
    }
}
window.refreshAdminData = refreshAdminData;

// Ctrl+S / Cmd+S Keyboard Shortcut for Sheet Views (Competitions & Schedule)
if (!window._compSheetKeydownBound) {
    window._compSheetKeydownBound = true;
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            if (window.compCurrentViewMode === 'sheet') {
                e.preventDefault();
                if (window.compSheetDirtyIds && window.compSheetDirtyIds.size > 0) {
                    saveCompSheetChanges();
                } else {
                    showToast('All competition sheet changes are already saved.', 'info');
                }
            } else if (window.schedCurrentViewMode === 'sheet') {
                e.preventDefault();
                if (window.schedSheetDirtyIds && window.schedSheetDirtyIds.size > 0) {
                    saveSchedSheetChanges();
                } else {
                    showToast('All schedule sheet changes are already saved.', 'info');
                }
            }
        }
    });
}

// Generates a Premium PDF Directory for Competitions
// Generates a Premium PDF Directory for Competitions
async function exportCompetitionsPDF() {
    showToast('Generating Competitions PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Competitions Directory');

        // Map over the filtered list to respect any current search criteria
        let tableRows = filteredCompetitionsList.map((comp, index) => {
            // Extract the total enrolled participant count
            const studentCount = comp.participant_competitions?.[0]?.count || 0;
            
            return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${comp.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.categories?.name || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.stages?.name || 'Unassigned'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.max_mark || '0'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${studentCount}</td>
            </tr>
            `;
        }).join('');

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">COMPETITION</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">STAGE</th>
                        <th style="padding: 10px;">MAX MARKS</th>
                        <th style="padding: 10px;">ENROLLED</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: typeof getFestFileName === 'function' ? getFestFileName('Competitions', 'pdf') : `Fest_Competitions.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}

// Special function to view participants linked to a competition (Many-to-Many)

async function viewCompParticipants(compId) {
    try {
        // Fetch competition details to know if it's a group event
        const { data: comp } = await supabaseClient.from('competitions').select('is_group').eq('id', compId).single();

        // Fetch participants along with their team details and leader status
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select('is_leader, participant_id, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);
            
        if (error) throw error;
        
        // Reset container styling for tabular modal display
        const container = document.getElementById('listModalTable').parentElement;
        container.style.cssText = "max-height: 350px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm); border-radius: var(--radius-md);";

        const tbody = document.getElementById('listModalTable');
        tbody.innerHTML = `<tr><th style="padding: 1rem;">PARTICIPANT NAME</th><th style="padding: 1rem;">TEAM</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td colspan="2" style="color:var(--text-muted); text-align:center; padding: 2rem;">No students assigned.</td></tr>`;
        } else {
            data.forEach(item => {
                const p = item.participants || participantsList.find(x => String(x.id) === String(item.participant_id));
                const teamName = p?.teams?.name || teamsList.find(t => String(t.id) === String(p?.team_id))?.name || 'INDEPENDENT';
                
                let roleBadge = '';
                if (comp && comp.is_group) {
                    roleBadge = item.is_leader 
                        ? `<br><span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; margin-top: 6px;">GROUP LEADER</span>` 
                        : `<br><span class="badge" style="background: var(--bg-main); color: var(--text-muted); font-size: 0.65rem; margin-top: 6px;">MEMBER</span>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td style="padding: 1rem;">
                            <strong style="font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.2rem;">${p?.name}</strong>
                            <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${p?.unique_id}</span>
                            ${roleBadge}
                        </td>
                        <td style="padding: 1rem; vertical-align: top;">
                            <span class="badge" style="background: var(--bg-main); color: var(--primary); font-weight: 700; border: 1px solid var(--border);">${teamName}</span>
                        </td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Enrolled Students`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast(e.message, 'error'); 
    }
}

function openCompModal(editData = null) {
    const isEdit = !!editData;
    const cId = isEdit ? editData.id : '';
    const cName = isEdit ? editData.name : '';
    const cMarks = isEdit ? editData.max_mark : '100';
    const cLimit = isEdit ? editData.max_participants : '1';
    const cIsGroup = isEdit ? editData.is_group : false; 
    const cTime = isEdit ? editData.time_per_student || 0 : 0;
    const cIsOffstage = isEdit ? editData.is_offstage : false; // NEW: Offstage Flag

    let catOpts = categoriesList.map(c => `<option value="${c.id}" ${isEdit && editData.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    let stageOpts = stagesList.map(s => `<option value="${s.id}" ${isEdit && editData.stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    const cAwardType = isEdit ? editData.award_type || 'none' : 'none';

    openModal(isEdit ? 'Edit Competition' : 'New Competition', `
        <input type="hidden" id="compId" value="${cId}">
        <div class="form-group"><label>Competition Name</label><input type="text" id="compName" value="${cName}"></div>
        
        <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem;">
            <div class="form-group" style="flex: 1; display: flex; align-items: center; gap: 0.5rem; background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); margin: 0;">
                <input type="checkbox" id="compIsGroup" ${cIsGroup ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--primary); cursor: pointer;">
                <label for="compIsGroup" style="margin: 0; color: var(--primary); font-weight: 700; cursor: pointer;">Group Event</label>
            </div>
            <div class="form-group" style="flex: 1; display: flex; align-items: center; gap: 0.5rem; background: #FEF3C7; padding: 1rem; border-radius: var(--radius-md); margin: 0;">
                <input type="checkbox" id="compIsOffstage" ${cIsOffstage ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #D97706; cursor: pointer;">
                <label for="compIsOffstage" style="margin: 0; color: #D97706; font-weight: 700; cursor: pointer;">Offstage Event</label>
            </div>
        </div>

        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Category</label><select id="compCategory">${catOpts}</select></div>
            <div class="form-group" style="flex:1;"><label>Stage</label><select id="compStage"><option value="">-- NO STAGE YET --</option>${stageOpts}</select></div>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Max Marks</label><input type="number" id="compMarks" value="${cMarks}"></div>
            <div class="form-group" style="flex:1;"><label>Participants / Team</label><input type="number" id="compParticipants" value="${cLimit}"></div>
            <div class="form-group" style="flex:1;"><label>Mins / Student</label><input type="number" id="compTimePerStudent" value="${cTime}"></div>
        </div>
        
        <!-- NEW AWARD CATEGORY SELECTOR -->
        <div class="form-group" style="margin-top: 0.5rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
            <label><i class="fa-solid fa-trophy" style="color:var(--primary);"></i> Special Award Eligibility</label>
            <select id="compAwardType" style="border-color: var(--primary);">
                <option value="none" ${cAwardType === 'none' ? 'selected' : ''}>Standard Event (No Special Award)</option>
                <option value="star" ${cAwardType === 'star' ? 'selected' : ''}>⭐ Star of the Fest Event</option>
                <option value="pen" ${cAwardType === 'pen' ? 'selected' : ''}>🖋️ Pen of the Fest Event</option>
            </select>
        </div>
    `, saveCompetition);
}

async function saveCompetition() {
    const id = document.getElementById('compId').value;
    const name = document.getElementById('compName').value;
    const category_id = document.getElementById('compCategory').value;
    const is_offstage = document.getElementById('compIsOffstage').checked; // NEW
const stage_id = document.getElementById('compStage').value || null;    const max_mark = document.getElementById('compMarks').value;
    const max_participants = document.getElementById('compParticipants').value;
    const is_group = document.getElementById('compIsGroup').checked; 
    const award_type = document.getElementById('compAwardType').value; 
    const time_per_student = parseInt(document.getElementById('compTimePerStudent').value) || 0;
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
const payload = { name, category_id, stage_id, max_mark, max_participants, is_group, is_offstage, award_type, time_per_student };
        if (id) payload.id = id;

        const { error } = await supabaseClient.from('competitions').upsert([festPayload(payload)]);
        if (error) throw error;
        
        showToast(id ? 'Competition updated!' : 'Competition created!');
        closeModal(); 
        loadCompetitions();
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}



// --- STAGES & TEAMS MANAGEMENT ---
// --- PREMIUM FRONTEND CONFIRMATION LOGIC ---
let _activeConfirmCallback = null;
let _activeCancelCallback = null;

function openConfirmModal(title, text, confirmCallback, options = {}) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        if (confirmCallback) confirmCallback();
        return;
    }

    const titleEl = document.getElementById('confirmModalTitle');
    const textEl = document.getElementById('confirmModalText');
    const confirmBtn = document.getElementById('confirmModalBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const iconBox = document.getElementById('confirmModalIconBox');
    const iconEl = document.getElementById('confirmModalIcon');

    if (titleEl) titleEl.innerText = title || 'Are you sure?';
    if (textEl) textEl.innerHTML = text || 'This action cannot be undone.';

    // Options customization
    const confirmText = options.confirmText || 'Yes, Delete';
    const cancelText = options.cancelText || 'Cancel';
    const confirmBtnClass = options.confirmBtnClass || 'btn-danger';
    const iconClass = options.icon || 'fa-solid fa-triangle-exclamation';
    const iconColor = options.iconColor || (confirmBtnClass.includes('danger') ? '#EF4444' : (confirmBtnClass.includes('warning') ? '#D97706' : 'var(--primary)'));
    const iconBg = options.iconBg || (confirmBtnClass.includes('danger') ? '#FEE2E2' : (confirmBtnClass.includes('warning') ? '#FEF3C7' : 'var(--primary-light)'));

    if (confirmBtn) {
        confirmBtn.className = `btn ${confirmBtnClass}`;
        confirmBtn.innerHTML = options.confirmIcon ? `<i class="${options.confirmIcon}"></i> ${confirmText}` : confirmText;
        confirmBtn.style.flex = '1';
    }
    if (cancelBtn) {
        cancelBtn.innerText = cancelText;
        cancelBtn.style.flex = '1';
    }
    if (iconBox) {
        iconBox.style.background = iconBg;
        iconBox.style.color = iconColor;
    }
    if (iconEl) {
        iconEl.className = iconClass;
    }

    _activeConfirmCallback = confirmCallback || null;
    _activeCancelCallback = options.onCancel || null;

    confirmBtn.onclick = () => {
        modal.classList.remove('show');
        if (_activeConfirmCallback) {
            const cb = _activeConfirmCallback;
            _activeConfirmCallback = null;
            cb();
        }
    };

    modal.classList.add('show');
}

function closeConfirmModal(triggerCancel = true) {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('show');
    if (triggerCancel && _activeCancelCallback) {
        const cb = _activeCancelCallback;
        _activeCancelCallback = null;
        cb();
    }
}
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;

// --- STAGES & TEAMS MANAGEMENT ---
async function loadStagesAndTeams() {
    try {
        const [stagesRes, teamsRes, stageFlagsVal] = await Promise.all([
            festQuery(supabaseClient.from('stages').select(`*, users(username), competitions(count)`)).order('stage_no'),
            festQuery(supabaseClient.from('teams').select('*, participants(count), users(username, password_hash)')).order('name'),
            window.festosGetSetting ? window.festosGetSetting('stage_offstage_flags') : (supabaseClient.from('settings').select('value').eq('id', 'stage_offstage_flags').maybeSingle().then(r => r.data?.value))
        ]);
        
        if (stagesRes.error) throw stagesRes.error;
        if (teamsRes.error) throw teamsRes.error;
        
        window.stageOffstageFlags = stageFlagsVal || {};
        stagesList = stagesRes.data || [];
        stagesList.forEach(s => {
            s.is_offstage = (window.stageOffstageFlags && window.stageOffstageFlags[s.id] !== undefined)
                ? !!window.stageOffstageFlags[s.id]
                : (s.name && s.name.toUpperCase().includes('OFFSTAGE'));
        });

        teamsList = teamsRes.data || [];
        if (typeof populateBulkStageSelect === 'function') populateBulkStageSelect();
        
        const stbody = document.getElementById('stages-tbody');
        stbody.innerHTML = '';
        
        stagesList.forEach(s => {
            const compCount = s.competitions[0]?.count || 0;
            const modeBadge = s.is_offstage 
                ? `<span class="badge" style="background:#FEF3C7; color:#D97706; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:4px; margin-top:4px; display:inline-block;"><i class="fa-solid fa-layer-group"></i> OFFSTAGE VENUE</span>`
                : `<span class="badge" style="background:#EEF2FF; color:#4F46E5; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:4px; margin-top:4px; display:inline-block;"><i class="fa-solid fa-microphone-lines"></i> ONSTAGE VENUE</span>`;

            stbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${escapeSheetHtml(s.name)}</strong><br>
                        <small style="color:var(--text-muted)">CONTROLLER: ${s.users?.username || 'NONE'}</small><br>
                        ${modeBadge}
                    </td>
                    <td>STAGE ${s.stage_no}</td>
                    <td><span class="badge-count" onclick="viewRelationalData('competitions', 'stage_id', '${s.id}')">${compCount} COMPS</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openStageModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' title="Edit Stage"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteStage('${s.id}', '${s.name.replace(/'/g, "\\'")}')" title="Delete Stage"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        const ttbody = document.getElementById('teams-tbody');
        ttbody.innerHTML = '';
        
        teamsList.forEach(t => {
            const memberCount = t.participants[0]?.count || 0;
            
            // Check if there is a team manager account linked to this team
            const mgrAccount = t.users && t.users.length > 0 ? t.users[0] : null;
            const accountInfo = mgrAccount 
                ? `<br><span style="display:inline-block; margin-top:6px; padding: 4px 8px; background: var(--primary-light); border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: var(--primary);">PORTAL: ${mgrAccount.username} / ${mgrAccount.password_hash}</span>` 
                : '';

            ttbody.innerHTML += `
                <tr>
                    <td>
                        <strong style="font-size:1.05rem;">${t.name}</strong><br>
                        <small style="color:var(--text-muted)">MGR: ${t.manager_name || 'N/A'} | ASST: ${t.assistant_manager_name || 'N/A'}</small>
                        ${accountInfo}
                    </td>
                    <td><span class="badge-count" onclick="viewRelationalData('participants', 'team_id', '${t.id}')">${memberCount} MEMBERS</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openTeamModal(${JSON.stringify(t).replace(/'/g, "&apos;")})' title="Edit Team"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteTeam('${t.id}', '${t.name.replace(/'/g, "\\'")}')" title="Delete Team"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch(e) { showToast(e.message, 'error'); }
}

// Updated Deletion Methods utilizing the custom frontend modal
function deleteStage(id, name) { 
    openConfirmModal(
        'Delete Stage?', 
        `Are you sure you want to delete "${name}"? This action cannot be undone.`, 
        async () => {
            try {
                const { error } = await supabaseClient.from('stages').delete().eq('id', id); 
                if (error) throw error;
                showToast('Stage deleted successfully.');
                loadStagesAndTeams(); 
            } catch(e) { 
                showToast(e.message, 'error'); 
            }
        }
    );
}

function deleteTeam(id, name) { 
    openConfirmModal(
        'Delete Team?', 
        `Are you sure you want to delete "${name}"? This action cannot be undone.`, 
        async () => {
            try {
                const { error } = await supabaseClient.from('teams').delete().eq('id', id); 
                if (error) throw error;
                showToast('Team deleted successfully.');
                loadStagesAndTeams(); 
            } catch(e) { 
                showToast(e.message, 'error'); 
            }
        }
    );
}

async function openStageModal(editData = null) {
    try {
        if (availableControllers.length === 0) {
            const { data } = await festQuery(supabaseClient.from('users').select('*')).eq('role', 'stage_controller');
            availableControllers = data || [];
        }
        
        const isEdit = !!editData;
        const sId = isEdit ? editData.id : '';
        const sName = isEdit ? editData.name : '';
        const sNo = isEdit ? editData.stage_no : '1';
        const sIsOffstage = isEdit 
            ? (editData.is_offstage !== undefined ? editData.is_offstage : (window.stageOffstageFlags && !!window.stageOffstageFlags[editData.id]))
            : false;
        
        let controllerOpts = availableControllers.map(c => 
            `<option value="${c.id}" ${isEdit && editData.controller_id === c.id ? 'selected' : ''}>${c.username}</option>`
        ).join('');
        
        openModal(isEdit ? 'Edit Stage / Venue' : 'Add Stage / Venue', `
            <input type="hidden" id="stageId" value="${sId}">
            <div class="form-group"><label>Stage / Venue Name</label><input type="text" id="stageName" value="${escapeSheetHtml(sName)}" placeholder="e.g. Main Auditorium, Stage 1, Drawing Hall"></div>
            <div class="form-group"><label>Stage Number (ID)</label><input type="number" id="stageNo" value="${sNo}"></div>
            <div class="form-group"><label>Assign Controller</label><select id="stageController"><option value="">-- SELECT CONTROLLER --</option>${controllerOpts}</select></div>

            <div class="form-group" style="display: flex; align-items: flex-start; gap: 0.85rem; background: #FEF3C7; padding: 1rem; border-radius: var(--radius-md); border: 1.5px solid #FDE68A; margin-top: 1rem;">
                <input type="checkbox" id="stageIsOffstage" ${sIsOffstage ? 'checked' : ''} style="width: 22px; height: 22px; accent-color: #D97706; cursor: pointer; margin-top: 2px;">
                <div style="flex: 1;">
                    <label for="stageIsOffstage" style="margin: 0; font-weight: 800; color: #92400E; cursor: pointer; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                        <i class="fa-solid fa-layer-group"></i> Offstage Venue
                    </label>
                    <small style="display: block; color: #B45309; font-size: 0.8rem; margin-top: 4px; line-height: 1.4;">
                        Check this if this venue is for offstage competitions (e.g. writing, drawing halls). In Stage Controller, offstage venues do <strong>not</strong> require an assigned judge to start or end the competition. A judge only evaluates after completion.
                    </small>
                </div>
            </div>
        `, async () => {
            const id = document.getElementById('stageId').value;
            const name = document.getElementById('stageName').value;
            const stage_no = document.getElementById('stageNo').value;
            const controller_id = document.getElementById('stageController').value || null;
            const isOffstage = document.getElementById('stageIsOffstage')?.checked || false;
            
            if(!name || !stage_no) return showToast('Name and Number required', 'error');
            
            setLoading('modalSaveBtn', true);
            const payload = { name, stage_no, controller_id };
            if (id) payload.id = id;

            const { data: upsertData, error } = await supabaseClient.from('stages').upsert([festPayload(payload)]).select();
            
            if (error) {
                setLoading('modalSaveBtn', false);
                return showToast(error.message, 'error');
            }

            // Persist the offstage venue flag in settings
            const savedStageId = id || (upsertData && upsertData[0] ? upsertData[0].id : null);
            if (savedStageId) {
                window.stageOffstageFlags = window.stageOffstageFlags || {};
                window.stageOffstageFlags[savedStageId] = isOffstage;
                if (window.festosSaveSetting) {
                    await window.festosSaveSetting('stage_offstage_flags', window.stageOffstageFlags);
                } else {
                    await supabaseClient.from('settings').upsert({ id: 'stage_offstage_flags', value: window.stageOffstageFlags });
                }
            }

            setLoading('modalSaveBtn', false);
            showToast(id ? 'Stage updated successfully!' : 'Stage added successfully!');
            closeModal();
            loadStagesAndTeams();
        });
    } catch(e) { showToast(e.message, 'error'); }
}

function openTeamModal(editData = null) {
    const isEdit = !!editData;
    const tId = isEdit ? editData.id : '';
    const tName = isEdit ? editData.name : '';
    const tMgr = isEdit && editData.manager_name ? editData.manager_name : '';
    const tAsst = isEdit && editData.assistant_manager_name ? editData.assistant_manager_name : '';

    openModal(isEdit ? 'Edit Team' : 'Add Team', `
        <input type="hidden" id="teamId" value="${tId}">
        <div class="form-group"><label>Team Name</label><input type="text" id="teamName" value="${tName}"></div>
        <div class="form-group"><label>Manager Name</label><input type="text" id="teamMgr" value="${tMgr}"></div>
        <div class="form-group"><label>Assistant Manager Name</label><input type="text" id="teamAsst" value="${tAsst}"></div>
    `, async () => {
        const id = document.getElementById('teamId').value;
        const name = document.getElementById('teamName').value;
        const manager_name = document.getElementById('teamMgr').value;
        const assistant_manager_name = document.getElementById('teamAsst').value;
        
        if(!name) return showToast('Team Name required', 'error');
        
        setLoading('modalSaveBtn', true);
        const payload = { name, manager_name, assistant_manager_name };
        if (id) payload.id = id;

        // Added .select() to retrieve the ID of the newly created team
        const { data: savedTeam, error } = await supabaseClient.from('teams').upsert([festPayload(payload)]).select();
        setLoading('modalSaveBtn', false);
        
        if(error) {
            showToast(error.message, 'error'); 
        } else { 
            // AUTO-CREATE MANAGER USER IF THIS IS A NEW TEAM
            if (!id && savedTeam && savedTeam.length > 0) {
                const teamId = savedTeam[0].id;
                // Generates a username like "falcons_mgr"
                const autoUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_mgr';
                
                await supabaseClient.from('users').insert([festPayload({
                    username: autoUsername,
                    password_hash: 'fest2026', // Default password
                    role: 'team_manager',
                    team_id: teamId // Make sure 'team_id' column exists in your users table!
                })]);
                showToast(`Team added & User created: ${autoUsername}`, 'success');
            } else {
                showToast('Team updated!', 'success'); 
            }
            
            closeModal(); 
            loadStagesAndTeams(); 
        }
    });
}

// --- PARTICIPANTS MANAGEMENT (PAGINATED) ---

// Global states for pagination
let partCurrentPage = 1;
let partRowsPerPage = 10;
filteredParticipantsList = [];

async function loadParticipants() {
    try {
        await loadClassSystemSettings();
        const prereqs = [];
        if (categoriesList.length === 0) prereqs.push(loadCategories());
        if (teamsList.length === 0) prereqs.push(festQuery(supabaseClient.from('teams').select('*')).then(r => { teamsList = r.data || []; }));
        if (prereqs.length > 0) await Promise.all(prereqs);

        let query = festQuery(supabaseClient.from('participants').select(`*, categories(name), teams(name)`)).order('name');
        let { data, error } = await query;
        if (error) {
            query = festQuery(supabaseClient.from('participants').select(`id, name, unique_id, team_id, category_id, dob, photo_url, categories(name), teams(name)`)).order('name');
            const res = await query;
            if (res.error) throw res.error;
            data = res.data;
        }
        
        participantsList = data || []; 
        
        // Merge participant class fallback mapping
        const partClassMap = await getParticipantClassesMapping();
        participantsList.forEach(p => {
            if (!p.class_name && partClassMap[p.id]) {
                p.class_name = partClassMap[p.id];
            }
        });

        filteredParticipantsList = [...participantsList];
        window.participantsList = participantsList;
        window.filteredParticipantsList = filteredParticipantsList;
        
        // Populate Category Filter with standard categories only (exclude general categories)
        const catFilter = document.getElementById('filterCategory');
        if(catFilter && catFilter.options.length <= 1) {
            catFilter.innerHTML = '<option value="">All Categories</option>';
            categoriesList.filter(c => !c.is_general).forEach(c => catFilter.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // Populate Team Filter
        const teamFilter = document.getElementById('filterPartTeam');
        if(teamFilter && teamFilter.options.length <= 1) {
            teamFilter.innerHTML = '<option value="">All Teams</option>';
            teamsList.forEach(t => teamFilter.innerHTML += `<option value="${t.name}">${t.name}</option>`);
        }

        // Setup Class Filter & Table Column
        const classBox = document.getElementById('filterPartClassBox');
        const thClass = document.getElementById('th-part-class');
        const classFilter = document.getElementById('filterPartClass');
        const isClassActive = !!(window.currentClassSystem?.enabled && window.currentClassSystem.classes?.length > 0);
        
        if (classBox) classBox.style.display = isClassActive ? 'block' : 'none';
        if (thClass) thClass.style.display = isClassActive ? '' : 'none';
        if (classFilter && isClassActive) {
            const currentSelected = classFilter.value;
            classFilter.innerHTML = '<option value="">All Classes</option>' + 
                window.currentClassSystem.classes.map(cls => `<option value="${cls}" ${currentSelected === cls ? 'selected' : ''}>${cls}</option>`).join('');
        }

        initBulkTeamControls();

        partCurrentPage = 1;
        renderParticipantsTable();
    } catch(e) { showToast(e.message, 'error'); }
}

function filterParticipants(resetPage = true) {
    const query = document.getElementById('searchPartInput')?.value?.toLowerCase() || '';
    const catFilter = document.getElementById('filterCategory')?.value || '';
    const teamFilter = document.getElementById('filterPartTeam') ? document.getElementById('filterPartTeam').value : "";
    const dobFilter = document.getElementById('filterPartDob') ? document.getElementById('filterPartDob').value : "";
    const classFilter = document.getElementById('filterPartClass') ? document.getElementById('filterPartClass').value : "";
    
    filteredParticipantsList = participantsList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        
        const partCatName = p.categories?.name || '';
        const matchCat = catFilter === "" || partCatName === catFilter;
        
        const partTeamName = p.teams?.name || '';
        const matchTeam = teamFilter === "" || partTeamName === teamFilter;
        
        const matchDob = dobFilter === "" || p.dob === dobFilter;
        const matchClass = classFilter === "" || p.class_name === classFilter;
        
        return matchName && matchCat && matchTeam && matchDob && matchClass;
    });
    
    window.filteredParticipantsList = filteredParticipantsList;
    if (resetPage) partCurrentPage = 1; 
    renderParticipantsTable();
}

async function loadCategories() {
    try {
        await loadClassSystemSettings();
        await initCategoryLimitUI();
        const limitConfig = await getCategoryLimitConfig();
        const { data, error } = await festQuery(supabaseClient
            .from('categories')
            .select('*, participants(count), competitions(count)'))
            .order('name');
            
        if(error) throw error;
        categoriesList = data || [];
        
        // Merge fallback category classes mapping
        const catClassMap = await getCategoryClassesMapping();
        categoriesList.forEach(c => {
            if (!c.eligible_classes && catClassMap[c.id]) {
                c.eligible_classes = catClassMap[c.id];
            }
        });

        const tbody = document.getElementById('categories-tbody');
        tbody.innerHTML = '';
        
        categoriesList.forEach(cat => {
            const partCount = cat.participants[0]?.count || 0;
            const compCount = cat.competitions[0]?.count || 0;
            
            // Generate DOB Period Label
            let dobLabel = '';
            if (cat.dob_start && cat.dob_end) dobLabel = `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 600;"><i class="fa-regular fa-calendar"></i> ${cat.dob_start} to ${cat.dob_end}</span>`;
            else if (cat.dob_start) dobLabel = `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 600;"><i class="fa-regular fa-calendar"></i> From ${cat.dob_start}</span>`;
            else if (cat.dob_end) dobLabel = `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 600;"><i class="fa-regular fa-calendar"></i> Until ${cat.dob_end}</span>`;

            // Generate Eligible Classes Badge List
            let classBadgeList = '';
            if (cat.eligible_classes && Array.isArray(cat.eligible_classes) && cat.eligible_classes.length > 0) {
                classBadgeList = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">` +
                    cat.eligible_classes.map(cls => `<span style="font-size: 0.7rem; background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; padding: 1px 6px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-graduation-cap" style="font-size: 0.65rem; margin-right: 2px;"></i>${cls}</span>`).join('') +
                    `</div>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${cat.id}" ${globalSelections['categories-tbody']?.has(cat.id) ? 'checked' : ''} onchange="handleRowSelection('categories-tbody', this.value, this.checked)"></td>                    
                    <td><strong style="font-size: 1.05rem;">${cat.name}</strong>${dobLabel}${classBadgeList}</td>
                    <td>${cat.is_general ? '<span class="badge badge-primary">General</span>' : 'Standard'}</td>
                    <td><span class="badge-count" onclick="viewRelationalData('participants', 'category_id', '${cat.id}')">${partCount} Students</span></td>
                    <td><span class="badge-count" onclick="viewRelationalData('competitions', 'category_id', '${cat.id}')">${compCount} Competitions</span></td>
                    <td>${(() => {
                        if (cat.is_general) {
                            return '<span class="badge" style="background:#EFF6FF; color:#2563EB; font-weight:700;"><i class="fa-solid fa-infinity"></i> General (Exempt)</span>';
                        }
                        const cfg = window.cachedCategoryLimitConfig || {};
                        const catCfg = (cfg.categories && cfg.categories[cat.id]) || {};
                        if (catCfg.enabled !== false && catCfg.limit) {
                            return `<span class="badge badge-primary" style="font-weight:700;"><i class="fa-solid fa-gauge-high"></i> Max ${catCfg.limit} / Student</span>`;
                        }
                        return '<span class="badge" style="background:#F1F5F9; color:#64748B;">Unlimited</span>';
                    })()}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                             <button class="btn btn-outline" onclick='openCategoryModal(${JSON.stringify(cat).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})'><i class="fa-solid fa-pen"></i></button>
                             <button class="btn btn-danger" onclick="deleteCategory('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        if (typeof filterCategoriesTable === 'function') filterCategoriesTable();
    } catch(e) { showToast(e.message, 'error'); }
}

function renderParticipantsTable() {
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    const isClassActive = !!(window.currentClassSystem?.enabled && window.currentClassSystem.classes?.length > 0);
    const colSpanTotal = isClassActive ? 8 : 7;

    const start = (partCurrentPage - 1) * partRowsPerPage;
    const end = start + partRowsPerPage;
    const pageData = filteredParticipantsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colSpanTotal}" style="text-align: center; padding: 2rem; color: var(--text-muted);">No participants found.</td></tr>`;
        renderPartPagination();
        return;
    }

    pageData.forEach(p => {
        const safeData = JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        const photoSrc = p.photo_url ? p.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3ENO PHOTO%3C/text%3E%3C/svg%3E';        
        
        const classCellHtml = isClassActive ? `
            <td>
                ${p.class_name ? `<span class="badge" style="background:#EFF6FF; color:#1D4ED8; font-weight:700;"><i class="fa-solid fa-graduation-cap" style="margin-right:3px;"></i>${p.class_name}</span>` : '<span style="color:var(--text-muted); font-size:0.85rem;">-</span>'}
            </td>
        ` : '';

        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}" ${globalSelections['participants-tbody']?.has(p.id) ? 'checked' : ''} onchange="handleRowSelection('participants-tbody', this.value, this.checked)"></td>
                <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${p.unique_id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${photoSrc}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0;">
                        <span>${p.name}</span>
                    </div>
                </td>
                <td><span class="badge" style="background:#F1F5F9; color:#475569;">${p.teams?.name || 'UNASSIGNED'}</span></td>
                <td>${p.categories?.name || 'N/A'}</td>
                ${classCellHtml}
                <td style="font-weight: 600; color: var(--text-muted);">${p.dob || 'N/A'}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Details" onclick='viewParticipantCard(${safeData})'><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="Edit" onclick='openParticipantModal(${safeData})'><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="Download ID" onclick="generateSingleCard('${p.id}')"><i class="fa-solid fa-download"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" title="Delete" onclick="deleteParticipant('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    renderPartPagination();
}


function renderPartPagination() {
    const totalPages = Math.ceil(filteredParticipantsList.length / partRowsPerPage) || 1;
    const paginationContainer = document.getElementById('part-pagination');
    
    const startNum = filteredParticipantsList.length === 0 ? 0 : ((partCurrentPage - 1) * partRowsPerPage) + 1;
    const endNum = Math.min(partCurrentPage * partRowsPerPage, filteredParticipantsList.length);

    const masterCb = document.querySelector('#participants-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredParticipantsList.length} entries
            <select onchange="partRowsPerPage = parseInt(this.value); partCurrentPage = 1; renderParticipantsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${partRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${partRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${partRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${partRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changePartPage(-1)" ${partCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: flex; align-items: center; padding: 0 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--primary);">Page ${partCurrentPage} of ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changePartPage(1)" ${partCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

function changePartPage(direction) {
    const totalPages = Math.ceil(filteredParticipantsList.length / partRowsPerPage);
    partCurrentPage += direction;
    if (partCurrentPage < 1) partCurrentPage = 1;
    if (partCurrentPage > totalPages) partCurrentPage = totalPages;
    renderParticipantsTable();
}

// --- PARTICIPANT EXPORT FUNCTIONS ---

// Generates a Premium PDF Directory for Participants
async function exportParticipantsPDF() {
    showToast('Generating Participants PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Participants Directory');

        // Map over the filtered list to respect any active search criteria
        let tableRows = filteredParticipantsList.map((p, index) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.teams?.name || 'UNASSIGNED'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.categories?.name || 'N/A'}</td>
<td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.dob || 'N/A'}</td>
            </tr>
        `).join('');

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">UNIQUE ID</th>
                        <th style="padding: 10px;">NAME</th>
                        <th style="padding: 10px;">TEAM</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">DOB</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: typeof getFestFileName === 'function' ? getFestFileName('Participants', 'pdf') : `Fest_Participants.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}

// Custom CSV Export that resolves Category and Team IDs to real names
async function exportParticipantsCSV() {
    try {
        if(filteredParticipantsList.length === 0) return showToast("No participants to export.", "error");

        const flatData = filteredParticipantsList.map(p => ({
            "UNIQUE ID": p.unique_id || 'N/A',
            "NAME": p.name || 'N/A',
            "TEAM": p.teams?.name || 'UNASSIGNED',
            "CATEGORY": p.categories?.name || 'N/A',
            "DOB": p.dob || 'N/A'
        }));

        const csvFileName = typeof getFestFileName === 'function' ? getFestFileName('Participants_Data', 'csv') : 'Fest_Participants_Data.csv';

        if (typeof festosExportCSV === 'function') {
            festosExportCSV(csvFileName, flatData, 'Participants Master Register');
        } else {
            const blob = new Blob([Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a"); 
            link.href = URL.createObjectURL(blob); 
            link.setAttribute("download", csvFileName);
            document.body.appendChild(link); 
            link.click(); 
            document.body.removeChild(link);
        }
        showToast('CSV Exported Successfully!');
    } catch (e) { showToast(e.message, 'error'); }
}

function viewParticipantCard(p) {
    const teamName = p.teams ? p.teams.name : 'UNASSIGNED';
    const catName = p.categories ? p.categories.name : 'GENERAL';
const photoSrc = p.photo_url ? p.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3ENO PHOTO%3C/text%3E%3C/svg%3E';    
    document.getElementById('listModalTitle').innerText = 'Participant Identity';
    
    // Reset wrapper styling to allow flexible component layout
    const container = document.getElementById('listModalTable').parentElement;
    container.style.border = 'none';
    container.style.boxShadow = 'none';
    container.style.background = 'transparent';
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';
    
    document.getElementById('listModalTable').innerHTML = `
        <style>
            #listModalTable { display: block; width: 100%; border: none; }
            #listModalTable tbody, #listModalTable tr, #listModalTable td { 
                display: block; width: 100%; border: none; padding: 0; background: transparent; 
            }
            #listModalTable td::before { display: none !important; }

            .pid-wrapper { display: flex; flex-direction: column; gap: 1rem; width: 100%; }
            
            /* Top Card */
            .pid-top { 
                display: flex; gap: 1.5rem; background: white; border: 1px solid var(--border); 
                border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); align-items: center; 
            }
            .pid-photo { 
                width: 110px; height: 140px; flex-shrink: 0; border-radius: 12px; 
                overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm); 
            }
            .pid-photo img { width: 100%; height: 100%; object-fit: cover; }
            
            .pid-info { flex: 1; text-align: left; overflow: hidden; }
            .pid-name { 
                font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; 
                line-height: 1.2; word-break: break-word; text-transform: uppercase; 
            }
            .pid-badge { 
                background: var(--primary); color: white; padding: 0.35rem 0.75rem; 
                border-radius: 8px; font-family: monospace; font-size: 0.9rem; font-weight: 700; 
                display: inline-block; margin-bottom: 0.75rem; white-space: nowrap; 
                box-shadow: 0 4px 10px rgba(79,70,229,0.2); 
            }
            .pid-meta { 
                display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8rem; 
                font-weight: 700; color: var(--text-muted); text-transform: uppercase; 
            }
            .pid-meta-item { display: flex; align-items: center; gap: 0.5rem; }

            /* Bottom Cards */
            .pid-bottom { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: stretch; }
            
            .pid-qr-card { 
                background: white; border: 1px solid var(--border); border-radius: 16px; 
                padding: 1.25rem; display: flex; flex-direction: column; align-items: center; 
                justify-content: center; gap: 0.5rem; box-shadow: var(--shadow-sm); 
            }
            .pid-qr-box { width: 110px; height: 110px; display: flex; justify-content: center; align-items: center; }
            
            .pid-actions { display: flex; flex-direction: column; gap: 1rem; }
            .pid-dob-card { 
                background: var(--primary-light); border: 1px solid rgba(79,70,229,0.15); 
                border-radius: 16px; padding: 1.25rem; display: flex; justify-content: space-between; 
                align-items: center; flex: 1; min-height: 80px;
            }
            
            .pid-btn { 
                width: 100%; justify-content: center; padding: 1rem; border-radius: 12px; 
                background: white; border: 2px solid var(--border); font-weight: 800; 
                color: var(--text-main); transition: all 0.2s; box-shadow: var(--shadow-sm); 
                cursor: pointer; display: flex; align-items: center; gap: 0.5rem; 
                font-size: 0.9rem; text-transform: uppercase; 
            }
            .pid-btn:hover { border-color: var(--primary); color: var(--primary); }

            /* Mobile Stack Optimization */
@media (max-width: 768px) {
    .pid-top { 
        flex-direction: column; 
        align-items: center; 
        text-align: center; 
        padding: 1.25rem; 
    }
    .pid-info { 
        text-align: center; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
    }
    /* Force bottom section to stack vertically */
    .pid-bottom { 
        grid-template-columns: 1fr; 
        gap: 0.75rem; 
    }
    /* Turn QR card into a horizontal banner to save vertical space */
    .pid-qr-card { 
        flex-direction: row; 
        justify-content: flex-start; 
        padding: 1rem; 
        text-align: left; 
        gap: 1rem;
    }
    .pid-qr-box { 
        width: 70px; 
        height: 70px; 
        flex-shrink: 0; 
    }
    .pid-dob-card { 
        padding: 1rem; 
        min-height: auto; 
    }
}
        </style>
        
        <tbody>
            <tr>
                <td>
                    <div class="pid-wrapper">
                        
                        <!-- Top Profile Section -->
                        <div class="pid-top">
                            <div class="pid-photo">
                                <img src="${photoSrc}" alt="Photo">
                            </div>
                            <div class="pid-info">
                                <div class="pid-name">${p.name}</div>
                                <div class="pid-badge">${p.unique_id}</div>
                                <div class="pid-meta">
                                    <div class="pid-meta-item"><i class="fa-solid fa-users" style="color: var(--primary); width: 16px;"></i> ${teamName}</div>
                                    <div class="pid-meta-item"><i class="fa-solid fa-layer-group" style="color: var(--primary); width: 16px;"></i> ${catName}</div>
                                    ${p.class_name ? `<div class="pid-meta-item"><i class="fa-solid fa-graduation-cap" style="color: var(--primary); width: 16px;"></i> ${p.class_name}</div>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Bottom Section -->
                        <div class="pid-bottom">
                            <!-- QR Code -->
                            <div class="pid-qr-card">
                                <div id="qr-container-${p.unique_id}" class="pid-qr-box">
                                    <i class="fa-solid fa-spinner fa-spin" style="color: var(--text-muted); font-size: 1.5rem;"></i>
                                </div>
                                <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em;">SCAN TO VERIFY</span>
                            </div>

                            <!-- Actions & DOB -->
                            <div class="pid-actions">
                                <div class="pid-dob-card">
                                    <div style="display: flex; flex-direction: column; gap: 0.25rem; text-align: left;">
                                        <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); letter-spacing: 0.05em; text-transform: uppercase;">DATE OF BIRTH</span>
                                        <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${p.dob || 'NOT PROVIDED'}</span>
                                    </div>
                                    <i class="fa-solid fa-cake-candles" style="font-size: 1.75rem; color: var(--primary); opacity: 0.3;"></i>
                                </div>

                                <button class="pid-btn" onclick="viewParticipantEnrollments('${p.id}')">
                                    <i class="fa-solid fa-clipboard-list"></i> VIEW ENROLLMENTS
                                </button>
                            </div>
                        </div>

                    </div>
                </td>
            </tr>
        </tbody>
    `;

    document.getElementById('listModal').classList.add('show');

    // Generate the QR code dynamically
    setTimeout(() => {
        const qrContainer = document.getElementById(`qr-container-${p.unique_id}`);
        if (qrContainer) {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: p.unique_id,
                width: 110,
                height: 110,
                colorDark: "#0F172A",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, 50);
}
// NEW FUNCTION: specifically joins competitions and categories to the participant
async function viewParticipantEnrollments(participantId) {
    document.getElementById('listModalTable').parentElement.style.cssText = "max-height: 300px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm);";
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`
                competitions(
                    name, 
                    categories(name)
                )
            `)
            .eq('participant_id', participantId);
            
        if (error) throw error;
        
        const tbody = document.getElementById('listModalTable');
        // Added Category column header
        tbody.innerHTML = `<tr><th>COMPETITION</th><th>CATEGORY</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">No enrollments found.</td></tr>`;
        } else {
            data.forEach(item => {
                const compName = item.competitions?.name || 'Unknown Competition';
                const catName = item.competitions?.categories?.name || 'General';
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 600;">${compName}</td>
                        <td><span class="badge" style="background:var(--primary-light); color:var(--primary); font-size:0.7rem;">${catName}</span></td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Enrolled Competitions`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast(e.message, 'error'); 
    }
}

window.validateAdminDobAndClass = function() {
    const catSelect = document.getElementById('partCategory');
    const dobInput = document.getElementById('partDob');
    const classSelect = document.getElementById('partClass');
    const warningEl = document.getElementById('dobWarning');
    const saveBtn = document.getElementById('modalSaveBtn');
    
    if(!catSelect || !warningEl) return;
    
    const catId = catSelect.value;
    const dobVal = dobInput ? dobInput.value : '';
    const classVal = classSelect ? classSelect.value : '';
    
    const category = categoriesList.find(c => String(c.id) === String(catId));
    let isInvalid = false;
    let warningMsg = '';

    const catClasses = category?.eligible_classes || [];
    const hasClassRestrictions = Array.isArray(catClasses) && catClasses.length > 0;

    // Check DOB Period
    let dobMismatch = false;
    if(category && dobVal) {
        const dobDate = new Date(dobVal);
        if (category.dob_start && dobDate < new Date(category.dob_start)) {
            dobMismatch = true;
            warningMsg = `Date of birth mismatch: Born on/after ${category.dob_start} required.`;
        }
        if (category.dob_end && dobDate > new Date(category.dob_end)) {
            dobMismatch = true;
            warningMsg = `Date of birth mismatch: Born on/before ${category.dob_end} required.`;
        }
    }

    // SMART AGE AUTO-CORRECTION:
    // If class is eligible for this category, but age does not match, auto-switch to eligible category
    if (dobMismatch && classVal && dobVal) {
        const dobDate = new Date(dobVal);
        const standardCats = categoriesList.filter(c => !c.is_general);

        const alternateCat = standardCats.find(c => {
            if (String(c.id) === String(catId)) return false;
            const cClasses = c.eligible_classes || [];
            const acceptsClass = (Array.isArray(cClasses) && cClasses.length > 0) ? cClasses.includes(classVal) : true;
            if (!acceptsClass) return false;
            if (c.dob_start && dobDate < new Date(c.dob_start)) return false;
            if (c.dob_end && dobDate > new Date(c.dob_end)) return false;
            return true;
        });

        if (alternateCat) {
            catSelect.value = alternateCat.id;
            const prevName = category ? category.name : 'previous category';
            warningEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary);"></i> <strong>Age Warning & Auto-adjustment:</strong> Age did not match ${prevName}. Category automatically changed to <strong>${alternateCat.name}</strong>, which accepts <em>${classVal}</em> and matches birth date (${dobVal}).`;
            warningEl.style.display = 'block';
            warningEl.style.color = 'var(--primary)';
            warningEl.style.background = 'var(--primary-light)';
            warningEl.style.padding = '0.75rem';
            warningEl.style.borderRadius = '8px';
            warningEl.style.border = '1px solid var(--primary-ring)';
            if(saveBtn) saveBtn.disabled = false;
            showToast(`Auto-adjusted category to ${alternateCat.name}!`, 'info');
            return;
        }
    }

    // Check Class eligibility for current category
    if (classVal && hasClassRestrictions && !catClasses.includes(classVal)) {
        isInvalid = true;
        warningMsg = `Selected class (${classVal}) is not eligible for ${category?.name || 'this category'}. Allowed: ${catClasses.join(', ')}`;
    } else if (dobMismatch) {
        isInvalid = true;
    }

    if(isInvalid) {
        warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${warningMsg}`;
        warningEl.style.display = 'block';
        warningEl.style.color = 'var(--danger)';
        warningEl.style.background = '#FEE2E2';
        warningEl.style.padding = '0.75rem';
        warningEl.style.borderRadius = '8px';
        warningEl.style.border = '1px solid #FCA5A5';
        if(saveBtn) saveBtn.disabled = true;
    } else {
        warningEl.style.display = 'none';
        warningEl.style.background = 'transparent';
        warningEl.style.border = 'none';
        warningEl.style.padding = '0';
        if(saveBtn) saveBtn.disabled = false;
    }
};
window.validateAdminDob = window.validateAdminDobAndClass;

function openParticipantModal(editData = null) {
    // Exclude General/Common categories: Common category is ONLY for competitions
    const studentCategories = categoriesList.filter(c => !c.is_general);
    
    // If editing a participant who somehow has a general category, preserve it in the options
    if (editData && editData.category_id && !studentCategories.some(c => String(c.id) === String(editData.category_id))) {
        const existingCat = categoriesList.find(c => String(c.id) === String(editData.category_id));
        if (existingCat) studentCategories.unshift(existingCat);
    }

    let catOpts = studentCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let teamOpts = teamsList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    const isEdit = !!editData;
    const pId = isEdit ? editData.id : '';
    const pName = isEdit ? editData.name : '';
    const pDob = isEdit && editData.dob ? editData.dob : '';
    const pClass = isEdit && editData.class_name ? editData.class_name : '';
    const pUniqueId = isEdit ? editData.unique_id : '';
    const pPhoto = isEdit && editData.photo_url ? editData.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23EEF2FF"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236366F1"%3EPHOTO%3C/text%3E%3C/svg%3E';
    
    // Class Dropdown markup if Class System is enabled
    let classDropdownHtml = '';
    const isClassActive = !!(window.currentClassSystem?.enabled && window.currentClassSystem.classes?.length > 0);
    if (isClassActive) {
        const isMandatory = !!window.currentClassSystem.mandatory;
        classDropdownHtml = `
            <div class="form-group" style="flex: 1; min-width: 140px;">
                <label>Class / Grade ${isMandatory ? '<span style="color: var(--danger);">*</span>' : '<span style="color:var(--text-muted); font-size:0.75rem;">(Optional)</span>'}</label>
                <select id="partClass" onchange="window.validateAdminDobAndClass()">
                    <option value="">-- Select Class --</option>
                    ${window.currentClassSystem.classes.map(cls => `<option value="${cls}" ${pClass === cls ? 'selected' : ''}>${cls}</option>`).join('')}
                </select>
            </div>
        `;
    }

    const modalHtml = `
        <style>
            .part-modal-grid { display: grid; grid-template-columns: 150px 1fr; gap: 2rem; align-items: start; }
            @media (max-width: 600px) { .part-modal-grid { grid-template-columns: 1fr; gap: 1rem; text-align: center; } }
            
            .photo-preview-container img { 
                width: 100%; max-width: 150px; aspect-ratio: 2/3; object-fit: cover; 
                border-radius: 12px; border: 2.5px solid var(--border); padding: 4px; 
                box-shadow: var(--shadow-sm); background: white;
            }
            
            .photo-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; justify-content: center; }
            .photo-actions .btn { padding: 0.4rem; font-size: 0.75rem; flex: 1; }
        </style>
        
        <div class="part-modal-grid">
            <div class="photo-preview-container">
                <img id="partPhotoPreview" src="${pPhoto}" alt="Participant Photo">
                <input type="file" id="partPhoto" accept="image/png, image/jpeg, image/webp" onchange="triggerCropper(this)" style="display: none;">
                
                <div class="photo-actions" style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.75rem;">
                    <div style="display: flex; gap: 0.4rem;">
                        <button type="button" class="btn btn-primary" onclick="document.getElementById('partPhoto').click()" title="Upload New Photo" style="flex: 1;">
                            <i class="fa-solid fa-upload"></i> New
                        </button>
                        <button type="button" class="btn btn-outline" onclick="editExistingCrop()" title="Adjust Current Crop" style="flex: 1;">
                            <i class="fa-solid fa-crop-simple"></i> Crop
                        </button>
                    </div>
                    <button type="button" class="btn btn-outline" onclick="autoDetectAndCropFaceFromPreview()" title="Smart Auto Center Face" style="width: 100%; border-color: var(--primary); color: var(--primary); font-weight: 700; font-size: 0.75rem; padding: 0.4rem;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Auto Face
                    </button>
                </div>
            </div>

            <div class="form-fields" style="text-align: left;">
                <input type="hidden" id="partId" value="${pId}">
                <input type="hidden" id="partUniqueId" value="${pUniqueId}">
                
                <div class="form-group">
                    <label>Full Name <span style="color: var(--danger);">*</span></label>
                    <input type="text" id="partName" placeholder="E.G. JOHN DOE" value="${pName}">
                </div>
                
                <div class="form-group">
                    <label>Team Assignment</label>
                    <select id="partTeam">
                        <option value="">-- INDEPENDENT (NO TEAM) --</option>
                        ${teamOpts}
                    </select>
                </div>
                
                <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 2; min-width: 150px;">
                        <label>Category <span style="color: var(--danger);">*</span></label>
                        <select id="partCategory" onchange="window.validateAdminDobAndClass()">${catOpts}</select>
                    </div>
                    
                    ${classDropdownHtml}

                    <div class="form-group" style="flex: 1; min-width: 130px;">
                        <label>Date of Birth</label>
                        <input type="date" id="partDob" value="${pDob}" style="text-transform: none;" onchange="window.validateAdminDobAndClass()">
                    </div>
                </div>
                <!-- Warning injection -->
                <div id="dobWarning" style="color: var(--danger); font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem; display: none;"></div>
            </div>
        </div>
    `;

    openModal(isEdit ? 'Edit Participant' : 'Register Participant', modalHtml, saveParticipant);

    if (isEdit) {
        if(editData.team_id) document.getElementById('partTeam').value = editData.team_id;
        if(editData.category_id) document.getElementById('partCategory').value = editData.category_id;
        if(pClass && document.getElementById('partClass')) document.getElementById('partClass').value = pClass;
        setTimeout(() => window.validateAdminDobAndClass(), 100);
    }
}

async function saveParticipant() {
    const id = document.getElementById('partId').value;
    const name = document.getElementById('partName').value;
    const team_id = document.getElementById('partTeam').value || null;
    const category_id = document.getElementById('partCategory').value;
    const dob = document.getElementById('partDob').value || null;
    
    // Class value and mandatory verification
    const classVal = document.getElementById('partClass') ? document.getElementById('partClass').value : '';
    if (window.currentClassSystem?.enabled && window.currentClassSystem?.mandatory && !classVal) {
        return showToast('Class / Grade selection is required!', 'error');
    }

    let unique_id = document.getElementById('partUniqueId').value;
    if (!id || !unique_id) {
        unique_id = `${Math.floor(100000 + Math.random() * 900000)}`;
    }
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    
    try {
        let photo_url = undefined; 

        try {
            const blob = await getParticipantPhotoBlobHelper();
            if (blob) {
                let uploadedPublicUrl = null;

                // 1. Try uploading to Supabase Storage 'photos' bucket
                try {
                    const fileName = `profile_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`; 
                    const { error: uploadError } = await supabaseClient.storage
                        .from('photos')
                        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
                        
                    if (!uploadError) {
                        const { data: publicUrlData } = supabaseClient.storage
                            .from('photos')
                            .getPublicUrl(fileName);
                            
                        if (publicUrlData && publicUrlData.publicUrl) {
                            uploadedPublicUrl = publicUrlData.publicUrl;
                        }
                    } else {
                        console.warn("Storage upload notice (using optimized fallback):", uploadError.message);
                    }
                } catch (storageErr) {
                    console.warn("Storage upload exception (using optimized fallback):", storageErr);
                }

                if (uploadedPublicUrl) {
                    photo_url = uploadedPublicUrl;
                } else {
                    // 2. High-Performance Fallback: Convert to optimized JPEG Data URL
                    // Completely bypasses Supabase Storage RLS policies and never fails!
                    const base64Url = await blobToBase64(blob);
                    if (base64Url) {
                        photo_url = base64Url;
                    }
                }
            }
        } catch (photoErr) {
            console.error("Photo processing notice:", photoErr);
        }

        const payload = { name, team_id, category_id, dob, unique_id, class_name: classVal || null };
        
        if (id) payload.id = id; 
        if (photo_url) payload.photo_url = photo_url; 

        let { data: savedData, error } = await supabaseClient.from('participants').upsert([festPayload(payload)]).select();
        if (error && error.message && error.message.includes('class_name')) {
            delete payload.class_name;
            const retry = await supabaseClient.from('participants').upsert([festPayload(payload)]).select();
            if (retry.error) throw retry.error;
            const savedId = id || retry.data?.[0]?.id;
            if (savedId) await saveParticipantClassMapping(savedId, classVal);
        } else if (error) {
            throw error;
        } else {
            const savedId = id || savedData?.[0]?.id;
            if (savedId) await saveParticipantClassMapping(savedId, classVal);
        }
        
        showToast(id ? 'Participant updated!' : 'Participant registered successfully!');
        
        if(currentCropper) { currentCropper.destroy(); currentCropper = null; }
        
        closeModal(); 
        loadParticipants();
        
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}



// --- USER MANAGEMENT ---
async function loadUsers() {
    try {
        let userQuery = supabaseClient
            .from('users')
            .select('id, name, username, role, password_hash, teams(name)')
            .neq('role', 'master_admin')
            .neq('role', 'super_admin');
            
        const { data, error } = await festQuery(userQuery).order('role');
            
        if(error) throw error;
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        
        (data || []).forEach(u => {
            const roleDisplay = u.role.replace('_', ' ').toUpperCase();
            const teamTag = u.teams?.name ? `<br><span style="font-size: 0.75rem; color: var(--primary); font-weight: 800; letter-spacing: 0.05em;">TEAM: ${u.teams.name.toUpperCase()}</span>` : '';
            const safeData = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: 600;">${u.name || '-'}</td>
                    <td>
                        <strong style="font-size:1.05rem; text-transform: none !important;">${u.username}</strong>
                        ${teamTag}
                    </td> 
                    <td><span class="badge badge-primary">${roleDisplay}</span></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                           <input type="password" id="pwd-${u.id}" value="${u.password_hash || ''}" readonly style="border: none; background: transparent; width: 120px; font-weight: 600; color: var(--text-muted); outline: none; pointer-events: none; text-transform: none !important;">
                            <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="togglePassword('${u.id}')" title="Reveal Password"><i class="fa-solid fa-eye" id="eye-${u.id}"></i></button>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openUserModal(${safeData})' title="Edit User"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteUser('${u.id}', '${u.username.replace(/'/g, "\\'")}')" title="Delete User"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { showToast(e.message, 'error'); }
}

function togglePassword(id) {
    const pwdInput = document.getElementById(`pwd-${id}`);
    const eyeIcon = document.getElementById(`eye-${id}`);
    
    if (pwdInput.type === "password") {
        pwdInput.type = "text";
        eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        pwdInput.type = "password";
        eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function openUserModal(editData = null) {
    const isEdit = !!editData;
    const uId = isEdit ? editData.id : '';
    const uFullName = isEdit ? editData.name || '' : '';
    const uName = isEdit ? editData.username : '';
    const uPass = isEdit ? editData.password_hash : '';
    const uRole = isEdit ? editData.role : 'judge';

    openModal(isEdit ? 'Edit Staff Account' : 'Create Staff Account', `
        <input type="hidden" id="editUserId" value="${uId}">
        
        <div class="form-group"><label>Full Name</label><input type="text" id="newFullName" value="${uFullName}" placeholder="e.g. John Doe" autocomplete="off" style="text-transform: none !important;"></div>
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" value="${uName}" autocomplete="off" style="text-transform: none !important;"></div>
        
        <div class="form-group">
            <label>Password</label>
            <input type="text" id="newPassword" value="${uPass}" autocomplete="off" style="text-transform: none !important;">
        </div>
        
        <div class="form-group">
            <label>Role</label>
            <select id="newUserRole">
                <option value="judge" ${uRole === 'judge' ? 'selected' : ''}>Judge</option>
                <option value="stage_controller" ${uRole === 'stage_controller' ? 'selected' : ''}>Stage Controller</option>
                <option value="fest_manager" ${uRole === 'fest_manager' ? 'selected' : ''}>Fest Manager</option>
                <option value="announcer" ${uRole === 'announcer' ? 'selected' : ''}>Announcer</option>
                <option value="admin" ${uRole === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        </div>
    `, async () => {
        const id = document.getElementById('editUserId').value;
        const name = document.getElementById('newFullName').value.trim();
        const username = document.getElementById('newUsername').value.trim();
        const password_hash = document.getElementById('newPassword').value.trim();
        const role = document.getElementById('newUserRole').value;
        
        if (!username || !password_hash || !name) return showToast('Name, Username, and Password are required.', 'error');
        
        setLoading('modalSaveBtn', true);
        
        const payload = { name, username, password_hash, role };
        if (id) payload.id = id;
        
        const { error } = await supabaseClient.from('users').upsert([festPayload(payload)]);
        
        setLoading('modalSaveBtn', false);
        
        if (error) {
            if (error.code === '23505') showToast('Username already taken.', 'error'); 
            else showToast(error.message, 'error');
        } else { 
            showToast(id ? 'Account updated successfully!' : 'Account created successfully!');
            closeModal(); 
            loadUsers(); 
        }
    });
}

async function deleteCategory(id) {
    openConfirmModal("Delete Category?", "This might fail if competitions are linked to it.", async () => {
        try {
            const { error } = await supabaseClient.from('categories').delete().eq('id', id);
            if(error) throw error;
            showToast('Category deleted.');
            loadCategories();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteCompetition(id) {
    openConfirmModal("Delete Competition?", "Are you sure you want to permanently delete this competition?", async () => {
        try {
            const { error } = await supabaseClient.from('competitions').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') {
                    throw new Error('Cannot delete this competition because it has enrolled students or recorded marks. Remove them first.');
                }
                throw error;
            }
            showToast('Competition deleted.');
            loadCompetitions();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteParticipant(id) {
    openConfirmModal("Delete Participant?", "Are you sure you want to delete this participant?", async () => {
        try {
            const { error } = await supabaseClient.from('participants').delete().eq('id', id);
            if(error) throw error;
            showToast('Participant removed.');
            loadParticipants();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteUser(id, username) {
    openConfirmModal("Delete User?", `Delete the user "${username}"? This cannot be undone.`, async () => {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') showToast(`Cannot delete ${username} as they are linked to active records.`, 'error');
                else throw error;
            } else {
                showToast(`User ${username} deleted.`);
                loadUsers();
            }
        } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- CSV BULK UPLOAD EXPORT (PapaParse) ---
async function downloadCSV(tableName) {
    try {
        const { data, error } = await supabaseClient.from(tableName).select('*');
        if (error) throw error;
        
        const csvFileName = typeof getFestFileName === 'function' ? getFestFileName(`${tableName}_export`, 'csv') : `${tableName}_export.csv`;

        if (typeof festosExportCSV === 'function') {
            festosExportCSV(csvFileName, data, `Database Export - ${tableName.toUpperCase()}`);
        } else {
            const blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a"); 
            link.href = URL.createObjectURL(blob); 
            link.setAttribute("download", csvFileName);
            document.body.appendChild(link); 
            link.click(); 
            document.body.removeChild(link);
        }
        showToast('Export successful!');
    } catch(e) { showToast("Export error: " + e.message, 'error'); }
}

function downloadTemplate(type) {
    let headers = [];
    if(type === 'categories') headers = ['name', 'is_general'];
    if(type === 'competitions') headers = ['name', 'max_participants', 'max_mark', 'stage_id', 'category_id'];
    if(type === 'participants') headers = ['name', 'category_id', 'batch_no', 'team_id'];
    
    const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${type}_template.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

async function handleBulkUpload(tableName, fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput.files.length) return showToast("Select a CSV file first.", 'error');
    
    showToast('Parsing CSV...', 'success');
    
    Papa.parse(fileInput.files[0], {
        header: true, skipEmptyLines: true, complete: async function(results) {
            if(!results.data.length) return showToast("No valid rows found in CSV.", 'error');
            
            const cleanData = results.data.map(row => {
                if (row.is_general) row.is_general = (row.is_general.toLowerCase() === 'true');
                if (row.max_participants) row.max_participants = parseInt(row.max_participants);
                if (row.max_mark) row.max_mark = parseFloat(row.max_mark);
                if (row.batch_no) row.batch_no = parseInt(row.batch_no);
                
                // <--- UPDATED LINE BELOW --->
                if (tableName === 'participants' && !row.unique_id) row.unique_id = `${Math.floor(100000 + Math.random() * 900000)}`;
                
                return row;
            });
            
            try {
                const { error } = await supabaseClient.from(tableName).insert(cleanData);
                if(error) throw error;
                showToast(`Success! Imported ${cleanData.length} records.`); 
                switchTab(tableName); 
            } catch(e) {
                showToast(`Upload failed: ${e.message}`, 'error');
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (user && (user.role === 'master_admin' || user.role === 'admin' || user.role === 'super_admin')) {
        const portalMenu = document.getElementById('master-admin-portals');
        if (portalMenu) portalMenu.style.display = 'block';
        
        const dashGreeting = document.getElementById('dash-greeting');
        if(dashGreeting) dashGreeting.innerHTML = `Good evening, <span style="color: #E11D48; font-weight: 800; text-transform: uppercase;">${user.username}</span>`;
    }

    if (user && user.role !== 'master_admin' && user.role !== 'super_admin') {
        const dataCenterTab = document.getElementById('nav-data-center');
        if (dataCenterTab) dataCenterTab.style.display = 'none';
    } else {
        const dataCenterTab = document.getElementById('nav-data-center');
        if (dataCenterTab) dataCenterTab.style.display = 'block';
    }
    
    const activeFid = typeof getActiveFestId === 'function' ? getActiveFestId() : null;
    let cachedBranding = activeFid ? (localStorage.getItem('festos_branding_cache_' + activeFid) || localStorage.getItem('festos_cfg_system_branding_' + activeFid)) : null;
    if (!cachedBranding) {
        const legacyFb = localStorage.getItem('festBranding');
        if (legacyFb) {
            try {
                const bData = JSON.parse(legacyFb);
                if (bData && bData._fest_id === activeFid) cachedBranding = legacyFb;
            } catch(e) {}
        }
    }
    if (cachedBranding) {
        try {
            applyGlobalBranding(JSON.parse(cachedBranding));
        } catch(e) {}
    }
    
    fetchAndApplyBranding(); 
    
    // Automatically boot into the new dashboard
    switchTab('dashboard');
});

async function fetchAndSyncBranding() {
    try {
        const festId = window.festosAuth ? window.festosAuth.getCurrentFestId() : null;
        const val = window.festosGetSetting ? await window.festosGetSetting('system_branding', festId) : null;
        if(val) {
            localStorage.setItem('festBranding', JSON.stringify(val));
            applyGlobalBranding(val);
        } else if (festId && typeof supabaseClient !== 'undefined') {
            const { data: fData } = await supabaseClient.from('fests').select('name, logo').eq('id', festId).maybeSingle();
            if (fData && (fData.name || fData.logo)) {
                const b = { fest_name: fData.name, fest_logo: fData.logo, display_mode: fData.logo ? 'both' : 'name' };
                localStorage.setItem('festBranding', JSON.stringify(b));
                applyGlobalBranding(b);
            }
        }
    } catch(e) {
        console.warn("Could not sync branding", e);
    }
}



// --- ROBUST PARTICIPANT PHOTO HELPER (MOBILE & DESKTOP) ---

// --- BLOB TO BASE64 CONVERTER UTILITY ---
function blobToBase64(blob) {
    return new Promise((resolve) => {
        if (!blob) return resolve(null);
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });
}
window.blobToBase64 = blobToBase64;

async function getParticipantPhotoBlobHelper() {
    // 1. If active cropper instance exists, crop from it
    if (typeof currentCropper !== 'undefined' && currentCropper && typeof currentCropper.getCroppedCanvas === 'function') {
        try {
            const canvas = currentCropper.getCroppedCanvas({ width: 400, height: 600 });
            if (canvas) {
                const b = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
                if (b && b.size > 0) return b;
            }
        } catch(e) {
            console.warn('Cropper getCroppedCanvas failed:', e);
        }
    }

    // 2. If partPhotoPreview src contains a data:image base64 string
    const previewEl = document.getElementById('partPhotoPreview');
    if (previewEl && previewEl.src && previewEl.src.startsWith('data:image/') && !previewEl.src.includes('svg')) {
        try {
            const res = await fetch(previewEl.src);
            const b = await res.blob();
            if (b && b.size > 0) return b;
        } catch(e) {
            console.warn('Preview blob conversion failed:', e);
        }
    }

    // 3. Directly from file input if selected
    const fileInput = document.getElementById('partPhoto');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        return await new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 600;
                    const ctx = canvas.getContext('2d');
                    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
                    const x = (canvas.width / 2) - (img.width / 2) * scale;
                    const y = (canvas.height / 2) - (img.height / 2) * scale;
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                    canvas.toBlob(b => resolve(b), 'image/jpeg', 0.82);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    return null;
}

// --- SMART PORTRAIT AUTO-CROPPING & FACE DETECTION ENGINE ---

let cropperCurrentAspect = 2 / 3;

async function smartDetectFace(imgElement) {
    if (!imgElement) return null;

    // 1. Try Browser Native FaceDetector API (Chromium, Edge, Opera, Samsung Internet, Android WebViews)
    if ('FaceDetector' in window) {
        try {
            const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            const faces = await detector.detect(imgElement);
            if (faces && faces.length > 0) {
                const box = faces[0].boundingBox;
                return {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    confidence: 0.95,
                    method: 'native'
                };
            }
        } catch (e) {
            console.debug('Native FaceDetector fallback to canvas analysis:', e);
        }
    }

    // 2. High-Performance Canvas Skin-Chroma & Feature Saliency Fallback
    try {
        const sampleW = 160;
        const naturalW = imgElement.naturalWidth || imgElement.width || 600;
        const naturalH = imgElement.naturalHeight || imgElement.height || 800;
        const sampleH = Math.round(naturalH * (sampleW / naturalW));

        const canvas = document.createElement('canvas');
        canvas.width = sampleW;
        canvas.height = sampleH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0, sampleW, sampleH);

        const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;

        // Human skin tone bounds in normalized RGB and brightness
        let skinWeightSum = 0;
        let weightedX = 0;
        let weightedY = 0;
        let minX = sampleW, maxX = 0, minY = sampleH, maxY = 0;

        // Scan primarily upper 75% of image (where heads/faces reside in portraits)
        const scanH = Math.round(sampleH * 0.75);

        for (let y = 0; y < scanH; y++) {
            for (let x = 0; x < sampleW; x++) {
                const idx = (y * sampleW + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const sum = r + g + b;

                if (sum > 60 && sum < 720) {
                    const nr = r / sum;
                    const ng = g / sum;

                    // Standard human skin color locus
                    const isSkin = (nr > 0.36 && nr < 0.55) && 
                                   (ng > 0.27 && ng < 0.38) && 
                                   (r > g && g > b) && 
                                   (Math.abs(r - g) > 15);

                    if (isSkin) {
                        // Weight upper-central pixels slightly higher (face prior)
                        const centerDistX = Math.abs(x - (sampleW / 2)) / (sampleW / 2);
                        const weight = 1.0 - (centerDistX * 0.4);

                        skinWeightSum += weight;
                        weightedX += x * weight;
                        weightedY += y * weight;

                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
        }

        const scaleX = naturalW / sampleW;
        const scaleY = naturalH / sampleH;

        if (skinWeightSum > 80 && maxX > minX) {
            const centroidX = (weightedX / skinWeightSum) * scaleX;
            const centroidY = (weightedY / skinWeightSum) * scaleY;
            const rawFaceW = Math.max(80, (maxX - minX) * scaleX * 0.75);
            const rawFaceH = rawFaceW * 1.25;

            return {
                x: Math.max(0, centroidX - rawFaceW / 2),
                y: Math.max(0, centroidY - rawFaceH / 2),
                width: rawFaceW,
                height: rawFaceH,
                confidence: 0.80,
                method: 'chroma'
            };
        }
    } catch(err) {
        console.warn('Fallback face analysis error:', err);
    }

    // 3. Fallback: Upper Third Rule
    const imgW = imgElement.naturalWidth || imgElement.width || 600;
    const imgH = imgElement.naturalHeight || imgElement.height || 800;
    const defW = imgW * 0.45;
    const defH = defW * 1.25;
    return {
        x: (imgW - defW) / 2,
        y: imgH * 0.15,
        width: defW,
        height: defH,
        confidence: 0.50,
        method: 'default'
    };
}

function smartCalculatePortraitCropBox(imgW, imgH, faceBox, targetAspect = 2 / 3) {
    const fx = faceBox ? faceBox.x : ((imgW - imgW * 0.45) / 2);
    const fy = faceBox ? faceBox.y : (imgH * 0.15);
    const fw = faceBox ? faceBox.width : (imgW * 0.45);
    const fh = faceBox ? faceBox.height : (fw * 1.25);

    const faceCenterX = fx + fw / 2;
    const faceCenterY = fy + fh / 2;

    // Headroom & shoulders framing: head takes approx 42% of badge height
    let cropHeight = Math.min(imgH, fh * 2.35);
    let cropWidth = cropHeight * targetAspect;

    if (cropWidth > imgW) {
        cropWidth = imgW;
        cropHeight = cropWidth / targetAspect;
    }

    // Position face center at approx 38% - 42% from top of crop box
    let cropY = faceCenterY - (cropHeight * 0.40);
    let cropX = faceCenterX - (cropWidth / 2);

    cropX = Math.max(0, Math.min(imgW - cropWidth, cropX));
    cropY = Math.max(0, Math.min(imgH - cropHeight, cropY));

    return {
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
    };
}

function setCropperAspect(aspect, btnEl) {
    cropperCurrentAspect = aspect;
    document.querySelectorAll('#cropper-aspect-pills button').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    if (currentCropper) {
        currentCropper.setAspectRatio(aspect);
        applySmartFaceCrop(aspect);
    }
}

async function applySmartFaceCrop(customAspect = null) {
    const aspect = customAspect || cropperCurrentAspect || (2 / 3);
    const cropperImage = document.getElementById('cropperImage');
    const statusEl = document.getElementById('cropper-face-status');
    if (!cropperImage || !currentCropper) return;

    try {
        if (statusEl) {
            statusEl.style.display = 'inline-flex';
            statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting face...';
        }

        const face = await smartDetectFace(cropperImage);
        const naturalW = cropperImage.naturalWidth || cropperImage.width;
        const naturalH = cropperImage.naturalHeight || cropperImage.height;

        const cropBox = smartCalculatePortraitCropBox(naturalW, naturalH, face, aspect);

        currentCropper.setAspectRatio(aspect);
        currentCropper.setData(cropBox);

        if (statusEl) {
            statusEl.style.display = 'inline-flex';
            statusEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Face Framed ✓';
            setTimeout(() => {
                if (statusEl) statusEl.style.display = 'none';
            }, 3000);
        }
    } catch (e) {
        console.warn('Smart face crop error:', e);
        if (statusEl) statusEl.style.display = 'none';
    }
}

async function autoDetectAndCropFaceFromPreview(targetAspect = 2 / 3) {
    const preview = document.getElementById('partPhotoPreview');
    if (!preview || !preview.src || preview.src.includes('svg')) {
        showToast('Please upload a photo first.', 'warning');
        return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async function() {
        try {
            showToast('Detecting face & framing portrait...', 'info');
            const face = await smartDetectFace(img);
            const naturalW = img.naturalWidth || img.width;
            const naturalH = img.naturalHeight || img.height;
            const cropBox = smartCalculatePortraitCropBox(naturalW, naturalH, face, targetAspect);

            const canvas = document.createElement('canvas');
            const targetW = 400;
            const targetH = Math.round(targetW / targetAspect);
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0, targetW, targetH);
            preview.src = canvas.toDataURL('image/jpeg', 0.88);
            showToast('✨ Portrait auto-centered & cropped to badge proportions!', 'success');
        } catch(e) {
            showToast('Could not auto-crop: ' + e.message, 'error');
        }
    };
    img.src = preview.src;
}

// --- CROPPER LIFECYCLE ---

function triggerCropper(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const rawData = e.target.result;
        const img = new Image();
        img.onload = function() {
            // Compress down to avoid mobile memory blowout
            const maxDim = 1200;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const optimized = canvas.toDataURL('image/jpeg', 0.85);

            // Instantly update thumbnail in form so user sees photo immediately
            const preview = document.getElementById('partPhotoPreview');
            if (preview) preview.src = optimized;

            // Launch cropper modal (z-index: 9999) if Cropper is available
            const cropperModal = document.getElementById('cropperModal');
            const cropperImage = document.getElementById('cropperImage');
            if (cropperModal && cropperImage && typeof Cropper !== 'undefined') {
                cropperImage.src = optimized;
                cropperModal.classList.add('show');
                if (currentCropper) {
                    try { currentCropper.destroy(); } catch(err) {}
                }
                currentCropper = new Cropper(cropperImage, {
                    aspectRatio: cropperCurrentAspect || (2 / 3),
                    viewMode: 2,
                    background: false,
                    autoCropArea: 0.85,
                    ready: function () {
                        // Automatically run Smart Face Auto-Crop on load!
                        setTimeout(() => {
                            applySmartFaceCrop(cropperCurrentAspect || (2 / 3));
                        }, 50);
                    }
                });
            }
        };
        img.src = rawData;
    };
    reader.readAsDataURL(file);
}

// Linked to the "Cancel" button on the Cropper Modal
function cancelCropper() {
    const modal = document.getElementById('cropperModal');
    if (modal) modal.classList.remove('show');
    if (currentCropper) {
        try { currentCropper.destroy(); } catch(e) {}
        currentCropper = null;
    }
}

// Linked to the "Apply Crop" button on the Cropper Modal
function confirmCrop() {
    if (currentCropper) {
        const aspect = cropperCurrentAspect || (2 / 3);
        const targetW = 400;
        const targetH = Math.round(targetW / aspect);
        const canvas = currentCropper.getCroppedCanvas({
            width: targetW,
            height: targetH,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        if (canvas) {
            document.getElementById('partPhotoPreview').src = canvas.toDataURL('image/jpeg', 0.88);
            showToast('Photo cropped and saved!', 'success');
        }
    }
    const modal = document.getElementById('cropperModal');
    if (modal) modal.classList.remove('show');
}

// Function to re-crop the currently loaded image without re-uploading
function editExistingCrop() {
    const currentSrc = document.getElementById('partPhotoPreview')?.src || '';
    if (!currentSrc || currentSrc.includes('svg') || currentSrc.includes('via.placeholder.com')) {
        showToast('Please upload a photo first before attempting to crop.', 'error');
        return;
    }
    
    const cropperModal = document.getElementById('cropperModal');
    const image = document.getElementById('cropperImage');
    if (!cropperModal || !image || typeof Cropper === 'undefined') return;
    
    image.src = currentSrc;
    cropperModal.classList.add('show');
    
    if (currentCropper) {
        try { currentCropper.destroy(); } catch(e) {}
    }
    currentCropper = new Cropper(image, {
        aspectRatio: cropperCurrentAspect || (2 / 3),
        viewMode: 2,
        background: false,
        autoCropArea: 0.85,
        ready: function () {
            setTimeout(() => {
                applySmartFaceCrop(cropperCurrentAspect || (2 / 3));
            }, 50);
        }
    });
}

// --- ASSIGNMENTS MANAGEMENT ---
async function loadAssignments() {
    try {
        if (typeof renderAssignOverview === 'function') {
            renderAssignOverview();
        }
        
        const tbody = document.getElementById('assignments-tbody');
        if (!tbody) return; // Active view uses #assign-overview-tbody or #assign-workspace-tbody
        
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`id, participants(name, teams(name), categories(name)), competitions(name)`);
            
        if(error) throw error;
        
        tbody.innerHTML = '';
        
        // 1. Populate Filter Dropdown
        const filterComp = document.getElementById('filterAssignComp');
        if(filterComp && filterComp.options.length === 1 && typeof competitionsList !== 'undefined') {
            competitionsList.forEach(c => filterComp.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // 2. Generate Rows with Checkboxes
        (data || []).forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${row.id}"></td>
                    <td>${row.participants?.name}</td>
                    <td>${row.participants?.teams?.name || 'Unassigned'}</td>
                    <td>${row.competitions?.name}</td>
                    <td>${row.participants?.categories?.name}</td>
                    <td>
                        <button class="btn btn-danger" onclick="deleteAssignment('${row.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { showToast(e.message, 'error'); }
}

// --- ASSIGNMENTS & BULK ASSIGNMENTS FIX ---
async function openAssignModal() {
    // FORCE data load if lists are empty
    if (participantsList.length === 0) {
        const { data } = await supabaseClient.from('participants').select('*').order('name');
        participantsList = data || [];
    }
    if (competitionsList.length === 0) {
        const { data } = await supabaseClient.from('competitions').select('*').order('name');
        competitionsList = data || [];
    }

    let partOpts = participantsList.map(p => `<option value="${p.id}">${p.name} (${p.unique_id})</option>`).join('');
    let compOpts = competitionsList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    openModal('Assign Student to Competition', `
        <div class="form-group">
            <label>Select Participant</label>
            <select id="assignPart">
                <option value="">-- SELECT PARTICIPANT --</option>
                ${partOpts}
            </select>
        </div>
        <div class="form-group">
            <label>Select Competition</label>
            <select id="assignComp">
                <option value="">-- SELECT COMPETITION --</option>
                ${compOpts}
            </select>
        </div>
    `, async () => {
        const participant_id = document.getElementById('assignPart').value;
        const competition_id = document.getElementById('assignComp').value;
        
        if (!participant_id || !competition_id) return showToast('Please select both a participant and a competition.', 'error');

        setLoading('modalSaveBtn', true);
        try {
            const limitCfg = await getCategoryLimitConfig();
            if (limitCfg && limitCfg.enabled) {
                const { data: existingAssigns } = await festQuery(
                    supabaseClient.from('participant_competitions')
                        .select('participant_id, competition_id')
                        .eq('participant_id', participant_id)
                );
                const check = festosEvaluateStudentCategoryLimit(
                    participant_id,
                    competition_id,
                    participantsList,
                    competitionsList,
                    categoriesList,
                    existingAssigns || [],
                    limitCfg
                );
                if (!check.allowed) {
                    throw new Error(check.message);
                }
            }

            const { error } = await supabaseClient.from('participant_competitions').insert(festPayload([{ participant_id, competition_id }]));
            if (error) {
                if (error.code === '23505') throw new Error('Student is already assigned to this competition!');
                throw error;
            }
            showToast('Student Assigned!'); 
            closeModal(); 
            loadAssignments();
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setLoading('modalSaveBtn', false);
        }
    });
}
// --- UNIVERSAL TABLE CONTROLS ---
function filterTable(tbodyId, query) {
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    query = query.toLowerCase();
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function filterTableByColumn(tbodyId, colIndex, value) {
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    value = value.toLowerCase();
    rows.forEach(row => {
        const cellText = row.cells[colIndex].innerText.toLowerCase();
        if (value === "" || cellText.includes(value)) row.style.display = '';
        else row.style.display = 'none';
    });
}

const globalSelections = {
    'categories-tbody': new Set(),
    'competitions-tbody': new Set(),
    'participants-tbody': new Set(),
    'points-tbody': new Set(),
    'assign-workspace-tbody': new Set()
};

function handleRowSelection(tbodyId, value, isChecked) {
    if (!globalSelections[tbodyId]) globalSelections[tbodyId] = new Set();
    if (isChecked) globalSelections[tbodyId].add(value);
    else globalSelections[tbodyId].delete(value);
}

function clearSelection(tbodyId) {
    if (globalSelections[tbodyId]) globalSelections[tbodyId].clear();
    const masterCb = document.querySelector(`#${tbodyId}`)?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if (masterCb) masterCb.checked = false;
    
    // Uncheck DOM elements if any are still visible
    document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`).forEach(cb => cb.checked = false);
}

function toggleSelectAll(tbodyId, masterCheckbox) {
    const checkboxes = document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`);
    checkboxes.forEach(cb => {
        if (cb.closest('tr').style.display !== 'none') {
            cb.checked = masterCheckbox.checked;
            handleRowSelection(tbodyId, cb.value, masterCheckbox.checked);
        }
    });
}

function getSelectedIds(tbodyId) {
    // Fallback sync for manually checked DOM items just in case
    const domChecked = Array.from(document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb:checked`)).map(cb => cb.value);
    domChecked.forEach(val => handleRowSelection(tbodyId, val, true));
    return Array.from(globalSelections[tbodyId] || []);
}

// --- BULK ACTION LOGIC ---


async function openBulkAssignModal() {
    const ids = getSelectedIds('participants-tbody');
    if(ids.length === 0) return showToast('Select participants to assign first.', 'error');

    // Ensure competitions list is loaded
    if (competitionsList.length === 0) {
        const { data } = await supabaseClient.from('competitions').select('*').order('name');
        competitionsList = data || [];
    }

    let compOpts = competitionsList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    openModal('Bulk Assign to Competition', `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--primary-light); border-radius: 8px; color: var(--primary); font-weight: 600;">
            <i class="fa-solid fa-users"></i> ASSIGNING ${ids.length} SELECTED PARTICIPANT(S).
        </div>
        <div class="form-group">
            <label>Select Competition</label>
            <select id="bulkAssignComp">
                <option value="">-- SELECT COMPETITION --</option>
                ${compOpts}
            </select>
        </div>
    `, async () => {
        const competition_id = document.getElementById('bulkAssignComp').value;
        if (!competition_id) return showToast('Select a competition.', 'error');

        const inserts = ids.map(participant_id => ({ participant_id, competition_id }));
        
        setLoading('modalSaveBtn', true);
        try {
            const limitCfg = await getCategoryLimitConfig();
            if (limitCfg && limitCfg.enabled) {
                const { data: existingAssigns } = await festQuery(
                    supabaseClient.from('participant_competitions')
                        .select('participant_id, competition_id')
                        .in('participant_id', ids)
                );
                for (const pId of ids) {
                    const check = festosEvaluateStudentCategoryLimit(
                        pId,
                        competition_id,
                        participantsList,
                        competitionsList,
                        categoriesList,
                        existingAssigns || [],
                        limitCfg
                    );
                    if (!check.allowed) {
                        throw new Error(check.message);
                    }
                }
            }

            const { error } = await supabaseClient.from('participant_competitions').insert(festPayload(inserts));
            if (error) {
                if (error.code === '23505') throw new Error('One or more selected participants are already assigned here.');
                throw error;
            }
            
            showToast(`Successfully assigned ${ids.length} participants!`); 
            closeModal(); 
            
            // Uncheck the boxes and flip to assignments tab to see results
clearSelection('participants-tbody');
            switchTab('assignments');
        } catch (e) { 
            showToast(e.message, 'error'); 
        } finally {
            setLoading('modalSaveBtn', false);
        }
    });
}

// --- NEW ASSIGNMENT WORKSPACE LOGIC ---
let currentAssignCompLimit = 0;
let currentAssignEnrolled = 0;
let currentEnrolledStudentIds = []; // Tracks who is already assigned

async function initAssignWorkspace() {
    if (typeof window.initAssignWorkspace === 'function') {
        return await window.initAssignWorkspace();
    }
}


async function loadAssignWorkspaceStudents() {
    const catSelect = document.getElementById('assignWorkCategory');
    const compSelect = document.getElementById('assignWorkComp');
    const workspace = document.getElementById('assignStudentWorkspace');
    const tbody = document.getElementById('assign-workspace-tbody');
    
    const categoryId = catSelect.value;
    const compId = compSelect.value;

    if (!compId) {
        workspace.style.display = 'none';
        return;
    }

    const comp = (competitionsList || []).find(c => String(c.id) === String(compId));
    const compCat = (categoriesList || []).find(c => String(c.id) === String(categoryId || comp?.category_id)) || comp?.categories;
    const isGeneral = compCat ? (compCat.is_general === true || String(compCat.is_general) === 'true') : (catSelect.options[catSelect.selectedIndex]?.getAttribute('data-general') === 'true');

    currentAssignCompLimit = comp?.max_participants ?? (parseInt(compSelect.options[compSelect.selectedIndex]?.getAttribute('data-limit')) || 0);
    
    // NEW: Capture if the selected competition is a group event
    const isGroupComp = comp ? !!comp.is_group : (compSelect.options[compSelect.selectedIndex]?.getAttribute('data-is-group') === 'true');

    workspace.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading students...</td></tr>';

    try {
        const limitDisplay = document.getElementById('assignLimitIndicator');
        limitDisplay.innerHTML = `<i class="fa-solid fa-users"></i> Max Enrollment: ${currentAssignCompLimit} Participants Per Team`;
        
        // --- Calculate Allowed Categories for General or Standard ---
        let allowedCatIds = [String(categoryId)]; 
        if (isGeneral && typeof categoriesList !== 'undefined') {
            categoriesList.forEach(c => {
                let rawAllowed = c.allowed_general_categories;
                let allowed = [];
                try {
                    if (typeof rawAllowed === 'string') allowed = JSON.parse(rawAllowed);
                    else if (Array.isArray(rawAllowed)) allowed = rawAllowed;
                } catch(e) {}
                if (allowed.some(id => String(id) === String(categoryId))) {
                    allowedCatIds.push(String(c.id));
                }
            });
        }
        
        let studentQuery = festQuery(supabaseClient.from('participants').select('*, teams(name)'));
        if (!isGeneral) {
            studentQuery = studentQuery.eq('category_id', categoryId);
        } else {
            studentQuery = studentQuery.in('category_id', allowedCatIds);
        }

        const { data: students, error: studentError } = await studentQuery.order('name');
        if (studentError) throw studentError;

        // UPDATED: Now fetches is_leader as well
        const { data: enrollments, error: enrollError } = await supabaseClient
            .from('participant_competitions')
            .select('participant_id, is_leader')
            .eq('competition_id', compId);
        if (enrollError) throw enrollError;

        currentEnrolledStudentIds = (enrollments || []).map(e => e.participant_id);
        
        // NEW: Update table header dynamically based on competition type
        document.querySelector('#assign-workspace-tbody').parentElement.querySelector('thead tr').innerHTML = `
            <th class="checkbox-cell"><input type="checkbox" onchange="toggleSelectAll('assign-workspace-tbody', this)"></th>
            <th>Unique ID</th>
            <th>Participant Name</th>
            <th>Team</th>
            <th>DOB</th>
            <th>${isGroupComp ? 'Group Role' : 'Current Status'}</th>
        `;

        tbody.innerHTML = '';
        (students || []).forEach(s => {
            const enrollmentRecord = (enrollments || []).find(e => e.participant_id === s.id);
            const isAssigned = !!enrollmentRecord;
            
            let statusBadge = '';
            
            // NEW: Render UI based on group status and assignment
            if (isGroupComp) {
                if (isAssigned) {
                    statusBadge = enrollmentRecord.is_leader 
                        ? '<span class="badge" style="background:var(--primary); color:white;">LEADER</span>' 
                        : '<span class="badge" style="background:#E2E8F0; color:#475569;">PARTY</span>';
                } else {
                    // Radio button allows picking one leader per team
                    statusBadge = `<label style="cursor:pointer; font-size:0.8rem; font-weight:700; color:var(--text-muted); display:flex; align-items:center; gap:0.25rem;"><input type="radio" name="leader_${s.team_id}" value="${s.id}" class="leader-radio" style="width:14px; height:14px; accent-color: var(--primary);"> Set Leader</label>`;
                }
            } else {
                statusBadge = isAssigned 
                    ? '<span class="badge" style="background:var(--success); color:white;">ASSIGNED</span>'
                    : '<span class="badge" style="background:#E2E8F0; color:#475569;">UNASSIGNED</span>';
            }

            // Display Student Category Limit Badge if active
            let limitBadge = '';
            if (!isGroupComp && window.cachedCategoryLimitConfig && window.cachedCategoryLimitConfig.enabled && !isGeneral) {
                const catCfg = (window.cachedCategoryLimitConfig.categories && window.cachedCategoryLimitConfig.categories[categoryId]) || {};
                const maxL = catCfg.custom ? catCfg.limit : (window.cachedCategoryLimitConfig.default_limit || 3);
                
                // Count individual category assignments for this student
                let enrolledInCat = (window.globalAdminAssignments || [])
                    .filter(a => String(a.participant_id) === String(s.id))
                    .filter(a => {
                        const c = competitionsList.find(comp => String(comp.id) === String(a.competition_id));
                        return c && !c.is_group && !c.is_common && String(c.category_id) === String(categoryId);
                    }).length;
                
                if (isAssigned && enrolledInCat === 0) enrolledInCat = 1;

                if (enrolledInCat >= maxL && !isAssigned) {
                    limitBadge = ` <span class="badge" style="background:#FEE2E2; color:#DC2626; font-weight:800; font-size:0.7rem;" title="Category limit reached (${enrolledInCat}/${maxL})"><i class="fa-solid fa-ban"></i> Max (${enrolledInCat}/${maxL})</span>`;
                } else {
                    limitBadge = ` <span class="badge" style="background:#F1F5F9; color:#475569; font-size:0.7rem;">${enrolledInCat}/${maxL} Comps</span>`;
                }
            }
                
            tbody.innerHTML += `
                <tr data-team="${s.team_id || ''}" data-dob="${s.dob || ''}">
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${s.id}" ${globalSelections['assign-workspace-tbody']?.has(s.id) ? 'checked' : ''} onchange="handleRowSelection('assign-workspace-tbody', this.value, this.checked)"></td>
                    <td style="font-family: monospace; font-weight: 600;">${s.unique_id}</td>
                    <td class="searchable-name">${s.name}${limitBadge}</td>
                    <td>${s.teams?.name || 'INDEPENDENT'}</td>
                    <td>${s.dob || 'N/A'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
        
        // Re-apply any active search/filter rules
        if (typeof filterAssignTable === 'function') filterAssignTable();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Local Table Filter (Search, Team, DOB, Status)
function filterAssignTable() {
    const searchVal = document.getElementById('assignSearch').value.toLowerCase();
    const teamVal = document.getElementById('assignFilterTeam').value;
    const dobVal = document.getElementById('assignFilterDob').value;
    const statusVal = document.getElementById('assignFilterStatus').value; 
    
    const rows = document.querySelectorAll('#assign-workspace-tbody tr');

    rows.forEach(row => {
        if(row.children.length === 1) return; // Skip "Loading..." row
        
        // Grab values from the row attributes and cells
        const text = row.querySelector('.searchable-name').innerText.toLowerCase() + " " + row.cells[1].innerText.toLowerCase();
        const rowTeam = row.getAttribute('data-team');
        const rowDob = row.getAttribute('data-dob');

        // Dynamically determine the row's assignment status based on the badge text in the last cell
        const statusText = row.cells[5].innerText.toLowerCase();
        let rowStatus = 'unassigned';
        if (statusText.includes('assigned') && !statusText.includes('unassigned') || statusText.includes('leader') || statusText.includes('party')) {
            rowStatus = 'assigned';
        }

        // Evaluate all filter conditions
        const matchSearch = text.includes(searchVal);
        const matchTeam = teamVal === "" || rowTeam === teamVal;
        const matchDob = dobVal === "" || rowDob === dobVal;
        const matchStatus = statusVal === "" || rowStatus === statusVal; 

        // Hide or show row based on ALL conditions matching
        row.style.display = (matchSearch && matchTeam && matchDob && matchStatus) ? '' : 'none';
    });
}

async function executeWorkspaceAssign() {
    const compSelect = document.getElementById('assignWorkComp');
    const compId = compSelect.value;
    const isGroupComp = compSelect.options[compSelect.selectedIndex].getAttribute('data-is-group') === 'true';
    const ids = getSelectedIds('assign-workspace-tbody');
    
    if (ids.length === 0) return showToast('Select at least one student.', 'error');
    
    const newIds = ids.filter(id => !currentEnrolledStudentIds.includes(id));
    if (newIds.length === 0) return showToast('Selected students are already assigned.', 'error');

    setLoading('btnWorkspaceAssign', true);

    try {
        const { data: newStudents, error: studentError } = await supabaseClient.from('participants').select('id, team_id').in('id', newIds);
        if (studentError) throw studentError;

        // --- NEW: STRICT LIMIT CHECK PER TEAM ---
        if (currentAssignCompLimit > 0) {
            // Fetch existing enrollments to count current team assignments
            const { data: existing, error: existErr } = await supabaseClient
                .from('participant_competitions')
                .select('participant_id, participants(team_id)')
                .eq('competition_id', compId);
            
            if (existErr) throw existErr;

            const teamCounts = {};
            (existing || []).forEach(e => {
                const tId = e.participants?.team_id || 'INDEPENDENT';
                teamCounts[tId] = (teamCounts[tId] || 0) + 1;
            });

            // Count how many new ones we are trying to add per team
            const newTeamCounts = {};
            newStudents.forEach(s => {
                const tId = s.team_id || 'INDEPENDENT';
                newTeamCounts[tId] = (newTeamCounts[tId] || 0) + 1;
            });

            // Verify limits
            for (const [tId, count] of Object.entries(newTeamCounts)) {
                const current = teamCounts[tId] || 0;
                if (current + count > currentAssignCompLimit) {
                    const teamName = teamsList.find(t => t.id === tId)?.name || 'INDEPENDENT';
                    throw new Error(`Limit Exceeded for team '${teamName}'! Max ${currentAssignCompLimit} participants allowed per team. (Currently enrolled: ${current}, Trying to add: ${count})`);
                }
            }
        }
        // --- END TEAM LIMIT CHECK ---

        // --- STUDENT CATEGORY COMPETITION LIMIT CHECK ---
        const limitCfg = await getCategoryLimitConfig();
        if (limitCfg && limitCfg.enabled && !isGroupComp) {
            const targetCompObj = competitionsList.find(c => String(c.id) === String(compId));
            const targetCatObj = categoriesList.find(c => String(c.id) === String(categoryId));
            const isExempt = (targetCompObj && targetCompObj.is_group) || (targetCompObj && targetCompObj.is_common) || (targetCatObj && targetCatObj.is_general);

            if (!isExempt) {
                const { data: allStudentAssigns } = await festQuery(
                    supabaseClient.from('participant_competitions')
                        .select('participant_id, competition_id')
                        .in('participant_id', newIds)
                );

                for (const student of newStudents) {
                    const check = festosEvaluateStudentCategoryLimit(
                        student.id,
                        compId,
                        newStudents,
                        competitionsList,
                        categoriesList,
                        allStudentAssigns || [],
                        limitCfg
                    );
                    if (!check.allowed) {
                        throw new Error(check.message);
                    }
                }
            }
        }
        // --- END STUDENT CATEGORY LIMIT CHECK ---

        // Group the new students by team for group leader mapping
        const teamsGrouping = {};
        newStudents.forEach(student => {
             const tId = student.team_id || 'INDEPENDENT';
             if(!teamsGrouping[tId]) teamsGrouping[tId] = [];
             teamsGrouping[tId].push(student.id);
        });

        const inserts = [];
        for (const [tId, studentIds] of Object.entries(teamsGrouping)) {
             // Generate a unique Group ID based on the Team + Comp + Timestamp
             const groupId = isGroupComp ? `GRP_${compId}_${tId}_${Date.now()}` : null;
             
             // Check if a leader was selected for this team's group
             let leaderId = null;
             if (isGroupComp) {
                  const leaderRadio = document.querySelector(`input[name="leader_${tId}"]:checked`);
                  if (leaderRadio) leaderId = leaderRadio.value;
             }

             studentIds.forEach(pId => {
                 inserts.push({
                     participant_id: pId,
                     competition_id: compId,
                     group_id: groupId,
                     is_leader: isGroupComp ? (pId === leaderId) : false
                 });
             });
        }

        const { error } = await supabaseClient.from('participant_competitions').insert(festPayload(inserts));
        if (error) throw error;
        
        showToast(`Successfully assigned ${newIds.length} students!`);
        clearSelection('assign-workspace-tbody');
        loadAssignWorkspaceStudents(); 

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('btnWorkspaceAssign', false);
    }
}

async function bulkDelete(tableName, tbodyId) {
    const ids = getSelectedIds(tbodyId);
    if(ids.length === 0) return showToast('No rows selected', 'error');
    
    openConfirmModal("Bulk Delete?", `Are you sure you want to permanently delete ${ids.length} selected items?`, async () => {
        try {
            const { error } = await supabaseClient.from(tableName).delete().in('id', ids);
            if (error) throw error;
            
            showToast(`Successfully deleted ${ids.length} items`);
            clearSelection(tbodyId);
            
            if(tableName === 'categories') loadCategories();
            if(tableName === 'competitions') loadCompetitions();
            if(tableName === 'participants') loadParticipants();
            if(tableName === 'participant_competitions') loadAssignments();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function bulkRevokeTeam() {
    const participantIds = getSelectedIds('participants-tbody');
    if (participantIds.length === 0) return showToast('Select at least one participant.', 'error');
    
    openConfirmModal("Revoke Teams?", `Are you sure you want to remove ${participantIds.length} participants from their teams?`, async () => {
        try {
            const { error } = await supabaseClient.from('participants').update({ team_id: null }).in('id', participantIds);
            if (error) throw error;
            showToast('Teams revoked successfully.');
            clearSelection('participants-tbody');
            loadParticipants();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function executeWorkspaceRemove() {
    const compId = document.getElementById('assignWorkComp').value;
    const ids = getSelectedIds('assign-workspace-tbody');
    
    if (ids.length === 0) return showToast('Select at least one student.', 'error');
    
    const assignedIds = ids.filter(id => currentEnrolledStudentIds.includes(id));
    if (assignedIds.length === 0) return showToast('None of the selected students are currently assigned.', 'error');

    openConfirmModal("Remove Students?", `Remove ${assignedIds.length} students from this competition?`, async () => {
        setLoading('btnWorkspaceRemove', true);
        try {
            const { error } = await supabaseClient.from('participant_competitions')
                .delete().eq('competition_id', compId).in('participant_id', assignedIds);
            if (error) throw error;
            
            showToast(`Removed ${assignedIds.length} students.`);
            document.querySelector('#assign-workspace-tbody').previousElementSibling.querySelector('input[type="checkbox"]').checked = false;
            loadAssignWorkspaceStudents();
        } catch (e) { showToast(e.message, 'error'); } 
        finally { setLoading('btnWorkspaceRemove', false); }
    });
}

// Export Full Assignment Data to CSV
async function exportAssignmentsCSV() {
    try {
        const { data, error } = await festQuery(supabaseClient
            .from('participant_competitions')
            .select(`participants(name, unique_id, teams(name), categories(name)), competitions(name)`));
            
        if(error) throw error;
        
        // Flatten the nested JSON for CSV format
        const flatData = (data || []).map(row => ({
            "UNIQUE ID": row.participants?.unique_id || 'N/A',
            "STUDENT NAME": row.participants?.name || 'N/A',
            "TEAM": row.participants?.teams?.name || 'INDEPENDENT',
            "CATEGORY": row.participants?.categories?.name || 'N/A',
            "COMPETITION": row.competitions?.name || 'N/A'
        }));

        const csvFileName = typeof getFestFileName === 'function' ? getFestFileName('Assignments_Data', 'csv') : 'Fest_Assignments_Data.csv';

        if (typeof festosExportCSV === 'function') {
            festosExportCSV(csvFileName, flatData, 'Participant Stage Assignments Register');
        } else {
            const blob = new Blob([Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a"); 
            link.href = URL.createObjectURL(blob); 
            link.setAttribute("download", csvFileName);
            document.body.appendChild(link); 
            link.click(); 
            document.body.removeChild(link);
        }
        showToast('CSV Exported Successfully!');
    } catch (e) { showToast(e.message, 'error'); }
}

// Generate a Branded Premium PDF Document
async function exportAssignmentsPDF() {
    showToast('Generating Premium PDF...', 'success');
    try {
        // Updated query to fetch both student category and competition category
        const { data, error } = await festQuery(supabaseClient
            .from('participant_competitions')
            .select(`participants(name, unique_id, teams(name), categories(name)), competitions(name, categories(name))`))
            .order('competition_id');
            
        if(error) throw error;

        // Group data by Competition and its Category for a clean layout
        const grouped = {};
        (data || []).forEach(row => {
            const compName = row.competitions?.name || 'Unknown Competition';
            const compCat = row.competitions?.categories?.name || 'General Category';
            const key = `${compName}_${compCat}`; // Composite key to keep them distinct
            
            if(!grouped[key]) {
                grouped[key] = {
                    name: compName,
                    category: compCat,
                    students: []
                };
            }
            grouped[key].students.push(row.participants);
        });

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Master Assignment Ledger');

        for (const key in grouped) {
            const compData = grouped[key];
            
            // Added Student Category to the rows
            let tableRows = compData.students.map((s, index) => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace;">${s?.unique_id || 'N/A'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${s?.name || 'UNKNOWN'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${s?.teams?.name || 'INDEPENDENT'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${s?.categories?.name || 'N/A'}</td>
                </tr>
            `).join('');

            // Added Competition Category to Header & Student Category to Table Head
            container.innerHTML += `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <h3 style="background: #1E293B; color: white; padding: 12px; border-radius: 8px 8px 0 0; margin: 0; font-size: 14px; text-transform: uppercase;">
                        ${compData.name} <span style="font-size: 11px; color: #94A3B8; margin-left: 8px; font-weight: 600;">(${compData.category})</span>
                        <span style="float:right; font-weight: normal; font-size: 12px;">${compData.students.length} ENROLLED</span>
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                        <thead>
                            <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                                <th style="padding: 10px;">#</th>
                                <th style="padding: 10px;">ID</th>
                                <th style="padding: 10px;">NAME</th>
                                <th style="padding: 10px;">TEAM</th>
                                <th style="padding: 10px;">STUDENT CATEGORY</th>
                            </tr>
                        </thead>
                        <tbody style="font-size: 12px; color: #334155;">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const opt = { 
            margin: 10, 
            filename: typeof getFestFileName === 'function' ? getFestFileName('Assignments_Ledger', 'pdf') : `Fest_Assignments_Ledger.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}
// ============================================================================
// PDF ID CARD GENERATION ENGINE (TEMPLATE BASED)
// ============================================================================

// --- HELPER: Promise-based image loader ---
function loadImagePromise(src) {
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // Return null if broken to prevent canvas crash
        img.src = src;
    });
}

// --- CORE GENERATOR: Draws the participant data onto the Cloud Template ---
async function generateParticipantIDCanvas(participant, template) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Load Background
    const bgImg = await loadImagePromise(template.bg_base64);
    canvas.width = bgImg.naturalWidth;
    canvas.height = bgImg.naturalHeight;
    ctx.drawImage(bgImg, 0, 0);

    const mappedData = {
        'ParticipantName': participant.name.toUpperCase(),
        // <--- UPDATED LINE BELOW --->
        'UniqueID': participant.unique_id || `${participant.id.substring(0,6)}`.toUpperCase(),
        'TeamName': participant.teams?.name?.toUpperCase() || 'INDEPENDENT',
        'Category': participant.categories?.name?.toUpperCase() || '',
        'Class': participant.class_name?.toUpperCase() || '',
        'ClassName': participant.class_name?.toUpperCase() || '',
        'DateOfBirth': participant.dob || ''
    };

    for (const [key, field] of Object.entries(template.fields)) {
        if (!field.enabled) continue;

        if (field.isImage) {
            // Render Participant Photo
            if (key === 'Photo') {
                const photoSrc = participant.photo_url || null; // Removed external URL dependency
                let pPhoto = null;
                
                if (photoSrc) {
                    pPhoto = await loadImagePromise(photoSrc);
                }
                
                ctx.save();
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(field.x, field.y, field.w, field.h, field.radius || 0);
                else ctx.rect(field.x, field.y, field.w, field.h);
                ctx.clip();
                
                // If image successfully loaded, draw it
                if (pPhoto && pPhoto.naturalWidth > 0) {
                    ctx.drawImage(pPhoto, field.x, field.y, field.w, field.h);
                } else {
                    // Native Canvas Fallback (No external URL needed)
                    ctx.fillStyle = "#E2E8F0"; // Light gray background
                    ctx.fillRect(field.x, field.y, field.w, field.h);
                    
                    ctx.fillStyle = "#94A3B8"; // Slate text color
                    ctx.font = "bold 24px Inter, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("NO PHOTO", field.x + (field.w / 2), field.y + (field.h / 2));
                }
                
                ctx.restore();
            }
            
            // Render QR Code
            if (key === 'QRCode') {
                const qrContainer = document.createElement('div');
                // Create QR with the unique ID
                new QRCode(qrContainer, { 
                    text: participant.unique_id, 
                    width: field.w, 
                    height: field.h,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H 
                });
                
                // Give QRCode.js a tiny fraction of a second to render to its internal canvas
                await new Promise(r => setTimeout(r, 50)); 
                const qrCanvas = qrContainer.querySelector('canvas');
                if(qrCanvas) {
                    ctx.drawImage(qrCanvas, field.x, field.y, field.w, field.h);
                }
            }
        } 
        else {
           // Render Typography
            const textToDraw = field.isCustom ? field.displayName : (mappedData[key] || "");
            if (!textToDraw) continue;

            ctx.textAlign = field.align;
            ctx.fillStyle = field.color;
            ctx.font = `${field.weight || 'bold'} ${field.size}px ${field.font}`;
            renderCanvasText(ctx, textToDraw, field);
        }
    }

    return canvas;
}

// Helper function to dynamically calculate PDF size to prevent stretching
function getDynamicPdfConfig(canvas, baseWidthMm = 63.5) {
    // Calculates perfect height based on the uploaded template's aspect ratio
    const calculatedHeightMm = (canvas.height * baseWidthMm) / canvas.width;
    return {
        width: baseWidthMm,
        height: calculatedHeightMm,
        orientation: baseWidthMm > calculatedHeightMm ? 'landscape' : 'portrait'
    };
}
window.generateParticipantIDCanvas = generateParticipantIDCanvas;
window.getDynamicPdfConfig = getDynamicPdfConfig;
// --- 1. SINGLE CARD GENERATOR ---
async function generateSingleCard(participantId) {
    showToast('Fetching template and generating PDF...', 'success');
    try {
        const { data: templates } = await supabaseClient.from('templates').select('*').eq('type', 'id_card').limit(1);
        if (!templates || templates.length === 0) return showToast("No ID Card template found! Create one in the Studio first.", "error");
        
        const { data: p, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').eq('id', participantId).single();
        if (error || !p) return showToast("Could not fetch participant data.", 'error');
        
        const cardCanvas = await generateParticipantIDCanvas(p, templates[0]);
        const imgData = cardCanvas.toDataURL('image/jpeg', 1.0);
        
        // Dynamically calculate size to prevent stretching!
        const pdfConfig = getDynamicPdfConfig(cardCanvas);
        const pdf = new jspdf.jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
        pdf.save(`${p.name}_ID_Card.pdf`);
        
        showToast('PDF Downloaded!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// --- 2. BULK PRINT SELECTED ---
async function bulkPrintSelected() {
    const ids = getSelectedIds('participants-tbody');
    if (ids.length === 0) return showToast('No participants selected', 'error');

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; 
    btn.disabled = true;

    try {
        const { data: templates } = await supabaseClient.from('templates').select('*').eq('type', 'id_card').limit(1);
        if (!templates || templates.length === 0) throw new Error("No ID Card template found! Create one in the Studio first.");
        const template = templates[0];

        const { data: participants, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').in('id', ids).order('name');
        if (error) throw error;
        
        let pdf = null;
        let pdfConfig = null;

        for (let i = 0; i < participants.length; i++) {
            const cardCanvas = await generateParticipantIDCanvas(participants[i], template);
            const imgData = cardCanvas.toDataURL('image/jpeg', 0.95);
            
            // Initialize PDF config only on the first iteration to get the exact ratio
            if (!pdfConfig) {
                pdfConfig = getDynamicPdfConfig(cardCanvas);
                pdf = new jspdf.jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < participants.length - 1) pdf.addPage();
        }

        pdf.save("Selected_ID_Cards.pdf");
        showToast('Selected PDFs Generated Successfully!');
        
    } catch (e) { 
        showToast(e.message, 'error'); 
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false;
    }
}
// --- 3. GENERATE ALL BULK CARDS ---
async function generateBulkCards() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; 
    btn.disabled = true;

    try {
        const { data: templates } = await supabaseClient.from('templates').select('*').eq('type', 'id_card').limit(1);
        if (!templates || templates.length === 0) throw new Error("No ID Card template found! Create one in the Studio first.");
        const template = templates[0];

        const { data: participants, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').order('name');
        if (error) throw error;
        if (!participants || !participants.length) throw new Error("No participants found.");

        showToast(`Rendering ${participants.length} cards. This may take a minute...`, 'success');

        let pdf = null;
        let pdfConfig = null;

        for (let i = 0; i < participants.length; i++) {
            const cardCanvas = await generateParticipantIDCanvas(participants[i], template);
            const imgData = cardCanvas.toDataURL('image/jpeg', 0.85); // Slightly compressed for massive bulk exports
            
            // Initialize PDF config based on actual image ratio
            if (!pdfConfig) {
                pdfConfig = getDynamicPdfConfig(cardCanvas);
                pdf = new jspdf.jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < participants.length - 1) pdf.addPage();
        }

        pdf.save("FestOS_All_ID_Cards.pdf");
        showToast('Bulk PDF Generated Successfully!');

    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false; 
    }
}
// --- PREMIUM POSTER TEMPLATE ENGINE ---

let activeTemplateType = 'individual';
let activeInputField = null; // Tracks which input the user is currently targeting

// Global State to hold images and coordinates in memory
let templateData = {
    individual: { bgImage: new Image(), fields: ['Result Number', 'Category', 'Competition', 'Position 1 Name', 'Position 2 Name', 'Position 3 Name', 'Team Name'], coords: {} },
    team: { bgImage: new Image(), fields: ['Results Count Text', 'Team 1 Name', 'Team 1 Points', 'Team 2 Name', 'Team 2 Points'], coords: {} },
    final: { bgImage: new Image(), fields: ['Total Competitions Count', 'Final Champion Team', 'Champion Points'], coords: {} }
};

// Simulated mock data to render on the preview canvas
const previewMockData = {
    'ResultNumber': '#42', 'Category': 'GENERAL', 'Competition': 'DANCE OFF',
    'Position1Name': 'JOHN DOE', 'Position2Name': 'JANE SMITH', 'Position3Name': 'MIKE TYSON',
    'TeamName': 'FALCONS', 'ResultsCountText': 'RESULTS AFTER 40',
    'Team1Name': 'FALCONS', 'Team1Points': '450', 'Team2Name': 'EAGLES', 'Team2Points': '380',
    'TotalCompetitionsCount': 'FINAL RESULTS - 120', 'FinalChampionTeam': 'FALCONS', 'ChampionPoints': '1250'
};

function loadTemplateConfig() {
    activeTemplateType = document.getElementById('template-type-select').value;
    const fieldsContainer = document.getElementById('alignment-fields');
    fieldsContainer.innerHTML = '';
    
    const config = templateData[activeTemplateType];

    config.fields.forEach(field => {
        const fieldKey = field.replace(/\s+/g, ''); // e.g., 'Position1Name'
        
        // Initialize defaults if empty
        if (!config.coords[fieldKey]) config.coords[fieldKey] = { x: 100, y: 150 };

        fieldsContainer.innerHTML += `
            <div style="background: white; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <label style="font-weight: 700; display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">${field}</label>
                <div style="display: flex; gap: 0.75rem;">
                    <div style="flex: 1; position: relative;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">X</span>
                        <input type="number" id="x-${fieldKey}" value="${config.coords[fieldKey].x}" onfocus="setActiveField('${fieldKey}')" oninput="updateCoordsFromInput('${fieldKey}')" style="width: 100%; padding: 0.65rem 0.65rem 0.65rem 1.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); outline: none;">
                    </div>
                    <div style="flex: 1; position: relative;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">Y</span>
                        <input type="number" id="y-${fieldKey}" value="${config.coords[fieldKey].y}" onfocus="setActiveField('${fieldKey}')" oninput="updateCoordsFromInput('${fieldKey}')" style="width: 100%; padding: 0.65rem 0.65rem 0.65rem 1.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); outline: none;">
                    </div>
                </div>
            </div>
        `;
    });

    renderTemplatePreview();
}

function setActiveField(fieldKey) {
    activeInputField = fieldKey;
}

function updateCoordsFromInput(fieldKey) {
    const x = parseInt(document.getElementById(`x-${fieldKey}`).value) || 0;
    const y = parseInt(document.getElementById(`y-${fieldKey}`).value) || 0;
    templateData[activeTemplateType].coords[fieldKey] = { x, y };
    renderTemplatePreview();
}

// Handle Image Upload and load it into the canvas memory
function handleTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        templateData[activeTemplateType].bgImage.onload = () => {
            renderTemplatePreview();
        };
        templateData[activeTemplateType].bgImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// The core rendering engine for the preview
function renderTemplatePreview() {
    const canvas = document.getElementById('template-canvas');
    const ctx = canvas.getContext('2d');
    const config = templateData[activeTemplateType];

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Background Image (if uploaded)
    if (config.bgImage.src) {
        ctx.drawImage(config.bgImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback placeholder pattern
        ctx.fillStyle = "#E2E8F0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#94A3B8";
        ctx.font = "bold 40px Inter";
        ctx.textAlign = "center";
        ctx.fillText("NO BACKGROUND UPLOADED", canvas.width / 2, canvas.height / 2);
    }

    // 2. Draw Text Overlays based on coords
    ctx.textAlign = "left";
    
    for (const [fieldKey, coords] of Object.entries(config.coords)) {
        // Highlight the text if it is the actively selected field
        if (activeInputField === fieldKey) {
            ctx.fillStyle = "#E11D48"; // Danger Red to show it's active
            ctx.font = "bold 48px Inter";
        } else {
            ctx.fillStyle = "#0F172A"; // Default dark
            ctx.font = "bold 40px Inter";
        }

        const mockText = previewMockData[fieldKey] || fieldKey;
        ctx.fillText(mockText, coords.x, coords.y);
    }
}

// Magical Click-to-Position Logic
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('template-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', function(e) {
        if (!activeInputField) {
            showToast("Click an input field on the left first to map coordinates!", "error");
            return;
        }

        // Calculate accurate X/Y scaled from the visual CSS size to the internal 1080x1080 size
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const actualX = Math.round((e.clientX - rect.left) * scaleX);
        const actualY = Math.round((e.clientY - rect.top) * scaleY);

        // Update Inputs
        document.getElementById(`x-${activeInputField}`).value = actualX;
        document.getElementById(`y-${activeInputField}`).value = actualY;

        // Update State
        templateData[activeTemplateType].coords[activeInputField] = { x: actualX, y: actualY };
        
        // Re-render
        renderTemplatePreview();
    });
});

async function saveTemplateConfig() {
    setLoading('template-type-select', true); // generic loading indicator
    showToast("Saving template parameters...", "success");
    
    // Structure the payload
    const payload = {
        type: activeTemplateType,
        coordinates: templateData[activeTemplateType].coords
    };

    try {
        /*
         * SUPABASE INTEGRATION:
         * To make this fully functional on Live Results, save it to a Supabase table named 'settings'
         * with columns: id (string, PK), value (jsonb)
         */
         
         const { error } = await supabaseClient.from('settings')
            .upsert({ id: `template_${activeTemplateType}`, value: payload });
            
         if (error) throw error;
         
         showToast("Template Coordinates Saved Successfully!");
    } catch(e) {
        // Fallback for if table doesn't exist yet
        console.warn("Table 'settings' might not exist yet. Payload:", payload);
        showToast("Configurations mapped locally! (Set up Supabase 'settings' table to persist)", "success");
    } finally {
        setLoading('template-type-select', false);
    }
}

// ============================================================================
// POSTER TEMPLATE ENGINE V6 (Layers Panel, Drag-and-Drop, Corner Radius)
// ============================================================================

let savedTemplates = []; 
let studioActiveData = null; 
let studioActiveField = null; 
let multiSelectedLayers = new Set();
let dragStartPositions = {};
let currentLibraryFilter = 'all';

// DRAG & RESIZE STATE
let isDraggingLayer = false;
let isResizingLayer = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
let resizeStartX = 0;
let resizeStartY = 0;

const TEMPLATE_SCHEMAS = {
    individual: ['Result Number', 'Category', 'Competition', 'Position 1 Name', 'Position 1 Team', 'Position 1 Photo', 'Position 1 Number', 'Position 2 Name', 'Position 2 Team', 'Position 2 Photo', 'Position 2 Number', 'Position 3 Name', 'Position 3 Team', 'Position 3 Photo', 'Position 3 Number'],
    team: ['Results Count Text', 'Rank 1 Team', 'Rank 1 Points', 'Rank 1 Number', 'Rank 2 Team', 'Rank 2 Points', 'Rank 2 Number', 'Rank 3 Team', 'Rank 3 Points', 'Rank 3 Number', 'Rank 4 Team', 'Rank 4 Points', 'Rank 4 Number', 'Rank 5 Team', 'Rank 5 Points', 'Rank 5 Number', 'Rank 6 Team', 'Rank 6 Points', 'Rank 6 Number', 'Rank 7 Team', 'Rank 7 Points', 'Rank 7 Number', 'Rank 8 Team', 'Rank 8 Points', 'Rank 8 Number', 'Rank 9 Team', 'Rank 9 Points', 'Rank 9 Number', 'Rank 10 Team', 'Rank 10 Points', 'Rank 10 Number'],
    final: ['Total Competitions Count', 'Rank 1 Team', 'Rank 1 Points', 'Rank 1 Number', 'Rank 2 Team', 'Rank 2 Points', 'Rank 2 Number', 'Rank 3 Team', 'Rank 3 Points', 'Rank 3 Number', 'Rank 4 Team', 'Rank 4 Points', 'Rank 4 Number', 'Rank 5 Team', 'Rank 5 Points', 'Rank 5 Number', 'Rank 6 Team', 'Rank 6 Points', 'Rank 6 Number', 'Rank 7 Team', 'Rank 7 Points', 'Rank 7 Number', 'Rank 8 Team', 'Rank 8 Points', 'Rank 8 Number', 'Rank 9 Team', 'Rank 9 Points', 'Rank 9 Number', 'Rank 10 Team', 'Rank 10 Points', 'Rank 10 Number'],
    id_card: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Date of Birth', 'Photo', 'QR Code'],
    certificate: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Competition', 'Position', 'Grade', 'Issue Date', 'QR Code']
};

const STUDIO_MOCK_DATA = {
    'ResultNumber': '#42', 'Category': 'GENERAL', 'Competition': 'DANCE OFF',
    'Position1Name': 'JOHN DOE', 'Position1Team': 'FALCONS', 'Position1Number': '1',
    'Position2Name': 'JANE SMITH', 'Position2Team': 'EAGLES', 'Position2Number': '2',
    'Position3Name': 'MIKE TYSON', 'Position3Team': 'HAWKS', 'Position3Number': '3',
    'ResultsCountText': 'AFTER 40',
    'TotalCompetitionsCount': 'FINAL OVERALL', 
    'Rank1Team': 'FALCONS', 'Rank1Points': '450', 'Rank1Number': '1',
    'Rank2Team': 'EAGLES', 'Rank2Points': '380', 'Rank2Number': '2',
    'Rank3Team': 'HAWKS', 'Rank3Points': '310', 'Rank3Number': '3',
    'Rank4Team': 'TIGERS', 'Rank4Points': '280', 'Rank4Number': '4',
    'Rank5Team': 'LIONS', 'Rank5Points': '250', 'Rank5Number': '5',
    'Rank6Team': 'PANTHERS', 'Rank6Points': '220', 'Rank6Number': '6',
    'Rank7Team': 'WOLVES', 'Rank7Points': '190', 'Rank7Number': '7',
    'Rank8Team': 'BEARS', 'Rank8Points': '150', 'Rank8Number': '8',
    'Rank9Team': 'SHARKS', 'Rank9Points': '120', 'Rank9Number': '9',
    'Rank10Team': 'COBRAS', 'Rank10Points': '90', 'Rank10Number': '10',
    'ParticipantName': 'JOHN DOE', 'UniqueID': 'FEST-26-987654', 'BatchNo': 'BATCH 1',
    'Position': 'FIRST PLACE', 'Grade': 'A+ GRADE', 'IssueDate': new Date().toLocaleDateString()
};

const AVAILABLE_FONTS = [
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Bebas Neue', value: "'Bebas Neue', cursive" },
    { name: 'Serif', value: "'Times New Roman', Times, serif" }
];

// --- 1. LIBRARY INIT ---
async function loadTemplatesList() {
    showToast("Syncing templates from cloud...", "success");
    try {
        let { data: templates, error } = await festQuery(supabaseClient
            .from('templates')
            .select('*'))
            .order('created_at', { ascending: false });

        if (error && (error.code === '42703' || error.message?.includes('column templates.fest_id does not exist'))) {
            console.warn("templates.fest_id column not present yet in Supabase, running fallback query...");
            const fb = await supabaseClient.from('templates').select('*').order('created_at', { ascending: false });
            templates = fb.data;
            error = fb.error;
        }

        if (error) {
            console.error("Template Sync Error:", error);
            showToast("Failed to load templates", "error");
            savedTemplates = [];
        } else {
            savedTemplates = templates || [];
        }
    } catch(err) {
        console.error("Template Sync Exception:", err);
        savedTemplates = [];
    }
    
    renderTemplateLibrary();
}

function filterTemplateLibrary(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('#template-library-view .controls-bar button').forEach(btn => {
        btn.classList.remove('active-filter-btn');
        btn.style.background = 'transparent'; btn.style.color = 'var(--text-main)'; btn.style.borderColor = 'var(--border)';
    });
    
    const activeBtn = document.getElementById(`filter-${type}`);
    if (activeBtn) {
        activeBtn.classList.add('active-filter-btn');
        activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'white'; activeBtn.style.borderColor = 'var(--primary)';
    }
    renderTemplateLibrary();
}

function renderTemplateLibrary() {
    const grid = document.getElementById('saved-templates-grid');
    grid.innerHTML = '';
    const filtered = currentLibraryFilter === 'all' ? savedTemplates : savedTemplates.filter(t => t.type === currentLibraryFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted); background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border);">No templates found.</div>`;
        return;
    }

    filtered.forEach((tpl) => {
        const trueIndex = savedTemplates.findIndex(t => t.id === tpl.id);
        let tag = tpl.type === 'id_card' ? 'ID Card' : tpl.type === 'team' ? 'Team' : tpl.type === 'final' ? 'Final' : tpl.type === 'certificate' ? 'Certificate' : 'Individual';

        grid.innerHTML += `
            <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
                <div style="height: 180px; background: #E2E8F0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
${tpl.bg_base64 ? `<img src="${tpl.bg_base64}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fa-solid fa-image" style="font-size: 3rem; color: #CBD5E1;"></i>`}                    <div style="position: absolute; top: 10px; right: 10px; background: rgba(79, 70, 229, 0.9); color: white; padding: 0.3rem 0.75rem; border-radius: 50px; font-size: 0.7rem; font-weight: 700;">${tag}</div>
                </div>
                <div style="padding: 1.5rem;">
                    <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.25rem;">${tpl.name}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">${Object.keys(tpl.fields).filter(k => tpl.fields[k].enabled).length} Active Fields</p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="flex: 1;" onclick="editTemplate(${trueIndex})">Edit</button>
                        <button class="btn btn-outline" style="padding: 0.5rem 1rem; color: var(--danger); border-color: var(--danger);" onclick="deleteTemplate(${trueIndex})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}



function openTemplateStudio(template = null) {
    document.getElementById('template-library-view').style.display = 'none';
    document.getElementById('template-studio-view').style.display = 'block';

    if (template) {
        studioActiveData = JSON.parse(JSON.stringify(template)); 
        document.getElementById('studio-template-name').value = studioActiveData.name;
        document.getElementById('studio-template-type').value = studioActiveData.type;
        
        // HIDDEN GROUPS WORKAROUND: Extract the hidden groups object from fields
        if (studioActiveData.fields && studioActiveData.fields['__groups__']) {
            studioActiveData.groups = studioActiveData.fields['__groups__'];
            delete studioActiveData.fields['__groups__']; // Remove it so the canvas doesn't try to draw it
        } else {
            studioActiveData.groups = {};
        }
        
        // Rehydrate main background image
        studioActiveData.imgObj = new Image();
        studioActiveData.imgObj.crossOrigin = "Anonymous"; 
        studioActiveData.imgObj.onload = () => drawStudioCanvas();
        if (studioActiveData.bg_base64) studioActiveData.imgObj.src = studioActiveData.bg_base64;

        // Rehydrate static uploaded elements
        if (studioActiveData.fields) {
            Object.keys(studioActiveData.fields).forEach(key => {
                const field = studioActiveData.fields[key];
                if (field.isStaticElement && field.src) {
                    field.imgObj = new Image();
                    field.imgObj.crossOrigin = "Anonymous";
                    field.imgObj.onload = () => drawStudioCanvas();
                    field.imgObj.src = field.src;
                }
            });
        }

        // Rehydrate Custom Fonts
        if (studioActiveData.customFonts && studioActiveData.customFonts.length > 0) {
            studioActiveData.customFonts.forEach(async (fontData) => {
                if (!AVAILABLE_FONTS.find(f => f.value === fontData.family)) {
                    try {
                        const customFont = new FontFace(fontData.family, `url(${fontData.url})`);
                        const loadedFace = await customFont.load();
                        document.fonts.add(loadedFace);
                        
                        AVAILABLE_FONTS.push({ name: fontData.name, value: fontData.family });
                        drawStudioCanvas(); 
                    } catch (e) {
                        console.error("Failed to rehydrate custom font:", fontData.family, e);
                    }
                }
            });
        }
    } else {
        // Initialize a brand new template
        studioActiveData = { 
            id: 'TPL_' + Date.now(), 
            name: '', 
            type: 'individual', 
            bg_base64: null, 
            imgObj: new Image(), 
            fields: {},
            groups: {}, 
            customFonts: [] 
        };
        
        studioActiveData.imgObj.crossOrigin = "Anonymous";
        
        document.getElementById('studio-template-name').value = '';
        document.getElementById('studio-template-type').value = 'individual';
    }
    
    if (typeof multiSelectedLayers !== 'undefined') multiSelectedLayers.clear();
    studioActiveField = null;
    
    // Reset History Stacks
    undoStack = [];
    redoStack = [];
    updateHistoryButtons();
    
    initializeStudioFields();
}

function closeTemplateStudio() {
    document.getElementById('template-studio-view').style.display = 'none';
    document.getElementById('template-library-view').style.display = 'block';
    loadTemplatesList(); 
}




function toggleLayerVisibility(event, key) {
    event.stopPropagation(); // Prevent layer selection click
    studioActiveData.fields[key].enabled = !studioActiveData.fields[key].enabled;
    if (!studioActiveData.fields[key].enabled && studioActiveField === key) {
        studioActiveField = null;
        renderPropertiesPanel();
    }
    renderLayersPanel();
    drawStudioCanvas();
}



let historyTimeout = null;


// --- LAYER MANAGEMENT & GROUPING ENGINE ---
function groupSelected() {
    if (multiSelectedLayers.size < 2) return;
    saveHistoryState();
    const groupId = 'GRP_' + Date.now();
    if (!studioActiveData.groups) studioActiveData.groups = {};
    studioActiveData.groups[groupId] = { name: 'New Group', expanded: true };
    multiSelectedLayers.forEach(k => { studioActiveData.fields[k].groupId = groupId; });
    showToast("Layers Grouped!", "success");
    renderLayersPanel();
    renderPropertiesPanel();
}

function ungroupSelected() {
    saveHistoryState();
    const keys = Array.from(multiSelectedLayers);
    const groupId = studioActiveData.fields[keys[0]].groupId;
    if(groupId && studioActiveData.groups) delete studioActiveData.groups[groupId];
    multiSelectedLayers.forEach(k => { studioActiveData.fields[k].groupId = null; });
    showToast("Layers Ungrouped!", "success");
    renderLayersPanel();
    renderPropertiesPanel();
}

function selectStudioGroup(groupId) {
    multiSelectedLayers.clear();
    Object.keys(studioActiveData.fields).forEach(k => {
        if (studioActiveData.fields[k].groupId === groupId) multiSelectedLayers.add(k);
    });
    studioActiveField = null; 
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function toggleGroupExpand(e, groupId) {
    e.stopPropagation();
    if (studioActiveData.groups && studioActiveData.groups[groupId]) {
        studioActiveData.groups[groupId].expanded = !studioActiveData.groups[groupId].expanded;
        renderLayersPanel();
    }
}


function renderLayersPanel() {
    const container = document.getElementById('studio-layers-panel');
    container.innerHTML = '';
    if (!studioActiveData.groups) studioActiveData.groups = {};

    const processedGroups = new Set();
    const keys = Object.keys(studioActiveData.fields).reverse(); 
    
    keys.forEach(key => {
        const data = studioActiveData.fields[key];
        const groupId = data.groupId;

        if (groupId) {
            if (!processedGroups.has(groupId)) {
                processedGroups.add(groupId);
                const groupMeta = studioActiveData.groups[groupId] || { name: 'Group', expanded: true };
                
                const groupKeys = Object.keys(studioActiveData.fields).filter(k => studioActiveData.fields[k].groupId === groupId);
                const isGroupSelected = groupKeys.every(k => multiSelectedLayers.has(k)) && groupKeys.length > 0;
                
                // LIGHT THEME COLORS FOR GROUP FOLDER
                const bgColor = isGroupSelected ? 'var(--primary-light)' : '#FFFFFF';
                const textColor = isGroupSelected ? 'var(--primary)' : '#0F172A';
                const iconColor = isGroupSelected ? 'var(--primary)' : '#64748B';
                
                container.innerHTML += `
                    <div style="display: flex; flex-direction: row-reverse; align-items: center; justify-content: flex-end; padding: 0.85rem 1rem; background: ${bgColor}; border: 1px solid ${isGroupSelected ? 'var(--primary)' : '#E5E7EB'}; margin-bottom: 2px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onclick="selectStudioGroup('${groupId}')">
                        <div style="flex: 1; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center;">
                            <button style="background:none; border:none; color: ${iconColor}; cursor:pointer; font-size:1.15rem; padding: 0 0.5rem;" onclick="toggleGroupExpand(event, '${groupId}')">
                                <i class="fa-solid fa-chevron-${groupMeta.expanded ? 'down' : 'right'}"></i>
                            </button>
                            <span style="font-weight: 800; font-size: 0.95rem; color: ${textColor}; text-transform: uppercase;">${groupMeta.name}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-right: 1rem; text-align: center;">
                            <i class="fa-solid fa-folder" style="color: ${iconColor}; font-size: 1.1rem;"></i>
                        </div>
                    </div>
                `;

                // Render Children indented if expanded
                if (groupMeta.expanded) {
                    groupKeys.reverse().forEach(childKey => {
                        renderSingleLayerRow(container, childKey, studioActiveData.fields[childKey], true);
                    });
                }
            }
        } else {
            renderSingleLayerRow(container, key, data, false);
        }
    });
}

function renderSingleLayerRow(container, key, data, isChild) {
    const isActiveLayer = multiSelectedLayers.has(key) || studioActiveField === key;
    
    // LIGHT THEME COLORS FOR LAYERS
    const bgColor = isActiveLayer ? 'var(--primary-light)' : '#FFFFFF';
    const textColor = isActiveLayer ? 'var(--primary)' : '#0F172A';
    const iconColor = isActiveLayer ? 'var(--primary)' : '#64748B';
    const eyeColor = isActiveLayer ? 'var(--primary)' : (data.enabled ? '#0F172A' : '#CBD5E1');

    const lockColor = data.locked ? '#EF4444' : iconColor;
    const lockIcon = data.locked ? 'fa-lock' : 'fa-unlock';
    
    // Visually indent layers if they are inside a folder
    const indentStyles = isChild ? 'margin-left: 24px; border-left: 3px solid #E5E7EB; border-top-left-radius: 0; border-bottom-left-radius: 0;' : '';
    
    container.innerHTML += `
        <div style="display: flex; flex-direction: row-reverse; align-items: center; justify-content: flex-end; padding: 0.85rem 1rem; background: ${bgColor}; border: 1px solid ${isActiveLayer ? 'var(--primary)' : '#E5E7EB'}; margin-bottom: 2px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); ${indentStyles}" onclick="selectStudioLayer('${key}')">
            <div style="flex: 1; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center;">
                <button style="background:none; border:none; color: ${eyeColor}; cursor:pointer; font-size:1.15rem;" onclick="toggleLayerVisibility(event, '${key}')">
                    <i class="fa-solid ${data.enabled ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button style="background:none; border:none; color: ${lockColor}; cursor:pointer; font-size:1rem;" onclick="toggleLayerLock(event, '${key}')">
                    <i class="fa-solid ${lockIcon}"></i>
                </button>
                <span style="font-weight: 600; font-size: 0.95rem; color: ${textColor};">${data.displayName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-right: 1rem; text-align: center;">
                <i class="fa-solid ${data.isImage ? 'fa-image' : 'fa-t'}" style="color: ${iconColor}; font-size: 1.1rem;"></i>
                <input type="checkbox" ${isActiveLayer ? 'checked' : ''} onclick="toggleMultiSelect(event, '${key}')" style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;">
            </div>
        </div>
    `;
}

function updateActiveProperty(prop, value) {
    if (multiSelectedLayers.size > 0) {
        if (!historyTimeout && !isRestoringHistory) saveHistoryState();
        clearTimeout(historyTimeout);
        historyTimeout = setTimeout(() => { historyTimeout = null; }, 800);

        const isNum = ['x','y','w','h','size','radius'].includes(prop);
        const val = isNum ? (parseInt(value) || 0) : value;

        // Group Renaming Logic
        if (prop === 'groupName') {
            const keys = Array.from(multiSelectedLayers);
            const groupId = studioActiveData.fields[keys[0]].groupId;
            if (groupId && studioActiveData.groups[groupId]) {
                studioActiveData.groups[groupId].name = val;
            }
            renderLayersPanel();
            return;
        }

        // Apply edits to all valid selected layers (Group Bulk Edit)
        multiSelectedLayers.forEach(key => {
            const data = studioActiveData.fields[key];
            if (data.locked) return;

            if (data.isImage && ['size', 'color', 'font', 'weight', 'align'].includes(prop)) return; // Skip text edits on images
            if (!data.isImage && ['w', 'h', 'radius'].includes(prop)) return; // Skip image edits on text

            if (prop === 'w' && data.aspectLocked && data.aspectRatio) {
                data.w = val; data.h = Math.round(val / data.aspectRatio);
            } else if (prop === 'h' && data.aspectLocked && data.aspectRatio) {
                data.h = val; data.w = Math.round(val * data.aspectRatio);
            } else {
                data[prop] = val;
            }
            if (!data.aspectLocked && (prop === 'w' || prop === 'h')) {
                if (data.w > 0 && data.h > 0) data.aspectRatio = data.w / data.h;
            }
        });

        drawStudioCanvas();
        return;
    }
}

function renderPropertiesPanel() {
    const container = document.getElementById('studio-properties-panel');
    const studioView = document.getElementById('template-studio-view');
    
    if (typeof multiSelectedLayers === 'undefined' || multiSelectedLayers.size === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">Select a layer to edit.</p>`;
        if (studioView) { studioView.classList.remove('layer-active'); studioView.classList.add('layer-empty'); }
        return;
    }

    if (studioView) { studioView.classList.add('layer-active'); studioView.classList.remove('layer-empty'); }

    // --- MULTI-SELECT & GROUP BULK EDIT VIEW ---
    if (multiSelectedLayers.size > 1) {
        const keys = Array.from(multiSelectedLayers);
        const groupId = studioActiveData.fields[keys[0]].groupId;
        const isFormalGroup = keys.every(k => studioActiveData.fields[k].groupId && studioActiveData.fields[k].groupId === groupId);
        
        let groupNameInput = '';
        let groupTitle = `${keys.length} Layers Selected`;

        if (isFormalGroup && studioActiveData.groups[groupId]) {
            groupTitle = `Group Selected`;
            groupNameInput = `
                <div style="grid-column: span 2; margin-bottom: 1.25rem;">
                    <label style="font-size: 0.75rem; font-weight:700;">GROUP NAME</label>
                    <input type="text" value="${studioActiveData.groups[groupId].name}" oninput="updateActiveProperty('groupName', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                </div>
            `;
        }

        // Grab placeholder data from the first text element in the group to populate the fields
        let commonColor = '#ffffff', commonSize = 40, commonFont = 'Inter, sans-serif', commonWeight = 'bold', commonAlign = 'left';
        const firstTextKey = keys.find(k => !studioActiveData.fields[k].isImage);
        if (firstTextKey) {
            const fd = studioActiveData.fields[firstTextKey];
            commonColor = fd.color; commonSize = fd.size; commonFont = fd.font; commonWeight = fd.weight; commonAlign = fd.align;
        }
        const fonts = AVAILABLE_FONTS.map(f => `<option value="${f.value}" ${commonFont === f.value ? 'selected' : ''}>${f.name}</option>`).join('');

        container.innerHTML = `
            <div class="mobile-properties-header" style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px dashed #334155; padding-bottom: 0.85rem; gap: 0.75rem;">
                <button class="btn btn-outline mobile-back-btn" style="padding: 0.4rem 0.6rem; border-radius: 8px; border: none; background: #334155; color: white; display: none;" onclick="multiSelectedLayers.clear(); studioActiveField = null; renderLayersPanel(); renderPropertiesPanel(); drawStudioCanvas();"><i class="fa-solid fa-arrow-left"></i></button>
                <h4 style="color: white; font-size: 1.15rem; font-weight: 800; margin: 0;">${groupTitle}</h4>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                ${groupNameInput}
                <div><label style="font-size: 0.75rem; font-weight:700;">NUDGE X</label><input type="number" value="0" onchange="shiftSelected('x', this.value); this.value=0;" placeholder="0" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; text-align: center;"></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">NUDGE Y</label><input type="number" value="0" onchange="shiftSelected('y', this.value); this.value=0;" placeholder="0" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; text-align: center;"></div>
                
                <div><label style="font-size: 0.75rem; font-weight:700;">FONT SIZE</label><input type="number" value="${commonSize}" oninput="updateActiveProperty('size', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">COLOR</label><input type="color" value="${commonColor}" oninput="updateActiveProperty('color', this.value)" style="width: 100%; height: 35px; border: 1px solid var(--border); border-radius: 4px; padding:0;"></div>
                <div style="grid-column: span 2;"><label style="font-size: 0.75rem; font-weight:700;">FONT FAMILY</label><select onchange="updateActiveProperty('font', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">${fonts}</select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">WEIGHT</label><select onchange="updateActiveProperty('weight', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"><option value="normal" ${commonWeight==='normal'?'selected':''}>Normal</option><option value="bold" ${commonWeight==='bold'?'selected':''}>Bold</option><option value="900" ${commonWeight==='900'?'selected':''}>Black</option></select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">ALIGN</label><select onchange="updateActiveProperty('align', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"><option value="left" ${commonAlign==='left'?'selected':''}>Left</option><option value="center" ${commonAlign==='center'?'selected':''}>Center</option><option value="right" ${commonAlign==='right'?'selected':''}>Right</option></select></div>
            </div>

            <label style="color: #94A3B8; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.5rem; display: block;">ALIGNMENT TOOLS</label>
            <div style="display: flex; background: #1E293B; border-radius: 8px; padding: 0.25rem; gap: 0.25rem; margin-bottom: 1rem; border: 1px solid #334155;">
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('left')"><i class="fa-solid fa-align-left" style="font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('center')"><i class="fa-solid fa-align-center" style="font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('right')"><i class="fa-solid fa-align-right" style="font-size: 1.1rem; margin:0;"></i></button>
                <div style="width: 1px; background: #334155; margin: 0.25rem 0;"></div>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('top')"><i class="fa-solid fa-object-group" style="transform: rotate(180deg); font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('middle')"><i class="fa-solid fa-arrows-up-down" style="font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('bottom')"><i class="fa-solid fa-object-group" style="font-size: 1.1rem; margin:0;"></i></button>
            </div>
            
            <div class="group-action-row" style="display: flex; width: 100%;">
                <button class="btn ${isFormalGroup ? 'btn-danger' : 'btn-success'}" style="flex: 1; padding: 0.75rem; border-radius: 8px; font-weight: 700;" onclick="${isFormalGroup ? 'ungroupSelected()' : 'groupSelected()'}">
                    <i class="fa-solid ${isFormalGroup ? 'fa-object-ungroup' : 'fa-object-group'}"></i> ${isFormalGroup ? 'Ungroup Selection' : 'Group Selected Layers'}
                </button>
            </div>
        `;
        return;
    }

    // --- STANDARD SINGLE LAYER VIEW ---
    const key = studioActiveField;
    if (!key || !studioActiveData.fields[key]) return;
    
    // [The rest of the standard single layer view remains identical to your current admin_2.js implementation]
    const data = studioActiveData.fields[key];
    const fonts = AVAILABLE_FONTS.map(f => `<option value="${f.value}" ${data.font === f.value ? 'selected' : ''}>${f.name}</option>`).join('');

    let specificHTML = '';
    if (data.isImage) {
        const lockIcon = data.aspectLocked ? 'fa-lock' : 'fa-lock-open';
        const deleteBtn = data.isStaticElement ? `<button class="btn btn-outline" style="grid-column: span 3; border-color: var(--danger); color: var(--danger); margin-top: 0.5rem;" onclick="deleteStudioLayer('${key}')"><i class="fa-solid fa-trash"></i> Delete Element</button>` : '';

        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; margin-top: 1rem; align-items: end;">
                <div><label style="font-size: 0.75rem; font-weight:700;">WIDTH</label><input type="number" id="prop-w" value="${data.w}" oninput="updateActiveProperty('w', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                <button class="btn btn-outline" style="padding: 0.5rem; height: 35px; width: 35px; display: flex; justify-content: center; align-items: center;" onclick="toggleAspectRatioLock('${key}')" title="Toggle Aspect Ratio Lock"><i class="fa-solid ${lockIcon}"></i></button>
                <div><label style="font-size: 0.75rem; font-weight:700;">HEIGHT</label><input type="number" id="prop-h" value="${data.h}" oninput="updateActiveProperty('h', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                <div style="grid-column: span 3;"><label style="font-size: 0.75rem; font-weight:700;">CORNER RADIUS</label><input type="number" id="prop-rad" value="${data.radius || 0}" oninput="updateActiveProperty('radius', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                ${deleteBtn}
            </div>
        `;
    } else {
        let customTextHTML = '';
        if (data.isCustom) {
            customTextHTML = `
                <div style="grid-column: span 2;">
                    <label style="font-size: 0.75rem; font-weight:700;">TEXT CONTENT</label>
                    <input type="text" value="${data.displayName}" oninput="updateActiveProperty('displayName', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}>
                </div>
            `;
        }
        const deleteBtn = data.isCustom ? `<button class="btn btn-outline" style="grid-column: span 2; border-color: var(--danger); color: var(--danger); margin-top: 0.5rem;" onclick="deleteStudioLayer('${key}')"><i class="fa-solid fa-trash"></i> Delete Layer</button>` : '';

        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
                ${customTextHTML}
                <div><label style="font-size: 0.75rem; font-weight:700;">FONT SIZE</label><input type="number" id="prop-sz" value="${data.size}" oninput="updateActiveProperty('size', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">COLOR</label><input type="color" id="prop-cl" value="${data.color}" oninput="updateActiveProperty('color', this.value)" style="width: 100%; height: 35px; border: 1px solid var(--border); border-radius: 4px; padding:0;" ${data.locked ? 'disabled' : ''}></div>
                <div style="grid-column: span 2;"><label style="font-size: 0.75rem; font-weight:700;">FONT FAMILY</label><select onchange="updateActiveProperty('font', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}>${fonts}</select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">WEIGHT</label><select onchange="updateActiveProperty('weight', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}><option value="normal" ${data.weight==='normal'?'selected':''}>Normal</option><option value="bold" ${data.weight==='bold'?'selected':''}>Bold</option><option value="900" ${data.weight==='900'?'selected':''}>Black</option></select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">ALIGN</label><select onchange="updateActiveProperty('align', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}><option value="left" ${data.align==='left'?'selected':''}>Left</option><option value="center" ${data.align==='center'?'selected':''}>Center</option><option value="right" ${data.align==='right'?'selected':''}>Right</option></select></div>
                <!-- 2-Line Text Split Control -->
                <div style="grid-column: span 2; background: rgba(255,255,255,0.05); padding: 0.65rem; border-radius: 8px; border: 1px solid var(--border); margin-top: 0.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-size: 0.75rem; font-weight:700; margin: 0; cursor: pointer; color: white; display: flex; align-items: center; gap: 0.4rem;">
                            <i class="fa-solid fa-arrows-split-up-and-left" style="color: var(--primary);"></i> SPLIT ACROSS 2 LINES
                        </label>
                        <input type="checkbox" id="prop-split-2lines" ${data.splitTwoLines ? 'checked' : ''} onchange="updateActiveProperty('splitTwoLines', this.checked); renderPropertiesPanel(); drawStudioCanvas();" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
                    </div>
                    ${data.splitTwoLines ? `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                            <div>
                                <label style="font-size: 0.7rem; font-weight: 700; color: #94A3B8;">WORDS ON 1ST LINE</label>
                                <input type="number" min="1" max="10" value="${data.splitWordsFirstLine || 1}" oninput="updateActiveProperty('splitWordsFirstLine', parseInt(this.value) || 1); drawStudioCanvas();" style="width: 100%; padding: 0.4rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;" placeholder="1">
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; font-weight: 700; color: #94A3B8;">LINE GAP (PX)</label>
                                <input type="number" min="10" max="300" value="${data.lineGap !== undefined ? data.lineGap : Math.round((data.size || 40) * 1.15)}" oninput="updateActiveProperty('lineGap', parseInt(this.value) || Math.round((data.size || 40) * 1.15)); drawStudioCanvas();" style="width: 100%; padding: 0.4rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;" placeholder="${Math.round((data.size || 40) * 1.15)}">
                            </div>
                        </div>
                    ` : ''}
                </div>
                ${deleteBtn}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="mobile-properties-header" style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px dashed #334155; padding-bottom: 0.85rem; gap: 0.75rem;">
            <button class="btn btn-outline mobile-back-btn" style="padding: 0.4rem 0.6rem; border-radius: 8px; border: none; background: #334155; color: white; display: none;" onclick="multiSelectedLayers.clear(); studioActiveField = null; renderLayersPanel(); renderPropertiesPanel(); drawStudioCanvas();"><i class="fa-solid fa-arrow-left"></i></button>
            <h4 style="color: white; font-size: 1.15rem; font-weight: 800; margin: 0; text-transform: uppercase;">${data.displayName} ${data.locked ? '<i class="fa-solid fa-lock" style="color:#EF4444; font-size: 0.8rem; margin-left: 5px;"></i>' : ''}</h4>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div><label style="font-size: 0.75rem; font-weight:700;">X POS</label><input type="number" id="prop-x" value="${data.x}" oninput="updateActiveProperty('x', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
            <div><label style="font-size: 0.75rem; font-weight:700;">Y POS</label><input type="number" id="prop-y" value="${data.y}" oninput="updateActiveProperty('y', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
        </div>
        ${specificHTML}
    `;
}

function handleStudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    studioActiveData.pendingFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        studioActiveData.bg_base64 = e.target.result; 
        studioActiveData.imgObj = new Image();
        
        // ADD THIS LINE:
        studioActiveData.imgObj.crossOrigin = "Anonymous";
        
        studioActiveData.imgObj.onload = () => drawStudioCanvas();
        studioActiveData.imgObj.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
function initializeStudioFields() {
    const type = document.getElementById('studio-template-type').value;
    studioActiveData.type = type;
    const requiredFields = TEMPLATE_SCHEMAS[type];
    
    const validKeys = new Set();

    // 1. Build Data Defaults for the selected Template Sector
    requiredFields.forEach(field => {
        const key = field.replace(/\s+/g, '');
        validKeys.add(key);
        const isImage = (key.includes('Photo') || key === 'QRCode');        
        
        if (!studioActiveData.fields[key]) {
            if (isImage) {
                studioActiveData.fields[key] = { 
                    enabled: false, x: 100, y: 150, w: 250, h: 300, radius: 20, 
                    isImage: true, aspectLocked: true, aspectRatio: 250 / 300,
                    locked: false, groupId: null
                };
            } else {
                studioActiveData.fields[key] = { 
                    enabled: false, x: 100, y: 150, size: 40, color: '#0F172A', 
                    align: 'left', font: 'Inter, sans-serif', weight: 'bold', isImage: false,
                    locked: false, groupId: null
                };
            }
        }
        studioActiveData.fields[key].displayName = field;
    });

    // 2. Dynamic Purging: Remove layers that don't belong to this sector (but KEEP custom layers)
    Object.keys(studioActiveData.fields).forEach(key => {
        const f = studioActiveData.fields[key];
        if (f.isCustom || f.isStaticElement) {
            validKeys.add(key); // Protect custom uploads and texts
        }
        
        if (!validKeys.has(key)) {
            delete studioActiveData.fields[key]; // Purge irrelevant layers
        }
    });

    // If the currently selected layer was just purged, unselect it
    if (studioActiveField && !studioActiveData.fields[studioActiveField]) {
        studioActiveField = null;
    }

    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

// NEW: Add a Custom Text Layer
function addCustomTextLayer() {
    const key = 'CustomText_' + Date.now();
    studioActiveData.fields[key] = {
        enabled: true,
        displayName: "New Custom Text", // Used as the actual text content
        x: 200,
        y: 200,
        size: 60,
        color: '#0F172A',
        align: 'center',
        font: 'Inter, sans-serif',
        weight: 'bold',
        isImage: false,
        isCustom: true, // Flags it so it isn't deleted during sector switches
        locked: false,  // Enables the lock/unlock toggle
        groupId: null   // Enables multi-select grouping
    };

    saveHistoryState();
    renderLayersPanel();
    selectStudioLayer(key);
}




function toggleLayerLock(event, key) {
    event.stopPropagation();
    saveHistoryState();
    studioActiveData.fields[key].locked = !studioActiveData.fields[key].locked;
    renderLayersPanel();
}

function toggleMultiSelect(event, key) {
    event.stopPropagation();
    if (multiSelectedLayers.has(key)) {
        multiSelectedLayers.delete(key);
    } else {
        multiSelectedLayers.add(key);
    }
    studioActiveField = multiSelectedLayers.size > 0 ? Array.from(multiSelectedLayers).pop() : null;
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function selectStudioLayer(key) {
    // Standard click clears multi-select unless it belongs to a group
    multiSelectedLayers.clear();
    
    const hitGroup = studioActiveData.fields[key].groupId;
    if (hitGroup) {
        Object.keys(studioActiveData.fields).forEach(k => {
            if (studioActiveData.fields[k].groupId === hitGroup) multiSelectedLayers.add(k);
        });
    } else {
        multiSelectedLayers.add(key);
    }
    
    studioActiveField = key;
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function alignSelected(type) {
    if (multiSelectedLayers.size < 2) return;
    saveHistoryState();
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const layers = Array.from(multiSelectedLayers).map(k => studioActiveData.fields[k]);
    
    // Calculate Bounding Box
    layers.forEach(data => {
        let w = data.w || 0;
        let h = data.h || data.size || 0;
        if (!data.isImage && data.align === 'center') { minX = Math.min(minX, data.x - w/2); maxX = Math.max(maxX, data.x + w/2); }
        else { minX = Math.min(minX, data.x); maxX = Math.max(maxX, data.x + w); }
        minY = Math.min(minY, data.y - (data.isImage ? 0 : h));
        maxY = Math.max(maxY, data.y + (data.isImage ? h : 0));
    });

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    layers.forEach(data => {
        if(data.locked) return;
        let w = data.w || 0; let h = data.h || data.size || 0;

        if (type === 'left') data.x = data.isImage || data.align !== 'center' ? minX : minX + w/2;
        if (type === 'right') data.x = data.isImage || data.align !== 'center' ? maxX - w : maxX - w/2;
        if (type === 'center') data.x = data.isImage || data.align !== 'center' ? centerX - w/2 : centerX;
        if (type === 'top') data.y = data.isImage ? minY : minY + h;
        if (type === 'bottom') data.y = data.isImage ? maxY - h : maxY;
        if (type === 'middle') data.y = data.isImage ? centerY - h/2 : centerY + h/2;
    });
    
    drawStudioCanvas();
    renderPropertiesPanel();
}



// NEW: Shifts all selected layers precisely
function shiftSelected(axis, val) {
    const shiftAmount = parseInt(val) || 0;
    if (shiftAmount === 0) return;
    saveHistoryState();
    multiSelectedLayers.forEach(k => {
        if (!studioActiveData.fields[k].locked) {
            studioActiveData.fields[k][axis] += shiftAmount;
        }
    });
    drawStudioCanvas();
    // Do not re-render properties panel so the input stays in focus
}



function drawStudioCanvas() {
    const canvas = document.getElementById('studio-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (studioActiveData.imgObj && studioActiveData.imgObj.src && studioActiveData.imgObj.naturalWidth > 0) {
        canvas.width = studioActiveData.imgObj.naturalWidth; canvas.height = studioActiveData.imgObj.naturalHeight;
        ctx.drawImage(studioActiveData.imgObj, 0, 0);
    } else {
        canvas.width = 1080; canvas.height = 1080;
        ctx.fillStyle = "#F1F5F9"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#94A3B8"; ctx.font = "bold 40px Inter"; ctx.textAlign = "center";
        ctx.fillText("UPLOAD A BACKGROUND IMAGE", canvas.width / 2, canvas.height / 2);
    }

    for (const [key, data] of Object.entries(studioActiveData.fields)) {
        if (!data.enabled) continue; 

        if (data.isImage) {
            if (data.isStaticElement) {
                if (data.imgObj && data.imgObj.src) {
                    ctx.drawImage(data.imgObj, data.x, data.y, data.w, data.h);
                }
                if (studioActiveField === key) {
                    ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 4; ctx.setLineDash([10, 5]);
                    ctx.strokeRect(data.x, data.y, data.w, data.h); ctx.setLineDash([]);
                }
            } else {
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(data.x, data.y, data.w, data.h, data.radius || 0);
                else ctx.rect(data.x, data.y, data.w, data.h); 
                
                ctx.fillStyle = key.includes('Photo') ? 'rgba(79, 70, 229, 0.2)' : 'rgba(15, 23, 42, 0.1)';            
                ctx.fill();

                if (studioActiveField === key) {
                    ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 6; ctx.setLineDash([15, 10]);
                    ctx.stroke(); ctx.setLineDash([]);
                }

                ctx.fillStyle = '#0F172A'; ctx.font = "bold 28px Inter"; ctx.textAlign = "center";
                ctx.fillText(data.displayName, data.x + (data.w / 2), data.y + (data.h / 2) + 10);
            }

            if (studioActiveField === key) {
                ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 2;
                const hSize = 14; 
                ctx.fillRect(data.x + data.w - (hSize/2), data.y + data.h - (hSize/2), hSize, hSize);
                ctx.strokeRect(data.x + data.w - (hSize/2), data.y + data.h - (hSize/2), hSize, hSize);
            }
            
        } else {
            ctx.textAlign = data.align; ctx.fillStyle = data.color;
            ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
            
            // Render custom text as the display name, else use the mock data
            const mockText = data.isCustom ? data.displayName : (STUDIO_MOCK_DATA[key] || data.displayName.toUpperCase());
            
            if (studioActiveField === key) {
                ctx.shadowColor = 'rgba(79, 70, 229, 0.8)'; ctx.shadowBlur = 15;
                renderCanvasText(ctx, mockText, data);
                ctx.shadowBlur = 0; 
            } else {
                renderCanvasText(ctx, mockText, data);
            }
        }
    }
}

// --- 4. DRAG, DROP & RESIZE INTERACTION ---
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('studio-canvas');
    if (!canvas) return;

    function getCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function onPointerDown(e) {
        const coords = getCoords(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;
        const mouseX = (coords.x - rect.left) * scaleX; 
        const mouseY = (coords.y - rect.top) * scaleY;

        // 1. Single Element Resize (Only if ONE element is active and NOT locked)
        if (multiSelectedLayers.size === 1 && studioActiveField && studioActiveData.fields[studioActiveField].isImage && !studioActiveData.fields[studioActiveField].locked) {
            const data = studioActiveData.fields[studioActiveField];
            const hitZone = 40; 
            
            if (mouseX >= data.x + data.w - hitZone && mouseX <= data.x + data.w + hitZone &&
                mouseY >= data.y + data.h - hitZone && mouseY <= data.y + data.h + hitZone) {
                
                saveHistoryState(); 
                isResizingLayer = true;
                resizeStartW = data.w;
                resizeStartH = data.h;
                resizeStartX = mouseX;
                resizeStartY = mouseY;
                
                if(e.type === 'touchstart') e.preventDefault(); 
                return; 
            }
        }

        // 2. Multi-Hit Detection (Find what was clicked)
        let hit = null;
        const keys = Object.keys(studioActiveData.fields).reverse();
        
        for(let key of keys) {
            const data = studioActiveData.fields[key];
            if(!data.enabled) continue;

            if(data.isImage) {
                if(mouseX >= data.x && mouseX <= data.x + data.w && mouseY >= data.y && mouseY <= data.y + data.h) {
                    hit = key; break;
                }
            } else {
                const ctx = canvas.getContext('2d');
                ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
                const w = ctx.measureText(STUDIO_MOCK_DATA[key] || data.displayName).width;
                const h = data.size; 
                let startX = data.x;
                if(data.align === 'center') startX -= w/2;
                if(data.align === 'right') startX -= w;

                if(mouseX >= startX - 20 && mouseX <= startX + w + 20 && mouseY >= data.y - h - 20 && mouseY <= data.y + (h * 0.2) + 20) {
                    hit = key; break;
                }
            }
        }

        // 3. Selection & Group Drag Logic (FIXED FOR MOBILE)
        if (hit) {
            // Desktop Ctrl/Shift click adds to selection
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                if (multiSelectedLayers.has(hit)) multiSelectedLayers.delete(hit);
                else multiSelectedLayers.add(hit);
            } 
            // PREVENT CLEARING IF TOUCHING AN ALREADY SELECTED LAYER (Allows mobile drag)
            else if (!multiSelectedLayers.has(hit)) {
                multiSelectedLayers.clear();
                const hitGroup = studioActiveData.fields[hit].groupId;
                if (hitGroup) {
                    Object.keys(studioActiveData.fields).forEach(k => {
                        if (studioActiveData.fields[k].groupId === hitGroup) multiSelectedLayers.add(k);
                    });
                } else {
                    multiSelectedLayers.add(hit);
                }
            }
            
            studioActiveField = multiSelectedLayers.size > 0 ? hit : null;

            saveHistoryState(); 
            isDraggingLayer = true;
            
            // Map out drag offsets for ALL currently selected items
            dragStartPositions = {};
            multiSelectedLayers.forEach(k => {
                if (!studioActiveData.fields[k].locked) {
                    dragStartPositions[k] = {
                        offsetX: mouseX - studioActiveData.fields[k].x,
                        offsetY: mouseY - studioActiveData.fields[k].y
                    };
                }
            });
            
            if(e.type === 'touchstart') e.preventDefault(); 
        } else {
            multiSelectedLayers.clear();
            studioActiveField = null; 
        }
        
        renderLayersPanel(); 
        renderPropertiesPanel(); 
        drawStudioCanvas();
    }

    function onPointerMove(e) {
        if(multiSelectedLayers.size === 0) return;
        if(!isDraggingLayer && !isResizingLayer) return;
        
        if(e.type === 'touchmove') e.preventDefault(); 

        const coords = getCoords(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;
        const mouseX = (coords.x - rect.left) * scaleX; 
        const mouseY = (coords.y - rect.top) * scaleY;

        // HANDLE RESIZING
        if (isResizingLayer && studioActiveField) {
            const data = studioActiveData.fields[studioActiveField];
            let deltaX = mouseX - resizeStartX;
            let newW = Math.max(20, resizeStartW + deltaX);
            let newH = data.h; 

            if (data.aspectLocked && data.aspectRatio) {
                newH = Math.round(newW / data.aspectRatio);
            } else {
                let deltaY = mouseY - resizeStartY;
                newH = Math.max(20, resizeStartH + deltaY);
            }

            data.w = newW;
            data.h = newH;

            const propW = document.getElementById('prop-w');
            const propH = document.getElementById('prop-h');
            if (propW) propW.value = data.w;
            if (propH) propH.value = data.h;
            
            drawStudioCanvas();
            return;
        }

        // HANDLE MULTI-DRAGGING
        if(isDraggingLayer) {
            multiSelectedLayers.forEach(k => {
                const data = studioActiveData.fields[k];
                const startPos = dragStartPositions[k];
                if (startPos && !data.locked) {
                    data.x = Math.round(mouseX - startPos.offsetX);
                    data.y = Math.round(mouseY - startPos.offsetY);
                }
            });

            // If only one layer is moving, live update its property inputs
            if (multiSelectedLayers.size === 1 && studioActiveField) {
                const propX = document.getElementById('prop-x');
                const propY = document.getElementById('prop-y');
                if(propX) propX.value = studioActiveData.fields[studioActiveField].x;
                if(propY) propY.value = studioActiveData.fields[studioActiveField].y;
            }

            drawStudioCanvas();
        }
    }

    function onPointerUp() {
        isDraggingLayer = false; 
        isResizingLayer = false; 
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
});

// --- 5. SAVING ---
async function saveActiveTemplate() {
    const name = document.getElementById('studio-template-name').value;
    if (!name) return showToast("Please enter a Template Name.", "error");
    
    // Ensure they have either uploaded a new file or already have an image loaded
    if (!studioActiveData.bg_base64 && !studioActiveData.pendingFile) {
        return showToast("Please upload a background image.", "error");
    }

    studioActiveData.name = name;

    // Show loading state
    const saveBtn = document.querySelector('#template-studio-view .btn-success');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to Cloud...';
    saveBtn.disabled = true;

    try {
        if (studioActiveData.pendingFile) {
            showToast("Uploading background image...", "success");
            const file = studioActiveData.pendingFile;
            const fileExt = file.name.split('.').pop();
            const fileName = `bg_${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('templates')
                .upload(fileName, file, { contentType: file.type });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('templates')
                .getPublicUrl(fileName);

            studioActiveData.bg_base64 = publicUrlData.publicUrl;
            studioActiveData.pendingFile = null; 
        }

        // HIDDEN GROUPS WORKAROUND: Pack the groups object INSIDE the fields JSON
        // so we don't have to alter the Supabase database schema!
        const packedFields = { ...studioActiveData.fields };
        packedFields['__groups__'] = studioActiveData.groups || {};

        const savePayload = { 
            id: studioActiveData.id,
            name: studioActiveData.name,
            type: studioActiveData.type,
            bg_base64: studioActiveData.bg_base64, 
            fields: packedFields // Save the combined object to the existing column
        };

        const { error } = await supabaseClient.from('templates').upsert(festPayload(savePayload));
        if (error) throw error;
        
        showToast("Template Saved to Cloud Successfully!", "success");
        closeTemplateStudio();
        
    } catch (err) {
        console.error(err);
        showToast(err.message || "Error saving template to cloud.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}
function openFullViewModal() {
    const canvas = document.getElementById('studio-canvas');
    document.getElementById('fullViewImage').src = canvas.toDataURL("image/png");
    document.getElementById('fullViewModal').classList.add('show');
}

// ============================================================================
// DIRECT VALUATION ENGINE (BYPASS WORKFLOW)
// ============================================================================

let currentDVMaxMark = 100;

// --- REPLACE THESE FUNCTIONS IN ADMIN.JS ---

async function initDirectValuation() {
    // 1. Ensure Categories are loaded
    if (categoriesList.length === 0) { 
        const { data } = await festQuery(supabaseClient.from('categories').select('*')).order('name'); 
        categoriesList = data || []; 
    }
    const catSelect = document.getElementById('dvCategory');
    catSelect.innerHTML = '<option value="">-- ALL CATEGORIES --</option>';
    categoriesList.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);

    // 2. Ensure Stages are loaded
    if (stagesList.length === 0) {
        const { data } = await festQuery(supabaseClient.from('stages').select('*')).order('stage_no');
        stagesList = data || [];
    }
    const stageSelect = document.getElementById('dvStage');
    stageSelect.innerHTML = '<option value="">-- ALL STAGES --</option>';
    stagesList.forEach(s => stageSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    
    // 3. Reset defaults and load all pending competitions immediately
    document.getElementById('dvComp').innerHTML = '<option value="">-- SELECT COMPETITION --</option>';
    document.getElementById('dvWorkspace').style.display = 'none';
    
    loadDVCompetitions();
}

async function loadDVCompetitions() {
    const categoryId = document.getElementById('dvCategory').value;
    const stageId = document.getElementById('dvStage').value;
    const compSelect = document.getElementById('dvComp');
    
    document.getElementById('dvWorkspace').style.display = 'none';
    compSelect.innerHTML = '<option value="">Loading...</option>';
    compSelect.disabled = true;
    
    // Build dynamic query based on filters
    let query = festQuery(supabaseClient
        .from('competitions')
        .select('*'))
        .neq('status', 'published') // Only fetch competitions that are NOT published
        .order('name');
        
    // Apply optional filters
    if (categoryId) query = query.eq('category_id', categoryId);
    if (stageId) query = query.eq('stage_id', stageId);
        
    const { data, error } = await query;
        
    if (error) return showToast(error.message, 'error');
    
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION TO EVALUATE --</option>';
    
    if (!data || data.length === 0) {
        compSelect.innerHTML = '<option value="">-- NO PENDING COMPS FOUND --</option>';
        return;
    }
    
    (data || []).forEach(c => compSelect.innerHTML += `<option value="${c.id}" data-max="${c.max_mark}">${c.name}</option>`);
    compSelect.disabled = false;
}

async function loadDVParticipants() {
    const compSelect = document.getElementById('dvComp');
    const compId = compSelect.value;
    const workspace = document.getElementById('dvWorkspace');
    const tbody = document.getElementById('dv-participants-tbody');
    
    if (!compId) { 
        workspace.style.display = 'none'; 
        return; 
    }
    
    currentDVMaxMark = parseFloat(compSelect.options[compSelect.selectedIndex].getAttribute('data-max')) || 100;
    document.getElementById('dvMaxMarks').innerText = `Max Marks: ${currentDVMaxMark}`;
    
    workspace.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fetching enrolled participants...</td></tr>';
    
    // Fetch enrollments
    const { data, error } = await supabaseClient
        .from('participant_competitions')
        .select(`participant_id, participants(name, unique_id, teams(name))`)
        .eq('competition_id', compId);
        
    if (error) return showToast(error.message, 'error');
    
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">No participants are enrolled in this competition.</td></tr>';
        return;
    }
    
    data.forEach(row => {
        const p = row.participants;
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell" style="vertical-align: middle;">
                    <input type="checkbox" class="dv-row-cb" value="${row.participant_id}" checked onchange="toggleDVRow(this, '${row.participant_id}')">
                </td>
                <td>
                    <strong style="font-size: 1.05rem;">${p.name}</strong><br>
                    <small style="font-family: monospace; color: var(--text-muted);">${p.unique_id}</small>
                </td>
                <td style="font-weight: 600; color: var(--text-muted);">${p.teams?.name || 'INDEPENDENT'}</td>
                <td>
                    <input type="number" id="dv-mark-${row.participant_id}" placeholder="0 - ${currentDVMaxMark}" min="0" max="${currentDVMaxMark}" style="width: 120px; padding: 0.6rem 0.8rem; border: 2px solid var(--border); border-radius: 6px; outline: none; font-size: 1.1rem; font-weight: 700; color: var(--primary);">
                </td>
            </tr>
        `;
    });
}

function toggleDVSelectAll(masterCb) {
    document.querySelectorAll('.dv-row-cb').forEach(cb => {
        cb.checked = masterCb.checked;
        toggleDVRow(cb, cb.value);
    });
}

function toggleDVRow(cb, pId) {
    const markInput = document.getElementById(`dv-mark-${pId}`);
    if (markInput) {
        markInput.disabled = !cb.checked;
        if (!cb.checked) markInput.value = '';
        markInput.style.opacity = cb.checked ? '1' : '0.4';
    }
}


async function submitDirectValuation() {
    const compId = document.getElementById('dvComp').value;
    if (!compId) return showToast('Select a competition first', 'error');
    
    const checkboxes = document.querySelectorAll('.dv-row-cb:checked');
    if (checkboxes.length === 0) return showToast('Select at least one participant who participated.', 'error');
    
    const marksData = [];
    
    // Validation Loop
    for (let cb of checkboxes) {
        const pId = cb.value;
        const markVal = document.getElementById(`dv-mark-${pId}`).value;
        
        if (markVal === '' || isNaN(markVal)) {
            return showToast('Please enter marks for all attended participants.', 'error');
        }
        
        const mark = parseFloat(markVal);
        if (mark < 0 || mark > currentDVMaxMark) {
            return showToast(`Marks must be between 0 and ${currentDVMaxMark}.`, 'error');
        }
        
        marksData.push({
            competition_id: compId,
            participant_id: pId,
            judge_id: user.id, // Auth Admin ID logs the action
            awarded_mark: mark
        });
    }
    
    // Launch the premium confirmation modal
    openConfirmModal("Submit Valuation?", "Submit these marks directly and push the competition to the Fest Manager for publishing?", async () => {
        setLoading('btnSubmitDV', true);
        
        try {
            // 1. Purge any existing marks to avoid duplication logic
            await supabaseClient.from('judgements').delete().eq('competition_id', compId);
            
            // 2. Insert Final Marks
            const { error: insertError } = await supabaseClient.from('judgements').insert(festPayload(marksData));
            if (insertError) throw insertError;
            
            // 3. Force Status to Judgement Complete so it appears in Fest Manager's "Publish Queue"
            const { error: compError } = await supabaseClient.from('competitions').update({ status: 'judgement_complete' }).eq('id', compId);
            if (compError) throw compError;
            
            showToast('Direct Valuation successfully submitted!', 'success');
            
            // Reset Workspace UI
            document.getElementById('dvWorkspace').style.display = 'none';
            document.getElementById('dvComp').value = '';
            
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setLoading('btnSubmitDV', false);
        }
    });
}



// --- MISSING EDIT FUNCTION FIX ---
function editTemplate(index) {
    const templateToEdit = savedTemplates[index];
    if (templateToEdit) {
        openTemplateStudio(templateToEdit);
    } else {
        showToast("Error: Could not load template data.", "error");
    }
}

// Populate the Team dropdown for bulk assignment
async function initBulkTeamControls() {
    const select = document.getElementById('bulkTeamSelect');
    if (!select) return;
    
    // Ensure teamsList is loaded
    if (teamsList.length === 0) {
        const { data } = await supabaseClient.from('teams').select('id, name');
        teamsList = data || [];
    }
    
    select.innerHTML = '<option value="">-- SELECT TEAM --</option>';
    teamsList.forEach(t => select.innerHTML += `<option value="${t.id}">${t.name}</option>`);
}

// Bulk Assign Team
async function bulkAssignTeam() {
    const teamId = document.getElementById('bulkTeamSelect').value;
    const participantIds = getSelectedIds('participants-tbody');
    
    if (!teamId) return showToast('Please select a team first.', 'error');
    if (participantIds.length === 0) return showToast('Select at least one participant.', 'error');
    
    try {
        const { error } = await supabaseClient
            .from('participants')
            .update({ team_id: teamId })
            .in('id', participantIds);
            
        if (error) throw error;
        showToast(`Successfully assigned ${participantIds.length} participants to team.`);
        clearSelection('participants-tbody');
        loadParticipants();
    } catch (e) { showToast(e.message, 'error'); }
}



// --- BRANDING & UI ENGINE ---
let pendingBrandingLogoBase64 = null;

function handleBrandingLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // We convert the logo to Base64 so it can be saved directly in the settings table
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingBrandingLogoBase64 = e.target.result;
        const preview = document.getElementById('branding-logo-preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        
        // Show the remove button once a logo is loaded
        const btnRemove = document.getElementById('btnRemoveLogo');
        if (btnRemove) btnRemove.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

// NEW: Clear Logo Functionality
function removeBrandingLogo() {
    pendingBrandingLogoBase64 = null;
    const preview = document.getElementById('branding-logo-preview');
    preview.src = '';
    preview.style.display = 'none';
    
    // Hide remove button and reset the file input
    const btnRemove = document.getElementById('btnRemoveLogo');
    if (btnRemove) btnRemove.style.display = 'none';
    
    const fileInput = document.getElementById('setting-fest-logo');
    if (fileInput) fileInput.value = '';
}

async function loadBrandingSettings() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('system_branding') : null;
        let data = val ? { value: val } : null;

        // If no custom branding saved for this fest, pull default name & logo from fests table
        if (!data || !data.value) {
            const festId = window.festosAuth ? window.festosAuth.getCurrentFestId() : null;
            if (festId && typeof supabaseClient !== 'undefined') {
                const { data: fData } = await supabaseClient.from('fests').select('name, logo').eq('id', festId).maybeSingle();
                if (fData) {
                    data = { value: { fest_name: fData.name, fest_logo: fData.logo, display_mode: 'both' } };
                }
            }
        }

        if (data && data.value) {
            document.getElementById('setting-fest-name').value = data.value.fest_name || '';
            
            // Load display mode
            const displaySelect = document.getElementById('setting-branding-display');
            if(displaySelect && data.value.display_mode) displaySelect.value = data.value.display_mode;

            if (data.value.fest_logo) {
                const preview = document.getElementById('branding-logo-preview');
                preview.src = data.value.fest_logo;
                preview.style.display = 'block';
                pendingBrandingLogoBase64 = data.value.fest_logo; 
                
                const btnRemove = document.getElementById('btnRemoveLogo');
                if(btnRemove) btnRemove.style.display = 'inline-flex';
            } else {
                const preview = document.getElementById('branding-logo-preview');
                preview.src = '';
                preview.style.display = 'none';
                pendingBrandingLogoBase64 = null;
                const btnRemove = document.getElementById('btnRemoveLogo');
                if(btnRemove) btnRemove.style.display = 'none';
            }
        } else {
            document.getElementById('setting-fest-name').value = '';
            const preview = document.getElementById('branding-logo-preview');
            preview.src = '';
            preview.style.display = 'none';
            pendingBrandingLogoBase64 = null;
            const btnRemove = document.getElementById('btnRemoveLogo');
            if(btnRemove) btnRemove.style.display = 'none';
        }
    } catch (e) {
        console.warn("No custom branding settings found, using defaults.");
    }
}

async function saveBrandingSettings() {
    const festName = document.getElementById('setting-fest-name').value.trim();
    setLoading('btnSaveBranding', true);
    
    const payload = {
        fest_name: festName,
        fest_logo: pendingBrandingLogoBase64,
        display_mode: document.getElementById('setting-branding-display') ? document.getElementById('setting-branding-display').value : 'both'
    };

    try {
        const { error } = window.festosSaveSetting ? await window.festosSaveSetting('system_branding', payload) : await supabaseClient.from('settings').upsert({ id: 'system_branding', value: payload });
        if (error) throw error;

        // Also update fests table so Super Admin and multi-tenant hub immediately have the fest's logo
        const festId = window.festosAuth ? window.festosAuth.getCurrentFestId() : null;
        if (festId && typeof supabaseClient !== 'undefined') {
            try {
                const festUpdates = {};
                if (pendingBrandingLogoBase64 !== undefined) festUpdates.logo = pendingBrandingLogoBase64 || '';
                if (festName) festUpdates.name = festName;
                if (Object.keys(festUpdates).length > 0) {
                    await supabaseClient.from('fests').update(festUpdates).eq('id', festId);
                }
            } catch (festErr) {
                console.warn('Could not sync logo directly to fests table:', festErr);
            }
        }
        
        showToast("Branding Settings Saved to Database!");
        applyGlobalBranding(payload);

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('btnSaveBranding', false);
    }
}

// ============================================================================
// GLOBAL BRANDING ENGINE (DATABASE SYNC)
// ============================================================================


// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================
async function fetchAndApplyBranding() {
    try {
        const festId = window.festosAuth ? window.festosAuth.getCurrentFestId() : (typeof getActiveFestId === 'function' ? getActiveFestId() : null);
        let val = window.festosGetSetting ? await window.festosGetSetting('system_branding', festId) : null;
        if (!val && festId && typeof supabaseClient !== 'undefined') {
            const { data: fData } = await supabaseClient.from('fests').select('name, logo').eq('id', festId).maybeSingle();
            if (fData && (fData.name || fData.logo)) {
                val = { fest_name: fData.name, fest_logo: fData.logo, display_mode: fData.logo ? 'both' : 'name' };
            }
        }
        if (val) {
            if (festId && typeof val === 'object') {
                val._fest_id = festId;
                try {
                    localStorage.setItem('festos_branding_cache_' + festId, JSON.stringify(val));
                } catch(e) {}
            }
            applyGlobalBranding(val);
        }
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    if (!brandingData) return;
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const rawLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '' ? brandingData.fest_logo.trim() : '';
    const validLogo = rawLogo !== '' && rawLogo !== 'festos-logo.svg' && rawLogo !== '/festos-logo.svg';
    const displayMode = brandingData.display_mode || 'both'; // 'both', 'logo', 'name'
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'Festival';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    // 2. Global Favicon Injection (Works on Master Admin, Login, and all pages)
    if (validLogo) {
        let iconLinks = document.querySelectorAll("link[rel~='icon']");
        if (iconLinks.length === 0) {
            let newIcon = document.createElement('link');
            newIcon.rel = 'icon';
            document.head.appendChild(newIcon);
            iconLinks = [newIcon];
        }
        iconLinks.forEach(link => link.href = brandingData.fest_logo);
    }

    // 3. UI Header & Logo Sizing Engine
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1');
    
    brandContainers.forEach(container => {
        if(container.id === 'page-title') return; 

        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // Configurable Logo Sizing (Clean height parameter with max constraints)
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 36px; width: auto; max-width: 180px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // Dynamic Text
        if (showName) {
            let textToDisplay = validName ? brandingData.fest_name : 'FestOS';
            
            if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                textToDisplay += ' Reports Engine';
            }
            
            html += `<span style="letter-spacing: -0.5px; display: inline-block; vertical-align: middle;">${textToDisplay}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'nowrap'; // Keeps logo and text side-by-side cleanly
        
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login') || window.location.pathname.includes('index') || window.location.pathname === '/') {
            container.style.justifyContent = 'center';
        }
    });

    if (typeof window !== 'undefined') {
        window.systemBranding = brandingData;
        const activeFid = brandingData._fest_id || (window.festosAuth ? window.festosAuth.getCurrentFestId() : (typeof getActiveFestId === 'function' ? getActiveFestId() : null));
        if (activeFid) {
            try {
                localStorage.setItem('festos_branding_cache_' + activeFid, JSON.stringify(brandingData));
            } catch(e) {}
        }
    }
}

let pointsAdminSettings = {
    thresholds: { aplus: 90, a: 70, b: 60, c: 50 },
    points_solo: { aplus: 8, a: 7, b: 5, c: 3 },
    points_small: { aplus: 12, a: 10, b: 7, c: 5 },
    points_large: { aplus: 15, a: 12, b: 10, c: 7 },
    pos_points: { p1: 3, p2: 2, p3: 1 },
    poster_interval: 10,
    announcer_offset: 30, // NEW DEFAULT
    registration_offset: 15,
    strict_start_time: true,
    tm_access: true
};

async function loadPointSettings() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('point_system') : null;
        let data = val ? { value: val } : null;

        const defaults = {
            thresholds: { aplus: 90, a: 70, b: 60, c: 50 },
            points_solo: { aplus: 8, a: 7, b: 5, c: 3 },
            points_small: { aplus: 12, a: 10, b: 7, c: 5 },
            points_large: { aplus: 15, a: 12, b: 10, c: 7 },
            pos_points: { p1: 3, p2: 2, p3: 1 },
            poster_interval: 10,
            announcer_offset: 30,
            registration_offset: 15,
            strict_start_time: true,
            lock_date: '',
            tm_access: true
        };

        const v = (data && data.value) ? { ...defaults, ...data.value } : defaults;
        pointsAdminSettings = v;
        
        // Map to UI
        ['aplus', 'a', 'b', 'c'].forEach(g => {
            if(document.getElementById(`th-${g}`)) document.getElementById(`th-${g}`).value = v.thresholds?.[g] ?? defaults.thresholds[g];
            if(document.getElementById(`pt-solo-${g}`)) document.getElementById(`pt-solo-${g}`).value = v.points_solo?.[g] ?? defaults.points_solo[g];
            if(document.getElementById(`pt-small-${g}`)) document.getElementById(`pt-small-${g}`).value = v.points_small?.[g] ?? defaults.points_small[g];
            if(document.getElementById(`pt-large-${g}`)) document.getElementById(`pt-large-${g}`).value = v.points_large?.[g] ?? defaults.points_large[g];
        });
        if(document.getElementById('pos-1')) document.getElementById('pos-1').value = v.pos_points?.p1 ?? defaults.pos_points.p1;
        if(document.getElementById('pos-2')) document.getElementById('pos-2').value = v.pos_points?.p2 ?? defaults.pos_points.p2;
        if(document.getElementById('pos-3')) document.getElementById('pos-3').value = v.pos_points?.p3 ?? defaults.pos_points.p3;
        if(document.getElementById('setting-poster-interval')) document.getElementById('setting-poster-interval').value = v.poster_interval ?? defaults.poster_interval;
        
        // Announcer Offset
        if(document.getElementById('setting-announcer-offset')) document.getElementById('setting-announcer-offset').value = v.announcer_offset !== undefined ? v.announcer_offset : defaults.announcer_offset;
        
        // Registration Offset
        if(document.getElementById('setting-registration-offset')) document.getElementById('setting-registration-offset').value = v.registration_offset !== undefined ? v.registration_offset : defaults.registration_offset;

        // Strict Start Time
        if(document.getElementById('setting-strict-start-time')) {
            const checkbox = document.getElementById('setting-strict-start-time');
            checkbox.checked = v.strict_start_time !== false;
            checkbox.dispatchEvent(new Event('change'));
        }

        if(document.getElementById('setting-lock-date')) document.getElementById('setting-lock-date').value = v.lock_date || '';
        
        if(document.getElementById('setting-tm-access')) {
            const checkbox = document.getElementById('setting-tm-access');
            checkbox.checked = v.tm_access !== false;
            checkbox.dispatchEvent(new Event('change')); 
        }

        // Load Class System Settings
        try {
            const classVal = window.festosGetSetting ? await window.festosGetSetting('class_system') : null;
            const cs = classVal || v.class_system || { enabled: false, mandatory: false, classes: [] };
            window.currentClassSystem = {
                enabled: !!cs.enabled,
                mandatory: !!cs.mandatory,
                classes: Array.isArray(cs.classes) ? cs.classes : []
            };
            const enableCb = document.getElementById('setting-class-enabled');
            const mandCb = document.getElementById('setting-class-mandatory');
            if (enableCb) {
                enableCb.checked = window.currentClassSystem.enabled;
                window.toggleClassSettingsUI(enableCb.checked);
            }
            if (mandCb) {
                mandCb.checked = window.currentClassSystem.mandatory;
                if (mandCb.nextElementSibling) {
                    mandCb.nextElementSibling.style.backgroundColor = mandCb.checked ? 'var(--success)' : '#D1D5DB';
                    if (mandCb.nextElementSibling.nextElementSibling) {
                        mandCb.nextElementSibling.nextElementSibling.style.transform = mandCb.checked ? 'translateX(20px)' : 'translateX(0)';
                    }
                }
            }
            window.renderConfiguredClasses();
        } catch(err) {
            console.warn("Could not load class settings in point settings:", err);
        }

        // Load Student Category Limit Rules
        try {
            const limConfig = await festosGetAdminCategoryLimitConfig();
            const grpEl = document.getElementById('setting-limit-group-events');
            const genEl = document.getElementById('setting-limit-general-comps');
            if (grpEl) grpEl.value = (limConfig.exclude_group_events === false) ? 'include' : 'exclude';
            if (genEl) genEl.value = (limConfig.exclude_general_competitions === false) ? 'include' : 'exclude';
        } catch(limErr) {
            console.warn("Could not load limit rules in point settings:", limErr);
        }
    } catch (e) { console.warn("Using default point settings:", e); }
}

async function savePointSettings() {
    const getVal = (id) => parseInt(document.getElementById(id).value) || 0;
    
    // Class System Settings
    const classEnabled = document.getElementById('setting-class-enabled') ? document.getElementById('setting-class-enabled').checked : false;
    const classMandatory = document.getElementById('setting-class-mandatory') ? document.getElementById('setting-class-mandatory').checked : false;
    window.currentClassSystem.enabled = classEnabled;
    window.currentClassSystem.mandatory = classMandatory;
    if (window.festosSaveSetting) {
        await window.festosSaveSetting('class_system', window.currentClassSystem);
    }

    // Student Category Participation Limit Rules
    try {
        const limConfig = await festosGetAdminCategoryLimitConfig();
        const grpVal = document.getElementById('setting-limit-group-events')?.value;
        const genVal = document.getElementById('setting-limit-general-comps')?.value;
        limConfig.exclude_group_events = (grpVal !== 'include');
        limConfig.exclude_general_competitions = (genVal !== 'include');
        await festosSaveAdminCategoryLimitConfig(limConfig);
        window.cachedCategoryLimitConfig = limConfig;
    } catch(limSaveErr) {
        console.warn("Error saving limit rules in savePointSettings:", limSaveErr);
    }

    const payload = {
        thresholds: { aplus: getVal('th-aplus'), a: getVal('th-a'), b: getVal('th-b'), c: getVal('th-c') },
        points_solo: { aplus: getVal('pt-solo-aplus'), a: getVal('pt-solo-a'), b: getVal('pt-solo-b'), c: getVal('pt-solo-c') },
        points_small: { aplus: getVal('pt-small-aplus'), a: getVal('pt-small-a'), b: getVal('pt-small-b'), c: getVal('pt-small-c') },
        points_large: { aplus: getVal('pt-large-aplus'), a: getVal('pt-large-a'), b: getVal('pt-large-b'), c: getVal('pt-large-c') },
        pos_points: { p1: getVal('pos-1'), p2: getVal('pos-2'), p3: getVal('pos-3') },
        poster_interval: getVal('setting-poster-interval'),
        announcer_offset: getVal('setting-announcer-offset'),
        registration_offset: getVal('setting-registration-offset'),
        strict_start_time: document.getElementById('setting-strict-start-time') ? document.getElementById('setting-strict-start-time').checked : true,
        lock_date: document.getElementById('setting-lock-date') ? document.getElementById('setting-lock-date').value : null,
        tm_access: document.getElementById('setting-tm-access') ? document.getElementById('setting-tm-access').checked : true,
        class_system: window.currentClassSystem
    };

    try {
        const { error } = window.festosSaveSetting ? await window.festosSaveSetting('point_system', payload) : await supabaseClient.from('settings').upsert({ id: 'point_system', value: payload });
        if (error) throw error;
        pointsAdminSettings = payload;
        showToast("Settings Saved Successfully!");
    } catch (e) { showToast(e.message, 'error'); }
}

let teamPointsList = []; 
let pointsDataList = []; 
let filteredPointsList = []; 
let pointsCurrentPage = 1;
let pointsRowsPerPage = 10;

async function loadParticipantPoints() {
    try {
        const [
            pointSettings,
            teamsRes,
            catsRes,
            compsRes,
            participantsRes,
            judgementsRes
        ] = await Promise.all([
            loadPointSettings(),
            festQuery(supabaseClient.from('teams').select('*').order('name')),
            festQuery(supabaseClient.from('categories').select('*').order('name')),
            festQuery(supabaseClient.from('competitions').select('*, categories(name, is_general), participant_competitions(count)')),
            festQuery(supabaseClient.from('participants').select('*, teams(name), categories(name)')),
            festQuery(supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark'))
        ]);

        if (teamsRes.data) teamsList = teamsRes.data;
        if (catsRes.data) categoriesList = catsRes.data;
        const comps = compsRes.data || [];
        const participants = participantsRes.data || [];
        const judgements = judgementsRes.data || [];

        // Create mapping for fast participant lookups
        const pMap = {};
        (participants || []).forEach(p => pMap[p.id] = p);

        let compAverages = {}; 
        (judgements || []).forEach(j => {
           if(!compAverages[j.competition_id]) compAverages[j.competition_id] = {};
           if(!compAverages[j.competition_id][j.participant_id]) compAverages[j.competition_id][j.participant_id] = { marks_array: [] };
           compAverages[j.competition_id][j.participant_id].marks_array.push(parseFloat(j.awarded_mark));
        });

        let compResults = {};
        let teamResults = {};

        // Initialize Team Totals
        (teamsList || []).forEach(t => {
            teamResults[t.id] = { team: t, breakdown: [], totalPoints: 0, participantCount: 0 };
        });

        // Pre-count total participants per team
        (participants || []).forEach(p => {
            if (p.team_id && teamResults[p.team_id]) teamResults[p.team_id].participantCount++;
        });

        (comps || []).forEach(comp => {
            if(!compAverages[comp.id]) return;
            
            const participantsArr = Object.entries(compAverages[comp.id]).map(([pId, data]) => {
                let sortedMarks = data.marks_array.sort((a, b) => a - b);
                if (sortedMarks.length >= 3) sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
                const sum = sortedMarks.reduce((a, b) => a + b, 0);
                return { id: pId, mark: sum / sortedMarks.length };
            }).sort((a, b) => b.mark - a.mark);

            const limit = comp.max_participants || 1;
            let sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            // PARTICIPANT LIMIT RESTRICTION REMOVED HERE
            
            let currentRank = 1;
            let previousScore = -1;

            participantsArr.forEach((p, index) => {
                if (p.mark !== previousScore) currentRank = index + 1;
                previousScore = p.mark;

                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let grade = '-'; let gradePts = 0; let posPts = 0;

                // 1. Assign Grade Points ONLY if >= 50% (Wrapped in Number() to force math addition)
                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) { grade = 'A+'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].aplus) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.a) { grade = 'A'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].a) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.b) { grade = 'B'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].b) || 0; }
                    else { grade = 'C'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].c) || 0; }
                }
                
                // 2. Assign Position Points ALWAYS for Top 3 (Removed the >= 3 limit)
                if (currentRank <= 3) {
                    if (currentRank === 1) posPts = Number(pointsAdminSettings.pos_points.p1) || 0;
                    else if (currentRank === 2) posPts = Number(pointsAdminSettings.pos_points.p2) || 0;
                    else if (currentRank === 3) posPts = Number(pointsAdminSettings.pos_points.p3) || 0;
                }
                
                const totalPts = gradePts + posPts;
                const pData = pMap[p.id];
                const tId = pData ? pData.team_id : null;
                
                // === THE NEW ROUTING LOGIC WITH AWARD TRACKING ===
                if (comp.is_group) {
                    // Group Events: Add ONLY to Team Ledger
                    if (tId && teamResults[tId]) {
                        teamResults[tId].breakdown.push({
                            compName: comp.name,
                            compCat: comp.categories?.name || 'General',
                            mark: p.mark.toFixed(2),
                            maxMark: comp.max_mark || 100,
                            grade: grade,
                            totalPts: totalPts,
                            participantName: (pData?.name || 'Unknown') + " & PARTY",
                            type: 'Group Event',
                            awardType: comp.award_type // Track award type
                        });
                        teamResults[tId].totalPoints += totalPts;
                    }
                } else {
                    // Individual Events: Add to Participant Ledger
                    if(!compResults[p.id]) compResults[p.id] = [];
                    compResults[p.id].push({
                        compName: comp.name, 
                        compCat: comp.categories?.name || 'General',
                        mark: p.mark.toFixed(2), 
                        maxMark: comp.max_mark || 100, 
                        grade: grade, 
                        totalPts: totalPts,
                        awardType: comp.award_type // Track award type here
                    });

                    // Individual Events: ALSO add to Team Ledger
                    if (tId && teamResults[tId]) {
                        teamResults[tId].breakdown.push({
                            compName: comp.name,
                            compCat: comp.categories?.name || 'General',
                            mark: p.mark.toFixed(2), 
                            maxMark: comp.max_mark || 100,
                            grade: grade, 
                            totalPts: totalPts,
                            participantName: pData?.name || 'Unknown',
                            type: 'Individual Event',
                            awardType: comp.award_type // Track award type
                        });
                        teamResults[tId].totalPoints += totalPts;
                    }
                }
            });
        });

        // Apply to participant list with Star/Pen calculation
        pointsDataList = (participants || []).map(p => {
            const breakdown = compResults[p.id] || [];
            const totalPoints = breakdown.reduce((sum, b) => sum + b.totalPts, 0);
            
            // NEW: Calculate specific award points
            const starPoints = breakdown.filter(b => b.awardType === 'star').reduce((sum, b) => sum + b.totalPts, 0);
            const penPoints = breakdown.filter(b => b.awardType === 'pen').reduce((sum, b) => sum + b.totalPts, 0);
            
            return { ...p, totalPoints, starPoints, penPoints, breakdown };
        });

        // Apply to team list and sort highest first
        teamPointsList = Object.values(teamResults).sort((a, b) => b.totalPoints - a.totalPoints);

        populateDropdownSafe('filterPointsCategory', categoriesList);
        populateDropdownSafe('filterPointsTeam', teamsList);
        filterPointsTable(true);
        renderTeamPointsTable();
        
        // Auto-refresh the special ledger if a special tab is currently active
        const starBtn = document.getElementById('btn-view-star');
        const penBtn = document.getElementById('btn-view-pen');
        if (starBtn && starBtn.classList.contains('btn-primary')) renderSpecialLedger('star');
        if (penBtn && penBtn.classList.contains('btn-primary')) renderSpecialLedger('pen');

    } catch (e) { showToast(e.message, 'error'); }
}

// VIEW SWITCHER
function switchPointsView(view) {
    // Reset all buttons to outline
    document.getElementById('btn-view-ind').className = 'btn btn-outline';
    document.getElementById('btn-view-team').className = 'btn btn-outline';
    document.getElementById('btn-view-star').className = 'btn btn-outline';
    document.getElementById('btn-view-pen').className = 'btn btn-outline';
    
    // Re-apply special colors to outline state for star/pen
    document.getElementById('btn-view-star').style.color = '#D97706';
    document.getElementById('btn-view-star').style.borderColor = '#D97706';
    document.getElementById('btn-view-star').style.background = 'transparent';
    
    document.getElementById('btn-view-pen').style.color = '#4338CA';
    document.getElementById('btn-view-pen').style.borderColor = '#4338CA';
    document.getElementById('btn-view-pen').style.background = 'transparent';

    // Hide all containers
    document.getElementById('ind-points-container').style.display = 'none';
    document.getElementById('team-points-container').style.display = 'none';
    document.getElementById('special-points-container').style.display = 'none';
    document.getElementById('ind-filters').style.display = 'none';
    
    // Manage Export Button Visibility
    const exportBtn = document.getElementById('btn-export-points');

    if (view === 'individual') {
        document.getElementById('btn-view-ind').className = 'btn btn-primary';
        document.getElementById('ind-points-container').style.display = 'block';
        document.getElementById('ind-filters').style.display = 'flex';
        exportBtn.style.display = 'inline-flex';
        exportBtn.setAttribute('onclick', 'bulkExportPointsPDF()');
        
    } else if (view === 'team') {
        document.getElementById('btn-view-team').className = 'btn btn-primary';
        document.getElementById('team-points-container').style.display = 'block';
        exportBtn.style.display = 'inline-flex';
        exportBtn.setAttribute('onclick', 'bulkExportTeamPointsPDF()');
        
    } else if (view === 'star') {
        const btn = document.getElementById('btn-view-star');
        btn.className = 'btn'; 
        btn.style.background = '#D97706';
        btn.style.color = 'white';
        
        document.getElementById('special-points-container').style.display = 'block';
        exportBtn.style.display = 'none'; // No checkboxes in this view
        renderSpecialLedger('star');
        
    } else if (view === 'pen') {
        const btn = document.getElementById('btn-view-pen');
        btn.className = 'btn'; 
        btn.style.background = '#4338CA';
        btn.style.color = 'white';

        document.getElementById('special-points-container').style.display = 'block';
        exportBtn.style.display = 'none'; // No checkboxes in this view
        renderSpecialLedger('pen');
    }
}

// SPECIAL AWARD LEDGER RENDERER
function renderSpecialLedger(type) {
    const tbody = document.getElementById('special-points-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // Determine the correct data key based on the button clicked
    const filterKey = type === 'star' ? 'starPoints' : 'penPoints';
    
    // Filter participants who actually have points for this specific award
    const contenders = pointsDataList.filter(p => p[filterKey] > 0);
    
    // Sort by those specific points descending
    contenders.sort((a, b) => b[filterKey] - a[filterKey]);

    // Update table header text
    document.getElementById('special-pts-header').innerText = type === 'star' ? 'Star Points' : 'Pen Points';

    if (contenders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No points awarded yet for this category.</td></tr>`;
        return;
    }

    contenders.forEach((p, index) => {
        let rankBadge = '';
        if(index === 0) rankBadge = '<i class="fa-solid fa-crown" style="color: #F59E0B; font-size: 1.25rem;"></i>';
        else if(index === 1) rankBadge = '<i class="fa-solid fa-medal" style="color: #94A3B8; font-size: 1.25rem;"></i>';
        else if(index === 2) rankBadge = '<i class="fa-solid fa-medal" style="color: #B45309; font-size: 1.25rem;"></i>';
        else rankBadge = `<span style="font-weight: 800; font-size: 1.1rem; color: var(--text-muted);">#${index + 1}</span>`;

        const pointsColor = type === 'star' ? '#D97706' : '#4338CA';
        
        tbody.innerHTML += `
            <tr>
                <td style="text-align: center;">${rankBadge}</td>
                <td>
                    <strong style="font-size: 1.05rem;">${p.name}</strong><br>
                    <small style="font-family: monospace; color: var(--text-muted);">${p.unique_id}</small>
                </td>
                <td><span class="badge" style="background:var(--bg-main); color:var(--text-main); border: 1px solid var(--border);">${p.teams?.name || 'INDEPENDENT'}</span></td>
                <td style="font-weight: 900; color: ${pointsColor}; font-size: 1.25rem;">${p[filterKey]}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewParticipantPointDetails('${p.id}')"><i class="fa-solid fa-list"></i> View Details</button>
                </td>
            </tr>
        `;
    });
}

// Render Team Table
function renderTeamPointsTable() {
    const tbody = document.getElementById('team-points-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (teamPointsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>`;
        return;
    }

    teamPointsList.forEach((t, i) => {
        let rankBadge = i === 0 ? '<i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 5px;"></i>' : '';
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${t.team.id}" ${globalSelections['team-points-tbody']?.has(t.team.id) ? 'checked' : ''} onchange="handleRowSelection('team-points-tbody', this.value, this.checked)"></td>
                <td style="font-weight: 800; font-size: 1.15rem; color: var(--text-main);">${rankBadge}${t.team.name}</td>
                <td style="color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-users" style="margin-right: 5px;"></i>${t.participantCount} Enrolled</td>
                <td style="font-weight: 900; color: var(--primary); font-size: 1.25rem;">${t.totalPoints} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PTS</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewTeamPointDetails('${t.team.id}')"><i class="fa-solid fa-list"></i> View Ledger</button>
                </td>
            </tr>
        `;
    });
}

// Modal Preview for Team
function viewTeamPointDetails(teamId) {
    const t = teamPointsList.find(x => x.team.id === teamId);
    if (!t) return;

   let trs = t.breakdown.length > 0 ? t.breakdown.map((b, i) => `
        <tr>
            <td>
                <strong style="font-weight: 700;">${b.participantName}</strong><br>
                <small style="color: var(--text-muted); font-weight: 600;"><i class="fa-solid ${b.type === 'Group Event' ? 'fa-users' : 'fa-user'}" style="margin-right:4px;"></i>${b.type}</small>
            </td>
            <td style="font-weight: 600;">${b.compName} <br><span class="badge" style="background:var(--primary-light); font-size:0.65rem; margin-top:4px; display: inline-block;">${b.compCat}</span></td>
            <td style="text-align: right; color: var(--text-muted); font-weight: 600;">${b.mark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary); font-size: 1.1rem;">${b.totalPts}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1rem;">No points earned yet.</td></tr>`;

    document.getElementById('listModalTitle').innerText = 'Team Championship Ledger';
    
    document.getElementById('listModalTable').innerHTML = `
        <tbody>
            <tr>
                <td colspan="4" style="padding: 0; border: none; padding-bottom: 1rem;">
                    <div style="background: var(--bg-main); padding: 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 1.4rem; font-weight: 900; line-height: 1.2; color: var(--text-main); text-transform: uppercase;">${t.team.name}</div>
                            <div style="font-family: monospace; color: var(--text-muted); font-size: 0.95rem; font-weight: 600; margin-top: 0.25rem;">${t.participantCount} STUDENTS ENROLLED</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">TOTAL SCORE</div>
                            <div style="font-size: 2rem; font-weight: 900; color: var(--primary); line-height: 1;">${t.totalPoints}</div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr style="background: var(--bg-main); font-size: 0.75rem; color: var(--text-muted);">
                <th style="padding: 0.75rem 1rem;">Contestant / Group</th>
                <th style="padding: 0.75rem 1rem;">Program Evaluated</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Final Marks</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Points</th>
            </tr>
            ${trs}
        </tbody>
    `;
    
    document.getElementById('listModal').classList.add('show');
}

// PDF Generation for Team
function bulkExportTeamPointsPDF() {
    const ids = getSelectedIds('team-points-tbody');
    let targetList = ids.length > 0 ? teamPointsList.filter(t => ids.includes(t.team.id)) : teamPointsList;
    
    if (targetList.length === 0) return showToast("No teams to export", "error");
    
    showToast("Generating Team Reports PDF...", "success");
    const container = document.createElement('div');
    container.style.fontFamily = 'Inter, sans-serif';
    container.style.width = '100%';
    container.style.background = 'white';

    targetList.forEach((t, index) => {
       let trs = t.breakdown.length > 0 ? t.breakdown.map((b, i) => `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px; font-size: 12px;">${i+1}</td>
                <td style="padding: 12px; font-size: 12px;">
                    <strong style="font-weight: 700; color: #0F172A;">${b.participantName.toUpperCase()}</strong><br>
                    <span style="font-size: 9px; color: #64748B; font-weight: 600;">${b.type.toUpperCase()}</span>
                </td>
                <td style="padding: 12px; font-size: 12px; font-weight: 600;">${b.compName.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 12px;">${b.compCat.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.mark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 14px; text-align: right; font-weight: 800; color: #4F46E5;">${b.totalPts}</td>
            </tr>
        `).join('') : `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748B; font-weight: 600;">No programs evaluated yet.</td></tr>`;

        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 30px;">
                    ${getPDFHeaderHTML('Team Championship Ledger')}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #EEF2FF; padding: 20px; border-radius: 12px; border: 1px solid rgba(79, 70, 229, 0.2);">
                    <div>
                        <p style="font-size: 10px; color: #4F46E5; font-weight: 800; margin-bottom: 4px;">TEAM DESIGNATION</p>
                        <h2 style="font-size: 24px; font-weight: 800; color: #0F172A; margin: 0; text-transform: uppercase;">${t.team.name}</h2>
                        <p style="font-size: 12px; color: #64748B; margin-top: 6px; font-weight: 600;">TOTAL ENROLLED: ${t.participantCount} STUDENTS</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: #4F46E5; font-weight: 800; margin-bottom: 4px;">TEAM MANAGER</p>
                        <h2 style="font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; text-transform: uppercase;">${t.team.manager_name || 'NOT ASSIGNED'}</h2>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #1E293B; color: white; text-align: left;">
                            <th style="padding: 12px; font-size: 11px;">#</th>
                            <th style="padding: 12px; font-size: 11px;">CONTESTANT / GROUP</th>
                            <th style="padding: 12px; font-size: 11px;">PROGRAM EVALUATED</th>
                            <th style="padding: 12px; font-size: 11px;">CATEGORY</th>
                            <th style="padding: 12px; font-size: 11px; text-align: center;">FINAL MARKS</th>
                            <th style="padding: 12px; font-size: 11px; text-align: right;">POINTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                    <tfoot>
                        <tr style="background: #F1F5F9; border-top: 2px solid #CBD5E1;">
                            <td colspan="5" style="padding: 16px; text-align: right; font-weight: 800; font-size: 14px; color: #0F172A;">TOTAL CHAMPIONSHIP POINTS:</td>
                            <td style="padding: 16px; text-align: right; font-weight: 900; font-size: 20px; color: #4F46E5;">${t.totalPoints}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 0, 
        filename: typeof getFestFileName === 'function' ? getFestFileName('Team_Championship_Ledger', 'pdf') : `FestOS_Team_Ledger.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported Successfully!'));
}

function populateDropdownSafe(id, list) {
    const el = document.getElementById(id);
    if(el && el.options.length === 1 && list && list.length > 0) {
        list.forEach(i => el.innerHTML += `<option value="${i.name}">${i.name}</option>`);
    }
}

function filterPointsTable(resetPage = true) {
    const query = document.getElementById('searchPointsInput').value.toLowerCase();
    const catFilter = document.getElementById('filterPointsCategory').value;
    const teamFilter = document.getElementById('filterPointsTeam').value;
    const dobFilter = document.getElementById('filterPointsDob').value;
    
    filteredPointsList = pointsDataList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        const matchCat = catFilter === "" || (p.categories?.name || '') === catFilter;
        const matchTeam = teamFilter === "" || (p.teams?.name || '') === teamFilter;
        const matchDob = dobFilter === "" || p.dob === dobFilter;
return matchName && matchCat && matchTeam && matchDob;
    });
    
    // Sort highest points first
    filteredPointsList.sort((a, b) => b.totalPoints - a.totalPoints);
    
    if (resetPage) pointsCurrentPage = 1; 
    renderPointsTable();
}

function renderPointsTable() {
    const tbody = document.getElementById('points-tbody');
    tbody.innerHTML = '';
    
    const start = (pointsCurrentPage - 1) * pointsRowsPerPage;
    const end = start + pointsRowsPerPage;
    const pageData = filteredPointsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>`;
        document.getElementById('points-pagination').innerHTML = '';
        return;
    }

    pageData.forEach(p => {
        tbody.innerHTML += `
            <tr>
<td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}" ${globalSelections['points-tbody']?.has(p.id) ? 'checked' : ''} onchange="handleRowSelection('points-tbody', this.value, this.checked)"></td>                <td style="font-family: monospace; font-weight: 600; color: var(--text-muted);">${p.unique_id}</td>
                <td style="font-weight: 700;">${p.name}</td>
                <td>${p.teams?.name || 'INDEPENDENT'}</td>
                <td style="font-weight: 900; color: var(--primary); font-size: 1.1rem;">${p.totalPoints} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PTS</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewParticipantPointDetails('${p.id}')"><i class="fa-solid fa-list"></i> View Details</button>
                </td>
            </tr>
        `;
    });
    
    renderPointsPagination();
}

function renderPointsPagination() {
    const totalPages = Math.ceil(filteredPointsList.length / pointsRowsPerPage) || 1;
    const paginationContainer = document.getElementById('points-pagination');
    
    const startNum = filteredPointsList.length === 0 ? 0 : ((pointsCurrentPage - 1) * pointsRowsPerPage) + 1;
    const endNum = Math.min(pointsCurrentPage * pointsRowsPerPage, filteredPointsList.length);

   const masterCb = document.querySelector('#points-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredPointsList.length} participants
            <select onchange="pointsRowsPerPage = parseInt(this.value); pointsCurrentPage = 1; renderPointsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${pointsRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${pointsRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${pointsRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${pointsRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="pointsCurrentPage--; renderPointsTable();" ${pointsCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: flex; align-items: center; padding: 0 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--primary);">Page ${pointsCurrentPage} of ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="pointsCurrentPage++; renderPointsTable();" ${pointsCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

// In-App Modal Detail View
function viewParticipantPointDetails(pId) {
    const p = pointsDataList.find(x => x.id === pId);
    if (!p) return;

   let trs = p.breakdown.length > 0 ? p.breakdown.map((b, i) => `
        <tr>
            <td style="font-weight: 600;">${b.compName}</td>
            <td><span class="badge" style="background:var(--bg-main);">${b.compCat}</span></td>
            <!-- CHANGE THE NEXT TWO LINES 👇 -->
            <td style="text-align: right;">${b.mark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary);">${b.totalPts}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1rem;">No evaluated programs yet.</td></tr>`;

    document.getElementById('listModalTitle').innerText = 'Points Breakdown Ledger';
    
    // Fix: Wrapped the header div inside a valid table row/cell structure
    document.getElementById('listModalTable').innerHTML = `
        <tbody>
            <tr>
                <td colspan="4" style="padding: 0; border: none; padding-bottom: 1rem;">
                    <div style="background: var(--bg-main); padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 1.25rem; font-weight: 800; line-height: 1.2;">${p.name}</div>
                        <div style="font-family: monospace; color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">${p.unique_id} | ${(p.teams?.name || 'INDEPENDENT').toUpperCase()}</div>
                    </div>
                </td>
            </tr>
            <tr style="background: var(--bg-main); font-size: 0.75rem; color: var(--text-muted);">
                <th style="padding: 0.75rem 1rem;">Competition</th>
                <th style="padding: 0.75rem 1rem;">Category</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Marks</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Points</th>
            </tr>
            ${trs}
            <tr style="border-top: 2px solid var(--border); background: #f8fafc;">
                <td colspan="3" style="padding: 1rem; text-align: right; font-weight: 800; font-size: 0.9rem;">TOTAL POINTS:</td>
                <td style="padding: 1rem; text-align: right; font-weight: 900; color: var(--primary); font-size: 1.15rem;">${p.totalPoints}</td>
            </tr>
        </tbody>
    `;
    
    document.getElementById('listModal').classList.add('show');
}

// Bulk PDF Report Generator (One Page Per Participant)
async function bulkExportPointsPDF() {
    const ids = getSelectedIds('points-tbody');
    let targetList = ids.length > 0 ? pointsDataList.filter(p => ids.includes(p.id)) : filteredPointsList;
    
    if (targetList.length === 0) return showToast("No participants to export", "error");
    
    showToast("Generating Multi-Page PDF...", "success");
    const container = document.createElement('div');
    container.style.fontFamily = 'Inter, sans-serif';
    container.style.width = '100%';
    container.style.background = 'white';

    targetList.forEach((p, index) => {
       let trs = p.breakdown.length > 0 ? p.breakdown.map((b, i) => `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px; font-size: 12px;">${i+1}</td>
                <td style="padding: 12px; font-size: 12px; font-weight: 600;">${b.compName}</td>
                <td style="padding: 12px; font-size: 12px;">${b.compCat}</td>
                <!-- CHANGE THE NEXT TWO LINES 👇 -->
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.mark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 12px; text-align: right; font-weight: 700; color: #4F46E5;">${b.totalPts}</td>
            </tr>
        `).join('') : `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748B;">No programs evaluated yet.</td></tr>`;

        // The "page-break-after: always" ensures each participant gets their own clean page
        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 30px;">
                    ${getPDFHeaderHTML('Participant Point Ledger')}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid #E2E8F0;">
                    <div>
                        <p style="font-size: 10px; color: #64748B; font-weight: 700; margin-bottom: 4px;">PARTICIPANT NAME</p>
                        <h2 style="font-size: 18px; color: #0F172A; margin: 0; text-transform: uppercase;">${p.name}</h2>
                        <p style="font-family: monospace; font-size: 12px; color: #64748B; margin-top: 4px;">${p.unique_id}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: #64748B; font-weight: 700; margin-bottom: 4px;">TEAM AFFILIATION</p>
                        <h2 style="font-size: 16px; color: #0F172A; margin: 0; text-transform: uppercase;">${p.teams?.name || 'INDEPENDENT'}</h2>
                        <p style="font-size: 12px; color: #64748B; margin-top: 4px;">BATCH ${p.batch_no || '1'}</p>
                    </div>
                </div>
            

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #1E293B; color: white; text-align: left;">
                            <th style="padding: 12px; font-size: 11px;">#</th>
                            <th style="padding: 12px; font-size: 11px;">PROGRAM (COMPETITION)</th>
                            <th style="padding: 12px; font-size: 11px;">CATEGORY</th>
                            <th style="padding: 12px; font-size: 11px; text-align: center;">AWARDED MARKS</th>
                            <th style="padding: 12px; font-size: 11px; text-align: right;">POINTS EARNED</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                    <tfoot>
                        <tr style="background: #F1F5F9; border-top: 2px solid #CBD5E1;">
                            <td colspan="4" style="padding: 16px; text-align: right; font-weight: 800; font-size: 14px; color: #0F172A;">TOTAL AGGREGATED POINTS:</td>
                            <td style="padding: 16px; text-align: right; font-weight: 900; font-size: 16px; color: #4F46E5;">${p.totalPoints}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 0, 
        filename: typeof getFestFileName === 'function' ? getFestFileName('Participant_Point_Ledger', 'pdf') : `Fest_Participant_Points_Report.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported Successfully!'));
}

async function handleElementUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show a quick loading state on the button to let the admin know it's uploading
    const uploadBtn = event.target.nextElementSibling; 
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `element_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('elements') // Pointing to the new bucket we created in SQL
            .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // 2. Get the permanent Public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from('elements')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        // 3. Load the URL into the Studio Canvas
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = function() {
            const key = 'Element_' + Date.now();
            
            // Scale down initially if the image is massive
            let initialWidth = img.naturalWidth;
            let initialHeight = img.naturalHeight;
            if (initialWidth > 300) {
                initialHeight = initialHeight * (300 / initialWidth);
                initialWidth = 300;
            }

            // Inside handleElementUpload, update the properties:
            studioActiveData.fields[key] = {
                enabled: true,
                displayName: file.name.substring(0, 15) + '...',
                x: 50,
                y: 50,
                w: Math.round(initialWidth),
                h: Math.round(initialHeight),
                isImage: true,
                isStaticElement: true,
                aspectLocked: true, // NEW: Default to locked
                aspectRatio: initialWidth / initialHeight, // NEW: Store initial ratio
                src: publicUrl, 
                imgObj: img
            };
            
            renderLayersPanel();
            selectStudioLayer(key);
            
            // Clear the input so the same file can be uploaded again if needed
            document.getElementById('studio-element-upload').value = ''; 
        };
        
        img.src = publicUrl;

    } catch (err) {
        console.error("Upload error:", err);
        showToast("Failed to upload element to cloud.", "error");
    } finally {
        // Reset the button UI
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
}



function toggleAspectRatioLock(key) {
    const data = studioActiveData.fields[key];
    data.aspectLocked = !data.aspectLocked;
    
    // Recalculate ratio upon locking if they changed it while unlocked
    if (data.aspectLocked && data.w > 0 && data.h > 0) {
        data.aspectRatio = data.w / data.h;
    }
    renderPropertiesPanel();
}

// --- UNDO / REDO STATE ENGINE ---
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 25; // Prevents memory leaks
let isRestoringHistory = false;

function saveHistoryState() {
    if (!studioActiveData || !studioActiveData.fields || isRestoringHistory) return;
    
    // Create a deep copy of the layer configurations
    const stateCopy = {};
    for (const key in studioActiveData.fields) {
        stateCopy[key] = { ...studioActiveData.fields[key] };
    }
    
    undoStack.push(stateCopy);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    
    redoStack = []; // A new action invalidates the future redo timeline
    updateHistoryButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    isRestoringHistory = true;
    
    // Push current to redo
    const currentState = {};
    for (const key in studioActiveData.fields) {
        currentState[key] = { ...studioActiveData.fields[key] };
    }
    redoStack.push(currentState);
    
    // Restore past
    studioActiveData.fields = undoStack.pop();
    finalizeHistoryAction();
}

function redo() {
    if (redoStack.length === 0) return;
    isRestoringHistory = true;
    
    // Push current to undo
    const currentState = {};
    for (const key in studioActiveData.fields) {
        currentState[key] = { ...studioActiveData.fields[key] };
    }
    undoStack.push(currentState);
    
    // Restore future
    studioActiveData.fields = redoStack.pop();
    finalizeHistoryAction();
}

function finalizeHistoryAction() {
    if (typeof multiSelectedLayers !== 'undefined') multiSelectedLayers.clear(); // CRITICAL FIX
    studioActiveField = null; 
    updateHistoryButtons();
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
    isRestoringHistory = false;
}

function updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

async function handleFontUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show loading state
    const uploadBtn = event.target.nextElementSibling;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_').split('_')[0]; 
        const fileName = `font_${safeName}_${Date.now()}.${fileExt}`;
        const familyName = `CustomFont_${Date.now()}`; // Unique internal CSS name

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('fonts')
            .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from('fonts')
            .getPublicUrl(fileName);
        const publicUrl = publicUrlData.publicUrl;

        // 3. Load the Font into the Browser natively
        const customFont = new FontFace(familyName, `url(${publicUrl})`);
        const loadedFace = await customFont.load();
        document.fonts.add(loadedFace);

        // 4. Add to the Global Dropdown list
        const displayName = file.name.split('.')[0].substring(0, 15);
        AVAILABLE_FONTS.push({ name: `⭐ ${displayName}`, value: familyName });

        // 5. Save the font data into the template state so it persists in the database
        if (!studioActiveData.customFonts) studioActiveData.customFonts = [];
        studioActiveData.customFonts.push({ 
            name: `⭐ ${displayName}`, 
            family: familyName, 
            url: publicUrl 
        });

        // 6. Automatically apply the new font to the currently selected text layer (if any)
        if (studioActiveField && !studioActiveData.fields[studioActiveField].isImage) {
            saveHistoryState(); // From your undo/redo engine
            studioActiveData.fields[studioActiveField].font = familyName;
        }

        renderPropertiesPanel();
        drawStudioCanvas();
        showToast("Custom font added successfully!", "success");

    } catch (err) {
        console.error("Font upload error:", err);
        showToast("Failed to upload font.", "error");
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        event.target.value = ''; // Reset input
    }
}

// ==========================================
// MASTER DATA CENTER & ZIP ENGINE (V2.0)
// ==========================================

let pendingSecureAction = null;
let pendingFileToImport = null;

// ALL Database tables in correct dependency order
const MASTER_TABLES = [
    'settings', 
    'categories', 
    'teams', 
    'competitions', 
    'templates', 
    'participants', 
    'participant_competitions', 
    'judgements', 
    'appeals'
];

// ALL Supabase Storage Buckets containing media
const STORAGE_BUCKETS = ['photos', 'templates', 'elements', 'fonts'];

function requestSecureAction(action) {
    pendingSecureAction = action;
    document.getElementById('master-auth-password').value = '';
    document.getElementById('masterPasswordModal').classList.add('show');
}

function handleBackupSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingFileToImport = file;
    requestSecureAction('import');
    event.target.value = ''; // Reset input
}

async function verifyMasterPassword() {
    const btn = document.getElementById('btn-verify-master');
    const pwd = document.getElementById('master-auth-password').value;
    
    if(!pwd) return showToast("Password required", "error");
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, role')
            .eq('username', user.username)
            .eq('password_hash', pwd)
            .single();

        if (error || !data) throw new Error("Invalid password");
        if (data.role !== 'master_admin') throw new Error("Unauthorized access level.");

        document.getElementById('masterPasswordModal').classList.remove('show');
        
        // Route to the requested action
        if (pendingSecureAction === 'export') await executeZipExport();
        if (pendingSecureAction === 'import') await executeZipImport();
        if (pendingSecureAction === 'reset') await executeFactoryReset();

    } catch (err) {
        showToast("Authentication failed: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Verify';
        btn.disabled = false;
        pendingSecureAction = null;
    }
}

// --- 1. FULL EXPORT LOGIC (DATABASE + STORAGE) ---
async function executeZipExport() {
    showToast("Gathering database & media files... This may take a minute.", "success");
    const zip = new JSZip();
    const dbFolder = zip.folder("database");
    const storageFolder = zip.folder("storage");

    try {
        // A. Export Database Tables
        for (const table of MASTER_TABLES) {
            const { data, error } = await supabaseClient.from(table).select('*');
            if (error) console.error(`Error fetching ${table}:`, error);
            dbFolder.file(`${table}.json`, JSON.stringify(data || [], null, 2));
        }

        // B. Export Storage Buckets (Images/Fonts)
        for (const bucket of STORAGE_BUCKETS) {
            const bucketFolder = storageFolder.folder(bucket);
            const { data: files, error: listError } = await supabaseClient.storage.from(bucket).list();
            
            if (listError || !files) continue;

            for (const file of files) {
                if (file.name === '.emptyFolderPlaceholder') continue; // Skip supabase hidden files
                
                const { data: blob, error: downloadError } = await supabaseClient.storage.from(bucket).download(file.name);
                if (blob && !downloadError) {
                    bucketFolder.file(file.name, blob);
                }
            }
        }

        // C. Generate Manifest
        zip.file("festos_manifest.json", JSON.stringify({
            exported_at: new Date().toISOString(),
            exported_by: user.username,
            version: "2.0",
            includes_media: true
        }, null, 2));

        // D. Download the ZIP
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `FestOS_FullBackup_${new Date().toISOString().split('T')[0]}.zip`);
        showToast("Complete System Export successful!", "success");

    } catch (err) {
        console.error("Export Error:", err);
        showToast("Failed to export complete data.", "error");
    }
}

// --- 2. FULL IMPORT LOGIC (DATABASE + STORAGE) ---
async function executeZipImport() {
    if (!pendingFileToImport) return;
    showToast("Restoring database and media files... Do not close page.", "warning");
    
    try {
        const zip = await JSZip.loadAsync(pendingFileToImport);
        
        // 1. Verify Manifest
        const manifestFile = zip.file("festos_manifest.json");
        if (!manifestFile) throw new Error("Invalid backup file. Manifest missing.");

        // 2. Restore Database Tables (In STRICT dependency order)
        for (const table of MASTER_TABLES) {
            const file = zip.file(`database/${table}.json`);
            if (file) {
                const jsonStr = await file.async("string");
                const tableData = JSON.parse(jsonStr);
                
                if (tableData.length > 0) {
                    const { error } = await supabaseClient.from(table).upsert(tableData);
                    if (error) console.error(`Import Error on ${table}:`, error);
                }
            }
        }

        // 3. Restore Storage Buckets (Upsert overwrites duplicates safely)
        for (const bucket of STORAGE_BUCKETS) {
            const folderRegex = new RegExp(`^storage/${bucket}/(.*)$`);
            // Find all files in the zip that belong in this bucket
            const filesInBucket = Object.keys(zip.files).filter(name => folderRegex.test(name) && !zip.files[name].dir);

            for (const filename of filesInBucket) {
                const fileObj = zip.file(filename);
                if (!fileObj) continue;

                const blob = await fileObj.async("blob");
                const cleanName = filename.replace(`storage/${bucket}/`, '');

                const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(cleanName, blob, {
                    upsert: true,
                    contentType: blob.type || 'application/octet-stream'
                });
                
                if (uploadError) console.error(`Failed to restore ${cleanName}:`, uploadError);
            }
        }
        
        showToast("System perfectly restored! Reloading...", "success");
        setTimeout(() => location.reload(), 2000);

    } catch (err) {
        console.error("Import Error:", err);
        showToast("Failed to restore system: " + err.message, "error");
    } finally {
        pendingFileToImport = null;
    }
}


async function resolveAppeal(ticketId, newStatus) {
    openConfirmModal("Resolve Appeal?", `Mark this ticket as ${newStatus.toUpperCase()}?`, async () => {
        try {
            const { error } = await supabaseClient.from('appeals').update({ status: newStatus }).eq('id', ticketId);
            if (error) throw error;
            showToast(`Ticket ${newStatus}!`);
            loadAdminAppeals();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function deleteAppeal(ticketId) {
    openConfirmModal("Delete Appeal?", "Are you sure you want to permanently delete this appeal ticket? This action cannot be undone.", async () => {
        try {
            const { error } = await supabaseClient.from('appeals').delete().eq('id', ticketId);
            if (error) throw error;
            showToast("Appeal ticket deleted successfully.");
            loadAdminAppeals();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function executeFactoryReset() {
    openConfirmModal("Total Factory Reset?", "FINAL WARNING: This will permanently delete ALL tables, settings, photos, templates, and fonts. Proceed?", async () => {
        showToast("Initiating Total Factory Reset...", "warning");
        try {
            const reverseOrder = [...MASTER_TABLES].reverse();
            for (const table of reverseOrder) {
                await supabaseClient.from(table).delete().not('id', 'is', null);
            }
            for (const bucket of STORAGE_BUCKETS) {
                const { data: files } = await supabaseClient.storage.from(bucket).list();
                if (files && files.length > 0) {
                    const filePaths = files.map(f => f.name).filter(name => name !== '.emptyFolderPlaceholder');
                    if (filePaths.length > 0) await supabaseClient.storage.from(bucket).remove(filePaths);
                }
            }
            showToast("System Reset Complete. Everything wiped. Reloading...", "success");
            setTimeout(() => location.reload(), 2000);
        } catch (err) {
            showToast("Failed to complete full reset.", "error");
        }
    });
}

async function loadAdminAppeals() {
    try {
        let { data, error } = await festQuery(supabaseClient
            .from('appeals')
            .select('*, teams(name), competitions(name), participants(name)'))
            .order('created_at', { ascending: false });

        if (error && (error.code === '42703' || error.message?.includes('column appeals.fest_id does not exist'))) {
            console.warn("appeals.fest_id column not present yet in Supabase, running fallback query...");
            const fb = await supabaseClient
                .from('appeals')
                .select('*, teams(name), competitions(name), participants(name)')
                .order('created_at', { ascending: false });
            data = fb.data;
            error = fb.error;
        }

        if (error) throw error;
        
        const tbody = document.getElementById('admin-appeals-tbody'); 
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No appeals found.</td></tr>';
            return;
        }

        data.forEach(ticket => {
            const statusClass = ticket.status === 'pending' ? 'badge-warning' : (ticket.status === 'approved' ? 'badge-success' : 'badge-danger');
            
            tbody.innerHTML += `
                <tr>
                    <td><span class="badge" style="background:var(--bg-main);">${ticket.issue_type}</span></td>
                    <td style="font-weight:700;">${ticket.teams?.name}</td>
                    <td>${ticket.competitions?.name || '-'} <br> <small>${ticket.participants?.name || '-'}</small></td>
                    <td><div style="max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ticket.description}">${ticket.description}</div></td>
                    <td><span class="badge ${statusClass}">${ticket.status.toUpperCase()}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${ticket.status === 'pending' ? `
                                <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--success); border-color:var(--success);" onclick="resolveAppeal('${ticket.id}', 'approved')" title="Approve"><i class="fa-solid fa-check"></i></button>
                                <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="resolveAppeal('${ticket.id}', 'rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                            ` : '<span style="color:var(--text-muted); font-size:0.8rem; margin-right: 0.5rem;">Resolved</span>'}
                            
                            <!-- Master Admin Only Delete Button -->
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteAppeal('${ticket.id}')" title="Delete Ticket"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (e) { showToast(e.message, 'error'); }
}






// ==========================================
// ADMIN CERTIFICATE GENERATION ENGINE
// ==========================================
async function bulkDownloadCertificates(compId) {
    showToast("Fetching data and preparing certificates...", "success");

    try {
        // 1. Fetch Certificate Template
        const { data: certTemplates } = await supabaseClient.from('templates').select('*').eq('type', 'certificate').limit(1);
        if (!certTemplates || certTemplates.length === 0) throw new Error("No Certificate template found. Please design one in the Poster Templates Studio first.");
        const template = certTemplates[0];

        // 2. Fetch Competition & Judgements with Registered Count
        const { data: comp } = await supabaseClient
            .from('competitions')
            .select('*, categories(name), participant_competitions(count)')
            .eq('id', compId)
            .single();
            
        if (!comp) throw new Error("Competition data could not be found.");

        const { data: judgements } = await supabaseClient
            .from('judgements')
            .select('participant_id, awarded_mark, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);
            
        if (!judgements || judgements.length === 0) throw new Error("No judgements found for this competition yet.");

        // 3. Group, Average, Drop Outliers (FIXED: Skip deleted participants)
        const pMap = {};
        judgements.forEach(j => {
            if (!j.participants) return; // Prevent crash if participant was deleted
            
            const pId = j.participant_id;
            if (!pMap[pId]) pMap[pId] = { participant: j.participants, marks: [] };
            pMap[pId].marks.push(parseFloat(j.awarded_mark));
        });

        // 4. Calculate Final Marks 
        const allResults = Object.values(pMap).map(p => {
            let sortedMarks = p.marks.sort((a, b) => a - b);
            if (sortedMarks.length >= 3) {
                sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
            }
            const avg = sortedMarks.reduce((a, b) => a + b, 0) / sortedMarks.length;
            return { ...p, avgMark: avg };
        }).sort((a, b) => b.avgMark - a.avgMark); 

        // 5. Determine Grades and Positions with Tie Handling
        await loadPointSettings(); 
        
        let currentRank = 1;
        let previousScore = -1;

        allResults.forEach((r, idx) => {
            // Increment rank only if the score differs from the previous
            if (r.avgMark !== previousScore) currentRank = idx + 1;
            previousScore = r.avgMark;
            r.numericRank = currentRank;

            let percent = (r.avgMark / (comp.max_mark || 100)) * 100;
            let gradeStr = 'N/A';
            if (percent >= 50) {
                if (percent >= pointsAdminSettings.thresholds.aplus) gradeStr = 'A+';
                else if (percent >= pointsAdminSettings.thresholds.a) gradeStr = 'A';
                else if (percent >= pointsAdminSettings.thresholds.b) gradeStr = 'B';
                else gradeStr = 'C';
            }
            r.grade = gradeStr;
            
            // Assign textual position based on the calculated rank
            r.position = currentRank === 1 ? 'FIRST PLACE' : currentRank === 2 ? 'SECOND PLACE' : currentRank === 3 ? 'THIRD PLACE' : 'PARTICIPANT';
        });

        // 6. Slice Top 3 Based on Rank (This safely captures all tied participants)
        const results = allResults.filter(r => r.numericRank <= 3);

        if (results.length === 0) throw new Error("Could not calculate top standings. No valid participant data.");

        // For Group Competitions, expand certificates to ALL enrolled squad members of the winning teams
        let finalCertList = [];
        if (comp.is_group) {
            const { data: squadEnrollments } = await supabaseClient
                .from('participant_competitions')
                .select('participant_id, is_leader, participants(id, name, unique_id, team_id, teams(name))')
                .eq('competition_id', compId);

            results.forEach(res => {
                const teamId = res.participant?.team_id;
                const squad = (squadEnrollments || []).filter(se => se.participants && (se.participants.team_id === teamId || se.participant_id === res.participant_id));
                if (squad && squad.length > 0) {
                    squad.forEach(member => {
                        finalCertList.push({
                            participant: member.participants,
                            numericRank: res.numericRank,
                            position: res.position,
                            grade: res.grade,
                            avgMark: res.avgMark
                        });
                    });
                } else {
                    finalCertList.push(res);
                }
            });
        } else {
            finalCertList = results;
        }

        // 7. Generate PDF via Canvas
        const { jsPDF } = window.jspdf;
        let pdf = null;
        let pdfConfig = null;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        await new Promise((resolve, reject) => {
            img.onload = resolve; img.onerror = reject; img.src = template.bg_base64;
        });

        // Preload custom fonts from template
        if (template.customFonts && template.customFonts.length > 0) {
            for (const fontData of template.customFonts) {
                try {
                    const customFont = new FontFace(fontData.family, `url(${fontData.url})`);
                    const loadedFace = await customFont.load();
                    document.fonts.add(loadedFace);
                } catch (e) { console.error("Font load error:", e); }
            }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || 1080; 
        canvas.height = img.naturalHeight || 1080;

        for (let i = 0; i < finalCertList.length; i++) {
            const entry = finalCertList[i];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // FIXED: Added fallback placeholders so it never crashes on null data
            const mappedData = {
                'ParticipantName': (entry.participant?.name || 'UNKNOWN').toUpperCase(),
                'UniqueID': entry.participant?.unique_id || '',
                'TeamName': (entry.participant?.teams?.name || 'INDEPENDENT').toUpperCase(),
                'Category': (comp.categories?.name || 'GENERAL').toUpperCase(),
                'Competition': (comp.name || 'EVENT').toUpperCase(),
                'Position': entry.position,
                'Grade': entry.grade,
                'IssueDate': new Date().toLocaleDateString()
            };

            // Draw QR Code if enabled in template
            if (template.fields['QRCode'] && template.fields['QRCode'].enabled) {
                const f = template.fields['QRCode'];
                const qrContainer = document.createElement('div');
                new QRCode(qrContainer, { text: entry.participant.unique_id, width: f.w, height: f.h, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
                await new Promise(r => setTimeout(r, 50));
                const qrCanvas = qrContainer.querySelector('canvas');
                if(qrCanvas) ctx.drawImage(qrCanvas, f.x, f.y, f.w, f.h);
            }

            // Draw text and static overlays
            if(template.fields) {
                for (const [key, fieldConfig] of Object.entries(template.fields)) {
                    if (!fieldConfig.enabled || key === 'QRCode' || fieldConfig.isImage) {
                        if (fieldConfig.isImage && fieldConfig.isStaticElement && fieldConfig.src && fieldConfig.enabled) {
                            try {
                                const staticImg = await new Promise((resolve) => {
                                    const pImg = new Image(); pImg.crossOrigin = "Anonymous";
                                    pImg.onload = () => resolve(pImg); pImg.onerror = () => resolve(null); pImg.src = fieldConfig.src;
                                });
                                if (staticImg) ctx.drawImage(staticImg, fieldConfig.x, fieldConfig.y, fieldConfig.w, fieldConfig.h);
                            } catch (err) {}
                        }
                        continue;
                   }
                    const text = fieldConfig.isCustom ? fieldConfig.displayName : (mappedData[key] || ""); 
                    if (!text) continue;
                    ctx.textAlign = fieldConfig.align || 'left'; 
                    ctx.fillStyle = fieldConfig.color || '#000000';
                    ctx.font = `${fieldConfig.weight || 'bold'} ${fieldConfig.size || 40}px ${fieldConfig.font || 'sans-serif'}`;
                    renderCanvasText(ctx, text, fieldConfig);
                }
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            if (!pdfConfig) {
                const baseWidthMm = 297; // A4 Landscape
                const calculatedHeightMm = (canvas.height * baseWidthMm) / canvas.width;
                pdfConfig = {
                    width: baseWidthMm,
                    height: calculatedHeightMm,
                    orientation: baseWidthMm > calculatedHeightMm ? 'landscape' : 'portrait'
                };
                pdf = new jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < results.length - 1) pdf.addPage();
        }

        pdf.save(`${comp.name.replace(/\s+/g, '_')}_Certificates.pdf`);
        showToast("Certificates Downloaded Successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
}

// ==========================================
// COMPETITION MASTER LOG ENGINE
// ==========================================
let currentLogData = null;

async function viewCompetitionLog(compId) {
    const comp = competitionsList.find(c => c.id === compId);
    if(!comp) return;

    document.getElementById('log-comp-name').innerText = comp.name;
    document.getElementById('log-cat-name').innerText = comp.categories?.name || 'GENERAL';

    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem; display: block;"></i> Fetching Records...</td></tr>';
    document.getElementById('compLogModal').classList.add('show');

    try {
        await loadPointSettings(); // Ensure points settings are loaded for grade calculation

        // Fetch enrollments and participants
        const { data: enrollments, error: enrollErr } = await supabaseClient
            .from('participant_competitions')
            .select('participant_id, is_present, code_letter, is_leader, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);

        if (enrollErr) throw enrollErr;

        // Fetch judgements and judge names
        const { data: judgements, error: judgeErr } = await supabaseClient
            .from('judgements')
            .select('participant_id, awarded_mark, users(username)')
            .eq('competition_id', compId);

        if (judgeErr) throw judgeErr;

        // Calculate results (marks, grades, points)
        let compResults = {};
        if (judgements && judgements.length > 0) {
            let pMarks = {};
            judgements.forEach(j => {
                if(!pMarks[j.participant_id]) pMarks[j.participant_id] = [];
                pMarks[j.participant_id].push(parseFloat(j.awarded_mark));
            });

            let pAverages = Object.keys(pMarks).map(pId => {
                let marks = pMarks[pId].sort((a, b) => a - b);
                if (marks.length >= 3) marks = marks.slice(1, marks.length - 1);
                let avg = marks.reduce((a, b) => a + b, 0) / marks.length;
                return { id: pId, mark: avg };
            }).sort((a, b) => b.mark - a.mark);

           const limit = comp.max_participants || 1;
            const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            // REMOVED: const eligibleForPosPts = enrollments.length >= 3;
            
            let currentRank = 1;
            let previousScore = -1;

            pAverages.forEach((p, idx) => {
                // Proper tie handling
                if (p.mark !== previousScore) currentRank = idx + 1;
                previousScore = p.mark;

                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let grade = '-'; let gradePts = 0; let posPts = 0;

                // 1. Assign Grade Points ONLY if >= 50% (Wrapped in Number() to force math addition)
                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) { grade = 'A+'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].aplus) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.a) { grade = 'A'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].a) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.b) { grade = 'B'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].b) || 0; }
                    else { grade = 'C'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].c) || 0; }
                }

                // 2. Assign Position Points ALWAYS for Top 3 (Removed the >= 3 limit)
                if (currentRank <= 3) {
                    if (currentRank === 1) posPts = Number(pointsAdminSettings.pos_points.p1) || 0;
                    else if (currentRank === 2) posPts = Number(pointsAdminSettings.pos_points.p2) || 0;
                    else if (currentRank === 3) posPts = Number(pointsAdminSettings.pos_points.p3) || 0;
                }

                compResults[p.id] = {
                    rank: currentRank,
                    mark: p.mark.toFixed(2),
                    grade: grade,
                    points: gradePts + posPts
                };
            });
        }

        currentLogData = { comp, enrollments: enrollments || [], judgements: judgements || [], compResults };

        let totalEnrolled = enrollments ? enrollments.length : 0;
        let totalPresent = enrollments ? enrollments.filter(e => e.is_present).length : 0;
        let uniqueJudges = new Set((judgements || []).map(j => j.users?.username).filter(Boolean));

        document.getElementById('log-summary').innerHTML = `
            <div class="badge" style="background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-users"></i> ${totalEnrolled} ENROLLED</div>
            <div class="badge" style="background: var(--success-light); color: var(--success); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-check-circle"></i> ${totalPresent} CHECKED-IN</div>
            <div class="badge" style="background: var(--primary-light); color: var(--primary); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-gavel"></i> ${uniqueJudges.size} JUDGE(S)</div>
        `;

        tbody.innerHTML = '';
        if (!enrollments || enrollments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 2rem;">No participants enrolled in this event.</td></tr>';
            return;
        }

      // Sort alphabetically by participant name
        enrollments.sort((a, b) => a.participants.name.localeCompare(b.participants.name)).forEach(e => {
            const p = e.participants;
            const statusBadge = e.is_present 
                ? '<span class="badge" style="background: var(--success-light); color: var(--success); font-size: 0.7rem;">REGISTERED</span>' 
                : '<span class="badge" style="background: var(--warning-light); color: #D97706; font-size: 0.7rem;">PENDING</span>';
            
            // Map judgements for this specific participant
            const pJudgements = (judgements || []).filter(j => j.participant_id === e.participant_id);
            let judgeHtml = '';
            if(pJudgements.length > 0) {
                judgeHtml = pJudgements.map(j => `<div style="font-size: 0.85rem; margin-bottom: 4px; background: var(--bg-main); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); display: inline-block; margin-right: 4px;"><span style="color: var(--text-muted); font-weight: 600;">${j.users?.username || 'Admin'}:</span> <span style="color:var(--primary); font-weight: 800;">${j.awarded_mark}</span></div>`).join('');
            } else {
                judgeHtml = '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; background: var(--bg-main); padding: 4px 8px; border-radius: 4px;">Awaiting Marks</span>';
            }

            // Map Results Data
            const res = compResults[e.participant_id];
            const fMark = res ? res.mark : '-';
            const fGrade = res ? `<span style="font-weight: 800; color: var(--text-main);">${res.grade}</span>` : '-';
            const fPoints = res ? `<span style="font-weight: 800; color: var(--primary);">${res.points}</span>` : '-';

            // --- DISPLAY "& PARTY" FOR LEADERS IN ADMIN LOG ---
            let displayName = p.name;
            let roleTag = '';
            if (comp.is_group) {
                if (e.is_leader) {
                    displayName += ' & PARTY';
                    roleTag = '<br><span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; margin-top: 4px;">GROUP LEADER</span>';
                } else {
                    roleTag = '<br><span class="badge" style="background: var(--bg-main); color: var(--text-muted); font-size: 0.65rem; margin-top: 4px;">MEMBER</span>';
                }
            }

            tbody.innerHTML += `
                <tr>
                    <td style="white-space: nowrap;">
                        <strong style="display:block; font-size: 1rem; color: var(--text-main);">${displayName}</strong>
                        <small style="font-family:monospace; font-weight: 600; color:var(--text-muted);">${p.unique_id}</small>
                        ${roleTag}
                    </td>
                    <td><span class="badge" style="background: var(--bg-main); color: var(--text-muted);">${p.teams?.name || 'INDEPENDENT'}</span></td>
                    <td style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">${e.code_letter || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>${judgeHtml}</td>
                    <td style="font-weight: 800; font-size: 1.1rem;">${fMark}</td>
                    <td>${fGrade}</td>
                    <td>${fPoints}</td>
                </tr>
            `;
        });

    } catch (e) {
        showToast(e.message, 'error');
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger); font-weight: 600; padding: 2rem;">Error loading log data.</td></tr>`;
    }
}

async function downloadCompLogPDF() {
    if(!currentLogData) return showToast("No data to export", "error");
    showToast("Generating Premium Report...", "success");

    const { comp, enrollments, judgements, compResults } = currentLogData;
    const totalEnrolled = enrollments.length;
    const totalPresent = enrollments.filter(e => e.is_present).length;
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    
    // Header
    container.innerHTML = `
        ${getPDFHeaderHTML('Competition Master Log')}
        
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="font-size: 16px; color: #0F172A; margin: 0; margin-bottom: 4px; text-transform: uppercase; font-weight: 800;">${comp.name}</h3>
                <p style="font-size: 11px; color: #64748B; margin: 0; text-transform: uppercase; font-weight: 600;">CATEGORY: ${comp.categories?.name || 'GENERAL'} | STAGE: ${comp.stages?.name || 'TBD'}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 11px; font-weight: 700; color: #0F172A; margin: 0; text-transform: uppercase;">ENROLLED: ${totalEnrolled}</p>
                <p style="font-size: 11px; font-weight: 700; color: #10B981; margin: 0; margin-top: 4px; text-transform: uppercase;">CHECKED-IN: ${totalPresent}</p>
            </div>
        </div>
    `;

    // Sort enrollments alphabetically for the PDF
    const sortedEnrollments = [...enrollments].sort((a, b) => a.participants.name.localeCompare(b.participants.name));

    // Table Data
    let tableRows = sortedEnrollments.map((e, index) => {
        const p = e.participants;
        const status = e.is_present ? 'REGISTERED' : 'PENDING';
        const statusColor = e.is_present ? '#10B981' : '#F59E0B';
        
        const pJudgements = judgements.filter(j => j.participant_id === e.participant_id);
        let judgeText = pJudgements.length > 0 
            ? pJudgements.map(j => `${j.users?.username || 'Admin'}: ${j.awarded_mark}`).join(' | ') 
            : 'Awaiting Marks';

        const res = compResults[e.participant_id];
        const fMark = res ? res.mark : '-';
        const fGrade = res ? res.grade : '-';
        const fPoints = res ? res.points : '-';

        return `
            <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-weight: 700; color: #0F172A;">${p.name.toUpperCase()}</span><br>
                    <span style="font-size: 10px; color: #64748B; font-family: monospace; font-weight: 600;">${p.unique_id}</span>
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #475569;">${(p.teams?.name || 'IND').toUpperCase()}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #4F46E5;">${e.code_letter || '-'}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; color: ${statusColor}; font-weight: 800;">${status}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-size: 11px; font-weight: 600; color: #475569;">${judgeText.toUpperCase()}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #0F172A;">${fMark}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #0F172A;">${fGrade}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #4F46E5;">${fPoints}</td>
            </tr>
        `;
    }).join('');

    if (enrollments.length === 0) {
        tableRows = `<tr><td colspan="9" style="padding: 20px; text-align: center; color: #64748B; font-weight: 600;">No participants found.</td></tr>`;
    }

    container.innerHTML += `
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
            <thead>
                <tr style="background: #F1F5F9; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">
                    <th style="padding: 12px 10px;">#</th>
                    <th style="padding: 12px 10px;">PARTICIPANT</th>
                    <th style="padding: 12px 10px;">TEAM</th>
                    <th style="padding: 12px 10px;">CODE</th>
                    <th style="padding: 12px 10px;">STATUS</th>
                    <th style="padding: 12px 10px;">JUDGES</th>
                    <th style="padding: 12px 10px;">FINAL MARK</th>
                    <th style="padding: 12px 10px;">GRADE</th>
                    <th style="padding: 12px 10px;">PTS</th>
                </tr>
            </thead>
            <tbody style="font-size: 12px; color: #334155;">
                ${tableRows}
            </tbody>
        </table>
    `;

    // Download PDF Config (Using Landscape for wider table)
    const opt = { 
        margin: 10, 
        filename: typeof getFestFileName === 'function' ? getFestFileName('Log_' + comp.name, 'pdf') : `Fest_Log_${comp.name.replace(/[^a-z0-9]/gi, '_')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => {
        const btn = document.getElementById('btn-download-log');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Downloaded!';
        setTimeout(() => btn.innerHTML = origText, 2000);
    });
}

// Dynamic Branded PDF Header Generator
function getPDFHeaderHTML(reportTitle) {
    const activeFid = typeof getActiveFestId === 'function' ? getActiveFestId() : (typeof festosAuth !== 'undefined' ? festosAuth.getCurrentFestId() : null);
    if (typeof window !== 'undefined' && typeof window.festosGetPDFHeaderHTML === 'function') {
        return window.festosGetPDFHeaderHTML(reportTitle, activeFid);
    }
    const branding = typeof festosGetActiveBranding === 'function' 
        ? festosGetActiveBranding(activeFid) 
        : (window.systemBranding || {});
    
    let festName = branding.fest_name && branding.fest_name.trim() !== '' ? branding.fest_name.trim() : 'Festival';
    if (festName === 'FestOS') {
        festName = 'Festival';
    }

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
// ============================================================================
// SPECTATOR DISPLAY CONTROL ENGINE
// ============================================================================

let globalCustomSlides = [];
let pendingCSFile = null;
let pendingCSImagePreview = null;

let displayState = {
    is_paused: false,
    blackout: false,
    pinned_slide: null
};

async function loadDisplaySettings() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('display_settings') : null;
        let data = val ? { value: val } : await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle().then(r => r.data);
        if (data && data.value) {
            const v = data.value;
            if(document.getElementById('disp-duration')) document.getElementById('disp-duration').value = v.slide_duration || 12;
            if(document.getElementById('disp-color')) document.getElementById('disp-color').value = v.primary_color || '#3B82F6';
            if(document.getElementById('disp-font')) document.getElementById('disp-font').value = v.font_family || 'Plus Jakarta Sans';
            if(document.getElementById('disp-transition')) document.getElementById('disp-transition').value = v.transition || 'fade';
            if(document.getElementById('disp-bg-style')) document.getElementById('disp-bg-style').value = v.bg_style || 'cyber_aurora';
            if(document.getElementById('disp-global-ticker')) document.getElementById('disp-global-ticker').value = v.global_ticker || '';
            
            const milestoneCheck = document.getElementById('disp-show-milestones');
            if (milestoneCheck) { milestoneCheck.checked = v.show_milestones !== false; milestoneCheck.dispatchEvent(new Event('change')); }

            const qrCheck = document.getElementById('disp-show-qr');
            if (qrCheck) { qrCheck.checked = v.show_qr !== false; qrCheck.dispatchEvent(new Event('change')); }

            if(document.getElementById('disp-qr-preset')) document.getElementById('disp-qr-preset').value = v.qr_preset || 'scoreboard';
            if(document.getElementById('disp-qr-url')) document.getElementById('disp-qr-url').value = v.qr_url || '';
            if(document.getElementById('disp-qr-title')) document.getElementById('disp-qr-title').value = v.qr_title || 'SCAN FOR LIVE DATA';
            if(document.getElementById('disp-qr-subtitle')) document.getElementById('disp-qr-subtitle').value = v.qr_subtitle || 'POINT YOUR CAMERA';
            
            // Sync remote state
            displayState.is_paused = !!v.is_paused;
            displayState.blackout = !!v.blackout;
            displayState.pinned_slide = v.pinned_slide || null;

            updateDisplayRemoteStatusUI();
            updateActiveThemeChipUI(v.bg_style || 'cyber_aurora');

            // Load custom slides array
            globalCustomSlides = v.custom_slides || [];
        }

        await populateDisplayPinSlideDropdown();
        renderCustomSlidesList();
        scalePreviewIframe();
    } catch(e) { console.warn("Using default display settings:", e); }
}

let dispThemeDebounceTimer = null;

// --- INSTANT 0-MS THEME & MOTION GRAPHICS BROADCASTER ---
function broadcastInstantThemeUpdate() {
    const bgStyle = document.getElementById('disp-bg-style')?.value || 'cyber_aurora';
    const primaryColor = document.getElementById('disp-color')?.value || '#3B82F6';
    const fontFamily = document.getElementById('disp-font')?.value || 'Plus Jakarta Sans';
    const transition = document.getElementById('disp-transition')?.value || 'fade';
    const duration = parseInt(document.getElementById('disp-duration')?.value) || 12;
    const showMilestones = document.getElementById('disp-show-milestones')?.checked !== false;
    const showQr = document.getElementById('disp-show-qr')?.checked !== false;
    const qrPreset = document.getElementById('disp-qr-preset')?.value || 'scoreboard';
    const qrUrl = document.getElementById('disp-qr-url')?.value || '';

    const settings = {
        bg_style: bgStyle,
        primary_color: primaryColor,
        font_family: fontFamily,
        transition: transition,
        slide_duration: duration,
        show_milestones: showMilestones,
        show_qr: showQr,
        qr_preset: qrPreset,
        qr_url: qrUrl
    };

    // 1. Instant local postMessage to preview iframe (0ms latency)
    const iframe = document.getElementById('display-preview-frame');
    if (iframe && iframe.contentWindow) {
        try { iframe.contentWindow.postMessage({ type: 'theme_update', settings: settings }, '*'); } catch(e) {}
    }

    // 2. Update active chip highlight
    updateActiveThemeChipUI(bgStyle);

    // 3. Debounced silent save to Supabase DB (350ms)
    clearTimeout(dispThemeDebounceTimer);
    dispThemeDebounceTimer = setTimeout(() => {
        saveDisplaySettings(true);
    }, 350);
}

function updateActiveThemeChipUI(activeKey) {
    document.querySelectorAll('.theme-chip').forEach(chip => {
        const text = chip.innerText.toLowerCase();
        const keyBase = activeKey.replace('bg-', '').replace('_', '');
        if (text.includes(keyBase.substring(0, 4))) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function quickApplyDisplayTheme(themeKey) {
    const select = document.getElementById('disp-bg-style');
    if (select) select.value = themeKey;

    // Smart default accent colors for theme harmony
    const colorInput = document.getElementById('disp-color');
    if (colorInput) {
        if (themeKey === 'cyber_aurora') colorInput.value = '#3B82F6';
        else if (themeKey === 'golden_stardust') colorInput.value = '#F59E0B';
        else if (themeKey === 'corporate_slate') colorInput.value = '#64748B';
        else if (themeKey === 'cosmic_nebula') colorInput.value = '#EC4899';
        else if (themeKey === 'crimson_grandeur') colorInput.value = '#E11D48';
        else if (themeKey === 'emerald_matrix') colorInput.value = '#10B981';
        else if (themeKey === 'synthwave_sunset') colorInput.value = '#F43F5E';
        else if (themeKey === 'midnight_quartz') colorInput.value = '#38BDF8';
    }

    broadcastInstantThemeUpdate();
}

function handleDisplayThemeChange(themeKey) {
    broadcastInstantThemeUpdate();
}

window.broadcastInstantThemeUpdate = broadcastInstantThemeUpdate;
window.quickApplyDisplayTheme = quickApplyDisplayTheme;
window.handleDisplayThemeChange = handleDisplayThemeChange;

function updateDisplayRemoteStatusUI() {
    const badge = document.getElementById('disp-remote-status-badge');
    const pauseBtn = document.getElementById('btn-remote-pause');
    const blackoutBtn = document.getElementById('btn-remote-blackout');

    if (pauseBtn) {
        if (displayState.is_paused) {
            pauseBtn.innerHTML = '<i class="fa-solid fa-play" style="margin-right:0.4rem;"></i> Resume';
            pauseBtn.style.color = '#34D399';
            pauseBtn.style.borderColor = 'rgba(52, 211, 153, 0.4)';
            pauseBtn.style.background = 'rgba(52, 211, 153, 0.12)';
        } else {
            pauseBtn.innerHTML = '<i class="fa-solid fa-pause" style="margin-right:0.4rem;"></i> Pause';
            pauseBtn.style.color = '#FBBF24';
            pauseBtn.style.borderColor = 'rgba(251, 191, 36, 0.3)';
            pauseBtn.style.background = 'rgba(251, 191, 36, 0.08)';
        }
    }

    if (blackoutBtn) {
        if (displayState.blackout) {
            blackoutBtn.innerHTML = '<i class="fa-solid fa-sun" style="margin-right:0.4rem;"></i> Wake Screen';
            blackoutBtn.style.color = '#FFFFFF';
            blackoutBtn.style.borderColor = '#EF4444';
            blackoutBtn.style.background = '#EF4444';
        } else {
            blackoutBtn.innerHTML = '<i class="fa-solid fa-moon" style="margin-right:0.4rem;"></i> Blackout';
            blackoutBtn.style.color = '#F87171';
            blackoutBtn.style.borderColor = 'rgba(248, 113, 113, 0.3)';
            blackoutBtn.style.background = 'rgba(248, 113, 113, 0.08)';
        }
    }

    if (badge) {
        if (displayState.blackout) {
            badge.style.background = 'rgba(239, 68, 68, 0.2)';
            badge.style.color = '#FCA5A5';
            badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            badge.innerHTML = '<span style="width:8px; height:8px; background:#EF4444; border-radius:50%; box-shadow:0 0 8px #EF4444;"></span><span>STAGE BLACKOUT ACTIVE</span>';
        } else if (displayState.pinned_slide) {
            badge.style.background = 'rgba(59, 130, 246, 0.2)';
            badge.style.color = '#93C5FD';
            badge.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            badge.innerHTML = `<span style="width:8px; height:8px; background:#3B82F6; border-radius:50%; box-shadow:0 0 8px #3B82F6;"></span><span>PINNED: ${displayState.pinned_slide.replace('slide-','').toUpperCase()}</span>`;
        } else if (displayState.is_paused) {
            badge.style.background = 'rgba(245, 158, 11, 0.2)';
            badge.style.color = '#FCD34D';
            badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            badge.innerHTML = '<span style="width:8px; height:8px; background:#F59E0B; border-radius:50%; box-shadow:0 0 8px #F59E0B;"></span><span>ROTATION PAUSED</span>';
        } else {
            badge.style.background = 'rgba(16, 185, 129, 0.15)';
            badge.style.color = '#34D399';
            badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            badge.innerHTML = '<span style="width:8px; height:8px; background:#34D399; border-radius:50%; box-shadow:0 0 8px #34D399;"></span><span>LIVE ROTATION ACTIVE</span>';
        }
    }
}

async function populateDisplayPinSlideDropdown() {
    const select = document.getElementById('disp-pin-slide-select');
    if (!select) return;

    const currentVal = select.value || displayState.pinned_slide || '';
    select.innerHTML = `
        <option value="">-- Choose Slide to Lock --</option>
        <option value="slide-leaderboard">🏆 Overall Team Leaderboard</option>
        <option value="slide-schedule">📅 Live Upcoming Schedule</option>
    `;

    // Add Published Competitions
    if (competitionsList.length === 0) await loadCompetitions();
    const published = competitionsList.filter(c => c.status === 'published');
    if (published.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '🥇 Declared Results Podiums';
        published.forEach(c => {
            const opt = document.createElement('option');
            opt.value = `slide-results-${c.id}`;
            opt.innerText = `Result: ${c.name}`;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }

    // Add Custom Slides
    if (globalCustomSlides.length > 0) {
        const cGroup = document.createElement('optgroup');
        cGroup.label = '🎨 Custom Slides';
        globalCustomSlides.forEach(s => {
            const opt = document.createElement('option');
            opt.value = `slide-custom-${s.id}`;
            opt.innerText = `Slide: ${s.title || 'Untitled'}`;
            cGroup.appendChild(opt);
        });
        select.appendChild(cGroup);
    }

    if (currentVal) select.value = currentVal;
}

function handleDisplayQRPresetChange(preset) {
    const urlInput = document.getElementById('disp-qr-url');
    const titleInput = document.getElementById('disp-qr-title');
    const subInput = document.getElementById('disp-qr-subtitle');

    const origin = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));

    if (preset === 'scoreboard') {
        if (urlInput) urlInput.value = origin + '/display.html?mode=leaderboard';
        if (titleInput) titleInput.value = 'SCAN FOR LIVE SCORES';
        if (subInput) subInput.value = 'OVERALL TEAM STANDINGS';
    } else if (preset === 'schedule') {
        if (urlInput) urlInput.value = origin + '/display.html?mode=schedule';
        if (titleInput) titleInput.value = 'EVENT SCHEDULE';
        if (subInput) subInput.value = 'STAGE TIMINGS & DETAILS';
    } else if (preset === 'social') {
        if (urlInput) urlInput.value = 'https://instagram.com';
        if (titleInput) titleInput.value = 'FOLLOW LIVE STREAM';
        if (subInput) subInput.value = '@ZENITHFEST OFFICIAL';
    } else if (preset === 'custom') {
        if (titleInput && !titleInput.value) titleInput.value = 'SCAN FOR INFO';
        if (subInput && !subInput.value) subInput.value = 'POINT YOUR CAMERA';
    }
}

async function sendDisplayLiveAction(type, extraPayload = {}) {
    try {
        const actionPayload = {
            type: type,
            timestamp: Date.now(),
            ...extraPayload
        };

        // 1. Instant local postMessage to iframe preview (0ms latency)
        const iframe = document.getElementById('display-preview-frame');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'display_action', action: actionPayload }, '*');
        }

        // 2. Update local state immediately
        if (type === 'pause') displayState.is_paused = true;
        if (type === 'resume') displayState.is_paused = false;
        if (type === 'blackout') displayState.blackout = !!extraPayload.blackout;
        if (type === 'pin') displayState.pinned_slide = extraPayload.target_slide;
        if (type === 'unpin') displayState.pinned_slide = null;

        updateDisplayRemoteStatusUI();
        showToast(`Action: ${type.toUpperCase()}`, 'info');

        // 3. Persist to DB for live projector synchronization
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
        const currentSettings = data?.value || {};

        const updatedSettings = {
            ...currentSettings,
            live_action: actionPayload,
            is_paused: displayState.is_paused,
            blackout: displayState.blackout,
            pinned_slide: displayState.pinned_slide
        };

        await supabaseClient.from('settings').upsert({ id: 'display_settings', value: updatedSettings });
    } catch(e) {
        showToast(`Remote action failed: ${e.message}`, 'error');
    }
}

function toggleDisplayPause() {
    const newPaused = !displayState.is_paused;
    sendDisplayLiveAction(newPaused ? 'pause' : 'resume');
}

function toggleDisplayBlackout() {
    const newBlackout = !displayState.blackout;
    sendDisplayLiveAction('blackout', { blackout: newBlackout });
}

function setPinnedDisplaySlide() {
    const select = document.getElementById('disp-pin-slide-select');
    const slideId = select?.value;
    if (!slideId) {
        showToast("Please choose a slide from the dropdown to pin.", "warning");
        return;
    }
    sendDisplayLiveAction('pin', { target_slide: slideId });
}

function clearPinnedDisplaySlide() {
    const select = document.getElementById('disp-pin-slide-select');
    if (select) select.value = '';
    sendDisplayLiveAction('unpin');
}

function sendDisplayFlashAlert() {
    const msg = document.getElementById('disp-flash-message')?.value?.trim();
    const duration = parseInt(document.getElementById('disp-flash-duration')?.value) || 10;
    
    if (!msg) {
        showToast("Please enter an urgent alert message to broadcast.", "warning");
        return;
    }

    sendDisplayLiveAction('flash_alert', { message: msg, duration: duration, sound: true });
}

function clearDisplayFlashAlert() {
    sendDisplayLiveAction('clear_flash');
    const msgInput = document.getElementById('disp-flash-message');
    if (msgInput) msgInput.value = '';
}

async function saveDisplaySettings(silent = false) {
    if(!silent) setLoading('display-control .btn-primary', true);
    
    // Fetch current state to preserve live action
    const existingVal = window.festosGetSetting ? await window.festosGetSetting('display_settings') : null;
    const existing = existingVal || {};

    const payload = {
        ...existing,
        slide_duration: parseInt(document.getElementById('disp-duration')?.value) || 12,
        primary_color: document.getElementById('disp-color')?.value || '#3B82F6',
        font_family: document.getElementById('disp-font')?.value || 'Plus Jakarta Sans',
        transition: document.getElementById('disp-transition')?.value || 'fade',
        bg_style: document.getElementById('disp-bg-style')?.value || 'cyber_aurora',
        global_ticker: document.getElementById('disp-global-ticker')?.value || '',
        show_milestones: document.getElementById('disp-show-milestones')?.checked !== false,
        show_qr: document.getElementById('disp-show-qr')?.checked !== false,
        qr_preset: document.getElementById('disp-qr-preset')?.value || 'scoreboard',
        qr_url: document.getElementById('disp-qr-url')?.value || '',
        qr_title: document.getElementById('disp-qr-title')?.value || 'SCAN FOR LIVE DATA',
        qr_subtitle: document.getElementById('disp-qr-subtitle')?.value || 'POINT YOUR CAMERA',
        custom_slides: globalCustomSlides,
        is_paused: displayState.is_paused,
        blackout: displayState.blackout,
        pinned_slide: displayState.pinned_slide
    };
    
    try {
        const { error } = window.festosSaveSetting ? await window.festosSaveSetting('display_settings', payload) : await supabaseClient.from('settings').upsert({ id: 'display_settings', value: payload });
        if (error) throw error;
        
        if(!silent) showToast("Display Engine Settings Saved & Synced!", "success");
        
        // Broadcast instant update to iframe without reloading
        const iframe = document.getElementById('display-preview-frame');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'theme_update', settings: payload }, '*');
        }

    } catch(e) {
        if(!silent) showToast(e.message, 'error');
    } finally {
        if(!silent) setLoading('display-control .btn-primary', false);
    }
}

// --- CUSTOM SLIDES CRUD ---
function renderCustomSlidesList() {
    const container = document.getElementById('custom-slides-list');
    container.innerHTML = '';
    
    if (globalCustomSlides.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--border); border-radius: 8px;">No custom slides created yet. Add one above!</div>`;
        return;
    }

    globalCustomSlides.forEach((slide, index) => {
        const isEnabled = slide.enabled !== false;
        container.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                    <img src="${slide.bg_url || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><rect width=\'100%\' height=\'100%\' fill=\'%23CBD5E1\'/></svg>'}" style="width: 60px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border);">
                    <div>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${slide.title || 'Untitled Slide'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; display: flex; gap: 0.75rem; margin-top: 0.2rem;">
                            ${slide.duration ? `<span><i class="fa-regular fa-clock"></i> ${slide.duration}s</span>` : '<span><i class="fa-regular fa-clock"></i> Default</span>'}
                            ${slide.qr_url ? `<span><i class="fa-solid fa-qrcode"></i> Custom QR</span>` : ''}
                            ${slide.ticker ? `<span><i class="fa-solid fa-bolt"></i> Ticker</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px; margin-right: 0.5rem;">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleCustomSlide(${index}, this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isEnabled ? 'var(--success)' : '#cbd5e1'}; transition: .4s; border-radius: 34px;"></span>
                        <span style="position: absolute; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${isEnabled ? 'translateX(20px)' : 'translateX(0)'};"></span>
                    </label>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.6rem;" onclick="openCustomSlideModal(${index})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; color: var(--danger); border-color: var(--danger);" onclick="deleteCustomSlide(${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function openCustomSlideModal(index = -1) {
    pendingCSFile = null;
    pendingCSImagePreview = null;
    document.getElementById('cs-bg-preview').style.display = 'none';
    document.getElementById('cs-bg-remove').style.display = 'none';
    document.getElementById('cs-bg-upload').value = '';

    if (index >= 0) {
        const slide = globalCustomSlides[index];
        document.getElementById('cs-id').value = slide.id;
        document.getElementById('cs-title').value = slide.title || '';
        document.getElementById('cs-text').value = slide.text || '';
        document.getElementById('cs-duration').value = slide.duration || '';
        document.getElementById('cs-color').value = slide.color || '#4F46E5';
        document.getElementById('cs-qr-url').value = slide.qr_url || '';
        document.getElementById('cs-qr-text').value = slide.qr_text || '';
        document.getElementById('cs-ticker').value = slide.ticker || '';

        if (slide.bg_url) {
            document.getElementById('cs-bg-preview').src = slide.bg_url;
            document.getElementById('cs-bg-preview').style.display = 'block';
            document.getElementById('cs-bg-remove').style.display = 'inline-flex';
            pendingCSImagePreview = slide.bg_url;
        }
    } else {
        document.getElementById('cs-id').value = 'cs_' + Date.now();
        document.getElementById('cs-title').value = '';
        document.getElementById('cs-text').value = '';
        document.getElementById('cs-duration').value = '';
        document.getElementById('cs-color').value = document.getElementById('disp-color').value || '#4F46E5';
        document.getElementById('cs-qr-url').value = '';
        document.getElementById('cs-qr-text').value = '';
        document.getElementById('cs-ticker').value = '';
    }

    document.getElementById('customSlideModal').classList.add('show');
}

function handleCSImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingCSFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingCSImagePreview = e.target.result;
        document.getElementById('cs-bg-preview').src = e.target.result;
        document.getElementById('cs-bg-preview').style.display = 'block';
        document.getElementById('cs-bg-remove').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function removeCSImage() {
    pendingCSFile = null;
    pendingCSImagePreview = null;
    document.getElementById('cs-bg-preview').src = '';
    document.getElementById('cs-bg-preview').style.display = 'none';
    document.getElementById('cs-bg-remove').style.display = 'none';
    document.getElementById('cs-bg-upload').value = '';
}

async function saveCustomSlide() {
    const title = document.getElementById('cs-title').value;
    if(!title) return showToast("A heading is required.", "error");

    setLoading('btn-save-cs', true);

    try {
        let finalBgUrl = pendingCSImagePreview;

        // If it's a completely new file, upload it to the 'elements' bucket
        if (pendingCSFile) {
            const fileExt = pendingCSFile.name.split('.').pop();
            const fileName = `slide_bg_${Date.now()}.${fileExt}`;
            const { data, error } = await supabaseClient.storage.from('elements').upload(fileName, pendingCSFile);
            if (error) throw error;
            const { data: urlData } = supabaseClient.storage.from('elements').getPublicUrl(fileName);
            finalBgUrl = urlData.publicUrl;
        }

        const id = document.getElementById('cs-id').value;
        const slideObj = {
            id: id,
            enabled: true,
            title: title,
            text: document.getElementById('cs-text').value,
            duration: document.getElementById('cs-duration').value || null,
            color: document.getElementById('cs-color').value,
            qr_url: document.getElementById('cs-qr-url').value || null,
            qr_text: document.getElementById('cs-qr-text').value || null,
            ticker: document.getElementById('cs-ticker').value || null,
            bg_url: finalBgUrl
        };

        const existingIndex = globalCustomSlides.findIndex(s => s.id === id);
        if (existingIndex >= 0) {
            // Keep enabled status if editing
            slideObj.enabled = globalCustomSlides[existingIndex].enabled;
            globalCustomSlides[existingIndex] = slideObj;
        } else {
            globalCustomSlides.push(slideObj);
        }

        await saveDisplaySettings(false); // Saves to DB and syncs preview
        document.getElementById('customSlideModal').classList.remove('show');

    } catch(e) {
        showToast("Error saving slide: " + e.message, "error");
    } finally {
        setLoading('btn-save-cs', false);
    }
}

async function toggleCustomSlide(index, isEnabled) {
    globalCustomSlides[index].enabled = isEnabled;
    await saveDisplaySettings(true); // silent sync
}

async function deleteTemplate(index) {
    openConfirmModal("Delete Template?", "Permanently delete this template from the cloud?", async () => {
        const templateId = savedTemplates[index].id;
        const { error } = await supabaseClient.from('templates').delete().eq('id', templateId);
        if (error) {
            showToast("Error deleting template", "error");
        } else {
            showToast("Template Deleted.");
            loadTemplatesList();
        }
    });
}

function deleteStudioLayer(key) {
    openConfirmModal("Delete Layer?", "Delete this layer permanently?", () => {
        saveHistoryState();
        delete studioActiveData.fields[key];
        if (studioActiveField === key) studioActiveField = null;
        if (typeof multiSelectedLayers !== 'undefined') multiSelectedLayers.delete(key); // CRITICAL FIX
        renderLayersPanel();
        renderPropertiesPanel();
        drawStudioCanvas();
    });
}

async function deleteSchedule(compId) {
    openConfirmModal("Remove Schedule?", "Remove this event from the schedule?", async () => {
        delete masterSchedule[compId];
        try {
            const { error } = window.festosSaveSetting ? await window.festosSaveSetting('master_schedule', masterSchedule) : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
            if (error) throw error;
            showToast(`Schedule deleted.`);
            filterScheduleTable();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteCustomSlide(index) {
    openConfirmModal("Delete Slide?", "Remove this custom slide permanently?", async () => {
        globalCustomSlides.splice(index, 1);
        await saveDisplaySettings(false);
    });
}


async function triggerManualConfetti() {
    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('display_settings') : (await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle()).data?.value;
        let payload = val || { slide_duration: 12, show_qr: true };
        payload.trigger_confetti = Date.now(); // Forces all listening displays to trigger
        if (window.festosSaveSetting) {
            await window.festosSaveSetting('display_settings', payload);
        } else {
            await supabaseClient.from('settings').upsert({ id: 'display_settings', value: payload });
        }
        showToast("Celebration triggered on live displays!", "success");
    } catch(e) {
        showToast("Failed to trigger animation.", "error");
    }
}

function scalePreviewIframe() {
    const iframe = document.getElementById('display-preview-frame');
    if (iframe && iframe.parentElement) {
        const parent = iframe.parentElement;
        const parentWidth = parent.clientWidth;
        const scale = parentWidth / 1920;
        iframe.style.transform = `scale(${scale})`;
        const calculatedHeight = parentWidth * (1080 / 1920);
        parent.style.height = `${calculatedHeight}px`;
    }
}
window.addEventListener('resize', scalePreviewIframe);

// ==========================================
// EVENT SCHEDULE ENGINE
// ==========================================
let masterSchedule = {}; // <-- THIS WAS MISSING

// ========================================================================
// ⚡ SCHEDULE MANAGEMENT, CONFLICT DETECTOR & AUTO-OPTIMIZER
// ========================================================================

let scheduleConflictsReport = { hardClashes: [], bufferWarnings: [], stageCollisions: [], totalConflicts: 0, compConflictMap: {} };
let scheduleEnrollmentsCache = null;
let scheduleEnrollmentsCacheTime = 0;
let currentAuditFilter = 'all';
let pendingOptimizedSchedule = null;

async function fetchScheduleEnrollments(forceRefresh = false) {
    const now = Date.now();
    if (scheduleEnrollmentsCache && !forceRefresh && (now - scheduleEnrollmentsCacheTime < 60000)) {
        return scheduleEnrollmentsCache;
    }
    try {
        const { data, error } = await festQuery(supabaseClient
            .from('participant_competitions')
            .select('competition_id, participant_id, participants(id, name, unique_id, team_id, teams(name))'));
        if (error) throw error;
        scheduleEnrollmentsCache = data || [];
        scheduleEnrollmentsCacheTime = now;
        return scheduleEnrollmentsCache;
    } catch(e) {
        console.warn("Could not fetch schedule enrollments:", e);
        return scheduleEnrollmentsCache || [];
    }
}

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToTimeString(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function detectScheduleConflicts() {
    const enrollments = await fetchScheduleEnrollments();
    
    const compStudentsMap = {};
    enrollments.forEach(e => {
        if (!e.competition_id || !e.participant_id) return;
        if (!compStudentsMap[e.competition_id]) compStudentsMap[e.competition_id] = [];
        compStudentsMap[e.competition_id].push(e.participants);
    });

    const scheduledCompIds = Object.keys(masterSchedule).filter(id => {
        const comp = competitionsList.find(c => c.id == id);
        return comp && masterSchedule[id]?.date && masterSchedule[id]?.time;
    });

    const hardClashes = [];
    const bufferWarnings = [];
    const stageCollisions = [];
    const compConflictMap = {};

    for (let i = 0; i < scheduledCompIds.length; i++) {
        const idA = scheduledCompIds[i];
        const compA = competitionsList.find(c => c.id == idA);
        const schedA = masterSchedule[idA];
        
        const startMinsA = timeStringToMinutes(schedA.time);
        let endMinsA = schedA.to_time ? timeStringToMinutes(schedA.to_time) : (startMinsA + (parseInt(schedA.manual_time) || 30));
        if (endMinsA <= startMinsA) endMinsA = startMinsA + 30;

        for (let j = i + 1; j < scheduledCompIds.length; j++) {
            const idB = scheduledCompIds[j];
            const compB = competitionsList.find(c => c.id == idB);
            const schedB = masterSchedule[idB];

            // Only check conflicts if on the SAME DATE
            if (schedA.date !== schedB.date) continue;

            const startMinsB = timeStringToMinutes(schedB.time);
            let endMinsB = schedB.to_time ? timeStringToMinutes(schedB.to_time) : (startMinsB + (parseInt(schedB.manual_time) || 30));
            if (endMinsB <= startMinsB) endMinsB = startMinsB + 30;

            const isTimeOverlapping = (startMinsA < endMinsB) && (startMinsB < endMinsA);

            // 1. Stage Collision Check
            if (compA.stage_id && compB.stage_id && String(compA.stage_id) === String(compB.stage_id)) {
                if (isTimeOverlapping) {
                    const stageName = stagesList.find(s => s.id == compA.stage_id)?.name || `Stage ${compA.stage_id}`;
                    stageCollisions.push({
                        type: 'stage',
                        date: schedA.date,
                        stageName,
                        compA,
                        compB,
                        timeA: `${schedA.time} - ${schedA.to_time || minutesToTimeString(endMinsA)}`,
                        timeB: `${schedB.time} - ${schedB.to_time || minutesToTimeString(endMinsB)}`
                    });

                    if (!compConflictMap[idA]) compConflictMap[idA] = [];
                    if (!compConflictMap[idB]) compConflictMap[idB] = [];
                    compConflictMap[idA].push({ type: 'stage', otherComp: compB, desc: `Double booked on ${stageName}` });
                    compConflictMap[idB].push({ type: 'stage', otherComp: compA, desc: `Double booked on ${stageName}` });
                }
            }

            // 2. Student Clashes Check
            const studentsA = compStudentsMap[idA] || [];
            const studentsB = compStudentsMap[idB] || [];
            
            // Find common participants
            const commonStudents = studentsA.filter(sA => sA && studentsB.some(sB => sB && sB.id === sA.id));

            if (commonStudents.length > 0) {
                commonStudents.forEach(student => {
                    const stageNameA = stagesList.find(s => s.id == compA.stage_id)?.name || 'Stage TBD';
                    const stageNameB = stagesList.find(s => s.id == compB.stage_id)?.name || 'Stage TBD';

                    if (isTimeOverlapping) {
                        // Hard Clash
                        hardClashes.push({
                            type: 'hard',
                            date: schedA.date,
                            student,
                            compA,
                            compB,
                            stageNameA,
                            stageNameB,
                            timeA: `${schedA.time} - ${schedA.to_time || minutesToTimeString(endMinsA)}`,
                            timeB: `${schedB.time} - ${schedB.to_time || minutesToTimeString(endMinsB)}`
                        });

                        if (!compConflictMap[idA]) compConflictMap[idA] = [];
                        if (!compConflictMap[idB]) compConflictMap[idB] = [];
                        compConflictMap[idA].push({ type: 'hard', student, otherComp: compB, desc: `Student ${student.name} clashing with ${compB.name}` });
                        compConflictMap[idB].push({ type: 'hard', student, otherComp: compA, desc: `Student ${student.name} clashing with ${compA.name}` });
                    } else {
                        // Check Buffer (< 15 mins between events on different stages)
                        let gapMins = 0;
                        if (endMinsA <= startMinsB) {
                            gapMins = startMinsB - endMinsA;
                        } else if (endMinsB <= startMinsA) {
                            gapMins = startMinsA - endMinsB;
                        }

                        if (gapMins < 15 && String(compA.stage_id) !== String(compB.stage_id)) {
                            bufferWarnings.push({
                                type: 'buffer',
                                date: schedA.date,
                                student,
                                gapMins,
                                compA,
                                compB,
                                stageNameA,
                                stageNameB,
                                timeA: `${schedA.time} - ${schedA.to_time || minutesToTimeString(endMinsA)}`,
                                timeB: `${schedB.time} - ${schedB.to_time || minutesToTimeString(endMinsB)}`
                            });

                            if (!compConflictMap[idA]) compConflictMap[idA] = [];
                            if (!compConflictMap[idB]) compConflictMap[idB] = [];
                            compConflictMap[idA].push({ type: 'buffer', student, otherComp: compB, desc: `Only ${gapMins}m buffer for ${student.name}` });
                            compConflictMap[idB].push({ type: 'buffer', student, otherComp: compA, desc: `Only ${gapMins}m buffer for ${student.name}` });
                        }
                    }
                });
            }
        }
    }

    const totalConflicts = hardClashes.length + bufferWarnings.length + stageCollisions.length;
    scheduleConflictsReport = { hardClashes, bufferWarnings, stageCollisions, totalConflicts, compConflictMap };

    // Update UI Elements
    const banner = document.getElementById('schedule-conflict-banner');
    const badgeCount = document.getElementById('conflict-badge-count');
    const titleElem = document.getElementById('conflict-banner-title');
    const descElem = document.getElementById('conflict-banner-desc');

    if (badgeCount) {
        if (totalConflicts > 0) {
            badgeCount.innerText = totalConflicts;
            badgeCount.style.display = 'inline-block';
        } else {
            badgeCount.style.display = 'none';
        }
    }

    if (banner) {
        if (totalConflicts > 0) {
            banner.style.display = 'flex';
            if (titleElem) titleElem.innerText = `${totalConflicts} Schedule Conflict${totalConflicts > 1 ? 's' : ''} Detected`;
            if (descElem) {
                descElem.innerText = `${hardClashes.length} hard student clash(es), ${bufferWarnings.length} tight buffer(s) (<15m), ${stageCollisions.length} stage double-booking(s).`;
            }
        } else {
            banner.style.display = 'none';
        }
    }

    return scheduleConflictsReport;
}

async function loadSchedules() {
    try {
        const promises = [];
        if (competitionsList.length === 0) promises.push(loadCompetitions());
        if (stagesList.length === 0) promises.push(loadStagesAndTeams());
        promises.push(window.festosGetSetting ? window.festosGetSetting('master_schedule') : supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle().then(r => r.data?.value));

        const results = await Promise.all(promises);
        const schedRes = results[results.length - 1];
        masterSchedule = (schedRes && typeof schedRes === 'object' && !schedRes.data) ? schedRes : (schedRes?.data?.value || schedRes || {});
        
        const filterCat = document.getElementById('filterSchedCat');
        if(filterCat && filterCat.options.length === 1) {
            categoriesList.forEach(c => filterCat.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        }

        const filterStage = document.getElementById('filterSchedStage');
        if(filterStage && filterStage.options.length === 1) {
            stagesList.forEach(s => filterStage.innerHTML += `<option value="${s.id}">${s.name}</option>`);
        }
        
        await detectScheduleConflicts();
        filterScheduleTable();
    } catch(e) { showToast(e.message, 'error'); }
}

function populateScheduleDateFilter() {
    const filterDate = document.getElementById('filterSchedDate');
    if (!filterDate) return;
    const currentVal = filterDate.value;
    const dates = Array.from(new Set(Object.values(masterSchedule || {}).map(s => s.date).filter(Boolean))).sort();
    
    const existingValues = Array.from(filterDate.options).map(o => o.value).filter(Boolean);
    const isSame = existingValues.length === dates.length && existingValues.every((v, i) => v === dates[i]);
    if (!isSame) {
        filterDate.innerHTML = '<option value="">All Dates</option>' + dates.map(d => `<option value="${d}">${d}</option>`).join('');
        if (currentVal && dates.includes(currentVal)) {
            filterDate.value = currentVal;
        }
    }
}
window.populateScheduleDateFilter = populateScheduleDateFilter;

function filterScheduleTable() {
    populateScheduleDateFilter();

    const search = document.getElementById('searchSchedInput')?.value?.toLowerCase() || '';
    const dateVal = document.getElementById('filterSchedDate')?.value || '';
    const catId = document.getElementById('filterSchedCat')?.value || '';
    const stageId = document.getElementById('filterSchedStage')?.value || ''; 
    const statusVal = document.getElementById('filterSchedStatus')?.value || '';
    const compStatusVal = document.getElementById('filterSchedCompStatus') ? document.getElementById('filterSchedCompStatus').value : ""; 
    
    const tbody = document.getElementById('schedule-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let scheduledItems = Object.keys(masterSchedule).map(compId => {
        const comp = competitionsList.find(c => c.id == compId);
        return { compId, comp, sched: masterSchedule[compId] };
    }).filter(item => item.comp); 
    
    // STRICT SORT: Chronologically by Date, then Time
    scheduledItems.sort((a,b) => {
        if (a.sched.date !== b.sched.date) return (a.sched.date || '').localeCompare(b.sched.date || '');
        return (a.sched.time || '').localeCompare(b.sched.time || '');
    });

    scheduledItems.forEach(item => {
        const compCatId = item.comp.category_id;
        const compCatName = item.comp.categories?.name || 'General';
        const compStageId = item.comp.stage_id; 
        
        let compStageName = 'TBD';
        if (item.comp.is_offstage) {
            compStageName = '📝 Offstage';
        } else if (item.comp.stages?.name) {
            compStageName = item.comp.stages.name;
        } else if (item.comp.stage_id) {
            const stg = (stagesList || []).find(s => String(s.id) === String(item.comp.stage_id));
            compStageName = stg ? stg.name : `Stage #${item.comp.stage_id}`;
        }
        
        const matchSearch = item.comp.name.toLowerCase().includes(search);
        const matchDate = dateVal === "" || item.sched.date === dateVal;
        const matchCat = catId === "" || compCatId == catId;
        const matchStage = stageId === "" || (stageId === 'offstage' ? item.comp.is_offstage : compStageId == stageId); 
        const matchStatus = statusVal === "" || item.sched.status === statusVal;
        const matchCompStatus = compStatusVal === "" || item.comp.status === compStatusVal; 
        
        if (!(matchSearch && matchDate && matchCat && matchStage && matchStatus && matchCompStatus)) return; 
        
        const isPub = item.sched.status === 'published';
        const publishBadge = isPub 
            ? `<span class="badge" style="background:var(--success-light); color:var(--success);"><i class="fa-solid fa-globe"></i> Published</span>` 
            : `<span class="badge" style="background:var(--warning-light); color:var(--warning);"><i class="fa-solid fa-lock"></i> Draft</span>`;
            
        let compStateStr = item.comp.status.toUpperCase().replace('_', ' ');
        let compStateColor = '#64748B';
        if (item.comp.status === 'registration') compStateColor = '#1D4ED8';
        if (item.comp.status === 'ongoing') compStateColor = '#059669';
        if (item.comp.status === 'valuation') compStateColor = '#D97706';
        if (item.comp.status === 'judgement_complete') compStateColor = '#7E22CE';

        const stateBadge = `<br><span style="font-size: 0.7rem; font-weight: 800; color: ${compStateColor}; margin-top: 4px; display: inline-block;">${compStateStr}</span>`;
        
        // Conflict Badge for Row
        let conflictBadge = '';
        const compConflicts = scheduleConflictsReport.compConflictMap[item.compId] || [];
        if (compConflicts.length > 0) {
            const hasHard = compConflicts.some(c => c.type === 'hard' || c.type === 'stage');
            const bBg = hasHard ? '#FEE2E2' : '#FEF3C7';
            const bColor = hasHard ? '#DC2626' : '#D97706';
            const bBorder = hasHard ? '#FCA5A5' : '#FDE68A';
            conflictBadge = `<br><span class="badge" style="background:${bBg}; color:${bColor}; border:1px solid ${bBorder}; cursor:pointer; font-weight:700; margin-top:4px; display:inline-flex; align-items:center; gap:4px;" onclick="openConflictAuditModal()" title="${compConflicts.length} conflict(s)"><i class="fa-solid fa-triangle-exclamation"></i> ${compConflicts.length} Clash${compConflicts.length > 1 ? 'es' : ''}</span>`;
        }

        const badge = publishBadge + stateBadge + conflictBadge;

        const actionBtn = isPub
            ? `<button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="toggleScheduleStatus('${item.compId}', 'draft')" title="Unpublish"><i class="fa-solid fa-eye-slash"></i></button>`
            : `<button class="btn btn-success" style="padding:0.4rem 0.75rem;" onclick="toggleScheduleStatus('${item.compId}', 'published')" title="Publish Live"><i class="fa-solid fa-upload"></i></button>`;

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700;">${escapeSheetHtml(item.comp.name)}</td>
                <td>${escapeSheetHtml(compCatName)}</td>
                <td>${escapeSheetHtml(compStageName)}</td>
                <td style="font-weight: 700; color: var(--primary);">${item.sched.date}</td>
                <td style="font-weight: 700;">${item.sched.time}</td>
                <td style="font-weight: 700;">${item.sched.to_time || '-'}</td>
                <td>${badge}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        ${actionBtn}
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick="openScheduleModal('${item.compId}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteSchedule('${item.compId}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    if(tbody.innerHTML === '') {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No scheduled events found matching filters.</td></tr>`;
    }
}

// ==========================================
// CONFLICT AUDIT MODAL FUNCTIONS
// ==========================================

async function openConflictAuditModal() {
    // Show modal first or display loading if needed
    document.getElementById('conflictAuditModal').classList.add('show');
    
    // Detect fresh conflicts
    await detectScheduleConflicts();

    const hardCount = document.getElementById('audit-hard-count');
    const bufferCount = document.getElementById('audit-buffer-count');
    const stageCount = document.getElementById('audit-stage-count');
    const totalCount = document.getElementById('audit-total-count');

    if (hardCount) hardCount.innerText = scheduleConflictsReport.hardClashes.length;
    if (bufferCount) bufferCount.innerText = scheduleConflictsReport.bufferWarnings.length;
    if (stageCount) stageCount.innerText = scheduleConflictsReport.stageCollisions.length;
    if (totalCount) totalCount.innerText = scheduleConflictsReport.totalConflicts;

    filterAuditList('all');
}

function filterAuditList(type) {
    currentAuditFilter = type;

    // Reset button states
    ['all', 'hard', 'buffer', 'stage'].forEach(t => {
        const btn = document.getElementById(`btn-filter-${t}-conflicts`);
        if (!btn) return;
        if (t === type) {
            btn.className = 'btn btn-primary';
        } else {
            btn.className = 'btn btn-outline';
        }
    });

    const container = document.getElementById('conflict-audit-list');
    if (!container) return;

    let items = [];
    if (type === 'all') {
        items = [...scheduleConflictsReport.hardClashes, ...scheduleConflictsReport.bufferWarnings, ...scheduleConflictsReport.stageCollisions];
    } else if (type === 'hard') {
        items = scheduleConflictsReport.hardClashes;
    } else if (type === 'buffer') {
        items = scheduleConflictsReport.bufferWarnings;
    } else if (type === 'stage') {
        items = scheduleConflictsReport.stageCollisions;
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--success); font-weight: 600;">
                <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; margin-bottom: 0.75rem; display: block;"></i>
                No schedule conflicts found in this category!
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, idx) => {
        if (item.type === 'hard') {
            return `
                <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: #DC2626; color: white; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> HARD CLASH</span>
                            <strong style="color: #991B1B; font-size: 0.95rem;">${item.student.name} (${item.student.unique_id || 'ID'}) • ${item.student.teams?.name || 'IND'}</strong>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${item.date}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: white; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #FECACA;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event A</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compA.name}</strong>
                            <div style="font-size: 0.8rem; color: #DC2626; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeA} (${item.stageNameA})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compA.id}')"><i class="fa-solid fa-pen"></i> Reschedule A</button>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event B</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compB.name}</strong>
                            <div style="font-size: 0.8rem; color: #DC2626; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeB} (${item.stageNameB})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compB.id}')"><i class="fa-solid fa-pen"></i> Reschedule B</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'buffer') {
            return `
                <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: #D97706; color: white; font-weight: 800;"><i class="fa-solid fa-hourglass-half"></i> TIGHT BUFFER (${item.gapMins}m)</span>
                            <strong style="color: #92400E; font-size: 0.95rem;">${item.student.name} (${item.student.unique_id || 'ID'}) • ${item.student.teams?.name || 'IND'}</strong>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${item.date}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: white; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #FDE68A;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">1st Performance</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compA.name}</strong>
                            <div style="font-size: 0.8rem; color: #D97706; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeA} (${item.stageNameA})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compA.id}')"><i class="fa-solid fa-pen"></i> Adjust Timing</button>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">2nd Performance</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compB.name}</strong>
                            <div style="font-size: 0.8rem; color: #D97706; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeB} (${item.stageNameB})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compB.id}')"><i class="fa-solid fa-pen"></i> Adjust Timing</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'stage') {
            return `
                <div style="background: #F5F3FF; border: 1.5px solid #DDD6FE; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: #7C3AED; color: white; font-weight: 800;"><i class="fa-solid fa-layer-group"></i> STAGE COLLISION</span>
                            <strong style="color: #5B21B6; font-size: 0.95rem;">${item.stageName} (Double Booked)</strong>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${item.date}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: white; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #DDD6FE;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event 1</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compA.name}</strong>
                            <div style="font-size: 0.8rem; color: #7C3AED; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeA}</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compA.id}')"><i class="fa-solid fa-pen"></i> Reschedule</button>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event 2</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compB.name}</strong>
                            <div style="font-size: 0.8rem; color: #7C3AED; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeB}</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compB.id}')"><i class="fa-solid fa-pen"></i> Reschedule</button>
                        </div>
                    </div>
                </div>
            `;
        }
        return '';
    }).join('');
}

async function exportConflictReportPDF() {
    showToast('Generating Schedule Conflict Audit PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Schedule Conflict & Overlap Audit Report');

        const allIssues = [
            ...scheduleConflictsReport.hardClashes.map(c => ['HARD CLASH', c.date, c.student?.name || 'N/A', `${c.compA?.name} (${c.timeA})`, `${c.compB?.name} (${c.timeB})`, 'Overlapping Time']),
            ...scheduleConflictsReport.bufferWarnings.map(c => ['TIGHT BUFFER', c.date, c.student?.name || 'N/A', `${c.compA?.name} (${c.timeA})`, `${c.compB?.name} (${c.timeB})`, `${c.gapMins} mins gap`]),
            ...scheduleConflictsReport.stageCollisions.map(c => ['STAGE COLLISION', c.date, c.stageName, `${c.compA?.name} (${c.timeA})`, `${c.compB?.name} (${c.timeB})`, 'Same Stage Overlap'])
        ];

        let rowsHtml = allIssues.map(r => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: ${r[0] === 'HARD CLASH' ? '#DC2626' : (r[0] === 'TIGHT BUFFER' ? '#D97706' : '#7C3AED')};">${r[0]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r[1]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${r[2]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r[3]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r[4]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${r[5]}</td>
            </tr>
        `).join('');

        if (allIssues.length === 0) {
            rowsHtml = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #059669; font-weight: 700;">No schedule conflicts found! Festival schedule is 100% optimal.</td></tr>`;
        }

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; font-size: 0.85rem;">
                <thead>
                    <tr style="background: #F8FAFC;">
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">TYPE</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">DATE</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">STUDENT / STAGE</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">EVENT 1</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">EVENT 2</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">DETAILS</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        const opt = {
            margin: 10,
            filename: typeof getFestFileName === 'function' ? getFestFileName('Schedule_Conflict_Audit', 'pdf') : `Schedule_Conflict_Audit_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        await html2pdf().set(opt).from(container).save();
    } catch(e) {
        showToast("PDF Export failed: " + e.message, "error");
    }
}

// ==========================================
// AUTO-SCHEDULE OPTIMIZER ENGINE (AI ENGINE)
// ==========================================

function optEscapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let optimizerBreaks = [
    { id: 'break_lunch', name: 'Lunch Break', start: '13:00', end: '14:00' }
];
let optimizerSelectedStageIds = [];
let optimizerSelectedCategoryIds = [];

function renderOptimizerBreaks() {
    const container = document.getElementById('opt-breaks-container');
    if (!container) return;

    if (!optimizerBreaks || optimizerBreaks.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 0.75rem; background: white; border-radius: 8px; border: 1px dashed var(--border);">
                No breaks configured. Click <strong>"+ Add Lunch (1:00 - 2:00 PM)"</strong> or <strong>"+ Add Custom Break"</strong> to reserve break times.
            </div>
        `;
        return;
    }

    container.innerHTML = optimizerBreaks.map(b => `
        <div class="opt-break-row" data-id="${b.id}" style="display: flex; align-items: center; gap: 0.6rem; background: white; padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border); flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.4rem; flex: 1; min-width: 140px;">
                <i class="fa-solid fa-utensils" style="color: #D97706; font-size: 0.85rem;"></i>
                <input type="text" class="opt-break-name" value="${optEscapeHtml(b.name)}" placeholder="Break Name (e.g. Lunch)" 
                    style="width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.6rem; font-size: 0.82rem; font-weight: 700; color: var(--text-main);"
                    onchange="updateOptimizerBreakField('${b.id}', 'name', this.value)">
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">FROM:</span>
                <input type="time" class="opt-break-start" value="${b.start}"
                    style="border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; font-size: 0.82rem; font-weight: 700; color: var(--text-main);"
                    onchange="updateOptimizerBreakField('${b.id}', 'start', this.value)">
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">TO:</span>
                <input type="time" class="opt-break-end" value="${b.end}"
                    style="border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; font-size: 0.82rem; font-weight: 700; color: var(--text-main);"
                    onchange="updateOptimizerBreakField('${b.id}', 'end', this.value)">
            </div>
            <button type="button" class="btn btn-outline" style="padding: 0.35rem 0.6rem; color: #DC2626; border-color: #FECACA; font-size: 0.75rem;" title="Remove Break" onclick="removeOptimizerBreak('${b.id}')">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');
}

function updateOptimizerBreakField(id, field, value) {
    const b = optimizerBreaks.find(x => x.id === id);
    if (b) {
        b[field] = value;
    }
}

function addOptimizerLunchBreak() {
    const hasLunch = optimizerBreaks.some(b => b.name.toLowerCase().includes('lunch'));
    if (hasLunch) {
        if (typeof showToast === 'function') {
            showToast("Lunch break is already in the list. You can edit its start and end times directly.", "info");
        }
        return;
    }
    optimizerBreaks.push({
        id: 'break_' + Date.now(),
        name: 'Lunch Break',
        start: '13:00',
        end: '14:00'
    });
    renderOptimizerBreaks();
}

function addOptimizerBreak() {
    optimizerBreaks.push({
        id: 'break_' + Date.now(),
        name: 'Interval / Tea Break',
        start: '16:30',
        end: '17:00'
    });
    renderOptimizerBreaks();
}

function removeOptimizerBreak(id) {
    optimizerBreaks = optimizerBreaks.filter(b => b.id !== id);
    renderOptimizerBreaks();
}

function getOptimizerBreaks() {
    const rows = document.querySelectorAll('.opt-break-row');
    const result = [];
    rows.forEach(row => {
        const id = row.getAttribute('data-id');
        const nameInput = row.querySelector('.opt-break-name');
        const startInput = row.querySelector('.opt-break-start');
        const endInput = row.querySelector('.opt-break-end');

        const name = nameInput ? nameInput.value.trim() : 'Break';
        const start = startInput ? startInput.value : '';
        const end = endInput ? endInput.value : '';

        if (start && end) {
            const sM = timeStringToMinutes(start);
            const eM = timeStringToMinutes(end);
            if (eM > sM) {
                result.push({ id, name, start, end, startMins: sM, endMins: eM });
                const existing = optimizerBreaks.find(b => b.id === id);
                if (existing) {
                    existing.name = name;
                    existing.start = start;
                    existing.end = end;
                }
            }
        }
    });
    return result;
}

function renderOptimizerStageSelector(effectiveStages = []) {
    const container = document.getElementById('opt-stages-container');
    if (!container) return;

    const stages = (effectiveStages && effectiveStages.length > 0) ? effectiveStages : stagesList;

    // Display ONLY actual stages (venues). Offstage is a venue mode, not a stage!
    const stageItems = stages.map(s => ({
        id: s.id,
        name: s.name,
        isOffstage: !!s.is_offstage,
        stageNo: s.stage_no
    }));

    if (!optimizerSelectedStageIds || optimizerSelectedStageIds.length === 0) {
        optimizerSelectedStageIds = stageItems.map(s => String(s.id));
    }

    container.innerHTML = stageItems.map(s => {
        const isChecked = optimizerSelectedStageIds.includes(String(s.id));
        const badgeColor = s.isOffstage ? '#D97706' : '#4F46E5';
        const badgeBg = s.isOffstage ? '#FEF3C7' : '#EEF2FF';
        const icon = s.isOffstage ? 'fa-layer-group' : 'fa-microphone-lines';
        const venueLabel = s.isOffstage ? 'Offstage Venue' : 'Onstage Venue';

        return `
            <div class="opt-stage-pill" id="opt-stage-pill-${s.id}" style="display: inline-flex; align-items: center; gap: 0.5rem; background: ${isChecked ? badgeBg : 'white'}; border: 1.5px solid ${isChecked ? badgeColor : 'var(--border)'}; padding: 0.4rem 0.75rem; border-radius: 8px; transition: all 0.15s ease;">
                <label style="display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; margin: 0; font-weight: 700; font-size: 0.8rem; color: var(--text-main);">
                    <input type="checkbox" class="opt-stage-checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: ${badgeColor};" onchange="onOptimizerStageToggle('${s.id}')">
                    <i class="fa-solid ${icon}" style="color: ${badgeColor}; font-size: 0.8rem;"></i>
                    <span>${optEscapeHtml(s.name)}</span>
                    <span style="font-size: 0.65rem; font-weight: 800; color: ${badgeColor}; opacity: 0.9;">(${venueLabel})</span>
                </label>
                <button type="button" class="btn btn-outline" style="padding: 1px 6px; font-size: 0.65rem; font-weight: 800; border-radius: 4px; border: 1px solid var(--border); color: var(--text-muted); background: white; margin-left: 2px;" title="Schedule ONLY ${optEscapeHtml(s.name)}" onclick="selectOnlyOptimizerStage('${s.id}')">
                    Only
                </button>
            </div>
        `;
    }).join('');
}

function onOptimizerStageToggle(stageId) {
    const cb = document.querySelector(`.opt-stage-checkbox[value="${stageId}"]`);
    const pill = document.getElementById(`opt-stage-pill-${stageId}`);
    if (cb && pill) {
        if (cb.checked) {
            if (!optimizerSelectedStageIds.includes(String(stageId))) optimizerSelectedStageIds.push(String(stageId));
        } else {
            optimizerSelectedStageIds = optimizerSelectedStageIds.filter(id => id !== String(stageId));
        }
        const stageObj = (window._optimizerEffectiveStages || stagesList || []).find(s => String(s.id) === String(stageId));
        const isOffstage = stageObj ? !!stageObj.is_offstage : false;
        const badgeColor = isOffstage ? '#D97706' : '#4F46E5';
        const badgeBg = isOffstage ? '#FEF3C7' : '#EEF2FF';
        pill.style.background = cb.checked ? badgeBg : 'white';
        pill.style.borderColor = cb.checked ? badgeColor : 'var(--border)';
    }
}

function selectAllOptimizerStages(selectAll = true) {
    const checkboxes = document.querySelectorAll('.opt-stage-checkbox');
    optimizerSelectedStageIds = [];
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        if (selectAll) optimizerSelectedStageIds.push(String(cb.value));
        const pill = document.getElementById(`opt-stage-pill-${cb.value}`);
        if (pill) {
            const stageObj = (window._optimizerEffectiveStages || stagesList || []).find(s => String(s.id) === String(cb.value));
            const isOffstage = stageObj ? !!stageObj.is_offstage : false;
            const badgeColor = isOffstage ? '#D97706' : '#4F46E5';
            const badgeBg = isOffstage ? '#FEF3C7' : '#EEF2FF';
            pill.style.background = selectAll ? badgeBg : 'white';
            pill.style.borderColor = selectAll ? badgeColor : 'var(--border)';
        }
    });
}

function selectOnlyOptimizerStage(stageId) {
    const checkboxes = document.querySelectorAll('.opt-stage-checkbox');
    optimizerSelectedStageIds = [String(stageId)];
    checkboxes.forEach(cb => {
        const isTarget = String(cb.value) === String(stageId);
        cb.checked = isTarget;
        const pill = document.getElementById(`opt-stage-pill-${cb.value}`);
        if (pill) {
            const stageObj = (window._optimizerEffectiveStages || stagesList || []).find(s => String(s.id) === String(cb.value));
            const isOffstage = stageObj ? !!stageObj.is_offstage : false;
            const badgeColor = isOffstage ? '#D97706' : '#4F46E5';
            const badgeBg = isOffstage ? '#FEF3C7' : '#EEF2FF';
            pill.style.background = isTarget ? badgeBg : 'white';
            pill.style.borderColor = isTarget ? badgeColor : 'var(--border)';
        }
    });
    // Immediately re-run optimizer for this single stage!
    generateOptimizedSchedule();
}

function getOptimizerSelectedStages() {
    const checkboxes = document.querySelectorAll('.opt-stage-checkbox:checked');
    return Array.from(checkboxes).map(cb => String(cb.value));
}

function renderOptimizerCategorySelector(categories = []) {
    const container = document.getElementById('opt-categories-container');
    if (!container) return;

    const cats = (categories && categories.length > 0) ? categories : categoriesList;

    // Build category items from categoriesList
    const catItems = cats.map(c => {
        const compCount = (competitionsList || []).filter(comp => String(comp.category_id) === String(c.id)).length;
        return {
            id: String(c.id),
            name: c.name || 'Unnamed Category',
            isGeneral: !!c.is_general,
            count: compCount
        };
    });

    // Also check if there are competitions without a defined category
    const unassignedCount = (competitionsList || []).filter(comp => {
        if (!comp.category_id) return true;
        return !cats.some(c => String(c.id) === String(comp.category_id));
    }).length;

    if (unassignedCount > 0) {
        catItems.push({
            id: '__unassigned__',
            name: 'General / Uncategorized',
            isGeneral: true,
            count: unassignedCount
        });
    }

    if (catItems.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.82rem; padding: 0.5rem;">No categories defined yet in this fest.</div>`;
        return;
    }

    if (!optimizerSelectedCategoryIds || optimizerSelectedCategoryIds.length === 0) {
        optimizerSelectedCategoryIds = catItems.map(c => String(c.id));
    }

    container.innerHTML = catItems.map(c => {
        const isChecked = optimizerSelectedCategoryIds.includes(String(c.id));
        const badgeColor = c.isGeneral ? '#D97706' : '#059669';
        const badgeBg = c.isGeneral ? '#FEF3C7' : '#ECFDF5';
        const icon = c.isGeneral ? 'fa-layer-group' : 'fa-tag';
        const subLabel = `${c.count} ${c.count === 1 ? 'event' : 'events'}`;

        return `
            <div class="opt-category-pill" id="opt-cat-pill-${c.id}" style="display: inline-flex; align-items: center; gap: 0.5rem; background: ${isChecked ? badgeBg : 'white'}; border: 1.5px solid ${isChecked ? badgeColor : 'var(--border)'}; padding: 0.4rem 0.75rem; border-radius: 8px; transition: all 0.15s ease;">
                <label style="display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; margin: 0; font-weight: 700; font-size: 0.8rem; color: var(--text-main);">
                    <input type="checkbox" class="opt-category-checkbox" value="${c.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: ${badgeColor};" onchange="onOptimizerCategoryToggle('${c.id}')">
                    <i class="fa-solid ${icon}" style="color: ${badgeColor}; font-size: 0.8rem;"></i>
                    <span>${optEscapeHtml(c.name)}</span>
                    <span style="font-size: 0.65rem; font-weight: 800; color: ${badgeColor}; opacity: 0.9;">(${subLabel})</span>
                </label>
                <button type="button" class="btn btn-outline" style="padding: 1px 6px; font-size: 0.65rem; font-weight: 800; border-radius: 4px; border: 1px solid var(--border); color: var(--text-muted); background: white; margin-left: 2px;" title="Schedule ONLY ${optEscapeHtml(c.name)}" onclick="selectOnlyOptimizerCategory('${c.id}')">
                    Only
                </button>
            </div>
        `;
    }).join('');
}

function onOptimizerCategoryToggle(categoryId) {
    const cb = document.querySelector(`.opt-category-checkbox[value="${categoryId}"]`);
    const pill = document.getElementById(`opt-cat-pill-${categoryId}`);
    if (cb && pill) {
        if (cb.checked) {
            if (!optimizerSelectedCategoryIds.includes(String(categoryId))) optimizerSelectedCategoryIds.push(String(categoryId));
        } else {
            optimizerSelectedCategoryIds = optimizerSelectedCategoryIds.filter(id => id !== String(categoryId));
        }
        const isGeneral = categoryId === '__unassigned__' || (categoriesList || []).some(c => String(c.id) === String(categoryId) && !!c.is_general);
        const badgeColor = isGeneral ? '#D97706' : '#059669';
        const badgeBg = isGeneral ? '#FEF3C7' : '#ECFDF5';
        pill.style.background = cb.checked ? badgeBg : 'white';
        pill.style.borderColor = cb.checked ? badgeColor : 'var(--border)';
    }
}

function selectAllOptimizerCategories(selectAll = true) {
    const checkboxes = document.querySelectorAll('.opt-category-checkbox');
    optimizerSelectedCategoryIds = [];
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        if (selectAll) optimizerSelectedCategoryIds.push(String(cb.value));
        const pill = document.getElementById(`opt-cat-pill-${cb.value}`);
        if (pill) {
            const isGeneral = cb.value === '__unassigned__' || (categoriesList || []).some(c => String(c.id) === String(cb.value) && !!c.is_general);
            const badgeColor = isGeneral ? '#D97706' : '#059669';
            const badgeBg = isGeneral ? '#FEF3C7' : '#ECFDF5';
            pill.style.background = selectAll ? badgeBg : 'white';
            pill.style.borderColor = selectAll ? badgeColor : 'var(--border)';
        }
    });
}

function selectOnlyOptimizerCategory(categoryId) {
    const checkboxes = document.querySelectorAll('.opt-category-checkbox');
    optimizerSelectedCategoryIds = [String(categoryId)];
    checkboxes.forEach(cb => {
        const isTarget = String(cb.value) === String(categoryId);
        cb.checked = isTarget;
        const pill = document.getElementById(`opt-cat-pill-${cb.value}`);
        if (pill) {
            const isGeneral = cb.value === '__unassigned__' || (categoriesList || []).some(c => String(c.id) === String(cb.value) && !!c.is_general);
            const badgeColor = isGeneral ? '#D97706' : '#059669';
            const badgeBg = isGeneral ? '#FEF3C7' : '#ECFDF5';
            pill.style.background = isTarget ? badgeBg : 'white';
            pill.style.borderColor = isTarget ? badgeColor : 'var(--border)';
        }
    });
    // Immediately re-run optimizer for this single category!
    generateOptimizedSchedule();
}

function getOptimizerSelectedCategories() {
    const checkboxes = document.querySelectorAll('.opt-category-checkbox:checked');
    if (checkboxes.length > 0) {
        return Array.from(checkboxes).map(cb => String(cb.value));
    }
    return optimizerSelectedCategoryIds || [];
}

window.renderOptimizerCategorySelector = renderOptimizerCategorySelector;
window.onOptimizerCategoryToggle = onOptimizerCategoryToggle;
window.selectAllOptimizerCategories = selectAllOptimizerCategories;
window.selectOnlyOptimizerCategory = selectOnlyOptimizerCategory;
window.getOptimizerSelectedCategories = getOptimizerSelectedCategories;

function packSwimlaneEvents(items) {
    if (!items || items.length === 0) return { packed: [], rowCount: 1 };
    
    // Sort items by start time asc, then duration desc
    const sorted = [...items].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    
    // Each row tracks its current end time
    const rowEnds = [];
    
    const packed = sorted.map(item => {
        let placedRow = -1;
        for (let r = 0; r < rowEnds.length; r++) {
            // Buffer of 2 mins between blocks on same sub-row to prevent touching borders
            if (item.start >= rowEnds[r] + 2) {
                placedRow = r;
                rowEnds[r] = item.end;
                break;
            }
        }
        if (placedRow === -1) {
            placedRow = rowEnds.length;
            rowEnds.push(item.end);
        }
        return { ...item, rowIdx: placedRow };
    });
    
    return { packed, rowCount: Math.max(1, rowEnds.length) };
}

async function openAutoSchedulerModal() {
    const optDateInput = document.getElementById('opt-date');
    if (optDateInput && !optDateInput.value) {
        // Find earliest date from schedule or default to today
        const dates = Object.values(masterSchedule).map(s => s.date).filter(Boolean).sort();
        optDateInput.value = dates.length > 0 ? dates[0] : new Date().toISOString().split('T')[0];
    }

    pendingOptimizedSchedule = null;
    const previewContainer = document.getElementById('opt-preview-container');
    const applyBtn = document.getElementById('btn-apply-optimized-schedule');
    const metricsBadge = document.getElementById('opt-metrics-badge');
    const statusIndicator = document.getElementById('opt-status-indicator');

    if (previewContainer) {
        previewContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem; font-size: 0.9rem; font-weight: 500;"><div class="spinner" style="display:inline-block; margin-bottom: 0.5rem;"></div><br>Analyzing constraints and generating clash-free timeline...</div>`;
    }
    if (applyBtn) applyBtn.style.display = 'none';
    if (metricsBadge) metricsBadge.style.display = 'none';
    if (statusIndicator) statusIndicator.innerText = 'Initializing optimizer...';

    // Ensure baseline data is loaded before rendering stages & categories
    if (competitionsList.length === 0) await loadCompetitions();
    if (stagesList.length === 0) await loadStagesAndTeams();
    if (categoriesList.length === 0) await loadCategories();

    let effectiveStages = [...stagesList];
    let isSimulatedStages = false;
    if (effectiveStages.length === 0) {
        isSimulatedStages = true;
        effectiveStages = [
            { id: 'sim_stage_1', name: 'Stage 1 (Main Stage)', stage_no: 1, is_simulated: true },
            { id: 'sim_stage_2', name: 'Stage 2 (Auditorium)', stage_no: 2, is_simulated: true },
            { id: 'sim_stage_3', name: 'Stage 3 (Mini Hall)', stage_no: 3, is_simulated: true }
        ];
    }
    window._optimizerEffectiveStages = effectiveStages;
    window._optimizerIsSimulated = isSimulatedStages;

    // Render Stage Selector, Category Selector & Breaks UI
    renderOptimizerStageSelector(effectiveStages);
    renderOptimizerCategorySelector();
    renderOptimizerBreaks();

    document.getElementById('autoSchedulerModal').classList.add('show');

    // Automatically run the optimizer calculation
    setTimeout(() => {
        generateOptimizedSchedule();
    }, 150);
}

async function generateOptimizedSchedule() {
    const targetDate = document.getElementById('opt-date')?.value;
    const startTimeStr = document.getElementById('opt-start-time')?.value || '09:00';
    const endTimeStr = document.getElementById('opt-end-time')?.value || '18:00';
    const bufferMins = parseInt(document.getElementById('opt-buffer-mins')?.value) || 15;
    const stageStrategy = document.getElementById('opt-stage-strategy')?.value || 'auto_balance';
    const scope = document.getElementById('opt-scope')?.value || 'unscheduled_only';

    if (!targetDate) {
        alert("Please choose a target fest date.");
        return;
    }

    const startMins = timeStringToMinutes(startTimeStr);
    const endLimitMins = timeStringToMinutes(endTimeStr);

    if (endLimitMins <= startMins) {
        alert("End time must be after start time.");
        return;
    }

    const statusIndicator = document.getElementById('opt-status-indicator');
    if (statusIndicator) statusIndicator.innerText = 'Analyzing constraints, participant graph, and stage capacities...';

    // Ensure baseline data is loaded
    if (competitionsList.length === 0) await loadCompetitions();
    if (stagesList.length === 0) await loadStagesAndTeams();

    // Auto-synthesize virtual stages if festival has no physical stages created yet
    let effectiveStages = [...stagesList];
    let isSimulatedStages = false;
    if (effectiveStages.length === 0) {
        isSimulatedStages = true;
        effectiveStages = [
            { id: 'sim_stage_1', name: 'Stage 1 (Main Stage)', stage_no: 1, is_simulated: true },
            { id: 'sim_stage_2', name: 'Stage 2 (Auditorium)', stage_no: 2, is_simulated: true },
            { id: 'sim_stage_3', name: 'Stage 3 (Mini Hall)', stage_no: 3, is_simulated: true }
        ];
    }
    window._optimizerEffectiveStages = effectiveStages;
    window._optimizerIsSimulated = isSimulatedStages;

    // Read configured breaks (Lunch, Tea, etc.)
    const activeBreaks = getOptimizerBreaks();

    // Read selected stages
    const selectedStageIds = getOptimizerSelectedStages();
    if (selectedStageIds.length === 0) {
        alert("Please select at least one stage or venue to schedule.");
        if (statusIndicator) statusIndicator.innerText = 'No stages selected.';
        return;
    }

    // Read selected categories
    const selectedCategoryIds = getOptimizerSelectedCategories();
    if (selectedCategoryIds.length === 0 && (categoriesList.length > 0 || competitionsList.some(c => c.category_id))) {
        alert("Please select at least one category to schedule.");
        if (statusIndicator) statusIndicator.innerText = 'No categories selected.';
        return;
    }

    const targetStages = effectiveStages.filter(s => selectedStageIds.includes(String(s.id)));

    const enrollments = await fetchScheduleEnrollments(true);
    const compStudentsMap = {};
    enrollments.forEach(e => {
        if (!e.competition_id || !e.participant_id) return;
        if (!compStudentsMap[e.competition_id]) compStudentsMap[e.competition_id] = [];
        compStudentsMap[e.competition_id].push(e.participant_id);
    });

    // 1. Filter Candidate Competitions based on Scope, Selected Categories and Selected Stages
    let candidates = [];
    if (scope === 'unscheduled_only') {
        candidates = competitionsList.filter(c => {
            const s = masterSchedule[c.id];
            return !s || !s.date || !s.time;
        });
    } else {
        candidates = [...competitionsList];
    }

    // Filter strictly to selected categories (if categories are configured)
    if (selectedCategoryIds.length > 0) {
        candidates = candidates.filter(comp => {
            const compCatId = comp.category_id ? String(comp.category_id) : '__unassigned__';
            if (selectedCategoryIds.includes(compCatId)) return true;
            const isKnown = (categoriesList || []).some(cat => String(cat.id) === String(comp.category_id));
            if (!isKnown && selectedCategoryIds.includes('__unassigned__')) return true;
            return false;
        });
    }

    // Filter strictly to selected stages
    candidates = candidates.filter(comp => {
        if (comp.stage_id) {
            // Pre-assigned competition: only include if its pre-assigned stage is selected
            return selectedStageIds.includes(String(comp.stage_id));
        }
        // Unassigned competition:
        if (comp.is_offstage) {
            // Prioritize offstage venues if available among selected stages
            return targetStages.some(s => s.is_offstage) || targetStages.length > 0;
        } else {
            // Prioritize onstage venues if available among selected stages
            return targetStages.some(s => !s.is_offstage) || targetStages.length > 0;
        }
    });

    if (candidates.length === 0) {
        const previewContainer = document.getElementById('opt-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 3rem; font-weight: 600;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.2rem; color: #10B981; margin-bottom: 0.75rem; display: block;"></i>
                    No candidate competitions found for the selected stage(s).<br>
                    <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-muted);">
                        Either all events on this stage are already scheduled, or no unscheduled events are assigned to this stage.
                    </span>
                </div>
            `;
        }
        if (statusIndicator) statusIndicator.innerText = 'No candidate competitions for selected stage(s).';
        const applyBtn = document.getElementById('btn-apply-optimized-schedule');
        if (applyBtn) applyBtn.style.display = 'none';
        return;
    }

    // 2. Compute Durations & MRV Sort (Most Constrained First)
    candidates.forEach(c => {
        const enrolled = compStudentsMap[c.id] || [];
        const enrolledCount = enrolled.length;
        
        let duration = 30;
        if (c.is_offstage) {
            duration = parseInt(c.time_per_student) || 45;
        } else {
            const perStudent = parseInt(c.time_per_student) || 5;
            if (enrolledCount > 0) {
                duration = Math.max(15, enrolledCount * perStudent);
            } else {
                duration = Math.max(20, (parseInt(c.max_participants) || 6) * perStudent);
            }
        }
        
        // Cap single event duration between 15 and 150 minutes
        c.calculatedDuration = Math.min(150, Math.max(15, duration));

        // MRV Degree: Count how many enrolled students overlap with OTHER candidate competitions
        let sharedStudentsCount = 0;
        candidates.forEach(otherC => {
            if (otherC.id === c.id) return;
            const otherStudents = compStudentsMap[otherC.id] || [];
            const shared = enrolled.filter(id => otherStudents.includes(id));
            sharedStudentsCount += shared.length;
        });

        c.constraintDegree = (sharedStudentsCount * 3) + enrolledCount;
    });

    // Sort by constraint degree descending (hardest constraints first)
    candidates.sort((a, b) => b.constraintDegree - a.constraintDegree);

    // 3. Initialize Stage Timelines for selected stages
    const stageTimelines = {};
    targetStages.forEach(s => {
        stageTimelines[s.id] = [];
    });

    const studentTimelines = {}; // { studentId: [ { start, end } ] }

    // Load existing slots on targetDate (load ALL students across whole fest to prevent clash!)
    Object.entries(masterSchedule).forEach(([compId, sched]) => {
        if (sched.date !== targetDate) return;
        const comp = competitionsList.find(c => c.id == compId);
        if (!comp) return;

        const sStart = timeStringToMinutes(sched.time);
        let sEnd = sched.to_time ? timeStringToMinutes(sched.to_time) : (sStart + (parseInt(sched.manual_time) || 30));
        if (sEnd <= sStart) sEnd = sStart + 30;

        if (scope === 'unscheduled_only') {
            const stageKey = comp.stage_id || targetStages[0]?.id;
            if (stageKey && stageTimelines[stageKey]) {
                stageTimelines[stageKey].push({ compId, start: sStart, end: sEnd });
            }
        }

        const sList = compStudentsMap[compId] || [];
        sList.forEach(sId => {
            if (!studentTimelines[sId]) studentTimelines[sId] = [];
            studentTimelines[sId].push({ start: sStart, end: sEnd });
        });
    });

    // 4. Constraint-Satisfaction Greedy Placement
    const proposedSchedule = {};
    let scheduledCount = 0;
    let unplacedList = [];

    candidates.forEach(comp => {
        const compDuration = comp.calculatedDuration;
        const compStudents = compStudentsMap[comp.id] || [];

        // Determine eligible stages among the selected stages
        let eligibleStages = [];
        if (stageStrategy === 'preserve' && comp.stage_id && targetStages.some(s => String(s.id) === String(comp.stage_id))) {
            eligibleStages = [comp.stage_id];
        } else if (comp.stage_id && targetStages.some(s => String(s.id) === String(comp.stage_id))) {
            eligibleStages = [comp.stage_id, ...targetStages.map(s => s.id).filter(id => String(id) !== String(comp.stage_id))];
        } else {
            // If competition is offstage, prioritize offstage venues; if onstage, prioritize onstage venues
            if (comp.is_offstage) {
                const offVenues = targetStages.filter(s => s.is_offstage).map(s => s.id);
                const onVenues = targetStages.filter(s => !s.is_offstage).map(s => s.id);
                eligibleStages = offVenues.length > 0 ? [...offVenues, ...onVenues] : onVenues;
            } else {
                const onVenues = targetStages.filter(s => !s.is_offstage).map(s => s.id);
                const offVenues = targetStages.filter(s => s.is_offstage).map(s => s.id);
                eligibleStages = onVenues.length > 0 ? [...onVenues, ...offVenues] : offVenues;
            }
        }

        let bestSlot = null;

        // Try candidate stages
        for (const stageKey of eligibleStages) {
            let candidateStart = startMins;

            while (candidateStart + compDuration <= endLimitMins) {
                const candidateEnd = candidateStart + compDuration;

                // Check ALL configured Breaks & Intervals (Lunch, Tea, etc.)
                let clashedWithBreak = false;
                for (const b of activeBreaks) {
                    if (candidateStart < b.endMins && candidateEnd > b.startMins) {
                        candidateStart = b.endMins;
                        clashedWithBreak = true;
                        break;
                    }
                }
                if (clashedWithBreak) continue;

                // Check Stage Occupancy
                const stageOccupied = (stageTimelines[stageKey] || []).some(slot => 
                    (candidateStart < slot.end + bufferMins) && (candidateEnd > slot.start)
                );
                if (stageOccupied) {
                    candidateStart += 10;
                    continue;
                }

                // Check Student Clash across all stages
                let hasStudentClash = false;
                for (const sId of compStudents) {
                    const sSlots = studentTimelines[sId] || [];
                    const clash = sSlots.some(slot => 
                        (candidateStart < slot.end + bufferMins) && (candidateEnd > slot.start - bufferMins)
                    );
                    if (clash) {
                        hasStudentClash = true;
                        break;
                    }
                }

                if (!hasStudentClash) {
                    // Valid slot found for this stage
                    if (!bestSlot || candidateStart < bestSlot.start) {
                        bestSlot = {
                            stageKey,
                            start: candidateStart,
                            end: candidateEnd
                        };
                    }
                    break;
                }

                candidateStart += 10;
            }

            // If we found a slot on the primary stage, prioritize it
            if (bestSlot && bestSlot.stageKey === comp.stage_id) break;
        }

        if (bestSlot) {
            proposedSchedule[comp.id] = {
                date: targetDate,
                time: minutesToTimeString(bestSlot.start),
                to_time: minutesToTimeString(bestSlot.end),
                manual_time: compDuration,
                status: 'draft',
                stage_id: bestSlot.stageKey,
                is_offstage: comp.is_offstage
            };

            // Update timelines
            if (stageTimelines[bestSlot.stageKey]) {
                stageTimelines[bestSlot.stageKey].push({ compId: comp.id, start: bestSlot.start, end: bestSlot.end });
            }
            compStudents.forEach(sId => {
                if (!studentTimelines[sId]) studentTimelines[sId] = [];
                studentTimelines[sId].push({ start: bestSlot.start, end: bestSlot.end });
            });

            scheduledCount++;
        } else {
            unplacedList.push(comp);
        }
    });

    pendingOptimizedSchedule = proposedSchedule;

    // 5. Render Visual Timeline Gantt Preview
    renderOptimizationPreview(proposedSchedule, targetDate, startMins, endLimitMins, activeBreaks, unplacedList, targetStages, isSimulatedStages, compStudentsMap);

    // Update Badges & Actions
    const metricsBadge = document.getElementById('opt-metrics-badge');
    const badgeSuccess = document.getElementById('opt-badge-success');
    const badgeClash = document.getElementById('opt-badge-clash');
    const applyBtn = document.getElementById('btn-apply-optimized-schedule');

    if (metricsBadge) metricsBadge.style.display = 'flex';
    if (badgeSuccess) badgeSuccess.innerText = `${scheduledCount} Events Scheduled`;
    if (badgeClash) {
        if (unplacedList.length === 0) {
            badgeClash.innerText = `0 Clashes • 100% Conflict Free`;
            badgeClash.style.background = '#D1FAE5';
            badgeClash.style.color = '#059669';
        } else {
            badgeClash.innerText = `${unplacedList.length} Unplaced (Operating Hours Full)`;
            badgeClash.style.background = '#FEF3C7';
            badgeClash.style.color = '#D97706';
        }
    }
    if (statusIndicator) {
        statusIndicator.innerText = unplacedList.length === 0 
            ? `Optimization Complete! 100% Clash-Free Schedule Generated.` 
            : `Scheduled ${scheduledCount} events. Extend operating hours to fit all ${unplacedList.length} remaining.`;
    }
    if (applyBtn) applyBtn.style.display = 'inline-flex';
}

function renderOptimizationPreview(proposedSchedule, targetDate, startMins = 540, endLimitMins = 1080, activeBreaks = [], unplacedList = [], targetStages = [], isSimulatedStages = false, compStudentsMap = {}) {
    const container = document.getElementById('opt-preview-container');
    if (!container) return;

    const startTimeStr = minutesToTimeString(startMins);
    const endTimeStr = minutesToTimeString(endLimitMins);

    const compIds = Object.keys(proposedSchedule);
    if (compIds.length === 0 && unplacedList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--danger); padding: 3rem; font-weight: 600;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                No events could be assigned within the time window. Try extending operating hours or adding more stages.
            </div>
        `;
        return;
    }

    const totalDuration = endLimitMins - startMins;

    // Build timeline hourly markers for Header & Lane Grid
    let headerTimeMarkersHtml = '';
    let laneGridLinesHtml = '';
    const startHour = Math.floor(startMins / 60);
    const endHour = Math.ceil(endLimitMins / 60);

    for (let h = startHour; h <= endHour; h++) {
        const markerMins = h * 60;
        if (markerMins < startMins || markerMins > endLimitMins) continue;
        const leftPercent = ((markerMins - startMins) / totalDuration) * 100;
        const displayTime = `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
        
        headerTimeMarkersHtml += `
            <div style="position: absolute; left: ${leftPercent}%; top: 0; bottom: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 4px; pointer-events: none;">
                <span style="font-size: 0.7rem; font-weight: 700; color: #475569; font-family: monospace; white-space: nowrap;">${displayTime}</span>
                <div style="width: 1px; height: 6px; background: #CBD5E1; margin-top: 2px;"></div>
            </div>
        `;

        laneGridLinesHtml += `
            <div style="position: absolute; left: ${leftPercent}%; top: 0; bottom: 0; border-left: 1px dashed #E2E8F0; pointer-events: none; z-index: 1;"></div>
        `;
    }

    // Breaks Badges in Header & Shading in Lanes
    let headerBreaksBadgesHtml = '';
    let laneBreakShadesHtml = '';
    (activeBreaks || []).forEach(b => {
        if (b.endMins > startMins && b.startMins < endLimitMins) {
            const bLeft = Math.max(0, ((b.startMins - startMins) / totalDuration) * 100);
            const bWidth = Math.min(100 - bLeft, ((b.endMins - b.startMins) / totalDuration) * 100);
            const bName = (b.name || 'BREAK').toUpperCase();
            const iconClass = bName.includes('LUNCH') ? 'fa-utensils' : (bName.includes('TEA') ? 'fa-mug-hot' : 'fa-clock');

            headerBreaksBadgesHtml += `
                <div style="position: absolute; left: ${bLeft}%; width: ${bWidth}%; top: 4px; bottom: 4px; background: #FEF3C7; border: 1.5px dashed #F59E0B; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; z-index: 5; overflow: hidden; padding: 0 4px;" title="${optEscapeHtml(b.name)} (${minutesToTimeString(b.startMins)} - ${minutesToTimeString(b.endMins)})">
                    <i class="fa-solid ${iconClass}" style="font-size: 0.72rem; color: #D97706;"></i>
                    <span style="font-size: 0.72rem; font-weight: 800; color: #92400E; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${optEscapeHtml(bName)}</span>
                </div>
            `;

            laneBreakShadesHtml += `
                <div style="position: absolute; left: ${bLeft}%; width: ${bWidth}%; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.04), rgba(245, 158, 11, 0.04) 10px, rgba(245, 158, 11, 0.09) 10px, rgba(245, 158, 11, 0.09) 20px); border-left: 1.5px dashed rgba(245, 158, 11, 0.4); border-right: 1.5px dashed rgba(245, 158, 11, 0.4); z-index: 1; pointer-events: none;"></div>
            `;
        }
    });

    // Build stage swimlanes for selected stages (actual stages only)
    const activeStageList = (targetStages && targetStages.length > 0) ? targetStages : (window._optimizerEffectiveStages || stagesList);
    const stageTracks = activeStageList.map(s => ({
        id: s.id,
        name: s.name,
        isOffstage: !!s.is_offstage,
        is_simulated: s.is_simulated
    }));

    let swimlanesHtml = '';

    stageTracks.forEach(track => {
        // Collect items in this stage track
        const trackItems = compIds
            .map(id => {
                const sched = proposedSchedule[id];
                const comp = competitionsList.find(c => c.id == id);
                return { 
                    id, 
                    sched, 
                    comp,
                    start: timeStringToMinutes(sched.time),
                    end: timeStringToMinutes(sched.to_time)
                };
            })
            .filter(item => {
                if (!item.comp) return false;
                return String(item.sched.stage_id) === String(track.id);
            });

        // Dynamic multi-row packing: assigns non-overlapping rowIdx to every event
        const { packed, rowCount } = packSwimlaneEvents(trackItems);

        const rowHeight = 36;
        const rowGap = 6;
        const lanePadding = 10;
        const totalLaneHeight = Math.max(68, (rowCount * rowHeight) + ((rowCount - 1) * rowGap) + (lanePadding * 2));

        let blocksHtml = '';
        packed.forEach(item => {
            const leftPct = Math.max(0, ((item.start - startMins) / totalDuration) * 100);
            const rawWidthPct = ((item.end - item.start) / totalDuration) * 100;
            const widthPct = Math.min(100 - leftPct, Math.max(rawWidthPct, 2.5));
            const topPos = lanePadding + (item.rowIdx * (rowHeight + rowGap));

            const bgGradient = track.isOffstage 
                ? 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)' 
                : 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)';
            const shadowColor = track.isOffstage ? 'rgba(217, 119, 6, 0.3)' : 'rgba(79, 70, 229, 0.3)';
            const categoryName = item.comp.categories?.name || 'General';
            const studentCount = (compStudentsMap[item.id] || []).length;

            blocksHtml += `
                <div style="position: absolute; left: ${leftPct}%; width: ${widthPct}%; top: ${topPos}px; height: ${rowHeight}px; background: ${bgGradient}; border-radius: 6px; color: white; padding: 3px 8px; overflow: hidden; box-shadow: 0 2px 5px ${shadowColor}; border: 1px solid rgba(255,255,255,0.25); cursor: pointer; z-index: 2; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; transition: transform 0.15s ease, box-shadow 0.15s ease;"
                     title="${optEscapeHtml(item.comp.name)} (${optEscapeHtml(categoryName)})&#10;Time: ${item.sched.time} - ${item.sched.to_time} (${item.sched.manual_time}m)&#10;Students: ${studentCount} enrolled"
                     onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.zIndex='20'; this.style.boxShadow='0 6px 14px rgba(0,0,0,0.25)';"
                     onmouseout="this.style.transform='none'; this.style.zIndex='2'; this.style.boxShadow='0 2px 5px ${shadowColor}';">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; overflow: hidden; line-height: 1.15;">
                        <span style="font-weight: 700; font-size: 0.73rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${optEscapeHtml(item.comp.name)}</span>
                        <span style="font-size: 0.62rem; opacity: 0.9; font-family: monospace; white-space: nowrap; flex-shrink: 0;">${item.sched.time}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 0.62rem; opacity: 0.9; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
                        <span style="background: rgba(255,255,255,0.22); padding: 1px 4px; border-radius: 3px; font-weight: 600;">${optEscapeHtml(categoryName)}</span>
                        <span>${item.sched.manual_time}m</span>
                        ${studentCount > 0 ? `<span>• ${studentCount} part.</span>` : ''}
                    </div>
                </div>
            `;
        });

        const trackBadgeColor = track.isOffstage ? '#D97706' : '#4F46E5';
        const trackBadgeBg = track.isOffstage ? '#FEF3C7' : '#EEF2FF';

        swimlanesHtml += `
            <div style="display: flex; border-bottom: 1px solid var(--border); min-height: ${totalLaneHeight}px;">
                <div style="width: 175px; min-width: 175px; padding: 0.75rem 1rem; background: var(--bg-main); border-right: 1px solid var(--border); display: flex; flex-direction: column; justify-content: center; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="${track.isOffstage ? 'fa-solid fa-layer-group' : 'fa-solid fa-microphone-stage'}" style="color: ${trackBadgeColor}; font-size: 0.95rem;"></i>
                        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); word-break: break-word;">${optEscapeHtml(track.name)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                        <span style="font-size: 0.68rem; font-weight: 700; color: ${trackBadgeColor}; background: ${trackBadgeBg}; padding: 1px 6px; border-radius: 999px;">${trackItems.length} comp${trackItems.length === 1 ? '' : 's'}</span>
                        <span style="font-size: 0.65rem; color: ${trackBadgeColor}; background: ${trackBadgeBg}; padding: 1px 5px; border-radius: 4px; font-weight: 700;">${track.isOffstage ? 'Offstage Venue' : 'Onstage Venue'}</span>
                        ${track.is_simulated ? `<span style="font-size: 0.65rem; color: #4338CA; background: #E0E7FF; padding: 1px 5px; border-radius: 4px; font-weight: 600;">Auto-Created</span>` : ''}
                        ${rowCount > 1 ? `<span style="font-size: 0.65rem; color: var(--text-muted); background: #F1F5F9; padding: 1px 5px; border-radius: 4px;">${rowCount} parallel tracks</span>` : ''}
                    </div>
                </div>
                <div style="flex: 1; position: relative; min-height: ${totalLaneHeight}px; background: white;">
                    ${laneGridLinesHtml}
                    ${laneBreakShadesHtml}
                    ${blocksHtml}
                </div>
            </div>
        `;
    });

    let unplacedHtml = '';
    if (unplacedList.length > 0) {
        unplacedHtml = `
            <div style="margin-top: 1.25rem; padding: 1rem 1.25rem; background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: var(--radius-lg);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div>
                            <strong style="color: #92400E; font-size: 0.88rem;">${unplacedList.length} Events Could Not Fit Into Operating Hours (${startTimeStr} - ${endTimeStr})</strong>
                            <p style="margin: 0; font-size: 0.78rem; color: #B45309;">Operating hours are saturated. Extend end time or add more stages to fit all remaining events.</p>
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; max-height: 140px; overflow-y: auto; padding: 0.25rem 0;">
                    ${unplacedList.map(c => `
                        <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: white; border: 1px solid #FCD34D; color: #78350F; padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
                            <i class="${c.is_offstage ? 'fa-solid fa-layer-group' : 'fa-solid fa-microphone-stage'}" style="font-size: 0.7rem; color: #D97706;"></i>
                            <span>${optEscapeHtml(c.name)}</span>
                            <span style="font-size: 0.65rem; color: #92400E; background: #FEF3C7; padding: 1px 4px; border-radius: 3px;">${optEscapeHtml(c.categories?.name || 'Gen')} • ${c.calculatedDuration || 30}m</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    let simNoticeHtml = '';
    if (isSimulatedStages) {
        simNoticeHtml = `
            <div style="margin-bottom: 0.85rem; padding: 0.65rem 0.95rem; background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 8px; font-size: 0.8rem; color: #1E40AF; display: flex; align-items: center; gap: 0.65rem;">
                <i class="fa-solid fa-circle-info" style="font-size: 1.05rem; color: #3B82F6; flex-shrink: 0;"></i>
                <span><strong>Zero Physical Stages Detected:</strong> The optimizer automatically allocated 3 virtual stages (Stage 1, Stage 2, Stage 3) to schedule all onstage competitions. Clicking <em>"Apply & Save to Master Schedule"</em> will auto-provision these stages into your festival.</span>
            </div>
        `;
    }

    container.innerHTML = `
        ${simNoticeHtml}
        <div style="overflow-x: auto; border: 1.5px solid var(--border); border-radius: 10px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="min-width: 820px;">
                <!-- Dedicated Sticky Time Header -->
                <div style="display: flex; background: #F8FAFC; border-bottom: 2px solid var(--border); position: sticky; top: 0; z-index: 10;">
                    <div style="width: 175px; min-width: 175px; padding: 0.65rem 1rem; border-right: 1px solid var(--border); font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;">
                        <span>Stage / Venue</span>
                        <i class="fa-solid fa-layer-group" style="opacity: 0.4;"></i>
                    </div>
                    <div style="flex: 1; position: relative; height: 36px;">
                        ${headerTimeMarkersHtml}
                        ${headerBreaksBadgesHtml}
                    </div>
                </div>
                <!-- Swimlanes Body -->
                <div>
                    ${swimlanesHtml}
                </div>
            </div>
        </div>
        ${unplacedHtml}
    `;
}

async function applyOptimizedSchedule() {
    if (!pendingOptimizedSchedule || Object.keys(pendingOptimizedSchedule).length === 0) {
        alert("No optimized schedule to apply.");
        return;
    }

    const applyBtn = document.getElementById('btn-apply-optimized-schedule');
    if (applyBtn) {
        applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying & Saving...';
        applyBtn.disabled = true;
    }

    try {
        // 0. Auto-provision simulated stages into database if needed
        const simStageIds = [...new Set(Object.values(pendingOptimizedSchedule).map(i => i.stage_id).filter(id => String(id).startsWith('sim_stage_')))];
        if (simStageIds.length > 0) {
            for (const simId of simStageIds) {
                const simObj = (window._optimizerEffectiveStages || []).find(s => s.id === simId) || { 
                    name: `Stage ${simId.split('_').pop()}`, 
                    stage_no: parseInt(simId.split('_').pop()) || 1 
                };
                const payload = festPayload({
                    name: simObj.name,
                    stage_no: simObj.stage_no
                });
                const { data: createdStage, error: stageErr } = await supabaseClient.from('stages').insert([payload]).select().single();
                if (!stageErr && createdStage) {
                    Object.values(pendingOptimizedSchedule).forEach(item => {
                        if (item.stage_id === simId) {
                            item.stage_id = createdStage.id;
                        }
                    });
                }
            }
            await loadStagesAndTeams();
        }

        const stageUpdates = [];

        // 1. Merge pending into masterSchedule & check stage updates
        Object.keys(pendingOptimizedSchedule).forEach(id => {
            const item = pendingOptimizedSchedule[id];
            masterSchedule[id] = {
                date: item.date,
                time: item.time,
                to_time: item.to_time,
                manual_time: item.manual_time,
                status: 'draft'
            };

            const existingComp = competitionsList.find(c => c.id == id);
            if (existingComp && item.stage_id && String(existingComp.stage_id) !== String(item.stage_id)) {
                stageUpdates.push(supabaseClient.from('competitions').update({ stage_id: item.stage_id }).eq('id', id));
            }
        });

        // 2. Persist stage updates if any
        if (stageUpdates.length > 0) {
            await Promise.all(stageUpdates);
            await loadCompetitions();
        }

        // 3. Save master_schedule in Supabase settings
        const { error } = window.festosSaveSetting ? await window.festosSaveSetting('master_schedule', masterSchedule) : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (error) throw error;

        showToast("Auto-Schedule successfully applied and persisted!", "success");
        document.getElementById('autoSchedulerModal').classList.remove('show');
        await loadSchedules();
    } catch(e) {
        showToast("Failed to apply schedule: " + e.message, "error");
    } finally {
        if (applyBtn) {
            applyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Apply & Save to Master Schedule';
            applyBtn.disabled = false;
        }
    }
}


// NEW: Global Calculator Function
window.updateScheduleTimeCalc = function() {
    const compId = document.getElementById('modSchedComp').value;
    if(!compId) return;
    const comp = competitionsList.find(c => c.id == compId);
    
    const enrolled = comp?.participant_competitions?.[0]?.count || 0;
    const timePerStudent = comp?.time_per_student || 0;
    
    // STRICT OFFSTAGE LOGIC
    let estTime = 0;
    if (comp?.is_offstage) {
        // Offstage events happen simultaneously, so the entered time IS the total time
        estTime = timePerStudent; 
    } else {
        // Onstage events scale with the number of enrolled students
        estTime = enrolled * timePerStudent; 
    }
    
    document.getElementById('modSchedEstTime').value = estTime;
    
    const manualTime = parseInt(document.getElementById('modSchedManualTime').value);
    const finalTimeToAdd = isNaN(manualTime) || manualTime <= 0 ? estTime : manualTime;
    
    const fromTimeStr = document.getElementById('modSchedTime').value;
    if(fromTimeStr && finalTimeToAdd > 0) {
        const [hours, minutes] = fromTimeStr.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours, minutes, 0, 0);
        dateObj.setMinutes(dateObj.getMinutes() + finalTimeToAdd);
        
        const toHours = String(dateObj.getHours()).padStart(2, '0');
        const toMins = String(dateObj.getMinutes()).padStart(2, '0');
        document.getElementById('modSchedToTime').value = `${toHours}:${toMins}`;
    } else {
        document.getElementById('modSchedToTime').value = '';
    }
};

function openScheduleModal(editCompId = null) {
    const isEdit = !!editCompId;
    const schedData = isEdit ? masterSchedule[editCompId] : null;
    const currentComp = isEdit ? (competitionsList || []).find(c => String(c.id) === String(editCompId)) : null;
    
    let catOpts = `<option value="">-- ALL CATEGORIES --</option>` + (categoriesList || []).map(c => `
        <option value="${c.id}" ${currentComp && String(currentComp.category_id) === String(c.id) ? 'selected' : ''}>${escapeSheetHtml(c.name)}</option>
    `).join('');
    
    let stageOpts = `<option value="">-- NO STAGE ASSIGNED (TBD) --</option>`
        + (stagesList || []).map(s => {
            const isOff = s.is_offstage || (window.stageOffstageFlags && window.stageOffstageFlags[s.id]);
            const prefix = isOff ? '📝 ' : '🎭 ';
            const suffix = isOff ? ' [Offstage Venue]' : '';
            const isSel = currentComp && String(currentComp.stage_id) === String(s.id);
            return `<option value="${s.id}" ${isSel ? 'selected' : ''}>${prefix}${escapeSheetHtml(s.name)}${suffix}</option>`;
        }).join('');
    
    openModal(isEdit ? 'Edit Schedule Event' : 'Schedule Event', `
        <div class="grid-2" style="gap: 1rem;">
            <div class="form-group">
                <label>1. Category</label>
                <select id="modSchedCat" onchange="loadModSchedComps('${editCompId || ''}')">
                    ${catOpts}
                </select>
            </div>
            <div class="form-group">
                <label>2. Competition</label>
                <select id="modSchedComp" onchange="window.onScheduleCompChange()">
                    <option value="">-- SELECT COMPETITION --</option>
                </select>
            </div>
        </div>

        <div class="form-group" style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                <label style="margin: 0; font-weight: 700; font-size: 0.85rem; color: var(--text-main);">Venue / Stage (Mark from Added Stages)</label>
                <span id="modSchedVenueBadge" style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #E0E7FF; color: #4338CA;">
                    Auto-fetched from Competition
                </span>
            </div>
            <div id="modSchedStageContainer">
                <select id="modSchedStage" style="width: 100%; background: white;" onchange="window.updateScheduleVenueUI()">
                    ${stageOpts}
                </select>
            </div>
            <div id="modSchedOffstageNotice" style="display: none; padding: 0.6rem 0.85rem; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; color: #92400E; font-size: 0.82rem; font-weight: 600; margin-top: 0.5rem;">
                <i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> Offstage Competition &mdash; Conducted off-stage (No physical stage required).
            </div>
        </div>

        <div class="grid-2" style="gap: 1rem;">
            <div class="form-group">
                <label>System Est. Time (Mins)</label>
                <input type="number" id="modSchedEstTime" disabled style="background: var(--bg-main);">
            </div>
            <div class="form-group">
                <label>Manual Total Time (Mins)</label>
                <input type="number" id="modSchedManualTime" oninput="window.updateScheduleTimeCalc()" value="${schedData?.manual_time || ''}">
            </div>
        </div>
        <div class="form-group">
            <label>Date</label>
            <input type="date" id="modSchedDate" style="text-transform: none;" value="${schedData ? schedData.date : ''}">
        </div>
        <div class="grid-2" style="gap: 1rem;">
            <div class="form-group">
                <label>From Time</label>
                <input type="time" id="modSchedTime" style="text-transform: none;" value="${schedData ? schedData.time : ''}" oninput="window.updateScheduleTimeCalc()">
            </div>
            <div class="form-group">
                <label>To Time (Auto-calculated)</label>
                <input type="time" id="modSchedToTime" style="text-transform: none;" value="${schedData?.to_time || ''}" readonly style="background: var(--bg-main);">
            </div>
        </div>
    `, () => saveSchedule(editCompId));
    
    // Populate competition options and auto-fetch venue
    loadModSchedComps(editCompId);
}

function loadModSchedComps(keepCompId = null) {
    const catId = document.getElementById('modSchedCat')?.value;
    const compSelect = document.getElementById('modSchedComp');
    if (!compSelect) return;
    
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION --</option>';
    
    let eligibleComps = (competitionsList || []).filter(c => {
        if (catId && String(c.category_id) !== String(catId)) return false;
        return !masterSchedule[c.id] || (keepCompId && String(c.id) === String(keepCompId));
    });
    
    // Always guarantee keepCompId is in the list
    if (keepCompId && !eligibleComps.some(c => String(c.id) === String(keepCompId))) {
        const currentComp = (competitionsList || []).find(c => String(c.id) === String(keepCompId));
        if (currentComp) eligibleComps.unshift(currentComp);
    }
    
    eligibleComps.forEach(c => {
        const isSel = keepCompId && String(c.id) === String(keepCompId);
        let venueTag = '';
        if (c.is_offstage) {
            venueTag = ' [Offstage]';
        } else if (c.stages?.name) {
            venueTag = ` [${c.stages.name}]`;
        } else if (c.stage_id) {
            const stg = (stagesList || []).find(s => String(s.id) === String(c.stage_id));
            if (stg) venueTag = ` [${stg.name}]`;
        }
        compSelect.innerHTML += `<option value="${c.id}" ${isSel ? 'selected' : ''}>${escapeSheetHtml(c.name)}${venueTag}</option>`;
    });
    
    if (keepCompId) compSelect.value = keepCompId;
    window.onScheduleCompChange();
}

window.onScheduleCompChange = function() {
    const compId = document.getElementById('modSchedComp')?.value;
    const stageSelect = document.getElementById('modSchedStage');
    const catSelect = document.getElementById('modSchedCat');

    if (!compId) {
        if (stageSelect) stageSelect.value = '';
        window.updateScheduleVenueUI();
        window.updateScheduleTimeCalc();
        return;
    }

    const comp = (competitionsList || []).find(c => String(c.id) === String(compId));
    if (!comp) {
        window.updateScheduleTimeCalc();
        return;
    }

    // Auto-sync Category if "-- ALL CATEGORIES --" was selected
    if (catSelect && !catSelect.value && comp.category_id) {
        catSelect.value = comp.category_id;
    }

    // Auto-select venue from competition if assigned
    if (stageSelect && comp.stage_id) {
        stageSelect.value = comp.stage_id;
    }

    window.updateScheduleVenueUI();
    window.updateScheduleTimeCalc();
};

window.updateScheduleVenueUI = function() {
    const stageId = document.getElementById('modSchedStage')?.value;
    const venueBadge = document.getElementById('modSchedVenueBadge');
    const offstageNotice = document.getElementById('modSchedOffstageNotice');
    if (!venueBadge) return;

    if (!stageId) {
        venueBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> No Venue Selected (TBD)';
        venueBadge.style.background = '#F1F5F9';
        venueBadge.style.color = '#64748B';
        if (offstageNotice) offstageNotice.style.display = 'none';
        return;
    }

    const stage = (stagesList || []).find(s => String(s.id) === String(stageId));
    const isOffstage = stage ? (stage.is_offstage || (window.stageOffstageFlags && window.stageOffstageFlags[stage.id])) : false;

    if (isOffstage) {
        venueBadge.innerHTML = `<i class="fa-solid fa-layer-group"></i> Offstage Venue (No judge required to start/end in stage controller)`;
        venueBadge.style.background = '#FEF3C7';
        venueBadge.style.color = '#D97706';
        if (offstageNotice) {
            offstageNotice.style.display = 'block';
            offstageNotice.innerHTML = `<i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> <strong>Offstage Venue:</strong> Stage Controller can start and end this event without an assigned judge. Judge evaluates after completion.`;
        }
    } else {
        venueBadge.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> Onstage Venue (Judge required before starting event)`;
        venueBadge.style.background = '#ECFDF5';
        venueBadge.style.color = '#059669';
        if (offstageNotice) offstageNotice.style.display = 'none';
    }
};

async function saveSchedule(editCompId) {
    const selectedCompId = document.getElementById('modSchedComp')?.value;
    const targetCompId = selectedCompId || editCompId;
    const date = document.getElementById('modSchedDate')?.value;
    const time = document.getElementById('modSchedTime')?.value;
    const toTime = document.getElementById('modSchedToTime')?.value;
    const manualTime = document.getElementById('modSchedManualTime')?.value;
    const selectedCatId = document.getElementById('modSchedCat')?.value;
    const selectedStageVal = document.getElementById('modSchedStage')?.value;

    if (!targetCompId || !date || !time) return showToast("Competition, Date and Start Time are required", "error");

    setLoading('modalSaveBtn', true);

    try {
        // 1. If competition changed during edit (editCompId -> targetCompId)
        if (editCompId && String(editCompId) !== String(targetCompId)) {
            delete masterSchedule[editCompId];
        }

        // 2. Update Competition's Stage & Category if modified
        const targetComp = (competitionsList || []).find(c => String(c.id) === String(targetCompId));
        if (targetComp) {
            const compUpdates = {};
            if (selectedStageVal) {
                compUpdates.stage_id = selectedStageVal;
                const chosenStage = (stagesList || []).find(s => String(s.id) === String(selectedStageVal));
                compUpdates.is_offstage = chosenStage ? !!chosenStage.is_offstage : targetComp.is_offstage;
            } else {
                compUpdates.stage_id = null;
            }

            if (selectedCatId) {
                compUpdates.category_id = selectedCatId;
            }

            if (Object.keys(compUpdates).length > 0) {
                const { error: compErr } = await supabaseClient.from('competitions').update(compUpdates).eq('id', targetCompId);
                if (compErr) console.warn('Could not update competition details:', compErr);

                // Update in-memory
                Object.assign(targetComp, compUpdates);
                if (compUpdates.stage_id) {
                    const s = (stagesList || []).find(stg => String(stg.id) === String(compUpdates.stage_id));
                    targetComp.stages = s ? { name: s.name, is_offstage: s.is_offstage } : null;
                } else if (compUpdates.stage_id === null) {
                    targetComp.stages = null;
                }
                if (compUpdates.category_id) {
                    const c = (categoriesList || []).find(cat => String(cat.id) === String(compUpdates.category_id));
                    targetComp.categories = c ? { name: c.name } : null;
                }
            }
        }

        // 3. Save master schedule
        masterSchedule[targetCompId] = {
            date: date,
            time: time,
            to_time: toTime,
            manual_time: manualTime,
            status: masterSchedule[targetCompId]?.status || 'draft'
        };

        const { error } = window.festosSaveSetting 
            ? await window.festosSaveSetting('master_schedule', masterSchedule) 
            : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (error) throw error;

        showToast("Schedule Saved Successfully!");
        closeModal();
        await detectScheduleConflicts();
        filterScheduleTable();
        if (window.schedCurrentViewMode === 'sheet') {
            initScheduleSheet();
        }
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('modalSaveBtn', false);
    }
}

async function toggleScheduleStatus(compId, newStatus) {
    if (!masterSchedule[compId]) return;
    masterSchedule[compId].status = newStatus;
    try {
        const { error } = window.festosSaveSetting ? await window.festosSaveSetting('master_schedule', masterSchedule) : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (error) throw error;
        showToast(`Schedule ${newStatus}!`);
        filterScheduleTable();
        if (window.schedCurrentViewMode === 'sheet') {
            initScheduleSheet();
        }
    } catch(e) { showToast(e.message, 'error'); }
}

// ==========================================
// EVENT SCHEDULE SPREADSHEET SHEET VIEW (DESKTOP)
// ==========================================
window.schedCurrentViewMode = 'table';
window.schedSheetData = {};
window.schedSheetDirtyIds = new Set();

function switchScheduleView(mode) {
    if (mode === window.schedCurrentViewMode) return;

    if (mode === 'table' && window.schedSheetDirtyIds && window.schedSheetDirtyIds.size > 0) {
        openConfirmModal(
            'Unsaved Sheet Changes',
            `You have <strong>${window.schedSheetDirtyIds.size} unsaved change(s)</strong> in Schedule Sheet View.<br>Switching to Table View will discard these unsaved edits.<br><br>Do you want to discard them and continue?`,
            () => {
                window.schedSheetDirtyIds.clear();
                executeSwitchScheduleView(mode);
            },
            {
                confirmText: 'Discard & Switch',
                cancelText: 'Stay in Sheet',
                confirmBtnClass: 'btn-warning',
                icon: 'fa-solid fa-arrow-right-from-bracket',
                iconColor: '#D97706',
                iconBg: '#FEF3C7'
            }
        );
        return;
    }

    executeSwitchScheduleView(mode);
}

function executeSwitchScheduleView(mode) {
    window.schedCurrentViewMode = mode;
    const standardView = document.getElementById('sched-standard-view');
    const sheetView = document.getElementById('sched-sheet-view');
    const btnTable = document.getElementById('btnSchedViewTable');
    const btnSheet = document.getElementById('btnSchedViewSheet');

    if (mode === 'sheet') {
        if (standardView) standardView.style.display = 'none';
        if (sheetView) sheetView.style.display = 'block';

        if (btnSheet) {
            btnSheet.style.background = 'white';
            btnSheet.style.color = 'var(--text-main)';
            btnSheet.style.boxShadow = 'var(--shadow-sm)';
        }
        if (btnTable) {
            btnTable.style.background = 'transparent';
            btnTable.style.color = 'var(--text-muted)';
            btnTable.style.boxShadow = 'none';
        }

        initScheduleSheet();
    } else {
        if (sheetView) sheetView.style.display = 'none';
        if (standardView) standardView.style.display = 'block';

        if (btnTable) {
            btnTable.style.background = 'white';
            btnTable.style.color = 'var(--text-main)';
            btnTable.style.boxShadow = 'var(--shadow-sm)';
        }
        if (btnSheet) {
            btnSheet.style.background = 'transparent';
            btnSheet.style.color = 'var(--text-muted)';
            btnSheet.style.boxShadow = 'none';
        }

        filterScheduleTable();
    }
}
window.switchScheduleView = switchScheduleView;

function initScheduleSheet() {
    // Populate Date Filter
    const dateFilter = document.getElementById('schedSheetDateFilter');
    const allDates = Array.from(new Set(Object.values(masterSchedule || {}).map(s => s.date).filter(Boolean))).sort();
    if (dateFilter) {
        dateFilter.innerHTML = '<option value="">All Dates</option>' + allDates.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    // Populate Category Filter
    const catFilter = document.getElementById('schedSheetCatFilter');
    if (catFilter) {
        catFilter.innerHTML = '<option value="">All Categories</option>' + (categoriesList || []).map(c => `<option value="${c.id}">${escapeSheetHtml(c.name)}</option>`).join('');
    }

    // Populate Stage Filter
    const stageFilter = document.getElementById('schedSheetStageFilter');
    if (stageFilter) {
        stageFilter.innerHTML = '<option value="">All Stages</option>' 
            + '<option value="offstage">📝 Offstage</option>'
            + (stagesList || []).map(s => `<option value="${s.id}">🎭 ${escapeSheetHtml(s.name)}</option>`).join('');
    }

    window.schedSheetData = {};
    window.schedSheetDirtyIds = new Set();

    Object.keys(masterSchedule || {}).forEach(compId => {
        const comp = (competitionsList || []).find(c => String(c.id) === String(compId));
        if (!comp) return;

        const sched = masterSchedule[compId] || {};
        window.schedSheetData[compId] = {
            compId: compId,
            compName: comp.name || '',
            category_id: comp.category_id || '',
            categoryName: comp.categories?.name || '',
            stage_id: comp.stage_id || '',
            is_offstage: !!comp.is_offstage,
            date: sched.date || '',
            time: sched.time || '',
            to_time: sched.to_time || '',
            manual_time: sched.manual_time || '',
            status: sched.status || 'draft',
            compStatus: comp.status || 'pending'
        };
    });

    updateSchedSheetToolbarStatus();
    renderScheduleSheet();
}
window.initScheduleSheet = initScheduleSheet;

function renderScheduleSheet() {
    const tbody = document.getElementById('schedSheetTbody');
    if (!tbody) return;

    const searchInput = document.getElementById('schedSheetSearchInput')?.value?.toLowerCase()?.trim() || '';
    const dateFilter = document.getElementById('schedSheetDateFilter')?.value || '';
    const catFilter = document.getElementById('schedSheetCatFilter')?.value || '';
    const stageFilter = document.getElementById('schedSheetStageFilter')?.value || '';

    let rows = Object.values(window.schedSheetData || {});

    // Live stat totals calculation across all items
    const totalSched = rows.length;
    const pubSched = rows.filter(r => r.status === 'published').length;
    const draftSched = rows.filter(r => r.status === 'draft').length;
    const clashesCount = Object.keys(scheduleConflictsReport?.compConflictMap || {}).length;

    const statTotalEl = document.getElementById('schedStatTotal');
    const statPubEl = document.getElementById('schedStatPublished');
    const statDraftEl = document.getElementById('schedStatDraft');
    const statClashesEl = document.getElementById('schedStatClashes');
    if (statTotalEl) statTotalEl.innerText = `${totalSched} Total`;
    if (statPubEl) statPubEl.innerText = `🟢 ${pubSched} Published`;
    if (statDraftEl) statDraftEl.innerText = `📝 ${draftSched} Draft`;
    if (statClashesEl) {
        if (clashesCount > 0) {
            statClashesEl.style.display = 'inline-block';
            statClashesEl.innerText = `⚠️ ${clashesCount} Clashes`;
        } else {
            statClashesEl.style.display = 'none';
        }
    }

    // Filter rows
    if (searchInput) {
        rows = rows.filter(r => (r.compName || '').toLowerCase().includes(searchInput));
    }
    if (dateFilter) {
        rows = rows.filter(r => r.date === dateFilter);
    }
    if (catFilter) {
        rows = rows.filter(r => String(r.category_id) === String(catFilter));
    }
    if (stageFilter) {
        if (stageFilter === 'offstage') {
            rows = rows.filter(r => r.is_offstage);
        } else {
            rows = rows.filter(r => String(r.stage_id) === String(stageFilter) && !r.is_offstage);
        }
    }

    // Sort chronologically
    rows.sort((a, b) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.time || '').localeCompare(b.time || '');
    });

    const rowCountEl = document.getElementById('schedSheetRowCount');
    if (rowCountEl) rowCountEl.innerText = rows.length;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-calendar-xmark" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; opacity: 0.4;"></i>No scheduled events match the current filter.</td></tr>`;
        return;
    }

    const stageSelectOptions = `<option value="">-- No Stage / TBD --</option>`
        + (stagesList || []).map(s => {
            const isOff = s.is_offstage || (window.stageOffstageFlags && window.stageOffstageFlags[s.id]);
            const prefix = isOff ? '📝 ' : '🎭 ';
            const suffix = isOff ? ' [Offstage]' : '';
            return `<option value="${s.id}">${prefix}${escapeSheetHtml(s.name)}${suffix}</option>`;
        }).join('');

    let html = '';
    rows.forEach((item, idx) => {
        const isDirty = window.schedSheetDirtyIds.has(item.compId);
        const rowClass = isDirty ? 'row-dirty' : '';

        let statusBadge = `<span style="color:#94A3B8; font-size:0.8rem;" title="Synced"><i class="fa-solid fa-check"></i></span>`;
        if (isDirty) {
            statusBadge = `<span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; font-size:0.65rem; padding: 2px 6px;">EDITED</span>`;
        }

        let compStateStr = (item.compStatus || 'pending').toUpperCase().replace('_', ' ');
        let compStateColor = '#64748B';
        if (item.compStatus === 'registration') compStateColor = '#1D4ED8';
        if (item.compStatus === 'ongoing') compStateColor = '#059669';
        if (item.compStatus === 'valuation') compStateColor = '#D97706';
        if (item.compStatus === 'judgement_complete') compStateColor = '#7E22CE';

        html += `
            <tr id="sched-sheet-row-${item.compId}" class="${rowClass}">
                <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-size: 0.72rem;">${idx + 1}</td>
                <td id="sched-sheet-status-${item.compId}" style="text-align: center; padding: 0 2px !important;">${statusBadge}</td>
                <td style="font-weight: 700; color: var(--text-main); padding: 0.35rem 0.5rem !important; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${escapeSheetHtml(item.compName)}">
                    ${escapeSheetHtml(item.compName)}
                </td>
                <td style="padding: 0.35rem 0.5rem !important; color: var(--text-muted); font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${escapeSheetHtml(item.categoryName || 'General')}">
                    ${escapeSheetHtml(item.categoryName || 'General')}
                </td>
                <td>
                    <select class="sheet-cell-select" style="font-size: 0.78rem; padding: 0 4px !important;" onchange="markSchedSheetDirty('${item.compId}', 'stage_id', this.value)">
                        ${stageSelectOptions.replace(`value="${item.stage_id || ''}"`, `value="${item.stage_id || ''}" selected`)}
                    </select>
                </td>
                <td>
                    <input type="date" class="sheet-cell-input" style="text-transform: none; text-align: center; font-size: 0.78rem; padding: 0 2px !important;" value="${item.date}" onchange="markSchedSheetDirty('${item.compId}', 'date', this.value)">
                </td>
                <td>
                    <input type="time" class="sheet-cell-input" style="text-transform: none; text-align: center; font-size: 0.78rem; padding: 0 2px !important;" value="${item.time}" onchange="markSchedSheetDirty('${item.compId}', 'time', this.value)">
                </td>
                <td>
                    <input type="time" class="sheet-cell-input" style="text-transform: none; text-align: center; font-size: 0.78rem; padding: 0 2px !important;" value="${item.to_time}" onchange="markSchedSheetDirty('${item.compId}', 'to_time', this.value)">
                </td>
                <td>
                    <input type="number" class="sheet-cell-input" style="text-align: center; font-size: 0.78rem; padding: 0 2px !important;" value="${item.manual_time || ''}" placeholder="Auto" min="0" max="600" oninput="markSchedSheetDirty('${item.compId}', 'manual_time', this.value)">
                </td>
                <td>
                    <select class="sheet-cell-select" style="font-size: 0.78rem; padding: 0 4px !important;" onchange="markSchedSheetDirty('${item.compId}', 'status', this.value)">
                        <option value="published" ${item.status === 'published' ? 'selected' : ''}>🟢 Published</option>
                        <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>📝 Draft</option>
                    </select>
                </td>
                <td style="text-align: center; font-size: 0.7rem; font-weight: 800; color: ${compStateColor}; white-space: nowrap; padding: 0 4px !important;">
                    ${compStateStr}
                </td>
                <td style="text-align: center; padding: 0 2px !important;">
                    <button type="button" class="btn btn-outline" style="padding: 0.25rem 0.45rem; color: #DC2626; border-color: transparent; font-size: 0.8rem; border-radius: 6px;" onclick="deleteSchedSheetRow('${item.compId}')" title="Delete schedule">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}
window.renderScheduleSheet = renderScheduleSheet;
window.filterSchedSheetTable = renderScheduleSheet;

function markSchedSheetDirty(compId, field, value) {
    if (!window.schedSheetData[compId]) return;
    window.schedSheetData[compId][field] = value;
    window.schedSheetDirtyIds.add(compId);

    const row = document.getElementById(`sched-sheet-row-${compId}`);
    const statusCell = document.getElementById(`sched-sheet-status-${compId}`);
    if (row) {
        row.className = 'row-dirty';
        if (statusCell) statusCell.innerHTML = `<span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; font-size:0.65rem; padding: 2px 6px;">EDITED</span>`;
    }

    updateSchedSheetToolbarStatus();
}
window.markSchedSheetDirty = markSchedSheetDirty;

function updateSchedSheetToolbarStatus() {
    const dirtyCount = window.schedSheetDirtyIds ? window.schedSheetDirtyIds.size : 0;
    const saveBtn = document.getElementById('btnSchedSheetSave');
    const discardBtn = document.getElementById('btnSchedSheetDiscard');
    const badge = document.getElementById('schedSaveStatusBadge');
    const dirtyCountSpan = document.getElementById('schedDirtyCount');

    if (dirtyCountSpan) dirtyCountSpan.innerText = dirtyCount;

    if (dirtyCount > 0) {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.add('btn-sheet-save-active');
            saveBtn.style.background = '#059669';
            saveBtn.style.borderColor = '#047857';
        }
        if (discardBtn) discardBtn.style.display = 'inline-flex';
        if (badge) {
            badge.style.background = '#FEF3C7';
            badge.style.color = '#D97706';
            badge.style.borderColor = '#FDE68A';
            badge.innerHTML = `<i class="fa-solid fa-pen"></i> ${dirtyCount} Unsaved Change(s)`;
        }
    } else {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.remove('btn-sheet-save-active');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';
        }
        if (discardBtn) discardBtn.style.display = 'none';
        if (badge) {
            badge.style.background = '#ECFDF5';
            badge.style.color = '#059669';
            badge.style.borderColor = '#A7F3D0';
            badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> All Saved`;
        }
    }
}

function discardSchedSheetChanges() {
    if (!window.schedSheetDirtyIds || window.schedSheetDirtyIds.size === 0) {
        return showToast('No changes to discard.', 'info');
    }
    openConfirmModal(
        'Discard Unsaved Edits?',
        `Are you sure you want to discard all <strong>${window.schedSheetDirtyIds.size} unsaved schedule edit(s)</strong>?<br><br>The sheet will be reset back to the saved state.`,
        () => {
            window.schedSheetDirtyIds.clear();
            initScheduleSheet();
            showToast('All unsaved changes in schedule sheet discarded.', 'info');
        },
        {
            confirmText: 'Discard All',
            cancelText: 'Keep Editing',
            confirmBtnClass: 'btn-warning',
            icon: 'fa-solid fa-rotate-left',
            iconColor: '#D97706',
            iconBg: '#FEF3C7'
        }
    );
}
window.discardSchedSheetChanges = discardSchedSheetChanges;

async function saveSchedSheetChanges() {
    if (!window.schedSheetDirtyIds || window.schedSheetDirtyIds.size === 0) {
        return showToast('No changes to save.', 'info');
    }

    const dirtyList = Array.from(window.schedSheetDirtyIds);
    const saveBtn = document.getElementById('btnSchedSheetSave');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const stageUpdates = [];
        dirtyList.forEach(compId => {
            const row = window.schedSheetData[compId];
            if (!row) return;

            masterSchedule[compId] = {
                date: row.date,
                time: row.time,
                to_time: row.to_time,
                manual_time: row.manual_time,
                status: row.status || 'draft'
            };

            // Stage updates
            const chosenStage = (stagesList || []).find(s => String(s.id) === String(row.stage_id));
            const isOffstage = chosenStage ? !!chosenStage.is_offstage : !!row.is_offstage;
            const stageId = row.stage_id || null;
            stageUpdates.push({
                id: compId,
                stage_id: stageId,
                is_offstage: isOffstage
            });

            // Update in-memory competitionsList immediately
            const comp = (competitionsList || []).find(c => String(c.id) === String(compId));
            if (comp) {
                comp.stage_id = stageId;
                comp.is_offstage = isOffstage;
                if (stageId) {
                    const stg = (stagesList || []).find(s => String(s.id) === String(stageId));
                    comp.stages = stg ? { name: stg.name } : null;
                } else {
                    comp.stages = null;
                }
            }
        });

        // 1. Save master schedule
        const { error: schedError } = window.festosSaveSetting 
            ? await window.festosSaveSetting('master_schedule', masterSchedule) 
            : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (schedError) throw schedError;

        // 2. Save stage updates to database
        if (stageUpdates.length > 0) {
            for (const update of stageUpdates) {
                await supabaseClient.from('competitions').update({
                    stage_id: update.stage_id,
                    is_offstage: update.is_offstage
                }).eq('id', update.id);
            }
        }

        // 3. Instant Optimistic UI feedback
        dirtyList.forEach(compId => {
            const rowEl = document.getElementById(`sched-sheet-row-${compId}`);
            const statusCell = document.getElementById(`sched-sheet-status-${compId}`);
            if (rowEl) rowEl.className = '';
            if (statusCell) statusCell.innerHTML = `<span style="color:#059669; font-size:0.85rem;"><i class="fa-solid fa-check"></i></span>`;
        });

        window.schedSheetDirtyIds.clear();
        updateSchedSheetToolbarStatus();

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            saveBtn.style.background = '#059669';
            saveBtn.style.borderColor = '#047857';
        }

        showToast(`Saved ${dirtyList.length} scheduled event(s) successfully!`, 'success');

        // Background non-blocking sync
        detectScheduleConflicts().catch(console.warn);
        loadCompetitions().catch(console.warn);

        setTimeout(() => {
            if (saveBtn && (!window.schedSheetDirtyIds || window.schedSheetDirtyIds.size === 0)) {
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes (<span id="schedDirtyCount">0</span>)';
                updateSchedSheetToolbarStatus();
            }
        }, 1500);

    } catch (e) {
        console.error(e);
        showToast('Save failed: ' + e.message, 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            updateSchedSheetToolbarStatus();
        }
    }
}
window.saveSchedSheetChanges = saveSchedSheetChanges;

async function deleteSchedSheetRow(compId) {
    const row = window.schedSheetData[compId];
    const compName = row ? row.compName : 'this event';

    openConfirmModal(
        'Remove Event Schedule?',
        `Are you sure you want to remove the schedule for <strong>"${escapeSheetHtml(compName)}"</strong>?<br><br>The event will return to unscheduled status.`,
        async () => {
            try {
                showToast(`Removing schedule for "${compName}"...`, 'info');
                delete masterSchedule[compId];
                const { error } = window.festosSaveSetting 
                    ? await window.festosSaveSetting('master_schedule', masterSchedule) 
                    : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
                if (error) throw error;

                delete window.schedSheetData[compId];
                if (window.schedSheetDirtyIds) window.schedSheetDirtyIds.delete(compId);

                const rowEl = document.getElementById(`sched-sheet-row-${compId}`);
                if (rowEl) rowEl.remove();

                updateSchedSheetToolbarStatus();
                renderScheduleSheet();
                showToast(`Schedule removed for "${compName}".`, 'success');

                detectScheduleConflicts().catch(console.warn);
            } catch (e) {
                showToast('Failed to delete schedule: ' + e.message, 'error');
            }
        },
        {
            confirmText: 'Yes, Remove',
            cancelText: 'Cancel',
            confirmBtnClass: 'btn-danger',
            icon: 'fa-solid fa-calendar-xmark',
            iconColor: '#DC2626',
            iconBg: '#FEE2E2'
        }
    );
}
window.deleteSchedSheetRow = deleteSchedSheetRow;



async function exportSchedulePDF() {
    showToast('Generating Schedule PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Master Event Schedule');

        // 1. Get current filter values
        const search = document.getElementById('searchSchedInput')?.value?.toLowerCase() || '';
        const dateVal = document.getElementById('filterSchedDate')?.value || '';
        const catId = document.getElementById('filterSchedCat')?.value || '';
        const stageId = document.getElementById('filterSchedStage')?.value || ''; 
        const statusVal = document.getElementById('filterSchedStatus')?.value || '';
        const compStatusVal = document.getElementById('filterSchedCompStatus') ? document.getElementById('filterSchedCompStatus').value : ""; 

        // 2. Map items and apply filters
        let scheduledItems = Object.keys(masterSchedule).map(compId => {
            const comp = competitionsList.find(c => c.id == compId);
            return { compId, comp, sched: masterSchedule[compId] };
        }).filter(item => {
            if (!item.comp) return false;

            const compCatId = item.comp.category_id;
            const compStageId = item.comp.stage_id; 

            const matchSearch = item.comp.name.toLowerCase().includes(search);
            const matchDate = dateVal === "" || item.sched.date === dateVal;
            const matchCat = catId === "" || compCatId == catId;
            const matchStage = stageId === "" || (stageId === 'offstage' ? item.comp.is_offstage : compStageId == stageId); 
            const matchStatus = statusVal === "" || item.sched.status === statusVal;
            const matchCompStatus = compStatusVal === "" || item.comp.status === compStatusVal; 

            return matchSearch && matchDate && matchCat && matchStage && matchStatus && matchCompStatus;
        });
        
        // 3. Sort chronologically
        scheduledItems.sort((a,b) => {
            if (a.sched.date !== b.sched.date) return (a.sched.date || '').localeCompare(b.sched.date || '');
            return (a.sched.time || '').localeCompare(b.sched.time || '');
        });

        // 4. Generate Rows
        let tableRows = scheduledItems.map((item) => {
            let compStageName = 'TBD';
            if (item.comp.is_offstage) {
                compStageName = 'Offstage';
            } else if (item.comp.stages?.name) {
                compStageName = item.comp.stages.name;
            } else if (item.comp.stage_id) {
                const stg = (stagesList || []).find(s => String(s.id) === String(item.comp.stage_id));
                compStageName = stg ? stg.name : `Stage #${item.comp.stage_id}`;
            }

            return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.sched.date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${item.sched.time}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${item.sched.to_time || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${item.comp.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.comp.categories?.name || 'GEN'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${compStageName}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #4F46E5;">${item.comp.status.toUpperCase().replace('_', ' ')}</td>
            </tr>
            `;
        }).join('');

        if (scheduledItems.length === 0) {
            tableRows = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #64748B;">No scheduled events match your current filters.</td></tr>`;
        }

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">DATE</th>
                        <th style="padding: 10px;">FROM TIME</th>
                        <th style="padding: 10px;">TO TIME</th>
                        <th style="padding: 10px;">COMPETITION</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">STAGE</th>
                        <th style="padding: 10px;">EVENT STATUS</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: typeof getFestFileName === 'function' ? getFestFileName('Master_Schedule', 'pdf') : `Fest_Master_Schedule.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}

async function exportScheduleCSV() {
    // 1. Get current filter values
    const search = document.getElementById('searchSchedInput')?.value?.toLowerCase() || '';
    const dateVal = document.getElementById('filterSchedDate')?.value || '';
    const catId = document.getElementById('filterSchedCat')?.value || '';
    const stageId = document.getElementById('filterSchedStage')?.value || ''; 
    const statusVal = document.getElementById('filterSchedStatus')?.value || '';
    const compStatusVal = document.getElementById('filterSchedCompStatus') ? document.getElementById('filterSchedCompStatus').value : ""; 

    let dataToExport = [];
    
    // 2. Map and filter items
    Object.keys(masterSchedule).forEach(compId => {
        const comp = competitionsList.find(c => c.id == compId);
        if(comp) {
            const sched = masterSchedule[compId];
            const compCatId = comp.category_id;
            const compStageId = comp.stage_id; 

            let compStageName = 'TBD';
            if (comp.is_offstage) {
                compStageName = 'Offstage';
            } else if (comp.stages?.name) {
                compStageName = comp.stages.name;
            } else if (comp.stage_id) {
                const stg = (stagesList || []).find(s => String(s.id) === String(comp.stage_id));
                compStageName = stg ? stg.name : `Stage #${comp.stage_id}`;
            }

            const matchSearch = comp.name.toLowerCase().includes(search);
            const matchDate = dateVal === "" || sched.date === dateVal;
            const matchCat = catId === "" || compCatId == catId;
            const matchStage = stageId === "" || (stageId === 'offstage' ? comp.is_offstage : compStageId == stageId); 
            const matchStatus = statusVal === "" || sched.status === statusVal;
            const matchCompStatus = compStatusVal === "" || comp.status === compStatusVal; 

            if (matchSearch && matchDate && matchCat && matchStage && matchStatus && matchCompStatus) {
                dataToExport.push({
                    "DATE": sched.date,
                    "TIME (FROM)": sched.time,
                    "TIME (TO)": sched.to_time || '-',
                    "COMPETITION": comp.name,
                    "CATEGORY": comp.categories?.name || 'General',
                    "STAGE": compStageName,
                    "STATUS": sched.status.toUpperCase()
                });
            }
        }
    });
    
    if (dataToExport.length === 0) return showToast("No scheduled events match your filters.", "error");

    dataToExport.sort((a,b) => {
        if (a.DATE !== b.DATE) return (a.DATE || '').localeCompare(b.DATE || '');
        return (a["TIME (FROM)"] || '').localeCompare(b["TIME (FROM)"] || '');
    });

    const csvFileName = typeof getFestFileName === 'function' ? getFestFileName('Master_Schedule', 'csv') : 'Fest_Schedule.csv';
    const blob = new Blob([Papa.unparse(dataToExport)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", csvFileName);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==========================================
// BULK EVENT SCHEDULER & CSV TEMPLATE ENGINE
// ==========================================

function downloadScheduleTemplate() {
    const headers = ['competition_name', 'category', 'date', 'from_time', 'to_time', 'stage_name', 'status'];
    let sampleRows = [];
    
    // Populate with real competition names and categories from this festival if available
    if (Array.isArray(competitionsList) && competitionsList.length > 0) {
        competitionsList.slice(0, 15).forEach((c, idx) => {
            const catName = c.categories?.name || (categoriesList.find(cat => String(cat.id) === String(c.category_id))?.name) || 'General';
            const stageName = c.stages?.name || (stagesList && stagesList[0] ? stagesList[0].name : 'Main Stage');
            const h = 9 + Math.floor(idx * 0.75);
            const m = (idx % 2 === 0) ? '00' : '30';
            const hEnd = h + 1;
            const fromT = `${String(h).padStart(2, '0')}:${m}`;
            const toT = `${String(hEnd).padStart(2, '0')}:${m}`;
            sampleRows.push([c.name, catName.trim(), '2026-11-15', fromT, toT, c.is_offstage ? 'Offstage' : stageName, 'published']);
        });
    } else {
        sampleRows = [
            ['SEMINAR', 'General', '2026-11-15', '09:30', '11:00', 'Stage 1', 'published'],
            ['QURAN RECITATION', 'PRIMARY', '2026-11-15', '11:15', '13:00', 'Stage 1', 'published'],
            ['ESSAY WRITING', 'SECONDARY', '2026-11-15', '14:00', '15:30', 'Offstage', 'published']
        ];
    }
    
    const csvContent = [headers.join(',')].concat(
        sampleRows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    ).join('\r\n');
    
    const templateFileName = typeof getFestFileName === 'function' ? getFestFileName('Schedule_Template', 'csv') : 'fest_schedule_template.csv';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", templateFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Schedule CSV template downloaded successfully!');
}
window.downloadScheduleTemplate = downloadScheduleTemplate;

// --- Schedule Bulk Upload Fuzzy Matching & Auto-Correction Engine ---
function normalizeStringForFuzzy(s) {
    if (!s) return '';
    return String(s)
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/['"`]/g, '') // remove quotes/apostrophes cleanly
        .replace(/[^a-z0-9\s]/g, ' ') // treat other punctuation as word separators
        .replace(/\s+/g, ' ')
        .trim();
}
window.normalizeStringForFuzzy = normalizeStringForFuzzy;

function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;
    
    const v0 = new Array(s2.length + 1);
    const v1 = new Array(s2.length + 1);
    
    for (let i = 0; i <= s2.length; i++) v0[i] = i;
    
    for (let i = 0; i < s1.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < s2.length; j++) {
            const cost = (s1[i] === s2[j]) ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
    }
    return v1[s2.length];
}
window.levenshteinDistance = levenshteinDistance;

function extractSuffixTokens(str) {
    const m = str.match(/\b([a-z]|\d+)\b$/i) || str.match(/\(([a-z]|\d+)\)/i);
    return m ? m[1].toLowerCase() : null;
}

function calculateSimilarity(str1, str2) {
    const s1 = normalizeStringForFuzzy(str1);
    const s2 = normalizeStringForFuzzy(str2);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    
    // Distinct variants like (A) and (B), or 1 vs 2 must not cross-match
    const suf1 = extractSuffixTokens(str1);
    const suf2 = extractSuffixTokens(str2);
    if (suf1 && suf2 && suf1 !== suf2) {
        return 0;
    }

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    const dist = levenshteinDistance(s1, s2);
    const levScore = (maxLen - dist) / maxLen;

    const minLen = Math.min(s1.length, s2.length);
    let subScore = 0;
    if ((s1.includes(s2) || s2.includes(s1)) && minLen >= 4 && (minLen / maxLen >= 0.55)) {
        subScore = minLen / maxLen;
    }
    
    // Word-level matching
    const words1 = s1.split(' ').filter(w => w.length > 1);
    const words2 = s2.split(' ').filter(w => w.length > 1);
    let wordFuzzyScore = 0;
    if (words1.length > 0 && words2.length > 0) {
        let totalWordScore = 0;
        const shorterWords = words1.length <= words2.length ? words1 : words2;
        const longerWords = words1.length <= words2.length ? words2 : words1;
        
        for (const w1 of shorterWords) {
            let bestWordMatch = 0;
            for (const w2 of longerWords) {
                const wDist = levenshteinDistance(w1, w2);
                const wMax = Math.max(w1.length, w2.length);
                const wScore = (wMax - wDist) / wMax;
                if (wScore > bestWordMatch) bestWordMatch = wScore;
            }
            totalWordScore += bestWordMatch;
        }
        wordFuzzyScore = (totalWordScore / shorterWords.length) * (shorterWords.length / longerWords.length >= 0.5 ? 0.9 : 0.6);
    }
    
    return Math.max(levScore, subScore, wordFuzzyScore);
}
window.calculateSimilarity = calculateSimilarity;

// CSV Header Extractor Helper - case-insensitive, space-insensitive, punctuation-insensitive
function getCsvFieldValue(row, possibleKeys) {
    if (!row || typeof row !== 'object') return '';
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
        const cleanKey = key.toLowerCase().replace(/[\s_\-\/\(\)\.]+/g, '');
        const matchedKey = rowKeys.find(k => {
            const cleanK = k.toLowerCase().replace(/[\s_\-\/\(\)\.]+/g, '');
            return cleanK === cleanKey;
        });
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
            const val = String(row[matchedKey]).trim();
            if (val !== '') return val;
        }
    }
    return '';
}
window.getCsvFieldValue = getCsvFieldValue;

// Stage matching helper (supports Stage 1 / stg 1 / Offstage / Auditorium typos)
function findBestStageMatch(rawStage, stages = []) {
    if (!rawStage) return null;
    const stagePool = (stages && stages.length > 0) ? stages : (stagesList || []);
    const norm = normalizeStringForFuzzy(String(rawStage).trim());
    if (!norm) return null;

    // Check offstage indications
    if (norm.includes('off') || norm.includes('ofstage') || norm.includes('offstage') || norm.includes('nonstage')) {
        return { is_offstage: true, stage_id: null, name: 'Offstage', score: 1.0, isCorrected: norm !== 'offstage' };
    }

    // Direct check by ID
    const stageById = stagePool.find(s => String(s.id) === String(rawStage).trim());
    if (stageById) {
        return {
            is_offstage: false,
            stage_id: stageById.id,
            name: stageById.name,
            stage_no: stageById.stage_no,
            score: 1.0,
            isCorrected: false
        };
    }

    // Check exact name match
    const exactNameMatch = stagePool.find(s => normalizeStringForFuzzy(s.name) === norm);
    if (exactNameMatch) {
        return {
            is_offstage: false,
            stage_id: exactNameMatch.id,
            name: exactNameMatch.name,
            stage_no: exactNameMatch.stage_no,
            score: 1.0,
            isCorrected: false
        };
    }

    // Check number in stage e.g. "Stage 1", "stg 2", "stage3", "1", "Stage #1"
    const digitMatch = String(rawStage).match(/\d+/);
    if (digitMatch) {
        const num = parseInt(digitMatch[0], 10);
        const stageByNum = stagePool.find(s => Number(s.stage_no) === num || normalizeStringForFuzzy(s.name).endsWith(String(num)) || normalizeStringForFuzzy(s.name) === `stage ${num}`);
        if (stageByNum) {
            const isExact = normalizeStringForFuzzy(stageByNum.name) === norm || `stage ${stageByNum.stage_no}` === norm;
            return {
                is_offstage: false,
                stage_id: stageByNum.id,
                name: stageByNum.name,
                stage_no: stageByNum.stage_no,
                score: 1.0,
                isCorrected: !isExact
            };
        }
    }

    // Fuzzy match against stages
    let best = null;
    let maxScore = 0;
    for (const s of stagePool) {
        const targetName = s.name || `Stage ${s.stage_no}`;
        const score = calculateSimilarity(rawStage, targetName);
        if (score > maxScore) {
            maxScore = score;
            best = s;
        }
    }

    if (best && maxScore >= 0.60) {
        const isExact = normalizeStringForFuzzy(best.name) === norm;
        return {
            is_offstage: false,
            stage_id: best.id,
            name: best.name,
            stage_no: best.stage_no,
            score: maxScore,
            isCorrected: !isExact
        };
    }

    return null;
}
window.findBestStageMatch = findBestStageMatch;

// Category matching helper (corrects Primery -> Primary, Secondery -> Secondary, etc.)
function findBestCategoryMatch(rawCat, categories = []) {
    if (!rawCat) return null;
    const norm = normalizeStringForFuzzy(rawCat);
    if (!norm) return null;

    const byId = categories.find(c => String(c.id).trim() === String(rawCat).trim());
    if (byId) return { category: byId, score: 1.0, isCorrected: false };

    let best = null;
    let maxScore = 0;
    for (const c of categories) {
        const catNorm = normalizeStringForFuzzy(c.name);
        if (catNorm === norm) {
            return { category: c, score: 1.0, isCorrected: false };
        }
        const score = calculateSimilarity(norm, catNorm);
        if (score > maxScore) {
            maxScore = score;
            best = c;
        }
    }

    if (best && maxScore >= 0.65) {
        return { category: best, score: maxScore, isCorrected: true };
    }
    return null;
}
window.findBestCategoryMatch = findBestCategoryMatch;

// Competition matching helper (resolves spelling mistakes in competition name & category)
function findBestCompetitionMatch(rawName, rawCat, competitions = [], categories = []) {
    if (!rawName) return null;
    const norm = normalizeStringForFuzzy(rawName);
    if (!norm) return null;

    let targetCatId = null;
    let catAutoCorrected = false;
    let matchedCatObj = null;
    if (rawCat) {
        const catMatch = findBestCategoryMatch(rawCat, categories);
        if (catMatch) {
            targetCatId = catMatch.category.id;
            catAutoCorrected = catMatch.isCorrected;
            matchedCatObj = catMatch.category;
        }
    }

    // 1. Try exact match
    const exactMatches = (competitions || []).filter(c => {
        const cNorm = normalizeStringForFuzzy(c.name);
        return (cNorm === norm || String(c.id).trim() === String(rawName).trim());
    });

    if (exactMatches.length === 1) {
        return {
            comp: exactMatches[0],
            score: 1.0,
            isCorrected: catAutoCorrected,
            correctedCat: catAutoCorrected ? matchedCatObj : null
        };
    } else if (exactMatches.length > 1) {
        if (targetCatId) {
            const catComp = exactMatches.find(c => String(c.category_id) === String(targetCatId));
            if (catComp) {
                return {
                    comp: catComp,
                    score: 1.0,
                    isCorrected: catAutoCorrected,
                    correctedCat: catAutoCorrected ? matchedCatObj : null
                };
            }
        }
        return {
            comp: exactMatches[0],
            score: 1.0,
            isCorrected: catAutoCorrected,
            correctedCat: catAutoCorrected ? matchedCatObj : null
        };
    }

    // 2. Fuzzy match
    let best = null;
    let maxAdjustedScore = 0;
    let bestRawScore = 0;

    for (const c of (competitions || [])) {
        const rawScore = calculateSimilarity(rawName, c.name);
        if (rawScore < 0.62) continue; // Baseline threshold to prevent false matches

        const sameCategory = targetCatId ? String(c.category_id) === String(targetCatId) : null;
        let adjustedScore = rawScore;
        if (targetCatId) {
            if (sameCategory) adjustedScore += 0.12;
            else adjustedScore -= 0.20;
        }

        if (adjustedScore > maxAdjustedScore) {
            maxAdjustedScore = adjustedScore;
            bestRawScore = rawScore;
            best = c;
        }
    }

    const minRequiredScore = targetCatId ? 0.64 : 0.68;
    if (best && maxAdjustedScore >= minRequiredScore && bestRawScore >= 0.62) {
        const isExactName = normalizeStringForFuzzy(best.name) === norm;
        return {
            comp: best,
            score: maxAdjustedScore,
            rawScore: bestRawScore,
            isCorrected: !isExactName || catAutoCorrected || (rawCat && targetCatId !== best.category_id),
            correctedCat: catAutoCorrected ? matchedCatObj : null
        };
    }

    return null;
}
window.findBestCompetitionMatch = findBestCompetitionMatch;

window.parsedBulkScheduleRows = [];

function previewBulkScheduleCSV(input) {
    const file = input.files?.[0];
    const previewContainer = document.getElementById('bulkSchedPreviewContainer');
    const summary = document.getElementById('bulkSchedSummary');
    const list = document.getElementById('bulkSchedPreviewList');
    
    if (!file) {
        if (previewContainer) previewContainer.style.display = 'none';
        window.parsedBulkScheduleRows = [];
        return;
    }
    
    if (typeof Papa === 'undefined') {
        return showToast('PapaParse CSV engine not loaded.', 'error');
    }
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            window.parsedBulkScheduleRows = results.data || [];
            if (window.parsedBulkScheduleRows.length === 0) {
                if (previewContainer) previewContainer.style.display = 'none';
                return showToast('No rows found in CSV file.', 'warning');
            }
            
            // Map rows and resolve matches with auto-correction
            let matched = 0;
            let missing = 0;
            let autoCorrectedCount = 0;
            let previewHtml = '';
            
            window.parsedBulkScheduleRows.forEach((row) => {
                const rawName = getCsvFieldValue(row, ['competition_name', 'competition', 'name', 'event', 'program', 'item', 'comp_name', 'comp']);
                const rawCat = getCsvFieldValue(row, ['category', 'category_name', 'cat', 'section', 'group']);
                const rawStage = getCsvFieldValue(row, ['stage', 'stage_name', 'stagename', 'stage/venue', 'stage / venue', 'venue', 'arena']);
                const rawDate = getCsvFieldValue(row, ['date', 'event_date', 'schedule_date', 'day']);
                const rawFrom = getCsvFieldValue(row, ['from_time', 'start_time', 'from', 'time', 'start', 'time_from', 'time (from)', 'time(from)']);
                const rawTo = getCsvFieldValue(row, ['to_time', 'end_time', 'to', 'end', 'time_to', 'time (to)', 'time(to)']);
                
                const compMatch = findBestCompetitionMatch(rawName, rawCat, competitionsList, categoriesList);
                const stageMatch = rawStage ? findBestStageMatch(rawStage, stagesList) : null;
                
                if (compMatch && compMatch.comp) {
                    matched++;
                    const matchedComp = compMatch.comp;
                    const cCatDisplay = matchedComp.categories?.name || (categoriesList.find(cat => String(cat.id) === String(matchedComp.category_id))?.name) || '';
                    
                    let corrections = [];
                    if (compMatch.isCorrected && compMatch.score < 1.0) {
                        corrections.push(`Comp: "${rawName}" ➔ "${matchedComp.name}"`);
                    }
                    if (rawCat && compMatch.correctedCat) {
                        corrections.push(`Cat: "${rawCat}" ➔ "${compMatch.correctedCat.name.trim()}"`);
                    }
                    if (stageMatch && stageMatch.isCorrected) {
                        corrections.push(`Stage: "${rawStage}" ➔ "${stageMatch.name}"`);
                    }
                    if (corrections.length > 0) autoCorrectedCount++;

                    const stageDisplay = stageMatch ? (stageMatch.is_offstage ? '📝 Offstage' : `🎭 ${stageMatch.name}`) : (rawStage || '');
                    
                    previewHtml += `
                        <div style="padding: 6px 0; border-bottom: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span style="font-weight: 700; color: var(--text-main);"><i class="fa-solid fa-check" style="color: #059669; margin-right: 5px;"></i> ${escapeSheetHtml(matchedComp.name)}</span>
                                    ${cCatDisplay ? `<span class="badge" style="background:#F1F5F9; color:#475569; font-size: 0.65rem; margin-left: 5px;">${escapeSheetHtml(cCatDisplay.trim())}</span>` : ''}
                                    ${corrections.length > 0 ? `<span class="badge" style="background:#EEF2FF; color:#4F46E5; font-size: 0.65rem; margin-left: 5px; font-weight:700;"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-corrected</span>` : ''}
                                </div>
                                <span style="color: var(--text-muted); font-size: 0.75rem;">${rawDate} ${rawFrom}${rawTo ? ' - ' + rawTo : ''} ${stageDisplay ? '(' + escapeSheetHtml(stageDisplay) + ')' : ''}</span>
                            </div>
                            ${corrections.length > 0 ? `<div style="font-size: 0.7rem; color: #4F46E5; margin-left: 18px; margin-top: 2px;">✨ ${corrections.join(' &bull; ')}</div>` : ''}
                        </div>
                    `;
                } else {
                    missing++;
                    previewHtml += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); color: #DC2626;">
                            <span><i class="fa-solid fa-triangle-exclamation" style="margin-right: 5px;"></i> "${escapeSheetHtml(rawName)}" ${rawCat ? `(${escapeSheetHtml(rawCat)})` : ''} (Not found)</span>
                            <span style="font-size: 0.75rem;">Skipped</span>
                        </div>
                    `;
                }
            });
            
            if (summary) {
                summary.innerHTML = `
                    <span style="color: #059669; font-weight: 800;">${matched} competitions matched</span>${autoCorrectedCount > 0 ? ` <span style="color: #4F46E5; font-weight: 700;">(${autoCorrectedCount} auto-corrected ✨)</span>` : ''}, 
                    <span style="color: ${missing > 0 ? '#DC2626' : 'var(--text-muted)'}; font-weight: 700;">${missing} not found</span>
                `;
            }
            if (list) list.innerHTML = previewHtml;
            if (previewContainer) previewContainer.style.display = 'block';
        },
        error: function(err) {
            showToast('CSV parse error: ' + err.message, 'error');
        }
    });
}
window.previewBulkScheduleCSV = previewBulkScheduleCSV;

async function openBulkScheduleModal() {
    window.parsedBulkScheduleRows = [];
    
    // Ensure prerequisites are loaded before modal opens
    const preLoads = [];
    if (!competitionsList || competitionsList.length === 0) preLoads.push(loadCompetitions());
    if (!stagesList || stagesList.length === 0) preLoads.push(loadStagesAndTeams());
    if (!categoriesList || categoriesList.length === 0) preLoads.push(loadCategories());
    if (preLoads.length > 0) {
        await Promise.all(preLoads);
    }
    
    openModal('Bulk Upload Event Schedule (CSV)', `
        <div style="margin-bottom: 1.25rem; padding: 1rem; background: var(--primary-light); border-radius: var(--radius-md); color: var(--primary); font-size: 0.85rem; line-height: 1.5;">
            <div style="font-weight: 800; margin-bottom: 0.25rem; font-size: 0.95rem;">
                <i class="fa-solid fa-file-csv"></i> Bulk Event Scheduling via CSV
            </div>
            Upload a spreadsheet with event dates, start times, stages, and categories to schedule all competitions at once. Spelling mistakes in names, categories, and stages are automatically corrected.
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="font-weight: 700; margin: 0;">Select Schedule CSV File</label>
                <button type="button" class="btn btn-outline" onclick="downloadScheduleTemplate()" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);">
                    <i class="fa-solid fa-download"></i> Download Template CSV
                </button>
            </div>
            <input type="file" id="bulkSchedCsvFile" accept=".csv" style="width: 100%; padding: 0.75rem; border: 2px dashed var(--border); border-radius: var(--radius-md); background: var(--bg-surface); cursor: pointer;" onchange="previewBulkScheduleCSV(this)">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin: 0;">
                <label style="font-weight: 700;">Default Schedule Status</label>
                <select id="bulkSchedDefaultStatus" style="width: 100%; padding: 0.65rem 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-surface);">
                    <option value="published" selected>Published (Visible to all)</option>
                    <option value="draft">Draft (Admin only)</option>
                </select>
            </div>
            <div class="form-group" style="margin: 0; display: flex; flex-direction: column; justify-content: flex-end;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; margin-bottom: 0.4rem;">
                    <input type="checkbox" id="bulkSchedUpdateStage" checked style="accent-color: var(--primary); width: 18px; height: 18px;">
                    Auto-update competition stage from CSV
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
                    <input type="checkbox" id="bulkSchedOverwrite" checked style="accent-color: var(--primary); width: 18px; height: 18px;">
                    Overwrite existing event schedules
                </label>
            </div>
        </div>

        <div id="bulkSchedPreviewContainer" style="display: none; margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <div id="bulkSchedSummary" style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;"></div>
            <div id="bulkSchedPreviewList" style="max-height: 180px; overflow-y: auto; background: var(--bg-main); border-radius: var(--radius-md); padding: 0.5rem; font-size: 0.8rem; border: 1px solid var(--border);"></div>
        </div>
    `, async () => {
        await handleBulkScheduleUpload();
    });
}
window.openBulkScheduleModal = openBulkScheduleModal;

async function handleBulkScheduleUpload() {
    const fileInput = document.getElementById('bulkSchedCsvFile');
    if (!fileInput || !fileInput.files.length) {
        return showToast('Please select a CSV file first.', 'error');
    }
    
    const rows = window.parsedBulkScheduleRows || [];
    if (rows.length === 0) {
        return showToast('No data to schedule in CSV file.', 'error');
    }
    
    const defaultStatus = document.getElementById('bulkSchedDefaultStatus')?.value || 'published';
    const autoUpdateStage = document.getElementById('bulkSchedUpdateStage')?.checked ?? true;
    const overwrite = document.getElementById('bulkSchedOverwrite')?.checked ?? true;
    
    setLoading('modalSaveBtn', true);
    
    try {
        let scheduledCount = 0;
        let autoCorrectedCount = 0;
        let stageUpdates = [];
        
        rows.forEach(row => {
            const rawName = getCsvFieldValue(row, ['competition_name', 'competition', 'name', 'event', 'program', 'item', 'comp_name', 'comp']);
            const rawCat = getCsvFieldValue(row, ['category', 'category_name', 'cat', 'section', 'group']);
            const rawStage = getCsvFieldValue(row, ['stage', 'stage_name', 'stagename', 'stage/venue', 'stage / venue', 'venue', 'arena']);
            
            const compMatch = findBestCompetitionMatch(rawName, rawCat, competitionsList, categoriesList);
            if (!compMatch || !compMatch.comp) return;
            
            const matchedComp = compMatch.comp;
            if (compMatch.isCorrected) autoCorrectedCount++;
            
            const rawDate = getCsvFieldValue(row, ['date', 'event_date', 'schedule_date', 'day']);
            const rawFrom = getCsvFieldValue(row, ['from_time', 'start_time', 'from', 'time', 'start', 'time_from', 'time (from)', 'time(from)']);
            let rawTo = getCsvFieldValue(row, ['to_time', 'end_time', 'to', 'end', 'time_to', 'time (to)', 'time(to)']);
            if (rawTo === '-') rawTo = '';
            
            if (!rawDate || !rawFrom) return;
            
            // Check if already scheduled and overwrite disabled
            if (masterSchedule[matchedComp.id] && !overwrite) return;
            
            const rawStatus = getCsvFieldValue(row, ['status', 'publish_status', 'published', 'state']) || defaultStatus;
            const status = (rawStatus.toLowerCase() === 'draft') ? 'draft' : 'published';
            
            // Auto-calculate to_time if omitted
            if (!rawTo && matchedComp.time_per_student) {
                const fromMins = timeStringToMinutes(rawFrom);
                const estMins = matchedComp.time_per_student * (matchedComp.max_participants || 1);
                rawTo = minutesToTimeString(fromMins + (estMins > 0 ? estMins : 30));
            }
            
            masterSchedule[matchedComp.id] = {
                date: rawDate,
                time: rawFrom,
                to_time: rawTo,
                manual_time: getCsvFieldValue(row, ['manual_time', 'manual_mins', 'duration', 'minutes']),
                status: status
            };
            scheduledCount++;
            
            // Stage update check with auto-correction
            if (autoUpdateStage && rawStage) {
                const stageMatch = findBestStageMatch(rawStage, stagesList);
                if (stageMatch) {
                    if (stageMatch.isCorrected) autoCorrectedCount++;
                    if (stageMatch.is_offstage) {
                        stageUpdates.push({ id: matchedComp.id, stage_id: null, is_offstage: true, name: 'Offstage' });
                    } else if (stageMatch.stage_id) {
                        stageUpdates.push({ id: matchedComp.id, stage_id: stageMatch.stage_id, is_offstage: false, name: stageMatch.name });
                    }
                }
            }
        });
        
        if (scheduledCount === 0) {
            throw new Error('No valid competitions could be scheduled. Please ensure competition names match your festival events.');
        }
        
        // 1. Persist master schedule
        const { error: schedError } = window.festosSaveSetting 
            ? await window.festosSaveSetting('master_schedule', masterSchedule) 
            : await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (schedError) throw schedError;
        
        // 2. Perform bulk stage updates and immediately update in-memory cache
        if (stageUpdates.length > 0) {
            for (const update of stageUpdates) {
                await supabaseClient.from('competitions').update({
                    stage_id: update.stage_id,
                    is_offstage: update.is_offstage
                }).eq('id', update.id);

                // Update local memory cache immediately so schedule table never shows TBD!
                const comp = (competitionsList || []).find(c => String(c.id) === String(update.id));
                if (comp) {
                    comp.stage_id = update.stage_id;
                    comp.is_offstage = update.is_offstage;
                    if (update.stage_id) {
                        const stg = (stagesList || []).find(s => String(s.id) === String(update.stage_id));
                        comp.stages = stg ? { name: stg.name } : { name: update.name };
                    } else {
                        comp.stages = null;
                    }
                }
            }
            loadCompetitions().catch(console.warn);
        }
        
        showToast(`Successfully scheduled ${scheduledCount} event(s)!${autoCorrectedCount > 0 ? ` (${autoCorrectedCount} auto-corrected ✨)` : ''}`);
        closeModal();
        await detectScheduleConflicts();
        filterScheduleTable();
        if (window.schedCurrentViewMode === 'sheet') {
            initScheduleSheet();
        }
    } catch (e) {
        showToast('Bulk Schedule failed: ' + e.message, 'error');
    } finally {
        setLoading('modalSaveBtn', false);
    }
}
window.handleBulkScheduleUpload = handleBulkScheduleUpload;



// ============================================================================
// COMPETITION VACANCY & UNDER-ENROLLMENT ENGINE
// ============================================================================

let vacancyAuditData = [];

async function openVacancyReportModal() {
    showToast('Auditing competition enrollments...', 'success');
    try {
        // Ensure dependencies are loaded
        if (categoriesList.length === 0) await loadCategories();
        if (teamsList.length === 0) await loadStagesAndTeams();
        if (competitionsList.length === 0) await loadCompetitions();

        // Populate Category Filter dropdown
        const catFilter = document.getElementById('vacancyCategoryFilter');
        if (catFilter) {
            catFilter.innerHTML = '<option value="">All Categories</option>';
            categoriesList.forEach(c => catFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        }

        // Fetch all assignments with team information
        const { data: enrollments, error } = await supabaseClient
            .from('participant_competitions')
            .select('competition_id, participant_id, participants(id, team_id, teams(name))');

        if (error) throw error;

        // Group enrollments by competition and team
        const compEnrollmentMap = {};
        (enrollments || []).forEach(row => {
            const cId = row.competition_id;
            const tId = row.participants?.team_id || 'unassigned';
            const tName = row.participants?.teams?.name || 'INDEPENDENT';

            if (!compEnrollmentMap[cId]) compEnrollmentMap[cId] = { total: 0, byTeam: {} };
            compEnrollmentMap[cId].total++;
            compEnrollmentMap[cId].byTeam[tId] = (compEnrollmentMap[cId].byTeam[tId] || 0) + 1;
        });

        // Calculate vacancies for every competition
        vacancyAuditData = [];

        competitionsList.forEach(comp => {
            const maxPerTeam = comp.max_participants || 1;
            const totalCapacity = maxPerTeam * (teamsList.length || 0);
            const enrolledTotal = compEnrollmentMap[comp.id]?.total || 0;
            const teamCounts = compEnrollmentMap[comp.id]?.byTeam || {};

            const teamVacancies = [];

            teamsList.forEach(team => {
                const filled = teamCounts[team.id] || 0;
                const remaining = maxPerTeam - filled;

                if (remaining > 0) {
                    teamVacancies.push({
                        teamId: team.id,
                        teamName: team.name,
                        enrolled: filled,
                        max: maxPerTeam,
                        missing: remaining
                    });
                }
            });

            // If any team hasn't filled its quota, flag this competition
            if (teamVacancies.length > 0) {
                vacancyAuditData.push({
                    id: comp.id,
                    name: comp.name,
                    category_id: comp.category_id,
                    categoryName: comp.categories?.name || 'General',
                    maxPerTeam: maxPerTeam,
                    enrolledTotal: enrolledTotal,
                    totalCapacity: totalCapacity,
                    vacanciesCount: totalCapacity - enrolledTotal,
                    teamVacancies: teamVacancies
                });
            }
        });

        // Open modal & render table
        document.getElementById('vacancyModal').classList.add('show');
        renderVacancyTable();

    } catch (e) {
        showToast("Error generating vacancy audit: " + e.message, 'error');
    }
}

function renderVacancyTable() {
    const search = (document.getElementById('vacancySearchInput')?.value || '').toLowerCase();
    const catId = document.getElementById('vacancyCategoryFilter')?.value || '';
    const tbody = document.getElementById('vacancy-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = vacancyAuditData.filter(item => {
        const matchName = item.name.toLowerCase().includes(search);
        const matchCat = catId === '' || String(item.category_id) === String(catId);
        return matchName && matchCat;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color:var(--text-muted); font-weight:600;">No under-enrolled competitions found matching your criteria. All quotas are filled!</td></tr>`;
        document.getElementById('vacancy-summary-count').innerText = `0 competitions with vacancies.`;
        return;
    }

    filtered.forEach(item => {
        // Build team badges showing enrolled / max
        const teamBadges = item.teamVacancies.map(tv => `
            <span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; margin: 2px; display: inline-block; font-size: 0.75rem; padding: 4px 8px;">
                <strong>${tv.teamName}</strong>: ${tv.enrolled}/${tv.max} (${tv.missing} slot${tv.missing > 1 ? 's' : ''} left)
            </span>
        `).join('');

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${item.name}</td>
                <td><span class="badge badge-primary">${item.categoryName}</span></td>
                <td>
                    <span style="font-weight: 800; color: var(--danger); font-size: 0.95rem;">${item.enrolledTotal} / ${item.totalCapacity}</span>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Limit: ${item.maxPerTeam} per team</div>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 480px;">
                        ${teamBadges}
                    </div>
                </td>
                <td>
                    <button class="btn btn-outline" style="color: var(--success); border-color: var(--success); padding: 0.4rem 0.75rem;" onclick="routeToAdminAssignment('${item.category_id}', '${item.id}')">
                        <i class="fa-solid fa-user-plus"></i> Assign Now
                    </button>
                </td>
            </tr>
        `;
    });

    document.getElementById('vacancy-summary-count').innerText = `Showing ${filtered.length} competition(s) with available slots.`;
}

// Generate an A4 PDF Report of all vacancies grouped by Category
async function exportVacancyPDF() {
    if (vacancyAuditData.length === 0) return showToast('No vacancy data to export.', 'error');
    showToast('Generating Vacancy Audit PDF...', 'success');

    try {
        const catId = document.getElementById('vacancyCategoryFilter')?.value || '';
        const search = (document.getElementById('vacancySearchInput')?.value || '').toLowerCase();

        const filtered = vacancyAuditData.filter(item => {
            const matchName = item.name.toLowerCase().includes(search);
            const matchCat = catId === '' || String(item.category_id) === String(catId);
            return matchName && matchCat;
        });

        // Group filtered competitions by category
        const grouped = {};
        filtered.forEach(item => {
            if (!grouped[item.categoryName]) grouped[item.categoryName] = [];
            grouped[item.categoryName].push(item);
        });

        const container = document.createElement('div');
        container.style.padding = '35px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Under-Enrolled Competitions & Vacancy Audit');

        for (const catName in grouped) {
            const comps = grouped[catName];

            let tableRows = comps.map((item, idx) => {
                const teamsListStr = item.teamVacancies
                    .map(tv => `${tv.teamName} (${tv.enrolled}/${tv.max})`)
                    .join(', ');

                return `
                    <tr style="border-bottom: 1px solid #E2E8F0;">
                        <td style="padding: 9px 10px; font-size: 11px;">${idx + 1}</td>
                        <td style="padding: 9px 10px; font-size: 11px; font-weight: 700; color: #0F172A;">${item.name}</td>
                        <td style="padding: 9px 10px; font-size: 11px; text-align: center;">${item.maxPerTeam}</td>
                        <td style="padding: 9px 10px; font-size: 11px; font-weight: 800; color: #E11D48; text-align: center;">${item.enrolledTotal} / ${item.totalCapacity}</td>
                        <td style="padding: 9px 10px; font-size: 10px; color: #475569; line-height: 1.4;">${teamsListStr}</td>
                    </tr>
                `;
            }).join('');

            container.innerHTML += `
                <div style="margin-bottom: 25px; page-break-inside: avoid;">
                    <div style="background: #1E293B; color: white; padding: 8px 12px; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
                        <span>CATEGORY: ${catName.toUpperCase()}</span>
                        <span style="font-size: 10px; color: #94A3B8;">${comps.length} UNDER-ENROLLED EVENT(S)</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                        <thead>
                            <tr style="background: #F8FAFC; text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #E2E8F0;">
                                <th style="padding: 8px 10px; width: 30px;">#</th>
                                <th style="padding: 8px 10px; width: 220px;">COMPETITION</th>
                                <th style="padding: 8px 10px; text-align: center; width: 90px;">QUOTA/TEAM</th>
                                <th style="padding: 8px 10px; text-align: center; width: 90px;">ENROLLED</th>
                                <th style="padding: 8px 10px;">TEAMS WITH OPEN SLOTS (FILLED/MAX)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const opt = {
            margin: [10, 10, 10, 10],
            filename: typeof getFestFileName === 'function' ? getFestFileName('Vacancy_Audit', 'pdf') : `Fest_Vacancy_Audit_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(container).save().then(() => showToast('Vacancy PDF Exported!'));
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==========================================
// JUDGE MANAGEMENT ENGINE
// ==========================================
let globalJudgesList = [];

async function loadJudgesManagement() {
    try {
        const [
            { data: judges, error: judgesErr },
            { data: assignments, error: assignErr }
        ] = await Promise.all([
            festQuery(supabaseClient.from('users').select('id, username')).eq('role', 'judge').order('username'),
            festQuery(supabaseClient.from('judgements').select('judge_id, competition_id, competitions(name, categories(name), stages(name))'))
        ]);
        
        if (judgesErr) throw judgesErr;
        if (assignErr) throw assignErr;
        globalJudgesList = judges || [];

        // 3. Group and deduplicate assignments per judge 
        // (Since judgements might have multiple rows per comp if marks are saved)
        globalJudgesList.forEach(judge => {
            const judgeAssigns = assignments.filter(a => a.judge_id === judge.id);
            const uniqueCompsMap = new Map();
            
            judgeAssigns.forEach(a => {
                if (a.competitions && !uniqueCompsMap.has(a.competition_id)) {
                    uniqueCompsMap.set(a.competition_id, a.competitions);
                }
            });
            
            judge.assignments = Array.from(uniqueCompsMap.entries()).map(([id, comp]) => ({ id, ...comp }));
        });

        renderJudgesTable();
    } catch (error) {
        showToast("Error loading judges: " + error.message, 'error');
    }
}

function renderJudgesTable() {
    const tbody = document.getElementById('judges-tbody');
    const searchVal = (document.getElementById('searchJudgeInput')?.value || '').toLowerCase();
    tbody.innerHTML = '';

    const filtered = globalJudgesList.filter(j => j.username.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">No judges found matching your search.</td></tr>`;
        return;
    }

    filtered.forEach(judge => {
        const assignCount = judge.assignments.length;
        const countBadge = assignCount > 0 
            ? `<span class="badge badge-primary">${assignCount} Events</span>` 
            : `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border);">Unassigned</span>`;

        const safeData = JSON.stringify(judge).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700; font-size: 1.05rem;">
                    <i class="fa-solid fa-gavel" style="color: var(--primary); margin-right: 0.5rem;"></i> ${judge.username}
                </td>
                <td>${countBadge}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem; border-color: var(--primary); color: var(--primary);" onclick="viewJudgeDetails('${judge.id}')" ${assignCount === 0 ? 'disabled' : ''} title="View Schedule">
                            <i class="fa-solid fa-calendar-days"></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem; color: var(--danger); border-color: var(--danger);" onclick="exportSpecificJudgePDF('${judge.id}')" ${assignCount === 0 ? 'disabled' : ''} title="Download Schedule PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem;" onclick="openAssignJudgeEvents('${judge.id}')" title="Assign Events">
                            <i class="fa-solid fa-list-check"></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem;" onclick='openJudgeModal(${safeData})' title="Edit Judge">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-danger" style="padding: 0.4rem 0.75rem;" onclick="deleteJudge('${judge.id}', '${judge.username}')" title="Delete Judge">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}


// --- CRUD: CREATE & EDIT JUDGE ---
async function openJudgeModal(editData = null) {
    let uId = ''; let uFullName = ''; let uName = ''; let uPass = '';
    
    if (editData) {
        uId = editData.id;
        uName = editData.username;
        // Fetch existing name and password hash so we can pre-fill it
        const {data} = await supabaseClient.from('users').select('name, password_hash').eq('id', uId).single();
        if(data) {
            uFullName = data.name || '';
            uPass = data.password_hash;
        }
    }
    
    openModal(editData ? 'Edit Judge Profile' : 'Register New Judge', `
        <input type="hidden" id="editJudgeId" value="${uId}">
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="newJudgeFullName" value="${uFullName}" placeholder="e.g. John Doe" autocomplete="off">
        </div>
        <div class="form-group">
            <label>Judge Username</label>
            <input type="text" id="newJudgeName" value="${uName}" placeholder="e.g. stage1_judge" autocomplete="off">
        </div>
        <div class="form-group">
            <label>Login Password</label>
            <input type="text" id="newJudgePass" value="${uPass}" placeholder="Enter password" autocomplete="off" style="text-transform: none !important;">
        </div>
    `, async () => {
        const id = document.getElementById('editJudgeId').value;
        const name = document.getElementById('newJudgeFullName').value.trim();
        const username = document.getElementById('newJudgeName').value.trim();
        const password_hash = document.getElementById('newJudgePass').value.trim();
        
        if (!username || !password_hash || !name) return showToast('Name, Username, and Password are required.', 'error');
        setLoading('modalSaveBtn', true);
        
        let payload = { name, username, password_hash, role: 'judge' };
        if (id) payload.id = id;
        payload = (typeof festPayload === 'function') ? festPayload(payload) : (window.festosWithFest ? window.festosWithFest(payload) : payload);
        
        const { error } = await supabaseClient.from('users').upsert([payload]);
        setLoading('modalSaveBtn', false);
        
        if (error) {
            if (error.code === '23505') showToast('Username already taken.', 'error'); 
            else showToast(error.message, 'error');
        } else { 
            showToast(id ? 'Judge profile updated!' : 'New Judge registered!'); 
            closeModal(); 
            loadJudgesManagement(); 
        }
    });
}

async function deleteJudge(id, username) {
    openConfirmModal("Delete Judge?", `Are you sure you want to permanently delete Judge "${username}"?`, async () => {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') showToast(`Cannot delete ${username} as they have already submitted marks.`, 'error');
                else throw error;
            } else {
                showToast(`Judge ${username} deleted.`);
                loadJudgesManagement();
            }
        } catch(e) { showToast(e.message, 'error'); }
    });
}
// --- ASSIGNMENT WORKFLOW WITH FILTERING ---
let modalAssignComps = [];
let modalAssignedIds = [];

async function openAssignJudgeEvents(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    document.getElementById('assign-judge-title').innerText = `Assign Events: ${judge.username}`;
    document.getElementById('target-assign-judge-id').value = judgeId;
    
    const listContainer = document.getElementById('assign-judge-list');
    listContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching events...</div>';
    document.getElementById('assignJudgeEventsModal').classList.add('show');
    
    try {
        const { data: comps, error } = await supabaseClient
            .from('competitions')
            .select('id, name, categories(name)')
            .order('name');
            
        if (error) throw error;

        modalAssignComps = comps || [];
        modalAssignedIds = judge.assignments.map(a => a.id);
        
        // Populate category filter
        const uniqueCats = [...new Set(modalAssignComps.map(c => c.categories?.name || 'General'))].sort();
        const catSelect = document.getElementById('filterAssignJudgeCat');
        catSelect.innerHTML = '<option value="">All Categories</option>';
        uniqueCats.forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        
        document.getElementById('searchAssignJudgeComp').value = '';
        
        renderJudgeAssignList();

    } catch (e) {
        listContainer.innerHTML = `<p style="color:var(--danger); text-align:center;">Failed to load competitions.</p>`;
    }
}

function renderJudgeAssignList() {
    const search = document.getElementById('searchAssignJudgeComp').value.toLowerCase();
    const catFilter = document.getElementById('filterAssignJudgeCat').value;
    const listContainer = document.getElementById('assign-judge-list');
    
    let html = '';
    const filteredComps = modalAssignComps.filter(c => {
        const catName = c.categories?.name || 'General';
        const matchSearch = c.name.toLowerCase().includes(search);
        const matchCat = catFilter === '' || catName === catFilter;
        return matchSearch && matchCat;
    });
    
    if (filteredComps.length === 0) {
        html = `<p style="text-align:center; color:var(--text-muted); padding: 1rem;">No competitions match your filters.</p>`;
    } else {
        filteredComps.forEach(c => {
            const isChecked = modalAssignedIds.includes(c.id) ? 'checked' : '';
            html += `
                <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                    <input type="checkbox" class="judge-assign-cb" value="${c.id}" ${isChecked} onchange="updateModalAssignedIds(this)" style="width: 18px; height: 18px; accent-color: var(--primary);">
                    <div>
                        <strong style="display: block; font-size: 0.95rem;">${c.name}</strong>
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">${c.categories?.name || 'General'}</span>
                    </div>
                </label>
            `;
        });
    }
    listContainer.innerHTML = html;
}

function filterJudgeAssignList() {
    renderJudgeAssignList();
}

function updateModalAssignedIds(cb) {
    if (cb.checked) {
        if (!modalAssignedIds.includes(cb.value)) modalAssignedIds.push(cb.value);
    } else {
        modalAssignedIds = modalAssignedIds.filter(id => id !== cb.value);
    }
}

async function saveJudgeAssignments() {
    const judgeId = document.getElementById('target-assign-judge-id').value;
    const selectedCompIds = modalAssignedIds; // Fetch from memory, not DOM, because filters hide DOM checkboxes
    
    const btn = document.getElementById('btn-save-judge-assign');
    const originalText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        // Remove old generic assignments for this judge (where no marks have been awarded yet)
        await supabaseClient.from('judgements')
            .delete()
            .eq('judge_id', judgeId)
            .is('participant_id', null);
        
        // Insert new selected assignments
        if(selectedCompIds.length > 0) {
            const inserts = selectedCompIds.map(compId => ({ competition_id: compId, judge_id: judgeId }));
            await supabaseClient.from('judgements').insert(inserts);
        }
        
        showToast('Judge assignments updated successfully!');
        document.getElementById('assignJudgeEventsModal').classList.remove('show');
        loadJudgesManagement(); // Refresh table and data
        
    } catch(e) {
        showToast("Error updating assignments: " + e.message, 'error');
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}

async function exportSpecificJudgePDF(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    showToast(`Generating PDF for ${judge.username}...`, 'success');
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML(`Judge Schedule: ${judge.username}`);

    // Fetch Master Schedule dynamically to get live timing data
    const val = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : (await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle()).data?.value;
    const masterSchedule = val || {};

    let tableRows = '';
    
    if (judge.assignments.length === 0) {
        tableRows = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No events currently assigned.</td></tr>`;
    } else {
        // Merge assignments with schedule data
        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

        // Sort chronologically by Date, then Time
        scheduledAssignments.sort((a, b) => {
            if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
            return a.sched.time.localeCompare(b.sched.time);
        });

        tableRows = scheduledAssignments.map((comp, i) => {
            const timeStr = comp.sched.date !== 'TBD' 
                ? `<span style="font-weight: 700;">${comp.sched.date}</span><br><span style="color: #64748B; font-size: 10px;">${comp.sched.time}</span>` 
                : `<span style="color: #D97706; font-weight: 600;">Unscheduled</span>`;

            return `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px 10px; font-size: 11px;">${i + 1}</td>
                <td style="padding: 8px 10px; font-size: 11px; color: #0F172A;">${timeStr}</td>
                <td style="padding: 8px 10px; font-size: 11px; font-weight: 600; color: #0F172A;">${comp.name}</td>
                <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.categories?.name || 'General'}</td>
                <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.stages?.name || 'Unassigned'}</td>
            </tr>
        `}).join('');
    }

    container.innerHTML += `
        <div style="margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #E2E8F0; text-transform: uppercase;">
                        <th style="padding: 8px 10px; width: 40px;">#</th>
                        <th style="padding: 8px 10px;">DATE & TIME</th>
                        <th style="padding: 8px 10px;">COMPETITION NAME</th>
                        <th style="padding: 8px 10px;">CATEGORY</th>
                        <th style="padding: 8px 10px;">STAGE</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;

    const opt = { 
        margin: 10, 
        filename: typeof getFestFileName === 'function' ? getFestFileName(`Judge_Schedule_${judge.username}`, 'pdf') : `Judge_Schedule_${judge.username}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
}

// --- PREMIUM PDF EXPORT (ALL JUDGES) ---
async function exportJudgesPDF() {
    if (globalJudgesList.length === 0) return showToast('No judges found to export.', 'error');
    showToast('Generating Judge Roster PDF...', 'success');
    
    // Fetch Master Schedule dynamically to get live timing data
    const val = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : (await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle()).data?.value;
    const masterSchedule = val || {};

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML('Master Judge & Allocation Roster');

    globalJudgesList.forEach((judge, index) => {
        let tableRows = '';
        
        if (judge.assignments.length === 0) {
            tableRows = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No events currently assigned to this judge.</td></tr>`;
        } else {
            // Merge assignments with schedule data
            const scheduledAssignments = judge.assignments.map(comp => {
                const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
                return { ...comp, sched };
            });

            // Sort chronologically by Date, then Time
            scheduledAssignments.sort((a, b) => {
                if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
                return a.sched.time.localeCompare(b.sched.time);
            });

            tableRows = scheduledAssignments.map((comp, i) => {
                const timeStr = comp.sched.date !== 'TBD' 
                    ? `<span style="font-weight: 700;">${comp.sched.date}</span><br><span style="color: #64748B; font-size: 10px;">${comp.sched.time}</span>` 
                    : `<span style="color: #D97706; font-weight: 600;">Unscheduled</span>`;

                return `
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 8px 10px; font-size: 11px;">${i + 1}</td>
                    <td style="padding: 8px 10px; font-size: 11px; color: #0F172A;">${timeStr}</td>
                    <td style="padding: 8px 10px; font-size: 11px; font-weight: 600; color: #0F172A;">${comp.name}</td>
                    <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.categories?.name || 'General'}</td>
                    <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.stages?.name || 'Unassigned'}</td>
                </tr>
            `}).join('');
        }

        container.innerHTML += `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <div style="background: #1E293B; color: white; padding: 10px 12px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase;">
                        JUDGE: ${judge.username}
                    </h3>
                    <span style="font-size: 10px; color: #94A3B8; font-weight: 600;">${judge.assignments.length} ASSIGNMENTS</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                    <thead>
                        <tr style="background: #F8FAFC; text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #E2E8F0; text-transform: uppercase;">
                            <th style="padding: 8px 10px; width: 40px;">#</th>
                            <th style="padding: 8px 10px;">DATE & TIME</th>
                            <th style="padding: 8px 10px;">COMPETITION NAME</th>
                            <th style="padding: 8px 10px;">CATEGORY</th>
                            <th style="padding: 8px 10px;">STAGE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 10, 
        filename: typeof getFestFileName === 'function' ? getFestFileName('Judge_Allocation_Roster', 'pdf') : `Fest_Judge_Roster.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('Roster PDF Exported!'));
}

function filterJudgesTable() {
    renderJudgesTable();
}

async function viewJudgeDetails(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;

    document.getElementById('jd-modal-title').innerText = `Schedule: ${judge.username}`;
    const tbody = document.getElementById('jd-modal-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading schedule...</td></tr>`;
    document.getElementById('judgeDetailsModal').classList.add('show');

    try {
        // Fetch Master Schedule dynamically to get live timing data
        const val = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : (await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle()).data?.value;
        const masterSchedule = val || {};

        tbody.innerHTML = '';

        if (judge.assignments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No events assigned to this judge.</td></tr>`;
            return;
        }

        // Merge assignments with schedule data
        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

        // Sort chronologically by Date, then Time
        scheduledAssignments.sort((a, b) => {
            if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
            return a.sched.time.localeCompare(b.sched.time);
        });

        scheduledAssignments.forEach(comp => {
            const timeStr = comp.sched.date !== 'TBD' 
                ? `<span style="color: var(--primary); font-weight: 700;">${comp.sched.date}</span><br><span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">${comp.sched.time}</span>` 
                : `<span style="color: var(--warning); font-weight: 600; font-size: 0.8rem;">Unscheduled</span>`;
            
            tbody.innerHTML += `
                <tr>
                    <td style="white-space: nowrap;">${timeStr}</td>
                    <td style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${comp.name}</td>
                    <td><span class="badge" style="background: var(--bg-main); border: 1px solid var(--border); color: var(--text-muted);">${comp.categories?.name || 'General'}</span></td>
                    <td><span style="font-weight: 500;"><i class="fa-solid fa-microphone-stage" style="color: var(--primary); margin-right: 4px;"></i> ${comp.stages?.name || 'Unassigned'}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading schedule synchronization.</td></tr>`;
    }
}



// ==========================================
// WEBSITE BUILDER / CUSTOMIZER ENGINE
// ==========================================

function getDefaultWebsiteConfig(festName = '', festSlug = '') {
    const title = festName ? `Welcome to ${festName}` : 'Welcome to the Festival';
    return {
        domain: festSlug || '',
        password_protected: false,
        site_password: '',
        pages: {
            home: {
                progCount: '0', partCount: '0', teamCount: '0', venueCount: '0',
                heroTitle: title,
                heroSub: 'Track live event schedules, real-time results, and official championship standings all in one place.',
                heroDeskImg: '', heroMobImg: '',
                aboutTitle: 'About Our Festival', aboutSub: 'Celebrating Talent & Artistry',
                contentTitle: 'Where Champions Rise',
                contentDesc: festName ? `${festName} brings together extraordinary talent across diverse competitions.` : '',
                aboutImg: '',
                contact: {
                    title: 'Connect With Organizers', email: '', phone: '',
                    wa: '', ig: '', fb: '', yt: '',
                    web: '', address: ''
                }
            }
        },
        visibility: {
            page: { schedules: true, results: true, downloads: true, gallery: true, news: true, wall: false, portal: true, myresult: true },
            nav: { schedules: true, results: true, downloads: true, gallery: true, news: true, wall: false, portal: true, myresult: true },
            foot: { schedules: true, results: true, downloads: true, gallery: true, news: true, wall: false, portal: true, myresult: true }
        },
        theme: {
            primary: '#3B82F6',
            secondary: '#1E293B',
            accent: '#F59E0B',
            bg: '#F9FAFB',
            font: 'Plus Jakarta Sans',
            podium_style: 'cards',
            show_points_breakdown: true,
            show_milestone_filter: true,
            show_search_filter: true,
            results_title: 'OFFICIAL EVENT RESULTS',
            results_subtitle: 'Real-Time Verified Standings & Graphics',
            header_logo: '',
            footer_logo: '',
            og_image: '',
            launch_logo: ''
        },
        gallery: [],
        downloads: [],
        news: []
    };
}

let websiteConfig = getDefaultWebsiteConfig();

let webAnalyticsChart = null;


window.switchBuilderTab = function(tabId, element) {
    const navItems = document.querySelectorAll('.builder-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');
    
    const allPanes = document.querySelectorAll('.builder-content-pane');
    allPanes.forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    const targetPane = document.getElementById(`builder-pane-${tabId}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'flex';
    }

    if (tabId === 'analytics') {
        initProfessionalAnalytics();
    } else if (tabId === 'gallery') {
        renderGalleryBuilder();
    } else if (tabId === 'downloads') {
        renderDownloadsBuilder();
    } else if (tabId === 'news') {
        renderNewsBuilder();
    } else if (tabId === 'overview') {
        const deskFrame = document.getElementById('preview-desktop-frame');
        const mobFrame = document.getElementById('preview-mobile-frame');
        const fid = getActiveFestId();
        if (deskFrame) deskFrame.src = 'results.html?preview=true&fest=' + fid + '&r=' + Date.now();
        if (mobFrame) mobFrame.src = 'results.html?preview=true&fest=' + fid + '&r=' + Date.now();
        
        // Dynamically update URL displays
        let festDomain = '';
        if (window.availableFests) {
            const f = window.availableFests.find(x => x.id === fid);
            if (f) festDomain = f.domain || (f.slug + '.festos.clubad.space');
        }
        if (!festDomain && websiteConfig.domain) festDomain = websiteConfig.domain + '.festos.clubad.space';
        if (!festDomain) festDomain = fid.replace('fest_', '') + '.festos.clubad.space';
        
        const deskUrlEl = document.getElementById('overview-url-display-desk');
        const footUrlEl = document.getElementById('overview-url-display-footer');
        if (deskUrlEl) deskUrlEl.innerText = festDomain;
        if (footUrlEl) footUrlEl.innerText = festDomain;
    }
};

// --- Analytics Chart ---
function initProfessionalAnalytics() {
    const ctx = document.getElementById('websiteAnalyticsChart');
    if (!ctx) return;
    
    if (webAnalyticsChart) webAnalyticsChart.destroy();
    
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const visitorsData = [1200, 1900, 3000, 5000, 2000, 3000, 4500];
    const pageviewsData = [2400, 3800, 6000, 10000, 4000, 6000, 9000];

    webAnalyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Page Views',
                    data: pageviewsData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Unique Visitors',
                    data: visitorsData,
                    borderColor: '#10B981',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', weight: 600 } } }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#E5E7EB' } },
                x: { grid: { display: false } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// --- Loading and Saving Configuration ---
async function loadWebsiteConfig() {
    try {
        const defaultFestId = (window.festosDefaultFestId ? window.festosDefaultFestId() : 'fest_zenith_2026');
        const fid = (typeof getActiveFestId === 'function' ? getActiveFestId() : '') || 
                    (window.festosAuth ? window.festosAuth.getCurrentFestId() : '') || 
                    defaultFestId;

        let festMeta = null;
        if (window.availableFests && window.availableFests.length) {
            festMeta = window.availableFests.find(f => f.id === fid);
        }
        const festName = festMeta ? festMeta.name : 'Festival';
        const festSlug = festMeta ? (festMeta.slug || festMeta.id.replace('fest_', '')) : '';
        
        websiteConfig = getDefaultWebsiteConfig(festName, festSlug);

        // Multi-tier load: Festival-scoped setting first, then fallback
        let val = null;
        if (window.festosGetSetting) {
            val = await window.festosGetSetting('website_config', fid);
            if (!val) val = await window.festosGetSetting('website_config');
        }

        if (!val) {
            try {
                const raw = localStorage.getItem('festos_cfg_website_config_' + fid) || 
                            localStorage.getItem('website_config_' + fid) ||
                            localStorage.getItem('websiteConfig');
                if (raw) val = JSON.parse(raw);
            } catch(e) {}
        }

        if (!val && typeof supabaseClient !== 'undefined') {
            try {
                const { data: d1 } = await supabaseClient.from('settings').select('value').eq('id', 'website_config_' + fid).maybeSingle();
                if (d1 && d1.value) val = d1.value;
                else {
                    const { data: d2 } = await supabaseClient.from('settings').select('value').eq('id', 'website_config').maybeSingle();
                    if (d2 && d2.value) val = d2.value;
                }
            } catch(e) {}
        }

        if (val) {
            websiteConfig = { ...websiteConfig, ...val };
            if (val.pages) websiteConfig.pages = { ...websiteConfig.pages, ...val.pages };
            if (val.visibility) websiteConfig.visibility = { ...websiteConfig.visibility, ...val.visibility };
            if (val.theme) websiteConfig.theme = { ...websiteConfig.theme, ...val.theme };
            if (val.gallery) websiteConfig.gallery = val.gallery;
            if (val.downloads) websiteConfig.downloads = val.downloads;
            if (val.news) websiteConfig.news = val.news;
        }

        populateWebsiteForms();
    } catch(e) {
        console.warn("Using default website configuration:", e);
        populateWebsiteForms();
    }
}
window.loadWebsiteConfig = loadWebsiteConfig;

function populateWebsiteForms() {
    // 1. Password Protection Toggle
    const passToggle = document.getElementById('site-password-toggle');
    if (passToggle) {
        passToggle.checked = !!websiteConfig.password_protected;
        passToggle.onchange = function() {
            websiteConfig.password_protected = passToggle.checked;
            if (passToggle.checked && !websiteConfig.site_password) {
                openSitePasswordModal();
            } else {
                executeWebsiteSave(null);
            }
        };
    }

    // 2. Domains
    if (document.getElementById('web-subdomain')) {
        document.getElementById('web-subdomain').value = websiteConfig.domain || '';
        if (document.getElementById('web-custom-domain')) document.getElementById('web-custom-domain').value = websiteConfig.custom_domain || '';
        
        const fullUrl = websiteConfig.domain ? `${websiteConfig.domain}.festos.clubad.space` : (websiteConfig.custom_domain || '—');
        
        if (document.getElementById('overview-url-display-desk')) document.getElementById('overview-url-display-desk').innerText = fullUrl;
        if (document.getElementById('overview-url-display-footer')) document.getElementById('overview-url-display-footer').innerText = fullUrl;
        if (document.getElementById('subdomain-status')) document.getElementById('subdomain-status').style.display = websiteConfig.domain ? 'block' : 'none';
    }

    // 3. Pages
    const p = websiteConfig.pages?.home || {};
    if (document.getElementById('pg-prog-count')) document.getElementById('pg-prog-count').value = p.progCount || '';
    if (document.getElementById('pg-part-count')) document.getElementById('pg-part-count').value = p.partCount || '';
    if (document.getElementById('pg-team-count')) document.getElementById('pg-team-count').value = p.teamCount || '';
    if (document.getElementById('pg-venue-count')) document.getElementById('pg-venue-count').value = p.venueCount || '';
    if (document.getElementById('pg-hero-title')) document.getElementById('pg-hero-title').value = p.heroTitle || '';
    if (document.getElementById('pg-hero-sub')) document.getElementById('pg-hero-sub').value = p.heroSub || '';
    if (document.getElementById('pg-about-title')) document.getElementById('pg-about-title').value = p.aboutTitle || '';
    if (document.getElementById('pg-about-sub')) document.getElementById('pg-about-sub').value = p.aboutSub || '';
    if (document.getElementById('pg-content-title')) document.getElementById('pg-content-title').value = p.contentTitle || '';
    if (document.getElementById('pg-content-desc')) document.getElementById('pg-content-desc').value = p.contentDesc || '';
    
    const c = p.contact || {};
    if (document.getElementById('pg-contact-title')) document.getElementById('pg-contact-title').value = c.title || '';
    if (document.getElementById('pg-contact-email')) document.getElementById('pg-contact-email').value = c.email || '';
    if (document.getElementById('pg-contact-phone')) document.getElementById('pg-contact-phone').value = c.phone || '';
    if (document.getElementById('pg-contact-wa')) document.getElementById('pg-contact-wa').value = c.wa || '';
    if (document.getElementById('pg-contact-ig')) document.getElementById('pg-contact-ig').value = c.ig || '';
    if (document.getElementById('pg-contact-fb')) document.getElementById('pg-contact-fb').value = c.fb || '';
    if (document.getElementById('pg-contact-yt')) document.getElementById('pg-contact-yt').value = c.yt || '';
    if (document.getElementById('pg-contact-web')) document.getElementById('pg-contact-web').value = c.web || '';
    if (document.getElementById('pg-contact-address')) document.getElementById('pg-contact-address').value = c.address || '';

    // 4. Visibility Toggles
    const applyToggles = (category, data) => {
        if (!data) return;
        Object.keys(data).forEach(key => {
            const el = document.getElementById(`vis-${category}-${key}`);
            if (el) el.checked = data[key];
        });
        const portalEl = document.getElementById(`vis-${category}-portal`);
        if (portalEl && data.portal === undefined && data.myresult !== undefined) {
            portalEl.checked = data.myresult;
        }
    };
    applyToggles('page', websiteConfig.visibility?.page);
    applyToggles('nav', websiteConfig.visibility?.nav);
    applyToggles('foot', websiteConfig.visibility?.foot);

    // 5. Theme & Results Settings
    const thm = websiteConfig.theme || {};
    if (document.getElementById('thm-color-primary')) {
        document.getElementById('thm-color-primary').value = thm.primary || '#3B82F6';
        document.getElementById('thm-color-primary-picker').value = thm.primary || '#3B82F6';
    }
    if (document.getElementById('thm-color-secondary')) {
        document.getElementById('thm-color-secondary').value = thm.secondary || '#1E293B';
        document.getElementById('thm-color-secondary-picker').value = thm.secondary || '#1E293B';
    }
    if (document.getElementById('thm-color-accent')) {
        document.getElementById('thm-color-accent').value = thm.accent || '#F59E0B';
        document.getElementById('thm-color-accent-picker').value = thm.accent || '#F59E0B';
    }
    if (document.getElementById('thm-color-bg')) {
        document.getElementById('thm-color-bg').value = thm.bg || '#F9FAFB';
        document.getElementById('thm-color-bg-picker').value = thm.bg || '#F9FAFB';
    }
    if (document.getElementById('thm-font-family')) {
        document.getElementById('thm-font-family').value = thm.font || 'Plus Jakarta Sans';
    }
    if (document.getElementById('thm-podium-style')) {
        document.getElementById('thm-podium-style').value = thm.podium_style || 'cards';
    }
    if (document.getElementById('thm-results-title')) {
        document.getElementById('thm-results-title').value = thm.results_title || 'OFFICIAL EVENT RESULTS';
    }
    if (document.getElementById('thm-results-subtitle')) {
        document.getElementById('thm-results-subtitle').value = thm.results_subtitle || 'Real-Time Verified Standings & Graphics';
    }
    if (document.getElementById('thm-show-points')) {
        document.getElementById('thm-show-points').checked = thm.show_points_breakdown !== false;
    }
    if (document.getElementById('thm-show-milestone')) {
        document.getElementById('thm-show-milestone').checked = thm.show_milestone_filter !== false;
    }
    if (document.getElementById('thm-show-search')) {
        document.getElementById('thm-show-search').checked = thm.show_search_filter !== false;
    }

    // Logos
    const hPrev = document.getElementById('thm-header-logo-preview');
    if (hPrev) {
        hPrev.src = thm.header_logo || '';
        hPrev.style.display = thm.header_logo ? 'block' : 'none';
    }
    const fPrev = document.getElementById('thm-footer-logo-preview');
    if (fPrev) {
        fPrev.src = thm.footer_logo || '';
        fPrev.style.display = thm.footer_logo ? 'block' : 'none';
    }

    renderGalleryBuilder();
    renderDownloadsBuilder();
    renderNewsBuilder();
}
window.populateWebsiteForms = populateWebsiteForms;

async function executeWebsiteSave(btnElement) {
    const originalText = btnElement ? btnElement.innerHTML : null;
    if (btnElement) {
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btnElement.disabled = true;
    }

    try {
        const defaultFestId = (window.festosDefaultFestId ? window.festosDefaultFestId() : 'fest_zenith_2026');
        const fid = (typeof getActiveFestId === 'function' ? getActiveFestId() : '') || 
                    (window.festosAuth ? window.festosAuth.getCurrentFestId() : '') || 
                    defaultFestId;

        // 1. Save locally for 0ms lag
        try {
            localStorage.setItem('festos_cfg_website_config_' + fid, JSON.stringify(websiteConfig));
            localStorage.setItem('festos_cfg_website_config', JSON.stringify(websiteConfig));
            localStorage.setItem('website_config_' + fid, JSON.stringify(websiteConfig));
            localStorage.setItem('websiteConfig', JSON.stringify(websiteConfig));
        } catch(e) {}

        // 2. Save via festosSaveSetting (both festival-scoped and global fallback)
        if (window.festosSaveSetting) {
            await window.festosSaveSetting('website_config', websiteConfig, fid);
            await window.festosSaveSetting('website_config', websiteConfig, null);
        }

        // 3. Save directly to Supabase settings table
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('settings').upsert([
                    { id: 'website_config_' + fid, value: websiteConfig },
                    { id: 'website_config', value: websiteConfig }
                ]);
            } catch(dbErr) {
                console.warn("Direct Supabase setting save note:", dbErr);
            }
        }

        showToast("Website Settings Saved Successfully!", "success");

        // 4. Update Overview URL Displays
        const fullUrl = websiteConfig.domain ? `${websiteConfig.domain}.festos.clubad.space` : (websiteConfig.custom_domain || '—');
        const deskDisp = document.getElementById('overview-url-display-desk');
        if (deskDisp) deskDisp.innerText = fullUrl;
        const footerDisp = document.getElementById('overview-url-display-footer');
        if (footerDisp) footerDisp.innerText = fullUrl;

        // 5. Broadcast to live preview iframes
        const deskFrame = document.getElementById('preview-desktop-frame');
        const mobFrame = document.getElementById('preview-mobile-frame');
        
        if (deskFrame) {
            try { deskFrame.contentWindow?.postMessage({ type: 'FESTOS_CONFIG_SYNC', config: websiteConfig }, '*'); } catch(e) {}
            deskFrame.src = 'results.html?preview=true&fest=' + fid + '&r=' + Date.now();
        }
        if (mobFrame) {
            try { mobFrame.contentWindow?.postMessage({ type: 'FESTOS_CONFIG_SYNC', config: websiteConfig }, '*'); } catch(e) {}
            mobFrame.src = 'results.html?preview=true&fest=' + fid + '&r=' + Date.now();
        }

    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        if (btnElement && originalText !== null) {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    }
}
window.executeWebsiteSave = executeWebsiteSave;

// --- Color Sync Helpers ---
window.syncColorInput = function(type, hex) {
    const textInput = document.getElementById(`thm-color-${type}`);
    if (textInput) textInput.value = hex.toUpperCase();
};

window.syncColorPicker = function(type, hex) {
    const picker = document.getElementById(`thm-color-${type}-picker`);
    if (picker && /^#[0-9A-F]{6}$/i.test(hex)) picker.value = hex;
};

// --- Logo Upload Handler ---
window.handleWebsiteLogoUpload = function(logoKey, inputEl) {
    if (!inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        if (!websiteConfig.theme) websiteConfig.theme = {};
        websiteConfig.theme[logoKey] = base64;
        
        if (logoKey === 'header_logo') {
            const hPrev = document.getElementById('thm-header-logo-preview');
            if (hPrev) { hPrev.src = base64; hPrev.style.display = 'block'; }
        } else if (logoKey === 'footer_logo') {
            const fPrev = document.getElementById('thm-footer-logo-preview');
            if (fPrev) { fPrev.src = base64; fPrev.style.display = 'block'; }
        }
        showToast("Logo uploaded. Click 'Save Theme Changes' to apply.", "success");
    };
    reader.readAsDataURL(file);
};

// --- Password Protection Modal ---
window.openSitePasswordModal = function() {
    const input = document.getElementById('site-password-input');
    if (input) input.value = websiteConfig.site_password || '';
    const modal = document.getElementById('sitePasswordModal');
    if (modal) modal.classList.add('show');
};
window.closeSitePasswordModal = function() {
    const modal = document.getElementById('sitePasswordModal');
    if (modal) modal.classList.remove('show');
};
window.saveSitePassword = function() {
    const pass = document.getElementById('site-password-input') ? document.getElementById('site-password-input').value.trim() : '';
    websiteConfig.site_password = pass;
    websiteConfig.password_protected = pass !== '';
    const toggle = document.getElementById('site-password-toggle');
    if (toggle) toggle.checked = websiteConfig.password_protected;
    closeSitePasswordModal();
    executeWebsiteSave(null);
};

// --- Save Domain Pane ---
function saveDomainConfig(event) {
    const domainInputEl = document.getElementById('web-subdomain');
    const customDomainEl = document.getElementById('web-custom-domain');
    
    const domainInput = domainInputEl ? domainInputEl.value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const customDomain = customDomainEl ? customDomainEl.value.trim().toLowerCase() : '';
    
    websiteConfig.domain = domainInput;
    websiteConfig.custom_domain = customDomain;
    
    const fullUrl = domainInput ? `${domainInput}.festos.clubad.space` : (customDomain || '—');
    const statusEl = document.getElementById('subdomain-status');
    if (statusEl) statusEl.style.display = domainInput ? 'block' : 'none';

    const deskDisp = document.getElementById('overview-url-display-desk');
    if (deskDisp) deskDisp.innerText = fullUrl;
    const footerDisp = document.getElementById('overview-url-display-footer');
    if (footerDisp) footerDisp.innerText = fullUrl;
    
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}
window.saveDomainConfig = saveDomainConfig;

// --- Save Page Pane ---
function savePageConfig(event) {
    if (!websiteConfig.pages) websiteConfig.pages = {};
    websiteConfig.pages.home = {
        progCount: document.getElementById('pg-prog-count')?.value || '',
        partCount: document.getElementById('pg-part-count')?.value || '',
        teamCount: document.getElementById('pg-team-count')?.value || '',
        venueCount: document.getElementById('pg-venue-count')?.value || '',
        heroTitle: document.getElementById('pg-hero-title')?.value || '',
        heroSub: document.getElementById('pg-hero-sub')?.value || '',
        aboutTitle: document.getElementById('pg-about-title')?.value || '',
        aboutSub: document.getElementById('pg-about-sub')?.value || '',
        contentTitle: document.getElementById('pg-content-title')?.value || '',
        contentDesc: document.getElementById('pg-content-desc')?.value || '',
        contact: {
            title: document.getElementById('pg-contact-title')?.value || '',
            email: document.getElementById('pg-contact-email')?.value || '',
            phone: document.getElementById('pg-contact-phone')?.value || '',
            wa: document.getElementById('pg-contact-wa')?.value || '',
            ig: document.getElementById('pg-contact-ig')?.value || '',
            fb: document.getElementById('pg-contact-fb')?.value || '',
            yt: document.getElementById('pg-contact-yt')?.value || '',
            web: document.getElementById('pg-contact-web')?.value || '',
            address: document.getElementById('pg-contact-address')?.value || ''
        }
    };
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}
window.savePageConfig = savePageConfig;

// --- Save Visibility Pane ---
function saveVisibilityConfig(event) {
    if (!websiteConfig.visibility) websiteConfig.visibility = { page: {}, nav: {}, foot: {} };
    const keys = ['schedules', 'results', 'portal', 'downloads', 'gallery', 'news', 'wall', 'myresult'];
    
    keys.forEach(k => {
        const pageEl = document.getElementById(`vis-page-${k}`);
        const navEl = document.getElementById(`vis-nav-${k}`);
        const footEl = document.getElementById(`vis-foot-${k}`);
        if (pageEl) {
            websiteConfig.visibility.page[k] = pageEl.checked;
            if (k === 'portal') websiteConfig.visibility.page['myresult'] = pageEl.checked;
        }
        if (navEl) {
            websiteConfig.visibility.nav[k] = navEl.checked;
            if (k === 'portal') websiteConfig.visibility.nav['myresult'] = navEl.checked;
        }
        if (footEl) {
            websiteConfig.visibility.foot[k] = footEl.checked;
            if (k === 'portal') websiteConfig.visibility.foot['myresult'] = footEl.checked;
        }
    });
    
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}
window.saveVisibilityConfig = saveVisibilityConfig;

// --- Device Preview Switcher ---
window.switchDevicePreview = function(mode, btnEl) {
    const container = document.querySelector('#builder-pane-overview .mockup-container');
    if (!container) return;
    
    container.classList.remove('preview-mode-desktop', 'preview-mode-mobile', 'preview-mode-split');
    container.classList.add(`preview-mode-${mode}`);
    
    const btns = document.querySelectorAll('.preview-mode-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
};

// --- 1-Click Luxury Theme Preset Palettes ---
window.applyThemePreset = function(name) {
    const presets = {
        indigo: { primary: '#2563EB', secondary: '#0F172A', accent: '#F59E0B', bg: '#F8FAFC', font: 'Plus Jakarta Sans' },
        emerald: { primary: '#059669', secondary: '#064E3B', accent: '#D97706', bg: '#F0FDF4', font: 'Outfit' },
        purple: { primary: '#7C3AED', secondary: '#1E1B4B', accent: '#F43F5E', bg: '#FAF5FF', font: 'Poppins' },
        crimson: { primary: '#DC2626', secondary: '#18181B', accent: '#EAB308', bg: '#FEF2F2', font: 'Montserrat' },
        midnight: { primary: '#0EA5E9', secondary: '#020617', accent: '#F97316', bg: '#0B1120', font: 'Inter' },
        amber: { primary: '#D97706', secondary: '#292524', accent: '#E11D48', bg: '#FFFBEB', font: 'Plus Jakarta Sans' }
    };
    const p = presets[name];
    if (!p) return;
    
    if (document.getElementById('thm-color-primary')) {
        document.getElementById('thm-color-primary').value = p.primary;
        document.getElementById('thm-color-primary-picker').value = p.primary;
    }
    if (document.getElementById('thm-color-secondary')) {
        document.getElementById('thm-color-secondary').value = p.secondary;
        document.getElementById('thm-color-secondary-picker').value = p.secondary;
    }
    if (document.getElementById('thm-color-accent')) {
        document.getElementById('thm-color-accent').value = p.accent;
        document.getElementById('thm-color-accent-picker').value = p.accent;
    }
    if (document.getElementById('thm-color-bg')) {
        document.getElementById('thm-color-bg').value = p.bg;
        document.getElementById('thm-color-bg-picker').value = p.bg;
    }
    if (document.getElementById('thm-font-family')) {
        document.getElementById('thm-font-family').value = p.font;
    }
    saveThemeConfig(null);
    showToast(`Applied and saved ${name.toUpperCase()} luxury theme preset!`, 'success');
};

// --- Save Theme & Results Page Customizer ---
function saveThemeConfig(event) {
    if (!websiteConfig.theme) websiteConfig.theme = {};
    websiteConfig.theme.primary = document.getElementById('thm-color-primary')?.value || '#3B82F6';
    websiteConfig.theme.secondary = document.getElementById('thm-color-secondary')?.value || '#1E293B';
    websiteConfig.theme.accent = document.getElementById('thm-color-accent')?.value || '#F59E0B';
    websiteConfig.theme.bg = document.getElementById('thm-color-bg')?.value || '#F9FAFB';
    websiteConfig.theme.font = document.getElementById('thm-font-family')?.value || 'Plus Jakarta Sans';
    websiteConfig.theme.podium_style = document.getElementById('thm-podium-style')?.value || 'cards';
    websiteConfig.theme.results_title = document.getElementById('thm-results-title')?.value || 'OFFICIAL EVENT RESULTS';
    websiteConfig.theme.results_subtitle = document.getElementById('thm-results-subtitle')?.value || 'Real-Time Verified Standings & Graphics';
    websiteConfig.theme.show_points_breakdown = document.getElementById('thm-show-points')?.checked !== false;
    websiteConfig.theme.show_milestone_filter = document.getElementById('thm-show-milestone')?.checked !== false;
    websiteConfig.theme.show_search_filter = document.getElementById('thm-show-search')?.checked !== false;

    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}
window.saveThemeConfig = saveThemeConfig;
// --- GALLERY BUILDER ENGINE ---
window.renderGalleryBuilder = function() {
    const grid = document.getElementById('builder-gallery-grid');
    if (!grid) return;
    const albums = websiteConfig.gallery || [];
    
    if (albums.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-regular fa-images" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: var(--text-dim);"></i>
                <p style="font-size: 0.9rem; font-weight: 600;">No photo albums added yet.</p>
                <button class="btn btn-primary" style="width: auto; margin-top: 1rem;" onclick="openNewAlbumModal()"><i class="fa-solid fa-plus"></i> Create First Album</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = albums.map(a => `
        <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column;">
            <img src="${a.cover_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80'}" style="width: 100%; height: 140px; object-fit: cover;">
            <div style="padding: 0.85rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <span style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase;">${a.category || 'Stage'}</span>
                    <h4 style="font-size: 0.95rem; font-weight: 700; margin-top: 0.35rem; color: var(--text-main);">${a.title}</h4>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--border);">
                    <small style="color: var(--text-muted); font-size: 0.75rem;">${a.count || 10} Photos</small>
                    <button class="btn btn-danger" style="width: auto; min-height: 28px; padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="deleteAlbum('${a.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
};

window.openNewAlbumModal = function() {
    document.getElementById('album-title-input').value = '';
    document.getElementById('album-cover-url').value = '';
    document.getElementById('album-cover-preview').style.display = 'none';
    document.getElementById('builderAlbumModal').classList.add('show');
};
window.closeAlbumModal = function() {
    document.getElementById('builderAlbumModal').classList.remove('show');
};
window.handleAlbumCoverUpload = function(inputEl) {
    if (!inputEl.files || !inputEl.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('album-cover-url').value = e.target.result;
        const prev = document.getElementById('album-cover-preview');
        prev.src = e.target.result;
        prev.style.display = 'block';
    };
    reader.readAsDataURL(inputEl.files[0]);
};
window.saveNewAlbum = function() {
    const title = document.getElementById('album-title-input').value.trim();
    if (!title) return alert("Please enter an album title.");
    const category = document.getElementById('album-category-input').value;
    const cover = document.getElementById('album-cover-url').value.trim() || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80';
    
    if (!websiteConfig.gallery) websiteConfig.gallery = [];
    websiteConfig.gallery.push({
        id: 'alb_' + Date.now(),
        title,
        category,
        cover_url: cover,
        count: Math.floor(Math.random() * 20) + 5
    });

    closeAlbumModal();
    renderGalleryBuilder();
    executeWebsiteSave(null);
};
window.deleteAlbum = function(id) {
    openConfirmModal(
        'Delete Album?',
        'Are you sure you want to permanently delete this photo album from the gallery?',
        () => {
            websiteConfig.gallery = (websiteConfig.gallery || []).filter(a => a.id !== id);
            renderGalleryBuilder();
            executeWebsiteSave(null);
            showToast('Album deleted.', 'success');
        },
        { confirmText: 'Yes, Delete', confirmBtnClass: 'btn-danger', icon: 'fa-solid fa-trash-can' }
    );
};

// --- DOWNLOADS BUILDER ENGINE ---
window.renderDownloadsBuilder = function() {
    const list = document.getElementById('builder-downloads-list');
    if (!list) return;
    const items = websiteConfig.downloads || [];
    
    if (items.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-file-arrow-down" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: var(--text-dim);"></i>
                <p style="font-size: 0.9rem; font-weight: 600;">No downloadable files listed.</p>
                <button class="btn btn-primary" style="width: auto; margin-top: 1rem;" onclick="openNewDownloadModal()"><i class="fa-solid fa-plus"></i> Add Download Item</button>
            </div>
        `;
        return;
    }

    list.innerHTML = items.map(d => `
        <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.85rem; min-width: 0; flex: 1;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div style="min-width: 0;">
                    <strong style="font-size: 0.95rem; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d.title}</strong>
                    <small style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">${d.category || 'Rulebook'} • ${d.size || '1.5 MB'}</small>
                </div>
            </div>
            <button class="btn btn-danger" style="width: auto; min-height: 32px; padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="deleteDownload('${d.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
};

window.openNewDownloadModal = function() {
    document.getElementById('download-title-input').value = '';
    document.getElementById('download-size-input').value = '2.4 MB';
    document.getElementById('download-url-input').value = '#';
    document.getElementById('builderDownloadModal').classList.add('show');
};
window.closeDownloadModal = function() {
    document.getElementById('builderDownloadModal').classList.remove('show');
};
window.saveNewDownload = function() {
    const title = document.getElementById('download-title-input').value.trim();
    if (!title) return alert("Please enter a title.");
    const category = document.getElementById('download-category-input').value;
    const size = document.getElementById('download-size-input').value.trim() || '1.5 MB';
    const url = document.getElementById('download-url-input').value.trim() || '#';

    if (!websiteConfig.downloads) websiteConfig.downloads = [];
    websiteConfig.downloads.push({
        id: 'dl_' + Date.now(),
        title, category, size, url
    });

    closeDownloadModal();
    renderDownloadsBuilder();
    executeWebsiteSave(null);
};
window.deleteDownload = function(id) {
    openConfirmModal(
        'Delete Download Item?',
        'Are you sure you want to delete this downloadable file?',
        () => {
            websiteConfig.downloads = (websiteConfig.downloads || []).filter(d => d.id !== id);
            renderDownloadsBuilder();
            executeWebsiteSave(null);
            showToast('Download item deleted.', 'success');
        },
        { confirmText: 'Yes, Delete', confirmBtnClass: 'btn-danger', icon: 'fa-solid fa-trash-can' }
    );
};

// --- NEWS BUILDER ENGINE ---
window.renderNewsBuilder = function() {
    const list = document.getElementById('builder-news-list');
    if (!list) return;
    const news = websiteConfig.news || [];
    
    if (news.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-regular fa-newspaper" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: var(--text-dim);"></i>
                <p style="font-size: 0.9rem; font-weight: 600;">No news announcements posted.</p>
                <button class="btn btn-primary" style="width: auto; margin-top: 1rem;" onclick="openNewNewsModal()"><i class="fa-solid fa-plus"></i> Post First Bulletin</button>
            </div>
        `;
        return;
    }

    list.innerHTML = news.map(n => `
        <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
            <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <span style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase;">${n.category || 'Announcement'}</span>
                    <small style="color: var(--text-dim); font-size: 0.75rem;">${n.date || new Date().toISOString().split('T')[0]}</small>
                </div>
                <strong style="font-size: 1rem; color: var(--text-main); display: block; margin-bottom: 0.25rem;">${n.title}</strong>
                <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${n.summary || ''}</p>
            </div>
            <button class="btn btn-danger" style="width: auto; min-height: 32px; padding: 0.3rem 0.8rem; font-size: 0.8rem;" onclick="deleteNews('${n.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
};

window.openNewNewsModal = function() {
    document.getElementById('news-title-input').value = '';
    document.getElementById('news-cat-input').value = 'Announcement';
    document.getElementById('news-date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('news-summary-input').value = '';
    document.getElementById('news-content-input').value = '';
    document.getElementById('builderNewsModal').classList.add('show');
};
window.closeNewsModal = function() {
    document.getElementById('builderNewsModal').classList.remove('show');
};
window.saveNewNews = function() {
    const title = document.getElementById('news-title-input').value.trim();
    if (!title) return alert("Please enter a headline.");
    const category = document.getElementById('news-cat-input').value.trim() || 'Announcement';
    const date = document.getElementById('news-date-input').value;
    const summary = document.getElementById('news-summary-input').value.trim();
    const content = document.getElementById('news-content-input').value.trim();

    if (!websiteConfig.news) websiteConfig.news = [];
    websiteConfig.news.push({
        id: 'nw_' + Date.now(),
        title, category, date, summary, content
    });

    closeNewsModal();
    renderNewsBuilder();
    executeWebsiteSave(null);
};
window.deleteNews = function(id) {
    openConfirmModal(
        'Delete Announcement?',
        'Are you sure you want to permanently delete this news announcement?',
        () => {
            websiteConfig.news = (websiteConfig.news || []).filter(n => n.id !== id);
            renderNewsBuilder();
            executeWebsiteSave(null);
            showToast('Announcement deleted.', 'success');
        },
        { confirmText: 'Yes, Delete', confirmBtnClass: 'btn-danger', icon: 'fa-solid fa-trash-can' }
    );
};

// --- DRAG & DROP LOGIC ---
window.handleDragStart = function(e, compId, studentId) {
    e.dataTransfer.setData('text/plain', JSON.stringify({compId, studentId}));
    e.target.style.opacity = '0.5';
};

window.handleDragEnd = function(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
};

window.handleDragOver = function(e) {
    e.preventDefault();
    const target = e.target.closest('.draggable-item');
    if(target) target.classList.add('drag-over');
};

window.handleDragLeave = function(e) {
    const target = e.target.closest('.draggable-item');
    if(target) target.classList.remove('drag-over');
};

window.quickRemoveStudent = async function(compId, studentId) {
    openConfirmModal("Remove Student?", "Are you sure you want to completely remove this student from the competition?", async () => {
        try {
            const { error } = await supabaseClient.from('participant_competitions')
                .delete()
                .eq('competition_id', compId)
                .eq('participant_id', studentId);
                
            if (error) throw error;
            showToast("Student removed.", "success");
            renderAssignOverview();
        } catch(e) {
            showToast(e.message, "error");
        }
    });
};

// --- QUICK ADD MODAL LOGIC ---
window.tempSelectedStudents = [];
window.tempAvailableStudents = [];

window.openQuickAddModal = function(compId, teamId) {
    const comp = competitionsList.find(c => String(c.id) === String(compId));
    if (!comp) return;

    const compCat = (categoriesList || []).find(c => String(c.id) === String(comp.category_id)) || comp.categories;
    const isGeneral = compCat ? (compCat.is_general === true || String(compCat.is_general) === 'true') : false;

    // Filter Eligible Students from memory
    const eligibleStudents = participantsList.filter(student => {
        // Enforce the team matching exactly
        if (String(student.team_id) !== String(teamId)) return false;
        
        // Direct category match
        if (String(student.category_id) === String(comp.category_id)) return true;
        
        // General Category Cross-match
        if (isGeneral) {
            const studentCategory = (categoriesList || []).find(c => String(c.id) === String(student.category_id));
            if (studentCategory) {
                let allowedCats = [];
                try {
                    let rawAllowed = studentCategory.allowed_general_categories;
                    if (typeof rawAllowed === 'string') allowedCats = JSON.parse(rawAllowed);
                    else if (Array.isArray(rawAllowed)) allowedCats = rawAllowed;
                } catch(e) {}
                if (allowedCats.some(id => String(id) === String(comp.category_id))) return true;
            }
        }
        return false;
    });

    const enrolledIds = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(compId)).map(a => String(a.participant_id));
    window.tempAvailableStudents = eligibleStudents.filter(s => !enrolledIds.includes(String(s.id)));
    window.tempSelectedStudents = [];
    
    // Strict Limit Validations
    window.tempCompLimit = comp.max_participants > 0 ? comp.max_participants : 999;
    const enrolledTeamIds = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(compId) && String(a.participants?.team_id || '') === String(teamId)).map(a => String(a.participant_id));
    window.tempSlotsLeft = window.tempCompLimit - enrolledTeamIds.length;
    
    window.tempCompId = compId;
    window.tempTeamId = teamId;
    window.tempIsGroup = comp.is_group;

    const limitStr = window.tempCompLimit > 100 ? 'UNLIMITED' : window.tempSlotsLeft;

    openModal(`ADD TO ${comp.name}`, `
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 1rem;">
            REMAINING CAPACITY FOR TEAM: <span id="qa-slots-left" style="color: var(--primary); font-size: 1rem;">${limitStr}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div style="border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-surface); overflow: hidden; display: flex; flex-direction: column;">
                <div style="padding: 0.75rem; background: var(--bg-main); font-size: 0.8rem; font-weight: 800; border-bottom: 1px solid var(--border);">AVAILABLE STUDENTS</div>
                <div id="qa-available-list" style="height: 280px; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
            </div>
            
            <div style="border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-surface); overflow: hidden; display: flex; flex-direction: column;">
                <div style="padding: 0.75rem; background: var(--bg-main); font-size: 0.8rem; font-weight: 800; border-bottom: 1px solid var(--border); color: var(--primary);">SELECTED (DRAG TO REORDER)</div>
                <div id="qa-selected-list" style="height: 280px; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
            </div>
        </div>
    `, async () => {
        if (window.tempSelectedStudents.length === 0) return showToast("Select at least one student.", "error");
        
        setLoading('modalSaveBtn', true);
        try {
            const existingGroup = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(window.tempCompId) && String(a.participants?.team_id || '') === String(window.tempTeamId));
            const isGroup = window.tempIsGroup;
            const groupId = isGroup ? (existingGroup.length > 0 ? existingGroup[0].group_id : `GRP_${window.tempCompId}_${window.tempTeamId}_${Date.now()}`) : null;
            
            const hasExistingLeader = existingGroup.some(a => a.is_leader);

            const payload = window.tempSelectedStudents.map((s, index) => ({
                participant_id: s.id,
                competition_id: window.tempCompId,
                group_id: groupId,
                is_leader: isGroup && !hasExistingLeader && index === 0
            }));

            // Validate Student Category Limit
            const limitCfg = await getCategoryLimitConfig();
            if (limitCfg && limitCfg.enabled && !comp.is_group) {
                const targetCatObj = categoriesList.find(c => String(c.id) === String(comp.category_id));
                const isExempt = comp.is_group || comp.is_common || (targetCatObj && targetCatObj.is_general);
                if (!isExempt) {
                    const { data: existingAssigns } = await festQuery(
                        supabaseClient.from('participant_competitions')
                            .select('participant_id, competition_id')
                            .in('participant_id', window.tempSelectedStudents.map(s => s.id))
                    );
                    for (const s of window.tempSelectedStudents) {
                        const check = festosEvaluateStudentCategoryLimit(
                            s.id,
                            compId,
                            window.tempSelectedStudents,
                            competitionsList,
                            categoriesList,
                            existingAssigns || [],
                            limitCfg
                        );
                        if (!check.allowed) {
                            throw new Error(check.message);
                        }
                    }
                }
            }

            const { data, error } = await supabaseClient.from('participant_competitions').insert(festPayload(payload)).select();
            if (error) throw error;
            
            showToast("Students added successfully!", "success");
            closeModal();
            renderAssignOverview();
        } catch (e) {
            showToast(e.message, "error");
        } finally {
            setLoading('modalSaveBtn', false);
        }
    });
    
    renderQAUI();
};

window.renderQAUI = function() {
    const availList = document.getElementById('qa-available-list');
    const selList = document.getElementById('qa-selected-list');
    const slotsEl = document.getElementById('qa-slots-left');
    
    if(!availList || !selList) return;
    
    const slotsLeft = window.tempSlotsLeft - window.tempSelectedStudents.length;
    slotsEl.innerText = window.tempCompLimit > 100 ? 'UNLIMITED' : Math.max(0, slotsLeft);
    slotsEl.style.color = slotsLeft <= 0 ? 'var(--danger)' : 'var(--primary)';

    availList.innerHTML = window.tempAvailableStudents.map(s => {
        const catLabel = categoriesList.find(c => c.id == s.category_id)?.name || 'GEN';
        return `
        <div style="background: var(--bg-main); padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);">
            <div>
                <div style="font-size: 0.8rem; font-weight: 700;">${s.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.unique_id} <span style="background:white; color:var(--text-main); padding: 1px 4px; border-radius:4px; margin-left:4px; border: 1px solid var(--border);">${catLabel}</span></div>
            </div>
            <button class="btn btn-outline" style="min-height: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="qaAdd('${s.id}')" ${slotsLeft <= 0 ? 'disabled' : ''}><i class="fa-solid fa-plus"></i></button>
        </div>
    `}).join('') || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; font-weight:600;">No available students left</div>';

    const existingGroup = window.globalAdminAssignments.filter(a => a.competition_id === window.tempCompId && a.participants?.team_id == window.tempTeamId);
    const hasExistingLeader = existingGroup.some(a => a.is_leader);

    selList.innerHTML = window.tempSelectedStudents.map((s, index) => {
        const isLeader = window.tempIsGroup && !hasExistingLeader && index === 0;
        const leaderBadge = isLeader ? '<span style="margin-left:6px; font-size:0.55rem; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 800;">LEADER</span>' : '';
        const dragIcon = window.tempIsGroup && !hasExistingLeader ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; margin-right: 4px;"></i>` : '';
        const catLabel = categoriesList.find(c => c.id == s.category_id)?.name || 'GEN';
        
        return `
        <div class="qa-draggable" draggable="${window.tempIsGroup && !hasExistingLeader}" data-id="${s.id}" ondragstart="qaDragStart(event, '${s.id}')" ondragover="qaDragOver(event)" ondrop="qaDrop(event, '${s.id}')" ondragend="qaDragEnd(event)" style="background: white; padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--primary); cursor: ${window.tempIsGroup && !hasExistingLeader ? 'grab' : 'default'}; box-shadow: var(--shadow-sm);">
            <div>
                <div style="font-size: 0.8rem; font-weight: 700;">${dragIcon}${s.name} ${leaderBadge}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.unique_id} <span style="background:var(--bg-main); color:var(--text-main); padding: 1px 4px; border-radius:4px; margin-left:4px; border: 1px solid var(--border);">${catLabel}</span></div>
            </div>
            <button class="btn btn-outline" style="min-height: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-color: var(--danger); color: var(--danger);" onclick="qaRemove('${s.id}')"><i class="fa-solid fa-minus"></i></button>
        </div>
    `}).join('') || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; font-weight:600;">No students selected</div>';
};

window.qaAdd = function(id) {
    const slotsLeft = window.tempSlotsLeft - window.tempSelectedStudents.length;
    if(slotsLeft <= 0) return;
    const studentIndex = window.tempAvailableStudents.findIndex(s => s.id === id);
    if(studentIndex > -1) {
        window.tempSelectedStudents.push(window.tempAvailableStudents[studentIndex]);
        window.tempAvailableStudents.splice(studentIndex, 1);
        renderQAUI();
    }
};

window.qaRemove = function(id) {
    const studentIndex = window.tempSelectedStudents.findIndex(s => s.id === id);
    if(studentIndex > -1) {
        window.tempAvailableStudents.push(window.tempSelectedStudents[studentIndex]);
        window.tempSelectedStudents.splice(studentIndex, 1);
        window.tempAvailableStudents.sort((a,b) => a.name.localeCompare(b.name));
        renderQAUI();
    }
};

window.qaDragStart = function(e, id) { e.dataTransfer.setData('text/plain', id); e.target.style.opacity = '0.5'; };
window.qaDragEnd = function(e) { e.target.style.opacity = '1'; document.querySelectorAll('.qa-draggable').forEach(el => el.classList.remove('drag-over')); };
window.qaDragOver = function(e) { e.preventDefault(); const target = e.target.closest('.qa-draggable'); if(target) target.classList.add('drag-over'); };
window.qaDrop = function(e, targetId) {
    e.preventDefault();
    document.querySelectorAll('.qa-draggable').forEach(el => el.classList.remove('drag-over'));
    const draggedId = e.dataTransfer.getData('text/plain');
    if(!draggedId || draggedId === targetId) return;

    const draggedIndex = window.tempSelectedStudents.findIndex(s => s.id === draggedId);
    const targetIndex = window.tempSelectedStudents.findIndex(s => s.id === targetId);
    
    if (draggedIndex > -1 && targetIndex > -1) {
        const item = window.tempSelectedStudents.splice(draggedIndex, 1)[0];
        window.tempSelectedStudents.splice(targetIndex, 0, item);
        renderQAUI(); 
    }
};

// ============================================================================
// ADMIN ASSIGNMENT ENGINE V2: DUAL-VIEW, SEARCH, & ROUTING
// ============================================================================

window.switchAssignView = function(view) {
    document.getElementById('btn-assign-view-list').className = 'btn btn-outline';
    document.getElementById('btn-assign-view-bulk').className = 'btn btn-outline';
    document.getElementById('assign-view-list').style.display = 'none';
    document.getElementById('assign-view-bulk').style.display = 'none';
    
    if (view === 'bulk') {
        document.getElementById('btn-assign-view-bulk').className = 'btn btn-primary';
        document.getElementById('assign-view-bulk').style.display = 'block';
    } else {
        document.getElementById('btn-assign-view-list').className = 'btn btn-primary';
        document.getElementById('assign-view-list').style.display = 'block';
        if (typeof window.renderAssignOverview === 'function') window.renderAssignOverview();
    }
};

// FIX: Ensure ALL required data is loaded before rendering assignments
window.initAssignWorkspace = async function() {
    if (categoriesList.length === 0) { const { data } = await festQuery(supabaseClient.from('categories').select('*')).order('name'); categoriesList = data || []; }
    if (teamsList.length === 0) { const { data } = await festQuery(supabaseClient.from('teams').select('*')).order('name'); teamsList = data || []; }
    if (participantsList.length === 0) { const { data } = await festQuery(supabaseClient.from('participants').select('*')).order('name'); participantsList = data || []; }
    if (competitionsList.length === 0) { const { data } = await festQuery(supabaseClient.from('competitions').select('*, categories(id, name, is_general, allowed_general_categories)')).order('name'); competitionsList = data || []; }
    
    // Populate Overview Filters
    const catSelect = document.getElementById('filter-assign-overview-cat');
    if (catSelect) {
        catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
        categoriesList.forEach(c => { catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    }
    
    const teamSelect = document.getElementById('filter-assign-overview-team');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="all">-- SELECT TEAM TO ENABLE ADDING --</option>';
        teamsList.forEach(t => { teamSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
    }
    
    // Populate Bulk Assigner Category Filter
    const bulkCatSelect = document.getElementById('assignWorkCategory');
    if (bulkCatSelect) {
        bulkCatSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY --</option>';
        categoriesList.forEach(c => {
            bulkCatSelect.innerHTML += `<option value="${c.id}" data-general="${c.is_general}">${c.name} ${c.is_general ? '(GENERAL)' : ''}</option>`;
        });
    }

    const teamFilter = document.getElementById('assignFilterTeam');
    if (teamFilter) {
        teamFilter.innerHTML = '<option value="">All Teams</option>';
        teamsList.forEach(t => teamFilter.innerHTML += `<option value="${t.id}">${t.name}</option>`);
    }

    const workspace = document.getElementById('assignStudentWorkspace');
    if (workspace) workspace.style.display = 'none';
    const workComp = document.getElementById('assignWorkComp');
    if (workComp) {
        workComp.innerHTML = '<option value="">-- CHOOSE COMPETITION FIRST --</option>';
        workComp.disabled = true;
    }

    if (typeof window.switchAssignView === 'function') window.switchAssignView('list');
};

// FIX: Search and display ALL competitions dynamically in the Bulk Assigner
window.currentWorkspaceComps = [];
window.loadAssignWorkspaceCompetitions = async function() {
    const categoryId = document.getElementById('assignWorkCategory').value;
    const compSelect = document.getElementById('assignWorkComp');
    document.getElementById('assignStudentWorkspace').style.display = 'none';
    
    const searchInput = document.getElementById('assignWorkCompSearch');
    if (searchInput) searchInput.value = ''; // Reset search
    
    if (!categoryId) {
        compSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY FIRST --</option>';
        compSelect.disabled = true;
        currentWorkspaceComps = [];
        return;
    }

    // Pull instantly from memory rather than querying the DB, ensuring all statuses are shown
    currentWorkspaceComps = competitionsList.filter(c => String(c.category_id) === String(categoryId));
    window.renderAssignWorkspaceDropdown(currentWorkspaceComps);
};

window.renderAssignWorkspaceDropdown = function(comps) {
    const compSelect = document.getElementById('assignWorkComp');
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION TO MANAGE --</option>';
    comps.forEach(c => {
        compSelect.innerHTML += `<option value="${c.id}" data-limit="${c.max_participants}" data-is-group="${c.is_group}">${c.name}</option>`;
    });
    compSelect.disabled = false;
};

window.filterAssignWorkspaceDropdown = function() {
    const search = document.getElementById('assignWorkCompSearch').value.toLowerCase();
    const filtered = currentWorkspaceComps.filter(c => c.name.toLowerCase().includes(search));
    window.renderAssignWorkspaceDropdown(filtered);
};


// FIX: Overview Renderer - Show ALL competitions and secure drag-and-drop IDs
window.renderAssignOverview = async function() {
    const tbody = document.getElementById('assign-overview-tbody');
    if (!tbody) return;
    
    const search = document.getElementById('search-assign-overview').value.toLowerCase();
    const catFilter = document.getElementById('filter-assign-overview-cat').value;
    const teamFilter = document.getElementById('filter-assign-overview-team').value;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Live Assignments...</td></tr>';
    
    // Fetch fresh global assignments memory mapping
    const { data: assigns } = await festQuery(supabaseClient.from('participant_competitions').select('*, participants(name, unique_id, category_id, team_id, teams(name), categories(name))'));
    window.globalAdminAssignments = assigns || [];

    tbody.innerHTML = '';
    
    // SHOW ALL COMPETITIONS
    const eligibleComps = competitionsList;

    if (eligibleComps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600;">NO COMPETITIONS AVAILABLE.</td></tr>';
        return;
    }

    eligibleComps.forEach(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        if (catFilter !== 'all' && String(comp.category_id) !== String(catFilter)) return;
        if (search && !comp.name.toLowerCase().includes(search)) return;

        let enrolled = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(comp.id));
        
        if (teamFilter !== 'all') {
            enrolled = enrolled.filter(a => String(a.participants?.team_id) === String(teamFilter));
        }
        
        enrolled.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0));
        
        let studentsHtml = '';
        if (enrolled.length === 0) {
            studentsHtml = '<span style="color: var(--warning); font-size: 0.8rem; font-weight: 700; background: var(--warning-light); padding: 4px 8px; border-radius: 6px;">NO STUDENTS ENROLLED</span>';
        } else {
            studentsHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">';
            enrolled.forEach((a, index) => {
                const student = a.participants || participantsList.find(p => String(p.id) === String(a.participant_id));
                if (!student) return;
                
                const pId = a.participant_id; // Absolute safe ID pull
                
                let leaderBadge = '';
                if (comp.is_group && index === 0 && teamFilter !== 'all') {
                    leaderBadge = `<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; display: inline-flex; align-items: center; margin-right: 6px;">LEADER</span>`;
                }
                
                // Drag and drop is ONLY enabled if filtered down to a specific Team
                const dragProps = (comp.is_group && teamFilter !== 'all')
                    ? `draggable="true" class="draggable-item" data-comp-id="${comp.id}" data-student-id="${pId}" ondragstart="handleDragStart(event, '${comp.id}', '${pId}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${comp.id}', '${pId}')" ondragend="handleDragEnd(event)"` 
                    : '';
                const dragIcon = (comp.is_group && teamFilter !== 'all') ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; cursor: grab; margin-right: 8px;"></i>` : '';

                studentsHtml += `
                    <div ${dragProps} style="background: var(--bg-surface); border: 1px solid var(--border); padding: 0.5rem 0.75rem; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); width: 100%;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap;">
                            ${dragIcon}
                            ${leaderBadge}
                            <strong style="color: var(--text-main); font-size: 0.95rem;">${student.name}</strong>
                            <span style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; margin-left: 4px;">${student.unique_id}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-main); padding: 2px 6px; border-radius: 4px; margin-left: 4px; border: 1px solid var(--border);">${student.teams?.name || 'IND'}</span>
                        </div>
                        <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; min-height: auto; border-color: var(--danger); color: var(--danger); border-radius: 6px; width: auto; flex-shrink: 0;" onclick="quickRemoveStudent('${comp.id}', '${pId}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            });
            studentsHtml += '</div>';
        }

        let addBtn = '';
        if (teamFilter === 'all') {
            addBtn = `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem; text-align: center; display: block; white-space: normal;">SELECT TEAM IN FILTER TO ADD</span>`;
        } else {
            const isFull = comp.max_participants > 0 && enrolled.length >= comp.max_participants;
            addBtn = isFull 
                ? `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem; text-align: center; display: block;">TEAM LIMIT REACHED</span>`
                : `<button class="btn btn-primary" style="padding: 0.6rem 1rem; width: 100%; justify-content: center;" onclick="openQuickAddModal('${comp.id}', '${teamFilter}')"><i class="fa-solid fa-plus"></i> ADD PARTICIPANTS</button>`;
        }

        let pubBadge = '';
        if (comp.status === 'published' || comp.status === 'judgement_complete') {
            pubBadge = `<br><span class="badge badge-success" style="font-size: 0.65rem; margin-top: 4px;"><i class="fa-solid fa-check-double"></i> COMPLETED</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td data-label="COMPETITION" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; vertical-align: top;">
                    ${comp.name} <br><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px; display: inline-block;">(MAX: ${comp.max_participants} PER TEAM)</span>
                    ${pubBadge}
                    ${comp.is_group && enrolled.length > 0 && teamFilter !== 'all' ? `<br><span style="font-size: 0.65rem; color: var(--primary); font-weight: 800; margin-top: 4px; display: inline-block;"><i class="fa-solid fa-hand-pointer"></i> DRAG TO ARRANGE LEADER</span>` : ''}
                </td>
                <td data-label="CATEGORY" style="vertical-align: top;"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="ASSIGNED STUDENTS" style="width: 50%; vertical-align: top;">${studentsHtml}</td>
                <td data-label="ACTIONS" style="min-width: 150px; vertical-align: top;">${addBtn}</td>
            </tr>
        `;
    });
};

// FIX: Drag logic secured string comparison
window.handleDrop = async function(e, targetCompId, targetStudentId) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    const dataStr = e.dataTransfer.getData('text/plain');
    if(!dataStr) return;
    
    const {compId, studentId: draggedStudentId} = JSON.parse(dataStr);
    if(compId !== targetCompId || draggedStudentId === targetStudentId) return;
    
    const targetElement = e.target.closest('.draggable-item');
    const container = targetElement.parentNode;
    const draggedElement = document.querySelector(`[data-student-id="${draggedStudentId}"][data-comp-id="${compId}"]`);
    
    if(!draggedElement || !targetElement) return;

    // Visual Reorder
    const allItems = Array.from(container.children);
    const draggedIndex = allItems.indexOf(draggedElement);
    const targetIndex = allItems.indexOf(targetElement);
    
    if (draggedIndex < targetIndex) targetElement.after(draggedElement);
    else targetElement.before(draggedElement);
    
    const newLeaderId = container.firstElementChild.getAttribute('data-student-id');
    const teamFilter = document.getElementById('filter-assign-overview-team').value;
    
    // Instantly Update Local State UI
    let myEnrolled = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(compId) && String(a.participants?.team_id) === String(teamFilter));
    myEnrolled.forEach(a => { a.is_leader = (String(a.participant_id) === String(newLeaderId)); });
    window.renderAssignOverview();
    
    // Async background save
    try {
        const updates = myEnrolled.map(a => {
            return supabaseClient.from('participant_competitions').update({ is_leader: a.is_leader }).eq('id', a.id);
        });
        await Promise.all(updates);
    } catch(err) {
        showToast("Error saving order: " + err.message, "error");
    }
};

// ROUTING: Connects Vacancy Audit directly to the tools
window.routeToAdminAssignment = function(catId, compId) {
    document.getElementById('vacancyModal').classList.remove('show');
    
    document.getElementById('route-cat-id').value = catId;
    document.getElementById('route-comp-id').value = compId;
    
    document.getElementById('assignModeModal').classList.add('show');
};

window.executeRouteToAdminAssignment = async function(mode) {
    document.getElementById('assignModeModal').classList.remove('show');
    
    const catId = document.getElementById('route-cat-id').value;
    const compId = document.getElementById('route-comp-id').value;
    
    switchTab('assignments');
    
    if (mode === 'bulk') {
        if (typeof window.switchAssignView === 'function') window.switchAssignView('bulk');
        
        const catSelect = document.getElementById('assignWorkCategory');
        if (catSelect) {
            catSelect.value = catId;
            await window.loadAssignWorkspaceCompetitions();
        }
        
        setTimeout(async () => {
            const compSelect = document.getElementById('assignWorkComp');
            if (compSelect) {
                compSelect.value = compId;
                await window.loadAssignWorkspaceStudents();
            }
        }, 300);
        
    } else {
        if (typeof window.switchAssignView === 'function') window.switchAssignView('list');
        
        const catSelect = document.getElementById('filter-assign-overview-cat');
        if (catSelect) {
            catSelect.value = catId;
            window.renderAssignOverview();
        }
        
        setTimeout(() => {
            const teamFilter = document.getElementById('filter-assign-overview-team').value;
            if (teamFilter === 'all') {
                showToast('Please select a Team in the filter first to enable Quick Add', 'warning');
                document.getElementById('filter-assign-overview-team').style.boxShadow = '0 0 0 3px var(--primary-ring)';
                setTimeout(() => document.getElementById('filter-assign-overview-team').style.boxShadow = 'none', 2500);
            } else {
                window.openQuickAddModal(compId, teamFilter);
            }
        }, 400);
    }
};

// Master Admin Self-Service Password & Credential Changer with History
window.changeMasterAdminCredentials = async function(newUsername, newPassword) {
    const activeUser = JSON.parse(localStorage.getItem('festUser'));
    if (!activeUser || !activeUser.id) return showToast('User session not found', 'error');

    try {
        const oldPwd = activeUser.password_hash;
        let history = activeUser.password_history || [];
        if (oldPwd && !history.some(h => (h.password || h) === oldPwd)) {
            history.unshift({ password: oldPwd, changed_at: new Date().toISOString() });
        }

        const { error } = await supabaseClient.from('users').update({
            username: newUsername || activeUser.username,
            password_hash: newPassword || activeUser.password_hash,
            password_history: history
        }).eq('id', activeUser.id);

        if (error) throw error;

        activeUser.username = newUsername || activeUser.username;
        activeUser.password_hash = newPassword || activeUser.password_hash;
        activeUser.password_history = history;
        localStorage.setItem('festUser', JSON.stringify(activeUser));

        if (typeof festosLogger !== 'undefined') {
            festosLogger.log('AUTH', `Master Admin "${activeUser.username}" changed their own password`, { userId: activeUser.id }, 'INFO');
        }

        showToast('Your credentials have been updated successfully!', 'success');
    } catch (e) {
        showToast('Failed to update credentials: ' + e.message, 'error');
    }
};

// =========================================================================
// UNIVERSAL NOTIFICATION CENTER & APK DISPATCH ENGINE
// =========================================================================

let globalFestivalNotifications = [];
let currentNotificationFilter = 'all';

window.festosDownloadApkDirect = function(targetUrl) {
    let url = targetUrl && targetUrl !== '#' && targetUrl.trim() ? targetUrl : '/VIBRANIUM.apk';
    if (!url.startsWith('http') && !url.startsWith('/')) {
        url = '/' + url;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'VIBRANIUM.apk';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        try { a.remove(); } catch(e) {}
    }, 250);
    if (typeof showToast === 'function') {
        showToast('Downloading VIBRANIUM.apk...', 'success');
    }
};

async function fetchFestivalNotifications(showToastFeedback = false) {
    const client = window.supabaseClient || window.festosSupabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const activeFestId = (typeof festosAuth !== 'undefined' && festosAuth.getCurrentFestId) ? 
        festosAuth.getCurrentFestId() : (localStorage.getItem('festos_active_fest_id') || 'all');

    let broadcasts = [];

    if (client) {
        try {
            // 1. Fetch from broadcasts table
            const { data, error } = await client.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(40);
            if (!error && Array.isArray(data) && data.length > 0) {
                broadcasts = data;
            } else {
                // Fallback to active broadcasts in settings
                const { data: sRow } = await client.from('settings').select('value').eq('id', 'system_broadcast_active').maybeSingle();
                if (sRow && Array.isArray(sRow.value)) {
                    broadcasts = sRow.value;
                }
            }
        } catch (e) {
            console.warn('Supabase broadcast fetch error:', e);
        }
    }

    // 2. Fallback to cached broadcasts from localStorage or festosBroadcasts
    if (!broadcasts || broadcasts.length === 0) {
        try {
            const cached = localStorage.getItem('festos_cached_broadcasts');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) broadcasts = parsed;
            }
        } catch (err) {}
    }

    if ((!broadcasts || broadcasts.length === 0) && window.festosBroadcasts && Array.isArray(window.festosBroadcasts.activeBroadcasts)) {
        broadcasts = window.festosBroadcasts.activeBroadcasts;
    }

    // Filter for this festival (exclude deleted/inactive)
    const filtered = broadcasts.filter(b => {
        if (!b || b.is_active === false) return false;
        if (!b.target_fest_id || b.target_fest_id === 'all' || b.target_fest_id === activeFestId) return true;
        if (Array.isArray(b.allowed_fests) && (b.allowed_fests.includes('*') || b.allowed_fests.includes(activeFestId))) return true;
        return false;
    });

    globalFestivalNotifications = filtered;
    updateNotificationBadge();
    renderNotificationsList();

    // Trigger WhatsApp-style native heads-up notification for newly arrived alerts or edited alerts
    const prevSeenIds = JSON.parse(localStorage.getItem('festos_seen_notif_ids') || '[]');
    const newArrivals = filtered.filter(b => !prevSeenIds.includes(b.id) && !isNotificationRead(b));

    if (newArrivals.length > 0 && prevSeenIds.length > 0) {
        newArrivals.forEach(n => {
            if (typeof window.showAppNotification === 'function') {
                window.showAppNotification(n.title || 'VIBRANIUM Alert', n.message || 'New festival announcement received', { id: n.id });
            }
        });
    }
    const updatedSeen = [...new Set([...prevSeenIds, ...filtered.map(b => b.id)])];
    try { localStorage.setItem('festos_seen_notif_ids', JSON.stringify(updatedSeen)); } catch(e) {}

    if (showToastFeedback && typeof showToast === 'function') {
        showToast('Notifications synchronized!', 'info');
    }
}

function getReadNotifications() {
    try {
        const val = localStorage.getItem('festos_read_notifications');
        return val ? JSON.parse(val) : [];
    } catch(e) { return []; }
}

function isNotificationRead(n) {
    if (!n || !n.id) return false;
    const readList = getReadNotifications();
    const found = readList.find(item => (typeof item === 'string' ? item === n.id : (item && item.id === n.id)));
    if (!found) return false;

    // If notification has been edited by Super Admin (version incremented or updated_at newer than read_at), it becomes unread!
    if (typeof found === 'object') {
        const notifVersion = n.version || 1;
        if (found.version && notifVersion > found.version) return false;
        if (found.read_at && n.updated_at) {
            return new Date(found.read_at).getTime() >= new Date(n.updated_at).getTime();
        }
    }
    return true;
}

function updateNotificationBadge() {
    const unreadCount = globalFestivalNotifications.filter(n => !isNotificationRead(n)).length;

    const badge = document.getElementById('header-notify-badge');
    const drawerPill = document.getElementById('drawer-unread-count-pill');

    if (badge) {
        if (unreadCount > 0) {
            badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (drawerPill) {
        if (unreadCount > 0) {
            drawerPill.innerText = `${unreadCount} Unread`;
            drawerPill.style.display = 'inline-block';
        } else {
            drawerPill.style.display = 'none';
        }
    }
}

function toggleNotificationCenter(open = null) {
    const drawer = document.getElementById('notificationCenterDrawer');
    const backdrop = document.getElementById('notificationDrawerBackdrop');
    if (!drawer || !backdrop) return;

    const isOpen = drawer.style.right === '0px';
    const shouldOpen = open !== null ? open : !isOpen;

    if (shouldOpen) {
        backdrop.style.display = 'block';
        setTimeout(() => { backdrop.style.opacity = '1'; }, 10);
        drawer.style.right = '0px';
        fetchFestivalNotifications();
    } else {
        backdrop.style.opacity = '0';
        drawer.style.right = '-460px';
        setTimeout(() => { backdrop.style.display = 'none'; }, 250);
    }
}

function filterNotificationView(cat) {
    currentNotificationFilter = cat;
    document.querySelectorAll('.notify-filter-tab').forEach(tab => {
        const isMatch = tab.dataset.filter === cat;
        tab.classList.toggle('active', isMatch);
        tab.style.background = isMatch ? 'var(--primary)' : 'white';
        tab.style.color = isMatch ? 'white' : (tab.dataset.filter === 'apk' ? '#16A34A' : 'var(--text-main)');
    });
    renderNotificationsList();
}

function renderNotificationsList() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    let list = globalFestivalNotifications;

    if (currentNotificationFilter === 'unread') {
        list = list.filter(n => !isNotificationRead(n));
    } else if (currentNotificationFilter === 'apk') {
        list = list.filter(n => n.is_apk || n.type === 'apk');
    }
    // When currentNotificationFilter === 'all', show ALL notifications (both unread and read)!

    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 3.5rem 1rem;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-main); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; font-size: 1.5rem; color: #94A3B8;">
                    <i class="fa-solid fa-bell-slash"></i>
                </div>
                <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">All Caught Up!</h4>
                <p style="font-size: 0.82rem; margin: 0;">No notifications match the selected filter.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    list.forEach(n => {
        const isRead = isNotificationRead(n);
        const isApk = n.is_apk || n.type === 'apk';
        const card = document.createElement('div');

        // Card Border Accent & Styling
        card.style.cssText = `
            background: ${isApk ? '#F0FDF4' : (isRead ? '#FFFFFF' : '#F8FAFC')};
            border: 1px solid ${isApk ? '#BBF7D0' : (isRead ? 'var(--border)' : '#CBD5E1')};
            border-left: 4px solid ${isApk ? '#16A34A' : (n.severity === 'danger' ? '#EF4444' : (n.severity === 'warning' ? '#F59E0B' : 'var(--primary)'))};
            border-radius: var(--radius-md);
            padding: 1.1rem;
            box-shadow: var(--shadow-sm);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            transition: transform 0.2s ease;
        `;

        // APK Download Button Section
        let apkDownloadHtml = '';
        if (isApk) {
            const cleanApkUrl = (n.apk_url && n.apk_url !== '#' && n.apk_url.trim()) ? 
                (n.apk_url.startsWith('http') || n.apk_url.startsWith('/') ? n.apk_url : ('/' + n.apk_url)) : 
                '/VIBRANIUM.apk';
            const versionStr = n.apk_version || 'Latest Build';
            apkDownloadHtml = `
                <div style="background: white; border: 1.5px solid #86EFAC; border-radius: 10px; padding: 0.85rem; margin-top: 0.45rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; box-shadow: 0 2px 6px rgba(22, 163, 74, 0.08);">
                    <div>
                        <div style="font-weight: 800; font-size: 0.92rem; color: #166534; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-brands fa-android" style="font-size: 1.25rem; color: #16A34A;"></i> Android App APK ${versionStr}
                        </div>
                        <div style="font-size: 0.76rem; color: #15803D; margin-top: 2px;">Official Mobile App Build &bull; High-speed direct install</div>
                    </div>
                    <button type="button" class="btn btn-success" style="padding: 0.5rem 1.1rem; font-size: 0.85rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; background: #16A34A; color: white; border: none; box-shadow: 0 3px 8px rgba(22,163,74,0.3);" onclick="festosDownloadApkDirect('${cleanApkUrl}'); markNotificationAsRead('${n.id}'); event.stopPropagation();">
                        <i class="fa-solid fa-cloud-arrow-down"></i> Download APK (${versionStr})
                    </button>
                </div>
            `;
        }

        // Generic File Attachment Section
        let fileAttachHtml = '';
        if (!isApk && n.attachment && (n.attachment.dataUrl || n.attachment.data || n.attachment.url)) {
            const fileUrl = n.attachment.dataUrl || n.attachment.data || n.attachment.url;
            const fileName = n.attachment.name || 'Attached Document';
            fileAttachHtml = `
                <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem 0.85rem; margin-top: 0.35rem; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <i class="fa-solid fa-paperclip" style="color: var(--primary);"></i> ${fileName}
                    </div>
                    <a href="${fileUrl}" download="${fileName}" class="btn btn-outline" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; text-decoration: none;" onclick="markNotificationAsRead('${n.id}')">
                        <i class="fa-solid fa-download"></i> Download
                    </a>
                </div>
            `;
        }

        const timeStr = n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span class="badge" style="font-size: 0.68rem; font-weight: 800; background: ${isApk ? '#DCFCE7' : 'var(--bg-main)'}; color: ${isApk ? '#166534' : 'var(--text-main)'};">
                        ${isApk ? '<i class="fa-brands fa-android"></i> APK RELEASE' : (n.severity ? n.severity.toUpperCase() : 'NOTICE')}
                    </span>
                    ${!isRead ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444; display: inline-block;" title="Unread Notice"></span>' : ''}
                    ${n.version && n.version > 1 ? '<span class="badge badge-warning" style="font-size: 0.65rem; padding: 2px 6px;">EDITED</span>' : ''}
                </div>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${timeStr}</span>
            </div>

            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">
                ${n.title}
            </h4>

            <p style="font-size: 0.82rem; color: var(--text-main); line-height: 1.45; margin: 0; white-space: pre-line;">
                ${n.message}
            </p>

            ${apkDownloadHtml}
            ${fileAttachHtml}

            <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                ${!isRead ? `
                    <button onclick="markNotificationAsRead('${n.id}')" style="background: none; border: none; font-size: 0.72rem; font-weight: 700; color: var(--primary); cursor: pointer; padding: 0;">
                        <i class="fa-solid fa-check"></i> Mark as read
                    </button>
                ` : `
                    <span style="font-size: 0.72rem; color: #94A3B8;"><i class="fa-solid fa-check-double"></i> Read (Available until deleted by admin)</span>
                `}
            </div>
        `;

        container.appendChild(card);
    });
}

function markNotificationAsRead(id) {
    let readList = getReadNotifications();
    const notif = globalFestivalNotifications.find(n => n.id === id);
    const version = notif ? (notif.version || 1) : 1;
    const nowIso = new Date().toISOString();

    readList = readList.filter(item => (typeof item === 'string' ? item !== id : (item && item.id !== id)));
    readList.push({ id, read_at: nowIso, version });

    try { localStorage.setItem('festos_read_notifications', JSON.stringify(readList)); } catch(e) {}
    updateNotificationBadge();
    renderNotificationsList();
}

function markAllNotificationsAsRead() {
    const nowIso = new Date().toISOString();
    const newReadList = globalFestivalNotifications.map(n => ({
        id: n.id,
        read_at: nowIso,
        version: n.version || 1
    }));
    try { localStorage.setItem('festos_read_notifications', JSON.stringify(newReadList)); } catch(e) {}
    updateNotificationBadge();
    renderNotificationsList();
    if (typeof showToast === 'function') showToast('All notifications marked as read', 'info');
}

// Auto-initialize on dashboard boot
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            fetchFestivalNotifications();
            // Poll for newly dispatched Super Admin notifications every 60 seconds
            setInterval(() => fetchFestivalNotifications(), 60000);
        }, 800);
    });
}


window.syncWebsiteWithFestivalIdentity = async function() {
    const fid = getActiveFestId();
    let festName = 'Festival';
    let festLogo = '';
    if (window.availableFests) {
        const f = window.availableFests.find(x => x.id === fid);
        if (f) { festName = f.name || 'Festival'; festLogo = f.logo || ''; }
    }
    if (festName === 'Festival' && typeof festosBranding !== 'undefined' && festosBranding.getDetails) {
        const d = festosBranding.getDetails(fid);
        if (d && d.name) festName = d.name;
    }

    if (document.getElementById('pg-hero-title')) {
        document.getElementById('pg-hero-title').value = 'Welcome to ' + festName;
    }
    if (document.getElementById('pg-about-title')) {
        document.getElementById('pg-about-title').value = 'The ' + festName + ' Championship';
    }
    if (document.getElementById('pg-content-desc')) {
        document.getElementById('pg-content-desc').value = festName + ' powers competitive events across multiple stages. Built for speed, transparency, and accuracy in live festival scorekeeping.';
    }

    showToast('Auto-synced homepage content with ' + festName + ' branding!', 'success');
};
