# TELEC Smart Sales Manager Online V2

This version brings the desktop application's core features to the online system:

- Detailed pipeline columns and automatic calculations
- GST, WHT, Including GST, Net Total, GP and Ageing
- Custom probability from 0 to 100
- High / Medium / Low summaries
- Status and user filters
- Add, edit and delete
- PDF and Excel export
- Admin team reports
- In-application user creation and activation/deactivation
- Admin calculation settings
- Supabase Row Level Security: sales users receive only their own records

## Upgrade existing Supabase project

Run:

`supabase/upgrade_v2.sql`

in Supabase SQL Editor.

## Required Vercel environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service role key is used only by the server-side `/api/create-user` function. Never expose it with a `VITE_` prefix.

## Deploy update

Upload all V2 files to the existing GitHub repository and commit. Vercel will redeploy automatically.