// --- DATABASE SETUP ---
// Initialize Supabase Client
const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
if (typeof window !== 'undefined') window.supabaseClient = supabaseClient;

window.db = supabaseClient;

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || (user.role !== 'fest_manager' && user.role !== 'master_admin' && user.role !== 'admin')) {
    window.location.href = 'index.html';
}

// Inject Return Button for Admins
if (user.role === 'master_admin' || user.role === 'admin') {
    document.addEventListener("DOMContentLoaded", () => {
        const headerDiv = document.querySelector('.header-actions') || document.querySelector('.header > div:last-child');
        if (headerDiv) {
            const returnBtn = document.createElement('button');
            returnBtn.className = 'btn btn-primary';
            returnBtn.innerHTML = '<i class="ph ph-shield-check"></i> <span>Admin Hub</span>';
            returnBtn.onclick = () => window.location.href = 'admin.html';
            headerDiv.insertBefore(returnBtn, headerDiv.firstChild);
        }
    });
}

// --- GLOBAL STATE ---
let availableJudges = [];
let allCompetitions = [];
let allAssignments = [];
let allStages = [];
let allPendingComps = [];
let allPublishedComps = [];
// New Variables for Judge Management
let globalJudgesList = [];
let modalAssignComps = [];
let modalAssignedIds = [];

// --- UTILITIES ---
function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'assignments') loadAssignments();
    if (tabId === 'valuation') loadValuations();
    if (tabId === 'publish') loadPublishableComps();
    if (tabId === 'published-results') loadPublishedResults(); 
    if (tabId === 'judges') loadJudgesManagement(); // <--- Add this
}

