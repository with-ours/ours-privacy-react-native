module.exports = api => {
  // Under Jest, `@env` is mapped to fixed values (see jest.config.js) so tests
  // don't depend on the local .env file.
  const isTest = api.env('test');
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: isTest
      ? []
      : [
          [
            'module:react-native-dotenv',
            {
              envName: 'APP_ENV',
              moduleName: '@env',
              path: '.env',
            },
          ],
        ],
  };
};
