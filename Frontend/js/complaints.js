document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '/api/complaints';
    const addBtn = document.getElementById('addComplaintBtn');
    const formPanel = document.getElementById('complaintFormPanel');
    const form = document.getElementById('complaintForm');
    const cancelBtn = document.getElementById('cancelComplaintBtn');
    const tableBody = document.querySelector('#complaintsTable tbody');
    const searchType = document.getElementById('searchType');
    const searchKeyword = document.getElementById('searchKeyword');
    const searchBtn = document.getElementById('searchBtn');
    const resetBtn = document.getElementById('resetSearchBtn');

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
            title: document.getElementById('complaintTitle').value,
            description: document.getElementById('complaintDescription').value,
            priority: document.getElementById('complaintPriority').value,
            raisedBy: document.getElementById('complaintRaisedBy').value
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
            await loadComplaints();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });

    searchBtn.addEventListener('click', async () => {
        const query = searchKeyword.value.trim();
        if (!query) return loadComplaints();
        try {
            const response = await fetch(`${API_BASE}/search/${searchType.value}/${encodeURIComponent(query)}`);
            renderComplaints(await response.json());
        } catch (error) {
            showToast('Search failed: ' + error.message, 'error');
        }
    });

    resetBtn.addEventListener('click', () => {
        searchKeyword.value = '';
        loadComplaints();
    });

    async function loadComplaints() {
        try {
            const response = await fetch(API_BASE);
            renderComplaints(await response.json());
        } catch (error) {
            showToast('Failed to load complaints: ' + error.message, 'error');
        }
    }

    function renderComplaints(complaints) {
        tableBody.innerHTML = (complaints || []).map(c => `
            <tr>
                <td><span class="status-badge priority-${c.priority}">${c.priority}</span></td>
                <td>${c.title}</td>
                <td>${c.raisedBy}</td>
                <td>${c.status}</td>
                <td>${c.assignedTo || '-'}</td>
                <td>
                    ${c.status !== 'resolved' ? `<button class="btn btn-sm btn-primary assign-btn" data-id="${c.id}">Assign</button>
                    <button class="btn btn-sm btn-secondary resolve-btn" data-id="${c.id}">Resolve</button>` : ''}
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${c.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        tableBody.querySelectorAll('.assign-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const assignedTo = await promptDialog('Assign to (staff/vendor name):');
                if (!assignedTo) return;
                try {
                    const response = await fetch(`${API_BASE}/${btn.dataset.id}/assign`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ assignedTo })
                    });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadComplaints();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });

        tableBody.querySelectorAll('.resolve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`${API_BASE}/${btn.dataset.id}/resolve`, { method: 'POST' });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadComplaints();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });

        tableBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await confirmDialog('Delete this complaint?')) return;
                try {
                    const response = await fetch(`${API_BASE}/${btn.dataset.id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadComplaints();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });
    }

    loadComplaints();
});
