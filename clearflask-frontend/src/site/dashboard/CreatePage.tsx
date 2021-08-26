// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="../../@types/transform-media-imports.d.ts"/>
import { Button, Card, CardActions, CardContent, CardHeader, Checkbox, FormControlLabel, Hidden, InputAdornment, TextField, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import CreatedImg from '../../../public/img/dashboard/created.svg';
import FeaturesImg from '../../../public/img/landing/hero.svg';
import DetailsImg from '../../../public/img/landing/understand.svg';
import * as Admin from '../../api/admin';
import ServerAdmin from '../../api/serverAdmin';
import { HeaderLogoLogo } from '../../app/Header';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater, { CreateTemplateV2Options, createTemplateV2OptionsDefault, CreateTemplateV2Result } from '../../common/config/configTemplater';
import ImgIso from '../../common/ImgIso';
import SubmitButton from '../../common/SubmitButton';
import windowIso from '../../common/windowIso';
import Logo from '../Logo';

const styles = (theme: Theme) => createStyles({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  },
  layoutHeader: {
    margin: theme.spacing(2),
    alignSelf: 'stretch',
  },
  layoutHeaderLogo: {},
  layoutContentAndImage: {
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
  },
  layoutContentContainer: {
    margin: theme.spacing(4, 'auto'),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  layoutContent: {},
  layoutContentTitle: {},
  layoutContentDescription: {},
  layoutContentActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    margin: theme.spacing(2),
  },
  layoutContentAction: {
    margin: theme.spacing(1),
  },
  layoutImage: {
    margin: theme.spacing(8),
    width: '100%',
    maxWidth: '30vw',
  },
  layoutLimitWidth: {
    // width: 500,
    maxWidth: 500,
  },
  templateCards: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  templateCard: {
    margin: theme.spacing(4),
    width: 200,
    display: 'flex',
    flexDirection: 'column',
  },
  projectDetailsFields: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(2, 0),
  },
  subdomainFields: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  field: {
    margin: theme.spacing(2, 1),
    width: 300,
    maxWidth: 300,
  },

  link: {
    cursor: 'pointer',
    textDecoration: 'none!important',
    color: theme.palette.text.primary,
  },
  box: {
    transition: theme.transitions.create(['border', 'opacity']),
    border: '1px solid ' + theme.palette.divider,
  },
  boxSelected: {
    borderColor: theme.palette.primary.main,
  },
  disabled: {
    opacity: 0.5,
  },
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1),
  },
  visibilityButtonGroup: {
    margin: theme.spacing(2),
  },
  visibilityButton: {
    flexDirection: 'column',
    textTransform: 'none',
  },
  onboardOptions: {
    display: 'flex',
    flexDirection: 'column',
  },
  onboardOption: {
    margin: theme.spacing(0.5, 1),
  },
  inlineTextField: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  flexBreak: {
    width: '100%',
  },
  flexGrow: {
    flexGrow: 1,
  },
  action: {
    padding: theme.spacing(0, 2, 1),
  },
  warningIcon: {
    color: theme.palette.warning.main,
  },
});
const useStyles = makeStyles(styles);
interface Props {
  isOnboarding: boolean;
  projectCreated: (projectId: string) => void;
}
interface State extends CreateTemplateV2Options {
  step: 'feature-select' | 'project-details' | 'complete';
  isSubmitting?: boolean;
  createdProject?: Admin.NewProjectResult;
  createdTemplates?: CreateTemplateV2Result;
}
class CreatePage extends Component<Props & WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    this.state = {
      ...createTemplateV2OptionsDefault,
      step: 'feature-select',
    };
  }

  render() {
    switch (this.state.step) {
      default:
      case 'feature-select':
        return (
          <CreateLayout
            key='feature-select'
            isOnboarding={this.props.isOnboarding}
            title='Choose features'
            description='Please choose the functions you want to include in your project. You can always change your mind later'
            stretchContent
            img={FeaturesImg}
            content={(
              <>
                <div className={this.props.classes.templateCards}>
                  <TemplateCard
                    className={this.props.classes.templateCard}
                    title='Feedback'
                    content='Collect feedback from customers.'
                    checked={!!this.state.templateFeedback}
                    onChange={() => this.setState({ templateFeedback: !this.state.templateFeedback })}
                  />
                  <TemplateCard
                    className={this.props.classes.templateCard}
                    title='Roadmap'
                    content='Convert feedback into tasks and organize it in a public roadmap'
                    checked={!!this.state.templateRoadmap}
                    onChange={() => this.setState({ templateRoadmap: !this.state.templateRoadmap })}
                  />
                  <TemplateCard
                    className={this.props.classes.templateCard}
                    title='Changelog'
                    content='Keep your users updated with new changes in your product.'
                    checked={!!this.state.templateChangelog}
                    onChange={() => this.setState({ templateChangelog: !this.state.templateChangelog })}
                  />
                </div>
              </>
            )}
            actions={[(
              <Button
                variant='contained'
                disableElevation
                color='primary'
                onClick={() => this.setState({ step: 'project-details' })}
              >
                Next
              </Button>
            )]}
          />
        );
      case 'project-details':
        return (
          <CreateLayout
            key='project-details'
            isOnboarding={this.props.isOnboarding}
            title='Fill out details'
            description='Give us a few more details about your project.'
            img={DetailsImg}
            content={(
              <div className={this.props.classes.projectDetailsFields}>
                <TextField
                  className={this.props.classes.field}
                  variant='outlined'
                  autoFocus
                  label='Your website (Optional)'
                  placeholder='example.com'
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoWebsite || ''}
                  onChange={e => {
                    const nameMatch = e.target.value.match(/^(https?:\/\/)?([^./]+).*$/);
                    var slug: string | undefined = undefined;
                    var name: string | undefined = undefined;
                    if (nameMatch && nameMatch[2]) {
                      name = nameMatch[2].toLowerCase();
                      if (name) {
                        name = name.charAt(0).toUpperCase() + name.slice(1);
                        slug = this.nameToSlug(name);
                      }
                    }
                    const logoMatch = e.target.value.match(/^(https?:\/\/)?([^/]+).*$/);
                    var logo: string | undefined = undefined;
                    if (logoMatch && logoMatch[2]) {
                      logo = `${logoMatch[1] || 'https://'}${logoMatch[2]}/favicon.ico`;
                    }
                    this.setState({
                      infoWebsite: e.target.value,
                      ...(!!logo ? { infoLogo: logo } : {}),
                      ...(!!slug ? { infoSlug: slug } : {}),
                      ...(!!name ? { infoName: name } : {}),
                    })
                  }}
                />
                <TextField
                  className={this.props.classes.field}
                  variant='outlined'
                  label='Product name'
                  placeholder='Vandelay Industries'
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoName || ''}
                  onChange={e => {
                    const slug = this.nameToSlug(e.target.value);
                    this.setState({
                      infoName: e.target.value,
                      ...(!!slug ? { infoSlug: slug } : {}),
                    });
                  }}
                />
                <div className={this.props.classes.subdomainFields}>
                  <TextField
                    className={this.props.classes.field}
                    variant='outlined'
                    label='Subdomain'
                    placeholder='vandelay-industries'
                    disabled={!!this.state.isSubmitting}
                    value={this.state.infoSlug || ''}
                    onChange={e => this.setState({ infoSlug: e.target.value })}
                  />
                  <Typography variant='h6' component='div'>{`.${windowIso.parentDomain}`}</Typography>
                </div>
                <TextField
                  className={this.props.classes.field}
                  variant='outlined'
                  label='Logo URL (Optional)'
                  placeholder='example.com/favicon.ico'
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoLogo || ''}
                  onChange={e => this.setState({ infoLogo: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        {this.state.infoLogo && (
                          <HeaderLogoLogo logoUrl={this.state.infoLogo} />
                        )}
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
            )}
            actions={[(
              <Button
                variant='text'
                onClick={() => this.setState({ step: 'feature-select' })}
              >
                Back
              </Button>
            ), (
              <SubmitButton
                variant='contained'
                disableElevation
                color='primary'
                isSubmitting={this.state.isSubmitting}
                disabled={!this.state.infoName || !this.state.infoSlug}
                onClick={() => this.onCreate()}
              >
                Create
              </SubmitButton>
            )]}
          />
        );
      case 'complete':
        return (
          <CreateLayout
            key='complete'
            isOnboarding={this.props.isOnboarding}
            title='Success!'
            description={`You've created ${this.state.infoName || 'your project'}.`}
            img={CreatedImg}
          />
        );
    }
  }

  async createConfig(): Promise<{ config: Admin.ConfigAdmin, templates: CreateTemplateV2Result }> {
    const editor = new ConfigEditor.EditorImpl();
    const templater = Templater.get(editor);
    const templates = await templater.createTemplateV2(this.state);
    const config = editor.getConfig();
    return { config, templates };
  }

  async onCreate() {
    this.setState({ isSubmitting: true });
    try {
      const d = await ServerAdmin.get().dispatchAdmin();
      const configAndTemplates = await this.createConfig();
      const newProject = await d.projectCreateAdmin({
        configAdmin: configAndTemplates.config,
      });
      this.setState({
        isSubmitting: false,
        step: 'complete',
        createdProject: newProject,
        createdTemplates: configAndTemplates.templates,
      });
      this.props.projectCreated(newProject.projectId);
    } catch (e) {
      this.setState({ isSubmitting: false });
      return;
    }
  }

  nameToSlug(name: string): string | undefined {
    if (!name) return undefined;

    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/ +/g, '-');
  }
}
export default withStyles(styles, { withTheme: true })(CreatePage);

