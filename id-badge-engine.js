/**
 * FestOS Multi-Page Bulk ID Badge Generator Engine
 * Generates print-ready multi-page sheets with customizable presets (A4, A3, A5, Letter, Legal, Tabloid, Custom in/cm/mm)
 * Supports multiple grid layouts (4, 8, 6, 9, 10, 2, 1, or custom cols x rows)
 * Renders ID cards using Studio ID Card templates only (preserving exact dimensions & natural aspect ratio)
 * Includes live real-time WYSIWYG preview with live filter & sort reactions
 * Includes high-res photos, Code128 barcodes, scannable QR codes, team color accents, and cut/crop marks.
 */

(function (window) {
    'use strict';

    // Global in-memory cache for studio ID card templates
    let studioTemplatesCache = {};

    // Helper: Generate Code128 Barcode as Image Data URL
    function generateBarcodeDataUrl(text) {
        try {
            if (typeof JsBarcode === 'function') {
                const canvas = document.createElement('canvas');
                JsBarcode(canvas, String(text).toUpperCase(), {
                    format: 'CODE128',
                    width: 2,
                    height: 42,
                    displayValue: true,
                    fontSize: 13,
                    font: 'monospace',
                    textMargin: 3,
                    margin: 2,
                    background: '#FFFFFF',
                    lineColor: '#0F172A'
                });
                return canvas.toDataURL('image/png');
            }
        } catch (e) {
            console.warn('Barcode render notice:', e);
        }
        return null;
    }

    // Helper: Generate High-Contrast QR Code as Data URL
    function generateQrDataUrl(text, size = 180) {
        return new Promise(resolve => {
            if (typeof QRCode === 'undefined') return resolve(null);
            try {
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'fixed';
                tempDiv.style.left = '-9999px';
                tempDiv.style.top = '-9999px';
                document.body.appendChild(tempDiv);

                new QRCode(tempDiv, {
                    text: String(text),
                    width: size,
                    height: size,
                    colorDark: '#0F172A',
                    colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.M
                });

                setTimeout(() => {
                    const canvas = tempDiv.querySelector('canvas');
                    let dataUrl = null;
                    if (canvas) {
                        dataUrl = canvas.toDataURL('image/png');
                    } else {
                        const img = tempDiv.querySelector('img');
                        if (img && img.src) dataUrl = img.src;
                    }
                    if (tempDiv.parentNode) tempDiv.parentNode.removeChild(tempDiv);
                    resolve(dataUrl);
                }, 40);
            } catch (err) {
                console.warn('QR render notice:', err);
                resolve(null);
            }
        });
    }

    // Helper: Safely load image into HTMLImageElement
    function loadBadgeImage(src) {
        return new Promise(resolve => {
            if (!src) return resolve(null);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    // Helper: Sheet Dimensions Resolver (Presets + Custom in/cm/mm)
    function resolveSheetDimensions(sizePreset, customW, customH, customUnit, orientation = 'portrait') {
        const PRESETS = {
            'a4': { w: 210, h: 297, name: 'A4' },
            'a3': { w: 297, h: 420, name: 'A3' },
            'a5': { w: 148, h: 210, name: 'A5' },
            'letter': { w: 215.9, h: 279.4, name: 'Letter' },
            'legal': { w: 215.9, h: 355.6, name: 'Legal' },
            'tabloid': { w: 279.4, h: 431.8, name: 'Tabloid' }
        };

        let wMm, hMm;
        if (sizePreset === 'custom') {
            let unitMultiplier = 1; // mm default
            const u = (customUnit || 'mm').toLowerCase();
            if (u === 'cm') unitMultiplier = 10;
            else if (u === 'in' || u === 'inch' || u === 'inches') unitMultiplier = 25.4;

            wMm = (parseFloat(customW) || 210) * unitMultiplier;
            hMm = (parseFloat(customH) || 297) * unitMultiplier;
        } else {
            const p = PRESETS[String(sizePreset).toLowerCase()] || PRESETS['a4'];
            wMm = p.w;
            hMm = p.h;
        }

        if (orientation === 'landscape') {
            if (wMm < hMm) { const tmp = wMm; wMm = hMm; hMm = tmp; }
        } else if (orientation === 'portrait') {
            if (wMm > hMm) { const tmp = wMm; wMm = hMm; hMm = tmp; }
        }

        return {
            name: PRESETS[String(sizePreset).toLowerCase()]?.name || 'Custom',
            widthMm: Math.round(wMm * 100) / 100,
            heightMm: Math.round(hMm * 100) / 100,
            orientation: wMm > hMm ? 'landscape' : 'portrait'
        };
    }

    // Helper: Grid Layout Resolver
    function resolveGridLayout(layoutKey, customCols, customRows) {
        switch (layoutKey) {
            case '1_per_page':  return { cols: 1, rows: 1, count: 1, name: '1 Per Page (Full Sheet)' };
            case '2_per_page':  return { cols: 1, rows: 2, count: 2, name: '2 Per Page (Large Pass)' };
            case '4_per_page':  return { cols: 2, rows: 2, count: 4, name: '4 Per Page (Lanyard Pass)' };
            case '6_per_page':  return { cols: 2, rows: 3, count: 6, name: '6 Per Page (Convention)' };
            case '8_per_page':  return { cols: 2, rows: 4, count: 8, name: '8 Per Page (Standard CR80)' };
            case '9_per_page':  return { cols: 3, rows: 3, count: 9, name: '9 Per Page (Compact Square)' };
            case '10_per_page': return { cols: 2, rows: 5, count: 10, name: '10 Per Page (Avery 5371 / Pin)' };
            case 'custom':
                const c = Math.max(1, Math.min(6, parseInt(customCols, 10) || 2));
                const r = Math.max(1, Math.min(8, parseInt(customRows, 10) || 4));
                return { cols: c, rows: r, count: c * r, name: `Custom ${c}×${r} (${c * r} Per Page)` };
            default:
                return { cols: 2, rows: 2, count: 4, name: '4 Per Page (Lanyard Pass)' };
        }
    }

    // Helper: Filter and Sort Participants
    function filterAndSortParticipants(list, teamFilter, catFilter, sortOrder) {
        let result = Array.isArray(list) ? [...list] : [];

        // 1. Team Filter
        if (teamFilter && teamFilter !== 'all') {
            result = result.filter(p => {
                const pTeamId = String(p.team_id || p.teams?.id || '');
                const pTeamName = String(p.teams?.name || p.team_name || '').trim().toUpperCase();
                return pTeamId === String(teamFilter) || pTeamName === String(teamFilter).trim().toUpperCase();
            });
        }

        // 2. Category Filter
        if (catFilter && catFilter !== 'all') {
            result = result.filter(p => {
                const pCatId = String(p.category_id || p.categories?.id || '');
                const pCatName = String(p.categories?.name || p.category_name || '').trim().toUpperCase();
                return pCatId === String(catFilter) || pCatName === String(catFilter).trim().toUpperCase();
            });
        }

        // 3. Sort Order
        result.sort((a, b) => {
            if (sortOrder === 'team') {
                const ta = String(a.teams?.name || a.team_name || '').trim().toUpperCase();
                const tb = String(b.teams?.name || b.team_name || '').trim().toUpperCase();
                const cmp = ta.localeCompare(tb);
                if (cmp !== 0) return cmp;
            } else if (sortOrder === 'category') {
                const ca = String(a.categories?.name || a.category_name || '').trim().toUpperCase();
                const cb = String(b.categories?.name || b.category_name || '').trim().toUpperCase();
                const cmp = ca.localeCompare(cb);
                if (cmp !== 0) return cmp;
            } else if (sortOrder === 'unique_id') {
                const ua = String(a.unique_id || a.id || '');
                const ub = String(b.unique_id || b.id || '');
                return ua.localeCompare(ub, undefined, { numeric: true });
            }
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        return result;
    }

    // -------------------------------------------------------------------------
    // 1. FETCH STUDIO ID TEMPLATES (Added in Studio ONLY)
    // -------------------------------------------------------------------------
    async function fetchStudioIdTemplates() {
        try {
            // First check if savedTemplates is already loaded in admin.js
            const localSaved = window.savedTemplates || [];
            const localIdCards = localSaved.filter(t => t.type === 'id_card');
            if (localIdCards.length > 0) {
                localIdCards.forEach(t => { studioTemplatesCache[t.id] = t; });
            }

            const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : (window.supabase || null));
            if (!client) return Object.values(studioTemplatesCache);

            let q = client.from('templates').select('*').eq('type', 'id_card');
            if (typeof festQuery === 'function') q = festQuery(q);
            else if (typeof festosApplyFilter === 'function') q = festosApplyFilter(q);
            let { data, error } = await q;

            // Fallback: fetch without strict fest filter if empty or error
            if ((!data || data.length === 0) || error) {
                const fb = await client.from('templates').select('*').eq('type', 'id_card');
                if (fb.data && fb.data.length > 0) data = fb.data;
            }

            if (Array.isArray(data) && data.length > 0) {
                data.forEach(t => { studioTemplatesCache[t.id] = t; });
                return Object.values(studioTemplatesCache);
            }
        } catch (e) {
            console.warn('Notice: Could not load Studio ID templates:', e);
        }
        return Object.values(studioTemplatesCache);
    }

    // -------------------------------------------------------------------------
    // 2. STUDIO TEMPLATE ID CARD RENDERER (Preserves Exact Aspect Ratio & Size)
    // -------------------------------------------------------------------------
    async function renderStudioCardCanvas(participant, template) {
        if (!template) {
            throw new Error('No Studio ID Card Template selected.');
        }

        // If admin.js already defined generateParticipantIDCanvas, use it
        if (typeof window.generateParticipantIDCanvas === 'function') {
            try {
                return await window.generateParticipantIDCanvas(participant, template);
            } catch (e) {
                console.warn('generateParticipantIDCanvas call error, using internal renderer:', e);
            }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const bgImg = await loadBadgeImage(template.bg_base64);
        if (!bgImg) throw new Error('Studio template background image could not be loaded.');

        canvas.width = bgImg.naturalWidth || 800;
        canvas.height = bgImg.naturalHeight || 1200;
        ctx.drawImage(bgImg, 0, 0);

        const mappedData = {
            'ParticipantName': (participant.name || '').toUpperCase(),
            'UniqueID': (participant.unique_id || String(participant.id).substring(0, 8)).toUpperCase(),
            'TeamName': (participant.teams?.name || participant.team_name || 'INDEPENDENT').toUpperCase(),
            'Category': (participant.categories?.name || participant.category_name || '').toUpperCase(),
            'Class': (participant.class_name || '').toUpperCase(),
            'ClassName': (participant.class_name || '').toUpperCase(),
            'DateOfBirth': participant.dob || ''
        };

        if (template.fields) {
            for (const [key, field] of Object.entries(template.fields)) {
                if (!field || !field.enabled) continue;

                if (field.isImage) {
                    if (key === 'Photo') {
                        let pPhoto = null;
                        if (participant.photo_url) {
                            pPhoto = await loadBadgeImage(participant.photo_url);
                        }
                        ctx.save();
                        ctx.beginPath();
                        if (ctx.roundRect) ctx.roundRect(field.x, field.y, field.w, field.h, field.radius || 0);
                        else ctx.rect(field.x, field.y, field.w, field.h);
                        ctx.clip();

                        if (pPhoto && pPhoto.naturalWidth > 0) {
                            ctx.drawImage(pPhoto, field.x, field.y, field.w, field.h);
                        } else {
                            ctx.fillStyle = '#E2E8F0';
                            ctx.fillRect(field.x, field.y, field.w, field.h);
                            ctx.fillStyle = '#94A3B8';
                            ctx.font = 'bold 24px Inter, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('NO PHOTO', field.x + (field.w / 2), field.y + (field.h / 2));
                        }
                        ctx.restore();
                    }

                    if (key === 'QRCode') {
                        const qrUrl = await generateQrDataUrl(participant.unique_id || participant.id, field.w);
                        if (qrUrl) {
                            const qrImg = await loadBadgeImage(qrUrl);
                            if (qrImg) ctx.drawImage(qrImg, field.x, field.y, field.w, field.h);
                        }
                    }
                } else {
                    const textToDraw = field.isCustom ? field.displayName : (mappedData[key] || '');
                    if (!textToDraw) continue;

                    ctx.textAlign = field.align || 'left';
                    ctx.fillStyle = field.color || '#000000';
                    ctx.font = `${field.weight || 'bold'} ${field.size || 24}px ${field.font || 'Inter, sans-serif'}`;
                    ctx.fillText(textToDraw, field.x, field.y);
                }
            }
        }

        return canvas;
    }

    // -------------------------------------------------------------------------
    // 3. REAL-TIME WYSIWYG LIVE SHEET PREVIEW GENERATOR
    // -------------------------------------------------------------------------
    let previewDebounceTimer = null;

    async function updateBadgeSheetLivePreview() {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(async () => {
            const previewCanvas = document.getElementById('badge-sheet-preview-canvas');
            if (!previewCanvas) return;

            const sheetPreset = document.getElementById('badge-sheet-preset')?.value || 'a4';
            const customW = document.getElementById('badge-custom-width')?.value;
            const customH = document.getElementById('badge-custom-height')?.value;
            const customUnit = document.getElementById('badge-custom-unit')?.value || 'mm';
            const orientation = document.querySelector('input[name="badge-orientation"]:checked')?.value || 'portrait';

            const layout = document.getElementById('badge-layout-select')?.value || '4_per_page';
            const customCols = document.getElementById('badge-custom-cols')?.value;
            const customRows = document.getElementById('badge-custom-rows')?.value;

            const templateId = document.getElementById('badge-design-select')?.value;
            const scope = document.querySelector('input[name="badge-scope"]:checked')?.value || 'all';

            const teamFilter = document.getElementById('badge-filter-team')?.value || 'all';
            const catFilter = document.getElementById('badge-filter-category')?.value || 'all';
            const sortOrder = document.getElementById('badge-sort-order')?.value || 'name';

            const includeCutMarks = document.getElementById('badge-cut-marks')?.checked !== false;
            const includeCropMarks = document.getElementById('badge-crop-marks')?.checked !== false;
            const includeHeader = document.getElementById('badge-sheet-header')?.checked !== false;

            const sheetDims = resolveSheetDimensions(sheetPreset, customW, customH, customUnit, orientation);
            const grid = resolveGridLayout(layout, customCols, customRows);

            // High-resolution canvas for crisp display
            const previewWidthPx = 700;
            const scaleFactor = previewWidthPx / sheetDims.widthMm;
            const previewHeightPx = Math.round(sheetDims.heightMm * scaleFactor);

            previewCanvas.width = previewWidthPx;
            previewCanvas.height = previewHeightPx;
            const ctx = previewCanvas.getContext('2d');

            // Draw crisp paper surface
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, previewWidthPx, previewHeightPx);

            // Subtle border around sheet edge
            ctx.strokeStyle = '#94A3B8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(1, 1, previewWidthPx - 2, previewHeightPx - 2);

            // Sheet margins
            const marginXPx = 8 * scaleFactor;
            const marginTopPx = (includeHeader ? 12 : 8) * scaleFactor;
            const marginBottomPx = 8 * scaleFactor;

            // Optional Top Sheet Header
            if (includeHeader) {
                ctx.fillStyle = '#64748B';
                ctx.font = `bold ${Math.max(10, Math.round(2.6 * scaleFactor))}px Inter, sans-serif`;
                ctx.textAlign = 'left';
                const festName = (typeof getActiveFestName === 'function' ? getActiveFestName() : 'FESTOS 2026').toUpperCase();
                ctx.fillText(`${festName} • ID BADGE SHEET (PREVIEW)`, marginXPx, 7 * scaleFactor);

                ctx.textAlign = 'right';
                ctx.font = `normal ${Math.max(9, Math.round(2.2 * scaleFactor))}px Inter, sans-serif`;
                ctx.fillText(`${grid.name}`, previewWidthPx - marginXPx, 7 * scaleFactor);

                ctx.strokeStyle = '#CBD5E1';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(marginXPx, 8.5 * scaleFactor);
                ctx.lineTo(previewWidthPx - marginXPx, 8.5 * scaleFactor);
                ctx.stroke();
            }

            // Gather Target Participants according to scope
            let rawList = [];
            if (scope === 'selected') {
                let ids = [];
                if (typeof getSelectedIds === 'function') {
                    ids = getSelectedIds('participants-tbody') || getSelectedIds('students-tbody') || [];
                }
                if (ids.length === 0) {
                    document.querySelectorAll('#participants-tbody input[type="checkbox"]:checked, #students-tbody input[type="checkbox"]:checked').forEach(cb => {
                        if (cb.value) ids.push(cb.value);
                    });
                }
                const idSet = new Set(ids.map(String));
                const pool = window.participantsList || window.studentsList || window.globalStudents || [];
                rawList = pool.filter(p => idSet.has(String(p.id)));
            } else if (scope === 'filtered' && window.filteredParticipantsList && window.filteredParticipantsList.length > 0) {
                rawList = [...window.filteredParticipantsList];
            } else {
                rawList = [...(window.participantsList || window.studentsList || window.globalStudents || [])];
            }

            // Apply Team, Category, and Sort Order Filters
            const filteredParticipants = filterAndSortParticipants(rawList, teamFilter, catFilter, sortOrder);

            // Update live specs display
            const countEl = document.getElementById('badge-preview-count');
            if (countEl) {
                const totalCount = filteredParticipants.length;
                const pages = Math.ceil(totalCount / grid.count) || 1;
                countEl.innerText = `${totalCount} participant${totalCount !== 1 ? 's' : ''} • ${pages} page${pages !== 1 ? 's' : ''}`;
            }

            // Resolve Studio Template
            let template = null;
            if (templateId && studioTemplatesCache[templateId]) {
                template = studioTemplatesCache[templateId];
            } else {
                const allTpls = Object.values(studioTemplatesCache);
                if (allTpls.length > 0) template = allTpls[0];
            }

            // If no participants match criteria
            if (filteredParticipants.length === 0) {
                ctx.fillStyle = '#64748B';
                ctx.font = '600 18px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No participants match current filters.', previewWidthPx / 2, previewHeightPx / 2 - 10);
                ctx.font = '14px Inter, sans-serif';
                ctx.fillStyle = '#94A3B8';
                ctx.fillText('Select another Team or Category to preview badges.', previewWidthPx / 2, previewHeightPx / 2 + 18);
                return;
            }

            // Usable cell area
            const usableWPx = previewWidthPx - 2 * marginXPx;
            const usableHPx = previewHeightPx - marginTopPx - marginBottomPx;

            const cellGapXPx = grid.cols > 1 ? 4 * scaleFactor : 0;
            const cellGapYPx = grid.rows > 1 ? 4 * scaleFactor : 0;

            const cellWPx = (usableWPx - (grid.cols - 1) * cellGapXPx) / grid.cols;
            const cellHPx = (usableHPx - (grid.rows - 1) * cellGapYPx) / grid.rows;

            // Render first participant to calculate card aspect ratio
            const sampleP = filteredParticipants[0];
            let sampleCardCanvas = null;

            if (template) {
                try {
                    sampleCardCanvas = await renderStudioCardCanvas(sampleP, template);
                } catch (e) {
                    console.warn('Preview render error:', e);
                }
            }

            if (!sampleCardCanvas) {
                ctx.fillStyle = '#EF4444';
                ctx.font = 'bold 16px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No Studio ID Template found in Studio.', previewWidthPx / 2, previewHeightPx / 2);
                ctx.font = '14px Inter, sans-serif';
                ctx.fillStyle = '#64748B';
                ctx.fillText('Please create an ID Card template in the Studio first.', previewWidthPx / 2, previewHeightPx / 2 + 24);
                return;
            }

            // Fit card canvas proportionally within cell (Preserve Studio Template Aspect Ratio!)
            const cardAspect = sampleCardCanvas.width / sampleCardCanvas.height;
            const cellAspect = cellWPx / cellHPx;

            let drawWPx, drawHPx;
            if (cardAspect > cellAspect) {
                drawWPx = cellWPx;
                drawHPx = cellWPx / cardAspect;
            } else {
                drawHPx = cellHPx;
                drawWPx = cellHPx * cardAspect;
            }

            // Draw grid cells and badges
            for (let r = 0; r < grid.rows; r++) {
                for (let c = 0; c < grid.cols; c++) {
                    const cellIdx = r * grid.cols + c;
                    const participant = filteredParticipants[cellIdx % filteredParticipants.length];

                    const cellX = marginXPx + c * (cellWPx + cellGapXPx);
                    const cellY = marginTopPx + r * (cellHPx + cellGapYPx);

                    // 1. Dotted Cut Marks
                    if (includeCutMarks) {
                        ctx.save();
                        ctx.setLineDash([4, 4]);
                        ctx.strokeStyle = '#CBD5E1';
                        ctx.lineWidth = 1.2;
                        ctx.strokeRect(cellX, cellY, cellWPx, cellHPx);
                        ctx.restore();
                    }

                    // 2. Card placement
                    const posX = cellX + (cellWPx - drawWPx) / 2;
                    const posY = cellY + (cellHPx - drawHPx) / 2;

                    let pCardCanvas = sampleCardCanvas;
                    if (cellIdx > 0 && template) {
                        try {
                            pCardCanvas = await renderStudioCardCanvas(participant, template);
                        } catch (err) {
                            pCardCanvas = sampleCardCanvas;
                        }
                    }

                    ctx.drawImage(pCardCanvas, posX, posY, drawWPx, drawHPx);

                    // 3. Corner Crop Marks (ticks)
                    if (includeCropMarks) {
                        ctx.strokeStyle = '#64748B';
                        ctx.lineWidth = 1.2;
                        const tickLen = 2.5 * scaleFactor;
                        const offset = 0.8 * scaleFactor;

                        // TL
                        ctx.beginPath();
                        ctx.moveTo(posX - offset - tickLen, posY); ctx.lineTo(posX - offset, posY);
                        ctx.moveTo(posX, posY - offset - tickLen); ctx.lineTo(posX, posY - offset);
                        // TR
                        ctx.moveTo(posX + drawWPx + offset, posY); ctx.lineTo(posX + drawWPx + offset + tickLen, posY);
                        ctx.moveTo(posX + drawWPx, posY - offset - tickLen); ctx.lineTo(posX + drawWPx, posY - offset);
                        // BL
                        ctx.moveTo(posX - offset - tickLen, posY + drawHPx); ctx.lineTo(posX - offset, posY + drawHPx);
                        ctx.moveTo(posX, posY + drawHPx + offset); ctx.lineTo(posX, posY + drawHPx + offset + tickLen);
                        // BR
                        ctx.moveTo(posX + drawWPx + offset, posY + drawHPx); ctx.lineTo(posX + drawWPx + offset + tickLen, posY + drawHPx);
                        ctx.moveTo(posX + drawWPx, posY + drawHPx + offset); ctx.lineTo(posX + drawWPx, posY + drawHPx + offset + tickLen);
                        ctx.stroke();
                    }
                }
            }

            // Update live specs display
            const badgeWidthMm = Math.round((drawWPx / scaleFactor) * 10) / 10;
            const badgeHeightMm = Math.round((drawHPx / scaleFactor) * 10) / 10;

            const specEl = document.getElementById('badge-preview-specs');
            if (specEl) {
                specEl.innerText = `${sheetDims.name}: ${sheetDims.widthMm} × ${sheetDims.heightMm} mm (${sheetDims.orientation.toUpperCase()}) • Grid: ${grid.cols}×${grid.rows} • Badge Size: ~${badgeWidthMm}×${badgeHeightMm} mm`;
            }

        }, 40);
    }

    // -------------------------------------------------------------------------
    // 4. MULTI-PAGE SHEET COMPOSER & PDF EXPORTER
    // -------------------------------------------------------------------------
    async function generateCustomBadgeSheetPdf(participants, options = {}, onProgress = null) {
        if (!participants || participants.length === 0) {
            throw new Error('No participants provided for badge generation.');
        }

        const jsPdfLib = window.jspdf ? window.jspdf.jsPDF : (typeof jsPDF !== 'undefined' ? jsPDF : null);
        if (!jsPdfLib) {
            throw new Error('jsPDF library is not loaded. Please verify script inclusion.');
        }

        // 1. Resolve Sheet Dimensions & Orientation
        const sheetDims = resolveSheetDimensions(
            options.sheetPreset || 'a4',
            options.customWidth,
            options.customHeight,
            options.customUnit || 'mm',
            options.orientation || 'portrait'
        );

        // 2. Resolve Grid Layout
        const grid = resolveGridLayout(
            options.layout || '4_per_page',
            options.customCols,
            options.customRows
        );

        // 3. Studio Template
        let template = null;
        if (options.templateId && studioTemplatesCache[options.templateId]) {
            template = studioTemplatesCache[options.templateId];
        } else {
            const allTpls = Object.values(studioTemplatesCache);
            if (allTpls.length > 0) template = allTpls[0];
            else {
                const fresh = await fetchStudioIdTemplates();
                if (fresh.length > 0) template = fresh[0];
            }
        }

        if (!template) {
            throw new Error('No Studio ID Card Template found. Please create one in the Studio first.');
        }

        const includeCutMarks = options.includeCutMarks !== false;
        const includeCropMarks = options.includeCropMarks !== false;
        const includeHeader = options.includeHeader !== false;

        const sheetW = sheetDims.widthMm;
        const sheetH = sheetDims.heightMm;

        // Initialize jsPDF
        const pdf = new jsPdfLib({
            orientation: sheetDims.orientation,
            unit: 'mm',
            format: [sheetW, sheetH],
            compress: true
        });

        // Sheet Padding & Usable Space
        const marginX = 8;
        const marginTop = includeHeader ? 12 : 8;
        const marginBottom = 8;
        const usableW = sheetW - 2 * marginX;
        const usableH = sheetH - marginTop - marginBottom;

        const cellGapX = grid.cols > 1 ? 4 : 0;
        const cellGapY = grid.rows > 1 ? 4 : 0;

        const cellW = (usableW - (grid.cols - 1) * cellGapX) / grid.cols;
        const cellH = (usableH - (grid.rows - 1) * cellGapY) / grid.rows;

        const totalBadges = participants.length;
        const cardsPerPage = grid.count;
        const totalPages = Math.ceil(totalBadges / cardsPerPage);

        const festName = (options.festName || (typeof getActiveFestName === 'function' ? getActiveFestName() : 'FestOS 2026')).toUpperCase();

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            if (pageIdx > 0) pdf.addPage([sheetW, sheetH], sheetDims.orientation);

            // Optional Top Sheet Header
            if (includeHeader) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`${festName} • ID BADGE PRINT SHEET`, marginX, 7);

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7.5);
                pdf.text(`Page ${pageIdx + 1} of ${totalPages}  |  ${grid.name}  |  Generated ${new Date().toLocaleDateString()}`, sheetW - marginX, 7, { align: 'right' });

                pdf.setDrawColor(226, 232, 240);
                pdf.setLineWidth(0.3);
                pdf.line(marginX, 8.5, sheetW - marginX, 8.5);
            }

            const pageStart = pageIdx * cardsPerPage;
            const pageParticipants = participants.slice(pageStart, pageStart + cardsPerPage);

            for (let i = 0; i < pageParticipants.length; i++) {
                const participant = pageParticipants[i];
                const globalIndex = pageStart + i;

                if (typeof onProgress === 'function') {
                    onProgress(globalIndex + 1, totalBadges);
                }

                const col = i % grid.cols;
                const row = Math.floor(i / grid.cols);

                const cellX = marginX + col * (cellW + cellGapX);
                const cellY = marginTop + row * (cellH + cellGapY);

                // 1. Draw Dotted Cut Marks (Bounding Cell)
                if (includeCutMarks) {
                    pdf.setDrawColor(203, 213, 225);
                    pdf.setLineWidth(0.25);
                    pdf.setLineDashPattern([1.5, 1.5], 0);
                    pdf.rect(cellX, cellY, cellW, cellH);
                    pdf.setLineDashPattern([], 0);
                }

                // 2. Render Card Canvas using Studio Template (Exact natural dimensions)
                const cardCanvas = await renderStudioCardCanvas(participant, template);

                // 3. Fit Card Canvas Proportionally inside Cell (NO STRETCHING, Exact Aspect Ratio!)
                const cardAspect = cardCanvas.width / cardCanvas.height;
                const cellAspect = cellW / cellH;

                let drawW, drawH;
                if (cardAspect > cellAspect) {
                    drawW = cellW;
                    drawH = cellW / cardAspect;
                } else {
                    drawH = cellH;
                    drawW = cellH * cardAspect;
                }

                // Center card within cell
                const posX = cellX + (cellW - drawW) / 2;
                const posY = cellY + (cellH - drawH) / 2;

                const imgData = cardCanvas.toDataURL('image/jpeg', 0.94);
                pdf.addImage(imgData, 'JPEG', posX, posY, drawW, drawH);

                // 4. Corner Crop Marks / Guillotine Ticks (Outside card bounds)
                if (includeCropMarks) {
                    pdf.setDrawColor(100, 116, 139);
                    pdf.setLineWidth(0.2);
                    const tickLen = 2.5;
                    const offset = 0.8;

                    // Top-Left
                    pdf.line(posX - offset - tickLen, posY, posX - offset, posY);
                    pdf.line(posX, posY - offset - tickLen, posX, posY - offset);

                    // Top-Right
                    pdf.line(posX + drawW + offset, posY, posX + drawW + offset + tickLen, posY);
                    pdf.line(posX + drawW, posY - offset - tickLen, posX + drawW, posY - offset);

                    // Bottom-Left
                    pdf.line(posX - offset - tickLen, posY + drawH, posX - offset, posY + drawH);
                    pdf.line(posX, posY + drawH + offset, posX, posY + drawH + offset + tickLen);

                    // Bottom-Right
                    pdf.line(posX + drawW + offset, posY + drawH, posX + drawW + offset + tickLen, posY + drawH);
                    pdf.line(posX + drawW, posY + drawH + offset, posX + drawW, posY + drawH + offset + tickLen);
                }
            }
        }

        return pdf;
    }

    // -------------------------------------------------------------------------
    // 5. UI CONTROLLER: Open Modal & Execute Generation
    // -------------------------------------------------------------------------
    async function initBulkBadgeUI(defaultSource = 'all') {
        const modal = document.getElementById('bulkBadgeModal');
        if (!modal) return;

        // 1. Populate CARD DESIGN SOURCE Dropdown with ONLY Studio ID Templates
        const designSelect = document.getElementById('badge-design-select');
        if (designSelect) {
            designSelect.innerHTML = '<option value="">Loading Studio Templates...</option>';
            const studioTemplates = await fetchStudioIdTemplates();
            designSelect.innerHTML = '';

            if (studioTemplates.length === 0) {
                designSelect.innerHTML = '<option value="">No Studio ID Template found (Create in Studio)</option>';
            } else {
                studioTemplates.forEach((tpl, idx) => {
                    const isSel = idx === 0 ? 'selected' : '';
                    designSelect.innerHTML += `<option value="${tpl.id}" ${isSel}>${tpl.name.toUpperCase()} (${tpl.id})</option>`;
                });
            }
        }

        // 2. Populate TEAMS Dropdown inside modal
        const teamSelect = document.getElementById('badge-filter-team');
        if (teamSelect) {
            teamSelect.innerHTML = '<option value="all">ALL TEAMS</option>';
            let tList = window.teamsList || (typeof teamsList !== 'undefined' ? teamsList : []);

            // If empty, look at #filterPartTeam in DOM
            if (!tList || tList.length === 0) {
                const domSelect = document.getElementById('filterPartTeam');
                if (domSelect && domSelect.options.length > 1) {
                    Array.from(domSelect.options).forEach(opt => {
                        if (opt.value && opt.value !== '') {
                            teamSelect.innerHTML += `<option value="${opt.value}">${opt.text.toUpperCase()}</option>`;
                        }
                    });
                }
            } else {
                tList.forEach(t => {
                    teamSelect.innerHTML += `<option value="${t.id}">${t.name.toUpperCase()}</option>`;
                });
            }

            // Fallback fetch from Supabase if still empty
            if (teamSelect.options.length <= 1) {
                const client = window.supabaseClient || window.supabase;
                if (client) {
                    let tQ = client.from('teams').select('id, name').order('name');
                    if (window.festosApplyFilter) tQ = window.festosApplyFilter(tQ);
                    tQ.then(({ data }) => {
                        if (data && data.length > 0) {
                            teamSelect.innerHTML = '<option value="all">ALL TEAMS</option>';
                            data.forEach(t => {
                                teamSelect.innerHTML += `<option value="${t.id}">${t.name.toUpperCase()}</option>`;
                            });
                        }
                    });
                }
            }
        }

        // 3. Populate CATEGORIES Dropdown inside modal
        const catSelect = document.getElementById('badge-filter-category');
        if (catSelect) {
            catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
            let cList = window.categoriesList || window.globalCategories || (typeof categoriesList !== 'undefined' ? categoriesList : []);

            // If empty, look at #filterCategory in DOM
            if (!cList || cList.length === 0) {
                const domSelect = document.getElementById('filterCategory');
                if (domSelect && domSelect.options.length > 1) {
                    Array.from(domSelect.options).forEach(opt => {
                        if (opt.value && opt.value !== '') {
                            catSelect.innerHTML += `<option value="${opt.value}">${opt.text.toUpperCase()}</option>`;
                        }
                    });
                }
            } else {
                cList.forEach(c => {
                    catSelect.innerHTML += `<option value="${c.id}">${c.name.toUpperCase()}</option>`;
                });
            }

            // Fallback fetch from Supabase if still empty
            if (catSelect.options.length <= 1) {
                const client = window.supabaseClient || window.supabase;
                if (client) {
                    let cQ = client.from('categories').select('id, name').order('name');
                    if (window.festosApplyFilter) cQ = window.festosApplyFilter(cQ);
                    cQ.then(({ data }) => {
                        if (data && data.length > 0) {
                            catSelect.innerHTML = '<option value="all">ALL CATEGORIES</option>';
                            data.forEach(c => {
                                catSelect.innerHTML += `<option value="${c.id}">${c.name.toUpperCase()}</option>`;
                            });
                        }
                    });
                }
            }
        }

        // 4. Check if rows are selected in table
        let selectedCount = 0;
        if (typeof getSelectedIds === 'function') {
            selectedCount = (getSelectedIds('participants-tbody') || getSelectedIds('students-tbody') || []).length;
        } else {
            selectedCount = document.querySelectorAll('#participants-tbody input[type="checkbox"]:checked, #students-tbody input[type="checkbox"]:checked').length;
        }

        const selectedRadio = document.querySelector('input[name="badge-scope"][value="selected"]');
        const selectedCountLabel = document.getElementById('badge-selected-count-label');
        if (selectedCountLabel) selectedCountLabel.innerText = `(${selectedCount})`;

        if (selectedCount > 0 && selectedRadio) {
            selectedRadio.checked = true;
        } else {
            const allRadio = document.querySelector('input[name="badge-scope"][value="all"]');
            if (allRadio) allRadio.checked = true;
        }

        // Reset progress bar
        const progressBox = document.getElementById('badge-progress-box');
        const progressBar = document.getElementById('badge-progress-bar');
        const progressText = document.getElementById('badge-progress-text');
        const btnGen = document.getElementById('btn-generate-badges');

        if (progressBox) progressBox.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = 'Initializing...';
        if (btnGen) {
            btnGen.disabled = false;
            btnGen.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generate & Download PDF';
        }

        modal.classList.add('show');

        // Immediately trigger initial live preview
        setTimeout(() => updateBadgeSheetLivePreview(), 60);
    }

    async function executeBadgeGeneration(isPrintOnly = false) {
        const scope = document.querySelector('input[name="badge-scope"]:checked')?.value || 'all';
        const sheetPreset = document.getElementById('badge-sheet-preset')?.value || 'a4';
        const customW = document.getElementById('badge-custom-width')?.value;
        const customH = document.getElementById('badge-custom-height')?.value;
        const customUnit = document.getElementById('badge-custom-unit')?.value || 'mm';
        const orientation = document.querySelector('input[name="badge-orientation"]:checked')?.value || 'portrait';

        const layout = document.getElementById('badge-layout-select')?.value || '4_per_page';
        const customCols = document.getElementById('badge-custom-cols')?.value;
        const customRows = document.getElementById('badge-custom-rows')?.value;

        const templateId = document.getElementById('badge-design-select')?.value;
        const sortOrder = document.getElementById('badge-sort-order')?.value || 'name';

        const teamFilter = document.getElementById('badge-filter-team')?.value || 'all';
        const catFilter = document.getElementById('badge-filter-category')?.value || 'all';
        const includeCutMarks = document.getElementById('badge-cut-marks')?.checked !== false;
        const includeCropMarks = document.getElementById('badge-crop-marks')?.checked !== false;
        const includeHeader = document.getElementById('badge-sheet-header')?.checked !== false;

        let participants = [];

        // 1. Gather Target Participants based on Scope
        if (scope === 'selected') {
            let ids = [];
            if (typeof getSelectedIds === 'function') {
                ids = getSelectedIds('participants-tbody') || getSelectedIds('students-tbody') || [];
            }
            if (ids.length === 0) {
                document.querySelectorAll('#participants-tbody input[type="checkbox"]:checked, #students-tbody input[type="checkbox"]:checked').forEach(cb => {
                    if (cb.value) ids.push(cb.value);
                });
            }

            if (ids.length === 0) {
                if (typeof showToast === 'function') showToast('Please select at least one participant in the table checkboxes first.', 'warning');
                return;
            }

            const idSet = new Set(ids.map(String));
            const sourceList = window.participantsList || window.studentsList || window.globalStudents || [];
            participants = sourceList.filter(p => idSet.has(String(p.id)));

            // If empty in local cache, fetch directly by IDs from Supabase
            if (participants.length === 0 && (window.supabaseClient || window.supabase)) {
                try {
                    const client = window.supabaseClient || window.supabase;
                    let pQ = client.from('participants').select('*, categories(name), teams(name)').in('id', ids);
                    if (window.festosApplyFilter) pQ = window.festosApplyFilter(pQ);
                    const { data } = await pQ;
                    if (data) participants = data;
                } catch (e) {
                    console.warn('Direct ID fetch notice:', e);
                }
            }
        } else if (scope === 'filtered' && window.filteredParticipantsList && window.filteredParticipantsList.length > 0) {
            participants = [...window.filteredParticipantsList];
        } else {
            participants = [...(window.participantsList || window.studentsList || window.globalStudents || [])];
        }

        // TIER-4 FALLBACK: If participants is still empty, directly fetch entire roster from Supabase!
        if (participants.length === 0 && (window.supabaseClient || window.supabase)) {
            try {
                const client = window.supabaseClient || window.supabase;
                let q = client.from('participants').select('*, categories(name), teams(name)').order('name');
                if (window.festosApplyFilter) {
                    q = window.festosApplyFilter(q);
                } else if (typeof festQuery === 'function') {
                    q = festQuery(q);
                }
                const { data } = await q;
                if (data && data.length > 0) participants = data;
            } catch (err) {
                console.warn('Fallback roster fetch notice:', err);
            }
        }

        // Apply secondary filters (Team & Category) and Sorting
        participants = filterAndSortParticipants(participants, teamFilter, catFilter, sortOrder);

        if (participants.length === 0) {
            if (typeof showToast === 'function') showToast('No matching participants found for this selection.', 'error');
            return;
        }

        // UI Progress State
        const progressBox = document.getElementById('badge-progress-box');
        const progressBar = document.getElementById('badge-progress-bar');
        const progressText = document.getElementById('badge-progress-text');
        const btnGen = document.getElementById('btn-generate-badges');

        if (progressBox) progressBox.style.display = 'block';
        if (btnGen) {
            btnGen.disabled = true;
            btnGen.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering Badges...';
        }

        try {
            const activeFestName = (typeof getActiveFestName === 'function') ? getActiveFestName() : (window.festosAuth?.getActiveFestName?.() || 'FestOS 2026');

            const pdf = await generateCustomBadgeSheetPdf(participants, {
                sheetPreset,
                customWidth: customW,
                customHeight: customH,
                customUnit,
                orientation,
                layout,
                customCols,
                customRows,
                templateId,
                includeCutMarks,
                includeCropMarks,
                includeHeader,
                festName: activeFestName
            }, (current, total) => {
                const pct = Math.round((current / total) * 100);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressText) progressText.innerText = `Rendering badge ${current} of ${total} (${pct}%)...`;
            });

            if (progressText) progressText.innerText = 'Finalizing document...';

            if (isPrintOnly) {
                const blob = pdf.output('blob');
                const blobUrl = URL.createObjectURL(blob);
                const printWindow = window.open(blobUrl, '_blank');
                if (printWindow) {
                    printWindow.onload = () => {
                        printWindow.print();
                    };
                }
                if (typeof showToast === 'function') showToast('Print view opened in new tab!', 'success');
            } else {
                const cleanFest = activeFestName.replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `${cleanFest}_ID_Badges_${sheetPreset}_${layout}.pdf`;
                pdf.save(filename);
                if (typeof showToast === 'function') showToast(`Successfully exported ${participants.length} badges!`, 'success');
            }

            // Close modal after brief pause
            setTimeout(() => {
                const modal = document.getElementById('bulkBadgeModal');
                if (modal) modal.classList.remove('show');
            }, 600);

        } catch (err) {
            console.error('Badge generation failure:', err);
            if (typeof showToast === 'function') showToast('Badge generation failed: ' + err.message, 'error');
        } finally {
            if (btnGen) {
                btnGen.disabled = false;
                btnGen.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generate & Download PDF';
            }
        }
    }

    // Expose engine to global window
    window.festosBadgeEngine = {
        generateBarcodeDataUrl,
        generateQrDataUrl,
        renderStudioCardCanvas,
        resolveSheetDimensions,
        resolveGridLayout,
        filterAndSortParticipants,
        fetchStudioIdTemplates,
        generateCustomBadgeSheetPdf,
        updateBadgeSheetLivePreview,
        openBulkBadgeModal: initBulkBadgeUI,
        executeBadgeGeneration
    };

    // Global aliases
    window.openBulkBadgeModal = initBulkBadgeUI;
    window.openBulkBadgeModalTM = () => initBulkBadgeUI('all');
    window.executeBadgeGeneration = executeBadgeGeneration;
    window.updateBadgeSheetLivePreview = updateBadgeSheetLivePreview;

})(window);
