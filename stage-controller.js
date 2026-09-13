const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let html5QrcodeScanner = null;
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
        window.location.href = 'index.html';
        return;
    }
    
    if (user.role === 'master_admin' || user.role === 'admin') {
        const navActions = document.querySelector('.nav-actions');
        if (navActions) {
            navActions.insertAdjacentHTML('afterbegin', `<button class="btn btn-primary" onclick="window.location.href='admin.html'"><i class="fa-solid fa-shield-halved"></i> Admin Hub</button>`);
        }
    }
    
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
        welcomeMsg.innerText = `WELCOME, ${user.username}`;
    }
    
    loadDashboard();
}

async function loadDashboard() {
    const container = document.getElementById('competitions-container');
    container.innerHTML = `<div style="text-align:center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top: 1rem; color: var(--text-muted); font-weight: 600;">Loading Stage Data...</p></div>`;

    if (user.role === 'master_admin' || user.role === 'admin') {
        document.getElementById('stage-name').innerText = "Admin Override";
        document.getElementById('master-filter-container').style.display = 'block';
        
        const { data: stages } = await supabaseClient.from('stages').select('id, name').order('stage_no');
        const filterDropdown = document.getElementById('master-stage-filter');
        filterDropdown.innerHTML = '<option value="ALL">-- ALL STAGES (MASTER VIEW) --</option>';
        
        if (stages) {
            stages.forEach(s => {
                filterDropdown.innerHTML += `<option value="${s.id}">${s.name}</option>`;
            });
        }

        loadCompetitions('ALL');
        return;
    }

    const { data: stage, error: stageError } = await supabaseClient
        .from('stages').select('*').eq('controller_id', user.id).maybeSingle();

    if (stageError || !stage) {
        document.getElementById('stage-name').innerText = "Unassigned / Error";
        container.innerHTML = `<p style="color: var(--danger); text-align:center; background: white; padding: 2rem; border-radius: 12px; font-weight: 600;">Failed to load stage data. Ask the Master Admin to assign you to a stage.</p>`;
        return;
    }

    document.getElementById('stage-name').innerText = stage.name;
    loadCompetitions(stage.id);
}

function adjustLayoutPadding() {
    const navbar = document.querySelector('.navbar > div:first-child');
    if (navbar) {
        document.body.style.paddingTop = `${navbar.offsetHeight + 15}px`;
    }
}

