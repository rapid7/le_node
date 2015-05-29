
var gobble = require('gobble');

module.exports = gobble('src').transform('babel', {
	comments: false,
	optional: [
		'es7.asyncFunctions',
		'es7.decorators',
		'validation.undeclaredVariableCheck'
	],
	sourceMaps: true
});
