// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Fade, Typography } from '@material-ui/core';
import { createStyles, Theme } from '@material-ui/core/styles';
import EmptyIcon from '@material-ui/icons/BlurOn';
import { makeStyles } from '@material-ui/styles';

const styles = (theme: Theme) => createStyles({
  previewEmptyMessage: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.hint,
  },
  previewEmptyIcon: {
    fontSize: '3em',
    margin: theme.spacing(3),
  },
});
const useStyles = makeStyles(styles);

export const DashboardEmptyPlaceholder = (props: {
  message: string,
}) => {
  const classes = useStyles();
  return (
    <Fade in appear>
      <div className={classes.previewEmptyMessage}>
        <Typography component="div" variant="h5">
          {props.message}
        </Typography>
        <EmptyIcon
          fontSize="inherit"
          className={classes.previewEmptyIcon}
        />
      </div>
    </Fade>
  );
};