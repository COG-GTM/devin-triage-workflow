# Azure Elastic + Devin AI Integration Guide

This guide explains how to configure Elastic on Azure with ML anomaly detection to automatically trigger Devin AI for intelligent incident triage and remediation.

## Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Azure Monitor     │────▶│  Elastic on Azure   │────▶│   Elastic Alerting  │
│   (Log Forwarding)  │     │  (Elasticsearch)    │     │   (Watcher/Rules)   │
└─────────────────────┘     └─────────────────────┘     └──────────┬──────────┘
                                                                    │
                                      ┌─────────────────────────────┘
                                      ▼
                            ┌─────────────────────┐     ┌─────────────────────┐
                            │   Webhook Action    │────▶│     Devin API       │
                            │   (HTTP POST)       │     │   /v1/sessions      │
                            └─────────────────────┘     └─────────────────────┘
```

## Why Elastic + Devin?

### Advantages over Azure Monitor Alone

| Capability | Azure Monitor | Elastic on Azure |
|------------|---------------|------------------|
| Log search | KQL queries | Full-text + Lucene |
| Anomaly detection | Basic (preview) | **ML Jobs (mature)** |
| Log retention | Limited | Configurable, long-term |
| Cross-service correlation | Manual | **Automatic** |
| Custom dashboards | Azure Workbooks | **Kibana (powerful)** |
| Alert complexity | Medium | **Advanced (Watcher)** |

### Best Use Cases for Elastic

- **ML Anomaly Detection**: Detect unusual patterns without predefined thresholds
- **Complex Queries**: Correlate events across multiple services
- **Long-term Analysis**: Search months of historical logs
- **Security Events**: SIEM-style threat detection

## Prerequisites

- Azure subscription
- Elastic on Azure resource (or existing Elastic Cloud deployment)
- Devin Enterprise account with API access
- Devin API key

## Step 1: Deploy Elastic on Azure

### Option A: Azure Portal

1. Navigate to **Create a resource** → Search "Elastic"
2. Select **Elastic Cloud (Elasticsearch)**
3. Configure:
   - Resource group
   - Region (same as your apps)
   - Elastic deployment name
   - Plan (Production recommended for ML features)

### Option B: Azure CLI

```bash
az elastic monitor create \
  --name my-elastic-deployment \
  --resource-group rg-monitoring \
  --location eastus \
  --sku-name "ess-consumption-2024_Monthly"
```

**Documentation**: [Create Elastic Resource](https://learn.microsoft.com/en-us/azure/partner-solutions/elastic/create)

## Step 2: Configure Log Forwarding

Route Azure logs to Elastic:

1. Open your Elastic resource in Azure Portal
2. Navigate to **Monitored resources**
3. Enable log forwarding for your resources:
   - Activity logs
   - Resource logs
   - Azure Active Directory logs

**Or via Diagnostic Settings:**

```bash
# Forward to Elastic via Event Hub (recommended for high volume)
az monitor diagnostic-settings create \
  --name "to-elastic" \
  --resource <resource-id> \
  --event-hub <eventhub-name> \
  --event-hub-rule <eventhub-auth-rule-id>
```

## Step 3: Create ML Anomaly Detection Job

This is Elastic's killer feature — detect issues without predefined thresholds.

### 3.1 Access Kibana

1. In Azure Portal, open your Elastic resource
2. Click **Kibana** to launch the dashboard

### 3.2 Create ML Job

1. Navigate to **Machine Learning** → **Anomaly Detection** → **Create job**
2. Select your index pattern (e.g., `logs-*`)
3. Choose job type:

**Single Metric Job** (simple):
```
Field: error.count
Bucket span: 5m
```

**Multi-Metric Job** (recommended):
```yaml
Detectors:
  - function: high_count
    by_field_name: service.name
    partition_field_name: error.type
  - function: high_mean
    field_name: response.time
    by_field_name: api.endpoint
