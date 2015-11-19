# Snapshot
synonyms: [Heapsnapshot](#Snapshot), [Heapdump](#Snapshot)

This is the representation of all *non-primitive* objects on that a GC is tracking. It is a graph that may contain cycles, but has a defined entry point.

## Root

This is the defined entry point that determines what objects are going to survive GC. It is a [Node](#Node). Once a Node is no longer accessible from the root and the root's children, it can be garbage collected.

# Node

This represents a specific instance of a *non-primitive* object that the GC is managing. It may represent user code or VM internals.

## node.type

| type | explanation |
| --- | --- |
| hidden | VM internals |
| array | An Array|
| string | A String that is completely represented by one Node |
| object | An Object |
| code | Machine code to perform an action |
| closure | An instance of a JS Function |
| regexp | A JS RegExp, includes state machine to perform the RegExp |
| number | A Number that is *not* a JS Number, used for internal fields |
| native | Represents C++ data |
| synthetic | VM internals, generally used to group Nodes for some purpose |
| concatenated string | A String that is formed by a chain of other Strings |
| sliced string | A String that is a slice of another String |

## node.name

The meaning of a Node's name relates to it's type. For the most part names only describe what a Node represents (such as the name of a `closure`'s function). However, `string` Nodes have names that represent their values.

## Retainers

A retainer is any Node keeping this Node alive. This means that there is an [Edge](#Edge) from all the retainers of this Node to this Node.

Given:

```prolog
node(a)
node(b) contains node(a)
```

`node(b)` is a retainer of `node(a)`.

## Dominator

A dominator is a [Node](#Node) that *must* be traversed in order to reach another Node (the dominated Node). Any time a dominator is garbage collected, all dominated Nodes nodes are able to be garbage collected. This is not the only time a Node may become available for garbage collection.

### Weak Reference Gotcha

If a Node contains is being retained due to a weak reference this does not prevent it from being garbage collected. A dominator may not represent the Node that is preventing another Node from being collected.

Given:

```prolog
node(a)
node(b) weakly contains node(a)
node(c) contains node(a)
node(d) contains node(b), node(c)
```

The Dominator of `node(a)` is `node(d)` since all paths to `node(a)` must go through `node(d)`. However, `node(c)` is the only Node that is not weakly containing `node(a)`. Since `node(b)` is weakly containing `node(a)` it is not preventing `node(a)` from being garbage collected. The only Node keeping `node(a)` from being garbage collected is `node(c)`.

## Distance

How far away from the [root](#root) is this Node at minimum. This metric is only useful for finding very deeply nested objects.

## Self Size
synonyms: [shallow size](#self-size)

This is the exact amount of memory that a Node occuppies without traversing any [Edges](#Edge). Since primitives are not shown in Snapshots, if the self size of a Node is growing it could mean multiple things.

1. VM optimizations have occured so this Node takes more space
2. A property was added that is a primitive, this may or may not be represented in the edges called `"properties"` and `"elements"`


Both of these specific scenarios are detectable by [retained size](#retained-size) since they are only accessible through this Node.

## Retained Size
synonyms: [held memory](#retained-size)

This is the amount of memory that is only accessible from the [root](#root) by going through this Node.


### The Sharing Gotcha

Retained size is useful in seeing if a specific Node is causing growth. However, this can be misleading since a Node may be visible from multiple other Nodes.

Given:

```prolog
node
parent(a) contains node
parent(b) contains node
grand_parent contains parents(a,b)
```

If `node` grows in size, the retained size would only grow for `grand_parent`. This becomes complicated when a Node is shared between files. If `parent(a)` represents `a.js` and `parent(b)` represents `b.js` then grand_parent could be the [root](#root) which would not grow the retained size of `a.js` or `b.js`! Use this with caution.

# Edge

This represents the path between Nodes. Their memory is actually held within the Node

## edge.type

| type | explanation |
| --- | --- |
| context | path to a variable |
| element | path to an array index |
| property | path to an object's property |
| internal | ... |
| hidden | path that may be internal or defined in the JS spec, but not exposed to JS code |
| shortcut | VM taking a shortcut, same vein as internal. This is generally used for structures that are formed as a chain like a linked list of strings in the Snapshot representing a single JS string |
| weak | This is a reference that does not keep the children alive. If the only route to an object is through a weak edge, it can be garbage collected. |

## edge.name

The name of an edge is always descriptive. For `element` and `property` Edges it represents things visible via JS property access. For `context` it represents things visible via JS variables.