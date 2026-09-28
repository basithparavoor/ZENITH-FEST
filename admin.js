const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || (user.role !== 'admin' && user.role !== 'master_admin')) {
    window.location.href = 'index.html';
}

// Global cached data for dropdowns
let categoriesList = [];
let stagesList = [];
let teamsList = [];
let participantsList = [];
let competitionsList = [];
let availableControllers = [];
let currentCropper = null; // Added for image cropping
let dashRegChart = null; 
let dashTeamChart = null;

// --- UI UTILITIES (PREMIUM UPGRADES) ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message); // Fallback

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:var(--success); font-size:1.25rem;"></i>' 
                                    : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger); font-size:1.25rem;"></i>';
    toast.innerHTML = `${icon} <span style="font-weight:500;">${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.animation = 'fadeOut 0.3s forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.innerHTML = btn.dataset.originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function toggleSubmenu(element) {
    const parent = element.parentElement;
    const submenu = parent.querySelector('.nav-sub');
    
    // Close all other main tabs and submenus
    document.querySelectorAll('.nav-main').forEach(nav => {
        if (nav !== element) nav.classList.remove('open');
    });
    document.querySelectorAll('.nav-sub').forEach(sub => {
        if (sub !== submenu) sub.classList.remove('open');
    });

    // Toggle the clicked one
    element.classList.toggle('open');
    if (element.classList.contains('open')) {
        submenu.classList.add('open');
    } else {
        submenu.classList.remove('open');
    }
}

function switchTab(tabId) {
    // 1. Remove active states from EVERYTHING
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.nav-main').forEach(nav => nav.classList.remove('active'));
    
    // 2. Show the target content section
    document.getElementById(tabId).classList.add('active');
    
    // 3. Find the clicked nav item and highlight it
    const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if(activeNav) {
        activeNav.classList.add('active');
        
        // If it's a sub-item, ALSO highlight its parent main tab
        if (activeNav.classList.contains('nav-item')) {
            const parentGroup = activeNav.closest('.nav-group');
            if (parentGroup) {
                const mainItem = parentGroup.querySelector('.nav-main');
                if(mainItem) mainItem.classList.add('active');
            }
        } else if (activeNav.classList.contains('nav-main')) {
            // If it's a standalone main tab (like Dashboard), close all submenus
            document.querySelectorAll('.nav-main').forEach(nav => nav.classList.remove('open'));
            document.querySelectorAll('.nav-sub').forEach(sub => sub.classList.remove('open'));
        }
        
        // Update header title
        const pageTitle = document.getElementById('page-title');
        if(pageTitle) pageTitle.innerText = activeNav.innerText.trim();
    }

    // Auto-close sidebar on mobile
    if(window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.querySelector('.mobile-overlay')?.classList.remove('open');
    }

    try {
        if (tabId === 'dashboard') loadAdminDashboard();
        else if (tabId === 'categories') loadCategories();
        else if (tabId === 'competitions') loadCompetitions();
        else if (tabId === 'participants') loadParticipants();
        else if (tabId === 'stages') loadStagesAndTeams();
        else if (tabId === 'teams') loadStagesAndTeams();
        else if (tabId === 'users') loadUsers();
        else if (tabId === 'judges') loadJudgesManagement();
        else if (tabId === 'assignments') initAssignWorkspace();
        else if (tabId === 'direct-valuation') initDirectValuation();
        else if (tabId === 'point-settings') loadPointSettings(); 
        else if (tabId === 'branding-settings') loadBrandingSettings();
        else if (tabId === 'participant-points') loadParticipantPoints();
        else if (tabId === 'admin-appeals') loadAdminAppeals(); 
        else if (tabId === 'display-control') loadDisplaySettings();
        else if (tabId === 'schedule-mgmt') loadSchedules();
    } catch (e) {
        showToast("Failed to fetch dashboard data.", "error");
    }
}


async function loadAdminDashboard() {
    try {
        const [
            { count: compCount },
            { count: partCount },
            { count: catCount },
            { count: teamCount },
            { count: enrolCount },
            { data: allCompsData },
            { data: schedData },
            { data: teamsData },
            { data: judgementsData },
            { data: participantsData }
        ] = await Promise.all([
            supabaseClient.from('competitions').select('*', { count: 'exact', head: true }),
            supabaseClient.from('participants').select('*', { count: 'exact', head: true }),
            supabaseClient.from('categories').select('*', { count: 'exact', head: true }),
            supabaseClient.from('teams').select('*', { count: 'exact', head: true }),
            supabaseClient.from('participant_competitions').select('*', { count: 'exact', head: true }),
            supabaseClient.from('competitions').select('id, name, status, award_type, is_group, max_mark, max_participants, categories(name), stages(name)'),
            supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle(),
            supabaseClient.from('teams').select('id, name'),
            supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark'),
            supabaseClient.from('participants').select('id, name, team_id'),
            loadPointSettings()
        ]);

        const allComps = allCompsData || [];
        const liveComps = allComps.filter(c => c.status === 'ongoing');
        const publishedComps = allComps.filter(c => c.status === 'published');
        
        document.getElementById('dash-program-count').innerText = compCount || 0;
        document.getElementById('dash-live-count').innerText = liveComps.length || 0;
        document.getElementById('dash-participant-count').innerText = partCount || 0;
        document.getElementById('dash-registered-count').innerText = enrolCount || 0;
        document.getElementById('dash-category-count').innerText = catCount || 0;
        document.getElementById('dash-team-count').innerText = teamCount || 0;
        
        const publishRatio = `${publishedComps.length}/${compCount || 0}`;
        const publishPercent = compCount ? Math.round((publishedComps.length / compCount) * 100) : 0;
        
        document.getElementById('dash-results-ratio').innerText = publishRatio;
        document.getElementById('dash-results-percent').innerText = publishPercent;
        
        document.getElementById('pb-prog-val').innerText = `${enrolCount || 0}/${compCount || 0}`;
        document.getElementById('pb-prog-fill').style.width = compCount ? `${Math.min(100, (enrolCount / compCount) * 100)}%` : '0%';
        
        const completedComps = allComps.filter(c => c.status === 'judgement_complete' || c.status === 'published').length;
        document.getElementById('pb-gen-val').innerText = `${completedComps}/${compCount || 0}`;
        document.getElementById('pb-gen-fill').style.width = compCount ? `${Math.round((completedComps / compCount) * 100)}%` : '0%';
        
        document.getElementById('pb-pub-val').innerText = `${publishedComps.length}/${compCount || 0}`;
        document.getElementById('pb-pub-val-top').innerText = publishedComps.length;
        document.getElementById('pb-pub-fill').style.width = `${publishPercent}%`;

        // Calculate today's schedule
        const masterSchedule = schedData?.value || {};
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        Object.values(masterSchedule).forEach(s => { if(s.date === todayStr) todayCount++; });
        document.getElementById('dash-program-count-today').innerText = todayCount;

        const stageListEl = document.getElementById('dash-live-stage-list');
        document.getElementById('dash-live-stage-count').innerText = liveComps.length;
        document.getElementById('dash-live-stage-count-2').innerText = liveComps.length;
        
        if (liveComps.length > 0) {
            stageListEl.innerHTML = liveComps.map(c => `
                <div class="live-stage-item">
                    <div>
                        <h4>${c.name}</h4>
                        <p><i class="fa-solid fa-microphone-stage" style="color:var(--text-muted);"></i> ${c.stages?.name || 'TBD'} &nbsp;|&nbsp; <i class="fa-solid fa-folder" style="color:var(--text-muted);"></i> ${c.categories?.name || 'Gen'}</p>
                    </div>
                    <span class="live-badge-sm">Live</span>
                </div>
            `).join('');
        } else {
            stageListEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">No events running currently.</p>`;
        }

        const teams = teamsData || [];
        const judgements = judgementsData || [];
        const participants = participantsData || [];
        
        const pMap = {};
        (participants || []).forEach(p => pMap[p.id] = p);
        
        let compAverages = {}; 
        (judgements || []).forEach(j => {
           if(!compAverages[j.competition_id]) compAverages[j.competition_id] = {};
           if(!compAverages[j.competition_id][j.participant_id]) compAverages[j.competition_id][j.participant_id] = { marks_array: [] };
           compAverages[j.competition_id][j.participant_id].marks_array.push(parseFloat(j.awarded_mark));
        });

        let teamScores = {};
        let partScores = {};
        (teams || []).forEach(t => teamScores[t.id] = { name: t.name, score: 0 });
        (participants || []).forEach(p => partScores[p.id] = { name: p.name, score: 0, star: 0, pen: 0 });

        allComps.forEach(comp => {
            if(!compAverages[comp.id]) return;
            const participantsArr = Object.entries(compAverages[comp.id]).map(([pId, data]) => {
                let sortedMarks = data.marks_array.sort((a, b) => a - b);
                if (sortedMarks.length >= 3) sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
                const sum = sortedMarks.reduce((a, b) => a + b, 0);
                return { id: pId, mark: sum / sortedMarks.length };
            }).sort((a, b) => b.mark - a.mark);

            // CRITICAL FIX: Dynamically determine the size category just like the Points Ledger
            const limit = comp.max_participants || 1;
            const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            let currentRank = 1;
            let previousScore = -1;

            participantsArr.forEach((p, index) => {
                if (p.mark !== previousScore) currentRank = index + 1;
                previousScore = p.mark;

                // CRITICAL FIX: Calculate percent based on the competition's specific max_mark
                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let gradePts = 0; let posPts = 0;

                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].aplus) || 0;
                    else if (percent >= pointsAdminSettings.thresholds.a) gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].a) || 0;
                    else if (percent >= pointsAdminSettings.thresholds.b) gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].b) || 0;
                    else gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].c) || 0;
                }
                
                if (currentRank <= 3) {
                    if (currentRank === 1) posPts = Number(pointsAdminSettings.pos_points.p1) || 0;
                    else if (currentRank === 2) posPts = Number(pointsAdminSettings.pos_points.p2) || 0;
                    else if (currentRank === 3) posPts = Number(pointsAdminSettings.pos_points.p3) || 0;
                }
                
                const totalPts = gradePts + posPts;
                const tId = pMap[p.id] ? pMap[p.id].team_id : null;
                
                // Teams ALWAYS get points for both individual and group events
                if (tId && teamScores[tId]) teamScores[tId].score += totalPts;
                
                // CRITICAL FIX: Ignore group events when calculating individual scores
                if (!comp.is_group) {
                    if (partScores[p.id]) {
                        partScores[p.id].score += totalPts;
                        if (comp.award_type === 'star') partScores[p.id].star += totalPts;
                        if (comp.award_type === 'pen') partScores[p.id].pen += totalPts;
                    }
                }
            });
        });

        const sortedTeams = Object.values(teamScores).sort((a, b) => b.score - a.score);

        if (sortedTeams.length > 0) {
            document.getElementById('dash-top-team-name').innerText = sortedTeams[0].name;
            document.getElementById('dash-top-team-pts').innerText = `${sortedTeams[0].score}`;
        }

        window.globalDashCandidates = Object.values(partScores);
        
        if (typeof window.switchDashTopView === 'function') {
            window.switchDashTopView('all');
        }

        renderDashCharts(sortedTeams);
    } catch (error) { console.error("Dashboard Load Error:", error); }
}

// TOGGLE LOGIC FOR DASHBOARD TOP CANDIDATES
window.switchDashTopView = function(type) {
    // 1. Reset all buttons
    document.getElementById('btn-dash-top-all').className = 'btn btn-outline';
    document.getElementById('btn-dash-top-star').className = 'btn btn-outline';
    document.getElementById('btn-dash-top-pen').className = 'btn btn-outline';
    
    document.getElementById('btn-dash-top-star').style.background = 'transparent';
    document.getElementById('btn-dash-top-star').style.color = '#D97706';
    document.getElementById('btn-dash-top-pen').style.background = 'transparent';
    document.getElementById('btn-dash-top-pen').style.color = '#4338CA';

    let sortKey = 'score';
    let ptsColor = 'var(--primary)';
    
    // 2. Apply active styling and set parameters
    if (type === 'all') {
        document.getElementById('btn-dash-top-all').className = 'btn btn-primary';
        document.getElementById('dash-top-pts-label').innerText = 'TOTAL POINTS';
    } else if (type === 'star') {
        const btn = document.getElementById('btn-dash-top-star');
        btn.className = 'btn'; btn.style.background = '#D97706'; btn.style.color = 'white';
        sortKey = 'star';
        ptsColor = '#D97706';
        document.getElementById('dash-top-pts-label').innerText = 'STAR POINTS';
    } else if (type === 'pen') {
        const btn = document.getElementById('btn-dash-top-pen');
        btn.className = 'btn'; btn.style.background = '#4338CA'; btn.style.color = 'white';
        sortKey = 'pen';
        ptsColor = '#4338CA';
        document.getElementById('dash-top-pts-label').innerText = 'PEN POINTS';
    }

    if (!window.globalDashCandidates) return;
    
    // 3. Filter (greater than 0), Sort, and grab top 5
    let sortedParts = window.globalDashCandidates
        .filter(c => c[sortKey] > 0)
        .sort((a, b) => b[sortKey] - a[sortKey])
        .slice(0, 5);

    const candListEl = document.getElementById('dash-top-candidates');
    if (sortedParts.length > 0) {
        candListEl.innerHTML = sortedParts.map((c, i) => {
            let rClass = i===0 ? 'r1' : i===1 ? 'r2' : i===2 ? 'r3' : 'other';
            return `
            <div class="top-cand-row">
                <div style="display: flex; align-items: center;">
                    <div class="cand-rank ${rClass}">${i+1}</div>
                    <span style="font-weight: 600; font-size: 0.9rem; text-transform: uppercase;">${c.name}</span>
                </div>
                <span style="font-weight: 800; color: ${ptsColor}; font-size: 1.05rem;">${c[sortKey]}</span>
            </div>
        `}).join('');
    } else {
        const typeName = type === 'all' ? 'total' : type;
        candListEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem 1rem;">No ${typeName} points awarded yet.</p>`;
    }
};

function renderDashCharts(sortedTeams) {
    if (dashRegChart) dashRegChart.destroy();
    if (dashTeamChart) dashTeamChart.destroy();

    // Line Chart
    const ctxLine = document.getElementById('regDynamicChart').getContext('2d');
    dashRegChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                { label: 'Registrations', data: [120, 150, 180, 90, 30, 10, 5], borderColor: '#EF4444', backgroundColor: 'transparent', fill: false, tension: 0.4 },
                { label: 'Results', data: [0, 0, 10, 40, 100, 150, 200], borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Bar chart for Team Points
    const ctxBar = document.getElementById('teamPointsChart').getContext('2d');
    const teamLabels = sortedTeams.slice(0, 8).map(t => t.name.toUpperCase());
    const teamData = sortedTeams.slice(0, 8).map(t => t.score);
    const barColors = ['#EF4444', '#FCD34D', '#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#14B8A6', '#F43F5E'];

    dashTeamChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: teamLabels,
            datasets: [{
                data: teamData,
                backgroundColor: barColors,
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                x: { grid: { display: false } }
            }
        }
    });
}


// Custom Logout Logic
function logout() { document.getElementById('logoutModal').classList.add('show'); }

function confirmLogout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// --- MODAL UTILS ---
function closeModal() { 
    const modal = document.getElementById('formModal');
    if(modal) modal.classList.remove('show'); 
}

function openModal(title, bodyHTML, saveFunction) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    
    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.onclick = saveFunction;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    saveBtn.disabled = false;
    
    document.getElementById('formModal').classList.add('show');
}


// Function to handle viewing counts in a popup
async function viewRelationalData(fetchTable, filterColumn, filterId, displayColumn = 'name') {
    document.getElementById('listModalTable').parentElement.style.cssText = "max-height: 300px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm);";
    try {
        // Fetch the related data based on the ID clicked
        const { data, error } = await supabaseClient
            .from(fetchTable)
            .select('*')
            .eq(filterColumn, filterId);
            
        if (error) throw error;
        
        const tbody = document.getElementById('listModalTable');
        tbody.innerHTML = `<tr><th>${displayColumn.toUpperCase()}</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td style="color: var(--text-muted);">No records found.</td></tr>`;
        } else {
            data.forEach(item => {
                // Safely grab the requested column (name, username, unique_id, etc.)
                const displayText = item[displayColumn] || item.username || item.unique_id || 'Unknown';
                tbody.innerHTML += `<tr><td>${displayText}</td></tr>`;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Viewing ${fetchTable}`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast("Error loading data: " + e.message, 'error'); 
    }
}



function openCategoryModal(editData = null) {
    const isEdit = !!editData;
    const catId = isEdit ? editData.id : '';
    const catName = isEdit ? editData.name : '';
    const isGeneral = isEdit ? editData.is_general.toString() : 'false';
    const allowedGenerals = isEdit && editData.allowed_general_categories ? editData.allowed_general_categories : [];
    
    // NEW: Capture the DOB period
    const catDobStart = isEdit && editData.dob_start ? editData.dob_start : '';
    const catDobEnd = isEdit && editData.dob_end ? editData.dob_end : ''; 

    let generalCats = categoriesList.filter(c => c.is_general && c.id !== catId);
    let generalOptsHtml = '';
    
    if (generalCats.length > 0) {
        generalOptsHtml = `
            <div class="form-group" id="general-eligibility-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border); ${isGeneral === 'true' ? 'display:none;' : 'display:block;'}">
                <label style="margin-bottom: 0.5rem; display: block; font-size: 0.85rem; font-weight: 700; color: var(--text-main);">Eligible General Categories</label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">Select which general categories students from this standard category are allowed to participate in.</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding-right: 0.5rem;">
                    ${generalCats.map(gc => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
                            <input type="checkbox" class="cat-general-eligibility" value="${gc.id}" ${allowedGenerals.includes(gc.id) ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary);">
                            ${gc.name}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    openModal(isEdit ? 'Edit Category' : 'Create Category', `
        <input type="hidden" id="catId" value="${catId}">
        <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="catName" value="${catName}" placeholder="E.G. SENIOR SECONDARY">
        </div>
        <div class="form-group">
            <label>Type</label>
            <select id="catGeneral" onchange="const el = document.getElementById('general-eligibility-section'); if(el) el.style.display = this.value === 'true' ? 'none' : 'block';">
                <option value="false" ${isGeneral === 'false' ? 'selected' : ''}>Standard (Limits apply)</option>
                <option value="true" ${isGeneral === 'true' ? 'selected' : ''}>General (Anyone can participate)</option>
            </select>
        </div>
        <div class="form-group" style="padding-top: 0.5rem;">
            <label>Allowed Date of Birth Period (Optional)</label>
            <div style="display: flex; gap: 1rem; align-items: center;">
                <input type="date" id="catDobStart" value="${catDobStart}" style="flex: 1; text-transform: none;">
                <span style="color: var(--text-muted); font-weight: 800;">TO</span>
                <input type="date" id="catDobEnd" value="${catDobEnd}" style="flex: 1; text-transform: none;">
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">If set, participants must be born between these dates to register.</p>
        </div>
        ${generalOptsHtml}
    `, saveCategory);
}

async function saveCategory() {
    const id = document.getElementById('catId').value;
    const name = document.getElementById('catName').value;
    const is_general = document.getElementById('catGeneral').value === 'true';
    const dob_start = document.getElementById('catDobStart').value || null;
    const dob_end = document.getElementById('catDobEnd').value || null;
    
    const allowed_general_categories = Array.from(document.querySelectorAll('.cat-general-eligibility:checked')).map(cb => cb.value);

    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
        const payload = { 
            name, 
            is_general, 
            dob_start,
            dob_end,
            allowed_general_categories: is_general ? [] : allowed_general_categories 
        };
        if (id) payload.id = id;

        const { error } = await supabaseClient.from('categories').upsert([payload]);
        if (error) throw error;
        
        showToast(id ? 'Category updated!' : 'Category created!');
        closeModal(); 
        loadCategories();
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}



// --- NEW: Missing Categories Filter Function ---
function filterCategoriesTable() {
    const searchVal = document.querySelector('#categories .search-box input').value.toLowerCase();
    const typeVal = document.querySelector('#categories .filter-box select').value;
    const rows = document.querySelectorAll('#categories-tbody tr');

    rows.forEach(row => {
        const name = row.cells[1].innerText.toLowerCase();
        const typeBadge = row.cells[2].innerText; // Extracts "General" or "Standard"

        const matchSearch = name.includes(searchVal);
        const matchType = typeVal === "" || typeBadge === typeVal;

        row.style.display = (matchSearch && matchType) ? '' : 'none';
    });
}
// --- COMPETITIONS MANAGEMENT (PAGINATED) ---
let compCurrentPage = 1;
let compRowsPerPage = 10;
let filteredCompetitionsList = []; 

async function loadCompetitions() {
    try {
        const prereqs = [];
        if (stagesList.length === 0) prereqs.push(supabaseClient.from('stages').select('*').then(r => { stagesList = r.data || []; }));
        if (categoriesList.length === 0) prereqs.push(loadCategories());
        if (teamsList.length === 0) prereqs.push(supabaseClient.from('teams').select('*').then(r => { teamsList = r.data || []; }));
        if (prereqs.length > 0) await Promise.all(prereqs);

        const { data, error } = await supabaseClient
            .from('competitions')
            .select(`*, categories(name), stages(name), participant_competitions(count)`)
            .order('name');
            
        if(error) throw error;
        
        competitionsList = data || [];
        
        const filterCat = document.getElementById('filterCompCategory');
        if(filterCat && filterCat.options.length === 1) {
            categoriesList.forEach(c => filterCat.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // Populate new Stage Filter
        const filterStage = document.getElementById('filterCompStage');
        if(filterStage && filterStage.options.length === 1) {
            stagesList.forEach(s => filterStage.innerHTML += `<option value="${s.name}">${s.name}</option>`);
        }

        filterCompetitions(false); 
    } catch(e) { showToast(e.message, 'error'); }
}

function filterCompetitions(resetPage = true) {
    const query = document.getElementById('searchCompInput').value.toLowerCase();
    const catFilter = document.getElementById('filterCompCategory').value;
    const stageFilter = document.getElementById('filterCompStage') ? document.getElementById('filterCompStage').value : "";
    
    filteredCompetitionsList = competitionsList.filter(comp => {
        const matchName = comp.name.toLowerCase().includes(query);
        const compCatName = comp.categories?.name || '';
        const matchCat = catFilter === "" || compCatName === catFilter;
        
        const compStageName = comp.stages?.name || '';
        const matchStage = stageFilter === "" || compStageName === stageFilter;
        
        return matchName && matchCat && matchStage;
    });
    
    if (resetPage) compCurrentPage = 1;
    renderCompetitionsTable();
}

function renderCompetitionsTable() {
    const tbody = document.getElementById('competitions-tbody');
    tbody.innerHTML = '';
    
    // Calculate page slices
    const start = (compCurrentPage - 1) * compRowsPerPage;
    const end = start + compRowsPerPage;
    const pageData = filteredCompetitionsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No competitions found.</td></tr>`;
    }

   pageData.forEach(comp => {
        const studentCount = comp.participant_competitions?.[0]?.count || 0; 
        const totalCapacity = (comp.max_participants || 0) * (teamsList.length || 0); 
        
        // NEW: Check if it's an offstage event
let stageDisplay = comp.stages?.name || 'Unassigned';
        if (comp.is_offstage) {
            stageDisplay += ` <br><span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:800; margin-top: 4px; display: inline-block; font-size: 0.65rem;"><i class="fa-solid fa-pen-nib"></i> OFFSTAGE</span>`;
        }    
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${comp.id}" ${globalSelections['competitions-tbody']?.has(comp.id) ? 'checked' : ''} onchange="handleRowSelection('competitions-tbody', this.value, this.checked)"></td>
                <td style="font-weight: 700;">${comp.name}</td>
                <td><span class="badge badge-primary">${comp.categories?.name || 'N/A'}</span></td>
                <td>${stageDisplay}</td>
                
                <td style="font-weight: 700; color: var(--text-main);">${comp.max_mark || '0'}</td>
                
                <td>
                    <span class="badge-count" onclick="viewCompParticipants('${comp.id}')" title="Click to view enrolled">
                        ${studentCount} / ${totalCapacity} Total
                    </span>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; font-weight: 600;">(${comp.max_participants} PER TEAM)</div>
                </td>
               <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openCompModal(${JSON.stringify(comp).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})' title="Edit"><i class="fa-solid fa-pen"></i></button>
                        
                        
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--primary); border-color:var(--primary);" onclick="viewCompetitionLog('${comp.id}')" title="View Master Log"><i class="fa-solid fa-file-invoice"></i></button>
                        
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="bulkDownloadCertificates('${comp.id}')" title="Download Merit Certificates"><i class="fa-solid fa-award"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteCompetition('${comp.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    renderCompPagination();
}

function renderCompPagination() {
    const totalPages = Math.ceil(filteredCompetitionsList.length / compRowsPerPage) || 1;
    const paginationContainer = document.getElementById('comp-pagination');
    
    const startNum = filteredCompetitionsList.length === 0 ? 0 : ((compCurrentPage - 1) * compRowsPerPage) + 1;
    const endNum = Math.min(compCurrentPage * compRowsPerPage, filteredCompetitionsList.length);

    // Ensure the Select All box is unchecked visually when pages change
    const masterCb = document.querySelector('#competitions-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredCompetitionsList.length} entries
            <select onchange="compRowsPerPage = parseInt(this.value); compCurrentPage = 1; renderCompetitionsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${compRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${compRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${compRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${compRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changeCompPage(-1)" ${compCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: flex; align-items: center; padding: 0 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--primary);">Page ${compCurrentPage} of ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changeCompPage(1)" ${compCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

function changeCompPage(direction) {
    const totalPages = Math.ceil(filteredCompetitionsList.length / compRowsPerPage);
    compCurrentPage += direction;
    if (compCurrentPage < 1) compCurrentPage = 1;
    if (compCurrentPage > totalPages) compCurrentPage = totalPages;
    renderCompetitionsTable();
}

// Generates a Premium PDF Directory for Competitions
// Generates a Premium PDF Directory for Competitions
async function exportCompetitionsPDF() {
    showToast('Generating Competitions PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Competitions Directory');

        // Map over the filtered list to respect any current search criteria
        let tableRows = filteredCompetitionsList.map((comp, index) => {
            // Extract the total enrolled participant count
            const studentCount = comp.participant_competitions?.[0]?.count || 0;
            
            return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${comp.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.categories?.name || 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.stages?.name || 'Unassigned'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${comp.max_mark || '0'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${studentCount}</td>
            </tr>
            `;
        }).join('');

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">COMPETITION</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">STAGE</th>
                        <th style="padding: 10px;">MAX MARKS</th>
                        <th style="padding: 10px;">ENROLLED</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: `Fest_Competitions.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}

// Special function to view participants linked to a competition (Many-to-Many)

async function viewCompParticipants(compId) {
    try {
        // Fetch competition details to know if it's a group event
        const { data: comp } = await supabaseClient.from('competitions').select('is_group').eq('id', compId).single();

        // Fetch participants along with their team details and leader status
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select('is_leader, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);
            
        if (error) throw error;
        
        // Reset container styling for tabular modal display
        const container = document.getElementById('listModalTable').parentElement;
        container.style.cssText = "max-height: 350px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm); border-radius: var(--radius-md);";

        const tbody = document.getElementById('listModalTable');
        tbody.innerHTML = `<tr><th style="padding: 1rem;">PARTICIPANT NAME</th><th style="padding: 1rem;">TEAM</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td colspan="2" style="color:var(--text-muted); text-align:center; padding: 2rem;">No students assigned.</td></tr>`;
        } else {
            data.forEach(item => {
                const p = item.participants;
                const teamName = p?.teams?.name || 'INDEPENDENT';
                
                let roleBadge = '';
                if (comp && comp.is_group) {
                    roleBadge = item.is_leader 
                        ? `<br><span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; margin-top: 6px;">GROUP LEADER</span>` 
                        : `<br><span class="badge" style="background: var(--bg-main); color: var(--text-muted); font-size: 0.65rem; margin-top: 6px;">MEMBER</span>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td style="padding: 1rem;">
                            <strong style="font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.2rem;">${p?.name}</strong>
                            <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${p?.unique_id}</span>
                            ${roleBadge}
                        </td>
                        <td style="padding: 1rem; vertical-align: top;">
                            <span class="badge" style="background: var(--bg-main); color: var(--primary); font-weight: 700; border: 1px solid var(--border);">${teamName}</span>
                        </td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Enrolled Students`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast(e.message, 'error'); 
    }
}

function openCompModal(editData = null) {
    const isEdit = !!editData;
    const cId = isEdit ? editData.id : '';
    const cName = isEdit ? editData.name : '';
    const cMarks = isEdit ? editData.max_mark : '100';
    const cLimit = isEdit ? editData.max_participants : '1';
    const cIsGroup = isEdit ? editData.is_group : false; 
    const cTime = isEdit ? editData.time_per_student || 0 : 0;
    const cIsOffstage = isEdit ? editData.is_offstage : false; // NEW: Offstage Flag

    let catOpts = categoriesList.map(c => `<option value="${c.id}" ${isEdit && editData.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    let stageOpts = stagesList.map(s => `<option value="${s.id}" ${isEdit && editData.stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    const cAwardType = isEdit ? editData.award_type || 'none' : 'none';

    openModal(isEdit ? 'Edit Competition' : 'New Competition', `
        <input type="hidden" id="compId" value="${cId}">
        <div class="form-group"><label>Competition Name</label><input type="text" id="compName" value="${cName}"></div>
        
        <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem;">
            <div class="form-group" style="flex: 1; display: flex; align-items: center; gap: 0.5rem; background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); margin: 0;">
                <input type="checkbox" id="compIsGroup" ${cIsGroup ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--primary); cursor: pointer;">
                <label for="compIsGroup" style="margin: 0; color: var(--primary); font-weight: 700; cursor: pointer;">Group Event</label>
            </div>
            <div class="form-group" style="flex: 1; display: flex; align-items: center; gap: 0.5rem; background: #FEF3C7; padding: 1rem; border-radius: var(--radius-md); margin: 0;">
                <input type="checkbox" id="compIsOffstage" ${cIsOffstage ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #D97706; cursor: pointer;">
                <label for="compIsOffstage" style="margin: 0; color: #D97706; font-weight: 700; cursor: pointer;">Offstage Event</label>
            </div>
        </div>

        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Category</label><select id="compCategory">${catOpts}</select></div>
            <div class="form-group" style="flex:1;"><label>Stage</label><select id="compStage"><option value="">-- NO STAGE YET --</option>${stageOpts}</select></div>
        </div>
        <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1;"><label>Max Marks</label><input type="number" id="compMarks" value="${cMarks}"></div>
            <div class="form-group" style="flex:1;"><label>Participants / Team</label><input type="number" id="compParticipants" value="${cLimit}"></div>
            <div class="form-group" style="flex:1;"><label>Mins / Student</label><input type="number" id="compTimePerStudent" value="${cTime}"></div>
        </div>
        
        <!-- NEW AWARD CATEGORY SELECTOR -->
        <div class="form-group" style="margin-top: 0.5rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
            <label><i class="fa-solid fa-trophy" style="color:var(--primary);"></i> Special Award Eligibility</label>
            <select id="compAwardType" style="border-color: var(--primary);">
                <option value="none" ${cAwardType === 'none' ? 'selected' : ''}>Standard Event (No Special Award)</option>
                <option value="star" ${cAwardType === 'star' ? 'selected' : ''}>⭐ Star of the Fest Event</option>
                <option value="pen" ${cAwardType === 'pen' ? 'selected' : ''}>🖋️ Pen of the Fest Event</option>
            </select>
        </div>
    `, saveCompetition);
}

async function saveCompetition() {
    const id = document.getElementById('compId').value;
    const name = document.getElementById('compName').value;
    const category_id = document.getElementById('compCategory').value;
    const is_offstage = document.getElementById('compIsOffstage').checked; // NEW
const stage_id = document.getElementById('compStage').value || null;    const max_mark = document.getElementById('compMarks').value;
    const max_participants = document.getElementById('compParticipants').value;
    const is_group = document.getElementById('compIsGroup').checked; 
    const award_type = document.getElementById('compAwardType').value; 
    const time_per_student = parseInt(document.getElementById('compTimePerStudent').value) || 0;
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    try {
const payload = { name, category_id, stage_id, max_mark, max_participants, is_group, is_offstage, award_type, time_per_student };
        if (id) payload.id = id;

        const { error } = await supabaseClient.from('competitions').upsert([payload]);
        if (error) throw error;
        
        showToast(id ? 'Competition updated!' : 'Competition created!');
        closeModal(); 
        loadCompetitions();
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}



// --- STAGES & TEAMS MANAGEMENT ---
// --- NEW FRONTEND CONFIRMATION LOGIC ---
function openConfirmModal(title, text, confirmCallback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    
    // Assign the execution function to the button
    confirmBtn.onclick = () => {
        document.getElementById('confirmModal').classList.remove('show');
        if (confirmCallback) confirmCallback();
    };
    
    document.getElementById('confirmModal').classList.add('show');
}

// --- STAGES & TEAMS MANAGEMENT ---
async function loadStagesAndTeams() {
    try {
        const [stagesRes, teamsRes] = await Promise.all([
            supabaseClient.from('stages').select(`*, users(username), competitions(count)`).order('stage_no'),
            supabaseClient.from('teams').select('*, participants(count), users(username, password_hash)').order('name')
        ]);
        
        if (stagesRes.error) throw stagesRes.error;
        if (teamsRes.error) throw teamsRes.error;
        
        stagesList = stagesRes.data || [];
        teamsList = teamsRes.data || [];
        
        const stbody = document.getElementById('stages-tbody');
        stbody.innerHTML = '';
        
        stagesList.forEach(s => {
            const compCount = s.competitions[0]?.count || 0;
            stbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${s.name}</strong><br>
                        <small style="color:var(--text-muted)">CONTROLLER: ${s.users?.username || 'NONE'}</small>
                    </td>
                    <td>STAGE ${s.stage_no}</td>
                    <td><span class="badge-count" onclick="viewRelationalData('competitions', 'stage_id', '${s.id}')">${compCount} COMPS</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openStageModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' title="Edit Stage"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteStage('${s.id}', '${s.name.replace(/'/g, "\\'")}')" title="Delete Stage"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        const ttbody = document.getElementById('teams-tbody');
        ttbody.innerHTML = '';
        
        teamsList.forEach(t => {
            const memberCount = t.participants[0]?.count || 0;
            
            // Check if there is a team manager account linked to this team
            const mgrAccount = t.users && t.users.length > 0 ? t.users[0] : null;
            const accountInfo = mgrAccount 
                ? `<br><span style="display:inline-block; margin-top:6px; padding: 4px 8px; background: var(--primary-light); border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: var(--primary);">PORTAL: ${mgrAccount.username} / ${mgrAccount.password_hash}</span>` 
                : '';

            ttbody.innerHTML += `
                <tr>
                    <td>
                        <strong style="font-size:1.05rem;">${t.name}</strong><br>
                        <small style="color:var(--text-muted)">MGR: ${t.manager_name || 'N/A'} | ASST: ${t.assistant_manager_name || 'N/A'}</small>
                        ${accountInfo}
                    </td>
                    <td><span class="badge-count" onclick="viewRelationalData('participants', 'team_id', '${t.id}')">${memberCount} MEMBERS</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openTeamModal(${JSON.stringify(t).replace(/'/g, "&apos;")})' title="Edit Team"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteTeam('${t.id}', '${t.name.replace(/'/g, "\\'")}')" title="Delete Team"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch(e) { showToast(e.message, 'error'); }
}

// Updated Deletion Methods utilizing the custom frontend modal
function deleteStage(id, name) { 
    openConfirmModal(
        'Delete Stage?', 
        `Are you sure you want to delete "${name}"? This action cannot be undone.`, 
        async () => {
            try {
                const { error } = await supabaseClient.from('stages').delete().eq('id', id); 
                if (error) throw error;
                showToast('Stage deleted successfully.');
                loadStagesAndTeams(); 
            } catch(e) { 
                showToast(e.message, 'error'); 
            }
        }
    );
}

function deleteTeam(id, name) { 
    openConfirmModal(
        'Delete Team?', 
        `Are you sure you want to delete "${name}"? This action cannot be undone.`, 
        async () => {
            try {
                const { error } = await supabaseClient.from('teams').delete().eq('id', id); 
                if (error) throw error;
                showToast('Team deleted successfully.');
                loadStagesAndTeams(); 
            } catch(e) { 
                showToast(e.message, 'error'); 
            }
        }
    );
}

async function openStageModal(editData = null) {
    try {
        if (availableControllers.length === 0) {
            const { data } = await supabaseClient.from('users').select('*').eq('role', 'stage_controller');
            availableControllers = data || [];
        }
        
        const isEdit = !!editData;
        const sId = isEdit ? editData.id : '';
        const sName = isEdit ? editData.name : '';
        const sNo = isEdit ? editData.stage_no : '1';
        
        let controllerOpts = availableControllers.map(c => 
            `<option value="${c.id}" ${isEdit && editData.controller_id === c.id ? 'selected' : ''}>${c.username}</option>`
        ).join('');
        
        openModal(isEdit ? 'Edit Stage' : 'Add Stage', `
            <input type="hidden" id="stageId" value="${sId}">
            <div class="form-group"><label>Stage Name</label><input type="text" id="stageName" value="${sName}"></div>
            <div class="form-group"><label>Stage Number (ID)</label><input type="number" id="stageNo" value="${sNo}"></div>
            <div class="form-group"><label>Assign Controller</label><select id="stageController"><option value="">-- SELECT CONTROLLER --</option>${controllerOpts}</select></div>
        `, async () => {
            const id = document.getElementById('stageId').value;
            const name = document.getElementById('stageName').value;
            const stage_no = document.getElementById('stageNo').value;
            const controller_id = document.getElementById('stageController').value || null;
            
            if(!name || !stage_no) return showToast('Name and Number required', 'error');
            
            setLoading('modalSaveBtn', true);
            const payload = { name, stage_no, controller_id };
            if (id) payload.id = id;

            const { error } = await supabaseClient.from('stages').upsert([payload]);
            setLoading('modalSaveBtn', false);
            
            if(error) showToast(error.message, 'error'); 
            else { showToast(id ? 'Stage updated!' : 'Stage added!'); closeModal(); loadStagesAndTeams(); }
        });
    } catch(e) { showToast(e.message, 'error'); }
}

function openTeamModal(editData = null) {
    const isEdit = !!editData;
    const tId = isEdit ? editData.id : '';
    const tName = isEdit ? editData.name : '';
    const tMgr = isEdit && editData.manager_name ? editData.manager_name : '';
    const tAsst = isEdit && editData.assistant_manager_name ? editData.assistant_manager_name : '';

    openModal(isEdit ? 'Edit Team' : 'Add Team', `
        <input type="hidden" id="teamId" value="${tId}">
        <div class="form-group"><label>Team Name</label><input type="text" id="teamName" value="${tName}"></div>
        <div class="form-group"><label>Manager Name</label><input type="text" id="teamMgr" value="${tMgr}"></div>
        <div class="form-group"><label>Assistant Manager Name</label><input type="text" id="teamAsst" value="${tAsst}"></div>
    `, async () => {
        const id = document.getElementById('teamId').value;
        const name = document.getElementById('teamName').value;
        const manager_name = document.getElementById('teamMgr').value;
        const assistant_manager_name = document.getElementById('teamAsst').value;
        
        if(!name) return showToast('Team Name required', 'error');
        
        setLoading('modalSaveBtn', true);
        const payload = { name, manager_name, assistant_manager_name };
        if (id) payload.id = id;

        // Added .select() to retrieve the ID of the newly created team
        const { data: savedTeam, error } = await supabaseClient.from('teams').upsert([payload]).select();
        setLoading('modalSaveBtn', false);
        
        if(error) {
            showToast(error.message, 'error'); 
        } else { 
            // AUTO-CREATE MANAGER USER IF THIS IS A NEW TEAM
            if (!id && savedTeam && savedTeam.length > 0) {
                const teamId = savedTeam[0].id;
                // Generates a username like "falcons_mgr"
                const autoUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_mgr';
                
                await supabaseClient.from('users').insert([{
                    username: autoUsername,
                    password_hash: 'fest2026', // Default password
                    role: 'team_manager',
                    team_id: teamId // Make sure 'team_id' column exists in your users table!
                }]);
                showToast(`Team added & User created: ${autoUsername}`, 'success');
            } else {
                showToast('Team updated!', 'success'); 
            }
            
            closeModal(); 
            loadStagesAndTeams(); 
        }
    });
}

// --- PARTICIPANTS MANAGEMENT (PAGINATED) ---

// Global states for pagination
let partCurrentPage = 1;
let partRowsPerPage = 10;
let filteredParticipantsList = [];

async function loadParticipants() {
    try {
        const prereqs = [];
        if (categoriesList.length === 0) prereqs.push(loadCategories());
        if (teamsList.length === 0) prereqs.push(supabaseClient.from('teams').select('*').then(r => { teamsList = r.data || []; }));
        if (prereqs.length > 0) await Promise.all(prereqs);

        const { data, error } = await supabaseClient.from('participants').select(`*, categories(name), teams(name)`).order('name');
        if(error) throw error;
        
        participantsList = data || []; 
        filteredParticipantsList = [...participantsList];
        
        const catFilter = document.getElementById('filterCategory');
        if(catFilter && catFilter.options.length === 1) {
            categoriesList.forEach(c => catFilter.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // Populate new Team Filter
        const teamFilter = document.getElementById('filterPartTeam');
        if(teamFilter && teamFilter.options.length === 1) {
            teamsList.forEach(t => teamFilter.innerHTML += `<option value="${t.name}">${t.name}</option>`);
        }

        // --- ADD THIS LINE HERE ---
        initBulkTeamControls();
        // --------------------------

        partCurrentPage = 1;
        renderParticipantsTable();
    } catch(e) { showToast(e.message, 'error'); }
}
function filterParticipants(resetPage = true) {
    const query = document.getElementById('searchPartInput').value.toLowerCase();
    const catFilter = document.getElementById('filterCategory').value;
    
    const teamFilter = document.getElementById('filterPartTeam') ? document.getElementById('filterPartTeam').value : "";
const dobFilter = document.getElementById('filterPartDob') ? document.getElementById('filterPartDob').value : "";
    
    filteredParticipantsList = participantsList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        
        const partCatName = p.categories?.name || '';
        const matchCat = catFilter === "" || partCatName === catFilter;
        
        const partTeamName = p.teams?.name || '';
        const matchTeam = teamFilter === "" || partTeamName === teamFilter;
        
        const matchDob = dobFilter === "" || p.dob === dobFilter;
return matchName && matchCat && matchTeam && matchDob;
    });
    
    if (resetPage) partCurrentPage = 1; 
    renderParticipantsTable();
}


async function loadCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('categories')
            .select('*, participants(count), competitions(count)')
            .order('name');
            
        if(error) throw error;
        categoriesList = data || [];
        
        const tbody = document.getElementById('categories-tbody');
        tbody.innerHTML = '';
        
        categoriesList.forEach(cat => {
            const partCount = cat.participants[0]?.count || 0;
            const compCount = cat.competitions[0]?.count || 0;
            
            // Generate DOB Period Label
            let dobLabel = '';
            if (cat.dob_start && cat.dob_end) dobLabel = `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 600;"><i class="fa-regular fa-calendar"></i> ${cat.dob_start} to ${cat.dob_end}</span>`;
            else if (cat.dob_start) dobLabel = `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 600;"><i class="fa-regular fa-calendar"></i> From ${cat.dob_start}</span>`;
            else if (cat.dob_end) dobLabel = `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 600;"><i class="fa-regular fa-calendar"></i> Until ${cat.dob_end}</span>`;

            tbody.innerHTML += `
                <tr>
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${cat.id}" ${globalSelections['categories-tbody']?.has(cat.id) ? 'checked' : ''} onchange="handleRowSelection('categories-tbody', this.value, this.checked)"></td>                    
                    <td><strong style="font-size: 1.05rem;">${cat.name}</strong>${dobLabel}</td>
                    <td>${cat.is_general ? '<span class="badge badge-primary">General</span>' : 'Standard'}</td>
                    <td><span class="badge-count" onclick="viewRelationalData('participants', 'category_id', '${cat.id}')">${partCount} Students</span></td>
                    <td><span class="badge-count" onclick="viewRelationalData('competitions', 'category_id', '${cat.id}')">${compCount} Competitions</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                             <button class="btn btn-outline" onclick='openCategoryModal(${JSON.stringify(cat).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})'><i class="fa-solid fa-pen"></i></button>
                             <button class="btn btn-danger" onclick="deleteCategory('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        if (typeof filterCategoriesTable === 'function') filterCategoriesTable();
    } catch(e) { showToast(e.message, 'error'); }
}

function renderParticipantsTable() {
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    const start = (partCurrentPage - 1) * partRowsPerPage;
    const end = start + partRowsPerPage;
    const pageData = filteredParticipantsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No participants found.</td></tr>`;
    }

    pageData.forEach(p => {
        const safeData = JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        const photoSrc = p.photo_url ? p.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3ENO PHOTO%3C/text%3E%3C/svg%3E';        
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}" ${globalSelections['participants-tbody']?.has(p.id) ? 'checked' : ''} onchange="handleRowSelection('participants-tbody', this.value, this.checked)"></td>
                <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${p.unique_id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${photoSrc}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0;">
                        <span>${p.name}</span>
                    </div>
                </td>
                <td><span class="badge" style="background:#F1F5F9; color:#475569;">${p.teams?.name || 'UNASSIGNED'}</span></td>
                <td>${p.categories?.name || 'N/A'}</td>
                <td style="font-weight: 600; color: var(--text-muted);">${p.dob || 'N/A'}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Details" onclick='viewParticipantCard(${safeData})'><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="Edit" onclick='openParticipantModal(${safeData})'><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="Download ID" onclick="generateSingleCard('${p.id}')"><i class="fa-solid fa-download"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" title="Delete" onclick="deleteParticipant('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    renderPartPagination();
}


function renderPartPagination() {
    const totalPages = Math.ceil(filteredParticipantsList.length / partRowsPerPage) || 1;
    const paginationContainer = document.getElementById('part-pagination');
    
    const startNum = filteredParticipantsList.length === 0 ? 0 : ((partCurrentPage - 1) * partRowsPerPage) + 1;
    const endNum = Math.min(partCurrentPage * partRowsPerPage, filteredParticipantsList.length);

    const masterCb = document.querySelector('#participants-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredParticipantsList.length} entries
            <select onchange="partRowsPerPage = parseInt(this.value); partCurrentPage = 1; renderParticipantsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${partRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${partRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${partRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${partRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changePartPage(-1)" ${partCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: flex; align-items: center; padding: 0 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--primary);">Page ${partCurrentPage} of ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="changePartPage(1)" ${partCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

function changePartPage(direction) {
    const totalPages = Math.ceil(filteredParticipantsList.length / partRowsPerPage);
    partCurrentPage += direction;
    if (partCurrentPage < 1) partCurrentPage = 1;
    if (partCurrentPage > totalPages) partCurrentPage = totalPages;
    renderParticipantsTable();
}

// --- PARTICIPANT EXPORT FUNCTIONS ---

// Generates a Premium PDF Directory for Participants
async function exportParticipantsPDF() {
    showToast('Generating Participants PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Participants Directory');

        // Map over the filtered list to respect any active search criteria
        let tableRows = filteredParticipantsList.map((p, index) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-weight: 600;">${p.unique_id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${p.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.teams?.name || 'UNASSIGNED'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.categories?.name || 'N/A'}</td>
<td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${p.dob || 'N/A'}</td>
            </tr>
        `).join('');

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">UNIQUE ID</th>
                        <th style="padding: 10px;">NAME</th>
                        <th style="padding: 10px;">TEAM</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">DOB</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, 
            filename: `Fest_Participants.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}

// Custom CSV Export that resolves Category and Team IDs to real names
async function exportParticipantsCSV() {
    try {
        if(filteredParticipantsList.length === 0) return showToast("No participants to export.", "error");

        const flatData = filteredParticipantsList.map(p => ({
            "UNIQUE ID": p.unique_id || 'N/A',
            "NAME": p.name || 'N/A',
            "TEAM": p.teams?.name || 'UNASSIGNED',
            "CATEGORY": p.categories?.name || 'N/A',
            "DOB": p.dob || 'N/A'
        }));

        const blob = new Blob([Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute("download", `Fest_Participants_Data.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
        showToast('CSV Exported Successfully!');
    } catch (e) { showToast(e.message, 'error'); }
}

function viewParticipantCard(p) {
    const teamName = p.teams ? p.teams.name : 'UNASSIGNED';
    const catName = p.categories ? p.categories.name : 'GENERAL';
const photoSrc = p.photo_url ? p.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23E5E7EB"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236B7280"%3ENO PHOTO%3C/text%3E%3C/svg%3E';    
    document.getElementById('listModalTitle').innerText = 'Participant Identity';
    
    // Reset wrapper styling to allow flexible component layout
    const container = document.getElementById('listModalTable').parentElement;
    container.style.border = 'none';
    container.style.boxShadow = 'none';
    container.style.background = 'transparent';
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';
    
    document.getElementById('listModalTable').innerHTML = `
        <style>
            #listModalTable { display: block; width: 100%; border: none; }
            #listModalTable tbody, #listModalTable tr, #listModalTable td { 
                display: block; width: 100%; border: none; padding: 0; background: transparent; 
            }
            #listModalTable td::before { display: none !important; }

            .pid-wrapper { display: flex; flex-direction: column; gap: 1rem; width: 100%; }
            
            /* Top Card */
            .pid-top { 
                display: flex; gap: 1.5rem; background: white; border: 1px solid var(--border); 
                border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); align-items: center; 
            }
            .pid-photo { 
                width: 110px; height: 140px; flex-shrink: 0; border-radius: 12px; 
                overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm); 
            }
            .pid-photo img { width: 100%; height: 100%; object-fit: cover; }
            
            .pid-info { flex: 1; text-align: left; overflow: hidden; }
            .pid-name { 
                font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; 
                line-height: 1.2; word-break: break-word; text-transform: uppercase; 
            }
            .pid-badge { 
                background: var(--primary); color: white; padding: 0.35rem 0.75rem; 
                border-radius: 8px; font-family: monospace; font-size: 0.9rem; font-weight: 700; 
                display: inline-block; margin-bottom: 0.75rem; white-space: nowrap; 
                box-shadow: 0 4px 10px rgba(79,70,229,0.2); 
            }
            .pid-meta { 
                display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8rem; 
                font-weight: 700; color: var(--text-muted); text-transform: uppercase; 
            }
            .pid-meta-item { display: flex; align-items: center; gap: 0.5rem; }

            /* Bottom Cards */
            .pid-bottom { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: stretch; }
            
            .pid-qr-card { 
                background: white; border: 1px solid var(--border); border-radius: 16px; 
                padding: 1.25rem; display: flex; flex-direction: column; align-items: center; 
                justify-content: center; gap: 0.5rem; box-shadow: var(--shadow-sm); 
            }
            .pid-qr-box { width: 110px; height: 110px; display: flex; justify-content: center; align-items: center; }
            
            .pid-actions { display: flex; flex-direction: column; gap: 1rem; }
            .pid-dob-card { 
                background: var(--primary-light); border: 1px solid rgba(79,70,229,0.15); 
                border-radius: 16px; padding: 1.25rem; display: flex; justify-content: space-between; 
                align-items: center; flex: 1; min-height: 80px;
            }
            
            .pid-btn { 
                width: 100%; justify-content: center; padding: 1rem; border-radius: 12px; 
                background: white; border: 2px solid var(--border); font-weight: 800; 
                color: var(--text-main); transition: all 0.2s; box-shadow: var(--shadow-sm); 
                cursor: pointer; display: flex; align-items: center; gap: 0.5rem; 
                font-size: 0.9rem; text-transform: uppercase; 
            }
            .pid-btn:hover { border-color: var(--primary); color: var(--primary); }

            /* Mobile Stack Optimization */
@media (max-width: 768px) {
    .pid-top { 
        flex-direction: column; 
        align-items: center; 
        text-align: center; 
        padding: 1.25rem; 
    }
    .pid-info { 
        text-align: center; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
    }
    /* Force bottom section to stack vertically */
    .pid-bottom { 
        grid-template-columns: 1fr; 
        gap: 0.75rem; 
    }
    /* Turn QR card into a horizontal banner to save vertical space */
    .pid-qr-card { 
        flex-direction: row; 
        justify-content: flex-start; 
        padding: 1rem; 
        text-align: left; 
        gap: 1rem;
    }
    .pid-qr-box { 
        width: 70px; 
        height: 70px; 
        flex-shrink: 0; 
    }
    .pid-dob-card { 
        padding: 1rem; 
        min-height: auto; 
    }
}
        </style>
        
        <tbody>
            <tr>
                <td>
                    <div class="pid-wrapper">
                        
                        <!-- Top Profile Section -->
                        <div class="pid-top">
                            <div class="pid-photo">
                                <img src="${photoSrc}" alt="Photo">
                            </div>
                            <div class="pid-info">
                                <div class="pid-name">${p.name}</div>
                                <div class="pid-badge">${p.unique_id}</div>
                                <div class="pid-meta">
                                    <div class="pid-meta-item"><i class="fa-solid fa-users" style="color: var(--primary); width: 16px;"></i> ${teamName}</div>
                                    <div class="pid-meta-item"><i class="fa-solid fa-layer-group" style="color: var(--primary); width: 16px;"></i> ${catName}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Bottom Section -->
                        <div class="pid-bottom">
                            <!-- QR Code -->
                            <div class="pid-qr-card">
                                <div id="qr-container-${p.unique_id}" class="pid-qr-box">
                                    <i class="fa-solid fa-spinner fa-spin" style="color: var(--text-muted); font-size: 1.5rem;"></i>
                                </div>
                                <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em;">SCAN TO VERIFY</span>
                            </div>

                            <!-- Actions & DOB -->
                            <div class="pid-actions">
                                <div class="pid-dob-card">
                                    <div style="display: flex; flex-direction: column; gap: 0.25rem; text-align: left;">
                                        <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); letter-spacing: 0.05em; text-transform: uppercase;">DATE OF BIRTH</span>
                                        <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${p.dob || 'NOT PROVIDED'}</span>
                                    </div>
                                    <i class="fa-solid fa-cake-candles" style="font-size: 1.75rem; color: var(--primary); opacity: 0.3;"></i>
                                </div>

                                <button class="pid-btn" onclick="viewParticipantEnrollments('${p.id}')">
                                    <i class="fa-solid fa-clipboard-list"></i> VIEW ENROLLMENTS
                                </button>
                            </div>
                        </div>

                    </div>
                </td>
            </tr>
        </tbody>
    `;

    document.getElementById('listModal').classList.add('show');

    // Generate the QR code dynamically
    setTimeout(() => {
        const qrContainer = document.getElementById(`qr-container-${p.unique_id}`);
        if (qrContainer) {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: p.unique_id,
                width: 110,
                height: 110,
                colorDark: "#0F172A",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, 50);
}
// NEW FUNCTION: specifically joins competitions and categories to the participant
async function viewParticipantEnrollments(participantId) {
    document.getElementById('listModalTable').parentElement.style.cssText = "max-height: 300px; overflow-y: auto; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm);";
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`
                competitions(
                    name, 
                    categories(name)
                )
            `)
            .eq('participant_id', participantId);
            
        if (error) throw error;
        
        const tbody = document.getElementById('listModalTable');
        // Added Category column header
        tbody.innerHTML = `<tr><th>COMPETITION</th><th>CATEGORY</th></tr>`; 
        
        if (!data || data.length === 0) {
            tbody.innerHTML += `<tr><td colspan="2" style="color:var(--text-muted); text-align:center;">No enrollments found.</td></tr>`;
        } else {
            data.forEach(item => {
                const compName = item.competitions?.name || 'Unknown Competition';
                const catName = item.competitions?.categories?.name || 'General';
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 600;">${compName}</td>
                        <td><span class="badge" style="background:var(--primary-light); color:var(--primary); font-size:0.7rem;">${catName}</span></td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('listModalTitle').innerText = `Enrolled Competitions`;
        document.getElementById('listModal').classList.add('show');
    } catch (e) { 
        showToast(e.message, 'error'); 
    }
}

window.validateAdminDob = function() {
    const catId = document.getElementById('partCategory').value;
    const dobVal = document.getElementById('partDob').value;
    const warningEl = document.getElementById('dobWarning');
    const saveBtn = document.getElementById('modalSaveBtn');
    
    if(!catId || !dobVal || !warningEl) return;
    
    const category = categoriesList.find(c => String(c.id) === String(catId));
    let isInvalid = false;
    let warningMsg = '';

    if(category) {
        const dobDate = new Date(dobVal);
        if (category.dob_start && dobDate < new Date(category.dob_start)) {
            isInvalid = true;
            warningMsg = `Not eligible! Must be born on or AFTER ${category.dob_start}.`;
        }
        if (category.dob_end && dobDate > new Date(category.dob_end)) {
            isInvalid = true;
            warningMsg = `Not eligible! Must be born on or BEFORE ${category.dob_end}.`;
        }
    }

    if(isInvalid) {
        warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${warningMsg}`;
        warningEl.style.display = 'block';
        if(saveBtn) saveBtn.disabled = true;
    } else {
        warningEl.style.display = 'none';
        if(saveBtn) saveBtn.disabled = false;
    }
};

function openParticipantModal(editData = null) {
    let catOpts = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    let teamOpts = teamsList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    const isEdit = !!editData;
    const pId = isEdit ? editData.id : '';
    const pName = isEdit ? editData.name : '';
    const pDob = isEdit && editData.dob ? editData.dob : '';
    const pUniqueId = isEdit ? editData.unique_id : '';
    const pPhoto = isEdit && editData.photo_url ? editData.photo_url : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="100%25" height="100%25" fill="%23EEF2FF"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="%236366F1"%3EPHOTO%3C/text%3E%3C/svg%3E';
    
    const modalHtml = `
        <style>
            .part-modal-grid { display: grid; grid-template-columns: 150px 1fr; gap: 2rem; align-items: start; }
            @media (max-width: 600px) { .part-modal-grid { grid-template-columns: 1fr; gap: 1rem; text-align: center; } }
            
            .photo-preview-container img { 
                width: 100%; max-width: 150px; aspect-ratio: 2/3; object-fit: cover; 
                border-radius: 12px; border: 2.5px solid var(--border); padding: 4px; 
                box-shadow: var(--shadow-sm); background: white;
            }
            
            .photo-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; justify-content: center; }
            .photo-actions .btn { padding: 0.4rem; font-size: 0.75rem; flex: 1; }
        </style>
        
        <div class="part-modal-grid">
            <div class="photo-preview-container">
                <img id="partPhotoPreview" src="${pPhoto}" alt="Participant Photo">
                <input type="file" id="partPhoto" accept="image/png, image/jpeg, image/webp" onchange="triggerCropper(this)" style="display: none;">
                
                <div class="photo-actions">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('partPhoto').click()" title="Upload New Photo">
                        <i class="fa-solid fa-upload"></i> New
                    </button>
                    <button type="button" class="btn btn-outline" onclick="editExistingCrop()" title="Adjust Current Crop">
                        <i class="fa-solid fa-crop-simple"></i> Crop
                    </button>
                </div>
            </div>

            <div class="form-fields" style="text-align: left;">
                <input type="hidden" id="partId" value="${pId}">
                <input type="hidden" id="partUniqueId" value="${pUniqueId}">
                
                <div class="form-group">
                    <label>Full Name <span style="color: var(--danger);">*</span></label>
                    <input type="text" id="partName" placeholder="E.G. JOHN DOE" value="${pName}">
                </div>
                
                <div class="form-group">
                    <label>Team Assignment</label>
                    <select id="partTeam">
                        <option value="">-- INDEPENDENT (NO TEAM) --</option>
                        ${teamOpts}
                    </select>
                </div>
                
                <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 2; min-width: 150px;">
                        <label>Category <span style="color: var(--danger);">*</span></label>
                        <select id="partCategory" onchange="window.validateAdminDob()">${catOpts}</select>
                    </div>
                    
                    <div class="form-group" style="flex: 1; min-width: 130px;">
                        <label>Date of Birth</label>
                        <input type="date" id="partDob" value="${pDob}" style="text-transform: none;" onchange="window.validateAdminDob()">
                    </div>
                </div>
                <!-- Warning injection -->
                <div id="dobWarning" style="color: var(--danger); font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem; display: none;"></div>
            </div>
        </div>
    `;

    openModal(isEdit ? 'Edit Participant' : 'Register Participant', modalHtml, saveParticipant);

    if (isEdit) {
        if(editData.team_id) document.getElementById('partTeam').value = editData.team_id;
        if(editData.category_id) document.getElementById('partCategory').value = editData.category_id;
        setTimeout(() => window.validateAdminDob(), 100); // Check validity on load
    }
}

async function saveParticipant() {
    const id = document.getElementById('partId').value;
    const name = document.getElementById('partName').value;
    const team_id = document.getElementById('partTeam').value || null;
    const category_id = document.getElementById('partCategory').value;
    
    // CHANGED: Grab Date of Birth instead of Batch No
    const dob = document.getElementById('partDob').value || null;
    
    // Grab the existing unique_id if editing, otherwise generate a new one
    let unique_id = document.getElementById('partUniqueId').value;
    if (!id || !unique_id) {
        unique_id = `${Math.floor(100000 + Math.random() * 900000)}`; // <--- UPDATED LINE
    }
    
    if(!name) return showToast('Name is required', 'error');
    
    setLoading('modalSaveBtn', true);
    
    try {
        let photo_url = undefined; 

        if (currentCropper) {
            showToast('Processing image...', 'success');
            
            const canvas = currentCropper.getCroppedCanvas({
                width: 400, 
                height: 600
            });
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            const fileName = `profile_${Date.now()}.jpg`; 
            
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });
                
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('photos')
                .getPublicUrl(fileName);
                
            photo_url = publicUrlData.publicUrl;
        }

        // CHANGED: Include 'dob' in the payload
        const payload = { name, team_id, category_id, dob, unique_id };
        
        if (id) payload.id = id; 
        if (photo_url) payload.photo_url = photo_url; 

        const { error } = await supabaseClient.from('participants').upsert([payload]);
        if (error) throw error;
        
        showToast(id ? 'Participant updated!' : 'Participant registered successfully!');
        
        if(currentCropper) { currentCropper.destroy(); currentCropper = null; }
        
        closeModal(); 
        loadParticipants();
        
    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally { 
        setLoading('modalSaveBtn', false); 
    }
}



// --- USER MANAGEMENT ---
async function loadUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, name, username, role, password_hash, teams(name)')
            .neq('role', 'master_admin')
            .order('role');
            
        if(error) throw error;
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        
        (data || []).forEach(u => {
            const roleDisplay = u.role.replace('_', ' ').toUpperCase();
            const teamTag = u.teams?.name ? `<br><span style="font-size: 0.75rem; color: var(--primary); font-weight: 800; letter-spacing: 0.05em;">TEAM: ${u.teams.name.toUpperCase()}</span>` : '';
            const safeData = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: 600;">${u.name || '-'}</td>
                    <td>
                        <strong style="font-size:1.05rem;">${u.username}</strong>
                        ${teamTag}
                    </td> 
                    <td><span class="badge badge-primary">${roleDisplay}</span></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                           <input type="password" id="pwd-${u.id}" value="${u.password_hash || ''}" readonly style="border: none; background: transparent; width: 120px; font-weight: 600; color: var(--text-muted); outline: none; pointer-events: none; text-transform: none !important;">
                            <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="togglePassword('${u.id}')" title="Reveal Password"><i class="fa-solid fa-eye" id="eye-${u.id}"></i></button>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick='openUserModal(${safeData})' title="Edit User"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteUser('${u.id}', '${u.username.replace(/'/g, "\\'")}')" title="Delete User"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { showToast(e.message, 'error'); }
}

function togglePassword(id) {
    const pwdInput = document.getElementById(`pwd-${id}`);
    const eyeIcon = document.getElementById(`eye-${id}`);
    
    if (pwdInput.type === "password") {
        pwdInput.type = "text";
        eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        pwdInput.type = "password";
        eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function openUserModal(editData = null) {
    const isEdit = !!editData;
    const uId = isEdit ? editData.id : '';
    const uFullName = isEdit ? editData.name || '' : '';
    const uName = isEdit ? editData.username : '';
    const uPass = isEdit ? editData.password_hash : '';
    const uRole = isEdit ? editData.role : 'judge';

    openModal(isEdit ? 'Edit Staff Account' : 'Create Staff Account', `
        <input type="hidden" id="editUserId" value="${uId}">
        
        <div class="form-group"><label>Full Name</label><input type="text" id="newFullName" value="${uFullName}" placeholder="e.g. John Doe" autocomplete="off"></div>
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" value="${uName}" autocomplete="off"></div>
        
        <div class="form-group">
            <label>Password</label>
            <input type="text" id="newPassword" value="${uPass}" autocomplete="off" style="text-transform: none !important;">
        </div>
        
        <div class="form-group">
            <label>Role</label>
            <select id="newUserRole">
                <option value="judge" ${uRole === 'judge' ? 'selected' : ''}>Judge</option>
                <option value="stage_controller" ${uRole === 'stage_controller' ? 'selected' : ''}>Stage Controller</option>
                <option value="fest_manager" ${uRole === 'fest_manager' ? 'selected' : ''}>Fest Manager</option>
                <option value="announcer" ${uRole === 'announcer' ? 'selected' : ''}>Announcer</option>
                <option value="admin" ${uRole === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        </div>
    `, async () => {
        const id = document.getElementById('editUserId').value;
        const name = document.getElementById('newFullName').value.trim();
        const username = document.getElementById('newUsername').value.trim();
        const password_hash = document.getElementById('newPassword').value.trim();
        const role = document.getElementById('newUserRole').value;
        
        if (!username || !password_hash || !name) return showToast('Name, Username, and Password are required.', 'error');
        
        setLoading('modalSaveBtn', true);
        
        const payload = { name, username, password_hash, role };
        if (id) payload.id = id;
        
        const { error } = await supabaseClient.from('users').upsert([payload]);
        
        setLoading('modalSaveBtn', false);
        
        if (error) {
            if (error.code === '23505') showToast('Username already taken.', 'error'); 
            else showToast(error.message, 'error');
        } else { 
            showToast(id ? 'Account updated successfully!' : 'Account created successfully!');
            closeModal(); 
            loadUsers(); 
        }
    });
}

async function deleteCategory(id) {
    openConfirmModal("Delete Category?", "This might fail if competitions are linked to it.", async () => {
        try {
            const { error } = await supabaseClient.from('categories').delete().eq('id', id);
            if(error) throw error;
            showToast('Category deleted.');
            loadCategories();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteCompetition(id) {
    openConfirmModal("Delete Competition?", "Are you sure you want to permanently delete this competition?", async () => {
        try {
            const { error } = await supabaseClient.from('competitions').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') {
                    throw new Error('Cannot delete this competition because it has enrolled students or recorded marks. Remove them first.');
                }
                throw error;
            }
            showToast('Competition deleted.');
            loadCompetitions();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteParticipant(id) {
    openConfirmModal("Delete Participant?", "Are you sure you want to delete this participant?", async () => {
        try {
            const { error } = await supabaseClient.from('participants').delete().eq('id', id);
            if(error) throw error;
            showToast('Participant removed.');
            loadParticipants();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteUser(id, username) {
    openConfirmModal("Delete User?", `Delete the user "${username}"? This cannot be undone.`, async () => {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') showToast(`Cannot delete ${username} as they are linked to active records.`, 'error');
                else throw error;
            } else {
                showToast(`User ${username} deleted.`);
                loadUsers();
            }
        } catch(e) { showToast(e.message, 'error'); }
    });
}

// --- CSV BULK UPLOAD EXPORT (PapaParse) ---
async function downloadCSV(tableName) {
    try {
        const { data, error } = await supabaseClient.from(tableName).select('*');
        if (error) throw error;
        
        const blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute("download", `${tableName}_export.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
        showToast('Export successful!');
    } catch(e) { showToast("Export error: " + e.message, 'error'); }
}

function downloadTemplate(type) {
    let headers = [];
    if(type === 'categories') headers = ['name', 'is_general'];
    if(type === 'competitions') headers = ['name', 'max_participants', 'max_mark', 'stage_id', 'category_id'];
    if(type === 'participants') headers = ['name', 'category_id', 'batch_no', 'team_id'];
    
    const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${type}_template.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

async function handleBulkUpload(tableName, fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput.files.length) return showToast("Select a CSV file first.", 'error');
    
    showToast('Parsing CSV...', 'success');
    
    Papa.parse(fileInput.files[0], {
        header: true, skipEmptyLines: true, complete: async function(results) {
            if(!results.data.length) return showToast("No valid rows found in CSV.", 'error');
            
            const cleanData = results.data.map(row => {
                if (row.is_general) row.is_general = (row.is_general.toLowerCase() === 'true');
                if (row.max_participants) row.max_participants = parseInt(row.max_participants);
                if (row.max_mark) row.max_mark = parseFloat(row.max_mark);
                if (row.batch_no) row.batch_no = parseInt(row.batch_no);
                
                // <--- UPDATED LINE BELOW --->
                if (tableName === 'participants' && !row.unique_id) row.unique_id = `${Math.floor(100000 + Math.random() * 900000)}`;
                
                return row;
            });
            
            try {
                const { error } = await supabaseClient.from(tableName).insert(cleanData);
                if(error) throw error;
                showToast(`Success! Imported ${cleanData.length} records.`); 
                switchTab(tableName); 
            } catch(e) {
                showToast(`Upload failed: ${e.message}`, 'error');
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (user && (user.role === 'master_admin' || user.role === 'admin')) {
        const portalMenu = document.getElementById('master-admin-portals');
        if (portalMenu) portalMenu.style.display = 'block';
        
        const dashGreeting = document.getElementById('dash-greeting');
        if(dashGreeting) dashGreeting.innerHTML = `Good evening, <span style="color: #E11D48; font-weight: 800; text-transform: uppercase;">${user.username}</span>`;
    }

    if (user && user.role !== 'master_admin') {
        const dataCenterTab = document.getElementById('nav-data-center');
        if (dataCenterTab) dataCenterTab.style.display = 'none';
    } else {
        const dataCenterTab = document.getElementById('nav-data-center');
        if (dataCenterTab) dataCenterTab.style.display = 'block';
    }
    
    const cachedBranding = localStorage.getItem('festBranding');
    if (cachedBranding) { applyGlobalBranding(JSON.parse(cachedBranding)); }
    
    fetchAndSyncBranding(); 
    
    // Automatically boot into the new dashboard
    switchTab('dashboard');
});

async function fetchAndSyncBranding() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'system_branding').maybeSingle();
        if(data && data.value) {
            localStorage.setItem('festBranding', JSON.stringify(data.value));
            applyGlobalBranding(data.value);
        }
    } catch(e) {
        console.warn("Could not sync branding");
    }
}



// --- NEW CROPPER LIFECYCLE ---

function triggerCropper(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const cropperModal = document.getElementById('cropperModal');
            const image = document.getElementById('cropperImage');
            
            // Load image into the cropper modal
            image.src = e.target.result;
            cropperModal.classList.add('show');
            
            // Initialize Cropper.js
            if (currentCropper) currentCropper.destroy();
            currentCropper = new Cropper(image, {
                aspectRatio: 2 / 3,
                viewMode: 2, // Restricts crop box to not exceed canvas size
                background: false,
                autoCropArea: 0.9
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Linked to the "Cancel" button on the Cropper Modal
function cancelCropper() {
    document.getElementById('cropperModal').classList.remove('show');
    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }
    document.getElementById('partPhoto').value = ''; // Reset file input
}

// Linked to the "Apply Crop" button on the Cropper Modal
function confirmCrop() {
    if (!currentCropper) return;
    
    // Get cropped canvas
    const canvas = currentCropper.getCroppedCanvas({
        width: 400,
        height: 600
    });
    
    // Instantly update the thumbnail in the main form
    document.getElementById('partPhotoPreview').src = canvas.toDataURL('image/jpeg', 0.8);
    
    // Close the cropper modal, returning to the form
    document.getElementById('cropperModal').classList.remove('show');
    
    // Note: currentCropper remains in memory so saveParticipant() can upload it to Supabase!
}

// Function to re-crop the currently loaded image without re-uploading
function editExistingCrop() {
    const currentSrc = document.getElementById('partPhotoPreview').src;
    
    // Prevent cropping the placeholder image
    if (currentSrc.includes('via.placeholder.com')) {
        showToast('Please upload a photo first before attempting to crop.', 'error');
        return;
    }
    
    const cropperModal = document.getElementById('cropperModal');
    const image = document.getElementById('cropperImage');
    
    // Load the current preview image into the cropper
    image.src = currentSrc;
    cropperModal.classList.add('show');
    
    // Initialize Cropper.js
    if (currentCropper) currentCropper.destroy();
    currentCropper = new Cropper(image, {
        aspectRatio: 2 / 3,
        viewMode: 2, 
        background: false,
        autoCropArea: 0.9
    });
}

// --- ASSIGNMENTS MANAGEMENT ---
async function loadAssignments() {
    try {
        if (typeof renderAssignOverview === 'function') {
            renderAssignOverview();
        }
        
        const tbody = document.getElementById('assignments-tbody');
        if (!tbody) return; // Active view uses #assign-overview-tbody or #assign-workspace-tbody
        
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`id, participants(name, teams(name), categories(name)), competitions(name)`);
            
        if(error) throw error;
        
        tbody.innerHTML = '';
        
        // 1. Populate Filter Dropdown
        const filterComp = document.getElementById('filterAssignComp');
        if(filterComp && filterComp.options.length === 1 && typeof competitionsList !== 'undefined') {
            competitionsList.forEach(c => filterComp.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        }

        // 2. Generate Rows with Checkboxes
        (data || []).forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${row.id}"></td>
                    <td>${row.participants?.name}</td>
                    <td>${row.participants?.teams?.name || 'Unassigned'}</td>
                    <td>${row.competitions?.name}</td>
                    <td>${row.participants?.categories?.name}</td>
                    <td>
                        <button class="btn btn-danger" onclick="deleteAssignment('${row.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { showToast(e.message, 'error'); }
}

// --- ASSIGNMENTS & BULK ASSIGNMENTS FIX ---
async function openAssignModal() {
    // FORCE data load if lists are empty
    if (participantsList.length === 0) {
        const { data } = await supabaseClient.from('participants').select('*').order('name');
        participantsList = data || [];
    }
    if (competitionsList.length === 0) {
        const { data } = await supabaseClient.from('competitions').select('*').order('name');
        competitionsList = data || [];
    }

    let partOpts = participantsList.map(p => `<option value="${p.id}">${p.name} (${p.unique_id})</option>`).join('');
    let compOpts = competitionsList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    openModal('Assign Student to Competition', `
        <div class="form-group">
            <label>Select Participant</label>
            <select id="assignPart">
                <option value="">-- SELECT PARTICIPANT --</option>
                ${partOpts}
            </select>
        </div>
        <div class="form-group">
            <label>Select Competition</label>
            <select id="assignComp">
                <option value="">-- SELECT COMPETITION --</option>
                ${compOpts}
            </select>
        </div>
    `, async () => {
        const participant_id = document.getElementById('assignPart').value;
        const competition_id = document.getElementById('assignComp').value;
        
        if (!participant_id || !competition_id) return showToast('Please select both a participant and a competition.', 'error');

        setLoading('modalSaveBtn', true);
        try {
            const { error } = await supabaseClient.from('participant_competitions').insert([{ participant_id, competition_id }]);
            if (error) {
                if (error.code === '23505') throw new Error('Student is already assigned to this competition!');
                throw error;
            }
            showToast('Student Assigned!'); 
            closeModal(); 
            loadAssignments();
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setLoading('modalSaveBtn', false);
        }
    });
}
// --- UNIVERSAL TABLE CONTROLS ---
function filterTable(tbodyId, query) {
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    query = query.toLowerCase();
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function filterTableByColumn(tbodyId, colIndex, value) {
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    value = value.toLowerCase();
    rows.forEach(row => {
        const cellText = row.cells[colIndex].innerText.toLowerCase();
        if (value === "" || cellText.includes(value)) row.style.display = '';
        else row.style.display = 'none';
    });
}

const globalSelections = {
    'categories-tbody': new Set(),
    'competitions-tbody': new Set(),
    'participants-tbody': new Set(),
    'points-tbody': new Set(),
    'assign-workspace-tbody': new Set()
};

function handleRowSelection(tbodyId, value, isChecked) {
    if (!globalSelections[tbodyId]) globalSelections[tbodyId] = new Set();
    if (isChecked) globalSelections[tbodyId].add(value);
    else globalSelections[tbodyId].delete(value);
}

function clearSelection(tbodyId) {
    if (globalSelections[tbodyId]) globalSelections[tbodyId].clear();
    const masterCb = document.querySelector(`#${tbodyId}`)?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if (masterCb) masterCb.checked = false;
    
    // Uncheck DOM elements if any are still visible
    document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`).forEach(cb => cb.checked = false);
}

function toggleSelectAll(tbodyId, masterCheckbox) {
    const checkboxes = document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb`);
    checkboxes.forEach(cb => {
        if (cb.closest('tr').style.display !== 'none') {
            cb.checked = masterCheckbox.checked;
            handleRowSelection(tbodyId, cb.value, masterCheckbox.checked);
        }
    });
}

function getSelectedIds(tbodyId) {
    // Fallback sync for manually checked DOM items just in case
    const domChecked = Array.from(document.querySelectorAll(`#${tbodyId} input[type="checkbox"].row-cb:checked`)).map(cb => cb.value);
    domChecked.forEach(val => handleRowSelection(tbodyId, val, true));
    return Array.from(globalSelections[tbodyId] || []);
}

// --- BULK ACTION LOGIC ---


async function openBulkAssignModal() {
    const ids = getSelectedIds('participants-tbody');
    if(ids.length === 0) return showToast('Select participants to assign first.', 'error');

    // Ensure competitions list is loaded
    if (competitionsList.length === 0) {
        const { data } = await supabaseClient.from('competitions').select('*').order('name');
        competitionsList = data || [];
    }

    let compOpts = competitionsList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    openModal('Bulk Assign to Competition', `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--primary-light); border-radius: 8px; color: var(--primary); font-weight: 600;">
            <i class="fa-solid fa-users"></i> ASSIGNING ${ids.length} SELECTED PARTICIPANT(S).
        </div>
        <div class="form-group">
            <label>Select Competition</label>
            <select id="bulkAssignComp">
                <option value="">-- SELECT COMPETITION --</option>
                ${compOpts}
            </select>
        </div>
    `, async () => {
        const competition_id = document.getElementById('bulkAssignComp').value;
        if (!competition_id) return showToast('Select a competition.', 'error');

        const inserts = ids.map(participant_id => ({ participant_id, competition_id }));
        
        setLoading('modalSaveBtn', true);
        try {
            const { error } = await supabaseClient.from('participant_competitions').insert(inserts);
            if (error) {
                if (error.code === '23505') throw new Error('One or more selected participants are already assigned here.');
                throw error;
            }
            
            showToast(`Successfully assigned ${ids.length} participants!`); 
            closeModal(); 
            
            // Uncheck the boxes and flip to assignments tab to see results
clearSelection('participants-tbody');
            switchTab('assignments');
        } catch (e) { 
            showToast(e.message, 'error'); 
        } finally {
            setLoading('modalSaveBtn', false);
        }
    });
}

// --- NEW ASSIGNMENT WORKSPACE LOGIC ---
let currentAssignCompLimit = 0;
let currentAssignEnrolled = 0;
let currentEnrolledStudentIds = []; // Tracks who is already assigned

async function initAssignWorkspace() {
    // 1. Load baseline data
    if (categoriesList.length === 0) { const { data } = await supabaseClient.from('categories').select('*').order('name'); categoriesList = data || []; }
    if (teamsList.length === 0) { const { data } = await supabaseClient.from('teams').select('*').order('name'); teamsList = data || []; }

    // 2. Populate Category Dropdown
    const catSelect = document.getElementById('assignWorkCategory');
    catSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY --</option>';
    categoriesList.forEach(c => {
        catSelect.innerHTML += `<option value="${c.id}" data-general="${c.is_general}">${c.name} ${c.is_general ? '(GENERAL)' : ''}</option>`;
    });

    // 3. Populate Team Filter
    const teamFilter = document.getElementById('assignFilterTeam');
    teamFilter.innerHTML = '<option value="">All Teams</option>';
    teamsList.forEach(t => teamFilter.innerHTML += `<option value="${t.id}">${t.name}</option>`);

    // Reset Workspace
    document.getElementById('assignStudentWorkspace').style.display = 'none';
    document.getElementById('assignWorkComp').innerHTML = '<option value="">-- CHOOSE COMPETITION FIRST --</option>';
    document.getElementById('assignWorkComp').disabled = true;
}

let currentWorkspaceComps = [];

window.loadAssignWorkspaceCompetitions = async function() {
    const categoryId = document.getElementById('assignWorkCategory').value;
    const compSelect = document.getElementById('assignWorkComp');
    document.getElementById('assignStudentWorkspace').style.display = 'none';
    
    const searchInput = document.getElementById('assignWorkCompSearch');
    if (searchInput) searchInput.value = ''; // Reset search
    
    if (!categoryId) {
        compSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY FIRST --</option>';
        compSelect.disabled = true;
        currentWorkspaceComps = [];
        return;
    }

    try {
        compSelect.innerHTML = '<option value="">Loading...</option>';
        // Fetch ALL competitions for the category
        const { data, error } = await supabaseClient.from('competitions').select('*').eq('category_id', categoryId).order('name');
        if (error) throw error;

        currentWorkspaceComps = data || []; 
        renderAssignWorkspaceDropdown(currentWorkspaceComps);
    } catch (e) {
        showToast(e.message, 'error');
    }
};

window.renderAssignWorkspaceDropdown = function(comps) {
    const compSelect = document.getElementById('assignWorkComp');
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION TO MANAGE --</option>';
    comps.forEach(c => {
        compSelect.innerHTML += `<option value="${c.id}" data-limit="${c.max_participants}" data-is-group="${c.is_group}">${c.name}</option>`;
    });
    compSelect.disabled = false;
};

window.filterAssignWorkspaceDropdown = function() {
    const search = document.getElementById('assignWorkCompSearch').value.toLowerCase();
    const filtered = currentWorkspaceComps.filter(c => c.name.toLowerCase().includes(search));
    renderAssignWorkspaceDropdown(filtered);
};

async function loadAssignWorkspaceStudents() {
    const catSelect = document.getElementById('assignWorkCategory');
    const compSelect = document.getElementById('assignWorkComp');
    const workspace = document.getElementById('assignStudentWorkspace');
    const tbody = document.getElementById('assign-workspace-tbody');
    
    const categoryId = catSelect.value;
    const isGeneral = catSelect.options[catSelect.selectedIndex].getAttribute('data-general') === 'true';
    const compId = compSelect.value;

    if (!compId) {
        workspace.style.display = 'none';
        return;
    }

    currentAssignCompLimit = parseInt(compSelect.options[compSelect.selectedIndex].getAttribute('data-limit')) || 0;
    
    // NEW: Capture if the selected competition is a group event
    const isGroupComp = compSelect.options[compSelect.selectedIndex].getAttribute('data-is-group') === 'true';

    workspace.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading students...</td></tr>';

    try {
        const limitDisplay = document.getElementById('assignLimitIndicator');
        limitDisplay.innerHTML = `<i class="fa-solid fa-users"></i> Max Enrollment: ${currentAssignCompLimit} Participants Per Team`;
        
        // --- NEW: Calculate Allowed Categories ---
        let allowedCatIds = [categoryId]; 
        if (isGeneral && typeof categoriesList !== 'undefined') {
            categoriesList.forEach(c => {
                if (c.allowed_general_categories && c.allowed_general_categories.includes(categoryId)) {
                    allowedCatIds.push(c.id);
                }
            });
        }
        
        let studentQuery = supabaseClient.from('participants').select('*, teams(name)');
        if (!isGeneral) {
            studentQuery = studentQuery.eq('category_id', categoryId);
        } else {
            studentQuery = studentQuery.in('category_id', allowedCatIds);
        }

        const { data: students, error: studentError } = await studentQuery.order('name');
        if (studentError) throw studentError;

        // UPDATED: Now fetches is_leader as well
        const { data: enrollments, error: enrollError } = await supabaseClient
            .from('participant_competitions')
            .select('participant_id, is_leader')
            .eq('competition_id', compId);
        if (enrollError) throw enrollError;

        currentEnrolledStudentIds = (enrollments || []).map(e => e.participant_id);
        
        // NEW: Update table header dynamically based on competition type
        document.querySelector('#assign-workspace-tbody').parentElement.querySelector('thead tr').innerHTML = `
            <th class="checkbox-cell"><input type="checkbox" onchange="toggleSelectAll('assign-workspace-tbody', this)"></th>
            <th>Unique ID</th>
            <th>Participant Name</th>
            <th>Team</th>
            <th>DOB</th>
            <th>${isGroupComp ? 'Group Role' : 'Current Status'}</th>
        `;

        tbody.innerHTML = '';
        (students || []).forEach(s => {
            const enrollmentRecord = (enrollments || []).find(e => e.participant_id === s.id);
            const isAssigned = !!enrollmentRecord;
            
            let statusBadge = '';
            
            // NEW: Render UI based on group status and assignment
            if (isGroupComp) {
                if (isAssigned) {
                    statusBadge = enrollmentRecord.is_leader 
                        ? '<span class="badge" style="background:var(--primary); color:white;">LEADER</span>' 
                        : '<span class="badge" style="background:#E2E8F0; color:#475569;">PARTY</span>';
                } else {
                    // Radio button allows picking one leader per team
                    statusBadge = `<label style="cursor:pointer; font-size:0.8rem; font-weight:700; color:var(--text-muted); display:flex; align-items:center; gap:0.25rem;"><input type="radio" name="leader_${s.team_id}" value="${s.id}" class="leader-radio" style="width:14px; height:14px; accent-color: var(--primary);"> Set Leader</label>`;
                }
            } else {
                statusBadge = isAssigned 
                    ? '<span class="badge" style="background:var(--success); color:white;">ASSIGNED</span>'
                    : '<span class="badge" style="background:#E2E8F0; color:#475569;">UNASSIGNED</span>';
            }
                
            tbody.innerHTML += `
                <tr data-team="${s.team_id || ''}" data-dob="${s.dob || ''}">
                    <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${s.id}" ${globalSelections['assign-workspace-tbody']?.has(s.id) ? 'checked' : ''} onchange="handleRowSelection('assign-workspace-tbody', this.value, this.checked)"></td>
                    <td style="font-family: monospace; font-weight: 600;">${s.unique_id}</td>
                    <td class="searchable-name">${s.name}</td>
                    <td>${s.teams?.name || 'INDEPENDENT'}</td>
                    <td>${s.dob || 'N/A'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
        
        // Re-apply any active search/filter rules
        if (typeof filterAssignTable === 'function') filterAssignTable();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Local Table Filter (Search, Team, DOB, Status)
function filterAssignTable() {
    const searchVal = document.getElementById('assignSearch').value.toLowerCase();
    const teamVal = document.getElementById('assignFilterTeam').value;
    const dobVal = document.getElementById('assignFilterDob').value;
    const statusVal = document.getElementById('assignFilterStatus').value; 
    
    const rows = document.querySelectorAll('#assign-workspace-tbody tr');

    rows.forEach(row => {
        if(row.children.length === 1) return; // Skip "Loading..." row
        
        // Grab values from the row attributes and cells
        const text = row.querySelector('.searchable-name').innerText.toLowerCase() + " " + row.cells[1].innerText.toLowerCase();
        const rowTeam = row.getAttribute('data-team');
        const rowDob = row.getAttribute('data-dob');

        // Dynamically determine the row's assignment status based on the badge text in the last cell
        const statusText = row.cells[5].innerText.toLowerCase();
        let rowStatus = 'unassigned';
        if (statusText.includes('assigned') && !statusText.includes('unassigned') || statusText.includes('leader') || statusText.includes('party')) {
            rowStatus = 'assigned';
        }

        // Evaluate all filter conditions
        const matchSearch = text.includes(searchVal);
        const matchTeam = teamVal === "" || rowTeam === teamVal;
        const matchDob = dobVal === "" || rowDob === dobVal;
        const matchStatus = statusVal === "" || rowStatus === statusVal; 

        // Hide or show row based on ALL conditions matching
        row.style.display = (matchSearch && matchTeam && matchDob && matchStatus) ? '' : 'none';
    });
}

async function executeWorkspaceAssign() {
    const compSelect = document.getElementById('assignWorkComp');
    const compId = compSelect.value;
    const isGroupComp = compSelect.options[compSelect.selectedIndex].getAttribute('data-is-group') === 'true';
    const ids = getSelectedIds('assign-workspace-tbody');
    
    if (ids.length === 0) return showToast('Select at least one student.', 'error');
    
    const newIds = ids.filter(id => !currentEnrolledStudentIds.includes(id));
    if (newIds.length === 0) return showToast('Selected students are already assigned.', 'error');

    setLoading('btnWorkspaceAssign', true);

    try {
        const { data: newStudents, error: studentError } = await supabaseClient.from('participants').select('id, team_id').in('id', newIds);
        if (studentError) throw studentError;

        // --- NEW: STRICT LIMIT CHECK PER TEAM ---
        if (currentAssignCompLimit > 0) {
            // Fetch existing enrollments to count current team assignments
            const { data: existing, error: existErr } = await supabaseClient
                .from('participant_competitions')
                .select('participant_id, participants(team_id)')
                .eq('competition_id', compId);
            
            if (existErr) throw existErr;

            const teamCounts = {};
            (existing || []).forEach(e => {
                const tId = e.participants?.team_id || 'INDEPENDENT';
                teamCounts[tId] = (teamCounts[tId] || 0) + 1;
            });

            // Count how many new ones we are trying to add per team
            const newTeamCounts = {};
            newStudents.forEach(s => {
                const tId = s.team_id || 'INDEPENDENT';
                newTeamCounts[tId] = (newTeamCounts[tId] || 0) + 1;
            });

            // Verify limits
            for (const [tId, count] of Object.entries(newTeamCounts)) {
                const current = teamCounts[tId] || 0;
                if (current + count > currentAssignCompLimit) {
                    const teamName = teamsList.find(t => t.id === tId)?.name || 'INDEPENDENT';
                    throw new Error(`Limit Exceeded for team '${teamName}'! Max ${currentAssignCompLimit} participants allowed per team. (Currently enrolled: ${current}, Trying to add: ${count})`);
                }
            }
        }
        // --- END LIMIT CHECK ---

        // Group the new students by team for group leader mapping
        const teamsGrouping = {};
        newStudents.forEach(student => {
             const tId = student.team_id || 'INDEPENDENT';
             if(!teamsGrouping[tId]) teamsGrouping[tId] = [];
             teamsGrouping[tId].push(student.id);
        });

        const inserts = [];
        for (const [tId, studentIds] of Object.entries(teamsGrouping)) {
             // Generate a unique Group ID based on the Team + Comp + Timestamp
             const groupId = isGroupComp ? `GRP_${compId}_${tId}_${Date.now()}` : null;
             
             // Check if a leader was selected for this team's group
             let leaderId = null;
             if (isGroupComp) {
                  const leaderRadio = document.querySelector(`input[name="leader_${tId}"]:checked`);
                  if (leaderRadio) leaderId = leaderRadio.value;
             }

             studentIds.forEach(pId => {
                 inserts.push({
                     participant_id: pId,
                     competition_id: compId,
                     group_id: groupId,
                     is_leader: isGroupComp ? (pId === leaderId) : false
                 });
             });
        }

        const { error } = await supabaseClient.from('participant_competitions').insert(inserts);
        if (error) throw error;
        
        showToast(`Successfully assigned ${newIds.length} students!`);
        clearSelection('assign-workspace-tbody');
        loadAssignWorkspaceStudents(); 

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('btnWorkspaceAssign', false);
    }
}

async function bulkDelete(tableName, tbodyId) {
    const ids = getSelectedIds(tbodyId);
    if(ids.length === 0) return showToast('No rows selected', 'error');
    
    openConfirmModal("Bulk Delete?", `Are you sure you want to permanently delete ${ids.length} selected items?`, async () => {
        try {
            const { error } = await supabaseClient.from(tableName).delete().in('id', ids);
            if (error) throw error;
            
            showToast(`Successfully deleted ${ids.length} items`);
            clearSelection(tbodyId);
            
            if(tableName === 'categories') loadCategories();
            if(tableName === 'competitions') loadCompetitions();
            if(tableName === 'participants') loadParticipants();
            if(tableName === 'participant_competitions') loadAssignments();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function bulkRevokeTeam() {
    const participantIds = getSelectedIds('participants-tbody');
    if (participantIds.length === 0) return showToast('Select at least one participant.', 'error');
    
    openConfirmModal("Revoke Teams?", `Are you sure you want to remove ${participantIds.length} participants from their teams?`, async () => {
        try {
            const { error } = await supabaseClient.from('participants').update({ team_id: null }).in('id', participantIds);
            if (error) throw error;
            showToast('Teams revoked successfully.');
            clearSelection('participants-tbody');
            loadParticipants();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function executeWorkspaceRemove() {
    const compId = document.getElementById('assignWorkComp').value;
    const ids = getSelectedIds('assign-workspace-tbody');
    
    if (ids.length === 0) return showToast('Select at least one student.', 'error');
    
    const assignedIds = ids.filter(id => currentEnrolledStudentIds.includes(id));
    if (assignedIds.length === 0) return showToast('None of the selected students are currently assigned.', 'error');

    openConfirmModal("Remove Students?", `Remove ${assignedIds.length} students from this competition?`, async () => {
        setLoading('btnWorkspaceRemove', true);
        try {
            const { error } = await supabaseClient.from('participant_competitions')
                .delete().eq('competition_id', compId).in('participant_id', assignedIds);
            if (error) throw error;
            
            showToast(`Removed ${assignedIds.length} students.`);
            document.querySelector('#assign-workspace-tbody').previousElementSibling.querySelector('input[type="checkbox"]').checked = false;
            loadAssignWorkspaceStudents();
        } catch (e) { showToast(e.message, 'error'); } 
        finally { setLoading('btnWorkspaceRemove', false); }
    });
}

// Export Full Assignment Data to CSV
async function exportAssignmentsCSV() {
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`participants(name, unique_id, teams(name), categories(name)), competitions(name)`);
            
        if(error) throw error;
        
        // Flatten the nested JSON for CSV format
        const flatData = (data || []).map(row => ({
            "UNIQUE ID": row.participants?.unique_id || 'N/A',
            "STUDENT NAME": row.participants?.name || 'N/A',
            "TEAM": row.participants?.teams?.name || 'INDEPENDENT',
            "CATEGORY": row.participants?.categories?.name || 'N/A',
            "COMPETITION": row.competitions?.name || 'N/A'
        }));

        const blob = new Blob([Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.setAttribute("download", `Fest_Assignments_Data.csv`);
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
        showToast('CSV Exported Successfully!');
    } catch (e) { showToast(e.message, 'error'); }
}

// Generate a Branded Premium PDF Document
// Generate a Branded Premium PDF Document
async function exportAssignmentsPDF() {
    showToast('Generating Premium PDF...', 'success');
    try {
        // Updated query to fetch both student category and competition category
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`participants(name, unique_id, teams(name), categories(name)), competitions(name, categories(name))`)
            .order('competition_id');
            
        if(error) throw error;

        // Group data by Competition and its Category for a clean layout
        const grouped = {};
        (data || []).forEach(row => {
            const compName = row.competitions?.name || 'Unknown Competition';
            const compCat = row.competitions?.categories?.name || 'General Category';
            const key = `${compName}_${compCat}`; // Composite key to keep them distinct
            
            if(!grouped[key]) {
                grouped[key] = {
                    name: compName,
                    category: compCat,
                    students: []
                };
            }
            grouped[key].students.push(row.participants);
        });

        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Master Assignment Ledger');

        for (const key in grouped) {
            const compData = grouped[key];
            
            // Added Student Category to the rows
            let tableRows = compData.students.map((s, index) => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-family: monospace;">${s?.unique_id || 'N/A'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${s?.name || 'UNKNOWN'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${s?.teams?.name || 'INDEPENDENT'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${s?.categories?.name || 'N/A'}</td>
                </tr>
            `).join('');

            // Added Competition Category to Header & Student Category to Table Head
            container.innerHTML += `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <h3 style="background: #1E293B; color: white; padding: 12px; border-radius: 8px 8px 0 0; margin: 0; font-size: 14px; text-transform: uppercase;">
                        ${compData.name} <span style="font-size: 11px; color: #94A3B8; margin-left: 8px; font-weight: 600;">(${compData.category})</span>
                        <span style="float:right; font-weight: normal; font-size: 12px;">${compData.students.length} ENROLLED</span>
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                        <thead>
                            <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                                <th style="padding: 10px;">#</th>
                                <th style="padding: 10px;">ID</th>
                                <th style="padding: 10px;">NAME</th>
                                <th style="padding: 10px;">TEAM</th>
                                <th style="padding: 10px;">STUDENT CATEGORY</th>
                            </tr>
                        </thead>
                        <tbody style="font-size: 12px; color: #334155;">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const opt = { 
            margin: 10, 
            filename: `Fest_Assignments_Ledger.pdf`, 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}
// ============================================================================
// PDF ID CARD GENERATION ENGINE (TEMPLATE BASED)
// ============================================================================

// --- HELPER: Promise-based image loader ---
function loadImagePromise(src) {
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // Return null if broken to prevent canvas crash
        img.src = src;
    });
}

// --- CORE GENERATOR: Draws the participant data onto the Cloud Template ---
async function generateParticipantIDCanvas(participant, template) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Load Background
    const bgImg = await loadImagePromise(template.bg_base64);
    canvas.width = bgImg.naturalWidth;
    canvas.height = bgImg.naturalHeight;
    ctx.drawImage(bgImg, 0, 0);

    const mappedData = {
        'ParticipantName': participant.name.toUpperCase(),
        // <--- UPDATED LINE BELOW --->
        'UniqueID': participant.unique_id || `${participant.id.substring(0,6)}`.toUpperCase(),
        'TeamName': participant.teams?.name?.toUpperCase() || 'INDEPENDENT',
        'Category': participant.categories?.name?.toUpperCase() || '',
        'DateOfBirth': participant.dob || ''
    };

    for (const [key, field] of Object.entries(template.fields)) {
        if (!field.enabled) continue;

        if (field.isImage) {
            // Render Participant Photo
            if (key === 'Photo') {
                const photoSrc = participant.photo_url || null; // Removed external URL dependency
                let pPhoto = null;
                
                if (photoSrc) {
                    pPhoto = await loadImagePromise(photoSrc);
                }
                
                ctx.save();
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(field.x, field.y, field.w, field.h, field.radius || 0);
                else ctx.rect(field.x, field.y, field.w, field.h);
                ctx.clip();
                
                // If image successfully loaded, draw it
                if (pPhoto && pPhoto.naturalWidth > 0) {
                    ctx.drawImage(pPhoto, field.x, field.y, field.w, field.h);
                } else {
                    // Native Canvas Fallback (No external URL needed)
                    ctx.fillStyle = "#E2E8F0"; // Light gray background
                    ctx.fillRect(field.x, field.y, field.w, field.h);
                    
                    ctx.fillStyle = "#94A3B8"; // Slate text color
                    ctx.font = "bold 24px Inter, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("NO PHOTO", field.x + (field.w / 2), field.y + (field.h / 2));
                }
                
                ctx.restore();
            }
            
            // Render QR Code
            if (key === 'QRCode') {
                const qrContainer = document.createElement('div');
                // Create QR with the unique ID
                new QRCode(qrContainer, { 
                    text: participant.unique_id, 
                    width: field.w, 
                    height: field.h,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H 
                });
                
                // Give QRCode.js a tiny fraction of a second to render to its internal canvas
                await new Promise(r => setTimeout(r, 50)); 
                const qrCanvas = qrContainer.querySelector('canvas');
                if(qrCanvas) {
                    ctx.drawImage(qrCanvas, field.x, field.y, field.w, field.h);
                }
            }
        } 
        else {
           // Render Typography
            const textToDraw = field.isCustom ? field.displayName : (mappedData[key] || "");
            if (!textToDraw) continue;

            ctx.textAlign = field.align;
            ctx.fillStyle = field.color;
            ctx.font = `${field.weight || 'bold'} ${field.size}px ${field.font}`;
            ctx.fillText(textToDraw, field.x, field.y);
        }
    }

    return canvas;
}

// Helper function to dynamically calculate PDF size to prevent stretching
function getDynamicPdfConfig(canvas, baseWidthMm = 63.5) {
    // Calculates perfect height based on the uploaded template's aspect ratio
    const calculatedHeightMm = (canvas.height * baseWidthMm) / canvas.width;
    return {
        width: baseWidthMm,
        height: calculatedHeightMm,
        orientation: baseWidthMm > calculatedHeightMm ? 'landscape' : 'portrait'
    };
}
// --- 1. SINGLE CARD GENERATOR ---
async function generateSingleCard(participantId) {
    showToast('Fetching template and generating PDF...', 'success');
    try {
        const { data: templates } = await supabaseClient.from('templates').select('*').eq('type', 'id_card').limit(1);
        if (!templates || templates.length === 0) return showToast("No ID Card template found! Create one in the Studio first.", "error");
        
        const { data: p, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').eq('id', participantId).single();
        if (error || !p) return showToast("Could not fetch participant data.", 'error');
        
        const cardCanvas = await generateParticipantIDCanvas(p, templates[0]);
        const imgData = cardCanvas.toDataURL('image/jpeg', 1.0);
        
        // Dynamically calculate size to prevent stretching!
        const pdfConfig = getDynamicPdfConfig(cardCanvas);
        const pdf = new jspdf.jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
        pdf.save(`${p.name}_ID_Card.pdf`);
        
        showToast('PDF Downloaded!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// --- 2. BULK PRINT SELECTED ---
async function bulkPrintSelected() {
    const ids = getSelectedIds('participants-tbody');
    if (ids.length === 0) return showToast('No participants selected', 'error');

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; 
    btn.disabled = true;

    try {
        const { data: templates } = await supabaseClient.from('templates').select('*').eq('type', 'id_card').limit(1);
        if (!templates || templates.length === 0) throw new Error("No ID Card template found! Create one in the Studio first.");
        const template = templates[0];

        const { data: participants, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').in('id', ids).order('name');
        if (error) throw error;
        
        let pdf = null;
        let pdfConfig = null;

        for (let i = 0; i < participants.length; i++) {
            const cardCanvas = await generateParticipantIDCanvas(participants[i], template);
            const imgData = cardCanvas.toDataURL('image/jpeg', 0.95);
            
            // Initialize PDF config only on the first iteration to get the exact ratio
            if (!pdfConfig) {
                pdfConfig = getDynamicPdfConfig(cardCanvas);
                pdf = new jspdf.jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < participants.length - 1) pdf.addPage();
        }

        pdf.save("Selected_ID_Cards.pdf");
        showToast('Selected PDFs Generated Successfully!');
        
    } catch (e) { 
        showToast(e.message, 'error'); 
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false;
    }
}
// --- 3. GENERATE ALL BULK CARDS ---
async function generateBulkCards() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; 
    btn.disabled = true;

    try {
        const { data: templates } = await supabaseClient.from('templates').select('*').eq('type', 'id_card').limit(1);
        if (!templates || templates.length === 0) throw new Error("No ID Card template found! Create one in the Studio first.");
        const template = templates[0];

        const { data: participants, error } = await supabaseClient.from('participants').select('*, categories(name), teams(name)').order('name');
        if (error) throw error;
        if (!participants || !participants.length) throw new Error("No participants found.");

        showToast(`Rendering ${participants.length} cards. This may take a minute...`, 'success');

        let pdf = null;
        let pdfConfig = null;

        for (let i = 0; i < participants.length; i++) {
            const cardCanvas = await generateParticipantIDCanvas(participants[i], template);
            const imgData = cardCanvas.toDataURL('image/jpeg', 0.85); // Slightly compressed for massive bulk exports
            
            // Initialize PDF config based on actual image ratio
            if (!pdfConfig) {
                pdfConfig = getDynamicPdfConfig(cardCanvas);
                pdf = new jspdf.jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < participants.length - 1) pdf.addPage();
        }

        pdf.save("FestOS_All_ID_Cards.pdf");
        showToast('Bulk PDF Generated Successfully!');

    } catch(e) { 
        showToast(e.message, 'error'); 
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false; 
    }
}
// --- PREMIUM POSTER TEMPLATE ENGINE ---

let activeTemplateType = 'individual';
let activeInputField = null; // Tracks which input the user is currently targeting

// Global State to hold images and coordinates in memory
let templateData = {
    individual: { bgImage: new Image(), fields: ['Result Number', 'Category', 'Competition', 'Position 1 Name', 'Position 2 Name', 'Position 3 Name', 'Team Name'], coords: {} },
    team: { bgImage: new Image(), fields: ['Results Count Text', 'Team 1 Name', 'Team 1 Points', 'Team 2 Name', 'Team 2 Points'], coords: {} },
    final: { bgImage: new Image(), fields: ['Total Competitions Count', 'Final Champion Team', 'Champion Points'], coords: {} }
};

// Simulated mock data to render on the preview canvas
const previewMockData = {
    'ResultNumber': '#42', 'Category': 'GENERAL', 'Competition': 'DANCE OFF',
    'Position1Name': 'JOHN DOE', 'Position2Name': 'JANE SMITH', 'Position3Name': 'MIKE TYSON',
    'TeamName': 'FALCONS', 'ResultsCountText': 'RESULTS AFTER 40',
    'Team1Name': 'FALCONS', 'Team1Points': '450', 'Team2Name': 'EAGLES', 'Team2Points': '380',
    'TotalCompetitionsCount': 'FINAL RESULTS - 120', 'FinalChampionTeam': 'FALCONS', 'ChampionPoints': '1250'
};

function loadTemplateConfig() {
    activeTemplateType = document.getElementById('template-type-select').value;
    const fieldsContainer = document.getElementById('alignment-fields');
    fieldsContainer.innerHTML = '';
    
    const config = templateData[activeTemplateType];

    config.fields.forEach(field => {
        const fieldKey = field.replace(/\s+/g, ''); // e.g., 'Position1Name'
        
        // Initialize defaults if empty
        if (!config.coords[fieldKey]) config.coords[fieldKey] = { x: 100, y: 150 };

        fieldsContainer.innerHTML += `
            <div style="background: white; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <label style="font-weight: 700; display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">${field}</label>
                <div style="display: flex; gap: 0.75rem;">
                    <div style="flex: 1; position: relative;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">X</span>
                        <input type="number" id="x-${fieldKey}" value="${config.coords[fieldKey].x}" onfocus="setActiveField('${fieldKey}')" oninput="updateCoordsFromInput('${fieldKey}')" style="width: 100%; padding: 0.65rem 0.65rem 0.65rem 1.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); outline: none;">
                    </div>
                    <div style="flex: 1; position: relative;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">Y</span>
                        <input type="number" id="y-${fieldKey}" value="${config.coords[fieldKey].y}" onfocus="setActiveField('${fieldKey}')" oninput="updateCoordsFromInput('${fieldKey}')" style="width: 100%; padding: 0.65rem 0.65rem 0.65rem 1.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); outline: none;">
                    </div>
                </div>
            </div>
        `;
    });

    renderTemplatePreview();
}

function setActiveField(fieldKey) {
    activeInputField = fieldKey;
}

function updateCoordsFromInput(fieldKey) {
    const x = parseInt(document.getElementById(`x-${fieldKey}`).value) || 0;
    const y = parseInt(document.getElementById(`y-${fieldKey}`).value) || 0;
    templateData[activeTemplateType].coords[fieldKey] = { x, y };
    renderTemplatePreview();
}

// Handle Image Upload and load it into the canvas memory
function handleTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        templateData[activeTemplateType].bgImage.onload = () => {
            renderTemplatePreview();
        };
        templateData[activeTemplateType].bgImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// The core rendering engine for the preview
function renderTemplatePreview() {
    const canvas = document.getElementById('template-canvas');
    const ctx = canvas.getContext('2d');
    const config = templateData[activeTemplateType];

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Background Image (if uploaded)
    if (config.bgImage.src) {
        ctx.drawImage(config.bgImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback placeholder pattern
        ctx.fillStyle = "#E2E8F0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#94A3B8";
        ctx.font = "bold 40px Inter";
        ctx.textAlign = "center";
        ctx.fillText("NO BACKGROUND UPLOADED", canvas.width / 2, canvas.height / 2);
    }

    // 2. Draw Text Overlays based on coords
    ctx.textAlign = "left";
    
    for (const [fieldKey, coords] of Object.entries(config.coords)) {
        // Highlight the text if it is the actively selected field
        if (activeInputField === fieldKey) {
            ctx.fillStyle = "#E11D48"; // Danger Red to show it's active
            ctx.font = "bold 48px Inter";
        } else {
            ctx.fillStyle = "#0F172A"; // Default dark
            ctx.font = "bold 40px Inter";
        }

        const mockText = previewMockData[fieldKey] || fieldKey;
        ctx.fillText(mockText, coords.x, coords.y);
    }
}

// Magical Click-to-Position Logic
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('template-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', function(e) {
        if (!activeInputField) {
            showToast("Click an input field on the left first to map coordinates!", "error");
            return;
        }

        // Calculate accurate X/Y scaled from the visual CSS size to the internal 1080x1080 size
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const actualX = Math.round((e.clientX - rect.left) * scaleX);
        const actualY = Math.round((e.clientY - rect.top) * scaleY);

        // Update Inputs
        document.getElementById(`x-${activeInputField}`).value = actualX;
        document.getElementById(`y-${activeInputField}`).value = actualY;

        // Update State
        templateData[activeTemplateType].coords[activeInputField] = { x: actualX, y: actualY };
        
        // Re-render
        renderTemplatePreview();
    });
});

async function saveTemplateConfig() {
    setLoading('template-type-select', true); // generic loading indicator
    showToast("Saving template parameters...", "success");
    
    // Structure the payload
    const payload = {
        type: activeTemplateType,
        coordinates: templateData[activeTemplateType].coords
    };

    try {
        /*
         * SUPABASE INTEGRATION:
         * To make this fully functional on Live Results, save it to a Supabase table named 'settings'
         * with columns: id (string, PK), value (jsonb)
         */
         
         const { error } = await supabaseClient.from('settings')
            .upsert({ id: `template_${activeTemplateType}`, value: payload });
            
         if (error) throw error;
         
         showToast("Template Coordinates Saved Successfully!");
    } catch(e) {
        // Fallback for if table doesn't exist yet
        console.warn("Table 'settings' might not exist yet. Payload:", payload);
        showToast("Configurations mapped locally! (Set up Supabase 'settings' table to persist)", "success");
    } finally {
        setLoading('template-type-select', false);
    }
}

// ============================================================================
// POSTER TEMPLATE ENGINE V6 (Layers Panel, Drag-and-Drop, Corner Radius)
// ============================================================================

let savedTemplates = []; 
let studioActiveData = null; 
let studioActiveField = null; 
let multiSelectedLayers = new Set();
let dragStartPositions = {};
let currentLibraryFilter = 'all';

// DRAG & RESIZE STATE
let isDraggingLayer = false;
let isResizingLayer = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
let resizeStartX = 0;
let resizeStartY = 0;

const TEMPLATE_SCHEMAS = {
    individual: ['Result Number', 'Category', 'Competition', 'Position 1 Name', 'Position 1 Team', 'Position 1 Photo', 'Position 1 Number', 'Position 2 Name', 'Position 2 Team', 'Position 2 Photo', 'Position 2 Number', 'Position 3 Name', 'Position 3 Team', 'Position 3 Photo', 'Position 3 Number'],
    team: ['Results Count Text', 'Rank 1 Team', 'Rank 1 Points', 'Rank 1 Number', 'Rank 2 Team', 'Rank 2 Points', 'Rank 2 Number', 'Rank 3 Team', 'Rank 3 Points', 'Rank 3 Number', 'Rank 4 Team', 'Rank 4 Points', 'Rank 4 Number', 'Rank 5 Team', 'Rank 5 Points', 'Rank 5 Number', 'Rank 6 Team', 'Rank 6 Points', 'Rank 6 Number', 'Rank 7 Team', 'Rank 7 Points', 'Rank 7 Number', 'Rank 8 Team', 'Rank 8 Points', 'Rank 8 Number', 'Rank 9 Team', 'Rank 9 Points', 'Rank 9 Number', 'Rank 10 Team', 'Rank 10 Points', 'Rank 10 Number'],
    final: ['Total Competitions Count', 'Rank 1 Team', 'Rank 1 Points', 'Rank 1 Number', 'Rank 2 Team', 'Rank 2 Points', 'Rank 2 Number', 'Rank 3 Team', 'Rank 3 Points', 'Rank 3 Number', 'Rank 4 Team', 'Rank 4 Points', 'Rank 4 Number', 'Rank 5 Team', 'Rank 5 Points', 'Rank 5 Number', 'Rank 6 Team', 'Rank 6 Points', 'Rank 6 Number', 'Rank 7 Team', 'Rank 7 Points', 'Rank 7 Number', 'Rank 8 Team', 'Rank 8 Points', 'Rank 8 Number', 'Rank 9 Team', 'Rank 9 Points', 'Rank 9 Number', 'Rank 10 Team', 'Rank 10 Points', 'Rank 10 Number'],
    id_card: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Date of Birth', 'Photo', 'QR Code'],
    certificate: ['Participant Name', 'Unique ID', 'Team Name', 'Category', 'Competition', 'Position', 'Grade', 'Issue Date', 'QR Code']
};

const STUDIO_MOCK_DATA = {
    'ResultNumber': '#42', 'Category': 'GENERAL', 'Competition': 'DANCE OFF',
    'Position1Name': 'JOHN DOE', 'Position1Team': 'FALCONS', 'Position1Number': '1',
    'Position2Name': 'JANE SMITH', 'Position2Team': 'EAGLES', 'Position2Number': '2',
    'Position3Name': 'MIKE TYSON', 'Position3Team': 'HAWKS', 'Position3Number': '3',
    'ResultsCountText': 'AFTER 40',
    'TotalCompetitionsCount': 'FINAL OVERALL', 
    'Rank1Team': 'FALCONS', 'Rank1Points': '450', 'Rank1Number': '1',
    'Rank2Team': 'EAGLES', 'Rank2Points': '380', 'Rank2Number': '2',
    'Rank3Team': 'HAWKS', 'Rank3Points': '310', 'Rank3Number': '3',
    'Rank4Team': 'TIGERS', 'Rank4Points': '280', 'Rank4Number': '4',
    'Rank5Team': 'LIONS', 'Rank5Points': '250', 'Rank5Number': '5',
    'Rank6Team': 'PANTHERS', 'Rank6Points': '220', 'Rank6Number': '6',
    'Rank7Team': 'WOLVES', 'Rank7Points': '190', 'Rank7Number': '7',
    'Rank8Team': 'BEARS', 'Rank8Points': '150', 'Rank8Number': '8',
    'Rank9Team': 'SHARKS', 'Rank9Points': '120', 'Rank9Number': '9',
    'Rank10Team': 'COBRAS', 'Rank10Points': '90', 'Rank10Number': '10',
    'ParticipantName': 'JOHN DOE', 'UniqueID': 'FEST-26-987654', 'BatchNo': 'BATCH 1',
    'Position': 'FIRST PLACE', 'Grade': 'A+ GRADE', 'IssueDate': new Date().toLocaleDateString()
};

const AVAILABLE_FONTS = [
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Bebas Neue', value: "'Bebas Neue', cursive" },
    { name: 'Serif', value: "'Times New Roman', Times, serif" }
];

// --- 1. LIBRARY INIT ---
async function loadTemplatesList() {
    showToast("Syncing templates from cloud...", "success");
    // Fetch directly from Supabase
    const { data: templates, error } = await supabaseClient
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Template Sync Error:", error);
        showToast("Failed to load templates", "error");
        savedTemplates = [];
    } else {
        savedTemplates = templates || [];
    }
    
    renderTemplateLibrary();
}

function filterTemplateLibrary(type) {
    currentLibraryFilter = type;
    document.querySelectorAll('#template-library-view .controls-bar button').forEach(btn => {
        btn.classList.remove('active-filter-btn');
        btn.style.background = 'transparent'; btn.style.color = 'var(--text-main)'; btn.style.borderColor = 'var(--border)';
    });
    
    const activeBtn = document.getElementById(`filter-${type}`);
    if (activeBtn) {
        activeBtn.classList.add('active-filter-btn');
        activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'white'; activeBtn.style.borderColor = 'var(--primary)';
    }
    renderTemplateLibrary();
}

function renderTemplateLibrary() {
    const grid = document.getElementById('saved-templates-grid');
    grid.innerHTML = '';
    const filtered = currentLibraryFilter === 'all' ? savedTemplates : savedTemplates.filter(t => t.type === currentLibraryFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-muted); background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border);">No templates found.</div>`;
        return;
    }

    filtered.forEach((tpl) => {
        const trueIndex = savedTemplates.findIndex(t => t.id === tpl.id);
        let tag = tpl.type === 'id_card' ? 'ID Card' : tpl.type === 'team' ? 'Team' : tpl.type === 'final' ? 'Final' : 'Individual';

        grid.innerHTML += `
            <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
                <div style="height: 180px; background: #E2E8F0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
${tpl.bg_base64 ? `<img src="${tpl.bg_base64}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fa-solid fa-image" style="font-size: 3rem; color: #CBD5E1;"></i>`}                    <div style="position: absolute; top: 10px; right: 10px; background: rgba(79, 70, 229, 0.9); color: white; padding: 0.3rem 0.75rem; border-radius: 50px; font-size: 0.7rem; font-weight: 700;">${tag}</div>
                </div>
                <div style="padding: 1.5rem;">
                    <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.25rem;">${tpl.name}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">${Object.keys(tpl.fields).filter(k => tpl.fields[k].enabled).length} Active Fields</p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="flex: 1;" onclick="editTemplate(${trueIndex})">Edit</button>
                        <button class="btn btn-outline" style="padding: 0.5rem 1rem; color: var(--danger); border-color: var(--danger);" onclick="deleteTemplate(${trueIndex})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}



function openTemplateStudio(template = null) {
    document.getElementById('template-library-view').style.display = 'none';
    document.getElementById('template-studio-view').style.display = 'block';

    if (template) {
        studioActiveData = JSON.parse(JSON.stringify(template)); 
        document.getElementById('studio-template-name').value = studioActiveData.name;
        document.getElementById('studio-template-type').value = studioActiveData.type;
        
        // HIDDEN GROUPS WORKAROUND: Extract the hidden groups object from fields
        if (studioActiveData.fields && studioActiveData.fields['__groups__']) {
            studioActiveData.groups = studioActiveData.fields['__groups__'];
            delete studioActiveData.fields['__groups__']; // Remove it so the canvas doesn't try to draw it
        } else {
            studioActiveData.groups = {};
        }
        
        // Rehydrate main background image
        studioActiveData.imgObj = new Image();
        studioActiveData.imgObj.crossOrigin = "Anonymous"; 
        studioActiveData.imgObj.onload = () => drawStudioCanvas();
        if (studioActiveData.bg_base64) studioActiveData.imgObj.src = studioActiveData.bg_base64;

        // Rehydrate static uploaded elements
        if (studioActiveData.fields) {
            Object.keys(studioActiveData.fields).forEach(key => {
                const field = studioActiveData.fields[key];
                if (field.isStaticElement && field.src) {
                    field.imgObj = new Image();
                    field.imgObj.crossOrigin = "Anonymous";
                    field.imgObj.onload = () => drawStudioCanvas();
                    field.imgObj.src = field.src;
                }
            });
        }

        // Rehydrate Custom Fonts
        if (studioActiveData.customFonts && studioActiveData.customFonts.length > 0) {
            studioActiveData.customFonts.forEach(async (fontData) => {
                if (!AVAILABLE_FONTS.find(f => f.value === fontData.family)) {
                    try {
                        const customFont = new FontFace(fontData.family, `url(${fontData.url})`);
                        const loadedFace = await customFont.load();
                        document.fonts.add(loadedFace);
                        
                        AVAILABLE_FONTS.push({ name: fontData.name, value: fontData.family });
                        drawStudioCanvas(); 
                    } catch (e) {
                        console.error("Failed to rehydrate custom font:", fontData.family, e);
                    }
                }
            });
        }
    } else {
        // Initialize a brand new template
        studioActiveData = { 
            id: 'TPL_' + Date.now(), 
            name: '', 
            type: 'individual', 
            bg_base64: null, 
            imgObj: new Image(), 
            fields: {},
            groups: {}, 
            customFonts: [] 
        };
        
        studioActiveData.imgObj.crossOrigin = "Anonymous";
        
        document.getElementById('studio-template-name').value = '';
        document.getElementById('studio-template-type').value = 'individual';
    }
    
    if (typeof multiSelectedLayers !== 'undefined') multiSelectedLayers.clear();
    studioActiveField = null;
    
    // Reset History Stacks
    undoStack = [];
    redoStack = [];
    updateHistoryButtons();
    
    initializeStudioFields();
}

function closeTemplateStudio() {
    document.getElementById('template-studio-view').style.display = 'none';
    document.getElementById('template-library-view').style.display = 'block';
    loadTemplatesList(); 
}




function toggleLayerVisibility(event, key) {
    event.stopPropagation(); // Prevent layer selection click
    studioActiveData.fields[key].enabled = !studioActiveData.fields[key].enabled;
    if (!studioActiveData.fields[key].enabled && studioActiveField === key) {
        studioActiveField = null;
        renderPropertiesPanel();
    }
    renderLayersPanel();
    drawStudioCanvas();
}



let historyTimeout = null;


// --- LAYER MANAGEMENT & GROUPING ENGINE ---
function groupSelected() {
    if (multiSelectedLayers.size < 2) return;
    saveHistoryState();
    const groupId = 'GRP_' + Date.now();
    if (!studioActiveData.groups) studioActiveData.groups = {};
    studioActiveData.groups[groupId] = { name: 'New Group', expanded: true };
    multiSelectedLayers.forEach(k => { studioActiveData.fields[k].groupId = groupId; });
    showToast("Layers Grouped!", "success");
    renderLayersPanel();
    renderPropertiesPanel();
}

function ungroupSelected() {
    saveHistoryState();
    const keys = Array.from(multiSelectedLayers);
    const groupId = studioActiveData.fields[keys[0]].groupId;
    if(groupId && studioActiveData.groups) delete studioActiveData.groups[groupId];
    multiSelectedLayers.forEach(k => { studioActiveData.fields[k].groupId = null; });
    showToast("Layers Ungrouped!", "success");
    renderLayersPanel();
    renderPropertiesPanel();
}

function selectStudioGroup(groupId) {
    multiSelectedLayers.clear();
    Object.keys(studioActiveData.fields).forEach(k => {
        if (studioActiveData.fields[k].groupId === groupId) multiSelectedLayers.add(k);
    });
    studioActiveField = null; 
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function toggleGroupExpand(e, groupId) {
    e.stopPropagation();
    if (studioActiveData.groups && studioActiveData.groups[groupId]) {
        studioActiveData.groups[groupId].expanded = !studioActiveData.groups[groupId].expanded;
        renderLayersPanel();
    }
}


function renderLayersPanel() {
    const container = document.getElementById('studio-layers-panel');
    container.innerHTML = '';
    if (!studioActiveData.groups) studioActiveData.groups = {};

    const processedGroups = new Set();
    const keys = Object.keys(studioActiveData.fields).reverse(); 
    
    keys.forEach(key => {
        const data = studioActiveData.fields[key];
        const groupId = data.groupId;

        if (groupId) {
            if (!processedGroups.has(groupId)) {
                processedGroups.add(groupId);
                const groupMeta = studioActiveData.groups[groupId] || { name: 'Group', expanded: true };
                
                const groupKeys = Object.keys(studioActiveData.fields).filter(k => studioActiveData.fields[k].groupId === groupId);
                const isGroupSelected = groupKeys.every(k => multiSelectedLayers.has(k)) && groupKeys.length > 0;
                
                // LIGHT THEME COLORS FOR GROUP FOLDER
                const bgColor = isGroupSelected ? 'var(--primary-light)' : '#FFFFFF';
                const textColor = isGroupSelected ? 'var(--primary)' : '#0F172A';
                const iconColor = isGroupSelected ? 'var(--primary)' : '#64748B';
                
                container.innerHTML += `
                    <div style="display: flex; flex-direction: row-reverse; align-items: center; justify-content: flex-end; padding: 0.85rem 1rem; background: ${bgColor}; border: 1px solid ${isGroupSelected ? 'var(--primary)' : '#E5E7EB'}; margin-bottom: 2px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onclick="selectStudioGroup('${groupId}')">
                        <div style="flex: 1; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center;">
                            <button style="background:none; border:none; color: ${iconColor}; cursor:pointer; font-size:1.15rem; padding: 0 0.5rem;" onclick="toggleGroupExpand(event, '${groupId}')">
                                <i class="fa-solid fa-chevron-${groupMeta.expanded ? 'down' : 'right'}"></i>
                            </button>
                            <span style="font-weight: 800; font-size: 0.95rem; color: ${textColor}; text-transform: uppercase;">${groupMeta.name}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-right: 1rem; text-align: center;">
                            <i class="fa-solid fa-folder" style="color: ${iconColor}; font-size: 1.1rem;"></i>
                        </div>
                    </div>
                `;

                // Render Children indented if expanded
                if (groupMeta.expanded) {
                    groupKeys.reverse().forEach(childKey => {
                        renderSingleLayerRow(container, childKey, studioActiveData.fields[childKey], true);
                    });
                }
            }
        } else {
            renderSingleLayerRow(container, key, data, false);
        }
    });
}

function renderSingleLayerRow(container, key, data, isChild) {
    const isActiveLayer = multiSelectedLayers.has(key) || studioActiveField === key;
    
    // LIGHT THEME COLORS FOR LAYERS
    const bgColor = isActiveLayer ? 'var(--primary-light)' : '#FFFFFF';
    const textColor = isActiveLayer ? 'var(--primary)' : '#0F172A';
    const iconColor = isActiveLayer ? 'var(--primary)' : '#64748B';
    const eyeColor = isActiveLayer ? 'var(--primary)' : (data.enabled ? '#0F172A' : '#CBD5E1');

    const lockColor = data.locked ? '#EF4444' : iconColor;
    const lockIcon = data.locked ? 'fa-lock' : 'fa-unlock';
    
    // Visually indent layers if they are inside a folder
    const indentStyles = isChild ? 'margin-left: 24px; border-left: 3px solid #E5E7EB; border-top-left-radius: 0; border-bottom-left-radius: 0;' : '';
    
    container.innerHTML += `
        <div style="display: flex; flex-direction: row-reverse; align-items: center; justify-content: flex-end; padding: 0.85rem 1rem; background: ${bgColor}; border: 1px solid ${isActiveLayer ? 'var(--primary)' : '#E5E7EB'}; margin-bottom: 2px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); ${indentStyles}" onclick="selectStudioLayer('${key}')">
            <div style="flex: 1; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center;">
                <button style="background:none; border:none; color: ${eyeColor}; cursor:pointer; font-size:1.15rem;" onclick="toggleLayerVisibility(event, '${key}')">
                    <i class="fa-solid ${data.enabled ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button style="background:none; border:none; color: ${lockColor}; cursor:pointer; font-size:1rem;" onclick="toggleLayerLock(event, '${key}')">
                    <i class="fa-solid ${lockIcon}"></i>
                </button>
                <span style="font-weight: 600; font-size: 0.95rem; color: ${textColor};">${data.displayName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-right: 1rem; text-align: center;">
                <i class="fa-solid ${data.isImage ? 'fa-image' : 'fa-t'}" style="color: ${iconColor}; font-size: 1.1rem;"></i>
                <input type="checkbox" ${isActiveLayer ? 'checked' : ''} onclick="toggleMultiSelect(event, '${key}')" style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;">
            </div>
        </div>
    `;
}

function updateActiveProperty(prop, value) {
    if (multiSelectedLayers.size > 0) {
        if (!historyTimeout && !isRestoringHistory) saveHistoryState();
        clearTimeout(historyTimeout);
        historyTimeout = setTimeout(() => { historyTimeout = null; }, 800);

        const isNum = ['x','y','w','h','size','radius'].includes(prop);
        const val = isNum ? (parseInt(value) || 0) : value;

        // Group Renaming Logic
        if (prop === 'groupName') {
            const keys = Array.from(multiSelectedLayers);
            const groupId = studioActiveData.fields[keys[0]].groupId;
            if (groupId && studioActiveData.groups[groupId]) {
                studioActiveData.groups[groupId].name = val;
            }
            renderLayersPanel();
            return;
        }

        // Apply edits to all valid selected layers (Group Bulk Edit)
        multiSelectedLayers.forEach(key => {
            const data = studioActiveData.fields[key];
            if (data.locked) return;

            if (data.isImage && ['size', 'color', 'font', 'weight', 'align'].includes(prop)) return; // Skip text edits on images
            if (!data.isImage && ['w', 'h', 'radius'].includes(prop)) return; // Skip image edits on text

            if (prop === 'w' && data.aspectLocked && data.aspectRatio) {
                data.w = val; data.h = Math.round(val / data.aspectRatio);
            } else if (prop === 'h' && data.aspectLocked && data.aspectRatio) {
                data.h = val; data.w = Math.round(val * data.aspectRatio);
            } else {
                data[prop] = val;
            }
            if (!data.aspectLocked && (prop === 'w' || prop === 'h')) {
                if (data.w > 0 && data.h > 0) data.aspectRatio = data.w / data.h;
            }
        });

        drawStudioCanvas();
        return;
    }
}

function renderPropertiesPanel() {
    const container = document.getElementById('studio-properties-panel');
    const studioView = document.getElementById('template-studio-view');
    
    if (typeof multiSelectedLayers === 'undefined' || multiSelectedLayers.size === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">Select a layer to edit.</p>`;
        if (studioView) { studioView.classList.remove('layer-active'); studioView.classList.add('layer-empty'); }
        return;
    }

    if (studioView) { studioView.classList.add('layer-active'); studioView.classList.remove('layer-empty'); }

    // --- MULTI-SELECT & GROUP BULK EDIT VIEW ---
    if (multiSelectedLayers.size > 1) {
        const keys = Array.from(multiSelectedLayers);
        const groupId = studioActiveData.fields[keys[0]].groupId;
        const isFormalGroup = keys.every(k => studioActiveData.fields[k].groupId && studioActiveData.fields[k].groupId === groupId);
        
        let groupNameInput = '';
        let groupTitle = `${keys.length} Layers Selected`;

        if (isFormalGroup && studioActiveData.groups[groupId]) {
            groupTitle = `Group Selected`;
            groupNameInput = `
                <div style="grid-column: span 2; margin-bottom: 1.25rem;">
                    <label style="font-size: 0.75rem; font-weight:700;">GROUP NAME</label>
                    <input type="text" value="${studioActiveData.groups[groupId].name}" oninput="updateActiveProperty('groupName', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                </div>
            `;
        }

        // Grab placeholder data from the first text element in the group to populate the fields
        let commonColor = '#ffffff', commonSize = 40, commonFont = 'Inter, sans-serif', commonWeight = 'bold', commonAlign = 'left';
        const firstTextKey = keys.find(k => !studioActiveData.fields[k].isImage);
        if (firstTextKey) {
            const fd = studioActiveData.fields[firstTextKey];
            commonColor = fd.color; commonSize = fd.size; commonFont = fd.font; commonWeight = fd.weight; commonAlign = fd.align;
        }
        const fonts = AVAILABLE_FONTS.map(f => `<option value="${f.value}" ${commonFont === f.value ? 'selected' : ''}>${f.name}</option>`).join('');

        container.innerHTML = `
            <div class="mobile-properties-header" style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px dashed #334155; padding-bottom: 0.85rem; gap: 0.75rem;">
                <button class="btn btn-outline mobile-back-btn" style="padding: 0.4rem 0.6rem; border-radius: 8px; border: none; background: #334155; color: white; display: none;" onclick="multiSelectedLayers.clear(); studioActiveField = null; renderLayersPanel(); renderPropertiesPanel(); drawStudioCanvas();"><i class="fa-solid fa-arrow-left"></i></button>
                <h4 style="color: white; font-size: 1.15rem; font-weight: 800; margin: 0;">${groupTitle}</h4>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                ${groupNameInput}
                <div><label style="font-size: 0.75rem; font-weight:700;">NUDGE X</label><input type="number" value="0" onchange="shiftSelected('x', this.value); this.value=0;" placeholder="0" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; text-align: center;"></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">NUDGE Y</label><input type="number" value="0" onchange="shiftSelected('y', this.value); this.value=0;" placeholder="0" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; text-align: center;"></div>
                
                <div><label style="font-size: 0.75rem; font-weight:700;">FONT SIZE</label><input type="number" value="${commonSize}" oninput="updateActiveProperty('size', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">COLOR</label><input type="color" value="${commonColor}" oninput="updateActiveProperty('color', this.value)" style="width: 100%; height: 35px; border: 1px solid var(--border); border-radius: 4px; padding:0;"></div>
                <div style="grid-column: span 2;"><label style="font-size: 0.75rem; font-weight:700;">FONT FAMILY</label><select onchange="updateActiveProperty('font', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">${fonts}</select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">WEIGHT</label><select onchange="updateActiveProperty('weight', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"><option value="normal" ${commonWeight==='normal'?'selected':''}>Normal</option><option value="bold" ${commonWeight==='bold'?'selected':''}>Bold</option><option value="900" ${commonWeight==='900'?'selected':''}>Black</option></select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">ALIGN</label><select onchange="updateActiveProperty('align', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;"><option value="left" ${commonAlign==='left'?'selected':''}>Left</option><option value="center" ${commonAlign==='center'?'selected':''}>Center</option><option value="right" ${commonAlign==='right'?'selected':''}>Right</option></select></div>
            </div>

            <label style="color: #94A3B8; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.5rem; display: block;">ALIGNMENT TOOLS</label>
            <div style="display: flex; background: #1E293B; border-radius: 8px; padding: 0.25rem; gap: 0.25rem; margin-bottom: 1rem; border: 1px solid #334155;">
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('left')"><i class="fa-solid fa-align-left" style="font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('center')"><i class="fa-solid fa-align-center" style="font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('right')"><i class="fa-solid fa-align-right" style="font-size: 1.1rem; margin:0;"></i></button>
                <div style="width: 1px; background: #334155; margin: 0.25rem 0;"></div>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('top')"><i class="fa-solid fa-object-group" style="transform: rotate(180deg); font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('middle')"><i class="fa-solid fa-arrows-up-down" style="font-size: 1.1rem; margin:0;"></i></button>
                <button class="btn btn-outline" style="flex:1; border:none; background:transparent; padding: 0.6rem 0; color: #E2E8F0;" onclick="alignSelected('bottom')"><i class="fa-solid fa-object-group" style="font-size: 1.1rem; margin:0;"></i></button>
            </div>
            
            <div class="group-action-row" style="display: flex; width: 100%;">
                <button class="btn ${isFormalGroup ? 'btn-danger' : 'btn-success'}" style="flex: 1; padding: 0.75rem; border-radius: 8px; font-weight: 700;" onclick="${isFormalGroup ? 'ungroupSelected()' : 'groupSelected()'}">
                    <i class="fa-solid ${isFormalGroup ? 'fa-object-ungroup' : 'fa-object-group'}"></i> ${isFormalGroup ? 'Ungroup Selection' : 'Group Selected Layers'}
                </button>
            </div>
        `;
        return;
    }

    // --- STANDARD SINGLE LAYER VIEW ---
    const key = studioActiveField;
    if (!key || !studioActiveData.fields[key]) return;
    
    // [The rest of the standard single layer view remains identical to your current admin_2.js implementation]
    const data = studioActiveData.fields[key];
    const fonts = AVAILABLE_FONTS.map(f => `<option value="${f.value}" ${data.font === f.value ? 'selected' : ''}>${f.name}</option>`).join('');

    let specificHTML = '';
    if (data.isImage) {
        const lockIcon = data.aspectLocked ? 'fa-lock' : 'fa-lock-open';
        const deleteBtn = data.isStaticElement ? `<button class="btn btn-outline" style="grid-column: span 3; border-color: var(--danger); color: var(--danger); margin-top: 0.5rem;" onclick="deleteStudioLayer('${key}')"><i class="fa-solid fa-trash"></i> Delete Element</button>` : '';

        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; margin-top: 1rem; align-items: end;">
                <div><label style="font-size: 0.75rem; font-weight:700;">WIDTH</label><input type="number" id="prop-w" value="${data.w}" oninput="updateActiveProperty('w', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                <button class="btn btn-outline" style="padding: 0.5rem; height: 35px; width: 35px; display: flex; justify-content: center; align-items: center;" onclick="toggleAspectRatioLock('${key}')" title="Toggle Aspect Ratio Lock"><i class="fa-solid ${lockIcon}"></i></button>
                <div><label style="font-size: 0.75rem; font-weight:700;">HEIGHT</label><input type="number" id="prop-h" value="${data.h}" oninput="updateActiveProperty('h', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                <div style="grid-column: span 3;"><label style="font-size: 0.75rem; font-weight:700;">CORNER RADIUS</label><input type="number" id="prop-rad" value="${data.radius || 0}" oninput="updateActiveProperty('radius', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                ${deleteBtn}
            </div>
        `;
    } else {
        let customTextHTML = '';
        if (data.isCustom) {
            customTextHTML = `
                <div style="grid-column: span 2;">
                    <label style="font-size: 0.75rem; font-weight:700;">TEXT CONTENT</label>
                    <input type="text" value="${data.displayName}" oninput="updateActiveProperty('displayName', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}>
                </div>
            `;
        }
        const deleteBtn = data.isCustom ? `<button class="btn btn-outline" style="grid-column: span 2; border-color: var(--danger); color: var(--danger); margin-top: 0.5rem;" onclick="deleteStudioLayer('${key}')"><i class="fa-solid fa-trash"></i> Delete Layer</button>` : '';

        specificHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
                ${customTextHTML}
                <div><label style="font-size: 0.75rem; font-weight:700;">FONT SIZE</label><input type="number" id="prop-sz" value="${data.size}" oninput="updateActiveProperty('size', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">COLOR</label><input type="color" id="prop-cl" value="${data.color}" oninput="updateActiveProperty('color', this.value)" style="width: 100%; height: 35px; border: 1px solid var(--border); border-radius: 4px; padding:0;" ${data.locked ? 'disabled' : ''}></div>
                <div style="grid-column: span 2;"><label style="font-size: 0.75rem; font-weight:700;">FONT FAMILY</label><select onchange="updateActiveProperty('font', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}>${fonts}</select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">WEIGHT</label><select onchange="updateActiveProperty('weight', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}><option value="normal" ${data.weight==='normal'?'selected':''}>Normal</option><option value="bold" ${data.weight==='bold'?'selected':''}>Bold</option><option value="900" ${data.weight==='900'?'selected':''}>Black</option></select></div>
                <div><label style="font-size: 0.75rem; font-weight:700;">ALIGN</label><select onchange="updateActiveProperty('align', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}><option value="left" ${data.align==='left'?'selected':''}>Left</option><option value="center" ${data.align==='center'?'selected':''}>Center</option><option value="right" ${data.align==='right'?'selected':''}>Right</option></select></div>
                ${deleteBtn}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="mobile-properties-header" style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px dashed #334155; padding-bottom: 0.85rem; gap: 0.75rem;">
            <button class="btn btn-outline mobile-back-btn" style="padding: 0.4rem 0.6rem; border-radius: 8px; border: none; background: #334155; color: white; display: none;" onclick="multiSelectedLayers.clear(); studioActiveField = null; renderLayersPanel(); renderPropertiesPanel(); drawStudioCanvas();"><i class="fa-solid fa-arrow-left"></i></button>
            <h4 style="color: white; font-size: 1.15rem; font-weight: 800; margin: 0; text-transform: uppercase;">${data.displayName} ${data.locked ? '<i class="fa-solid fa-lock" style="color:#EF4444; font-size: 0.8rem; margin-left: 5px;"></i>' : ''}</h4>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div><label style="font-size: 0.75rem; font-weight:700;">X POS</label><input type="number" id="prop-x" value="${data.x}" oninput="updateActiveProperty('x', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
            <div><label style="font-size: 0.75rem; font-weight:700;">Y POS</label><input type="number" id="prop-y" value="${data.y}" oninput="updateActiveProperty('y', this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" ${data.locked ? 'disabled' : ''}></div>
        </div>
        ${specificHTML}
    `;
}

function handleStudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    studioActiveData.pendingFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        studioActiveData.bg_base64 = e.target.result; 
        studioActiveData.imgObj = new Image();
        
        // ADD THIS LINE:
        studioActiveData.imgObj.crossOrigin = "Anonymous";
        
        studioActiveData.imgObj.onload = () => drawStudioCanvas();
        studioActiveData.imgObj.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
function initializeStudioFields() {
    const type = document.getElementById('studio-template-type').value;
    studioActiveData.type = type;
    const requiredFields = TEMPLATE_SCHEMAS[type];
    
    const validKeys = new Set();

    // 1. Build Data Defaults for the selected Template Sector
    requiredFields.forEach(field => {
        const key = field.replace(/\s+/g, '');
        validKeys.add(key);
        const isImage = (key.includes('Photo') || key === 'QRCode');        
        
        if (!studioActiveData.fields[key]) {
            if (isImage) {
                studioActiveData.fields[key] = { 
                    enabled: false, x: 100, y: 150, w: 250, h: 300, radius: 20, 
                    isImage: true, aspectLocked: true, aspectRatio: 250 / 300,
                    locked: false, groupId: null
                };
            } else {
                studioActiveData.fields[key] = { 
                    enabled: false, x: 100, y: 150, size: 40, color: '#0F172A', 
                    align: 'left', font: 'Inter, sans-serif', weight: 'bold', isImage: false,
                    locked: false, groupId: null
                };
            }
        }
        studioActiveData.fields[key].displayName = field;
    });

    // 2. Dynamic Purging: Remove layers that don't belong to this sector (but KEEP custom layers)
    Object.keys(studioActiveData.fields).forEach(key => {
        const f = studioActiveData.fields[key];
        if (f.isCustom || f.isStaticElement) {
            validKeys.add(key); // Protect custom uploads and texts
        }
        
        if (!validKeys.has(key)) {
            delete studioActiveData.fields[key]; // Purge irrelevant layers
        }
    });

    // If the currently selected layer was just purged, unselect it
    if (studioActiveField && !studioActiveData.fields[studioActiveField]) {
        studioActiveField = null;
    }

    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

// NEW: Add a Custom Text Layer
function addCustomTextLayer() {
    const key = 'CustomText_' + Date.now();
    studioActiveData.fields[key] = {
        enabled: true,
        displayName: "New Custom Text", // Used as the actual text content
        x: 200,
        y: 200,
        size: 60,
        color: '#0F172A',
        align: 'center',
        font: 'Inter, sans-serif',
        weight: 'bold',
        isImage: false,
        isCustom: true, // Flags it so it isn't deleted during sector switches
        locked: false,  // Enables the lock/unlock toggle
        groupId: null   // Enables multi-select grouping
    };

    saveHistoryState();
    renderLayersPanel();
    selectStudioLayer(key);
}




function toggleLayerLock(event, key) {
    event.stopPropagation();
    saveHistoryState();
    studioActiveData.fields[key].locked = !studioActiveData.fields[key].locked;
    renderLayersPanel();
}

function toggleMultiSelect(event, key) {
    event.stopPropagation();
    if (multiSelectedLayers.has(key)) {
        multiSelectedLayers.delete(key);
    } else {
        multiSelectedLayers.add(key);
    }
    studioActiveField = multiSelectedLayers.size > 0 ? Array.from(multiSelectedLayers).pop() : null;
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function selectStudioLayer(key) {
    // Standard click clears multi-select unless it belongs to a group
    multiSelectedLayers.clear();
    
    const hitGroup = studioActiveData.fields[key].groupId;
    if (hitGroup) {
        Object.keys(studioActiveData.fields).forEach(k => {
            if (studioActiveData.fields[k].groupId === hitGroup) multiSelectedLayers.add(k);
        });
    } else {
        multiSelectedLayers.add(key);
    }
    
    studioActiveField = key;
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
}

function alignSelected(type) {
    if (multiSelectedLayers.size < 2) return;
    saveHistoryState();
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const layers = Array.from(multiSelectedLayers).map(k => studioActiveData.fields[k]);
    
    // Calculate Bounding Box
    layers.forEach(data => {
        let w = data.w || 0;
        let h = data.h || data.size || 0;
        if (!data.isImage && data.align === 'center') { minX = Math.min(minX, data.x - w/2); maxX = Math.max(maxX, data.x + w/2); }
        else { minX = Math.min(minX, data.x); maxX = Math.max(maxX, data.x + w); }
        minY = Math.min(minY, data.y - (data.isImage ? 0 : h));
        maxY = Math.max(maxY, data.y + (data.isImage ? h : 0));
    });

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    layers.forEach(data => {
        if(data.locked) return;
        let w = data.w || 0; let h = data.h || data.size || 0;

        if (type === 'left') data.x = data.isImage || data.align !== 'center' ? minX : minX + w/2;
        if (type === 'right') data.x = data.isImage || data.align !== 'center' ? maxX - w : maxX - w/2;
        if (type === 'center') data.x = data.isImage || data.align !== 'center' ? centerX - w/2 : centerX;
        if (type === 'top') data.y = data.isImage ? minY : minY + h;
        if (type === 'bottom') data.y = data.isImage ? maxY - h : maxY;
        if (type === 'middle') data.y = data.isImage ? centerY - h/2 : centerY + h/2;
    });
    
    drawStudioCanvas();
    renderPropertiesPanel();
}



// NEW: Shifts all selected layers precisely
function shiftSelected(axis, val) {
    const shiftAmount = parseInt(val) || 0;
    if (shiftAmount === 0) return;
    saveHistoryState();
    multiSelectedLayers.forEach(k => {
        if (!studioActiveData.fields[k].locked) {
            studioActiveData.fields[k][axis] += shiftAmount;
        }
    });
    drawStudioCanvas();
    // Do not re-render properties panel so the input stays in focus
}



function drawStudioCanvas() {
    const canvas = document.getElementById('studio-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (studioActiveData.imgObj && studioActiveData.imgObj.src && studioActiveData.imgObj.naturalWidth > 0) {
        canvas.width = studioActiveData.imgObj.naturalWidth; canvas.height = studioActiveData.imgObj.naturalHeight;
        ctx.drawImage(studioActiveData.imgObj, 0, 0);
    } else {
        canvas.width = 1080; canvas.height = 1080;
        ctx.fillStyle = "#F1F5F9"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#94A3B8"; ctx.font = "bold 40px Inter"; ctx.textAlign = "center";
        ctx.fillText("UPLOAD A BACKGROUND IMAGE", canvas.width / 2, canvas.height / 2);
    }

    for (const [key, data] of Object.entries(studioActiveData.fields)) {
        if (!data.enabled) continue; 

        if (data.isImage) {
            if (data.isStaticElement) {
                if (data.imgObj && data.imgObj.src) {
                    ctx.drawImage(data.imgObj, data.x, data.y, data.w, data.h);
                }
                if (studioActiveField === key) {
                    ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 4; ctx.setLineDash([10, 5]);
                    ctx.strokeRect(data.x, data.y, data.w, data.h); ctx.setLineDash([]);
                }
            } else {
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(data.x, data.y, data.w, data.h, data.radius || 0);
                else ctx.rect(data.x, data.y, data.w, data.h); 
                
                ctx.fillStyle = key.includes('Photo') ? 'rgba(79, 70, 229, 0.2)' : 'rgba(15, 23, 42, 0.1)';            
                ctx.fill();

                if (studioActiveField === key) {
                    ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 6; ctx.setLineDash([15, 10]);
                    ctx.stroke(); ctx.setLineDash([]);
                }

                ctx.fillStyle = '#0F172A'; ctx.font = "bold 28px Inter"; ctx.textAlign = "center";
                ctx.fillText(data.displayName, data.x + (data.w / 2), data.y + (data.h / 2) + 10);
            }

            if (studioActiveField === key) {
                ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#4F46E5'; ctx.lineWidth = 2;
                const hSize = 14; 
                ctx.fillRect(data.x + data.w - (hSize/2), data.y + data.h - (hSize/2), hSize, hSize);
                ctx.strokeRect(data.x + data.w - (hSize/2), data.y + data.h - (hSize/2), hSize, hSize);
            }
            
        } else {
            ctx.textAlign = data.align; ctx.fillStyle = data.color;
            ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
            
            // Render custom text as the display name, else use the mock data
            const mockText = data.isCustom ? data.displayName : (STUDIO_MOCK_DATA[key] || data.displayName.toUpperCase());
            
            if (studioActiveField === key) {
                ctx.shadowColor = 'rgba(79, 70, 229, 0.8)'; ctx.shadowBlur = 15;
                ctx.fillText(mockText, data.x, data.y);
                ctx.shadowBlur = 0; 
            } else {
                ctx.fillText(mockText, data.x, data.y);
            }
        }
    }
}

// --- 4. DRAG, DROP & RESIZE INTERACTION ---
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('studio-canvas');
    if (!canvas) return;

    function getCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function onPointerDown(e) {
        const coords = getCoords(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;
        const mouseX = (coords.x - rect.left) * scaleX; 
        const mouseY = (coords.y - rect.top) * scaleY;

        // 1. Single Element Resize (Only if ONE element is active and NOT locked)
        if (multiSelectedLayers.size === 1 && studioActiveField && studioActiveData.fields[studioActiveField].isImage && !studioActiveData.fields[studioActiveField].locked) {
            const data = studioActiveData.fields[studioActiveField];
            const hitZone = 40; 
            
            if (mouseX >= data.x + data.w - hitZone && mouseX <= data.x + data.w + hitZone &&
                mouseY >= data.y + data.h - hitZone && mouseY <= data.y + data.h + hitZone) {
                
                saveHistoryState(); 
                isResizingLayer = true;
                resizeStartW = data.w;
                resizeStartH = data.h;
                resizeStartX = mouseX;
                resizeStartY = mouseY;
                
                if(e.type === 'touchstart') e.preventDefault(); 
                return; 
            }
        }

        // 2. Multi-Hit Detection (Find what was clicked)
        let hit = null;
        const keys = Object.keys(studioActiveData.fields).reverse();
        
        for(let key of keys) {
            const data = studioActiveData.fields[key];
            if(!data.enabled) continue;

            if(data.isImage) {
                if(mouseX >= data.x && mouseX <= data.x + data.w && mouseY >= data.y && mouseY <= data.y + data.h) {
                    hit = key; break;
                }
            } else {
                const ctx = canvas.getContext('2d');
                ctx.font = `${data.weight || 'bold'} ${data.size}px ${data.font}`;
                const w = ctx.measureText(STUDIO_MOCK_DATA[key] || data.displayName).width;
                const h = data.size; 
                let startX = data.x;
                if(data.align === 'center') startX -= w/2;
                if(data.align === 'right') startX -= w;

                if(mouseX >= startX - 20 && mouseX <= startX + w + 20 && mouseY >= data.y - h - 20 && mouseY <= data.y + (h * 0.2) + 20) {
                    hit = key; break;
                }
            }
        }

        // 3. Selection & Group Drag Logic (FIXED FOR MOBILE)
        if (hit) {
            // Desktop Ctrl/Shift click adds to selection
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                if (multiSelectedLayers.has(hit)) multiSelectedLayers.delete(hit);
                else multiSelectedLayers.add(hit);
            } 
            // PREVENT CLEARING IF TOUCHING AN ALREADY SELECTED LAYER (Allows mobile drag)
            else if (!multiSelectedLayers.has(hit)) {
                multiSelectedLayers.clear();
                const hitGroup = studioActiveData.fields[hit].groupId;
                if (hitGroup) {
                    Object.keys(studioActiveData.fields).forEach(k => {
                        if (studioActiveData.fields[k].groupId === hitGroup) multiSelectedLayers.add(k);
                    });
                } else {
                    multiSelectedLayers.add(hit);
                }
            }
            
            studioActiveField = multiSelectedLayers.size > 0 ? hit : null;

            saveHistoryState(); 
            isDraggingLayer = true;
            
            // Map out drag offsets for ALL currently selected items
            dragStartPositions = {};
            multiSelectedLayers.forEach(k => {
                if (!studioActiveData.fields[k].locked) {
                    dragStartPositions[k] = {
                        offsetX: mouseX - studioActiveData.fields[k].x,
                        offsetY: mouseY - studioActiveData.fields[k].y
                    };
                }
            });
            
            if(e.type === 'touchstart') e.preventDefault(); 
        } else {
            multiSelectedLayers.clear();
            studioActiveField = null; 
        }
        
        renderLayersPanel(); 
        renderPropertiesPanel(); 
        drawStudioCanvas();
    }

    function onPointerMove(e) {
        if(multiSelectedLayers.size === 0) return;
        if(!isDraggingLayer && !isResizingLayer) return;
        
        if(e.type === 'touchmove') e.preventDefault(); 

        const coords = getCoords(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; 
        const scaleY = canvas.height / rect.height;
        const mouseX = (coords.x - rect.left) * scaleX; 
        const mouseY = (coords.y - rect.top) * scaleY;

        // HANDLE RESIZING
        if (isResizingLayer && studioActiveField) {
            const data = studioActiveData.fields[studioActiveField];
            let deltaX = mouseX - resizeStartX;
            let newW = Math.max(20, resizeStartW + deltaX);
            let newH = data.h; 

            if (data.aspectLocked && data.aspectRatio) {
                newH = Math.round(newW / data.aspectRatio);
            } else {
                let deltaY = mouseY - resizeStartY;
                newH = Math.max(20, resizeStartH + deltaY);
            }

            data.w = newW;
            data.h = newH;

            const propW = document.getElementById('prop-w');
            const propH = document.getElementById('prop-h');
            if (propW) propW.value = data.w;
            if (propH) propH.value = data.h;
            
            drawStudioCanvas();
            return;
        }

        // HANDLE MULTI-DRAGGING
        if(isDraggingLayer) {
            multiSelectedLayers.forEach(k => {
                const data = studioActiveData.fields[k];
                const startPos = dragStartPositions[k];
                if (startPos && !data.locked) {
                    data.x = Math.round(mouseX - startPos.offsetX);
                    data.y = Math.round(mouseY - startPos.offsetY);
                }
            });

            // If only one layer is moving, live update its property inputs
            if (multiSelectedLayers.size === 1 && studioActiveField) {
                const propX = document.getElementById('prop-x');
                const propY = document.getElementById('prop-y');
                if(propX) propX.value = studioActiveData.fields[studioActiveField].x;
                if(propY) propY.value = studioActiveData.fields[studioActiveField].y;
            }

            drawStudioCanvas();
        }
    }

    function onPointerUp() {
        isDraggingLayer = false; 
        isResizingLayer = false; 
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
});

// --- 5. SAVING ---
async function saveActiveTemplate() {
    const name = document.getElementById('studio-template-name').value;
    if (!name) return showToast("Please enter a Template Name.", "error");
    
    // Ensure they have either uploaded a new file or already have an image loaded
    if (!studioActiveData.bg_base64 && !studioActiveData.pendingFile) {
        return showToast("Please upload a background image.", "error");
    }

    studioActiveData.name = name;

    // Show loading state
    const saveBtn = document.querySelector('#template-studio-view .btn-success');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to Cloud...';
    saveBtn.disabled = true;

    try {
        if (studioActiveData.pendingFile) {
            showToast("Uploading background image...", "success");
            const file = studioActiveData.pendingFile;
            const fileExt = file.name.split('.').pop();
            const fileName = `bg_${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('templates')
                .upload(fileName, file, { contentType: file.type });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('templates')
                .getPublicUrl(fileName);

            studioActiveData.bg_base64 = publicUrlData.publicUrl;
            studioActiveData.pendingFile = null; 
        }

        // HIDDEN GROUPS WORKAROUND: Pack the groups object INSIDE the fields JSON
        // so we don't have to alter the Supabase database schema!
        const packedFields = { ...studioActiveData.fields };
        packedFields['__groups__'] = studioActiveData.groups || {};

        const savePayload = { 
            id: studioActiveData.id,
            name: studioActiveData.name,
            type: studioActiveData.type,
            bg_base64: studioActiveData.bg_base64, 
            fields: packedFields // Save the combined object to the existing column
        };

        const { error } = await supabaseClient.from('templates').upsert(savePayload);
        if (error) throw error;
        
        showToast("Template Saved to Cloud Successfully!", "success");
        closeTemplateStudio();
        
    } catch (err) {
        console.error(err);
        showToast(err.message || "Error saving template to cloud.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}
function openFullViewModal() {
    const canvas = document.getElementById('studio-canvas');
    document.getElementById('fullViewImage').src = canvas.toDataURL("image/png");
    document.getElementById('fullViewModal').classList.add('show');
}

const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if(originalSwitchTab) originalSwitchTab(tabId);
    if(tabId === 'poster-templates') {
        document.getElementById('template-library-view').style.display = 'block';
        document.getElementById('template-studio-view').style.display = 'none';
        
        // FIX: Actively fetch the templates from Supabase instead of filtering an empty array
        loadTemplatesList(); 
    }
};

// ============================================================================
// DIRECT VALUATION ENGINE (BYPASS WORKFLOW)
// ============================================================================

let currentDVMaxMark = 100;

// --- REPLACE THESE FUNCTIONS IN ADMIN.JS ---

async function initDirectValuation() {
    // 1. Ensure Categories are loaded
    if (categoriesList.length === 0) { 
        const { data } = await supabaseClient.from('categories').select('*').order('name'); 
        categoriesList = data || []; 
    }
    const catSelect = document.getElementById('dvCategory');
    catSelect.innerHTML = '<option value="">-- ALL CATEGORIES --</option>';
    categoriesList.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);

    // 2. Ensure Stages are loaded
    if (stagesList.length === 0) {
        const { data } = await supabaseClient.from('stages').select('*').order('stage_no');
        stagesList = data || [];
    }
    const stageSelect = document.getElementById('dvStage');
    stageSelect.innerHTML = '<option value="">-- ALL STAGES --</option>';
    stagesList.forEach(s => stageSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    
    // 3. Reset defaults and load all pending competitions immediately
    document.getElementById('dvComp').innerHTML = '<option value="">-- SELECT COMPETITION --</option>';
    document.getElementById('dvWorkspace').style.display = 'none';
    
    loadDVCompetitions();
}

async function loadDVCompetitions() {
    const categoryId = document.getElementById('dvCategory').value;
    const stageId = document.getElementById('dvStage').value;
    const compSelect = document.getElementById('dvComp');
    
    document.getElementById('dvWorkspace').style.display = 'none';
    compSelect.innerHTML = '<option value="">Loading...</option>';
    compSelect.disabled = true;
    
    // Build dynamic query based on filters
    let query = supabaseClient
        .from('competitions')
        .select('*')
        .neq('status', 'published') // Only fetch competitions that are NOT published
        .order('name');
        
    // Apply optional filters
    if (categoryId) query = query.eq('category_id', categoryId);
    if (stageId) query = query.eq('stage_id', stageId);
        
    const { data, error } = await query;
        
    if (error) return showToast(error.message, 'error');
    
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION TO EVALUATE --</option>';
    
    if (!data || data.length === 0) {
        compSelect.innerHTML = '<option value="">-- NO PENDING COMPS FOUND --</option>';
        return;
    }
    
    (data || []).forEach(c => compSelect.innerHTML += `<option value="${c.id}" data-max="${c.max_mark}">${c.name}</option>`);
    compSelect.disabled = false;
}

async function loadDVParticipants() {
    const compSelect = document.getElementById('dvComp');
    const compId = compSelect.value;
    const workspace = document.getElementById('dvWorkspace');
    const tbody = document.getElementById('dv-participants-tbody');
    
    if (!compId) { 
        workspace.style.display = 'none'; 
        return; 
    }
    
    currentDVMaxMark = parseFloat(compSelect.options[compSelect.selectedIndex].getAttribute('data-max')) || 100;
    document.getElementById('dvMaxMarks').innerText = `Max Marks: ${currentDVMaxMark}`;
    
    workspace.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fetching enrolled participants...</td></tr>';
    
    // Fetch enrollments
    const { data, error } = await supabaseClient
        .from('participant_competitions')
        .select(`participant_id, participants(name, unique_id, teams(name))`)
        .eq('competition_id', compId);
        
    if (error) return showToast(error.message, 'error');
    
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">No participants are enrolled in this competition.</td></tr>';
        return;
    }
    
    data.forEach(row => {
        const p = row.participants;
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell" style="vertical-align: middle;">
                    <input type="checkbox" class="dv-row-cb" value="${row.participant_id}" checked onchange="toggleDVRow(this, '${row.participant_id}')">
                </td>
                <td>
                    <strong style="font-size: 1.05rem;">${p.name}</strong><br>
                    <small style="font-family: monospace; color: var(--text-muted);">${p.unique_id}</small>
                </td>
                <td style="font-weight: 600; color: var(--text-muted);">${p.teams?.name || 'INDEPENDENT'}</td>
                <td>
                    <input type="number" id="dv-mark-${row.participant_id}" placeholder="0 - ${currentDVMaxMark}" min="0" max="${currentDVMaxMark}" style="width: 120px; padding: 0.6rem 0.8rem; border: 2px solid var(--border); border-radius: 6px; outline: none; font-size: 1.1rem; font-weight: 700; color: var(--primary);">
                </td>
            </tr>
        `;
    });
}

function toggleDVSelectAll(masterCb) {
    document.querySelectorAll('.dv-row-cb').forEach(cb => {
        cb.checked = masterCb.checked;
        toggleDVRow(cb, cb.value);
    });
}

function toggleDVRow(cb, pId) {
    const markInput = document.getElementById(`dv-mark-${pId}`);
    if (markInput) {
        markInput.disabled = !cb.checked;
        if (!cb.checked) markInput.value = '';
        markInput.style.opacity = cb.checked ? '1' : '0.4';
    }
}


async function submitDirectValuation() {
    const compId = document.getElementById('dvComp').value;
    if (!compId) return showToast('Select a competition first', 'error');
    
    const checkboxes = document.querySelectorAll('.dv-row-cb:checked');
    if (checkboxes.length === 0) return showToast('Select at least one participant who participated.', 'error');
    
    const marksData = [];
    
    // Validation Loop
    for (let cb of checkboxes) {
        const pId = cb.value;
        const markVal = document.getElementById(`dv-mark-${pId}`).value;
        
        if (markVal === '' || isNaN(markVal)) {
            return showToast('Please enter marks for all attended participants.', 'error');
        }
        
        const mark = parseFloat(markVal);
        if (mark < 0 || mark > currentDVMaxMark) {
            return showToast(`Marks must be between 0 and ${currentDVMaxMark}.`, 'error');
        }
        
        marksData.push({
            competition_id: compId,
            participant_id: pId,
            judge_id: user.id, // Auth Admin ID logs the action
            awarded_mark: mark
        });
    }
    
    // Launch the premium confirmation modal
    openConfirmModal("Submit Valuation?", "Submit these marks directly and push the competition to the Fest Manager for publishing?", async () => {
        setLoading('btnSubmitDV', true);
        
        try {
            // 1. Purge any existing marks to avoid duplication logic
            await supabaseClient.from('judgements').delete().eq('competition_id', compId);
            
            // 2. Insert Final Marks
            const { error: insertError } = await supabaseClient.from('judgements').insert(marksData);
            if (insertError) throw insertError;
            
            // 3. Force Status to Judgement Complete so it appears in Fest Manager's "Publish Queue"
            const { error: compError } = await supabaseClient.from('competitions').update({ status: 'judgement_complete' }).eq('id', compId);
            if (compError) throw compError;
            
            showToast('Direct Valuation successfully submitted!', 'success');
            
            // Reset Workspace UI
            document.getElementById('dvWorkspace').style.display = 'none';
            document.getElementById('dvComp').value = '';
            
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setLoading('btnSubmitDV', false);
        }
    });
}



// --- MISSING EDIT FUNCTION FIX ---
function editTemplate(index) {
    const templateToEdit = savedTemplates[index];
    if (templateToEdit) {
        openTemplateStudio(templateToEdit);
    } else {
        showToast("Error: Could not load template data.", "error");
    }
}

// Populate the Team dropdown for bulk assignment
async function initBulkTeamControls() {
    const select = document.getElementById('bulkTeamSelect');
    if (!select) return;
    
    // Ensure teamsList is loaded
    if (teamsList.length === 0) {
        const { data } = await supabaseClient.from('teams').select('id, name');
        teamsList = data || [];
    }
    
    select.innerHTML = '<option value="">-- SELECT TEAM --</option>';
    teamsList.forEach(t => select.innerHTML += `<option value="${t.id}">${t.name}</option>`);
}

// Bulk Assign Team
async function bulkAssignTeam() {
    const teamId = document.getElementById('bulkTeamSelect').value;
    const participantIds = getSelectedIds('participants-tbody');
    
    if (!teamId) return showToast('Please select a team first.', 'error');
    if (participantIds.length === 0) return showToast('Select at least one participant.', 'error');
    
    try {
        const { error } = await supabaseClient
            .from('participants')
            .update({ team_id: teamId })
            .in('id', participantIds);
            
        if (error) throw error;
        showToast(`Successfully assigned ${participantIds.length} participants to team.`);
        clearSelection('participants-tbody');
        loadParticipants();
    } catch (e) { showToast(e.message, 'error'); }
}



// --- BRANDING & UI ENGINE ---
let pendingBrandingLogoBase64 = null;

function handleBrandingLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // We convert the logo to Base64 so it can be saved directly in the settings table
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingBrandingLogoBase64 = e.target.result;
        const preview = document.getElementById('branding-logo-preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        
        // Show the remove button once a logo is loaded
        const btnRemove = document.getElementById('btnRemoveLogo');
        if (btnRemove) btnRemove.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

// NEW: Clear Logo Functionality
function removeBrandingLogo() {
    pendingBrandingLogoBase64 = null;
    const preview = document.getElementById('branding-logo-preview');
    preview.src = '';
    preview.style.display = 'none';
    
    // Hide remove button and reset the file input
    const btnRemove = document.getElementById('btnRemoveLogo');
    if (btnRemove) btnRemove.style.display = 'none';
    
    const fileInput = document.getElementById('setting-fest-logo');
    if (fileInput) fileInput.value = '';
}

async function loadBrandingSettings() {
    try {
        const { data, error } = await supabaseClient.from('settings').select('value').eq('id', 'system_branding').maybeSingle();        
        if (data && data.value) {
            document.getElementById('setting-fest-name').value = data.value.fest_name || '';
            
            // Load the new display mode
            const displaySelect = document.getElementById('setting-branding-display');
            if(displaySelect && data.value.display_mode) displaySelect.value = data.value.display_mode;

            if (data.value.fest_logo) {
                const preview = document.getElementById('branding-logo-preview');
                preview.src = data.value.fest_logo;
                preview.style.display = 'block';
                pendingBrandingLogoBase64 = data.value.fest_logo; 
                
                const btnRemove = document.getElementById('btnRemoveLogo');
                if(btnRemove) btnRemove.style.display = 'inline-flex';
            }
        }
    } catch (e) {
        console.warn("No custom branding settings found, using defaults.");
    }
}

async function saveBrandingSettings() {
    const festName = document.getElementById('setting-fest-name').value.trim();
    setLoading('btnSaveBranding', true);
    
    const payload = {
        fest_name: festName,
        fest_logo: pendingBrandingLogoBase64,
        display_mode: document.getElementById('setting-branding-display') ? document.getElementById('setting-branding-display').value : 'both'
    };

    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'system_branding', value: payload });
        if (error) throw error;
        
        showToast("Branding Settings Saved to Database!");
        applyGlobalBranding(payload);

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        setLoading('btnSaveBranding', false);
    }
}

// ============================================================================
// GLOBAL BRANDING ENGINE (DATABASE SYNC)
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Fire the cloud fetch as soon as the DOM is ready
    fetchAndApplyBranding();
});

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================
async function fetchAndApplyBranding() {
    try {
        const { data, error } = await supabaseClient
            .from('settings')
            .select('value')
            .eq('id', 'system_branding')
            .maybeSingle();

        if (error) throw error;
        if (data && data.value) applyGlobalBranding(data.value);
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
    const displayMode = brandingData.display_mode || 'both'; // 'both', 'logo', 'name'
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    // 2. Global Favicon Injection (Works on Master Admin, Login, and all pages)
    if (validLogo) {
        let iconLinks = document.querySelectorAll("link[rel~='icon']");
        if (iconLinks.length === 0) {
            let newIcon = document.createElement('link');
            newIcon.rel = 'icon';
            document.head.appendChild(newIcon);
            iconLinks = [newIcon];
        }
        iconLinks.forEach(link => link.href = brandingData.fest_logo);
    }

    // 3. UI Header & Logo Sizing Engine
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1');
    
    brandContainers.forEach(container => {
        if(container.id === 'page-title') return; 

        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // Configurable Logo Sizing (Clean height parameter with max constraints)
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 36px; width: auto; max-width: 180px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // Dynamic Text
        if (showName) {
            let textToDisplay = validName ? brandingData.fest_name : 'FestOS';
            
            if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                textToDisplay += ' Reports Engine';
            }
            
            html += `<span style="letter-spacing: -0.5px; display: inline-block; vertical-align: middle;">${textToDisplay}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'nowrap'; // Keeps logo and text side-by-side cleanly
        
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login') || window.location.pathname.includes('index') || window.location.pathname === '/') {
            container.style.justifyContent = 'center';
        }
    });

    if (typeof window !== 'undefined') window.systemBranding = brandingData;
}

let pointsAdminSettings = {
    thresholds: { aplus: 90, a: 70, b: 60, c: 50 },
    points_solo: { aplus: 8, a: 7, b: 5, c: 3 },
    points_small: { aplus: 12, a: 10, b: 7, c: 5 },
    points_large: { aplus: 15, a: 12, b: 10, c: 7 },
    pos_points: { p1: 3, p2: 2, p3: 1 },
    poster_interval: 10,
    announcer_offset: 30, // NEW DEFAULT
    tm_access: true
};

async function loadPointSettings() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();        
        if (data && data.value) {
            pointsAdminSettings = data.value;
            const v = data.value;
            
            // Map to UI
            ['aplus', 'a', 'b', 'c'].forEach(g => {
                if(document.getElementById(`th-${g}`)) document.getElementById(`th-${g}`).value = v.thresholds[g];
                if(document.getElementById(`pt-solo-${g}`)) document.getElementById(`pt-solo-${g}`).value = v.points_solo[g];
                if(document.getElementById(`pt-small-${g}`)) document.getElementById(`pt-small-${g}`).value = v.points_small[g];
                if(document.getElementById(`pt-large-${g}`)) document.getElementById(`pt-large-${g}`).value = v.points_large[g];
            });
            if(document.getElementById('pos-1')) document.getElementById('pos-1').value = v.pos_points.p1;
            if(document.getElementById('pos-2')) document.getElementById('pos-2').value = v.pos_points.p2;
            if(document.getElementById('pos-3')) document.getElementById('pos-3').value = v.pos_points.p3;
            if(document.getElementById('setting-poster-interval')) document.getElementById('setting-poster-interval').value = v.poster_interval;
            
            // NEW: Load Announcer Offset
            if(document.getElementById('setting-announcer-offset')) document.getElementById('setting-announcer-offset').value = v.announcer_offset !== undefined ? v.announcer_offset : 30;
            
            if(document.getElementById('setting-lock-date')) document.getElementById('setting-lock-date').value = v.lock_date || '';
            
            if(document.getElementById('setting-tm-access')) {
                const checkbox = document.getElementById('setting-tm-access');
                checkbox.checked = v.tm_access !== false;
                checkbox.dispatchEvent(new Event('change')); 
            }
        }
    } catch (e) { console.warn("Using default point settings."); }
}

async function savePointSettings() {
    const getVal = (id) => parseInt(document.getElementById(id).value) || 0;
    const payload = {
        thresholds: { aplus: getVal('th-aplus'), a: getVal('th-a'), b: getVal('th-b'), c: getVal('th-c') },
        points_solo: { aplus: getVal('pt-solo-aplus'), a: getVal('pt-solo-a'), b: getVal('pt-solo-b'), c: getVal('pt-solo-c') },
        points_small: { aplus: getVal('pt-small-aplus'), a: getVal('pt-small-a'), b: getVal('pt-small-b'), c: getVal('pt-small-c') },
        points_large: { aplus: getVal('pt-large-aplus'), a: getVal('pt-large-a'), b: getVal('pt-large-b'), c: getVal('pt-large-c') },
        pos_points: { p1: getVal('pos-1'), p2: getVal('pos-2'), p3: getVal('pos-3') },
        poster_interval: getVal('setting-poster-interval'),
        // NEW: Save Announcer Offset
        announcer_offset: getVal('setting-announcer-offset'),
        lock_date: document.getElementById('setting-lock-date') ? document.getElementById('setting-lock-date').value : null,
        tm_access: document.getElementById('setting-tm-access') ? document.getElementById('setting-tm-access').checked : true
    };

    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'point_system', value: payload });
        if (error) throw error;
        pointsAdminSettings = payload;
        showToast("Point Settings Saved Successfully!");
    } catch (e) { showToast(e.message, 'error'); }
}

let teamPointsList = []; 
let pointsDataList = []; 
let filteredPointsList = []; 
let pointsCurrentPage = 1;
let pointsRowsPerPage = 10;

async function loadParticipantPoints() {
    try {
        const [
            pointSettings,
            teamsRes,
            catsRes,
            compsRes,
            participantsRes,
            judgementsRes
        ] = await Promise.all([
            loadPointSettings(),
            teamsList.length === 0 ? supabaseClient.from('teams').select('*') : Promise.resolve({ data: teamsList }),
            categoriesList.length === 0 ? supabaseClient.from('categories').select('*') : Promise.resolve({ data: categoriesList }),
            supabaseClient.from('competitions').select('*, categories(name, is_general), participant_competitions(count)'),
            supabaseClient.from('participants').select('*, teams(name), categories(name)'),
            supabaseClient.from('judgements').select('participant_id, competition_id, awarded_mark')
        ]);

        if (teamsRes.data) teamsList = teamsRes.data;
        if (catsRes.data) categoriesList = catsRes.data;
        const comps = compsRes.data || [];
        const participants = participantsRes.data || [];
        const judgements = judgementsRes.data || [];

        // Create mapping for fast participant lookups
        const pMap = {};
        (participants || []).forEach(p => pMap[p.id] = p);

        let compAverages = {}; 
        (judgements || []).forEach(j => {
           if(!compAverages[j.competition_id]) compAverages[j.competition_id] = {};
           if(!compAverages[j.competition_id][j.participant_id]) compAverages[j.competition_id][j.participant_id] = { marks_array: [] };
           compAverages[j.competition_id][j.participant_id].marks_array.push(parseFloat(j.awarded_mark));
        });

        let compResults = {};
        let teamResults = {};

        // Initialize Team Totals
        (teamsList || []).forEach(t => {
            teamResults[t.id] = { team: t, breakdown: [], totalPoints: 0, participantCount: 0 };
        });

        // Pre-count total participants per team
        (participants || []).forEach(p => {
            if (p.team_id && teamResults[p.team_id]) teamResults[p.team_id].participantCount++;
        });

        (comps || []).forEach(comp => {
            if(!compAverages[comp.id]) return;
            
            const participantsArr = Object.entries(compAverages[comp.id]).map(([pId, data]) => {
                let sortedMarks = data.marks_array.sort((a, b) => a - b);
                if (sortedMarks.length >= 3) sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
                const sum = sortedMarks.reduce((a, b) => a + b, 0);
                return { id: pId, mark: sum / sortedMarks.length };
            }).sort((a, b) => b.mark - a.mark);

            const limit = comp.max_participants || 1;
            let sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            // PARTICIPANT LIMIT RESTRICTION REMOVED HERE
            
            let currentRank = 1;
            let previousScore = -1;

            participantsArr.forEach((p, index) => {
                if (p.mark !== previousScore) currentRank = index + 1;
                previousScore = p.mark;

                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let grade = '-'; let gradePts = 0; let posPts = 0;

                // 1. Assign Grade Points ONLY if >= 50% (Wrapped in Number() to force math addition)
                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) { grade = 'A+'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].aplus) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.a) { grade = 'A'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].a) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.b) { grade = 'B'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].b) || 0; }
                    else { grade = 'C'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].c) || 0; }
                }
                
                // 2. Assign Position Points ALWAYS for Top 3 (Removed the >= 3 limit)
                if (currentRank <= 3) {
                    if (currentRank === 1) posPts = Number(pointsAdminSettings.pos_points.p1) || 0;
                    else if (currentRank === 2) posPts = Number(pointsAdminSettings.pos_points.p2) || 0;
                    else if (currentRank === 3) posPts = Number(pointsAdminSettings.pos_points.p3) || 0;
                }
                
                const totalPts = gradePts + posPts;
                const pData = pMap[p.id];
                const tId = pData ? pData.team_id : null;
                
                // === THE NEW ROUTING LOGIC WITH AWARD TRACKING ===
                if (comp.is_group) {
                    // Group Events: Add ONLY to Team Ledger
                    if (tId && teamResults[tId]) {
                        teamResults[tId].breakdown.push({
                            compName: comp.name,
                            compCat: comp.categories?.name || 'General',
                            mark: p.mark.toFixed(2),
                            maxMark: comp.max_mark || 100,
                            grade: grade,
                            totalPts: totalPts,
                            participantName: (pData?.name || 'Unknown') + " & PARTY",
                            type: 'Group Event',
                            awardType: comp.award_type // Track award type
                        });
                        teamResults[tId].totalPoints += totalPts;
                    }
                } else {
                    // Individual Events: Add to Participant Ledger
                    if(!compResults[p.id]) compResults[p.id] = [];
                    compResults[p.id].push({
                        compName: comp.name, 
                        compCat: comp.categories?.name || 'General',
                        mark: p.mark.toFixed(2), 
                        maxMark: comp.max_mark || 100, 
                        grade: grade, 
                        totalPts: totalPts,
                        awardType: comp.award_type // Track award type here
                    });

                    // Individual Events: ALSO add to Team Ledger
                    if (tId && teamResults[tId]) {
                        teamResults[tId].breakdown.push({
                            compName: comp.name,
                            compCat: comp.categories?.name || 'General',
                            mark: p.mark.toFixed(2), 
                            maxMark: comp.max_mark || 100,
                            grade: grade, 
                            totalPts: totalPts,
                            participantName: pData?.name || 'Unknown',
                            type: 'Individual Event',
                            awardType: comp.award_type // Track award type
                        });
                        teamResults[tId].totalPoints += totalPts;
                    }
                }
            });
        });

        // Apply to participant list with Star/Pen calculation
        pointsDataList = (participants || []).map(p => {
            const breakdown = compResults[p.id] || [];
            const totalPoints = breakdown.reduce((sum, b) => sum + b.totalPts, 0);
            
            // NEW: Calculate specific award points
            const starPoints = breakdown.filter(b => b.awardType === 'star').reduce((sum, b) => sum + b.totalPts, 0);
            const penPoints = breakdown.filter(b => b.awardType === 'pen').reduce((sum, b) => sum + b.totalPts, 0);
            
            return { ...p, totalPoints, starPoints, penPoints, breakdown };
        });

        // Apply to team list and sort highest first
        teamPointsList = Object.values(teamResults).sort((a, b) => b.totalPoints - a.totalPoints);

        populateDropdownSafe('filterPointsCategory', categoriesList);
        populateDropdownSafe('filterPointsTeam', teamsList);
        filterPointsTable(true);
        renderTeamPointsTable();
        
        // Auto-refresh the special ledger if a special tab is currently active
        const starBtn = document.getElementById('btn-view-star');
        const penBtn = document.getElementById('btn-view-pen');
        if (starBtn && starBtn.classList.contains('btn-primary')) renderSpecialLedger('star');
        if (penBtn && penBtn.classList.contains('btn-primary')) renderSpecialLedger('pen');

    } catch (e) { showToast(e.message, 'error'); }
}

// VIEW SWITCHER
function switchPointsView(view) {
    // Reset all buttons to outline
    document.getElementById('btn-view-ind').className = 'btn btn-outline';
    document.getElementById('btn-view-team').className = 'btn btn-outline';
    document.getElementById('btn-view-star').className = 'btn btn-outline';
    document.getElementById('btn-view-pen').className = 'btn btn-outline';
    
    // Re-apply special colors to outline state for star/pen
    document.getElementById('btn-view-star').style.color = '#D97706';
    document.getElementById('btn-view-star').style.borderColor = '#D97706';
    document.getElementById('btn-view-star').style.background = 'transparent';
    
    document.getElementById('btn-view-pen').style.color = '#4338CA';
    document.getElementById('btn-view-pen').style.borderColor = '#4338CA';
    document.getElementById('btn-view-pen').style.background = 'transparent';

    // Hide all containers
    document.getElementById('ind-points-container').style.display = 'none';
    document.getElementById('team-points-container').style.display = 'none';
    document.getElementById('special-points-container').style.display = 'none';
    document.getElementById('ind-filters').style.display = 'none';
    
    // Manage Export Button Visibility
    const exportBtn = document.getElementById('btn-export-points');

    if (view === 'individual') {
        document.getElementById('btn-view-ind').className = 'btn btn-primary';
        document.getElementById('ind-points-container').style.display = 'block';
        document.getElementById('ind-filters').style.display = 'flex';
        exportBtn.style.display = 'inline-flex';
        exportBtn.setAttribute('onclick', 'bulkExportPointsPDF()');
        
    } else if (view === 'team') {
        document.getElementById('btn-view-team').className = 'btn btn-primary';
        document.getElementById('team-points-container').style.display = 'block';
        exportBtn.style.display = 'inline-flex';
        exportBtn.setAttribute('onclick', 'bulkExportTeamPointsPDF()');
        
    } else if (view === 'star') {
        const btn = document.getElementById('btn-view-star');
        btn.className = 'btn'; 
        btn.style.background = '#D97706';
        btn.style.color = 'white';
        
        document.getElementById('special-points-container').style.display = 'block';
        exportBtn.style.display = 'none'; // No checkboxes in this view
        renderSpecialLedger('star');
        
    } else if (view === 'pen') {
        const btn = document.getElementById('btn-view-pen');
        btn.className = 'btn'; 
        btn.style.background = '#4338CA';
        btn.style.color = 'white';

        document.getElementById('special-points-container').style.display = 'block';
        exportBtn.style.display = 'none'; // No checkboxes in this view
        renderSpecialLedger('pen');
    }
}

// SPECIAL AWARD LEDGER RENDERER
function renderSpecialLedger(type) {
    const tbody = document.getElementById('special-points-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // Determine the correct data key based on the button clicked
    const filterKey = type === 'star' ? 'starPoints' : 'penPoints';
    
    // Filter participants who actually have points for this specific award
    const contenders = pointsDataList.filter(p => p[filterKey] > 0);
    
    // Sort by those specific points descending
    contenders.sort((a, b) => b[filterKey] - a[filterKey]);

    // Update table header text
    document.getElementById('special-pts-header').innerText = type === 'star' ? 'Star Points' : 'Pen Points';

    if (contenders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No points awarded yet for this category.</td></tr>`;
        return;
    }

    contenders.forEach((p, index) => {
        let rankBadge = '';
        if(index === 0) rankBadge = '<i class="fa-solid fa-crown" style="color: #F59E0B; font-size: 1.25rem;"></i>';
        else if(index === 1) rankBadge = '<i class="fa-solid fa-medal" style="color: #94A3B8; font-size: 1.25rem;"></i>';
        else if(index === 2) rankBadge = '<i class="fa-solid fa-medal" style="color: #B45309; font-size: 1.25rem;"></i>';
        else rankBadge = `<span style="font-weight: 800; font-size: 1.1rem; color: var(--text-muted);">#${index + 1}</span>`;

        const pointsColor = type === 'star' ? '#D97706' : '#4338CA';
        
        tbody.innerHTML += `
            <tr>
                <td style="text-align: center;">${rankBadge}</td>
                <td>
                    <strong style="font-size: 1.05rem;">${p.name}</strong><br>
                    <small style="font-family: monospace; color: var(--text-muted);">${p.unique_id}</small>
                </td>
                <td><span class="badge" style="background:var(--bg-main); color:var(--text-main); border: 1px solid var(--border);">${p.teams?.name || 'INDEPENDENT'}</span></td>
                <td style="font-weight: 900; color: ${pointsColor}; font-size: 1.25rem;">${p[filterKey]}</td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewParticipantPointDetails('${p.id}')"><i class="fa-solid fa-list"></i> View Details</button>
                </td>
            </tr>
        `;
    });
}

// Render Team Table
function renderTeamPointsTable() {
    const tbody = document.getElementById('team-points-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (teamPointsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>`;
        return;
    }

    teamPointsList.forEach((t, i) => {
        let rankBadge = i === 0 ? '<i class="fa-solid fa-crown" style="color: #F59E0B; margin-right: 5px;"></i>' : '';
        tbody.innerHTML += `
            <tr>
                <td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${t.team.id}" ${globalSelections['team-points-tbody']?.has(t.team.id) ? 'checked' : ''} onchange="handleRowSelection('team-points-tbody', this.value, this.checked)"></td>
                <td style="font-weight: 800; font-size: 1.15rem; color: var(--text-main);">${rankBadge}${t.team.name}</td>
                <td style="color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-users" style="margin-right: 5px;"></i>${t.participantCount} Enrolled</td>
                <td style="font-weight: 900; color: var(--primary); font-size: 1.25rem;">${t.totalPoints} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PTS</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewTeamPointDetails('${t.team.id}')"><i class="fa-solid fa-list"></i> View Ledger</button>
                </td>
            </tr>
        `;
    });
}

// Modal Preview for Team
function viewTeamPointDetails(teamId) {
    const t = teamPointsList.find(x => x.team.id === teamId);
    if (!t) return;

   let trs = t.breakdown.length > 0 ? t.breakdown.map((b, i) => `
        <tr>
            <td>
                <strong style="font-weight: 700;">${b.participantName}</strong><br>
                <small style="color: var(--text-muted); font-weight: 600;"><i class="fa-solid ${b.type === 'Group Event' ? 'fa-users' : 'fa-user'}" style="margin-right:4px;"></i>${b.type}</small>
            </td>
            <td style="font-weight: 600;">${b.compName} <br><span class="badge" style="background:var(--primary-light); font-size:0.65rem; margin-top:4px; display: inline-block;">${b.compCat}</span></td>
            <td style="text-align: right; color: var(--text-muted); font-weight: 600;">${b.mark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary); font-size: 1.1rem;">${b.totalPts}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1rem;">No points earned yet.</td></tr>`;

    document.getElementById('listModalTitle').innerText = 'Team Championship Ledger';
    
    document.getElementById('listModalTable').innerHTML = `
        <tbody>
            <tr>
                <td colspan="4" style="padding: 0; border: none; padding-bottom: 1rem;">
                    <div style="background: var(--bg-main); padding: 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 1.4rem; font-weight: 900; line-height: 1.2; color: var(--text-main); text-transform: uppercase;">${t.team.name}</div>
                            <div style="font-family: monospace; color: var(--text-muted); font-size: 0.95rem; font-weight: 600; margin-top: 0.25rem;">${t.participantCount} STUDENTS ENROLLED</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">TOTAL SCORE</div>
                            <div style="font-size: 2rem; font-weight: 900; color: var(--primary); line-height: 1;">${t.totalPoints}</div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr style="background: var(--bg-main); font-size: 0.75rem; color: var(--text-muted);">
                <th style="padding: 0.75rem 1rem;">Contestant / Group</th>
                <th style="padding: 0.75rem 1rem;">Program Evaluated</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Final Marks</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Points</th>
            </tr>
            ${trs}
        </tbody>
    `;
    
    document.getElementById('listModal').classList.add('show');
}

// PDF Generation for Team
function bulkExportTeamPointsPDF() {
    const ids = getSelectedIds('team-points-tbody');
    let targetList = ids.length > 0 ? teamPointsList.filter(t => ids.includes(t.team.id)) : teamPointsList;
    
    if (targetList.length === 0) return showToast("No teams to export", "error");
    
    showToast("Generating Team Reports PDF...", "success");
    const container = document.createElement('div');
    container.style.fontFamily = 'Inter, sans-serif';
    container.style.width = '100%';
    container.style.background = 'white';

    targetList.forEach((t, index) => {
       let trs = t.breakdown.length > 0 ? t.breakdown.map((b, i) => `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px; font-size: 12px;">${i+1}</td>
                <td style="padding: 12px; font-size: 12px;">
                    <strong style="font-weight: 700; color: #0F172A;">${b.participantName.toUpperCase()}</strong><br>
                    <span style="font-size: 9px; color: #64748B; font-weight: 600;">${b.type.toUpperCase()}</span>
                </td>
                <td style="padding: 12px; font-size: 12px; font-weight: 600;">${b.compName.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 12px;">${b.compCat.toUpperCase()}</td>
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.mark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 14px; text-align: right; font-weight: 800; color: #4F46E5;">${b.totalPts}</td>
            </tr>
        `).join('') : `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748B; font-weight: 600;">No programs evaluated yet.</td></tr>`;

        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 30px;">
                    ${getPDFHeaderHTML('Team Championship Ledger')}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #EEF2FF; padding: 20px; border-radius: 12px; border: 1px solid rgba(79, 70, 229, 0.2);">
                    <div>
                        <p style="font-size: 10px; color: #4F46E5; font-weight: 800; margin-bottom: 4px;">TEAM DESIGNATION</p>
                        <h2 style="font-size: 24px; font-weight: 800; color: #0F172A; margin: 0; text-transform: uppercase;">${t.team.name}</h2>
                        <p style="font-size: 12px; color: #64748B; margin-top: 6px; font-weight: 600;">TOTAL ENROLLED: ${t.participantCount} STUDENTS</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: #4F46E5; font-weight: 800; margin-bottom: 4px;">TEAM MANAGER</p>
                        <h2 style="font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; text-transform: uppercase;">${t.team.manager_name || 'NOT ASSIGNED'}</h2>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #1E293B; color: white; text-align: left;">
                            <th style="padding: 12px; font-size: 11px;">#</th>
                            <th style="padding: 12px; font-size: 11px;">CONTESTANT / GROUP</th>
                            <th style="padding: 12px; font-size: 11px;">PROGRAM EVALUATED</th>
                            <th style="padding: 12px; font-size: 11px;">CATEGORY</th>
                            <th style="padding: 12px; font-size: 11px; text-align: center;">FINAL MARKS</th>
                            <th style="padding: 12px; font-size: 11px; text-align: right;">POINTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                    <tfoot>
                        <tr style="background: #F1F5F9; border-top: 2px solid #CBD5E1;">
                            <td colspan="5" style="padding: 16px; text-align: right; font-weight: 800; font-size: 14px; color: #0F172A;">TOTAL CHAMPIONSHIP POINTS:</td>
                            <td style="padding: 16px; text-align: right; font-weight: 900; font-size: 20px; color: #4F46E5;">${t.totalPoints}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 0, 
        filename: `FestOS_Team_Ledger.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported Successfully!'));
}

function populateDropdownSafe(id, list) {
    const el = document.getElementById(id);
    if(el && el.options.length === 1 && list && list.length > 0) {
        list.forEach(i => el.innerHTML += `<option value="${i.name}">${i.name}</option>`);
    }
}

function filterPointsTable(resetPage = true) {
    const query = document.getElementById('searchPointsInput').value.toLowerCase();
    const catFilter = document.getElementById('filterPointsCategory').value;
    const teamFilter = document.getElementById('filterPointsTeam').value;
    const dobFilter = document.getElementById('filterPointsDob').value;
    
    filteredPointsList = pointsDataList.filter(p => {
        const matchName = p.name.toLowerCase().includes(query) || (p.unique_id && p.unique_id.toLowerCase().includes(query));
        const matchCat = catFilter === "" || (p.categories?.name || '') === catFilter;
        const matchTeam = teamFilter === "" || (p.teams?.name || '') === teamFilter;
        const matchDob = dobFilter === "" || p.dob === dobFilter;
return matchName && matchCat && matchTeam && matchDob;
    });
    
    // Sort highest points first
    filteredPointsList.sort((a, b) => b.totalPoints - a.totalPoints);
    
    if (resetPage) pointsCurrentPage = 1; 
    renderPointsTable();
}

function renderPointsTable() {
    const tbody = document.getElementById('points-tbody');
    tbody.innerHTML = '';
    
    const start = (pointsCurrentPage - 1) * pointsRowsPerPage;
    const end = start + pointsRowsPerPage;
    const pageData = filteredPointsList.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>`;
        document.getElementById('points-pagination').innerHTML = '';
        return;
    }

    pageData.forEach(p => {
        tbody.innerHTML += `
            <tr>
<td class="checkbox-cell"><input type="checkbox" class="row-cb" value="${p.id}" ${globalSelections['points-tbody']?.has(p.id) ? 'checked' : ''} onchange="handleRowSelection('points-tbody', this.value, this.checked)"></td>                <td style="font-family: monospace; font-weight: 600; color: var(--text-muted);">${p.unique_id}</td>
                <td style="font-weight: 700;">${p.name}</td>
                <td>${p.teams?.name || 'INDEPENDENT'}</td>
                <td style="font-weight: 900; color: var(--primary); font-size: 1.1rem;">${p.totalPoints} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PTS</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" title="View Detail Breakdown" onclick="viewParticipantPointDetails('${p.id}')"><i class="fa-solid fa-list"></i> View Details</button>
                </td>
            </tr>
        `;
    });
    
    renderPointsPagination();
}

function renderPointsPagination() {
    const totalPages = Math.ceil(filteredPointsList.length / pointsRowsPerPage) || 1;
    const paginationContainer = document.getElementById('points-pagination');
    
    const startNum = filteredPointsList.length === 0 ? 0 : ((pointsCurrentPage - 1) * pointsRowsPerPage) + 1;
    const endNum = Math.min(pointsCurrentPage * pointsRowsPerPage, filteredPointsList.length);

   const masterCb = document.querySelector('#points-tbody')?.previousElementSibling?.querySelector('input[type="checkbox"]');
    if(masterCb) masterCb.checked = false;

    paginationContainer.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.75rem;">
            Showing ${startNum} to ${endNum} of ${filteredPointsList.length} participants
            <select onchange="pointsRowsPerPage = parseInt(this.value); pointsCurrentPage = 1; renderPointsTable();" style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); outline: none; background: white; font-weight: 600;">
                <option value="10" ${pointsRowsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${pointsRowsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${pointsRowsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${pointsRowsPerPage === 100 ? 'selected' : ''}>100 per page</option>
            </select>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="pointsCurrentPage--; renderPointsTable();" ${pointsCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span style="display: flex; align-items: center; padding: 0 0.75rem; font-weight: 600; font-size: 0.9rem; color: var(--primary);">Page ${pointsCurrentPage} of ${totalPages}</span>
            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="pointsCurrentPage++; renderPointsTable();" ${pointsCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

// In-App Modal Detail View
function viewParticipantPointDetails(pId) {
    const p = pointsDataList.find(x => x.id === pId);
    if (!p) return;

   let trs = p.breakdown.length > 0 ? p.breakdown.map((b, i) => `
        <tr>
            <td style="font-weight: 600;">${b.compName}</td>
            <td><span class="badge" style="background:var(--bg-main);">${b.compCat}</span></td>
            <!-- CHANGE THE NEXT TWO LINES 👇 -->
            <td style="text-align: right;">${b.mark} / ${b.maxMark}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary);">${b.totalPts}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1rem;">No evaluated programs yet.</td></tr>`;

    document.getElementById('listModalTitle').innerText = 'Points Breakdown Ledger';
    
    // Fix: Wrapped the header div inside a valid table row/cell structure
    document.getElementById('listModalTable').innerHTML = `
        <tbody>
            <tr>
                <td colspan="4" style="padding: 0; border: none; padding-bottom: 1rem;">
                    <div style="background: var(--bg-main); padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 1.25rem; font-weight: 800; line-height: 1.2;">${p.name}</div>
                        <div style="font-family: monospace; color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">${p.unique_id} | ${(p.teams?.name || 'INDEPENDENT').toUpperCase()}</div>
                    </div>
                </td>
            </tr>
            <tr style="background: var(--bg-main); font-size: 0.75rem; color: var(--text-muted);">
                <th style="padding: 0.75rem 1rem;">Competition</th>
                <th style="padding: 0.75rem 1rem;">Category</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Marks</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Points</th>
            </tr>
            ${trs}
            <tr style="border-top: 2px solid var(--border); background: #f8fafc;">
                <td colspan="3" style="padding: 1rem; text-align: right; font-weight: 800; font-size: 0.9rem;">TOTAL POINTS:</td>
                <td style="padding: 1rem; text-align: right; font-weight: 900; color: var(--primary); font-size: 1.15rem;">${p.totalPoints}</td>
            </tr>
        </tbody>
    `;
    
    document.getElementById('listModal').classList.add('show');
}

// Bulk PDF Report Generator (One Page Per Participant)
async function bulkExportPointsPDF() {
    const ids = getSelectedIds('points-tbody');
    let targetList = ids.length > 0 ? pointsDataList.filter(p => ids.includes(p.id)) : filteredPointsList;
    
    if (targetList.length === 0) return showToast("No participants to export", "error");
    
    showToast("Generating Multi-Page PDF...", "success");
    const container = document.createElement('div');
    container.style.fontFamily = 'Inter, sans-serif';
    container.style.width = '100%';
    container.style.background = 'white';

    targetList.forEach((p, index) => {
       let trs = p.breakdown.length > 0 ? p.breakdown.map((b, i) => `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px; font-size: 12px;">${i+1}</td>
                <td style="padding: 12px; font-size: 12px; font-weight: 600;">${b.compName}</td>
                <td style="padding: 12px; font-size: 12px;">${b.compCat}</td>
                <!-- CHANGE THE NEXT TWO LINES 👇 -->
                <td style="padding: 12px; font-size: 12px; text-align: center;">${b.mark} / ${b.maxMark}</td>
                <td style="padding: 12px; font-size: 12px; text-align: right; font-weight: 700; color: #4F46E5;">${b.totalPts}</td>
            </tr>
        `).join('') : `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748B;">No programs evaluated yet.</td></tr>`;

        // The "page-break-after: always" ensures each participant gets their own clean page
        container.innerHTML += `
            <div style="padding: 40px; ${index < targetList.length - 1 ? 'page-break-after: always;' : ''}">
                <div style="padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 30px;">
                    ${getPDFHeaderHTML('Participant Point Ledger')}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid #E2E8F0;">
                    <div>
                        <p style="font-size: 10px; color: #64748B; font-weight: 700; margin-bottom: 4px;">PARTICIPANT NAME</p>
                        <h2 style="font-size: 18px; color: #0F172A; margin: 0; text-transform: uppercase;">${p.name}</h2>
                        <p style="font-family: monospace; font-size: 12px; color: #64748B; margin-top: 4px;">${p.unique_id}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; color: #64748B; font-weight: 700; margin-bottom: 4px;">TEAM AFFILIATION</p>
                        <h2 style="font-size: 16px; color: #0F172A; margin: 0; text-transform: uppercase;">${p.teams?.name || 'INDEPENDENT'}</h2>
                        <p style="font-size: 12px; color: #64748B; margin-top: 4px;">BATCH ${p.batch_no || '1'}</p>
                    </div>
                </div>
            

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #1E293B; color: white; text-align: left;">
                            <th style="padding: 12px; font-size: 11px;">#</th>
                            <th style="padding: 12px; font-size: 11px;">PROGRAM (COMPETITION)</th>
                            <th style="padding: 12px; font-size: 11px;">CATEGORY</th>
                            <th style="padding: 12px; font-size: 11px; text-align: center;">AWARDED MARKS</th>
                            <th style="padding: 12px; font-size: 11px; text-align: right;">POINTS EARNED</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                    <tfoot>
                        <tr style="background: #F1F5F9; border-top: 2px solid #CBD5E1;">
                            <td colspan="4" style="padding: 16px; text-align: right; font-weight: 800; font-size: 14px; color: #0F172A;">TOTAL AGGREGATED POINTS:</td>
                            <td style="padding: 16px; text-align: right; font-weight: 900; font-size: 16px; color: #4F46E5;">${p.totalPoints}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 0, 
        filename: `Fest_Participant_Points_Report.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported Successfully!'));
}

async function handleElementUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show a quick loading state on the button to let the admin know it's uploading
    const uploadBtn = event.target.nextElementSibling; 
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `element_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('elements') // Pointing to the new bucket we created in SQL
            .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // 2. Get the permanent Public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from('elements')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        // 3. Load the URL into the Studio Canvas
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = function() {
            const key = 'Element_' + Date.now();
            
            // Scale down initially if the image is massive
            let initialWidth = img.naturalWidth;
            let initialHeight = img.naturalHeight;
            if (initialWidth > 300) {
                initialHeight = initialHeight * (300 / initialWidth);
                initialWidth = 300;
            }

            // Inside handleElementUpload, update the properties:
            studioActiveData.fields[key] = {
                enabled: true,
                displayName: file.name.substring(0, 15) + '...',
                x: 50,
                y: 50,
                w: Math.round(initialWidth),
                h: Math.round(initialHeight),
                isImage: true,
                isStaticElement: true,
                aspectLocked: true, // NEW: Default to locked
                aspectRatio: initialWidth / initialHeight, // NEW: Store initial ratio
                src: publicUrl, 
                imgObj: img
            };
            
            renderLayersPanel();
            selectStudioLayer(key);
            
            // Clear the input so the same file can be uploaded again if needed
            document.getElementById('studio-element-upload').value = ''; 
        };
        
        img.src = publicUrl;

    } catch (err) {
        console.error("Upload error:", err);
        showToast("Failed to upload element to cloud.", "error");
    } finally {
        // Reset the button UI
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
}



function toggleAspectRatioLock(key) {
    const data = studioActiveData.fields[key];
    data.aspectLocked = !data.aspectLocked;
    
    // Recalculate ratio upon locking if they changed it while unlocked
    if (data.aspectLocked && data.w > 0 && data.h > 0) {
        data.aspectRatio = data.w / data.h;
    }
    renderPropertiesPanel();
}

// --- UNDO / REDO STATE ENGINE ---
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 25; // Prevents memory leaks
let isRestoringHistory = false;

function saveHistoryState() {
    if (!studioActiveData || !studioActiveData.fields || isRestoringHistory) return;
    
    // Create a deep copy of the layer configurations
    const stateCopy = {};
    for (const key in studioActiveData.fields) {
        stateCopy[key] = { ...studioActiveData.fields[key] };
    }
    
    undoStack.push(stateCopy);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    
    redoStack = []; // A new action invalidates the future redo timeline
    updateHistoryButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    isRestoringHistory = true;
    
    // Push current to redo
    const currentState = {};
    for (const key in studioActiveData.fields) {
        currentState[key] = { ...studioActiveData.fields[key] };
    }
    redoStack.push(currentState);
    
    // Restore past
    studioActiveData.fields = undoStack.pop();
    finalizeHistoryAction();
}

function redo() {
    if (redoStack.length === 0) return;
    isRestoringHistory = true;
    
    // Push current to undo
    const currentState = {};
    for (const key in studioActiveData.fields) {
        currentState[key] = { ...studioActiveData.fields[key] };
    }
    undoStack.push(currentState);
    
    // Restore future
    studioActiveData.fields = redoStack.pop();
    finalizeHistoryAction();
}

function finalizeHistoryAction() {
    if (typeof multiSelectedLayers !== 'undefined') multiSelectedLayers.clear(); // CRITICAL FIX
    studioActiveField = null; 
    updateHistoryButtons();
    renderLayersPanel();
    renderPropertiesPanel();
    drawStudioCanvas();
    isRestoringHistory = false;
}

function updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

async function handleFontUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show loading state
    const uploadBtn = event.target.nextElementSibling;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    try {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_').split('_')[0]; 
        const fileName = `font_${safeName}_${Date.now()}.${fileExt}`;
        const familyName = `CustomFont_${Date.now()}`; // Unique internal CSS name

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('fonts')
            .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: publicUrlData } = supabaseClient.storage
            .from('fonts')
            .getPublicUrl(fileName);
        const publicUrl = publicUrlData.publicUrl;

        // 3. Load the Font into the Browser natively
        const customFont = new FontFace(familyName, `url(${publicUrl})`);
        const loadedFace = await customFont.load();
        document.fonts.add(loadedFace);

        // 4. Add to the Global Dropdown list
        const displayName = file.name.split('.')[0].substring(0, 15);
        AVAILABLE_FONTS.push({ name: `⭐ ${displayName}`, value: familyName });

        // 5. Save the font data into the template state so it persists in the database
        if (!studioActiveData.customFonts) studioActiveData.customFonts = [];
        studioActiveData.customFonts.push({ 
            name: `⭐ ${displayName}`, 
            family: familyName, 
            url: publicUrl 
        });

        // 6. Automatically apply the new font to the currently selected text layer (if any)
        if (studioActiveField && !studioActiveData.fields[studioActiveField].isImage) {
            saveHistoryState(); // From your undo/redo engine
            studioActiveData.fields[studioActiveField].font = familyName;
        }

        renderPropertiesPanel();
        drawStudioCanvas();
        showToast("Custom font added successfully!", "success");

    } catch (err) {
        console.error("Font upload error:", err);
        showToast("Failed to upload font.", "error");
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        event.target.value = ''; // Reset input
    }
}

// ==========================================
// MASTER DATA CENTER & ZIP ENGINE (V2.0)
// ==========================================

let pendingSecureAction = null;
let pendingFileToImport = null;

// ALL Database tables in correct dependency order
const MASTER_TABLES = [
    'settings', 
    'categories', 
    'teams', 
    'competitions', 
    'templates', 
    'participants', 
    'participant_competitions', 
    'judgements', 
    'appeals'
];

// ALL Supabase Storage Buckets containing media
const STORAGE_BUCKETS = ['photos', 'templates', 'elements', 'fonts'];

function requestSecureAction(action) {
    pendingSecureAction = action;
    document.getElementById('master-auth-password').value = '';
    document.getElementById('masterPasswordModal').classList.add('show');
}

function handleBackupSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingFileToImport = file;
    requestSecureAction('import');
    event.target.value = ''; // Reset input
}

async function verifyMasterPassword() {
    const btn = document.getElementById('btn-verify-master');
    const pwd = document.getElementById('master-auth-password').value;
    
    if(!pwd) return showToast("Password required", "error");
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, role')
            .eq('username', user.username)
            .eq('password_hash', pwd)
            .single();

        if (error || !data) throw new Error("Invalid password");
        if (data.role !== 'master_admin') throw new Error("Unauthorized access level.");

        document.getElementById('masterPasswordModal').classList.remove('show');
        
        // Route to the requested action
        if (pendingSecureAction === 'export') await executeZipExport();
        if (pendingSecureAction === 'import') await executeZipImport();
        if (pendingSecureAction === 'reset') await executeFactoryReset();

    } catch (err) {
        showToast("Authentication failed: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Verify';
        btn.disabled = false;
        pendingSecureAction = null;
    }
}

// --- 1. FULL EXPORT LOGIC (DATABASE + STORAGE) ---
async function executeZipExport() {
    showToast("Gathering database & media files... This may take a minute.", "success");
    const zip = new JSZip();
    const dbFolder = zip.folder("database");
    const storageFolder = zip.folder("storage");

    try {
        // A. Export Database Tables
        for (const table of MASTER_TABLES) {
            const { data, error } = await supabaseClient.from(table).select('*');
            if (error) console.error(`Error fetching ${table}:`, error);
            dbFolder.file(`${table}.json`, JSON.stringify(data || [], null, 2));
        }

        // B. Export Storage Buckets (Images/Fonts)
        for (const bucket of STORAGE_BUCKETS) {
            const bucketFolder = storageFolder.folder(bucket);
            const { data: files, error: listError } = await supabaseClient.storage.from(bucket).list();
            
            if (listError || !files) continue;

            for (const file of files) {
                if (file.name === '.emptyFolderPlaceholder') continue; // Skip supabase hidden files
                
                const { data: blob, error: downloadError } = await supabaseClient.storage.from(bucket).download(file.name);
                if (blob && !downloadError) {
                    bucketFolder.file(file.name, blob);
                }
            }
        }

        // C. Generate Manifest
        zip.file("festos_manifest.json", JSON.stringify({
            exported_at: new Date().toISOString(),
            exported_by: user.username,
            version: "2.0",
            includes_media: true
        }, null, 2));

        // D. Download the ZIP
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `FestOS_FullBackup_${new Date().toISOString().split('T')[0]}.zip`);
        showToast("Complete System Export successful!", "success");

    } catch (err) {
        console.error("Export Error:", err);
        showToast("Failed to export complete data.", "error");
    }
}

// --- 2. FULL IMPORT LOGIC (DATABASE + STORAGE) ---
async function executeZipImport() {
    if (!pendingFileToImport) return;
    showToast("Restoring database and media files... Do not close page.", "warning");
    
    try {
        const zip = await JSZip.loadAsync(pendingFileToImport);
        
        // 1. Verify Manifest
        const manifestFile = zip.file("festos_manifest.json");
        if (!manifestFile) throw new Error("Invalid backup file. Manifest missing.");

        // 2. Restore Database Tables (In STRICT dependency order)
        for (const table of MASTER_TABLES) {
            const file = zip.file(`database/${table}.json`);
            if (file) {
                const jsonStr = await file.async("string");
                const tableData = JSON.parse(jsonStr);
                
                if (tableData.length > 0) {
                    const { error } = await supabaseClient.from(table).upsert(tableData);
                    if (error) console.error(`Import Error on ${table}:`, error);
                }
            }
        }

        // 3. Restore Storage Buckets (Upsert overwrites duplicates safely)
        for (const bucket of STORAGE_BUCKETS) {
            const folderRegex = new RegExp(`^storage/${bucket}/(.*)$`);
            // Find all files in the zip that belong in this bucket
            const filesInBucket = Object.keys(zip.files).filter(name => folderRegex.test(name) && !zip.files[name].dir);

            for (const filename of filesInBucket) {
                const fileObj = zip.file(filename);
                if (!fileObj) continue;

                const blob = await fileObj.async("blob");
                const cleanName = filename.replace(`storage/${bucket}/`, '');

                const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(cleanName, blob, {
                    upsert: true,
                    contentType: blob.type || 'application/octet-stream'
                });
                
                if (uploadError) console.error(`Failed to restore ${cleanName}:`, uploadError);
            }
        }
        
        showToast("System perfectly restored! Reloading...", "success");
        setTimeout(() => location.reload(), 2000);

    } catch (err) {
        console.error("Import Error:", err);
        showToast("Failed to restore system: " + err.message, "error");
    } finally {
        pendingFileToImport = null;
    }
}


async function resolveAppeal(ticketId, newStatus) {
    openConfirmModal("Resolve Appeal?", `Mark this ticket as ${newStatus.toUpperCase()}?`, async () => {
        try {
            const { error } = await supabaseClient.from('appeals').update({ status: newStatus }).eq('id', ticketId);
            if (error) throw error;
            showToast(`Ticket ${newStatus}!`);
            loadAdminAppeals();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function deleteAppeal(ticketId) {
    openConfirmModal("Delete Appeal?", "Are you sure you want to permanently delete this appeal ticket? This action cannot be undone.", async () => {
        try {
            const { error } = await supabaseClient.from('appeals').delete().eq('id', ticketId);
            if (error) throw error;
            showToast("Appeal ticket deleted successfully.");
            loadAdminAppeals();
        } catch (e) { showToast(e.message, 'error'); }
    });
}

async function executeFactoryReset() {
    openConfirmModal("Total Factory Reset?", "FINAL WARNING: This will permanently delete ALL tables, settings, photos, templates, and fonts. Proceed?", async () => {
        showToast("Initiating Total Factory Reset...", "warning");
        try {
            const reverseOrder = [...MASTER_TABLES].reverse();
            for (const table of reverseOrder) {
                await supabaseClient.from(table).delete().not('id', 'is', null);
            }
            for (const bucket of STORAGE_BUCKETS) {
                const { data: files } = await supabaseClient.storage.from(bucket).list();
                if (files && files.length > 0) {
                    const filePaths = files.map(f => f.name).filter(name => name !== '.emptyFolderPlaceholder');
                    if (filePaths.length > 0) await supabaseClient.storage.from(bucket).remove(filePaths);
                }
            }
            showToast("System Reset Complete. Everything wiped. Reloading...", "success");
            setTimeout(() => location.reload(), 2000);
        } catch (err) {
            showToast("Failed to complete full reset.", "error");
        }
    });
}

async function loadAdminAppeals() {
    try {
        const { data, error } = await supabaseClient
            .from('appeals')
            .select('*, teams(name), competitions(name), participants(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const tbody = document.getElementById('admin-appeals-tbody'); 
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No appeals found.</td></tr>';
            return;
        }

        data.forEach(ticket => {
            const statusClass = ticket.status === 'pending' ? 'badge-warning' : (ticket.status === 'approved' ? 'badge-success' : 'badge-danger');
            
            tbody.innerHTML += `
                <tr>
                    <td><span class="badge" style="background:var(--bg-main);">${ticket.issue_type}</span></td>
                    <td style="font-weight:700;">${ticket.teams?.name}</td>
                    <td>${ticket.competitions?.name || '-'} <br> <small>${ticket.participants?.name || '-'}</small></td>
                    <td><div style="max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ticket.description}">${ticket.description}</div></td>
                    <td><span class="badge ${statusClass}">${ticket.status.toUpperCase()}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${ticket.status === 'pending' ? `
                                <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--success); border-color:var(--success);" onclick="resolveAppeal('${ticket.id}', 'approved')" title="Approve"><i class="fa-solid fa-check"></i></button>
                                <button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="resolveAppeal('${ticket.id}', 'rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                            ` : '<span style="color:var(--text-muted); font-size:0.8rem; margin-right: 0.5rem;">Resolved</span>'}
                            
                            <!-- Master Admin Only Delete Button -->
                            <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteAppeal('${ticket.id}')" title="Delete Ticket"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (e) { showToast(e.message, 'error'); }
}






// ==========================================
// ADMIN CERTIFICATE GENERATION ENGINE
// ==========================================
async function bulkDownloadCertificates(compId) {
    showToast("Fetching data and preparing certificates...", "success");

    try {
        // 1. Fetch Certificate Template
        const { data: certTemplates } = await supabaseClient.from('templates').select('*').eq('type', 'certificate').limit(1);
        if (!certTemplates || certTemplates.length === 0) throw new Error("No Certificate template found. Please design one in the Poster Templates Studio first.");
        const template = certTemplates[0];

        // 2. Fetch Competition & Judgements with Registered Count
        const { data: comp } = await supabaseClient
            .from('competitions')
            .select('*, categories(name), participant_competitions(count)')
            .eq('id', compId)
            .single();
            
        if (!comp) throw new Error("Competition data could not be found.");

        const { data: judgements } = await supabaseClient
            .from('judgements')
            .select('participant_id, awarded_mark, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);
            
        if (!judgements || judgements.length === 0) throw new Error("No judgements found for this competition yet.");

        // 3. Group, Average, Drop Outliers (FIXED: Skip deleted participants)
        const pMap = {};
        judgements.forEach(j => {
            if (!j.participants) return; // Prevent crash if participant was deleted
            
            const pId = j.participant_id;
            if (!pMap[pId]) pMap[pId] = { participant: j.participants, marks: [] };
            pMap[pId].marks.push(parseFloat(j.awarded_mark));
        });

        // 4. Calculate Final Marks 
        const allResults = Object.values(pMap).map(p => {
            let sortedMarks = p.marks.sort((a, b) => a - b);
            if (sortedMarks.length >= 3) {
                sortedMarks = sortedMarks.slice(1, sortedMarks.length - 1);
            }
            const avg = sortedMarks.reduce((a, b) => a + b, 0) / sortedMarks.length;
            return { ...p, avgMark: avg };
        }).sort((a, b) => b.avgMark - a.avgMark); 

        // 5. Determine Grades and Positions with Tie Handling
        await loadPointSettings(); 
        
        let currentRank = 1;
        let previousScore = -1;

        allResults.forEach((r, idx) => {
            // Increment rank only if the score differs from the previous
            if (r.avgMark !== previousScore) currentRank = idx + 1;
            previousScore = r.avgMark;
            r.numericRank = currentRank;

            let percent = (r.avgMark / (comp.max_mark || 100)) * 100;
            let gradeStr = 'N/A';
            if (percent >= 50) {
                if (percent >= pointsAdminSettings.thresholds.aplus) gradeStr = 'A+';
                else if (percent >= pointsAdminSettings.thresholds.a) gradeStr = 'A';
                else if (percent >= pointsAdminSettings.thresholds.b) gradeStr = 'B';
                else gradeStr = 'C';
            }
            r.grade = gradeStr;
            
            // Assign textual position based on the calculated rank
            r.position = currentRank === 1 ? 'FIRST PLACE' : currentRank === 2 ? 'SECOND PLACE' : currentRank === 3 ? 'THIRD PLACE' : 'PARTICIPANT';
            
            // Add "& PARTY" for Group Events on the Certificate
            if (comp.is_group && !r.participant.name.endsWith('& PARTY')) {
                r.participant.name += " & PARTY";
            }
        });

        // 6. Slice Top 3 Based on Rank (This safely captures all tied participants)
        const results = allResults.filter(r => r.numericRank <= 3);

        if (results.length === 0) throw new Error("Could not calculate top standings. No valid participant data.");

        // 7. Generate PDF via Canvas
        const { jsPDF } = window.jspdf;
        let pdf = null;
        let pdfConfig = null;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        await new Promise((resolve, reject) => {
            img.onload = resolve; img.onerror = reject; img.src = template.bg_base64;
        });

        // Preload custom fonts from template
        if (template.customFonts && template.customFonts.length > 0) {
            for (const fontData of template.customFonts) {
                try {
                    const customFont = new FontFace(fontData.family, `url(${fontData.url})`);
                    const loadedFace = await customFont.load();
                    document.fonts.add(loadedFace);
                } catch (e) { console.error("Font load error:", e); }
            }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || 1080; 
        canvas.height = img.naturalHeight || 1080;

        for (let i = 0; i < results.length; i++) {
            const entry = results[i];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // FIXED: Added fallback placeholders so it never crashes on null data
            const mappedData = {
                'ParticipantName': (entry.participant?.name || 'UNKNOWN').toUpperCase(),
                'UniqueID': entry.participant?.unique_id || '',
                'TeamName': (entry.participant?.teams?.name || 'INDEPENDENT').toUpperCase(),
                'Category': (comp.categories?.name || 'GENERAL').toUpperCase(),
                'Competition': (comp.name || 'EVENT').toUpperCase(),
                'Position': entry.position,
                'Grade': entry.grade,
                'IssueDate': new Date().toLocaleDateString()
            };

            // Draw QR Code if enabled in template
            if (template.fields['QRCode'] && template.fields['QRCode'].enabled) {
                const f = template.fields['QRCode'];
                const qrContainer = document.createElement('div');
                new QRCode(qrContainer, { text: entry.participant.unique_id, width: f.w, height: f.h, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
                await new Promise(r => setTimeout(r, 50));
                const qrCanvas = qrContainer.querySelector('canvas');
                if(qrCanvas) ctx.drawImage(qrCanvas, f.x, f.y, f.w, f.h);
            }

            // Draw text and static overlays
            if(template.fields) {
                for (const [key, fieldConfig] of Object.entries(template.fields)) {
                    if (!fieldConfig.enabled || key === 'QRCode' || fieldConfig.isImage) {
                        if (fieldConfig.isImage && fieldConfig.isStaticElement && fieldConfig.src && fieldConfig.enabled) {
                            try {
                                const staticImg = await new Promise((resolve) => {
                                    const pImg = new Image(); pImg.crossOrigin = "Anonymous";
                                    pImg.onload = () => resolve(pImg); pImg.onerror = () => resolve(null); pImg.src = fieldConfig.src;
                                });
                                if (staticImg) ctx.drawImage(staticImg, fieldConfig.x, fieldConfig.y, fieldConfig.w, fieldConfig.h);
                            } catch (err) {}
                        }
                        continue;
                   }
                    const text = fieldConfig.isCustom ? fieldConfig.displayName : (mappedData[key] || ""); 
                    if (!text) continue;
                    ctx.textAlign = fieldConfig.align || 'left'; 
                    ctx.fillStyle = fieldConfig.color || '#000000';
                    ctx.font = `${fieldConfig.weight || 'bold'} ${fieldConfig.size || 40}px ${fieldConfig.font || 'sans-serif'}`;
                    ctx.fillText(text, fieldConfig.x, fieldConfig.y);
                }
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            if (!pdfConfig) {
                const baseWidthMm = 297; // A4 Landscape
                const calculatedHeightMm = (canvas.height * baseWidthMm) / canvas.width;
                pdfConfig = {
                    width: baseWidthMm,
                    height: calculatedHeightMm,
                    orientation: baseWidthMm > calculatedHeightMm ? 'landscape' : 'portrait'
                };
                pdf = new jsPDF({ orientation: pdfConfig.orientation, unit: 'mm', format: [pdfConfig.width, pdfConfig.height] });
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfConfig.width, pdfConfig.height);
            if (i < results.length - 1) pdf.addPage();
        }

        pdf.save(`${comp.name.replace(/\s+/g, '_')}_Certificates.pdf`);
        showToast("Certificates Downloaded Successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
}

// ==========================================
// COMPETITION MASTER LOG ENGINE
// ==========================================
let currentLogData = null;

async function viewCompetitionLog(compId) {
    const comp = competitionsList.find(c => c.id === compId);
    if(!comp) return;

    document.getElementById('log-comp-name').innerText = comp.name;
    document.getElementById('log-cat-name').innerText = comp.categories?.name || 'GENERAL';

    const tbody = document.getElementById('log-tbody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem; display: block;"></i> Fetching Records...</td></tr>';
    document.getElementById('compLogModal').classList.add('show');

    try {
        await loadPointSettings(); // Ensure points settings are loaded for grade calculation

        // Fetch enrollments and participants
        const { data: enrollments, error: enrollErr } = await supabaseClient
            .from('participant_competitions')
            .select('participant_id, is_present, code_letter, is_leader, participants(name, unique_id, teams(name))')
            .eq('competition_id', compId);

        if (enrollErr) throw enrollErr;

        // Fetch judgements and judge names
        const { data: judgements, error: judgeErr } = await supabaseClient
            .from('judgements')
            .select('participant_id, awarded_mark, users(username)')
            .eq('competition_id', compId);

        if (judgeErr) throw judgeErr;

        // Calculate results (marks, grades, points)
        let compResults = {};
        if (judgements && judgements.length > 0) {
            let pMarks = {};
            judgements.forEach(j => {
                if(!pMarks[j.participant_id]) pMarks[j.participant_id] = [];
                pMarks[j.participant_id].push(parseFloat(j.awarded_mark));
            });

            let pAverages = Object.keys(pMarks).map(pId => {
                let marks = pMarks[pId].sort((a, b) => a - b);
                if (marks.length >= 3) marks = marks.slice(1, marks.length - 1);
                let avg = marks.reduce((a, b) => a + b, 0) / marks.length;
                return { id: pId, mark: avg };
            }).sort((a, b) => b.mark - a.mark);

           const limit = comp.max_participants || 1;
            const sizeCat = limit >= 4 ? 'large' : (limit >= 2 ? 'small' : 'solo');
            
            // REMOVED: const eligibleForPosPts = enrollments.length >= 3;
            
            let currentRank = 1;
            let previousScore = -1;

            pAverages.forEach((p, idx) => {
                // Proper tie handling
                if (p.mark !== previousScore) currentRank = idx + 1;
                previousScore = p.mark;

                let percent = (p.mark / (comp.max_mark || 100)) * 100;
                let grade = '-'; let gradePts = 0; let posPts = 0;

                // 1. Assign Grade Points ONLY if >= 50% (Wrapped in Number() to force math addition)
                if (percent >= 50) {
                    if (percent >= pointsAdminSettings.thresholds.aplus) { grade = 'A+'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].aplus) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.a) { grade = 'A'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].a) || 0; }
                    else if (percent >= pointsAdminSettings.thresholds.b) { grade = 'B'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].b) || 0; }
                    else { grade = 'C'; gradePts = Number(pointsAdminSettings[`points_${sizeCat}`].c) || 0; }
                }

                // 2. Assign Position Points ALWAYS for Top 3 (Removed the >= 3 limit)
                if (currentRank <= 3) {
                    if (currentRank === 1) posPts = Number(pointsAdminSettings.pos_points.p1) || 0;
                    else if (currentRank === 2) posPts = Number(pointsAdminSettings.pos_points.p2) || 0;
                    else if (currentRank === 3) posPts = Number(pointsAdminSettings.pos_points.p3) || 0;
                }

                compResults[p.id] = {
                    rank: currentRank,
                    mark: p.mark.toFixed(2),
                    grade: grade,
                    points: gradePts + posPts
                };
            });
        }

        currentLogData = { comp, enrollments: enrollments || [], judgements: judgements || [], compResults };

        let totalEnrolled = enrollments ? enrollments.length : 0;
        let totalPresent = enrollments ? enrollments.filter(e => e.is_present).length : 0;
        let uniqueJudges = new Set((judgements || []).map(j => j.users?.username).filter(Boolean));

        document.getElementById('log-summary').innerHTML = `
            <div class="badge" style="background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-users"></i> ${totalEnrolled} ENROLLED</div>
            <div class="badge" style="background: var(--success-light); color: var(--success); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-check-circle"></i> ${totalPresent} CHECKED-IN</div>
            <div class="badge" style="background: var(--primary-light); color: var(--primary); padding: 0.5rem 1rem; font-size: 0.8rem;"><i class="fa-solid fa-gavel"></i> ${uniqueJudges.size} JUDGE(S)</div>
        `;

        tbody.innerHTML = '';
        if (!enrollments || enrollments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 2rem;">No participants enrolled in this event.</td></tr>';
            return;
        }

      // Sort alphabetically by participant name
        enrollments.sort((a, b) => a.participants.name.localeCompare(b.participants.name)).forEach(e => {
            const p = e.participants;
            const statusBadge = e.is_present 
                ? '<span class="badge" style="background: var(--success-light); color: var(--success); font-size: 0.7rem;">REGISTERED</span>' 
                : '<span class="badge" style="background: var(--warning-light); color: #D97706; font-size: 0.7rem;">PENDING</span>';
            
            // Map judgements for this specific participant
            const pJudgements = (judgements || []).filter(j => j.participant_id === e.participant_id);
            let judgeHtml = '';
            if(pJudgements.length > 0) {
                judgeHtml = pJudgements.map(j => `<div style="font-size: 0.85rem; margin-bottom: 4px; background: var(--bg-main); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); display: inline-block; margin-right: 4px;"><span style="color: var(--text-muted); font-weight: 600;">${j.users?.username || 'Admin'}:</span> <span style="color:var(--primary); font-weight: 800;">${j.awarded_mark}</span></div>`).join('');
            } else {
                judgeHtml = '<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; background: var(--bg-main); padding: 4px 8px; border-radius: 4px;">Awaiting Marks</span>';
            }

            // Map Results Data
            const res = compResults[e.participant_id];
            const fMark = res ? res.mark : '-';
            const fGrade = res ? `<span style="font-weight: 800; color: var(--text-main);">${res.grade}</span>` : '-';
            const fPoints = res ? `<span style="font-weight: 800; color: var(--primary);">${res.points}</span>` : '-';

            // --- DISPLAY "& PARTY" FOR LEADERS IN ADMIN LOG ---
            let displayName = p.name;
            let roleTag = '';
            if (comp.is_group) {
                if (e.is_leader) {
                    displayName += ' & PARTY';
                    roleTag = '<br><span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; margin-top: 4px;">GROUP LEADER</span>';
                } else {
                    roleTag = '<br><span class="badge" style="background: var(--bg-main); color: var(--text-muted); font-size: 0.65rem; margin-top: 4px;">MEMBER</span>';
                }
            }

            tbody.innerHTML += `
                <tr>
                    <td style="white-space: nowrap;">
                        <strong style="display:block; font-size: 1rem; color: var(--text-main);">${displayName}</strong>
                        <small style="font-family:monospace; font-weight: 600; color:var(--text-muted);">${p.unique_id}</small>
                        ${roleTag}
                    </td>
                    <td><span class="badge" style="background: var(--bg-main); color: var(--text-muted);">${p.teams?.name || 'INDEPENDENT'}</span></td>
                    <td style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">${e.code_letter || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>${judgeHtml}</td>
                    <td style="font-weight: 800; font-size: 1.1rem;">${fMark}</td>
                    <td>${fGrade}</td>
                    <td>${fPoints}</td>
                </tr>
            `;
        });

    } catch (e) {
        showToast(e.message, 'error');
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger); font-weight: 600; padding: 2rem;">Error loading log data.</td></tr>`;
    }
}

async function downloadCompLogPDF() {
    if(!currentLogData) return showToast("No data to export", "error");
    showToast("Generating Premium Report...", "success");

    const { comp, enrollments, judgements, compResults } = currentLogData;
    const totalEnrolled = enrollments.length;
    const totalPresent = enrollments.filter(e => e.is_present).length;
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    
    // Header
    container.innerHTML = `
        ${getPDFHeaderHTML('Competition Master Log')}
        
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="font-size: 16px; color: #0F172A; margin: 0; margin-bottom: 4px; text-transform: uppercase; font-weight: 800;">${comp.name}</h3>
                <p style="font-size: 11px; color: #64748B; margin: 0; text-transform: uppercase; font-weight: 600;">CATEGORY: ${comp.categories?.name || 'GENERAL'} | STAGE: ${comp.stages?.name || 'TBD'}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 11px; font-weight: 700; color: #0F172A; margin: 0; text-transform: uppercase;">ENROLLED: ${totalEnrolled}</p>
                <p style="font-size: 11px; font-weight: 700; color: #10B981; margin: 0; margin-top: 4px; text-transform: uppercase;">CHECKED-IN: ${totalPresent}</p>
            </div>
        </div>
    `;

    // Sort enrollments alphabetically for the PDF
    const sortedEnrollments = [...enrollments].sort((a, b) => a.participants.name.localeCompare(b.participants.name));

    // Table Data
    let tableRows = sortedEnrollments.map((e, index) => {
        const p = e.participants;
        const status = e.is_present ? 'REGISTERED' : 'PENDING';
        const statusColor = e.is_present ? '#10B981' : '#F59E0B';
        
        const pJudgements = judgements.filter(j => j.participant_id === e.participant_id);
        let judgeText = pJudgements.length > 0 
            ? pJudgements.map(j => `${j.users?.username || 'Admin'}: ${j.awarded_mark}`).join(' | ') 
            : 'Awaiting Marks';

        const res = compResults[e.participant_id];
        const fMark = res ? res.mark : '-';
        const fGrade = res ? res.grade : '-';
        const fPoints = res ? res.points : '-';

        return `
            <tr>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0;">${index + 1}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-weight: 700; color: #0F172A;">${p.name.toUpperCase()}</span><br>
                    <span style="font-size: 10px; color: #64748B; font-family: monospace; font-weight: 600;">${p.unique_id}</span>
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #475569;">${(p.teams?.name || 'IND').toUpperCase()}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #4F46E5;">${e.code_letter || '-'}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; color: ${statusColor}; font-weight: 800;">${status}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-size: 11px; font-weight: 600; color: #475569;">${judgeText.toUpperCase()}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #0F172A;">${fMark}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #0F172A;">${fGrade}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #E2E8F0; font-weight: 800; color: #4F46E5;">${fPoints}</td>
            </tr>
        `;
    }).join('');

    if (enrollments.length === 0) {
        tableRows = `<tr><td colspan="9" style="padding: 20px; text-align: center; color: #64748B; font-weight: 600;">No participants found.</td></tr>`;
    }

    container.innerHTML += `
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
            <thead>
                <tr style="background: #F1F5F9; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">
                    <th style="padding: 12px 10px;">#</th>
                    <th style="padding: 12px 10px;">PARTICIPANT</th>
                    <th style="padding: 12px 10px;">TEAM</th>
                    <th style="padding: 12px 10px;">CODE</th>
                    <th style="padding: 12px 10px;">STATUS</th>
                    <th style="padding: 12px 10px;">JUDGES</th>
                    <th style="padding: 12px 10px;">FINAL MARK</th>
                    <th style="padding: 12px 10px;">GRADE</th>
                    <th style="padding: 12px 10px;">PTS</th>
                </tr>
            </thead>
            <tbody style="font-size: 12px; color: #334155;">
                ${tableRows}
            </tbody>
        </table>
    `;

    // Download PDF Config (Using Landscape for wider table)
    const opt = { 
        margin: 10, 
        filename: `FestOS_Log_${comp.name.replace(/[^a-z0-9]/gi, '_')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => {
        const btn = document.getElementById('btn-download-log');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Downloaded!';
        setTimeout(() => btn.innerHTML = origText, 2000);
    });
}

// Dynamic Branded PDF Header Generator
function getPDFHeaderHTML(reportTitle) {
    const cachedBranding = JSON.parse(localStorage.getItem('festBranding') || JSON.stringify(window.systemBranding || {}));
    const validName = cachedBranding.fest_name && cachedBranding.fest_name.trim() !== '';
    const validLogo = cachedBranding.fest_logo && cachedBranding.fest_logo.trim() !== '';
    const displayMode = cachedBranding.display_mode || 'both';
    
    let brandHtml = '';
    
    const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
    const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
    
    if (showLogo) {
        brandHtml += `<img src="${cachedBranding.fest_logo}" style="height: 60px; max-width: 250px; object-fit: contain; margin-bottom: 12px; border-radius: 8px;">`;
    }
    
    if (showName) {
        brandHtml += `<h1 style="color: #4F46E5; margin-bottom: 5px; font-size: 26px; text-transform: uppercase; font-weight: 800;">${validName ? cachedBranding.fest_name : 'FESTOS'}</h1>`;
    } else if (validLogo && !showName) {
        // Keeps spacing correct if only the logo is printed
        brandHtml += `<div style="height: 10px;"></div>`;
    }

    return `
        <div style="text-align: center; margin-bottom: 30px;">
            ${brandHtml}
            <h2 style="color: #1E293B; font-size: 18px; margin-top:0; text-transform: uppercase;">${reportTitle}</h2>
            <p style="color: #64748B; font-size: 12px; margin-top: 4px;">Generated on: ${new Date().toLocaleString()}</p>
        </div>
    `;
}
// ============================================================================
// SPECTATOR DISPLAY CONTROL ENGINE
// ============================================================================

let globalCustomSlides = [];
let pendingCSFile = null;
let pendingCSImagePreview = null;

async function loadDisplaySettings() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
        if (data && data.value) {
            const v = data.value;
            if(document.getElementById('disp-duration')) document.getElementById('disp-duration').value = v.slide_duration || 12;
            if(document.getElementById('disp-color')) document.getElementById('disp-color').value = v.primary_color || '#4F46E5';
            if(document.getElementById('disp-font')) document.getElementById('disp-font').value = v.font_family || 'Plus Jakarta Sans';
            
            const qrCheck = document.getElementById('disp-show-qr');
            if (qrCheck) { qrCheck.checked = v.show_qr !== false; qrCheck.dispatchEvent(new Event('change')); }
            
            // Load custom slides array
            globalCustomSlides = v.custom_slides || [];
        }
        renderCustomSlidesList();
        scalePreviewIframe();
    } catch(e) { console.warn("Using default display settings."); }
}

async function saveDisplaySettings(silent = false) {
    if(!silent) setLoading('display-control .btn-primary', true);
    
    // Fetch current state to avoid overwriting trigger_confetti
    const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
    let trigger_confetti = data && data.value ? data.value.trigger_confetti : 0;

    const payload = {
        slide_duration: parseInt(document.getElementById('disp-duration').value) || 12,
        primary_color: document.getElementById('disp-color').value || '#4F46E5',
        font_family: document.getElementById('disp-font').value || 'Plus Jakarta Sans',
        show_qr: document.getElementById('disp-show-qr').checked,
        custom_slides: globalCustomSlides,
        trigger_confetti: trigger_confetti
    };
    
    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'display_settings', value: payload });
        if (error) throw error;
        
        if(!silent) showToast("Display Settings Saved & Synced!");
        
        const iframe = document.getElementById('display-preview-frame');
        if(iframe) iframe.src = iframe.src; 

    } catch(e) {
        if(!silent) showToast(e.message, 'error');
    } finally {
        if(!silent) setLoading('display-control .btn-primary', false);
    }
}

// --- CUSTOM SLIDES CRUD ---
function renderCustomSlidesList() {
    const container = document.getElementById('custom-slides-list');
    container.innerHTML = '';
    
    if (globalCustomSlides.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--border); border-radius: 8px;">No custom slides created yet. Add one above!</div>`;
        return;
    }

    globalCustomSlides.forEach((slide, index) => {
        const isEnabled = slide.enabled !== false;
        container.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                    <img src="${slide.bg_url || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><rect width=\'100%\' height=\'100%\' fill=\'%23CBD5E1\'/></svg>'}" style="width: 60px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border);">
                    <div>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${slide.title || 'Untitled Slide'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; display: flex; gap: 0.75rem; margin-top: 0.2rem;">
                            ${slide.duration ? `<span><i class="fa-regular fa-clock"></i> ${slide.duration}s</span>` : '<span><i class="fa-regular fa-clock"></i> Default</span>'}
                            ${slide.qr_url ? `<span><i class="fa-solid fa-qrcode"></i> Custom QR</span>` : ''}
                            ${slide.ticker ? `<span><i class="fa-solid fa-bolt"></i> Ticker</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px; margin-right: 0.5rem;">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleCustomSlide(${index}, this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isEnabled ? 'var(--success)' : '#cbd5e1'}; transition: .4s; border-radius: 34px;"></span>
                        <span style="position: absolute; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${isEnabled ? 'translateX(20px)' : 'translateX(0)'};"></span>
                    </label>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.6rem;" onclick="openCustomSlideModal(${index})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; color: var(--danger); border-color: var(--danger);" onclick="deleteCustomSlide(${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function openCustomSlideModal(index = -1) {
    pendingCSFile = null;
    pendingCSImagePreview = null;
    document.getElementById('cs-bg-preview').style.display = 'none';
    document.getElementById('cs-bg-remove').style.display = 'none';
    document.getElementById('cs-bg-upload').value = '';

    if (index >= 0) {
        const slide = globalCustomSlides[index];
        document.getElementById('cs-id').value = slide.id;
        document.getElementById('cs-title').value = slide.title || '';
        document.getElementById('cs-text').value = slide.text || '';
        document.getElementById('cs-duration').value = slide.duration || '';
        document.getElementById('cs-color').value = slide.color || '#4F46E5';
        document.getElementById('cs-qr-url').value = slide.qr_url || '';
        document.getElementById('cs-qr-text').value = slide.qr_text || '';
        document.getElementById('cs-ticker').value = slide.ticker || '';

        if (slide.bg_url) {
            document.getElementById('cs-bg-preview').src = slide.bg_url;
            document.getElementById('cs-bg-preview').style.display = 'block';
            document.getElementById('cs-bg-remove').style.display = 'inline-flex';
            pendingCSImagePreview = slide.bg_url;
        }
    } else {
        document.getElementById('cs-id').value = 'cs_' + Date.now();
        document.getElementById('cs-title').value = '';
        document.getElementById('cs-text').value = '';
        document.getElementById('cs-duration').value = '';
        document.getElementById('cs-color').value = document.getElementById('disp-color').value || '#4F46E5';
        document.getElementById('cs-qr-url').value = '';
        document.getElementById('cs-qr-text').value = '';
        document.getElementById('cs-ticker').value = '';
    }

    document.getElementById('customSlideModal').classList.add('show');
}

function handleCSImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingCSFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingCSImagePreview = e.target.result;
        document.getElementById('cs-bg-preview').src = e.target.result;
        document.getElementById('cs-bg-preview').style.display = 'block';
        document.getElementById('cs-bg-remove').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function removeCSImage() {
    pendingCSFile = null;
    pendingCSImagePreview = null;
    document.getElementById('cs-bg-preview').src = '';
    document.getElementById('cs-bg-preview').style.display = 'none';
    document.getElementById('cs-bg-remove').style.display = 'none';
    document.getElementById('cs-bg-upload').value = '';
}

async function saveCustomSlide() {
    const title = document.getElementById('cs-title').value;
    if(!title) return showToast("A heading is required.", "error");

    setLoading('btn-save-cs', true);

    try {
        let finalBgUrl = pendingCSImagePreview;

        // If it's a completely new file, upload it to the 'elements' bucket
        if (pendingCSFile) {
            const fileExt = pendingCSFile.name.split('.').pop();
            const fileName = `slide_bg_${Date.now()}.${fileExt}`;
            const { data, error } = await supabaseClient.storage.from('elements').upload(fileName, pendingCSFile);
            if (error) throw error;
            const { data: urlData } = supabaseClient.storage.from('elements').getPublicUrl(fileName);
            finalBgUrl = urlData.publicUrl;
        }

        const id = document.getElementById('cs-id').value;
        const slideObj = {
            id: id,
            enabled: true,
            title: title,
            text: document.getElementById('cs-text').value,
            duration: document.getElementById('cs-duration').value || null,
            color: document.getElementById('cs-color').value,
            qr_url: document.getElementById('cs-qr-url').value || null,
            qr_text: document.getElementById('cs-qr-text').value || null,
            ticker: document.getElementById('cs-ticker').value || null,
            bg_url: finalBgUrl
        };

        const existingIndex = globalCustomSlides.findIndex(s => s.id === id);
        if (existingIndex >= 0) {
            // Keep enabled status if editing
            slideObj.enabled = globalCustomSlides[existingIndex].enabled;
            globalCustomSlides[existingIndex] = slideObj;
        } else {
            globalCustomSlides.push(slideObj);
        }

        await saveDisplaySettings(false); // Saves to DB and syncs preview
        document.getElementById('customSlideModal').classList.remove('show');

    } catch(e) {
        showToast("Error saving slide: " + e.message, "error");
    } finally {
        setLoading('btn-save-cs', false);
    }
}

async function toggleCustomSlide(index, isEnabled) {
    globalCustomSlides[index].enabled = isEnabled;
    await saveDisplaySettings(true); // silent sync
}

async function deleteTemplate(index) {
    openConfirmModal("Delete Template?", "Permanently delete this template from the cloud?", async () => {
        const templateId = savedTemplates[index].id;
        const { error } = await supabaseClient.from('templates').delete().eq('id', templateId);
        if (error) {
            showToast("Error deleting template", "error");
        } else {
            showToast("Template Deleted.");
            loadTemplatesList();
        }
    });
}

function deleteStudioLayer(key) {
    openConfirmModal("Delete Layer?", "Delete this layer permanently?", () => {
        saveHistoryState();
        delete studioActiveData.fields[key];
        if (studioActiveField === key) studioActiveField = null;
        if (typeof multiSelectedLayers !== 'undefined') multiSelectedLayers.delete(key); // CRITICAL FIX
        renderLayersPanel();
        renderPropertiesPanel();
        drawStudioCanvas();
    });
}

async function deleteSchedule(compId) {
    openConfirmModal("Remove Schedule?", "Remove this event from the schedule?", async () => {
        delete masterSchedule[compId];
        try {
            const { error } = await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
            if (error) throw error;
            showToast(`Schedule deleted.`);
            filterScheduleTable();
        } catch(e) { showToast(e.message, 'error'); }
    });
}

async function deleteCustomSlide(index) {
    openConfirmModal("Delete Slide?", "Remove this custom slide permanently?", async () => {
        globalCustomSlides.splice(index, 1);
        await saveDisplaySettings(false);
    });
}


async function triggerManualConfetti() {
    try {
        const { data } = await supabaseClient.from('settings').select('value').eq('id', 'display_settings').maybeSingle();
        let payload = data?.value || { slide_duration: 12, show_qr: true };
        payload.trigger_confetti = Date.now(); // Forces all listening displays to trigger
        await supabaseClient.from('settings').upsert({ id: 'display_settings', value: payload });
        showToast("Celebration triggered on live displays!", "success");
    } catch(e) {
        showToast("Failed to trigger animation.", "error");
    }
}

function scalePreviewIframe() {
    const iframe = document.getElementById('display-preview-frame');
    if (iframe && iframe.parentElement) {
        const parent = iframe.parentElement;
        const parentWidth = parent.clientWidth;
        const scale = parentWidth / 1920;
        iframe.style.transform = `scale(${scale})`;
        const calculatedHeight = parentWidth * (1080 / 1920);
        parent.style.height = `${calculatedHeight}px`;
    }
}
window.addEventListener('resize', scalePreviewIframe);

// ==========================================
// EVENT SCHEDULE ENGINE
// ==========================================
let masterSchedule = {}; // <-- THIS WAS MISSING

// ========================================================================
// ⚡ SCHEDULE MANAGEMENT, CONFLICT DETECTOR & AUTO-OPTIMIZER
// ========================================================================

let scheduleConflictsReport = { hardClashes: [], bufferWarnings: [], stageCollisions: [], totalConflicts: 0, compConflictMap: {} };
let scheduleEnrollmentsCache = null;
let scheduleEnrollmentsCacheTime = 0;
let currentAuditFilter = 'all';
let pendingOptimizedSchedule = null;

async function fetchScheduleEnrollments(forceRefresh = false) {
    const now = Date.now();
    if (scheduleEnrollmentsCache && !forceRefresh && (now - scheduleEnrollmentsCacheTime < 60000)) {
        return scheduleEnrollmentsCache;
    }
    try {
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select('competition_id, participant_id, participants(id, name, unique_id, team_id, teams(name))');
        if (error) throw error;
        scheduleEnrollmentsCache = data || [];
        scheduleEnrollmentsCacheTime = now;
        return scheduleEnrollmentsCache;
    } catch(e) {
        console.warn("Could not fetch schedule enrollments:", e);
        return scheduleEnrollmentsCache || [];
    }
}

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToTimeString(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function detectScheduleConflicts() {
    const enrollments = await fetchScheduleEnrollments();
    
    const compStudentsMap = {};
    enrollments.forEach(e => {
        if (!e.competition_id || !e.participant_id) return;
        if (!compStudentsMap[e.competition_id]) compStudentsMap[e.competition_id] = [];
        compStudentsMap[e.competition_id].push(e.participants);
    });

    const scheduledCompIds = Object.keys(masterSchedule).filter(id => {
        const comp = competitionsList.find(c => c.id == id);
        return comp && masterSchedule[id]?.date && masterSchedule[id]?.time;
    });

    const hardClashes = [];
    const bufferWarnings = [];
    const stageCollisions = [];
    const compConflictMap = {};

    for (let i = 0; i < scheduledCompIds.length; i++) {
        const idA = scheduledCompIds[i];
        const compA = competitionsList.find(c => c.id == idA);
        const schedA = masterSchedule[idA];
        
        const startMinsA = timeStringToMinutes(schedA.time);
        let endMinsA = schedA.to_time ? timeStringToMinutes(schedA.to_time) : (startMinsA + (parseInt(schedA.manual_time) || 30));
        if (endMinsA <= startMinsA) endMinsA = startMinsA + 30;

        for (let j = i + 1; j < scheduledCompIds.length; j++) {
            const idB = scheduledCompIds[j];
            const compB = competitionsList.find(c => c.id == idB);
            const schedB = masterSchedule[idB];

            // Only check conflicts if on the SAME DATE
            if (schedA.date !== schedB.date) continue;

            const startMinsB = timeStringToMinutes(schedB.time);
            let endMinsB = schedB.to_time ? timeStringToMinutes(schedB.to_time) : (startMinsB + (parseInt(schedB.manual_time) || 30));
            if (endMinsB <= startMinsB) endMinsB = startMinsB + 30;

            const isTimeOverlapping = (startMinsA < endMinsB) && (startMinsB < endMinsA);

            // 1. Stage Collision Check
            if (compA.stage_id && compB.stage_id && String(compA.stage_id) === String(compB.stage_id)) {
                if (isTimeOverlapping) {
                    const stageName = stagesList.find(s => s.id == compA.stage_id)?.name || `Stage ${compA.stage_id}`;
                    stageCollisions.push({
                        type: 'stage',
                        date: schedA.date,
                        stageName,
                        compA,
                        compB,
                        timeA: `${schedA.time} - ${schedA.to_time || minutesToTimeString(endMinsA)}`,
                        timeB: `${schedB.time} - ${schedB.to_time || minutesToTimeString(endMinsB)}`
                    });

                    if (!compConflictMap[idA]) compConflictMap[idA] = [];
                    if (!compConflictMap[idB]) compConflictMap[idB] = [];
                    compConflictMap[idA].push({ type: 'stage', otherComp: compB, desc: `Double booked on ${stageName}` });
                    compConflictMap[idB].push({ type: 'stage', otherComp: compA, desc: `Double booked on ${stageName}` });
                }
            }

            // 2. Student Clashes Check
            const studentsA = compStudentsMap[idA] || [];
            const studentsB = compStudentsMap[idB] || [];
            
            // Find common participants
            const commonStudents = studentsA.filter(sA => sA && studentsB.some(sB => sB && sB.id === sA.id));

            if (commonStudents.length > 0) {
                commonStudents.forEach(student => {
                    const stageNameA = stagesList.find(s => s.id == compA.stage_id)?.name || 'Stage TBD';
                    const stageNameB = stagesList.find(s => s.id == compB.stage_id)?.name || 'Stage TBD';

                    if (isTimeOverlapping) {
                        // Hard Clash
                        hardClashes.push({
                            type: 'hard',
                            date: schedA.date,
                            student,
                            compA,
                            compB,
                            stageNameA,
                            stageNameB,
                            timeA: `${schedA.time} - ${schedA.to_time || minutesToTimeString(endMinsA)}`,
                            timeB: `${schedB.time} - ${schedB.to_time || minutesToTimeString(endMinsB)}`
                        });

                        if (!compConflictMap[idA]) compConflictMap[idA] = [];
                        if (!compConflictMap[idB]) compConflictMap[idB] = [];
                        compConflictMap[idA].push({ type: 'hard', student, otherComp: compB, desc: `Student ${student.name} clashing with ${compB.name}` });
                        compConflictMap[idB].push({ type: 'hard', student, otherComp: compA, desc: `Student ${student.name} clashing with ${compA.name}` });
                    } else {
                        // Check Buffer (< 15 mins between events on different stages)
                        let gapMins = 0;
                        if (endMinsA <= startMinsB) {
                            gapMins = startMinsB - endMinsA;
                        } else if (endMinsB <= startMinsA) {
                            gapMins = startMinsA - endMinsB;
                        }

                        if (gapMins < 15 && String(compA.stage_id) !== String(compB.stage_id)) {
                            bufferWarnings.push({
                                type: 'buffer',
                                date: schedA.date,
                                student,
                                gapMins,
                                compA,
                                compB,
                                stageNameA,
                                stageNameB,
                                timeA: `${schedA.time} - ${schedA.to_time || minutesToTimeString(endMinsA)}`,
                                timeB: `${schedB.time} - ${schedB.to_time || minutesToTimeString(endMinsB)}`
                            });

                            if (!compConflictMap[idA]) compConflictMap[idA] = [];
                            if (!compConflictMap[idB]) compConflictMap[idB] = [];
                            compConflictMap[idA].push({ type: 'buffer', student, otherComp: compB, desc: `Only ${gapMins}m buffer for ${student.name}` });
                            compConflictMap[idB].push({ type: 'buffer', student, otherComp: compA, desc: `Only ${gapMins}m buffer for ${student.name}` });
                        }
                    }
                });
            }
        }
    }

    const totalConflicts = hardClashes.length + bufferWarnings.length + stageCollisions.length;
    scheduleConflictsReport = { hardClashes, bufferWarnings, stageCollisions, totalConflicts, compConflictMap };

    // Update UI Elements
    const banner = document.getElementById('schedule-conflict-banner');
    const badgeCount = document.getElementById('conflict-badge-count');
    const titleElem = document.getElementById('conflict-banner-title');
    const descElem = document.getElementById('conflict-banner-desc');

    if (badgeCount) {
        if (totalConflicts > 0) {
            badgeCount.innerText = totalConflicts;
            badgeCount.style.display = 'inline-block';
        } else {
            badgeCount.style.display = 'none';
        }
    }

    if (banner) {
        if (totalConflicts > 0) {
            banner.style.display = 'flex';
            if (titleElem) titleElem.innerText = `${totalConflicts} Schedule Conflict${totalConflicts > 1 ? 's' : ''} Detected`;
            if (descElem) {
                descElem.innerText = `${hardClashes.length} hard student clash(es), ${bufferWarnings.length} tight buffer(s) (<15m), ${stageCollisions.length} stage double-booking(s).`;
            }
        } else {
            banner.style.display = 'none';
        }
    }

    return scheduleConflictsReport;
}

async function loadSchedules() {
    try {
        const promises = [];
        if (competitionsList.length === 0) promises.push(loadCompetitions());
        if (stagesList.length === 0) promises.push(loadStagesAndTeams());
        promises.push(supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle());

        const results = await Promise.all(promises);
        const schedRes = results[results.length - 1];
        masterSchedule = schedRes?.data?.value || {};
        
        const filterCat = document.getElementById('filterSchedCat');
        if(filterCat && filterCat.options.length === 1) {
            categoriesList.forEach(c => filterCat.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        }

        const filterStage = document.getElementById('filterSchedStage');
        if(filterStage && filterStage.options.length === 1) {
            stagesList.forEach(s => filterStage.innerHTML += `<option value="${s.id}">${s.name}</option>`);
        }
        
        await detectScheduleConflicts();
        filterScheduleTable();
    } catch(e) { showToast(e.message, 'error'); }
}

function filterScheduleTable() {
    const search = document.getElementById('searchSchedInput').value.toLowerCase();
    const catId = document.getElementById('filterSchedCat').value;
    const stageId = document.getElementById('filterSchedStage').value; 
    const statusVal = document.getElementById('filterSchedStatus').value;
    const compStatusVal = document.getElementById('filterSchedCompStatus') ? document.getElementById('filterSchedCompStatus').value : ""; 
    
    const tbody = document.getElementById('schedule-tbody');
    tbody.innerHTML = '';
    
    let scheduledItems = Object.keys(masterSchedule).map(compId => {
        const comp = competitionsList.find(c => c.id == compId);
        return { compId, comp, sched: masterSchedule[compId] };
    }).filter(item => item.comp); 
    
    // STRICT SORT: Chronologically by Date, then Time
    scheduledItems.sort((a,b) => {
        if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
        return a.sched.time.localeCompare(b.sched.time);
    });

    scheduledItems.forEach(item => {
        const compCatId = item.comp.category_id;
        const compCatName = item.comp.categories?.name || 'General';
        const compStageId = item.comp.stage_id; 
        const compStageName = item.comp.stages?.name || 'TBD'; 
        
        const matchSearch = item.comp.name.toLowerCase().includes(search);
        const matchCat = catId === "" || compCatId == catId;
        const matchStage = stageId === "" || compStageId == stageId; 
        const matchStatus = statusVal === "" || item.sched.status === statusVal;
        const matchCompStatus = compStatusVal === "" || item.comp.status === compStatusVal; 
        
        if (!(matchSearch && matchCat && matchStage && matchStatus && matchCompStatus)) return; 
        
        const isPub = item.sched.status === 'published';
        const publishBadge = isPub 
            ? `<span class="badge" style="background:var(--success-light); color:var(--success);"><i class="fa-solid fa-globe"></i> Published</span>` 
            : `<span class="badge" style="background:var(--warning-light); color:var(--warning);"><i class="fa-solid fa-lock"></i> Draft</span>`;
            
        let compStateStr = item.comp.status.toUpperCase().replace('_', ' ');
        let compStateColor = '#64748B';
        if (item.comp.status === 'registration') compStateColor = '#1D4ED8';
        if (item.comp.status === 'ongoing') compStateColor = '#059669';
        if (item.comp.status === 'valuation') compStateColor = '#D97706';
        if (item.comp.status === 'judgement_complete') compStateColor = '#7E22CE';

        const stateBadge = `<br><span style="font-size: 0.7rem; font-weight: 800; color: ${compStateColor}; margin-top: 4px; display: inline-block;">${compStateStr}</span>`;
        
        // Conflict Badge for Row
        let conflictBadge = '';
        const compConflicts = scheduleConflictsReport.compConflictMap[item.compId] || [];
        if (compConflicts.length > 0) {
            const hasHard = compConflicts.some(c => c.type === 'hard' || c.type === 'stage');
            const bBg = hasHard ? '#FEE2E2' : '#FEF3C7';
            const bColor = hasHard ? '#DC2626' : '#D97706';
            const bBorder = hasHard ? '#FCA5A5' : '#FDE68A';
            conflictBadge = `<br><span class="badge" style="background:${bBg}; color:${bColor}; border:1px solid ${bBorder}; cursor:pointer; font-weight:700; margin-top:4px; display:inline-flex; align-items:center; gap:4px;" onclick="openConflictAuditModal()" title="${compConflicts.length} conflict(s)"><i class="fa-solid fa-triangle-exclamation"></i> ${compConflicts.length} Clash${compConflicts.length > 1 ? 'es' : ''}</span>`;
        }

        const badge = publishBadge + stateBadge + conflictBadge;

        const actionBtn = isPub
            ? `<button class="btn btn-outline" style="padding:0.4rem 0.75rem; color:var(--warning); border-color:var(--warning);" onclick="toggleScheduleStatus('${item.compId}', 'draft')" title="Unpublish"><i class="fa-solid fa-eye-slash"></i></button>`
            : `<button class="btn btn-success" style="padding:0.4rem 0.75rem;" onclick="toggleScheduleStatus('${item.compId}', 'published')" title="Publish Live"><i class="fa-solid fa-upload"></i></button>`;

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700;">${item.comp.name}</td>
                <td>${compCatName}</td>
                <td>${compStageName}</td>
                <td style="font-weight: 700; color: var(--primary);">${item.sched.date}</td>
                <td style="font-weight: 700;">${item.sched.time}</td>
                <td style="font-weight: 700;">${item.sched.to_time || '-'}</td>
                <td>${badge}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        ${actionBtn}
                        <button class="btn btn-outline" style="padding:0.4rem 0.75rem;" onclick="openScheduleModal('${item.compId}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger" style="padding:0.4rem 0.75rem;" onclick="deleteSchedule('${item.compId}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    if(tbody.innerHTML === '') {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No scheduled events found.</td></tr>`;
    }
}

// ==========================================
// CONFLICT AUDIT MODAL FUNCTIONS
// ==========================================

async function openConflictAuditModal() {
    // Show modal first or display loading if needed
    document.getElementById('conflictAuditModal').classList.add('show');
    
    // Detect fresh conflicts
    await detectScheduleConflicts();

    const hardCount = document.getElementById('audit-hard-count');
    const bufferCount = document.getElementById('audit-buffer-count');
    const stageCount = document.getElementById('audit-stage-count');
    const totalCount = document.getElementById('audit-total-count');

    if (hardCount) hardCount.innerText = scheduleConflictsReport.hardClashes.length;
    if (bufferCount) bufferCount.innerText = scheduleConflictsReport.bufferWarnings.length;
    if (stageCount) stageCount.innerText = scheduleConflictsReport.stageCollisions.length;
    if (totalCount) totalCount.innerText = scheduleConflictsReport.totalConflicts;

    filterAuditList('all');
}

function filterAuditList(type) {
    currentAuditFilter = type;

    // Reset button states
    ['all', 'hard', 'buffer', 'stage'].forEach(t => {
        const btn = document.getElementById(`btn-filter-${t}-conflicts`);
        if (!btn) return;
        if (t === type) {
            btn.className = 'btn btn-primary';
        } else {
            btn.className = 'btn btn-outline';
        }
    });

    const container = document.getElementById('conflict-audit-list');
    if (!container) return;

    let items = [];
    if (type === 'all') {
        items = [...scheduleConflictsReport.hardClashes, ...scheduleConflictsReport.bufferWarnings, ...scheduleConflictsReport.stageCollisions];
    } else if (type === 'hard') {
        items = scheduleConflictsReport.hardClashes;
    } else if (type === 'buffer') {
        items = scheduleConflictsReport.bufferWarnings;
    } else if (type === 'stage') {
        items = scheduleConflictsReport.stageCollisions;
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--success); font-weight: 600;">
                <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; margin-bottom: 0.75rem; display: block;"></i>
                No schedule conflicts found in this category!
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, idx) => {
        if (item.type === 'hard') {
            return `
                <div style="background: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: #DC2626; color: white; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> HARD CLASH</span>
                            <strong style="color: #991B1B; font-size: 0.95rem;">${item.student.name} (${item.student.unique_id || 'ID'}) • ${item.student.teams?.name || 'IND'}</strong>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${item.date}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: white; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #FECACA;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event A</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compA.name}</strong>
                            <div style="font-size: 0.8rem; color: #DC2626; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeA} (${item.stageNameA})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compA.id}')"><i class="fa-solid fa-pen"></i> Reschedule A</button>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event B</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compB.name}</strong>
                            <div style="font-size: 0.8rem; color: #DC2626; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeB} (${item.stageNameB})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compB.id}')"><i class="fa-solid fa-pen"></i> Reschedule B</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'buffer') {
            return `
                <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: #D97706; color: white; font-weight: 800;"><i class="fa-solid fa-hourglass-half"></i> TIGHT BUFFER (${item.gapMins}m)</span>
                            <strong style="color: #92400E; font-size: 0.95rem;">${item.student.name} (${item.student.unique_id || 'ID'}) • ${item.student.teams?.name || 'IND'}</strong>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${item.date}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: white; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #FDE68A;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">1st Performance</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compA.name}</strong>
                            <div style="font-size: 0.8rem; color: #D97706; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeA} (${item.stageNameA})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compA.id}')"><i class="fa-solid fa-pen"></i> Adjust Timing</button>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">2nd Performance</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compB.name}</strong>
                            <div style="font-size: 0.8rem; color: #D97706; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeB} (${item.stageNameB})</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compB.id}')"><i class="fa-solid fa-pen"></i> Adjust Timing</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'stage') {
            return `
                <div style="background: #F5F3FF; border: 1.5px solid #DDD6FE; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: #7C3AED; color: white; font-weight: 800;"><i class="fa-solid fa-layer-group"></i> STAGE COLLISION</span>
                            <strong style="color: #5B21B6; font-size: 0.95rem;">${item.stageName} (Double Booked)</strong>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${item.date}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: white; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #DDD6FE;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event 1</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compA.name}</strong>
                            <div style="font-size: 0.8rem; color: #7C3AED; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeA}</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compA.id}')"><i class="fa-solid fa-pen"></i> Reschedule</button>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Event 2</div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${item.compB.name}</strong>
                            <div style="font-size: 0.8rem; color: #7C3AED; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${item.timeB}</div>
                            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-top: 0.35rem;" onclick="document.getElementById('conflictAuditModal').classList.remove('show'); openScheduleModal('${item.compB.id}')"><i class="fa-solid fa-pen"></i> Reschedule</button>
                        </div>
                    </div>
                </div>
            `;
        }
        return '';
    }).join('');
}

async function exportConflictReportPDF() {
    showToast('Generating Schedule Conflict Audit PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Schedule Conflict & Overlap Audit Report');

        const allIssues = [
            ...scheduleConflictsReport.hardClashes.map(c => ['HARD CLASH', c.date, c.student?.name || 'N/A', `${c.compA?.name} (${c.timeA})`, `${c.compB?.name} (${c.timeB})`, 'Overlapping Time']),
            ...scheduleConflictsReport.bufferWarnings.map(c => ['TIGHT BUFFER', c.date, c.student?.name || 'N/A', `${c.compA?.name} (${c.timeA})`, `${c.compB?.name} (${c.timeB})`, `${c.gapMins} mins gap`]),
            ...scheduleConflictsReport.stageCollisions.map(c => ['STAGE COLLISION', c.date, c.stageName, `${c.compA?.name} (${c.timeA})`, `${c.compB?.name} (${c.timeB})`, 'Same Stage Overlap'])
        ];

        let rowsHtml = allIssues.map(r => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: ${r[0] === 'HARD CLASH' ? '#DC2626' : (r[0] === 'TIGHT BUFFER' ? '#D97706' : '#7C3AED')};">${r[0]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r[1]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${r[2]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r[3]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r[4]}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${r[5]}</td>
            </tr>
        `).join('');

        if (allIssues.length === 0) {
            rowsHtml = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #059669; font-weight: 700;">No schedule conflicts found! Festival schedule is 100% optimal.</td></tr>`;
        }

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; font-size: 0.85rem;">
                <thead>
                    <tr style="background: #F8FAFC;">
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">TYPE</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">DATE</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">STUDENT / STAGE</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">EVENT 1</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">EVENT 2</th>
                        <th style="padding: 10px; border-bottom: 2px solid #CBD5E1; text-align: left;">DETAILS</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        const opt = {
            margin: 10,
            filename: `Schedule_Conflict_Audit_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        await html2pdf().set(opt).from(container).save();
    } catch(e) {
        showToast("PDF Export failed: " + e.message, "error");
    }
}

// ==========================================
// AUTO-SCHEDULE OPTIMIZER ENGINE
// ==========================================

function openAutoSchedulerModal() {
    const optDateInput = document.getElementById('opt-date');
    if (optDateInput && !optDateInput.value) {
        // Find earliest date from schedule or default to today
        const dates = Object.values(masterSchedule).map(s => s.date).filter(Boolean).sort();
        optDateInput.value = dates.length > 0 ? dates[0] : new Date().toISOString().split('T')[0];
    }

    pendingOptimizedSchedule = null;
    const previewContainer = document.getElementById('opt-preview-container');
    const applyBtn = document.getElementById('btn-apply-optimized-schedule');
    const metricsBadge = document.getElementById('opt-metrics-badge');
    const statusIndicator = document.getElementById('opt-status-indicator');

    if (previewContainer) {
        previewContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem; font-size: 0.9rem; font-weight: 500;"><div class="spinner" style="display:inline-block; margin-bottom: 0.5rem;"></div><br>Analyzing constraints and generating clash-free timeline...</div>`;
    }
    if (applyBtn) applyBtn.style.display = 'none';
    if (metricsBadge) metricsBadge.style.display = 'none';
    if (statusIndicator) statusIndicator.innerText = 'Initializing optimizer...';

    document.getElementById('autoSchedulerModal').classList.add('show');

    // Automatically run the optimizer calculation
    setTimeout(() => {
        generateOptimizedSchedule();
    }, 150);
}

async function generateOptimizedSchedule() {
    const targetDate = document.getElementById('opt-date')?.value;
    const startTimeStr = document.getElementById('opt-start-time')?.value || '09:00';
    const endTimeStr = document.getElementById('opt-end-time')?.value || '18:00';
    const bufferMins = parseInt(document.getElementById('opt-buffer-mins')?.value) || 15;
    const stageStrategy = document.getElementById('opt-stage-strategy')?.value || 'auto_balance';
    const breakWindow = document.getElementById('opt-break-window')?.value || '13:00-14:00';
    const scope = document.getElementById('opt-scope')?.value || 'unscheduled_only';

    if (!targetDate) {
        alert("Please choose a target fest date.");
        return;
    }

    const startMins = timeStringToMinutes(startTimeStr);
    const endLimitMins = timeStringToMinutes(endTimeStr);

    if (endLimitMins <= startMins) {
        alert("End time must be after start time.");
        return;
    }

    const statusIndicator = document.getElementById('opt-status-indicator');
    if (statusIndicator) statusIndicator.innerText = 'Analyzing constraints, participant graph, and stage capacities...';

    // Ensure baseline data is loaded
    if (competitionsList.length === 0) await loadCompetitions();
    if (stagesList.length === 0) await loadStagesAndTeams();

    const enrollments = await fetchScheduleEnrollments(true);
    const compStudentsMap = {};
    enrollments.forEach(e => {
        if (!e.competition_id || !e.participant_id) return;
        if (!compStudentsMap[e.competition_id]) compStudentsMap[e.competition_id] = [];
        compStudentsMap[e.competition_id].push(e.participant_id);
    });

    // Parse Break Window
    let breakStartMins = -1;
    let breakEndMins = -1;
    if (breakWindow && breakWindow !== 'none') {
        const [bStart, bEnd] = breakWindow.split('-');
        if (bStart && bEnd) {
            breakStartMins = timeStringToMinutes(bStart);
            breakEndMins = timeStringToMinutes(bEnd);
        }
    }

    // 1. Filter Candidate Competitions based on Scope
    let candidates = [];
    if (scope === 'unscheduled_only') {
        candidates = competitionsList.filter(c => {
            const s = masterSchedule[c.id];
            return !s || !s.date || !s.time;
        });
    } else {
        candidates = [...competitionsList];
    }

    if (candidates.length === 0) {
        alert("No candidate competitions found matching the selected optimization scope.");
        if (statusIndicator) statusIndicator.innerText = 'No candidates to schedule.';
        return;
    }

    // 2. Compute Durations & MRV Sort (Most Constrained First)
    candidates.forEach(c => {
        const enrolled = compStudentsMap[c.id] || [];
        const enrolledCount = enrolled.length;
        
        let duration = 30;
        if (c.is_offstage) {
            duration = parseInt(c.time_per_student) || 45;
        } else {
            const perStudent = parseInt(c.time_per_student) || 5;
            if (enrolledCount > 0) {
                duration = Math.max(15, enrolledCount * perStudent);
            } else {
                duration = Math.max(20, (parseInt(c.max_participants) || 6) * perStudent);
            }
        }
        
        // Cap single event duration between 15 and 150 minutes
        c.calculatedDuration = Math.min(150, Math.max(15, duration));

        // MRV Degree: Count how many enrolled students overlap with OTHER candidate competitions
        let sharedStudentsCount = 0;
        candidates.forEach(otherC => {
            if (otherC.id === c.id) return;
            const otherStudents = compStudentsMap[otherC.id] || [];
            const shared = enrolled.filter(id => otherStudents.includes(id));
            sharedStudentsCount += shared.length;
        });

        c.constraintDegree = (sharedStudentsCount * 3) + enrolledCount;
    });

    // Sort by constraint degree descending (hardest constraints first)
    candidates.sort((a, b) => b.constraintDegree - a.constraintDegree);

    // 3. Initialize Stage and Offstage Timelines
    const stageTimelines = {};
    stagesList.forEach(s => {
        stageTimelines[s.id] = [];
    });
    // Dedicated track for offstage
    stageTimelines['offstage'] = [];

    const studentTimelines = {}; // { studentId: [ { start, end } ] }

    // If scope is unscheduled_only, load existing slots on targetDate
    if (scope === 'unscheduled_only') {
        Object.entries(masterSchedule).forEach(([compId, sched]) => {
            if (sched.date !== targetDate) return;
            const comp = competitionsList.find(c => c.id == compId);
            if (!comp) return;

            const sStart = timeStringToMinutes(sched.time);
            let sEnd = sched.to_time ? timeStringToMinutes(sched.to_time) : (sStart + (parseInt(sched.manual_time) || 30));
            if (sEnd <= sStart) sEnd = sStart + 30;

            const stageKey = comp.is_offstage ? 'offstage' : (comp.stage_id || stagesList[0]?.id);
            if (stageTimelines[stageKey]) {
                stageTimelines[stageKey].push({ compId, start: sStart, end: sEnd });
            }

            const sList = compStudentsMap[compId] || [];
            sList.forEach(sId => {
                if (!studentTimelines[sId]) studentTimelines[sId] = [];
                studentTimelines[sId].push({ start: sStart, end: sEnd });
            });
        });
    }

    // 4. Constraint-Satisfaction Greedy Placement
    const proposedSchedule = {};
    let scheduledCount = 0;
    let unplacedList = [];

    candidates.forEach(comp => {
        const compDuration = comp.calculatedDuration;
        const compStudents = compStudentsMap[comp.id] || [];

        // Determine eligible stages
        let eligibleStages = [];
        if (comp.is_offstage) {
            eligibleStages = ['offstage'];
        } else if (stageStrategy === 'preserve' && comp.stage_id) {
            eligibleStages = [comp.stage_id];
        } else {
            // If auto_balance or unassigned: try pre-assigned first, then all available stages sorted by current load
            if (comp.stage_id && stagesList.some(s => s.id == comp.stage_id)) {
                eligibleStages = [comp.stage_id, ...stagesList.map(s => s.id).filter(id => id != comp.stage_id)];
            } else {
                eligibleStages = stagesList.map(s => s.id);
            }
        }

        let bestSlot = null;

        // Try candidate stages
        for (const stageKey of eligibleStages) {
            let candidateStart = startMins;

            while (candidateStart + compDuration <= endLimitMins) {
                const candidateEnd = candidateStart + compDuration;

                // Check Break / Lunch Window
                if (breakStartMins !== -1 && breakEndMins !== -1) {
                    if (candidateStart < breakEndMins && candidateEnd > breakStartMins) {
                        candidateStart = breakEndMins;
                        continue;
                    }
                }

                // Check Stage Occupancy
                if (stageKey !== 'offstage') {
                    const stageOccupied = (stageTimelines[stageKey] || []).some(slot => 
                        (candidateStart < slot.end + bufferMins) && (candidateEnd > slot.start)
                    );
                    if (stageOccupied) {
                        candidateStart += 10;
                        continue;
                    }
                }

                // Check Student Clash across all stages
                let hasStudentClash = false;
                for (const sId of compStudents) {
                    const sSlots = studentTimelines[sId] || [];
                    const clash = sSlots.some(slot => 
                        (candidateStart < slot.end + bufferMins) && (candidateEnd > slot.start - bufferMins)
                    );
                    if (clash) {
                        hasStudentClash = true;
                        break;
                    }
                }

                if (!hasStudentClash) {
                    // Valid slot found for this stage
                    if (!bestSlot || candidateStart < bestSlot.start) {
                        bestSlot = {
                            stageKey,
                            start: candidateStart,
                            end: candidateEnd
                        };
                    }
                    break;
                }

                candidateStart += 10;
            }

            // If we found a slot on the primary stage, prioritize it
            if (bestSlot && bestSlot.stageKey === comp.stage_id) break;
        }

        if (bestSlot) {
            proposedSchedule[comp.id] = {
                date: targetDate,
                time: minutesToTimeString(bestSlot.start),
                to_time: minutesToTimeString(bestSlot.end),
                manual_time: compDuration,
                status: 'draft',
                stage_id: bestSlot.stageKey === 'offstage' ? (comp.stage_id || null) : bestSlot.stageKey,
                is_offstage: comp.is_offstage
            };

            // Update timelines
            if (stageTimelines[bestSlot.stageKey]) {
                stageTimelines[bestSlot.stageKey].push({ compId: comp.id, start: bestSlot.start, end: bestSlot.end });
            }
            compStudents.forEach(sId => {
                if (!studentTimelines[sId]) studentTimelines[sId] = [];
                studentTimelines[sId].push({ start: bestSlot.start, end: bestSlot.end });
            });

            scheduledCount++;
        } else {
            unplacedList.push(comp);
        }
    });

    pendingOptimizedSchedule = proposedSchedule;

    // 5. Render Visual Timeline Gantt Preview
    renderOptimizationPreview(proposedSchedule, targetDate, startMins, endLimitMins, breakStartMins, breakEndMins, unplacedList);

    // Update Badges & Actions
    const metricsBadge = document.getElementById('opt-metrics-badge');
    const badgeSuccess = document.getElementById('opt-badge-success');
    const badgeClash = document.getElementById('opt-badge-clash');
    const applyBtn = document.getElementById('btn-apply-optimized-schedule');

    if (metricsBadge) metricsBadge.style.display = 'flex';
    if (badgeSuccess) badgeSuccess.innerText = `${scheduledCount} Events Scheduled`;
    if (badgeClash) {
        if (unplacedList.length === 0) {
            badgeClash.innerText = `0 Clashes • 100% Conflict Free`;
            badgeClash.style.background = '#D1FAE5';
            badgeClash.style.color = '#059669';
        } else {
            badgeClash.innerText = `${unplacedList.length} Unplaced (Time Window Full)`;
            badgeClash.style.background = '#FEF3C7';
            badgeClash.style.color = '#D97706';
        }
    }
    if (statusIndicator) {
        statusIndicator.innerText = unplacedList.length === 0 
            ? `Optimization Complete! 100% Clash-Free Schedule Generated.` 
            : `Scheduled ${scheduledCount} events. Extend operating hours to fit all ${unplacedList.length} remaining.`;
    }
    if (applyBtn) applyBtn.style.display = 'inline-flex';
}

function renderOptimizationPreview(proposedSchedule, targetDate, startMins = 540, endLimitMins = 1080, breakStartMins = -1, breakEndMins = -1, unplacedList = []) {
    const container = document.getElementById('opt-preview-container');
    if (!container) return;

    const compIds = Object.keys(proposedSchedule);
    if (compIds.length === 0 && unplacedList.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 2rem;">No slots could be assigned within the time window. Try extending the operating hours.</div>`;
        return;
    }

    const totalDuration = endLimitMins - startMins;

    // Build timeline hourly markers
    let timeMarkersHtml = '';
    const startHour = Math.floor(startMins / 60);
    const endHour = Math.ceil(endLimitMins / 60);
    for (let h = startHour; h <= endHour; h++) {
        const markerMins = h * 60;
        if (markerMins < startMins || markerMins > endLimitMins) continue;
        const leftPercent = ((markerMins - startMins) / totalDuration) * 100;
        const displayTime = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;
        timeMarkersHtml += `
            <div style="position: absolute; left: ${leftPercent}%; top: 0; bottom: 0; border-left: 1px dashed var(--border); pointer-events: none;">
                <span style="position: absolute; top: 4px; left: 4px; font-size: 0.7rem; font-weight: 700; color: var(--text-muted);">${displayTime}</span>
            </div>
        `;
    }

    // Break Window shading
    let breakShadeHtml = '';
    if (breakStartMins !== -1 && breakEndMins !== -1 && breakEndMins > startMins && breakStartMins < endLimitMins) {
        const bLeft = Math.max(0, ((breakStartMins - startMins) / totalDuration) * 100);
        const bWidth = Math.min(100 - bLeft, ((breakEndMins - breakStartMins) / totalDuration) * 100);
        breakShadeHtml = `
            <div style="position: absolute; left: ${bLeft}%; width: ${bWidth}%; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.08) 8px, rgba(245, 158, 11, 0.15) 8px, rgba(245, 158, 11, 0.15) 16px); border-left: 1px solid rgba(245, 158, 11, 0.3); border-right: 1px solid rgba(245, 158, 11, 0.3); z-index: 1; pointer-events: none; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 0.75rem; font-weight: 800; color: #B45309; transform: rotate(-90deg); letter-spacing: 0.05em;">LUNCH BREAK</span>
            </div>
        `;
    }

    // Build stage swimlanes
    const stageTracks = [
        ...stagesList.map(s => ({ id: s.id, name: s.name, isOffstage: false })),
        { id: 'offstage', name: 'Offstage Venues', isOffstage: true }
    ];

    let swimlanesHtml = '';

    stageTracks.forEach(track => {
        // Collect items in this track
        const trackItems = compIds
            .map(id => {
                const sched = proposedSchedule[id];
                const comp = competitionsList.find(c => c.id == id);
                return { id, sched, comp };
            })
            .filter(item => {
                if (track.isOffstage) return item.comp?.is_offstage;
                return !item.comp?.is_offstage && String(item.sched.stage_id) === String(track.id);
            });

        if (track.isOffstage && trackItems.length === 0) return; // Hide offstage lane if empty

        let blocksHtml = '';
        trackItems.forEach(item => {
            const itemStart = timeStringToMinutes(item.sched.time);
            const itemEnd = timeStringToMinutes(item.sched.to_time);
            const leftPct = Math.max(0, ((itemStart - startMins) / totalDuration) * 100);
            const widthPct = Math.min(100 - leftPct, ((itemEnd - itemStart) / totalDuration) * 100);

            blocksHtml += `
                <div style="position: absolute; left: ${leftPct}%; width: ${Math.max(widthPct, 2)}%; top: 6px; bottom: 6px; background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); border-radius: 6px; color: white; padding: 4px 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; z-index: 2; transition: var(--transition);" 
                     title="${item.comp.name} (${item.comp.categories?.name || 'Gen'}) | ${item.sched.time} - ${item.sched.to_time} (${item.sched.manual_time}m)"
                     onmouseover="this.style.transform='scale(1.03)'; this.style.zIndex='10';"
                     onmouseout="this.style.transform='none'; this.style.zIndex='2';">
                    <div style="font-weight: 700; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.comp.name}</div>
                    <div style="font-size: 0.65rem; opacity: 0.85; white-space: nowrap;">${item.sched.time} - ${item.sched.to_time}</div>
                </div>
            `;
        });

        swimlanesHtml += `
            <div style="display: flex; border-bottom: 1px solid var(--border); min-height: 52px;">
                <div style="width: 140px; min-width: 140px; padding: 0.6rem 0.75rem; background: var(--bg-main); border-right: 1px solid var(--border); font-size: 0.8rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                    <i class="${track.isOffstage ? 'fa-solid fa-layer-group' : 'fa-solid fa-microphone-stage'}" style="color: var(--primary);"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${track.name}</span>
                </div>
                <div style="flex: 1; position: relative; min-height: 52px; background: white;">
                    ${timeMarkersHtml}
                    ${breakShadeHtml}
                    ${blocksHtml}
                </div>
            </div>
        `;
    });

    let unplacedHtml = '';
    if (unplacedList.length > 0) {
        unplacedHtml = `
            <div style="margin-top: 1rem; padding: 0.85rem 1rem; background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 8px;">
                <strong style="color: #92400E; font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">
                    <i class="fa-solid fa-triangle-exclamation"></i> ${unplacedList.length} Events Could Not Fit Into Time Limit (${startTimeStr} - ${endTimeStr})
                </strong>
                <span style="font-size: 0.8rem; color: #B45309;">Consider extending operating hours or adding more stages. Unplaced events: ${unplacedList.map(c => c.name).join(', ')}.</span>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: 8px;">
            <div style="min-width: 650px;">
                ${swimlanesHtml}
            </div>
        </div>
        ${unplacedHtml}
    `;
}

async function applyOptimizedSchedule() {
    if (!pendingOptimizedSchedule || Object.keys(pendingOptimizedSchedule).length === 0) {
        alert("No optimized schedule to apply.");
        return;
    }

    const applyBtn = document.getElementById('btn-apply-optimized-schedule');
    if (applyBtn) {
        applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying & Saving...';
        applyBtn.disabled = true;
    }

    try {
        const stageUpdates = [];

        // 1. Merge pending into masterSchedule & check stage updates
        Object.keys(pendingOptimizedSchedule).forEach(id => {
            const item = pendingOptimizedSchedule[id];
            masterSchedule[id] = {
                date: item.date,
                time: item.time,
                to_time: item.to_time,
                manual_time: item.manual_time,
                status: 'draft'
            };

            const existingComp = competitionsList.find(c => c.id == id);
            if (existingComp && item.stage_id && String(existingComp.stage_id) !== String(item.stage_id) && !existingComp.is_offstage) {
                stageUpdates.push(supabaseClient.from('competitions').update({ stage_id: item.stage_id }).eq('id', id));
            }
        });

        // 2. Persist stage updates if any
        if (stageUpdates.length > 0) {
            await Promise.all(stageUpdates);
            await loadCompetitions();
        }

        // 3. Save master_schedule in Supabase settings
        const { error } = await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (error) throw error;

        showToast("Auto-Schedule successfully applied and persisted!", "success");
        document.getElementById('autoSchedulerModal').classList.remove('show');
        await loadSchedules();
    } catch(e) {
        showToast("Failed to apply schedule: " + e.message, "error");
    } finally {
        if (applyBtn) {
            applyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Apply & Save to Master Schedule';
            applyBtn.disabled = false;
        }
    }
}

// NEW: Global Calculator Function
window.updateScheduleTimeCalc = function() {
    const compId = document.getElementById('modSchedComp').value;
    if(!compId) return;
    const comp = competitionsList.find(c => c.id == compId);
    
    const enrolled = comp?.participant_competitions?.[0]?.count || 0;
    const timePerStudent = comp?.time_per_student || 0;
    
    // STRICT OFFSTAGE LOGIC
    let estTime = 0;
    if (comp?.is_offstage) {
        // Offstage events happen simultaneously, so the entered time IS the total time
        estTime = timePerStudent; 
    } else {
        // Onstage events scale with the number of enrolled students
        estTime = enrolled * timePerStudent; 
    }
    
    document.getElementById('modSchedEstTime').value = estTime;
    
    const manualTime = parseInt(document.getElementById('modSchedManualTime').value);
    const finalTimeToAdd = isNaN(manualTime) || manualTime <= 0 ? estTime : manualTime;
    
    const fromTimeStr = document.getElementById('modSchedTime').value;
    if(fromTimeStr && finalTimeToAdd > 0) {
        const [hours, minutes] = fromTimeStr.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours, minutes, 0, 0);
        dateObj.setMinutes(dateObj.getMinutes() + finalTimeToAdd);
        
        const toHours = String(dateObj.getHours()).padStart(2, '0');
        const toMins = String(dateObj.getMinutes()).padStart(2, '0');
        document.getElementById('modSchedToTime').value = `${toHours}:${toMins}`;
    } else {
        document.getElementById('modSchedToTime').value = '';
    }
};

function openScheduleModal(editCompId = null) {
    const isEdit = !!editCompId;
    const schedData = isEdit ? masterSchedule[editCompId] : null;
    
    let catOpts = `<option value="">-- SELECT CATEGORY --</option>` + categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // NEW: Generate Stage Options
    let stageOpts = `<option value="">-- ALL STAGES --</option>` + stagesList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    openModal(isEdit ? 'Edit Schedule' : 'Schedule Event', `
        <div class="grid-2" style="gap: 1rem;">
            <div class="form-group">
                <label>1. Select Category</label>
                <select id="modSchedCat" onchange="loadModSchedComps()" ${isEdit ? 'disabled' : ''}>
                    ${catOpts}
                </select>
            </div>
            <!-- NEW: Stage Dropdown -->
            <div class="form-group">
                <label>2. Select Stage</label>
                <select id="modSchedStage" onchange="loadModSchedComps()" ${isEdit ? 'disabled' : ''}>
                    ${stageOpts}
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>3. Select Competition</label>
            <select id="modSchedComp" onchange="window.updateScheduleTimeCalc()" ${isEdit ? 'disabled' : ''}>
                <option value="">-- CHOOSE CATEGORY FIRST --</option>
            </select>
        </div>
        <div class="grid-2" style="gap: 1rem;">
            <div class="form-group">
                <label>System Est. Time (Mins)</label>
                <input type="number" id="modSchedEstTime" disabled style="background: var(--bg-main);">
            </div>
            <div class="form-group">
                <label>Manual Total Time (Mins)</label>
                <input type="number" id="modSchedManualTime" oninput="window.updateScheduleTimeCalc()" value="${schedData?.manual_time || ''}">
            </div>
        </div>
        <div class="form-group">
            <label>Date</label>
            <input type="date" id="modSchedDate" style="text-transform: none;" value="${schedData ? schedData.date : ''}">
        </div>
        <div class="grid-2" style="gap: 1rem;">
            <div class="form-group">
                <label>From Time</label>
                <input type="time" id="modSchedTime" style="text-transform: none;" value="${schedData ? schedData.time : ''}" oninput="window.updateScheduleTimeCalc()">
            </div>
            <div class="form-group">
                <label>To Time (Auto-calculated)</label>
                <input type="time" id="modSchedToTime" style="text-transform: none;" value="${schedData?.to_time || ''}" readonly style="background: var(--bg-main);">
            </div>
        </div>
    `, () => saveSchedule(editCompId));
    
    if (isEdit) {
        const comp = competitionsList.find(c => c.id == editCompId);
        if (comp) {
            document.getElementById('modSchedCat').value = comp.category_id;
            
            // NEW: Pre-select the stage if editing
            if (document.getElementById('modSchedStage') && comp.stage_id) {
                document.getElementById('modSchedStage').value = comp.stage_id;
            }
            
            document.getElementById('modSchedComp').innerHTML = `<option value="${comp.id}">${comp.name}</option>`;
            document.getElementById('modSchedComp').value = comp.id;
            setTimeout(() => window.updateScheduleTimeCalc(), 100);
        }
    }
}

function loadModSchedComps() {
    const catId = document.getElementById('modSchedCat').value;
    const stageId = document.getElementById('modSchedStage')?.value; // NEW: Grab stage value
    const compSelect = document.getElementById('modSchedComp');
    
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION --</option>';
    
    if(!catId) {
        window.updateScheduleTimeCalc();
        return;
    }
    
    // Filter by Category and exclude already scheduled competitions
    let eligibleComps = competitionsList.filter(c => c.category_id == catId && !masterSchedule[c.id]);
    
    // NEW: Further filter by Stage if a stage is selected in the dropdown
    if (stageId) {
        eligibleComps = eligibleComps.filter(c => String(c.stage_id) === String(stageId));
    }
    
    eligibleComps.forEach(c => {
        compSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    window.updateScheduleTimeCalc();
}
async function saveSchedule(editCompId) {
    const compId = editCompId || document.getElementById('modSchedComp').value;
    const date = document.getElementById('modSchedDate').value;
    const time = document.getElementById('modSchedTime').value;
    
    if(!compId || !date || !time) return showToast("All fields are required", "error");
    
    setLoading('modalSaveBtn', true);
    
    masterSchedule[compId] = {
        date: date,
        time: time,
        to_time: document.getElementById('modSchedToTime').value,
        manual_time: document.getElementById('modSchedManualTime').value,
        status: masterSchedule[compId]?.status || 'draft'
    };
    
    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (error) throw error;
        showToast("Schedule Saved!");
        closeModal();
        filterScheduleTable();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setLoading('modalSaveBtn', false); }
}

async function toggleScheduleStatus(compId, newStatus) {
    masterSchedule[compId].status = newStatus;
    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'master_schedule', value: masterSchedule });
        if (error) throw error;
        showToast(`Schedule ${newStatus}!`);
        filterScheduleTable();
    } catch(e) { showToast(e.message, 'error'); }
}



async function exportSchedulePDF() {
    showToast('Generating Schedule PDF...', 'success');
    try {
        const container = document.createElement('div');
        container.style.padding = '40px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Master Event Schedule');

        // 1. Get current filter values
        const search = document.getElementById('searchSchedInput').value.toLowerCase();
        const catId = document.getElementById('filterSchedCat').value;
        const stageId = document.getElementById('filterSchedStage').value; 
        const statusVal = document.getElementById('filterSchedStatus').value;
        const compStatusVal = document.getElementById('filterSchedCompStatus') ? document.getElementById('filterSchedCompStatus').value : ""; // NEW

        // 2. Map items and apply filters
        let scheduledItems = Object.keys(masterSchedule).map(compId => {
            const comp = competitionsList.find(c => c.id == compId);
            return { compId, comp, sched: masterSchedule[compId] };
        }).filter(item => {
            if (!item.comp) return false;

            const compCatId = item.comp.category_id;
            const compStageId = item.comp.stage_id; 

            const matchSearch = item.comp.name.toLowerCase().includes(search);
            const matchCat = catId === "" || compCatId == catId;
            const matchStage = stageId === "" || compStageId == stageId; 
            const matchStatus = statusVal === "" || item.sched.status === statusVal;
            const matchCompStatus = compStatusVal === "" || item.comp.status === compStatusVal; // NEW

            return matchSearch && matchCat && matchStage && matchStatus && matchCompStatus; // UPDATED
        });
        
        // 3. Sort chronologically
        scheduledItems.sort((a,b) => {
            if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
            return a.sched.time.localeCompare(b.sched.time);
        });

        // 4. Generate Rows
        let tableRows = scheduledItems.map((item) => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.sched.date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${item.sched.time}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700;">${item.sched.to_time || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${item.comp.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.comp.categories?.name || 'GEN'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.comp.stages?.name || 'TBD'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #4F46E5;">${item.comp.status.toUpperCase().replace('_', ' ')}</td>
            </tr>
        `).join('');

        if (scheduledItems.length === 0) {
            tableRows = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748B;">No scheduled events match your current filters.</td></tr>`;
        }

        container.innerHTML += `
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 11px; color: #64748B;">
                        <th style="padding: 10px;">DATE</th>
                        <th style="padding: 10px;">FROM TIME</th>
                        <th style="padding: 10px;">TO TIME</th>
                        <th style="padding: 10px;">COMPETITION</th>
                        <th style="padding: 10px;">CATEGORY</th>
                        <th style="padding: 10px;">STAGE</th>
                        <th style="padding: 10px;">EVENT STATUS</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12px; color: #334155;">
                    ${tableRows}
                </tbody>
            </table>
        `;

        const opt = { 
            margin: 10, filename: `FestOS_Master_Schedule.pdf`, image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
    } catch (e) { showToast(e.message, 'error'); }
}

async function exportScheduleCSV() {
    // 1. Get current filter values
    const search = document.getElementById('searchSchedInput').value.toLowerCase();
    const catId = document.getElementById('filterSchedCat').value;
    const stageId = document.getElementById('filterSchedStage').value; 
    const statusVal = document.getElementById('filterSchedStatus').value;
    const compStatusVal = document.getElementById('filterSchedCompStatus') ? document.getElementById('filterSchedCompStatus').value : ""; // NEW

    let dataToExport = [];
    
    // 2. Map and filter items
    Object.keys(masterSchedule).forEach(compId => {
        const comp = competitionsList.find(c => c.id == compId);
        if(comp) {
            const sched = masterSchedule[compId];
            const compCatId = comp.category_id;
            const compStageId = comp.stage_id; 

            const matchSearch = comp.name.toLowerCase().includes(search);
            const matchCat = catId === "" || compCatId == catId;
            const matchStage = stageId === "" || compStageId == stageId; 
            const matchStatus = statusVal === "" || sched.status === statusVal;
            const matchCompStatus = compStatusVal === "" || comp.status === compStatusVal; // NEW

            if (matchSearch && matchCat && matchStage && matchStatus && matchCompStatus) { // UPDATED
                dataToExport.push({
                    "DATE": sched.date,
                    "TIME (FROM)": sched.time,
                    "TIME (TO)": sched.to_time || '-',
                    "COMPETITION": comp.name,
                    "CATEGORY": comp.categories?.name || 'General',
                    "STAGE": comp.stages?.name || 'TBD',
                    "STATUS": sched.status.toUpperCase()
                });
            }
        }
    });
    
    if (dataToExport.length === 0) return showToast("No scheduled events match your filters.", "error");

    dataToExport.sort((a,b) => {
        if (a.DATE !== b.DATE) return a.DATE.localeCompare(b.DATE);
        return a["TIME (FROM)"].localeCompare(b["TIME (FROM)"]);
    });

    const blob = new Blob([Papa.unparse(dataToExport)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `FestOS_Schedule.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}



// ============================================================================
// COMPETITION VACANCY & UNDER-ENROLLMENT ENGINE
// ============================================================================

let vacancyAuditData = [];

async function openVacancyReportModal() {
    showToast('Auditing competition enrollments...', 'success');
    try {
        // Ensure dependencies are loaded
        if (categoriesList.length === 0) await loadCategories();
        if (teamsList.length === 0) await loadStagesAndTeams();
        if (competitionsList.length === 0) await loadCompetitions();

        // Populate Category Filter dropdown
        const catFilter = document.getElementById('vacancyCategoryFilter');
        if (catFilter) {
            catFilter.innerHTML = '<option value="">All Categories</option>';
            categoriesList.forEach(c => catFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        }

        // Fetch all assignments with team information
        const { data: enrollments, error } = await supabaseClient
            .from('participant_competitions')
            .select('competition_id, participant_id, participants(id, team_id, teams(name))');

        if (error) throw error;

        // Group enrollments by competition and team
        const compEnrollmentMap = {};
        (enrollments || []).forEach(row => {
            const cId = row.competition_id;
            const tId = row.participants?.team_id || 'unassigned';
            const tName = row.participants?.teams?.name || 'INDEPENDENT';

            if (!compEnrollmentMap[cId]) compEnrollmentMap[cId] = { total: 0, byTeam: {} };
            compEnrollmentMap[cId].total++;
            compEnrollmentMap[cId].byTeam[tId] = (compEnrollmentMap[cId].byTeam[tId] || 0) + 1;
        });

        // Calculate vacancies for every competition
        vacancyAuditData = [];

        competitionsList.forEach(comp => {
            const maxPerTeam = comp.max_participants || 1;
            const totalCapacity = maxPerTeam * (teamsList.length || 0);
            const enrolledTotal = compEnrollmentMap[comp.id]?.total || 0;
            const teamCounts = compEnrollmentMap[comp.id]?.byTeam || {};

            const teamVacancies = [];

            teamsList.forEach(team => {
                const filled = teamCounts[team.id] || 0;
                const remaining = maxPerTeam - filled;

                if (remaining > 0) {
                    teamVacancies.push({
                        teamId: team.id,
                        teamName: team.name,
                        enrolled: filled,
                        max: maxPerTeam,
                        missing: remaining
                    });
                }
            });

            // If any team hasn't filled its quota, flag this competition
            if (teamVacancies.length > 0) {
                vacancyAuditData.push({
                    id: comp.id,
                    name: comp.name,
                    category_id: comp.category_id,
                    categoryName: comp.categories?.name || 'General',
                    maxPerTeam: maxPerTeam,
                    enrolledTotal: enrolledTotal,
                    totalCapacity: totalCapacity,
                    vacanciesCount: totalCapacity - enrolledTotal,
                    teamVacancies: teamVacancies
                });
            }
        });

        // Open modal & render table
        document.getElementById('vacancyModal').classList.add('show');
        renderVacancyTable();

    } catch (e) {
        showToast("Error generating vacancy audit: " + e.message, 'error');
    }
}

function renderVacancyTable() {
    const search = (document.getElementById('vacancySearchInput')?.value || '').toLowerCase();
    const catId = document.getElementById('vacancyCategoryFilter')?.value || '';
    const tbody = document.getElementById('vacancy-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = vacancyAuditData.filter(item => {
        const matchName = item.name.toLowerCase().includes(search);
        const matchCat = catId === '' || String(item.category_id) === String(catId);
        return matchName && matchCat;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color:var(--text-muted); font-weight:600;">No under-enrolled competitions found matching your criteria. All quotas are filled!</td></tr>`;
        document.getElementById('vacancy-summary-count').innerText = `0 competitions with vacancies.`;
        return;
    }

    filtered.forEach(item => {
        // Build team badges showing enrolled / max
        const teamBadges = item.teamVacancies.map(tv => `
            <span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; margin: 2px; display: inline-block; font-size: 0.75rem; padding: 4px 8px;">
                <strong>${tv.teamName}</strong>: ${tv.enrolled}/${tv.max} (${tv.missing} slot${tv.missing > 1 ? 's' : ''} left)
            </span>
        `).join('');

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${item.name}</td>
                <td><span class="badge badge-primary">${item.categoryName}</span></td>
                <td>
                    <span style="font-weight: 800; color: var(--danger); font-size: 0.95rem;">${item.enrolledTotal} / ${item.totalCapacity}</span>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Limit: ${item.maxPerTeam} per team</div>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 480px;">
                        ${teamBadges}
                    </div>
                </td>
                <td>
                    <button class="btn btn-outline" style="color: var(--success); border-color: var(--success); padding: 0.4rem 0.75rem;" onclick="routeToAdminAssignment('${item.category_id}', '${item.id}')">
                        <i class="fa-solid fa-user-plus"></i> Assign Now
                    </button>
                </td>
            </tr>
        `;
    });

    document.getElementById('vacancy-summary-count').innerText = `Showing ${filtered.length} competition(s) with available slots.`;
}

// Generate an A4 PDF Report of all vacancies grouped by Category
async function exportVacancyPDF() {
    if (vacancyAuditData.length === 0) return showToast('No vacancy data to export.', 'error');
    showToast('Generating Vacancy Audit PDF...', 'success');

    try {
        const catId = document.getElementById('vacancyCategoryFilter')?.value || '';
        const search = (document.getElementById('vacancySearchInput')?.value || '').toLowerCase();

        const filtered = vacancyAuditData.filter(item => {
            const matchName = item.name.toLowerCase().includes(search);
            const matchCat = catId === '' || String(item.category_id) === String(catId);
            return matchName && matchCat;
        });

        // Group filtered competitions by category
        const grouped = {};
        filtered.forEach(item => {
            if (!grouped[item.categoryName]) grouped[item.categoryName] = [];
            grouped[item.categoryName].push(item);
        });

        const container = document.createElement('div');
        container.style.padding = '35px';
        container.style.fontFamily = 'Inter, sans-serif';
        container.innerHTML = getPDFHeaderHTML('Under-Enrolled Competitions & Vacancy Audit');

        for (const catName in grouped) {
            const comps = grouped[catName];

            let tableRows = comps.map((item, idx) => {
                const teamsListStr = item.teamVacancies
                    .map(tv => `${tv.teamName} (${tv.enrolled}/${tv.max})`)
                    .join(', ');

                return `
                    <tr style="border-bottom: 1px solid #E2E8F0;">
                        <td style="padding: 9px 10px; font-size: 11px;">${idx + 1}</td>
                        <td style="padding: 9px 10px; font-size: 11px; font-weight: 700; color: #0F172A;">${item.name}</td>
                        <td style="padding: 9px 10px; font-size: 11px; text-align: center;">${item.maxPerTeam}</td>
                        <td style="padding: 9px 10px; font-size: 11px; font-weight: 800; color: #E11D48; text-align: center;">${item.enrolledTotal} / ${item.totalCapacity}</td>
                        <td style="padding: 9px 10px; font-size: 10px; color: #475569; line-height: 1.4;">${teamsListStr}</td>
                    </tr>
                `;
            }).join('');

            container.innerHTML += `
                <div style="margin-bottom: 25px; page-break-inside: avoid;">
                    <div style="background: #1E293B; color: white; padding: 8px 12px; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
                        <span>CATEGORY: ${catName.toUpperCase()}</span>
                        <span style="font-size: 10px; color: #94A3B8;">${comps.length} UNDER-ENROLLED EVENT(S)</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                        <thead>
                            <tr style="background: #F8FAFC; text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #E2E8F0;">
                                <th style="padding: 8px 10px; width: 30px;">#</th>
                                <th style="padding: 8px 10px; width: 220px;">COMPETITION</th>
                                <th style="padding: 8px 10px; text-align: center; width: 90px;">QUOTA/TEAM</th>
                                <th style="padding: 8px 10px; text-align: center; width: 90px;">ENROLLED</th>
                                <th style="padding: 8px 10px;">TEAMS WITH OPEN SLOTS (FILLED/MAX)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `FestOS_Vacancy_Audit_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(container).save().then(() => showToast('Vacancy PDF Exported!'));
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==========================================
// JUDGE MANAGEMENT ENGINE
// ==========================================
let globalJudgesList = [];

async function loadJudgesManagement() {
    try {
        const [
            { data: judges, error: judgesErr },
            { data: assignments, error: assignErr }
        ] = await Promise.all([
            supabaseClient.from('users').select('id, username').eq('role', 'judge').order('username'),
            supabaseClient.from('judgements').select('judge_id, competition_id, competitions(name, categories(name), stages(name))')
        ]);
        
        if (judgesErr) throw judgesErr;
        if (assignErr) throw assignErr;
        globalJudgesList = judges || [];

        // 3. Group and deduplicate assignments per judge 
        // (Since judgements might have multiple rows per comp if marks are saved)
        globalJudgesList.forEach(judge => {
            const judgeAssigns = assignments.filter(a => a.judge_id === judge.id);
            const uniqueCompsMap = new Map();
            
            judgeAssigns.forEach(a => {
                if (a.competitions && !uniqueCompsMap.has(a.competition_id)) {
                    uniqueCompsMap.set(a.competition_id, a.competitions);
                }
            });
            
            judge.assignments = Array.from(uniqueCompsMap.entries()).map(([id, comp]) => ({ id, ...comp }));
        });

        renderJudgesTable();
    } catch (error) {
        showToast("Error loading judges: " + error.message, 'error');
    }
}

function renderJudgesTable() {
    const tbody = document.getElementById('judges-tbody');
    const searchVal = (document.getElementById('searchJudgeInput')?.value || '').toLowerCase();
    tbody.innerHTML = '';

    const filtered = globalJudgesList.filter(j => j.username.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">No judges found matching your search.</td></tr>`;
        return;
    }

    filtered.forEach(judge => {
        const assignCount = judge.assignments.length;
        const countBadge = assignCount > 0 
            ? `<span class="badge badge-primary">${assignCount} Events</span>` 
            : `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border);">Unassigned</span>`;

        const safeData = JSON.stringify(judge).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 700; font-size: 1.05rem;">
                    <i class="fa-solid fa-gavel" style="color: var(--primary); margin-right: 0.5rem;"></i> ${judge.username}
                </td>
                <td>${countBadge}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem; border-color: var(--primary); color: var(--primary);" onclick="viewJudgeDetails('${judge.id}')" ${assignCount === 0 ? 'disabled' : ''} title="View Schedule">
                            <i class="fa-solid fa-calendar-days"></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem; color: var(--danger); border-color: var(--danger);" onclick="exportSpecificJudgePDF('${judge.id}')" ${assignCount === 0 ? 'disabled' : ''} title="Download Schedule PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem;" onclick="openAssignJudgeEvents('${judge.id}')" title="Assign Events">
                            <i class="fa-solid fa-list-check"></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 0.4rem 0.75rem;" onclick='openJudgeModal(${safeData})' title="Edit Judge">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-danger" style="padding: 0.4rem 0.75rem;" onclick="deleteJudge('${judge.id}', '${judge.username}')" title="Delete Judge">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}


// --- CRUD: CREATE & EDIT JUDGE ---
async function openJudgeModal(editData = null) {
    let uId = ''; let uFullName = ''; let uName = ''; let uPass = '';
    
    if (editData) {
        uId = editData.id;
        uName = editData.username;
        // Fetch existing name and password hash so we can pre-fill it
        const {data} = await supabaseClient.from('users').select('name, password_hash').eq('id', uId).single();
        if(data) {
            uFullName = data.name || '';
            uPass = data.password_hash;
        }
    }
    
    openModal(editData ? 'Edit Judge Profile' : 'Register New Judge', `
        <input type="hidden" id="editJudgeId" value="${uId}">
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="newJudgeFullName" value="${uFullName}" placeholder="e.g. John Doe" autocomplete="off">
        </div>
        <div class="form-group">
            <label>Judge Username</label>
            <input type="text" id="newJudgeName" value="${uName}" placeholder="e.g. stage1_judge" autocomplete="off">
        </div>
        <div class="form-group">
            <label>Login Password</label>
            <input type="text" id="newJudgePass" value="${uPass}" placeholder="Enter password" autocomplete="off" style="text-transform: none !important;">
        </div>
    `, async () => {
        const id = document.getElementById('editJudgeId').value;
        const name = document.getElementById('newJudgeFullName').value.trim();
        const username = document.getElementById('newJudgeName').value.trim();
        const password_hash = document.getElementById('newJudgePass').value.trim();
        
        if (!username || !password_hash || !name) return showToast('Name, Username, and Password are required.', 'error');
        setLoading('modalSaveBtn', true);
        
        const payload = { name, username, password_hash, role: 'judge' };
        if (id) payload.id = id;
        
        const { error } = await supabaseClient.from('users').upsert([payload]);
        setLoading('modalSaveBtn', false);
        
        if (error) {
            if (error.code === '23505') showToast('Username already taken.', 'error'); 
            else showToast(error.message, 'error');
        } else { 
            showToast(id ? 'Judge profile updated!' : 'New Judge registered!'); 
            closeModal(); 
            loadJudgesManagement(); 
        }
    });
}

async function deleteJudge(id, username) {
    openConfirmModal("Delete Judge?", `Are you sure you want to permanently delete Judge "${username}"?`, async () => {
        try {
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') showToast(`Cannot delete ${username} as they have already submitted marks.`, 'error');
                else throw error;
            } else {
                showToast(`Judge ${username} deleted.`);
                loadJudgesManagement();
            }
        } catch(e) { showToast(e.message, 'error'); }
    });
}
// --- ASSIGNMENT WORKFLOW WITH FILTERING ---
let modalAssignComps = [];
let modalAssignedIds = [];

async function openAssignJudgeEvents(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    document.getElementById('assign-judge-title').innerText = `Assign Events: ${judge.username}`;
    document.getElementById('target-assign-judge-id').value = judgeId;
    
    const listContainer = document.getElementById('assign-judge-list');
    listContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching events...</div>';
    document.getElementById('assignJudgeEventsModal').classList.add('show');
    
    try {
        const { data: comps, error } = await supabaseClient
            .from('competitions')
            .select('id, name, categories(name)')
            .order('name');
            
        if (error) throw error;

        modalAssignComps = comps || [];
        modalAssignedIds = judge.assignments.map(a => a.id);
        
        // Populate category filter
        const uniqueCats = [...new Set(modalAssignComps.map(c => c.categories?.name || 'General'))].sort();
        const catSelect = document.getElementById('filterAssignJudgeCat');
        catSelect.innerHTML = '<option value="">All Categories</option>';
        uniqueCats.forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        
        document.getElementById('searchAssignJudgeComp').value = '';
        
        renderJudgeAssignList();

    } catch (e) {
        listContainer.innerHTML = `<p style="color:var(--danger); text-align:center;">Failed to load competitions.</p>`;
    }
}

function renderJudgeAssignList() {
    const search = document.getElementById('searchAssignJudgeComp').value.toLowerCase();
    const catFilter = document.getElementById('filterAssignJudgeCat').value;
    const listContainer = document.getElementById('assign-judge-list');
    
    let html = '';
    const filteredComps = modalAssignComps.filter(c => {
        const catName = c.categories?.name || 'General';
        const matchSearch = c.name.toLowerCase().includes(search);
        const matchCat = catFilter === '' || catName === catFilter;
        return matchSearch && matchCat;
    });
    
    if (filteredComps.length === 0) {
        html = `<p style="text-align:center; color:var(--text-muted); padding: 1rem;">No competitions match your filters.</p>`;
    } else {
        filteredComps.forEach(c => {
            const isChecked = modalAssignedIds.includes(c.id) ? 'checked' : '';
            html += `
                <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                    <input type="checkbox" class="judge-assign-cb" value="${c.id}" ${isChecked} onchange="updateModalAssignedIds(this)" style="width: 18px; height: 18px; accent-color: var(--primary);">
                    <div>
                        <strong style="display: block; font-size: 0.95rem;">${c.name}</strong>
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">${c.categories?.name || 'General'}</span>
                    </div>
                </label>
            `;
        });
    }
    listContainer.innerHTML = html;
}

function filterJudgeAssignList() {
    renderJudgeAssignList();
}

function updateModalAssignedIds(cb) {
    if (cb.checked) {
        if (!modalAssignedIds.includes(cb.value)) modalAssignedIds.push(cb.value);
    } else {
        modalAssignedIds = modalAssignedIds.filter(id => id !== cb.value);
    }
}

async function saveJudgeAssignments() {
    const judgeId = document.getElementById('target-assign-judge-id').value;
    const selectedCompIds = modalAssignedIds; // Fetch from memory, not DOM, because filters hide DOM checkboxes
    
    const btn = document.getElementById('btn-save-judge-assign');
    const originalText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        // Remove old generic assignments for this judge (where no marks have been awarded yet)
        await supabaseClient.from('judgements')
            .delete()
            .eq('judge_id', judgeId)
            .is('participant_id', null);
        
        // Insert new selected assignments
        if(selectedCompIds.length > 0) {
            const inserts = selectedCompIds.map(compId => ({ competition_id: compId, judge_id: judgeId }));
            await supabaseClient.from('judgements').insert(inserts);
        }
        
        showToast('Judge assignments updated successfully!');
        document.getElementById('assignJudgeEventsModal').classList.remove('show');
        loadJudgesManagement(); // Refresh table and data
        
    } catch(e) {
        showToast("Error updating assignments: " + e.message, 'error');
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
    }
}

async function exportSpecificJudgePDF(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;
    
    showToast(`Generating PDF for ${judge.username}...`, 'success');
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML(`Judge Schedule: ${judge.username}`);

    // Fetch Master Schedule dynamically to get live timing data
    const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
    const masterSchedule = schedData?.value || {};

    let tableRows = '';
    
    if (judge.assignments.length === 0) {
        tableRows = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No events currently assigned.</td></tr>`;
    } else {
        // Merge assignments with schedule data
        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

        // Sort chronologically by Date, then Time
        scheduledAssignments.sort((a, b) => {
            if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
            return a.sched.time.localeCompare(b.sched.time);
        });

        tableRows = scheduledAssignments.map((comp, i) => {
            const timeStr = comp.sched.date !== 'TBD' 
                ? `<span style="font-weight: 700;">${comp.sched.date}</span><br><span style="color: #64748B; font-size: 10px;">${comp.sched.time}</span>` 
                : `<span style="color: #D97706; font-weight: 600;">Unscheduled</span>`;

            return `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px 10px; font-size: 11px;">${i + 1}</td>
                <td style="padding: 8px 10px; font-size: 11px; color: #0F172A;">${timeStr}</td>
                <td style="padding: 8px 10px; font-size: 11px; font-weight: 600; color: #0F172A;">${comp.name}</td>
                <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.categories?.name || 'General'}</td>
                <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.stages?.name || 'Unassigned'}</td>
            </tr>
        `}).join('');
    }

    container.innerHTML += `
        <div style="margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0;">
                <thead>
                    <tr style="background: #F8FAFC; text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #E2E8F0; text-transform: uppercase;">
                        <th style="padding: 8px 10px; width: 40px;">#</th>
                        <th style="padding: 8px 10px;">DATE & TIME</th>
                        <th style="padding: 8px 10px;">COMPETITION NAME</th>
                        <th style="padding: 8px 10px;">CATEGORY</th>
                        <th style="padding: 8px 10px;">STAGE</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;

    const opt = { 
        margin: 10, 
        filename: `Judge_Schedule_${judge.username}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('PDF Exported!'));
}

// --- PREMIUM PDF EXPORT (ALL JUDGES) ---
async function exportJudgesPDF() {
    if (globalJudgesList.length === 0) return showToast('No judges found to export.', 'error');
    showToast('Generating Judge Roster PDF...', 'success');
    
    // Fetch Master Schedule dynamically to get live timing data
    const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
    const masterSchedule = schedData?.value || {};

    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'Inter, sans-serif';
    container.innerHTML = getPDFHeaderHTML('Master Judge & Allocation Roster');

    globalJudgesList.forEach((judge, index) => {
        let tableRows = '';
        
        if (judge.assignments.length === 0) {
            tableRows = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748B;">No events currently assigned to this judge.</td></tr>`;
        } else {
            // Merge assignments with schedule data
            const scheduledAssignments = judge.assignments.map(comp => {
                const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
                return { ...comp, sched };
            });

            // Sort chronologically by Date, then Time
            scheduledAssignments.sort((a, b) => {
                if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
                return a.sched.time.localeCompare(b.sched.time);
            });

            tableRows = scheduledAssignments.map((comp, i) => {
                const timeStr = comp.sched.date !== 'TBD' 
                    ? `<span style="font-weight: 700;">${comp.sched.date}</span><br><span style="color: #64748B; font-size: 10px;">${comp.sched.time}</span>` 
                    : `<span style="color: #D97706; font-weight: 600;">Unscheduled</span>`;

                return `
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 8px 10px; font-size: 11px;">${i + 1}</td>
                    <td style="padding: 8px 10px; font-size: 11px; color: #0F172A;">${timeStr}</td>
                    <td style="padding: 8px 10px; font-size: 11px; font-weight: 600; color: #0F172A;">${comp.name}</td>
                    <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.categories?.name || 'General'}</td>
                    <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${comp.stages?.name || 'Unassigned'}</td>
                </tr>
            `}).join('');
        }

        container.innerHTML += `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <div style="background: #1E293B; color: white; padding: 10px 12px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase;">
                        JUDGE: ${judge.username}
                    </h3>
                    <span style="font-size: 10px; color: #94A3B8; font-weight: 600;">${judge.assignments.length} ASSIGNMENTS</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E2E8F0; border-top: none;">
                    <thead>
                        <tr style="background: #F8FAFC; text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #E2E8F0; text-transform: uppercase;">
                            <th style="padding: 8px 10px; width: 40px;">#</th>
                            <th style="padding: 8px 10px;">DATE & TIME</th>
                            <th style="padding: 8px 10px;">COMPETITION NAME</th>
                            <th style="padding: 8px 10px;">CATEGORY</th>
                            <th style="padding: 8px 10px;">STAGE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    });

    const opt = { 
        margin: 10, 
        filename: `FestOS_Judge_Roster.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    
    html2pdf().set(opt).from(container).save().then(() => showToast('Roster PDF Exported!'));
}

function filterJudgesTable() {
    renderJudgesTable();
}

async function viewJudgeDetails(judgeId) {
    const judge = globalJudgesList.find(j => j.id === judgeId);
    if (!judge) return;

    document.getElementById('jd-modal-title').innerText = `Schedule: ${judge.username}`;
    const tbody = document.getElementById('jd-modal-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading schedule...</td></tr>`;
    document.getElementById('judgeDetailsModal').classList.add('show');

    try {
        // Fetch Master Schedule dynamically to get live timing data
        const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
        const masterSchedule = schedData?.value || {};

        tbody.innerHTML = '';

        if (judge.assignments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No events assigned to this judge.</td></tr>`;
            return;
        }

        // Merge assignments with schedule data
        const scheduledAssignments = judge.assignments.map(comp => {
            const sched = masterSchedule[comp.id] || { date: 'TBD', time: '--:--' };
            return { ...comp, sched };
        });

        // Sort chronologically by Date, then Time
        scheduledAssignments.sort((a, b) => {
            if (a.sched.date !== b.sched.date) return a.sched.date.localeCompare(b.sched.date);
            return a.sched.time.localeCompare(b.sched.time);
        });

        scheduledAssignments.forEach(comp => {
            const timeStr = comp.sched.date !== 'TBD' 
                ? `<span style="color: var(--primary); font-weight: 700;">${comp.sched.date}</span><br><span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">${comp.sched.time}</span>` 
                : `<span style="color: var(--warning); font-weight: 600; font-size: 0.8rem;">Unscheduled</span>`;
            
            tbody.innerHTML += `
                <tr>
                    <td style="white-space: nowrap;">${timeStr}</td>
                    <td style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${comp.name}</td>
                    <td><span class="badge" style="background: var(--bg-main); border: 1px solid var(--border); color: var(--text-muted);">${comp.categories?.name || 'General'}</span></td>
                    <td><span style="font-weight: 500;"><i class="fa-solid fa-microphone-stage" style="color: var(--primary); margin-right: 4px;"></i> ${comp.stages?.name || 'Unassigned'}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading schedule synchronization.</td></tr>`;
    }
}

// --- WEBSITE CUSTOMIZER ROUTING ENGINE ---
window.switchBuilderTab = function(tabId, element) {
    // 1. Update active state on sidebar items
    const navItems = document.querySelectorAll('.builder-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');
    
    // 2. Hide all panes
    const allPanes = document.querySelectorAll('.builder-content-pane');
    allPanes.forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    // 3. Show the target pane
    const targetPane = document.getElementById(`builder-pane-${tabId}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'flex';
    }
};


// ==========================================
// WEBSITE BUILDER / CUSTOMIZER ENGINE
// ==========================================

let websiteConfig = {
    domain: '',
    pages: {
        home: {
            progCount: '250+', partCount: '1.2K+', teamCount: '40+', venueCount: '6',
            aboutTitle: '', aboutSub: '', contentTitle: '', contentDesc: '',
            contact: { title: '', email: '', phone: '', wa: '', ig: '', fb: '', yt: '', web: '', address: ''}
        }
    },
    visibility: {
        page: { schedules: true, results: true, downloads: true, gallery: true, news: true, wall: true, myresult: true },
        nav: { schedules: true, results: true, downloads: true, gallery: true, news: true, wall: true, myresult: true },
        foot: { schedules: true, results: true, downloads: true, gallery: true, news: true, wall: true, myresult: true }
    },
    theme: {
        colors: { primary: '#EF4444', secondary: '#3B82F6', accent: '#F59E0B', bg: '#FFFFFF' }
    }
};

let webAnalyticsChart = null;

// Extends the existing switchTab function to initialize Builder Components
const existingSwitchTabHook = window.switchTab;
window.switchTab = function(tabId) {
    if(existingSwitchTabHook) existingSwitchTabHook(tabId);
    
    if (tabId === 'website-builder') {
        // Initialize the first tab (Overview)
        switchBuilderTab('overview', document.querySelector('.builder-nav-item.active') || document.querySelectorAll('.builder-nav-item')[0]);
        loadWebsiteConfig();
    }
};

window.switchBuilderTab = function(tabId, element) {
    // 1. Update active state on sidebar items
    const navItems = document.querySelectorAll('.builder-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');
    
    // 2. Hide all panes
    const allPanes = document.querySelectorAll('.builder-content-pane');
    allPanes.forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    
    // 3. Show the target pane
    const targetPane = document.getElementById(`builder-pane-${tabId}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'flex';
    }

    // 4. Initialize specific pane features
    if (tabId === 'analytics') {
        initProfessionalAnalytics();
    } else if (tabId === 'overview') {
        // Refresh iframes to ensure proper loading
        const deskFrame = document.getElementById('preview-desktop-frame');
        const mobFrame = document.getElementById('preview-mobile-frame');
        if (deskFrame) deskFrame.src = deskFrame.src;
        if (mobFrame) mobFrame.src = mobFrame.src;
    }
};

// --- Analytics Chart Initialization ---
function initProfessionalAnalytics() {
    const ctx = document.getElementById('websiteAnalyticsChart');
    if (!ctx) return;
    
    if (webAnalyticsChart) webAnalyticsChart.destroy();
    
    // Mock Data for Professional Chart matching screenshot theme
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const visitorsData = [1200, 1900, 3000, 5000, 2000, 3000, 4500];
    const pageviewsData = [2400, 3800, 6000, 10000, 4000, 6000, 9000];

    webAnalyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Page Views',
                    data: pageviewsData,
                    borderColor: '#3B82F6', // Primary Blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Unique Visitors',
                    data: visitorsData,
                    borderColor: '#10B981', // Success Green
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', weight: 600 } } }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#E5E7EB' } },
                x: { grid: { display: false } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// --- Loading and Saving Configuration ---
async function loadWebsiteConfig() {
    try {
        const { data, error } = await supabaseClient.from('settings').select('value').eq('id', 'website_config').maybeSingle();
        if (data && data.value) {
            websiteConfig = data.value;
            populateWebsiteForms();
        }
    } catch(e) {
        console.warn("Using default website configuration.");
        populateWebsiteForms(); // Populate defaults
    }
}

function populateWebsiteForms() {
    // Domains (FIXED ID REFERENCES)
    if(document.getElementById('web-subdomain')) {
        document.getElementById('web-subdomain').value = websiteConfig.domain || '';
        
        const fullUrl = websiteConfig.domain ? `${websiteConfig.domain}.festos.app` : 'festos.app';
        
        if(document.getElementById('overview-url-display-desk')) {
            document.getElementById('overview-url-display-desk').innerText = fullUrl;
        }
        if(document.getElementById('overview-url-display-footer')) {
            document.getElementById('overview-url-display-footer').innerText = fullUrl;
        }
        
        if(websiteConfig.domain && document.getElementById('subdomain-status')) {
            document.getElementById('subdomain-status').style.display = 'block';
        }
    }

    // Pages
    const p = websiteConfig.pages.home;
    if(document.getElementById('pg-prog-count')) document.getElementById('pg-prog-count').value = p.progCount || '';
    if(document.getElementById('pg-part-count')) document.getElementById('pg-part-count').value = p.partCount || '';
    if(document.getElementById('pg-team-count')) document.getElementById('pg-team-count').value = p.teamCount || '';
    if(document.getElementById('pg-venue-count')) document.getElementById('pg-venue-count').value = p.venueCount || '';
    if(document.getElementById('pg-about-title')) document.getElementById('pg-about-title').value = p.aboutTitle || '';
    if(document.getElementById('pg-about-sub')) document.getElementById('pg-about-sub').value = p.aboutSub || '';
    if(document.getElementById('pg-content-title')) document.getElementById('pg-content-title').value = p.contentTitle || '';
    if(document.getElementById('pg-content-desc')) document.getElementById('pg-content-desc').value = p.contentDesc || '';
    
    const c = p.contact || {};
    if(document.getElementById('pg-contact-title')) document.getElementById('pg-contact-title').value = c.title || '';
    if(document.getElementById('pg-contact-email')) document.getElementById('pg-contact-email').value = c.email || '';
    if(document.getElementById('pg-contact-phone')) document.getElementById('pg-contact-phone').value = c.phone || '';
    if(document.getElementById('pg-contact-wa')) document.getElementById('pg-contact-wa').value = c.wa || '';
    if(document.getElementById('pg-contact-ig')) document.getElementById('pg-contact-ig').value = c.ig || '';
    if(document.getElementById('pg-contact-fb')) document.getElementById('pg-contact-fb').value = c.fb || '';
    if(document.getElementById('pg-contact-yt')) document.getElementById('pg-contact-yt').value = c.yt || '';
    if(document.getElementById('pg-contact-web')) document.getElementById('pg-contact-web').value = c.web || '';
    if(document.getElementById('pg-contact-address')) document.getElementById('pg-contact-address').value = c.address || '';

    // Visibility
    const applyToggles = (category, data) => {
        Object.keys(data).forEach(key => {
            const el = document.getElementById(`vis-${category}-${key}`);
            if(el) el.checked = data[key];
        });
    };
    applyToggles('page', websiteConfig.visibility.page);
    applyToggles('nav', websiteConfig.visibility.nav);
    applyToggles('foot', websiteConfig.visibility.foot);
}

async function executeWebsiteSave(btnElement) {
    const originalText = btnElement ? btnElement.innerHTML : null;
    if (btnElement) {
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btnElement.disabled = true;
    }

    try {
        const { error } = await supabaseClient.from('settings').upsert({ id: 'website_config', value: websiteConfig });
        if (error) throw error;
        showToast("Website Settings Saved successfully!", "success");
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        if (btnElement && originalText !== null) {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    }
}

function saveDomainConfig(event) {
    const domainInputEl = document.getElementById('web-subdomain');
    const domainInput = domainInputEl ? domainInputEl.value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    websiteConfig.domain = domainInput;
    
    // Update the domain displays in the Overview pane
    const fullUrl = domainInput ? `${domainInput}.festos.app` : 'festos.app';
    const statusEl = document.getElementById('subdomain-status');
    if (statusEl) statusEl.style.display = domainInput ? 'block' : 'none';

    const previewDisp = document.getElementById('preview-url-display');
    if (previewDisp) previewDisp.innerText = fullUrl;

    const deskDisp = document.getElementById('overview-url-display-desk');
    if (deskDisp) deskDisp.innerText = fullUrl;

    const footerDisp = document.getElementById('overview-url-display-footer');
    if (footerDisp) footerDisp.innerText = fullUrl;
    
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}

function savePageConfig(event) {
    websiteConfig.pages.home = {
        progCount: document.getElementById('pg-prog-count')?.value || '',
        partCount: document.getElementById('pg-part-count')?.value || '',
        teamCount: document.getElementById('pg-team-count')?.value || '',
        venueCount: document.getElementById('pg-venue-count')?.value || '',
        aboutTitle: document.getElementById('pg-about-title')?.value || '',
        aboutSub: document.getElementById('pg-about-sub')?.value || '',
        contentTitle: document.getElementById('pg-content-title')?.value || '',
        contentDesc: document.getElementById('pg-content-desc')?.value || '',
        contact: {
            title: document.getElementById('pg-contact-title')?.value || '',
            email: document.getElementById('pg-contact-email')?.value || '',
            phone: document.getElementById('pg-contact-phone')?.value || '',
            wa: document.getElementById('pg-contact-wa')?.value || '',
            ig: document.getElementById('pg-contact-ig')?.value || '',
            fb: document.getElementById('pg-contact-fb')?.value || '',
            yt: document.getElementById('pg-contact-yt')?.value || '',
            web: document.getElementById('pg-contact-web')?.value || '',
            address: document.getElementById('pg-contact-address')?.value || ''
        }
    };
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}

function saveVisibilityConfig(event) {
    const keys = ['schedules', 'results', 'downloads', 'gallery', 'news', 'wall', 'myresult'];
    
    keys.forEach(k => {
        const pageEl = document.getElementById(`vis-page-${k}`);
        const navEl = document.getElementById(`vis-nav-${k}`);
        const footEl = document.getElementById(`vis-foot-${k}`);
        if (pageEl) websiteConfig.visibility.page[k] = pageEl.checked;
        if (navEl) websiteConfig.visibility.nav[k] = navEl.checked;
        if (footEl) websiteConfig.visibility.foot[k] = footEl.checked;
    });
    
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}

function saveThemeConfig(event) {
    // Future expansion: Save color palette selections
    const btn = event?.currentTarget || (typeof window !== 'undefined' && window.event?.currentTarget) || null;
    executeWebsiteSave(btn);
}

// Color Palette Interactivity (Mock functionality for the preview UI)
document.addEventListener('click', function(e) {
    if (e.target.closest('.color-circle-btn')) {
        const btn = e.target.closest('.color-circle-btn');
        const parent = btn.parentElement;
        parent.querySelectorAll('.color-circle-btn').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
    }
});

// ============================================================================
// DUAL-VIEW ASSIGNMENT ENGINE (OVERVIEW & QUICK ADD PORTED FROM TM)
// ============================================================================

window.switchAssignView = function(view) {
    document.getElementById('btn-assign-view-list').className = 'btn btn-outline';
    document.getElementById('btn-assign-view-bulk').className = 'btn btn-outline';
    document.getElementById('assign-view-list').style.display = 'none';
    document.getElementById('assign-view-bulk').style.display = 'none';
    
    if (view === 'bulk') {
        document.getElementById('btn-assign-view-bulk').className = 'btn btn-primary';
        document.getElementById('assign-view-bulk').style.display = 'block';
    } else {
        document.getElementById('btn-assign-view-list').className = 'btn btn-primary';
        document.getElementById('assign-view-list').style.display = 'block';
        if (typeof renderAssignOverview === 'function') renderAssignOverview();
    }
};

// Intercept existing initAssignWorkspace to populate Overview filters
const adminOriginalInitAssignWorkspace = window.initAssignWorkspace;
window.initAssignWorkspace = async function() {
    if (adminOriginalInitAssignWorkspace) await adminOriginalInitAssignWorkspace();
    
    // Fetch Participants into memory if empty
    if (participantsList.length === 0) { 
        const { data } = await supabaseClient.from('participants').select('*').order('name'); 
        participantsList = data || []; 
    }
    
    const catSelect = document.getElementById('filter-assign-overview-cat');
    if (catSelect) {
        catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
        categoriesList.forEach(c => { catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    }
    
    const teamSelect = document.getElementById('filter-assign-overview-team');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="all">-- SELECT TEAM TO ENABLE ADDING --</option>';
        teamsList.forEach(t => { teamSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
    }

    if (typeof window.switchAssignView === 'function') window.switchAssignView('list');
};

window.renderAssignOverview = async function() {
    const tbody = document.getElementById('assign-overview-tbody');
    if (!tbody) return;
    
    const search = document.getElementById('search-assign-overview').value.toLowerCase();
    const catFilter = document.getElementById('filter-assign-overview-cat').value;
    const teamFilter = document.getElementById('filter-assign-overview-team').value;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Live Assignments...</td></tr>';
    
    // Fetch fresh global assignments memory mapping
    const { data: assigns } = await supabaseClient.from('participant_competitions').select('*, participants(name, unique_id, category_id, team_id, teams(name), categories(name))');
    window.globalAdminAssignments = assigns || [];

    tbody.innerHTML = '';
    
    // SHOW ALL COMPETITIONS (Removed the filter for published/judgement_complete)
    const eligibleComps = competitionsList;

    if (eligibleComps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600;">NO COMPETITIONS AVAILABLE.</td></tr>';
        return;
    }

    eligibleComps.forEach(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        if (catFilter !== 'all' && comp.category_id != catFilter) return;
        if (search && !comp.name.toLowerCase().includes(search)) return;

        let enrolled = window.globalAdminAssignments.filter(a => a.competition_id === comp.id);
        
        // If a specific team is selected, filter enrolled specifically for visual clarity and drag-and-drop
        if (teamFilter !== 'all') {
            enrolled = enrolled.filter(a => a.participants?.team_id == teamFilter);
        }
        
        enrolled.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0));
        
        let studentsHtml = '';
        if (enrolled.length === 0) {
            studentsHtml = '<span style="color: var(--warning); font-size: 0.8rem; font-weight: 700; background: var(--warning-light); padding: 4px 8px; border-radius: 6px;">NO STUDENTS ENROLLED</span>';
        } else {
            studentsHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">';
            enrolled.forEach((a, index) => {
                const student = a.participants;
                if (!student) return;
                
                const pId = a.participant_id; // Safe ID pull
                
                let leaderBadge = '';
                if (comp.is_group && index === 0 && teamFilter !== 'all') {
                    leaderBadge = `<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; display: inline-flex; align-items: center; margin-right: 6px;">LEADER</span>`;
                }
                
                // Drag and drop is ONLY enabled if filtered down to a specific Team
                const dragProps = (comp.is_group && teamFilter !== 'all')
                    ? `draggable="true" class="draggable-item" data-comp-id="${comp.id}" data-student-id="${pId}" ondragstart="handleDragStart(event, '${comp.id}', '${pId}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${comp.id}', '${pId}')" ondragend="handleDragEnd(event)"` 
                    : '';
                const dragIcon = (comp.is_group && teamFilter !== 'all') ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; cursor: grab; margin-right: 8px;"></i>` : '';

                studentsHtml += `
                    <div ${dragProps} style="background: var(--bg-surface); border: 1px solid var(--border); padding: 0.5rem 0.75rem; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); width: 100%;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap;">
                            ${dragIcon}
                            ${leaderBadge}
                            <strong style="color: var(--text-main); font-size: 0.95rem;">${student.name}</strong>
                            <span style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; margin-left: 4px;">${student.unique_id}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-main); padding: 2px 6px; border-radius: 4px; margin-left: 4px; border: 1px solid var(--border);">${student.teams?.name || 'IND'}</span>
                        </div>
                        <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; min-height: auto; border-color: var(--danger); color: var(--danger); border-radius: 6px; width: auto; flex-shrink: 0;" onclick="quickRemoveStudent('${comp.id}', '${pId}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            });
            studentsHtml += '</div>';
        }

        let addBtn = '';
        if (teamFilter === 'all') {
            addBtn = `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem; text-align: center; display: block; white-space: normal;">SELECT TEAM IN FILTER TO ADD</span>`;
        } else {
            const isFull = comp.max_participants > 0 && enrolled.length >= comp.max_participants;
            addBtn = isFull 
                ? `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem; text-align: center; display: block;">TEAM LIMIT REACHED</span>`
                : `<button class="btn btn-primary" style="padding: 0.6rem 1rem; width: 100%; justify-content: center;" onclick="openQuickAddModal('${comp.id}', '${teamFilter}')"><i class="fa-solid fa-plus"></i> ADD PARTICIPANTS</button>`;
        }

        let pubBadge = '';
        if (comp.status === 'published' || comp.status === 'judgement_complete') {
            pubBadge = `<br><span class="badge badge-success" style="font-size: 0.65rem; margin-top: 4px;"><i class="fa-solid fa-check-double"></i> COMPLETED</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td data-label="COMPETITION" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; vertical-align: top;">
                    ${comp.name} <br><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px; display: inline-block;">(MAX: ${comp.max_participants} PER TEAM)</span>
                    ${pubBadge}
                    ${comp.is_group && enrolled.length > 0 && teamFilter !== 'all' ? `<br><span style="font-size: 0.65rem; color: var(--primary); font-weight: 800; margin-top: 4px; display: inline-block;"><i class="fa-solid fa-hand-pointer"></i> DRAG TO ARRANGE LEADER</span>` : ''}
                </td>
                <td data-label="CATEGORY" style="vertical-align: top;"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="ASSIGNED STUDENTS" style="width: 50%; vertical-align: top;">${studentsHtml}</td>
                <td data-label="ACTIONS" style="min-width: 150px; vertical-align: top;">${addBtn}</td>
            </tr>
        `;
    });
};

// --- DRAG & DROP LOGIC ---
window.handleDragStart = function(e, compId, studentId) {
    e.dataTransfer.setData('text/plain', JSON.stringify({compId, studentId}));
    e.target.style.opacity = '0.5';
};

window.handleDragEnd = function(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
};

window.handleDragOver = function(e) {
    e.preventDefault();
    const target = e.target.closest('.draggable-item');
    if(target) target.classList.add('drag-over');
};

window.handleDragLeave = function(e) {
    const target = e.target.closest('.draggable-item');
    if(target) target.classList.remove('drag-over');
};

window.handleDrop = async function(e, targetCompId, targetStudentId) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    const dataStr = e.dataTransfer.getData('text/plain');
    if(!dataStr) return;
    
    const {compId, studentId: draggedStudentId} = JSON.parse(dataStr);
    if(compId !== targetCompId || draggedStudentId === targetStudentId) return;
    
    const targetElement = e.target.closest('.draggable-item');
    const container = targetElement.parentNode;
    const draggedElement = document.querySelector(`[data-student-id="${draggedStudentId}"][data-comp-id="${compId}"]`);
    
    if(!draggedElement || !targetElement) return;

    // Visual Reorder
    const allItems = Array.from(container.children);
    const draggedIndex = allItems.indexOf(draggedElement);
    const targetIndex = allItems.indexOf(targetElement);
    
    if (draggedIndex < targetIndex) targetElement.after(draggedElement);
    else targetElement.before(draggedElement);
    
    const newLeaderId = container.firstElementChild.getAttribute('data-student-id');
    const teamFilter = document.getElementById('filter-assign-overview-team').value;
    
    // Instantly Update Local State UI (Enforce strict string type checks)
    let myEnrolled = window.globalAdminAssignments.filter(a => a.competition_id === compId && a.participants?.team_id == teamFilter);
    myEnrolled.forEach(a => { a.is_leader = (String(a.participant_id) === String(newLeaderId)); });
    renderAssignOverview();
    
    // Async background save
    try {
        const updates = myEnrolled.map(a => {
            return supabaseClient.from('participant_competitions').update({ is_leader: a.is_leader }).eq('id', a.id);
        });
        await Promise.all(updates);
    } catch(err) {
        showToast("Error saving order: " + err.message, "error");
    }
};

window.quickRemoveStudent = async function(compId, studentId) {
    openConfirmModal("Remove Student?", "Are you sure you want to completely remove this student from the competition?", async () => {
        try {
            const { error } = await supabaseClient.from('participant_competitions')
                .delete()
                .eq('competition_id', compId)
                .eq('participant_id', studentId);
                
            if (error) throw error;
            showToast("Student removed.", "success");
            renderAssignOverview();
        } catch(e) {
            showToast(e.message, "error");
        }
    });
};

// --- QUICK ADD MODAL LOGIC ---
window.tempSelectedStudents = [];
window.tempAvailableStudents = [];

window.openQuickAddModal = function(compId, teamId) {
    const comp = competitionsList.find(c => c.id === compId);
    if (!comp) return;

    // Filter Eligible Students from memory
    const eligibleStudents = participantsList.filter(student => {
        // Enforce the team matching exactly
        if (student.team_id != teamId) return false;
        
        if (student.category_id == comp.category_id) return true;
        if (comp.categories?.is_general) {
            const studentCategory = categoriesList.find(c => c.id == student.category_id);
            if (studentCategory) {
                let allowedCats = [];
                try {
                    let rawAllowed = studentCategory.allowed_general_categories;
                    if (typeof rawAllowed === 'string') allowedCats = JSON.parse(rawAllowed);
                    else if (Array.isArray(rawAllowed)) allowedCats = rawAllowed;
                } catch(e) {}
                if (allowedCats.some(id => id == comp.category_id)) return true;
            }
        }
        return false;
    });

    const enrolledIds = window.globalAdminAssignments.filter(a => a.competition_id === compId).map(a => a.participant_id);
    window.tempAvailableStudents = eligibleStudents.filter(s => !enrolledIds.includes(s.id));
    window.tempSelectedStudents = [];
    
    // Strict Limit Validations
    window.tempCompLimit = comp.max_participants > 0 ? comp.max_participants : 999;
    const enrolledTeamIds = window.globalAdminAssignments.filter(a => a.competition_id === compId && a.participants?.team_id == teamId).map(a => a.participant_id);
    window.tempSlotsLeft = window.tempCompLimit - enrolledTeamIds.length;
    
    window.tempCompId = compId;
    window.tempTeamId = teamId;
    window.tempIsGroup = comp.is_group;

    const limitStr = window.tempCompLimit > 100 ? 'UNLIMITED' : window.tempSlotsLeft;

    openModal(`ADD TO ${comp.name}`, `
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 1rem;">
            REMAINING CAPACITY FOR TEAM: <span id="qa-slots-left" style="color: var(--primary); font-size: 1rem;">${limitStr}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div style="border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-surface); overflow: hidden; display: flex; flex-direction: column;">
                <div style="padding: 0.75rem; background: var(--bg-main); font-size: 0.8rem; font-weight: 800; border-bottom: 1px solid var(--border);">AVAILABLE STUDENTS</div>
                <div id="qa-available-list" style="height: 280px; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
            </div>
            
            <div style="border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-surface); overflow: hidden; display: flex; flex-direction: column;">
                <div style="padding: 0.75rem; background: var(--bg-main); font-size: 0.8rem; font-weight: 800; border-bottom: 1px solid var(--border); color: var(--primary);">SELECTED (DRAG TO REORDER)</div>
                <div id="qa-selected-list" style="height: 280px; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
            </div>
        </div>
    `, async () => {
        if (window.tempSelectedStudents.length === 0) return showToast("Select at least one student.", "error");
        
        setLoading('modalSaveBtn', true);
        try {
            const existingGroup = window.globalAdminAssignments.filter(a => a.competition_id === window.tempCompId && a.participants?.team_id == window.tempTeamId);
            const isGroup = window.tempIsGroup;
            const groupId = isGroup ? (existingGroup.length > 0 ? existingGroup[0].group_id : `GRP_${window.tempCompId}_${window.tempTeamId}_${Date.now()}`) : null;
            
            const hasExistingLeader = existingGroup.some(a => a.is_leader);

            const payload = window.tempSelectedStudents.map((s, index) => ({
                participant_id: s.id,
                competition_id: window.tempCompId,
                group_id: groupId,
                is_leader: isGroup && !hasExistingLeader && index === 0
            }));

            const { data, error } = await supabaseClient.from('participant_competitions').insert(payload).select();
            if (error) throw error;
            
            showToast("Students added successfully!", "success");
            closeModal();
            renderAssignOverview();
        } catch (e) {
            showToast(e.message, "error");
        } finally {
            setLoading('modalSaveBtn', false);
        }
    });
    
    renderQAUI();
};

window.renderQAUI = function() {
    const availList = document.getElementById('qa-available-list');
    const selList = document.getElementById('qa-selected-list');
    const slotsEl = document.getElementById('qa-slots-left');
    
    if(!availList || !selList) return;
    
    const slotsLeft = window.tempSlotsLeft - window.tempSelectedStudents.length;
    slotsEl.innerText = window.tempCompLimit > 100 ? 'UNLIMITED' : Math.max(0, slotsLeft);
    slotsEl.style.color = slotsLeft <= 0 ? 'var(--danger)' : 'var(--primary)';

    availList.innerHTML = window.tempAvailableStudents.map(s => {
        const catLabel = categoriesList.find(c => c.id == s.category_id)?.name || 'GEN';
        return `
        <div style="background: var(--bg-main); padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border);">
            <div>
                <div style="font-size: 0.8rem; font-weight: 700;">${s.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.unique_id} <span style="background:white; color:var(--text-main); padding: 1px 4px; border-radius:4px; margin-left:4px; border: 1px solid var(--border);">${catLabel}</span></div>
            </div>
            <button class="btn btn-outline" style="min-height: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="qaAdd('${s.id}')" ${slotsLeft <= 0 ? 'disabled' : ''}><i class="fa-solid fa-plus"></i></button>
        </div>
    `}).join('') || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; font-weight:600;">No available students left</div>';

    const existingGroup = window.globalAdminAssignments.filter(a => a.competition_id === window.tempCompId && a.participants?.team_id == window.tempTeamId);
    const hasExistingLeader = existingGroup.some(a => a.is_leader);

    selList.innerHTML = window.tempSelectedStudents.map((s, index) => {
        const isLeader = window.tempIsGroup && !hasExistingLeader && index === 0;
        const leaderBadge = isLeader ? '<span style="margin-left:6px; font-size:0.55rem; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 800;">LEADER</span>' : '';
        const dragIcon = window.tempIsGroup && !hasExistingLeader ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; margin-right: 4px;"></i>` : '';
        const catLabel = categoriesList.find(c => c.id == s.category_id)?.name || 'GEN';
        
        return `
        <div class="qa-draggable" draggable="${window.tempIsGroup && !hasExistingLeader}" data-id="${s.id}" ondragstart="qaDragStart(event, '${s.id}')" ondragover="qaDragOver(event)" ondrop="qaDrop(event, '${s.id}')" ondragend="qaDragEnd(event)" style="background: white; padding: 0.5rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--primary); cursor: ${window.tempIsGroup && !hasExistingLeader ? 'grab' : 'default'}; box-shadow: var(--shadow-sm);">
            <div>
                <div style="font-size: 0.8rem; font-weight: 700;">${dragIcon}${s.name} ${leaderBadge}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.unique_id} <span style="background:var(--bg-main); color:var(--text-main); padding: 1px 4px; border-radius:4px; margin-left:4px; border: 1px solid var(--border);">${catLabel}</span></div>
            </div>
            <button class="btn btn-outline" style="min-height: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-color: var(--danger); color: var(--danger);" onclick="qaRemove('${s.id}')"><i class="fa-solid fa-minus"></i></button>
        </div>
    `}).join('') || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1rem; font-weight:600;">No students selected</div>';
};

window.qaAdd = function(id) {
    const slotsLeft = window.tempSlotsLeft - window.tempSelectedStudents.length;
    if(slotsLeft <= 0) return;
    const studentIndex = window.tempAvailableStudents.findIndex(s => s.id === id);
    if(studentIndex > -1) {
        window.tempSelectedStudents.push(window.tempAvailableStudents[studentIndex]);
        window.tempAvailableStudents.splice(studentIndex, 1);
        renderQAUI();
    }
};

window.qaRemove = function(id) {
    const studentIndex = window.tempSelectedStudents.findIndex(s => s.id === id);
    if(studentIndex > -1) {
        window.tempAvailableStudents.push(window.tempSelectedStudents[studentIndex]);
        window.tempSelectedStudents.splice(studentIndex, 1);
        window.tempAvailableStudents.sort((a,b) => a.name.localeCompare(b.name));
        renderQAUI();
    }
};

window.qaDragStart = function(e, id) { e.dataTransfer.setData('text/plain', id); e.target.style.opacity = '0.5'; };
window.qaDragEnd = function(e) { e.target.style.opacity = '1'; document.querySelectorAll('.qa-draggable').forEach(el => el.classList.remove('drag-over')); };
window.qaDragOver = function(e) { e.preventDefault(); const target = e.target.closest('.qa-draggable'); if(target) target.classList.add('drag-over'); };
window.qaDrop = function(e, targetId) {
    e.preventDefault();
    document.querySelectorAll('.qa-draggable').forEach(el => el.classList.remove('drag-over'));
    const draggedId = e.dataTransfer.getData('text/plain');
    if(!draggedId || draggedId === targetId) return;

    const draggedIndex = window.tempSelectedStudents.findIndex(s => s.id === draggedId);
    const targetIndex = window.tempSelectedStudents.findIndex(s => s.id === targetId);
    
    if (draggedIndex > -1 && targetIndex > -1) {
        const item = window.tempSelectedStudents.splice(draggedIndex, 1)[0];
        window.tempSelectedStudents.splice(targetIndex, 0, item);
        renderQAUI(); 
    }
};

// Shows the Assignment Mode modal when clicking "Assign Now" in Vacancy Audit
window.routeToAdminAssignment = function(catId, compId) {
    document.getElementById('vacancyModal').classList.remove('show');
    
    document.getElementById('route-cat-id').value = catId;
    document.getElementById('route-comp-id').value = compId;
    
    document.getElementById('assignModeModal').classList.add('show');
};

// Handles the logic when they select either Quick Add or Bulk Assigner
window.executeRouteToAdminAssignment = async function(mode) {
    document.getElementById('assignModeModal').classList.remove('show');
    
    const catId = document.getElementById('route-cat-id').value;
    const compId = document.getElementById('route-comp-id').value;
    
    switchTab('assignments');
    
    if (mode === 'bulk') {
        if (typeof window.switchAssignView === 'function') window.switchAssignView('bulk');
        
        const catSelect = document.getElementById('assignWorkCategory');
        if (catSelect) {
            catSelect.value = catId;
            await window.loadAssignWorkspaceCompetitions();
        }
        
        setTimeout(async () => {
            const compSelect = document.getElementById('assignWorkComp');
            if (compSelect) {
                compSelect.value = compId;
                await window.loadAssignWorkspaceStudents();
            }
        }, 200);
        
    } else {
        if (typeof window.switchAssignView === 'function') window.switchAssignView('list');
        
        const catSelect = document.getElementById('filter-assign-overview-cat');
        if (catSelect) {
            catSelect.value = catId;
            window.renderAssignOverview();
        }
        
        setTimeout(() => {
            const teamFilter = document.getElementById('filter-assign-overview-team').value;
            if (teamFilter === 'all') {
                showToast('Please select a Team in the filter first to enable Quick Add', 'warning');
                // Auto-highlight the team filter to guide the admin
                document.getElementById('filter-assign-overview-team').style.boxShadow = '0 0 0 3px var(--primary-ring)';
                setTimeout(() => document.getElementById('filter-assign-overview-team').style.boxShadow = 'none', 2000);
            } else {
                window.openQuickAddModal(compId, teamFilter);
            }
        }, 300);
    }
};

// ============================================================================
// ADMIN ASSIGNMENT ENGINE V2: DUAL-VIEW, SEARCH, & ROUTING
// ============================================================================

window.switchAssignView = function(view) {
    document.getElementById('btn-assign-view-list').className = 'btn btn-outline';
    document.getElementById('btn-assign-view-bulk').className = 'btn btn-outline';
    document.getElementById('assign-view-list').style.display = 'none';
    document.getElementById('assign-view-bulk').style.display = 'none';
    
    if (view === 'bulk') {
        document.getElementById('btn-assign-view-bulk').className = 'btn btn-primary';
        document.getElementById('assign-view-bulk').style.display = 'block';
    } else {
        document.getElementById('btn-assign-view-list').className = 'btn btn-primary';
        document.getElementById('assign-view-list').style.display = 'block';
        if (typeof window.renderAssignOverview === 'function') window.renderAssignOverview();
    }
};

// FIX: Ensure ALL required data is loaded before rendering assignments
window.initAssignWorkspace = async function() {
    if (categoriesList.length === 0) { const { data } = await supabaseClient.from('categories').select('*').order('name'); categoriesList = data || []; }
    if (teamsList.length === 0) { const { data } = await supabaseClient.from('teams').select('*').order('name'); teamsList = data || []; }
    if (participantsList.length === 0) { const { data } = await supabaseClient.from('participants').select('*').order('name'); participantsList = data || []; }
    if (competitionsList.length === 0) { const { data } = await supabaseClient.from('competitions').select('*, categories(name)').order('name'); competitionsList = data || []; }
    
    // Populate Overview Filters
    const catSelect = document.getElementById('filter-assign-overview-cat');
    if (catSelect) {
        catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
        categoriesList.forEach(c => { catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    }
    
    const teamSelect = document.getElementById('filter-assign-overview-team');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="all">-- SELECT TEAM TO ENABLE ADDING --</option>';
        teamsList.forEach(t => { teamSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
    }
    
    // Populate Bulk Assigner Category Filter
    const bulkCatSelect = document.getElementById('assignWorkCategory');
    if (bulkCatSelect) {
        bulkCatSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY --</option>';
        categoriesList.forEach(c => {
            bulkCatSelect.innerHTML += `<option value="${c.id}" data-general="${c.is_general}">${c.name} ${c.is_general ? '(GENERAL)' : ''}</option>`;
        });
    }

    if (typeof window.switchAssignView === 'function') window.switchAssignView('list');
};

// FIX: Search and display ALL competitions dynamically in the Bulk Assigner
window.currentWorkspaceComps = [];
window.loadAssignWorkspaceCompetitions = async function() {
    const categoryId = document.getElementById('assignWorkCategory').value;
    const compSelect = document.getElementById('assignWorkComp');
    document.getElementById('assignStudentWorkspace').style.display = 'none';
    
    const searchInput = document.getElementById('assignWorkCompSearch');
    if (searchInput) searchInput.value = ''; // Reset search
    
    if (!categoryId) {
        compSelect.innerHTML = '<option value="">-- CHOOSE CATEGORY FIRST --</option>';
        compSelect.disabled = true;
        currentWorkspaceComps = [];
        return;
    }

    // Pull instantly from memory rather than querying the DB, ensuring all statuses are shown
    currentWorkspaceComps = competitionsList.filter(c => String(c.category_id) === String(categoryId));
    window.renderAssignWorkspaceDropdown(currentWorkspaceComps);
};

window.renderAssignWorkspaceDropdown = function(comps) {
    const compSelect = document.getElementById('assignWorkComp');
    compSelect.innerHTML = '<option value="">-- SELECT COMPETITION TO MANAGE --</option>';
    comps.forEach(c => {
        compSelect.innerHTML += `<option value="${c.id}" data-limit="${c.max_participants}" data-is-group="${c.is_group}">${c.name}</option>`;
    });
    compSelect.disabled = false;
};

window.filterAssignWorkspaceDropdown = function() {
    const search = document.getElementById('assignWorkCompSearch').value.toLowerCase();
    const filtered = currentWorkspaceComps.filter(c => c.name.toLowerCase().includes(search));
    window.renderAssignWorkspaceDropdown(filtered);
};


// FIX: Overview Renderer - Show ALL competitions and secure drag-and-drop IDs
window.renderAssignOverview = async function() {
    const tbody = document.getElementById('assign-overview-tbody');
    if (!tbody) return;
    
    const search = document.getElementById('search-assign-overview').value.toLowerCase();
    const catFilter = document.getElementById('filter-assign-overview-cat').value;
    const teamFilter = document.getElementById('filter-assign-overview-team').value;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Live Assignments...</td></tr>';
    
    // Fetch fresh global assignments memory mapping
    const { data: assigns } = await supabaseClient.from('participant_competitions').select('*, participants(name, unique_id, category_id, team_id, teams(name), categories(name))');
    window.globalAdminAssignments = assigns || [];

    tbody.innerHTML = '';
    
    // SHOW ALL COMPETITIONS
    const eligibleComps = competitionsList;

    if (eligibleComps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600;">NO COMPETITIONS AVAILABLE.</td></tr>';
        return;
    }

    eligibleComps.forEach(comp => {
        const catName = comp.categories?.name || 'UNCATEGORIZED';
        if (catFilter !== 'all' && String(comp.category_id) !== String(catFilter)) return;
        if (search && !comp.name.toLowerCase().includes(search)) return;

        let enrolled = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(comp.id));
        
        if (teamFilter !== 'all') {
            enrolled = enrolled.filter(a => String(a.participants?.team_id) === String(teamFilter));
        }
        
        enrolled.sort((a, b) => (b.is_leader ? 1 : 0) - (a.is_leader ? 1 : 0));
        
        let studentsHtml = '';
        if (enrolled.length === 0) {
            studentsHtml = '<span style="color: var(--warning); font-size: 0.8rem; font-weight: 700; background: var(--warning-light); padding: 4px 8px; border-radius: 6px;">NO STUDENTS ENROLLED</span>';
        } else {
            studentsHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">';
            enrolled.forEach((a, index) => {
                const student = a.participants;
                if (!student) return;
                
                const pId = a.participant_id; // Absolute safe ID pull
                
                let leaderBadge = '';
                if (comp.is_group && index === 0 && teamFilter !== 'all') {
                    leaderBadge = `<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; display: inline-flex; align-items: center; margin-right: 6px;">LEADER</span>`;
                }
                
                // Drag and drop is ONLY enabled if filtered down to a specific Team
                const dragProps = (comp.is_group && teamFilter !== 'all')
                    ? `draggable="true" class="draggable-item" data-comp-id="${comp.id}" data-student-id="${pId}" ondragstart="handleDragStart(event, '${comp.id}', '${pId}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${comp.id}', '${pId}')" ondragend="handleDragEnd(event)"` 
                    : '';
                const dragIcon = (comp.is_group && teamFilter !== 'all') ? `<i class="fa-solid fa-grip-vertical" style="color: #CBD5E1; cursor: grab; margin-right: 8px;"></i>` : '';

                studentsHtml += `
                    <div ${dragProps} style="background: var(--bg-surface); border: 1px solid var(--border); padding: 0.5rem 0.75rem; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); width: 100%;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap;">
                            ${dragIcon}
                            ${leaderBadge}
                            <strong style="color: var(--text-main); font-size: 0.95rem;">${student.name}</strong>
                            <span style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; margin-left: 4px;">${student.unique_id}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-main); padding: 2px 6px; border-radius: 4px; margin-left: 4px; border: 1px solid var(--border);">${student.teams?.name || 'IND'}</span>
                        </div>
                        <button class="btn btn-outline" style="padding: 0.35rem 0.6rem; min-height: auto; border-color: var(--danger); color: var(--danger); border-radius: 6px; width: auto; flex-shrink: 0;" onclick="quickRemoveStudent('${comp.id}', '${pId}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            });
            studentsHtml += '</div>';
        }

        let addBtn = '';
        if (teamFilter === 'all') {
            addBtn = `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem; text-align: center; display: block; white-space: normal;">SELECT TEAM IN FILTER TO ADD</span>`;
        } else {
            const isFull = comp.max_participants > 0 && enrolled.length >= comp.max_participants;
            addBtn = isFull 
                ? `<span class="badge" style="background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border); padding: 0.6rem 1rem; text-align: center; display: block;">TEAM LIMIT REACHED</span>`
                : `<button class="btn btn-primary" style="padding: 0.6rem 1rem; width: 100%; justify-content: center;" onclick="openQuickAddModal('${comp.id}', '${teamFilter}')"><i class="fa-solid fa-plus"></i> ADD PARTICIPANTS</button>`;
        }

        let pubBadge = '';
        if (comp.status === 'published' || comp.status === 'judgement_complete') {
            pubBadge = `<br><span class="badge badge-success" style="font-size: 0.65rem; margin-top: 4px;"><i class="fa-solid fa-check-double"></i> COMPLETED</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td data-label="COMPETITION" style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; vertical-align: top;">
                    ${comp.name} <br><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px; display: inline-block;">(MAX: ${comp.max_participants} PER TEAM)</span>
                    ${pubBadge}
                    ${comp.is_group && enrolled.length > 0 && teamFilter !== 'all' ? `<br><span style="font-size: 0.65rem; color: var(--primary); font-weight: 800; margin-top: 4px; display: inline-block;"><i class="fa-solid fa-hand-pointer"></i> DRAG TO ARRANGE LEADER</span>` : ''}
                </td>
                <td data-label="CATEGORY" style="vertical-align: top;"><span class="badge badge-gray">${catName}</span></td>
                <td data-label="ASSIGNED STUDENTS" style="width: 50%; vertical-align: top;">${studentsHtml}</td>
                <td data-label="ACTIONS" style="min-width: 150px; vertical-align: top;">${addBtn}</td>
            </tr>
        `;
    });
};

// FIX: Drag logic secured string comparison
window.handleDrop = async function(e, targetCompId, targetStudentId) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    const dataStr = e.dataTransfer.getData('text/plain');
    if(!dataStr) return;
    
    const {compId, studentId: draggedStudentId} = JSON.parse(dataStr);
    if(compId !== targetCompId || draggedStudentId === targetStudentId) return;
    
    const targetElement = e.target.closest('.draggable-item');
    const container = targetElement.parentNode;
    const draggedElement = document.querySelector(`[data-student-id="${draggedStudentId}"][data-comp-id="${compId}"]`);
    
    if(!draggedElement || !targetElement) return;

    // Visual Reorder
    const allItems = Array.from(container.children);
    const draggedIndex = allItems.indexOf(draggedElement);
    const targetIndex = allItems.indexOf(targetElement);
    
    if (draggedIndex < targetIndex) targetElement.after(draggedElement);
    else targetElement.before(draggedElement);
    
    const newLeaderId = container.firstElementChild.getAttribute('data-student-id');
    const teamFilter = document.getElementById('filter-assign-overview-team').value;
    
    // Instantly Update Local State UI
    let myEnrolled = window.globalAdminAssignments.filter(a => String(a.competition_id) === String(compId) && String(a.participants?.team_id) === String(teamFilter));
    myEnrolled.forEach(a => { a.is_leader = (String(a.participant_id) === String(newLeaderId)); });
    window.renderAssignOverview();
    
    // Async background save
    try {
        const updates = myEnrolled.map(a => {
            return supabaseClient.from('participant_competitions').update({ is_leader: a.is_leader }).eq('id', a.id);
        });
        await Promise.all(updates);
    } catch(err) {
        showToast("Error saving order: " + err.message, "error");
    }
};

// ROUTING: Connects Vacancy Audit directly to the tools
window.routeToAdminAssignment = function(catId, compId) {
    document.getElementById('vacancyModal').classList.remove('show');
    
    document.getElementById('route-cat-id').value = catId;
    document.getElementById('route-comp-id').value = compId;
    
    document.getElementById('assignModeModal').classList.add('show');
};

window.executeRouteToAdminAssignment = async function(mode) {
    document.getElementById('assignModeModal').classList.remove('show');
    
    const catId = document.getElementById('route-cat-id').value;
    const compId = document.getElementById('route-comp-id').value;
    
    switchTab('assignments');
    
    if (mode === 'bulk') {
        if (typeof window.switchAssignView === 'function') window.switchAssignView('bulk');
        
        const catSelect = document.getElementById('assignWorkCategory');
        if (catSelect) {
            catSelect.value = catId;
            await window.loadAssignWorkspaceCompetitions();
        }
        
        setTimeout(async () => {
            const compSelect = document.getElementById('assignWorkComp');
            if (compSelect) {
                compSelect.value = compId;
                await window.loadAssignWorkspaceStudents();
            }
        }, 300);
        
    } else {
        if (typeof window.switchAssignView === 'function') window.switchAssignView('list');
        
        const catSelect = document.getElementById('filter-assign-overview-cat');
        if (catSelect) {
            catSelect.value = catId;
            window.renderAssignOverview();
        }
        
        setTimeout(() => {
            const teamFilter = document.getElementById('filter-assign-overview-team').value;
            if (teamFilter === 'all') {
                showToast('Please select a Team in the filter first to enable Quick Add', 'warning');
                document.getElementById('filter-assign-overview-team').style.boxShadow = '0 0 0 3px var(--primary-ring)';
                setTimeout(() => document.getElementById('filter-assign-overview-team').style.boxShadow = 'none', 2500);
            } else {
                window.openQuickAddModal(compId, teamFilter);
            }
        }, 400);
    }
};