// --- DATABASE SETUP ---
const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || user.role !== 'fest_manager') {
    window.location.href = 'index.html';
}

// --- GLOBAL STATE (For fast searching & filtering) ---
let availableJudges = [];
let allCompetitions = [];
let allAssignments = [];

// --- UTILITIES ---
function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'assignments') loadAssignments();
    if (tabId === 'publish') loadPublishableComps();
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
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

// --- JUDGE ASSIGNMENTS & FILTERING ---
async function loadAssignments() {
    const grid = document.getElementById('comps-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading records...</p></div>`;

    try {
        if (availableJudges.length === 0) {
            const { data: judges } = await window.db.from('users').select('id, username').eq('role', 'judge');
            availableJudges = judges || [];
        }

        const { data: comps } = await window.db.from('competitions').select('*, categories(name)').in('status', ['pending', 'registration', 'ongoing']).order('name');
        allCompetitions = comps || [];

        const { data: assignments } = await window.db.from('judgements').select('competition_id, judge_id, users(username)').is('awarded_mark', null);
        allAssignments = assignments || [];

        // Populate dynamic category dropdown based on available data
        populateCategoryFilter();
        
        // Initial Render
        filterCompetitions();
    } catch (error) {
        console.error("SUPABASE ERROR:", error);
        showToast('Error loading data', 'error');
    }
}

function populateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    const categories = new Set(allCompetitions.map(c => c.categories?.name || 'Uncategorized'));
    
    filter.innerHTML = `<option value="all">All Categories</option>`;
    categories.forEach(cat => {
        filter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

// The core logic for Search + Category Filter + Assigned Status Filter
function filterCompetitions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const catFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    const filteredComps = allCompetitions.filter(comp => {
        const compNameMatch = comp.name.toLowerCase().includes(searchTerm);
        const catMatch = catFilter === 'all' || (comp.categories?.name || 'Uncategorized') === catFilter;
        
        const assignedJudges = allAssignments.filter(a => a.competition_id === comp.id);
        const isAssigned = assignedJudges.length > 0;
        
        let statusMatch = true;
        if (statusFilter === 'unassigned') statusMatch = !isAssigned;
        if (statusFilter === 'assigned') statusMatch = isAssigned;

        return compNameMatch && catMatch && statusMatch;
    });

    renderGrid(filteredComps);
}

function renderGrid(competitions) {
    const grid = document.getElementById('comps-grid');
    grid.innerHTML = '';

    if (competitions.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-magnifying-glass" style="font-size:2rem; margin-bottom:1rem;"></i><p>No competitions match your filters.</p></div>`;
        return;
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

        grid.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge ${badgeClass}">${comp.status}</span>
                </div>
                <div class="card-meta"><i class="ph ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}</div>
                
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

// --- NEW REVOKE FUNCTION ---
async function revokeJudge(compId, judgeId, btnElement) {
    if(!confirm("Are you sure you want to revoke this judge's assignment?")) return;
    
    // Set loading state on the tiny button
    const originalIcon = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i>';
    btnElement.disabled = true;

    // Delete the specific row matching the competition and the judge
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
        loadAssignments(); // Refresh state to remove the tag
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
        return comp.name.toLowerCase().includes(searchTerm) && 
               (catFilter === 'all' || (comp.categories?.name === catFilter));
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
                <div style="display: flex; gap: 0.5rem; width: 100%;">
                    <button class="btn btn-outline" style="flex: 1;" onclick="redoJudgement('${comp.id}', this)">
                        <i class="ph ph-arrow-u-up-left"></i> Redo
                    </button>
                    <button class="btn btn-success" style="flex: 2;" onclick="publishCompetition('${comp.id}', this)">
                        <i class="ph ph-megaphone-simple"></i> Publish Live
                    </button>
                </div>
            </div>
        `;
    });
}
async function publishCompetition(compId, btnElement) {
    if(!confirm("⚠️ Push final standings to Live Portal immediately?")) return;
    btnElement.disabled = true;
    btnElement.innerHTML = 'Publishing...';
    await window.db.from('competitions').update({ status: 'published' }).eq('id', compId);
    showToast("Results published!");
    loadPublishableComps(); 
}
async function redoJudgement(compId, btnElement) {
    if(!confirm("⚠️ Send this competition back for re-judging? The status will revert to 'ongoing'.")) return;
    
    // Set loading state
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Reverting...';

    // Update status in the database back to ongoing
    const { error } = await window.db.from('competitions')
        .update({ status: 'ongoing' })
        .eq('id', compId);

    if (error) {
        console.error("REDO ERROR:", error);
        showToast("Failed to revert: " + error.message, 'error');
        btnElement.innerHTML = '<i class="ph ph-arrow-u-up-left"></i> Redo';
        btnElement.disabled = false;
    } else {
        showToast("Sent back for re-judging!", "success");
        loadPublishableComps(); // Refresh the publish grid to remove the card
    }
}

// Boot up
loadAssignments();