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
let availableControllers = [];

// --- CORE NAVIGATION & LOGOUT ---
function switchTab(tabId) {
    // Hide all sections and un-highlight nav items
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    
    // Show active section
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');

    // Trigger specific data loads
    if (tabId === 'categories') loadCategories();
    else if (tabId === 'competitions') loadCompetitions();
    else if (tabId === 'participants') loadParticipants();
    else if (tabId === 'stages') loadStagesAndTeams();
    else if (tabId === 'users') loadUsers();
}

function logout() {
    if (confirm("Are you sure you want to securely log out of the Admin Dashboard?")) {
        localStorage.removeItem('festUser');
        window.location.href = 'index.html';
    }
}

// --- MODAL UTILS ---
function closeModal() { document.getElementById('formModal').style.display = 'none'; }
function openModal(title, bodyHTML, saveFunction) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalSaveBtn').onclick = saveFunction;
    document.getElementById('modalSaveBtn').innerText = 'Save Changes';
    document.getElementById('modalSaveBtn').disabled = false;
    document.getElementById('formModal').style.display = 'flex';
}

// --- CATEGORIES MANAGEMENT ---
async function loadCategories() {
    const { data } = await supabaseClient.from('categories').select('*').order('name');
    categoriesList = data || [];
    
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = '';
    
    categoriesList.forEach(cat => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 500;">${cat.name}</td>
                <td>${cat.is_general ? '<span class="badge badge-primary">General (No Limits)</span>' : 'Standard'}</td>
                <td><button class="btn btn-danger" onclick="deleteCategory('${cat.id}')">Delete</button></td>
            </tr>
        `;
    });
}

function openCategoryModal() {
    openModal('Create Category', `
        <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="catName" placeholder="e.g. Senior Secondary">
        </div>
        <div class="form-group">
            <label>Type</label>
            <select id="catGeneral">
                <option value="false">Standard (Limits apply)</option>
                <option value="true">General (Anyone can participate)</option>
            </select>
        </div>
    `, saveCategory);
}

async function saveCategory() {
    const name = document.getElementById('catName').value;
    const is_general = document.getElementById('catGeneral').value === 'true';
    if(!name) return alert('Name is required');
    const { error } = await supabaseClient.from('categories').insert([{ name, is_general }]);
    if (error) alert(error.message); else { closeModal(); loadCategories(); }
}

async function deleteCategory(id) {
    if(confirm("Delete this category? This might fail if competitions are linked to it.")) {
        const { error } = await supabaseClient.from('categories').delete().eq('id', id);
        if(error) alert(error.message); else loadCategories();
    }
}

// --- COMPETITIONS MANAGEMENT ---
async function loadCompetitions() {
    if (stagesList.length === 0) { const { data } = await supabaseClient.from('stages').select('*'); stagesList = data || []; }
    if (categoriesList.length === 0) await loadCategories();

    const { data } = await supabaseClient.from('competitions').select(`*, categories(name), stages(name)`).order('name');
    const tbody = document.getElementById('competitions-tbody');
    tbody.innerHTML = '';
    
    (data || []).forEach(comp => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 500;">${comp.name}</td>
                <td><span class="badge badge-primary">${comp.categories?.name || 'N/A'}</span></td>
                <td>${comp.stages?.name || 'Unassigned'}</td>
                <td>${comp.max_mark}</td>
                <td>${comp.max_participants} per team</td>
                <td><button class="btn btn-danger" onclick="deleteCompetition('${comp.id}')">Delete</button></td>
            </tr>
        `;
    });
}

function openCompModal() {
    let catOpts = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let stageOpts = stagesList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    openModal('New Competition', `
        <div class="form-group"><label>Competition Name</label><input type="text" id="compName"></div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Category</label><select id="compCategory">${catOpts}</select></div>
            <div class="form-group" style="flex:1;"><label>Stage</label><select id="compStage"><option value="">-- No Stage Yet --</option>${stageOpts}</select></div>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Max Marks</label><input type="number" id="compMarks" value="100"></div>
            <div class="form-group" style="flex:1;"><label>Participants / Team</label><input type="number" id="compParticipants" value="1"></div>
        </div>
    `, saveCompetition);
}

