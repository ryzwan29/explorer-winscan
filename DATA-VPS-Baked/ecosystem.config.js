module.exports = {
  apps: [{
    name: 'blockchain-api',
    script: './dist/index.js',
    instances: 2, // CPU cores - 1, atau 'max'
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 4000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto restart on memory leak
    min_uptime: '10s',
    max_restarts: 10,
    
    // Graceful shutdown
    kill_timeout: 3000,
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
};
