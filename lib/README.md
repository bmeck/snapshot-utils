## outdir/meta.json

json of `{snapshot:...}` directly from the snapshots, contains metadata used to query other files

## outdir/nodes

```
uint32[meta.json#node_fields.length uint32s] node_fields;
uint32 edge_file_offset;
```

## outdir/edges

```
uint32[meta.json#edge_fields.length uint32s] edge_fields;
```

## outdir/string_indices

```
uint32 strings_file_offset;
uint32 length;
```

## outdir/strings

```
char[#length] chars;
```