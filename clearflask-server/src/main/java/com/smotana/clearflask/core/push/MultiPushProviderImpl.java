package com.smotana.clearflask.core.push;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.smotana.clearflask.core.push.PushProvider.NotificationModel;
import com.smotana.clearflask.core.push.provider.BrowserPushProvider;
import com.smotana.clearflask.core.push.provider.EmailPushProvider;
import com.smotana.clearflask.store.UserStore;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class MultiPushProviderImpl implements MultiPushProvider {

    @Inject
    @Named("Email")
    private PushProvider pushEmail;
    @Inject
    @Named("Browser")
    private PushProvider pushBrowser;

    @Override
    public boolean send(NotificationModel notification, UserStore.User user) {
        boolean atLeastOneSent = false;
        if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
            atLeastOneSent |= pushBrowser.send(notification, user.getBrowserPushToken());
        }
        if (user.isEmailNotify() && !Strings.isNullOrEmpty(user.getEmail())) {
            atLeastOneSent |= pushEmail.send(notification, user.getEmail());
        }
        return atLeastOneSent;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(MultiPushProvider.class).to(MultiPushProviderImpl.class).asEagerSingleton();
                install(EmailPushProvider.module());
                install(BrowserPushProvider.module());
            }
        };
    }
}
