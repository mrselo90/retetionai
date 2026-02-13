#!/usr/bin/env bash
# Create a local Kubernetes cluster (kind or minikube) for GlowGuide.
# After this, run: ./scripts/k8s-local.sh
# Requires: Docker client API 1.44+ (Docker Desktop 4.25+ or Docker Engine 25+).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLUSTER_NAME="${K8S_CLUSTER_NAME:-glowguide}"

cd "$REPO_ROOT"

# Check Docker is reachable and API version (daemon may require 1.44+)
if ! docker info &>/dev/null; then
  echo "ERROR: Docker is not running or not reachable. Start Docker Desktop."
  exit 1
fi
# Optional: parse 'docker version' for API and warn; many setups fail at 'docker ps' with 1.43
if ! docker ps &>/dev/null; then
  echo "ERROR: Docker daemon rejected the client (e.g. API version mismatch)."
  echo "  Your daemon may require API 1.44+. Upgrade Docker Desktop or Docker CLI to the latest."
  echo "  Alternatively, enable Kubernetes in Docker Desktop (Settings -> Kubernetes -> Enable)."
  exit 1
fi

# Prefer kind if available and no existing cluster
if command -v kind &>/dev/null; then
  if kind get kubeconfig --name "$CLUSTER_NAME" &>/dev/null 2>&1; then
    echo "Cluster $CLUSTER_NAME (kind) already exists. Use: kubectl cluster-info --context kind-$CLUSTER_NAME"
    exit 0
  fi
  echo "Creating Kubernetes cluster with kind (name: $CLUSTER_NAME)..."
  kind create cluster --name "$CLUSTER_NAME"
  echo "Cluster created. Next: ./scripts/k8s-local.sh"
  exit 0
fi

# Fallback to minikube
if command -v minikube &>/dev/null; then
  if minikube status &>/dev/null 2>&1; then
    echo "Minikube cluster already running. Use: kubectl cluster-info"
    exit 0
  fi
  echo "Creating Kubernetes cluster with minikube..."
  minikube start --driver=docker
  echo "Cluster created. Next: ./scripts/k8s-local.sh"
  exit 0
fi

echo "ERROR: Neither kind nor minikube found. Install one:"
echo "  brew install kind    # or: brew install minikube"
exit 1
