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
        // SAFETY CHECK: Only inject if the element actually exists in the DOM
        if (navActions) {
            navActions.insertAdjacentHTML('afterbegin', `<button class="btn btn-primary" onclick="window.location.href='admin.html'"><i class="ph ph-shield-check"></i> Admin Hub</button>`);
        }
    }
    
    // Inject the username
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
        welcomeMsg.innerText = `WELCOME, ${user.username}`;
    }
    
    loadDashboard();
}

// 2. Load Dashboard & Stage Info
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align:center; padding: 3rem;"><i class="ph ph-spinner-gap" style="font-size: 2rem; animation: spin 1s linear infinite; color: var(--text-muted);"></i><p style="margin-top: 1rem; color: var(--text-muted);">Loading Stage Data...</p></div>`;

    if (user.role === 'master_admin') {
        document.getElementById('stage-name').innerText = "Master Override";
        document.getElementById('master-filter-container').style.display = 'block';
        
        // FIX: Increase body padding dynamically so the taller Master Admin header doesn't cover content
        document.body.style.paddingTop = '160px'; 
        
        // Fetch all stages to populate the Master Admin dropdown
        const { data: stages } = await supabaseClient.from('stages').select('id, name').order('stage_no');
        const filterDropdown = document.getElementById('master-stage-filter');
        filterDropdown.innerHTML = '<option value="ALL">-- ALL STAGES (MASTER VIEW) --</option>';
        
        if (stages) {
            stages.forEach(s => {
                filterDropdown.innerHTML += `<option value="${s.id}">${s.name}</option>`;
            });
        }

        loadCompetitions('ALL');
        return;
    }

    const { data: stage, error: stageError } = await supabaseClient
        .from('stages').select('*').eq('controller_id', user.id).maybeSingle();

    if (stageError || !stage) {
        document.getElementById('stage-name').innerText = "Unassigned / Error";
        container.innerHTML = `<p style="color: var(--danger); text-align:center; background: white; padding: 2rem; border-radius: 12px;">Failed to load stage data. Ask the Master Admin to assign you to a stage.</p>`;
        return;
    }

    document.getElementById('stage-name').innerText = stage.name;
    loadCompetitions(stage.id);
}

