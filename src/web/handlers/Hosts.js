#! /usr/bin/env node

(function() {

  const DbName = "bdstats";

  function normalizeIntParam(original, defaultValue) {
    if (typeof(original) == "string") {
      return parseInt(original);
    } else if (typeof(original) == "undefined") {
      return defaultValue;
    } else {
      return original;
    }
  }


  function throwIfError(err, client) {
    if (err) {
      if (client) {
        client.close();
      }
      throw err;
    }
  }


  function connectDb(callback) {
    let mongodb = require("mongodb");
    const dbUrl = "mongodb://localhost:27017";

    mongodb.MongoClient.connect(dbUrl, { useNewUrlParser : true }, function(err, client) {
      throwIfError(err, client);
      callback(null, client);
    });
  }


  function getStatistics(response, startTime, endTime) {
    startTime = normalizeIntParam(startTime, Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60);
    endTime = normalizeIntParam(endTime, Math.floor(Date.now() / 1000));

    var waterfall = require("async-waterfall");

    waterfall([
      connectDb,
      function(client, callback) {
        let db = client.db(DbName);
        
        db.collection("statistics")
          .find({ "$and" : [{ ts:{"$gte":startTime} }, { ts:{"$lte":endTime} }]})
          .sort({ ts:-1 })
          .toArray(function(err, result) {
            throwIfError(err, client);
            callback(client, result);
          });
      }
    ], function(client, result) {
      if (!result) {
        result = [];
      }
      response.json(result);
      client.close();
    });
  }


  function searchHosts(response, query, limit, offset) {
    if (typeof(query) == "undefined" || query == "") {
      query = undefined;
    } else {
      query = { "$or" : [ { name:query }, { address:query }, { address:"http://"+query}] };
    }

    limit = normalizeIntParam(limit, 20);
    offset = normalizeIntParam(offset, 0);

    var waterfall = require("async-waterfall");

    waterfall([
      connectDb,
      function(client, callback) {
        let db = client.db(DbName);

        db.collection("hosts")
          .find(query)
          .sort({ ts: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(function(err, result) {
            throwIfError(err);
            callback(client, result);
          });
      }
    ], function(client, result) {
      if (!result) {
        result = [];
      }
      response.json(result);
      client.close();
    });
  }


  function getHostCount(response, query) {
    if (typeof(query) == "undefined" || query == "") {
      query = undefined;
    } else {
      query = { "$or" : [ { name:query }, { address:query }] };
    }

    var waterfall = require("async-waterfall");

    waterfall([
      connectDb,
      function(client, callback) {
        let db = client.db(DbName);

        db.collection("hosts")
          .find(query)
          .sort({ ts: -1 })
          .count(function(err, result) {
            throwIfError(err);
            callback(client, result);
          });
      }
    ], function(client, result) {
      if (!result) {
        result = 0;
      }
      response.json(result);
      client.close();
    });
  }


  module.exports.handler = function(response, action, args) {
    switch (action) {
      case "GetStatistics":
        getStatistics(response, args.startTime, args.endTime);
        break;

      case "SearchHosts":
        searchHosts(response, args.query, args.limit, args.offset);
        break;

      case "GetHostCount":
        getHostCount(response, args.query);
        break;

      default:
        response.status(500).send("Action '" + action + "' not supported.");
    }
  };

}());
