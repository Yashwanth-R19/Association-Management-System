document.addEventListener('DOMContentLoaded', function() {
    const addMemberBtn = document.getElementById('addMemberBtn');
    const memberForm = document.getElementById('memberForm');
    const cancelMemberBtn = document.getElementById('cancelMemberBtn');
    const searchBtn = document.getElementById('searchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    const memberFormActual = document.getElementById('associationMemberForm');
    const memberTable = document.getElementById('memberTable');
    const memberDetailsModal = document.getElementById('memberDetailsModal');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const deleteMemberBtn = document.getElementById('deleteMemberBtn');
    
    let currentMemberId = null;
    let members = [];
    
    // Initialize the table
    loadMembers();
    
    // Show member form
    addMemberBtn.addEventListener('click', function() {
        memberForm.style.display = 'block';
        currentMemberId = null;
        memberFormActual.reset();
    });
    
    // Hide member form
    cancelMemberBtn.addEventListener('click', function() {
        memberForm.style.display = 'none';
        memberFormActual.reset();
    });
    
    // Handle form submission
    memberFormActual.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const memberData = {
            name: document.getElementById('memberName').value,
            role: document.getElementById('memberRole').value,
            email: document.getElementById('memberEmail').value,
            phone: document.getElementById('memberPhone').value,
            houseNumber: document.getElementById('memberHouseNumber').value
        };
        
        try {
            const response = await fetch('/api/association', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(memberData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save member');
            }
            
            const result = await response.json();
            if (result.status === 'error') {
                throw new Error(result.message);
            }
            
            await loadMembers();
            memberForm.style.display = 'none';
            memberFormActual.reset();
        } catch (error) {
            console.error('Error:', error);
            showToast('Error: ' + error.message, 'error');
        }
    });

    // Search functionality
    searchBtn.addEventListener('click', async function() {
        const searchType = document.getElementById('searchType').value;
        const keyword = document.getElementById('searchKeyword').value.trim();
        
        if (!keyword) {
            await loadMembers();
            return;
        }
        
        try {
            const response = await fetch(`/api/association/search/${searchType}/${encodeURIComponent(keyword)}`);
            if (!response.ok) {
                throw new Error('Search failed');
            }
            
            const result = await response.json();
            const filtered = Array.isArray(result) ? result : (result.data || []);
            renderMembers(filtered);
        } catch (error) {
            console.error('Search error:', error);
            showToast('Search failed: ' + error.message, 'error');
        }
    });
    
    // Reset search
    resetSearchBtn.addEventListener('click', async function() {
        document.getElementById('searchKeyword').value = '';
        await loadMembers();
    });
    
    // Close modal
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            memberDetailsModal.style.display = 'none';
        });
    });
    
    // Delete member
    deleteMemberBtn.addEventListener('click', async function() {
        if (currentMemberId && await confirmDialog('Are you sure you want to delete this member?')) {
            try {
                const response = await fetch(`/api/association/${currentMemberId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to delete member');
                }
                
                const result = await response.json();
                if (result.status === 'error') {
                    throw new Error(result.message);
                }
                
                await loadMembers();
                memberDetailsModal.style.display = 'none';
            } catch (error) {
                console.error('Error:', error);
                showToast('Error: ' + error.message, 'error');
            }
        }
    });
    
    // Load members from backend
    async function loadMembers() {
        try {
            const response = await fetch('/api/association');
            if (!response.ok) {
                throw new Error('Failed to load members');
            }
            
            const result = await response.json();
            members = Array.isArray(result) ? result : (result.data || []);
            renderMembers(members);
        } catch (error) {
            console.error('Error loading members:', error);
            showToast('Failed to load members: ' + error.message, 'error');
        }
    }
    
    // Render members to the table
    function renderMembers(membersToRender) {
        memberTable.innerHTML = membersToRender.map(member => `
            <tr data-id="${member.id}">
                <td>${member.id}</td>
                <td>${member.name}</td>
                <td>${member.role}</td>
                <td>${member.email}</td>
                <td>${member.phone}</td>
                <td>${member.houseNumber}</td>
                <td>
                    <button class="btn btn-sm btn-primary view-details">View</button>
                    <button class="btn btn-sm btn-danger delete-member">Delete</button>
                </td>
            </tr>
        `).join('');
        
        // Add event listeners to the new buttons
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', function() {
                const memberId = parseInt(this.closest('tr').getAttribute('data-id'));
                showMemberDetails(memberId);
            });
        });
        
        document.querySelectorAll('.delete-member').forEach(btn => {
            btn.addEventListener('click', async function() {
                const memberId = parseInt(this.closest('tr').getAttribute('data-id'));
                if (await confirmDialog(`Are you sure you want to delete member #${memberId}?`)) {
                    try {
                        const response = await fetch(`/api/association/${memberId}`, {
                            method: 'DELETE'
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Failed to delete member');
                        }
                        
                        const result = await response.json();
                        if (result.status === 'error') {
                            throw new Error(result.message);
                        }
                        
                        await loadMembers();
                    } catch (error) {
                        console.error('Error:', error);
                        showToast('Error: ' + error.message, 'error');
                    }
                }
            });
        });
    }
    
    // Show member details in modal
    function showMemberDetails(memberId) {
        const member = members.find(m => m.id === memberId);
        if (!member) return;
        
        currentMemberId = memberId;
        
        document.getElementById('modalMemberName').textContent = member.name;
        document.getElementById('modalMemberId').textContent = member.id;
        document.getElementById('modalMemberRole').textContent = member.role;
        document.getElementById('modalMemberHouse').textContent = member.houseNumber;
        document.getElementById('modalMemberEmail').textContent = member.email;
        document.getElementById('modalMemberPhone').textContent = member.phone;
        
        memberDetailsModal.style.display = 'block';
    }
});