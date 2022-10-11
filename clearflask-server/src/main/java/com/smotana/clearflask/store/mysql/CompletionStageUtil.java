package com.smotana.clearflask.store.mysql;

import com.google.common.util.concurrent.SettableFuture;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;

import java.util.Collection;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

@Slf4j
public class CompletionStageUtil {

    private CompletionStageUtil() {
        // disable ctor
    }

    public static void logFailure(Collection<CompletionStage<?>> completionStages) {
        completionStages.forEach(CompletionStageUtil::logFailure);
    }

    public static void logFailure(CompletionStage<?> completionStage) {
        completionStage.whenCompleteAsync((result, th) -> {
            if (th == null) {
                return;
            }
            if (LogUtil.rateLimitAllowLog("CompletionStageUtil-failure")) {
                log.warn("Unknown async failure", th);
            }
        });
    }

    public static SettableFuture<Void> toSettableFuture(CompletionStage<?> completionStage) {
        return toSettableFuture(SettableFuture.create(), completionStage);
    }

    public static SettableFuture<Void> toSettableFuture(SettableFuture<Void> settableFuture, CompletionStage<?> completionStage) {
        completionStage.whenCompleteAsync((result, th) -> {
            if (th == null) {
                settableFuture.set(null);
            } else {
                if (LogUtil.rateLimitAllowLog("CompletionStageUtil-failure")) {
                    log.warn("Unknown async failure", th);
                }
                settableFuture.setException(th);
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
