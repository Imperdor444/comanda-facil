# Supabase Setup

Use this folder when creating the secure backend for Sabor de Mae.

## Steps

1. Create a free project at Supabase.
2. Open `SQL Editor`.
3. Paste and run `schema.sql`.
4. In `Authentication > Users`, create the restaurant admin user.
5. Copy the project URL and anon public key.
6. Put those values in `supabase-config.js`.

Do not put the `service_role` key in this repository, in the website, or on a personal computer.

## Admin user

Create the admin user from the Supabase dashboard:

1. Open `Authentication`.
2. Open `Users`.
3. Click `Add user`.
4. Use the restaurant e-mail and a strong password.
5. Leave the password only with the owner/admin. The website only stores the public Supabase key.

## Product images

The admin panel uploads product photos to the public Storage bucket `produtos`.

If the project already existed before this feature, run `schema.sql` again in the SQL Editor. It will create the bucket and policies without deleting products or orders.
