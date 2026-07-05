const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth & Role Check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || user.role !== 'team_manager') {
    window.location.href = 'index.html';
}

// Global State
let myTeamId = user.team_id; 
let isAssignmentLocked = false;
let globalStudents = [];
let globalComps = [];
let globalAssignments = [];

// UI Utils
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.mobile-overlay').classList.toggle('open');
}

function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if(activeNav) activeNav.classList.add('active');

    if(window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.querySelector('.mobile-overlay').classList.remove('open');
    }
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// Data Fetching
async function initDashboard() {
    if(window.innerWidth > 768) {
        document.getElementById('desktop-subtitle').style.display = 'block';
    }

    try {
        const { data: teamData } = await supabaseClient.from('teams').select('name').eq('id', myTeamId).single();
        document.getElementById('team-name-title').innerText = teamData ? teamData.name : 'MY TEAM';

        const { data: settingsData } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();
        if (settingsData && settingsData.value) {
            isAssignmentLocked = settingsData.value.tm_access === false; 
        }

        if (isAssignmentLocked) {
            document.getElementById('lock-banner').style.display = 'flex';
            document.getElementById('btn-bulk-enroll').disabled = true;
            document.getElementById('btn-bulk-remove').disabled = true;
        }

        await fetchAllData();

    } catch (e) {
        console.error(e);
        showToast("Error loading dashboard data", "error");
    }
}

async function fetchAllData() {
    try {
        const { data: students } = await supabaseClient.from('participants').select('*').eq('team_id', myTeamId).order('name');
        globalStudents = students || [];

        // Fetches ALL columns, perfectly getting 'limit', 'is_group', etc.
        const { data: comps } = await supabaseClient.from('competitions').select('*, categories(name), stages(name)').order('name');
        globalComps = comps || [];

        const studentIds = globalStudents.map(s => s.id);
        if(studentIds.length > 0) {
            // Include 'is_leader' to track group leaders
            const { data: assigns } = await supabaseClient
                .from('participant_competitions')
                .select(`id, participant_id, competition_id, is_leader`)
                .in('participant_id', studentIds);
            globalAssignments = assigns || [];
        }

        updateDashboardStats();
        renderStudents();
        renderCatalog();
        renderLiveTracking();
        populateBulkAssignDropdown();

    } catch (e) {
        console.error(e);
    }
}

// ---------------- DASHBOARD ----------------
function updateDashboardStats() {
    document.getElementById('stat-total-students').innerText = globalStudents.length;
    document.getElementById('stat-total-assignments').innerText = globalAssignments.length;
    const completedComps = globalComps.filter(c => c.status === 'published' || c.status === 'judgement_complete');
    document.getElementById('stat-completed-events').innerText = completedComps.length;
}

// ---------------- STUDENT DIRECTORY ----------------
function renderStudents() {
    const search = document.getElementById('search-students').value.toLowerCase();
    const tbody = document.getElementById('students-tbody');
    tbody.innerHTML = '';

    globalStudents.forEach(student => {
        if (search && !student.name.toLowerCase().includes(search) && !student.unique_id.toLowerCase().includes(search)) return;

        const enrollCount = globalAssignments.filter(a => a.participant_id === student.id).length;
        const badgeClass = enrollCount > 0 ? 'badge-info' : 'badge-warning';
        
        tbody.innerHTML += `
            <tr>
                <td data-label="STUDENT NAME"></td>
                <td data-label="UNIQUE ID" style="font-family: monospace;">${student.unique_id}</td>
                <td data-label="BATCH">BATCH ${student.batch_no || 'N/A'}</td>
                <td data-label="EVENTS ENROLLED">
                    <span class="badge ${badgeClass}" onclick="viewStudentEvents('${student.id}')">${enrollCount} EVENTS <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
                </td>
            </tr>
        `;
        tbody.lastElementChild.firstElementChild.innerText = student.name;
    });
}

function viewStudentEvents(studentId) {
    const student = globalStudents.find(s => s.id === studentId);
    const assignedComps = globalAssignments.filter(a => a.participant_id === studentId).map(a => a.competition_id);
    
    document.getElementById('se-modal-title').innerText = `${student.name}'S EVENTS`;
    const body = document.getElementById('se-modal-body');
    body.innerHTML = '';
    
    if (assignedComps.length === 0) {
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center;">NOT ENROLLED IN ANY EVENTS.</p>`;
    } else {
        assignedComps.forEach(compId => {
            const comp = globalComps.find(c => c.id === compId);
            if (comp) {
                body.innerHTML += `
                    <div style="padding: 1rem; background: #F8FAFC; border-radius: 8px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${comp.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${comp.categories?.name || 'EVENT'}</div>
                        </div>
                        <span class="badge badge-gray" style="text-transform: uppercase;">${comp.status.replace('_', ' ')}</span>
                    </div>
                `;
            }
        });
    }
    document.getElementById('studentEventsModal').classList.add('show');
}

