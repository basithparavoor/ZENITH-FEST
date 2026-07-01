const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || user.role !== 'fest_manager') {
    window.location.href = 'index.html';
}

let availableJudges = [];

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

// --- JUDGE ASSIGNMENTS ---
async function loadAssignments() {
    // 1. Fetch users who are judges
    if (availableJudges.length === 0) {
        const { data: judges } = await supabase.from('users').select('id, username').eq('role', 'judge');
        availableJudges = judges || [];
    }

    // 2. Fetch competitions that haven't been completed yet
    const { data: comps } = await supabase
        .from('competitions')
        .select('*, categories(name)')
        .in('status', ['pending', 'registration', 'ongoing'])
        .order('name');

    // 3. Fetch existing assignments
    const { data: assignments } = await supabase
        .from('judgements')
        .select('competition_id, judge_id, users(username)')
        .is('awarded_mark', null); // Fetch placeholders

    const grid = document.getElementById('comps-grid');
    grid.innerHTML = '';

    comps.forEach(comp => {
        // Find judges already assigned to this comp
        const compAssignments = assignments.filter(a => a.competition_id === comp.id);
        const assignedJudgeNames = compAssignments.map(a => a.users.username).join(', ') || 'None';
        
        let judgeOptions = availableJudges.map(j => `<option value="${j.id}">${j.username}</option>`).join('');

        grid.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge" style="background: #EEF2FF; color: var(--primary);">${comp.status}</span>
                </div>
                <p style="font-size: 0.875rem; color: #6B7280; margin-bottom: 1rem;">Category: ${comp.categories?.name}</p>
                <p style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Assigned: <span style="color:var(--primary)">${assignedJudgeNames}</span></p>
                
                <div class="form-group">
                    <select id="judge-select-${comp.id}">
                        <option value="">-- Add a Judge --</option>
                        ${judgeOptions}
                    </select>
                    <button class="btn btn-outline" style="width: 100%;" onclick="assignJudge('${comp.id}')">Assign Judge</button>
                </div>
            </div>
        `;
    });
}

async function assignJudge(compId) {
    const judgeId = document.getElementById(`judge-select-${compId}`).value;
    if (!judgeId) return alert('Please select a judge first.');

    // Insert a placeholder judgement row to link the judge and competition
    const { error } = await supabase.from('judgements').insert([{
        competition_id: compId,
        judge_id: judgeId
        // participant_id and awarded_mark are left null intentionally
    }]);

    if (error) {
        alert("Error assigning judge: " + error.message);
    } else {
        alert("Judge assigned successfully!");
        loadAssignments(); // Refresh UI
    }
}

// --- PUBLISH RESULTS ---
async function loadPublishableComps() {
    // Fetch competitions where the stage controller has marked them as complete
    const { data: comps } = await supabase
        .from('competitions')
        .select('*, categories(name)')
        .eq('status', 'judgement_complete');

    const grid = document.getElementById('publish-grid');
    grid.innerHTML = '';

    if (!comps || comps.length === 0) {
        grid.innerHTML = `<p style="color: #6B7280;">No completed competitions waiting for publication.</p>`;
        return;
    }

    comps.forEach(comp => {
        grid.innerHTML += `
            <div class="card" style="border-color: var(--success);">
                <div class="card-header">
                    <div class="card-title">${comp.name}</div>
                    <span class="badge" style="background: #D1FAE5; color: #065F46;">Ready</span>
                </div>
                <p style="font-size: 0.875rem; color: #6B7280; margin-bottom: 1.5rem;">Category: ${comp.categories?.name}</p>
                
                <button class="btn btn-success" style="width: 100%;" onclick="publishCompetition('${comp.id}')">
                    📣 Publish Live Results
                </button>
            </div>
        `;
    });
}

async function publishCompetition(compId) {
    if(!confirm("Are you sure? This will push the final standings for this competition to the public Live Portal immediately.")) return;

    const { error } = await supabase
        .from('competitions')
        .update({ status: 'published' })
        .eq('id', compId);

    if (error) {
        alert("Failed to publish: " + error.message);
    } else {
        alert("Results published successfully!");
        loadPublishableComps(); // Refresh UI
    }
}

// Boot up
loadAssignments();