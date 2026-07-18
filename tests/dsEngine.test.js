const fs = require('fs');
const path = require('path');
const { runEngine } = require('../server/lib/dsEngine');

const RESIDENTS_EXE = path.join(
    __dirname, '../server/c-executables',
    process.platform === 'win32' ? 'residents.exe' : 'residents'
);

const describeIfBuilt = fs.existsSync(RESIDENTS_EXE) ? describe : describe.skip;

describeIfBuilt('dsEngine (against the real compiled residents engine)', () => {
    const seedCsv = [
        '"mohan","DAFFODIL-2-A","7550164553","OWNER","2","DAFFODIL",2',
        '"Yashwanth R","ORCHID-3-C","8939626136","TENANT","3","ORCHID",3'
    ].join('\n');

    test('list returns {result, state} with the fed-in rows', async () => {
        const { result, state } = await runEngine('residents', ['list'], seedCsv);
        expect(result).toHaveLength(2);
        expect(state).toHaveLength(2);
        expect(result.map(r => r.door_number).sort()).toEqual(['DAFFODIL-2-A', 'ORCHID-3-C']);
    });

    test('add rejects a duplicate door number', async () => {
        const { result } = await runEngine(
            'residents',
            ['add', 'Someone Else', 'DAFFODIL', '2', 'A', '9000000000', 'TENANT', 'NONE'],
            seedCsv
        );
        expect(result.status).toBe('error');
        expect(result.message).toMatch(/already exists/i);
    });

    test('add succeeds for a new door number and state reflects it', async () => {
        const { result, state } = await runEngine(
            'residents',
            ['add', 'New Person', 'TULIP', '1', 'Z', '9000000000', 'OWNER', 'NONE'],
            seedCsv
        );
        expect(result.status).toBe('success');
        expect(state.some(r => r.door_number === 'TULIP-1-Z')).toBe(true);
    });
});
