# removeNPMAbsolutePaths
removeNPMAbsolutePaths is a small utility to remove the fields that npm adds to the modules in `node_modules` containing local aboslute paths.

It has been noted that the `package.json` of modules in the `node_modules` folder contain some extra fields lie `_args` and `where` which contain the absolute path of the module. According to NPM those fields are not even used.

The problem comes when you are planning to package your application using electron, NW.js or similar and distribute it. You might not one to distribute files containing absolutes path within your computer.

A feature request has been raised to NPM to fix this issue.
  - https://github.com/npm/npm/issues/12110 (feature request)
  - https://github.com/npm/npm/issues/10393 (discussion about the topic)

### Using removeNPMAbsolutePaths
removeNPMAbsolutePaths simple loop through all the files in the given folder, open the files called `package.json` an remove all the fields stating with an underscore (`_`).

You can  install removeNPMAbsolutePaths globally and use it from the command line
```Javascript
npm install -g removeNPMAbsolutePaths
removeNPMAbsolutePaths "<PROJECT_FOLDER>"
```
or use it from whithin your code
```Javascript
var removeNPMAbsolutePaths = require('mkLib');
removeNPMAbsolutePaths("<PROJECT_FOLDER>");
```

### Version
0.0.1

### License
MIT