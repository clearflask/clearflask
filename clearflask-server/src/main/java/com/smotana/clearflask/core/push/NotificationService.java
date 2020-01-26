package com.smotana.clearflask.core.push;

import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore;

import java.util.Optional;

public interface NotificationService {

    void onStatusOrResponseChanged(IdeaStore.IdeaModel idea, boolean statusChanged, boolean responseChanged);

    void onCommentReply(IdeaStore.IdeaModel idea, Optional<CommentModel> parentCommentOpt, CommentModel comment);
}
