#!/usr/bin/env bash
# Apply GlowGuide Kubernetes manifests in the correct order.
# Prerequisite: Create glowguide-secrets first (see k8s/README.md or docs/deployment/KUBERNETES_RUNBOOK.md).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$REPO_ROOT/k8s"
NS="glowguide"

cd "$REPO_ROOT"

if ! kubectl get namespace "$NS" &>/dev/null; then
  echo "Creating namespace $NS..."
  kubectl apply -f "$K8S_DIR/namespace.yaml"
fi

if ! kubectl get secret glowguide-secrets -n "$NS" &>/dev/null; then
  echo "ERROR: Secret glowguide-secrets not found in namespace $NS."
  echo "Create it first, e.g.:"
  echo "  kubectl create secret generic glowguide-secrets -n $NS --from-env-file=.env.production"
  echo "See docs/deployment/KUBERNETES_RUNBOOK.md for required keys."
  exit 1
fi

echo "Applying ConfigMap..."
kubectl apply -f "$K8S_DIR/configmap.yaml"

echo "Applying Redis (optional, for local; set REDIS_URL=redis://redis:6379)..."
kubectl apply -f "$K8S_DIR/redis-deployment.yaml" 2>/dev/null || true

echo "Applying API Deployment and Service..."
kubectl apply -f "$K8S_DIR/api-deployment.yaml" -f "$K8S_DIR/api-service.yaml"

echo "Applying Workers Deployment..."
kubectl apply -f "$K8S_DIR/workers-deployment.yaml"

echo "Applying Web Deployment and Service..."
kubectl apply -f "$K8S_DIR/web-deployment.yaml" -f "$K8S_DIR/web-service.yaml"

echo "Applying Ingress..."
kubectl apply -f "$K8S_DIR/ingress.yaml"

echo "Done. Check: kubectl get pods -n $NS"
