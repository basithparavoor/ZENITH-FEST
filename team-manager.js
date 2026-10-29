const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);

// Auth & Role Check (allow team_manager, master_admin, admin, super_admin)
const user = (typeof festosAuth !== 'undefined') ? (festosAuth.getUser() || festosAuth.getSuperAdmin()) : JSON.parse(localStorage.getItem('festUser') || localStorage.getItem('festSuperAdmin') || 'null');
const allowedTmRoles = ['team_manager', 'master_admin', 'admin', 'super_admin'];
if (!user || !allowedTmRoles.includes(user.role)) {
    window.location.href = 'index.html';
}

// Global State
const urlParams = new URLSearchParams(window.location.search);
let myTeamId = user.team_id || urlParams.get('team_id') || urlParams.get('id');
if (!myTeamId) {
    try {
        myTeamId = sessionStorage.getItem('festos_tm_selected_team_id') || localStorage.getItem('festos_tm_selected_team_id');
    } catch(e) {}
}
if (myTeamId) {
    try { sessionStorage.setItem('festos_tm_selected_team_id', myTeamId); } catch(e) {}
}
let isAssignmentLocked = false;
let globalStudents = [];
let globalComps = [];
let globalAssignments = [];
let globalCategories = [];
let globalStages = []; 
let currentCropper = null;
let systemSettings = {}; 
let tmScheduleData = {};

// Instantly restore cached team info so "LOADING TEAM..." never hangs on screen
function restoreCachedTeamHeader() {
    if (!myTeamId) return;
    try {
        const cachedTeam = JSON.parse(sessionStorage.getItem('festos_tm_team_' + myTeamId) || 'null');
        if (cachedTeam) {
            const titleEl = document.getElementById('team-name-title');
            if (titleEl && cachedTeam.name) titleEl.innerText = cachedTeam.name;
            const mgrNamesEl = document.getElementById('tm-manager-names');
            if (mgrNamesEl) {
                const mgr = cachedTeam.manager_name || 'NOT ASSIGNED';
                const asst = cachedTeam.assistant_manager_name || 'NOT ASSIGNED';
                mgrNamesEl.innerHTML = `<i class="fa-solid fa-user-tie"></i> MGR: ${mgr} <span style="color:var(--border);">|</span> ASST: ${asst}`;
            }
        }
    } catch (e) {}
}

// Immediate invocation for zero-latency UI rendering
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreCachedTeamHeader);
    } else {
        restoreCachedTeamHeader();
    }
}

// UI Utils
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

// Modal & Loading Utils
function openModal(title, bodyHTML, saveFunction) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.onclick = saveFunction;
    saveBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> SUBMIT';
    saveBtn.disabled = false;

    document.getElementById('formModal').classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('formModal');
    if(modal) modal.classList.remove('show');
}

function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSING...';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalText || 'SUBMIT';
        btn.disabled = false;
    }
}

// =========================================================================
// 3-STEP COLLAPSIBLE SIDEBAR ENGINE (TEAM MANAGER)
// Step 0: Expanded -> Step 1: Compact (Buttons Only) -> Step 2: Hidden -> Step 0
// =========================================================================
function toggleMobileMenu() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.toggle('open');
        document.querySelector('.mobile-overlay').classList.toggle('open');
    } else {
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
            localStorage.setItem('festos_team_sidebar_state', nextState);
        } catch (e) {}
        updateTeamSidebarTooltip(nextState);

        window.dispatchEvent(new Event('resize'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    }
}

function updateTeamSidebarTooltip(state) {
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

// Restore Team Manager desktop 3-step state on load
try {
    if (window.innerWidth > 768) {
        const savedState = localStorage.getItem('festos_team_sidebar_state');
        if (savedState === 'compact') {
            document.body.classList.add('sidebar-compact');
            updateTeamSidebarTooltip('compact');
        } else if (savedState === 'hidden' || savedState === 'true') {
            document.body.classList.add('sidebar-hidden');
            updateTeamSidebarTooltip('hidden');
        } else {
            updateTeamSidebarTooltip('expanded');
        }
    }
} catch (e) {}

// Ctrl+B shortcut for desktop sidebar collapse
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        toggleMobileMenu();
    }
});

function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll(`[onclick*="switchTab('${tabId}')"]`).forEach(el => {
        el.classList.add('active');
    });

    if (tabId === 'appeals') loadAppeals();
    if (tabId === 'assignments') {
        if (typeof window.switchAssignView === 'function') {
            window.switchAssignView('list');
        } else {
            populateAssignOverviewCategoryDropdown();
            renderAssignOverview();
            populateBulkAssignCategoryDropdown();
        }
    }
    if (tabId === 'schedule') { populateSchedCatFilter(); renderTMSchedule(); }

    const mainContent = document.querySelector('.main-content');
    if(mainContent) mainContent.scrollTop = 0;
    
    // Auto-close sidebar on mobile
    if(window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.querySelector('.mobile-overlay').classList.remove('open');
    }
}

// Modal Controllers
function openConfirmModal(title, text, confirmCallback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.onclick = () => {
        closeConfirmModal();
        if (confirmCallback) confirmCallback();
    };
    document.getElementById('confirmModal').classList.add('show');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

function logout() {
    openConfirmModal("Sign Out", "Are you sure you want to securely log out of the Team Manager portal?", () => {
        if (typeof festosAuth !== 'undefined' && festosAuth.logout) {
            festosAuth.logout('index.html?logout=true');
        } else {
            localStorage.removeItem('festUser');
            localStorage.removeItem('festSuperAdmin');
            localStorage.removeItem('festos_remember_session');
            localStorage.removeItem('festos_active_fest_id');
            localStorage.removeItem('festos_tm_selected_team_id');
            localStorage.removeItem('festBranding');
            localStorage.removeItem('festos_branding_cache_active');
            if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
            window.location.href = 'index.html?logout=true';
        }
    });
}

// Instant Local SWR Caching System
function saveDashboardToCache() {
    if (!myTeamId) return;
    try {
        const payload = {
            teamData: {
                name: document.getElementById('team-name-title')?.innerText || 'MY TEAM',
                manager_names_html: document.getElementById('tm-manager-names')?.innerHTML || ''
            },
            categories: globalCategories,
            stages: globalStages,
            students: globalStudents,
            competitions: globalComps,
            assignments: globalAssignments,
            stats: {
                studentsCount: globalStudents.length,
                eventsCount: new Set(globalAssignments.map(a => a.competition_id)).size,
                completedCount: globalComps.filter(c => c.status === 'published' || c.status === 'judgement_complete').length,
                points: document.getElementById('stat-total-points')?.innerText || '0'
            },
            timestamp: Date.now()
        };
        sessionStorage.setItem('festos_tm_dashboard_cache_' + myTeamId, JSON.stringify(payload));
        localStorage.setItem('festos_tm_dashboard_cache_' + myTeamId, JSON.stringify(payload));
    } catch (e) {}
}

function restoreDashboardFromCache() {
    if (!myTeamId) return false;
    try {
        const raw = sessionStorage.getItem('festos_tm_dashboard_cache_' + myTeamId) || 
                    localStorage.getItem('festos_tm_dashboard_cache_' + myTeamId);
        if (!raw) return false;
        const cache = JSON.parse(raw);
        if (!cache || !Array.isArray(cache.students) || cache.students.length === 0) return false;

        // Restore team header
        if (cache.teamData && cache.teamData.name && cache.teamData.name !== 'LOADING TEAM...') {
            const titleEl = document.getElementById('team-name-title');
            if (titleEl) titleEl.innerText = cache.teamData.name;
            const mgrNamesEl = document.getElementById('tm-manager-names');
            if (mgrNamesEl && cache.teamData.manager_names_html) {
                mgrNamesEl.innerHTML = cache.teamData.manager_names_html;
            }
        }

        if (Array.isArray(cache.categories) && cache.categories.length > 0) {
            globalCategories = cache.categories;
            window.categoriesList = globalCategories;
        }
        if (Array.isArray(cache.stages) && cache.stages.length > 0) {
            globalStages = cache.stages;
            window.globalStages = globalStages;
        }
        if (Array.isArray(cache.students) && cache.students.length > 0) {
            globalStudents = cache.students;
            window.globalStudents = globalStudents;
            window.participantsList = globalStudents;
        }
        if (Array.isArray(cache.competitions) && cache.competitions.length > 0) {
            globalComps = cache.competitions;
        }
        if (Array.isArray(cache.assignments)) {
            globalAssignments = cache.assignments;
        }

        // Restore stats immediately (0ms)
        if (cache.stats) {
            const sTotal = document.getElementById('stat-total-students');
            const sEvents = document.getElementById('stat-total-events');
            const sComps = document.getElementById('stat-completed-events');
            const sPts = document.getElementById('stat-total-points');
            if (sTotal) sTotal.innerText = cache.stats.studentsCount || globalStudents.length;
            if (sEvents) sEvents.innerText = cache.stats.eventsCount || 0;
            if (sComps) sComps.innerText = cache.stats.completedCount || 0;
            if (sPts) sPts.innerText = cache.stats.points || 0;
        }

        // Populate catalog filter dropdown
        const catSet = new Set(globalComps.map(c => c.categories?.name || 'GENERAL'));
        const catSelect = document.getElementById('filter-catalog-cat');
        if (catSelect && catSet.size > 0) {
            catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
            catSet.forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        }

        // Render tables immediately
        renderStudents();
        renderCatalog();
        renderLiveTracking();
        populateBulkAssignCategoryDropdown();
        populateAssignOverviewCategoryDropdown();
        renderAssignOverview();

        return true;
    } catch (e) {
        return false;
    }
}

async function initDashboard() {
    if (window.innerWidth > 768) {
        const sub = document.getElementById('desktop-subtitle');
        if (sub) sub.style.display = 'block';
    }

    // 1. Instantly restore header and full dashboard from local cache in 0.001s!
    restoreCachedTeamHeader();
    const hasCachedData = restoreDashboardFromCache();

    // 2. Fetch fresh data in parallel (SWR background revalidation)
    try {
        await fetchAllData(false, hasCachedData);
    } catch (e) {
        console.error(e);
        if (!hasCachedData) showToast("Error loading dashboard data", "error");
    }
}

async function refreshDashboard(btnElement) {
    if (btnElement) {
        const icon = btnElement.querySelector('i');
        if (icon) icon.classList.add('fa-spin'); 
    }
    
    try {
        await fetchAllData(true);
        showToast('Dashboard Data Synced!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Failed to sync data.', 'error');
    } finally {
        if (btnElement) {
            const icon = btnElement.querySelector('i');
            if (icon) icon.classList.remove('fa-spin'); 
        }
    }
}

async function fetchAllData(forceFresh = false, isBackgroundSync = false) {
    try {
        // Ensure myTeamId is resolved for all roles including team_manager
        if (!myTeamId) {
            myTeamId = user.team_id || sessionStorage.getItem('festos_tm_selected_team_id') || localStorage.getItem('festos_tm_selected_team_id');
        }
        if (!myTeamId && user && user.id && supabaseClient) {
            try {
                const { data: uRec } = await supabaseClient.from('users').select('team_id, fest_id').eq('id', user.id).maybeSingle();
                if (uRec && uRec.team_id) {
                    myTeamId = uRec.team_id;
                    user.team_id = myTeamId;
                    try {
                        localStorage.setItem('festUser', JSON.stringify(user));
                        sessionStorage.setItem('festos_tm_selected_team_id', myTeamId);
                    } catch(e) {}
                }
            } catch(e) {}
        }
        if (!myTeamId && supabaseClient) {
            const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId) ? window.festosAuth.getCurrentFestId() : (user.fest_id || localStorage.getItem('festos_active_fest_id'));
            let fallbackTeamQuery = supabaseClient.from('teams').select('id, name, manager_name, assistant_manager_name');
            if (activeFid) fallbackTeamQuery = fallbackTeamQuery.eq('fest_id', activeFid);
            const { data: firstTeam } = await fallbackTeamQuery.limit(1).maybeSingle();
            if (firstTeam) {
                myTeamId = firstTeam.id;
                try { sessionStorage.setItem('festos_tm_selected_team_id', myTeamId); } catch(e) {}
            }
        }

        let catsQuery = supabaseClient.from('categories').select('*');
        let stagesQuery = supabaseClient.from('stages').select('*').order('stage_no');
        // Optimized: only select fields necessary for Team Manager
        let compsQuery = supabaseClient.from('competitions').select('id, name, category_id, stage_id, status, is_group, is_offstage, max_participants, max_mark, categories(id, name, is_general, allowed_general_categories), stages(name)').order('name');
        if (window.festosApplyFilter) {
            catsQuery = window.festosApplyFilter(catsQuery);
            compsQuery = window.festosApplyFilter(compsQuery);
            stagesQuery = window.festosApplyFilter(stagesQuery);
        }

        // Fire all independent queries in parallel (1 network round-trip)
        const teamPromise = myTeamId 
            ? supabaseClient.from('teams').select('name, manager_name, assistant_manager_name').eq('id', myTeamId).maybeSingle()
            : Promise.resolve({ data: null });

        const pointPromise = window.festosGetSetting 
            ? window.festosGetSetting('point_system', null, { fresh: forceFresh }) 
            : supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle().then(r => r.data?.value);

        const schedPromise = window.festosGetSetting 
            ? window.festosGetSetting('master_schedule', null, { fresh: forceFresh }) 
            : supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle().then(r => r.data?.value);

        const classSysPromise = window.festosGetSetting 
            ? window.festosGetSetting('class_system', null, { fresh: forceFresh }) 
            : Promise.resolve(null);

        const catClassesPromise = window.festosGetSetting 
            ? window.festosGetSetting('category_classes', null, { fresh: forceFresh }) 
            : Promise.resolve({});

        const partClassesPromise = window.festosGetSetting 
            ? window.festosGetSetting('participant_classes', null, { fresh: forceFresh }) 
            : Promise.resolve({});

        const studentsPromise = myTeamId 
            ? supabaseClient.from('participants').select('*, categories(name)').eq('team_id', myTeamId).order('name')
            : Promise.resolve({ data: [] });

        const [
            teamRes,
            pointSysVal,
            schedVal,
            classSystemSetting,
            catClassesMapRaw,
            partClassesMapRaw,
            catsRes,
            studentsRes,
            compsRes,
            stagesRes
        ] = await Promise.all([
            teamPromise,
            pointPromise,
            schedPromise,
            classSysPromise,
            catClassesPromise,
            partClassesPromise,
            catsQuery,
            studentsPromise,
            compsQuery,
            stagesQuery
        ]);

        // 1. Process Team Data
        const teamData = teamRes?.data;
        if (teamData) {
            try { sessionStorage.setItem('festos_tm_team_' + myTeamId, JSON.stringify(teamData)); } catch(e) {}
            const titleEl = document.getElementById('team-name-title');
            if (titleEl) titleEl.innerText = teamData.name || 'MY TEAM';
            const mgrNamesEl = document.getElementById('tm-manager-names');
            if (mgrNamesEl) {
                const mgr = teamData.manager_name || 'NOT ASSIGNED';
                const asst = teamData.assistant_manager_name || 'NOT ASSIGNED';
                mgrNamesEl.innerHTML = `<i class="fa-solid fa-user-tie"></i> MGR: ${mgr} <span style="color:var(--border);">|</span> ASST: ${asst}`;
            }
        } else if (!document.getElementById('team-name-title').innerText || document.getElementById('team-name-title').innerText === 'LOADING TEAM...') {
            document.getElementById('team-name-title').innerText = 'MY TEAM';
        }

        // 2. Process Point System & Lock Settings
        if (pointSysVal) {
            systemSettings = pointSysVal;
            if (systemSettings.tm_access === false) {
                isAssignmentLocked = true;
            }
        }
        if (isAssignmentLocked && !systemSettings.lock_date) {
            const lockBanner = document.getElementById('lock-banner');
            if (lockBanner) lockBanner.style.display = 'flex';
            const b1 = document.getElementById('btn-bulk-enroll');
            const b2 = document.getElementById('btn-bulk-remove');
            if (b1) b1.disabled = true;
            if (b2) b2.disabled = true;
        }

        // 3. Process Class System & Categories & Participants
        const catClassesMap = catClassesMapRaw || {};
        const partClassesMap = partClassesMapRaw || {};
        window.tmClassSystem = classSystemSetting || { enabled: false, mandatory: false, classes: [] };
        tmScheduleData = schedVal || {};

        const cats = catsRes?.data || [];
        const students = studentsRes?.data || [];
        const comps = compsRes?.data || [];
        const stages = stagesRes?.data || [];
        globalStages = stages;
        window.globalStages = globalStages;

        globalCategories = cats.map(c => ({
            ...c,
            eligible_classes: c.eligible_classes || catClassesMap[c.id] || []
        }));
        globalStudents = students.map(s => ({
            ...s,
            class_name: s.class_name || partClassesMap[s.id] || ''
        }));
        window.globalStudents = globalStudents;
        window.globalParticipants = globalStudents;
        window.participantsList = globalStudents;
        window.categoriesList = globalCategories;
        window.globalCategories = globalCategories;
        globalComps = comps;
        window.globalCompetitions = globalComps;

        // 4. Batch 2: Fetch participant assignments and judgements in parallel
        const studentIds = globalStudents.map(s => s.id);
        const publishedCompIds = globalComps.filter(c => c.status === 'published').map(c => c.id);

        const [assignsRes, judgementsRes] = await Promise.all([
            studentIds.length > 0 
                ? supabaseClient.from('participant_competitions').select('id, participant_id, competition_id, is_leader, is_present').in('participant_id', studentIds)
                : Promise.resolve({ data: [] }),
            publishedCompIds.length > 0
                ? supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark').in('competition_id', publishedCompIds)
                : Promise.resolve({ data: [] })
        ]);

        globalAssignments = assignsRes?.data || [];
        const judgements = judgementsRes?.data || [];

        const catSet = new Set(globalComps.map(c => c.categories?.name || 'GENERAL'));
        const catSelect = document.getElementById('filter-catalog-cat');
        if (catSelect) {
            catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
            catSet.forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        }

        const studentMissingCatSelect = document.getElementById('filter-student-missing-cat');
        if (studentMissingCatSelect) {
            const curVal = studentMissingCatSelect.value;
            let catOptions = `
                <option value="">MISSING IN CATEGORY: NONE</option>
                <option value="own_category">⚠️ MISSING IN OWN CATEGORY</option>
            `;
            const uniqueCats = [];
            const seenCatIds = new Set();
            globalComps.forEach(c => {
                const cid = c.category_id || c.categories?.id;
                const cname = c.categories?.name || 'GENERAL';
                if (cid && !seenCatIds.has(String(cid))) {
                    seenCatIds.add(String(cid));
                    uniqueCats.push({ id: cid, name: cname, is_general: !!(c.categories?.is_general) });
                }
            });
            if (uniqueCats.length > 0) {
                catOptions += `<optgroup label="No Events in Specific Category:">`;
                uniqueCats.forEach(c => {
                    catOptions += `<option value="${c.id}">NO EVENTS IN ${c.name.toUpperCase()}${c.is_general ? ' (GENERAL)' : ''}</option>`;
                });
                catOptions += `</optgroup>`;
            }
            studentMissingCatSelect.innerHTML = catOptions;
            if (curVal) studentMissingCatSelect.value = curVal;
        }

        // Enforce Deadline & Update UI
        if (systemSettings.lock_date) {
            const deadline = new Date(systemSettings.lock_date);
            const now = new Date();
            const deadlineBanner = document.getElementById('dashboard-deadline-banner');
            if (deadlineBanner) {
                deadlineBanner.style.display = 'flex';
                document.getElementById('deadline-text').innerText = `REGISTRATION CLOSES: ${deadline.toLocaleString()}`;
            }

            if (now > deadline) {
                isAssignmentLocked = true;
                if (deadlineBanner) {
                    deadlineBanner.style.background = 'var(--danger-light)';
                    deadlineBanner.style.color = 'var(--danger)';
                    deadlineBanner.style.borderColor = 'rgba(225, 29, 72, 0.2)';
                    document.getElementById('deadline-text').innerText = `REGISTRATION CLOSED ON: ${deadline.toLocaleString()}`;
                }
                const lockBanner = document.getElementById('lock-banner');
                if (lockBanner) {
                    lockBanner.style.display = 'flex';
                    lockBanner.innerHTML = `<i class="fa-solid fa-lock"></i> REGISTRATION DEADLINE HAS PASSED. ENROLLMENTS ARE LOCKED.`;
                    const btnBulkEnroll = document.getElementById('btn-bulk-enroll');
                    const btnBulkRemove = document.getElementById('btn-bulk-remove');
                    if (btnBulkEnroll) btnBulkEnroll.disabled = true;
                    if (btnBulkRemove) btnBulkRemove.disabled = true;
                }
                const btnAddMember = document.getElementById('btn-add-member');
                if (btnAddMember) {
                    btnAddMember.disabled = true;
                    btnAddMember.innerHTML = `<i class="fa-solid fa-lock"></i> REGISTRATION LOCKED`;
                    btnAddMember.style.opacity = '0.6';
                }
            } else if (!isAssignmentLocked) {
                const lockBanner = document.getElementById('lock-banner');
                if (lockBanner) lockBanner.style.display = 'none';
                const btnBulkEnroll = document.getElementById('btn-bulk-enroll');
                const btnBulkRemove = document.getElementById('btn-bulk-remove');
                if (btnBulkEnroll) btnBulkEnroll.disabled = false;
                if (btnBulkRemove) btnBulkRemove.disabled = false;
                const btnAddMember = document.getElementById('btn-add-member');
                if (btnAddMember) {
                    btnAddMember.disabled = false;
                    btnAddMember.innerHTML = `<i class="fa-solid fa-user-plus"></i> ADD NEW MEMBER`;
                    btnAddMember.style.opacity = '1';
                }
            }
        }

        updateDashboardStats(judgements);
        renderStudents();
        renderCatalog();
        renderLiveTracking();
        populateBulkAssignCategoryDropdown();
        populateAssignOverviewCategoryDropdown();
        renderAssignOverview();

        // Persist to local SWR cache for instant load next time
        saveDashboardToCache();

    } catch (e) {
        console.error("fetchAllData error:", e);
    }
}

