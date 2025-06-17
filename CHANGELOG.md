# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rollup build system for ESM and CJS support
- Individual adapter exports for tree-shaking
- Comprehensive TypeScript definitions
- Enhanced package.json with modern exports field
- Improved README with detailed API documentation
- Build artifacts for all adapters (redis, memory, memcached, none)

### Changed
- Build system migrated from TypeScript compiler to Rollup
- Package now supports both ESM and CommonJS imports
- Updated dependencies to latest versions
- Enhanced project structure for better maintainability

### Fixed
- Module resolution issues with different import styles
- Type definitions now properly exported for all adapters

## [1.0.2-alpha.2] - Previous Release

### Features
- Redis adapter with hash-based storage
- Memory adapter for in-memory caching
- Memcached adapter for distributed caching
- None adapter for testing/development
- Telemetry integration support
- TypeScript-first development
- TTL (Time To Live) support
- Case-sensitive/insensitive key handling

### Dependencies
- ioredis for Redis connectivity
- memcached for Memcached connectivity
- @nuvix/telemetry for monitoring (peer dependency)

---

For the complete list of changes, see the [commit history](https://github.com/nuvix-tech/cache/commits/main).
