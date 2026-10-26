/**
 * FestOS Universal Authentication Engine (login.js)
 * Persistent Multi-Role Authentication, Dynamic Branding, and Auto-Reconnect
 */

const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabaseClient || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
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
// Check immediately to prevent screen flash
(function autoRedirectIfLoggedIn() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('switch') === 'true' || urlParams.get('logout') === 'true') {
            return; // Explicit switch / logout requested
        }

        // Check Super Admin first
        const superAdminStr = localStorage.getItem('festSuperAdmin');
        if (superAdminStr) {
            const superAdmin = JSON.parse(superAdminStr);
            if (superAdmin && (superAdmin.role === 'super_admin' || superAdmin.is_super_admin)) {
                window.location.replace('superadmin.html');
                return;
            }
        }

        // Check Regular / Master Admin / Manager session
        const userStr = localStorage.getItem('festUser');
        const isRemembered = localStorage.getItem('festos_remember_session') === 'true';

        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.role) {
                // If remembered OR simply closed app without logging out, auto-redirect!
                const targetRoute = ROLE_ROUTES[user.role] || 'admin.html';
                window.location.replace(targetRoute);
                return;
            }
        }
    } catch (e) {
        console.warn('Auto-redirect check notice:', e);
    }
})();

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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('switch') === 'true' || urlParams.get('logout') === 'true') {
        return;
    }

    const activeUser = festosAuth ? festosAuth.getUser() : JSON.parse(localStorage.getItem('festUser') || 'null');
    if (activeUser && activeUser.role) {
        const targetRoute = ROLE_ROUTES[activeUser.role] || 'admin.html';
        window.location.replace(targetRoute);
    }
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
            if (data.role === 'super_admin') {
                data.fest_id = null;
            } else if (!data.fest_id) {
                const prefix = (data.username || '').split('_')[0].toLowerCase().trim();
                const defaultFestId = (typeof window.festosDefaultFestId === 'function')
                    ? window.festosDefaultFestId()
                    : 'fest_vib26_muml4haa';
                if (prefix === 'zenith26' || prefix === 'zenith') {
                    data.fest_id = defaultFestId;
                } else if (/^[a-z0-9]{3,20}$/.test(prefix) && prefix !== 'superadmin' && prefix !== 'admin') {
                    const candidate = `fest_${prefix}`;
                    const known = (window.festosDomains && typeof window.festosDomains.hasFest === 'function')
                        ? window.festosDomains.hasFest(candidate)
                        : true;
                    data.fest_id = known ? candidate : defaultFestId;
                } else {
                    data.fest_id = defaultFestId;
                }
            }

            // Handle "Save Login" persistent session & active fest
            if (typeof festosAuth !== 'undefined') {
                if (data.role === 'super_admin') {
                    festosAuth.setSuperAdmin(data);
                }
                festosAuth.setUser(data, rememberMe);
            } else {
                localStorage.setItem('festUser', JSON.stringify(data));
                if (data.role === 'super_admin') {
                    localStorage.setItem('festSuperAdmin', JSON.stringify(data));
                } else if (data.fest_id) {
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