// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Container, Grid } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  content: {
    display: 'flex',
    flex: '1 1 auto',
    padding: theme.spacing(4),
    justifyContent: 'center',
  },
});
interface Props {
  maxWidth?: Breakpoint;
}
class WrappingList extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <Container maxWidth={this.props.maxWidth}>
        <Grid container alignItems='baseline' className={this.props.classes.container}      >
          {React.Children.map(this.props.children, (content, index) => {
            return (
              <Grid
                key={content?.['key'] || index} item
                xs={6}
                sm={4}
                md={3}
                xl={2}
                className={this.props.classes.content}
              >
                {content}
              </Grid>
            )
          })}
        </Grid>
      </Container>
    );
  }
}

export default withStyles(styles, { withTheme: true })(WrappingList);
