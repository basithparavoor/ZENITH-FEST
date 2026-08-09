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
let globalCategories = []; 
let currentCropper = null;

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

    if (tabId === 'appeals') {
        loadAppeals();
    }
    // Automatically populate the dropdown when navigating to assignments tab
    if (tabId === 'assignments') {
        populateBulkAssignDropdown();
    }
    
    // Reset mobile smooth scroll container to the top
    const mainContent = document.querySelector('.main-content');
    if(mainContent) mainContent.scrollTop = 0;
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

async function refreshDashboard(btnElement) {
    if (btnElement) {
        const icon = btnElement.querySelector('i');
        if (icon) icon.classList.add('fa-spin'); 
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
            if (icon) icon.classList.remove('fa-spin'); 
        }
    }
}

async function fetchAllData() {
    try {
        const { data: set_data } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();
        let systemSettings = set_data && set_data.value ? set_data.value : {};

        const { data: cats } = await supabaseClient.from('categories').select('*');
        globalCategories = cats || [];

        const { data: students } = await supabaseClient.from('participants').select('*').eq('team_id', myTeamId).order('name');
        globalStudents = students || [];

        const { data: comps } = await supabaseClient.from('competitions').select('*, categories(id, name, is_general), stages(name)').order('name');
        globalComps = comps || [];

        const studentIds = globalStudents.map(s => s.id);
        if(studentIds.length > 0) {
            const { data: assigns } = await supabaseClient
                .from('participant_competitions')
                .select(`id, participant_id, competition_id, is_leader, is_present`)
                .in('participant_id', studentIds);
            globalAssignments = assigns || [];
        }

        const catSet = new Set(globalComps.map(c => c.categories?.name || 'GENERAL'));
        const catSelect = document.getElementById('filter-catalog-cat');
        if (catSelect) {
            catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
            catSet.forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        }

        if (systemSettings.lock_date) {
            const deadline = new Date(systemSettings.lock_date);
            const now = new Date();
            if (now > deadline) {
                isAssignmentLocked = true;
                
                const workspace = document.getElementById('assignments');
                if (workspace) {
                    const lockBanner = document.getElementById('lock-banner');
                    lockBanner.style.display = 'flex';
                    lockBanner.innerHTML = `<i class="fa-solid fa-lock"></i> REGISTRATION DEADLINE HAS PASSED. ENROLLMENTS ARE LOCKED.`;
                    
                    document.getElementById('btn-bulk-enroll').disabled = true;
                    document.getElementById('btn-bulk-remove').disabled = true;
                }

                // NEW: Lock the Add Member button too!
                const btnAddMember = document.getElementById('btn-add-member');
                if (btnAddMember) {
                    btnAddMember.disabled = true;
                    btnAddMember.innerHTML = `<i class="fa-solid fa-lock"></i> REGISTRATION LOCKED`;
                    btnAddMember.style.opacity = '0.6';
                }
            }
        }

        updateDashboardStats();
        renderStudents();
        renderCatalog();
        renderLiveTracking();
        
        // Ensures the dropdown populates immediately without having to click the tab
        populateBulkAssignDropdown();

    } catch (e) {
        console.error(e);
    }
}

function updateDashboardStats() {
    document.getElementById('stat-total-students').innerText = globalStudents.length;
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
        
        // NEW: Profile Photo Logic
        const photoSrc = student.photo_url ? student.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3EPHOTO%3C/text%3E%3C/svg%3E';

        tbody.innerHTML += `
            <tr>
                <td data-label="STUDENT NAME" style="display: flex; align-items: center; gap: 0.85rem; justify-content: flex-start; text-align: left;">
                    <img src="${photoSrc}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); box-shadow: var(--shadow-sm); flex-shrink: 0;">
                    <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${student.name}</span>
                </td>
                <td data-label="UNIQUE ID" style="font-family: monospace;">${student.unique_id}</td>
                <td data-label="DOB" style="font-weight: 800; color: var(--text-muted);">${student.dob || 'N/A'}</td>
                <td data-label="EVENTS ENROLLED">
                    <span class="badge ${badgeClass}" onclick="viewStudentEvents('${student.id}')">${enrollCount} EVENTS <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left: 4px;"></i></span>
                </td>
            </tr>
        `;
    });
}

