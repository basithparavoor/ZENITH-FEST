const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
if (typeof window !== 'undefined') window.supabaseClient = supabaseClient;

let html5QrCode = null;
let currentPresentCount = 0; 
let activeScanCompId = null; 
let user = null;
let isProcessingScan = false;

// UI Utilities
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.style.borderLeftColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--warning)';
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 1.25rem;"></i>' 
               : type === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color: var(--danger); font-size: 1.25rem;"></i>'
               : '<i class="fa-solid fa-triangle-exclamation" style="color: var(--warning); font-size: 1.25rem;"></i>';
               
    toast.innerHTML = `${icon} <span style="font-weight: 600; font-size: 0.95rem;">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function initializeApp() {
    user = JSON.parse(localStorage.getItem('festUser'));
    if (!user || (user.role !== 'stage_controller' && user.role !== 'master_admin' && user.role !== 'admin')) {
        if (user && user.role === 'announcer') {
            window.location.replace('announcements.html');
            return;
        }
        window.location.href = 'index.html';
        return;
    }
    
    if (user.role === 'master_admin' || user.role === 'admin') {
        const navActions = document.querySelector('.nav-actions');
        if (navActions) {
            // Added as an icon button to match the rest of the floating pill dock
            navActions.insertAdjacentHTML('afterbegin', `<button class="btn btn-outline" onclick="window.location.href='admin.html'" style="color: var(--primary);"><i class="fa-solid fa-shield-halved"></i></button>`);
        }
    }
    
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${user.username}`;
    }
    
    loadDashboard();
}

// --- TIME PARSING UTILITIES ---
function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(mins)) return 0;
    return hours * 60 + mins;
}
window.timeStringToMinutes = timeStringToMinutes;

function minutesToTimeString(minutes) {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return '';
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
window.minutesToTimeString = minutesToTimeString;

function checkIsCompOffstage(comp) {
    if (!comp) return false;
    if (comp.is_offstage) return true;
    const sId = comp.stage_id || comp.stages?.id;
    if (sId && window.stageOffstageFlags && window.stageOffstageFlags[sId] !== undefined) {
        return !!window.stageOffstageFlags[sId];
    }
    if (comp.stages?.name && comp.stages.name.toUpperCase().includes('OFFSTAGE')) {
        return true;
    }
    return false;
}
window.checkIsCompOffstage = checkIsCompOffstage;

async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align:center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top: 1rem; color: var(--text-muted); font-weight: 600;">Loading Stage Data...</p></div>`;

    // Fetch all stages for this festival
    let stagesQuery = supabaseClient.from('stages').select('id, name, stage_no, controller_id').order('stage_no');
    if (window.festosApplyFilter) stagesQuery = window.festosApplyFilter(stagesQuery);
    const { data: stages } = await stagesQuery;
    window.allStagesList = stages || [];

    const filterContainer = document.getElementById('master-filter-container');
    const filterDropdown = document.getElementById('master-stage-filter');
    const prevSelectedStage = filterDropdown ? filterDropdown.value : null;

    if (user.role === 'master_admin' || user.role === 'admin' || user.role === 'super_admin') {
        document.getElementById('stage-name').innerText = "Admin Override (All Venues)";
        if (filterContainer) filterContainer.style.display = 'block';
        
        let filterHtml = '<option value="ALL">-- ALL STAGES (MASTER VIEW) --</option>';
        if (stages && stages.length > 0) {
            stages.forEach(s => {
                filterHtml += `<option value="${s.id}">${s.name}</option>`;
            });
        }
        filterHtml += '<option value="UNASSIGNED">-- UNASSIGNED VENUES / STAGES --</option>';
        if (filterDropdown) filterDropdown.innerHTML = filterHtml;

        const targetStage = prevSelectedStage && (prevSelectedStage === 'ALL' || prevSelectedStage === 'UNASSIGNED' || (stages && stages.some(s => s.id === prevSelectedStage)))
            ? prevSelectedStage 
            : 'ALL';
            
        if (filterDropdown) filterDropdown.value = targetStage;
        loadCompetitions(targetStage);
        return;
    }

    // Role is stage_controller: find any stages assigned to this controller
    const myStages = (stages || []).filter(s => s.controller_id === user.id);

    if (filterContainer) filterContainer.style.display = 'block';

    let filterHtml = '';
    if (myStages.length > 1) {
        filterHtml += `<option value="MY_STAGES">-- ALL MY ASSIGNED STAGES (${myStages.length}) --</option>`;
    }
    
    if (myStages.length > 0) {
        myStages.forEach(s => {
            filterHtml += `<option value="${s.id}">${s.name}</option>`;
        });
        filterHtml += '<option disabled>──────────</option>';
    }

    filterHtml += '<option value="ALL">-- ALL FESTIVAL STAGES --</option>';
    
    // List any other stages
    const otherStages = (stages || []).filter(s => !myStages.some(ms => ms.id === s.id));
    otherStages.forEach(s => {
        filterHtml += `<option value="${s.id}">${s.name}</option>`;
    });
    filterHtml += '<option value="UNASSIGNED">-- UNASSIGNED VENUES / STAGES --</option>';

    if (filterDropdown) filterDropdown.innerHTML = filterHtml;

    let targetStage = 'ALL';
    if (prevSelectedStage && (prevSelectedStage === 'ALL' || prevSelectedStage === 'MY_STAGES' || prevSelectedStage === 'UNASSIGNED' || (stages && stages.some(s => s.id === prevSelectedStage)))) {
        targetStage = prevSelectedStage;
    } else if (myStages.length === 1) {
        targetStage = myStages[0].id;
    } else if (myStages.length > 1) {
        targetStage = 'MY_STAGES';
    } else if (stages && stages.length > 0) {
        targetStage = stages[0].id;
    }

    if (filterDropdown) filterDropdown.value = targetStage;
    loadCompetitions(targetStage);
}

function adjustLayoutPadding() {
    const navbar = document.querySelector('.navbar > div:first-child');
    if (navbar) {
        document.body.style.paddingTop = `${navbar.offsetHeight + 15}px`;
    }
}
window.addEventListener('resize', adjustLayoutPadding);

