# API Reference

This document describes the webhook endpoint that receives alerts and triggers Devin sessions.

## Endpoint

```
POST /api/trigger-devin
```

## Authentication

The endpoint itself does not require authentication (the Devin API key is stored server-side). However, you may want to add authentication for production use.

### Adding Basic Auth

```typescript
// In route.ts
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

## Request Body

### Full Schema

```typescript
interface AlertPayload {
  // Required
  alertName: string;           // Name of the alert rule
  severity: number;            // 0-4 (0=Critical, 4=Verbose)
  description: string;         // Alert description
  
  // Recommended
  affectedResource: string;    // Resource that triggered the alert
  logs: string;                // Error logs or stack traces
  file: string;                // Suspected file with the bug
  line: number;                // Suspected line number
  bugDescription: string;      // Description of the suspected bug
  
  // Optional
  resourceType?: string;       // Type of resource (e.g., "AKS Cluster")
  signalType?: string;         // "Log" or "Metric"
  condition?: string;          // Alert condition/query
  threshold?: string;          // Threshold that was exceeded
  actualValue?: string;        // Actual value that triggered
  firedTime?: string;          // ISO timestamp when alert fired
  monitorUrl?: string;         // URL to the monitoring dashboard
}
```

### Minimal Example

```json
{
  "alertName": "api-error-rate",
  "severity": 1,
  "description": "Error rate exceeded 5%",
  "affectedResource": "api-gateway",
  "logs": "Error: Connection timeout",
  "file": "src/api/handler.ts",
  "line": 42,
  "bugDescription": "Missing timeout configuration"
}
```

### Full Example

```json
{
  "alertName": "mcp-token-expiration",
  "severity": 1,
  "description": "Azure AD access token has expired, causing authentication failures in the MCP server.",
  "affectedResource": "aks-mcp-server-prod",
  "resourceType": "Microsoft.ContainerService/managedClusters",
  "signalType": "Log",
  "condition": "ContainerLog | where LogEntry contains 'TokenCredentialAuthenticationError'",
  "threshold": "Count > 0 within 5 minutes",
  "actualValue": "3 occurrences in last 5 minutes",
  "firedTime": "2024-02-06T12:00:00.000Z",
  "monitorUrl": "https://portal.azure.com/#@tenant/resource/.../alerts",
  "logs": "TokenCredentialAuthenticationError: The access token has expired\n    at getCurrentUserDetails (auth.ts:14)\nerrorCode=AADSTS700024",
  "file": "src/tools/auth.ts",
  "line": 14,
  "bugDescription": "Token refresh not implemented - tokens expire without renewal"
}
```

## Response

### Success (200)

```json
{
  "success": true,
  "session_id": "devin-abc123def456",
  "url": "https://app.devin.ai/sessions/abc123def456"
}
```

### Error (4xx/5xx)

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Invalid JSON | Malformed request body |
| 401 | Unauthorized | Invalid webhook secret (if configured) |
| 500 | DEVIN_API_KEY not configured | Missing environment variable |
| 502 | Devin API error | Devin API returned an error |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEVIN_API_KEY` | Yes | Your Devin API key |
| `TARGET_REPO` | No | Default repository URL (default: COG-GTM repo) |
| `JIRA_PROJECT` | No | JIRA project key for ticket creation |
| `SLACK_CHANNEL` | No | Slack channel for notifications |
| `WEBHOOK_SECRET` | No | Secret for webhook authentication |

## GET /api/trigger-devin

Returns configuration status (useful for health checks).

### Response

```json
{
  "configured": true,
  "keyType": "personal",
  "targetRepo": "https://github.com/COG-GTM/azure-devops-mcp",
  "jiraProject": "PLATFORM",
  "slackChannel": "#alerts"
}
```

## Mapping Alert Schemas

### Azure Monitor Common Alert Schema

```javascript
// Transform Azure alert to our schema
function transformAzureAlert(azurePayload) {
  const { essentials, alertContext } = azurePayload.data;
  
  return {
    alertName: essentials.alertRule,
    severity: parseInt(essentials.severity.replace('Sev', '')),
    description: essentials.description,
    affectedResource: essentials.alertTargetIDs[0],
    signalType: essentials.signalType,
    firedTime: essentials.firedDateTime,
    monitorUrl: `https://portal.azure.com/#@/resource${essentials.alertId}`,
    logs: JSON.stringify(alertContext.SearchResults || alertContext),
    file: "unknown",
    line: 0,
    bugDescription: `Azure alert: ${essentials.alertRule}`
  };
}
```

### Elastic Alert Schema

```javascript
// Transform Elastic alert to our schema
function transformElasticAlert(elasticPayload) {
  return {
    alertName: elasticPayload.rule?.name || "elastic-alert",
    severity: 1, // Map based on your rules
    description: elasticPayload.context?.message || "Elastic alert triggered",
    affectedResource: elasticPayload.context?.host?.name || "elastic-cluster",
    signalType: elasticPayload.rule?.type || "Log",
    firedTime: elasticPayload.date,
    logs: elasticPayload.context?.reason || "",
    file: "unknown",
    line: 0,
    bugDescription: `Elastic alert: ${elasticPayload.rule?.name}`
  };
}
```

### PagerDuty Webhook

```javascript
// Transform PagerDuty webhook to our schema
function transformPagerDutyAlert(pdPayload) {
  const incident = pdPayload.incident;
  
  return {
    alertName: incident.title,
    severity: incident.urgency === "high" ? 1 : 2,
    description: incident.description,
    affectedResource: incident.service?.name || "unknown",
    signalType: "PagerDuty",
    firedTime: incident.created_at,
    monitorUrl: incident.html_url,
    logs: incident.body?.details || "",
    file: "unknown",
    line: 0,
    bugDescription: incident.title
  };
}
```

## Rate Limiting

The endpoint does not implement rate limiting by default. For production, consider adding:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }
  // ... rest of handler
}
```

## Idempotency

By default, each request creates a new Devin session. To enable idempotency (prevent duplicate sessions for the same alert):

```typescript
const response = await fetch(`${V1_BASE_URL}/sessions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${DEVIN_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt,
    idempotent: true,  // Enable idempotency
  }),
});
```

With `idempotent: true`, Devin will return an existing session if one was created with the same prompt.

## Webhook Retries

Most alerting systems retry failed webhooks. Ensure your endpoint is idempotent or handles duplicate requests gracefully.

### Handling Retries

```typescript
// Store processed alert IDs
const processedAlerts = new Set();

export async function POST(request: Request) {
  const body = await request.json();
  const alertId = `${body.alertName}-${body.firedTime}`;
  
  if (processedAlerts.has(alertId)) {
    return NextResponse.json({
      success: true,
      message: "Already processed",
      duplicate: true
    });
  }
  
  processedAlerts.add(alertId);
  // ... process alert
}
```

For production, use Redis or a database instead of in-memory storage.
