# Deployment Guide

> **Deploy the webhook endpoint to Azure Functions.**

The webhook receives alerts from Azure Monitor or Elastic and creates Devin sessions.

---

## Table of Contents

1. [Overview](#overview)
2. [Azure Functions Deployment](#azure-functions-deployment)
3. [Environment Variables](#environment-variables)
4. [Security Best Practices](#security-best-practices)
5. [Docker/Kubernetes (Optional)](#dockerkubernetes-optional)

---

## Overview

### Reference Implementation

The webhook endpoint code is in:
```
demo-ui/src/app/api/trigger-devin/route.ts
```

### What the Endpoint Does

```typescript
// Receives alert payload from Azure Monitor
const { alertName, severity, description, logs } = await request.json();

// Calls Devin API to create a triage session
const response = await fetch('https://api.devin.ai/v1/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: `Triage this alert: ${alertName}...`
  })
});

// Returns session URL
return { sessionId, sessionUrl };
```

---

## Azure Functions Deployment

### Step 1: Create Function App

**Direct Link:** [portal.azure.com/#create/Microsoft.FunctionApp](https://portal.azure.com/#create/Microsoft.FunctionApp)

Or manually:
1. Go to [Azure Portal](https://portal.azure.com)
2. Click **Create a resource**
3. Search for **Function App**
4. Click **Create**

Configure:

| Field | Value |
|-------|-------|
| **Subscription** | Your subscription |
| **Resource Group** | `rg-devin-triage` (create new) |
| **Function App name** | `fn-devin-triage` |
| **Runtime stack** | Node.js |
| **Version** | 18 LTS |
| **Region** | Your region |
| **Operating System** | Linux |
| **Plan type** | Consumption (Serverless) |

Click **Review + create** → **Create**

### Step 2: Create the Function

1. Navigate to your Function App
2. Click **Functions** → **+ Create**
3. Select **HTTP trigger**
4. Name: `trigger-devin`
5. Authorization level: `Function`

### Step 3: Add Function Code

Replace the default code with:

```javascript
const { app } = require('@azure/functions');

app.http('trigger-devin', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { alertName, severity, description, logs } = body;
            
            if (!alertName || severity === undefined) {
                return {
                    status: 400,
                    jsonBody: { error: 'Missing required fields: alertName and severity' }
                };
            }
            
            // Create Devin session
            const response = await fetch('https://api.devin.ai/v1/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: `
You are an SRE triaging a production alert.

## Alert Details
- **Alert Name**: ${alertName}
- **Severity**: Sev ${severity}
- **Description**: ${description || 'Not provided'}

## Error Logs
\`\`\`
${logs || 'No logs provided'}
\`\`\`

## Your Tasks
1. Clone the repository: ${process.env.TARGET_REPO}
2. Analyze the error and identify the root cause
3. Create a fix with proper error handling
4. Write tests for the fix
5. Create a Pull Request

Begin triage.
                    `,
                    playbook_id: process.env.DEVIN_PLAYBOOK_ID || 'devin-triage-workflow'
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                context.error('Devin API error:', error);
                return {
                    status: 500,
                    jsonBody: { error: 'Failed to create Devin session', details: error }
                };
            }
            
            const session = await response.json();
            
            context.log('Devin session created:', session.session_id);
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    sessionId: session.session_id,
                    sessionUrl: session.url,
                    message: 'Devin session created successfully'
                }
            };
        } catch (error) {
            context.error('Error:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error', message: error.message }
            };
        }
    }
});
```

### Step 4: Configure Environment Variables

1. Go to Function App → **Configuration** → **Application settings**
2. Click **+ New application setting** for each:

| Name | Value |
|------|-------|
| `DEVIN_API_KEY` | Your Devin API key from [app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys) |
| `TARGET_REPO` | Your GitHub repository URL (e.g., `https://github.com/your-org/your-repo`) |
| `DEVIN_PLAYBOOK_ID` | `devin-triage-workflow` (optional) |

3. Click **Save**
4. **Restart** the Function App

### Step 5: Get Function URL

1. Go to your function → **Get function URL**
2. Copy the URL (includes function key)

Example:
```
https://fn-devin-triage.azurewebsites.net/api/trigger-devin?code=abc123...
```

This is the URL you'll use in your Azure Monitor Action Group.

### Step 6: Test the Function

```bash
curl -X POST "https://fn-devin-triage.azurewebsites.net/api/trigger-devin?code=YOUR_FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "alertName": "test-alert",
    "severity": 1,
    "description": "Testing Azure Function deployment",
    "logs": "Error: Test error at line 42"
  }'
```

Expected response:
```json
{
  "success": true,
  "sessionId": "session_1234567890",
  "sessionUrl": "https://app.devin.ai/sessions/session_1234567890",
  "message": "Devin session created successfully"
}
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DEVIN_API_KEY` | Devin API key | `apk_user_abc123...` |
| `TARGET_REPO` | Repository Devin will analyze | `https://github.com/org/repo` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `DEVIN_PLAYBOOK_ID` | Playbook to use | `devin-triage-workflow` |
| `WEBHOOK_SECRET` | Secret for additional auth | None |

### Using Azure Key Vault (Recommended)

For production, store secrets in Key Vault:

1. Create a Key Vault in Azure Portal
2. Add your `DEVIN_API_KEY` as a secret
3. In Function App → **Configuration** → **Application settings**
4. Use Key Vault reference: `@Microsoft.KeyVault(VaultName=your-vault;SecretName=devin-api-key)`

---

## Security Best Practices

### 1. Use Function-Level Authorization

The Function already requires a function key (`?code=...`). This prevents unauthorized calls.

### 2. Use Managed Identity

For enhanced security, use Azure Managed Identity with Key Vault:

```bash
# Enable system-assigned managed identity
az functionapp identity assign --name fn-devin-triage --resource-group rg-devin-triage

# Grant Key Vault access
az keyvault set-policy --name your-keyvault \
  --object-id <managed-identity-object-id> \
  --secret-permissions get
```

### 3. Network Restrictions (Optional)

Restrict to Azure Monitor IPs:
1. Go to Function App → **Networking** → **Access restriction**
2. Add rules for Azure Monitor service tag

---

## Docker/Kubernetes (Optional)

If you prefer containerized deployment:

### Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY demo-ui/package*.json ./
RUN npm ci --only=production
COPY demo-ui/ ./
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

### Deploy to Azure Container Apps

```bash
# Build and push to Azure Container Registry
az acr build --registry your-registry --image devin-triage:latest .

# Deploy to Container Apps
az containerapp create \
  --name devin-triage \
  --resource-group rg-devin-triage \
  --image your-registry.azurecr.io/devin-triage:latest \
  --env-vars DEVIN_API_KEY=your-key TARGET_REPO=your-repo \
  --ingress external \
  --target-port 3000
```

---

## Troubleshooting

### Function Not Responding

1. Check **Monitor** → **Logs** in Azure Portal
2. Verify environment variables are set
3. Ensure Function App is running

### Devin Session Not Created

1. Verify `DEVIN_API_KEY` is valid
2. Check [status.devin.ai](https://status.devin.ai) for API status
3. Review function logs for error details

### 401/403 Errors

1. Verify function key is included in URL
2. Check API key permissions in Devin dashboard

---

## Next Steps

- [Azure Monitor Setup](./AZURE-MONITOR-SETUP.md) — Configure alerts to call this function
- [Elastic Setup](./ELASTIC-SETUP.md) — Configure Elastic alerts
- [Use Cases](./USE-CASES.md) — When to use this architecture
