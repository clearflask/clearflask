# ClearFlask Helm Chart

Open-source feedback management platform for Kubernetes.

## Introduction

This Helm chart deploys ClearFlask on a Kubernetes cluster. ClearFlask is an alternative to Canny and UserVoice for collecting and managing customer feedback, feature requests, and roadmaps.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (for dependencies)
- Optional: cert-manager for automatic TLS certificates
- Optional: NGINX Ingress Controller or equivalent

## Installation

### Quick Start (Self-Hosted)

1. Install dependencies (MySQL + LocalStack):
```bash
helm install clearflask-deps ../clearflask-dependencies \
  --set mysql.enabled=true \
  --set localstack.enabled=true
```

2. Generate required secrets:
```bash
TOKEN_SIGNER=$(openssl rand -base64 172 | tr -d '\n')
CURSOR_KEY=$(openssl rand -base64 16)
SSO_SECRET=$(uuidgen)
CONNECT_TOKEN=$(uuidgen)
```

3. Install ClearFlask:
```bash
helm install clearflask . \
  -f values-selfhost.yaml \
  --set global.domain=yourdomain.com \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

### AWS EKS Deployment

```bash
helm install clearflask . \
  -f values-aws-eks.yaml \
  --set global.domain=yourdomain.com \
  --set server.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::ACCOUNT:role/clearflask-server \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

### Google GKE Deployment

```bash
helm install clearflask . \
  -f values-gke.yaml \
  --set global.domain=yourdomain.com \
  --set server.serviceAccount.annotations."iam\.gke\.io/gcp-service-account"=clearflask-server@PROJECT.iam.gserviceaccount.com \
  --set server.secrets.tokenSignerPrivKey="$TOKEN_SIGNER" \
  --set server.secrets.cursorSharedKey="$CURSOR_KEY" \
  --set server.secrets.ssoSecretKey="$SSO_SECRET" \
  --set server.secrets.connectToken="$CONNECT_TOKEN"
```

## Configuration

### Required Secrets

The following secrets **must** be generated before installation:

| Secret | Generation Command | Description |
|--------|-------------------|-------------|
| `server.secrets.tokenSignerPrivKey` | `openssl rand -base64 172 \| tr -d '\n'` | JWT signing key for auth tokens |
| `server.secrets.cursorSharedKey` | `openssl rand -base64 16` | Encryption key for search cursors |
| `server.secrets.ssoSecretKey` | `uuidgen` | SSO secret key |
| `server.secrets.connectToken` | `uuidgen` | Shared secret between connect and server |
| `server.secrets.browserPush.publicKey`<br>`server.secrets.browserPush.privateKey` | `npx web-push generate-vapid-keys` | VAPID keys for web push notifications |

### Key Configuration Parameters

#### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.domain` | Your domain name | `localhost` |
| `global.imagePullSecrets` | Image pull secrets | `[]` |

#### Server Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `server.replicaCount` | Number of server replicas | `2` |
| `server.image.repository` | Server image repository | `ghcr.io/clearflask/clearflask-server` |
| `server.image.tag` | Server image tag | `latest` |
| `server.config.environment` | Environment mode | `PRODUCTION_SELF_HOST` |
| `server.config.searchEngine` | Search engine | `READWRITE_MYSQL` |
| `server.resources.requests.memory` | Memory request | `2Gi` |
| `server.resources.limits.memory` | Memory limit | `4Gi` |
| `server.autoscaling.enabled` | Enable HPA | `true` |
| `server.autoscaling.minReplicas` | Min replicas | `2` |
| `server.autoscaling.maxReplicas` | Max replicas | `10` |

#### Connect Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `connect.replicaCount` | Number of connect replicas | `2` |
| `connect.image.repository` | Connect image repository | `ghcr.io/clearflask/clearflask-connect` |
| `connect.image.tag` | Connect image tag | `latest` |
| `connect.config.disableAutoFetchCertificate` | Disable built-in Let's Encrypt | `true` |
| `connect.config.forceRedirectHttpToHttps` | Force HTTPS redirect | `false` |
| `connect.autoscaling.minReplicas` | Min replicas | `2` |
| `connect.autoscaling.maxReplicas` | Max replicas | `20` |

#### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable Ingress | `true` |
| `ingress.className` | Ingress class | `nginx` |
| `ingress.certManager.enabled` | Use cert-manager | `true` |
| `ingress.certManager.issuer` | ClusterIssuer name | `letsencrypt-prod` |

#### External Services

