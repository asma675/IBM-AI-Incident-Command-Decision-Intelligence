// Local, self-contained client used by the app in StackBlitz/Vercel.
// Provides a small CRUD layer + "function" stubs that keep the UI behavior intact
// without relying on any external backend.

import { db } from "./localDb";
import { ensureSeeded } from "./seed";

ensureSeeded();

const entityFactory = (tableName) => {
  return {
    async list(sort = "-created_date", limit = 100) {
      return db.list(tableName, { sort, limit });
    },
    async filter(where = {}, sort = "-created_date", limit = 1000) {
      return db.filter(tableName, { where, sort, limit });
    },
    async create(data) {
      return db.create(tableName, data);
    },
    async update(id, data) {
      return db.update(tableName, id, data);
    },
    async delete(id) {
      return db.remove(tableName, id);
    },
  };
};

const auth = {
  async me() {
    // Simple local identity for demo/dev.
    const saved = db.getMeta("currentUser");
    if (saved) return saved;
    const user = {
      id: "user_demo",
      email: "demo.user@example.com",
      full_name: "Demo User",
    };
    db.setMeta("currentUser", user);
    return user;
  },
  async logout() {
    db.setMeta("currentUser", null);
    // Keep data by default; user can clear storage manually.
    if (typeof window !== "undefined") window.location.reload();
  },
};

// --- "AI" / utility functions (local deterministic stubs) ---
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function keywordScore(text, keywords = []) {
  const t = (text || "").toLowerCase();
  return keywords.reduce((acc, k) => (t.includes(k) ? acc + 1 : acc), 0);
}

function buildAnalysisFromIncident(incident) {
  const title = incident?.title || "Incident";
  const desc = incident?.description || incident?.logs || "";
  const sev = (incident?.severity || "medium").toLowerCase();
  const systems = incident?.affected_systems || [];

  const isAuth = keywordScore(`${title} ${desc}`, ["auth", "login", "token", "sso"]) > 0;
  const isDb = keywordScore(`${title} ${desc}`, ["db", "database", "postgres", "mysql", "query", "timeout"]) > 0;
  const isApi = keywordScore(`${title} ${desc}`, ["api", "5xx", "gateway", "latency", "timeout"]) > 0;

  const baseConf = {
    critical: 0.78,
    high: 0.72,
    medium: 0.66,
    low: 0.6,
  }[sev] ?? 0.66;

  const dataQualityPenalty = desc && desc.length > 40 ? 0 : 0.08;
  const confidence_score = clamp01(baseConf - dataQualityPenalty);

  const root_causes = [
    {
      cause: isDb
        ? "Database resource saturation (connections / slow queries)"
        : "Upstream dependency degradation (timeouts / elevated error rates)",
      probability: clamp01(0.45 + (isDb ? 0.15 : 0)),
      evidence: [
        "Symptoms consistent with latency spikes and partial availability",
        systems.length ? `Impacted systems: ${systems.slice(0, 3).join(", ")}` : "Systems not specified",
      ],
    },
    {
      cause: isAuth
        ? "Identity / token validation issue (SSO, cert, or token expiry)"
        : "Recent deployment or configuration change introduced regression",
      probability: clamp01(0.3 + (isAuth ? 0.2 : 0)),
      evidence: [
        "Common failure mode for sudden onset incidents",
        "Validate with change logs and auth/error traces",
      ],
    },
    {
      cause: isApi ? "API gateway/routing misconfiguration or rate limiting" : "Infrastructure/network instability",
      probability: clamp01(0.25 + (isApi ? 0.15 : 0)),
      evidence: [
        "Could present as widespread 5xx/4xx bursts",
        "Validate with edge metrics, load balancer health, and dependency graph",
      ],
    },
  ];

  const recommendations = [
    {
      action: "Check dashboards for error rates, latency, and saturation (CPU/memory/DB connections).",
      priority: sev === "critical" || sev === "high" ? "critical" : "high",
      confidence: clamp01(0.85 - dataQualityPenalty),
      rationale: "Quickly confirms whether the incident is systemic or isolated and identifies bottlenecks.",
      risks: "Low risk; read-only investigation.",
      verification_steps: [
        "Confirm error rate and p95/p99 latency against baseline",
        "Identify the top failing endpoint/service",
      ],
    },
    {
      action: "Validate recent changes (deployments/config) and consider rollback if correlated.",
      priority: sev === "critical" ? "critical" : "high",
      confidence: clamp01(0.72 - dataQualityPenalty),
      rationale: "Change correlation is frequently the fastest path to recovery.",
      risks: "Rollback may revert unrelated fixes; coordinate with release owner.",
      verification_steps: [
        "Compare start time vs deployment timeline",
        "If rollback, monitor key KPIs for recovery within 5–10 minutes",
      ],
    },
    {
      action: "Run targeted diagnostics: dependency health checks, DB query sampling, and auth/token validation.",
      priority: sev === "low" ? "medium" : "high",
      confidence: clamp01(0.7 - dataQualityPenalty),
      rationale: "Narrows root cause and supports durable fix.",
      risks: "Some diagnostics may increase load if run broadly.",
      verification_steps: [
        "Run on a single canary instance first",
        "Confirm no additional load/regression",
      ],
    },
  ];

  return {
    summary: `${title}: Preliminary assessment indicates ${sev.toUpperCase()} impact with likely dependency or capacity-related degradation. Prioritize stabilization and change correlation, then validate the most probable root cause with targeted diagnostics.`,
    root_causes,
    recommendations,
    estimated_recovery_time: sev === "critical" ? "30–90 minutes" : sev === "high" ? "1–3 hours" : "Same day",
    confidence_score,
    data_quality_notes:
      desc && desc.length > 40
        ? "Sufficient context provided for a first-pass assessment. Add exact timestamps, impacted endpoints, and key logs for higher confidence."
        : "Limited context provided. Add exact error messages, graphs (latency/error rate), and recent change details for a higher-confidence assessment.",
    limitations: [
      "Local analysis is heuristic and may not reflect production telemetry.",
      "Assumes common incident patterns; verify against metrics and logs.",
    ],
  };
}

