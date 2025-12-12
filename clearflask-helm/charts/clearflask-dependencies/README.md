# ClearFlask Dependencies Helm Chart

Optional infrastructure dependencies for ClearFlask including MySQL, LocalStack, and ElasticSearch.

## Introduction

This Helm chart provides optional in-cluster infrastructure components for ClearFlask. Use this chart when deploying ClearFlask in self-hosted or development environments where external cloud services (AWS DynamoDB, S3, SES, ElasticSearch) are not available.

## Components

### MySQL (MariaDB 10.5)
- **Purpose**: Search and filtering database
- **Default**: Enabled
- **Storage**: 20Gi persistent volume
- **Use Case**: Recommended for small to medium deployments

### LocalStack
- **Purpose**: AWS service emulation (DynamoDB, S3, SES)
- **Default**: Enabled
- **Storage**: 10Gi persistent volume
- **Services**: DynamoDB, S3, SES
- **Use Case**: Self-hosted deployments without AWS

### ElasticSearch 7.10.0
- **Purpose**: Advanced search with fuzzy matching
- **Default**: Disabled
- **Storage**: 50Gi persistent volume
- **Use Case**: Large deployments requiring advanced search

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure
- Sufficient cluster resources

## Installation

### Default Installation (MySQL + LocalStack)

```bash
helm install clearflask-deps . \
  --set mysql.enabled=true \
  --set localstack.enabled=true
```

### With ElasticSearch

```bash
helm install clearflask-deps . \
  --set mysql.enabled=false \
  --set elasticsearch.enabled=true \
  --set localstack.enabled=true
```

### Minimal Installation (MySQL only)

```bash
helm install clearflask-deps . \
  --set mysql.enabled=true \
  --set localstack.enabled=false
```

## Configuration

### MySQL Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mysql.enabled` | Enable MySQL | `true` |
| `mysql.image.repository` | MySQL image | `mariadb` |
| `mysql.image.tag` | MySQL version | `10.5` |
| `mysql.auth.rootPassword` | Root password | `clearflask` |
| `mysql.auth.database` | Database name | `clearflask` |
| `mysql.persistence.enabled` | Enable persistence | `true` |
| `mysql.persistence.size` | PVC size | `20Gi` |
| `mysql.persistence.storageClass` | Storage class | `""` (default) |
| `mysql.resources.requests.memory` | Memory request | `1Gi` |
| `mysql.resources.limits.memory` | Memory limit | `2Gi` |

### LocalStack Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `localstack.enabled` | Enable LocalStack | `true` |
| `localstack.image.repository` | LocalStack image | `localstack/localstack` |
| `localstack.image.tag` | LocalStack version | `0.14.3` |
| `localstack.services` | Services to enable | `dynamodb,ses,s3` |
| `localstack.persistence.enabled` | Enable persistence | `true` |
| `localstack.persistence.size` | PVC size | `10Gi` |
| `localstack.aws.defaultRegion` | AWS region | `us-east-1` |
| `localstack.resources.requests.memory` | Memory request | `512Mi` |
| `localstack.resources.limits.memory` | Memory limit | `1Gi` |

### ElasticSearch Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `elasticsearch.enabled` | Enable ElasticSearch | `false` |
| `elasticsearch.image.repository` | ES image | `docker.elastic.co/elasticsearch/elasticsearch` |
| `elasticsearch.image.tag` | ES version | `7.10.0` |
| `elasticsearch.persistence.enabled` | Enable persistence | `true` |
| `elasticsearch.persistence.size` | PVC size | `50Gi` |
| `elasticsearch.config.discoveryType` | Discovery type | `single-node` |
| `elasticsearch.config.javaOpts` | Java options | `-Xms2g -Xmx2g` |
| `elasticsearch.resources.requests.memory` | Memory request | `2Gi` |
| `elasticsearch.resources.limits.memory` | Memory limit | `4Gi` |

## Service Endpoints

After installation, the following services will be available:

### MySQL
- **Service Name**: `<release-name>-mysql`
- **Port**: 3306
- **Connection String**: `<release-name>-mysql:3306`

