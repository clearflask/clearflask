package com.smotana.clearflask.billing;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.RateLimiter;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.Expression;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.ExpressionBuilder;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;

import javax.ws.rs.core.Response;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class DynamoCouponStore extends ManagedService implements CouponStore {

    /** Removed 0/O and 1/I for no confusion */
    private static final String COUPON_CHAR_BANK = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    public interface Config {
        @DefaultValue("1000")
        double couponGenerateRateLimitPerSecond();
    }

    @Inject
    private Config config;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private DynamoUtil dynamoUtil;

    private TableSchema<CouponModel> couponSchema;

    @Override
    protected void serviceStart() throws Exception {
        couponSchema = dynamoMapper.parseTableSchema(CouponModel.class);
    }

    @Override
    public void generate(String basePlanId, long amount, Optional<Instant> expiryOpt, Consumer<ImmutableCollection<String>> batchedConsumer) {
        RateLimiter limiter = RateLimiter.create(config.couponGenerateRateLimitPerSecond());

        Instant now = Instant.now();
        if (expiryOpt.isPresent() && expiryOpt.get().isBefore(now)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Expiry is in the past");
        }
        Long ttlInEpochSec = expiryOpt.map(Instant::getEpochSecond).orElse(null);

        Set<String> seenCouponIds = Sets.newHashSet();
        long amountLeft = amount;
        while (amountLeft > 0) {
            ImmutableSet.Builder<String> couponIdsBatchBuilder = ImmutableSet.builder();
            long batchCount = 0;
            while (batchCount < DYNAMO_WRITE_BATCH_MAX_SIZE && amountLeft > 0) {
                String couponId = randomCouponId();
                if (!seenCouponIds.add(couponId)) {
                    continue;
                }
                couponIdsBatchBuilder.add(couponId);
                batchCount++;
                amountLeft--;
            }
            ImmutableSet<String> couponIdsBatch = couponIdsBatchBuilder.build();
            dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(couponSchema.tableName())
                    .withItemsToPut(couponIdsBatch.stream()
                            .map(couponId -> new CouponModel(
                                    couponId,
                                    basePlanId,
                                    now,
                                    null,
                                    ttlInEpochSec))
                            .map(couponSchema::toItem)
                            .collect(ImmutableList.toImmutableList()))));
            batchedConsumer.accept(couponIdsBatch);
        }
    }

    @Override
    public Optional<CouponModel> check(String couponId) {
        return Optional.ofNullable(couponSchema.fromItem(couponSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(couponSchema.primaryKey(Map.of(
                        "couponId", couponId))))));
    }

    @Override
    public Optional<CouponModel> redeem(String couponId, String accountId) {
        ExpressionBuilder expressionBuilder = couponSchema.expressionBuilder();
        Expression expression = expressionBuilder
                .conditionExists()
                .condition("attribute_not_exists(" + expressionBuilder.fieldMapping("redeemedAccountId") + ")" +
                        " OR " + expressionBuilder.fieldMapping("redeemedAccountId") + " = " + expressionBuilder.valueMapping("redeemedAccountId", accountId))
                .set("redeemedAccountId", accountId)
                .build();
        try {
            return Optional.of(couponSchema.fromItem(couponSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(couponSchema.primaryKey(Map.of("couponId", couponId)))
                            .withConditionExpression(expression.conditionExpression().orElse(null))
                            .withUpdateExpression(expression.updateExpression().orElse(null))
                            .withNameMap(expression.nameMap().orElse(null))
                            .withValueMap(expression.valMap().orElse(null))
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem()));
        } catch (ConditionalCheckFailedException ex) {
            return Optional.empty();
        }
    }

    private String randomCouponId() {
        return RandomStringUtils.random(16, 0, COUPON_CHAR_BANK.length(), true, true, COUPON_CHAR_BANK.toCharArray(), new SecureRandom());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(CouponStore.class).to(DynamoCouponStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoCouponStore.class);
            }
        };
    }
}
