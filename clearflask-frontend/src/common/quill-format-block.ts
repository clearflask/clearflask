// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * - Change <p> tag to <div> for default Block blot
 */
import Quill from 'quill';
const QuillBlockExtended = Quill.import('blots/block');

QuillBlockExtended.tagName = 'DIV';

export default QuillBlockExtended;
