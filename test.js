const Board = require('./micropython.js')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, millis)
  })
}

async function before(port) {
  const board = new Board()
  await board.open(port)
  return Promise.resolve(board)
}

async function after(board) {
  await board.close()
  return Promise.resolve()
}

const testCases = {
  "get prompt": async (board) => {
    // From unknown state
    let output = await board.get_prompt()
    assert.notEqual(output.indexOf('>>>'), -1)
    // From raw repl
    await board.enter_raw_repl()
    output = await board.get_prompt()
    assert.notEqual(output.indexOf('>>>'), -1)
    // Running code
    board.run(`from time import sleep\nwhile True:\n  print('.')\nsleep(1)\n`)
      .catch(() => null)
    output = await board.get_prompt()
    assert.notEqual(output.indexOf('>>>'), -1)

    return Promise.resolve()
  },
  "real time repl": async (board) => {
    let output = ''
    const fn = async () =>  {
      let o = await board.serial.read()
      output += o.toString()
    }
    board.serial.on('readable', fn)
    await board.eval('pri')
    await sleep(10)
    await board.eval('nt(1')
    await sleep(10)
    await board.eval('23)')
    await board.eval('\r')
    await sleep(10)
    board.serial.removeListener('readable', fn)
    assert(output, 'print(123)\r\n123\r\n>>> ')
    return Promise.resolve()
  },
  "enter raw repl": async (board) => {
    let output = await board.enter_raw_repl()
    assert.notEqual(output.indexOf('raw REPL; CTRL-B to exit'), -1)
    // reenter raw repl
    output = await board.enter_raw_repl()
    assert.notEqual(output.indexOf('raw REPL; CTRL-B to exit'), -1)

    return Promise.resolve()
  },
  "exit raw repl": async (board) => {
    let output = await board.exit_raw_repl()
    assert.notEqual(output.indexOf('>>>'), -1)

    await board.enter_raw_repl()
    output = await board.exit_raw_repl()
    assert.notEqual(output.indexOf('>>>'), -1)

    return Promise.resolve()
  },
  "execute raw small": async (board) => {
    await board.enter_raw_repl()
    const output = await board.exec_raw('print(123)')
    await board.exit_raw_repl()
    assert.equal(output, 'OK123\r\n\x04\x04>')
    return Promise.resolve()
  },
  "execute raw big": async (board) => {
    let bigFile = fs.readFileSync('./examples/big_file.py')
    await board.enter_raw_repl()
    const output = await board.exec_raw(bigFile.toString())
    assert.equal(output, 'OK\x04\x04>')
    await board.exit_raw_repl()
    return Promise.resolve()
  },
  "run small code": async (board) => {
    const output = await board.run('print(123)')
    assert.equal(output, 'OK123\r\n\x04\x04>')
    return Promise.resolve()
  },
  "run big code": async (board) => {
    let bigFile = fs.readFileSync('./examples/big_file.py')
    const output = await board.run(bigFile.toString())
    assert.equal(output, 'OK\x04\x04>')
    return Promise.resolve()
  },
  "run code after stop": async (board) => {
    debugger
    board.run(
      `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(1)\n`
    ).catch(e => {
      // console.log('stopped')
    })
    await (new Promise((r) => setTimeout(r, 100)))
    await board.stop()
    await (new Promise((r) => setTimeout(r, 100)))
    await board.get_prompt()
    const output = await board.run('print(123)')
    assert.equal(output, 'OK123\r\n\x04\x04>')

  },
  "run code after run": async (board) => {
    board.run(
      `from time import sleep\nfor i in range(0, 10):\n  print('.')\n  sleep(1)\n`,
      // (o) => console.log('board run outputs', o)
    ).catch(e => {
      // console.log('stopped')
    })
    await board.get_prompt()
    const output = await board.run('print(123)')
    assert.equal(output, 'OK123\r\n\x04\x04>')

  },
  "upload file": async (board) => {
    const diskFilePath = path.resolve('./examples/test.py')
    const serialFilePath = '/test.py'
    await board.fs_put(diskFilePath, serialFilePath)
    const diskFileContent = fs.readFileSync(diskFilePath)
    const boardFileContent = await board.fs_cat(serialFilePath)
    assert.equal(diskFileContent.toString(), boardFileContent)
    await board.fs_rm(serialFilePath)
  },
  "upload big file": async (board) => {
    const diskFilePath = path.resolve('./examples/big_file.py')
    const serialFilePath = '/big_file.py'
    await board.fs_put(
      diskFilePath, serialFilePath,
      (e) => console.log('uploading big file', e)
    )
    const diskFileContent = fs.readFileSync(diskFilePath)
    const boardFileContent = await board.fs_cat(serialFilePath)
    assert.equal(diskFileContent.toString(), boardFileContent)
    await board.fs_rm(serialFilePath)
  },
  "create folder": async (board) => {
    const folderPath = '/test_folder'
    await board.fs_mkdir(folderPath)
    const ls = await board.fs_ils('/')
    const folder = ls.find(f => f[0] === 'test_folder' && f[1] === 16384)
    assert.ok(folder)
    await board.fs_rmdir(folderPath)
  },
  "list files and folders": async (board) => {
    const file = [ 'test.py', 32768 ]
    const test_folder = 'test_folder'
    await board.fs_put(path.resolve('examples', file[0]), '/'+file[0])
    await board.fs_mkdir('/'+test_folder)
    const ls = await board.fs_ils('/')
    const createdFile = ls.find(f => f[0] === file[0] && f[1] === file[1])
    const createdFolder = ls.find(f => f[0] === test_folder && f[1] === 16384)
    assert.ok(createdFile)
    assert.ok(createdFolder)
  },
  "check if file exists": async (board) => {
    const filePath = '/test_exist'+parseInt(Math.random()*99999)
    await board.fs_save('.', filePath)
    const fileExists = await board.fs_exists(filePath)
    assert(fileExists)
    const fileDoesNotExist = await board.fs_exists('/xxx'+parseInt(Math.random()*99999))
    assert.ok(!fileDoesNotExist)
    await board.fs_rm(filePath)
  },
  "save file content": async (board) => {
      const filePath = '/test.py'
      const content = `.`
      await board.fs_save(content, filePath)
      const boardContent = await board.fs_cat(filePath)
      assert.equal(content, boardContent)
  },
  "save big file content": async (board) => {
    const filePath = '/test.py'
    const content = fs.readFileSync(path.resolve('./examples/big_file.py'))
    await board.fs_save(content.toString(), filePath)
    const boardContent = await board.fs_cat(filePath)
    assert.equal(content, boardContent)
  },
  "get file": async (board) => {
    const filePath = '/test.py'
    const content = `.`
    await board.fs_save(content, filePath)
    const boardContent = await board.fs_cat(filePath)
    assert.equal(content, boardContent)
  },
  "remove file": async (board) => {
    const filePath = '/test_remove'+parseInt(Math.random()*99999)
    await board.fs_save('.', filePath)
    const fileExists = await board.fs_exists(filePath)
    assert(fileExists)
    await board.fs_rm(filePath)
    const fileDoesNotExist = await board.fs_exists(filePath)
    assert.ok(!fileDoesNotExist)
  },
  "remove folder": async (board) => {
    const folderPath = '/test_remove'+parseInt(Math.random()*99999)
    await board.fs_mkdir(folderPath)
    const ls = await board.fs_ils('/')
    const foundFolder = ls.find(f => f[0] === folderPath.slice(1) && f[1] === 16384)
    assert.ok(foundFolder)
    await board.fs_rmdir(folderPath)
    const notFoundFolder = ls.find(f => f[0] === folderPath.slice(1) && f[1] === 16384)
    assert.ok(!notFoundFolder)
  },
  // "foo": async (board) => Promise.reject()
}

// SKIP LONG RUNNERS
delete testCases['execute raw big']
delete testCases['run big code']
delete testCases['upload big file']
delete testCases['save big file content']

async function main() {
  let errors = []
  const board = new Board()
  let ports = await board.list_ports()
  ports = ports.filter(p => p.vendorId && p.productId).map(p => p.path)
  for (port of ports) {
    console.log('')
    console.log('🔊 Running test for', port)
    for (const [name, test] of Object.entries(testCases)) {
      console.log('>', name)
      const board = await before(port)
      try {
        const result = await test(board)
        console.log("🟩 success")
      } catch(e) {
        console.log('💔 error', e)
        errors.push([port, name])
      }
      await after(board)
    }
  }
  console.log('')
  console.log('Errors:', errors.length)
  if (errors.length > 0) {
    for (const [port, name] of errors) {
      console.log(name, 'failed on', port)
    }
  }
}

main()
