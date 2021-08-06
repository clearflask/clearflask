# INSTALLATION

## Intro

There is an effort to make self-hosting less painless.

t this time it is considered in Alpha until we complete these tasks:

- [ ] Replace DynamoDB, ElasticSearch, S3, SES, Route53 with PostgreSQL, SMTP.
- [x] Stub out Payment Processor dependency
- [x] Remove Route53 dependency
- [ ] Alternative landing page and dashboard for single-customer use-case
- [ ] Dockerize and publish
    - [ ] Do not hardcode VAPID public key on client
- [ ] Create Installation instructions

## Prerequisites

There is an effort to decouple from AWS, but for now you are required to use the following:

- **AWS DynamoDB** (IAM access, tables are created on first start-up)
- **AWS S3** for user file uploads (Create private bucket, IAM access)
- **AWS SES** for sending transactional emails (IAM access, need to apply for approval via AWS support)
- **ElasticSearch** (Can use AWS ES)
- **Google ReCaptcha** (Obtain keys [here](https://www.google.com/recaptcha/admin))

Optional prerequisites not needed for Self-hosting

- **CloudFront** as a CDN (Use in front of `clearflask-connect`)
- **KillBill** for billing and payment processing. (Self-hosting is preconfigured for unlimited plans)
- ~~**AWS Route53**~~ (Was/may be used for automatic LetsEncrypt DNS challenges)

## Building

At this time, we have not published pre-built docker images just yet. Clone this repository and run:

```
mvn clean install
```

At the end you will be left with Docker images in your local repo.

## Install

1. Unpack the artifact `clearflask-release/target/clearflask-release-*-docker-compose-self-host.tar.gz`
2. Copy `config-selfhost-template.cfg` to `config-selfhost.cfg` and fill out properties

## Run

Now it is as simple as

```shell
docker-compose up
```