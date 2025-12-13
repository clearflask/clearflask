# GitLab Integration Plan for ClearFlask

## Implementation Status

| Phase | Status |
|-------|--------|
| Backend Infrastructure | ✅ Complete |
| API Definitions | ✅ Complete |
| Webhook Handlers | ✅ Complete |
| Frontend UI | ⏳ Pending |
| Testing | ⏳ Pending |

---

## Executive Summary

This document outlines a plan to add GitLab integration to ClearFlask, similar to the existing GitHub integration. The integration will provide bi-directional synchronization between GitLab repositories and ClearFlask feedback posts.

---

## Comparison: GitHub vs GitLab Capabilities

| Feature | GitHub | GitLab | Notes |
|---------|--------|--------|-------|
| **OAuth2 Authentication** | ✅ | ✅ | GitLab uses standard OAuth2 |
| **App Installation Model** | ✅ GitHub Apps | ❌ OAuth Apps only | GitLab uses OAuth apps + API tokens, no "installable apps" concept |
| **Webhooks** | ✅ | ✅ | Similar webhook model with secret token validation |
| **Issues API** | ✅ | ✅ | Full CRUD, status management, labels |
| **Comments/Notes API** | ✅ | ✅ | GitLab calls them "Notes" |
| **Releases API** | ✅ | ✅ | Full CRUD, assets support |
| **Merge Requests** | Pull Requests | ✅ MRs | GitLab-specific, additional opportunity |
| **Issue Confidentiality** | ❌ | ✅ | GitLab supports confidential issues |
| **Self-Hosted Support** | GitHub Enterprise | ✅ Native | GitLab commonly self-hosted |
| **Java Client Library** | hub4j-github-api | gitlab4j-api | Both mature, actively maintained |

### Key Differences

1. **No GitHub Apps equivalent**: GitLab doesn't have an "App" installation model. Integration uses:
   - OAuth2 for user authorization
   - Personal Access Tokens or OAuth tokens for API calls
   - Manual webhook configuration per project

2. **Self-hosted first**: GitLab is often self-hosted, requiring configurable instance URLs (not just gitlab.com)

