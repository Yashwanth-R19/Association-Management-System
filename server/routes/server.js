const express = require("express");
const app = express();
const fs = require("fs");
const csvParser = require("csv-parser");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const PORT = process.env.PORT || 3000;
const CSV_FILE = "C:\Users\HP\OneDrive\Desktop\Yashwanth\ceebros-gardens\server\data\vendorsds.csv";

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

let vendors = [];

function loadVendors() {
    vendors = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csvParser()) // Default is comma, so just remove the separator option
        .on("data", (data) => {
            vendors.push({
                id: data.id?.trim(),
                name: data.name?.trim(),
                phone: data.phone?.trim(),
                email: data.email?.trim(),                      // FIXED
                workDescription: data.workDescription?.trim(),  // FIXED
                cost: parseFloat(data.cost?.trim()) || 0,
                startDate: data.startDate?.trim(),              // FIXED
                endDate: data.endDate?.trim()                   // FIXED
            });
        })
        .on("end", () => {
            console.log("Vendors loaded.");
        });
}

loadVendors();

app.get("/vendors", (req, res) => {
    res.json(vendors);
});

app.post("/vendors", (req, res) => {
    const vendor = req.body;

    if (!vendor) {
        return res.status(400).json({ message: "Vendor data missing" });
    }

    vendors.push(vendor);

const csvLine = `${vendor.id},${vendor.name},${vendor.phone},${vendor.email},${vendor.workDescription},${vendor.cost},${vendor.startDate},${vendor.endDate}\n`;

    fs.appendFile(CSV_FILE, csvLine, (err) => {
        if (err) {
            console.error("Error writing to CSV:", err);
            return res.status(500).json({ message: "Error writing to CSV" });
        }

        res.status(201).json({ message: "Vendor added" });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
