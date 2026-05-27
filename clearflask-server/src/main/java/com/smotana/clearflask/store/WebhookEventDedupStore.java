// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import io.dataspray.singletable.DynamoTable;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;

import static io.dataspray.singletable.TableType.Primary;

/**
 * Persistent webhook-event deduplication, shared across server instances.
 *
 * <p>The Stripe SDK gives us {@code event.id} (e.g. {@code evt_1ABC...}) which is unique per
 * event. Stripe retries failed deliveries (up to 3 days), and a load-balanced multi-instance
 * deployment can route the same retry to different JVMs. Either situation can lead to a
 * non-idempotent handler firing twice (duplicate email, duplicate credit sync) if dedup
 * lives only in-process.
 *
 * <p>We use DDB conditional putItem ({@code attribute_not_exists(eventId)}) as an atomic
 * claim: the first caller that succeeds owns the event; everyone else gets
 * {@link ConditionalCheckFailedException} and treats the event as already processed. TTL
 * trims rows automatically after the retention window so the table doesn't grow without bound.
 *
 * <p>Trade-off: if the claiming JVM crashes after claiming but before completing the handler,
 * the event is effectively lost (re-deliveries from Stripe will see the existing claim and
 * 200 OK). For ClearFlask's webhook handlers, the worst-case lost work is a missed
 * "trial-ending" or "payment-succeeded" email -- the daily {@code StripeSyncService}
 * reconcile and per-page {@code syncActions} catch any status drift.
 */
@Slf4j
@Singleton
public class WebhookEventDedupStore extends ManagedService {

    /** How long to keep dedup rows. Stripe webhook retry window is ~3 days; we keep 7d. */
    private static final Duration TTL = Duration.ofDays(7);

    @Inject
    private SingleTable singleTable;

    private TableSchema<WebhookEventDedup> schema;

    @Override
    protected void serviceStart() {
        schema = singleTable.parseTableSchema(WebhookEventDedup.class);
    }

    /**
     * Atomically claim ownership of an event. Returns true if this caller is the first to
     * see this event id, false if it was already claimed.
     */
    public boolean tryClaim(String eventId) {
        if (eventId == null || eventId.isEmpty()) {
            // No id => can't dedup; treat as a fresh event so handler runs. The webhook
            // handler logs this as suspicious; only happens when Stripe SDK fails to
            // populate the field.
            return true;
        }
        long ttl = Instant.now().plus(TTL).getEpochSecond();
        try {
            schema.table().putItem(new PutItemSpec()
                    .withItem(schema.toItem(new WebhookEventDedup(eventId, ttl)))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new com.amazonaws.services.dynamodbv2.document.utils.NameMap()
                            .with("#partitionKey", schema.partitionKeyName())));
            return true;
        } catch (ConditionalCheckFailedException ex) {
            return false;
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"eventId"}, rangePrefix = "webhookEventDedup")
    public static class WebhookEventDedup {
        @NonNull
        String eventId;

        @NonNull
        long ttlInEpochSec;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(WebhookEventDedupStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(WebhookEventDedupStore.class).asEagerSingleton();
            }
        };
    }
}
