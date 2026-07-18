// Populates the real logged-in username and wires a direct logout link in
// every page's nav (previously hardcoded to "Admin" with no way to log out
// except clicking through to the profile page first).
(function () {
    fetch('/api/check-auth')
        .then((r) => r.json())
        .then((data) => {
            const nameEl = document.getElementById('navUserName');
            if (nameEl && data.authenticated && data.user) {
                nameEl.textContent = data.user.username;
            }
        })
        .catch(() => {});

    const logoutLink = document.getElementById('navLogoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/logout');
            } finally {
                sessionStorage.removeItem('isAuthenticated');
                sessionStorage.removeItem('username');
                window.location.href = 'login.html';
            }
        });
    }
})();
