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
        const header = document.querySelector('.header');
        const returnBtn = document.createElement('button');
        returnBtn.className = 'btn btn-primary';
        returnBtn.style.marginRight = '1rem';
        returnBtn.innerHTML = '<i class="ph ph-shield-check"></i> Admin Hub';
        returnBtn.onclick = () => window.location.href = 'admin.html';
        header.insertBefore(returnBtn, header.children[1]);
    });
}

// --- GLOBAL STATE (For fast searching & filtering) ---
let availableJudges = [];
let allCompetitions = [];
let allAssignments = [];
let allStages = []; // <-- NEW VARIABLE

// --- UTILITIES ---
function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'assignments') loadAssignments();
    if (tabId === 'publish') loadPublishableComps();
    // NEW ROUTE
    if (tabId === 'published-results') loadPublishedResults(); 
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

async function loadAssignments() {
    const grid = document.getElementById('comps-grid');
    grid.innerHTML = `<div style="text-align:center; padding:3rem; grid-column: 1/-1; color: var(--text-muted);"><i class="ph ph-spinner-gap" style="font-size:2rem; animation: spin 1s linear infinite;"></i><p>Loading records...</p></div>`;

    try {
        if (availableJudges.length === 0) {
            // FIXED: Changed window.db to supabaseClient
            const { data: judges } = await supabaseClient.from('users').select('id, username').eq('role', 'judge');
            availableJudges = judges || [];
        }

        // NEW: Fetch all official stages created by Admin
        if (allStages.length === 0) {
            // FIXED: Changed window.db to supabaseClient
            const { data: stages } = await supabaseClient.from('stages').select('id, name, stage_no').order('stage_no');
            allStages = stages || [];
        }

        // UPDATED: Added 'stages(name)' to the select query to get the stage name for each competition
        // FIXED: Changed window.db to supabaseClient
        const { data: comps } = await supabaseClient.from('competitions')
            .select('*, categories(name), stages(name)') 
            .in('status', ['pending', 'registration', 'ongoing'])
            .order('name');
        allCompetitions = comps || [];

        // FIXED: Changed window.db to supabaseClient
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

    let judgeOptions = availableJudges.map(j => `<option value="${j.id}">${j.username}</option>`).join('');

    // THIS is the loop where 'comp' is defined. Everything referencing 'comp' MUST stay inside here.
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

        // Card HTML rendering (now with the bulk action checkbox safely inside the loop)
        grid.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                        <input type="checkbox" class="comp-checkbox" value="${comp.id}" onchange="toggleBulkActions()" style="width: 18px; height: 18px; cursor: pointer; margin-top: 3px;">
                        <div class="card-title">${comp.name}</div>
                    </div>
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
async function publishCompetition(compId, btnElement) {
    if(!confirm("⚠️ Push final standings to Live Portal immediately?")) return;
    btnElement.disabled = true;
    btnElement.innerHTML = 'Publishing...';
    await window.db.from('competitions').update({ status: 'published' }).eq('id', compId);
    showToast("Results published!");
    loadPublishableComps(); 
}
// --- MANAGER.JS UPDATE ---
async function redoJudgement(compId, btnElement) {
    if(!confirm("⚠️ Send this competition back for re-judging? This will ERASE all current marks!")) return;
    
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Reverting...';

    // 1. DELETE ONLY THE MARKS
await window.db.from('judgements')
    .delete()
    .eq('competition_id', compId)
    .not('participant_id', 'is', null);

// 2. Revert the status
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

async function bulkAssignJudges() {
    const judgeId = document.getElementById('bulk-judge-select').value;
    const checkboxes = document.querySelectorAll('.comp-checkbox:checked');
    
    if (!judgeId) return showToast('Please select a judge for bulk assignment.', 'error');
    if (checkboxes.length === 0) return;
    
    if(!confirm(`Assign this judge to ${checkboxes.length} competitions?`)) return;

    const insertPayload = Array.from(checkboxes).map(cb => ({
        competition_id: cb.value,
        judge_id: judgeId
    }));

    // In a real scenario, you'd want to check for duplicates first, 
    // or handle unique constraint errors gracefully.
    const { error } = await window.db.from('judgements').insert(insertPayload);

    if (error) {
        showToast("Bulk Assign Error: " + error.message, 'error');
    } else {
        showToast(`Successfully assigned judge to ${checkboxes.length} competitions!`);
        document.getElementById('bulk-actions').style.display = 'none';
        loadAssignments();
    }
}

async function bulkRevokeJudges() {
    const checkboxes = document.querySelectorAll('.comp-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    if(!confirm(`WARNING: Remove ALL judges from the ${checkboxes.length} selected competitions?`)) return;

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
}
async function previewConvertedPoints(compId, maxMark, isGeneral) {
    try {
        // Fetch dynamic settings to ensure preview matches the real logic
        let baseRatio = isGeneral ? 20 : 10;
        const { data: settingsData } = await window.db.from('settings').select('value').eq('id', 'point_system').single();
        if (settingsData && settingsData.value) {
            baseRatio = isGeneral ? settingsData.value.ratio_general : settingsData.value.ratio_standard;
        }

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

        const participantMarks = {};

        // Average the marks if multiple judges exist
        judgements.forEach(j => {
            if (!participantMarks[j.participant_id]) {
                participantMarks[j.participant_id] = { 
                    name: j.participants?.name || 'Unknown Participant', 
                    total: 0, 
                    count: 0 
                };
            }
            participantMarks[j.participant_id].total += parseFloat(j.awarded_mark);
            participantMarks[j.participant_id].count += 1;
        });

        let previewHTML = `<div style="text-align: left; margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 8px;">`;
        for (const [pId, data] of Object.entries(participantMarks)) {
            const averageMark = data.total / data.count;
            // Uses the admin-configured dynamic base ratio
            const convertedPoint = ((averageMark / maxMark) * baseRatio).toFixed(2);
            previewHTML += `<div style="margin-bottom: 6px;"><strong>${data.name}:</strong> ${convertedPoint} / ${baseRatio} pts</div>`;
        }
        previewHTML += `</div>`;

        showToast(`Converted Points Preview: ${previewHTML}`, 'success');
        
    } catch (err) {
        console.error("Preview Generation Error:", err);
        showToast("An error occurred while generating the preview.", "error");
    }
}
// Revert Published Results back to Pending
async function revertPublishedResult(compId, btnElement) {
    if(!confirm("⚠️ Move this published result back to pending? It will be removed from Live Results!")) return;
    
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Reverting...';

    const { error } = await window.db.from('competitions')
        .update({ status: 'judgement_complete' }) // Moves it back to the publish queue
        .eq('id', compId);

    if (error) {
        showToast("Failed to revert: " + error.message, 'error');
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="ph ph-arrow-u-up-left"></i> Revert to Pending';
    } else {
        showToast("Moved back to pending queue!", "success");
        loadPublishedResults(); // FIX: Now refreshes the Published tab!
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
            const participantName = j.participants?.name || 'Unknown Participant';
            const judgeName = j.users?.username ? `(Judge: ${j.users.username})` : '';
            
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

    if (!confirm("Are you sure you want to update these scores? This will immediately affect live results.")) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Saving...';

    try {
        // Update records in Supabase (upsert based on primary key 'id')
        const { error } = await window.db
            .from('judgements')
            .upsert(updates, { onConflict: 'id' });

        if (error) throw error;

        showToast("Points successfully updated!", "success");
        closeEditModal();
        
        // Refresh the published results to reflect potential point/status changes
        loadPublishedResults();
        
    } catch (err) {
        console.error("Error saving marks:", err);
        showToast("Failed to save updates: " + err.message, "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
    }
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