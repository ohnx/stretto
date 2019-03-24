#!/bin/bash -e
# first run electron-packager and put the output in tmp
echo 'Building Stretto for all platforms'
# needs to be run on a system with 32-bit WINE installed
electron-packager ./ "Stretto" --platform=win32,linux,darwin --arch=all --electron-version=4.1.1 --app-version=0.40.2 --out=electronres/tmp --overwrite --ignore="dbs|bower_components|electronres" --icon electronres/icon --prune

# then copy the ffmpeg binaries into them
echo 'Copying ffmpeg binaries to windows builds'
cp electronres/ffmpeg32.exe electronres/tmp/Stretto-win32-ia32/resources/app/ffmpeg.exe
cp electronres/ffmpeg64.exe electronres/tmp/Stretto-win32-x64/resources/app/ffmpeg.exe

# zip the resulting Stretto folders
echo 'Zipping packages for uploading'
cd electronres/
for d in tmp/Stretto-*/; do target=${d%/}; echo "Zipping $target"; zip -qry9 "$target.zip"  $d; done;
