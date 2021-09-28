// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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

@Slf4j
@Singleton
public class MarkdownAndQuillUtil {

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

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(MarkdownAndQuillUtil.class).asEagerSingleton();
            }
        };
    }
}
