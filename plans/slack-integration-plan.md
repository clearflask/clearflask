# Slack Integration Plan for ClearFlask

## Overview

This plan outlines the implementation of a two-way Slack integration for ClearFlask, enabling:
- Posts created in ClearFlask → Slack messages in linked channels
- Slack messages → ClearFlask posts
- Comments on posts → Slack thread replies
- Slack thread replies → ClearFlask comments
- Post status/response updates → Slack message updates

The design is inspired by the existing GitHub integration architecture and supports Slack-compatible APIs like Zulip.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ClearFlask                                     │
│  ┌─────────────┐    ┌─────────────────┐    ┌────────────────────────┐   │
│  │ SlackResource│    │   SlackStore    │    │  SlackClientProvider  │   │
│  │  (Webhooks)  │───▶│ (Business Logic)│───▶│   (API Client)        │   │
│  └─────────────┘    └─────────────────┘    └────────────────────────┘   │
│         ▲                   │                         │                  │
│         │                   ▼                         ▼                  │
│         │           ┌─────────────┐           ┌─────────────┐           │
│         │           │ ProjectStore│           │ Slack API   │           │
│         │           │ (Config)    │           │             │           │
│         │           └─────────────┘           └─────────────┘           │
│         │                                                                │
│  ┌──────┴──────────────────────────────────────────────────────────┐    │
│  │                    Event Triggers                                │    │
│  │  IdeaResource.ideaCreate() ──────────────┐                      │    │
│  │  IdeaResource.ideaUpdateAdmin() ─────────┼──▶ SlackStore        │    │
│  │  CommentResource.commentCreate() ────────┘    .cfPostCreated()  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Slack Workspace                                │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ #feedback       │    │ #feature-reqs   │    │ #bug-reports    │      │
│  │                 │    │                 │    │                 │      │
│  │ 📝 New post...  │    │ 📝 New post...  │    │ 📝 New post...  │      │
│  │  └─ Comment 1   │    │  └─ Comment 1   │    │  └─ Comment 1   │      │
│  │  └─ Comment 2   │    │                 │    │                 │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### 1. New Files to Create

```
clearflask-server/src/main/java/com/smotana/clearflask/
├── store/
│   └── slack/
│       ├── SlackStore.java                    # Interface for Slack operations
│       ├── SlackStoreImpl.java                # Implementation
│       └── SlackClientProvider.java           # Slack API client management
├── web/
│   └── resource/
│       └── SlackResource.java                 # REST endpoints for webhooks
└── util/
    └── SlackSignatureVerifier.java            # Webhook signature verification

clearflask-api/src/main/openapi/
└── api-project.yaml                           # Add Slack configuration schema
```

### 2. Files to Modify

```
clearflask-server/src/main/java/com/smotana/clearflask/
├── web/resource/
│   ├── IdeaResource.java                      # Add Slack notification triggers
│   └── CommentResource.java                   # Add Slack notification triggers
└── store/
    └── ProjectStore.java                      # Add Slack configuration accessors
```

---

## Detailed Implementation Plan

### Phase 1: Configuration Schema

#### 1.1 API Configuration (api-project.yaml)

Add Slack configuration to the project schema:

```yaml
SlackIntegration:
  type: object
  properties:
    # OAuth credentials
    teamId:
      type: string
      description: Slack workspace ID
    accessToken:
      type: string
      description: OAuth access token (stored encrypted)
    botUserId:
      type: string
      description: Bot user ID for filtering self-messages

    # Channel-Category Links (multiple supported)
    channelLinks:
      type: array
      items:
        $ref: '#/components/schemas/SlackChannelLink'

SlackChannelLink:
  type: object
  required:
    - channelId
    - categoryId
  properties:
    channelId:
      type: string
      description: Slack channel ID (e.g., C01234567)
    channelName:
      type: string
      description: Informational channel name
    categoryId:
      type: string
      description: ClearFlask category ID for posts
    initialStatusId:
      type: string
      description: Initial status for posts created from Slack
    createWithTags:
      type: array
      items:
        type: string
      description: Tags to apply to posts from Slack

    # Sync options
    syncPostsToSlack:
      type: boolean
      default: true
      description: Send new ClearFlask posts to Slack
    syncSlackToPosts:
      type: boolean
      default: true
      description: Create posts from Slack messages
    syncCommentsToReplies:
      type: boolean
      default: true
      description: Mirror comments as thread replies
    syncRepliesToComments:
      type: boolean
      default: true
      description: Create comments from thread replies
    syncStatusUpdates:
      type: boolean
      default: true
      description: Update Slack messages when status changes
    syncResponseUpdates:
      type: boolean
      default: true
      description: Post admin responses as thread replies
```

