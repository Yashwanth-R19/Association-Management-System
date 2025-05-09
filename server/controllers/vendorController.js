const { exec } = require('child_process');
const path = require('path');

exports.addVendor = (req, res) => {
    const { id, name, phone, email, workDescription, cost, startDate, endDate } = req.body;
    const vendorProgram = path.join(__dirname, '../../Backend/vendor.exe');

    exec(`"${vendorProgram}" add ${id} "${name}" "${phone}" "${email}" "${workDescription}" ${cost} "${startDate}" "${endDate}"`, 
        (error, stdout, stderr) => {
            if (error || stderr) {
                return res.status(400).send(stderr || stdout || "Failed to add vendor");
            }
            res.send(stdout.trim());
        }
    );
};

exports.getAllVendors = (req, res) => {
    const vendorProgram = path.join(__dirname, '../../Backend/vendor.exe');

    exec(`"${vendorProgram}" list`, (error, stdout, stderr) => {
        if (error || stderr) {
            return res.status(500).send(stderr || "Failed to fetch vendors");
        }

        const vendors = stdout.split(';')
            .filter(line => line.trim() !== '')
            .map(line => {
                const [id, name, phone, email, work, cost, start, end] = line.split(',');
                return {
                    id: parseInt(id),
                    name,
                    phone,
                    email,
                    workDescription: work,
                    cost: parseFloat(cost),
                    startDate: start,
                    endDate: end
                };
            });

        res.send(vendors);
    });
};

exports.deleteVendor = (req, res) => {
    const id = req.params.id;
    const vendorProgram = path.join(__dirname, '../../Backend/vendor.exe');

    exec(`"${vendorProgram}" delete ${id}`, (error, stdout, stderr) => {
        if (error || stderr) {
            return res.status(400).send(stderr || stdout || "Failed to delete vendor");
        }
        res.send(stdout.trim());
    });
};

exports.getMinCostVendor = (req, res) => {
    const vendorProgram = path.join(__dirname, '../../Backend/vendor.exe');
    
    exec(`"${vendorProgram}" list`, (error, stdout, stderr) => {
        if (error || stderr) {
            return res.status(500).send(stderr || "Failed to fetch vendors");
        }

        const vendors = stdout.split(';')
            .filter(line => line.trim() !== '')
            .map(line => {
                const [id, name, phone, email, work, cost, start, end] = line.split(',');
                return {
                    id: parseInt(id),
                    name,
                    phone,
                    email,
                    workDescription: work,
                    cost: parseFloat(cost),
                    startDate: start,
                    endDate: end
                };
            });

        if (vendors.length === 0) {
            return res.status(404).send("No vendors found");
        }

        const minCostVendor = vendors.reduce((min, vendor) => 
            vendor.cost < min.cost ? vendor : min, vendors[0]);
        
        res.send(minCostVendor);
    });
};

exports.searchVendors = (req, res) => {
    const { type, query } = req.query;
    const vendorProgram = path.join(__dirname, '../../Backend/vendor.exe');

    exec(`"${vendorProgram}" list`, (error, stdout, stderr) => {
        if (error || stderr) {
            return res.status(500).send(stderr || "Failed to fetch vendors");
        }

        const vendors = stdout.split(';')
            .filter(line => line.trim() !== '')
            .map(line => {
                const [id, name, phone, email, work, cost, start, end] = line.split(',');
                return {
                    id: parseInt(id),
                    name,
                    phone,
                    email,
                    workDescription: work,
                    cost: parseFloat(cost),
                    startDate: start,
                    endDate: end
                };
            });

        let results;
        if (type === 'name') {
            results = vendors.filter(v => 
                v.name.toLowerCase().includes(query.toLowerCase()));
        } else {
            results = vendors.filter(v => v.id === parseInt(query));
        }

        res.send(results);
    });
};