# Sprint: Deploy Dayli App (Simplified)

**Sprint Goal**: Set up automated deployment for web and desktop versions  
**Duration**: 1 day  
**Status**: PLANNED  
**Start Date**: TBD

## Overview

Simple, automated deployment strategy:
- **Web**: Push to `main` → Auto-deploy to Vercel
- **Desktop**: Push tag → Auto-build and release via GitHub Actions
- **No manual steps** after initial setup

## Success Criteria

- [ ] Web auto-deploys when pushing to main branch
- [ ] Desktop auto-builds when pushing version tags
- [ ] Both versions connect to production Supabase
- [ ] Download page shows latest releases

## Task Breakdown

### Morning: Web Deployment Setup (30 minutes)

#### Task 1: Vercel Setup
- [ ] Sign up for Vercel (use GitHub login)
- [ ] Click "Add New Project" → Import your GitHub repo
- [ ] Configure project:
  - Framework Preset: `Next.js`
  - Root Directory: `apps/web`
  - Build Command: `cd ../.. && bun install && cd apps/web && bun run build`
  - Output Directory: `.next`
  - Install Command: `bun install`
- [ ] Add environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=your-value
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-value
  SUPABASE_SERVICE_ROLE_KEY=your-value
  OPENAI_API_KEY=your-value
  GOOGLE_CLIENT_ID=your-value
  GOOGLE_CLIENT_SECRET=your-value
  ```
- [ ] Deploy and verify it works
- [ ] Note your deployment URL: `https://dayli-[username].vercel.app`

### Morning: Desktop Build Automation (1 hour)

#### Task 2: GitHub Actions Setup

Create `.github/workflows/desktop-release.yml`:

```yaml
name: Desktop Release

on:
  push:
    tags:
      - 'v*'

jobs:
  create-release:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    outputs:
      release_id: ${{ steps.create-release.outputs.id }}
    steps:
      - uses: actions/checkout@v4
      - name: Create Release
        id: create-release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false

  build-tauri:
    needs: create-release
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, ubuntu-22.04, windows-latest]

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev \
            libayatana-appindicator3-dev librsvg2-dev
            
      - name: Install Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install frontend dependencies
        run: bun install
        
      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          releaseId: ${{ needs.create-release.outputs.release_id }}
          projectPath: apps/desktop
```

#### Task 3: Configure Desktop for Production

Update `apps/desktop/src-tauri/tauri.conf.json`:
- [ ] Remove/comment out all `updater` configuration
- [ ] Update version to match your release tag
- [ ] Ensure `identifier` is set to something unique like `com.yourusername.dayli`

Create `apps/web/lib/config.ts`:
```typescript
// Simple production URL configuration
export function getApiUrl() {
  // Always use production in desktop app
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return 'https://dayli-[username].vercel.app';
  }
  // Use relative URLs for web
  return '';
}
```

### Afternoon: Download Page & Testing (1 hour)

#### Task 4: Create Simple Download Page

