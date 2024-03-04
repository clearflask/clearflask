import {ProjectSettingsBase} from './ProjectSettings';
import ServerAdmin, {ReduxStateAdmin} from '../../api/serverAdmin';
import {Grid, Typography} from '@material-ui/core';
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import {shallowEqual, useSelector} from 'react-redux';
import * as Admin from '../../api/admin';
import React, {useEffect} from 'react';
import {Status} from '../../api/server';
import Loader from '../../app/utils/Loader';
import Message from '../../common/Message';

const styles = (theme: Theme) => createStyles({
    item: {
        margin: theme.spacing(4),
    },
    plan: {
        margin: theme.spacing(2, 'auto'),
    },
});
const useStyles = makeStyles(styles);

export const SelfhostLicensePage = () => {
    const classes = useStyles();
    const status = useSelector<ReduxStateAdmin, Status | undefined>(state => state.account.billing.status, shallowEqual);
    const billing = useSelector<ReduxStateAdmin, Admin.AccountBilling | undefined>(state => state.account.billing.billing, shallowEqual);
    useEffect(() => {
        ServerAdmin.get().dispatchAdmin()
            .then(d => d.accountBillingAdmin({}));
    }, []);

    if (!billing || status !== Status.FULFILLED) {
        return (
            <Loader skipFade status={status}/>
        );
    }

    return (
        <ProjectSettingsBase
            title="License"
            description={(
                <>
                    Use the following license key in your self-hosted instance
                    <br/>
                    of ClearFlask to unlock the plan's benefits.

                    <p/>
                    Your self-hosted instance will periodically validate this
                    <br/>
                    license key online. If you need offline validation, contact us.
                </>
            )}
        >
            <Grid container alignItems="baseline" className={classes.item}>
                <Grid item xs={12} sm={4}><Typography>License key</Typography></Grid>
                <Grid item xs={12}
                      sm={8}>{billing.purchasedLicenseKey ||
                    <Message severity='warning' message='Check billing'/>}</Grid>
            </Grid>
            {/* <Grid container spacing={5} alignItems="stretch" justify="center">
                <Grid item xs={6}>
                    <PricingPlan
                        selected
                        className={classes.plan}
                        plan={billing.plan}
                    />
                </Grid>
            </Grid> */}
        </ProjectSettingsBase>
    );
};
