const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
if (typeof window !== 'undefined') window.supabaseClient = supabaseClient;

let currentCompId = null;
let currentMaxMark = 0;
let user = null; 
let globalJudgeComps = []; // NEW: Caches the fetched competitions for filtering

// Dynamic Layout Padding Adjustment
function adjustLayoutPadding() {
    const navbar = document.querySelector('.navbar > div:first-child') || document.querySelector('.navbar');
    if (navbar) {
        document.body.style.paddingTop = `${navbar.offsetHeight + 15}px`;
    }
}
window.addEventListener('resize', adjustLayoutPadding);

// Collapsible Filter Drawer Toggle
function toggleFilterDrawer() {
    const drawer = document.getElementById('filter-drawer');
    const btn = document.getElementById('filter-toggle-btn');
    if (!drawer) return;
    const isHidden = window.getComputedStyle(drawer).display === 'none';
    if (isHidden) {
        drawer.style.display = 'block';
        if (btn) btn.classList.add('active');
        const searchInput = document.getElementById('judgeSearch');
        if (searchInput) searchInput.focus();
    } else {
        drawer.style.display = 'none';
        if (btn) btn.classList.remove('active');
    }
    adjustLayoutPadding();
}
window.toggleFilterDrawer = toggleFilterDrawer;

// 1. Initialize App and Auth
async function initializeApp() {
    user = JSON.parse(localStorage.getItem('festUser'));

    // Security Check
    if (!user || (user.role !== 'judge' && user.role !== 'master_admin' && user.role !== 'admin')) {
        window.location.href = 'index.html';
        return; 
    }

    // Update UI
    let roleDisplay = (user.role === 'master_admin' || user.role === 'admin') ? ' (Admin)' : '';
    const welcomeMsg = document.getElementById('welcome-msg') || document.getElementById('judge-name');
    if (welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${user.username || user.email}${roleDisplay}`;
    }
    const judgeName = document.getElementById('judge-name');
    if (judgeName && judgeName !== welcomeMsg) {
        judgeName.innerText = `Welcome, ${user.username || user.email}${roleDisplay}`;
    }

    if (user.role === 'master_admin' || user.role === 'admin') {
        const nav = document.getElementById('global-nav');
        if (nav) {
            nav.style.width = '240px'; // Expand pill slightly to hold 3 buttons
            nav.insertAdjacentHTML('afterbegin', `<button class="btn btn-outline" style="color: var(--primary);" onclick="window.location.href='admin.html'" title="Admin Hub"><i class="fa-solid fa-shield-halved"></i></button>`);
        }
    }

    adjustLayoutPadding();
    loadDashboard(); 
}

// Helper to detect offstage competition accurately
function isCompOffstage(comp) {
    if (!comp) return false;
    if (comp.is_offstage) return true;
    if (comp.stages?.name && comp.stages.name.toUpperCase().includes('OFFSTAGE')) return true;
    if (comp.stage_id && window.stageOffstageFlags && window.stageOffstageFlags[comp.stage_id]) return true;
    return false;
}

// 2. Load Assigned Competitions (Global Grading Fix)
async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align: center; padding: 3rem 1rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem;"></i><p style="color: var(--text-muted); font-weight: 600;">Loading assignments...</p></div>`;
    adjustLayoutPadding();

    globalJudgeComps = []; // Reset global state

    if (user.role === 'master_admin' || user.role === 'admin') {
        
        let compQuery = supabaseClient
            .from('competitions')
            .select('*, categories(name), stages(id, name)')
            .in('status', ['registration', 'ongoing', 'valuation']);
            
        if (window.festosApplyFilter) {
            compQuery = window.festosApplyFilter(compQuery);
        }

        const { data: allComps, error } = await compQuery;
            
        if (error) {
            container.innerHTML = `<p style="color: #EF4444; text-align:center; font-weight: 600; padding: 2rem;">Failed to load competitions.</p>`;
            adjustLayoutPadding();
            return;
        }
        
        let gradedQuery = supabaseClient
            .from('judgements')
            .select('competition_id')
            .not('awarded_mark', 'is', null);
        if (window.festosApplyFilter) {
            gradedQuery = window.festosApplyFilter(gradedQuery);
        }

        const { data: gradedRecords } = await gradedQuery;

        const gradedIds = new Set(gradedRecords?.map(m => m.competition_id) || []);

        allComps.forEach(comp => {
            if (!gradedIds.has(comp.id)) globalJudgeComps.push(comp);
        });

    } else {
        let assignQuery = supabaseClient
            .from('judgements')
            .select(`
                competition_id, 
                competitions!inner(id, name, max_mark, status, is_offstage, stage_id, categories(name), stages(id, name))
            `)
            .eq('judge_id', user.id)
            .is('participant_id', null)
            .in('competitions.status', ['registration', 'ongoing', 'valuation']);
        if (window.festosApplyFilter) {
            assignQuery = window.festosApplyFilter(assignQuery);
        }
        const { data: assignments, error: assignError } = await assignQuery; // NEW: Added valuation

        if (assignError) {
            container.innerHTML = `<p style="color: #EF4444; text-align:center; font-weight: 600; padding: 2rem;">Failed to load assignments.</p>`;
            adjustLayoutPadding();
            return;
        }
        
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

    // Dynamic sorting: In Valuation first, then Ongoing, then Registration, then alphabetical
    globalJudgeComps.sort((a, b) => {
        const statusPriority = { 'valuation': 1, 'ongoing': 2, 'registration': 3, 'pending': 4 };
        const aPri = statusPriority[a.status] || 5;
        const bPri = statusPriority[b.status] || 5;
        if (aPri !== bPri) return aPri - bPri;
        return (a.name || '').localeCompare(b.name || '');
    });

    // Populate Category Dropdown Dynamically
    const catFilter = document.getElementById('judgeCategoryFilter');
    if (catFilter) {
        const currentSelected = catFilter.value;
        const uniqueCategories = [...new Set(globalJudgeComps.map(c => c.categories?.name || 'UNCATEGORIZED'))];
        catFilter.innerHTML = '<option value="">All Categories</option>';
        uniqueCategories.forEach(cat => {
            catFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        if (uniqueCategories.includes(currentSelected)) {
            catFilter.value = currentSelected;
        }
    }

    // Render the UI
    filterJudgeCompetitions();
}

// 2.1 Search and Filter Logic
function filterJudgeCompetitions() {
    const searchVal = document.getElementById('judgeSearch') ? document.getElementById('judgeSearch').value.toLowerCase().trim() : '';
    const catVal = document.getElementById('judgeCategoryFilter') ? document.getElementById('judgeCategoryFilter').value : '';

    // Update active filter indicator dot on header icon button
    const filterDot = document.getElementById('filter-badge-dot');
    if (filterDot) {
        const hasActiveFilter = !!searchVal || catVal !== "";
        filterDot.style.display = hasActiveFilter ? 'block' : 'none';
    }

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
            <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-clipboard-check" style="font-size: 2.5rem; color: #CBD5E1; margin-bottom: 0.75rem;"></i>
                <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 600;">No assignments pending.</p>
            </div>`;
        adjustLayoutPadding();
        return;
    }

    data.forEach(comp => {
        const offstage = isCompOffstage(comp);
        const isValuation = (comp.status === 'valuation');
        const isOngoing = (comp.status === 'ongoing');
        const isReg = (comp.status === 'registration');
        const isAdmin = (user.role === 'master_admin' || user.role === 'admin' || user.role === 'super_admin');

        // Evaluation readiness:
        // - Any competition in 'valuation' is ALWAYS ready to evaluate (for judges & master admin)
        // - Onstage ongoing competitions are ready to evaluate live
        // - Master Admin / Admin has full direct override access to evaluate ANY competition
        const isReady = isValuation || (!offstage && isOngoing) || isAdmin;
        
        let statusText = 'Starts Soon';
        let badgeColor = '#D97706';
        let badgeBg = 'var(--warning-light)';

        if (isValuation) {
            statusText = 'In Valuation';
            badgeColor = '#B45309';
            badgeBg = '#FEF3C7';
        } else if (isOngoing) {
            if (!offstage) {
                statusText = 'Live / Ongoing';
                badgeColor = 'var(--success)';
                badgeBg = 'var(--success-light)';
            } else {
                statusText = isAdmin ? 'Event Ongoing (Admin Access)' : 'Event Ongoing';
                badgeColor = isAdmin ? 'var(--primary)' : '#4F46E5';
                badgeBg = isAdmin ? 'var(--primary-light)' : '#EEF2FF';
            }
        } else if (isReg) {
            statusText = isAdmin ? 'In Registration (Admin Override)' : 'In Registration';
            badgeColor = isAdmin ? 'var(--primary)' : '#64748B';
            badgeBg = isAdmin ? 'var(--primary-light)' : '#F1F5F9';
        } else if (isAdmin) {
            statusText = 'Scheduled (Admin Access)';
            badgeColor = '#4F46E5';
            badgeBg = '#EEF2FF';
        }

        const btnState = isReady ? '' : 'disabled';
        const btnText = isReady ? 'Evaluate Now' : 'Waiting...';
        const categoryName = comp.categories?.name || 'UNCATEGORIZED';
        
        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.innerHTML = `
            <div class="comp-card-inner">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 0.5rem;">
                        <span style="font-size: 0.72rem; font-weight: 800; color: var(--primary); letter-spacing: 0.04em; background: #EEF2FF; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.15);">${categoryName}</span>
                        <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 0.25rem 0.6rem; border-radius: 6px;">
                            <span style="display: inline-block; width: 6px; height: 6px; background: ${badgeColor}; border-radius: 50%;"></span>
                            ${statusText}
                        </span>
                    </div>
                    <h3 style="margin-bottom: 0.25rem; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em; color: var(--text-main); line-height: 1.3;">${comp.name}</h3>
                    <p style="color: var(--text-muted); font-size: 0.82rem; font-weight: 600;">
                        MAX SCORE: <span style="color: var(--text-main); font-weight: 800;">${comp.max_mark}</span>
                        ${comp.stages?.name ? ` &bull; <span style="color: var(--text-muted); font-weight: 700;"><i class="fa-solid fa-microphone-lines" style="font-size: 0.75rem;"></i> ${comp.stages.name}</span>` : ''}
                    </p>
                </div>
                <button class="btn ${isReady ? 'btn-primary' : 'btn-outline'}" ${btnState} onclick="openEvaluation('${comp.id}')" style="margin-top: 0.75rem; width: 100%; min-height: 44px; font-size: 0.85rem; border-radius: 12px;">
                    ${isReady ? '<i class="fa-solid fa-pen-to-square"></i> ' : '<i class="fa-solid fa-clock"></i> '}${btnText}
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    setTimeout(adjustLayoutPadding, 50);
}

// 3. Open Evaluation Mode
async function openEvaluation(compId) {
    const comp = globalJudgeComps.find(c => c.id === compId);
    if (!comp) return;

    currentCompId = comp.id;
    currentMaxMark = comp.max_mark;

    const filterBtn = document.getElementById('filter-toggle-btn');
    if (filterBtn) filterBtn.style.display = 'none';
    const drawer = document.getElementById('filter-drawer');
    if (drawer) drawer.style.display = 'none';

    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('evaluation-view').style.display = 'block';
    document.getElementById('global-nav').style.display = 'none';
    document.getElementById('eval-comp-name').innerText = comp.name;
    document.getElementById('eval-max-mark').innerText = currentMaxMark;
    window.scrollTo(0, 0); // Reset scroll position
    adjustLayoutPadding();

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
                <i class="fa-solid fa-user-xmark" style="font-size: 2.5rem; color: #CBD5E1; margin-bottom: 0.75rem;"></i>
                <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 600;">No participants have been marked present yet.</p>
            </div>`;
        return;
    }

    registrations.forEach(reg => {
        const isGroupEvent = reg.competitions?.is_group;
        let roleBadge = '';
        if (isGroupEvent) {
            roleBadge = reg.is_leader 
                ? `<span style="background: var(--primary-light); color: var(--primary); font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Leader</span>`
                : `<span style="background: #E2E8F0; color: #475569; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Party</span>`;
        }

        container.innerHTML += `
            <div class="participant-row" data-pid="${reg.participant_id}">
                <div class="participant-main">
                    <div class="participant-info">
                        <div class="code-letter">
                            ${reg.code_letter || '?'}
                        </div>
                        <div class="participant-meta">
                            <span class="participant-label">Participant</span>
                            <span class="participant-code">${reg.code_letter ? 'Code ' + reg.code_letter : 'Unknown'}</span>
                            ${roleBadge ? `<div style="margin-top: 2px;">${roleBadge}</div>` : ''}
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
                <textarea class="feedback-input" rows="2" placeholder="ADD CONSTRUCTIVE FEEDBACK (OPTIONAL)..."></textarea>
            </div>
        `;
    });
    setTimeout(adjustLayoutPadding, 50);
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
        const feedbackInput = row.querySelector('.feedback-input').value.trim();
        
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
            awarded_mark: parseFloat(markInput),
            feedback: feedbackInput || null
        });
    });

    if (!isValid) {
        showToast("Please enter marks for all participants before submitting.", "error");
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

    const payload = window.festosWithFest ? window.festosWithFest(marksData) : marksData;
    const { error } = await supabaseClient
        .from('judgements')
        .upsert(payload, { onConflict: 'competition_id,judge_id,participant_id' });

    if (error) {
        showToast('Error submitting marks: ' + error.message, "error");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Final Marks';
    } else {
        try {
            // Check if all assigned judges have submitted marks for this competition
            const { data: allJudgeRecords } = await supabaseClient
                .from('judgements')
                .select('judge_id, awarded_mark, participant_id')
                .eq('competition_id', currentCompId);

            const assignedJudges = [...new Set((allJudgeRecords || []).filter(j => !!j.judge_id).map(j => String(j.judge_id)))];
            const marksRecords = (allJudgeRecords || []).filter(j => j.awarded_mark !== null && j.awarded_mark !== undefined && j.participant_id);

            const allJudgesDone = assignedJudges.length > 0 && assignedJudges.every(judgeId => {
                return Array.from(rows).every(row => {
                    const pId = row.getAttribute('data-pid');
                    return marksRecords.some(m => String(m.judge_id) === String(judgeId) && String(m.participant_id) === String(pId));
                });
            });

            if (allJudgesDone || assignedJudges.length <= 1) {
                await supabaseClient.from('competitions').update({ status: 'judgement_complete', updated_at: new Date().toISOString() }).eq('id', currentCompId);
                showToast('Marks submitted successfully! Valuation complete, sent to Manager.', "success");
            } else {
                showToast('Your marks have been submitted successfully! Waiting for remaining judges to complete valuation.', "success");
            }
        } catch(e) { console.warn(e); }
        closeEvaluation();
        loadDashboard(); 
    }
}

