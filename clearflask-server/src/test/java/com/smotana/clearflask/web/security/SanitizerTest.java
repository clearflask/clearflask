package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.testutil.AbstractTest;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class SanitizerTest extends AbstractTest {

    @Inject
    private Sanitizer sanitizer;

    @Override
    protected void configure() {
        super.configure();

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

    @Test(timeout = 10_000L)
    public void testAllFormats() throws Exception {
        String html = "<p><strong>  a</strong></p><p><s>b</s></p><p><em>c</em></p><p><u>d</u></p><p><br></p><p><br></p><ul><li>e</li><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noopener noreferrer\" target=\"_blank\"><strong><em><s><u>f</u></s></em></strong></a></li></ul><ol><li>g</li><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noopener noreferrer\" target=\"_blank\"><strong><em><s><u>h</u></s></em></strong></a></li></ol><ul data-checked=\"false\"><li>i</li></ul><ul data-checked=\"true\"><li class=\"ql-indent-1\"><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noopener noreferrer\" target=\"_blank\"><strong><em><s><u>j</u></s></em></strong></a></li></ul><blockquote>k</blockquote><blockquote><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noopener noreferrer\" target=\"_blank\"><strong><em><s><u>l</u></s></em></strong></a></blockquote><pre class=\"ql-syntax\" spellcheck=\"false\">m\n" +
                "n\n" +
                "</pre><p><a href=\"http://mock.localhost.com:3000/example.com\" rel=\"noopener noreferrer\" target=\"_blank\">o</a></p><p><br></p><p><br></p>";
        assertEquals(html, sanitizer.richHtml(html, "", ""));
    }


}