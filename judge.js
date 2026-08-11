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
    if (!user || (user.role !== 'judge' && user.role !== 'master_admin' && user.role !== 'admin')) {
        window.location.href = 'index.html';
        return; 
    }

    // Update UI
    let roleDisplay = (user.role === 'master_admin' || user.role === 'admin') ? '(Admin Override)' : '';
    document.getElementById('judge-name').innerText = `Welcome, ${user.username || user.email} ${roleDisplay}`;

    if (user.role === 'master_admin' || user.role === 'admin') {
        const nav = document.querySelector('.navbar-actions');
        nav.insertAdjacentHTML('afterbegin', `<button class="btn btn-primary" style="padding: 0.5rem; height: 40px; min-width: 40px;" onclick="window.location.href='admin.html'" title="Admin Hub"><i class="fa-solid fa-shield-halved"></i></button>`);
    }

    loadDashboard(); 
}

// 2. Load Assigned Competitions (Global Grading Fix)
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align: center; padding: 3rem 1rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem;"></i><p style="color: var(--text-muted); font-weight: 600;">Loading assignments...</p></div>`;

    globalJudgeComps = []; // Reset global state

    if (user.role === 'master_admin' || user.role === 'admin') {
        
        const { data: allComps, error } = await supabaseClient
            .from('competitions')
            .select('*, categories(name)')
            .in('status', ['registration', 'ongoing', 'valuation']); // NEW: Added valuation
            
        if (error) return container.innerHTML = `<p style="color: #EF4444; text-align:center; font-weight: 600; padding: 2rem;">Failed to load competitions.</p>`;
        
        const { data: gradedRecords } = await supabaseClient
            .from('judgements')
            .select('competition_id')
            .not('awarded_mark', 'is', null);

        const gradedIds = new Set(gradedRecords?.map(m => m.competition_id) || []);

        allComps.forEach(comp => {
            if (!gradedIds.has(comp.id)) globalJudgeComps.push(comp);
        });

    } else {
        const { data: assignments, error: assignError } = await supabaseClient
            .from('judgements')
            .select(`
                competition_id, 
                competitions!inner(id, name, max_mark, status, is_offstage, categories(name))
            `)
            .eq('judge_id', user.id)
            .is('participant_id', null)
            .in('competitions.status', ['registration', 'ongoing', 'valuation']); // NEW: Added valuation

        if (assignError) return container.innerHTML = `<p style="color: #EF4444; text-align:center; font-weight: 600; padding: 2rem;">Failed to load assignments.</p>`;
        
        if (assignments && assignments.length > 0) {
            const activeCompIds = assignments.map(a => a.competition_id);

            const { data: gradedRecords } = await supabaseClient
                .from('judgements')
                .select('competition_id')
                .in('competition_id', activeCompIds)
                .not('awarded_mark', 'is', null);

            const gradedIds = new Set(gradedRecords?.map(m => m.competition_id) || []);
            
            assignments.forEach(row => {
                if (row.competitions && !gradedIds.has(row.competition_id)) {
                    globalJudgeComps.push(row.competitions);
                }
            });
        }
    }

    // NEW: Dynamic sorting putting "Ready" events at the top
    globalJudgeComps.sort((a, b) => {
        const aReady = a.is_offstage ? a.status === 'valuation' : a.status === 'ongoing';
        const bReady = b.is_offstage ? b.status === 'valuation' : b.status === 'ongoing';
        
        if (aReady && !bReady) return -1;
        if (!aReady && bReady) return 1;
        
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
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

    // Render the UI
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
            <div style="text-align: center; padding: 4rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-clipboard-check" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.05rem; font-weight: 600;">No assignments pending.</p>
            </div>`;
        return;
    }

    data.forEach(comp => {
        // --- NEW: STRICT EVALUATION LOCK LOGIC ---
        const isReady = comp.is_offstage ? (comp.status === 'valuation') : (comp.status === 'ongoing');
        
        let statusText = 'Starts Soon';
        if (isReady) {
            statusText = 'Ready to Evaluate';
        } else if (comp.is_offstage && comp.status === 'ongoing') {
            statusText = 'Event Ongoing'; // Tell judge to wait for it to end
        }

        const badgeColor = isReady ? 'var(--success)' : '#D97706';
        const badgeBg = isReady ? 'var(--success-light)' : 'var(--warning-light)';
        const btnState = isReady ? '' : 'disabled';
        const btnText = isReady ? 'Evaluate Now' : 'Waiting...';
        const categoryName = comp.categories?.name || 'UNCATEGORIZED';
        
        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.innerHTML = `
            <div class="comp-card-inner">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: var(--primary); letter-spacing: 0.05em; background: var(--primary-light); padding: 0.35rem 0.75rem; border-radius: 6px;">${categoryName}</span>
                        <span style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 0.35rem 0.75rem; border-radius: 6px;">
                            <span style="display: inline-block; width: 6px; height: 6px; background: ${badgeColor}; border-radius: 50%;"></span>
                            ${statusText}
                        </span>
                    </div>
                    <h3 style="margin-bottom: 0.25rem; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em;">${comp.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">
                        Max Mark: <strong style="color: var(--text-main);">${comp.max_mark}</strong>
                    </p>
                </div>
               <button class="btn ${isReady ? 'btn-primary' : 'btn-outline'}" ${btnState} onclick="openEvaluation('${comp.id}')" style="margin-top: 1rem; width: 100%;">
                    ${btnText}
               </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function openEvaluation(compId) {
    const comp = globalJudgeComps.find(c => c.id === compId);
    if (!comp) return;

    currentCompId = comp.id;
    currentMaxMark = comp.max_mark;

    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('evaluation-view').style.display = 'block';
    document.getElementById('eval-comp-name').innerText = comp.name;
    document.getElementById('eval-max-mark').innerText = currentMaxMark;
    window.scrollTo(0, 0); // Reset scroll position

    const container = document.getElementById('participants-container');
    container.innerHTML = `<div style="text-align: center; padding: 3rem 1rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem;"></i><p style="color: var(--text-muted); font-weight: 600;">Loading participants...</p></div>`;

    const { data: registrations, error } = await supabaseClient
        .from('participant_competitions')
        .select('participant_id, code_letter, is_leader, group_id, competitions(is_group)')
        .eq('competition_id', compId)
        .eq('is_present', true)
        .order('code_letter', { ascending: true });

    container.innerHTML = '';

    if (error) {
        console.error(error);
        container.innerHTML = `<p style="color: #EF4444; text-align: center; font-weight: 600; padding: 2rem;">Error loading participants.</p>`;
        return;
    }

    if (!registrations || registrations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-user-xmark" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.05rem; font-weight: 600;">No participants have been marked present yet.</p>
            </div>`;
        return;
    }

    registrations.forEach(reg => {
        const isGroupEvent = reg.competitions?.is_group;
        let roleBadge = '';
        if (isGroupEvent) {
            roleBadge = reg.is_leader 
                ? `<span style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; padding: 3px 8px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Leader</span>`
                : `<span style="background: #E2E8F0; color: #475569; font-size: 0.65rem; padding: 3px 8px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Party</span>`;
        }

        container.innerHTML += `
            <div class="participant-row" data-pid="${reg.participant_id}">
                <div class="participant-info">
                    <div class="code-letter">
                        ${reg.code_letter || '?'}
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Participant</span>
                        <span style="font-weight: 800; font-size: 1.15rem; color: var(--text-main); margin-top: -2px;">${reg.code_letter ? 'Code ' + reg.code_letter : 'Unknown'}</span>
                        ${roleBadge ? `<div style="margin-top: 4px;">${roleBadge}</div>` : ''}
                    </div>
                </div>
                <div class="mark-wrapper">
                    <input type="number" 
                           class="mark-input" 
                           placeholder="00.0" 
                           min="0" 
                           max="${currentMaxMark}" 
                           step="0.5" 
                           inputmode="decimal"
                           oninput="validateMark(this, ${currentMaxMark})">
                    <div class="max-mark-divider"></div>
                    <span class="max-mark-label">${currentMaxMark}</span>
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
        showToast("Please enter marks for all participants before submitting.", "error");
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

    const { error } = await supabaseClient
        .from('judgements')
        .upsert(marksData, { onConflict: 'competition_id,judge_id,participant_id' });

    if (error) {
        showToast('Error submitting marks: ' + error.message, "error");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Final Marks';
    } else {
        showToast('Marks submitted successfully!', "success");
        closeEvaluation();
        loadDashboard(); 
    }
}

function closeEvaluation() {
    document.getElementById('evaluation-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    currentCompId = null;
    const btn = document.getElementById('submit-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Final Marks';
    window.scrollTo(0, 0);
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message); // Fallback

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:var(--success); font-size:1.25rem;"></i>' 
                                    : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger); font-size:1.25rem;"></i>';
    toast.innerHTML = `${icon} <span style="font-weight:600;">${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.animation = 'fadeOut 0.3s forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // Other init functions...
    fetchAndApplyBranding();
});

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

    // 2. Global Favicon Injection (Instantly updates across all pages)
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

    // 3. UI Header Updates
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // Dynamic Logo Sizing
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 32px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // Dynamic Text
        if (showName) {
            html += `<span style="letter-spacing: -0.5px;">${validName ? brandingData.fest_name : 'FestOS'}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        
        // Centering logic for specific screens
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login')) {
            container.style.justifyContent = 'center';
        }
    });

    // Store globally for PDF Generators
    if (typeof window !== 'undefined') window.systemBranding = brandingData;
}

// Boot up
initializeApp();