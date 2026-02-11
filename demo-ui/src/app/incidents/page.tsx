"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================
interface HistoricalIncident {
  id: string;
  alertName: string;
  alertType: "auth" | "timeout" | "nullref" | "memory" | "slowquery" | "certexpiry" | "deployment" | "shardrebalance" | "ratelimit" | "other";
  severity: 0 | 1 | 2 | 3 | 4;
  status: "resolved" | "mitigated" | "investigating";
  firedAt: string;
  resolvedAt: string | null;
  ttd: number; // Time to Detect (minutes)
  ttr: number; // Time to Resolve (minutes)
  affectedResource: string;
  rootCause: string;
  rootCauseCategory: "code_bug" | "config_error" | "external_dependency" | "infrastructure" | "data_issue" | "unknown";
  fix: string;
  prNumber: string | null;
  prUrl: string | null;
  devinSessionId: string | null;
  devinSessionUrl: string | null;
  jiraTicket: string | null;
  impactSummary: string;
  lessonsLearned: string[];
  tags: string[];
  postMortem: PostMortem | null;
  similarIncidents: string[]; // IDs of similar incidents
}

interface PostMortem {
  generatedAt: string;
  summary: string;
  timeline: { time: string; event: string }[];
  rootCauseAnalysis: string;
  impactAnalysis: {
    duration: string;
    usersAffected: string;
    revenueImpact: string;
    servicesAffected: string[];
  };
  whatWentWell: string[];
  whatWentWrong: string[];
  actionItems: { item: string; owner: string; dueDate: string; status: "open" | "in_progress" | "done" }[];
  preventionMeasures: string[];
}

