const gobble = require('gobble');

module.exports = gobble('src').transform('babel', {
  comments: false,
  sourceMaps: true,
  presets: [
    'es2015',
    'stage-3'
  ],
  plugins: [
    'syntax-decorators',
    'transform-decorators-legacy',
    'transform-runtime',
    'add-module-exports'
  ]
});
