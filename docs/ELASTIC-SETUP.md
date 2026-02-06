# Elastic/Kibana Setup Guide

This guide walks you through configuring Elastic (Kibana) to automatically trigger Devin AI when alerts fire.

## Overview

Elastic provides multiple ways to trigger automated actions:

1. **Alerting Rules** - Modern UI-based alerting with Connectors
2. **Watcher** - JSON-based scheduled queries with actions
3. **ML Anomaly Detection** - Machine learning-based anomaly alerts

All three can trigger webhooks to call the Devin API.

```
Elastic Alert → Connector/Watcher → Webhook → Devin API → Triage Session
```

## Prerequisites

- Elastic Cloud or self-managed Elastic Stack
- Kibana access with alerting permissions
- Deployed webhook endpoint (this project)
- Devin API key

## Method 1: Alerting Rules with Connectors

This is the recommended modern approach for Elastic 8.x+.

### Step 1: Create a Webhook Connector

1. Navigate to **Stack Management** → **Connectors**
2. Click **Create connector**
3. Select **Webhook**

| Field | Value |
|-------|-------|
| Connector name | `Devin-AI-Webhook` |
| URL | `https://your-endpoint.com/api/trigger-devin` |
| Method | `POST` |
| Headers | See below |

**Headers:**
```
Content-Type: application/json
```

**Authentication (if needed):**
- Add Authorization header with your API key
- Or configure Basic Auth

4. Click **Save**

### Step 2: Create an Alerting Rule

1. Navigate to **Observability** → **Alerts** → **Manage Rules**
2. Click **Create rule**

#### For Log-Based Alerts

| Field | Value |
|-------|-------|
| Name | `MCP Error Detection` |
| Rule type | `Log threshold` |
| Log indices | `logs-*` |
| Condition | `count > 0` |
| Filter | `level: ERROR OR level: error` |
| Time window | `5 minutes` |
| Check every | `1 minute` |

#### For Metric-Based Alerts

| Field | Value |
|-------|-------|
| Name | `MCP High Latency` |
| Rule type | `Metric threshold` |
| Metric indices | `metrics-*` |
| Condition | `avg(http.response.time) > 10000` |
| Time window | `5 minutes` |
| Check every | `1 minute` |

### Step 3: Add Connector Action

In the rule configuration:

1. Scroll to **Actions**
2. Click **Add action**
3. Select **Webhook: Devin-AI-Webhook**
4. Configure the body:

```json
{
  "alertName": "{{rule.name}}",
  "severity": 1,
  "description": "{{context.message}}",
  "affectedResource": "{{context.host.name}}",
  "signalType": "{{rule.type}}",
  "firedTime": "{{date}}",
  "logs": "{{context.reason}}",
  "file": "unknown",
  "line": 0,
  "bugDescription": "Alert triggered: {{rule.name}}"
}
```

5. Click **Save**

## Method 2: Watcher (Advanced)

Watcher provides more control with JSON-based configuration.

### Create a Watch via Dev Tools

Navigate to **Dev Tools** and execute:

```json
PUT _watcher/watch/devin-triage-watch
{
  "metadata": {
    "name": "Devin AI Triage Watch"
  },
  "trigger": {
    "schedule": {
      "interval": "5m"
    }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["logs-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                {
                  "range": {
                    "@timestamp": {
                      "gte": "now-5m"
                    }
                  }
                },
                {
                  "terms": {
                    "level": ["ERROR", "error", "FATAL", "fatal"]
                  }
                }
              ]
            }
          },
          "size": 10,
          "sort": [{ "@timestamp": "desc" }]
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.hits.total.value": {
        "gt": 0
      }
    }
  },
  "actions": {
    "devin_webhook": {
      "webhook": {
        "method": "POST",
        "url": "https://your-endpoint.com/api/trigger-devin",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": """
{
  "alertName": "elastic-error-watch",
  "severity": 1,
  "description": "{{ctx.payload.hits.total.value}} errors detected in the last 5 minutes",
  "affectedResource": "elastic-cluster",
  "signalType": "Log",
  "firedTime": "{{ctx.trigger.triggered_time}}",
  "logs": "{{#ctx.payload.hits.hits}}{{_source.message}}\n{{/ctx.payload.hits.hits}}",
  "file": "{{#ctx.payload.hits.hits.0._source.file}}{{ctx.payload.hits.hits.0._source.file}}{{/ctx.payload.hits.hits.0._source.file}}",
  "line": 0,
  "bugDescription": "Multiple errors detected in logs"
}
"""
      }
    }
  }
}
```

### Test the Watch

```json
POST _watcher/watch/devin-triage-watch/_execute
{
  "ignore_condition": true
}
```

## Method 3: ML Anomaly Detection

Use Machine Learning to detect unusual patterns.

### Step 1: Create an Anomaly Detection Job

1. Navigate to **Machine Learning** → **Anomaly Detection**
2. Click **Create job**
3. Select your data view

#### Example: Error Rate Anomaly