async function saveCompetition() {
    const name = document.getElementById('compName').value;
    const category_id = document.getElementById('compCategory').value;
    const stage_id = document.getElementById('compStage').value || null;
    const max_mark = document.getElementById('compMarks').value;
    const max_participants = document.getElementById('compParticipants').value;
    if(!name) return alert('Name is required');
    const { error } = await supabaseClient.from('competitions').insert([{ name, category_id, stage_id, max_mark, max_participants }]);
    if (error) alert(error.message); else { closeModal(); loadCompetitions(); }
}

async function deleteCompetition(id) {
    if(confirm("Delete this competition?")) {
        const { error } = await supabaseClient.from('competitions').delete().eq('id', id);
        if(error) alert(error.message); else loadCompetitions();
    }
}

// --- STAGES & TEAMS MANAGEMENT ---
async function loadStagesAndTeams() {
    // Load Stages
    const { data: stages } = await supabaseClient.from('stages').select(`*, users(username)`).order('stage_no');
    stagesList = stages || [];
    const stbody = document.getElementById('stages-tbody');
    stbody.innerHTML = '';
    stagesList.forEach(s => {
        stbody.innerHTML += `
            <tr>
                <td style="font-weight: 500;">${s.name} <br><small style="color:var(--text-muted)">Controller: ${s.users?.username || 'None'}</small></td>
                <td>Stage ${s.stage_no}</td>
                <td><button class="btn btn-danger" style="padding:0.3rem 0.6rem;" onclick="deleteStage('${s.id}')">Delete</button></td>
            </tr>
        `;
    });

    // Load Teams
    const { data: teams } = await supabaseClient.from('teams').select('*').order('name');
    teamsList = teams || [];
    const ttbody = document.getElementById('teams-tbody');
    ttbody.innerHTML = '';
    teamsList.forEach(t => {
        ttbody.innerHTML += `
            <tr>
                <td style="font-weight: 500;">${t.name}</td>
                <td><button class="btn btn-danger" style="padding:0.3rem 0.6rem;" onclick="deleteTeam('${t.id}')">Delete</button></td>
            </tr>
        `;
    });
}

async function openStageModal() {
    if (availableControllers.length === 0) {
        const { data } = await supabaseClient.from('users').select('*').eq('role', 'stage_controller');
        availableControllers = data || [];
    }
    let controllerOpts = availableControllers.map(c => `<option value="${c.id}">${c.username}</option>`).join('');
    
    openModal('Add Stage', `
        <div class="form-group"><label>Stage Name</label><input type="text" id="stageName" placeholder="e.g. Main Auditorium"></div>
        <div class="form-group"><label>Stage Number (ID)</label><input type="number" id="stageNo" value="1"></div>
        <div class="form-group"><label>Assign Controller</label><select id="stageController"><option value="">-- Select Controller --</option>${controllerOpts}</select></div>
    `, async () => {
        const name = document.getElementById('stageName').value;
        const stage_no = document.getElementById('stageNo').value;
        const controller_id = document.getElementById('stageController').value || null;
        if(!name || !stage_no) return alert('Name and Number required');
        const { error } = await supabaseClient.from('stages').insert([{ name, stage_no, controller_id }]);
        if(error) alert(error.message); else { closeModal(); loadStagesAndTeams(); }
    });
}

function openTeamModal() {
    openModal('Add Team', `
        <div class="form-group"><label>Team Name</label><input type="text" id="teamName" placeholder="e.g. Gryffindor"></div>
    `, async () => {
        const name = document.getElementById('teamName').value;
        if(!name) return alert('Name required');
        const { error } = await supabaseClient.from('teams').insert([{ name }]);
        if(error) alert(error.message); else { closeModal(); loadStagesAndTeams(); }
    });
}

async function deleteStage(id) { if(confirm("Delete stage?")) { await supabaseClient.from('stages').delete().eq('id', id); loadStagesAndTeams(); } }
async function deleteTeam(id) { if(confirm("Delete team?")) { await supabaseClient.from('teams').delete().eq('id', id); loadStagesAndTeams(); } }

