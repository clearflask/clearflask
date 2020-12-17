import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { ReduxState } from '../api/server';
import { setAppTitle } from '../common/util/titleUtil';
import Footer from './Footer';

const styles = (theme: Theme) => createStyles({
  // Required for AnimatedSwitch to overlap two pages during animation
  animationContainer: {
    flexGrow: 1,
    // position: 'absolute' as 'absolute',
    width: '100%',
  },
  page: {
    maxWidth: '1024px',
    margin: '0px auto',
  },
  anchor: {
    position: 'relative' as 'relative',
  },
});

interface Props {
  children?: React.ReactNode;
  showFooter?: boolean;
  customPageSlug?: string;
  pageTitle?: string;
  suppressPageTitle?: boolean,
}
interface ConnectProps {
  titleText?: string;
  projectName?: string,
  suppressSetTitle: boolean,
}
class BasePage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  readonly styles = {
  };

  render() {
    if (!this.props.suppressSetTitle && !!this.props.projectName) {
      setAppTitle(this.props.projectName, this.props.titleText);
    }
    return (
      <React.Fragment>
        <div className={this.props.classes.animationContainer}>
          <div className={this.props.classes.page}>
            <div className={this.props.classes.anchor}>
              {this.props.children}
            </div>
          </div>
        </div>
        {!!this.props.showFooter && (
          <Footer customPageSlug={this.props.customPageSlug} />
        )}
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    projectName: state.conf.conf?.layout.pageTitleSuffix || state.conf.conf?.name,
    suppressSetTitle: !!ownProps.suppressPageTitle || !!state.settings.suppressSetTitle,
    titleText: ownProps.pageTitle,
  };
  if (!connectProps.titleText && !!ownProps.customPageSlug) {
    const page = state.conf.conf?.layout.pages.find(p => p.slug === ownProps.customPageSlug);
    connectProps.titleText = page?.pageTitle || page?.name;
  }
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BasePage));