3. **Merge Requests**: GitLab has MRs which could be synced (GitHub integration doesn't sync PRs)

4. **Notes vs Comments**: GitLab terminology differs - "Notes" are comments on issues/MRs

---

## Feature Scope

### Core Features (Matching GitHub Integration)

| Feature | Direction | Description |
|---------|-----------|-------------|
| Issue Sync | GitLab → ClearFlask | Mirror GitLab issues as ClearFlask posts |
| Issue Updates | Bidirectional | Sync edits to title/description |
| Issue Status | Bidirectional | Sync open/closed state |
| Comments/Notes | Bidirectional | Mirror notes on issues |
| Responses | CF → GitLab | Post team responses to GitLab issues |
| Releases | GitLab → CF | Create announcements from releases |
| Labels | GitLab → CF | Apply tags when issues created |
| Labels | CF → GitLab | Add/remove GitLab labels based on status |

### Additional GitLab-Specific Features

| Feature | Direction | Description |
|---------|-----------|-------------|
| **Merge Request Sync** | GitLab → CF | Create posts from MRs (feature requests from code) |
| **Confidential Issues** | GitLab → CF | Respect confidentiality settings |
| **Self-Hosted Support** | - | Connect to any GitLab instance |
| **Group-Level Webhooks** | GitLab → CF | Single webhook for all projects in a group |

### Features NOT Included

| Feature | Reason |
|---------|--------|
| GitLab CI/CD integration | Out of scope for feedback management |
| Pipeline notifications | Not relevant to feedback |
| Wiki sync | Different use case |
| Repository content sync | Not relevant |

---

## Technical Architecture

### Authentication Flow

Unlike GitHub Apps (which use JWT + installation tokens), GitLab uses standard OAuth2:

```
User clicks "Connect GitLab"
         ↓
Redirect to GitLab OAuth authorization
  - Scopes: api, read_user, read_repository
  - Instance URL: gitlab.com or self-hosted
         ↓
User authorizes application
         ↓
GitLab redirects with authorization code
         ↓
ClearFlask exchanges code for access_token + refresh_token
         ↓
Store tokens in GitLabAuthorization table
         ↓
Access token expires after 2 hours → use refresh_token
```

### Webhook Configuration

GitLab webhooks require:
1. Webhook URL pointing to ClearFlask endpoint
2. Secret token for payload validation
3. Event subscriptions (issues, notes, releases, merge_requests)

Webhook URL format:
```
https://{domain}/api/v1/webhook/gitlab/project/{projectId}
```

Validation:
- `X-Gitlab-Token` header contains the secret token
- `X-Gitlab-Event` header identifies event type

### Data Models

**GitLabAuthorization** (DynamoDB)
```java
@Data
public class GitLabAuthorization {
    String accountId;          // Partition key
    String instanceUrl;        // gitlab.com or self-hosted URL
    String accessToken;        // OAuth access token (encrypted)
    String refreshToken;       // OAuth refresh token (encrypted)
    long expiresAt;           // Token expiration timestamp
    long ttlInEpochSec;       // DynamoDB TTL
}
```

**ConfigAdmin.gitlab** (Project Config)
```yaml
gitlab:
  instanceUrl: string              # gitlab.com or self-hosted
  projectId: int64                 # GitLab project ID
  projectPath: string              # e.g., "group/subgroup/project"
  createWithCategoryId: string     # CF category for new issues
  initialStatusId: string          # Initial status for issues
  createWithTags: string[]         # Tags to apply
  statusSync:
    closedStatuses: string[]       # CF statuses that close GitLab issue
    closedStatus: string           # CF status when GitLab closes issue
    openStatus: string             # CF status when GitLab reopens issue
  responseSync: boolean            # Post CF responses to GitLab
  commentSync: boolean             # Mirror comments/notes
  createReleaseWithCategoryId: string
  releaseNotifyAll: boolean
  # GitLab-specific
  syncMergeRequests: boolean       # Also sync MRs as posts
  mrCategoryId: string             # Category for MR-based posts
```

**Idea.linkedGitLabUrl** (Post Reference)
```java
String linkedGitLabUrl;  // https://gitlab.com/group/project/-/issues/123
```

---

## Implementation Plan

### Phase 1: Core Backend Infrastructure

**Files to Create:**

1. `clearflask-server/src/main/java/com/smotana/clearflask/store/GitLabStore.java`
   - Interface defining GitLab operations
   - Similar structure to GitHubStore

2. `clearflask-server/src/main/java/com/smotana/clearflask/store/gitlab/GitLabStoreImpl.java`
   - Implementation of GitLab operations
   - OAuth token management with refresh
   - Webhook setup and management
   - Issue/Note/Release event handling

3. `clearflask-server/src/main/java/com/smotana/clearflask/store/gitlab/GitLabClientProvider.java`
   - Interface for GitLab API client creation

4. `clearflask-server/src/main/java/com/smotana/clearflask/store/gitlab/GitLabClientProviderImpl.java`
   - Creates GitLabApi instances from gitlab4j-api
   - Token refresh handling
   - Rate limiting per instance/user
   - Support for gitlab.com and self-hosted

5. `clearflask-server/src/main/java/com/smotana/clearflask/web/resource/GitLabResource.java`
   - REST endpoints for webhooks
   - OAuth callback endpoint
   - Admin API for fetching projects

6. `clearflask-server/src/main/java/com/smotana/clearflask/util/GitLabSignatureVerifier.java`
   - Validate X-Gitlab-Token header

**Files to Modify:**

1. `clearflask-server/pom.xml`
   - Add gitlab4j-api dependency

2. `clearflask-api/src/main/openapi/api-account.yaml`
   - Add `/admin/account/gitlab/projects` endpoint

3. `clearflask-api/src/main/openapi/api-project.yaml`
   - Add `ConfigAdmin.gitlab` schema
   - Add `Idea.linkedGitLabUrl` field

### Phase 2: Frontend Implementation

**Files to Modify:**

1. `clearflask-frontend/src/site/dashboard/ProjectSettings.tsx`
   - Add GitLab configuration section (similar to GitHub section)
   - OAuth flow integration
   - Instance URL configuration (gitlab.com vs self-hosted)
   - Project selection dropdown
   - Sync settings UI

2. `clearflask-frontend/src/common/util/oauthUtil.ts`
   - Add GitLab OAuth configuration
   - Dynamic instance URL support

**UI Components Needed:**

```
GitLab Settings Panel
├── Instance URL input (default: gitlab.com)
├── Connect GitLab button (OAuth flow)
├── Project selector dropdown
├── Issue Settings
│   ├── Category picker
│   ├── Initial status picker
│   ├── Tags picker
├── Status Sync Settings
│   ├── CF→GitLab status mappings
│   └── GitLab→CF status mappings
├── Comment Sync toggle
├── Response Sync toggle
├── Release Settings
│   ├── Category picker
│   └── Notify subscribers toggle
└── Merge Request Settings (GitLab-specific)
    ├── Sync MRs toggle
    └── MR category picker
```

### Phase 3: Webhook Event Handlers

**Event Handlers to Implement:**

| Event | Handler Method | Action |
|-------|---------------|--------|
| `Issue Hook` (open) | `glIssueOpened()` | Create CF post |
| `Issue Hook` (close) | `glIssueClosed()` | Update CF status |
| `Issue Hook` (reopen) | `glIssueReopened()` | Update CF status |
| `Issue Hook` (update) | `glIssueUpdated()` | Update CF post |
| `Note Hook` (issue) | `glNoteCreated()` | Create CF comment |
| `Release Hook` (create) | `glReleaseCreated()` | Create CF announcement |
| `Merge Request Hook` | `glMergeRequestEvent()` | Create/update CF post |

**ClearFlask → GitLab Handlers:**

| Trigger | Handler Method | Action |
|---------|---------------|--------|
| CF comment created | `cfCommentCreatedAsync()` | Post note on GitLab issue |
| CF status changed | `cfStatusChangedAsync()` | Update GitLab issue state/labels |
| CF response set | `cfResponseChangedAsync()` | Post response as note |

### Phase 4: Testing & Documentation

1. Unit tests for GitLabStoreImpl
2. Integration tests with mock GitLab server
3. Manual testing with gitlab.com and self-hosted instance
4. Update admin documentation
5. Add configuration examples

---

## Dependency Addition

Add to `clearflask-server/pom.xml`:

```xml
<dependency>
    <groupId>org.gitlab4j</groupId>
    <artifactId>gitlab4j-api</artifactId>
    <version>6.0.0-rc.7</version>
</dependency>
```

Note: Version 6.x requires Java 11+ which ClearFlask already uses.

---

## Configuration Options

**Backend Config (Guice Module):**

```java
public interface Config {
    @DefaultValue("true")
    boolean enabled();

    @DefaultValue("")
    String clientId();          // OAuth app client ID

    @DefaultValue("")
    String clientSecret();      // OAuth app secret

    @DefaultValue("")
    String webhookSecret();     // Shared webhook validation secret

    @DefaultValue("PT1D")
    Duration authExpiry();      // How long to cache auth tokens

    @DefaultValue("true")
    boolean rateLimiterEnabled();

    @DefaultValue("1.0")
    double rateLimiterQps();
}
```

**OAuth Application Setup:**

Users need to create a GitLab OAuth application:
1. Go to GitLab → Settings → Applications (or Admin → Applications for instance-wide)
2. Create application with:
   - Name: "ClearFlask"
   - Redirect URI: `https://{clearflask-domain}/dashboard/settings/project/gitlab`
   - Scopes: `api`, `read_user`, `read_repository`
3. Configure client ID and secret in ClearFlask

---

## Security Considerations

1. **Token Storage**: Encrypt access/refresh tokens in DynamoDB
2. **Webhook Validation**: Verify X-Gitlab-Token header matches configured secret
3. **Rate Limiting**: Per-instance rate limiter to avoid API abuse
4. **Token Refresh**: Handle 401 responses by refreshing OAuth tokens
5. **Self-Hosted TLS**: Validate certificates for self-hosted instances
6. **Scope Limitation**: Request minimum required OAuth scopes

---

## Differences from GitHub Implementation

| Aspect | GitHub | GitLab |
|--------|--------|--------|
| Auth Model | GitHub App (JWT + installation token) | OAuth2 (access + refresh tokens) |
| Webhook Setup | Automatic via GitHub App | Manual webhook creation via API |
| Repo Selection | Via GitHub App installation | Via OAuth + API project listing |
| Rate Limiting | Per-installation | Per-user/token |
| Instance Support | github.com only (Enterprise separate) | Any GitLab instance |
| Event Header | X-GitHub-Event | X-Gitlab-Event |
| Signature Header | X-Hub-Signature-256 (HMAC-SHA256) | X-Gitlab-Token (plain secret) |

---

## Estimated Effort

| Phase | Components | Effort |
|-------|------------|--------|
| Phase 1 | Backend infrastructure | 3-4 days |
| Phase 2 | Frontend UI | 2-3 days |
| Phase 3 | Webhook handlers | 2-3 days |
| Phase 4 | Testing & docs | 1-2 days |
| **Total** | | **8-12 days** |

---

## Future Enhancements

1. **GitLab Group Integration**: Single webhook for entire group
2. **Epic Sync**: Sync GitLab Epics as higher-level roadmap items
3. **Milestone Sync**: Map GitLab milestones to ClearFlask roadmap
4. **Label Color Sync**: Preserve GitLab label colors in ClearFlask
5. **Issue Templates**: Use GitLab issue templates when creating from CF

---

## Open Questions

1. **Self-hosted priority**: Should we support self-hosted GitLab from day one, or start with gitlab.com only?
   - Recommendation: Support from day one, as it's a common use case

2. **Merge Request sync**: Is syncing MRs as posts valuable, or is it scope creep?
   - Recommendation: Include as optional feature (disabled by default)

3. **Multiple GitLab connections**: Should a project support multiple GitLab repos?
   - Recommendation: Start with single repo (matching GitHub), extend later if needed

4. **Instance-wide OAuth app**: Should ClearFlask provide a pre-configured gitlab.com OAuth app?
   - Recommendation: Yes, for gitlab.com convenience; users configure their own for self-hosted

---

## Resources

- [GitLab REST API Documentation](https://docs.gitlab.com/ee/api/rest/)
- [GitLab Webhooks Documentation](https://docs.gitlab.com/ee/user/project/integrations/webhooks.html)
- [GitLab OAuth2 Documentation](https://docs.gitlab.com/ee/api/oauth2.html)
- [GitLab4J API Library](https://github.com/gitlab4j/gitlab4j-api)
- [GitLab Webhook Events](https://docs.gitlab.com/user/project/integrations/webhook_events/)
