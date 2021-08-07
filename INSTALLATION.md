# INSTALLATION

## Table of Contents:

- [Deploy ClearFlask](#deploy-clearflask)
- [Deploy dependencies](#deploy-dependencies)
    - [Via Docker](#via-docker)
    - [Via AWS](#via-aws)
- [Improvements](#improvements)

## Deploy ClearFlask

ClearFlask consists of two components:

- Tomcat application for serving API requests
- NodeJS for SSR, dynamic cert management and serving static files

At this time, we have not published any releases just yet ahead of launch.

For now see how to [build ClearFlask](BUILDING.md).

### Install

1. Unpack the artifact `clearflask-release/target/clearflask-release-*-docker-compose-self-host.tar.gz`
2. Copy `config-selfhost-template.cfg` to `config-selfhost.cfg` and fill out properties
3. Copy `connect.config.template.json` to `connect.config.json` and fill out properties

### Run

Now it is as simple as

```shell
docker-compose up
```

## Deploy dependencies

There are several dependencies required for ClearFlask that you must deploy:

Required:

- **AWS DynamoDB** (IAM access, tables are created on first start-up)
- **AWS S3** for user file uploads (Create private bucket, IAM access)
- **ElasticSearch** (Can use AWS ES)
- **Google ReCaptcha** (Obtain keys [here](https://www.google.com/recaptcha/admin))
- **AWS SES** or **SMTP service** for sending transactional emails (IAM access, need to apply for approval via AWS
  support)

Optional:

- **CloudFront** as a CDN (Use in front of `clearflask-connect`)
- **KillBill** for billing and payment processing. (Self-hosting is preconfigured for unlimited plans)
- ~~**AWS Route53**~~ (Was and may be used in the future for automatic LetsEncrypt DNS challenges)

### Via Docker

Although not intended for production, you can spin up all dependencies via Docker.

1. Unpack the artifact if haven't
   already `clearflask-release/target/clearflask-release-*-docker-compose-self-host.tar.gz`
2. Run `docker-compose -f docker-compose.deps.yml up`

### Via AWS

For production workload, you will want to spin up these dependencies yourself and point ClearFlask to their endpoints.

- **AWS DynamoDB** (IAM access, tables are created on first start-up)
- **AWS S3** for user file uploads (Create private bucket, IAM access)
- **ElasticSearch** (Can use AWS ES)
- **AWS SES** or **SMTP service** for sending transactional emails (IAM access, need to apply for approval via AWS
  support)
- **Google ReCaptcha** (Obtain keys [here](https://www.google.com/recaptcha/admin))

## Improvements

There is an effort to make self-hosting less painful.

At this time it is considered in Alpha until we complete these tasks:

- [x] Support for SMTP to replace SES
- [x] Support for S3 alternative (Minio? LocalStack?)
- [x] Support for DynamoDB alternative (Cassandra? dynamo-cassandra-proxy? LocalStack?)
- [x] Stub out Payment Processor dependency
- [x] Remove Route53 dependency
- [ ] Alternative landing page and dashboard for single-customer use-case
- [ ] Dockerize and publish
    - [ ] Do not hardcode VAPID public key on client
- [ ] Update Installation instructions
