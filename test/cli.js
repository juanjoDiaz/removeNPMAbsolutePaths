/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names, no-unused-expressions */

'use strict';

const chai = require('chai');

const expect = chai.expect;

const cli = require('../src/cli');

describe('cli', function () {
  describe('parseArguments', function () {
    const path = 'test.js';
    const testFields = ['testField1', 'testField2'];
    const unknownArg1 = 'wrong';
    const unknownArg2 = '--wrong';

    it('fails if path is empty', function () {
      const args = [];
      expect(() => cli.parseArguments(args)).to.throw('Missing path.\nThe first argument should be the path to a directory or a package.json file.');
    });

    it('set the path to the value passed and use default values', function () {
      const args = [path];
      const parsedArgs = cli.parseArguments(args);
      expect(parsedArgs.path).to.equal(path);
      expect(parsedArgs.opts).to.deep.equal(cli.defaultOpts);
    });

    it('set the force option to true if --force flag is passed', function () {
      const args = [path, '--force'];
      const parsedArgs = cli.parseArguments(args);
      expect(parsedArgs.path).to.equal(path);
      expect(parsedArgs.opts.force).to.equal(true);
      expect(parsedArgs.ignored).to.be.empty;
    });

    it('fails if --field flag and no fields are passed', function () {
      const args = [path, '--fields'];
      expect(() => cli.parseArguments(args)).to.throw('Invalid argument --fields.\nThe --fields flag should be followed by the specific fields that should be removed but none was found');
    });

    it('set the fields option if --field flag and some fields are passed', function () {
      const args = [path, '--fields'].concat(testFields);
      const parsedArgs = cli.parseArguments(args);
      expect(parsedArgs.path).to.equal(path);
      expect(parsedArgs.opts.fields).to.deep.equal(testFields);
      expect(parsedArgs.ignored).to.be.empty;
    });

    it('ignore unknown arguments', function () {
      const args1 = [path, unknownArg1, '--force', unknownArg2, '--fields'].concat(testFields);
      const args2 = [path, '--fields'].concat(testFields).concat(['--force', unknownArg1, unknownArg2]);
      const parsedArgs1 = cli.parseArguments(args1);
      const parsedArgs2 = cli.parseArguments(args2);
      expect(parsedArgs1.ignored).to.deep.equal(parsedArgs2.ignored);
      expect(parsedArgs1.ignored).to.deep.equal([unknownArg1, unknownArg2]);
    });

    it('produce the same result regardless of the arguments passed', function () {
      const args1 = [path, unknownArg1, '--force', unknownArg2, '--fields'].concat(testFields);
      const args2 = [path, '--fields'].concat(testFields).concat(['--force', unknownArg1, unknownArg2]);
      const parsedArgs1 = cli.parseArguments(args1);
      const parsedArgs2 = cli.parseArguments(args2);
      expect(parsedArgs1).to.deep.equal(parsedArgs2);
    });
  });
});
