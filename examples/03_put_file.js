const Board = require('../micropython.js')

let board = new Board({
  device: process.env.PORT || '/dev/tty.usbmodem141101'
})

console.log('connect')
board.open()
  .then(async () => {
    try {
      await board.fs_put('./test.py', 'test.py')
      console.log('disconnect')
    } catch(e) {
      console.log('error', e)
    }
    board.close()
  })