async function loadCompetitions(stageId) {
    let query = supabaseClient.from('competitions')
        // Ensure we fetch stages(id, name, stage_no) and judgements
        .select('*, categories(name), stages(id, name, stage_no), judgements(judge_id, awarded_mark, users(username)), participant_competitions(participant_id)');

    if (stageId && stageId !== 'ALL') {
        query = query.eq('stage_id', stageId);
    }
    
    const { data: competitionsData, error } = await query;
    
    // Fetch Master Schedule
    const { data: schedData } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
    const masterSchedule = schedData?.value || {};
    
    // Fetch Offset Setting
    const { data: pointData } = await supabaseClient.from('settings').select('value').eq('id', 'point_system').maybeSingle();
    const announcerOffset = pointData?.value?.announcer_offset !== undefined ? parseInt(pointData.value.announcer_offset) : 30;

    const container = document.getElementById('competitions-container');
    container.innerHTML = '';

    if (error || !competitionsData || competitionsData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-clipboard-check" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.05rem; font-weight: 600;">No competitions assigned to this stage yet.</p>
            </div>`;
        adjustLayoutPadding(); 
        return;
    }

    const now = new Date();
    
    // Filter out Completed Events and Future Events beyond the offset limit
    const visibleComps = competitionsData.filter(comp => {
        // Goal: Remove it entirely once it hits judgement_complete (or published)
        if (comp.status === 'published' || comp.status === 'judgement_complete') return false; 
        
        // Show ongoing, registration, and valuation immediately without time bounds
        if (comp.status !== 'pending') return true; 
        
        const sched = masterSchedule[comp.id];
        if (!sched || sched.status !== 'published') return false; 
        
        const schedDate = new Date(`${sched.date}T${sched.time}`);
        if (isNaN(schedDate)) return true; // Failsafe: show it if the date format is corrupt
        
        // Check if the scheduled time is within the offset window
        const diffMins = (schedDate - now) / 60000;
        return diffMins <= announcerOffset;
    });

    // Goal: Order chronologically by Scheduled Time
    visibleComps.sort((a, b) => {
        const schedA = masterSchedule[a.id];
        const schedB = masterSchedule[b.id];
        const timeA = schedA && schedA.date && schedA.time ? new Date(`${schedA.date}T${schedA.time}`).getTime() : Infinity;
        const timeB = schedB && schedB.date && schedB.time ? new Date(`${schedB.date}T${schedB.time}`).getTime() : Infinity;
        return timeA - timeB;
    });

    if (visibleComps.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <i class="fa-solid fa-calendar-check" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.05rem; font-weight: 600;">No active or upcoming events within the time limit.</p>
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

        const enrolledCount = comp.participant_competitions ? comp.participant_competitions.length : 0;
        const categoryName = comp.categories?.name || 'Uncategorized';
        
        // Extract Judges
        const uniqueJudges = [...new Set((comp.judgements || []).map(j => j.users?.username).filter(Boolean))];
        const judgesStr = uniqueJudges.length > 0 ? uniqueJudges.join(', ') : 'AWAITING';

        // Extract Schedule
        let schedBadge = '';
        const sched = masterSchedule[comp.id];
        if (sched) {
            const timeObj = new Date(`${sched.date}T${sched.time}`);
            const timeStr = isNaN(timeObj) ? sched.time : timeObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            schedBadge = `<span style="display: inline-flex; align-items: center; gap: 0.4rem;"><i class="fa-regular fa-clock" style="color: var(--primary);"></i> Sched: <strong style="color: var(--text-main);">${sched.date} @ ${timeStr}</strong></span>`;
        }

        const card = document.createElement('div');
        card.className = 'card comp-card';
        card.setAttribute('data-comp-name', comp.name.toLowerCase()); 
        card.setAttribute('data-category', categoryName); 
        card.setAttribute('data-status', comp.status); 
        
        card.innerHTML = `
            <div class="card-header">
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 1rem;">
                        <span style="color: var(--primary); font-size: 0.75rem; font-weight: 800; background: var(--primary-light); padding: 0.35rem 0.75rem; border-radius: 6px;">
                            ${categoryName}
                        </span>
                        <span class="badge ${badgeClass}" style="white-space: nowrap;">${statusIcon} ${statusText}</span>
                    </div>
                    
                    <h2 class="card-title" style="margin-top: 0.75rem;">${comp.name}</h2>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--text-muted); font-size: 0.9rem; font-weight: 600; margin-top: 0.5rem;">
                        ${schedBadge}
                        <div style="display: flex; gap: 1.25rem;">
                            <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                                <i class="fa-solid fa-users" style="color: var(--primary);"></i> Enrolled: <strong style="color: var(--text-main);">${enrolledCount}</strong>
                            </span>
                            <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                                <i class="fa-solid fa-gavel" style="color: var(--primary);"></i> Judges: <strong style="color: var(--text-main);">${judgesStr}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="controls-${comp.id}">
                ${getButtonsForStatus(comp)}
            </div>

            <div class="card-list-section" ${comp.status === 'pending' ? 'style="display:none;"' : ''}>
                <h3 style="font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);">
                    <i class="fa-solid fa-clipboard-user" style="color: var(--primary);"></i> Participant Status
                </h3>
                <div class="participant-list" id="list-${comp.id}">
                    <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 600;">Loading participants...</p>
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

function filterCompetitions() {
    const searchInput = document.getElementById('comp-search');
    const categoryDropdown = document.getElementById('category-filter');
    const statusDropdown = document.getElementById('status-filter');
    
    if (!searchInput) return;
    
    const textFilter = searchInput.value.toLowerCase();
    const catFilter = categoryDropdown ? categoryDropdown.value : 'ALL';
    const statusFilter = statusDropdown ? statusDropdown.value : 'ALL';
    
    const cards = document.querySelectorAll('.comp-card');
    
    cards.forEach(card => {
        const compName = card.getAttribute('data-comp-name');
        const compCat = card.getAttribute('data-category');
        const compStatus = card.getAttribute('data-status');
        
        const matchesText = compName.includes(textFilter);
        const matchesCategory = (catFilter === 'ALL' || compCat === catFilter);
        
        // Ensure 'valuation' is treated correctly under the filter logic
        const matchesStatus = (statusFilter === 'ALL' || compStatus === statusFilter || (statusFilter === 'pending' && compStatus === 'valuation'));
        
        if (matchesText && matchesCategory && matchesStatus) {
            card.style.display = 'block'; 
        } else {
            card.style.display = 'none'; 
        }
    });
    
    adjustLayoutPadding();
}

function getButtonsForStatus(comp) {
    const safeName = comp.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");

    if (comp.status === 'pending') {
        return `<button class="btn btn-primary" onclick="changeCompetitionState('${comp.id}', 'registration', this, 'STARTING')"><i class="fa-solid fa-qrcode"></i> START REGISTRATION</button>`;
    }
    
    if (comp.status === 'registration') {
        return `
            <div>
                <button class="btn btn-outline" style="color: var(--primary); border-color: var(--primary);" onclick="openScannerModal('${comp.id}', '${safeName}')" title="SCAN QR"><i class="fa-solid fa-expand"></i> SCAN QR</button>
                <button class="btn btn-success" onclick="changeCompetitionState('${comp.id}', 'ongoing', this, 'STARTING')"><i class="fa-solid fa-play"></i> START EVENT</button>
                <button class="btn btn-danger" onclick="cancelRegistration('${comp.id}', this)"><i class="fa-solid fa-xmark"></i> CANCEL REGISTRATION</button>
            </div>
        `;
    }
    
    if (comp.status === 'ongoing') {
        // --- NEW: OFFSTAGE EVENT WORKFLOW ---
        if (comp.is_offstage) {
            return `
                <div>
                    <button class="btn btn-outline" onclick="backToRegistration('${comp.id}', this)"><i class="fa-solid fa-arrow-rotate-left"></i> REVERT TO REGISTRATION</button>
                    <button class="btn btn-warning" onclick="changeCompetitionState('${comp.id}', 'valuation', this, 'ENDING')"><i class="fa-solid fa-file-export"></i> END EVENT & SEND TO VALUATION</button>
                </div>
            `;
        } else {
            // --- STANDARD EVENT WORKFLOW ---
            const hasMarks = comp.judgements && comp.judgements.some(j => j.awarded_mark !== null);
            const endBtn = hasMarks 
                ? `<button class="btn btn-warning" onclick="changeCompetitionState('${comp.id}', 'judgement_complete', this, 'ENDING')"><i class="fa-solid fa-flag-checkered"></i> END COMPETITION</button>`
                : `<button class="btn btn-outline" style="opacity: 0.6; pointer-events: none;" disabled><i class="fa-solid fa-hourglass-half"></i> AWAITING JUDGES...</button>`;

            return `
                <div>
                    <button class="btn btn-outline" onclick="backToRegistration('${comp.id}', this)"><i class="fa-solid fa-arrow-rotate-left"></i> REVERT TO REGISTRATION</button>
                    ${endBtn}
                </div>
            `;
        }
    }
    
    if (comp.status === 'valuation') {
        const hasMarks = comp.judgements && comp.judgements.some(j => j.awarded_mark !== null);
        const endBtn = hasMarks 
            ? `<button class="btn btn-success" onclick="changeCompetitionState('${comp.id}', 'judgement_complete', this, 'SUBMITTING')"><i class="fa-solid fa-check-double"></i> MARKS RECEIVED - SEND TO MANAGER</button>`
            : `<button class="btn btn-outline" style="opacity: 0.6; pointer-events: none;" disabled><i class="fa-solid fa-hourglass-half"></i> AWAITING VALUATION MARKS...</button>`;
        return `
            <div>
                <button class="btn btn-outline" onclick="changeCompetitionState('${comp.id}', 'ongoing', this, 'REVERTING')"><i class="fa-solid fa-arrow-rotate-left"></i> REVERT TO ONGOING</button>
                ${endBtn}
            </div>
        `;
    }
    
    return `<div style="color: var(--primary); font-size: 0.95rem; font-weight: 700; width: 100%; text-align: center; background: var(--primary-light); padding: 1.25rem; border-radius: 12px; border: 1px dashed rgba(79, 70, 229, 0.3);">EVENT COMPLETED. WAITING FOR MANAGER.</div>`;
}

async function openScannerModal(compId, compName) {
    activeScanCompId = compId;
    document.getElementById('modal-comp-name').innerText = `Scanning: ${compName}`;
    document.getElementById('scanner-modal').style.display = 'flex';

    const { count } = await supabaseClient
        .from('participant_competitions') 
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', compId)
        .eq('is_present', true);
    
    currentPresentCount = count || 0;

    // Removed qrbox to scan full-frame and boosted fps to 20 for instant reads
    html5QrcodeScanner = new Html5QrcodeScanner("global-reader", { fps: 20 }, false);
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeScannerModal() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
    }
    document.getElementById('scanner-modal').style.display = 'none';
    activeScanCompId = null;
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

async function onScanSuccess(decodedText) {
    if (isProcessingScan || !activeScanCompId) return; 
    isProcessingScan = true;
    html5QrcodeScanner.pause();

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

        // --- CORRECTED: STRICT LEADER VERIFICATION ---
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
        // ---------------------------------------------

        if (registration.is_present) {
            showToast(`${participant.name} is already checked in.`, "warning");
            resetScanner();
            return;
        } 

        const codeLetter = generateCodeLetter(currentPresentCount);
        
        const { error: updateErr } = await supabaseClient
            .from('participant_competitions')
            .update({ is_present: true, code_letter: codeLetter })
            .eq('id', registration.id);

        if(!updateErr) {
            currentPresentCount++;
            showToast(`Success! ${participant.name} assigned: ${codeLetter}`);
            loadCheckedInList(activeScanCompId); 
        } else {
            showToast("Database error saving check-in.", "error");
        }
    } catch (err) {
        showToast("System error during scan.", "error");
    }

    resetScanner();
}

