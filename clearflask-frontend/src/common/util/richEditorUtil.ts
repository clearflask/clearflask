// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
export const textToHtml = (text: string): string =>
  `<div>${text}</div>`;

export const quillBold = (html: string): string =>
  `<strong>${html}</strong>`;

export const quillBlockQuote = (html: string): string =>
  `<blockquote>${html}</blockquote>`;

export const quillQuote = (html: string, author: string, genMsg: (author: string) => string): string =>
  textToHtml(genMsg(quillBold(author))) + quillBlockQuote(html);
