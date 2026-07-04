const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentCompId = null;
let currentMaxMark = 0;
let user = null; 
let globalJudgeComps = []; // NEW: Caches the fetched competitions for filtering

// 1. Initialize App and Auth
async function initializeApp() {
    user = JSON.parse(localStorage.getItem('festUser'));

    // Security Check
    if (!user || (user.role !== 'judge' && user.role !== 'master_admin')) {
        window.location.href = 'index.html';
        return; 
    }

    // Update UI
    let roleDisplay = user.role === 'master_admin' ? '(Master Override)' : '';
    document.getElementById('judge-name').innerText = `Welcome, ${user.username || user.email} ${roleDisplay}`;

    if (user.role === 'master_admin') {
        const nav = document.querySelector('.navbar > div:last-child');
        nav.insertAdjacentHTML('afterbegin', `<button class="btn btn-primary" onclick="window.location.href='admin.html'">Admin Hub</button>`);
    }

    loadDashboard(); 
}

// 2. Load Assigned Competitions (Updated Logic for Search/Filter)
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading assignments...</p>`;

    const compStatusMap = new Map();
    globalJudgeComps = []; // Reset global state

    if (user.role === 'master_admin') {
        const { data: allComps, error } = await supabaseClient
            .from('competitions')
            .select('*, categories(name)')
            .in('status', ['registration', 'ongoing']);
            
        if (error) return container.innerHTML = `<p style="color: #EF4444;">Failed to load competitions.</p>`;
        
        allComps.forEach(comp => {
            compStatusMap.set(comp.id, { comp: comp, hasGraded: false });
        });
    } else {
        const { data: allJudgeRecords, error } = await supabaseClient
            .from('judgements')
            .select('competition_id, awarded_mark, competitions(id, name, max_mark, status, categories(name))')
            .eq('judge_id', user.id); 

        if (error) return container.innerHTML = `<p style="color: #EF4444;">Failed to load competitions.</p>`;
        
        allJudgeRecords.forEach(row => {
            if (!row.competitions) return; 
            const cId = row.competition_id;
            
            if (!compStatusMap.has(cId)) {
                compStatusMap.set(cId, { comp: row.competitions, hasGraded: false });
            }
            if (row.awarded_mark !== null) {
                compStatusMap.get(cId).hasGraded = true;
            }
        });
    }

    // Filter out graded/completed comps and push to global array
    compStatusMap.forEach(({ comp, hasGraded }) => {
        if (!hasGraded && comp.status !== 'judgement_complete' && comp.status !== 'published') {
            globalJudgeComps.push(comp);
        }
    });

    // Populate Category Dropdown Dynamically
    const catFilter = document.getElementById('judgeCategoryFilter');
    if (catFilter) {
        const uniqueCategories = [...new Set(globalJudgeComps.map(c => c.categories?.name || 'UNCATEGORIZED'))];
        catFilter.innerHTML = '<option value="">ALL CATEGORIES</option>';
        uniqueCategories.forEach(cat => {
            catFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }

    // Run initial filter (renders everything initially)
    filterJudgeCompetitions();
}

// 2.1 Search and Filter Logic
function filterJudgeCompetitions() {
    const searchVal = document.getElementById('judgeSearch') ? document.getElementById('judgeSearch').value.toLowerCase() : '';
    const catVal = document.getElementById('judgeCategoryFilter') ? document.getElementById('judgeCategoryFilter').value : '';

    const filtered = globalJudgeComps.filter(comp => {
        const matchSearch = comp.name.toLowerCase().includes(searchVal);
        const compCategory = comp.categories?.name || 'UNCATEGORIZED';
        const matchCat = catVal === "" || compCategory === catVal;
        
        return matchSearch && matchCat;
    });

    renderDashboard(filtered);
}

// 2.2 UI Rendering Engine
function renderDashboard(data) {
    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--surface); border-radius: var(--radius-md); border: 1px dashed var(--border);">
                <p style="color: var(--text-muted); font-size: 1.1rem;">No matching assignments found.</p>
            </div>`;
        return;
    }

    data.forEach(comp => {
        const isOngoing = comp.status === 'ongoing';
        const badgeColor = isOngoing ? 'var(--success)' : '#D97706';
        const statusText = isOngoing ? 'Ready to Evaluate' : 'Starts Soon';
        const btnState = isOngoing ? '' : 'disabled';
        const btnText = isOngoing ? 'Evaluate Now' : 'Waiting to start...';
        const categoryName = comp.categories?.name || 'UNCATEGORIZED';
        
        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.innerHTML = `
            <div class="comp-card-inner" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 0.25rem;">${categoryName}</div>
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
}
async function openEvaluation(compId, compName, maxMark) {
    currentCompId = compId;
    currentMaxMark = maxMark;

    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('evaluation-view').style.display = 'block';
    document.getElementById('eval-comp-name').innerText = compName;
    document.getElementById('eval-max-mark').innerText = maxMark;

    const container = document.getElementById('participants-container');
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading participants...</p>`;

    // NEW: Updated query to grab is_leader, group_id, and check the competition's is_group status
    const { data: registrations, error } = await supabaseClient
        .from('participant_competitions')
        .select('participant_id, code_letter, is_leader, group_id, competitions(is_group)')
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
        // NEW: Check if it is a group comp and show the role badge
        const isGroupEvent = reg.competitions?.is_group;
        let roleBadge = '';
        if (isGroupEvent) {
            roleBadge = reg.is_leader 
                ? `<span style="background: var(--primary-light); color: var(--primary); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">Leader</span>`
                : `<span style="background: #E2E8F0; color: #475569; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase;">Party</span>`;
        }

        container.innerHTML += `
            <div class="participant-row" data-pid="${reg.participant_id}">
                <div class="participant-info">
                    <div class="code-letter" style="background: var(--primary); color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: 800; font-size: 1.25rem;">
                        ${reg.code_letter || '?'}
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500; margin-left: 10px;">Participant Code</span>
                        <span style="margin-left: 10px; margin-top: 4px;">${roleBadge}</span>
                    </div>
                </div>
                <div class="mark-wrapper" style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="number" 
                           class="mark-input" 
                           placeholder="0" 
                           min="0" 
                           max="${maxMark}" 
                           step="0.5" 
                           style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;"
                           oninput="validateMark(this, ${maxMark})">
                    <span class="max-mark-label" style="font-weight: 600; color: var(--text-muted);">/ ${maxMark}</span>
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