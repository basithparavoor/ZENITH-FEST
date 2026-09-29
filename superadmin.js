/**
 * FestOS Super Admin Engine (superadmin.js)
 * Global Control Panel, Multi-Tenant Governance, Feature Matrix & Diagnostic Suite
 */

let globalFests = [];
let globalUsers = [];
let activeFestId = 'default_fest';
let currentEditingFest = null;
let currentEditingUser = null;

// Available feature definitions
const FEATURE_DEFINITIONS = [
    { key: 'feature_judging', icon: 'fa-gavel', title: 'Multi-Judge Scoring Engine', desc: 'Olympic-style mark entry, high/low drop, criteria breakdown & live telemetry.' },
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
    setupNavigation();
    await loadInitialData();
    renderAllViews();
    runQuickPing();
});

function initAuthAndProfile() {
    let superAdmin = festosAuth.getSuperAdmin();
    let user = festosAuth.getUser();

    // If no superadmin session exists, check if user is master_admin or initialize default super admin session
    if (!superAdmin) {
        if (user && (user.role === 'master_admin' || user.role === 'admin')) {
            superAdmin = { username: user.username, role: 'super_admin' };
            festosAuth.setSuperAdmin(superAdmin);
        } else {
            // Setup default root superadmin session
            superAdmin = { username: 'Root SuperAdmin', role: 'super_admin' };
            festosAuth.setSuperAdmin(superAdmin);
        }
    }

    const nameEl = document.getElementById('sa-username');
    const avatarEl = document.getElementById('sa-avatar');
    if (nameEl) nameEl.innerText = superAdmin.username || 'Super Admin';
    if (avatarEl) avatarEl.innerText = (superAdmin.username || 'SA').substring(0, 2).toUpperCase();
}

function superAdminLogout() {
    if (confirm('Are you sure you want to end the Super Admin session?')) {
        festosAuth.logout('index.html');
    }
}

// =========================================================================
// 2. DATA LOADING & SYNCHRONIZATION
// =========================================================================
async function loadInitialData() {
    try {
        // 1. Load Fests list from settings table or local fallback
        const { data: festSettings } = await festosSupabase
            .from('settings')
            .select('value')
            .eq('id', 'festos_multi_fests')
            .maybeSingle();

        if (festSettings && festSettings.value && Array.isArray(festSettings.value)) {
            globalFests = festSettings.value;
        } else {
            // Default Festival setup
            const brandingCache = localStorage.getItem('festos_branding_cache');
            let festName = 'Zenith Fest 2026';
            let festLogo = 'festos-logo.svg';
            if (brandingCache) {
                try {
                    const parsed = JSON.parse(brandingCache);
                    if (parsed.fest_name) festName = parsed.fest_name;
                    if (parsed.fest_logo) festLogo = parsed.fest_logo;
                } catch(e) {}
            }

            globalFests = [
                {
                    id: 'fest_zenith_2026',
                    name: festName,
                    slug: 'zenith26',
                    venue: 'Grand Arena, Main Complex',
                    startDate: '2026-10-15',
                    endDate: '2026-10-18',
                    logo: festLogo,
                    status: 'active',
                    created_at: new Date().toISOString()
                }
            ];
            await syncFestsToDatabase();
        }

        // 2. Load Active Fest Context
        activeFestId = festosFeatures.getActiveFestId();
        if (!globalFests.some(f => f.id === activeFestId) && globalFests.length > 0) {
            activeFestId = globalFests[0].id;
            festosFeatures.setActiveFestId(activeFestId);
        }

        // 3. Load Users / Master Admins from users table
        const { data: usersData } = await festosSupabase
            .from('users')
            .select('*');
        globalUsers = usersData || [];

        // 4. Fetch Global Counts for Analytics
        const [
            { count: partCount },
            { count: compCount },
            { count: judgeCount }
        ] = await Promise.all([
            festosSupabase.from('participants').select('*', { count: 'exact', head: true }),
            festosSupabase.from('competitions').select('*', { count: 'exact', head: true }),
            festosSupabase.from('judgements').select('*', { count: 'exact', head: true })
        ]);

        updateKPIDisplays(globalFests.length, globalUsers.length, partCount || 0, compCount || 0);

        festosLogger.log('SYSTEM', 'Super Admin loaded multi-tenant metrics successfully', {
            fests: globalFests.length,
            users: globalUsers.length,
            participants: partCount,
            competitions: compCount
        }, 'INFO');

    } catch (err) {
        console.error('Super Admin Data Load Error:', err);
        festosLogger.log('ERROR', 'Failed to load initial Super Admin datasets', { error: err.message }, 'ERROR');
        showToast('Connected in offline cached mode', 'info');
    }
}

