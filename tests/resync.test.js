const { resyncTable } = require('../server/db/resync');

function mockClient() {
    const calls = [];
    return {
        calls,
        query: jest.fn((sql, params) => {
            calls.push({ sql, params });
            return Promise.resolve({ rows: [] });
        })
    };
}

describe('resyncTable', () => {
    test('upserts each row by natural key, then deletes rows missing from state', async () => {
        const client = mockClient();
        await resyncTable(client, {
            table: 'residents',
            naturalKey: 'door_number',
            columns: ['name', 'door_number', 'contact'],
            rows: [
                { name: 'Mohan', door_number: 'DAFFODIL-2-A', contact: '123' },
                { name: 'Yash', door_number: 'ORCHID-3-C', contact: '456' }
            ]
        });

        // Two upserts + one prune delete.
        expect(client.query).toHaveBeenCalledTimes(3);
        expect(client.calls[0].sql).toMatch(/INSERT INTO residents/);
        expect(client.calls[0].sql).toMatch(/ON CONFLICT \(door_number\) DO UPDATE/);
        expect(client.calls[2].sql).toMatch(/DELETE FROM residents WHERE door_number::text <> ALL/);
        expect(client.calls[2].params[0]).toEqual(['DAFFODIL-2-A', 'ORCHID-3-C']);
    });

    test('deletes everything when state is empty', async () => {
        const client = mockClient();
        await resyncTable(client, { table: 'residents', naturalKey: 'door_number', columns: ['name'], rows: [] });
        expect(client.query).toHaveBeenCalledTimes(1);
        expect(client.calls[0].sql).toBe('DELETE FROM residents');
    });
});