async function updateDashboardStats(prefetchedJudgements = null) {
    document.getElementById('stat-total-students').innerText = globalStudents.length;
    const uniqueEvents = new Set(globalAssignments.map(a => a.competition_id)).size;
    document.getElementById('stat-total-events').innerText = uniqueEvents;
    
    const completedComps = globalComps.filter(c => c.status === 'published' || c.status === 'judgement_complete');
    document.getElementById('stat-completed-events').innerText = completedComps.length;

    // Calculate Estimated Team Points natively
    let totalPoints = 0;
    try {
        const publishedCompIds = globalComps.filter(c => c.status === 'published').map(c => c.id);
        if (publishedCompIds.length > 0) {
            let judgements = prefetchedJudgements;
            if (!judgements) {
                const res = await supabaseClient
                    .from('judgements')
                    .select('participant_id, competition_id, awarded_mark')
                    .in('competition_id', publishedCompIds);
                judgements = res.data || [];
            }
            
            const myStudentIds = globalStudents.map(s => s.id);
            const compAverages = {};
            
            (judgements || []).forEach(j => {
                if(!compAverages[j.competition_id]) compAverages[j.competition_id] = {};
                if(!compAverages[j.competition_id][j.participant_id]) compAverages[j.competition_id][j.participant_id] = [];
                compAverages[j.competition_id][j.participant_id].push(parseFloat(j.awarded_mark));
            });

            publishedCompIds.forEach(compId => {
                const comp = globalComps.find(c => c.id === compId);
                if (!comp || !compAverages[compId]) return;

                const participantsArr = Object.entries(compAverages[compId]).map(([pId, marks]) => {
                    let sortedMarks = marks.sort((a, b) => a - b);
                    if (sortedMarks.length >= 3) sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
                    const avg = sortedMarks.reduce((a, b) => a + b, 0) / sortedMarks.length;
                    return { id: pId, mark: avg };
                }).sort((a, b) => b.mark - a.mark);

                const limit = comp.max_participants || 1;
                const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
                
                let currentRank = 1;
                let previousScore = -1;

                participantsArr.forEach((p, index) => {
                    if (p.mark !== previousScore) currentRank = index + 1;
                    previousScore = p.mark;

                    let percent = (p.mark / (comp.max_mark || 100)) * 100;
                    let gradePts = 0; let posPts = 0;

                    if (percent >= 50 && systemSettings.thresholds) {
                        if (percent >= systemSettings.thresholds.aplus) gradePts = Number(systemSettings[`points_${sizeCat}`]?.aplus) || 0;
                        else if (percent >= systemSettings.thresholds.a) gradePts = Number(systemSettings[`points_${sizeCat}`]?.a) || 0;
                        else if (percent >= systemSettings.thresholds.b) gradePts = Number(systemSettings[`points_${sizeCat}`]?.b) || 0;
                        else gradePts = Number(systemSettings[`points_${sizeCat}`]?.c) || 0;
                    }
                    if (currentRank <= 3 && systemSettings.pos_points) {
                        if (currentRank === 1) posPts = Number(systemSettings.pos_points.p1) || 0;
                        else if (currentRank === 2) posPts = Number(systemSettings.pos_points.p2) || 0;
                        else if (currentRank === 3) posPts = Number(systemSettings.pos_points.p3) || 0;
                    }
                    
                    // If the participant belongs to MY team, add the points to the TM dashboard
                    if (myStudentIds.includes(p.id)) {
                        totalPoints += (gradePts + posPts);
                    }
                });
            });
        }
    } catch (e) { console.error("Point calculation error", e); }
    
    document.getElementById('stat-total-points').innerText = Math.round(totalPoints);
}

// ---------------- STUDENT DIRECTORY ----------------
function updateStudentPillCounts() {
    const students = globalStudents || [];
    let enrolledCount = 0;
    let zeroCount = 0;
    let missingOwnCatCount = 0;

    students.forEach(student => {
        const myAssigns = (globalAssignments || []).filter(a => String(a.participant_id) === String(student.id));
        const count = myAssigns.length;
        if (count > 0) enrolledCount++;
        else zeroCount++;

        const studentCatId = student.category_id || student.categories?.id;
        const studentCatName = (student.categories?.name || '').toLowerCase();
        const assignedCompIds = new Set(myAssigns.map(a => String(a.competition_id)));
        const assignedComps = (globalComps || []).filter(c => assignedCompIds.has(String(c.id)));

        const hasOwnCat = assignedComps.some(c => 
            (studentCatId && String(c.category_id) === String(studentCatId)) ||
            (studentCatName && (c.categories?.name || '').toLowerCase() === studentCatName)
        );
        if (!hasOwnCat) missingOwnCatCount++;
    });

    const elTotal = document.getElementById('tm-count-all');
    const elEnrolled = document.getElementById('tm-count-enrolled');
    const elZero = document.getElementById('tm-count-zero');
    const elNoOwn = document.getElementById('tm-count-no-own-cat');

    if (elTotal) elTotal.innerText = students.length;
    if (elEnrolled) elEnrolled.innerText = enrolledCount;
    if (elZero) elZero.innerText = zeroCount;
    if (elNoOwn) elNoOwn.innerText = missingOwnCatCount;
}

function setStudentPillFilter(type) {
    const enrollSelect = document.getElementById('filter-student-enrollment');
    const missingCatSelect = document.getElementById('filter-student-missing-cat');

    document.querySelectorAll('#my-team .part-pill').forEach(btn => btn.classList.remove('active'));

    if (type === 'zero') {
        if (enrollSelect) enrollSelect.value = 'none';
        if (missingCatSelect) missingCatSelect.value = '';
        document.getElementById('student-pill-zero')?.classList.add('active');
    } else if (type === 'enrolled') {
        if (enrollSelect) enrollSelect.value = 'enrolled';
        if (missingCatSelect) missingCatSelect.value = '';
        document.getElementById('student-pill-enrolled')?.classList.add('active');
    } else if (type === 'no_own_cat') {
        if (enrollSelect) enrollSelect.value = '';
        if (missingCatSelect) missingCatSelect.value = 'own_category';
        document.getElementById('student-pill-no-own-cat')?.classList.add('active');
    } else {
        if (enrollSelect) enrollSelect.value = '';
        if (missingCatSelect) missingCatSelect.value = '';
        document.getElementById('student-pill-all')?.classList.add('active');
    }

    renderStudents();
}
window.setStudentPillFilter = setStudentPillFilter;

function onStudentEnrollmentSelectChange() {
    const val = document.getElementById('filter-student-enrollment')?.value || '';
    document.querySelectorAll('#my-team .part-pill').forEach(btn => btn.classList.remove('active'));
    if (val === 'none') {
        document.getElementById('student-pill-zero')?.classList.add('active');
    } else if (val === 'enrolled') {
        document.getElementById('student-pill-enrolled')?.classList.add('active');
    } else {
        document.getElementById('student-pill-all')?.classList.add('active');
    }
    renderStudents();
}
window.onStudentEnrollmentSelectChange = onStudentEnrollmentSelectChange;

function renderStudents() {
    const search = document.getElementById('search-students')?.value?.toLowerCase() || '';
    const enrollFilter = document.getElementById('filter-student-enrollment')?.value || '';
    const missingCatFilter = document.getElementById('filter-student-missing-cat')?.value || '';
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    updateStudentPillCounts();

    let matchedCount = 0;
    (globalStudents || []).forEach(student => {
        if (search && !student.name.toLowerCase().includes(search) && !student.unique_id.toLowerCase().includes(search)) return;

        const myAssignments = (globalAssignments || []).filter(a => String(a.participant_id) === String(student.id));
        const enrollCount = myAssignments.length;

        // Enrollment Presence Filter
        if (enrollFilter === 'none' && enrollCount > 0) return;
        if (enrollFilter === 'enrolled' && enrollCount === 0) return;

        // Missing Category Program Filter
        if (missingCatFilter) {
            const assignedCompIds = new Set(myAssignments.map(a => String(a.competition_id)));
            const assignedComps = (globalComps || []).filter(c => assignedCompIds.has(String(c.id)));

            if (missingCatFilter === 'own_category') {
                const studentCatId = student.category_id || student.categories?.id;
                const studentCatName = (student.categories?.name || '').toLowerCase();
                const hasOwnCat = assignedComps.some(c => 
                    (studentCatId && String(c.category_id) === String(studentCatId)) ||
                    (studentCatName && (c.categories?.name || '').toLowerCase() === studentCatName)
                );
                // Exclude if they DO have enrollment in own category
                if (hasOwnCat) return;
            } else {
                // Specific category
                const hasSpecificCat = assignedComps.some(c => 
                    String(c.category_id) === String(missingCatFilter) ||
                    (c.categories?.name || '').toLowerCase() === String(missingCatFilter).toLowerCase()
                );
                // Exclude if they DO have enrollment in this category
                if (hasSpecificCat) return;
            }
        }

        matchedCount++;
        const badgeClass = enrollCount > 0 ? 'badge-info' : 'badge-warning';
        const photoSrc = student.photo_url ? student.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3EPHOTO%3C/text%3E%3C/svg%3E';

        tbody.innerHTML += `
            <tr>
                <td data-label="STUDENT NAME" style="display: flex; align-items: center; gap: 0.85rem; justify-content: flex-start; text-align: left;">
                    <img src="${photoSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--border); box-shadow: var(--shadow-sm); flex-shrink: 0;">
                    <div>
                        <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-main); display: block;">${student.name}</span>
                        ${student.class_name ? `<span style="font-size: 0.72rem; background: #EEF2FF; color: #4F46E5; padding: 1px 6px; border-radius: 4px; font-weight: 700; display: inline-block; margin-top: 2px;"><i class="fa-solid fa-graduation-cap" style="margin-right: 2px;"></i>${student.class_name}</span>` : ''}
                    </div>
                </td>
                <td data-label="UNIQUE ID" style="font-family: monospace;">${student.unique_id}</td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${student.categories?.name || 'GENERAL'}</span></td>
                <td data-label="DOB" style="font-weight: 800; color: var(--text-muted);">${student.dob || 'N/A'}</td>
                <td data-label="EVENTS ENROLLED">
                    <span class="badge ${badgeClass}" onclick="viewStudentEvents('${student.id}')" title="Click to view enrolled events">${enrollCount} ${enrollCount === 1 ? 'EVENT' : 'EVENTS'} <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left: 4px;"></i></span>
                </td>
            </tr>
        `;
    });

    if (matchedCount === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-user-slash" style="font-size: 1.75rem; color: #CBD5E1; display: block; margin-bottom: 0.5rem;"></i>No students found matching current filters.</td></tr>`;
    }
}

