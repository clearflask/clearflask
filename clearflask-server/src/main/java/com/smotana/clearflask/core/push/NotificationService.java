package com.smotana.clearflask.core.push;

import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;

import java.util.Optional;

public interface NotificationService {

    void onStatusOrResponseChanged(ConfigAdmin configAdmin, IdeaModel idea, boolean statusChanged, boolean responseChanged);

    void onCreditChanged(ConfigAdmin configAdmin, UserModel user, TransactionModel transaction);

    void onCommentReply(ConfigAdmin configAdmin, IdeaModel idea, Optional<CommentModel> parentCommentOpt, CommentModel comment, UserModel sender);

    void onForgotPassword(ConfigAdmin configAdmin, UserModel user);

    void onTrialEnded(String accountId, String accountEmail, boolean hasPaymentMethod);

    void onAdminInvite(ConfigAdmin configAdmin, UserModel user);

    void onEmailChanged(ConfigAdmin configAdmin, UserModel user, String oldEmail);

    void onEmailVerify(ConfigAdmin configAdmin, String email, String token);
}
