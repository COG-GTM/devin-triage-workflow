# Azure Monitor + Devin AI Integration Guide

This guide explains how to configure Azure Monitor to automatically trigger Devin AI for incident triage and remediation when alerts fire.

## Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│    Azure Monitor    │────▶│    Action Group     │────▶│     Devin API       │
│    (Alert Rule)     │     │    (Webhook)        │     │   /v1/sessions      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │   Teams / Slack     │
                            │   Notifications     │
                            └─────────────────────┘
```

## Prerequisites

- Azure subscription with Azure Monitor enabled
- Log Analytics workspace configured
- Devin Enterprise account with API access
- Devin API key (Settings → API Keys)
- Application instrumented with Azure Application Insights (recommended)

## Step 1: Create a Log Analytics Workspace

If you don't already have one:

```bash
az monitor log-analytics workspace create \
  --resource-group <your-resource-group> \
  --workspace-name <workspace-name> \
  --location <location>
```

## Step 2: Configure Diagnostic Settings

Route logs from your applications to Log Analytics:

```bash
az monitor diagnostic-settings create \
  --name "send-logs-to-la" \
  --resource <your-app-resource-id> \
  --workspace <workspace-resource-id> \
  --logs '[
    {"category": "AppServiceHTTPLogs", "enabled": true},
    {"category": "AppServiceConsoleLogs", "enabled": true},
    {"category": "AppServiceAppLogs", "enabled": true}
  ]'
```

## Step 3: Create an Alert Rule

### Option A: Portal

1. Navigate to **Monitor** → **Alerts** → **+ Create** → **Alert rule**
2. Select your resource scope (e.g., Application Insights)
3. Configure the condition:

**Example: Error Rate Alert**
- Signal: `exceptions/count`
- Threshold: Greater than 50
- Aggregation granularity: 5 minutes
- Frequency: Every 5 minutes

**Example: Log Query Alert**
```kusto
AppExceptions
| where severityLevel >= 3
| summarize ErrorCount = count() by bin(timestamp, 5m), problemId
| where ErrorCount > 10
```

### Option B: ARM Template

```json
{
  "type": "Microsoft.Insights/scheduledQueryRules",
  "apiVersion": "2021-08-01",
  "name": "critical-error-alert",
  "location": "[resourceGroup().location]",
  "properties": {
    "displayName": "Critical Error Rate Alert",
    "description": "Triggers when error rate exceeds threshold",
    "severity": 1,
    "enabled": true,
    "evaluationFrequency": "PT5M",
    "windowSize": "PT5M",
    "scopes": ["[resourceId('Microsoft.Insights/components', 'your-app-insights')]"],
    "criteria": {
      "allOf": [{
        "query": "exceptions | where severityLevel >= 3 | summarize count()",
        "timeAggregation": "Count",
        "operator": "GreaterThan",
        "threshold": 50
      }]
    },
    "actions": {
      "actionGroups": ["[resourceId('Microsoft.Insights/actionGroups', 'devin-triage')]"]
    }
  }
}
```

## Step 4: Create an Action Group with Webhook

### Option A: Direct Webhook to Devin API

This is the simplest option but requires a middleware to transform the payload.

1. Navigate to **Monitor** → **Alerts** → **Action groups** → **+ Create**
2. Add a **Webhook** action:
   - Name: `Devin-Triage-Webhook`
   - URI: Your middleware endpoint that transforms and forwards to Devin
   - Enable common alert schema: **Yes**

### Option B: Logic App (Recommended)

A Logic App provides payload transformation and additional capabilities.

1. Create a new Logic App (Consumption plan)
2. Add trigger: **When a HTTP request is received**
3. Add action: **HTTP** to call Devin API

**Logic App Workflow:**

```json
{
  "definition": {
    "triggers": {
      "When_alert_fires": {
        "type": "Request",
        "kind": "Http",
        "inputs": { "method": "POST" }
      }
    },
    "actions": {
      "Call_Devin_API": {
        "type": "Http",
        "inputs": {
          "method": "POST",
          "uri": "https://api.devin.ai/v1/sessions",
          "headers": {
            "Authorization": "Bearer @{parameters('DevinApiKey')}",
            "Content-Type": "application/json"
          },
          "body": {
            "prompt": "AUTOMATED TRIAGE: @{triggerBody()?['data']?['essentials']?['description']}\n\nAlert: @{triggerBody()?['data']?['essentials']?['alertRule']}\nSeverity: @{triggerBody()?['data']?['essentials']?['severity']}\n\nAnalyze and fix this issue.",
            "repo_url": "@{parameters('TargetRepo')}"
          }
        }
      },
      "Post_to_Teams": {
        "type": "ApiConnection",
        "inputs": {
          "method": "POST",
          "path": "/v3/conversations/@{parameters('TeamsChannel')}/activities",
          "body": {
            "type": "message",
            "text": "🚨 Alert: @{triggerBody()?['data']?['essentials']?['alertRule']}\n\nDevin session: @{body('Call_Devin_API')?['url']}"
          }
        }
      }
    }
  }
}
```

4. Create Action Group pointing to the Logic App:
   - Action type: **Logic App**
   - Select your Logic App

## Step 5: Configure Devin Secrets

Store Azure credentials in Devin for log querying:

1. Go to [Devin Settings](https://app.devin.ai/settings) → **Secrets**
2. Add:
   - `AZURE_LOG_ANALYTICS_WORKSPACE_ID` - Your workspace ID
   - `AZURE_LOG_ANALYTICS_KEY` - Workspace access key
   - `AZURE_SUBSCRIPTION_ID` - For resource queries

## Step 6: Test the Integration

1. **Manual test:** Fire a test alert from Azure Monitor
2. **Verify:** Check that Devin session is created
3. **Validate:** Confirm Teams/Slack notification received

## Alert Payload Schema

Azure Monitor sends the following JSON (Common Alert Schema):

```json
{
  "schemaId": "azureMonitorCommonAlertSchema",
  "data": {
    "essentials": {
      "alertId": "/subscriptions/.../alerts/12345",
      "alertRule": "critical-error-alert",
      "severity": "Sev1",
      "signalType": "Log",
      "monitorCondition": "Fired",
      "monitoringService": "Log Analytics",
      "alertTargetIDs": ["/subscriptions/.../resourceGroups/..."],
      "firedDateTime": "2024-02-06T20:00:00Z",
      "description": "Error count exceeded threshold"
    },
    "alertContext": {
      "SearchQuery": "exceptions | where severityLevel >= 3",
      "SearchIntervalStartTimeUtc": "2024-02-06T19:55:00Z",
      "SearchIntervalEndtimeUtc": "2024-02-06T20:00:00Z",
      "ResultCount": 127
    }
  }
}
```

## Best Practices

1. **Use Log Query Alerts** for complex conditions
2. **Include relevant context** in alert descriptions
3. **Set appropriate thresholds** to avoid alert fatigue
4. **Store API keys in Azure Key Vault** and reference in Logic App
5. **Enable retry logic** for webhook actions
6. **Monitor your monitors** — alert on Action Group failures

## Troubleshooting

### Webhook not firing
- Check Action Group is attached to Alert Rule
- Verify webhook URL is accessible
- Review Action Group activity logs

### Devin session not created
- Verify API key is valid
- Check prompt format
- Review Devin API error response

### Missing context in Devin
- Include more details in alert description
- Pass log samples in the prompt
- Configure Devin secrets for log API access

## Links

- [Azure Monitor Alerts Overview](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-overview)
- [Action Groups](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups)
- [Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/)
- [Devin API Reference](https://docs.devin.ai/api-reference/overview)
