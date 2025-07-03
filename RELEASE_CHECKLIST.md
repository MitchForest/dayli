# Desktop Release Checklist

## Pre-Release
- [ ] Test the app locally on macOS
- [ ] Verify Google OAuth works in production
- [ ] Update version in `apps/desktop/src-tauri/tauri.conf.json`
- [ ] Update version in `apps/desktop/package.json`
- [ ] Write release notes using RELEASE_TEMPLATE.md

## Release Process
1. Commit all changes
   ```bash
   git add .
   git commit -m "chore: prepare release v0.1.0"
   git push origin main
   ```

2. Create and push tag
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. Monitor GitHub Actions
   - Go to Actions tab
   - Watch "Desktop Release" workflow
   - Should take ~10-15 minutes

4. Verify Release
   - Check https://github.com/MitchForest/dayli/releases
   - Download and test the DMG file
   - Verify the landing page download button works

## Post-Release
- [ ] Test download from production website
- [ ] Announce release (if applicable)
- [ ] Start planning next release

## Troubleshooting
- If build fails: Check GitHub Actions logs
- If notarization fails: May need Apple Developer account
- If download fails: Check GitHub release asset URLs 