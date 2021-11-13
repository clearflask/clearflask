// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Collapse, Divider, Fade, IconButton } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import ExpandDownIcon from '@material-ui/icons/ExpandMore';
import classNames from 'classnames';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shallowEqual, useSelector } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server } from '../api/server';
import SubmitButton from '../common/SubmitButton';
import { T } from '../i18n';
import LogIn from './comps/LogIn';
import { Direction, PanelTitle } from './comps/Panel';
import PanelPost from './comps/PanelPost';
import PostCreateForm from './comps/PostCreateForm';

const styles = (theme: Theme) => createStyles({
  spacing: {
    marginTop: theme.spacing(4),
  },
  container: {
  },
  feedbackSubmitButton: {
    fontWeight: 'bold',
  },
  logIn: {
    marginBottom: theme.spacing(4),
  },
  logInTitle: {
    marginBottom: theme.spacing(2),
  },
  logInContainer: {
    alignSelf: 'stretch',
    padding: theme.spacing(0, 2, 2),
  },
  similarWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackForm: {
    maxWidth: 500,
    margin: theme.spacing(4, 'auto'),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  thankyou: {
    margin: theme.spacing(4, 0),
  },
  related: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  debate: {
    margin: theme.spacing(8, 0),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  debateMoreIcon: {
    fontSize: '3em',
  },
  debate2Offset: {
    marginTop: theme.spacing(4),
  },
  debateDivider: {
    margin: theme.spacing(4, 0),
    minWidth: 'min(10%, 50px)',
  },
  debatePostsContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: 'auto',
  },
  debatePosts: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingTop: theme.spacing(4),
    margin: theme.spacing(-2), // Collapse margins from debatePost 
    alignItems: 'flex-start',
    maxWidth: 1024,
  },
  debatePost: {
    margin: theme.spacing(2), // Collapsed in debatePosts
  },
});
const useStyles = makeStyles(styles);

