// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableMap;
import lombok.NonNull;
import lombok.Value;

import java.io.InputStream;
import java.util.Arrays;
import java.util.Optional;

public interface ContentStore {

    String getScheme();

    ContentUrl upload(String projectId, String userId, ContentType contentType, InputStream inputStream, int length);

    ContentUrl upload(String projectId, String userId, ContentType contentType, InputStream inputStream, int length, String fileName);

    String uploadAndSign(String projectId, String userId, ContentType contentType, InputStream inputStream, int length);

    String uploadAndSign(String projectId, String userId, ContentType contentType, InputStream inputStream, int length, String fileName);

    void deleteAsUser(String matchProjectId, String matchUserId, String url);

    void deleteAsAdmin(String matchProjectId, String url);

    void delete(String url);

    void deleteAllForUser(String projectId, String userId);

    void deleteAllForProject(String projectId);

    Optional<String> signUrl(String matchProjectId, String url);

    String signUrl(ContentUrl contentUrl);

    Optional<ContentUrl> parseContentUrl(String url);

    enum ContentType {
        JPEG("image/jpeg", "jpeg"),
        GIF("image/gif", "gif"),
        UNKNOWN("application/octet-stream", "dat");

        String mediaType;
        String extension;

        ContentType(String mediaType, String extension) {
            this.mediaType = mediaType;
            this.extension = extension;
        }

        public String getMediaType() {
            return mediaType;
        }

        public String getExtension() {
            return extension;
        }

        public static final ImmutableMap<String, ContentType> EXTENSION_TO_CONTENT_TYPE = Arrays.stream(ContentType.class.getEnumConstants())
                .collect(ImmutableMap.toImmutableMap(ContentType::getExtension, e -> e));
        public static final ImmutableMap<String, ContentType> MEDIA_TYPE_TO_CONTENT_TYPE = Arrays.stream(ContentType.class.getEnumConstants())
                .collect(ImmutableMap.toImmutableMap(ContentType::getMediaType, e -> e));
    }

    @Value
    class ContentUrl {
        @NonNull
        String url;
        @NonNull
        String key;
        @NonNull
        String fileName;
        String query;
        @NonNull
        String projectId;
        @NonNull
        String userId;
        @NonNull
        ContentType contentType;
    }
}
