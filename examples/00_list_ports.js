const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  const ports = await board.listPorts()
  console.log('available ports', ports)
}

main()
