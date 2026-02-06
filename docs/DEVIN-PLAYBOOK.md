# Devin Triage Playbook

> **The 7-phase methodology Devin follows when triaging production alerts.**

This playbook is the "brain" of the automated triage system. It defines exactly how Devin analyzes alerts, identifies root causes, and implements fixes.

---

## Table of Contents

1. [Overview](#overview)
2. [Creating a Playbook in Devin](#creating-a-playbook-in-devin)
3. [Phase 1: Alert Analysis](#phase-1-alert-analysis)
4. [Phase 2: Codebase Analysis](#phase-2-codebase-analysis)
5. [Phase 3: Triage Decision](#phase-3-triage-decision)
6. [Phase 4: Implement Fix](#phase-4-implement-fix)
7. [Phase 5: JIRA Ticket](#phase-5-jira-ticket)
8. [Phase 6: Slack Notification](#phase-6-slack-notification)
9. [Phase 7: Wrap Up](#phase-7-wrap-up)
10. [Full Playbook Template](#full-playbook-template)
11. [Customization Examples](#customization-examples)

---

## Overview

When an alert fires, Devin receives context about the issue and follows this structured approach:

```
┌─────────────────┐
│  Alert Fires    │
│  (Webhook)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 1: Analyze│◀─── Parse alert, understand symptoms
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 2: Code   │◀─── Clone repo, trace error, find root cause
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 3: Decide │◀─── Code fix? Config? External? Escalate?
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Fix   │ │ Doc   │
│ Code  │ │ Only  │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Phase 4: PR     │◀─── Create Pull Request with fix
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 5: JIRA   │◀─── Create tracking ticket
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 6: Slack  │◀─── Notify team
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Phase 7: Wrap   │◀─── Final summary
└─────────────────┘
```

---

## Creating a Playbook in Devin

### Step 1: Navigate to Playbooks

**Direct Link:** [https://app.devin.ai/playbooks](https://app.devin.ai/playbooks)

Or manually:
1. Go to [app.devin.ai](https://app.devin.ai)
2. Click your **profile icon** (top right)
3. Select **Settings**
4. Click **Playbooks** in the sidebar

![Devin Playbooks Navigation](./images/devin-playbooks-nav.png)

### Step 2: Create New Playbook

1. Click **+ Create Playbook**
2. Enter a name: `Production Alert Triage`
3. Paste the playbook content (see [Full Playbook Template](#full-playbook-template))
4. Click **Save**

![Create Playbook](./images/devin-create-playbook.png)

### Step 3: Associate with API Key

For the playbook to run automatically:

1. Go to **Settings** → **API Keys**
2. Click on your API key (e.g., `Azure Monitor Triage`)
3. Under **Default Playbook**, select `Production Alert Triage`
4. Click **Save**

Now every session from that API key will follow your playbook!

![Associate Playbook](./images/devin-associate-playbook.png)

---

## Phase 1: Alert Analysis

**Goal:** Understand what happened and the impact.

### 1.1 Parse Alert Context

```markdown
## Phase 1: Alert Analysis

First, I'll analyze the alert details provided:

### Alert Information
- **Alert Name**: {{alertName}}
- **Severity**: {{severity}}
- **Description**: {{description}}
- **Affected Resource**: {{affectedResource}}
- **Signal Type**: {{signalType}}
- **Fired Time**: {{firedTime}}
```

### 1.2 Analyze Error Logs

```markdown
### Error Logs
\`\`\`
{{logs}}
\`\`\`

### Initial Observations
- **Error Type**: [Identify: Auth/Network/Logic/Data]
- **Error Location**: [File and line if available]
- **User Impact**: [None/Degraded/Outage]
- **Blast Radius**: [Single user/All users/Backend only]
```

### 1.3 Document Initial Assessment

```markdown
### Initial Assessment
| Aspect | Finding |
|--------|---------|
| Immediate symptom | [What's broken] |
| Likely root cause | [First hypothesis] |
| User impact | [Scope of impact] |
| Urgency | [P1/P2/P3] |
```

---

## Phase 2: Codebase Analysis

**Goal:** Find the exact source of the problem.

### 2.1 Clone Repository

```markdown
## Phase 2: Codebase Analysis

### Cloning Repository
\`\`\`bash
git clone {{targetRepo}}
cd {{repoName}}
\`\`\`
```

### 2.2 Locate the Bug

```markdown
### Searching for Error Location

Based on the stack trace, I'll locate the problematic code:

\`\`\`bash
# Search for the error message
grep -r "TokenCredentialAuthenticationError" --include="*.ts" src/

# Search for the file mentioned in stack trace
cat src/tools/auth.ts
\`\`\`
```

### 2.3 Trace the Stack

```markdown
### Stack Trace Analysis

\`\`\`
Error: TokenCredentialAuthenticationError
    at DefaultAzureCredential.getToken (src/credentials.ts:89)
    at getCurrentUserDetails (src/tools/auth.ts:14)  ◀── Root cause here
    at processRequest (src/server.ts:156)
\`\`\`

The error originates at `src/tools/auth.ts:14` where `getToken()` is called
without proper error handling for expired tokens.
```

### 2.4 Identify Root Cause

```markdown
### Root Cause Identified

| Aspect | Details |
|--------|---------|
| **Root Cause** | Token refresh not handling AADSTS700024 error |
| **File** | `src/tools/auth.ts` |
| **Line** | 14 |
| **Missing** | Retry logic with token refresh on expiry |
| **Related Files** | `src/credentials.ts`, `src/server.ts` |
```

---

## Phase 3: Triage Decision

**Goal:** Choose the right path forward.

### Decision Tree

```markdown
## Phase 3: Triage Decision

### Decision Matrix

| Condition | Action |
|-----------|--------|
| Clear code bug with obvious fix | → **Code Fix** (Phase 4) |
| Configuration/environment issue | → **Config Change** + Document |
| External service issue | → **External Issue** + Alert owner |
| Complex issue needing review | → **Escalate** to human |
| Ambiguous root cause | → **More Investigation** needed |

### My Decision: **Code Fix**

Reasoning:
- Root cause is clearly identified in `auth.ts:14`
- Fix is straightforward: add retry logic for token expiry
- Low risk: isolated change with clear test cases
- High confidence: seen this pattern before
```

### Escalation Criteria

```markdown
### When to Escalate (Not Auto-Fix)

Escalate to human if ANY of these apply:
- [ ] Change affects payment/billing code
- [ ] Change modifies authentication flow
- [ ] Change touches >3 files
- [ ] Unsure about backward compatibility
- [ ] Production data could be affected
- [ ] Security implications unclear
```

---

## Phase 4: Implement Fix

**Goal:** Create a minimal, tested fix.

### 4.1 Create the Fix

```markdown
## Phase 4: Implement Fix

### Fix Implementation

**File: `src/tools/auth.ts`**

\`\`\`typescript
// BEFORE (vulnerable to token expiry)
async function getCurrentUserDetails() {
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken(scope); // ❌ No retry
  return await fetchUserDetails(token);
}

// AFTER (with retry logic)
async function getCurrentUserDetails(retries = 3): Promise<UserDetails> {
  const credential = new DefaultAzureCredential();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const token = await credential.getToken(scope);
      return await fetchUserDetails(token);
    } catch (error) {
      if (isTokenExpiredError(error) && attempt < retries) {
        console.log(\`Token expired, refreshing (attempt \${attempt}/\${retries})\`);
        await credential.refreshToken(); // Force refresh
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to get user details after retries');
}

function isTokenExpiredError(error: unknown): boolean {
  return error instanceof Error && 
    (error.message.includes('AADSTS700024') ||
     error.message.includes('token has expired'));
}
\`\`\`
```

### 4.2 Add Error Handling

```markdown
### Error Handling Added

\`\`\`typescript
// Added helper function for error classification
function isTokenExpiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const expiredPatterns = [
    'AADSTS700024',
    'token has expired',
    'TokenCredentialAuthenticationError'
  ];
  return expiredPatterns.some(p => error.message.includes(p));
}
\`\`\`
```

### 4.3 Write Tests

```markdown
### Tests Added

**File: `src/tools/auth.test.ts`**

\`\`\`typescript
describe('getCurrentUserDetails', () => {
  it('should retry on token expiration', async () => {
    const mockCredential = {
      getToken: jest.fn()
        .mockRejectedValueOnce(new Error('AADSTS700024'))
        .mockResolvedValueOnce({ token: 'new-token' }),
      refreshToken: jest.fn()
    };
    
    const result = await getCurrentUserDetails();
    
    expect(mockCredential.getToken).toHaveBeenCalledTimes(2);
    expect(mockCredential.refreshToken).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it('should throw after max retries', async () => {
    const mockCredential = {
      getToken: jest.fn().mockRejectedValue(new Error('AADSTS700024'))
    };
    
    await expect(getCurrentUserDetails()).rejects.toThrow('Failed to get user details');
  });
});
\`\`\`
```

### 4.4 Create Pull Request

```markdown
### Pull Request Created

**Title:** fix(auth): Add retry logic for expired Azure AD tokens

**Description:**
## Problem
Azure AD tokens were expiring without proper refresh handling, causing
TokenCredentialAuthenticationError failures in production.

## Root Cause
The `getCurrentUserDetails` function in `auth.ts` didn't handle the
AADSTS700024 error code that indicates an expired token.

## Solution
- Added retry logic with exponential backoff
- Added `isTokenExpiredError` helper for error classification
- Force token refresh on expiry detection
- Added comprehensive test coverage

## Testing
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manually verified token refresh flow

## Alert Reference
- Alert: {{alertName}}
- Devin Session: {{sessionUrl}}

---
Fixes #{{issueNumber}} if applicable
\`\`\`
```

---

## Phase 5: JIRA Ticket

**Goal:** Create a tracking ticket with full context.

### 5.1 Ticket Template

```markdown
## Phase 5: JIRA Ticket Creation

### Creating Ticket in {{jiraProject}}

**Summary:** [{{severity}}] {{alertName}} - {{shortDescription}}

**Description:**
{code}
## Alert Details
| Field | Value |
|-------|-------|
| Alert Name | {{alertName}} |
| Severity | Sev {{severity}} |
| Fired Time | {{firedTime}} |
| Affected Resource | {{affectedResource}} |

## Root Cause
{{rootCauseDescription}}

## Fix
- **PR:** {{prUrl}}
- **Files Changed:** {{filesChanged}}

## Links
- **Devin Session:** {{sessionUrl}}
- **Azure Alert:** {{alertUrl}}
- **Logs:** {{logsUrl}}
{code}

**Issue Type:** Bug
**Priority:** {{priority}}
**Labels:** devin-triage, auto-generated, {{source}}
**Components:** {{component}}
```

### 5.2 JIRA API Integration

```markdown
### JIRA API Call

\`\`\`bash
curl -X POST "https://your-org.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic {{jiraAuth}}" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": { "key": "{{jiraProject}}" },
      "summary": "[Sev{{severity}}] {{alertName}}",
      "description": "...",
      "issuetype": { "name": "Bug" },
      "priority": { "name": "{{priority}}" },
      "labels": ["devin-triage", "auto-generated"]
    }
  }'
\`\`\`
```

---

## Phase 6: Slack Notification

**Goal:** Alert the team with actionable links.

### 6.1 Notification Template

```markdown
## Phase 6: Slack Notification

### Posting to {{slackChannel}}

\`\`\`json
{
  "channel": "{{slackChannel}}",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔧 Alert Auto-Triaged: {{alertName}}"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Severity:*\nSev {{severity}}" },
        { "type": "mrkdwn", "text": "*Status:*\n✅ PR Created" }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Root Cause:* {{rootCauseSummary}}"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View PR" },
          "url": "{{prUrl}}"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "JIRA Ticket" },
          "url": "{{jiraUrl}}"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Devin Session" },
          "url": "{{sessionUrl}}"
        }
      ]
    }
  ]
}
\`\`\`
```

---

## Phase 7: Wrap Up

**Goal:** Final summary and recommendations.

### 7.1 Session Summary

```markdown
## Phase 7: Wrap Up

### Triage Summary

| Outcome | Details |
|---------|---------|
| **Alert** | {{alertName}} |
| **Root Cause** | {{rootCauseOneLiner}} |
| **Resolution** | Code fix with PR |
| **PR** | {{prUrl}} |
| **JIRA** | {{jiraUrl}} |
| **Time to Resolution** | {{elapsedTime}} |

### Artifacts Created
1. ✅ Pull Request: {{prUrl}}
2. ✅ JIRA Ticket: {{jiraUrl}}
3. ✅ Slack Notification: Sent to {{slackChannel}}
4. ✅ Test Coverage: 2 new tests added

### Recommendations
1. **Merge the PR** after review
2. **Monitor** the fix in production for 24h
3. **Consider** adding similar retry logic to other API calls
4. **Update runbook** with this failure mode

### Session Complete ✅
```

---

## Full Playbook Template

Copy this entire template into your Devin playbook:

```markdown
# Production Alert Triage Playbook

You are an expert SRE triaging a production alert. Follow these phases precisely.

## Context Provided
- Alert Name: {{alertName}}
- Severity: {{severity}}
- Description: {{description}}
- Repository: {{targetRepo}}
- Logs: {{logs}}

---

## Phase 1: Alert Analysis

Parse the alert and document:
1. What is the immediate symptom?
2. What is the likely root cause?
3. What is the user impact?
4. What is the urgency level?

---

## Phase 2: Codebase Analysis

1. Clone the repository
2. Search for the error in the codebase
3. Trace the stack to find the root cause
4. Document the exact file and line

---

## Phase 3: Triage Decision

Decide:
- **Code Fix**: Clear bug with straightforward fix → Proceed to Phase 4
- **Config Issue**: Environment/config problem → Document and notify
- **External Issue**: Third-party service problem → Document and notify owner
- **Escalate**: Complex/risky/unclear → Create ticket and notify human

---

## Phase 4: Implement Fix (if Code Fix)

1. Create a minimal fix
2. Add proper error handling
3. Write unit tests
4. Create a Pull Request with:
   - Clear title: `fix(component): description`
   - Problem and solution description
   - Testing checklist
   - Link to this session

---

## Phase 5: JIRA Ticket

Create a JIRA ticket with:
- Summary: [Sev{{severity}}] {{alertName}}
- Description: Full context, root cause, fix details
- Links: PR, session, logs
- Labels: devin-triage, auto-generated

---

## Phase 6: Slack Notification

Post to {{slackChannel}}:
- Alert name and severity
- Root cause summary
- Links: PR, JIRA, Session

---

## Phase 7: Wrap Up

Provide final summary:
- What was the issue?
- What was the fix?
- What artifacts were created?
- What are the recommendations?

---

Begin triage now.
```

---

## Customization Examples

### Security-Focused Playbook

```markdown
## Additional Security Checks

Before implementing any fix:
1. [ ] Check if fix introduces new attack vectors
2. [ ] Verify no secrets are logged
3. [ ] Ensure proper input validation
4. [ ] Check for SQL injection if DB-related
5. [ ] If auth-related, escalate to security team
```

### Performance-Focused Playbook

```markdown
## Performance Analysis Phase

If the alert is latency-related:
1. Check for N+1 queries
2. Look for missing indexes
3. Check for synchronous external calls
4. Profile memory usage
5. Check cache hit rates
```

### Minimal Playbook (No Integrations)

```markdown
# Minimal Triage Playbook

1. Analyze the alert
2. Clone the repo
3. Find the root cause
4. Create a fix with tests
5. Create a Pull Request

No JIRA or Slack required.
```

---

## Devin Documentation Links

| Resource | Link |
|----------|------|
| Playbooks Guide | [docs.devin.ai/playbooks](https://docs.devin.ai/playbooks) |
| Session API | [docs.devin.ai/api-reference](https://docs.devin.ai/api-reference) |
| Best Practices | [docs.devin.ai/best-practices](https://docs.devin.ai/best-practices) |
| Devin App | [app.devin.ai](https://app.devin.ai) |

---

## Next Steps

- [Azure Monitor Setup](./AZURE-MONITOR-SETUP.md) — Connect Azure alerts
- [Elastic Setup](./ELASTIC-SETUP.md) — Connect Elastic alerts
- [API Reference](./API-REFERENCE.md) — Webhook endpoint details
