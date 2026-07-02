const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let html5QrcodeScanner = null;
let currentPresentCount = 0; 
let user = null;

// UI Utilities
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.style.borderLeftColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)';
    
    const icon = type === 'success' ? '<i class="ph-fill ph-check-circle" style="color: var(--success); font-size: 1.25rem;"></i>' 
               : type === 'error' ? '<i class="ph-fill ph-x-circle" style="color: var(--danger); font-size: 1.25rem;"></i>'
               : '<i class="ph-fill ph-info" style="color: var(--primary); font-size: 1.25rem;"></i>';
               
    toast.innerHTML = `${icon} <span style="font-weight: 500; font-size: 0.9rem;">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// 1. Initialize App
async function initializeApp() {
    user = JSON.parse(localStorage.getItem('festUser'));
    if (!user || user.role !== 'stage_controller') {
        window.location.href = 'index.html';
        return;
    }
    loadDashboard();
}

// 2. Load Dashboard & Stage Info
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align:center; padding: 3rem;"><i class="ph ph-spinner-gap" style="font-size: 2rem; animation: spin 1s linear infinite; color: var(--text-muted);"></i><p style="margin-top: 1rem; color: var(--text-muted);">Loading Stage Data...</p></div>`;

    const { data: stage, error: stageError } = await supabaseClient
        .from('stages')
        .select('*')
        .eq('controller_id', user.id)
        .single();

    if (stageError || !stage) {
        document.getElementById('stage-name').innerText = "Unassigned / Error";
        container.innerHTML = `<p style="color: var(--danger); text-align:center;">Failed to load stage data. Please contact Admin.</p>`;
        return;
    }

    document.getElementById('stage-name').innerText = stage.name;
    loadCompetitions(stage.id);
}

