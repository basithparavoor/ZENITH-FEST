/**
 * FestOS / VIBRANIUM Native Mobile Integration (Capacitor)
 * Handles hardware back button, native status bar, WhatsApp-style heads-up notifications, haptics, and deep links.
 */

(function() {
    'use strict';

    window.isNativeApp = window.Capacitor && window.Capacitor.isNativePlatform();

    if (window.isNativeApp) {
        console.log('📱 VIBRANIUM running inside Native Mobile App container (Capacitor)');

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const { StatusBar, Style } = window.Capacitor.Plugins.StatusBar || {};
                if (StatusBar) {
                    await StatusBar.setStyle({ style: Style.Light });
                    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
                }

                const { SplashScreen } = window.Capacitor.Plugins.SplashScreen || {};
                if (SplashScreen) {
                    await SplashScreen.hide();
                }

                // Initialize Native Notification System (WhatsApp Style Channel & Permissions)
                const { LocalNotifications } = window.Capacitor.Plugins.LocalNotifications || {};
                if (LocalNotifications) {
                    try {
                        const permStatus = await LocalNotifications.checkPermissions();
                        if (permStatus.display !== 'granted') {
                            await LocalNotifications.requestPermissions();
                        }

                        // Create High-Priority Notification Channel (Importance 5 = Heads-up banner + Sound + Vibrate)
                        await LocalNotifications.createChannel({
                            id: 'vibranium_alerts',
                            name: 'VIBRANIUM Alerts & Announcements',
                            description: 'Instant stage calls, results, and administrator notifications',
                            importance: 5, // MAX / HIGH: Displays full heads-up banner on top of screen like WhatsApp
                            visibility: 1, // VISIBILITY_PUBLIC: Visible on lockscreen
                            sound: 'default',
                            vibration: true,
                            lights: true,
                            lightColor: '#0D2B45'
                        });

                        // Tap action listener: routes user directly into Notification Center
                        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                            console.log('📲 Notification tapped by user:', action);
                            if (typeof toggleNotificationCenter === 'function') {
                                toggleNotificationCenter(true);
                            }
                        });
                    } catch (notifErr) {
                        console.warn('[LocalNotifications] Setup notice:', notifErr);
                    }
                }

                const { App } = window.Capacitor.Plugins.App || {};
                if (App) {
                    App.addListener('backButton', ({ canGoBack }) => {
                        // Handle modal closing first
                        const activeModal = document.querySelector('.modal-overlay.show, .modal-overlay.active, .drawer-container.active');
                        if (activeModal) {
                            activeModal.classList.remove('show', 'active');
                            const drawer = document.getElementById('notificationCenterDrawer');
                            if (drawer) drawer.style.transform = 'translateX(100%)';
                            const backdrop = document.getElementById('notificationDrawerBackdrop');
                            if (backdrop) backdrop.style.display = 'none';
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

    // =========================================================================
    // WHATSAPP-STYLE UNIVERSAL APP NOTIFICATION DISPATCHER
    // =========================================================================
    window.showAppNotification = async function(title, body, extra = {}) {
        // Strict Exclusion Rule: NEVER display notifications on Login, Display Screen, or Results pages
        if (typeof window !== 'undefined' && window.location) {
            const path = (window.location.pathname || '').toLowerCase();
            const page = path.split('/').pop().split('?')[0] || 'index.html';
            if (page === '' || page === 'index.html' || page === 'landing.html' || page.includes('login') || page.includes('display') || page.includes('results')) {
                return;
            }
        }

        const notifTitle = title || 'VIBRANIUM';
        const notifBody = body || 'New festival announcement received';

        // 1. WhatsApp-style double haptic buzz
        if (typeof window.triggerHaptic === 'function') {
            window.triggerHaptic('success');
        }

        // 2. Mobile Native Notification (Capacitor Android Heads-Up)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            try {
                const { LocalNotifications } = window.Capacitor.Plugins;
                const notifId = Math.floor(Date.now() % 100000) + Math.floor(Math.random() * 900);
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            id: notifId,
                            title: notifTitle,
                            body: notifBody,
                            channelId: 'vibranium_alerts',
                            smallIcon: 'ic_launcher_round',
                            iconColor: '#0D2B45',
                            sound: 'default',
                            extra: extra
                        }
                    ]
                });
                return;
            } catch (e) {
                console.warn('[LocalNotifications] Mobile dispatch fallback:', e);
            }
        }

        // 3. Web Notification API fallback (for mobile chrome / PWA / desktop)
        if (typeof window !== 'undefined' && 'Notification' in window) {
            try {
                if (Notification.permission === 'granted') {
                    new Notification(notifTitle, {
                        body: notifBody,
                        icon: '/favicon.png',
                        badge: '/favicon.png',
                        vibrate: [200, 100, 200]
                    });
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(perm => {
                        if (perm === 'granted') {
                            new Notification(notifTitle, {
                                body: notifBody,
                                icon: '/favicon.png',
                                badge: '/favicon.png',
                                vibrate: [200, 100, 200]
                            });
                        }
                    });
                }
            } catch (e) {}
        }

        // 4. In-App Heads-up Banner Toast
        if (typeof showToast === 'function') {
            showToast(`${notifTitle}: ${notifBody}`, 'info');
        }
    };

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

        // Web Vibration API fallback (WhatsApp double-buzz rhythm)
        if (navigator.vibrate) {
            if (type === 'success') navigator.vibrate([100, 80, 120]);
            else if (type === 'error') navigator.vibrate([120, 60, 120]);
            else navigator.vibrate(30);
        }
    };

})();
