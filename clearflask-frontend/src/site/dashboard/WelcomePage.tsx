import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import ServerAdmin from '../../api/serverAdmin';

export const WelcomeImagePath = '/img/dashboard/welcome.svg';

const styles = (theme: Theme) => createStyles({
  page: {
    alignSelf: 'center',
    margin: theme.spacing(6),
    display: 'flex',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  button: {
    alignSelf: 'flex-end',
    margin: theme.spacing(2),
  },
  growAndFlex: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  image: {
    padding: theme.spacing(4),
    width: '50%',
    maxWidth: 400,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});
interface Props {
}
class WelcomePage extends Component<Props & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    const account = ServerAdmin.get().getStore().getState().account.account.account;
    this.state = {
      newModName: account?.name,
      newModEmail: account?.email,
      // newItemTitle: 'Add dark mode',
      // newItemDescription: textToRaw('To reduce eye-strain, please add a low-light option. '),
    };
  }

  render() {
    return (
      <div className={classNames(this.props.classes.page, this.props.classes.growAndFlex)}>
        <div className={this.props.classes.content}>
          <img
            alt=''
            className={this.props.classes.image}
            src={WelcomeImagePath}
          />
          <Typography component="h1" variant="h3" color="textPrimary">Welcome!</Typography>
          <Typography component="h2" variant="h5" color="textSecondary">Let's get started and create your first project</Typography>
          <Button
            className={this.props.classes.button}
            variant='contained'
            disableElevation
            component={Link}
            // style={{ fontWeight: 900, color: 'white', }}
            color='primary'
            to='/dashboard/welcome-create'
          >
            Create
            </Button>
        </div>
      </div >
    );
  }
}

export default withStyles(styles, { withTheme: true })(WelcomePage);
