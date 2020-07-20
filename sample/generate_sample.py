#!/bin/env python3
COLORS = [
	30, 31, 32, 33, 34, 35, 36, 37,
	90, 91, 92, 93, 94, 95, 96, 97
]

for fgColor in COLORS:
    line = ""
    for style in [1, 2, 4, 5, 7, 8]:
        line += f"\x1b[{style};{fgColor}m {style};{fgColor} \x1b[0m"
    print(line)