// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Collapse, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { initialWidth } from '../../common/util/screenUtil';
import DividerCorner from '../utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  explorer: {
    display: 'grid',
    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: 'auto 1fr',
      gridTemplateRows: 'auto 1fr',
      gridTemplateAreas:
        "'t t'"
        + " 'cc r'",
    },
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'auto auto auto',
      gridTemplateAreas:
        "'t'"
        + " 'cc'"
        + " 'r'",
    },
  },
  dashboard: {
  },
  top: {
    gridArea: 't',
    alignSelf: 'end',
    display: 'flex',
    alignItems: 'flex-end',
    minWidth: 0,
  },
  results: {
    gridArea: 'r',
    minWidth: 0,
  },
  search: {
    flexGrow: 1,
  },
  similarLabel: {
    flexGrow: 1,
  },
  flexGrow: {
    flexGrow: 1,
  },
  createCollapsibleVertical: {
    marginBottom: theme.spacing(2),
  },
  searchContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  createVisible: {
    transition: theme.transitions.create(['min-width', 'width'], { duration: theme.explorerExpandTimeout }),
    maxWidth: '100vw',
    display: 'flex',
  },
  createCollapsible: {
    gridArea: 'cc',
    transition: theme.transitions.create(['max-width', 'width'], { duration: theme.explorerExpandTimeout }),
    maxWidth: '100vw',
    minWidth: 0,
  },
});
interface Props {
  isDashboard?: boolean;
  className?: string;
  createSize?: number | string;
  searchSize?: number | string;
  createShown?: boolean;
  similarShown?: boolean;
  similarLabel?: React.ReactNode;
  createVisible?: React.ReactNode;
  createCollapsible?: React.ReactNode;
  search?: React.ReactNode;
  content: React.ReactNode;
}
interface State {
  hasExpanded?: boolean;
}
class ExplorerTemplate extends Component<Props & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {

  constructor(props) {
    super(props);

    this.state = {
      hasExpanded: props.createShown,
    };
  }

  render() {
    const expandDirectionHorizontal = !this.props.isDashboard && (!this.props.width || isWidthUp('sm', this.props.width, true));

    const labelContainer = (
      <Collapse in={this.props.similarShown}>
        <div className={this.props.classes.similarLabel}>
          {this.props.similarLabel}
        </div>
      </Collapse>
    );
    const createVisible = !!this.props.createVisible && (
      <div className={this.props.classes.createVisible} style={{
        minWidth: this.props.createSize,
        width: this.props.createSize,
      }}>
        {this.props.createVisible}
      </div>
    );
    const createCollapsible = !!this.props.createCollapsible && (
      <div
        className={this.props.classes.createCollapsible}
        style={{
          width: this.props.createShown ? this.props.createSize : '0px',
          maxWidth: this.props.createShown ? this.props.createSize : '0px',
        }}
      >
        <Collapse
          in={this.props.createShown || false}
          mountOnEnter
          unmountOnExit
          onEntered={() => this.setState({ hasExpanded: true })}
          onExited={() => this.setState({ hasExpanded: false })}
          timeout={this.props.theme.explorerExpandTimeout}
          style={{
            minWidth: '120px',
          }}
        >
          <div className={classNames(!expandDirectionHorizontal && this.props.classes.createCollapsibleVertical)}>
            {this.props.createCollapsible}
          </div>
          {!expandDirectionHorizontal && this.props.similarLabel && labelContainer}
        </Collapse>
      </div>
    );

    const search = !!this.props.search && (
      <Collapse in={!this.props.similarShown}>
        <div className={this.props.classes.searchContainer}>
          <div className={this.props.classes.search}>
            {this.props.search}
          </div>
        </div>
      </Collapse>
    );

    var results = this.props.content;

    if (!!this.props.search || !!this.props.createVisible) {
      results = (
        <DividerCorner
          isExplorer
          width={!this.props.createVisible
            ? 0
            : (this.props.createShown
              ? (this.props.similarShown ? 80 : 50)
              : (this.props.createSize || 0))}
          height={(!this.props.createVisible || !!this.props.isDashboard)
            ? 0
            : (this.props.createShown ? 180 : 50)}
          widthRight={this.props.searchSize !== undefined
            ? (this.props.similarShown
              ? 0
              : this.props.searchSize)
            : undefined}
          heightRight={!!this.props.isDashboard
            ? 0
            : (!!this.props.search
              ? (this.props.similarShown ? 0 : 50)
              : undefined)}
          header={!!expandDirectionHorizontal ? undefined : (
            <>
              {createVisible}
              {createCollapsible}
            </>
          )}
          headerRight={!!expandDirectionHorizontal ? undefined : search}
          grow={this.props.isDashboard ? 'left' : 'center'}
          margins={this.props.theme.spacing(4)}
        >
          {results}
        </DividerCorner >
      );
    }
    return (
      <div className={classNames(this.props.classes.explorer, this.props.className, !!this.props.isDashboard && this.props.classes.dashboard)}>
        <div className={this.props.classes.top}>
          {!!expandDirectionHorizontal && createVisible}
          {expandDirectionHorizontal && this.props.similarLabel && labelContainer}
          <div className={this.props.classes.flexGrow} />
          {!!expandDirectionHorizontal && search}
        </div>
        {!!expandDirectionHorizontal && createCollapsible}
        <div className={this.props.classes.results}>
          {results}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(ExplorerTemplate)));
