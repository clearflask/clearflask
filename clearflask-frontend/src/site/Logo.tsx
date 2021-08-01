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
    fontSize: '1.4em',
  },
  image: {
    width: 32,
    height: 32,
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
}
class Logo extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var logo = (
      <div className={this.props.classes.container}>
        <ImgIso
          alt=''
          className={this.props.classes.image}
          src={LogoImg.src}
          aspectRatio={LogoImg.aspectRatio}
          width={LogoImg.width}
          height={LogoImg.height}
          maxWidth={LogoImg.width}
          maxHeight={LogoImg.height}
        />
        <span className={this.props.classes.clear}>Clear</span>
        <span className={this.props.classes.flask}>Flask</span>
      </div>
    );

    return logo;
  }
}

export default withStyles(styles, { withTheme: true })(Logo);
