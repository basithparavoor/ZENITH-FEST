const fs = require('fs');
const path = require('path');

const jsFiles = [
    'festos-core.js',
    'superadmin.js',
    'admin.js',
    'newspaper-engine.js',
    'ai-template-generator.js',
    'preset-templates-engine.js',
    'id-badge-engine.js',
    'custom-pickers.js',
    'judge.js',
    'stage-controller.js',
    'manager.js',
    'team-manager.js',
    'login.js',
    'mobile-native.js',
    'server.js'
];

const htmlFiles = [
    'announcements.html',
    'admin.html',
    'superadmin.html',
    'results.html',
    'display.html',
    'index.html',
    'landing.html',
    'judge.html',
    'stage-controller.html',
    'manager.html',
    'team-manager.html',
    'spectator.html',
    'scan.html',
    'program_report.html'
];

function extractFunctions(code, filename) {
    const fnRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/g;
    const arrowRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
    const objMethodRegex = /^\s*([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{/gm;

    const functions = [];
    let match;
    while ((match = fnRegex.exec(code)) !== null) {
        functions.push({
            name: match[1],
            params: match[2].trim(),
            type: match[0].startsWith('async') ? 'async function' : 'function',
            line: code.substring(0, match.index).split('\n').length
        });
    }
    while ((match = arrowRegex.exec(code)) !== null) {
        functions.push({
            name: match[1],
            params: match[2].trim(),
            type: match[0].includes('async') ? 'async arrow' : 'arrow',
            line: code.substring(0, match.index).split('\n').length
        });
    }
    return functions;
}

const report = {
    generatedAt: new Date().toISOString(),
    totalModules: 0,
    totalLines: 0,
    totalSizeBytes: 0,
    totalFunctions: 0,
    byModule: {},
    domains: {
        multiTenantCore: { files: ['festos-core.js', 'login.js'], fns: 0 },
        superAdminGovernance: { files: ['superadmin.js', 'superadmin.html'], fns: 0 },
        masterAdminOperations: { files: ['admin.js', 'admin.html', 'ai-template-generator.js', 'preset-templates-engine.js', 'id-badge-engine.js', 'custom-pickers.js'], fns: 0 },
        newspaperBroadsheetStudio: { files: ['newspaper-engine.js'], fns: 0 },
        announcerSuitePro: { files: ['announcements.html'], fns: 0 },
        scoringAndStageControl: { files: ['judge.js', 'judge.html', 'stage-controller.js', 'stage-controller.html', 'manager.js', 'team-manager.js'], fns: 0 },
        publicDisplayAndResults: { files: ['results.html', 'display.html', 'spectator.html', 'program_report.html'], fns: 0 },
        systemAndServer: { files: ['server.js', 'mobile-native.js', 'scan.html', 'landing.html', 'index.html'], fns: 0 }
    }
};

const allFiles = [...jsFiles, ...htmlFiles];

allFiles.forEach(f => {
    if (!fs.existsSync(f)) return;
    const raw = fs.readFileSync(f, 'utf8');
    const stat = fs.statSync(f);
    let codeToAnalyze = raw;
    if (f.endsWith('.html')) {
        const scriptMatches = raw.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];
        codeToAnalyze = scriptMatches.map(s => s.replace(/<script[\s\S]*?>/i, '').replace(/<\/script>/i, '')).join('\n');
    }

    const fns = extractFunctions(codeToAnalyze, f);
    const lineCount = raw.split('\n').length;

    report.totalModules++;
    report.totalLines += lineCount;
    report.totalSizeBytes += stat.size;
    report.totalFunctions += fns.length;

    report.byModule[f] = {
        type: f.endsWith('.js') ? 'JavaScript' : 'HTML Document',
        functionsCount: fns.length,
        lines: lineCount,
        sizeBytes: stat.size,
        sizeKb: (stat.size / 1024).toFixed(1),
        functions: fns
    };

    // Domain categorization
    for (const [domKey, domVal] of Object.entries(report.domains)) {
        if (domVal.files.includes(f)) {
            domVal.fns += fns.length;
        }
    }
});

console.log('=== FESTOS DEEP GRAVITAS AUDIT SUMMARY ===');
console.log(`Audited Modules   : ${report.totalModules}`);
console.log(`Total Code Lines  : ${report.totalLines.toLocaleString()}`);
console.log(`Total File Volume : ${(report.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Total Functions   : ${report.totalFunctions}`);
console.log('\nFunction Distribution by Domain:');
for (const [k, v] of Object.entries(report.domains)) {
    console.log(`  - ${k.padEnd(26)}: ${String(v.fns).padStart(4)} functions across [${v.files.join(', ')}]`);
}

fs.writeFileSync('scripts/deep_audit_report.json', JSON.stringify(report, null, 2));
console.log('\nDetailed metrics written to scripts/deep_audit_report.json');
