const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const POINTS = { 1: 10, 2: 7, 3: 5 };

let publishedCompetitions = [];
let allTeams = [];
let calculatedTeamScores = {}; 
let competitionResults = {}; 

function switchTab(tabId, element) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    if(element) {
        element.classList.add('active');
    } else if (event) {
        event.currentTarget.classList.add('active');
    }
}

async function fetchAndCalculateResults() {
    const { data: teams } = await supabase.from('teams').select('*');
    allTeams = teams || [];
    
    allTeams.forEach(t => calculatedTeamScores[t.id] = { name: t.name, score: 0 });

    const { data: comps } = await supabase.from('competitions')
        .select('*')
        .eq('status', 'published');
    publishedCompetitions = comps || [];

    document.getElementById('publish-status').innerText = `Data indexed from ${publishedCompetitions.length} active events.`;

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

function processJudgements(judgements) {
    const compGroups = {};
    
    judgements.forEach(j => {
        const comp = publishedCompetitions.find(c => c.id === j.competition_id);
        if(!compGroups[j.competition_id]) {
            compGroups[j.competition_id] = {
                participants: {},
                is_general: comp?.categories?.is_general || false,
                max_mark: comp?.max_mark || 100,
                comp_data: comp
            };
        }
        
        const pId = j.participants.id;
        if(!compGroups[j.competition_id].participants[pId]) {
            compGroups[j.competition_id].participants[pId] = {
                participant: j.participants,
                competition: comp,
                total_mark: 0,
                judge_count: 0
            };
        }
        compGroups[j.competition_id].participants[pId].total_mark += parseFloat(j.awarded_mark);
        compGroups[j.competition_id].participants[pId].judge_count += 1;
    });

    for (const [compId, compData] of Object.entries(compGroups)) {
        const basePoints = compData.is_general ? 20 : 10;
        
        // Calculate normalized points for each participant (Average Mark / Max Mark * 10 or 20)
        const participantsArr = Object.values(compData.participants).map(p => {
            const averageMark = p.total_mark / p.judge_count;
            p.normalized_points = parseFloat(((averageMark / compData.max_mark) * basePoints).toFixed(2));
            return p;
        });

        // Sort by normalized points to determine winners
        const sorted = participantsArr.sort((a, b) => b.normalized_points - a.normalized_points);
        const top3 = sorted.slice(0, 3);
        competitionResults[compId] = top3;

        // Apply standard leaderboard points (10, 7, 5) to the Team Standings
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

function renderLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '';

    const sortedTeams = Object.values(calculatedTeamScores).sort((a, b) => b.score - a.score);

    if(sortedTeams.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 3rem; color: var(--text-muted); font-weight: 500;">Awaiting official results...</p>`;
        return;
    }

    sortedTeams.forEach((team, index) => {
        const rank = index + 1;
        let rankClass = rank <= 3 ? `rank-${rank}` : '';
        let cardClass = rank === 1 ? 'gold-card' : rank === 2 ? 'silver-card' : rank === 3 ? 'bronze-card' : '';
        let rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

        container.innerHTML += `
            <div class="leaderboard-card ${cardClass}" style="animation-delay: ${index * 0.08}s">
                <div class="rank ${rankClass}">${rankDisplay}</div>
                <div class="team-info">
                    <div class="team-name">${team.name}</div>
                </div>
                <div class="team-score">
                    ${team.score}
                    <span class="score-label">Points</span>
                </div>
            </div>
        `;
    });
}

function populateCompetitionDropdown() {
    const select = document.getElementById('comp-filter');
    publishedCompetitions.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

function renderIndividualResults() {
    const compFilter = document.getElementById('comp-filter').value;
    const catFilter = document.getElementById('category-filter').value;
    const batchFilter = document.getElementById('batch-filter').value;
    const searchQuery = document.getElementById('search-participant').value.toLowerCase();
    
    const container = document.getElementById('winners-container');
    container.innerHTML = '';

    let displayedCount = 0;

    for (const [compId, top3] of Object.entries(competitionResults)) {
        // Apply Competition Filter
        if (compFilter && compId !== compFilter) continue;

        top3.forEach((entry, index) => {
            const teamName = allTeams.find(t => t.id === entry.participant.team_id)?.name || 'Independent';
            const catName = entry.competition.categories?.name || '';
            const batchNo = entry.participant.batch_no || '';
            
            // Apply Category, Batch, and Search Filters
            if (catFilter && catName !== catFilter) return;
            if (batchFilter && batchNo.toString() !== batchFilter) return;
            
            const matchesSearch = entry.participant.name.toLowerCase().includes(searchQuery) || 
                                  entry.competition.name.toLowerCase().includes(searchQuery);
            if (searchQuery && !matchesSearch) return;

            displayedCount++;
            const classes = ['gold', 'silver', 'bronze'];
            const labels = ['1st Place', '2nd Place', '3rd Place'];
            
            container.innerHTML += `
                <div class="winner-card ${classes[index] || ''}">
                    <div class="winner-position">${labels[index] || 'Runner Up'} - ${entry.competition.name}</div>
                    <div class="winner-name">${entry.participant.name}</div>
                    <div class="winner-team">${teamName} | Batch ${batchNo}</div>
                    <div class="winner-score-badge">${entry.normalized_points} PTS</div>
                </div>
            `;
        });
    }

    if(displayedCount === 0) {
         container.innerHTML = `<p style="text-align:center; color:var(--text-muted); grid-column: 1/-1; padding: 3rem;">No results match your filters.</p>`;
    }
}

async function downloadAdvancedPosters(type, specificData = null) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Standard template size
    canvas.width = 1080; 
    canvas.height = 1080;
    
    // Simulated fetch of coordinates saved from Master Admin
    const coordinates = await fetchTemplateCoordinatesFromDB(type); 

    // Draw background template image
    const templateImage = new Image();
    templateImage.src = `/templates/${type}_template.jpg`; // Load master admin template
    
    templateImage.onload = () => {
        ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
        ctx.font = "bold 40px Inter";
        ctx.fillStyle = "#ffffff";
        
        if (type === 'individual') {
            ctx.fillText(`Result #${publishedCompetitions.length}`, coordinates.resultNoX, coordinates.resultNoY);
            ctx.fillText(specificData.category, coordinates.categoryX, coordinates.categoryY);
            ctx.fillText(specificData.competition, coordinates.compX, coordinates.compY);
            
            // Loop through top 3 or print 'Available'
            for(let i=0; i<3; i++) {
                let nameText = specificData.winners[i] ? specificData.winners[i].name : "AVAILABLE";
                ctx.fillText(nameText, coordinates[`pos${i+1}X`], coordinates[`pos${i+1}Y`]);
            }
        } 
        else if (type === 'team') {
            if (publishedCompetitions.length % 10 !== 0) {
                showToast("Team posters only generate at multiples of 10 results.", "error");
                return;
            }
            ctx.fillText(`Results after ${publishedCompetitions.length} Events`, coordinates.countTextX, coordinates.countTextY);
            // Draw Team Standings loop...
        } 
        else if (type === 'final') {
            ctx.fillText(`Final Result - ${publishedCompetitions.length} Competitions`, coordinates.finalTextX, coordinates.finalTextY);
            // Draw Final Standings loop...
        }

        // Export
        const link = document.createElement('a');
        link.download = `FestOS_${type}_Poster.jpeg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95); 
        link.click();
    };
}
async function fetchTemplateCoordinatesFromDB(type) {
    // Note: Replace this with an actual Supabase fetch later
    // Default fallback coordinates mapped to standard 1080x1080 canvas
    return {
        resultNoX: 100, resultNoY: 150,
        categoryX: 100, categoryY: 220,
        compX: 100, compY: 300,
        pos1X: 100, pos1Y: 500,
        pos2X: 100, pos2Y: 600,
        pos3X: 100, pos3Y: 700,
        countTextX: 100, countTextY: 150,
        finalTextX: 100, finalTextY: 150
    };
}
// Boot up
fetchAndCalculateResults();