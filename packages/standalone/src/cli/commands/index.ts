import Cleanup from './cleanup.js';
import ExportOpenapi from './export/openapi.js';
import Serve from './serve.js';

export default {
  cleanup: Cleanup,
  'export:openapi': ExportOpenapi,
  serve: Serve,
};
