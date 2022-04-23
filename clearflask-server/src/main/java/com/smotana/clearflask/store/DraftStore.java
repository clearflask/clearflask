// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.IdeaCreateAdmin;
import com.smotana.clearflask.api.model.IdeaDraftAdmin;
import com.smotana.clearflask.api.model.IdeaDraftSearch;
import com.smotana.clearflask.api.model.NotifySubscribers;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;


public interface DraftStore {

    default String genDraftId() {
        // Ascending order for search to return by creation time
        return IdUtil.randomAscId();
    }

    DraftModel setDraft(String projectId, String userId, Optional<String> draftIdOpt, IdeaCreateAdmin ideaCreateAdmin);

    void setDraft(DraftModel draftdraft, Optional<Boolean> assertAttributeExistsOpt);

    Optional<DraftModel> getDraft(String projectId, String userId, String draftId);

    SearchResponse searchDrafts(String projectId, String userId, IdeaDraftSearch draftSearch, Optional<String> cursorOpt);

    void deleteDraft(String projectId, String userId, String draftId);

    void deleteAllForProject(String projectId);

    @Value
    class SearchResponse {
        ImmutableList<DraftModel> drafts;
        Optional<String> cursorOpt;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "draft", rangeKeys = {"draftId"})
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "draftByProjectId")
    class DraftModel {

        @NonNull
        String projectId;

        @NonNull
        String draftId;

        /**
         * Draft belongs to this user.
         * Not to be confused with authorUserId.
         */
        @NonNull
        String userId;

        @NonNull
        long ttlInEpochSec;

        @NonNull
        Instant lastSaved;

        /**
         * User that the post will be created as.
         * May be different than userId.
         */
        @NonNull
        String authorUserId;

        @NonNull
        String categoryId;

        @NonNull
        String title;

        /**
         * WARNING: Unsanitized HTML.
         */
        @Getter(AccessLevel.PRIVATE)
        String description;

        @NonNull
        ImmutableSet<String> tagIds;

        /**
         * WARNING: Unsanitized HTML.
         */
        @Getter(AccessLevel.PRIVATE)
        String response;

        String statusId;

        Long fundGoal;

        NotifySubscribers notifySubscribers;

        @NonNull
        ImmutableSet<String> linkedFromPostIds;

        Double order;

        String coverImg;

        public String getDescriptionSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getDescription(), "draft", getDraftId(), getProjectId(), false);
        }

        public String getDescriptionAsText(Sanitizer sanitizer) {
            return sanitizer.richHtmlToPlaintext(getDescription());
        }

        public String getDescriptionAsUnsafeHtml() {
            return getDescription();
        }

        public String getResponseSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getResponse(), "draft", getDraftId(), getProjectId(), false);
        }

        public String getResponseAsText(Sanitizer sanitizer) {
            return sanitizer.richHtmlToPlaintext(getResponse());
        }

        public IdeaDraftAdmin toIdeaDraftAdmin(Sanitizer sanitizer) {
            return new IdeaDraftAdmin(
                    getAuthorUserId(),
                    getTitle(),
                    getDescriptionSanitized(sanitizer),
                    getCategoryId(),
                    getTagIds().asList(),
                    getResponseSanitized(sanitizer),
                    getStatusId(),
                    getFundGoal(),
                    getNotifySubscribers(),
                    getLinkedFromPostIds().asList(),
                    getOrder(),
                    sanitizer.signCoverImg(projectId, getCoverImg()).orElse(null),
                    getDraftId(),
                    getLastSaved());
        }
    }
}
