# ClearFlask Codebase Analysis: Comprehensive Roadmap

## Executive Summary

ClearFlask is a mature open-source feedback management tool with solid infrastructure. This document catalogs:
1. **Security issues** requiring attention
2. **Technical debt** from oversized components
3. **Dependency modernization** constraints
4. **New feature opportunities** across multiple categories
5. **WIP branches** ready to complete

---

## Priority 1: Security Issues (HIGH)

### Critical
| Issue | Location | Description |
|-------|----------|-------------|
| CSS Injection vulnerability | `clearflask-frontend/src/app/AppThemeProvider.tsx:102` | User input not sanitized before CSS injection |
| Cookie security flags missing | `clearflask-server/.../AuthenticationFilter.java:111-112, 137-138` | HttpOnly, isSecure, SameSite not validated |

### Medium
| Issue | Location | Description |
|-------|----------|-------------|
| Castle JWT hardcoded | `clearflask-frontend/src/site/Castle.tsx:111` | TODO to use backend JWT |
| OAuth CSRF in localStorage | `clearflask-frontend/src/common/util/oauthUtil.ts:163` | CSRF token storage concern |

---

## Priority 2: Broken Features (HIGH)

| Issue | Location | Description |
|-------|----------|-------------|
| GIF processing broken | `ImageNormalizationImpl.java:74` | TODO: "not working...." |
| Comment replies not implemented | `CommentList.tsx:29` | Feature incomplete |
| Post merging incomplete | `DynamoElasticIdeaStore.java:614, 984, 996` | Multiple TODOs for merged post handling |
| Session revocation incomplete | `DynamoElasticUserStore.java:854` | Sessions not properly revoked |

---

## Priority 3: Code Quality / Technical Debt (MEDIUM)

### Oversized Files Needing Refactoring
| File | Lines | Issue |
|------|-------|-------|
| `ProjectSettings.tsx` | 4,410 | Massive settings component, unmaintainable |
| `LandingPages.tsx` | 3,504 | Should extract reusable components |
| `DynamoElasticIdeaStore.java` | 2,345 | Multiple responsibilities, needs splitting |
| `DynamoElasticUserStore.java` | 1,680 | Complex user management |
| `KillBilling.java` | 1,496 | Billing logic poorly organized |
| `AccountResource.java` | 1,213 | Should delegate to service layer |

### Stale TODOs
- `Main.tsx:131` - "Remove after July 1, 2023" - OVERDUE by 2+ years
- `ProjectDeletionService.java` - 7 instances of "TODO switch to debug" logging

---

## Priority 4: Dependency Modernization (MEDIUM-LOW)

### Java 11 Lock Constraints
The project is locked to Java 11 due to:
- Lucene 8.8.2 (last Java 11 version)
- JooQ 3.16.23 (last Java 11 version)
- LangChain4j 0.35.0 (last Java 11 version)
- Tomcat 8.5 (requires javax.* namespace)

### Frontend Outdated Stack
| Package | Current | Latest |
|---------|---------|--------|
| React | 17.0.2 | 18+ |
| Material-UI | 4.11.4 | 5.x |
| Webpack | 4.44.2 | 5.x |
| Node.js | 14.15.1 | 18+ (EOL) |
| TypeScript | 4.1.3 | 5.x |

### Security Overrides (40+ in package.json)
Multiple pnpm overrides patching vulnerable transitive dependencies including:
- express, body-parser, dompurify, ejs, node-forge, tough-cookie

---

## Priority 5: Active Development Areas (INFO)

### Recent Focus (from git history)
1. **Trial/Subscription lifecycle** - Trial ending workflows, account deletion
2. **Castle anti-spam** - New integration (commit cc5170c1)
3. **Database modernization** - MySQL 5.7 → MariaDB 10.5

### In-Progress Branches
- `upgrade-deps` - Dependency upgrades with BouncyCastle fixes
- `upgrade-killbill` - KillBill payment system upgrade
- `chatwoot` - Chatwoot messaging integration (WIP)
- `i18n-staging` - LLM/AI features (experimental)

---

## Recommended Focus Areas

### Option A: Security First
1. Fix CSS injection in AppThemeProvider.tsx
2. Add cookie security validation in AuthenticationFilter.java
3. Address Castle JWT and OAuth CSRF concerns

