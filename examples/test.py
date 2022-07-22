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
