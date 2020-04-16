package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.AccountFields;
import com.smotana.clearflask.api.model.Animation;
import com.smotana.clearflask.api.model.AnonymousSignup;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Content;
import com.smotana.clearflask.api.model.Credits;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.api.model.Layout;
import com.smotana.clearflask.api.model.Legal;
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
                        new Support(null, null, null, true),
                        new Tagging(ImmutableList.of(), ImmutableList.of()),
                        Category.VisibilityEnum.PUBLIC))),
                new Credits(1L, null),
                new Style(
                        new Animation(true),
                        new Palette(false, null, null, null, null, null, null, null),
                        new Typography(null, null)),
                new Users(
                        new Onboarding(
                                new AccountFields(AccountFields.DisplayNameEnum.NONE),
                                new NotificationMethods(new AnonymousSignup(true), true, false, null))),
                new Legal(null),
                null
        ), createConfigVersion());
    }

    public static String createConfigVersion() {
        return IdUtil.randomAscId();
    }
}