async function loadCompetitions(stageId) {
    // Update stage name display to match active dropdown selection
    const filterDropdown = document.getElementById('master-stage-filter');
    if (filterDropdown && window.allStagesList) {
        const selectedStage = window.allStagesList.find(s => s.id === stageId);
        if (selectedStage) {
            document.getElementById('stage-name').innerText = selectedStage.name;
        } else if (stageId === 'ALL') {
            document.getElementById('stage-name').innerText = "All Festival Stages";
        } else if (stageId === 'UNASSIGNED') {
            document.getElementById('stage-name').innerText = "Unassigned Venues / Stages";
        } else if (stageId === 'MY_STAGES') {
            document.getElementById('stage-name').innerText = "My Assigned Stages";
        }
    }

    let query = supabaseClient.from('competitions')
        .select('*, categories(name), stages(id, name, stage_no), judgements(judge_id, awarded_mark, users(username)), participant_competitions(participant_id)');

    if (window.festosApplyFilter) {
        query = window.festosApplyFilter(query);
    }

    if (stageId === 'UNASSIGNED') {
        query = query.is('stage_id', null);
    } else if (stageId === 'MY_STAGES') {
        const myStageIds = (window.allStagesList || []).filter(s => s.controller_id === user.id).map(s => s.id);
        if (myStageIds.length > 0) {
            query = query.in('stage_id', myStageIds);
        }
    } else if (stageId && stageId !== 'ALL') {
        query = query.eq('stage_id', stageId);
    }
    
    const [compsRes, stageFlagsVal, pointVal] = await Promise.all([
        query,
        window.festosGetSetting ? window.festosGetSetting('stage_offstage_flags') : (supabaseClient.from('settings').select('value').eq('id', 'stage_offstage_flags').maybeSingle().then(r => r.data?.value)),
        window.festosGetSetting ? window.festosGetSetting('point_system') : (supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle().then(r => r.data?.value))
    ]);

    const competitionsData = compsRes.data;
    const error = compsRes.error;
    window.stageOffstageFlags = stageFlagsVal || {};
    window.allLoadedCompetitions = competitionsData || [];
    
    // Fetch Master Schedule
    const schedVal = window.festosGetSetting ? await window.festosGetSetting('master_schedule') : null;
    const masterSchedule = schedVal || {};
    window.masterSchedule = masterSchedule;

    const announcerOffset = pointVal?.announcer_offset !== undefined ? parseInt(pointVal.announcer_offset) : 30;
    const registrationOffset = pointVal?.registration_offset !== undefined ? parseInt(pointVal.registration_offset) : 15;
    const strictStartTime = pointVal?.strict_start_time !== undefined ? (pointVal.strict_start_time === true || pointVal.strict_start_time === 'true') : true;

    window.stageControllerSettings = {
        announcerOffset,
        registrationOffset,
        strictStartTime
    };

    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    if (error || !competitionsData || competitionsData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-clipboard-check" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.05rem; font-weight: 600;">No competitions assigned to this selection yet.</p>
            </div>`;
        adjustLayoutPadding(); 
        return;
    }

    const now = new Date();

    // Retain all pending, registration, ongoing, valuation, and judgement_complete competitions!
    // Filter out only 'published' events (final published results where event has ended)
    const visibleComps = competitionsData.filter(comp => {
        if (comp.status === 'published') return false; 
        // For offstage competitions marked as end (in valuation), do not show them in stage controller
        if (comp.status === 'valuation' && checkIsCompOffstage(comp)) return false;

        // Pending competitions must be scheduled before appearing in the stage controller
        if (comp.status === 'pending') {
            const sched = masterSchedule[comp.id];
            // If competition is not scheduled (missing date/time or marked as draft), do not show until scheduled
            if (!sched || !sched.date || !sched.time || sched.status === 'draft') {
                return false;
            }

            const schedDate = new Date(`${sched.date}T${sched.time}`);
            if (isNaN(schedDate)) {
                return false;
            }

            const diffMins = (schedDate - now) / 60000;
            if (diffMins > announcerOffset) {
                return false;
            }
        }

        return true;
    });

    // Intelligent Sorting:
    // 1. Live Active events first: ongoing -> registration -> valuation
    // 2. Upcoming pending events (chronologically by schedule date/time, then name)
    // 3. Completed judging events (judgement_complete)
    const statusPriority = {
        'ongoing': 1,
        'registration': 2,
        'valuation': 3,
        'pending': 4,
        'judgement_complete': 5
    };

    visibleComps.sort((a, b) => {
        const priorityA = statusPriority[a.status] || 99;
        const priorityB = statusPriority[b.status] || 99;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        const schedA = masterSchedule[a.id];
        const schedB = masterSchedule[b.id];
        const timeA = schedA && schedA.date && schedA.time ? new Date(`${schedA.date}T${schedA.time}`).getTime() : Infinity;
        const timeB = schedB && schedB.date && schedB.time ? new Date(`${schedB.date}T${schedB.time}`).getTime() : Infinity;
        if (timeA !== timeB) {
            return timeA - timeB;
        }

        return (a.name || '').localeCompare(b.name || '');
    });

    if (visibleComps.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-calendar-check" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.05rem; font-weight: 600;">No active or upcoming events found for this selection.</p>
            </div>`;
        adjustLayoutPadding(); 
        return;
    }

    const uniqueCategories = [...new Set(visibleComps.map(c => c.categories?.name || 'Uncategorized'))].sort();
    const catDropdown = document.getElementById('category-filter');
    if (catDropdown) {
        const currentSelection = catDropdown.value; 
        
        catDropdown.innerHTML = '<option value="ALL">All Categories</option>';
        uniqueCategories.forEach(cat => {
            catDropdown.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        if (uniqueCategories.includes(currentSelection)) {
            catDropdown.value = currentSelection;
        }
    }

    // Render the chronological list
    visibleComps.forEach(comp => {
        let badgeClass = 'badge-pending';
        let statusText = 'UPCOMING'; 
        let statusIcon = '<i class="fa-regular fa-clock"></i>';
        
        if (comp.status === 'registration') { badgeClass = 'badge-registration'; statusText = 'REGISTRATION'; statusIcon = '<i class="fa-solid fa-qrcode"></i>';}
        if (comp.status === 'ongoing') { badgeClass = 'badge-ongoing'; statusText = 'ONGOING'; statusIcon = '<i class="fa-solid fa-circle-play"></i>';}
        if (comp.status === 'valuation') { badgeClass = 'badge-pending'; statusText = 'IN VALUATION'; statusIcon = '<i class="fa-solid fa-pen-clip"></i>';}
        if (comp.status === 'judgement_complete') { badgeClass = 'badge-complete'; statusText = 'AWAITING RESULTS'; statusIcon = '<i class="fa-solid fa-flag-checkered"></i>';}

        const enrolledCount = comp.participant_competitions ? comp.participant_competitions.length : 0;
        const categoryName = comp.categories?.name || 'Uncategorized';
        
        // Extract Judges
        const uniqueJudges = [...new Set((comp.judgements || []).map(j => j.users?.username).filter(Boolean))];
        const judgesStr = uniqueJudges.length > 0 ? uniqueJudges.join(', ') : 'AWAITING';

        // Extract Schedule
        let schedBadge = '';
        const sched = masterSchedule[comp.id];
        comp.schedule = sched;
        if (sched) {
            const timeObj = new Date(`${sched.date}T${sched.time}`);
            const timeStr = isNaN(timeObj) ? sched.time : timeObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            schedBadge = `<span style="display: inline-flex; align-items: center; gap: 0.3rem;"><i class="fa-regular fa-clock" style="color: var(--primary);"></i> Sched: <strong style="color: var(--text-main);">${sched.date} @ ${timeStr}</strong></span>`;
            if (sched.delay_offset_minutes || (sched.baseline_time && sched.baseline_time !== sched.time)) {
                const offMins = Number(sched.delay_offset_minutes) || 0;
                const sign = offMins > 0 ? `+${offMins}m` : `${offMins}m`;
                schedBadge += ` <span style="background:#FEF3C7; color:#B45309; border:1px solid #FDE68A; font-size:0.65rem; font-weight:800; padding:1px 5px; border-radius:4px; margin-left:2px;" title="Original schedule: ${sched.baseline_time || ''}"><i class="fa-solid fa-clock-rotate-left"></i> ${sign}</span>`;
            }
        }

        const stageBadge = comp.stages?.name 
            ? `<span style="color: #6366F1; font-size: 0.7rem; font-weight: 800; background: #EEF2FF; padding: 0.2rem 0.5rem; border-radius: 6px;"><i class="fa-solid fa-location-dot"></i> ${comp.stages.name}</span>`
            : `<span style="color: var(--text-muted); font-size: 0.7rem; font-weight: 700; background: var(--bg-main); padding: 0.2rem 0.5rem; border-radius: 6px;"><i class="fa-solid fa-location-dot"></i> Unassigned</span>`;

        const isDrawerOpen = window.expandedDrawers && window.expandedDrawers.has(comp.id);
        const drawerDisplay = isDrawerOpen ? 'block' : 'none';
        const chevronClass = isDrawerOpen ? 'toggle-chevron rotated' : 'toggle-chevron';

        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.setAttribute('data-comp-name', (comp.name || '').toLowerCase()); 
        card.setAttribute('data-category', categoryName); 
        card.setAttribute('data-status', comp.status); 
        
        card.innerHTML = `
            <div class="card-header">
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 0.5rem;">
                        <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                            <span style="color: var(--primary); font-size: 0.7rem; font-weight: 800; background: var(--primary-light); padding: 0.2rem 0.5rem; border-radius: 6px;">
                                ${categoryName}
                            </span>
                            ${stageBadge}
                        </div>
                        <span class="badge ${badgeClass}" style="white-space: nowrap; font-size: 0.7rem; padding: 0.2rem 0.55rem;">${statusIcon} ${statusText}</span>
                    </div>
                    
                    <h2 class="card-title">${comp.name}</h2>
                    
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem 0.9rem; color: var(--text-muted); font-size: 0.78rem; font-weight: 600;">
                        ${schedBadge}
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                            <i class="fa-solid fa-users" style="color: var(--primary);"></i> Enrolled: <strong style="color: var(--text-main);">${enrolledCount}</strong>
                        </span>
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                            <i class="fa-solid fa-gavel" style="color: var(--primary);"></i> Judges: <strong style="color: var(--text-main);">${judgesStr}</strong>
                        </span>
                    </div>
                </div>
            </div>
            
            ${(() => {
                if (sched && sched.date && (sched.to_time || sched.time) && (comp.status === 'ongoing' || comp.status === 'registration')) {
                    const startM = timeStringToMinutes(sched.time);
                    let endM = sched.to_time ? timeStringToMinutes(sched.to_time) : (startM + (parseInt(sched.manual_time) || 30));
                    if (endM <= startM) endM = startM + 30;
                    const endH = Math.floor(endM / 60);
                    const endMin = endM % 60;
                    const endDateTime = new Date(`${sched.date}T${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`);
                    if (!isNaN(endDateTime.getTime()) && Date.now() > endDateTime.getTime()) {
                        return `
                            <div style="background: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; padding: 6px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                <span><i class="fa-solid fa-clock-rotate-left"></i> Scheduled slot ended (${sched.to_time || minutesToTimeString(endM)}). Complete or End Event when stage is finished.</span>
                            </div>
                        `;
                    }
                }
                return '';
            })()}
            <div id="controls-${comp.id}">
                ${getButtonsForStatus(comp)}
            </div>

            <div class="card-list-section" ${comp.status === 'pending' ? 'style="display:none;"' : ''}>
                <button type="button" class="participant-toggle-btn" onclick="toggleParticipantSection('${comp.id}')">
                    <div class="toggle-btn-left">
                        <i class="fa-solid fa-clipboard-user"></i>
                        <span>Participants</span>
                        <span id="badge-count-${comp.id}" class="badge-count">Checking...</span>
                    </div>
                    <i class="fa-solid fa-chevron-down ${chevronClass}" id="chevron-${comp.id}"></i>
                </button>
                <div id="drawer-${comp.id}" class="participant-drawer" style="display: ${drawerDisplay};">
                    <div class="participant-scroll-box" id="list-${comp.id}">
                        <p style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500; margin: 0.25rem 0;">Loading participants...</p>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
        
        if (comp.status !== 'pending') {
            loadCheckedInList(comp.id);
        }
    });
    
    setTimeout(adjustLayoutPadding, 50); 
    filterCompetitions();
}

function switchToActiveFilter() {
    const statusDropdown = document.getElementById('status-filter');
    if (statusDropdown) statusDropdown.value = 'ACTIVE';
    filterCompetitions();
}
window.switchToActiveFilter = switchToActiveFilter;

function switchToCompletedFilter() {
    const statusDropdown = document.getElementById('status-filter');
    if (statusDropdown) statusDropdown.value = 'judgement_complete';
    filterCompetitions();
}
window.switchToCompletedFilter = switchToCompletedFilter;

function filterCompetitions() {
    const searchInput = document.getElementById('comp-search');
    const categoryDropdown = document.getElementById('category-filter');
    const statusDropdown = document.getElementById('status-filter');
    
    if (!searchInput) return;
    
    const textFilter = (searchInput.value || '').trim().toLowerCase();
    const catFilter = categoryDropdown ? categoryDropdown.value : 'ALL';
    const statusFilter = statusDropdown ? statusDropdown.value : 'ACTIVE';
    
    const cards = document.querySelectorAll('.comp-card');
    let visibleCount = 0;
    let totalCompleted = 0;
    
    cards.forEach(card => {
        const compName = card.getAttribute('data-comp-name') || '';
        const compCat = card.getAttribute('data-category') || '';
        const compStatus = card.getAttribute('data-status') || '';
        
        if (compStatus === 'judgement_complete') {
            totalCompleted++;
        }

        const matchesText = !textFilter || compName.includes(textFilter);
        const matchesCategory = (catFilter === 'ALL' || compCat === catFilter);
        
        // Status Filter Logic:
        // 'ACTIVE': Auto-hide completed events (judgement_complete) so only ongoing, reg, pending, valuation appear
        // 'ALL': Show everything
        // 'judgement_complete': Show only completed events awaiting manager
        // 'pending': Matches pending or valuation
        // Specific status: Exact match
        let matchesStatus = false;
        if (statusFilter === 'ACTIVE') {
            matchesStatus = (compStatus !== 'judgement_complete');
        } else if (statusFilter === 'ALL') {
            matchesStatus = true;
        } else if (statusFilter === 'pending') {
            matchesStatus = (compStatus === 'pending' || compStatus === 'valuation');
        } else {
            matchesStatus = (compStatus === statusFilter);
        }
        
        if (matchesText && matchesCategory && matchesStatus) {
            card.style.display = 'block'; 
            visibleCount++;
        } else {
            card.style.display = 'none'; 
        }
    });

    // Update active filter indicator dot on header icon button
    const filterDot = document.getElementById('filter-badge-dot');
    if (filterDot) {
        const hasActiveFilter = !!textFilter || catFilter !== 'ALL' || statusFilter !== 'ACTIVE';
        filterDot.style.display = hasActiveFilter ? 'block' : 'none';
    }

    // Notice banner handling
    const noticeBar = document.getElementById('completed-notice-bar');
    const noticeText = document.getElementById('completed-notice-text');
    const returnBar = document.getElementById('active-return-bar');

    if (noticeBar && noticeText) {
        if (statusFilter === 'ACTIVE' && totalCompleted > 0) {
            noticeText.innerText = `${totalCompleted} event${totalCompleted > 1 ? 's' : ''} completed & sent to Manager`;
            noticeBar.style.display = 'flex';
        } else {
            noticeBar.style.display = 'none';
        }
    }

    if (returnBar) {
        returnBar.style.display = (statusFilter === 'judgement_complete') ? 'flex' : 'none';
    }

    // Empty state container handling
    let emptyEl = document.getElementById('stage-empty-placeholder');
    if (visibleCount === 0 && cards.length > 0) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.id = 'stage-empty-placeholder';
            const cont = document.getElementById('competitions-container');
            if (cont) cont.appendChild(emptyEl);
        }
        if (emptyEl) {
            emptyEl.style.display = 'block';
            if (statusFilter === 'ACTIVE' && totalCompleted > 0) {
                emptyEl.innerHTML = `
                    <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border); margin-top: 1rem;">
                        <i class="fa-solid fa-flag-checkered" style="font-size: 2.5rem; color: #7C3AED; margin-bottom: 0.75rem;"></i>
                        <h3 style="color: var(--text-main); font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem;">All Active Events Concluded</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 420px; margin: 0 auto 1.25rem;">Events on this stage have finished judging and are waiting for Manager to publish.</p>
                        <button type="button" class="btn btn-primary" onclick="switchToCompletedFilter()" style="background: #7C3AED; border-color: #7C3AED;">
                            <i class="fa-solid fa-clock-rotate-left"></i> View Completed Events (${totalCompleted})
                        </button>
                    </div>
                `;
            } else {
                emptyEl.innerHTML = `
                    <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border); margin-top: 1rem;">
                        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: #CBD5E1; margin-bottom: 0.75rem;"></i>
                        <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 600;">No competitions match your current filter.</p>
                    </div>
                `;
            }
        }
    } else if (emptyEl) {
        emptyEl.style.display = 'none';
    }
    
    adjustLayoutPadding();
}

function toggleFilterDrawer() {
    const drawer = document.getElementById('filter-drawer');
    const btn = document.getElementById('filter-toggle-btn');
    if (!drawer) return;
    const isHidden = window.getComputedStyle(drawer).display === 'none';
    if (isHidden) {
        drawer.style.display = 'block';
        if (btn) btn.classList.add('active');
        const searchInput = document.getElementById('comp-search');
        if (searchInput) searchInput.focus();
    } else {
        drawer.style.display = 'none';
        if (btn) btn.classList.remove('active');
    }
}
window.toggleFilterDrawer = toggleFilterDrawer;

window.expandedDrawers = window.expandedDrawers || new Set();

function toggleParticipantSection(compId) {
    const drawer = document.getElementById(`drawer-${compId}`);
    const chevron = document.getElementById(`chevron-${compId}`);
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none';
    if (isHidden) {
        drawer.style.display = 'block';
        if (chevron) chevron.classList.add('rotated');
        window.expandedDrawers.add(compId);
    } else {
        drawer.style.display = 'none';
        if (chevron) chevron.classList.remove('rotated');
        window.expandedDrawers.delete(compId);
    }
}
window.toggleParticipantSection = toggleParticipantSection;

function getButtonsForStatus(comp) {
    const safeName = comp.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const isOff = checkIsCompOffstage(comp);
    const sched = comp.schedule || (window.masterSchedule ? window.masterSchedule[comp.id] : null);
    const regOffset = window.stageControllerSettings?.registrationOffset !== undefined ? window.stageControllerSettings.registrationOffset : 15;
    const strictStart = window.stageControllerSettings?.strictStartTime !== undefined ? window.stageControllerSettings.strictStartTime : true;

    if (comp.status === 'pending') {
        if (sched && sched.date && sched.time) {
            const schedDate = new Date(`${sched.date}T${sched.time}`);
            if (!isNaN(schedDate)) {
                const diffMins = (schedDate - new Date()) / 60000;
                if (diffMins > regOffset) {
                    const minsUntilReg = Math.ceil(diffMins - regOffset);
                    return `
                        <div>
                            <button class="btn btn-outline btn-full" style="border-color: #CBD5E1; color: var(--text-muted); background: #F8FAFC;" onclick="alertRegistrationEarly('${comp.id}', ${minsUntilReg}, '${sched.time}', ${regOffset})">
                                <i class="fa-solid fa-clock"></i> REGISTRATION OPENS IN ${minsUntilReg}m
                            </button>
                        </div>
                    `;
                }
            }
        }
        return `
            <div>
                <button class="btn btn-primary btn-full" onclick="changeCompetitionState('${comp.id}', 'registration', this, 'STARTING')"><i class="fa-solid fa-qrcode"></i> START REGISTRATION</button>
            </div>
        `;
    }
    
    if (comp.status === 'registration') {
        let isStartLocked = false;
        let minsUntilStart = 0;
        let schedStartTimeStr = '';

        if (strictStart && sched && sched.date && sched.time) {
            const schedDate = new Date(`${sched.date}T${sched.time}`);
            if (!isNaN(schedDate)) {
                const diffMins = (schedDate - new Date()) / 60000;
                if (diffMins > 0) {
                    isStartLocked = true;
                    minsUntilStart = Math.ceil(diffMins);
                    schedStartTimeStr = sched.time;
                }
            }
        }

        const startEventBtn = isStartLocked
            ? `<button class="btn btn-outline" style="border-color: #CBD5E1; color: var(--text-muted); background: #F8FAFC;" onclick="alertStartBeforeSchedule('${comp.id}', ${minsUntilStart}, '${schedStartTimeStr}')" title="Scheduled to start at ${schedStartTimeStr}"><i class="fa-solid fa-hourglass-half"></i> STARTS AT ${schedStartTimeStr} (${minsUntilStart}m)</button>`
            : `<button class="btn btn-success" onclick="changeCompetitionState('${comp.id}', 'ongoing', this, 'STARTING')"><i class="fa-solid fa-play"></i> START EVENT</button>`;

        return `
            <div>
                <button class="btn btn-outline btn-full" style="color: var(--primary); border-color: var(--primary); margin-bottom: 0.25rem !important;" onclick="openScannerModal('${comp.id}', '${safeName}')" title="SCAN QR"><i class="fa-solid fa-expand"></i> SCAN QR</button>
                <button class="btn btn-danger" onclick="cancelRegistration('${comp.id}', this)"><i class="fa-solid fa-xmark"></i> CANCEL</button>
                ${startEventBtn}
            </div>
        `;
    }
    
    if (comp.status === 'ongoing') {
        if (isOff) {
            return `
                <div>
                    <button class="btn btn-outline btn-full" onclick="backToRegistration('${comp.id}', this)" style="margin-bottom: 0.25rem !important;"><i class="fa-solid fa-arrow-rotate-left"></i> REVERT TO REGISTRATION</button>
                    <button class="btn btn-warning btn-full" onclick="changeCompetitionState('${comp.id}', 'valuation', this, 'ENDING')"><i class="fa-solid fa-flag-checkered"></i> END EVENT (SEND TO VALUATION)</button>
                </div>
            `;
        } else {
            const hasMarks = comp.judgements && comp.judgements.some(j => j.awarded_mark !== null);
            const endBtn = hasMarks 
                ? `<button class="btn btn-warning" onclick="changeCompetitionState('${comp.id}', 'judgement_complete', this, 'ENDING')"><i class="fa-solid fa-flag-checkered"></i> END EVENT</button>`
                : `<button class="btn btn-outline" style="opacity: 0.6; pointer-events: none;" disabled><i class="fa-solid fa-hourglass-half"></i> AWAITING JUDGE MARKS...</button>`;

            return `
                <div>
                    <button class="btn btn-outline" onclick="backToRegistration('${comp.id}', this)"><i class="fa-solid fa-arrow-rotate-left"></i> REVERT</button>
                    ${endBtn}
                </div>
            `;
        }
    }
    
    if (comp.status === 'valuation') {
        const hasMarks = comp.judgements && comp.judgements.some(j => j.awarded_mark !== null);
        const endBtn = hasMarks 
            ? `<button class="btn btn-success" onclick="changeCompetitionState('${comp.id}', 'judgement_complete', this, 'SUBMITTING')"><i class="fa-solid fa-check-double"></i> PUSH TO MANAGER</button>`
            : `<button class="btn btn-outline" style="opacity: 0.6; pointer-events: none;" disabled><i class="fa-solid fa-hourglass-half"></i> AWAITING JUDGE MARKS</button>`;
        return `
            <div>
                <button class="btn btn-outline" onclick="changeCompetitionState('${comp.id}', 'ongoing', this, 'REVERTING')"><i class="fa-solid fa-arrow-rotate-left"></i> REVERT</button>
                ${endBtn}
            </div>
        `;
    }
    
    return `
        <div style="color: var(--primary); font-size: 0.95rem; font-weight: 700; width: 100%; text-align: center; background: var(--primary-light); padding: 1.25rem; border-radius: 16px; border: 1px dashed rgba(79, 70, 229, 0.3);">
            <div style="margin-bottom: 0.35rem;"><i class="fa-solid fa-flag-checkered" style="margin-right: 6px;"></i> EVENT COMPLETED. WAITING FOR MANAGER.</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Judging marks recorded. Results are in manager queue for publishing.</div>
        </div>
    `;
}

async function stopCameraTracks() {
    if (html5QrCode) {
        try {
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }
        } catch (e) {
            console.warn("Error stopping scanner:", e);
        }
        try {
            await html5QrCode.clear();
        } catch (e) {}
        html5QrCode = null;
    }

    // Forcibly stop any lingering video tracks on the page to prevent camera lock
    try {
        const videoEls = document.querySelectorAll('#global-reader video');
        videoEls.forEach(v => {
            if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
                v.srcObject.getTracks().forEach(track => track.stop());
                v.srcObject = null;
            }
        });
    } catch (e) {}
}

async function openScannerModal(compId, compName) {
    activeScanCompId = compId;
    isProcessingScan = false;
    document.getElementById('modal-comp-name').innerText = `Scanning: ${compName}`;
    document.getElementById('scanner-modal').style.display = 'flex';

    await startQrScanner();
}

async function startQrScanner() {
    const readerEl = document.getElementById('global-reader');
    if (!readerEl) return;
    readerEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:var(--text-muted);">
            <i class="fa-solid fa-camera fa-spin" style="font-size:2rem; color:var(--primary); margin-bottom:0.75rem;"></i>
            <span style="font-size:0.9rem; font-weight:600;">Starting Camera...</span>
        </div>
    `;

    await stopCameraTracks();

    try {
        html5QrCode = new Html5Qrcode("global-reader", { 
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            verbose: false 
        });

        const scanConfig = {
            fps: 20,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.max(180, Math.floor(minEdge * 0.75));
                return { width: qrboxSize, height: qrboxSize };
            }
        };

        // Try environment (back) camera first
        await html5QrCode.start(
            { facingMode: "environment" },
            scanConfig,
            onScanSuccess,
            onScanFailure
        );
    } catch (err) {
        console.warn("Direct back-camera failed, attempting general fallback:", err);
        try {
            // Fallback attempt: query available cameras directly
            const devices = await Html5Qrcode.getCameras().catch(() => []);
            if (devices && devices.length > 0) {
                const backCam = devices.find(d => 
                    (d.label || '').toLowerCase().includes('back') || 
                    (d.label || '').toLowerCase().includes('rear') ||
                    (d.label || '').toLowerCase().includes('environment')
                );
                const camId = backCam ? backCam.id : devices[0].id;
                await html5QrCode.start(camId, { fps: 20 }, onScanSuccess, onScanFailure);
                return;
            }
            throw err;
        } catch (fallbackErr) {
            console.error("Camera start failed entirely:", fallbackErr);
            handleCameraError(fallbackErr);
        }
    }
}

function handleCameraError(err) {
    const readerEl = document.getElementById('global-reader');
    if (!readerEl) return;

    const errStr = (err ? (err.message || err.toString()) : '').toLowerCase();

    if (errStr.includes('notreadableerror') || errStr.includes('could not start video source') || errStr.includes('hardware error')) {
        readerEl.innerHTML = `
            <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-main);">
                <div style="font-size: 2.2rem; color: var(--danger); margin-bottom: 0.6rem;">
                    <i class="fa-solid fa-camera-slash"></i>
                </div>
                <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--danger);">Camera Hardware Unavailable</h3>
                <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; text-align: left; background: var(--bg-main); padding: 0.75rem; border-radius: 10px; margin-bottom: 1rem; border: 1px solid var(--border);">
                    <p style="margin: 0 0 0.35rem 0;"><strong>Common causes for this phone error:</strong></p>
                    <p style="margin: 0 0 0.25rem 0;">🔋 <strong>Low Battery / Saver (3%):</strong> Android restricts camera access when battery drops below 5% to prevent sudden power shutdown.</p>
                    <p style="margin: 0 0 0.25rem 0;">📱 <strong>Camera In Use:</strong> Another app (WhatsApp, native Camera, Instagram) or another tab has locked the camera.</p>
                    <p style="margin: 0;">🔒 <strong>Stuck Sensor:</strong> The camera subsystem needs a quick refresh.</p>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: center;">
                    <button class="btn btn-primary" style="max-width: 170px;" onclick="startQrScanner()">
                        <i class="fa-solid fa-rotate-right"></i> Try Again
                    </button>
                    <button class="btn btn-outline" style="max-width: 120px;" onclick="closeScannerModal()">
                        Close
                    </button>
                </div>
            </div>
        `;
    } else if (errStr.includes('notallowederror') || errStr.includes('permission denied')) {
        readerEl.innerHTML = `
            <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-main);">
                <div style="font-size: 2.2rem; color: var(--warning); margin-bottom: 0.6rem;">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem;">Camera Permission Blocked</h3>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1rem;">
                    Please tap the lock icon in your browser address bar and enable <strong>Camera</strong> permissions.
                </p>
                <button class="btn btn-primary" style="max-width: 180px; margin: 0 auto;" onclick="startQrScanner()">
                    <i class="fa-solid fa-rotate-right"></i> Request Again
                </button>
            </div>
        `;
    } else {
        readerEl.innerHTML = `
            <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-main);">
                <div style="font-size: 2.2rem; color: var(--danger); margin-bottom: 0.6rem;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--danger);">Camera Error</h3>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1rem;">${err ? (err.message || err) : 'Unknown camera error'}</p>
                <button class="btn btn-primary" style="max-width: 180px; margin: 0 auto;" onclick="startQrScanner()">
                    <i class="fa-solid fa-rotate-right"></i> Retry
                </button>
            </div>
        `;
    }
}

async function closeScannerModal() {
    await stopCameraTracks();
    document.getElementById('scanner-modal').style.display = 'none';
    activeScanCompId = null;
    isProcessingScan = false;
    loadDashboard(); 
}

function generateCodeLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

// Guarantee unique code letters by scanning current database records in real-time
async function getFreshNextCodeLetter(compId, currentRegId) {
    const { data: records, error } = await supabaseClient
        .from('participant_competitions')
        .select('id, code_letter, is_present')
        .eq('competition_id', compId);

    const usedLetters = new Set();
    if (records) {
        records.forEach(r => {
            // Exclude current participant being updated
            if (r.id !== currentRegId && r.code_letter && typeof r.code_letter === 'string') {
                const cleaned = r.code_letter.trim().toUpperCase();
                if (cleaned) usedLetters.add(cleaned);
            }
        });
    }

    // Find the first letter in sequence (A, B, C, ..., Z, AA, AB, ...) not in usedLetters
    let index = 0;
    while (true) {
        const candidate = generateCodeLetter(index);
        if (!usedLetters.has(candidate)) {
            return candidate;
        }
        index++;
    }
}

async function onScanSuccess(decodedText) {
    if (isProcessingScan || !activeScanCompId) return; 
    isProcessingScan = true;
    if (html5QrCode && html5QrCode.isScanning) {
        try { html5QrCode.pause(true); } catch(e) {}
    }

    let qrId = decodedText.trim();
    if (qrId.includes('?id=')) {
        qrId = qrId.split('?id=')[1];
    }

    try {
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

        // --- STRICT LEADER VERIFICATION FOR GROUP EVENTS ---
        const { data: compData } = await supabaseClient
            .from('competitions')
            .select('is_group')
            .eq('id', activeScanCompId)
            .single();
            
        if (compData && compData.is_group && !registration.is_leader) {
            showToast("Group Event: Please scan the Group Leader's ID to register the team.", "error");
            resetScanner();
            return; 
        }

        if (registration.is_present && registration.code_letter) {
            showToast(`${participant.name} is already checked in (Code ${registration.code_letter}).`, "warning");
            resetScanner();
            return;
        } 

        // Strictly determine unique next available code letter from real-time DB records
        let codeLetter = registration.code_letter ? registration.code_letter.trim().toUpperCase() : null;
        if (!codeLetter) {
            codeLetter = await getFreshNextCodeLetter(activeScanCompId, registration.id);
        }
        
        let updateQuery;
        if (compData && compData.is_group && registration.group_id) {
            // Group event: assign the code letter to the whole group and mark them present
            updateQuery = supabaseClient
                .from('participant_competitions')
                .update({ is_present: true, code_letter: codeLetter })
                .eq('competition_id', activeScanCompId)
                .eq('group_id', registration.group_id);
        } else {
            updateQuery = supabaseClient
                .from('participant_competitions')
                .update({ is_present: true, code_letter: codeLetter })
                .eq('id', registration.id);
        }

        const { error: updateErr } = await updateQuery;

        if (!updateErr) {
            showToast(`Success! ${participant.name} assigned: Code ${codeLetter}`);
            loadCheckedInList(activeScanCompId); 
        } else {
            showToast("Database error saving check-in: " + updateErr.message, "error");
        }
    } catch (err) {
        showToast("System error during scan: " + err.message, "error");
    }

    resetScanner();
}

function resetScanner() {
    setTimeout(() => {
        isProcessingScan = false;
        if (document.getElementById('scanner-modal').style.display === 'flex' && html5QrCode) {
            try { html5QrCode.resume(); } catch(e) {}
        }
    }, 1000); 
}

function onScanFailure(error) { /* Ignore routine frame failures */ }

// --- STRICT LEADER FILTERING FOR PENDING & DISPLAY ---
async function loadCheckedInList(compId) {
    const listContainer = document.getElementById(`list-${compId}`);
    if (!listContainer) return;

    const { data: comp } = await supabaseClient.from('competitions').select('is_group').eq('id', compId).single();

    const { data, error } = await supabaseClient
        .from('participant_competitions')
        .select('code_letter, is_present, is_leader, participants(name, unique_id, teams(name))') // Updated line
        .eq('competition_id', compId);

    if (error) {
        listContainer.innerHTML = `<p style="color: var(--danger); font-size: 0.8rem; font-weight: 600; margin: 0.25rem 0;">Failed to load participants.</p>`;
        const badgeCountEl = document.getElementById(`badge-count-${compId}`);
        if (badgeCountEl) { badgeCountEl.innerText = 'Error'; }
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500; margin: 0.25rem 0;">No participants enrolled.</p>`;
        const badgeCountEl = document.getElementById(`badge-count-${compId}`);
        if (badgeCountEl) { badgeCountEl.innerText = '0 Enrolled'; }
        return;
    }

    const checkedIn = data.filter(d => d.is_present).sort((a, b) => {
        if(a.code_letter < b.code_letter) return 1;
        if(a.code_letter > b.code_letter) return -1;
        return 0;
    });
    
    let pending = data.filter(d => !d.is_present);
    
    // --- STRICT LEADER FILTER FOR PENDING ARRIVALS ---
    if (comp && comp.is_group) {
        pending = pending.filter(d => d.is_leader); 
    }
    
    pending = pending.sort((a, b) => (a.participants?.name || '').localeCompare(b.participants?.name || ''));

    // Update accordion badge count
    const badgeCountEl = document.getElementById(`badge-count-${compId}`);
    if (badgeCountEl) {
        badgeCountEl.innerText = `${checkedIn.length} in • ${pending.length} abs`;
    }

    let html = '';

    if (checkedIn.length > 0) {
        html += checkedIn.map(reg => {
            let displayName = reg.participants?.name || 'Participant';
            if (comp && comp.is_group && reg.is_leader) displayName += " & PARTY";
            let teamName = reg.participants?.teams?.name || 'IND'; 
            
            return `
            <div class="participant-item-compact checked-in">
                <div class="p-info">
                    <span class="p-name">${displayName}</span>
                    <span class="p-sub">${teamName}</span>
                </div>
                <span class="code-letter-compact">${reg.code_letter}</span>
            </div>
        `}).join('');
    } else {
        html += `<p style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500; margin: 0.25rem 0;">No check-ins yet.</p>`;
    }

    if (pending.length > 0) {
        html += `
            <div style="font-size: 0.72rem; font-weight: 800; color: var(--warning); margin: 0.4rem 0 0.2rem 0; letter-spacing: 0.04em;">
                <i class="fa-solid fa-clock"></i> PENDING ARRIVAL (${pending.length})
            </div>
        `;
        
        html += pending.map(reg => {
            let displayName = reg.participants?.name || 'Participant';
            if (comp && comp.is_group && reg.is_leader) displayName += " & PARTY";
            let teamName = reg.participants?.teams?.name || 'IND';

            return `
            <div class="participant-item-compact absent">
                <div class="p-info">
                    <span class="p-name">${displayName}</span>
                    <span class="p-sub">${reg.participants?.unique_id || 'N/A'} • ${teamName}</span>
                </div>
                <span class="p-status-pill">ABSENT</span>
            </div>
        `}).join('');
    }

    listContainer.innerHTML = html;
}


// Internal core function to execute state changes
async function executeStateChange(compId, newStatus, btnElement, loadingText) {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}...`;
    btnElement.disabled = true;

    try {
        if (newStatus === 'registration' || newStatus === 'pending') {
            await supabaseClient.from('judgements')
                .delete()
                .eq('competition_id', compId)
                .not('participant_id', 'is', null);
        }

        const { error } = await supabaseClient
            .from('competitions')
            .update({ status: newStatus })
            .eq('id', compId);

        if (error) throw error;
        
        showToast(`Status updated successfully!`);
        loadDashboard(); 
        
    } catch (err) {
        showToast("Error updating status: " + err.message, "error");
        btnElement.innerHTML = originalHTML;
        btnElement.disabled = false;
    }
}

// Wrapper function mapped to UI buttons
async function changeCompetitionState(compId, newStatus, btnElement, loadingText) {
    const comp = (window.allLoadedCompetitions || []).find(c => String(c.id) === String(compId));
    const isOffstage = checkIsCompOffstage(comp);
    const sched = comp?.schedule || (window.masterSchedule ? window.masterSchedule[compId] : null);

    // Rule: Registration window enforcement
    if (newStatus === 'registration') {
        const regOffset = window.stageControllerSettings?.registrationOffset !== undefined ? window.stageControllerSettings.registrationOffset : 15;
        if (sched && sched.date && sched.time) {
            const schedDate = new Date(`${sched.date}T${sched.time}`);
            if (!isNaN(schedDate)) {
                const diffMins = (schedDate - new Date()) / 60000;
                if (diffMins > regOffset) {
                    const minsLeft = Math.ceil(diffMins - regOffset);
                    showToast(`Registration Locked: Opens ${regOffset} mins before schedule (${minsLeft}m left).`, "error");
                    openConfirmModal(
                        "Registration Not Open Yet",
                        `Registration for <strong>"${comp ? comp.name : 'this competition'}"</strong> cannot be started yet.<br><br>Registration opens <strong>${regOffset} minutes</strong> before scheduled time (<strong>${sched.time}</strong>).<br><br>Please wait <strong>${minsLeft} more minute(s)</strong>.`,
                        null,
                        { confirmText: "Understood", hideCancel: true }
                    );
                    return;
                }
            }
        }
    }

    // Rule: Strict Event Start Time enforcement
    if (newStatus === 'ongoing') {
        const strictStart = window.stageControllerSettings?.strictStartTime !== undefined ? window.stageControllerSettings.strictStartTime : true;
        if (strictStart && sched && sched.date && sched.time) {
            const schedDate = new Date(`${sched.date}T${sched.time}`);
            if (!isNaN(schedDate)) {
                const diffMins = (schedDate - new Date()) / 60000;
                if (diffMins > 0) {
                    const minsLeft = Math.ceil(diffMins);
                    showToast(`Cannot Start Event: Scheduled start time is ${sched.time}. (${minsLeft}m left)`, "error");
                    openConfirmModal(
                        "Scheduled Start Time Enforced",
                        `<strong>"${comp ? comp.name : 'This competition'}"</strong> is scheduled to start at <strong>${sched.time}</strong>.<br><br>Strict event timing is enabled, so the event cannot be started before its official scheduled time.<br><br>Time remaining: <strong>${minsLeft} minute(s)</strong>.`,
                        null,
                        { confirmText: "Understood", hideCancel: true }
                    );
                    return;
                }
            }
        }
    }

    // Rule: All other stage competitions (onstage) need an assigned judge before starting event (no need judge to start registration)
    if (newStatus === 'ongoing' && !isOffstage) {
        const assignedJudges = (comp?.judgements || []).filter(j => !!j.judge_id);
        if (assignedJudges.length === 0) {
            showToast("Cannot Start Event: An assigned judge is required before starting an onstage competition.", "error");
            openConfirmModal(
                "Judge Required to Start Event",
                `<strong>"${comp ? comp.name : 'This competition'}"</strong> is an onstage competition and requires an assigned judge before the live event can be started.<br><br>Please assign a judge in the Judge Management portal.`,
                null,
                { confirmText: "Understood", hideCancel: true }
            );
            return;
        }
    }

    if (newStatus === 'ongoing' || newStatus === 'judgement_complete' || newStatus === 'valuation') {
        let title = "Confirm Action";
        let text = "Are you sure you want to proceed?";
        if (newStatus === 'ongoing') {
            title = "Start Event?";
            text = "Lock registration and start the event now?";
        } else if (newStatus === 'valuation') {
            title = "End Event & Send to Valuation?";
            text = "End offstage competition? The event will now move to Valuation for judge evaluation.";
        } else if (newStatus === 'judgement_complete') {
            title = "End Event & Send to Manager?";
            text = "End competition? This finalizes marks and notifies the Manager to publish results.";
        }

        openConfirmModal(title, text, () => {
            executeStateChange(compId, newStatus, btnElement, loadingText);
        });
    } else {
        executeStateChange(compId, newStatus, btnElement, loadingText);
    }
}

async function cancelRegistration(compId, btn) {
    openConfirmModal("Cancel Registration?", "WARNING: This will cancel registration and remove any scanned participants. Proceed?", async () => {
        try {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CANCELLING...';
            btn.disabled = true;

            const { error: resetError } = await supabaseClient
                .from('participant_competitions')
                .update({ is_present: false, code_letter: null })
                .eq('competition_id', compId);
                
            if (resetError) throw resetError;
            
            await executeStateChange(compId, 'pending', btn, 'CANCELLING');
        } catch (err) {
            showToast("ERROR CANCELLING: " + err.message, "error");
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> CANCEL';
            btn.disabled = false;
        }
    });
}


async function revertCompletedComp(compId, btn) {
    openConfirmModal("Reopen Event?", "Reopen this event to Ongoing (Live)? Stage controllers and judges can continue evaluating.", () => {
        executeStateChange(compId, 'ongoing', btn, 'Reopening');
    });
}
window.revertCompletedComp = revertCompletedComp;

async function backToRegistration(compId, btn) {
    openConfirmModal("Revert to Registration?", "⚠️ Re-open the scanner? This will ERASE any submitted marks!", () => {
        executeStateChange(compId, 'registration', btn, 'Reverting');
    });
}


// Dynamic CSS for spinner
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

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
    const logoSize = brandingData.logo_size || 32; 
    
    const festName = validName ? brandingData.fest_name : 'Festival';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    if (validLogo) {
        let allIcons = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
        if (allIcons.length === 0) {
            let newIcon = document.createElement('link');
            newIcon.rel = 'icon';
            document.head.appendChild(newIcon);
            allIcons = [newIcon];
        }
        allIcons.forEach(link => {
            if (link.type === 'image/svg+xml') link.removeAttribute('type');
            link.href = brandingData.fest_logo;
        });
    }

    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text');
    brandContainers.forEach(container => {
        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: ${logoSize}px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '8px' : '0'}; display: inline-block; vertical-align: middle;">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        if (showName) {
            html += `<span style="letter-spacing: -0.5px; display: inline-block; vertical-align: middle; white-space: normal; word-break: break-word;">${validName ? brandingData.fest_name : 'FestOS'}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'nowrap';
        
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login') || window.location.pathname.includes('index') || window.location.pathname === '/') {
            container.style.justifyContent = 'center';
        }
    });

    if (typeof window !== 'undefined') window.systemBranding = brandingData;
}