function viewStudentEvents(studentId) {
    const student = globalStudents.find(s => String(s.id) === String(studentId));
    if (!student) {
        if (typeof showToast === 'function') showToast('Participant details not found', 'error');
        return;
    }
    const assignedComps = globalAssignments.filter(a => String(a.participant_id) === String(studentId)).map(a => a.competition_id);
    
    const titleEl = document.getElementById('se-modal-title');
    if (titleEl) titleEl.innerText = `${(student.name || 'STUDENT').toUpperCase()}'S EVENTS`;
    const body = document.getElementById('se-modal-body');
    if (!body) return;
    body.innerHTML = '';
    
    if (assignedComps.length === 0) {
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-weight: 700; padding: 2rem 0;">NO EVENTS ASSIGNED TO THIS PARTICIPANT.</p>`;
    } else {
        assignedComps.forEach(compId => {
            const comp = globalComps.find(c => String(c.id) === String(compId));
            if (comp) {
                const statusText = comp.status ? comp.status.replace(/_/g, ' ') : 'SCHEDULED';
                body.innerHTML += `
                    <div style="padding: 1.25rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--text-main);">${comp.name || 'Unnamed Event'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> ${comp.categories?.name || 'EVENT'}</div>
                        </div>
                        <span class="badge badge-gray" style="text-transform: uppercase;">${statusText}</span>
                    </div>
                `;
            }
        });
    }
    const modal = document.getElementById('studentEventsModal');
    if (modal) modal.classList.add('show');
}
window.viewStudentEvents = viewStudentEvents;

window.validateTMDobAndClass = function() {
    const catSelect = document.getElementById('partCategory');
    const dobInput = document.getElementById('partDob');
    const classSelect = document.getElementById('partClass');
    const warningEl = document.getElementById('tmDobWarning');
    const saveBtn = document.getElementById('modalSaveBtn');
    
    if(!catSelect || !warningEl) return;
    
    const catId = catSelect.value;
    const dobVal = dobInput ? dobInput.value : '';
    const classVal = classSelect ? classSelect.value : '';
    
    const category = globalCategories.find(c => String(c.id) === String(catId));
    let isInvalid = false;
    let warningMsg = '';

    const catClasses = category?.eligible_classes || [];
    const hasClassRestrictions = Array.isArray(catClasses) && catClasses.length > 0;

    let dobMismatch = false;
    if(category && dobVal) {
        const dobDate = new Date(dobVal);
        if (category.dob_start && dobDate < new Date(category.dob_start)) {
            dobMismatch = true;
            warningMsg = `NOT ELIGIBLE: MUST BE BORN ON OR AFTER ${category.dob_start}.`;
        }
        if (category.dob_end && dobDate > new Date(category.dob_end)) {
            dobMismatch = true;
            warningMsg = `NOT ELIGIBLE: MUST BE BORN ON OR BEFORE ${category.dob_end}.`;
        }
    }

    // SMART AGE AUTO-CORRECTION:
    if (dobMismatch && classVal && dobVal) {
        const dobDate = new Date(dobVal);
        const standardCats = globalCategories.filter(c => !c.is_general);

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
            if(saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
            showToast(`Auto-adjusted category to ${alternateCat.name}!`, 'info');
            return;
        }
    }

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
        if(saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }
    } else {
        warningEl.style.display = 'none';
        warningEl.style.background = 'transparent';
        warningEl.style.border = 'none';
        warningEl.style.padding = '0';
        if(saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
    }
};
window.validateTMDob = window.validateTMDobAndClass;

function openAddMemberModal() {
    if (isAssignmentLocked) return showToast("Registration is locked by Admin.", "error");

    // Common/General category is NOT for students! Filter out is_general
    const studentCategories = globalCategories.filter(c => !c.is_general);
    let catOpts = studentCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const pPhoto = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23EEF2FF"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236366F1"%3EPHOTO%3C/text%3E%3C/svg%3E';
    
    // Class Dropdown markup if Class System is enabled
    let classDropdownHtml = '';
    const isClassActive = !!(window.tmClassSystem?.enabled && window.tmClassSystem.classes?.length > 0);
    if (isClassActive) {
        const isMandatory = !!window.tmClassSystem.mandatory;
        classDropdownHtml = `
            <div class="form-group" style="flex: 1; min-width: 130px; margin-bottom: 1rem;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">CLASS / GRADE ${isMandatory ? '<span style="color: var(--danger);">*</span>' : '<span style="font-size:0.7rem; font-weight:500;">(OPTIONAL)</span>'}</label>
                <select id="partClass" onchange="window.validateTMDobAndClass()" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--input-bg); outline: none; font-weight: 700;">
                    <option value="">-- SELECT CLASS --</option>
                    ${window.tmClassSystem.classes.map(cls => `<option value="${cls}">${cls}</option>`).join('')}
                </select>
            </div>
        `;
    }

    const modalHtml = `
        <style>
            .part-modal-grid { display: grid; grid-template-columns: 150px 1fr; gap: 2rem; align-items: start; }
            @media (max-width: 600px) { .part-modal-grid { grid-template-columns: 1fr; gap: 1rem; text-align: center; } }
            .photo-preview-container img { width: 100%; max-width: 150px; aspect-ratio: 2/3; object-fit: cover; border-radius: 12px; border: 2.5px solid var(--border); padding: 4px; box-shadow: var(--shadow-sm); background: white; }
            .photo-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; justify-content: center; }
            .photo-actions .btn { padding: 0.4rem; font-size: 0.75rem; flex: 1; min-height: 36px; }
        </style>
        
        <div class="part-modal-grid">
            <div class="photo-preview-container">
                <img id="partPhotoPreview" src="${pPhoto}" alt="Participant Photo">
                <input type="file" id="partPhoto" accept="image/png, image/jpeg, image/webp" onchange="triggerCropper(this)" style="display: none;">
                <div class="photo-actions">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('partPhoto').click()" title="Upload New Photo"><i class="fa-solid fa-upload"></i> NEW</button>
                    <button type="button" class="btn btn-outline" onclick="editExistingCrop()" title="Adjust Current Crop"><i class="fa-solid fa-crop-simple"></i> CROP</button>
                </div>
            </div>

            <div class="form-fields" style="text-align: left;">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">FULL NAME <span style="color: var(--danger);">*</span></label>
                    <input type="text" id="partName" placeholder="E.G. JOHN DOE" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--input-bg); outline: none; font-weight: 700;">
                </div>
                
                <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 2; min-width: 150px; margin-bottom: 1rem;">
                        <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">CATEGORY <span style="color: var(--danger);">*</span></label>
                        <select id="partCategory" onchange="window.validateTMDobAndClass()" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--input-bg); outline: none; font-weight: 700;">${catOpts}</select>
                    </div>
                    
                    ${classDropdownHtml}

                    <div class="form-group" style="flex: 1; min-width: 130px; margin-bottom: 1rem;">
                        <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">DATE OF BIRTH</label>
                        <input type="date" id="partDob" onchange="window.validateTMDobAndClass()" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--input-bg); outline: none; font-weight: 700; text-transform: none;">
                    </div>
                </div>
                
                <!-- TM Warning injection -->
                <div id="tmDobWarning" style="color: var(--danger); font-size: 0.8rem; font-weight: 800; margin-bottom: 1rem; display: none;"></div>
            </div>
        </div>
    `;

    openModal('REGISTER NEW STUDENT', modalHtml, saveNewMember);
}

async function saveNewMember() {
    if (isAssignmentLocked) return showToast("Registration is locked.", "error");

    const name = document.getElementById('partName').value;
    const category_id = document.getElementById('partCategory').value;
    const dob = document.getElementById('partDob').value || null;
    const classVal = document.getElementById('partClass') ? document.getElementById('partClass').value : '';

    if (window.tmClassSystem?.enabled && window.tmClassSystem?.mandatory && !classVal) {
        return showToast("Class / Grade selection is mandatory!", "error");
    }

    const unique_id = `${Math.floor(100000 + Math.random() * 900000)}`;
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    
    try {
        let photo_url = undefined; 

        try {
            const blob = await getParticipantPhotoBlobHelper();
            if (blob) {
                showToast('Uploading participant photo...', 'info');
                const fileName = `profile_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
                const { error: uploadError } = await supabaseClient.storage
                    .from('photos')
                    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseClient.storage.from('photos').getPublicUrl(fileName);
                if (publicUrlData && publicUrlData.publicUrl) {
                    photo_url = publicUrlData.publicUrl;
                }
            }
        } catch (photoErr) {
            console.error("Photo upload error:", photoErr);
            showToast("Notice: Photo upload issue: " + (photoErr.message || photoErr), "warning");
        }

        const payload = { 
            name, 
            category_id, 
            dob, 
            unique_id, 
            team_id: myTeamId, 
            class_name: classVal || null 
        };
        if (photo_url) payload.photo_url = photo_url;

        const finalPayload = window.festosWithFest ? window.festosWithFest(payload) : payload;
        let { data: insertedData, error } = await supabaseClient.from('participants').insert([finalPayload]).select();
        
        if (error && error.message && error.message.includes('class_name')) {
            delete finalPayload.class_name;
            const retry = await supabaseClient.from('participants').insert([finalPayload]).select();
            if (retry.error) throw retry.error;
            const savedId = retry.data?.[0]?.id;
            if (savedId && window.festosSaveSetting) {
                const map = (await window.festosGetSetting('participant_classes')) || {};
                map[savedId] = classVal;
                await window.festosSaveSetting('participant_classes', map);
            }
        } else if (error) {
            throw error;
        } else {
            const savedId = insertedData?.[0]?.id;
            if (savedId && classVal && window.festosSaveSetting) {
                const map = (await window.festosGetSetting('participant_classes')) || {};
                map[savedId] = classVal;
                await window.festosSaveSetting('participant_classes', map);
            }
        }
        
        showToast('Student added successfully!', 'success');
        
        if(currentCropper) { currentCropper.destroy(); currentCropper = null; }
        closeModal(); 
        await fetchAllData();
        
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}

// --- ROBUST PARTICIPANT PHOTO HELPER (MOBILE & DESKTOP) ---
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

// --- CROPPER LIFECYCLE ---
function triggerCropper(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const rawData = e.target.result;
        const img = new Image();
        img.onload = function() {
            // Downscale to prevent mobile memory exhaustion
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

            // Instantly update thumbnail in form so user sees photo immediately on mobile
            const preview = document.getElementById('partPhotoPreview');
            if (preview) preview.src = optimized;

            // Open cropper modal (z-index: 9999) if Cropper is available
            const cropperModal = document.getElementById('cropperModal');
            const image = document.getElementById('cropperImage');
            if (cropperModal && image && typeof Cropper !== 'undefined') {
                image.src = optimized;
                cropperModal.classList.add('show');
                if (currentCropper) {
                    try { currentCropper.destroy(); } catch(err) {}
                }
                currentCropper = new Cropper(image, {
                    aspectRatio: 2 / 3,
                    viewMode: 2, 
                    background: false,
                    autoCropArea: 0.9
                });
            }
        };
        img.src = rawData;
    };
    reader.readAsDataURL(file);
}

function cancelCropper() {
    const modal = document.getElementById('cropperModal');
    if (modal) modal.classList.remove('show');
    if (currentCropper) { 
        try { currentCropper.destroy(); } catch(e) {}
        currentCropper = null; 
    }
}

function confirmCrop() {
    if (currentCropper) {
        const canvas = currentCropper.getCroppedCanvas({ width: 400, height: 600 });
        if (canvas) {
            document.getElementById('partPhotoPreview').src = canvas.toDataURL('image/jpeg', 0.85);
        }
    }
    const modal = document.getElementById('cropperModal');
    if (modal) modal.classList.remove('show');
}

function editExistingCrop() {
    const currentSrc = document.getElementById('partPhotoPreview')?.src || '';
    if (!currentSrc || currentSrc.includes('w3.org') || currentSrc.includes('svg')) {
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
        aspectRatio: 2 / 3,
        viewMode: 2, 
        background: false,
        autoCropArea: 0.9
    });
}

function renderCatalog() {
    const search = document.getElementById('search-catalog').value.toLowerCase();
    const typeFilter = document.getElementById('filter-catalog-type').value;
    const catFilter = document.getElementById('filter-catalog-cat').value;
    const tbody = document.getElementById('catalog-tbody');
    tbody.innerHTML = '';

    globalComps.forEach(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        
        if (typeFilter === 'group' && !comp.is_group) return;
        if (typeFilter === 'individual' && comp.is_group) return;
        if (catFilter !== 'all' && catName !== catFilter) return;
        if (search && !comp.name.toLowerCase().includes(search) && !catName.toLowerCase().includes(search)) return;

        const venueInfo = (window.festosGetCompVenueStage || getCompVenueStage)(comp, globalStages);
        const stageName = venueInfo.htmlBadge;
            
        const limitDisplay = comp.max_participants ? comp.max_participants : 'NO LIMIT';
        
        const typeBadge = comp.is_group 
            ? `<span class="badge" style="background:var(--primary-light); color:var(--primary);"><i class="fa-solid fa-users"></i> GROUP (LIMIT: ${limitDisplay})</span>`
            : `<span class="badge" style="background:var(--success-light); color:#059669;"><i class="fa-solid fa-user"></i> SOLO (LIMIT: ${limitDisplay})</span>`;

        tbody.innerHTML += `
            <tr>
                <td data-label="EVENT NAME" style="font-weight: 700; color: var(--text-main);"></td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="VENUE / STAGE"><span style="font-weight: 700; color: var(--primary);"><i class="fa-solid fa-microphone-stage" style="margin-right: 5px;"></i> ${venueInfo.name}</span></td>
                <td data-label="TYPE & LIMIT">${typeBadge}</td>
            </tr>
        `;
        tbody.lastElementChild.firstElementChild.innerText = comp.name;
    });
}

async function exportCatalogPDF() {
    showToast('Generating Catalog PDF...', 'success');
    
    const search = (document.getElementById('search-catalog')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('filter-catalog-type')?.value || 'all';
    const catFilter = document.getElementById('filter-catalog-cat')?.value || 'all';
    
    const filteredComps = globalComps.filter(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        if (typeFilter === 'group' && !comp.is_group) return false;
        if (typeFilter === 'individual' && comp.is_group) return false;
        if (catFilter !== 'all' && catName !== catFilter) return false;
        if (search && !comp.name.toLowerCase().includes(search) && !catName.toLowerCase().includes(search)) return false;
        return true;
    });

    const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId)
        ? window.festosAuth.getCurrentFestId()
        : (JSON.parse(localStorage.getItem('festUser') || '{}').fest_id || localStorage.getItem('festos_active_fest_id') || null);

    const soloCount = filteredComps.filter(c => !c.is_group).length;
    const groupCount = filteredComps.filter(c => c.is_group).length;
    const distinctCats = [...new Set(filteredComps.map(c => c.categories?.name || 'General'))];

    const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
        ? window.festosGetPDFHeaderHTML('OFFICIAL EVENT & COMPETITION CATALOG', activeFid, {
            badge: `${filteredComps.length} EVENTS`,
            subtitle: 'OFFICIAL FESTIVAL COMPETITIONS REPOSITORY'
        })
        : getPDFHeaderHTML('Event Catalog');

    const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
        ? window.festosGetPDFFooterHTML(null, null, 'Official Event Catalog')
        : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

    let tableRows = filteredComps.map((c, i) => {
        const bg = (i % 2 === 1) ? '#F8FAFC' : '#FFFFFF';
        const venueInfo = (window.festosGetCompVenueStage || getCompVenueStage)(c, globalStages);
        const stageName = venueInfo.name || "TBD";
        const typeBadge = c.is_group 
            ? `<span style="background: #FDF2F8; color: #9D174D; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block;">GROUP (MAX ${c.max_participants})</span>` 
            : `<span style="background: #F0FDF4; color: #166534; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block;">SOLO (MAX ${c.max_participants})</span>`;
        
        return `
        <tr style="height: 32px; page-break-inside: avoid; break-inside: avoid;">
            <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 11px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${i + 1}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11.5px; background: ${bg};">${c.name.toUpperCase()}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 130px;">
                <span style="background: #EFF6FF; color: #2563EB; font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block;">${(c.categories?.name || 'GENERAL').toUpperCase()}</span>
            </td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #4F46E5; font-size: 11px; background: ${bg}; width: 130px;">${stageName}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 140px;">${typeBadge}</td>
        </tr>
    `}).join('');

    if (filteredComps.length === 0) {
        tableRows = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #64748B; font-weight: 600;">No competitions matched the selected criteria.</td></tr>`;
    }

    const contentHtml = `
        <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}

            <!-- KPI Summary Bar -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Total Events</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0F172A; margin-top: 2px;">${filteredComps.length}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Solo Competitions</div>
                    <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 2px;">${soloCount}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Group Competitions</div>
                    <div style="font-size: 18px; font-weight: 900; color: #7C3AED; margin-top: 2px;">${groupCount}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Categories Covered</div>
                    <div style="font-size: 18px; font-weight: 900; color: #2563EB; margin-top: 2px;">${distinctCats.length}</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #CBD5E1;">
                <thead>
                    <tr style="background: #0F172A; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;">
                        <th style="padding: 8px 6px; text-align: center; width: 35px;">#</th>
                        <th style="padding: 8px 10px;">EVENT NAME</th>
                        <th style="padding: 8px 10px; width: 130px;">CATEGORY</th>
                        <th style="padding: 8px 10px; width: 130px;">VENUE / STAGE</th>
                        <th style="padding: 8px 10px; width: 140px;">TYPE & CAPACITY</th>
                    </tr>
                </thead>
                <tbody style="font-size: 11px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>

            ${footerHtml}
        </div>
    `;

    try {
        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'portrait',
                filename: typeof getFestFileName === 'function' ? getFestFileName('Event_Catalog', 'pdf') : 'Fest_Event_Catalog.pdf',
                width: 800
            });
            showToast('Catalog PDF Exported!');
        } else {
            const opt = { 
                margin: 10, 
                filename: typeof getFestFileName === 'function' ? getFestFileName('Event_Catalog', 'pdf') : 'Event_Catalog.pdf', 
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('PDF Exported!');
        }
    } catch (e) {
        showToast('Error exporting PDF: ' + e.message, 'error');
    }
}

