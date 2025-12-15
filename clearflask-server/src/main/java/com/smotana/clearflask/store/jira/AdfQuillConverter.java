// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.jira;

import com.google.common.base.Strings;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

/**
 * Converts between Atlassian Document Format (ADF) used by Jira and Quill Delta format used by ClearFlask.
 *
 * ADF Structure:
 * {
 *   "version": 1,
 *   "type": "doc",
 *   "content": [
 *     {
 *       "type": "paragraph",
 *       "content": [
 *         { "type": "text", "text": "Hello" },
 *         { "type": "text", "text": " World", "marks": [{ "type": "strong" }] }
 *       ]
 *     }
 *   ]
 * }
 *
 * Quill Delta Structure:
 * {
 *   "ops": [
 *     { "insert": "Hello" },
 *     { "insert": " World", "attributes": { "bold": true } },
 *     { "insert": "\n" }
 *   ]
 * }
 */
@Slf4j
@Singleton
public class AdfQuillConverter {

    @Inject
    private Gson gson;

    /**
     * Convert ADF JSON to Quill Delta JSON.
     *
     * @param adfJson The ADF document as JSON string
     * @return Quill Delta as JSON string
     */
    public String adfToQuill(String adfJson) {
        if (Strings.isNullOrEmpty(adfJson)) {
            return createEmptyQuill();
        }

        try {
            JsonObject adf = gson.fromJson(adfJson, JsonObject.class);
            JsonArray ops = new JsonArray();

            if (adf.has("content")) {
                JsonArray content = adf.getAsJsonArray("content");
                for (JsonElement blockElement : content) {
                    JsonObject block = blockElement.getAsJsonObject();
                    convertAdfBlockToQuill(block, ops);
                }
            }

            // Ensure we end with a newline
            if (ops.size() == 0 || !endsWithNewline(ops)) {
                JsonObject newlineOp = new JsonObject();
                newlineOp.addProperty("insert", "\n");
                ops.add(newlineOp);
            }

            JsonObject delta = new JsonObject();
            delta.add("ops", ops);
            return gson.toJson(delta);
        } catch (Exception e) {
            log.warn("Failed to convert ADF to Quill, returning plain text fallback", e);
            return plainTextToQuill(adfJson);
        }
    }

    private void convertAdfBlockToQuill(JsonObject block, JsonArray ops) {
        String type = block.has("type") ? block.get("type").getAsString() : "";

        switch (type) {
            case "paragraph":
                convertParagraphToQuill(block, ops);
                break;
            case "heading":
                convertHeadingToQuill(block, ops);
                break;
            case "bulletList":
                convertListToQuill(block, ops, "bullet");
                break;
            case "orderedList":
                convertListToQuill(block, ops, "ordered");
                break;
            case "codeBlock":
                convertCodeBlockToQuill(block, ops);
                break;
            case "blockquote":
                convertBlockquoteToQuill(block, ops);
                break;
            case "rule":
                // Horizontal rule - insert as plain text
                JsonObject hrOp = new JsonObject();
                hrOp.addProperty("insert", "---\n");
                ops.add(hrOp);
                break;
            case "mediaSingle":
            case "mediaGroup":
                // Media elements - add placeholder
                JsonObject mediaOp = new JsonObject();
                mediaOp.addProperty("insert", "[Media]\n");
                ops.add(mediaOp);
                break;
            default:
                // Try to extract text content from unknown block types
                if (block.has("content")) {
                    convertInlineContentToQuill(block.getAsJsonArray("content"), ops, null);
                    addNewline(ops, null);
                }
                break;
        }
    }

    private void convertParagraphToQuill(JsonObject paragraph, JsonArray ops) {
        if (paragraph.has("content")) {
            convertInlineContentToQuill(paragraph.getAsJsonArray("content"), ops, null);
        }
        addNewline(ops, null);
    }

    private void convertHeadingToQuill(JsonObject heading, JsonArray ops) {
        if (heading.has("content")) {
            convertInlineContentToQuill(heading.getAsJsonArray("content"), ops, null);
        }

        int level = heading.has("attrs") && heading.getAsJsonObject("attrs").has("level")
                ? heading.getAsJsonObject("attrs").get("level").getAsInt()
                : 1;

        JsonObject attrs = new JsonObject();
        attrs.addProperty("header", level);
        addNewline(ops, attrs);
    }

