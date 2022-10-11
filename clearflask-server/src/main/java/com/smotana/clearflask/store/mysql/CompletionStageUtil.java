package com.smotana.clearflask.store.mysql;

import com.google.common.util.concurrent.SettableFuture;

import java.util.Collection;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

public class CompletionStageUtil {

    private CompletionStageUtil() {
        // disable ctor
    }

    public static SettableFuture<Void> toSettableFuture(CompletionStage<?> completionStage) {
        return toSettableFuture(SettableFuture.create(), completionStage);
    }

    public static SettableFuture<Void> toSettableFuture(SettableFuture<Void> settableFuture, CompletionStage<?> completionStage) {
        completionStage.whenCompleteAsync((result, th) -> {
            if (th != null) {
                settableFuture.setException(th);
            } else {
                settableFuture.set(null);
            }
        });
        return settableFuture;
    }

    public static SettableFuture<Void> toSettableFuture(SettableFuture<Void> settableFuture, Collection<CompletionStage<?>> completionStages) {
        if (completionStages.isEmpty()) {
            settableFuture.set(null);
        } else {
            toSettableFuture(settableFuture, CompletableFuture.allOf(completionStages.stream()
                    .map(CompletionStage::toCompletableFuture)
                    .toArray(CompletableFuture[]::new)));
        }
        return settableFuture;
    }
}
