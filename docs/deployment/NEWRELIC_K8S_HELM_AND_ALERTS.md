# New Relic: Kubernetes Integration (Helm) and Alerts/Dashboard

Follow this after API and Workers are running in Kubernetes with the in-image Node.js agent (see [KUBERNETES_RUNBOOK.md](./KUBERNETES_RUNBOOK.md)).

---

## Phase 4: New Relic Kubernetes Integration (Helm)

### 4.1 Add Helm repo and install

```bash
helm repo add newrelic https://helm-charts.newrelic.com
helm repo update
```

### 4.2 Install nri-bundle (cluster metrics; no APM auto-attach)

We use the **in-image** Node.js agent for API and Workers, so disable the Kubernetes operator that would inject APM agents.

Create a values file (e.g. `newrelic-k8s-values.yaml`), **do not commit license key**:

```yaml
# newrelic-k8s-values.yaml (example; use --set for license key in CI)
global:
  cluster: glowguide-prod   # optional; identify cluster in NR UI
  licenseKey: ""            # set via: helm install ... --set global.licenseKey=$NEW_RELIC_LICENSE_KEY

# Disable APM auto-injection; we use in-image agent
nri-bundle:
  nri-kubernetes:
    enabled: true
  # If your chart has k8s-agents-operator / injector, disable it:
  # k8s-agents-operator:
  #   enabled: false
```

Install (replace `YOUR_LICENSE_KEY` or use `--set global.licenseKey=$NEW_RELIC_LICENSE_KEY`):

```bash
kubectl create namespace newrelic --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install newrelic-bundle newrelic/nri-bundle \
  -n newrelic \
  --set global.licenseKey=YOUR_LICENSE_KEY \
  --set global.cluster=glowguide-prod
```

Chart name and values may vary; check [New Relic Kubernetes integration docs](https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration/) for the current chart (e.g. `nri-bundle` or `nri-kubernetes`).

### 4.3 Verify

- In New Relic: **Kubernetes** → select cluster → namespace `glowguide`; pods for api, workers, web should appear.
- **APM**: Applications → `glowguide-api` and `glowguide-workers` (from in-image agent).

---

## Phase 5: Alerts and Dashboard

### 5.1 Alert policy

1. In New Relic: **Alerts & AI** → **Alert conditions** → **Create alert policy** (e.g. "GlowGuide Production").
2. Add conditions, for example:

| Condition type | Example |
|----------------|--------|
| **APM – Error rate** | Application: `glowguide-api`, error rate > 5% (or threshold of choice). |
| **APM – Response time** | Application: `glowguide-api`, average response time (ms) > 2000. |
| **APM – Apdex** | Apdex < 0.7. |
| **Kubernetes – Pod not ready** | Namespace: `glowguide`, pod status not Running/Ready. |

3. **Notification channel**: Email or Slack; attach to the policy.

### 5.2 NRQL examples (for custom conditions or dashboard)

```nrql
# API error rate (last 5 min)
SELECT percentage(count(*), WHERE error IS true) FROM Transaction 
WHERE appName = 'glowguide-api' FACET name SINCE 5 minutes ago

# API throughput (requests per minute)
SELECT rate(count(*), 1 minute) FROM Transaction 
WHERE appName = 'glowguide-api' SINCE 1 hour ago

# Workers transaction count
SELECT count(*) FROM Transaction 
WHERE appName = 'glowguide-workers' FACET name SINCE 1 hour ago
```

### 5.3 Dashboard suggestions

Create a dashboard **"GlowGuide K8s + APM"** with widgets such as:

- **API**: Throughput (requests/min), error rate (%), response time (avg/p95), Apdex.
- **Workers**: Job throughput, error count, average duration.
- **Kubernetes**: Pod count by namespace `glowguide`, CPU/memory usage (if available from integration), pod restarts.

Use **Query** widgets with NRQL above, or **APM** widgets linked to `glowguide-api` and `glowguide-workers`.

---

## References

- [KUBERNETES_RUNBOOK.md](./KUBERNETES_RUNBOOK.md) — Deploy, rollback, logs, secrets.
- [KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md](./KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md) — Full phase list.
- [New Relic Kubernetes integration](https://docs.newrelic.com/docs/kubernetes-pixie/kubernetes-integration/installation/install-kubernetes-integration/).