    private void convertListToQuill(JsonObject list, JsonArray ops, String listType) {
        if (!list.has("content")) return;

        for (JsonElement itemElement : list.getAsJsonArray("content")) {
            JsonObject item = itemElement.getAsJsonObject();
            if ("listItem".equals(item.get("type").getAsString()) && item.has("content")) {
                for (JsonElement contentElement : item.getAsJsonArray("content")) {
                    JsonObject content = contentElement.getAsJsonObject();
                    if ("paragraph".equals(content.get("type").getAsString())) {
                        if (content.has("content")) {
                            convertInlineContentToQuill(content.getAsJsonArray("content"), ops, null);
                        }
                        JsonObject attrs = new JsonObject();
                        attrs.addProperty("list", listType);
                        addNewline(ops, attrs);
                    } else if ("bulletList".equals(content.get("type").getAsString())
                            || "orderedList".equals(content.get("type").getAsString())) {
                        // Nested list
                        convertListToQuill(content, ops,
                                "bulletList".equals(content.get("type").getAsString()) ? "bullet" : "ordered");
                    }
                }
            }
        }
    }

    private void convertCodeBlockToQuill(JsonObject codeBlock, JsonArray ops) {
        StringBuilder code = new StringBuilder();
        if (codeBlock.has("content")) {
            for (JsonElement contentElement : codeBlock.getAsJsonArray("content")) {
                JsonObject content = contentElement.getAsJsonObject();
                if ("text".equals(content.get("type").getAsString())) {
                    code.append(content.get("text").getAsString());
                }
            }
        }

        JsonObject codeOp = new JsonObject();
        codeOp.addProperty("insert", code.toString());
        JsonObject attrs = new JsonObject();
        attrs.addProperty("code-block", true);
        codeOp.add("attributes", attrs);
        ops.add(codeOp);

        addNewline(ops, null);
    }

    private void convertBlockquoteToQuill(JsonObject blockquote, JsonArray ops) {
        if (blockquote.has("content")) {
            for (JsonElement contentElement : blockquote.getAsJsonArray("content")) {
                JsonObject content = contentElement.getAsJsonObject();
                if ("paragraph".equals(content.get("type").getAsString())) {
                    if (content.has("content")) {
                        convertInlineContentToQuill(content.getAsJsonArray("content"), ops, null);
                    }
                    JsonObject attrs = new JsonObject();
                    attrs.addProperty("blockquote", true);
                    addNewline(ops, attrs);
                }
            }
        }
    }

    private void convertInlineContentToQuill(JsonArray content, JsonArray ops, JsonObject baseAttrs) {
        for (JsonElement element : content) {
            JsonObject node = element.getAsJsonObject();
            String type = node.has("type") ? node.get("type").getAsString() : "";

            switch (type) {
                case "text":
                    String text = node.has("text") ? node.get("text").getAsString() : "";
                    JsonObject textOp = new JsonObject();
                    textOp.addProperty("insert", text);

                    JsonObject attrs = convertMarksToQuillAttrs(node, baseAttrs);
                    if (attrs != null && attrs.size() > 0) {
                        textOp.add("attributes", attrs);
                    }

                    ops.add(textOp);
                    break;
                case "hardBreak":
                    JsonObject brOp = new JsonObject();
                    brOp.addProperty("insert", "\n");
                    ops.add(brOp);
                    break;
                case "mention":
                    String mentionText = node.has("attrs") && node.getAsJsonObject("attrs").has("text")
                            ? node.getAsJsonObject("attrs").get("text").getAsString()
                            : "@mention";
                    JsonObject mentionOp = new JsonObject();
                    mentionOp.addProperty("insert", mentionText);
                    ops.add(mentionOp);
                    break;
                case "emoji":
                    String emoji = node.has("attrs") && node.getAsJsonObject("attrs").has("shortName")
                            ? node.getAsJsonObject("attrs").get("shortName").getAsString()
                            : "";
                    JsonObject emojiOp = new JsonObject();
                    emojiOp.addProperty("insert", emoji);
                    ops.add(emojiOp);
                    break;
                case "inlineCard":
                    String url = node.has("attrs") && node.getAsJsonObject("attrs").has("url")
                            ? node.getAsJsonObject("attrs").get("url").getAsString()
                            : "";
                    JsonObject linkOp = new JsonObject();
                    linkOp.addProperty("insert", url);
                    JsonObject linkAttrs = new JsonObject();
                    linkAttrs.addProperty("link", url);
                    linkOp.add("attributes", linkAttrs);
                    ops.add(linkOp);
                    break;
                default:
                    // Unknown inline type - try to extract text
                    if (node.has("text")) {
                        JsonObject unknownOp = new JsonObject();
                        unknownOp.addProperty("insert", node.get("text").getAsString());
                        ops.add(unknownOp);
                    }
                    break;
            }
        }
    }

