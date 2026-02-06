# Azure Monitor Setup Guide

This guide walks you through configuring Azure Monitor to automatically trigger Devin AI when alerts fire.

## Overview

Azure Monitor uses **Action Groups** to define what happens when an alert fires. We'll create an Action Group with a **Webhook** action that calls the Devin API.

```
Alert Rule → Action Group → Webhook → Devin API → Triage Session
```

## Prerequisites

- Azure subscription with Monitor access
- Deployed webhook endpoint (this project)
- Devin API key

## Step 1: Deploy Your Webhook Endpoint

Before configuring Azure, you need a publicly accessible webhook endpoint.

### Option A: Vercel (Recommended)

```bash
cd demo-ui
vercel --prod
```

Your endpoint will be: `https://your-app.vercel.app/api/trigger-devin`

### Option B: Azure Functions

Create an HTTP-triggered Azure Function with the same logic as `route.ts`.

### Option C: Any Serverless Platform

AWS Lambda, Google Cloud Functions, etc. all work.

## Step 2: Create an Action Group

### Via Azure Portal

1. Navigate to **Azure Monitor** → **Alerts** → **Action groups**
2. Click **+ Create**

#### Basics Tab
| Field | Value |
|-------|-------|
| Subscription | Your subscription |
| Resource group | Your resource group (e.g., `rg-monitoring`) |
| Region | Global |
| Action group name | `ag-devin-triage` |
| Display name | `Devin AI Triage` |

#### Notifications Tab (Optional)
Add email/SMS notifications for visibility:

| Notification type | Details |
|-------------------|---------|
| Email | `oncall@yourcompany.com` |
| SMS | Your on-call number |

#### Actions Tab
This is the key configuration:

| Action type | Name | Configuration |
|-------------|------|---------------|
| Webhook | `Devin-AI-Webhook` | See below |

**Webhook Configuration:**

| Field | Value |
|-------|-------|
| URI | `https://your-endpoint.com/api/trigger-devin` |
| Enable common alert schema | ✅ Yes |

##### Custom Headers (if needed)
```
Authorization: Bearer your-api-key
Content-Type: application/json
```

3. Click **Review + create** → **Create**

### Via Azure CLI

```bash
az monitor action-group create \
  --resource-group rg-monitoring \
  --name ag-devin-triage \
  --short-name DevinAI \
  --action webhook Devin-AI-Webhook \
    https://your-endpoint.com/api/trigger-devin \
    usecommonalertschema=true
```

### Via Terraform

```hcl
resource "azurerm_monitor_action_group" "devin_triage" {
  name                = "ag-devin-triage"
  resource_group_name = azurerm_resource_group.monitoring.name
  short_name          = "DevinAI"

  webhook_receiver {
    name                    = "Devin-AI-Webhook"
    service_uri             = "https://your-endpoint.com/api/trigger-devin"
    use_common_alert_schema = true
  }

  email_receiver {
    name          = "oncall"
    email_address = "oncall@yourcompany.com"
  }
}
```

## Step 3: Create Alert Rules

Create alert rules that use your Action Group.

### Log-Based Alert (Example: Error Detection)

```bash
az monitor scheduled-query create \
  --name "mcp-error-detection" \
  --resource-group rg-monitoring \
  --scopes "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{cluster}" \
  --condition "count > 0" \
  --condition-query "ContainerLog | where LogEntry contains 'Error' or LogEntry contains 'Exception'" \
  --evaluation-frequency 5m \
  --window-size 5m \
  --severity 1 \
  --action-groups "/subscriptions/{sub-id}/resourceGroups/rg-monitoring/providers/Microsoft.Insights/actionGroups/ag-devin-triage"
```

### Metric-Based Alert (Example: High Latency)

```bash
az monitor metrics alert create \
  --name "mcp-high-latency" \
  --resource-group rg-monitoring \
  --scopes "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{cluster}" \
  --condition "avg requests/duration > 10000" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 1 \
  --action "/subscriptions/{sub-id}/resourceGroups/rg-monitoring/providers/Microsoft.Insights/actionGroups/ag-devin-triage"
```

## Step 4: Alert Processing Rules (Optional)

Use Alert Processing Rules to apply action groups based on conditions:

1. Navigate to **Azure Monitor** → **Alerts** → **Alert processing rules**
2. Click **+ Create**

| Field | Value |
|-------|-------|
| Name | `devin-auto-triage-rule` |
| Scope | Your subscription or resource group |
| Filter | Severity: Sev 0, Sev 1 |
| Rule settings | Apply action group |
| Action group | `ag-devin-triage` |
| Schedule | Always |

This ensures all Sev 0 and Sev 1 alerts automatically trigger Devin.

## Step 5: Test the Integration

### Manual Test

```bash
# Trigger the webhook manually with test data
curl -X POST https://your-endpoint.com/api/trigger-devin \
  -H "Content-Type: application/json" \
  -d '{
    "alertName": "test-alert",
    "severity": 1,
    "description": "Test alert from manual trigger",
    "affectedResource": "test-resource",
    "file": "src/test.ts",
    "line": 10,
    "bugDescription": "Test bug",
    "logs": "Error: Test error"
  }'
```

### Trigger a Real Alert

1. Intentionally cause an error in your monitored application
2. Wait for the alert to fire (based on your evaluation frequency)
3. Check the Action Group's activity log
4. Verify the Devin session was created

## Common Alert Schema

When "Enable common alert schema" is checked, Azure sends alerts in this format:

```json
{
  "schemaId": "azureMonitorCommonAlertSchema",
  "data": {
    "essentials": {
      "alertId": "/subscriptions/.../alerts/...",
      "alertRule": "mcp-error-detection",
      "severity": "Sev1",
      "signalType": "Log",
      "monitorCondition": "Fired",
      "monitoringService": "Log Alerts V2",
      "alertTargetIDs": [...],
      "firedDateTime": "2024-02-06T12:00:00.000Z",
      "description": "Error detected in MCP server"
    },
    "alertContext": {
      "properties": {...},
      "SearchResults": {...}
    }
  }
}
```

Your webhook endpoint should parse this format to extract alert details.

## Troubleshooting

### Webhook Not Firing

1. Check Action Group activity log in Azure Portal
2. Verify the webhook URL is accessible from Azure
3. Check for firewall/network rules blocking Azure IPs

### 401/403 Errors

1. Verify your API key is correct
2. Check the Authorization header format
3. Ensure the endpoint accepts the common alert schema

### Devin Session Not Created

1. Check your endpoint logs for errors
2. Verify the DEVIN_API_KEY environment variable is set
3. Test the Devin API directly with curl

## Best Practices

1. **Use Alert Processing Rules** for consistent action group assignment
2. **Enable common alert schema** for standardized payloads
3. **Set appropriate severities** - only trigger Devin for actionable alerts
4. **Add email notifications** alongside webhooks for visibility
5. **Monitor the webhook endpoint** - set up alerts for webhook failures
6. **Use managed identities** where possible for authentication

## Next Steps

- [Configure the Devin Playbook](./DEVIN-PLAYBOOK.md)
- [Set up JIRA integration](./DEVIN-PLAYBOOK.md#phase-5-jira-ticket-creation)
- [Configure Slack notifications](./DEVIN-PLAYBOOK.md#phase-6-slack-notification)
