# Command Line Interface

# Usage

`node cli.js [ARGUMENTS]…`

* `--listports`: List available USB ports
* `--port /dev/tty`: Specify which port to connect. Required for the options below.
* `--listfiles`: List files in the board
* `--ilistfiles`: Same as `--listfiles` but with additional information (size, inodes, folder/file, etc...)
* `--executestring "print('watch out for string escaping')”`: Evaluate string
* `--executefile filename.py`: Run file from the disk
* `--putfile fileA.py fileB.py`: Upload `fileA.py` from the disk to board renaming it to `fileB.py`
* `--getfile fileA.py fileB.py`: Download `fileA.py` from the board to disk renaming it to `fileB.py`
* `--removefile fileA.py`: Remove `fileA.py` from the board
* `--removedir foldername`: Remove `foldername` from the board
* `--verbose`: Prints extra logs

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

### Listing files and folders in the board

AS explained on the [documentation](https://docs.micropython.org/en/v1.9.2/pyboard/library/uos.html#uos.ilistdir), the second element on the array is the file type:

> 0x4000 for directories and 0x8000 for regular files

```
$ node cli.js --verbose --port /dev/ttyACM0 --ilistfiles
VERBOSE
executing command:
command --ilistfiles
arguments []
port /dev/ttyACM0
files at "/" [
  [ 'boot.py', 32768, 0, 1714 ],
  [ '.fseventsd', 16384, 0, 0 ],
  [ 'testy.py', 32768, 0, 78 ],
  [ 'file.py', 32768, 0, 929 ],
  [ 'yolo', 16384, 0, 0 ],
  [ 'lib', 16384, 0, 0 ],
  [ '.Trashes', 16384, 0, 0 ],
  [ 'otroteste.py', 32768, 0, 929 ],
  [ 'turing_machine.py', 32768, 0, 929 ]
]
command executed --ilistfiles
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

### Verbose

```
$ node cli.js --verbose --port /dev/ttyACM0 --putfile ./savetest.py savetest.py
VERBOSE
executing command:
command --putfile
arguments [ './savetest.py', 'savetest.py' ]
port /dev/ttyACM0
0%
1%
2%
3%
4%
5%
6%
7%
8%
9%
10%
12%
13%
14%
15%
16%
17%
18%
19%
20%
21%
22%
24%
25%
26%
27%
28%
29%
30%
31%
32%
33%
35%
36%
37%
38%
39%
40%
41%
42%
43%
44%
45%
47%
48%
49%
50%
51%
52%
53%
54%
55%
56%
57%
59%
60%
61%
62%
63%
64%
65%
66%
67%
68%
70%
71%
72%
73%
74%
75%
76%
77%
78%
79%
80%
82%
83%
84%
85%
86%
87%
88%
89%
90%
91%
92%
94%
95%
96%
97%
98%
99%
undefined
command executed --putfile
```
