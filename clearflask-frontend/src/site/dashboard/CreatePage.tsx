import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Stepper, Step, StepLabel, Link, StepContent, Grid, Card, CardHeader, CardContent, Checkbox, CardActions } from '@material-ui/core';

const styles = (theme:Theme) => createStyles({
  item: {
    margin: theme.spacing(2),
  },
  link: {
    cursor: 'pointer',
    textDecoration: 'none!important',
    color: theme.palette.text.primary,
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

enum StepIndex {
  Templates = 0,
  Credits,
  info,
}



interface State {
  step:number;
  isSubmitting?:boolean;
  
  templateFeedback?:boolean;
  templateChangelog?:boolean;
  templateKnowledgeBase?:boolean;
  templateFaq?:boolean;
  templateBlog?:boolean;

  creditsType?:'currency'|'time'|'beer';

  infoWebsite?:string;
  infoLogo?:string;
  infoName?:string;
  infoSlug?:string;
}

class CreatePage extends Component<WithStyles<typeof styles, true>, State> {
  constructor(props) {
    super(props);

    this.state = {
      step: 0,
    };
  }

  render() {
    return (
      <React.Fragment>
        <Stepper activeStep={this.state.step} orientation='vertical'>
          <Step key='plan'>
            <StepLabel>
              <Link onClick={() => !this.state.isSubmitting && this.setState({step: 0})} className={this.props.classes.link}>
                Plan
              </Link>
            </StepLabel>
            <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
              <Grid container spacing={4} alignItems='flex-start' className={this.props.classes.item}>
                <TemplateCard
                  title='Feedback'
                  content='Collect feedback from user. Comes with a "Feature" and "Bug" category.'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setState({templateFeedback: !this.state.templateFeedback})}
                />
                <TemplateCard
                  title='Changelog'
                  content='Update your users with new changes to your product.'
                  checked={!!this.state.templateChangelog}
                  onChange={() => this.setState({templateChangelog: !this.state.templateChangelog})}
                />
                <TemplateCard
                  title='Knowledge Base'
                  content='Document your product.'
                  checked={!!this.state.templateKnowledgeBase}
                  onChange={() => this.setState({templateKnowledgeBase: !this.state.templateKnowledgeBase})}
                />
                {/* TODO combine into knowledge base */}
                <TemplateCard
                  title='Frequently Asked Questions'
                  content='Display a list of frequently asked questions'
                  checked={!!this.state.templateFaq}
                  onChange={() => this.setState({templateFaq: !this.state.templateFaq})}
                />
                {/* TODO <TemplateCard
                  title='Community forum'
                  content='Let your users discuss questions'
                  checked={!!this.state.templateFeedback}
                  onChange={() => this.setState({templateFeedback: !this.state.templateFeedback})}
                /> */}
                <TemplateCard
                  title='Blog'
                  content=''
                  checked={!!this.state.templateBlog}
                  onChange={() => this.setState({templateBlog: !this.state.templateBlog})}
                />
              </Grid>
            </StepContent>
          </Step>
        </Stepper>
      </React.Fragment>
    );
  }

  onCreate() {
    
  }
}

interface TemplateCardProps {
  title:string;
  content:string;
  checked:boolean;
  onChange:()=>void;
}

const TemplateCard = withStyles(styles, { withTheme: true })((props:TemplateCardProps&WithStyles<typeof styles, true>) => (
  <Grid item key='feedback' xs={12} sm={6} md={4} lg={3}>
    <Card elevation={0} className={props.classes.box}>
      <CardHeader
        title='Feedback'
        titleTypographyProps={{ align: 'center' }}
        subheaderTypographyProps={{ align: 'center' }}
      />
      <CardContent></CardContent>
      <CardActions>
        <Checkbox color="primary"
          checked={props.checked}
          onChange={props.onChange}
        >{props.checked ? 'Disable' : 'Enable'}</Checkbox>
      </CardActions>
    </Card>
  </Grid>
))

export default withStyles(styles, { withTheme: true })(CreatePage);
