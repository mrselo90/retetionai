# Tasks: Kubernetes + New Relic

> Implementation tasks for running GlowGuide on Kubernetes with New Relic Free Tier observability.

**Spec**: `docs/deployment/KUBERNETES_NEWRELIC_SPEC.md`  
**Steps**: `docs/deployment/KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md`

---

## Phase 1: New Relic Account and Agent

- [ ] **K8S-NR-1.1** — Create New Relic account (free tier); note license key and ensure 1 Full Platform user.
- [x] **K8S-NR-1.2** — Add `newrelic` package to `@glowguide/api`; load agent first (`node -r newrelic dist/index.js`); add `newrelic.cjs` config; env: `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME=glowguide-api`. Start script and `start:no-nr` for dev without agent.
- [x] **K8S-NR-1.3** — Add `newrelic` to `@glowguide/workers`; same pattern; `newrelic.cjs`; env `glowguide-workers`.
- [ ] **K8S-NR-1.4** — (Optional) New Relic Browser/NPM for Next.js web; defer if not needed.

---

## Phase 2: Docker Images with New Relic

- [x] **K8S-NR-2.1** — API Dockerfile: CMD `node -r newrelic dist/index.js`; license from env at runtime.
- [x] **K8S-NR-2.2** — Workers Dockerfile: same; build and run with env; confirm APM.
- [x] **K8S-NR-2.3** — Web image: no change unless Browser agent added; verify build.

---

## Phase 3: Kubernetes Base

- [x] **K8S-NR-3.1** — Document required keys in `k8s/README.md`, `k8s/secrets.yaml.example`, and `docs/deployment/KUBERNETES_RUNBOOK.md`; create Secret from env (user).
- [ ] **K8S-NR-3.2** — Apply namespace, ConfigMap, api Deployment + Service; set image to registry URL; verify pods and `/health`.
- [ ] **K8S-NR-3.3** — Apply workers Deployment; verify workers run and APM shows data.
- [ ] **K8S-NR-3.4** — Apply web Deployment + Service; verify.
- [ ] **K8S-NR-3.5** — Configure and apply Ingress (host, TLS); test external access.
- [ ] **K8S-NR-3.6** — (Optional) In-cluster Redis for dev/staging; or document managed Redis URL in secrets.

---

## Phase 4: New Relic Kubernetes Integration

- [ ] **K8S-NR-4.1** — Add New Relic Helm repo; install Kubernetes integration (nri-bundle or K8s chart) with APM auto-attach disabled; set license key in values. **Guide**: `docs/deployment/NEWRELIC_K8S_HELM_AND_ALERTS.md`.
- [ ] **K8S-NR-4.2** — Confirm cluster and `glowguide` namespace visible in New Relic Kubernetes UI.

---

## Phase 5: Alerts and Dashboard

- [ ] **K8S-NR-5.1** — Create alert policy; add conditions (e.g. error rate, latency, pod restarts); set notification channel. **NRQL examples**: `docs/deployment/NEWRELIC_K8S_HELM_AND_ALERTS.md`.
- [ ] **K8S-NR-5.2** — Create dashboard: API + Workers APM metrics + K8s pods/nodes. **Widget suggestions**: same doc.

---

## Phase 6: Documentation and CI

- [x] **K8S-NR-6.1** — Add `docs/deployment/KUBERNETES_RUNBOOK.md`: deploy order, rollback, scale, logs, secrets, troubleshooting; add `scripts/k8s-apply.sh`.
- [x] **K8S-NR-6.2** — (Optional) CI: `.github/workflows/build-images.yml` — build and push api/workers/web images on tag (e.g. `v1.0.0`) to GHCR; optional CD (kubectl set image or Helm) documented in runbook.

---

## Completion Criteria (from Spec)

- [ ] API, Workers, Web run in Kubernetes; accessible via Ingress.
- [ ] New Relic APM shows api and workers; transactions, errors, throughput visible.
- [ ] Kubernetes integration shows pods/nodes for namespace.
- [ ] At least one alert configured.
- [ ] One dashboard with API + Workers + K8s overview.
- [ ] Documentation: deploy steps, required env/secrets, how to view New Relic.
