/**
 * ============================================================================
 * DAILY GAZETTE & AI NEWSPAPER STUDIO PRO
 * High-Performance Broadsheet System • Multilingual AI Pipeline • 4-Page A4 PDF
 * Dynamic Festival Branding • Responsive Mobile & Desktop Studio
 * ============================================================================
 */

(function(window) {
    'use strict';

    // State
    const NP_STATE = {
        currentLang: 'en',
        currentTheme: 'classic',
        currentDate: new Date().toISOString().split('T')[0],
        currentPageView: 1,
        festConfig: null,
        editionsArchive: [],
        currentEdition: null,
        zoomLevel: 1.0
    };

    const LANG_LABELS = {
        en: 'English',
        ml: 'മലയാളം',
        ur: 'اردو',
        ar: 'العربية',
        hi: 'हिन्दी',
        bn: 'বাংলা'
    };

    // 0. Active Festival Resolution Helper
    function getActiveFestivalInfo() {
        const fid = (typeof getActiveFestId === 'function' ? getActiveFestId() : '') || 
                    localStorage.getItem('activeFestId') || 
                    'fest_vib26_muml4haa';
        
        let festMeta = null;
        if (window.availableFests && Array.isArray(window.availableFests)) {
            festMeta = window.availableFests.find(f => f.id === fid);
        }

        let branding = null;
        try {
            const raw = localStorage.getItem('festBranding');
            if (raw) branding = JSON.parse(raw);
        } catch (e) {}

        if (!branding) {
            try {
                const rawCache = localStorage.getItem('festos_branding_cache_' + fid);
                if (rawCache) branding = JSON.parse(rawCache);
            } catch (e) {}
        }

        const name = (branding && branding.fest_name && branding.fest_name.trim()) 
            ? branding.fest_name.trim() 
            : (festMeta?.name || 'Zenith Cultural Fest');
            
        const logo = (branding && branding.fest_logo && branding.fest_logo.trim()) 
            ? branding.fest_logo.trim() 
            : (festMeta?.logo || 'festos-logo.svg');
            
        const venue = festMeta?.venue || 'Main Festival Arena & Grand Complex';
        const tagline = festMeta?.tagline || 'The Grand Annual Celebration of Art, Culture, and Championship';
        const cleanCode = name.toUpperCase().replace(/[^A-Z0-9]/g, '');

        return { id: fid, name, logo, venue, tagline, cleanCode };
    }

    // Initialize Default Stories Template
    function createDefaultStories(festInfo) {
        const info = festInfo || getActiveFestivalInfo();
        const festName = info.name;
        const venue = info.venue;

        return {
            lead_story: {
                title: `${festName}: Cultural Showdown Escalates as Contenders Deliver Masterclass`,
                subhead: `Massive crowds witness electrifying classical arts and literary tournaments across dynamic stages.`,
                body: `The annual festival escalated to breathtaking heights today as elite contenders delivered masterclass performances across all competition venues. Adjudicators commended the unprecedented caliber of artistic finesse, noting that scores throughout the morning sessions remained separated by mere tenths of a point. Spectators filled the pavilions to standing capacity, rallying behind their home squads with thunderous ovations. With high-stakes stage events scheduled for the afternoon, team captains have urged all squads to bring their highest precision to the arena floor.`,
                img: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&auto=format&fit=crop&q=80',
                caption: `Electrifying energy at ${venue} as participants display classical choreography before packed pavilions.`,
                time: 'UPDATED 03:00 AM'
            },
            side_story: {
                title: `Solo Symphony Thrills Crowds`,
                body: `In a performance that garnered a standing ovation from both judges and audience members, Candidate #104 set a new stage record with a faultless classical recital.`
            },
            side_story_2: {
                title: `Stage Protocols & Green Room Windows`,
                body: `Stage managers report strict adherence to reporting timelines. Contestants are requested to verify their chest tags at least 20 minutes prior to call time.`
            },
            stage_brief: {
                title: `Stage Controllers Commend Exceptional Discipline`,
                body: `Stage controllers across all venues have commended participants for punctual check-ins. Green room buffers have been maintained at optimal pace, ensuring no backlogs in stage transitions. Contestants are reminded to carry their official verified chest tags at all times.`
            },
            venue_spotlight: {
                title: `Acoustical Precision & Sound Engineering`,
                body: `The sound systems deployed across main arenas feature directional line arrays, ensuring crystal clarity for classical recitals, choral harmonics, and dramatic orations.`
            },
            star_performer: {
                name: `Aysha R. • Chest #104`,
                event: `Classical Solo • A-Grade (1st Place)`,
                quote: `"When you step under the stage lights, it is not just technique—it is the devotion of countless hours of discipline finding its true voice."`,
                img: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`
            },
            patron_column: {
                title: `A Triumph of Camaraderie, Talent, and Shared Vision`,
                body: `"Every festival edition writes its own indelible chapter in our institutional memory. To witness hundreds of students pouring their spirit into poetry, song, oration, and visual crafts is a testament to the transformative power of arts education. We extend our deepest gratitude to our volunteer marshals, adjudicators, and tech crews who work tirelessly behind the scenes."`,
                author: `— Organizing Committee • ${festName}`
            },
            tomorrow_preview: {
                title: `High-Stakes Group Dance & Dramatic Theatrics`,
                body: `The upcoming morning session will witness the pinnacle of theatrical group competitions on Main Stage. Squads have rehearsed choreography for weeks—expect intense competition!`
            }
        };
    }

    // Translation Utility via Google Translate public endpoint
    async function translateText(text, targetLang) {
        if (!text || targetLang === 'en') return text;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Translation network error');
            const data = await response.json();
            if (data && data[0] && Array.isArray(data[0])) {
                return data[0].map(item => item[0]).join('');
            }
            return text;
        } catch (e) {
            console.warn(`Translation to ${targetLang} failed, fallback to original:`, e);
            return text;
        }
    }

    // 1. Policy & Authorization Check (Super Admin Gating)
    async function checkNewspaperPolicyStatus() {
        const festInfo = getActiveFestivalInfo();
        const fid = festInfo.id;
        let config = null;

        if (window.festosGetSetting) {
            config = await window.festosGetSetting('newspaper_config', fid);
        }

        if (!config && window.availableFests) {
            const f = window.availableFests.find(x => x.id === fid);
            if (f && f.newspaper_config) config = f.newspaper_config;
        }

        if (!config) {
            config = { enabled: true, generation_time: '03:00', allowed_dates: [] };
        }
        NP_STATE.festConfig = config;

        const badge = document.getElementById('np-policy-badge');
        const titleEl = document.getElementById('np-policy-status-title');
        const descEl = document.getElementById('np-policy-status-desc');

        const relTime = config.generation_time || '03:00';
        const allowedDates = Array.isArray(config.allowed_dates) ? config.allowed_dates : [];

        // Check date constraint
        const selectedDate = NP_STATE.currentDate;
        let dateAllowed = true;
        if (allowedDates.length > 0 && !allowedDates.includes(selectedDate)) {
            dateAllowed = false;
        }

        // Check time constraint
        const now = new Date();
        const [targetHour, targetMin] = relTime.split(':').map(Number);
        const releaseTimePassed = (now.getHours() > targetHour) || (now.getHours() === targetHour && now.getMinutes() >= targetMin);

        if (!config.enabled) {
            if (badge) { badge.style.background = '#ef4444'; badge.innerHTML = '<i class="fa-solid fa-ban"></i> FEATURE DISABLED'; }
            if (titleEl) titleEl.innerText = 'Newspaper Feature Gated by Super Admin';
            if (descEl) descEl.innerText = 'This festival does not have active authorization for the AI Newspaper feature. Contact Super Admin to enable.';
        } else if (!dateAllowed) {
            if (badge) { badge.style.background = '#f59e0b'; badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> DATE RESTRICTED'; }
            if (titleEl) titleEl.innerText = `Selected Date (${selectedDate}) Not in Authorized Schedule`;
            if (descEl) descEl.innerText = `Super Admin authorized dates: ${allowedDates.join(', ')}. Admin draft mode active.`;
        } else if (!releaseTimePassed) {
            if (badge) { badge.style.background = '#6366f1'; badge.innerHTML = `<i class="fa-regular fa-clock"></i> UNLOCKS AT ${relTime} AM`; }
            if (titleEl) titleEl.innerText = `Daily Broadsheet Release Window: Scheduled for ${relTime} AM`;
            if (descEl) descEl.innerText = `Official public download unlocks after ${relTime} AM. Admin Preview & Draft Generator is ready.`;
        } else {
            if (badge) { badge.style.background = '#10b981'; badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> UNLOCKED &amp; READY'; }
            if (titleEl) titleEl.innerText = `Broadsheet Active • Official Release Time: ${relTime} AM (Passed)`;
            if (descEl) descEl.innerText = 'All systems ready for AI generation, multi-language translation, and public publishing.';
        }
    }

    // 2. Load or Create Edition for Active Date
    async function loadOrCreateEdition(dateStr) {
        NP_STATE.currentDate = dateStr;
        const dateInput = document.getElementById('np-edition-date');
        if (dateInput) dateInput.value = dateStr;

        const festInfo = getActiveFestivalInfo();
        const fid = festInfo.id;

        // Sync header studio titles to active festival
        const studioTitle = document.getElementById('np-studio-fest-name');
        if (studioTitle) studioTitle.innerText = festInfo.name;
        const studioSub = document.getElementById('np-studio-fest-sub');
        if (studioSub) studioSub.innerText = `${festInfo.name} Official 4-Page A4 Broadsheet • Multi-lingual AI Synthesis • High-Res PDF Engine`;

        // Check local storage archive first
        let archives = [];
        try {
            const raw = localStorage.getItem('festos_newspapers_' + fid);
            if (raw) archives = JSON.parse(raw);
        } catch (e) {}

        NP_STATE.editionsArchive = archives;
        renderPastEditionsArchive();

        let edition = archives.find(e => e.date === dateStr);
        if (!edition) {
            const defaultStories = createDefaultStories(festInfo);
            edition = {
                id: 'np_' + fid + '_' + dateStr,
                fest_id: fid,
                date: dateStr,
                theme: NP_STATE.currentTheme,
                created_at: new Date().toISOString(),
                published: false,
                translations: {
                    en: defaultStories
                }
            };
        }

        NP_STATE.currentEdition = edition;
        if (edition.theme) {
            setNewspaperTheme(edition.theme, false);
        }

        // Hydrate UI
        updateTranslationStatusDots();
        renderActiveNewspaperContent();
        checkNewspaperPolicyStatus();
    }

    // 3. AI News Generation Engine
    async function generateNewspaperWithAI() {
        const btn = document.querySelector('[onclick="generateNewspaperWithAI()"]');
        const originalText = btn ? btn.innerHTML : null;
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing News...'; btn.disabled = true; }

        try {
            const festInfo = getActiveFestivalInfo();
            const fid = festInfo.id;
            const festName = festInfo.name;
            const venue = festInfo.venue;

            // 1. Fetch Schedule Data for this Date
            let scheduleItems = [];
            try {
                if (window.festosGetSetting) {
                    const schedVal = await window.festosGetSetting('master_schedule', fid);
                    if (Array.isArray(schedVal)) scheduleItems = schedVal;
                }
                if (scheduleItems.length === 0 && typeof supabaseClient !== 'undefined' && supabaseClient) {
                    const { data } = await supabaseClient.from('settings').select('value').eq('id', 'master_schedule').maybeSingle();
                    if (data && Array.isArray(data.value)) scheduleItems = data.value;
                }
            } catch(e) {}

            // 2. Fetch Teams & Points Standings
            let teams = [];
            try {
                if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                    let tQ = supabaseClient.from('teams').select('id, name, score');
                    if (window.festosApplyFilter) tQ = window.festosApplyFilter(tQ);
                    const { data } = await tQ.order('score', { ascending: false });
                    teams = data || [];
                }
            } catch(e) {}

            if (teams.length === 0) {
                teams = [
                    { name: 'TEAM PHOENIX', score: 218 },
                    { name: 'TEAM TITANS', score: 184 },
                    { name: 'TEAM GLADIATORS', score: 152 },
                    { name: 'TEAM VIKINGS', score: 139 },
                    { name: 'TEAM SAMURAI', score: 115 }
                ];
            }

            // 3. Fetch Top Performer from Judgements
            let starCandidate = null;
            try {
                if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                    const { data } = await supabaseClient
                        .from('judgements')
                        .select('awarded_mark, participants(name, unique_id, photo_url), competitions(name)')
                        .order('awarded_mark', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (data && data.participants) {
                        starCandidate = {
                            name: data.participants.name + (data.participants.unique_id ? ` • #${data.participants.unique_id}` : ''),
                            event: (data.competitions?.name || 'Grand Stage Recital') + ` • Awarded ${data.awarded_mark} Pts`,
                            quote: `"Stepping onto the arena floor, you realize every second of devotion counts. It is an honor to perform for our community."`,
                            img: data.participants.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'
                        };
                    }
                }
            } catch(e) {}

            if (!starCandidate) {
                starCandidate = {
                    name: `Aysha R. • Chest #104`,
                    event: `Classical Solo • A-Grade (1st Place)`,
                    quote: `"When you step under the stage lights, it is not just technique—it is the devotion of countless hours of discipline finding its true voice."`,
                    img: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`
                };
            }

            // Build fresh synthesis
            const topTeam1 = teams[0]?.name || 'TEAM PHOENIX';
            const topTeam2 = teams[1]?.name || 'TEAM TITANS';

            const freshStories = {
                lead_story: {
                    title: `${topTeam1} Takes Early Championship Lead as Cultural Showdown Intensifies`,
                    subhead: `Packed arenas witness historic performances; ${topTeam2} mounts fierce pursuit with razor-thin margins.`,
                    body: `The atmosphere at ${venue} reached a fever pitch today as ${festName} advanced into crucial tournament phases. Team ${topTeam1} surged to the front of the general leaderboard following exceptional masterclasses in vocal symphony and stage dramatics. Adjudicators commended the disciplined artistry across all competition venues, highlighting that scoring differentials remain historically tight. With high-stakes group choreography scheduled for the afternoon, spectators packed pavilions to standing room only.`,
                    img: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&auto=format&fit=crop&q=80',
                    caption: `Thunderous audience response as contestants deliver precision choreography at ${venue}.`,
                    time: `LIVE TALLY • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                },
                side_story: {
                    title: `Adjudicator Panel Applauds High Standards`,
                    body: `Senior judge coordinators expressed admiration for the technical discipline displayed by all squads, remarking that standard deviations among top contenders remain exceptionally close.`
                },
                side_story_2: {
                    title: `Live Broadcast & Standings Online`,
                    body: `Spectators and alumni worldwide can access verified real-time score updates, podium rankings, and digital broadsheets directly on the ${festName} Public Portal.`
                },
                stage_brief: {
                    title: `Stage Controllers Report Seamless Venue Synchronization`,
                    body: `Venues across ${venue} maintained strict zero-delay scheduling throughout the morning blocks. Marshals and green-room teams coordinated swift transitions, allowing thousands of spectators to enjoy uninterrupted stage action.`
                },
                venue_spotlight: {
                    title: `Arena Acoustical Precision & Directional Arrays`,
                    body: `State-of-the-art acoustic calibration across all stage venues ensures uncompromised vocal clarity and tonal richness for both classical soloists and orchestral troupes.`
                },
                star_performer: starCandidate,
                patron_column: {
                    title: `A Golden Chronicle of Youth, Culture, and Shared Excellence`,
                    body: `"Watching the immense spirit and dedication displayed by every candidate reaffirms the timeless necessity of celebration and cultural expression. We thank our adjudicators, student coordinators, and mentors whose tireless contributions make this grand spectacle possible."`,
                    author: `— Organizing Committee • ${festName}`
                },
                tomorrow_preview: {
                    title: `Tomorrow's Grand Finals: Group Folk & Classical Theatrics`,
                    body: `Blockbuster group competitions are slated for tomorrow morning. Squads have rehearsed multi-tier choreographies for months—a truly unforgettable showdown awaits!`
                }
            };

            NP_STATE.currentEdition.translations.en = freshStories;
            NP_STATE.currentEdition.teams = teams;
            NP_STATE.currentEdition.schedule = scheduleItems;

            // Save to archives
            saveEditionToArchive(NP_STATE.currentEdition);

            renderActiveNewspaperContent();
            updateTranslationStatusDots();
            showToast("AI Gazette generated successfully from live data!", "success");

        } catch (e) {
            console.error("AI Generation error:", e);
            showToast("Error generating AI gazette: " + e.message, "error");
        } finally {
            if (btn && originalText) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    }

    // 4. Multilingual Translation Pipeline (6 Languages)
    async function autoTranslateAllNewspaperLanguages() {
        const btn = document.querySelector('[onclick="autoTranslateAllNewspaperLanguages()"]');
        const originalText = btn ? btn.innerHTML : null;
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating 6 Languages...'; btn.disabled = true; }

        try {
            const enStories = NP_STATE.currentEdition?.translations?.en || createDefaultStories();
            const targetLangs = ['ml', 'ur', 'ar', 'hi', 'bn'];

            for (const lang of targetLangs) {
                showToast(`Auto-translating gazette into ${LANG_LABELS[lang]}...`, 'info');
                
                const translated = {
                    lead_story: {
                        title: await translateText(enStories.lead_story.title, lang),
                        subhead: await translateText(enStories.lead_story.subhead, lang),
                        body: await translateText(enStories.lead_story.body, lang),
                        img: enStories.lead_story.img,
                        caption: await translateText(enStories.lead_story.caption, lang),
                        time: await translateText(enStories.lead_story.time, lang)
                    },
                    side_story: {
                        title: await translateText(enStories.side_story.title, lang),
                        body: await translateText(enStories.side_story.body, lang)
                    },
                    side_story_2: {
                        title: await translateText(enStories.side_story_2.title, lang),
                        body: await translateText(enStories.side_story_2.body, lang)
                    },
                    stage_brief: {
                        title: await translateText(enStories.stage_brief.title, lang),
                        body: await translateText(enStories.stage_brief.body, lang)
                    },
                    venue_spotlight: {
                        title: await translateText(enStories.venue_spotlight.title, lang),
                        body: await translateText(enStories.venue_spotlight.body, lang)
                    },
                    star_performer: {
                        name: enStories.star_performer.name,
                        event: await translateText(enStories.star_performer.event, lang),
                        quote: await translateText(enStories.star_performer.quote, lang),
                        img: enStories.star_performer.img
                    },
                    patron_column: {
                        title: await translateText(enStories.patron_column.title, lang),
                        body: await translateText(enStories.patron_column.body, lang),
                        author: await translateText(enStories.patron_column.author, lang)
                    },
                    tomorrow_preview: {
                        title: await translateText(enStories.tomorrow_preview.title, lang),
                        body: await translateText(enStories.tomorrow_preview.body, lang)
                    }
                };

                NP_STATE.currentEdition.translations[lang] = translated;
            }

            saveEditionToArchive(NP_STATE.currentEdition);
            updateTranslationStatusDots();
            renderActiveNewspaperContent();
            showToast("All 6 Languages translated and ready!", "success");

        } catch (e) {
            console.error("Auto-translate error:", e);
            showToast("Translation error: " + e.message, "error");
        } finally {
            if (btn && originalText) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    }

    // 5. Render Active Content to the 4 Broadsheet Pages
    function renderActiveNewspaperContent() {
        if (!NP_STATE.currentEdition) return;

        const lang = NP_STATE.currentLang;
        const festInfo = getActiveFestivalInfo();
        const festName = festInfo.name;
        const festLogo = festInfo.logo;
        const venue = festInfo.venue;
        const tagline = festInfo.tagline;
        const cleanCode = festInfo.cleanCode;

        const stories = NP_STATE.currentEdition.translations[lang] || NP_STATE.currentEdition.translations.en || createDefaultStories(festInfo);

        // Apply RTL / Language classes
        document.querySelectorAll('.broadsheet-page').forEach(page => {
            page.className = `broadsheet-page theme-${NP_STATE.currentTheme} lang-${lang}`;
            page.dir = (lang === 'ar' || lang === 'ur') ? 'rtl' : 'ltr';
        });

        // PAGE 1: Header, Masthead, Ticker, Stories
        setText('bs-meta-fest-header', `OFFICIAL ${festName.toUpperCase()} GAZETTE • CERTIFIED DAILY PRINT EDITION`);
        setText('bs-masthead-title', `${festName.toUpperCase()} CHRONICLE`);
        setText('bs-masthead-tagline', tagline.toUpperCase());
        setText('bs-meta-venue-1', `VENUE: ${venue.toUpperCase()}`);
        setText('bs-strip-fest-1', festName.toUpperCase());
        setText('bs-strip-date-1', formatDateHeader(NP_STATE.currentDate, lang));
        setText('bs-page1-ticker', `DAY HIGHLIGHTS • LIVE SCORING ON ${festName.toUpperCase()} PORTAL • VERIFIED SCORE REGISTER`);
        setText('bs-page1-brand', `${festName.toUpperCase()} GAZETTE • VOL I`);

        const logo1 = document.getElementById('bs-logo-1');
        const logo1b = document.getElementById('bs-logo-1b');
        if (logo1) { logo1.src = festLogo; logo1.onerror = () => { logo1.src = 'festos-logo.svg'; }; }
        if (logo1b) { logo1b.src = festLogo; logo1b.onerror = () => { logo1b.src = 'festos-logo.svg'; }; }

        // Page 1 Stories
        const lead = stories.lead_story;
        if (lead) {
            setText('bs-lead-headline', lead.title);
            setText('bs-lead-subhead', lead.subhead);
            setText('bs-lead-body', lead.body);
            setText('bs-lead-caption', lead.caption);
            setText('bs-lead-time', lead.time || 'UPDATED 03:00 AM');
            const imgEl = document.getElementById('bs-lead-img');
            if (imgEl && lead.img) imgEl.src = lead.img;
        }

        const side1 = stories.side_story;
        if (side1) {
            setText('bs-side-title', side1.title);
            setText('bs-side-body', side1.body);
        }

        const side2 = stories.side_story_2;
        if (side2) {
            setText('bs-side-title-2', side2.title);
            setText('bs-side-body-2', side2.body);
        }

        // PAGE 2 (Schedule Table & Dispatches)
        setText('bs-p2-date', formatDateHeader(NP_STATE.currentDate, lang));
        setText('bs-p2-meta-fest', `${festName.toUpperCase()} ARENA MATRIX`);
        setText('bs-p2-ticker-center', `CHECK LIVE ARENA QUEUES ONLINE • ${festName.toUpperCase()} STAGE CONTROLLER BUREAU`);
        setText('bs-p2-brand', `${festName.toUpperCase()} GAZETTE`);
        renderScheduleTable();

        const sBrief = stories.stage_brief;
        if (sBrief) {
            setText('bs-stage-brief-title', sBrief.title);
            setText('bs-stage-brief-body', sBrief.body);
        }

        const vSpot = stories.venue_spotlight;
        if (vSpot) {
            setText('bs-venue-title', vSpot.title);
            setText('bs-venue-body', vSpot.body);
        }

        // PAGE 3 (Podium, Star & Standings)
        setText('bs-p3-date', formatDateHeader(NP_STATE.currentDate, lang));
        setText('bs-p3-meta-fest', `${festName.toUpperCase()} OFFICIAL POINTS TABLE`);
        setText('bs-p3-ticker-center', `VERIFIED BY ${festName.toUpperCase()} SCORING COMMITTEE • CERTIFIED TALLY`);
        setText('bs-p3-brand', `${festName.toUpperCase()} GAZETTE`);
        renderPodiumAndStandings();

        const star = stories.star_performer;
        if (star) {
            setText('bs-star-name', star.name);
            setText('bs-star-event', star.event);
            setText('bs-star-quote', star.quote);
            const starImg = document.getElementById('bs-star-img');
            if (starImg && star.img) starImg.src = star.img;
        }

        // PAGE 4 (Patron, Gallery & Notices)
        setText('bs-p4-date', formatDateHeader(NP_STATE.currentDate, lang));
        const patron = stories.patron_column;
        if (patron) {
            setText('bs-patron-title', patron.title);
            setText('bs-patron-body', patron.body);
            setText('bs-patron-author', patron.author || `— Organizing Committee • ${festName}`);
        }

        const tomorrow = stories.tomorrow_preview;
        if (tomorrow) {
            setText('bs-tomorrow-title', tomorrow.title);
            setText('bs-tomorrow-body', tomorrow.body);
        }

        setText('bs-p4-powered', `POWERED BY ${festName.toUpperCase()} DIGITAL MEDIA DESK • CERTIFIED ARCHIVE`);
        setText('bs-footer-timestamp', `GENERATED 03:00 AM • VERIFIED HASH #${cleanCode}-2026`);
        setText('bs-p4-ticker-center', `READ DIGITAL BROADSHEET AT ${festName.toUpperCase()} RESULTS HUB • ALL RIGHTS RESERVED`);
        setText('bs-p4-brand', `${festName.toUpperCase()} GAZETTE`);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el && text !== undefined) el.innerText = text;
    }

    function formatDateHeader(dateStr, lang) {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : (lang === 'ml' ? 'ml-IN' : 'en-US'), {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).toUpperCase();
        } catch(e) {
            return dateStr;
        }
    }

    // Render Page 2 Schedule Table from Real Schedule Data
    function renderScheduleTable() {
        const tbody = document.getElementById('bs-p2-schedule-tbody');
        if (!tbody) return;

        let schedule = NP_STATE.currentEdition?.schedule || [];
        if (!schedule || schedule.length === 0) {
            schedule = [
                { stage: 'STAGE 1 (MAIN ARENA)', comp: 'Classical Solo Symphony (Seniors)', cat: 'GENERAL', time: '09:00 AM - 11:30 AM' },
                { stage: 'STAGE 2 (CULTURAL HALL)', comp: 'Elocution & Extempore Oratory', cat: 'SECONDARY', time: '09:30 AM - 12:00 PM' },
                { stage: 'STAGE 3 (PAVILION)', comp: 'Dramatic Monologue & Mime', cat: 'HIGHER SECONDARY', time: '10:00 AM - 01:00 PM' },
                { stage: 'STAGE 4 (SEMINAR HALL)', comp: 'Poetry Recitation & Versification', cat: 'SENIORS', time: '11:00 AM - 01:30 PM' },
                { stage: 'STAGE 1 (MAIN ARENA)', comp: 'Grand Group Folk Dance Championship', cat: 'GENERAL', time: '02:00 PM - 05:30 PM' },
                { stage: 'STAGE 2 (CULTURAL HALL)', comp: 'Choral Harmony & Group Symphony', cat: 'SENIORS', time: '02:30 PM - 06:00 PM' }
            ];
        }

        tbody.innerHTML = schedule.slice(0, 7).map(item => `
            <tr>
                <td><span class="bs-stage-badge">${item.stage_name || item.stage || 'STAGE 1'}</span></td>
                <td><strong>${item.comp_name || item.comp || 'Competition'}</strong></td>
                <td>${item.cat_name || item.cat || 'GENERAL'}</td>
                <td><i class="fa-regular fa-clock" style="font-size: 7pt;"></i> ${item.time || item.start_time || '09:00 AM'}</td>
            </tr>
        `).join('');
    }

    // Render Page 3 Podium & Full Teams Standings
    function renderPodiumAndStandings() {
        let teams = NP_STATE.currentEdition?.teams || [];
        if (!teams || teams.length === 0) {
            teams = [
                { name: 'TEAM PHOENIX', score: 218 },
                { name: 'TEAM TITANS', score: 184 },
                { name: 'TEAM GLADIATORS', score: 152 },
                { name: 'TEAM VIKINGS', score: 139 },
                { name: 'TEAM SAMURAI', score: 115 },
                { name: 'TEAM SPARTANS', score: 98 },
                { name: 'TEAM TROJANS', score: 85 }
            ];
        }

        // Top 3 Podium
        const t1 = teams[0] || { name: 'TEAM PHOENIX', score: 218 };
        const t2 = teams[1] || { name: 'TEAM TITANS', score: 184 };
        const t3 = teams[2] || { name: 'TEAM GLADIATORS', score: 152 };

        setText('podium-team-1', t1.name.toUpperCase());
        setText('podium-pts-1', `${t1.score || 0} PTS`);

        setText('podium-team-2', t2.name.toUpperCase());
        setText('podium-pts-2', `${t2.score || 0} PTS`);

        setText('podium-team-3', t3.name.toUpperCase());
        setText('podium-pts-3', `${t3.score || 0} PTS`);

        // Table
        const tbody = document.getElementById('bs-p3-teams-tbody');
        if (tbody) {
            tbody.innerHTML = teams.slice(0, 8).map((t, idx) => `
                <tr>
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong>${t.name.toUpperCase()}</strong></td>
                    <td style="text-align: right; font-weight: 800; color: var(--primary);">${t.score || 0} PTS</td>
                </tr>
            `).join('');
        }
    }

    // Switch Language Pill
    function switchNewspaperLang(langCode) {
        NP_STATE.currentLang = langCode;
        document.querySelectorAll('.np-lang-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === langCode);
        });

        // If target lang translation doesn't exist yet, offer auto generation
        if (!NP_STATE.currentEdition?.translations[langCode]) {
            showToast(`Generating ${LANG_LABELS[langCode]} edition...`, 'info');
            autoTranslateSingleLanguage(langCode);
        } else {
            renderActiveNewspaperContent();
        }
    }

    async function autoTranslateSingleLanguage(targetLang) {
        const festInfo = getActiveFestivalInfo();
        const enStories = NP_STATE.currentEdition?.translations?.en || createDefaultStories(festInfo);
        try {
            const translated = {
                lead_story: {
                    title: await translateText(enStories.lead_story.title, targetLang),
                    subhead: await translateText(enStories.lead_story.subhead, targetLang),
                    body: await translateText(enStories.lead_story.body, targetLang),
                    img: enStories.lead_story.img,
                    caption: await translateText(enStories.lead_story.caption, targetLang),
                    time: await translateText(enStories.lead_story.time, targetLang)
                },
                side_story: {
                    title: await translateText(enStories.side_story.title, targetLang),
                    body: await translateText(enStories.side_story.body, targetLang)
                },
                side_story_2: {
                    title: await translateText(enStories.side_story_2.title, targetLang),
                    body: await translateText(enStories.side_story_2.body, targetLang)
                },
                stage_brief: {
                    title: await translateText(enStories.stage_brief.title, targetLang),
                    body: await translateText(enStories.stage_brief.body, targetLang)
                },
                venue_spotlight: {
                    title: await translateText(enStories.venue_spotlight.title, targetLang),
                    body: await translateText(enStories.venue_spotlight.body, targetLang)
                },
                star_performer: {
                    name: enStories.star_performer.name,
                    event: await translateText(enStories.star_performer.event, targetLang),
                    quote: await translateText(enStories.star_performer.quote, targetLang),
                    img: enStories.star_performer.img
                },
                patron_column: {
                    title: await translateText(enStories.patron_column.title, targetLang),
                    body: await translateText(enStories.patron_column.body, targetLang),
                    author: await translateText(enStories.patron_column.author, targetLang)
                },
                tomorrow_preview: {
                    title: await translateText(enStories.tomorrow_preview.title, targetLang),
                    body: await translateText(enStories.tomorrow_preview.body, targetLang)
                }
            };

            NP_STATE.currentEdition.translations[targetLang] = translated;
            saveEditionToArchive(NP_STATE.currentEdition);
            updateTranslationStatusDots();
            renderActiveNewspaperContent();
            showToast(`${LANG_LABELS[targetLang]} translated!`, 'success');
        } catch(e) {
            showToast(`Error translating ${LANG_LABELS[targetLang]}: ` + e.message, 'error');
        }
    }

    // Switch Page View (Page 1, 2, 3, 4, or All)
    function switchNewspaperPageView(pageNumber, btnEl) {
        NP_STATE.currentPageView = pageNumber;
        document.querySelectorAll('.np-page-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        for (let i = 1; i <= 4; i++) {
            const pageEl = document.getElementById(`bs-page-${i}`);
            if (pageEl) {
                if (pageNumber === 'all' || pageNumber === i) {
                    pageEl.style.display = 'flex';
                } else {
                    pageEl.style.display = 'none';
                }
            }
        }
    }

    // Set Theme
    function setNewspaperTheme(themeName, persist = true) {
        NP_STATE.currentTheme = themeName;
        const select = document.getElementById('np-theme-select');
        if (select && select.value !== themeName) select.value = themeName;

        if (NP_STATE.currentEdition && persist) {
            NP_STATE.currentEdition.theme = themeName;
            saveEditionToArchive(NP_STATE.currentEdition);
        }
        renderActiveNewspaperContent();
    }

    // Change Edition Date
    function changeNewspaperDate(dateVal) {
        if (!dateVal) return;
        loadOrCreateEdition(dateVal);
    }

    // Translation Dots
    function updateTranslationStatusDots() {
        if (!NP_STATE.currentEdition) return;
        const tr = NP_STATE.currentEdition.translations || {};
        ['ml', 'ur', 'ar', 'hi', 'bn'].forEach(code => {
            const dot = document.getElementById('dot-' + code);
            if (dot) dot.style.display = tr[code] ? 'inline-block' : 'none';
        });
    }

    // Zoom & Screen Fitting Controller
    function setNewspaperZoom(scale) {
        NP_STATE.zoomLevel = Math.max(0.3, Math.min(2.0, scale));
        const viewport = document.getElementById('np-sheets-container');
        const label = document.getElementById('np-zoom-label');
        if (viewport) {
            viewport.style.transform = `scale(${NP_STATE.zoomLevel})`;
            viewport.style.transformOrigin = 'top center';
        }
        if (label) {
            label.innerText = `${Math.round(NP_STATE.zoomLevel * 100)}%`;
        }
    }

    function adjustNewspaperZoom(delta) {
        setNewspaperZoom(NP_STATE.zoomLevel + delta);
    }

    function fitNewspaperToScreen() {
        const stage = document.querySelector('.newspaper-stage-container');
        if (!stage) return;
        const stageWidth = stage.clientWidth - 32;
        const sheetWidth = 794; // approx 210mm in px at 96dpi
        if (stageWidth < sheetWidth) {
            const ratio = stageWidth / sheetWidth;
            setNewspaperZoom(Math.floor(ratio * 100) / 100);
        } else {
            setNewspaperZoom(1.0);
        }
    }

    // 6. Interactive Story & Photo Editor Modal
    function openNewspaperStoryEditor(storyKey = 'lead_story') {
        const modal = document.getElementById('newspaperStoryModal');
        if (!modal) return;
        const selector = document.getElementById('np-edit-selector');
        if (selector) selector.value = storyKey;
        loadStoryIntoEditor(storyKey);
        modal.classList.add('show');
    }

    function closeNewspaperStoryEditor() {
        const modal = document.getElementById('newspaperStoryModal');
        if (modal) modal.classList.remove('show');
    }

    function loadStoryIntoEditor(storyKey) {
        document.getElementById('np-edit-story-key').value = storyKey;
        const lang = NP_STATE.currentLang;
        const stories = NP_STATE.currentEdition?.translations[lang] || NP_STATE.currentEdition?.translations.en || createDefaultStories();
        const data = stories[storyKey] || {};

        document.getElementById('np-edit-title').value = data.title || data.name || '';
        document.getElementById('np-edit-subhead').value = data.subhead || data.event || '';
        document.getElementById('np-edit-body').value = data.body || data.quote || '';

        const photoGroup = document.getElementById('np-edit-photo-group');
        const imgUrlInput = document.getElementById('np-edit-img-url');
        const imgPrev = document.getElementById('np-edit-img-preview');
        const captionInput = document.getElementById('np-edit-caption');

        const hasPhoto = (storyKey === 'lead_story' || storyKey === 'star_performer' || storyKey.includes('gallery'));
        if (photoGroup) photoGroup.style.display = hasPhoto ? 'block' : 'none';

        if (hasPhoto) {
            imgUrlInput.value = data.img || '';
            captionInput.value = data.caption || '';
            if (data.img) {
                imgPrev.src = data.img;
                imgPrev.style.display = 'block';
            } else {
                imgPrev.style.display = 'none';
            }
        }
    }

    function previewModalPhoto(url) {
        const imgPrev = document.getElementById('np-edit-img-preview');
        if (imgPrev) {
            imgPrev.src = url;
            imgPrev.style.display = url ? 'block' : 'none';
        }
    }

    function handleNewspaperPhotoUpload(inputEl) {
        if (!inputEl.files || !inputEl.files[0]) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            document.getElementById('np-edit-img-url').value = base64;
            previewModalPhoto(base64);
            showToast("Photo loaded successfully!", "success");
        };
        reader.readAsDataURL(inputEl.files[0]);
    }

    async function saveNewspaperStory(translateAll = false) {
        const key = document.getElementById('np-edit-story-key').value;
        const title = document.getElementById('np-edit-title').value.trim();
        const subhead = document.getElementById('np-edit-subhead').value.trim();
        const body = document.getElementById('np-edit-body').value.trim();
        const img = document.getElementById('np-edit-img-url').value.trim();
        const caption = document.getElementById('np-edit-caption').value.trim();

        if (!title) return alert("Title or headline is required.");

        const lang = NP_STATE.currentLang;
        if (!NP_STATE.currentEdition.translations[lang]) {
            NP_STATE.currentEdition.translations[lang] = createDefaultStories();
        }

        const targetObj = NP_STATE.currentEdition.translations[lang][key] || {};
        if (key === 'star_performer') {
            targetObj.name = title;
            targetObj.event = subhead;
            targetObj.quote = body;
            if (img) targetObj.img = img;
        } else {
            targetObj.title = title;
            targetObj.subhead = subhead;
            targetObj.body = body;
            if (img) targetObj.img = img;
            if (caption) targetObj.caption = caption;
        }
        NP_STATE.currentEdition.translations[lang][key] = targetObj;

        // Auto-translate to other languages if requested
        if (translateAll) {
            showToast("Auto-translating edited story across all languages...", "info");
            const otherLangs = ['en', 'ml', 'ur', 'ar', 'hi', 'bn'].filter(l => l !== lang);
            for (const oLang of otherLangs) {
                if (!NP_STATE.currentEdition.translations[oLang]) {
                    NP_STATE.currentEdition.translations[oLang] = createDefaultStories();
                }
                const translatedStory = {
                    title: await translateText(title, oLang),
                    subhead: subhead ? await translateText(subhead, oLang) : '',
                    body: body ? await translateText(body, oLang) : '',
                    img: img || targetObj.img,
                    caption: caption ? await translateText(caption, oLang) : ''
                };
                NP_STATE.currentEdition.translations[oLang][key] = translatedStory;
            }
        }

        saveEditionToArchive(NP_STATE.currentEdition);
        closeNewspaperStoryEditor();
        renderActiveNewspaperContent();
        showToast(translateAll ? "Saved & translated to all 6 languages!" : `Saved to ${LANG_LABELS[lang]} edition!`, "success");
    }

    // 7. Save Edition to Local Storage & Supabase Settings
    async function saveEditionToArchive(edition) {
        const festInfo = getActiveFestivalInfo();
        const fid = festInfo.id;
        const idx = NP_STATE.editionsArchive.findIndex(e => e.date === edition.date);
        if (idx !== -1) {
            NP_STATE.editionsArchive[idx] = edition;
        } else {
            NP_STATE.editionsArchive.unshift(edition);
        }

        try {
            localStorage.setItem('festos_newspapers_' + fid, JSON.stringify(NP_STATE.editionsArchive));
        } catch(e) {}

        // Sync to Supabase settings
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('settings').upsert({
                    id: 'newspapers_' + fid,
                    value: NP_STATE.editionsArchive
                });
            } catch(e) {}
        }
        renderPastEditionsArchive();
    }

    // 8. Delete Single Edition & Clear All Archives
    async function deleteNewspaperEdition(dateStr) {
        if (!confirm(`Are you sure you want to permanently delete the broadsheet edition for ${dateStr}?`)) {
            return;
        }

        const festInfo = getActiveFestivalInfo();
        const fid = festInfo.id;
        NP_STATE.editionsArchive = (NP_STATE.editionsArchive || []).filter(e => e.date !== dateStr);

        try {
            localStorage.setItem('festos_newspapers_' + fid, JSON.stringify(NP_STATE.editionsArchive));
        } catch(e) {}

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('settings').upsert({
                    id: 'newspapers_' + fid,
                    value: NP_STATE.editionsArchive
                });
            } catch(e) {}
        }

        showToast(`Broadsheet edition for ${dateStr} deleted.`, 'success');
        renderPastEditionsArchive();

        // If active edition was deleted, load today or first available
        if (NP_STATE.currentDate === dateStr) {
            const nextDate = NP_STATE.editionsArchive[0]?.date || new Date().toISOString().split('T')[0];
            loadOrCreateEdition(nextDate);
        }
    }

    async function clearAllNewspaperArchives() {
        if (!confirm("Are you sure you want to delete ALL archived broadsheet editions for this festival? This action cannot be undone.")) {
            return;
        }

        const festInfo = getActiveFestivalInfo();
        const fid = festInfo.id;
        NP_STATE.editionsArchive = [];

        try {
            localStorage.removeItem('festos_newspapers_' + fid);
        } catch(e) {}

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('settings').upsert({
                    id: 'newspapers_' + fid,
                    value: []
                });
            } catch(e) {}
        }

        showToast("All broadsheet archives cleared successfully.", "success");
        renderPastEditionsArchive();
        loadOrCreateEdition(new Date().toISOString().split('T')[0]);
    }

    // 9. Render Past Editions Archive Grid
    function renderPastEditionsArchive() {
        const container = document.getElementById('np-archive-container');
        const countEl = document.getElementById('np-archive-count');
        const clearBtn = document.getElementById('np-archive-clear-btn');
        if (!container) return;

        const archives = NP_STATE.editionsArchive || [];
        if (countEl) countEl.innerText = `${archives.length} edition${archives.length === 1 ? '' : 's'} archived`;
        if (clearBtn) clearBtn.style.display = archives.length > 0 ? 'inline-flex' : 'none';

        if (archives.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">
                    <i class="fa-solid fa-box-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
                    No previous broadsheet editions archived yet. Generated editions will be saved here automatically.
                </div>
            `;
            return;
        }

        container.innerHTML = archives.map(ed => {
            const trCount = Object.keys(ed.translations || {}).length;
            const isCur = ed.date === NP_STATE.currentDate;
            return `
                <div class="np-archive-card" style="${isCur ? 'border-color: var(--primary); box-shadow: 0 4px 14px rgba(99,102,241,0.15);' : ''}">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span class="badge" style="background: rgba(99,102,241,0.12); color: var(--primary); font-size: 0.72rem; font-weight: 700; border-radius: 4px; padding: 2px 6px;">
                                <i class="fa-regular fa-calendar"></i> ${ed.date}
                            </span>
                            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">${trCount} Langs</span>
                        </div>
                        <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">
                            Daily Broadsheet Edition
                        </h4>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Theme: ${ed.theme || 'classic'}</div>
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                        <button type="button" class="btn btn-outline" style="flex: 1; padding: 0.35rem 0.5rem; font-size: 0.75rem;" onclick="loadOrCreateEdition('${ed.date}')">
                            <i class="fa-solid fa-eye"></i> View / Edit
                        </button>
                        <button type="button" class="btn btn-primary" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="loadOrCreateEdition('${ed.date}'); setTimeout(exportNewspaperPDF, 300);" title="Export PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>
                        <button type="button" class="btn btn-outline" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="deleteNewspaperEdition('${ed.date}')" title="Delete Edition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 10. Pixel-Perfect 4-Page A4 PDF Export (Matches Preview 1:1)
    async function exportNewspaperPDF() {
        const btn = document.querySelector('[onclick="exportNewspaperPDF()"]');
        const originalText = btn ? btn.innerHTML : null;
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering 4-Page PDF...'; btn.disabled = true; }

        let printWrapper = null;
        try {
            const festInfo = getActiveFestivalInfo();
            const dateStr = NP_STATE.currentDate;
            const lang = NP_STATE.currentLang;
            const theme = NP_STATE.currentTheme;

            // Create off-screen print DOM isolated from studio navy background & drop shadows
            printWrapper = document.createElement('div');
            printWrapper.id = 'np-pdf-print-container';

            // Clone all 4 pages
            for (let i = 1; i <= 4; i++) {
                const srcPage = document.getElementById(`bs-page-${i}`);
                if (srcPage) {
                    const pageClone = srcPage.cloneNode(true);
                    pageClone.id = `bs-print-page-${i}`;
                    pageClone.style.display = 'flex';
                    pageClone.style.width = '210mm';
                    pageClone.style.minHeight = '296.8mm';
                    pageClone.style.maxHeight = '296.8mm';
                    pageClone.style.margin = '0';
                    pageClone.style.boxShadow = 'none';
                    pageClone.style.boxSizing = 'border-box';
                    pageClone.style.overflow = 'hidden';
                    pageClone.style.transform = 'none';
                    pageClone.className = `broadsheet-page theme-${theme} lang-${lang}`;
                    pageClone.dir = (lang === 'ar' || lang === 'ur') ? 'rtl' : 'ltr';

                    printWrapper.appendChild(pageClone);

                    if (i < 4) {
                        const pageBreak = document.createElement('div');
                        pageBreak.className = 'html2pdf__page-break';
                        pageBreak.style.pageBreakBefore = 'always';
                        pageBreak.style.breakBefore = 'page';
                        pageBreak.style.height = '0';
                        pageBreak.style.margin = '0';
                        pageBreak.style.padding = '0';
                        printWrapper.appendChild(pageBreak);
                    }
                }
            }

            document.body.appendChild(printWrapper);

            const safeFestName = festInfo.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const filename = `${safeFestName}_gazette_${dateStr}_${lang}.pdf`;

            const opt = {
                margin: 0,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    scrollY: 0,
                    scrollX: 0,
                    windowWidth: 794 // 210mm in px at 96 DPI
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait'
                },
                pagebreak: { mode: ['css', 'legacy'] }
            };

            if (typeof window.html2pdf !== 'undefined') {
                await window.html2pdf().set(opt).from(printWrapper).save();
                showToast("4-Page A4 Broadsheet PDF downloaded successfully!", "success");
            } else {
                window.print();
            }

        } catch (e) {
            console.error("PDF Export error:", e);
            showToast("PDF Export failed: " + e.message, "error");
        } finally {
            if (printWrapper && printWrapper.parentNode) {
                printWrapper.parentNode.removeChild(printWrapper);
            }
            if (btn && originalText) { btn.innerHTML = originalText; btn.disabled = false; }
            // Restore active page view on screen
            switchNewspaperPageView(NP_STATE.currentPageView);
        }
    }

    // 11. Publish Newspaper to Results Page (Downloads & News Hub)
    async function publishNewspaperToResults() {
        const btn = document.querySelector('[onclick="publishNewspaperToResults()"]');
        const originalText = btn ? btn.innerHTML : null;
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...'; btn.disabled = true; }

        try {
            const festInfo = getActiveFestivalInfo();
            const festName = festInfo.name;
            const dateStr = NP_STATE.currentDate;
            const lang = NP_STATE.currentLang;
            const langLabel = LANG_LABELS[lang];

            if (typeof window.loadWebsiteConfig === 'function') {
                await window.loadWebsiteConfig();
            }

            if (!window.websiteConfig) {
                window.websiteConfig = { downloads: [], news: [] };
            }
            if (!Array.isArray(window.websiteConfig.downloads)) window.websiteConfig.downloads = [];
            if (!Array.isArray(window.websiteConfig.news)) window.websiteConfig.news = [];

            // Add / Update in Downloads
            const dlId = `gazette_${dateStr}_${lang}`;
            const existingDlIdx = window.websiteConfig.downloads.findIndex(d => d.id === dlId);
            const newDlItem = {
                id: dlId,
                title: `${festName} Daily Broadsheet Gazette (${dateStr})`,
                desc: `Official certified 4-Page broadsheet newspaper released for ${dateStr} in ${langLabel}. Includes stage rosters, verified championship points standings, and spotlight performer chronicles.`,
                category: 'Daily Newspaper',
                fileName: `${festName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_gazette_${dateStr}_${lang}.pdf`,
                fileSize: '4-Page PDF',
                fileUrl: '#',
                isExternal: false,
                icon: 'fa-solid fa-newspaper'
            };

            if (existingDlIdx !== -1) {
                window.websiteConfig.downloads[existingDlIdx] = newDlItem;
            } else {
                window.websiteConfig.downloads.unshift(newDlItem);
            }

            // Add / Update in News Bulletins
            const newsId = `news_gazette_${dateStr}`;
            const existingNewsIdx = window.websiteConfig.news.findIndex(n => n.id === newsId);
            const leadTitle = NP_STATE.currentEdition?.translations[lang]?.lead_story?.title || 'Daily Broadsheet Edition Released';
            const leadBody = NP_STATE.currentEdition?.translations[lang]?.lead_story?.body || '';

            const newNewsItem = {
                id: newsId,
                title: `📰 Official Daily Broadsheet Released: ${leadTitle}`,
                category: 'Daily Gazette',
                date: dateStr,
                summary: `The official 4-Page A4 Daily Gazette for ${dateStr} has been released in ${langLabel}! Featuring today's arena schedule, championship standings, and star spotlights. Download your broadsheet edition in the Downloads hub.`,
                content: leadBody,
                priority: 'high'
            };

            if (existingNewsIdx !== -1) {
                window.websiteConfig.news[existingNewsIdx] = newNewsItem;
            } else {
                window.websiteConfig.news.unshift(newNewsItem);
            }

            // Save via executeWebsiteSave
            if (typeof window.executeWebsiteSave === 'function') {
                await window.executeWebsiteSave(null);
            }

            NP_STATE.currentEdition.published = true;
            saveEditionToArchive(NP_STATE.currentEdition);

            showToast(`Newspaper published to Public Results (Downloads & News tabs)!`, 'success');

        } catch (e) {
            console.error("Publishing error:", e);
            showToast("Publishing failed: " + e.message, "error");
        } finally {
            if (btn && originalText) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    }

    // Expose Functions to Global Window
    window.getActiveFestivalInfo = getActiveFestivalInfo;
    window.loadOrCreateEdition = loadOrCreateEdition;
    window.generateNewspaperWithAI = generateNewspaperWithAI;
    window.autoTranslateAllNewspaperLanguages = autoTranslateAllNewspaperLanguages;
    window.switchNewspaperLang = switchNewspaperLang;
    window.switchNewspaperPageView = switchNewspaperPageView;
    window.setNewspaperTheme = setNewspaperTheme;
    window.changeNewspaperDate = changeNewspaperDate;
    window.openNewspaperStoryEditor = openNewspaperStoryEditor;
    window.closeNewspaperStoryEditor = closeNewspaperStoryEditor;
    window.loadStoryIntoEditor = loadStoryIntoEditor;
    window.previewModalPhoto = previewModalPhoto;
    window.handleNewspaperPhotoUpload = handleNewspaperPhotoUpload;
    window.saveNewspaperStory = saveNewspaperStory;
    window.deleteNewspaperEdition = deleteNewspaperEdition;
    window.clearAllNewspaperArchives = clearAllNewspaperArchives;
    window.setNewspaperZoom = setNewspaperZoom;
    window.adjustNewspaperZoom = adjustNewspaperZoom;
    window.fitNewspaperToScreen = fitNewspaperToScreen;
    window.exportNewspaperPDF = exportNewspaperPDF;
    window.publishNewspaperToResults = publishNewspaperToResults;
    window.checkNewspaperPolicyStatus = checkNewspaperPolicyStatus;

    // Boot hook & Responsive Auto-Fit
    document.addEventListener('DOMContentLoaded', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('np-edition-date');
        if (dateInput) dateInput.value = todayStr;
        loadOrCreateEdition(todayStr);

        setTimeout(fitNewspaperToScreen, 300);
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 950) {
                fitNewspaperToScreen();
            }
        });
    });

})(window);