// ============================================================================
// HISTORICAL INCIDENT DATA
// ============================================================================
const historicalIncidents: HistoricalIncident[] = [
  {
    id: "INC-2156",
    alertName: "mcp-token-expiration",
    alertType: "auth",
    severity: 1,
    status: "resolved",
    firedAt: "2024-02-10T14:23:00Z",
    resolvedAt: "2024-02-10T14:31:00Z",
    ttd: 2,
    ttr: 8,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "Azure AD access token refresh logic missing retry mechanism. When token refresh failed due to transient Azure AD latency, the application crashed instead of retrying.",
    rootCauseCategory: "code_bug",
    fix: "Added exponential backoff retry logic to token refresh. Implemented token pre-refresh 10 minutes before expiration.",
    prNumber: "PR-892",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/892",
    devinSessionId: "session_1707571380000",
    devinSessionUrl: "https://app.devin.ai/sessions/session_1707571380000",
    jiraTicket: "PLATFORM-4521",
    impactSummary: "MCP server unavailable for 8 minutes. 47 API requests failed.",
    lessonsLearned: [
      "Token refresh should always have retry logic",
      "Pre-refresh tokens before expiration to avoid edge cases",
      "Add alerting for token refresh failures before they cascade"
    ],
    tags: ["authentication", "azure-ad", "token-refresh", "retry-logic"],
    similarIncidents: ["INC-1847", "INC-1623"],
    postMortem: {
      generatedAt: "2024-02-10T15:00:00Z",
      summary: "MCP server experienced 8 minutes of downtime due to Azure AD token refresh failure. The root cause was missing retry logic in the token refresh mechanism. Devin AI automatically identified the issue, implemented a fix with exponential backoff, and created a PR within 8 minutes of alert firing.",
      timeline: [
        { time: "14:21:00", event: "Token expiration approaching (5 min warning logged)" },
        { time: "14:23:00", event: "Token refresh attempted, failed due to Azure AD latency spike" },
        { time: "14:23:05", event: "Application threw TokenCredentialAuthenticationError" },
        { time: "14:23:10", event: "Azure Monitor alert fired" },
        { time: "14:23:15", event: "Devin session created automatically" },
        { time: "14:25:00", event: "Devin identified root cause: missing retry logic" },
        { time: "14:28:00", event: "Devin created PR #892 with fix" },
        { time: "14:30:00", event: "PR merged after review" },
        { time: "14:31:00", event: "Deployment complete, service restored" },
      ],
      rootCauseAnalysis: "The token refresh implementation assumed Azure AD would always respond within the timeout period. When Azure AD experienced a latency spike (common during regional failovers), the refresh failed and was not retried. The code path then threw an exception that crashed the request handler, causing cascading failures.",
      impactAnalysis: {
        duration: "8 minutes",
        usersAffected: "~200 active users",
        revenueImpact: "Minimal - internal tooling",
        servicesAffected: ["MCP Server", "Azure DevOps Integration", "Work Item Sync"]
      },
      whatWentWell: [
        "Alert fired within 10 seconds of failure",
        "Devin automatically started investigation",
        "Root cause identified in under 2 minutes",
        "PR created with tests included",
        "Team was notified via Slack immediately"
      ],
      whatWentWrong: [
        "No retry logic in token refresh",
        "Token pre-refresh window was too short",
        "No graceful degradation for auth failures"
      ],
      actionItems: [
        { item: "Add retry logic to all Azure SDK calls", owner: "Platform Team", dueDate: "2024-02-17", status: "done" },
        { item: "Implement circuit breaker for auth endpoints", owner: "Platform Team", dueDate: "2024-02-24", status: "in_progress" },
        { item: "Add token refresh health check endpoint", owner: "SRE", dueDate: "2024-02-20", status: "open" },
      ],
      preventionMeasures: [
        "All HTTP clients must implement retry with exponential backoff",
        "Token refresh should happen 10+ minutes before expiration",
        "Add specific alerting for authentication subsystem health"
      ]
    }
  },
  {
    id: "INC-1847",
    alertName: "mcp-token-refresh-failure",
    alertType: "auth",
    severity: 1,
    status: "resolved",
    firedAt: "2024-02-03T09:15:00Z",
    resolvedAt: "2024-02-03T09:45:00Z",
    ttd: 5,
    ttr: 30,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "Token cache was not being invalidated properly after refresh failures, causing stale tokens to be reused.",
    rootCauseCategory: "code_bug",
    fix: "Implemented proper cache invalidation on refresh failure. Added token validation before use.",
    prNumber: "PR-342",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/342",
    devinSessionId: "session_1706951700000",
    devinSessionUrl: "https://app.devin.ai/sessions/session_1706951700000",
    jiraTicket: "PLATFORM-4102",
    impactSummary: "Intermittent API failures for 30 minutes. ~150 requests affected.",
    lessonsLearned: [
      "Cache invalidation must be atomic with refresh operations",
      "Always validate tokens before use, not just on acquisition"
    ],
    tags: ["authentication", "token-cache", "cache-invalidation"],
    similarIncidents: ["INC-1623", "INC-2156"],
    postMortem: {
      generatedAt: "2024-02-03T11:00:00Z",
      summary: "Token cache corruption caused intermittent authentication failures. Manual investigation took 30 minutes before Devin was engaged. After Devin involvement, fix was deployed in 15 minutes.",
      timeline: [
        { time: "09:10:00", event: "First user report of intermittent failures" },
        { time: "09:15:00", event: "Alert fired for elevated error rate" },
        { time: "09:30:00", event: "Manual investigation started" },
        { time: "09:35:00", event: "Devin session created" },
        { time: "09:40:00", event: "Root cause identified by Devin" },
        { time: "09:43:00", event: "PR created" },
        { time: "09:45:00", event: "Fix deployed" },
      ],
      rootCauseAnalysis: "The token cache was using a simple put() operation that didn't handle the case where a refresh was in progress. This created a race condition where stale tokens could overwrite fresh ones.",
      impactAnalysis: {
        duration: "30 minutes",
        usersAffected: "~50 users",
        revenueImpact: "Minimal",
        servicesAffected: ["MCP Server"]
      },
      whatWentWell: [
        "Users reported issue quickly",
        "Once Devin was engaged, resolution was fast"
      ],
      whatWentWrong: [
        "Alert threshold was too high - should have fired earlier",
        "Initial manual investigation wasted 15 minutes",
        "No automatic Devin trigger for this alert type at the time"
      ],
      actionItems: [
        { item: "Lower alert threshold for auth errors", owner: "SRE", dueDate: "2024-02-10", status: "done" },
        { item: "Enable auto-triage for all auth alerts", owner: "Platform Team", dueDate: "2024-02-07", status: "done" },
      ],
      preventionMeasures: [
        "Use atomic cache operations with proper locking",
        "Implement token validation layer"
      ]
    }
  },
  {
    id: "INC-1623",
    alertName: "credential-cache-corruption",
    alertType: "auth",
    severity: 2,
    status: "resolved",
    firedAt: "2024-01-22T16:30:00Z",
    resolvedAt: "2024-01-22T17:15:00Z",
    ttd: 10,
    ttr: 45,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "Memory pressure caused credential cache to be partially evicted, leading to inconsistent state.",
    rootCauseCategory: "infrastructure",
    fix: "Increased memory allocation and implemented distributed cache with Redis for credentials.",
    prNumber: "PR-287",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/287",
    devinSessionId: null,
    devinSessionUrl: null,
    jiraTicket: "PLATFORM-3891",
    impactSummary: "Degraded performance for 45 minutes. Some users experienced auth errors.",
    lessonsLearned: [
      "Critical caches should be protected from memory pressure",
      "Consider distributed caching for stateful data"
    ],
    tags: ["authentication", "memory", "cache", "infrastructure"],
    similarIncidents: ["INC-1847"],
    postMortem: null
  },
  {
    id: "INC-2089",
    alertName: "api-timeout-builds-endpoint",
    alertType: "timeout",
    severity: 1,
    status: "resolved",
    firedAt: "2024-02-08T11:42:00Z",
    resolvedAt: "2024-02-08T11:55:00Z",
    ttd: 3,
    ttr: 13,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "N+1 query pattern in builds endpoint. Each build was fetching related data in a loop instead of batch.",
    rootCauseCategory: "code_bug",
    fix: "Refactored to use batch query with $expand parameter. Reduced from O(n) to O(1) API calls.",
    prNumber: "PR-856",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/856",
    devinSessionId: "session_1707389520000",
    devinSessionUrl: "https://app.devin.ai/sessions/session_1707389520000",
    jiraTicket: "PLATFORM-4489",
    impactSummary: "Builds endpoint timing out for 13 minutes. Users unable to list builds.",
    lessonsLearned: [
      "Always use batch/expand for related data",
      "Add query performance tests to CI"
    ],
    tags: ["performance", "n+1-query", "timeout", "azure-devops-api"],
    similarIncidents: ["INC-1792"],
    postMortem: {
      generatedAt: "2024-02-08T13:00:00Z",
      summary: "Builds endpoint experienced timeouts due to N+1 query pattern. Devin identified the inefficient query pattern and refactored to use batch fetching, reducing response time from 15s to 200ms.",
      timeline: [
        { time: "11:39:00", event: "User reported slow builds page" },
        { time: "11:42:00", event: "Timeout alert fired" },
        { time: "11:42:30", event: "Devin session started" },
        { time: "11:47:00", event: "Devin identified N+1 query pattern" },
        { time: "11:52:00", event: "PR created with batch query fix" },
        { time: "11:55:00", event: "Fix deployed, latency normalized" },
      ],
      rootCauseAnalysis: "The builds endpoint was iterating through each build and making a separate API call to fetch pipeline details. With 100+ builds, this resulted in 100+ sequential API calls, each with ~150ms latency.",
      impactAnalysis: {
        duration: "13 minutes",
        usersAffected: "All users of builds feature (~80)",
        revenueImpact: "Low - productivity tool",
        servicesAffected: ["MCP Server - Builds Endpoint"]
      },
      whatWentWell: [
        "Fast detection and auto-triage",
        "Devin correctly identified root cause",
        "Fix was elegant and well-tested"
      ],
      whatWentWrong: [
        "N+1 pattern wasn't caught in code review",
        "No performance regression tests"
      ],
      actionItems: [
        { item: "Add query performance tests to CI", owner: "Platform Team", dueDate: "2024-02-15", status: "done" },
        { item: "Audit other endpoints for N+1 patterns", owner: "Platform Team", dueDate: "2024-02-22", status: "in_progress" },
      ],
      preventionMeasures: [
        "Require performance test for any endpoint returning lists",
        "Add N+1 query detection to linting rules"
      ]
    }
  },
  {
    id: "INC-1792",
    alertName: "api-timeout-workitems-batch",
    alertType: "timeout",
    severity: 1,
    status: "resolved",
    firedAt: "2024-01-28T15:20:00Z",
    resolvedAt: "2024-01-28T15:48:00Z",
    ttd: 5,
    ttr: 28,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "Batch size for work item queries was unbounded. Large batches caused timeouts.",
    rootCauseCategory: "code_bug",
    fix: "Implemented pagination with max batch size of 200. Added request timeout configuration.",
    prNumber: "PR-318",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/318",
    devinSessionId: "session_1706454600000",
    devinSessionUrl: "https://app.devin.ai/sessions/session_1706454600000",
    jiraTicket: "PLATFORM-4015",
    impactSummary: "Work item queries failing for 28 minutes.",
    lessonsLearned: [
      "Always paginate batch operations",
      "Set sensible limits on user-provided parameters"
    ],
    tags: ["performance", "timeout", "pagination", "batch-operations"],
    similarIncidents: ["INC-2089"],
    postMortem: null
  },
  {
    id: "INC-2034",
    alertName: "null-reference-workitem-parent",
    alertType: "nullref",
    severity: 1,
    status: "resolved",
    firedAt: "2024-02-05T08:55:00Z",
    resolvedAt: "2024-02-05T09:08:00Z",
    ttd: 2,
    ttr: 13,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "Code assumed all work items have a parent relationship. Orphan work items caused null reference.",
    rootCauseCategory: "code_bug",
    fix: "Added null check before accessing parent relationship. Graceful handling of orphan work items.",
    prNumber: "PR-812",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/812",
    devinSessionId: "session_1707123300000",
    devinSessionUrl: "https://app.devin.ai/sessions/session_1707123300000",
    jiraTicket: "PLATFORM-4423",
    impactSummary: "Work item batch operations failing. 5 users affected.",
    lessonsLearned: [
      "Never assume relationships exist",
      "Use optional chaining for all relationship access"
    ],
    tags: ["null-reference", "work-items", "relationships", "defensive-coding"],
    similarIncidents: [],
    postMortem: {
      generatedAt: "2024-02-05T10:00:00Z",
      summary: "Work item processing failed due to null reference when accessing parent relationship on orphan work items. Devin added defensive null checks and improved error handling.",
      timeline: [
        { time: "08:53:00", event: "User created work items without parent links" },
        { time: "08:55:00", event: "Batch operation triggered null reference" },
        { time: "08:55:10", event: "Alert fired, Devin session created" },
        { time: "08:59:00", event: "Root cause identified" },
        { time: "09:05:00", event: "PR created with null checks" },
        { time: "09:08:00", event: "Fix deployed" },
      ],
      rootCauseAnalysis: "The getParentId() function accessed workItem.relations without checking if relations existed or if a parent relationship was present. This is a common pattern when data models allow optional relationships.",
      impactAnalysis: {
        duration: "13 minutes",
        usersAffected: "5",
        revenueImpact: "None",
        servicesAffected: ["Work Items Service"]
      },
      whatWentWell: [
        "Very fast detection and resolution",
        "Clean fix with proper null handling"
      ],
      whatWentWrong: [
        "Missing null checks in original code",
        "No test for orphan work items"
      ],
      actionItems: [
        { item: "Add tests for orphan work items", owner: "Platform Team", dueDate: "2024-02-12", status: "done" },
        { item: "Enable strict null checks in TypeScript", owner: "Platform Team", dueDate: "2024-02-19", status: "done" },
      ],
      preventionMeasures: [
        "Enable strictNullChecks in tsconfig",
        "Require optional chaining for all external data access"
      ]
    }
  },
  {
    id: "INC-1956",
    alertName: "memory-pressure-warning",
    alertType: "memory",
    severity: 2,
    status: "resolved",
    firedAt: "2024-02-01T20:15:00Z",
    resolvedAt: "2024-02-01T20:45:00Z",
    ttd: 10,
    ttr: 30,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "Memory leak in request handler - responses weren't being properly disposed.",
    rootCauseCategory: "code_bug",
    fix: "Added proper response disposal in finally blocks. Implemented memory profiling in CI.",
    prNumber: "PR-756",
    prUrl: "https://github.com/COG-GTM/azure-devops-mcp/pull/756",
    devinSessionId: null,
    devinSessionUrl: null,
    jiraTicket: "PLATFORM-4312",
    impactSummary: "Gradual memory increase over 2 hours. No immediate user impact but would have caused OOM.",
    lessonsLearned: [
      "Always dispose HTTP responses",
      "Monitor memory trends, not just thresholds"
    ],
    tags: ["memory", "leak", "resource-disposal"],
    similarIncidents: [],
    postMortem: null
  },
  {
    id: "INC-2201",
    alertName: "deployment-completed",
    alertType: "deployment",
    severity: 3,
    status: "resolved",
    firedAt: "2024-02-10T16:00:00Z",
    resolvedAt: "2024-02-10T16:00:00Z",
    ttd: 0,
    ttr: 0,
    affectedResource: "aks-mcp-server-prod",
    rootCause: "N/A - Informational alert for successful deployment",
    rootCauseCategory: "unknown",
    fix: "N/A",
    prNumber: null,
    prUrl: null,
    devinSessionId: null,
    devinSessionUrl: null,
    jiraTicket: null,
    impactSummary: "Successful deployment of v1.2.3",
    lessonsLearned: [],
    tags: ["deployment", "release", "informational"],
    similarIncidents: [],
    postMortem: null
  }
];