| Parameter | Description | Default |
|-----------|-------------|---------|
| `externalServices.dynamodb.endpoint` | DynamoDB endpoint | `http://clearflask-deps-localstack:4566` |
| `externalServices.s3.endpoint` | S3 endpoint | `http://s3.localhost.localstack.cloud:4566` |
| `externalServices.mysql.enabled` | Use MySQL | `true` |
| `externalServices.mysql.host` | MySQL host | `clearflask-deps-mysql` |
| `externalServices.elasticsearch.enabled` | Use ElasticSearch | `false` |
| `externalServices.email.provider` | Email provider (`ses` or `smtp`) | `ses` |

### Values Files

The chart includes several pre-configured values files:

- `values.yaml` - Default values (self-hosted with in-cluster dependencies)
- `values-selfhost.yaml` - Self-hosted Kubernetes deployment
- `values-aws-eks.yaml` - AWS EKS with native AWS services
- `values-gke.yaml` - Google GKE with managed services

## Deployment Scenarios

### Scenario 1: Self-Hosted with In-Cluster Dependencies

Perfect for: On-premises, bare-metal, or development clusters

**Features**:
- MySQL for search/filtering
- LocalStack for DynamoDB/S3/SES emulation
- No external cloud dependencies
- Complete self-contained deployment

**Requirements**:
- Install `clearflask-dependencies` chart first
- Persistent volumes for data storage

### Scenario 2: AWS EKS with AWS Services

Perfect for: Production deployments on AWS

**Features**:
- Native AWS DynamoDB
- AWS S3 for file storage
- AWS ElasticSearch/OpenSearch
- AWS SES for email
- IAM Roles for Service Accounts (IRSA)

**Requirements**:
- AWS EKS cluster
- External AWS services (DynamoDB, S3, ES, SES)
- IAM roles configured

### Scenario 3: GKE with Managed Services

Perfect for: Production deployments on Google Cloud

**Features**:
- Cloud SQL for MySQL
- Google Cloud Storage (S3-compatible API)
- LocalStack for DynamoDB compatibility
- SMTP for email (SendGrid, etc.)
- Workload Identity

**Requirements**:
- Google GKE cluster
- Cloud SQL instance
- GCS bucket
- Workload Identity configured

## Upgrading

### Upgrade to a New Version

```bash
helm upgrade clearflask . \
  --reuse-values \
  --set server.image.tag=2.2.1
```

### Modify Configuration

```bash
helm upgrade clearflask . \
  --reuse-values \
  --set server.config.signupEnabled=false
```

## Uninstallation

```bash
helm uninstall clearflask
helm uninstall clearflask-deps  # If using dependencies chart
```

**Note**: This will not delete PersistentVolumeClaims. Delete them manually if needed:
```bash
kubectl delete pvc -l app.kubernetes.io/instance=clearflask-deps
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -l app.kubernetes.io/name=clearflask
```

### View Server Logs
```bash
kubectl logs -l app.kubernetes.io/component=server -f
```

### View Connect Logs
```bash
kubectl logs -l app.kubernetes.io/component=connect -f
```

### Test Health Endpoint
```bash
kubectl port-forward svc/clearflask-server 8080:8080
curl http://localhost:8080/api/health
```

### Common Issues

#### Pods Not Starting
- Check if secrets are properly configured
- Verify dependencies (MySQL, LocalStack) are running
- Check resource limits

#### Can't Access Application
- Verify Ingress is created: `kubectl get ingress`
- Check Ingress controller is installed
- Verify DNS points to LoadBalancer IP
- Check TLS certificate status: `kubectl get certificate`

#### Database Connection Errors
- Verify MySQL/LocalStack pods are running
- Check service names match configuration
- Verify network policies allow traffic

## Security

### Production Checklist

- [ ] Generate unique secrets (don't use defaults)
- [ ] Enable TLS/HTTPS (`server.config.authCookieSecure=true`)
- [ ] Use strong MySQL password
- [ ] Enable network policies (`networkPolicy.enabled=true`)
- [ ] Configure pod security contexts
- [ ] Use IAM roles instead of static credentials (EKS/GKE)
- [ ] Restrict super admin email regex
- [ ] Disable signup after creating admin account

## Monitoring

### Prometheus Integration

Enable ServiceMonitor for Prometheus Operator:
```bash
helm upgrade clearflask . \
  --reuse-values \
  --set monitoring.serviceMonitor.enabled=true
```

### JMX Metrics

Server exposes JMX on port 9950 for monitoring.

## Support

- **Documentation**: https://github.com/clearflask/clearflask
- **Website**: https://clearflask.com
- **Issues**: https://github.com/clearflask/clearflask/issues

## License

Apache-2.0