initializeApp();

// --- MODAL & AUTH UTILITIES ---
function openConfirmModal(title, text, confirmCallback, options = {}) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerHTML = text;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.innerText = options.confirmText || 'Yes, Proceed';
    confirmBtn.onclick = () => {
        closeConfirmModal();
        if (confirmCallback) confirmCallback();
    };

    const cancelBtn = document.querySelector('#confirmModal .btn-outline');
    if (cancelBtn) {
        cancelBtn.style.display = options.hideCancel ? 'none' : 'inline-block';
    }
    
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
    const cancelBtn = document.querySelector('#confirmModal .btn-outline');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    document.getElementById('confirmModal').style.display = 'none';
}

function alertRegistrationEarly(compId, minsLeft, schedTime, regOffset) {
    const comp = (window.allLoadedCompetitions || []).find(c => String(c.id) === String(compId));
    openConfirmModal(
        "Registration Not Open Yet",
        `Registration for <strong>"${comp ? comp.name : 'this competition'}"</strong> cannot be started yet.<br><br>Registration opens <strong>${regOffset} minutes</strong> before scheduled time (<strong>${schedTime || 'TBD'}</strong>).<br><br>Time remaining: <strong>${minsLeft} minute(s)</strong>.`,
        null,
        { confirmText: "Understood", hideCancel: true }
    );
}

