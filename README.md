[![NPM](https://nodei.co/npm/dimdal-pathfinder.png?downloads=true&stars=true)](https://nodei.co/npm/dimdal-pathfinder/)


An implementation of the pathfinding algorithm described by

Dimdal / Jönsson, 1997. An optimal pathfinder for vehicles in real-world digital terrain maps. Masters Thesis, The Royal Institute of Science, School of Engineering Physics, Stockholm, Sweden

Demo: https://csbrandt.github.io/dimdal-pathfinder/test/


Installation
-------------
    $ npm install dimdal-pathfinder

Methods
--------
    constructor(options)
> **options**:  *object*
>
> + memInit:  *string*, path to memory initialization file
> + heightScaleFactor: *number*, applied to raw (8 bit) heightmap values
> + maxHeightDiff: *number*, the maximum difference in height between two cells before it is considered as unpassable
> + terrainLUT: *object*,
>     + cost: *array*, terrain class movement costs ordered by class index,
>     infinite costs are represented by the string `"Infinity"`
> + roadLUT: *object*,
>     + cost: *array*, road class movement costs ordered by class index

    findPath(startCoord, endCoord)
> **startCoord**:  *array*, coordinate of the starting cell in X,Y order
>
> **endCoord**:  *array*, coordinate of the ending cell in X,Y order
>
> **Returns**
>
> *Promise*, resolved with an array of coordinates that make up the path

Background
-----------

#### A*

The cost function of the A* (denoted as `f(x)`) is defined as

    f(x) = g(x) + h(x)

where:

+ `g(x)` past path-cost function, which is the known distance from the starting node to the current node x
+ `h(x)` future path-cost function, which is an admissible "heuristic estimate" of the distance from x to the goal<sup>[[wikipedia](https://en.wikipedia.org/wiki/A*_search_algorithm#Description)]</sup>

#### Dimdal Pathfinder

An addition to `g(x)` (denoted as `w(u,v)`) is defined as<sup>[[2]](http://riverviewai.com/papers/JonssonAnalysis4.pdf)</sup>

    w(u,v) = e(u,v) + r(u,v) + s(u,v) + t(u,v) + v(u,v)

where:

+ `e(u,v)` edge check function
+ `r(u,v)` road check function
+ `s(u,v)` slope function
+ `t(u,v)` terrain function
+ `v(u,v)` visibility function

such that:

    g(x) = g(u) + w(u,v)

where:

+ `g(u)` movement cost from the starting point to u


The A* heuristic `h(x)` is defined as

    h(x) = ((Diagonal Edge Length * min(dx , dy)) +
           (Axial Edge Length * |dx – dy|)) *
           Minimum Terrain Cost

where:

+ `dx = |SourceX – DestinationX|`
+ `dy = |SourceY – DestinationY|`

Implementation Details
-----------------------

#### Priority queue

A Fibonacci heap is used as a priority queue within the A* algorithm. Dense search graphs (containing millions of nodes) are generated from processing real-world raster data.

#### Memory space

Dimdal<sup>[[1]](http://www.markus.dimdal.se/doc/Dimdal_PathFinder.pdf)</sup> describes an efficient graph representation that uses 3 bytes per node.

This particular implementation is designed to be used with grayscale heightmaps. Only 1 byte is required to represent the terrain height and total memory footprint per node is reduced to 2 bytes.

#### Memory initialization

A static memory initialization file is used to store all nodes in the search graph. A memory initialization file must be generated for each region in which searches will be conducted.

To generate a memory initialization file first create a configuration file and run,

    $ node tools/generate-mem-init.js test/config.json

Running Tests
--------------
Install the development dependencies:

    $ npm install

Then run the tests:

    $ firefox test/index.html

Browser Bundle
---------------
    $ npm run build

References
-----------

1. Dimdal / Jönsson (1997). [An optimal pathfinder for vehicles in real-world digital terrain maps.](http://www.markus.dimdal.se/doc/Dimdal_PathFinder.pdf)
2. Sidran (2005). [An Analysis of Dimdal’s "An optimal pathfinder for vehicles in real-world digital terrain maps."](http://riverviewai.com/papers/JonssonAnalysis4.pdf)
