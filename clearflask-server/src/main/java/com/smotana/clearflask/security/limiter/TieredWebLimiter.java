package com.smotana.clearflask.security.limiter;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ErrorResponse;
import com.smotana.clearflask.security.limiter.challenge.ChallengeLimiter;
import com.smotana.clearflask.security.limiter.rate.RateLimiter;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.util.Comparator;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class TieredWebLimiter implements Limiter {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue(value = "PT1M,PT1H,P1D", innerType = Duration.class)
        Set<Duration> tiers();

        Observable<Set<Duration>> tiersObservable();

        @DefaultValue("PT1H")
        Duration prechargedPeriod();

        Observable<Duration> prechargedPeriodObservable();

        @DefaultValue("10")
        double qpsBase();

        Observable<Double> qpsBaseObservable();

        /**
         * Default: sqrt(10)
         */
        @DefaultValue("3.16")
        double qpsStepUpMultiplier();

        Observable<Double> qpsStepUpMultiplierObservable();

        @DefaultValue("We have detected excessive usage, please try again later...")
        String rateLimitedUserFacingMessage();

        @DefaultValue("Solve the challenge to continue")
        String challengedUserFacingMessage();
    }

    @VisibleForTesting
    static final String CHALLENGE_HEADER = "x-cf-challenge";
    @VisibleForTesting
    static final String SOLUTION_HEADER = "x-cf-solution";

    @Inject
    private Config config;
    @Inject
    private RateLimiter rateLimiter;
    @Inject
    private ChallengeLimiter challengeLimiter;

    private double[] altPermitsCapacityCache;
    private double prechargedPeriodInSecondsCache;

    @Inject
    private void setup() {
        Runnable computeAltPermitsCapacityCallable = () -> computeAltPermitsCapacity(
                config.tiers(),
                config.qpsBase(),
                config.qpsStepUpMultiplier(),
                config.prechargedPeriod());
        Stream.of(
                config.tiersObservable(),
                config.qpsBaseObservable(),
                config.qpsStepUpMultiplierObservable(),
                config.prechargedPeriodObservable())
                .forEach(o -> o.subscribe(v -> computeAltPermitsCapacityCallable.run()));
        computeAltPermitsCapacityCallable.run();
    }

    private void computeAltPermitsCapacity(
            Set<Duration> tiers,
            double qpsBase,
            double qpsStepUpMultiplier,
            Duration prechargedPeriod) {
        Duration[] tiersReverseSorted = tiers.stream()
                .sorted(Comparator.reverseOrder())
                .toArray(Duration[]::new);
        if (prechargedPeriod.isNegative()) {
            log.error("Misconfiguration of prechargedPeriod {}", prechargedPeriod);
            return;
        }
        if (qpsStepUpMultiplier < 1) {
            log.error("Misconfiguration of qpsStepUpMultiplier {}", qpsStepUpMultiplier);
            return;
        }
        if (qpsBase <= 0) {
            log.error("Misconfiguration of qpsBase {}", qpsBase);
            return;
        }

        double[] altPermitsCapacity = new double[tiers.size() * 2];
        double qps = qpsBase;
        for (int i = 0; i < tiersReverseSorted.length; i++) {
            Duration tierDuration = tiersReverseSorted[i];
            if (tierDuration.getSeconds() < 0) {
                log.error("Misconfiguration of config tiers, duration cannot be less than one second: {}", tierDuration);
                return;
            }
            // permitsPerSecond
            altPermitsCapacity[i * 2] = qps;
            // capacityInSeconds
            altPermitsCapacity[i * 2 + 1] = (double) tierDuration.getSeconds();

            qps *= qpsStepUpMultiplier;
        }

        this.altPermitsCapacityCache = altPermitsCapacity;
        this.prechargedPeriodInSecondsCache = prechargedPeriod.getSeconds();
        rateLimiter.clearAll();
        log.info("Config changed, altPermitsCapacity {} prechargedPeriodInSeconds {}",
                altPermitsCapacityCache, prechargedPeriodInSecondsCache);
    }


    @Override
    public void filter(ContainerRequestContext requestContext, Limit limit, String remoteIp, String target) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }

        // Rate limiter
        if (limit.requiredPermits() > 0) {
            if (!rateLimiter.tryAcquire(
                    target,
                    limit.requiredPermits(),
                    prechargedPeriodInSecondsCache,
                    altPermitsCapacityCache)) {
                throw new ApiException(
                        Response.Status.TOO_MANY_REQUESTS,
                        config.rateLimitedUserFacingMessage());
            }
        }

        // Challenge
        if (limit.challengeAfter() >= 0) {
            // Append request context to targe to make attempts resource independent
            String challengeTarget = target + "-" + requestContext.getUriInfo().getPath() + "-" + requestContext.getMethod();
            Optional<String> solutionOpt = Optional.ofNullable(Strings.emptyToNull(requestContext.getHeaderString(SOLUTION_HEADER)));
            Optional<String> newChallengeOpt = challengeLimiter.process(limit.challengeAfter(), remoteIp, challengeTarget, solutionOpt);
            if (newChallengeOpt.isPresent()) {
                throw new WebApplicationException(
                        "Request challenged",
                        Response.status(Response.Status.TOO_MANY_REQUESTS)
                                .type(MediaType.APPLICATION_JSON)
                                .header(CHALLENGE_HEADER, newChallengeOpt.get())
                                .entity(new ErrorResponse(config.challengedUserFacingMessage()))
                                .build());
            }
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Limiter.class).to(TieredWebLimiter.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
