package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.Application;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

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

    Project createProject(String accountId, String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, Optional<String> previousVersion, VersionedConfigAdmin versionedConfigAdmin);

    void addWebhookListener(String projectId, WebhookListener listener);

    void removeWebhookListener(String projectId, WebhookListener listener);

    void deleteProject(String projectId);

    interface Project {
        ProjectModel getModel();

        String getAccountId();

        String getProjectId();

        String getVersion();

        VersionedConfig getVersionedConfig();

        VersionedConfigAdmin getVersionedConfigAdmin();

        double getCategoryExpressionWeight(String categoryId, String expression);

        Optional<Category> getCategory(String categoryId);

        Optional<IdeaStatus> getStatus(String categoryId, String statusId);

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
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "project")
    class ProjectModel {
        @NonNull
        String accountId;

        @NonNull
        String projectId;

        /** Config version mainly used to make sure we don't overwrite each other's changes */
        @NonNull
        String version;

        /** Schema version mainly used for automatic upgrades */
        Long schemaVersion;

        @NonNull
        ImmutableSet<String> webhookListeners;

        @NonNull
        String configJson;
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
}