// 3. Load Competitions
async function loadCompetitions(stageId) {
    // FIX: Added categories(name) and participant_competitions to get total enrolled count
    let query = supabaseClient.from('competitions')
        .select('*, categories(name), judgements(judge_id, awarded_mark), participant_competitions(participant_id)')
        .order('name');
    
    // APPLY STAGE FILTER
    if (stageId && stageId !== 'ALL') {
        query = query.eq('stage_id', stageId);
    }
    
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

        // Calculate enrolled students
        const enrolledCount = comp.participant_competitions ? comp.participant_competitions.length : 0;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 1rem;">
                        <h2 class="card-title">${comp.name}</h2>
                        <span class="badge ${badgeClass}" style="white-space: nowrap;">${statusText}</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.75rem;">
                        <span style="color: var(--primary); font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
                            <i class="ph-fill ph-folders"></i> ${comp.categories?.name || 'Uncategorized'}
                        </span>
                        
                        <div style="display: flex; gap: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                            <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                                <i class="ph-fill ph-users"></i> Enrolled: <strong>${enrolledCount}</strong>
                            </span>
                            <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                                <i class="ph-fill ph-gavel"></i> Marks: <strong>${comp.judgements ? comp.judgements.length : 0}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="controls-${comp.id}" style="display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap;">
                ${getButtonsForStatus(comp)}
            </div>

            <div class="card-list-section" ${comp.status === 'pending' ? 'style="display:none;"' : ''}>
                <h3 style="font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="ph-fill ph-users" style="color: var(--primary);"></i> Participant Status
                </h3>
                <div class="participant-list" id="list-${comp.id}">
                    <p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">Loading participants...</p>
                </div>
            </div>
        `;
        container.appendChild(card);
        
        if (comp.status !== 'pending') {
            loadCheckedInList(comp.id);
        }
    });
}

function getButtonsForStatus(comp) {
    if (comp.status === 'pending') {
        // SMART FIX: Check the judgements array instead of the judges array
        // If there are judgement rows, it means judges have been assigned!
        const hasJudges = comp.judgements && comp.judgements.length > 0;
        
        if (!hasJudges) {
            return `<button class="btn btn-outline" style="opacity: 0.6; cursor: not-allowed;" title="ASSIGN JUDGES FIRST" disabled><i class="ph ph-warning"></i> NO JUDGES ASSIGNED</button>`;
        }
        
        return `<button class="btn btn-primary" onclick="changeCompetitionState('${comp.id}', 'registration', this, 'STARTING')"><i class="ph ph-qr-code"></i> START REGISTRATION</button>`;
    }
    
    if (comp.status === 'registration') {
        return `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button class="btn btn-outline" style="flex:1; padding: 0.5rem;" onclick="openScannerModal('${comp.id}', '${comp.name}')" title="SCAN QR"><i class="ph ph-scan"></i> SCAN</button>
                <button class="btn btn-success" style="flex:1; padding: 0.5rem;" onclick="changeCompetitionState('${comp.id}', 'ongoing', this, 'STARTING')"><i class="ph ph-play"></i> START</button>
                <button class="btn" style="flex:1; padding: 0.5rem; background: var(--danger); color: white;" onclick="cancelRegistration('${comp.id}', this)"><i class="ph ph-x"></i> CANCEL</button>
            </div>
        `;
    }
    
    if (comp.status === 'ongoing') {
        // CHECK FOR MARKS: Do any rows have a valid awarded_mark?
        const hasMarks = comp.judgements && comp.judgements.some(j => j.awarded_mark !== null);

        // Conditional Button Rendering
        const endBtn = hasMarks 
            ? `<button class="btn btn-warning" style="flex:2;" onclick="changeCompetitionState('${comp.id}', 'judgement_complete', this, 'ENDING')"><i class="ph ph-flag-checkered"></i> END COMPETITION</button>`
            : `<button class="btn btn-outline" style="flex:2; opacity: 0.6; cursor: not-allowed;" title="WAITING FOR JUDGES TO SUBMIT MARKS..." disabled><i class="ph ph-hourglass"></i> AWAITING JUDGES...</button>`;

        return `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button class="btn btn-outline" style="flex:1;" onclick="backToRegistration('${comp.id}', this)"><i class="ph ph-arrow-u-up-left"></i> BACK</button>
                ${endBtn}
            </div>
        `;
    }
    
    return `<p style="color: var(--text-muted); font-size: 0.95rem; width: 100%; text-align: center; background: #F8FAFC; padding: 1rem; border-radius: 8px;">ACTION COMPLETED. WAITING FOR MANAGER TO PUBLISH.</p>`;
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

// --- REPLACE THIS FUNCTION IN STAGE-CONTROLLER.JS ---

async function loadCheckedInList(compId) {
    const listContainer = document.getElementById(`list-${compId}`);
    if (!listContainer) return;

    // Fetch ALL participants registered for this specific competition
    const { data, error } = await supabaseClient
        .from('participant_competitions')
        .select('code_letter, is_present, participants(name, unique_id)')
        .eq('competition_id', compId);

    if (error) {
        listContainer.innerHTML = `<p style="color: var(--danger); font-size: 0.9rem;">Failed to load participants.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">No participants are enrolled in this competition.</p>`;
        return;
    }

    // Split data into Checked-In vs Pending
    const checkedIn = data.filter(d => d.is_present).sort((a, b) => {
        if(a.code_letter < b.code_letter) return 1;
        if(a.code_letter > b.code_letter) return -1;
        return 0;
    });
    
    // Sort pending alphabetically by name
    const pending = data.filter(d => !d.is_present).sort((a, b) => a.participants.name.localeCompare(b.participants.name));

    let html = '';

    // --- 1. RENDER CHECKED-IN STUDENTS ---
    if (checkedIn.length > 0) {
        html += checkedIn.map(reg => `
            <div class="participant-item" style="border-left: 4px solid var(--success);">
                <div>
                    <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); display: block;">${reg.participants.name}</span>
                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--success); display: flex; align-items: center; gap: 0.2rem;">
                        <i class="ph-fill ph-check-circle"></i> Checked In
                    </span>
                </div>
                <span class="code-letter">${reg.code_letter}</span>
            </div>
        `).join('');
    } else {
        html += `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1; margin-bottom: 0.5rem;">No one has checked in yet.</p>`;
    }

    // --- 2. RENDER PENDING STUDENTS ---
    if (pending.length > 0) {
        html += `
            <div style="grid-column: 1/-1; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
                <h4 style="font-size: 0.8rem; font-weight: 800; color: var(--warning); margin-bottom: 0.75rem; letter-spacing: 0.05em;">
                    <i class="ph-fill ph-clock"></i> PENDING ARRIVAL (${pending.length})
                </h4>
            </div>
        `;
        
        html += pending.map(reg => `
            <div class="participant-item" style="opacity: 0.75; background: transparent; border-left: 4px solid var(--warning);">
                <div>
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main); display: block;">${reg.participants.name}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${reg.participants.unique_id}</span>
                </div>
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--warning); background: var(--warning-light); padding: 0.25rem 0.6rem; border-radius: 4px;">ABSENT</span>
            </div>
        `).join('');
    }

    listContainer.innerHTML = html;
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

// --- Cancel Registration (Even if participants are scanned) ---
async function cancelRegistration(compId, btn) {
    try {
        if (!confirm("WARNING: THIS WILL CANCEL REGISTRATION AND REMOVE ANY SCANNED PARTICIPANTS. PROCEED?")) return;
        
        // Set the button to loading
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> CANCELLING...';
        btn.disabled = true;

        // Reset all scanned participants for this competition back to 'not present'
        const { error: resetError } = await supabaseClient
            .from('participant_competitions')
            .update({ is_present: false, code_letter: null })
            .eq('competition_id', compId);
            
        if (resetError) throw resetError;
        
        // Change state back to pending
        await changeCompetitionState(compId, 'pending', btn, 'CANCELLING');
    } catch (err) {
        showToast("ERROR CANCELLING: " + err.message, "error");
        btn.innerHTML = '<i class="ph ph-x"></i> CANCEL';
        btn.disabled = false;
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