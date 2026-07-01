const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Start live clock
setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString();
}, 1000);

// Set to track announced competitions locally on this device
let announcedList = JSON.parse(localStorage.getItem('announcedComps')) || [];

async function fetchLiveCompetitions() {
    // Fetch competitions that are currently active
    const { data: comps, error } = await supabase
        .from('competitions')
        .select('id, name, status, stages(name)')
        .in('status', ['registration', 'ongoing'])
        .order('status', { ascending: true }); // Prioritize 'registration' over 'ongoing'

    if (error) {
        console.error('Error fetching competitions:', error);
        return;
    }

    renderAnnouncements(comps || []);
}

function renderAnnouncements(comps) {
    const container = document.getElementById('announcement-container');
    container.innerHTML = '';

    if (comps.length === 0) {
        container.innerHTML = `<div class="empty-state">No live competitions require announcements right now.</div>`;
        return;
    }

    comps.forEach(comp => {
        const isAnnounced = announcedList.includes(comp.id);
        const stageName = comp.stages ? comp.stages.name : 'Unknown Stage';
        
        // Format status for display
        let statusDisplay = comp.status === 'registration' 
            ? 'Registration Open' 
            : 'Competition Ongoing';
            
        let buttonHTML = isAnnounced 
            ? `<button class="btn btn-undo" onclick="toggleAnnounced('${comp.id}', false)">Undo</button>`
            : `<button class="btn btn-announce" onclick="toggleAnnounced('${comp.id}', true)">Mark Announced ✓</button>`;

        container.innerHTML += `
            <div class="announcement-card ${isAnnounced ? 'announced' : ''}">
                <div class="comp-details">
                    <div class="comp-status">${statusDisplay}</div>
                    <div class="comp-name">${comp.name}</div>
                    <div class="comp-stage">📍 ${stageName}</div>
                </div>
                <div>
                    ${buttonHTML}
                </div>
            </div>
        `;
    });
}

function toggleAnnounced(compId, isMarkingAnnounced) {
    if (isMarkingAnnounced) {
        if (!announcedList.includes(compId)) {
            announcedList.push(compId);
        }
    } else {
        announcedList = announcedList.filter(id => id !== compId);
    }
    
    // Save to local storage so refreshes don't lose the checklist
    localStorage.setItem('announcedComps', JSON.stringify(announcedList));
    
    // Refresh UI immediately
    fetchLiveCompetitions();
}

// Initial fetch
fetchLiveCompetitions();

// Poll for updates every 10 seconds to catch new competitions automatically
setInterval(fetchLiveCompetitions, 10000);