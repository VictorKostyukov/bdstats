#! /usr/bin/env node

function parseArgs(argv) {
  var program = require("commander");

  program
    .version("1.0.0")
    .option("-k, --kademlia [url]", "Kademlia HTTP URL (default: http://localhost:7800)", "http://localhost:7800")
    .option("-o, --output [dbname]", "Output database (default: bdstats)", "bdstats")
    .option("-s, --start [timestamp]", "Start timestamp (default: 30 days ago)", (Math.floor(Date.now() / 1000) - 24 * 3600 * 30))
    .option("-e, --end [timestamp]", "End timestamp (default: now)", Math.floor(Date.now() / 1000))
    .parse(argv);

  if (typeof(program.start) == "string") {
    program.start = parseInt(program.start);
  }

  if (typeof(program.end) == "string") {
    program.end = parseInt(program.end);
  }

  return program;
}


function logIfError(err) {
  if (err) {
    console.error(err);
  }
}


function prepareCollection(dbo) {
  dbo.createIndex({ts:-1});
  dbo.createIndex("name");
  dbo.createIndex({totalSize: -1});
  dbo.createIndex({reservedSize: 1});
  dbo.createIndex({availableSize: 1});
}


function processLog(logs, hosts, log, callback) {
  if (!log.ts || !log.name || (log.type !== "storage" && log.type !== "log:storage")) {
    callback();
    return;
  }

  log.reservedSize = log.totalSize - log.availableSize;
  logs.updateOne({ ts : log.ts, name : log.name }, { "$set" : log }, { upsert : true }, function(err, res) {
    logIfError(err);
    logs.find({ name : log.name }).sort({ st : -1 }).limit(1).toArray(function(err, res) {
      logIfError(err);
      res = res[0];
      if (res.ts <= log.ts) {
        hosts.updateOne({ name : log.name }, { "$set" : log }, { upsert : true }, function(err, res) {
          logIfError(err);
          callback();
        });
      } else {
        callback();
      }
    });
  });
}


function startDumpLogs(client, dbName, kademlia, startTime, endTime, onComplete) {
  console.log("Dumping logs: startTime=" + startTime + ", endTime=" + endTime);

  var db = client.db(dbName);

  var logs = db.collection("logs");
  prepareCollection(logs);

  var hosts = db.collection("hosts");
  prepareCollection(hosts);

  var request = require("request");
  var url = kademlia + "/api/host/Kademlia/GetActivityLog";

  var dumpLogs = function(start, end) {
    if (start >= end) {
      console.log("Log dump complete.\n");
      onComplete();
      return;
    }

    var nextStart = Math.min(start + 24 * 3600 * 30, end);
    console.log("-- Processing time " + start + " to " + nextStart);
    request(url + "?startTime=" + start + "&endTime=" + nextStart, function(err, response, body) {
      var dumpNext = function() {
        process.nextTick(function() { dumpLogs(nextStart, end); });
      };

      if (err) {
        console.error(err);
      } else {
        var result = JSON.parse(body);
        if (result.length) {
          var addLog = function(idx) {
            if (idx < result.length) {
              processLog(logs, hosts, result[idx], function() {
                process.nextTick(function() { addLog(idx + 1); });
              });
            }
            else {
              dumpNext();
            }
          };

          addLog(0);
          return;
        }
      }

      dumpNext();
    });
  };

  dumpLogs(startTime, endTime);
}


function processStats(client, dbName, startTime, endTime, callback) {
  console.log("Processing statistics: startTime=" + startTime + ", endTime=" + endTime);

  var db = client.db(dbName);
  var logs = db.collection("logs");
  var stats = db.collection("statistics");

  prepareCollection(stats);

  var processStatsPeriod = function(start) {
    if (start >= endTime) {
      callback();
      return;
    }

    console.log("-- Processing period: " + start);

    var end = start + 24 * 60 * 60;

    logs.aggregate([
      { "$match" : { "$and" : [ { ts : { "$gte" : start } }, { ts : { "$lt" : end } } ] } },
      { "$sort" : { name : 1, ts : -1 } },
      {
        "$group" : {
          "_id" : "$name",
          "ts" : { "$first" : "$ts" },
          "name" : { "$first" : "$name" },
          "totalSize" : { "$first" : "$totalSize" },
          "reservedSize" : { "$first" : "$reservedSize" }
        }
      }
    ]).toArray(function(err, result) {
      logIfError(err);
      if (result && result.length > 0) {
        var totalSize = 0;
        var reservedSize = 0;

        for (let idx = 0; idx < result.length; ++idx) {
          totalSize += result[idx].totalSize;
          reservedSize += result[idx].reservedSize;
        }

        var entry = {
          ts : start,
          totalSize : totalSize,
          reservedSize : reservedSize,
          availableSize : totalSize - reservedSize
        };
        stats.updateOne({ ts : entry.ts }, { "$set" : entry }, { upsert : true }, function(err, result) {
          logIfError(err);
          process.nextTick(function() { processStatsPeriod(end); });
        });
      } else {
        process.nextTick(function() { processStatsPeriod(end); });
      }
    });
  };

  processStatsPeriod(Math.floor(startTime / (24 * 60 * 60)) * 24 * 60 * 60);
}


function main(argv) {
  var args = parseArgs(argv);

  var mongodb = require("mongodb").MongoClient;
  var dbUrl = "mongodb://localhost:27017";

  mongodb.connect(dbUrl, { useNewUrlParser: true }, function(err, client) {
    if (err) {
      client.close();
      throw err;
    }

    startDumpLogs(client, args.output, args.kademlia, args.start, args.end, function() {
      processStats(client, args.output, args.start, args.end, function() {
        client.close();
      });
    });
  });
}


main(process.argv);
