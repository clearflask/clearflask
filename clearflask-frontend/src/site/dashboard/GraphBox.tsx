import { SvgIconTypeMap, Typography } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    boxShadow: '0px 0px 40px 0 rgba(0,0,0,0.04)',
    border: '1px solid ' + theme.palette.grey[300],
    display: 'inline-grid',
    gridTemplateColumns: '1fr auto',
    gridTemplateRows: '1fr auto',
    gridTemplateAreas:
      "'t t'"
      + " 'v c'",
    gap: theme.spacing(2, 2),
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
  chart: {
    gridArea: 'c',
    alignSelf: 'center',
  },
  value: {
    gridArea: 'v',
    fontSize: '3em',
    alignSelf: 'center',
    margin: theme.spacing(0, 4),
  },
  title: {
    gridArea: 't',
    fontSize: '1.3em',
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    marginRight: theme.spacing(2),
  },
});
interface Props {
  className?: string;
  icon?: OverridableComponent<SvgIconTypeMap>;
  title: React.ReactNode;
  value?: React.ReactNode;
  chart: React.ReactNode;
}
class GraphBox extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const Icon = this.props.icon || null;
    return (
      <div className={classNames(this.props.classes.container, this.props.className)}>
        <Typography
          className={this.props.classes.title}
          component='div'>
          {!!Icon && (
            <Icon
              className={this.props.classes.icon}
              fontSize='inherit'
              color='inherit'
            />
          )}
          {this.props.title}
        </Typography>
        {!!this.props.value && (
          <Typography
            className={this.props.classes.value}
            component='div'>
            {this.props.value}
          </Typography>
        )}
        <div className={this.props.classes.chart}>
          {this.props.chart}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(GraphBox);
