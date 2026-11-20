# Devin Triage Webhook - Reference Implementation

A Next.js 16 app with two parts:

- **Webhook routes** (server): receive alerts or a Slack slash command and create Devin sessions through the Devin v1 API.
- **Demo pages** (browser only): an Azure Monitor / Elastic replica and an incident knowledge base with simulated data. They do not call the routes or Devin.

How the pieces fit together, with a diagram: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Structure

```
demo-ui/
├── src/
│   └── app/
│       ├── page.tsx               ← "/" Azure Monitor + Elastic replicas, Live Demo Mode
│       ├── incidents/
│       │   └── page.tsx           ← "/incidents" incident knowledge base
│       └── api/
│           ├── trigger-devin/
│           │   └── route.ts       ← Alert webhook (POST) + config check (GET)
│           └── slack-triage/
│               └── route.ts       ← Slack /triage slash command (POST)
├── .env.example                   ← Environment variables template
└── package.json
```

## The Webhook Endpoint

`src/app/api/trigger-devin/route.ts`:

1. Receives a flat JSON alert payload (`alertName`, `severity`, `description`, `logs`, `affectedResource`, `file`, `line`, ...). It does not parse the Azure Monitor common alert schema, so map Azure/Elastic payloads to these fields.
2. Builds a 7-phase triage prompt naming `TARGET_REPO`, `JIRA_PROJECT` and `SLACK_CHANNEL`.
3. Calls `POST https://api.devin.ai/v1/sessions` to create the session.
4. Posts to `SLACK_WEBHOOK_URL` if set.
5. Returns `{ "success": true, "session_id": "...", "url": "..." }`. Errors also return HTTP 200, with `"success": false` and an `error` message.

`GET /api/trigger-devin` returns `{ configured, keyType, targetRepo, jiraProject, slackChannel }` so you can check the configuration without sending an alert.

## The Slack Slash Command

`src/app/api/slack-triage/route.ts` handles `/triage <severity> <alert name> | <description>`. It replies to Slack immediately, creates the Devin session in the background (with tags, a title and `DEVIN_PLAYBOOK_ID` if set) and posts the session link to Slack's `response_url`. It does not verify Slack request signatures.

## The Demo Pages

- **`/`**: Azure Monitor and Elastic/Kibana replicas. Fire any of nine canned alerts (Sev 1–3); Sev 1 alerts show a simulated Devin session. **Live Demo Mode** (Azure view) generates alerts on timers (Sev 2/3 every 10–15 s, Sev 1 every 30 s) and stops after 5 minutes.
- **`/incidents`**: eight historical incidents with search and filters, post-mortems, and similar incidents ranked by `findSimilarIncidents()` (alert type, name overlap, resource, log keywords).

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
DEVIN_API_KEY=your_devin_api_key
TARGET_REPO=https://github.com/your-org/your-repo
# Optional: JIRA_PROJECT, SLACK_CHANNEL, SLACK_WEBHOOK_URL, DEVIN_PLAYBOOK_ID
```

Without `DEVIN_API_KEY` the routes answer with a "not configured" response and never call Devin. `WEBHOOK_SECRET` is in the template but not checked by the routes yet.

## Local Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (there is no test script)
```

The endpoints are at `http://localhost:3000/api/trigger-devin` and `http://localhost:3000/api/slack-triage`.

## Deployment

Run it as a Next.js app on any Node host, or port the route to Azure Functions: see the [Deployment Guide](../docs/DEPLOYMENT.md).

## Testing

```bash
curl -X POST http://localhost:3000/api/trigger-devin \
  -H "Content-Type: application/json" \
  -d '{
    "alertName": "test-alert",
    "severity": 1,
    "description": "Test alert",
    "logs": "Error: Test error",
    "file": "src/app.ts",
    "line": 1
  }'
```

Include `file`: the route uses it for the PR title and fails without it once `DEVIN_API_KEY` is set.