#### 1.2 Store Slack Message Mapping

Store the mapping between Slack messages and ClearFlask posts:

```yaml
SlackMessageMapping:
  type: object
  properties:
    projectId:
      type: string
    slackTeamId:
      type: string
    slackChannelId:
      type: string
    slackMessageTs:
      type: string
      description: Slack message timestamp (unique ID)
    postId:
      type: string
      description: ClearFlask post ID
    lastSyncedAt:
      type: string
      format: date-time
```

---

### Phase 2: Slack OAuth & Client Provider

#### 2.1 SlackClientProvider Interface

```java
// clearflask-server/src/main/java/com/smotana/clearflask/store/slack/SlackClientProvider.java

public interface SlackClientProvider {

    /**
     * Get Slack client for a project's integration
     */
    MethodsClient getClient(String projectId);

    /**
     * Initiate OAuth flow - returns authorization URL
     */
    String getOAuthAuthorizationUrl(String projectId, String redirectUri);

    /**
     * Complete OAuth flow - exchange code for token
     */
    SlackOAuthResult completeOAuth(String projectId, String code, String redirectUri);

    /**
     * Revoke access token
     */
    void revokeAccess(String projectId);

    @Value
    class SlackOAuthResult {
        String accessToken;
        String teamId;
        String teamName;
        String botUserId;
    }
}
```

#### 2.2 OAuth Configuration

Using Slack's OAuth 2.0 flow:
- **Scopes required**:
  - `channels:history` - Read messages in public channels
  - `channels:read` - List channels
  - `chat:write` - Post messages
  - `reactions:read` - Read reactions (for future voting integration)
  - `users:read` - Get user info for author mapping

#### 2.3 Rate Limiting

Implement per-workspace rate limiting similar to GitHub integration:
- Default: 1 request per second with burst capacity
- Token bucket algorithm with 1-hour pre-charge

---

### Phase 3: Webhook Handling

#### 3.1 SlackResource (Webhook Endpoints)

```java
// clearflask-server/src/main/java/com/smotana/clearflask/web/resource/SlackResource.java

@Path("/api/v1/webhook/slack")
public class SlackResource {

    /**
     * Slack Events API endpoint
     * Handles: url_verification, message events, reaction events
     */
    @POST
    @Path("/project/{projectId}/events")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response handleSlackEvent(
        @PathParam("projectId") String projectId,
        String payload);

    /**
     * Slack Interactive Components endpoint
     * Handles: button clicks, modal submissions
     */
    @POST
    @Path("/project/{projectId}/interactive")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    @Produces(MediaType.APPLICATION_JSON)
    public Response handleInteractive(
        @PathParam("projectId") String projectId,
        @FormParam("payload") String payload);

    /**
     * OAuth callback endpoint
     */
    @GET
    @Path("/oauth/callback")
    public Response oauthCallback(
        @QueryParam("code") String code,
        @QueryParam("state") String state);
}
```

#### 3.2 Webhook Signature Verification

```java
// clearflask-server/src/main/java/com/smotana/clearflask/util/SlackSignatureVerifier.java

public class SlackSignatureVerifier {

    /**
     * Verify Slack request signature using signing secret
     * Algorithm: v0=HMAC-SHA256(v0:timestamp:body, signing_secret)
     */
    public static void verifySignature(
        String body,
        String timestamp,
        String signature,
        String signingSecret) throws WebApplicationException;
}
```

#### 3.3 Event Handling Flow

```
Slack Event → SlackResource → SlackStore
                                  │
                   ┌──────────────┼──────────────┐
                   ▼              ▼              ▼
            slackMessageEvent  slackReplyEvent  slackReactionEvent
                   │              │              │
                   ▼              ▼              ▼
            createPost()   createComment()  updateVotes()
```

---

### Phase 4: SlackStore Implementation

#### 4.1 Core Interface

