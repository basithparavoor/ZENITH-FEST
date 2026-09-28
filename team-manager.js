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
let systemSettings = {}; 
let tmScheduleData = {};

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

function toggleMobileMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.mobile-overlay').classList.toggle('open');
}

function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll(`[onclick*="switchTab('${tabId}')"]`).forEach(el => {
        el.classList.add('active');
    });

    if (tabId === 'appeals') loadAppeals();
    if (tabId === 'assignments') populateBulkAssignCategoryDropdown();
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
        localStorage.removeItem('festUser');
        window.location.href = 'index.html';
    });
}

async function initDashboard() {
    if(window.innerWidth > 768) {
        document.getElementById('desktop-subtitle').style.display = 'block';
    }

    try {
        const [
            { data: teamData },
            { data: settingsData }
        ] = await Promise.all([
            supabaseClient.from('teams').select('name, manager_name, assistant_manager_name').eq('id', myTeamId).single(),
            supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle()
        ]);

        document.getElementById('team-name-title').innerText = teamData ? teamData.name : 'MY TEAM';
        
        // Inject manager names into UI
        if (teamData) {
            const mgr = teamData.manager_name || 'NOT ASSIGNED';
            const asst = teamData.assistant_manager_name || 'NOT ASSIGNED';
            document.getElementById('tm-manager-names').innerHTML = `<i class="fa-solid fa-user-tie"></i> MGR: ${mgr} <span style="color:var(--border);">|</span> ASST: ${asst}`;
        }

        if (settingsData && settingsData.value) {
            systemSettings = settingsData.value;
            if (systemSettings.tm_access === false) {
                isAssignmentLocked = true; 
            }
        }

        if (isAssignmentLocked && !systemSettings.lock_date) {
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
        const [
            { data: schedData },
            { data: cats },
            { data: students },
            { data: comps }
        ] = await Promise.all([
            supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle(),
            supabaseClient.from('categories').select('*'),
            supabaseClient.from('participants').select('*, categories(name)').eq('team_id', myTeamId).order('name'),
            supabaseClient.from('competitions').select('*, categories(id, name, is_general, allowed_general_categories), stages(name)').order('name')
        ]);

        tmScheduleData = schedData?.value || {};
        globalCategories = cats || [];
        globalStudents = students || [];
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

        // --- ENFORCE DEADLINE AND UPDATE UI ---
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
                    if(btnBulkEnroll) btnBulkEnroll.disabled = true;
                    if(btnBulkRemove) btnBulkRemove.disabled = true;
                }

                const btnAddMember = document.getElementById('btn-add-member');
                if (btnAddMember) {
                    btnAddMember.disabled = true;
                    btnAddMember.innerHTML = `<i class="fa-solid fa-lock"></i> REGISTRATION LOCKED`;
                    btnAddMember.style.opacity = '0.6';
                }
            } else if (!isAssignmentLocked) {
                // Time has been extended by admin, unlock the UI
                const lockBanner = document.getElementById('lock-banner');
                if(lockBanner) lockBanner.style.display = 'none';
                
                const btnBulkEnroll = document.getElementById('btn-bulk-enroll');
                const btnBulkRemove = document.getElementById('btn-bulk-remove');
                if(btnBulkEnroll) btnBulkEnroll.disabled = false;
                if(btnBulkRemove) btnBulkRemove.disabled = false;
                
                const btnAddMember = document.getElementById('btn-add-member');
                if(btnAddMember) {
                    btnAddMember.disabled = false;
                    btnAddMember.innerHTML = `<i class="fa-solid fa-user-plus"></i> ADD NEW MEMBER`;
                    btnAddMember.style.opacity = '1';
                }
            }
        }

        updateDashboardStats();
        renderStudents();
        renderCatalog();
        renderLiveTracking();
        populateBulkAssignCategoryDropdown();

    } catch (e) {
        console.error(e);
    }
}

