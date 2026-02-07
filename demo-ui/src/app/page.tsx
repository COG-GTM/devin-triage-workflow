"use client";

import { useState } from "react";

// ============================================================================
// TYPES
// ============================================================================
interface Alert {
  id: string;
  name: string;
  severity: 0 | 1 | 2 | 3 | 4;
  status: "Fired" | "Resolved";
  affectedResource: string;
  resourceType: string;
  signalType: string;
  firedTime: string;
  description: string;
  condition: string;
  threshold: string;
  actualValue: string;
  dimensions: { key: string; value: string }[];
  logs: LogEntry[];
  actionsTaken: { time: string; action: string; status: string }[];
}

interface LogEntry {
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  service: string;
  message: string;
  details?: string;
  stackTrace?: string;
}

interface DevinNotification {
  id: string;
  sessionId: string;
  url: string;
  alertName: string;
  status: "creating" | "analyzing" | "fixing" | "complete";
  timestamp: string;
}

// ============================================================================
// ALERT DATA GENERATORS
// ============================================================================
function generateAlertData(type: "auth" | "timeout" | "nullref"): Omit<Alert, "id" | "firedTime"> {
  const now = new Date();
  const fmt = (ms: number) => new Date(now.getTime() - ms).toISOString();
  
  const configs: Record<string, Omit<Alert, "id" | "firedTime">> = {
    auth: {
      name: "mcp-token-expiration",
      severity: 1,
      status: "Fired",
      affectedResource: "aks-mcp-server-prod",
      resourceType: "Microsoft.ContainerService/managedClusters",
      signalType: "Log",
      description: "Azure AD access token has expired, causing authentication failures in the MCP server.",
      condition: "ContainerLog | where LogEntry contains 'TokenCredentialAuthenticationError'",
      threshold: "Count > 0 within 5 minutes",
      actualValue: "3 occurrences in last 5 minutes",
      dimensions: [
        { key: "Subscription", value: "Enterprise Production" },
        { key: "Resource Group", value: "rg-mcp-servers-prod" },
        { key: "Cluster", value: "aks-mcp-server-prod" },
        { key: "Namespace", value: "mcp-system" },
        { key: "Pod", value: "mcp-server-7d4f8b9c6-x2j4k" },
        { key: "Container", value: "mcp-server" },
      ],
      logs: [
        { timestamp: fmt(300000), level: "INFO", service: "mcp-server", message: "Initializing Azure DevOps MCP Server v1.0.0" },
        { timestamp: fmt(280000), level: "INFO", service: "auth", message: "Requesting access token from Azure AD", details: "tenantId=72f988bf-86f1-41af-91ab-2d7cd011db47" },
        { timestamp: fmt(275000), level: "INFO", service: "auth", message: "Access token acquired successfully", details: "expiresOn=2024-02-06T19:30:00Z, scopes=499b84ac-1321-427f-aa17-267ca6975798/.default" },
        { timestamp: fmt(120000), level: "WARN", service: "auth", message: "Token expiration approaching", details: "expiresIn=300s, refreshThreshold=600s" },
        { timestamp: fmt(60000), level: "WARN", service: "auth", message: "Token refresh attempt initiated" },
        { timestamp: fmt(55000), level: "ERROR", service: "auth", message: "Token refresh failed", details: "AADSTS700024: Client assertion is not within its valid time range" },
        { timestamp: fmt(30000), level: "ERROR", service: "auth", message: "TokenCredentialAuthenticationError: The access token has expired", details: "errorCode=AADSTS700024", stackTrace: `TokenCredentialAuthenticationError: The access token has expired
    at DefaultAzureCredential.getToken (node_modules/@azure/identity/src/credentials/defaultAzureCredential.ts:89:13)
    at getCurrentUserDetails (src/tools/auth.ts:14:24)
    at processRequest (src/server.ts:156:18)
    at async Server.handleRequest (src/server.ts:89:5)` },
        { timestamp: fmt(25000), level: "ERROR", service: "mcp-server", message: "Request failed: Unable to authenticate with Azure DevOps", details: "requestId=a3f2c891-4b5d-4e6f-8a9c-1b2d3e4f5a6b" },
      ],
      actionsTaken: [
        { time: fmt(28000), action: "Alert rule evaluated", status: "Condition met" },
        { time: fmt(27000), action: "Action group triggered: ag-devin-triage", status: "Success" },
        { time: fmt(26000), action: "Email notification sent", status: "Delivered" },
        { time: fmt(25000), action: "Webhook called: Devin-AI-Webhook", status: "Success (201)" },
        { time: fmt(24000), action: "Devin session created", status: "session_1707252345678" },
      ],
    },
    timeout: {
      name: "mcp-api-timeout",
      severity: 1,
      status: "Fired",
      affectedResource: "aks-mcp-server-prod",
      resourceType: "Microsoft.ContainerService/managedClusters",
      signalType: "Metric",
      description: "Azure DevOps API requests are timing out, P99 latency exceeded 10s threshold.",
      condition: "avg(request_duration_seconds_p99) > 10",
      threshold: "P99 latency > 10 seconds for 5 minutes",
      actualValue: "P99 latency: 58.3 seconds",
      dimensions: [
        { key: "Subscription", value: "Enterprise Production" },
        { key: "Resource Group", value: "rg-mcp-servers-prod" },
        { key: "Cluster", value: "aks-mcp-server-prod" },
        { key: "Namespace", value: "mcp-system" },
        { key: "Endpoint", value: "/builds" },
        { key: "Method", value: "GET" },
      ],
      logs: [
        { timestamp: fmt(350000), level: "INFO", service: "builds", message: "Tool request received: build_get_builds", details: "project=AzureDevOps, top=50" },
        { timestamp: fmt(340000), level: "DEBUG", service: "builds", message: "Initiating Azure DevOps API call", details: "endpoint=https://dev.azure.com/org/project/_apis/build/builds" },
        { timestamp: fmt(320000), level: "WARN", service: "builds", message: "API request taking longer than expected", details: "elapsed=29500ms, threshold=10000ms" },
        { timestamp: fmt(300000), level: "WARN", service: "builds", message: "Connection pool exhausted, waiting for available connection", details: "activeConnections=50, maxConnections=50" },
        { timestamp: fmt(290000), level: "ERROR", service: "builds", message: "Request timeout: operation aborted after 60s", details: "requestId=b4c5d6e7-8f9a-0b1c-2d3e-4f5a6b7c8d9e", stackTrace: `TimeoutError: Request timeout: operation aborted
    at Timeout._onTimeout (node_modules/axios/lib/adapters/http.js:245:16)
    at listOnTimeout (node:internal/timers:569:17)
    at processTimers (node:internal/timers:512:7)
    at buildApi.getBuilds (src/tools/builds.ts:178:12)
    at processToolRequest (src/server.ts:234:18)` },
        { timestamp: fmt(285000), level: "ERROR", service: "mcp-server", message: "Tool execution failed", details: "tool=build_get_builds, error=ETIMEDOUT" },
      ],
      actionsTaken: [
        { time: fmt(288000), action: "Alert rule evaluated", status: "Condition met" },
        { time: fmt(287000), action: "Action group triggered: ag-devin-triage", status: "Success" },
        { time: fmt(286000), action: "Webhook called: Devin-AI-Webhook", status: "Success (201)" },
        { time: fmt(285000), action: "Devin session created", status: "session_1707252398765" },
      ],
    },
    nullref: {
      name: "mcp-null-reference-error",
      severity: 1,
      status: "Fired",
      affectedResource: "aks-mcp-server-prod",
      resourceType: "Microsoft.ContainerService/managedClusters",
      signalType: "Log",
      description: "Null reference error in work items handler when accessing parent field.",
      condition: "ContainerLog | where LogEntry contains 'TypeError: Cannot read properties of undefined'",
      threshold: "Count > 0 within 1 minute",
      actualValue: "5 occurrences in last minute",
      dimensions: [
        { key: "Subscription", value: "Enterprise Production" },
        { key: "Resource Group", value: "rg-mcp-servers-prod" },
        { key: "Cluster", value: "aks-mcp-server-prod" },
        { key: "Namespace", value: "mcp-system" },
        { key: "File", value: "src/tools/workitems.ts" },
        { key: "Line", value: "89" },
      ],
      logs: [
        { timestamp: fmt(125000), level: "INFO", service: "workitems", message: "Tool request received: wit_get_work_items_batch", details: "ids=[1234, 1235, 1236, 1237]" },
        { timestamp: fmt(123000), level: "DEBUG", service: "workitems", message: "Fetching work items from Azure DevOps", details: "project=AzureDevOps, expand=Relations" },
        { timestamp: fmt(120000), level: "DEBUG", service: "workitems", message: "Processing work item", details: "id=1236, type=Task" },
        { timestamp: fmt(118000), level: "ERROR", service: "workitems", message: "TypeError: Cannot read properties of undefined (reading 'id')", details: "workItemId=1236, field=System.Parent", stackTrace: `TypeError: Cannot read properties of undefined (reading 'id')
    at getParentId (src/tools/workitems.ts:89:34)
    at formatWorkItem (src/tools/workitems.ts:156:20)
    at Array.map (<anonymous>)
    at getWorkItemsBatch (src/tools/workitems.ts:67:18)
    at processToolRequest (src/server.ts:234:18)

Root cause: Work item 1236 has no parent relationship, but code assumes
relations.find(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse')
always returns a value. Missing null check before accessing .url property.` },
        { timestamp: fmt(115000), level: "ERROR", service: "mcp-server", message: "Tool execution failed", details: "tool=wit_get_work_items_batch, error=TypeError" },
      ],
      actionsTaken: [
        { time: fmt(116000), action: "Alert rule evaluated", status: "Condition met" },
        { time: fmt(115500), action: "Action group triggered: ag-devin-triage", status: "Success" },
        { time: fmt(115000), action: "Webhook called: Devin-AI-Webhook", status: "Success (201)" },
        { time: fmt(114500), action: "Devin session created", status: "session_1707252412345" },
      ],
    },
  };
  
  return configs[type];
}

