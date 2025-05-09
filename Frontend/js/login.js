document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('name').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            
            fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    sessionStorage.setItem('isAuthenticated', 'true');
                    sessionStorage.setItem('username', data.username);
                    window.location.href = data.redirect || '/residents.html';
                } else {
                    alert(data.message || 'Login failed');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Login failed. Please try again.');
            })
            .finally(() => {
                submitBtn.disabled = false;
            });
        });
    }
    
    // Check authentication status
    fetch('/api/check-auth')
        .then(response => response.json())
        .then(data => {
            if (data.authenticated && window.location.pathname.endsWith('login.html')) {
                window.location.href = '/residents.html';
            }
        });
});