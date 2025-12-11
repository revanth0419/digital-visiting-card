# Migration checklist

## API routes to test
- `GET /api/profiles/search?q=<query>` → used by Search page
- `GET /api/profiles/username/:username` → public profile load
- `GET /api/profiles/by-user/:userId` → dashboard/profile editor bootstrap
- `PUT /api/profiles/:userId` → profile updates
- `GET /api/links?profileId=<id>&active=true` → profile and dashboard links
- `POST /api/links` → add link
- `DELETE /api/links/:id` → remove link
- `PUT /api/links/order` → reorder links
- `GET /api/media?profileId=<id>` → media gallery
- `POST /api/media` → add media record after storage upload
- `DELETE /api/media/:id` → remove media
- `GET /api/subscriptions?subscriberId=<id>&subscribedToId=<id>` → subscription status
- `POST /api/subscriptions` / `DELETE /api/subscriptions` → toggle subscription
- `GET /api/notifications?userId=<id>` → dropdown notifications
- `PUT /api/notifications/:id/read` / `PUT /api/notifications/read-all?userId=<id>` → mark read
- `DELETE /api/notifications/:id` → remove notification

## Sample curl commands
- `curl "http://localhost:4000/api/profiles/search?q=test"`
- `curl "http://localhost:4000/api/profiles/username/demo"`
- `curl "http://localhost:4000/api/links?profileId=<PROFILE_ID>&active=true"`
- `curl -X POST "http://localhost:4000/api/links" -H "Content-Type: application/json" -d '{"profile_id":"<PROFILE_ID>","title":"Demo","url":"https://example.com","order_index":0}'`
- `curl -X PUT "http://localhost:4000/api/profiles/<USER_ID>" -H "Content-Type: application/json" -d '{"display_name":"New Name"}'`
- `curl -X POST "http://localhost:4000/api/subscriptions" -H "Content-Type: application/json" -d '{"subscriber_id":"<USER_ID>","subscribed_to_id":"<TARGET_ID>"}'`

## Frontend flows to verify
- Auth flows (login, logout, password reset) – Supabase auth still used.
- Dashboard: profile fetch/update, links CRUD + reorder, media listing.
- Public profile: loads profile, links, media; subscription toggle; QR code.
- Search: search profiles and subscribe/unsubscribe.
- Notifications dropdown: list/mark read/delete.
- Ensure frontend points to API: set `VITE_API_BASE_URL` (e.g., `http://localhost:4000/api`) in your env if different from the default.

## Post-migration validation
- Compare counts for profiles, links, media, subscriptions, notifications between Supabase and PostgreSQL.
- Spot check a few profiles to ensure links/media ordering matches.
- Run `npm run server` then front-end `npm run dev` (or Vite) and verify all pages.
- After schema tweaks run `npx prisma migrate dev --name init` or apply `migrations/001_init.sql`.

