// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package org.kohsuke.github;

import lombok.SneakyThrows;

import java.lang.reflect.Field;

public class GitHubClientUtil {
    /**
     * Some GitHub client objects need to change authorization between user, app or installation
     * including GHAppInstallation.
     * <p>
     * No longer a package pricate field, using reflection now.
     * <p>
     * See https://github.com/hub4j/github-api/issues/1082
     */
    @SneakyThrows
    public static <T extends GitHubInteractiveObject> void setRoot(T githubObj, GitHub root) {
        Field field = githubObj.getClass().getDeclaredField("root");
        field.setAccessible(true);
        Field modifiersField = Field.class.getDeclaredField("modifiers");
        modifiersField.setAccessible(true);
        modifiersField.setInt(field, field.getModifiers() & ~java.lang.reflect.Modifier.FINAL); // Remove final modifier
        field.set(githubObj, root);
    }
}