function viewCatalogEnrollments(compId) {
    const comp = globalComps.find(c => c.id === compId);
    const enrollments = globalAssignments.filter(a => a.competition_id === compId);
    
    document.getElementById('se-modal-title').innerText = `${comp.name} ENROLLMENTS`;
    const body = document.getElementById('se-modal-body');
    body.innerHTML = '';
    
    if (enrollments.length === 0) {
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-weight: 700; padding: 2rem 0;">NO STUDENTS ENROLLED IN THIS EVENT.</p>`;
    } else {
        enrollments.forEach(a => {
            const student = globalStudents.find(s => s.id === a.participant_id);
            if (student) {
                const leaderTag = a.is_leader ? '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 8px;">LEADER</span>' : '';
                body.innerHTML += `
                    <div style="padding: 1.25rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main); margin-bottom: 0.25rem;">${student.name} ${leaderTag}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); font-family: monospace; font-weight: 600;">${student.unique_id}</div>
                        </div>
                    </div>
                `;
            }
        });
    }
    document.getElementById('studentEventsModal').classList.add('show');
}

// ---------------- LIVE TRACKING ----------------
function renderLiveTracking() {
    const search = document.getElementById('search-comps').value.toLowerCase();
    const statusFilter = document.getElementById('filter-comp-status').value;
    const tbody = document.getElementById('competitions-tbody');
    tbody.innerHTML = '';

    globalComps.forEach(comp => {
        if (statusFilter !== 'all' && comp.status !== statusFilter) return;
        if (search && !comp.name.toLowerCase().includes(search)) return;

        const ourEnrolled = globalAssignments.filter(a => a.competition_id === comp.id).length;
        if (ourEnrolled === 0) return; 

        const catName = comp.categories?.name || 'UNCATEGORIZED';
        const stageName = comp.stages?.name || 'TBD';
        
        let statusBadge = `<span class="badge badge-gray" style="border: 1px solid var(--border);">UPCOMING</span>`;
        if(comp.status === 'ongoing' || comp.status === 'registration') statusBadge = `<span class="badge" style="background: #FEF3C7; color: #D97706; border: 1px solid rgba(245, 158, 11, 0.2);"><i class="fa-solid fa-satellite-dish fa-fade"></i> LIVE</span>`;
        if(comp.status === 'published' || comp.status === 'judgement_complete') statusBadge = `<span class="badge badge-success">COMPLETED</span>`;

        tbody.innerHTML += `
            <tr>
                <td data-label="EVENT NAME"></td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="STAGE"><span style="color: var(--text-muted); font-weight: 700;"><i class="fa-solid fa-microphone-stage" style="margin-right:4px;"></i> ${stageName}</span></td>
                <td data-label="STATUS">${statusBadge}</td>
                <td data-label="OUR ENROLLED">
                    <span class="badge badge-info" onclick="viewEnrolledDetails('${comp.id}')" style="cursor: pointer;">
                        ${ourEnrolled} ENROLLED <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left: 4px;"></i>
                    </span>
                </td>
            </tr>
        `;
        tbody.lastElementChild.firstElementChild.innerText = comp.name;
    });
}

