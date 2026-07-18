document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '/api/notices';
    const addBtn = document.getElementById('addNoticeBtn');
    const formPanel = document.getElementById('noticeFormPanel');
    const form = document.getElementById('noticeForm');
    const cancelBtn = document.getElementById('cancelNoticeBtn');
    const list = document.getElementById('noticesList');

    addBtn.addEventListener('click', () => {
        form.reset();
        formPanel.style.display = 'block';
    });

    cancelBtn.addEventListener('click', () => {
        formPanel.style.display = 'none';
        form.reset();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('noticeTitle').value,
            body: document.getElementById('noticeBody').value,
            pinned: document.getElementById('noticePinned').checked
        };
        try {
            const response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            formPanel.style.display = 'none';
            form.reset();
            await loadNotices();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });

    async function loadNotices() {
        try {
            const response = await fetch(API_BASE);
            renderNotices(await response.json());
        } catch (error) {
            showToast('Failed to load notices: ' + error.message, 'error');
        }
    }

    function renderNotices(notices) {
        list.innerHTML = (notices || []).map(n => `
            <div class="form-panel notice-card">
                ${n.pinned ? '<span class="status-badge badge-pinned">Pinned</span>' : ''}
                <h3>${n.title}</h3>
                <p>${n.body}</p>
                <small>${new Date(n.created_at).toLocaleString()}${n.created_by ? ' - ' + n.created_by : ''}</small>
                <div style="margin-top:10px;">
                    <button class="btn btn-sm btn-danger delete-notice" data-id="${n.id}">Delete</button>
                </div>
            </div>
        `).join('') || '<p>No notices posted yet.</p>';

        list.querySelectorAll('.delete-notice').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await confirmDialog('Delete this notice?')) return;
                try {
                    const response = await fetch(`${API_BASE}/${btn.dataset.id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadNotices();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });
    }

    loadNotices();
});
