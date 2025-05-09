document.addEventListener('DOMContentLoaded', function() {
    const API_URL = '/api/facilities';
    const form = document.getElementById('facilityUsageForm');
    const formPanel = document.getElementById('facilityUsageFormPanel');
    const addBtn = document.getElementById('addFacilityUsageBtn');
    const cancelBtn = document.getElementById('cancelFacilityBtn');
    const tableBody = document.querySelector('#facilityUsageTable tbody');
    const searchType = document.getElementById('facilitySearchType');
    const searchInput = document.getElementById('facilitySearchInput');
    const searchBtn = document.getElementById('facilitySearchBtn');
    const resetBtn = document.getElementById('facilityResetBtn');

    // Toggle form visibility
    addBtn.addEventListener('click', () => formPanel.style.display = 'block');
    cancelBtn.addEventListener('click', () => {
        formPanel.style.display = 'none';
        form.reset();
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const startTime = document.getElementById('facilityStartTime').value;
        const endTime = document.getElementById('facilityEndTime').value;
        
        // Calculate duration in minutes
        let duration = 0;
        if (startTime && endTime) {
            const start = new Date(`1970-01-01T${startTime}:00`);
            const end = new Date(`1970-01-01T${endTime}:00`);
            duration = Math.round((end - start) / 60000); // ms to minutes
        }

        const formData = {
            residentName: document.getElementById('facilityResidentName').value.trim(),
            doorNumber: document.getElementById('facilityResidentDoor').value.trim(),
            facilityType: document.getElementById('facilityType').value,
            date: document.getElementById('facilityDate').value,
            startTime: startTime,
            endTime: endTime,
            duration: duration
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.status === "success") {
                showAlert('Usage recorded successfully!', 'success');
                form.reset();
                formPanel.style.display = 'none';
                await loadLogs();
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Failed to record usage: ' + error.message, 'error');
        }
    });

    // Search functionality
    searchBtn.addEventListener('click', async () => {
        const type = searchType.value;
        const value = searchInput.value.trim();
        
        if (!value) {
            showAlert('Please enter a search term', 'warning');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/search?type=${type}&value=${encodeURIComponent(value)}`);
            const data = await response.json();
            
            if (data.logs && data.logs.length > 0) {
                updateTable(data.logs);
                showAlert(`Found ${data.logs.length} records`, 'success');
            } else {
                updateTable([]);
                showAlert('No matching records found', 'info');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Search failed: ' + error.message, 'error');
        }
    });

    // Reset search
    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchType.value = 'resident'; // Reset to default search type
        loadLogs(); // Reload all logs
    });

    // Load initial logs
    loadLogs();

    async function loadLogs() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            if (data.logs) {
                updateTable(data.logs);
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Failed to load usage data', 'error');
        }
    }

    function updateTable(logs) {
        tableBody.innerHTML = logs.map(log => `
            <tr>
                <td>${log.residentName}</td>
                <td>${log.residentID}</td>
                <td>${log.facility}</td>
                <td>${log.date}</td>
                <td>${log.time}</td>
                <td>${log.duration}</td>
            </tr>
        `).join('');
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        document.body.prepend(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    }
});