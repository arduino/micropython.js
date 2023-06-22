"""
Test
"""

from time import sleep
from machine import Pin
pin = Pin(2, Pin.OUT)
print("start OK \r\n")
for i in range(0, 10):
  print('duh')
  pin.on()
  sleep(0.1)
  pin.off()
  sleep(0.1)
