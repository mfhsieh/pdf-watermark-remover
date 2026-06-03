const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const fs = require('fs');
const encodingJs = fs.readFileSync('node_modules/text-encoding/lib/encoding.js', 'utf8');

// evaluate encoding.js
eval(encodingJs);

console.log(global.TextEncoder === TextEncoder);
console.log(global.TextEncoding);
