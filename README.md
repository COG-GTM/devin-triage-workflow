# Devin AI Automated Alert Triage

> **Automatically triage, analyze, and fix production issues using Devin AI**

When alerts fire from Azure Monitor or Elastic, this system automatically triggers Devin to analyze the issue, identify root cause, implement fixes, create JIRA tickets, and notify your team on Slack.

![Demo](./docs/images/demo-flow.png)

## 🎯 What This Does

1. **Alert Fires** → Azure Monitor or Elastic detects an issue
2. **Webhook Triggers** → Calls your API endpoint with alert context
3. **Devin Analyzes** → Clones repo, traces error, identifies root cause
4. **Auto-Fix** → Creates PR with fix, tests, and documentation
5. **JIRA Ticket** → Full tracking with alert details, session link, PR link
6. **Slack Notification** → Team notified with status and links

## 🏗️ Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Azure Monitor  │     │      Elastic     │     │  Other Sources   │
│   (Action Group) │     │  (Watcher/Rules) │     │   (PagerDuty)    │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │    Webhook Endpoint     │
                    │   (Next.js API Route)   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Devin AI API       │
                    │    (v1/sessions POST)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  GitHub  │ │   JIRA   │ │  Slack   │
              │    PR    │ │  Ticket  │ │  Alert   │
              └──────────┘ └──────────┘ └──────────┘
```

## 📋 Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (or npm/yarn)
- [Devin AI Account](https://devin.ai/) with API access
- Azure Monitor or Elastic (for alert sources)
- Optional: JIRA, Slack, GitHub for full workflow

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/COG-GTM/devin-triage-workflow.git
cd devin-triage-workflow/demo-ui
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
DEVIN_API_KEY=your_devin_api_key_here
TARGET_REPO=https://github.com/your-org/your-repo
JIRA_PROJECT=YOUR_PROJECT_KEY
SLACK_CHANNEL=#alerts
```

### 3. Run the Demo

```bash
pnpm dev
```

Open http://localhost:3000 to see the demo UI.

### 4. Trigger a Test Alert

1. Click one of the demo triggers (Token Expiration, API Timeout, etc.)
2. Watch the Devin session get created
3. Click the session link to watch Devin work
4. Check your JIRA and Slack for updates

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Azure Monitor Setup](./docs/AZURE-MONITOR-SETUP.md) | Configure Azure to trigger Devin |
| [Elastic Setup](./docs/ELASTIC-SETUP.md) | Configure Elastic/Kibana to trigger Devin |
| [Devin Playbook](./docs/DEVIN-PLAYBOOK.md) | The 7-phase triage playbook |
| [API Reference](./docs/API-REFERENCE.md) | Webhook endpoint documentation |
| [Production Deployment](./docs/DEPLOYMENT.md) | Deploy to Vercel, AWS, etc. |

## 🔧 Configuration

### Devin API Key

Get your API key from [app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys):

- **Personal API Key** (`apk_user_*`): Works with v1 API, tied to your account
- **Service API Key** (`apk_*`): Org-scoped, good for automation
- **Service User Credential** (`cog_*`): v3 API with RBAC (enterprise)

### Playbook Association

For automatic playbook execution:

1. Create the playbook in Devin (see [docs/DEVIN-PLAYBOOK.md](./docs/DEVIN-PLAYBOOK.md))
2. Associate it with your API key in Settings
3. Every session from that key follows the playbook

## 🖥️ Demo UI Features

### Azure Monitor View
- Exact replica of Azure Portal UI
- Action Groups with webhook configuration
- Alert Processing Rules
- Alert details with logs and diagnostics

### Elastic View
- Kibana-style dark theme
- Alerting Rules and Connectors
- Watcher configuration
- ML Anomaly Detection jobs

### Both Views Include
- Demo alert triggers (Token Expiration, API Timeout, Null Reference)
- Click-to-expand alert details
- Real-time Devin session status
- Full error logs with stack traces

## 📊 The 7-Phase Triage Playbook

When Devin receives an alert, it follows this structured approach:

### Phase 1: Alert Analysis
Parse alert details, understand symptoms, document initial assessment

### Phase 2: Codebase Analysis
Clone repo, locate bug, trace stack, identify root cause

### Phase 3: Triage Decision
Choose path: Code Fix / Config Issue / External Issue / Needs Review

### Phase 4: Implement Fix
Minimal changes, error handling, tests, create PR

### Phase 5: JIRA Ticket
Create full tracking ticket with all context and links

### Phase 6: Slack Notification
Post status with JIRA, PR, and session links

### Phase 7: Wrap Up
Final summary with all artifacts and recommendations

## 🔌 Integrations

### Required
- **Devin AI** - The AI agent that performs triage

### Recommended
- **GitHub** - For PR creation and code access
- **JIRA** - For ticket tracking
- **Slack** - For team notifications

### Alert Sources (Choose One or More)
- **Azure Monitor** - Action Groups with webhooks
- **Elastic/Kibana** - Alerting Rules, Watcher, ML Anomaly
- **PagerDuty** - Webhooks
- **Datadog** - Webhooks
- **Any webhook-capable monitoring tool**

## 📁 Project Structure

```
devin-triage-workflow/
├── demo-ui/                    # Next.js demo application
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx        # Main demo UI (Azure + Elastic)
│   │       ├── globals.css     # Azure/Elastic design systems
│   │       └── api/
│   │           └── trigger-devin/
│   │               └── route.ts # Webhook endpoint
│   ├── .env.example            # Environment template
│   └── package.json
├── docs/                       # Documentation
│   ├── AZURE-MONITOR-SETUP.md
│   ├── ELASTIC-SETUP.md
│   ├── DEVIN-PLAYBOOK.md
│   ├── API-REFERENCE.md
│   └── DEPLOYMENT.md
└── README.md
```

## 🛡️ Security

- **Never commit API keys** - Use environment variables
- **Use GitHub Secrets** - For CI/CD deployments
- **Rotate keys regularly** - Especially after team changes
- **Audit sessions** - Review Devin's actions periodically

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- [Devin AI](https://devin.ai/) - The AI software engineer
- [Cognition](https://cognition.ai/) - Creators of Devin
- [Azure Monitor](https://azure.microsoft.com/en-us/products/monitor) - Microsoft's observability platform
- [Elastic](https://www.elastic.co/) - The search and observability company

---

**Built with 🔱 by the Cognition GTM Team**
