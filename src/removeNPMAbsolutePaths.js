var fs = require('fs');
var path = require('path');

module.exports = removeNPMAbsolutePaths;

function removeNPMAbsolutePaths(dir, opts) {
  fs.readdir(dir, function (err, files) {
    if (err) return console.log(err);

    files.forEach(function (fileName) {
      var filePath = path.join(dir, fileName);

      fs.stat(filePath, function (err, stats) {
        if (err) return console.log(err);

        if (stats.isDirectory()) {
          removeNPMAbsolutePaths(filePath, opts);
        } else {
          if (fileName === 'package.json') {
            fs.readFile(filePath, 'utf8', function (err, data) {
              if (err) return console.log(err);

              var writeFile = false;
              var obj;
              try {
                obj = JSON.parse(data);
              } catch (e) {
                // ignore malformed package.json files.
                return;
              }

              for (var prop in obj) {
                if (prop[0] === '_') {
                  delete obj[prop];
                  writeFile = true;
                }
              }

              if (writeFile || opts.force) {
                fs.writeFile(filePath, JSON.stringify(obj, null, '  '), function (err) {
                  if (err) return console.log(err);
                });
              }
            });
          }
        }
      });
    });
  });
}
