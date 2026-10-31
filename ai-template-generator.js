/**
 * FestOS AI Template Assistant (ai-template-generator.js)
 * 1. Generates structured, copy-pasteable AI image prompts with exact field placeholder names for Gemini / Midjourney / DALL-E.
 * 2. Auto-generates templates from uploaded AI images, positioning all data fields proportionally on the canvas.
 */

(function (window) {
    'use strict';

    const AI_SECTOR_SPECS = {
        individual: {
            title: 'Individual Event Winner Poster',
            dimensions: '1080 × 1440 (Vertical Poster)',
            aspectRatio: 1080 / 1440,
            fields: [
                { key: 'ResultNumber', label: 'Result Number', type: 'text' },
                { key: 'Category', label: 'Category', type: 'text' },
                { key: 'Competition', label: 'Competition Name', type: 'text' },
                { key: 'Position1Photo', label: 'Position 1 Photo', type: 'image' },
                { key: 'Position1Number', label: 'Position 1 Rank (#1)', type: 'text' },
                { key: 'Position1Name', label: 'Position 1 Name', type: 'text' },
                { key: 'Position1Team', label: 'Position 1 Team', type: 'text' },
                { key: 'Position2Photo', label: 'Position 2 Photo', type: 'image' },
                { key: 'Position2Number', label: 'Position 2 Rank (#2)', type: 'text' },
                { key: 'Position2Name', label: 'Position 2 Name', type: 'text' },
                { key: 'Position2Team', label: 'Position 2 Team', type: 'text' },
                { key: 'Position3Photo', label: 'Position 3 Photo', type: 'image' },
                { key: 'Position3Number', label: 'Position 3 Rank (#3)', type: 'text' },
                { key: 'Position3Name', label: 'Position 3 Name', type: 'text' },
                { key: 'Position3Team', label: 'Position 3 Team', type: 'text' }
            ],
            prompt: `Design an ultra high-resolution 1080x1440 vertical sports and festival championship result poster. Features a triumphant podium aesthetic with dedicated, clearly labeled rectangular blank placeholder zones for:
- [Competition] (bold header at top center)
- [Category] (badge above competition name)
- [Result Number] (top left badge)
- [Position 1 Photo] (large vertical portrait frame in center podium)
- [Position 1 Number] (gold badge #1)
- [Position 1 Name] (champion heading below photo)
- [Position 1 Team] (team ribbon)
- [Position 2 Photo] (silver vertical frame on left podium)
- [Position 2 Name], [Position 2 Team]
- [Position 3 Photo] (bronze vertical frame on right podium)
- [Position 3 Name], [Position 3 Team]
Use dark obsidian background with gold metallic particle lighting, stage spotlights, and clean sharp borders. Keep text placeholder areas completely blank and contrasty.`
        },
        team: {
            title: 'Live Team Standings Leaderboard',
            dimensions: '1080 × 1440 (Vertical Poster)',
            aspectRatio: 1080 / 1440,
            fields: [
                { key: 'ResultsCountText', label: 'Results Count Text', type: 'text' },
                { key: 'Rank1Number', label: 'Rank 1 #', type: 'text' },
                { key: 'Rank1Team', label: 'Rank 1 Team', type: 'text' },
                { key: 'Rank1Points', label: 'Rank 1 Points', type: 'text' },
                { key: 'Rank2Number', label: 'Rank 2 #', type: 'text' },
                { key: 'Rank2Team', label: 'Rank 2 Team', type: 'text' },
                { key: 'Rank2Points', label: 'Rank 2 Points', type: 'text' },
                { key: 'Rank3Number', label: 'Rank 3 #', type: 'text' },
                { key: 'Rank3Team', label: 'Rank 3 Team', type: 'text' },
                { key: 'Rank3Points', label: 'Rank 3 Points', type: 'text' },
                { key: 'Rank4Team', label: 'Rank 4-10 Teams & Points', type: 'text' }
            ],
            prompt: `Design an ultra high-resolution 1080x1440 vertical broadcast-style team standings leaderboard poster. Deep midnight navy gradient background with glowing electric borders. Prominent top title bar for [Results Count Text]. Below it, 10 clearly defined alternating horizontal leaderboard stripe cards labeled with blank placeholder slots for:
- [Rank 1 Number], [Rank 1 Team], [Rank 1 Points] (gold medal highlight)
- [Rank 2 Number], [Rank 2 Team], [Rank 2 Points] (silver medal highlight)
- [Rank 3 Number], [Rank 3 Team], [Rank 3 Points] (bronze medal highlight)
- [Rank 4] to [Rank 10] stripes for team names and points.
Clean, modern, highly legible sports television graphics layout with blank text zones.`
        },
        final: {
            title: 'Final Championship Overall Poster',
            dimensions: '1080 × 1440 (Vertical Poster)',
            aspectRatio: 1080 / 1440,
            fields: [
                { key: 'TotalCompetitionsCount', label: 'Total Competitions Count', type: 'text' },
                { key: 'Rank1Team', label: 'Rank 1 Champion Team', type: 'text' },
                { key: 'Rank1Points', label: 'Rank 1 Points', type: 'text' },
                { key: 'Rank2Team', label: 'Rank 2 Runner-up Team', type: 'text' },
                { key: 'Rank2Points', label: 'Rank 2 Points', type: 'text' }
            ],
            prompt: `Design an ultra high-resolution 1080x1440 grand finale championship winner poster. Royal purple and gold gradient with celebratory confetti, victory laurels, and grand trophy silhouette. Header zone labeled for [Total Competitions Count]. Vertical rankings list for [Rank 1 Team], [Rank 1 Points], [Rank 2 Team], [Rank 2 Points] through Rank 10.`
        },
        id_card: {
            title: 'Participant ID Card Badge',
            dimensions: '900 × 1300 (Portrait Lanyard)',
            aspectRatio: 900 / 1300,
            fields: [
                { key: 'Photo', label: 'Participant Photo', type: 'image' },
                { key: 'ParticipantName', label: 'Participant Name', type: 'text' },
                { key: 'TeamName', label: 'Team Name', type: 'text' },
                { key: 'Category', label: 'Category', type: 'text' },
                { key: 'DateofBirth', label: 'Date of Birth', type: 'text' },
                { key: 'QRCode', label: 'QR Code', type: 'image' },
                { key: 'UniqueID', label: 'Unique ID', type: 'text' }
            ],
            prompt: `Design a professional 900x1300 vertical festival attendee and participant identity card badge. Top navy blue header for festival branding. Centered vertical rounded rectangle placeholder zone clearly labeled for [Photo]. Below the photo, distinct labeled text areas for:
- [Participant Name] (large bold font)
- [Team Name] (team color badge)
- [Category] (pill badge)
- [Date of Birth]
- [Unique ID] (monospace serial box)
- [QR Code] (square box at lower center)
Include official festival branding header at top and verification stripe at bottom. Clean white background surface.`
        },
        certificate: {
            title: 'Merit & Excellence Certificate',
            dimensions: '1600 × 1130 (Landscape A4)',
            aspectRatio: 1600 / 1130,
            fields: [
                { key: 'Category', label: 'Category', type: 'text' },
                { key: 'Competition', label: 'Competition Name', type: 'text' },
                { key: 'ParticipantName', label: 'Participant Name', type: 'text' },
                { key: 'TeamName', label: 'Team Name', type: 'text' },
                { key: 'Position', label: 'Position / Rank', type: 'text' },
                { key: 'Grade', label: 'Grade (A+)', type: 'text' },
                { key: 'IssueDate', label: 'Issue Date', type: 'text' },
                { key: 'UniqueID', label: 'Unique ID', type: 'text' },
                { key: 'QRCode', label: 'QR Verification Code', type: 'image' }
            ],
            prompt: `Design a 1600x1130 landscape luxury formal certificate of merit and excellence. Warm ivory paper background with intricate gold guilloche ornate border framing and heraldic crest at top. Dedicated clearly labeled blank text positions for:
- [Category] (top text)
- [Competition] (event title)
- [Participant Name] (large bold calligraphic name line in center)
- [Team Name]
- [Position] (e.g. First Place)
- [Grade] (e.g. A+ Grade)
- [Issue Date] (bottom left above signature)
- [Unique ID] (bottom verification code)
- [QR Code] (square slot on bottom right)
Include two formal signature lines at bottom for Festival Director and Chief Adjudicator with gold seal badge.`
        }
    };

    // -------------------------------------------------------------------------
    // AUTO-POSITIONING HEURISTIC ENGINE
    // -------------------------------------------------------------------------
    function computeProportionalFields(sector, imgWidth, imgHeight) {
        const fields = {};
        const w = imgWidth;
        const h = imgHeight;

        if (sector === 'id_card') {
            const photoW = Math.round(w * 0.4);
            const photoH = Math.round(h * 0.33);
            const photoX = Math.round((w - photoW) / 2);
            const photoY = Math.round(h * 0.14);

            fields['Photo'] = { enabled: true, x: photoX, y: photoY, w: photoW, h: photoH, radius: Math.round(photoW * 0.08), isImage: true, aspectLocked: true, aspectRatio: photoW / photoH, displayName: 'Photo' };
            fields['ParticipantName'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.52), size: Math.round(h * 0.034), color: '#0F172A', align: 'center', font: 'Inter, sans-serif', weight: '800', isImage: false, displayName: 'Participant Name' };
            fields['TeamName'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.57), size: Math.round(h * 0.024), color: '#4F46E5', align: 'center', font: 'Inter, sans-serif', weight: 'bold', isImage: false, displayName: 'Team Name' };
            fields['Category'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.615), size: Math.round(h * 0.02), color: '#475569', align: 'center', font: 'Inter, sans-serif', weight: 'bold', isImage: false, displayName: 'Category' };
            fields['DateofBirth'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.655), size: Math.round(h * 0.017), color: '#94A3B8', align: 'center', font: 'Inter, sans-serif', weight: 'bold', isImage: false, displayName: 'Date of Birth' };

            const qrSize = Math.round(w * 0.25);
            fields['QRCode'] = { enabled: true, x: Math.round((w - qrSize) / 2), y: Math.round(h * 0.69), w: qrSize, h: qrSize, radius: 8, isImage: true, aspectLocked: true, aspectRatio: 1, displayName: 'QR Code' };
            fields['UniqueID'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.90), size: Math.round(h * 0.022), color: '#1E293B', align: 'center', font: 'Inter, sans-serif', weight: 'bold', isImage: false, displayName: 'Unique ID' };
        } else if (sector === 'individual') {
            fields['ResultNumber'] = { enabled: true, x: Math.round(w * 0.09), y: Math.round(h * 0.10), size: Math.round(h * 0.024), color: '#FCD34D', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Result Number' };
            fields['Category'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.125), size: Math.round(h * 0.026), color: '#93C5FD', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Category' };
            fields['Competition'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.17), size: Math.round(h * 0.038), color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Competition' };

            // Center 1st place
            const p1W = Math.round(w * 0.28);
            const p1H = Math.round(h * 0.25);
            fields['Position1Photo'] = { enabled: true, x: Math.round((w - p1W) / 2), y: Math.round(h * 0.24), w: p1W, h: p1H, radius: 20, isImage: true, aspectLocked: true, aspectRatio: p1W / p1H, displayName: 'Position 1 Photo' };
            fields['Position1Number'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.52), size: Math.round(h * 0.026), color: '#F59E0B', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 1 Number' };
            fields['Position1Name'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.56), size: Math.round(h * 0.031), color: '#FEF08A', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 1 Name' };
            fields['Position1Team'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.595), size: Math.round(h * 0.022), color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 1 Team' };

            // Left 2nd place
            const p2W = Math.round(w * 0.22);
            const p2H = Math.round(h * 0.20);
            fields['Position2Photo'] = { enabled: true, x: Math.round(w * 0.09), y: Math.round(h * 0.35), w: p2W, h: p2H, radius: 16, isImage: true, aspectLocked: true, aspectRatio: p2W / p2H, displayName: 'Position 2 Photo' };
            fields['Position2Number'] = { enabled: true, x: Math.round(w * 0.20), y: Math.round(h * 0.58), size: Math.round(h * 0.021), color: '#CBD5E1', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 2 Number' };
            fields['Position2Name'] = { enabled: true, x: Math.round(w * 0.20), y: Math.round(h * 0.615), size: Math.round(h * 0.024), color: '#E2E8F0', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 2 Name' };
            fields['Position2Team'] = { enabled: true, x: Math.round(w * 0.20), y: Math.round(h * 0.645), size: Math.round(h * 0.018), color: '#94A3B8', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 2 Team' };

            // Right 3rd place
            fields['Position3Photo'] = { enabled: true, x: Math.round(w * 0.69), y: Math.round(h * 0.35), w: p2W, h: p2H, radius: 16, isImage: true, aspectLocked: true, aspectRatio: p2W / p2H, displayName: 'Position 3 Photo' };
            fields['Position3Number'] = { enabled: true, x: Math.round(w * 0.80), y: Math.round(h * 0.58), size: Math.round(h * 0.021), color: '#D97706', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 3 Number' };
            fields['Position3Name'] = { enabled: true, x: Math.round(w * 0.80), y: Math.round(h * 0.615), size: Math.round(h * 0.024), color: '#FED7AA', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 3 Name' };
            fields['Position3Team'] = { enabled: true, x: Math.round(w * 0.80), y: Math.round(h * 0.645), size: Math.round(h * 0.018), color: '#94A3B8', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 3 Team' };
        } else if (sector === 'certificate') {
            fields['Category'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.26), size: Math.round(h * 0.026), color: '#78350F', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Category' };
            fields['Competition'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.31), size: Math.round(h * 0.035), color: '#1E1B4B', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Competition' };
            fields['ParticipantName'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.44), size: Math.round(h * 0.052), color: '#0F172A', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Participant Name' };
            fields['TeamName'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.51), size: Math.round(h * 0.028), color: '#4338CA', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Team Name' };
            fields['Position'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.59), size: Math.round(h * 0.038), color: '#B45309', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Position' };
            fields['Grade'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.65), size: Math.round(h * 0.028), color: '#059669', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Grade' };
            fields['IssueDate'] = { enabled: true, x: Math.round(w * 0.22), y: Math.round(h * 0.865), size: Math.round(h * 0.018), color: '#64748B', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Issue Date' };
            fields['UniqueID'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.77), size: Math.round(h * 0.018), color: '#94A3B8', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Unique ID' };
            
            const certQr = Math.round(w * 0.10);
            fields['QRCode'] = { enabled: true, x: Math.round(w * 0.79), y: Math.round(h * 0.73), w: certQr, h: certQr, radius: 0, isImage: true, aspectLocked: true, aspectRatio: 1, displayName: 'QR Code' };
        } else {
            // Team Standings or Final
            fields['ResultsCountText'] = { enabled: true, x: Math.round(w / 2), y: Math.round(h * 0.135), size: Math.round(h * 0.023), color: '#A5B4FC', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Results Count Text' };
            for (let i = 1; i <= 5; i++) {
                const y = Math.round(h * 0.20 + (i - 1) * (h * 0.08));
                fields[`Rank${i}Number`] = { enabled: true, x: Math.round(w * 0.12), y: y, size: Math.round(h * 0.025), color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: `Rank ${i} Number` };
                fields[`Rank${i}Team`] = { enabled: true, x: Math.round(w * 0.19), y: y, size: Math.round(h * 0.025), color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: `Rank ${i} Team` };
                fields[`Rank${i}Points`] = { enabled: true, x: Math.round(w * 0.88), y: y, size: Math.round(h * 0.028), color: '#FDE047', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: `Rank ${i} Points` };
            }
        }

        return fields;
    }

    // -------------------------------------------------------------------------
    // MODAL CONTROLLER & UI
    // -------------------------------------------------------------------------
    function openAiTemplateModal(isStudioContext = false) {
        let modal = document.getElementById('aiTemplateModal');
        if (!modal) {
            createAiTemplateModal();
            modal = document.getElementById('aiTemplateModal');
        }

        modal.dataset.context = isStudioContext ? 'studio' : 'library';
        updateAiPromptPreview();
        modal.classList.add('show');
    }

    function closeAiTemplateModal() {
        const modal = document.getElementById('aiTemplateModal');
        if (modal) modal.classList.remove('show');
    }

    function updateAiPromptPreview() {
        const sector = document.getElementById('ai-template-sector')?.value || 'individual';
        const spec = AI_SECTOR_SPECS[sector] || AI_SECTOR_SPECS.individual;

        const tokensBox = document.getElementById('ai-field-tokens');
        if (tokensBox) {
            tokensBox.innerHTML = spec.fields.map(f => `
                <span style="background: white; border: 1px solid var(--border); padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: ${f.type === 'image' ? '#4F46E5' : '#0F172A'}; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid ${f.type === 'image' ? 'fa-image' : 'fa-font'}" style="font-size: 0.65rem;"></i> [${f.label}]
                </span>
            `).join('');
        }

        const promptBox = document.getElementById('ai-prompt-textarea');
        if (promptBox) {
            promptBox.value = spec.prompt;
        }

        const dimBox = document.getElementById('ai-sector-dim');
        if (dimBox) {
            dimBox.innerText = `Dimensions: ${spec.dimensions}`;
        }
    }

    function copyAiPrompt() {
        const promptBox = document.getElementById('ai-prompt-textarea');
        if (!promptBox) return;

        navigator.clipboard.writeText(promptBox.value).then(() => {
            if (typeof showToast === 'function') showToast('AI Prompt copied to clipboard! Paste into Gemini or Midjourney.', 'success');
        }).catch(() => {
            promptBox.select();
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast('AI Prompt copied!', 'success');
        });
    }

    function handleAiImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const img = new Image();
            img.onload = () => {
                const sector = document.getElementById('ai-template-sector')?.value || 'individual';
                const fields = computeProportionalFields(sector, img.naturalWidth, img.naturalHeight);

                const templatePayload = {
                    id: 'TPL_AI_' + Date.now(),
                    name: 'AI Generated ' + sector.toUpperCase(),
                    type: sector,
                    bg_base64: dataUrl,
                    fields: fields
                };

                closeAiTemplateModal();

                if (typeof openTemplateStudio === 'function') {
                    openTemplateStudio(templatePayload);
                    if (typeof showToast === 'function') {
                        showToast(`AI Template generated (${img.naturalWidth}×${img.naturalHeight})! All fields mapped automatically.`, 'success');
                    }
                }
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    function createAiTemplateModal() {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'aiTemplateModal';
        modalDiv.className = 'modal-overlay';
        modalDiv.style.zIndex = '1120';

        modalDiv.innerHTML = `
            <div class="modal" style="max-width: 840px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.25rem;">
                    <div>
                        <span class="badge badge-primary" style="font-size: 0.75rem; margin-bottom: 0.25rem; display: inline-flex; align-items: center; gap: 0.35rem; background: #059669; color: white;">
                            <i class="fa-solid fa-robot"></i> AI TEMPLATE ASSISTANT
                        </span>
                        <h2 style="margin-top: 0.25rem; font-size: 1.35rem; color: var(--text-main);">Auto-Generate Template from AI Image</h2>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Copy structured AI prompts for Gemini / Midjourney, then upload the generated image to map all data fields automatically.</p>
                    </div>
                    <button class="close-btn" onclick="FestOSAiTemplate.closeAiTemplateModal()"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- STEP 1: SELECT SECTOR -->
                    <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <label style="font-size: 0.78rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em;">STEP 1: SELECT TEMPLATE TYPE</label>
                            <span id="ai-sector-dim" style="font-size: 0.72rem; font-weight: 700; color: var(--primary); font-family: monospace;">Dimensions: 1080 × 1440</span>
                        </div>
                        <select id="ai-template-sector" onchange="FestOSAiTemplate.updateAiPromptPreview()" style="width: 100%; padding: 0.65rem 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 0.9rem; background: white; outline: none; font-weight: 600;">
                            <option value="individual" selected>Individual Event Result Poster (Podium 1st, 2nd, 3rd)</option>
                            <option value="team">Live Team Standings Leaderboard</option>
                            <option value="final">Final Overall Championship Poster</option>
                            <option value="id_card">Participant ID Card Badge (Photo, QR, Barcode)</option>
                            <option value="certificate">Merit & Excellence Certificate (A4 Landscape)</option>
                        </select>
                    </div>

                    <!-- STEP 2: FIELD PLACEHOLDERS & AI PROMPT -->
                    <div style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; background: var(--bg-surface, #FFFFFF);">
                        <label style="font-size: 0.78rem; font-weight: 800; color: var(--text-muted); display: block; margin-bottom: 0.5rem; letter-spacing: 0.05em;">STEP 2: DATA FIELD PLACEHOLDERS & COPYABLE AI PROMPT</label>
                        
                        <div style="margin-bottom: 0.75rem;">
                            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.35rem;">REQUIRED DATA FIELDS FOR THIS TEMPLATE:</div>
                            <div id="ai-field-tokens" style="display: flex; flex-wrap: wrap; gap: 0.35rem; max-height: 90px; overflow-y: auto; padding: 0.5rem; background: var(--bg-main); border-radius: 6px; border: 1px solid var(--border);">
                                <!-- Tokens rendered dynamically -->
                            </div>
                        </div>

                        <div style="position: relative;">
                            <textarea id="ai-prompt-textarea" rows="5" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 0.82rem; font-family: monospace; background: var(--bg-main); resize: vertical; outline: none; box-sizing: border-box;"></textarea>
                            <button class="btn btn-primary" onclick="FestOSAiTemplate.copyAiPrompt()" style="margin-top: 0.5rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700;">
                                <i class="fa-solid fa-copy"></i> Copy AI Prompt (Paste into Gemini, ChatGPT, or Midjourney)
                            </button>
                        </div>
                    </div>

                    <!-- STEP 3: UPLOAD IMAGE & AUTO-GENERATE -->
                    <div style="border: 2px dashed #059669; border-radius: var(--radius-md); padding: 1.5rem; background: #ECFDF5; text-align: center;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 2.2rem; color: #059669; margin-bottom: 0.75rem;"></i>
                        <h3 style="font-size: 1.1rem; font-weight: 800; color: #065F46; margin-bottom: 0.35rem;">STEP 3: UPLOAD YOUR AI-GENERATED IMAGE</h3>
                        <p style="font-size: 0.82rem; color: #047857; margin-bottom: 1rem;">Upload the image generated by AI. FestOS will automatically map all data fields to their exact proportional coordinates and open it in the Studio.</p>
                        
                        <input type="file" id="ai-image-file-input" accept="image/*" style="display: none;" onchange="FestOSAiTemplate.handleAiImageUpload(event)">
                        <button class="btn btn-success" onclick="document.getElementById('ai-image-file-input').click()" style="padding: 0.75rem 1.5rem; font-size: 0.95rem; font-weight: 800; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-file-arrow-up"></i> Select AI Image & Auto-Generate Template
                        </button>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                    <button class="btn btn-outline" onclick="FestOSAiTemplate.closeAiTemplateModal()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    // Expose engine
    window.FestOSAiTemplate = {
        openAiTemplateModal,
        closeAiTemplateModal,
        updateAiPromptPreview,
        copyAiPrompt,
        handleAiImageUpload
    };

    window.openAiTemplateModal = openAiTemplateModal;
    window.closeAiTemplateModal = closeAiTemplateModal;

})(window);
