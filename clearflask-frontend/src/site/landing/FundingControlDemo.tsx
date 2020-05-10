import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Server } from '../../api/server';
import AppThemeProvider from '../../app/AppThemeProvider';
import FundingControl from '../../app/comps/FundingControl';

const styles = (theme: Theme) => createStyles({
  content: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginDialog: {
    position: 'relative!important' as any,
    width: '100%',
    height: '100%',
  },
  loginPaperScrollBody: {
    marginBottom: 65, // Extend to show shadow
  },
});

interface Props {
  server: Server;
  ideaId?: string;
}
class FundingControlDemo extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const store = this.props.server.getStore();
    const idea = this.props.ideaId ? store.getState().ideas.byId[this.props.ideaId]?.idea : undefined;
    const fundAmount = idea ? store.getState().votes.fundAmountByIdeaId[idea.ideaId] : undefined;
    return (
      <Provider store={store}>
        <AppThemeProvider
          appRootId='fundingControlDemo'
          isInsideContainer={true}
          supressCssBaseline={true}
          breakpoints={{
            'xs': 0,
            'sm': 10000,
            'md': 10000,
            'lg': 10000,
            'xl': 10000,
          }}
        >
          <div id='fundingControlDemo' className={this.props.classes.content}>
            <FundingControl
              server={this.props.server}
              idea={idea}
              fundAmount={fundAmount}
            />
          </div>
        </AppThemeProvider>
      </Provider>
    );
  }
}

// const FundingControlWrapper = (props: { fundingControlProps: FundingControlProps, ideaId: string }) => {
//   const connectProps = useSelector((state: ReduxState) => ({
//     idea: state.ideas.byId[props.ideaId]?.idea,
//     fundAmount: state.votes.fundAmountByIdeaId[props.ideaId] || 0,
//   }))
//   return (
//     <FundingControl
//       idea={connectProps.idea}
//       fundAmount={connectProps.fundAmount}
//       {...props.fundingControlProps}
//     />
//   );
// }

export default withStyles(styles, { withTheme: true })(FundingControlDemo);
