import { SvgIcon } from '@material-ui/core';
import LoadingIcon from '@material-ui/icons/MoreHoriz';
import React from 'react';
import Promised from '../Promised';

const DynamicMuiIcon = (props: {
  name: string;
} & React.ComponentProps<typeof SvgIcon>) => {
  var { name, ...iconProps } = props;
  if (!name.match(/^[a-zA-Z]+$/)) return null;

  // Special icons not found in Mui
  if (name === 'Roadmap') {
    name = 'EqualizerRounded';
    iconProps = {
      ...iconProps,
      style: {
        ...iconProps?.style,
        transform: 'rotate(180deg)',
      },
    };
  }

  return (
    <Promised
      key={name}
      promise={import(/* webpackChunkName: "DynamicMuiIcons", webpackMode: "lazy-once" */`@material-ui/icons/${name}.js`)
        .catch(err => null)
        .then(i => i?.default)}
      render={Icon => Icon && (<Icon {...iconProps} />)}
      renderError={err => null}
      // keep the space occupied while loading
      renderLoading={() => (<LoadingIcon style={{ visibility: 'hidden' }} />)}
    />
  );
}
export default DynamicMuiIcon;