```java
// clearflask-server/src/main/java/com/smotana/clearflask/store/slack/SlackStore.java

public interface SlackStore {

    // ===== Configuration =====

    /**
     * Setup Slack integration for a project
     */
    void setupIntegration(String projectId, SlackOAuthResult oauthResult);

    /**
     * Add channel-category link
     */
    void addChannelLink(String projectId, SlackChannelLink link);

    /**
     * Remove channel-category link
     */
    void removeChannelLink(String projectId, String channelId);

    /**
     * Remove entire integration
     */
    void removeIntegration(String projectId);

    /**
     * Get available channels for linking
     */
    List<SlackChannel> getAvailableChannels(String projectId);

    // ===== Slack → ClearFlask (Webhook handlers) =====

    /**
     * Handle new message in linked channel → create post
     */
    void slackMessageCreated(String projectId, SlackMessageEvent event);

    /**
     * Handle thread reply → create comment
     */
    void slackReplyCreated(String projectId, SlackMessageEvent event);

    /**
     * Handle message edited → update post/comment
     */
    void slackMessageEdited(String projectId, SlackMessageEvent event);

    /**
     * Handle message deleted → mark post/comment deleted
     */
    void slackMessageDeleted(String projectId, SlackMessageEvent event);

    // ===== ClearFlask → Slack (Outbound sync) =====

    /**
     * Post created in ClearFlask → send to Slack
     */
    void cfPostCreatedAsync(String projectId, IdeaModel post, UserModel author);

    /**
     * Comment created → send as thread reply
     */
    void cfCommentCreatedAsync(String projectId, IdeaModel post,
                               CommentModel comment, UserModel author);

    /**
     * Post status changed → update Slack message
     */
    void cfPostStatusChangedAsync(String projectId, IdeaModel post);

    /**
     * Admin response added → post as thread reply
     */
    void cfResponseAddedAsync(String projectId, IdeaModel post);
}
```

#### 4.2 Deterministic ID Generation

Following the GitHub pattern for consistent linking:

```java
// Post ID for Slack-originated posts
public String genDeterministicPostIdForSlackMessage(
    String channelId, String messageTs) {
    return "slack-" + channelId + "-" + messageTs.replace(".", "-");
}

// Comment ID for Slack-originated replies
public String genDeterministicCommentIdForSlackReply(
    String channelId, String threadTs, String messageTs) {
    return "slack-" + messageTs.replace(".", "-");
}
```

#### 4.3 Message Formatting

**ClearFlask → Slack Message Format:**

```
📝 *{post.title}*
{post.description (converted from HTML to Slack mrkdwn)}

• Category: {categoryName}
• Status: {statusName}
• Author: {authorName}
• <{postUrl}|View in ClearFlask>
```

**Slack → ClearFlask Conversion:**
- Slack mrkdwn → HTML using existing `MarkdownAndQuillUtil`
- First line (or first sentence) becomes title
- Rest becomes description
- Extract author info from Slack user profile

---

### Phase 5: DynamoDB Schema for Message Mapping

#### 5.1 SlackMessageMapping Table

```java
@Value
@DynamoDBTable(tableName = "SlackMessageMapping")
public class SlackMessageMappingModel {

    @DynamoDBHashKey
    String projectId;

    @DynamoDBRangeKey
    String slackMessageKey;  // {channelId}:{messageTs}

    @DynamoDBAttribute
    String postId;

    @DynamoDBAttribute
    String slackTeamId;

    @DynamoDBAttribute
    String slackChannelId;

    @DynamoDBAttribute
    String slackMessageTs;

    @DynamoDBAttribute
    Long lastSyncedEpochMs;

    // GSI for reverse lookup (postId → Slack message)
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "postId-index")
    public String getPostId() { return postId; }
}
```

#### 5.2 SlackCommentMapping Table

```java
@Value
@DynamoDBTable(tableName = "SlackCommentMapping")
public class SlackCommentMappingModel {

    @DynamoDBHashKey
    String projectId;

    @DynamoDBRangeKey
    String slackReplyKey;  // {channelId}:{threadTs}:{messageTs}

    @DynamoDBAttribute
    String postId;

    @DynamoDBAttribute
    String commentId;

    @DynamoDBAttribute
    String slackChannelId;

    @DynamoDBAttribute
    String slackThreadTs;

    @DynamoDBAttribute
    String slackMessageTs;

    @DynamoDBAttribute
    Long lastSyncedEpochMs;
}
```

---

### Phase 6: Event Integration Points

#### 6.1 Trigger Points in IdeaResource

```java
// In IdeaResource.ideaCreate() - after successful creation
slackStore.cfPostCreatedAsync(projectId, idea, user);

// In IdeaResource.ideaCreateAdmin() - after successful creation
slackStore.cfPostCreatedAsync(projectId, idea, user);

// In IdeaResource.ideaUpdateAdmin() - after status/response change
if (statusChanged) {
    slackStore.cfPostStatusChangedAsync(projectId, idea);
}
if (responseChanged) {
    slackStore.cfResponseAddedAsync(projectId, idea);
}
```