function buildAutomationForIncident(incident, analysis) {
  const sev = (incident?.severity || "medium").toLowerCase();
  const systems = incident?.affected_systems || [];
  const source = (incident?.source || "").toLowerCase();

  const team = source.includes("network")
    ? "Network Operations"
    : systems.some((s) => s.toLowerCase().includes("db"))
      ? "Database Reliability"
      : systems.some((s) => s.toLowerCase().includes("auth") || s.toLowerCase().includes("iam"))
        ? "Identity & Access"
        : "Site Reliability Engineering";

  const diagnostic_scripts = [
    {
      script_name: "Service health snapshot",
      description: "Collect a quick snapshot of key KPIs and dependency health.",
      status: "completed",
      command: "curl -s https://status.your-service.local/health | jq .",
      output: "{\n  \"status\": \"degraded\",\n  \"dependencies\": [{\"name\":\"db\",\"status\":\"warn\"}]\n}",
    },
    {
      script_name: "Error-rate sampling",
      description: "Sample recent errors to identify dominant failure mode.",
      status: "completed",
      command: "tail -n 200 /var/log/app/error.log | grep -E \"5..|timeout|auth\" | head",
      output: "timeout contacting upstream dependency\nrequest_id=...\n",
    },
  ];

  const stakeholder_communication = {
    executive_summary:
      sev === "critical"
        ? "We are currently mitigating a high-impact service incident. Teams are engaged, and initial triage suggests a dependency/capacity issue. Next update in 30 minutes."
        : "We are investigating a service degradation with limited scope. Initial triage is underway and we will provide updates as more information becomes available.",
    technical_details:
      "Observed elevated error rates and latency for a subset of requests. Next steps: validate change correlation, inspect dependency health, and apply mitigation/rollback as needed.",
    customer_facing:
      "Some users may experience intermittent issues. Our team is actively working to restore full service and will provide updates as we confirm stability.",
    internal_update:
      `Triage in progress. Assigned team: ${team}. Focus areas: metrics review, dependency checks, and mitigation actions.`,
  };

  return {
    assigned_team: team,
    assignment_rationale: systems.length
      ? `Assignment based on affected systems: ${systems.slice(0, 3).join(", ")}.`
      : "Assignment based on incident signals and standard ownership patterns.",
    automation_confidence: clamp01((analysis?.confidence_score ?? 0.7) + 0.1),
    diagnostic_scripts,
    stakeholder_communication,
  };
}