### LocalStack
- **Service Name**: `<release-name>-localstack`
- **Edge Port**: 4566 (main endpoint)
- **Health Port**: 4571
- **DynamoDB Endpoint**: `http://<release-name>-localstack:4566`
- **S3 Endpoint**: `http://s3.localhost.localstack.cloud:4566`
- **SES Endpoint**: `http://<release-name>-localstack:4566`

### ElasticSearch
- **Service Name**: `<release-name>-elasticsearch`
- **HTTP Port**: 9200
- **Transport Port**: 9300
- **Endpoint**: `http://<release-name>-elasticsearch:9200`

## Storage Requirements

### Default Installation
- MySQL: 20Gi
- LocalStack: 10Gi
- **Total**: 30Gi

### With ElasticSearch
- MySQL/ElasticSearch: 50Gi (one or the other)
- LocalStack: 10Gi
- **Total**: 60Gi

## Resource Requirements

### Default Installation
- **CPU**: 750m requests, 1500m limits
- **Memory**: 1.5Gi requests, 3Gi limits

### With ElasticSearch
- **CPU**: 1250m requests, 2500m limits
- **Memory**: 2.5Gi requests, 5Gi limits

## Upgrading

```bash
helm upgrade clearflask-deps . --reuse-values
```

## Uninstallation

```bash
helm uninstall clearflask-deps
```

**Warning**: This will not delete PersistentVolumeClaims. To completely remove data:

```bash
kubectl delete pvc -l app.kubernetes.io/instance=clearflask-deps
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -l app.kubernetes.io/instance=clearflask-deps
```

### MySQL Issues

**Check logs**:
```bash
kubectl logs -l app.kubernetes.io/component=mysql -f
```

**Test connection**:
```bash
kubectl run -it --rm mysql-client --image=mysql:5.7 --restart=Never -- \
  mysql -h <release-name>-mysql -p
```

### LocalStack Issues

**Check logs**:
```bash
kubectl logs -l app.kubernetes.io/component=localstack -f
```

**Test health**:
```bash
kubectl port-forward svc/<release-name>-localstack 4566:4566
curl http://localhost:4566/health
```

**Test DynamoDB**:
```bash
aws --endpoint-url=http://localhost:4566 dynamodb list-tables
```

### ElasticSearch Issues

**Check logs**:
```bash
kubectl logs -l app.kubernetes.io/component=elasticsearch -f
```

**Test connection**:
```bash
kubectl port-forward svc/<release-name>-elasticsearch 9200:9200
curl http://localhost:9200/_cluster/health
```

**Common issue**: `vm.max_map_count` too low
```bash
# On each node:
sudo sysctl -w vm.max_map_count=262144
```

## Production Considerations

### MySQL
- Use a strong root password (don't use default)
- Consider external managed MySQL (Cloud SQL, RDS) for production
- Regular backups via PVC snapshots or mysqldump

### LocalStack
- **Not recommended for production**
- Use real AWS services (DynamoDB, S3, SES) for production workloads
- LocalStack is best for development and testing

### ElasticSearch
- Ensure adequate resources (4Gi+ memory)
- Monitor disk usage
- Consider managed ElasticSearch (AWS ES, Elastic Cloud) for production

## Migration

### From MySQL to ElasticSearch

1. Export data from MySQL
2. Install ElasticSearch:
```bash
helm upgrade clearflask-deps . \
  --set mysql.enabled=false \
  --set elasticsearch.enabled=true
```
3. Update ClearFlask to use ElasticSearch:
```bash
helm upgrade clearflask ../clearflask \
  --set server.config.searchEngine=READWRITE_ELASTICSEARCH \
  --set externalServices.elasticsearch.enabled=true \
  --set externalServices.elasticsearch.endpoint=http://<release-name>-elasticsearch:9200
```
4. Reindex data

### From LocalStack to AWS Services

1. Backup data from LocalStack
2. Create AWS resources (DynamoDB tables, S3 bucket)
3. Migrate data to AWS
4. Update ClearFlask configuration:
```bash
helm upgrade clearflask ../clearflask \
  -f ../clearflask/values-aws-eks.yaml
```
5. Uninstall LocalStack:
```bash
helm upgrade clearflask-deps . --set localstack.enabled=false
```

## Support

- **Documentation**: https://github.com/clearflask/clearflask
- **Issues**: https://github.com/clearflask/clearflask/issues

## License

Apache-2.0