#### 6.2 Trigger Points in CommentResource

```java
// In CommentResource.commentCreate() - after successful creation
slackStore.cfCommentCreatedAsync(projectId, idea, comment, user);
```

#### 6.3 Async Execution Pattern

Following the GitHub integration's async pattern:

```java
@Inject
ListeningExecutorService executor;

public void cfPostCreatedAsync(String projectId, IdeaModel post, UserModel author) {
    executor.submit(() -> {
        try {
            cfPostCreatedSync(projectId, post, author);
        } catch (Exception e) {
            log.warn("Failed to sync post to Slack", e);
        }
    });
}
```

---

### Phase 7: Slack-Compatible API Support (Zulip, Mattermost)

#### 7.1 Abstract Messaging Interface

```java
public interface ChatPlatformClient {

    // Channel operations
    List<Channel> listChannels();

    // Message operations
    MessageResult postMessage(String channelId, String text, MessageOptions options);
    MessageResult postReply(String channelId, String threadId, String text);
    void updateMessage(String channelId, String messageId, String text);
    void deleteMessage(String channelId, String messageId);

    // User operations
    UserInfo getUserInfo(String userId);

    @Value
    class MessageResult {
        String messageId;
        String threadId;
    }
}
```

#### 7.2 Platform Implementations

```java
// Slack implementation
public class SlackChatClient implements ChatPlatformClient { ... }

// Zulip implementation (Slack-compatible API subset)
public class ZulipChatClient implements ChatPlatformClient { ... }

// Mattermost implementation
public class MattermostChatClient implements ChatPlatformClient { ... }
```

#### 7.3 Configuration Extension

```yaml
SlackIntegration:
  properties:
    platformType:
      type: string
      enum: [SLACK, ZULIP, MATTERMOST]
      default: SLACK
    apiBaseUrl:
      type: string
      description: Custom API base URL for self-hosted instances
```

---

### Phase 8: Two-Way Sync Logic

#### 8.1 Avoiding Infinite Loops

Key challenge: Prevent ClearFlask → Slack → ClearFlask loops

**Solution: Source Tracking**

```java
// In IdeaModel - add field
@DynamoDBAttribute
String sourceType;  // null, "slack", "github", etc.

@DynamoDBAttribute
String sourceId;    // slack:{channelId}:{messageTs}
```

**Sync Rules:**
1. If post originated from Slack (`sourceType == "slack"`):
   - Don't send back to Slack on creation
   - DO sync status/response changes

2. If comment originated from Slack:
   - Don't send back as thread reply

3. Check `botUserId` to ignore bot's own messages

#### 8.2 Conflict Resolution

When both sides are modified:

```java
public enum ConflictResolution {
    CLEARFLASK_WINS,  // ClearFlask is source of truth
    SLACK_WINS,       // Slack is source of truth
    LATEST_WINS       // Most recent edit wins
}
```

Default: `CLEARFLASK_WINS` - ClearFlask is the authoritative source

#### 8.3 Sync State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    Message States                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [SYNCED] ◄─────────────────────────────────────────────┐   │
│      │                                                   │   │
│      │ Edit on either side                               │   │
│      ▼                                                   │   │
│  [PENDING_SYNC] ──► Sync worker processes ──► [SYNCED]  │   │
│      │                                                   │   │
│      │ Conflict detected                                 │   │
│      ▼                                                   │   │
│  [CONFLICT] ──► Apply resolution strategy ──────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 9: User Mapping

#### 9.1 Slack User → ClearFlask User

```java
/**
 * Get or create ClearFlask user from Slack user
 * Similar to GitHub's getCfUserFromGhUser()
 */
private UserModel getCfUserFromSlackUser(String projectId, String slackUserId) {
    // Generate deterministic user ID
    String cfUserId = "slack-" + slackUserId;

    // Check if user exists
    Optional<UserModel> existingUser = userStore.getUser(projectId, cfUserId);
    if (existingUser.isPresent()) {
        return existingUser.get();
    }

    // Fetch Slack user info
    UsersInfoResponse userInfo = slackClient.usersInfo(r -> r.user(slackUserId));

    // Create ClearFlask user
    return userStore.createUser(UserModel.builder()
        .projectId(projectId)
        .userId(cfUserId)
        .name(userInfo.getUser().getRealName())
        .email(userInfo.getUser().getProfile().getEmail())
        .build());
}
```

