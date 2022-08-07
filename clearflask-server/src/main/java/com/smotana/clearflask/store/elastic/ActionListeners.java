// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.elastic;

import com.google.common.util.concurrent.SettableFuture;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.ActionListener;
import rx.exceptions.CompositeException;

import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Predicate;

@Slf4j
public class ActionListeners {

    private ActionListeners() {
        // disable ctor
    }

    public static <T extends I, I> ActionListener<T> fromFuture(SettableFuture<I> settableFuture) {
        return new ActionListener<>() {
            @Override
            public void onResponse(T o) {
                settableFuture.set(o);
            }

            @Override
            public void onFailure(Exception ex) {
                if (LogUtil.rateLimitAllowLog("actionListeners-failure")) {
                    log.warn("Unknown Elasticsearch failure", ex);
                }
                settableFuture.setException(ex);
            }
        };
    }

    public static <T extends I, I> ActionListener<T> fromFuture(SettableFuture<Optional<I>> settableFuture, Predicate<Exception> exceptionsAllowed) {
        return new ActionListener<>() {
            @Override
            public void onResponse(T o) {
                settableFuture.set(Optional.of(o));
            }

            @Override
            public void onFailure(Exception ex) {
                try {
                    if (exceptionsAllowed.test(ex)) {
                        settableFuture.set(Optional.empty());
                        return;
                    }
                } catch (Throwable th2) {
                    settableFuture.setException(new CompositeException(ex, th2));
                }
                if (LogUtil.rateLimitAllowLog("actionListeners-failure")) {
                    log.warn("Unknown Elasticsearch failure", ex);
                }
                settableFuture.setException(ex);
            }
        };
    }

    public static <T> ActionListener<T> onFailure(Consumer<Exception> onFailure) {
        return new ActionListener<>() {
            @Override
            public void onResponse(Object o) {
                // Ignore
            }

            @Override
            public void onFailure(Exception ex) {
                onFailure.accept(ex);
            }
        };
    }

    public static <T extends I, I> ActionListener<T> onFailureRetry(
            SettableFuture<I> settableFuture,
            Consumer<SettableFuture<I>> retryRequest) {
        return new ActionListener<>() {
            @Override
            public void onResponse(T o) {
                settableFuture.set(o);
            }

            @Override
            public void onFailure(Exception ex) {
                if (LogUtil.rateLimitAllowLog("actionListeners-failure-retry")) {
                    log.info("Retrying an unknown Elasticsearch failure", ex);
                }

                retryRequest.accept(settableFuture);
            }
        };
    }
}
