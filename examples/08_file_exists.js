const Board = require('../micropython.js')

console.log('connect')
let board = new Board()
board.open(process.env.PORT || '/dev/tty.usbmodem141101')
  .then(async () => {
    try {
      // Check for boot.py (probably exists)
      let output = await board.fs_exists('boot.py')
      if (output) {
        console.log('boot.py exists')
      } else {
        console.log('boot.py does not exists')
      }

      // Check for xxx (probably won't exist)
      output = await board.fs_exists('xxx')
      if (output) {
        console.log('xxx exists')
      } else {
        console.log('xxx does not exists')
      }
    } catch(e) {
      console.log('error', e)
    }
    board.close()
    console.log('disconnect')
  })
