package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.*;

public class ModelUtil {

    private ModelUtil() {
        // disable ctor
    }

    public static VersionedConfigAdmin createEmptyConfig(String projectId) {
        return new VersionedConfigAdmin(new ConfigAdmin(
                projectId,
                null,
                projectId,
                null,
                projectId,
                new Layout(ImmutableList.of(), ImmutableList.of()),
                new Content(ImmutableList.of(new Category(
                        IdUtil.randomId(),
                        "My category",
                        "#aabbdd",
                        true,
                        new Workflow(null, ImmutableList.of(
                                new IdeaStatus(IdUtil.randomId(), "COMPLETE", null, "#bbddaa", false, false, false, false, false)
                        )),
                        new Support(false, null, null, true),
                        new Tagging(ImmutableList.of(), ImmutableList.of())))),
                new Style(
                        new Flow(true),
                        new Palette(false, null, null, null, null, null, null),
                        new Typography(null, null),
                        null),
                new Users(
                        null,
                        new Onboarding(
                                Onboarding.VisibilityEnum.PUBLIC,
                                new AccountFields(AccountFields.DisplayNameEnum.NONE),
                                new NotificationMethods(
                                        new AnonymousSignup(false),
                                        true,
                                        new EmailSignup(
                                                EmailSignup.PasswordEnum.NONE,
                                                EmailSignup.VerificationEnum.NONE,
                                                null),
                                        null),
                                null)),
                null
        ), IdUtil.randomAscId());
    }
}
