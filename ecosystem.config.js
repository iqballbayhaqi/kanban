module.exports = {
  apps: [
    {
      name: 'kanban-backend',
      script: './backend/server.js',
      cwd: '/var/www/kanban',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 3000,
    },
  ],
};
