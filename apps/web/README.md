# Dayli Web App

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the `apps/web` directory with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings:
- Go to https://supabase.com/dashboard
- Select your project
- Go to Settings → API
- Copy the Project URL and anon public key

### 2. Supabase Configuration

#### Enable Google OAuth:
1. Go to your Supabase dashboard
2. Navigate to Authentication → Providers
3. Enable Google provider
4. Add your Google OAuth credentials (from Google Cloud Console)
5. Save the configuration

#### Configure Redirect URLs:
1. In Supabase, go to Authentication → URL Configuration
2. Set Site URL to: `http://localhost:3000`
3. Add to Redirect URLs: `http://localhost:3000/auth/callback`

### 3. Running the App

```bash
# Install dependencies
bun install

# Run the development server
bun dev
```

The app will be available at http://localhost:3000

## Troubleshooting

### Authentication Error
If you see "Authentication failed" error:
1. Check that your `.env.local` file exists and has the correct values
2. Verify Google OAuth is enabled in Supabase
3. Ensure redirect URLs are configured correctly
4. Check the browser console for more detailed error messages

### Session Issues
If you're being redirected back to login:
1. Clear your browser cookies for localhost
2. Check that the Supabase URL and anon key are correct
3. Ensure your Supabase project is not paused 