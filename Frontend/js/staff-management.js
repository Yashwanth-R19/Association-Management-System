document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '/api/staff';
    const attendanceTable = document.getElementById('attendanceTable').getElementsByTagName('tbody')[0];
    
    // Initialize
    loadAttendance();

    // Form handlers
    document.getElementById('checkInForm').addEventListener('submit', handleCheckIn);
    document.getElementById('checkOutForm').addEventListener('submit', handleCheckOut);
    document.getElementById('searchStaffBtn').addEventListener('click', handleSearch);
    document.getElementById('resetStaffSearchBtn').addEventListener('click', resetSearch);
    document.getElementById('deleteStaffBtn').addEventListener('click', handleDelete);

    // Button handlers
    document.getElementById('checkInBtn').addEventListener('click', () => {
        document.getElementById('checkInFormPanel').style.display = 'block';
        document.getElementById('checkOutFormPanel').style.display = 'none';
    });

    document.getElementById('checkOutBtn').addEventListener('click', () => {
        document.getElementById('checkOutFormPanel').style.display = 'block';
        document.getElementById('checkInFormPanel').style.display = 'none';
    });

    document.getElementById('cancelCheckInBtn').addEventListener('click', () => {
        document.getElementById('checkInFormPanel').style.display = 'none';
    });

    document.getElementById('cancelCheckOutBtn').addEventListener('click', () => {
        document.getElementById('checkOutFormPanel').style.display = 'none';
    });

    async function loadAttendance() {
        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('Failed to load data');
            const data = await response.json();
            renderTable(data);
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }

    async function handleCheckIn(e) {
        e.preventDefault();
        const name = document.getElementById('staffName').value.trim();
        const wage = parseFloat(document.getElementById('staffWage').value);

        if (!name || isNaN(wage)) {
            showAlert('Please enter valid name and wage', 'error');
            return;
        }

        try {
            const response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffName: name, wagePerHour: wage })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Check-in failed');

            showAlert(`${name} checked in successfully`, 'success');
            document.getElementById('checkInForm').reset();
            document.getElementById('checkInFormPanel').style.display = 'none';
            loadAttendance();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }

    async function handleCheckOut(e) {
        e.preventDefault();
        const name = document.getElementById('checkOutStaffName').value.trim();
        if (!name) {
            showAlert('Please enter staff name', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffName: name })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Check-out failed');

            showAlert(`${name} checked out successfully`, 'success');
            document.getElementById('checkOutForm').reset();
            document.getElementById('checkOutFormPanel').style.display = 'none';
            loadAttendance();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }

    async function handleSearch() {
        const query = document.getElementById('staffSearchInput').value.trim();
        if (!query) {
            showAlert('Please enter search term', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/search?name=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            renderTable(data);
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }

    function resetSearch() {
        document.getElementById('staffSearchInput').value = '';
        loadAttendance();
    }

    async function handleDelete() {
        const name = await promptDialog("Enter staff name to delete:");
        if (!name) return;

        if (!await confirmDialog(`Are you sure you want to delete ${name}?`)) return;

        try {
            const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Delete failed');
            
            showAlert(`${name} deleted successfully`, 'success');
            loadAttendance();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    }

    function renderTable(data) {
        attendanceTable.innerHTML = '';
        
        if (!data || data.length === 0) {
            const row = attendanceTable.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.textContent = 'No records found';
            cell.style.textAlign = 'center';
            return;
        }

        data.forEach(staff => {
            const row = attendanceTable.insertRow();
            const checkIn = staff.checkInTime ? new Date(staff.checkInTime * 1000).toLocaleString() : '-';
            const checkOut = staff.checkOutTime ? new Date(staff.checkOutTime * 1000).toLocaleString() : '-';
            row.innerHTML = `
                <td>${staff.name}</td>
                <td>${checkIn}</td>
                <td>${checkOut}</td>
                <td>${staff.hoursWorked ? staff.hoursWorked.toFixed(2) : '-'}</td>
                <td>Rs.${staff.wagePerHour ? staff.wagePerHour.toFixed(2) : '0.00'}</td>
                <td>Rs.${staff.earnings ? staff.earnings.toFixed(2) : '0.00'}</td>
                <td><button class="btn-delete">Delete</button></td>
            `;

            row.querySelector('.btn-delete').addEventListener('click', async () => {
                if (await confirmDialog(`Delete ${staff.name}?`)) {
                    fetch(`${API_BASE}/${encodeURIComponent(staff.name)}`, {
                        method: 'DELETE'
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Delete failed');
                        showAlert(`${staff.name} deleted`, 'success');
                        loadAttendance();
                    })
                    .catch(error => showAlert(error.message, 'error'));
                }
            });
        });
    }

    function showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        document.body.prepend(alert);
        setTimeout(() => alert.remove(), 3000);
    }
});