### Option B: Fix Broken Features
1. Fix GIF processing in ImageNormalizationImpl
2. Complete post merging logic in DynamoElasticIdeaStore
3. Implement comment replies properly

### Option C: Technical Debt Reduction
1. Split ProjectSettings.tsx into focused components
2. Refactor DynamoElasticIdeaStore into smaller services
3. Clean up stale TODOs and logging levels

### Option D: Dependency Modernization
1. Upgrade frontend stack (React 18, MUI 5, Node 18)
2. Plan Java 17 migration path
3. Address security overrides in package.json

### Option E: Continue Current Work
1. Complete trial ending workflows
2. Finish Castle anti-spam integration
3. Continue dependency upgrade branch work

---

## New Feature Opportunities

### Quick Wins (Low effort, high value)
| Feature | Description | Infrastructure Status |
|---------|-------------|----------------------|
| **Comment threading/replies** | Reply to specific comments | API defined, TODO in `CommentList.tsx:29` |
| **Slack integration** | Notify Slack on new feedback | Webhook system exists |
| **User-facing AI chat** | Let users chat with AI about product | LangChain4j integrated, currently admin-only |
| **Digest frequency options** | Let users control email frequency | Email system mature |

### Medium Effort Features
| Feature | Description | Infrastructure Status |
|---------|-------------|----------------------|
| **Jira/Linear integration** | Sync requests to issue trackers | Webhook + GitHub patterns exist |
| **Internationalization (i18n)** | 24 languages translated | Branch `i18n-staging` is mature |
| **Chatwoot integration** | Convert feedback to support tickets | Branch `chatwoot` WIP |
| **Advanced dashboard filtering** | Date range, user segment filters | Analytics foundation exists |

### High Effort / Strategic Features
| Feature | Description | Infrastructure Status |
|---------|-------------|----------------------|
| **Enterprise SSO/SAML** | Single sign-on for enterprises | OAuth patterns exist |
| **AI duplicate detection** | Auto-detect similar requests | LLM + search integration ready |
| **Mobile app** | Native iOS/Android | React Native possible |
| **Smart idea merging** | Auto-consolidate related requests | Merging logic partially built |

### WIP Feature Branches
- `chatwoot` - Chatwoot messaging integration (early stage)
- `i18n-staging` - Internationalization with 24 languages (mature)
- `profile-pic-upload` - User profile pictures (stalled since Jan 2023)
- `upgrade-killbill` - Payment system upgrade (active)

### LLM/AI Current State
The codebase has **active LangChain4j + OpenAI integration**:
- `api-llm.yaml` - Full conversation API defined
- Admin-only chat interface exists
- Token counting, streaming (SSE) implemented
- Feature flagged as paid add-on

**Expansion opportunities:**
- User-facing chat (currently admin-only)
- Multi-model support (add Claude/Anthropic)
- RAG for product knowledge
- AI-powered summaries of feature requests

---

## Detailed Feature Catalog

### Category 1: AI/LLM Features

#### 1.1 User-Facing AI Chat
**Current State:** Admin-only LLM chat exists with LangChain4j + OpenAI
**Files:**
- `clearflask-api/src/main/openapi/api-llm.yaml` - API definition
- `clearflask-server/src/main/java/com/smotana/clearflask/core/llm/` - Backend implementation
- `clearflask-frontend/src/app/comps/LlmChat.tsx` - Admin UI component

**Implementation:**
- Expose existing chat API to end users (with rate limiting)
- Add user-level conversation history
- Create embeddable widget for portal pages

**Effort:** Medium (1 week) - infrastructure exists

#### 1.2 Multi-Model Support (Claude/Anthropic)
**Current State:** OpenAI only via LangChain4j
**Files:**
- `pom.xml` line 609-615 - LangChain4j BOM (0.35.0)

**Implementation:**
- Add `langchain4j-anthropic` dependency
- Create model selection config
- Update admin settings UI

**Effort:** Low (2-3 days)

#### 1.3 AI Duplicate Detection
**Current State:** Search exists, no AI matching
**Files:**
- `clearflask-server/src/main/java/com/smotana/clearflask/store/impl/DynamoElasticIdeaStore.java`

**Implementation:**
- Generate embeddings for new posts
- Compare against existing posts using vector similarity
- Suggest merges to admins

**Effort:** High (2+ weeks) - needs vector store integration

