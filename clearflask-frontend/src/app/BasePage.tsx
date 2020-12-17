import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Footer from './Footer';
import { connect } from 'react-redux';
import { ReduxState } from '../api/server';
import setTitle from '../common/util/titleUtil';

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
}
interface ConnectProps {
  pageTitle: string;
  pageTitleSuppressSuffix: boolean;
}
class BasePage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  readonly styles = {
  };

  render() {
    setTitle(this.props.pageTitle, true, this.props.pageTitleSuppressSuffix);
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
    pageTitle: state.conf.conf?.layout.pageTitleDefault || state.conf.conf?.name || 'Feedback',
    pageTitleSuppressSuffix: !!state.conf.conf?.layout.pageTitleDefault,
  };
  if (ownProps.customPageSlug) {
    const customPageTitle = state.conf.conf?.layout.pages.find(p => p.slug === ownProps.customPageSlug)?.pageTitle;
    if(customPageTitle) {
      connectProps.pageTitle = customPageTitle;
      connectProps.pageTitleSuppressSuffix = true;
    }
  }
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BasePage));
