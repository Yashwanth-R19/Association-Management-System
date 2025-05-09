document.addEventListener("DOMContentLoaded", () => {
    loadVendors();

    document.getElementById("vendorForm").addEventListener("submit", addVendor);
    document.getElementById("cancelVendorBtn").addEventListener("click", resetForm);
    document.getElementById("searchVendorBtn").addEventListener("click", searchVendor);
    document.getElementById("resetVendorSearchBtn").addEventListener("click", loadVendors);
    document.getElementById("showMinCostBtn").addEventListener("click", showMinCostVendor);
    document.getElementById("addVendorBtn").addEventListener("click", () => {
        document.getElementById("vendorFormPanel").style.display = "block";
    });
});

function loadVendors() {
    fetch("http://localhost:3000/vendors")
        .then(res => res.json())
        .then(displayVendors)
        .catch(console.error);
}

function displayVendors(vendors) {
    const tbody = document.querySelector("#vendorTable tbody");
    tbody.innerHTML = "";

    vendors.forEach(vendor => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${vendor.id}</td>
            <td>${vendor.name}</td>
            <td>${vendor.workDescription}</td>
            <td>${vendor.phone}</td>
            <td>${vendor.email}</td>
            <td>₹${vendor.cost}</td>
            <td>${vendor.startDate} to ${vendor.endDate}</td>
            <td><button class="btn btn-outline btn-sm">Edit</button></td>
        `;
        tbody.appendChild(row);
    });
}

function addVendor(e) {
    e.preventDefault();

    const vendor = {
        id: document.getElementById("vendorId").value.trim(),
        name: document.getElementById("vendorName").value.trim(),
        phone: document.getElementById("vendorPhone").value.trim(),
        email: document.getElementById("vendorEmail").value.trim(),
        workDescription: document.getElementById("vendorWork").value.trim(),
        cost: parseFloat(document.getElementById("vendorCost").value),
        startDate: document.getElementById("vendorStartDate").value,
        endDate: document.getElementById("vendorEndDate").value
    };

    fetch("http://localhost:3000/vendors", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(vendor)
    })
    .then(res => res.json())
    .then(() => {
        resetForm();
        loadVendors();
    })
    .catch(console.error);
}

function resetForm() {
    document.getElementById("vendorForm").reset();
    document.getElementById("vendorFormPanel").style.display = "none";
}

function searchVendor() {
    const query = document.getElementById("vendorSearchInput").value.trim().toLowerCase();

    fetch("http://localhost:3000/vendors")
        .then(res => res.json())
        .then(data => {
            const filtered = data.filter(v =>
                v.id.toString().toLowerCase().includes(query) ||
                v.name.toLowerCase().includes(query)
            );
            displayVendors(filtered);
        })
        .catch(console.error);
}

function showMinCostVendor() {
    fetch("http://localhost:3000/vendors")
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) return;
            const minVendor = data.reduce((min, curr) => curr.cost < min.cost ? curr : min);
            displayVendors([minVendor]);
        })
        .catch(console.error);
}
c