/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names, no-unused-expressions */

'use strict';

const fs = require('fs');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

let removeNPMAbsolutePaths = require('../src/removeNPMAbsolutePaths');

function clearCachedModuleSoNewMocksWork() {
  delete require.cache[require.resolve('../src/removeNPMAbsolutePaths')];
  // eslint-disable-next-line global-require
  removeNPMAbsolutePaths = require('../src/removeNPMAbsolutePaths');
}

describe('removeNPMAbsolutePaths.js', async function () {
  describe('valid permissions', async function () {
    let stat;
    let readdir;
    let readFile;
    let writeFile;

    before(function () {
      stat = sinon.spy(fs.promises, 'stat');
      readdir = sinon.spy(fs.promises, 'readdir');
      readFile = sinon.spy(fs.promises, 'readFile');
      writeFile = sinon.stub(fs.promises, 'writeFile');
      clearCachedModuleSoNewMocksWork();
    });

    beforeEach(function () {
      stat.resetHistory();
      readdir.resetHistory();
      readFile.resetHistory();
      writeFile.resetHistory();
      writeFile.resolves(null);
    });

    after(function () {
      stat.restore();
      readdir.restore();
      readFile.restore();
      writeFile.restore();
    });

    describe('invalid path', function () {
      it('fails if path is empty', async function () {
        const promise = removeNPMAbsolutePaths();
        await expect(promise).to.be.rejectedWith('Missing path');
        expect(stat).to.not.have.been.called;
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.not.have.been.called;
        expect(writeFile).to.not.have.been.called;
      });

      it('fails if file path is invalid', async function () {
        const filePath = path.join(__dirname, 'FAKE_PATH', 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        await expect(promise).to.be.rejectedWith('Can\'t read directory/file');
        expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.not.have.been.called;
        expect(writeFile).to.not.have.been.called;
      });

      it('fails if file path is not package.json', async function () {
        const filePath = path.join(__dirname, 'data', 'not_package_json', 'module', 'not_package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        await expect(promise).to.be.rejectedWith('Invalid path provided');
        expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.not.have.been.called;
        expect(writeFile).to.not.have.been.called;
      });

      it('fails if directory path is invalid', async function () {
        const dirPath = path.join(__dirname, 'FAKE_PATH');
        const promise = removeNPMAbsolutePaths(dirPath);
        await expect(promise).to.be.rejectedWith('Can\'t read directory/file');
        expect(stat).to.have.been.calledOnce.and.calledWith(dirPath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.not.have.been.called;
        expect(writeFile).to.not.have.been.called;
      });

      it('do nothing directory path doesn\'t contain package.json', async function () {
        const dirPath = path.join(__dirname, 'data', 'not_package_json');
        const filePath = path.join(dirPath, 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(dirPath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(2)
          .and.to.not.include({ filePath });
        expect(stat).to.have.been.called;
        expect(readdir).to.have.been.called;
        expect(readFile).to.not.have.been.called;
        expect(writeFile).to.not.have.been.called;
      });
    });

    describe('directory path', function () {
      it('return error on malformed files if file is malformed', async function () {
        const dirPath = path.join(__dirname, 'data', 'malformed');
        const filePath = path.join(dirPath, 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(dirPath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(3);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: false });
        expect(fileResults.err)
          .to.exist
          .and.be.instanceof(Error)
          .and.to.include({ message: `Malformed package.json file at "${filePath}"` });
        expect(stat).to.have.been.called;
        expect(readdir).to.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.not.have.been.called;
      });

      it('rewrite pacakge.json if contains _fields', async function () {
        const dirPath = path.join(__dirname, 'data', 'underscore_fields');
        const filePath = path.join(dirPath, 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(dirPath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(3);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: true, rewritten: true });
        expect(fileResults.err).to.not.exist;
        expect(stat).to.have.been.called;
        expect(readdir).to.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
        const packageJson = JSON.parse(writeFile.getCall(0).args[1]);
        expect(Object.keys(packageJson).find((key) => key[0] === '_')).to.not.exist;
      });

      it('preserve newline at the end of packa.json if rewriting', async function () {
        const dirPath = path.join(__dirname, 'data', 'underscore_fields');
        const filePath = path.join(dirPath, 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(dirPath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(3);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: true, rewritten: true });
        expect(fileResults.err).to.not.exist;
        expect(stat).to.have.been.called;
        expect(readdir).to.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile.getCall(0).args[1]).to.satisfy((newPackageJson) => newPackageJson.endsWith('\n'));

        readdir.resetHistory();
        readFile.resetHistory();
        writeFile.resetHistory();

        const dirPath2 = path.join(__dirname, 'data', 'underscore_field_no_end_newline');
        const filePath2 = path.join(dirPath2, 'module', 'package.json');
        const promise2 = removeNPMAbsolutePaths(dirPath2);
        const results2 = await expect(promise2).be.fulfilled;
        expect(results2).to.be.an('array').that.have.lengthOf(3);
        const fileResults2 = results2.find((result) => result.filePath === filePath2);
        expect(fileResults2).to.include({ success: true, rewritten: true });
        expect(fileResults2.err).to.not.exist;
        expect(stat).to.have.been.called;
        expect(readdir).to.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath2);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath2);
        expect(writeFile.getCall(0).args[1]).to.satisfy((newPackageJson) => !newPackageJson.endsWith('\n'));
      });

      describe('force', async function () {
        it('doesn\'t rewrite pacakge.json if doesn\'t contain _fields and force option isn\'t passed', async function () {
          const dirPath = path.join(__dirname, 'data', 'no_underscore_fields');
          const filePath = path.join(dirPath, 'module', 'package.json');
          const promise = removeNPMAbsolutePaths(dirPath);
          const results = await expect(promise).be.fulfilled;
          expect(results).to.be.an('array').that.have.lengthOf(3);
          const fileResults = results.find((result) => result.filePath === filePath);
          expect(fileResults).to.include({ success: true, rewritten: false });
          expect(fileResults.err).to.not.exist;
          expect(stat).to.have.been.called;
          expect(readdir).to.have.been.called;
          expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
          expect(writeFile).to.not.have.been.called;
        });

        it('rewrite pacakge.json if doesn\'t contain _fields and force option is passed', async function () {
          const dirPath = path.join(__dirname, 'data', 'no_underscore_fields');
          const filePath = path.join(dirPath, 'module', 'package.json');
          const promise = removeNPMAbsolutePaths(dirPath, { force: true });
          const results = await expect(promise).be.fulfilled;
          expect(results).to.be.an('array').that.have.lengthOf(3);
          const fileResults = results.find((result) => result.filePath === filePath);
          expect(fileResults).to.include({ success: true, rewritten: true });
          expect(fileResults.err).to.not.exist;
          expect(stat).to.have.been.called;
          expect(readdir).to.have.been.called;
          expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
          expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
        });
      });

      describe('fields', async function () {
        it('return error if fields option is passed but is not an array', async function () {
          const dirPath = path.join(__dirname, 'data', 'underscore_fields');
          const opts = {
            fields: 'string_value',
          };
          const promise = removeNPMAbsolutePaths(dirPath, opts);
          await expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.');
          expect(stat).to.not.have.been.called;
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.not.have.been.called;
          expect(writeFile).to.not.have.been.called;
        });

        it('return error if fields option is passed but is empty', async function () {
          const dirPath = path.join(__dirname, 'data', 'underscore_fields');
          const opts = {
            fields: [],
          };
          const promise = removeNPMAbsolutePaths(dirPath, opts);
          await expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.');
          expect(stat).to.not.have.been.called;
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.not.have.been.called;
          expect(writeFile).to.not.have.been.called;
        });

        it('rewrite only user-specified fields in package.json if fields option is passed', async function () {
          const dirPath = path.join(__dirname, 'data', 'underscore_fields');
          const filePath = path.join(dirPath, 'module', 'package.json');
          const opts = {
            fields: ['_inBundle', '_where'],
          };
          const promise = removeNPMAbsolutePaths(dirPath, opts);
          const results = await expect(promise).be.fulfilled;
          expect(results).to.be.an('array').that.have.lengthOf(3);
          const fileResults = results.find((result) => result.filePath === filePath);
          expect(fileResults).to.include({ success: true, rewritten: true });
          expect(fileResults.err).to.not.exist;
          expect(stat).to.have.been.called;
          expect(readdir).to.have.been.called;
          expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
          expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
          const packageJson = JSON.parse(writeFile.getCall(0).args[1]);
          expect(packageJson).to.not.have.property('_inBundle');
          expect(packageJson).to.not.have.property('_where');
          expect(packageJson).to.have.property('_from');
          expect(packageJson).to.have.property('_shasum');
        });
      });
    });

    describe('file path', async function () {
      it('return error on malformed files if file is malformed', async function () {
        const filePath = path.join(__dirname, 'data', 'malformed', 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(1);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: false });
        expect(fileResults.err)
          .to.exist
          .and.be.instanceof(Error)
          .and.to.include({ message: `Malformed package.json file at "${filePath}"` });
        expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.not.have.been.called;
      });

      it('rewrite file if contains _fields', async function () {
        const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(1);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: true, rewritten: true });
        expect(fileResults.err).to.not.exist;
        expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
        const packageJson = JSON.parse(writeFile.getCall(0).args[1]);
        expect(Object.keys(packageJson).find((key) => key[0] === '_')).to.not.exist;
      });

      it('preserve newline at the end of packa.json if rewriting', async function () {
        const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(1);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: true, rewritten: true });
        expect(fileResults.err).to.not.exist;
        expect(stat).to.have.been.called;
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile.getCall(0).args[1]).to.satisfy((newPackageJson) => newPackageJson.endsWith('\n'));

        readdir.resetHistory();
        readFile.resetHistory();
        writeFile.resetHistory();

        const filePath2 = path.join(__dirname, 'data', 'underscore_field_no_end_newline', 'module', 'package.json');
        const promise2 = removeNPMAbsolutePaths(filePath2);
        const results2 = await expect(promise2).be.fulfilled;
        expect(results2).to.be.an('array').that.have.lengthOf(1);
        const fileResults2 = results2.find((result) => result.filePath === filePath2);
        expect(fileResults2).to.include({ success: true, rewritten: true });
        expect(fileResults2.err).to.not.exist;
        expect(stat).to.have.been.called;
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath2);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath2);
        expect(writeFile.getCall(0).args[1]).to.satisfy((newPackageJson) => !newPackageJson.endsWith('\n'));
      });

      describe('force', async function () {
        it('doesn\'t rewrite file if doesn\'t contain _fields and force option isn\'t passed', async function () {
          const filePath = path.join(__dirname, 'data', 'no_underscore_fields', 'module', 'package.json');
          const promise = removeNPMAbsolutePaths(filePath);
          const results = await expect(promise).be.fulfilled;
          expect(results).to.be.an('array').that.have.lengthOf(1);
          const fileResults = results.find((result) => result.filePath === filePath);
          expect(fileResults).to.include({ success: true, rewritten: false });
          expect(fileResults.err).to.not.exist;
          expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
          expect(writeFile).to.not.have.been.called;
        });

        it('rewrite file if doesn\'t contain _fields and force option is passed', async function () {
          const filePath = path.join(__dirname, 'data', 'no_underscore_fields', 'module', 'package.json');
          const promise = removeNPMAbsolutePaths(filePath, { force: true });
          const results = await expect(promise).be.fulfilled;
          expect(results).to.be.an('array').that.have.lengthOf(1);
          const fileResults = results.find((result) => result.filePath === filePath);
          expect(fileResults).to.include({ success: true, rewritten: true });
          expect(fileResults.err).to.not.exist;
          expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
          expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
        });
      });

      describe('fields', async function () {
        it('return error if fields option is passed but is not an array', async function () {
          const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
          const opts = {
            fields: 'string_value',
          };
          const promise = removeNPMAbsolutePaths(filePath, opts);
          await expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.');
          expect(stat).to.not.have.been.called;
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.not.have.been.called;
          expect(writeFile).to.not.have.been.called;
        });

        it('return error if fields option is passed but is empty', async function () {
          const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
          const opts = {
            fields: [],
          };
          const promise = removeNPMAbsolutePaths(filePath, opts);
          await expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.');
          expect(stat).to.not.have.been.called;
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.not.have.been.called;
          expect(writeFile).to.not.have.been.called;
        });

        it('rewrite only user-specified fields in package.json if fields option is passed', async function () {
          const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
          const opts = {
            fields: ['_inBundle', '_where'],
          };
          const promise = removeNPMAbsolutePaths(filePath, opts);
          const results = await expect(promise).be.fulfilled;
          expect(results).to.be.an('array').that.have.lengthOf(1);
          const fileResults = results.find((result) => result.filePath === filePath);
          expect(fileResults).to.include({ success: true, rewritten: true });
          expect(fileResults.err).to.not.exist;
          expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
          expect(readdir).to.not.have.been.called;
          expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
          expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
          const packageJson = JSON.parse(writeFile.getCall(0).args[1]);
          expect(packageJson).to.not.have.property('_inBundle');
          expect(packageJson).to.not.have.property('_where');
          expect(packageJson).to.have.property('_from');
          expect(packageJson).to.have.property('_shasum');
        });
      });
    });
  });

  describe('invalid permissions', async function () {
    describe('read directory', async function () {
      let stat;
      let readdir;
      let readFile;
      let writeFile;

      before(function () {
        stat = sinon.spy(fs.promises, 'stat');
        readdir = sinon.stub(fs.promises, 'readdir');
        readFile = sinon.spy(fs.promises, 'readFile');
        writeFile = sinon.spy(fs.promises, 'writeFile');
        clearCachedModuleSoNewMocksWork();
      });

      beforeEach(function () {
        stat.resetHistory();
        readdir.resetHistory();
        readFile.resetHistory();
        writeFile.resetHistory();
      });

      after(function () {
        stat.restore();
        readdir.restore();
        readFile.restore();
        writeFile.restore();
      });

      it('return error if can\'t read file', async function () {
        const err = new Error('Can\'t read directory.');
        readdir.rejects(err);
        clearCachedModuleSoNewMocksWork();
        const dirPath = path.join(__dirname, 'data', 'underscore_fields');
        const promise = removeNPMAbsolutePaths(dirPath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(1);
        const fileResults = results.find((result) => result.dirPath === dirPath);
        expect(fileResults).to.include({ success: false });
        expect(fileResults.err)
          .to.exist
          .and.be.instanceof(Error)
          .and.to.include({ message: `Can't read directory at "${dirPath}"`, cause: err });
        expect(stat).to.have.been.calledOnce.and.calledWith(dirPath);
        expect(readdir).to.have.been.calledOnce.and.calledWith(dirPath);
        expect(readFile).to.not.have.been.called;
        expect(writeFile).to.not.have.been.called;
      });
    });

    describe('read file', async function () {
      let stat;
      let readdir;
      let readFile;
      let writeFile;

      before(function () {
        stat = sinon.spy(fs.promises, 'stat');
        readdir = sinon.spy(fs.promises, 'readdir');
        readFile = sinon.stub(fs.promises, 'readFile');
        writeFile = sinon.stub(fs.promises, 'writeFile');
      });

      beforeEach(function () {
        stat.resetHistory();
        readdir.resetHistory();
        readFile.resetHistory();
        writeFile.resetHistory();
      });

      after(function () {
        stat.restore();
        readdir.restore();
        readFile.restore();
        writeFile.restore();
      });

      it('return error if can\'t read file', async function () {
        const err = new Error('Can\'t read file.');
        readFile.rejects(err);
        clearCachedModuleSoNewMocksWork();
        const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(1);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: false });
        expect(fileResults.err)
          .to.exist
          .and.be.instanceof(Error)
          .and.to.include({ message: `Can't read file at "${filePath}"`, cause: err });
        expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.not.have.been.called;
      });
    });

    describe('write file', async function () {
      let stat;
      let readdir;
      let readFile;
      let writeFile;

      before(function () {
        stat = sinon.spy(fs.promises, 'stat');
        readdir = sinon.spy(fs.promises, 'readdir');
        readFile = sinon.spy(fs.promises, 'readFile');
        writeFile = sinon.stub(fs.promises, 'writeFile');
      });

      beforeEach(function () {
        stat.resetHistory();
        readdir.resetHistory();
        readFile.resetHistory();
        writeFile.resetHistory();
      });

      after(function () {
        stat.restore();
        readdir.restore();
        readFile.restore();
        writeFile.restore();
      });

      it('return error if can\'t write to file', async function () {
        const err = new Error('Can\'t write to file.');
        writeFile.rejects(err);
        clearCachedModuleSoNewMocksWork();
        const filePath = path.join(__dirname, 'data', 'underscore_fields', 'module', 'package.json');
        const promise = removeNPMAbsolutePaths(filePath);
        const results = await expect(promise).be.fulfilled;
        expect(results).to.be.an('array').that.have.lengthOf(1);
        const fileResults = results.find((result) => result.filePath === filePath);
        expect(fileResults).to.include({ success: false });
        expect(fileResults.err)
          .to.exist
          .and.be.instanceof(Error)
          .and.to.include({ message: `Can't write processed file to "${filePath}"`, cause: err });
        expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
        expect(readdir).to.not.have.been.called;
        expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
        expect(writeFile).to.have.been.calledOnce.and.calledWith(filePath);
      });
    });
  });
});
