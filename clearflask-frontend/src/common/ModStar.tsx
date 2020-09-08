import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import ModeratorIcon from '@material-ui/icons/Star';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'inline-flex',
    alignItems: 'baseline',
    color: theme.palette.primary.main,
  },
});

interface Props {
  name?: string | React.ReactNode;
  isMod?: boolean;
}

class ModStar extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if(!this.props.isMod) {
      return this.props.name || null;
    }
    return (
      <div className={this.props.classes.container}>
        {this.props.name}
        &nbsp;
        <ModeratorIcon fontSize='inherit' />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ModStar);
