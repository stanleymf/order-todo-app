# Changelog

## [1.0.0] - 2025-06-20
### Added
- Migrated backend from SQLite to Cloudflare D1 for true cloud-native, multi-tenant, multi-user support.
- Implemented D1 schema for tenants, users, orders, products, and Shopify stores.
- Refactored Worker entrypoint to use D1 and new async database service.
- Added API routes for tenant and user management, all powered by D1.
- Verified D1 connection and CRUD operations via local Worker dev server.
- Fixed API route order for correct user listing.
- Updated wrangler config for D1 and removed legacy assets config.
- Set up JWT secrets in Cloudflare environment.
- Committed all foundational work to GitHub.

### Changed
- Backend architecture from local SQLite to cloud-native D1.
- API structure to support multi-tenant isolation.
- Deployment strategy to use Cloudflare Workers and D1.

### Technical
- Database: SQLite → Cloudflare D1
- Backend: Node.js → Cloudflare Workers
- Storage: Local file → Cloud D1
- Authentication: Local → JWT with Cloudflare secrets 