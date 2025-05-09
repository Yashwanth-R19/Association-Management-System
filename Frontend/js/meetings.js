document.addEventListener('DOMContentLoaded', function() {
    const addMeetingBtn = document.getElementById('addMeetingBtn');
    const meetingForm = document.getElementById('meetingForm');
    const cancelMeetingBtn = document.getElementById('cancelMeetingBtn');
    const searchBtn = document.getElementById('searchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    const meetingTable = document.getElementById('meetingTable');
    const meetingFormActual = document.getElementById('meetingFormActual');
    const modal = document.getElementById('meetingDetailsModal');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const deleteMeetingBtn = document.getElementById('deleteMeetingBtn');
    
    let meetings = [];
    let currentMeetingId = null;
    
    // Initialize the table
    loadMeetings();
    
    // Show meeting form
    addMeetingBtn.addEventListener('click', function() {
        meetingForm.style.display = 'block';
        currentMeetingId = null;
        meetingFormActual.reset();
    });
    
    // Hide meeting form
    cancelMeetingBtn.addEventListener('click', function() {
        meetingForm.style.display = 'none';
        meetingFormActual.reset();
    });
    
    // Handle form submission
    meetingFormActual.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const meetingData = {
            date: document.getElementById('meetingDate').value,
            time: document.getElementById('meetingTime').value,
            title: document.getElementById('meetingTitle').value,
            agenda: document.getElementById('meetingAgenda').value,
            location: document.getElementById('meetingLocation').value,
            attendees: document.getElementById('attendees').value,
            outcome: document.getElementById('outcome').value || ''
        };
        
        try {
            const method = currentMeetingId ? 'PUT' : 'POST';
            const url = currentMeetingId ? `/api/meetings/${currentMeetingId}` : '/api/meetings';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(meetingData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save meeting');
            }
            
            await loadMeetings();
            meetingForm.style.display = 'none';
            meetingFormActual.reset();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    });
    
    // Search functionality
    searchBtn.addEventListener('click', async function() {
        const searchType = document.getElementById('searchType').value;
        const keyword = document.getElementById('searchKeyword').value.trim();
        
        if (!keyword) {
            await loadMeetings();
            return;
        }
        
        try {
            const response = await fetch(`/api/meetings/search/${searchType}/${encodeURIComponent(keyword)}`);
            if (!response.ok) throw new Error('Search failed');
            
            const filtered = await response.json();
            renderMeetings(filtered);
        } catch (error) {
            console.error('Search error:', error);
            alert('Search failed: ' + error.message);
        }
    });
    
    // Reset search
    resetSearchBtn.addEventListener('click', async function() {
        document.getElementById('searchKeyword').value = '';
        await loadMeetings();
    });
    
    // Close modal
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    });
    
    // Delete meeting
    deleteMeetingBtn.addEventListener('click', async function() {
        if (currentMeetingId && confirm('Are you sure you want to delete this meeting?')) {
            try {
                const response = await fetch(`/api/meetings/${currentMeetingId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to delete meeting');
                }
                
                await loadMeetings();
                modal.style.display = 'none';
            } catch (error) {
                console.error('Error:', error);
                alert('Error: ' + error.message);
            }
        }
    });
    
    // Load meetings from backend
    async function loadMeetings() {
        try {
            const response = await fetch('/api/meetings');
            if (!response.ok) throw new Error('Failed to load meetings');
            
            meetings = await response.json();
            renderMeetings(meetings);
        } catch (error) {
            console.error('Error loading meetings:', error);
            alert('Failed to load meetings: ' + error.message);
        }
    }
    
    // Render meetings to the table
    function renderMeetings(meetingsToRender) {
        meetingTable.innerHTML = meetingsToRender.map(meeting => `
            <tr data-id="${meeting.id}">
                <td>${formatDate(meeting.date)}</td>
                <td>${escapeHtml(meeting.title)}</td>
                <td>${escapeHtml(meeting.location)}</td>
                <td>${escapeHtml(meeting.agenda.substring(0, 50))}${meeting.agenda.length > 50 ? '...' : ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary view-details">View</button>
                    <button class="btn btn-sm btn-danger delete-meeting">Delete</button>
                </td>
            </tr>
        `).join('');
        
        // Add event listeners to the new buttons
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', function() {
                const meetingId = parseInt(this.closest('tr').getAttribute('data-id'));
                showMeetingDetails(meetingId);
            });
        });
        
        document.querySelectorAll('.delete-meeting').forEach(btn => {
            btn.addEventListener('click', async function() {
                const meetingId = parseInt(this.closest('tr').getAttribute('data-id'));
                if (confirm(`Are you sure you want to delete meeting #${meetingId}?`)) {
                    try {
                        const response = await fetch(`/api/meetings/${meetingId}`, {
                            method: 'DELETE'
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Failed to delete meeting');
                        }
                        
                        await loadMeetings();
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Error: ' + error.message);
                    }
                }
            });
        });
    }
    
    // Show meeting details in modal
    function showMeetingDetails(meetingId) {
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) return;
        
        currentMeetingId = meetingId;
        
        document.getElementById('modalMeetingTitle').textContent = escapeHtml(meeting.title);
        document.getElementById('modalMeetingDate').textContent = formatDate(meeting.date);
        document.getElementById('modalMeetingTime').textContent = meeting.time;
        document.getElementById('modalMeetingLocation').textContent = escapeHtml(meeting.location);
        document.getElementById('modalMeetingAgenda').textContent = escapeHtml(meeting.agenda);
        
        // Format attendees (handle both array and comma-separated string)
        let attendees = meeting.attendees;
        if (Array.isArray(attendees)) {
            attendees = attendees.join(', ');
        }
        document.getElementById('modalMeetingAttendees').textContent = escapeHtml(attendees);
        
        document.getElementById('modalMeetingOutcome').textContent = escapeHtml(meeting.outcome || 'N/A');
        
        modal.style.display = 'block';
    }
    
    // Format date for display
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
    
    // Basic HTML escaping for security
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});