package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.AccountFields;
import com.smotana.clearflask.api.model.AnonymousSignup;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Content;
import com.smotana.clearflask.api.model.EmailSignup;
import com.smotana.clearflask.api.model.Flow;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.api.model.Layout;
import com.smotana.clearflask.api.model.NotificationMethods;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.Palette;
import com.smotana.clearflask.api.model.Style;
import com.smotana.clearflask.api.model.Support;
import com.smotana.clearflask.api.model.Tagging;
import com.smotana.clearflask.api.model.Typography;
import com.smotana.clearflask.api.model.Users;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.api.model.Workflow;

public class ModelUtil {

    private ModelUtil() {
        // disable ctor
    }

    public static VersionedConfigAdmin createEmptyConfig(String projectId) {
        return new VersionedConfigAdmin(new ConfigAdmin(
                2L,
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
                                                EmailSignup.ModeEnum.SIGNUPANDLOGIN,
                                                EmailSignup.PasswordEnum.NONE,
                                                EmailSignup.VerificationEnum.NONE,
                                                null),
                                        null),
                                null)),
                null
        ), IdUtil.randomAscId());
    }
}
