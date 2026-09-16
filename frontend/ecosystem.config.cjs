module.exports = {
  apps: [
    {
      name: 'mongo-gui',
      script: 'npm',
      args: 'run start:4000',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
