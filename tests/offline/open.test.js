// Offline tests for open() and exec_raw() timeouts — no board required.
// A scripted fake stands in for the `serialport` module.
//
//   node --test tests/offline/

const test = require('node:test')
const assert = require('node:assert/strict')
const EventEmitter = require('node:events')
const Module = require('node:module')

// What the fake board answers, keyed by the bytes written to it.
let script = {}

const healthyBoard = {
  '\x01': (port) => port.reply('raw REPL; CTRL-B to exit\r\n>'),
  '\x04': (port) => port.reply('OK/\r\n\x04\x04>'),
  '\x02': (port) => port.reply('\r\n>>>'),
}

class FakeSerialPort extends EventEmitter {
  constructor(options) {
    super()
    this.path = options.path
    this.isOpen = false
    this._paused = true
    FakeSerialPort.last = this
  }
  open(cb) {
    setImmediate(() => {
      this.isOpen = true
      cb(null)
    })
  }
  close(cb) {
    this.isOpen = false
    setImmediate(() => {
      this.emit('close')
      cb(null)
    })
  }
  pause() { this._paused = true }
  resume() { this._paused = false }
  isPaused() { return this._paused }
  write(buffer) {
    const handler = script[buffer.toString()]
    if (handler) handler(this)
    return true
  }
  drain(cb) { cb() }
  flush() {}
  // Replies arrive after the write has finished, as they do from a real board
  reply(text, delay = 40) {
    setTimeout(() => this.emit('data', Buffer.from(text)), delay)
  }
  // The port disappears without the library having asked for it
  drop(delay = 40) {
    setTimeout(() => {
      this.isOpen = false
      this.emit('close')
    }, delay)
  }
}

const realLoad = Module._load
Module._load = function (request, ...rest) {
  if (request === 'serialport') return { SerialPort: FakeSerialPort }
  return realLoad.call(this, request, ...rest)
}
const Board = require('../../micropython.js')
Module._load = realLoad
const { MicroPythonError } = Board

// A hung open() would otherwise only show up as the test runner timing out
const TEST_TIMEOUT = { timeout: 5000 }

function newBoard(t) {
  const board = new Board()
  t.after(() => board.close().catch(() => {}))
  return board
}

test('open() resolves with a board that answers the handshake', TEST_TIMEOUT, async (t) => {
  script = healthyBoard
  const board = newBoard(t)

  await board.open('FAKE')

  assert.equal(board.serial.isOpen, true)
  assert.equal(board._fsRoot, '/')
})

test('open() rejects instead of hanging when the port drops during the handshake', TEST_TIMEOUT, async (t) => {
  script = { ...healthyBoard, '\x01': (port) => port.drop() }
  const board = newBoard(t)

  await assert.rejects(board.open('FAKE'), (err) => {
    assert.equal(err.code, MicroPythonError.DISCONNECTED)
    return true
  })
})

test('open() rejects instead of hanging when the port reports an error during the handshake', TEST_TIMEOUT, async (t) => {
  script = {
    ...healthyBoard,
    '\x01': (port) => setTimeout(() => port.emit('error', new Error('boom')), 40),
  }
  const board = newBoard(t)

  await assert.rejects(board.open('FAKE'), (err) => {
    assert.equal(err.code, MicroPythonError.PORT_ERROR)
    assert.equal(err.message, 'boom')
    return true
  })
})

test('open() closes the port and resets cached state when the handshake fails', TEST_TIMEOUT, async (t) => {
  script = {
    ...healthyBoard,
    '\x01': (port) => setTimeout(() => port.emit('error', new Error('boom')), 40),
  }
  const board = newBoard(t)

  await assert.rejects(board.open('FAKE'))

  assert.equal(FakeSerialPort.last.isOpen, false)
  assert.equal(board._fsRoot, null)
  assert.equal(board._hasUbinascii, null)
})

test('open() can be retried on the same instance after a failed attempt', TEST_TIMEOUT, async (t) => {
  script = { ...healthyBoard, '\x01': (port) => port.drop() }
  const board = newBoard(t)
  await assert.rejects(board.open('FAKE'))

  script = healthyBoard
  await board.open('FAKE')

  assert.equal(board.serial.isOpen, true)
})

test('exec_raw() rejects with TIMEOUT when the board stays silent for longer than the given timeout', TEST_TIMEOUT, async (t) => {
  script = {}
  const board = newBoard(t)
  board.serial = new FakeSerialPort({ path: 'FAKE' })
  board.serial.isOpen = true

  await assert.rejects(board.exec_raw('x = 1', null, false, 50), (err) => {
    assert.equal(err.code, MicroPythonError.TIMEOUT)
    return true
  })
})

test('exec_raw() without a timeout still follows execTimeout (unbounded by default, as run() needs)', TEST_TIMEOUT, async (t) => {
  const board = newBoard(t)
  const timeouts = []
  board.write_and_read_until = async (cmd, expect, consumer, timeout) => {
    if (expect) timeouts.push(timeout)
    return 'OK\x04\x04>'
  }

  await board.exec_raw('x = 1')
  board.execTimeout = 1234
  await board.exec_raw('x = 1')

  assert.deepEqual(timeouts, [null, 1234])
})

test('the filesystem root query done by open() is bounded', TEST_TIMEOUT, async (t) => {
  const board = newBoard(t)
  let timeout
  board.exec_raw = async (cmd, consumer, passThrough, ms) => {
    timeout = ms
    return 'OK/\r\n\x04\x04>'
  }

  await board._getRoot()

  assert.ok(Number.isFinite(timeout) && timeout > 0, `expected a timeout, got ${timeout}`)
})
