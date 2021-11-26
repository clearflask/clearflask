// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="../@types/transform-media-imports.d.ts"/>
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import LogoImg from '../../public/img/clearflask-logo.png';
import ImgIso from '../common/ImgIso';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    margin: (props: Props) => !props.suppressMargins ? theme.spacing(0, 3) : undefined,
  },
  image: {
    marginRight: 8,
  },
  clear: {
    color: theme.palette.text.primary,
  },
  flask: {
    color: theme.palette.primary.main,
  },
});

interface Props {
  suppressMargins?: boolean;
  suppressName?: boolean;
  scale?: number;
}
class Logo extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const scale = this.props.scale || 1;
    var logo = (
      <div className={this.props.classes.container} style={{
        fontSize: `${1.4 * scale}rem`,
      }}>
        <ImgIso
          alt=''
          className={this.props.classes.image}
          styleOuter={{
            width: 32 * scale,
            height: 32 * scale,
          }}
          img={LogoImg}
          minWidth={32 * scale}
          minHeight={32 * scale}
        />
        {!this.props.suppressName && (
          <>
            <span className={this.props.classes.clear}>Clear</span>
            <span className={this.props.classes.flask}>Flask</span>
          </>
        )}
      </div>
    );

    return logo;
  }
}

export default withStyles(styles, { withTheme: true })(Logo);
