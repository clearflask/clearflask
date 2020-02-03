package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.AccountFields;
import com.smotana.clearflask.api.model.Animation;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Content;
import com.smotana.clearflask.api.model.Credits;
import com.smotana.clearflask.api.model.Layout;
import com.smotana.clearflask.api.model.NotificationMethods;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.Palette;
import com.smotana.clearflask.api.model.Style;
import com.smotana.clearflask.api.model.Typography;
import com.smotana.clearflask.api.model.Users;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;

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
                new Content(ImmutableList.of()),
                new Credits(1L, null),
                new Style(
                        new Animation(true),
                        new Palette(false, null, null, null, null, null, null, null),
                        new Typography(null, null)),
                new Users(
                        new Onboarding(
                                new AccountFields(AccountFields.DisplayNameEnum.NONE),
                                new NotificationMethods(null, true, false, null))),
                null
        ), createConfigVersion());
    }

    public static String createConfigVersion() {
        return String.valueOf(System.currentTimeMillis());
    }
}
