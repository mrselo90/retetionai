# Kubernetes deployment (GlowGuide Retention Agent)

**Same deployment for local and production:** Docker + Kubernetes. Locally: `./scripts/k8s-local.sh` (builds images, loads into minikube/kind, applies manifests). Production: build/push images to your registry, create secret, then `./scripts/k8s-apply.sh` (or apply manifests with registry image URLs).

Base manifests for running API, Workers, and Web on Kubernetes. Used with [KUBERNETES_NEWRELIC_SPEC.md](../docs/deployment/KUBERNETES_NEWRELIC_SPEC.md), [KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md](../docs/deployment/KUBERNETES_NEWRELIC_DEVELOPMENT_STEPS.md), and [KUBERNETES_RUNBOOK.md](../docs/deployment/KUBERNETES_RUNBOOK.md).

## Local (Docker + K8s)

**Docker requirement:** Docker client API 1.44+ (e.g. Docker Desktop 4.25+ or Docker Engine 25+). If `docker ps` fails with "client version 1.43 is too old", upgrade Docker or use Docker Desktop’s built-in Kubernetes (Settings → Kubernetes → Enable).

**One-command cluster + deploy:**

```bash
./scripts/k8s-create-cluster.sh   # creates cluster (kind or minikube)
./scripts/k8s-local.sh           # builds images, deploys to cluster
kubectl port-forward svc/api 3001:3001 -n glowguide &
kubectl port-forward svc/web 3000:3000 -n glowguide
# Open http://localhost:3000
```

Or create the cluster yourself: `minikube start` or `kind create cluster` or enable Kubernetes in Docker Desktop.

Requires `.env` or `.env.production` with required keys (see [Required secret keys](#required-secret-keys)); `REDIS_URL` must be reachable from the cluster.

## Apply order (production or after k8s-local.sh)

1. `kubectl apply -f namespace.yaml`
2. Create secret `glowguide-secrets` (see below and `secrets.yaml.example`); **do not commit real secrets**.
3. `kubectl apply -f configmap.yaml`
4. `kubectl apply -f api-deployment.yaml -f api-service.yaml`
5. `kubectl apply -f workers-deployment.yaml`
6. `kubectl apply -f web-deployment.yaml -f web-service.yaml`
7. `kubectl apply -f ingress.yaml` (edit host and TLS first)

Or run from repo root: `./scripts/k8s-apply.sh` (script checks that the secret exists).

## Required secret keys

Put these in `glowguide-secrets` (e.g. `kubectl create secret generic glowguide-secrets -n glowguide --from-env-file=.env.production`):

- **API/Workers:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `OPENAI_API_KEY`, `NEW_RELIC_LICENSE_KEY`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- **Web:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`
- **Optional:** `NEW_RELIC_APP_NAME`, `NEW_RELIC_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, Twilio/WhatsApp keys

Full list and runbook: [KUBERNETES_RUNBOOK.md](../docs/deployment/KUBERNETES_RUNBOOK.md#2-required-secrets).

## Images

Replace `glowguide-api:latest`, `glowguide-workers:latest`, `glowguide-web:latest` with your registry URLs (e.g. `gcr.io/PROJECT/api:1.0.0`).

Build from repo root:

```bash
docker build -f Dockerfile --target api -t glowguide-api:latest .
docker build -f Dockerfile --target workers -t glowguide-workers:latest .
docker build -f Dockerfile --target web -t glowguide-web:latest .
```

## New Relic

- Add `NEW_RELIC_LICENSE_KEY` to `glowguide-secrets`. `NEW_RELIC_APP_NAME` is set in the deployment manifests (api/workers).
- The API and Workers images start with the Node.js agent (`node -r newrelic dist/index.js`); no override needed.
- For cluster metrics, install the New Relic Kubernetes integration via Helm (see spec and development steps).
