// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { SvgIcon } from '@material-ui/core';
import LoadingIcon from '@material-ui/icons/MoreHoriz';
import React from 'react';
import Promised from '../Promised';
import DiscordIcon from './DiscordIcon';
import GitlabIcon from './GitlabIcon';
import GoogleIcon from './GoogleIcon';
import GuestIcon from './GuestIcon';
import LinkAltIcon from './LinkAltIcon';
import LinkedInIcon from './LinkedInIcon';
import LockSimpleIcon from './LockSimpleIcon';
import LogoutIcon from './LogoutIcon';
import MicrosoftIcon from './MicrosoftIcon';
import OpenSourceIcon from './OpenSourceIcon';
import PinIcon from './PinIcon';
import TwitchIcon from './TwitchIcon';
import UnLinkAltIcon from './UnLinkAltIcon';
import VisitIcon from './VisitIcon';

const IconOverrides = {
  'Google': GoogleIcon,
  'Guest': GuestIcon,
  'LockSimple': LockSimpleIcon,
  'Logout': LogoutIcon,
  'Visit': VisitIcon,
  'Gitlab': GitlabIcon,
  'Discord': DiscordIcon,
  'Microsoft': MicrosoftIcon,
  'Twitch': TwitchIcon,
  'LinkedIn': LinkedInIcon,
  'Pin': PinIcon,
  'LinkAlt': LinkAltIcon,
  'UnLinkAlt': UnLinkAltIcon,
  'OpenSource': OpenSourceIcon,
};

const DynamicMuiIcon = (props: {
  name: string;
} & React.ComponentProps<typeof SvgIcon>) => {
  var { name, ...iconProps } = props;
  if (!name.match(/^[a-zA-Z]+$/)) return null;

  // Special icons not found in Mui
  var IconOverride = IconOverrides[name];
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
