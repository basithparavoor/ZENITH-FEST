// Connects securely to your specific Supabase instance
const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co'; //[cite: 2]
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA'; //[cite: 2]
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    const submitBtn = document.getElementById('submitBtn');
    const errorBox = document.getElementById('error-message');

    // Reset UI state
    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;
    errorBox.style.display = 'none';

    try {
        // Query the database by username only
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        // Handle user not found or database errors
        if (error || !data) {
            throw new Error('Account not found. Please check your username.');
        }
        
        // Verify password
        if (data.password_hash !== password) {
            throw new Error('Incorrect password. Please try again.');
        }

        // Store session securely in browser
        localStorage.setItem('festUser', JSON.stringify(data));
        
        // Auto-detect role and define routing
        const routes = {
            'master_admin': 'admin.html', // Master admins share the admin portal
            'admin': 'admin.html',
            'fest_manager': 'manager.html',
            'stage_controller': 'stage-controller.html',
            'judge': 'judge.html'
        };

        const targetPage = routes[data.role];

        if (targetPage) {
            submitBtn.textContent = 'Success! Redirecting...';
            submitBtn.style.background = '#10b981'; // Turn green on success
            
            // Short delay for smooth UI transition
            setTimeout(() => {
                window.location.href = targetPage;
            }, 600);
        } else {
            throw new Error('Unrecognized access level. Contact system administrator.');
        }

    } catch (err) {
        // Display error message
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
        
        // Reset button
        submitBtn.textContent = 'Authenticate';
        submitBtn.disabled = false;
        
        // Add a subtle shake animation to the form on failure
        const form = document.querySelector('.login-container');
        form.style.transform = 'translateY(0) translateX(5px)';
        setTimeout(() => form.style.transform = 'translateY(0) translateX(-5px)', 50);
        setTimeout(() => form.style.transform = 'translateY(0) translateX(5px)', 100);
        setTimeout(() => form.style.transform = 'translateY(0) translateX(0)', 150);
    }
});