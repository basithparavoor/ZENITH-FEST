const fs = require('fs');
const path = require('path');

const files = [
    'festos-core.js',
    'superadmin.js',
    'admin.js',
    'newspaper-engine.js',
    'server.js'
];

const htmlFiles = [
    'announcements.html',
    'admin.html',
    'superadmin.html',
    'index.html',
    'results.html',
    'display.html',
    'judge.html',
    'student.html',
    'team.html'
];

function analyzeFunctions(code, filename) {
    const fnRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/g;
    const arrowRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
    const methodRegex = /^\s*([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{/gm;

    const functions = [];
    let match;
    while ((match = fnRegex.exec(code)) !== null) {
        functions.push({ name: match[1], params: match[2].trim(), type: 'function', line: code.substring(0, match.index).split('\n').length });
    }
    while ((match = arrowRegex.exec(code)) !== null) {
        functions.push({ name: match[1], params: match[2].trim(), type: 'arrow', line: code.substring(0, match.index).split('\n').length });
    }
    return functions;
}

console.log('=== FESTOS COMPREHENSIVE FUNCTION AUDIT ===\n');

const auditSummary = {};
let grandTotal = 0;

files.forEach(f => {
    if (fs.existsSync(f)) {
        const code = fs.readFileSync(f, 'utf8');
        const fns = analyzeFunctions(code, f);
        grandTotal += fns.length;
        const lineCount = code.split('\n').length;
        const sizeKb = (fs.statSync(f).size / 1024).toFixed(1);
        auditSummary[f] = { functions: fns, count: fns.length, lines: lineCount, sizeKb };
        console.log(`[CORE] ${f.padEnd(20)} : ${String(fns.length).padStart(4)} fns | ${String(lineCount).padStart(5)} lines | ${sizeKb.padStart(6)} KB`);
    }
});

htmlFiles.forEach(f => {
    if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        const scriptBlocks = content.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];
        const fns = [];
        scriptBlocks.forEach(sb => {
            const code = sb.replace(/<script[\s\S]*?>/i, '').replace(/<\/script>/i, '');
            fns.push(...analyzeFunctions(code, f));
        });
        grandTotal += fns.length;
        const lineCount = content.split('\n').length;
        const sizeKb = (fs.statSync(f).size / 1024).toFixed(1);
        auditSummary[f] = { functions: fns, count: fns.length, lines: lineCount, sizeKb };
        console.log(`[PORTAL] ${f.padEnd(18)} : ${String(fns.length).padStart(4)} fns | ${String(lineCount).padStart(5)} lines | ${sizeKb.padStart(6)} KB`);
    }
});

console.log(`\nGRAND TOTAL FUNCTIONS AUDITED: ${grandTotal}\n`);

// Save detailed JSON dump for reporting
fs.writeFileSync('scripts/audit_summary.json', JSON.stringify(auditSummary, null, 2));
