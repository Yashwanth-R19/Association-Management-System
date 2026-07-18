/* ============================================================================
   shell.js — builds the persistent sidebar + topbar for every app page.
   Supersedes the old per-page <header> and nav.js. Include on every page
   EXCEPT login.html. Requires a body with:
       <div class="app"><div class="app-main"><main class="content">…</main></div></div>
   Keeps the JS contract the old nav relied on: it injects #navUserName and
   #navLogoutLink so any legacy code still finds them.
   ========================================================================== */
(function () {
    'use strict';

    // ---- Inline icon set (stroke, currentColor) -----------------------------
    var I = {
        leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
        home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
        users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 5.6"/><path d="M18 20a5.5 5.5 0 0 0-3-4.9"/>',
        committee: '<path d="M12 3 4 7v2h16V7Z"/><path d="M6 9v8M10 9v8M14 9v8M18 9v8"/><path d="M4 20h16"/>',
        staff: '<circle cx="12" cy="7" r="3.2"/><path d="M6 21a6 6 0 0 1 12 0"/><path d="m12 10 0 4"/>',
        calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>',
        megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1Z"/><path d="M18 8a5 5 0 0 1 0 8"/>',
        ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M14 6v12"/>',
        building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"/>',
        truck: '<path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
        coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.66 2.7 3 6 3s6-1.34 6-3"/><path d="M15 12.5c2 .3 3.5 1.2 3.5 2.5 0 1.66-2.7 3-6 3-1.3 0-2.5-.2-3.5-.6"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
        logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
    };
    function svg(name) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
               'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + '</svg>';
    }

    // ---- Navigation model (grouping encodes what each module is about) -------
    var NAV = [
        { group: 'Overview', items: [
            { href: 'home.html', label: 'Home', icon: 'home' }
        ]},
        { group: 'People', items: [
            { href: 'residents.html', label: 'Residents', icon: 'users' },
            { href: 'association.html', label: 'Association', icon: 'committee' },
            { href: 'staff-management.html', label: 'Staff', icon: 'staff' }
        ]},
        { group: 'Activity', items: [
            { href: 'meetings.html', label: 'Meetings', icon: 'calendar' },
            { href: 'notices.html', label: 'Notices', icon: 'megaphone' },
            { href: 'complaints.html', label: 'Complaints', icon: 'ticket' }
        ]},
        { group: 'Facilities & Finance', items: [
            { href: 'facility-tracking.html', label: 'Facilities', icon: 'building' },
            { href: 'vendor-management.html', label: 'Vendors', icon: 'truck' },
            { href: 'dues.html', label: 'Dues', icon: 'coins' }
        ]}
    ];

    var current = (location.pathname.split('/').pop() || 'home.html').toLowerCase();

    // ---- Build sidebar ------------------------------------------------------
    var navHTML = NAV.map(function (g) {
        var links = g.items.map(function (it) {
            var active = it.href.toLowerCase() === current ? ' active' : '';
            return '<a class="nav-link' + active + '" href="' + it.href + '">' +
                   svg(it.icon) + '<span class="nav-label">' + it.label + '</span></a>';
        }).join('');
        return '<div class="nav-group"><h6>' + g.group + '</h6>' + links + '</div>';
    }).join('');

    var sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML =
        '<a class="brand" href="home.html">' +
            '<span class="brand-mark">' + svg('leaf') + '</span>' +
            '<span class="brand-text"><b>Ceebros Gardens</b><span>Association portal</span></span>' +
        '</a>' +
        '<div class="side-search">' + svg('search') +
            '<input type="text" id="navFilter" placeholder="Filter menu…" aria-label="Filter menu">' +
        '</div>' +
        '<nav class="side-nav">' + navHTML + '</nav>' +
        '<div class="side-foot">' +
            '<a class="user-chip" href="profile.html">' +
                '<span class="user-avatar" id="navAvatar">A</span>' +
                '<span class="u-meta"><span class="u-name" id="navUserName">Admin</span>' +
                '<span class="u-role" id="navUserRole">Signed in</span></span>' +
            '</a>' +
            '<div class="side-actions">' +
                '<button type="button" class="side-btn theme-toggle" id="themeToggle" aria-label="Toggle theme">' +
                    '<span class="t-sun">' + svg('sun') + '</span>' +
                    '<span class="t-moon">' + svg('moon') + '</span>' +
                    '<span class="t-text">Theme</span>' +
                '</button>' +
                '<a class="side-btn" href="#" id="navLogoutLink">' + svg('logout') + '<span>Log out</span></a>' +
            '</div>' +
        '</div>';

    // ---- Build topbar -------------------------------------------------------
    var labelMap = {};
    NAV.forEach(function (g) { g.items.forEach(function (it) { labelMap[it.href.toLowerCase()] = it.label; }); });
    labelMap['profile.html'] = 'Profile';
    var here = labelMap[current] || (document.title.split(/[-–|]/)[0].trim()) || 'Home';

    var topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML =
        '<button type="button" class="hamburger" id="navToggle" aria-label="Open menu">' + svg('menu') + '</button>' +
        '<div class="crumb"><span>Ceebros Gardens</span><span class="sep">/</span>' +
            '<span class="here">' + here + '</span></div>' +
        '<div class="spacer"></div>' +
        '<span class="today">' + new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '</span>';

    // ---- Mount --------------------------------------------------------------
    function mount() {
        var app = document.querySelector('.app');
        var main = document.querySelector('.app-main');
        if (!app || !main) return;
        app.insertBefore(sidebar, app.firstChild);
        main.insertBefore(topbar, main.firstChild);

        var scrim = document.createElement('div');
        scrim.className = 'scrim';
        app.appendChild(scrim);

        wire(scrim);
    }

    // ---- Behaviour ----------------------------------------------------------
    function wire(scrim) {
        // Mobile drawer
        var toggle = document.getElementById('navToggle');
        function closeNav() { document.body.classList.remove('nav-open'); }
        if (toggle) toggle.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
        scrim.addEventListener('click', closeNav);
        sidebar.querySelectorAll('.nav-link').forEach(function (a) { a.addEventListener('click', closeNav); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

        // Menu filter
        var filter = document.getElementById('navFilter');
        if (filter) filter.addEventListener('input', function () {
            var q = filter.value.trim().toLowerCase();
            sidebar.querySelectorAll('.nav-group').forEach(function (grp) {
                var any = false;
                grp.querySelectorAll('.nav-link').forEach(function (link) {
                    var hit = link.textContent.toLowerCase().indexOf(q) !== -1;
                    link.style.display = hit ? '' : 'none';
                    if (hit) any = true;
                });
                grp.style.display = any ? '' : 'none';
            });
        });

        // Theme toggle
        var themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('ams-theme', next); } catch (e) {}
        });

        // Logout
        var logout = document.getElementById('navLogoutLink');
        if (logout) logout.addEventListener('click', function (e) {
            e.preventDefault();
            fetch('/api/logout').catch(function () {}).finally(function () {
                try { sessionStorage.removeItem('isAuthenticated'); sessionStorage.removeItem('username'); } catch (e) {}
                window.location.href = 'login.html';
            });
        });

        // Real user identity
        fetch('/api/check-auth').then(function (r) { return r.json(); }).then(function (data) {
            if (data && data.authenticated && data.user) {
                var n = document.getElementById('navUserName');
                var role = document.getElementById('navUserRole');
                var av = document.getElementById('navAvatar');
                if (n) n.textContent = data.user.username;
                if (role && data.user.role) role.textContent = data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1);
                if (av && data.user.username) av.textContent = data.user.username.charAt(0).toUpperCase();
            }
        }).catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
