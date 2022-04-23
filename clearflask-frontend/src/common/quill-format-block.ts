// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
/**
 * - Change <p> tag to <div> for default Block blot
 */
import Quill from 'quill';
const QuillBlockExtended = Quill.import('blots/block');

QuillBlockExtended.tagName = 'DIV';

export default QuillBlockExtended;
