set -ex

INKSCAPE=/Applications/Inkscape.app/Contents/Resources/bin/inkscape 

$INKSCAPE -z $(pwd)/clearflask-logo.svg -e $(pwd)/clearflask-logo.png

magick convert clearflask-logo.png -resize 16x16 clearflask-logo-16.png
magick convert clearflask-logo.png -resize 32x32 clearflask-logo-32.png
magick convert clearflask-logo.png -resize 48x48 clearflask-logo-48.png
magick convert clearflask-logo.png -resize 64x64 clearflask-logo-64.png
magick convert clearflask-logo.png -resize 128x128 clearflask-logo-128.png
magick convert clearflask-logo-16.png clearflask-logo-32.png clearflask-logo-48.png favicon.ico
