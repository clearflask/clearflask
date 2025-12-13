# Running ClearFlask Locally with Kubernetes

This guide shows how to run ClearFlask on your local machine using Kubernetes.

## Prerequisites

You'll need a local Kubernetes cluster. Choose one of these options:

### Option 1: Docker Desktop (Easiest)
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Enable Kubernetes in Docker Desktop settings
3. Wait for Kubernetes to start (green indicator)

### Option 2: minikube
```bash
brew install minikube
minikube start --memory=8192 --cpus=4
```

### Option 3: kind (Kubernetes in Docker)
```bash
brew install kind
kind create cluster --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
  - containerPort: 443
    hostPort: 8443
EOF
```

## Quick Start (5 minutes)

### Step 1: Verify Kubernetes is Running

```bash
kubectl cluster-info
kubectl get nodes
```

You should see your local cluster running.

### Step 2: Install Dependencies

```bash
cd clearflask-helm

# Install MySQL and LocalStack
helm install clearflask-deps charts/clearflask-dependencies \
  --set mysql.enabled=true \
  --set localstack.enabled=true \
  --set mysql.persistence.size=2Gi \
  --set localstack.persistence.size=1Gi
```

Wait for dependencies to be ready:
```bash
kubectl get pods -w
# Wait until all pods show "Running" (Ctrl+C to exit)
```

### Step 3: Generate Secrets

```bash
# Generate all required secrets
TOKEN_SIGNER=$(openssl rand -base64 172 | tr -d '\n')
CURSOR_KEY=$(openssl rand -base64 16)
SSO_SECRET=$(uuidgen)
CONNECT_TOKEN=$(uuidgen)

echo "Secrets generated successfully!"
```

### Step 4: Install ClearFlask

```bash
helm install clearflask charts/clearflask \
  -f examples/minimal-values.yaml \
  --set global.domain=localhost \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

Wait for ClearFlask to be ready:
```bash
kubectl get pods -l app.kubernetes.io/name=clearflask -w
# Wait until both server and connect pods show "Running"
```

### Step 5: Access ClearFlask

Since we're using minimal config without Ingress, use port-forwarding:

```bash
# Forward the Connect service to localhost:3000
kubectl port-forward svc/clearflask-connect 3000:80
```

Open your browser to: **http://localhost:3000**

## Accessing Individual Components

### Access the Frontend (Connect)
```bash
kubectl port-forward svc/clearflask-connect 3000:80
# Visit: http://localhost:3000
```

### Access the Backend API (Server)
```bash
kubectl port-forward svc/clearflask-server 8080:8080
# Visit: http://localhost:8080/api/health
```

### Access MySQL
```bash
kubectl port-forward svc/clearflask-deps-mysql 3306:3306
# Connect: mysql -h 127.0.0.1 -P 3306 -u root -pclearflask
```

### Access LocalStack
```bash
kubectl port-forward svc/clearflask-deps-localstack 4566:4566
# Test: aws --endpoint-url=http://localhost:4566 dynamodb list-tables
```

## Advanced: Local Setup with Ingress

If you want to test with a real domain and Ingress (more production-like):

### Step 1: Install NGINX Ingress Controller

```bash
# For Docker Desktop or kind
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### Step 2: Install cert-manager (for TLS)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=120s

# Create a self-signed ClusterIssuer for local development
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned-issuer
spec:
  selfSigned: {}
EOF
```

### Step 3: Install ClearFlask with Ingress

```bash
helm install clearflask charts/clearflask \
  -f charts/clearflask/values-selfhost.yaml \
  --set global.domain=clearflask.local \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN" \
  --set ingress.enabled=true \
  --set ingress.certManager.issuer=selfsigned-issuer \
  --set server.config.authCookieSecure=false
```

### Step 4: Add to /etc/hosts

```bash
echo "127.0.0.1 clearflask.local" | sudo tee -a /etc/hosts
```

### Step 5: Access via Domain

**For Docker Desktop:**
```bash
# Visit: http://clearflask.local
```

**For minikube:**
```bash
minikube tunnel  # Run in separate terminal
# Visit: http://clearflask.local
```

**For kind:**
```bash
# Visit: http://localhost:8080 (mapped in cluster config)
```

## Monitoring Your Local Deployment

### View All Resources
```bash
kubectl get all -l app.kubernetes.io/instance=clearflask
```

### Check Logs

**Server logs:**
```bash
kubectl logs -l app.kubernetes.io/component=server -f
```

**Connect logs:**
```bash
kubectl logs -l app.kubernetes.io/component=connect -f
```

**MySQL logs:**
```bash
kubectl logs -l app.kubernetes.io/component=mysql -f
```

**LocalStack logs:**
```bash
kubectl logs -l app.kubernetes.io/component=localstack -f
```

### Health Checks

**Server health:**
```bash
kubectl port-forward svc/clearflask-server 8080:8080
curl http://localhost:8080/api/health
# Should return: OK
```

**Connect health:**
```bash
kubectl port-forward svc/clearflask-connect 3000:80
curl http://localhost:3000/
# Should return HTML
```

### Resource Usage

```bash
# Check pod resource usage
kubectl top pods

