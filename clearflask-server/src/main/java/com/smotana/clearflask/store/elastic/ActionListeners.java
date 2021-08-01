// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.elastic;

import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.SettableFuture;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.ActionListener;
import org.elasticsearch.action.DocWriteResponse;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.support.WriteResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.common.xcontent.XContentType;

import java.util.function.Consumer;
import java.util.function.Supplier;

import static com.smotana.clearflask.util.ExplicitNull.orNull;

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
