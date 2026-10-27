const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'announcements.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace dark theme CSS with pure light theme CSS
const oldCssRegex = /\/\* --- AI ANNOUNCER SUITE \(EXECUTIVE BROADCAST STUDIO CONSOLE\) --- \*\/[\s\S]*?\.tts-slider::-webkit-slider-thumb \{[\s\S]*?\}/;

const newCss = `/* --- AI ANNOUNCER SUITE (LIGHT THEME STUDIO CONSOLE) --- */
        .ai-deck-card {
            background: #FFFFFF !important;
            border-radius: var(--radius-xl);
            padding: 2rem;
            border: 1px solid var(--border) !important;
            box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02) !important;
            margin-bottom: 2rem;
            color: var(--text-main) !important;
        }
        .ai-deck-card h2, .ai-deck-card h3, .ai-deck-card h4 {
            color: var(--text-main) !important;
        }
        .tts-studio-select {
            width: 100%;
            padding: 0.75rem 1rem;
            border-radius: 10px;
            border: 1.5px solid var(--border);
            background: #FFFFFF;
            color: var(--text-main);
            font-size: 0.9rem;
            font-weight: 600;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 0.85rem center;
            background-size: 1rem;
            cursor: pointer;
        }
        .tts-studio-select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-ring);
            background-color: #FFFFFF;
        }
        .tts-studio-select option, .tts-studio-select optgroup {
            background: #FFFFFF;
            color: var(--text-main);
        }
        .tts-slider {
            width: 100%;
            height: 6px;
            border-radius: 4px;
            background: #E2E8F0;
            outline: none;
            accent-color: var(--primary);
            cursor: pointer;
            margin: 6px 0;
        }
        .tts-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--primary);
            box-shadow: 0 0 6px rgba(79, 70, 229, 0.4);
            cursor: pointer;
        }`;

if (oldCssRegex.test(content)) {
    content = content.replace(oldCssRegex, newCss);
    console.log('Successfully replaced AI Announcer CSS to pure light theme.');
} else {
    console.warn('Warning: oldCssRegex did not match.');
}

// 2. Replace dark elements in renderVoiceModelsList
content = content.replace(
    'container.innerHTML = \'<div style="text-align: center; color: #94A3B8; padding: 2rem;">No human voice models registered for this festival yet.<br><small>Click "Record Another Model" to create one.</small></div>\';',
    'container.innerHTML = \'<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No human voice models registered for this festival yet.<br><small>Click "Record Another Model" to create one.</small></div>\';'
);

content = content.replace(
    '<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 0.85rem 1.15rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">',
    '<div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); padding: 0.85rem 1.15rem; border-radius: 10px; border: 1px solid var(--border);">'
);

content = content.replace(
    '<div style="font-weight: 800; font-size: 0.95rem; color: #FFFFFF; display: flex; align-items: center; gap: 0.5rem;">',
    '<div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">'
);

content = content.replace(
    '<div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">',
    '<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">'
);

// 3. Enhance chime sound synthesis for all sound fx options (stadium, temple, synth)
const chimeRegex = /if \(style === 'gong'\) \{[\s\S]*?\} else \{[\s\S]*?resolve\(\);[\s\S]*?\}/;