function viewEnrolledDetails(compId) {
    const comp = globalComps.find(c => String(c.id) === String(compId));
    if (!comp) {
        if (typeof showToast === 'function') showToast('Competition not found', 'error');
        return;
    }
    const assignments = globalAssignments.filter(a => String(a.competition_id) === String(compId));
    
    // Check if the event is closed/live
    const status = comp.status || 'scheduled';
    const isEventClosed = ['ongoing', 'valuation', 'judgement_complete', 'published'].includes(status);
    const pendingLabel = isEventClosed ? 'NOT PARTICIPATED' : 'PENDING';
    const pendingBg = isEventClosed ? 'var(--danger-light)' : 'var(--warning-light)';
    const pendingColor = isEventClosed ? 'var(--danger)' : '#D97706';
    const pendingBorder = isEventClosed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';

    let checkedInHtml = '';
    let pendingHtml = '';

    assignments.forEach(a => {
        const s = globalStudents.find(student => String(student.id) === String(a.participant_id));
        if (s) {
            if(a.is_present) {
                checkedInHtml += `<div style="padding: 1rem; background: var(--success-light); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md); font-weight: 700; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${s.name} <span style="font-family: monospace; font-size: 0.8rem; background: white; padding: 4px 8px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${s.unique_id}</span></div>`;
            } else {
                pendingHtml += `<div style="padding: 1rem; background: ${pendingBg}; color: ${pendingColor}; border: 1px solid ${pendingBorder}; border-radius: var(--radius-md); font-weight: 700; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${s.name} <div style="display: flex; gap: 0.5rem; align-items: center;"><span style="font-size: 0.7rem; font-weight: 800;">${pendingLabel}</span><span style="font-family: monospace; font-size: 0.8rem; background: white; padding: 4px 8px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${s.unique_id}</span></div></div>`;
            }
        }
    });

    if(!checkedInHtml) checkedInHtml = '<div style="padding: 2.5rem; text-align: center; background: var(--bg-main); border-radius: var(--radius-md); color: var(--text-muted); font-weight: 700;">NO STUDENTS CHECKED IN</div>';
    if(!pendingHtml) pendingHtml = `<div style="padding: 2.5rem; text-align: center; background: var(--bg-main); border-radius: var(--radius-md); color: var(--text-muted); font-weight: 700;">NO ${pendingLabel} STUDENTS</div>`;

    const titleEl = document.getElementById('enroll-modal-title');
    if (titleEl) titleEl.innerText = comp.name || 'EVENT';
    const enrolledEl = document.getElementById('enroll-modal-enrolled');
    if (enrolledEl) enrolledEl.innerHTML = checkedInHtml;
    const pendingEl = document.getElementById('enroll-modal-pending');
    if (pendingEl) pendingEl.innerHTML = pendingHtml;
    
    // Update the pending column header
    const pTitleEl = document.getElementById('enroll-modal-pending-title');
    if (pTitleEl) {
        pTitleEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${pendingLabel}`;
        pTitleEl.style.color = pendingColor;
    }
    
    const modal = document.getElementById('enrollmentDetailsModal');
    if (modal) modal.classList.add('show');
}
window.viewEnrolledDetails = viewEnrolledDetails;

// ---------------- BULK ASSIGNMENTS ----------------

// ==========================================
// UNIFIED CATEGORY & STUDENT ELIGIBILITY ENGINE
// ==========================================
function isCategoryGeneral(catId, compCat) {
    if (!catId && !compCat) return false;
    const cat = compCat || (globalCategories || []).find(c => String(c.id) === String(catId));
    if (!cat) return false;
    if (cat.is_general === true || String(cat.is_general) === 'true') return true;
    const name = String(cat.name || '').trim().toLowerCase();
    if (name === 'general' || name.startsWith('general')) return true;

    // Check if any category has this category's ID in allowed_general_categories
    const targetId = String(cat.id || catId);
    return (globalCategories || []).some(c => {
        let raw = c.allowed_general_categories;
        let arr = [];
        try {
            if (typeof raw === 'string') arr = JSON.parse(raw);
            else if (Array.isArray(raw)) arr = raw;
        } catch(e) {}
        return arr.some(x => String(x) === targetId);
    });
}

function isStudentEligibleForComp(student, comp) {
    if (!student || !comp) return false;
    // 1. Direct category match
    if (String(student.category_id) === String(comp.category_id)) return true;

    // 2. Cross-category match for General Competitions
    const compCat = (globalCategories || []).find(c => String(c.id) === String(comp.category_id)) || comp.categories;
    const isGeneral = isCategoryGeneral(comp.category_id, compCat);

    if (isGeneral) {
        const studentCategory = (globalCategories || []).find(c => String(c.id) === String(student.category_id));
        if (!studentCategory) return true;

        let rawAllowed = studentCategory.allowed_general_categories;
        let allowedCats = [];
        try {
            if (typeof rawAllowed === 'string') allowedCats = JSON.parse(rawAllowed);
            else if (Array.isArray(rawAllowed)) allowedCats = rawAllowed;
        } catch(e) {}

        if (allowedCats.length > 0) {
            return allowedCats.some(id => String(id) === String(comp.category_id));
        }
        return true;
    }
    return false;
}

// Populates the first dropdown with categories
function populateBulkAssignCategoryDropdown() {
    const catSelect = document.getElementById('bulkAssignCategory');
    if (!catSelect) return;
    
    catSelect.innerHTML = '<option value="">-- CHOOSE A CATEGORY --</option>';
    globalCategories.forEach(c => {
        catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    // Reset competition dropdown and hide table when initializing/switching tabs
    const compSelect = document.getElementById('bulkAssignComp');
    if (compSelect) {
        compSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY FIRST --</option>';
        compSelect.disabled = true;
    }
    const wrap = document.getElementById('bulk-table-wrapper');
    if (wrap) wrap.style.display = 'none';
}

// Populates the second dropdown based on the category chosen
function populateBulkAssignDropdown() {
    const catSelect = document.getElementById('bulkAssignCategory');
    const select = document.getElementById('bulkAssignComp');
    const wrap = document.getElementById('bulk-table-wrapper');
    if (wrap) wrap.style.display = 'none';
    if (!select || !catSelect) return;
    
    const categoryId = catSelect.value;
    if (!categoryId) {
        select.innerHTML = '<option value="">-- CHOOSE CATEGORY FIRST --</option>';
        select.disabled = true;
        return;
    }
    
    select.innerHTML = '<option value="">-- CHOOSE A COMPETITION --</option>';
    
    const selectedCat = (globalCategories || []).find(c => String(c.id) === String(categoryId));
    const eligibleComps = globalComps.filter(c => {
        if (c.status === 'published' || c.status === 'judgement_complete') return false;
        if (String(c.category_id) === String(categoryId)) return true;
        const compCat = (globalCategories || []).find(cat => String(cat.id) === String(c.category_id)) || c.categories;
        if (isCategoryGeneral(c.category_id, compCat)) {
            let allowed = selectedCat?.allowed_general_categories;
            let arr = [];
            try {
                if (typeof allowed === 'string') arr = JSON.parse(allowed);
                else if (Array.isArray(allowed)) arr = allowed;
            } catch(e) {}
            if (arr.length === 0 || arr.some(id => String(id) === String(c.category_id))) {
                return true;
            }
        }
        return false;
    });

    eligibleComps.forEach(c => {
        const isGen = isCategoryGeneral(c.category_id, c.categories);
        const label = isGen && String(c.category_id) !== String(categoryId) ? `${c.name} (General)` : c.name;
        select.innerHTML += `<option value="${c.id}">${label}</option>`;
    });
    
    select.disabled = false;
}

function renderBulkAssignmentTable() {
    const compSelect = document.getElementById('bulkAssignComp');
    const tbody = document.getElementById('bulk-assignments-tbody');
    const wrapper = document.getElementById('bulk-table-wrapper');
    const thLeader = document.getElementById('th-leader'); 

    if (!compSelect || !tbody || !wrapper) return;

    const compId = compSelect.value;
    if (!compId) {
        wrapper.style.display = 'none';
        return;
    }

    const comp = globalComps.find(c => String(c.id) === String(compId));
    if (!comp) return;

    wrapper.style.display = 'block';
    if (thLeader) thLeader.style.display = comp.is_group ? 'table-cell' : 'none';

    tbody.innerHTML = '';
    
    const eligibleStudents = globalStudents.filter(student => isStudentEligibleForComp(student, comp));
    const enrolledData = globalAssignments.filter(a => String(a.competition_id) === String(compId));

    document.getElementById('bulk-comp-info').innerHTML = `<i class="fa-solid fa-users"></i> ${comp.name} <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 10px;">(Max ${comp.max_participants} per team)</span>`;

   if (eligibleStudents.length === 0) {
        // Adjusted colspan from 5 to 6 for the new Category column
        tbody.innerHTML = `<tr><td colspan="${comp.is_group ? 6 : 5}" style="text-align:center; padding: 2rem; color: var(--text-muted);">NO ELIGIBLE STUDENTS FOUND FOR THIS CATEGORY.</td></tr>`;
        return;
    }

    eligibleStudents.forEach(student => {
        const assignmentRecord = enrolledData.find(a => a.participant_id == student.id);
        const isAssigned = !!assignmentRecord;
        
        let statusBadge = '';
        let leaderCellHtml = '';
        
        if (comp.is_group) {
            if (isAssigned) {
                leaderCellHtml = assignmentRecord.is_leader 
                    ? '<span class="badge" style="background:var(--primary); color:white;">LEADER</span>' 
                    : '<span class="badge" style="background:#E2E8F0; color:#475569;">PARTY</span>';
            } else {
                leaderCellHtml = `<label style="cursor:pointer; font-size:0.8rem; font-weight:700; color:var(--text-muted); display:flex; align-items:center; gap:0.25rem; justify-content:center;"><input type="radio" name="tm_leader" value="${student.id}" style="width:18px; height:18px; accent-color: var(--primary);"> Set Leader</label>`;
            }
        }

        statusBadge = isAssigned 
            ? '<span style="color:var(--success); font-weight:800;"><i class="fa-solid fa-check"></i> ENROLLED</span>'
            : '<span style="color:var(--text-muted); font-weight:700;">UNASSIGNED</span>';

        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell" data-label=""><input type="checkbox" class="bulk-row-cb" value="${student.id}"></td>
                <td data-label="STUDENT NAME" style="font-weight: 800; color: var(--text-main);">${student.name}</td>
                <td data-label="UNIQUE ID" style="font-family: monospace; color: var(--text-muted); font-weight: 600;">${student.unique_id}</td>
                <td data-label="CATEGORY"><span class="badge badge-gray" style="font-size: 0.65rem;">${student.categories?.name || 'GEN'}</span></td>
                ${comp.is_group ? `<td data-label="GROUP LEADER" style="text-align: right;">${leaderCellHtml}</td>` : ''} 
                <td data-label="STATUS">${statusBadge}</td>
            </tr>
        `;
    });
}

// FIX: Updated class target
function toggleSelectAllBulk(source) {
    const checkboxes = document.querySelectorAll('.bulk-row-cb');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

async function executeBulkAction(action) {
    if (isAssignmentLocked) return showToast("Registration is locked.", "error");
    
    const compId = document.getElementById('bulkAssignComp').value;
    if (!compId) return showToast('Please select a competition.', 'error');
    
    // FIX: Loose equality
    const comp = globalComps.find(c => c.id == compId);
    const checkboxes = document.querySelectorAll('.bulk-row-cb:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) return showToast('Please select at least one student.', 'error');

    setLoading(action === 'enroll' ? 'btn-bulk-enroll' : 'btn-bulk-remove', true);

    try {
        if (action === 'enroll') {
            // FIX: Loose equality
            const currentEnrolledCount = globalAssignments.filter(a => a.competition_id == compId).length;
            const newIds = selectedIds.filter(id => !globalAssignments.find(a => a.competition_id == compId && a.participant_id == id));
            
            if (newIds.length === 0) throw new Error("Selected students are already enrolled.");
            
            if (comp.max_participants > 0 && (currentEnrolledCount + newIds.length) > comp.max_participants) {
                throw new Error(`Limit Exceeded! You can only enroll ${comp.max_participants} students total for this event.`);
            }

            // Student Category Limit Validation
            if (!comp.is_group && typeof festosGetCategoryLimitConfig === 'function') {
                const limitCfg = await festosGetCategoryLimitConfig();
                if (limitCfg && limitCfg.enabled) {
                    for (const pId of newIds) {
                        const check = festosEvaluateStudentCategoryLimit(
                            pId,
                            compId,
                            globalStudents || [],
                            globalComps || [],
                            globalCategories || [],
                            globalAssignments || [],
                            limitCfg
                        );
                        if (!check.allowed) {
                            throw new Error(check.message);
                        }
                    }
                }
            }

            const inserts = [];
            const groupId = comp.is_group ? `GRP_${compId}_${myTeamId}_${Date.now()}` : null;
            
            let leaderId = null;
            if (comp.is_group) {
                const leaderRadio = document.querySelector('input[name="tm_leader"]:checked');
                if (leaderRadio) leaderId = leaderRadio.value;
            }

            newIds.forEach(pId => {
                inserts.push({
                    participant_id: pId,
                    competition_id: compId,
                    group_id: groupId,
                    is_leader: comp.is_group ? (pId == leaderId) : false // Loose equality
                });
            });

            const withFestInserts = window.festosWithFest ? window.festosWithFest(inserts) : inserts;
            const { error } = await supabaseClient.from('participant_competitions').insert(withFestInserts);
            if (error) throw error;
            showToast(`Successfully enrolled ${newIds.length} students!`, 'success');
            
        } else if (action === 'remove') {
            const removeIds = selectedIds.filter(id => globalAssignments.find(a => String(a.competition_id) === String(compId) && String(a.participant_id) === String(id)));
            if (removeIds.length === 0) throw new Error("Selected students are not enrolled.");

            if(!confirm(`Remove ${removeIds.length} students from this event?`)) return;

            const { error } = await supabaseClient.from('participant_competitions')
                .delete()
                .eq('competition_id', compId)
                .in('participant_id', removeIds);
            if (error) throw error;
            showToast(`Removed ${removeIds.length} students!`, 'success');
        }

        const masterCb = document.querySelector('.checkbox-cell input[type="checkbox"]');
        if(masterCb) masterCb.checked = false;

        await fetchAllData(); 
        renderBulkAssignmentTable(); 

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading(action === 'enroll' ? 'btn-bulk-enroll' : 'btn-bulk-remove', false);
    }
}

// ---------------- SCAN PORTAL POPUP ----------------
function openScanModal() {
    document.getElementById('scanIframe').src = 'scan.html';
    document.getElementById('scanModal').classList.add('show');
}

function closeScanModal() {
    document.getElementById('scanIframe').src = '';
    document.getElementById('scanModal').classList.remove('show');
}

// ==========================================
// TEAM PDF REPORTS ENGINE
// ==========================================

async function exportTeamParticipantListPDF() {
    showToast('Generating Participant List PDF...', 'success');
    try {
        const teamName = document.getElementById('team-name-title')?.innerText || 'MY TEAM';
        const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId)
            ? window.festosAuth.getCurrentFestId()
            : (JSON.parse(localStorage.getItem('festUser') || '{}').fest_id || localStorage.getItem('festos_active_fest_id') || null);

        const totalEnrolledEvents = globalStudents.reduce((acc, p) => {
            return acc + (globalAssignments || []).filter(a => a.participant_id === p.id).length;
        }, 0);
        const avgPerStudent = globalStudents.length > 0 ? (totalEnrolledEvents / globalStudents.length).toFixed(1) : '0';

        const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
            ? window.festosGetPDFHeaderHTML(`${teamName.toUpperCase()} &bull; PARTICIPANTS ROSTER`, activeFid, {
                badge: `${globalStudents.length} CONTESTANTS`,
                subtitle: 'OFFICIAL TEAM SQUAD DIRECTORY'
            })
            : getPDFHeaderHTML(`${teamName} - Participant Directory`);

        const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
            ? window.festosGetPDFFooterHTML(null, null, `${teamName} Official Participant Directory`)
            : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

        let tableRows = globalStudents.map((p, index) => {
            const bg = (index % 2 === 1) ? '#F8FAFC' : '#FFFFFF';
            const enrollCount = (globalAssignments || []).filter(a => a.participant_id === p.id).length;
            const countPill = enrollCount > 0 
                ? `<span style="background: #EFF6FF; color: #2563EB; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 4px; display: inline-block;">${enrollCount} Event${enrollCount > 1 ? 's' : ''}</span>`
                : `<span style="background: #F1F5F9; color: #94A3B8; font-weight: 700; font-size: 9.5px; padding: 2px 6px; border-radius: 4px; display: inline-block;">None</span>`;

            return `
            <tr style="height: 32px; page-break-inside: avoid; break-inside: avoid;">
                <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 11px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${index + 1}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-size: 11px; font-weight: 700; color: #4F46E5; background: ${bg}; width: 110px;">${p.unique_id}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11.5px; background: ${bg};">${p.name.toUpperCase()}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-size: 11px; color: #475569; background: ${bg}; width: 110px;">${p.dob || 'N/A'}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; text-align: center; background: ${bg}; width: 120px;">${countPill}</td>
            </tr>
        `}).join('');

        if (globalStudents.length === 0) {
            tableRows = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748B; font-weight: 600;">No students found in this team roster.</td></tr>';
        }

        const contentHtml = `
            <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
                ${headerHtml}

                <!-- Team KPI Bar -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                        <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Total Contestants</div>
                        <div style="font-size: 19px; font-weight: 900; color: #0F172A; margin-top: 2px;">${globalStudents.length}</div>
                    </div>
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                        <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Total Event Seats</div>
                        <div style="font-size: 19px; font-weight: 900; color: #2563EB; margin-top: 2px;">${totalEnrolledEvents}</div>
                    </div>
                    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                        <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Avg Events / Contestant</div>
                        <div style="font-size: 19px; font-weight: 900; color: #059669; margin-top: 2px;">${avgPerStudent}</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #CBD5E1;">
                    <thead>
                        <tr style="background: #0F172A; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;">
                            <th style="padding: 8px 6px; text-align: center; width: 35px;">#</th>
                            <th style="padding: 8px 10px; width: 110px;">CONTESTANT ID</th>
                            <th style="padding: 8px 10px;">STUDENT NAME</th>
                            <th style="padding: 8px 10px; width: 110px;">DATE OF BIRTH</th>
                            <th style="padding: 8px 10px; width: 120px; text-align: center;">PARTICIPATIONS</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 11px; color: #334155;">
                        ${tableRows}
                    </tbody>
                </table>

                ${footerHtml}
            </div>
        `;

        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'portrait',
                filename: typeof getFestFileName === 'function' ? getFestFileName(`${teamName}_Participants`, 'pdf') : `${teamName}_Participants.pdf`,
                width: 800
            });
            showToast('Participant PDF Downloaded!');
        } else {
            const opt = {
                margin: 10,
                filename: typeof getFestFileName === 'function' ? getFestFileName(`${teamName}_Participants`, 'pdf') : `${teamName}_Participants.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('Participant PDF Downloaded!');
        }
    } catch (e) { showToast(e.message, 'error'); }
}

async function exportTeamProgramListPDF() {
    showToast('Generating Program List PDF...', 'success');
    try {
        const teamName = document.getElementById('team-name-title')?.innerText || 'MY TEAM';
        const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId)
            ? window.festosAuth.getCurrentFestId()
            : (JSON.parse(localStorage.getItem('festUser') || '{}').fest_id || localStorage.getItem('festos_active_fest_id') || null);

        let compsMap = {};
        (globalAssignments || []).forEach(a => {
            const student = (globalStudents || []).find(s => s.id === a.participant_id);
            const comp = (globalComps || []).find(c => c.id === a.competition_id);
            if (student && comp) {
                if (!compsMap[comp.id]) {
                    compsMap[comp.id] = {
                        compName: comp.name,
                        category: comp.categories?.name || 'GENERAL',
                        stage: ((window.festosGetCompVenueStage || getCompVenueStage)(comp, globalStages)).displayText,
                        participants: []
                    };
                }
                compsMap[comp.id].participants.push({
                    name: student.name,
                    id: student.unique_id,
                    is_leader: a.is_leader
                });
            }
        });

        const sortedComps = Object.values(compsMap).sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.compName.localeCompare(b.compName);
        });

        const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
            ? window.festosGetPDFHeaderHTML(`${teamName.toUpperCase()} &bull; PROGRAM ALLOCATION MATRIX`, activeFid, {
                badge: `${sortedComps.length} CONTESTS ENTERED`,
                subtitle: 'OFFICIAL TEAM COMPETITION ASSIGNMENTS'
            })
            : getPDFHeaderHTML(`${teamName} - Master Program List`);

        const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
            ? window.festosGetPDFFooterHTML(null, null, `${teamName} Master Program List`)
            : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

        let eventCardsHtml = '';
        if (sortedComps.length === 0) {
            eventCardsHtml = '<div style="text-align: center; color: #64748B; padding: 40px; font-weight: 600;">No enrollments found for this team.</div>';
        } else {
            sortedComps.forEach(c => {
                let pRows = c.participants.sort((a, b) => a.name.localeCompare(b.name)).map((p, i) => {
                    const bg = (i % 2 === 1) ? '#F8FAFC' : '#FFFFFF';
                    const leaderPill = p.is_leader 
                        ? '<span style="color: #059669; font-size: 9.5px; font-weight: 800; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 1px 6px; border-radius: 4px; margin-left: 8px;">TEAM LEADER</span>' 
                        : '';
                    return `
                    <tr style="height: 28px; page-break-inside: avoid; break-inside: avoid;">
                        <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 10.5px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${i + 1}</td>
                        <td style="padding: 6px 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-size: 11px; font-weight: 700; color: #4F46E5; background: ${bg}; width: 120px;">${p.id}</td>
                        <td style="padding: 6px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11px; background: ${bg};">${p.name.toUpperCase()} ${leaderPill}</td>
                    </tr>
                `}).join('');

                eventCardsHtml += `
                    <div class="pdf-avoid-break" style="margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden; background: white;">
                        <div style="background: #0F172A; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h3 style="margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">${c.compName}</h3>
                                <div style="margin-top: 2px; font-size: 9.5px; color: #94A3B8; font-weight: 600;">CATEGORY: ${c.category.toUpperCase()} &bull; STAGE: ${c.stage.toUpperCase()}</div>
                            </div>
                            <span style="font-size: 10px; color: #38BDF8; font-weight: 800; background: rgba(56, 189, 248, 0.15); padding: 3px 8px; border-radius: 4px;">
                                ${c.participants.length} CONTESTANT${c.participants.length > 1 ? 'S' : ''}
                            </span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; background: white;">
                            <thead>
                                <tr style="background: #F1F5F9; text-align: left; font-size: 9.5px; color: #475569; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #CBD5E1;">
                                    <th style="padding: 6px 8px; text-align: center; width: 35px;">#</th>
                                    <th style="padding: 6px 10px; width: 120px;">CONTESTANT ID</th>
                                    <th style="padding: 6px 10px;">STUDENT NAME</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 11px; color: #334155;">
                                ${pRows}
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }

        const contentHtml = `
            <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
                ${headerHtml}
                ${eventCardsHtml}
                ${footerHtml}
            </div>
        `;

        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'portrait',
                filename: typeof getFestFileName === 'function' ? getFestFileName(`${teamName}_Program_List`, 'pdf') : `${teamName}_Program_List.pdf`,
                width: 800
            });
            showToast('Program List PDF Downloaded!');
        } else {
            const opt = {
                margin: 10,
                filename: typeof getFestFileName === 'function' ? getFestFileName(`${teamName}_Program_List`, 'pdf') : `${teamName}_Program_List.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('Program List PDF Downloaded!');
        }
    } catch (e) { showToast(e.message, 'error'); }
}

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE (STRICT TENANT POLICY)
// ==========================================
function applyCachedBrandingSync() {
    try {
        const u = (typeof festosAuth !== 'undefined') ? (festosAuth.getUser() || festosAuth.getSuperAdmin()) : JSON.parse(localStorage.getItem('festUser') || '{}');
        const fid = (window.festosAuth && window.festosAuth.getCurrentFestId) ? window.festosAuth.getCurrentFestId() : (u?.fest_id || localStorage.getItem('festos_active_fest_id') || null);
        if (!fid) return;

        // Strict Policy: Purge any foreign un-scoped branding
        if (typeof festosPurgeCrossTenantBranding === 'function') {
            festosPurgeCrossTenantBranding(fid);
        }

        // 1. Strictly look for fid-scoped cache
        let raw = localStorage.getItem('festos_branding_cache_' + fid) || 
                  localStorage.getItem('festos_cfg_system_branding_' + fid);

        // 2. Only accept un-scoped cache if explicitly verified matching current fid
        if (!raw) {
            const legacyFb = localStorage.getItem('festBranding');
            if (legacyFb) {
                try {
                    const parsedFb = JSON.parse(legacyFb);
                    if (parsedFb && parsedFb._fest_id === fid) raw = legacyFb;
                    else localStorage.removeItem('festBranding');
                } catch(e) {
                    localStorage.removeItem('festBranding');
                }
            }
        }

        if (raw) {
            const cached = JSON.parse(raw);
            if (cached && (cached.fest_name || cached.fest_logo)) {
                cached._fest_id = fid;
                applyGlobalBranding(cached);
                return;
            }
        }

        // 3. Fallback to registered festival details strictly for fid
        if (typeof festosBranding !== 'undefined' && festosBranding.getDetails) {
            const details = festosBranding.getDetails(fid);
            if (details && (details.name || details.logo)) {
                applyGlobalBranding({
                    fest_name: details.name || 'Festival',
                    fest_logo: (details.logo && !details.logo.includes('festos-logo.svg')) ? details.logo : '',
                    display_mode: details.logo ? 'both' : 'name',
                    _fest_id: fid
                });
            }
        }
    } catch (e) {
        console.warn('Sync cached branding notice:', e);
    }
}

// Immediate synchronous invocation
applyCachedBrandingSync();

document.addEventListener("DOMContentLoaded", () => {
    fetchAndApplyBranding();
});

