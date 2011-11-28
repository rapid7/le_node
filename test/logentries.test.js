
var logentries = require('../lib/logentries')


var assert = require('assert')


function arreq( from, a, b ) {
  if( a.length != b.length ) return false;

  for( var i = from; i < a.length; i++ ) {
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
      
      // Is options.timestamp === true?
      if ( entry.length > 2 ) {
        check.unshift('date')
      }
      
      //console.log(check,entry)
      assert.ok( arreq(1,check,entry) )
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
      check.unshift('date')

      assert.ok( arreq(1,check,entry) )
      index++
    }
  }

  function connect() {
    setTimeout(function(){
      //console.log('reconnect,q.len='+queue.length)
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


function EventingTransport() {
  var self = this


  var queue = null

  self.queue = function( q ) {
    queue = q
  }

  self.consume = function() {
    while( 0 < queue.length ) {
      var entry = queue.shift()

      self.logger.emit('log',entry.join(' '))
    }
  }

  self.end = function() {
    self.logger.emit('end')
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
      ['err','t4'],
      ['crit','t5'],
      ['alert','t6'],
      ['emerg','t7']
    ])})

    log.level('err')

    log.debug('t0')
    log.info('t1')
    log.notice('t2')
    log.warning('t3')
    log.err('t4')
    log.crit('t5')
    log.alert('t6')
    log.emerg('t7')
    t.ok()

    try {
      log.level('bogus')
      assert.fail()
    }
    catch(e) {
      assert.equal("unknown log level: bogus",e.message)
    }
    
    log2 = logentries.logger({
      timestamp: false,
      transport:t=new SimpleTestTransport([['info','t1']
    ])})
    
    log2.info('t1')
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
  },

  
  vartypes: function() {
    var t = null
    var d = new Date()

    var log = logentries.logger({transport:t=new SimpleTestTransport([
      ['info','true'],
      ['info','11'],
      ['info','str'],
      ['info',d.toISOString()],
      ['info','function (){return "fn"}'],
      ['info','{"a":"1","b":"2"}'],
      ['info','["a","b"]'],
    ])})

    log.info(true)
    log.info(11)
    log.info("str")
    log.info(d)
    log.info(function(){return "fn"})
    log.info({a:'1',b:'2'})
    log.info(['a','b'])

    t.ok()
  },

  events: function() {
    var t = null
    var d = new Date()

    var errors   = []
    var loglines = []

    var log = logentries.logger({transport:t=new EventingTransport()})
    t.logger = log
   
    log.on('error',function(err) {
      errors.push(err)
    })

    log.on('log',function(logline) {
      loglines.push(logline)
    })

    log.on('end',function() {
      loglines.push('end')
    })


    log.emit('error','drill')
 
    log.debug('t0')
    log.info('t1')
    log.warning('t2')

    log.end()

    assert.equal(1,errors.length)
    assert.equal('drill',errors[0])

    assert.equal(4,loglines.length)
    assert.ok( /debug t0$/.test(loglines[0]) )
    assert.ok( /info t1$/.test(loglines[1]) )
    assert.ok( /warning t2$/.test(loglines[2]) )
    assert.equal('end',loglines[3])
  }

}