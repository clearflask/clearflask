# INSTALLATION

## Table of Contents:

- [Quick start](#quick-start)
- [Deploy dependencies](#deploy-dependencies)
    - [Via Docker](#via-docker)
    - [Via AWS](#via-aws)
- [Deploy ClearFlask](#deploy-clearflask)
    - [Setup](#setup)
    - [Run](#run)

## Quick start

For a quick start using [Docker](https://www.docker.com/products/docker-desktop), download
the [Docker Compose service file](clearflask-release/src/main/docker/compose/docker-compose.self-host.yml)
as `docker-compose.yml`, and run the following:

```shell
docker-compose --profile with-deps up
```

Point your browser at [http://localhost](http://localhost) and create an account using email `admin@localhost`.

If you wish to host it remotely other than `localhost`, read the [DNS section](#dns).

Otherwise read on to deploy a long-term installation.

## Deploy dependencies

There are several dependencies you need for running ClearFlask:

- **AWS DynamoDB** or alternative
- **AWS S3** or alternative
- **ElasticSearch**
- **AWS SES** or any SMTP endpoint
- **Google ReCaptcha**

And a few optional:

- **Let's Encrypt** automagic certificate management
- **CloudFront** as a CDN (Use in front of `clearflask-connect`)

### Via Docker

Although not intended for production, you can spin up all dependencies via Docker.

Simply add the `--profile with-deps` to your `docker-compose` command when starting ClearFlask.

All database content will be persisted to local filesystem under `data` folder.

### Via AWS

For production workload, you will want to spin up these dependencies yourself and point ClearFlask to their endpoints.

##### IAM access

For AWS services, `clearflask-server` auto-detects Access Keys using either a configuration property or the default
locations. If you are running in EC2 or ECS, keys detection is automated, you just need to create the appropriate IAM
role.

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

1. Download or build the artifact `clearflask-release-*-docker-compose-self-host.tar.gz` from
   the [latest release](https://github.com/clearflask/clearflask/packages/955621)
2. Carefully read and modify `server/config-selfhost.cfg`.
3. Carefully read and modify `connect/connect.config.json`.

#### DNS

By default, everything is assumed to be on `localhost`. If you wish to host your portal on `yoursite.com` or `192.168.1.123`, set the following properties:

- `connect.config.json:parentDomain`: `yoursite.com`
- `config-selfhost.cfg:com.smotana.clearflask.web.Application$Config.domain`: `yoursite.com`

#### Certificate management

By default, it is assumed you are managing TLS certificates behind a reverse proxy. If you wish to redirect all `http` requests to `https`, set the following config:

- `connect.config.json:disableAutoFetchCertificate`: `true`
- `connect.config.json:forceRedirectHttpToHttps`: `true`

If you wish to have certificates fetched and renewed for you automagically using Let's Encrypt, ensure your
DNS is correctly pointing to your server, it is publicly accessible, and set the following config parameters:

- `connect.config.json:disableAutoFetchCertificate`: `false`
- `config-selfhost.cfg:com.smotana.clearflask.web.resource.ConnectResource$Config.domainWhitelist`: `^yoursite.com$`

Once you load your site for the first time, a Certificate is auto-magically fetched for you.

##### Self-managed reverse-proxy

If instead you wish to manage certificates yourself using a reverse proxy, set the following properties to redirect to
https and trust the last reverse proxy in the list:

#### Dashboard account

For you to manage the dashboard, you need to whitelist an email to be able to create a super-admin account:

`config-selfhost.cfg:com.smotana.clearflask.web.security.SuperAdminPredicate$Config.superAdminEmailRegex`: `^admin@yoursite.com$`

After you sign-up, disable further signups using:

`config-selfhost.cfg:com.smotana.clearflask.web.resource.AccountResource$Config.signupEnabled`: `false`

### Run

1. Run `docker-compose up` or `docker-compose --profile with-deps up` to also start dependencies.
2. Point your browser at `http://localhost` or if you configured your DNS `https://yoursite.com`.
3. Create an account using `admin@localhost` email or based on your configuration of `superAdminEmailRegex`.