| Field | Value |
|-------|-------|
| Job ID | `mcp-error-anomaly` |
| Detector | `high_count` |
| By field | `service.name` |
| Bucket span | `5m` |

4. Click **Create job** and **Start job**

### Step 2: Create an Anomaly Alert Rule

1. Navigate to **Observability** → **Alerts** → **Manage Rules**
2. Click **Create rule**
3. Select **Anomaly detection alert**

| Field | Value |
|-------|-------|
| Name | `MCP Anomaly Alert` |
| Job | `mcp-error-anomaly` |
| Severity threshold | `75` |
| Check every | `5 minutes` |

4. Add the Webhook action (same as Method 1)

## Connector Configuration Details

### Webhook Body Variables

Elastic provides these variables for webhook bodies:

| Variable | Description |
|----------|-------------|
| `{{rule.name}}` | Name of the alert rule |
| `{{rule.type}}` | Type of rule (log threshold, metric, etc.) |
| `{{context.message}}` | Alert message |
| `{{context.reason}}` | Why the alert fired |
| `{{date}}` | Timestamp |
| `{{context.host.name}}` | Host that triggered (if available) |
| `{{context.hits}}` | Matching documents |

### Custom Payload Example

For more detailed payloads:

```json
{
  "alertName": "{{rule.name}}",
  "severity": 1,
  "description": "{{context.message}}",
  "affectedResource": "{{context.host.name}}",
  "resourceType": "Elastic Cluster",
  "signalType": "{{rule.type}}",
  "condition": "{{rule.conditions}}",
  "threshold": "Defined in rule",
  "actualValue": "{{context.value}}",
  "firedTime": "{{date}}",
  "monitorUrl": "https://your-kibana.com/app/observability/alerts",
  "logs": "{{context.reason}}\n\nMatching documents:\n{{#context.hits}}- {{_source.message}}\n{{/context.hits}}",
  "file": "unknown",
  "line": 0,
  "bugDescription": "Elastic alert: {{rule.name}}"
}
```

## Testing the Integration

### Test Connector

1. Navigate to **Stack Management** → **Connectors**
2. Click on your webhook connector
3. Click **Test**
4. Enter test payload:

```json
{
  "alertName": "test-alert",
  "severity": 1,
  "description": "Test from Elastic",
  "affectedResource": "test-cluster",
  "file": "test.ts",
  "line": 10,
  "bugDescription": "Test",
  "logs": "Test error log"
}
```

5. Click **Run**

### Verify Devin Session

1. Check your endpoint logs
2. Go to [app.devin.ai](https://app.devin.ai) to see the session
3. Verify the alert context was passed correctly

## Index Templates for Better Alerts

Create index templates with structured fields for easier alerting:

```json
PUT _index_template/logs-structured
{
  "index_patterns": ["logs-*"],
  "template": {
    "mappings": {
      "properties": {
        "level": { "type": "keyword" },
        "service": { "type": "keyword" },
        "file": { "type": "keyword" },
        "line": { "type": "integer" },
        "message": { "type": "text" },
        "stack_trace": { "type": "text" },
        "@timestamp": { "type": "date" }
      }
    }
  }
}
```

## Troubleshooting

### Connector Test Fails

1. Check the webhook URL is accessible
2. Verify HTTPS certificate is valid
3. Check for firewall rules blocking Elastic IPs

### Watcher Not Firing

1. Check watcher history: `GET _watcher/watch/devin-triage-watch/_stats`
2. Verify the schedule is correct
3. Check the condition logic with a manual execution

### ML Job Not Detecting Anomalies

1. Ensure enough historical data (2+ weeks recommended)
2. Check the bucket span is appropriate for your data
3. Lower the anomaly threshold if needed

## Best Practices

1. **Use ML for pattern detection** - Better than static thresholds
2. **Set appropriate severities** - Map Elastic severity to your scale
3. **Include context in webhooks** - Send log samples and affected resources
4. **Test connectors regularly** - Ensure they're still working
5. **Use index lifecycle management** - Keep log data for analysis
6. **Create runbooks** - Document expected alert responses

## Elastic vs Azure Monitor

| Feature | Azure Monitor | Elastic |
|---------|--------------|---------|
| ML Anomaly Detection | Limited | Excellent |
| Scheduled Queries | Yes (Log Alerts) | Yes (Watcher) |
| UI-Based Alerting | Action Groups | Alerting Rules |
| Webhook Flexibility | Basic | Advanced (Mustache) |
| Multi-Cloud | Azure Only | Any Cloud |
| Log Analysis | Kusto (KQL) | Lucene/ES DSL |

Both platforms work well with Devin. Choose based on your existing infrastructure.

## Next Steps

- [Configure the Devin Playbook](./DEVIN-PLAYBOOK.md)
- [Set up JIRA integration](./DEVIN-PLAYBOOK.md#phase-5-jira-ticket-creation)
- [Configure Slack notifications](./DEVIN-PLAYBOOK.md#phase-6-slack-notification)
