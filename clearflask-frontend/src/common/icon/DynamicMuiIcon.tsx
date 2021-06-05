import { SvgIcon } from '@material-ui/core';
import LoadingIcon from '@material-ui/icons/MoreHoriz';
import React from 'react';
import Promised from '../Promised';
import DiscordIcon from './DiscordIcon';
import GitlabIcon from './GitlabIcon';
import GoogleIcon from './GoogleIcon';
import GuestIcon from './GuestIcon';
import LockSimpleIcon from './LockSimpleIcon';
import LogoutIcon from './LogoutIcon';
import MicrosoftIcon from './MicrosoftIcon';
import TwitchIcon from './TwitchIcon';
import VisitIcon from './VisitIcon';

const DynamicMuiIcon = (props: {
  name: string;
} & React.ComponentProps<typeof SvgIcon>) => {
  var { name, ...iconProps } = props;
  if (!name.match(/^[a-zA-Z]+$/)) return null;

  var IconOverride;
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
  } else if (name === 'Google') {
    IconOverride = GoogleIcon;
  } else if (name === 'Guest') {
    IconOverride = GuestIcon;
  } else if (name === 'LockSimple') {
    IconOverride = LockSimpleIcon;
  } else if (name === 'Logout') {
    IconOverride = LogoutIcon;
  } else if (name === 'Visit') {
    IconOverride = VisitIcon;
  } else if (name === 'Gitlab') {
    IconOverride = GitlabIcon;
  } else if (name === 'Discord') {
    IconOverride = DiscordIcon;
  } else if (name === 'Microsoft') {
    IconOverride = MicrosoftIcon;
  } else if (name === 'Twitch') {
    IconOverride = TwitchIcon;
  }

  return !!IconOverride ? (
    <IconOverride {...iconProps} />
  ) : (
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
