/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var FibonacciHeap = require('fibonacciheap');
var CellRef = require('./cellref.js');
var Grid = require('./grid.js');

var NODE_STATUS = {
   retired: 0,
   notvisited: 1
};

var NUMEDGEDIRECTIONS = 8;
var AXISMOD = 1.0;
var DIAGMOD = Math.sqrt(2);

var walkEdgeDelta = [
[0, -1], // north 4
[1, -1], // northeast 5
[1, 0], // east 6
[1, 1], // southeast 7
[0, 1], // south 0
[-1, 1], // southwest 1
[-1, 0], // west 2
[-1, -1]]; // northwest 3

// index: edge
// value: opposite of index
var oppositeEdge = [
   4, 5, 6, 7, 0, 1, 2, 3
];

var ab = null;
var grid = null;
var dataViewNodeLUT = null;
var crBeg = null;
var crEnd = null;
var noroad;

// To walk an edge, with direction ed, all we then have to do
// is ‘add’ crWalkEdgeDelta[ed] to the source cell's CellRef.
function walkEdge(cellRef, edgeDirection) {
   var delta = walkEdgeDelta[edgeDirection];
   return new CellRef(cellRef.getX() + delta[0], cellRef.getY() + delta[1]);
}

function walkEdges(cellRef, edges) {
   var directions = [];

   for (var c = 0; c < edges.length; c++) {
      directions.push([cellRef.getX(), cellRef.getY()]);
      cellRef = walkEdge(cellRef, edges[c]);
   }

   return directions;
}

function heuristic(dx, dy) {
   return (DIAGMOD * Math.min(dx, dy)) + (AXISMOD * Math.abs(dx - dy));
}

function edgeCost(crSrcDst, edgeDir) {
   var cost, crDst;
   var crSrc = crSrcDst.crSrc;
   // walk to the destination cell index
   crSrcDst.crDst = crDst = walkEdge(crSrc, edgeDir);
   // border cell modifier, return infinity if outside out graph
   if (!crDst.isValid()) {
      return Infinity;
   }

   var srcNode = grid.getNodeAt(crSrc.getX(), crSrc.getY());
   var dstNode = grid.getNodeAt(crDst.getX(), crDst.getY());
   var srcNodeGroundCost = srcNode.roadClass !== noroad ? dataViewNodeLUT.roadCost[srcNode.roadClass] : dataViewNodeLUT.terrainCost[srcNode.terrainType];
   var dstNodeGroundCost = dstNode.roadClass !== noroad ? dataViewNodeLUT.roadCost[dstNode.roadClass] : dataViewNodeLUT.terrainCost[dstNode.terrainType];
   // scale height
   srcNode.height *= dataViewNodeLUT.heightScaleFactor;
   dstNode.height *= dataViewNodeLUT.heightScaleFactor;
   // apply road modifier
   /* if the source and the destination both have
    * road raster pixels differing from the noroad value,
    * then it is assumed that there is a
    * road connecting them. */
   if ((srcNode.roadClass !== noroad) && (dstNode.roadClass !== noroad)) {
      cost = dataViewNodeLUT.roadCost[srcNode.roadClass];
   } else if ((srcNodeGroundCost === "Infinity") || (dstNodeGroundCost === "Infinity")) {
      return Infinity;
      //} else if (Math.abs(srcNode.height - dstNode.height) > dataViewNodeLUT.maxHeightDiff) {
      // apply slope modifier
      //   return Infinity;
   } else {
      // road costs for the cell take precedence over terrain costs
      cost = srcNodeGroundCost + dstNodeGroundCost;
   }

   // apply visibility

   return cost;
}