// --- PARTICIPANTS MANAGEMENT & PDF CARDS ---
async function loadParticipants() {
    if (categoriesList.length === 0) await loadCategories();
    if (teamsList.length === 0) { const { data } = await supabaseClient.from('teams').select('*'); teamsList = data || []; }

    const { data } = await supabaseClient.from('participants').select(`*, categories(name), teams(name)`).order('name');
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    (data || []).forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${p.unique_id}</td>
                <td style="font-weight: 500;">${p.name}</td>
                <td><span class="badge" style="background:#F1F5F9; color:#475569;">${p.teams?.name || 'Unassigned'}</span></td>
                <td>${p.categories?.name || 'N/A'}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="generateSingleCard('${p.id}')">Download</button>
                    <button class="btn btn-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="deleteParticipant('${p.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

function openParticipantModal() {
    let catOpts = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let teamOpts = teamsList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    openModal('Register Participant', `
        <div class="form-group"><label>Full Name</label><input type="text" id="partName" placeholder="Participant Name"></div>
        <div class="form-group"><label>Team</label><select id="partTeam"><option value="">-- Select Team --</option>${teamOpts}</select></div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Category</label><select id="partCategory">${catOpts}</select></div>
            <div class="form-group" style="flex:1;"><label>Batch No</label><input type="number" id="partBatch" min="1" max="7" value="1"></div>
        </div>
    `, saveParticipant);
}

async function saveParticipant() {
    const name = document.getElementById('partName').value;
    const team_id = document.getElementById('partTeam').value || null;
    const category_id = document.getElementById('partCategory').value;
    const batch_no = document.getElementById('partBatch').value;
    const unique_id = `FEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    
    if(!name) return alert('Name is required');
    const { error } = await supabaseClient.from('participants').insert([{ unique_id, name, team_id, category_id, batch_no }]);
    if (error) alert(error.message); else { closeModal(); loadParticipants(); }
}

async function deleteParticipant(id) {
    if(confirm("Are you sure you want to delete this participant?")) {
        const { error } = await supabaseClient.from('participants').delete().eq('id', id);
        if(error) alert(error.message); else loadParticipants();
    }
}

// PDF GENERATION LOGIC
function buildCardElement(participant) {
    const card = document.createElement('div');
    card.className = 'id-card';
    const photoSrc = participant.photo_url ? participant.photo_url : 'https://via.placeholder.com/150/E5E7EB/6B7280?text=Photo';
    card.innerHTML = `
        <div class="id-header"><h2>FEST 2026</h2><p>Official Participant Pass</p></div>
        <img src="${photoSrc}" class="id-photo" alt="Participant">
        <div class="id-details">
            <div class="id-name">${participant.name}</div>
            <div class="id-team">${participant.teams?.name || 'Independent'}</div>
            <div class="id-cat">${participant.categories?.name || 'General'}</div>
            <div class="id-uid">${participant.unique_id}</div>
        </div>
        <div class="id-qr" id="qr-${participant.id}"></div>
    `;
    return card;
}

async function generateSingleCard(participantId) {
    const { data: p } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').eq('id', participantId).single();
    if (!p) return alert("Could not fetch participant.");
    
    const container = document.getElementById('print-container');
    container.innerHTML = '';
    const cardElement = buildCardElement(p);
    container.appendChild(cardElement);
    
    new QRCode(document.getElementById(`qr-${p.id}`), { text: p.unique_id, width: 65, height: 65, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    
    const opt = { margin: 0, filename: `${p.name}_ID_Card.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 4, useCORS: true }, jsPDF: { unit: 'mm', format: 'a7', orientation: 'portrait' } };
    html2pdf().set(opt).from(cardElement).save();
}

