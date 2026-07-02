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

// Example: Upgraded Load Categories with Edit and Counts
async function loadCategories() {
    try {
        // Assuming your DB relations allow counting
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

// --- COMPETITIONS MANAGEMENT (PAGINATED) ---

// Global states for pagination
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
        filteredCompetitionsList = [...competitionsList]; // Initialize filtered list
        
        const filterCat = document.getElementById('filterCompCategory');
        if(filterCat && filterCat.options.length === 1) {
            categoriesList.forEach(c => filterCat.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        compCurrentPage = 1; // Reset to page 1 on load
        renderCompetitionsTable();
    } catch(e) { showToast(e.message, 'error'); }
}

// Custom filter that supports pagination instead of native DOM hiding
function filterCompetitions() {
    const query = document.getElementById('searchCompInput').value.toLowerCase();
    const catFilter = document.getElementById('filterCompCategory').value;
    
    filteredCompetitionsList = competitionsList.filter(comp => {
        const matchName = comp.name.toLowerCase().includes(query);
        const compCatName = comp.categories?.name || '';
        const matchCat = catFilter === "" || compCatName === catFilter;
        return matchName && matchCat;
    });
    
    compCurrentPage = 1; // Return to page 1 on search
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

    let catOpts = categoriesList.map(c => `<option value="${c.id}" ${isEdit && editData.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    let stageOpts = stagesList.map(s => `<option value="${s.id}" ${isEdit && editData.stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    openModal(isEdit ? 'Edit Competition' : 'New Competition', `
        <input type="hidden" id="compId" value="${cId}">
        <div class="form-group"><label>Competition Name</label><input type="text" id="compName" value="${cName}"></div>
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
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { name, category_id, stage_id, max_mark, max_participants };
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
            if(error) throw error;
            showToast('Competition deleted.');
            loadCompetitions();
        } catch(e) { showToast(e.message, 'error'); }
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
                        <!-- Structural Button Layout for Stages -->
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openStageModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' title="Edit Stage"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteStage('${s.id}', '${s.name}')" title="Delete Stage"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Load Teams with Participant Counts
        const { data: teams, error: teamError } = await supabaseClient
            .from('teams')
            .select('*, participants(count)')
            .order('name');
        if(teamError) throw teamError;
        
        teamsList = teams || [];
        const ttbody = document.getElementById('teams-tbody');
        ttbody.innerHTML = '';
        
        teamsList.forEach(t => {
            const memberCount = t.participants[0]?.count || 0;
            ttbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${t.name}</strong><br>
                        <small style="color:var(--text-muted)">MGR: ${t.manager_name || 'N/A'} | ASST: ${t.assistant_manager_name || 'N/A'}</small>
                    </td>
                    <td><span class="badge-count" onclick="viewRelationalData('participants', 'team_id', '${t.id}')">${memberCount} MEMBERS</span></td>
                    <td>
                        <!-- Structural Button Layout for Teams -->
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

        const { error } = await supabaseClient.from('teams').upsert([payload]);
        setLoading('modalSaveBtn', false);
        
        if(error) showToast(error.message, 'error'); 
        else { showToast(id ? 'Team updated!' : 'Team added!'); closeModal(); loadStagesAndTeams(); }
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

        partCurrentPage = 1; // Reset to page 1 on load
        renderParticipantsTable();
    } catch(e) { showToast(e.message, 'error'); }
}

// Custom filter that supports pagination
function filterParticipants() {
    const query = document.getElementById('searchPartInput').value.toLowerCase();
    const catFilter = document.getElementById('filterCategory').value;
    
    filteredParticipantsList = participantsList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        const partCatName = p.categories?.name || '';
        const matchCat = catFilter === "" || partCatName === catFilter;
        return matchName && matchCat;
    });
    
    partCurrentPage = 1; // Return to page 1 on search
    renderParticipantsTable();
}

function renderParticipantsTable() {
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    // Calculate page slices
    const start = (partCurrentPage - 1) * partRowsPerPage;
    const end = start + partRowsPerPage;
    const pageData = filteredParticipantsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No participants found.</td></tr>`;
    }

    pageData.forEach(p => {
        const safeData = JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}"></td>
                <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${p.unique_id}</td>
                <td>${p.name}</td>
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

// PDF GENERATION LOGIC
function buildCardElement(participant) {
    const card = document.createElement('div');
    card.className = 'id-card';
    
    // Define premium hex colors for your specific teams
    const teamColors = {
        'GRYFFINDOR': '#991B1B', // Deep Red
        'SLYTHERIN': '#166534',  // Deep Green
        'RAVENCLAW': '#1E3A8A',  // Deep Blue
        'HUFFLEPUFF': '#CA8A04'  // Gold/Yellow
    };
    
    const teamName = participant.teams ? participant.teams.name.toUpperCase() : 'INDEPENDENT';
    // Fallback to a premium dark gray if the team isn't in the list above
    const teamColor = teamColors[teamName] || '#374151'; 
    const photoSrc = participant.photo_url ? participant.photo_url : 'https://via.placeholder.com/150/E5E7EB/6B7280?text=PHOTO';
    
    card.innerHTML = `
        <div class="id-header" style="background: ${teamColor};">
            <h2>FEST 2026</h2>
            <p style="font-size: 8px; opacity: 0.8; letter-spacing: 1px;">OFFICIAL PASS</p>
        </div>
        <img src="${photoSrc}" class="id-photo" style="border-color: ${teamColor}; border-width: 4px;" alt="Participant">
        <div class="id-details">
            <div class="id-name" style="text-transform: uppercase; font-size: 18px; margin-bottom: 4px;">${participant.name}</div>
            <div class="id-team" style="color: white; background: ${teamColor}; padding: 3px 8px; border-radius: 12px; display: inline-block; font-size: 10px; margin-bottom: 8px;">${teamName}</div>
            <div class="id-cat" style="font-weight: 600; color: #475569;">${participant.categories?.name || 'GENERAL'}</div>
            <div class="id-uid" style="font-size: 11px; margin-top: 8px; font-weight: bold;">${participant.unique_id}</div>
        </div>
        <div class="id-qr" id="qr-${participant.id}"></div>
    `;
    return card;
}
async function generateSingleCard(participantId) {
    showToast('Generating PDF...', 'success');
    const { data: p, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').eq('id', participantId).single();
    if (error || !p) return showToast("Could not fetch participant data.", 'error');
    
    const container = document.getElementById('print-container');
    container.innerHTML = '';
    const cardElement = buildCardElement(p);
    container.appendChild(cardElement);
    
    new QRCode(document.getElementById(`qr-${p.id}`), { text: p.unique_id, width: 65, height: 65, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    
    const opt = { margin: 0, filename: `${p.name}_ID_Card.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 4, useCORS: true }, jsPDF: { unit: 'mm', format: 'a7', orientation: 'portrait' } };
    html2pdf().set(opt).from(cardElement).save().then(() => showToast('PDF Downloaded!'));
}

async function generateBulkCards() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; 
    btn.disabled = true;

    try {
        const { data: participants, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').order('name');
        if (error) throw error;
        if (!participants || !participants.length) { 
            showToast("No participants found to print.", 'error'); 
            return; 
        }

        const container = document.getElementById('print-container');
        container.innerHTML = '';

        participants.forEach(p => {
            const cardElement = buildCardElement(p);
            container.appendChild(cardElement);
            new QRCode(document.getElementById(`qr-${p.id}`), { text: p.unique_id, width: 65, height: 65, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
        });

        const opt = { margin: 0, filename: `Fest_2026_All_ID_Cards.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 4, useCORS: true }, jsPDF: { unit: 'mm', format: 'a7', orientation: 'portrait' } };
        html2pdf().set(opt).from(container).save().then(() => { 
            showToast('Bulk PDF Generated Successfully!');
            container.innerHTML = ''; 
        });
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false;
    }
}

// --- USER MANAGEMENT ---
async function loadUsers() {
    try {
        // Updated to fetch 'password_hash' from the database
        const { data, error } = await supabaseClient.from('users').select('id, username, role, password_hash').neq('role', 'master_admin').order('role');
        if(error) throw error;
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        (data || []).forEach(u => {
            const roleDisplay = u.role.replace('_', ' ').toUpperCase();
            
            // Safely stringify the user data to pass into the edit modal
            const safeData = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            tbody.innerHTML += `
                <tr>
                    <td>${u.username}</td>
                    <td><span class="badge badge-primary">${roleDisplay}</span></td>
                    <td>
                        <!-- Password field with toggle visibility -->
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="password" id="pwd-${u.id}" value="${u.password_hash || ''}" readonly style="border: none; background: transparent; width: 120px; font-weight: 600; color: var(--text-muted); outline: none; pointer-events: none;">
                            <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="togglePassword('${u.id}')" title="Reveal Password"><i class="fa-solid fa-eye" id="eye-${u.id}"></i></button>
                        </div>
                    </td>
                    <td>
                        <!-- Added the Edit button -->
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

// Updated User Modal to handle both Creating and Editing
function openUserModal(editData = null) {
    const isEdit = !!editData;
    const uId = isEdit ? editData.id : '';
    const uName = isEdit ? editData.username : '';
    const uPass = isEdit ? editData.password_hash : '';
    const uRole = isEdit ? editData.role : 'judge';

    openModal(isEdit ? 'Edit Staff Account' : 'Create Staff Account', `
        <input type="hidden" id="editUserId" value="${uId}">
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" value="${uName}" autocomplete="off"></div>
        <div class="form-group"><label>Password</label><input type="text" id="newPassword" value="${uPass}" autocomplete="off"></div>
        <div class="form-group">
            <label>Role</label>
            <select id="newUserRole">
                <option value="judge" ${uRole === 'judge' ? 'selected' : ''}>Judge</option>
                <option value="stage_controller" ${uRole === 'stage_controller' ? 'selected' : ''}>Stage Controller</option>
                <option value="fest_manager" ${uRole === 'fest_manager' ? 'selected' : ''}>Fest Manager</option>
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
        
        // Setup payload. If an ID exists, we append it so Supabase performs an UPDATE instead of an INSERT.
        const payload = { username, password_hash, role };
        if (id) payload.id = id;
        
        // Switched from .insert() to .upsert() to handle both creation and editing
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

// --- INITIALIZE DASHBOARD ---
document.addEventListener("DOMContentLoaded", () => {
    loadCategories();
});

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

// 2. Bulk Print Selected ID Cards
async function bulkPrintSelected() {
    const ids = getSelectedIds('participants-tbody');
    if(ids.length === 0) return showToast('No participants selected', 'error');

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; 
    btn.disabled = true;

    try {
        const { data: participants, error } = await supabaseClient
            .from('participants')
            .select('*, categories(name), teams(name)')
            .in('id', ids)
            .order('name');
            
        if (error) throw error;
        
        const container = document.getElementById('print-container');
        container.innerHTML = '';

        participants.forEach(p => {
            const cardElement = buildCardElement(p);
            container.appendChild(cardElement);
            new QRCode(document.getElementById(`qr-${p.id}`), { text: p.unique_id, width: 65, height: 65, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
        });

        const opt = { margin: 0, filename: `Selected_ID_Cards.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 4, useCORS: true }, jsPDF: { unit: 'mm', format: 'a7', orientation: 'portrait' } };
        html2pdf().set(opt).from(container).save().then(() => { 
            showToast('Selected PDFs Generated Successfully!');
            container.innerHTML = ''; 
        });
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
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
            compSelect.innerHTML += `<option value="${c.id}" data-limit="${c.max_participants}">${c.name}</option>`;
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
    workspace.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading students...</td></tr>';

    try {
        // Fetch Students: If General, get everyone. If Standard, filter by category_id.
        let studentQuery = supabaseClient.from('participants').select('*, teams(name)');
        if (!isGeneral) {
            studentQuery = studentQuery.eq('category_id', categoryId);
        }
        const { data: students, error: studentError } = await studentQuery.order('name');
        if (studentError) throw studentError;

        // Fetch Existing Assignments for this competition
        const { data: enrollments, error: enrollError } = await supabaseClient
            .from('participant_competitions')
            .select('participant_id')
            .eq('competition_id', compId);
        if (enrollError) throw enrollError;

        currentEnrolledStudentIds = (enrollments || []).map(e => e.participant_id);
        currentAssignEnrolled = currentEnrolledStudentIds.length;

        // Update Limit UI
        const limitDisplay = document.getElementById('assignLimitIndicator');
        limitDisplay.innerHTML = `<i class="fa-solid fa-users"></i> Enrollment: <span style="color:${currentAssignEnrolled >= currentAssignCompLimit ? 'var(--danger)' : 'var(--success)'}">${currentAssignEnrolled}</span> / ${currentAssignCompLimit} Limit`;

        // Render Table
        tbody.innerHTML = '';
        (students || []).forEach(s => {
            const isAssigned = currentEnrolledStudentIds.includes(s.id);
            const statusBadge = isAssigned 
                ? '<span class="badge" style="background:var(--success); color:white;">ASSIGNED</span>'
                : '<span class="badge" style="background:#E2E8F0; color:#475569;">UNASSIGNED</span>';
                
            tbody.innerHTML += `
                <tr data-team="${s.team_id || ''}" data-batch="${s.batch_no || ''}">
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${s.id}"></td>
                    <td style="font-family: monospace; font-weight: 600;">${s.unique_id}</td>
                    <td class="searchable-name">${s.name}</td>
                    <td>${s.teams?.name || 'INDEPENDENT'}</td>
                    <td>BATCH ${s.batch_no || '1'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
    } catch (e) {
        showToast(e.message, 'error');
    }
}
// Local Table Filter (Search, Team, Batch)
function filterAssignTable() {
    const searchVal = document.getElementById('assignSearch').value.toLowerCase();
    const teamVal = document.getElementById('assignFilterTeam').value;
    const batchVal = document.getElementById('assignFilterBatch').value;
    const rows = document.querySelectorAll('#assign-workspace-tbody tr');

    rows.forEach(row => {
        if(row.children.length === 1) return; // Skip "Loading..." row
        const text = row.querySelector('.searchable-name').innerText.toLowerCase() + " " + row.cells[1].innerText.toLowerCase();
        const rowTeam = row.getAttribute('data-team');
        const rowBatch = row.getAttribute('data-batch');

        const matchSearch = text.includes(searchVal);
        const matchTeam = teamVal === "" || rowTeam === teamVal;
        const matchBatch = batchVal === "" || rowBatch === batchVal;

        row.style.display = (matchSearch && matchTeam && matchBatch) ? '' : 'none';
    });
}

// Execute Bulk Assignment with Limit Checks
async function executeWorkspaceAssign() {
    const compId = document.getElementById('assignWorkComp').value;
    const ids = getSelectedIds('assign-workspace-tbody');
    
    if (ids.length === 0) return showToast('Select at least one student.', 'error');
    
    // Filter out students already assigned
    const newIds = ids.filter(id => !currentEnrolledStudentIds.includes(id));
    
    if (newIds.length === 0) return showToast('Selected students are already assigned.', 'error');
    if ((currentAssignEnrolled + newIds.length) > currentAssignCompLimit) {
        return showToast(`Limit Exceeded! You are trying to assign ${newIds.length} new students, but only ${currentAssignCompLimit - currentAssignEnrolled} slots remain.`, 'error');
    }

    const btn = document.getElementById('btnWorkspaceAssign');
    setLoading('btnWorkspaceAssign', true);

    try {
        const inserts = newIds.map(participant_id => ({ participant_id, competition_id: compId }));
        const { error } = await supabaseClient.from('participant_competitions').insert(inserts);
        if (error) throw error;
        
        showToast(`Successfully assigned ${newIds.length} students!`);
        document.querySelector('#assign-workspace-tbody').previousElementSibling.querySelector('input[type="checkbox"]').checked = false;
        loadAssignWorkspaceStudents(); // Refresh Data
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