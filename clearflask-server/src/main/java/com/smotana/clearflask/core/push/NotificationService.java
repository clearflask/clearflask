package com.smotana.clearflask.core.push;

import com.smotana.clearflask.store.IdeaStore;

public interface NotificationService {

    void onStatusChanged(IdeaStore.IdeaModel idea);

    void onAdminResponse(IdeaStore.IdeaModel idea);

    void onCommentReply(IdeaStore.IdeaModel idea);
}
