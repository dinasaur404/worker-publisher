# Worker Publisher

A Cloudflare Worker that creates and deploys Workers to a Dispatch Namespace via the Cloudflare SDK.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dinasaur404/worker-publisher)

## Setup

When deploying, you'll be prompted for:
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token with Workers:Edit permission

## Development

```bash
npm install
npm run dev
```