function logout() {
    openConfirmModal("Logout", "Are you sure you want to log out of the manager dashboard?", () => {
        localStorage.removeItem('festUser');
        window.location.href = 'index.html';
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="ph-fill ph-check-circle" style="color: var(--success); font-size: 1.25rem;"></i>' : '<i class="ph-fill ph-warning-circle" style="color: #EF4444; font-size: 1.25rem;"></i>';
    toast.innerHTML = `${icon} <span style="font-weight: 500; font-size: 0.875rem;">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// --- PREMIUM CONFIRMATION MODAL ---
function openConfirmModal(title, text, confirmCallback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    
    confirmBtn.onclick = () => {
        document.getElementById('confirmModal').classList.remove('active');
        if (confirmCallback) confirmCallback();
    };
    
    document.getElementById('confirmModal').classList.add('active');
}


function populateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    const categories = new Set(allCompetitions.map(c => c.categories?.name || 'Uncategorized'));
    
    filter.innerHTML = `<option value="all">All Categories</option>`;
    categories.forEach(cat => {
        filter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function populateStageFilter() {
    const filter = document.getElementById('stageFilter');
    
    filter.innerHTML = `<option value="all">All Stages</option>`;
    filter.innerHTML += `<option value="Unstaged">Unstaged (No Stage)</option>`;
    
    // Populate using the official stages fetched from the database
    allStages.forEach(stage => {
        filter.innerHTML += `<option value="${stage.name}">${stage.name}</option>`;
    });
}

// --- SCHEDULE TIME UTILITIES ---
function timeStringToMinutes(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(mins)) return null;
    return hours * 60 + mins;
}

function isCompScheduledTimeEnded(comp) {
    if (!comp || !comp.schedule) return false;
    if (['published', 'judgement_complete'].includes(comp.status)) return false;
    const sched = comp.schedule;
    if (!sched.date) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    if (sched.date < todayStr) return true;
    if (sched.date > todayStr) return false;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let endMinutes = null;
    if (sched.to_time) {
        endMinutes = timeStringToMinutes(sched.to_time);
    } else if (sched.time) {
        const startMins = timeStringToMinutes(sched.time);
        if (startMins !== null) {
            const duration = parseInt(comp.duration || 60, 10);
            endMinutes = startMins + duration;
        }
    }

    return endMinutes !== null && currentMins >= endMinutes;
}

function filterCompetitions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const catFilter = document.getElementById('categoryFilter').value;
    const stageFilter = document.getElementById('stageFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    const filteredComps = allCompetitions.filter(comp => {
        const compNameMatch = comp.name.toLowerCase().includes(searchTerm);
        const catMatch = catFilter === 'all' || (comp.categories?.name || 'Uncategorized') === catFilter;
        
        // UPDATED: correctly reference the stage name from the database relation
        const compStage = comp.stages?.name || 'Unstaged';
        const stageMatch = stageFilter === 'all' || compStage === stageFilter;
        
        const assignedJudges = allAssignments.filter(a => a.competition_id === comp.id);
        const isAssigned = assignedJudges.length > 0;
        
        let statusMatch = true;
        if (statusFilter === 'unassigned') statusMatch = !isAssigned;
        else if (statusFilter === 'assigned') statusMatch = isAssigned;
        else if (statusFilter === 'valuation') statusMatch = (comp.status === 'valuation');
        else if (statusFilter === 'judgement_complete') statusMatch = (comp.status === 'judgement_complete');
        else if (statusFilter === 'ongoing') statusMatch = (comp.status === 'ongoing');
        else if (statusFilter === 'registration') statusMatch = (comp.status === 'registration');
        else if (statusFilter === 'pending') statusMatch = (comp.status === 'pending');
        else if (statusFilter === 'published') statusMatch = (comp.status === 'published');
        else if (statusFilter === 'action_needed') {
            statusMatch = (comp.status === 'judgement_complete') || isCompScheduledTimeEnded(comp);
        }

        return compNameMatch && catMatch && stageMatch && statusMatch;
    });

    renderGrid(filteredComps);
}

async function loadAssignments() {
    const grid = document.getElementById('comps-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading records...</p></div>`;

    try {
        if (availableJudges.length === 0) {
            let judgesQuery = supabaseClient.from('users').select('id, username, role');
            if (window.festosApplyFilter) judgesQuery = window.festosApplyFilter(judgesQuery);
            const { data: allUsers } = await judgesQuery;
            availableJudges = (allUsers || []).filter(u => u.role === 'judge' || (typeof festosMultiRole !== 'undefined' && festosMultiRole.hasRole(u, 'judge')));
        }

        if (allStages.length === 0) {
            let stagesQuery = supabaseClient.from('stages').select('id, name, stage_no').order('stage_no');
            if (window.festosApplyFilter) stagesQuery = window.festosApplyFilter(stagesQuery);
            const { data: stages } = await stagesQuery;
            allStages = stages || [];
        }

        // 1. Fetch Competitions, grabbing the stage_no alongside the name
        let compsQuery = supabaseClient.from('competitions')
            .select('*, categories(name), stages(name, stage_no)');
        if (window.festosApplyFilter) compsQuery = window.festosApplyFilter(compsQuery);
        const { data: comps } = await compsQuery;
            
        // 2. Fetch Master Schedule
        const schedVal = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : null;
        const masterSchedule = schedVal || {};

        // 3. Keep all competitions without filtering out based on fixed schedule time or announcer offset
        let activeComps = comps ? [...comps] : [];

        // 4. Chronological Sorting (Order by scheduled time if set, then alphabetically by name)
        activeComps.sort((a, b) => {
            const schedA = masterSchedule[a.id];
            const schedB = masterSchedule[b.id];
            const timeA = schedA && schedA.date && schedA.time ? new Date(`${schedA.date}T${schedA.time}`).getTime() : Infinity;
            const timeB = schedB && schedB.date && schedB.time ? new Date(`${schedB.date}T${schedB.time}`).getTime() : Infinity;
            if (timeA !== timeB) return timeA - timeB;
            return (a.name || '').localeCompare(b.name || '');
        });

        // Attach schedule to object for rendering
        activeComps.forEach(c => c.schedule = masterSchedule[c.id]);
        allCompetitions = activeComps;

        // 6. Fetch Assignments
        let assignQuery = supabaseClient.from('judgements').select('competition_id, judge_id, users(username)').is('awarded_mark', null);
        if (window.festosApplyFilter) assignQuery = window.festosApplyFilter(assignQuery);
        const { data: assignments } = await assignQuery;
        allAssignments = assignments || [];

        populateCategoryFilter();
        populateStageFilter();
        
        filterCompetitions();
    } catch (error) {
        console.error("SUPABASE ERROR:", error);
        showToast('Error loading data', 'error');
    }
}

function renderGrid(competitions) {
    const grid = document.getElementById('comps-grid');
    const selectAllContainer = document.getElementById('select-all-container');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    grid.innerHTML = '';

    if (competitions.length === 0) {
        if (selectAllContainer) selectAllContainer.style.display = 'none'; // Hide Select All
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-magnifying-glass" style="font-size:2rem; margin-bottom:1rem;"></i><p>No competitions match your filters.</p></div>`;
        return;
    }

    // Reset and show Select All when rendering new data
    if (selectAllContainer) {
        selectAllContainer.style.display = 'flex';
        selectAllCheckbox.checked = false; 
    }

    competitions.forEach(comp => {
        const compAssignments = allAssignments.filter(a => a.competition_id === comp.id);
        
        // Refined status badge
        let badgeClass = 'badge-pending';
        let badgeLabel = comp.status ? comp.status.toUpperCase() : 'PENDING';
        let badgeStyle = '';

        if (comp.status === 'judgement_complete') {
            badgeClass = '';
            badgeLabel = 'Awaiting Manager';
            badgeStyle = 'background: #EDE9FE; color: #6D28D9; border: 1.5px solid #C4B5FD; font-weight: 800;';
        } else if (comp.status === 'valuation') {
            badgeClass = 'badge-valuation';
            badgeLabel = 'IN VALUATION';
        } else if (comp.status === 'ongoing') {
            badgeClass = 'badge-ongoing';
            badgeLabel = 'LIVE / ONGOING';
        } else if (comp.status === 'registration') {
            badgeClass = '';
            badgeLabel = 'REGISTRATION';
            badgeStyle = 'background: #E0F2FE; color: #0284C7; border: 1.5px solid #BAE6FD; font-weight: 700;';
        } else if (comp.status === 'published') {
            badgeClass = '';
            badgeLabel = 'PUBLISHED';
            badgeStyle = 'background: #DCFCE7; color: #15803D; border: 1.5px solid #86EFAC; font-weight: 700;';
        }

        // Build the interactive tags for assigned judges
        let assignedJudgesHTML = `<span style="color: var(--text-muted);">No judges assigned yet</span>`;
        
        if (compAssignments.length > 0) {
            assignedJudgesHTML = `<div class="judge-tags-container">` + 
                compAssignments.map(a => `
                    <span class="judge-tag">
                        ${a.users?.username}
                        <button onclick="revokeJudge('${comp.id}', '${a.judge_id}', this)" title="Revoke ${a.users?.username}">
                            <i class="ph ph-x"></i>
                        </button>
                    </span>
                `).join('') + `</div>`;
        }

        // Format Stage ID & Name
        const compStage = comp.stages ? `Stage ${comp.stages.stage_no || 'TBD'} - ${comp.stages.name}` : 'Unstaged';
        
        // Format Time Schedule
        let schedBadge = '';
        if (comp.schedule && comp.schedule.date) {
            const timeObj = new Date(`${comp.schedule.date}T${comp.schedule.time}`);
            const timeStr = isNaN(timeObj) ? (comp.schedule.time || '') : timeObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const toStr = comp.schedule.to_time ? ` - ${comp.schedule.to_time}` : '';
            schedBadge = `<div class="card-meta" style="color: var(--primary); font-weight: 700; margin-bottom: 0.65rem;"><i class="ph ph-clock"></i> ${comp.schedule.date} @ ${timeStr}${toStr}</div>`;
        } else {
            schedBadge = `<div class="card-meta" style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.65rem;"><i class="ph ph-clock"></i> Unscheduled</div>`;
        }

        // Time Ended / Overdue Check
        const timeEnded = isCompScheduledTimeEnded(comp);
        let noticeBanner = '';
        if (comp.status === 'judgement_complete') {
            noticeBanner = `
                <div style="background: #F5F3FF; border: 1.5px solid #DDD6FE; border-radius: 8px; padding: 0.6rem 0.8rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #6D28D9; font-size: 0.82rem; font-weight: 700;">
                        <i class="ph-fill ph-check-circle" style="font-size: 1.15rem; color: #7C3AED;"></i>
                        <span>Event Finished &bull; Waiting for Manager</span>
                    </div>
                    <span style="font-size: 0.72rem; color: #7C3AED; background: #EDE9FE; padding: 2px 7px; border-radius: 4px; font-weight: 800;">ACTION REQUIRED</span>
                </div>
            `;
        } else if (timeEnded) {
            noticeBanner = `
                <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 8px; padding: 0.6rem 0.8rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #B45309; font-size: 0.82rem; font-weight: 700;">
                        <i class="ph-fill ph-clock-countdown" style="font-size: 1.15rem; color: #D97706;"></i>
                        <span>Scheduled Time Elapsed</span>
                    </div>
                    <span style="font-size: 0.72rem; color: #B45309; background: #FEF3C7; padding: 2px 7px; border-radius: 4px; font-weight: 800;">OVERDUE</span>
                </div>
            `;
        }

        // Manager Action Buttons according to status
        let actionButtonsHTML = '';
        if (comp.status === 'judgement_complete') {
            actionButtonsHTML = `
                <button class="btn btn-sm btn-success" style="flex: 1; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="switchTab('publish')">
                    <i class="ph-bold ph-megaphone"></i> Review &amp; Publish
                </button>
                <button class="btn btn-sm btn-outline" style="color: #7E22CE; border-color: #D8B4FE; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="openManagerRedoModal('${comp.id}')">
                    <i class="ph-bold ph-arrow-counter-clockwise"></i> Redo / Revert
                </button>
            `;
        } else if (comp.status === 'ongoing') {
            actionButtonsHTML = `
                <button class="btn btn-sm btn-danger" style="flex: 1; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="managerEndCompetition('${comp.id}', this)">
                    <i class="ph-bold ph-stop-circle"></i> End Competition
                </button>
                <button class="btn btn-sm btn-outline" style="color: #7E22CE; border-color: #D8B4FE; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="openManagerRedoModal('${comp.id}')">
                    <i class="ph-bold ph-arrow-counter-clockwise"></i> Redo
                </button>
            `;
        } else if (comp.status === 'registration') {
            actionButtonsHTML = `
                <button class="btn btn-sm btn-primary" style="flex: 1; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="managerStartCompetition('${comp.id}', 'ongoing', this)">
                    <i class="ph-bold ph-play"></i> Start Live Now
                </button>
                <button class="btn btn-sm btn-danger" style="padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="managerEndCompetition('${comp.id}', this)">
                    <i class="ph-bold ph-stop-circle"></i> End
                </button>
                <button class="btn btn-sm btn-outline" style="color: #7E22CE; border-color: #D8B4FE; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="openManagerRedoModal('${comp.id}')">
                    <i class="ph-bold ph-arrow-counter-clockwise"></i> Redo
                </button>
            `;
        } else if (comp.status === 'valuation') {
            actionButtonsHTML = `
                <button class="btn btn-sm btn-warning" style="flex: 1; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="switchTab('valuation')">
                    <i class="ph-bold ph-pencil-simple-line"></i> Open Valuation
                </button>
                <button class="btn btn-sm btn-outline" style="color: #7E22CE; border-color: #D8B4FE; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="openManagerRedoModal('${comp.id}')">
                    <i class="ph-bold ph-arrow-counter-clockwise"></i> Redo
                </button>
            `;
        } else if (comp.status === 'published') {
            actionButtonsHTML = `
                <button class="btn btn-sm btn-outline" style="flex: 1; color: #15803D; border-color: #86EFAC; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="switchTab('published-results')">
                    <i class="ph-bold ph-check-circle"></i> View Published
                </button>
                <button class="btn btn-sm btn-outline" style="color: #7E22CE; border-color: #D8B4FE; padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="openManagerRedoModal('${comp.id}')">
                    <i class="ph-bold ph-arrow-counter-clockwise"></i> Redo / Revert
                </button>
            `;
        } else {
            // Pending
            actionButtonsHTML = `
                <button class="btn btn-sm btn-outline" style="flex: 1; color: var(--primary); border-color: var(--primary); padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="managerStartCompetition('${comp.id}', 'ongoing', this)">
                    <i class="ph-bold ph-play"></i> Force Start
                </button>
                <button class="btn btn-sm btn-outline" style="padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700;" onclick="managerStartCompetition('${comp.id}', 'registration', this)">
                    <i class="ph-bold ph-broadcast"></i> Call Reg
                </button>
            `;
        }

        // Build options with assigned indicators
        const assignedJudgeIds = new Set(compAssignments.map(a => a.judge_id));
        const compJudgeOptions = availableJudges.map(j => {
            const isAssigned = assignedJudgeIds.has(j.id);
            return `<option value="${j.id}" ${isAssigned ? 'disabled style="color: #94A3B8;"' : ''}>${j.username}${isAssigned ? ' (Assigned)' : ''}</option>`;
        }).join('');

        grid.innerHTML += `
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div class="card-header">
                        <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                            <input type="checkbox" class="comp-checkbox" value="${comp.id}" onchange="toggleBulkActions()" style="width: 18px; height: 18px; cursor: pointer; margin-top: 3px;">
                            <div class="card-title">${comp.name}</div>
                        </div>
                        <span class="badge ${badgeClass}" style="${badgeStyle}">${badgeLabel}</span>
                    </div>
                    
                    <div class="card-meta" style="margin-bottom: 0.25rem;"><i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}</div>
                    <div class="card-meta" style="margin-bottom: 0.35rem;"><i class="ph ph-microphone-stage"></i> ${compStage}</div>
                    ${schedBadge}
                    ${noticeBanner}
                    
                    <div class="assigned-judges" style="margin-bottom: 1rem;">
                        <strong>Assigned Judges:</strong><br>
                        ${assignedJudgesHTML}
                    </div>
                    
                    <div class="judge-assign-box">
                        <div class="judge-select-wrapper">
                            <i class="ph ph-scales judge-select-icon"></i>
                            <select id="judge-select-${comp.id}" class="judge-assign-select" onchange="onJudgeSelectChange(this)">
                                <option value="">Select a Judge to Assign...</option>
                                ${compJudgeOptions}
                            </select>
                            <i class="ph ph-caret-down judge-select-arrow"></i>
                        </div>
                        <button class="judge-assign-btn" onclick="assignJudge('${comp.id}', this)">
                            <i class="ph-bold ph-user-plus"></i> Assign Judge
                        </button>
                    </div>
                </div>

                <!-- Manager Event Controls -->
                <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px dashed var(--border); display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${actionButtonsHTML}
                </div>
            </div>
        `;
    });
}

function onJudgeSelectChange(selectEl) {
    const box = selectEl.closest('.judge-assign-box');
    const btn = box ? box.querySelector('.judge-assign-btn') : null;
    if (selectEl.value) {
        selectEl.classList.add('has-selection');
        if (btn) btn.classList.add('btn-ready');
    } else {
        selectEl.classList.remove('has-selection');
        if (btn) btn.classList.remove('btn-ready');
    }
}

async function assignJudge(compId, btnElement) {
    const judgeId = document.getElementById(`judge-select-${compId}`).value;
    if (!judgeId) return showToast('Please select a judge.', 'error');

    // Prevent duplicate assignments
    const isAlreadyAssigned = allAssignments.some(a => a.competition_id === compId && a.judge_id === judgeId);
    if (isAlreadyAssigned) return showToast('This judge is already assigned to this competition!', 'error');

    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Assigning...';

    const insertRecord = window.festosWithFest ? window.festosWithFest([{ competition_id: compId, judge_id: judgeId }]) : [{ competition_id: compId, judge_id: judgeId }];
    const { error } = await window.db.from('judgements').insert(insertRecord);

    if (error) {
        showToast("Error: " + error.message, 'error');
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="ph-bold ph-user-plus"></i> Assign Judge';
    } else {
        showToast("Judge assigned successfully!");
        loadAssignments(); // Reload everything to update state
    }
}



// --- EXPORT FEATURES ---

// 1. Export Current View to CSV
function exportToCSV() {
    // Only export what is currently filtered and visible on screen
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const catFilter = document.getElementById('categoryFilter').value;
    
    // Quick re-filter to get active data
    const visibleData = allCompetitions.filter(comp => {
        const stageFilter = document.getElementById('stageFilter').value;
        const compStage = comp.stages?.name || 'Unstaged';
        
        return comp.name.toLowerCase().includes(searchTerm) && 
               (catFilter === 'all' || (comp.categories?.name === catFilter)) &&
               (stageFilter === 'all' || compStage === stageFilter);
    });

    let csvContent = "Competition Name,Category,Status,Assigned Judges\n";

    visibleData.forEach(comp => {
        const assignedJudges = allAssignments.filter(a => a.competition_id === comp.id).map(a => a.users?.username).join('; ');
        
        // Escape quotes and commas for safe CSV format
        const name = `"${comp.name.replace(/"/g, '""')}"`;
        const category = `"${(comp.categories?.name || 'Uncategorized').replace(/"/g, '""')}"`;
        const status = `"${comp.status}"`;
        const judges = `"${assignedJudges || 'Unassigned'}"`;

        csvContent += `${name},${category},${status},${judges}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = typeof getFestFileName === 'function' ? getFestFileName('Assignments', 'csv') : `Fest_Assignments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast("CSV Downloaded!");
}

// 2. Export Current View to PDF (Executive Standard)
async function exportToPDF() {
    showToast("Generating Manager Report PDF...");
    const activeFid = (typeof festosAuth !== 'undefined' && festosAuth.getCurrentFestId) ? festosAuth.getCurrentFestId() : null;
    
    const cards = Array.from(document.querySelectorAll('#comps-grid .card'));
    if (cards.length === 0) return showToast("No competitions to export.", "error");

    let tableRows = cards.map((card, index) => {
        const title = card.querySelector('.card-title')?.innerText || 'Untitled';
        const cat = card.querySelector('.card-meta')?.innerText || 'General';
        let judges = card.querySelector('.assigned-judges span')?.innerText || 'Unassigned';
        const isUnassigned = (judges === 'No judges assigned yet' || judges.toLowerCase().includes('unassigned'));
        const judgeBadge = isUnassigned 
            ? '<span style="background: #FEE2E2; color: #DC2626; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">Unassigned</span>'
            : `<span style="color: #0F172A; font-weight: 600; font-size: 11px;">${judges}</span>`;
        const bg = (index % 2 === 1) ? '#F8FAFC' : '#FFFFFF';

        return `
            <tr style="height: 30px; page-break-inside: avoid; break-inside: avoid;">
                <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 11px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${index + 1}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11.5px; background: ${bg};">${title}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 140px;">
                    <span style="background: #EFF6FF; color: #2563EB; font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block;">${cat}</span>
                </td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 220px;">${judgeBadge}</td>
            </tr>
        `;
    }).join('');

    const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
        ? window.festosGetPDFHeaderHTML('STAGE & EVENT MANAGEMENT REPORT', activeFid, {
            badge: `${cards.length} EVENTS MONITORED`,
            subtitle: 'OFFICIAL MANAGER OVERSIGHT LEDGER'
        })
        : '<h2 style="color: #4F46E5; margin-bottom: 5px;">Manager Report</h2>';

    const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
        ? window.festosGetPDFFooterHTML(null, null, 'Official Manager Operations')
        : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

    const contentHtml = `
        <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}
            
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #CBD5E1;">
                <thead>
                    <tr style="background: #0F172A; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;">
                        <th style="padding: 8px 6px; text-align: center; width: 35px;">#</th>
                        <th style="padding: 8px 10px;">COMPETITION NAME</th>
                        <th style="padding: 8px 10px; width: 140px;">CATEGORY</th>
                        <th style="padding: 8px 10px; width: 220px;">ASSIGNED JUDGES</th>
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
                filename: typeof getFestFileName === 'function' ? getFestFileName('Manager_Report', 'pdf') : 'Fest_Manager_Report.pdf',
                width: 800
            });
            showToast("Manager Report PDF Downloaded!");
        } else {
            const opt = {
                margin: 10,
                filename: typeof getFestFileName === 'function' ? getFestFileName('Assignments_Report', 'pdf') : `Fest_Assignments_Report_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast("PDF Downloaded!");
        }
    } catch(err) {
        showToast("Error generating PDF: " + err.message, "error");
    }
}




// --- BULK ACTION LOGIC ---

function toggleBulkActions() {
    const allCheckboxes = document.querySelectorAll('.comp-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.comp-checkbox:checked');
    const bulkToolbar = document.getElementById('bulk-actions');
    const countText = document.getElementById('selected-count');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    // Sync the Select All checkbox with manual selections
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = (allCheckboxes.length === checkedCheckboxes.length);
    }
    
    if (checkedCheckboxes.length > 0) {
        bulkToolbar.style.display = 'flex';
        countText.innerText = `${checkedCheckboxes.length} Selected`;
        
        // Populate bulk judge dropdown if empty
        const bulkSelect = document.getElementById('bulk-judge-select');
        if (bulkSelect.options.length <= 1) {
            bulkSelect.innerHTML = '<option value="">Select Judge...</option>' + 
                availableJudges.map(j => `<option value="${j.id}">${j.username}</option>`).join('');
        }
    } else {
        bulkToolbar.style.display = 'none';
    }
}


async function previewConvertedPoints(compId, legacyMaxMark, legacyIsGeneral) {
    try {
        let sysSet = {
    thresholds: { aplus: 90, a: 70, b: 60, c: 50 },
    points_solo: { aplus: 8, a: 7, b: 5, c: 3 },
    points_small: { aplus: 12, a: 10, b: 7, c: 5 },
    points_large: { aplus: 15, a: 12, b: 10, c: 7 },
    pos_points: { p1: 3, p2: 2, p3: 1 },
    poster_interval: 10,
    tm_access: true
};
        const { data: settingsData } = await window.db.from('settings').select('value').eq('id', 'point_system').maybeSingle();
        if (settingsData && settingsData.value) sysSet = settingsData.value;

        const { data: comp } = await window.db.from('competitions').select('*, participant_competitions(count)').eq('id', compId).single();
        if (!comp) throw new Error("Competition not found.");
        
        const maxMark = comp.max_mark || 100;
        const limit = comp.max_participants || 1;
        const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');

        const { data: judgements, error } = await window.db
            .from('judgements')
            .select('participant_id, awarded_mark, participants(name)')
            .eq('competition_id', compId)
            .not('participant_id', 'is', null) 
            .not('awarded_mark', 'is', null);

        if (error) throw error;
        if (!judgements || judgements.length === 0) {
            return showToast("No scores available to preview yet.", "error");
        }

        const pMap = {};
        judgements.forEach(j => {
            if (!pMap[j.participant_id]) {
                pMap[j.participant_id] = { name: j.participants?.name || 'Unknown', marks: [] };
            }
            pMap[j.participant_id].marks.push(parseFloat(j.awarded_mark));
        });

        const resultsArr = Object.values(pMap).map(p => {
            let sortedMarks = p.marks.sort((a, b) => a - b);
            if (sortedMarks.length >= 3) {
                sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
            }
            const sum = sortedMarks.reduce((a, b) => a + b, 0);
            p.score = sum / sortedMarks.length;
            return p;
        }).sort((a, b) => b.score - a.score);

        let previewHTML = `<div style="text-align: left; margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 8px; max-height: 250px; overflow-y: auto;">`;
        
        let currentRank = 1;
        let previousScore = -1;

        resultsArr.forEach((r, idx) => {
            // Update rank only if the score is different from the previous participant
            if (r.score !== previousScore) {
                currentRank = idx + 1;
            }
            previousScore = r.score;

            let percent = (r.score / maxMark) * 100;
            let gradePts = 0; let posPts = 0; let gradeStr = '-';

            // 1. Assign Grade Points ONLY if >= 50%
            if (percent >= 50) {
                if (percent >= sysSet.thresholds.aplus) { gradePts = Number(sysSet[`points_${sizeCat}`].aplus); gradeStr = 'A+'; }
                else if (percent >= sysSet.thresholds.a) { gradePts = Number(sysSet[`points_${sizeCat}`].a); gradeStr = 'A'; }
                else if (percent >= sysSet.thresholds.b) { gradePts = Number(sysSet[`points_${sizeCat}`].b); gradeStr = 'B'; }
                else { gradePts = Number(sysSet[`points_${sizeCat}`].c); gradeStr = 'C'; }
            }
            
            // 2. Assign Position Points ALWAYS (Removed the 3-participant limit)
            if (currentRank <= 3) {
                if (currentRank === 1) posPts = Number(sysSet.pos_points.p1) || 0;
                else if (currentRank === 2) posPts = Number(sysSet.pos_points.p2) || 0;
                else if (currentRank === 3) posPts = Number(sysSet.pos_points.p3) || 0;
            }
            
            const totalPts = gradePts + posPts;

            // APPEND "& PARTY" FOR GROUP EVENTS
            let displayName = r.name;
            if (comp.is_group && !displayName.endsWith('& PARTY')) {
                displayName += ' & PARTY';
            }
            
            previewHTML += `
            <div style="margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--text-main); font-size:0.95rem;">${currentRank}. ${displayName}</strong>
                    <span class="badge" style="background:var(--primary-light); color:var(--primary); font-size:0.75rem;">${gradeStr} | ${totalPts} PTS</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                    Avg Mark: <b>${r.score.toFixed(2)}</b> / ${maxMark}
                </div>
            </div>`;
        });
        previewHTML += `</div>`;

        showToast(`Results Preview <br> ${previewHTML}`, 'success');
        
        const toasts = document.querySelectorAll('.toast');
        if (toasts.length > 0) {
            const latestToast = toasts[toasts.length - 1];
            latestToast.style.width = '350px';
            latestToast.style.alignItems = 'flex-start';
        }
        
    } catch (err) {
        console.error("Preview Generation Error:", err);
        showToast("An error occurred while generating the preview.", "error");
    }
}

// --- NEW: Select All Logic ---
function toggleSelectAll(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.comp-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    toggleBulkActions(); // Update the toolbar UI
}



// --- EDIT PUBLISHED POINTS LOGIC ---

let currentEditingCompId = null;

async function openEditPointsModal(compId) {
    currentEditingCompId = compId;
    const modalBody = document.getElementById('edit-points-body');
    const saveBtn = document.getElementById('save-points-btn');
    
    modalBody.innerHTML = `<div style="text-align:center; padding:2rem;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading marks...</p></div>`;
    document.getElementById('edit-points-modal').classList.add('active');

    try {
        // Fetch comp details to check if it's a group
        const { data: comp } = await window.db.from('competitions').select('is_group').eq('id', compId).single();

        // Fetch all judgements for this competition that have actual marks
        const { data: judgements, error } = await window.db
            .from('judgements')
            .select('id, participant_id, awarded_mark, participants(name), users(username)')
            .eq('competition_id', compId)
            .not('participant_id', 'is', null);

        if (error) throw error;

        if (!judgements || judgements.length === 0) {
            modalBody.innerHTML = `<p style="text-align: center; color: var(--text-muted);">No marks found for this competition.</p>`;
            saveBtn.style.display = 'none';
            return;
        }

        saveBtn.style.display = 'block';
        modalBody.innerHTML = '';

        judgements.forEach(j => {
            let participantName = j.participants?.name || 'Unknown Participant';
            const judgeName = j.users?.username ? `(Judge: ${j.users.username})` : '';
            
            // --- APPEND "& PARTY" FOR EDIT MODAL ---
            if (comp && comp.is_group && !participantName.endsWith('& PARTY')) {
                participantName += ' & PARTY';
            }

            modalBody.innerHTML += `
                <div class="edit-point-item">
                    <label>${participantName} <span style="font-size: 0.75rem; color: var(--text-muted);">${judgeName}</span></label>
                    <input type="number" class="edit-point-input" data-judgement-id="${j.id}" value="${j.awarded_mark || 0}" step="0.1" min="0">
                </div>
            `;
        });

        // Attach save event listener cleanly
        saveBtn.onclick = () => saveEditedPoints();

    } catch (err) {
        console.error("Error loading marks for edit:", err);
        modalBody.innerHTML = `<p style="color: var(--danger); text-align: center;">Failed to load data.</p>`;
    }
}

function closeEditModal() {
    document.getElementById('edit-points-modal').classList.remove('active');
    currentEditingCompId = null;
}

// --- NEW REVOKE FUNCTION ---
async function revokeJudge(compId, judgeId, btnElement) {
    openConfirmModal("Revoke Judge?", "Are you sure you want to revoke this judge's assignment?", async () => {
        const originalIcon = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i>';
        btnElement.disabled = true;

        const { error } = await window.db
            .from('judgements')
            .delete()
            .match({ competition_id: compId, judge_id: judgeId });

        if (error) {
            console.error("REVOKE ERROR:", error);
            showToast("Failed to revoke: " + error.message, 'error');
            btnElement.innerHTML = originalIcon;
            btnElement.disabled = false;
        } else {
            showToast("Judge assignment revoked!");
            loadAssignments(); 
        }
    });
}

// --- PUBLISH RESULTS ---
async function publishCompetition(compId, btnElement) {
    openConfirmModal("Publish Results?", "Push final standings to the Live Portal immediately?", async () => {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Publishing...';
        await window.db.from('competitions').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', compId);
        showToast("Results published!", "success");
        loadPublishableComps(); 
    });
}

// --- REDO JUDGEMENT ---
async function redoJudgement(compId, btnElement) {
    openConfirmModal("Redo Judgement?", "Send this competition back for re-judging? This will ERASE all current marks!", async () => {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Reverting...';

        await window.db.from('judgements')
            .delete()
            .eq('competition_id', compId)
            .not('participant_id', 'is', null);

        const { error } = await window.db.from('competitions')
            .update({ status: 'ongoing' })
            .eq('id', compId);

        if (error) {
            showToast("Failed to revert: " + error.message, 'error');
            btnElement.innerHTML = '<i class="ph ph-arrow-u-up-left"></i> Redo';
            btnElement.disabled = false;
        } else {
            showToast("Sent back for re-judging! Marks erased.", "success");
            loadPublishableComps(); 
        }
    });
}

// --- BULK ASSIGN ---
async function bulkAssignJudges() {
    const judgeId = document.getElementById('bulk-judge-select').value;
    const checkboxes = document.querySelectorAll('.comp-checkbox:checked');
    
    if (!judgeId) return showToast('Please select a judge for bulk assignment.', 'error');
    if (checkboxes.length === 0) return;
    
    openConfirmModal("Bulk Assign?", `Assign this judge to ${checkboxes.length} competitions?`, async () => {
        let insertPayload = Array.from(checkboxes).map(cb => ({
            competition_id: cb.value,
            judge_id: judgeId
        }));
        if (window.festosWithFest) insertPayload = window.festosWithFest(insertPayload);

        const { error } = await window.db.from('judgements').insert(insertPayload);

        if (error) {
            showToast("Bulk Assign Error: " + error.message, 'error');
        } else {
            showToast(`Successfully assigned judge to ${checkboxes.length} competitions!`);
            document.getElementById('bulk-actions').style.display = 'none';
            loadAssignments();
        }
    });
}

// --- BULK REVOKE ---
async function bulkRevokeJudges() {
    const checkboxes = document.querySelectorAll('.comp-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    openConfirmModal("Bulk Revoke?", `WARNING: Remove ALL judges from the ${checkboxes.length} selected competitions?`, async () => {
        const compIds = Array.from(checkboxes).map(cb => cb.value);

        const { error } = await window.db.from('judgements')
            .delete()
            .in('competition_id', compIds);

        if (error) {
            showToast("Bulk Revoke Error: " + error.message, 'error');
        } else {
            showToast(`Cleared judges from ${checkboxes.length} competitions!`);
            document.getElementById('bulk-actions').style.display = 'none';
            loadAssignments();
        }
    });
}

