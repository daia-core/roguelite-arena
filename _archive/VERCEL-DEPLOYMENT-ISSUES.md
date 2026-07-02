## Vercel Deployment Issues - 2026-07-02

### Problem
Struggling to deploy consistently via CLI. Token authentication issues.

### Attempted Solutions
1. `--token` flag - fails with 'missing value' error
2. `VERCEL_TOKEN` env var - hangs on auth prompt
3. Direct CLI from frontend/ - in progress

### Root Cause
Vercel CLI not respecting token environment variable consistently.

### Action Items
- Review Vercel MCP deployment capabilities
- Consider GitHub auto-deploy integration
- Document working deployment command