async function fetchAndApplyBranding() {
    // 1. Immediately apply from local cache (0ms delay)
    applyCachedBrandingSync();

    // 2. Background revalidation strictly for this festival
    try {
        const festId = (window.festosAuth && window.festosAuth.getCurrentFestId) 
            ? window.festosAuth.getCurrentFestId() 
            : (user?.fest_id || localStorage.getItem('festos_active_fest_id') || null);
        if (!festId) return;

        let val = window.festosGetSetting ? await window.festosGetSetting('system_branding', festId) : null;
        if (!val && typeof supabaseClient !== 'undefined') {
            const { data: fData } = await supabaseClient.from('fests').select('name, logo').eq('id', festId).maybeSingle();
            if (fData && (fData.name || fData.logo)) {
                val = { fest_name: fData.name, fest_logo: fData.logo || '', display_mode: fData.logo ? 'both' : 'name', _fest_id: festId };
            }
        }
        if (val) {
            val._fest_id = festId;
            applyGlobalBranding(val);
        }
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}


function getPDFHeaderHTML(reportTitle) {
    const u = JSON.parse(localStorage.getItem('festUser') || '{}');
    const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId)
        ? window.festosAuth.getCurrentFestId()
        : (u.fest_id || localStorage.getItem('festos_active_fest_id') || null);

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

// ==========================================
// APPEALS & GRIEVANCE TICKETS
// ==========================================

async function loadAppeals() {
    try {
        const { data, error } = await supabaseClient
            .from('appeals')
            .select('*, competitions(name), participants(name, unique_id)')
            .eq('team_id', myTeamId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const container = document.getElementById('appeals-container');
        if (!data || data.length === 0) {
            container.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border); font-weight: 700;">NO ACTIVE APPEALS.</div>';
            return;
        }

        container.innerHTML = data.map(ticket => {
            let statusColor = ticket.status === 'pending' ? 'var(--warning)' : (ticket.status === 'approved' ? 'var(--success)' : 'var(--danger)');
            
            return `
            <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-card);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: var(--input-bg); padding: 0.35rem 0.75rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: inline-block; border: 1px solid var(--border);">${ticket.issue_type.replace('_', ' ').toUpperCase()}</span>
                        <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem;">${ticket.competitions?.name || 'GENERAL ISSUE'}</h3>
                        <p style="font-family: monospace; font-size: 0.95rem; color: var(--primary); font-weight: 700;">${ticket.participants?.name || 'N/A'} (${ticket.participants?.unique_id || 'N/A'})</p>
                    </div>
                    <span style="padding: 0.5rem 1rem; border-radius: 12px; font-size: 0.8rem; font-weight: 800; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${ticket.status.toUpperCase()}</span>
                </div>
                <div style="background: var(--input-bg); padding: 1.25rem; border-radius: var(--radius-md); font-size: 0.95rem; color: var(--text-muted); border-left: 4px solid var(--border); font-weight: 600; line-height: 1.5;">
                    "${ticket.description}"
                </div>
            </div>`;
        }).join('');

    } catch (e) { showToast(e.message, 'error'); }
}

function openAppealModal() {
    const compOpts = globalComps.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const partOpts = globalStudents.map(p => `<option value="${p.id}">${p.name} (${p.unique_id})</option>`).join('');

    const premiumHtml = `
        <div style="background: var(--primary-light); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: flex-start; border: 1px solid var(--primary-ring);">
            <i class="fa-solid fa-circle-info" style="color: var(--primary); font-size: 1.25rem; margin-top: 0.1rem;"></i>
            <div style="font-size: 0.9rem; color: var(--primary); font-weight: 700; line-height: 1.5; text-transform: none;">
                Use this form to report scoring disputes, name corrections, or technical issues. Your ticket will be logged securely and sent directly to the Master Admin for review.
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-tag" style="margin-right: 0.25rem;"></i> ISSUE TYPE</label>
                <select id="appealType" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); font-weight: 700; outline: none; background: var(--input-bg); color: var(--text-main);">
                    <option value="score_dispute">SCORE / RESULT DISPUTE</option>
                    <option value="name_correction">NAME / ID CORRECTION</option>
                    <option value="other">OTHER TECHNICAL ISSUE</option>
                </select>
            </div>
            
            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-microphone-stage" style="margin-right: 0.25rem;"></i> RELATED EVENT (OPTIONAL)</label>
                <select id="appealComp" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); outline: none; background: var(--input-bg); font-weight: 700; color: var(--text-main);">
                    <option value="">-- NOT APPLICABLE --</option>
                    ${compOpts}
                </select>
            </div>

            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-user" style="margin-right: 0.25rem;"></i> PARTICIPANT (OPTIONAL)</label>
                <select id="appealPart" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); outline: none; background: var(--input-bg); font-weight: 700; color: var(--text-main);">
                    <option value="">-- NOT APPLICABLE --</option>
                    ${partOpts}
                </select>
            </div>
        </div>

        <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-align-left" style="margin-right: 0.25rem;"></i> DETAILED DESCRIPTION</label>
            <textarea id="appealDesc" rows="5" placeholder="PLEASE EXPLAIN THE ISSUE CLEARLY..." style="width: 100%; padding: 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); resize: vertical; font-weight: 600; outline: none; background: var(--input-bg); color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 0.95rem;"></textarea>
        </div>
    `;

    openModal('RAISE GRIEVANCE TICKET', premiumHtml, async () => {
        const payload = {
            team_id: myTeamId,
            issue_type: document.getElementById('appealType').value,
            competition_id: document.getElementById('appealComp').value || null,
            participant_id: document.getElementById('appealPart').value || null,
            description: document.getElementById('appealDesc').value.trim()
        };

        if (!payload.description) return showToast("Description is required.", "error");

        setLoading('modalSaveBtn', true);
        try {
            const finalPayload = window.festosWithFest ? window.festosWithFest(payload) : payload;
            const { error } = await supabaseClient.from('appeals').insert([finalPayload]);
            if (error) throw error;
            showToast("Ticket submitted to Master Admin.", "success");
            closeModal();
            loadAppeals();
        } catch (e) { 
            showToast(e.message, 'error'); 
        } finally { 
            setLoading('modalSaveBtn', false); 
        }
    });
}

// Boot
document.addEventListener('DOMContentLoaded', initDashboard);

// ==========================================
// TM SCHEDULE VIEWER
// ==========================================

function populateSchedCatFilter() {
    const catFilter = document.getElementById('filter-schedule-cat');
    const stageFilter = document.getElementById('filter-schedule-stage');
    
    if (catFilter && catFilter.options.length <= 1) {
        const catSet = new Set();
        globalComps.forEach(c => {
            if (tmScheduleData[c.id] && tmScheduleData[c.id].status === 'published') {
                catSet.add(JSON.stringify({ id: c.category_id, name: c.categories?.name || 'UNCATEGORIZED' }));
            }
        });
        Array.from(catSet).map(JSON.parse).forEach(cat => catFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);
    }

    if (stageFilter && stageFilter.options.length <= 1) {
        const stageMap = new Map();
        (globalStages || []).forEach(stg => stageMap.set(String(stg.id), stg.name));
        globalComps.forEach(c => {
            if (tmScheduleData[c.id] && tmScheduleData[c.id].status === 'published') {
                if (c.stage_id && c.stages?.name) stageMap.set(String(c.stage_id), c.stages.name);
            }
        });
        stageFilter.innerHTML = '<option value="all">ALL STAGES / VENUES</option>';
        stageMap.forEach((name, id) => {
            stageFilter.innerHTML += `<option value="${id}">${name}</option>`;
        });
        stageFilter.innerHTML += '<option value="offstage">OFFSTAGE VENUES ONLY</option>';
    }
}

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function detectTMStudentScheduleConflicts() {
    const conflicts = [];
    const compConflictMap = {};

    globalStudents.forEach(student => {
        const studentComps = (globalAssignments || [])
            .filter(a => a.participant_id === student.id)
            .map(a => globalComps.find(c => c.id === a.competition_id))
            .filter(c => c && tmScheduleData[c.id] && tmScheduleData[c.id].status === 'published' && tmScheduleData[c.id].date && tmScheduleData[c.id].time);

        for (let i = 0; i < studentComps.length; i++) {
            for (let j = i + 1; j < studentComps.length; j++) {
                const compA = studentComps[i];
                const compB = studentComps[j];
                const schedA = tmScheduleData[compA.id];
                const schedB = tmScheduleData[compB.id];

                if (schedA.date !== schedB.date) continue;

                // Ignore competitions that have ended/completed on stage
                const isAEnded = ['valuation', 'judgement_complete', 'published', 'completed'].includes(String(compA.status || '').toLowerCase());
                const isBEnded = ['valuation', 'judgement_complete', 'published', 'completed'].includes(String(compB.status || '').toLowerCase());
                if (isAEnded || isBEnded) continue;

                const startA = timeStringToMinutes(schedA.time);
                let endA = schedA.to_time ? timeStringToMinutes(schedA.to_time) : (startA + (parseInt(schedA.manual_time) || 30));
                if (endA <= startA) endA = startA + 30;

                const startB = timeStringToMinutes(schedB.time);
                let endB = schedB.to_time ? timeStringToMinutes(schedB.to_time) : (startB + (parseInt(schedB.manual_time) || 30));
                if (endB <= startB) endB = startB + 30;

                const isOverlap = (startA < endB) && (startB < endA);
                if (isOverlap) {
                    conflicts.push({
                        student,
                        compA,
                        compB,
                        date: schedA.date,
                        timeA: `${schedA.time} - ${schedA.to_time || ''}`,
                        timeB: `${schedB.time} - ${schedB.to_time || ''}`
                    });
                    if (!compConflictMap[compA.id]) compConflictMap[compA.id] = [];
                    if (!compConflictMap[compB.id]) compConflictMap[compB.id] = [];
                    compConflictMap[compA.id].push({ student, otherComp: compB });
                    compConflictMap[compB.id].push({ student, otherComp: compA });
                }
            }
        }
    });

    const banner = document.getElementById('tm-schedule-conflict-banner');
    const titleElem = document.getElementById('tm-conflict-banner-title');
    const descElem = document.getElementById('tm-conflict-banner-desc');

    if (banner) {
        if (conflicts.length > 0) {
            banner.style.display = 'flex';
            if (titleElem) titleElem.innerText = `⚠️ ${conflicts.length} Schedule Conflict${conflicts.length > 1 ? 's' : ''} Detected in Your Team`;
            if (descElem) {
                const studentNames = Array.from(new Set(conflicts.map(c => c.student.name))).join(', ');
                descElem.innerText = `Students with overlapping event schedules: ${studentNames}. Contact admin if adjustments are needed.`;
            }
        } else {
            banner.style.display = 'none';
        }
    }

    return compConflictMap;
}

function renderTMSchedule() {
    const search = document.getElementById('search-schedule').value.toLowerCase();
    const catFilter = document.getElementById('filter-schedule-cat').value;
    const stageFilter = document.getElementById('filter-schedule-stage').value;
    const tbody = document.getElementById('tm-schedule-tbody');
    tbody.innerHTML = '';

    const compConflictMap = detectTMStudentScheduleConflicts();

    const scheduledComps = globalComps.filter(c => {
        const sched = tmScheduleData[c.id];
        if (!sched || sched.status !== 'published') return false;
        
        const catName = c.categories?.name || 'UNCATEGORIZED';
        if (catFilter !== 'all' && String(c.category_id) !== String(catFilter)) return false;
        if (stageFilter !== 'all') {
            if (stageFilter === 'offstage') {
                if (!c.is_offstage) return false;
            } else if (String(c.stage_id) !== String(stageFilter)) {
                return false;
            }
        }
        if (search && !c.name.toLowerCase().includes(search) && !catName.toLowerCase().includes(search)) return false;
        
        return true;
    });

    scheduledComps.sort((a,b) => {
        const sA = tmScheduleData[a.id];
        const sB = tmScheduleData[b.id];
        if (sA.date !== sB.date) return (sA.date || '').localeCompare(sB.date || '');
        return (sA.time || '').localeCompare(sB.time || '');
    });

    if(scheduledComps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600;">NO PUBLISHED SCHEDULES FOUND MATCHING FILTERS.</td></tr>';
        return;
    }

    scheduledComps.forEach(comp => {
        const sched = tmScheduleData[comp.id];
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        const venueInfo = (window.festosGetCompVenueStage || getCompVenueStage)(comp, globalStages);
        
        const clashes = compConflictMap[comp.id] || [];
        let clashBadge = '';
        if (clashes.length > 0) {
            const names = clashes.map(c => c.student.name).join(', ');
            clashBadge = `<br><span class="badge" style="background:#FEE2E2; color:#DC2626; border:1px solid #FCA5A5; font-weight:700; margin-top:4px; display:inline-flex; align-items:center; gap:4px;" title="Clash for: ${names}"><i class="fa-solid fa-triangle-exclamation"></i> Student Overlap (${clashes.length})</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td data-label="DATE" style="font-weight: 700; color: var(--primary);">${sched.date || 'TBD'}</td>
                <td data-label="FROM TIME" style="font-weight: 700;">${sched.time || '--:--'}</td>
                <td data-label="TO TIME" style="font-weight: 700; color: var(--text-muted);">${sched.to_time || '-'}</td>
                <td data-label="EVENT NAME" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem;">${comp.name} ${clashBadge}</td>
                <td data-label="VENUE / STAGE"><span style="font-weight: 700; color: var(--primary);"><i class="fa-solid fa-microphone-stage" style="margin-right: 5px;"></i> ${venueInfo.name}</span></td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${catName}</span></td>
            </tr>
        `;
    });
}

async function exportTMSchedulePDF() {
    showToast('Generating Schedule PDF...', 'success');
    const search = document.getElementById('search-schedule')?.value.toLowerCase() || '';
    const catFilter = document.getElementById('filter-schedule-cat')?.value || 'all';
    const stageFilter = document.getElementById('filter-schedule-stage')?.value || 'all';

    const scheduledComps = globalComps.filter(c => {
        const sched = tmScheduleData[c.id];
        if (!sched || sched.status !== 'published') return false;
        if (catFilter !== 'all' && String(c.category_id) !== String(catFilter)) return false;
        if (stageFilter !== 'all') {
            if (stageFilter === 'offstage') {
                if (!c.is_offstage) return false;
            } else if (String(c.stage_id) !== String(stageFilter)) {
                return false;
            }
        }
        if (search && !c.name.toLowerCase().includes(search)) return false;
        return true;
    }).sort((a,b) => {
        const sA = tmScheduleData[a.id];
        const sB = tmScheduleData[b.id];
        if (sA.date !== sB.date) return (sA.date || '').localeCompare(sB.date || '');
        return (sA.time || '').localeCompare(sB.time || '');
    });

    if (scheduledComps.length === 0) {
        return showToast('No scheduled events match your current filters.', 'error');
    }

    const teamTitle = document.getElementById('team-name-title')?.innerText || 'MY TEAM';
    const mgrNames = document.getElementById('tm-manager-names')?.innerText || '';
    const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId)
        ? window.festosAuth.getCurrentFestId()
        : (JSON.parse(localStorage.getItem('festUser') || '{}').fest_id || localStorage.getItem('festos_active_fest_id') || null);

    // Summary metrics
    const distinctDates = [...new Set(scheduledComps.map(c => tmScheduleData[c.id]?.date).filter(Boolean))].sort();
    const distinctVenues = [...new Set(scheduledComps.map(c => ((window.festosGetCompVenueStage || getCompVenueStage)(c, globalStages)).displayText))];
    const soloCount = scheduledComps.filter(c => !c.is_group).length;
    const groupCount = scheduledComps.filter(c => c.is_group).length;

    // Group comps by date
    const dateGroups = {};
    scheduledComps.forEach(c => {
        const d = tmScheduleData[c.id]?.date || 'Date TBD';
        if (!dateGroups[d]) dateGroups[d] = [];
        dateGroups[d].push(c);
    });

    const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
        ? window.festosGetPDFHeaderHTML('OFFICIAL EVENT SCHEDULE & TIMETABLE', activeFid, {
            badge: `${scheduledComps.length} SCHEDULED EVENTS`,
            subtitle: `${teamTitle.toUpperCase()} &bull; MASTER TIMETABLE`
        })
        : getPDFHeaderHTML(`OFFICIAL EVENT SCHEDULE & TIMETABLE`);

    const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
        ? window.festosGetPDFFooterHTML(null, null, `${teamTitle} Official Timetable`)
        : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

    let dayBlocksHtml = '';
    let globalIndex = 1;
    Object.keys(dateGroups).forEach(d => {
        const compsForDate = dateGroups[d];
        let dayRows = compsForDate.map(c => {
            const sched = tmScheduleData[c.id];
            const venueInfo = (window.festosGetCompVenueStage || getCompVenueStage)(c, globalStages);
            const timeRange = (sched.time || '') + (sched.to_time ? ` &ndash; ${sched.to_time}` : '');
            
            const enrolled = (globalAssignments || [])
                .filter(a => a.competition_id === c.id)
                .map(a => {
                    const st = (globalStudents || []).find(s => s.id === a.participant_id);
                    return st ? `${st.name}${a.is_leader ? ' (Leader)' : ''}` : null;
                })
                .filter(Boolean);

            const enrolledHtml = enrolled.length > 0 
                ? `<div style="font-size: 10px; color: #1E293B; font-weight: 600; line-height: 1.3;">${enrolled.join(', ')}</div>` 
                : `<span style="color: #94A3B8; font-size: 10px; font-style: italic;">No student enrolled</span>`;

            const modeBadge = c.is_offstage 
                ? `<span style="background: #FEF3C7; color: #92400E; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #FDE68A; display: inline-block;">OFFSTAGE</span>`
                : `<span style="background: #EEF2FF; color: #4338CA; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #C7D2FE; display: inline-block;">ONSTAGE</span>`;

            const formatBadge = c.is_group 
                ? `<span style="background: #FDF2F8; color: #9D174D; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 4px; margin-left: 6px;">GROUP</span>`
                : `<span style="background: #F0FDF4; color: #166534; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 4px; margin-left: 6px;">SOLO</span>`;

            return `
                <tr style="border-bottom: 1px solid #E2E8F0; page-break-inside: avoid; break-inside: avoid;">
                    <td style="padding: 8px 8px; text-align: center; font-weight: 700; color: #64748B; font-size: 11px; width: 35px;">${globalIndex++}</td>
                    <td style="padding: 8px 10px; font-weight: 800; color: #0F172A; font-size: 11px; white-space: nowrap; width: 130px;">
                        ${timeRange}
                    </td>
                    <td style="padding: 8px 10px;">
                        <span style="font-weight: 800; color: #0F172A; font-size: 11.5px; text-transform: uppercase;">${c.name}</span>
                        ${formatBadge}
                    </td>
                    <td style="padding: 8px 10px; font-weight: 700; color: #475569; font-size: 11px; width: 120px;">${(c.categories?.name || 'GENERAL').toUpperCase()}</td>
                    <td style="padding: 8px 10px; width: 140px;">
                        <span style="font-weight: 800; color: #4F46E5; font-size: 11px;">${(venueInfo.name || "TBD").toUpperCase()}</span>
                    </td>
                    <td style="padding: 8px 8px; text-align: center; width: 85px;">${modeBadge}</td>
                    <td style="padding: 8px 10px; max-width: 220px;">${enrolledHtml}</td>
                </tr>
            `;
        }).join('');

        dayBlocksHtml += `
            <div class="pdf-avoid-break" style="margin-bottom: 22px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden; background: white;">
                <div style="background: #0F172A; color: white; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 800; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
                        📅 ${d}
                    </span>
                    <span style="font-size: 10px; font-weight: 700; color: #38BDF8; background: rgba(56, 189, 248, 0.15); padding: 2px 8px; border-radius: 4px;">
                        ${compsForDate.length} EVENT${compsForDate.length > 1 ? 'S' : ''}
                    </span>
                </div>
                <table style="width: 100%; border-collapse: collapse; background: white;">
                    <thead>
                        <tr style="background: #F1F5F9; text-align: left; font-size: 10px; color: #475569; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #CBD5E1;">
                            <th style="padding: 7px 8px; width: 35px; text-align: center;">#</th>
                            <th style="padding: 7px 10px; width: 130px;">TIME WINDOW</th>
                            <th style="padding: 7px 10px;">EVENT NAME</th>
                            <th style="padding: 7px 10px; width: 120px;">CATEGORY</th>
                            <th style="padding: 7px 10px; width: 140px;">VENUE / STAGE</th>
                            <th style="padding: 7px 8px; width: 85px; text-align: center;">MODE</th>
                            <th style="padding: 7px 10px;">TEAM ENROLLED</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 11px; color: #1E293B;">
                        ${dayRows}
                    </tbody>
                </table>
            </div>
        `;
    });

    const contentHtml = `
        <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}

            <!-- Team Sub-Banner -->
            <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <span style="font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">TEAM ROSTER SCHEDULE</span>
                    <div style="font-size: 16px; font-weight: 800; color: #1E293B;">${teamTitle}</div>
                </div>
                ${mgrNames ? `<div style="font-size: 11px; font-weight: 700; color: #475569; background: #FFFFFF; padding: 5px 10px; border-radius: 5px; border: 1px solid #CBD5E1;">${mgrNames}</div>` : ''}
            </div>

            <!-- KPI Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase;">Scheduled Events</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0F172A; margin-top: 2px;">${scheduledComps.length}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase;">Festival Days</div>
                    <div style="font-size: 18px; font-weight: 900; color: #4F46E5; margin-top: 2px;">${distinctDates.length} Day${distinctDates.length > 1 ? 's' : ''}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase;">Active Venues</div>
                    <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 2px;">${distinctVenues.length}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase;">Format Split</div>
                    <div style="font-size: 13px; font-weight: 900; color: #0F172A; margin-top: 4px;">${soloCount} Solo <span style="color:#CBD5E1;">|</span> ${groupCount} Group</div>
                </div>
            </div>

            ${dayBlocksHtml}
            ${footerHtml}
        </div>
    `;

    try {
        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'landscape',
                filename: typeof getFestFileName === 'function' ? getFestFileName(`${teamTitle}_Schedule`, 'pdf') : `${teamTitle}_Schedule.pdf`,
                width: 1120
            });
            showToast('Schedule PDF Exported!');
        } else {
            const opt = {
                margin: [8, 10, 8, 10],
                filename: typeof getFestFileName === 'function' ? getFestFileName(`${teamTitle}_Schedule`, 'pdf') : `${teamTitle}_Schedule.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('Schedule PDF Exported!');
        }
    } catch (e) {
        showToast('Error exporting PDF: ' + e.message, 'error');
    }
}

async function exportTMScheduleCSV() {
    const search = document.getElementById('search-schedule')?.value.toLowerCase() || '';
    const catFilter = document.getElementById('filter-schedule-cat')?.value || 'all';
    const stageFilter = document.getElementById('filter-schedule-stage')?.value || 'all';

    const scheduledComps = globalComps.filter(c => {
        const sched = tmScheduleData[c.id];
        if (!sched || sched.status !== 'published') return false;
        if (catFilter !== 'all' && String(c.category_id) !== String(catFilter)) return false;
        if (stageFilter !== 'all') {
            if (stageFilter === 'offstage') {
                if (!c.is_offstage) return false;
            } else if (String(c.stage_id) !== String(stageFilter)) {
                return false;
            }
        }
        if (search && !c.name.toLowerCase().includes(search)) return false;
        return true;
    }).sort((a, b) => {
        const sA = tmScheduleData[a.id];
        const sB = tmScheduleData[b.id];
        if (sA.date !== sB.date) return (sA.date || '').localeCompare(sB.date || '');
        return (sA.time || '').localeCompare(sB.time || '');
    });

    if (scheduledComps.length === 0) {
        return showToast('No scheduled events match your current filters.', 'error');
    }

    const compConflictMap = typeof detectTMStudentScheduleConflicts === 'function' ? detectTMStudentScheduleConflicts() : {};
    let slNo = 1;

    const dataToExport = scheduledComps.map(c => {
        const sched = tmScheduleData[c.id];
        const venueInfo = (window.festosGetCompVenueStage || getCompVenueStage)(c, globalStages);
        const catName = c.categories?.name || 'General';

        const enrolledParticipants = (globalAssignments || [])
            .filter(a => a.competition_id === c.id)
            .map(a => {
                const s = (globalStudents || []).find(st => st.id === a.participant_id);
                return s ? `${s.name}${a.is_leader ? ' [LEADER]' : ''}` : null;
            })
            .filter(Boolean);

        const clashes = compConflictMap[c.id] || [];

        let durationMins = '';
        if (sched.time && sched.to_time) {
            const startM = timeStringToMinutes(sched.time);
            const endM = timeStringToMinutes(sched.to_time);
            if (endM > startM) durationMins = endM - startM;
        }
        if (!durationMins && sched.manual_time) durationMins = sched.manual_time;

        return {
            'SL NO': slNo++,
            'DATE': sched.date || '',
            'FROM TIME': sched.time || '',
            'TO TIME': sched.to_time || '-',
            'DURATION (MINS)': durationMins || '-',
            'COMPETITION NAME': c.name,
            'CATEGORY': catName,
            'VENUE / STAGE': (venueInfo.name || 'TBD'),
            'EVENT MODE': c.is_offstage ? 'Offstage' : 'Onstage',
            'PARTICIPATION TYPE': c.is_group ? 'Group' : 'Solo',
            'MY TEAM ENROLLED COUNT': enrolledParticipants.length,
            'MY TEAM PARTICIPANTS': enrolledParticipants.join('; ') || 'None Enrolled',
            'SCHEDULE CONFLICT': clashes.length > 0 ? `YES (${clashes.length} overlap)` : 'No'
        };
    });

    const teamTitle = document.getElementById('team-name-title')?.innerText || 'Team';
    const csvFileName = typeof getFestFileName === 'function' ? getFestFileName(`${teamTitle}_Schedule`, 'csv') : `${teamTitle}_Schedule.csv`;
    
    if (typeof festosExportCSV === 'function') {
        festosExportCSV(csvFileName, dataToExport, `${teamTitle} - Event Schedule`);
    } else {
        const blob = new Blob([Papa.unparse(dataToExport)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute('download', csvFileName);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
    showToast('Schedule CSV exported successfully!');
}
window.exportTMScheduleCSV = exportTMScheduleCSV;

let tmVacancyData = [];

function openTMVacancyModal() {
    // Calculate Vacancies for MY TEAM
    tmVacancyData = [];
    
    // Populate Category Dropdown inside modal
    const catSelect = document.getElementById('vacancyCategoryFilter');
    catSelect.innerHTML = '<option value="">All Categories</option>';
    globalCategories.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    
    document.getElementById('vacancySearchInput').value = '';
    
    globalComps.forEach(comp => {
        // Exclude closed events
        if (['judgement_complete', 'published'].includes(comp.status)) return;
        
        const limit = comp.max_participants || 0;
        if (limit === 0) return; // No limit events don't have vacancies
        
        const myEnrolledCount = globalAssignments.filter(a => a.competition_id === comp.id).length;
        const remaining = limit - myEnrolledCount;
        
        if (remaining > 0) {
            tmVacancyData.push({
                id: comp.id,
                name: comp.name,
                category_id: comp.category_id,
                categoryName: comp.categories?.name || 'General',
                limit: limit,
                enrolled: myEnrolledCount,
                balance: remaining
            });
        }
    });
    
    renderTMVacancyTable();
    document.getElementById('vacancyModal').classList.add('show');
}

function renderTMVacancyTable() {
    const search = document.getElementById('vacancySearchInput').value.toLowerCase();
    const catFilter = document.getElementById('vacancyCategoryFilter').value;
    const tbody = document.getElementById('vacancy-tbody');
    tbody.innerHTML = '';

    const filtered = tmVacancyData.filter(v => {
        const matchName = v.name.toLowerCase().includes(search);
        const matchCat = catFilter === '' || String(v.category_id) === String(catFilter);
        return matchName && matchCat;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600;">NO VACANCIES FOUND FOR YOUR TEAM. ALL QUOTAS FILLED!</td></tr>`;
        return;
    }

    filtered.forEach(v => {
        tbody.innerHTML += `
            <tr>
                <td data-label="COMPETITION" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem;">${v.name}</td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${v.categoryName}</span></td>
                <td data-label="ENROLLED / BALANCE">
                    <span style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">${v.enrolled} / ${v.limit}</span>
                    <span style="font-weight: 700; color: var(--danger); margin-left: 10px; background: var(--danger-light); padding: 4px 8px; border-radius: 6px;">${v.balance} OPEN SLOTS</span>
                </td>
                <td data-label="ACTIONS">
                    <button class="btn btn-outline" style="color: var(--success); border-color: var(--success);" onclick="routeToAssignment('${v.category_id}', '${v.id}')">
                        <i class="fa-solid fa-user-plus"></i> ASSIGN NOW
                    </button>
                </td>
            </tr>
        `;
    });
}

