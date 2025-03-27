module.exports = {
  apps: [{
    name: "blacksky-md",
    script: "src/index.js",
    watch: ["src"],
    ignore_watch: ["node_modules", "logs", "data", "temp", "auth_info_baileys", "auth_info_baileys_backup"],
    autorestart: true,
    max_memory_restart: "600M",
    env: {
      NODE_ENV: "production",
      PLATFORM: "termux"
    },
    exp_backoff_restart_delay: 1000,
    max_restarts: 10,
    restart_delay: 3000,
    error_file: "logs/pm2-error.log",
    out_file: "logs/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    log_type: "json",
    node_args: "--max-old-space-size=512",
  }]
};