async function generateBulkCards() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Generating..."; btn.disabled = true;

    const { data: participants } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').order('name');
    if (!participants || !participants.length) { btn.innerHTML = originalText; btn.disabled = false; return alert("No participants found."); }

    const container = document.getElementById('print-container');
    container.innerHTML = '';

    participants.forEach(p => {
        const cardElement = buildCardElement(p);
        container.appendChild(cardElement);
        new QRCode(document.getElementById(`qr-${p.id}`), { text: p.unique_id, width: 65, height: 65, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    });

    const opt = { margin: 0, filename: `Fest_2026_All_ID_Cards.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 4, useCORS: true }, jsPDF: { unit: 'mm', format: 'a7', orientation: 'portrait' } };
    html2pdf().set(opt).from(container).save().then(() => { btn.innerHTML = originalText; btn.disabled = false; container.innerHTML = ''; });
}

// --- USER MANAGEMENT ---
async function loadUsers() {
    const { data } = await supabaseClient.from('users').select('id, username, role').neq('role', 'master_admin').order('role');
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    (data || []).forEach(u => {
        const roleDisplay = u.role.replace('_', ' ').toUpperCase();
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${u.username}</td>
                <td><span class="badge badge-primary">${roleDisplay}</span></td>
                <td><button class="btn btn-danger" onclick="deleteUser('${u.id}', '${u.username}')">Delete</button></td>
            </tr>
        `;
    });
}

function openUserModal() {
    openModal('Create Staff Account', `
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" autocomplete="off"></div>
        <div class="form-group"><label>Password</label><input type="text" id="newPassword" autocomplete="off"></div>
        <div class="form-group"><label>Role</label><select id="newUserRole"><option value="judge">Judge</option><option value="stage_controller">Stage Controller</option><option value="fest_manager">Fest Manager</option><option value="admin">Admin</option></select></div>
    `, async () => {
        const username = document.getElementById('newUsername').value.trim();
        const password_hash = document.getElementById('newPassword').value.trim();
        const role = document.getElementById('newUserRole').value;
        if (!username || !password_hash) return alert('Username and Password required.');
        
        document.getElementById('modalSaveBtn').innerText = "Saving...";
        const { error } = await supabaseClient.from('users').insert([{ username, password_hash, role }]);
        
        if (error) {
            document.getElementById('modalSaveBtn').innerText = "Save Changes";
            if (error.code === '23505') alert('Username taken.'); else alert('Error: ' + error.message);
        } else { closeModal(); loadUsers(); }
    });
}

async function deleteUser(id, username) {
    if (confirm(`Delete the user "${username}"? This cannot be undone.`)) {
        const { error } = await supabaseClient.from('users').delete().eq('id', id);
        if (error) {
            if (error.code === '23503') alert(`Cannot delete ${username} as they are linked to judgements/stages. Reassign them first.`);
            else alert(error.message);
        } else loadUsers();
    }
}

// --- CSV BULK UPLOAD EXPORT (PapaParse) ---
async function downloadCSV(tableName) {
    const { data, error } = await supabaseClient.from(tableName).select('*');
    if (error) return alert("Export error: " + error.message);
    const blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `${tableName}_export.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function downloadTemplate(type) {
    let headers = [];
    if(type === 'categories') headers = ['name', 'is_general'];
    if(type === 'competitions') headers = ['name', 'max_participants', 'max_mark', 'stage_id', 'category_id'];
    if(type === 'participants') headers = ['name', 'category_id', 'batch_no', 'team_id'];
    const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `${type}_template.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

async function handleBulkUpload(tableName, fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput.files.length) return alert("Select a CSV file first.");
    Papa.parse(fileInput.files[0], {
        header: true, skipEmptyLines: true, complete: async function(results) {
            if(!results.data.length) return alert("No valid rows found.");
            const cleanData = results.data.map(row => {
                if (row.is_general) row.is_general = (row.is_general.toLowerCase() === 'true');
                if (row.max_participants) row.max_participants = parseInt(row.max_participants);
                if (row.max_mark) row.max_mark = parseFloat(row.max_mark);
                if (row.batch_no) row.batch_no = parseInt(row.batch_no);
                if (tableName === 'participants' && !row.unique_id) row.unique_id = `FEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
                return row;
            });
            const { error } = await supabaseClient.from(tableName).insert(cleanData);
            if(error) alert(`Upload failed: ${error.message}`);
            else { alert(`Success! Imported records.`); switchTab(tableName); }
        }
    });
}

// Initialize Default Tab
loadCategories();