// ---------------- EVENT CATALOG ----------------
function renderCatalog() {
    const search = document.getElementById('search-catalog').value.toLowerCase();
    const typeFilter = document.getElementById('filter-catalog-type').value;
    const tbody = document.getElementById('catalog-tbody');
    tbody.innerHTML = '';

    globalComps.forEach(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        
        if (typeFilter === 'group' && !comp.is_group) return;
        if (typeFilter === 'individual' && comp.is_group) return;
        if (search && !comp.name.toLowerCase().includes(search) && !catName.toLowerCase().includes(search)) return;

        const stageName = comp.stages?.name || 'TBD';
        
        // Correct Limit Display from actual Admin Database Limits
        const limitDisplay = comp.limit ? comp.limit : 'NO LIMIT';
        
        const typeBadge = comp.is_group 
            ? `<span class="badge" style="background:#e0e7ff; color:#4338ca;"><i class="fa-solid fa-users"></i> GROUP (LIMIT: ${limitDisplay})</span>`
            : `<span class="badge" style="background:#d1fae5; color:#059669;"><i class="fa-solid fa-user"></i> SOLO (LIMIT: ${limitDisplay})</span>`;

        tbody.innerHTML += `
            <tr>
                <td data-label="EVENT NAME"></td>
                <td data-label="CATEGORY">${catName}</td>
                <td data-label="STAGE">${stageName}</td>
                <td data-label="TYPE & LIMIT">${typeBadge}</td>
            </tr>
        `;
        tbody.lastElementChild.firstElementChild.innerText = comp.name;
    });
}

// ---------------- LIVE TRACKING & ENROLLED POPUP ----------------
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

        const stageName = comp.stages?.name || 'TBD';
        
        let statusBadge = `<span class="badge badge-info">UPCOMING</span>`;
        if(comp.status === 'ongoing' || comp.status === 'registration') statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-satellite-dish fa-fade"></i> LIVE</span>`;
        if(comp.status === 'published' || comp.status === 'judgement_complete') statusBadge = `<span class="badge badge-success">COMPLETED</span>`;

        // Clickable badge to see who is enrolled vs who is pending
        tbody.innerHTML += `
            <tr>
                <td data-label="EVENT NAME"></td>
                <td data-label="STAGE"><i class="fa-solid fa-microphone-stage" style="color:var(--text-muted); margin-right:4px;"></i> ${stageName}</td>
                <td data-label="STATUS">${statusBadge}</td>
                <td data-label="OUR ENROLLED">
                    <span class="badge badge-info" onclick="viewEnrolledDetails('${comp.id}')" style="cursor: pointer;">
                        ${ourEnrolled} ENROLLED <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </span>
                </td>
            </tr>
        `;
        tbody.lastElementChild.firstElementChild.innerText = comp.name;
    });
}

function viewEnrolledDetails(compId) {
    const comp = globalComps.find(c => c.id === compId);
    const enrolledIds = globalAssignments.filter(a => a.competition_id === compId).map(a => a.participant_id);

    let enrolledHtml = '';
    let pendingHtml = '';

    globalStudents.forEach(s => {
        if(enrolledIds.includes(s.id)) {
            enrolledHtml += `<div style="padding: 0.75rem; background: #d1fae5; color: #059669; border-radius: 8px; margin-bottom: 0.5rem; font-weight: 600;">${s.name} (${s.unique_id})</div>`;
        } else {
            pendingHtml += `<div style="padding: 0.75rem; background: #f1f5f9; color: #475569; border-radius: 8px; margin-bottom: 0.5rem; font-weight: 600;">${s.name} (${s.unique_id})</div>`;
        }
    });

    if(!enrolledHtml) enrolledHtml = '<p style="color: var(--text-muted);">NO STUDENTS ENROLLED</p>';
    if(!pendingHtml) pendingHtml = '<p style="color: var(--text-muted);">NO PENDING STUDENTS</p>';

    document.getElementById('enroll-modal-title').innerText = comp.name;
    document.getElementById('enroll-modal-enrolled').innerHTML = enrolledHtml;
    document.getElementById('enroll-modal-pending').innerHTML = pendingHtml;
    document.getElementById('enrollmentDetailsModal').classList.add('show');
}

