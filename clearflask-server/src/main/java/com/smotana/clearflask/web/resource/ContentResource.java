// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.ContentAdminApi;
import com.smotana.clearflask.api.ContentApi;
import com.smotana.clearflask.api.model.ContentUploadResponse;
import com.smotana.clearflask.core.image.ImageNormalization;
import com.smotana.clearflask.core.image.ImageNormalization.Image;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import java.io.ByteArrayInputStream;
import java.io.InputStream;

import static com.google.common.base.Preconditions.checkNotNull;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class ContentResource extends AbstractResource implements ContentApi, ContentAdminApi {

    @Inject
    private ContentStore contentStore;
    @Inject
    private ImageNormalization imageNormalization;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 30, challengeAfter = 20)
    @Override
    public ContentUploadResponse contentUpload(String projectId, InputStream body) {
        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserStore.UserSession::getUserId)
                .get();

        return new ContentUploadResponse(doUpload(projectId, userId, body));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 5, challengeAfter = 100)
    @Override
    public ContentUploadResponse contentUploadAsAdmin(String projectId, String authorId, InputStream body) {
        return new ContentUploadResponse(doUpload(projectId, authorId, body));
    }

    private String doUpload(String projectId, String authorId, InputStream body) {
        Image imageNormalized = imageNormalization.normalize(body);
        String signedUrl = contentStore.uploadAndSign(
                projectId,
                authorId,
                checkNotNull(ContentStore.ContentType.MEDIA_TYPE_TO_CONTENT_TYPE.get(imageNormalized.getMediaType())),
                new ByteArrayInputStream(imageNormalized.getData()),
                imageNormalized.getData().length);
        return signedUrl;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ContentResource.class);
            }
        };
    }
}
