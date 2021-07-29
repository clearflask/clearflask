
import * as ConfigEditor from '../../configEditor';

export interface WorkflowPreviewInternalProps {
  // Injected by WorkflowPreview
  className?: string;
  style?: any;
  fontFamily?: string;

  categoryIndex: number;
  editor: ConfigEditor.Editor;
  isVertical?: boolean;
  static?: boolean;
  renderLabel?: (statusId: string, name: string) => string;
}