// ============================================================================
// PATTERN MATCHING ENGINE
// ============================================================================
interface PatternMatch {
  incident: HistoricalIncident;
  similarity: number;
  matchReasons: string[];
}

function findSimilarIncidents(
  alertType: string,
  alertName: string,
  resource: string,
  logs?: string
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  
  for (const incident of historicalIncidents) {
    let similarity = 0;
    const matchReasons: string[] = [];
    
    // Type match (highest weight)
    if (incident.alertType === alertType) {
      similarity += 0.4;
      matchReasons.push(`Same alert type: ${alertType}`);
    }
    
    // Name similarity
    const nameWords = alertName.toLowerCase().split(/[-_\s]+/);
    const incidentNameWords = incident.alertName.toLowerCase().split(/[-_\s]+/);
    const nameOverlap = nameWords.filter(w => incidentNameWords.includes(w)).length;
    if (nameOverlap > 0) {
      similarity += 0.2 * (nameOverlap / Math.max(nameWords.length, incidentNameWords.length));
      matchReasons.push(`Similar alert name pattern`);
    }
    
    // Resource match
    if (incident.affectedResource === resource) {
      similarity += 0.2;
      matchReasons.push(`Same affected resource`);
    }
    
    // Tag match (if logs contain relevant keywords)
    if (logs) {
      const logLower = logs.toLowerCase();
      const matchingTags = incident.tags.filter(tag => logLower.includes(tag.replace(/-/g, ' ')));
      if (matchingTags.length > 0) {
        similarity += 0.1 * (matchingTags.length / incident.tags.length);
        matchReasons.push(`Matching keywords: ${matchingTags.join(', ')}`);
      }
    }
    
    // Root cause category bonus for resolved incidents
    if (incident.status === "resolved" && similarity > 0.3) {
      similarity += 0.1;
      matchReasons.push(`Previously resolved - solution available`);
    }
    
    if (similarity >= 0.3 && incident.status === "resolved") {
      matches.push({ incident, similarity, matchReasons });
    }
  }
  
  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

// ============================================================================
// COMPONENTS
// ============================================================================
function SeverityBadge({ severity }: { severity: number }) {
  const config: Record<number, { label: string; color: string; bg: string }> = {
    0: { label: "Critical", color: "text-red-700", bg: "bg-red-100" },
    1: { label: "Error", color: "text-orange-700", bg: "bg-orange-100" },
    2: { label: "Warning", color: "text-yellow-700", bg: "bg-yellow-100" },
    3: { label: "Info", color: "text-blue-700", bg: "bg-blue-100" },
    4: { label: "Verbose", color: "text-purple-700", bg: "bg-purple-100" },
  };
  const c = config[severity] || config[3];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.color} ${c.bg}`}>
      Sev {severity} • {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    resolved: { color: "text-green-700", bg: "bg-green-100" },
    mitigated: { color: "text-yellow-700", bg: "bg-yellow-100" },
    investigating: { color: "text-red-700", bg: "bg-red-100" },
  };
  const c = config[status] || config.resolved;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${c.color} ${c.bg}`}>
      {status}
    </span>
  );
}

