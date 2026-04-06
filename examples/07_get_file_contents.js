const Board = require('../micropython.js')

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  const output = await board.fs_cat('saved_example.py')
  console.log('file contents:')
  console.log(output)
  await board.close()
}

main()
