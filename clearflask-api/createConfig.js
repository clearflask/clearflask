const SwaggerParser = require('swagger-parser');
const fs = require('fs');

const SPEC_LOCATION = './api.yaml';
const SAVE_LOCATION = '../clearflask-frontend/src/api/schema';
const CONF_PATH = [
  'paths',
  '/project/{projectId}/admin/config',
  'get',
  'responses',
  '200',
  'content',
  'application/json',
  'schema',
];

SwaggerParser.dereference(SPEC_LOCATION, function(err, api) {
  if (err) {
    console.error('Failed to parse OpenApi spec %s. Err: %s', SPEC_LOCATION, err);
    process.exit(1);
  }
  else {
    console.log("Parsed API %s (%s)", api.info.title, api.info.version);
    configSchema = CONF_PATH.reduce((tree, nextKey) => {
      if(tree && tree[nextKey]) {
        return tree[nextKey];
      } else {
        console.log('Failed to find next key %s within parsed spec. Available keys %s, attempted path %s',
          nextKey, Object.keys(tree), CONF_PATH)
        process.exit(2);
      }
    }, api);
    
    fs.mkdir(SAVE_LOCATION, { recursive: true }, (err) => {
      if(err) {
        console.log('Failed creating directories %s. Err: %s', SAVE_LOCATION, err);
        process.exit(3);
      }

      filePath = `${SAVE_LOCATION}/schema-${api.info.version}.json`;
      fs.writeFile(filePath, JSON.stringify(configSchema), function(err) {
        if(err) {
          console.log('Failed writing config schema to file %s. Err: %s', filePath, err);
          process.exit(4);
        }

        console.log('Config schema saved under %s', filePath);
      });
    });
  }
});
