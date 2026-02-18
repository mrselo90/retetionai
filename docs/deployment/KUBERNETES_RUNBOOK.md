# Kubernetes Runbook (Recete)

**Same deployment method for local and production:** Docker images + Kubernetes manifests. Locally you use a local cluster (minikube/kind/Docker Desktop) and load images into it; in production you push images to a registry and point the same manifests at that registry.

Operational guide for running Recete on Kubernetes with New Relic. See [KUBERNETES_NEWRELIC_SPEC.md](./KUBERNETES_NEWRELIC_SPEC.md) and [KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md](./KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md) for architecture and setup.

---

## 1. Prerequisites

- `kubectl` configured for your cluster
- Docker images built and pushed to your registry (or loaded locally for dev)
- New Relic license key (for APM)
- All required secrets (Supabase, Redis, OpenAI, etc.) — see [Required secrets](#2-required-secrets)

---

## 1.1 Local: Docker + Kubernetes (same as production)

Run locally with the **same** deployment method you use for production: Docker images + Kubernetes manifests.

**One command (recommended):**

```bash
# Start cluster first: minikube start | kind create cluster | or enable K8s in Docker Desktop
./scripts/k8s-local.sh
```

This script: builds api/workers/web images, loads them into your local cluster (minikube/kind), creates namespace and secret from `.env` or `.env.production`, and applies all manifests (same as production). Then use port-forward to access:

```bash
kubectl port-forward svc/api 3001:3001 -n glowguide &
kubectl port-forward svc/web 3000:3000 -n glowguide
# Open http://localhost:3000 and API at http://localhost:3001
```

**Manual steps (if you prefer):**

1. **Cluster**: `minikube start` | `kind create cluster` | Docker Desktop → Enable Kubernetes.
2. **Build + load images** (see script logic): minikube uses `eval $(minikube docker-env)` then `docker build`; kind uses `docker build` then `kind load docker-image`.
3. **Namespace + Secret**: `kubectl apply -f k8s/namespace.yaml` and `kubectl create secret generic glowguide-secrets -n glowguide --from-env-file=.env` (or `.env.production`).
4. **Apply**: `./scripts/k8s-apply.sh` (same as production).
5. **Access**: `kubectl port-forward svc/api 3001:3001 -n glowguide` and `kubectl port-forward svc/web 3000:3000 -n glowguide`.

**Redis:** Use an external Redis (e.g. Supabase or a local Redis) and set `REDIS_URL` in your env file; the app in K8s will use it. No need to run Redis inside the cluster for local.

---

## 2. Required secrets

Create the `glowguide-secrets` Secret in the `glowguide` namespace. **Never commit real values.**

### Required keys (API + Workers)

| Key | Description |
|-----|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `REDIS_URL` | Redis connection URL (e.g. `redis://host:6379`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `NEW_RELIC_LICENSE_KEY` | New Relic license key (APM) |
| `SHOPIFY_API_KEY` | Shopify app API key |
| `SHOPIFY_API_SECRET` | Shopify app secret |

### Optional / per environment

| Key | Description |
|-----|-------------|
| `NEW_RELIC_APP_NAME` | Override app name (default set in deployment) |
| `NEW_RELIC_ENABLED` | `true` / `false` to enable/disable agent |
| `SENTRY_DSN` | Sentry DSN for errors |
| `SENTRY_ENVIRONMENT` | e.g. `production` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | If using Twilio |
| WhatsApp keys | Per merchant or platform defaults in integrations |

### Web (Next.js) – must be in same secret if using envFrom

| Key | Description |
|-----|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` (public) |
| `NEXT_PUBLIC_API_URL` | Public API base URL (e.g. `https://api.glowguide.ai`) |

### Create secret from env file

```bash
# Ensure .env.production exists and is gitignored
kubectl create secret generic glowguide-secrets -n glowguide --from-env-file=.env.production
```

Or from literals (no file):

```bash
kubectl create secret generic glowguide-secrets -n glowguide \
  --from-literal=SUPABASE_URL=... \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=... \
  --from-literal=REDIS_URL=... \
  --from-literal=OPENAI_API_KEY=... \
  --from-literal=NEW_RELIC_LICENSE_KEY=... \
  # ... add all required keys
```

To update an existing secret, delete and recreate or use `kubectl edit secret glowguide-secrets -n glowguide` (values must be base64).

---

## 3. Deploy order

Apply in this order from repo root:

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Secret (create once; see above)
# kubectl create secret generic glowguide-secrets -n glowguide --from-env-file=.env.production

# 3. ConfigMap
kubectl apply -f k8s/configmap.yaml

# 4. API
kubectl apply -f k8s/api-deployment.yaml -f k8s/api-service.yaml

# 5. Workers
kubectl apply -f k8s/workers-deployment.yaml

# 6. Web
kubectl apply -f k8s/web-deployment.yaml -f k8s/web-service.yaml

# 7. Ingress (edit host/TLS first)
kubectl apply -f k8s/ingress.yaml
```

Or use the script (see [Scripts](#8-scripts)):

```bash
./scripts/k8s-apply.sh
```

Before first deploy: replace image tags in `api-deployment.yaml`, `workers-deployment.yaml`, `web-deployment.yaml` with your registry URLs (e.g. `gcr.io/PROJECT/glowguide-api:1.0.0`).

---

## 4. Rollback

### Rollback a deployment to previous revision

```bash
kubectl rollout undo deployment/api -n glowguide
kubectl rollout undo deployment/workers -n glowguide
kubectl rollout undo deployment/web -n glowguide
```

### Rollback to a specific revision

```bash
kubectl rollout history deployment/api -n glowguide
kubectl rollout undo deployment/api -n glowguide --to-revision=2
```

### Rollback Ingress

Revert `k8s/ingress.yaml` in git and re-apply, or edit in place:

```bash
kubectl apply -f k8s/ingress.yaml -n glowguide
```

---

## 5. Scale

```bash
# Scale API to 3 replicas
kubectl scale deployment/api -n glowguide --replicas=3

# Scale workers (usually 1–2; ensure queue concurrency is correct)
kubectl scale deployment/workers -n glowguide --replicas=2

# Scale web
kubectl scale deployment/web -n glowguide --replicas=2
```

---

## 6. Logs and debugging

### Stream logs

```bash
# API
kubectl logs -f deployment/api -n glowguide

# Workers
kubectl logs -f deployment/workers -n glowguide

# Web
kubectl logs -f deployment/web -n glowguide
```

### Logs from a specific pod

```bash
kubectl get pods -n glowguide
kubectl logs -f <pod-name> -n glowguide
```

### Describe pod (events, state)

```bash
kubectl describe pod <pod-name> -n glowguide
```

### Exec into a pod

```bash
kubectl exec -it deployment/api -n glowguide -- sh
```

### Check health

```bash
# From inside cluster (e.g. from a pod)
curl http://api:3001/health

# From outside (if Ingress is up)
curl https://your-domain.com/health
```

---

## 7. Troubleshooting

| Symptom | Check |
|--------|--------|
| Pods `ImagePullBackOff` | Image name/tag and `imagePullPolicy`; registry auth (imagePullSecrets) if private. |
| Pods `CrashLoopBackOff` | `kubectl logs` and `kubectl describe pod`; often missing env (e.g. `SUPABASE_URL`, `REDIS_URL`) or wrong key names. |
| 502 / 503 on Ingress | Pods ready? `kubectl get pods -n glowguide`; readiness probe path correct (`/health` for API, `/` for web). |
| No data in New Relic APM | `NEW_RELIC_LICENSE_KEY` and `NEW_RELIC_APP_NAME` set in secret; app restarted after adding; allow a few minutes for data. |
| Workers not processing jobs | Redis reachable? Same `REDIS_URL` as API; queue names match; check worker logs. |
| Web shows wrong API URL | Set `NEXT_PUBLIC_API_URL` in secret (or ConfigMap for web) to the public API base URL. |

### Common fixes

- **Update secret**: Delete and recreate, or patch; then restart deployments:  
  `kubectl rollout restart deployment/api deployment/workers deployment/web -n glowguide`
- **Update config (ConfigMap)**: Edit `k8s/configmap.yaml`, then `kubectl apply -f k8s/configmap.yaml` and restart deployments so they pick up new env.

---

## 8. Scripts

- **`scripts/k8s-local.sh`** — **Local only.** Builds Docker images, loads them into minikube/kind, creates namespace + secret from `.env` or `.env.production`, then runs `k8s-apply.sh`. Same deployment flow as production.
- **`scripts/k8s-apply.sh`** — Applies manifests in the correct order (used by both local and production). Ensure `glowguide-secrets` exists before running (or use `k8s-local.sh` locally).

---

## 9. New Relic (Phases 4–5)

- **Phase 4 – Kubernetes integration**: Install New Relic Helm chart (e.g. `nri-bundle`) for cluster/pod visibility; keep APM auto-attach disabled (we use in-image Node agent). **Step-by-step and values**: [NEWRELIC_K8S_HELM_AND_ALERTS.md](./NEWRELIC_K8S_HELM_AND_ALERTS.md).
- **Phase 5 – Alerts and dashboard**: Alert policy (error rate, latency) and dashboard (API + Workers APM + K8s). NRQL examples and widget suggestions: [NEWRELIC_K8S_HELM_AND_ALERTS.md](./NEWRELIC_K8S_HELM_AND_ALERTS.md#phase-5-alerts-and-dashboard).

---

## 10. CI/CD (optional)

- **Build and push images**: On git tag push (e.g. `v1.0.0`), workflow `.github/workflows/build-images.yml` builds api, workers, web and pushes to GHCR (or set `REGISTRY` and secrets for GCR/ECR). See workflow file for required secrets (e.g. `NEXT_PUBLIC_*` for web build).
- **CD**: After images are pushed, update K8s (e.g. `kubectl set image deployment/api api=... -n glowguide`) or Helm upgrade; keep deploy order as in [Deploy order](#3-deploy-order).
