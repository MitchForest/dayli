# Database Migrations

This folder contains database migration scripts for the project.

## Migration History

### 001_oauth_integration.sql
- **Purpose**: Creates users table and sets up OAuth integration
- **Changes**:
  - Creates `users` table with OAuth user profile fields
  - Links to Supabase auth.users via `auth_user_id`
  - Automatically creates user records on OAuth sign-in (Google/GitHub)
  - Sets up Row Level Security (RLS) policies
  - Adds indexes for performance
  - Includes fields for username, display_name, avatar_url, and privacy settings

## How Migrations Work

This project uses Supabase's built-in migration system via the MCP tools. Migrations are automatically version-controlled by Supabase when applied.

### Applying New Migrations

1. Create a new SQL file with naming convention: `XXX_description.sql`
2. Use the Supabase MCP tools to apply:
   ```
   mcp_supabase_execute_postgresql(query="...", migration_name="description")
   ```
3. The migration will be automatically tracked by Supabase

### Migration Status

You can check applied migrations in your Supabase dashboard under:
- Database → Migrations
- Or via MCP: `mcp_supabase_retrieve_migrations()` 