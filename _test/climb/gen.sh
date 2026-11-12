#!/bin/sh
# Prism endless climb pool: tiers easy → hard (node verify/prism-pool.js opts seedFrom want out)
cd "$(dirname "$0")/../.."
g() { timeout 900 node verify/prism-pool.js "$1" "$2" "$3" "_test/climb/$4.jsonl" > /dev/null 2>&1; echo "$4 $(wc -l < _test/climb/$4.jsonl 2>/dev/null)"; }
g '{"layout":"tri","colours":"RG","res":0,"resCap":0,"locks":0,"lo":3,"hi":6}' 1 12 t1
g '{"layout":"diamond","colours":"RGB","res":1,"resCap":3,"locks":0,"lo":5,"hi":9}' 1 12 t2
g '{"layout":"bar5","colours":"RGB","res":0,"resCap":0,"locks":1,"lo":7,"hi":11}' 1 12 t3
g '{"layout":"zig","colours":"RGBY","res":1,"resCap":3,"locks":0,"lo":9,"hi":13}' 1 15 t4
g '{"layout":"flower","colours":"RGBY","res":1,"resCap":3,"locks":1,"lo":11,"hi":16}' 1 15 t5
g '{"layout":"zig","colours":"RGBYP","res":1,"resCap":2,"locks":1,"lo":17,"hi":24,"limit":600000}' 1 15 t7
