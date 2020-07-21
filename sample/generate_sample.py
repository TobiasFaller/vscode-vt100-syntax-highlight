#!/bin/env python3
COLORS = [
    39,
    30, 31, 32, 33, 34, 35, 36, 37,
    90, 91, 92, 93, 94, 95, 96, 97
]

for fgColor in COLORS:
    line = ""
    for style in [0, 1, 2, 4, 5, 7, 8]:
        line += f"\x1b[0;{style};{fgColor}m {style};{fgColor} "
    line += "\x1b[0m"
    print(line)