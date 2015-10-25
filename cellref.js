/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function CellRef(xIn, yIn) {
   this.x = xIn;
   this.y = yIn;
}

CellRef.prototype.getX = function() {
   return this.x;
};

CellRef.prototype.getY = function() {
   return this.y;
};

CellRef.prototype.isValid = function() {
   return (this.x > 0) && (this.y > 0);
};

CellRef.prototype.equals = function(cellRef) {
   return (this.x === cellRef.x) && (this.y === cellRef.y);
};

CellRef.prototype.add = function(xIn, yIn) {
   this.x += xIn;
   this.y += yIn;
};

module.exports = CellRef;