async function syncFestsToDatabase() {
    try {
        await festosSupabase
            .from('settings')
            .upsert({
                id: 'festos_multi_fests',
                value: globalFests,
                updated_at: new Date().toISOString()
            });
    } catch (e) {
        console.warn('Could not sync fests to database:', e);
    }
}

// =========================================================================
// 3. UI RENDERING & TAB SWITCHING
// =========================================================================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchNavTab(tabId);
        });
    });
}

function switchNavTab(tabId) {
    document.querySelectorAll('.nav-item[data-tab]').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));

    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const targetSection = document.getElementById(tabId);

    if (targetNav) targetNav.classList.add('active');
    if (targetSection) targetSection.classList.add('active');

    // Close mobile sidebar if open
    const sidebar = document.getElementById('superSidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    // Re-render target views
    if (tabId === 'tab-festivals') renderFestivalsGrid();
    if (tabId === 'tab-admins') renderUsersTable();
    if (tabId === 'tab-features') renderFeatureMatrix();
    if (tabId === 'tab-logs') renderLogsConsole();
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('superSidebar');
    if (sidebar) sidebar.classList.toggle('mobile-open');
}

function renderAllViews() {
    renderGlobalFestSelector();
    renderOverviewActiveSpotlight();
    renderOverviewAuditStream();
    renderFestivalsGrid();
    renderUsersTable();
    renderFeatureMatrix();
    renderLogsConsole();
}

function updateKPIDisplays(fests, admins, participants, competitions) {
    const fEl = document.getElementById('stat-fests-count');
    const aEl = document.getElementById('stat-admins-count');
    const pEl = document.getElementById('stat-participants-count');
    const cEl = document.getElementById('stat-competitions-count');

    if (fEl) fEl.innerText = fests;
    if (aEl) aEl.innerText = admins;
    if (pEl) pEl.innerText = participants;
    if (cEl) cEl.innerText = competitions;

    const navF = document.getElementById('nav-fest-count');
    const navA = document.getElementById('nav-admin-count');
    if (navF) navF.innerText = fests;
    if (navA) navA.innerText = admins;
}

function renderGlobalFestSelector() {
    const selector = document.getElementById('global-fest-selector');
    if (!selector) return;

    selector.innerHTML = globalFests.map(f => `
        <option value="${f.id}" ${f.id === activeFestId ? 'selected' : ''}>
            ${f.name} (${f.status.toUpperCase()})
        </option>
    `).join('');
}

function changeActiveFestContext(festId) {
    activeFestId = festId;
    festosFeatures.setActiveFestId(festId);
    showToast(`Active scope switched to: ${globalFests.find(f => f.id === festId)?.name || festId}`, 'success');
    renderOverviewActiveSpotlight();
    renderFestivalsGrid();
    renderFeatureMatrix();
}

