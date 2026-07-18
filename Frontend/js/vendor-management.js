document.addEventListener('DOMContentLoaded', () => {
    const addVendorBtn = document.getElementById('addVendorBtn');
    const vendorFormPanel = document.getElementById('vendorFormPanel');
    const vendorForm = document.getElementById('vendorForm');
    const cancelVendorBtn = document.getElementById('cancelVendorBtn');
    const vendorTable = document.getElementById('vendorTable').querySelector('tbody');
    const searchInput = document.getElementById('vendorSearchInput');
    const searchBtn = document.getElementById('searchVendorBtn');
    const resetBtn = document.getElementById('resetVendorSearchBtn');
    const minCostBtn = document.getElementById('showMinCostBtn');
    const ratingFormPanel = document.getElementById('ratingFormPanel');
    const ratingForm = document.getElementById('ratingForm');
    const cancelRatingBtn = document.getElementById('cancelRatingBtn');

    vendorFormPanel.style.display = 'none';

    addVendorBtn.addEventListener('click', () => {
        vendorForm.reset();
        vendorFormPanel.style.display = 'block';
    });

    cancelVendorBtn.addEventListener('click', () => {
        vendorFormPanel.style.display = 'none';
        vendorForm.reset();
    });

    vendorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('vendorName').value,
            phone: document.getElementById('vendorPhone').value,
            email: document.getElementById('vendorEmail').value,
            workDescription: document.getElementById('vendorWork').value,
            cost: document.getElementById('vendorCost').value,
            startDate: document.getElementById('vendorStartDate').value,
            endDate: document.getElementById('vendorEndDate').value
        };
        try {
            const response = await fetch('/api/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            vendorFormPanel.style.display = 'none';
            vendorForm.reset();
            await loadVendors();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });

    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return loadVendors();
        const type = /^\d+$/.test(query) ? 'id' : 'name';
        try {
            const response = await fetch(`/api/vendors/search/${type}/${encodeURIComponent(query)}`);
            const result = await response.json();
            renderVendors(result);
        } catch (error) {
            showToast('Search failed: ' + error.message, 'error');
        }
    });

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        loadVendors();
    });

    minCostBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/vendors/min-cost');
            const vendor = await response.json();
            if (!vendor) return showToast('No vendors available.', 'info');
            renderVendors([vendor]);
        } catch (error) {
            showToast('Failed to fetch minimum-cost vendor: ' + error.message, 'error');
        }
    });

    cancelRatingBtn.addEventListener('click', () => {
        ratingFormPanel.style.display = 'none';
        ratingForm.reset();
    });

    ratingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vendorId = document.getElementById('ratingVendorId').value;
        const payload = {
            rating: document.getElementById('ratingValue').value,
            note: document.getElementById('ratingNote').value
        };
        try {
            const response = await fetch(`/api/vendors/${vendorId}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            ratingFormPanel.style.display = 'none';
            ratingForm.reset();
            await loadVendors();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });

    async function loadVendors() {
        try {
            const response = await fetch('/api/vendors');
            const result = await response.json();
            renderVendors(result);
        } catch (error) {
            showToast('Failed to load vendors: ' + error.message, 'error');
        }
    }

    function renderVendors(vendors) {
        vendorTable.innerHTML = (vendors || []).map(v => `
            <tr>
                <td>${v.id}</td>
                <td>${v.name}</td>
                <td>${v.workDescription}</td>
                <td>${v.phone}</td>
                <td>${v.email}</td>
                <td>${Number(v.cost).toFixed(2)}</td>
                <td>${v.startDate} - ${v.endDate}</td>
                <td>${v.avgRating > 0 ? Number(v.avgRating).toFixed(1) + ' / 5' : 'Not rated'}</td>
                <td>
                    <button class="btn btn-sm btn-primary rate-vendor" data-id="${v.id}">Rate</button>
                    <button class="btn btn-sm btn-danger delete-vendor" data-id="${v.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        vendorTable.querySelectorAll('.delete-vendor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!await confirmDialog(`Delete vendor #${id}?`)) return;
                try {
                    const response = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.status === 'error') throw new Error(result.message);
                    await loadVendors();
                } catch (error) {
                    showToast('Error: ' + error.message, 'error');
                }
            });
        });

        vendorTable.querySelectorAll('.rate-vendor').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('ratingVendorId').value = btn.getAttribute('data-id');
                ratingFormPanel.style.display = 'block';
            });
        });
    }

    loadVendors();
});