    private JsonObject convertMarksToQuillAttrs(JsonObject textNode, JsonObject baseAttrs) {
        JsonObject attrs = baseAttrs != null ? baseAttrs.deepCopy() : new JsonObject();

        if (!textNode.has("marks")) {
            return attrs.size() > 0 ? attrs : null;
        }

        for (JsonElement markElement : textNode.getAsJsonArray("marks")) {
            JsonObject mark = markElement.getAsJsonObject();
            String markType = mark.has("type") ? mark.get("type").getAsString() : "";

            switch (markType) {
                case "strong":
                    attrs.addProperty("bold", true);
                    break;
                case "em":
                    attrs.addProperty("italic", true);
                    break;
                case "underline":
                    attrs.addProperty("underline", true);
                    break;
                case "strike":
                    attrs.addProperty("strike", true);
                    break;
                case "code":
                    attrs.addProperty("code", true);
                    break;
                case "link":
                    if (mark.has("attrs") && mark.getAsJsonObject("attrs").has("href")) {
                        attrs.addProperty("link", mark.getAsJsonObject("attrs").get("href").getAsString());
                    }
                    break;
                case "textColor":
                    if (mark.has("attrs") && mark.getAsJsonObject("attrs").has("color")) {
                        attrs.addProperty("color", mark.getAsJsonObject("attrs").get("color").getAsString());
                    }
                    break;
                case "subsup":
                    if (mark.has("attrs") && mark.getAsJsonObject("attrs").has("type")) {
                        String subSupType = mark.getAsJsonObject("attrs").get("type").getAsString();
                        if ("sub".equals(subSupType)) {
                            attrs.addProperty("script", "sub");
                        } else if ("sup".equals(subSupType)) {
                            attrs.addProperty("script", "super");
                        }
                    }
                    break;
            }
        }

        return attrs.size() > 0 ? attrs : null;
    }

    private void addNewline(JsonArray ops, JsonObject attrs) {
        JsonObject newlineOp = new JsonObject();
        newlineOp.addProperty("insert", "\n");
        if (attrs != null && attrs.size() > 0) {
            newlineOp.add("attributes", attrs);
        }
        ops.add(newlineOp);
    }

    private boolean endsWithNewline(JsonArray ops) {
        if (ops.size() == 0) return false;
        JsonObject lastOp = ops.get(ops.size() - 1).getAsJsonObject();
        if (!lastOp.has("insert")) return false;
        JsonElement insert = lastOp.get("insert");
        if (!insert.isJsonPrimitive()) return false;
        String insertStr = insert.getAsString();
        return insertStr.endsWith("\n");
    }

    /**
     * Convert Quill Delta JSON to ADF JSON.
     *
     * @param quillJson The Quill Delta as JSON string
     * @return ADF document as JSON string
     */
    public String quillToAdf(String quillJson) {
        if (Strings.isNullOrEmpty(quillJson)) {
            return createEmptyAdf();
        }

        try {
            JsonObject delta = gson.fromJson(quillJson, JsonObject.class);
            JsonArray content = new JsonArray();
            JsonArray currentParagraphContent = new JsonArray();
            JsonObject currentBlockAttrs = null;

            if (delta.has("ops")) {
                for (JsonElement opElement : delta.getAsJsonArray("ops")) {
                    JsonObject op = opElement.getAsJsonObject();

                    if (!op.has("insert")) continue;
                    JsonElement insertElement = op.get("insert");
                    JsonObject attrs = op.has("attributes") ? op.getAsJsonObject("attributes") : null;

                    if (insertElement.isJsonPrimitive()) {
                        String insertText = insertElement.getAsString();

                        // Check for block-level attributes (header, list, etc.)
                        if (insertText.contains("\n") && attrs != null) {
                            if (attrs.has("header") || attrs.has("list") || attrs.has("blockquote") || attrs.has("code-block")) {
                                currentBlockAttrs = attrs;
                            }
                        }

                        // Split text by newlines
                        String[] lines = insertText.split("\n", -1);
                        for (int i = 0; i < lines.length; i++) {
                            if (!lines[i].isEmpty()) {
                                JsonObject textNode = createAdfTextNode(lines[i], attrs);
                                currentParagraphContent.add(textNode);
                            }

                            // End of line - create block
                            if (i < lines.length - 1 || insertText.endsWith("\n")) {
                                JsonObject block = createAdfBlock(currentParagraphContent, currentBlockAttrs);
                                if (block != null) {
                                    content.add(block);
                                }
                                currentParagraphContent = new JsonArray();
                                currentBlockAttrs = null;
                            }
                        }
                    }
                }
            }

            // Handle remaining content
            if (currentParagraphContent.size() > 0) {
                JsonObject block = createAdfBlock(currentParagraphContent, currentBlockAttrs);
                if (block != null) {
                    content.add(block);
                }
            }

            // Ensure we have at least one paragraph
            if (content.size() == 0) {
                JsonObject emptyPara = new JsonObject();
                emptyPara.addProperty("type", "paragraph");
                emptyPara.add("content", new JsonArray());
                content.add(emptyPara);
            }

            JsonObject adf = new JsonObject();
            adf.addProperty("version", 1);
            adf.addProperty("type", "doc");
            adf.add("content", content);

            return gson.toJson(adf);
        } catch (Exception e) {
            log.warn("Failed to convert Quill to ADF, returning plain text", e);
            return plainTextToAdf(quillToPlainText(quillJson));
        }
    }