// --- REVERT PUBLISHED ---
async function revertPublishedResult(compId, btnElement) {
    openConfirmModal("Revert to Pending?", "Move this published result back to pending? It will be removed from Live Results!", async () => {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Reverting...';

        const { error } = await window.db.from('competitions')
            .update({ status: 'judgement_complete', updated_at: new Date().toISOString() }) 
            .eq('id', compId);

        if (error) {
            showToast("Failed to revert: " + error.message, 'error');
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="ph ph-arrow-u-up-left"></i> Revert';
        } else {
            showToast("Moved back to pending queue!", "success");
            loadPublishedResults(); 
        }
    });
}

// --- SAVE EDITED POINTS ---
async function saveEditedPoints() {
    const inputs = document.querySelectorAll('.edit-point-input');
    const saveBtn = document.getElementById('save-points-btn');
    const updates = [];

    inputs.forEach(input => {
        updates.push({
            id: input.getAttribute('data-judgement-id'),
            awarded_mark: parseFloat(input.value)
        });
    });

    if (updates.length === 0) return;

    openConfirmModal("Save Updates?", "Are you sure you want to update these scores? This will immediately affect live results.", async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Saving...';

        try {
            const { error } = await window.db
                .from('judgements')
                .upsert(updates, { onConflict: 'id' });

            if (error) throw error;

            showToast("Points successfully updated!", "success");
            closeEditModal();
            loadPublishedResults();
            
        } catch (err) {
            console.error("Error saving marks:", err);
            showToast("Failed to save updates: " + err.message, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Changes';
        }
    });
}

