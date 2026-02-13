import { NextResponse } from "next/server";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;
const TARGET_REPO = process.env.TARGET_REPO || "https://github.com/COG-GTM/azure-devops-mcp";
const JIRA_PROJECT = process.env.JIRA_PROJECT || "PLATFORM";
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "#devin-triage";
const DEVIN_PLAYBOOK_ID = process.env.DEVIN_PLAYBOOK_ID;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

const V1_BASE_URL = "https://api.devin.ai/v1";

// Slack slash command: /triage
// Usage: /triage <alert-name> <severity 0-3> <description>
// Example: /triage "NullRef in AuthService" 1 "Users getting 500 errors on login"
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Slack sends slash command data as form-urlencoded
    const text = formData.get("text") as string || "";
    const userId = formData.get("user_id") as string || "";
    const userName = formData.get("user_name") as string || "";
    const channelId = formData.get("channel_id") as string || "";
    const channelName = formData.get("channel_name") as string || "";
    const responseUrl = formData.get("response_url") as string || "";

    // Parse the slash command text
    // Format: <severity 0-3> <alert-name> | <description>
    // Example: 1 NullRef in AuthService | Users getting 500 errors on login
    const pipeIndex = text.indexOf("|");
    let severity = 2; // default Warning
    let alertName = "Manual Triage Request";
    let description = text;

    if (pipeIndex > -1) {
      const beforePipe = text.substring(0, pipeIndex).trim();
      description = text.substring(pipeIndex + 1).trim();

      // Try to extract severity (first token if it's a number 0-3)
      const tokens = beforePipe.split(/\s+/);
      const firstToken = parseInt(tokens[0], 10);
      if (!isNaN(firstToken) && firstToken >= 0 && firstToken <= 3) {
        severity = firstToken;
        alertName = tokens.slice(1).join(" ") || alertName;
      } else {
        alertName = beforePipe || alertName;
      }
    } else if (text.trim()) {
      // No pipe — treat entire text as description
      const tokens = text.trim().split(/\s+/);
      const firstToken = parseInt(tokens[0], 10);
      if (!isNaN(firstToken) && firstToken >= 0 && firstToken <= 3) {
        severity = firstToken;
        description = tokens.slice(1).join(" ") || "Manual triage requested via Slack";
      }
    }

    if (!DEVIN_API_KEY) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "❌ DEVIN_API_KEY not configured. Cannot start triage session.",
      });
    }

    // Immediately acknowledge the slash command (Slack requires response within 3s)
    // Then trigger Devin asynchronously via the response_url
    const severityEmoji = severity === 0 ? "🔴" : severity === 1 ? "🟠" : severity === 2 ? "🟡" : "🔵";
    const severityLabel = severity === 0 ? "Critical" : severity === 1 ? "Error" : severity === 2 ? "Warning" : "Info";

    // Fire off the Devin session in the background
    triggerDevinSession({
      alertName,
      severity,
      description,
      userName,
      channelName,
      responseUrl,
    });

    // Return immediate acknowledgment to Slack
    return NextResponse.json({
      response_type: "in_channel",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🤖 Triage Triggered via /triage",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Alert:*\n${alertName}`,
            },
            {
              type: "mrkdwn",
              text: `*Severity:*\n${severityEmoji} Sev ${severity} (${severityLabel})`,
            },
            {
              type: "mrkdwn",
              text: `*Triggered by:*\n<@${userId}>`,
            },
            {
              type: "mrkdwn",
              text: `*Status:*\n⚡ Devin session starting...`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Description: ${description}`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Slash command error:", error);
    return NextResponse.json({
      response_type: "ephemeral",
      text: `❌ Error processing triage command: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

// Async function to create Devin session and post follow-up to Slack
async function triggerDevinSession(params: {
  alertName: string;
  severity: number;
  description: string;
  userName: string;
  channelName: string;
  responseUrl: string;
}) {
  const { alertName, severity, description, userName, channelName, responseUrl } = params;

  const prompt = `# SLACK-TRIGGERED TRIAGE SESSION

## Context
- **Triggered by**: ${userName} via /triage command in #${channelName}
- **Alert Name**: ${alertName}
- **Severity**: Sev ${severity}
- **Description**: ${description}

## Target Repository
${TARGET_REPO}

---

# YOUR MISSION

Follow the Automated Alert Triage Playbook:

## Phase 1: Analyze
1. Parse and understand the reported issue
2. What is the immediate symptom?
3. What is the user/business impact?
4. Document your initial assessment

## Phase 2: Codebase Analysis
1. Clone the repository: ${TARGET_REPO}
2. Search for code related to the issue described
3. Trace the relevant call stack
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
- Create a PR with title: \`fix(core): ${alertName} [AUTO-TRIAGE]\`

## Phase 5: Create JIRA Ticket
Use JIRA MCP server to create a ticket in project ${JIRA_PROJECT}:
- **Summary**: [AUTO-TRIAGE] ${alertName} - <your one-line description>
- **Priority**: ${severity === 0 ? "Highest" : severity === 1 ? "High" : severity === 2 ? "Medium" : "Low"}
- **Labels**: auto-triage, devin, sev-${severity}, slack-triggered

## Phase 6: Notify Slack (REQUIRED)
You MUST post your triage results to the Slack channel ${SLACK_CHANNEL} using your Slack integration.
Post a message in ${SLACK_CHANNEL} with the following details:
- **Thread title**: 🔧 Auto-Triage Complete: ${alertName}
- **Status**: ✅ Fixed / ⚠️ Needs Review / ℹ️ External Issue
- **Alert**: ${alertName} (Sev ${severity})
- **Root Cause**: One-line root cause summary
- **Resolution**: What was done (PR link, config change, etc.)
- **Links**: JIRA ticket, PR (if any), this Devin session URL
- **Next Steps**: Any follow-up actions needed

IMPORTANT: Post this as a NEW message in ${SLACK_CHANNEL}, then reply in the THREAD with the detailed breakdown including logs analysis, root cause deep-dive, and full artifact links.

## Phase 7: Wrap Up
Provide a final summary with:
- Root cause explanation
- Actions taken
- All artifacts created (JIRA, PR, Slack)
- Any follow-up recommendations

---

BEGIN TRIAGE NOW. Work methodically through each phase.`;

  try {
    const response = await fetch(`${V1_BASE_URL}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEVIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        idempotent: false,
        ...(DEVIN_PLAYBOOK_ID ? { playbook_id: DEVIN_PLAYBOOK_ID } : {}),
        tags: ["auto-triage", `sev-${severity}`, "slack-triggered"],
        title: `[SLACK-TRIAGE] ${alertName} - Sev ${severity}`,
      }),
    });

    const data = await response.json();
    const sessionUrl = data.url || `https://app.devin.ai/sessions/${data.session_id}`;

    // Post follow-up to Slack via response_url
    if (responseUrl) {
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_type: "in_channel",
          replace_original: false,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ *Devin session created!* Triage is underway.`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View Devin Session",
                    emoji: true,
                  },
                  url: sessionUrl,
                  style: "primary",
                },
              ],
            },
          ],
        }),
      });
    }
  } catch (error) {
    console.error("Error creating Devin session from slash command:", error);

    if (responseUrl) {
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_type: "ephemeral",
          text: `❌ Failed to create Devin session: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
      });
    }
  }
}
