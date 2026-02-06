# Production Deployment Guide

This guide covers deploying the webhook endpoint to various platforms.

## Quick Deploy Options

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/COG-GTM/devin-automated-triage&env=DEVIN_API_KEY,TARGET_REPO)

Or manually:

```bash
cd demo-ui
npm i -g vercel
vercel --prod
```

Set environment variables in Vercel Dashboard:
- `DEVIN_API_KEY`: Your Devin API key
- `TARGET_REPO`: Your target repository URL

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/COG-GTM/devin-automated-triage)

### Render

1. Connect your GitHub repository
2. Create a new Web Service
3. Set build command: `cd demo-ui && pnpm install && pnpm build`
4. Set start command: `cd demo-ui && pnpm start`
5. Add environment variables

## Manual Deployment

### AWS Lambda

Create a Lambda function with the webhook handler:

```javascript
// lambda/handler.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  
  const prompt = buildPrompt(body); // See route.ts for prompt building
  
  const response = await fetch('https://api.devin.ai/v1/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });
  
  const data = await response.json();
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      session_id: data.session_id,
      url: data.url,
    }),
  };
};

function buildPrompt(alert) {
  return `AUTOMATED ALERT TRIAGE...`; // Copy from route.ts
}
```

Deploy with SAM or CDK:

```yaml
# template.yaml (SAM)
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  DevinTriageFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handler.handler
      Runtime: nodejs18.x
      Timeout: 30
      Environment:
        Variables:
          DEVIN_API_KEY: !Ref DevinApiKey
          TARGET_REPO: !Ref TargetRepo
      Events:
        Api:
          Type: Api
          Properties:
            Path: /trigger-devin
            Method: post

Parameters:
  DevinApiKey:
    Type: String
    NoEcho: true
  TargetRepo:
    Type: String
```

### Google Cloud Functions

```javascript
// index.js
const functions = require('@google-cloud/functions-framework');
const fetch = require('node-fetch');

functions.http('triggerDevin', async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  const body = req.body;
  const prompt = buildPrompt(body);
  
  const response = await fetch('https://api.devin.ai/v1/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });
  
  const data = await response.json();
  res.json({ success: true, session_id: data.session_id, url: data.url });
});
```

Deploy:

```bash
gcloud functions deploy triggerDevin \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DEVIN_API_KEY=your-key,TARGET_REPO=your-repo
```

### Azure Functions

```javascript
// triggerDevin/index.js
const fetch = require('node-fetch');

module.exports = async function (context, req) {
  const body = req.body;
  const prompt = buildPrompt(body);
  
  const response = await fetch('https://api.devin.ai/v1/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEVIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });
  
  const data = await response.json();
  
  context.res = {
    body: { success: true, session_id: data.session_id, url: data.url }
  };
};
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY demo-ui/package*.json ./
COPY demo-ui/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY demo-ui/ ./
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

Build and run:

```bash
docker build -t devin-triage .
docker run -p 3000:3000 \
  -e DEVIN_API_KEY=your-key \
  -e TARGET_REPO=your-repo \
  devin-triage
```

### Kubernetes

```yaml
# k8s/deployment.yaml
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
  selector:
    app: devin-triage
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

Create the secret:

```bash
kubectl create secret generic devin-secrets \
  --from-literal=api-key=your-devin-api-key
```

## GitHub Actions Deployment

### Vercel

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
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./demo-ui
```

### AWS

```yaml
# .github/workflows/deploy-aws.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy with SAM
        run: |
          sam build
          sam deploy --no-confirm-changeset --no-fail-on-empty-changeset \
            --parameter-overrides DevinApiKey=${{ secrets.DEVIN_API_KEY }}
```

## Security Best Practices

### 1. Use Secrets Management

Never commit API keys. Use:
- GitHub Secrets for CI/CD
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault

### 2. Enable HTTPS

Always use HTTPS for the webhook endpoint. All cloud platforms provide this by default.

### 3. Add Authentication

Protect your endpoint with a secret:

```typescript
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (request.headers.get('X-Webhook-Secret') !== WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 4. Validate Input

```typescript
function validateAlertPayload(body: any): boolean {
  return (
    typeof body.alertName === 'string' &&
    typeof body.severity === 'number' &&
    body.severity >= 0 &&
    body.severity <= 4
  );
}
```

### 5. Rate Limit

Prevent abuse with rate limiting (see API-REFERENCE.md).

### 6. Log Everything

```typescript
console.log(JSON.stringify({
  event: 'alert_received',
  alertName: body.alertName,
  severity: body.severity,
  timestamp: new Date().toISOString(),
}));
```

### 7. Monitor the Endpoint

Set up alerts for:
- High error rates
- Slow response times
- Unusual traffic patterns

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DEVIN_API_KEY` | Yes | Devin API key | `apk_user_...` |
| `TARGET_REPO` | No | Default repository | `https://github.com/org/repo` |
| `JIRA_PROJECT` | No | JIRA project key | `PLATFORM` |
| `SLACK_CHANNEL` | No | Slack channel | `#alerts` |
| `WEBHOOK_SECRET` | No | Auth secret | `your-secret-here` |

## Health Check

Add a health check endpoint for monitoring:

```typescript
// api/health/route.ts
export async function GET() {
  const hasApiKey = !!process.env.DEVIN_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      devinApiKey: hasApiKey ? 'configured' : 'missing',
    },
  });
}
```

## Scaling Considerations

### Vercel/Serverless
- Auto-scales by default
- No configuration needed for most use cases

### Kubernetes
- Set appropriate resource limits
- Use HPA for auto-scaling
- Consider queue-based processing for high volume

### High Volume Alerts
For environments with many alerts:
1. Add a queue (SQS, Redis, etc.)
2. Process alerts asynchronously
3. Deduplicate similar alerts
4. Batch low-priority alerts
