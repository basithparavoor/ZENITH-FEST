/**
 * FestOS Preset Templates Engine (preset-templates-engine.js)
 * Provides high-resolution, professionally designed system-generated templates for:
 * 1. Individual Event Winner Result Posters (Royal Gold Champion & Cyber Neon Apex)
 * 2. Team Standings Leaderboard Posters (Broadcast Pro & Crimson Apex)
 * 3. Final Championship Overall Posters (Grand Finale Trophy)
 * 4. Participant ID Badges (Executive Lanyard & CR80 Pocket Identity)
 * 5. Merit & Participation Certificates (Gold Ornate Excellence & Royal Blue Crest)
 */

(function (window) {
    'use strict';

    // -------------------------------------------------------------------------
    // 1. PROCEDURAL BACKGROUND CANVAS GENERATORS
    // -------------------------------------------------------------------------

    // Helper: Draw rounded rectangle
    function drawRRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }
    }

    // Helper: Draw star
    function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fill) {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    }

    // 1. Individual Result: Royal Gold Champion (1080 x 1440)
    function generateBgIndividualRoyalGold() {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1440;
        const ctx = canvas.getContext('2d');

        // Dark obsidian gradient background
        const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1440);
        bgGrad.addColorStop(0, '#090D16');
        bgGrad.addColorStop(0.5, '#13192B');
        bgGrad.addColorStop(1, '#080C14');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1440);

        // Radiant golden spotlights from top
        const spotGrad = ctx.createRadialGradient(540, 0, 50, 540, 500, 700);
        spotGrad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
        spotGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.05)');
        spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, 1080, 900);

        // Ornate outer double border with gold sheen
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.strokeRect(28, 28, 1024, 1384);

        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(38, 38, 1004, 1364);

        // Corner diamond flourishes
        [[38, 38], [1042, 38], [38, 1402], [1042, 1402]].forEach(([cx, cy]) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#F59E0B';
            ctx.fillRect(-8, -8, 16, 16);
            ctx.restore();
        });

        // Top Fest Badge Header
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        drawRRect(ctx, 390, 55, 300, 42, 21);
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FCD34D';
        ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OFFICIAL EVENT RESULTS', 540, 82);

        // Gold Laurel ribbon
        drawStar(ctx, 540, 118, 5, 12, 6, '#F59E0B');

        // Central 1st Place Podium Backplate (Center, elevated)
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        drawRRect(ctx, 370, 315, 340, 590, 28);
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 1st Place Crown Emblem / Aura
        drawStar(ctx, 540, 305, 5, 20, 9, '#FDE047');

        // 2nd Place Podium Backplate (Left)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
        drawRRect(ctx, 80, 475, 280, 510, 24);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3rd Place Podium Backplate (Right)
        ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
        drawRRect(ctx, 720, 475, 280, 510, 24);
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bottom Decorative Ribbon Footer
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(40, 1340, 1000, 60);
        ctx.fillStyle = '#64748B';
        ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FESTOS VERIFIED CHAMPIONSHIP RECORD • PUBLISHED OFFICIALLY', 540, 1375);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 2. Individual Result: Cyber Neon Apex (1080 x 1440)
    function generateBgIndividualCyberApex() {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1440;
        const ctx = canvas.getContext('2d');

        // Dark cyber carbon background
        ctx.fillStyle = '#090B10';
        ctx.fillRect(0, 0, 1080, 1440);

        // Angled cyber neon polygons
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(600, 0); ctx.lineTo(400, 1440); ctx.lineTo(0, 1440);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
        ctx.beginPath();
        ctx.moveTo(500, 0); ctx.lineTo(1080, 0); ctx.lineTo(1080, 1440); ctx.lineTo(350, 1440);
        ctx.closePath();
        ctx.fill();

        // Neon Framing
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 3;
        ctx.strokeRect(30, 30, 1020, 1380);

        // Card Podiums
        // 1st Center
        ctx.fillStyle = '#101626';
        drawRRect(ctx, 360, 320, 360, 580, 20);
        ctx.fill();
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 2nd Left
        ctx.fillStyle = '#101626';
        drawRRect(ctx, 80, 480, 260, 490, 18);
        ctx.fill();
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3rd Right
        ctx.fillStyle = '#101626';
        drawRRect(ctx, 740, 480, 260, 490, 18);
        ctx.fill();
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 2;
        ctx.stroke();

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 3. Team Standings: Championship Leaderboard Pro (1080 x 1440)
    function generateBgTeamLeaderboard() {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1440;
        const ctx = canvas.getContext('2d');

        // Deep Navy Gradient
        const grad = ctx.createLinearGradient(0, 0, 1080, 1440);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(0.5, '#1E1B4B');
        grad.addColorStop(1, '#0F172A');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1440);

        // Outer Framing
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 3;
        ctx.strokeRect(30, 30, 1020, 1380);

        // Header Title Box
        ctx.fillStyle = '#312E81';
        drawRRect(ctx, 80, 60, 920, 90, 18);
        ctx.fill();
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LIVE TEAM CHAMPIONSHIP STANDINGS', 540, 118);

        // 10 Team Leaderboard Stripes
        const stripeY = 240;
        const stripeH = 96;
        const gap = 16;

        for (let i = 0; i < 10; i++) {
            const y = stripeY + i * (stripeH + gap);
            if (y + stripeH > 1360) break;

            const isTop3 = i < 3;
            ctx.fillStyle = isTop3 ? (i === 0 ? 'rgba(245, 158, 11, 0.15)' : (i === 1 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(217, 119, 6, 0.1)')) : 'rgba(255, 255, 255, 0.04)';
            drawRRect(ctx, 80, y, 920, stripeH, 14);
            ctx.fill();

            ctx.strokeStyle = isTop3 ? (i === 0 ? '#F59E0B' : (i === 1 ? '#94A3B8' : '#D97706')) : 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = isTop3 ? 2 : 1;
            ctx.stroke();

            // Rank Number Badge on left
            ctx.fillStyle = isTop3 ? (i === 0 ? '#F59E0B' : (i === 1 ? '#94A3B8' : '#D97706')) : '#475569';
            drawRRect(ctx, 95, y + 18, 60, 60, 12);
            ctx.fill();
        }

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 4. Final Results: Grand Finale Championship (1080 x 1440)
    function generateBgFinalChampionship() {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1440;
        const ctx = canvas.getContext('2d');

        // Royal Purple & Gold Majesty
        const grad = ctx.createLinearGradient(0, 0, 1080, 1440);
        grad.addColorStop(0, '#1E1B4B');
        grad.addColorStop(0.5, '#2E1065');
        grad.addColorStop(1, '#0F172A');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1440);

        // Gold Trim
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.strokeRect(28, 28, 1024, 1384);

        // Grand Trophy Header
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        drawRRect(ctx, 60, 50, 960, 100, 20);
        ctx.fill();
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 40px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GRAND OVERALL CHAMPIONSHIP', 540, 114);

        // Stripes for Final Rankings
        const startY = 240;
        const h = 96;
        for (let i = 0; i < 10; i++) {
            const y = startY + i * 112;
            if (y + h > 1370) break;
            ctx.fillStyle = i === 0 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.05)';
            drawRRect(ctx, 80, y, 920, h, 16);
            ctx.fill();

            ctx.strokeStyle = i === 0 ? '#F59E0B' : 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = i === 0 ? 2.5 : 1;
            ctx.stroke();
        }

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 5. Participant ID Card: Executive Lanyard Pass (Portrait 900 x 1300)
    function generateBgIdLanyard() {
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 1300;
        const ctx = canvas.getContext('2d');

        // Base card
        ctx.fillStyle = '#FFFFFF';
        drawRRect(ctx, 12, 12, 876, 1276, 32);
        ctx.fill();

        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Top Header in Royal Indigo
        ctx.save();
        drawRRect(ctx, 12, 12, 876, 1276, 32);
        ctx.clip();
        const headerGrad = ctx.createLinearGradient(0, 0, 900, 0);
        headerGrad.addColorStop(0, '#1E1B4B');
        headerGrad.addColorStop(1, '#3730A3');
        ctx.fillStyle = headerGrad;
        ctx.fillRect(12, 12, 876, 140);

        // Gold Accent Stripe under header
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(12, 148, 876, 6);
        ctx.restore();

        // Header Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OFFICIAL IDENTITY PASS', 450, 78);

        ctx.fillStyle = '#A5B4FC';
        ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('FESTIVAL CREDENTIAL & ACCESS CARD', 450, 116);

        // Photo Bounding Box Guide
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 3;
        drawRRect(ctx, 275, 180, 350, 430, 24);
        ctx.stroke();

        // Subtle watermark
        ctx.fillStyle = '#F1F5F9';
        drawRRect(ctx, 80, 680, 740, 140, 16);
        ctx.fill();

        // Bottom Strip
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(12, 1220, 876, 68);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NON-TRANSFERABLE • MUST BE DISPLAYED AT ALL TIMES', 450, 1260);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 6. Participant ID Card: CR80 Pocket Identity Badge (Landscape 900 x 580)
    function generateBgIdCr80() {
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 580;
        const ctx = canvas.getContext('2d');

        // Base card
        ctx.fillStyle = '#FFFFFF';
        drawRRect(ctx, 8, 8, 884, 564, 22);
        ctx.fill();

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Top Header
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(24, 8, 868, 56);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('FESTOS VERIFIED PASS', 45, 44);

        ctx.fillStyle = '#F59E0B';
        ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('PARTICIPANT BADGE', 860, 43);

        // Left photo frame guide
        ctx.strokeStyle = '#4F46E5';
        ctx.lineWidth = 2.5;
        drawRRect(ctx, 50, 70, 220, 270, 16);
        ctx.stroke();

        // Left accent stripe
        ctx.fillStyle = '#4F46E5';
        ctx.fillRect(8, 8, 16, 564);

        // Bottom Strip
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(24, 530, 868, 42);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SECURE SMART ID • BARCODE SCANNABLE AT ENTRY CHECKPOINTS', 460, 556);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 7. Certificate: Gold Ornate Merit & Excellence (Landscape 1600 x 1130)
    function generateBgCertGoldOrnate() {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1130;
        const ctx = canvas.getContext('2d');

        // Warm Cream Ivory Surface
        ctx.fillStyle = '#FDFDFB';
        ctx.fillRect(0, 0, 1600, 1130);

        // Gold Ornate Double Frame
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 6;
        ctx.strokeRect(36, 36, 1528, 1058);

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, 1500, 1030);

        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 1;
        ctx.strokeRect(58, 58, 1484, 1014);

        // Corner Ornate Diamond Flourishes
        [[50, 50], [1550, 50], [50, 1080], [1550, 1080]].forEach(([cx, cy]) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#D97706';
            ctx.fillRect(-12, -12, 24, 24);
            ctx.restore();
        });

        // Top Gold Heraldic Crest
        drawStar(ctx, 800, 130, 5, 24, 10, '#D97706');
        drawStar(ctx, 750, 132, 5, 14, 6, '#F59E0B');
        drawStar(ctx, 850, 132, 5, 14, 6, '#F59E0B');

        // Certificate Header
        ctx.fillStyle = '#78350F';
        ctx.font = '800 48px "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.fillText('CERTIFICATE OF MERIT', 800, 210);

        ctx.fillStyle = '#B45309';
        ctx.font = '600 20px "Times New Roman", serif';
        ctx.letterSpacing = '4px';
        ctx.fillText('THIS CERTIFICATE IS PROUDLY PRESENTED TO', 800, 250);

        // Twin Signature Lines at bottom
        // Line 1: Fest Director
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(250, 960); ctx.lineTo(550, 960);
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.font = '700 16px "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.fillText('FESTIVAL DIRECTOR', 400, 990);

        // Line 2: Chief Judge
        ctx.beginPath();
        ctx.moveTo(1050, 960); ctx.lineTo(1350, 960);
        ctx.stroke();

        ctx.fillText('CHIEF ADJUDICATOR', 1200, 990);

        // Official Gold Ribbon Seal (Left bottom)
        const sealX = 720;
        const sealY = 930;
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(sealX, sealY, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 3;
        ctx.stroke();

        drawStar(ctx, sealX, sealY, 8, 30, 15, '#F59E0B');

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OFFICIAL', sealX, sealY - 4);
        ctx.fillText('SEAL', sealX, sealY + 10);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // 8. Certificate: Royal Blue & Platinum Participation (Landscape 1600 x 1130)
    function generateBgCertRoyalBlue() {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1130;
        const ctx = canvas.getContext('2d');

        // Pristine White Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1600, 1130);

        // Royal Blue Outer Geometric Frame
        ctx.strokeStyle = '#1E3A8A';
        ctx.lineWidth = 6;
        ctx.strokeRect(36, 36, 1528, 1058);

        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(48, 48, 1504, 1034);

        // Header Title
        ctx.fillStyle = '#1E3A8A';
        ctx.font = '800 48px "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.fillText('CERTIFICATE OF PARTICIPATION', 800, 210);

        ctx.fillStyle = '#64748B';
        ctx.font = '600 20px "Times New Roman", serif';
        ctx.fillText('IN RECOGNITION OF ACTIVE INVOLVEMENT & TALENT', 800, 250);

        // Signature Lines
        ctx.strokeStyle = '#1E3A8A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(250, 960); ctx.lineTo(550, 960);
        ctx.moveTo(1050, 960); ctx.lineTo(1350, 960);
        ctx.stroke();

        ctx.fillStyle = '#1E3A8A';
        ctx.font = '700 16px "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.fillText('ORGANIZING SECRETARY', 400, 990);
        ctx.fillText('CHIEF GUEST', 1200, 990);

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // -------------------------------------------------------------------------
    // 2. PRESET TEMPLATES MASTER CATALOG
    // -------------------------------------------------------------------------
    const PRESET_TEMPLATES_CATALOG = [
        {
            id: 'PRESET_IND_ROYAL_GOLD',
            name: 'Royal Gold Champion',
            type: 'individual',
            categoryName: 'Individual Event Result',
            description: 'Luxury obsidian & gold podium poster with champion center stage and medals.',
            dimensions: '1080 × 1440 (Vertical Poster)',
            generateBg: generateBgIndividualRoyalGold,
            fields: {
                'ResultNumber': { enabled: true, x: 100, y: 140, size: 34, color: '#FCD34D', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Result Number' },
                'Category': { enabled: true, x: 540, y: 180, size: 36, color: '#93C5FD', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Category' },
                'Competition': { enabled: true, x: 540, y: 245, size: 54, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Competition' },
                
                'Position1Photo': { enabled: true, x: 390, y: 340, w: 300, h: 360, radius: 24, isImage: true, aspectLocked: true, aspectRatio: 300/360, displayName: 'Position 1 Photo' },
                'Position1Number': { enabled: true, x: 540, y: 745, size: 38, color: '#F59E0B', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 1 Number' },
                'Position1Name': { enabled: true, x: 540, y: 800, size: 44, color: '#FEF08A', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 1 Name' },
                'Position1Team': { enabled: true, x: 540, y: 850, size: 32, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 1 Team' },

                'Position2Photo': { enabled: true, x: 100, y: 500, w: 240, h: 290, radius: 20, isImage: true, aspectLocked: true, aspectRatio: 240/290, displayName: 'Position 2 Photo' },
                'Position2Number': { enabled: true, x: 220, y: 835, size: 30, color: '#CBD5E1', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 2 Number' },
                'Position2Name': { enabled: true, x: 220, y: 885, size: 34, color: '#E2E8F0', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 2 Name' },
                'Position2Team': { enabled: true, x: 220, y: 925, size: 26, color: '#94A3B8', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 2 Team' },

                'Position3Photo': { enabled: true, x: 740, y: 500, w: 240, h: 290, radius: 20, isImage: true, aspectLocked: true, aspectRatio: 240/290, displayName: 'Position 3 Photo' },
                'Position3Number': { enabled: true, x: 860, y: 835, size: 30, color: '#D97706', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 3 Number' },
                'Position3Name': { enabled: true, x: 860, y: 885, size: 34, color: '#FED7AA', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 3 Name' },
                'Position3Team': { enabled: true, x: 860, y: 925, size: 26, color: '#94A3B8', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 3 Team' }
            }
        },
        {
            id: 'PRESET_IND_CYBER_APEX',
            name: 'Cyber Neon Apex',
            type: 'individual',
            categoryName: 'Individual Event Result',
            description: 'Futuristic dark carbon & electric cyan design with duotone contrast.',
            dimensions: '1080 × 1440 (Vertical Poster)',
            generateBg: generateBgIndividualCyberApex,
            fields: {
                'ResultNumber': { enabled: true, x: 100, y: 140, size: 34, color: '#06B6D4', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Result Number' },
                'Category': { enabled: true, x: 540, y: 180, size: 36, color: '#8B5CF6', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Category' },
                'Competition': { enabled: true, x: 540, y: 245, size: 54, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Competition' },

                'Position1Photo': { enabled: true, x: 390, y: 340, w: 300, h: 360, radius: 24, isImage: true, aspectLocked: true, aspectRatio: 300/360, displayName: 'Position 1 Photo' },
                'Position1Number': { enabled: true, x: 540, y: 745, size: 38, color: '#06B6D4', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 1 Number' },
                'Position1Name': { enabled: true, x: 540, y: 800, size: 44, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 1 Name' },
                'Position1Team': { enabled: true, x: 540, y: 850, size: 32, color: '#06B6D4', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 1 Team' },

                'Position2Photo': { enabled: true, x: 100, y: 500, w: 240, h: 290, radius: 20, isImage: true, aspectLocked: true, aspectRatio: 240/290, displayName: 'Position 2 Photo' },
                'Position2Number': { enabled: true, x: 220, y: 835, size: 30, color: '#8B5CF6', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 2 Number' },
                'Position2Name': { enabled: true, x: 220, y: 885, size: 34, color: '#E2E8F0', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 2 Name' },
                'Position2Team': { enabled: true, x: 220, y: 925, size: 26, color: '#8B5CF6', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 2 Team' },

                'Position3Photo': { enabled: true, x: 740, y: 500, w: 240, h: 290, radius: 20, isImage: true, aspectLocked: true, aspectRatio: 240/290, displayName: 'Position 3 Photo' },
                'Position3Number': { enabled: true, x: 860, y: 835, size: 30, color: '#EC4899', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Position 3 Number' },
                'Position3Name': { enabled: true, x: 860, y: 885, size: 34, color: '#FED7AA', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 3 Name' },
                'Position3Team': { enabled: true, x: 860, y: 925, size: 26, color: '#EC4899', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Position 3 Team' }
            }
        },
        {
            id: 'PRESET_TEAM_LEADERBOARD_PRO',
            name: 'Championship Team Leaderboard',
            type: 'team',
            categoryName: 'Live Team Standings',
            description: 'Broadcast-quality team leaderboard with medal stripes and points tally.',
            dimensions: '1080 × 1440 (Vertical Poster)',
            generateBg: generateBgTeamLeaderboard,
            fields: {
                'ResultsCountText': { enabled: true, x: 540, y: 195, size: 32, color: '#A5B4FC', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Results Count Text' },
                'Rank1Number': { enabled: true, x: 125, y: 298, size: 36, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 1 Number' },
                'Rank1Team': { enabled: true, x: 200, y: 298, size: 36, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 1 Team' },
                'Rank1Points': { enabled: true, x: 960, y: 298, size: 40, color: '#FDE047', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 1 Points' },

                'Rank2Number': { enabled: true, x: 125, y: 410, size: 34, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 2 Number' },
                'Rank2Team': { enabled: true, x: 200, y: 410, size: 34, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 2 Team' },
                'Rank2Points': { enabled: true, x: 960, y: 410, size: 38, color: '#E2E8F0', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 2 Points' },

                'Rank3Number': { enabled: true, x: 125, y: 522, size: 34, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 3 Number' },
                'Rank3Team': { enabled: true, x: 200, y: 522, size: 34, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 3 Team' },
                'Rank3Points': { enabled: true, x: 960, y: 522, size: 38, color: '#FED7AA', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 3 Points' },

                'Rank4Number': { enabled: true, x: 125, y: 634, size: 32, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 4 Number' },
                'Rank4Team': { enabled: true, x: 200, y: 634, size: 32, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 4 Team' },
                'Rank4Points': { enabled: true, x: 960, y: 634, size: 36, color: '#FFFFFF', align: 'right', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 4 Points' },

                'Rank5Number': { enabled: true, x: 125, y: 746, size: 32, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 5 Number' },
                'Rank5Team': { enabled: true, x: 200, y: 746, size: 32, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 5 Team' },
                'Rank5Points': { enabled: true, x: 960, y: 746, size: 36, color: '#FFFFFF', align: 'right', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 5 Points' }
            }
        },
        {
            id: 'PRESET_FINAL_CHAMPIONSHIP',
            name: 'Grand Finale Championship',
            type: 'final',
            categoryName: 'Final Championship Results',
            description: 'Triumphant royal purple & gold grand finale standings.',
            dimensions: '1080 × 1440 (Vertical Poster)',
            generateBg: generateBgFinalChampionship,
            fields: {
                'TotalCompetitionsCount': { enabled: true, x: 540, y: 195, size: 34, color: '#FEF08A', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Total Competitions Count' },
                'Rank1Number': { enabled: true, x: 125, y: 298, size: 36, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 1 Number' },
                'Rank1Team': { enabled: true, x: 200, y: 298, size: 36, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 1 Team' },
                'Rank1Points': { enabled: true, x: 960, y: 298, size: 40, color: '#FDE047', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 1 Points' },

                'Rank2Number': { enabled: true, x: 125, y: 410, size: 34, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 2 Number' },
                'Rank2Team': { enabled: true, x: 200, y: 410, size: 34, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 2 Team' },
                'Rank2Points': { enabled: true, x: 960, y: 410, size: 38, color: '#E2E8F0', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 2 Points' },

                'Rank3Number': { enabled: true, x: 125, y: 522, size: 34, color: '#FFFFFF', align: 'center', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 3 Number' },
                'Rank3Team': { enabled: true, x: 200, y: 522, size: 34, color: '#FFFFFF', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Rank 3 Team' },
                'Rank3Points': { enabled: true, x: 960, y: 522, size: 38, color: '#FED7AA', align: 'right', font: 'Inter, sans-serif', weight: '900', displayName: 'Rank 3 Points' }
            }
        },
        {
            id: 'PRESET_ID_EXECUTIVE_PASS',
            name: 'Executive Lanyard Pass',
            type: 'id_card',
            categoryName: 'Participant ID Card',
            description: 'Official festival lanyard card with royal navy header, photo frame, and QR verification.',
            dimensions: '900 × 1300 (Portrait Lanyard)',
            generateBg: generateBgIdLanyard,
            fields: {
                'Photo': { enabled: true, x: 275, y: 180, w: 350, h: 430, radius: 24, isImage: true, aspectLocked: true, aspectRatio: 350/430, displayName: 'Photo' },
                'ParticipantName': { enabled: true, x: 450, y: 670, size: 42, color: '#0F172A', align: 'center', font: 'Inter, sans-serif', weight: '800', displayName: 'Participant Name' },
                'TeamName': { enabled: true, x: 450, y: 735, size: 28, color: '#4F46E5', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Team Name' },
                'Category': { enabled: true, x: 450, y: 790, size: 24, color: '#475569', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Category' },
                'DateofBirth': { enabled: true, x: 450, y: 835, size: 20, color: '#94A3B8', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Date of Birth' },
                'QRCode': { enabled: true, x: 340, y: 880, w: 220, h: 220, radius: 12, isImage: true, aspectLocked: true, aspectRatio: 1, displayName: 'QR Code' },
                'UniqueID': { enabled: true, x: 450, y: 1140, size: 28, color: '#1E293B', align: 'center', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Unique ID' }
            }
        },
        {
            id: 'PRESET_ID_CR80_POCKET',
            name: 'CR80 Pocket Identity Badge',
            type: 'id_card',
            categoryName: 'Participant ID Card',
            description: 'Standard horizontal credit-card size badge with barcode and security accents.',
            dimensions: '900 × 580 (Landscape CR80)',
            generateBg: generateBgIdCr80,
            fields: {
                'Photo': { enabled: true, x: 50, y: 70, w: 220, h: 270, radius: 16, isImage: true, aspectLocked: true, aspectRatio: 220/270, displayName: 'Photo' },
                'QRCode': { enabled: true, x: 75, y: 360, w: 170, h: 170, radius: 8, isImage: true, aspectLocked: true, aspectRatio: 1, displayName: 'QR Code' },
                'ParticipantName': { enabled: true, x: 310, y: 125, size: 36, color: '#0F172A', align: 'left', font: 'Inter, sans-serif', weight: '800', displayName: 'Participant Name' },
                'UniqueID': { enabled: true, x: 310, y: 175, size: 22, color: '#4F46E5', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Unique ID' },
                'TeamName': { enabled: true, x: 310, y: 240, size: 26, color: '#059669', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Team Name' },
                'Category': { enabled: true, x: 310, y: 295, size: 22, color: '#475569', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Category' },
                'DateofBirth': { enabled: true, x: 310, y: 340, size: 18, color: '#94A3B8', align: 'left', font: 'Inter, sans-serif', weight: 'bold', displayName: 'Date of Birth' }
            }
        },
        {
            id: 'PRESET_CERT_GOLD_EXCELLENCE',
            name: 'Gold Ornate Merit & Excellence',
            type: 'certificate',
            categoryName: 'Merit & Excellence Certificate',
            description: 'Luxury gold guilloche border, crest emblem, seal ribbon, and verification QR.',
            dimensions: '1600 × 1130 (Landscape A4)',
            generateBg: generateBgCertGoldOrnate,
            fields: {
                'Category': { enabled: true, x: 800, y: 290, size: 28, color: '#78350F', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Category' },
                'Competition': { enabled: true, x: 800, y: 350, size: 38, color: '#1E1B4B', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Competition' },
                'ParticipantName': { enabled: true, x: 800, y: 500, size: 58, color: '#0F172A', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Participant Name' },
                'TeamName': { enabled: true, x: 800, y: 575, size: 30, color: '#4338CA', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Team Name' },
                'Position': { enabled: true, x: 800, y: 660, size: 42, color: '#B45309', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Position' },
                'Grade': { enabled: true, x: 800, y: 725, size: 30, color: '#059669', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Grade' },
                'IssueDate': { enabled: true, x: 350, y: 980, size: 20, color: '#64748B', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Issue Date' },
                'UniqueID': { enabled: true, x: 800, y: 860, size: 20, color: '#94A3B8', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Unique ID' },
                'QRCode': { enabled: true, x: 1270, y: 830, w: 150, h: 150, radius: 0, isImage: true, aspectLocked: true, aspectRatio: 1, displayName: 'QR Code' }
            }
        },
        {
            id: 'PRESET_CERT_ROYAL_BLUE',
            name: 'Royal Blue & Platinum Participation',
            type: 'certificate',
            categoryName: 'Participation Certificate',
            description: 'Pristine white & royal blue geometric border for official fest participation.',
            dimensions: '1600 × 1130 (Landscape A4)',
            generateBg: generateBgCertRoyalBlue,
            fields: {
                'Category': { enabled: true, x: 800, y: 290, size: 28, color: '#1E3A8A', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Category' },
                'Competition': { enabled: true, x: 800, y: 350, size: 38, color: '#1E3A8A', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Competition' },
                'ParticipantName': { enabled: true, x: 800, y: 500, size: 58, color: '#0F172A', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Participant Name' },
                'TeamName': { enabled: true, x: 800, y: 575, size: 30, color: '#4338CA', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Team Name' },
                'Position': { enabled: true, x: 800, y: 660, size: 42, color: '#2563EB', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Position' },
                'Grade': { enabled: true, x: 800, y: 725, size: 30, color: '#059669', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Grade' },
                'IssueDate': { enabled: true, x: 350, y: 980, size: 20, color: '#64748B', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Issue Date' },
                'UniqueID': { enabled: true, x: 800, y: 860, size: 20, color: '#94A3B8', align: 'center', font: "'Times New Roman', serif", weight: 'bold', displayName: 'Unique ID' },
                'QRCode': { enabled: true, x: 1270, y: 830, w: 150, h: 150, radius: 0, isImage: true, aspectLocked: true, aspectRatio: 1, displayName: 'QR Code' }
            }
        }
    ];

    // -------------------------------------------------------------------------
    // 3. ACCESSIBLE PRESETS WITH SUPER ADMIN & FESTIVAL ACCESS CONTROL
    // -------------------------------------------------------------------------

    let accessiblePresetsCache = null;

    async function getAccessiblePresets(forceRefresh = false) {
        if (accessiblePresetsCache && !forceRefresh) return accessiblePresetsCache;

        const list = [...PRESET_TEMPLATES_CATALOG];
        const client = window.supabaseClient || window.supabase;
        if (!client) {
            accessiblePresetsCache = list;
            return list;
        }

        try {
            const activeFid = (typeof getActiveFestId === 'function') ? getActiveFestId() : (localStorage.getItem('festos_active_fest_id') || 'fest_zenith_2026');

            const { data: dbPresets, error } = await client.from('templates').select('*');
            if (!error && Array.isArray(dbPresets)) {
                const dbPresetMap = {};
                dbPresets.forEach(t => {
                    if (t.id && (t.id.startsWith('PRESET_') || t.fest_id === 'global' || t.fields?._access_scope)) {
                        const scope = t.fields?._access_scope;
                        const isAllowed = !scope || scope.is_all === true || (Array.isArray(scope.allowed_fests) && (scope.allowed_fests.includes('*') || scope.allowed_fests.includes(activeFid)));
                        if (isAllowed) {
                            dbPresetMap[t.id] = t;
                        }
                    }
                });

                const merged = [];
                list.forEach(builtIn => {
                    if (dbPresetMap[builtIn.id]) {
                        const custom = dbPresetMap[builtIn.id];
                        merged.push({
                            ...builtIn,
                            name: custom.name || builtIn.name,
                            type: custom.type || builtIn.type,
                            fields: custom.fields || builtIn.fields,
                            bg_base64: custom.bg_base64 || (typeof builtIn.generateBg === 'function' ? builtIn.generateBg() : null),
                            is_custom: true
                        });
                        delete dbPresetMap[builtIn.id];
                    } else {
                        merged.push(builtIn);
                    }
                });

                Object.values(dbPresetMap).forEach(custom => {
                    merged.push({
                        id: custom.id,
                        name: custom.name,
                        type: custom.type || 'individual',
                        categoryName: custom.categoryName || (custom.type ? custom.type.toUpperCase() : 'Template'),
                        description: custom.description || 'Custom template preset configured by Super Admin.',
                        dimensions: custom.dimensions || 'High Resolution Vector',
                        bg_base64: custom.bg_base64,
                        fields: custom.fields || {},
                        is_custom: true
                    });
                });

                accessiblePresetsCache = merged;
                return accessiblePresetsCache;
            }
        } catch (err) {
            console.warn('Failed to load DB presets, using built-in catalog:', err);
        }

        accessiblePresetsCache = list;
        return list;
    }

    // -------------------------------------------------------------------------
    // 4. INSTALLATION ACTIONS
    // -------------------------------------------------------------------------

    async function installPresetTemplate(presetId) {
        const presets = await getAccessiblePresets();
        const preset = presets.find(p => p.id === presetId);
        if (!preset) throw new Error('Preset template not found: ' + presetId);

        const client = window.supabaseClient || window.supabase;
        if (!client) throw new Error('Supabase client not initialized.');

        if (typeof showToast === 'function') showToast(`Installing "${preset.name}"...`, 'info');

        const bgBase64 = typeof preset.generateBg === 'function' ? preset.generateBg() : preset.bg_base64;
        const activeFid = (typeof window.getActiveFestId === 'function') 
            ? window.getActiveFestId() 
            : (window.festosAuth?.getCurrentFestId?.() || localStorage.getItem('festos_active_fest_id') || 'fest_zenith_2026');

        const installId = `TPL_PRESET_${preset.id.replace('PRESET_', '')}_${activeFid}_${Date.now().toString(36)}`;

        const payload = {
            id: installId,
            name: preset.name.toUpperCase(),
            type: preset.type,
            bg_base64: bgBase64,
            fields: preset.fields,
            fest_id: activeFid
        };

        // If helper is available, optimize background storage
        if (typeof window.ensureTemplateBgUploaded === 'function') {
            try {
                await window.ensureTemplateBgUploaded(payload);
            } catch(e) {}
        }

        const { error } = await client.from('templates').upsert(payload);
        if (error) throw error;

        // Optimistically update local templates if in admin context
        if (Array.isArray(window.savedTemplates)) {
            const existingIdx = window.savedTemplates.findIndex(t => t.id === installId);
            if (existingIdx >= 0) {
                window.savedTemplates[existingIdx] = payload;
            } else {
                window.savedTemplates.unshift(payload);
            }
            try {
                localStorage.setItem(`festos_tpl_cache_${activeFid}`, JSON.stringify(window.savedTemplates));
            } catch(e) {}
        }

        if (typeof showToast === 'function') showToast(`Installed "${preset.name}" successfully!`, 'success');

        if (typeof loadTemplatesList === 'function') {
            await loadTemplatesList();
        }

        return payload;
    }

    async function installAllPresetTemplates() {
        const client = window.supabaseClient || window.supabase;
        if (!client) return alert('Supabase client is not available.');

        const presets = await getAccessiblePresets();
        if (typeof showToast === 'function') showToast(`Installing ${presets.length} premium templates...`, 'info');

        try {
            let successCount = 0;
            for (const preset of presets) {
                try {
                    await installPresetTemplate(preset.id);
                    successCount++;
                } catch (pe) {
                    console.warn(`Notice: Could not install preset ${preset.id}:`, pe);
                }
            }

            if (typeof showToast === 'function') showToast(`Installed ${successCount} of ${presets.length} Templates to Festival!`, 'success');

            if (typeof loadTemplatesList === 'function') {
                await loadTemplatesList();
            }

            closePresetTemplatesModal();
        } catch (err) {
            console.error('Batch preset install error:', err);
            if (typeof showToast === 'function') showToast('Failed to install presets: ' + err.message, 'error');
        }
    }

    // -------------------------------------------------------------------------
    // 5. APPLY PRESET DIRECTLY TO ACTIVE STUDIO CANVAS
    // -------------------------------------------------------------------------
    async function applyPresetToStudio(presetId) {
        const presets = await getAccessiblePresets();
        const preset = presets.find(p => p.id === presetId);
        if (!preset) return;

        if (typeof showToast === 'function') showToast(`Applying ${preset.name} to Studio...`, 'info');

        const bgBase64 = typeof preset.generateBg === 'function' ? preset.generateBg() : preset.bg_base64;
        const activeFid = (typeof window.getActiveFestId === 'function') 
            ? window.getActiveFestId() 
            : (window.festosAuth?.getCurrentFestId?.() || localStorage.getItem('festos_active_fest_id') || 'fest_zenith_2026');

        const newId = `TPL_PRESET_${preset.id.replace('PRESET_', '')}_${Date.now().toString(36)}`;

        // If in template studio
        if (window.studioActiveData) {
            window.studioActiveData.id = newId;
            window.studioActiveData.type = preset.type;
            window.studioActiveData.name = preset.name;
            window.studioActiveData.bg_base64 = bgBase64;
            window.studioActiveData.fields = JSON.parse(JSON.stringify(preset.fields));
            window.studioActiveData.groups = {};
            window.studioActiveData.pendingFile = null;
            window.studioActiveData.fest_id = activeFid;

            const nameInput = document.getElementById('studio-template-name');
            if (nameInput) nameInput.value = preset.name;

            const typeSelect = document.getElementById('studio-template-type');
            if (typeSelect) typeSelect.value = preset.type;

            // Rehydrate background image for canvas immediately
            window.studioActiveData.imgObj = new Image();
            window.studioActiveData.imgObj.crossOrigin = "Anonymous";
            window.studioActiveData.imgObj.onload = () => {
                if (typeof drawStudioCanvas === 'function') drawStudioCanvas();
            };
            window.studioActiveData.imgObj.src = bgBase64;
            if (window.studioActiveData.imgObj.complete && typeof drawStudioCanvas === 'function') {
                drawStudioCanvas();
            }

            if (typeof renderLayersPanel === 'function') renderLayersPanel();
            if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
            if (typeof drawStudioCanvas === 'function') drawStudioCanvas();

            closePresetTemplatesModal();
            if (typeof showToast === 'function') showToast(`Loaded "${preset.name}" into Studio!`, 'success');
        } else {
            // Open studio with this preset
            const payload = {
                id: newId,
                name: preset.name,
                type: preset.type,
                bg_base64: bgBase64,
                fields: preset.fields,
                fest_id: activeFid
            };
            if (typeof openTemplateStudio === 'function') {
                openTemplateStudio(payload);
                closePresetTemplatesModal();
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. GALLERY MODAL UI
    // -------------------------------------------------------------------------
    let currentGalleryFilter = 'all';

    function openPresetTemplatesModal(isStudioContext = false) {
        let modal = document.getElementById('presetTemplatesModal');
        if (!modal) {
            createPresetGalleryModal();
            modal = document.getElementById('presetTemplatesModal');
        }

        modal.dataset.context = isStudioContext ? 'studio' : 'library';
        renderPresetGalleryGrid();
        modal.classList.add('show');

        // Refresh accessible presets asynchronously to catch any new Super Admin presets
        getAccessiblePresets(true).then(() => {
            renderPresetGalleryGrid();
        });
    }

    function closePresetTemplatesModal() {
        const modal = document.getElementById('presetTemplatesModal');
        if (modal) modal.classList.remove('show');
    }

    function filterPresetGallery(cat) {
        currentGalleryFilter = cat;
        document.querySelectorAll('#presetTemplatesModal .preset-cat-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === cat);
            btn.style.background = btn.dataset.cat === cat ? 'var(--primary, #4F46E5)' : 'transparent';
            btn.style.color = btn.dataset.cat === cat ? '#FFFFFF' : 'var(--text-main, #0F172A)';
        });
        renderPresetGalleryGrid();
    }

    function renderPresetGalleryGrid() {
        const grid = document.getElementById('preset-templates-gallery-grid');
        if (!grid) return;

        const modal = document.getElementById('presetTemplatesModal');
        const isStudioContext = modal?.dataset?.context === 'studio';

        const list = accessiblePresetsCache || PRESET_TEMPLATES_CATALOG;
        const filtered = currentGalleryFilter === 'all' 
            ? list 
            : list.filter(p => p.type === currentGalleryFilter);

        grid.innerHTML = '';

        filtered.forEach(preset => {
            // Generate a lightweight preview thumbnail
            const thumbUrl = typeof preset.generateBg === 'function' ? preset.generateBg() : preset.bg_base64;

            const card = document.createElement('div');
            card.style.cssText = 'background: white; border-radius: var(--radius-lg, 12px); border: 1px solid var(--border, #E2E8F0); overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); display: flex; flex-direction: column; transition: transform 0.2s ease, box-shadow 0.2s ease;';
            card.onmouseenter = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 10px 24px rgba(0,0,0,0.12)'; };
            card.onmouseleave = () => { card.style.transform = 'none'; card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; };

            card.innerHTML = `
                <div style="height: 180px; background: #0F172A; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;">
                    <img src="${thumbUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 10px; right: 10px; background: rgba(15, 23, 42, 0.85); color: #FCD34D; font-weight: 800; font-size: 0.7rem; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(245, 158, 11, 0.4);">
                        ${preset.type.toUpperCase()}
                    </div>
                    ${preset.is_custom ? '<div style="position: absolute; top: 10px; left: 10px; background: rgba(79, 70, 229, 0.9); color: white; font-weight: 800; font-size: 0.65rem; padding: 3px 7px; border-radius: 999px;"><i class="fa-solid fa-crown"></i> SUPER ADMIN</div>' : ''}
                </div>
                <div style="padding: 1.15rem; display: flex; flex-direction: column; flex: 1;">
                    <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main, #0F172A); margin-bottom: 0.25rem;">${preset.name}</h3>
                    <div style="font-size: 0.72rem; color: var(--text-muted, #64748B); font-weight: 700; margin-bottom: 0.4rem; font-family: monospace;">${preset.dimensions}</div>
                    <p style="font-size: 0.8rem; color: var(--text-muted, #64748B); line-height: 1.4; margin-bottom: 1rem; flex: 1;">${preset.description}</p>
                    
                    <div style="display: flex; gap: 0.5rem; margin-top: auto;">
                        <button class="btn btn-outline" style="flex: 1; font-size: 0.82rem; padding: 0.5rem;" onclick="FestOSPresetEngine.applyPresetToStudio('${preset.id}')">
                            <i class="fa-solid fa-pen-nib"></i> ${isStudioContext ? 'Apply to Canvas' : 'Open in Studio'}
                        </button>
                        <button class="btn btn-primary" style="font-size: 0.82rem; padding: 0.5rem 0.85rem;" title="Install to Festival" onclick="FestOSPresetEngine.installPresetTemplate('${preset.id}')">
                            <i class="fa-solid fa-cloud-arrow-down"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function createPresetGalleryModal() {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'presetTemplatesModal';
        modalDiv.className = 'modal-overlay';
        modalDiv.style.zIndex = '1100';

        modalDiv.innerHTML = `
            <div class="modal" style="max-width: 1040px; width: 96%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.25rem;">
                    <div>
                        <span class="badge badge-primary" style="font-size: 0.75rem; margin-bottom: 0.25rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> FESTOS SYSTEM PRESETS
                        </span>
                        <h2 style="margin-top: 0.25rem; font-size: 1.35rem; color: var(--text-main);">Premium System-Generated Templates</h2>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Professionally crafted vector designs for Result Posters, ID Cards, and Certificates.</p>
                    </div>
                    <button class="close-btn" onclick="FestOSPresetEngine.closePresetTemplatesModal()"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <!-- Category Filter Tabs & Batch Install -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                        <button class="btn btn-outline preset-cat-tab active" data-cat="all" onclick="FestOSPresetEngine.filterPresetGallery('all')" style="border-radius: 999px; font-size: 0.8rem; padding: 0.4rem 0.9rem; background: var(--primary); color: white;">All Presets</button>
                        <button class="btn btn-outline preset-cat-tab" data-cat="individual" onclick="FestOSPresetEngine.filterPresetGallery('individual')" style="border-radius: 999px; font-size: 0.8rem; padding: 0.4rem 0.9rem;">Individual Posters</button>
                        <button class="btn btn-outline preset-cat-tab" data-cat="team" onclick="FestOSPresetEngine.filterPresetGallery('team')" style="border-radius: 999px; font-size: 0.8rem; padding: 0.4rem 0.9rem;">Team Standings</button>
                        <button class="btn btn-outline preset-cat-tab" data-cat="final" onclick="FestOSPresetEngine.filterPresetGallery('final')" style="border-radius: 999px; font-size: 0.8rem; padding: 0.4rem 0.9rem;">Final Results</button>
                        <button class="btn btn-outline preset-cat-tab" data-cat="id_card" onclick="FestOSPresetEngine.filterPresetGallery('id_card')" style="border-radius: 999px; font-size: 0.8rem; padding: 0.4rem 0.9rem;">ID Badges</button>
                        <button class="btn btn-outline preset-cat-tab" data-cat="certificate" onclick="FestOSPresetEngine.filterPresetGallery('certificate')" style="border-radius: 999px; font-size: 0.8rem; padding: 0.4rem 0.9rem;">Certificates</button>
                    </div>

                    <button class="btn btn-success" style="font-size: 0.82rem; padding: 0.45rem 1rem;" onclick="FestOSPresetEngine.installAllPresetTemplates()">
                        <i class="fa-solid fa-cloud-arrow-down"></i> Install All 8 Presets to Festival
                    </button>
                </div>

                <!-- Template Grid -->
                <div id="preset-templates-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
                    <!-- Rendered dynamically -->
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    // Expose Global Engine
    window.FestOSPresetEngine = {
        PRESET_TEMPLATES_CATALOG,
        getAccessiblePresets,
        installPresetTemplate,
        installAllPresetTemplates,
        applyPresetToStudio,
        openPresetTemplatesModal,
        closePresetTemplatesModal,
        filterPresetGallery
    };

    // Global aliases
    window.openPresetTemplatesModal = openPresetTemplatesModal;
    window.closePresetTemplatesModal = closePresetTemplatesModal;
    window.installAllPresetTemplates = installAllPresetTemplates;

})(window);
