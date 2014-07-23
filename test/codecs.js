'use strict';

/**
 * Module dependencies.
 */

require('should');

var codecs = require('../lib/codecs');

/**
 * Tests
 */

describe('codecs', function() {
  describe('text', function() {
    it('should encode', function() {
      var value = codecs.text.encode('ok');

      value.should.be.instanceof(Buffer);
      value.length.should.equal(2);
      value[0].should.equal(111);
      value[1].should.equal(107);
    });

    it('should decode buffer', function() {
      codecs.text.decode(new Buffer('ok')).should.eql('ok');
    });

    it('should decode string', function() {
      codecs.text.decode('ok').should.eql('ok');
    });
  });

  describe('json', function() {
    it('should encode', function() {
      var value = codecs.json.encode({ hello: 'world' });

      value.should.eql(new Buffer('{"hello":"world"}'));
    });

    it('should decode buffer', function() {
      var value = codecs.json.decode(new Buffer('{"hello":"world"}'));

      value.should.eql({ hello: 'world' });
    });

    it('should decode string', function() {
      var value = codecs.json.decode('{"hello":"world"}');

      value.should.eql({ hello: 'world' });
    });
  });

  describe('form', function() {
    it('should encode', function() {
      var value = codecs.form.encode({ hello: 'world' });

      value.should.eql(new Buffer('hello=world'));
    });

    it('should decode buffer', function() {
      var value = codecs.form.decode(new Buffer('hello=world'));

      value.should.eql({ hello: 'world' });
    });

    it('should decode string', function() {
      var value = codecs.form.decode('hello=world');

      value.should.eql({ hello: 'world' });
    });
  });
});
