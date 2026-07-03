const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let html5QrcodeScanner = null;
let currentPresentCount = 0; 
let activeScanCompId = null; // Tracks which competition the popup is scanning for
let user = null;
let isProcessingScan = false;

// UI Utilities
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.style.borderLeftColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--warning)';
    
    const icon = type === 'success' ? '<i class="ph-fill ph-check-circle" style="color: var(--success); font-size: 1.25rem;"></i>' 
               : type === 'error' ? '<i class="ph-fill ph-x-circle" style="color: var(--danger); font-size: 1.25rem;"></i>'
               : '<i class="ph-fill ph-warning" style="color: var(--warning); font-size: 1.25rem;"></i>';
               
    toast.innerHTML = `${icon} <span style="font-weight: 500; font-size: 0.9rem;">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// 1. Initialize App
async function initializeApp() {
    user = JSON.parse(localStorage.getItem('festUser'));
    if (!user || (user.role !== 'stage_controller' && user.role !== 'master_admin')) {
        window.location.href = 'index.html';
        return;
    }
    
    if (user.role === 'master_admin') {
        const navActions = document.querySelector('.nav-actions');
        navActions.insertAdjacentHTML('afterbegin', `<button class="btn btn-primary" onclick="window.location.href='admin.html'"><i class="ph ph-shield-check"></i> Admin Hub</button>`);
    }
    // Add this to inject the username!
document.getElementById('welcome-msg').innerText = `WELCOME, ${user.username}`;
    loadDashboard();
}

// 2. Load Dashboard & Stage Info
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align:center; padding: 3rem;"><i class="ph ph-spinner-gap" style="font-size: 2rem; animation: spin 1s linear infinite; color: var(--text-muted);"></i><p style="margin-top: 1rem; color: var(--text-muted);">Loading Stage Data...</p></div>`;

    if (user.role === 'master_admin') {
        document.getElementById('stage-name').innerText = "Master Override (All Stages)";
        loadCompetitions('ALL');
        return;
    }

    const { data: stage, error: stageError } = await supabaseClient
    .from('stages').select('*').eq('controller_id', user.id).maybeSingle();

    if (stageError || !stage) {
        document.getElementById('stage-name').innerText = "Unassigned / Error";
        container.innerHTML = `<p style="color: var(--danger); text-align:center;">Failed to load stage data.</p>`;
        return;
    }

    document.getElementById('stage-name').innerText = stage.name;
    loadCompetitions(stage.id);
}