// ============================================================================
// ICONS
// ============================================================================
const Icons = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  document: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  lightbulb: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  database: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  plus: "M12 4v16m8-8H4",
  refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  x: "M6 18L18 6M6 6l12 12",
  chevronRight: "M9 5l7 7-7 7",
  chevronDown: "M19 9l-7 7-7-7",
  externalLink: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  terminal: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M5 13l4 4L19 7",
  exclamation: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  cpu: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
};

function Icon({ name, className = "w-4 h-4" }: { name: keyof typeof Icons; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={Icons[name]} />
    </svg>
  );
}

// ============================================================================
// UI COMPONENTS
// ============================================================================
function SeverityBadge({ severity }: { severity: number }) {
  const config: Record<number, { bg: string; text: string; label: string }> = {
    0: { bg: "bg-[#a80000]", text: "text-white", label: "Sev 0 - Critical" },
    1: { bg: "bg-[#d83b01]", text: "text-white", label: "Sev 1 - Error" },
    2: { bg: "bg-[#ffaa44]", text: "text-[#323130]", label: "Sev 2 - Warning" },
    3: { bg: "bg-[#0078d4]", text: "text-white", label: "Sev 3 - Informational" },
    4: { bg: "bg-[#8764b8]", text: "text-white", label: "Sev 4 - Verbose" },
  };
  const c = config[severity] || config[3];
  return <span className={`${c.bg} ${c.text} px-2 py-0.5 text-xs font-semibold rounded-sm`}>{c.label}</span>;
}

function SeverityBadgeShort({ severity }: { severity: number }) {
  const config: Record<number, { bg: string; text: string }> = {
    0: { bg: "bg-[#a80000]", text: "text-white" },
    1: { bg: "bg-[#d83b01]", text: "text-white" },
    2: { bg: "bg-[#ffaa44]", text: "text-[#323130]" },
    3: { bg: "bg-[#0078d4]", text: "text-white" },
    4: { bg: "bg-[#8764b8]", text: "text-white" },
  };
  const c = config[severity] || config[3];
  return <span className={`${c.bg} ${c.text} px-2 py-0.5 text-xs font-semibold rounded-sm`}>Sev {severity}</span>;
}

function StatusBadge({ status }: { status: "Fired" | "Resolved" }) {
  if (status === "Fired") {
    return <span className="px-2 py-0.5 bg-[#fde7e9] text-[#a80000] text-xs font-medium rounded">Fired</span>;
  }
  return <span className="px-2 py-0.5 bg-[#dff6dd] text-[#107c10] text-xs font-medium rounded">Resolved</span>;
}

function Modal({ open, onClose, title, width = "max-w-3xl", children }: { open: boolean; onClose: () => void; title: string; width?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="azure-modal-backdrop" onClick={onClose}>
      <div className={`azure-modal ${width}`} onClick={e => e.stopPropagation()}>
        <div className="azure-modal-header">
          <h2 className="azure-modal-title">{title}</h2>
          <button onClick={onClose} className="azure-modal-close"><Icon name="x" /></button>
        </div>
        <div className="azure-modal-body">{children}</div>
      </div>
    </div>
  );
}

function AzureInput({ label, value, onChange, placeholder, type = "text", mono = false, helper, required = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean; helper?: string; required?: boolean }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-[#323130] mb-1">{label}{required && <span className="text-[#a80000] ml-1">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`azure-input ${mono ? "mono" : ""}`} />
      {helper && <p className="text-xs text-[#605e5c] mt-1">{helper}</p>}
    </div>
  );
}