window.routeToAssignment = function(catId, compId) {
    if (isAssignmentLocked) return showToast("Registration is currently locked.", "error");
    
    // Hide vacancy modal, show mode selection modal
    document.getElementById('vacancyModal').classList.remove('show');
    
    document.getElementById('route-cat-id').value = catId;
    document.getElementById('route-comp-id').value = compId;
    
    document.getElementById('assignModeModal').classList.add('show');
}

window.executeRouteToAssignment = function(mode) {
    document.getElementById('assignModeModal').classList.remove('show');
    
    const catId = document.getElementById('route-cat-id').value;
    const compId = document.getElementById('route-comp-id').value;
    
    switchTab('assignments');
    
    if (mode === 'bulk') {
        switchAssignView('bulk');
        const catSelect = document.getElementById('bulkAssignCategory');
        catSelect.value = catId;
        populateBulkAssignDropdown();
        
        setTimeout(() => {
            const compSelect = document.getElementById('bulkAssignComp');
            if (compSelect) {
                compSelect.value = compId;
                renderBulkAssignmentTable();
            }
        }, 100);
    } else {
        switchAssignView('list');
        const catSelect = document.getElementById('filter-assign-overview-cat');
        if (catSelect) {
            catSelect.value = catId;
            renderAssignOverview();
        }
        setTimeout(() => {
            openQuickAddModal(compId);
        }, 100);
    }
}

