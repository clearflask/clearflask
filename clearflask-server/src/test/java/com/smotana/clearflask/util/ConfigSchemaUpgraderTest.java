// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
public class ConfigSchemaUpgraderTest extends AbstractTest {

    private static final String SAMPLE_SCHEMA_VERSION_ONE = "{\n" +
            "  \"content\": {\n" +
            "    \"categories\": [\n" +
            "      {\n" +
            "        \"categoryId\": \"0da41b6a-15c8-4f12-a61e-9bc4ab7b4fc9\",\n" +
            "        \"name\": \"Post\",\n" +
            "        \"userCreatable\": true,\n" +
            "        \"workflow\": {\n" +
            "          \"statuses\": [\n" +
            "            {\n" +
            "              \"statusId\": \"dc029a95-4c65-490f-ba3a-f9b1c38c2a89\",\n" +
            "              \"name\": \"Closed\",\n" +
            "              \"nextStatusIds\": [],\n" +
            "              \"color\": \"#B44A4B\",\n" +
            "              \"disableFunding\": true,\n" +
            "              \"disableVoting\": false,\n" +
            "              \"disableExpressions\": false,\n" +
            "              \"disableIdeaEdits\": false,\n" +
            "              \"disableComments\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"statusId\": \"986964b0-13fe-43a5-9db6-8ec4d5ed5cde\",\n" +
            "              \"name\": \"Completed\",\n" +
            "              \"nextStatusIds\": [],\n" +
            "              \"color\": \"#3A8E31\",\n" +
            "              \"disableFunding\": true,\n" +
            "              \"disableVoting\": false,\n" +
            "              \"disableExpressions\": false,\n" +
            "              \"disableIdeaEdits\": true,\n" +
            "              \"disableComments\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"statusId\": \"dc2ccabf-6346-41f1-bb97-dda649194164\",\n" +
            "              \"name\": \"In progress\",\n" +
            "              \"nextStatusIds\": [\n" +
            "                \"dc029a95-4c65-490f-ba3a-f9b1c38c2a89\",\n" +
            "                \"986964b0-13fe-43a5-9db6-8ec4d5ed5cde\"\n" +
            "              ],\n" +
            "              \"color\": \"#AE9031\",\n" +
            "              \"disableFunding\": true,\n" +
            "              \"disableVoting\": false,\n" +
            "              \"disableExpressions\": false,\n" +
            "              \"disableIdeaEdits\": true,\n" +
            "              \"disableComments\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"statusId\": \"63a2165c-3294-446c-9f94-752c4b695444\",\n" +
            "              \"name\": \"Planned\",\n" +
            "              \"nextStatusIds\": [\n" +
            "                \"dc029a95-4c65-490f-ba3a-f9b1c38c2a89\",\n" +
            "                \"dc2ccabf-6346-41f1-bb97-dda649194164\"\n" +
            "              ],\n" +
            "              \"color\": \"#3B67AE\",\n" +
            "              \"disableFunding\": false,\n" +
            "              \"disableVoting\": false,\n" +
            "              \"disableExpressions\": false,\n" +
            "              \"disableIdeaEdits\": true,\n" +
            "              \"disableComments\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"statusId\": \"d25e9062-f48a-41cb-bc4d-d42b8060feb7\",\n" +
            "              \"name\": \"Under review\",\n" +
            "              \"nextStatusIds\": [\n" +
            "                \"79d3652f-a939-405b-aba1-8dcb075704d3\",\n" +
            "                \"dc029a95-4c65-490f-ba3a-f9b1c38c2a89\",\n" +
            "                \"63a2165c-3294-446c-9f94-752c4b695444\"\n" +
            "              ],\n" +
            "              \"color\": \"#3B67AE\",\n" +
            "              \"disableFunding\": false,\n" +
            "              \"disableVoting\": false,\n" +
            "              \"disableExpressions\": false,\n" +
            "              \"disableIdeaEdits\": false,\n" +
            "              \"disableComments\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"statusId\": \"79d3652f-a939-405b-aba1-8dcb075704d3\",\n" +
            "              \"name\": \"Funding\",\n" +
            "              \"nextStatusIds\": [\n" +
            "                \"dc029a95-4c65-490f-ba3a-f9b1c38c2a89\",\n" +
            "                \"63a2165c-3294-446c-9f94-752c4b695444\"\n" +
            "              ],\n" +
            "              \"color\": \"#3B67AE\",\n" +
            "              \"disableFunding\": false,\n" +
            "              \"disableVoting\": false,\n" +
            "              \"disableExpressions\": false,\n" +
            "              \"disableIdeaEdits\": true,\n" +
            "              \"disableComments\": false\n" +
            "            }\n" +
            "          ],\n" +
            "          \"entryStatus\": \"d25e9062-f48a-41cb-bc4d-d42b8060feb7\"\n" +
            "        },\n" +
            "        \"support\": {\n" +
            "          \"fund\": true,\n" +
            "          \"vote\": {\n" +
            "            \"enableDownvotes\": false\n" +
            "          },\n" +
            "          \"express\": {\n" +
            "            \"limitEmojiPerIdea\": true\n" +
            "          },\n" +
            "          \"comment\": true\n" +
            "        },\n" +
            "        \"tagging\": {\n" +
            "          \"tags\": [\n" +
            "            {\n" +
            "              \"tagId\": \"e74000fa-7192-48cc-ae42-81c2c07550e6\",\n" +
            "              \"name\": \"Idea\"\n" +
            "            },\n" +
            "            {\n" +
            "              \"tagId\": \"e0c114c9-6f01-4262-a408-60bde490ef91\",\n" +
            "              \"name\": \"Bug\"\n" +
            "            }\n" +
            "          ],\n" +
            "          \"tagGroups\": [\n" +
            "            {\n" +
            "              \"tagGroupId\": \"12b8ca67-fd46-4515-9622-40c12a4619b2\",\n" +
            "              \"name\": \"Type\",\n" +
            "              \"maxRequired\": 1,\n" +
            "              \"userSettable\": true,\n" +
            "              \"tagIds\": [\n" +
            "                \"e74000fa-7192-48cc-ae42-81c2c07550e6\",\n" +
            "                \"e0c114c9-6f01-4262-a408-60bde490ef91\"\n" +
            "              ]\n" +
            "            }\n" +
            "          ]\n" +
            "        }\n" +
            "      }\n" +
            "    ]\n" +
            "  },\n" +
            "  \"layout\": {\n" +
            "    \"pages\": [\n" +
            "      {\n" +
            "        \"pageId\": \"6170fefc-8161-432c-a2de-304b647a74cf\",\n" +
            "        \"name\": \"Roadmap\",\n" +
            "        \"slug\": \"roadmap\",\n" +
            "        \"panels\": [],\n" +
            "        \"board\": {\n" +
            "          \"title\": \"Roadmap\",\n" +
            "          \"panels\": [\n" +
            "            {\n" +
            "              \"title\": \"Funding\",\n" +
            "              \"search\": {\n" +
            "                \"sortBy\": \"New\",\n" +
            "                \"filterCategoryIds\": [\n" +
            "                  \"0da41b6a-15c8-4f12-a61e-9bc4ab7b4fc9\"\n" +
            "                ],\n" +
            "                \"filterStatusIds\": [\n" +
            "                  \"79d3652f-a939-405b-aba1-8dcb075704d3\"\n" +
            "                ]\n" +
            "              },\n" +
            "              \"display\": {\n" +
            "                \"titleTruncateLines\": 1,\n" +
            "                \"descriptionTruncateLines\": 0,\n" +
            "                \"responseTruncateLines\": 0,\n" +
            "                \"showCommentCount\": false,\n" +
            "                \"showCategoryName\": false,\n" +
            "                \"showCreated\": false,\n" +
            "                \"showAuthor\": false,\n" +
            "                \"showStatus\": false,\n" +
            "                \"showTags\": false,\n" +
            "                \"showVoting\": false,\n" +
            "                \"showFunding\": true,\n" +
            "                \"showExpression\": false\n" +
            "              },\n" +
            "              \"hideIfEmpty\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"title\": \"Planned\",\n" +
            "              \"search\": {\n" +
            "                \"sortBy\": \"New\",\n" +
            "                \"filterCategoryIds\": [\n" +
            "                  \"0da41b6a-15c8-4f12-a61e-9bc4ab7b4fc9\"\n" +
            "                ],\n" +
            "                \"filterStatusIds\": [\n" +
            "                  \"63a2165c-3294-446c-9f94-752c4b695444\"\n" +
            "                ]\n" +
            "              },\n" +
            "              \"display\": {\n" +
            "                \"titleTruncateLines\": 1,\n" +
            "                \"descriptionTruncateLines\": 0,\n" +
            "                \"responseTruncateLines\": 0,\n" +
            "                \"showCommentCount\": false,\n" +
            "                \"showCategoryName\": false,\n" +
            "                \"showCreated\": false,\n" +
            "                \"showAuthor\": false,\n" +
            "                \"showStatus\": false,\n" +
            "                \"showTags\": false,\n" +
            "                \"showVoting\": false,\n" +
            "                \"showFunding\": false,\n" +
            "                \"showExpression\": false\n" +
            "              },\n" +
            "              \"hideIfEmpty\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"title\": \"In progress\",\n" +
            "              \"search\": {\n" +
            "                \"sortBy\": \"New\",\n" +
            "                \"filterCategoryIds\": [\n" +
            "                  \"0da41b6a-15c8-4f12-a61e-9bc4ab7b4fc9\"\n" +
            "                ],\n" +
            "                \"filterStatusIds\": [\n" +
            "                  \"dc2ccabf-6346-41f1-bb97-dda649194164\"\n" +
            "                ]\n" +
            "              },\n" +
            "              \"display\": {\n" +
            "                \"titleTruncateLines\": 1,\n" +
            "                \"descriptionTruncateLines\": 0,\n" +
            "                \"responseTruncateLines\": 0,\n" +
            "                \"showCommentCount\": false,\n" +
            "                \"showCategoryName\": false,\n" +
            "                \"showCreated\": false,\n" +
            "                \"showAuthor\": false,\n" +
            "                \"showStatus\": false,\n" +
            "                \"showTags\": false,\n" +
            "                \"showVoting\": false,\n" +
            "                \"showFunding\": false,\n" +
            "                \"showExpression\": false\n" +
            "              },\n" +
            "              \"hideIfEmpty\": false\n" +
            "            },\n" +
            "            {\n" +
            "              \"title\": \"Completed\",\n" +
            "              \"search\": {\n" +
            "                \"sortBy\": \"New\",\n" +
            "                \"filterCategoryIds\": [\n" +
            "                  \"0da41b6a-15c8-4f12-a61e-9bc4ab7b4fc9\"\n" +
            "                ],\n" +
            "                \"filterStatusIds\": [\n" +
            "                  \"986964b0-13fe-43a5-9db6-8ec4d5ed5cde\"\n" +
            "                ]\n" +
            "              },\n" +
            "              \"display\": {\n" +
            "                \"titleTruncateLines\": 1,\n" +
            "                \"descriptionTruncateLines\": 0,\n" +
            "                \"responseTruncateLines\": 0,\n" +
            "                \"showCommentCount\": false,\n" +
            "                \"showCategoryName\": false,\n" +
            "                \"showCreated\": false,\n" +
            "                \"showAuthor\": false,\n" +
            "                \"showStatus\": false,\n" +
            "                \"showTags\": false,\n" +
            "                \"showVoting\": false,\n" +
            "                \"showFunding\": false,\n" +
            "                \"showExpression\": false\n" +
            "              },\n" +
            "              \"hideIfEmpty\": false\n" +
            "            }\n" +
            "          ]\n" +
            "        }\n" +
            "      },\n" +
            "      {\n" +
            "        \"pageId\": \"12b68e05-5bda-4077-b15c-68dc3eb1980f\",\n" +
            "        \"name\": \"Feedback\",\n" +
            "        \"slug\": \"feedback\",\n" +
            "        \"panels\": [],\n" +
            "        \"explorer\": {\n" +
            "          \"search\": {\n" +
            "            \"sortBy\": \"Trending\",\n" +
            "            \"filterCategoryIds\": [\n" +
            "              \"0da41b6a-15c8-4f12-a61e-9bc4ab7b4fc9\"\n" +
            "            ]\n" +
            "          },\n" +
            "          \"display\": {},\n" +
            "          \"allowSearch\": {\n" +
            "            \"enableSort\": true,\n" +
            "            \"enableSearchText\": true,\n" +
            "            \"enableSearchByCategory\": true,\n" +
            "            \"enableSearchByStatus\": true,\n" +
            "            \"enableSearchByTag\": true\n" +
            "          },\n" +
            "          \"allowCreate\": {\n" +
            "            \"actionTitle\": \"Suggest\",\n" +
            "            \"actionTitleLong\": \"Suggest an idea\"\n" +
            "          }\n" +
            "        }\n" +
            "      }\n" +
            "    ],\n" +
            "    \"menu\": [\n" +
            "      {\n" +
            "        \"menuId\": \"978ad8f2-6325-4306-a8dd-e67f18409e32\",\n" +
            "        \"pageIds\": [\n" +
            "          \"6170fefc-8161-432c-a2de-304b647a74cf\"\n" +
            "        ]\n" +
            "      },\n" +
            "      {\n" +
            "        \"menuId\": \"6eb858b8-a337-4a96-a1fb-8bee9db7f743\",\n" +
            "        \"pageIds\": [\n" +
            "          \"12b68e05-5bda-4077-b15c-68dc3eb1980f\"\n" +
            "        ]\n" +
            "      }\n" +
            "    ]\n" +
            "  },\n" +
            "  \"users\": {\n" +
            "    \"onboarding\": {\n" +
            "      \"visibility\": \"Public\",\n" +
            "      \"notificationMethods\": {\n" +
            "        \"browserPush\": true,\n" +
            "        \"email\": {\n" +
            "          \"mode\": \"SignupAndLogin\",\n" +
            "          \"password\": \"None\",\n" +
            "          \"verification\": \"None\"\n" +
            "        },\n" +
            "        \"sso\": {\n" +
            "          \"redirectUrl\": \"http://localhost:3000/login?cfr=<return_uri>\",\n" +
            "          \"buttonTitle\": \"ClearFlask\"\n" +
            "        }\n" +
            "      },\n" +
            "      \"accountFields\": {\n" +
            "        \"displayName\": \"None\"\n" +
            "      }\n" +
            "    },\n" +
            "    \"credits\": {\n" +
            "      \"formats\": [\n" +
            "        {\n" +
            "          \"greaterOrEqual\": 10000,\n" +
            "          \"multiplier\": 0.01,\n" +
            "          \"maximumFractionDigits\": 2,\n" +
            "          \"prefix\": \"$\"\n" +
            "        },\n" +
            "        {\n" +
            "          \"greaterOrEqual\": 100,\n" +
            "          \"multiplier\": 0.01,\n" +
            "          \"minimumFractionDigits\": 2,\n" +
            "          \"prefix\": \"$\"\n" +
            "        },\n" +
            "        {\n" +
            "          \"lessOrEqual\": 0,\n" +
            "          \"prefix\": \"$\"\n" +
            "        },\n" +
            "        {\n" +
            "          \"prefix\": \"¢\"\n" +
            "        }\n" +
            "      ]\n" +
            "    }\n" +
            "  },\n" +
            "  \"style\": {\n" +
            "    \"animation\": {\n" +
            "      \"enableTransitions\": true\n" +
            "    },\n" +
            "    \"palette\": {\n" +
            "      \"darkMode\": false,\n" +
            "      \"background\": \"#ffffff\"\n" +
            "    },\n" +
            "    \"templates\": {\n" +
            "      \"pages\": []\n" +
            "    },\n" +
            "    \"typography\": {}\n" +
            "  },\n" +
            "  \"projectId\": \"mock\",\n" +
            "  \"name\": \"Sandbox App\",\n" +
            "  \"slug\": \"mock\",\n" +
            "  \"ssoSecretKey\": \"63195fc1-d8c0-4909-9039-e15ce3c96dce\",\n" +
            "  \"hideLang\": true\n" +
            "}";

