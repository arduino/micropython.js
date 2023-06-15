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

function fixLineBreak(str) {
  // All line breaks must be converted to \n
  // https://stackoverflow.com/questions/4025760/python-file-write-creating-extra-carriage-return
  return str.replace(/\r\n/g, '\n')
}

class MicroPythonBoard {
  constructor() {
    this.device = null
    this.serial = null
    this.in_raw_repl = false
    this.chunk_size = 200
    this.chunk_sleep = 100
  }

  listPorts() {
    return SerialPort.list()
  }

  list_ports() { // backward compatibility
    return this.listPorts()
  }

  write_and_drain(data) {
    // https://serialport.io/docs/api-stream#drain-example
    return new Promise((resolve, reject) => {
      this.serial.write(data)
      this.serial.drain((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  async open(device) {
    if (device) {
      this.device = device
    } else {
      return Promise.reject(
        new Error(`No device specified`)
      )
    }
    if (this.serial && this.serial.isOpen) {
      await this.serial.close()
      this.serial = null
    }

    this.serial = new SerialPort({
      path: this.device,
			baudRate: 115200,
      lock: false,
			autoOpen: false
		})

    return new Promise((resolve, reject) => {
      this.serial.open(async (err) => {
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
    const parser = this.serial.pipe(
      new ReadlineParser({ delimiter: ending })
    )
    return new Promise((resolve, reject) => {
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
        ending: Buffer.from(`raw REPL; CTRL-B to exit\r\n`),
        timeout: timeout
      })

      if (data.indexOf(`raw REPL; CTRL-B to exit\r\n`) !== -1) {
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
    const { timeout = null } = options || {}
    return new Promise(async (resolve, reject) => {
      // wait for normal output
      const data = await this.read_until({
        ending: Buffer.from(`\x04`),
        timeout: timeout
      })
      resolve(data)
    })
  }

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
    const {
      timeout = null,
      command = '',
      data_consumer = () => false
    } = options || {}
    this.exec_raw_no_follow({
      timeout: timeout,
      command: command,
      data_consumer: data_consumer
    })
    return this.follow({ timeout })
  }

  async eval(k) {
    return this.serial.write(Buffer.from(k))
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

  async execfile(filePath, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (filePath) {
      const content = fs.readFileSync(path.resolve(filePath))
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: content
      })
      data_consumer(output)
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_exists(filePath) {
    filePath = filePath || ''
    let command = `try:\n`
        command += `  f = open("${filePath}", "r")\n`
        command += `  print(1)\n`
        command += `except OSError:\n`
        command += `  print(0)\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw({ command: command })
    await this.exit_raw_repl()
    // Extract output
    output = output.split('OK')
    let result = output[2] || ''
    return Promise.resolve(result[0] === '1')
  }

  async fs_ls(folderPath) {
    folderPath = folderPath || ''
    let command = `import uos\n`
        command += `try:\n`
        command += `  print(uos.listdir("${folderPath}"))\n`
        command += `except OSError:\n`
        command += `  print([])\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw({ command: command })
    await this.exit_raw_repl()
    // Convert text output to js array
    output = output.replace(/'/g, '"')
    output = output.split('OK')
    let files = output[2] || ''
    files = files.slice(0, files.indexOf(']')+1)
    files = JSON.parse(files)
    return Promise.resolve(files)
  }

  async fs_ils(folderPath) {
    folderPath = folderPath || ''
    folderPath = folderPath || ''
    let command = `import uos\n`
        command += `try:\n`
        command += `  l=[]\n`
        command += `  for file in uos.ilistdir("${folderPath}"):\n`
        command += `    l.append(list(file))\n`
        command += `  print(l)\n`
        command += `except OSError:\n`
        command += `  print([])\n`
    await this.enter_raw_repl()
    let output = await this.exec_raw({ command: command })
    await this.exit_raw_repl()
    // Convert text output to js array
    output = output.replace(/'/g, '"')
    output = output.split('OK')
    let files = output[2] || ''
    files = files.slice(0, files.length-1)
    files = JSON.parse(files)
    return Promise.resolve(files)
  }

  async fs_cat(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `with open('${filePath}','r') as f:\n while 1:\n  b=f.read(256)\n  if not b:break\n  print(b,end='')`
      })
      await this.exit_raw_repl()
      const outputArray = output.split('raw REPL; CTRL-B to exit\r\n>OK')
      const content = outputArray[1].slice(0, -1)
      return Promise.resolve(content)
    }
    return Promise.reject(new Error(`Path to file was not specified`))
  }

  async fs_put(src, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (src && dest) {
      const contentBuffer = fs.readFileSync(path.resolve(src))
      await this.enter_raw_repl()
      let output = await this.exec_raw({
        command: `f=open('${dest}','w')\nw=f.write`
      })
      await sleep(100)
      let contentString = contentBuffer.toString()
      contentString = fixLineBreak(contentString)
      const hexArray = contentString.split('').map(
        c => c.charCodeAt(0).toString(16).padStart(2, '0')
      )
      const chunkSize = this.chunk_size
      for (let i = 0; i < hexArray.length; i+= chunkSize) {
        let slice = hexArray.slice(i, i+chunkSize)
        let bytes = slice.map(h => `0x${h}`)
        let line = `w(bytes([${bytes.join(',')}]))\x04`
        data_consumer( parseInt((i / hexArray.length) * 100) + '%')
        await this.write_and_drain(line)
        await sleep(this.chunk_sleep)
      }
      return this.exit_raw_repl()
    }
    return Promise.reject(new Error(`Must specify source and destination paths`))
  }

  async fs_save(content, dest, data_consumer) {
    data_consumer = data_consumer || function() {}
    if (content && dest) {
      content = fixLineBreak(content)
      await this.enter_raw_repl()
      let output = await this.exec_raw({
        command: `f=open('${dest}','w')\nw=f.write`
      })
      await sleep(100)
      const hexArray = content.split('').map(
        c => c.charCodeAt(0).toString(16).padStart(2, '0')
      )
      const chunkSize = this.chunk_size
      for (let i = 0; i < hexArray.length; i+= chunkSize) {
        let slice = hexArray.slice(i, i+chunkSize)
        let bytes = slice.map(h => `0x${h}`)
        let line = `w(bytes([${bytes.join(',')}]))\x04`
        data_consumer( parseInt((i / hexArray.length) * 100) + '%' )
        await this.write_and_drain(line)
        await sleep(await sleep(this.chunk_sleep))
      }
      return this.exit_raw_repl()
    } else {
      return Promise.reject(new Error(`Must specify content and destination path`))
    }
  }

  async fs_mkdir(filePath) {
    if (filePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `import uos\nuos.mkdir('${filePath}')`
      })
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_rmdir(filePath) {
    if (filePath) {
      let command = `import uos\n`
          command += `try:\n`
          command += `  uos.rmdir("${filePath}")\n`
          command += `except OSError:\n`
          command += `  print(0)\n`
      await this.enter_raw_repl()
      const output = await this.exec_raw({ command: command })
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_rm(filePath) {
    if (filePath) {
      let command = `import uos\n`
          command += `try:\n`
          command += `  uos.remove("${filePath}")\n`
          command += `except OSError:\n`
          command += `  print(0)\n`
      await this.enter_raw_repl()
      const output = await this.exec_raw({ command: command })
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }

  async fs_rename(oldFilePath, newFilePath) {
    if (oldFilePath && newFilePath) {
      await this.enter_raw_repl()
      const output = await this.exec_raw({
        command: `import uos\nuos.rename('${oldFilePath}', '${newFilePath}')`
      })
      return this.exit_raw_repl()
    }
    return Promise.reject()
  }
}

module.exports = MicroPythonBoard
