# Automated Alert Triage Playbook

## Overview
This playbook is triggered automatically when an alert fires from Azure Monitor, Elastic, or any observability platform. You will analyze, triage, and remediate production issues with full traceability.

---

## Phase 1: Alert Analysis

### 1.1 Parse the Alert Context
Extract and understand:
- **Alert Name**: What triggered?
- **Severity**: Sev 0-4 (Critical to Verbose)
- **Affected Resource**: Which service/pod/cluster?
- **Signal Type**: Log-based or Metric-based alert?
- **Fired Time**: When did this start?
- **Error Logs**: What's in the stack trace?

### 1.2 Understand the Failure
Ask yourself:
- What is the immediate symptom?
- What is the user impact?
- Is this a new issue or recurring?
- What changed recently (deployments, config)?

### 1.3 Document Initial Assessment
Create a structured summary:
```
## Initial Assessment
- **Issue**: [one-line description]
- **Impact**: [user/business impact]
- **Urgency**: [immediate/high/medium/low]
- **Category**: [auth/timeout/null-ref/config/infra/unknown]
```

---

## Phase 2: Codebase Analysis

### 2.1 Clone and Navigate
```bash
git clone <repo_url>
cd <repo_name>
```

### 2.2 Locate the Problem
Using the file and line number from the alert:
1. Open the suspected file
2. Read the surrounding context (50 lines before/after)
3. Trace the call stack from the error
4. Identify the root cause

### 2.3 Classify the Issue

**Code Issue** (you should fix):
- Missing null checks
- Unhandled exceptions
- Logic errors
- Missing timeout configurations
- Race conditions

**Configuration Issue** (document and escalate):
- Environment variables
- Secrets/credentials
- Infrastructure settings
- External service configuration

**External Issue** (document only):
- Third-party API failures
- Infrastructure outages
- Network issues
- Rate limiting

### 2.4 Document Findings
```
## Root Cause Analysis
- **Location**: [file:line]
- **Root Cause**: [detailed explanation]
- **Category**: [code/config/external]
- **Fixable by Devin**: [yes/no]
```

---

## Phase 3: Triage Decision Tree

Based on your analysis, take ONE of these paths:

### Path A: Code Fix Required
If the issue is fixable in code:
1. Implement the fix
2. Add error handling
3. Add logging for observability
4. Write unit tests
5. Create a PR

### Path B: Configuration Issue
If it's a config problem:
1. Document the required change
2. Identify who can make the change
3. Create detailed remediation steps
4. Do NOT attempt to fix secrets/infra

### Path C: External/Transient Issue
If it's external or will self-resolve:
1. Document the external dependency
2. Note any retry logic that exists
3. Recommend resilience improvements
4. No immediate code change needed

### Path D: Needs Human Review
If you're uncertain:
1. Document all findings
2. List possible causes
3. Recommend investigation steps
4. Flag for human review

---

## Phase 4: Implement Fix (Path A Only)

### 4.1 Code Changes
Follow these principles:
- **Minimal change**: Fix only what's broken
- **Defensive coding**: Add null checks, error handling
- **Observability**: Add structured logging
- **Backwards compatible**: Don't break existing behavior

### 4.2 Testing
```bash
# Run existing tests
npm test

# Run specific test file if exists
npm test -- --grep "<related_test>"
```

### 4.3 Create Pull Request
PR Title format:
```
fix(<area>): <short description> [AUTO-TRIAGE]
```

PR Body must include:
```markdown
## Alert Triggered
- **Alert**: <alert_name>
- **Severity**: <sev_level>
- **Fired**: <timestamp>

## Root Cause
<explanation of what went wrong>

## Changes Made
- <change 1>
- <change 2>

## Testing
- [ ] Unit tests pass
- [ ] Manual verification done

## Monitoring
After merge, monitor:
- <metric_1>
- <metric_2>

---
*This PR was created automatically by Devin AI Triage*
*Session: <devin_session_url>*
```

---

## Phase 5: JIRA Ticket Creation

### 5.1 Connect to JIRA
Use the JIRA MCP server to create a ticket.

### 5.2 Ticket Structure

**For Code Fixes (with PR):**
```
Summary: [AUTO-TRIAGE] <alert_name> - <one-line fix description>

Description:
h2. Alert Details
* *Alert Name*: <alert_name>
* *Severity*: Sev <level>
* *Fired At*: <timestamp>
* *Affected Resource*: <resource>

h2. Root Cause
<detailed explanation>

h2. Resolution
* *Status*: Fixed
* *PR*: <pr_url>
* *Devin Session*: <session_url>

h2. Error Logs
{code}
<relevant logs>
{code}

h2. Timeline
| Time | Event |
| <t1> | Alert fired |
| <t2> | Devin session started |
| <t3> | Root cause identified |
| <t4> | Fix implemented |
| <t5> | PR created |

Labels: auto-triage, devin, <severity>
Priority: <based on severity>
```

