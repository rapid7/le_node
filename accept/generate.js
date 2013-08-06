
module.exports = function(log,prefix) {

  var levels = log.levels

  var levelarr = []

  for( var lev in levels ) {
    levelarr[ levels[lev] ] = lev
  }

  function entry(i) {
    if( i < 10 ) {
      var lev = levelarr[Math.floor(Math.random()*levelarr.length)]
      var datastr = prefix+i
      var obj = {
        "name": datastr,
        "booleanField": true,
        "numberField": 25,
        "nested": {
          "nested-name": "some nested name"
        },
        "array": [
          { "array-field-1": "value"},
          "test",
          2
        ]
      }
      console.log(datastr)
      log.log(lev,datastr)
      log.log(lev,obj)

      setTimeout(function(){
        entry(i+1)
      }, Math.floor(500*Math.random()))
    }
    else {
      console.log('end')
      log.end()
    }
  }
  entry(0)

}
