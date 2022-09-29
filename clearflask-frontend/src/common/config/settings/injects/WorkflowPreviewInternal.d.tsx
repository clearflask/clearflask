// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
