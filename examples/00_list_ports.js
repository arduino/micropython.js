const Board = require('../micropython.js')

let board = new Board()

board.listPorts()
  .then((ports) => {
    console.log('available ports', ports)
  })