function findPath(crBeg, crEnd) {
   var edgeDirection = [];
   var edges = [];
   var edgeIndex = 0;
   var nodes = [];
   var U;
   var crU = new CellRef();
   var crV;
   var V = new FibonacciHeap.Node();
   var crSrcDst = {};
   var PQ = new FibonacciHeap();
   var iV;
   var cost;
   var h;

   // set all nodes to notvisited
   for (var c = 0; c < grid.getSize(); c++) {
      nodes[c] = NODE_STATUS.notvisited;
   }

   V.value = {
      "cellRef": new CellRef()
   };

   // ‘heuristic’ estimate of the movement cost from the vertex to the Goal.
   h = heuristic(Math.abs(crBeg.getX() - crEnd.getX()), Math.abs(crBeg.getY() - crEnd.getY()));

   // function(key, value)
   U = PQ.insert(h, {
      "cellRef": crBeg,
      "g": 0
   });

   nodes[grid.indexOf(crBeg.getX(), crBeg.getY())] = U;

   // while there are still nodes to visit
   while (true) {
      U = PQ.extractMinimum();
      if (!U) {
         break;
      }

      crU = U.value.cellRef;
      crSrcDst.crSrc = crU;
      // if we're at the destination, then exit the while loop
      if (crU.equals(crEnd)) {
         cost = U.value.g;
         break;
      }

      // examine possible paths from U to its neighbors
      for (var edgeDir = 0; edgeDir < NUMEDGEDIRECTIONS; edgeDir++) {
         // compute new least cost path candidate
         cost = U.value.g + edgeCost(crSrcDst, edgeDir);
         crV = crSrcDst.crDst;

         // if it's off limits (e.g. outside the map), then skip it
         if (cost >= Infinity) {
            continue;
         }

         iV = grid.indexOf(crV.getX(), crV.getY());
         V = nodes[iV];

         if (V === NODE_STATUS.retired) {
            continue; // Can't improve it!
         }

         // first time,add to queue
         if (V === NODE_STATUS.notvisited) {
            edgeDirection[iV] = edgeDir;
            h = heuristic(Math.abs(crV.getX() - crEnd.getX()), Math.abs(crV.getY() - crEnd.getY()));
            // function(key, value)
            V = PQ.insert(cost, {
               "cellRef": crV,
               "g": cost
            });
            nodes[iV] = V;
            // can be improved!?
         } else if (cost <= V.value.g) {
            if (cost === V.value.g) {
               // To avoid biasing...
               if (Math.random() <= 0.5) {
                  edgeDirection[iV] = edgeDir;
               }

               continue;
            }

            edgeDirection[iV] = edgeDir;
            V.value.g = cost;
            // function(node, newKey)
            PQ.decreaseKey(V, cost);
         }
      }
   }

   if (crU.equals(crEnd)) {
      // construct the edge path by backtracking & reversing...
      crU = new CellRef(crEnd.getX(), crEnd.getY());

      while (true) {
         edges[edgeIndex] = edgeDirection[grid.indexOf(crU.getX(), crU.getY())];
         crU = walkEdge(crU, oppositeEdge[edges[edgeIndex]]);
         edgeIndex++;
         if (crU.equals(crBeg)) {
            break;
         }
      }
   }

   return walkEdges(crBeg, edges.reverse());
}

module.exports = function(self) {
   self.addEventListener('message', function(e) {
      var isArrayBuffer = e.data instanceof ArrayBuffer;
      if (e.data instanceof Object && !isArrayBuffer) {
         if (e.data.start && e.data.end) {
            crBeg = new CellRef(e.data.start[0], e.data.start[1]);
            crEnd = new CellRef(e.data.end[0], e.data.end[1]);
         }

         if (e.data.bitOrder && e.data.props) {
            dataViewNodeLUT = {};
            dataViewNodeLUT.bitOrder = e.data.bitOrder;
            dataViewNodeLUT.props = e.data.props;
            dataViewNodeLUT.heightScaleFactor = e.data.heightScaleFactor;
            dataViewNodeLUT.maxHeightDiff = e.data.maxHeightDiff;
            dataViewNodeLUT.roadCost = e.data.roadCost;
            dataViewNodeLUT.terrainCost = e.data.terrainCost;
            noroad = Math.pow(dataViewNodeLUT.bitOrder[dataViewNodeLUT.props.indexOf("roadClass")], 2) - 1;
         }
      } else if (isArrayBuffer) {
         ab = e.data;
      }
      // wait for ArrayBuffer, metadata, and start/end points
      if (ab && dataViewNodeLUT && crBeg && crEnd) {
         grid = new Grid(new DataView(ab), dataViewNodeLUT);
         self.postMessage(findPath(crBeg, crEnd));
      }

   }, false);
};