// 3. Load Competitions
async function loadCompetitions(stageId) {
    let query = supabaseClient.from('competitions').select('*, judgements(judge_id, awarded_mark)').order('name');
    if (stageId !== 'ALL') query = query.eq('stage_id', stageId);

    const { data: competitions, error } = await query;
    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    if (error || !competitions || competitions.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:3rem;"><p style="color: var(--text-muted);">No competitions assigned to this stage yet.</p></div>`;
        return;
    }

    competitions.forEach(comp => {
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
            <i class="ph ph-gavel"></i> Marks Submitted: <strong>${comp.judgements ? comp.judgements.length : 0}</strong>
        </p>
    </div>
    <span class="badge ${badgeClass}">${statusText}</span>
</div>
            
            <div id="controls-${comp.id}" style="display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap;">
                ${getButtonsForStatus(comp)}
            </div>

            <div class="card-list-section" ${comp.status === 'pending' ? 'style="display:none;"' : ''}>
                <h3 style="font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph ph-users" style="color: var(--primary);"></i> Checked-In Participants
                </h3>
                <div class="participant-list" id="list-${comp.id}">
                    <p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">Loading participants...</p>
                </div>
            </div>
        `;
        container.appendChild(card);
        
        // Load the list if we are past the pending phase
        if (comp.status !== 'pending') {
            loadCheckedInList(comp.id);
        }
    });
}

function getButtonsForStatus(comp) {
    if (comp.status === 'pending') {
        return `<button class="btn btn-primary" onclick="changeCompetitionState('${comp.id}', 'registration', this, 'Starting')"><i class="ph ph-qr-code"></i> Start Registration</button>`;
    }
    
    if (comp.status === 'registration') {
        return `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button class="btn btn-outline" style="flex:1; padding: 0.5rem;" onclick="openScannerModal('${comp.id}', '${comp.name}')" title="Scan QR"><i class="ph ph-scan"></i> Scan</button>
                <button class="btn btn-success" style="flex:1; padding: 0.5rem;" onclick="changeCompetitionState('${comp.id}', 'ongoing', this, 'Starting')"><i class="ph ph-play"></i> Start</button>
                <button class="btn" style="flex:1; padding: 0.5rem; background: var(--danger); color: white;" onclick="cancelRegistration('${comp.id}', this)"><i class="ph ph-x"></i> Cancel</button>
            </div>
        `;
    }
    
    if (comp.status === 'ongoing') {
        // CHECK FOR MARKS: Do any rows have a valid awarded_mark?
        const hasMarks = comp.judgements && comp.judgements.some(j => j.awarded_mark !== null);

        // Conditional Button Rendering
        const endBtn = hasMarks 
            ? `<button class="btn btn-warning" style="flex:2;" onclick="changeCompetitionState('${comp.id}', 'judgement_complete', this, 'Ending')"><i class="ph ph-flag-checkered"></i> End Competition</button>`
            : `<button class="btn btn-outline" style="flex:2; opacity: 0.6; cursor: not-allowed;" title="Waiting for judges to submit marks..." disabled><i class="ph ph-hourglass"></i> Awaiting Judges...</button>`;

        return `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button class="btn btn-outline" style="flex:1;" onclick="backToRegistration('${comp.id}', this)"><i class="ph ph-arrow-u-up-left"></i> Back</button>
                ${endBtn}
            </div>
        `;
    }
    
    return `<p style="color: var(--text-muted); font-size: 0.95rem; width: 100%; text-align: center; background: #F8FAFC; padding: 1rem; border-radius: 8px;">Action completed. Waiting for Manager to publish.</p>`;
}



async function openScannerModal(compId, compName) {
    activeScanCompId = compId;
    document.getElementById('modal-comp-name').innerText = `Scanning: ${compName}`;
    document.getElementById('scanner-modal').style.display = 'flex';

    // CHANGED: Now looking at participant_competitions
    const { count } = await supabaseClient
        .from('participant_competitions') 
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', compId)
        .eq('is_present', true);
    
    currentPresentCount = count || 0;

    // Start Camera
    html5QrcodeScanner = new Html5QrcodeScanner("global-reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeScannerModal() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
    }
    document.getElementById('scanner-modal').style.display = 'none';
    activeScanCompId = null;
    loadDashboard(); // Refresh cards to show newly scanned students
}

// Auto-generate code letters (A, B... Z, AA...)
function generateCodeLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

async function onScanSuccess(decodedText) {
    if (isProcessingScan || !activeScanCompId) return; 
    isProcessingScan = true;
    html5QrcodeScanner.pause();

    // Clean the text and extract the ID if it's a URL
    let qrId = decodedText.trim();
    if (qrId.includes('?id=')) {
        qrId = qrId.split('?id=')[1];
    }
    console.log("Scanned QR Data:", qrId);

    try {
        // Fetch the participant
        const { data: participant, error: pError } = await supabaseClient
            .from('participants')
            .select('id, name')
            .eq('unique_id', qrId)
            .single();

        if (pError || !participant) {
            showToast("Invalid QR: Participant not found in system.", "error");
            resetScanner();
            return;
        }

        // CHANGED: Now looking at participant_competitions
        const { data: registration, error: rError } = await supabaseClient
            .from('participant_competitions')
            .select('*')
            .eq('competition_id', activeScanCompId)
            .eq('participant_id', participant.id)
            .single();

        if (rError || !registration) {
            showToast(`${participant.name} is not registered for this competition.`, "error");
            resetScanner();
            return;
        }

        if (registration.is_present) {
            showToast(`${participant.name} is already checked in.`, "warning");
            resetScanner();
            return;
        } 

        const codeLetter = generateCodeLetter(currentPresentCount);
        
        // CHANGED: Now updating participant_competitions
        const { error: updateErr } = await supabaseClient
            .from('participant_competitions')
            .update({ is_present: true, code_letter: codeLetter })
            .eq('id', registration.id);

        if(!updateErr) {
            currentPresentCount++;
            showToast(`Success! ${participant.name} assigned: ${codeLetter}`);
            loadCheckedInList(activeScanCompId); 
        } else {
            showToast("Database error saving check-in.", "error");
        }
    } catch (err) {
        showToast("System error during scan.", "error");
    }

    resetScanner();
}

function resetScanner() {
    setTimeout(() => {
        isProcessingScan = false;
        // Only resume if scanner modal is still active
        if (document.getElementById('scanner-modal').style.display === 'flex') {
            html5QrcodeScanner.resume();
        }
    }, 800); // Changed from 2000 to 800 for rapid scanning!
}

function onScanFailure(error) { /* Ignore routine frame failures */ }

async function loadCheckedInList(compId) {
    const list = document.getElementById(`list-${compId}`);
    if (!list) return;

    // CHANGED: Now querying participant_competitions
    const { data } = await supabaseClient
        .from('participant_competitions')
        .select('code_letter, participants(name)')
        .eq('competition_id', compId)
        .eq('is_present', true)
        .order('code_letter', { ascending: false });

    if (data && data.length > 0) {
        list.innerHTML = data.map(reg => `
            <div class="participant-item">
                <span style="font-weight: 500; font-size: 0.9rem;">${reg.participants.name}</span>
                <span class="code-letter">${reg.code_letter}</span>
            </div>
        `).join('');
    } else {
        list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">No one checked in yet.</p>`;
    }
}

// --- NEW MASTER STATE TRANSITION FUNCTION ---
async function changeCompetitionState(compId, newStatus, btnElement, loadingText) {
    // 1. Confirmations
    if (newStatus === 'ongoing' && !confirm("Lock registration and start the event?")) return;
    if (newStatus === 'judgement_complete' && !confirm("End competition? This locks marks and notifies the Manager.")) return;

    // 2. Set UI Loading State
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> ${loadingText}...`;
    btnElement.disabled = true;

    try {
        // 3. SIDE EFFECTS: If moving BACKWARDS to pending or registration, wipe any rogue marks!
        if (newStatus === 'registration' || newStatus === 'pending') {
            await supabaseClient.from('judgements')
                .delete()
                .eq('competition_id', compId)
                .not('participant_id', 'is', null);
        }

        // 4. UPDATE DB STATUS
        const { error } = await supabaseClient
            .from('competitions')
            .update({ status: newStatus })
            .eq('id', compId);

        if (error) throw error;
        
        showToast(`Status updated successfully!`);
        loadDashboard(); // Refresh UI
        
    } catch (err) {
        showToast("Error updating status: " + err.message, "error");
        btnElement.innerHTML = originalHTML;
        btnElement.disabled = false;
    }
}

// --- Cancel Registration (Only if empty) ---
async function cancelRegistration(compId, btn) {
    try {
        const { count, error } = await supabaseClient
            .from('participant_competitions')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', compId)
            .eq('is_present', true);
            
        if (error) throw error;
            
        if (count > 0) return showToast("CANNOT CANCEL. PARTICIPANTS ARE ALREADY CHECKED IN.", "error");
        if (!confirm("CANCEL REGISTRATION AND RETURN TO PENDING STATE?")) return;
        
        await changeCompetitionState(compId, 'pending', btn, 'CANCELLING');
    } catch (err) {
        showToast("ERROR CANCELLING: " + err.message, "error");
    }
}

// --- Go back to Registration from Ongoing ---
async function backToRegistration(compId, btn) {
    if(!confirm("⚠️ Re-open the scanner? This will ERASE any submitted marks!")) return;
    changeCompetitionState(compId, 'registration', btn, 'Reverting');
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