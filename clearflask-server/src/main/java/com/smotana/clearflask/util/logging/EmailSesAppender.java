package com.smotana.clearflask.util.logging;

import ch.qos.logback.classic.net.SMTPAppender;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.helpers.CyclicBuffer;
import ch.qos.logback.core.pattern.PatternLayoutBase;
import ch.qos.logback.core.util.ContentTypeUtil;
import com.amazonaws.services.simpleemail.AmazonSimpleEmailServiceClient;
import com.amazonaws.services.simpleemail.model.RawMessage;
import com.amazonaws.services.simpleemail.model.SendRawEmailRequest;
import com.google.common.base.Charsets;

import javax.mail.Multipart;
import javax.mail.internet.AddressException;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Properties;

public class EmailSesAppender extends SMTPAppender {
    public static final String CONFIG_AWS_SES_LOGBACK_CREDS = "awsSesLogback";
    private static final InternetAddress[] EMPTY_IA_ARRAY = new InternetAddress[0];
    private static final String charsetEncoding = "UTF-8";
    private static final Properties defaultProperties = new Properties();
    private AmazonSimpleEmailServiceClient ses;

    InternetAddress getAddress(String addressStr) {
        try {
            return new InternetAddress(addressStr);
        } catch (AddressException e) {
            addError("Could not parse address [" + addressStr + "].", e);
            return null;
        }
    }

    private List<InternetAddress> parseAddress(ILoggingEvent event) {
        int len = getToList().size();

        List<InternetAddress> iaList = new ArrayList<InternetAddress>();

        for (int i = 0; i < len; i++) {
            try {
                PatternLayoutBase<ILoggingEvent> emailPL = getToList().get(i);
                String emailAdrr = emailPL.doLayout(event);
                if (emailAdrr == null || emailAdrr.length() == 0) {
                    continue;
                }
                InternetAddress[] tmp = InternetAddress.parse(emailAdrr, true);
                iaList.addAll(Arrays.asList(tmp));
            } catch (AddressException e) {
                addError("Could not parse email address for [" + getToList().get(i) + "] for event [" + event + "]", e);
                return iaList;
            }
        }

        return iaList;
    }

    @Override
    protected void sendBuffer(CyclicBuffer<ILoggingEvent> cb, ILoggingEvent lastEventObject) {
        // Note: this code already owns the monitor for this
        // appender. This frees us from needing to synchronize on 'cb'.
        try {
            if (ses == null) {
                synchronized (this) {
                    if (ses == null) {
                        ses = new AmazonSimpleEmailServiceClient();
                    }
                }
            }

            MimeBodyPart part = new MimeBodyPart();

            StringBuffer sbuf = new StringBuffer();

            String header = layout.getFileHeader();
            if (header != null) {
                sbuf.append(header);
            }
            String presentationHeader = layout.getPresentationHeader();
            if (presentationHeader != null) {
                sbuf.append(presentationHeader);
            }
            fillBuffer(cb, sbuf);
            String presentationFooter = layout.getPresentationFooter();
            if (presentationFooter != null) {
                sbuf.append(presentationFooter);
            }
            String footer = layout.getFileFooter();
            if (footer != null) {
                sbuf.append(footer);
            }

            String subjectStr = "Undefined subject";
            if (subjectLayout != null) {
                subjectStr = subjectLayout.doLayout(lastEventObject);

                // The subject must not contain new-line characters, which cause
                // an SMTP error (LOGBACK-865). Truncate the string at the first
                // new-line character.
                int newLinePos = (subjectStr != null) ? subjectStr.indexOf('\n') : -1;
                if (newLinePos > -1) {
                    subjectStr = subjectStr.substring(0, newLinePos);
                }
            }

            MimeMessage mimeMsg = new MimeMessage(session);

            if (getFrom() != null) {
                mimeMsg.setFrom(getAddress(getFrom()));
            } else {
                mimeMsg.setFrom();
            }

            mimeMsg.setSubject(subjectStr, charsetEncoding);

            List<InternetAddress> destinationAddresses = parseAddress(lastEventObject);
            if (destinationAddresses.isEmpty()) {
                addInfo("Empty destination address. Aborting email transmission");
                return;
            }

            InternetAddress[] toAddressArray = destinationAddresses.toArray(EMPTY_IA_ARRAY);
            mimeMsg.setRecipients(javax.mail.Message.RecipientType.TO, toAddressArray);

            String contentType = layout.getContentType();

            if (ContentTypeUtil.isTextual(contentType)) {
                part.setText(sbuf.toString(), charsetEncoding, ContentTypeUtil.getSubType(contentType));
            } else {
                part.setContent(sbuf.toString(), layout.getContentType());
            }

            Multipart mp = new MimeMultipart();
            mp.addBodyPart(part);
            mimeMsg.setContent(mp);

            mimeMsg.setSentDate(new Date());
            addInfo("About to send out SMTP message \"" + subjectStr + "\" to " + Arrays.toString(toAddressArray));

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                mimeMsg.writeTo(out);

                RawMessage rm = new RawMessage();
                rm.setData(ByteBuffer.wrap(out.toString().getBytes(Charsets.UTF_8)));

                ses.sendRawEmail(new SendRawEmailRequest().withRawMessage(rm));
            }
        } catch (Exception e) {
            System.err.println("Error occurred while sending e-mail notification.");
            e.printStackTrace();
            addError("Error occurred while sending e-mail notification.", e);
        }
    }
}
