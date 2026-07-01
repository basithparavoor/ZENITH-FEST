const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || (user.role !== 'admin' && user.role !== 'master_admin')) {
    window.location.href = 'index.html';
}

// Global cached data for dropdowns
let categoriesList = [];
let stagesList = [];

// --- UI NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'categories') loadCategories();
    if (tabId === 'competitions') loadCompetitions();
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// --- CATEGORIES MANAGEMENT ---
async function loadCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    categoriesList = data || []; // Cache for dropdowns
    
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = '';
    
    categoriesList.forEach(cat => {
        tbody.innerHTML += `
            <tr>
                <td>${cat.name}</td>
                <td>${cat.is_general ? '<span style="color:var(--primary); font-weight:600;">General (No Limits)</span>' : 'Standard'}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.25rem 0.5rem;" onclick="deleteCategory('${cat.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

function openCategoryModal() {
    document.getElementById('modalTitle').innerText = 'Add Category';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="catName" placeholder="e.g. Senior Secondary">
        </div>
        <div class="form-group">
            <label>Is this a General Category? (Anyone can participate)</label>
            <select id="catGeneral">
                <option value="false">No (Standard Limits apply)</option>
                <option value="true">Yes (General)</option>
            </select>
        </div>
    `;
    document.getElementById('modalSaveBtn').onclick = saveCategory;
    document.getElementById('formModal').style.display = 'flex';
}

async function saveCategory() {
    const name = document.getElementById('catName').value;
    const is_general = document.getElementById('catGeneral').value === 'true';
    
    if(!name) return alert('Name is required');

    const { error } = await supabase.from('categories').insert([{ name, is_general }]);
    if (error) alert(error.message);
    else { closeModal(); loadCategories(); }
}

async function deleteCategory(id) {
    if(confirm("Delete this category? This might fail if competitions are linked to it.")) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if(error) alert(error.message);
        else loadCategories();
    }
}