```

**Advanced Job (JSON)**:
```json
{
  "job_id": "customer-portal-anomalies",
  "description": "Detect anomalies in customer portal services",
  "analysis_config": {
    "bucket_span": "5m",
    "detectors": [
      {
        "function": "high_count",
        "field_name": null,
        "by_field_name": "service.name",
        "partition_field_name": "log.level",
        "detector_description": "High error count by service"
      },
      {
        "function": "high_mean",
        "field_name": "event.duration",
        "by_field_name": "http.request.path",
        "detector_description": "High latency by endpoint"
      }
    ],
    "influencers": ["service.name", "host.name", "http.request.path"]
  },
  "data_description": {
    "time_field": "@timestamp"
  }
}
```

4. Start the job and let it learn baseline behavior (1-7 days recommended)

## Step 4: Create Alerting Rule with Webhook

### Option A: Kibana Alerting Rules (Simpler)

1. Navigate to **Stack Management** → **Rules and Connectors**
2. Click **Create rule**
3. Select rule type: **Anomaly detection alert**
4. Configure:
   - ML job: Select your job
   - Severity threshold: 75 (adjust based on needs)
   - Check every: 5 minutes

5. Add action: **Webhook**

**Webhook Configuration:**
```
Method: POST
URL: https://api.devin.ai/v1/sessions
Headers:
  Authorization: Bearer YOUR_DEVIN_API_KEY
  Content-Type: application/json

