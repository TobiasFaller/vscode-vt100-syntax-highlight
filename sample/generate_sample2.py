#!/bin/env python3

FGCOLORS = [
    39,
	30, 31, 32, 33, 34, 35, 36, 37,
	90, 91, 92, 93, 94, 95, 96, 97
]
BGCOLORS = [
    49,
    40, 41, 42, 43, 44, 45, 46, 47,
    100, 101, 102, 103, 104, 105, 106, 107
]
ATTRIBUTES = [ 0, 1, 2, 4, 5, 7, 8 ]

for bgColor in BGCOLORS:
    for fgColor in FGCOLORS:
        line = ""
        for attribute in ATTRIBUTES:
            style = f"{attribute};{fgColor};{bgColor}"
            line += f"\x1b[0;{style}m {style}"
        line += "\x1b[0m"
        print(line)
    print()