function AzureSelect({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-[#323130] mb-1">{label}{required && <span className="text-[#a80000] ml-1">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="azure-select">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function AzureCheckbox({ label, checked, onChange, helper }: { label: string; checked: boolean; onChange: (v: boolean) => void; helper?: string }) {
  return (
    <div className="mb-3">
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="azure-checkbox mt-0.5" />
        <div>
          <span className="text-sm text-[#323130]">{label}</span>
          {helper && <p className="text-xs text-[#605e5c] mt-0.5">{helper}</p>}
        </div>
      </label>
    </div>
  );
}

function AzureTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="azure-tabs mb-4">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`azure-tab ${active === t.id ? "active" : ""}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// ALERT DETAIL PANEL (The key new component!)
// ============================================================================
function AlertDetailPanel({ alert, onClose, devinSession }: { alert: Alert; onClose: () => void; devinSession?: DevinNotification }) {
  const [tab, setTab] = useState<"summary" | "history" | "diagnostics" | "actions">("summary");

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      
      {/* Panel - Azure-style blade from right */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-4xl bg-white shadow-2xl flex flex-col animate-slide-in">
        {/* Panel Header */}
        <div className="bg-[#f3f2f1] border-b border-[#edebe9] px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#d83b01] rounded flex items-center justify-center text-white">
                <Icon name="bell" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#323130]">{alert.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status} />
                  <span className="text-sm text-[#605e5c]">Fired at {new Date(alert.firedTime).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#edebe9] rounded">
              <Icon name="x" className="w-5 h-5 text-[#605e5c]" />
            </button>
          </div>
        </div>

        {/* Devin Session Banner */}
        {devinSession && (
          <div className={`px-6 py-3 flex items-center justify-between ${devinSession.status === "complete" ? "bg-[#dff6dd] border-b border-[#107c10]/20" : "bg-[#deecf9] border-b border-[#0078d4]/20"}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold text-sm">D</div>
              <div>
                <div className="text-sm font-semibold text-[#323130]">
                  {devinSession.status === "creating" && "🚀 Creating Devin session..."}
                  {devinSession.status === "analyzing" && "🔍 Devin is analyzing the codebase..."}
                  {devinSession.status === "fixing" && "🔧 Devin is implementing a fix..."}
                  {devinSession.status === "complete" && "✅ Devin has created a Pull Request!"}
                </div>
                <div className="text-xs text-[#605e5c]">{devinSession.sessionId}</div>
              </div>
            </div>
            <a href={devinSession.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-black text-white text-sm rounded hover:bg-gray-800">
              Open Devin Session <Icon name="externalLink" className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-[#edebe9]">
          <AzureTabs 
            tabs={[
              { id: "summary", label: "Summary" },
              { id: "history", label: "History" },
              { id: "diagnostics", label: "Diagnostics" },
              { id: "actions", label: "Actions Taken" },
            ]}
            active={tab}
            onChange={t => setTab(t as typeof tab)}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-[#faf9f8]">
          {/* Summary Tab */}
          {tab === "summary" && (
            <div className="space-y-6">
              {/* Why it Fired */}
              <div className="bg-white border border-[#edebe9] rounded p-4">
                <h3 className="text-base font-semibold text-[#323130] mb-3 flex items-center gap-2">
                  <Icon name="exclamation" className="w-5 h-5 text-[#d83b01]" />
                  Why this alert fired
                </h3>
                <p className="text-sm text-[#323130] mb-4">{alert.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[#605e5c] mb-1">Signal type</div>
                    <div className="font-medium text-[#323130]">{alert.signalType}</div>
                  </div>
                  <div>
                    <div className="text-[#605e5c] mb-1">Affected resource</div>
                    <div className="font-medium text-[#0078d4]">{alert.affectedResource}</div>
                  </div>
                  <div>
                    <div className="text-[#605e5c] mb-1">Resource type</div>
                    <div className="font-medium text-[#323130]">{alert.resourceType}</div>
                  </div>
                  <div>
                    <div className="text-[#605e5c] mb-1">Signal type</div>
                    <div className="font-medium text-[#323130]">{alert.signalType}</div>
                  </div>
                </div>
              </div>

              {/* Condition that Triggered */}
              <div className="bg-white border border-[#edebe9] rounded p-4">
                <h3 className="text-base font-semibold text-[#323130] mb-3 flex items-center gap-2">
                  <Icon name="chart" className="w-5 h-5 text-[#0078d4]" />
                  Alert condition
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-[#faf9f8] rounded font-mono text-xs text-[#323130]">
                    {alert.condition}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[#605e5c] mb-1">Threshold</div>
                      <div className="font-medium text-[#323130]">{alert.threshold}</div>
                    </div>
                    <div>
                      <div className="text-[#605e5c] mb-1">Actual value</div>
                      <div className="font-semibold text-[#d83b01]">{alert.actualValue}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div className="bg-white border border-[#edebe9] rounded p-4">
                <h3 className="text-base font-semibold text-[#323130] mb-3 flex items-center gap-2">
                  <Icon name="database" className="w-5 h-5 text-[#8764b8]" />
                  Dimensions
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {alert.dimensions.map((d, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-[#edebe9] last:border-0">
                      <span className="text-[#605e5c]">{d.key}</span>
                      <span className="font-medium text-[#323130]">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div className="space-y-4">
              <div className="bg-white border border-[#edebe9] rounded p-4">
                <h3 className="text-base font-semibold text-[#323130] mb-4 flex items-center gap-2">
                  <Icon name="clock" className="w-5 h-5 text-[#0078d4]" />
                  Alert history
                </h3>
                <div className="relative pl-4 border-l-2 border-[#edebe9] space-y-4">
                  <div className="relative">
                    <div className="absolute -left-[21px] w-4 h-4 bg-[#d83b01] rounded-full border-2 border-white" />
                    <div className="text-sm">
                      <div className="font-semibold text-[#d83b01]">Alert Fired</div>
                      <div className="text-[#605e5c]">{new Date(alert.firedTime).toLocaleString()}</div>
                      <div className="mt-1 text-[#323130]">{alert.description}</div>
                    </div>
                  </div>
                  {alert.actionsTaken.map((action, i) => (
                    <div key={i} className="relative">
                      <div className={`absolute -left-[21px] w-4 h-4 rounded-full border-2 border-white ${action.status.includes("Success") || action.status.includes("Delivered") ? "bg-[#107c10]" : "bg-[#0078d4]"}`} />
                      <div className="text-sm">
                        <div className="font-medium text-[#323130]">{action.action}</div>
                        <div className="text-[#605e5c]">{new Date(action.time).toLocaleTimeString()}</div>
                        <div className="text-xs text-[#605e5c]">Status: {action.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Diagnostics Tab - THE LOGS */}
          {tab === "diagnostics" && (
            <div className="space-y-4">
              <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
                <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#edebe9] flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[#323130] flex items-center gap-2">
                    <Icon name="terminal" className="w-5 h-5 text-[#0078d4]" />
                    Related logs
                  </h3>
                  <span className="text-xs text-[#605e5c]">{alert.logs.length} entries</span>
                </div>
                <div className="p-4 bg-[#1e1e1e] font-mono text-xs max-h-[500px] overflow-auto">
                  {alert.logs.map((log, i) => (
                    <div key={i} className="py-2 border-b border-[#333] last:border-0">
                      <div className="flex items-start gap-3">
                        <span className="text-[#858585] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={`shrink-0 font-semibold ${log.level === "ERROR" ? "text-[#f48771]" : log.level === "WARN" ? "text-[#cca700]" : log.level === "INFO" ? "text-[#3dc9b0]" : "text-[#858585]"}`}>
                          [{log.level}]
                        </span>
                        <span className="text-[#c586c0] shrink-0">{log.service}</span>
                        <span className="text-[#d4d4d4]">{log.message}</span>
                      </div>
                      {log.details && (
                        <div className="mt-1 ml-20 text-[#858585]">{log.details}</div>
                      )}
                      {log.stackTrace && (
                        <div className="mt-2 ml-20 p-2 bg-[#2d2d2d] rounded text-[#ce9178] whitespace-pre-wrap">{log.stackTrace}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Root Cause Analysis */}
              {alert.logs.some(l => l.stackTrace) && (
                <div className="bg-white border border-[#d83b01] rounded p-4">
                  <h3 className="text-base font-semibold text-[#d83b01] mb-2 flex items-center gap-2">
                    <Icon name="exclamation" className="w-5 h-5" />
                    Root Cause Identified
                  </h3>
                  <p className="text-sm text-[#323130]">
                    {alert.name === "mcp-token-expiration" && "The Azure AD access token expired and was not properly refreshed. The token refresh logic at src/tools/auth.ts:14 does not handle the AADSTS700024 error case."}
                    {alert.name === "mcp-api-timeout" && "API requests to Azure DevOps are timing out due to no configured timeout value. The axios request at src/tools/builds.ts:178 should have a timeout configuration."}
                    {alert.name === "mcp-null-reference-error" && "Work items without parent relationships cause a null reference error. The code at src/tools/workitems.ts:89 assumes all work items have a parent relation."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions Taken Tab */}
          {tab === "actions" && (
            <div className="space-y-4">
              <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
                <table className="azure-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alert.actionsTaken.map((action, i) => (
                      <tr key={i}>
                        <td className="text-[#605e5c] whitespace-nowrap">{new Date(action.time).toLocaleTimeString()}</td>
                        <td className="text-[#323130]">{action.action}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${action.status.includes("Success") || action.status.includes("Delivered") ? "bg-[#dff6dd] text-[#107c10]" : "bg-[#deecf9] text-[#0078d4]"}`}>
                            {action.status.includes("Success") || action.status.includes("Delivered") ? <Icon name="check" className="w-3 h-3" /> : null}
                            {action.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {devinSession && (
                <div className="bg-white border border-[#107c10] rounded p-4">
                  <h3 className="text-base font-semibold text-[#107c10] mb-3 flex items-center gap-2">
                    <Icon name="check" className="w-5 h-5" />
                    Automated Remediation Active
                  </h3>
                  <p className="text-sm text-[#323130] mb-3">
                    Devin AI has been triggered to analyze this issue and implement a fix. The session is actively working on the codebase.
                  </p>
                  <div className="flex items-center gap-4">
                    <a href={devinSession.url} target="_blank" rel="noopener noreferrer" className="azure-btn-primary">
                      View Devin Session <Icon name="externalLink" className="w-4 h-4" />
                    </a>
                    <a href="https://github.com/COG-GTM/azure-devops-mcp/pulls" target="_blank" rel="noopener noreferrer" className="azure-btn-secondary">
                      View Pull Requests
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// AZURE MONITOR DEMO
// ============================================================================
function AzureMonitorDemo({ onDevinNotification, devinSessions }: { onDevinNotification: (n: DevinNotification) => void; devinSessions: DevinNotification[] }) {
  const [nav, setNav] = useState<string>("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  
  // Modals
  const [actionGroupModal, setActionGroupModal] = useState(false);
  const [processingRuleModal, setProcessingRuleModal] = useState(false);
  const [alertRuleModal, setAlertRuleModal] = useState(false);
  
  // Action Group Form State
  const [agTab, setAgTab] = useState("basics");
  const [actionGroup, setActionGroup] = useState({
    subscription: "Enterprise Production",
    resourceGroup: "rg-mcp-servers-prod",
    name: "ag-devin-triage",
    displayName: "Devin AI Triage",
    region: "Global",
    emailARM: false,
    email: "oncall@company.com",
    emailEnabled: true,
    smsEnabled: false,
    webhookName: "Devin-AI-Webhook",
    webhookUri: "https://api.devin.ai/v1/sessions",
    webhookApiKey: "",
    webhookEnabled: true,
    commonAlertSchema: true,
  });

  // Alert Processing Rule State
  const [processingRule] = useState({
    name: "devin-auto-triage-rule",
    scope: "Subscription",
    filterSeverity: ["Sev 0", "Sev 1"],
    action: "apply",
    actionGroup: "ag-devin-triage",
    scheduleType: "always",
  });

  const triggerAlert = async (type: "auth" | "timeout" | "nullref") => {
    setIsTriggering(true);
    const alertData = generateAlertData(type);
    const alert: Alert = {
      ...alertData,
      id: crypto.randomUUID(),
      firedTime: new Date().toISOString(),
    };
    setAlerts(prev => [alert, ...prev]);
    setNav("alerts");

    await new Promise(r => setTimeout(r, 1500));
    const sessionId = `session_${Date.now()}`;
    const sessionUrl = `https://app.devin.ai/sessions/${sessionId}`;
    
    onDevinNotification({ id: crypto.randomUUID(), sessionId, url: sessionUrl, alertName: alert.name, status: "creating", timestamp: new Date().toISOString() });
    setTimeout(() => onDevinNotification({ id: crypto.randomUUID(), sessionId, url: sessionUrl, alertName: alert.name, status: "analyzing", timestamp: new Date().toISOString() }), 3000);
    setTimeout(() => onDevinNotification({ id: crypto.randomUUID(), sessionId, url: sessionUrl, alertName: alert.name, status: "complete", timestamp: new Date().toISOString() }), 8000);
    setIsTriggering(false);
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: "home" as const },
    { id: "alerts", label: "Alerts", icon: "bell" as const, badge: alerts.length || undefined },
    { id: "metrics", label: "Metrics", icon: "chart" as const },
    { id: "logs", label: "Logs", icon: "document" as const },
    { id: "service-health", label: "Service Health", icon: "heart" as const },
    { id: "workbooks", label: "Workbooks", icon: "book" as const },
    { id: "insights", label: "Insights", icon: "lightbulb" as const },
  ];

  const manageItems = [
    { id: "action-groups", label: "Action groups", icon: "users" as const },
    { id: "alert-rules", label: "Alert rules", icon: "clipboard" as const },
    { id: "processing-rules", label: "Alert processing rules", icon: "cog" as const },
    { id: "data-collection", label: "Data collection rules", icon: "database" as const },
  ];

  const getDevinSessionForAlert = (alertName: string) => {
    return devinSessions.find(s => s.alertName === alertName);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#faf9f8]">
      {/* Azure Header */}
      <header className="azure-header">
        <div className="flex items-center gap-3">
          <button className="azure-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505l7.725-16.553z"/></svg>
            <span className="font-semibold text-white">Microsoft Azure</span>
          </div>
          <div className="ml-2 px-2 py-0.5 bg-white/10 rounded text-xs text-white/90">Enterprise Production</div>
        </div>
        <div className="ml-6 flex-1 max-w-md">
          <input placeholder="Search resources, services, and docs (G+/)" className="azure-header-search w-full" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className="azure-header-icon" title="Cloud Shell"><Icon name="terminal" /></button>
          <button className="azure-header-icon" title="Notifications"><Icon name="bell" /></button>
          <button className="azure-header-icon" title="Settings"><Icon name="cog" /></button>
          <div className="w-8 h-8 bg-[#5c2d91] rounded-full flex items-center justify-center text-xs font-semibold text-white ml-2">JC</div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="azure-breadcrumb">
        <a href="#">Home</a>
        <span className="azure-breadcrumb-separator">›</span>
        <a href="#">Monitor</a>
        <span className="azure-breadcrumb-separator">›</span>
        <span className="text-[#323130] capitalize">{nav.replace("-", " ")}</span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left Nav */}
        <nav className="azure-nav py-2 overflow-y-auto">
          <div className="azure-nav-section">Monitor</div>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} className={`azure-nav-item ${nav === item.id ? "active" : ""}`}>
              <Icon name={item.icon} />
              <span className="truncate">{item.label}</span>
              {item.badge ? <span className="azure-nav-badge">{item.badge}</span> : null}
            </button>
          ))}
          
          <div className="azure-nav-section mt-4">Manage</div>
          {manageItems.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} className={`azure-nav-item ${nav === item.id ? "active" : ""}`}>
              <Icon name={item.icon} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}

          {/* Demo Triggers */}
          <div className="azure-nav-section mt-6">🧪 Demo Triggers</div>
          <div className="px-3 space-y-1">
            {[
              { type: "auth" as const, label: "Token Expiration", severity: 1 },
              { type: "timeout" as const, label: "API Timeout", severity: 1 },
              { type: "nullref" as const, label: "Null Reference", severity: 1 },
            ].map(a => (
              <button key={a.type} disabled={isTriggering} onClick={() => triggerAlert(a.type)} className="w-full text-left px-3 py-2 text-xs bg-white border border-[#edebe9] rounded hover:border-[#0078d4] disabled:opacity-50 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-[#d83b01]`}/>
                <span className="flex-1">{a.label}</span>
                <SeverityBadgeShort severity={a.severity} />
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Page Header */}
          <div className="azure-page-header">
            <div className="flex items-center gap-4">
              <div className="azure-page-icon">
                <Icon name="bell" className="w-5 h-5" />
              </div>
              <div>
                <h1 className="azure-page-title capitalize">{nav.replace("-", " ")}</h1>
                <p className="azure-page-subtitle">rg-mcp-servers-prod • Enterprise Production</p>
              </div>
            </div>
            <div className="flex gap-2">
              {nav === "action-groups" && (
                <button onClick={() => { setAgTab("basics"); setActionGroupModal(true); }} className="azure-btn-primary">
                  <Icon name="plus" /> Create
                </button>
              )}
              {nav === "alert-rules" && (
                <button onClick={() => setAlertRuleModal(true)} className="azure-btn-primary">
                  <Icon name="plus" /> Create
                </button>
              )}
              {nav === "processing-rules" && (
                <button onClick={() => setProcessingRuleModal(true)} className="azure-btn-primary">
                  <Icon name="plus" /> Create
                </button>
              )}
              <button className="azure-btn-secondary">
                <Icon name="refresh" /> Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {/* Alerts */}
            {nav === "alerts" && (
              alerts.length === 0 ? (
                <div className="azure-card p-16 text-center">
                  <div className="w-16 h-16 bg-[#f3f2f1] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon name="check" className="w-8 h-8 text-[#107c10]" />
                  </div>
                  <div className="text-lg text-[#323130] mb-1">No fired alerts</div>
                  <div className="text-sm text-[#605e5c]">Use Demo Triggers in the left panel to simulate alerts</div>
                </div>
              ) : (
                <div className="azure-card overflow-hidden">
                  <table className="azure-table">
                    <thead>
                      <tr>
                        <th>Severity</th>
                        <th>Alert name</th>
                        <th>Monitor condition</th>
                        <th>Affected resource</th>
                        <th>Signal type</th>
                        <th>Fired time</th>
                        <th>Devin Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map(a => {
                        const session = getDevinSessionForAlert(a.name);
                        return (
                          <tr key={a.id} className="cursor-pointer" onClick={() => setSelectedAlert(a)}>
                            <td><SeverityBadgeShort severity={a.severity}/></td>
                            <td className="text-[#0078d4] hover:underline font-medium">{a.name}</td>
                            <td><StatusBadge status={a.status} /></td>
                            <td className="text-[#323130]">{a.affectedResource}</td>
                            <td className="text-[#605e5c]">{a.signalType}</td>
                            <td className="text-[#605e5c]">{new Date(a.firedTime).toLocaleTimeString()}</td>
                            <td>
                              {session ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${session.status === "complete" ? "bg-[#dff6dd] text-[#107c10]" : "bg-[#deecf9] text-[#0078d4]"}`}>
                                  {session.status === "complete" ? <Icon name="check" className="w-3 h-3" /> : <span className="w-2 h-2 rounded-full bg-current animate-pulse" />}
                                  {session.status === "creating" && "Creating..."}
                                  {session.status === "analyzing" && "Analyzing..."}
                                  {session.status === "fixing" && "Fixing..."}
                                  {session.status === "complete" && "PR Created"}
                                </span>
                              ) : (
                                <span className="text-[#605e5c] text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Other nav content... */}
            {nav === "overview" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="azure-card p-4">
                  <div className="text-sm text-[#605e5c]">Fired alerts</div>
                  <div className="text-3xl font-semibold text-[#d83b01]">{alerts.length}</div>
                </div>
                <div className="azure-card p-4">
                  <div className="text-sm text-[#605e5c]">Alert rules</div>
                  <div className="text-3xl font-semibold text-[#0078d4]">3</div>
                </div>
                <div className="azure-card p-4">
                  <div className="text-sm text-[#605e5c]">Action groups</div>
                  <div className="text-3xl font-semibold text-[#107c10]">1</div>
                </div>
              </div>
            )}

            {nav === "logs" && (
              <div className="azure-card overflow-hidden">
                <div className="p-4 border-b border-[#edebe9]">
                  <input defaultValue='ContainerLog | where Level in ("ERROR","WARN") | order by TimeGenerated desc | take 100' className="azure-input mono" />
                  <div className="flex gap-4 mt-2 text-xs text-[#605e5c]">
                    <span>Time range: Last 24 hours</span>
                    <span>•</span>
                    <span>Scope: aks-mcp-server-prod</span>
                  </div>
                </div>
                <div className="p-4 bg-[#1e1e1e] font-mono text-xs text-[#d4d4d4] min-h-[200px]">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-[#858585]">Trigger an alert to see logs here</div>
                  ) : (
                    alerts[0].logs.slice(0, 5).map((l, i) => (
                      <div key={i} className="py-1">
                        <span className="text-[#858585] mr-3">{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span className={`mr-3 ${l.level === "ERROR" ? "text-[#f48771]" : l.level === "WARN" ? "text-[#cca700]" : "text-[#3dc9b0]"}`}>{l.level}</span>
                        <span className="text-[#c586c0] mr-3">{l.service}</span>
                        <span>{l.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {nav === "action-groups" && (
              <div className="space-y-4">
                <div className="azure-card overflow-hidden">
                  <table className="azure-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Display name</th>
                        <th>Resource group</th>
                        <th>Notifications</th>
                        <th>Actions</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-[#0078d4] hover:underline cursor-pointer" onClick={() => { setAgTab("basics"); setActionGroupModal(true); }}>{actionGroup.name}</td>
                        <td>{actionGroup.displayName}</td>
                        <td className="text-[#605e5c]">{actionGroup.resourceGroup}</td>
                        <td>{actionGroup.emailEnabled && <span className="azure-badge-info">Email</span>}</td>
                        <td>{actionGroup.webhookEnabled && <span className="azure-badge-success">Webhook</span>}</td>
                        <td>
                          <button onClick={() => { setAgTab("basics"); setActionGroupModal(true); }} className="text-[#0078d4] text-sm hover:underline">Edit</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Webhook Status */}
                <div className="azure-card p-4 border-[#107c10]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-black rounded flex items-center justify-center text-white font-bold">D</div>
                      <div>
                        <div className="font-semibold text-[#323130]">{actionGroup.webhookName}</div>
                        <div className="text-xs text-[#605e5c]">Triggers Devin AI for automated triage</div>
                      </div>
                    </div>
                    <button onClick={() => { setAgTab("actions"); setActionGroupModal(true); }} className="text-[#0078d4] text-sm hover:underline">Configure</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-[#605e5c]">URI:</span> <code className="text-xs bg-[#faf9f8] px-1 rounded">{actionGroup.webhookUri}</code></div>
                    <div><span className="text-[#605e5c]">API Key:</span> {actionGroup.webhookApiKey ? <span className="text-[#107c10]">✓ Configured</span> : <span className="text-[#d83b01]">⚠ Not set</span>}</div>
                  </div>
                </div>
              </div>
            )}

            {nav === "alert-rules" && (
              <div className="azure-card overflow-hidden">
                <table className="azure-table">
                  <thead>
                    <tr><th>Severity</th><th>Name</th><th>Signal type</th><th>Target resource</th><th>Action group</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {[{ name: "mcp-token-expiration-rule", signal: "Log" }, { name: "mcp-api-timeout-rule", signal: "Metric" }, { name: "mcp-error-rate-rule", signal: "Log" }].map((r, i) => (
                      <tr key={i}>
                        <td><SeverityBadgeShort severity={1}/></td>
                        <td className="text-[#0078d4]">{r.name}</td>
                        <td className="text-[#605e5c]">{r.signal}</td>
                        <td>aks-mcp-server-prod</td>
                        <td className="text-[#0078d4]">{actionGroup.name}</td>
                        <td><span className="text-[#107c10]">● Enabled</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {nav === "processing-rules" && (
              <div className="space-y-4">
                <div className="p-4 bg-[#deecf9] border border-[#0078d4]/20 rounded text-sm text-[#323130]">
                  <strong>Alert processing rules</strong> let you apply actions on fired alerts — add action groups or suppress notifications based on scope, severity, and schedule.
                </div>
                <div className="azure-card overflow-hidden">
                  <table className="azure-table">
                    <thead>
                      <tr><th>Name</th><th>Scope</th><th>Filter</th><th>Action</th><th>Schedule</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-[#0078d4] hover:underline cursor-pointer" onClick={() => setProcessingRuleModal(true)}>{processingRule.name}</td>
                        <td>{processingRule.scope}</td>
                        <td className="text-[#605e5c]">{processingRule.filterSeverity.join(", ")}</td>
                        <td><span className="azure-badge-success">Apply: {processingRule.actionGroup}</span></td>
                        <td className="text-[#605e5c] capitalize">{processingRule.scheduleType}</td>
                        <td><span className="text-[#107c10]">● Enabled</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!["alerts", "overview", "logs", "action-groups", "alert-rules", "processing-rules"].includes(nav) && (
              <div className="azure-card p-6 text-center">
                <div className="text-lg text-[#323130] mb-1 capitalize">{nav.replace("-", " ")}</div>
                <div className="text-sm text-[#605e5c]">This section contains {nav.replace("-", " ")} features</div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Alert Detail Panel */}
      {selectedAlert && (
        <AlertDetailPanel 
          alert={selectedAlert} 
          onClose={() => setSelectedAlert(null)} 
          devinSession={getDevinSessionForAlert(selectedAlert.name)}
        />
      )}

      {/* Action Group Modal */}
      <Modal open={actionGroupModal} onClose={() => setActionGroupModal(false)} title="Create/Edit action group" width="max-w-4xl">
        <AzureTabs tabs={[{ id: "basics", label: "Basics" }, { id: "notifications", label: "Notifications" }, { id: "actions", label: "Actions" }]} active={agTab} onChange={setAgTab} />
        
        {agTab === "basics" && (
          <div>
            <h3 className="font-semibold text-[#323130] mb-3">Project details</h3>
            <AzureSelect label="Subscription" value={actionGroup.subscription} onChange={v => setActionGroup({...actionGroup, subscription: v})} options={[{ value: "Enterprise Production", label: "Enterprise Production" }]} required />
            <AzureSelect label="Resource group" value={actionGroup.resourceGroup} onChange={v => setActionGroup({...actionGroup, resourceGroup: v})} options={[{ value: "rg-mcp-servers-prod", label: "rg-mcp-servers-prod" }]} required />
            
            <h3 className="font-semibold text-[#323130] mt-6 mb-3">Instance details</h3>
            <AzureInput label="Action group name" value={actionGroup.name} onChange={v => setActionGroup({...actionGroup, name: v})} required />
            <AzureInput label="Display name" value={actionGroup.displayName} onChange={v => setActionGroup({...actionGroup, displayName: v})} helper="This name appears in notifications" required />
          </div>
        )}

        {agTab === "notifications" && (
          <div>
            <p className="text-sm text-[#605e5c] mb-4">Define who gets notified when an alert fires.</p>
            <div className="p-4 bg-[#faf9f8] rounded mb-4">
              <AzureCheckbox label="Email" checked={actionGroup.emailEnabled} onChange={v => setActionGroup({...actionGroup, emailEnabled: v})} />
              {actionGroup.emailEnabled && (
                <AzureInput label="Email address" value={actionGroup.email} onChange={v => setActionGroup({...actionGroup, email: v})} type="email" />
              )}
            </div>
            <AzureCheckbox label="Enable common alert schema" checked={actionGroup.commonAlertSchema} onChange={v => setActionGroup({...actionGroup, commonAlertSchema: v})} helper="Use a unified alert payload across all alert types" />
          </div>
        )}

        {agTab === "actions" && (
          <div>
            <p className="text-sm text-[#605e5c] mb-4">Define automated actions to trigger when an alert fires.</p>
            
            <div className="p-4 border border-[#107c10] bg-[#dff6dd]/30 rounded mb-4">
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={actionGroup.webhookEnabled} onChange={e => setActionGroup({...actionGroup, webhookEnabled: e.target.checked})} className="azure-checkbox" />
                <span className="font-semibold text-[#323130]">Webhook</span>
                <span className="px-2 py-0.5 bg-black text-white text-xs rounded font-semibold">Devin AI</span>
              </div>
              
              <AzureInput label="Name" value={actionGroup.webhookName} onChange={v => setActionGroup({...actionGroup, webhookName: v})} required />
              <AzureInput label="URI" value={actionGroup.webhookUri} onChange={v => setActionGroup({...actionGroup, webhookUri: v})} mono helper="Devin API endpoint for creating triage sessions" required />
              <AzureInput label="API Key (Authorization Header)" type="password" value={actionGroup.webhookApiKey} onChange={v => setActionGroup({...actionGroup, webhookApiKey: v})} helper="Get your API key from app.devin.ai/settings" required />
              
              <div className="mt-4 p-3 bg-[#1e1e1e] rounded">
                <div className="text-xs font-semibold text-[#858585] mb-2">Request Preview</div>
                <pre className="text-xs font-mono text-[#d4d4d4] whitespace-pre-wrap">{`POST ${actionGroup.webhookUri}
Authorization: Bearer ${actionGroup.webhookApiKey || "<API_KEY>"}
Content-Type: application/json

{
  "prompt": "AUTOMATED TRIAGE: <alert_context>",
  "repo_url": "https://github.com/COG-GTM/azure-devops-mcp"
}`}</pre>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-[#edebe9]">
          <button onClick={() => setActionGroupModal(false)} className="azure-btn-secondary">Cancel</button>
          <button onClick={() => setActionGroupModal(false)} className="azure-btn-primary">Save</button>
        </div>
      </Modal>

      {/* Processing Rule Modal */}
      <Modal open={processingRuleModal} onClose={() => setProcessingRuleModal(false)} title="Alert processing rule">
        <AzureSelect label="Scope" value={processingRule.scope} onChange={() => {}} options={[{ value: "Subscription", label: "Subscription: Enterprise Production" }]} required />
        <AzureSelect label="Severity filter" value="Sev 0, Sev 1" onChange={() => {}} options={[{ value: "Sev 0, Sev 1", label: "Sev 0, Sev 1 (Critical and Error)" }]} />
        <AzureSelect label="Action" value="apply" onChange={() => {}} options={[{ value: "apply", label: "Apply action group" }]} />
        <AzureSelect label="Action group" value="ag-devin-triage" onChange={() => {}} options={[{ value: "ag-devin-triage", label: "ag-devin-triage (Devin AI Triage)" }]} />
        <div className="flex justify-end gap-2 pt-4 border-t border-[#edebe9]">
          <button onClick={() => setProcessingRuleModal(false)} className="azure-btn-secondary">Cancel</button>
          <button onClick={() => setProcessingRuleModal(false)} className="azure-btn-primary">Save</button>
        </div>
      </Modal>

      {/* Alert Rule Modal */}
      <Modal open={alertRuleModal} onClose={() => setAlertRuleModal(false)} title="Create alert rule">
        <AzureInput label="Rule name" value="" onChange={() => {}} placeholder="e.g., mcp-error-rate-rule" required />
        <AzureSelect label="Severity" value="1" onChange={() => {}} options={[{ value: "0", label: "Sev 0 - Critical" }, { value: "1", label: "Sev 1 - Error" }, { value: "2", label: "Sev 2 - Warning" }]} />
        <AzureSelect label="Signal type" value="Log" onChange={() => {}} options={[{ value: "Log", label: "Log" }, { value: "Metric", label: "Metric" }]} />
        <AzureSelect label="Action group" value="ag-devin-triage" onChange={() => {}} options={[{ value: "ag-devin-triage", label: "ag-devin-triage" }]} />
        <div className="flex justify-end gap-2 pt-4 border-t border-[#edebe9]">
          <button onClick={() => setAlertRuleModal(false)} className="azure-btn-secondary">Cancel</button>
          <button onClick={() => setAlertRuleModal(false)} className="azure-btn-primary">Create</button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// ELASTIC DEMO (Simplified for now - can expand later)
// ============================================================================
function ElasticDemo({ onDevinNotification, devinSessions }: { onDevinNotification: (n: DevinNotification) => void; devinSessions: DevinNotification[] }) {
  const [nav, setNav] = useState("observability");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const triggerAlert = async (type: "auth" | "timeout" | "nullref") => {
    setIsTriggering(true);
    const alertData = generateAlertData(type);
    const alert: Alert = { ...alertData, id: crypto.randomUUID(), firedTime: new Date().toISOString() };
    setAlerts(prev => [alert, ...prev]);
    setNav("observability");

    await new Promise(r => setTimeout(r, 1500));
    const sessionId = `session_${Date.now()}`;
    onDevinNotification({ id: crypto.randomUUID(), sessionId, url: `https://app.devin.ai/sessions/${sessionId}`, alertName: alert.name, status: "creating", timestamp: new Date().toISOString() });
    setTimeout(() => onDevinNotification({ id: crypto.randomUUID(), sessionId, url: `https://app.devin.ai/sessions/${sessionId}`, alertName: alert.name, status: "analyzing", timestamp: new Date().toISOString() }), 3000);
    setTimeout(() => onDevinNotification({ id: crypto.randomUUID(), sessionId, url: `https://app.devin.ai/sessions/${sessionId}`, alertName: alert.name, status: "complete", timestamp: new Date().toISOString() }), 8000);
    setIsTriggering(false);
  };

  const getDevinSessionForAlert = (alertName: string) => devinSessions.find(s => s.alertName === alertName);

  return (
    <div className="eui-body flex-1 flex flex-col">
      {/* Elastic Header */}
      <header className="eui-header">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 eui-header-logo" viewBox="0 0 32 32" fill="currentColor"><path d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm0 4.8c2.783 0 5.358.988 7.358 2.634L7.434 23.358A11.146 11.146 0 014.8 16C4.8 9.813 9.813 4.8 16 4.8zm0 22.4c-2.783 0-5.358-.988-7.358-2.634L24.566 8.642A11.146 11.146 0 0127.2 16c0 6.187-5.013 11.2-11.2 11.2z"/></svg>
          <span className="text-lg font-semibold text-white">elastic</span>
        </div>
        <div className="ml-auto">
          <input placeholder="Search Elastic" className="w-64 px-3 py-1.5 bg-[#1d1e24] border border-[#343741] rounded text-sm text-white placeholder-gray-500" />
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Nav */}
        <nav className="eui-nav w-56 py-4">
          {[
            { id: "observability", label: "Observability", icon: Icons.chart },
            { id: "alerts", label: "Alerts", icon: Icons.bell },
            { id: "ml", label: "Machine Learning", icon: Icons.cpu },
          ].map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} className={`eui-nav-item ${nav === item.id ? "active" : ""}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon}/></svg>
              {item.label}
            </button>
          ))}

          <div className="mt-6 px-4">
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase">🧪 Demo</div>
            {[{ type: "auth" as const, label: "Token Anomaly" }, { type: "timeout" as const, label: "Latency Spike" }].map(t => (
              <button key={t.type} disabled={isTriggering} onClick={() => triggerAlert(t.type)} className="w-full text-left px-3 py-2 mb-1 text-xs bg-[#1d1e24] border border-[#343741] rounded text-gray-300 hover:border-[#00bfb3] disabled:opacity-50">
                <span className="inline-block w-2 h-2 rounded-full bg-[#f66] mr-2"/>{t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 bg-[#141519] overflow-auto">
          {nav === "observability" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[{ label: "Services", value: "12", color: "#00bfb3" }, { label: "Anomalies", value: alerts.length.toString(), color: "#f66" }].map((s, i) => (
                  <div key={i} className="eui-card p-4">
                    <div className="text-sm text-gray-400">{s.label}</div>
                    <div className="text-2xl font-semibold" style={{color: s.color}}>{s.value}</div>
                  </div>
                ))}
              </div>

              {alerts.length > 0 && (
                <div className="eui-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#343741] font-semibold text-white">Recent Alerts</div>
                  <table className="eui-table">
                    <thead>
                      <tr><th>Alert</th><th>Severity</th><th>Time</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {alerts.map(a => {
                        const session = getDevinSessionForAlert(a.name);
                        return (
                          <tr key={a.id} className="cursor-pointer" onClick={() => setSelectedAlert(a)}>
                            <td className="text-[#00bfb3]">{a.name}</td>
                            <td><SeverityBadgeShort severity={a.severity} /></td>
                            <td className="text-gray-400">{new Date(a.firedTime).toLocaleTimeString()}</td>
                            <td>
                              {session && (
                                <span className={`text-xs ${session.status === "complete" ? "text-green-400" : "text-blue-400"}`}>
                                  {session.status === "complete" ? "✓ PR Created" : "Analyzing..."}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Alert Detail - reuse the same panel */}
      {selectedAlert && (
        <AlertDetailPanel 
          alert={selectedAlert} 
          onClose={() => setSelectedAlert(null)} 
          devinSession={getDevinSessionForAlert(selectedAlert.name)}
        />
      )}
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  const [platform, setPlatform] = useState<"azure" | "elastic">("azure");
  const [notifications, setNotifications] = useState<DevinNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const addNotification = (n: DevinNotification) => {
    setNotifications(prev => {
      const existing = prev.findIndex(p => p.sessionId === n.sessionId);
      if (existing >= 0) { const updated = [...prev]; updated[existing] = n; return updated; }
      return [n, ...prev];
    });
  };

  const latest = notifications[0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Platform Switcher */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Devin AI Automated Triage Demo</span>
          <div className="flex bg-gray-800 rounded overflow-hidden">
            <button onClick={() => setPlatform("azure")} className={`px-4 py-1.5 ${platform === "azure" ? "bg-[#0078d4] text-white" : "text-gray-400 hover:text-white"}`}>Azure Monitor</button>
            <button onClick={() => setPlatform("elastic")} className={`px-4 py-1.5 ${platform === "elastic" ? "bg-[#00bfb3] text-black font-semibold" : "text-gray-400 hover:text-white"}`}>Elastic</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/COG-GTM/azure-devops-mcp" target="_blank" className="text-gray-400 hover:text-white text-xs">Target: COG-GTM/azure-devops-mcp</a>
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 hover:bg-gray-800 rounded">
            <Icon name="bell" className="w-5 h-5" />
            {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-xs flex items-center justify-center">{notifications.length}</span>}
          </button>
        </div>
      </div>

      {/* Devin Status Toast */}
      {latest && (
        <div className={`px-4 py-2 text-sm flex items-center justify-between ${latest.status === "complete" ? "bg-green-600" : "bg-blue-600"} text-white`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center font-bold">D</div>
            <span>
              {latest.status === "creating" && "🚀 Creating Devin session..."}
              {latest.status === "analyzing" && "🔍 Devin analyzing codebase..."}
              {latest.status === "fixing" && "🔧 Devin implementing fix..."}
              {latest.status === "complete" && "✅ Devin created PR!"}
            </span>
            <span className="text-white/70">({latest.alertName})</span>
          </div>
          <a href={latest.url} target="_blank" className="px-3 py-1 bg-white/20 rounded text-xs hover:bg-white/30">Open Session →</a>
        </div>
      )}

      {/* Notification Panel */}
      {showNotifications && (
        <div className="absolute right-4 top-20 w-80 bg-white rounded-lg shadow-2xl border z-50 max-h-96 overflow-auto">
          <div className="p-3 border-b font-semibold text-gray-900">Devin Sessions</div>
          {notifications.length === 0 ? <div className="p-4 text-center text-gray-500 text-sm">No sessions yet</div> : notifications.map(n => (
            <a key={n.id} href={n.url} target="_blank" className="block p-3 border-b hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${n.status === "complete" ? "bg-green-500" : "bg-blue-500 animate-pulse"}`}/>
                <span className="font-medium text-sm text-gray-900">{n.alertName}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{n.sessionId}</div>
            </a>
          ))}
        </div>
      )}

      {/* Platform Content */}
      {platform === "azure" ? (
        <AzureMonitorDemo onDevinNotification={addNotification} devinSessions={notifications} />
      ) : (
        <ElasticDemo onDevinNotification={addNotification} devinSessions={notifications} />
      )}
    </div>
  );
}
