package com.smotana.clearflask.core.push;

import com.smotana.clearflask.core.push.NotificationService.NotificationModel;

public interface PushProvider {

    boolean send(NotificationModel notification, String subscription);
}