**For Non-Code Issues:**
```
Summary: [AUTO-TRIAGE] <alert_name> - Investigation Required

Description:
h2. Alert Details
* *Alert Name*: <alert_name>
* *Severity*: Sev <level>

h2. Analysis
<what was found>

h2. Recommended Action
<what humans should do>

h2. Devin Session
<session_url>

Labels: auto-triage, needs-review, <category>
```

### 5.3 JIRA Fields
- **Project**: Use the project associated with the affected service
- **Issue Type**: Bug (for code issues) or Task (for investigation)
- **Priority**: Map from severity (Sev0=Highest, Sev1=High, Sev2=Medium)
- **Labels**: `auto-triage`, `devin`, severity label, category label
- **Components**: Based on affected service

---

## Phase 6: Slack Notification

### 6.1 Post to Slack Channel

Send a structured message to the alerts/incidents channel:

**For Successful Fix:**
```
🔧 *Auto-Triage Complete: <alert_name>*

*Status*: ✅ Fixed - PR Created
*Severity*: Sev <level>
*Root Cause*: <one-line summary>

📋 *JIRA*: <ticket_url>
🔀 *PR*: <pr_url>
🤖 *Devin Session*: <session_url>

_Fix will be deployed after PR review and merge._
```

**For Investigation Required:**
```
🔍 *Auto-Triage Complete: <alert_name>*

*Status*: ⚠️ Needs Human Review
*Severity*: Sev <level>
*Finding*: <one-line summary>

📋 *JIRA*: <ticket_url>
🤖 *Devin Session*: <session_url>

_Please review the JIRA ticket for details and next steps._
```

**For External Issue:**
```
📡 *Auto-Triage Complete: <alert_name>*

*Status*: ℹ️ External Issue Identified
*Severity*: Sev <level>
*Cause*: <external dependency>

📋 *JIRA*: <ticket_url>
🤖 *Devin Session*: <session_url>

_No code changes required. Monitoring for resolution._
```

---

## Phase 7: Session Wrap-up

### 7.1 Final Summary
Before ending the session, provide:

```
## Triage Summary

### Alert
- Name: <alert_name>
- Severity: <level>
- Fired: <timestamp>

### Analysis
- Root Cause: <explanation>
- Category: <code/config/external>

### Actions Taken
1. <action 1>
2. <action 2>
3. <action 3>

### Artifacts Created
- JIRA: <ticket_url>
- PR: <pr_url or N/A>
- Slack: Posted to #<channel>

### Recommendations
- <any follow-up recommendations>

### Session Duration
- Started: <start_time>
- Completed: <end_time>
- Total: <duration>
```

### 7.2 End Session
Mark the session as complete.

---

## MCP Server Connections

This playbook requires the following MCP servers:

### JIRA MCP Server
- **Purpose**: Create and update JIRA tickets
- **Actions**: `create_issue`, `update_issue`, `add_comment`
- **Config**: Requires JIRA API token and project access

### Slack MCP Server (or Webhook)
- **Purpose**: Post notifications to Slack channels
- **Actions**: `post_message`
- **Config**: Requires Slack webhook URL or bot token

### GitHub MCP Server
- **Purpose**: Create PRs, read code
- **Actions**: `create_pull_request`, `read_file`, `list_files`
- **Config**: Requires GitHub token with repo access

---

## Error Handling

If any step fails:

1. **Log the failure** with context
2. **Continue to next phase** if possible
3. **Always create JIRA ticket** even if partial
4. **Always notify Slack** even if partial
5. **Include error details** in the summary

Never silently fail. Always leave a trace.

---

## Severity Response Guidelines

| Severity | Response Time | JIRA Priority | Slack Channel | Auto-merge |
|----------|--------------|---------------|---------------|------------|
| Sev 0    | Immediate    | Highest       | #incidents    | No         |
| Sev 1    | < 30 min     | High          | #alerts       | No         |
| Sev 2    | < 2 hours    | Medium        | #alerts       | No         |
| Sev 3    | < 24 hours   | Low           | #monitoring   | Optional   |
| Sev 4    | Best effort  | Lowest        | #monitoring   | Optional   |

---

*This playbook is maintained by the Platform Team. Last updated: 2026-02-06*
