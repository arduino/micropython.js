const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  const ports = await board.list_ports()
  console.log('available ports', ports)
}

main()
