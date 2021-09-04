// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, MobileStepper, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { History, Location } from 'history';
import React, { createContext, useContext, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import ClosablePopper from './ClosablePopper';
import ScrollAnchor from './util/ScrollAnchor';

// Guided product tour backed by Redux

interface TourDefinitionGuideStep {
  anchorId: string;
  showButtonNext?: boolean | string;
  title: string;
  description: string;
  openPath?: string;
  overrideNextStepId?: string;
  scrollTo?: boolean;
}
export enum TourDefinitionGuideState {
  Available = 'available',
  Completed = 'completed',
  Skipped = 'skipped',
}
interface TourDefinitionGuide {
  state: TourDefinitionGuideState;
  title: string;
  disableSkip?: boolean;
  steps: {
    [stepId: string]: TourDefinitionGuideStep,
  };
  onComplete?: {
    openPath?: string;
  };
}
export interface TourDefinition {
  guides: {
    [guideId: string]: TourDefinitionGuide,
  };
  groups?: Array<{
    title: string;
    guideIds: Array<string>;
  }>;
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

const setStep = async (
  dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions>,
  history: History,
  location: Location,
  guideId: string,
  guide: TourDefinitionGuide,
  onGuideCompleted: TourData['onGuideCompleted'],
  stepId?: string,
  step?: TourDefinitionGuideStep,
) => {
  dispatch({
    type: 'tourSetStep', payload: {
      activeStep: undefined,
    }
  });
  if (!!stepId && !!step) {
    if (!!step.openPath && location.pathname !== step.openPath) {
      await new Promise(resolve => setTimeout(resolve, 300));
      history.push(step.openPath);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    dispatch({
      type: 'tourSetStep', payload: {
        activeStep: { guideId, stepId },
      }
    });
  } else {
    if (guide.onComplete?.openPath) {
      await new Promise(resolve => setTimeout(resolve, 300));
      history.push(guide.onComplete.openPath);
    }
    onGuideCompleted?.(guideId, guide);
  }
}

const styles = (theme: Theme) => createStyles({
  anchorPaper: {
    padding: theme.spacing(2),
    maxWidth: 370,
  },
  stepper: {
    marginTop: theme.spacing(1),
  },
  actionArea: {
    display: 'flex',
  },
  flexGrow: {
    flexGrow: 1,
  },
});
const useStyles = makeStyles(styles);

interface TourData {
  tour: TourDefinition;
  onGuideCompleted: (guideId: string, guide: TourDefinitionGuide) => void;
  onGuideSkipped: (guideId: string, guide: TourDefinitionGuide) => void;
}
export const TourContext = createContext<TourData | undefined>(undefined);
export const TourProvider = (props: {
  children?: any;
} & TourData) => {
  const { children, ...tourData } = props;
  return (
    <TourContext.Provider value={tourData}>
      {children}
    </TourContext.Provider>
  );
};

export const TourChecklist = (props: {
}) => {
  const { tour, onGuideCompleted, onGuideSkipped } = useContext(TourContext)!;
  const classes = useStyles();
  const dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions> = useDispatch();
  const history = useHistory();
  const location = useLocation();

  if (!tour) return null;
  return (
    <div>
      {Object.entries(tour.guides).map(([guideId, guide]) => (
        <div>
          {guide.title}
          {!guide.disableSkip && (
            <Button
              disabled={guide.state !== TourDefinitionGuideState.Available}
              onClick={() => onGuideSkipped(guideId, guide)}
            >Skip</Button>
          )}
          <Button
            onClick={() => {
              const initialStepEntry = Object.entries(guide.steps)[0];
              if (!initialStepEntry) return;
              setStep(dispatch, history, location, guideId, guide, onGuideCompleted, initialStepEntry[0], initialStepEntry[1]);
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
  children?: React.ReactNode | ((next: (() => void), isActive: boolean) => React.ReactNode);
  anchorId: string;
  anchorRef?: React.RefObject<HTMLElement>;
  placement?: React.ComponentProps<typeof ClosablePopper>['placement'];
  ClosablePopperProps?: Partial<React.ComponentProps<typeof ClosablePopper>>;
}, ref: React.Ref<TourAnchorHandle>) => {
  const { tour, onGuideCompleted } = useContext(TourContext) || {};
  const classes = useStyles();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions> = useDispatch();
  const history = useHistory();
  const location = useLocation();

  const activeGuideId = useSelector<ReduxStateTour, string | undefined>(state => state.tour.activeStep?.guideId, shallowEqual);
  const activeGuide = !!activeGuideId ? tour?.guides[activeGuideId] : undefined;
  const activeStepId = useSelector<ReduxStateTour, string | undefined>(state => state.tour.activeStep?.stepId, shallowEqual);
  const activeStep = !!activeStepId ? activeGuide?.steps[activeStepId] : undefined;
  const activeAnchorId = activeStep?.anchorId;
  const isActive = !!activeStep && (activeStep?.anchorId === props.anchorId);
  var nextStepId = activeStep?.overrideNextStepId;
  if (isActive && !nextStepId && activeGuide) {
    const stepIds = Object.keys(activeGuide.steps);
    const activeIndex = stepIds.findIndex(stepId => stepId === activeStepId);
    if (activeIndex !== -1 && activeIndex < stepIds.length) {
      nextStepId = stepIds[activeIndex + 1];
    }
  }
  const nextStep = !!nextStepId ? activeGuide?.steps[nextStepId] : undefined;

  const next = () => {
    if (!isActive || !activeGuideId || !activeGuide || !onGuideCompleted) return;
    setStep(dispatch, history, location, activeGuideId, activeGuide, onGuideCompleted, nextStepId, nextStep);
  };
  React.useImperativeHandle(ref, () => ({ next }),
    [activeAnchorId, activeGuideId, activeStep, location.pathname, nextStepId]);

  var popper;
  if (isActive && !!activeStep && !!activeGuide) {
    const stepsTotal = Object.keys(activeGuide.steps).length;
    const stepIndex = Object.keys(activeGuide.steps).findIndex(stepId => stepId === activeStepId);
    popper = (
      <ClosablePopper
        open
        onClose={() => dispatch({ type: 'tourSetStep', payload: { activeStep: undefined } })}
        anchorEl={(props.anchorRef || anchorRef).current}
        arrow
        closeButtonPosition='disable'
        paperClassName={classes.anchorPaper}
        placement={props.placement || 'bottom'}
        {...props.ClosablePopperProps}
      >
        {!!activeStep.title && (
          <Typography variant='h6'>{activeStep.title}</Typography>
        )}
        {!!activeStep.description && (
          <Typography variant='body1' color='textSecondary'>{activeStep.description}</Typography>
        )}
        <div className={classes.actionArea}>
          {stepsTotal > 0 && stepIndex !== undefined && (
            <MobileStepper
              className={classes.stepper}
              variant='dots'
              position='static'
              steps={stepsTotal}
              activeStep={stepIndex}
              backButton={null}
              nextButton={null}
            />
          )}
          <div className={classes.flexGrow} />
          {!!activeStep.showButtonNext && (
            <Button color='primary' onClick={next}>
              {typeof activeStep.showButtonNext === 'string' ? activeStep.showButtonNext : (!!nextStepId ? 'Next' : 'Finish')}
            </Button>
          )}
        </div>
      </ClosablePopper>
    );
  }

  const scrollTo = isActive && !!activeStep?.scrollTo ? (
    <ScrollAnchor scrollOnMount />
  ) : null;

  var content = (
    <>
      {typeof props.children === 'function' ? props.children(next, isActive) : props.children}
      {scrollTo}
      {popper}
    </>
  );

  if (!props.anchorRef) {
    content = (
      <span ref={anchorRef} className={props.className}>
        {content}
      </span>
    );
  }

  return content;
});

