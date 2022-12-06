const Board = require('../micropython.js')

console.log('connect')

function extractFileArray(output) {
  output = output.replace(/'/g, '"');
  output = output.split('OK')
  let files = output[2] || ''
  files = files.slice(0, files.indexOf(']')+1)
  files = JSON.parse(files)
  return files
}

let board = new Board()
board.open(process.env.PORT || '/dev/tty.usbmodem141101')
  .then(async () => {
    try {
      let output = await board.fs_ls()
      let files = extractFileArray(output)
      console.log('files at "/"', files)
      console.log('disconnect')
    } catch(e) {
      console.log('error', e)
    }
    try {
      let output = await board.fs_ls('lib')
      let files = extractFileArray(output)
      console.log('files at "/lib"', files)
    } catch(e) {
      console.log('error', e)
    }
    board.close()
    console.log('disconnect')
  })