function alertStartBeforeSchedule(compId, minsLeft, schedTime) {
    const comp = (window.allLoadedCompetitions || []).find(c => String(c.id) === String(compId));
    openConfirmModal(
        "Scheduled Start Time Enforced",
        `<strong>"${comp ? comp.name : 'This competition'}"</strong> is scheduled to start at <strong>${schedTime}</strong>.<br><br>Strict event timing is enabled, so the event cannot be started before its official scheduled time.<br><br>Time remaining: <strong>${minsLeft} minute(s)</strong>.`,
        null,
        { confirmText: "Understood", hideCancel: true }
    );
}

// Background auto-refresh for countdowns and schedule windows (every 30 seconds)
if (!window._schedRefreshInterval) {
    window._schedRefreshInterval = setInterval(() => {
        const scannerModal = document.getElementById('scanner-modal');
        const confirmModal = document.getElementById('confirmModal');
        const isScannerOpen = scannerModal && scannerModal.style.display !== 'none';
        const isConfirmOpen = confirmModal && confirmModal.style.display === 'flex';
        if (!isScannerOpen && !isConfirmOpen) {
            const currentFilter = document.getElementById('master-stage-filter');
            const targetStage = currentFilter ? currentFilter.value : 'ALL';
            loadCompetitions(targetStage);
        }
    }, 30000);
}

function logout() {
    openConfirmModal("Sign Out", "Are you sure you want to securely log out of the stage controller?", () => {
        localStorage.removeItem('festUser');
        window.location.href = 'index.html';
    });
}


