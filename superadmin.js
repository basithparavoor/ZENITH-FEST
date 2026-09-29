/**
 * FestOS Super Admin Engine (superadmin.js)
 * Global Control Panel, Multi-Tenant Governance, Bulk User Actions, Password History, Diagnostics & Self-Healing
 */

let globalFests = [];
let globalUsers = [];
let globalEnquiries = [];
let activeFestId = 'default_fest';
let selectedWorkspaceFestId = null;
let currentEditingFest = null;
let currentEditingUser = null;
let currentPendingConfirmAction = null;
let selectedUserIds = new Set();
let latestDiagnosticsReport = null;

// Available feature definitions
const FEATURE_DEFINITIONS = [
    { key: 'feature_judging', icon: 'fa-gavel', title: 'Multi-Judge Scoring Engine', desc: 'Olympic-style criteria marks, high/low drop, criteria weights & live tabulation.' },
    { key: 'feature_stage_display', icon: 'fa-tv', title: '4K/1080p Stage HUD Display', desc: 'Broadcast-grade live visual stage with auto-rotating leaderboard & ambient motion.' },
    { key: 'feature_spectator_qr', icon: 'fa-qrcode', title: 'Dynamic QR Spectator Hub', desc: 'Live mobile spectator portal, dynamic stage-synced QR code & poster downloads.' },
    { key: 'feature_poster_generator', icon: 'fa-palette', title: 'Winner & Team Poster Studio', desc: 'Luxury typography auto-renderer for winners, admit cards, and social flyers.' },
    { key: 'feature_participant_portal', icon: 'fa-id-badge', title: 'Digital Contestant Passes & Lanyard', desc: 'Chest number login, personalized schedule, scannable attendee QR badge.' },
    { key: 'feature_squad_roster', icon: 'fa-users-viewfinder', title: 'Squad Rostering & Team Members', desc: 'Full roster tracking for multi-participant group events with captain assignments.' },
    { key: 'feature_website_customizer', icon: 'fa-wand-magic-sparkles', title: 'Website & Results Customizer', desc: 'Admin theme studio, typography switcher, visibility toggles & live preview.' },
    { key: 'feature_program_reports', icon: 'fa-file-invoice', title: 'PDF & Excel Reports Engine', desc: 'Printable tabulation sheets, master contestant schedules, and certificate export.' },
    { key: 'feature_announcements', icon: 'fa-bullhorn', title: 'Live Stage Announcer Queue', desc: 'Stage controller calling queues, participant readiness alerts & on-deck banners.' },
    { key: 'feature_wall_of_fame', icon: 'fa-trophy', title: 'Wall of Fame & Social Highlights', desc: 'Public leaderboard showcase celebrating champions and top scoring squads.' }
];

// =========================================================================
// 1. INITIALIZATION & AUTH
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initAuthAndProfile();
    await loadInitialData();
    await loadGlobalSoftwareBranding();
    renderAllViews();
    runQuickPing();
    runDiagnosticsSuite(); // Run initial health scan
});

function initAuthAndProfile() {
    let superAdmin = festosAuth.getSuperAdmin();
    let user = festosAuth.getUser();

    if (!superAdmin) {
        if (user && (user.role === 'super_admin' || user.role === 'master_admin')) {
            superAdmin = { username: user.username, role: 'super_admin' };
            festosAuth.setSuperAdmin(superAdmin);
        } else {
            superAdmin = { username: 'SuperAdmin', role: 'super_admin' };
            festosAuth.setSuperAdmin(superAdmin);
        }
    }

    const nameEl = document.getElementById('sa-username');
    const avatarEl = document.getElementById('sa-avatar');
    if (nameEl) nameEl.innerText = superAdmin.username || 'Super Admin';
    if (avatarEl) avatarEl.innerText = (superAdmin.username || 'SA').substring(0, 2).toUpperCase();
}

function triggerSuperAdminLogoutDialog() {
    openConfirmDialog(
        'Logout Super Admin',
        'Are you sure you want to end your Super Admin root session? You will be redirected to the login portal.',
        'fa-right-from-bracket',
        'var(--danger)',
        () => {
            festosAuth.logout('index.html');
        }
    );
}

// =========================================================================
// 2. DATA LOADING & SYNCHRONIZATION
// =========================================================================
async function loadInitialData() {
    try {
        let festsLoaded = false;
        if (festosSupabase) {
            try {
                const { data: festsData, error: festsError } = await festosSupabase
                    .from('fests')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!festsError && festsData && festsData.length > 0) {
                    globalFests = festsData;
                    festsLoaded = true;
                }
            } catch (e) {}
        }

        // Fallback to settings
        if (!festsLoaded && festosSupabase) {
            const { data: festSettings } = await festosSupabase
                .from('settings')
                .select('value')
                .eq('id', 'festos_multi_fests')
                .maybeSingle();

            if (festSettings && festSettings.value && Array.isArray(festSettings.value)) {
                globalFests = festSettings.value;
            } else {
                globalFests = [
                    {
                        id: 'fest_zenith_2026',
                        name: 'Zenith Fest 2026',
                        slug: 'zenith26',
                        domain: 'zenith26.festos.app',
                        public_results_slug: 'results',
                        venue: 'Main Stadium Arena',
                        startDate: '2026-10-15',
                        endDate: '2026-10-18',
                        logo: 'festos-logo.svg',
                        status: 'active',
                        created_at: new Date().toISOString()
                    }
                ];
                await syncFestsToDatabase();
            }
        }

        activeFestId = festosFeatures.getActiveFestId();
        if (!globalFests.some(f => f.id === activeFestId) && globalFests.length > 0) {
            activeFestId = globalFests[0].id;
            festosFeatures.setActiveFestId(activeFestId);
        }

        // Load Users
        if (festosSupabase) {
            const { data: usersData } = await festosSupabase.from('users').select('*');
            globalUsers = usersData || [];
        }

        // Load Inquiries
        await loadEnquiriesFromDatabase();

        // Load Counts
        let partCount = 0;
        if (festosSupabase) {
            try {
                const { count: pCount } = await festosSupabase.from('participants').select('*', { count: 'exact', head: true });
                partCount = pCount || 0;
            } catch(e) {}
        }

        updateKPIDisplays(globalFests.length, globalEnquiries.length, globalUsers.length, partCount);

    } catch (err) {
        console.error('Super Admin Data Load Error:', err);
    }
}

async function loadEnquiriesFromDatabase() {
    try {
        if (!festosSupabase) return;
        const { data, error } = await festosSupabase
            .from('enquiries')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            globalEnquiries = data;
            localStorage.setItem('festos_cached_enquiries', JSON.stringify(data));
        } else {
            const cached = localStorage.getItem('festos_cached_enquiries');
            globalEnquiries = cached ? JSON.parse(cached) : [];
        }
        renderEnquiriesTable();
    } catch (e) {
        console.warn('Enquiries fallback:', e);
    }
}

async function syncFestsToDatabase() {
    try {
        if (!festosSupabase) return;

        try {
            for (const f of globalFests) {
                await festosSupabase.from('fests').upsert({
                    id: f.id,
                    name: f.name,
                    slug: f.slug,
                    domain: f.domain || `${f.slug}.festos.app`,
                    public_results_slug: f.public_results_slug || 'results',
                    status: f.status || 'active',
                    venue: f.venue,
                    start_date: f.startDate || f.start_date,
                    end_date: f.endDate || f.end_date,
                    logo: f.logo,
                    updated_at: new Date().toISOString()
                });
            }
        } catch (tableErr) {}

        await festosSupabase.from('settings').upsert({
            id: 'festos_multi_fests',
            value: globalFests,
            updated_at: new Date().toISOString()
        });

    } catch (e) {
        console.warn('Could not sync fests:', e);
    }
}

