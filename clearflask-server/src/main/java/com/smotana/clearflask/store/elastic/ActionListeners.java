package com.smotana.clearflask.store.elastic;

import com.google.common.util.concurrent.SettableFuture;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.ActionListener;

import java.util.function.Consumer;

@Slf4j
public class ActionListeners {

    private ActionListeners() {
        // disable ctor
    }


    public static <T> ActionListener<T> fromFuture(SettableFuture<T> settableFuture) {
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
}
