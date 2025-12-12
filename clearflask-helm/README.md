# ClearFlask Kubernetes Deployment via Helm

Production-ready Helm charts for deploying ClearFlask on Kubernetes.

## Overview

This repository contains Helm charts for deploying [ClearFlask](https://clearflask.com), an open-source feedback
management platform (alternative to Canny/UserVoice), on Kubernetes clusters.

## Charts

### 1. clearflask

Main application chart containing:

- **clearflask-server**: Java/Tomcat backend API
- **clearflask-connect**: Node.js SSR frontend
- Ingress configuration with TLS support
- Horizontal Pod Autoscaling
- Network policies and RBAC

### 2. clearflask-dependencies

Optional infrastructure components:

- **MySQL/MariaDB**: Search and filtering database
- **LocalStack**: AWS service emulation (DynamoDB, S3, SES)
- **ElasticSearch**: Advanced search engine (optional)

## Quick Start

### Self-Hosted Deployment

1. **Add Helm repository**:

```bash
helm repo add clearflask https://clearflask.github.io/clearflask
helm repo update
```

2. **Install dependencies**:

```bash
helm install clearflask-deps clearflask/clearflask-dependencies \
  --set mysql.enabled=true \
  --set localstack.enabled=true
```

3. **Generate secrets**:

```bash
TOKEN_SIGNER=$(openssl rand -base64 172 | tr -d '\n')
CURSOR_KEY=$(openssl rand -base64 16)
SSO_SECRET=$(uuidgen)
CONNECT_TOKEN=$(uuidgen)
```

4. **Install ClearFlask**:

```bash
helm install clearflask clearflask/clearflask \
  --set global.domain=yourdomain.com \
  --set server.config.searchEngine=READWRITE_MYSQL \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

5. **Access your instance**:

```bash
kubectl port-forward svc/clearflask-connect 3000:80
# Visit http://localhost:3000
```

### Local Development (from source)

Run ClearFlask on your local Kubernetes cluster using charts from the repository:

```bash
git clone https://github.com/clearflask/clearflask.git
cd clearflask/clearflask-helm
./local-start.sh
```

Then access at: http://localhost:3000 (after running port-forward as shown)

📖 **[Full Local Setup Guide](LOCAL-SETUP.md)** - Detailed instructions for local development

## Deployment Scenarios

### Scenario 1: Self-Hosted Kubernetes

Perfect for on-premises or bare-metal deployments.

**Features**:

- Complete self-contained deployment
- MySQL for search/filtering
- LocalStack for AWS service emulation
- No external cloud dependencies

**Installation**: See "Self-Hosted Deployment" above

**Documentation**: [charts/clearflask/values-selfhost.yaml](charts/clearflask/values-selfhost.yaml)

### Scenario 2: AWS EKS

Perfect for production deployments on AWS.

**Features**:

- Native AWS services (DynamoDB, S3, ElasticSearch, SES)
- IAM Roles for Service Accounts (IRSA)
- AWS Load Balancer Controller
- Horizontal autoscaling

**Installation**:

```bash
helm repo add clearflask https://clearflask.github.io/clearflask
helm install clearflask clearflask/clearflask \
  --set global.domain=yourdomain.com \
  --set server.config.searchEngine=READWRITE_ELASTICSEARCH \
  --set server.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::ACCOUNT:role/clearflask-server \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

**Documentation**: [charts/clearflask/values-aws-eks.yaml](charts/clearflask/values-aws-eks.yaml)

### Scenario 3: Google GKE / Azure AKS

Perfect for production deployments on GCP or Azure.

**Features**:

- Managed MySQL (Cloud SQL / Azure Database)
- Cloud Storage (GCS / Azure Blob)
- Workload Identity / Pod Identity
- LocalStack for DynamoDB compatibility

**Installation**:

```bash
helm repo add clearflask https://clearflask.github.io/clearflask
helm install clearflask clearflask/clearflask \
  --set global.domain=yourdomain.com \
  --set server.config.searchEngine=READWRITE_MYSQL \
  --set server.serviceAccount.annotations."iam\.gke\.io/gcp-service-account"=clearflask-server@PROJECT.iam.gserviceaccount.com \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

**Documentation**: [charts/clearflask/values-gke.yaml](charts/clearflask/values-gke.yaml)

## Prerequisites

### Required

- Kubernetes 1.19+
- Helm 3.0+
- kubectl configured to access your cluster

### Optional

- **cert-manager**: For automatic TLS certificates
- **Ingress Controller**: NGINX, Traefik, or cloud-specific (ALB, GCE)
- **Prometheus Operator**: For monitoring integration

### Cluster Resources

Minimum requirements for default configuration:

- **CPU**: 2 cores
- **Memory**: 4GB RAM
- **Storage**: 30GB (for dependencies)

Recommended for production:

- **CPU**: 4+ cores
- **Memory**: 8+ GB RAM
- **Storage**: 100GB+

## Architecture

```
┌─────────────────────────────────────────┐
│           Kubernetes Cluster            │
│                                         │
│  ┌────────────┐        ┌──────────────┐ │
│  │   Ingress  │───────▶│   Connect    │ │
│  │  (NGINX)   │        │  (Frontend)  │ │
│  └────────────┘        └──────┬───────┘ │
│                               │         │
│                               ▼         │
│                        ┌──────────────┐ │
│                        │    Server    │ │
│                        │  (Backend)   │ │
│                        └──────┬───────┘ │
│                               │         │
│         ┌─────────────────────┼─────────┼──┐
│         │                     │         │  │
│         ▼                     ▼         ▼  │
│  ┌────────────┐        ┌──────────┐  ┌────────┐
│  │   MySQL    │        │LocalStack│  │  ...   │
│  │ (optional) │        │(optional)│  │        │
│  └────────────┘        └──────────┘  └────────┘
│                                         │
└─────────────────────────────────────────┘
```

## Configuration

### Required Secrets

Generate these before installation:

```bash
# JWT signing key
openssl rand -base64 172 | tr -d '\n'

# Cursor encryption key
openssl rand -base64 16

# SSO secret
uuidgen

# Connect-Server token
uuidgen

# Browser push keys
npx web-push generate-vapid-keys
```

### Key Configuration Options

| Parameter                            | Description            | Required |
|--------------------------------------|------------------------|----------|
| `global.domain`                      | Your domain name       | Yes      |
| `server.secrets.tokenSignerPrivKey`  | JWT signing key        | Yes      |
| `server.secrets.cursorSharedKey`     | Cursor encryption key  | Yes      |
| `server.secrets.ssoSecretKey`        | SSO secret             | Yes      |
| `server.secrets.connectToken`        | Connect token          | Yes      |
| `server.config.searchEngine`         | MySQL or ElasticSearch | No       |
| `server.config.superAdminEmail`      | Admin email regex      | No       |
| `externalServices.dynamodb.endpoint` | DynamoDB endpoint      | No       |
| `externalServices.s3.bucketName`     | S3 bucket name         | No       |

See [charts/clearflask/README.md](charts/clearflask/README.md) for complete configuration options.

## Upgrading

### Upgrade ClearFlask

```bash
helm upgrade clearflask charts/clearflask --reuse-values
```

### Change Configuration

```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set server.config.signupEnabled=false
```

### Upgrade to New Version

```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set server.image.tag=2.2.1 \
  --set connect.image.tag=2.2.1
```

## Uninstallation

```bash
# Uninstall ClearFlask
helm uninstall clearflask

# Uninstall dependencies (if installed)
helm uninstall clearflask-deps

# Delete persistent data (optional)
kubectl delete pvc -l app.kubernetes.io/instance=clearflask-deps
```

## Monitoring

### Health Checks

**Server health**:

```bash
kubectl port-forward svc/clearflask-server 8080:8080
curl http://localhost:8080/api/health
```

**Logs**:

```bash
# Server logs
kubectl logs -l app.kubernetes.io/component=server -f

# Connect logs
kubectl logs -l app.kubernetes.io/component=connect -f
```

### Prometheus Integration

Enable ServiceMonitor for Prometheus Operator:

```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set monitoring.serviceMonitor.enabled=true
```

## Troubleshooting

### Common Issues

**Pods not starting**:

```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

**Can't access application**:

- Check Ingress: `kubectl get ingress`
- Verify DNS points to LoadBalancer IP
- Check TLS certificate: `kubectl get certificate`

**Database connection errors**:

- Verify dependencies are running: `kubectl get pods`
- Check service endpoints: `kubectl get svc`
- Review network policies if enabled

### Debug Mode

Enable verbose logging:

```bash
helm upgrade clearflask charts/clearflask \
  --reuse-values \
  --set server.env.JAVA_OPTS="-Xmx2g -XX:+UseG1GC -Dlog.level=DEBUG"
```

## Migration

### From Docker Compose

1. Export current configuration and secrets
2. Create equivalent Helm values
3. Deploy to Kubernetes pointing to same external services
4. Test functionality
5. Update DNS
6. Decommission Docker Compose

### From EC2 AutoScaling

1. Deploy Kubernetes cluster
2. Point to same DynamoDB/S3/ElasticSearch
3. Deploy ClearFlask on K8s
4. Split traffic using DNS weighting
5. Gradually shift traffic to K8s
6. Full cutover
7. Decommission EC2

## Security

### Production Checklist

- [ ] Generate unique secrets (don't use defaults!)
- [ ] Enable HTTPS (`server.config.authCookieSecure=true`)
- [ ] Use strong MySQL password
- [ ] Enable network policies
- [ ] Use IAM roles (not static credentials)
- [ ] Restrict super admin regex
- [ ] Disable signup after creating admin
- [ ] Regular security updates
- [ ] Monitor access logs

## Documentation

- **ClearFlask Chart**: [charts/clearflask/README.md](charts/clearflask/README.md)
- **Dependencies Chart**: [charts/clearflask-dependencies/README.md](charts/clearflask-dependencies/README.md)
- **Examples**: [examples/](examples/)
- **Official Docs**: https://github.com/clearflask/clearflask

## Contributing

Contributions are welcome! Please submit issues and pull requests to:
https://github.com/clearflask/clearflask

## Support

- **GitHub Issues**: https://github.com/clearflask/clearflask/issues
- **Website**: https://clearflask.com
- **Documentation**: https://github.com/clearflask/clearflask

## License

Apache-2.0
