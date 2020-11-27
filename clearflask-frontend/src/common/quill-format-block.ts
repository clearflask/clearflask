/**
 * - Change <p> tag to <div> for default Block blot
 */
import Quill from 'quill';
const QuillBlockExtended = Quill.import('blots/block');

QuillBlockExtended.tagName = 'DIV';

export default QuillBlockExtended;