const fullChimeCode = `if (style === 'gong') {
                        // Dual Harmonic Gong (D5 587.33Hz -> A5 880Hz)
                        const osc1 = ttsAudioCtx.createOscillator();
                        const gain1 = ttsAudioCtx.createGain();
                        osc1.type = 'sine';
                        osc1.frequency.setValueAtTime(587.33, now);
                        gain1.gain.setValueAtTime(0, now);
                        gain1.gain.linearRampToValueAtTime(0.3 * masterVol, now + 0.04);
                        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
                        osc1.connect(gain1);
                        gain1.connect(ttsAudioCtx.destination);
                        osc1.start(now);
                        osc1.stop(now + 0.5);

                        const osc2 = ttsAudioCtx.createOscillator();
                        const gain2 = ttsAudioCtx.createGain();
                        osc2.type = 'sine';
                        osc2.frequency.setValueAtTime(880, now + 0.2);
                        gain2.gain.setValueAtTime(0, now + 0.2);
                        gain2.gain.linearRampToValueAtTime(0.35 * masterVol, now + 0.24);
                        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
                        osc2.connect(gain2);
                        gain2.connect(ttsAudioCtx.destination);
                        osc2.start(now + 0.2);
                        osc2.stop(now + 0.9);

                        setTimeout(resolve, 850);
                    } else if (style === 'stadium') {
                        // Grand Stadium Horn (Dual-Brass Chords F4 349.23Hz + Bb4 466.16Hz)
                        [349.23, 466.16, 698.46].forEach((freq, idx) => {
                            const osc = ttsAudioCtx.createOscillator();
                            const gain = ttsAudioCtx.createGain();
                            osc.type = 'sawtooth';
                            osc.frequency.setValueAtTime(freq, now);
                            gain.gain.setValueAtTime(0, now);
                            gain.gain.linearRampToValueAtTime(0.25 * masterVol, now + 0.08);
                            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
                            osc.connect(gain);
                            gain.connect(ttsAudioCtx.destination);
                            osc.start(now);
                            osc.stop(now + 0.9);
                        });
                        setTimeout(resolve, 900);
                    } else if (style === 'airport') {
                        // Airport 2-tone Ding-Dong (F5 698.46Hz -> C6 1046.5Hz)
                        const osc1 = ttsAudioCtx.createOscillator();
                        const gain1 = ttsAudioCtx.createGain();
                        osc1.type = 'sine';
                        osc1.frequency.setValueAtTime(698.46, now);
                        gain1.gain.setValueAtTime(0, now);
                        gain1.gain.linearRampToValueAtTime(0.4 * masterVol, now + 0.03);
                        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
                        osc1.connect(gain1);
                        gain1.connect(ttsAudioCtx.destination);
                        osc1.start(now);
                        osc1.stop(now + 0.55);

                        const osc2 = ttsAudioCtx.createOscillator();
                        const gain2 = ttsAudioCtx.createGain();
                        osc2.type = 'sine';
                        osc2.frequency.setValueAtTime(1046.5, now + 0.3);
                        gain2.gain.setValueAtTime(0, now + 0.3);
                        gain2.gain.linearRampToValueAtTime(0.45 * masterVol, now + 0.33);
                        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
                        osc2.connect(gain2);
                        gain2.connect(ttsAudioCtx.destination);
                        osc2.start(now + 0.3);
                        osc2.stop(now + 1.0);

                        setTimeout(resolve, 950);
                    } else if (style === 'digital') {
                        // Digital Arp Bell (A5 880Hz -> D6 1174.66Hz -> E6 1318.51Hz)
                        [880, 1174.66, 1318.51].forEach((freq, idx) => {
                            const o = ttsAudioCtx.createOscillator();
                            const g = ttsAudioCtx.createGain();
                            const t = now + (idx * 0.12);
                            o.type = 'triangle';
                            o.frequency.setValueAtTime(freq, t);
                            g.gain.setValueAtTime(0, t);
                            g.gain.linearRampToValueAtTime(0.35 * masterVol, t + 0.02);
                            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
                            o.connect(g);
                            g.connect(ttsAudioCtx.destination);
                            o.start(t);
                            o.stop(t + 0.45);
                        });
                        setTimeout(resolve, 750);
                    } else if (style === 'fanfare') {
                        // Attention Trumpet Fanfare (C5 -> E5 -> G5 -> C6)
                        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
                            const o = ttsAudioCtx.createOscillator();
                            const g = ttsAudioCtx.createGain();
                            const t = now + (idx * 0.15);
                            o.type = 'sawtooth';
                            o.frequency.setValueAtTime(freq, t);
                            g.gain.setValueAtTime(0, t);
                            g.gain.linearRampToValueAtTime(0.2 * masterVol, t + 0.03);
                            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
                            o.connect(g);
                            g.connect(ttsAudioCtx.destination);
                            o.start(t);
                            o.stop(t + 0.55);
                        });
                        setTimeout(resolve, 1000);
                    } else if (style === 'temple') {
                        // Majestic Temple Bells (Deep resonant bells)
                        [220, 440, 660].forEach((freq) => {
                            const o = ttsAudioCtx.createOscillator();
                            const g = ttsAudioCtx.createGain();
                            o.type = 'sine';
                            o.frequency.setValueAtTime(freq, now);
                            g.gain.setValueAtTime(0, now);
                            g.gain.linearRampToValueAtTime(0.3 * masterVol, now + 0.05);
                            g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
                            o.connect(g);
                            g.connect(ttsAudioCtx.destination);
                            o.start(now);
                            o.stop(now + 1.25);
                        });
                        setTimeout(resolve, 1100);
                    } else if (style === 'synth') {
                        // Cyber Synth Pulse (Sub-bass Drop)
                        const o = ttsAudioCtx.createOscillator();
                        const g = ttsAudioCtx.createGain();
                        o.type = 'sawtooth';
                        o.frequency.setValueAtTime(700, now);
                        o.frequency.exponentialRampToValueAtTime(110, now + 0.45);
                        g.gain.setValueAtTime(0, now);
                        g.gain.linearRampToValueAtTime(0.4 * masterVol, now + 0.03);
                        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
                        o.connect(g);
                        g.connect(ttsAudioCtx.destination);
                        o.start(now);
                        o.stop(now + 0.65);
                        setTimeout(resolve, 650);
                    } else {
                        resolve();
                    }`;

if (chimeRegex.test(content)) {
    content = content.replace(chimeRegex, fullChimeCode);
    console.log('Successfully added full chime synthesis options.');
} else {
    console.warn('Warning: chimeRegex did not match.');
}

// 4. Update statusLabel broadcasting color to var(--primary)
content = content.replace(
    "statusLabel.style.color = '#38BDF8';",
    "statusLabel.style.color = 'var(--primary)';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('announcements.html light theme and chime audio updated successfully.');
