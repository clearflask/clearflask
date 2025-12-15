// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.*;

public class ModelUtil {

    private ModelUtil() {
        // disable ctor
    }

    public static VersionedConfigAdmin createEmptyConfig(String projectId) {
        return new VersionedConfigAdmin(new ConfigAdmin(
                5L,
                projectId,
                null,
                projectId,
                null,
                projectId,
                null,
                null,
                null,
                null,
                new CookieConsent(null, null),
                new Layout(null, ImmutableList.of(), ImmutableList.of()),
                new Content(ImmutableList.of(Category.builder()
                        .categoryId(IdUtil.randomId())
                        .name("My category")
                        .color("#aabbdd")
                        .userCreatable(true)
                        .workflow(new Workflow(null, ImmutableList.of(
                                new IdeaStatus(IdUtil.randomId(), "COMPLETE", null, "#bbddaa", false, false, false, false, false, false)
                        )))
                        .support(new Support(true, new Voting(true, null), new Expressing(true, null), true))
                        .tagging(new Tagging(ImmutableList.of(), ImmutableList.of()))
                        .build())),
                new Style(
                        new Flow(true),
                        new Palette(false, null, null, null, null, null, null),
                        new Typography(null, null),
                        null,
                        new Whitelabel(Whitelabel.PoweredByEnum.SHOW)),
                new Users(
                        null,
                        new Onboarding(
                                Onboarding.VisibilityEnum.PUBLIC,
                                new AccountFields(AccountFields.DisplayNameEnum.NONE),
                                new NotificationMethods(
                                        new AnonymousSignup(false),
                                        true,
                                        new EmailSignup(
                                                EmailSignup.ModeEnum.SIGNUPANDLOGIN,
                                                EmailSignup.PasswordEnum.NONE,
                                                EmailSignup.VerificationEnum.NONE,
                                                null),
                                        null,
                                        ImmutableList.of()),
                                null)),
                new Integrations(null, null, null),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null  // forceSearchEngine
        ), IdUtil.randomAscId());
    }
}
