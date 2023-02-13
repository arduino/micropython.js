# Command Line Interface

# Usage

`node cli.js [ARGUMENTS]…`

* `--listports`: List available USB ports
* `--port /dev/tty`: Specify which port to connect. Required for the options below.
* `--listfiles`: List files in the board
* `--executestring "print('watch out for string escaping')”`: Evaluate string
* `--executefile filename.py`: Run file from the disk
* `--putfile fileA.py fileB.py`: Upload `fileA.py` from the disk to board renaming it to `fileB.py`
* `--getfile fileA.py fileB.py`: Download `fileA.py` from the board to disk renaming it to `fileB.py`
* `--removefile fileA.py`: Remove `fileA.py` from the board
* `--removedir foldername`: Remove `foldername` from the board

## Examples

### Listing all available USB ports

```
$ node cli.js --listports                                                
available ports [
  {
    path: '/dev/ttyACM0',
    manufacturer: 'MicroPython',
    serialNumber: '5031503337360009',
    pnpId: 'usb-MicroPython_Board_in_FS_mode_5031503337360009-if00',
    locationId: undefined,
    vendorId: '2341',
    productId: '025e'
  }
]
```

### Listing files in the board

```
$ node cli.js --port /dev/ttyACM0 --listfiles                            
files at "/" [
  '.openmv_disk',
  '.fseventsd',
  'main.py',
  'midi.py',
  'boot.py',
  '.Trash-1000',
  'lib'
]
```

### Evaluating a string

```
$ node cli.js --port /dev/ttyACM0 --executestring "print('hello world!')"
OK
MPY: soft reboot
raw REPL; CTRL-B to exit
>OKhello world!
```

### Running the code from your disk

```
$ node cli.js --port /dev/ttyACM0 --executefile examples/test.py
OK
MPY: soft reboot
raw REPL; CTRL-B to exit
>OKstart
duh
duh
duh
duh
duh
duh
duh
duh
duh
duh
```

### Uploading a file from your disk to the board

```
$ node cli.js --port /dev/ttyACM0 --putfile examples/test.py test.py
```

### Downloading a file from the board to your disk

```
$ node cli.js --port /dev/ttyACM0 --getfile test.py test.py
"""
Test
"""

from machine import Pin
from time import sleep
pin = Pin(6, Pin.OUT)
print("start")
for i in range(0, 10):
    pin.on()
    sleep(0.1)
    pin.off()
    sleep(0.1)
    print('duh')
```

