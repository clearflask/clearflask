import { Accordion, AccordionDetails, AccordionSummary, createStyles, makeStyles, Theme, Typography } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  accordion: {
    marginTop: -1,
    border: '1px solid ' + theme.palette.grey[300],
    '&::before': {
      display: 'none',
    },
  },
});
const useStyles = makeStyles(styles);
export default function MyAccordion(props: {
  name?: React.ReactNode;
} & React.ComponentProps<typeof Accordion>) {
  const classes = useStyles();
  const { children, name, ...AccordionProps } = props;
  return (
    <Accordion
      TransitionProps={{
        appear: true,
      }}
      classes={{
        root: classes.accordion,
      }}
      elevation={0}
      {...AccordionProps}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>{name}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography>
          {children}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
