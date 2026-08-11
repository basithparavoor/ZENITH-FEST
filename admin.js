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
        else if (tabId === 'point-settings') loadPointSettings(); 
        else if (tabId === 'branding-settings') loadBrandingSettings();
        else if (tabId === 'participant-points') loadParticipantPoints();
        else if (tabId === 'admin-appeals') loadAdminAppeals(); // <--- ADD THIS LINE
        else if (tabId === 'display-control') loadDisplaySettings();
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
<td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${cat.id}" ${globalSelections['categories-tbody']?.has(cat.id) ? 'checked' : ''} onchange="handleRowSelection('categories-tbody', this.value, this.checked)"></td>                    <td>${cat.name}</td>
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
    document.getElementById('listModalTable').parentElement.style.cssText = "max-height: 300px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm);";
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

// 1. Update the modal function to accept data and show general category links
function openCategoryModal(editData = null) {
    const isEdit = !!editData;
    const catId = isEdit ? editData.id : '';
    const catName = isEdit ? editData.name : '';
    const isGeneral = isEdit ? editData.is_general.toString() : 'false';
    const allowedGenerals = isEdit && editData.allowed_general_categories ? editData.allowed_general_categories : [];

    // Filter out only general categories
    let generalCats = categoriesList.filter(c => c.is_general && c.id !== catId);
    let generalOptsHtml = '';
    
    if (generalCats.length > 0) {
        generalOptsHtml = `
            <div class="form-group" id="general-eligibility-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border); ${isGeneral === 'true' ? 'display:none;' : 'display:block;'}">
                <label style="margin-bottom: 0.5rem; display: block; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">Eligible General Categories</label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">Select which general categories students from this standard category are allowed to participate in.</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding-right: 0.5rem;">
                    ${generalCats.map(gc => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
                            <input type="checkbox" class="cat-general-eligibility" value="${gc.id}" ${allowedGenerals.includes(gc.id) ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary);">
                            ${gc.name}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    openModal(isEdit ? 'Edit Category' : 'Create Category', `
        <input type="hidden" id="catId" value="${catId}">
        <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="catName" value="${catName}" placeholder="E.G. SENIOR SECONDARY">
        </div>
        <div class="form-group">
            <label>Type</label>
            <select id="catGeneral" onchange="const el = document.getElementById('general-eligibility-section'); if(el) el.style.display = this.value === 'true' ? 'none' : 'block';">
                <option value="false" ${isGeneral === 'false' ? 'selected' : ''}>Standard (Limits apply)</option>
                <option value="true" ${isGeneral === 'true' ? 'selected' : ''}>General (Anyone can participate)</option>
            </select>
        </div>
        ${generalOptsHtml}
    `, saveCategory);
}

// 2. Update the save function to Upsert with the new array
async function saveCategory() {
    const id = document.getElementById('catId').value;
    const name = document.getElementById('catName').value;
    const is_general = document.getElementById('catGeneral').value === 'true';
    
    // Grab all checked IDs
    const allowed_general_categories = Array.from(document.querySelectorAll('.cat-general-eligibility:checked')).map(cb => cb.value);

    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { 
            name, 
            is_general, 
            allowed_general_categories: is_general ? [] : allowed_general_categories 
        };
        if (id) payload.id = id;

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
let compRowsPerPage = 10;
let filteredCompetitionsList = []; 

async function loadCompetitions() {
    try {
        if (stagesList.length === 0) { const { data } = await supabaseClient.from('stages').select('*'); stagesList = data || []; }
        if (categoriesList.length === 0) await loadCategories();
        if (teamsList.length === 0) { const { data } = await supabaseClient.from('teams').select('*'); teamsList = data || []; }

        const { data, error } = await supabaseClient
            .from('competitions')
            .select(`*, categories(name), stages(name), participant_competitions(count)`)
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
        const studentCount = comp.participant_competitions?.[0]?.count || 0; 
        const totalCapacity = (comp.max_participants || 0) * (teamsList.length || 0); 
        
        // NEW: Check if it's an offstage event
let stageDisplay = comp.stages?.name || 'Unassigned';
        if (comp.is_offstage) {
            stageDisplay += ` <br><span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; margin-top: 4px; display: inline-block; font-size: 0.65rem;"><i class="fa-solid fa-pen-nib"></i> OFFSTAGE</span>`;
        }    
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${comp.id}" ${globalSelections['competitions-tbody']?.has(comp.id) ? 'checked' : ''} onchange="handleRowSelection('competitions-tbody', this.value, this.checked)"></td>
                <td style="font-weight: 700;">${comp.name}</td>
                <td><span class="badge badge-primary">${comp.categories?.name || 'N/A'}</span></td>
                <td>${stageDisplay}</td>
                
                <td style="font-weight: 700; color: var(--text-main);">${comp.max_mark || '0'}</td>
                
                <td>
                    <span class="badge-count" onclick="viewCompParticipants('${comp.id}')" title="Click to view enrolled">
                        ${studentCount} / ${totalCapacity} Total
                    </span>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">(${comp.max_participants} PER TEAM)</div>
                </td>
               <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openCompModal(${JSON.stringify(comp).replace(/'/g, "&apos;")})' title="Edit"><i class="fa-solid fa-pen"></i></button>
                        
                        
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--primary); border-color:var(--primary);" onclick="viewCompetitionLog('${comp.id}')" title="View Master Log"><i class="fa-solid fa-file-invoice"></i></button>
                        
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="bulkDownloadCertificates('${comp.id}')" title="Download Merit Certificates"><i class="fa-solid fa-award"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteCompetition('${comp.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
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

    // Ensure the Select All box is unchecked visually when pages change
    const masterCb = document.querySelector('#competitions-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredCompetitionsList.length} entries
            <select onchange="compRowsPerPage = parseInt(this.value); compCurrentPage = 1; renderCompetitionsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${compRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${compRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${compRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${compRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
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
       container.innerHTML = getPDFHeaderHTML('Competitions Directory');

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
        // Fetch competition details to know if it's a group event
        const { data: comp } = await supabaseClient.from('competitions').select('is_group').eq('id', compId).single();

        // Fetch participants along with their team details and leader status
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select('is_leader, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);
            
        if (error) throw error;
        
        // Reset container styling for tabular modal display
        const container = document.getElementById('listModalTable').parentElement;
        container.style.cssText = "max-height: 350px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm); border-radius: var(--radius-md);";

        const tbody = document.getElementById('listModalTable');
        tbody.innerHTML = `<tr><th style="padding: 1rem;">PARTICIPANT NAME</th><th style="padding: 1rem;">TEAM</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td colspan="2" style="color:var(--text-muted); text-align:center; padding: 2rem;">No students assigned.</td></tr>`;
        } else {
            data.forEach(item => {
                const p = item.participants;
                const teamName = p?.teams?.name || 'INDEPENDENT';
                
                let roleBadge = '';
                if (comp && comp.is_group) {
                    roleBadge = item.is_leader 
                        ? `<br><span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; margin-top: 6px;">GROUP LEADER</span>` 
                        : `<br><span class="badge" style="background: var(--bg-main); color: var(--text-muted); font-size: 0.65rem; margin-top: 6px;">MEMBER</span>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td style="padding: 1rem;">
                            <strong style="font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.2rem;">${p?.name}</strong>
                            <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${p?.unique_id}</span>
                            ${roleBadge}
                        </td>
                        <td style="padding: 1rem; vertical-align: top;">
                            <span class="badge" style="background: var(--bg-main); color: var(--primary); font-weight: 700; border: 1px solid var(--border);">${teamName}</span>
                        </td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Enrolled Students`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast(e.message, 'error'); 
    }
}

function openCompModal(editData = null) {
    const isEdit = !!editData;
    const cId = isEdit ? editData.id : '';
    const cName = isEdit ? editData.name : '';
    const cMarks = isEdit ? editData.max_mark : '100';
    const cLimit = isEdit ? editData.max_participants : '1';
    const cIsGroup = isEdit ? editData.is_group : false; 
    const cIsOffstage = isEdit ? editData.is_offstage : false; // NEW: Offstage Flag

    let catOpts = categoriesList.map(c => `<option value="${c.id}" ${isEdit && editData.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    let stageOpts = stagesList.map(s => `<option value="${s.id}" ${isEdit && editData.stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    const cAwardType = isEdit ? editData.award_type || 'none' : 'none';

    openModal(isEdit ? 'Edit Competition' : 'New Competition', `
        <input type="hidden" id="compId" value="${cId}">
        <div class="form-group"><label>Competition Name</label><input type="text" id="compName" value="${cName}"></div>
        
        <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem;">
            <div class="form-group" style="flex: 1; display: flex; align-items: center; gap: 0.5rem; background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); margin: 0;">
                <input type="checkbox" id="compIsGroup" ${cIsGroup ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--primary); cursor: pointer;">
                <label for="compIsGroup" style="margin: 0; color: var(--primary); font-weight: 700; cursor: pointer;">Group Event</label>
            </div>
            <div class="form-group" style="flex: 1; display: flex; align-items: center; gap: 0.5rem; background: #FEF3C7; padding: 1rem; border-radius: var(--radius-md); margin: 0;">
                <input type="checkbox" id="compIsOffstage" ${cIsOffstage ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #D97706; cursor: pointer;">
                <label for="compIsOffstage" style="margin: 0; color: #D97706; font-weight: 700; cursor: pointer;">Offstage Event</label>
            </div>
        </div>

        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Category</label><select id="compCategory">${catOpts}</select></div>
            <div class="form-group" style="flex:1;"><label>Stage</label><select id="compStage"><option value="">-- NO STAGE YET --</option>${stageOpts}</select></div>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Max Marks</label><input type="number" id="compMarks" value="${cMarks}"></div>
            <div class="form-group" style="flex:1;"><label>Participants / Team</label><input type="number" id="compParticipants" value="${cLimit}"></div>
        </div>
        
        <!-- NEW AWARD CATEGORY SELECTOR -->
        <div class="form-group" style="margin-top: 0.5rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
            <label><i class="fa-solid fa-trophy" style="color:var(--primary);"></i> Special Award Eligibility</label>
            <select id="compAwardType" style="border-color: var(--primary);">
                <option value="none" ${cAwardType === 'none' ? 'selected' : ''}>Standard Event (No Special Award)</option>
                <option value="star" ${cAwardType === 'star' ? 'selected' : ''}>⭐ Star of the Fest Event</option>
                <option value="pen" ${cAwardType === 'pen' ? 'selected' : ''}>🖋️ Pen of the Fest Event</option>
            </select>
        </div>
    `, saveCompetition);
}

async function saveCompetition() {
    const id = document.getElementById('compId').value;
    const name = document.getElementById('compName').value;
    const category_id = document.getElementById('compCategory').value;
    const is_offstage = document.getElementById('compIsOffstage').checked; // NEW
const stage_id = document.getElementById('compStage').value || null;    const max_mark = document.getElementById('compMarks').value;
    const max_participants = document.getElementById('compParticipants').value;
   const is_group = document.getElementById('compIsGroup').checked; 
    const award_type = document.getElementById('compAwardType').value; // <-- ADD THIS
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { name, category_id, stage_id, max_mark, max_participants, is_group, is_offstage, award_type }; // <-- ADD award_type HERE
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
let partRowsPerPage = 10;
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
const dobFilter = document.getElementById('filterPartDob') ? document.getElementById('filterPartDob').value : "";
    
    filteredParticipantsList = participantsList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        
        const partCatName = p.categories?.name || '';
        const matchCat = catFilter === "" || partCatName === catFilter;
        
        const partTeamName = p.teams?.name || '';
        const matchTeam = teamFilter === "" || partTeamName === teamFilter;
        
        const matchDob = dobFilter === "" || p.dob === dobFilter;
return matchName && matchCat && matchTeam && matchDob;
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
const photoSrc = p.photo_url ? p.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3ENO PHOTO%3C/text%3E%3C/svg%3E';        
        tbody.innerHTML += `
            <tr>
<td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}" ${globalSelections['participants-tbody']?.has(p.id) ? 'checked' : ''} onchange="handleRowSelection('participants-tbody', this.value, this.checked)"></td>                <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${p.unique_id}</td>
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

    const masterCb = document.querySelector('#participants-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredParticipantsList.length} entries
            <select onchange="partRowsPerPage = parseInt(this.value); partCurrentPage = 1; renderParticipantsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${partRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${partRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${partRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${partRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
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
        container.innerHTML = getPDFHeaderHTML('Participants Directory');

        // Map over the filtered list to respect any active search criteria
        let tableRows = filteredParticipantsList.map((p, index) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.teams?.name || 'UNASSIGNED'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.categories?.name || 'N/A'}</td>
<td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.dob || 'N/A'}</td>
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
                        <th style="padding: 10px;">DOB</th>
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
            "DOB": p.dob || 'N/A'
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
const photoSrc = p.photo_url ? p.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3ENO PHOTO%3C/text%3E%3C/svg%3E';    
    document.getElementById('listModalTitle').innerText = 'Participant Identity';
    
    // Reset wrapper styling to allow flexible component layout
    const container = document.getElementById('listModalTable').parentElement;
    container.style.border = 'none';
    container.style.boxShadow = 'none';
    container.style.background = 'transparent';
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';
    
    document.getElementById('listModalTable').innerHTML = `
        <style>
            #listModalTable { display: block; width: 100%; border: none; }
            #listModalTable tbody, #listModalTable tr, #listModalTable td { 
                display: block; width: 100%; border: none; padding: 0; background: transparent; 
            }
            #listModalTable td::before { display: none !important; }

            .pid-wrapper { display: flex; flex-direction: column; gap: 1rem; width: 100%; }
            
            /* Top Card */
            .pid-top { 
                display: flex; gap: 1.5rem; background: white; border: 1px solid var(--border); 
                border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); align-items: center; 
            }
            .pid-photo { 
                width: 110px; height: 140px; flex-shrink: 0; border-radius: 12px; 
                overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm); 
            }
            .pid-photo img { width: 100%; height: 100%; object-fit: cover; }
            
            .pid-info { flex: 1; text-align: left; overflow: hidden; }
            .pid-name { 
                font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; 
                line-height: 1.2; word-break: break-word; text-transform: uppercase; 
            }
            .pid-badge { 
                background: var(--primary); color: white; padding: 0.35rem 0.75rem; 
                border-radius: 8px; font-family: monospace; font-size: 0.9rem; font-weight: 700; 
                display: inline-block; margin-bottom: 0.75rem; white-space: nowrap; 
                box-shadow: 0 4px 10px rgba(79,70,229,0.2); 
            }
            .pid-meta { 
                display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8rem; 
                font-weight: 700; color: var(--text-muted); text-transform: uppercase; 
            }
            .pid-meta-item { display: flex; align-items: center; gap: 0.5rem; }

            /* Bottom Cards */
            .pid-bottom { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: stretch; }
            
            .pid-qr-card { 
                background: white; border: 1px solid var(--border); border-radius: 16px; 
                padding: 1.25rem; display: flex; flex-direction: column; align-items: center; 
                justify-content: center; gap: 0.5rem; box-shadow: var(--shadow-sm); 
            }
            .pid-qr-box { width: 110px; height: 110px; display: flex; justify-content: center; align-items: center; }
            
            .pid-actions { display: flex; flex-direction: column; gap: 1rem; }
            .pid-dob-card { 
                background: var(--primary-light); border: 1px solid rgba(79,70,229,0.15); 
                border-radius: 16px; padding: 1.25rem; display: flex; justify-content: space-between; 
                align-items: center; flex: 1; min-height: 80px;
            }
            
            .pid-btn { 
                width: 100%; justify-content: center; padding: 1rem; border-radius: 12px; 
                background: white; border: 2px solid var(--border); font-weight: 800; 
                color: var(--text-main); transition: all 0.2s; box-shadow: var(--shadow-sm); 
                cursor: pointer; display: flex; align-items: center; gap: 0.5rem; 
                font-size: 0.9rem; text-transform: uppercase; 
            }
            .pid-btn:hover { border-color: var(--primary); color: var(--primary); }

            /* Mobile Stack Optimization */
            @media (max-width: 600px) {
                .pid-top { flex-direction: column; align-items: center; text-align: center; padding: 1.5rem 1rem; }
                .pid-info { text-align: center; display: flex; flex-direction: column; align-items: center; }
                .pid-bottom { grid-template-columns: 1fr; }
            }
        </style>
        
        <tbody>
            <tr>
                <td>
                    <div class="pid-wrapper">
                        
                        <!-- Top Profile Section -->
                        <div class="pid-top">
                            <div class="pid-photo">
                                <img src="${photoSrc}" alt="Photo">
                            </div>
                            <div class="pid-info">
                                <div class="pid-name">${p.name}</div>
                                <div class="pid-badge">${p.unique_id}</div>
                                <div class="pid-meta">
                                    <div class="pid-meta-item"><i class="fa-solid fa-users" style="color: var(--primary); width: 16px;"></i> ${teamName}</div>
                                    <div class="pid-meta-item"><i class="fa-solid fa-layer-group" style="color: var(--primary); width: 16px;"></i> ${catName}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Bottom Section -->
                        <div class="pid-bottom">
                            <!-- QR Code -->
                            <div class="pid-qr-card">
                                <div id="qr-container-${p.unique_id}" class="pid-qr-box">
                                    <i class="fa-solid fa-spinner fa-spin" style="color: var(--text-muted); font-size: 1.5rem;"></i>
                                </div>
                                <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em;">SCAN TO VERIFY</span>
                            </div>

                            <!-- Actions & DOB -->
                            <div class="pid-actions">
                                <div class="pid-dob-card">
                                    <div style="display: flex; flex-direction: column; gap: 0.25rem; text-align: left;">
                                        <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); letter-spacing: 0.05em; text-transform: uppercase;">DATE OF BIRTH</span>
                                        <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${p.dob || 'NOT PROVIDED'}</span>
                                    </div>
                                    <i class="fa-solid fa-cake-candles" style="font-size: 1.75rem; color: var(--primary); opacity: 0.3;"></i>
                                </div>

                                <button class="pid-btn" onclick="viewParticipantEnrollments('${p.id}')">
                                    <i class="fa-solid fa-clipboard-list"></i> VIEW ENROLLMENTS
                                </button>
                            </div>
                        </div>

                    </div>
                </td>
            </tr>
        </tbody>
    `;

    document.getElementById('listModal').classList.add('show');

    // Generate the QR code dynamically
    setTimeout(() => {
        const qrContainer = document.getElementById(`qr-container-${p.unique_id}`);
        if (qrContainer) {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: p.unique_id,
                width: 110,
                height: 110,
                colorDark: "#0F172A",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, 50);
}
// NEW FUNCTION: specifically joins competitions and categories to the participant
async function viewParticipantEnrollments(participantId) {
    document.getElementById('listModalTable').parentElement.style.cssText = "max-height: 300px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm);";
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
    
    // CHANGED: Load 'dob' instead of 'batch_no'
    const pDob = isEdit && editData.dob ? editData.dob : '';
    
    const pUniqueId = isEdit ? editData.unique_id : '';
const pPhoto = isEdit && editData.photo_url ? editData.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23EEF2FF"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236366F1"%3EPHOTO%3C/text%3E%3C/svg%3E';
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
                    
                    <!-- CHANGED: Replaced Batch input with Date of Birth -->
                    <div class="form-group" style="flex: 1; min-width: 130px;">
                        <label>Date of Birth</label>
                        <input type="date" id="partDob" value="${pDob}" style="text-transform: none;">
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
    
    // CHANGED: Grab Date of Birth instead of Batch No
    const dob = document.getElementById('partDob').value || null;
    
    // Grab the existing unique_id if editing, otherwise generate a new one
    let unique_id = document.getElementById('partUniqueId').value;
    if (!id || !unique_id) {
        unique_id = `${Math.floor(100000 + Math.random() * 900000)}`; // <--- UPDATED LINE
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

        // CHANGED: Include 'dob' in the payload
        const payload = { name, team_id, category_id, dob, unique_id };
        
        if (id) payload.id = id; 
        if (photo_url) payload.photo_url = photo_url; 

        const { error } = await supabaseClient.from('participants').upsert([payload]);
        if (error) throw error;
        
        showToast(id ? 'Participant updated!' : 'Participant registered successfully!');
        
        if(currentCropper) { currentCropper.destroy(); currentCropper = null; }
        
        closeModal(); 
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
                
                // <--- UPDATED LINE BELOW --->
                if (tableName === 'participants' && !row.unique_id) row.unique_id = `${Math.floor(100000 + Math.random() * 900000)}`;
                
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
    // Existing code: Show cross-portal menu for both Admin and Master Admin
    if (user && (user.role === 'master_admin' || user.role === 'admin')) {
        const portalMenu = document.getElementById('master-admin-portals');
        if (portalMenu) portalMenu.style.display = 'block';
    }

    // ---> NEW CODE: Show Data Center ONLY for Master Admin <---
    if (user && user.role === 'master_admin') {
        const dataCenterTab = document.getElementById('nav-data-center');
        if (dataCenterTab) dataCenterTab.style.display = 'block';
    }
    
    // Continue with the rest of your initialization...
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
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
    const displayMode = brandingData.display_mode || 'both'; // 'both', 'logo', 'name'
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    // 2. Global Favicon Injection (Fixes missing Favicons)
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

    // 3. UI Header Updates (Fixes display preferences & sizing)
    // Grabs the sidebar brand, navbar brand, and the main header h1
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1');
    
    brandContainers.forEach(container => {
        // Safety check to avoid overwriting page titles like "Workspace Overview"
        if(container.id === 'page-title') return; 

        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // Dynamic Logo Sizing
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 32px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '8px' : '0'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // Dynamic Text
        if (showName) {
            let textToDisplay = validName ? brandingData.fest_name : 'FestOS';
            
            // If this is the specific Program Report header, append its title
            if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                textToDisplay += ' Reports Engine';
            }
            
            html += `<span style="letter-spacing: -0.5px;">${textToDisplay}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'wrap'; // Prevents layout crunching
        
        // Keeps centered strictly on Login and Scan screens
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login') || window.location.pathname.includes('index') || window.location.pathname === '/') {
            container.style.justifyContent = 'center';
        }
    });

    // Store globally so the PDF Generators can read the display preference
    if (typeof window !== 'undefined') window.systemBranding = brandingData;
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

const globalSelections = {
    'categories-tbody': new Set(),
    'competitions-tbody': new Set(),
    'participants-tbody': new Set(),
    'points-tbody': new Set(),
    'assign-workspace-tbody': new Set()
};

function handleRowSelection(tbodyId, value, isChecked) {
    if (!globalSelections[tbodyId]) globalSelections[tbodyId] = new Set();
    if (isChecked) globalSelections[tbodyId].add(value);
    else globalSelections[tbodyId].delete(value);
}

function clearSelection(tbodyId) {
    if (globalSelections[tbodyId]) globalSelections[tbodyId].clear();
    const masterCb = document.querySelector(`#${tbodyId}`)?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if (masterCb) masterCb.checked = false;
    
    // Uncheck DOM elements if any are still visible
    document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`).forEach(cb => cb.checked = false);
}

function toggleSelectAll(tbodyId, masterCheckbox) {
    const checkboxes = document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`);
    checkboxes.forEach(cb => {
        if (cb.closest('tr').style.display !== 'none') {
            cb.checked = masterCheckbox.checked;
            handleRowSelection(tbodyId, cb.value, masterCheckbox.checked);
        }
    });
}

function getSelectedIds(tbodyId) {
    // Fallback sync for manually checked DOM items just in case
    const domChecked = Array.from(document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb:checked`)).map(cb => cb.value);
    domChecked.forEach(val => handleRowSelection(tbodyId, val, true));
    return Array.from(globalSelections[tbodyId] || []);
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
            
           clearSelection(tbodyId);
            
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
clearSelection('participants-tbody');
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
        const limitDisplay = document.getElementById('assignLimitIndicator');
        limitDisplay.innerHTML = `<i class="fa-solid fa-users"></i> Max Enrollment: ${currentAssignCompLimit} Participants Per Team`;
        
        // --- NEW: Calculate Allowed Categories ---
        let allowedCatIds = [categoryId]; 
        if (isGeneral && typeof categoriesList !== 'undefined') {
            categoriesList.forEach(c => {
                if (c.allowed_general_categories && c.allowed_general_categories.includes(categoryId)) {
                    allowedCatIds.push(c.id);
                }
            });
        }
        
        let studentQuery = supabaseClient.from('participants').select('*, teams(name)');
        if (!isGeneral) {
            studentQuery = studentQuery.eq('category_id', categoryId);
        } else {
            studentQuery = studentQuery.in('category_id', allowedCatIds);
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
        
        // NEW: Update table header dynamically based on competition type
        document.querySelector('#assign-workspace-tbody').parentElement.querySelector('thead tr').innerHTML = `
            <th class="checkbox-cell"><input type="checkbox" onchange="toggleSelectAll('assign-workspace-tbody', this)"></th>
            <th>Unique ID</th>
            <th>Participant Name</th>
            <th>Team</th>
            <th>DOB</th>
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
                <tr data-team="${s.team_id || ''}" data-dob="${s.dob || ''}">
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${s.id}" ${globalSelections['assign-workspace-tbody']?.has(s.id) ? 'checked' : ''} onchange="handleRowSelection('assign-workspace-tbody', this.value, this.checked)"></td>
                    <td style="font-family: monospace; font-weight: 600;">${s.unique_id}</td>
                    <td class="searchable-name">${s.name}</td>
                    <td>${s.teams?.name || 'INDEPENDENT'}</td>
                    <td>${s.dob || 'N/A'}</td>
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

// Local Table Filter (Search, Team, DOB, Status)
function filterAssignTable() {
    const searchVal = document.getElementById('assignSearch').value.toLowerCase();
    const teamVal = document.getElementById('assignFilterTeam').value;
    const dobVal = document.getElementById('assignFilterDob').value;
    const statusVal = document.getElementById('assignFilterStatus').value; 
    
    const rows = document.querySelectorAll('#assign-workspace-tbody tr');

    rows.forEach(row => {
        if(row.children.length === 1) return; // Skip "Loading..." row
        
        // Grab values from the row attributes and cells
        const text = row.querySelector('.searchable-name').innerText.toLowerCase() + " " + row.cells[1].innerText.toLowerCase();
        const rowTeam = row.getAttribute('data-team');
        const rowDob = row.getAttribute('data-dob');

        // Dynamically determine the row's assignment status based on the badge text in the last cell
        const statusText = row.cells[5].innerText.toLowerCase();
        let rowStatus = 'unassigned';
        if (statusText.includes('assigned') && !statusText.includes('unassigned') || statusText.includes('leader') || statusText.includes('party')) {
            rowStatus = 'assigned';
        }

        // Evaluate all filter conditions
        const matchSearch = text.includes(searchVal);
        const matchTeam = teamVal === "" || rowTeam === teamVal;
        const matchDob = dobVal === "" || rowDob === dobVal;
        const matchStatus = statusVal === "" || rowStatus === statusVal; 

        // Hide or show row based on ALL conditions matching
        row.style.display = (matchSearch && matchTeam && matchDob && matchStatus) ? '' : 'none';
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

        // --- NEW: STRICT LIMIT CHECK PER TEAM ---
        if (currentAssignCompLimit > 0) {
            // Fetch existing enrollments to count current team assignments
            const { data: existing, error: existErr } = await supabaseClient
                .from('participant_competitions')
                .select('participant_id, participants(team_id)')
                .eq('competition_id', compId);
            
            if (existErr) throw existErr;

            const teamCounts = {};
            (existing || []).forEach(e => {
                const tId = e.participants?.team_id || 'INDEPENDENT';
                teamCounts[tId] = (teamCounts[tId] || 0) + 1;
            });

            // Count how many new ones we are trying to add per team
            const newTeamCounts = {};
            newStudents.forEach(s => {
                const tId = s.team_id || 'INDEPENDENT';
                newTeamCounts[tId] = (newTeamCounts[tId] || 0) + 1;
            });

            // Verify limits
            for (const [tId, count] of Object.entries(newTeamCounts)) {
                const current = teamCounts[tId] || 0;
                if (current + count > currentAssignCompLimit) {
                    const teamName = teamsList.find(t => t.id === tId)?.name || 'INDEPENDENT';
                    throw new Error(`Limit Exceeded for team '${teamName}'! Max ${currentAssignCompLimit} participants allowed per team. (Currently enrolled: ${current}, Trying to add: ${count})`);
                }
            }
        }
        // --- END LIMIT CHECK ---

        // Group the new students by team for group leader mapping
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
        clearSelection('assign-workspace-tbody');
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
       container.innerHTML = getPDFHeaderHTML('Master Assignment Ledger');

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
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // Return null if broken to prevent canvas crash
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

    const mappedData = {
        'ParticipantName': participant.name.toUpperCase(),
        // <--- UPDATED LINE BELOW --->
        'UniqueID': participant.unique_id || `${participant.id.substring(0,6)}`.toUpperCase(),
        'TeamName': participant.teams?.name?.toUpperCase() || 'INDEPENDENT',
        'Category': participant.categories?.name?.toUpperCase() || '',
        'DateOfBirth': participant.dob || ''
    };

    for (const [key, field] of Object.entries(template.fields)) {
        if (!field.enabled) continue;

        if (field.isImage) {
            // Render Participant Photo
            if (key === 'Photo') {
                const photoSrc = participant.photo_url || null; // Removed external URL dependency
                let pPhoto = null;
                
                if (photoSrc) {
                    pPhoto = await loadImagePromise(photoSrc);
                }
                
                ctx.save();
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(field.x, field.y, field.w, field.h, field.radius || 0);
                else ctx.rect(field.x, field.y, field.w, field.h);
                ctx.clip();
                
                // If image successfully loaded, draw it
                if (pPhoto && pPhoto.naturalWidth > 0) {
                    ctx.drawImage(pPhoto, field.x, field.y, field.w, field.h);
                } else {
                    // Native Canvas Fallback (No external URL needed)
                    ctx.fillStyle = "#E2E8F0"; // Light gray background
                    ctx.fillRect(field.x, field.y, field.w, field.h);
                    
                    ctx.fillStyle = "#94A3B8"; // Slate text color
                    ctx.font = "bold 24px Inter, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("NO PHOTO", field.x + (field.w / 2), field.y + (field.h / 2));
                }
                
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

// DRAG & RESIZE STATE
let isDraggingLayer = false;
let isResizingLayer = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
let resizeStartX = 0;
let resizeStartY = 0;

const TEMPLATE_SCHEMAS = {
    individual: ['Result Number', 'Category', 'Competition', 'Position 1 Name', 'Position 1 Team', 'Position 1 Photo', 'Position 2 Name', 'Position 2 Team', 'Position 2 Photo', 'Position 3 Name', 'Position 3 Team', 'Position 3 Photo'],
    team: ['Results Count Text', 'Rank 1 Team', 'Rank 1 Points', 'Rank 2 Team', 'Rank 2 Points', 'Rank 3 Team', 'Rank 3 Points', 'Rank 4 Team', 'Rank 4 Points', 'Rank 5 Team', 'Rank 5 Points'],
    final: ['Total Competitions Count', 'Rank 1 Team', 'Rank 1 Points', 'Rank 2 Team', 'Rank 2 Points', 'Rank 3 Team', 'Rank 3 Points', 'Rank 4 Team', 'Rank 4 Points', 'Rank 5 Team', 'Rank 5 Points'],
    id_card: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Date of Birth', 'Photo', 'QR Code'],
    certificate: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Competition', 'Position', 'Grade', 'Issue Date', 'QR Code'] // NEW: Certificate Schema
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
    'ParticipantName': 'JOHN DOE', 'UniqueID': 'FEST-26-987654', 'BatchNo': 'BATCH 1',
    'Position': 'FIRST PLACE', 'Grade': 'A+ GRADE', 'IssueDate': new Date().toLocaleDateString()
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
        
        // Rehydrate main background image
        studioActiveData.imgObj = new Image();
        studioActiveData.imgObj.crossOrigin = "Anonymous"; 
        studioActiveData.imgObj.onload = () => drawStudioCanvas();
        if (studioActiveData.bg_base64) studioActiveData.imgObj.src = studioActiveData.bg_base64;

        // Rehydrate static uploaded elements (logos, SVGs, etc.)
        if (studioActiveData.fields) {
            Object.keys(studioActiveData.fields).forEach(key => {
                const field = studioActiveData.fields[key];
                if (field.isStaticElement && field.src) {
                    field.imgObj = new Image();
                    field.imgObj.crossOrigin = "Anonymous";
                    // Redraw canvas once this specific element loads
                    field.imgObj.onload = () => drawStudioCanvas();
                    field.imgObj.src = field.src;
                }
            });
        }

        // ---> NEW: Rehydrate Custom Fonts <---
        if (studioActiveData.customFonts && studioActiveData.customFonts.length > 0) {
            studioActiveData.customFonts.forEach(async (fontData) => {
                // Prevent adding the same font to the dropdown multiple times if opened twice
                if (!AVAILABLE_FONTS.find(f => f.value === fontData.family)) {
                    try {
                        const customFont = new FontFace(fontData.family, `url(${fontData.url})`);
                        const loadedFace = await customFont.load();
                        document.fonts.add(loadedFace);
                        
                        AVAILABLE_FONTS.push({ name: fontData.name, value: fontData.family });
                        
                        // Redraw the canvas just in case it drew before the font finished downloading
                        drawStudioCanvas(); 
                    } catch (e) {
                        console.error("Failed to rehydrate custom font:", fontData.family, e);
                    }
                }
            });
        }
    } else {
        // Initialize a brand new template
        studioActiveData = { 
            id: 'TPL_' + Date.now(), 
            name: '', 
            type: 'individual', 
            bg_base64: null, 
            imgObj: new Image(), 
            fields: {},
            customFonts: [] // Ensure the array exists for new templates
        };
        
        studioActiveData.imgObj.crossOrigin = "Anonymous";
        
        document.getElementById('studio-template-name').value = '';
        document.getElementById('studio-template-type').value = 'individual';
    }
    
    studioActiveField = null;
    
    // Reset History Stacks
    undoStack = [];
    redoStack = [];
    updateHistoryButtons();
    
    initializeStudioFields();
}
function closeTemplateStudio() {
    document.getElementById('template-studio-view').style.display = 'none';
    document.getElementById('template-library-view').style.display = 'block';
    loadTemplatesList(); 
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



let historyTimeout = null;

function updateActiveProperty(prop, value) {
    if (!studioActiveField) return;
    const data = studioActiveData.fields[studioActiveField];
    const isNum = ['x','y','w','h','size','radius'].includes(prop);
    const val = isNum ? (parseInt(value) || 0) : value;

    // ---> NEW: Save History once per interaction burst <---
    if (!historyTimeout && !isRestoringHistory) saveHistoryState();
    clearTimeout(historyTimeout);
    historyTimeout = setTimeout(() => { historyTimeout = null; }, 800);

    // Handle Proportional Scaling
    if (prop === 'w' && data.aspectLocked && data.aspectRatio) {
        data.w = val;
        data.h = Math.round(val / data.aspectRatio);
        const propH = document.getElementById('prop-h');
        if (propH) propH.value = data.h;
    } else if (prop === 'h' && data.aspectLocked && data.aspectRatio) {
        data.h = val;
        data.w = Math.round(val * data.aspectRatio);
        const propW = document.getElementById('prop-w');
        if (propW) propW.value = data.w;
    } else {
        data[prop] = val;
    }

    if (!data.aspectLocked && (prop === 'w' || prop === 'h')) {
        if (data.w > 0 && data.h > 0) data.aspectRatio = data.w / data.h;
    }

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
function initializeStudioFields() {
    const type = document.getElementById('studio-template-type').value;
    studioActiveData.type = type;
    const requiredFields = TEMPLATE_SCHEMAS[type];
    
    const validKeys = new Set();

    // 1. Build Data Defaults for the selected Template Sector
    requiredFields.forEach(field => {
        const key = field.replace(/\s+/g, '');
        validKeys.add(key);
        const isImage = (key.includes('Photo') || key === 'QRCode');        
        
        if (!studioActiveData.fields[key]) {
            if (isImage) {
                studioActiveData.fields[key] = { 
                    enabled: false, x: 100, y: 150, w: 250, h: 300, radius: 20, 
                    isImage: true, aspectLocked: true, aspectRatio: 250 / 300 
                };
            } else {
                studioActiveData.fields[key] = { 
                    enabled: false, x: 100, y: 150, size: 40, color: '#0F172A', 
                    align: 'left', font: 'Inter, sans-serif', weight: 'bold', isImage: false 
                };
            }
        }
        studioActiveData.fields[key].displayName = field;
    });

    // 2. Dynamic Purging: Remove layers that don't belong to this sector (but KEEP custom layers)
    Object.keys(studioActiveData.fields).forEach(key => {
        const f = studioActiveData.fields[key];
        if (f.isCustom || f.isStaticElement) {
            validKeys.add(key); // Protect custom uploads and texts
        }
        
        if (!validKeys.has(key)) {
            delete studioActiveData.fields[key]; // Purge irrelevant layers
        }
    });

    // If the currently selected layer was just purged, unselect it
    if (studioActiveField && !studioActiveData.fields[studioActiveField]) {
        studioActiveField = null;
    }

    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

// NEW: Add a Custom Text Layer
function addCustomTextLayer() {
    const key = 'CustomText_' + Date.now();
    studioActiveData.fields[key] = {
        enabled: true,
        displayName: "New Custom Text", // Used as the actual text content
        x: 200,
        y: 200,
        size: 60,
        color: '#0F172A',
        align: 'center',
        font: 'Inter, sans-serif',
        weight: 'bold',
        isImage: false,
        isCustom: true // Flags it so it isn't deleted during sector switches
    };

    saveHistoryState();
    renderLayersPanel();
    selectStudioLayer(key);
}

// UPDATED: Generic Delete function for both Custom Text and Uploaded Images
function deleteStudioLayer(key) {
    if (confirm("Delete this layer permanently?")) {
        saveHistoryState();
        delete studioActiveData.fields[key];
        if (studioActiveField === key) studioActiveField = null;
        renderLayersPanel();
        renderPropertiesPanel();
        drawStudioCanvas();
    }
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
        const lockIcon = data.aspectLocked ? 'fa-lock' : 'fa-lock-open';
        const deleteBtn = data.isStaticElement 
            ? `<button class="btn btn-outline" style="grid-column: span 3; border-color: var(--danger); color: var(--danger); margin-top: 0.5rem;" onclick="deleteStudioLayer('${key}')"><i class="fa-solid fa-trash"></i> Delete Element</button>` 
            : '';

        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; margin-top: 1rem; align-items: end;">
                <div><label style="font-size: 0.75rem; font-weight:700;">WIDTH</label><input type="number" id="prop-w" value="${data.w}" oninput="updateActiveProperty('w', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <button class="btn btn-outline" style="padding: 0.5rem; height: 35px; width: 35px; display: flex; justify-content: center; align-items: center;" onclick="toggleAspectRatioLock('${key}')" title="Toggle Aspect Ratio Lock"><i class="fa-solid ${lockIcon}"></i></button>
                <div><label style="font-size: 0.75rem; font-weight:700;">HEIGHT</label><input type="number" id="prop-h" value="${data.h}" oninput="updateActiveProperty('h', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <div style="grid-column: span 3;"><label style="font-size: 0.75rem; font-weight:700;">CORNER RADIUS</label><input type="number" id="prop-rad" value="${data.radius || 0}" oninput="updateActiveProperty('radius', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                ${deleteBtn}
            </div>
        `;
    } else {
        // Handle Custom Text Name Changing
        let customTextHTML = '';
        if (data.isCustom) {
            customTextHTML = `
                <div style="grid-column: span 2;">
                    <label style="font-size: 0.75rem; font-weight:700;">TEXT CONTENT</label>
                    <input type="text" value="${data.displayName}" oninput="updateActiveProperty('displayName', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                </div>
            `;
        }

        const deleteBtn = data.isCustom 
            ? `<button class="btn btn-outline" style="grid-column: span 2; border-color: var(--danger); color: var(--danger); margin-top: 0.5rem;" onclick="deleteStudioLayer('${key}')"><i class="fa-solid fa-trash"></i> Delete Layer</button>` 
            : '';

        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
                ${customTextHTML}
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
                ${deleteBtn}
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
            if (data.isStaticElement) {
                if (data.imgObj && data.imgObj.src) {
                    ctx.drawImage(data.imgObj, data.x, data.y, data.w, data.h);
                }
                if (studioActiveField === key) {
                    ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 4; ctx.setLineDash([10, 5]);
                    ctx.strokeRect(data.x, data.y, data.w, data.h); ctx.setLineDash([]);
                }
            } else {
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(data.x, data.y, data.w, data.h, data.radius || 0);
                else ctx.rect(data.x, data.y, data.w, data.h); 
                
                ctx.fillStyle = key.includes('Photo') ? 'rgba(79, 70, 229, 0.2)' : 'rgba(15, 23, 42, 0.1)';            
                ctx.fill();

                if (studioActiveField === key) {
                    ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 6; ctx.setLineDash([15, 10]);
                    ctx.stroke(); ctx.setLineDash([]);
                }

                ctx.fillStyle = '#0F172A'; ctx.font = "bold 28px Inter"; ctx.textAlign = "center";
                ctx.fillText(data.displayName, data.x + (data.w / 2), data.y + (data.h / 2) + 10);
            }

            if (studioActiveField === key) {
                ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 2;
                const hSize = 14; 
                ctx.fillRect(data.x + data.w - (hSize/2), data.y + data.h - (hSize/2), hSize, hSize);
                ctx.strokeRect(data.x + data.w - (hSize/2), data.y + data.h - (hSize/2), hSize, hSize);
            }
            
        } else {
            ctx.textAlign = data.align; ctx.fillStyle = data.color;
            ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
            
            // Render custom text as the display name, else use the mock data
            const mockText = data.isCustom ? data.displayName : (STUDIO_MOCK_DATA[key] || data.displayName.toUpperCase());
            
            if (studioActiveField === key) {
                ctx.shadowColor = 'rgba(79, 70, 229, 0.8)'; ctx.shadowBlur = 15;
                ctx.fillText(mockText, data.x, data.y);
                ctx.shadowBlur = 0; 
            } else {
                ctx.fillText(mockText, data.x, data.y);
            }
        }
    }
}

// --- 4. DRAG, DROP & RESIZE INTERACTION ---
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('studio-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX; 
        const mouseY = (e.clientY - rect.top) * scaleY;

       // 1. Check if we are clicking a Resize Handle
        if (studioActiveField && studioActiveData.fields[studioActiveField].isImage) {
            const data = studioActiveData.fields[studioActiveField];
            const hitZone = 20; 
            
            if (mouseX >= data.x + data.w - hitZone && mouseX <= data.x + data.w + hitZone &&
                mouseY >= data.y + data.h - hitZone && mouseY <= data.y + data.h + hitZone) {
                
                saveHistoryState(); // <-- ADD THIS LINE HERE
                
                isResizingLayer = true;
                resizeStartW = data.w;
                // ... [keep rest of resize logic]
                resizeStartH = data.h;
                resizeStartX = mouseX;
                resizeStartY = mouseY;
                return; // Stop here, we are resizing, not selecting/dragging
            }
        }

        // 2. If not resizing, do standard Hit Detection (Drag/Select)
        let hit = null;
        const keys = Object.keys(studioActiveData.fields).reverse();
        
        for(let key of keys) {
            const data = studioActiveData.fields[key];
            if(!data.enabled) continue;

            if(data.isImage) {
                if(mouseX >= data.x && mouseX <= data.x + data.w && mouseY >= data.y && mouseY <= data.y + data.h) {
                    hit = key; break;
                }
            } else {
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

       // ... [hit detection loop] ...

        if(hit) {
            if (studioActiveField !== hit) selectStudioLayer(hit);
            
            saveHistoryState(); // <-- ADD THIS LINE HERE
            
            isDraggingLayer = true;
            dragOffsetX = mouseX - studioActiveData.fields[hit].x;
            // ... [keep rest of drag logic]
        } else {
            studioActiveField = null; 
            renderLayersPanel(); 
            renderPropertiesPanel(); 
            drawStudioCanvas();
        }
    });

    canvas.addEventListener('mousemove', function(e) {
        if(!studioActiveField) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX; 
        const mouseY = (e.clientY - rect.top) * scaleY;
        const data = studioActiveData.fields[studioActiveField];

        // HANDLE RESIZING
        if (isResizingLayer) {
            let deltaX = mouseX - resizeStartX;
            
            // Calculate new width (prevent it from getting too small)
            let newW = Math.max(20, resizeStartW + deltaX);
            let newH = data.h; // Default

            if (data.aspectLocked && data.aspectRatio) {
                newH = Math.round(newW / data.aspectRatio);
            } else {
                let deltaY = mouseY - resizeStartY;
                newH = Math.max(20, resizeStartH + deltaY);
            }

            data.w = newW;
            data.h = newH;

            // Live update the properties panel
            const propW = document.getElementById('prop-w');
            const propH = document.getElementById('prop-h');
            if (propW) propW.value = data.w;
            if (propH) propH.value = data.h;
            
            drawStudioCanvas();
            return;
        }

        // HANDLE DRAGGING
        if(isDraggingLayer) {
            data.x = Math.round(mouseX - dragOffsetX);
            data.y = Math.round(mouseY - dragOffsetY);

            const propX = document.getElementById('prop-x');
            const propY = document.getElementById('prop-y');
            if(propX) propX.value = data.x;
            if(propY) propY.value = data.y;

            drawStudioCanvas();
        }
    });

    window.addEventListener('mouseup', () => { 
        isDraggingLayer = false; 
        isResizingLayer = false; 
    });
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
        clearSelection('participants-tbody');
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
        clearSelection('participants-tbody');
        loadParticipants();
    } catch (e) { showToast(e.message, 'error'); }
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
            
            // Load the new display mode
            const displaySelect = document.getElementById('setting-branding-display');
            if(displaySelect && data.value.display_mode) displaySelect.value = data.value.display_mode;

            if (data.value.fest_logo) {
                const preview = document.getElementById('branding-logo-preview');
                preview.src = data.value.fest_logo;
                preview.style.display = 'block';
                pendingBrandingLogoBase64 = data.value.fest_logo; 
                
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
        fest_logo: pendingBrandingLogoBase64,
        display_mode: document.getElementById('setting-branding-display') ? document.getElementById('setting-branding-display').value : 'both'
    };

    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'system_branding', value: payload });
        if (error) throw error;
        
        showToast("Branding Settings Saved to Database!");
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
    const displayMode = brandingData.display_mode || 'both'; // 'both', 'logo', 'name'
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    // 2. Global Favicon Injection (Works on Master Admin, Login, and all pages)
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

    // 3. UI Header & Logo Sizing Engine
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1');
    
    brandContainers.forEach(container => {
        if(container.id === 'page-title') return; 

        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // Configurable Logo Sizing (Clean height parameter with max constraints)
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 36px; width: auto; max-width: 180px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // Dynamic Text
        if (showName) {
            let textToDisplay = validName ? brandingData.fest_name : 'FestOS';
            
            if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                textToDisplay += ' Reports Engine';
            }
            
            html += `<span style="letter-spacing: -0.5px; display: inline-block; vertical-align: middle;">${textToDisplay}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'nowrap'; // Keeps logo and text side-by-side cleanly
        
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login') || window.location.pathname.includes('index') || window.location.pathname === '/') {
            container.style.justifyContent = 'center';
        }
    });

    if (typeof window !== 'undefined') window.systemBranding = brandingData;
}
// ============================================================================
// PARTICIPANT POINTS LEDGER ENGINE
// ============================================================================
let pointsDataList = [];
let filteredPointsList = [];
let pointsCurrentPage = 1;
let pointsRowsPerPage = 10;
let pointsAdminSettings = {
    thresholds: { aplus: 90, a: 70, b: 60, c: 50 },
    points_solo: { aplus: 8, a: 7, b: 5, c: 3 },
    points_small: { aplus: 12, a: 10, b: 7, c: 5 },
    points_large: { aplus: 15, a: 12, b: 10, c: 7 },
    pos_points: { p1: 3, p2: 2, p3: 1 },
    poster_interval: 10,
    tm_access: true
};

async function loadPointSettings() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();        
        if (data && data.value) {
            pointsAdminSettings = data.value;
            const v = data.value;
            
            // Map to UI
            ['aplus', 'a', 'b', 'c'].forEach(g => {
                if(document.getElementById(`th-${g}`)) document.getElementById(`th-${g}`).value = v.thresholds[g];
                if(document.getElementById(`pt-solo-${g}`)) document.getElementById(`pt-solo-${g}`).value = v.points_solo[g];
                if(document.getElementById(`pt-small-${g}`)) document.getElementById(`pt-small-${g}`).value = v.points_small[g];
                if(document.getElementById(`pt-large-${g}`)) document.getElementById(`pt-large-${g}`).value = v.points_large[g];
            });
            if(document.getElementById('pos-1')) document.getElementById('pos-1').value = v.pos_points.p1;
            if(document.getElementById('pos-2')) document.getElementById('pos-2').value = v.pos_points.p2;
            if(document.getElementById('pos-3')) document.getElementById('pos-3').value = v.pos_points.p3;
            if(document.getElementById('setting-poster-interval')) document.getElementById('setting-poster-interval').value = v.poster_interval;
            
            // ADDED: Load Lock Date
            if(document.getElementById('setting-lock-date')) document.getElementById('setting-lock-date').value = v.lock_date || '';
            
            if(document.getElementById('setting-tm-access')) {
                const checkbox = document.getElementById('setting-tm-access');
                checkbox.checked = v.tm_access !== false;
                checkbox.dispatchEvent(new Event('change')); 
            }
        }
    } catch (e) { console.warn("Using default point settings."); }
}

async function savePointSettings() {
    const getVal = (id) => parseInt(document.getElementById(id).value) || 0;
    const payload = {
        thresholds: { aplus: getVal('th-aplus'), a: getVal('th-a'), b: getVal('th-b'), c: getVal('th-c') },
        points_solo: { aplus: getVal('pt-solo-aplus'), a: getVal('pt-solo-a'), b: getVal('pt-solo-b'), c: getVal('pt-solo-c') },
        points_small: { aplus: getVal('pt-small-aplus'), a: getVal('pt-small-a'), b: getVal('pt-small-b'), c: getVal('pt-small-c') },
        points_large: { aplus: getVal('pt-large-aplus'), a: getVal('pt-large-a'), b: getVal('pt-large-b'), c: getVal('pt-large-c') },
        pos_points: { p1: getVal('pos-1'), p2: getVal('pos-2'), p3: getVal('pos-3') },
        poster_interval: getVal('setting-poster-interval'),
        // ADDED: Save Lock Date
        lock_date: document.getElementById('setting-lock-date') ? document.getElementById('setting-lock-date').value : null,
        tm_access: document.getElementById('setting-tm-access') ? document.getElementById('setting-tm-access').checked : true
    };

    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'point_system', value: payload });
        if (error) throw error;
        pointsAdminSettings = payload;
        showToast("Point Settings Saved Successfully!");
    } catch (e) { showToast(e.message, 'error'); }
}
let teamPointsList = []; // New Global Array

async function loadParticipantPoints() {
    try {
        await loadPointSettings();

        // Fetch everything needed
        const { data: comps } = await supabaseClient.from('competitions').select('*, categories(name, is_general), participant_competitions(count)');
        const { data: participants } = await supabaseClient.from('participants').select('*, teams(name), categories(name)');
        const { data: judgements } = await supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark');

        // Create mapping for fast participant lookups
        const pMap = {};
        (participants || []).forEach(p => pMap[p.id] = p);

        let compAverages = {}; 
        (judgements || []).forEach(j => {
           if(!compAverages[j.competition_id]) compAverages[j.competition_id] = {};
           if(!compAverages[j.competition_id][j.participant_id]) compAverages[j.competition_id][j.participant_id] = { marks_array: [] };
           compAverages[j.competition_id][j.participant_id].marks_array.push(parseFloat(j.awarded_mark));
        });

        let compResults = {};
        let teamResults = {};

        // Initialize Team Totals
        (teamsList || []).forEach(t => {
            teamResults[t.id] = { team: t, breakdown: [], totalPoints: 0, participantCount: 0 };
        });

        // Pre-count total participants per team
        (participants || []).forEach(p => {
            if (p.team_id && teamResults[p.team_id]) teamResults[p.team_id].participantCount++;
        });

        (comps || []).forEach(comp => {
            if(!compAverages[comp.id]) return;
            
            const participantsArr = Object.entries(compAverages[comp.id]).map(([pId, data]) => {
                let sortedMarks = data.marks_array.sort((a, b) => a - b);
                if (sortedMarks.length >= 3) sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
                const sum = sortedMarks.reduce((a, b) => a + b, 0);
                return { id: pId, mark: sum / sortedMarks.length };
            }).sort((a, b) => b.mark - a.mark);

            const limit = comp.max_participants || 1;
            let sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            const registeredCount = comp.participant_competitions?.[0]?.count || 0;
            const eligibleForPosPoints = registeredCount >= 3;
            
            let currentRank = 1;
            let previousScore = -1;

            participantsArr.forEach((p, index) => {
                if (p.mark !== previousScore) currentRank = index + 1;
                previousScore = p.mark;

                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let grade = '-'; let gradePts = 0; let posPts = 0;

                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) { grade = 'A+'; gradePts = pointsAdminSettings[`points_${sizeCat}`].aplus; }
                    else if (percent >= pointsAdminSettings.thresholds.a) { grade = 'A'; gradePts = pointsAdminSettings[`points_${sizeCat}`].a; }
                    else if (percent >= pointsAdminSettings.thresholds.b) { grade = 'B'; gradePts = pointsAdminSettings[`points_${sizeCat}`].b; }
                    else { grade = 'C'; gradePts = pointsAdminSettings[`points_${sizeCat}`].c; }
                }
                
                if (eligibleForPosPoints && currentRank <= 3) {
                    if (currentRank === 1) posPts = pointsAdminSettings.pos_points.p1;
                    else if (currentRank === 2) posPts = pointsAdminSettings.pos_points.p2;
                    else if (currentRank === 3) posPts = pointsAdminSettings.pos_points.p3;
                }
                
                const totalPts = gradePts + posPts;
                const pData = pMap[p.id];
                const tId = pData ? pData.team_id : null;
                
                // === THE NEW ROUTING LOGIC WITH AWARD TRACKING ===
                if (comp.is_group) {
                    // Group Events: Add ONLY to Team Ledger
                    if (tId && teamResults[tId]) {
                        teamResults[tId].breakdown.push({
                            compName: comp.name,
                            compCat: comp.categories?.name || 'General',
                            mark: p.mark.toFixed(2),
                            maxMark: comp.max_mark || 100,
                            grade: grade,
                            totalPts: totalPts,
                            participantName: (pData?.name || 'Unknown') + " & PARTY",
                            type: 'Group Event',
                            awardType: comp.award_type // Track award type
                        });
                        teamResults[tId].totalPoints += totalPts;
                    }
                } else {
                    // Individual Events: Add to Participant Ledger
                    if(!compResults[p.id]) compResults[p.id] = [];
                    compResults[p.id].push({
                        compName: comp.name, 
                        compCat: comp.categories?.name || 'General',
                        mark: p.mark.toFixed(2), 
                        maxMark: comp.max_mark || 100, 
                        grade: grade, 
                        totalPts: totalPts,
                        awardType: comp.award_type // Track award type here
                    });

                    // Individual Events: ALSO add to Team Ledger
                    if (tId && teamResults[tId]) {
                        teamResults[tId].breakdown.push({
                            compName: comp.name,
                            compCat: comp.categories?.name || 'General',
                            mark: p.mark.toFixed(2), 
                            maxMark: comp.max_mark || 100,
                            grade: grade, 
                            totalPts: totalPts,
                            participantName: pData?.name || 'Unknown',
                            type: 'Individual Event',
                            awardType: comp.award_type // Track award type
                        });
                        teamResults[tId].totalPoints += totalPts;
                    }
                }
            });
        });

        // Apply to participant list with Star/Pen calculation
        pointsDataList = (participants || []).map(p => {
            const breakdown = compResults[p.id] || [];
            const totalPoints = breakdown.reduce((sum, b) => sum + b.totalPts, 0);
            
            // NEW: Calculate specific award points
            const starPoints = breakdown.filter(b => b.awardType === 'star').reduce((sum, b) => sum + b.totalPts, 0);
            const penPoints = breakdown.filter(b => b.awardType === 'pen').reduce((sum, b) => sum + b.totalPts, 0);
            
            return { ...p, totalPoints, starPoints, penPoints, breakdown };
        });

        // Apply to team list and sort highest first
        teamPointsList = Object.values(teamResults).sort((a, b) => b.totalPoints - a.totalPoints);

        populateDropdownSafe('filterPointsCategory', categoriesList);
        populateDropdownSafe('filterPointsTeam', teamsList);
        filterPointsTable(true);
        renderTeamPointsTable();
        
        // Auto-refresh the special ledger if a special tab is currently active
        const starBtn = document.getElementById('btn-view-star');
        const penBtn = document.getElementById('btn-view-pen');
        if (starBtn && starBtn.classList.contains('btn-primary')) renderSpecialLedger('star');
        if (penBtn && penBtn.classList.contains('btn-primary')) renderSpecialLedger('pen');

    } catch (e) { showToast(e.message, 'error'); }
}

// UI Switcher
function switchPointsView(view) {
    if (view === 'individual') {
        document.getElementById('btn-view-ind').className = 'btn btn-primary';
        document.getElementById('btn-view-team').className = 'btn btn-outline';
        document.getElementById('ind-points-container').style.display = 'block';
        document.getElementById('team-points-container').style.display = 'none';
        document.getElementById('ind-filters').style.display = 'flex';
        document.getElementById('btn-export-points').setAttribute('onclick', 'bulkExportPointsPDF()');
    } else {
        document.getElementById('btn-view-ind').className = 'btn btn-outline';
        document.getElementById('btn-view-team').className = 'btn btn-primary';
        document.getElementById('ind-points-container').style.display = 'none';
        document.getElementById('team-points-container').style.display = 'block';
        document.getElementById('ind-filters').style.display = 'none';
        document.getElementById('btn-export-points').setAttribute('onclick', 'bulkExportTeamPointsPDF()');
    }
}

// Render Team Table
function renderTeamPointsTable() {
    const tbody = document.getElementById('team-points-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (teamPointsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>`;
        return;
    }

    teamPointsList.forEach((t, i) => {
        let rankBadge = i === 0 ? '<i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 5px;"></i>' : '';
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${t.team.id}" ${globalSelections['team-points-tbody']?.has(t.team.id) ? 'checked' : ''} onchange="handleRowSelection('team-points-tbody', this.value, this.checked)"></td>
                <td style="font-weight: 800; font-size: 1.15rem; color: var(--text-main);">${rankBadge}${t.team.name}</td>
                <td style="color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-users" style="margin-right: 5px;"></i>${t.participantCount} Enrolled</td>
                <td style="font-weight: 900; color: var(--primary); font-size: 1.25rem;">${t.totalPoints} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PTS</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewTeamPointDetails('${t.team.id}')"><i class="fa-solid fa-list"></i> View Ledger</button>
                </td>
            </tr>
        `;
    });
}

// Modal Preview for Team
function viewTeamPointDetails(teamId) {
    const t = teamPointsList.find(x => x.team.id === teamId);
    if (!t) return;

   let trs = t.breakdown.length > 0 ? t.breakdown.map((b, i) => `
        <tr>
            <td>
                <strong style="font-weight: 700;">${b.participantName}</strong><br>
                <small style="color: var(--text-muted); font-weight: 600;"><i class="fa-solid ${b.type === 'Group Event' ? 'fa-users' : 'fa-user'}" style="margin-right:4px;"></i>${b.type}</small>
            </td>
            <td style="font-weight: 600;">${b.compName} <br><span class="badge" style="background:var(--primary-light); font-size:0.65rem; margin-top:4px; display: inline-block;">${b.compCat}</span></td>
            <td style="text-align: right; color: var(--text-muted); font-weight: 600;">${b.mark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary); font-size: 1.1rem;">${b.totalPts}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1rem;">No points earned yet.</td></tr>`;

    document.getElementById('listModalTitle').innerText = 'Team Championship Ledger';
    
    document.getElementById('listModalTable').innerHTML = `
        <tbody>
            <tr>
                <td colspan="4" style="padding: 0; border: none; padding-bottom: 1rem;">
                    <div style="background: var(--bg-main); padding: 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 1.4rem; font-weight: 900; line-height: 1.2; color: var(--text-main); text-transform: uppercase;">${t.team.name}</div>
                            <div style="font-family: monospace; color: var(--text-muted); font-size: 0.95rem; font-weight: 600; margin-top: 0.25rem;">${t.participantCount} STUDENTS ENROLLED</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">TOTAL SCORE</div>
                            <div style="font-size: 2rem; font-weight: 900; color: var(--primary); line-height: 1;">${t.totalPoints}</div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr style="background: var(--bg-main); font-size: 0.75rem; color: var(--text-muted);">
                <th style="padding: 0.75rem 1rem;">Contestant / Group</th>
                <th style="padding: 0.75rem 1rem;">Program Evaluated</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Final Marks</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Points</th>
            </tr>
            ${trs}
        </tbody>
    `;
    
    document.getElementById('listModal').classList.add('show');
}

// PDF Generation for Team
function bulkExportTeamPointsPDF() {
    const ids = getSelectedIds('team-points-tbody');
    let targetList = ids.length > 0 ? teamPointsList.filter(t => ids.includes(t.team.id)) : teamPointsList;
    
    if (targetList.length === 0) return showToast("No teams to export", "error");
    
    showToast("Generating Team Reports PDF...", "success");
    const container = document.createElement('div');
    container.style.fontFamily = 'Inter, sans-serif';
    container.style.width = '100%';
    container.style.background = 'white';

    targetList.forEach((t, index) => {
       let trs = t.breakdown.length > 0 ? t.breakdown.map((b, i) => `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px; font-size: 12px;">${i+1}</td>
                <td style="padding: 12px; font-size: 12px;">
                    <strong style="font-weight: 700; color: #0F172A;">${b.participantName.toUpperCase()}</strong><br>
                    <span style="font-size: 9px; color: #64748B; font-weight: 600;">${b.type.toUpperCase()}</span>
                </td>
                <td style="padding: 12px; font-size: 12px; font-weight: 600;">${b.compName.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 12px;">${b.compCat.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.mark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 14px; text-align: right; font-weight: 800; color: #4F46E5;">${b.totalPts}</td>
            </tr>
        `).join('') : `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748B; font-weight: 600;">No programs evaluated yet.</td></tr>`;

        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 30px;">
                    ${getPDFHeaderHTML('Team Championship Ledger')}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #EEF2FF; padding: 20px; border-radius: 12px; border: 1px solid rgba(79, 70, 229, 0.2);">
                    <div>
                        <p style="font-size: 10px; color: #4F46E5; font-weight: 800; margin-bottom: 4px;">TEAM DESIGNATION</p>
                        <h2 style="font-size: 24px; font-weight: 800; color: #0F172A; margin: 0; text-transform: uppercase;">${t.team.name}</h2>
                        <p style="font-size: 12px; color: #64748B; margin-top: 6px; font-weight: 600;">TOTAL ENROLLED: ${t.participantCount} STUDENTS</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: #4F46E5; font-weight: 800; margin-bottom: 4px;">TEAM MANAGER</p>
                        <h2 style="font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; text-transform: uppercase;">${t.team.manager_name || 'NOT ASSIGNED'}</h2>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #1E293B; color: white; text-align: left;">
                            <th style="padding: 12px; font-size: 11px;">#</th>
                            <th style="padding: 12px; font-size: 11px;">CONTESTANT / GROUP</th>
                            <th style="padding: 12px; font-size: 11px;">PROGRAM EVALUATED</th>
                            <th style="padding: 12px; font-size: 11px;">CATEGORY</th>
                            <th style="padding: 12px; font-size: 11px; text-align: center;">FINAL MARKS</th>
                            <th style="padding: 12px; font-size: 11px; text-align: right;">POINTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                    <tfoot>
                        <tr style="background: #F1F5F9; border-top: 2px solid #CBD5E1;">
                            <td colspan="5" style="padding: 16px; text-align: right; font-weight: 800; font-size: 14px; color: #0F172A;">TOTAL CHAMPIONSHIP POINTS:</td>
                            <td style="padding: 16px; text-align: right; font-weight: 900; font-size: 20px; color: #4F46E5;">${t.totalPoints}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 0, 
        filename: `FestOS_Team_Ledger.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported Successfully!'));
}

function populateDropdownSafe(id, list) {
    const el = document.getElementById(id);
    if(el && el.options.length === 1 && list && list.length > 0) {
        list.forEach(i => el.innerHTML += `<option value="${i.name}">${i.name}</option>`);
    }
}

function filterPointsTable(resetPage = true) {
    const query = document.getElementById('searchPointsInput').value.toLowerCase();
    const catFilter = document.getElementById('filterPointsCategory').value;
    const teamFilter = document.getElementById('filterPointsTeam').value;
    const dobFilter = document.getElementById('filterPointsDob').value;
    
    filteredPointsList = pointsDataList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        const matchCat = catFilter === "" || (p.categories?.name || '') === catFilter;
        const matchTeam = teamFilter === "" || (p.teams?.name || '') === teamFilter;
        const matchDob = dobFilter === "" || p.dob === dobFilter;
return matchName && matchCat && matchTeam && matchDob;
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
<td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}" ${globalSelections['points-tbody']?.has(p.id) ? 'checked' : ''} onchange="handleRowSelection('points-tbody', this.value, this.checked)"></td>                <td style="font-family: monospace; font-weight: 600; color: var(--text-muted);">${p.unique_id}</td>
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

   const masterCb = document.querySelector('#points-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredPointsList.length} participants
            <select onchange="pointsRowsPerPage = parseInt(this.value); pointsCurrentPage = 1; renderPointsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${pointsRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${pointsRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${pointsRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${pointsRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
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
            <!-- CHANGE THE NEXT TWO LINES 👇 -->
            <td style="text-align: right;">${b.mark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary);">${b.totalPts}</td>
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
                <!-- CHANGE THE NEXT TWO LINES 👇 -->
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.mark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 12px; text-align: right; font-weight: 700; color: #4F46E5;">${b.totalPts}</td>
            </tr>
        `).join('') : `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748B;">No programs evaluated yet.</td></tr>`;

        // The "page-break-after: always" ensures each participant gets their own clean page
        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 30px;">
                    ${getPDFHeaderHTML('Participant Point Ledger')}
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

async function handleElementUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show a quick loading state on the button to let the admin know it's uploading
    const uploadBtn = event.target.nextElementSibling; 
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `element_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('elements') // Pointing to the new bucket we created in SQL
            .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // 2. Get the permanent Public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from('elements')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        // 3. Load the URL into the Studio Canvas
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = function() {
            const key = 'Element_' + Date.now();
            
            // Scale down initially if the image is massive
            let initialWidth = img.naturalWidth;
            let initialHeight = img.naturalHeight;
            if (initialWidth > 300) {
                initialHeight = initialHeight * (300 / initialWidth);
                initialWidth = 300;
            }

            // Inside handleElementUpload, update the properties:
            studioActiveData.fields[key] = {
                enabled: true,
                displayName: file.name.substring(0, 15) + '...',
                x: 50,
                y: 50,
                w: Math.round(initialWidth),
                h: Math.round(initialHeight),
                isImage: true,
                isStaticElement: true,
                aspectLocked: true, // NEW: Default to locked
                aspectRatio: initialWidth / initialHeight, // NEW: Store initial ratio
                src: publicUrl, 
                imgObj: img
            };
            
            renderLayersPanel();
            selectStudioLayer(key);
            
            // Clear the input so the same file can be uploaded again if needed
            document.getElementById('studio-element-upload').value = ''; 
        };
        
        img.src = publicUrl;

    } catch (err) {
        console.error("Upload error:", err);
        showToast("Failed to upload element to cloud.", "error");
    } finally {
        // Reset the button UI
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
}



function toggleAspectRatioLock(key) {
    const data = studioActiveData.fields[key];
    data.aspectLocked = !data.aspectLocked;
    
    // Recalculate ratio upon locking if they changed it while unlocked
    if (data.aspectLocked && data.w > 0 && data.h > 0) {
        data.aspectRatio = data.w / data.h;
    }
    renderPropertiesPanel();
}

// --- UNDO / REDO STATE ENGINE ---
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 25; // Prevents memory leaks
let isRestoringHistory = false;

function saveHistoryState() {
    if (!studioActiveData || !studioActiveData.fields || isRestoringHistory) return;
    
    // Create a deep copy of the layer configurations
    const stateCopy = {};
    for (const key in studioActiveData.fields) {
        stateCopy[key] = { ...studioActiveData.fields[key] };
    }
    
    undoStack.push(stateCopy);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    
    redoStack = []; // A new action invalidates the future redo timeline
    updateHistoryButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    isRestoringHistory = true;
    
    // Push current to redo
    const currentState = {};
    for (const key in studioActiveData.fields) {
        currentState[key] = { ...studioActiveData.fields[key] };
    }
    redoStack.push(currentState);
    
    // Restore past
    studioActiveData.fields = undoStack.pop();
    finalizeHistoryAction();
}

function redo() {
    if (redoStack.length === 0) return;
    isRestoringHistory = true;
    
    // Push current to undo
    const currentState = {};
    for (const key in studioActiveData.fields) {
        currentState[key] = { ...studioActiveData.fields[key] };
    }
    undoStack.push(currentState);
    
    // Restore future
    studioActiveData.fields = redoStack.pop();
    finalizeHistoryAction();
}

function finalizeHistoryAction() {
    studioActiveField = null; // Clear active selections to prevent ghost resizing handles
    updateHistoryButtons();
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
    isRestoringHistory = false;
}

function updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

async function handleFontUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show loading state
    const uploadBtn = event.target.nextElementSibling;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_').split('_')[0]; 
        const fileName = `font_${safeName}_${Date.now()}.${fileExt}`;
        const familyName = `CustomFont_${Date.now()}`; // Unique internal CSS name

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('fonts')
            .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from('fonts')
            .getPublicUrl(fileName);
        const publicUrl = publicUrlData.publicUrl;

        // 3. Load the Font into the Browser natively
        const customFont = new FontFace(familyName, `url(${publicUrl})`);
        const loadedFace = await customFont.load();
        document.fonts.add(loadedFace);

        // 4. Add to the Global Dropdown list
        const displayName = file.name.split('.')[0].substring(0, 15);
        AVAILABLE_FONTS.push({ name: `⭐ ${displayName}`, value: familyName });

        // 5. Save the font data into the template state so it persists in the database
        if (!studioActiveData.customFonts) studioActiveData.customFonts = [];
        studioActiveData.customFonts.push({ 
            name: `⭐ ${displayName}`, 
            family: familyName, 
            url: publicUrl 
        });

        // 6. Automatically apply the new font to the currently selected text layer (if any)
        if (studioActiveField && !studioActiveData.fields[studioActiveField].isImage) {
            saveHistoryState(); // From your undo/redo engine
            studioActiveData.fields[studioActiveField].font = familyName;
        }

        renderPropertiesPanel();
        drawStudioCanvas();
        showToast("Custom font added successfully!", "success");

    } catch (err) {
        console.error("Font upload error:", err);
        showToast("Failed to upload font.", "error");
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        event.target.value = ''; // Reset input
    }
}

// ==========================================
// MASTER DATA CENTER & ZIP ENGINE (V2.0)
// ==========================================

let pendingSecureAction = null;
let pendingFileToImport = null;

// ALL Database tables in correct dependency order
const MASTER_TABLES = [
    'settings', 
    'categories', 
    'teams', 
    'competitions', 
    'templates', 
    'participants', 
    'participant_competitions', 
    'judgements', 
    'appeals'
];

// ALL Supabase Storage Buckets containing media
const STORAGE_BUCKETS = ['photos', 'templates', 'elements', 'fonts'];

function requestSecureAction(action) {
    pendingSecureAction = action;
    document.getElementById('master-auth-password').value = '';
    document.getElementById('masterPasswordModal').classList.add('show');
}

function handleBackupSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingFileToImport = file;
    requestSecureAction('import');
    event.target.value = ''; // Reset input
}

async function verifyMasterPassword() {
    const btn = document.getElementById('btn-verify-master');
    const pwd = document.getElementById('master-auth-password').value;
    
    if(!pwd) return showToast("Password required", "error");
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, role')
            .eq('username', user.username)
            .eq('password_hash', pwd)
            .single();

        if (error || !data) throw new Error("Invalid password");
        if (data.role !== 'master_admin') throw new Error("Unauthorized access level.");

        document.getElementById('masterPasswordModal').classList.remove('show');
        
        // Route to the requested action
        if (pendingSecureAction === 'export') await executeZipExport();
        if (pendingSecureAction === 'import') await executeZipImport();
        if (pendingSecureAction === 'reset') await executeFactoryReset();

    } catch (err) {
        showToast("Authentication failed: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Verify';
        btn.disabled = false;
        pendingSecureAction = null;
    }
}

// --- 1. FULL EXPORT LOGIC (DATABASE + STORAGE) ---
async function executeZipExport() {
    showToast("Gathering database & media files... This may take a minute.", "success");
    const zip = new JSZip();
    const dbFolder = zip.folder("database");
    const storageFolder = zip.folder("storage");

    try {
        // A. Export Database Tables
        for (const table of MASTER_TABLES) {
            const { data, error } = await supabaseClient.from(table).select('*');
            if (error) console.error(`Error fetching ${table}:`, error);
            dbFolder.file(`${table}.json`, JSON.stringify(data || [], null, 2));
        }

        // B. Export Storage Buckets (Images/Fonts)
        for (const bucket of STORAGE_BUCKETS) {
            const bucketFolder = storageFolder.folder(bucket);
            const { data: files, error: listError } = await supabaseClient.storage.from(bucket).list();
            
            if (listError || !files) continue;

            for (const file of files) {
                if (file.name === '.emptyFolderPlaceholder') continue; // Skip supabase hidden files
                
                const { data: blob, error: downloadError } = await supabaseClient.storage.from(bucket).download(file.name);
                if (blob && !downloadError) {
                    bucketFolder.file(file.name, blob);
                }
            }
        }

        // C. Generate Manifest
        zip.file("festos_manifest.json", JSON.stringify({
            exported_at: new Date().toISOString(),
            exported_by: user.username,
            version: "2.0",
            includes_media: true
        }, null, 2));

        // D. Download the ZIP
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `FestOS_FullBackup_${new Date().toISOString().split('T')[0]}.zip`);
        showToast("Complete System Export successful!", "success");

    } catch (err) {
        console.error("Export Error:", err);
        showToast("Failed to export complete data.", "error");
    }
}

// --- 2. FULL IMPORT LOGIC (DATABASE + STORAGE) ---
async function executeZipImport() {
    if (!pendingFileToImport) return;
    showToast("Restoring database and media files... Do not close page.", "warning");
    
    try {
        const zip = await JSZip.loadAsync(pendingFileToImport);
        
        // 1. Verify Manifest
        const manifestFile = zip.file("festos_manifest.json");
        if (!manifestFile) throw new Error("Invalid backup file. Manifest missing.");

        // 2. Restore Database Tables (In STRICT dependency order)
        for (const table of MASTER_TABLES) {
            const file = zip.file(`database/${table}.json`);
            if (file) {
                const jsonStr = await file.async("string");
                const tableData = JSON.parse(jsonStr);
                
                if (tableData.length > 0) {
                    const { error } = await supabaseClient.from(table).upsert(tableData);
                    if (error) console.error(`Import Error on ${table}:`, error);
                }
            }
        }

        // 3. Restore Storage Buckets (Upsert overwrites duplicates safely)
        for (const bucket of STORAGE_BUCKETS) {
            const folderRegex = new RegExp(`^storage/${bucket}/(.*)$`);
            // Find all files in the zip that belong in this bucket
            const filesInBucket = Object.keys(zip.files).filter(name => folderRegex.test(name) && !zip.files[name].dir);

            for (const filename of filesInBucket) {
                const fileObj = zip.file(filename);
                if (!fileObj) continue;

                const blob = await fileObj.async("blob");
                const cleanName = filename.replace(`storage/${bucket}/`, '');

                const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(cleanName, blob, {
                    upsert: true,
                    contentType: blob.type || 'application/octet-stream'
                });
                
                if (uploadError) console.error(`Failed to restore ${cleanName}:`, uploadError);
            }
        }
        
        showToast("System perfectly restored! Reloading...", "success");
        setTimeout(() => location.reload(), 2000);

    } catch (err) {
        console.error("Import Error:", err);
        showToast("Failed to restore system: " + err.message, "error");
    } finally {
        pendingFileToImport = null;
    }
}

// --- 3. TOTAL FACTORY RESET (DATABASE + STORAGE) ---
async function executeFactoryReset() {
    if(!confirm("FINAL WARNING: This will permanently delete ALL tables, settings, photos, templates, and fonts. Type 'YES' to confirm.")) return;
    
    showToast("Initiating Total Factory Reset...", "warning");

    try {
        // 1. Delete Database Tables (Reverse order to avoid Foreign Key errors)
        const reverseOrder = [...MASTER_TABLES].reverse();

        for (const table of reverseOrder) {
            await supabaseClient.from(table).delete().not('id', 'is', null);
        }

        // 2. Empty Storage Buckets
        for (const bucket of STORAGE_BUCKETS) {
            const { data: files } = await supabaseClient.storage.from(bucket).list();
            
            if (files && files.length > 0) {
                // Get all file names except the hidden placeholder
                const filePaths = files.map(f => f.name).filter(name => name !== '.emptyFolderPlaceholder');
                
                if (filePaths.length > 0) {
                    await supabaseClient.storage.from(bucket).remove(filePaths);
                }
            }
        }

        showToast("System Reset Complete. Everything wiped. Reloading...", "success");
        setTimeout(() => location.reload(), 2000);
    } catch (err) {
        console.error("Reset Error:", err);
        showToast("Failed to complete full reset.", "error");
    }
}

async function loadAdminAppeals() {
    try {
        const { data, error } = await supabaseClient
            .from('appeals')
            .select('*, teams(name), competitions(name), participants(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const tbody = document.getElementById('admin-appeals-tbody'); 
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No appeals found.</td></tr>';
            return;
        }

        data.forEach(ticket => {
            const statusClass = ticket.status === 'pending' ? 'badge-warning' : (ticket.status === 'approved' ? 'badge-success' : 'badge-danger');
            
            tbody.innerHTML += `
                <tr>
                    <td><span class="badge" style="background:var(--bg-main);">${ticket.issue_type}</span></td>
                    <td style="font-weight:700;">${ticket.teams?.name}</td>
                    <td>${ticket.competitions?.name || '-'} <br> <small>${ticket.participants?.name || '-'}</small></td>
                    <td><div style="max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ticket.description}">${ticket.description}</div></td>
                    <td><span class="badge ${statusClass}">${ticket.status.toUpperCase()}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${ticket.status === 'pending' ? `
                                <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--success); border-color:var(--success);" onclick="resolveAppeal('${ticket.id}', 'approved')" title="Approve"><i class="fa-solid fa-check"></i></button>
                                <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="resolveAppeal('${ticket.id}', 'rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                            ` : '<span style="color:var(--text-muted); font-size:0.8rem; margin-right: 0.5rem;">Resolved</span>'}
                            
                            <!-- Master Admin Only Delete Button -->
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteAppeal('${ticket.id}')" title="Delete Ticket"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (e) { showToast(e.message, 'error'); }
}

async function resolveAppeal(ticketId, newStatus) {
    if(!confirm(`Mark this ticket as ${newStatus.toUpperCase()}?`)) return;
    try {
        const { error } = await supabaseClient.from('appeals').update({ status: newStatus }).eq('id', ticketId);
        if (error) throw error;
        showToast(`Ticket ${newStatus}!`);
        loadAdminAppeals();
    } catch (e) { showToast(e.message, 'error'); }
}
async function deleteAppeal(ticketId) {
    if (!confirm("Are you sure you want to permanently delete this appeal ticket? This action cannot be undone.")) return;
    
    try {
        const { error } = await supabaseClient.from('appeals').delete().eq('id', ticketId);
        if (error) throw error;
        
        showToast("Appeal ticket deleted successfully.");
        loadAdminAppeals(); // Refresh the list to remove the deleted row
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==========================================
// ADMIN CERTIFICATE GENERATION ENGINE
// ==========================================
async function bulkDownloadCertificates(compId) {
    showToast("Fetching data and preparing certificates...", "success");

    try {
        // 1. Fetch Certificate Template
        const { data: certTemplates } = await supabaseClient.from('templates').select('*').eq('type', 'certificate').limit(1);
        if (!certTemplates || certTemplates.length === 0) throw new Error("No Certificate template found. Please design one in the Poster Templates Studio first.");
        const template = certTemplates[0];

        // 2. Fetch Competition & Judgements with Registered Count
        const { data: comp } = await supabaseClient
            .from('competitions')
            .select('*, categories(name), participant_competitions(count)')
            .eq('id', compId)
            .single();
            
        if (!comp) throw new Error("Competition data could not be found.");

        const { data: judgements } = await supabaseClient
            .from('judgements')
            .select('participant_id, awarded_mark, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);
            
        if (!judgements || judgements.length === 0) throw new Error("No judgements found for this competition yet.");

        // 3. Group, Average, Drop Outliers (FIXED: Skip deleted participants)
        const pMap = {};
        judgements.forEach(j => {
            if (!j.participants) return; // Prevent crash if participant was deleted
            
            const pId = j.participant_id;
            if (!pMap[pId]) pMap[pId] = { participant: j.participants, marks: [] };
            pMap[pId].marks.push(parseFloat(j.awarded_mark));
        });

        // 4. Calculate Final Marks and slice Top 3
        const results = Object.values(pMap).map(p => {
            let sortedMarks = p.marks.sort((a, b) => a - b);
            if (sortedMarks.length >= 3) {
                sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
            }
            const avg = sortedMarks.reduce((a, b) => a + b, 0) / sortedMarks.length;
            return { ...p, avgMark: avg };
        }).sort((a, b) => b.avgMark - a.avgMark).slice(0, 3); // ONLY TOP 3 FOR MERIT CERTS

        if (results.length === 0) throw new Error("Could not calculate top standings. No valid participant data.");

        // 5. Determine Grades
        await loadPointSettings(); 
        results.forEach((r, idx) => {
            let percent = (r.avgMark / (comp.max_mark || 100)) * 100;
            let gradeStr = 'N/A';
            if (percent >= 50) {
                if (percent >= pointsAdminSettings.thresholds.aplus) gradeStr = 'A+';
                else if (percent >= pointsAdminSettings.thresholds.a) gradeStr = 'A';
                else if (percent >= pointsAdminSettings.thresholds.b) gradeStr = 'B';
                else gradeStr = 'C';
            }
            r.grade = gradeStr;
            r.position = idx === 0 ? 'FIRST PLACE' : idx === 1 ? 'SECOND PLACE' : 'THIRD PLACE';
            
            // Add "& PARTY" for Group Events on the Certificate
            if (comp.is_group && !r.participant.name.endsWith('& PARTY')) {
                r.participant.name += " & PARTY";
            }
        });

        // 6. Generate PDF via Canvas
        const { jsPDF } = window.jspdf;
        let pdf = null;
        let pdfConfig = null;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        await new Promise((resolve, reject) => {
            img.onload = resolve; img.onerror = reject; img.src = template.bg_base64;
        });

        // Preload custom fonts from template
        if (template.customFonts && template.customFonts.length > 0) {
            for (const fontData of template.customFonts) {
                try {
                    const customFont = new FontFace(fontData.family, `url(${fontData.url})`);
                    const loadedFace = await customFont.load();
                    document.fonts.add(loadedFace);
                } catch (e) { console.error("Font load error:", e); }
            }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || 1080; 
        canvas.height = img.naturalHeight || 1080;

        for (let i = 0; i < results.length; i++) {
            const entry = results[i];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // FIXED: Added fallback placeholders so it never crashes on null data
            const mappedData = {
                'ParticipantName': (entry.participant?.name || 'UNKNOWN').toUpperCase(),
                'UniqueID': entry.participant?.unique_id || '',
                'TeamName': (entry.participant?.teams?.name || 'INDEPENDENT').toUpperCase(),
                'Category': (comp.categories?.name || 'GENERAL').toUpperCase(),
                'Competition': (comp.name || 'EVENT').toUpperCase(),
                'Position': entry.position,
                'Grade': entry.grade,
                'IssueDate': new Date().toLocaleDateString()
            };

            // Draw QR Code if enabled in template
            if (template.fields['QRCode'] && template.fields['QRCode'].enabled) {
                const f = template.fields['QRCode'];
                const qrContainer = document.createElement('div');
                new QRCode(qrContainer, { text: entry.participant.unique_id, width: f.w, height: f.h, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
                await new Promise(r => setTimeout(r, 50));
                const qrCanvas = qrContainer.querySelector('canvas');
                if(qrCanvas) ctx.drawImage(qrCanvas, f.x, f.y, f.w, f.h);
            }

            // Draw text and static overlays
            if(template.fields) {
                for (const [key, fieldConfig] of Object.entries(template.fields)) {
                    if (!fieldConfig.enabled || key === 'QRCode' || fieldConfig.isImage) {
                        if (fieldConfig.isImage && fieldConfig.isStaticElement && fieldConfig.src && fieldConfig.enabled) {
                            try {
                                const staticImg = await new Promise((resolve) => {
                                    const pImg = new Image(); pImg.crossOrigin = "Anonymous";
                                    pImg.onload = () => resolve(pImg); pImg.onerror = () => resolve(null); pImg.src = fieldConfig.src;
                                });
                                if (staticImg) ctx.drawImage(staticImg, fieldConfig.x, fieldConfig.y, fieldConfig.w, fieldConfig.h);
                            } catch (err) {}
                        }
                        continue;
                    }
                    const text = mappedData[key] || ""; if (!text) continue;
                    ctx.textAlign = fieldConfig.align || 'left'; 
                    ctx.fillStyle = fieldConfig.color || '#000000';
                    ctx.font = `${fieldConfig.weight || 'bold'} ${fieldConfig.size || 40}px ${fieldConfig.font || 'sans-serif'}`;
                    ctx.fillText(text, fieldConfig.x, fieldConfig.y);
                }
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            if (!pdfConfig) {
                const baseWidthMm = 297; // A4 Landscape
                const calculatedHeightMm = (canvas.height * baseWidthMm) / canvas.width;
                pdfConfig = {
                    width: baseWidthMm,
                    height: calculatedHeightMm,
                    orientation: baseWidthMm > calculatedHeightMm ? 'landscape' : 'portrait'
                };
                pdf = new jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < results.length - 1) pdf.addPage();
        }

        pdf.save(`${comp.name.replace(/\s+/g, '_')}_Certificates.pdf`);
        showToast("Certificates Downloaded Successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
}

// ==========================================
// COMPETITION MASTER LOG ENGINE
// ==========================================
let currentLogData = null;

async function viewCompetitionLog(compId) {
    const comp = competitionsList.find(c => c.id === compId);
    if(!comp) return;

    document.getElementById('log-comp-name').innerText = comp.name;
    document.getElementById('log-cat-name').innerText = comp.categories?.name || 'GENERAL';

    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem; display: block;"></i> Fetching Records...</td></tr>';
    document.getElementById('compLogModal').classList.add('show');

    try {
        await loadPointSettings(); // Ensure points settings are loaded for grade calculation

        // Fetch enrollments and participants
        const { data: enrollments, error: enrollErr } = await supabaseClient
            .from('participant_competitions')
            .select('participant_id, is_present, code_letter, is_leader, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);

        if (enrollErr) throw enrollErr;

        // Fetch judgements and judge names
        const { data: judgements, error: judgeErr } = await supabaseClient
            .from('judgements')
            .select('participant_id, awarded_mark, users(username)')
            .eq('competition_id', compId);

        if (judgeErr) throw judgeErr;

        // Calculate results (marks, grades, points)
        let compResults = {};
        if (judgements && judgements.length > 0) {
            let pMarks = {};
            judgements.forEach(j => {
                if(!pMarks[j.participant_id]) pMarks[j.participant_id] = [];
                pMarks[j.participant_id].push(parseFloat(j.awarded_mark));
            });

            let pAverages = Object.keys(pMarks).map(pId => {
                let marks = pMarks[pId].sort((a, b) => a - b);
                if (marks.length >= 3) marks = marks.slice(1, marks.length - 1);
                let avg = marks.reduce((a, b) => a + b, 0) / marks.length;
                return { id: pId, mark: avg };
            }).sort((a, b) => b.mark - a.mark);

            const limit = comp.max_participants || 1;
            const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            const eligibleForPosPts = enrollments.length >= 3;
            
            let currentRank = 1;
            let previousScore = -1;

            pAverages.forEach((p, idx) => {
                if (p.mark !== previousScore) currentRank = idx + 1;
                previousScore = p.mark;

                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let grade = '-'; let gradePts = 0; let posPts = 0;

                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) { grade = 'A+'; gradePts = pointsAdminSettings[`points_${sizeCat}`].aplus; }
                    else if (percent >= pointsAdminSettings.thresholds.a) { grade = 'A'; gradePts = pointsAdminSettings[`points_${sizeCat}`].a; }
                    else if (percent >= pointsAdminSettings.thresholds.b) { grade = 'B'; gradePts = pointsAdminSettings[`points_${sizeCat}`].b; }
                    else { grade = 'C'; gradePts = pointsAdminSettings[`points_${sizeCat}`].c; }
                }

                if (eligibleForPosPts && currentRank <= 3) {
                    if (currentRank === 1) posPts = pointsAdminSettings.pos_points.p1;
                    else if (currentRank === 2) posPts = pointsAdminSettings.pos_points.p2;
                    else if (currentRank === 3) posPts = pointsAdminSettings.pos_points.p3;
                }

                compResults[p.id] = {
                    rank: currentRank,
                    mark: p.mark.toFixed(2),
                    grade: grade,
                    points: gradePts + posPts
                };
            });
        }

        currentLogData = { comp, enrollments: enrollments || [], judgements: judgements || [], compResults };

        let totalEnrolled = enrollments ? enrollments.length : 0;
        let totalPresent = enrollments ? enrollments.filter(e => e.is_present).length : 0;
        let uniqueJudges = new Set((judgements || []).map(j => j.users?.username).filter(Boolean));

        document.getElementById('log-summary').innerHTML = `
            <div class="badge" style="background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-users"></i> ${totalEnrolled} ENROLLED</div>
            <div class="badge" style="background: var(--success-light); color: var(--success); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-check-circle"></i> ${totalPresent} CHECKED-IN</div>
            <div class="badge" style="background: var(--primary-light); color: var(--primary); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-gavel"></i> ${uniqueJudges.size} JUDGE(S)</div>
        `;

        tbody.innerHTML = '';
        if (!enrollments || enrollments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 2rem;">No participants enrolled in this event.</td></tr>';
            return;
        }

      // Sort alphabetically by participant name
        enrollments.sort((a, b) => a.participants.name.localeCompare(b.participants.name)).forEach(e => {
            const p = e.participants;
            const statusBadge = e.is_present 
                ? '<span class="badge" style="background: var(--success-light); color: var(--success); font-size: 0.7rem;">REGISTERED</span>' 
                : '<span class="badge" style="background: var(--warning-light); color: #D97706; font-size: 0.7rem;">PENDING</span>';
            
            // Map judgements for this specific participant
            const pJudgements = (judgements || []).filter(j => j.participant_id === e.participant_id);
            let judgeHtml = '';
            if(pJudgements.length > 0) {
                judgeHtml = pJudgements.map(j => `<div style="font-size: 0.85rem; margin-bottom: 4px; background: var(--bg-main); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); display: inline-block; margin-right: 4px;"><span style="color: var(--text-muted); font-weight: 600;">${j.users?.username || 'Admin'}:</span> <span style="color:var(--primary); font-weight: 800;">${j.awarded_mark}</span></div>`).join('');
            } else {
                judgeHtml = '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; background: var(--bg-main); padding: 4px 8px; border-radius: 4px;">Awaiting Marks</span>';
            }

            // Map Results Data
            const res = compResults[e.participant_id];
            const fMark = res ? res.mark : '-';
            const fGrade = res ? `<span style="font-weight: 800; color: var(--text-main);">${res.grade}</span>` : '-';
            const fPoints = res ? `<span style="font-weight: 800; color: var(--primary);">${res.points}</span>` : '-';

            // --- DISPLAY "& PARTY" FOR LEADERS IN ADMIN LOG ---
            let displayName = p.name;
            let roleTag = '';
            if (comp.is_group) {
                if (e.is_leader) {
                    displayName += ' & PARTY';
                    roleTag = '<br><span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; margin-top: 4px;">GROUP LEADER</span>';
                } else {
                    roleTag = '<br><span class="badge" style="background: var(--bg-main); color: var(--text-muted); font-size: 0.65rem; margin-top: 4px;">MEMBER</span>';
                }
            }

            tbody.innerHTML += `
                <tr>
                    <td style="white-space: nowrap;">
                        <strong style="display:block; font-size: 1rem; color: var(--text-main);">${displayName}</strong>
                        <small style="font-family:monospace; font-weight: 600; color:var(--text-muted);">${p.unique_id}</small>
                        ${roleTag}
                    </td>
                    <td><span class="badge" style="background: var(--bg-main); color: var(--text-muted);">${p.teams?.name || 'INDEPENDENT'}</span></td>
                    <td style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">${e.code_letter || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>${judgeHtml}</td>
                    <td style="font-weight: 800; font-size: 1.1rem;">${fMark}</td>
                    <td>${fGrade}</td>
                    <td>${fPoints}</td>
                </tr>
            `;
        });

    } catch (e) {
        showToast(e.message, 'error');
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger); font-weight: 600; padding: 2rem;">Error loading log data.</td></tr>`;
    }
}

async function downloadCompLogPDF() {
    if(!currentLogData) return showToast("No data to export", "error");
    showToast("Generating Premium Report...", "success");

    const { comp, enrollments, judgements, compResults } = currentLogData;
    const totalEnrolled = enrollments.length;
    const totalPresent = enrollments.filter(e => e.is_present).length;
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    
    // Header
    container.innerHTML = `
        ${getPDFHeaderHTML('Competition Master Log')}
        
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="font-size: 16px; color: #0F172A; margin: 0; margin-bottom: 4px; text-transform: uppercase; font-weight: 800;">${comp.name}</h3>
                <p style="font-size: 11px; color: #64748B; margin: 0; text-transform: uppercase; font-weight: 600;">CATEGORY: ${comp.categories?.name || 'GENERAL'} | STAGE: ${comp.stages?.name || 'TBD'}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 11px; font-weight: 700; color: #0F172A; margin: 0; text-transform: uppercase;">ENROLLED: ${totalEnrolled}</p>
                <p style="font-size: 11px; font-weight: 700; color: #10B981; margin: 0; margin-top: 4px; text-transform: uppercase;">CHECKED-IN: ${totalPresent}</p>
            </div>
        </div>
    `;

    // Sort enrollments alphabetically for the PDF
    const sortedEnrollments = [...enrollments].sort((a, b) => a.participants.name.localeCompare(b.participants.name));

    // Table Data
    let tableRows = sortedEnrollments.map((e, index) => {
        const p = e.participants;
        const status = e.is_present ? 'REGISTERED' : 'PENDING';
        const statusColor = e.is_present ? '#10B981' : '#F59E0B';
        
        const pJudgements = judgements.filter(j => j.participant_id === e.participant_id);
        let judgeText = pJudgements.length > 0 
            ? pJudgements.map(j => `${j.users?.username || 'Admin'}: ${j.awarded_mark}`).join(' | ') 
            : 'Awaiting Marks';

        const res = compResults[e.participant_id];
        const fMark = res ? res.mark : '-';
        const fGrade = res ? res.grade : '-';
        const fPoints = res ? res.points : '-';

        return `
            <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-weight: 700; color: #0F172A;">${p.name.toUpperCase()}</span><br>
                    <span style="font-size: 10px; color: #64748B; font-family: monospace; font-weight: 600;">${p.unique_id}</span>
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #475569;">${(p.teams?.name || 'IND').toUpperCase()}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #4F46E5;">${e.code_letter || '-'}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; color: ${statusColor}; font-weight: 800;">${status}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-size: 11px; font-weight: 600; color: #475569;">${judgeText.toUpperCase()}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #0F172A;">${fMark}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #0F172A;">${fGrade}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #4F46E5;">${fPoints}</td>
            </tr>
        `;
    }).join('');

    if (enrollments.length === 0) {
        tableRows = `<tr><td colspan="9" style="padding: 20px; text-align: center; color: #64748B; font-weight: 600;">No participants found.</td></tr>`;
    }

    container.innerHTML += `
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
            <thead>
                <tr style="background: #F1F5F9; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">
                    <th style="padding: 12px 10px;">#</th>
                    <th style="padding: 12px 10px;">PARTICIPANT</th>
                    <th style="padding: 12px 10px;">TEAM</th>
                    <th style="padding: 12px 10px;">CODE</th>
                    <th style="padding: 12px 10px;">STATUS</th>
                    <th style="padding: 12px 10px;">JUDGES</th>
                    <th style="padding: 12px 10px;">FINAL MARK</th>
                    <th style="padding: 12px 10px;">GRADE</th>
                    <th style="padding: 12px 10px;">PTS</th>
                </tr>
            </thead>
            <tbody style="font-size: 12px; color: #334155;">
                ${tableRows}
            </tbody>
        </table>
    `;

    // Download PDF Config (Using Landscape for wider table)
    const opt = { 
        margin: 10, 
        filename: `FestOS_Log_${comp.name.replace(/[^a-z0-9]/gi, '_')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => {
        const btn = document.getElementById('btn-download-log');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Downloaded!';
        setTimeout(() => btn.innerHTML = origText, 2000);
    });
}

// Dynamic Branded PDF Header Generator
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
        // Keeps spacing correct if only the logo is printed
        brandHtml += `<div style="height: 10px;"></div>`;
    }

    return `
        <div style="text-align: center; margin-bottom: 30px;">
            ${brandHtml}
            <h2 style="color: #1E293B; font-size: 18px; margin-top:0; text-transform: uppercase;">${reportTitle}</h2>
            <p style="color: #64748B; font-size: 12px; margin-top: 4px;">Generated on: ${new Date().toLocaleString()}</p>
        </div>
    `;
}
// ============================================================================
// SPECTATOR DISPLAY CONTROL ENGINE
// ============================================================================

let globalCustomSlides = [];
let pendingCSFile = null;
let pendingCSImagePreview = null;

async function loadDisplaySettings() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
        if (data && data.value) {
            const v = data.value;
            if(document.getElementById('disp-duration')) document.getElementById('disp-duration').value = v.slide_duration || 12;
            if(document.getElementById('disp-color')) document.getElementById('disp-color').value = v.primary_color || '#4F46E5';
            if(document.getElementById('disp-font')) document.getElementById('disp-font').value = v.font_family || 'Plus Jakarta Sans';
            
            const qrCheck = document.getElementById('disp-show-qr');
            if (qrCheck) { qrCheck.checked = v.show_qr !== false; qrCheck.dispatchEvent(new Event('change')); }
            
            // Load custom slides array
            globalCustomSlides = v.custom_slides || [];
        }
        renderCustomSlidesList();
        scalePreviewIframe();
    } catch(e) { console.warn("Using default display settings."); }
}

async function saveDisplaySettings(silent = false) {
    if(!silent) setLoading('display-control .btn-primary', true);
    
    // Fetch current state to avoid overwriting trigger_confetti
    const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
    let trigger_confetti = data && data.value ? data.value.trigger_confetti : 0;

    const payload = {
        slide_duration: parseInt(document.getElementById('disp-duration').value) || 12,
        primary_color: document.getElementById('disp-color').value || '#4F46E5',
        font_family: document.getElementById('disp-font').value || 'Plus Jakarta Sans',
        show_qr: document.getElementById('disp-show-qr').checked,
        custom_slides: globalCustomSlides,
        trigger_confetti: trigger_confetti
    };
    
    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'display_settings', value: payload });
        if (error) throw error;
        
        if(!silent) showToast("Display Settings Saved & Synced!");
        
        const iframe = document.getElementById('display-preview-frame');
        if(iframe) iframe.src = iframe.src; 

    } catch(e) {
        if(!silent) showToast(e.message, 'error');
    } finally {
        if(!silent) setLoading('display-control .btn-primary', false);
    }
}

// --- CUSTOM SLIDES CRUD ---
function renderCustomSlidesList() {
    const container = document.getElementById('custom-slides-list');
    container.innerHTML = '';
    
    if (globalCustomSlides.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--border); border-radius: 8px;">No custom slides created yet. Add one above!</div>`;
        return;
    }

    globalCustomSlides.forEach((slide, index) => {
        const isEnabled = slide.enabled !== false;
        container.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                    <img src="${slide.bg_url || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><rect width=\'100%\' height=\'100%\' fill=\'%23CBD5E1\'/></svg>'}" style="width: 60px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border);">
                    <div>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${slide.title || 'Untitled Slide'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; display: flex; gap: 0.75rem; margin-top: 0.2rem;">
                            ${slide.duration ? `<span><i class="fa-regular fa-clock"></i> ${slide.duration}s</span>` : '<span><i class="fa-regular fa-clock"></i> Default</span>'}
                            ${slide.qr_url ? `<span><i class="fa-solid fa-qrcode"></i> Custom QR</span>` : ''}
                            ${slide.ticker ? `<span><i class="fa-solid fa-bolt"></i> Ticker</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px; margin-right: 0.5rem;">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleCustomSlide(${index}, this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isEnabled ? 'var(--success)' : '#cbd5e1'}; transition: .4s; border-radius: 34px;"></span>
                        <span style="position: absolute; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${isEnabled ? 'translateX(20px)' : 'translateX(0)'};"></span>
                    </label>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.6rem;" onclick="openCustomSlideModal(${index})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; color: var(--danger); border-color: var(--danger);" onclick="deleteCustomSlide(${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function openCustomSlideModal(index = -1) {
    pendingCSFile = null;
    pendingCSImagePreview = null;
    document.getElementById('cs-bg-preview').style.display = 'none';
    document.getElementById('cs-bg-remove').style.display = 'none';
    document.getElementById('cs-bg-upload').value = '';

    if (index >= 0) {
        const slide = globalCustomSlides[index];
        document.getElementById('cs-id').value = slide.id;
        document.getElementById('cs-title').value = slide.title || '';
        document.getElementById('cs-text').value = slide.text || '';
        document.getElementById('cs-duration').value = slide.duration || '';
        document.getElementById('cs-color').value = slide.color || '#4F46E5';
        document.getElementById('cs-qr-url').value = slide.qr_url || '';
        document.getElementById('cs-qr-text').value = slide.qr_text || '';
        document.getElementById('cs-ticker').value = slide.ticker || '';

        if (slide.bg_url) {
            document.getElementById('cs-bg-preview').src = slide.bg_url;
            document.getElementById('cs-bg-preview').style.display = 'block';
            document.getElementById('cs-bg-remove').style.display = 'inline-flex';
            pendingCSImagePreview = slide.bg_url;
        }
    } else {
        document.getElementById('cs-id').value = 'cs_' + Date.now();
        document.getElementById('cs-title').value = '';
        document.getElementById('cs-text').value = '';
        document.getElementById('cs-duration').value = '';
        document.getElementById('cs-color').value = document.getElementById('disp-color').value || '#4F46E5';
        document.getElementById('cs-qr-url').value = '';
        document.getElementById('cs-qr-text').value = '';
        document.getElementById('cs-ticker').value = '';
    }

    document.getElementById('customSlideModal').classList.add('show');
}

function handleCSImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingCSFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingCSImagePreview = e.target.result;
        document.getElementById('cs-bg-preview').src = e.target.result;
        document.getElementById('cs-bg-preview').style.display = 'block';
        document.getElementById('cs-bg-remove').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function removeCSImage() {
    pendingCSFile = null;
    pendingCSImagePreview = null;
    document.getElementById('cs-bg-preview').src = '';
    document.getElementById('cs-bg-preview').style.display = 'none';
    document.getElementById('cs-bg-remove').style.display = 'none';
    document.getElementById('cs-bg-upload').value = '';
}

async function saveCustomSlide() {
    const title = document.getElementById('cs-title').value;
    if(!title) return showToast("A heading is required.", "error");

    setLoading('btn-save-cs', true);

    try {
        let finalBgUrl = pendingCSImagePreview;

        // If it's a completely new file, upload it to the 'elements' bucket
        if (pendingCSFile) {
            const fileExt = pendingCSFile.name.split('.').pop();
            const fileName = `slide_bg_${Date.now()}.${fileExt}`;
            const { data, error } = await supabaseClient.storage.from('elements').upload(fileName, pendingCSFile);
            if (error) throw error;
            const { data: urlData } = supabaseClient.storage.from('elements').getPublicUrl(fileName);
            finalBgUrl = urlData.publicUrl;
        }

        const id = document.getElementById('cs-id').value;
        const slideObj = {
            id: id,
            enabled: true,
            title: title,
            text: document.getElementById('cs-text').value,
            duration: document.getElementById('cs-duration').value || null,
            color: document.getElementById('cs-color').value,
            qr_url: document.getElementById('cs-qr-url').value || null,
            qr_text: document.getElementById('cs-qr-text').value || null,
            ticker: document.getElementById('cs-ticker').value || null,
            bg_url: finalBgUrl
        };

        const existingIndex = globalCustomSlides.findIndex(s => s.id === id);
        if (existingIndex >= 0) {
            // Keep enabled status if editing
            slideObj.enabled = globalCustomSlides[existingIndex].enabled;
            globalCustomSlides[existingIndex] = slideObj;
        } else {
            globalCustomSlides.push(slideObj);
        }

        await saveDisplaySettings(false); // Saves to DB and syncs preview
        document.getElementById('customSlideModal').classList.remove('show');

    } catch(e) {
        showToast("Error saving slide: " + e.message, "error");
    } finally {
        setLoading('btn-save-cs', false);
    }
}

async function toggleCustomSlide(index, isEnabled) {
    globalCustomSlides[index].enabled = isEnabled;
    await saveDisplaySettings(true); // silent sync
}

async function deleteCustomSlide(index) {
    if(!confirm("Remove this custom slide permanently?")) return;
    globalCustomSlides.splice(index, 1);
    await saveDisplaySettings(false);
}

async function triggerManualConfetti() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
        let payload = data?.value || { slide_duration: 12, show_qr: true };
        payload.trigger_confetti = Date.now(); // Forces all listening displays to trigger
        await supabaseClient.from('settings').upsert({ id: 'display_settings', value: payload });
        showToast("Celebration triggered on live displays!", "success");
    } catch(e) {
        showToast("Failed to trigger animation.", "error");
    }
}

function scalePreviewIframe() {
    const iframe = document.getElementById('display-preview-frame');
    if (iframe && iframe.parentElement) {
        const parent = iframe.parentElement;
        const parentWidth = parent.clientWidth;
        const scale = parentWidth / 1920;
        iframe.style.transform = `scale(${scale})`;
        const calculatedHeight = parentWidth * (1080 / 1920);
        parent.style.height = `${calculatedHeight}px`;
    }
}
window.addEventListener('resize', scalePreviewIframe);