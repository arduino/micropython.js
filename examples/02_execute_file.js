const Board = require('../micropython.js')
const path = require('path')

async function main() {
  const board = new Board()
  await board.open(process.argv[2])
  
  const testFilePath = path.join(__dirname, 'hello.py')
  console.log('executing', testFilePath)
  const output = await board.execfile(testFilePath)
  console.log('output:')
  console.log(output)
  await board.close()
}

main()
