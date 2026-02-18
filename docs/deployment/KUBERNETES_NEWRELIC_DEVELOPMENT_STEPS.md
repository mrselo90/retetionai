# Kubernetes + New Relic: Development Steps

**Prerequisite**: Spec read and agreed — see [KUBERNETES_NEWRELIC_SPEC.md](./KUBERNETES_NEWRELIC_SPEC.md).

---

## Phase 1: New Relic Account and Agent Setup

### Step 1.1 – New Relic account (free)

1. Sign up at [newrelic.com](https://newrelic.com) (free tier; no credit card).
2. Create one **Full Platform** user (you); note **License key** (APM → API keys or Account settings).
3. (Optional) Create a **sub-account** or use labels for staging vs production.

### Step 1.2 – Add New Relic Node.js agent to API

1. In repo root:  
   `pnpm add newrelic --filter @glowguide/api`
2. In `packages/api`, ensure agent loads first:
   - **Option A**: In `package.json` main entry, use `node -r newrelic dist/index.js` (or `tsx -r newrelic src/index.ts` for dev).
   - **Option B**: At the very top of `packages/api/src/index.ts` (or entry file), add:  
     `import 'newrelic';`  
     and ensure it is the first import.
3. Add env vars (local `.env` and later K8s Secret):  
   `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME=glowguide-api`, `NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true`.  
   Disable in dev if desired: `NEW_RELIC_ENABLED=false`.
4. Create `packages/api/newrelic.js` (or `newrelic.cjs`) from [New Relic Node.js config](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/); set `app_name`, `license_key` from env, `distributed_tracing: { enabled: true }`.
5. Run API locally with license key set; confirm app appears in New Relic APM.

### Step 1.3 – Add New Relic Node.js agent to Workers

1. `pnpm add newrelic --filter @glowguide/workers`
2. Load agent first in workers entry (same as API: `-r newrelic` or first import).
3. Env: `NEW_RELIC_APP_NAME=glowguide-workers`, same license key, distributed tracing enabled.
4. Optional: copy or symlink `newrelic.js` config from api or keep minimal (env-only).
5. Run workers locally; confirm `glowguide-workers` in APM.

### Step 1.4 – (Optional) New Relic for Next.js (web)

- For backend-only visibility, you can skip web APM.
- If desired: [New Relic Browser / NPM for Next.js](https://docs.newrelic.com/docs/browser/); add script or NPM agent; stay within 100 GB free ingest.

---

## Phase 2: Docker Images with New Relic

### Step 2.1 – API image

1. In Dockerfile (api target), install `newrelic` in production stage (or rely on build stage if already in package.json).
2. Set default CMD to use agent: e.g. `CMD ["node", "-r", "newrelic", "dist/index.js"]` (adjust path if monorepo layout differs).
3. Do **not** bake license key into image; use env at runtime.
4. Build and run locally:  
   `docker build -f Dockerfile --target api -t glowguide-api:test .`  
   `docker run -e NEW_RELIC_LICENSE_KEY=... -e NEW_RELIC_APP_NAME=glowguide-api ... glowguide-api:test`
5. Confirm APM data in New Relic.

### Step 2.2 – Workers image

1. Same pattern: add `newrelic` to workers stage; CMD with `-r newrelic`.
2. Build and run with env; confirm workers app in APM.

### Step 2.3 – Web image

1. No New Relic in image unless you added Browser/NPM; keep current `next start` CMD.
2. Build and run to verify.

---

## Phase 3: Kubernetes Manifests (Base)

### Step 3.1 – Namespace and base layout

1. Create `k8s/` (or `deploy/kubernetes/`) in repo.
2. Add `k8s/namespace.yaml`: namespace `glowguide` (or chosen name).
3. Add `k8s/configmap.yaml`: non-sensitive config (e.g. `NODE_ENV=production`, `API_URL`, log level). Do not put secrets here.

### Step 3.2 – Secrets (template)

1. Add `k8s/secrets.yaml.example` (or use external secrets doc): list required keys (Supabase, Redis, OpenAI, New Relic, Shopify, WhatsApp, etc.).
2. Document: "Create Secret from env or vault; do not commit real secrets."
3. Example:  
   `kubectl create secret generic glowguide-secrets --from-env-file=.env.production -n glowguide`  
   (ensure `.env.production` is gitignored).

### Step 3.3 – API Deployment and Service

1. `k8s/api-deployment.yaml`:
   - Deployment: image (from registry), replicas (e.g. 2), resource requests/limits, env from ConfigMap + Secret, liveness/readiness `GET /health` on 3001.
   - Mount or set `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME` from Secret.
2. `k8s/api-service.yaml`: Service ClusterIP, port 3001, selector to api Deployment.
3. `kubectl apply -f k8s/namespace.yaml -f k8s/configmap.yaml -f k8s/api-deployment.yaml -f k8s/api-service.yaml` (and secrets); verify pods run and APM receives data.

### Step 3.4 – Workers Deployment

1. `k8s/workers-deployment.yaml`: Deployment, no Service; same env/Secrets as API where relevant (Redis, Supabase, New Relic).
2. Replicas: 1 or 2; ensure BullMQ handles concurrency (single worker per queue or as designed).
3. Apply and confirm workers pod runs and appears in New Relic.

### Step 3.5 – Web Deployment and Service

1. `k8s/web-deployment.yaml`: Deployment for web image; env from ConfigMap/Secret (NEXT_PUBLIC_*, etc.); readiness/liveness on 3000.
2. `k8s/web-service.yaml`: Service ClusterIP, port 3000.
3. Apply and verify.

### Step 3.6 – Ingress

1. `k8s/ingress.yaml`: Ingress resource; host(s); TLS (secret or cert-manager); path `/` → web:3000; paths `/api`, `/webhooks`, `/health` → api:3001.
2. Adjust for your cluster (Ingress class, annotations for LB).
3. Apply; test external access and TLS.

### Step 3.7 – Redis (if in-cluster)

1. For dev/staging only: optional `k8s/redis-deployment.yaml` + `k8s/redis-service.yaml` (or use Helm chart).
2. Point api/workers `REDIS_URL` to `redis://redis-service:6379`.
3. Production: prefer managed Redis; set `REDIS_URL` in Secret.

---

## Phase 4: New Relic Kubernetes Integration (Cluster Metrics)

### Step 4.1 – Helm and cluster access

1. Install Helm if not present; ensure `kubectl` targets the correct cluster.
2. Add New Relic Helm repo:  
   `helm repo add newrelic https://helm-charts.newrelic.com`  
   `helm repo update`

### Step 4.2 – Install Kubernetes integration (no APM auto-attach)

1. Install `nri-bundle` or Kubernetes integration chart with:
   - Kubernetes monitoring enabled.
   - APM auto-attach **disabled** (we use in-image agent): e.g. `k8s-agents-operator.enabled=false` or per chart docs.
2. Set your New Relic license key (and optional cluster name) in Helm values.
3. Install in a dedicated namespace (e.g. `newrelic`) or `glowguide`; follow [New Relic Kubernetes integration docs](https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration/).
4. In New Relic UI, open Kubernetes; confirm cluster and pods for `glowguide` namespace.

### Step 4.3 – (Optional) APM auto-attach

- If you later prefer operator-injected agent instead of in-image, enable `k8s-agents-operator.enabled=true` and configure for Node.js; remove `-r newrelic` from Docker CMD. Not required for this plan.

---

## Phase 5: Alerts and Dashboard

### Step 5.1 – Alerts (New Relic)

1. In New Relic: Alerts & AI → Create policy (e.g. "Recete Production").
2. Add conditions, e.g.:
   - Error rate above X% for `glowguide-api` (NRQL or APM condition).
   - Request duration (latency) above Y ms.
   - Kubernetes: pod restart count or not ready.
3. Create notification channel (email/Slack); link to policy.
4. Save; verify with a test incident if possible.

### Step 5.2 – Dashboard

1. Dashboards → Create dashboard "Recete K8s + APM".
2. Add widgets: API throughput (requests/min), error rate, latency (p50/p95); Workers throughput/errors; Kubernetes pods (by namespace/label); optional: Redis or external service health.
3. Save and share (read-only for Basic users if needed).

---

## Phase 6: Documentation and CI (Optional)

### Step 6.1 – Runbook

1. Add `docs/deployment/KUBERNETES_RUNBOOK.md`: how to deploy (apply order), rollback, scale, view logs, common issues.
2. Document required secrets and where to get them (New Relic license key, Supabase, Redis, etc.).

### Step 6.2 – CI (optional)

1. In GitHub Actions (or other CI): build api, workers, web images; push to registry; tag with git SHA or version.
2. Optional: `kubectl set image` or Helm upgrade in CD pipeline; or document manual `kubectl apply` for now.

---

## Checklist Summary

- [x] **Phase 1**: New Relic account; agent in api + workers; local APM data.
- [x] **Phase 2**: Docker images run with New Relic; no key in image.
- [ ] **Phase 3**: K8s namespace, ConfigMap, Secrets, api/workers/web Deployments + Services, Ingress; Redis if in-cluster.
- [ ] **Phase 4**: New Relic Kubernetes integration (Helm); cluster/pod visibility.
- [ ] **Phase 5**: At least one alert; one dashboard.
- [x] **Phase 6**: Runbook ([KUBERNETES_RUNBOOK.md](./KUBERNETES_RUNBOOK.md)) and `scripts/k8s-apply.sh`; optional CI.

---

## File Layout

```
k8s/
  namespace.yaml
  configmap.yaml
  secrets.yaml.example
  api-deployment.yaml
  api-service.yaml
  workers-deployment.yaml
  web-deployment.yaml
  web-service.yaml
  ingress.yaml
  README.md
scripts/
  k8s-apply.sh
docs/deployment/
  KUBERNETES_NEWRELIC_SPEC.md
  KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md
  KUBERNETES_RUNBOOK.md
packages/api/
  newrelic.cjs
  (start: node -r newrelic dist/index.js)
packages/workers/
  newrelic.cjs
  (start: node -r newrelic dist/index.js)
```

---

*Update this document as steps are completed or adapted to your cluster.*
