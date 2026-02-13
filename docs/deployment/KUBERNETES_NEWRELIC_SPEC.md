# Kubernetes + New Relic Specification

**App**: GlowGuide Retention Agent  
**Version**: 1.0  
**Last Updated**: February 2026

---

## 1. Objectives

- Run the application (API, Workers, Web) on **Kubernetes** with production-ready configuration.
- Integrate **New Relic Free Tier** for full observability: APM, Kubernetes monitoring, logs, alerts, dashboards (within free limits).

---

## 2. Architecture Overview

### 2.1 Components to Run on Kubernetes

| Component | Image Source | Port | Notes |
|-----------|--------------|------|--------|
| **api** | Dockerfile target `api` | 3001 | Hono API; health at `/health` |
| **workers** | Dockerfile target `workers` | — | BullMQ workers; no HTTP |
| **web** | Dockerfile target `web` | 3000 | Next.js SSR |

### 2.2 External Dependencies (Not in Cluster)

- **Supabase**: PostgreSQL + Auth (hosted).
- **Redis**: Option A) Managed (e.g. Redis Cloud, ElastiCache). Option B) In-cluster Redis for dev/staging.
- **New Relic**: SaaS; data sent via agent from pods.

### 2.3 Target Topology

```
                    [Ingress / LoadBalancer]
                                    |
              +---------------------+---------------------+
              |                     |                     |
         [Service: web]       [Service: api]        (workers: no LB)
              |                     |
         [Deployment: web]   [Deployment: api]   [Deployment: workers]
              |                     |                     |
              +---------------------+---------------------+
                                    |
                    [ConfigMaps, Secrets, New Relic Agent]
```

- **Ingress**: TLS termination; route `/` to web, `/api`, `/webhooks`, `/health` to api.
- **Services**: ClusterIP for api and web; optional NodePort/LoadBalancer for ingress.
- **Deployments**: Replicas configurable (e.g. api: 2, workers: 1, web: 1 for small scale).
- **New Relic**: Via Kubernetes integration + APM auto-attach (Node.js) or explicit agent in Docker image + env.

---

## 3. New Relic Free Tier (Relevant Features)

- **Data**: 100 GB/month ingest; 1 Full Platform User; unlimited Basic Users.
- **APM**: Full APM for Node.js (transactions, errors, throughput, distributed tracing).
- **Kubernetes**: Kubernetes integration (pods, nodes, metrics); optional APM auto-attach via operator.
- **Logs**: Log forwarding (in-cluster or agent); count toward 100 GB.
- **Alerts**: Alerts and NRQL; Applied Intelligence (proactive detection) within free limits.
- **Synthetics**: 500 synthetic checks; unlimited ping monitors.

### 3.1 What We Will Use (Free Tier)

1. **APM** for `api` and `workers` (Node.js): response times, errors, throughput, custom attributes.
2. **Browser / NPM for `web`** (optional): front-end metrics if within free ingest.
3. **Kubernetes integration**: cluster/pod metrics, deployment visibility.
4. **Alerts**: Critical errors, high latency, pod restarts (NRQL + conditions).
5. **Dashboards**: One dashboard for API + Workers + K8s overview.

### 3.2 New Relic Integration Options

| Option | Pros | Cons |
|--------|------|------|
| **A) APM auto-attach (K8s operator)** | No code/image change; operator injects agent | Requires Helm; cluster-level install |
| **B) Agent in Docker image** | Full control; works in any env | Image change; need NEW_RELIC_* in env |
| **C) Hybrid** | Operator for K8s metrics; agent in image for APM | More moving parts |

**Recommendation**: **B) Agent in Docker image** for API and Workers (explicit `newrelic` npm package + env). Use **New Relic Kubernetes integration** (Helm) for cluster/pod metrics. This keeps app portable and avoids operator mutating pods if we want to keep images self-contained.

---

## 4. Specification Details

### 4.1 Container Images