// Update your loadPublishableComps function to save to the global array:
async function loadPublishableComps() {
    const grid = document.getElementById('publish-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i></div>`;

    let compsQuery = window.db.from('competitions').select('*, categories(name)').eq('status', 'judgement_complete');
    if (window.festosApplyFilter) compsQuery = window.festosApplyFilter(compsQuery);
    const { data: comps } = await compsQuery.order('name');
    allPendingComps = comps || [];
    
    // Update the live count badge
    let countQuery = window.db.from('competitions').select('*', { count: 'exact', head: true }).eq('status', 'published');
    if (window.festosApplyFilter) countQuery = window.festosApplyFilter(countQuery);
    const { count } = await countQuery;
    const countBadge = document.getElementById('live-published-count');
    if(countBadge) countBadge.innerText = `${count || 0} Published`;

    filterPendingPublish();
}

function filterPendingPublish() {
    const search = document.getElementById('searchPending').value.toLowerCase();
    const grid = document.getElementById('publish-grid');
    grid.innerHTML = '';

    const filtered = allPendingComps.filter(c => c.name.toLowerCase().includes(search) || (c.categories?.name || '').toLowerCase().includes(search));

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><p>No pending publications found.</p></div>`;
        return;
    }

    filtered.forEach(comp => {
        grid.innerHTML += `
            <div class="card" style="border: 1px solid var(--success);">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge badge-ready">Ready</span>
                </div>
                <div class="card-meta" style="margin-bottom: 1.5rem;"><i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}</div>
                <div style="display: flex; gap: 0.5rem; width: 100%; flex-wrap: wrap;">
                    <button class="btn btn-outline" style="flex: 1; min-width: 100px;" onclick="previewConvertedPoints('${comp.id}', ${comp.max_mark || 100}, ${comp.categories?.is_general || false})"><i class="ph ph-eye"></i> Preview</button>
                    <button class="btn btn-outline" style="flex: 1; min-width: 100px;" onclick="redoJudgement('${comp.id}', this)"><i class="ph ph-arrow-u-up-left"></i> Redo</button>
                    <button class="btn btn-success" style="flex: 2; min-width: 140px;" onclick="publishCompetition('${comp.id}', this)"><i class="ph ph-megaphone-simple"></i> Publish</button>
                </div>
            </div>
        `;
    });
}

// Update loadPublishedResults similarly:
async function loadPublishedResults() {
    const grid = document.getElementById('published-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading live results...</p></div>`;

    let compsQuery = window.db.from('competitions').select('*, categories(name)').eq('status', 'published');
    if (window.festosApplyFilter) compsQuery = window.festosApplyFilter(compsQuery);
    const { data: comps } = await compsQuery.order('name');
    allPublishedComps = comps || [];
    filterPublished();
}

