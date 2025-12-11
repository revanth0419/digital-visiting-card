# Supabase Auth/Storage still in use

Auth usage detected in:
- `src/pages/Search.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Auth.tsx`
- `src/components/dashboard/NotificationsDropdown.tsx`

Storage usage detected in:
- `src/lib/storage.ts`
- `src/components/dashboard/ProfileEditor.tsx`
- `src/components/dashboard/MediaManager.tsx`

Next steps (manual):
- Decide whether to keep Supabase Auth/Storage or migrate to another provider (Clerk, Auth0, Firebase, or self-hosted).
- If migrating, map current auth/session calls and storage buckets (`avatars`, `media`) to the new service.
- Replace realtime channels in `src/pages/Profile.tsx` if you move away from Supabase realtime (consider `pg_notify` or webhooks).



