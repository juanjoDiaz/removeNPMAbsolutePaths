/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names, no-unused-expressions */

'use strict';

const fs = require('fs');
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

describe('removeNPMAbsolutePaths.js', function () {
  describe('valid permissions', function () {
    let stat;
    let readdir;
    let readFile;
    let writeFile;

    before(function () {
      stat = sinon.spy(fs, 'stat');
      readdir = sinon.spy(fs, 'readdir');
      readFile = sinon.spy(fs, 'readFile');
      writeFile = sinon.stub(fs, 'writeFile');
      clearCachedModuleSoNewMocksWork();
    });

    beforeEach(function () {
      stat.resetHistory();
      readdir.resetHistory();
      readFile.resetHistory();
      writeFile.resetHistory();
      writeFile.yields(null);
    });

    after(function () {
      stat.restore();
      readdir.restore();
      readFile.restore();
      writeFile.restore();
    });

    describe('invalid path', function () {
      it('fails if path is empty', function () {
        const promise = removeNPMAbsolutePaths();
        return expect(promise).to.be.rejectedWith('Missing path')
          .then(() => {
            expect(stat).to.not.have.been.called;
            expect(readdir).to.not.have.been.called;
            expect(readFile).to.not.have.been.called;
            expect(writeFile).to.not.have.been.called;
          });
      });

      it('fails if file path is invalid', function () {
        const filePath = `${__dirname}/FAKE_PATH/module/package.json`;
        const promise = removeNPMAbsolutePaths(filePath);
        return expect(promise).to.be.rejectedWith('Can\'t read directory/file')
          .then(() => {
            expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
            expect(readdir).to.not.have.been.called;
            expect(readFile).to.not.have.been.called;
            expect(writeFile).to.not.have.been.called;
          });
      });

      it('fails if file path is not package.json', function () {
        const filePath = `${__dirname}/data/not_package_json/module/not_package.json`;
        const promise = removeNPMAbsolutePaths(filePath);
        return expect(promise).to.be.rejectedWith('Invalid path provided')
          .then(() => {
            expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
            expect(readdir).to.not.have.been.called;
            expect(readFile).to.not.have.been.called;
            expect(writeFile).to.not.have.been.called;
          });
      });

      it('fails if directory path is invalid', function () {
        const dirPath = `${__dirname}/FAKE_PATH`;
        const promise = removeNPMAbsolutePaths(dirPath);
        return expect(promise).to.be.rejectedWith('Can\'t read directory/file')
          .then(() => {
            expect(stat).to.have.been.calledOnce.and.calledWith(dirPath);
            expect(readdir).to.not.have.been.called;
            expect(readFile).to.not.have.been.called;
            expect(writeFile).to.not.have.been.called;
          });
      });

      it('do nothing directory path doesn\'t contain package.json', function () {
        const dirPath = `${__dirname}/data/not_package_json`;
        const filePath = `${dirPath}/module/package.json`;
        const promise = removeNPMAbsolutePaths(dirPath);
        return expect(promise).be.fulfilled
          .then((results) => {
            expect(results).to.be.an('array').that.have.lengthOf(2)
              .and.to.not.include({ filePath });
            expect(stat).to.have.been.called;
            expect(readdir).to.have.been.called;
            expect(readFile).to.not.have.been.called;
            expect(writeFile).to.not.have.been.called;
          });
      });
    });

    describe('directory path', function () {
      it('return error on malformed files if file is malformed', function () {
        const dirPath = `${__dirname}/data/malformed`;
        const filePath = `${dirPath}/module/package.json`;
        const promise = removeNPMAbsolutePaths(dirPath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
      });

      it('rewrite pacakge.json if contains _fields', function () {
        const dirPath = `${__dirname}/data/underscore_fields`;
        const filePath = `${dirPath}/module/package.json`;
        const promise = removeNPMAbsolutePaths(dirPath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
      });

      describe('force', function () {
        it('doesn\'t rewrite pacakge.json if doesn\'t contain _fields and force option isn\'t passed', function () {
          const dirPath = `${__dirname}/data/no_underscore_fields`;
          const filePath = `${dirPath}/module/package.json`;
          const promise = removeNPMAbsolutePaths(dirPath);
          return expect(promise).be.fulfilled
            .then((results) => {
              expect(results).to.be.an('array').that.have.lengthOf(3);
              const fileResults = results.find((result) => result.filePath === filePath);
              expect(fileResults).to.include({ success: true, rewritten: false });
              expect(fileResults.err).to.not.exist;
              expect(stat).to.have.been.called;
              expect(readdir).to.have.been.called;
              expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
              expect(writeFile).to.not.have.been.called;
            });
        });

        it('rewrite pacakge.json if doesn\'t contain _fields and force option is passed', function () {
          const dirPath = `${__dirname}/data/no_underscore_fields`;
          const filePath = `${dirPath}/module/package.json`;
          const promise = removeNPMAbsolutePaths(dirPath, { force: true });
          return expect(promise).be.fulfilled
            .then((results) => {
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
      });

      describe('fields', function () {
        it('return error if fields option is passed but is not an array', function () {
          const dirPath = `${__dirname}/data/underscore_fields`;
          const opts = {
            fields: 'string_value',
          };
          const promise = removeNPMAbsolutePaths(dirPath, opts);
          return expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.')
            .then(() => {
              expect(stat).to.not.have.been.called;
              expect(readdir).to.not.have.been.called;
              expect(readFile).to.not.have.been.called;
              expect(writeFile).to.not.have.been.called;
            });
        });

        it('return error if fields option is passed but is empty', function () {
          const dirPath = `${__dirname}/data/underscore_fields`;
          const opts = {
            fields: [],
          };
          const promise = removeNPMAbsolutePaths(dirPath, opts);
          return expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.')
            .then(() => {
              expect(stat).to.not.have.been.called;
              expect(readdir).to.not.have.been.called;
              expect(readFile).to.not.have.been.called;
              expect(writeFile).to.not.have.been.called;
            });
        });

        it('rewrite only user-specified fields in package.json if fields option is passed', function () {
          const dirPath = `${__dirname}/data/underscore_fields`;
          const filePath = `${dirPath}/module/package.json`;
          const opts = {
            fields: ['_inBundle', '_where'],
          };
          const promise = removeNPMAbsolutePaths(dirPath, opts);
          return expect(promise).be.fulfilled
            .then((results) => {
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
    });

    describe('file path', function () {
      it('return error on malformed files if file is malformed', function () {
        const filePath = `${__dirname}/data/malformed/module/package.json`;
        const promise = removeNPMAbsolutePaths(filePath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
      });

      it('rewrite file if contains _fields', function () {
        const filePath = `${__dirname}/data/underscore_fields/module/package.json`;
        const promise = removeNPMAbsolutePaths(filePath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
      });

      describe('force', function () {
        it('doesn\'t rewrite file if doesn\'t contain _fields and force option isn\'t passed', function () {
          const filePath = `${__dirname}/data/no_underscore_fields/module/package.json`;
          const promise = removeNPMAbsolutePaths(filePath);
          return expect(promise).be.fulfilled
            .then((results) => {
              expect(results).to.be.an('array').that.have.lengthOf(1);
              const fileResults = results.find((result) => result.filePath === filePath);
              expect(fileResults).to.include({ success: true, rewritten: false });
              expect(fileResults.err).to.not.exist;
              expect(stat).to.have.been.calledOnce.and.calledWith(filePath);
              expect(readdir).to.not.have.been.called;
              expect(readFile).to.have.been.calledOnce.and.calledWith(filePath);
              expect(writeFile).to.not.have.been.called;
            });
        });

        it('rewrite file if doesn\'t contain _fields and force option is passed', function () {
          const filePath = `${__dirname}/data/no_underscore_fields/module/package.json`;
          const promise = removeNPMAbsolutePaths(filePath, { force: true });
          return expect(promise).be.fulfilled
            .then((results) => {
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
      });

      describe('fields', function () {
        it('return error if fields option is passed but is not an array', function () {
          const filePath = `${__dirname}/data/underscore_fields/module/package.json`;
          const opts = {
            fields: 'string_value',
          };
          const promise = removeNPMAbsolutePaths(filePath, opts);
          return expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.')
            .then(() => {
              expect(stat).to.not.have.been.called;
              expect(readdir).to.not.have.been.called;
              expect(readFile).to.not.have.been.called;
              expect(writeFile).to.not.have.been.called;
            });
        });

        it('return error if fields option is passed but is empty', function () {
          const filePath = `${__dirname}/data/underscore_fields/module/package.json`;
          const opts = {
            fields: [],
          };
          const promise = removeNPMAbsolutePaths(filePath, opts);
          return expect(promise).to.be.rejectedWith('Invalid option: fields.\nThe fields option should be an array cotaining the names of the specific fields that should be removed.')
            .then(() => {
              expect(stat).to.not.have.been.called;
              expect(readdir).to.not.have.been.called;
              expect(readFile).to.not.have.been.called;
              expect(writeFile).to.not.have.been.called;
            });
        });

        it('rewrite only user-specified fields in package.json if fields option is passed', function () {
          const filePath = `${__dirname}/data/underscore_fields/module/package.json`;
          const opts = {
            fields: ['_inBundle', '_where'],
          };
          const promise = removeNPMAbsolutePaths(filePath, opts);
          return expect(promise).be.fulfilled
            .then((results) => {
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
  });

  describe('invalid permissions', function () {
    describe('read directory', function () {
      let stat;
      let readdir;
      let readFile;
      let writeFile;

      before(function () {
        stat = sinon.spy(fs, 'stat');
        readdir = sinon.stub(fs, 'readdir');
        readFile = sinon.spy(fs, 'readFile');
        writeFile = sinon.spy(fs, 'writeFile');
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

      it('return error if can\'t read file', function () {
        const err = new Error('Can\'t read directory.');
        readdir.yields(err);
        clearCachedModuleSoNewMocksWork();
        const dirPath = `${__dirname}/data/underscore_fields`;
        const promise = removeNPMAbsolutePaths(dirPath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
    });

    describe('read file', function () {
      let stat;
      let readdir;
      let readFile;
      let writeFile;

      before(function () {
        stat = sinon.spy(fs, 'stat');
        readdir = sinon.spy(fs, 'readdir');
        readFile = sinon.stub(fs, 'readFile');
        writeFile = sinon.stub(fs, 'writeFile');
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

      it('return error if can\'t read file', function () {
        const err = new Error('Can\'t read file.');
        readFile.yields(err);
        clearCachedModuleSoNewMocksWork();
        const filePath = `${__dirname}/data/underscore_fields/module/package.json`;
        const promise = removeNPMAbsolutePaths(filePath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
    });

    describe('write file', function () {
      let stat;
      let readdir;
      let readFile;
      let writeFile;

      before(function () {
        stat = sinon.spy(fs, 'stat');
        readdir = sinon.spy(fs, 'readdir');
        readFile = sinon.spy(fs, 'readFile');
        writeFile = sinon.stub(fs, 'writeFile');
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

      it('return error if can\'t write to file', function () {
        const err = new Error('Can\'t write to file.');
        writeFile.yields(err);
        clearCachedModuleSoNewMocksWork();
        const filePath = `${__dirname}/data/underscore_fields/module/package.json`;
        const promise = removeNPMAbsolutePaths(filePath);
        return expect(promise).be.fulfilled
          .then((results) => {
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
});
