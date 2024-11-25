// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import javax.ws.rs.core.Response;
import java.util.Optional;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

@Slf4j
public class SanitizerTest extends AbstractTest {

    private static final String PROJECT_ID = "my-project-id";

    @Inject
    private Sanitizer sanitizer;
    @Inject
    private ContentStore contentStoreMock;

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                Sanitizer.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(Sanitizer.Config.class, om -> {
                    om.override(om.id().htmlSanitizerEnabled()).withValue(true);
                }));
            }
        }));
    }

    @Before
    public void setup() throws Exception {
        super.setup();
        Mockito.when(contentStoreMock.getScheme()).thenReturn("https");
    }

    @Test(timeout = 10_000L)
    public void testAllFormats() throws Exception {
        String html = "<div><strong>  a</strong></div><div><s>b</s></div><div><em>c</em></div><div><u>d</u></div><div><br></div><div><br></div><ul><li>e</li><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>f</u></s></em></strong></a></li></ul><ol><li>g</li><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>h</u></s></em></strong></a></li></ol><ul data-checked=\"false\"><li>i</li></ul><ul data-checked=\"true\"><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>j</u></s></em></strong></a></li></ul><blockquote>k</blockquote><blockquote><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>l</u></s></em></strong></a></blockquote><pre class=\"ql-syntax\" spellcheck=\"false\">m\nn\n</pre><div><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a></div><div><br></div><div><br></div>";
        String expectedHtml = html
                // Quill is strongly for keeping HTML5 tag without trailing slash
                // while OWASP is strongly for interoperability with XHTML
                .replace("<br>", "<br />");
        assertSanitize("Expected same", expectedHtml, html);
    }

    @Test(timeout = 10_000L)
    public void testA() throws Exception {
        assertSanitize("Should be no change",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>");
        assertSanitize("Expected mailto protocol to be allowed and @ symbol to be escaped",
                "<a href=\"mailto:example&#64;example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"mailto:example@example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>");
        assertSanitize("Should be no change with tel protocol",
                "<a href=\"tel:12345678\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"tel:12345678\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>");

        assertSanitize("Uppercase element name should be lowercased",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<A href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>");

        assertSanitize("Expected protocol mismatch to drop a",
                "o",
                "<a href=\"javascript://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>");

        assertSanitize("Expected target to be replaced",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_not_blank\">o</a>");

        assertSanitize("Expected rel to be unchanged",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noopener ugc noreferrer\" target=\"_blank\">o</a>");
        assertSanitize("Expected rel to be updated",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener\" target=\"_blank\">o</a>");
        assertSanitize("Expected rel to be updated",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener  ugc\" target=\"_blank\">o</a>");
        assertSanitize("Expected rel to be updated",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a>",
                "<a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc nofollow\" target=\"_blank\">o</a>");
    }

    @Test(timeout = 10_000L)
    public void testToPlaintext() throws Exception {
        String html = "<div><strong>  a</strong></div><div><s>b</s></div><div><em>c</em></div><div><u>d</u></div><div><br></div><div><br></div><ul><li>e</li><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>f</u></s></em></strong></a></li></ul><ol><li>g</li><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>h</u></s></em></strong></a></li></ol><ul data-checked=\"false\"><li>i</li></ul><ul data-checked=\"true\"><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>j</u></s></em></strong></a></li></ul><blockquote>k</blockquote><blockquote><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\"><strong><em><s><u>l</u></s></em></strong></a></blockquote><pre class=\"ql-syntax\" spellcheck=\"false\">m\nn\n</pre><div><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noreferrer noopener ugc\" target=\"_blank\">o</a></div><div><br></div><div><br></div>";
        String expectedPlaintext = "  abcdefghijklm\nn\no";
        assertEquals(expectedPlaintext, sanitizer.richHtmlToPlaintext(html));
    }

    @Test(timeout = 10_000L)
    public void testMigratePToDiv() throws Exception {
        assertSanitize("Should be no change",
                "<div>a</div>",
                "<p>a</p>");
    }

    @Test(timeout = 10_000L)
    public void testDomain() throws Exception {
        assertSanitizeDomain("sandbox.smotana.com", false);
        assertSanitizeDomain("feedback.example.com", true);
    }

    @Test(timeout = 10_000L)
    public void testImg() throws Exception {
        String uploadDomain = "upload.clearflask.com";
        String signedQuery = "?signed";
        Mockito.when(contentStoreMock.signUrl(Mockito.anyString(), Mockito.anyString()))
                .thenAnswer(i -> {
                    String matchProjectId = i.getArgument(0);
                    String url = i.getArgument(1);
                    assertEquals(PROJECT_ID, matchProjectId);
                    if (url.startsWith("https://" + uploadDomain + "/" + matchProjectId + "/")) {
                        return Optional.of(url + signedQuery);
                    } else {
                        return Optional.empty();
                    }
                });

        assertSanitize("Should be signed",
                "o<img src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg" + signedQuery + "\" />",
                "o<img src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be signed, with all attributes",
                "o<img width=\"43\" align=\"right\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg" + signedQuery + "\" />",
                "o<img width=\"43\" align=\"right\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be signed, width attribute is allowed",
                "o<img width=\"43\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg" + signedQuery + "\" />",
                "o<img width=\"43\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be signed, with width attribute dropped",
                "o<img src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg" + signedQuery + "\" />",
                "o<img width=\"3oh\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be signed, align attribute is allowed",
                "o<img align=\"middle\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg" + signedQuery + "\" />",
                "o<img align=\"middle\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be signed, with align attribute dropped",
                "o<img src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg" + signedQuery + "\" />",
                "o<img align=\"center\" src=\"https://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be unsigned, projectId mismatch",
                "o",
                "o<img src=\"https://" + uploadDomain + "/some-other-project-id/user-id/image.jpeg\" />");
        assertSanitize("Should be unsigned, domain mismatch",
                "o",
                "o<img src=\"https://some.other.clearflask.com/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be unsigned, protocol mismatch",
                "o",
                "o<img src=\"http://" + uploadDomain + "/" + PROJECT_ID + "/user-id/image.jpeg\" />");
        assertSanitize("Should be unsigned, data url not allowed",
                "o",
                "o<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==\" />");
    }

    void assertSanitizeDomain(String domain, boolean expectFailure) {
        try {
            sanitizer.domain(domain, false);
            if (expectFailure) {
                fail("Expected failure");
            }
        } catch (ApiException ex) {
            if (ex.getStatus().getStatusCode() == Response.Status.INTERNAL_SERVER_ERROR.getStatusCode()) {
                // It's fine, test was probably performed without network connection
                return;
            }
            if (!expectFailure) {
                throw ex;
            }
        }
    }

    void assertSanitize(String message, String expHtml, String inpHtml) {
        assertEquals(message,
                expHtml.replaceAll("noreferrer|noopener|ugc", "{REL}"),
                sanitizer.richHtml(inpHtml, "msg", "'" + message + "'", PROJECT_ID, false)
                        // rel attribute is returned in random order
                        .replaceAll("noreferrer|noopener|ugc", "{REL}"));
    }
}
