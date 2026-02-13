#!/usr/bin/env bash
# Run GlowGuide locally with Docker + Kubernetes (same deployment method as production).
# Prerequisites: minikube, kind, or Docker Desktop K8s; kubectl; Docker.
# Env: .env or .env.production (REDIS_URL must be reachable from cluster).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NS="glowguide"

cd "$REPO_ROOT"

# Env file for secrets
ENV_FILE=""
for f in .env.production .env; do
  if [[ -f "$f" ]]; then
    ENV_FILE="$f"
    break
  fi
done
if [[ -z "$ENV_FILE" ]]; then
  echo "ERROR: No .env or .env.production found. Create one with required keys (see docs/deployment/KUBERNETES_RUNBOOK.md)."
  exit 1
fi
echo "Using env file: $ENV_FILE"

# Ensure cluster is running
if ! kubectl cluster-info &>/dev/null; then
  echo "ERROR: No Kubernetes cluster. Start one: minikube start | kind create cluster | Docker Desktop K8s."
  exit 1
fi

# Build images and make them available to the cluster
if command -v minikube &>/dev/null && minikube status &>/dev/null 2>&1; then
  echo "Using minikube: building images inside cluster..."
  eval $(minikube docker-env)
  docker build -f Dockerfile --target api -t glowguide-api:latest .
  docker build -f Dockerfile --target workers -t glowguide-workers:latest .
  docker build -f Dockerfile --target web -t glowguide-web:latest .
elif command -v kind &>/dev/null && kind get kubeconfig &>/dev/null 2>&1; then
  echo "Using kind: building images then loading..."
  docker build -f Dockerfile --target api -t glowguide-api:latest .
  docker build -f Dockerfile --target workers -t glowguide-workers:latest .
  docker build -f Dockerfile --target web -t glowguide-web:latest .
  kind load docker-image glowguide-api:latest
  kind load docker-image glowguide-workers:latest
  kind load docker-image glowguide-web:latest
else
  echo "Building images (use current Docker context; ensure cluster can pull or load these tags)..."
  docker build -f Dockerfile --target api -t glowguide-api:latest .
  docker build -f Dockerfile --target workers -t glowguide-workers:latest .
  docker build -f Dockerfile --target web -t glowguide-web:latest .
fi

# Namespace
if ! kubectl get namespace "$NS" &>/dev/null; then
  echo "Creating namespace $NS..."
  kubectl apply -f k8s/namespace.yaml
fi

# Secret (recreate so env changes are picked up)
echo "Creating/updating secret from $ENV_FILE..."
kubectl create secret generic glowguide-secrets -n "$NS" --from-env-file="$ENV_FILE" --dry-run=client -o yaml | kubectl apply -f -

# Apply manifests (same as production)
echo "Applying manifests..."
"$SCRIPT_DIR/k8s-apply.sh"

echo ""
echo "Done. Access:"
echo "  API:  kubectl port-forward svc/api 3001:3001 -n $NS"
echo "  Web:  kubectl port-forward svc/web 3000:3000 -n $NS"
echo "  Then open http://localhost:3000 and API at http://localhost:3001"
echo "  Pods: kubectl get pods -n $NS"