Body:
{
  "prompt": "ELASTIC ML ANOMALY DETECTED\n\nJob: {{context.jobIds}}\nAnomaly Score: {{context.score}}\nTimestamp: {{context.timestamp}}\n\nTop Influencers:\n{{#context.topInfluencers}}\n- {{influencer_field_name}}: {{influencer_field_value}} (score: {{influencer_score}})\n{{/context.topInfluencers}}\n\nAnalyze the logs around this time, identify root cause, and implement a fix.",
  "repo_url": "https://github.com/your-org/your-repo"
}
```

### Option B: Elastic Watcher (Advanced)

Watcher provides more control over conditions and actions.

```json
PUT _watcher/watch/devin-triage-watch
{
  "trigger": {
    "schedule": {
      "interval": "5m"
    }
  },
  "input": {
    "search": {
      "request": {
        "indices": [".ml-anomalies-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                { "range": { "timestamp": { "gte": "now-10m" } } },
                { "range": { "anomaly_score": { "gte": 75 } } }
              ]
            }
          },
          "sort": [{ "anomaly_score": "desc" }],
          "size": 1
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.hits.total.value": { "gt": 0 }
    }
  },
  "actions": {
    "trigger_devin": {
      "webhook": {
        "method": "POST",
        "url": "https://api.devin.ai/v1/sessions",
        "headers": {
          "Authorization": "Bearer {{ctx.metadata.devin_api_key}}",
          "Content-Type": "application/json"
        },
        "body": {
          "prompt": "ELASTIC ML ANOMALY ALERT\n\nAnomaly Score: {{ctx.payload.hits.hits.0._source.anomaly_score}}\nJob ID: {{ctx.payload.hits.hits.0._source.job_id}}\nDetector: {{ctx.payload.hits.hits.0._source.detector_index}}\nTimestamp: {{ctx.payload.hits.hits.0._source.timestamp}}\n\nPlease analyze the issue and implement a fix.",
          "repo_url": "https://github.com/your-org/your-repo"
        }
      }
    },
    "notify_slack": {
      "slack": {
        "message": {
          "from": "Elastic ML",
          "to": ["#incidents"],
          "text": "Anomaly detected (score: {{ctx.payload.hits.hits.0._source.anomaly_score}}). Devin session initiated."
        }
      }
    }
  },
  "metadata": {
    "devin_api_key": "your-devin-api-key"
  }
}
```

## Step 5: Enhance with Log Context

When Devin needs more context, configure it to query Elasticsearch directly.

### 5.1 Store Elastic Credentials in Devin

1. Go to Devin Settings → Secrets
2. Add:
   - `ELASTIC_CLOUD_ID` - Your Elastic Cloud ID
   - `ELASTIC_API_KEY` - API key for Elasticsearch access

### 5.2 Include Log Samples in Alert

Modify your Watcher to include recent error logs:

```json
"input": {
  "chain": {
    "inputs": [
      {
        "anomaly_check": {
          "search": { /* anomaly query */ }
        }
      },
      {
        "error_logs": {
          "search": {
            "request": {
              "indices": ["logs-*"],
              "body": {
                "query": {
                  "bool": {
                    "must": [
                      { "range": { "@timestamp": { "gte": "now-15m" } } },
                      { "term": { "log.level": "ERROR" } }
                    ]
                  }
                },
                "size": 10,
                "sort": [{ "@timestamp": "desc" }]
              }
            }
          }
        }
      }
    ]
  }
}
```

## ML Job Templates

### Error Rate Anomaly Detection

```json
{
  "job_id": "error-rate-anomaly",
  "analysis_config": {
    "bucket_span": "5m",
    "detectors": [{
      "function": "high_count",
      "partition_field_name": "service.name",
      "by_field_name": "error.type"
    }]
  }
}
```

### Latency Anomaly Detection

```json
{
  "job_id": "latency-anomaly",
  "analysis_config": {
    "bucket_span": "5m",
    "detectors": [{
      "function": "high_mean",
      "field_name": "http.response.time",
      "by_field_name": "http.request.path"
    }]
  }
}
```

### Security Anomaly Detection

```json
{
  "job_id": "security-anomaly",
  "analysis_config": {
    "bucket_span": "15m",
    "detectors": [
      {
        "function": "rare",
        "by_field_name": "source.ip",
        "partition_field_name": "destination.port"
      },
      {
        "function": "high_count",
        "field_name": null,
        "by_field_name": "user.name",
        "partition_field_name": "event.action"
      }
    ]
  }
}
```

## Comparison: Azure Monitor vs Elastic

| Aspect | Azure Monitor | Elastic on Azure |
|--------|---------------|------------------|
| **Setup complexity** | Lower | Higher |
| **ML capabilities** | Basic thresholds | Advanced anomaly detection |
| **Learning period** | None | 1-7 days for ML |
| **False positives** | Manual tuning | Auto-learns baseline |
| **Query language** | KQL | Lucene + ES DSL |
| **Cost** | Per GB + alert rules | Elastic Cloud pricing |
| **Best for** | Simple threshold alerts | Complex pattern detection |

## Recommended Architecture

For production, use both:

```
                    ┌─────────────────────────────────┐
                    │         Azure Monitor           │
                    │   (Real-time threshold alerts)  │
                    └───────────────┬─────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ Direct Webhook  │     │   Elastic on Azure  │     │  Teams/Slack    │
│ (Simple alerts) │     │   (ML + Complex)    │     │  Notifications  │
└────────┬────────┘     └──────────┬──────────┘     └─────────────────┘
         │                         │
         │        ┌────────────────┘
         ▼        ▼
    ┌─────────────────┐
    │   Devin API     │
    │  (Triage + Fix) │
    └─────────────────┘
```

## Links

- [Elastic on Azure Overview](https://learn.microsoft.com/en-us/azure/partner-solutions/elastic/overview)
- [Elastic ML Anomaly Detection](https://www.elastic.co/guide/en/machine-learning/current/ml-ad-overview.html)
- [Elastic Watcher](https://www.elastic.co/guide/en/elasticsearch/reference/current/watcher-api.html)
- [Kibana Alerting](https://www.elastic.co/guide/en/kibana/current/alerting-getting-started.html)
- [Devin API Reference](https://docs.devin.ai/api-reference/overview)
