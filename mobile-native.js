/**
 * FestOS Native Mobile Integration (Capacitor)
 * Handles hardware back button, native status bar, haptic feedback, and deep links.
 */

(function() {
    'use strict';

    window.isNativeApp = window.Capacitor && window.Capacitor.isNativePlatform();

    if (window.isNativeApp) {
        console.log('📱 FestOS running inside Native Mobile App container (Capacitor)');

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const { StatusBar, Style } = window.Capacitor.Plugins.StatusBar || {};
                if (StatusBar) {
                    await StatusBar.setStyle({ style: Style.Dark });
                    await StatusBar.setBackgroundColor({ color: '#0F172A' });
                }

                const { SplashScreen } = window.Capacitor.Plugins.SplashScreen || {};
                if (SplashScreen) {
                    await SplashScreen.hide();
                }

                const { App } = window.Capacitor.Plugins.App || {};
                if (App) {
                    App.addListener('backButton', ({ canGoBack }) => {
                        // Handle modal closing first
                        const activeModal = document.querySelector('.modal-overlay.show, .modal-overlay.active');
                        if (activeModal) {
                            activeModal.classList.remove('show', 'active');
                            return;
                        }

                        // Handle view back navigation
                        if (typeof switchMainTab === 'function') {
                            const homeNav = document.querySelector('[data-nav="home"]');
                            const activeNav = document.querySelector('.mobile-nav-item.active');
                            if (activeNav && activeNav.getAttribute('data-nav') !== 'home') {
                                switchMainTab('home', homeNav);
                                return;
                            }
                        }

                        if (canGoBack) {
                            window.history.back();
                        } else {
                            App.exitApp();
                        }
                    });
                }
            } catch (err) {
                console.warn('Native plugin initialization notice:', err);
            }
        });
    }

    // Universal Haptic Feedback Helper
    window.triggerHaptic = async function(type = 'light') {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
            try {
                const { Haptics, ImpactStyle, NotificationType } = window.Capacitor.Plugins.Haptics;
                if (type === 'success') {
                    await Haptics.notification({ type: NotificationType.Success });
                } else if (type === 'warning') {
                    await Haptics.notification({ type: NotificationType.Warning });
                } else if (type === 'error') {
                    await Haptics.notification({ type: NotificationType.Error });
                } else if (type === 'heavy') {
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                } else if (type === 'medium') {
                    await Haptics.impact({ style: ImpactStyle.Medium });
                } else {
                    await Haptics.impact({ style: ImpactStyle.Light });
                }
                return;
            } catch (e) {}
        }

        // Web Vibration API fallback
        if (navigator.vibrate) {
            if (type === 'success') navigator.vibrate([30, 50, 30]);
            else if (type === 'error') navigator.vibrate([60, 40, 60]);
            else navigator.vibrate(20);
        }
    };

})();
