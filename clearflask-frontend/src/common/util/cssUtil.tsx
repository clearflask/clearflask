import { lighten, Theme } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';

export const buttonHover = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    transition: theme.transitions.create(['background-color']),
    backgroundSize: '30px 30px',
    backgroundPositionY: 'center',
    '&:hover': {
      background: `linear-gradient(to right, ${lighten(theme.palette.primary.main, 0.7)} 2px, transparent 2px) 0 0`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: '30px 30px',
      backgroundPositionY: 'center',
    },
  };
};

export const buttonSelected = (theme: Theme): Record<string, string | CSSProperties> => {
  return {
    background: `linear-gradient(to right, ${theme.palette.primary.main} 2px, transparent 2px) 0 0`
      + '!important',
    backgroundRepeat: 'no-repeat !important',
    backgroundSize: '50px 50px !important',
    backgroundPositionY: 'center !important',
  };
};
