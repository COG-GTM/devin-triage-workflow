# Production Deployment Guide

> **Step-by-step instructions for deploying the webhook endpoint to production.**

This guide covers Vercel (recommended), Azure Functions, AWS Lambda, and other platforms.

---

## Table of Contents

1. [Quick Deploy Options](#quick-deploy-options)
2. [Vercel Deployment](#vercel-deployment-recommended)
3. [Azure Functions Deployment](#azure-functions-deployment)
4. [AWS Lambda Deployment](#aws-lambda-deployment)
5. [Docker/Kubernetes](#dockerkubernetes)
6. [Environment Variables](#environment-variables)
7. [Security Best Practices](#security-best-practices)
8. [Monitoring & Logging](#monitoring--logging)
9. [CI/CD Setup](#cicd-setup)

---

## Quick Deploy Options

| Platform | Deploy Time | Best For | Cost |
|----------|-------------|----------|------|
| **Vercel** | 2 min | Fastest setup | Free tier available |
| **Azure Functions** | 10 min | Azure-native | Pay-per-execution |
| **AWS Lambda** | 15 min | AWS ecosystem | Pay-per-execution |
| **Railway** | 3 min | Simple hosting | Free tier available |
| **Render** | 5 min | Easy scaling | Free tier available |

---

## Vercel Deployment (Recommended)

Vercel is the easiest option for Next.js applications.

### Option A: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/COG-GTM/devin-triage-workflow&env=DEVIN_API_KEY,TARGET_REPO&envDescription=Required%20environment%20variables&envLink=https://github.com/COG-GTM/devin-triage-workflow%23environment-variables&project-name=devin-triage&repository-name=devin-triage)

1. Click the button above
2. Connect your GitHub account if not already
3. Enter environment variables when prompted:
   - `DEVIN_API_KEY`: Your Devin API key
   - `TARGET_REPO`: GitHub repo URL
4. Click **Deploy**
5. Wait ~60 seconds for deployment

Your endpoint will be:
```
https://devin-triage-<unique-id>.vercel.app/api/trigger-devin
```

### Option B: Manual CLI Deploy

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Clone and Navigate

```bash
git clone https://github.com/COG-GTM/devin-triage-workflow.git
cd devin-triage-workflow/demo-ui
```

#### Step 3: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

#### Step 4: Deploy

```bash
vercel --prod
```

You'll be asked:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your team/personal
- **Link to existing project?** → No (first time)
- **Project name?** → `devin-triage` (or your choice)
- **Directory?** → `.` (current directory)

#### Step 5: Set Environment Variables

```bash
# Set Devin API key
vercel env add DEVIN_API_KEY production
# Paste your key when prompted

# Set target repository
vercel env add TARGET_REPO production
# Enter: https://github.com/your-org/your-repo

# Optional: Set webhook secret
vercel env add WEBHOOK_SECRET production
# Enter your secret key
```

#### Step 6: Redeploy with Variables

```bash
vercel --prod
```

### Verify Deployment

```bash
curl https://your-project.vercel.app/api/trigger-devin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"alertName":"test","severity":1,"description":"Test"}'
```

### Vercel Dashboard

**Direct Link:** [vercel.com/dashboard](https://vercel.com/dashboard)

From the dashboard:
- View deployments: **Deployments** tab
- View logs: **Functions** → Select function → **Logs**
- Manage env vars: **Settings** → **Environment Variables**

---

## Azure Functions Deployment

Deploy as an Azure Function for native Azure integration.

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
5. Authorization level: `Function` or `Anonymous`

### Step 3: Add Function Code

Replace the default code with:

```javascript
// index.js
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
            
            // Create Devin session
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
                        
                        Follow the triage playbook to analyze, fix, and document.
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
2. Click **+ New application setting** for each:

| Name | Value |
|------|-------|
| `DEVIN_API_KEY` | Your Devin API key |
| `TARGET_REPO` | Your GitHub repo URL |

3. Click **Save**

### Step 5: Get Function URL

1. Go to your function → **Get function URL**
2. Copy the URL (includes function key if using Function auth level)

Example:
```
https://fn-devin-triage.azurewebsites.net/api/trigger-devin?code=abc123...
```

---

## AWS Lambda Deployment

Deploy as an AWS Lambda function.

### Step 1: Create Lambda Function

**Direct Link:** [console.aws.amazon.com/lambda](https://console.aws.amazon.com/lambda)

1. Go to AWS Lambda console
2. Click **Create function**
3. Configure:

| Field | Value |
|-------|-------|
| **Function name** | `devin-triage` |
| **Runtime** | Node.js 18.x |
| **Architecture** | x86_64 |

4. Click **Create function**

### Step 2: Add Function Code

```javascript
// index.mjs
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
                prompt: `Triage alert: ${alertName}...`
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
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create session' })
        };
    }
};
```

### Step 3: Configure Environment Variables

1. Go to **Configuration** → **Environment variables**
2. Click **Edit** → **Add environment variable**
3. Add:
   - `DEVIN_API_KEY`: Your API key
   - `TARGET_REPO`: Your repo URL

### Step 4: Add API Gateway

1. Go to **Configuration** → **Function URL**
2. Click **Create function URL**
3. Auth type: `NONE` (or AWS_IAM for secured)
4. Click **Save**

Your endpoint:
```
https://abc123.lambda-url.us-east-1.on.aws/
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
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
```

### Build and Push

```bash
# Build
docker build -t devin-triage:latest .

# Tag for registry
docker tag devin-triage:latest your-registry.azurecr.io/devin-triage:latest

# Push
docker push your-registry.azurecr.io/devin-triage:latest
```

### Kubernetes Deployment

```yaml
# deployment.yaml
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
    metadata:
      labels:
        app: devin-triage
    spec:
      containers:
      - name: devin-triage
        image: your-registry.azurecr.io/devin-triage:latest
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

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DEVIN_API_KEY` | Devin API key | `apk_user_abc123...` |
| `TARGET_REPO` | Repository to analyze | `https://github.com/org/repo` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_SECRET` | Secret for webhook auth | None |
| `JIRA_PROJECT` | JIRA project key | None |
| `SLACK_CHANNEL` | Slack channel | None |
| `DEVIN_PLAYBOOK_ID` | Playbook to use | None |

### Security: Never Commit Secrets

```bash
# .env.local (never commit)
DEVIN_API_KEY=apk_user_abc123...
TARGET_REPO=https://github.com/org/repo
WEBHOOK_SECRET=super-secret-key
```

Add to `.gitignore`:
```
.env.local
.env*.local
```

---

## Security Best Practices

### 1. Use Webhook Secrets

Always authenticate incoming webhooks:

```typescript
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (WEBHOOK_SECRET) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### 2. Validate Request Origin

For Azure Monitor:
```typescript
const azureIPs = ['13.66.60.119', '13.66.143.220', ...]; // Azure IP ranges
const clientIP = request.headers.get('x-forwarded-for');
// Validate IP is from Azure
```

### 3. Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

const { success } = await ratelimit.limit(clientIP);
if (!success) {
  return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
}
```

### 4. Input Validation

```typescript
import { z } from 'zod';

const AlertSchema = z.object({
  alertName: z.string().min(1).max(200),
  severity: z.number().min(0).max(4),
  description: z.string().max(5000),
  logs: z.string().max(50000).optional(),
});

const result = AlertSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

---

## Monitoring & Logging

### Vercel Logs

View function logs at:
```
https://vercel.com/your-team/your-project/deployments → Select deployment → Functions → Logs
```

### Structured Logging

```typescript
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
}

// Usage
log('info', 'Alert received', { alertName, severity });
log('error', 'Devin API failed', { error: error.message });
```

### Health Check Endpoint

Add a health check:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
}
```

---

## CI/CD Setup

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: cd demo-ui && npm ci
        
      - name: Run tests
        run: cd demo-ui && npm test
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: demo-ui
```

### Required Secrets

Set these in GitHub repository settings → Secrets:

| Secret | How to Get |
|--------|------------|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after linking |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after linking |

---

## Platform Links

### Vercel
- Dashboard: [vercel.com/dashboard](https://vercel.com/dashboard)
- Docs: [vercel.com/docs](https://vercel.com/docs)

### Azure Functions
- Portal: [portal.azure.com](https://portal.azure.com)
- Docs: [learn.microsoft.com/azure/azure-functions](https://learn.microsoft.com/azure/azure-functions)

### AWS Lambda
- Console: [console.aws.amazon.com/lambda](https://console.aws.amazon.com/lambda)
- Docs: [docs.aws.amazon.com/lambda](https://docs.aws.amazon.com/lambda)

### Devin
- App: [app.devin.ai](https://app.devin.ai)
- API Keys: [app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys)
- Docs: [docs.devin.ai](https://docs.devin.ai)

---

## Next Steps

- [Azure Monitor Setup](./AZURE-MONITOR-SETUP.md) — Configure Azure alerts
- [Elastic Setup](./ELASTIC-SETUP.md) — Configure Elastic alerts
- [API Reference](./API-REFERENCE.md) — Endpoint documentation
- [Devin Playbook](./DEVIN-PLAYBOOK.md) — Customize triage behavior
