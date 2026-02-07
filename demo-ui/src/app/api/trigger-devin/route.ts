import { NextResponse } from "next/server";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;
const TARGET_REPO = process.env.TARGET_REPO || "https://github.com/COG-GTM/azure-devops-mcp";
const JIRA_PROJECT = process.env.JIRA_PROJECT || "PLATFORM";
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "#alerts";

const V1_BASE_URL = "https://api.devin.ai/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      alertName, 
      severity, 
      description, 
      logs, 
      affectedResource,
      resourceType,
      signalType,
      condition,
      threshold,
      actualValue,
      file, 
      line, 
      bugDescription,
      monitorUrl,
      firedTime,
    } = body;

    if (!DEVIN_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "DEVIN_API_KEY not configured",
        session_id: `demo_${Date.now()}`,
        url: `https://app.devin.ai/sessions/demo_${Date.now()}`,
      });
    }

    // Full automated triage prompt that aligns with the playbook
    const prompt = `# AUTOMATED ALERT TRIAGE SESSION

## Alert Details
- **Alert Name**: ${alertName}
- **Severity**: Sev ${severity}
- **Status**: Fired
- **Fired Time**: ${firedTime || new Date().toISOString()}
- **Affected Resource**: ${affectedResource}
- **Resource Type**: ${resourceType || "Unknown"}
- **Signal Type**: ${signalType || "Log"}

## Alert Condition
- **Condition**: ${condition || "Error detected in logs"}
- **Threshold**: ${threshold || "N/A"}
- **Actual Value**: ${actualValue || "Threshold exceeded"}

## Description
${description}

## Suspected Bug Location
- **File**: ${file}
- **Line**: ${line}
- **Issue**: ${bugDescription}

## Error Logs
\`\`\`
${logs}
\`\`\`

## Target Repository
${TARGET_REPO}

---

# YOUR MISSION

Follow the Automated Alert Triage Playbook:

## Phase 1: Analyze
1. Parse and understand this alert fully
2. What is the immediate symptom?
3. What is the user/business impact?
4. Document your initial assessment

## Phase 2: Codebase Analysis
1. Clone the repository: ${TARGET_REPO}
2. Navigate to ${file} around line ${line}
3. Trace the call stack from the error
4. Identify the root cause
5. Classify: Is this a CODE issue, CONFIG issue, or EXTERNAL issue?

## Phase 3: Triage Decision
Based on your analysis, choose ONE path:
- **Path A**: Code fix required → Implement fix, write tests, create PR
- **Path B**: Config issue → Document required changes, do NOT fix
- **Path C**: External issue → Document, no code change needed
- **Path D**: Uncertain → Document findings, flag for human review

## Phase 4: Implement (if Path A)
- Make minimal, focused changes
- Add proper error handling
- Add structured logging
- Write unit tests
- Create a PR with title: \`fix(${file.split('/')[file.split('/').length - 2] || 'core'}): ${alertName} [AUTO-TRIAGE]\`

## Phase 5: Create JIRA Ticket
Use JIRA MCP server to create a ticket in project ${JIRA_PROJECT}:
- **Summary**: [AUTO-TRIAGE] ${alertName} - <your one-line description>
- **Priority**: ${severity === 0 ? 'Highest' : severity === 1 ? 'High' : severity === 2 ? 'Medium' : 'Low'}
- **Labels**: auto-triage, devin, sev-${severity}
- Include: Alert details, root cause, resolution, PR link (if any), this Devin session URL
${monitorUrl ? `- **Monitor URL**: ${monitorUrl}` : ''}

## Phase 6: Notify Slack
Post to ${SLACK_CHANNEL} with:
- Status: ✅ Fixed / ⚠️ Needs Review / ℹ️ External Issue
- Alert name and severity
- One-line root cause summary
- Links to: JIRA ticket, PR (if any), this Devin session

## Phase 7: Wrap Up
Provide a final summary with:
- Root cause explanation
- Actions taken
- All artifacts created (JIRA, PR, Slack)
- Any follow-up recommendations

---

BEGIN TRIAGE NOW. Work methodically through each phase.`;

    console.log("Creating Devin session...");
    console.log("Alert:", alertName);
    console.log("Prompt length:", prompt.length);

    const response = await fetch(`${V1_BASE_URL}/sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEVIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        idempotent: false,
      }),
    });

    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      console.error("Devin API error:", responseText);
      return NextResponse.json({
        success: false,
        error: `Devin API error: ${response.status}`,
        message: responseText,
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        error: "Invalid JSON response",
        message: responseText,
      });
    }

    console.log("Session created:", data.session_id);

    return NextResponse.json({
      success: true,
      session_id: data.session_id,
      url: data.url || `https://app.devin.ai/sessions/${data.session_id}`,
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function GET() {
  if (!DEVIN_API_KEY) {
    return NextResponse.json({ configured: false });
  }

  const keyType = DEVIN_API_KEY.startsWith("apk_user_") ? "personal" :
                  DEVIN_API_KEY.startsWith("apk_") ? "service" :
                  DEVIN_API_KEY.startsWith("cog_") ? "service_user_v3" : "unknown";

  return NextResponse.json({
    configured: true,
    keyType,
    targetRepo: TARGET_REPO,
    jiraProject: JIRA_PROJECT,
    slackChannel: SLACK_CHANNEL,
  });
}
