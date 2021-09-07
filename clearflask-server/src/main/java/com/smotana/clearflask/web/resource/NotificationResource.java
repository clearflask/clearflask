// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.NotificationApi;
import com.smotana.clearflask.api.model.NotificationSearchResponse;
import com.smotana.clearflask.store.NotificationStore;
import com.smotana.clearflask.store.NotificationStore.NotificationModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class NotificationResource extends AbstractResource implements NotificationApi {

    @Inject
    private NotificationStore notificationStore;

    @Override
    @RolesAllowed({Role.PROJECT_USER})
    public void notificationClear(String projectId, String notificationId) {
        String userId = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAuthenticatedUserIdOpt).map(UserSession::getUserId).get();
        notificationStore.notificationClear(projectId, userId, notificationId);
    }

    @Override
    @RolesAllowed({Role.PROJECT_USER})
    public void notificationClearAll(String projectId) {
        String userId = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAuthenticatedUserIdOpt).map(UserSession::getUserId).get();
        notificationStore.notificationClearAll(projectId, userId);
    }

    @Override
    @RolesAllowed({Role.PROJECT_USER})
    public NotificationSearchResponse notificationSearch(String projectId, String cursor) {
        String userId = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAuthenticatedUserIdOpt).map(UserSession::getUserId).get();
        NotificationStore.NotificationListResponse response = notificationStore.notificationList(projectId, userId, Optional.ofNullable(Strings.emptyToNull(cursor)));
        return new NotificationSearchResponse(
                response.getCursorOpt().orElse(null),
                response.getNotifications().stream()
                        .map(NotificationModel::toNotification)
                        .collect(ImmutableList.toImmutableList()));
    }
}
