// --- DATABASE SETUP ---
// Initialize Supabase Client
const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.db = supabaseClient;

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || (user.role !== 'fest_manager' && user.role !== 'master_admin' && user.role !== 'admin')) {
    window.location.href = 'index.html';
}

// Inject Return Button for Admins
if (user.role === 'master_admin' || user.role === 'admin') {
    document.addEventListener("DOMContentLoaded", () => {
        const headerDiv = document.querySelector('.header > div');
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
        if (statusFilter === 'assigned') statusMatch = isAssigned;

        return compNameMatch && catMatch && stageMatch && statusMatch;
    });

    renderGrid(filteredComps);
}

async function loadAssignments() {
    const grid = document.getElementById('comps-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading records...</p></div>`;

    try {
        if (availableJudges.length === 0) {
            const { data: judges } = await supabaseClient.from('users').select('id, username').eq('role', 'judge');
            availableJudges = judges || [];
        }

        if (allStages.length === 0) {
            const { data: stages } = await supabaseClient.from('stages').select('id, name, stage_no').order('stage_no');
            allStages = stages || [];
        }

        // 1. Fetch Competitions, grabbing the stage_no alongside the name
        const { data: comps } = await supabaseClient.from('competitions')
            .select('*, categories(name), stages(name, stage_no)') 
            .in('status', ['pending', 'registration', 'ongoing']);
            
        // 2. Fetch Master Schedule
        const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
        const masterSchedule = schedData?.value || {};
        
        // 3. Fetch Visibility Offset Setting
        const { data: pointData } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();
        const announcerOffset = pointData?.value?.announcer_offset !== undefined ? parseInt(pointData.value.announcer_offset) : 30;

        const now = new Date();
        
        // 4. Filter Competitions based on Status and Schedule (Applying the Offset limit)
        let activeComps = (comps || []).filter(comp => {
            if (comp.status !== 'pending') return true; 
            const sched = masterSchedule[comp.id];
            if (!sched || sched.status !== 'published') return false; 
            
            const schedDate = new Date(`${sched.date}T${sched.time}`);
            if (isNaN(schedDate)) return true;
            
            const diffMins = (schedDate - now) / 60000;
            return diffMins <= announcerOffset;
        });

        // 5. Chronological Sorting (Order by Time)
        activeComps.sort((a, b) => {
            const schedA = masterSchedule[a.id];
            const schedB = masterSchedule[b.id];
            const timeA = schedA && schedA.date && schedA.time ? new Date(`${schedA.date}T${schedA.time}`).getTime() : Infinity;
            const timeB = schedB && schedB.date && schedB.time ? new Date(`${schedB.date}T${schedB.time}`).getTime() : Infinity;
            return timeA - timeB;
        });

        // Attach schedule to object for rendering
        activeComps.forEach(c => c.schedule = masterSchedule[c.id]);
        allCompetitions = activeComps;

        // 6. Fetch Assignments
        const { data: assignments } = await supabaseClient.from('judgements').select('competition_id, judge_id, users(username)').is('awarded_mark', null);
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
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-magnifying-glass" style="font-size:2rem; margin-bottom:1rem;"></i><p>No active/upcoming competitions match your filters.</p></div>`;
        return;
    }

    // Reset and show Select All when rendering new data
    if (selectAllContainer) {
        selectAllContainer.style.display = 'flex';
        selectAllCheckbox.checked = false; 
    }

    let judgeOptions = availableJudges.map(j => `<option value="${j.id}">${j.username}</option>`).join('');

    competitions.forEach(comp => {
        const compAssignments = allAssignments.filter(a => a.competition_id === comp.id);
        const badgeClass = comp.status === 'pending' ? 'badge-pending' : 'badge-ongoing';
        
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
        if (comp.schedule) {
            const timeObj = new Date(`${comp.schedule.date}T${comp.schedule.time}`);
            const timeStr = isNaN(timeObj) ? comp.schedule.time : timeObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            schedBadge = `<div class="card-meta" style="color: var(--primary); font-weight: 700; margin-bottom: 1rem;"><i class="ph ph-clock"></i> ${comp.schedule.date} @ ${timeStr}</div>`;
        }

        grid.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                        <input type="checkbox" class="comp-checkbox" value="${comp.id}" onchange="toggleBulkActions()" style="width: 18px; height: 18px; cursor: pointer; margin-top: 3px;">
                        <div class="card-title">${comp.name}</div>
                    </div>
                    <span class="badge ${badgeClass}">${comp.status}</span>
                </div>
                
                <div class="card-meta" style="margin-bottom: 0.25rem;"><i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}</div>
                <div class="card-meta" style="margin-bottom: ${schedBadge ? '0.25rem' : '1rem'};"><i class="ph ph-microphone-stage"></i> ${compStage}</div>
                ${schedBadge}
                
                <div class="assigned-judges">
                    <strong>Assigned Judges:</strong><br>
                    ${assignedJudgesHTML}
                </div>
                
                <div class="form-group">
                    <select id="judge-select-${comp.id}"><option value="">Select a Judge...</option>${judgeOptions}</select>
                    <button class="btn btn-primary" style="width: 100%;" onclick="assignJudge('${comp.id}', this)"><i class="ph ph-user-plus"></i> Assign Judge</button>
                </div>
            </div>
        `;
    });
}

async function assignJudge(compId, btnElement) {
    const judgeId = document.getElementById(`judge-select-${compId}`).value;
    if (!judgeId) return showToast('Please select a judge.', 'error');

    // Prevent duplicate assignments
    const isAlreadyAssigned = allAssignments.some(a => a.competition_id === compId && a.judge_id === judgeId);
    if (isAlreadyAssigned) return showToast('This judge is already assigned to this competition!', 'error');

    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Assigning...';

    const { error } = await window.db.from('judgements').insert([{ competition_id: compId, judge_id: judgeId }]);

    if (error) {
        showToast("Error: " + error.message, 'error');
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="ph ph-user-plus"></i> Assign Judge';
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
        const compStage = comp.stage || 'Unstaged';
        
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
    link.download = `Fest_Assignments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast("CSV Downloaded!");
}

// 2. Export Current View to PDF
function exportToPDF() {
    showToast("Generating PDF...");
    const container = document.getElementById('pdf-export-container');
    
    // Build a clean, professional HTML table for the PDF
    let htmlStr = `
        <h2 style="color: #4F46E5; margin-bottom: 5px;">FestOS Manager Report</h2>
        <p style="color: #6B7280; margin-bottom: 20px;">Generated on: ${new Date().toLocaleDateString()}</p>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <tr style="background-color: #F3F4F6; border-bottom: 2px solid #E5E7EB;">
                <th style="padding: 12px; font-weight: bold;">Competition</th>
                <th style="padding: 12px; font-weight: bold;">Category</th>
                <th style="padding: 12px; font-weight: bold;">Judges</th>
            </tr>
    `;

    // Fetch the raw data currently visible on screen via grid
    const cards = document.querySelectorAll('#comps-grid .card');
    cards.forEach(card => {
        const title = card.querySelector('.card-title').innerText;
        const cat = card.querySelector('.card-meta').innerText;
        let judges = card.querySelector('.assigned-judges span').innerText;
        if(judges === 'No judges assigned yet') judges = '<span style="color:red">Unassigned</span>';

        htmlStr += `
            <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 12px; font-weight: 500;">${title}</td>
                <td style="padding: 12px; color: #4B5563;">${cat}</td>
                <td style="padding: 12px; color: #4B5563;">${judges}</td>
            </tr>
        `;
    });
    
    htmlStr += `</table>`;
    container.innerHTML = htmlStr;
    container.style.display = 'block';

    // Options for html2pdf
    const opt = {
        margin: 0.5,
        filename: `Fest_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container).save().then(() => {
        container.style.display = 'none';
        container.innerHTML = '';
        showToast("PDF Downloaded!");
    });
}

async function loadPublishableComps() {
    const grid = document.getElementById('publish-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i></div>`;

    const { data: comps } = await window.db.from('competitions').select('*, categories(name)').eq('status', 'judgement_complete').order('name');
    grid.innerHTML = '';

    if (!comps || comps.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><i class="ph ph-check-circle" style="color: var(--success); font-size:2rem; margin-bottom:1rem;"></i><p>All caught up!</p></div>`;
        return;
    }

    comps.forEach(comp => {
        grid.innerHTML += `
            <div class="card" style="border: 1px solid var(--success);">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge badge-ready">Ready</span>
                </div>
                <div class="card-meta" style="margin-bottom: 1.5rem;"><i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}</div>
                // Inside loadPublishableComps() in manager.js
<div style="display: flex; gap: 0.5rem; width: 100%; flex-wrap: wrap;">
    <button class="btn btn-outline" style="flex: 1; min-width: 100px;" onclick="previewConvertedPoints('${comp.id}', ${comp.max_mark || 100}, ${comp.categories?.is_general || false})">
        <i class="ph ph-eye"></i> Preview
    </button>
    <button class="btn btn-outline" style="flex: 1; min-width: 100px;" onclick="redoJudgement('${comp.id}', this)">
        <i class="ph ph-arrow-u-up-left"></i> Redo
    </button>
    <button class="btn btn-success" style="flex: 2; min-width: 140px;" onclick="publishCompetition('${comp.id}', this)">
        <i class="ph ph-megaphone-simple"></i> Publish Live
    </button>
</div>
            </div>
        `;
    });
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

async function loadPublishedResults() {
    const grid = document.getElementById('published-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading live results...</p></div>`;

    const { data: comps, error } = await window.db
        .from('competitions')
        .select('*, categories(name)')
        .eq('status', 'published')
        .order('name');

    if (error) {
        showToast("Error loading published results.", "error");
        return;
    }

    grid.innerHTML = '';

    if (!comps || comps.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-globe" style="font-size:2rem; margin-bottom:1rem;"></i><p>No results are currently published live.</p></div>`;
        return;
    }

    comps.forEach(comp => {
        grid.innerHTML += `
            <div class="card" style="border: 1px solid var(--primary);">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge" style="background: var(--primary-light); color: var(--primary);">Live</span>
                </div>
                <div class="card-meta" style="margin-bottom: 1.5rem;">
                    <i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}
                </div>
                
                <div style="display: flex; gap: 0.75rem; width: 100%; flex-wrap: wrap; margin-top: auto;">
    <button class="btn btn-outline" style="flex: 1; min-width: 100px;" onclick="previewConvertedPoints('${comp.id}', ${comp.max_mark || 100}, ${comp.categories?.is_general || false})">
        <i class="ph ph-eye"></i> View
    </button>
    <button class="btn btn-outline" style="flex: 1; min-width: 100px; color: var(--primary); border-color: var(--primary);" onclick="openEditPointsModal('${comp.id}')">
        <i class="ph ph-pencil-simple"></i> Edit
    </button>
    <button class="btn btn-outline" style="flex: 1; min-width: 100px; color: var(--danger); border-color: var(--danger);" onclick="revertPublishedResult('${comp.id}', this)">
        <i class="ph ph-arrow-u-up-left"></i> Revert
    </button>
</div>
            </div>
        `;
    });
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
        await window.db.from('competitions').update({ status: 'published' }).eq('id', compId);
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
        const insertPayload = Array.from(checkboxes).map(cb => ({
            competition_id: cb.value,
            judge_id: judgeId
        }));

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
            .update({ status: 'judgement_complete' }) 
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

let allPendingComps = [];
let allPublishedComps = [];

// Update your loadPublishableComps function to save to the global array:
async function loadPublishableComps() {
    const grid = document.getElementById('publish-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1;"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i></div>`;

    const { data: comps } = await window.db.from('competitions').select('*, categories(name)').eq('status', 'judgement_complete').order('name');
    allPendingComps = comps || [];
    
    // Update the live count badge
    const { count } = await window.db.from('competitions').select('*', { count: 'exact', head: true }).eq('status', 'published');
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

    const { data: comps } = await window.db.from('competitions').select('*, categories(name)').eq('status', 'published').order('name');
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
        const { data, error } = await supabaseClient
            .from('settings')
            .select('value')
            .eq('id', 'system_branding')
            .maybeSingle();

        if (error) throw error;
        if (data && data.value) applyGlobalBranding(data.value);
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
    const displayMode = brandingData.display_mode || 'both'; 
    
    const festName = validName ? brandingData.fest_name : 'FestOS';
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
        const { data: allComps, error } = await window.db
            .from('competitions')
            .select('id, name, status, categories(name)')
            .order('name');

        if (error) throw error;

        // Calculate statistics based on statuses
        const total = allComps.length;
        const published = allComps.filter(c => c.status === 'published').length;
        const pendingPublish = allComps.filter(c => c.status === 'judgement_complete').length;
        
        // Unfinished = Anything NOT in 'published' or 'judgement_complete' 
        const unfinishedComps = allComps.filter(c => c.status !== 'published' && c.status !== 'judgement_complete');
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

                listContainer.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-main); border-radius: var(--radius-md); border: 1px solid var(--border); transition: var(--transition);">
                        <div>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${comp.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}
                            </div>
                        </div>
                        <span class="badge" style="${badgeStyle} text-transform: uppercase; font-size: 0.7rem;">${comp.status.replace('_', ' ')}</span>
                    </div>
                `;
            });
        }
    } catch (err) {
        console.error("Error loading system stats:", err);
        listContainer.innerHTML = `<p style="color: var(--danger); text-align: center; font-weight: 600;">Failed to load data. Check console for details.</p>`;
    }
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
        const { data: judges, error: judgesErr } = await supabaseClient
            .from('users')
            .select('id, username')
            .eq('role', 'judge')
            .order('username');
        if (judgesErr) throw judgesErr;
        
        globalJudgesList = judges || [];

        const { data: assignments, error: assignErr } = await supabaseClient
            .from('judgements')
            .select('judge_id, competition_id, competitions(name, categories(name), stages(name))');
        if (assignErr) throw assignErr;

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
        const payload = { name, username, password_hash, role: 'judge' };
        if (id) payload.id = id;
        
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
        const { data: comps, error } = await supabaseClient
            .from('competitions')
            .select('id, name, categories(name)')
            .order('name');
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
            const inserts = modalAssignedIds.map(compId => ({ competition_id: compId, judge_id: judgeId }));
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
        const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
        const masterSchedule = schedData?.value || {};

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
                : `<span style="color: #D97706; font-weight: 600; font-size: 0.8rem;">Unscheduled</span>`;
            
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
    return `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 26px; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; font-weight: 800;">FestOS Manager</h1>
            <h2 style="color: #1F2937; font-size: 18px; margin-top: 0; text-transform: uppercase;">${title}</h2>
            <p style="color: #64748B; font-size: 12px; margin-top: 4px;">Generated on: ${new Date().toLocaleString()}</p>
        </div>
    `;
}

async function exportSpecificJudgePDF(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    showToast(`Generating PDF for ${judge.username}...`);
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getManagerPDFHeaderHTML(`Judge Schedule: ${judge.username}`);

    const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
    const masterSchedule = schedData?.value || {};

    let tableRows = '';
    if (judge.assignments.length === 0) {
        tableRows = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No events currently assigned.</td></tr>`;
    } else {
        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

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
        margin: 10, filename: `Judge_Schedule_${judge.username}.pdf`, image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    document.getElementById('pdf-export-container').innerHTML = ''; // Clean buffer
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
}

async function exportJudgesPDF() {
    if (globalJudgesList.length === 0) return showToast('No judges found to export.', 'error');
    showToast('Generating Judge Roster PDF...');
    
    const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
    const masterSchedule = schedData?.value || {};

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getManagerPDFHeaderHTML('Master Judge Roster');

    globalJudgesList.forEach((judge, index) => {
        let tableRows = '';
        if (judge.assignments.length === 0) {
            tableRows = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No events currently assigned.</td></tr>`;
        } else {
            const scheduledAssignments = judge.assignments.map(comp => {
                const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
                return { ...comp, sched };
            });

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
                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase;">JUDGE: ${judge.username}</h3>
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
        margin: 10, filename: `FestOS_Master_Judge_Roster.pdf`, image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    document.getElementById('pdf-export-container').innerHTML = ''; // Clean buffer
    html2pdf().set(opt).from(container).save().then(() => showToast('Roster PDF Exported!'));
}