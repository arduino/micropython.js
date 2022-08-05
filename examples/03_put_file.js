const Board = require('../micropython.js')

console.log('connect')
let board = new Board()
board.open(process.env.PORT || '/dev/tty.usbmodem141101')
  .then(async () => {
    try {
      await board.fs_put('./test.py', 'test.py')
      console.log('disconnect')
    } catch(e) {
      console.log('error', e)
    }
    board.close()
  })
