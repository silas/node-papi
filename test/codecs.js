'use strict';

/**
 * Module dependencies.
 */

var should = require('should');

var codecs = require('../lib/codecs');

/**
 * Tests
 */

describe('codecs', function() {
  describe('text', function() {
    it('should encode', function() {
      var value = codecs.text.encode('ok');

      should(value).be.instanceof(Buffer);
      should(value.length).equal(2);
      should(value[0]).equal(111);
      should(value[1]).equal(107);
    });

    it('should decode buffer', function() {
      should(codecs.text.decode(new Buffer('ok'))).eql('ok');
    });

    it('should decode string', function() {
      should(codecs.text.decode('ok')).eql('ok');
    });
  });

  describe('json', function() {
    it('should encode', function() {
      var value = codecs.json.encode({ hello: 'world' });

      should(value).eql(new Buffer('{"hello":"world"}'));
    });

    it('should decode buffer', function() {
      var value = codecs.json.decode(new Buffer('{"hello":"world"}'));

      should(value).eql({ hello: 'world' });
    });

    it('should decode string', function() {
      var value = codecs.json.decode('{"hello":"world"}');

      should(value).eql({ hello: 'world' });
    });
  });

  describe('form', function() {
    it('should encode', function() {
      var value = codecs.form.encode({ hello: 'world' });

      should(value).eql(new Buffer('hello=world'));
    });

    it('should decode buffer', function() {
      var value = codecs.form.decode(new Buffer('hello=world'));

      should(value).eql({ hello: 'world' });
    });

    it('should decode string @test', function() {
      var value = codecs.form.decode('hello=world');

      should(value).eql({ hello: 'world' });
    });
  });
});
