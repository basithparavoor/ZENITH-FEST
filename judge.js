const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Auth Check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || user.role !== 'judge') {
    window.location.href = 'index.html';
}
document.getElementById('judge-name').innerText = `Logged in as: ${user.username}`;

let currentCompId = null;
let currentMaxMark = 0;

// 2. Load Assigned Ongoing Competitions
async function loadDashboard() {
    // Assuming a `competition_judges` junction table or assigned directly via judgements table placeholder
    // For this query, we fetch competitions where this judge has an assignment and status is 'ongoing'
    
    // NOTE: This assumes Admin/Manager created a placeholder row in `judgements` with awarded_mark = NULL 
    // when assigning the judge, to establish the link.
    const { data: assignments, error } = await supabase
        .from('judgements')
        .select('competition_id, competitions(id, name, max_mark, status)')
        .eq('judge_id', user.id)
        .is('awarded_mark', null); // Only fetch un-submitted ones

    if (error) {
        console.error(error);
        return;
    }

    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    // Filter to show only 'ongoing' status
    const ongoingComps = assignments
        .map(a => a.competitions)
        .filter(c => c.status === 'ongoing');

    if (ongoingComps.length === 0) {
        container.innerHTML = `<p style="color: #6B7280;">No ongoing competitions require your evaluation right now.</p>`;
        return;
    }

    // Remove duplicates if any
    const uniqueComps = Array.from(new Set(ongoingComps.map(c => c.id)))
        .map(id => ongoingComps.find(c => c.id === id));

    uniqueComps.forEach(comp => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin-bottom: 0.25rem;">${comp.name}</h3>
                    <p style="color: #6B7280; font-size: 0.875rem;">Max Mark: ${comp.max_mark}</p>
                </div>
                <button class="btn btn-primary" style="width: auto;" onclick="openEvaluation('${comp.id}', '${comp.name}', ${comp.max_mark})">Evaluate</button>
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

    // Fetch registered and present participants for this competition
    const { data: registrations } = await supabase
        .from('competition_registrations')
        .select('participant_id, code_letter')
        .eq('competition_id', compId)
        .eq('is_present', true)
        .order('code_letter', { ascending: true });

    const container = document.getElementById('participants-container');
    container.innerHTML = '';

    registrations.forEach(reg => {
        container.innerHTML += `
            <div class="participant-row" data-pid="${reg.participant_id}">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="color: #6B7280; font-size: 0.875rem;">Participant</span>
                    <div class="code-letter">${reg.code_letter}</div>
                </div>
                <div>
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
    if (parseFloat(input.value) > max) {
        input.value = max;
    }
    if (parseFloat(input.value) < 0) {
        input.value = 0;
    }
}

// 5. Submit Judgement
async function submitJudgement() {
    const rows = document.querySelectorAll('.participant-row');
    const marksData = [];
    let isValid = true;

    rows.forEach(row => {
        const pId = row.getAttribute('data-pid');
        const markInput = row.querySelector('.mark-input').value;
        
        if (markInput === '') {
            isValid = false;
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
    btn.innerText = 'Submitting...';

    // Insert or update judgements
    // Upserting based on judge_id and participant_id to prevent duplicates
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
        loadDashboard(); // Refresh dashboard
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

// Boot up
loadDashboard();