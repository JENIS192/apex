// App tier process manager:  pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
module.exports = {
  apps: [{
    name: 'apex-noir-api',
    cwd: './backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production' },
  }],
};