async function exportTMVacancyPDF() {
    showToast('Generating Vacancy PDF...', 'success');
    
    const search = (document.getElementById('vacancySearchInput')?.value || '').toLowerCase();
    const catFilter = document.getElementById('vacancyCategoryFilter')?.value || '';
    
    const filtered = tmVacancyData.filter(v => {
        const matchName = v.name.toLowerCase().includes(search);
        const matchCat = catFilter === '' || String(v.category_id) === String(catFilter);
        return matchName && matchCat;
    });

    const teamTitle = document.getElementById('team-name-title')?.innerText || 'MY TEAM';
    const activeFid = (window.festosAuth && window.festosAuth.getCurrentFestId)
        ? window.festosAuth.getCurrentFestId()
        : (JSON.parse(localStorage.getItem('festUser') || '{}').fest_id || localStorage.getItem('festos_active_fest_id') || null);

    const totalOpenSlots = filtered.reduce((acc, v) => acc + (v.balance || 0), 0);
    const totalFilledSlots = filtered.reduce((acc, v) => acc + (v.enrolled || 0), 0);

    const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
        ? window.festosGetPDFHeaderHTML('TEAM VACANCY & QUOTA AUDIT', activeFid, {
            badge: `${filtered.length} EVENTS WITH VACANCY`,
            subtitle: `${teamTitle.toUpperCase()} &bull; OPEN REGISTRATION SLOTS`
        })
        : getPDFHeaderHTML(`My Team Vacancy Audit`);

    const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
        ? window.festosGetPDFFooterHTML(null, null, `${teamTitle} Vacancy Audit`)
        : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

    let tableRows = filtered.map((v, i) => {
        const bg = (i % 2 === 1) ? '#F8FAFC' : '#FFFFFF';
        return `
        <tr style="height: 32px; page-break-inside: avoid; break-inside: avoid;">
            <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 11px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${i + 1}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11.5px; background: ${bg};">${v.name.toUpperCase()}</td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 130px;">
                <span style="background: #EFF6FF; color: #2563EB; font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block;">${v.categoryName.toUpperCase()}</span>
            </td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; text-align: center; background: ${bg}; width: 120px;">
                <span style="font-weight: 800; color: #0F172A; font-size: 11px;">${v.enrolled} / ${v.limit}</span>
            </td>
            <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; text-align: center; background: ${bg}; width: 130px;">
                <span style="background: #FEE2E2; color: #DC2626; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 4px; display: inline-block; border: 1px solid #FECACA;">
                    ${v.balance} OPEN SLOT${v.balance > 1 ? 'S' : ''}
                </span>
            </td>
        </tr>
    `}).join('');

    if (filtered.length === 0) {
        tableRows = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #64748B; font-weight: 600;">No vacancies found matching the current criteria. All quotas are filled!</td></tr>`;
    }

    const contentHtml = `
        <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}

            <!-- KPI Metric Bar -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Under-Enrolled Events</div>
                    <div style="font-size: 19px; font-weight: 900; color: #DC2626; margin-top: 2px;">${filtered.length}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Total Open Slots Available</div>
                    <div style="font-size: 19px; font-weight: 900; color: #D97706; margin-top: 2px;">${totalOpenSlots}</div>
                </div>
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 700; text-transform: uppercase;">Enrolled Contestants in Scope</div>
                    <div style="font-size: 19px; font-weight: 900; color: #059669; margin-top: 2px;">${totalFilledSlots}</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #CBD5E1;">
                <thead>
                    <tr style="background: #0F172A; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;">
                        <th style="padding: 8px 6px; text-align: center; width: 35px;">#</th>
                        <th style="padding: 8px 10px;">COMPETITION NAME</th>
                        <th style="padding: 8px 10px; width: 130px;">CATEGORY</th>
                        <th style="padding: 8px 10px; width: 120px; text-align: center;">ENROLLED / LIMIT</th>
                        <th style="padding: 8px 10px; width: 130px; text-align: center;">VACANCY BALANCE</th>
                    </tr>
                </thead>
                <tbody style="font-size: 11px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>

            ${footerHtml}
        </div>
    `;

    try {
        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'portrait',
                filename: typeof getFestFileName === 'function' ? getFestFileName('Team_Vacancy_Audit', 'pdf') : 'Fest_Team_Vacancy_Audit.pdf',
                width: 800
            });
            showToast('Vacancy PDF Exported Successfully!');
        } else {
            const opt = { 
                margin: 10, 
                filename: typeof getFestFileName === 'function' ? getFestFileName('Team_Vacancy_Audit', 'pdf') : 'Team_Vacancy_Audit.pdf', 
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('Vacancy PDF Exported!');
        }
    } catch (e) {
        showToast('Error exporting PDF: ' + e.message, 'error');
    }
}

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================
function applyGlobalBranding(brandingData) {
    if (!brandingData) return;
    const u = (typeof festosAuth !== 'undefined') ? (festosAuth.getUser() || festosAuth.getSuperAdmin()) : JSON.parse(localStorage.getItem('festUser') || '{}');
    const fid = (window.festosAuth && window.festosAuth.getCurrentFestId) ? window.festosAuth.getCurrentFestId() : (u?.fest_id || localStorage.getItem('festos_active_fest_id') || null);

    // STRICT MULTI-TENANT POLICY: Reject any cross-tenant injection
    if (brandingData._fest_id && fid && brandingData._fest_id !== fid) {
        console.warn(`[Branding Security] Blocked cross-tenant branding injection from ${brandingData._fest_id} to ${fid}`);
        return;
    }
    brandingData._fest_id = fid;

    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const rawLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '' ? brandingData.fest_logo.trim() : '';
    const validLogo = rawLogo !== '' && rawLogo !== 'festos-logo.svg' && rawLogo !== '/festos-logo.svg';
    
    const festName = validName ? brandingData.fest_name : 'Festival';
    document.title = `${festName} | Team Manager`;

    try {
        if (fid) {
            localStorage.setItem('festos_branding_cache_' + fid, JSON.stringify(brandingData));
            localStorage.setItem('festBranding', JSON.stringify(brandingData));
            sessionStorage.setItem('festBranding', JSON.stringify(brandingData));
        }
    } catch(e) {}

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

    const brandContainers = document.querySelectorAll('.brand, .navbar-brand');
    brandContainers.forEach(container => {
        let html = '';
        if (validLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="${festName} Logo" class="festos-dynamic-logo" style="height: 36px; width: auto; max-width: 140px; object-fit: contain; border-radius: 6px; margin-right: 8px; display: inline-block; vertical-align: middle;">`;
        } else {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        html += `<span class="festos-dynamic-name" style="letter-spacing: -0.5px; font-weight: 800; display: inline-block; vertical-align: middle;">${festName}</span>`;
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'flex-start';
        container.style.marginBottom = '2.5rem';
    });
}

// ==========================================
// DUAL-VIEW ASSIGNMENT ENGINE
// ==========================================

// Ensure switchTab triggers the correct default view
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if(originalSwitchTab) originalSwitchTab(tabId);
    if(tabId === 'assignments') {
        if(typeof window.switchAssignView === 'function') window.switchAssignView('list');
    }
};

window.switchAssignView = function(view) {
    document.getElementById('btn-assign-view-list').className = 'btn btn-outline';
    document.getElementById('btn-assign-view-bulk').className = 'btn btn-outline';
    document.getElementById('assign-view-list').style.display = 'none';
    document.getElementById('assign-view-bulk').style.display = 'none';
    
    if (view === 'bulk') {
        document.getElementById('btn-assign-view-bulk').className = 'btn btn-primary';
        document.getElementById('assign-view-bulk').style.display = 'block';
        populateBulkAssignCategoryDropdown();
    } else {
        document.getElementById('btn-assign-view-list').className = 'btn btn-primary';
        document.getElementById('assign-view-list').style.display = 'block';
        populateAssignOverviewCategoryDropdown();
        renderAssignOverview();
    }
};

function populateAssignOverviewCategoryDropdown() {
    const catSelect = document.getElementById('filter-assign-overview-cat');
    if (!catSelect) return;
    catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
    globalCategories.forEach(c => {
        catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

function renderAssignOverview() {
    const search = document.getElementById('search-assign-overview').value.toLowerCase();
    const catFilter = document.getElementById('filter-assign-overview-cat').value;
    const tbody = document.getElementById('assign-overview-tbody');
    tbody.innerHTML = '';

    const eligibleComps = globalComps.filter(c => 
        c.status !== 'published' && c.status !== 'judgement_complete'
    );

    if (eligibleComps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600;">NO OPEN COMPETITIONS AVAILABLE.</td></tr>';
        return;
    }

    eligibleComps.forEach(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        if (catFilter !== 'all' && comp.category_id != catFilter) return;
        if (search && !comp.name.toLowerCase().includes(search)) return;

        // Fetch enrolled and sort so Leader is always first
        let enrolled = globalAssignments.filter(a => String(a.competition_id) === String(comp.id));
        enrolled.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0));
        
        let studentsHtml = '';
        if (enrolled.length === 0) {
            studentsHtml = '<span style="color: var(--warning); font-size: 0.8rem; font-weight: 700; background: var(--warning-light); padding: 4px 8px; border-radius: 6px;">NO STUDENTS ENROLLED</span>';
        } else {
            studentsHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">';
            enrolled.forEach((a, index) => {
                const student = globalStudents.find(s => String(s.id) === String(a.participant_id));
                const sName = student ? student.name : `STUDENT #${String(a.participant_id).substring(0, 8)}`;
                const sUnique = student ? student.unique_id : '';
                const sCat = (student && student.categories?.name) ? student.categories.name : 'GEN';
                const sId = student ? student.id : a.participant_id;
                
                let leaderBadge = '';
                if (comp.is_group && index === 0) {
                    // Automatically label the first item as the leader
                    leaderBadge = `<span class="leader-box">LEADER</span>`;
                }
                
                // Add draggable properties if it's a group event
                const dragProps = comp.is_group 
                    ? `draggable="true" class="draggable-item" data-comp-id="${comp.id}" data-student-id="${student.id}" ondragstart="handleDragStart(event, '${comp.id}', '${student.id}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${comp.id}', '${student.id}')" ondragend="handleDragEnd(event)"` 
                    : '';

                const dragIcon = comp.is_group ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; cursor: grab; margin-right: 8px;"></i>` : '';

                studentsHtml += `
                    <div ${dragProps} style="background: var(--bg-surface); border: 1px solid var(--border); padding: 0.5rem 0.75rem; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); width: 100%;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap;">
                            ${dragIcon}
                            ${leaderBadge}
                            <strong style="color: var(--text-main); font-size: 0.95rem;">${sName}</strong>
                            <span style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; margin-left: 4px;">${sUnique}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-main); padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${sCat}</span>
                        </div>
                        <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; min-height: auto; border-color: var(--danger); color: var(--danger); border-radius: 6px; width: auto; flex-shrink: 0;" onclick="quickRemoveStudent('${comp.id}', '${sId}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            });
            studentsHtml += '</div>';
        }

        const limitText = comp.max_participants > 0 ? `(MAX: ${comp.max_participants})` : '';
        const isFull = comp.max_participants > 0 && enrolled.length >= comp.max_participants;
        const addBtn = isFull 
            ? `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem;">FULL LIMIT REACHED</span>`
            : `<button class="btn btn-primary" style="padding: 0.6rem 1rem; width: 100%; justify-content: center;" onclick="openQuickAddModal('${comp.id}')"><i class="fa-solid fa-plus"></i> ADD PARTICIPANTS</button>`;

        tbody.innerHTML += `
            <tr>
                <td data-label="COMPETITION" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; vertical-align: top;">
                    ${comp.name} <br><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px; display: inline-block;">${limitText}</span>
                    ${comp.is_group && enrolled.length > 0 ? `<br><span style="font-size: 0.65rem; color: var(--primary); font-weight: 800; margin-top: 4px; display: inline-block;"><i class="fa-solid fa-hand-pointer"></i> DRAG TO ARRANGE LEADER</span>` : ''}
                </td>
                <td data-label="CATEGORY" style="vertical-align: top;"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="ASSIGNED STUDENTS" style="width: 50%; vertical-align: top;">${studentsHtml}</td>
                <td data-label="ACTIONS" style="min-width: 150px; vertical-align: top;">${addBtn}</td>
            </tr>
        `;
    });
}

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
    
    // The top element is now the Leader
    const newFirstElement = container.firstElementChild;
    const newLeaderId = newFirstElement.getAttribute('data-student-id');
    
    // Instantly Update Local State (No fetchAllData required)
    let myEnrolled = globalAssignments.filter(a => String(a.competition_id) === String(compId));
    myEnrolled.forEach(a => { a.is_leader = (String(a.participant_id) === String(newLeaderId)); });
    
    renderAssignOverview(); // Instantly apply UI badges
    
    // Async Background Update to DB
    try {
        const updates = myEnrolled.map(a => {
            return supabaseClient.from('participant_competitions')
                .update({ is_leader: a.is_leader })
                .eq('id', a.id);
        });
        await Promise.all(updates);
    } catch(err) {
        showToast("Error saving order to cloud: " + err.message, "error");
    }
};

// --- PERFORMANCE OPTIMIZED QUICK REMOVE ---
window.quickRemoveStudent = async function(compId, studentId) {
    if (isAssignmentLocked) return showToast("Registration is locked.", "error");
    
    openConfirmModal("Remove Student?", "Are you sure you want to remove this student from the competition?", async () => {
        try {
            // Optimistic UI Update: Remove from local memory instantly
            const recordIndex = globalAssignments.findIndex(a => String(a.competition_id) === String(compId) && String(a.participant_id) === String(studentId));
            if (recordIndex > -1) {
                // If we remove the leader, transfer leadership to the next person automatically
                const wasLeader = globalAssignments[recordIndex].is_leader;
                globalAssignments.splice(recordIndex, 1);
                
                if (wasLeader) {
                    const remaining = globalAssignments.filter(a => String(a.competition_id) === String(compId));
                    if (remaining.length > 0) remaining[0].is_leader = true;
                }
            }
            
            renderAssignOverview(); // Instantly disappear from UI
            
            // Background DB call
            const { error } = await supabaseClient.from('participant_competitions')
                .delete()
                .eq('competition_id', compId)
                .eq('participant_id', studentId);
                
            if (error) throw error;
            showToast("Student removed.", "success");
            
        } catch(e) {
            showToast(e.message, "error");
            await fetchAllData(); // Revert to source of truth if DB error
            renderAssignOverview();
        }
    });
}

// --- NEW MULTI-SELECT QUICK ADD POPUP ---
window.tempSelectedStudents = [];
window.tempAvailableStudents = [];

window.openQuickAddModal = function(compId) {
    if (isAssignmentLocked) return showToast("Registration is locked.", "error");
    const comp = globalComps.find(c => String(c.id) === String(compId));
    if (!comp) return;

    if (!globalStudents || globalStudents.length === 0) {
        showToast("Loading student directory, please wait...", "warning");
        fetchAllData(false).then(() => {
            if (globalStudents && globalStudents.length > 0) {
                openQuickAddModal(compId);
            } else {
                showToast("No students found in team directory. Add students in Directory first.", "error");
            }
        });
        return;
    }

    // Filter Eligible Students using unified robust helper
    const eligibleStudents = globalStudents.filter(student => isStudentEligibleForComp(student, comp));

    const enrolledIds = globalAssignments.filter(a => String(a.competition_id) === String(compId)).map(a => String(a.participant_id));
    window.tempAvailableStudents = eligibleStudents.filter(s => !enrolledIds.includes(String(s.id)));
    window.tempSelectedStudents = [];
    window.tempCompLimit = comp.max_participants > 0 ? comp.max_participants : 999;
    window.tempSlotsLeft = window.tempCompLimit - enrolledIds.length;
    window.tempCompId = compId;
    window.tempIsGroup = comp.is_group;

    openModal(`ADD TO ${comp.name}`, `
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 1rem;">
            REMAINING CAPACITY: <span id="qa-slots-left" style="color: var(--primary); font-size: 1rem;">${window.tempCompLimit > 100 ? 'UNLIMITED' : window.tempSlotsLeft}</span>
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
            const existingGroup = globalAssignments.filter(a => String(a.competition_id) === String(window.tempCompId));
            const isGroup = window.tempIsGroup;
            const groupId = isGroup ? (existingGroup.length > 0 ? existingGroup[0].group_id : `GRP_${window.tempCompId}_${myTeamId}_${Date.now()}`) : null;
            
            // If a leader already exists in the enrolled data, DO NOT assign a new leader.
            const hasExistingLeader = existingGroup.some(a => a.is_leader);

            // Student Category Limit Validation
            if (!isGroup && typeof festosGetCategoryLimitConfig === 'function') {
                const limitCfg = await festosGetCategoryLimitConfig();
                if (limitCfg && limitCfg.enabled) {
                    for (const s of window.tempSelectedStudents) {
                        const check = festosEvaluateStudentCategoryLimit(
                            s.id,
                            window.tempCompId,
                            globalStudents || [],
                            globalComps || [],
                            globalCategories || [],
                            globalAssignments || [],
                            limitCfg
                        );
                        if (!check.allowed) {
                            throw new Error(check.message);
                        }
                    }
                }
            }

            const payload = window.tempSelectedStudents.map((s, index) => ({
                participant_id: s.id,
                competition_id: window.tempCompId,
                group_id: groupId,
                is_leader: isGroup && !hasExistingLeader && index === 0
            }));

            const withFestPayload = window.festosWithFest ? window.festosWithFest(payload) : payload;
            const { data, error } = await supabaseClient.from('participant_competitions').insert(withFestPayload).select();
            if (error) throw error;
            
            // Instantly update Local UI State (No 2-second reload)
            if(data) globalAssignments.push(...data);

            showToast("Students added successfully!", "success");
            closeModal();
            renderAssignOverview();
        } catch (e) {
            showToast(e.message, "error");
            await fetchAllData(); // Force sync if error
            renderAssignOverview();
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

    availList.innerHTML = window.tempAvailableStudents.map(s => `
        <div style="background: var(--bg-main); padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);">
            <div>
                <div style="font-size: 0.8rem; font-weight: 700;">${s.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.unique_id} <span style="background:var(--border); color:var(--text-main); padding: 1px 4px; border-radius:4px; margin-left:4px;">${s.categories?.name || 'GEN'}</span></div>
            </div>
            <button class="btn btn-outline" style="min-height: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="qaAdd('${s.id}')" ${slotsLeft <= 0 ? 'disabled' : ''}><i class="fa-solid fa-plus"></i></button>
        </div>
    `).join('') || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; font-weight:600;">No available students left</div>';

    // Check if the current competition already has a leader
    const existingGroup = globalAssignments.filter(a => a.competition_id === window.tempCompId);
    const hasExistingLeader = existingGroup.some(a => a.is_leader);

    selList.innerHTML = window.tempSelectedStudents.map((s, index) => {
        const isLeader = window.tempIsGroup && !hasExistingLeader && index === 0;
        const leaderBadge = isLeader ? '<span class="leader-box" style="margin-left:6px; font-size:0.55rem;">LEADER</span>' : '';
        const dragIcon = window.tempIsGroup && !hasExistingLeader ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; margin-right: 4px;"></i>` : '';
        
        return `
        <div class="qa-draggable" draggable="${window.tempIsGroup && !hasExistingLeader}" data-id="${s.id}" ondragstart="qaDragStart(event, '${s.id}')" ondragover="qaDragOver(event)" ondrop="qaDrop(event, '${s.id}')" ondragend="qaDragEnd(event)" style="background: white; padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--primary); cursor: ${window.tempIsGroup && !hasExistingLeader ? 'grab' : 'default'}; box-shadow: var(--shadow-sm);">
            <div>
                <div style="font-size: 0.8rem; font-weight: 700;">${dragIcon}${s.name} ${leaderBadge}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.unique_id} <span style="background:var(--bg-main); color:var(--text-main); padding: 1px 4px; border-radius:4px; margin-left:4px; border: 1px solid var(--border);">${s.categories?.name || 'GEN'}</span></div>
            </div>
            <button class="btn btn-outline" style="min-height: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-color: var(--danger); color: var(--danger);" onclick="qaRemove('${s.id}')"><i class="fa-solid fa-minus"></i></button>
        </div>
    `}).join('') || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; font-weight:600;">No students selected</div>';

window.qaAdd = function(id) {
    const slotsLeft = window.tempSlotsLeft - window.tempSelectedStudents.length;
    if(slotsLeft <= 0) return;
    const studentIndex = window.tempAvailableStudents.findIndex(s => String(s.id) === String(id));
    if(studentIndex > -1) {
        window.tempSelectedStudents.push(window.tempAvailableStudents[studentIndex]);
        window.tempAvailableStudents.splice(studentIndex, 1);
        renderQAUI();
    }
};

window.qaRemove = function(id) {
    const studentIndex = window.tempSelectedStudents.findIndex(s => String(s.id) === String(id));
    if(studentIndex > -1) {
        window.tempAvailableStudents.push(window.tempSelectedStudents[studentIndex]);
        window.tempSelectedStudents.splice(studentIndex, 1);
        window.tempAvailableStudents.sort((a,b) => a.name.localeCompare(b.name));
        renderQAUI();
    }
};

// --- QUICK ADD DRAG AND DROP ---
window.qaDragStart = function(e, id) {
    e.dataTransfer.setData('text/plain', id);
    e.target.style.opacity = '0.5';
};
window.qaDragEnd = function(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.qa-draggable').forEach(el => el.classList.remove('drag-over'));
};
window.qaDragOver = function(e) {
    e.preventDefault();
    const target = e.target.closest('.qa-draggable');
    if(target) target.classList.add('drag-over');
};
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
        renderQAUI(); // Automatically reassigns leader badge to index 0
    }
};

window.openBulkBadgeModalTM = function() {
    if (typeof openBulkBadgeModal === 'function') {
        openBulkBadgeModal('all');
    }
};
}