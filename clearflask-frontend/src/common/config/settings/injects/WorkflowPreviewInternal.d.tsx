// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

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
