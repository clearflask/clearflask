# INSTALLATION

## Table of Contents:

- [Deploy dependencies](#deploy-dependencies)
    - [Via Docker](#via-docker)
    - [Via AWS](#via-aws)
- [Deploy ClearFlask](#deploy-clearflask)

## Deploy dependencies

There are several dependencies required for ClearFlask that are required:

- **AWS DynamoDB** or alternative
- **AWS S3** or alternative
- **ElasticSearch**
- **AWS SES** or any SMTP endpoint
- **Google ReCaptcha** (Obtain free V2 keys [here](https://www.google.com/recaptcha/admin))

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

##### IAM access

For AWS services, `clearflask-server` autodetects IAM using the `DefaultAWSCredentialsProviderChain`.

Specify IAM either in environment, Java system properties, credentials file, EC2 Container service, or Web Identity
token.

##### AWS DynamoDB

Provide IAM access including create table permission as table is created automatically by ClearFlask on startup.

IAM actions:

- CreateTable
- BatchGetItem
- GetItem
- Query
- BatchWriteItem
- DeleteItem
- PutItem
- UpdateItem

##### AWS S3

Create a private bucket with IAM access to ClearFlask.

IAM actions:

- ListBucket
- GetObject
- DeleteObject
- PutObject

You can also use an API-compatible alternative service such as Wasabi, MinIO...

##### ElasticSearch

Recommended is AWS ES, give the proper IAM access

IAM actions, all in these categories:

- List
- Read
- Write
- Tagging

Alternatively you can deploy it yourself (cheaper) or host it on Elastic

##### AWS SES

In order to setup SES, you need to seek limit increase via AWS support.

Change the config property `...EmailServiceImpl$Config.useService` to `ses` and give the proper IAM access.

IAM actions:

- SendEmail
- SendRawEmail

Alternatively use any other email provider and fill out the SMTP settings

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

### Setup

After you configure your DNS, you can now create an account at `yoursite.com/signup`. Use the email address you
configured via `superAdminEmailRegex` property.
