# API Reference

> **Complete documentation for the webhook endpoint that receives alerts and triggers Devin sessions.**

---

## Table of Contents

1. [Endpoint Overview](#endpoint-overview)
2. [Authentication](#authentication)
3. [Request Format](#request-format)
4. [Response Format](#response-format)
5. [Error Handling](#error-handling)
6. [Integration Examples](#integration-examples)
7. [Environment Variables](#environment-variables)
8. [Customization](#customization)

---

## Endpoint Overview

### Primary Endpoint

```
POST /api/trigger-devin
```

| Property | Value |
|----------|-------|
| Method | `POST` |
| Content-Type | `application/json` |
| Authentication | None (API key stored server-side) |

### Base URLs

| Environment | URL |
|-------------|-----|
| Local Development | `http://localhost:3000/api/trigger-devin` |
| Production | `https://your-webhook-endpoint/api/trigger-devin` |

---

## Authentication

The endpoint doesn't require client authentication by default — the Devin API key is stored as a server-side environment variable.

### Adding Webhook Secret (Recommended for Production)

To secure your endpoint, add a webhook secret:

#### 1. Set Environment Variable

Set `WEBHOOK_SECRET` in your deployment platform:

```bash
# Local .env.local
WEBHOOK_SECRET=your-secret-key-here

# Azure Functions: Configuration → Application settings
# AWS Lambda: Configuration → Environment variables
```

#### 2. Update the Route Handler

```typescript
// src/app/api/trigger-devin/route.ts

export async function POST(request: Request) {
  // Verify webhook secret
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.WEBHOOK_SECRET}`;
  
  if (process.env.WEBHOOK_SECRET && authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // ... rest of handler
}
```

#### 3. Configure in Azure/Elastic

Add the Authorization header to your webhook configuration:

```
Authorization: Bearer your-secret-key-here
```

---

## Request Format

### Standard Request Body

```json
{
  "alertName": "mcp-token-expiration",
  "severity": 1,
  "description": "Azure AD access token has expired",
  "affectedResource": "aks-mcp-server-prod",
  "signalType": "log",
  "firedTime": "2024-02-06T12:00:00Z",
  "source": "azure-monitor",
  "logs": "Error: TokenCredentialAuthenticationError...\n    at auth.ts:14",
  "file": "src/tools/auth.ts",
  "line": 14,
  "dimensions": {
    "cluster": "aks-mcp-server-prod",
    "namespace": "mcp-system",
    "pod": "mcp-server-7d4f8b9c6-x2j4k"
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `alertName` | string | Yes | Name of the alert rule that fired |
| `severity` | number | Yes | 0 (Critical) to 4 (Verbose) |
| `description` | string | Yes | Human-readable description of the issue |
| `affectedResource` | string | No | Resource name (cluster, service, etc.) |
| `signalType` | string | No | `log`, `metric`, or `activity` |
| `firedTime` | string | No | ISO 8601 timestamp |
| `source` | string | No | `azure-monitor`, `elastic`, `datadog`, etc. |
| `logs` | string | No | Error logs, stack traces |
| `file` | string | No | Source file where error occurred |
| `line` | number | No | Line number in source file |
| `dimensions` | object | No | Additional context (key-value pairs) |

### Azure Monitor Common Alert Schema

When Azure Monitor sends an alert with the common schema enabled:

```json
{
  "schemaId": "azureMonitorCommonAlertSchema",
  "data": {
    "essentials": {
      "alertId": "/subscriptions/{sub}/providers/Microsoft.AlertsManagement/alerts/{id}",
      "alertRule": "mcp-error-detection",
      "severity": "Sev1",
      "signalType": "Log",
      "monitorCondition": "Fired",
      "monitoringService": "Log Alerts V2",
      "alertTargetIDs": [
        "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{cluster}"
      ],
      "configurationItems": ["aks-mcp-server-prod"],
      "originAlertId": "{guid}",
      "firedDateTime": "2024-02-06T12:00:00.0000000Z",
      "description": "Error detected in MCP server"
    },
    "alertContext": {
      "conditionType": "LogQueryCriteria",
      "condition": {
        "windowSize": "PT5M",
        "allOf": [{
          "searchQuery": "ContainerLog | where LogEntry contains 'Error'",
          "metricValue": 3
        }]
      },
      "SearchResults": {
        "tables": [{
          "name": "PrimaryResult",
          "columns": [
            {"name": "TimeGenerated", "type": "datetime"},
            {"name": "LogEntry", "type": "string"}
          ],
          "rows": [
            ["2024-02-06T11:58:23.456Z", "Error: TokenCredentialAuthenticationError..."]
          ]
        }]
      }
    }
  }
}
```

### Elastic/Kibana Alerting Format

When Kibana sends an alert:

```json
{
  "alertName": "{{rule.name}}",
  "alertId": "{{alert.id}}",
  "severity": 1,
  "description": "{{context.reason}}",
  "source": "kibana",
  "signalType": "log",
  "firedTime": "{{date}}",
  "groupByField": "{{context.group}}",
  "matchedDocuments": "{{context.matchingDocuments}}",
  "logs": "{{#context.hits}}{{_source.message}}\n{{/context.hits}}"
}
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "sessionId": "session_1707228000000",
  "sessionUrl": "https://app.devin.ai/sessions/session_1707228000000",
  "message": "Devin session created successfully"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if session was created |
| `sessionId` | string | Unique Devin session identifier |
| `sessionUrl` | string | Direct link to watch Devin work |
| `message` | string | Human-readable status message |

### HTTP Status Codes

| Code | Meaning | Body |
|------|---------|------|
| 200 | Success | Success response with session details |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid or missing webhook secret |
| 500 | Server Error | Devin API error or internal error |

---

## Error Handling

### 400 Bad Request

```json
{
  "success": false,
  "error": "Missing required field: alertName"
}
```

Common causes:
- Missing `alertName` field
- Missing `severity` field  
- Invalid JSON body

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

Causes:
- Missing Authorization header
- Invalid webhook secret

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to create Devin session",
  "details": "API rate limit exceeded"
}
```

Causes:
- Invalid Devin API key
- Devin API rate limit
- Network error to Devin API
- Devin API outage

---

## Integration Examples

### cURL

```bash
curl -X POST https://your-webhook-endpoint/api/trigger-devin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-webhook-secret" \
  -d '{
    "alertName": "manual-test-alert",
    "severity": 1,
    "description": "Testing the webhook integration",
    "source": "curl-test",
    "logs": "Error: Test error at test.ts:42"
  }'
```

### Python

```python
import requests

response = requests.post(
    "https://your-webhook-endpoint/api/trigger-devin",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer your-webhook-secret"
    },
    json={
        "alertName": "python-test-alert",
        "severity": 1,
        "description": "Testing from Python",
        "source": "python-script",
        "logs": "Error: Test error"
    }
)

print(response.json())
# {'success': True, 'sessionId': 'session_...', 'sessionUrl': 'https://app.devin.ai/...'}
```

### Node.js

```javascript
const response = await fetch("https://your-webhook-endpoint/api/trigger-devin", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-webhook-secret"
  },
  body: JSON.stringify({
    alertName: "nodejs-test-alert",
    severity: 1,
    description: "Testing from Node.js",
    source: "nodejs-script",
    logs: "Error: Test error"
  })
});

const data = await response.json();
console.log(data);
```

### PowerShell

```powershell
$body = @{
    alertName = "powershell-test-alert"
    severity = 1
    description = "Testing from PowerShell"
    source = "powershell-script"
    logs = "Error: Test error"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://your-webhook-endpoint/api/trigger-devin" `
    -Method Post `
    -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer your-webhook-secret"
    } `
    -Body $body

$response
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DEVIN_API_KEY` | Your Devin API key | `apk_user_abc123...` |
| `TARGET_REPO` | GitHub repo for Devin to analyze | `https://github.com/org/repo` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_SECRET` | Secret for webhook authentication | None (no auth) |
| `JIRA_PROJECT` | JIRA project key for ticket creation | None |
| `SLACK_CHANNEL` | Slack channel for notifications | None |
| `DEVIN_PLAYBOOK_ID` | Playbook name to use | `devin-triage-workflow` |

### Setting Environment Variables

Configure these in your deployment platform:

**Azure Functions:**
1. Go to Azure Portal → Function App → **Configuration**
2. Add each variable under **Application settings**

**AWS Lambda:**
1. Go to Lambda Console → Your Function → **Configuration**
2. Add each variable under **Environment variables**

**Google Cloud Run:**
```bash
gcloud run services update SERVICE_NAME \
  --set-env-vars DEVIN_API_KEY=your-key,TARGET_REPO=your-repo
```

---

## Customization

### Custom Prompt Engineering

Modify the session prompt in `route.ts`:

```typescript
const prompt = `
You are an SRE triaging a production alert.

## Alert Details
- **Name**: ${alertName}
- **Severity**: Sev ${severity}
- **Description**: ${description}
- **Time**: ${firedTime}

## Error Logs
\`\`\`
${logs}
\`\`\`

## Your Tasks
1. Clone the repository: ${process.env.TARGET_REPO}
2. Analyze the error and identify root cause
3. Create a fix with proper error handling
4. Write tests for the fix
5. Create a Pull Request
6. Create a JIRA ticket: ${process.env.JIRA_PROJECT}
7. Post to Slack: ${process.env.SLACK_CHANNEL}

Begin triage.
`;
```

### Adding Custom Fields

Extend the request handler to accept additional fields:

```typescript
interface AlertPayload {
  alertName: string;
  severity: number;
  description: string;
  // Add custom fields
  team?: string;
  runbook?: string;
  priority?: 'P1' | 'P2' | 'P3';
}
```

### Routing to Different Playbooks

Route different alert types to different Devin playbooks:

```typescript
function getPlaybookId(alertName: string): string | undefined {
  const playbooks: Record<string, string> = {
    'auth-error': 'playbook_auth_123',
    'timeout': 'playbook_perf_456',
    'null-reference': 'playbook_bug_789',
  };
  
  for (const [pattern, id] of Object.entries(playbooks)) {
    if (alertName.includes(pattern)) return id;
  }
  return undefined; // Use default
}
```

---

## Rate Limits

### Devin API Limits

| Plan | Requests/minute | Concurrent Sessions |
|------|-----------------|---------------------|
| Starter | 10 | 1 |
| Team | 60 | 5 |
| Enterprise | 300 | 20 |

### Handling Rate Limits

The endpoint implements exponential backoff:

```typescript
async function createSessionWithRetry(payload: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await createDevinSession(payload);
    } catch (error: any) {
      if (error.status === 429 && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}
```

---

## Devin API Reference

This workflow uses the **Devin v1 API** to create sessions. Below is a summary of the key endpoints.

### API Key Types

| Key Type | Prefix | Use Case | Where to Create |
|----------|--------|----------|-----------------|
| **Personal API Key** | `apk_user_*` | Testing, personal automation | [Settings → API Keys](https://app.devin.ai/settings/api-keys) |
| **Service API Key** | `apk_*` | Team automation, CI/CD | [Settings → API Keys](https://app.devin.ai/settings/api-keys) |
| **Service User (v3)** | `cog_*` | Enterprise with RBAC | [Enterprise → Service Users](https://app.devin.ai/settings/enterprise/service-users) |

> 📚 **Full details:** [Authentication & API Keys](https://docs.devin.ai/api-reference/authentication)

### Create Session Endpoint

```
POST https://api.devin.ai/v1/sessions
Authorization: Bearer {DEVIN_API_KEY}
Content-Type: application/json
```

**Request:**
```json
{
  "prompt": "Your task description here...",
  "idempotent": true
}
```

**Response:**
```json
{
  "session_id": "session_1707228000000",
  "url": "https://app.devin.ai/sessions/session_1707228000000",
  "status": "running"
}
```

> 📚 **Full details:** [v1 Create Session](https://docs.devin.ai/api-reference/v1/sessions/create-a-new-devin-session)

### Monitor Session Status

```
GET https://api.devin.ai/v1/sessions/{session_id}
Authorization: Bearer {DEVIN_API_KEY}
```

**Response:**
```json
{
  "session_id": "session_1707228000000",
  "status_enum": "running",
  "url": "https://app.devin.ai/sessions/session_1707228000000"
}
```

Status values: `running`, `blocked`, `finished`

### Send Message to Session

```
POST https://api.devin.ai/v1/sessions/{session_id}/message
Authorization: Bearer {DEVIN_API_KEY}
Content-Type: application/json
```

**Request:**
```json
{
  "message": "Make sure to write unit tests when done."
}
```

### Session Secrets (Temporary Credentials)

Pass temporary credentials that are only available for a single session:

```json
{
  "prompt": "Deploy to staging",
  "session_secrets": [
    {
      "key": "DEPLOY_API_KEY",
      "value": "temp-key-12345",
      "sensitive": true
    }
  ]
}
```

> 📚 **Full details:** [v1 Usage Examples](https://docs.devin.ai/api-reference/v1/usage-examples)

### Complete Python Example

```python
import os
import requests
import time

DEVIN_API_KEY = os.getenv("DEVIN_API_KEY")

# Create a new session
response = requests.post(
    "https://api.devin.ai/v1/sessions",
    headers={"Authorization": f"Bearer {DEVIN_API_KEY}"},
    json={
        "prompt": "Triage production alert: auth token expired...",
        "idempotent": True
    }
)

session = response.json()
print(f"Session created: {session['url']}")

# Monitor session status
while True:
    status = requests.get(
        f"https://api.devin.ai/v1/sessions/{session['session_id']}",
        headers={"Authorization": f"Bearer {DEVIN_API_KEY}"}
    ).json()
    
    print(f"Status: {status['status_enum']}")
    
    if status["status_enum"] in ["blocked", "finished"]:
        break
    
    time.sleep(5)
```

### Official Devin Documentation

| Resource | Link |
|----------|------|
| **Authentication & API Keys** | [docs.devin.ai/api-reference/authentication](https://docs.devin.ai/api-reference/authentication) |
| **API Overview** | [docs.devin.ai/api-reference/overview](https://docs.devin.ai/api-reference/overview) |
| **v1 Usage Examples** | [docs.devin.ai/api-reference/v1/usage-examples](https://docs.devin.ai/api-reference/v1/usage-examples) |
| **v1 Create Session** | [docs.devin.ai/api-reference/v1/sessions/create-a-new-devin-session](https://docs.devin.ai/api-reference/v1/sessions/create-a-new-devin-session) |
| **Devin App** | [app.devin.ai](https://app.devin.ai) |
| **Generate API Keys** | [app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys) |

---

## Next Steps

- [Azure Monitor Setup](./AZURE-MONITOR-SETUP.md) — Configure Azure alerts
- [Elastic Setup](./ELASTIC-SETUP.md) — Configure Elastic alerts
- [Devin Playbook](./DEVIN-PLAYBOOK.md) — Customize triage behavior
- [Deployment Guide](./DEPLOYMENT.md) — Production deployment options
