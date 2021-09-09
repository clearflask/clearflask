// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.core.push;

import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.NotifySubscribers;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.InvitationModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;

import java.util.Optional;

public interface NotificationService {

    void onStatusOrResponseChanged(ConfigAdmin configAdmin, IdeaModel idea, boolean statusChanged, boolean responseChanged, Optional<UserModel> senderOpt);

    void onCreditChanged(ConfigAdmin configAdmin, UserModel user, TransactionModel transaction);

    void onCommentReply(ConfigAdmin configAdmin, IdeaModel idea, Optional<CommentModel> parentCommentOpt, CommentModel comment, UserModel sender);

    void onForgotPassword(ConfigAdmin configAdmin, UserModel user);

    void onAccountSignup(AccountStore.Account account);

    void onTrialEnded(String accountId, String accountEmail, boolean hasPaymentMethod);

    void onPaymentFailed(String accountId, String accountEmail, long amount, boolean requiresAction, boolean hasPaymentMethod);

    void onModInvite(ConfigAdmin configAdmin, UserModel user);

    void onTeammateInvite(InvitationModel invitation);

    void onEmailChanged(ConfigAdmin configAdmin, UserModel user, String oldEmail);

    void onEmailVerify(ConfigAdmin configAdmin, String email, String token);

    void onEmailLogin(ConfigAdmin configAdmin, UserModel user, String token);

    void onPostCreated(Project project, IdeaModel idea, NotifySubscribers notifySubscribers, UserModel author);
}
