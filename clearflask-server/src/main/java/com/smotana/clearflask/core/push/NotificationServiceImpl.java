package com.smotana.clearflask.core.push;

import com.google.inject.Singleton;
import com.smotana.clearflask.store.IdeaStore;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class NotificationServiceImpl implements NotificationService {
    @Override
    public void onStatusChanged(IdeaStore.IdeaModel idea) {

    }

    @Override
    public void onAdminResponse(IdeaStore.IdeaModel idea) {

    }

    @Override
    public void onCommentReply(IdeaStore.IdeaModel idea) {

    }
}