const functions = {
  async invoke(name, payload = {}) {
    // keep response shape consistent with callers: { data?: any }
    if (name === "generatePredictions") {
      const incidents = await db.list("Incident", { sort: "-created_date", limit: 50 });
      const now = new Date();
      const sampleSystems = [
        "Customer Portal",
        "Payments API",
        "Identity Service",
        "Data Pipeline",
        "Notifications",
      ];

      // Create a small set of alerts with plausible fields.
      const created = [];
      for (let i = 0; i < 4; i++) {
        const sys = incidents[i]?.affected_systems?.[0] || sampleSystems[i % sampleSystems.length];
        created.push(
          await db.create("PredictiveAlert", {
            title: `Elevated risk detected: ${sys}`,
            system: sys,
            likelihood: clamp01(0.55 + i * 0.08),
            impact: i === 0 ? "high" : i === 1 ? "medium" : "low",
            recommended_action: "Review recent changes and monitor error-rate/latency dashboards.",
            status: "active",
            predicted_window: `${new Date(now.getTime() + 60 * 60 * 1000).toISOString()} / ${new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()}`,
          })
        );
      }
      return { data: { created } };
    }

    if (name === "automateIncidentResponse") {
      const incident = (await db.filter("Incident", { where: { id: payload.incident_id } }))[0];
      if (!incident) return { data: { ok: false } };

      const analysis = incident.ai_analysis || buildAnalysisFromIncident(incident);
      const automation = buildAutomationForIncident(incident, analysis);

      // Upsert IncidentAutomation by incident_id
      const existing = (await db.filter("IncidentAutomation", { where: { incident_id: payload.incident_id } }))[0];
      const record = existing
        ? await db.update("IncidentAutomation", existing.id, { ...automation })
        : await db.create("IncidentAutomation", { incident_id: payload.incident_id, ...automation });

      await db.create("AuditLog", {
        incident_id: payload.incident_id,
        action_type: "automation_generated",
        actor: "SYSTEM",
        details: { assigned_team: record.assigned_team, confidence: record.automation_confidence },
      });

      return { data: { automation: record } };
    }

    if (name === "generatePostIncidentReview") {
      const incident = (await db.filter("Incident", { where: { id: payload.incident_id } }))[0];
      if (!incident) return { data: { ok: false } };

      const logs = await db.filter("AuditLog", { where: { incident_id: payload.incident_id }, sort: "created_date" });
      const decisions = await db.filter("Decision", { where: { incident_id: payload.incident_id } });
      const summary = incident.ai_analysis?.summary || buildAnalysisFromIncident(incident).summary;

      const review = {
        incident_id: payload.incident_id,
        executive_summary: summary,
        customer_impact: incident.severity === "critical" ? "High" : incident.severity === "high" ? "Moderate" : "Low",
        timeline: logs.map((l) => ({ at: l.created_date, action: l.action_type, details: l.details })),
        decisions: decisions.map((d) => ({ action: d.recommendation_action, decision: d.decision, reason: d.decision_reason })),
        what_went_well: ["Rapid triage and clear ownership", "Audit trail captured key actions"],
        what_went_wrong: ["Limited early signals / missing data", "Dependency coupling increased blast radius"],
        action_items: [
          { owner: "SRE", item: "Add alerting for leading indicators (latency/queue depth)", due: "2 weeks" },
          { owner: "App Team", item: "Document rollback steps and add runbook", due: "1 week" },
        ],
      };

      const existing = (await db.filter("PostIncidentReview", { where: { incident_id: payload.incident_id } }))[0];
      const record = existing
        ? await db.update("PostIncidentReview", existing.id, review)
        : await db.create("PostIncidentReview", review);

      await db.create("AuditLog", {
        incident_id: payload.incident_id,
        action_type: "post_incident_review_generated",
        actor: "SYSTEM",
        details: { review_id: record.id },
      });

      return { data: { review: record } };
    }

    if (name === "suggestKnowledgeArticles") {
      const incident = (await db.filter("Incident", { where: { id: payload.incident_id } }))[0];
      const articles = await db.list("KnowledgeBaseArticle", { sort: "-created_date", limit: 200 });
      if (!incident) return { data: { suggestions: [] } };

      const text = `${incident.title || ""} ${incident.description || ""} ${(incident.affected_systems || []).join(" ")}`.toLowerCase();

      const suggestions = articles
        .map((a) => {
          const hay = `${a.title || ""} ${a.summary || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
          let score = 0;
          for (const token of text.split(/\W+/).filter(Boolean).slice(0, 25)) {
            if (token.length < 4) continue;
            if (hay.includes(token)) score += 1;
          }
          const relevance = clamp01(score / 10);
          return {
            article: a,
            relevance_score: relevance,
            reason: relevance > 0.7 ? "Strong tag/title overlap" : relevance > 0.4 ? "Partial keyword match" : "Weak match",
          };
        })
        .filter((s) => s.relevance_score >= 0.25)
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 6);

      return { data: { suggestions } };
    }

    if (name === "generateArticleFromIncident") {
      const incident = (await db.filter("Incident", { where: { id: payload.incident_id } }))[0];
      if (!incident) return { data: { ok: false } };
      const analysis = incident.ai_analysis || buildAnalysisFromIncident(incident);
      const article = await db.create("KnowledgeBaseArticle", {
        title: `Runbook: ${incident.title}`,
        summary: analysis.summary,
        content: `## Summary\n${analysis.summary}\n\n## Likely root causes\n${analysis.root_causes
          .map((r) => `- **${r.cause}** (p=${Math.round(r.probability * 100)}%)`)
          .join("\n")}\n\n## Recommended actions\n${analysis.recommendations
          .map((r) => `- **${r.priority.toUpperCase()}**: ${r.action}`)
          .join("\n")}\n\n## Verification\n- Monitor error rate and latency\n- Confirm recovery in customer workflows\n`,
        tags: [incident.severity, ...(incident.affected_systems || []).slice(0, 3)],
        category: "runbook",
        status: "draft",
      });
      return { data: { article } };
    }

    throw new Error(`Unknown function: ${name}`);
  },
};

const integrations = {
  Core: {
    async InvokeLLM({ prompt }) {
      // Deterministic local JSON "LLM".
      // If an incident is included in the prompt, we infer analysis from its text.
      const analysis = buildAnalysisFromIncident({
        title: /Title:\s*(.*)/i.exec(prompt || "")?.[1] || "Incident",
        description: prompt || "",
        severity: /Severity:\s*(.*)/i.exec(prompt || "")?.[1] || "medium",
        source: /Source:\s*(.*)/i.exec(prompt || "")?.[1] || "Unknown",
      });
      return analysis;
    },
  },
};

export const appClient = {
  entities: {
    Incident: entityFactory("Incident"),
    Decision: entityFactory("Decision"),
    AuditLog: entityFactory("AuditLog"),
    PredictiveAlert: entityFactory("PredictiveAlert"),
    PostIncidentReview: entityFactory("PostIncidentReview"),
    IncidentAutomation: entityFactory("IncidentAutomation"),
    KnowledgeBaseArticle: entityFactory("KnowledgeBaseArticle"),
  },
  functions,
  integrations,
  auth,
};
