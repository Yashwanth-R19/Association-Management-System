document.addEventListener('DOMContentLoaded', function() {
    const API_URL = '/api/residents';
    const addResidentBtn = document.getElementById('addResidentBtn');
    const residentFormPanel = document.getElementById('residentFormPanel');
    const residentForm = document.getElementById('residentForm');
    const cancelResidentBtn = document.getElementById('cancelResidentBtn');
    const formTitle = document.getElementById('formTitle');
    const residentTable = document.getElementById('residentTable');
    const searchType = document.getElementById('searchType');
    const searchInput = document.getElementById('searchInput');
    const searchInputGroup = document.getElementById('searchInputGroup');
    const blockSelect = document.getElementById('blockSelect');
    const blockSelectGroup = document.getElementById('blockSelectGroup');
    const floorSelect = document.getElementById('floorSelect');
    const floorSelectGroup = document.getElementById('floorSelectGroup');
    const searchBtn = document.getElementById('searchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');

    // Initialize the page
    loadResidents();

    // Event Listeners
    addResidentBtn.addEventListener('click', showAddForm);
    cancelResidentBtn.addEventListener('click', hideForm);
    residentForm.addEventListener('submit', handleFormSubmit);
    searchType.addEventListener('change', handleSearchTypeChange);
    searchBtn.addEventListener('click', handleSearch);
    resetSearchBtn.addEventListener('click', resetSearch);

    // Function to show alert messages
    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    }

    // Form visibility functions
    function showAddForm() {
        residentForm.reset();
        formTitle.textContent = 'Add New Resident';
        residentFormPanel.style.display = 'block';
    }

    function hideForm() {
        residentFormPanel.style.display = 'none';
    }

    // Handle search type change
    function handleSearchTypeChange() {
        const type = searchType.value;
        
        searchInputGroup.style.display = 'none';
        blockSelectGroup.style.display = 'none';
        floorSelectGroup.style.display = 'none';
        
        if (type === 'block') {
            blockSelectGroup.style.display = 'block';
        } else if (type === 'floor') {
            floorSelectGroup.style.display = 'block';
        } else {
            searchInputGroup.style.display = 'block';
        }
    }

    // Load residents from API
    function loadResidents() {
        fetchResidents(API_URL);
    }

    // Fetch residents from API
    function fetchResidents(url) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    renderResidents(data);
                } else {
                    throw new Error('Invalid data format received');
                }
            })
            .catch(error => {
                console.error('Error fetching residents:', error);
                showAlert('Failed to load residents. Please try again.', 'error');
                // Fallback to empty table
                residentTable.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center;">Error loading residents</td>
                    </tr>
                `;
            });
    }

    // Render residents in the table
    function renderResidents(residents) {
        if (residents.length === 0) {
            residentTable.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center;">No residents found</td>
                </tr>
            `;
            return;
        }
        
        residentTable.innerHTML = residents.map(resident => `
            <tr>
                <td>${resident.door_number}</td>
                <td>${resident.name}</td>
                <td>${resident.contact}</td>
                <td>${resident.ownership}</td>
                <td>${resident.parking_slot || '-'}</td>
                <td class="action-btns">
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${resident.door_number}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Add event listeners to delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const doorNumber = btn.getAttribute('data-id');
                deleteResident(doorNumber);
            });
        });
    }

    // Validate resident data
    function validateResident(resident) {
        if (!/^[a-zA-Z\s]{1,49}$/.test(resident.name)) {
            showAlert('Invalid name! Only letters and spaces allowed (max 49 characters)', 'error');
            return false;
        }

        if (!/^\d{10}$/.test(resident.contact)) {
            showAlert('Contact number must be exactly 10 digits!', 'error');
            return false;
        }

        if (!resident.block) {
            showAlert('Please select a block', 'error');
            return false;
        }

        if (!resident.floor || resident.floor < 1 || resident.floor > 7) {
            showAlert('Floor number must be between 1 and 7!', 'error');
            return false;
        }

        if (!/^[A-Za-z]{1}$/.test(resident.doorAlpha)) {
            showAlert('Door alphabet must be a single letter (A-Z)', 'error');
            return false;
        }

        return true;
    }

    // Handle form submission
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const residentData = {
            name: document.getElementById('name').value.trim(),
            block: document.getElementById('block').value,
            floor: parseInt(document.getElementById('floor').value),
            doorAlpha: document.getElementById('doorAlpha').value.toUpperCase(),
            contact: document.getElementById('contact').value.trim(),
            ownership: document.getElementById('ownership').value,
            parking: document.getElementById('parking').value.trim()
        };

        if (!validateResident(residentData)) {
            return;
        }

        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(residentData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            showAlert('Resident added successfully!', 'success');
            hideForm();
            loadResidents();
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert(error.message || 'Failed to add resident', 'error');
        });
    }

    // Delete resident function
    async function deleteResident(doorNumber) {
        if (!await confirmDialog(`Are you sure you want to delete resident ${doorNumber}?`)) {
            return;
        }

        fetch(`${API_URL}/${encodeURIComponent(doorNumber)}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            showAlert('Resident deleted successfully!', 'success');
            loadResidents();
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert(error.message || 'Failed to delete resident', 'error');
        });
    }

    // Search functionality
    function handleSearch() {
        const type = searchType.value;
        let url = `${API_URL}/search/`;
        
        switch(type) {
            case 'door':
                const doorNumber = searchInput.value.trim();
                if (doorNumber) url += `door/${encodeURIComponent(doorNumber)}`;
                break;
            case 'phone':
                const phone = searchInput.value.trim();
                if (phone) url += `phone/${encodeURIComponent(phone)}`;
                break;
            case 'name':
                const name = searchInput.value.trim();
                if (name) url += `name/${encodeURIComponent(name)}`;
                break;
            case 'block':
                const block = blockSelect.value;
                if (block) url += `block/${encodeURIComponent(block)}`;
                break;
            case 'floor':
                const floor = floorSelect.value;
                if (floor) url += `floor/${floor}`;
                break;
            default:
                showAlert('Please select a valid search type', 'error');
                return;
        }
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Search failed');
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    renderResidents(data);
                    if (data.length === 0) {
                        showAlert('No residents found matching your criteria', 'info');
                    }
                } else {
                    throw new Error('Invalid search results');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert(error.message || 'Search failed', 'error');
            });
    }

    // Reset search functionality
    function resetSearch() {
        searchType.value = 'door';
        searchInput.value = '';
        blockSelect.value = '';
        floorSelect.value = '';
        handleSearchTypeChange();
        loadResidents();
    }
});