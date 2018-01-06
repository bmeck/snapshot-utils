#!/bin/sh

# this does not include objects that have new/changed edges
# you could add the following to include those
#  || this.edges[1].find(_ => /change|add/.test(_.delta))
bin/mask.mjs $1 $2 | json -g -a -c 'this.sizes[0] == null' -0 -j