function resetScanner() {
    setTimeout(() => {
        isProcessingScan = false;
        if (document.getElementById('scanner-modal').style.display === 'flex') {
            html5QrcodeScanner.resume();
        }
    }, 800); 
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
        listContainer.innerHTML = `<p style="color: var(--danger); font-size: 0.95rem; font-weight: 600;">Failed to load participants.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        listContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">No participants are enrolled in this competition.</p>`;
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
    
    pending = pending.sort((a, b) => a.participants.name.localeCompare(b.participants.name));

    let html = '';

    if (checkedIn.length > 0) {
        html += checkedIn.map(reg => {
            let displayName = reg.participants.name;
            if (comp && comp.is_group && reg.is_leader) displayName += " & PARTY";
            
            // Extract team name with a fallback
            let teamName = reg.participants.teams?.name || 'IND'; 
            
            return `
            <div class="participant-item" style="border-left: 4px solid var(--success);">
                <div>
                    <span style="font-weight: 700; font-size: 1rem; color: var(--text-main); display: block;">${displayName}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; display: block; margin-top: 0.15rem;">${teamName}</span>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--success); display: flex; align-items: center; gap: 0.3rem; margin-top: 0.25rem;">
                        <i class="fa-solid fa-circle-check"></i> CHECKED IN
                    </span>
                </div>
                <span class="code-letter">${reg.code_letter}</span>
            </div>
        `}).join('');
    } else {
        html += `<p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500; margin-bottom: 0.5rem;">No one has checked in yet.</p>`;
    }

    if (pending.length > 0) {
        html += `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border);">
                <h4 style="font-size: 0.85rem; font-weight: 800; color: var(--warning); margin-bottom: 1rem; letter-spacing: 0.05em;">
                    <i class="fa-solid fa-clock"></i> PENDING ARRIVAL (${pending.length})
                </h4>
            </div>
        `;
        
        html += pending.map(reg => {
            let displayName = reg.participants.name;
            if (comp && comp.is_group && reg.is_leader) displayName += " & PARTY";

            // Extract team name with a fallback
            let teamName = reg.participants.teams?.name || 'IND';

            return `
            <div class="participant-item" style="opacity: 0.75; background: var(--bg-main); border-left: 4px solid var(--warning);">
                <div>
                    <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-main); display: block;">${displayName}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace; font-weight: 600; margin-top: 0.25rem; display: block;">${reg.participants.unique_id} • ${teamName}</span>
                </div>
                <span style="font-size: 0.75rem; font-weight: 800; color: var(--warning); background: var(--warning-light); padding: 0.35rem 0.75rem; border-radius: 6px;">ABSENT</span>
            </div>
        `}).join('');
    }

    listContainer.innerHTML = html;
}

