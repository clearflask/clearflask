import MomentUtils from '@date-io/moment';
import { Checkbox, FormControlLabel, Radio, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import CalendarIcon from '@material-ui/icons/Event';
import { KeyboardDatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers';
import classNames from 'classnames';
import moment from 'moment';
import React from 'react';
import { Label } from '../../app/comps/SelectionPicker';
import HelpPopper from '../HelpPopper';

const styles = (theme: Theme) => createStyles({
  container: {
    minWidth: 'min-content',
  },
  group: {
    margin: theme.spacing(3),
    marginRight: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    minWidth: 'min-content',
    alignItems: 'stretch',
  },
  groupHorizontal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'stretch',
    margin: theme.spacing(1.5, 2),
  },
  groupHorizontalWrap: {
    flexWrap: 'wrap',
  },
  label: {
    wordBreak: 'break-word',
  },
  title: {
    color: theme.palette.text.hint,
    marginBottom: theme.spacing(0.5),
  },
  datesVertical: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1, 0),
    '& input': {
      fontSize: '0.8em',
      width: 68,
    },
    '& > *:first-child': {
      marginBottom: theme.spacing(2),
    },
  },
  // datesHorizontal: {
  //   display: 'flex',
  //   margin: theme.spacing(1, 0),
  //   '& > *:first-child': {
  //     marginRight: theme.spacing(1),
  //   },
  //   '& > *:last-child': {
  //     marginLeft: theme.spacing(1),
  //   },
  //   '& > *': {
  //     width: 73,
  //   },
  //   '& input': {
  //     fontSize: '0.8em',
  //   },
  // },
  dateButtons: {
    marginTop: theme.spacing(1),
    columns: 'auto 2',
  },
  dateButton: {
    display: 'block',
    textTransform: 'unset',
    padding: 0,
  },
  dateIcon: {
    fontSize: '0.8em',
  },
});
const useStyles = makeStyles(styles);

const FilterControls = (props: {
  className?: string;
  children?: any;
}) => {
  const classes = useStyles();
  return (
    <div className={classNames(props.className, classes.container)}>
      {props.children}
    </div>
  );
}
export default FilterControls;

export const FilterControlSelect = (props: {
  type: 'radio' | 'check';
  name?: string;
  labels: Array<Label>;
  selected?: Set<String> | string;
  onToggle: (value: string) => void;
}) => {
  const classes = useStyles();
  const Control = props.type === 'check' ? Checkbox : Radio;
  return (
    <div
      key={`group-${props.name || 'noname'}`}
      className={classes.group}
    >
      <FilterControlTitle name={props.name} />
      {props.labels.map(label => (
        <FormControlLabel
          key={`label-${label.label}`}
          style={{ color: label.color }}
          label={(
            <Typography
              variant='body2'
              component='div'
              className={classes.label}>
              {label.label}
            </Typography>
          )}
          control={(
            <Control
              size='small'
              color='primary'
              checked={typeof props.selected === 'string'
                ? label.value === props.selected
                : !!props.selected?.has(label.value)}
              onChange={e => props.onToggle(label.value)}
            />
          )}
        />
      ))}
    </div>
  );
}

export const FilterControlDateRange = (props: {
  valueFrom?: Date;
  onFromChanged: (val?: Date) => void;
  valueTo?: Date;
  onToChanged: (val?: Date) => void;
}) => {
  const classes = useStyles();

  // const prefilledDates: Array<{
  //   label: string,
  //   start?: Date,
  //   end?: Date,
  // }> = [
  //     { label: 'Today', start: moment().startOf('day').toDate(), end: moment().endOf('day').toDate() },
  //     { label: 'This week', start: moment().startOf('week').toDate(), end: moment().endOf('week').toDate() },
  //     { label: 'This month', start: moment().startOf('month').toDate(), end: moment().endOf('month').toDate() },
  //     { label: 'All time' },
  //     { label: 'Past week', start: moment().startOf('week').toDate(), end: moment().endOf('week').toDate() },
  //     { label: 'Past month', start: moment().startOf('month').toDate(), end: moment().endOf('month').toDate() },
  //   ];
  return (
    <MuiPickersUtilsProvider utils={MomentUtils} locale='en'>
      <div className={classes.group}>
        <FilterControlTitle name='Range' />
        <div className={classes.datesVertical}>
          <FilterControlDatePicker
            name='From'
            value={props.valueFrom}
            onChanged={props.onFromChanged}
          />
          <FilterControlDatePicker
            name='To'
            value={props.valueTo}
            onChanged={props.onToChanged}
          />
        </div>
        {/* <div className={this.props.classes.dateButtons}>
        {prefilledDates.map((prefilledDate, index) => {
          const checked = prefilledDate.start?.getTime() === from?.getTime() && prefilledDate.end?.getTime() === to?.getTime();
          return (
            <Button
              key={`prefilledDate-${prefilledDate.label}`}
              className={this.props.classes.dateButton}
              variant='text'
              color={!!checked ? 'primary' : undefined}
              onClick={e => {
                const newSearch: Admin.IdeaSearchAdmin = {
                  ...this.props.search,
                  filterCreatedStart: prefilledDate.start,
                  filterCreatedEnd: prefilledDate.end,
                }
                this.props.onSearchChanged(newSearch);
              }}
            >
              {prefilledDate.label}
            </Button>
          )
        })}
      </div> */}
      </div>
    </MuiPickersUtilsProvider>
  );
}

export const FilterControlDatePicker = (props: {
  name: string;
  value?: Date;
  onChanged: (val?: Date) => void;
}) => {
  const classes = useStyles();
  return (
    <KeyboardDatePicker
      shouldDisableDate={(date) => {
        if (!date) return true;
        if (date.isAfter(moment().endOf('day'))) return true;
        return false
      }}
      variant='inline'
      inputVariant='standard'
      size='small'
      views={['year', 'date']}
      format='YYYY/MM/DD'
      autoOk
      keyboardIcon={(
        <CalendarIcon className={classes.dateIcon} fontSize='inherit' />)}
      InputProps={{
        disableUnderline: true,
      }}
      InputAdornmentProps={{ position: 'start' }}
      disableToolbar
      initialFocusedDate={new Date()}
      placeholder={props.name}
      value={props.value || null}
      onChange={val => {
        props.onChanged(val?.toDate());
      }}
    />
  );
}

export const FilterControlBase = (props: {
  name?: string;
  children?: any;
  oneLine?: boolean;
  oneLineAllowWrap?: boolean;
}) => {
  const classes = useStyles();
  return (
    <div
      key={`group-${props.name || 'noname'}`}
      className={classNames(
        classes.group,
        !!props.oneLine && classes.groupHorizontal,
        !!props.oneLineAllowWrap && classes.groupHorizontalWrap,
      )}
    >
      {props.name && (
        <FilterControlTitle name={props.name} />
      )}
      {props.children}
    </div>
  );
}

export const FilterControlTitle = (props: {
  name?: string;
  className?: string;
  help?: React.ComponentProps<typeof HelpPopper>;
}) => {
  const classes = useStyles();
  return !props.name ? null : (
    <Typography
      className={classNames(props.className, classes.title)}
      variant='subtitle1'
      component='div'
    >
      {props.name}
      {!!props.help && (
        <>
          &nbsp;
          <HelpPopper {...props.help} />
        </>
      )}
    </Typography>
  );
}
