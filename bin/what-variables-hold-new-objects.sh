#!/bin/sh

OLD=$1
NEW=$2
bin/containing-closure.mjs $NEW $(
  bin/mask.mjs $OLD $NEW | json -ga -c 'this.sizes[0] == null' node
)