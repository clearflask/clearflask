import { Button, Card, CardActions, CardContent, CardHeader, FormControlLabel, Radio, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import classNames from 'classnames';
import { LocationDescriptor } from 'history';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import * as Admin from '../api/admin';
import HelpPopper from '../common/HelpPopper';

const styles = (theme: Theme) => createStyles({
  title: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
  cardPricingTerms: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing(-1),
    marginBottom: theme.spacing(2),
    lineHeight: 1.3 + '!important',
  },
  comingSoon: {
    color: theme.palette.text.secondary,
  },
  cardBeta: {
    margin: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  beta: {
    fontSize: '0.5em',
    color: theme.palette.text.secondary,
    marginLeft: '1em',
  },
  box: {
    transition: theme.transitions.create('border'),
    border: '1px solid ' + theme.palette.grey[300],
  },
  boxSelected: {
    borderColor: theme.palette.primary.main,
  },
  actions: {
    margin: theme.spacing(0, 3, 1),
  },
  remark: {
    display: 'flex',
    justifyContent: 'center',
    margin: theme.spacing(0, 1, 1),
  },
  reallyBlurry: {
    color: 'transparent',
    textShadow: '0px 0px 9px rgba(0,0,0,0.3)',
  }
});

interface Props {
  className?: string;
  plan: Admin.Plan;
  selected?: boolean;
  actionTitle?: string;
  actionType?: 'button' | 'radio';
  actionTo?: LocationDescriptor;
  actionOnClick?: () => void;
  hidePerks?: boolean;
  remark?: string;
}

class PricingPlan extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Card elevation={0} className={classNames(this.props.className, this.props.classes.box, this.props.selected && this.props.classes.boxSelected)}>
        <CardHeader
          title={(
            <div className={this.props.classes.title}>
              {this.props.plan.title}
              {this.props.plan.beta && (
                <div className={this.props.classes.beta}>
                  EARLY<br />ACCESS
                </div>
              )}
            </div>
          )}
          titleTypographyProps={{ align: 'center' }}
        />
        <CardContent>
          {this.renderPriceTag()}
          {!this.props.hidePerks && this.props.plan.perks.map(perk => (
            <div key={perk.desc} style={{ display: 'flex', alignItems: 'baseline' }}>
              <CheckIcon fontSize='inherit' />
              &nbsp;
              <Typography variant='subtitle1'>
                {perk.desc}
                {!!perk.terms && (<React.Fragment>
                  &nbsp;
                  <HelpPopper description={perk.terms} />
                </React.Fragment>)}
              </Typography>
            </div>
          ))}
        </CardContent>
        {this.props.remark && (
          <div className={this.props.classes.remark}>
            <Typography variant='caption' component='div' color='textSecondary'>{this.props.remark}</Typography>
          </div>
        )}
        {
          !!this.props.actionTitle && (
            <CardActions className={this.props.classes.actions}>
              {this.props.actionType === 'radio' ? (
                <FormControlLabel
                  label={this.props.actionTitle}
                  control={(
                    <Radio
                      checked={this.props.selected}
                      color='primary'
                      onChange={e => this.props.actionOnClick && this.props.actionOnClick()}
                      disabled={!this.props.actionOnClick}
                    />
                  )}
                />
              ) : (
                  <Button fullWidth color='primary'
                    onClick={this.props.actionOnClick}
                    disabled={!this.props.actionOnClick}
                    {...(this.props.actionTo ? {
                      component: Link,
                      to: this.props.actionTo,
                    } : {})}
                  >
                    {this.props.actionTitle}
                  </Button>
                )}
            </CardActions>
          )
        }
      </Card >
    );
  }

  renderPriceTag() {
    if (!this.props.plan.pricing) return (
      <div className={this.props.classes.cardPricing}>
        <Typography className={this.props.classes.reallyBlurry} component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
        <Typography className={this.props.classes.reallyBlurry} component='div' variant='h4'>800</Typography>
        <Typography component='div' variant='subtitle2' color='textSecondary'>&nbsp;&nbsp;/&nbsp;year</Typography>
      </div>
    );

    var billed: any = null;
    switch (this.props.plan.pricing?.period) {
      case Admin.PlanPricingPeriodEnum.Monthly:
        break;
      case Admin.PlanPricingPeriodEnum.Quarterly:
        billed = `$${this.props.plan.pricing.basePrice * 3} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
      case Admin.PlanPricingPeriodEnum.Yearly:
        billed = `$${this.props.plan.pricing.basePrice * 12} billed ${this.props.plan.pricing.period.toLowerCase()}`;
        break;
    }
    if (billed) billed = (
      <Typography component='div' variant='subtitle1'>{billed}</Typography>
    );

    const simplifiedMaus: boolean = this.props.plan.pricing.basePrice === this.props.plan.pricing.unitPrice
      && this.props.plan.pricing.baseMau === this.props.plan.pricing?.unitMau;

    if (simplifiedMaus) return (
      <div className={this.props.classes.cardPricing}>
        <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
        <Typography component='div' variant='h4'>{this.props.plan.pricing.basePrice}</Typography>
        <Typography component='div' variant='subtitle2' color='textSecondary'>{`/ ${this.props.plan.pricing.baseMau} MAU`}</Typography>
        {billed && (
          <div className={this.props.classes.cardPricingTerms}>
            {billed}
          </div>
        )}
      </div>
    );

    var extraMau: any = null;
    if ((this.props.plan.pricing.unitPrice || 0) > 0) {
      extraMau = (
        <React.Fragment>
          <Typography component='div' variant='subtitle2' color='textSecondary'>{`includes ${this.props.plan.pricing.baseMau} MAU`}</Typography>
          <Typography component='div' variant='subtitle2' color='textSecondary'>{`+ $${this.props.plan.pricing.unitPrice} / extra ${this.props.plan.pricing.unitMau} MAU`}</Typography>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <div className={this.props.classes.cardPricing}>
          <Typography component='h2' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
          <Typography component='h2' variant='h4'>{this.props.plan.pricing.basePrice}</Typography>
          <Typography component='h2' variant='subtitle2' color='textSecondary'>{'/ mo'}</Typography>
        </div>
        {(extraMau || billed) && (
          <div className={this.props.classes.cardPricingTerms}>
            {extraMau}
            {billed}
          </div>
        )}
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);
