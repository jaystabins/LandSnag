// Global test setup
Object.assign(process.env, {
  NODE_ENV: 'test',
  REALTOR_API_KEY: 'test-key',
  CACHE_THRESHOLD: '5',
  CACHE_TTL_HOURS: '24',
  MAX_RESULTS: '500'
});