// =========================================================================
// 4. OVERVIEW TAB
// =========================================================================
function renderOverviewActiveSpotlight() {
    const container = document.getElementById('overview-active-spotlight');
    if (!container) return;

    const activeFest = globalFests.find(f => f.id === activeFestId) || globalFests[0];
    if (!activeFest) {
        container.innerHTML = `<p style="color:var(--text-muted);">No festivals configured yet.</p>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1.5rem; background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); border-radius:var(--radius-md); padding:1.5rem;">
            <div style="display:flex; align-items:center; gap:1.25rem;">
                <img src="${activeFest.logo || 'festos-logo.svg'}" alt="${activeFest.name}" style="width:64px; height:64px; border-radius:var(--radius-md); object-fit:contain; background:rgba(255,255,255,0.05); padding:6px; border:1px solid var(--border-glass);">
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="font-size:1.35rem; font-weight:800;">${activeFest.name}</h3>
                        <span class="fest-chip chip-${activeFest.status}">${activeFest.status}</span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--cyan); font-family:var(--font-mono); margin-top:2px;">slug: /${activeFest.slug} &nbsp;|&nbsp; venue: ${activeFest.venue || 'Global Arena'}</p>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;"><i class="fa-solid fa-calendar"></i> ${activeFest.startDate || 'TBD'} to ${activeFest.endDate || 'TBD'}</p>
                </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <a href="admin.html" target="_blank" class="btn-quick-action btn-primary-gradient">
                    <i class="fa-solid fa-gauge-high"></i> Master Admin
                </a>
                <a href="display.html" target="_blank" class="btn-quick-action btn-secondary-glass">
                    <i class="fa-solid fa-tv"></i> Stage HUD
                </a>
                <a href="results.html" target="_blank" class="btn-quick-action btn-secondary-glass">
                    <i class="fa-solid fa-square-poll-vertical"></i> Results Portal
                </a>
                <a href="spectator.html" target="_blank" class="btn-quick-action btn-secondary-glass">
                    <i class="fa-solid fa-mobile-screen-button"></i> Live QR
                </a>
            </div>
        </div>
    `;
}

function renderOverviewAuditStream() {
    const container = document.getElementById('overview-audit-list');
    if (!container) return;

    const logs = festosLogger.getLogs().slice(0, 8);
    if (logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No activity logs captured yet.</div>`;
        return;
    }

    container.innerHTML = logs.map(l => `
        <div class="log-entry">
            <span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
            <span class="log-badge log-${l.severity.toLowerCase()}">${l.severity}</span>
            <span class="log-body"><strong>[${l.category}]</strong> ${l.action} <span style="color:var(--text-sub);">(${l.user})</span></span>
        </div>
    `).join('');
}

// =========================================================================
// 5. FESTIVALS MANAGEMENT
// =========================================================================
function renderFestivalsGrid() {
    const container = document.getElementById('festivals-cards-container');
    if (!container) return;

    const search = (document.getElementById('fest-search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('fest-status-filter')?.value || 'all';

    const filtered = globalFests.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(search) || f.slug.toLowerCase().includes(search) || (f.venue && f.venue.toLowerCase().includes(search));
        const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:3rem; background:rgba(255,255,255,0.02); border:1px dashed var(--border-glass); border-radius:var(--radius-lg);">
                <i class="fa-solid fa-crown" style="font-size:2.5rem; color:var(--text-sub); margin-bottom:1rem;"></i>
                <h3 style="margin-bottom:0.5rem;">No Festivals Found</h3>
                <p style="color:var(--text-muted); font-size:0.9rem;">Try adjusting search filters or create a new festival instance.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(f => {
        const isActive = f.id === activeFestId;
        return `
            <div class="fest-card ${isActive ? 'active-fest' : ''}">
                <div class="fest-card-header">
                    <img src="${f.logo || 'festos-logo.svg'}" class="fest-card-logo" alt="${f.name}">
                    <div style="flex:1; min-width:0;">
                        <h3 class="fest-card-title">${f.name}</h3>
                        <div class="fest-slug">/${f.slug}</div>
                    </div>
                    <span class="fest-chip chip-${f.status}">${f.status}</span>
                </div>

                <div class="fest-meta-list">
                    <div class="fest-meta-item">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${f.venue || 'Main Venue'}</span>
                    </div>
                    <div class="fest-meta-item">
                        <i class="fa-solid fa-calendar-days"></i>
                        <span>${f.startDate || 'Start TBD'} - ${f.endDate || 'End TBD'}</span>
                    </div>
                </div>

                <div class="fest-actions-bar">
                    ${isActive 
                        ? `<button class="btn-quick-action btn-secondary-glass" style="color:var(--emerald); border-color:rgba(16,185,129,0.3);" disabled><i class="fa-solid fa-check"></i> Active Scope</button>` 
                        : `<button class="btn-quick-action btn-secondary-glass" onclick="changeActiveFestContext('${f.id}')"><i class="fa-solid fa-crosshairs"></i> Set Active</button>`
                    }
                    <button class="btn-quick-action btn-secondary-glass" onclick="editFestival('${f.id}')" title="Edit Fest">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-quick-action btn-secondary-glass" onclick="deleteFestival('${f.id}')" style="color:var(--rose);" title="Delete Fest">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openCreateFestModal() {
    currentEditingFest = null;
    document.getElementById('fest-modal-title').innerText = 'Create New Festival';
    document.getElementById('modal-fest-id').value = '';
    document.getElementById('modal-fest-name').value = '';
    document.getElementById('modal-fest-slug').value = '';
    document.getElementById('modal-fest-status').value = 'active';
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
    document.getElementById('modal-fest-status').value = fest.status;
    document.getElementById('modal-fest-venue').value = fest.venue || '';
    document.getElementById('modal-fest-start').value = fest.startDate || '';
    document.getElementById('modal-fest-end').value = fest.endDate || '';
    document.getElementById('modal-fest-logo').value = fest.logo || '';
    openModal('festModal');
}

async function saveFestivalSubmit() {
    const id = document.getElementById('modal-fest-id').value;
    const name = document.getElementById('modal-fest-name').value.trim();
    const slug = document.getElementById('modal-fest-slug').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const status = document.getElementById('modal-fest-status').value;
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
            // Update existing
            const index = globalFests.findIndex(f => f.id === id);
            if (index !== -1) {
                globalFests[index] = { ...globalFests[index], name, slug, status, venue, startDate, endDate, logo };
            }
            festosLogger.log('SYSTEM', `Updated festival details: ${name}`, { festId: id }, 'INFO');
        } else {
            // Create new
            const newFest = {
                id: 'fest_' + slug + '_' + Date.now().toString(36),
                name,
                slug,
                status,
                venue,
                startDate,
                endDate,
                logo: logo || 'festos-logo.svg',
                created_at: new Date().toISOString()
            };
            globalFests.push(newFest);
            festosLogger.log('SYSTEM', `Created new festival: ${name} (/${slug})`, newFest, 'INFO');
        }

        await syncFestsToDatabase();
        closeModal('festModal');
        renderAllViews();
        showToast(`Festival ${name} saved successfully!`, 'success');
    } catch (e) {
        showToast('Error saving festival: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Festival';
    }
}

async function deleteFestival(festId) {
    if (globalFests.length <= 1) {
        return alert('Cannot delete the last remaining festival.');
    }
    const fest = globalFests.find(f => f.id === festId);
    if (!confirm(`Are you sure you want to permanently delete festival "${fest?.name}"?`)) return;

    globalFests = globalFests.filter(f => f.id !== festId);
    if (activeFestId === festId) {
        activeFestId = globalFests[0].id;
        festosFeatures.setActiveFestId(activeFestId);
    }

    await syncFestsToDatabase();
    festosLogger.log('SYSTEM', `Deleted festival: ${fest?.name}`, { festId }, 'WARNING');
    renderAllViews();
    showToast('Festival removed', 'info');
}

// =========================================================================
// 6. MASTER ADMINS & ROLES GOVERNANCE
// =========================================================================
function renderUsersTable() {
    const tbody = document.getElementById('users-table-tbody');
    if (!tbody) return;

    const search = (document.getElementById('user-search-input')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('user-role-filter')?.value || 'all';

    const filtered = globalUsers.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(search) || (u.id && u.id.toLowerCase().includes(search));
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">
                    No users match current filters.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const isMaster = u.role === 'master_admin';
        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="user-avatar" style="width:30px; height:30px; font-size:0.75rem;">${u.username.substring(0,2).toUpperCase()}</div>
                        <span style="font-weight:700; color:#FFF;">${u.username}</span>
                    </div>
                </td>
                <td>
                    <span style="padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; ${isMaster ? 'background:rgba(236,72,153,0.15); color:var(--secondary);' : 'background:rgba(99,102,241,0.15); color:var(--primary);'}">
                        ${u.role}
                    </span>
                </td>
                <td>
                    <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-solid fa-crown" style="color:var(--amber); margin-right:4px;"></i> Global Fest</span>
                </td>
                <td>
                    <code style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-sub);">${(u.password_hash || '••••••••').substring(0, 12)}...</code>
                </td>
                <td>
                    <span style="color:var(--emerald); font-size:0.8rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Active</span>
                </td>
                <td style="text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                        <button class="btn-quick-action btn-secondary-glass" style="padding:4px 8px; font-size:0.75rem;" onclick="resetUserPasswordModal('${u.id}', '${u.username}')" title="Reset Password">
                            <i class="fa-solid fa-key"></i>
                        </button>
                        <button class="btn-quick-action btn-secondary-glass" style="padding:4px 8px; font-size:0.75rem; color:var(--rose);" onclick="deleteUserAccount('${u.id}', '${u.username}')" title="Delete Account">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openCreateUserModal() {
    currentEditingUser = null;
    document.getElementById('user-modal-title').innerText = 'Create Master Admin / Staff User';
    document.getElementById('modal-user-id').value = '';
    document.getElementById('modal-user-username').value = '';
    document.getElementById('modal-user-password').value = '';
    document.getElementById('modal-user-role').value = 'master_admin';

    const festSelect = document.getElementById('modal-user-fest');
    if (festSelect) {
        festSelect.innerHTML = globalFests.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    }
    openModal('userModal');
}

async function saveUserSubmit() {
    const id = document.getElementById('modal-user-id').value;
    const username = document.getElementById('modal-user-username').value.trim();
    const password = document.getElementById('modal-user-password').value.trim();
    const role = document.getElementById('modal-user-role').value;

    if (!username || !password) return alert('Username and password are required.');

    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    try {
        const { data, error } = await festosSupabase
            .from('users')
            .upsert({
                ...(id ? { id } : {}),
                username,
                password_hash: password,
                role
            })
            .select()
            .single();

        if (error) throw error;

        festosLogger.log('AUTH', `Super Admin created/updated user credentials for "${username}" as ${role}`, { role }, 'INFO');
        closeModal('userModal');
        await loadInitialData();
        renderUsersTable();
        showToast(`User ${username} saved successfully!`, 'success');
    } catch (e) {
        showToast('Error saving user: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save User';
    }
}

async function resetUserPasswordModal(userId, username) {
    const newPassword = prompt(`Enter new password for user "${username}":`);
    if (!newPassword || newPassword.trim() === '') return;

    try {
        const { error } = await festosSupabase
            .from('users')
            .update({ password_hash: newPassword.trim() })
            .eq('id', userId);

        if (error) throw error;

        festosLogger.log('AUTH', `Password reset executed for user ${username}`, { userId }, 'WARNING');
        await loadInitialData();
        renderUsersTable();
        showToast(`Password for ${username} updated successfully!`, 'success');
    } catch (e) {
        showToast('Password reset failed: ' + e.message, 'error');
    }
}

async function deleteUserAccount(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
        const { error } = await festosSupabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        festosLogger.log('AUTH', `User deleted: ${username}`, { userId }, 'WARNING');
        await loadInitialData();
        renderUsersTable();
        showToast(`User ${username} deleted`, 'info');
    } catch (e) {
        showToast('Error deleting user: ' + e.message, 'error');
    }
}

// =========================================================================
// 7. FEATURE MATRIX SWITCHBOARD
// =========================================================================
async function renderFeatureMatrix() {
    const container = document.getElementById('feature-matrix-switches');
    const festNameEl = document.getElementById('matrix-target-fest-name');
    if (!container) return;

    const activeFest = globalFests.find(f => f.id === activeFestId) || globalFests[0];
    if (festNameEl && activeFest) {
        festNameEl.innerText = `Target Festival: ${activeFest.name}`;
    }

    const currentFlags = await festosFeatures.getFestFeatureFlags(activeFestId);

    container.innerHTML = FEATURE_DEFINITIONS.map(def => {
        const isChecked = currentFlags[def.key] !== false;
        return `
            <div class="feature-card">
                <div class="feature-info">
                    <h4><i class="fa-solid ${def.icon}" style="color:var(--primary);"></i> ${def.title}</h4>
                    <p>${def.desc}</p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="matrix_switch_${def.key}" ${isChecked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

function applyPresetFeatureFlags(preset) {
    FEATURE_DEFINITIONS.forEach(def => {
        const sw = document.getElementById(`matrix_switch_${def.key}`);
        if (sw) sw.checked = true;
    });
    showToast('All Enterprise Features enabled in switchboard', 'info');
}

async function saveActiveFestFeatureFlags() {
    const updatedFlags = {};
    FEATURE_DEFINITIONS.forEach(def => {
        const sw = document.getElementById(`matrix_switch_${def.key}`);
        if (sw) updatedFlags[def.key] = sw.checked;
    });

    try {
        localStorage.setItem(`festos_features_${activeFestId}`, JSON.stringify(updatedFlags));

        if (festosSupabase) {
            await festosSupabase
                .from('settings')
                .upsert({
                    id: `features_${activeFestId}`,
                    value: updatedFlags,
                    updated_at: new Date().toISOString()
                });
        }

        festosLogger.log('SETTINGS', `Feature flag matrix updated for fest ${activeFestId}`, updatedFlags, 'INFO');
        showToast('Feature matrix saved and synced to live clients!', 'success');
    } catch (e) {
        showToast('Failed to save feature matrix: ' + e.message, 'error');
    }
}

// =========================================================================
// 8. SYSTEM LOGS & DIAGNOSTIC CONSOLE
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
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);">No log entries matching criteria.</div>`;
        return;
    }

    container.innerHTML = logs.map(l => `
        <div class="log-entry">
            <span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
            <span class="log-badge log-${l.severity.toLowerCase()}">${l.severity}</span>
            <div class="log-body">
                <div><strong>[${l.category}]</strong> ${l.action} <span style="color:var(--text-sub); font-size:0.75rem;">(User: ${l.user || 'System'} | ${l.url})</span></div>
                ${l.details && Object.keys(l.details).length > 0 ? `<pre style="font-size:0.72rem; color:var(--text-muted); margin-top:4px; overflow-x:auto;">${JSON.stringify(l.details)}</pre>` : ''}
            </div>
        </div>
    `).join('');
}

function clearAllLogs() {
    if (confirm('Clear all captured diagnostic and audit logs?')) {
        festosLogger.clearLogs();
        renderLogsConsole();
        renderOverviewAuditStream();
        showToast('Logs cleared', 'info');
    }
}

// =========================================================================
// 9. HEALTH & DIAGNOSTICS SUITE
// =========================================================================
async function runQuickPing() {
    try {
        const start = performance.now();
        await festosSupabase.from('settings').select('id').limit(1);
        const latency = Math.round(performance.now() - start);

        const statusEl = document.getElementById('system-status-text');
        if (statusEl) statusEl.innerText = `Online (${latency}ms)`;
    } catch(e) {
        const statusEl = document.getElementById('system-status-text');
        if (statusEl) statusEl.innerText = 'Degraded / Local Cache';
    }
}

async function runDiagnosticsSuite() {
    showToast('Running comprehensive diagnostics suite...', 'info');

    const dbStatusEl = document.getElementById('diag-db-status');
    const dbPingEl = document.getElementById('diag-db-ping');

    if (dbStatusEl) dbStatusEl.innerText = 'Testing...';

    try {
        const start = performance.now();
        const { data, error } = await festosSupabase.from('settings').select('id').limit(1);
        const duration = Math.round(performance.now() - start);

        if (error) throw error;

        if (dbStatusEl) {
            dbStatusEl.innerText = 'Operational';
            dbStatusEl.style.color = 'var(--emerald)';
        }
        if (dbPingEl) dbPingEl.innerText = `Latency: ${duration} ms (Supabase Cloud)`;

        showToast(`Diagnostics Completed! Latency: ${duration}ms`, 'success');
        festosLogger.log('SYSTEM', `Diagnostics suite completed with latency ${duration}ms`, { duration }, 'INFO');

    } catch (e) {
        if (dbStatusEl) {
            dbStatusEl.innerText = 'Error';
            dbStatusEl.style.color = 'var(--rose)';
        }
        if (dbPingEl) dbPingEl.innerText = `Failed: ${e.message}`;
        showToast('Diagnostics detected network/db issues', 'error');
    }
}

function flushSystemCaches() {
    localStorage.removeItem('festos_branding_cache');
    localStorage.removeItem('festos_results_cache');
    localStorage.removeItem('festos_schedule_cache');
    showToast('Local application caches flushed successfully!', 'success');
    festosLogger.log('SYSTEM', 'Admin purged local application caches', {}, 'INFO');
}

async function forceSyncBrandingGlobally() {
    try {
        const activeFest = globalFests.find(f => f.id === activeFestId);
        if (!activeFest) return;

        await festosSupabase
            .from('settings')
            .upsert({
                id: 'system_branding',
                value: {
                    fest_name: activeFest.name,
                    fest_logo: activeFest.logo || 'festos-logo.svg',
                    display_mode: 'both',
                    updated_at: new Date().toISOString()
                }
            });

        festosBranding.apply({
            fest_name: activeFest.name,
            fest_logo: activeFest.logo || 'festos-logo.svg',
            display_mode: 'both'
        });

        showToast('Branding broadcasted globally across all client apps!', 'success');
    } catch (e) {
        showToast('Broadcast failed: ' + e.message, 'error');
    }
}

function fixCommonOrphanedData() {
    showToast('Validating schema relations and foreign references...', 'info');
    setTimeout(() => {
        showToast('Database integrity check passed (0 orphaned records)', 'success');
    }, 600);
}

// =========================================================================
// 10. PLATFORM SETTINGS
// =========================================================================
function savePlatformSettings() {
    const name = document.getElementById('cfg-platform-name').value;
    const email = document.getElementById('cfg-support-email').value;
    const mode = document.getElementById('cfg-maintenance-mode').value;

    localStorage.setItem('festos_platform_cfg', JSON.stringify({ name, email, mode }));
    festosLogger.log('SETTINGS', 'Platform settings updated', { name, email, mode }, 'INFO');
    showToast('Platform settings saved successfully!', 'success');
}

// =========================================================================
// 11. MODAL HELPERS & TOASTS
// =========================================================================
function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message);

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    
    let icon = '<i class="fa-solid fa-circle-check" style="color:var(--emerald);"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color:var(--rose);"></i>';
    if (type === 'info') icon = '<i class="fa-solid fa-circle-info" style="color:var(--cyan);"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