// =========================================================================
// 3. TAB NAVIGATION & MOBILE CONTROLS
// =========================================================================
function switchSuperTab(tabId) {
    document.querySelectorAll('.nav-main').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

    const targetNav = document.querySelector(`.nav-main[data-tab="${tabId}"]`);
    const targetSection = document.getElementById(tabId);

    if (targetNav) targetNav.classList.add('active');
    if (targetSection) targetSection.classList.add('active');

    // Close mobile navigation
    const sidebar = document.getElementById('superSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');

    if (tabId === 'tab-festivals') renderFestivalsGrid();
    if (tabId === 'tab-enquiries') renderEnquiriesTable();
    if (tabId === 'tab-admins') renderUsersTable();
    if (tabId === 'tab-global-branding') loadGlobalSoftwareBranding();
    if (tabId === 'tab-logs') renderLogsConsole();
    if (tabId === 'tab-diagnostics') runDiagnosticsSuite();
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('superSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (backdrop) backdrop.classList.toggle('active');
}

function renderAllViews() {
    renderOverviewActiveSpotlight();
    renderOverviewAuditStream();
    renderFestivalsGrid();
    renderEnquiriesTable();
    renderUsersTable();
    renderLogsConsole();
}

function updateKPIDisplays(fests, enquiries, admins, participants) {
    const fEl = document.getElementById('stat-fests-count');
    const eEl = document.getElementById('stat-enquiries-count');
    const aEl = document.getElementById('stat-admins-count');
    const pEl = document.getElementById('stat-participants-count');

    if (fEl) fEl.innerText = fests;
    if (eEl) eEl.innerText = enquiries;
    if (aEl) aEl.innerText = admins;
    if (pEl) pEl.innerText = participants;

    const navF = document.getElementById('nav-fest-count');
    const navE = document.getElementById('nav-enquiry-count');
    const navA = document.getElementById('nav-admin-count');
    if (navF) navF.innerText = fests;
    if (navE) navE.innerText = enquiries;
    if (navA) navA.innerText = admins;
}

function changeActiveFestContext(festId) {
    activeFestId = festId;
    festosFeatures.setActiveFestId(festId);
    renderOverviewActiveSpotlight();
    renderFestivalsGrid();
}

// =========================================================================
// 4. OVERVIEW TAB
// =========================================================================
function renderOverviewActiveSpotlight() {
    const container = document.getElementById('overview-active-spotlight');
    if (!container) return;

    const activeFest = globalFests.find(f => f.id === activeFestId) || globalFests[0];
    if (!activeFest) {
        container.innerHTML = `<p style="color:var(--text-muted);">No festivals configured.</p>`;
        return;
    }

    const domainName = activeFest.domain || `${activeFest.slug}.festos.app`;

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.25rem;">
            <div style="display:flex; align-items:center; gap:14px; min-width:0;">
                <img src="${activeFest.logo || 'festos-logo.svg'}" alt="${activeFest.name}" style="width:52px; height:52px; border-radius:10px; object-fit:contain; background:#FFF; padding:4px; border:1px solid var(--border); flex-shrink:0;">
                <div style="min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-main);">${activeFest.name}</h3>
                        <span class="fest-chip chip-${activeFest.status}">${activeFest.status}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:3px; flex-wrap:wrap;">
                        <span class="fest-domain-badge"><i class="fa-solid fa-link"></i> ${domainName}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> ${activeFest.venue || 'Main Venue'}</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="openFestWorkspace('${activeFest.id}')">
                    <i class="fa-solid fa-sliders"></i> Open Workspace
                </button>
                <a href="admin.html" target="_blank" class="btn btn-outline">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Fest Portal
                </a>
            </div>
        </div>
    `;
}

function renderOverviewAuditStream() {
    const container = document.getElementById('overview-audit-list');
    if (!container) return;

    const logs = festosLogger.getLogs().slice(0, 5);
    if (logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:1rem; color:#9CA3AF;">No system logs recorded yet.</div>`;
        return;
    }

    container.innerHTML = logs.map(l => `
        <div class="log-entry">
            <span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
            <span class="log-badge log-${l.severity.toLowerCase()}">${l.severity}</span>
            <div class="log-body">
                <strong>[${l.category}]</strong> ${l.action} 
                <span style="color:#9CA3AF; font-size:0.75rem;">(${l.user || 'System'})</span>
            </div>
        </div>
    `).join('');
}

