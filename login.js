/**
 * FestOS Universal Authentication Engine (login.js)
 * Persistent Multi-Role Authentication, Dynamic Branding, and Auto-Reconnect
 */

const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
if (typeof window !== 'undefined') window.supabaseClient = supabaseClient;

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const togglePasswordBtn = document.getElementById('togglePassword');
const submitBtn = document.getElementById('submitBtn');
const errorBox = document.getElementById('error-message');

// Role routing matrix
const ROLE_ROUTES = {
    'super_admin': 'superadmin.html',
    'master_admin': 'admin.html',
    'admin': 'admin.html',
    'fest_manager': 'manager.html', 
    'team_manager': 'team-manager.html', 
    'stage_controller': 'stage-controller.html',
    'judge': 'judge.html',
    'announcer': 'announcements.html'
};

// Initialize & Check Persistent Session
document.addEventListener('DOMContentLoaded', () => {
    checkExistingSession();
    loadSavedUsername();
});

function loadSavedUsername() {
    const savedUser = localStorage.getItem('festSavedUsername');
    if (savedUser && usernameInput) {
        usernameInput.value = savedUser;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

function checkExistingSession() {
    const activeUser = festosAuth ? festosAuth.getUser() : JSON.parse(localStorage.getItem('festUser') || 'null');
    const isRemembered = localStorage.getItem('festos_remember_session') === 'true';

    if (activeUser && isRemembered && activeUser.role) {
        const targetRoute = ROLE_ROUTES[activeUser.role];
        if (targetRoute) {
            renderQuickReconnectBanner(activeUser, targetRoute);
        }
    }
}

function renderQuickReconnectBanner(user, targetRoute) {
    const container = document.querySelector('.login-container');
    if (!container) return;

    const existingBanner = document.getElementById('reconnect-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'reconnect-banner';
    banner.style.cssText = `
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        text-align: center;
        animation: fadeUp 0.4s ease;
    `;

    banner.innerHTML = `
        <div style="font-size: 0.85rem; color: #64748B; margin-bottom: 4px;">Welcome back!</div>
        <div style="font-size: 1.1rem; font-weight: 800; color: #0F172A; margin-bottom: 2px;">${user.username}</div>
        <div style="font-size: 0.75rem; font-weight: 700; color: #4F46E5; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1rem;">${user.role.replace('_', ' ')}</div>
        <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-reconnect-continue" style="flex: 1; padding: 0.75rem; border-radius: 12px; background: #4F46E5; color: #FFF; font-weight: 700; border: none; cursor: pointer; font-size: 0.9rem;">
                Continue to Dashboard &rarr;
            </button>
            <button type="button" id="btn-reconnect-switch" style="padding: 0.75rem 1rem; border-radius: 12px; background: rgba(0,0,0,0.05); color: #64748B; font-weight: 600; border: none; cursor: pointer; font-size: 0.85rem;">
                Switch
            </button>
        </div>
    `;

    container.insertBefore(banner, loginForm);

    document.getElementById('btn-reconnect-continue').addEventListener('click', () => {
        window.location.href = targetRoute;
    });

    document.getElementById('btn-reconnect-switch').addEventListener('click', () => {
        localStorage.removeItem('festUser');
        localStorage.removeItem('festos_remember_session');
        banner.remove();
    });
}

// Show/Hide Password Logic
if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        passwordInput.classList.toggle('password-visible');
        
        if (isPassword) {
            togglePasswordBtn.innerHTML = `
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                </svg>`;
        } else {
            togglePasswordBtn.innerHTML = `
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>`;
        }
    });
}

// Authentication Logic
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : true;

        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        if (errorBox) errorBox.style.display = 'none';

        try {
            // Super Admin hardcoded root bypass or Database Lookup
            if (username.toLowerCase() === 'superadmin' && password === 'superadmin123') {
                const superAdminUser = {
                    id: 'sa_root_01',
                    username: 'SuperAdmin',
                    role: 'super_admin'
                };
                if (typeof festosAuth !== 'undefined') {
                    festosAuth.setSuperAdmin(superAdminUser);
                    festosAuth.setUser(superAdminUser, rememberMe);
                } else {
                    localStorage.setItem('festSuperAdmin', JSON.stringify(superAdminUser));
                    localStorage.setItem('festUser', JSON.stringify(superAdminUser));
                }
                submitBtn.textContent = 'Success!';
                submitBtn.style.background = '#10b981';
                setTimeout(() => window.location.href = 'superadmin.html', 150);
                return;
            }

            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) throw new Error('Account not found. Please check your username.');
            if (data.password_hash !== password) throw new Error('Incorrect password. Please try again.');

            // Multi-tenant festival scoping
            if (!data.fest_id) {
                const prefix = (data.username || '').split('_')[0].toLowerCase();
                if (prefix === 'zenith26' || prefix === 'zenith') {
                    data.fest_id = 'fest_zenith_2026';
                } else if (prefix.length > 2) {
                    data.fest_id = `fest_${prefix}`;
                } else {
                    data.fest_id = 'fest_zenith_2026';
                }
            }

            // Handle "Save Login" persistent session & active fest
            if (typeof festosAuth !== 'undefined') {
                festosAuth.setUser(data, rememberMe);
            } else {
                localStorage.setItem('festUser', JSON.stringify(data));
                if (data.fest_id) {
                    localStorage.setItem('festos_active_fest_id', data.fest_id);
                }
                if (rememberMe) {
                    localStorage.setItem('festSavedUsername', username);
                    localStorage.setItem('festos_remember_session', 'true');
                }
            }

            const targetPage = ROLE_ROUTES[data.role];

            if (targetPage) {
                submitBtn.textContent = 'Success!';
                submitBtn.style.background = '#10b981';
                
                setTimeout(() => {
                    window.location.href = targetPage;
                }, 150);
            } else {
                throw new Error('Unrecognized access level. Contact system administrator.');
            }

        } catch (err) {
            if (errorBox) {
                errorBox.textContent = err.message;
                errorBox.style.display = 'block';
            }
            
            submitBtn.textContent = 'Authenticate';
            submitBtn.disabled = false;
            
            const form = document.querySelector('.login-container');
            if (form) {
                form.style.transform = 'translateX(5px)';
                setTimeout(() => form.style.transform = 'translateX(-5px)', 40);
                setTimeout(() => form.style.transform = 'translateX(5px)', 80);
                setTimeout(() => form.style.transform = 'translateX(0)', 120);
            }
        }
    });
}