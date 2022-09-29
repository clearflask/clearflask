// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.util;

import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.UserStore;

import java.util.function.Supplier;

public interface WebhookService {

    ListenableFuture<Void> eventUserNew(UserStore.UserModel user);


    ListenableFuture<Void> eventCommentNew(IdeaStore.IdeaModel idea, CommentStore.CommentModel comment, UserStore.UserModel user);


    ListenableFuture<Void> eventPostNew(IdeaStore.IdeaModel idea, UserStore.UserModel user);


    ListenableFuture<Void> eventPostVoteChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, VoteOption vote);

    ListenableFuture<Void> eventPostFundingChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, long fundDiff);

    ListenableFuture<Void> eventPostExpressionsChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, ImmutableSet<String> expressions);


    ListenableFuture<Void> eventPostResponseChanged(IdeaStore.IdeaModel idea);

    ListenableFuture<Void> eventPostStatusChanged(IdeaStore.IdeaModel idea);

    ListenableFuture<Void> eventPostTagsChanged(IdeaStore.IdeaModel idea);
}
