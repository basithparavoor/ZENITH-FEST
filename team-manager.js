const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth & Role Check
const user = JSON.parse(localStorage.getItem('festUser'));
if (!user || user.role !== 'team_manager') {
    window.location.href = 'index.html'; // Kick out unauthorized users
}

let myTeamId = user.team_id; 
let teamMembers = [];
let availableCompetitions = [];

// UI Utils
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
}

function logout() {
    localStorage.removeItem('festUser');
    window.location.href = 'index.html';
}

// Data Loading
async function initDashboard() {
    try {
        // Fetch Team Name
        const { data: teamData } = await supabaseClient.from('teams').select('name').eq('id', myTeamId).single();
        if(teamData) document.getElementById('manager-team-name').innerText = teamData.name;

        // Fetch My Team Members
        const { data: members, error: memError } = await supabaseClient
            .from('participants')
            .select('*, categories(name)')
            .eq('team_id', myTeamId);
            
        if(memError) throw memError;
        teamMembers = members || [];
        document.getElementById('stat-members').innerText = teamMembers.length;

        // Render Roster
        const rosterBody = document.getElementById('roster-tbody');
        rosterBody.innerHTML = '';
        teamMembers.forEach(m => {
            rosterBody.innerHTML += `
                <tr>
                    <td style="font-family: monospace; font-weight: 600;">${m.unique_id}</td>
                    <td style="font-weight: bold;">${m.name}</td>
                    <td><span class="badge badge-primary">${m.categories?.name || 'N/A'}</span></td>
                    <td>BATCH ${m.batch_no || '1'}</td>
                </tr>
            `;
        });

        loadAssignments();
    } catch(e) {
        showToast(e.message, 'error');
    }
}

async function loadAssignments() {
    try {
        // Fetch assignments only for students in this manager's team
        const { data, error } = await supabaseClient
            .from('participant_competitions')
            .select(`
                id, 
                participants!inner(name, team_id, categories(name)), 
                competitions(name)
            `)
            .eq('participants.team_id', myTeamId); // Strict security filter

        if (error) throw error;

        document.getElementById('stat-enrollments').innerText = data.length;

        const tbody = document.getElementById('assignments-tbody');
        tbody.innerHTML = '';
        (data || []).forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;">${row.participants.name}</td>
                    <td>${row.competitions.name}</td>
                    <td>${row.participants.categories?.name}</td>
                    <td>
                        <button class="btn btn-outline" style="color: var(--danger); border-color: var(--danger);" onclick="removeAssignment('${row.id}')">
                            <i class="fa-solid fa-xmark"></i> Remove
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch(e) { showToast(e.message, 'error'); }
}

async function openAssignModal() {
    if (availableCompetitions.length === 0) {
        const { data } = await supabaseClient.from('competitions').select('id, name');
        availableCompetitions = data || [];
    }

    let memOpts = teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    let compOpts = availableCompetitions.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    document.getElementById('modalTitle').innerText = 'Assign Student to Competition';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Select Team Member</label>
            <select id="assignStudent">${memOpts}</select>
        </div>
        <div class="form-group">
            <label>Select Competition</label>
            <select id="assignComp">${compOpts}</select>
        </div>
    `;

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.onclick = async () => {
        const participant_id = document.getElementById('assignStudent').value;
        const competition_id = document.getElementById('assignComp').value;

        try {
            const { error } = await supabaseClient.from('participant_competitions').insert([{ participant_id, competition_id }]);
            if (error) {
                if(error.code === '23505') throw new Error('Student is already assigned to this competition.');
                throw error;
            }
            showToast('Assignment Successful!');
            document.getElementById('formModal').classList.remove('show');
            loadAssignments();
        } catch(e) { showToast(e.message, 'error'); }
    };
    
    document.getElementById('formModal').classList.add('show');
}

async function removeAssignment(assignmentId) {
    if(confirm("Remove this student from the competition?")) {
        await supabaseClient.from('participant_competitions').delete().eq('id', assignmentId);
        showToast('Removed assignment.');
        loadAssignments();
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);