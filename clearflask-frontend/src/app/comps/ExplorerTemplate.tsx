import { Collapse, Fade, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
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
      gridTemplateColumns: '100%',
      gridTemplateRows: 'auto auto auto',
      gridTemplateAreas:
        "'t'"
        + " 'cc'"
        + " 'r'",
    },
  },
  top: {
    gridArea: 't',
    alignSelf: 'end',
    display: 'flex',
    alignItems: 'flex-end',
  },
  results: {
    gridArea: 'r',
  },
  search: {
    flexGrow: 1,
  },
  createLabel: {
    flexGrow: 1,
  },
  flexGrow: {
    flexGrow: 1,
  },
  createLabelVertical: {
    marginTop: theme.spacing(2),
  },
  searchAndCreateLabelContainer: {
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
  },
});
interface Props {
  className?: string;
  createSize?: number;
  searchSize?: number;
  createShown?: boolean;
  createLabel?: React.ReactNode;
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
    const expandInMotion = (this.props.createShown || false) !== (this.state.hasExpanded || false);
    const expandDirectionHorizontal = !this.props.width || isWidthUp('sm', this.props.width, true);
    var results = this.props.content;
    if (!!this.props.search || !!this.props.createVisible) {
      results = (
        <DividerCorner
          isExplorer
          width={!this.props.createVisible
            ? 0
            : (this.props.createShown
              ? 80
              : (this.props.createSize || 0))}
          height={!this.props.createVisible
            ? 0
            : (this.props.createShown ? 180 : 20)}
          widthRight={this.props.searchSize !== undefined ? (this.props.createShown ? 0 : this.props.searchSize) : undefined}
          heightRight={!!this.props.search ? (this.props.createShown ? 0 : 20) : undefined}
        >
          {results}
        </DividerCorner>
      );
    }
    const labelContainer = (
      <div className={classNames(this.props.classes.createLabel, !expandDirectionHorizontal && this.props.classes.createLabelVertical)}>
        {this.props.createLabel}
      </div>
    );
    return (
      <div className={classNames(this.props.classes.explorer, this.props.className)}>
        <div className={this.props.classes.top}>
          {this.props.createVisible && (
            <div className={this.props.classes.createVisible} style={{
              minWidth: this.props.createSize,
              width: this.props.createSize,
            }}>
              {this.props.createVisible}
            </div>
          )}
          {expandDirectionHorizontal && this.props.createLabel && (
            <Collapse in={!!this.state.hasExpanded && !expandInMotion}>
              {labelContainer}
            </Collapse>
          )}
          <div className={this.props.classes.flexGrow} />
          <div className={this.props.classes.searchAndCreateLabelContainer}>
            {this.props.search && (
              <Collapse in={!this.state.hasExpanded && !expandInMotion}>
                <div className={this.props.classes.search}>
                  {this.props.search}
                </div>
              </Collapse>
            )}
          </div>
        </div>
        {this.props.createCollapsible && (
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
              {this.props.createCollapsible}
              {!expandDirectionHorizontal && this.props.createLabel && (
                <Fade in={!!this.state.hasExpanded && !expandInMotion}>
                  {labelContainer}
                </Fade>
              )}
            </Collapse>
          </div>
        )}
        <div className={this.props.classes.results}>
          {results}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(withWidth()(ExplorerTemplate)));
