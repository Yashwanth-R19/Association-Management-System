document.addEventListener('DOMContentLoaded', async () => {
    const nameEl = document.getElementById('profile-name');
    const roleEl = document.getElementById('profile-role');
    const createdEl = document.getElementById('profile-created');
    const lastLoginEl = document.getElementById('profile-last-login');
    const logoutBtn = document.getElementById('logoutBtn');
    const passwordForm = document.getElementById('passwordForm');

    try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error('Not authenticated');
        const data = await response.json();

        nameEl.textContent = data.username;
        roleEl.textContent = data.role.charAt(0).toUpperCase() + data.role.slice(1);
        createdEl.textContent = `Member since: ${new Date(data.createdAt).toLocaleDateString()}`;
        lastLoginEl.textContent = data.lastLogin
            ? `Last login: ${new Date(data.lastLogin).toLocaleString()}`
            : 'Last login: N/A';

        const navUserName = document.getElementById('navUserName');
        if (navUserName) navUserName.textContent = data.username;
    } catch (error) {
        window.location.href = 'login.html';
    }

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout');
        } finally {
            sessionStorage.removeItem('isAuthenticated');
            sessionStorage.removeItem('username');
            window.location.href = 'login.html';
        }
    });

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showToast('New password and confirmation do not match', 'error');
            return;
        }

        try {
            const response = await fetch('/api/profile/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            showToast('Password updated successfully', 'success');
            passwordForm.reset();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
});
