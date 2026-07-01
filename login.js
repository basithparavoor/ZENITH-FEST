// Initialize Supabase Client
const SUPABASE_URL = 'https://amdpvvwgttzzwaxnufcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XkHBI5AuYWo4klAdKWI1ag_mp4psVSA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const role = document.getElementById('role').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.querySelector('.btn-primary');

    submitBtn.textContent = 'Authenticating...';
    submitBtn.disabled = true;

    try {
        // In a production app, use Supabase Auth (email/password). 
        // For custom username logic, query the users table securely:
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('role', role)
            .single();

        if (error || !data) throw new Error('Invalid credentials or role mismatch.');
        
        // Simple password check (In production, use bcrypt in Edge Functions)
        if (data.password_hash === password) {
            // Store session
            localStorage.setItem('festUser', JSON.stringify(data));
            
            // Route to respective dashboard
            const routes = {
                'master_admin': 'master-admin.html',
                'admin': 'admin.html',
                'fest_manager': 'manager.html',
                'stage_controller': 'stage-controller.html',
                'judge': 'judge.html'
            };
            window.location.href = routes[role];
        } else {
            throw new Error('Incorrect password.');
        }

    } catch (err) {
        alert(err.message);
        submitBtn.textContent = 'Sign In';
        submitBtn.disabled = false;
    }
});