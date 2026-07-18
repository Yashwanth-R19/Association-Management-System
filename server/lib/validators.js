// Shared server-side validation — the "fixed rules" every module's controller
// applies before a row ever reaches Postgres or a C engine. This restores the
// checks the original Backend/vendorsds.c had in its interactive CLI
// (isValidName/isValidPhone/isValidEmail/isValidCost/isValidDate) and adds the
// equivalent for every other module, so bad data can no longer enter through
// the API even though the browser-side forms also happen to check most of
// this. Defense in depth: client checks are for UX, these are the real gate.

const BLOCKS = ['MAYFLOWER', 'TULIP', 'PRIMROSE', 'DAFFODIL', 'ORCHID'];
const OWNERSHIP_STATUSES = ['OWNER', 'TENANT'];
const ASSOCIATION_ROLES = ['Resident', 'Committee Member', 'President', 'Secretary', 'Treasurer'];
const FACILITIES = ['gym', 'pool', 'clubhouse', 'playground'];
const COMPLAINT_PRIORITIES = ['low', 'normal', 'high'];

function isValidName(value) {
    return typeof value === 'string' && /^[A-Za-z\s]{1,49}$/.test(value.trim());
}

function isValidPhone(value) {
    return typeof value === 'string' && /^\d{10}$/.test(value.trim());
}

function isValidEmail(value) {
    if (typeof value !== 'string' || /\s/.test(value)) return false;
    const at = value.indexOf('@');
    return at > 0 && value.indexOf('.', at) > at + 1;
}

function isValidCost(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
}

// MM/YY, e.g. "03/25" — the original vendor contract-window shape.
function isValidMonthYear(value) {
    return typeof value === 'string' && /^(0[1-9]|1[0-2])\/\d{2}$/.test(value.trim());
}

function isValidDoorAlpha(value) {
    return typeof value === 'string' && /^[A-Za-z]$/.test(value.trim());
}

// Matches the existing client-side range (Frontend/js/residents.js).
function isValidFloor(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 7;
}

function isBlock(value) {
    return typeof value === 'string' && BLOCKS.includes(value.trim().toUpperCase());
}

function normalizeBlock(value) {
    return value.trim().toUpperCase();
}

function isOwnershipStatus(value) {
    return typeof value === 'string' && OWNERSHIP_STATUSES.includes(value.trim().toUpperCase());
}

function normalizeOwnershipStatus(value) {
    return value.trim().toUpperCase();
}

function isAssociationRole(value) {
    return ASSOCIATION_ROLES.includes(value);
}

function isFacility(value) {
    return FACILITIES.includes(value);
}

function isComplaintPriority(value) {
    return COMPLAINT_PRIORITIES.includes(value);
}

// YYYY-MM
function isValidPeriod(value) {
    return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());
}

// YYYY-MM-DD, and must actually be a real calendar date.
function isValidIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// HH:MM, 24-hour.
function isValidTime(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
    BLOCKS,
    OWNERSHIP_STATUSES,
    ASSOCIATION_ROLES,
    FACILITIES,
    COMPLAINT_PRIORITIES,
    isValidName,
    isValidPhone,
    isValidEmail,
    isValidCost,
    isValidMonthYear,
    isValidDoorAlpha,
    isValidFloor,
    isBlock,
    normalizeBlock,
    isOwnershipStatus,
    normalizeOwnershipStatus,
    isAssociationRole,
    isFacility,
    isComplaintPriority,
    isValidPeriod,
    isValidIsoDate,
    isValidTime,
    isNonEmptyString
};
