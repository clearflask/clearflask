# Jira Integration Exploration

This document explores implementing a Jira integration for ClearFlask, based on the existing GitHub integration patterns.

## Table of Contents
1. [GitHub Integration Overview](#github-integration-overview)
2. [Jira API Overview](#jira-api-overview)
3. [Proposed Jira Integration Architecture](#proposed-jira-integration-architecture)
4. [Use Cases](#use-cases)
5. [Implementation Plan](#implementation-plan)
6. [Technical Considerations](#technical-considerations)

---

## GitHub Integration Overview

The existing GitHub integration provides a solid template for implementing Jira integration.

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Store Interface | `GitHubStore.java` | Defines integration contract |
| Store Implementation | `GitHubStoreImpl.java` | Core business logic (~850 lines) |
| REST Resource | `GitHubResource.java` | Webhook endpoints (~250 lines) |
| Client Provider | `GitHubClientProviderImpl.java` | GitHub API client management |
| Signature Verifier | `GitHubSignatureVerifier.java` | HMAC-SHA256 webhook validation |
| API Schema | `api-project.yaml` | Configuration model (lines 943-1009) |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub → ClearFlask                            │
├─────────────────────────────────────────────────────────────────────┤
│  GitHub Event → Webhook → GitHubResource → GitHubStore → IdeaStore  │
│                                                                     │
│  Events: issues.opened, issues.closed, issue_comment.created, etc.  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      ClearFlask → GitHub                            │
├─────────────────────────────────────────────────────────────────────┤
│  CommentResource/IdeaResource → GitHubStore → GitHub API            │
│                                                                     │
│  Actions: Create comment, update labels, close/reopen issue         │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Patterns

1. **Deterministic ID Generation**: Links items between systems
   ```java
   // GitHub pattern
   String ideaId = "github-" + issueNumber + "-" + issueId + "-" + repositoryId;
   String commentId = "github-" + ghCommentId;
   ```

2. **Async Operations**: Non-blocking sync to external systems
   ```java
   ListenableFuture<Optional<GHIssueComment>> cfCommentCreatedAsync(...)
   ```

3. **Rate Limiting**: Per-installation limits to prevent API quota exhaustion

4. **Webhook Signature Validation**: HMAC-SHA256 for security

---

## Jira API Overview

### Authentication Options

| Method | Use Case | Notes |
|--------|----------|-------|
| **OAuth 2.0 (3LO)** | User-context operations | Recommended for Jira Cloud |
| **API Token** | Basic auth alternative | Simple but user-specific |
| **Connect App** | Server-to-server | Best for integrations |
| **Personal Access Token** | Jira Data Center | Self-hosted instances |

**Recommended Approach**: OAuth 2.0 with 3-legged OAuth for Jira Cloud, similar to GitHub's OAuth App flow.

### Key Jira REST API Endpoints

```
# Issues
POST   /rest/api/3/issue                    # Create issue
GET    /rest/api/3/issue/{issueIdOrKey}     # Get issue
PUT    /rest/api/3/issue/{issueIdOrKey}     # Update issue
DELETE /rest/api/3/issue/{issueIdOrKey}     # Delete issue
POST   /rest/api/3/issue/{issueIdOrKey}/transitions  # Change status

# Comments
POST   /rest/api/3/issue/{issueIdOrKey}/comment              # Add comment
GET    /rest/api/3/issue/{issueIdOrKey}/comment              # Get comments
PUT    /rest/api/3/issue/{issueIdOrKey}/comment/{id}         # Update comment
DELETE /rest/api/3/issue/{issueIdOrKey}/comment/{id}         # Delete comment

# Webhooks
POST   /rest/api/3/webhook                  # Register webhook
GET    /rest/api/3/webhook                  # List webhooks
DELETE /rest/api/3/webhook/{webhookId}      # Delete webhook

# Projects
GET    /rest/api/3/project                  # List projects
GET    /rest/api/3/project/{projectIdOrKey} # Get project details
```

### Jira Webhook Events

Relevant events for two-way sync:

| Event | Trigger | ClearFlask Action |
|-------|---------|-------------------|
| `jira:issue_created` | New issue | Create ClearFlask post |
| `jira:issue_updated` | Issue changed | Update post title/description/status |
| `jira:issue_deleted` | Issue deleted | Delete or unlink post |
| `comment_created` | New comment | Create comment on post |
| `comment_updated` | Comment edited | Update comment |
| `comment_deleted` | Comment removed | Delete comment |

### Jira vs GitHub Differences

| Aspect | GitHub | Jira |
|--------|--------|------|
| ID Format | Numeric (issue #123) | Key (PROJ-123) |
| Status Model | Open/Closed binary | Workflow transitions |
| Authentication | GitHub App + OAuth | OAuth 2.0 / Connect |
| Webhook Registration | Per-repository | Per-project or global |
| Content Format | Markdown | Atlassian Document Format (ADF) |
| Multi-tenant | Installations | Cloud instances |

---

## Proposed Jira Integration Architecture

### New Files to Create

```
clearflask-server/src/main/java/com/smotana/clearflask/store/
├── JiraStore.java                    # Interface
└── jira/
    ├── JiraStoreImpl.java            # Implementation
    ├── JiraClientProvider.java       # Client interface
    ├── JiraClientProviderImpl.java   # Client implementation
    └── JiraSignatureVerifier.java    # Webhook validation

clearflask-server/src/main/java/com/smotana/clearflask/web/resource/
└── JiraResource.java                 # Webhook endpoints

clearflask-api/src/main/openapi/
└── api-project.yaml                  # Add jira config schema
```

### Configuration Schema (api-project.yaml)

```yaml
jira:
  x-clearflask-hide: true
  x-clearflask-page:
    order: 6
    name: 'Jira Connect'
    description: 'Synchronize Jira issues with ClearFlask.'
  title: Jira
  type: object
  required:
    - cloudId
    - projectKey
    - createWithCategoryId
  properties:
    cloudId:
      x-clearflask-prop:
        order: 0
        name: 'Cloud ID'
        description: 'Jira Cloud instance ID'
      type: string
    projectKey:
      x-clearflask-prop:
        order: 5
        name: 'Project Key'
        description: 'Jira project key (e.g., PROJ)'
      type: string
    projectName:
      x-clearflask-prop:
        order: 10
        name: 'Project Name'
        description: 'Display name of the linked Jira project'
      type: string
    createWithCategoryId:
      x-clearflask-prop:
        order: 20
        name: 'Create Issue as'
        description: 'Category for posts created from Jira issues'
        subType: 'id'
      x-clearflask-prop-link:
        idPropName: 'categoryId'
        linkPath: ['content', 'categories']
        displayPropName: 'name'
        colorPropName: 'color'
      type: string
    initialStatusId:
      x-clearflask-prop:
        order: 30
        name: 'Status'
        description: 'Initial status for posts from Jira'
      type: string
    createWithTags:
      x-clearflask-prop:
        order: 40
        name: 'Apply tags'
        description: 'Tags to apply to posts from Jira'
      type: array
      items:
        type: string
    issueTypeId:
      x-clearflask-prop:
        order: 45
        name: 'Issue Type'
        description: 'Jira issue type to create (Bug, Story, Task, etc.)'
      type: string
    statusSync:
      x-clearflask-prop:
        order: 50
        name: 'Status sync'
        description: 'Map ClearFlask statuses to Jira transitions'
        falseAsUndefined: true
      type: object
      properties:
        statusMapping:
          description: 'Map of ClearFlask statusId to Jira transition name'
          type: object
          additionalProperties:
            type: string
        reverseStatusMapping:
          description: 'Map of Jira status name to ClearFlask statusId'
          type: object
          additionalProperties:
            type: string
    responseSync:
      x-clearflask-prop:
        order: 60
        name: 'Response sync'
        defaultValue: true
        description: 'Create Jira comment when Response changes'
        falseAsUndefined: true
      type: boolean
    commentSync:
      x-clearflask-prop:
        order: 70
        name: 'Comment sync'
        defaultValue: true
        description: 'Mirror comments between Jira and ClearFlask'
        falseAsUndefined: true
      type: boolean
    syncDirection:
      x-clearflask-prop:
        order: 80
        name: 'Sync Direction'
        description: 'Control which direction items sync'
      type: string
      enum: ['bidirectional', 'jira_to_clearflask', 'clearflask_to_jira']
      default: 'bidirectional'
```

### JiraStore Interface

```java
public interface JiraStore {
    // OAuth flow
    AvailableJiraProjects getProjectsForUser(String accountId, String code);

    // Configuration
    void setupConfigJiraIntegration(String accountId, Optional<ConfigAdmin> prev, ConfigAdmin config);
    void removeIntegrationConfig(String projectId);
    void removeIntegrationWebhook(String projectId, String cloudId, String jiraProjectKey);

    // Jira → ClearFlask (webhook handlers)
    Optional<IdeaAndIndexingFuture> jiraIssueEvent(Project project, JiraIssueEvent event);
    Optional<CommentAndIndexingFuture<?>> jiraCommentEvent(Project project, JiraCommentEvent event);

    // ClearFlask → Jira
    ListenableFuture<Optional<JiraComment>> cfCommentCreatedAsync(Project project, IdeaModel idea,
        CommentModel comment, UserModel user);
    ListenableFuture<Optional<JiraIssue>> cfStatusAndOrResponseChangedAsync(Project project,
        IdeaModel idea, boolean statusChanged, boolean responseChanged);
    ListenableFuture<Optional<JiraIssue>> cfPostCreatedAsync(Project project, IdeaModel idea,
        UserModel user);

    // ID generation
    String genDeterministicIdeaIdForJiraIssue(String issueKey, String cloudId);
    String genDeterministicCommentIdForJiraComment(String commentId, String cloudId);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "jiraAuth", rangeKeys = "cloudId")
    class JiraAuthorization {
        @NonNull String accountId;
        @NonNull String cloudId;
        @NonNull String accessToken;
        @NonNull String refreshToken;
        @NonNull long ttlInEpochSec;
    }
}
```

---

## Use Cases

### Use Case 1: Create Jira Ticket for Every ClearFlask Post

**Scenario**: Development team uses Jira for sprint planning. When users submit feedback in ClearFlask, automatically create corresponding Jira tickets.

**Flow**:
```
User creates post in ClearFlask
    ↓
IdeaResource.create() triggered
    ↓
JiraStore.cfPostCreatedAsync() called
    ↓
Create Jira issue via API:
  - Summary = Post title
  - Description = Post description (converted to ADF)
  - Labels = ClearFlask tags
  - Custom field = ClearFlask post URL
    ↓
Store Jira issue key in IdeaModel.externalUrl
```

**Configuration**:
- Enable "Auto-create Jira issue" option
- Select target Jira project and issue type
- Map ClearFlask categories to Jira components (optional)

### Use Case 2: Create ClearFlask Post for Every Jira Ticket

**Scenario**: Product team creates feature requests in Jira. These should appear in public ClearFlask roadmap for user visibility and voting.

**Flow**:
```
Issue created in Jira
    ↓
Jira sends webhook to ClearFlask
    ↓
JiraResource.webhookProject() validates signature
    ↓
JiraStore.jiraIssueEvent() processes event
    ↓
Create ClearFlask post:
  - Title = Issue summary
  - Description = Issue description (converted from ADF)
  - Category = Configured category
  - External URL = Jira issue URL
  - Idea ID = "jira-{issueKey}-{cloudId}"
```

**Configuration**:
- Enable webhook for issue_created events
- Select ClearFlask category for new posts
- Filter by Jira issue type or labels (optional)

### Use Case 3: Two-Way Comment Sync

**Scenario**: Developers discuss in Jira, customers discuss in ClearFlask. Both should see all conversations.

**Jira → ClearFlask Flow**:
```
Comment added in Jira
    ↓
Webhook: comment_created
    ↓
JiraStore.jiraCommentEvent()
    ↓
Find linked ClearFlask post by Jira issue key
    ↓
Create comment with:
  - Author: "jira-{jiraUserId}" user
  - Content: Converted ADF → Quill delta
  - Comment ID: "jira-{commentId}"
```

**ClearFlask → Jira Flow**:
```
Comment created in ClearFlask
    ↓
CommentResource.create()
    ↓
JiraStore.cfCommentCreatedAsync()
    ↓
Check: Is post linked to Jira issue?
    ↓
Create Jira comment:
  - Body: "{author} wrote:\n{content}"
  - Format: ADF (converted from Quill)
```

### Use Case 4: Status Synchronization

**Scenario**: When developers move Jira tickets through workflow, ClearFlask posts should reflect progress.

**Jira → ClearFlask**:
```yaml
# Configuration example
reverseStatusMapping:
  "To Do": "status-planned"
  "In Progress": "status-in-progress"
  "Done": "status-completed"
  "Won't Fix": "status-closed"
```

**ClearFlask → Jira**:
```yaml
# Configuration example
statusMapping:
  "status-planned": "To Do"
  "status-in-progress": "Start Progress"  # Transition name
  "status-completed": "Done"
  "status-closed": "Won't Do"
```

### Use Case 5: Selective Sync with Labels/Tags

**Scenario**: Only sync certain types of Jira issues to ClearFlask.

**Configuration**:
```yaml
syncFilter:
  jiraLabels: ["customer-facing", "public-roadmap"]
  jiraIssueTypes: ["Story", "Epic"]
  excludeLabels: ["internal"]
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (3-4 days)

1. **Create JiraStore interface and model classes**
   - JiraStore.java interface
   - JiraAuthorization DynamoDB model
   - JiraIssueEvent, JiraCommentEvent DTOs

2. **Implement OAuth 2.0 flow**
   - Register Atlassian Connect app
   - Implement authorization code exchange
   - Token refresh mechanism
   - Store tokens in DynamoDB with TTL

3. **Create JiraClientProvider**
   - HTTP client wrapper for Jira REST API
   - Handle authentication headers
   - Rate limiting support

### Phase 2: Webhook Handling - Jira to ClearFlask (2-3 days)

1. **Create JiraResource**
   - Webhook endpoint: `/api/v1/webhook/jira/project/{projectId}/cloud/{cloudId}`
   - Signature validation (shared secret)
   - Event routing

2. **Implement webhook handlers in JiraStoreImpl**
   - `jiraIssueEvent()`: Create/update/delete posts
   - `jiraCommentEvent()`: Create/update/delete comments
   - ADF to Quill conversion

3. **Webhook registration**
   - Auto-register webhook when integration enabled
   - Auto-remove webhook when disabled

### Phase 3: ClearFlask to Jira Sync (2-3 days)

1. **Implement cfPostCreatedAsync()**
   - Create Jira issue from ClearFlask post
   - Quill to ADF conversion

2. **Implement cfCommentCreatedAsync()**
   - Create Jira comment when ClearFlask comment added

3. **Implement cfStatusAndOrResponseChangedAsync()**
   - Trigger Jira transitions based on status mapping
   - Add response as Jira comment

### Phase 4: API Schema and Frontend (2-3 days)

1. **Update api-project.yaml**
   - Add jira configuration schema
   - Generate TypeScript and Java models

2. **Create frontend settings component**
   - OAuth authorization flow UI
   - Project selection
   - Sync configuration options

3. **Update Post display**
   - Show linked Jira issue badge
   - Link to Jira issue

### Phase 5: Testing and Edge Cases (2-3 days)

1. **Unit tests**
   - JiraStoreImpl business logic
   - ADF/Quill conversions
   - Webhook signature validation

2. **Integration tests**
   - Mock Jira API responses
   - End-to-end sync scenarios

3. **Edge cases**
   - Deleted issues/projects
   - Permission changes
   - Rate limit handling
   - Network failures

---

## Technical Considerations

### Content Format Conversion

**Atlassian Document Format (ADF)** is Jira's rich text format. Need bidirectional conversion:

```java
// ADF to Quill
public String convertAdfToQuill(JsonNode adfDocument) {
    // Handle: paragraph, heading, bulletList, orderedList, codeBlock, etc.
}

// Quill to ADF
public JsonNode convertQuillToAdf(String quillDelta) {
    // Handle: insert, attributes (bold, italic, link, etc.)
}
```

### Jira Cloud vs Data Center

| Feature | Jira Cloud | Jira Data Center |
|---------|------------|------------------|
| Auth | OAuth 2.0 | Personal Access Token |
| Webhooks | Dynamic registration | Admin configured |
| API Base | `https://api.atlassian.com` | Instance URL |
| Multi-tenant | Yes (cloudId) | No |

**Recommendation**: Start with Jira Cloud support, add Data Center later.

### Rate Limiting

Jira Cloud rate limits:
- 100 requests per minute for most endpoints
- Burst allowance with exponential backoff

```java
// Similar to GitHub rate limiter
private final RateLimiter rateLimiter = RateLimiter.create(
    1.5, // queries per second
    Duration.ofMinutes(1) // warm-up period
);
```

### Webhook Security

Jira webhooks include `X-Atlassian-Webhook-Identifier` header. Validate using:
1. Shared secret (configured during webhook registration)
2. IP allowlist (Atlassian IP ranges)
3. Webhook ID verification

### ID Mapping Strategy

```java
// Jira issue to ClearFlask idea
public String genDeterministicIdeaIdForJiraIssue(String issueKey, String cloudId) {
    return "jira-" + issueKey + "-" + cloudId;
}

// Extract Jira info from idea ID
public Optional<JiraIssueRef> extractJiraIssueFromIdeaId(String ideaId) {
    Matcher m = JIRA_IDEA_ID_PATTERN.matcher(ideaId);
    if (m.matches()) {
        return Optional.of(new JiraIssueRef(m.group(1), m.group(2)));
    }
    return Optional.empty();
}
```

### Error Handling

```java
// Handle common Jira API errors
try {
    jiraClient.createIssue(issue);
} catch (JiraAuthException e) {
    // Token expired, trigger re-auth flow
    removeIntegrationConfig(projectId);
    log.warn("Jira auth failed for project {}, unlinking", projectId);
} catch (JiraRateLimitException e) {
    // Retry with backoff
    return retryWithBackoff(() -> jiraClient.createIssue(issue));
} catch (JiraNotFoundException e) {
    // Issue/project deleted
    unlinkPost(ideaId);
}
```

### Database Schema Additions

```java
// New DynamoDB table for Jira auth
@DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "jiraAuth", rangeKeys = "cloudId")
class JiraAuthorization {
    String accountId;
    String cloudId;
    String accessToken;
    String refreshToken;
    String jiraProjectKey;
    long ttlInEpochSec;
}

// IdeaModel additions
String linkedJiraUrl;  // Display URL for Jira issue
String jiraIssueKey;   // For quick lookup (indexed)
```

---

## Summary

The Jira integration would follow the same architectural patterns as the GitHub integration:

| Aspect | GitHub | Jira |
|--------|--------|------|
| Store Interface | `GitHubStore` | `JiraStore` |
| Implementation | `GitHubStoreImpl` | `JiraStoreImpl` |
| REST Endpoint | `GitHubResource` | `JiraResource` |
| Auth Storage | `GitHubAuthorization` | `JiraAuthorization` |
| User Prefix | `gh-{userId}` | `jira-{accountId}` |
| Idea ID | `github-{num}-{id}-{repo}` | `jira-{key}-{cloudId}` |
| Content Format | Markdown ↔ Quill | ADF ↔ Quill |

**Estimated Total Effort**: 10-15 days for complete implementation with testing.

**Key Decisions Needed**:
1. Jira Cloud only vs. also Data Center support?
2. Which issue types to support (Story, Bug, Task, Epic)?
3. Custom field mapping requirements?
4. Priority/severity mapping?
