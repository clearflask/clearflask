package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.NotificationApi;
import com.smotana.clearflask.api.model.NotificationClear;
import com.smotana.clearflask.api.model.NotificationSearchResponse;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import javax.ws.rs.Path;

// TODO
@Slf4j
@Singleton
@Path("/v1")
public class NotificationResource extends AbstractResource implements NotificationApi {

    @Override
    public void notificationClear(String projectId, String notificationId, @Valid NotificationClear notificationClear) {

    }

    @Override
    public void notificationClearAll(String projectId, @NotNull String userId) {

    }

    @Override
    public NotificationSearchResponse notificationSearch(String projectId, @NotNull String userId, String cursor) {
        return null;
    }
}
