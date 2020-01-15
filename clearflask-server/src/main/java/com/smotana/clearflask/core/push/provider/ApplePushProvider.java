package com.smotana.clearflask.core.push.provider;

import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.core.push.PushProvider;

public class ApplePushProvider implements PushProvider {
    @Override
    public boolean send(NotificationService.NotificationModel notification, String subscription) {
        // TODO
        return false;
    }
}
