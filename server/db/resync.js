// After a DS-engine call returns its full updated `state`, this reconciles
// that state back into Postgres: upsert every row by its natural key, then
// delete anything no longer present. Deliberately NOT delete-then-reinsert —
// that would cascade-delete any FK-dependent rows (e.g. maintenance_dues)
// and reassign ids on every single request, which a natural-key upsert avoids.
async function resyncTable(client, { table, naturalKey, columns, rows }) {
    if (!rows || rows.length === 0) {
        await client.query(`DELETE FROM ${table}`);
        return;
    }

    for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updates = columns.filter(c => c !== naturalKey).map(c => `${c} = EXCLUDED.${c}`).join(', ');
        await client.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
             ON CONFLICT (${naturalKey}) DO UPDATE SET ${updates}`,
            values
        );
    }

    const keys = rows.map(r => String(r[naturalKey]));
    await client.query(`DELETE FROM ${table} WHERE ${naturalKey}::text <> ALL($1::text[])`, [keys]);
}

module.exports = { resyncTable };
