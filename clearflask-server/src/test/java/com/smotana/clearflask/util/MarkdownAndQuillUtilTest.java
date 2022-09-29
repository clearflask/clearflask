// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.amazonaws.services.s3.AmazonS3;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.impl.S3ContentStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

@Slf4j
public class MarkdownAndQuillUtilTest extends AbstractTest {

    /**
     * MIT License
     *
     * Copyright (c) 2017 Max Stoiber
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in all
     * copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     * SOFTWARE.
     */
    /**
     * Combination of:
     * https://github.com/fullpipe/markdown-test-page/blob/master/test-page.md
     * https://github.com/mxstbr/markdown-test-file/blob/master/TEST.md
     */
    private static final String MARKDOWN_SAMPLE = "# Markdown: Syntax\n" +
            "\n" +
            "*   [Overview](#overview)\n" +
            "    *   [Philosophy](#philosophy)\n" +
            "    *   [Inline HTML](#html)\n" +
            "    *   [Automatic Escaping for Special Characters](#autoescape)\n" +
            "*   [Block Elements](#block)\n" +
            "    *   [Paragraphs and Line Breaks](#p)\n" +
            "    *   [Headers](#header)\n" +
            "    *   [Blockquotes](#blockquote)\n" +
            "    *   [Lists](#list)\n" +
            "    *   [Code Blocks](#precode)\n" +
            "    *   [Horizontal Rules](#hr)\n" +
            "*   [Span Elements](#span)\n" +
            "    *   [Links](#link)\n" +
            "    *   [Emphasis](#em)\n" +
            "    *   [Code](#code)\n" +
            "    *   [Images](#img)\n" +
            "*   [Miscellaneous](#misc)\n" +
            "    *   [Backslash Escapes](#backslash)\n" +
            "    *   [Automatic Links](#autolink)\n" +
            "\n" +
            "\n" +
            "**Note:** This document is itself written using Markdown; you\n" +
            "can [see the source for it by adding '.text' to the URL](/projects/markdown/syntax.text).\n" +
            "\n" +
            "----\n" +
            "\n" +
            "## Overview\n" +
            "\n" +
            "### Philosophy\n" +
            "\n" +
            "Markdown is intended to be as easy-to-read and easy-to-write as is feasible.\n" +
            "\n" +
            "Readability, however, is emphasized above all else. A Markdown-formatted\n" +
            "document should be publishable as-is, as plain text, without looking\n" +
            "like it's been marked up with tags or formatting instructions. While\n" +
            "Markdown's syntax has been influenced by several existing text-to-HTML\n" +
            "filters -- including [Setext](http://docutils.sourceforge.net/mirror/setext.html), [atx](http://www.aaronsw.com/2002/atx/), [Textile](http://textism.com/tools/textile/), [reStructuredText](http://docutils.sourceforge.net/rst.html),\n" +
            "[Grutatext](http://www.triptico.com/software/grutatxt.html), and [EtText](http://ettext.taint.org/doc/) -- the single biggest source of\n" +
            "inspiration for Markdown's syntax is the format of plain text email.\n" +
            "\n" +
            "## Block Elements\n" +
            "\n" +
            "### Paragraphs and Line Breaks\n" +
            "\n" +
            "A paragraph is simply one or more consecutive lines of text, separated\n" +
            "by one or more blank lines. (A blank line is any line that looks like a\n" +
            "blank line -- a line containing nothing but spaces or tabs is considered\n" +
            "blank.) Normal paragraphs should not be indented with spaces or tabs.\n" +
            "\n" +
            "The implication of the \"one or more consecutive lines of text\" rule is\n" +
            "that Markdown supports \"hard-wrapped\" text paragraphs. This differs\n" +
            "significantly from most other text-to-HTML formatters (including Movable\n" +
            "Type's \"Convert Line Breaks\" option) which translate every line break\n" +
            "character in a paragraph into a `<br />` tag.\n" +
            "\n" +
            "When you *do* want to insert a `<br />` break tag using Markdown, you\n" +
            "end a line with two or more spaces, then type return.\n" +
            "\n" +
            "### Headers\n" +
            "\n" +
            "Markdown supports two styles of headers, [Setext] [1] and [atx] [2].\n" +
            "\n" +
            "Optionally, you may \"close\" atx-style headers. This is purely\n" +
            "cosmetic -- you can use this if you think it looks better. The\n" +
            "closing hashes don't even need to match the number of hashes\n" +
            "used to open the header. (The number of opening hashes\n" +
            "determines the header level.)\n" +
            "\n" +
            "\n" +
            "### Blockquotes\n" +
            "\n" +
            "Markdown uses email-style `>` characters for blockquoting. If you're\n" +
            "familiar with quoting passages of text in an email message, then you\n" +
            "know how to create a blockquote in Markdown. It looks best if you hard\n" +
            "wrap the text and put a `>` before every line:\n" +
            "\n" +
            "> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,\n" +
            "> consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.\n" +
            "> Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "> \n" +
            "> Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse\n" +
            "> id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "Markdown allows you to be lazy and only put the `>` before the first\n" +
            "line of a hard-wrapped paragraph:\n" +
            "\n" +
            "> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,\n" +
            "consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.\n" +
            "Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "\n" +
            "> Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse\n" +
            "id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "Blockquotes can be nested (i.e. a blockquote-in-a-blockquote) by\n" +
            "adding additional levels of `>`:\n" +
            "\n" +
            "> This is the first level of quoting.\n" +
            ">\n" +
            "> > This is nested blockquote.\n" +
            ">\n" +
            "> Back to the first level.\n" +
            "\n" +
            "Blockquotes can contain other Markdown elements, including headers, lists,\n" +
            "and code blocks:\n" +
            "\n" +
            "> ## This is a header.\n" +
            "> \n" +
            "> 1.   This is the first list item.\n" +
            "> 2.   This is the second list item.\n" +
            "> \n" +
            "> Here's some example code:\n" +
            "> \n" +
            ">     return shell_exec(\"echo $input | $markdown_script\");\n" +
            "\n" +
            "Any decent text editor should make email-style quoting easy. For\n" +
            "example, with BBEdit, you can make a selection and choose Increase\n" +
            "Quote Level from the Text menu.\n" +
            "\n" +
            "\n" +
            "### Lists\n" +
            "\n" +
            "Markdown supports ordered (numbered) and unordered (bulleted) lists.\n" +
            "\n" +
            "Unordered lists use asterisks, pluses, and hyphens -- interchangably\n" +
            "-- as list markers:\n" +
            "\n" +
            "*   Red\n" +
            "*   Green\n" +
            "*   Blue\n" +
            "\n" +
            "is equivalent to:\n" +
            "\n" +
            "+   Red\n" +
            "+   Green\n" +
            "+   Blue\n" +
            "\n" +
            "and:\n" +
            "\n" +
            "-   Red\n" +
            "-   Green\n" +
            "-   Blue\n" +
            "\n" +
            "Ordered lists use numbers followed by periods:\n" +
            "\n" +
            "1.  Bird\n" +
            "2.  McHale\n" +
            "3.  Parish\n" +
            "\n" +
            "It's important to note that the actual numbers you use to mark the\n" +
            "list have no effect on the HTML output Markdown produces. The HTML\n" +
            "Markdown produces from the above list is:\n" +
            "\n" +
            "If you instead wrote the list in Markdown like this:\n" +
            "\n" +
            "1.  Bird\n" +
            "1.  McHale\n" +
            "1.  Parish\n" +
            "\n" +
            "or even:\n" +
            "\n" +
            "3. Bird\n" +
            "1. McHale\n" +
            "8. Parish\n" +
            "\n" +
            "you'd get the exact same HTML output. The point is, if you want to,\n" +
            "you can use ordinal numbers in your ordered Markdown lists, so that\n" +
            "the numbers in your source match the numbers in your published HTML.\n" +
            "But if you want to be lazy, you don't have to.\n" +
            "\n" +
            "To make lists look nice, you can wrap items with hanging indents:\n" +
            "\n" +
            "*   Lorem ipsum dolor sit amet, consectetuer adipiscing elit.\n" +
            "    Aliquam hendrerit mi posuere lectus. Vestibulum enim wisi,\n" +
            "    viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "*   Donec sit amet nisl. Aliquam semper ipsum sit amet velit.\n" +
            "    Suspendisse id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "But if you want to be lazy, you don't have to:\n" +
            "\n" +
            "*   Lorem ipsum dolor sit amet, consectetuer adipiscing elit.\n" +
            "Aliquam hendrerit mi posuere lectus. Vestibulum enim wisi,\n" +
            "viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "*   Donec sit amet nisl. Aliquam semper ipsum sit amet velit.\n" +
            "Suspendisse id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "List items may consist of multiple paragraphs. Each subsequent\n" +
            "paragraph in a list item must be indented by either 4 spaces\n" +
            "or one tab:\n" +
            "\n" +
            "1.  This is a list item with two paragraphs. Lorem ipsum dolor\n" +
            "    sit amet, consectetuer adipiscing elit. Aliquam hendrerit\n" +
            "    mi posuere lectus.\n" +
            "\n" +
            "    Vestibulum enim wisi, viverra nec, fringilla in, laoreet\n" +
            "    vitae, risus. Donec sit amet nisl. Aliquam semper ipsum\n" +
            "    sit amet velit.\n" +
            "\n" +
            "2.  Suspendisse id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "It looks nice if you indent every line of the subsequent\n" +
            "paragraphs, but here again, Markdown will allow you to be\n" +
            "lazy:\n" +
            "\n" +
            "*   This is a list item with two paragraphs.\n" +
            "\n" +
            "    This is the second paragraph in the list item. You're\n" +
            "only required to indent the first line. Lorem ipsum dolor\n" +
            "sit amet, consectetuer adipiscing elit.\n" +
            "\n" +
            "*   Another item in the same list.\n" +
            "\n" +
            "To put a blockquote within a list item, the blockquote's `>`\n" +
            "delimiters need to be indented:\n" +
            "\n" +
            "*   A list item with a blockquote:\n" +
            "\n" +
            "    > This is a blockquote\n" +
            "    > inside a list item.\n" +
            "\n" +
            "To put a code block within a list item, the code block needs\n" +
            "to be indented *twice* -- 8 spaces or two tabs:\n" +
            "\n" +
            "*   A list item with a code block:\n" +
            "\n" +
            "        <code goes here>\n" +
            "\n" +
            "### Code Blocks\n" +
            "\n" +
            "Pre-formatted code blocks are used for writing about programming or\n" +
            "markup source code. Rather than forming normal paragraphs, the lines\n" +
            "of a code block are interpreted literally. Markdown wraps a code block\n" +
            "in both `<pre>` and `<code>` tags.\n" +
            "\n" +
            "To produce a code block in Markdown, simply indent every line of the\n" +
            "block by at least 4 spaces or 1 tab.\n" +
            "\n" +
            "This is a normal paragraph:\n" +
            "\n" +
            "    This is a code block.\n" +
            "\n" +
            "Here is an example of AppleScript:\n" +
            "\n" +
            "    tell application \"Foo\"\n" +
            "        beep\n" +
            "    end tell\n" +
            "\n" +
            "A code block continues until it reaches a line that is not indented\n" +
            "(or the end of the article).\n" +
            "\n" +
            "Within a code block, ampersands (`&`) and angle brackets (`<` and `>`)\n" +
            "are automatically converted into HTML entities. This makes it very\n" +
            "easy to include example HTML source code using Markdown -- just paste\n" +
            "it and indent it, and Markdown will handle the hassle of encoding the\n" +
            "ampersands and angle brackets. For example, this:\n" +
            "\n" +
            "    <div class=\"footer\">\n" +
            "        &copy; 2004 Foo Corporation\n" +
            "    </div>\n" +
            "\n" +
            "Regular Markdown syntax is not processed within code blocks. E.g.,\n" +
            "asterisks are just literal asterisks within a code block. This means\n" +
            "it's also easy to use Markdown to write about Markdown's own syntax.\n" +
            "\n" +
            "```\n" +
            "tell application \"Foo\"\n" +
            "    beep\n" +
            "end tell\n" +
            "```\n" +
            "\n" +
            "## Span Elements\n" +
            "\n" +
            "### Links\n" +
            "\n" +
            "Markdown supports two style of links: *inline* and *reference*.\n" +
            "\n" +
            "In both styles, the link text is delimited by [square brackets].\n" +
            "\n" +
            "To create an inline link, use a set of regular parentheses immediately\n" +
            "after the link text's closing square bracket. Inside the parentheses,\n" +
            "put the URL where you want the link to point, along with an *optional*\n" +
            "title for the link, surrounded in quotes. For example:\n" +
            "\n" +
            "This is [an example](http://example.com/) inline link.\n" +
            "\n" +
            "[This link](http://example.net/) has no title attribute.\n" +
            "\n" +
            "### Emphasis\n" +
            "\n" +
            "Markdown treats asterisks (`*`) and underscores (`_`) as indicators of\n" +
            "emphasis. Text wrapped with one `*` or `_` will be wrapped with an\n" +
            "HTML `<em>` tag; double `*`'s or `_`'s will be wrapped with an HTML\n" +
            "`<strong>` tag. E.g., this input:\n" +
            "\n" +
            "*single asterisks*\n" +
            "\n" +
            "_single underscores_\n" +
            "\n" +
            "**double asterisks**\n" +
            "\n" +
            "__double underscores__\n" +
            "\n" +
            "### Code\n" +
            "\n" +
            "To indicate a span of code, wrap it with backtick quotes (`` ` ``).\n" +
            "Unlike a pre-formatted code block, a code span indicates code within a\n" +
            "normal paragraph. For example:\n" +
            "\n" +
            "Use the `printf()` function.\n" +
            "# <a name=\"top\"></a>Markdown Test Page\n" +
            "\n" +
            "* [Headings](#Headings)\n" +
            "* [Paragraphs](#Paragraphs)\n" +
            "* [Blockquotes](#Blockquotes)\n" +
            "* [Lists](#Lists)\n" +
            "* [Horizontal rule](#Horizontal)\n" +
            "* [Table](#Table)\n" +
            "* [Code](#Code)\n" +
            "* [Inline elements](#Inline)\n" +
            "\n" +
            "***\n" +
            "\n" +
            "# <a name=\"Headings\"></a>Headings\n" +
            "\n" +
            "# Heading one\n" +
            "\n" +
            "Sint sit cillum pariatur eiusmod nulla pariatur ipsum. Sit laborum anim qui mollit tempor pariatur nisi minim dolor. Aliquip et adipisicing sit sit fugiat commodo id sunt. Nostrud enim ad commodo incididunt cupidatat in ullamco ullamco Lorem cupidatat velit enim et Lorem. Ut laborum cillum laboris fugiat culpa sint irure do reprehenderit culpa occaecat. Exercitation esse mollit tempor magna aliqua in occaecat aliquip veniam reprehenderit nisi dolor in laboris dolore velit.\n" +
            "\n" +
            "## Heading two\n" +
            "\n" +
            "Aute officia nulla deserunt do deserunt cillum velit magna. Officia veniam culpa anim minim dolore labore pariatur voluptate id ad est duis quis velit dolor pariatur enim. Incididunt enim excepteur do veniam consequat culpa do voluptate dolor fugiat ad adipisicing sit. Labore officia est adipisicing dolore proident eiusmod exercitation deserunt ullamco anim do occaecat velit. Elit dolor consectetur proident sunt aliquip est do tempor quis aliqua culpa aute. Duis in tempor exercitation pariatur et adipisicing mollit irure tempor ut enim esse commodo laboris proident. Do excepteur laborum anim esse aliquip eu sit id Lorem incididunt elit irure ea nulla dolor et. Nulla amet fugiat qui minim deserunt enim eu cupidatat aute officia do velit ea reprehenderit.\n" +
            "\n" +
            "### Heading three\n" +
            "\n" +
            "Voluptate cupidatat cillum elit quis ipsum eu voluptate fugiat consectetur enim. Quis ut voluptate culpa ex anim aute consectetur dolore proident voluptate exercitation eiusmod. Esse in do anim magna minim culpa sint. Adipisicing ipsum consectetur proident ullamco magna sit amet aliqua aute fugiat laborum exercitation duis et.\n" +
            "\n" +
            "#### Heading four\n" +
            "\n" +
            "Commodo fugiat aliqua minim quis pariatur mollit id tempor. Non occaecat minim esse enim aliqua adipisicing nostrud duis consequat eu adipisicing qui. Minim aliquip sit excepteur ipsum consequat laborum pariatur excepteur. Veniam fugiat et amet ad elit anim laborum duis mollit occaecat et et ipsum et reprehenderit. Occaecat aliquip dolore adipisicing sint labore occaecat officia fugiat. Quis adipisicing exercitation exercitation eu amet est laboris sunt nostrud ipsum reprehenderit ullamco. Enim sint ut consectetur id anim aute voluptate exercitation mollit dolore magna magna est Lorem. Ut adipisicing adipisicing aliqua ullamco voluptate labore nisi tempor esse magna incididunt.\n" +
            "\n" +
            "##### Heading five\n" +
            "\n" +
            "Veniam enim esse amet veniam deserunt laboris amet enim consequat. Minim nostrud deserunt cillum consectetur commodo eu enim nostrud ullamco occaecat excepteur. Aliquip et ut est commodo enim dolor amet sint excepteur. Amet ad laboris laborum deserunt sint sunt aliqua commodo ex duis deserunt enim est ex labore ut. Duis incididunt velit adipisicing non incididunt adipisicing adipisicing. Ad irure duis nisi tempor eu dolor fugiat magna et consequat tempor eu ex dolore. Mollit esse nisi qui culpa ut nisi ex proident culpa cupidatat cillum culpa occaecat anim. Ut officia sit ea nisi ea excepteur nostrud ipsum et nulla.\n" +
            "\n" +
            "###### Heading six\n" +
            "\n" +
            "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n" +
            "\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Paragraphs\"></a>Paragraphs\n" +
            "\n" +
            "Incididunt ex adipisicing ea ullamco consectetur in voluptate proident fugiat tempor deserunt reprehenderit ullamco id dolore laborum. Do laboris laboris minim incididunt qui consectetur exercitation adipisicing dolore et magna consequat magna anim sunt. Officia fugiat Lorem sunt pariatur incididunt Lorem reprehenderit proident irure. Dolore ipsum aliqua mollit ad officia fugiat sit eu aliquip cupidatat ipsum duis laborum laborum fugiat esse. Voluptate anim ex dolore deserunt ea ex eiusmod irure. Occaecat excepteur aliqua exercitation aliquip dolor esse eu eu.\n" +
            "\n" +
            "Officia dolore laborum aute incididunt commodo nisi velit est est elit et dolore elit exercitation. Enim aliquip magna id ipsum aliquip consectetur ad nulla quis. Incididunt pariatur dolor consectetur cillum enim velit cupidatat laborum quis ex.\n" +
            "\n" +
            "Officia irure in non voluptate adipisicing sit amet tempor duis dolore deserunt enim ut. Reprehenderit incididunt in ad anim et deserunt deserunt Lorem laborum quis. Enim aute anim labore proident laboris voluptate elit excepteur in. Ex labore nulla velit officia ullamco Lorem Lorem id do. Dolore ullamco ipsum magna dolor pariatur voluptate ipsum id occaecat ipsum. Dolore tempor quis duis commodo quis quis enim.\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Blockquotes\"></a>Blockquotes\n" +
            "\n" +
            "Ad nisi laborum aute cupidatat magna deserunt eu id laboris id. Aliquip nulla cupidatat sint ex Lorem mollit laborum dolor amet est ut esse aute. Nostrud ex consequat id incididunt proident ipsum minim duis aliqua ut ex et ad quis. Laborum sint esse cillum anim nulla cillum consectetur aliqua sit. Nisi excepteur cillum labore amet excepteur commodo enim occaecat consequat ipsum proident exercitation duis id in.\n" +
            "\n" +
            "> Ipsum et cupidatat mollit exercitation enim duis sunt irure aliqua reprehenderit mollit. Pariatur Lorem pariatur laboris do culpa do elit irure. Eiusmod amet nulla voluptate velit culpa et aliqua ad reprehenderit sit ut.\n" +
            "\n" +
            "Labore ea magna Lorem consequat aliquip consectetur cillum duis dolore. Et veniam dolor qui incididunt minim amet laboris sit. Dolore ad esse commodo et dolore amet est velit ut nisi ea. Excepteur ea nulla commodo dolore anim dolore adipisicing eiusmod labore id enim esse quis mollit deserunt est. Minim ea culpa voluptate nostrud commodo proident in duis aliquip minim.\n" +
            "\n" +
            "> Qui est sit et reprehenderit aute est esse enim aliqua id aliquip ea anim. Pariatur sint reprehenderit mollit velit voluptate enim consectetur sint enim. Quis exercitation proident elit non id qui culpa dolore esse aliquip consequat.\n" +
            "\n" +
            "Ipsum excepteur cupidatat sunt minim ad eiusmod tempor sit.\n" +
            "\n" +
            "> Deserunt excepteur adipisicing culpa pariatur cillum laboris ullamco nisi fugiat cillum officia. In cupidatat nulla aliquip tempor ad Lorem Lorem quis voluptate officia consectetur pariatur ex in est duis. Mollit id esse est elit exercitation voluptate nostrud nisi laborum magna dolore dolore tempor in est consectetur.\n" +
            "\n" +
            "Adipisicing voluptate ipsum culpa voluptate id aute laboris labore esse fugiat veniam ullamco occaecat do ut. Tempor et esse reprehenderit veniam proident ipsum irure sit ullamco et labore ea excepteur nulla labore ut. Ex aute minim quis tempor in eu id id irure ea nostrud dolor esse.\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Lists\"></a>Lists\n" +
            "\n" +
            "### Ordered List\n" +
            "\n" +
            "1. Longan\n" +
            "2. Lychee\n" +
            "3. Excepteur ad cupidatat do elit laborum amet cillum reprehenderit consequat quis.\n" +
            "    Deserunt officia esse aliquip consectetur duis ut labore laborum commodo aliquip aliquip velit pariatur dolore.\n" +
            "4. Marionberry\n" +
            "5. Melon\n" +
            "    - Cantaloupe\n" +
            "    - Honeydew\n" +
            "    - Watermelon\n" +
            "6. Miracle fruit\n" +
            "7. Mulberry\n" +
            "\n" +
            "### Unordered List\n" +
            "\n" +
            "- Olive\n" +
            "- Orange\n" +
            "    - Blood orange\n" +
            "    - Clementine\n" +
            "- Papaya\n" +
            "- Ut aute ipsum occaecat nisi culpa Lorem id occaecat cupidatat id id magna laboris ad duis. Fugiat cillum dolore veniam nostrud proident sint consectetur eiusmod irure adipisicing.\n" +
            "- Passionfruit\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Horizontal\"></a>Horizontal rule\n" +
            "\n" +
            "In dolore velit aliquip labore mollit minim tempor veniam eu veniam ad in sint aliquip mollit mollit. Ex occaecat non deserunt elit laborum sunt tempor sint consequat culpa culpa qui sit. Irure ad commodo eu voluptate mollit cillum cupidatat veniam proident amet minim reprehenderit.\n" +
            "\n" +
            "***\n" +
            "\n" +
            "In laboris eiusmod reprehenderit aliquip sit proident occaecat. Non sit labore anim elit veniam Lorem minim commodo eiusmod irure do minim nisi. Dolor amet cillum excepteur consequat sint non sint.\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Table\"></a>Table\n" +
            "\n" +
            "Duis sunt ut pariatur reprehenderit mollit mollit magna dolore in pariatur nulla commodo sit dolor ad fugiat. Laboris amet ea occaecat duis eu enim exercitation deserunt ea laborum occaecat reprehenderit. Et incididunt dolor commodo consequat mollit nisi proident non pariatur in et incididunt id. Eu ut et Lorem ea ex magna minim ipsum ipsum do.\n" +
            "\n" +
            "| Table Heading 1 | Table Heading 2 | Center align    | Right align     | Table Heading 5 |\n" +
            "| :-------------- | :-------------- | :-------------: | --------------: | :-------------- |\n" +
            "| Item 1          | Item 2          | Item 3          | Item 4          | Item 5          |\n" +
            "| Item 1          | Item 2          | Item 3          | Item 4          | Item 5          |\n" +
            "| Item 1          | Item 2          | Item 3          | Item 4          | Item 5          |\n" +
            "| Item 1          | Item 2          | Item 3          | Item 4          | Item 5          |\n" +
            "| Item 1          | Item 2          | Item 3          | Item 4          | Item 5          |\n" +
            "\n" +
            "Minim id consequat adipisicing cupidatat laborum culpa veniam non consectetur et duis pariatur reprehenderit eu ex consectetur. Sunt nisi qui eiusmod ut cillum laborum Lorem officia aliquip laboris ullamco nostrud laboris non irure laboris. Cillum dolore labore Lorem deserunt mollit voluptate esse incididunt ex dolor.\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Code\"></a>Code\n" +
            "\n" +
            "## Inline code\n" +
            "\n" +
            "Ad amet irure est magna id mollit Lorem in do duis enim. Excepteur velit nisi magna ea pariatur pariatur ullamco fugiat deserunt sint non sint. Duis duis est `code in text` velit velit aute culpa ex quis pariatur pariatur laborum aute pariatur duis tempor sunt ad. Irure magna voluptate dolore consectetur consectetur irure esse. Anim magna `<strong>in culpa qui officia</strong>` dolor eiusmod esse amet aute cupidatat aliqua do id voluptate cupidatat reprehenderit amet labore deserunt.\n" +
            "\n" +
            "## Highlighted\n" +
            "\n" +
            "Et fugiat ad nisi amet magna labore do cillum fugiat occaecat cillum Lorem proident. In sint dolor ullamco ad do adipisicing amet id excepteur Lorem aliquip sit irure veniam laborum duis cillum. Aliqua occaecat minim cillum deserunt magna sunt laboris do do irure ea nostrud consequat ut voluptate ex.\n" +
            "\n" +
            "```go\n" +
            "package main\n" +
            "\n" +
            "import (\n" +
            "    \"fmt\"\n" +
            "    \"net/http\"\n" +
            ")\n" +
            "\n" +
            "func handler(w http.ResponseWriter, r *http.Request) {\n" +
            "    fmt.Fprintf(w, \"Hi there, I love %s!\", r.URL.Path[1:])\n" +
            "}\n" +
            "\n" +
            "func main() {\n" +
            "    http.HandleFunc(\"/\", handler)\n" +
            "    http.ListenAndServe(\":8080\", nil)\n" +
            "}\n" +
            "```\n" +
            "\n" +
            "Ex amet id ex aliquip id do laborum excepteur exercitation elit sint commodo occaecat nostrud est. Nostrud pariatur esse veniam laborum non sint magna sit laboris minim in id. Aliqua pariatur pariatur excepteur adipisicing irure culpa consequat commodo et ex id ad.\n" +
            "\n" +
            "[[Top]](#top)\n" +
            "\n" +
            "# <a name=\"Inline\"></a>Inline elements\n" +
            "\n" +
            "Sint ea anim ipsum ad commodo cupidatat do **exercitation** incididunt et minim ad labore sunt. Minim deserunt labore laboris velit nulla incididunt ipsum nulla. Ullamco ad laborum ea qui et anim in laboris exercitation tempor sit officia laborum reprehenderit culpa velit quis. **Consequat commodo** reprehenderit duis [irure](#!) esse esse exercitation minim enim Lorem dolore duis irure. Nisi Lorem reprehenderit ea amet excepteur dolor excepteur magna labore proident voluptate ipsum. Reprehenderit ex esse deserunt aliqua ea officia mollit Lorem nulla magna enim. Et ad ipsum labore enim ipsum **cupidatat consequat**. Commodo non ea cupidatat magna deserunt dolore ipsum velit nulla elit veniam nulla eiusmod proident officia.\n" +
            "\n" +
            "![Super wide](http://placekitten.com/1280/800)\n" +
            "\n" +
            "*Proident sit veniam in est proident officia adipisicing* ea tempor cillum non cillum velit deserunt. Voluptate laborum incididunt sit consectetur Lorem irure incididunt voluptate nostrud. Commodo ut eiusmod tempor cupidatat esse enim minim ex anim consequat. Mollit sint culpa qui laboris quis consectetur ad sint esse. Amet anim anim minim ullamco et duis non irure. Sit tempor adipisicing ea laboris `culpa ex duis sint` anim aute reprehenderit id eu ea. Aute [excepteur proident](#!) Lorem minim adipisicing nostrud mollit ad ut voluptate do nulla esse occaecat aliqua sint anim.\n" +
            "\n" +
            "![Not so big](http://placekitten.com/480/400)\n" +
            "\n" +
            "Incididunt in culpa cupidatat mollit cillum qui proident sit. In cillum aliquip incididunt voluptate magna amet cupidatat cillum pariatur sint aliqua est _enim **anim** voluptate_. Magna aliquip proident incididunt id duis pariatur eiusmod incididunt commodo culpa dolore sit. Culpa do nostrud elit ad exercitation anim pariatur non minim nisi **adipisicing sunt _officia_**. Do deserunt magna mollit Lorem commodo ipsum do cupidatat mollit enim ut elit veniam ea voluptate.\n" +
            "\n" +
            "[![Manny Pacquiao](https://img.youtube.com/vi/s6bCmZmy9aQ/0.jpg)](https://youtu.be/s6bCmZmy9aQ)\n" +
            "\n" +
            "Reprehenderit non eu quis in ad elit esse qui aute id [incididunt](#!) dolore cillum. Esse laboris consequat dolor anim exercitation tempor aliqua deserunt velit magna laboris. Culpa culpa minim duis amet mollit do quis amet commodo nulla irure.\n";

