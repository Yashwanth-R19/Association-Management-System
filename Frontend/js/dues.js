document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '/api/dues';
    const addBtn = document.getElementById('addDueBtn');
    const formPanel = document.getElementById('dueFormPanel');
    const form = document.getElementById('dueForm');
    const cancelBtn = document.getElementById('cancelDueBtn');
    const tableBody = document.querySelector('#duesTable tbody');
    const unpaidBtn = document.getElementById('showUnpaidBtn');
    let showingUnpaidOnly = false;

    addBtn.addEventListener('click', () => {
        form.reset();
        formPanel.style.display = 'block';
    });

    cancelBtn.addEventListener('click', () => {
        formPanel.style.display = 'none';
        form.reset();
    });

    unpaidBtn.addEventListener('click', () => {
        showingUnpaidOnly = !showingUnpaidOnly;
        unpaidBtn.textContent = showingUnpaidOnly ? 'Show All' : 'Show Unpaid Only';
        loadDues();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            doorNumber: document.getElementById('dueDoorNumber').value,
            period: document.getElementById('duePeriod').value,
            amount: document.getElementById('dueAmount').value
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
            await loadDues();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });

    async function loadDues() {
        try {
            const response = await fetch(showingUnpaidOnly ? `${API_BASE}/unpaid` : API_BASE);
            renderDues(await response.json());
        } catch (error) {
            showToast('Failed to load dues: ' + error.message, 'error');
        }
    }

    function renderDues(dues) {
        tableBody.innerHTML = (dues || []).map(d => `
            <tr>
                <td>${d.door_number}</td>
                <td>${d.resident_name}</td>
                <td>${d.period}</td>
                <td>${Number(d.amount).toFixed(2)}</td>
                <td>${d.status}</td>
                <td>
                    ${d.status === 'UNPAID' ? `<button class="btn btn-sm btn-primary pay-btn" data-id="${d.id}">Mark Paid</button>` : ''}
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${d.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        tableBody.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`${API_BASE}/${btn.dataset.id}/pay`, { method: 'POST' });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadDues();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });

        tableBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await confirmDialog('Delete this due entry?')) return;
                try {
                    const response = await fetch(`${API_BASE}/${btn.dataset.id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadDues();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });
    }

    loadDues();
});