export const TemplateCard = (props: {
  className?: string;
  title: string;
  content: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) => {
  const classes = useStyles();
  return (
    <Card elevation={0} className={classNames(
      props.className,
      classes.box,
      props.checked && classes.boxSelected,
      props.disabled && classes.disabled,
    )}>
      <CardHeader
        title={props.title}
        titleTypographyProps={{ align: 'center' }}
        subheaderTypographyProps={{ align: 'center' }}
      />
      <CardContent>{props.content}</CardContent>
      <div className={classes.flexGrow} />
      <CardActions className={classes.action}>
        <FormControlLabel
          control={(
            <Checkbox color="primary"
              checked={props.checked}
              onChange={props.onChange}
              disabled={props.disabled}
            />
          )}
          label={props.checked ? 'Selected' : 'Select'}
        />
      </CardActions>
    </Card>
  );
};

const CreateLayout = (props: {
  title: string;
  isOnboarding?: boolean;
  description: string;
  stretchContent?: boolean;
  content?: React.ReactNode;
  actions?: React.ReactNode[];
  img: Img;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.layout}>
      {props.isOnboarding && (
        <div className={classes.layoutHeader}>
          <div className={classes.layoutHeaderLogo}><Logo /></div>
        </div>
      )}
      <div className={classes.layoutContentAndImage}>
        <div className={classes.layoutContentContainer}>
          <div className={classes.layoutLimitWidth}>
            <Typography variant='h3' component='h1' className={classes.layoutContentTitle}>{props.title}</Typography>
            <Typography variant='h6' component='div' className={classes.layoutContentDescription}>{props.description}</Typography>
          </div>
          {!!props.content && (
            <div className={classNames(
              classes.layoutContent,
              !props.stretchContent && classes.layoutLimitWidth,
            )}>{props.content}</div>
          )}
          {!!props.actions?.length && (
            <div className={classNames(classes.layoutContentActions, classes.layoutLimitWidth)}>
              {props.actions.map(action => (
                <div className={classes.layoutContentAction}>
                  {action}
                </div>
              ))}
            </div>
          )}
        </div>
        <Hidden mdDown>
          <ImgIso
            alt=''
            className={classes.layoutImage}
            src={props.img.src}
            aspectRatio={props.img.aspectRatio}
            width={props.img.width}
            height={props.img.height}
            maxWidth={props.img.width}
            maxHeight={props.img.height}
          />
        </Hidden>
      </div>
    </div>
  );
};
