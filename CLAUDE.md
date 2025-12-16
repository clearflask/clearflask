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

## CRITICAL: Pre-Commit Requirements

**MANDATORY**: Before running `git commit` and `git push`, you MUST:

1. **Run a full build** to verify all modules compile:
   ```bash
   mvn clean install -DskipITs
   ```

2. **Never commit without verifying the build succeeds**
   - Do NOT commit if you only tested one module (e.g., just clearflask-server)
   - Do NOT skip this step to save time
   - Build failures in CI waste time and break the pipeline

3. **If the build fails**:
   - Fix all compilation errors
   - Run `mvn clean install -DskipITs` again
   - Only commit once the build succeeds

**Why this matters**: The project has multiple interdependent modules. A change in one module can break another. Building only one module doesn't catch all errors.

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

### Adding New API Endpoints

When adding a new API endpoint (especially admin endpoints), you must update multiple files:

1. **Define the endpoint** in the appropriate API file:
   - `api-comment.yaml`, `api-idea.yaml`, `api-user.yaml`, etc.
   - Define schemas (e.g., `CommentCreateAdmin`) and paths (e.g., `/project/{projectId}/admin/idea/{ideaId}/comment`)

2. **Add references** in these files (use encoded path format with `~1` for `/`):
   - `clearflask-api/src/main/openapi/api.yaml` - Main API (all endpoints)
   - `clearflask-api/src/main/openapi/api-admin.yaml` - Admin API (admin endpoints only)
   - `clearflask-api/src/main/openapi/api-docs.yaml` - API documentation

3. **Rebuild the API module** to generate Java/TypeScript clients:
   ```bash
   cd clearflask-api && mvn clean install -DskipTests
   ```

4. **Implement the endpoint** in the corresponding resource class:
   - Backend: `clearflask-server/src/main/java/com/smotana/clearflask/web/resource/`

Example path reference format:
```yaml
/project/{projectId}/admin/idea/{ideaId}/comment:
  $ref: 'api-comment.yaml#/~1project~1{projectId}~1admin~1idea~1{ideaId}~1comment'
```

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

## Context Management for Claude Code

**IMPORTANT**: Commands like `make local-up`, `mvn install`, and other build/deploy commands produce verbose output that can overload Claude's context window, causing it to fail mid-task.

To avoid context overload:
- **Use quiet flags** when possible: `mvn install -q -DskipTests`, `make local-up 2>&1 | tail -20`
- **Run commands in background**: Use `run_in_background: true` parameter for long-running commands
- **Avoid running verbose commands** if context is already high
- **Limit output**: Pipe to `tail` or `head` to capture only relevant output
- **Monitor context usage**: If you see "Context low" warnings, avoid running more verbose commands

Example:
```bash
# Instead of: make local-up
# Use: make local-up 2>&1 | tail -50

# Or run in background and check logs selectively
```

## Plans

Development plans and roadmaps are stored in `./plans/`. See the comprehensive roadmap for feature opportunities, technical debt, and security issues.
