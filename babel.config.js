module.exports = {
  // SDK tests run plain JavaScript in Node and mock React Native. The demo
  // keeps its own React Native preset for Flow, JSX, and native app builds.
  presets: [
    ['@babel/preset-env', { targets: { node: '22.18' }, modules: 'commonjs' }],
  ],
};
