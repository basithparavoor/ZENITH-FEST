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
let globalCategories = []; // <--- NEW: Stores category rules

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

// Modal & Loading Utils
function openModal(title, bodyHTML, saveFunction) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.onclick = saveFunction;
    saveBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Ticket';
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
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalText || 'Submit';
        btn.disabled = false;
    }
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

    // NEW: Trigger data fetch when the tab is clicked
    if (tabId === 'appeals') {
        loadAppeals();
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

// Data Fetching
async function refreshDashboard(btnElement) {
    if (btnElement) {
        const icon = btnElement.querySelector('i');
        if (icon) icon.classList.add('fa-spin'); // Add spinning animation to the icon
    }
    
    try {
        await fetchAllData();
        showToast('Dashboard Data Synced!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Failed to sync data.', 'error');
    } finally {
        if (btnElement) {
            const icon = btnElement.querySelector('i');
            if (icon) icon.classList.remove('fa-spin'); // Remove spinning animation
        }
    }
}

async function fetchAllData() {
    try {
        // 1. Fetch system settings to check for Registration Deadlines
        const { data: set_data } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();
        let systemSettings = set_data && set_data.value ? set_data.value : {};

        // 2. Fetch Core Data
        const { data: cats } = await supabaseClient.from('categories').select('*');
        globalCategories = cats || [];

        const { data: students } = await supabaseClient.from('participants').select('*').eq('team_id', myTeamId).order('name');
        globalStudents = students || [];

        const { data: comps } = await supabaseClient.from('competitions').select('*, categories(id, name, is_general), stages(name)').order('name');
        globalComps = comps || [];

        const studentIds = globalStudents.map(s => s.id);
        if(studentIds.length > 0) {
            // Include 'is_present' for live tracking
            const { data: assigns } = await supabaseClient
                .from('participant_competitions')
                .select(`id, participant_id, competition_id, is_leader, is_present`)
                .in('participant_id', studentIds);
            globalAssignments = assigns || [];
        }

        // 3. Populate the new catalog category filter
        const catSet = new Set(globalComps.map(c => c.categories?.name || 'GENERAL'));
        const catSelect = document.getElementById('filter-catalog-cat');
        if (catSelect) {
            catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
            catSet.forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        }

        // 4. CHECK REGISTRATION DEADLINE (AUTO-LOCKING)
        if (systemSettings.lock_date) {
            const deadline = new Date(systemSettings.lock_date);
            const now = new Date();
            if (now > deadline) {
                isAssignmentLocked = true;
                
                const workspace = document.getElementById('catalog-assign-workspace');
                if (workspace) {
                    workspace.style.opacity = '0.5';
                    workspace.style.pointerEvents = 'none';
                    
                    // Prevent duplicate alerts if re-fetched
                    if (!document.getElementById('lock-alert')) {
                        workspace.insertAdjacentHTML('afterbegin', 
                            `<div id="lock-alert" style="background: var(--danger); color: white; padding: 1rem; border-radius: 8px; font-weight: 800; text-align: center; margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
                                <i class="fa-solid fa-lock"></i> REGISTRATION DEADLINE HAS PASSED. ENROLLMENTS ARE LOCKED.
                            </div>`
                        );
                    }
                }
            }
        }

        // 5. Render UI
        updateDashboardStats();
        renderStudents();
        renderCatalog();
        renderLiveTracking();
        populateBulkAssignDropdown();

    } catch (e) {
        console.error(e);
    }
}
function updateDashboardStats() {
    document.getElementById('stat-total-students').innerText = globalStudents.length;
    // Calculate unique events
    const uniqueEvents = new Set(globalAssignments.map(a => a.competition_id)).size;
    document.getElementById('stat-total-events').innerText = uniqueEvents;
    
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
                <td data-label="DOB">${student.dob || 'N/A'}</td>
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

        // NEW: Check if Offstage Event
        const stageName = comp.is_offstage 
            ? '<span style="color:#D97706; font-weight:800;"><i class="fa-solid fa-pen-nib"></i> OFFSTAGE</span>' 
            : (comp.stages?.name || 'TBD');
            
        const limitDisplay = comp.max_participants ? comp.max_participants : 'NO LIMIT';
        
        // Make the badges clickable
        const typeBadge = comp.is_group 
            ? `<span class="badge" style="background:#e0e7ff; color:#4338ca; cursor:pointer;" onclick="viewCatalogEnrollments('${comp.id}')"><i class="fa-solid fa-users"></i> GROUP (LIMIT: ${limitDisplay} PER TEAM)</span>`
            : `<span class="badge" style="background:#d1fae5; color:#059669; cursor:pointer;" onclick="viewCatalogEnrollments('${comp.id}')"><i class="fa-solid fa-user"></i> SOLO (LIMIT: ${limitDisplay} PER TEAM)</span>`;

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

function viewCatalogEnrollments(compId) {
    const comp = globalComps.find(c => c.id === compId);
    const enrollments = globalAssignments.filter(a => a.competition_id === compId);
    
    document.getElementById('se-modal-title').innerText = `${comp.name} ENROLLMENTS`;
    const body = document.getElementById('se-modal-body');
    body.innerHTML = '';
    
    if (enrollments.length === 0) {
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center;">NO STUDENTS ENROLLED IN THIS EVENT.</p>`;
    } else {
        enrollments.forEach(a => {
            const student = globalStudents.find(s => s.id === a.participant_id);
            if (student) {
                const leaderTag = a.is_leader ? '<span class="badge badge-success" style="font-size: 0.65rem;">LEADER</span>' : '';
                body.innerHTML += `
                    <div style="padding: 1rem; background: #F8FAFC; border-radius: 8px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${student.name} ${leaderTag}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">${student.unique_id}</div>
                        </div>
                    </div>
                `;
            }
        });
    }
    document.getElementById('studentEventsModal').classList.add('show');
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
    const assignments = globalAssignments.filter(a => a.competition_id === compId);

    let checkedInHtml = '';
    let pendingHtml = '';

    assignments.forEach(a => {
        const s = globalStudents.find(student => student.id === a.participant_id);
        if (s) {
            if(a.is_present) {
                checkedInHtml += `<div style="padding: 0.75rem; background: #d1fae5; color: #059669; border-radius: 8px; margin-bottom: 0.5rem; font-weight: 600;">${s.name} (${s.unique_id})</div>`;
            } else {
                pendingHtml += `<div style="padding: 0.75rem; background: #fef3c7; color: #d97706; border-radius: 8px; margin-bottom: 0.5rem; font-weight: 600;">${s.name} (${s.unique_id})</div>`;
            }
        }
    });

    if(!checkedInHtml) checkedInHtml = '<p style="color: var(--text-muted);">NO STUDENTS CHECKED IN</p>';
    if(!pendingHtml) pendingHtml = '<p style="color: var(--text-muted);">NO PENDING STUDENTS</p>';

    document.getElementById('enroll-modal-title').innerText = comp.name;
    document.getElementById('enroll-modal-enrolled').innerHTML = checkedInHtml;
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
    const limit = comp.max_participants ? comp.max_participants : 'NO LIMIT';
    const currentEnrolled = globalAssignments.filter(a => a.competition_id === compId).length;
    
    document.getElementById('bulk-comp-info').innerHTML = `
        <span style="color:var(--primary);"><i class="fa-solid fa-users"></i> ENROLLED: ${currentEnrolled} / ${limit}</span>
        <span style="color:var(--text-muted); font-size: 0.8rem; margin-left: 1rem;">${comp.is_group ? 'GROUP EVENT' : 'INDIVIDUAL EVENT'}</span>
    `;

    // Toggle Leader Column Visibility
    leaderTh.style.display = comp.is_group ? 'table-cell' : 'none';

    // --- NEW: Calculate Allowed Categories for General Events ---
    const compCategoryId = comp.category_id;
    const isGeneral = comp.categories?.is_general === true;
    let allowedCatIds = [compCategoryId];
    
    if (isGeneral && globalCategories.length > 0) {
        globalCategories.forEach(c => {
            if (c.allowed_general_categories && c.allowed_general_categories.includes(compCategoryId)) {
                allowedCatIds.push(c.id);
            }
        });
    }

    globalStudents.forEach(student => {
        // FILTER: Only show student if they belong to the specific category, OR an allowed standard category
        if (!isGeneral && student.category_id !== compCategoryId) return;
        if (isGeneral && !allowedCatIds.includes(student.category_id)) return;

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
        if (comp.max_participants && (currentEnrolled + newEnrollments > comp.max_participants)) {
            return showToast(`LIMIT EXCEEDED! ONLY ${comp.max_participants - currentEnrolled} SLOTS LEFT FOR YOUR TEAM.`, "error");
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

// ==========================================
// TEAM PDF REPORTS ENGINE
// ==========================================

async function exportTeamParticipantListPDF() {
    showToast('Generating Participant List PDF...', 'success');
    try {
        const teamName = document.getElementById('team-name-title').innerText || 'MY TEAM';

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 28px; text-transform: uppercase;">${teamName}</h1>
                <h2 style="color: #1E293B; font-size: 18px; margin-top:0;">PARTICIPANT DIRECTORY</h2>
                <p style="color: #64748B; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
            </div>
        `;

        let tableRows = globalStudents.map((p, index) => {
            const enrollCount = globalAssignments.filter(a => a.participant_id === p.id).length;
            return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.dob || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${enrollCount}</td>
            </tr>
        `}).join('');

        if (globalStudents.length === 0) {
            tableRows = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #64748B;">No students found in this team.</td></tr>';
        }

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">UNIQUE ID</th>
                        <th style="padding: 10px;">NAME</th>
                        <th style="padding: 10px;">DOB</th>
                        <th style="padding: 10px; text-align: center;">EVENTS ENROLLED</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155; text-transform: uppercase;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = {
            margin: 10,
            filename: `${teamName.replace(/[^a-z0-9]/gi, '_')}_Participants.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().then(() => showToast('Participant PDF Downloaded!'));
    } catch (e) { showToast(e.message, 'error'); }
}

async function exportTeamProgramListPDF() {
    showToast('Generating Program List PDF...', 'success');
    try {
        const teamName = document.getElementById('team-name-title').innerText || 'MY TEAM';

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 28px; text-transform: uppercase;">${teamName}</h1>
                <h2 style="color: #1E293B; font-size: 18px; margin-top:0;">MASTER PROGRAM LIST</h2>
                <p style="color: #64748B; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
            </div>
        `;

        // Group data by competition
        let compsMap = {};
        globalAssignments.forEach(a => {
            const student = globalStudents.find(s => s.id === a.participant_id);
            const comp = globalComps.find(c => c.id === a.competition_id);
            if (student && comp) {
                if (!compsMap[comp.id]) {
                    compsMap[comp.id] = {
                        compName: comp.name,
                        category: comp.categories?.name || 'GENERAL',
                        // NEW: Update PDF to reflect Offstage status
                        stage: comp.is_offstage ? 'OFFSTAGE' : (comp.stages?.name || 'TBD'),
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

        if (sortedComps.length === 0) {
            container.innerHTML += '<p style="text-align: center; color: #64748B;">No enrollments found for this team.</p>';
        } else {
            sortedComps.forEach(c => {
                let pRows = c.participants.sort((a,b) => a.name.localeCompare(b.name)).map((p, i) => `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; width: 40px;">${i + 1}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.id}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${p.name} ${p.is_leader ? '<span style="color: #10B981; font-size:10px; font-weight:bold;">(LEADER)</span>' : ''}</td>
                    </tr>
                `).join('');

                container.innerHTML += `
                    <div style="margin-bottom: 20px; page-break-inside: avoid;">
                        <div style="background: #1E293B; color: white; padding: 10px; border-radius: 8px 8px 0 0;">
                            <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">${c.compName}</h3>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #CBD5E1; text-transform: uppercase;">CATEGORY: ${c.category} | STAGE: ${c.stage}</p>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                            <tbody style="font-size: 12px; color: #334155; text-transform: uppercase;">
                                ${pRows}
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }

        const opt = {
            margin: 10,
            filename: `${teamName.replace(/[^a-z0-9]/gi, '_')}_Program_List.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };

        html2pdf().set(opt).from(container).save().then(() => showToast('Program List PDF Downloaded!'));
    } catch (e) { showToast(e.message, 'error'); }
}

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
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    // 2. Update all standard brand containers
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = '';
        
        // STRICT RULE: No fallbacks. Only show what is provided in the admin panel.
        if (validLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px; margin-right: 8px;">`;
        }
        if (validName) {
            html += `<span>${brandingData.fest_name}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        
        // Keep centered on login and scan screens
        if (window.location.pathname.includes('login') || window.location.pathname.includes('scan')) {
            container.style.justifyContent = 'center';
        }
    });

    // 3. Special handler for the new program_report.html
    const reportHeader = document.querySelector('.header h1');
    if (reportHeader && !reportHeader.classList.contains('brand')) {
        let html = '';
        if (validLogo) html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px; margin-right: 8px;">`;
        if (validName) html += `<span>${brandingData.fest_name} Team Portal</span>`;
        
        // If neither exists, clear the header entirely
        reportHeader.innerHTML = html;
    }
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
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); background: white; border-radius: 12px; border: 1px dashed var(--border);">No active appeals.</div>';
            return;
        }

        container.innerHTML = data.map(ticket => {
            let statusColor = ticket.status === 'pending' ? 'var(--warning)' : (ticket.status === 'approved' ? 'var(--success)' : 'var(--danger)');
            
            return `
            <div style="background: white; border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <span style="background: var(--bg-main); padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.7rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: inline-block;">${ticket.issue_type.toUpperCase()}</span>
                        <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem;">${ticket.competitions?.name || 'General Issue'}</h3>
                        <p style="font-family: monospace; font-size: 0.85rem; color: var(--primary); font-weight: 600;">${ticket.participants?.name || 'N/A'} (${ticket.participants?.unique_id || 'N/A'})</p>
                    </div>
                    <span style="padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${statusColor}; color: ${statusColor};">${ticket.status.toUpperCase()}</span>
                </div>
                <div style="background: #F8FAFC; padding: 1rem; border-radius: 8px; font-size: 0.9rem; color: var(--text-muted); border-left: 3px solid var(--border);">
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
        <div style="background: var(--primary-light); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: flex-start; border: 1px solid rgba(79, 70, 229, 0.2);">
            <i class="fa-solid fa-circle-info" style="color: var(--primary); font-size: 1.25rem; margin-top: 0.1rem;"></i>
            <div style="font-size: 0.85rem; color: var(--primary); font-weight: 600; line-height: 1.5; text-transform: none;">
                Use this form to report scoring disputes, name corrections, or technical issues. Your ticket will be logged securely and sent directly to the Master Admin for review.
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
            <div class="form-group" style="grid-column: 1 / -1; margin: 0;">
                <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-tag" style="margin-right: 0.25rem;"></i> ISSUE TYPE</label>
                <select id="appealType" style="width: 100%; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--border); font-weight: 700; outline: none; background: #F8FAFC; color: var(--text-main);">
                    <option value="score_dispute">🏆 Score / Result Dispute</option>
                    <option value="name_correction">✍️ Name / ID Correction</option>
                    <option value="other">⚙️ Other Technical Issue</option>
                </select>
            </div>
            
            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-microphone-stage" style="margin-right: 0.25rem;"></i> RELATED EVENT (OPTIONAL)</label>
                <select id="appealComp" style="width: 100%; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--border); outline: none; background: #F8FAFC; font-weight: 600; color: var(--text-main);">
                    <option value="">-- NOT APPLICABLE --</option>
                    ${compOpts}
                </select>
            </div>

            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-user" style="margin-right: 0.25rem;"></i> PARTICIPANT (OPTIONAL)</label>
                <select id="appealPart" style="width: 100%; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--border); outline: none; background: #F8FAFC; font-weight: 600; color: var(--text-main);">
                    <option value="">-- NOT APPLICABLE --</option>
                    ${partOpts}
                </select>
            </div>
        </div>

        <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-align-left" style="margin-right: 0.25rem;"></i> DETAILED DESCRIPTION</label>
            <textarea id="appealDesc" rows="4" placeholder="Please explain the issue clearly..." style="width: 100%; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); resize: vertical; font-weight: 500; outline: none; background: #F8FAFC; text-transform: none; color: var(--text-main); font-family: 'Inter', sans-serif;"></textarea>
        </div>
    `;

    openModal('Raise Grievance Ticket', premiumHtml, async () => {
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
            const { error } = await supabaseClient.from('appeals').insert([payload]);
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

// Add loadAppeals() to your switchTab logic!

// Boot
document.addEventListener('DOMContentLoaded', initDashboard);