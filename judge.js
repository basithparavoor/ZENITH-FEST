const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentCompId = null;
let currentMaxMark = 0;
let user = null; 

// 1. Initialize App and Auth
async function initializeApp() {
    user = JSON.parse(localStorage.getItem('festUser'));

    // Security Check
    if (!user || user.role !== 'judge') {
        window.location.href = 'index.html';
        return; 
    }

    // Update UI
    document.getElementById('judge-name').innerText = `Welcome, ${user.username || user.email}`;

    // Load the dashboard
    loadDashboard(); 
}

// 2. Load Assigned Competitions (Updated Logic)
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading assignments...</p>`;

    // 1. Fetch ALL records linked to this judge in the judgements table
    const { data: allJudgeRecords, error } = await supabaseClient
        .from('judgements')
        .select('competition_id, awarded_mark, competitions(id, name, max_mark, status)')
        .eq('judge_id', user.id); 

    if (error) {
        console.error(error);
        container.innerHTML = `<p style="color: #EF4444;">Failed to load competitions. Please refresh.</p>`;
        return;
    }

    // 2. Figure out which competitions are assigned, and which are already graded
    const compStatusMap = new Map();
    
    allJudgeRecords.forEach(row => {
        if (!row.competitions) return; 
        const cId = row.competition_id;
        
        if (!compStatusMap.has(cId)) {
            compStatusMap.set(cId, { comp: row.competitions, hasGraded: false });
        }
        
        // If any record for this competition has a mark, the judge has completed their evaluation
        if (row.awarded_mark !== null) {
            compStatusMap.get(cId).hasGraded = true;
        }
    });

    container.innerHTML = '';
    let displayCount = 0;

    // 3. Render the UI
    compStatusMap.forEach(({ comp, hasGraded }) => {
        // Hide if already graded, published, or completed
        if (hasGraded || comp.status === 'judgement_complete' || comp.status === 'published') return;

        displayCount++;
        
        // Determine UI state based on competition status
        const isOngoing = comp.status === 'ongoing';
        const badgeColor = isOngoing ? 'var(--success)' : '#D97706';
        const statusText = isOngoing ? 'Ready to Evaluate' : 'Starts Soon';
        const btnState = isOngoing ? '' : 'disabled';
        const btnText = isOngoing ? 'Evaluate Now' : 'Waiting to start...';
        
        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.innerHTML = `
            <div class="comp-card-inner" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 600;">${comp.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">
                        <span style="display: inline-block; width: 8px; height: 8px; background: ${badgeColor}; border-radius: 50%; margin-right: 6px;"></span>
                        <strong>${statusText}</strong> | Max Mark: ${comp.max_mark}
                    </p>
                </div>
                <button class="btn ${isOngoing ? 'btn-primary' : 'btn-outline'}" ${btnState} onclick="openEvaluation('${comp.id}', '${comp.name}', ${comp.max_mark})">
                    ${btnText}
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    // 4. Empty State
    if (displayCount === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--surface); border-radius: var(--radius); border: 1px dashed var(--border);">
                <p style="color: var(--text-muted); font-size: 1.1rem;">You have no pending assignments at the moment.</p>
            </div>`;
    }
}
// 3. Open Evaluation Interface
async function openEvaluation(compId, compName, maxMark) {
    currentCompId = compId;
    currentMaxMark = maxMark;

    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('evaluation-view').style.display = 'block';
    document.getElementById('eval-comp-name').innerText = compName;
    document.getElementById('eval-max-mark').innerText = maxMark;

    const container = document.getElementById('participants-container');
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading participants...</p>`;

    const { data: registrations, error } = await supabaseClient
        .from('competition_registrations')
        .select('participant_id, code_letter')
        .eq('competition_id', compId)
        .eq('is_present', true)
        .order('code_letter', { ascending: true });

    container.innerHTML = '';

    if (error) {
        console.error(error);
        container.innerHTML = `<p style="color: #EF4444; text-align: center;">Error loading participants.</p>`;
        return;
    }

    if (!registrations || registrations.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No participants have been marked present yet.</p>`;
        return;
    }

    registrations.forEach(reg => {
        container.innerHTML += `
            <div class="participant-row" data-pid="${reg.participant_id}">
                <div class="participant-info">
                    <div class="code-letter">${reg.code_letter}</div>
                    <span style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">Participant<br>Code</span>
                </div>
                <div class="mark-wrapper">
                    <input type="number" 
                           class="mark-input" 
                           placeholder="0" 
                           min="0" 
                           max="${maxMark}" 
                           step="0.5" 
                           oninput="validateMark(this, ${maxMark})">
                    <span class="max-mark-label">/ ${maxMark}</span>
                </div>
            </div>
        `;
    });
}

// 4. Validate Input Live
function validateMark(input, max) {
    let val = parseFloat(input.value);
    if (val > max) input.value = max;
    if (val < 0) input.value = 0;
}

// 5. Submit Judgement
async function submitJudgement() {
    const rows = document.querySelectorAll('.participant-row');
    if (rows.length === 0) return;

    const marksData = [];
    let isValid = true;

    rows.forEach(row => {
        const pId = row.getAttribute('data-pid');
        const markInput = row.querySelector('.mark-input').value;
        
        if (markInput === '') {
            isValid = false;
            row.style.borderColor = '#EF4444'; 
        } else {
            row.style.borderColor = 'var(--border)';
        }

        marksData.push({
            competition_id: currentCompId,
            judge_id: user.id,
            participant_id: pId,
            awarded_mark: parseFloat(markInput)
        });
    });

    if (!isValid) {
        alert("Please enter marks for all participants before submitting.");
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = `
        <svg style="animation: spin 1s linear infinite; margin-right: 8px; width: 20px; height: 20px; color: white;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Submitting...
    `;

    const { error } = await supabaseClient
        .from('judgements')
        .upsert(marksData, { onConflict: 'competition_id,judge_id,participant_id' });

    if (error) {
        alert('Error submitting marks: ' + error.message);
        btn.disabled = false;
        btn.innerText = 'Submit All Marks';
    } else {
        alert('Marks submitted successfully!');
        closeEvaluation();
        loadDashboard(); 
    }
}

function closeEvaluation() {
    document.getElementById('evaluation-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    currentCompId = null;
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('submit-btn').innerText = 'Submit All Marks';
}

// Inside your judge.js file

async function loadParticipantsForJudging(compId) {
    const container = document.getElementById('judging-list');
    container.innerHTML = 'Loading participants...';

    try {
        // THE TRICK: Only select the code_letter and the ID for saving marks. 
        // Notice we do NOT include 'participants(name)'.
        const { data: participants, error } = await supabaseClient
            .from('participant_competitions')
            .select('id, participant_id, code_letter') 
            .eq('competition_id', compId)
            .eq('is_present', true)
            .order('code_letter', { ascending: true });

        if (error) throw error;

        if (!participants || participants.length === 0) {
            container.innerHTML = '<p>No participants checked in yet.</p>';
            return;
        }

        renderJudgingUI(participants);

    } catch (err) {
        console.error("Error loading participants:", err);
        showToast("Failed to load participants.", "error");
    }
}

function renderJudgingUI(participants) {
    const container = document.getElementById('judging-list');
    container.innerHTML = '';

    participants.forEach(p => {
        // Fallback in case a code_letter wasn't generated properly
        const displayName = p.code_letter ? `Participant ${p.code_letter}` : 'Unknown Participant';

        container.innerHTML += `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 1rem; border: 1px solid var(--border); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="background: var(--primary); color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 800; font-size: 1.25rem;">
                        ${p.code_letter || '?'}
                    </div>
                    <span style="font-weight: 600; font-size: 1.1rem;">${displayName}</span>
                </div>
                
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="number" id="mark-${p.id}" placeholder="Score" style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                    <button class="btn btn-primary" onclick="submitMark('${p.id}', '${p.participant_id}')">
                        Save
                    </button>
                </div>
            </div>
        `;
    });
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// Add simple keyframe animation for the loading spinner dynamically
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

// Boot up
initializeApp();