package com.smotana.clearflask.core.push;

import com.smotana.clearflask.core.push.PushProvider.NotificationModel;
import com.smotana.clearflask.store.UserStore;

public interface MultiPushProvider {

    boolean send(NotificationModel notification, UserStore.UserModel user);
}
