# Devin Triage Webhook - Reference Implementation

This is a reference implementation of the webhook endpoint that receives alerts and creates Devin sessions.

## Structure

```
demo-ui/
├── src/
│   └── app/
│       └── api/
│           └── trigger-devin/
│               └── route.ts    ← The webhook endpoint
├── .env.example                ← Environment variables template
└── package.json
```

## The Webhook Endpoint

The core logic is in `src/app/api/trigger-devin/route.ts`:

1. Receives alert payload from Azure Monitor or Elastic
2. Extracts alert details (name, severity, description, logs)
3. Calls Devin API to create a triage session
4. Returns the session URL

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
DEVIN_API_KEY=your_devin_api_key
TARGET_REPO=https://github.com/your-org/your-repo
```

## Local Development

```bash
npm install
npm run dev
```

The endpoint will be available at `http://localhost:3000/api/trigger-devin`

## Deployment

Deploy to Azure Functions — See [Deployment Guide](../docs/DEPLOYMENT.md)

## Testing

```bash
curl -X POST http://localhost:3000/api/trigger-devin \
  -H "Content-Type: application/json" \
  -d '{
    "alertName": "test-alert",
    "severity": 1,
    "description": "Test alert",
    "logs": "Error: Test error"
  }'
```
