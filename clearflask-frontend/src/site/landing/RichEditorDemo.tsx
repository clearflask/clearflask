import React, { useState } from 'react';
import RichEditor from '../../common/RichEditor';


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
