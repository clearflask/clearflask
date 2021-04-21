/// <reference path="../@types/transform-media-imports.d.ts"/>
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import LogoImg from '../../public/img/clearflask-logo.png';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(0, 3),
    fontSize: '1.4em',
  },
  image: {
    objectFit: 'contain',
    maxWidth: '48px',
    maxHeight: '48px',
    width: 'auto',
    height: 'auto',
    padding: theme.spacing(1),
  },
  flask: {
    color: theme.palette.primary.main,
  },
});

interface Props {
}
class Logo extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var logo = (
      <div className={this.props.classes.container}>
        <img
          alt=''
          className={this.props.classes.image}
          src={LogoImg.src}
          width={LogoImg.width}
          height={LogoImg.height}
        />
        Clear<span className={this.props.classes.flask}>Flask</span>
      </div>
    );

    return logo;
  }
}

export default withStyles(styles, { withTheme: true })(Logo);