    @Inject
    private Gson gson;
    @Inject
    private ConfigSchemaUpgrader upgrader;

    @Override
    protected void configure() {
        super.configure();

        install(GsonProvider.module());
    }

    @Test(timeout = 10_000L)
    public void testUpgrade() throws Exception {
        Optional<String> configJsonUpgradedOpt = upgrader.upgrade(SAMPLE_SCHEMA_VERSION_ONE);
        assertTrue(configJsonUpgradedOpt.isPresent());
        log.info("Upgraded json: {}", configJsonUpgradedOpt.get());

        ConfigAdmin config = gson.fromJson(configJsonUpgradedOpt.get(), ConfigAdmin.class);
        assertUpgraded(config);

        Optional<String> configJsonSameOpt = upgrader.upgrade(gson.toJson(config));
        assertFalse(configJsonSameOpt.isPresent());
    }

    @Test(timeout = 10_000L)
    public void testUpgradeViaGson() throws Exception {
        ConfigAdmin config = gson.fromJson(SAMPLE_SCHEMA_VERSION_ONE, ConfigAdmin.class);
        assertUpgraded(config);
    }

    void assertUpgraded(ConfigAdmin config) throws Exception {
        assertEquals(EmailSignup.ModeEnum.SIGNUPANDLOGIN, config.getUsers().getOnboarding().getNotificationMethods().getEmail().getMode());
        assertEquals(Integrations.builder().build(), config.getIntegrations());
        assertEquals(Whitelabel.builder()
                .poweredBy(Whitelabel.PoweredByEnum.SHOW)
                .build(), config.getStyle().getWhitelabel());
        assertEquals(CookieConsent.builder().build(), config.getCookieConsent());
        assertEquals(ImmutableList.of(), config.getLangWhitelist().getLangs());
        assertEquals(ImmutableList.of(), config.getStyle().getTemplates().getPageFooters());
    }
}