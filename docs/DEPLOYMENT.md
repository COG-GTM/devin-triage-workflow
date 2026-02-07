# Deployment Guide

> **Deploy the webhook endpoint to your preferred serverless platform.**

The webhook receives alerts from Azure Monitor or Elastic and creates Devin sessions.

---

## Table of Contents

1. [Overview](#overview)
2. [Azure Functions Deployment](#azure-functions-deployment)
3. [AWS Lambda Deployment](#aws-lambda-deployment)
4. [Google Cloud Run](#google-cloud-run)
5. [Docker/Kubernetes](#dockerkubernetes)
6. [Environment Variables](#environment-variables)
7. [Security Best Practices](#security-best-practices)

---

## Overview

### Reference Implementation

The webhook endpoint code is in:
```
demo-ui/src/app/api/trigger-devin/route.ts
```

This is a Next.js API route, but the core logic can be adapted to any platform.

### What the Endpoint Does

```typescript
// Receives alert payload
const { alertName, severity, description, logs } = await request.json();

// Calls Devin API to create a session
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

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DEVIN_API_KEY` | Your Devin API key |
| `TARGET_REPO` | GitHub repo Devin will analyze |

---

## Azure Functions Deployment

Deploy as an Azure Function for native Azure integration.

### Step 1: Create Function App

**Direct Link:** [portal.azure.com/#create/Microsoft.FunctionApp](https://portal.azure.com/#create/Microsoft.FunctionApp)

Configure:

| Field | Value |
|-------|-------|
| **Function App name** | `fn-devin-triage` |
| **Runtime stack** | Node.js 18 LTS |
| **Region** | Your region |
| **Plan type** | Consumption (Serverless) |

Click **Review + create** → **Create**

### Step 2: Create the Function

1. Navigate to your Function App
2. Click **Functions** → **+ Create**
3. Select **HTTP trigger**
4. Name: `trigger-devin`
5. Authorization level: `Function`

### Step 3: Add Function Code

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
                    jsonBody: { error: 'Missing required fields' }
                };
            }
            
            const response = await fetch('https://api.devin.ai/v1/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: `
                        Triage this production alert:
                        - Alert: ${alertName}
                        - Severity: ${severity}
                        - Description: ${description}
                        - Repository: ${process.env.TARGET_REPO}
                        - Logs: ${logs || 'Not provided'}
                        
                        Analyze the codebase, identify the root cause, and create a PR with a fix.
                    `
                })
            });
            
            const session = await response.json();
            
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    sessionId: session.session_id,
                    sessionUrl: session.url
                }
            };
        } catch (error) {
            context.error('Error:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to create Devin session' }
            };
        }
    }
});
```

### Step 4: Configure Environment Variables

1. Go to Function App → **Configuration** → **Application settings**
2. Add:
   - `DEVIN_API_KEY`: Your Devin API key
   - `TARGET_REPO`: Your GitHub repo URL
3. Click **Save**

### Step 5: Get Function URL

Go to your function → **Get function URL**

Example:
```
https://fn-devin-triage.azurewebsites.net/api/trigger-devin?code=abc123...
```

---

## AWS Lambda Deployment

Deploy as an AWS Lambda function with API Gateway.

### Step 1: Create Lambda Function

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **Create function**
3. Configure:

| Field | Value |
|-------|-------|
| **Function name** | `devin-triage` |
| **Runtime** | Node.js 18.x |

### Step 2: Add Function Code

```javascript
export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { alertName, severity, description, logs } = body;
        
        if (!alertName || severity === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        const response = await fetch('https://api.devin.ai/v1/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: `
                    Triage this production alert:
                    - Alert: ${alertName}
                    - Severity: ${severity}
                    - Description: ${description}
                    - Repository: ${process.env.TARGET_REPO}
                    - Logs: ${logs || 'Not provided'}
                    
                    Analyze the codebase, identify the root cause, and create a PR with a fix.
                `
            })
        });
        
        const session = await response.json();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                sessionId: session.session_id,
                sessionUrl: session.url
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create session' })
        };
    }
};
```

### Step 3: Configure Environment Variables

1. Go to **Configuration** → **Environment variables**
2. Add:
   - `DEVIN_API_KEY`: Your API key
   - `TARGET_REPO`: Your repo URL

### Step 4: Add Function URL

1. Go to **Configuration** → **Function URL**
2. Click **Create function URL**
3. Auth type: `NONE` (or IAM for secured)

Your endpoint:
```
https://abc123.lambda-url.us-east-1.on.aws/
```

---

## Google Cloud Run

Deploy as a Cloud Run service.

### Step 1: Create Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

### Step 2: Create server.js

```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/trigger-devin', async (req, res) => {
    const { alertName, severity, description, logs } = req.body;
    
    const response = await fetch('https://api.devin.ai/v1/sessions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: `Triage alert: ${alertName}...`
        })
    });
    
    const session = await response.json();
    res.json({ success: true, sessionUrl: session.url });
});

app.listen(8080);
```

### Step 3: Deploy

```bash
gcloud run deploy devin-triage \
  --source . \
  --set-env-vars DEVIN_API_KEY=your-key,TARGET_REPO=your-repo \
  --allow-unauthenticated
```

---

## Docker/Kubernetes

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

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devin-triage
spec:
  replicas: 2
  selector:
    matchLabels:
      app: devin-triage
  template:
    spec:
      containers:
      - name: devin-triage
        image: your-registry/devin-triage:latest
        ports:
        - containerPort: 3000
        env:
        - name: DEVIN_API_KEY
          valueFrom:
            secretKeyRef:
              name: devin-secrets
              key: api-key
        - name: TARGET_REPO
          value: "https://github.com/your-org/your-repo"
---
apiVersion: v1
kind: Service
metadata:
  name: devin-triage
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: devin-triage
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DEVIN_API_KEY` | Devin API key | `apk_user_abc123...` |
| `TARGET_REPO` | Repository to analyze | `https://github.com/org/repo` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_SECRET` | Secret for webhook auth | None |
| `DEVIN_PLAYBOOK_ID` | Playbook to use | `devin-triage-workflow` |

---

## Security Best Practices

### 1. Use Webhook Secrets

```typescript
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (WEBHOOK_SECRET) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return { status: 401, body: 'Unauthorized' };
  }
}
```

### 2. Store Secrets Securely

- **Azure:** Use Key Vault references in App Settings
- **AWS:** Use Secrets Manager or Parameter Store
- **GCP:** Use Secret Manager

### 3. Restrict Network Access

- Use IP allowlists where possible
- Azure Monitor IPs: [Microsoft IP Ranges](https://www.microsoft.com/en-us/download/details.aspx?id=56519)

---

## Next Steps

- [Azure Monitor Setup](./AZURE-MONITOR-SETUP.md) — Configure Azure alerts
- [Elastic Setup](./ELASTIC-SETUP.md) — Configure Elastic alerts
- [Use Cases](./USE-CASES.md) — When to use this architecture
