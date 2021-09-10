// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

export const textToHtml = (text: string): string =>
  `<div>${text}</div>`;

export const quillBold = (html: string): string =>
  `<strong>${html}</strong>`;

export const quillBlockQuote = (html: string): string =>
  `<blockquote>${html}</blockquote>`;

export const quillQuote = (html: string, author: string, genMsg: (author: string) => string): string =>
  textToHtml(genMsg(quillBold(author))) + quillBlockQuote(html);
