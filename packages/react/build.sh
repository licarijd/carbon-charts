#!/usr/bin/env bash

set -e

rm -rf dist

babel src --out-dir dist
rollup -c
cp *.md dist/
cp package.json dist/
