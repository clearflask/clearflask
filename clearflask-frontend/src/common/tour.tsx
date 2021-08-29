// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Paper, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import ClosablePopper from './ClosablePopper';
import { isProd } from './util/detectEnv';

// Guided product tour backed by Redux

interface TourDefinitionGuideStep {
  anchorId: string;
  title: string;
  description: string;
  openPath?: string;
  nextStepId?: string;
}
interface TourDefinitionGuide {
  title: string;
  description: string;
  initialStepId: string;
  steps: {
    [stepId: string]: TourDefinitionGuideStep,
  };
}
export interface TourDefinition {
  guides: {
    [guideId: string]: TourDefinitionGuide,
  };
}

interface tourSetAnchorAction {
  type: 'tourSetStep';
  payload: {
    activeStep?: {
      guideId: string;
      stepId: string;
    };
  };
}
export type AllTourActions = tourSetAnchorAction;
interface StateTour {
  activeStep?: {
    guideId: string;
    stepId: string;
  };
}
export interface ReduxStateTour {
  tour: StateTour,
}
export const stateTourDefault = {};
export function reducerTour(state: StateTour = {}, action: AllTourActions | any): StateTour {
  switch (action.type) {
    case 'tourSetStep':
      return {
        ...state,
        activeStep: action.payload.activeStep,
      };
    default:
      return state;
  }
}

const styles = (theme: Theme) => createStyles({
});
const useStyles = makeStyles(styles);

export const TourChecklist = (props: {
  tour: TourDefinition;
}) => {
  const classes = useStyles();
  const dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions> = useDispatch();
  const history = useHistory();
  const location = useLocation();

  if (isProd()) return null; // TODO enable in prod

  return (
    <div>
      {Object.entries(props.tour.guides).map(([guideId, guide]) => (
        <div>
          {guide.title}
          {guide.description}
          <Button
            onClick={() => {
              dispatch({
                type: 'tourSetStep', payload: {
                  activeStep: {
                    guideId, stepId: guide.initialStepId,
                  }
                }
              });
              const openPath = guide.steps[guide.initialStepId]?.openPath;
              if (!!openPath && location.pathname !== openPath) {
                history.push(openPath);
              }
            }}
          >Go</Button>
        </div>
      ))}
    </div>
  );
}

type TourAnchorHandle = {
  next: () => void,
}
export const TourAnchor = React.forwardRef((props: {
  className?: string;
  children?: React.ReactNode | ((next: (() => void)) => React.ReactNode);
  tour: TourDefinition;
  anchorId: string;
  anchorRef?: React.RefObject<HTMLElement>;
}, ref: React.Ref<TourAnchorHandle>) => {
  const classes = useStyles();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions> = useDispatch();
  const history = useHistory();
  const location = useLocation();

  const activeGuideId = useSelector<ReduxStateTour, string | undefined>(state => state.tour.activeStep?.guideId, shallowEqual);
  const activeGuide = !!activeGuideId ? props.tour.guides[activeGuideId] : undefined;
  const activeStepId = useSelector<ReduxStateTour, string | undefined>(state => state.tour.activeStep?.stepId, shallowEqual);
  const activeStep = !!activeStepId ? activeGuide?.steps[activeStepId] : undefined;

  const next = () => {
    if (!activeGuideId || !activeStep) return;
    dispatch({
      type: 'tourSetStep', payload: {
        activeStep: !!activeStep.nextStepId
          ? { guideId: activeGuideId, stepId: activeStep.nextStepId }
          : undefined,
      }
    });
    if (!!activeStep.openPath && location.pathname !== activeStep.openPath) {
      history.push(activeStep.openPath);
    }
  };
  React.useImperativeHandle(ref, () => ({ next }), [activeGuideId, activeStep, location.pathname]);

  var popper;
  if (activeStep) {
    popper = (
      <ClosablePopper
        open
        onClose={() => dispatch({ type: 'tourSetStep', payload: { activeStep: undefined } })}
        placement='bottom'
        anchorEl={(props.anchorRef || anchorRef).current}
        arrow
        clickAway
        closeButtonPosition='disable'
      >
        <Paper>
          {!!activeStep.title && (
            <Typography variant='h6'>{activeStep.title}</Typography>
          )}
          {!!activeStep.description && (
            <Typography variant='body1'>{activeStep.description}</Typography>
          )}
        </Paper>
      </ClosablePopper>
    );
  }

  const children = typeof props.children === 'function'
    ? props.children(next) : props.children;
  return props.anchorRef ? (
    <>
      {children}
      {popper}
    </>
  ) : (
    <span ref={anchorRef} className={props.className}>
      {children}
      {popper}
    </span>
  );
});