    private JsonObject createAdfTextNode(String text, JsonObject quillAttrs) {
        JsonObject textNode = new JsonObject();
        textNode.addProperty("type", "text");
        textNode.addProperty("text", text);

        if (quillAttrs != null) {
            JsonArray marks = new JsonArray();

            if (quillAttrs.has("bold") && quillAttrs.get("bold").getAsBoolean()) {
                JsonObject mark = new JsonObject();
                mark.addProperty("type", "strong");
                marks.add(mark);
            }
            if (quillAttrs.has("italic") && quillAttrs.get("italic").getAsBoolean()) {
                JsonObject mark = new JsonObject();
                mark.addProperty("type", "em");
                marks.add(mark);
            }
            if (quillAttrs.has("underline") && quillAttrs.get("underline").getAsBoolean()) {
                JsonObject mark = new JsonObject();
                mark.addProperty("type", "underline");
                marks.add(mark);
            }
            if (quillAttrs.has("strike") && quillAttrs.get("strike").getAsBoolean()) {
                JsonObject mark = new JsonObject();
                mark.addProperty("type", "strike");
                marks.add(mark);
            }
            if (quillAttrs.has("code") && quillAttrs.get("code").getAsBoolean()) {
                JsonObject mark = new JsonObject();
                mark.addProperty("type", "code");
                marks.add(mark);
            }
            if (quillAttrs.has("link")) {
                JsonObject mark = new JsonObject();
                mark.addProperty("type", "link");
                JsonObject linkAttrs = new JsonObject();
                linkAttrs.addProperty("href", quillAttrs.get("link").getAsString());
                mark.add("attrs", linkAttrs);
                marks.add(mark);
            }

            if (marks.size() > 0) {
                textNode.add("marks", marks);
            }
        }

        return textNode;
    }

    private JsonObject createAdfBlock(JsonArray content, JsonObject blockAttrs) {
        if (content.size() == 0 && blockAttrs == null) {
            // Empty paragraph
            JsonObject para = new JsonObject();
            para.addProperty("type", "paragraph");
            para.add("content", new JsonArray());
            return para;
        }

        if (blockAttrs != null && blockAttrs.has("header")) {
            int level = blockAttrs.get("header").getAsInt();
            JsonObject heading = new JsonObject();
            heading.addProperty("type", "heading");
            JsonObject attrs = new JsonObject();
            attrs.addProperty("level", level);
            heading.add("attrs", attrs);
            heading.add("content", content);
            return heading;
        }

        if (blockAttrs != null && blockAttrs.has("list")) {
            String listType = blockAttrs.get("list").getAsString();
            JsonObject list = new JsonObject();
            list.addProperty("type", "bullet".equals(listType) ? "bulletList" : "orderedList");

            JsonObject listItem = new JsonObject();
            listItem.addProperty("type", "listItem");

            JsonObject para = new JsonObject();
            para.addProperty("type", "paragraph");
            para.add("content", content);

            JsonArray listItemContent = new JsonArray();
            listItemContent.add(para);
            listItem.add("content", listItemContent);

            JsonArray listContent = new JsonArray();
            listContent.add(listItem);
            list.add("content", listContent);

            return list;
        }

        if (blockAttrs != null && blockAttrs.has("blockquote") && blockAttrs.get("blockquote").getAsBoolean()) {
            JsonObject blockquote = new JsonObject();
            blockquote.addProperty("type", "blockquote");

            JsonObject para = new JsonObject();
            para.addProperty("type", "paragraph");
            para.add("content", content);

            JsonArray bqContent = new JsonArray();
            bqContent.add(para);
            blockquote.add("content", bqContent);

            return blockquote;
        }

        if (blockAttrs != null && blockAttrs.has("code-block")) {
            JsonObject codeBlock = new JsonObject();
            codeBlock.addProperty("type", "codeBlock");
            codeBlock.add("content", content);
            return codeBlock;
        }

        // Default: paragraph
        JsonObject para = new JsonObject();
        para.addProperty("type", "paragraph");
        para.add("content", content);
        return para;
    }

