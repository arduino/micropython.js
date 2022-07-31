const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
const fs = require('fs')
const path = require('path')

function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, millis)
  })
}

class MicroPythonBoard {
  constructor(options) {
    const { device, autoOpen = false } = options || {}
    this.device = device || {}
    this.in_raw_repl = false
    this.use_raw_paste = true

    if (autoOpen) {
      this.open()
    }

  }

	async listPorts() {
		return await SerialPort.list()
	}

  open() {
		this.serial = new SerialPort({
      path: this.device,
			baudRate: 115200,
      lock: false,
			autoOpen: false
		})
    return new Promise((resolve, reject) => {
      this.serial.open((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  close() {
    if (this.serial.isOpen) {
      return this.serial.close()
    } else {
      return Promise.resolve()
    }
  }

  read_until(options) {
    const {
      ending = `\n`,
      timeout = null,
      data_consumer = () => false
    } = options || {}
    return new Promise((resolve, reject) => {
      const parser = this.serial.pipe(new ReadlineParser({ delimiter: ending }))
      let waiting = 0
      if (timeout) {
        waiting = setTimeout(() => {
          reject(new Error(`Couldn't find ending: ${ending}`))
        }, timeout)
      }
      parser.once('data', (data) => {
        data_consumer(data)
        clearTimeout(waiting)
        resolve(data + ending)
      })
    })
  }

  enter_raw_repl(timeout) {
    return new Promise(async (resolve, reject) => {
      // ctrl-C twice: interrupt any running program
      await this.serial.write(Buffer.from(`\r\x03\x03`))
      // flush input
      await this.serial.flush()
      // ctrl-A: enter raw REPL
      await this.serial.write(Buffer.from(`\r\x01`))

      let data = await this.read_until({
        ending: Buffer.from(`raw REPL; CTRL-B to exit\r\n>`),
        timeout: timeout
      })

      if (data.indexOf(`raw REPL; CTRL-B to exit\r\n>`) !== -1) {
        this.in_raw_repl = true
        return resolve()
      } else {
        return reject(new Error(`Couldn't enter raw REPL mode`))
      }
    })
  }

  async exit_raw_repl() {
    if (this.in_raw_repl) {
      // ctrl-B: enter friendly REPL
      await this.serial.write(Buffer.from(`\r\x02`))
      this.in_raw_repl = false
    }
    return Promise.resolve()
  }

  follow(options) {
    const { timeout = null, data_consumer = false } = options || {}
    return new Promise(async (resolve, reject) => {
      // wait for normal output
      const data = await this.read_until({
        ending: Buffer.from(`\x04`),
        timeout: timeout
      })
      // TODO: Slice out the EOF
      // console.log('normal output:', data)
      resolve(data)

      // // wait for error output
      // const data_err = await this.read_until({
      //   ending: Buffer.from(`\x04`),
      //   timeout: timeout
      // })
      // // TODO: Slice out the EOF
      // console.log('error output:', data_err)
      //
      // resolve([data, data_err])
    })
  }

  // SKIPPING THIS FOR NOW
  // raw_paste_write() {
  //   // Only used if `use_raw_paste` is true
  // }

  exec_raw_no_follow(options) {
    const { timeout = null, command = '' } = options || {}
    return new Promise(async (resolve, reject) => {
      // Dismiss any data with ctrl-C
      await this.serial.write(Buffer.from(`\x03`))
      // Soft reboot
      await this.serial.write(Buffer.from(`\x04`))
      // Check if we have a prompt
      const data = await this.read_until({
        ending: Buffer.from(`>`),
        timeout: timeout,
      })

      // Write command using standard raw REPL, 256 bytes every 10ms.
      for (let i = 0; i < command.length; i += 256) {
        const slice = Buffer.from(command.slice(i, i+256))
        await this.serial.write(slice)
        await sleep(10)
      }
      // Execute
      await this.serial.write(Buffer.from(`\x04`))
      resolve()
    })

  }

  exec_raw(options) {
    const { timeout = null, command = '' } = options || {}
    this.exec_raw_no_follow({
      timeout: timeout,
      command: command
    })
    return this.follow({ timeout })
  }

  async eval(k) {
    return await this.serial.write(Buffer.from(k))
  }

  async stop() {
    // Dismiss any data with ctrl-C
    await this.serial.write(Buffer.from(`\x03`))
  }

  async reset() {
    // Dismiss any data with ctrl-C
    await this.serial.write(Buffer.from(`\x03`))
    // Soft reboot
    await this.serial.write(Buffer.from(`\x04`))
  }

  async execfile(filePath) {
    if (filePath) {
      const content = fs.readFileSync(path.resolve(filePath))
      await this.enter_raw_repl()
      const output = await this.exec_raw({ command: content })
      console.log(output)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_ls() {
    await this.enter_raw_repl()
    const output = await this.exec_raw({
      command: `import uos\nprint(uos.listdir())`
    })
    console.log(output)
    return this.exit_raw_repl()
  }

  async fs_cat(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `with open('${filePath}') as f:\n while 1:\n  b=f.read(256)\n  if not b:break\n  print(b,end='')`
      })
      console.log(output)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  // TODO: When implementing command line
  // fs_get() {
  //
  // }

  async fs_put(src, dest) {
    if (src) {
      const content = fs.readFileSync(path.resolve(src))
      await this.enter_raw_repl()
      let output = await this.exec_raw({
        command: `f=open('${dest}','w')\nw=f.write`
      })
      for (let i = 0; i < content.length; i+=64) {
        let slice = content.slice(i, i+64)
        slice =  slice.toString()
        slice = slice.replace(/"""/g, `\\"\\"\\"`)
        await this.serial.write(`w("""${slice}""")`)
        await this.serial.write(`\x04`)
        await sleep(50)
      }
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_mkdir() {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `import uos\nuos.mkdir('${filePath}')`
      })
      console.log(output)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_rmdir() {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `import uos\nuos.rmdir('${filePath}')`
      })
      console.log(output)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_rm(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `import uos\nuos.remove('${filePath}')`
      })
      console.log(output)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }
}

module.exports = MicroPythonBoard
