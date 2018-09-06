#! /bin/bash

cd `dirname "$0"`

now=`date +%s`

# two days ago
let start=$now-172800

node analyzer.js -k http://18.220.231.21:7800 -s $start -e $now

