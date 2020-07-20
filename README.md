# VT100 Color and Style Highlighting for VS Code

## Features

This extension provides highlighting for VT100 color escape sequences.
Below is a screenshot how the highlighted sample file might look by applying this plugin.
The highligh colors and styles can be customized via the global or project configuration.
Select the file type "VT100 Terminal" on the lower right corner to enable highlighting of a file.

![Example Result](sample/ExampleResult.png)

## Requirements

Typescript for plugin development.
This extension does not need any other dependencies.

## Extension Settings

Edit the global or project local VS Code configuration and add your custom token colors as shown in the example below.
Setting background colors is currently not supported.

```json
{
    "editor.semanticTokenColorCustomizations": {
        // Enable semantic highlighting for all themes.
        "enabled": true,

        // Define all vt100 foreground colors and some attributes.
        // The background color attribute in VS Code is currently not supported,
        // therefore no background colors are defined.
        //
        // Each rule has one of the following styles:
        //   - "semantic-token"
        //   - "semantic-token.semantic-modifier"
        //   - "*.semantic-modifier"
        // Or (by explicitly defining the language):
        //   - "semantic-token:vt100"
        //   - "semantic-token.semantic-modifier:vt100"
        //   - "*.semantic-modifier:vt100"
        //
        "rules": {
            "*.vt100-foreground-default": {
                "foreground": "#FFFFFF"
            },
            "*.vt100-foreground-black": {
                "foreground": "#555555"
            },
            "*.vt100-foreground-red": {
                "foreground": "#FF0000"
            },
            "*.vt100-foreground-green": {
                "foreground": "#00FF00"
            },
            "*.vt100-foreground-yellow": {
                "foreground": "#FFFF00"
            },
            "*.vt100-foreground-blue": {
                "foreground": "#0000FF"
            },
            "*.vt100-foreground-magenta": {
                "foreground": "#FF00FF"
            },
            "*.vt100-foreground-cyan": {
                "foreground": "#00FFFF"
            },
            "*.vt100-foreground-light-gray": {
                "foreground": "#BBBBBB"
            },
            "*.vt100-foreground-dark-gray": {
                "foreground": "#777777"
            },
            "*.vt100-foreground-light-red": {
                "foreground": "#FF7777"
            },
            "*.vt100-foreground-light-green": {
                "foreground": "#77FF77"
            },
            "*.vt100-foreground-light-yellow": {
                "foreground": "#FFFF77"
            },
            "*.vt100-foreground-light-blue": {
                "foreground": "#7777FF"
            },
            "*.vt100-foreground-light-magenta": {
                "foreground": "#FF77FF"
            },
            "*.vt100-foreground-light-cyan": {
                "foreground": "#77FFFF"
            },
            "*.vt100-foreground-white": {
                "foreground": "#FFFFFF"
            },
            "*.vt100-bold": {
                "fontStyle": "bold"
            },
            "*.vt100-dim": {
                "fontStyle": "italic"
            },
            "*.vt100-underlined": {
                "fontStyle": "underline"
            }

            // Use black font for all escape sequences.
            // Use this if you don't want to see the escape sequences
            // itself on a dark theme.
            // "vt100-escape-sequence": {
            //     "foreground": "#000000"
            // }
        }
    }
}
```

The following semantic token types are defined:

- vt100-text
- vt100-escape-sequence

The following semantic token modifiers are defined:

- vt100-bold
- vt100-dim
- vt100-underlined
- vt100-blink
- vt100-inverted
- vt100-hidden
- vt100-foreground-default
- vt100-foreground-black
- vt100-foreground-red
- vt100-foreground-green
- vt100-foreground-yellow
- vt100-foreground-blue
- vt100-foreground-magenta
- vt100-foreground-cyan
- vt100-foreground-light-gray
- vt100-foreground-dark-gray
- vt100-foreground-light-red
- vt100-foreground-light-green
- vt100-foreground-light-yellow
- vt100-foreground-light-blue
- vt100-foreground-light-magenta
- vt100-foreground-light-cyan
- vt100-foreground-white

## Test with Example

Use the python program below to generate a sample file which containts VT100 escape sequences.

```python
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
```

Run the program with `python3 generate_sample.py > sample.vt100`.
The output looks similar to the image shown below on a terminal.

![Example Result on a Terminal](sample/ExampleSource.png)