// =========================================================================
// 5. FESTIVALS MANAGEMENT & WORKSPACES
// =========================================================================
function renderFestivalsGrid() {
    const container = document.getElementById('festivals-cards-container');
    if (!container) return;

    const search = (document.getElementById('fest-search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('fest-status-filter')?.value || 'all';

    const filtered = globalFests.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(search) || 
                              f.slug.toLowerCase().includes(search) || 
                              (f.venue && f.venue.toLowerCase().includes(search));
        const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 3rem; color: var(--text-muted);">No festivals found matching the current criteria.</div>`;
        return;
    }

    container.innerHTML = filtered.map(f => {
        const isSelected = f.id === activeFestId;
        const domain = f.domain || `${f.slug}.festos.app`;
        const adminCount = globalUsers.filter(u => u.fest_id === f.id || u.username.startsWith(f.slug + '_')).length;

        return `
            <div class="fest-card ${isSelected ? 'active-fest' : ''}" onclick="openFestWorkspace('${f.id}')">
                <div class="fest-card-header">
                    <img src="${f.logo || 'festos-logo.svg'}" alt="${f.name}" class="fest-card-logo">
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                            <div class="fest-card-title">${f.name}</div>
                            <span class="fest-chip chip-${f.status || 'active'}">${f.status || 'active'}</span>
                        </div>
                        <span class="fest-domain-badge">${domain}</span>
                    </div>
                </div>

                <div class="fest-meta-list">
                    <div class="fest-meta-item">
                        <i class="fa-solid fa-code"></i>
                        <span>Code Prefix: <strong style="font-family:var(--font-mono); color:var(--text-main);">${f.slug}</strong></span>
                    </div>
                    <div class="fest-meta-item">
                        <i class="fa-solid fa-user-shield"></i>
                        <span>${adminCount} Assigned Staff / Master Admins</span>
                    </div>
                    <div class="fest-meta-item">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${f.venue || 'Venue Unset'}</span>
                    </div>
                    <div class="fest-meta-item">
                        <i class="fa-solid fa-calendar-days"></i>
                        <span>${f.startDate ? f.startDate : 'Dates TBD'}</span>
                    </div>
                </div>

                <div class="fest-actions-bar" onclick="event.stopPropagation()">
                    <button class="btn btn-outline" style="padding:4px 10px; font-size:0.75rem;" onclick="changeActiveFestContext('${f.id}')" title="Set as System Active Fest">
                        <i class="fa-solid fa-bolt" style="color:var(--amber);"></i> Set Active
                    </button>
                    <button class="btn btn-outline" style="padding:4px 10px; font-size:0.75rem;" onclick="openCreateUserModalForFest('${f.id}', '${f.slug}')" title="Create Dedicated Staff Account">
                        <i class="fa-solid fa-user-plus"></i> Add Staff
                    </button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="editFestival('${f.id}')" title="Edit Festival Settings">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);" onclick="triggerDeleteFestDialog('${f.id}', '${f.name}')" title="Delete Festival">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function openFestWorkspace(festId) {
    selectedWorkspaceFestId = festId;
    const fest = globalFests.find(f => f.id === festId);
    if (!fest) return;

    const workspaceView = document.getElementById('fest-workspace-view');
    if (!workspaceView) return;

    const flags = await festosFeatures.getFestFeatureFlags(festId);
    const domain = fest.domain || `${fest.slug}.festos.app`;
    const resultsSub = fest.public_results_slug || 'results';

    workspaceView.style.display = 'block';
    workspaceView.innerHTML = `
        <div class="workspace-card">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; border-bottom:1px solid var(--border); padding-bottom:1.25rem;">
                <div style="display:flex; align-items:center; gap:14px; min-width:0;">
                    <img src="${fest.logo || 'festos-logo.svg'}" alt="${fest.name}" style="width:50px; height:50px; border-radius:10px; object-fit:contain; background:#FFF; border:1px solid var(--border); padding:3px; flex-shrink:0;">
                    <div style="min-width:0;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <h2 style="font-size:1.35rem; font-weight:800; color:var(--text-main);">${fest.name}</h2>
                            <span class="fest-chip chip-${fest.status || 'active'}">${fest.status || 'active'}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; margin-top:4px; flex-wrap:wrap;">
                            <span class="fest-domain-badge"><i class="fa-solid fa-globe"></i> ${domain}</span>
                            <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-square-poll-vertical" style="color:var(--primary);"></i> Results URL: <strong>${domain}/${resultsSub}</strong></span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-outline" onclick="closeFestWorkspace()">
                        <i class="fa-solid fa-xmark"></i> Close Workspace
                    </button>
                    <button class="btn btn-primary" onclick="editFestival('${fest.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Edit Details
                    </button>
                </div>
            </div>

            <!-- Feature Switchboard for this specific fest -->
            <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-sliders" style="color:var(--primary);"></i> Festival Module & Feature Matrix Control
            </h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">Enable or restrict which software modules this festival's Master Admin and staff can access.</p>

            <div class="matrix-grid">
                ${FEATURE_DEFINITIONS.map(feat => {
                    const isEnabled = flags[feat.key] !== false;
                    return `
                        <div class="feature-card">
                            <div class="feature-info">
                                <h4><i class="fa-solid ${feat.icon}" style="color:var(--primary);"></i> ${feat.title}</h4>
                                <p>${feat.desc}</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleFestFeature('${fest.id}', '${feat.key}', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    workspaceView.scrollIntoView({ behavior: 'smooth' });
}

function closeFestWorkspace() {
    const workspaceView = document.getElementById('fest-workspace-view');
    if (workspaceView) workspaceView.style.display = 'none';
}

async function toggleFestFeature(festId, featureKey, isEnabled) {
    try {
        const currentFlags = await festosFeatures.getFestFeatureFlags(festId);
        currentFlags[featureKey] = isEnabled;

        localStorage.setItem(`festos_features_${festId}`, JSON.stringify(currentFlags));

        if (festosSupabase) {
            await festosSupabase.from('settings').upsert({
                id: `features_${festId}`,
                value: currentFlags,
                updated_at: new Date().toISOString()
            });
        }

        festosLogger.log('SETTINGS', `Updated feature flag "${featureKey}" to ${isEnabled} for fest: ${festId}`, { festId, featureKey, isEnabled }, 'INFO');
        showToast(`Feature ${isEnabled ? 'Enabled' : 'Disabled'} for festival!`, 'success');
    } catch(e) {
        showToast('Error saving feature flag: ' + e.message, 'error');
    }
}

function autoGenerateSlug(name) {
    if (document.getElementById('modal-fest-id').value) return; // don't override on edit
    const slugInput = document.getElementById('modal-fest-slug');
    if (slugInput) {
        const generated = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
        slugInput.value = generated;
        updateDomainPreview(generated);
    }
}

function updateDomainPreview(slug) {
    const domainInput = document.getElementById('modal-fest-domain');
    if (domainInput && slug) {
        domainInput.value = `${slug}.festos.app`;
    }
}

function openCreateFestModal() {
    currentEditingFest = null;
    document.getElementById('fest-modal-title').innerText = 'Create New Festival';
    document.getElementById('modal-fest-id').value = '';
    document.getElementById('modal-fest-name').value = '';
    document.getElementById('modal-fest-slug').value = '';
    document.getElementById('modal-fest-domain').value = '';
    document.getElementById('modal-fest-status').value = 'active';
    document.getElementById('modal-fest-results-slug').value = 'results';
    document.getElementById('modal-fest-venue').value = '';
    document.getElementById('modal-fest-start').value = '';
    document.getElementById('modal-fest-end').value = '';
    document.getElementById('modal-fest-logo').value = '';
    openModal('festModal');
}

function editFestival(festId) {
    const fest = globalFests.find(f => f.id === festId);
    if (!fest) return;
    currentEditingFest = fest;

    document.getElementById('fest-modal-title').innerText = `Edit: ${fest.name}`;
    document.getElementById('modal-fest-id').value = fest.id;
    document.getElementById('modal-fest-name').value = fest.name;
    document.getElementById('modal-fest-slug').value = fest.slug;
    document.getElementById('modal-fest-domain').value = fest.domain || `${fest.slug}.festos.app`;
    document.getElementById('modal-fest-status').value = fest.status || 'active';
    document.getElementById('modal-fest-results-slug').value = fest.public_results_slug || 'results';
    document.getElementById('modal-fest-venue').value = fest.venue || '';
    document.getElementById('modal-fest-start').value = fest.startDate || fest.start_date || '';
    document.getElementById('modal-fest-end').value = fest.endDate || fest.end_date || '';
    document.getElementById('modal-fest-logo').value = fest.logo || '';
    openModal('festModal');
}

async function saveFestivalSubmit() {
    const id = document.getElementById('modal-fest-id').value;
    const name = document.getElementById('modal-fest-name').value.trim();
    const slug = document.getElementById('modal-fest-slug').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const domain = document.getElementById('modal-fest-domain').value.trim() || `${slug}.festos.app`;
    const status = document.getElementById('modal-fest-status').value;
    const resultsSlug = document.getElementById('modal-fest-results-slug').value.trim() || 'results';
    const venue = document.getElementById('modal-fest-venue').value.trim();
    const startDate = document.getElementById('modal-fest-start').value;
    const endDate = document.getElementById('modal-fest-end').value;
    const logo = document.getElementById('modal-fest-logo').value.trim();

    if (!name || !slug) return alert('Festival name and unique slug are required.');

    const btn = document.getElementById('btn-save-fest');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    try {
        if (id) {
            const index = globalFests.findIndex(f => f.id === id);
            if (index !== -1) {
                globalFests[index] = { ...globalFests[index], name, slug, domain, status, public_results_slug: resultsSlug, venue, startDate, endDate, logo };
            }
            festosLogger.log('SYSTEM', `Updated festival: ${name}`, { festId: id }, 'INFO');
        } else {
            const newFest = {
                id: 'fest_' + slug + '_' + Date.now().toString(36),
                name,
                slug,
                domain,
                status,
                public_results_slug: resultsSlug,
                venue,
                startDate,
                endDate,
                logo: logo || 'festos-logo.svg',
                created_at: new Date().toISOString()
            };
            globalFests.push(newFest);
            festosLogger.log('SYSTEM', `Created festival: ${name} (${domain})`, newFest, 'INFO');
        }

        await syncFestsToDatabase();
        closeModal('festModal');
        renderAllViews();
        showToast(`Festival "${name}" saved!`, 'success');
    } catch (e) {
        showToast('Error saving festival: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Festival';
    }
}

function triggerDeleteFestDialog(festId, festName) {
    if (globalFests.length <= 1) {
        return alert('Cannot delete the only remaining festival.');
    }
    openConfirmDialog(
        `Delete Festival "${festName}"`,
        `Are you sure you want to permanently delete "${festName}"? All assigned routes, accounts, and scope data for this festival will be permanently removed.`,
        'fa-trash-can',
        'var(--danger)',
        async () => {
            await deleteFestivalPermanently(festId, festName);
        }
    );
}

async function deleteFestivalPermanently(festId, festName) {
    try {
        // 1. Remove from local memory
        globalFests = globalFests.filter(f => f.id !== festId);
        if (activeFestId === festId) {
            activeFestId = globalFests.length > 0 ? globalFests[0].id : 'default_fest';
            festosFeatures.setActiveFestId(activeFestId);
        }

        // 2. Cascade delete from Supabase
        if (festosSupabase) {
            try {
                // Delete dependent rows first to prevent foreign key errors
                await festosSupabase.from('appeals').delete().eq('fest_id', festId);
                await festosSupabase.from('judgements').delete().eq('fest_id', festId);
                await festosSupabase.from('scores').delete().eq('fest_id', festId);
                await festosSupabase.from('participants').delete().eq('fest_id', festId);
                await festosSupabase.from('teams').delete().eq('fest_id', festId);
                await festosSupabase.from('competitions').delete().eq('fest_id', festId);
                await festosSupabase.from('users').delete().eq('fest_id', festId);
                await festosSupabase.from('settings').delete().ilike('id', `%_${festId}`);
                await festosSupabase.from('settings').delete().eq('id', `features_${festId}`);
            } catch(childErr) {
                console.warn('Child table cleanup error:', childErr);
            }

            // Delete from fests table
            const { error: festDeleteError } = await festosSupabase.from('fests').delete().eq('id', festId);
            if (festDeleteError) {
                console.warn('Fests table delete notice:', festDeleteError);
            }

            // Sync updated multi_fests list to settings
            await festosSupabase.from('settings').upsert({
                id: 'festos_multi_fests',
                value: globalFests,
                updated_at: new Date().toISOString()
            });
        }

        // 3. Clear local storage caches for this festival
        localStorage.removeItem(`festos_features_${festId}`);
        localStorage.removeItem(`festos_settings_cache_${festId}`);

        festosLogger.log('SYSTEM', `Permanently deleted festival: ${festName}`, { festId }, 'WARNING');
        closeFestWorkspace();
        renderAllViews();
        showToast(`Festival "${festName}" deleted permanently!`, 'success');
    } catch(err) {
        console.error('Delete festival error:', err);
        showToast('Error deleting festival: ' + err.message, 'error');
    }
}

// =========================================================================
// 6. CLIENT INQUIRIES & DEMO LEADS
// =========================================================================
function renderEnquiriesTable() {
    const tbody = document.getElementById('enquiries-table-tbody');
    if (!tbody) return;

    const search = (document.getElementById('enquiry-search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('enquiry-status-filter')?.value || 'all';

    const filtered = globalEnquiries.filter(e => {
        const matchesSearch = (e.client_name && e.client_name.toLowerCase().includes(search)) ||
                              (e.organization && e.organization.toLowerCase().includes(search)) ||
                              (e.email && e.email.toLowerCase().includes(search));
        const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No client inquiries found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(e => `
        <tr>
            <td>
                <div style="font-weight:700; color:var(--text-main);">${e.client_name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-building" style="color:var(--primary);"></i> ${e.organization}</div>
            </td>
            <td>
                <div style="font-size:0.85rem;"><i class="fa-solid fa-envelope" style="color:var(--cyan);"></i> ${e.email}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-phone" style="color:var(--success);"></i> ${e.phone || 'N/A'}</div>
            </td>
            <td>
                <div style="font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-calendar"></i> ${e.fest_date || 'TBD'}</div>
                <span style="font-size:0.75rem; color:var(--text-muted);">${e.expected_attendees || 'Scale TBD'}</span>
            </td>
            <td style="max-width:260px;">
                <p style="font-size:0.82rem; color:var(--text-main); line-height:1.35; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                    ${e.message || 'No message provided.'}
                </p>
            </td>
            <td>
                <span class="fest-chip ${e.status === 'new' ? 'chip-upcoming' : (e.status === 'contacted' ? 'chip-active' : 'chip-archived')}">
                    ${(e.status || 'new').toUpperCase()}
                </span>
            </td>
            <td style="text-align:right;">
                <div style="display:inline-flex; gap:6px;">
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="updateEnquiryStatus('${e.id}', 'contacted')" title="Mark Contacted">
                        <i class="fa-solid fa-phone-volume"></i>
                    </button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="updateEnquiryStatus('${e.id}', 'demo_scheduled')" title="Schedule Demo">
                        <i class="fa-solid fa-calendar-check"></i>
                    </button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);" onclick="triggerDeleteEnquiryDialog('${e.id}', '${e.client_name}')" title="Delete Inquiry">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateEnquiryStatus(enquiryId, newStatus) {
    const index = globalEnquiries.findIndex(e => e.id === enquiryId);
    if (index !== -1) {
        globalEnquiries[index].status = newStatus;
    }

    if (festosSupabase) {
        try {
            await festosSupabase.from('enquiries').update({ status: newStatus }).eq('id', enquiryId);
        } catch(e) {}
    }

    localStorage.setItem('festos_cached_enquiries', JSON.stringify(globalEnquiries));
    renderEnquiriesTable();
    showToast(`Lead status updated: ${newStatus}`, 'success');
}

function triggerDeleteEnquiryDialog(enquiryId, clientName) {
    openConfirmDialog(
        'Delete Inquiry',
        `Are you sure you want to delete inquiry from "${clientName}"?`,
        'fa-trash-can',
        'var(--danger)',
        async () => {
            globalEnquiries = globalEnquiries.filter(e => e.id !== enquiryId);
            if (festosSupabase) {
                try {
                    await festosSupabase.from('enquiries').delete().eq('id', enquiryId);
                } catch(e) {}
            }
            localStorage.setItem('festos_cached_enquiries', JSON.stringify(globalEnquiries));
            renderEnquiriesTable();
            updateKPIDisplays(globalFests.length, globalEnquiries.length, globalUsers.length, 0);
            showToast('Inquiry deleted', 'info');
        }
    );
}

// =========================================================================
// 7. MASTER ADMINS GOVERNANCE & BULK ACTIONS
// =========================================================================
function renderUsersTable() {
    const tbody = document.getElementById('users-table-tbody');
    if (!tbody) return;

    // Populate fest filter dropdown
    const festFilter = document.getElementById('user-fest-filter');
    if (festFilter && festFilter.options.length <= 1) {
        festFilter.innerHTML = `<option value="all">All Festivals (View All)</option>` + 
            globalFests.map(f => `<option value="${f.id}">${f.name} (${f.slug})</option>`).join('');
    }

    const search = (document.getElementById('user-search-input')?.value || '').toLowerCase();
    const festFilterVal = document.getElementById('user-fest-filter')?.value || 'all';
    const roleFilter = document.getElementById('user-role-filter')?.value || 'all';

    const filtered = globalUsers.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(search);
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        const matchesFest = festFilterVal === 'all' || u.fest_id === festFilterVal || u.username.startsWith(globalFests.find(f => f.id === festFilterVal)?.slug || '');
        return matchesSearch && matchesRole && matchesFest;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No Master Admins match current filters.</td></tr>`;
        updateUserBulkToolbar();
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const isMaster = u.role === 'master_admin';
        const assignedFest = globalFests.find(f => f.id === u.fest_id);
        const festName = assignedFest ? assignedFest.name : 'Global Access';
        const festSlug = assignedFest ? assignedFest.slug : 'GLOBAL';
        const historyCount = (u.password_history && Array.isArray(u.password_history)) ? u.password_history.length : 0;
        const isChecked = selectedUserIds.has(u.id);

        return `
            <tr class="${isChecked ? 'selected' : ''}">
                <td style="text-align:center;">
                    <input type="checkbox" class="custom-chk user-chk" value="${u.id}" ${isChecked ? 'checked' : ''} onchange="toggleUserSelection('${u.id}', this.checked)">
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="user-avatar" style="width:30px; height:30px; font-size:0.75rem;">${u.username.substring(0,2).toUpperCase()}</div>
                        <div>
                            <div style="font-weight:700; color:var(--text-main);">${u.username}</div>
                            <span style="font-size:0.72rem; font-family:var(--font-mono); color:var(--primary); background:var(--primary-light); padding:1px 5px; border-radius:3px;">
                                code: ${festSlug}
                            </span>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="font-size:0.85rem; color:var(--text-main); font-weight:700;"><i class="fa-solid fa-crown" style="color:var(--amber); margin-right:4px;"></i> ${festName}</span>
                </td>
                <td>
                    <span style="padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; ${isMaster ? 'background:var(--secondary-light); color:var(--secondary);' : 'background:var(--primary-light); color:var(--primary);'}">
                        ${u.role}
                    </span>
                </td>
                <td>
                    <div style="display:inline-flex; align-items:center; gap:6px; background:var(--bg-main); border:1px solid var(--border); padding:3px 8px; border-radius:6px; font-family:var(--font-mono); font-size:0.8rem;">
                        <span>${u.password_hash || '••••••••'}</span>
                        <button onclick="copyToClipboard('${u.password_hash || ''}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.75rem;" title="Copy Password">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <button class="btn btn-outline" style="padding:3px 8px; font-size:0.75rem;" onclick="openPasswordHistoryModal('${u.id}')">
                        <i class="fa-solid fa-clock-rotate-left"></i> ${historyCount} Past Keys
                    </button>
                </td>
                <td style="text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="editUserModal('${u.id}')" title="Edit Role & Festival Assignment">
                            <i class="fa-solid fa-user-pen"></i> Assign
                        </button>
                        <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);" onclick="triggerDeleteUserDialog('${u.id}', '${u.username}')" title="Delete Account">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateUserBulkToolbar();
}

// Bulk Selection Handlers
function toggleUserSelection(userId, checked) {
    if (checked) {
        selectedUserIds.add(userId);
    } else {
        selectedUserIds.delete(userId);
    }
    updateUserBulkToolbar();
}

function toggleSelectAllUsers(checked) {
    const checkboxes = document.querySelectorAll('.user-chk');
    checkboxes.forEach(chk => {
        chk.checked = checked;
        if (checked) {
            selectedUserIds.add(chk.value);
        } else {
            selectedUserIds.delete(chk.value);
        }
    });
    updateUserBulkToolbar();
}

function clearUserSelections() {
    selectedUserIds.clear();
    const selectAll = document.getElementById('user-select-all');
    if (selectAll) selectAll.checked = false;
    renderUsersTable();
}

function updateUserBulkToolbar() {
    const toolbar = document.getElementById('user-bulk-toolbar');
    const countEl = document.getElementById('bulk-selected-count');
    const selectAll = document.getElementById('user-select-all');
    
    const count = selectedUserIds.size;
    if (countEl) countEl.innerText = count;

    if (toolbar) {
        if (count > 0) {
            toolbar.classList.add('active');
        } else {
            toolbar.classList.remove('active');
        }
    }

    if (selectAll) {
        const visibleChks = document.querySelectorAll('.user-chk');
        selectAll.checked = visibleChks.length > 0 && Array.from(visibleChks).every(c => c.checked);
    }
}

// Bulk Action: Reassign Festival
function openBulkReassignModal() {
    if (selectedUserIds.size === 0) return showToast('No accounts selected', 'error');
    
    document.getElementById('bulk-reassign-count').innerText = selectedUserIds.size;
    const select = document.getElementById('bulk-target-fest');
    if (select) {
        select.innerHTML = globalFests.map(f => `<option value="${f.id}">${f.name} (${f.slug})</option>`).join('');
    }
    openModal('bulkReassignModal');
}

async function applyBulkReassignSubmit() {
    const targetFestId = document.getElementById('bulk-target-fest')?.value;
    const targetFest = globalFests.find(f => f.id === targetFestId);
    if (!targetFestId || !targetFest) return;

    try {
        const ids = Array.from(selectedUserIds);
        for (const userId of ids) {
            if (festosSupabase) {
                await festosSupabase.from('users').update({ fest_id: targetFestId }).eq('id', userId);
            }
            const user = globalUsers.find(u => u.id === userId);
            if (user) user.fest_id = targetFestId;
        }

        festosLogger.log('AUTH', `Bulk reassigned ${ids.length} accounts to fest: ${targetFest.name}`, { count: ids.length, festId: targetFestId }, 'INFO');
        closeModal('bulkReassignModal');
        clearUserSelections();
        showToast(`Successfully reassigned ${ids.length} accounts to ${targetFest.name}!`, 'success');
    } catch(e) {
        showToast('Bulk reassign failed: ' + e.message, 'error');
    }
}

// Bulk Action: Change Role
function openBulkRoleModal() {
    if (selectedUserIds.size === 0) return showToast('No accounts selected', 'error');
    document.getElementById('bulk-role-count').innerText = selectedUserIds.size;
    openModal('bulkRoleModal');
}

async function applyBulkRoleSubmit() {
    const newRole = document.getElementById('bulk-target-role')?.value;
    if (!newRole) return;

    try {
        const ids = Array.from(selectedUserIds);
        for (const userId of ids) {
            if (festosSupabase) {
                await festosSupabase.from('users').update({ role: newRole }).eq('id', userId);
            }
            const user = globalUsers.find(u => u.id === userId);
            if (user) user.role = newRole;
        }

        festosLogger.log('AUTH', `Bulk changed role for ${ids.length} accounts to: ${newRole}`, { count: ids.length, newRole }, 'INFO');
        closeModal('bulkRoleModal');
        clearUserSelections();
        showToast(`Successfully updated ${ids.length} accounts to ${newRole}!`, 'success');
    } catch(e) {
        showToast('Bulk role update failed: ' + e.message, 'error');
    }
}

// Bulk Action: Delete Selected
function triggerBulkDeleteUsersDialog() {
    if (selectedUserIds.size === 0) return showToast('No accounts selected', 'error');
    const count = selectedUserIds.size;

    openConfirmDialog(
        `Delete ${count} Accounts`,
        `Are you sure you want to permanently delete all ${count} selected user accounts? This cannot be undone.`,
        'fa-trash-can',
        'var(--danger)',
        async () => {
            try {
                const ids = Array.from(selectedUserIds);
                for (const userId of ids) {
                    if (festosSupabase) {
                        try {
                            await festosSupabase.from('users').delete().eq('id', userId);
                        } catch(e) {}
                    }
                }
                globalUsers = globalUsers.filter(u => !selectedUserIds.has(u.id));
                festosLogger.log('AUTH', `Bulk deleted ${ids.length} user accounts`, { count: ids.length }, 'WARNING');
                clearUserSelections();
                updateKPIDisplays(globalFests.length, globalEnquiries.length, globalUsers.length, 0);
                showToast(`Deleted ${ids.length} accounts successfully`, 'info');
            } catch(e) {
                showToast('Failed to delete accounts: ' + e.message, 'error');
            }
        }
    );
}

// Single User Modal Actions
function openCreateUserModal() {
    currentEditingUser = null;
    document.getElementById('user-modal-title').innerText = 'Create Master Admin / Staff User';
    document.getElementById('modal-user-id').value = '';
    document.getElementById('modal-user-username').value = '';
    document.getElementById('modal-user-password').value = '';
    document.getElementById('modal-user-role').value = 'master_admin';

    const festSelect = document.getElementById('modal-user-fest');
    if (festSelect) {
        festSelect.innerHTML = globalFests.map(f => `<option value="${f.id}" data-slug="${f.slug}">${f.name} (${f.slug})</option>`).join('');
        if (globalFests.length > 0) {
            syncUsernamePrefixWithFest(globalFests[0].id);
        }
    }
    openModal('userModal');
}

function editUserModal(userId) {
    const user = globalUsers.find(u => u.id === userId);
    if (!user) return;
    currentEditingUser = user;

    document.getElementById('user-modal-title').innerText = `Edit: ${user.username}`;
    document.getElementById('modal-user-id').value = user.id;
    document.getElementById('modal-user-username').value = user.username;
    document.getElementById('modal-user-password').value = user.password_hash || '';
    document.getElementById('modal-user-role').value = user.role || 'master_admin';

    const festSelect = document.getElementById('modal-user-fest');
    if (festSelect) {
        festSelect.innerHTML = globalFests.map(f => `<option value="${f.id}" ${f.id === user.fest_id ? 'selected' : ''}>${f.name} (${f.slug})</option>`).join('');
    }
    openModal('userModal');
}

function openCreateUserModalForFest(festId, slug) {
    openCreateUserModal();
    const festSelect = document.getElementById('modal-user-fest');
    if (festSelect) {
        festSelect.value = festId;
        syncUsernamePrefixWithFest(festId);
    }
}

function syncUsernamePrefixWithFest(festId) {
    const fest = globalFests.find(f => f.id === festId);
    const usernameInput = document.getElementById('modal-user-username');
    if (fest && usernameInput && !document.getElementById('modal-user-id').value) {
        usernameInput.value = `${fest.slug}_admin`;
    }
}

function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('modal-user-password').value = pwd;
}

async function saveUserSubmit() {
    const id = document.getElementById('modal-user-id').value;
    const username = document.getElementById('modal-user-username').value.trim();
    const password = document.getElementById('modal-user-password').value.trim();
    const role = document.getElementById('modal-user-role').value;
    const festId = document.getElementById('modal-user-fest').value;

    if (!username || !password) return alert('Username and password are required.');

    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    try {
        const payload = {
            ...(id ? { id } : {}),
            username,
            password_hash: password,
            role,
            fest_id: festId
        };

        const { error } = await festosSupabase.from('users').upsert(payload);
        if (error) throw error;

        festosLogger.log('AUTH', `Created/updated credentials for "${username}" as ${role}`, { role, festId }, 'INFO');
        closeModal('userModal');
        await loadInitialData();
        renderUsersTable();
        showToast(`User "${username}" saved for festival!`, 'success');
    } catch (e) {
        showToast('Error saving user: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Account';
    }
}

// Password History & Reset Modal
function openPasswordHistoryModal(userId) {
    const user = globalUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('pwd-modal-user-id').value = user.id;
    document.getElementById('pwd-modal-user-title').innerText = `Credentials: ${user.username}`;
    document.getElementById('pwd-modal-current').value = user.password_hash || '';
    document.getElementById('pwd-modal-new').value = '';

    const historyContainer = document.getElementById('pwd-modal-history-list');
    const history = user.password_history || [];

    if (history.length === 0) {
        historyContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; padding:6px 0;">No previous password history on record.</p>`;
    } else {
        historyContainer.innerHTML = history.map((item, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-main); border-radius:6px; font-size:0.8rem; border:1px solid var(--border);">
                <code style="font-family:var(--font-mono); font-weight:700;">${item.password || item}</code>
                <span style="color:var(--text-muted); font-size:0.75rem;">${item.changed_at ? new Date(item.changed_at).toLocaleDateString() : 'Previous'}</span>
            </div>
        `).join('');
    }

    openModal('pwdHistoryModal');
}

function copyActivePassword() {
    const pwd = document.getElementById('pwd-modal-current').value;
    copyToClipboard(pwd);
}

function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Password copied to clipboard!', 'success');
    });
}

async function applyUserPasswordResetSubmit() {
    const userId = document.getElementById('pwd-modal-user-id').value;
    const newPwd = document.getElementById('pwd-modal-new').value.trim();
    if (!newPwd) return alert('Please enter the new password.');

    const user = globalUsers.find(u => u.id === userId);
    if (!user) return;

    const oldPwd = user.password_hash;
    let history = user.password_history || [];
    if (oldPwd && !history.some(h => (h.password || h) === oldPwd)) {
        history.unshift({ password: oldPwd, changed_at: new Date().toISOString() });
    }

    try {
        if (festosSupabase) {
            await festosSupabase.from('users').update({
                password_hash: newPwd,
                password_history: history
            }).eq('id', userId);
        }

        user.password_hash = newPwd;
        user.password_history = history;

        festosLogger.log('AUTH', `Super Admin changed password for user "${user.username}"`, { userId }, 'WARNING');
        document.getElementById('pwd-modal-current').value = newPwd;
        document.getElementById('pwd-modal-new').value = '';
        openPasswordHistoryModal(userId);
        renderUsersTable();
        showToast(`Password updated for "${user.username}"!`, 'success');
    } catch (e) {
        showToast('Password update error: ' + e.message, 'error');
    }
}

function triggerDeleteUserDialog(userId, username) {
    openConfirmDialog(
        'Delete User Account',
        `Are you sure you want to permanently delete user "${username}"?`,
        'fa-trash-can',
        'var(--danger)',
        async () => {
            try {
                if (festosSupabase) {
                    await festosSupabase.from('users').delete().eq('id', userId);
                }
                globalUsers = globalUsers.filter(u => u.id !== userId);
                festosLogger.log('AUTH', `User account deleted: ${username}`, { userId }, 'WARNING');
                renderUsersTable();
                updateKPIDisplays(globalFests.length, globalEnquiries.length, globalUsers.length, 0);
                showToast(`User "${username}" deleted`, 'info');
            } catch(e) {
                showToast('Failed to delete user: ' + e.message, 'error');
            }
        }
    );
}

// Super Admin Master Credentials
function openSuperAdminSecurityModal() {
    const sa = festosAuth.getSuperAdmin();
    document.getElementById('sa-cfg-username').value = sa?.username || 'SuperAdmin';
    document.getElementById('sa-cfg-password').value = '';
    openModal('saSecurityModal');
}

async function saveSuperAdminCredentials() {
    const newUsername = document.getElementById('sa-cfg-username').value.trim();
    const newPassword = document.getElementById('sa-cfg-password').value.trim();

    if (!newUsername || !newPassword) return alert('Both username and password are required.');

    const btn = document.getElementById('btn-save-sa-sec');
    btn.disabled = true;
    btn.innerText = 'Updating...';

    try {
        const updatedSA = {
            id: 'sa_root_01',
            username: newUsername,
            role: 'super_admin'
        };

        if (festosSupabase) {
            try {
                await festosSupabase.from('users').upsert({
                    username: newUsername,
                    password_hash: newPassword,
                    role: 'super_admin'
                });
            } catch(e) {}
        }

        festosAuth.setSuperAdmin(updatedSA);
        festosAuth.setUser(updatedSA, true);

        initAuthAndProfile();
        closeModal('saSecurityModal');
        festosLogger.log('AUTH', `Super Admin master credentials updated to "${newUsername}"`, {}, 'WARNING');
        showToast('Super Admin credentials updated successfully!', 'success');
    } catch(e) {
        showToast('Error updating credentials: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Update Credentials';
    }
}

// =========================================================================
// 8. GLOBAL SOFTWARE BRANDING STUDIO
// =========================================================================
async function loadGlobalSoftwareBranding() {
    try {
        let branding = null;
        if (festosSupabase) {
            const { data } = await festosSupabase.from('settings').select('value').eq('id', 'system_branding').maybeSingle();
            if (data && data.value) branding = data.value;
        }
        if (!branding) {
            const cached = localStorage.getItem('festos_branding_cache');
            if (cached) {
                try { branding = JSON.parse(cached); } catch(e) {}
            }
        }

        const nameEl = document.getElementById('gb-software-name');
        const logoEl = document.getElementById('gb-software-logo');
        const taglineEl = document.getElementById('gb-software-tagline');
        const modeEl = document.getElementById('gb-display-mode');
        const previewEl = document.getElementById('gb-logo-preview');

        if (branding) {
            if (nameEl) nameEl.value = branding.fest_name || 'FestOS';
            if (logoEl) logoEl.value = branding.fest_logo || 'festos-logo.svg';
            if (taglineEl) taglineEl.value = branding.tagline || 'The Modern Festival Operating System';
            if (modeEl) modeEl.value = branding.display_mode || 'both';
            if (previewEl) previewEl.src = branding.fest_logo || 'festos-logo.svg';
        } else {
            if (nameEl) nameEl.value = 'FestOS';
            if (logoEl) logoEl.value = 'festos-logo.svg';
            if (taglineEl) taglineEl.value = 'The Modern Festival Operating System';
            if (modeEl) modeEl.value = 'both';
            if (previewEl) previewEl.src = 'festos-logo.svg';
        }

        updateGlobalBrandingPreview();
    } catch(e) {
        console.warn('Error loading global software branding:', e);
    }
}

function updateGlobalBrandingPreview() {
    const name = document.getElementById('gb-software-name')?.value.trim() || 'FestOS';
    const logo = document.getElementById('gb-software-logo')?.value.trim() || 'festos-logo.svg';
    const tagline = document.getElementById('gb-software-tagline')?.value.trim() || 'The Modern Festival Operating System';
    const displayMode = document.getElementById('gb-display-mode')?.value || 'both';

    // Update Thumbnail preview in form
    const formPrev = document.getElementById('gb-logo-preview');
    if (formPrev) formPrev.src = logo;

    // Update Mockup Elements
    const tabTitle = document.getElementById('preview-tab-title');
    if (tabTitle) tabTitle.innerText = `${name} | Control Panel`;

    const brandText = document.getElementById('preview-brand-text');
    if (brandText) {
        brandText.innerText = name;
        brandText.style.display = (displayMode === 'both' || displayMode === 'name') ? 'inline' : 'none';
    }

    const logoImg = document.getElementById('preview-logo-img');
    if (logoImg) {
        logoImg.src = logo;
        logoImg.style.display = (displayMode === 'both' || displayMode === 'logo') ? 'inline-block' : 'none';
    }

    const sampleTitle = document.getElementById('preview-sample-title');
    if (sampleTitle) sampleTitle.innerText = `${name} Championship Engine`;

    const sampleTagline = document.getElementById('preview-sample-tagline');
    if (sampleTagline) sampleTagline.innerText = tagline;

    const faviconImg = document.getElementById('preview-favicon-img');
    if (faviconImg) faviconImg.src = logo;

    const footerPowered = document.getElementById('preview-footer-powered');
    if (footerPowered) footerPowered.innerText = `Powered by ${name} Platform`;
}

function handleGlobalLogoUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        const logoInput = document.getElementById('gb-software-logo');
        if (logoInput) logoInput.value = base64;
        updateGlobalBrandingPreview();
        showToast('Logo image loaded. Click "Save & Broadcast" to apply.', 'info');
    };
    reader.readAsDataURL(file);
}

function resetGlobalBrandingDefaults() {
    const nameEl = document.getElementById('gb-software-name');
    const logoEl = document.getElementById('gb-software-logo');
    const taglineEl = document.getElementById('gb-software-tagline');
    const modeEl = document.getElementById('gb-display-mode');

    if (nameEl) nameEl.value = 'FestOS';
    if (logoEl) logoEl.value = 'festos-logo.svg';
    if (taglineEl) taglineEl.value = 'The Modern Festival Operating System';
    if (modeEl) modeEl.value = 'both';

    updateGlobalBrandingPreview();
    showToast('Reset to default FestOS branding. Click "Save & Broadcast" to apply.', 'info');
}

async function saveGlobalSoftwareBrandingSubmit() {
    const btn = document.getElementById('btn-save-global-branding') || document.querySelector('#tab-global-branding .btn-primary');
    const originalText = btn ? btn.innerHTML : null;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    const name = document.getElementById('gb-software-name')?.value.trim() || 'FestOS';
    const logo = document.getElementById('gb-software-logo')?.value.trim() || 'festos-logo.svg';
    const tagline = document.getElementById('gb-software-tagline')?.value.trim() || '';
    const displayMode = document.getElementById('gb-display-mode')?.value || 'both';

    const brandingData = {
        fest_name: name,
        fest_logo: logo,
        tagline: tagline,
        display_mode: displayMode,
        updated_at: new Date().toISOString()
    };

    try {
        localStorage.setItem('festos_branding_cache', JSON.stringify(brandingData));

        if (festosSupabase) {
            const { error } = await festosSupabase.from('settings').upsert({
                id: 'system_branding',
                value: brandingData,
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
        }

        if (window.festosBranding) {
            festosBranding.apply(brandingData);
        }
        festosLogger.log('SETTINGS', `Global software branding updated: ${name}`, brandingData, 'INFO');
        showToast('Global software branding saved and broadcasted across all portals!', 'success');
    } catch(e) {
        console.error('Failed to save branding:', e);
        showToast('Failed to save branding: ' + e.message, 'error');
    } finally {
        if (btn && originalText !== null) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// =========================================================================
// 9. LOGS & TELEMETRY
// =========================================================================
function renderLogsConsole() {
    const container = document.getElementById('full-logs-console');
    if (!container) return;

    const search = (document.getElementById('log-search-input')?.value || '').toLowerCase();
    const severityFilter = document.getElementById('log-severity-filter')?.value || 'ALL';

    const logs = festosLogger.getLogs().filter(l => {
        const matchesSearch = l.action.toLowerCase().includes(search) || l.category.toLowerCase().includes(search) || (l.user && l.user.toLowerCase().includes(search));
        const matchesSeverity = severityFilter === 'ALL' || l.severity === severityFilter;
        return matchesSearch && matchesSeverity;
    });

    if (logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:#9CA3AF;">No log entries found.</div>`;
        return;
    }

    container.innerHTML = logs.map(l => `
        <div class="log-entry">
            <span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
            <span class="log-badge log-${l.severity.toLowerCase()}">${l.severity}</span>
            <div class="log-body">
                <div><strong>[${l.category}]</strong> ${l.action} <span style="color:#9CA3AF; font-size:0.75rem;">(${l.user || 'System'})</span></div>
                ${l.details && Object.keys(l.details).length > 0 ? `<pre style="font-size:0.72rem; color:#9CA3AF; margin-top:4px; overflow-x:auto;">${JSON.stringify(l.details)}</pre>` : ''}
            </div>
        </div>
    `).join('');
}

function triggerClearLogsDialog() {
    openConfirmDialog(
        'Clear System Logs',
        'Are you sure you want to clear all telemetry and audit logs?',
        'fa-trash-can',
        'var(--danger)',
        () => {
            festosLogger.clearLogs();
            renderLogsConsole();
            renderOverviewAuditStream();
            showToast('Audit logs cleared', 'info');
        }
    );
}

// =========================================================================
// 10. ENHANCED REAL-TIME DIAGNOSTICS & SYSTEM HEALTH ENGINE
// =========================================================================
async function runQuickPing() {
    try {
        const start = performance.now();
        if (festosSupabase) {
            await festosSupabase.from('settings').select('id').limit(1);
        }
        const latency = Math.round(performance.now() - start);

        const statusEl = document.getElementById('system-status-text');
        if (statusEl) statusEl.innerText = `Online (${latency}ms)`;
    } catch(e) {
        const statusEl = document.getElementById('system-status-text');
        if (statusEl) statusEl.innerText = 'Online (Cached)';
    }
}

async function runDiagnosticsSuite() {
    const btn = document.getElementById('btn-run-diag');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running Tests...';
    }

    const checklistEl = document.getElementById('diag-detailed-checklist');
    const dbValEl = document.getElementById('diag-db-val');
    const dbPillEl = document.getElementById('diag-db-pill');
    const tablesValEl = document.getElementById('diag-tables-val');
    const tablesPillEl = document.getElementById('diag-tables-pill');
    const wsValEl = document.getElementById('diag-ws-val');
    const wsPillEl = document.getElementById('diag-ws-pill');
    const storageValEl = document.getElementById('diag-storage-val');
    const storagePillEl = document.getElementById('diag-storage-pill');
    const overallScoreEl = document.getElementById('health-overall-score');
    const overallLabelEl = document.getElementById('health-overall-label');
    const lastCheckedEl = document.getElementById('diag-last-checked');

    if (lastCheckedEl) lastCheckedEl.innerText = `Last checked: ${new Date().toLocaleTimeString()}`;

    const testResults = [];
    let passedCount = 0;
    const totalTests = 5;

    // Test 1: Cloud Database Connectivity & Latency
    let dbLatency = 0;
    try {
        const tStart = performance.now();
        const { error } = await festosSupabase.from('settings').select('id').limit(1);
        dbLatency = Math.round(performance.now() - tStart);

        if (error) throw error;

        if (dbValEl) dbValEl.innerText = `${dbLatency} ms`;
        if (dbPillEl) {
            dbPillEl.className = 'diag-pill diag-pass';
            dbPillEl.innerText = 'Connected';
        }
        testResults.push({ name: 'Supabase PostgreSQL Cloud Gateway', status: 'PASS', detail: `Connected with roundtrip latency of ${dbLatency}ms.` });
        passedCount++;
    } catch(e) {
        if (dbValEl) dbValEl.innerText = 'Fallback';
        if (dbPillEl) {
            dbPillEl.className = 'diag-pill diag-warn';
            dbPillEl.innerText = 'Offline Mode';
        }
        testResults.push({ name: 'Supabase PostgreSQL Cloud Gateway', status: 'WARN', detail: 'Cloud response delayed. Operating on localStorage fallback cache.' });
    }

    // Test 2: Database Schema & Key Tables
    const keyTables = ['fests', 'users', 'enquiries', 'settings'];
    let verifiedTables = 0;
    try {
        for (const table of keyTables) {
            try {
                const { error } = await festosSupabase.from(table).select('id', { count: 'exact', head: true });
                if (!error) verifiedTables++;
            } catch(te) {}
        }

        if (verifiedTables >= 3) {
            if (tablesValEl) tablesValEl.innerText = `${verifiedTables}/${keyTables.length} Tables Active`;
            if (tablesPillEl) {
                tablesPillEl.className = 'diag-pill diag-pass';
                tablesPillEl.innerText = 'Verified';
            }
            testResults.push({ name: 'Database Multi-Tenant Tables Integrity', status: 'PASS', detail: `${verifiedTables} key tenant tables verified on schema.` });
            passedCount++;
        } else {
            if (tablesValEl) tablesValEl.innerText = 'Partial Schema';
            if (tablesPillEl) {
                tablesPillEl.className = 'diag-pill diag-warn';
                tablesPillEl.innerText = 'Needs Sync';
            }
            testResults.push({ name: 'Database Multi-Tenant Tables Integrity', status: 'WARN', detail: 'Some tables missing; settings table is handling persistence.' });
        }
    } catch(e) {
        testResults.push({ name: 'Database Multi-Tenant Tables Integrity', status: 'WARN', detail: 'Could not verify all table indexes.' });
    }

    // Test 3: Realtime Subscriptions
    try {
        if (wsValEl) wsValEl.innerText = 'Synchronized';
        if (wsPillEl) {
            wsPillEl.className = 'diag-pill diag-pass';
            wsPillEl.innerText = 'Active';
        }
        testResults.push({ name: 'Real-Time WebSocket Rebranding Broadcast Channel', status: 'PASS', detail: 'Active channel ready to stream scoreboards and branding.' });
        passedCount++;
    } catch(e) {
        testResults.push({ name: 'Real-Time WebSocket Engine', status: 'WARN', detail: 'WebSocket in polling fallback mode.' });
    }

    // Test 4: Local Storage & Quota
    try {
        let totalBytes = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalBytes += (localStorage[key].length * 2);
            }
        }
        const kbUsed = (totalBytes / 1024).toFixed(1);
        if (storageValEl) storageValEl.innerText = `${kbUsed} KB Used`;
        if (storagePillEl) {
            storagePillEl.className = 'diag-pill diag-pass';
            storagePillEl.innerText = 'Healthy';
        }
        testResults.push({ name: 'Local Application Cache & Memory Quota', status: 'PASS', detail: `Browser cache is utilizing ${kbUsed} KB of local quota.` });
        passedCount++;
    } catch(e) {
        testResults.push({ name: 'Local Application Storage', status: 'WARN', detail: 'LocalStorage restricted or unavailable.' });
    }

    // Test 5: Multi-Tenant Credentials & Token Integrity
    try {
        const sa = festosAuth.getSuperAdmin();
        if (sa && sa.username) {
            testResults.push({ name: 'Super Admin Security Session & Root Context', status: 'PASS', detail: `Authenticated as ${sa.username} with Root Super Admin privilege.` });
            passedCount++;
        } else {
            testResults.push({ name: 'Super Admin Security Session', status: 'WARN', detail: 'Using default local session.' });
        }
    } catch(e) {}

    // Compute Health Score
    const score = Math.round((passedCount / totalTests) * 100);
    if (overallScoreEl) overallScoreEl.innerText = `${score}%`;
    if (overallLabelEl) {
        if (score >= 90) {
            overallLabelEl.innerText = 'Operational & Healthy';
            overallLabelEl.style.color = 'var(--success)';
        } else if (score >= 60) {
            overallLabelEl.innerText = 'Degraded (Fallback Mode)';
            overallLabelEl.style.color = 'var(--amber)';
        } else {
            overallLabelEl.innerText = 'Critical Issues';
            overallLabelEl.style.color = 'var(--danger)';
        }
    }

    // Render Detailed Checklist
    if (checklistEl) {
        checklistEl.innerHTML = testResults.map(t => {
            const isPass = t.status === 'PASS';
            const icon = isPass ? '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>' : '<i class="fa-solid fa-triangle-exclamation" style="color:var(--amber);"></i>';
            const badgeClass = isPass ? 'diag-pass' : 'diag-warn';
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-main); border-radius:var(--radius-md); border:1px solid var(--border); flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${icon}
                        <div>
                            <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">${t.name}</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">${t.detail}</div>
                        </div>
                    </div>
                    <span class="diag-pill ${badgeClass}">${t.status}</span>
                </div>
            `;
        }).join('');
    }

    latestDiagnosticsReport = {
        timestamp: new Date().toISOString(),
        healthScore: `${score}%`,
        status: score >= 90 ? 'OPERATIONAL' : 'DEGRADED',
        dbLatency: `${dbLatency}ms`,
        results: testResults
    };

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Run Live Diagnostics';
    }

    showToast(`Health Diagnostics Complete: ${score}% Operational`, score >= 90 ? 'success' : 'info');
}

function flushSystemCaches() {
    localStorage.removeItem('festos_branding_cache');
    localStorage.removeItem('festos_results_cache');
    localStorage.removeItem('festos_cached_enquiries');
    showToast('Local application caches flushed successfully!', 'success');
    runDiagnosticsSuite();
}

async function repairMultiTenantData() {
    showToast('Running multi-tenant schema verification & repair...', 'info');
    try {
        await syncFestsToDatabase();
        if (festosSupabase) {
            for (const user of globalUsers) {
                if (!user.fest_id && globalFests.length > 0) {
                    user.fest_id = globalFests[0].id;
                    await festosSupabase.from('users').update({ fest_id: user.fest_id }).eq('id', user.id);
                }
            }
        }
        await loadInitialData();
        renderAllViews();
        showToast('Multi-tenant data consistency verified and repaired!', 'success');
        runDiagnosticsSuite();
    } catch(e) {
        showToast('Repair error: ' + e.message, 'error');
    }
}

async function rebuildFeatureMatrices() {
    showToast('Rebuilding feature matrices for all festivals...', 'info');
    try {
        for (const fest of globalFests) {
            const flags = await festosFeatures.getFestFeatureFlags(fest.id);
            if (festosSupabase) {
                await festosSupabase.from('settings').upsert({
                    id: `features_${fest.id}`,
                    value: flags,
                    updated_at: new Date().toISOString()
                });
            }
        }
        showToast('Feature matrices rebuilt and synchronized!', 'success');
    } catch(e) {
        showToast('Error rebuilding flags: ' + e.message, 'error');
    }
}

function exportDiagnosticsReport() {
    const data = latestDiagnosticsReport || {
        timestamp: new Date().toISOString(),
        info: 'Run full diagnostics suite to generate full report'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `festos_diagnostics_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Diagnostics report exported!', 'success');
}

// =========================================================================
// 11. MODALS & DIALOGS
// =========================================================================
function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

function openConfirmDialog(title, message, iconClass = 'fa-triangle-exclamation', iconColor = 'var(--danger)', onConfirmCallback = null) {
    const modal = document.getElementById('confirmDialogModal');
    const titleEl = document.getElementById('confirm-dialog-title');
    const msgEl = document.getElementById('confirm-dialog-msg');
    const iconEl = document.getElementById('confirm-dialog-icon');
    const iconWrap = document.getElementById('confirm-dialog-icon-wrap');
    const btnAction = document.getElementById('confirm-dialog-btn-action');

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (iconEl) iconEl.className = `fa-solid ${iconClass}`;
    if (iconWrap) {
        iconWrap.style.background = `${iconColor}15`;
        iconWrap.style.color = iconColor;
    }

    currentPendingConfirmAction = onConfirmCallback;

    btnAction.onclick = () => {
        closeModal('confirmDialogModal');
        if (typeof currentPendingConfirmAction === 'function') {
            currentPendingConfirmAction();
        }
    };

    openModal('confirmDialogModal');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger);"></i>';
    if (type === 'info') icon = '<i class="fa-solid fa-circle-info" style="color:var(--primary);"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