#### 9.2 ClearFlask User → Slack Display

When posting to Slack, show ClearFlask user info:

```
💬 *{userName}* commented:
{commentContent}
```

---

### Phase 10: Message Formatting & Rich Content

#### 10.1 Slack Block Kit for Rich Messages

```java
private List<LayoutBlock> buildPostBlocks(IdeaModel post, Config.Category category) {
    return Arrays.asList(
        // Header with title
        HeaderBlock.builder()
            .text(PlainTextObject.builder().text(post.getTitle()).build())
            .build(),

        // Description section
        SectionBlock.builder()
            .text(MarkdownTextObject.builder()
                .text(htmlToSlackMarkdown(post.getDescription()))
                .build())
            .build(),

        // Metadata context
        ContextBlock.builder()
            .elements(Arrays.asList(
                MarkdownTextObject.builder()
                    .text("📁 " + category.getName() + " | " +
                          "👤 " + post.getAuthorName())
                    .build()
            ))
            .build(),

        // Action buttons
        ActionsBlock.builder()
            .elements(Arrays.asList(
                ButtonElement.builder()
                    .text(PlainTextObject.builder().text("View Post").build())
                    .url(getPostUrl(post))
                    .build(),
                ButtonElement.builder()
                    .text(PlainTextObject.builder().text("👍 Upvote").build())
                    .actionId("upvote_" + post.getIdeaId())
                    .build()
            ))
            .build()
    );
}
```

#### 10.2 Status Updates via Message Editing

When post status changes, update the original Slack message:

```java
public void cfPostStatusChangedAsync(String projectId, IdeaModel post) {
    // Find Slack message mapping
    Optional<SlackMessageMappingModel> mapping =
        getSlackMessageForPost(projectId, post.getIdeaId());

    if (mapping.isEmpty()) return;

    // Update message with new status
    slackClient.chatUpdate(r -> r
        .channel(mapping.get().getSlackChannelId())
        .ts(mapping.get().getSlackMessageTs())
        .blocks(buildPostBlocks(post, category))
    );
}
```

---

### Phase 11: Error Handling & Retry Logic

#### 11.1 Transient Error Retry

```java
@Value
class RetryConfig {
    int maxAttempts = 3;
    Duration initialDelay = Duration.ofSeconds(1);
    double backoffMultiplier = 2.0;
}

private <T> T withRetry(Supplier<T> operation, RetryConfig config) {
    int attempt = 0;
    while (true) {
        try {
            return operation.get();
        } catch (SlackApiException e) {
            if (isRetryable(e) && attempt < config.maxAttempts) {
                attempt++;
                sleep(config.initialDelay.multipliedBy((long) Math.pow(
                    config.backoffMultiplier, attempt - 1)));
            } else {
                throw e;
            }
        }
    }
}

private boolean isRetryable(SlackApiException e) {
    return e.getError().equals("ratelimited") ||
           e.getError().equals("service_unavailable");
}
```

#### 11.2 Permission Error Handling

```java
private void handlePermissionError(String projectId, SlackApiException e) {
    if (e.getError().equals("channel_not_found") ||
        e.getError().equals("not_in_channel")) {
        // Remove channel link and notify admin
        removeChannelLink(projectId, channelId);
        notifyAdminOfPermissionIssue(projectId, e);
    }
}
```

---

### Phase 12: Admin UI Components

#### 12.1 Configuration Flow (Frontend)

```
1. Click "Connect Slack"
   ↓
2. OAuth redirect to Slack
   ↓
3. User authorizes app
   ↓
4. Redirect back with code
   ↓
5. Show channel selection UI
   ↓
6. User maps channels to categories
   ↓
7. Configure sync options per link
   ↓
8. Save configuration
```

#### 12.2 Channel Link Configuration UI

```typescript
interface SlackChannelLinkConfig {
  channelId: string;
  channelName: string;
  categoryId: string;
  initialStatusId?: string;
  createWithTags?: string[];
  syncOptions: {
    postsToSlack: boolean;
    slackToPosts: boolean;
    commentsToReplies: boolean;
    repliesToComments: boolean;
    statusUpdates: boolean;
    responseUpdates: boolean;
  };
}
```

---

## Implementation Order

### Sprint 1: Foundation (Core Infrastructure)
1. [ ] Define OpenAPI schema for Slack configuration
2. [ ] Implement `SlackClientProvider` with OAuth flow
3. [ ] Implement `SlackSignatureVerifier`
4. [ ] Create `SlackResource` webhook endpoints
5. [ ] Create DynamoDB tables for message mapping