function viewStudentEvents(studentId) {
    const student = globalStudents.find(s => s.id === studentId);
    const assignedComps = globalAssignments.filter(a => a.participant_id === studentId).map(a => a.competition_id);
    
    document.getElementById('se-modal-title').innerText = `${student.name}'S EVENTS`;
    const body = document.getElementById('se-modal-body');
    body.innerHTML = '';
    
    if (assignedComps.length === 0) {
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0; font-weight: 600;">NOT ENROLLED IN ANY EVENTS.</p>`;
    } else {
        assignedComps.forEach(compId => {
            const comp = globalComps.find(c => c.id === compId);
            if (comp) {
                body.innerHTML += `
                    <div style="padding: 1.25rem; background: var(--bg-main); border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; margin-bottom: 0.25rem; color: var(--text-main);">${comp.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-layer-group" style="margin-right: 4px;"></i> ${comp.categories?.name || 'EVENT'}</div>
                        </div>
                        <span class="badge badge-gray" style="text-transform: uppercase;">${comp.status.replace('_', ' ')}</span>
                    </div>
                `;
            }
        });
    }
    document.getElementById('studentEventsModal').classList.add('show');
}

// --- ADD NEW MEMBER LOGIC ---
function openAddMemberModal() {
    if (isAssignmentLocked) return showToast("Registration is locked by Admin.", "error");

    let catOpts = globalCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const pPhoto = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23EEF2FF"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236366F1"%3EPHOTO%3C/text%3E%3C/svg%3E';
    
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
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('partPhoto').click()" title="Upload New Photo"><i class="fa-solid fa-upload"></i> New</button>
                    <button type="button" class="btn btn-outline" onclick="editExistingCrop()" title="Adjust Current Crop"><i class="fa-solid fa-crop-simple"></i> Crop</button>
                </div>
            </div>

            <div class="form-fields" style="text-align: left;">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">FULL NAME <span style="color: var(--danger);">*</span></label>
                    <input type="text" id="partName" placeholder="E.G. JOHN DOE" style="width: 100%; padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--input-bg); outline: none; font-weight: 600;">
                </div>
                
                <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 2; min-width: 150px; margin-bottom: 1rem;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">CATEGORY <span style="color: var(--danger);">*</span></label>
                        <select id="partCategory" style="width: 100%; padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--input-bg); outline: none; font-weight: 600;">${catOpts}</select>
                    </div>
                    
                    <div class="form-group" style="flex: 1; min-width: 130px; margin-bottom: 1rem;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">DATE OF BIRTH</label>
                        <input type="date" id="partDob" style="width: 100%; padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--input-bg); outline: none; font-weight: 600; text-transform: none;">
                    </div>
                </div>
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
    const unique_id = `${Math.floor(100000 + Math.random() * 900000)}`;
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    
    try {
        let photo_url = undefined; 

        if (currentCropper) {
            showToast('Processing image...', 'success');
            const canvas = currentCropper.getCroppedCanvas({ width: 400, height: 600 });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const fileName = `profile_${Date.now()}.jpg`; 
            
            const { error: uploadError } = await supabaseClient.storage
                .from('photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });
                
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage.from('photos').getPublicUrl(fileName);
            photo_url = publicUrlData.publicUrl;
        }

        const payload = { name, team_id: myTeamId, category_id, dob, unique_id };
        if (photo_url) payload.photo_url = photo_url; 

        const { error } = await supabaseClient.from('participants').insert([payload]);
        if (error) throw error;
        
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

// --- CROPPER LIFECYCLE ---
function triggerCropper(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const cropperModal = document.getElementById('cropperModal');
            const image = document.getElementById('cropperImage');
            
            image.src = e.target.result;
            cropperModal.classList.add('show');
            
            if (currentCropper) currentCropper.destroy();
            currentCropper = new Cropper(image, {
                aspectRatio: 2 / 3,
                viewMode: 2, 
                background: false,
                autoCropArea: 0.9
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function cancelCropper() {
    document.getElementById('cropperModal').classList.remove('show');
    if (currentCropper) { currentCropper.destroy(); currentCropper = null; }
    if(document.getElementById('partPhoto')) document.getElementById('partPhoto').value = ''; 
}

function confirmCrop() {
    if (!currentCropper) return;
    const canvas = currentCropper.getCroppedCanvas({ width: 400, height: 600 });
    document.getElementById('partPhotoPreview').src = canvas.toDataURL('image/jpeg', 0.8);
    document.getElementById('cropperModal').classList.remove('show');
}

function editExistingCrop() {
    const currentSrc = document.getElementById('partPhotoPreview').src;
    if (currentSrc.includes('w3.org')) {
        showToast('Please upload a photo first before attempting to crop.', 'error');
        return;
    }
    
    const cropperModal = document.getElementById('cropperModal');
    const image = document.getElementById('cropperImage');
    
    image.src = currentSrc;
    cropperModal.classList.add('show');
    
    if (currentCropper) currentCropper.destroy();
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

        const stageName = comp.is_offstage 
            ? '<span style="color:#D97706; font-weight:800; background: #FEF3C7; padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-pen-nib"></i> OFFSTAGE</span>' 
            : `<span style="color: var(--text-muted); font-weight: 700;"><i class="fa-solid fa-microphone-stage" style="margin-right: 4px;"></i> ${comp.stages?.name || 'TBD'}</span>`;
            
        const limitDisplay = comp.max_participants ? comp.max_participants : 'NO LIMIT';
        
        const typeBadge = comp.is_group 
            ? `<span class="badge" style="background:var(--primary-light); color:var(--primary); cursor:pointer;" onclick="viewCatalogEnrollments('${comp.id}')"><i class="fa-solid fa-users"></i> GROUP (LIMIT: ${limitDisplay})</span>`
            : `<span class="badge" style="background:var(--success-light); color:var(--success-hover); cursor:pointer;" onclick="viewCatalogEnrollments('${comp.id}')"><i class="fa-solid fa-user"></i> SOLO (LIMIT: ${limitDisplay})</span>`;

        tbody.innerHTML += `
            <tr>
                <td data-label="EVENT NAME"></td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${catName}</span></td>
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
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-weight: 600; padding: 2rem 0;">NO STUDENTS ENROLLED IN THIS EVENT.</p>`;
    } else {
        enrollments.forEach(a => {
            const student = globalStudents.find(s => s.id === a.participant_id);
            if (student) {
                const leaderTag = a.is_leader ? '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 8px;">LEADER</span>' : '';
                body.innerHTML += `
                    <div style="padding: 1.25rem; background: var(--bg-main); border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
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
    const comp = globalComps.find(c => c.id === compId);
    const assignments = globalAssignments.filter(a => a.competition_id === compId);

    let checkedInHtml = '';
    let pendingHtml = '';

    assignments.forEach(a => {
        const s = globalStudents.find(student => student.id === a.participant_id);
        if (s) {
            if(a.is_present) {
                checkedInHtml += `<div style="padding: 1rem; background: var(--success-light); color: var(--success-hover); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md); font-weight: 700; display: flex; justify-content: space-between; align-items: center;">${s.name} <span style="font-family: monospace; font-size: 0.8rem; background: white; padding: 2px 6px; border-radius: 4px;">${s.unique_id}</span></div>`;
            } else {
                pendingHtml += `<div style="padding: 1rem; background: var(--warning-light); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-md); font-weight: 700; display: flex; justify-content: space-between; align-items: center;">${s.name} <span style="font-family: monospace; font-size: 0.8rem; background: white; padding: 2px 6px; border-radius: 4px;">${s.unique_id}</span></div>`;
            }
        }
    });

    if(!checkedInHtml) checkedInHtml = '<div style="padding: 2rem; text-align: center; background: var(--bg-main); border-radius: var(--radius-md); color: var(--text-muted); font-weight: 600;">NO STUDENTS CHECKED IN</div>';
    if(!pendingHtml) pendingHtml = '<div style="padding: 2rem; text-align: center; background: var(--bg-main); border-radius: var(--radius-md); color: var(--text-muted); font-weight: 600;">NO PENDING STUDENTS</div>';

    document.getElementById('enroll-modal-title').innerText = comp.name;
    document.getElementById('enroll-modal-enrolled').innerHTML = checkedInHtml;
    document.getElementById('enroll-modal-pending').innerHTML = pendingHtml;
    document.getElementById('enrollmentDetailsModal').classList.add('show');
}

// ---------------- BULK ASSIGNMENTS ----------------
function populateBulkAssignDropdown() {
    const select = document.getElementById('bulkAssignComp');
    if (!select) return;
    select.innerHTML = '<option value="">-- CHOOSE A COMPETITION --</option>';
    
    // Broadened filter to ensure TM can see anything that isn't completely finished
    const eligibleComps = globalComps.filter(c => c.status !== 'published' && c.status !== 'judgement_complete');
    
    eligibleComps.forEach(c => {
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
    const limit = comp.max_participants ? comp.max_participants : 'NO LIMIT';
    const currentEnrolled = globalAssignments.filter(a => a.competition_id === compId).length;
    
    document.getElementById('bulk-comp-info').innerHTML = `
        <span style="color:var(--primary); font-size: 1.05rem;"><i class="fa-solid fa-users"></i> ENROLLED: ${currentEnrolled} / ${limit}</span>
        <span class="badge badge-gray">${comp.is_group ? 'GROUP EVENT' : 'INDIVIDUAL EVENT'}</span>
    `;

    leaderTh.style.display = comp.is_group ? 'table-cell' : 'none';

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
        if (!isGeneral && student.category_id !== compCategoryId) return;
        if (isGeneral && !allowedCatIds.includes(student.category_id)) return;

        const assignment = globalAssignments.find(a => a.participant_id === student.id && a.competition_id === compId);
        const isEnrolled = !!assignment;
        
        const statusBadge = isEnrolled 
            ? `<span class="badge badge-success"><i class="fa-solid fa-check"></i> ENROLLED</span>` 
            : `<span class="badge badge-gray">NOT ENROLLED</span>`;

        const leaderRadio = comp.is_group 
            ? `<td data-label="GROUP LEADER" style="text-align:center;"><input type="radio" name="group_leader" class="leader-radio" value="${student.id}" ${assignment?.is_leader ? 'checked' : ''} style="width:24px; height:24px; accent-color:var(--primary); cursor:pointer;"></td>` 
            : '';

        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell">
                    <input type="checkbox" class="bulk-cb" value="${student.id}" data-assignment-id="${assignment ? assignment.id : ''}" ${isEnrolled ? 'checked' : ''} style="width:24px; height:24px; cursor:pointer;">
                </td>
                <td data-label="STUDENT NAME"></td>
                <td data-label="UNIQUE ID" style="font-family: monospace; font-weight: 700; color: var(--text-muted);">${student.unique_id}</td>
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

    const leaderId = document.querySelector('.leader-radio:checked')?.value;

    checkboxes.forEach(cb => {
        const pId = cb.value;
        const assignId = cb.getAttribute('data-assignment-id');
        const isLeader = (pId === leaderId);
        
        if (action === 'enroll') {
            if(assignId) {
                payload.push({ id: assignId, participant_id: pId, competition_id: compId, is_leader: isLeader });
            } else {
                payload.push({ participant_id: pId, competition_id: compId, is_leader: isLeader });
            }
        } else if (action === 'remove' && assignId) {
            deleteIds.push(assignId);
        }
    });

    if (action === 'enroll') {
        const newEnrollments = payload.filter(p => !p.id).length; 
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
    document.getElementById('scanIframe').src = '';
    document.getElementById('scanModal').classList.remove('show');
}

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

        let compsMap = {};
        globalAssignments.forEach(a => {
            const student = globalStudents.find(s => s.id === a.participant_id);
            const comp = globalComps.find(c => c.id === a.competition_id);
            if (student && comp) {
                if (!compsMap[comp.id]) {
                    compsMap[comp.id] = {
                        compName: comp.name,
                        category: comp.categories?.name || 'GENERAL',
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
    
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Team Portal';
    document.title = `${festName} | ${pageContext}`;

    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = '';
        if (validLogo) html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px; margin-right: 8px;">`;
        if (validName) html += `<span>${brandingData.fest_name} TM</span>`;
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
    });
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
            container.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border); font-weight: 600;">No active appeals.</div>';
            return;
        }

        container.innerHTML = data.map(ticket => {
            let statusColor = ticket.status === 'pending' ? 'var(--warning)' : (ticket.status === 'approved' ? 'var(--success)' : 'var(--danger)');
            
            return `
            <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-card);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: var(--bg-main); padding: 0.35rem 0.75rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: inline-block;">${ticket.issue_type.replace('_', ' ').toUpperCase()}</span>
                        <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem;">${ticket.competitions?.name || 'GENERAL ISSUE'}</h3>
                        <p style="font-family: monospace; font-size: 0.95rem; color: var(--primary); font-weight: 700;">${ticket.participants?.name || 'N/A'} (${ticket.participants?.unique_id || 'N/A'})</p>
                    </div>
                    <span style="padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.8rem; font-weight: 800; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${ticket.status.toUpperCase()}</span>
                </div>
                <div style="background: var(--input-bg); padding: 1.25rem; border-radius: var(--radius-md); font-size: 0.95rem; color: var(--text-muted); border-left: 4px solid var(--border); font-weight: 500; line-height: 1.5;">
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
            <div style="font-size: 0.9rem; color: var(--primary); font-weight: 600; line-height: 1.5; text-transform: none;">
                Use this form to report scoring disputes, name corrections, or technical issues. Your ticket will be logged securely and sent directly to the Master Admin for review.
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-tag" style="margin-right: 0.25rem;"></i> ISSUE TYPE</label>
                <select id="appealType" style="width: 100%; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); font-weight: 700; outline: none; background: var(--input-bg); color: var(--text-main);">
                    <option value="score_dispute">SCORE / RESULT DISPUTE</option>
                    <option value="name_correction">NAME / ID CORRECTION</option>
                    <option value="other">OTHER TECHNICAL ISSUE</option>
                </select>
            </div>
            
            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-microphone-stage" style="margin-right: 0.25rem;"></i> RELATED EVENT (OPTIONAL)</label>
                <select id="appealComp" style="width: 100%; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); outline: none; background: var(--input-bg); font-weight: 600; color: var(--text-main);">
                    <option value="">-- NOT APPLICABLE --</option>
                    ${compOpts}
                </select>
            </div>

            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-user" style="margin-right: 0.25rem;"></i> PARTICIPANT (OPTIONAL)</label>
                <select id="appealPart" style="width: 100%; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); outline: none; background: var(--input-bg); font-weight: 600; color: var(--text-main);">
                    <option value="">-- NOT APPLICABLE --</option>
                    ${partOpts}
                </select>
            </div>
        </div>

        <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block; letter-spacing: 0.05em;"><i class="fa-solid fa-align-left" style="margin-right: 0.25rem;"></i> DETAILED DESCRIPTION</label>
            <textarea id="appealDesc" rows="5" placeholder="PLEASE EXPLAIN THE ISSUE CLEARLY..." style="width: 100%; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); resize: vertical; font-weight: 500; outline: none; background: var(--input-bg); color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 0.95rem;"></textarea>
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

// Global Branding Synchronization
document.addEventListener("DOMContentLoaded", () => {
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
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
    
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Team Portal';
    document.title = `${festName} | ${pageContext}`;

    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = '';
        if (validLogo) html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px; margin-right: 8px;">`;
        if (validName) html += `<span>${brandingData.fest_name} TM</span>`;
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
    });
}

// Boot
document.addEventListener('DOMContentLoaded', initDashboard);