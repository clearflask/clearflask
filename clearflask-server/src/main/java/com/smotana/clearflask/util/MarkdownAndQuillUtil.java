// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.web.security.Sanitizer;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter;
import com.vladsch.flexmark.parser.Parser;
import lombok.extern.slf4j.Slf4j;

import java.util.regex.Matcher;

@Slf4j
@Singleton
public class MarkdownAndQuillUtil {

    private static final String MARKDOWN_BLOCKQUOTE_PREFIX = "> ";

    @Inject
    private Sanitizer sanitizer;

    private final Parser parser = Parser.builder().build();
    private final HtmlRenderer renderer = HtmlRenderer.builder().build();
    private final FlexmarkHtmlConverter converter = FlexmarkHtmlConverter.builder().build();

    public String markdownToQuill(String projectId, String identifierType, String identifierId, String markdown) {
        return sanitizer.richHtml(
                renderer.render(parser.parse(markdown)),
                identifierType,
                identifierId,
                projectId,
                true);
    }

    public String quillToMarkdown(String html) {
        return converter.convert(html);
    }

    public String markdownSign(String name, String action, String markdown) {
        return "**" + name + "** " + action + ":\n\n" + markdown;
    }

    public String markdownQuote(String markdown) {
        return "\n"
                + MARKDOWN_BLOCKQUOTE_PREFIX + markdown.replaceAll("(?:\r\n?|\n)(?!\\z)", "$0" + Matcher.quoteReplacement(MARKDOWN_BLOCKQUOTE_PREFIX))
                + "\n";
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(MarkdownAndQuillUtil.class).asEagerSingleton();
            }
        };
    }
}
