# Backup and restore

1) Create a backup of the current Supabase database (replace placeholders):
```
pg_dump --format=custom --dbname "$SUPABASE_DB_URL" --file supabase-backup.dump
```

2) Restore into the new PostgreSQL instance:
```
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" supabase-backup.dump
```

3) If you prefer SQL:
```
pg_dump --schema-only --dbname "$SUPABASE_DB_URL" > supabase-schema.sql
pg_dump --data-only --dbname "$SUPABASE_DB_URL" > supabase-data.sql
psql "$DATABASE_URL" -f supabase-schema.sql
psql "$DATABASE_URL" -f supabase-data.sql
```

4) After restore, run Prisma migrations to align the schema if you adjust `prisma/schema.prisma`:
```
npx prisma migrate dev --name init
```

5) Always verify row counts between Supabase and the new PostgreSQL database before switching traffic.



