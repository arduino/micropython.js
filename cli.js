const fs = require('fs')
const path = require('path')
const Board = require('./micropython.js')

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

const extractFileArray = (output) => {
    output = output.replace(/'/g, '"');
    output = output.split('OK')
    let files = output[2] || ''
    files = files.slice(0, files.indexOf(']')+1)
    files = JSON.parse(files)
    return files
}

function ensurePort(port) {
    if (!port) throw new Error('You must specify a port.')
}

const listPorts = (args) => {
    const board = new Board()
    board.listPorts()
        .then((ports) => {
            console.log('available ports', ports)
        })
}

const listFiles = (args, port) => {
    ensurePort(port)
    const board = new Board()
    board.open(port)
        .then(async () => {
            const folder = args[0] || '/'
            try {
                const output = await board.fs_ls(folder)
                const files = extractFileArray(output)
                console.log(`files at "${folder}"`, files)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const executeString = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const code = args[0] || ''
    board.open(port)
        .then(() => board.enter_raw_repl())
        .then(() => board.exec_raw({ command: code }))
        .then(async (out) => {
            await board.exit_raw_repl()
            await board.close()
            console.log(out)
        })
        .catch((err) => {
            console.log('error')
            console.log(err)
            board.exit_raw_repl(true)
            board.close()
        })
}

const executeFile = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const filename = args[0] || ''
    board.open(port)
        .then(async () => {
            try {
                const out = await board.execfile(filename)
                console.log(out)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const putFile = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const [ diskFilename, boardFilename ] = args
    board.open(port)
        .then(async () => {
            try {
                const out = await board.fs_put(diskFilename, boardFilename)
                console.log(out)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const getFile = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const [ boardFilename, diskFilename ] = args
    board.open(port)
        .then(async () => {
            try {
                let output = await board.fs_cat(boardFilename)
                fs.writeFileSync(diskFilename, output)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const removeFile = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const [ boardFilename ] = args

    board.open(port)
        .then(async () => {
            try {
                const out = await board.fs_rm(boardFilename)
                console.log(out)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const removeFolder = (args, port) => {
    ensurePort(port)
    const board = new Board()
    const [ boardDirname ] = args

    board.open(port)
        .then(async () => {
            try {
                const out = await board.fs_rmdir(boardDirname)
                console.log(out)
            } catch(e) {
                console.log('error', e)
            }
            board.close()
        })
}

const operations = {
    '--listports': listPorts,
    '--listfiles': listFiles,
    '--executestring': executeString,
    '--executefile': executeFile,
    '--putfile': putFile,
    '--getfile': getFile,
    '--removefile': removeFile,
    '--removefolder': removeFolder
}

let args = extractArguments(process.argv)
let commands = extractCommands(args)
let port = commands['--port'] ? commands['--port'][0] : null

Object.keys(commands)
    .filter((command) => command !== '--port')
    .forEach((command) => {
        operations[command](commands[command], port)
    })

