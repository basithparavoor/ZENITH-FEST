const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Point System: 1st Place = 10 pts, 2nd Place = 7 pts, 3rd Place = 5 pts
const POINTS = { 1: 10, 2: 7, 3: 5 };

let publishedCompetitions = [];
let allTeams = [];
let calculatedTeamScores = {}; 
let competitionResults = {}; 

function switchTab(tabId, element) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    // Fallback if event target isn't passed properly
    if(element) {
        element.classList.add('active');
    } else if (event) {
        event.currentTarget.classList.add('active');
    }
}

// 1. Fetch & Calculate Everything
async function fetchAndCalculateResults() {
    // Fetch Teams
    const { data: teams } = await supabase.from('teams').select('*');
    allTeams = teams || [];
    
    // Initialize scores
    allTeams.forEach(t => calculatedTeamScores[t.id] = { name: t.name, score: 0 });

    // Fetch Published Competitions
    const { data: comps } = await supabase.from('competitions')
        .select('*')
        .eq('status', 'published');
    publishedCompetitions = comps || [];

    // Update Poster Status UI
    document.getElementById('publish-status').innerText = `Results published for ${publishedCompetitions.length} competitions.`;

    // Fetch Judgements for published comps
    const compIds = publishedCompetitions.map(c => c.id);
    if (compIds.length > 0) {
        const { data: judgements } = await supabase
            .from('judgements')
            .select(`
                competition_id, 
                awarded_mark, 
                participants(id, name, team_id)
            `)
            .in('competition_id', compIds);

        processJudgements(judgements || []);
    }

    renderLeaderboard();
    populateCompetitionDropdown();
}

// 2. Process Raw Marks into Rankings and Team Points
function processJudgements(judgements) {
    const compGroups = {};
    
    judgements.forEach(j => {
        if(!compGroups[j.competition_id]) compGroups[j.competition_id] = {};
        
        const pId = j.participants.id;
        if(!compGroups[j.competition_id][pId]) {
            compGroups[j.competition_id][pId] = {
                participant: j.participants,
                total_mark: 0
            };
        }
        compGroups[j.competition_id][pId].total_mark += parseFloat(j.awarded_mark);
    });

    for (const [compId, participantsMap] of Object.entries(compGroups)) {
        const sorted = Object.values(participantsMap).sort((a, b) => b.total_mark - a.total_mark);
        const top3 = sorted.slice(0, 3);
        competitionResults[compId] = top3;

        top3.forEach((entry, index) => {
            const position = index + 1; 
            const pointsAwarded = POINTS[position] || 0;
            const teamId = entry.participant.team_id;
            
            if (teamId && calculatedTeamScores[teamId]) {
                calculatedTeamScores[teamId].score += pointsAwarded;
            }
        });
    }
}

// 3. Render Team Leaderboard UI (With stagger animation)
function renderLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '';

    const sortedTeams = Object.values(calculatedTeamScores).sort((a, b) => b.score - a.score);

    if(sortedTeams.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 2rem; font-weight: 500;">No results published yet.</p>`;
        return;
    }

    sortedTeams.forEach((team, index) => {
        const rank = index + 1;
        let rankClass = rank <= 3 ? `rank-${rank}` : '';
        let rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

        // Added animation delay for fluid rendering
        container.innerHTML += `
            <div class="leaderboard-card" style="animation-delay: ${index * 0.05}s">
                <div class="rank ${rankClass}">${rankDisplay}</div>
                <div class="team-info">
                    <div class="team-name">${team.name}</div>
                </div>
                <div class="team-score">${team.score} <span style="font-size:1rem; color: #9CA3AF">pts</span></div>
            </div>
        `;
    });
}

// 4. Render Individual Top 3 Winners UI (With stagger animation)
function populateCompetitionDropdown() {
    const select = document.getElementById('comp-filter');
    publishedCompetitions.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

function renderIndividualResults() {
    const compId = document.getElementById('comp-filter').value;
    const container = document.getElementById('winners-container');
    container.innerHTML = '';

    if (!compId || !competitionResults[compId]) {
        container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; padding: 2rem;">No results available for this selection.</p>`;
        return;
    }

    const top3 = competitionResults[compId];
    const classes = ['gold', 'silver', 'bronze'];
    const labels = ['1st Place', '2nd Place', '3rd Place'];
    const colors = ['#F59E0B', '#94A3B8', '#B45309'];

    top3.forEach((entry, index) => {
        const teamName = allTeams.find(t => t.id === entry.participant.team_id)?.name || 'Independent';
        
        container.innerHTML += `
            <div class="winner-card ${classes[index]}" style="animation-delay: ${index * 0.1}s">
                <div class="winner-position" style="color: ${colors[index]}">${labels[index]}</div>
                <div class="winner-name">${entry.participant.name}</div>
                <div class="winner-team">${teamName}</div>
                <div style="margin-top: 1.5rem; font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">Score: ${entry.total_mark}</div>
            </div>
        `;
    });
}

// 5. Generate JPEG Poster via html2canvas
async function downloadPoster() {
    const btn = event.currentTarget;
    btn.innerText = "Generating Poster...";
    btn.disabled = true;

    const sortedTeams = Object.values(calculatedTeamScores).sort((a, b) => b.score - a.score).slice(0, 5); 
    const posterContainer = document.getElementById('poster-leaderboard-container');
    posterContainer.innerHTML = '';

    sortedTeams.forEach((team, index) => {
        posterContainer.innerHTML += `
            <div class="poster-row">
                <div class="poster-row-rank">#${index + 1}</div>
                <div class="poster-row-name">${team.name}</div>
                <div class="poster-row-score">${team.score}</div>
            </div>
        `;
    });

    document.getElementById('poster-subtitle').innerText = `Standings after ${publishedCompetitions.length} Competitions`;

    const exportArea = document.getElementById('poster-export-area');

    html2canvas(exportArea, { scale: 2, useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Fest_Results_Poster_${publishedCompetitions.length}_Comps.jpeg`;
        link.href = canvas.toDataURL("image/jpeg", 0.9);
        link.click();
        
        btn.innerText = "Download JPEG Poster";
        btn.disabled = false;
    });
}

// Boot up
fetchAndCalculateResults();