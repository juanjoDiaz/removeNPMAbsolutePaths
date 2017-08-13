[![build status](https://travis-ci.org/juanjoDiaz/removeNPMAbsolutePaths.svg?branch=master)](https://travis-ci.org/juanjoDiaz/removeNPMAbsolutePaths?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/juanjoDiaz/removeNPMAbsolutePaths/badge.svg?branch=master)](https://coveralls.io/github/juanjoDiaz/removeNPMAbsolutePaths?branch=master)

# removeNPMAbsolutePaths

removeNPMAbsolutePaths is a small utility to remove the fields that npm adds to the modules in `node_modules` containing local aboslute paths.

It has been noted that the `package.json` of modules in the `node_modules` folder contain some extra fields like `_args` and `where` which contain the absolute path of the module. According to NPM those fields are not even used.

The problem comes when you are planning to package your application using electron, NW.js or similar and distribute it. You might not want to distribute files containing absolute paths within your computer.

A feature request has been raised to NPM to fix this issue but they have made clear they don't plan to fix this.
  - https://github.com/npm/npm/issues/12110 (feature request)
  - https://github.com/npm/npm/issues/10393 (discussion about the topic)

## Using removeNPMAbsolutePaths

removeNPMAbsolutePaths simply loop through all the files in the given folder, open the files called `package.json` and remove all the fields starting with an underscore (`_`).

You can  install removeNPMAbsolutePaths globally and use it from the command line
```Javascript
npm install -g removeNPMAbsolutePaths
removeNPMAbsolutePaths "<PROJECT_FOLDER>"
```
or use it from whithin your code
```Javascript
var removeNPMAbsolutePaths = require('removeNPMAbsolutePaths');
removeNPMAbsolutePaths("<PROJECT_FOLDER>")
  .then(results => results.forEach(result => {
    // Print only information about files that couldn't be processed
    if (!result.success) {
      console.log(result.err.message);
    }
  }))
  .catch(err => console.log(err.message));
```
Using `removeNPMAbsolutePaths` from within Javascript returns a promise containing information about all the folders and files processed and whether they where successfully processed and rewritten or not.

### Options
removeNPMAbsolutePaths can be configured using tags. Tags can be added to the command line commands:
```Javascript
removeNPMAbsolutePaths "<PROJECT_FOLDER>" --tag1 --tag2
```
or passed programmatically in an options object
```Javascript
removeNPMAbsolutePaths("<PROJECT_FOLDER>", { tag1: true, tag2: false});
```

#### force
removeNPMAbsolutePaths only rewrite to disk the files that it modifies. Passing the `--force` tag will rewritte all the files even if they haven't been modfied. This might be useful if you want all the package.json files to have always exactly the same styling for example for hashing.

## License
MIT
