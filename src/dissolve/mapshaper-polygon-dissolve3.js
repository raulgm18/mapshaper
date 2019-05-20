/* @requires
mapshaper-pathfinder
mapshaper-polygon-holes
mapshaper-dissolve
mapshaper-data-aggregation
mapshaper-ring-nesting
mapshaper-polygon-mosaic
mapshaper-mosaic-index
*/


// Assumes that arcs do not intersect except at endpoints
internal.dissolvePolygonLayer3 = function(lyr, dataset, opts) {
  opts = utils.extend({}, opts);
  var getGroupId = internal.getCategoryClassifier(opts.fields, lyr.data);
  var groups = internal.groupPolygons3(lyr, getGroupId);
  var mosaicIndex = new MosaicIndex(lyr, dataset, opts);
  if (opts.mosaic) {
    return internal.composeMosaicLayer(lyr, mosaicIndex.mosaic);
  }
  mosaicIndex.removeGaps();
  var shapes2 = internal.dissolvePolygonGroups3(groups, mosaicIndex, opts);
  return internal.composeDissolveLayer(lyr, shapes2, getGroupId, opts);
};

internal.composeMosaicLayer = function(lyr, shapes2) {
  var records = shapes2.map(function(shp, i) {
    return {tile_id: i};
  });
  return utils.defaults({
    shapes: shapes2,
    data: new DataTable(records)
  }, lyr);
};

internal.groupPolygons3 = function(lyr, getGroupId) {
  return lyr.shapes.reduce(function(groups, shape, shapeId) {
    var groupId = getGroupId(shapeId);
    if (groupId in groups === false) {
      groups[groupId] = [];
    }
    groups[groupId].push(shapeId);
    return groups;
  }, []);
};

internal.dissolvePolygonGroups3 = function(groups, mosaicIndex, opts) {
  var dissolve = internal.getRingIntersector(mosaicIndex.nodes, 'dissolve');
  var dissolvedShapes = groups.map(function(shapeIds) {
    var tiles = mosaicIndex.getTilesByShapeIds(shapeIds);
    if (opts.tiles) {
      return tiles.reduce(function(memo, tile) {
        return memo.concat(tile);
      }, []);
    }
    return internal.dissolveTileGroup3(tiles, dissolve);
  });
  return dissolvedShapes;
};

internal.dissolveTileGroup3 = function(tiles, dissolve) {
  var rings = [],
      holes = [],
      dissolved, tile;
  for (var i=0, n=tiles.length; i<n; i++) {
    tile = tiles[i];
    rings.push(tile[0]);
    if (tile.length > 1) {
      holes = holes.concat(tile.slice(1));
    }
  }
  dissolved = dissolve(rings.concat(holes));
  if (dissolved.length > 1) {
    // Commenting-out nesting order repair -- new method should prevent nesting errors
    // dissolved = internal.fixNestingErrors(dissolved, arcs);
  }
  return dissolved.length > 0 ? dissolved : null;
};