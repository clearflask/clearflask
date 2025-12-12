#!/bin/bash
set -e

echo "🚀 ClearFlask Local Setup Script"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl and set up a local Kubernetes cluster.${NC}"
    echo "   Options: Docker Desktop, minikube, or kind"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ helm not found. Please install Helm 3.${NC}"
    echo "   Run: brew install helm"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster.${NC}"
    echo "   Please start your local Kubernetes cluster first."
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1/5: Installing dependencies (MySQL + LocalStack)..."
helm list | grep -q clearflask-deps && {
    echo -e "${YELLOW}⚠️  clearflask-deps already installed, skipping...${NC}"
} || {
    helm install clearflask-deps charts/clearflask-dependencies \
      --set mysql.enabled=true \
      --set localstack.enabled=true \
      --set mysql.persistence.size=2Gi \
      --set localstack.persistence.size=1Gi

    echo "⏳ Waiting for dependencies to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=clearflask-deps --timeout=300s
}
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 2: Generate secrets
echo "🔐 Step 2/5: Generating secrets..."
TOKEN_SIGNER=$(openssl rand -base64 172 | tr -d '\n')
CURSOR_KEY=$(openssl rand -base64 16)
SSO_SECRET=$(uuidgen)
CONNECT_TOKEN=$(uuidgen)
echo -e "${GREEN}✅ Secrets generated${NC}"
echo ""

# Step 3: Install ClearFlask
echo "🎯 Step 3/5: Installing ClearFlask..."
helm list | grep -q "^clearflask\s" && {
    echo -e "${YELLOW}⚠️  ClearFlask already installed, upgrading...${NC}"
    helm upgrade clearflask charts/clearflask \
      --reuse-values \
      --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
      --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
      --set server.secrets.ssoSecretKey="$SSO_SECRET" \
      --set server.secrets.connectToken="$CONNECT_TOKEN"
} || {
    helm install clearflask charts/clearflask \
      -f examples/minimal-values.yaml \
      --set global.domain=localhost \
      --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
      --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
      --set server.secrets.ssoSecretKey="$SSO_SECRET" \
      --set server.secrets.connectToken="$CONNECT_TOKEN"
}

echo "⏳ Waiting for ClearFlask to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=clearflask --timeout=300s
echo -e "${GREEN}✅ ClearFlask installed${NC}"
echo ""

# Step 4: Show status
echo "📊 Step 4/5: Checking deployment status..."
echo ""
kubectl get pods -l app.kubernetes.io/name=clearflask
echo ""
kubectl get pods -l app.kubernetes.io/instance=clearflask-deps
echo ""

# Step 5: Setup port forwarding
echo "🌐 Step 5/5: Setting up access..."
echo ""
echo -e "${GREEN}✅ ClearFlask is ready!${NC}"
echo ""
echo "To access ClearFlask, run in a new terminal:"
echo -e "${YELLOW}  kubectl port-forward svc/clearflask-connect 3000:80${NC}"
echo ""
echo "Then open your browser to:"
echo -e "${GREEN}  http://localhost:3000${NC}"
echo ""
echo "To access the backend API:"
echo -e "${YELLOW}  kubectl port-forward svc/clearflask-server 8080:8080${NC}"
echo -e "${GREEN}  http://localhost:8080/api/health${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:    kubectl logs -l app.kubernetes.io/component=server -f"
echo "  View status:  kubectl get pods"
echo "  Uninstall:    helm uninstall clearflask && helm uninstall clearflask-deps"
echo ""
echo -e "${GREEN}Happy feedback collecting! 🎉${NC}"
