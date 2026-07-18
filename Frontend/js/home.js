/* home.js — dashboard: pulls counts from existing module APIs, animates them,
   and shows a recent-notices feed + quick actions. Every fetch is defensive:
   a failed module shows an em-dash rather than breaking the page. */
document.addEventListener('DOMContentLoaded', function () {
    var svgNS = 'http://www.w3.org/2000/svg';

    function icon(path) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
            'stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
    }
    var ICON = {
        users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 5.6"/><path d="M18 20a5.5 5.5 0 0 0-3-4.9"/>',
        ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M14 6v12"/>',
        calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>',
        coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.66 2.7 3 6 3s6-1.34 6-3"/><path d="M15 12.5c2 .3 3.5 1.2 3.5 2.5 0 1.66-2.7 3-6 3-1.3 0-2.5-.2-3.5-.6"/>',
        megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1Z"/><path d="M18 8a5 5 0 0 1 0 8"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"/>'
    };

    document.getElementById('ico-res').innerHTML = icon(ICON.users);
    document.getElementById('ico-cmp').innerHTML = icon(ICON.ticket);
    document.getElementById('ico-mtg').innerHTML = icon(ICON.calendar);
    document.getElementById('ico-due').innerHTML = icon(ICON.coins);

    // Greeting reflects the time of day + the real signed-in user.
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var greetEl = document.getElementById('greeting');
    fetch('/api/check-auth').then(function (r) { return r.json(); }).then(function (d) {
        var name = (d && d.user && d.user.username) ? d.user.username : 'there';
        greetEl.innerHTML = part + ', <em>' + name + '</em>';
    }).catch(function () { greetEl.innerHTML = part + ', <em>there</em>'; });

    // ---- Animated count-up --------------------------------------------------
    function setStat(key, value, opts) {
        opts = opts || {};
        var el = document.querySelector('[data-stat="' + key + '"]');
        if (!el) return;
        if (value == null || isNaN(value)) { el.textContent = '—'; return; }
        var prefix = el.getAttribute('data-prefix') || '';
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var end = Number(value);
        if (reduce) { el.innerHTML = prefix + format(end, opts); return; }
        var start = performance.now(), dur = 900;
        function tick(now) {
            var p = Math.min((now - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.innerHTML = prefix + format(end * eased, opts);
            if (p < 1) requestAnimationFrame(tick);
            else el.innerHTML = prefix + format(end, opts);
        }
        requestAnimationFrame(tick);
    }
    function format(n, opts) {
        if (opts.compact && n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
        return Math.round(n).toLocaleString();
    }

    // ---- Module fetches -----------------------------------------------------
    function getJSON(url) {
        return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }

    // Residents
    getJSON('/api/residents').then(function (list) {
        if (!Array.isArray(list)) throw 0;
        setStat('residents', list.length);
        var owners = list.filter(function (r) { return (r.ownership || '').toUpperCase() === 'OWNER'; }).length;
        document.getElementById('sub-res').textContent = owners + ' owners · ' + (list.length - owners) + ' tenants';
    }).catch(function () { setStat('residents', null); });

    // Complaints (status !== 'resolved' counts as open)
    getJSON('/api/complaints').then(function (list) {
        if (!Array.isArray(list)) throw 0;
        var open = list.filter(function (c) { return (c.status || '').toLowerCase() !== 'resolved'; }).length;
        setStat('complaints', open);
        document.getElementById('sub-cmp').textContent = open === 0 ? 'All clear' : open + ' of ' + list.length + ' still open';
    }).catch(function () { setStat('complaints', null); });

    // Meetings (upcoming = date >= today)
    getJSON('/api/meetings').then(function (list) {
        if (!Array.isArray(list)) throw 0;
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var upcoming = list.filter(function (m) {
            var d = new Date(m.date || m.meetingDate || m.meeting_date);
            return !isNaN(d) && d >= today;
        }).length;
        setStat('meetings', upcoming);
        document.getElementById('sub-mtg').textContent = list.length + ' on record';
    }).catch(function () { setStat('meetings', null); });

    // Dues outstanding (sum of unpaid amounts)
    getJSON('/api/dues/unpaid').then(function (list) {
        if (!Array.isArray(list)) throw 0;
        var total = list.reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
        setStat('dues', total, { compact: true });
        document.getElementById('sub-due').textContent = list.length + ' unpaid ' + (list.length === 1 ? 'entry' : 'entries');
    }).catch(function () { setStat('dues', null); });

    // ---- Recent notices feed ------------------------------------------------
    var feed = document.getElementById('activityFeed');
    getJSON('/api/notices').then(function (list) {
        if (!Array.isArray(list) || list.length === 0) {
            feed.innerHTML = '<p class="muted">No notices posted yet. Head to Notices to post the first one.</p>';
            return;
        }
        feed.innerHTML = list.slice(0, 6).map(function (n) {
            var when = n.created_at ? new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
            var by = n.created_by ? ' · ' + n.created_by : '';
            return '<a class="feed-item" href="notices.html">' +
                '<span class="feed-dot">' + icon(ICON.megaphone) + '</span>' +
                '<span class="feed-body"><b>' + escapeHTML(n.title || 'Notice') + '</b>' +
                '<span>' + when + by + '</span></span></a>';
        }).join('');
    }).catch(function () {
        feed.innerHTML = '<p class="muted">Could not load notices right now.</p>';
    });

    // ---- Quick actions ------------------------------------------------------
    var actions = [
        { href: 'residents.html', label: 'Add resident', icon: ICON.users },
        { href: 'complaints.html', label: 'Log complaint', icon: ICON.ticket },
        { href: 'meetings.html', label: 'Schedule meeting', icon: ICON.calendar },
        { href: 'dues.html', label: 'Record due', icon: ICON.coins },
        { href: 'notices.html', label: 'Post notice', icon: ICON.megaphone },
        { href: 'facility-tracking.html', label: 'Log facility use', icon: ICON.building }
    ];
    document.getElementById('quickGrid').innerHTML = actions.map(function (a) {
        return '<a class="quick" href="' + a.href + '"><span class="q-ico">' + icon(a.icon) + '</span>' + a.label + '</a>';
    }).join('');

    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
});