// ---------------- BULK ASSIGNMENTS ----------------
function populateBulkAssignDropdown() {
    const select = document.getElementById('bulkAssignComp');
    select.innerHTML = '<option value="">-- CHOOSE A COMPETITION --</option>';
    
    globalComps.filter(c => c.status === 'pending').forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.categories?.name || 'GENERAL'})</option>`;
    });
}

function renderBulkAssignmentTable() {
    const compId = document.getElementById('bulkAssignComp').value;
    const wrapper = document.getElementById('bulk-table-wrapper');
    const tbody = document.getElementById('bulk-assignments-tbody');
    const leaderTh = document.getElementById('th-leader');
    
    if (!compId) {
        wrapper.style.display = 'none';
        return;
    }
    
    wrapper.style.display = 'block';
    tbody.innerHTML = '';

    const comp = globalComps.find(c => c.id === compId);
    
    // Shows correct limit fetched from database
    const limit = comp.limit ? comp.limit : 'NO LIMIT';
    const currentEnrolled = globalAssignments.filter(a => a.competition_id === compId).length;
    
    document.getElementById('bulk-comp-info').innerHTML = `
        <span style="color:var(--primary);"><i class="fa-solid fa-users"></i> ENROLLED: ${currentEnrolled} / ${limit}</span>
        <span style="color:var(--text-muted); font-size: 0.8rem; margin-left: 1rem;">${comp.is_group ? 'GROUP EVENT' : 'INDIVIDUAL EVENT'}</span>
    `;

    // Toggle Leader Column Visibility
    leaderTh.style.display = comp.is_group ? 'table-cell' : 'none';

    globalStudents.forEach(student => {
        const assignment = globalAssignments.find(a => a.participant_id === student.id && a.competition_id === compId);
        const isEnrolled = !!assignment;
        
        const statusBadge = isEnrolled 
            ? `<span class="badge badge-success"><i class="fa-solid fa-check"></i> ENROLLED</span>` 
            : `<span class="badge badge-gray">NOT ENROLLED</span>`;

        // Generate Leader Radio Button for Group Events
        const leaderRadio = comp.is_group 
            ? `<td data-label="GROUP LEADER" style="text-align:center;"><input type="radio" name="group_leader" class="leader-radio" value="${student.id}" ${assignment?.is_leader ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer;"></td>` 
            : '';

        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell">
                    <input type="checkbox" class="bulk-cb" value="${student.id}" data-assignment-id="${assignment ? assignment.id : ''}" ${isEnrolled ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                </td>
                <td data-label="STUDENT NAME"></td>
                <td data-label="UNIQUE ID" style="font-family: monospace;">${student.unique_id}</td>
                ${leaderRadio}
                <td data-label="STATUS">${statusBadge}</td>
            </tr>
        `;
        tbody.lastElementChild.children[1].innerText = student.name;
    });
}

function toggleSelectAllBulk(source) {
    const checkboxes = document.querySelectorAll('.bulk-cb');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

async function executeBulkAction(action) {
    if (isAssignmentLocked) return;

    const compId = document.getElementById('bulkAssignComp').value;
    if (!compId) return showToast("PLEASE SELECT A COMPETITION FIRST.", "error");

    const checkboxes = document.querySelectorAll('.bulk-cb:checked');
    if (checkboxes.length === 0) return showToast("PLEASE SELECT AT LEAST ONE STUDENT.", "error");

    const comp = globalComps.find(c => c.id === compId);
    const currentEnrolled = globalAssignments.filter(a => a.competition_id === compId).length;

    let payload = [];
    let deleteIds = [];

    // Get selected leader ID (if group event)
    const leaderId = document.querySelector('.leader-radio:checked')?.value;

    checkboxes.forEach(cb => {
        const pId = cb.value;
        const assignId = cb.getAttribute('data-assignment-id');
        const isLeader = (pId === leaderId);
        
        if (action === 'enroll') {
            if(assignId) {
                // Upsert to handle modifying an existing group leader
                payload.push({ id: assignId, participant_id: pId, competition_id: compId, is_leader: isLeader });
            } else {
                payload.push({ participant_id: pId, competition_id: compId, is_leader: isLeader });
            }
        } else if (action === 'remove' && assignId) {
            deleteIds.push(assignId);
        }
    });

    if (action === 'enroll') {
        const newEnrollments = payload.filter(p => !p.id).length; // Count only new ones for limit check
        if (comp.limit && (currentEnrolled + newEnrollments > comp.limit)) {
            return showToast(`LIMIT EXCEEDED! ONLY ${comp.limit - currentEnrolled} SLOTS LEFT.`, "error");
        }

        try {
            const { error } = await supabaseClient.from('participant_competitions').upsert(payload);
            if (error) throw error;
            showToast(`STUDENTS SUCCESSFULLY ENROLLED / UPDATED!`);
        } catch(e) { return showToast(e.message, 'error'); }

    } else if (action === 'remove') {
        if (deleteIds.length === 0) return showToast("SELECTED STUDENTS ARE NOT ENROLLED.", "warning");
        
        try {
            const { error } = await supabaseClient.from('participant_competitions').delete().in('id', deleteIds);
            if (error) throw error;
            showToast(`${deleteIds.length} STUDENTS REMOVED.`);
        } catch(e) { return showToast(e.message, 'error'); }
    }

    await fetchAllData();
    renderBulkAssignmentTable(); 
}

// ---------------- SCAN PORTAL POPUP ----------------
function openScanModal() {
    document.getElementById('scanIframe').src = 'scan.html';
    document.getElementById('scanModal').classList.add('show');
}

function closeScanModal() {
    // Setting src to blank properly kills the camera feed in the iframe
    document.getElementById('scanIframe').src = '';
    document.getElementById('scanModal').classList.remove('show');
}

document.addEventListener("DOMContentLoaded", () => {
    // Other init functions...
    fetchAndApplyBranding();
});

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
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = brandingData.fest_logo 
            ? `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px; margin-right: 8px;">` 
            : `<i class="fa-solid fa-bolt" style="margin-right: 8px;"></i>`;
        
        html += `<span>${brandingData.fest_name || 'FestOS'}</span>`;
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
    });
}

// Boot
document.addEventListener('DOMContentLoaded', initDashboard);