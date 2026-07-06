const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || (user.role !== 'admin' && user.role !== 'master_admin')) {
    window.location.href = 'index.html';
}

// Global cached data for dropdowns
let categoriesList = [];
let stagesList = [];
let teamsList = [];
let participantsList = [];
let competitionsList = [];
let availableControllers = [];
let currentCropper = null; // Added for image cropping

// --- UI UTILITIES (PREMIUM UPGRADES) ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }
}

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

// --- CORE NAVIGATION & LOGOUT ---
function switchTab(tabId) {
    // Hide all sections and un-highlight nav items
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    
    // Show active section
    document.getElementById(tabId).classList.add('active');
    const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if(activeNav) {
        activeNav.classList.add('active');
        const pageTitle = document.getElementById('page-title');
        if(pageTitle) pageTitle.innerText = activeNav.innerText.trim();
    }

    // Auto-close sidebar on mobile
    if(window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.querySelector('.mobile-overlay')?.classList.remove('open');
    }

    // Trigger specific data loads with error handling
    try {
        if (tabId === 'categories') loadCategories();
        else if (tabId === 'competitions') loadCompetitions();
        else if (tabId === 'participants') loadParticipants();
        else if (tabId === 'stages') loadStagesAndTeams();
        else if (tabId === 'users') loadUsers();
        else if (tabId === 'assignments') initAssignWorkspace();
        else if (tabId === 'direct-valuation') initDirectValuation();
        else if (tabId === 'point-settings') loadPointSettings(); // ADD THIS LINE
        else if (tabId === 'branding-settings') loadBrandingSettings();
        else if (tabId === 'participant-points') loadParticipantPoints();
    } catch (e) {
        showToast("Failed to fetch dashboard data.", "error");
    }
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

// --- CATEGORIES ---
async function loadCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('categories')
            .select('*, participants(count), competitions(count)')
            .order('name');
            
        if(error) throw error;
        categoriesList = data || [];
        
        const tbody = document.getElementById('categories-tbody');
        tbody.innerHTML = '';
        
        categoriesList.forEach(cat => {
            const partCount = cat.participants[0]?.count || 0;
            const compCount = cat.competitions[0]?.count || 0;
            tbody.innerHTML += `
                <tr>
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${cat.id}"></td>
                    <td>${cat.name}</td>
                    <td>${cat.is_general ? '<span class="badge badge-primary">General</span>' : 'Standard'}</td>
                    <td><span class="badge-count" onclick="viewRelationalData('participants', 'category_id', '${cat.id}')">${partCount} Students</span></td>
                    <td><span class="badge-count" onclick="viewRelationalData('competitions', 'category_id', '${cat.id}')">${compCount} Competitions</span></td>
                    <td>
                        <button class="btn btn-outline" onclick='openCategoryModal(${JSON.stringify(cat)})'><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger" onclick="deleteCategory('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        // Persist filter state after reload
        if (typeof filterCategoriesTable === 'function') filterCategoriesTable();
    } catch(e) { showToast(e.message, 'error'); }
}

// Function to handle viewing counts in a popup
async function viewRelationalData(fetchTable, filterColumn, filterId, displayColumn = 'name') {
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

// 1. Update the modal function to accept data
function openCategoryModal(editData = null) {
    // If editData exists, we populate the fields. If not, they are blank.
    const isEdit = !!editData;
    const catId = isEdit ? editData.id : '';
    const catName = isEdit ? editData.name : '';
    const isGeneral = isEdit ? editData.is_general.toString() : 'false';

    openModal(isEdit ? 'Edit Category' : 'Create Category', `
        <input type="hidden" id="catId" value="${catId}">
        <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="catName" value="${catName}" placeholder="E.G. SENIOR SECONDARY">
        </div>
        <div class="form-group">
            <label>Type</label>
            <select id="catGeneral">
                <option value="false" ${isGeneral === 'false' ? 'selected' : ''}>Standard (Limits apply)</option>
                <option value="true" ${isGeneral === 'true' ? 'selected' : ''}>General (Anyone can participate)</option>
            </select>
        </div>
    `, saveCategory);
}

// 2. Update the save function to Upsert
async function saveCategory() {
    const id = document.getElementById('catId').value; // Check if we are editing
    const name = document.getElementById('catName').value;
    const is_general = document.getElementById('catGeneral').value === 'true';
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { name, is_general };
        if (id) payload.id = id; // If ID exists, Supabase will update instead of insert

        const { error } = await supabaseClient.from('categories').upsert([payload]);
        if (error) throw error;
        
        showToast(id ? 'Category updated!' : 'Category created!');
        closeModal(); 
        loadCategories();
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}

async function deleteCategory(id) {
    if(confirm("Delete this category? This might fail if competitions are linked to it.")) {
        try {
            const { error } = await supabaseClient.from('categories').delete().eq('id', id);
            if(error) throw error;
            showToast('Category deleted.');
            loadCategories();
        } catch(e) { showToast(e.message, 'error'); }
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
const compRowsPerPage = 10;
let filteredCompetitionsList = []; 

async function loadCompetitions() {
    try {
        if (stagesList.length === 0) { const { data } = await supabaseClient.from('stages').select('*'); stagesList = data || []; }
        if (categoriesList.length === 0) await loadCategories();

        const { data, error } = await supabaseClient
            .from('competitions')
            .select(`*, categories(name), stages(name)`)
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

        filterCompetitions(false); 
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
        const studentCount = "?"; // Placeholder for foreign key count
        
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${comp.id}"></td>
                <td>${comp.name}</td>
                <td><span class="badge badge-primary">${comp.categories?.name || 'N/A'}</span></td>
                <td>${comp.stages?.name || 'Unassigned'}</td>
                
                <!-- FIX: Added the missing Max Marks column data -->
                <td style="font-weight: 700; color: var(--text-main);">${comp.max_mark || '0'}</td>
                
                <td>
                    <span class="badge-count" onclick="viewCompParticipants('${comp.id}')">
                        ${studentCount} / ${comp.max_participants} Limit
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openCompModal(${JSON.stringify(comp).replace(/'/g, "&apos;")})'><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteCompetition('${comp.id}')"><i class="fa-solid fa-trash"></i></button>
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

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
            Showing ${startNum} to ${endNum} of ${filteredCompetitionsList.length} entries
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

// Generates a Premium PDF Directory for Competitions
async function exportCompetitionsPDF() {
    showToast('Generating Competitions PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 28px;">FEST 2026</h1>
                <h2 style="color: #1E293B; font-size: 18px; margin-top:0;">COMPETITIONS DIRECTORY</h2>
                <p style="color: #64748B; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
            </div>
        `;

        // Map over the filtered list to respect any current search criteria
        let tableRows = filteredCompetitionsList.map((comp, index) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${comp.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.categories?.name || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.stages?.name || 'Unassigned'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.max_mark || '0'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.max_participants || '0'}</td>
            </tr>
        `).join('');

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">COMPETITION</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">STAGE</th>
                        <th style="padding: 10px;">MAX MARKS</th>
                        <th style="padding: 10px;">LIMIT</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: `Fest_Competitions.pdf`, 
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
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select('participants(name, unique_id)')
            .eq('competition_id', compId);
            
        if (error) throw error;
        
        const tbody = document.getElementById('listModalTable');
        tbody.innerHTML = `<tr><th>PARTICIPANT NAME</th></tr>`; 
        
        if (!data || data.length === 0) tbody.innerHTML += `<tr><td style="color:var(--text-muted);">No students assigned.</td></tr>`;
        
        data.forEach(item => {
            tbody.innerHTML += `<tr><td>${item.participants?.name} (${item.participants?.unique_id})</td></tr>`;
        });
        
        document.getElementById('listModalTitle').innerText = `Enrolled Students`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { showToast(e.message, 'error'); }
}

function openCompModal(editData = null) {
    const isEdit = !!editData;
    const cId = isEdit ? editData.id : '';
    const cName = isEdit ? editData.name : '';
    const cMarks = isEdit ? editData.max_mark : '100';
    const cLimit = isEdit ? editData.max_participants : '1';
    const cIsGroup = isEdit ? editData.is_group : false; // NEW

    let catOpts = categoriesList.map(c => `<option value="${c.id}" ${isEdit && editData.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    let stageOpts = stagesList.map(s => `<option value="${s.id}" ${isEdit && editData.stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    openModal(isEdit ? 'Edit Competition' : 'New Competition', `
        <input type="hidden" id="compId" value="${cId}">
        <div class="form-group"><label>Competition Name</label><input type="text" id="compName" value="${cName}"></div>
        
        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
            <input type="checkbox" id="compIsGroup" ${cIsGroup ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--primary); cursor: pointer;">
            <label for="compIsGroup" style="margin: 0; color: var(--primary); font-weight: 700; cursor: pointer;">Group Competition</label>
        </div>

        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Category</label><select id="compCategory">${catOpts}</select></div>
            <div class="form-group" style="flex:1;"><label>Stage</label><select id="compStage"><option value="">-- NO STAGE YET --</option>${stageOpts}</select></div>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Max Marks</label><input type="number" id="compMarks" value="${cMarks}"></div>
            <div class="form-group" style="flex:1;"><label>Participants / Team</label><input type="number" id="compParticipants" value="${cLimit}"></div>
        </div>
    `, saveCompetition);
}

async function saveCompetition() {
    const id = document.getElementById('compId').value;
    const name = document.getElementById('compName').value;
    const category_id = document.getElementById('compCategory').value;
    const stage_id = document.getElementById('compStage').value || null;
    const max_mark = document.getElementById('compMarks').value;
    const max_participants = document.getElementById('compParticipants').value;
    const is_group = document.getElementById('compIsGroup').checked; // NEW
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { name, category_id, stage_id, max_mark, max_participants, is_group }; // UPDATED
        if (id) payload.id = id;

        const { error } = await supabaseClient.from('competitions').upsert([payload]);
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
async function deleteCompetition(id) {
    if(confirm("Delete this competition?")) {
        try {
            const { error } = await supabaseClient.from('competitions').delete().eq('id', id);
            
            if (error) {
                // 23503 is the PostgreSQL error code for foreign key violations
                if (error.code === '23503') {
                    throw new Error('Cannot delete this competition because it has enrolled students or recorded marks. Remove them first.');
                }
                throw error;
            }
            
            showToast('Competition deleted.');
            loadCompetitions();
        } catch(e) { 
            showToast(e.message, 'error'); 
        }
    }
}

// --- STAGES & TEAMS MANAGEMENT ---
// --- NEW FRONTEND CONFIRMATION LOGIC ---
function openConfirmModal(title, text, confirmCallback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    
    // Assign the execution function to the button
    confirmBtn.onclick = () => {
        document.getElementById('confirmModal').classList.remove('show');
        if (confirmCallback) confirmCallback();
    };
    
    document.getElementById('confirmModal').classList.add('show');
}

// --- STAGES & TEAMS MANAGEMENT ---
async function loadStagesAndTeams() {
    try {
        // Load Stages with Competition Counts
        const { data: stages, error: stageError } = await supabaseClient
            .from('stages')
            .select(`*, users(username), competitions(count)`)
            .order('stage_no');
        if(stageError) throw stageError;
        
        stagesList = stages || [];
        const stbody = document.getElementById('stages-tbody');
        stbody.innerHTML = '';
        
        stagesList.forEach(s => {
            const compCount = s.competitions[0]?.count || 0;
            stbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${s.name}</strong><br>
                        <small style="color:var(--text-muted)">CONTROLLER: ${s.users?.username || 'NONE'}</small>
                    </td>
                    <td>STAGE ${s.stage_no}</td>
                    <td><span class="badge-count" onclick="viewRelationalData('competitions', 'stage_id', '${s.id}')">${compCount} COMPS</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openStageModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' title="Edit Stage"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteStage('${s.id}', '${s.name}')" title="Delete Stage"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Load Teams WITH Participant Counts AND User Portal Details
        const { data: teams, error: teamError } = await supabaseClient
            .from('teams')
            .select('*, participants(count), users(username, password_hash)')
            .order('name');
        if(teamError) throw teamError;
        
        teamsList = teams || [];
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
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteTeam('${t.id}', '${t.name}')" title="Delete Team"><i class="fa-solid fa-trash"></i></button>
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
            const { data } = await supabaseClient.from('users').select('*').eq('role', 'stage_controller');
            availableControllers = data || [];
        }
        
        const isEdit = !!editData;
        const sId = isEdit ? editData.id : '';
        const sName = isEdit ? editData.name : '';
        const sNo = isEdit ? editData.stage_no : '1';
        
        let controllerOpts = availableControllers.map(c => 
            `<option value="${c.id}" ${isEdit && editData.controller_id === c.id ? 'selected' : ''}>${c.username}</option>`
        ).join('');
        
        openModal(isEdit ? 'Edit Stage' : 'Add Stage', `
            <input type="hidden" id="stageId" value="${sId}">
            <div class="form-group"><label>Stage Name</label><input type="text" id="stageName" value="${sName}"></div>
            <div class="form-group"><label>Stage Number (ID)</label><input type="number" id="stageNo" value="${sNo}"></div>
            <div class="form-group"><label>Assign Controller</label><select id="stageController"><option value="">-- SELECT CONTROLLER --</option>${controllerOpts}</select></div>
        `, async () => {
            const id = document.getElementById('stageId').value;
            const name = document.getElementById('stageName').value;
            const stage_no = document.getElementById('stageNo').value;
            const controller_id = document.getElementById('stageController').value || null;
            
            if(!name || !stage_no) return showToast('Name and Number required', 'error');
            
            setLoading('modalSaveBtn', true);
            const payload = { name, stage_no, controller_id };
            if (id) payload.id = id;

            const { error } = await supabaseClient.from('stages').upsert([payload]);
            setLoading('modalSaveBtn', false);
            
            if(error) showToast(error.message, 'error'); 
            else { showToast(id ? 'Stage updated!' : 'Stage added!'); closeModal(); loadStagesAndTeams(); }
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
        const { data: savedTeam, error } = await supabaseClient.from('teams').upsert([payload]).select();
        setLoading('modalSaveBtn', false);
        
        if(error) {
            showToast(error.message, 'error'); 
        } else { 
            // AUTO-CREATE MANAGER USER IF THIS IS A NEW TEAM
            if (!id && savedTeam && savedTeam.length > 0) {
                const teamId = savedTeam[0].id;
                // Generates a username like "falcons_mgr"
                const autoUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_mgr';
                
                await supabaseClient.from('users').insert([{
                    username: autoUsername,
                    password_hash: 'fest2026', // Default password
                    role: 'team_manager',
                    team_id: teamId // Make sure 'team_id' column exists in your users table!
                }]);
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
const partRowsPerPage = 10;
let filteredParticipantsList = [];

async function loadParticipants() {
    try {
        if (categoriesList.length === 0) await loadCategories();
        if (teamsList.length === 0) { const { data } = await supabaseClient.from('teams').select('*'); teamsList = data || []; }

        const { data, error } = await supabaseClient.from('participants').select(`*, categories(name), teams(name)`).order('name');
        if(error) throw error;
        
        participantsList = data || []; 
        filteredParticipantsList = [...participantsList];
        
        const catFilter = document.getElementById('filterCategory');
        if(catFilter && catFilter.options.length === 1) {
            categoriesList.forEach(c => catFilter.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // Populate new Team Filter
        const teamFilter = document.getElementById('filterPartTeam');
        if(teamFilter && teamFilter.options.length === 1) {
            teamsList.forEach(t => teamFilter.innerHTML += `<option value="${t.name}">${t.name}</option>`);
        }

        // --- ADD THIS LINE HERE ---
        initBulkTeamControls();
        // --------------------------

        partCurrentPage = 1;
        renderParticipantsTable();
    } catch(e) { showToast(e.message, 'error'); }
}
function filterParticipants(resetPage = true) {
    const query = document.getElementById('searchPartInput').value.toLowerCase();
    const catFilter = document.getElementById('filterCategory').value;
    
    const teamFilter = document.getElementById('filterPartTeam') ? document.getElementById('filterPartTeam').value : "";
    const batchFilter = document.getElementById('filterPartBatch') ? document.getElementById('filterPartBatch').value : "";
    
    filteredParticipantsList = participantsList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        
        const partCatName = p.categories?.name || '';
        const matchCat = catFilter === "" || partCatName === catFilter;
        
        const partTeamName = p.teams?.name || '';
        const matchTeam = teamFilter === "" || partTeamName === teamFilter;
        
        const matchBatch = batchFilter === "" || (p.batch_no && p.batch_no.toString() === batchFilter);
        
        return matchName && matchCat && matchTeam && matchBatch;
    });
    
    if (resetPage) partCurrentPage = 1; 
    renderParticipantsTable();
}

function renderParticipantsTable() {
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    const start = (partCurrentPage - 1) * partRowsPerPage;
    const end = start + partRowsPerPage;
    const pageData = filteredParticipantsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No participants found.</td></tr>`;
    }

    pageData.forEach(p => {
        const safeData = JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        const photoSrc = p.photo_url ? p.photo_url : 'https://via.placeholder.com/150/E5E7EB/6B7280?text=NO+PHOTO';
        
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}"></td>
                <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${p.unique_id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${photoSrc}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0;">
                        <span>${p.name}</span>
                    </div>
                </td>
                <td><span class="badge" style="background:#F1F5F9; color:#475569;">${p.teams?.name || 'UNASSIGNED'}</span></td>
                <td>${p.categories?.name || 'N/A'}</td>
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

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
            Showing ${startNum} to ${endNum} of ${filteredParticipantsList.length} entries
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
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 28px;">FEST 2026</h1>
                <h2 style="color: #1E293B; font-size: 18px; margin-top:0;">PARTICIPANTS DIRECTORY</h2>
                <p style="color: #64748B; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
            </div>
        `;

        // Map over the filtered list to respect any active search criteria
        let tableRows = filteredParticipantsList.map((p, index) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.teams?.name || 'UNASSIGNED'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.categories?.name || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.batch_no || '1'}</td>
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
                        <th style="padding: 10px;">BATCH</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: `Fest_Participants.pdf`, 
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
            "BATCH NO": p.batch_no || '1'
        }));

        const blob = new Blob([Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute("download", `Fest_Participants_Data.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
        showToast('CSV Exported Successfully!');
    } catch (e) { showToast(e.message, 'error'); }
}

function viewParticipantCard(p) {
    const teamName = p.teams ? p.teams.name : 'UNASSIGNED';
    const catName = p.categories ? p.categories.name : 'GENERAL';
    const photoSrc = p.photo_url ? p.photo_url : 'https://via.placeholder.com/150/E5E7EB/6B7280?text=NO+PHOTO';
    
    document.getElementById('listModalTitle').innerText = 'Participant Profile';
    document.getElementById('listModalTable').innerHTML = `
        <div style="display: flex; gap: 1.5rem; align-items: flex-start; text-transform: uppercase; padding: 1rem;">
            <img src="${photoSrc}" style="width: 130px; height: 195px; object-fit: cover; border-radius: 12px; border: 3px solid var(--border); box-shadow: var(--shadow-sm);">
            <div style="flex: 1;">
                <h3 style="font-size: 1.5rem; margin-bottom: 0.25rem; font-weight: 800; color: var(--primary);">${p.name}</h3>
                <p style="font-family: monospace; font-size: 1rem; margin-bottom: 1.5rem; font-weight: 600; color: var(--text-muted);">${p.unique_id}</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1rem;">
                    <div><strong style="font-size: 0.75rem; color: var(--text-muted);">TEAM</strong><br><span style="font-weight:600;">${teamName}</span></div>
                    <div><strong style="font-size: 0.75rem; color: var(--text-muted);">CATEGORY</strong><br><span style="font-weight:600;">${catName}</span></div>
                    <div><strong style="font-size: 0.75rem; color: var(--text-muted);">BATCH NO</strong><br><span style="font-weight:600;">${p.batch_no || '1'}</span></div>
                    <div>
                        <strong style="font-size: 0.75rem; color: var(--text-muted);">COMPETITIONS</strong><br>
                        <!-- Updated to use the new join function -->
                        <button class="badge-count" style="margin-top:0.35rem; border:none;" onclick="viewParticipantEnrollments('${p.id}')">VIEW ENROLLMENTS</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('listModal').classList.add('show');
}

// NEW FUNCTION: specifically joins competitions and categories to the participant
async function viewParticipantEnrollments(participantId) {
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

function openParticipantModal(editData = null) {
    let catOpts = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let teamOpts = teamsList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    const isEdit = !!editData;
    const pId = isEdit ? editData.id : '';
    const pName = isEdit ? editData.name : '';
    const pBatch = isEdit ? editData.batch_no : '1';
    
    // NEW: Capture the existing unique_id
    const pUniqueId = isEdit ? editData.unique_id : '';
    
    const pPhoto = isEdit && editData.photo_url ? editData.photo_url : 'https://via.placeholder.com/150/EEF2FF/6366F1?text=PHOTO';

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
                
                <div class="photo-actions">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('partPhoto').click()" title="Upload New Photo">
                        <i class="fa-solid fa-upload"></i> New
                    </button>
                    <button type="button" class="btn btn-outline" onclick="editExistingCrop()" title="Adjust Current Crop">
                        <i class="fa-solid fa-crop-simple"></i> Crop
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
                        <select id="partCategory">${catOpts}</select>
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 100px;">
                        <label>Batch No</label>
                        <input type="number" id="partBatch" min="1" max="7" value="${pBatch}">
                    </div>
                </div>
            </div>
        </div>
    `;

    openModal(isEdit ? 'Edit Participant' : 'Register Participant', modalHtml, saveParticipant);

    if (isEdit) {
        if(editData.team_id) document.getElementById('partTeam').value = editData.team_id;
        if(editData.category_id) document.getElementById('partCategory').value = editData.category_id;
    }
}
async function saveParticipant() {
    const id = document.getElementById('partId').value;
    const name = document.getElementById('partName').value;
    const team_id = document.getElementById('partTeam').value || null;
    const category_id = document.getElementById('partCategory').value;
    const batch_no = document.getElementById('partBatch').value;
    
    // Grab the existing unique_id if editing, otherwise generate a new one
    let unique_id = document.getElementById('partUniqueId').value;
    if (!id || !unique_id) {
        unique_id = `FEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    }
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    
    try {
        let photo_url = undefined; 

        if (currentCropper) {
            showToast('Processing image...', 'success');
            
            const canvas = currentCropper.getCroppedCanvas({
                width: 400, 
                height: 600
            });
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const fileName = `profile_${Date.now()}.jpg`; 
            
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });
                
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('photos')
                .getPublicUrl(fileName);
                
            photo_url = publicUrlData.publicUrl;
        }

        // Build the payload (unique_id is now ALWAYS included)
        const payload = { name, team_id, category_id, batch_no, unique_id };
        if (id) payload.id = id; 
        if (photo_url) payload.photo_url = photo_url; 

        const { error } = await supabaseClient.from('participants').upsert([payload]);
        if (error) throw error;
        
        showToast(id ? 'Participant updated!' : 'Participant registered successfully!');
        
        if(currentCropper) { currentCropper.destroy(); currentCropper = null; }
        
        closeModal(); 
        
        // Use the paginated render function to refresh the view correctly
        loadParticipants();
        
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}
async function deleteParticipant(id) {
    if(confirm("Are you sure you want to delete this participant?")) {
        try {
            const { error } = await supabaseClient.from('participants').delete().eq('id', id);
            if(error) throw error;
            showToast('Participant removed.');
            loadParticipants();
        } catch(e) { showToast(e.message, 'error'); }
    }
}

// --- USER MANAGEMENT ---
async function loadUsers() {
    try {
        // Updated query to fetch the associated team name
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, username, role, password_hash, teams(name)')
            .neq('role', 'master_admin')
            .order('role');
            
        if(error) throw error;
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        
        (data || []).forEach(u => {
            const roleDisplay = u.role.replace('_', ' ').toUpperCase();
            
            // Generate a small team tag if the user belongs to a team
            const teamTag = u.teams?.name ? `<br><span style="font-size: 0.75rem; color: var(--primary); font-weight: 800; letter-spacing: 0.05em;">TEAM: ${u.teams.name.toUpperCase()}</span>` : '';
            
            const safeData = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            tbody.innerHTML += `
                <tr>
                    <td>
                        <strong style="font-size:1.05rem;">${u.username}</strong>
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
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteUser('${u.id}', '${u.username}')" title="Delete User"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { showToast(e.message, 'error'); }
}
// New helper function to toggle password visibility
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
    const uName = isEdit ? editData.username : '';
    const uPass = isEdit ? editData.password_hash : '';
    const uRole = isEdit ? editData.role : 'judge';

    openModal(isEdit ? 'Edit Staff Account' : 'Create Staff Account', `
        <input type="hidden" id="editUserId" value="${uId}">
        
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" value="${uName}" autocomplete="off"></div>
        
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
        const username = document.getElementById('newUsername').value.trim();
        const password_hash = document.getElementById('newPassword').value.trim();
        const role = document.getElementById('newUserRole').value;
        
        if (!username || !password_hash) return showToast('Username and Password required.', 'error');
        
        setLoading('modalSaveBtn', true);
        
        const payload = { username, password_hash, role };
        if (id) payload.id = id;
        
        const { error } = await supabaseClient.from('users').upsert([payload]);
        
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
async function deleteUser(id, username) {
    if (confirm(`Delete the user "${username}"? This cannot be undone.`)) {
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
    }
}

// --- CSV BULK UPLOAD EXPORT (PapaParse) ---
async function downloadCSV(tableName) {
    try {
        const { data, error } = await supabaseClient.from(tableName).select('*');
        if (error) throw error;
        
        const blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute("download", `${tableName}_export.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
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
                if (tableName === 'participants' && !row.unique_id) row.unique_id = `FEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
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
    // Added 'admin' to the permitted roles for the cross-portal menu
    if (user && (user.role === 'master_admin' || user.role === 'admin')) {
        const portalMenu = document.getElementById('master-admin-portals');
        if (portalMenu) portalMenu.style.display = 'block';
    }
    
    loadCategories();
    
    // Check for cached branding and apply it immediately
    const cachedBranding = localStorage.getItem('festBranding');
    if (cachedBranding) {
        applyGlobalBranding(JSON.parse(cachedBranding));
    }
    
    // Fetch latest branding from DB in the background
    fetchAndSyncBranding(); 
});

async function fetchAndSyncBranding() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'system_branding').maybeSingle();
        if(data && data.value) {
            localStorage.setItem('festBranding', JSON.stringify(data.value));
            applyGlobalBranding(data.value);
        }
    } catch(e) {
        console.warn("Could not sync branding");
    }
}

function applyGlobalBranding(brandingData) {
    // Find all brand headers across the app (works in admin, manager, judge, etc.)
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    
    brandContainers.forEach(container => {
        let html = '';
        if (brandingData.fest_logo) {
            // Apply custom logo
            html += `<img src="${brandingData.fest_logo}" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px;">`;
        } else {
            // Default icon
            html += `<i class="fa-solid fa-bolt"></i>`;
        }
        html += ` <span style="margin-left: 8px;">${brandingData.fest_name || 'FestOS'}</span>`;
        container.innerHTML = html;
    });
}

// --- NEW CROPPER LIFECYCLE ---

function triggerCropper(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const cropperModal = document.getElementById('cropperModal');
            const image = document.getElementById('cropperImage');
            
            // Load image into the cropper modal
            image.src = e.target.result;
            cropperModal.classList.add('show');
            
            // Initialize Cropper.js
            if (currentCropper) currentCropper.destroy();
            currentCropper = new Cropper(image, {
                aspectRatio: 2 / 3,
                viewMode: 2, // Restricts crop box to not exceed canvas size
                background: false,
                autoCropArea: 0.9
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Linked to the "Cancel" button on the Cropper Modal
function cancelCropper() {
    document.getElementById('cropperModal').classList.remove('show');
    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }
    document.getElementById('partPhoto').value = ''; // Reset file input
}

// Linked to the "Apply Crop" button on the Cropper Modal
function confirmCrop() {
    if (!currentCropper) return;
    
    // Get cropped canvas
    const canvas = currentCropper.getCroppedCanvas({
        width: 400,
        height: 600
    });
    
    // Instantly update the thumbnail in the main form
    document.getElementById('partPhotoPreview').src = canvas.toDataURL('image/jpeg', 0.8);
    
    // Close the cropper modal, returning to the form
    document.getElementById('cropperModal').classList.remove('show');
    
    // Note: currentCropper remains in memory so saveParticipant() can upload it to Supabase!
}

// Function to re-crop the currently loaded image without re-uploading
function editExistingCrop() {
    const currentSrc = document.getElementById('partPhotoPreview').src;
    
    // Prevent cropping the placeholder image
    if (currentSrc.includes('via.placeholder.com')) {
        showToast('Please upload a photo first before attempting to crop.', 'error');
        return;
    }
    
    const cropperModal = document.getElementById('cropperModal');
    const image = document.getElementById('cropperImage');
    
    // Load the current preview image into the cropper
    image.src = currentSrc;
    cropperModal.classList.add('show');
    
    // Initialize Cropper.js
    if (currentCropper) currentCropper.destroy();
    currentCropper = new Cropper(image, {
        aspectRatio: 2 / 3,
        viewMode: 2, 
        background: false,
        autoCropArea: 0.9
    });
}

// --- ASSIGNMENTS MANAGEMENT ---
async function loadAssignments() {
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`id, participants(name, teams(name), categories(name)), competitions(name)`);
            
        if(error) throw error;
        
        const tbody = document.getElementById('assignments-tbody');
        tbody.innerHTML = '';
        
        // 1. Populate Filter Dropdown
        const filterComp = document.getElementById('filterAssignComp');
        if(filterComp && filterComp.options.length === 1) {
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
            const { error } = await supabaseClient.from('participant_competitions').insert([{ participant_id, competition_id }]);
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

function toggleSelectAll(tbodyId, masterCheckbox) {
    const checkboxes = document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`);
    checkboxes.forEach(cb => {
        if (cb.closest('tr').style.display !== 'none') cb.checked = masterCheckbox.checked;
    });
}

function getSelectedIds(tbodyId) {
    const checkboxes = document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

// --- BULK ACTION LOGIC ---

// 1. Bulk Delete (Universal)
async function bulkDelete(tableName, tbodyId) {
    const ids = getSelectedIds(tbodyId);
    if(ids.length === 0) return showToast('No rows selected', 'error');
    
    if(confirm(`Are you sure you want to permanently delete ${ids.length} selected items?`)) {
        try {
            const { error } = await supabaseClient.from(tableName).delete().in('id', ids);
            if (error) throw error;
            
            showToast(`Successfully deleted ${ids.length} items`);
            
            // Uncheck the master checkbox
            const masterCb = document.querySelector(`#${tbodyId}`).previousElementSibling.querySelector('input[type="checkbox"]');
            if(masterCb) masterCb.checked = false;
            
            // Reload the respective tab
            if(tableName === 'categories') loadCategories();
            if(tableName === 'competitions') loadCompetitions();
            if(tableName === 'participants') loadParticipants();
            if(tableName === 'participant_competitions') loadAssignments();
        } catch (e) { showToast(e.message, 'error'); }
    }
}

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
            const { error } = await supabaseClient.from('participant_competitions').insert(inserts);
            if (error) {
                if (error.code === '23505') throw new Error('One or more selected participants are already assigned here.');
                throw error;
            }
            
            showToast(`Successfully assigned ${ids.length} participants!`); 
            closeModal(); 
            
            // Uncheck the boxes and flip to assignments tab to see results
            document.querySelectorAll('#participants-tbody input[type="checkbox"]').forEach(cb => cb.checked = false);
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
    // 1. Load baseline data
    if (categoriesList.length === 0) { const { data } = await supabaseClient.from('categories').select('*').order('name'); categoriesList = data || []; }
    if (teamsList.length === 0) { const { data } = await supabaseClient.from('teams').select('*').order('name'); teamsList = data || []; }

    // 2. Populate Category Dropdown
    const catSelect = document.getElementById('assignWorkCategory');
    catSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY --</option>';
    categoriesList.forEach(c => {
        catSelect.innerHTML += `<option value="${c.id}" data-general="${c.is_general}">${c.name} ${c.is_general ? '(GENERAL)' : ''}</option>`;
    });

    // 3. Populate Team Filter
    const teamFilter = document.getElementById('assignFilterTeam');
    teamFilter.innerHTML = '<option value="">All Teams</option>';
    teamsList.forEach(t => teamFilter.innerHTML += `<option value="${t.id}">${t.name}</option>`);

    // Reset Workspace
    document.getElementById('assignStudentWorkspace').style.display = 'none';
    document.getElementById('assignWorkComp').innerHTML = '<option value="">-- CHOOSE COMPETITION FIRST --</option>';
    document.getElementById('assignWorkComp').disabled = true;
}

async function loadAssignWorkspaceCompetitions() {
    const categoryId = document.getElementById('assignWorkCategory').value;
    const compSelect = document.getElementById('assignWorkComp');
    document.getElementById('assignStudentWorkspace').style.display = 'none';
    
    if (!categoryId) {
        compSelect.innerHTML = '<option value="">-- CHOOSE COMPETITION FIRST --</option>';
        compSelect.disabled = true;
        return;
    }

    try {
        compSelect.innerHTML = '<option value="">Loading...</option>';
        const { data, error } = await supabaseClient.from('competitions').select('*').eq('category_id', categoryId).order('name');
        if (error) throw error;

        compSelect.innerHTML = '<option value="">-- SELECT COMPETITION TO MANAGE --</option>';
        (data || []).forEach(c => {
            // NEW: Added data-is-group to store the boolean flag
            compSelect.innerHTML += `<option value="${c.id}" data-limit="${c.max_participants}" data-is-group="${c.is_group}">${c.name}</option>`;
        });
        compSelect.disabled = false;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadAssignWorkspaceStudents() {
    const catSelect = document.getElementById('assignWorkCategory');
    const compSelect = document.getElementById('assignWorkComp');
    const workspace = document.getElementById('assignStudentWorkspace');
    const tbody = document.getElementById('assign-workspace-tbody');
    
    const categoryId = catSelect.value;
    const isGeneral = catSelect.options[catSelect.selectedIndex].getAttribute('data-general') === 'true';
    const compId = compSelect.value;

    if (!compId) {
        workspace.style.display = 'none';
        return;
    }

    currentAssignCompLimit = parseInt(compSelect.options[compSelect.selectedIndex].getAttribute('data-limit')) || 0;
    
    // NEW: Capture if the selected competition is a group event
    const isGroupComp = compSelect.options[compSelect.selectedIndex].getAttribute('data-is-group') === 'true';

    workspace.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading students...</td></tr>';

    try {
        let studentQuery = supabaseClient.from('participants').select('*, teams(name)');
        if (!isGeneral) {
            studentQuery = studentQuery.eq('category_id', categoryId);
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

        const limitDisplay = document.getElementById('assignLimitIndicator');
        limitDisplay.innerHTML = `<i class="fa-solid fa-users"></i> Max Enrollment: ${currentAssignCompLimit} Participants Per Team`;
        
        // NEW: Update table header dynamically based on competition type
        document.querySelector('#assign-workspace-tbody').parentElement.querySelector('thead tr').innerHTML = `
            <th class="checkbox-cell"><input type="checkbox" onchange="toggleSelectAll('assign-workspace-tbody', this)"></th>
            <th>Unique ID</th>
            <th>Participant Name</th>
            <th>Team</th>
            <th>Batch</th>
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
                
            tbody.innerHTML += `
                <tr data-team="${s.team_id || ''}" data-batch="${s.batch_no || ''}" data-status="${isAssigned ? 'assigned' : 'unassigned'}">
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${s.id}"></td>
                    <td style="font-family: monospace; font-weight: 600;">${s.unique_id}</td>
                    <td class="searchable-name">${s.name}</td>
                    <td>${s.teams?.name || 'INDEPENDENT'}</td>
                    <td>BATCH ${s.batch_no || '1'}</td>
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
// Local Table Filter (Search, Team, Batch, Status)
function filterAssignTable() {
    const searchVal = document.getElementById('assignSearch').value.toLowerCase();
    const teamVal = document.getElementById('assignFilterTeam').value;
    const batchVal = document.getElementById('assignFilterBatch').value;
    const statusVal = document.getElementById('assignFilterStatus').value; // NEW
    const rows = document.querySelectorAll('#assign-workspace-tbody tr');

    rows.forEach(row => {
        if(row.children.length === 1) return; // Skip "Loading..." row
        
        const text = row.querySelector('.searchable-name').innerText.toLowerCase() + " " + row.cells[1].innerText.toLowerCase();
        const rowTeam = row.getAttribute('data-team');
        const rowBatch = row.getAttribute('data-batch');
        const rowStatus = row.getAttribute('data-status'); // NEW

        const matchSearch = text.includes(searchVal);
        const matchTeam = teamVal === "" || rowTeam === teamVal;
        const matchBatch = batchVal === "" || rowBatch === batchVal;
        const matchStatus = statusVal === "" || rowStatus === statusVal; // NEW

        // Hide or show row based on ALL conditions matching
        row.style.display = (matchSearch && matchTeam && matchBatch && matchStatus) ? '' : 'none';
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

        // Group the new students by team
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

        const { error } = await supabaseClient.from('participant_competitions').insert(inserts);
        if (error) throw error;
        
        showToast(`Successfully assigned ${newIds.length} students!`);
        document.querySelector('#assign-workspace-tbody').previousElementSibling.querySelector('input[type="checkbox"]').checked = false;
        loadAssignWorkspaceStudents(); 

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('btnWorkspaceAssign', false);
    }
}
// Execute Bulk Removal (Edit capability)
async function executeWorkspaceRemove() {
    const compId = document.getElementById('assignWorkComp').value;
    const ids = getSelectedIds('assign-workspace-tbody');
    
    if (ids.length === 0) return showToast('Select at least one student.', 'error');
    
    const assignedIds = ids.filter(id => currentEnrolledStudentIds.includes(id));
    if (assignedIds.length === 0) return showToast('None of the selected students are currently assigned.', 'error');

    if(confirm(`Remove ${assignedIds.length} students from this competition?`)) {
        setLoading('btnWorkspaceRemove', true);
        try {
            const { error } = await supabaseClient.from('participant_competitions')
                .delete()
                .eq('competition_id', compId)
                .in('participant_id', assignedIds);
            
            if (error) throw error;
            showToast(`Removed ${assignedIds.length} students.`);
            document.querySelector('#assign-workspace-tbody').previousElementSibling.querySelector('input[type="checkbox"]').checked = false;
            loadAssignWorkspaceStudents(); // Refresh Data
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setLoading('btnWorkspaceRemove', false);
        }
    }
}
// Export Full Assignment Data to CSV
async function exportAssignmentsCSV() {
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`participants(name, unique_id, teams(name), categories(name)), competitions(name)`);
            
        if(error) throw error;
        
        // Flatten the nested JSON for CSV format
        const flatData = (data || []).map(row => ({
            "UNIQUE ID": row.participants?.unique_id || 'N/A',
            "STUDENT NAME": row.participants?.name || 'N/A',
            "TEAM": row.participants?.teams?.name || 'INDEPENDENT',
            "CATEGORY": row.participants?.categories?.name || 'N/A',
            "COMPETITION": row.competitions?.name || 'N/A'
        }));

        const blob = new Blob([Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute("download", `Fest_Assignments_Data.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
        showToast('CSV Exported Successfully!');
    } catch (e) { showToast(e.message, 'error'); }
}

// Generate a Branded Premium PDF Document
async function exportAssignmentsPDF() {
    showToast('Generating Premium PDF...', 'success');
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`participants(name, unique_id, teams(name)), competitions(name, categories(name))`)
            .order('competition_id');
            
        if(error) throw error;

        // Group data by Competition for a clean layout
        const grouped = {};
        (data || []).forEach(row => {
            const compName = row.competitions?.name || 'Unknown';
            if(!grouped[compName]) grouped[compName] = [];
            grouped[compName].push(row.participants);
        });

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 28px;">FEST 2026</h1>
                <h2 style="color: #1E293B; font-size: 18px; margin-top:0;">MASTER ASSIGNMENT LEDGER</h2>
                <p style="color: #64748B; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
            </div>
        `;

        for (const [comp, students] of Object.entries(grouped)) {
            let tableRows = students.map((s, index) => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace;">${s?.unique_id}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${s?.name}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${s?.teams?.name || 'INDEPENDENT'}</td>
                </tr>
            `).join('');

            container.innerHTML += `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <h3 style="background: #1E293B; color: white; padding: 12px; border-radius: 8px 8px 0 0; margin: 0; font-size: 14px; text-transform: uppercase;">
                        ${comp} <span style="float:right; font-weight: normal; font-size: 12px;">${students.length} ENROLLED</span>
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                        <thead>
                            <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                                <th style="padding: 10px;">#</th>
                                <th style="padding: 10px;">ID</th>
                                <th style="padding: 10px;">NAME</th>
                                <th style="padding: 10px;">TEAM</th>
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
            filename: `Fest_Assignments_Ledger.pdf`, 
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
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img); // Resolve anyway to avoid freezing if an image fails
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

    // Map Participant Data to the specific fields you defined in the Studio
    const mappedData = {
        'ParticipantName': participant.name.toUpperCase(),
        'UniqueID': participant.unique_id || `FEST-${participant.id.substring(0,6)}`.toUpperCase(),
        'TeamName': participant.teams?.name?.toUpperCase() || 'INDEPENDENT',
        'Category': participant.categories?.name?.toUpperCase() || '',
        'BatchNo': `BATCH ${participant.batch_no || '1'}`
    };

    for (const [key, field] of Object.entries(template.fields)) {
        if (!field.enabled) continue;

        if (field.isImage) {
            // Render Participant Photo
            if (key === 'Photo') {
                const photoSrc = participant.photo_url || 'https://via.placeholder.com/400x600/E5E7EB/6B7280?text=NO+PHOTO';
                const pPhoto = await loadImagePromise(photoSrc);
                
                ctx.save();
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(field.x, field.y, field.w, field.h, field.radius || 0);
                else ctx.rect(field.x, field.y, field.w, field.h);
                ctx.clip();
                
                // Draw Image filling the bounds
                ctx.drawImage(pPhoto, field.x, field.y, field.w, field.h);
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
            const textToDraw = mappedData[key] || "";
            if (!textToDraw) continue;

            ctx.textAlign = field.align;
            ctx.fillStyle = field.color;
            ctx.font = `${field.weight || 'bold'} ${field.size}px ${field.font}`;
            ctx.fillText(textToDraw, field.x, field.y);
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
let currentLibraryFilter = 'all';

// DRAG STATE
let isDraggingLayer = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

const TEMPLATE_SCHEMAS = {
    individual: ['Result Number', 'Category', 'Competition', 'Position 1 Name', 'Position 1 Team', 'Position 1 Photo', 'Position 2 Name', 'Position 2 Team', 'Position 2 Photo', 'Position 3 Name', 'Position 3 Team', 'Position 3 Photo'],
    team: ['Results Count Text', 'Rank 1 Team', 'Rank 1 Points', 'Rank 2 Team', 'Rank 2 Points', 'Rank 3 Team', 'Rank 3 Points', 'Rank 4 Team', 'Rank 4 Points', 'Rank 5 Team', 'Rank 5 Points'],
    final: ['Total Competitions Count', 'Rank 1 Team', 'Rank 1 Points', 'Rank 2 Team', 'Rank 2 Points', 'Rank 3 Team', 'Rank 3 Points', 'Rank 4 Team', 'Rank 4 Points', 'Rank 5 Team', 'Rank 5 Points'],
    id_card: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Batch No', 'Photo', 'QR Code']
};

const STUDIO_MOCK_DATA = {
    'ResultNumber': '#42', 'Category': 'GENERAL', 'Competition': 'DANCE OFF',
    'Position1Name': 'JOHN DOE', 'Position1Team': 'FALCONS', 
    'Position2Name': 'JANE SMITH', 'Position2Team': 'EAGLES',
    'Position3Name': 'MIKE TYSON', 'Position3Team': 'HAWKS',
    'ResultsCountText': 'AFTER 40',
    'TotalCompetitionsCount': 'FINAL OVERALL', 
    'Rank1Team': 'FALCONS', 'Rank1Points': '450',
    'Rank2Team': 'EAGLES', 'Rank2Points': '380',
    'ParticipantName': 'JOHN DOE', 'UniqueID': 'FEST-26-987654', 'BatchNo': 'BATCH 1'
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
    // Fetch directly from Supabase
    const { data: templates, error } = await supabaseClient
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Template Sync Error:", error);
        showToast("Failed to load templates", "error");
        savedTemplates = [];
    } else {
        savedTemplates = templates || [];
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
        let tag = tpl.type === 'id_card' ? 'ID Card' : tpl.type === 'team' ? 'Team' : tpl.type === 'final' ? 'Final' : 'Individual';

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

async function deleteTemplate(index) {
    if(!confirm("Permanently delete this template from the cloud?")) return;
    
    const templateId = savedTemplates[index].id;
    
    const { error } = await supabaseClient.from('templates').delete().eq('id', templateId);
    
    if (error) {
        showToast("Error deleting template", "error");
    } else {
        showToast("Template Deleted.");
        loadTemplatesList(); // Refresh from DB
    }
}

function openTemplateStudio(template = null) {
    document.getElementById('template-library-view').style.display = 'none';
    document.getElementById('template-studio-view').style.display = 'block';

    if (template) {
        studioActiveData = JSON.parse(JSON.stringify(template)); 
        document.getElementById('studio-template-name').value = studioActiveData.name;
        document.getElementById('studio-template-type').value = studioActiveData.type;
        studioActiveData.imgObj = new Image();
        
        // ADD THIS LINE:
        studioActiveData.imgObj.crossOrigin = "Anonymous"; 
        
        studioActiveData.imgObj.onload = () => drawStudioCanvas();
        if (studioActiveData.bg_base64) studioActiveData.imgObj.src = studioActiveData.bg_base64;
    } else {
        studioActiveData = { id: 'TPL_' + Date.now(), name: '', type: 'individual', bg_base64: null, imgObj: new Image(), fields: {} };
        
        // ADD THIS LINE:
        studioActiveData.imgObj.crossOrigin = "Anonymous";
        
        document.getElementById('studio-template-name').value = '';
        document.getElementById('studio-template-type').value = 'individual';
    }
    
    studioActiveField = null;
    initializeStudioFields();
}

function closeTemplateStudio() {
    document.getElementById('template-studio-view').style.display = 'none';
    document.getElementById('template-library-view').style.display = 'block';
    loadTemplatesList(); 
}

function initializeStudioFields() {
    const type = document.getElementById('studio-template-type').value;
    studioActiveData.type = type;
    const requiredFields = TEMPLATE_SCHEMAS[type];

    // Build Data Defaults
    requiredFields.forEach(field => {
        const key = field.replace(/\s+/g, '');
const isImage = (key.includes('Photo') || key === 'QRCode');        if (!studioActiveData.fields[key]) {
            if (isImage) studioActiveData.fields[key] = { enabled: false, x: 100, y: 150, w: 250, h: 300, radius: 20, isImage: true };
            else studioActiveData.fields[key] = { enabled: false, x: 100, y: 150, size: 40, color: '#0F172A', align: 'left', font: 'Inter, sans-serif', weight: 'bold', isImage: false };
        }
        studioActiveData.fields[key].displayName = field;
    });

    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function renderLayersPanel() {
    const container = document.getElementById('studio-layers-panel');
    container.innerHTML = '';

    Object.keys(studioActiveData.fields).forEach(key => {
        const data = studioActiveData.fields[key];
        const isActiveLayer = (studioActiveField === key);
        
        container.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; border-radius: 6px; cursor: pointer; transition: 0.2s; background: ${isActiveLayer ? 'var(--primary-light)' : 'transparent'}; border: 1px solid ${isActiveLayer ? 'rgba(79,70,229,0.3)' : 'transparent'};" onclick="selectStudioLayer('${key}')">
                
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <button style="background:none; border:none; color: ${data.enabled ? 'var(--text-main)' : '#CBD5E1'}; cursor:pointer; font-size:1.1rem;" onclick="toggleLayerVisibility(event, '${key}')">
                        <i class="fa-solid ${data.enabled ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                    <span style="font-weight: 700; font-size: 0.85rem; color: ${data.enabled ? 'var(--text-main)' : 'var(--text-muted)'};">${data.displayName}</span>
                </div>
                
                <div style="color: var(--text-muted); font-size: 0.8rem;">
                    ${data.isImage ? '<i class="fa-regular fa-image"></i>' : '<i class="fa-solid fa-t"></i>'}
                </div>
            </div>
        `;
    });
}

function selectStudioLayer(key) {
    studioActiveField = key;
    renderLayersPanel(); // Update Highlights
    renderPropertiesPanel(); // Show Controls
    drawStudioCanvas(); // Highlight on canvas
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

function renderPropertiesPanel() {
    const container = document.getElementById('studio-properties-panel');
    if (!studioActiveField || !studioActiveData.fields[studioActiveField]) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">Select a layer to edit.</p>`;
        return;
    }

    const key = studioActiveField;
    const data = studioActiveData.fields[key];
    const fonts = AVAILABLE_FONTS.map(f => `<option value="${f.value}" ${data.font === f.value ? 'selected' : ''}>${f.name}</option>`).join('');

    let specificHTML = '';
    if (data.isImage) {
        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
                <div><label style="font-size: 0.75rem; font-weight:700;">WIDTH (px)</label><input type="number" id="prop-w" value="${data.w}" oninput="updateActiveProperty('w', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">HEIGHT (px)</label><input type="number" id="prop-h" value="${data.h}" oninput="updateActiveProperty('h', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <div style="grid-column: span 2;"><label style="font-size: 0.75rem; font-weight:700;">CORNER RADIUS (px)</label><input type="number" id="prop-rad" value="${data.radius || 0}" oninput="updateActiveProperty('radius', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
            </div>
        `;
    } else {
        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
                <div><label style="font-size: 0.75rem; font-weight:700;">FONT SIZE</label><input type="number" id="prop-sz" value="${data.size}" oninput="updateActiveProperty('size', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">COLOR</label><input type="color" id="prop-cl" value="${data.color}" oninput="updateActiveProperty('color', this.value)" style="width: 100%; height: 35px; border: 1px solid var(--border); border-radius: 4px; padding:0;"></div>
                <div style="grid-column: span 2;"><label style="font-size: 0.75rem; font-weight:700;">FONT FAMILY</label><select onchange="updateActiveProperty('font', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">${fonts}</select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">WEIGHT</label><select onchange="updateActiveProperty('weight', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <option value="normal" ${data.weight==='normal'?'selected':''}>Normal</option>
                    <option value="bold" ${data.weight==='bold'?'selected':''}>Bold</option>
                    <option value="900" ${data.weight==='900'?'selected':''}>Black</option>
                </select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">ALIGN</label><select onchange="updateActiveProperty('align', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <option value="left" ${data.align==='left'?'selected':''}>Left</option>
                    <option value="center" ${data.align==='center'?'selected':''}>Center</option>
                    <option value="right" ${data.align==='right'?'selected':''}>Right</option>
                </select></div>
            </div>
        `;
    }

    container.innerHTML = `
        <h4 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 1rem; color: var(--primary);">${data.displayName}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div><label style="font-size: 0.75rem; font-weight:700;">X POS</label><input type="number" id="prop-x" value="${data.x}" oninput="updateActiveProperty('x', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
            <div><label style="font-size: 0.75rem; font-weight:700;">Y POS</label><input type="number" id="prop-y" value="${data.y}" oninput="updateActiveProperty('y', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
        </div>
        ${specificHTML}
    `;
}

function updateActiveProperty(prop, value) {
    if (!studioActiveField) return;
    const isNum = ['x','y','w','h','size','radius'].includes(prop);
    studioActiveData.fields[studioActiveField][prop] = isNum ? (parseInt(value) || 0) : value;
    drawStudioCanvas();
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

// --- 3. CANVAS ENGINE & DRAWING ---
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
            // Draw Rounded Rectangle
            ctx.beginPath();
            if(ctx.roundRect) {
                ctx.roundRect(data.x, data.y, data.w, data.h, data.radius || 0);
            } else {
                ctx.rect(data.x, data.y, data.w, data.h); // Fallback
            }
            
ctx.fillStyle = key.includes('Photo') ? 'rgba(79, 70, 229, 0.2)' : 'rgba(15, 23, 42, 0.1)';            ctx.fill();

            if (studioActiveField === key) {
                ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 6; ctx.setLineDash([15, 10]);
                ctx.stroke(); ctx.setLineDash([]);
            }

            ctx.fillStyle = '#0F172A'; ctx.font = "bold 28px Inter"; ctx.textAlign = "center";
            ctx.fillText(data.displayName, data.x + (data.w / 2), data.y + (data.h / 2) + 10);
            
        } else {
            ctx.textAlign = data.align; ctx.fillStyle = data.color;
            ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
            const mockText = STUDIO_MOCK_DATA[key] || data.displayName.toUpperCase();
            
            if (studioActiveField === key) {
                ctx.shadowColor = 'rgba(79, 70, 229, 0.8)'; ctx.shadowBlur = 15;
                ctx.fillText(mockText, data.x, data.y);
                ctx.shadowBlur = 0; // Reset
            } else {
                ctx.fillText(mockText, data.x, data.y);
            }
        }
    }
}

// --- 4. DRAG & DROP INTERACTION ---
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('studio-canvas');
    if (!canvas) return;

    // Mouse Down (Hit Test)
    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX; const mouseY = (e.clientY - rect.top) * scaleY;

        let hit = null;
        // Loop in reverse to hit topmost items first
        const keys = Object.keys(studioActiveData.fields).reverse();
        
        for(let key of keys) {
            const data = studioActiveData.fields[key];
            if(!data.enabled) continue;

            if(data.isImage) {
                if(mouseX >= data.x && mouseX <= data.x + data.w && mouseY >= data.y && mouseY <= data.y + data.h) {
                    hit = key; break;
                }
            } else {
                // Approximate Text Hitbox
                const ctx = canvas.getContext('2d');
                ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
                const w = ctx.measureText(STUDIO_MOCK_DATA[key] || data.displayName).width;
                const h = data.size; 
                let startX = data.x;
                if(data.align === 'center') startX -= w/2;
                if(data.align === 'right') startX -= w;

                if(mouseX >= startX && mouseX <= startX + w && mouseY >= data.y - h && mouseY <= data.y + (h * 0.2)) {
                    hit = key; break;
                }
            }
        }

        if(hit) {
            selectStudioLayer(hit);
            isDraggingLayer = true;
            dragOffsetX = mouseX - studioActiveData.fields[hit].x;
            dragOffsetY = mouseY - studioActiveData.fields[hit].y;
        } else {
            studioActiveField = null; // Deselect
            renderLayersPanel(); renderPropertiesPanel(); drawStudioCanvas();
        }
    });

    // Mouse Move (Dragging)
    canvas.addEventListener('mousemove', function(e) {
        if(!isDraggingLayer || !studioActiveField) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX; const mouseY = (e.clientY - rect.top) * scaleY;

        studioActiveData.fields[studioActiveField].x = Math.round(mouseX - dragOffsetX);
        studioActiveData.fields[studioActiveField].y = Math.round(mouseY - dragOffsetY);

        // Live update input fields if Properties panel is showing
        const propX = document.getElementById('prop-x');
        const propY = document.getElementById('prop-y');
        if(propX) propX.value = studioActiveData.fields[studioActiveField].x;
        if(propY) propY.value = studioActiveData.fields[studioActiveField].y;

        drawStudioCanvas();
    });

    // Mouse Up (Stop Drag)
    window.addEventListener('mouseup', () => { isDraggingLayer = false; });
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
        // 1. If there's a new file, upload it to Supabase Storage first
        if (studioActiveData.pendingFile) {
            showToast("Uploading background image...", "success");
            const file = studioActiveData.pendingFile;
            const fileExt = file.name.split('.').pop();
            const fileName = `bg_${Date.now()}.${fileExt}`;

            // Upload to the 'templates' bucket
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('templates')
                .upload(fileName, file, { contentType: file.type });

            if (uploadError) throw uploadError;

            // Get the Public URL
            const { data: publicUrlData } = supabaseClient.storage
                .from('templates')
                .getPublicUrl(fileName);

            // Swap out the local Base64 string for the permanent Cloud URL
            studioActiveData.bg_base64 = publicUrlData.publicUrl;
            
            // Clear pending file so we don't re-upload if they click save again
            studioActiveData.pendingFile = null; 
        }

        // 2. Create the payload for the Database (now containing a lightweight URL!)
        const savePayload = { 
            id: studioActiveData.id,
            name: studioActiveData.name,
            type: studioActiveData.type,
            bg_base64: studioActiveData.bg_base64, // This is now a URL!
            fields: studioActiveData.fields
        };

        // 3. Save to Database
        const { error } = await supabaseClient.from('templates').upsert(savePayload);
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

const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if(originalSwitchTab) originalSwitchTab(tabId);
    if(tabId === 'poster-templates') {
        document.getElementById('template-library-view').style.display = 'block';
        document.getElementById('template-studio-view').style.display = 'none';
        
        // FIX: Actively fetch the templates from Supabase instead of filtering an empty array
        loadTemplatesList(); 
    }
};

// ============================================================================
// DIRECT VALUATION ENGINE (BYPASS WORKFLOW)
// ============================================================================

let currentDVMaxMark = 100;

// --- REPLACE THESE FUNCTIONS IN ADMIN.JS ---

async function initDirectValuation() {
    // 1. Ensure Categories are loaded
    if (categoriesList.length === 0) { 
        const { data } = await supabaseClient.from('categories').select('*').order('name'); 
        categoriesList = data || []; 
    }
    const catSelect = document.getElementById('dvCategory');
    catSelect.innerHTML = '<option value="">-- ALL CATEGORIES --</option>';
    categoriesList.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);

    // 2. Ensure Stages are loaded
    if (stagesList.length === 0) {
        const { data } = await supabaseClient.from('stages').select('*').order('stage_no');
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
    let query = supabaseClient
        .from('competitions')
        .select('*')
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
    
    if(!confirm(`Submit these marks directly and push the competition to the Fest Manager for publishing?`)) return;
    
    setLoading('btnSubmitDV', true);
    
    try {
        // 1. Purge any existing marks to avoid duplication logic
        await supabaseClient.from('judgements').delete().eq('competition_id', compId);
        
        // 2. Insert Final Marks
        const { error: insertError } = await supabaseClient.from('judgements').insert(marksData);
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
        loadParticipants();
    } catch (e) { showToast(e.message, 'error'); }
}

// Revoke (Set team_id to NULL)
async function bulkRevokeTeam() {
    const participantIds = getSelectedIds('participants-tbody');
    if (participantIds.length === 0) return showToast('Select at least one participant.', 'error');
    
    if (!confirm(`Are you sure you want to remove ${participantIds.length} participants from their teams?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('participants')
            .update({ team_id: null })
            .in('id', participantIds);
            
        if (error) throw error;
        showToast('Teams revoked successfully.');
        loadParticipants();
    } catch (e) { showToast(e.message, 'error'); }
}

// Call initBulkTeamControls inside loadParticipants() 
// or at the end of the DOMContentLoaded event
async function loadPointSettings() {
    try {
        const { data, error } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();        
        if (data && data.value) {
            document.getElementById('setting-ratio-standard').value = data.value.ratio_standard || 10;
            document.getElementById('setting-ratio-general').value = data.value.ratio_general || 20;
            
            // Restore Poster Interval loader
            if(document.getElementById('setting-poster-interval')) {
                document.getElementById('setting-poster-interval').value = data.value.poster_interval || 10;
            }

            // NEW: Load Team Manager Access Control
            if(document.getElementById('setting-tm-access')) {
                // Default to true if the setting doesn't exist yet
                const tmAccess = data.value.tm_access !== false; 
                const checkbox = document.getElementById('setting-tm-access');
                checkbox.checked = tmAccess;
                // Trigger the visual animation for the toggle switch
                checkbox.dispatchEvent(new Event('change')); 
            }
        }
    } catch (e) {
        console.warn("No custom point settings found, using defaults.");
    }
}

async function savePointSettings() {
    const payload = {
        ratio_standard: parseFloat(document.getElementById('setting-ratio-standard').value) || 10,
        ratio_general: parseFloat(document.getElementById('setting-ratio-general').value) || 20,
        // Restore Poster Interval saver
        poster_interval: parseInt(document.getElementById('setting-poster-interval').value) || 10,
        // NEW: Save Team Manager Access Control
        tm_access: document.getElementById('setting-tm-access') ? document.getElementById('setting-tm-access').checked : true
    };

    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'point_system', value: payload });
        if (error) throw error;
        showToast("Point Settings Saved Successfully!");
    } catch (e) {
        showToast(e.message, 'error');
    }
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
        const { data, error } = await supabaseClient.from('settings').select('value').eq('id', 'system_branding').maybeSingle();        
        if (data && data.value) {
            document.getElementById('setting-fest-name').value = data.value.fest_name || '';
            if (data.value.fest_logo) {
                const preview = document.getElementById('branding-logo-preview');
                preview.src = data.value.fest_logo;
                preview.style.display = 'block';
                pendingBrandingLogoBase64 = data.value.fest_logo; 
                
                // Show the remove button since an existing logo was loaded
                const btnRemove = document.getElementById('btnRemoveLogo');
                if(btnRemove) btnRemove.style.display = 'inline-flex';
            }
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
        fest_logo: pendingBrandingLogoBase64 // Will be null if the user clicked "Remove Logo"
    };

    try {
        // Save directly to the cloud database
        const { error } = await supabaseClient
            .from('settings')
            .upsert({ id: 'system_branding', value: payload });
            
        if (error) throw error;
        
        showToast("Branding Settings Saved to Database!");
        
        // Instantly apply it to the admin's current screen
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

document.addEventListener("DOMContentLoaded", () => {
    // Fire the cloud fetch as soon as the DOM is ready
    fetchAndApplyBranding();
});

async function fetchAndApplyBranding() {
    try {
        // Query the database directly for the branding data
        const { data, error } = await supabaseClient
            .from('settings')
            .select('value')
            .eq('id', 'system_branding')
            .maybeSingle();

        if (error) throw error;

        // If branding exists in the DB, apply it to the UI
        if (data && data.value) {
            applyGlobalBranding(data.value);
        }
    } catch (e) {
        console.warn("Could not fetch global branding from database:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    // Find all branding containers across the different portals
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    
    brandContainers.forEach(container => {
        let html = '';
        
        // If a logo exists in the DB, render it
        if (brandingData.fest_logo) {
            html += `<img src="${brandingData.fest_logo}" alt="Fest Logo" style="height: 28px; width: 28px; object-fit: contain; border-radius: 4px; margin-right: 8px;">`;
        } else {
            // Fallback icon if no logo is uploaded
            html += `<i class="fa-solid fa-bolt" style="margin-right: 8px;"></i>`;
        }
        
        // Append the Fest Name
        html += `<span>${brandingData.fest_name || 'FestOS'}</span>`;
        
        // Update the DOM element
        container.innerHTML = html;
        
        // Make sure it uses flexbox for alignment
        container.style.display = 'flex';
        container.style.alignItems = 'center';
    });
}

// ============================================================================
// PARTICIPANT POINTS LEDGER ENGINE
// ============================================================================
let pointsDataList = [];
let filteredPointsList = [];
let pointsCurrentPage = 1;
const pointsRowsPerPage = 10;
let pointsAdminSettings = { ratio_standard: 10, ratio_general: 20 };
async function loadParticipantPoints() {
    try {
        // 1. Fetch Point Ratios
        const { data: set_data } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();
        if (set_data && set_data.value) pointsAdminSettings = set_data.value;

        // 2. Fetch baseline data needed for calculations
        const { data: comps } = await supabaseClient.from('competitions').select('*, categories(name, is_general)');
        const { data: participants, error: pErr } = await supabaseClient.from('participants').select('*, teams(name), categories(name)');
        if (pErr) throw pErr;
        const { data: judgements, error: jErr } = await supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark');
        if (jErr) throw jErr;

        // 3. Average out judgement marks in case of multiple judges (Safely handling null judgements)
        let compAverages = {}; 
        (judgements || []).forEach(j => {
            const key = `${j.competition_id}_${j.participant_id}`;
            if(!compAverages[key]) compAverages[key] = { total: 0, count: 0 };
            compAverages[key].total += parseFloat(j.awarded_mark);
            compAverages[key].count += 1;
        });

        // 4. Calculate total points and breakdowns per participant
        pointsDataList = (participants || []).map(p => {
            let totalPoints = 0;
            let breakdown = [];

            (comps || []).forEach(comp => {
                const key = `${comp.id}_${p.id}`;
                if(compAverages[key]) {
                    const avgMark = compAverages[key].total / compAverages[key].count;
                    const baseRatio = comp.categories?.is_general ? (pointsAdminSettings.ratio_general || 20) : (pointsAdminSettings.ratio_standard || 10);
                    const maxMark = comp.max_mark || 100;
                    
                    // Normalize the point formula based on limits
                    const normalized = parseFloat(((avgMark / maxMark) * baseRatio).toFixed(2));

                    totalPoints += normalized;
                    breakdown.push({
                        compName: comp.name,
                        compCat: comp.categories?.name || 'General',
                        avgMark: avgMark.toFixed(2),
                        maxMark: maxMark,
                        pointsEarned: normalized
                    });
                }
            });

            return {
                ...p,
                totalPoints: parseFloat(totalPoints.toFixed(2)),
                breakdown: breakdown
            };
        });

        // 5. Populate Filters Safely (Waiting for lists to populate before running forEach)
        const catFilter = document.getElementById('filterPointsCategory');
        if (catFilter && catFilter.options.length === 1) {
            if (typeof categoriesList !== 'undefined' && categoriesList.length === 0) await loadCategories();
            (categoriesList || []).forEach(c => catFilter.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }
        
        const teamFilter = document.getElementById('filterPointsTeam');
        if (teamFilter && teamFilter.options.length === 1) {
            if (typeof teamsList !== 'undefined' && teamsList.length === 0) await loadStagesAndTeams();
            (teamsList || []).forEach(t => teamFilter.innerHTML += `<option value="${t.name}">${t.name}</option>`);
        }

        filterPointsTable(true);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function filterPointsTable(resetPage = true) {
    const query = document.getElementById('searchPointsInput').value.toLowerCase();
    const catFilter = document.getElementById('filterPointsCategory').value;
    const teamFilter = document.getElementById('filterPointsTeam').value;
    const batchFilter = document.getElementById('filterPointsBatch').value;
    
    filteredPointsList = pointsDataList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        const matchCat = catFilter === "" || (p.categories?.name || '') === catFilter;
        const matchTeam = teamFilter === "" || (p.teams?.name || '') === teamFilter;
        const matchBatch = batchFilter === "" || (p.batch_no && p.batch_no.toString() === batchFilter);
        
        return matchName && matchCat && matchTeam && matchBatch;
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
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}"></td>
                <td style="font-family: monospace; font-weight: 600; color: var(--text-muted);">${p.unique_id}</td>
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

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Showing ${startNum} to ${endNum} of ${filteredPointsList.length} participants</div>
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
            <td style="text-align: right;">${b.avgMark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary);">${b.pointsEarned}</td>
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
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.avgMark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 12px; text-align: right; font-weight: 700; color: #4F46E5;">${b.pointsEarned}</td>
            </tr>
        `).join('') : `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748B;">No programs evaluated yet.</td></tr>`;

        // The "page-break-after: always" ensures each participant gets their own clean page
        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #E2E8F0;">
                    <h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 24px; text-transform: uppercase;">Participant Point Ledger</h1>
                    <p style="color: #64748B; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
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
        filename: `Fest_Participant_Points_Report.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported Successfully!'));
}