Create `apps/web/app/download/page.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Release {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export default function DownloadPage() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest release from GitHub
    fetch('https://api.github.com/repos/YOUR_USERNAME/dayli/releases/latest')
      .then(res => res.json())
      .then(data => {
        setRelease(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getAssetForPlatform = (platform: string) => {
    if (!release) return null;
    return release.assets.find(asset => {
      if (platform === 'mac' && asset.name.endsWith('.dmg')) return true;
      if (platform === 'windows' && asset.name.endsWith('.exe')) return true;
      if (platform === 'linux' && asset.name.endsWith('.AppImage')) return true;
      return false;
    });
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link href="/" className="text-blue-600 hover:underline mb-8 inline-block">
        ← Back to home
      </Link>
      
      <h1 className="text-4xl font-bold mb-8">Download Dayli Desktop</h1>
      
      {loading ? (
        <p>Loading latest release...</p>
      ) : release ? (
        <div className="space-y-6">
          <p className="text-gray-600">Version {release.tag_name}</p>
          
          <div className="grid gap-4 md:grid-cols-3">
            {/* macOS */}
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">🍎 macOS</h3>
              {getAssetForPlatform('mac') ? (
                <a
                  href={getAssetForPlatform('mac')!.browser_download_url}
                  className="text-blue-600 hover:underline"
                >
                  Download .dmg
                </a>
              ) : (
                <p className="text-gray-500">Not available</p>
              )}
            </div>
            
            {/* Windows */}
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">🪟 Windows</h3>
              {getAssetForPlatform('windows') ? (
                <a
                  href={getAssetForPlatform('windows')!.browser_download_url}
                  className="text-blue-600 hover:underline"
                >
                  Download .exe
                </a>
              ) : (
                <p className="text-gray-500">Not available</p>
              )}
            </div>
            
            {/* Linux */}
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">🐧 Linux</h3>
              {getAssetForPlatform('linux') ? (
                <a
                  href={getAssetForPlatform('linux')!.browser_download_url}
                  className="text-blue-600 hover:underline"
                >
                  Download AppImage
                </a>
              ) : (
                <p className="text-gray-500">Not available</p>
              )}
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> First launch may require security approval on macOS/Windows.
            </p>
          </div>
        </div>
      ) : (
        <p>No releases available yet.</p>
      )}
      
      <div className="mt-12 pt-8 border-t">
        <Link 
          href="/focus" 
          className="text-blue-600 hover:underline"
        >
          Or use the web version →
        </Link>
      </div>
    </div>
  );
}
```

#### Task 5: Update Landing Page

Update `apps/web/app/page.tsx` to add download button:
```typescript
// Add to your existing landing page
<div className="flex gap-4 justify-center">
  <Link
    href="/focus"
    className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    Try Web App
  </Link>
  <Link
    href="/download"
    className="px-8 py-4 border border-gray-300 rounded-lg hover:bg-gray-50"
  >
    Download Desktop
  </Link>
</div>
```

### Final Steps: Testing & Release

#### Task 6: Test Everything
- [ ] Push a commit to main → Verify Vercel auto-deploys
- [ ] Create and push a tag:
  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```
- [ ] Wait for GitHub Actions to complete (~15-20 minutes)
- [ ] Check GitHub Releases page for built apps
- [ ] Test download links on your download page
- [ ] Verify desktop app connects to production

## How to Deploy Updates

### Web Updates (Automatic)
```bash
# Any push to main auto-deploys
git add .
git commit -m "Update feature X"
git push origin main
# Wait 2-3 minutes → Live on Vercel
```

### Desktop Updates (Semi-Automatic)
```bash
# Update version in tauri.conf.json first
git add .
git commit -m "Release v0.2.0"
git push origin main

# Create and push tag to trigger builds
git tag v0.2.0
git push origin v0.2.0
# Wait 15-20 minutes → New release on GitHub
```

## Troubleshooting

### Vercel Build Fails
- Check build logs in Vercel dashboard
- Common issue: Wrong root directory or build command
- Solution: Ensure root directory is set to `apps/web`

### GitHub Actions Fails
- Check Actions tab in GitHub for error logs
- Common issue: Missing dependencies for Linux
- Solution: Already included in workflow above

### Desktop App Can't Connect
- Make sure production URL is correct in config
- Check CORS settings in Next.js config
- Verify Supabase URL is accessible

## What You'll Have

After this sprint:
1. **Web App**: `https://dayli-[username].vercel.app` (auto-updates on push)
2. **Desktop Downloads**: `https://github.com/[username]/dayli/releases`
3. **Download Page**: `https://dayli-[username].vercel.app/download`

Both versions using the same:
- Supabase backend
- Google OAuth
- User accounts and data

---

**That's it!** 🚀 

No complex configurations, no manual deployments. Just push code and everything updates automatically. 