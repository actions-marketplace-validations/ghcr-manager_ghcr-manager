# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.4] - 2026-03-27

### Fixed

- Switched release README tag verification from `rg -P` to `grep -P`.

## [0.0.2] - 2026-03-25

### Fixed

- Cleaned up workflow permissions.

## [0.0.1] - 2026-03-25

### Added

- Initial public release of the `action-template` repository template for GitHub Actions.
- Repository scaffolding for release, change-validation, and test-suite workflows.
- Python-based linting setup with `pymarkdownlnt` and `yamllint`.
- A user-facing `README.md` with a pinned action usage example suitable for release validation.

### Changed

- Made the release workflow validate README action references against the current repository owner and name
  instead of a copied hard-coded source repository reference.
