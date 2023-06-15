const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.env.PORT)
  console.log('sending file to board')
  await board.fs_put('./big_file.py', 'test.py', console.log)
  console.log('done')
  board.close()
}

main()