function IncidentCard({ incident, onClick }: { incident: HistoricalIncident; onClick: () => void }) {
  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium text-gray-900">{incident.id}</span>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <h3 className="font-medium text-gray-900">{incident.alertName}</h3>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>TTR: {incident.ttr} min</div>
          <div>{new Date(incident.firedAt).toLocaleDateString()}</div>
        </div>
      </div>
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{incident.rootCause}</p>
      <div className="flex flex-wrap gap-1">
        {incident.tags.slice(0, 4).map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
            {tag}
          </span>
        ))}
        {incident.tags.length > 4 && (
          <span className="px-2 py-0.5 text-gray-400 text-xs">+{incident.tags.length - 4} more</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs">
        {incident.prNumber && (
          <span className="text-blue-600">🔗 {incident.prNumber}</span>
        )}
        {incident.devinSessionId && (
          <span className="text-purple-600">🤖 Devin assisted</span>
        )}
        {incident.postMortem && (
          <span className="text-green-600">📋 Post-mortem available</span>
        )}
      </div>
    </div>
  );
}

function PostMortemView({ postMortem, incident }: { postMortem: PostMortem; incident: HistoricalIncident }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6">
        <div className="flex items-center gap-2 text-blue-200 text-sm mb-2">
          <span>📋 POST-MORTEM REPORT</span>
          <span>•</span>
          <span>Generated {new Date(postMortem.generatedAt).toLocaleString()}</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">{incident.id}: {incident.alertName}</h2>
        <p className="text-blue-100">{postMortem.summary}</p>
      </div>

      {/* Impact Summary */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">📊 Impact Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Duration</div>
            <div className="font-semibold text-gray-900">{postMortem.impactAnalysis.duration}</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Users Affected</div>
            <div className="font-semibold text-gray-900">{postMortem.impactAnalysis.usersAffected}</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Revenue Impact</div>
            <div className="font-semibold text-gray-900">{postMortem.impactAnalysis.revenueImpact}</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Services</div>
            <div className="font-semibold text-gray-900">{postMortem.impactAnalysis.servicesAffected.length}</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">⏱️ Incident Timeline</h3>
        <div className="space-y-2">
          {postMortem.timeline.map((event, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="font-mono text-gray-500 w-20 shrink-0">{event.time}</div>
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div className="text-gray-700">{event.event}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Root Cause */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">🔍 Root Cause Analysis</h3>
        <p className="text-gray-700">{postMortem.rootCauseAnalysis}</p>
      </div>

      {/* What Went Well / Wrong */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <h3 className="font-semibold text-green-800 mb-3">✅ What Went Well</h3>
          <ul className="space-y-2">
            {postMortem.whatWentWell.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <span className="text-green-500 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <h3 className="font-semibold text-red-800 mb-3">❌ What Went Wrong</h3>
          <ul className="space-y-2">
            {postMortem.whatWentWrong.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="text-red-500 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">📝 Action Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Item</th>
                <th className="text-left py-2 px-2">Owner</th>
                <th className="text-left py-2 px-2">Due</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {postMortem.actionItems.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 px-2">{item.item}</td>
                  <td className="py-2 px-2 text-gray-600">{item.owner}</td>
                  <td className="py-2 px-2 text-gray-600">{item.dueDate}</td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      item.status === 'done' ? 'bg-green-100 text-green-700' :
                      item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prevention */}
      <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
        <h3 className="font-semibold text-purple-800 mb-3">🛡️ Prevention Measures</h3>
        <ul className="space-y-2">
          {postMortem.preventionMeasures.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-purple-700">
              <span className="text-purple-500 mt-0.5">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IncidentDetail({ incident, onBack }: { incident: HistoricalIncident; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "postmortem" | "similar">("overview");
  const similarIncidents = findSimilarIncidents(incident.alertType, incident.alertName, incident.affectedResource);
  
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 text-sm mb-4 flex items-center gap-1">
          ← Back to incidents
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{incident.id}</h1>
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
            </div>
            <h2 className="text-lg text-gray-700">{incident.alertName}</h2>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Time to Resolve</div>
            <div className="text-2xl font-bold text-gray-900">{incident.ttr} min</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-6">
          {["overview", "postmortem", "similar"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`pb-3 px-1 text-sm font-medium capitalize ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "postmortem" ? "Post-Mortem" : tab}
              {tab === "similar" && ` (${similarIncidents.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Affected Resource</h3>
              <div className="font-medium text-gray-900">{incident.affectedResource}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Root Cause Category</h3>
              <div className="font-medium text-gray-900 capitalize">{incident.rootCauseCategory.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Root Cause */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Root Cause</h3>
            <p className="text-gray-700">{incident.rootCause}</p>
          </div>

          {/* Fix */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Resolution</h3>
            <p className="text-gray-700">{incident.fix}</p>
            {incident.prNumber && (
              <div className="mt-3">
                <a 
                  href={incident.prUrl || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  🔗 {incident.prNumber}
                </a>
              </div>
            )}
          </div>

          {/* Devin Session */}
          {incident.devinSessionId && (
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤖</span>
                <h3 className="font-semibold text-purple-900">Devin AI Assisted</h3>
              </div>
              <p className="text-sm text-purple-700 mb-2">
                This incident was automatically triaged by Devin AI.
              </p>
              <a 
                href={incident.devinSessionUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                View Devin Session →
              </a>
            </div>
          )}

          {/* Lessons Learned */}
          {incident.lessonsLearned.length > 0 && (
            <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">💡 Lessons Learned</h3>
              <ul className="space-y-1">
                {incident.lessonsLearned.map((lesson, i) => (
                  <li key={i} className="text-sm text-yellow-800 flex items-start gap-2">
                    <span>•</span>
                    {lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {incident.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === "postmortem" && (
        incident.postMortem ? (
          <PostMortemView postMortem={incident.postMortem} incident={incident} />
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-semibold text-gray-900 mb-2">No Post-Mortem Available</h3>
            <p className="text-gray-600 text-sm">
              A post-mortem was not generated for this incident.
            </p>
          </div>
        )
      )}

      {activeTab === "similar" && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h3 className="font-semibold text-blue-900 mb-1">🔄 Pattern Recognition</h3>
            <p className="text-sm text-blue-700">
              Found {similarIncidents.length} similar incidents based on alert type, resource, and keywords.
              Use these to inform your investigation and apply previous solutions.
            </p>
          </div>
          {similarIncidents.map(match => (
            <div key={match.incident.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{match.incident.id}</span>
                    <SeverityBadge severity={match.incident.severity} />
                    <span className="text-xs text-gray-500">
                      {Math.round(match.similarity * 100)}% match
                    </span>
                  </div>
                  <div className="font-medium text-gray-900">{match.incident.alertName}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(match.incident.firedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs text-gray-500 mb-1">Match reasons:</div>
                <div className="flex flex-wrap gap-1">
                  {match.matchReasons.map((reason, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-2">{match.incident.rootCause}</div>
              {match.incident.fix && (
                <div className="bg-gray-50 rounded p-2 text-sm">
                  <span className="font-medium">Solution: </span>
                  {match.incident.fix}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function IncidentsPage() {
  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const filteredIncidents = useMemo(() => {
    return historicalIncidents.filter(incident => {
      if (filterType !== "all" && incident.alertType !== filterType) return false;
      if (filterSeverity !== "all" && incident.severity !== parseInt(filterSeverity)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          incident.id.toLowerCase().includes(query) ||
          incident.alertName.toLowerCase().includes(query) ||
          incident.rootCause.toLowerCase().includes(query) ||
          incident.tags.some(t => t.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [filterType, filterSeverity, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const resolved = historicalIncidents.filter(i => i.status === "resolved");
    const avgTTR = resolved.length ? Math.round(resolved.reduce((sum, i) => sum + i.ttr, 0) / resolved.length) : 0;
    const devinAssisted = historicalIncidents.filter(i => i.devinSessionId).length;
    const withPostMortem = historicalIncidents.filter(i => i.postMortem).length;
    return { total: historicalIncidents.length, avgTTR, devinAssisted, withPostMortem };
  }, []);

  if (selectedIncident) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <IncidentDetail incident={selectedIncident} onBack={() => setSelectedIncident(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
                  ← Back to Demo
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Incident Knowledge Base</h1>
              <p className="text-gray-600">Historical incidents, patterns, and learnings from automated triage</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                🤖 {stats.devinAssisted} Devin-assisted
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                📋 {stats.withPostMortem} Post-mortems
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total Incidents</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.avgTTR} min</div>
              <div className="text-sm text-gray-500">Avg Time to Resolve</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{Math.round(stats.devinAssisted / stats.total * 100)}%</div>
              <div className="text-sm text-gray-500">Devin Assisted</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{Math.round(stats.withPostMortem / stats.total * 100)}%</div>
              <div className="text-sm text-gray-500">With Post-Mortem</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search incidents, root causes, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="auth">Authentication</option>
            <option value="timeout">Timeout</option>
            <option value="nullref">Null Reference</option>
            <option value="memory">Memory</option>
            <option value="slowquery">Slow Query</option>
            <option value="deployment">Deployment</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="0">Sev 0 - Critical</option>
            <option value="1">Sev 1 - Error</option>
            <option value="2">Sev 2 - Warning</option>
            <option value="3">Sev 3 - Info</option>
          </select>
        </div>
      </div>

      {/* Incident List */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <div className="grid md:grid-cols-2 gap-4">
          {filteredIncidents.map(incident => (
            <IncidentCard 
              key={incident.id} 
              incident={incident} 
              onClick={() => setSelectedIncident(incident)}
            />
          ))}
        </div>
        {filteredIncidents.length === 0 && (
          <div className="bg-white rounded-lg border p-8 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-semibold text-gray-900 mb-2">No incidents found</h3>
            <p className="text-gray-600 text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
