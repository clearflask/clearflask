# INSTALLATION

## Table of Contents:

- [TLDR](#tldr)
- [Deploy dependencies](#deploy-dependencies)
    - [Via Docker](#via-docker)
    - [Via AWS](#via-aws)
- [Deploy ClearFlask](#deploy-clearflask)

## TLDR

Ensure you have [Docker](https://www.docker.com/products/docker-desktop) installed and started.

Download the [latest release](https://github.com/clearflask/clearflask/packages/955621)
of `clearflask-release-*-docker-compose-self-host.tar.gz` containing Docker Compose definition and configuration files.
Unpack it all, and run the the following in the same directory:

```shell
docker-compose --profile with-deps up
```

Point your browser at [http://localhost/signup](http://localhost/signup) and create an account using
email `admin@localhost`.

## Deploy dependencies

There are several dependencies you need for running ClearFlask:

- **AWS DynamoDB** or alternative
- **AWS S3** or alternative
- **ElasticSearch**
- **AWS SES** or any SMTP endpoint
- **Google ReCaptcha** (Obtain free V2 keys [here](https://www.google.com/recaptcha/admin))

And a few optional:

- **CloudFront** as a CDN (Use in front of `clearflask-connect`)
- **KillBill** for billing and payment processing. (Self-hosting is preconfigured for unlimited plans)
- ~~**AWS Route53**~~ (Was and may be used in the future for automatic LetsEncrypt DNS challenges)

### Via Docker

Although not intended for production, you can spin up all dependencies via Docker.

Simply add the `--profile with-deps` to your `docker-compose` command when starting ClearFlask.

All database content will be persisted to local filesystem under `data` folder.

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

### Setup

1. Download or build the artifact `clearflask-release-*-docker-compose-self-host.tar.gz`
2. Carefully read and modify `config-selfhost.cfg`.
3. Carefully read and modify `connect.config.json`.

### Run

1. Run `docker-compose up` or `docker-compose --profile with-deps up` to also start dependencies.
2. Point your browser at `http://localhost/signup` or if you configured your DNS `https://yoursite.com/signup`.
3. Create an account using `admin@localhost` email or based on your configuration of `superAdminEmailRegex`.
