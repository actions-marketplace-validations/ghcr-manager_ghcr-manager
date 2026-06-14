# GHCR Cleanup Manager Wrapper

[![GitHub Marketplace](https://img.shields.io/badge/marketplace-ghcr--manager-blue?logo=github&labelColor=333&style=flat-square)](https://github.com/marketplace/actions/ghcr-manager)
[![Release](https://img.shields.io/github/v/release/ghcr-manager/ghcr-manager?style=flat-square)](https://github.com/ghcr-manager/ghcr-manager/releases)
[![Immutable Releases](https://img.shields.io/badge/releases-immutable-blue?labelColor=333)](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases)

This repository is only a compatibility wrapper for a renamed action.

- Do not start using this repo for new workflows.
- Migrate existing workflows.

Use this action instead:

- `ghcr-manager/ghcr-cleanup-manager`
- [Marketplace](https://github.com/marketplace/actions/ghcr-cleanup-manager)
- [Repository](https://github.com/ghcr-manager/ghcr-cleanup-manager)

## Why this repo still exists

[GitHub will not redirect calls to an action hosted by a renamed repository.](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

This wrapper exists so workflows using `ghcr-manager/ghcr-manager` keep working and can still receive version updates
through tools like Dependabot.

The wrapper action only:

- emits a GitHub Actions warning telling users to migrate
- forwards all action inputs to `ghcr-manager/ghcr-cleanup-manager`
- republishes matching wrapper releases for `ghcr-manager/ghcr-cleanup-manager` releases

## Migration

Change your workflow from:

```yaml
- uses: ghcr-manager/ghcr-manager@v1
```

to:

```yaml
- uses: ghcr-manager/ghcr-cleanup-manager@v1
```

The wrapper exposes the same inputs as the new action.

## Notes

- This wrapper is intentionally minimal.
- New documentation and ongoing development live in `ghcr-manager/ghcr-cleanup-manager`.
- The old repo may be retired after a transition period.
