# TELEC Smart Sales Manager Online

Stack: GitHub + Vercel + Supabase.

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Create the first user in Authentication.
4. Run the final commented SQL statement after replacing `USER_EMAIL` to make that user Admin.
5. Create sales users in Authentication and update their names in `profiles`.
6. Copy `.env.example` to `.env` and add Supabase URL and anon key.
7. Run `npm install` then `npm run dev`.
8. Upload to GitHub and import the repository into Vercel.
9. Add the same two environment variables in Vercel and deploy.

## Access
Sales users receive only their own data. Admin receives all users' data. Supabase Row Level Security enforces this at database level.

## Features
Login, admin/sales roles, add/edit/delete sales, custom probability 0-100, admin user filter, PDF export, online database.
