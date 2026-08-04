# TELEC Smart Sales Manager Online Final

This version is rebuilt from the actual desktop source and includes:

- Dashboard
- Separate Sales Pipeline screen
- Separate Add/Edit Opportunity screen
- Automatic GST, Including GST, WHT, Net Total, GP and Ageing
- Custom probability 0–100
- Add, edit and delete
- User-wise privacy through Supabase RLS
- Admin user management and activation/deactivation
- Admin team reports
- PDF and Excel exports
- GST/WHT settings
- Search, salesperson, probability and status filters

## Existing project upgrade

1. Run `supabase/FINAL_UPGRADE.sql` in Supabase SQL Editor (safe to run after V2).
2. Replace all files in the current GitHub repository with this package.
3. Keep these Vercel variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Vercel deploys automatically.

The desktop Google Sheet backend is not used by this online version.
