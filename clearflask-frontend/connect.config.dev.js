
// Look at ConnectConfig interface for all options
const connectConfig = {
    // If changed, also change in config-prod.cfg
    connectToken: '7cb1e1c26f5d4705a213529257d081c6',
    chunksPublicPath: '/',
    workerCount: 2,
    acmeDirectoryUrl: 'https://host.docker.internal:14000/dir',
};

exports.default = connectConfig;

