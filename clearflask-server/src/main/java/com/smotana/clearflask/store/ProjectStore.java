// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.Application;
import io.dataspray.singletable.DynamoTable;
import lombok.*;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;

import static com.google.common.base.Preconditions.checkArgument;
import static io.dataspray.singletable.TableType.Gsi;
import static io.dataspray.singletable.TableType.Primary;

public interface ProjectStore {

    default String genProjectId(String slug) {
        return IdUtil.contentUnique(slug);
    }

    default String genConfigVersion() {
        return IdUtil.randomAscId();
    }

    Optional<Project> getProjectBySlug(String slug, boolean useCache);

    Optional<Project> getProject(String projectId, boolean useCache);

    ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache);

    void listAllProjects(Consumer<Project> consumer);

    ListResponse listProjects(Optional<String> cursorOpt, int pageSize, boolean populateCache);

    /**
     * Get global search engine
     */
    SearchEngine getSearchEngine();

    /**
     * Get global search engine
     */
    SearchEngine getSearchEngineForProject(String projectId);

    Project createProject(String accountId, String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, Optional<String> previousVersion, VersionedConfigAdmin versionedConfigAdmin, boolean isSuperAdmin);

    void addWebhookListener(String projectId, WebhookListener listener);

    void removeWebhookListener(String projectId, WebhookListener listener);

    void deleteProject(String projectId);


    default String genInvitationId() {
        return IdUtil.randomId();
    }

    InvitationModel createInvitation(String projectId, String invitedEmail, String inviteeName);

    Optional<InvitationModel> getInvitation(String invitationId);

    ImmutableList<InvitationModel> getInvitations(String projectId);

    /**
     * @return projectId
     */
    String acceptInvitation(String invitationId, String accepteeAccountId);

    void revokeInvitation(String projectId, String invitationId);

    Project addAdmin(String projectId, String adminAccountId);

    Project removeAdmin(String projectId, String adminAccountId);

    Project changeOwner(String projectId, String newOwnerAccountId);

    @Value
    class ListResponse {
        ImmutableList<Project> projects;
        Optional<String> cursorOpt;
    }

    interface Project {
        String getName();

        String getLink();

        ProjectModel getModel();

        String getAccountId();

        boolean isAdmin(String accountId);

        String getProjectId();

        String getVersion();

        VersionedConfig getVersionedConfig();

        VersionedConfigAdmin getVersionedConfigAdmin();

        double getCategoryExpressionWeight(String categoryId, String expression);

        ImmutableCollection<Category> getCategories();

        Optional<Category> getCategory(String categoryId);

        Optional<IdeaStatus> getStatus(String categoryId, String statusId);

        /**
         * Returns all status IDs that have disablePublicDisplay set to true.
         * These posts should be hidden from non-admin users.
         */
        ImmutableSet<String> getHiddenStatusIds();

        boolean isVotingAllowed(VoteValue voteValue, String categoryId, Optional<String> statusIdOpt);

        boolean isExpressingAllowed(String categoryId, Optional<String> statusIdOpt);

        boolean isFundingAllowed(String categoryId, Optional<String> statusIdOpt);

        void areTagsAllowedByUser(List<String> tagIds, String categoryId);

        Function<String, String> getIntercomEmailToIdentityFun();

        ImmutableSet<WebhookListener> getWebhookListenerUrls(WebhookListener.ResourceType resourceType, String eventType);

        String getHostnameFromSubdomain();

        Optional<String> getHostnameFromDomain();

        String getHostname();

        static String getHostname(ConfigAdmin configAdmin, Application.Config configApp) {
            return Strings.isNullOrEmpty(configAdmin.getDomain())
                    ? configAdmin.getSlug() + "." + configApp.domain()
                    : configAdmin.getDomain();
        }

        Optional<GitHub> getGitHubIntegration();

        Optional<GitLab> getGitLabIntegration();

        Optional<SearchEngine> getSearchEngineOverride();
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "project")
    @DynamoTable(type = Gsi, indexNumber = 2, shardKeys = "projectId", shardCount = 30, rangePrefix = "projectSharded", rangeKeys = "projectId")
    class ProjectModel {
        @NonNull
        String accountId;

        @NonNull
        ImmutableSet<String> adminsAccountIds;

        @NonNull
        String projectId;

        /**
         * Config version mainly used to make sure we don't overwrite each other's changes
         */
        @NonNull
        String version;

        /**
         * Schema version mainly used for automatic upgrades
         *
         * @deprecated ConfigSchemaUpgrader auto-upgrades during JSON serialization.
         */
        @Deprecated
        Long schemaVersion;

        @NonNull
        ImmutableSet<String> webhookListeners;

        @NonNull
        String configJson;

        /**
         * Version for auto-upgrades.
         * <p>
         * Currently only for ElasticSearch schema updates
         */
        Long projectVersion;
    }

    @Value
    @AllArgsConstructor
    class WebhookListener {
        @NonNull
        ResourceType resourceType;

        @NonNull
        String eventType;

        @NonNull
        String url;

        public enum ResourceType {
            POST,
            COMMENT,
            USER
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "slug", rangePrefix = "projectIdBySlug")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = "projectId", rangePrefix = "slugByProjectId")
    class SlugModel {
        @NonNull
        String slug;

        @NonNull
        String projectId;

        /**
         * Only set during migration to phase out an old slug
         */
        Long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "invitationId", rangePrefix = "invitation")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "projectId", rangePrefix = "invitationByProjectId")
    class InvitationModel {
        @NonNull
        String invitationId;

        @NonNull
        String projectId;

        @NonNull
        String invitedEmail;

        @NonNull
        String inviteeName;

        /**
         * Should be NonNull, however some projects in the past had an empty string as name so we need to handle nulls
         */
        String projectName;

        String isAcceptedByAccountId;

        @NonNull
        Long ttlInEpochSec;

        public String getProjectNameNonNull() {
            return Strings.isNullOrEmpty(projectName) ? projectId : projectName;
        }

        public boolean isAccepted() {
            return !Strings.isNullOrEmpty(getIsAcceptedByAccountId());
        }

        public InvitationAdmin toInvitationAdmin() {
            return new InvitationAdmin(
                    getInvitationId(),
                    getInvitedEmail());
        }
    }

    @Getter
    enum SearchEngine {
        READWRITE_ELASTICSEARCH(true, false, true, false),
        READWRITE_MYSQL(false, true, false, true),
        READ_ELASTICSEARCH_WRITE_BOTH(true, false, true, true),
        READ_MYSQL_WRITE_BOTH(false, true, true, true);
        private final boolean isReadElastic;
        private final boolean isReadMysql;
        private final boolean isWriteElastic;
        private final boolean isWriteMysql;

        SearchEngine(boolean isReadElastic, boolean isReadMysql, boolean isWriteElastic, boolean isWriteMysql) {
            checkArgument(isReadElastic != isReadMysql, "Can only read from one source");
            checkArgument(isWriteElastic || isWriteMysql, "Must write to at least one source");
            checkArgument(!isReadElastic || isWriteElastic, "Cannot read from elastic source we're not writing to");
            checkArgument(!isReadMysql || isWriteMysql, "Cannot read from mysql source we're not writing to");
            this.isReadElastic = isReadElastic;
            this.isReadMysql = isReadMysql;
            this.isWriteElastic = isWriteElastic;
            this.isWriteMysql = isWriteMysql;
        }
    }
}
