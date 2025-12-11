# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClearFlask is an open-source feedback management tool (alternative to Canny/UserVoice). It's a multi-module Maven project with a React frontend and Java backend.

## Build Commands

```bash
# Full build with tests
mvn install

# Build without tests (fastest)
mvn install -DskipTests

# Build without integration tests only
mvn install -DskipITs

# Build server module only (no tests)
cd clearflask-server && mvn install -DskipTests
```

## Running Locally

```bash
# Frontend dev server with mock backend (fast iteration, hot reload)
make frontend-start
# Opens at http://localhost:3000

# Connect + Frontend + Mock backend (testing SSR)
make connect-start
# Opens at http://localhost:9080

# Full stack with Docker (HTTPS + Connect + Frontend + Backend)
make local-up    # Start
make local-down  # Stop
# Opens at https://localhost

# Self-host mode with local Docker images
make selfhost-up
make selfhost-down
```

## Running Tests

```bash
# Run all tests for a specific module
cd clearflask-server && mvn test

# Run a single test class
cd clearflask-server && mvn test -Dtest=ClassName

# Run a single test method
cd clearflask-server && mvn test -Dtest=ClassName#methodName

# Run integration tests
cd clearflask-server && mvn verify
```

## Project Structure

- **clearflask-api** - OpenAPI definitions (YAML) for client-server communication. Generates TypeScript and Java clients via openapi-generator.
- **clearflask-frontend** - React/TypeScript SPA + NodeJS SSR server ("Connect"). Uses Material-UI, Redux, React Router.
- **clearflask-server** - Java backend (WAR for Tomcat). Uses Guice DI, Jersey REST, DynamoDB, ElasticSearch/MySQL.
- **clearflask-logging** - Logging module shared by server and KillBill integration.
- **clearflask-legal** - Privacy Policy and Terms of Service resources.
- **clearflask-i18n** - Internationalization resources.
- **clearflask-release** - Docker images and release artifacts.

## Architecture

### Backend (clearflask-server)
- **web/** - REST endpoints (Jersey), security, auth
- **store/** - Data access layer for DynamoDB, ElasticSearch, MySQL, S3
- **core/** - Business logic, email/push notifications
- **billing/** - KillBill and Stripe payment integration
- **util/** - Shared utilities

### Frontend (clearflask-frontend/src)
- **app/** - Dashboard application for project admins
- **site/** - Public-facing portal pages
- **common/** - Shared React components
- **connect/** - NodeJS SSR server, TLS cert management
- **api/** - Generated API client from OpenAPI spec

### API Generation Flow
OpenAPI YAML files in `clearflask-api/src/main/openapi/` generate:
1. TypeScript client → `clearflask-frontend/src/api/`
2. Java server interfaces → `clearflask-api/target/`

## Key Technologies

- **Backend**: Java 11, Maven, Guice, Jersey, Lombok
- **Frontend**: React 17, TypeScript, Material-UI v4, Redux, pnpm
- **Storage**: DynamoDB (primary), ElasticSearch or MySQL (search), S3 (files)
- **Billing**: KillBill, Stripe

## Code Style

- **Java**: Google Java Style Guide, IntelliJ formatting in `.idea/`
- **TypeScript**: VSCode settings in `.vscode/`

## Debugging

When running `make local-up`:
- Remote JVM debug: `localhost:9999`
- JMX (no auth): `localhost:9950`
- Kibana: `http://localhost:5601`
- KillBill Kaui: `http://localhost:8081` (admin/password)
- LocalStack AWS: `aws --endpoint-url=http://localhost:4566`

## Plans

Development plans and roadmaps are stored in `./plans/`. See the comprehensive roadmap for feature opportunities, technical debt, and security issues.
