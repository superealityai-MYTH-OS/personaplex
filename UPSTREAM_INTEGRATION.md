# Upstream Integration

This repository is a fork of [NVIDIA/personaplex](https://github.com/NVIDIA/personaplex) and is kept synchronized with the upstream repository.

## Synchronization Status

The fork is currently synchronized with the upstream repository at commit `b62355a` (Merge pull request #18 from tsdocode/fix/init-oom).

## Automated Synchronization

This repository includes a GitHub Actions workflow (`.github/workflows/sync-upstream.yml`) that automatically:
- Runs daily at 00:00 UTC
- Can be manually triggered via GitHub Actions
- Checks for new commits in the upstream repository
- Automatically merges upstream changes into the main branch
- Pushes the synchronized changes to this fork

## Manual Synchronization

To manually sync with upstream, you can:

1. **Using GitHub Actions (Recommended)**:
   - Navigate to the "Actions" tab in this repository
   - Select the "Sync with Upstream" workflow
   - Click "Run workflow"

2. **Using Git commands**:
   ```bash
   # Add upstream remote (if not already added)
   git remote add upstream https://github.com/NVIDIA/personaplex.git
   
   # Fetch upstream changes
   git fetch upstream main
   
   # Merge upstream changes
   git checkout main
   git merge upstream/main
   
   # Push to origin
   git push origin main
   ```

## Remote Configuration

This repository is configured with two remotes:
- `origin`: Points to this fork (superealityai-MYTH-OS/personaplex)
- `upstream`: Points to the upstream repository (NVIDIA/personaplex) - used by the sync workflow

You can verify this with:
```bash
git remote -v
```

## Contributing

When making changes to this fork:
1. Create a new branch from `main`
2. Make your changes
3. Submit a pull request to merge into `main`
4. The automated sync workflow will handle keeping `main` up-to-date with upstream

## License

This project maintains the same license as the upstream NVIDIA repository. See [LICENSE-MIT](LICENSE-MIT) for details.