# Check node resource usage
kubectl top nodes
```

## Troubleshooting

### Pods Not Starting

**Check pod status:**
```bash
kubectl get pods
kubectl describe pod <pod-name>
```

**Common issues:**
- Insufficient resources: Increase Docker Desktop memory to 8GB+
- Image pull errors: Check internet connection
- Pending pods: Check PVC status with `kubectl get pvc`

### Can't Access Application

**Check services:**
```bash
kubectl get svc
```

**Check ingress (if using):**
```bash
kubectl get ingress
kubectl describe ingress clearflask
```

**Verify port-forwarding:**
```bash
# Make sure port-forward command is running
kubectl port-forward svc/clearflask-connect 3000:80
# Try in browser: http://localhost:3000
```

### Database Connection Errors

**Check MySQL is running:**
```bash
kubectl get pods -l app.kubernetes.io/component=mysql
```

**Test MySQL connection:**
```bash
kubectl exec -it clearflask-deps-mysql-0 -- mysql -u root -pclearflask -e "SHOW DATABASES;"
```

**Check LocalStack is running:**
```bash
kubectl get pods -l app.kubernetes.io/component=localstack
```

**Test LocalStack:**
```bash
kubectl port-forward svc/clearflask-deps-localstack 4566:4566
curl http://localhost:4566/health
```

### Server/Connect Not Starting

**Check configuration:**
```bash
kubectl get configmap clearflask-server -o yaml
kubectl get secret clearflask-server -o yaml
```

**Check if secrets are set:**
```bash
kubectl get secret clearflask-server -o jsonpath='{.data.tokenSignerPrivKey}' | base64 -d
# Should output a long base64 string
```

## Making Changes

### Update Configuration

```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set server.config.signupEnabled=false
```

### Restart Pods

```bash
kubectl rollout restart deployment clearflask-server
kubectl rollout restart deployment clearflask-connect
```

### View Configuration

```bash
helm get values clearflask
```

## Cleaning Up

### Uninstall ClearFlask
```bash
helm uninstall clearflask
```

### Uninstall Dependencies
```bash
helm uninstall clearflask-deps
```

### Delete Persistent Data
```bash
kubectl delete pvc -l app.kubernetes.io/instance=clearflask-deps
```

### Stop Kubernetes (optional)

**Docker Desktop:**
- Disable Kubernetes in settings

**minikube:**
```bash
minikube stop
# Or completely delete: minikube delete
```

**kind:**
```bash
kind delete cluster
```

## Development Workflow

### Make Code Changes

If you're developing ClearFlask itself:

1. **Build new Docker images:**
```bash
cd clearflask-release
mvn install -DskipTests
```

2. **Load images into local cluster:**

**For kind:**
```bash
kind load docker-image clearflask/clearflask-server:latest
kind load docker-image clearflask/clearflask-connect:latest
```

**For minikube:**
```bash
minikube image load clearflask/clearflask-server:latest
minikube image load clearflask/clearflask-connect:latest
```

3. **Update deployment:**
```bash
kubectl rollout restart deployment clearflask-server
kubectl rollout restart deployment clearflask-connect
```

### Quick Iteration

For rapid development, you can:

1. Build locally without Docker
2. Use `kubectl port-forward` to access services
3. Run server/connect outside of Kubernetes pointing to K8s services

## Performance Tips

### Reduce Resource Usage

For development, use minimal resources:

```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set server.replicaCount=1 \
  --set connect.replicaCount=1 \
  --set server.autoscaling.enabled=false \
  --set connect.autoscaling.enabled=false \
  --set server.resources.requests.memory=1Gi \
  --set server.resources.limits.memory=2Gi \
  --set connect.resources.requests.memory=256Mi \
  --set connect.resources.limits.memory=512Mi
```

### Speed Up Startup

**Disable startup wait:**
```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set server.config.startupWaitUntilDeps=false
```

## Next Steps

- **Create admin account**: Visit http://localhost:3000 and sign up
- **Configure project**: Set up your feedback portal
- **Test features**: Try creating posts, voting, commenting
- **Explore API**: http://localhost:8080/api/
- **Check logs**: Monitor application behavior

## Need Help?

- Check logs: `kubectl logs -l app.kubernetes.io/name=clearflask --all-containers -f`
- Describe resources: `kubectl describe pod <pod-name>`
- Check events: `kubectl get events --sort-by='.lastTimestamp'`
- Test connectivity: `kubectl run -it --rm debug --image=busybox --restart=Never -- sh`

Happy local development! 🚀
