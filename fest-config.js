// Dedicated Festival Mobile Configuration
// In web deployments this is null so the domain/subdomain dynamically resolves the festival.
// In dedicated festival APK builds, this file is populated during compilation with that festival's target metadata.
if (typeof window !== 'undefined') {
    window.FESTOS_NATIVE_FEST = null;
}