    private static final String MARKDOWN_SAMPLE_SANITIZED = "Markdown: Syntax\n" +
            "\n" +
            "* Overview\n" +
            "  * Philosophy\n" +
            "  * Inline HTML\n" +
            "  * Automatic Escaping for Special Characters\n" +
            "* Block Elements\n" +
            "  * Paragraphs and Line Breaks\n" +
            "  * Headers\n" +
            "  * Blockquotes\n" +
            "  * Lists\n" +
            "  * Code Blocks\n" +
            "  * Horizontal Rules\n" +
            "* Span Elements\n" +
            "  * Links\n" +
            "  * Emphasis\n" +
            "  * Code\n" +
            "  * Images\n" +
            "* Miscellaneous\n" +
            "  * Backslash Escapes\n" +
            "  * Automatic Links\n" +
            "\n" +
            "**Note:** This document is itself written using Markdown; you can see the source for it by adding '.text' to the URL.\n" +
            "\n" +
            "Overview\n" +
            "--------\n" +
            "\n" +
            "### Philosophy\n" +
            "\n" +
            "Markdown is intended to be as easy-to-read and easy-to-write as is feasible.  \n" +
            "Readability, however, is emphasized above all else. A Markdown-formatted document should be publishable as-is, as plain text, without looking like it's been marked up with tags or formatting instructions. While Markdown's syntax has been influenced by several existing text-to-HTML filters -- including Setext, atx, Textile, reStructuredText, Grutatext, and EtText -- the single biggest source of inspiration for Markdown's syntax is the format of plain text email.\n" +
            "\n" +
            "Block Elements\n" +
            "--------------\n" +
            "\n" +
            "### Paragraphs and Line Breaks\n" +
            "\n" +
            "A paragraph is simply one or more consecutive lines of text, separated by one or more blank lines. (A blank line is any line that looks like a blank line -- a line containing nothing but spaces or tabs is considered blank.) Normal paragraphs should not be indented with spaces or tabs.  \n" +
            "The implication of the \"one or more consecutive lines of text\" rule is that Markdown supports \"hard-wrapped\" text paragraphs. This differs significantly from most other text-to-HTML formatters (including Movable Type's \"Convert Line Breaks\" option) which translate every line break character in a paragraph into a \\<br /\\> tag.  \n" +
            "When you *do* want to insert a \\<br /\\> break tag using Markdown, you end a line with two or more spaces, then type return.\n" +
            "\n" +
            "### Headers\n" +
            "\n" +
            "Markdown supports two styles of headers, \\[Setext\\] \\[1\\] and \\[atx\\] \\[2\\].  \n" +
            "Optionally, you may \"close\" atx-style headers. This is purely cosmetic -- you can use this if you think it looks better. The closing hashes don't even need to match the number of hashes used to open the header. (The number of opening hashes determines the header level.)\n" +
            "\n" +
            "### Blockquotes\n" +
            "\n" +
            "Markdown uses email-style \\> characters for blockquoting. If you're familiar with quoting passages of text in an email message, then you know how to create a blockquote in Markdown. It looks best if you hard wrap the text and put a \\> before every line:\n" +
            "> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus. Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.  \n" +
            "Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse id sem consectetuer libero luctus adipiscing.  \n" +
            "Markdown allows you to be lazy and only put the \\> before the first line of a hard-wrapped paragraph:\n" +
            "> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus. Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse id sem consectetuer libero luctus adipiscing.  \n" +
            "Blockquotes can be nested (i.e. a blockquote-in-a-blockquote) by adding additional levels of \\>:\n" +
            "> This is the first level of quoting.\n" +
            "> This is nested blockquote.  \n" +
            "Back to the first level.  \n" +
            "Blockquotes can contain other Markdown elements, including headers, lists, and code blocks:\n" +
            ">\n" +
            "> This is a header.\n" +
            "> -----------------\n" +
            ">\n" +
            "> 1. This is the first list item.\n" +
            "> 2. This is the second list item.\n" +
            ">\n" +
            "> Here's some example code:\n" +
            ">\n" +
            "> ```\n" +
            "> return shell_exec(\"echo $input | $markdown_script\");\n" +
            "> ```\n" +
            "\n" +
            "Any decent text editor should make email-style quoting easy. For example, with BBEdit, you can make a selection and choose Increase Quote Level from the Text menu.\n" +
            "\n" +
            "### Lists\n" +
            "\n" +
            "Markdown supports ordered (numbered) and unordered (bulleted) lists.  \n" +
            "Unordered lists use asterisks, pluses, and hyphens -- interchangably -- as list markers:\n" +
            "\n" +
            "* Red\n" +
            "* Green\n" +
            "* Blue\n" +
            "\n" +
            "is equivalent to:\n" +
            "\n" +
            "* Red\n" +
            "* Green\n" +
            "* Blue\n" +
            "\n" +
            "and:\n" +
            "\n" +
            "* Red\n" +
            "* Green\n" +
            "* Blue\n" +
            "\n" +
            "Ordered lists use numbers followed by periods:\n" +
            "\n" +
            "1. Bird\n" +
            "2. McHale\n" +
            "3. Parish\n" +
            "\n" +
            "It's important to note that the actual numbers you use to mark the list have no effect on the HTML output Markdown produces. The HTML Markdown produces from the above list is:  \n" +
            "If you instead wrote the list in Markdown like this:\n" +
            "\n" +
            "1. Bird\n" +
            "2. McHale\n" +
            "3. Parish\n" +
            "\n" +
            "or even:\n" +
            "\n" +
            "1. Bird\n" +
            "2. McHale\n" +
            "3. Parish\n" +
            "\n" +
            "you'd get the exact same HTML output. The point is, if you want to, you can use ordinal numbers in your ordered Markdown lists, so that the numbers in your source match the numbers in your published HTML. But if you want to be lazy, you don't have to.  \n" +
            "To make lists look nice, you can wrap items with hanging indents:\n" +
            "\n" +
            "* Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus. Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "* Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "But if you want to be lazy, you don't have to:\n" +
            "\n" +
            "* Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus. Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.\n" +
            "* Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "List items may consist of multiple paragraphs. Each subsequent paragraph in a list item must be indented by either 4 spaces or one tab:\n" +
            "\n" +
            "   1. This is a list item with two paragraphs. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.  \n" +
            "   Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus. Donec sit amet nisl. Aliquam semper ipsum sit amet velit.\n" +
            "2. Suspendisse id sem consectetuer libero luctus adipiscing.\n" +
            "\n" +
            "It looks nice if you indent every line of the subsequent paragraphs, but here again, Markdown will allow you to be lazy:\n" +
            "\n" +
            "  * This is a list item with two paragraphs.  \n" +
            "  This is the second paragraph in the list item. You're only required to indent the first line. Lorem ipsum dolor sit amet, consectetuer adipiscing elit.\n" +
            "* Another item in the same list.\n" +
            "\n" +
            "To put a blockquote within a list item, the blockquote's \\> delimiters need to be indented:\n" +
            "\n" +
            "* A list item with a blockquote:\n" +
            "  > This is a blockquote inside a list item.\n" +
            "\n" +
            "To put a code block within a list item, the code block needs to be indented *twice* -- 8 spaces or two tabs:\n" +
            "\n" +
            "* A list item with a code block:\n" +
            "\n" +
            "  ```\n" +
            "  <code goes here>\n" +
            "  ```\n" +
            "\n" +
            "### Code Blocks\n" +
            "\n" +
            "Pre-formatted code blocks are used for writing about programming or markup source code. Rather than forming normal paragraphs, the lines of a code block are interpreted literally. Markdown wraps a code block in both \\<pre\\> and \\<code\\> tags.  \n" +
            "To produce a code block in Markdown, simply indent every line of the block by at least 4 spaces or 1 tab.  \n" +
            "This is a normal paragraph:\n" +
            "\n" +
            "```\n" +
            "This is a code block.\n" +
            "```\n" +
            "\n" +
            "Here is an example of AppleScript:\n" +
            "\n" +
            "```\n" +
            "tell application \"Foo\"\n" +
            "    beep\n" +
            "end tell\n" +
            "```\n" +
            "\n" +
            "A code block continues until it reaches a line that is not indented (or the end of the article).  \n" +
            "Within a code block, ampersands (\\&) and angle brackets (\\< and \\>) are automatically converted into HTML entities. This makes it very easy to include example HTML source code using Markdown -- just paste it and indent it, and Markdown will handle the hassle of encoding the ampersands and angle brackets. For example, this:\n" +
            "\n" +
            "```\n" +
            "<div class=\"footer\">\n" +
            "    &copy; 2004 Foo Corporation\n" +
            "</div>\n" +
            "```\n" +
            "\n" +
            "Regular Markdown syntax is not processed within code blocks. E.g., asterisks are just literal asterisks within a code block. This means it's also easy to use Markdown to write about Markdown's own syntax.\n" +
            "\n" +
            "```\n" +
            "tell application \"Foo\"\n" +
            "    beep\n" +
            "end tell\n" +
            "```\n" +
            "\n" +
            "Span Elements\n" +
            "-------------\n" +
            "\n" +
            "### Links\n" +
            "\n" +
            "Markdown supports two style of links: *inline* and *reference*.  \n" +
            "In both styles, the link text is delimited by \\[square brackets\\].  \n" +
            "To create an inline link, use a set of regular parentheses immediately after the link text's closing square bracket. Inside the parentheses, put the URL where you want the link to point, along with an *optional* title for the link, surrounded in quotes. For example:  \n" +
            "This is an example inline link.  \n" +
            "This link has no title attribute.\n" +
            "\n" +
            "### Emphasis\n" +
            "\n" +
            "Markdown treats asterisks (\\*) and underscores (_) as indicators of emphasis. Text wrapped with one \\* or _ will be wrapped with an HTML \\<em\\> tag; double \\*'s or _'s will be wrapped with an HTML \\<strong\\> tag. E.g., this input:  \n" +
            "*single asterisks*  \n" +
            "*single underscores*  \n" +
            "**double asterisks**  \n" +
            "**double underscores**\n" +
            "\n" +
            "### Code\n" +
            "\n" +
            "To indicate a span of code, wrap it with backtick quotes (\\`). Unlike a pre-formatted code block, a code span indicates code within a normal paragraph. For example:  \n" +
            "Use the printf() function.\n" +
            "Markdown Test Page\n" +
            "\n" +
            "* Headings\n" +
            "* Paragraphs\n" +
            "* Blockquotes\n" +
            "* Lists\n" +
            "* Horizontal rule\n" +
            "* Table\n" +
            "* Code\n" +
            "* Inline elements\n" +
            "\n" +
            "Headings Heading one  \n" +
            "Sint sit cillum pariatur eiusmod nulla pariatur ipsum. Sit laborum anim qui mollit tempor pariatur nisi minim dolor. Aliquip et adipisicing sit sit fugiat commodo id sunt. Nostrud enim ad commodo incididunt cupidatat in ullamco ullamco Lorem cupidatat velit enim et Lorem. Ut laborum cillum laboris fugiat culpa sint irure do reprehenderit culpa occaecat. Exercitation esse mollit tempor magna aliqua in occaecat aliquip veniam reprehenderit nisi dolor in laboris dolore velit.\n" +
            "\n" +
            "Heading two\n" +
            "-----------\n" +
            "\n" +
            "Aute officia nulla deserunt do deserunt cillum velit magna. Officia veniam culpa anim minim dolore labore pariatur voluptate id ad est duis quis velit dolor pariatur enim. Incididunt enim excepteur do veniam consequat culpa do voluptate dolor fugiat ad adipisicing sit. Labore officia est adipisicing dolore proident eiusmod exercitation deserunt ullamco anim do occaecat velit. Elit dolor consectetur proident sunt aliquip est do tempor quis aliqua culpa aute. Duis in tempor exercitation pariatur et adipisicing mollit irure tempor ut enim esse commodo laboris proident. Do excepteur laborum anim esse aliquip eu sit id Lorem incididunt elit irure ea nulla dolor et. Nulla amet fugiat qui minim deserunt enim eu cupidatat aute officia do velit ea reprehenderit.\n" +
            "\n" +
            "### Heading three\n" +
            "\n" +
            "Voluptate cupidatat cillum elit quis ipsum eu voluptate fugiat consectetur enim. Quis ut voluptate culpa ex anim aute consectetur dolore proident voluptate exercitation eiusmod. Esse in do anim magna minim culpa sint. Adipisicing ipsum consectetur proident ullamco magna sit amet aliqua aute fugiat laborum exercitation duis et.\n" +
            "\n" +
            "#### Heading four\n" +
            "\n" +
            "Commodo fugiat aliqua minim quis pariatur mollit id tempor. Non occaecat minim esse enim aliqua adipisicing nostrud duis consequat eu adipisicing qui. Minim aliquip sit excepteur ipsum consequat laborum pariatur excepteur. Veniam fugiat et amet ad elit anim laborum duis mollit occaecat et et ipsum et reprehenderit. Occaecat aliquip dolore adipisicing sint labore occaecat officia fugiat. Quis adipisicing exercitation exercitation eu amet est laboris sunt nostrud ipsum reprehenderit ullamco. Enim sint ut consectetur id anim aute voluptate exercitation mollit dolore magna magna est Lorem. Ut adipisicing adipisicing aliqua ullamco voluptate labore nisi tempor esse magna incididunt.\n" +
            "Heading five  \n" +
            "Veniam enim esse amet veniam deserunt laboris amet enim consequat. Minim nostrud deserunt cillum consectetur commodo eu enim nostrud ullamco occaecat excepteur. Aliquip et ut est commodo enim dolor amet sint excepteur. Amet ad laboris laborum deserunt sint sunt aliqua commodo ex duis deserunt enim est ex labore ut. Duis incididunt velit adipisicing non incididunt adipisicing adipisicing. Ad irure duis nisi tempor eu dolor fugiat magna et consequat tempor eu ex dolore. Mollit esse nisi qui culpa ut nisi ex proident culpa cupidatat cillum culpa occaecat anim. Ut officia sit ea nisi ea excepteur nostrud ipsum et nulla.\n" +
            "Heading six  \n" +
            "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.  \n" +
            "\\[Top\\]\n" +
            "Paragraphs  \n" +
            "Incididunt ex adipisicing ea ullamco consectetur in voluptate proident fugiat tempor deserunt reprehenderit ullamco id dolore laborum. Do laboris laboris minim incididunt qui consectetur exercitation adipisicing dolore et magna consequat magna anim sunt. Officia fugiat Lorem sunt pariatur incididunt Lorem reprehenderit proident irure. Dolore ipsum aliqua mollit ad officia fugiat sit eu aliquip cupidatat ipsum duis laborum laborum fugiat esse. Voluptate anim ex dolore deserunt ea ex eiusmod irure. Occaecat excepteur aliqua exercitation aliquip dolor esse eu eu.  \n" +
            "Officia dolore laborum aute incididunt commodo nisi velit est est elit et dolore elit exercitation. Enim aliquip magna id ipsum aliquip consectetur ad nulla quis. Incididunt pariatur dolor consectetur cillum enim velit cupidatat laborum quis ex.  \n" +
            "Officia irure in non voluptate adipisicing sit amet tempor duis dolore deserunt enim ut. Reprehenderit incididunt in ad anim et deserunt deserunt Lorem laborum quis. Enim aute anim labore proident laboris voluptate elit excepteur in. Ex labore nulla velit officia ullamco Lorem Lorem id do. Dolore ullamco ipsum magna dolor pariatur voluptate ipsum id occaecat ipsum. Dolore tempor quis duis commodo quis quis enim.  \n" +
            "\\[Top\\]\n" +
            "Blockquotes  \n" +
            "Ad nisi laborum aute cupidatat magna deserunt eu id laboris id. Aliquip nulla cupidatat sint ex Lorem mollit laborum dolor amet est ut esse aute. Nostrud ex consequat id incididunt proident ipsum minim duis aliqua ut ex et ad quis. Laborum sint esse cillum anim nulla cillum consectetur aliqua sit. Nisi excepteur cillum labore amet excepteur commodo enim occaecat consequat ipsum proident exercitation duis id in.\n" +
            "Ipsum et cupidatat mollit exercitation enim duis sunt irure aliqua reprehenderit mollit. Pariatur Lorem pariatur laboris do culpa do elit irure. Eiusmod amet nulla voluptate velit culpa et aliqua ad reprehenderit sit ut.  \n" +
            "Labore ea magna Lorem consequat aliquip consectetur cillum duis dolore. Et veniam dolor qui incididunt minim amet laboris sit. Dolore ad esse commodo et dolore amet est velit ut nisi ea. Excepteur ea nulla commodo dolore anim dolore adipisicing eiusmod labore id enim esse quis mollit deserunt est. Minim ea culpa voluptate nostrud commodo proident in duis aliquip minim.\n" +
            "Qui est sit et reprehenderit aute est esse enim aliqua id aliquip ea anim. Pariatur sint reprehenderit mollit velit voluptate enim consectetur sint enim. Quis exercitation proident elit non id qui culpa dolore esse aliquip consequat.  \n" +
            "Ipsum excepteur cupidatat sunt minim ad eiusmod tempor sit.\n" +
            "Deserunt excepteur adipisicing culpa pariatur cillum laboris ullamco nisi fugiat cillum officia. In cupidatat nulla aliquip tempor ad Lorem Lorem quis voluptate officia consectetur pariatur ex in est duis. Mollit id esse est elit exercitation voluptate nostrud nisi laborum magna dolore dolore tempor in est consectetur.  \n" +
            "Adipisicing voluptate ipsum culpa voluptate id aute laboris labore esse fugiat veniam ullamco occaecat do ut. Tempor et esse reprehenderit veniam proident ipsum irure sit ullamco et labore ea excepteur nulla labore ut. Ex aute minim quis tempor in eu id id irure ea nostrud dolor esse.  \n" +
            "\\[Top\\]\n" +
            "Lists\n" +
            "\n" +
            "### Ordered List\n" +
            "\n" +
            "1. Longan\n" +
            "2. Lychee\n" +
            "3. Excepteur ad cupidatat do elit laborum amet cillum reprehenderit consequat quis. Deserunt officia esse aliquip consectetur duis ut labore laborum commodo aliquip aliquip velit pariatur dolore.\n" +
            "4. Marionberry\n" +
            "5. Melon\n" +
            "   * Cantaloupe\n" +
            "   * Honeydew\n" +
            "   * Watermelon\n" +
            "6. Miracle fruit\n" +
            "7. Mulberry\n" +
            "\n" +
            "### Unordered List\n" +
            "\n" +
            "* Olive\n" +
            "* Orange\n" +
            "  * Blood orange\n" +
            "  * Clementine\n" +
            "* Papaya\n" +
            "* Ut aute ipsum occaecat nisi culpa Lorem id occaecat cupidatat id id magna laboris ad duis. Fugiat cillum dolore veniam nostrud proident sint consectetur eiusmod irure adipisicing.\n" +
            "* Passionfruit\n" +
            "\n" +
            "\\[Top\\]\n" +
            "Horizontal rule  \n" +
            "In dolore velit aliquip labore mollit minim tempor veniam eu veniam ad in sint aliquip mollit mollit. Ex occaecat non deserunt elit laborum sunt tempor sint consequat culpa culpa qui sit. Irure ad commodo eu voluptate mollit cillum cupidatat veniam proident amet minim reprehenderit.  \n" +
            "In laboris eiusmod reprehenderit aliquip sit proident occaecat. Non sit labore anim elit veniam Lorem minim commodo eiusmod irure do minim nisi. Dolor amet cillum excepteur consequat sint non sint.  \n" +
            "\\[Top\\]\n" +
            "Table  \n" +
            "Duis sunt ut pariatur reprehenderit mollit mollit magna dolore in pariatur nulla commodo sit dolor ad fugiat. Laboris amet ea occaecat duis eu enim exercitation deserunt ea laborum occaecat reprehenderit. Et incididunt dolor commodo consequat mollit nisi proident non pariatur in et incididunt id. Eu ut et Lorem ea ex magna minim ipsum ipsum do.  \n" +
            "\\| Table Heading 1 \\| Table Heading 2 \\| Center align \\| Right align \\| Table Heading 5 \\| \\| :-------------- \\| :-------------- \\| :-------------: \\| --------------: \\| :-------------- \\| \\| Item 1 \\| Item 2 \\| Item 3 \\| Item 4 \\| Item 5 \\| \\| Item 1 \\| Item 2 \\| Item 3 \\| Item 4 \\| Item 5 \\| \\| Item 1 \\| Item 2 \\| Item 3 \\| Item 4 \\| Item 5 \\| \\| Item 1 \\| Item 2 \\| Item 3 \\| Item 4 \\| Item 5 \\| \\| Item 1 \\| Item 2 \\| Item 3 \\| Item 4 \\| Item 5 \\|  \n" +
            "Minim id consequat adipisicing cupidatat laborum culpa veniam non consectetur et duis pariatur reprehenderit eu ex consectetur. Sunt nisi qui eiusmod ut cillum laborum Lorem officia aliquip laboris ullamco nostrud laboris non irure laboris. Cillum dolore labore Lorem deserunt mollit voluptate esse incididunt ex dolor.  \n" +
            "\\[Top\\]\n" +
            "Code\n" +
            "\n" +
            "Inline code\n" +
            "-----------\n" +
            "\n" +
            "Ad amet irure est magna id mollit Lorem in do duis enim. Excepteur velit nisi magna ea pariatur pariatur ullamco fugiat deserunt sint non sint. Duis duis est code in text velit velit aute culpa ex quis pariatur pariatur laborum aute pariatur duis tempor sunt ad. Irure magna voluptate dolore consectetur consectetur irure esse. Anim magna \\<strong\\>in culpa qui officia\\</strong\\> dolor eiusmod esse amet aute cupidatat aliqua do id voluptate cupidatat reprehenderit amet labore deserunt.\n" +
            "\n" +
            "Highlighted\n" +
            "-----------\n" +
            "\n" +
            "Et fugiat ad nisi amet magna labore do cillum fugiat occaecat cillum Lorem proident. In sint dolor ullamco ad do adipisicing amet id excepteur Lorem aliquip sit irure veniam laborum duis cillum. Aliqua occaecat minim cillum deserunt magna sunt laboris do do irure ea nostrud consequat ut voluptate ex.\n" +
            "\n" +
            "```\n" +
            "package main\n" +
            "\n" +
            "import (\n" +
            "    \"fmt\"\n" +
            "    \"net/http\"\n" +
            ")\n" +
            "\n" +
            "func handler(w http.ResponseWriter, r *http.Request) {\n" +
            "    fmt.Fprintf(w, \"Hi there, I love %s!\", r.URL.Path[1:])\n" +
            "}\n" +
            "\n" +
            "func main() {\n" +
            "    http.HandleFunc(\"/\", handler)\n" +
            "    http.ListenAndServe(\":8080\", nil)\n" +
            "}\n" +
            "```\n" +
            "\n" +
            "Ex amet id ex aliquip id do laborum excepteur exercitation elit sint commodo occaecat nostrud est. Nostrud pariatur esse veniam laborum non sint magna sit laboris minim in id. Aliqua pariatur pariatur excepteur adipisicing irure culpa consequat commodo et ex id ad.  \n" +
            "\\[Top\\]\n" +
            "Inline elements  \n" +
            "Sint ea anim ipsum ad commodo cupidatat do **exercitation** incididunt et minim ad labore sunt. Minim deserunt labore laboris velit nulla incididunt ipsum nulla. Ullamco ad laborum ea qui et anim in laboris exercitation tempor sit officia laborum reprehenderit culpa velit quis. **Consequat commodo** reprehenderit duis irure esse esse exercitation minim enim Lorem dolore duis irure. Nisi Lorem reprehenderit ea amet excepteur dolor excepteur magna labore proident voluptate ipsum. Reprehenderit ex esse deserunt aliqua ea officia mollit Lorem nulla magna enim. Et ad ipsum labore enim ipsum **cupidatat consequat**. Commodo non ea cupidatat magna deserunt dolore ipsum velit nulla elit veniam nulla eiusmod proident officia.  \n" +
            "*Proident sit veniam in est proident officia adipisicing* ea tempor cillum non cillum velit deserunt. Voluptate laborum incididunt sit consectetur Lorem irure incididunt voluptate nostrud. Commodo ut eiusmod tempor cupidatat esse enim minim ex anim consequat. Mollit sint culpa qui laboris quis consectetur ad sint esse. Amet anim anim minim ullamco et duis non irure. Sit tempor adipisicing ea laboris culpa ex duis sint anim aute reprehenderit id eu ea. Aute excepteur proident Lorem minim adipisicing nostrud mollit ad ut voluptate do nulla esse occaecat aliqua sint anim.  \n" +
            "Incididunt in culpa cupidatat mollit cillum qui proident sit. In cillum aliquip incididunt voluptate magna amet cupidatat cillum pariatur sint aliqua est *enim **anim** voluptate* . Magna aliquip proident incididunt id duis pariatur eiusmod incididunt commodo culpa dolore sit. Culpa do nostrud elit ad exercitation anim pariatur non minim nisi **adipisicing sunt *officia***. Do deserunt magna mollit Lorem commodo ipsum do cupidatat mollit enim ut elit veniam ea voluptate.  \n" +
            "Reprehenderit non eu quis in ad elit esse qui aute id incididunt dolore cillum. Esse laboris consequat dolor anim exercitation tempor aliqua deserunt velit magna laboris. Culpa culpa minim duis amet mollit do quis amet commodo nulla irure.\n";

    @Inject
    private MarkdownAndQuillUtil markdownAndQuillUtil;
    @Inject
    private Sanitizer sanitizer;

    @Override
    protected void configure() {
        super.configure();

        bindMock(AmazonS3.class);

        install(Modules.override(
                MarkdownAndQuillUtil.module(),
                Sanitizer.module(),
                S3ContentStore.module()
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
    public void testConvert() throws Exception {
        String html = markdownAndQuillUtil.markdownToQuill("project-1", "test", "test", MARKDOWN_SAMPLE);
        String markdown = markdownAndQuillUtil.quillToMarkdown(html);

        assertEquals(html, sanitizer.richHtml(html, "test", "1", "project-1", false));
        assertEquals(MARKDOWN_SAMPLE_SANITIZED, markdown);
    }

    @Test(timeout = 10_000L)
    public void testMarkdown() throws Exception {
        assertEquals("\n> asfd\n> fdsa\n",
                markdownAndQuillUtil.markdownQuote(
                        "asfd\nfdsa"));
        assertEquals("**Matus** wrote:\n\nasfd\nfdsa",
                markdownAndQuillUtil.markdownSign(
                        "Matus",
                        "wrote",
                        "asfd\nfdsa"));
    }
}