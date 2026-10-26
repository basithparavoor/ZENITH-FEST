/**
 * ============================================================================
 * DAILY GAZETTE & AI NEWSPAPER STUDIO PRO
 * High-Performance Broadsheet System • Multilingual AI Pipeline • 4-Page A4 PDF
 * Fully Customizable Headers, Footers, Fonts, Sizes, Colors & Editorial Layout
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
        zoomLevel: 1.0,
        currentModalTab: 'header'
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

    // Default Theme Styles Factory
    function getDefaultCustomStyle(theme = 'classic') {
        const themes = {
            classic: {
                fontMasthead: "'Playfair Display', serif",
                fontHeadline: "'Playfair Display', serif",
                fontBody: "'Newsreader', serif",
                sizeMasthead: '27pt',
                sizeHeadline: '19pt',
                sizeBody: '8pt',
                inkColor: '#1a1a1a',
                accentColor: '#881337',
                bgColor: '#fbf9f4',
                borderColor: '#1a1a1a'
            },
            royal: {
                fontMasthead: "'Cinzel', serif",
                fontHeadline: "'Cinzel', serif",
                fontBody: "'Newsreader', serif",
                sizeMasthead: '28pt',
                sizeHeadline: '20pt',
                sizeBody: '8pt',
                inkColor: '#2b1e16',
                accentColor: '#b45309',
                bgColor: '#fdfaf6',
                borderColor: '#b45309'
            },
            modern: {
                fontMasthead: "'Inter', sans-serif",
                fontHeadline: "'Inter', sans-serif",
                fontBody: "'Inter', system-ui, sans-serif",
                sizeMasthead: '26pt',
                sizeHeadline: '18pt',
                sizeBody: '8pt',
                inkColor: '#0f172a',
                accentColor: '#2563eb',
                bgColor: '#ffffff',
                borderColor: '#cbd5e1'
            },
            emerald: {
                fontMasthead: "'Cinzel', serif",
                fontHeadline: "'Cinzel', serif",
                fontBody: "'Newsreader', serif",
                sizeMasthead: '28pt',
                sizeHeadline: '19pt',
                sizeBody: '8pt',
                inkColor: '#0d2818',
                accentColor: '#047857',
                bgColor: '#f9fbf9',
                borderColor: '#047857'
            }
        };
        return Object.assign({}, themes[theme] || themes.classic);
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
                tag: 'BULLETIN',
                title: `Solo Symphony Thrills Crowds`,
                body: `In a performance that garnered a standing ovation from both judges and audience members, Candidate #104 set a new stage record with a faultless classical recital.`
            },
            side_story_2: {
                tag: 'FLASH NOTICE',
                title: `Stage Protocols & Green Room Windows`,
                body: `Stage managers report strict adherence to reporting timelines. Contestants are requested to verify their chest tags at least 20 minutes prior to call time.`
            },
            stage_brief: {
                tag: 'DISPATCH FROM STAGE CONTROLLER',
                title: `Stage Controllers Commend Exceptional Discipline`,
                body: `Stage controllers across all venues have commended participants for punctual check-ins. Green room buffers have been maintained at optimal pace, ensuring no backlogs in stage transitions. Contestants are reminded to carry their official verified chest tags at all times.`
            },
            venue_spotlight: {
                tag: 'VENUE SPOTLIGHT',
                title: `Arena Acoustical Precision & Sound Engineering`,
                body: `The sound systems deployed across main arenas feature directional line arrays, ensuring crystal clarity for classical recitals, choral harmonics, and dramatic orations.`
            },
            star_performer: {
                name: `Aysha R. • Chest #104`,
                event: `Classical Solo • A-Grade (1st Place)`,
                quote: `"When you step under the stage lights, it is not just technique—it is the devotion of countless hours of discipline finding its true voice."`,
                img: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80`
            },
            patron_column: {
                tag: "DIRECTOR'S NOTE",
                title: `A Triumph of Camaraderie, Talent, and Shared Vision`,
                body: `"Every festival edition writes its own indelible chapter in our institutional memory. To witness hundreds of students pouring their spirit into poetry, song, oration, and visual crafts is a testament to the transformative power of arts education. We extend our deepest gratitude to our volunteer marshals, adjudicators, and tech crews who work tirelessly behind the scenes."`,
                author: `— Organizing Committee • ${festName}`
            },
            tomorrow_preview: {
                tag: "TOMORROW'S CURTAIN RAISER",
                title: `High-Stakes Group Dance & Dramatic Theatrics`,
                body: `The upcoming morning session will witness the pinnacle of theatrical group competitions on Main Stage. Squads have rehearsed choreography for weeks—expect intense competition!`
            }
        };
    }

    // Translation Utility via Google Translate
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
            const defaultStyles = getDefaultCustomStyle(NP_STATE.currentTheme);
            edition = {
                id: 'np_' + fid + '_' + dateStr,
                fest_id: fid,
                date: dateStr,
                theme: NP_STATE.currentTheme,
                created_at: new Date().toISOString(),
                published: false,
                customStyle: defaultStyles,
                branding: {
                    mastheadTitle: `${festInfo.name.toUpperCase()} CHRONICLE`,
                    mastheadTagline: festInfo.tagline.toUpperCase(),
                    topHeader: `OFFICIAL ${festInfo.name.toUpperCase()} GAZETTE • DAILY CERTIFIED PRINT EDITION`,
                    volIssue: 'VOLUME I • ISSUE 02',
                    venue: festInfo.venue.toUpperCase(),
                    stripEdition: 'SPECIAL MORNING EDITION',
                    stripFest: festInfo.name.toUpperCase(),
                    logo1: festInfo.logo,
                    logo2: festInfo.logo
                },
                footers: {
                    p1Ticker: `DAY HIGHLIGHTS • LIVE SCORING ON ${festInfo.name.toUpperCase()} PORTAL • CERTIFIED TALLY`,
                    p1Brand: `${festInfo.name.toUpperCase()} GAZETTE • VOL I`,
                    p2Title: `Today's Stage Timetable & Roster`,
                    p2Sub: `Verified event schedule across all official competition arenas.`,
                    p2Meta: `${festInfo.name.toUpperCase()} ARENA MATRIX`,
                    p2Ticker: `CHECK LIVE ARENA QUEUES ONLINE • ${festInfo.name.toUpperCase()} STAGE CONTROLLER BUREAU`,
                    p2Brand: `${festInfo.name.toUpperCase()} GAZETTE`,
                    p3Meta: `${festInfo.name.toUpperCase()} OFFICIAL POINTS TABLE`,
                    p3Ticker: `VERIFIED BY ${festInfo.name.toUpperCase()} SCORING COMMITTEE • CERTIFIED TALLY`,
                    p3Brand: `${festInfo.name.toUpperCase()} GAZETTE`,
                    p4Powered: `POWERED BY ${festInfo.name.toUpperCase()} DIGITAL MEDIA DESK • CERTIFIED ARCHIVE`,
                    p4Timestamp: `GENERATED 03:00 AM • VERIFIED HASH #${festInfo.cleanCode}-2026`,
                    p4Ticker: `READ DIGITAL BROADSHEET AT ${festInfo.name.toUpperCase()} RESULTS HUB • ALL RIGHTS RESERVED`,
                    p4Brand: `${festInfo.name.toUpperCase()} GAZETTE`
                },
                translations: {
                    en: defaultStories
                }
            };
        }

        if (!edition.customStyle) edition.customStyle = getDefaultCustomStyle(edition.theme || 'classic');
        if (!edition.branding) edition.branding = {};
        if (!edition.footers) edition.footers = {};

        NP_STATE.currentEdition = edition;
        if (edition.theme) {
            setNewspaperTheme(edition.theme, false);
        }

        // Apply Custom Styles to Broadsheet Preview
        applyCustomStylesToDOM(edition.customStyle);

        // Hydrate UI
        updateTranslationStatusDots();
        renderActiveNewspaperContent();
        checkNewspaperPolicyStatus();
    }

    // Apply Dynamic Styling Variables to Broadsheet Pages
    function applyCustomStylesToDOM(styles, rootContainer = null) {
        if (!styles) return;
        const selector = rootContainer ? rootContainer.querySelectorAll('.broadsheet-page') : document.querySelectorAll('.broadsheet-page');
        selector.forEach(page => {
            if (styles.bgColor) page.style.setProperty('--bs-custom-bg', styles.bgColor);
            if (styles.inkColor) page.style.setProperty('--bs-custom-ink', styles.inkColor);
            if (styles.accentColor) page.style.setProperty('--bs-custom-accent', styles.accentColor);
            if (styles.borderColor) page.style.setProperty('--bs-custom-border', styles.borderColor);
            if (styles.fontMasthead) page.style.setProperty('--bs-font-masthead', styles.fontMasthead);
            if (styles.fontHeadline) page.style.setProperty('--bs-font-headline', styles.fontHeadline);
            if (styles.fontBody) page.style.setProperty('--bs-font-body', styles.fontBody);
            if (styles.sizeMasthead) page.style.setProperty('--bs-size-masthead', styles.sizeMasthead);
            if (styles.sizeHeadline) page.style.setProperty('--bs-size-headline', styles.sizeHeadline);
            if (styles.sizeBody) page.style.setProperty('--bs-size-body', styles.sizeBody);
        });
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

            // 1. Fetch Schedule Data
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
                    tag: 'BULLETIN',
                    title: `Adjudicator Panel Applauds High Standards`,
                    body: `Senior judge coordinators expressed admiration for the technical discipline displayed by all squads, remarking that standard deviations among top contenders remain exceptionally close.`
                },
                side_story_2: {
                    tag: 'FLASH NOTICE',
                    title: `Live Broadcast & Standings Online`,
                    body: `Spectators and alumni worldwide can access verified real-time score updates, podium rankings, and digital broadsheets directly on the ${festName} Public Portal.`
                },
                stage_brief: {
                    tag: 'DISPATCH FROM STAGE CONTROLLER',
                    title: `Stage Controllers Report Seamless Venue Synchronization`,
                    body: `Venues across ${venue} maintained strict zero-delay scheduling throughout the morning blocks. Marshals and green-room teams coordinated swift transitions, allowing thousands of spectators to enjoy uninterrupted stage action.`
                },
                venue_spotlight: {
                    tag: 'VENUE SPOTLIGHT',
                    title: `Arena Acoustical Precision & Directional Arrays`,
                    body: `State-of-the-art acoustic calibration across all stage venues ensures uncompromised vocal clarity and tonal richness for both classical soloists and orchestral troupes.`
                },
                star_performer: starCandidate,
                patron_column: {
                    tag: "DIRECTOR'S NOTE",
                    title: `A Golden Chronicle of Youth, Culture, and Shared Excellence`,
                    body: `"Watching the immense spirit and dedication displayed by every candidate reaffirms the timeless necessity of celebration and cultural expression. We thank our adjudicators, student coordinators, and mentors whose tireless contributions make this grand spectacle possible."`,
                    author: `— Organizing Committee • ${festName}`
                },
                tomorrow_preview: {
                    tag: "TOMORROW'S CURTAIN RAISER",
                    title: `Tomorrow's Grand Finals: Group Folk & Classical Theatrics`,
                    body: `Blockbuster group competitions are slated for tomorrow morning. Squads have rehearsed multi-tier choreographies for months—a truly unforgettable showdown awaits!`
                }
            };

            NP_STATE.currentEdition.translations.en = freshStories;
            NP_STATE.currentEdition.teams = teams;
            NP_STATE.currentEdition.schedule = scheduleItems;

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
                        tag: await translateText(enStories.side_story?.tag || 'BULLETIN', lang),
                        title: await translateText(enStories.side_story.title, lang),
                        body: await translateText(enStories.side_story.body, lang)
                    },
                    side_story_2: {
                        tag: await translateText(enStories.side_story_2?.tag || 'FLASH NOTICE', lang),
                        title: await translateText(enStories.side_story_2.title, lang),
                        body: await translateText(enStories.side_story_2.body, lang)
                    },
                    stage_brief: {
                        tag: await translateText(enStories.stage_brief?.tag || 'DISPATCH FROM STAGE CONTROLLER', lang),
                        title: await translateText(enStories.stage_brief.title, lang),
                        body: await translateText(enStories.stage_brief.body, lang)
                    },
                    venue_spotlight: {
                        tag: await translateText(enStories.venue_spotlight?.tag || 'VENUE SPOTLIGHT', lang),
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
                        tag: await translateText(enStories.patron_column?.tag || "DIRECTOR'S NOTE", lang),
                        title: await translateText(enStories.patron_column.title, lang),
                        body: await translateText(enStories.patron_column.body, lang),
                        author: await translateText(enStories.patron_column.author, lang)
                    },
                    tomorrow_preview: {
                        tag: await translateText(enStories.tomorrow_preview?.tag || "TOMORROW'S CURTAIN RAISER", lang),
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
        const ed = NP_STATE.currentEdition;
        const b = ed.branding || {};
        const f = ed.footers || {};

        const stories = ed.translations[lang] || ed.translations.en || createDefaultStories(festInfo);

        // Apply RTL / Language classes
        document.querySelectorAll('.broadsheet-page').forEach(page => {
            page.className = `broadsheet-page theme-${NP_STATE.currentTheme} lang-${lang}`;
            page.dir = (lang === 'ar' || lang === 'ur') ? 'rtl' : 'ltr';
        });

        // Apply dynamic custom typography, colors and sizes
        applyCustomStylesToDOM(ed.customStyle);

        // PAGE 1: Header, Masthead, Ticker, Stories
        setText('bs-meta-fest-header', b.topHeader || `OFFICIAL ${festInfo.name.toUpperCase()} GAZETTE • CERTIFIED DAILY PRINT EDITION`);
        setText('bs-masthead-title', b.mastheadTitle || `${festInfo.name.toUpperCase()} CHRONICLE`);
        setText('bs-masthead-tagline', b.mastheadTagline || festInfo.tagline.toUpperCase());
        setText('bs-meta-vol-1', b.volIssue || 'VOLUME I • ISSUE 02');
        setText('bs-meta-venue-1', b.venue ? `VENUE: ${b.venue.toUpperCase()}` : `VENUE: ${festInfo.venue.toUpperCase()}`);
        setText('bs-strip-edition-1', b.stripEdition || 'SPECIAL MORNING EDITION');
        setText('bs-strip-fest-1', b.stripFest || festInfo.name.toUpperCase());
        setText('bs-strip-date-1', formatDateHeader(NP_STATE.currentDate, lang));
        
        setText('bs-page1-ticker', f.p1Ticker || `DAY HIGHLIGHTS • LIVE SCORING ON ${festInfo.name.toUpperCase()} PORTAL • VERIFIED SCORE REGISTER`);
        setText('bs-page1-brand', f.p1Brand || `${festInfo.name.toUpperCase()} GAZETTE • VOL I`);

        const logo1 = document.getElementById('bs-logo-1');
        const logo1b = document.getElementById('bs-logo-1b');
        const logo1Src = b.logo1 || festInfo.logo;
        const logo2Src = b.logo2 || festInfo.logo;
        if (logo1) { logo1.src = logo1Src; logo1.onerror = () => { logo1.src = 'festos-logo.svg'; }; }
        if (logo1b) { logo1b.src = logo2Src; logo1b.onerror = () => { logo1b.src = 'festos-logo.svg'; }; }

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
        setText('bs-p2-title', f.p2Title || `Today's Stage Timetable & Roster`);
        setText('bs-p2-sub', f.p2Sub || `Verified event schedule across all official competition arenas.`);
        setText('bs-p2-meta-fest', f.p2Meta || `${festInfo.name.toUpperCase()} ARENA MATRIX`);
        setText('bs-p2-ticker-center', f.p2Ticker || `CHECK LIVE ARENA QUEUES ONLINE • ${festInfo.name.toUpperCase()} STAGE CONTROLLER BUREAU`);
        setText('bs-p2-brand', f.p2Brand || `${festInfo.name.toUpperCase()} GAZETTE`);
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
        setText('bs-p3-meta-fest', f.p3Meta || `${festInfo.name.toUpperCase()} OFFICIAL POINTS TABLE`);
        setText('bs-p3-ticker-center', f.p3Ticker || `VERIFIED BY ${festInfo.name.toUpperCase()} SCORING COMMITTEE • CERTIFIED TALLY`);
        setText('bs-p3-brand', f.p3Brand || `${festInfo.name.toUpperCase()} GAZETTE`);
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
            setText('bs-patron-author', patron.author || `— Organizing Committee • ${festInfo.name}`);
        }

        // Gallery Photos
        if (b.gallery1) { const g1 = document.getElementById('bs-gallery-img-1'); if (g1) g1.src = b.gallery1; }
        if (b.gallery2) { const g2 = document.getElementById('bs-gallery-img-2'); if (g2) g2.src = b.gallery2; }
        if (b.gallery3) { const g3 = document.getElementById('bs-gallery-img-3'); if (g3) g3.src = b.gallery3; }

        const tomorrow = stories.tomorrow_preview;
        if (tomorrow) {
            setText('bs-tomorrow-title', tomorrow.title);
            setText('bs-tomorrow-body', tomorrow.body);
        }

        setText('bs-p4-powered', f.p4Powered || `POWERED BY ${festInfo.name.toUpperCase()} DIGITAL MEDIA DESK • CERTIFIED ARCHIVE`);
        setText('bs-footer-timestamp', f.p4Timestamp || `GENERATED 03:00 AM • VERIFIED HASH #${festInfo.cleanCode}-2026`);
        setText('bs-p4-ticker-center', f.p4Ticker || `READ DIGITAL BROADSHEET AT ${festInfo.name.toUpperCase()} RESULTS HUB • ALL RIGHTS RESERVED`);
        setText('bs-p4-brand', f.p4Brand || `${festInfo.name.toUpperCase()} GAZETTE`);
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

    // Render Page 2 Schedule Table
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

        const b = NP_STATE.currentEdition?.branding || {};

        // Top 3 Podium (Respects custom overrides if provided)
        const t1 = { name: b.podiumTeam1 || teams[0]?.name || 'TEAM PHOENIX', score: b.podiumPts1 || `${teams[0]?.score || 218} PTS` };
        const t2 = { name: b.podiumTeam2 || teams[1]?.name || 'TEAM TITANS', score: b.podiumPts2 || `${teams[1]?.score || 184} PTS` };
        const t3 = { name: b.podiumTeam3 || teams[2]?.name || 'TEAM GLADIATORS', score: b.podiumPts3 || `${teams[2]?.score || 152} PTS` };

        setText('podium-team-1', t1.name.toUpperCase());
        setText('podium-pts-1', String(t1.score).includes('PTS') ? t1.score : `${t1.score} PTS`);

        setText('podium-team-2', t2.name.toUpperCase());
        setText('podium-pts-2', String(t2.score).includes('PTS') ? t2.score : `${t2.score} PTS`);

        setText('podium-team-3', t3.name.toUpperCase());
        setText('podium-pts-3', String(t3.score).includes('PTS') ? t3.score : `${t3.score} PTS`);

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
                    tag: await translateText(enStories.side_story?.tag || 'BULLETIN', targetLang),
                    title: await translateText(enStories.side_story.title, targetLang),
                    body: await translateText(enStories.side_story.body, targetLang)
                },
                side_story_2: {
                    tag: await translateText(enStories.side_story_2?.tag || 'FLASH NOTICE', targetLang),
                    title: await translateText(enStories.side_story_2.title, targetLang),
                    body: await translateText(enStories.side_story_2.body, targetLang)
                },
                stage_brief: {
                    tag: await translateText(enStories.stage_brief?.tag || 'DISPATCH FROM STAGE CONTROLLER', targetLang),
                    title: await translateText(enStories.stage_brief.title, targetLang),
                    body: await translateText(enStories.stage_brief.body, targetLang)
                },
                venue_spotlight: {
                    tag: await translateText(enStories.venue_spotlight?.tag || 'VENUE SPOTLIGHT', targetLang),
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
                    tag: await translateText(enStories.patron_column?.tag || "DIRECTOR'S NOTE", targetLang),
                    title: await translateText(enStories.patron_column.title, targetLang),
                    body: await translateText(enStories.patron_column.body, targetLang),
                    author: await translateText(enStories.patron_column.author, targetLang)
                },
                tomorrow_preview: {
                    tag: await translateText(enStories.tomorrow_preview?.tag || "TOMORROW'S CURTAIN RAISER", targetLang),
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

        if (NP_STATE.currentEdition) {
            NP_STATE.currentEdition.theme = themeName;
            // Also apply theme's preset custom styles if not overridden
            NP_STATE.currentEdition.customStyle = getDefaultCustomStyle(themeName);
            if (persist) saveEditionToArchive(NP_STATE.currentEdition);
        }
        renderActiveNewspaperContent();
    }

    function changeNewspaperDate(dateVal) {
        if (!dateVal) return;
        loadOrCreateEdition(dateVal);
    }

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
        const sheetWidth = 794;
        if (stageWidth < sheetWidth) {
            const ratio = stageWidth / sheetWidth;
            setNewspaperZoom(Math.floor(ratio * 100) / 100);
        } else {
            setNewspaperZoom(1.0);
        }
    }

    // =========================================================================
    // 6. ULTRA-PREMIUM GAZETTE CUSTOMIZER MODAL CONTROLLER
    // =========================================================================
    function switchNpModalTab(tabId, btnEl) {
        NP_STATE.currentModalTab = tabId;
        document.querySelectorAll('.np-modal-tab-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        document.querySelectorAll('.np-tab-pane').forEach(p => p.classList.remove('active'));
        const activePane = document.getElementById(`np-pane-${tabId}`);
        if (activePane) activePane.classList.add('active');
    }

    function openNewspaperStoryEditor(initialTab = 'header', storyKey = 'lead_story') {
        const modal = document.getElementById('newspaperStoryModal');
        if (!modal) return;

        const ed = NP_STATE.currentEdition;
        if (!ed) return;

        const festInfo = getActiveFestivalInfo();
        const lang = NP_STATE.currentLang;
        const stories = ed.translations[lang] || ed.translations.en || createDefaultStories(festInfo);
        const b = ed.branding || {};
        const f = ed.footers || {};
        const s = ed.customStyle || getDefaultCustomStyle(ed.theme);

        // Badge
        const badge = document.getElementById('np-modal-edition-badge');
        if (badge) badge.innerHTML = `<i class="fa-regular fa-calendar"></i> ${ed.date} (${LANG_LABELS[lang]})`;

        // Tab 1: Header & Masthead
        setVal('np-cust-masthead-title', b.mastheadTitle || `${festInfo.name.toUpperCase()} CHRONICLE`);
        setVal('np-cust-masthead-tagline', b.mastheadTagline || festInfo.tagline.toUpperCase());
        setVal('np-cust-top-header', b.topHeader || `OFFICIAL ${festInfo.name.toUpperCase()} GAZETTE • DAILY CERTIFIED PRINT EDITION`);
        setVal('np-cust-vol-issue', b.volIssue || 'VOLUME I • ISSUE 02');
        setVal('np-cust-venue', b.venue || festInfo.venue.toUpperCase());
        setVal('np-cust-strip-edition', b.stripEdition || 'SPECIAL MORNING EDITION');
        setVal('np-cust-strip-fest', b.stripFest || festInfo.name.toUpperCase());
        setVal('np-cust-logo-1', b.logo1 || festInfo.logo);
        setVal('np-cust-logo-2', b.logo2 || festInfo.logo);

        // Tab 2: Page 1 Stories
        const selector = document.getElementById('np-edit-selector');
        if (selector) selector.value = storyKey;
        loadStoryIntoEditor(storyKey);

        // Tab 3: Page 2 Arena Dispatch
        setVal('np-cust-p2-title', f.p2Title || `Today's Stage Timetable & Roster`);
        setVal('np-cust-p2-sub', f.p2Sub || `Verified event schedule across all official competition arenas.`);
        setVal('np-cust-stage-brief-title', stories.stage_brief?.title || '');
        setVal('np-cust-stage-brief-body', stories.stage_brief?.body || '');
        setVal('np-cust-venue-title', stories.venue_spotlight?.title || '');
        setVal('np-cust-venue-body', stories.venue_spotlight?.body || '');

        // Tab 4: Page 3 Standings & Stars
        setVal('np-cust-star-name', stories.star_performer?.name || '');
        setVal('np-cust-star-event', stories.star_performer?.event || '');
        setVal('np-cust-star-quote', stories.star_performer?.quote || '');
        setVal('np-cust-star-img', stories.star_performer?.img || '');
        setVal('np-cust-podium-team-1', b.podiumTeam1 || 'TEAM PHOENIX');
        setVal('np-cust-podium-pts-1', b.podiumPts1 || '218 PTS');
        setVal('np-cust-podium-team-2', b.podiumTeam2 || 'TEAM TITANS');
        setVal('np-cust-podium-pts-2', b.podiumPts2 || '184 PTS');
        setVal('np-cust-podium-team-3', b.podiumTeam3 || 'TEAM GLADIATORS');
        setVal('np-cust-podium-pts-3', b.podiumPts3 || '152 PTS');

        // Tab 5: Page 4 Cultural Chronicles
        setVal('np-cust-patron-title', stories.patron_column?.title || '');
        setVal('np-cust-patron-author', stories.patron_column?.author || '');
        setVal('np-cust-patron-body', stories.patron_column?.body || '');
        setVal('np-cust-gallery-1', b.gallery1 || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80');
        setVal('np-cust-gallery-2', b.gallery2 || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=80');
        setVal('np-cust-gallery-3', b.gallery3 || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=500&auto=format&fit=crop&q=80');
        setVal('np-cust-tomorrow-title', stories.tomorrow_preview?.title || '');
        setVal('np-cust-tomorrow-body', stories.tomorrow_preview?.body || '');

        // Tab 6: Footers & Tickers
        setVal('np-cust-p1-ticker', f.p1Ticker || `DAY HIGHLIGHTS • LIVE SCORING ON ${festInfo.name.toUpperCase()} PORTAL`);
        setVal('np-cust-p1-brand', f.p1Brand || `${festInfo.name.toUpperCase()} GAZETTE • VOL I`);
        setVal('np-cust-p2-ticker', f.p2Ticker || `CHECK REAL-TIME STAGE QUEUES ONLINE • STAGE CONTROLLER BUREAU`);
        setVal('np-cust-p2-brand', f.p2Brand || `${festInfo.name.toUpperCase()} GAZETTE`);
        setVal('np-cust-p3-ticker', f.p3Ticker || `VERIFIED BY THE MASTER SCORING COMMITTEE • CERTIFIED TALLY`);
        setVal('np-cust-p3-brand', f.p3Brand || `${festInfo.name.toUpperCase()} GAZETTE`);
        setVal('np-cust-p4-powered', f.p4Powered || `POWERED BY ${festInfo.name.toUpperCase()} DIGITAL MEDIA DESK • CERTIFIED ARCHIVE`);
        setVal('np-cust-p4-timestamp', f.p4Timestamp || `GENERATED 03:00 AM • VERIFIED CERTIFIED HASH`);

        // Tab 7: Typography & Styles
        setVal('np-cust-font-masthead', s.fontMasthead || "'Playfair Display', serif");
        setVal('np-cust-font-headline', s.fontHeadline || "'Playfair Display', serif");
        setVal('np-cust-font-body', s.fontBody || "'Newsreader', serif");

        const mSize = parseInt(s.sizeMasthead || '27', 10);
        const hSize = parseInt(s.sizeHeadline || '19', 10);
        const bSize = parseFloat(s.sizeBody || '8');
        setVal('np-slider-masthead', mSize);
        setVal('np-slider-headline', hSize);
        setVal('np-slider-body', bSize);
        setText('np-label-size-masthead', mSize + 'pt');
        setText('np-label-size-headline', hSize + 'pt');
        setText('np-label-size-body', bSize + 'pt');

        setVal('np-cust-ink-picker', s.inkColor || '#111111');
        setVal('np-cust-ink-hex', s.inkColor || '#111111');
        setVal('np-cust-accent-picker', s.accentColor || '#881337');
        setVal('np-cust-accent-hex', s.accentColor || '#881337');
        setVal('np-cust-bg-picker', s.bgColor || '#fbf9f4');
        setVal('np-cust-bg-hex', s.bgColor || '#fbf9f4');
        setVal('np-cust-border-picker', s.borderColor || '#1a1a1a');
        setVal('np-cust-border-hex', s.borderColor || '#1a1a1a');

        // Switch to chosen tab
        const tabBtn = document.querySelector(`.np-modal-tab-btn[onclick*="'${initialTab}'"]`) || document.querySelector('.np-modal-tab-btn');
        switchNpModalTab(initialTab, tabBtn);

        modal.classList.add('show');
    }

    function closeNewspaperStoryEditor() {
        const modal = document.getElementById('newspaperStoryModal');
        if (modal) modal.classList.remove('show');
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    }

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function loadStoryIntoEditor(storyKey) {
        document.getElementById('np-edit-story-key').value = storyKey;
        const lang = NP_STATE.currentLang;
        const stories = NP_STATE.currentEdition?.translations[lang] || NP_STATE.currentEdition?.translations.en || createDefaultStories();
        const data = stories[storyKey] || {};

        setVal('np-edit-title', data.title || data.name || '');
        setVal('np-edit-subhead', data.subhead || data.event || '');
        setVal('np-edit-body', data.body || data.quote || '');

        const photoGroup = document.getElementById('np-edit-photo-group');
        const imgUrlInput = document.getElementById('np-edit-img-url');
        const imgPrev = document.getElementById('np-edit-img-preview');
        const captionInput = document.getElementById('np-edit-caption');

        const hasPhoto = (storyKey === 'lead_story');
        if (photoGroup) photoGroup.style.display = hasPhoto ? 'block' : 'none';

        if (hasPhoto) {
            setVal('np-edit-img-url', data.img || '');
            setVal('np-edit-caption', data.caption || '');
            if (data.img && imgPrev) {
                imgPrev.src = data.img;
                imgPrev.style.display = 'block';
            } else if (imgPrev) {
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
            setVal('np-edit-img-url', base64);
            previewModalPhoto(base64);
            showToast("Photo loaded successfully!", "success");
        };
        reader.readAsDataURL(inputEl.files[0]);
    }

    function handleNewspaperLogoUpload(inputEl, targetInputId) {
        if (!inputEl.files || !inputEl.files[0]) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            setVal(targetInputId, base64);
            if (targetInputId === 'np-cust-logo-1') {
                const l1 = document.getElementById('bs-logo-1');
                if (l1) l1.src = base64;
            } else {
                const l2 = document.getElementById('bs-logo-1b');
                if (l2) l2.src = base64;
            }
            showToast("Logo updated successfully!", "success");
        };
        reader.readAsDataURL(inputEl.files[0]);
    }

    function handleNewspaperPhotoUploadDirect(inputEl, targetInputId, targetImgId) {
        if (!inputEl.files || !inputEl.files[0]) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            setVal(targetInputId, base64);
            const imgEl = document.getElementById(targetImgId);
            if (imgEl) imgEl.src = base64;
            showToast("Photo updated!", "success");
        };
        reader.readAsDataURL(inputEl.files[0]);
    }

    // Live Synchronizer from Modal to Broadsheet Preview
    function liveUpdateBroadsheet(key, value) {
        switch (key) {
            case 'masthead-title': setText('bs-masthead-title', value); break;
            case 'masthead-tagline': setText('bs-masthead-tagline', value); break;
            case 'top-header': setText('bs-meta-fest-header', value); break;
            case 'vol-issue': setText('bs-meta-vol-1', value); break;
            case 'venue': setText('bs-meta-venue-1', `VENUE: ${value.toUpperCase()}`); break;
            case 'strip-edition': setText('bs-strip-edition-1', value); break;
            case 'strip-fest': setText('bs-strip-fest-1', value); break;
            case 'logo-1': { const l1 = document.getElementById('bs-logo-1'); if (l1) l1.src = value; } break;
            case 'logo-2': { const l2 = document.getElementById('bs-logo-1b'); if (l2) l2.src = value; } break;

            case 'p2-title': setText('bs-p2-title', value); break;
            case 'p2-sub': setText('bs-p2-sub', value); break;
            case 'stage-brief-title': setText('bs-stage-brief-title', value); break;
            case 'stage-brief-body': setText('bs-stage-brief-body', value); break;
            case 'venue-title': setText('bs-venue-title', value); break;
            case 'venue-body': setText('bs-venue-body', value); break;

            case 'star-name': setText('bs-star-name', value); break;
            case 'star-event': setText('bs-star-event', value); break;
            case 'star-quote': setText('bs-star-quote', value); break;
            case 'star-img': { const img = document.getElementById('bs-star-img'); if (img) img.src = value; } break;
            case 'podium-team-1': setText('podium-team-1', value.toUpperCase()); break;
            case 'podium-pts-1': setText('podium-pts-1', value.toUpperCase()); break;
            case 'podium-team-2': setText('podium-team-2', value.toUpperCase()); break;
            case 'podium-pts-2': setText('podium-pts-2', value.toUpperCase()); break;
            case 'podium-team-3': setText('podium-team-3', value.toUpperCase()); break;
            case 'podium-pts-3': setText('podium-pts-3', value.toUpperCase()); break;

            case 'patron-title': setText('bs-patron-title', value); break;
            case 'patron-author': setText('bs-patron-author', value); break;
            case 'patron-body': setText('bs-patron-body', value); break;
            case 'gallery-1': { const g1 = document.getElementById('bs-gallery-img-1'); if (g1) g1.src = value; } break;
            case 'gallery-2': { const g2 = document.getElementById('bs-gallery-img-2'); if (g2) g2.src = value; } break;
            case 'gallery-3': { const g3 = document.getElementById('bs-gallery-img-3'); if (g3) g3.src = value; } break;
            case 'tomorrow-title': setText('bs-tomorrow-title', value); break;
            case 'tomorrow-body': setText('bs-tomorrow-body', value); break;

            case 'p1-ticker': setText('bs-page1-ticker', value); break;
            case 'p1-brand': setText('bs-page1-brand', value); break;
            case 'p2-ticker': setText('bs-p2-ticker-center', value); break;
            case 'p2-brand': setText('bs-p2-brand', value); break;
            case 'p3-ticker': setText('bs-p3-ticker-center', value); break;
            case 'p3-brand': setText('bs-p3-brand', value); break;
            case 'p4-powered': setText('bs-p4-powered', value); break;
            case 'p4-timestamp': setText('bs-footer-timestamp', value); break;
        }
    }

    // Live Style Customizer Controller
    function liveUpdateStyle(styleKey, value) {
        if (!NP_STATE.currentEdition.customStyle) {
            NP_STATE.currentEdition.customStyle = getDefaultCustomStyle(NP_STATE.currentEdition.theme);
        }
        const s = NP_STATE.currentEdition.customStyle;

        switch (styleKey) {
            case 'font-masthead': s.fontMasthead = value; break;
            case 'font-headline': s.fontHeadline = value; break;
            case 'font-body': s.fontBody = value; break;
            case 'size-masthead':
                s.sizeMasthead = value;
                setText('np-label-size-masthead', value);
                break;
            case 'size-headline':
                s.sizeHeadline = value;
                setText('np-label-size-headline', value);
                break;
            case 'size-body':
                s.sizeBody = value;
                setText('np-label-size-body', value);
                break;
            case 'ink':
                s.inkColor = value;
                setVal('np-cust-ink-picker', value);
                setVal('np-cust-ink-hex', value);
                break;
            case 'accent':
                s.accentColor = value;
                setVal('np-cust-accent-picker', value);
                setVal('np-cust-accent-hex', value);
                break;
            case 'bg':
                s.bgColor = value;
                setVal('np-cust-bg-picker', value);
                setVal('np-cust-bg-hex', value);
                break;
            case 'border':
                s.borderColor = value;
                setVal('np-cust-border-picker', value);
                setVal('np-cust-border-hex', value);
                break;
        }

        applyCustomStylesToDOM(s);
    }

    function applyPresetTheme(themeName, btnEl) {
        document.querySelectorAll('.np-preset-card').forEach(c => c.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        const preset = getDefaultCustomStyle(themeName);
        NP_STATE.currentEdition.customStyle = preset;
        NP_STATE.currentTheme = themeName;
        NP_STATE.currentEdition.theme = themeName;

        setVal('np-cust-font-masthead', preset.fontMasthead);
        setVal('np-cust-font-headline', preset.fontHeadline);
        setVal('np-cust-font-body', preset.fontBody);

        const mSize = parseInt(preset.sizeMasthead, 10);
        const hSize = parseInt(preset.sizeHeadline, 10);
        const bSize = parseFloat(preset.sizeBody);
        setVal('np-slider-masthead', mSize);
        setVal('np-slider-headline', hSize);
        setVal('np-slider-body', bSize);
        setText('np-label-size-masthead', mSize + 'pt');
        setText('np-label-size-headline', hSize + 'pt');
        setText('np-label-size-body', bSize + 'pt');

        setVal('np-cust-ink-picker', preset.inkColor);
        setVal('np-cust-ink-hex', preset.inkColor);
        setVal('np-cust-accent-picker', preset.accentColor);
        setVal('np-cust-accent-hex', preset.accentColor);
        setVal('np-cust-bg-picker', preset.bgColor);
        setVal('np-cust-bg-hex', preset.bgColor);
        setVal('np-cust-border-picker', preset.borderColor);
        setVal('np-cust-border-hex', preset.borderColor);

        applyCustomStylesToDOM(preset);
        showToast(`Theme preset applied: ${themeName.toUpperCase()}`, 'info');
    }

    function resetBroadsheetToDefaults() {
        if (!confirm("Reset all broadsheet titles, footers, typography and styling back to festival defaults?")) return;
        const festInfo = getActiveFestivalInfo();
        const defaultStories = createDefaultStories(festInfo);
        const defaultStyles = getDefaultCustomStyle('classic');

        NP_STATE.currentEdition.translations[NP_STATE.currentLang] = defaultStories;
        NP_STATE.currentEdition.customStyle = defaultStyles;
        NP_STATE.currentEdition.branding = {};
        NP_STATE.currentEdition.footers = {};

        saveEditionToArchive(NP_STATE.currentEdition);
        loadOrCreateEdition(NP_STATE.currentDate);
        closeNewspaperStoryEditor();
        showToast("Broadsheet restored to defaults!", "success");
    }

    // Save All Customizations (From All Tabs)
    async function saveAllNewspaperCustomizations(translateAll = false) {
        const ed = NP_STATE.currentEdition;
        if (!ed) return;
        const lang = NP_STATE.currentLang;

        if (!ed.translations[lang]) {
            ed.translations[lang] = createDefaultStories();
        }
        const stories = ed.translations[lang];

        // 1. Save Branding
        ed.branding = {
            mastheadTitle: getVal('np-cust-masthead-title'),
            mastheadTagline: getVal('np-cust-masthead-tagline'),
            topHeader: getVal('np-cust-top-header'),
            volIssue: getVal('np-cust-vol-issue'),
            venue: getVal('np-cust-venue'),
            stripEdition: getVal('np-cust-strip-edition'),
            stripFest: getVal('np-cust-strip-fest'),
            logo1: getVal('np-cust-logo-1'),
            logo2: getVal('np-cust-logo-2'),
            gallery1: getVal('np-cust-gallery-1'),
            gallery2: getVal('np-cust-gallery-2'),
            gallery3: getVal('np-cust-gallery-3'),
            podiumTeam1: getVal('np-cust-podium-team-1'),
            podiumPts1: getVal('np-cust-podium-pts-1'),
            podiumTeam2: getVal('np-cust-podium-team-2'),
            podiumPts2: getVal('np-cust-podium-pts-2'),
            podiumTeam3: getVal('np-cust-podium-team-3'),
            podiumPts3: getVal('np-cust-podium-pts-3')
        };

        // 2. Save Footers
        ed.footers = {
            p1Ticker: getVal('np-cust-p1-ticker'),
            p1Brand: getVal('np-cust-p1-brand'),
            p2Title: getVal('np-cust-p2-title'),
            p2Sub: getVal('np-cust-p2-sub'),
            p2Ticker: getVal('np-cust-p2-ticker'),
            p2Brand: getVal('np-cust-p2-brand'),
            p3Ticker: getVal('np-cust-p3-ticker'),
            p3Brand: getVal('np-cust-p3-brand'),
            p4Powered: getVal('np-cust-p4-powered'),
            p4Timestamp: getVal('np-cust-p4-timestamp')
        };

        // 3. Save Active Page 1 Story
        const activeKey = document.getElementById('np-edit-story-key').value;
        const sTitle = getVal('np-edit-title');
        const sSubhead = getVal('np-edit-subhead');
        const sBody = getVal('np-edit-body');
        const sImg = getVal('np-edit-img-url');
        const sCaption = getVal('np-edit-caption');

        if (stories[activeKey]) {
            stories[activeKey].title = sTitle;
            stories[activeKey].subhead = sSubhead;
            stories[activeKey].body = sBody;
            if (sImg) stories[activeKey].img = sImg;
            if (sCaption) stories[activeKey].caption = sCaption;
        }

        // 4. Save Page 2, 3, 4 stories
        if (stories.stage_brief) {
            stories.stage_brief.title = getVal('np-cust-stage-brief-title') || stories.stage_brief.title;
            stories.stage_brief.body = getVal('np-cust-stage-brief-body') || stories.stage_brief.body;
        }
        if (stories.venue_spotlight) {
            stories.venue_spotlight.title = getVal('np-cust-venue-title') || stories.venue_spotlight.title;
            stories.venue_spotlight.body = getVal('np-cust-venue-body') || stories.venue_spotlight.body;
        }
        if (stories.star_performer) {
            stories.star_performer.name = getVal('np-cust-star-name') || stories.star_performer.name;
            stories.star_performer.event = getVal('np-cust-star-event') || stories.star_performer.event;
            stories.star_performer.quote = getVal('np-cust-star-quote') || stories.star_performer.quote;
            if (getVal('np-cust-star-img')) stories.star_performer.img = getVal('np-cust-star-img');
        }
        if (stories.patron_column) {
            stories.patron_column.title = getVal('np-cust-patron-title') || stories.patron_column.title;
            stories.patron_column.author = getVal('np-cust-patron-author') || stories.patron_column.author;
            stories.patron_column.body = getVal('np-cust-patron-body') || stories.patron_column.body;
        }
        if (stories.tomorrow_preview) {
            stories.tomorrow_preview.title = getVal('np-cust-tomorrow-title') || stories.tomorrow_preview.title;
            stories.tomorrow_preview.body = getVal('np-cust-tomorrow-body') || stories.tomorrow_preview.body;
        }

        // 5. Save Custom Styles
        ed.customStyle = {
            fontMasthead: getVal('np-cust-font-masthead'),
            fontHeadline: getVal('np-cust-font-headline'),
            fontBody: getVal('np-cust-font-body'),
            sizeMasthead: getVal('np-slider-masthead') + 'pt',
            sizeHeadline: getVal('np-slider-headline') + 'pt',
            sizeBody: getVal('np-slider-body') + 'pt',
            inkColor: getVal('np-cust-ink-hex'),
            accentColor: getVal('np-cust-accent-hex'),
            bgColor: getVal('np-cust-bg-hex'),
            borderColor: getVal('np-cust-border-hex')
        };

        // 6. Multilingual Auto-Translation if requested
        if (translateAll) {
            showToast("Translating customized broadsheet across all 6 languages...", "info");
            const otherLangs = ['en', 'ml', 'ur', 'ar', 'hi', 'bn'].filter(l => l !== lang);
            for (const oLang of otherLangs) {
                if (!ed.translations[oLang]) ed.translations[oLang] = createDefaultStories();
                const target = ed.translations[oLang];

                target.lead_story = {
                    title: await translateText(stories.lead_story.title, oLang),
                    subhead: stories.lead_story.subhead ? await translateText(stories.lead_story.subhead, oLang) : '',
                    body: stories.lead_story.body ? await translateText(stories.lead_story.body, oLang) : '',
                    img: stories.lead_story.img,
                    caption: stories.lead_story.caption ? await translateText(stories.lead_story.caption, oLang) : ''
                };
                target.stage_brief = {
                    title: await translateText(stories.stage_brief.title, oLang),
                    body: await translateText(stories.stage_brief.body, oLang)
                };
                target.venue_spotlight = {
                    title: await translateText(stories.venue_spotlight.title, oLang),
                    body: await translateText(stories.venue_spotlight.body, oLang)
                };
                target.star_performer = {
                    name: stories.star_performer.name,
                    event: await translateText(stories.star_performer.event, oLang),
                    quote: await translateText(stories.star_performer.quote, oLang),
                    img: stories.star_performer.img
                };
                target.patron_column = {
                    title: await translateText(stories.patron_column.title, oLang),
                    author: await translateText(stories.patron_column.author, oLang),
                    body: await translateText(stories.patron_column.body, oLang)
                };
                target.tomorrow_preview = {
                    title: await translateText(stories.tomorrow_preview.title, oLang),
                    body: await translateText(stories.tomorrow_preview.body, oLang)
                };
            }
        }

        saveEditionToArchive(ed);
        closeNewspaperStoryEditor();
        renderActiveNewspaperContent();
        showToast(translateAll ? "All customizations saved & auto-translated to 6 languages!" : `Saved for ${LANG_LABELS[lang]} edition!`, "success");
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

    // 10. Pixel-Perfect 4-Page A4 PDF Export (Matches Preview 1:1 with Custom Styles)
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
            const customStyle = NP_STATE.currentEdition?.customStyle || getDefaultCustomStyle(theme);

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

                    // Apply custom styles directly
                    if (customStyle.bgColor) pageClone.style.setProperty('--bs-custom-bg', customStyle.bgColor);
                    if (customStyle.inkColor) pageClone.style.setProperty('--bs-custom-ink', customStyle.inkColor);
                    if (customStyle.accentColor) pageClone.style.setProperty('--bs-custom-accent', customStyle.accentColor);
                    if (customStyle.borderColor) pageClone.style.setProperty('--bs-custom-border', customStyle.borderColor);
                    if (customStyle.fontMasthead) pageClone.style.setProperty('--bs-font-masthead', customStyle.fontMasthead);
                    if (customStyle.fontHeadline) pageClone.style.setProperty('--bs-font-headline', customStyle.fontHeadline);
                    if (customStyle.fontBody) pageClone.style.setProperty('--bs-font-body', customStyle.fontBody);
                    if (customStyle.sizeMasthead) pageClone.style.setProperty('--bs-size-masthead', customStyle.sizeMasthead);
                    if (customStyle.sizeHeadline) pageClone.style.setProperty('--bs-size-headline', customStyle.sizeHeadline);
                    if (customStyle.sizeBody) pageClone.style.setProperty('--bs-size-body', customStyle.sizeBody);

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
                    windowWidth: 794
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
    window.switchNpModalTab = switchNpModalTab;
    window.openNewspaperStoryEditor = openNewspaperStoryEditor;
    window.closeNewspaperStoryEditor = closeNewspaperStoryEditor;
    window.loadStoryIntoEditor = loadStoryIntoEditor;
    window.previewModalPhoto = previewModalPhoto;
    window.handleNewspaperPhotoUpload = handleNewspaperPhotoUpload;
    window.handleNewspaperLogoUpload = handleNewspaperLogoUpload;
    window.handleNewspaperPhotoUploadDirect = handleNewspaperPhotoUploadDirect;
    window.liveUpdateBroadsheet = liveUpdateBroadsheet;
    window.liveUpdateStyle = liveUpdateStyle;
    window.applyPresetTheme = applyPresetTheme;
    window.resetBroadsheetToDefaults = resetBroadsheetToDefaults;
    window.saveAllNewspaperCustomizations = saveAllNewspaperCustomizations;
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
