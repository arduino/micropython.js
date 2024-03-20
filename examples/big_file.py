# stepper.py

# A micropython driver for 4-phase, unipolar stepper motors such as
# the 28BYJ-48

# Relesed to the Public Domain by Nicko van Someren, 2020

# The constructor for the Stepper class takes as arguments the four
# pins for driving the motor phases, in phase order, and optionally a
# timer. The pins can be passed as pin numbers or machine.Pin objects
# and the timer can be a machine.Timer object or a timer index. Note
# that if two stepper motors use the same timer then they will not be
# able to run at the same time.
#
# The run() method takes a number of steps and an optional delay (in
# seconds) between driving the steps (the default is 1ms). A negative
# step count will drive the motor in the oposite direction to a
# positive count. The count represents "half steps" since the driver
# alternates driving single coils and driving pairs of adjacent coils.
# Calls to run() return immediately; the motor runs on a timer in the
# background. Calling run() again before the previous command has
# finished adds the new count to the old count, so the destination
# position is the sum of the requests; the delay is set to the new
# value if stepper is not already at its final location.
#
# The stop() method will stop the rotation of the motor. It returns
# the number of un-taken steps that would be needed to perform the
# outstanding requests from previous calls to run().
#
# The is_running property returns true if the motor is running,
# i.e. stop() would return a non-zero value, and false otherwise.

import machine
import time

# When the following number is sampled at four consecutive
# even-numbered bits it will have two bits set, but sampling at four
# consecutive odd-numbered bits will only yield one bit set.
# 😌🥲🙏🏼💩
_WAVE_MAGIC = 0b0000011100000111

class Stepper:
    def __init__(self, A, B, C, D, T=1):
        if not isinstance(T, machine.Timer):
            T = machine.Timer(T)
        self._timer = T
        l = []
        for p in (A, B, C, D):
            if not isinstance(p, machine.Pin):
                p = machine.Pin(p, machine.Pin.OUT)
            l.append(p)
        self._pins = l
        self._phase = 0
        self._stop()
        self._run_remaining = 0

    def _stop(self):
        [p.off() for p in self._pins]

    # Note: This is called on an interrupt on some platforms, so it must not use the heap
    def _callback(self, t):
        if self._run_remaining != 0:
            direction = 1 if self._run_remaining > 0 else -1
            self._phase = (self._phase + direction) % 8
            wave = _WAVE_MAGIC >> self._phase
            for i in range(4):
                self._pins[i].value((wave >> (i*2)) & 1)
            self._run_remaining -= direction
        else:
            self._timer.deinit()
            self._stop()

    def run(self, count, delay=0.001):
        tick_hz=1000000
        period = int(delay*tick_hz)
        if period < 500:
            period = 500
        self._run_remaining += count
        if self._run_remaining != 0:
            self._timer.init(period=period, tick_hz=tick_hz,
                             mode=machine.Timer.PERIODIC, callback=self._callback)
        else:
            self._timer.deinit()
            self._stop()

    def stop(self):
        remaining = self._run_remaining
        self._run_remaining = 0
        self._timer.deinit()
        self._stop()
        return remaining

    @property
    def is_running(self):
        return self._run_remaining != 0
