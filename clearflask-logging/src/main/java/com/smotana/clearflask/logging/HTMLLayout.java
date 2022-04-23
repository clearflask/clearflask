// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.pattern.Converter;
import org.apache.commons.lang.StringEscapeUtils;

import static ch.qos.logback.core.CoreConstants.LINE_SEPARATOR;

public class HTMLLayout extends ch.qos.logback.classic.html.HTMLLayout {
    @Override
    public String doLayout(ILoggingEvent event) {
        StringBuilder buf = new StringBuilder();
        startNewTableIfLimitReached(buf);

        boolean odd = true;
        if (((counter++) & 1) == 0) {
            odd = false;
        }

        String level = event.getLevel().toString().toLowerCase();

        buf.append(LINE_SEPARATOR);
        buf.append("<tr class=\"");
        buf.append(level);
        if (odd) {
            buf.append(" odd\">");
        } else {
            buf.append(" even\">");
        }
        buf.append(LINE_SEPARATOR);

        Converter<ILoggingEvent> c = head;
        while (c != null) {
            appendEventToBuffer(buf, c, event);
            c = c.getNext();
        }
        buf.append("</tr>");
        buf.append(LINE_SEPARATOR);

        if (event.getThrowableProxy() != null) {
            getThrowableRenderer().render(buf, event);
        }
        return buf.toString();
    }

    private void appendEventToBuffer(StringBuilder buf,
                                     Converter<ILoggingEvent> c,
                                     ILoggingEvent event) {
        buf.append("<td class=\"");
        buf.append(computeConverterName(c));
        buf.append("\">");
        // c.write(buf, event);
        // Need to escape and wrap in <pre></pre>
        buf.append("<pre>");
        buf.append(StringEscapeUtils.escapeHtml(c.convert(event)));
        buf.append("</pre>");
        buf.append("</td>");
        buf.append(LINE_SEPARATOR);
    }
}
