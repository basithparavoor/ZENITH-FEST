const fs = require('fs');

const summary = JSON.parse(fs.readFileSync('scripts/deep_audit_report.json', 'utf8'));

console.log('=== FUNCTION HEALTH & COMPLIANCE SCAN ===\n');

const healthMetrics = {
    totalFunctions: summary.totalFunctions,
    asyncFunctions: 0,
    tryCatchCoverage: 0,
    nullSafeElementQueries: 0,
    tenantBoundaryChecks: 0,
    findings: []
};

// Scan key modules
const keyFiles = ['festos-core.js', 'superadmin.js', 'admin.js', 'newspaper-engine.js', 'announcements.html', 'judge.js', 'stage-controller.js', 'results.html', 'display.html'];

keyFiles.forEach(f => {
    if (!fs.existsSync(f)) return;
    const content = fs.readFileSync(f, 'utf8');

    // Count async functions
    const asyncMatches = content.match(/async\s+function/g) || [];
    healthMetrics.asyncFunctions += asyncMatches.length;

    // Count try-catches
    const tryMatches = content.match(/try\s*\{/g) || [];
    healthMetrics.tryCatchCoverage += tryMatches.length;

    // Multi-tenant references
    const tenantFilterMatches = content.match(/(\.eq\('fest_id'|festosGetSetting|festMetadata_|festosDomains|getCurrentFestId)/g) || [];
    healthMetrics.tenantBoundaryChecks += tenantFilterMatches.length;

    // Element null guards
    const nullGuardMatches = content.match(/(if\s*\(![a-zA-Z0-9_$]+El|if\s*\(![a-zA-Z0-9_$]+Container|if\s*\(![a-zA-Z0-9_$]+Input|\?\.)/g) || [];
    healthMetrics.nullSafeElementQueries += nullGuardMatches.length;
});

console.log(`Audited Async Functions        : ${healthMetrics.asyncFunctions}`);
console.log(`Audited Try-Catch Blocks       : ${healthMetrics.tryCatchCoverage}`);
console.log(`Tenant Boundary Checks / Guard : ${healthMetrics.tenantBoundaryChecks}`);
console.log(`Element Null-Safety Guards     : ${healthMetrics.nullSafeElementQueries}`);
