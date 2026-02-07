# Use Cases & Best Practices

> **When this architecture shines, when it doesn't, and how to configure alerts that add value without creating noise.**

---

## Table of Contents

1. [The Golden Rule](#the-golden-rule)
2. [Ideal Use Cases](#ideal-use-cases-devin-can-fix-it)
3. [Poor Use Cases](#poor-use-cases-devin-cant-fix-it)
4. [Azure Monitor vs Elastic: When to Use Which](#azure-monitor-vs-elastic-when-to-use-which)
5. [Alert Configuration Best Practices](#alert-configuration-best-practices)
6. [Example Alert Configurations](#example-alert-configurations)
7. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## The Golden Rule

**Ask yourself: "Can Devin access the code that caused this issue?"**

| Question | If YES | If NO |
|----------|--------|-------|
| Is the error in YOUR codebase? | ✅ Great fit | ❌ Skip it |
| Can Devin clone the repo? | ✅ Great fit | ❌ Skip it |
| Is this a code/config bug? | ✅ Great fit | ❌ Skip it |
| Is this an external service issue? | ❌ Skip it | — |
| Is this infrastructure/IAM? | ❌ Skip it | — |

**Devin is a software engineer, not a cloud administrator.** It can fix bugs in code, not misconfigured Azure roles or AWS IAM policies.

---

## Ideal Use Cases (Devin CAN Fix It)

These are the scenarios where automated triage delivers real value:

### ✅ 1. Application Code Errors

**What:** Exceptions, null references, type errors in your application code.

**Why it works:** Devin can clone your repo, find the buggy code, understand the context, and write a fix.

**Example alerts:**
- `NullReferenceException in UserService.GetProfile()`
- `TypeError: Cannot read property 'id' of undefined`
- `IndexOutOfBoundsException in DataProcessor.java`

**Best trigger config:**
```kusto
AppExceptions
| where SeverityLevel >= 3
| where ExceptionType !contains "Timeout"  // Exclude transient
| summarize count() by ProblemId, bin(TimeGenerated, 5m)
| where count_ >= 3  // At least 3 occurrences
```

---

### ✅ 2. API Integration Failures (Your Code's Fault)

**What:** Your code failing to properly call external APIs — bad error handling, missing retries, incorrect payloads.

**Why it works:** The bug is in YOUR code's handling of the API, not the external API itself.

**Example alerts:**
- `Failed to parse API response: unexpected token at position 0`
- `HTTP 400 Bad Request when calling /api/users` (your payload is wrong)
- `Retry logic not working for rate-limited requests`

**Best trigger config:**
```kusto
AppTraces
| where Message contains "API" and Message contains "Error"
| where Message !contains "503"  // Exclude external outages
| where Message !contains "timeout"  // Exclude transient network
```

---

### ✅ 3. Authentication Token Handling

**What:** Your code's token refresh logic, credential caching, or auth flow bugs.

**Why it works:** Devin can fix how YOUR code handles tokens — adding retry logic, proper refresh, better error handling.

**Example alerts:**
- `TokenCredentialAuthenticationError: Token expired` (missing refresh logic)
- `AADSTS700024: Client assertion is not within its valid time range`
- `JWT validation failed: token signature invalid` (your verification code)

**Best trigger config:**
```kusto
AppTraces
| where Message contains "Token" or Message contains "AADSTS" or Message contains "JWT"
| where Message contains "Error" or Message contains "failed"
| summarize count() by bin(TimeGenerated, 10m)
| where count_ >= 2
```

---

### ✅ 4. Database Query Errors (Your Queries)

**What:** SQL syntax errors, ORM bugs, query logic issues in your code.

**Why it works:** Devin can fix your queries, add proper parameterization, fix N+1 problems.

**Example alerts:**
- `SqlException: Incorrect syntax near 'WHERE'`
- `QueryException: Column 'user_id' not found`
- `Deadlock detected in transaction` (your transaction logic)

**Best trigger config:**
```kusto
AppExceptions
| where ExceptionType contains "Sql" or ExceptionType contains "Query"
| where OuterMessage !contains "connection timeout"  // Exclude infra
```

---

### ✅ 5. Data Validation & Parsing Errors

**What:** Your code failing to validate or parse input data correctly.

**Why it works:** Devin can add proper validation, fix parsing logic, handle edge cases.

**Example alerts:**
- `JSON parsing error: Unexpected end of input`
- `ValidationError: email must be a valid email address`
- `DateParseException: Invalid date format`

**Best trigger config:**
```kusto
AppExceptions
| where ExceptionType contains "Parse" or ExceptionType contains "Validation"
| where Message !contains "user input"  // Exclude expected user errors
```

---

### ✅ 6. Configuration Errors (Your App's Config)

**What:** Bugs in how your application reads/uses configuration.

**Why it works:** Devin can fix config loading code, add defaults, improve validation.

**Example alerts:**
- `ConfigurationError: Missing required setting 'API_KEY'`
- `Environment variable 'DATABASE_URL' is not set`
- `Invalid configuration: port must be a number`

---

### ✅ 7. Memory Leaks & Resource Management

**What:** Your code not properly releasing resources, causing memory issues.

**Why it works:** Devin can add proper disposal patterns, fix connection leaks, add using statements.

**Example alerts:**
- `OutOfMemoryException in ImageProcessor`
- `Connection pool exhausted` (your code not releasing connections)
- `File handle leak detected`

---

### ✅ 8. Async/Concurrency Bugs

**What:** Race conditions, deadlocks, improper async patterns in your code.

**Why it works:** Devin can fix async/await patterns, add proper locking, fix race conditions.

**Example alerts:**
- `Task was canceled unexpectedly`
- `Deadlock detected: Thread A waiting for Thread B`
- `ConcurrentModificationException`

---

## Poor Use Cases (Devin CAN'T Fix It)

These alerts waste Devin sessions because the fix isn't in your codebase:

### ❌ 1. Cloud IAM & Permissions

**What:** Azure AD, AWS IAM, GCP IAM role/permission issues.

**Why it fails:** Devin can't modify your Azure AD configuration or IAM policies — that requires portal access, not code.

**Examples to AVOID alerting on:**
- `AuthorizationFailed: User does not have permission`
- `AccessDenied: User is not authorized to perform sts:AssumeRole`
- `AADSTS50076: User needs to use MFA` (user/policy issue, not code)

**What to do instead:** Alert your ops team directly, not Devin.

---

### ❌ 2. Infrastructure Failures

**What:** VM crashes, disk full, network outages, Kubernetes node failures.

**Why it fails:** Devin can't provision infrastructure, resize disks, or restart VMs.

**Examples to AVOID alerting on:**
- `Node not ready: NodeHasDiskPressure`
- `Pod evicted due to memory pressure`
- `Connection refused: 10.0.0.5:5432` (network/infra issue)
- `Disk space below 10%`

**What to do instead:** Use Azure Autoscale, PagerDuty, or ops runbooks.

---

### ❌ 3. External Service Outages

**What:** Third-party APIs being down or degraded.

**Why it fails:** Devin can't fix Stripe's API, AWS S3, or Twilio being down.

**Examples to AVOID alerting on:**
- `HTTP 503 from api.stripe.com`
- `Timeout connecting to s3.amazonaws.com`
- `SendGrid API returned 500`

**What to do instead:** 
- Monitor with status pages (statuspage.io)
- Implement circuit breakers in YOUR code (Devin CAN help with this!)

---

### ❌ 4. Database Infrastructure Issues

**What:** Database server down, replication lag, connection limits.

**Why it fails:** Devin can't restart your RDS instance or increase connection limits.

**Examples to AVOID alerting on:**
- `Cannot connect to database server`
- `Too many connections` (server config, not code)
- `Replication lag exceeds 60 seconds`

**What to do instead:** Alert your DBA or use managed database alerting.

---

### ❌ 5. Certificate & TLS Issues

**What:** Expired certificates, TLS handshake failures.

**Why it fails:** Devin can't renew your SSL certificates or update your load balancer.

**Examples to AVOID alerting on:**
- `SSL certificate has expired`
- `TLS handshake failed: certificate verify failed`
- `Unable to verify the first certificate`

**What to do instead:** Use cert-manager, Let's Encrypt auto-renewal, or ops alerts.

---

### ❌ 6. Rate Limiting (External Services)

**What:** Being rate-limited by external APIs.

**Why it fails:** You can't code your way out of hitting someone else's rate limit.

**Examples to AVOID alerting on:**
- `HTTP 429 Too Many Requests from api.github.com`
- `Rate limit exceeded for OpenAI API`

**What to do instead:** 
- Implement backoff/retry in your code (Devin CAN help here)
- Request higher rate limits from the provider

---

### ❌ 7. User-Caused Errors

**What:** Users entering invalid data, making bad requests.

**Why it fails:** This isn't a bug — it's expected user behavior.

**Examples to AVOID alerting on:**
- `Validation failed: password too short` (user's fault)
- `HTTP 400: Invalid email format` (expected behavior)
- `Login failed: incorrect password`

**What to do instead:** Log for analytics, don't alert.

---

## Azure Monitor vs Elastic: When to Use Which

### Use Azure Monitor When:

| Scenario | Why Azure Monitor |
|----------|-------------------|
| **Azure-native apps** (AKS, App Service) | Zero-config metrics already flowing |
| **Simple threshold alerts** | "Errors > 0" is easy to set up |
| **Quick wins** | 15-minute setup time |
| **Cost matters** | Often included in Azure subscription |
| **Application Insights** | Built-in exception tracking |

**Best Azure Monitor triggers for Devin:**
- Application Insights exceptions (your code)
- Log Analytics custom queries (your logs)
- App Service errors (your app)

**Avoid these Azure Monitor triggers:**
- Activity Log alerts (infrastructure changes)
- Resource Health alerts (Azure's problem)
- Service Health alerts (Azure outages)

---

### Use Elastic When:

| Scenario | Why Elastic |
|----------|-------------|
| **Multi-cloud environment** | Logs from any cloud in one place |
| **Complex log correlation** | Trace errors across microservices |
| **ML anomaly detection** | "Something unusual is happening" |
| **Security/SIEM** | Compliance, audit, threat detection |
| **Custom log formats** | Parse any log structure |

**Best Elastic triggers for Devin:**
- Log threshold rules (error count spike)
- ML anomaly detection (unusual error patterns)
- Cross-service correlation (trace an error's origin)

**Avoid these Elastic triggers:**
- Infrastructure metrics (CPU, memory, disk)
- Security alerts (handle with SIEM workflow)
- Uptime/availability (external service status)

---

## Alert Configuration Best Practices

### 1. Threshold Tuning: Avoid the Noise

| Bad Config | Problem | Better Config |
|------------|---------|---------------|
| Alert on ANY error | Devin sessions for every 404 | Alert on error SPIKES |
| Single occurrence | Transient issues create noise | Require 3+ occurrences in 5 min |
| All severity levels | Info logs triggering Devin | Sev 1-2 only (Error, Critical) |
| No deduplication | Same bug = 50 Devin sessions | Group by error signature |

### 2. Time Window Configuration

```
┌─────────────────────────────────────────────────────────────┐
│                    Alert Timing Strategy                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Too Fast (1 min)     Just Right (5-10 min)    Too Slow   │
│   ┌─────────────┐      ┌─────────────────┐      (30+ min)  │
│   │ Noisy       │      │ ✅ Captures      │      ┌───────┐ │
│   │ Transient   │      │   real issues    │      │Delayed│ │
│   │ issues      │      │ ✅ Filters noise │      │ alert │ │
│   └─────────────┘      └─────────────────┘      └───────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Recommended:**
- Evaluation frequency: **5 minutes**
- Lookback window: **5-10 minutes**
- Minimum occurrences: **3+**

### 3. Severity Routing

| Severity | Action | Devin? |
|----------|--------|--------|
| **Sev 0 (Critical)** | Page on-call + Devin | ✅ Yes |
| **Sev 1 (Error)** | Devin + Slack | ✅ Yes |
| **Sev 2 (Warning)** | Log only | ❌ No |
| **Sev 3 (Info)** | Ignore | ❌ No |

### 4. Deduplication Strategy

Prevent the same bug from creating 100 Devin sessions:

```kusto
// Azure Monitor - Dedupe by error signature
AppExceptions
| summarize 
    count(), 
    FirstSeen = min(TimeGenerated),
    LastSeen = max(TimeGenerated)
  by ProblemId, OuterMessage
| where count_ >= 3
| where FirstSeen > ago(10m)  // Only new issues
```

---

## Example Alert Configurations

### High-Value Alert: Application Exceptions (Azure Monitor)

```kusto
// Catches real bugs, filters noise
AppExceptions
| where SeverityLevel >= 3  // Error or Critical only
| where ExceptionType !in (
    "TaskCanceledException",      // Often transient
    "OperationCanceledException", // User cancelled
    "HttpRequestException"        // Network blips
)
| where OuterMessage !contains "timeout"  // Transient
| where OuterMessage !contains "404"      // Expected
| summarize 
    ErrorCount = count(),
    SampleMessage = any(OuterMessage)
  by ProblemId, ExceptionType, bin(TimeGenerated, 5m)
| where ErrorCount >= 3  // At least 3 in 5 minutes
```

**Why this works:**
- Filters transient/expected errors
- Requires multiple occurrences
- Groups by problem ID (deduplication)

---

### High-Value Alert: Auth Token Failures (Azure Monitor)

```kusto
// Your token handling code is broken
AppTraces
| where Message contains "Token" or Message contains "AADSTS"
| where Message contains "Error" or Message contains "fail" or Message contains "expired"
| where Message !contains "MFA"  // User issue, not code
| where Message !contains "password"  // User issue
| summarize count() by bin(TimeGenerated, 10m)
| where count_ >= 2
```

---

### High-Value Alert: API Integration Errors (Elastic)

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "log.level": "error" } },
        { "match_phrase": { "message": "API" } }
      ],
      "must_not": [
        { "match": { "message": "503" } },
        { "match": { "message": "timeout" } },
        { "match": { "message": "rate limit" } }
      ]
    }
  }
}
```

---

### High-Value Alert: Database Query Errors (Elastic)

```json
{
  "query": {
    "bool": {
      "must": [
        { 
          "bool": {
            "should": [
              { "match": { "exception.type": "SqlException" } },
              { "match": { "exception.type": "QueryException" } }
            ]
          }
        }
      ],
      "must_not": [
        { "match": { "message": "connection" } },
        { "match": { "message": "timeout" } }
      ]
    }
  }
}
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: "Alert on Everything"

**What happens:** 50 Devin sessions per hour, all for the same bug or transient issues.

**Fix:** Add thresholds, deduplication, and severity filters.

---

### ❌ Anti-Pattern 2: "Infrastructure Alerts to Devin"

**What happens:** Devin creates sessions for "disk full" and produces useless PRs.

**Fix:** Route infrastructure alerts to ops, not Devin.

---

### ❌ Anti-Pattern 3: "No Repo Context"

**What happens:** Alert fires but Devin doesn't know which repo to analyze.

**Fix:** Always configure `TARGET_REPO` and include relevant context in alert payload.

---

### ❌ Anti-Pattern 4: "External Service Failures"

**What happens:** Stripe goes down, Devin creates 20 sessions trying to "fix" it.

**Fix:** Filter out external service errors (503s, timeouts from third parties).

---

### ❌ Anti-Pattern 5: "User Input Validation"

**What happens:** Every `400 Bad Request` from user typos triggers Devin.

**Fix:** Don't alert on expected validation failures.

---

## Decision Flowchart

```
                    Alert Fires
                         │
                         ▼
              ┌─────────────────────┐
              │ Is the error in     │
              │ YOUR codebase?      │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
            YES                    NO
              │                     │
              ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ Can Devin clone │   │ Route to ops    │
    │ the repo?       │   │ team instead    │
    └────────┬────────┘   └─────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
   YES               NO
    │                 │
    ▼                 ▼
┌─────────────┐  ┌─────────────────┐
│ Is this a   │  │ Fix repo access │
│ code bug?   │  │ first           │
└──────┬──────┘  └─────────────────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
 YES       NO (infra/external)
  │         │
  ▼         ▼
┌─────────────┐  ┌─────────────────┐
│ ✅ TRIGGER  │  │ Route to ops    │
│   DEVIN     │  │ team instead    │
└─────────────┘  └─────────────────┘
```

---

## Summary: The Sweet Spot

| Trigger Devin When | Don't Trigger Devin When |
|--------------------|--------------------------|
| Application exceptions (your code) | Infrastructure failures |
| API integration bugs (your handling) | External service outages |
| Token refresh logic failures | IAM/permission issues |
| Database query bugs (your queries) | Database server issues |
| Config loading bugs | Certificate expiration |
| Memory leaks in your code | Resource exhaustion (VM) |
| Async/concurrency bugs | User input validation |

**The golden rule:** If Devin can open a PR to fix it, alert. If not, don't.

---

## Next Steps

- [Azure Monitor Setup](./AZURE-MONITOR-SETUP.md) — Configure Azure alerts with these best practices
- [Elastic Setup](./ELASTIC-SETUP.md) — Configure Elastic alerts with these best practices
- [Devin Playbook](./DEVIN-PLAYBOOK.md) — How Devin triages once triggered