    /**
     * Convert Quill Delta to plain text.
     *
     * @param quillJson Quill Delta JSON string
     * @return Plain text content
     */
    public String quillToPlainText(String quillJson) {
        if (Strings.isNullOrEmpty(quillJson)) {
            return "";
        }

        try {
            JsonObject delta = gson.fromJson(quillJson, JsonObject.class);
            StringBuilder text = new StringBuilder();

            if (delta.has("ops")) {
                for (JsonElement opElement : delta.getAsJsonArray("ops")) {
                    JsonObject op = opElement.getAsJsonObject();
                    if (op.has("insert") && op.get("insert").isJsonPrimitive()) {
                        text.append(op.get("insert").getAsString());
                    }
                }
            }

            return text.toString();
        } catch (Exception e) {
            log.warn("Failed to convert Quill to plain text", e);
            return quillJson;
        }
    }

    /**
     * Convert plain text to Quill Delta format.
     *
     * @param text Plain text
     * @return Quill Delta JSON string
     */
    public String plainTextToQuill(String text) {
        JsonArray ops = new JsonArray();

        if (!Strings.isNullOrEmpty(text)) {
            JsonObject insertOp = new JsonObject();
            insertOp.addProperty("insert", text);
            ops.add(insertOp);
        }

        // Ensure we end with newline
        if (Strings.isNullOrEmpty(text) || !text.endsWith("\n")) {
            JsonObject newlineOp = new JsonObject();
            newlineOp.addProperty("insert", "\n");
            ops.add(newlineOp);
        }

        JsonObject delta = new JsonObject();
        delta.add("ops", ops);
        return gson.toJson(delta);
    }

    /**
     * Convert plain text to ADF format.
     *
     * @param text Plain text
     * @return ADF JSON string
     */
    public String plainTextToAdf(String text) {
        JsonArray content = new JsonArray();

        if (!Strings.isNullOrEmpty(text)) {
            String[] paragraphs = text.split("\n\n");
            for (String para : paragraphs) {
                if (para.isEmpty()) continue;

                JsonObject paragraph = new JsonObject();
                paragraph.addProperty("type", "paragraph");

                JsonArray paraContent = new JsonArray();
                JsonObject textNode = new JsonObject();
                textNode.addProperty("type", "text");
                textNode.addProperty("text", para.replace("\n", " "));
                paraContent.add(textNode);

                paragraph.add("content", paraContent);
                content.add(paragraph);
            }
        }

        // Ensure at least one paragraph
        if (content.size() == 0) {
            JsonObject emptyPara = new JsonObject();
            emptyPara.addProperty("type", "paragraph");
            emptyPara.add("content", new JsonArray());
            content.add(emptyPara);
        }

        JsonObject adf = new JsonObject();
        adf.addProperty("version", 1);
        adf.addProperty("type", "doc");
        adf.add("content", content);

        return gson.toJson(adf);
    }

    private String createEmptyQuill() {
        JsonArray ops = new JsonArray();
        JsonObject newlineOp = new JsonObject();
        newlineOp.addProperty("insert", "\n");
        ops.add(newlineOp);

        JsonObject delta = new JsonObject();
        delta.add("ops", ops);
        return gson.toJson(delta);
    }

    private String createEmptyAdf() {
        JsonArray content = new JsonArray();
        JsonObject emptyPara = new JsonObject();
        emptyPara.addProperty("type", "paragraph");
        emptyPara.add("content", new JsonArray());
        content.add(emptyPara);

        JsonObject adf = new JsonObject();
        adf.addProperty("version", 1);
        adf.addProperty("type", "doc");
        adf.add("content", content);

        return gson.toJson(adf);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AdfQuillConverter.class).asEagerSingleton();
            }
        };
    }
}