// --- COMPETITIONS MANAGEMENT ---
async function loadCompetitions() {
    if (stagesList.length === 0) {
        const { data } = await supabase.from('stages').select('*');
        stagesList = data || [];
    }
    if (categoriesList.length === 0) await loadCategories();

    const { data, error } = await supabase
        .from('competitions')
        .select(`*, categories(name), stages(name)`)
        .order('name');
        
    const tbody = document.getElementById('competitions-tbody');
    tbody.innerHTML = '';
    
    (data || []).forEach(comp => {
        tbody.innerHTML += `
            <tr>
                <td>${comp.name}</td>
                <td>${comp.categories?.name || 'N/A'}</td>
                <td>${comp.stages?.name || 'Unassigned'}</td>
                <td>${comp.max_mark}</td>
                <td>${comp.max_participants}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.25rem 0.5rem;" onclick="deleteCompetition('${comp.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

function openCompModal() {
    let catOptions = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let stageOptions = stagesList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    document.getElementById('modalTitle').innerText = 'Add Competition';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Competition Name</label>
            <input type="text" id="compName">
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;">
                <label>Category</label>
                <select id="compCategory">${catOptions}</select>
            </div>
            <div class="form-group" style="flex:1;">
                <label>Stage</label>
                <select id="compStage"><option value="">-- No Stage Yet --</option>${stageOptions}</select>
            </div>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;">
                <label>Max Marks</label>
                <input type="number" id="compMarks" value="100">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Max Participants / Team</label>
                <input type="number" id="compParticipants" value="1">
            </div>
        </div>
    `;
    document.getElementById('modalSaveBtn').onclick = saveCompetition;
    document.getElementById('formModal').style.display = 'flex';
}

async function saveCompetition() {
    const name = document.getElementById('compName').value;
    const category_id = document.getElementById('compCategory').value;
    const stage_id = document.getElementById('compStage').value || null;
    const max_mark = document.getElementById('compMarks').value;
    const max_participants = document.getElementById('compParticipants').value;
    
    if(!name) return alert('Name is required');

    const { error } = await supabase.from('competitions').insert([{ 
        name, category_id, stage_id, max_mark, max_participants 
    }]);
    
    if (error) alert(error.message);
    else { closeModal(); loadCompetitions(); }
}

async function deleteCompetition(id) {
    if(confirm("Delete this competition?")) {
        const { error } = await supabase.from('competitions').delete().eq('id', id);
        if(error) alert(error.message);
        else loadCompetitions();
    }
}

// --- MODAL UTILS ---
function closeModal() {
    document.getElementById('formModal').style.display = 'none';
}

// --- GLOBAL STANDARD DATA IMPORT / EXPORT (PapaParse) ---

// 1. Export Data to CSV
async function downloadCSV(tableName) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) return alert("Error fetching data for export: " + error.message);
    
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${tableName}_data_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 2. Download Empty Template for Bulk CSV Input
function downloadTemplate(type) {
    let headers = [];
    if(type === 'categories') headers = ['name', 'is_general'];
    if(type === 'competitions') headers = ['name', 'max_participants', 'max_mark', 'stage_id', 'category_id'];
    if(type === 'participants') headers = ['name', 'category_id', 'batch_no', 'team_id'];
    
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${type}_bulk_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 3. Import Bulk Data from File Input via CSV
async function handleBulkUpload(tableName, fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput.files.length) return alert("Please select a CSV file first.");
    
    const file = fileInput.files[0];
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const parsedData = results.data;
            if(!parsedData.length) return alert("No valid rows found in CSV.");
            
            // Clean up and transform formats if necessary (e.g. string to boolean/numbers)
            const cleanData = parsedData.map(row => {
                if (row.is_general) row.is_general = (row.is_general.toLowerCase() === 'true');
                if (row.max_participants) row.max_participants = parseInt(row.max_participants);
                if (row.max_mark) row.max_mark = parseFloat(row.max_mark);
                if (row.batch_no) row.batch_no = parseInt(row.batch_no);
                
                // If it's a participant, systematically generate an unforgeable unique identity string
                if (tableName === 'participants' && !row.unique_id) {
                    row.unique_id = `FEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;
                }
                return row;
            });

            const { error } = await supabase.from(tableName).insert(cleanData);
            if(error) {
                alert(`Upload failed: ${error.message}`);
            } else {
                alert(`Successfully imported ${cleanData.length} structural records into ${tableName}!`);
                if(tableName === 'categories') loadCategories();
                if(tableName === 'competitions') loadCompetitions();
            }
        }
    });
}

// Initialize default tab layout
loadCategories();
// --- GLOBAL CACHE FOR TEAMS ---
let teamsList = [];

// --- PARTICIPANTS MANAGEMENT ---
async function loadParticipants() {
    // Pre-load data for dropdowns
    if (categoriesList.length === 0) await loadCategories();
    if (teamsList.length === 0) {
        const { data } = await supabase.from('teams').select('*');
        teamsList = data || [];
    }

    const { data, error } = await supabase
        .from('participants')
        .select(`*, categories(name), teams(name)`)
        .order('name');
        
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    (data || []).forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td style="font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td>${p.name}</td>
                <td>${p.teams?.name || 'Unassigned'}</td>
                <td>${p.categories?.name || 'N/A'}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.25rem 0.5rem;" onclick="generateSingleCard('${p.id}')">Download Card</button>
                    <button class="btn btn-outline" style="padding:0.25rem 0.5rem; color: var(--danger); border-color: var(--danger);" onclick="deleteParticipant('${p.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

function openParticipantModal() {
    let catOptions = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let teamOptions = teamsList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    document.getElementById('modalTitle').innerText = 'Add Participant';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="partName" placeholder="Participant Name">
        </div>
        <div class="form-group">
            <label>Team</label>
            <select id="partTeam"><option value="">-- Select Team --</option>${teamOptions}</select>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;">
                <label>Category</label>
                <select id="partCategory">${catOptions}</select>
            </div>
            <div class="form-group" style="flex:1;">
                <label>Batch No (1-7)</label>
                <input type="number" id="partBatch" min="1" max="7" value="1">
            </div>
        </div>
    `;
    document.getElementById('modalSaveBtn').onclick = saveParticipant;
    document.getElementById('formModal').style.display = 'flex';
}

async function saveParticipant() {
    const name = document.getElementById('partName').value;
    const team_id = document.getElementById('partTeam').value || null;
    const category_id = document.getElementById('partCategory').value;
    const batch_no = document.getElementById('partBatch').value;
    
    // Auto-generate Unique ID
    const unique_id = `FEST-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    if(!name) return alert('Name is required');

    const { error } = await supabase.from('participants').insert([{ 
        unique_id, name, team_id, category_id, batch_no 
    }]);
    
    if (error) alert(error.message);
    else { closeModal(); loadParticipants(); }
}

async function deleteParticipant(id) {
    if(confirm("Are you sure you want to delete this participant?")) {
        const { error } = await supabase.from('participants').delete().eq('id', id);
        if(error) alert(error.message);
        else loadParticipants();
    }
}

// --- ID CARD & QR CODE GENERATION ---

// Helper function to build the HTML for a single ID card
function buildCardElement(participant) {
    const card = document.createElement('div');
    card.className = 'id-card';
    
    // Fallback photo if URL is null
    const photoSrc = participant.photo_url ? participant.photo_url : 'https://via.placeholder.com/150/E5E7EB/6B7280?text=Photo';
    
    card.innerHTML = `
        <div class="id-header">
            <h2>FEST 2026</h2>
            <p>Official Participant Pass</p>
        </div>
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

// Generate a Single ID Card PDF
async function generateSingleCard(participantId) {
    // 1. Fetch exact participant data
    const { data: p, error } = await supabase
        .from('participants')
        .select('*, categories(name), teams(name)')
        .eq('id', participantId)
        .single();
        
    if (error || !p) return alert("Could not fetch participant data.");

    // 2. Clear print container and build card
    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = '';
    const cardElement = buildCardElement(p);
    printContainer.appendChild(cardElement);

    // 3. Generate QR Code inside the specific div
    new QRCode(document.getElementById(`qr-${p.id}`), {
        text: p.unique_id, // This is what the Stage Controller scans
        width: 65,
        height: 65,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });

    // 4. Configure html2pdf for A7 formatting
    const opt = {
        margin:       0,
        filename:     `${p.name}_ID_Card.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 4, useCORS: true }, // High scale for premium print quality
        jsPDF:        { unit: 'mm', format: 'a7', orientation: 'portrait' }
    };

    // 5. Trigger download
    html2pdf().set(opt).from(cardElement).save();
}

// Generate Bulk ID Cards (All participants)
async function generateBulkCards() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Generating Bulk PDF...";
    btn.disabled = true;

    // 1. Fetch all participants
    const { data: participants, error } = await supabase
        .from('participants')
        .select('*, categories(name), teams(name)')
        .order('name');
        
    if (error || !participants.length) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        return alert("No participants found to generate.");
    }

    // 2. Prepare print container
    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = '';

    // 3. Build all cards and their QR codes
    participants.forEach(p => {
        const cardElement = buildCardElement(p);
        printContainer.appendChild(cardElement);
        
        new QRCode(document.getElementById(`qr-${p.id}`), {
            text: p.unique_id,
            width: 65,
            height: 65,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });
    });

    // 4. Configure html2pdf for A7 batch exporting
    const opt = {
        margin:       0,
        filename:     `Fest_2026_All_ID_Cards.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 4, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a7', orientation: 'portrait' }
    };

    // 5. Trigger download and reset button
    html2pdf().set(opt).from(printContainer).save().then(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        printContainer.innerHTML = ''; // Clean up DOM
    });
}

// --- UPDATE switchTab ---
// (Make sure you update the switchTab function at the top of admin.js to trigger loadParticipants)
const originalSwitchTab = switchTab;
switchTab = function(tabId) {
    originalSwitchTab(tabId);
    if (tabId === 'participants') loadParticipants();
}