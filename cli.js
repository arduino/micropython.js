const fs = require('fs')
const path = require('path')
const Board = require('./micropython.js')

const log = console.log

const extractArguments = (args) => {
  return args.slice(2)
}

const extractCommands = (args) => {
  let commands = {}
  let currentCommand = null
  // TODO: Use reduce instead of forEach
  args.forEach((value) => {
    // If it's a command, turn set is as the current one
    if (value.slice(0, 2) === '--') {
      currentCommand = value
    }
    // If there isn't a key initialized for that command, do so
    if (!commands[currentCommand]) {
      commands[currentCommand] = []
    } else {
      // Otherwise push the values to the current command key
      commands[currentCommand].push(value)
    }
  })
  return commands
}

function ensurePort(port) {
  if (!port) throw new Error('You must specify a port.')
}

const listPorts = (args) => {
  const board = new Board()
  return board.list_ports()
  .then((ports) => {
    const boards = ports.filter(p => p.vendorId && p.productId)
    log('available ports', boards)
    return Promise.resolve()
  })
}

const listFiles = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    const folder = args[0] || '/'
    try {
      const output = await board.fs_ls(folder)
      log(`files at "${folder}"`, output)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const ilistFiles = (args, port) => {
  ensurePort(port)
  const board = new Board()
  return board.open(port)
  .then(async () => {
    const folder = args[0] || '/'
    try {
      const output = await board.fs_ils(folder)
      log(`files at "${folder}"`, output)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const executeString = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const code = args[0] || ''
  return board.open(port)
  .then(() => board.enter_raw_repl())
  .then(() => board.exec_raw({ command: code, data_consumer: dataConsumer }))
  .then(async (out) => {
    await board.exit_raw_repl()
    await board.close()
    log(out)
    return Promise.resolve()
  })
  .catch((err) => {
    log('error', err)
    board.exit_raw_repl(true)
    board.close()
  })
}

const executeFile = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const filename = args[0] || ''
  const consumer = dataConsumer || function() {}
  return board.open(port)
  .then(async () => {
    try {
      const out = await board.execfile(filename, consumer)
      log(out)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const putFile = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const [ diskFilename, boardFilename ] = args
  const consumer = dataConsumer || function() {}
  return board.open(port)
  .then(async () => {
    try {
      const out = await board.fs_put(diskFilename, boardFilename, consumer)
      log(out)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const getFile = (args, port, dataConsumer) => {
  ensurePort(port)
  const board = new Board()
  const [ boardFilename, diskFilename ] = args
  const consumer = dataConsumer || function() {}
  return board.open(port)
  .then(async () => {
    try {
      let output = await board.fs_cat(boardFilename, consumer)
      fs.writeFileSync(diskFilename, output)
      log('output')
      log(output)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const removeFile = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardFilename ] = args

  return board.open(port)
  .then(async () => {
    try {
      const out = await board.fs_rm(boardFilename)
      log(out)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const removeFolder = (args, port) => {
  ensurePort(port)
  const board = new Board()
  const [ boardDirname ] = args

  return board.open(port)
  .then(async () => {
    try {
      const out = await board.fs_rmdir(boardDirname)
      log(out)
    } catch(e) {
      log('error', e)
    }
    board.close()
    return Promise.resolve()
  })
}

const operations = {
  '--listports': listPorts,
  '--listfiles': listFiles,
  '--ilistfiles': ilistFiles,
  '--executestring': executeString,
  '--executefile': executeFile,
  '--putfile': putFile,
  '--getfile': getFile,
  '--removefile': removeFile,
  '--removefolder': removeFolder,
  '--verbose': () => false,
  '--help': () => console.log(Object.keys(operations))
}

let args = extractArguments(process.argv)
let commands = extractCommands(args)
let port = commands['--port'] ? commands['--port'][0] : null

if (commands['--verbose']) {
  log('VERBOSE')
  Object.keys(commands)
  .filter((command) => command !== '--port')
  .filter((command) => command !== '--verbose')
  .forEach((command) => {
    log('executing command:')
    log('command', command)
    log('arguments', commands[command])
    log('port', port)
    operations[command](commands[command], port, log)
    .then(() => log('command executed', command, `\r\n`))
    .catch((e) => log('error', e, `\r\n`))
  })
} else {
  Object.keys(commands)
  .filter((command) => command !== '--port')
  .forEach((command) => {
    operations[command](commands[command], port)
  })
}
