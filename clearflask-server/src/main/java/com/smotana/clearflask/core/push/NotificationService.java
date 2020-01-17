package com.smotana.clearflask.core.push;

import com.smotana.clearflask.store.IdeaStore;

public interface NotificationService {

    void onStatusOrResponseChanged(IdeaStore.IdeaModel idea, boolean statusChanged, boolean responseChanged);

    void onCommentReply(IdeaStore.IdeaModel idea);
}
