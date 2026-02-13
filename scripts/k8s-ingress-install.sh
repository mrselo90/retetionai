#!/usr/bin/env bash
# Install NGINX Ingress Controller (for Docker Desktop K8s, minikube, kind).
# After this, apply glowguide ingress: ./scripts/k8s-apply.sh (or kubectl apply -f k8s/ingress.yaml -n glowguide)
# Access: port-forward ingress controller to 80, or use LoadBalancer IP on Docker Desktop.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INGRESS_NS="ingress-nginx"
CONTROLLER_URL="https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml"

cd "$REPO_ROOT"

if kubectl get namespace "$INGRESS_NS" &>/dev/null && kubectl get deployment -n "$INGRESS_NS" ingress-nginx-controller &>/dev/null; then
  echo "NGINX Ingress Controller already installed in $INGRESS_NS."
  echo "To reinstall: kubectl delete namespace $INGRESS_NS"
  exit 0
fi

echo "Installing NGINX Ingress Controller..."
kubectl apply -f "$CONTROLLER_URL"

echo "Waiting for controller to be ready..."
kubectl wait --namespace "$INGRESS_NS" \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s 2>/dev/null || true

echo ""
echo "Done. Controller pods:"
kubectl get pods -n "$INGRESS_NS" -l app.kubernetes.io/component=controller 2>/dev/null || true
echo ""
echo "To access ingress on Docker Desktop: run one of:"
echo "  kubectl port-forward -n $INGRESS_NS svc/ingress-nginx-controller 80:80 443:443"
echo "  Then open http://localhost (or https://localhost with TLS)"
echo "Or check LoadBalancer IP: kubectl get svc -n $INGRESS_NS ingress-nginx-controller"