async function changeCompetitionState(compId, newStatus, btnElement, loadingText) {
    if (newStatus === 'ongoing' && !confirm("Lock registration and start the event?")) return;
    if (newStatus === 'judgement_complete' && !confirm("End competition? This locks marks and notifies the Manager.")) return;

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

async function cancelRegistration(compId, btn) {
    try {
        if (!confirm("WARNING: THIS WILL CANCEL REGISTRATION AND REMOVE ANY SCANNED PARTICIPANTS. PROCEED?")) return;
        
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CANCELLING...';
        btn.disabled = true;

        const { error: resetError } = await supabaseClient
            .from('participant_competitions')
            .update({ is_present: false, code_letter: null })
            .eq('competition_id', compId);
            
        if (resetError) throw resetError;
        
        await changeCompetitionState(compId, 'pending', btn, 'CANCELLING');
    } catch (err) {
        showToast("ERROR CANCELLING: " + err.message, "error");
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> CANCEL REGISTRATION';
        btn.disabled = false;
    }
}

async function backToRegistration(compId, btn) {
    if(!confirm("⚠️ Re-open the scanner? This will ERASE any submitted marks!")) return;
    changeCompetitionState(compId, 'registration', btn, 'Reverting');
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
    const logoSize = brandingData.logo_size || 32; 
    
    const festName = validName ? brandingData.fest_name : 'FestOS';
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
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: ${logoSize}px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '8px' : '0'}; display: inline-block; vertical-align: middle; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
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