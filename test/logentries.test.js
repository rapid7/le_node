
var logentries = require('../lib/logentries')


var assert = require('assert')


function arreq( a, b ) {
  if( a.length != b.length ) return false;

  for( var i = 0; i < a.length; i++ ) {
    if( ''+a[i] != ''+b[i] ) return false;
  }

  return true;
}


function SimpleTestTransport( expect ) {
  var self = this

  var index = 0
  var queue = null

  self.queue = function( q ) {
    queue = q
  }

  self.consume = function() {
    while( 0 < queue.length ) {
      var entry = queue.shift()
      var check = expect[index]
      //console.log(check,entry)
      assert.ok( arreq(check,entry) )
      index++
    }
  }

  self.ok = function() {
    assert.equal( expect.length, index )
  }

}


function ConnectingTestTransport( expect ) {
  var self = this

  var index = 0
  var queue = null

  var connected = false

  function process() {
    while( 0 < queue.length ) {

      if( Math.random() < 0.2 ) {
        connected = false
        return
      }

      var entry = queue.shift()
      var check = expect[index]
      assert.ok( arreq(check,entry) )
      index++
    }
  }

  function connect() {
    setTimeout(function(){
      console.log('reconnect,q.len='+queue.length)
      process()
    },500*Math.random())
  }


  self.queue = function( q ) {
    queue = q
  }

  self.consume = function() {
    if( connected ) {
      process()
    }
    else {
      connect()
    }
  }

  self.ok = function() {
    assert.equal( expect.length, index )
  }
}


module.exports = {

  levels: function() {
    var t = null

    var log = logentries.logger({transport:t=new SimpleTestTransport([
      ['info','t1']
    ])})

    log.info('t1')
    t.ok()

    log = logentries.logger({levels:{foo:0,bar:1},transport:t=new SimpleTestTransport([
      ['foo','t1'],
      ['bar','t2']
    ])})

    log.foo('t1')
    log.bar('t2')
    
    assert.ok( !log.info )
    t.ok()

    var log = logentries.logger({transport:t=new SimpleTestTransport([
      ['err','t1'],
      ['crit','t2'],
      ['alert','t3'],
      ['emerg','t4']
    ])})

    log.level('err')

    log.err('t1')
    log.crit('t2')
    log.alert('t3')
    log.emerg('t4')
    t.ok()
  },

  connecting: function() {
    var t = null

    var expect = []
    for( var i = 0; i < 111; i++ ) {
      expect.push(['info','t'+i])
    }
    
    var log = logentries.logger({transport:t=new ConnectingTestTransport( expect )})
    
    function logit(i) {
      if( i < expect.length ) {
        log.info(expect[i][1] )
        setTimeout(function(){
          logit(i+1)
        },50*Math.random())
      }
      else {
        setTimeout(function(){t.ok()},600)
      }
    }
    logit(0)

  }


}