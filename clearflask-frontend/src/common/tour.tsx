// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Collapse, Fade, IconButton, LinearProgress, ListItem, ListItemIcon, MobileStepper, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckCircle';
import StartIcon from '@material-ui/icons/PlayCircleOutline';
import UnSkipIcon from '@material-ui/icons/Visibility';
import SkipIcon from '@material-ui/icons/VisibilityOff';
import classNames from 'classnames';
import { History, Location } from 'history';
import { ReferenceObject as PopperReferenceObject } from 'popper.js';
import React, { createContext, useContext, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router';
import { ThunkDispatch } from 'redux-thunk';
import ClosablePopper from './ClosablePopper';
import HoverArea from './HoverArea';
import ExpandIcon from './icon/ExpandIcon';
import { notEmpty } from './util/arrayUtil';
import ScrollAnchor from './util/ScrollAnchor';

// Guided product tour backed by Redux

interface TourDefinitionGuideStep {
  anchorId: string;
  showButtonNext?: boolean | string;
  showButtonComplete?: boolean | string;
  title: string;
  description?: string;
  openPath?: string;
  overrideNextStepId?: string;
  scrollTo?: boolean;
  showDelay?: number;
  placement?: React.ComponentProps<typeof ClosablePopper>['placement'];
  zIndex?: React.ComponentProps<typeof ClosablePopper>['zIndex'];
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
  title: string;
  guides: {
    [guideId: string]: TourDefinitionGuide,
  };
  groups: Array<{
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
      await new Promise(resolve => setTimeout(resolve, 250));
      history.push(step.openPath);
    }
    await new Promise(resolve => setTimeout(resolve, step.showDelay !== undefined ? step.showDelay : 250));
    dispatch({
      type: 'tourSetStep', payload: {
        activeStep: { guideId, stepId },
      }
    });
  } else {
    if (guide.onComplete?.openPath) {
      await new Promise(resolve => setTimeout(resolve, 250));
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
  guideContainer: {
    margin: theme.spacing(0, 4),
    position: 'relative',
  },
  guide: {
    display: 'flex',
    alignItems: 'center',
    paddingRight: 40, // cover absolutely positioned skip icon
  },
  areaCompleted: {
    opacity: 0.5,
  },
  checklist: {
    margin: theme.spacing(4),
    width: 800,
  },
  checklistHeader: {
    color: theme.palette.text.hint,
    marginLeft: theme.spacing(4),
  },
  checklistGroup: {
    margin: theme.spacing(3, 2, 1),
    border: '1px solid ' + theme.palette.divider,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  skipIcon: {
    fontSize: '0.7em',
  },
  guideIcon: {
    fontSize: '2em',
    margin: theme.spacing(1),
  },
  listTrailingAction: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
  },
  progressBackground: {
    backgroundColor: theme.palette.divider,
  },
});
const useStyles = makeStyles(styles);

interface TourData {
  tour: TourDefinition;
  onGuideCompleted: (guideId: string, guide: TourDefinitionGuide) => void;
  onGuideSkipped?: (guideId: string, guide: TourDefinitionGuide) => void;
  onGuideUnSkipped?: (guideId: string, guide: TourDefinitionGuide) => void;
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
  const tourContext = useContext(TourContext);
  const classes = useStyles();
  const dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions> = useDispatch();
  const history = useHistory();
  const location = useLocation();

  if (!tourContext) return null;
  const { tour, onGuideCompleted, onGuideSkipped, onGuideUnSkipped } = tourContext;

  var singleGroupAlreadyExpanded = false;
  const groups = tour.groups.map(group => {
    var completedCount = 0;
    const guides = group.guideIds.map(guideId => {
      const guide = tour.guides[guideId];
      if (!guide) return null;
      if (guide.state !== TourDefinitionGuideState.Available) completedCount++;
      return (
        <HoverArea>
          {(hoverAreaProps, isHovering, isHoverDisabled) => (
            <div className={classes.guideContainer} {...hoverAreaProps}>
              <ListItem
                key={guideId}
                button
                className={classNames(
                  classes.guide,
                  guide.state !== TourDefinitionGuideState.Available && classes.areaCompleted,
                )}
                onClick={() => {
                  const initialStepEntry = Object.entries(guide.steps)[0];
                  if (!initialStepEntry) return;
                  setStep(dispatch, history, location, guideId, guide, onGuideCompleted, initialStepEntry[0], initialStepEntry[1]);
                }}
              >
                <ListItemIcon>
                  {guide.state === TourDefinitionGuideState.Completed && (
                    <CheckIcon fontSize='inherit' color='primary' className={classes.guideIcon} />
                  )}
                  {guide.state === TourDefinitionGuideState.Available && (
                    <StartIcon fontSize='inherit' className={classes.guideIcon} />
                  )}
                  {guide.state === TourDefinitionGuideState.Skipped && (
                    <SkipIcon fontSize='inherit' className={classes.guideIcon} />
                  )}
                </ListItemIcon>
                <Typography variant='body1'>{guide.title}</Typography>
                <div className={classes.flexGrow} />
              </ListItem>
              {!guide.disableSkip && (
                <div className={classes.listTrailingAction}>
                  <Fade in={(isHovering || isHoverDisabled)
                    && ((guide.state === TourDefinitionGuideState.Available && !!onGuideSkipped) || (guide.state === TourDefinitionGuideState.Skipped && !!onGuideUnSkipped))}>
                    <IconButton
                      aria-label='Skip'
                      onClick={e => {
                        if (guide.state === TourDefinitionGuideState.Available) {
                          onGuideSkipped?.(guideId, guide);
                        } else {
                          onGuideUnSkipped?.(guideId, guide);
                        }
                      }}
                    >
                      {guide.state === TourDefinitionGuideState.Available
                        ? (<SkipIcon fontSize='inherit' className={classes.skipIcon} />)
                        : (<UnSkipIcon fontSize='inherit' className={classes.skipIcon} />)}
                    </IconButton>
                  </Fade>
                </div>
              )}
            </div>
          )}
        </HoverArea>
      );
    }).filter(notEmpty);
    const completePerc = (completedCount / guides.length) * 100;
    var shouldDefaultExpand = false;
    if (!singleGroupAlreadyExpanded && completePerc < 100) {
      singleGroupAlreadyExpanded = true;
      shouldDefaultExpand = true;
    }
    return (
      <TourChecklistGroup
        key={group.title}
        title={group.title}
        guides={guides}
        completePerc={completePerc}
        defaultExpanded={shouldDefaultExpand}
      />
    );
  });

  return (
    <div className={classes.checklist}>
      <Typography variant='h4' className={classes.checklistHeader}>{tour.title}</Typography>
      {groups}
    </div>
  );
}
const TourChecklistGroup = (props: {
  title: string,
  guides: React.ReactNode,
  completePerc: number;
  defaultExpanded?: boolean;
}) => {
  const classes = useStyles();
  const [expand, setExpand] = useState<boolean | undefined>(undefined);
  const expandWithDefault = expand === undefined ? !!props.defaultExpanded : expand;
  return (
    <>
      <div className={classNames(
        classes.checklistGroup,
        props.completePerc >= 100 && classes.areaCompleted,
      )}>
        <ListItem button onClick={() => setExpand(!expandWithDefault)}>
          <Typography variant='h5'>{props.title}</Typography>
          <div className={classes.flexGrow} />
          <ExpandIcon expanded={expandWithDefault} />
        </ListItem>
        <LinearProgress
          variant='determinate'
          value={props.completePerc}
          classes={{
            determinate: classes.progressBackground,
          }}
        />
      </div>
      <Collapse in={expandWithDefault}>
        {props.guides}
      </Collapse>
    </>
  );
}
export type TourAnchorHandle = {
  next: () => void,
}
export const TourAnchor = React.forwardRef((props: {
  anchorId?: string;
  className?: string;
  children?: React.ReactNode | ((
    next: (() => void),
    isActive: boolean,
    // If your element is not listed, freely add it here,
    // The type system of RefObject is weird as it doesn't accept a generic type of PopperReferenceObject
    anchorRef: React.RefObject<PopperReferenceObject & HTMLElement & HTMLDivElement & HTMLInputElement & HTMLSpanElement & HTMLButtonElement & HTMLAnchorElement>,
  ) => React.ReactNode);
  disablePortal?: React.ComponentProps<typeof ClosablePopper>['disablePortal'];
  zIndex?: React.ComponentProps<typeof ClosablePopper>['zIndex'];
  placement?: React.ComponentProps<typeof ClosablePopper>['placement'];
  ClosablePopperProps?: Partial<Omit<React.ComponentProps<typeof ClosablePopper>, 'anchor' | 'anchorType'>>;
  DivProps?: Partial<React.HTMLAttributes<HTMLDivElement>>;
}, ref: React.Ref<TourAnchorHandle>) => {
  const { tour, onGuideCompleted } = useContext(TourContext) || {};
  const classes = useStyles();
  const anchorRef = useRef<any>(null);
  const dispatch: ThunkDispatch<ReduxStateTour, undefined, AllTourActions> = useDispatch();
  const history = useHistory();
  const location = useLocation();

  const activeGuideId = useSelector<ReduxStateTour, string | undefined>(state => state.tour.activeStep?.guideId, shallowEqual);
  const activeGuide = !!activeGuideId ? tour?.guides[activeGuideId] : undefined;
  const activeStepId = useSelector<ReduxStateTour, string | undefined>(state => state.tour.activeStep?.stepId, shallowEqual);
  const activeStep = !!activeStepId ? activeGuide?.steps[activeStepId] : undefined;
  const activeAnchorId = activeStep?.anchorId;
  const isActive = !!props.anchorId && !!activeStep && (activeStep?.anchorId === props.anchorId);
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
  const complete = () => {
    if (!isActive || !activeGuideId || !activeGuide || !onGuideCompleted) return;
    setStep(dispatch, history, location, activeGuideId, activeGuide, onGuideCompleted, undefined, undefined);
  };
  React.useImperativeHandle(ref, () => ({ next }),
    [activeAnchorId, activeGuideId, activeStep, location.pathname, nextStepId]); // eslint-disable-line react-hooks/exhaustive-deps

  var popper;
  if (isActive && !!activeStep && !!activeGuide) {
    const stepsTotal = Object.keys(activeGuide.steps).length;
    const stepIndex = Object.keys(activeGuide.steps).findIndex(stepId => stepId === activeStepId);
    popper = (
      <ClosablePopper
        anchorType='ref'
        anchor={anchorRef}
        open
        onClose={() => dispatch({ type: 'tourSetStep', payload: { activeStep: undefined } })}
        arrow
        closeButtonPosition='disable'
        paperClassName={classes.anchorPaper}
        {...props.ClosablePopperProps}
        disablePortal={props.disablePortal}
        placement={activeStep.placement || props.placement || props.ClosablePopperProps?.placement || 'bottom'}
        zIndex={activeStep.zIndex !== undefined ? activeStep.zIndex
          : (props.zIndex !== undefined ? props.zIndex : props.ClosablePopperProps?.zIndex)}
      >
        {!!activeStep.title && (
          <Typography variant='h6'>{activeStep.title}</Typography>
        )}
        {!!activeStep.description && (
          <Typography variant='body1' color='textSecondary'>{activeStep.description}</Typography>
        )}
        <div className={classes.actionArea}>
          {stepsTotal > 1 && stepIndex !== undefined && (
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
          {!!activeStep.showButtonComplete && (
            <Button color='primary' onClick={complete}>
              {typeof activeStep.showButtonComplete === 'string' ? activeStep.showButtonComplete : 'Finish'}
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
      {typeof props.children === 'function' ? props.children(next, isActive, anchorRef) : props.children}
      {scrollTo}
      {popper}
    </>
  );

  if (typeof props.children !== 'function') {
    content = (
      <span ref={anchorRef} className={props.className} {...props.DivProps}>
        {content}
      </span>
    );
  }

  return content;
});