async function updateDashboardStats() {
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
            const { data: judgements } = await supabaseClient
                .from('judgements')
                .select('participant_id, competition_id, awarded_mark')
                .in('competition_id', publishedCompIds);
            
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
    
    document.getElementById('stat-total-points').innerText = totalPoints;
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
        
        const photoSrc = student.photo_url ? student.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3EPHOTO%3C/text%3E%3C/svg%3E';

      tbody.innerHTML += `
            <tr>
                <td data-label="STUDENT NAME" style="display: flex; align-items: center; gap: 0.85rem; justify-content: flex-start; text-align: left;">
                    <img src="${photoSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--border); box-shadow: var(--shadow-sm); flex-shrink: 0;">
                    <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">${student.name}</span>
                </td>
                <td data-label="UNIQUE ID" style="font-family: monospace;">${student.unique_id}</td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${student.categories?.name || 'GENERAL'}</span></td>
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
        body.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-weight: 700; padding: 2rem 0;">NO STUDENTS ENROLLED IN THIS EVENT.</p>`;
    } else {
        assignedComps.forEach(compId => {
            const comp = globalComps.find(c => c.id === compId);
            if (comp) {
                body.innerHTML += `
                    <div style="padding: 1.25rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--text-main);">${comp.name}</div>
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

window.validateTMDob = function() {
    const catId = document.getElementById('partCategory').value;
    const dobVal = document.getElementById('partDob').value;
    const warningEl = document.getElementById('tmDobWarning');
    const saveBtn = document.getElementById('modalSaveBtn');
    
    if(!catId || !dobVal || !warningEl) return;
    
    const category = globalCategories.find(c => String(c.id) === String(catId));
    let isInvalid = false;
    let warningMsg = '';

    if(category) {
        const dobDate = new Date(dobVal);
        if (category.dob_start && dobDate < new Date(category.dob_start)) {
            isInvalid = true;
            warningMsg = `NOT ELIGIBLE: MUST BE BORN ON OR AFTER ${category.dob_start}.`;
        }
        if (category.dob_end && dobDate > new Date(category.dob_end)) {
            isInvalid = true;
            warningMsg = `NOT ELIGIBLE: MUST BE BORN ON OR BEFORE ${category.dob_end}.`;
        }
    }

    if(isInvalid) {
        warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${warningMsg}`;
        warningEl.style.display = 'block';
        if(saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }
    } else {
        warningEl.style.display = 'none';
        if(saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
    }
};

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
                        <select id="partCategory" onchange="window.validateTMDob()" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--input-bg); outline: none; font-weight: 700;">${catOpts}</select>
                    </div>
                    
                    <div class="form-group" style="flex: 1; min-width: 130px; margin-bottom: 1rem;">
                        <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">DATE OF BIRTH</label>
                        <input type="date" id="partDob" onchange="window.validateTMDob()" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--input-bg); outline: none; font-weight: 700; text-transform: none;">
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

        // FIXED: Replaced explicit stage names with pure "OFFSTAGE" or "STAGE" label
        const stageName = comp.is_offstage 
            ? '<span style="color:#D97706; font-weight:800; background: #FEF3C7; padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-pen-nib"></i> OFFSTAGE</span>' 
            : `<span style="color: var(--primary); font-weight: 800; background: var(--primary-light); padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-microphone-stage"></i> STAGE</span>`;
            
        const limitDisplay = comp.max_participants ? comp.max_participants : 'NO LIMIT';
        
        const typeBadge = comp.is_group 
            ? `<span class="badge" style="background:var(--primary-light); color:var(--primary);"><i class="fa-solid fa-users"></i> GROUP (LIMIT: ${limitDisplay})</span>`
            : `<span class="badge" style="background:var(--success-light); color:#059669;"><i class="fa-solid fa-user"></i> SOLO (LIMIT: ${limitDisplay})</span>`;

        tbody.innerHTML += `
            <tr>
                <td data-label="EVENT NAME" style="font-weight: 700; color: var(--text-main);"></td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="STAGE PRESENCE">${stageName}</td>
                <td data-label="TYPE & LIMIT">${typeBadge}</td>
            </tr>
        `;
        tbody.lastElementChild.firstElementChild.innerText = comp.name;
    });
}