function closeEvaluation() {
    const filterBtn = document.getElementById('filter-toggle-btn');
    if (filterBtn) filterBtn.style.display = 'inline-flex';

    document.getElementById('evaluation-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('global-nav').style.display = 'flex';
    currentCompId = null;
    const btn = document.getElementById('submit-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Final Marks';
    window.scrollTo(0, 0);
    adjustLayoutPadding();
}

// --- MODAL & AUTH UTILITIES ---
function openConfirmModal(title, text, confirmCallback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.onclick = () => {
        closeConfirmModal();
        if (confirmCallback) confirmCallback();
    };
    
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function logout() {
    openConfirmModal("Sign Out", "Are you sure you want to securely log out of the judge portal?", () => {
        localStorage.removeItem('festUser');
        window.location.href = 'index.html';
    });
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
    fetchAndApplyBranding();
});

async function fetchAndApplyBranding() {
    try {
        const festId = window.festosAuth ? window.festosAuth.getCurrentFestId() : null;
        let val = window.festosGetSetting ? await window.festosGetSetting('system_branding', festId) : null;
        if (!val && festId && typeof supabaseClient !== 'undefined') {
            const { data: fData } = await supabaseClient.from('fests').select('name, logo').eq('id', festId).maybeSingle();
            if (fData && (fData.name || fData.logo)) {
                val = { fest_name: fData.name, fest_logo: fData.logo, display_mode: fData.logo ? 'both' : 'name' };
            }
        }
        if (val) applyGlobalBranding(val);
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    if (!brandingData) return;
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const rawLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '' ? brandingData.fest_logo.trim() : '';
    const validLogo = rawLogo !== '' && rawLogo !== 'festos-logo.svg' && rawLogo !== '/festos-logo.svg';
    const displayMode = brandingData.display_mode || 'both'; // 'both', 'logo', 'name'
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'Festival';
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
        
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 32px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '10px' : '0'}; display: inline-block; vertical-align: middle;">`;
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
