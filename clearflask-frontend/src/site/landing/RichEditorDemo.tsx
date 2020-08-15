import React, { Component, useState } from 'react';
import { Project } from '../DemoApp';
import RichEditor from '../../common/RichEditor';
import { StandardTextFieldProps } from '@material-ui/core';


const RichEditorDemo = (props: {valueInit?: string}) => {
  const [value, setValue] = useState<string | undefined>(props.valueInit);
  return (
    <RichEditor
      value={value || ''}
      onChange={e => setValue(e.target.value)}
      fullWidth
      multiline
      rows={1}
      rowsMax={15}
    />
  );
}

export default RichEditorDemo;