async function exportCatalogPDF() {
    showToast('Generating Catalog PDF...', 'success');
    
    const search = document.getElementById('search-catalog').value.toLowerCase();
    const typeFilter = document.getElementById('filter-catalog-type').value;
    const catFilter = document.getElementById('filter-catalog-cat').value;
    
    const filteredComps = globalComps.filter(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        if (typeFilter === 'group' && !comp.is_group) return false;
        if (typeFilter === 'individual' && comp.is_group) return false;
        if (catFilter !== 'all' && catName !== catFilter) return false;
        if (search && !comp.name.toLowerCase().includes(search) && !catName.toLowerCase().includes(search)) return false;
        return true;
    });

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML(`Event Catalog`);

    let tableRows = filteredComps.map((c, i) => {
        const stageName = c.is_offstage ? 'OFFSTAGE' : 'STAGE';
        const typeBadge = c.is_group ? `GROUP (MAX ${c.max_participants})` : `SOLO (MAX ${c.max_participants})`;
        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${i + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A;">${c.name.toUpperCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${(c.categories?.name || 'GENERAL').toUpperCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #4F46E5;">${stageName}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${typeBadge}</td>
        </tr>
    `}).join('');

    container.innerHTML += `
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
            <thead>
                <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                    <th style="padding: 10px;">#</th><th style="padding: 10px;">EVENT NAME</th><th style="padding: 10px;">CATEGORY</th><th style="padding: 10px;">PRESENCE</th><th style="padding: 10px;">TYPE & LIMIT</th>
                </tr>
            </thead>
            <tbody style="font-size: 12px; color: #334155;">${tableRows}</tbody>
        </table>
    `;

    const opt = { margin: 10, filename: `Event_Catalog.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
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
    const comp = globalComps.find(c => c.id === compId);
    const assignments = globalAssignments.filter(a => a.competition_id === compId);
    
    // Check if the event is closed/live
    const isEventClosed = ['ongoing', 'valuation', 'judgement_complete', 'published'].includes(comp.status);
    const pendingLabel = isEventClosed ? 'NOT PARTICIPATED' : 'PENDING';
    const pendingBg = isEventClosed ? 'var(--danger-light)' : 'var(--warning-light)';
    const pendingColor = isEventClosed ? 'var(--danger)' : '#D97706';
    const pendingBorder = isEventClosed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';

    let checkedInHtml = '';
    let pendingHtml = '';

    assignments.forEach(a => {
        const s = globalStudents.find(student => student.id === a.participant_id);
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

    document.getElementById('enroll-modal-title').innerText = comp.name;
    document.getElementById('enroll-modal-enrolled').innerHTML = checkedInHtml;
    document.getElementById('enroll-modal-pending').innerHTML = pendingHtml;
    
    // Update the pending column header
    document.getElementById('enroll-modal-pending-title').innerHTML = `<i class="fa-solid fa-clock"></i> ${pendingLabel}`;
    document.getElementById('enroll-modal-pending-title').style.color = pendingColor;
    
    document.getElementById('enrollmentDetailsModal').classList.add('show');
}

// ---------------- BULK ASSIGNMENTS ----------------

// NEW: Populates the first dropdown with categories
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
    document.getElementById('bulk-table-wrapper').style.display = 'none';
}

// UPDATED: Populates the second dropdown based on the category chosen
function populateBulkAssignDropdown() {
    const categoryId = document.getElementById('bulkAssignCategory').value;
    const select = document.getElementById('bulkAssignComp');
    
    // Hide the workspace table whenever a new category is selected
    document.getElementById('bulk-table-wrapper').style.display = 'none';
    
    if (!select) return;
    
    if (!categoryId) {
        select.innerHTML = '<option value="">-- CHOOSE CATEGORY FIRST --</option>';
        select.disabled = true;
        return;
    }
    
    select.innerHTML = '<option value="">-- CHOOSE A COMPETITION --</option>';
    
    // Filter competitions by pending statuses AND the selected category
    const eligibleComps = globalComps.filter(c => 
        c.status !== 'published' && 
        c.status !== 'judgement_complete' &&
        c.category_id == categoryId // Use == to fix String vs Integer mismatch
    );
    eligibleComps.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    // Unlock the competition dropdown
    select.disabled = false;
}
function renderBulkAssignmentTable() {
    const compId = document.getElementById('bulkAssignComp').value;
    const tbody = document.getElementById('bulk-assignments-tbody');
    const wrapper = document.getElementById('bulk-table-wrapper');
    const thLeader = document.getElementById('th-leader'); 

    if (!compId) {
        wrapper.style.display = 'none';
        return;
    }

    const comp = globalComps.find(c => c.id == compId);
    if (!comp) return;

    wrapper.style.display = 'block';
    if (thLeader) thLeader.style.display = comp.is_group ? 'table-cell' : 'none';

    tbody.innerHTML = '';
    
    // Corrected Eligibility Logic: allowed_general_categories belongs to the Student's category, not the Competition's category
    const eligibleStudents = globalStudents.filter(student => {
        // 1. Direct match (Works for standard comps, or if student is natively in the general category)
        if (student.category_id == comp.category_id) return true;

        // 2. Cross-category match for General Competitions
        if (comp.categories?.is_general) {
            // Find the student's category data from the global catalog
            const studentCategory = globalCategories.find(c => c.id == student.category_id);
            if (studentCategory) {
                let rawAllowed = studentCategory.allowed_general_categories;
                let allowedCats = [];
                try {
                    if (typeof rawAllowed === 'string') allowedCats = JSON.parse(rawAllowed);
                    else if (Array.isArray(rawAllowed)) allowedCats = rawAllowed;
                } catch(e) {}
                
                // Check if the student's category explicitly allows this general competition's category
                if (allowedCats.some(id => id == comp.category_id)) {
                    return true;
                }
            }
        }
        return false;
    });

    const enrolledData = globalAssignments.filter(a => a.competition_id == compId);

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

            const { error } = await supabaseClient.from('participant_competitions').insert(inserts);
            if (error) throw error;
            showToast(`Successfully enrolled ${newIds.length} students!`, 'success');
            
        } else if (action === 'remove') {
            // FIX: Loose equality
            const removeIds = selectedIds.filter(id => globalAssignments.find(a => a.competition_id == compId && a.participant_id == id));
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
        const teamName = document.getElementById('team-name-title').innerText || 'MY TEAM';

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML(`${teamName} - Participant Directory`);

        let tableRows = globalStudents.map((p, index) => {
            const enrollCount = globalAssignments.filter(a => a.participant_id === p.id).length;
            return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${p.name}</td>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${p.dob || 'N/A'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 700;">${enrollCount}</td>
            </tr>
        `}).join('');

        if (globalStudents.length === 0) {
            tableRows = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748B;">No students found in this team.</td></tr>';
        }

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">
                        <th style="padding: 12px;">#</th>
                        <th style="padding: 12px;">UNIQUE ID</th>
                        <th style="padding: 12px;">NAME</th>
                        <th style="padding: 12px;">DOB</th>
                        <th style="padding: 12px; text-align: center;">EVENTS ENROLLED</th>
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
        container.innerHTML = getPDFHeaderHTML(`${teamName} - Master Program List`);
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
            container.innerHTML += '<p style="text-align: center; color: #64748B; padding: 2rem;">No enrollments found for this team.</p>';
        } else {
            sortedComps.forEach(c => {
                let pRows = c.participants.sort((a,b) => a.name.localeCompare(b.name)).map((p, i) => `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; width: 40px;">${i + 1}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.id}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${p.name} ${p.is_leader ? '<span style="color: #10B981; font-size:10px; font-weight:800; background: #ECFDF5; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">LEADER</span>' : ''}</td>
                    </tr>
                `).join('');

                container.innerHTML += `
                    <div style="margin-bottom: 25px; page-break-inside: avoid;">
                        <div style="background: #1E293B; color: white; padding: 12px; border-radius: 8px 8px 0 0;">
                            <h3 style="margin: 0; font-size: 15px; text-transform: uppercase;">${c.compName}</h3>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #CBD5E1; text-transform: uppercase; font-weight: 600;">CATEGORY: ${c.category} | STAGE: ${c.stage}</p>
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


function getPDFHeaderHTML(reportTitle) {
    const cachedBranding = JSON.parse(localStorage.getItem('festBranding') || JSON.stringify(window.systemBranding || {}));
    const validName = cachedBranding.fest_name && cachedBranding.fest_name.trim() !== '';
    const validLogo = cachedBranding.fest_logo && cachedBranding.fest_logo.trim() !== '';
    const displayMode = cachedBranding.display_mode || 'both';
    
    let brandHtml = '';
    
    const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
    const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
    
    if (showLogo) {
        brandHtml += `<img src="${cachedBranding.fest_logo}" style="height: 60px; max-width: 250px; object-fit: contain; margin-bottom: 12px; border-radius: 8px;">`;
    }
    
    if (showName) {
        brandHtml += `<h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 26px; text-transform: uppercase; font-weight: 800;">${validName ? cachedBranding.fest_name : 'FESTOS'}</h1>`;
    } else if (validLogo && !showName) {
        brandHtml += `<div style="height: 10px;"></div>`;
    }

    return `
        <div style="text-align: center; margin-bottom: 30px;">
            ${brandHtml}
            <h2 style="color: #1E293B; font-size: 18px; margin-top:0; text-transform: uppercase;">${reportTitle}</h2>
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

// Boot
document.addEventListener('DOMContentLoaded', initDashboard);

// ==========================================
// TM SCHEDULE VIEWER
// ==========================================

function populateSchedCatFilter() {
    const catFilter = document.getElementById('filter-schedule-cat');
    const stageFilter = document.getElementById('filter-schedule-stage');
    
    if(catFilter && catFilter.options.length <= 1) {
        const catSet = new Set();
        const stageSet = new Set();
        
        globalComps.forEach(c => {
            if(tmScheduleData[c.id] && tmScheduleData[c.id].status === 'published') {
                catSet.add(JSON.stringify({ id: c.category_id, name: c.categories?.name || 'UNCATEGORIZED' }));
                stageSet.add(JSON.stringify({ id: c.stage_id, name: c.stages?.name || 'OFFSTAGE' }));
            }
        });
        
        Array.from(catSet).map(JSON.parse).forEach(cat => catFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`);
        Array.from(stageSet).map(JSON.parse).forEach(stage => stageFilter.innerHTML += `<option value="${stage.id}">${stage.name}</option>`);
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
        if (catFilter !== 'all' && c.category_id != catFilter) return false;
        if (stageFilter !== 'all' && c.stage_id != stageFilter) return false;
        if (search && !c.name.toLowerCase().includes(search) && !catName.toLowerCase().includes(search)) return false;
        
        return true;
    });

    scheduledComps.sort((a,b) => {
        const sA = tmScheduleData[a.id];
        const sB = tmScheduleData[b.id];
        if (sA.date !== sB.date) return sA.date.localeCompare(sB.date);
        return sA.time.localeCompare(sB.time);
    });

    if(scheduledComps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">NO PUBLISHED SCHEDULES FOUND.</td></tr>`;
        return;
    }

    scheduledComps.forEach(comp => {
        const sched = tmScheduleData[comp.id];
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        const stageName = comp.is_offstage ? 'OFFSTAGE' : (comp.stages?.name || 'TBD');
        
        const clashes = compConflictMap[comp.id] || [];
        let clashBadge = '';
        if (clashes.length > 0) {
            const names = clashes.map(c => c.student.name).join(', ');
            clashBadge = `<br><span class="badge" style="background:#FEE2E2; color:#DC2626; border:1px solid #FCA5A5; font-weight:700; margin-top:4px; display:inline-flex; align-items:center; gap:4px;" title="Clash for: ${names}"><i class="fa-solid fa-triangle-exclamation"></i> Student Overlap (${clashes.length})</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td data-label="DATE" style="font-weight: 700; color: var(--primary);">${sched.date}</td>
                <td data-label="FROM TIME" style="font-weight: 700;">${sched.time}</td>
                <td data-label="TO TIME" style="font-weight: 700; color: var(--text-muted);">${sched.to_time || '-'}</td>
                <td data-label="EVENT NAME" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem;">${comp.name} ${clashBadge}</td>
                <td data-label="STAGE"><span style="font-weight: 600; color: var(--primary);"><i class="fa-solid fa-microphone-stage" style="margin-right: 4px;"></i> ${stageName}</span></td>
                <td data-label="CATEGORY"><span class="badge badge-gray">${catName}</span></td>
            </tr>
        `;
    });
}

async function exportTMSchedulePDF() {
    showToast('Generating Schedule PDF...', 'success');
    const search = document.getElementById('search-schedule').value.toLowerCase();
    const catFilter = document.getElementById('filter-schedule-cat').value;
    const stageFilter = document.getElementById('filter-schedule-stage').value;

    const scheduledComps = globalComps.filter(c => {
        const sched = tmScheduleData[c.id];
        if (!sched || sched.status !== 'published') return false;
        if (catFilter !== 'all' && c.category_id != catFilter) return false;
        if (stageFilter !== 'all' && c.stage_id != stageFilter) return false;
        if (search && !c.name.toLowerCase().includes(search)) return false;
        return true;
    }).sort((a,b) => {
        if (tmScheduleData[a.id].date !== tmScheduleData[b.id].date) return tmScheduleData[a.id].date.localeCompare(tmScheduleData[b.id].date);
        return tmScheduleData[a.id].time.localeCompare(tmScheduleData[b.id].time);
    });

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML(`Event Schedule`);

    let tableRows = scheduledComps.map((c, i) => {
        const sched = tmScheduleData[c.id];
        const stageName = c.is_offstage ? 'OFFSTAGE' : (c.stages?.name || 'TBD');
        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${sched.date}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${sched.time}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A;">${c.name.toUpperCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #4F46E5; font-weight: 600;">${stageName.toUpperCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${(c.categories?.name || 'GENERAL').toUpperCase()}</td>
        </tr>
    `}).join('');

    container.innerHTML += `
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
            <thead><tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;"><th style="padding: 10px;">DATE</th><th style="padding: 10px;">TIME</th><th style="padding: 10px;">EVENT NAME</th><th style="padding: 10px;">STAGE</th><th style="padding: 10px;">CATEGORY</th></tr></thead>
            <tbody style="font-size: 12px; color: #334155;">${tableRows}</tbody>
        </table>
    `;

    const opt = { margin: 10, filename: `Schedule.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
}

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
    
    const search = document.getElementById('vacancySearchInput').value.toLowerCase();
    const catFilter = document.getElementById('vacancyCategoryFilter').value;
    
    const filtered = tmVacancyData.filter(v => {
        const matchName = v.name.toLowerCase().includes(search);
        const matchCat = catFilter === '' || String(v.category_id) === String(catFilter);
        return matchName && matchCat;
    });

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML(`My Team Vacancy Audit`);

    let tableRows = filtered.map((v, i) => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${i + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A;">${v.name.toUpperCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${v.categoryName.toUpperCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 800; color: #4F46E5;">${v.enrolled} / ${v.limit}</td>
            <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 800; color: #EF4444;">${v.balance} OPEN</td>
        </tr>
    `).join('');

    container.innerHTML += `
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
            <thead>
                <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                    <th style="padding: 10px;">#</th><th style="padding: 10px;">COMPETITION</th><th style="padding: 10px;">CATEGORY</th><th style="padding: 10px; text-align: center;">ENROLLED / TOTAL</th><th style="padding: 10px; text-align: center;">BALANCE (VACANCY)</th>
                </tr>
            </thead>
            <tbody style="font-size: 12px; color: #334155;">${tableRows}</tbody>
        </table>
    `;

    const opt = { margin: 10, filename: `Team_Vacancy_Audit.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(container).save().then(() => showToast('Vacancy PDF Exported!'));
}

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================
function applyGlobalBranding(brandingData) {
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
    
    const festName = validName ? brandingData.fest_name : 'FestOS';
    document.title = `${festName} | Team Manager`;

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
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 36px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: 10px; display: inline-block; vertical-align: middle;">`;
        } else {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // CRITICAL FIX: Hide text if this container is inside the sidebar
        if (!container.closest('.sidebar')) {
            html += `<span style="letter-spacing: -0.5px; display: inline-block; vertical-align: middle;">${festName} TM</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        
        // Center the logo nicely in the sidebar since it no longer has text next to it
        if (container.closest('.sidebar')) {
            container.style.justifyContent = 'center';
            container.style.marginBottom = '2rem';
        }
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
        let enrolled = globalAssignments.filter(a => a.competition_id === comp.id);
        enrolled.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0));
        
        let studentsHtml = '';
        if (enrolled.length === 0) {
            studentsHtml = '<span style="color: var(--warning); font-size: 0.8rem; font-weight: 700; background: var(--warning-light); padding: 4px 8px; border-radius: 6px;">NO STUDENTS ENROLLED</span>';
        } else {
            studentsHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">';
            enrolled.forEach((a, index) => {
                const student = globalStudents.find(s => s.id === a.participant_id);
                if (!student) return;
                
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
                            <strong style="color: var(--text-main); font-size: 0.95rem;">${student.name}</strong>
                            <span style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; margin-left: 4px;">${student.unique_id}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-main); padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${student.categories?.name || 'GEN'}</span>
                        </div>
                        <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; min-height: auto; border-color: var(--danger); color: var(--danger); border-radius: 6px; width: auto; flex-shrink: 0;" onclick="quickRemoveStudent('${comp.id}', '${student.id}')"><i class="fa-solid fa-xmark"></i></button>
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
    let myEnrolled = globalAssignments.filter(a => a.competition_id === compId);
    myEnrolled.forEach(a => { a.is_leader = (a.participant_id === newLeaderId); });
    
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
            const recordIndex = globalAssignments.findIndex(a => a.competition_id === compId && a.participant_id === studentId);
            if (recordIndex > -1) {
                // If we remove the leader, transfer leadership to the next person automatically
                const wasLeader = globalAssignments[recordIndex].is_leader;
                globalAssignments.splice(recordIndex, 1);
                
                if (wasLeader) {
                    const remaining = globalAssignments.filter(a => a.competition_id === compId);
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
    const comp = globalComps.find(c => c.id === compId);
    if (!comp) return;

    // Filter Eligible Students
    const eligibleStudents = globalStudents.filter(student => {
        if (student.category_id == comp.category_id) return true;
        if (comp.categories?.is_general) {
            const studentCategory = globalCategories.find(c => c.id == student.category_id);
            if (studentCategory) {
                let allowedCats = [];
                try {
                    let rawAllowed = studentCategory.allowed_general_categories;
                    if (typeof rawAllowed === 'string') allowedCats = JSON.parse(rawAllowed);
                    else if (Array.isArray(rawAllowed)) allowedCats = rawAllowed;
                } catch(e) {}
                if (allowedCats.some(id => id == comp.category_id)) return true;
            }
        }
        return false;
    });

    const enrolledIds = globalAssignments.filter(a => a.competition_id === compId).map(a => a.participant_id);
    window.tempAvailableStudents = eligibleStudents.filter(s => !enrolledIds.includes(s.id));
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
            const existingGroup = globalAssignments.filter(a => a.competition_id === window.tempCompId);
            const isGroup = window.tempIsGroup;
            const groupId = isGroup ? (existingGroup.length > 0 ? existingGroup[0].group_id : `GRP_${window.tempCompId}_${myTeamId}_${Date.now()}`) : null;
            
            // If a leader already exists in the enrolled data, DO NOT assign a new leader.
            const hasExistingLeader = existingGroup.some(a => a.is_leader);

            const payload = window.tempSelectedStudents.map((s, index) => ({
                participant_id: s.id,
                competition_id: window.tempCompId,
                group_id: groupId,
                is_leader: isGroup && !hasExistingLeader && index === 0
            }));

            const { data, error } = await supabaseClient.from('participant_competitions').insert(payload).select();
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
}