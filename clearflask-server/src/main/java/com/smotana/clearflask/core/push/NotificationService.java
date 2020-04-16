package com.smotana.clearflask.core.push;

import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.UserStore.UserModel;

import java.util.Optional;

public interface NotificationService {

    void onStatusOrResponseChanged(ConfigAdmin configAdmin, IdeaModel idea, boolean statusChanged, boolean responseChanged);

    void onCommentReply(ConfigAdmin configAdmin, IdeaModel idea, Optional<CommentModel> parentCommentOpt, CommentModel comment, UserModel sender);

    void onForgotPassword(ConfigAdmin configAdmin, UserModel user);
}
