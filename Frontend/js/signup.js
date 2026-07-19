document.addEventListener('DOMContentLoaded', function () {
    const signupForm = document.getElementById('signupForm');

    if (signupForm) {
        signupForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const username = document.getElementById('name').value.trim();
            const role = document.getElementById('role').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const submitBtn = signupForm.querySelector('button[type="submit"]');

            if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }

            submitBtn.disabled = true;

            fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Signup signs the account straight in (cookie already set).
                        sessionStorage.setItem('isAuthenticated', 'true');
                        sessionStorage.setItem('username', data.username);
                        window.location.href = data.redirect || '/home.html';
                    } else {
                        showToast(data.message || 'Signup failed', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('Signup failed. Please try again.', 'error');
                })
                .finally(() => {
                    submitBtn.disabled = false;
                });
        });
    }

    // Already logged in? Skip the signup form.
    fetch('/api/check-auth')
        .then(response => response.json())
        .then(data => {
            if (data.authenticated && window.location.pathname.endsWith('signup.html')) {
                window.location.href = '/home.html';
            }
        });
});