// 3. Load Competitions
async function loadCompetitions(stageId) {
    const { data: competitions, error } = await supabaseClient
        .from('competitions')
        .select('*, judges:judgements(judge_id)')
        .eq('stage_id', stageId)
        .order('name');

    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    if (error || !competitions || competitions.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:3rem;"><i class="ph ph-calendar-blank" style="font-size: 3rem; color: var(--text-muted);"></i><p style="margin-top:1rem; color: var(--text-muted);">No competitions assigned to this stage yet.</p></div>`;
        return;
    }

    competitions.forEach(comp => {
        // Skip published comps to keep dashboard clean
        if (comp.status === 'published') return;

        let badgeClass = 'badge-pending';
        let statusText = 'Pending';
        if (comp.status === 'registration') { badgeClass = 'badge-registration'; statusText = 'Scanning QR...'; }
        if (comp.status === 'ongoing') { badgeClass = 'badge-ongoing'; statusText = 'Ongoing'; }
        if (comp.status === 'judgement_complete') { badgeClass = 'badge-complete'; statusText = 'Awaiting Results'; }

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <h2 class="card-title">${comp.name}</h2>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
                        <i class="ph ph-gavel"></i> Judges Assigned: <strong>${comp.judges.length}</strong>
                    </p>
                </div>
                <span class="badge ${badgeClass}">${statusText}</span>
            </div>
            
            <div id="controls-${comp.id}" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                ${getButtonsForStatus(comp)}
            </div>

            <div id="scanner-section-${comp.id}" class="scanner-section">
                <div class="reader-container"><div id="reader-${comp.id}"></div></div>
                <h3 style="font-size: 1rem; margin-top: 1rem;">Checked-In Participants</h3>
                <div class="participant-list" id="list-${comp.id}">
                    <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 1rem;">Waiting for scans...</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getButtonsForStatus(comp) {
    if (comp.status === 'pending') {
        return `<button class="btn btn-primary" onclick="startRegistration('${comp.id}', this)"><i class="ph ph-qr-code"></i> Start Registration</button>`;
    }
    if (comp.status === 'registration') {
        return `
            <button class="btn btn-success" onclick="submitRegistration('${comp.id}', this)"><i class="ph ph-check-circle"></i> Complete Registration (Start Event)</button>
            <button class="btn btn-danger" onclick="stopScannerOnly('${comp.id}')"><i class="ph ph-x"></i> Close Camera</button>
        `;
    }
    if (comp.status === 'ongoing') {
        return `<button class="btn btn-warning" onclick="finishCompetition('${comp.id}', this)"><i class="ph ph-flag-checkered"></i> End Competition</button>`;
    }
    return `<p style="color: var(--text-muted); font-size: 0.95rem; text-align: center; background: #F8FAFC; padding: 1rem; border-radius: 8px;">Action completed. Waiting for Manager to publish.</p>`;
}

// 4. Registration Logic
async function startRegistration(compId, btn) {
    btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Starting...';
    btn.disabled = true;

    // FIX: Get accurate count of already registered participants for THIS competition
    const { count, error } = await supabaseClient
        .from('competition_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', compId)
        .eq('is_present', true);
    
    currentPresentCount = error ? 0 : count;

    await updateStatus(compId, 'registration');
    document.getElementById(`scanner-section-${compId}`).style.display = 'block';
    
    // Init Scanner
    html5QrcodeScanner = new Html5QrcodeScanner(`reader-${compId}`, { fps: 10, qrbox: {width: 250, height: 250} }, false);
    html5QrcodeScanner.render((decodedText) => onScanSuccess(decodedText, compId), onScanFailure);
    
    // Pre-load list if participants already exist
    loadCheckedInList(compId);
}

// Auto-generate code letters
function generateCodeLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

let isProcessingScan = false;

async function onScanSuccess(decodedText, compId) {
    if (isProcessingScan) return; // Prevent double-scans
    isProcessingScan = true;
    html5QrcodeScanner.pause();
    showToast("QR Detected. Verifying...", "info");

    const { data: registration, error } = await supabaseClient
        .from('competition_registrations')
        .select('*, participants!inner(unique_id, name)')
        .eq('competition_id', compId)
        .eq('participants.unique_id', decodedText)
        .single();

    if (error || !registration) {
        showToast("Invalid QR! Not registered for this event.", "error");
    } 
    else if (registration.is_present) {
        showToast(`${registration.participants.name} is already checked in.`, "warning");
    } 
    else {
        const codeLetter = generateCodeLetter(currentPresentCount);
        const { error: updateErr } = await supabaseClient
            .from('competition_registrations')
            .update({ is_present: true, code_letter: codeLetter })
            .eq('id', registration.id);

        if(!updateErr) {
            currentPresentCount++;
            showToast(`Success! ${registration.participants.name} assigned: ${codeLetter}`);
            loadCheckedInList(compId); // Refresh list
        }
    }
    
    setTimeout(() => {
        isProcessingScan = false;
        html5QrcodeScanner.resume();
    }, 2000); 
}

function onScanFailure(error) { /* Ignore routine frame failures */ }

// Load the mini-list below the scanner
async function loadCheckedInList(compId) {
    const { data } = await supabaseClient
        .from('competition_registrations')
        .select('code_letter, participants(name)')
        .eq('competition_id', compId)
        .eq('is_present', true)
        .order('code_letter', { ascending: false });

    const list = document.getElementById(`list-${compId}`);
    if (data && data.length > 0) {
        list.innerHTML = data.map(reg => `
            <div class="participant-item">
                <span style="font-weight: 500;">${reg.participants.name}</span>
                <span class="code-letter">${reg.code_letter}</span>
            </div>
        `).join('');
    }
}

// 5. State Transitions
function stopScannerOnly(compId) {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
    }
    document.getElementById(`scanner-section-${compId}`).style.display = 'none';
    showToast("Camera Closed.");
}

async function submitRegistration(compId, btn) {
    if(!confirm("Are you sure? This will lock registration and judges can begin grading.")) return;
    
    if(html5QrcodeScanner) html5QrcodeScanner.clear().catch(e => console.error(e));
    
    btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Starting...';
    btn.disabled = true;
    
    await updateStatus(compId, 'ongoing');
    showToast("Event Started!");
}

async function finishCompetition(compId, btn) {
    if(!confirm("End competition? This will lock judge marks and notify the Manager.")) return;
    btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Ending...';
    btn.disabled = true;
    await updateStatus(compId, 'judgement_complete');
    showToast("Competition Finished!");
}

async function updateStatus(compId, status) {
    await supabaseClient.from('competitions').update({ status }).eq('id', compId);
    loadDashboard(); 
}

function logout() {
    if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(e => console.error(e));
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// Dynamic CSS for spinner
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

initializeApp();