// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package org.kohsuke.github;

public class GitHubClientUtil {
    /**
     * Some GitHub client objects need to change authorization between user, app or installation
     * including GHAppInstallation.
     *
     * See https://github.com/hub4j/github-api/issues/1082
     */
    public static <T extends GitHubInteractiveObject> void setRoot(T githubObj, GitHub root) {
        githubObj.root = root;
    }
}