#### 1.4 AI-Powered Summaries
**Current State:** No auto-summarization
**Implementation:**
- Summarize long feedback threads
- Weekly digest with AI-generated insights
- Auto-tag posts based on content

**Effort:** Medium (1 week)

---

### Category 2: Integrations

#### 2.1 Slack Integration
**Current State:** Webhook system exists, no Slack-specific
**Files:**
- `clearflask-server/src/main/java/com/smotana/clearflask/core/push/provider/` - Notification providers

**Implementation:**
- Add Slack webhook configuration in project settings
- Post to Slack on new feedback, status changes, comments
- Support channel selection

**Effort:** Low (2-3 days)

#### 2.2 Discord Integration
**Current State:** Not implemented
**Implementation:**
- Similar to Slack - Discord webhook support
- Role-based mentions

**Effort:** Low (2-3 days)

#### 2.3 Jira Integration
**Current State:** GitHub integration exists as pattern
**Files:**
- `clearflask-server/src/main/java/com/smotana/clearflask/web/resource/GitHubResource.java`

**Implementation:**
- OAuth flow for Jira authentication
- Create Jira issue from ClearFlask post
- Sync status changes bidirectionally
- Link ClearFlask posts to Jira tickets

**Effort:** High (2+ weeks)

#### 2.4 Linear Integration
**Current State:** Not implemented
**Implementation:**
- Linear API integration
- Similar to Jira but simpler API

**Effort:** Medium (1 week)

#### 2.5 Zapier/Make.com Integration
**Current State:** Webhook triggers exist
**Files:**
- `clearflask-server/src/main/java/com/smotana/clearflask/core/push/WebhookServiceImpl.java`

**Implementation:**
- Document webhook payloads for Zapier
- Add webhook authentication (signing)
- Create Zapier app listing

**Effort:** Medium (1 week)

#### 2.6 Intercom Integration
**Current State:** Not implemented
**Implementation:**
- Link Intercom users to ClearFlask users
- Show user feedback history in Intercom
- Create feedback from Intercom conversations

**Effort:** High (2+ weeks)

---

### Category 3: Discussion Features

#### 3.1 Comment Threading/Replies
**Current State:** TODO in code, API may support
**Files:**
- `clearflask-frontend/src/app/comps/CommentList.tsx:29` - "TODO add comment replies"
- `clearflask-server/src/main/java/com/smotana/clearflask/store/impl/DynamoElasticCommentStore.java:946`

**Implementation:**
- Add `parentCommentId` field to comments
- Update UI to show nested replies
- Fix `childCommentCount` updates (existing TODO)

**Effort:** Medium (1 week)

#### 3.2 @Mentions
**Current State:** Not implemented
**Implementation:**
- Parse @username in comment text
- Notify mentioned users
- Autocomplete suggestions while typing

**Effort:** Medium (1 week)

#### 3.3 Comment Reactions
**Current State:** Posts have expressions, comments don't
**Files:**
- `clearflask-api/src/main/openapi/api-vote.yaml` - Expression system

**Implementation:**
- Extend expression system to comments
- Add reaction picker UI
- Display reaction counts

**Effort:** Low (3-4 days)

#### 3.4 Comment Voting
**Current State:** Not implemented
**Implementation:**
- Add upvote/downvote to comments
- Sort by votes or chronologically
- Highlight helpful comments

**Effort:** Low (3-4 days)

---

### Category 4: User Experience

#### 4.1 Knowledge Base
**Current State:** TODO in configTemplater.ts
**Files:**
- `clearflask-frontend/src/common/config/configTemplater.ts:73-79`

**Implementation:**
- New content type for KB articles
- Hierarchical categories
- Search integration
- Link articles to feedback posts

**Effort:** High (2+ weeks)

#### 4.2 FAQ Section
**Current State:** TODO in configTemplater.ts
**Implementation:**
- Collapsible Q&A format
- Category organization
- Search within FAQ

**Effort:** Medium (1 week)

#### 4.3 Changelog/Blog
**Current State:** Roadmap exists, no changelog
**Implementation:**
- New post type for announcements
- Email subscribers on new posts
- Public changelog page

**Effort:** Medium (1 week)

#### 4.4 Embeddable Widget
**Current State:** Not implemented
**Implementation:**
- Embed feedback button/form on any website
- Lightweight JS widget
- SSO integration for logged-in users

