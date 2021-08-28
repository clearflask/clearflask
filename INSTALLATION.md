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

Ensure you have [Docker](https://www.docker.com/products/docker-desktop) installed and started.

Download the [latest release](https://github.com/clearflask/clearflask/packages/955621)
of `clearflask-release-*-docker-compose-self-host.tar.gz` containing Docker Compose definition and configuration files.
Unpack it all, and run the following in the same directory:

```shell
docker-compose --profile with-deps up
```

Point your browser at [http://localhost/signup](http://localhost/signup) and create an account using
email `admin@localhost`.

That's it!

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
- **KillBill** for billing and payment processing. (Self-hosting is preconfigured for unlimited plans)
- ~~**AWS Route53**~~ (Was and may be used in the future for automatic LetsEncrypt DNS challenges)

### Via Docker

Although not intended for production, you can spin up all dependencies via Docker.

Simply add the `--profile with-deps` to your `docker-compose` command when starting ClearFlask.

All database content will be persisted to local filesystem under `data` folder.

### Via AWS

For production workload, you will want to spin up these dependencies yourself and point ClearFlask to their endpoints.

##### IAM access

For AWS services, `clearflask-server` autodetects Access Keys using either a configuration property or the default locations. If you are running in EC2 or ECS, keys detection is automated, you just need to create the appropriate IAM role.

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

#### Dashboard account

For you to manage the dashboard, you need to whitelist an email to be able to create a super-admin account:

`config-selfhost.cfg:com.smotana.clearflask.web.security.SuperAdminPredicate$Config.superAdminEmailRegex`: `^admin@yoursite.com$`

After you sign-up, disable further signups using:

`config-selfhost.cfg:com.smotana.clearflask.web.resource.AccountResource$Config.signupEnabled`: `false`

#### DNS and certificates

By default, everything is assumed to be on `localhost`. If you wish to host your portal on `yoursite.com`, ensure your
DNS is correctly pointing to this server, and set these config parameters:

- `connect.config.json:parentDomain`: `yoursite.com`
- `connect.config.json:disableAutoFetchCertificate`: `false`
- `config-selfhost.cfg:com.smotana.clearflask.web.Application$Config.domain`: `yoursite.com`
- `config-selfhost.cfg:com.smotana.clearflask.web.resource.ConnectResource$Config.domainWhitelist`: `^yoursite.com$`

Once you load the site for the first time, a Certificate is automagically fetched for you and auto-renewed as needed.

### Run

1. Run `docker-compose up` or `docker-compose --profile with-deps up` to also start dependencies.
2. Point your browser at `http://localhost/signup` or if you configured your DNS `https://yoursite.com/signup`.
3. Create an account using `admin@localhost` email or based on your configuration of `superAdminEmailRegex`.
