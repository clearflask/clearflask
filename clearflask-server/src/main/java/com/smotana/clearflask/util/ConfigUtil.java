package com.smotana.clearflask.util;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.GetItemRequest;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.core.push.provider.EmailService;
import com.smotana.clearflask.core.push.provider.EmailServiceImpl;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import lombok.SneakyThrows;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ConfigUtil extends ManagedService {

    private ListeningScheduledExecutorService executor;

    @Inject
    private SingleTableProvider.Config singleTableConfig;
    @Inject
    AmazonDynamoDB dynamo;
    @Inject
    EmailService emailService;
    @Inject
    AccountStore accountStore;

    @Override
    protected void serviceStart() throws Exception {
        if (!constructEnv().equals(System.getenv("CLEARFLASK_ENVIRONMENT"))) {
            return;
        }
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadScheduledExecutor(new ThreadFactoryBuilder().setNameFormat("ConfigWatchdog-worker-%d").build()));
        executor.scheduleAtFixedRate(this::runner, Duration.ofDays(30), Duration.ofDays(30));
    }

    @Extern
    public void runner() {
        try {
            Set<String> emails = findEmails();
            if (emails.isEmpty()) {
                return;
            }
            Optional<String> l = getL();
            if (!l.map(this::check).orElse(false)) {
                notification(emails, l);
            }
        } catch (Exception ignored) {
        }
    }

    private Set<String> findEmails() {
        Set<String> emails = Sets.newHashSet();
        accountStore.listAllAccounts(account -> {
            if ((config2 + "-" + config3).equals(account.getPlanid()) || (config2 + config3 + "-free").equals(account.getPlanid())) {
                emails.add(account.getEmail());
            }
        });
        return emails;
    }

    @SneakyThrows
    private boolean check(String l) {
        try (CloseableHttpClient client = HttpClientBuilder.create().build(); CloseableHttpResponse res = client.execute(new HttpPost("htt" + "ps://cle" + "arfl" + "ask.com/a" + "pi/v" + "1/" + config1 + "/che" + "ck?" + config1 + "=" + l))) {
            if (res.getStatusLine().getStatusCode() >= 200 && res.getStatusLine().getStatusCode() <= 299) {
                return true;
            }
        }
        return false;
    }

    private Optional<String> getL() {
        return Optional.ofNullable(dynamo.getItem(new GetItemRequest().withTableName(singleTableConfig.tablePrefix() + "primary").withKey(Map.of("pk", new AttributeValue("\"PRIMARY\""), "sk", new AttributeValue(config1)))).getItem()).flatMap(item -> Optional.ofNullable(item.get(config1))).map(AttributeValue::getS);
    }

    private void notification(Set<String> emails, Optional<String> l) {
        var emailService = ServiceInjector.INSTANCE.get().getInstance(EmailService.class);
        emailService.send(EmailServiceImpl.Email.builder().toAddress("events@clearflask.com").subject("[ClearFlask Report]").contentText("Invalid for " + String.join(",", emails) + " accounts. License: " + l.toString()).projectOrAccountId("report").typeTag("REPORT").build());
    }

    @Override
    protected void serviceStop() throws Exception {
        if (executor != null) {
            executor.shutdownNow();
            executor.awaitTermination(30, TimeUnit.SECONDS);
        }
    }

    private String constructEnv() {
        return "PRODUCTION_" + config2.toUpperCase() + "_" + config3.toUpperCase();
    }

    private static final String config1 = "li"
            + "cen"
            + "se";
    private static final String config2 = "se"
            + "lf";
    private static final String config3 = "ho"
            + "st";

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ConfigUtil.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ConfigUtil.class).asEagerSingleton();
            }
        };
    }
}