function filterPublished() {
    const search = document.getElementById('searchPublished').value.toLowerCase();
    const grid = document.getElementById('published-grid');
    grid.innerHTML = '';

    const filtered = allPublishedComps.filter(c => c.name.toLowerCase().includes(search) || (c.categories?.name || '').toLowerCase().includes(search));

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-globe" style="font-size:2rem; margin-bottom:1rem;"></i><p>No results found.</p></div>`;
        return;
    }

    filtered.forEach(comp => {
        grid.innerHTML += `
            <div class="card" style="border: 1px solid var(--primary);">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge" style="background: var(--primary-light); color: var(--primary);">Live</span>
                </div>
                <div class="card-meta" style="margin-bottom: 1.5rem;"><i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}</div>
                <div style="display: flex; gap: 0.75rem; width: 100%; flex-wrap: wrap; margin-top: auto;">
                    <button class="btn btn-outline" style="flex: 1; min-width: 100px;" onclick="previewConvertedPoints('${comp.id}', ${comp.max_mark || 100}, ${comp.categories?.is_general || false})"><i class="ph ph-eye"></i> View</button>
                    <button class="btn btn-outline" style="flex: 1; min-width: 100px; color: var(--primary); border-color: var(--primary);" onclick="openEditPointsModal('${comp.id}')"><i class="ph ph-pencil-simple"></i> Edit</button>
                    <button class="btn btn-outline" style="flex: 1; min-width: 100px; color: var(--danger); border-color: var(--danger);" onclick="revertPublishedResult('${comp.id}', this)"><i class="ph ph-arrow-u-up-left"></i> Revert</button>
                </div>
            </div>
        `;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Other init functions...
    fetchAndApplyBranding();
});

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================
async function fetchAndApplyBranding() {
    try {
        const festId = window.festosAuth ? window.festosAuth.getCurrentFestId() : null;
        let val = window.festosGetSetting ? await window.festosGetSetting('system_branding', festId) : null;
        if (!val && festId && typeof supabaseClient !== 'undefined') {
            const { data: fData } = await supabaseClient.from('fests').select('name, logo').eq('id', festId).maybeSingle();
            if (fData && (fData.name || fData.logo)) {
                val = { fest_name: fData.name, fest_logo: fData.logo, display_mode: fData.logo ? 'both' : 'name' };
            }
        }
        if (val) applyGlobalBranding(val);
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    if (!brandingData) return;
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const rawLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '' ? brandingData.fest_logo.trim() : '';
    const validLogo = rawLogo !== '' && rawLogo !== 'festos-logo.svg' && rawLogo !== '/festos-logo.svg';
    const displayMode = brandingData.display_mode || 'both'; 
    
    const festName = validName ? brandingData.fest_name : 'Festival';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

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

    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // CRITICAL FIX: Removed inline box-shadow and border-radius to ensure a perfectly flat, clean logo
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 36px; width: auto; max-width: 180px; object-fit: contain; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="ph-fill ph-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        if (showName) {
            html += `<span style="letter-spacing: -0.5px;">${validName ? brandingData.fest_name : 'FestOS'}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login')) {
            container.style.justifyContent = 'center';
        }
    });

    if (typeof window !== 'undefined') window.systemBranding = brandingData;
}

// --- SYSTEM PROGRESS / UNFINISHED STATS LOGIC ---

async function openStatsModal() {
    document.getElementById('stats-modal').classList.add('active');
    const listContainer = document.getElementById('unfinished-list');
    
    // Show loading spinner
    listContainer.innerHTML = `<div style="text-align:center; padding:2rem;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite; color: var(--text-muted);"></i></div>`;

    try {
        // Fetch all competitions to get the grand total and details
        let compsQuery = window.db
            .from('competitions')
            .select('id, name, status, categories(name)');
        if (window.festosApplyFilter) compsQuery = window.festosApplyFilter(compsQuery);
        const { data: allComps, error } = await compsQuery.order('name');

        if (error) throw error;

        // Calculate statistics based on statuses
        const total = (allComps || []).length;
        const published = (allComps || []).filter(c => c.status === 'published').length;
        const pendingPublish = (allComps || []).filter(c => c.status === 'judgement_complete').length;
        
        // Unfinished = Anything NOT in 'published' or 'judgement_complete' 
        const unfinishedComps = (allComps || []).filter(c => c.status !== 'published' && c.status !== 'judgement_complete');
        const unfinishedCount = unfinishedComps.length;

        // Update UI Stats
        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-published').innerText = published;
        document.getElementById('stat-pending').innerText = pendingPublish;
        document.getElementById('stat-unfinished').innerText = unfinishedCount;

        // Populate the Detailed List
        listContainer.innerHTML = '';
        if (unfinishedComps.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:2rem; color: var(--success); font-weight: 600;"><i class="ph-fill ph-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem;"></i><br>All competitions are fully processed!</div>`;
        } else {
            unfinishedComps.forEach(comp => {
                // Determine styling based on specific unresolved status
                let badgeStyle = "background: var(--bg-main); color: var(--text-muted);";
                if(comp.status === 'ongoing') badgeStyle = "background: #DBEAFE; color: #1D4ED8; border: 1px solid rgba(29, 78, 216, 0.2);";
                if(comp.status === 'pending') badgeStyle = "background: var(--warning-light); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.2);";

                const canEnd = comp.status === 'ongoing' || comp.status === 'registration';
                listContainer.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; background: var(--bg-main); border-radius: var(--radius-md); border: 1px solid var(--border); transition: var(--transition); gap: 0.75rem;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${comp.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;">
                            <span class="badge" style="${badgeStyle} text-transform: uppercase; font-size: 0.7rem;">${comp.status.replace('_', ' ')}</span>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; color: #7E22CE; border-color: #D8B4FE;" onclick="closeStatsModal(); openManagerRedoModal('${comp.id}')" title="Redo / Revert">
                                <i class="ph-bold ph-arrow-counter-clockwise"></i> Redo
                            </button>
                            ${canEnd ? `
                                <button class="btn btn-danger" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="managerEndCompetition('${comp.id}', this)" title="End Event">
                                    <i class="ph-bold ph-stop-circle"></i> End
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
        }
    } catch (err) {
        console.error("Error loading system stats:", err);
        listContainer.innerHTML = `<p style="color: var(--danger); text-align: center; font-weight: 600;">Failed to load data. Check console for details.</p>`;
    }
}


// ==========================================
// MANAGER DIRECT EVENT CONTROLS (END / REDO / START)
// ==========================================

async function managerEndCompetition(compId, btnElement) {
    const comp = allCompetitions.find(c => c.id === compId);
    const compName = comp ? comp.name : 'this competition';
    const isOffstage = comp && (comp.type === 'offstage' || (comp.stages && comp.stages.name && comp.stages.name.toLowerCase().includes('offstage')));
    const targetStatus = isOffstage ? 'valuation' : 'judgement_complete';
    const targetLabel = isOffstage ? 'In Valuation (Offstage)' : 'Completed (Awaiting Manager)';

    openConfirmModal(
        "End Competition?",
        `End "${compName}" now? Status will be updated to ${targetLabel}.`,
        async () => {
            if (btnElement) {
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Ending...';
            }
            try {
                const { error } = await window.db.from('competitions')
                    .update({ status: targetStatus, updated_at: new Date().toISOString() })
                    .eq('id', compId);

                if (error) throw error;
                showToast(`"${compName}" marked as ${targetLabel}!`, 'success');
                loadAssignments();
            } catch (err) {
                console.error("Error ending competition:", err);
                showToast("Failed to end competition: " + err.message, 'error');
                if (btnElement) {
                    btnElement.disabled = false;
                    btnElement.innerHTML = '<i class="ph-bold ph-stop-circle"></i> End Competition';
                }
            }
        }
    );
}

function openManagerRedoModal(compId) {
    const comp = allCompetitions.find(c => c.id === compId);
    document.getElementById('redoModalCompId').value = compId;

    if (comp) {
        document.getElementById('redoModalCompTitle').innerText = `Redo: ${comp.name}`;
        const stageName = comp.stages ? `Stage ${comp.stages.stage_no || ''} - ${comp.stages.name}` : 'Unstaged';
        const catName = comp.categories?.name || 'Uncategorized';
        document.getElementById('redoModalCompInfo').innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--text-main); font-size: 0.95rem;">${comp.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                        <i class="ph ph-folders"></i> ${catName} &bull; <i class="ph ph-microphone-stage"></i> ${stageName}
                    </div>
                </div>
                <span class="badge" style="font-size: 0.72rem; text-transform: uppercase;">${comp.status}</span>
            </div>
        `;
    } else {
        document.getElementById('redoModalCompTitle').innerText = 'Redo Competition';
        document.getElementById('redoModalCompInfo').innerHTML = '';
    }

    // Default to ongoing radio and unchecked marks erase
    const defaultRadio = document.querySelector('input[name="redoTargetStatus"][value="ongoing"]');
    if (defaultRadio) defaultRadio.checked = true;
    const clearMarksCb = document.getElementById('redoClearMarks');
    if (clearMarksCb) clearMarksCb.checked = false;

    const modalBody = document.querySelector('#managerRedoModal .redo-modal-body');
    if (modalBody) modalBody.scrollTop = 0;

    document.getElementById('managerRedoModal').classList.add('active');
}

function closeManagerRedoModal() {
    document.getElementById('managerRedoModal').classList.remove('active');
}

async function executeManagerRedo() {
    const compId = document.getElementById('redoModalCompId').value;
    if (!compId) return;

    const selectedRadio = document.querySelector('input[name="redoTargetStatus"]:checked');
    const targetStatus = selectedRadio ? selectedRadio.value : 'ongoing';
    const clearMarks = document.getElementById('redoClearMarks').checked;
    const btn = document.getElementById('btnConfirmManagerRedo');

    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Applying...';

    try {
        if (clearMarks) {
            await window.db.from('judgements')
                .delete()
                .eq('competition_id', compId)
                .not('participant_id', 'is', null);
        }

        const { error } = await window.db.from('competitions')
            .update({ status: targetStatus })
            .eq('id', compId);

        if (error) throw error;

        closeManagerRedoModal();
        showToast(`Competition successfully reverted to ${targetStatus}!`, 'success');
        loadAssignments();
        if (typeof loadPublishableComps === 'function') loadPublishableComps();
    } catch (err) {
        console.error("Error executing redo:", err);
        showToast("Error updating competition: " + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph-bold ph-arrow-counter-clockwise"></i> Apply &amp; Revert Status';
    }
}

async function managerStartCompetition(compId, targetStatus, btnElement) {
    const comp = allCompetitions.find(c => c.id === compId);
    const compName = comp ? comp.name : 'this competition';
    const label = targetStatus === 'ongoing' ? 'Live Event' : 'Calling / Registration';

    openConfirmModal(
        `Start ${label}?`,
        `Move "${compName}" directly to ${label}?`,
        async () => {
            if (btnElement) {
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Starting...';
            }
            try {
                const { error } = await window.db.from('competitions')
                    .update({ status: targetStatus, updated_at: new Date().toISOString() })
                    .eq('id', compId);

                if (error) throw error;
                showToast(`"${compName}" is now ${targetStatus}!`, 'success');
                loadAssignments();
            } catch (err) {
                console.error("Error starting competition:", err);
                showToast("Failed to update status: " + err.message, 'error');
                if (btnElement) {
                    btnElement.disabled = false;
                }
            }
        }
    );
}

function closeStatsModal() {
    document.getElementById('stats-modal').classList.remove('active');
}

// Boot up
loadAssignments();

// ==========================================
// JUDGE MANAGEMENT ENGINE (PORTED FROM ADMIN)
// ==========================================

async function loadJudgesManagement() {
    try {
        let judgesQuery = supabaseClient
            .from('users')
            .select('id, username, role');
        if (window.festosApplyFilter) judgesQuery = window.festosApplyFilter(judgesQuery);
        const { data: allUsers, error: judgesErr } = await judgesQuery.order('username');
        if (judgesErr) throw judgesErr;
        
        globalJudgesList = (allUsers || []).filter(u => u.role === 'judge' || (typeof festosMultiRole !== 'undefined' && festosMultiRole.hasRole(u, 'judge')));

        let assignQuery = supabaseClient
            .from('judgements')
            .select('judge_id, competition_id, competitions(name, categories(name), stages(name))');
        if (window.festosApplyFilter) assignQuery = window.festosApplyFilter(assignQuery);
        const { data: assignments, error: assignErr } = await assignQuery;
        if (assignErr) throw assignErr;

        globalJudgesList.forEach(judge => {
            const judgeAssigns = (assignments || []).filter(a => a.judge_id === judge.id);
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
            ? `<span class="badge" style="background: var(--primary-light); color: var(--primary);">${assignCount} Events</span>` 
            : `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border);">Unassigned</span>`;

        const safeData = JSON.stringify(judge).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700; font-size: 1.05rem; padding: 1.25rem 1.5rem; color: var(--text-main);">
                    <i class="ph ph-scales" style="color: var(--primary); margin-right: 0.5rem; font-size: 1.25rem; vertical-align: bottom;"></i> ${judge.username}
                </td>
                <td style="padding: 1.25rem 1.5rem;">${countBadge}</td>
                <td style="padding: 1.25rem 1.5rem;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline btn-icon" style="color: var(--primary); border-color: rgba(59, 130, 246, 0.3);" onclick="viewJudgeDetails('${judge.id}')" ${assignCount === 0 ? 'disabled' : ''} title="View Schedule">
                            <i class="ph ph-calendar-blank"></i>
                        </button>
                        <button class="btn btn-outline btn-icon" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" onclick="exportSpecificJudgePDF('${judge.id}')" ${assignCount === 0 ? 'disabled' : ''} title="Download Schedule PDF">
                            <i class="ph ph-file-pdf"></i>
                        </button>
                        <button class="btn btn-outline btn-icon" style="color: var(--text-muted); border-color: var(--border);" onclick="openAssignJudgeEvents('${judge.id}')" title="Assign Events">
                            <i class="ph ph-list-bullets"></i>
                        </button>
                        <button class="btn btn-outline btn-icon" style="color: var(--text-muted); border-color: var(--border);" onclick='openJudgeModal(${safeData})' title="Edit Judge">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button class="btn btn-outline btn-icon" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" onclick="deleteJudge('${judge.id}', '${judge.username}')" title="Delete Judge">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function filterJudgesTable() { renderJudgesTable(); }

async function openJudgeModal(editData = null) {
    if (editData) {
        document.getElementById('editJudgeId').value = editData.id;
        document.getElementById('newJudgeName').value = editData.username;
        document.getElementById('judgeModalTitle').innerText = 'Edit Judge Profile';
        
        const {data} = await supabaseClient.from('users').select('name, password_hash').eq('id', editData.id).single();
        if(data) {
            document.getElementById('newJudgeFullName').value = data.name || '';
            document.getElementById('newJudgePass').value = data.password_hash;
        }
    } else {
        document.getElementById('editJudgeId').value = '';
        document.getElementById('newJudgeFullName').value = '';
        document.getElementById('newJudgeName').value = '';
        document.getElementById('newJudgePass').value = '';
        document.getElementById('judgeModalTitle').innerText = 'Register New Judge';
    }
    
    document.getElementById('judgeFormModal').classList.add('active');
}

async function saveJudgeProfile() {
    const id = document.getElementById('editJudgeId').value;
    const name = document.getElementById('newJudgeFullName').value.trim();
    const username = document.getElementById('newJudgeName').value.trim();
    const password_hash = document.getElementById('newJudgePass').value.trim();
    
    if (!username || !password_hash || !name) return showToast('Name, Username, and Password are required.', 'error');
    
    const btn = document.getElementById('btnSaveJudge');
    const ogText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Saving...';
    btn.disabled = true;

    try {
        let payload = { name, username, password_hash, role: 'judge' };
        if (id) payload.id = id;
        if (window.festosWithFest) payload = window.festosWithFest(payload);
        
        const { error } = await supabaseClient.from('users').upsert([payload]);
        if (error) {
            if (error.code === '23505') throw new Error('Username already taken.');
            throw error;
        }
        
        showToast(id ? 'Judge profile updated!' : 'New Judge registered!'); 
        document.getElementById('judgeFormModal').classList.remove('active');
        loadJudgesManagement(); 
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

async function deleteJudge(id, username) {
    openConfirmModal("Delete Judge?", `Are you sure you want to permanently delete Judge "${username}"?`, async () => {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') throw new Error(`Cannot delete ${username} as they have already submitted marks.`);
                throw error;
            }
            showToast(`Judge ${username} deleted.`);
            loadJudgesManagement();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function openAssignJudgeEvents(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    document.getElementById('assign-judge-title').innerText = `Assign Events: ${judge.username}`;
    document.getElementById('target-assign-judge-id').value = judgeId;
    
    const listContainer = document.getElementById('assign-judge-list');
    listContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite; font-size: 2rem; color: var(--primary);"></i><p style="margin-top:0.5rem; color: var(--text-muted);">Fetching events...</p></div>';
    document.getElementById('assignJudgeEventsModal').classList.add('active');
    
    try {
        let compsQuery = supabaseClient
            .from('competitions')
            .select('id, name, categories(name)');
        if (window.festosApplyFilter) compsQuery = window.festosApplyFilter(compsQuery);
        const { data: comps, error } = await compsQuery.order('name');
        if (error) throw error;

        modalAssignComps = comps || [];
        modalAssignedIds = judge.assignments.map(a => a.id);
        
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
                <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: var(--transition);" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                    <input type="checkbox" value="${c.id}" ${isChecked} onchange="updateModalAssignedIds(this)" style="width: 18px; height: 18px; accent-color: var(--primary);">
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

function filterJudgeAssignList() { renderJudgeAssignList(); }

function updateModalAssignedIds(cb) {
    if (cb.checked) {
        if (!modalAssignedIds.includes(cb.value)) modalAssignedIds.push(cb.value);
    } else {
        modalAssignedIds = modalAssignedIds.filter(id => id !== cb.value);
    }
}

async function saveJudgeAssignments() {
    const judgeId = document.getElementById('target-assign-judge-id').value;
    const btn = document.getElementById('btn-save-judge-assign');
    const ogText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Saving...';
    
    try {
        await supabaseClient.from('judgements')
            .delete()
            .eq('judge_id', judgeId)
            .is('participant_id', null);
        
        if(modalAssignedIds.length > 0) {
            let inserts = modalAssignedIds.map(compId => ({ competition_id: compId, judge_id: judgeId }));
            if (window.festosWithFest) inserts = window.festosWithFest(inserts);
            await supabaseClient.from('judgements').insert(inserts);
        }
        
        showToast('Judge assignments updated successfully!');
        document.getElementById('assignJudgeEventsModal').classList.remove('active');
        loadJudgesManagement(); 
    } catch(e) {
        showToast("Error updating assignments: " + e.message, 'error');
    } finally {
        btn.disabled = false; 
        btn.innerHTML = ogText;
    }
}

async function viewJudgeDetails(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;

    document.getElementById('jd-modal-title').innerText = `Schedule: ${judge.username}`;
    const tbody = document.getElementById('jd-modal-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;"><i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite; font-size: 2rem; color: var(--primary);"></i></td></tr>`;
    document.getElementById('judgeDetailsModal').classList.add('active');

    try {
        const val = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : (await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle()).data?.value;
        const masterSchedule = val || {};

        if (judge.assignments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No events assigned to this judge.</td></tr>`;
            return;
        }

        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

        scheduledAssignments.sort((a, b) => {
            if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
            return a.sched.time.localeCompare(b.sched.time);
        });

        tbody.innerHTML = '';
        scheduledAssignments.forEach(comp => {
            const timeStr = comp.sched.date !== 'TBD' 
                ? `<span style="color: var(--primary); font-weight: 700;">${comp.sched.date}</span><br><span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">${comp.sched.time}</span>` 
                : `<span style="color: var(--warning); font-weight: 600; font-size: 0.8rem;">Unscheduled</span>`;
            
            tbody.innerHTML += `
                <tr>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border); white-space: nowrap;">${timeStr}</td>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border); font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${comp.name}</td>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border);"><span class="badge" style="background: var(--bg-main); border: 1px solid var(--border); color: var(--text-muted);">${comp.categories?.name || 'General'}</span></td>
                    <td style="padding: 1rem; border-bottom: 1px solid var(--border); font-weight: 500;"><i class="ph-fill ph-microphone-stage" style="color: var(--primary); margin-right: 4px;"></i> ${comp.stages?.name || 'Unassigned'}</td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading schedule.</td></tr>`;
    }
}

// --- LIGHTWEIGHT PDF HEADER FOR MANAGER ---
function getManagerPDFHeaderHTML(title) {
    if (typeof window !== 'undefined' && typeof window.festosGetPDFHeaderHTML === 'function') {
        return window.festosGetPDFHeaderHTML(title);
    }
    if (typeof getPDFHeaderHTML === 'function') {
        return getPDFHeaderHTML(title);
    }
    const branding = typeof festosGetActiveBranding === 'function' ? festosGetActiveBranding() : (window.systemBranding || {});
    const festName = branding.fest_name || 'Festival';
    return `
        <div style="text-align: center; margin-bottom: 30px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 26px; text-transform: uppercase; font-weight: 800;">${festName}</h1>
            <h2 style="color: #1F2937; font-size: 18px; margin-top: 0; text-transform: uppercase;">${title}</h2>
            <p style="color: #64748B; font-size: 12px; margin-top: 4px;">Generated on: ${new Date().toLocaleString()}</p>
        </div>
    `;
}

async function exportSpecificJudgePDF(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    showToast(`Generating Schedule PDF for ${judge.username}...`, 'success');
    const activeFid = typeof getActiveFestId === 'function' ? getActiveFestId() : (typeof festosAuth !== 'undefined' ? festosAuth.getCurrentFestId() : null);

    const val = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : (await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle()).data?.value;
    const masterSchedule = val || {};

    let tableRows = '';
    if (judge.assignments.length === 0) {
        tableRows = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #64748B; font-weight: 600;">No events currently assigned.</td></tr>`;
    } else {
        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

        scheduledAssignments.sort((a, b) => {
            if (a.sched.date !== b.sched.date) return (a.sched.date || '').localeCompare(b.sched.date || '');
            return (a.sched.time || '').localeCompare(b.sched.time || '');
        });

        tableRows = scheduledAssignments.map((comp, i) => {
            const bg = (i % 2 === 1) ? '#F8FAFC' : '#FFFFFF';
            const timeStr = comp.sched.date !== 'TBD' 
                ? `<span style="font-weight: 700; color: #0F172A;">${comp.sched.date}</span><br><span style="color: #64748B; font-size: 10px; font-weight: 600;">${comp.sched.time}</span>` 
                : `<span style="background: #FEF3C7; color: #D97706; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700;">Unscheduled</span>`;

            return `
            <tr style="height: 32px; page-break-inside: avoid; break-inside: avoid;">
                <td style="padding: 7px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 11px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${i + 1}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-size: 11px; background: ${bg}; width: 130px;">${timeStr}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11.5px; background: ${bg};">${comp.name}</td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 120px;">
                    <span style="background: #EFF6FF; color: #2563EB; font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block;">${comp.categories?.name || 'General'}</span>
                </td>
                <td style="padding: 7px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #4F46E5; font-size: 11px; background: ${bg}; width: 130px;">${comp.stages?.name || 'Unassigned'}</td>
            </tr>
        `}).join('');
    }

    const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
        ? window.festosGetPDFHeaderHTML(`JUDGE DOSSIER: ${judge.username.toUpperCase()}`, activeFid, {
            badge: 'OFFICIAL APPOINTMENT',
            subtitle: `${judge.assignments.length} OFFICIATED ASSIGNMENTS &bull; JURY ROSTER`
        })
        : getManagerPDFHeaderHTML(`Judge Schedule: ${judge.username}`);

    const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
        ? window.festosGetPDFFooterHTML(null, null, `Judge Appointee: ${judge.username}`)
        : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

    const contentHtml = `
        <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}

            <!-- Judge Profile Banner -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; background: #F8FAFC; padding: 16px 20px; border-radius: 8px; border: 1px solid #CBD5E1;">
                <div>
                    <div style="font-size: 9.5px; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">JUDGE PROFILE</div>
                    <h2 style="font-size: 19px; color: #0F172A; margin: 2px 0 0 0; text-transform: uppercase; font-weight: 900;">${judge.username}</h2>
                    <div style="font-size: 11px; color: #475569; margin-top: 3px; font-weight: 600;">ROLE: ACCREDITED FESTIVAL ADJUDICATOR</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 9.5px; color: #4F46E5; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">OFFICIATING COUNT</div>
                    <div style="font-size: 22px; font-weight: 900; color: #4F46E5; margin-top: 2px;">${judge.assignments.length} <span style="font-size: 11px; color: #64748B; font-weight: 700;">EVENTS</span></div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #CBD5E1;">
                <thead>
                    <tr style="background: #0F172A; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;">
                        <th style="padding: 8px 6px; text-align: center; width: 35px;">#</th>
                        <th style="padding: 8px 10px; width: 130px;">DATE & TIME</th>
                        <th style="padding: 8px 10px;">COMPETITION NAME</th>
                        <th style="padding: 8px 10px; width: 120px;">CATEGORY</th>
                        <th style="padding: 8px 10px; width: 130px;">STAGE / VENUE</th>
                    </tr>
                </thead>
                <tbody style="font-size: 11px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>

            <!-- Judge Acceptance & Sign-off Block -->
            <div style="margin-top: 40px; display: flex; justify-content: space-between; padding-top: 15px; border-top: 1px dashed #CBD5E1;">
                <div style="text-align: center; width: 200px;">
                    <div style="height: 35px;"></div>
                    <div style="border-top: 1px solid #94A3B8; padding-top: 4px; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase;">Judge Signature</div>
                </div>
                <div style="text-align: center; width: 200px;">
                    <div style="height: 35px;"></div>
                    <div style="border-top: 1px solid #94A3B8; padding-top: 4px; font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase;">Chief Controller</div>
                </div>
            </div>

            ${footerHtml}
        </div>
    `;

    try {
        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'portrait',
                filename: typeof getFestFileName === 'function' ? getFestFileName(`Judge_Schedule_${judge.username}`, 'pdf') : `Judge_Schedule_${judge.username}.pdf`,
                width: 800
            });
            showToast('Judge Schedule PDF Exported!');
        } else {
            const opt = { 
                margin: 10, 
                filename: typeof getFestFileName === 'function' ? getFestFileName(`Judge_Schedule_${judge.username}`, 'pdf') : `Judge_Schedule_${judge.username}.pdf`, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('Judge Schedule PDF Exported!');
        }
    } catch(err) {
        showToast('Error exporting PDF: ' + err.message, 'error');
    }
}

async function exportJudgesPDF() {
    if (globalJudgesList.length === 0) return showToast('No judges found to export.', 'error');
    showToast('Generating Judge Roster PDF...', 'success');
    
    const activeFid = typeof getActiveFestId === 'function' ? getActiveFestId() : (typeof festosAuth !== 'undefined' ? festosAuth.getCurrentFestId() : null);
    const val = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : (await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle()).data?.value;
    const masterSchedule = val || {};

    const headerHtml = (typeof window.festosGetPDFHeaderHTML === 'function')
        ? window.festosGetPDFHeaderHTML('MASTER JUDGE & ALLOCATION ROSTER', activeFid, {
            badge: `${globalJudgesList.length} JUDGES REGISTERED`,
            subtitle: 'OFFICIAL ACCREDITED JURY ROSTER'
        })
        : getManagerPDFHeaderHTML('Master Judge & Allocation Roster');

    const footerHtml = (typeof window.festosGetPDFFooterHTML === 'function')
        ? window.festosGetPDFFooterHTML(null, null, 'Official Master Jury Registry')
        : '<div style="margin-top:20px; font-size:10px; color:#64748B;">FestOS Verified Document</div>';

    let judgeBlocksHtml = '';
    globalJudgesList.forEach((judge, index) => {
        let tableRows = '';
        
        if (judge.assignments.length === 0) {
            tableRows = `<tr><td colspan="5" style="padding: 14px; text-align: center; color: #64748B; font-weight: 600;">No events currently assigned to this judge.</td></tr>`;
        } else {
            const scheduledAssignments = judge.assignments.map(comp => {
                const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
                return { ...comp, sched };
            });

            scheduledAssignments.sort((a, b) => {
                if (a.sched.date !== b.sched.date) return (a.sched.date || '').localeCompare(b.sched.date || '');
                return (a.sched.time || '').localeCompare(b.sched.time || '');
            });

            tableRows = scheduledAssignments.map((comp, i) => {
                const bg = (i % 2 === 1) ? '#F8FAFC' : '#FFFFFF';
                const timeStr = comp.sched.date !== 'TBD' 
                    ? `<span style="font-weight: 700; color: #0F172A;">${comp.sched.date}</span> &bull; <span style="color: #64748B; font-size: 10px;">${comp.sched.time}</span>` 
                    : `<span style="color: #D97706; font-weight: 600;">Unscheduled</span>`;

                return `
                <tr style="height: 28px; page-break-inside: avoid; break-inside: avoid;">
                    <td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align: center; font-size: 10.5px; font-weight: 600; color: #64748B; background: ${bg}; width: 35px;">${i + 1}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #E2E8F0; font-size: 10.5px; background: ${bg}; width: 140px;">${timeStr}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; font-size: 11px; background: ${bg};">${comp.name}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #E2E8F0; background: ${bg}; width: 110px;">
                        <span style="background: #EFF6FF; color: #2563EB; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; display: inline-block;">${comp.categories?.name || 'General'}</span>
                    </td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4F46E5; font-size: 10.5px; background: ${bg}; width: 120px;">${comp.stages?.name || 'Unassigned'}</td>
                </tr>
            `}).join('');
        }

        judgeBlocksHtml += `
            <div class="pdf-avoid-break" style="margin-bottom: 22px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden; background: white;">
                <div style="background: #0F172A; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">
                        JUDGE: ${judge.username}
                    </h3>
                    <span style="font-size: 10px; color: #38BDF8; font-weight: 700;">${judge.assignments.length} ASSIGNMENTS</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; background: white;">
                    <thead>
                        <tr style="background: #F1F5F9; text-align: left; font-size: 10px; color: #475569; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #CBD5E1;">
                            <th style="padding: 6px 8px; text-align: center; width: 35px;">#</th>
                            <th style="padding: 6px 10px; width: 140px;">DATE & TIME</th>
                            <th style="padding: 6px 10px;">COMPETITION NAME</th>
                            <th style="padding: 6px 10px; width: 110px;">CATEGORY</th>
                            <th style="padding: 6px 10px; width: 120px;">STAGE</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 11px; color: #334155;">
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    });

    const contentHtml = `
        <div style="padding: 24px 28px; width: 100%; box-sizing: border-box; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}
            ${judgeBlocksHtml}
            ${footerHtml}
        </div>
    `;

    try {
        if (typeof window.festosRenderPDF === 'function') {
            await window.festosRenderPDF(contentHtml, {
                orientation: 'portrait',
                filename: typeof getFestFileName === 'function' ? getFestFileName('Judge_Allocation_Roster', 'pdf') : 'Fest_Judge_Roster.pdf',
                width: 800
            });
            showToast('Roster PDF Exported Successfully!');
        } else {
            const opt = { 
                margin: 10, 
                filename: typeof getFestFileName === 'function' ? getFestFileName('Master_Judge_Roster', 'pdf') : `Fest_Master_Judge_Roster.pdf`, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };
            const wrap = document.createElement('div');
            wrap.innerHTML = contentHtml;
            await html2pdf().set(opt).from(wrap).save();
            showToast('Roster PDF Exported!');
        }
    } catch(err) {
        showToast('Error exporting PDF: ' + err.message, 'error');
    }
}

// =========================================================================
// 3-STEP COLLAPSIBLE SIDEBAR ENGINE (MANAGER)
// Step 0: Expanded -> Step 1: Compact (Buttons Only) -> Step 2: Hidden -> Step 0
// =========================================================================
function toggleManagerSidebar() {
    if (window.innerWidth > 768) {
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
            localStorage.setItem('festos_manager_sidebar_state', nextState);
        } catch (e) {}
        updateManagerSidebarTooltip(nextState);
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    }
}

function updateManagerSidebarTooltip(state) {
    const btn = document.getElementById('managerSidebarToggle') || document.querySelector('.sidebar-toggle-btn');
    if (!btn) return;
    if (state === 'compact') {
        btn.title = 'Sidebar: Buttons Only (Click to Hide) - Ctrl+B';
    } else if (state === 'hidden') {
        btn.title = 'Sidebar: Hidden (Click to Expand) - Ctrl+B';
    } else {
        btn.title = 'Sidebar: Expanded (Click for Buttons Only) - Ctrl+B';
    }
}

// Restore Manager desktop 3-step state on load
try {
    if (window.innerWidth > 768) {
        const savedState = localStorage.getItem('festos_manager_sidebar_state');
        if (savedState === 'compact') {
            document.body.classList.add('sidebar-compact');
            updateManagerSidebarTooltip('compact');
        } else if (savedState === 'hidden' || savedState === 'true' || localStorage.getItem('festos_manager_sidebar_collapsed') === 'true') {
            document.body.classList.add('sidebar-hidden');
            updateManagerSidebarTooltip('hidden');
        } else {
            updateManagerSidebarTooltip('expanded');
        }
    }
} catch (e) {}

// Ctrl+B shortcut for desktop sidebar collapse
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        toggleManagerSidebar();
    }
});


// =========================================================================
// OFFSTAGE VALUATION MANAGEMENT ENGINE
// =========================================================================
let allValuationComps = [];

async function updateValuationBadgeCount() {
    try {
        let q = window.db.from('competitions')
            .select('id, is_offstage, status, stages(name)')
            .eq('status', 'valuation');
        if (window.festosApplyFilter) q = window.festosApplyFilter(q);
        const { data: valComps } = await q;
        
        const offstageValComps = (valComps || []).filter(c => {
            if (c.is_offstage) return true;
            if (c.stages?.name && c.stages.name.toUpperCase().includes('OFFSTAGE')) return true;
            return false;
        });
        
        const badge = document.getElementById('valuation-counter');
        if (badge) {
            const num = offstageValComps.length;
            if (num > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = num;
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn('Valuation counter notice:', e);
    }
}

async function loadValuations() {
    const grid = document.getElementById('valuation-grid');
    if (!grid) return;
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading offstage valuations...</p></div>`;

    try {
        if (availableJudges.length === 0) {
            let judgesQuery = supabaseClient.from('users').select('id, username, role');
            if (window.festosApplyFilter) judgesQuery = window.festosApplyFilter(judgesQuery);
            const { data: allUsers } = await judgesQuery;
            availableJudges = (allUsers || []).filter(u => u.role === 'judge' || (typeof festosMultiRole !== 'undefined' && festosMultiRole.hasRole(u, 'judge')));
        }

        // Fetch competitions in status 'valuation'
        let q = window.db.from('competitions')
            .select('*, categories(name), stages(name, stage_no)')
            .eq('status', 'valuation');
        if (window.festosApplyFilter) q = window.festosApplyFilter(q);
        const { data: comps, error } = await q.order('name');

        if (error) throw error;

        // Fetch assignments
        let assignQuery = supabaseClient.from('judgements').select('competition_id, judge_id, users(username)').is('awarded_mark', null);
        if (window.festosApplyFilter) assignQuery = window.festosApplyFilter(assignQuery);
        const { data: assignments } = await assignQuery;
        allAssignments = assignments || [];

        // Filter strictly for offstage competitions
        allValuationComps = (comps || []).filter(c => {
            if (c.is_offstage) return true;
            if (c.stages?.name && c.stages.name.toUpperCase().includes('OFFSTAGE')) return true;
            return false;
        });

        updateValuationBadgeCount();
        filterValuations();
    } catch (err) {
        console.error('Error loading valuations:', err);
        showToast('Error loading valuations: ' + err.message, 'error');
    }
}

function filterValuations() {
    const search = (document.getElementById('searchValuation')?.value || '').trim().toLowerCase();
    const grid = document.getElementById('valuation-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = allValuationComps.filter(c => 
        (c.name || '').toLowerCase().includes(search) || 
        (c.categories?.name || '').toLowerCase().includes(search) ||
        (c.stages?.name || '').toLowerCase().includes(search)
    );

    const banner = document.getElementById('valuation-alert-banner');
    const alertText = document.getElementById('valuation-alert-text');
    
    // Count unassigned competitions
    const unassignedComps = filtered.filter(comp => {
        const compAssignments = allAssignments.filter(a => a.competition_id === comp.id);
        return compAssignments.length === 0;
    });

    if (banner) {
        if (unassignedComps.length > 0) {
            banner.style.display = 'flex';
            if (alertText) {
                alertText.innerHTML = `<strong>${unassignedComps.length} offstage competition(s)</strong> are in valuation without any assigned judge. Please assign judges below so valuation can proceed.`;
            }
        } else {
            banner.style.display = 'none';
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-clipboard-text" style="font-size:2.5rem; margin-bottom:1rem; color: #CBD5E1;"></i><p style="font-weight: 600;">No offstage competitions currently in valuation.</p></div>`;
        return;
    }

    let judgeOptions = availableJudges.map(j => `<option value="${j.id}">${j.username}</option>`).join('');

    filtered.forEach(comp => {
        const compAssignments = allAssignments.filter(a => a.competition_id === comp.id);
        const hasJudges = compAssignments.length > 0;
        const compStage = comp.stages ? `${comp.stages.name}` : 'Offstage Venue';

        // Build valuation judge options with assigned indicators
        const valAssignedJudgeIds = new Set(compAssignments.map(a => a.judge_id));
        const compValJudgeOptions = availableJudges.map(j => {
            const isAssigned = valAssignedJudgeIds.has(j.id);
            return `<option value="${j.id}" ${isAssigned ? 'disabled style="color: #94A3B8;"' : ''}>${j.username}${isAssigned ? ' (Assigned)' : ''}</option>`;
        }).join('');

        let judgeSectionHtml = '';
        if (!hasJudges) {
            judgeSectionHtml = `
                <div style="background: #FEF2F2; border: 1.5px dashed #F87171; border-radius: 12px; padding: 1rem; margin-top: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #DC2626; font-weight: 800; font-size: 0.88rem; margin-bottom: 0.35rem;">
                        <i class="ph-bold ph-warning-octagon" style="font-size: 1.25rem;"></i>
                        <span>JUDGE NOT ASSIGNED</span>
                    </div>
                    <p style="color: #991B1B; font-size: 0.85rem; margin: 0 0 0.85rem 0; line-height: 1.4; font-weight: 500;">
                        This offstage event has ended and is in valuation. <strong>Please assign a judge to valuate this competition and award marks.</strong>
                    </p>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <div class="judge-select-wrapper" style="flex: 1; min-width: 180px;">
                            <i class="ph ph-scales judge-select-icon"></i>
                            <select id="val-judge-select-${comp.id}" class="judge-assign-select" style="min-height: 42px; height: 42px;">
                                <option value="">-- Choose Judge to Valuate --</option>
                                ${compValJudgeOptions}
                            </select>
                            <i class="ph ph-caret-down judge-select-arrow"></i>
                        </div>
                        <button class="btn btn-primary" onclick="assignJudgeForValuation('${comp.id}', this)" style="min-height: 42px; height: 42px; white-space: nowrap; font-weight: 700; padding: 0 1.25rem;">
                            <i class="ph-bold ph-scales"></i> Assign Judge
                        </button>
                    </div>
                </div>
            `;
        } else {
            const judgeTags = compAssignments.map(a => `
                <span class="judge-tag" style="background: white; border: 1.5px solid #10B981; font-weight: 600; color: #065F46;">
                    <i class="ph-bold ph-user-check" style="color: #10B981;"></i> ${a.users?.username}
                    <button onclick="revokeJudgeFromValuation('${comp.id}', '${a.judge_id}', this)" title="Revoke ${a.users?.username}">
                        <i class="ph ph-x"></i>
                    </button>
                </span>
            `).join('');

            judgeSectionHtml = `
                <div style="background: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 12px; padding: 1rem; margin-top: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: #166534;"><i class="ph-bold ph-scales"></i> Assigned Valuating Judge(s):</span>
                        <span style="font-size: 0.75rem; background: #DCFCE7; color: #15803D; font-weight: 700; padding: 3px 10px; border-radius: 50px; border: 1px solid #86EFAC;">Awaiting Marks in Judge Portal</span>
                    </div>
                    <div class="judge-tags-container" style="margin-bottom: 0.75rem;">
                        ${judgeTags}
                    </div>
                    <div style="display: flex; gap: 0.5rem; border-top: 1px dashed #86EFAC; padding-top: 0.75rem; align-items: center; flex-wrap: wrap;">
                        <div class="judge-select-wrapper" style="flex: 1; min-width: 180px;">
                            <i class="ph ph-scales judge-select-icon"></i>
                            <select id="val-judge-select-${comp.id}" class="judge-assign-select" style="min-height: 38px; height: 38px; font-size: 0.85rem;">
                                <option value="">Assign Additional Judge...</option>
                                ${compValJudgeOptions}
                            </select>
                            <i class="ph ph-caret-down judge-select-arrow"></i>
                        </div>
                        <button class="btn btn-outline" onclick="assignJudgeForValuation('${comp.id}', this)" style="min-height: 38px; height: 38px; padding: 0 1rem; font-size: 0.85rem; white-space: nowrap; font-weight: 600;">
                            <i class="ph ph-plus"></i> Add
                        </button>
                    </div>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = hasJudges ? 'rgba(16, 185, 129, 0.4)' : '#FCA5A5';
        card.style.boxShadow = hasJudges ? 'var(--shadow-sm)' : '0 4px 14px rgba(239, 68, 68, 0.08)';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${comp.name}</div>
                <span class="badge badge-valuation" style="background: #FEF3C7; color: #B45309; border: 1.5px solid #FDE68A; font-weight: 800;">
                    <i class="ph-bold ph-pen-nib"></i> IN VALUATION
                </span>
            </div>
            
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem; margin-bottom: 0.5rem;">
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.25rem 0.65rem; border-radius: 6px;">
                    <i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}
                </span>
                <span style="font-size: 0.8rem; font-weight: 700; color: #7C3AED; background: #F5F3FF; padding: 0.25rem 0.65rem; border-radius: 6px;">
                    <i class="ph ph-map-pin"></i> ${compStage}
                </span>
                <span style="font-size: 0.8rem; font-weight: 700; color: #0284C7; background: #E0F2FE; padding: 0.25rem 0.65rem; border-radius: 6px;">
                    <i class="ph ph-layer-group"></i> Offstage Competition
                </span>
            </div>

            ${judgeSectionHtml}
        `;
        grid.appendChild(card);
    });
}

async function assignJudgeForValuation(compId, btnElement) {
    const select = document.getElementById(`val-judge-select-${compId}`);
    const judgeId = select ? select.value : null;
    if (!judgeId) return showToast('Please select a judge to valuate this competition.', 'error');

    const isAlreadyAssigned = allAssignments.some(a => a.competition_id === compId && a.judge_id === judgeId);
    if (isAlreadyAssigned) return showToast('This judge is already assigned to this competition!', 'error');

    btnElement.disabled = true;
    const origHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Assigning...';

    const insertRecord = window.festosWithFest ? window.festosWithFest([{ competition_id: compId, judge_id: judgeId }]) : [{ competition_id: compId, judge_id: judgeId }];
    const { error } = await window.db.from('judgements').insert(insertRecord);

    if (error) {
        showToast("Error assigning judge: " + error.message, 'error');
        btnElement.disabled = false;
        btnElement.innerHTML = origHtml;
    } else {
        showToast("Judge successfully assigned to valuate competition!");
        loadValuations();
        updateValuationBadgeCount();
        if (typeof loadAssignments === 'function') loadAssignments();
    }
}

async function revokeJudgeFromValuation(compId, judgeId, btnElement) {
    btnElement.disabled = true;
    const { error } = await window.db.from('judgements')
        .delete()
        .eq('competition_id', compId)
        .eq('judge_id', judgeId)
        .is('awarded_mark', null);

    if (error) {
        showToast("Error revoking judge: " + error.message, 'error');
    } else {
        showToast("Judge assignment removed.");
        loadValuations();
        updateValuationBadgeCount();
        if (typeof loadAssignments === 'function') loadAssignments();
    }
}

// Hook into loadAssignments to keep valuation badge updated
const _origLoadAssignments = loadAssignments;
loadAssignments = async function() {
    await _origLoadAssignments();
    updateValuationBadgeCount();
};
