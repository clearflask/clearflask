package com.smotana.clearflask.billing;


import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.api.gen.UsageApi;

import java.time.ZonedDateTime;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

@Slf4j
@Singleton
public class KillBillUsage extends ManagedService implements Billing {

    public interface Config {
        @DefaultValue("1")
        long additionalPastDaysToRecord();
    }

    @Inject
    private Config config;
    @Inject
    private UsageApi kbUsage;

    private ScheduledExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        executor = Executors.newSingleThreadScheduledExecutor(new ThreadFactoryBuilder()
                .setNameFormat("BrowserExpiry-worker").build());

        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime nextRun = now.withHour(0).withMinute(0).withSecond(0);
        if (now.compareTo(nextRun) > 0) {
            nextRun = nextRun.plusDays(1);
        }
        long initialDelay = Duration.between(now, nextRun).getSeconds()
        TODO continue here

        executor.scheduleAtFixedRate(this::record, );
    }

    private void record() {
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).to(KillBillUsage.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