**Effort:** High (2+ weeks)

#### 4.5 Mobile App
**Current State:** React web only
**Files:**
- `clearflask-frontend/package.json` - Has react-native dependency (unused?)

**Implementation:**
- React Native app for iOS/Android
- Push notifications
- Offline support

**Effort:** Very High (months)

#### 4.6 Dark Mode
**Current State:** Partial theme support
**Files:**
- `clearflask-frontend/src/app/AppThemeProvider.tsx`

**Implementation:**
- Complete dark theme CSS
- User preference toggle
- System preference detection

**Effort:** Medium (1 week)

---

### Category 5: Analytics & Reporting

#### 5.1 Advanced Filtering
**Current State:** Basic dashboard exists
**Files:**
- `clearflask-frontend/src/app/Dashboard.tsx`

**Implementation:**
- Date range pickers
- User segment filters
- Status/category filters
- Saved filter presets

**Effort:** Medium (1 week)

#### 5.2 Custom Reports
**Current State:** Not implemented
**Implementation:**
- Report builder UI
- Export to PDF/CSV
- Scheduled email reports

**Effort:** High (2+ weeks)

#### 5.3 Trend Analysis
**Current State:** Trending posts exist
**Implementation:**
- Historical trend charts
- Predict popular features
- Sentiment analysis over time

**Effort:** High (2+ weeks)

#### 5.4 User Segmentation
**Current State:** Basic user management
**Implementation:**
- Define segments (power users, churned, etc.)
- Filter analytics by segment
- Targeted communications

**Effort:** Medium (1 week)

---

### Category 6: Security & Auth

#### 6.1 Multi-Factor Authentication
**Current State:** Password only
**Implementation:**
- TOTP-based 2FA
- Recovery codes
- Remember device option

**Effort:** High (2+ weeks)

#### 6.2 SAML/Enterprise SSO
**Current State:** OAuth exists
**Files:**
- `clearflask-server/src/main/java/com/smotana/clearflask/security/`

**Implementation:**
- SAML 2.0 support
- SCIM user provisioning
- Directory sync

**Effort:** Very High (months)

#### 6.3 API Key Management
**Current State:** Basic API auth
**Implementation:**
- Multiple API keys per account
- Key scopes/permissions
- Usage tracking per key

**Effort:** Medium (1 week)

#### 6.4 Audit Logging
**Current State:** Not implemented
**Implementation:**
- Log all admin actions
- Searchable audit trail
- Export for compliance

**Effort:** High (2+ weeks)

---

### Category 7: Billing & Monetization

#### 7.1 Usage-Based Billing
**Current State:** Plan-based only (KillBill)
**Files:**
- `clearflask-server/src/main/java/com/smotana/clearflask/billing/`

**Implementation:**
- Track API calls, users, etc.
- Metered billing integration
- Usage dashboards

**Effort:** High (2+ weeks)

#### 7.2 Reseller/White-Label
**Current State:** Basic branding
**Implementation:**
- Custom domains per project
- White-label invoices
- Partner portal

**Effort:** Very High (months)

---

## WIP Branches to Complete

### Branch: `i18n-staging` (MATURE - Ready to merge)
**Status:** 24 languages translated
**Languages:** Arabic, Chinese, Czech, Danish, German, Greek, Spanish, Finnish, French, Italian, Japanese, Korean, Mongolian, Dutch, Norwegian, Polish, Portuguese, Romanian, Russian, Slovakian, Swedish, Ukrainian, Welsh
**Effort to complete:** Low (review and merge)

### Branch: `chatwoot` (EARLY WIP)
**Status:** Early integration work
**Scope:** Chatwoot customer support integration
**Effort to complete:** High (significant work remaining)

### Branch: `profile-pic-upload` (STALLED)
**Status:** WIP since Jan 2023
**Scope:** User profile picture upload
**Effort to complete:** Medium (needs revival)

### Branch: `upgrade-killbill` (ACTIVE)
**Status:** In progress
**Scope:** KillBill payment system upgrade
**Effort to complete:** In progress by maintainer

### Branch: `upgrade-deps` (ACTIVE)
**Status:** Active development
**Scope:** Dependency upgrades with BouncyCastle fixes
**Effort to complete:** In progress by maintainer
