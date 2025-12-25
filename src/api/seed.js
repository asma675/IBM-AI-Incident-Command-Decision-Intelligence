import { db } from "./localDb";

// Seed the app with realistic starter data so the UI isn't empty on first load.
// This runs in the browser only (localStorage-backed); during build/SSR the db
// is in-memory and will reseed on runtime.
export function ensureSeeded() {
  const seeded = db.getMeta("seeded");
  if (seeded) return;

  const now = Date.now();
  const ago = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();

  const seedIncidents = [
    {
      id: "inc_001",
      created_date: ago(26),
      title: "Customer Portal intermittent login failures",
      description: "Users report intermittent login failures. Elevated 5xx at /auth/callback. Suspect token validation or upstream auth dependency.",
      severity: "high",
      status: "in_progress",
      source: "Monitoring",
      affected_systems: ["Identity Service", "Customer Portal"],
      assigned_to: "SRE On-Call",
    },
    {
      id: "inc_002",
      created_date: ago(52),
      title: "Payments API latency spike",
      description: "p95 latency jumped from 180ms to 1.9s. Timeout errors on checkout flow.",
      severity: "medium",
      status: "resolved",
      source: "Synthetic",
      affected_systems: ["Payments API", "Customer Portal"],
      resolved_at: ago(44),
      resolution_notes: "Rolled back config change and increased DB connection pool.",
      assigned_to: "Payments Team",
    },
    {
      id: "inc_003",
      created_date: ago(7),
      title: "Data pipeline delayed for hourly aggregations",
      description: "Hourly ETL jobs are delayed ~35 minutes; downstream dashboards stale.",
      severity: "low",
      status: "awaiting_approval",
      source: "Batch Monitoring",
      affected_systems: ["Data Pipeline"],
      assigned_to: "Data Ops",
    },
  ];

  const seedArticles = [
    {
      id: "kb_001",
      created_date: ago(120),
      title: "Runbook: Troubleshoot SSO callback failures",
      summary: "Steps to diagnose auth callback 5xx, token validation errors, and certificate/clock skew issues.",
      content: "## Checklist\n- Verify IdP status\n- Check token validation logs\n- Confirm certificate chain and time sync\n\n## Rollback\n- Revert recent auth config\n",
      tags: ["auth", "sso", "identity"],
      category: "runbook",
      status: "published",
    },
    {
      id: "kb_002",
      created_date: ago(200),
      title: "Runbook: Payments API latency and DB saturation",
      summary: "DB connection pool, slow queries, and cache strategies for checkout stability.",
      content: "## Signals\n- Connection pool saturation\n- Query timeouts\n\n## Mitigations\n- Increase pool cautiously\n- Enable read replica\n",
      tags: ["payments", "database", "latency"],
      category: "runbook",
      status: "published",
    },
  ];

  // Write directly into db tables while preserving db helpers.
  const dump = db._unsafeDump();
  dump.tables.Incident = seedIncidents;
  dump.tables.KnowledgeBaseArticle = seedArticles;
  dump.tables.AuditLog = [
    {
      id: "log_001",
      created_date: ago(26),
      updated_date: ago(26),
      incident_id: "inc_001",
      action_type: "incident_created",
      actor: "demo.user@example.com",
      details: { severity: "high", source: "Monitoring" },
    },
    {
      id: "log_002",
      created_date: ago(52),
      updated_date: ago(52),
      incident_id: "inc_002",
      action_type: "incident_created",
      actor: "demo.user@example.com",
      details: { severity: "medium", source: "Synthetic" },
    },
  ];
  dump.tables.Decision = [];
  dump.tables.PredictiveAlert = [
    {
      id: "pa_001",
      created_date: ago(3),
      updated_date: ago(3),
      title: "Elevated risk detected: Identity Service",
      system: "Identity Service",
      likelihood: 0.78,
      impact: "high",
      recommended_action: "Validate token validation errors and recent auth configuration changes.",
      status: "active",
      predicted_window: `${new Date(now + 60 * 60 * 1000).toISOString()} / ${new Date(now + 4 * 60 * 60 * 1000).toISOString()}`,
    },
  ];
  dump.tables.PostIncidentReview = [];
  dump.tables.IncidentAutomation = [];

  // Persist
  if (typeof window !== "undefined" && window?.localStorage) {
    window.localStorage.setItem("icdi_local_db_v1", JSON.stringify(dump));
  }
  db.setMeta("seeded", true);
}
