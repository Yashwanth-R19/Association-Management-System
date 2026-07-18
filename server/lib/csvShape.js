// Shared helpers for building the CSV payloads fed to the C compute engines
// on stdin. The C-side parsers are simple strtok-on-comma readers (this is a
// small student project, not a full RFC4180 implementation) so field values
// are sanitized rather than escaped: commas/quotes/newlines are stripped
// before a value ever reaches the engine boundary.
function sanitizeField(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[",\r\n]/g, '');
}

// Wraps a sanitized string field in quotes (matches what every Backend/*.c
// stdin parser expects); numbers are passed bare.
function quoted(value) {
    return `"${sanitizeField(value)}"`;
}

function csvRow(fields) {
    return fields.join(',');
}

module.exports = { sanitizeField, quoted, csvRow };
