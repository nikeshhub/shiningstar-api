# Migrations

Place production data/schema migrations in this folder.

File names must sort in execution order:

```text
YYYYMMDDHHMMSS-description.js
```

Each migration must export an `up` function:

```js
export async function up({ mongoose, db }) {
  await db.collection("classes").updateMany({}, { $set: { status: "Active" } });
}
```

Run pending migrations with:

```bash
npm run migrate
```

Applied migrations are recorded in the `schema_migrations` collection.
