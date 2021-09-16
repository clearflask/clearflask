# Contributing

## Environment

Development has been done under Mac, Linux, and Windows (with WSL)

The following requirements are a minimum:

- Java 11
- Maven
- Makefile (for local and production deployment)
- Docker
- FFmpeg and ffprobe (For `babel-plugin-transform-media-imports`)
- OpenSSL (For local deployment's self-signed certs)

```shell
brew install maven ffmpeg make openssl
```

Please let us know if we missed anything.

## Building

Building is straightforward and can be done by running:

```shell
mvn clean install
```

Add `-DskipTests` or `-DskipITs` to skip all tests or just Integration tests respectively.

For developing integration tests, you may want to start a local instance of ClearFlask and run integrations directly
from your IDE. Otherwise you will have to alwasy spin up all dependencies.

## Run locally

There are several ways to run locally depending on what you want to test.

### Frontend + Mock backend

Ideal for fast-iteration on frontend changes. Changes to code take effect immediately.

```shell
make frontend-start
```

Open browser at [http://localhost:3000](http://localhost:3000).

### Connect + Frontend + Mock backend

Intended for testing Connect and SSR. For code changes to take effect, you must rebuild clearflask-frontend.

```shell
make connect-start
```

Open browser at [http://localhost:9080](http://localhost:9080).

### HTTPS + Connect + Frontend + Backend

Intended for testing the whole deal before deployment. For code changes to take effect, you must completely rebuild
clearflask.

```shell
make local-up
make local-down
```

Open browser at [https://localhost](https://localhost).

### Connect + Frontend + Backend (Self-host)

Intended for testing self-host deployment, uses locally built Docker images rather than officially released images. For
code changes to take effect, you must completely rebuild clearflask.

```shell
make selfhost-up
make selfhost-down
```

Open browser at [https://localhost](https://localhost).

## Debugging

When running a local deploy, you can debug various components:

### Attach debugger

For debugging `clearflask-server` running on Tomcat, point IntelliJ IDEA or your favourite IDE to remote JVM debug
on `localhost:9999`.

### JMX

For changing configuration parameters or running exposed operations, connect via JMX using your favourite tool (
JVisualVM, JConsole, ...) on `localhost:9950` without credentials and without SSL.

### ElasticSearch Kibana

To look at the ES cluster and run commands, point your browser at `http://localhost:5601`.

### KillBill Kaui

To look at the billing sysstem, point your browser at `http://localhost:8081`.

Credentials are `admin/password` and API key and secret is `bob/lazar`.

If you are debugging an Integration Test, a log line will reveal the API key and
secret: `KillBill test randomized apiKey {} secretKey {}`.

### AWS services (DynamoDB, Route53, SES, S3)

You can use regular AWS command line tool and point it to our mocked up LocalStack services:

```shell
aws --endpoint-url=http://localhost:4566 ...
```