- **Registry**: Any (e.g. GCR, ECR, Docker Hub). Build from repo root with existing multi-stage Dockerfile.
- **Tags**: Semantic or git-SHA; e.g. `api:1.0.0`, `workers:1.0.0`, `web:1.0.0`.
- **API/Workers**: Add New Relic Node.js agent (`newrelic` package); enable via `NEW_RELIC_LICENSE_KEY` + `NEW_RELIC_APP_NAME`. Agent must be required before app code (e.g. `node -r newrelic dist/index.js`).

### 4.2 Kubernetes Resources

- **Namespace**: e.g. `glowguide` or `retention-agent`.
- **Deployments**: api, workers, web; resource requests/limits; liveness/readiness for api and web.
- **Services**: ClusterIP for api, web; headless not required unless needed.
- **ConfigMap**: Non-sensitive app config (e.g. `API_URL`, `NODE_ENV`, feature flags).
- **Secrets**: Supabase keys, Redis URL, OpenAI key, New Relic license key, Shopify, WhatsApp, etc. (or use external secret manager + CSI).
- **Ingress**: Host + TLS; path-based routing to web and api. Optional: cert-manager for TLS.
- **HPA** (optional): Horizontal Pod Autoscaler for api and web based on CPU/memory or custom (e.g. New Relic).

### 4.3 New Relic Configuration

- **License key**: Stored in Secret; injected as `NEW_RELIC_LICENSE_KEY`.
- **App names**: `glowguide-api`, `glowguide-workers`, `glowguide-web` (or per env: `glowguide-api-staging`).
- **Labels**: Use `NEW_RELIC_LABELS` or agent config for env, cluster, namespace.
- **Distributed tracing**: Enable for api ↔ workers (and web if NPM used); same account.
- **Kubernetes integration**: Deploy `nri-bundle` (Helm) with Kubernetes integration enabled; optionally disable APM auto-attach if using in-image agent.
- **Logs**: Optional; forward stdout/stderr to New Relic (Fluent Bit sidecar or DaemonSet) if within 100 GB budget.

### 4.4 Environment Variables (Summary)

- **API/Workers**: All existing env vars (Supabase, Redis, OpenAI, Shopify, WhatsApp, etc.) plus `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`, `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true`.
- **Web**: Existing Next.js public/private vars; optional `NEXT_PUBLIC_NEW_RELIC_*` if using Browser agent.
- **Redis URL**: From Secret or external service (e.g. `redis://redis-service:6379` for in-cluster).

### 4.5 Health and Readiness

- **API**: `GET /health` returns 200; use as readiness and liveness.
- **Web**: `GET /` or `/api/health` if added; or TCP on 3000.
- **Workers**: No HTTP; liveness can be exec or sidecar that checks process.

### 4.6 Security

- **Secrets**: No plaintext in manifests; use Kubernetes Secrets or external secret store.
- **Network**: Restrict ingress to needed paths; internal traffic cluster-only where possible.
- **RBAC**: Service accounts with minimal permissions for api, workers, web.
- **Images**: Non-root user where possible; scan for vulnerabilities in CI.

---

## 5. Out of Scope (This Spec)

- Database (Supabase) or Redis HA design; use managed services or separate doc.
- CI/CD pipeline details (only referenced; e.g. build and push images, apply manifests).
- Multi-region or multi-cluster.
- New Relic paid features (beyond free tier).

---

## 6. Success Criteria

- [ ] API, Workers, Web run in Kubernetes; accessible via Ingress.
- [ ] New Relic APM shows api and workers; transactions, errors, throughput visible.
- [ ] Kubernetes integration shows pods/nodes for the namespace.
- [ ] At least one alert configured (e.g. error rate or latency).
- [ ] One dashboard with API + Workers + K8s overview.
- [ ] Documentation: how to deploy, required env/secrets, and how to view New Relic.

---

## 7. References

- [New Relic Free Tier](https://newrelic.com/pricing/free-tier)
- [New Relic Node.js Agent](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [New Relic Kubernetes Integration](https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration/)
- [Kubernetes APM auto-attach](https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/k8s-agent-operator) (optional path)
