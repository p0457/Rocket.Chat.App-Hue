export default {
  login: {
    command: 'hue-login',
    usage: '`/hue-login`',
    description: 'Login to Hue',
  },
  lights: {
    command: 'hue-lights',
    usage: '`/hue-lights`',
    description: 'View your Lights',
  },
  lightState: {
    command: 'hue-light-state',
    usage: '`/hue-light-state [ID,ID] (on=true) (bri=254) (hue=65535) sat=(254) (cie=0.5:0.4) (alert=false)`',
    description: 'Change Light state',
  },
};
