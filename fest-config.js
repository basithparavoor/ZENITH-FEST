// Dedicated Festival Mobile Configuration
// In web deployments this is null (subdomain handles multi-tenant resolution).
// In dedicated festival APK builds, this file is populated with that festival's target metadata.
if (typeof window !== 'undefined') {
    window.FESTOS_NATIVE_FEST = null;
}
