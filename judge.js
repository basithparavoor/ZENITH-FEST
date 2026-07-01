const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentCompId = null;
let currentMaxMark = 0;
let user = null; // Declare user globally so other functions can use it

// 1. Wrap your startup logic in an async function
async function initializeApp() {
    
    // IF YOU ARE USING LOCAL STORAGE (Like your original code):
    user = JSON.parse(localStorage.getItem('festUser'));
    
    // OR, IF YOU SWITCHED TO SUPABASE AUTH (Which is likely what caused the line 6 error):
    // const { data } = await supabaseClient.auth.getUser();
    // user = data.user;

    // Security Check
    if (!user || user.role !== 'judge') {
        window.location.href = 'index.html';
        return; // Stop running code if they aren't a judge
    }

    // Update UI
    document.getElementById('judge-name').innerText = `Welcome, ${user.username || user.email}`;

    // Now that auth is verified, load the dashboard!
    loadDashboard(); 
}

// 2. Call the function to boot up the app
initializeApp();
// 2. Load Assigned Ongoing Competitions
async function loadDashboard() { 
    const { data } = await supabaseClient.from('judgements')... // Works!
}
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading assignments...</p>`;

    const { data: assignments, error } = await supabase
        .from('judgements')
        .select('competition_id, competitions(id, name, max_mark, status)')
        .eq('judge_id', user.id)
        .is('awarded_mark', null); 

    if (error) {
        console.error(error);
        container.innerHTML = `<p style="color: #EF4444;">Failed to load competitions. Please refresh.</p>`;
        return;
    }

    container.innerHTML = '';

    const ongoingComps = assignments
        .map(a => a.competitions)
        .filter(c => c.status === 'ongoing');

    if (ongoingComps.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--surface); border-radius: var(--radius); border: 1px dashed var(--border);">
                <p style="color: var(--text-muted); font-size: 1.1rem;">You have no pending evaluations for ongoing competitions.</p>
            </div>`;
        return;
    }

    const uniqueComps = Array.from(new Set(ongoingComps.map(c => c.id)))
        .map(id => ongoingComps.find(c => c.id === id));

    uniqueComps.forEach(comp => {
        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.innerHTML = `
            <div class="comp-card-inner" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 600;">${comp.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">
                        <span style="display: inline-block; width: 8px; height: 8px; background: var(--success); border-radius: 50%; margin-right: 6px;"></span>
                        Max Mark: <strong>${comp.max_mark}</strong>
                    </p>
                </div>
                <button class="btn btn-primary" onclick="openEvaluation('${comp.id}', '${comp.name}', ${comp.max_mark})">
                    Evaluate Now
                </button>
            </div>
        `;
        container.appendChild(card);
    });
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

    const { data: registrations } = await supabase
        .from('competition_registrations')
        .select('participant_id, code_letter')
        .eq('competition_id', compId)
        .eq('is_present', true)
        .order('code_letter', { ascending: true });

    container.innerHTML = '';

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
            row.style.borderColor = '#EF4444'; // Highlight missing input in red
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

    const { error } = await supabase
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

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// Add simple keyframe animation for the loading spinner dynamically
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

// Boot up
loadDashboard();