### Sprint 2: Outbound Sync (ClearFlask → Slack)
6. [ ] Implement `SlackStore.cfPostCreatedAsync()`
7. [ ] Implement `SlackStore.cfCommentCreatedAsync()`
8. [ ] Implement `SlackStore.cfPostStatusChangedAsync()`
9. [ ] Implement `SlackStore.cfResponseAddedAsync()`
10. [ ] Add triggers in `IdeaResource` and `CommentResource`

### Sprint 3: Inbound Sync (Slack → ClearFlask)
11. [ ] Implement `slackMessageCreated()` - new posts
12. [ ] Implement `slackReplyCreated()` - new comments
13. [ ] Implement `slackMessageEdited()` - updates
14. [ ] Implement `slackMessageDeleted()` - deletions
15. [ ] Implement user mapping (Slack → ClearFlask)

### Sprint 4: Admin UI & Polish
16. [ ] Frontend: OAuth connection flow
17. [ ] Frontend: Channel-category link management
18. [ ] Frontend: Sync options configuration
19. [ ] Add comprehensive error handling
20. [ ] Add logging and monitoring

### Sprint 5: Extended Platform Support
21. [ ] Abstract `ChatPlatformClient` interface
22. [ ] Implement Zulip adapter
23. [ ] Implement Mattermost adapter
24. [ ] Add platform selection in configuration

---

## Testing Strategy

### Unit Tests
- `SlackSignatureVerifier` - signature validation
- `SlackStoreImpl` - message formatting, ID generation
- Markdown conversion (HTML ↔ Slack mrkdwn)

### Integration Tests
- OAuth flow (mock Slack API)
- Webhook handling (mock payloads)
- DynamoDB mapping storage

### End-to-End Tests
- Create post → verify Slack message
- Slack message → verify post created
- Comment → verify thread reply
- Thread reply → verify comment

---

## Security Considerations

1. **Token Storage**: Encrypt access tokens using `DefaultServerSecret`
2. **Webhook Verification**: Always verify `X-Slack-Signature` header
3. **Rate Limiting**: Respect Slack API limits (per-workspace)
4. **Scope Minimization**: Request only required OAuth scopes
5. **Input Sanitization**: Sanitize all content from Slack before storage

---

## Configuration Example

```yaml
slack:
  teamId: "T01234567"
  accessToken: "xoxb-encrypted-token"
  botUserId: "U01234567"
  channelLinks:
    - channelId: "C01234567"
      channelName: "#feedback"
      categoryId: "category-feedback"
      initialStatusId: "status-new"
      createWithTags: ["from-slack"]
      syncPostsToSlack: true
      syncSlackToPosts: true
      syncCommentsToReplies: true
      syncRepliesToComments: true
      syncStatusUpdates: true
      syncResponseUpdates: true
    - channelId: "C07654321"
      channelName: "#bugs"
      categoryId: "category-bugs"
      syncPostsToSlack: true
      syncSlackToPosts: true
```

---

## Dependencies

### Maven Dependencies (pom.xml)

```xml
<!-- Slack SDK -->
<dependency>
    <groupId>com.slack.api</groupId>
    <artifactId>slack-api-client</artifactId>
    <version>1.36.1</version>
</dependency>
<dependency>
    <groupId>com.slack.api</groupId>
    <artifactId>slack-api-model</artifactId>
    <version>1.36.1</version>
</dependency>
```

---

## Monitoring & Observability

### Metrics to Track
- `slack.messages.sent` - Messages posted to Slack
- `slack.messages.received` - Webhook events received
- `slack.posts.created` - Posts created from Slack
- `slack.comments.created` - Comments created from Slack
- `slack.sync.errors` - Sync failures by type
- `slack.api.latency` - Slack API response times

### Logging
- INFO: Successful sync operations
- WARN: Transient failures, retries
- ERROR: Permanent failures, permission issues

---

## Future Enhancements

1. **Reactions → Votes**: Map Slack emoji reactions to ClearFlask votes
2. **Slash Commands**: `/clearflask create` to create posts from Slack
3. **Interactive Modals**: Rich forms for post creation
4. **Thread Summaries**: Summarize long threads in ClearFlask
5. **Scheduled Digests**: Daily/weekly summaries in Slack
6. **Multi-workspace**: Support multiple Slack workspaces per project