const PageFeedback = (props: {
  className?: string;
  server: Server;
  pageFeedback: Client.PageFeedback;
}) => {
  const classes = useStyles();
  const { t } = useTranslation('app');
  const loggedIn = useSelector<ReduxState, boolean>(state => !!state.users.loggedIn.user?.userId, shallowEqual);
  const [onLogIn, setOnLogIn] = useState<((userId: string) => void) | undefined>();
  const [createdPostId, setCreatedPostId] = useState<string | undefined>();
  const [similarText, setSimilarText] = useState<string | undefined>();
  const [similarCount, setSimilarCount] = useState<number>(0);
  const [hasAnyDebate, setHasAnyDebate] = useState<boolean>(false);
  const [hasAnyDebate2, setHasAnyDebate2] = useState<boolean>(false);
  const [debateOpen, setDebateOpen] = useState<boolean>(false);
  const [formSubmit, setFormSubmit] = useState<(() => Promise<string>) | undefined>();
  const [loginSubmit, setLoginSubmit] = useState<(() => Promise<string | undefined>) | undefined>();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [relatedIsSubmittingPostId, setRelatedIsSubmittingPostId] = useState<string | undefined>();
  const [relatedClosed, setRelatedClosed] = useState<boolean>(false);

  const canSubmit = (!!loggedIn || !!loginSubmit) && !!formSubmit;
  const isDebateOpen = !!debateOpen || (!!createdPostId && (!similarCount || !!relatedClosed));

  return (
    <div className={classNames(classes.container, props.className)}>
      <Collapse in={!createdPostId}>
        <div className={classes.feedbackForm}>
          <PanelTitle text={T<'app'>('how-can-we-improve')} />
          <PostCreateForm
            server={props.server}
            type='large'
            mandatoryCategoryIds={[props.pageFeedback.categoryId]}
            searchSimilar={text => setSimilarText(text)}
            adminControlsDefaultVisibility='none'
            logInAndGetUserId={() => new Promise<string>(resolve => setOnLogIn(() => resolve))}
            unauthenticatedSubmitButtonTitle={t('next')}
            labelTitle={t(props.pageFeedback.labelTitle as any || 'idea')}
            labelDescription={t(props.pageFeedback.labelDescription as any || 'describe-your-idea-optional')}
            externalSubmit={onSubmit => setFormSubmit(() => onSubmit)}
          />
          <Collapse in={!createdPostId && !loggedIn} className={classes.logInContainer}>
            <LogIn
              className={classes.logIn}
              inline
              minimalistic
              actionTitle={(
                <PanelTitle variant='caption' text={t('well-send-you-updates-here')} className={classes.logInTitle} />
              )}
              guestLabelOverride={t('no-follow-up')}
              actionSubmitTitle={t('submit')}
              server={props.server}
              open={true}
              onLoggedInAndClose={userId => {
                if (onLogIn) {
                  onLogIn(userId);
                  setOnLogIn(undefined);
                }
              }}
              externalSubmit={onSubmit => setLoginSubmit(() => onSubmit)}
            />
          </Collapse>
          <SubmitButton
            className={classes.feedbackSubmitButton}
            size='large'
            variant='contained'
            disableElevation
            color='primary'
            disabled={!canSubmit}
            isSubmitting={isSubmitting}
            onClick={async () => {
              if (!formSubmit) return;
              setIsSubmitting(true);
              try {
                if (!(loggedIn || await loginSubmit?.())) {
                  setIsSubmitting(false);
                  return;
                }
                const postId = await formSubmit();
                setCreatedPostId(postId);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {t(props.pageFeedback.labelSubmit as any || 'post-idea')}
          </SubmitButton>
        </div>
      </Collapse>
      {/* <Collapse in={!!createdPostId}>
        <div className={classes.thankyou}>
          <ErrorMsg msg='Thank you' variant='success' action={(
            <Button
              onClick={() => {
                setCreatedPostId(undefined);
                setRelatedClosed(false);
              }}
            >Again</Button>
          )} />
        </div>
      </Collapse> */}
      {!!similarText && !!props.pageFeedback.related && (
        <Collapse in={!!createdPostId && !!similarCount && !relatedClosed}>
          <div className={classes.related}>
            <PanelTitle text={t(props.pageFeedback.related.panel.title as any || (
              similarCount > 1 ? 'are-any-of-these-related' : 'is-this-related'))} />
            <PanelPost
              direction={Direction.Vertical}
              panel={props.pageFeedback.related.panel}
              overrideTitle=''
              searchOverride={{
                searchText: similarText,
              }}
              widthExpand
              server={props.server}
              onClickPostExpand
              filterPosts={post => post.ideaId !== createdPostId}
              wrapPost={(post, postNode, index, selected) => (
                <div className={classes.similarWrap}>
                  <SubmitButton
                    isSubmitting={relatedIsSubmittingPostId === post.ideaId}
                    disabled={!!relatedIsSubmittingPostId}
                    variant='outlined'
                    color='default'
                    onClick={async () => {
                      if (!createdPostId) return;
                      setRelatedIsSubmittingPostId(post.ideaId)
                      try {
                        await (await props.server.dispatch()).ideaMerge({
                          projectId: props.server.getProjectId(),
                          ideaId: createdPostId,
                          parentIdeaId: post.ideaId,
                        });
                        setRelatedClosed(true);
                      } finally {
                        setRelatedIsSubmittingPostId(undefined)
                      }
                    }}
                  >{t('yes')}</SubmitButton>
                  {postNode}
                </div>
              )}
              onHasAnyChanged={(hasAny, count) => setSimilarCount(count)}
            />
            {/* <Button
              disabled={!!relatedIsSubmittingPostId}
              variant='outlined'
              onClick={() => setRelatedClosed(true)}
            >None</Button> */}
          </div>
        </Collapse>
      )}
      {!!props.pageFeedback.debate && (
        <Fade in={hasAnyDebate || hasAnyDebate2}>
          <div className={classes.debate}>
            <Divider className={classes.debateDivider} />
            <PanelTitle text={t(props.pageFeedback.debate.panel.title as any || 'see-what-others-are-saying')} />
            <Collapse in={!isDebateOpen}>
              <IconButton onClick={() => setDebateOpen(true)}>
                <ExpandDownIcon fontSize='inherit' className={classes.debateMoreIcon} />
              </IconButton>
            </Collapse>
            <Collapse in={isDebateOpen}>
              <div className={classes.debatePostsContainer} >
                <div className={classes.debatePosts} >
                  <PanelPost
                    postClassName={classes.debatePost}
                    direction={Direction.Vertical}
                    panel={props.pageFeedback.debate.panel}
                    overrideTitle=''
                    server={props.server}
                    onHasAnyChanged={setHasAnyDebate}
                    suppressPanel
                  />
                </div>
                {!!props.pageFeedback.debate2 && (
                  <>
                    {hasAnyDebate2 && (
                      <>
                        <div className={classes.debate2Offset} />
                        <PanelTitle text={props.pageFeedback.debate2.panel.title} />
                      </>
                    )}
                    <div className={classes.debatePosts} >
                      <PanelPost
                        postClassName={classes.debatePost}
                        direction={Direction.Vertical}
                        panel={props.pageFeedback.debate2.panel}
                        overrideTitle=''
                        server={props.server}
                        onHasAnyChanged={setHasAnyDebate2}
                        suppressPanel
                      />
                    </div>
                  </>
                )}
              </div>
            </Collapse>
          </div>
        </Fade>
      )}
    </div>
  );
}
export default PageFeedback;
