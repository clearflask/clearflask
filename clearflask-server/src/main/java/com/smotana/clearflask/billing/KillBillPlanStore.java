package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.FeaturesTableFeatures;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPerk;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlanPricing.PeriodEnum;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.model.Catalogs;
import org.killbill.billing.client.model.gen.Catalog;
import org.killbill.billing.client.model.gen.Phase;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.client.model.gen.Usage;

import javax.ws.rs.core.Response;
import java.util.Comparator;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class KillBillPlanStore extends ManagedService implements PlanStore {
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_PRIVATE_PROJECTS = "Create a private project so only authorized users can view and provide feedback";
    private static final String TERMS_SSO = "Use your existing user accounts to log into ClearFlask";
    private static final String TERMS_SITE_TEMPLATE = "Use your own HTML template to display parts of the site";
    private static final ImmutableMap<String, Function<PlanPricing, Plan>> AVAILABLE_PLANS_BUILDER = ImmutableMap.<String, Function<PlanPricing, Plan>>builder()
            .put("growth-monthly", pp -> new Plan("growth-monthly", "Growth",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", null),
                    new PlanPerk("Credit System", null),
                    new PlanPerk("Roadmap", null)),
                    null, null))
            .put("standard-monthly", pp -> new Plan("standard-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Single Sign-On", TERMS_SSO),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("Site template", TERMS_SITE_TEMPLATE)),
                    null, null))
            .build();
    private static final ImmutableList<Plan> AVAILABLE_PLANS_STATIC_BUILDER = ImmutableList.of(
            new Plan("flat-yearly", "Flat",
                    null, ImmutableList.of(
                    new PlanPerk("Predictable annual price", null),
                    new PlanPerk("Tailored plan", null)),
                    null, null)
    );
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Growth", "Standard"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Roadmap view", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Content customization", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Private projects", ImmutableList.of("No", "Yes"), TERMS_PRIVATE_PROJECTS),
                    new FeaturesTableFeatures("Single Sign-On", ImmutableList.of("No", "Yes"), TERMS_SSO),
                    new FeaturesTableFeatures("Site template", ImmutableList.of("No", "Yes"), TERMS_SITE_TEMPLATE)
            ), null);

    @Inject
    private Billing billing;
    @Inject
    private CatalogApi catalogApi;

    private ImmutableMap<String, Plan> availablePlans;
    private PlansGetResponse plansGetResponse;

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(KillBillSync.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        Catalogs catalogs = catalogApi.getCatalogJson(null, null, KillBillUtil.roDefault());
        Catalog catalog = catalogs.stream().max(Comparator.comparing(Catalog::getEffectiveDate)).get();
        ImmutableList<Plan> plans = AVAILABLE_PLANS_BUILDER.entrySet().stream().map(e -> {
            // Oh god this is just terrible, this is what happens when you check in at 4am
            String planName = e.getKey();
            org.killbill.billing.client.model.gen.Plan plan = catalog.getProducts().stream()
                    .flatMap(p -> p.getPlans().stream())
                    .filter(p -> planName.equals(p.getName()))
                    .findAny()
                    .get();
            Phase evergreen = plan.getPhases().stream().filter(p -> PhaseType.EVERGREEN.name().equals(p.getType())).findAny().get();
            long basePrice = evergreen.getPrices().get(0).getValue().longValueExact();
            Usage usage = evergreen.getUsages().get(0);
            PeriodEnum period;
            if (BillingPeriod.MONTHLY.name().equals(usage.getBillingPeriod())) {
                period = PeriodEnum.MONTHLY;
            } else {
                period = PeriodEnum.YEARLY;
            }
            long baseMau = Double.valueOf(usage.getTiers().get(0).getBlocks().get(0).getSize()).longValue();
            long unitPrice = usage.getTiers().get(1).getBlocks().get(0).getPrices().get(0).getValue().longValueExact();
            long unitMau = Double.valueOf(usage.getTiers().get(1).getBlocks().get(0).getSize()).longValue();
            PlanPricing planPricing = PlanPricing.builder()
                    .basePrice(basePrice)
                    .baseMau(baseMau)
                    .unitPrice(unitPrice)
                    .unitMau(unitMau)
                    .period(period)
                    .build();
            return e.getValue().apply(planPricing);
        }).collect(ImmutableList.toImmutableList());
        availablePlans = Stream.concat(plans.stream(), AVAILABLE_PLANS_STATIC_BUILDER.stream())
                .collect(ImmutableMap.toImmutableMap(
                        Plan::getPlanid,
                        p -> p));
        plansGetResponse = new PlansGetResponse(
                availablePlans.values().asList(),
                FEATURES_TABLE);
    }

    @Extern
    @Override
    public PlansGetResponse getPublicPlans() {
        return plansGetResponse;
    }

    @Extern
    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        Subscription subscription = billing.getSubscription(accountId);
        String planToChangeFrom = billing.getEndOfTermChangeToPlanId(subscription)
                .orElse(subscription.getPlanName());
        switch (planToChangeFrom) {
            case "growth-monthly":
            case "standard-monthly":
                return ImmutableSet.of(
                        availablePlans.get("growth-monthly"),
                        availablePlans.get("standard-monthly"));
            default:
                return ImmutableSet.of();
        }
    }

    @Extern
    @Override
    public Optional<Plan> getPlan(String planId) {
        return Optional.ofNullable(availablePlans.get(planId));
    }

    /** If changed, also change in UpgradeWrapper.tsx */
    @Override
    public void verifyConfigMeetsPlanRestrictions(String planId, ConfigAdmin config) throws ErrorWithMessageException {
        switch (planId) {
            case "growth-monthly":
                // Restrict Single Sign-On
                if (config.getUsers().getOnboarding().getNotificationMethods().getSso() != null) {
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Not allowed to use SSO with your plan");
                }
                // Restrict Private projects
                if (config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Not allowed to use Private visibility with your plan");
                }
                // Restrict Site template
                if (config.getStyle().getTemplates() != null) {
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Not allowed to use Templates with your plan");
                }
                break;
            case "standard-monthly":
            default:
                break;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanStore.class).to(KillBillPlanStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBillPlanStore.class);
            }
        };
    }
}
