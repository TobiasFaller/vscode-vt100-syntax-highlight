# Changelog

## 1.1.0

- Added support for inline escape sequence highlighting (with includes and excludes)
- Added support for opening files with custom editor (by default)
- Improved handling of previews (side-by-side vs dedicated)
- Fixed bug on text export where escape sequences were not removed

## 1.0.2

- Updated dependencies
- Fixed spacing issue with escape codes

## 1.0.1

- Added badges to repository

## 1.0.0

- First feature-complete release
- Updated preview images in repository

## 0.0.16

- Added native theme support

## 0.0.15

- Added support for synchronous scrolling in preview

## 0.0.14

- Updated color palette to match default Microsoft terminal colors
- Fixed dark / light color handling for editor
- Fixed bug where leading zeroes in escape code were not stripped

## 0.0.13

- Fixed bug in parsing of ESC[m code
- Added foreground text colors for light mode

## 0.0.12

- Added additional filter to remove escape codes in preview panel
- Added section 'How to open the preview' to the readme document

## 0.0.11

- Added progress to export commands
- Introduced abbreviated class names for HTML export to reduce memory consumption

## 0.0.10

- Implemented dark and light support for editor
- Implemented dark, light and high-contrast support for preview

## 0.0.9

- Debounced editor input to increase performance during typing and editing

## 0.0.8

- Added escape sequence snippets

## 0.0.7

- Added Text and HTML export
- Fixed bug where context menu options for a file would do nothing

## 0.0.6

- Fixed extension activation

## 0.0.5

- Added preview panel with rendered VT100 codes
- Updated configuration settings
- Added font configuration support with fallback to editor font
- Added custom CSS support for preview panel

## 0.0.4

- Rewrote most of the plugins achitecture. \
  Plugin now uses decorators instead of semantic types and modifiers.
- Added background color support.
- Added support for inverted colors and hidden attribute.

## 0.0.3

- Introduced changelog.

## 0.0.2

- Added icon for the Marketplace.

## 0.0.1

- First test release of this plugin.
