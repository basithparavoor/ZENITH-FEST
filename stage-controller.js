// Initialize Supabase Client (Use your actual keys)
const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let html5QrcodeScanner = null;
let currentPresentCount = 0; // Tracks number of scanned participants to assign A, B, C...

// 1. Auth Check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || user.role !== 'stage_controller') {
    window.location.href = 'index.html';
}

// 2. Initial Load
async function loadDashboard() {
    // Get assigned stage for this controller
    const { data: stage } = await supabase
        .from('stages')
        .select('*')
        .eq('controller_id', user.id)
        .single();

    if (stage) {
        document.getElementById('stage-name').innerText = stage.name;
        loadCompetitions(stage.id);
    }
}

// 3. Load Competitions for the Stage
async function loadCompetitions(stageId) {
    const { data: competitions } = await supabase
        .from('competitions')
        .select('*, judges:judgements(judge_id)')
        .eq('stage_id', stageId);

    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    competitions.forEach(comp => {
        // Build card based on status
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <h2>${comp.name}</h2>
                <span class="badge ${comp.status}">${comp.status.replace('_', ' ')}</span>
            </div>
            <p style="color: #6B7280; margin-bottom: 1rem;">Assigned Judges: ${comp.judges.length}</p>
            
            <div id="controls-${comp.id}">
                ${getButtonsForStatus(comp)}
            </div>

            <!-- Scanner section hidden by default -->
            <div id="scanner-section-${comp.id}" style="display: none; margin-top: 1rem;">
                <div id="reader-${comp.id}" style="width: 100%;"></div>
                <div class="participant-list" id="list-${comp.id}"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getButtonsForStatus(comp) {
    if (comp.status === 'pending') {
        return `<button class="btn btn-primary" onclick="startRegistration('${comp.id}')">Start Registration</button>`;
    }
    if (comp.status === 'registration') {
        return `
            <button class="btn btn-warning" onclick="submitRegistration('${comp.id}')">Submit Registration</button>
            <button class="btn btn-primary" style="margin-top: 10px;" onclick="closeScanner('${comp.id}')">Stop Scanning</button>
        `;
    }
    if (comp.status === 'ongoing') {
        return `<button class="btn btn-success" onclick="finishCompetition('${comp.id}')">Finish Competition</button>`;
    }
    return `<p>Action completed. Awaiting Results Publish.</p>`;
}

// 4. Registration & Scanning Logic
async function startRegistration(compId) {
    await updateStatus(compId, 'registration');
    document.getElementById(`scanner-section-${compId}`).style.display = 'block';
    
    // Initialize Scanner
    html5QrcodeScanner = new Html5QrcodeScanner(`reader-${compId}`, { fps: 10, qrbox: {width: 250, height: 250} }, false);
    html5QrcodeScanner.render((decodedText) => onScanSuccess(decodedText, compId), onScanFailure);
}

// Auto-generate code letters: 0=A, 1=B, 25=Z, 26=AA...
function generateCodeLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

async function onScanSuccess(decodedText, compId) {
    // decodedText is expected to be the Participant's unique_id from the QR code
    html5QrcodeScanner.pause();

    // Check if participant belongs to this competition
    const { data: registration, error } = await supabase
        .from('competition_registrations')
        .select('*, participants!inner(unique_id, name)')
        .eq('competition_id', compId)
        .eq('participants.unique_id', decodedText)
        .single();

    if (registration && !registration.is_present) {
        // Assign letter and mark present
        const codeLetter = generateCodeLetter(currentPresentCount);
        
        await supabase
            .from('competition_registrations')
            .update({ is_present: true, code_letter: codeLetter })
            .eq('id', registration.id);

        currentPresentCount++;
        
        // Update UI list
        const list = document.getElementById(`list-${compId}`);
        list.innerHTML += `
            <div class="participant-item">
                <span>${registration.participants.name} (Scanned)</span>
                <span class="code-letter">${codeLetter}</span>
            </div>
        `;
        alert(`Success! Code Assigned: ${codeLetter}`);
    } else if (registration && registration.is_present) {
        alert("Participant already checked in!");
    } else {
        alert("Participant not registered for this competition.");
    }
    
    setTimeout(() => html5QrcodeScanner.resume(), 1500); // Resume scanning after 1.5s
}

function onScanFailure(error) {
    // Ignore routine scan failures (when no QR is in frame)
}

// 5. State Transitions
async function submitRegistration(compId) {
    if(html5QrcodeScanner) {
        html5QrcodeScanner.clear(); // Stop camera
    }
    // Transition to ongoing so judges can see it
    await updateStatus(compId, 'ongoing');
}

async function finishCompetition(compId) {
    // Verify if all judges have submitted before allowing finish (optional check can go here)
    await updateStatus(compId, 'judgement_complete');
}

async function updateStatus(compId, status) {
    await supabase.from('competitions').update({ status }).eq('id', compId);
    loadDashboard(); // Refresh UI
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// Boot up
loadDashboard();