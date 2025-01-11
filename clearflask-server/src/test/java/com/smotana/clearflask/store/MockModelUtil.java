// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.api.model.TransactionType;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.util.IdUtil;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import static com.smotana.clearflask.billing.KillBillPlanStore.AVAILABLE_PLAN_NAMES;
import static com.smotana.clearflask.billing.KillBillPlanStore.SELFHOST_SERVICE_PLANS;
import static com.smotana.clearflask.testutil.HtmlUtil.textToSimpleHtml;

public class MockModelUtil {

    public static Account getRandomAccount() {
        return new Account(
                IdUtil.randomId(),
                IdUtil.randomId() + "@example.com",
                SubscriptionStatus.ACTIVE,
                IdUtil.randomId(),
                AVAILABLE_PLAN_NAMES.stream()
                        .filter(Predicate.not(SELFHOST_SERVICE_PLANS::contains))
                        .findAny()
                        .orElseThrow(),
                Instant.now().minus(Duration.ofDays(4)),
                IdUtil.randomId(5),
                IdUtil.randomId(),
                ImmutableSet.of(),
                ImmutableSet.of(),
                IdUtil.randomId(),
                ImmutableMap.of(),
                ImmutableMap.of(),
                null,
                ImmutableSet.of());
    }

    public static UserModel getRandomUser() {
        return new UserModel(
                IdUtil.randomId(),
                IdUtil.randomId(),
                null,
                false,
                "\uD83E\uDD23" + IdUtil.randomId(),
                IdUtil.randomId() + "@example.com",
                null,
                null,
                IdUtil.randomId(),
                null,
                true,
                0L,
                null,
                null,
                IdUtil.randomId(),
                Instant.now(),
                null,
                null,
                null,
                null,
                null,
                ImmutableSet.of());
    }

    public static IdeaModel getRandomIdea() {
        return new IdeaModel(
                IdUtil.randomId(),
                IdUtil.contentUnique(" this !@#$%^&*()is my\uD83E\uDD23 title 9032 "),
                IdUtil.randomId(),
                IdUtil.randomId(),
                null,
                Instant.now(),
                "title\uD83E\uDD23",
                textToSimpleHtml("description\uD83E\uDD23"),
                textToSimpleHtml("response\uD83E\uDD23"),
                IdUtil.randomId(),
                IdUtil.randomId(),
                Instant.now(),
                IdUtil.randomId(),
                IdUtil.randomId(),
                ImmutableSet.of(IdUtil.randomId(), IdUtil.randomId()),
                0L,
                0L,
                0L,
                100L,
                0L,
                0L,
                0L,
                0d,
                ImmutableMap.of(),
                0d,
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                null,
                ImmutableSet.of(),
                null,
                null,
                null);
    }

    public static CommentModel getRandomComment() {
        return new CommentModel(
                IdUtil.randomId(),
                IdUtil.randomId(),
                IdUtil.randomId(),
                ImmutableList.of(),
                0,
                0L,
                "Matus Faro",
                "john@example.com",
                false,
                Instant.now(),
                null,
                textToSimpleHtml("This is a \uD83E\uDD23 comment " + IdUtil.randomId()),
                0,
                0);
    }

    public static TransactionModel getRandomTransaction() {
        return new TransactionModel(
                IdUtil.randomId(),
                IdUtil.randomId(),
                IdUtil.randomId(),
                Instant.now(),
                10,
                TransactionType.VOTE.name(),
                IdUtil.randomId(),
                "This is my transaction \uD83E\uDD23 summary",
                TimeUnit.DAYS.toSeconds(300));
    }
}
