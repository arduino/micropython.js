const Board = require('../micropython.js')
const path = require('path')

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  console.log('sending file to board')
  await board.fs_put(path.join(__dirname, 'hello.py'), 'test_hello.py', console.log)
  console.log('done')
  await board.close()
}

main()
