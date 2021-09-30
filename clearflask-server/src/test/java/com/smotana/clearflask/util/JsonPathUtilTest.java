package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Optional;

import static com.smotana.clearflask.util.JsonPathUtil.findFirstAsString;
import static org.junit.Assert.assertEquals;

@Slf4j
public class JsonPathUtilTest {

    @Test(timeout = 10_000L)
    public void testFindFirstAsString() throws Exception {
        // https://docs.github.com/en/rest/reference/users
        String input = "{\n" +
                "  \"login\": \"octocat\",\n" +
                "  \"id\": 1,\n" +
                "  \"node_id\": \"MDQ6VXNlcjE=\",\n" +
                "  \"avatar_url\": \"https://github.com/images/error/octocat_happy.gif\",\n" +
                "  \"gravatar_id\": \"\",\n" +
                "  \"url\": \"https://api.github.com/users/octocat\",\n" +
                "  \"html_url\": \"https://github.com/octocat\",\n" +
                "  \"followers_url\": \"https://api.github.com/users/octocat/followers\",\n" +
                "  \"following_url\": \"https://api.github.com/users/octocat/following{/other_user}\",\n" +
                "  \"gists_url\": \"https://api.github.com/users/octocat/gists{/gist_id}\",\n" +
                "  \"starred_url\": \"https://api.github.com/users/octocat/starred{/owner}{/repo}\",\n" +
                "  \"subscriptions_url\": \"https://api.github.com/users/octocat/subscriptions\",\n" +
                "  \"organizations_url\": \"https://api.github.com/users/octocat/orgs\",\n" +
                "  \"repos_url\": \"https://api.github.com/users/octocat/repos\",\n" +
                "  \"events_url\": \"https://api.github.com/users/octocat/events{/privacy}\",\n" +
                "  \"received_events_url\": \"https://api.github.com/users/octocat/received_events\",\n" +
                "  \"type\": \"User\",\n" +
                "  \"site_admin\": false,\n" +
                "  \"name\": \"monalisa octocat\",\n" +
                "  \"company\": \"GitHub\",\n" +
                "  \"blog\": \"https://github.com/blog\",\n" +
                "  \"location\": \"San Francisco\",\n" +
                "  \"email\": \"octocat@github.com\",\n" +
                "  \"hireable\": false,\n" +
                "  \"bio\": \"There once was...\",\n" +
                "  \"twitter_username\": \"monatheoctocat\",\n" +
                "  \"public_repos\": 2,\n" +
                "  \"public_gists\": 1,\n" +
                "  \"followers\": 20,\n" +
                "  \"following\": 0,\n" +
                "  \"created_at\": \"2008-01-14T04:33:35Z\",\n" +
                "  \"updated_at\": \"2008-01-14T04:33:35Z\",\n" +
                "  \"private_gists\": 81,\n" +
                "  \"total_private_repos\": 100,\n" +
                "  \"owned_private_repos\": 100,\n" +
                "  \"disk_usage\": 10000,\n" +
                "  \"collaborators\": 8,\n" +
                "  \"two_factor_authentication\": true,\n" +
                "  \"plan\": {\n" +
                "    \"name\": \"Medium\",\n" +
                "    \"space\": 400,\n" +
                "    \"private_repos\": 20,\n" +
                "    \"collaborators\": 0\n" +
                "  }\n" +
                "}\n";
        assertEquals(Optional.of("monalisa octocat"), findFirstAsString("['name','login']", input));
        assertEquals(Optional.of("octocat"), findFirstAsString("['login','name']", input));
        assertEquals(Optional.of("monalisa octocat"), findFirstAsString("['missing','name']", input));
        assertEquals(Optional.of("monalisa octocat"), findFirstAsString("['name','missing']", input));

        String input2 = "[\n" +
                "  {\n" +
                "    \"email\": \"octocat4@github.com\",\n" +
                "  },\n" +
                "  {\n" +
                "    \"email\": \"octocat3@github.com\",\n" +
                "    \"verified\": false,\n" +
                "    \"primary\": true,\n" +
                "    \"visibility\": \"public\"\n" +
                "  },\n" +
                "  {\n" +
                "    \"email\": \"octocat2@github.com\",\n" +
                "    \"verified\": true,\n" +
                "    \"primary\": false,\n" +
                "    \"visibility\": \"public\"\n" +
                "  },\n" +
                "  {\n" +
                "    \"email\": \"octocat@github.com\",\n" +
                "    \"verified\": true,\n" +
                "    \"primary\": true,\n" +
                "    \"visibility\": \"public\"\n" +
                "  }\n" +
                "]\n";
        assertEquals(Optional.of("octocat@github.com"), findFirstAsString("[?(@.verified == true)][?(@.primary == true)].email", input2));
    }
}
