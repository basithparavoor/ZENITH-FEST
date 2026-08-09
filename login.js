const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const togglePasswordBtn = document.getElementById('togglePassword');
const submitBtn = document.getElementById('submitBtn');
const errorBox = document.getElementById('error-message');

// Load saved username on initialization
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('festSavedUsername');
    if (savedUser) {
        usernameInput.value = savedUser;
        rememberMeCheckbox.checked = true;
    }
});

// Show/Hide Password Logic
togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    passwordInput.classList.toggle('password-visible');
    
    // Swap SVG icons
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

// Authentication Logic
// Authentication Logic
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const rememberMe = rememberMeCheckbox.checked;

    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;
    errorBox.style.display = 'none';

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) throw new Error('Account not found. Please check your username.');
        if (data.password_hash !== password) throw new Error('Incorrect password. Please try again.');

        // Handle "Save Login" choice
        if (rememberMe) {
            localStorage.setItem('festSavedUsername', username);
        } else {
            localStorage.removeItem('festSavedUsername');
        }

        // Store active session
        localStorage.setItem('festUser', JSON.stringify(data));
        
        // Updated Routing Dictionary
        const routes = {
            'master_admin': 'admin.html',
            'admin': 'admin.html',
            'fest_manager': 'manager.html', 
            'team_manager': 'team-manager.html', 
            'stage_controller': 'stage-controller.html',
            'judge': 'judge.html',
            'announcer': 'announcements.html' // <-- Added Announcer Route
        };

        const targetPage = routes[data.role];

        if (targetPage) {
            submitBtn.textContent = 'Success!';
            submitBtn.style.background = '#10b981'; // Green for success
            
            // Reduced timing delay from 600ms to 150ms for snappier experience
            setTimeout(() => {
                window.location.href = targetPage;
            }, 150);
        } else {
            throw new Error('Unrecognized access level. Contact system administrator.');
        }

    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
        
        submitBtn.textContent = 'Authenticate';
        submitBtn.disabled = false;
        
        // Faster, tighter shake animation
        const form = document.querySelector('.login-container');
        form.style.transform = 'translateX(5px)';
        setTimeout(() => form.style.transform = 'translateX(-5px)', 40);
        setTimeout(() => form.style.transform = 'translateX(5px)', 80);
        setTimeout(() => form.style.transform = 'translateX(0)', 120);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // Other init functions...
    fetchAndApplyBranding();
});

// ==========================================
// UNIFIED GLOBAL BRANDING ENGINE
// ==========================================
async function fetchAndApplyBranding() {
    try {
        const { data, error } = await supabaseClient
            .from('settings')
            .select('value')
            .eq('id', 'system_branding')
            .maybeSingle();

        if (error) throw error;
        if (data && data.value) applyGlobalBranding(data.value);
    } catch (e) {
        console.warn("Could not fetch global branding:", e.message);
    }
}

function applyGlobalBranding(brandingData) {
    const validName = brandingData.fest_name && brandingData.fest_name.trim() !== '';
    const validLogo = brandingData.fest_logo && brandingData.fest_logo.trim() !== '';
    const displayMode = brandingData.display_mode || 'both'; // 'both', 'logo', 'name'
    
    // 1. Update Document Title dynamically
    const festName = validName ? brandingData.fest_name : 'FestOS';
    const titleParts = document.title.split('|');
    const pageContext = titleParts.length > 1 ? titleParts[1].trim() : 'Portal';
    document.title = `${festName} | ${pageContext}`;

    // 2. Global Favicon Injection (Fixes missing Favicons)
    if (validLogo) {
        let iconLinks = document.querySelectorAll("link[rel~='icon']");
        if (iconLinks.length === 0) {
            let newIcon = document.createElement('link');
            newIcon.rel = 'icon';
            document.head.appendChild(newIcon);
            iconLinks = [newIcon];
        }
        iconLinks.forEach(link => link.href = brandingData.fest_logo);
    }

    // 3. UI Header Updates (Fixes display preferences & sizing)
    // Grabs the sidebar brand, navbar brand, and the main header h1
    const brandContainers = document.querySelectorAll('.brand, .navbar-brand, .logo-text, .header h1');
    
    brandContainers.forEach(container => {
        // Safety check to avoid overwriting page titles like "Workspace Overview"
        if(container.id === 'page-title') return; 

        let html = '';
        const showLogo = validLogo && (displayMode === 'both' || displayMode === 'logo');
        const showName = (displayMode === 'both' || displayMode === 'name') || (!validLogo && displayMode === 'logo');
        
        // Dynamic Logo Sizing
        if (showLogo) {
            html += `<img src="${brandingData.fest_logo}" alt="Logo" style="height: 32px; width: auto; max-width: 150px; object-fit: contain; border-radius: 6px; margin-right: ${showName ? '8px' : '0'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
        } else if (!validLogo && displayMode !== 'name') {
            html += `<i class="fa-solid fa-bolt" style="color: var(--primary); margin-right: 8px;"></i>`;
        }
        
        // Dynamic Text
        if (showName) {
            let textToDisplay = validName ? brandingData.fest_name : 'FestOS';
            
            // If this is the specific Program Report header, append its title
            if (window.location.pathname.includes('program_report') && container.tagName === 'H1') {
                textToDisplay += ' Reports Engine';
            }
            
            html += `<span style="letter-spacing: -0.5px;">${textToDisplay}</span>`;
        }
        
        container.innerHTML = html;
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.flexWrap = 'wrap'; // Prevents layout crunching
        
        // Keeps centered strictly on Login and Scan screens
        if (window.location.pathname.includes('scan') || window.location.pathname.includes('login') || window.location.pathname.includes('index') || window.location.pathname === '/') {
            container.style.justifyContent = 'center';
        }
    });

    // Store globally so the PDF Generators can read the display preference
    if (typeof window !== 'undefined') window.systemBranding = brandingData;
}