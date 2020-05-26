package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.util.IdUtil;

import java.time.Instant;

public class MockModelUtil {
    public static UserModel getRandomUser() {
        return new UserModel(
                IdUtil.randomId(),
                IdUtil.randomId(),
                null,
                false,
                IdUtil.randomId(),
                IdUtil.randomId() + "@example.com",
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
                null);
    }

    public static IdeaModel getRandomIdea() {
        return new IdeaModel(
                IdUtil.randomId(),
                IdUtil.contentUnique(" this !@#$%^&*()is my title 9032 "),
                IdUtil.randomId(),
                IdUtil.randomId(),
                Instant.now(),
                "title",
                "description",
                "response",
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
                0d);
    }

    public static CommentModel getRandomComment() {
        return new CommentModel(
                IdUtil.randomId(),
                IdUtil.randomId(),
                IdUtil.randomId(),
                ImmutableList.of(),
                0,
                0L,
                IdUtil.randomId(),
                "John Doe",
                Instant.now(),
                null,
                "This is a comment " + IdUtil.randomId(),
                0,
                0);
    }
}
