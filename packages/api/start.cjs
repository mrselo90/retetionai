// Production entry under PM2 (ecosystem.config.cjs). The API runs as a PM2
// cluster so deploys reload it one process at a time. Cluster workers get the
// app's env and working directory only after preloads run, so `-r newrelic`
// there saw neither the licence key nor newrelic.cjs and the agent never
// started. Loading it here, first, happens after both are in place.
require('newrelic');
import('./dist/index.js');
