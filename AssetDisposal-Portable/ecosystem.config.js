module.exports = {
  apps: [
    {
      name: 'asset-disposal-backend',
      script: './backend/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 6000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 6000,
      },
    },
    {
      name: 'asset-disposal-frontend',
      script: './frontend-server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 6001,
        DIST_PATH: './dist',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 6001,
        DIST_PATH: './dist',
      },
    },
  ],
};
