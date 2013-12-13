// Dependencies
var    _ = require("underscore"),
      fs = require("fs"),
      pg = require("pg"),
   async = require("async"),
freebase = require("freebase"),
  config = require("config"),
     csv = require("csv"),
   cache = require('memory-cache');

var startDate = new Date(1966, 0, 1),
      endDate = new Date(2010, 1, 1);

module.exports = function() {

    var dataDir = "./public/data/";

    csv().from(dataDir + "count_by_month.csv", { columns: ["ct","dt"] })
            .transform(dateStringToStr)
            .to.array(function(data) {

                module.exports.docCountByMonth = _.map(data, function(c) {
                    dt   = c.dt.split('-')
                    c.dt = dt[0] + (dt[1] < 10 ? "-0" : "-") + dt[1]
                    return c;
                });

                console.log("%d doc/count by month extracted from file.", data.length)
            });

    csv().from(dataDir + "countries_by_year.csv", { columns: ["dt","ct", "lc"] })
            .transform(dateStringToYear)
            .to.array(function(data) {
                module.exports.countriesByYear = convertCoord(data);
                console.log("%d countries/count by year extracted from file.", data.length)
            });

    csv().from(dataDir + "cities_by_year.csv", { columns: ["dt","ct", "lc", "lt", "lg", "cy"] })
            .transform(dateStringToYear)
            .to.array(function(data) {
                module.exports.citiesByYear = convertCoord(data);
                console.log("%d cities/count by year extracted from file.", data.length)
            });

    csv().from(dataDir + "countries.csv", { columns: true })
            .to.array(function(data) {
                module.exports.countries = data;
                console.log("%d countries extracted from file.", data.length)
            });

    csv().from(dataDir + "events.csv", { columns: true })
            .transform(locationsToArray)
            .to.array(function(data) {
                module.exports.events = data;
                console.log("%d events extracted from file.", data.length)
            });


    // Every events recorded from Freebase
    module.exports.freebaseEvents = [];

    // Extract freebase events
    extractEventsFromFreebase(function(events) {
        module.exports.freebaseEvents = _.map(events, function(e) {
            e.start_date = new Date(e.start_date).getFullYear();
            e.end_date   = new Date(e.end_date).getFullYear();
            return e;
        });
        console.log("%d events extracted from Freebase.", events.length)
    });

    // Create db connexion (use environment variable if exists)
    dbClient = new pg.Client(process.env.DATABASE_URL || config.pg.url);
    dbClient.connect();

    return module.exports;
};

var dateStringToYear = function(row, index) {
    row.dt = new Date(row.dt).getFullYear();
    return row;
}

var dateStringToStr = function(row, index) {
    row.dt = new Date(row.dt);
    row.dt = row.dt.getFullYear() + "-" + row.dt.getMonth();
    return row;
}

var locationsToArray = function(row, index) {
    row.locations = row.locations.split(",");
    return row;
}

/**
 * Convert coordonate to float
 * @param  {Array} data Dataset to convert
 * @return {Array}      Dataset converted
 */
var convertCoord = function(data) {
    return _.map(data, function(d) {
        d.lt = 1*d.lt;
        d.lg = 1*d.lg;
        return d;
    })
};

/**
 * Aggregates every given documents by slot size them by location key
 * @param  {Array}      docs        Documents list
 * @params {Integer}    slotSize    Month number to group by
 * @params {String}     doctype     Documents type (to use the cache)
 * @return {Array}                  Documents aggregated
 */
var aggregateDocs = module.exports.aggregateDocs = function(docs, slotSize, doctype) {

    var d = {};
    // Look at the cache first
    if(doctype) {
        var cacheKey = doctype+"-count-"+slotSize;
        // Get the data from the cache
        d = cache.get(cacheKey);
        // Cache value exists !
        if(d != null) return d;
        // Reset d
        else d = {};
    }

    var idx = 0;
    var firstYear = startDate.getFullYear(),
         lastYear = endDate.getFullYear();
    // Get all different years
    for(y = firstYear; y <= lastYear; y++) {
        // For each month, merge data along the slot site
        if(idx <= (lastYear-firstYear) - slotSize + 1) {
            d[y] = [];
            for(var j=0; j<=slotSize; j++ ) {
                doc = _.where(docs, {dt: firstYear + idx + j - 1 })
                d[y] = d[y].concat(doc);
            }
        }
        // Aggreagte by the location the final dataset
        d[y] = aggregateDocsByLocation(d[y]);
        obj  = {}
        // Tranforms the year array into an object
        _.each(d[y], function(e) {
            code = e.lc || e.cy
            // Looks for the country
            var country = _.findWhere(module.exports.countries, {iso2: code});
            e.label = country ? country.name : "";
            // Remove the date (already in the key)
            delete e.dt;
            obj[code] = e
        });
        d[y] = obj

        idx++
    }


    // Puts data into the cache
    if(cacheKey) cache.put(cacheKey, d);

    return d;
};

/**
 * Aggregates every given documents by location key
 * @param  {Array}      docs        Documents list
 * @return {Array}                  Documents aggregated
 */
var aggregateDocsByLocation = module.exports.aggregateDocsByLocation = function(docs) {

    var groupedDocs = _.groupBy(docs, "lc");

    return _.map(groupedDocs, function(docs) {

        doc = _.clone(docs[0]);
        doc.ct = _.reduce(docs, function(sum,n) {
            return sum += 1*n.ct;
        }, 0);

        return doc;
    });

}

/**
 * Extract every event between the given basket from Freebase
 * @param  {Function} callback Callback function, receiving the data
 */
var extractEventsFromFreebase = module.exports.extractEventsFromFreebase = function (callback) {

    // Create the query to freebase to extract event
    var query=[{
        "id":         null,
        "name":       null,
        "start_date": null,
        "end_date":   null,
        "type":       "/time/event",
        "key": {      // Get the wikipedia key (en)
            "namespace": "/wikipedia/en_id",
            "value":     null,
            "limit":     1
        },
        "locations":[],
        "start_date>=": "1966",
        "end_date<=": "2010"
    }];


    // Gets tge data from freebase
    freebase.paginate(query, {}, callback || function() {});
}



/**
 * Get all ngram's count matching to the given query by week
 * @param  {String}   query    Term to look for
 * @param  {Function} callback Callback function
 */
var getNgramByMonth = module.exports.getNgramByMonth = function(query, callback) {

    // Force uppercase (all document content are in uppercase)
    query = query.toUpperCase();
    // Every queries on the same object
    var queries = {},
    // Terms to look for
          terms = query.split(",");
    // Query maximum number
    var limit = 3;

    for( var t in terms )  {
        var term = terms[t].trim();
        // Avoid looking for an empty string
        if(term !== "") {
            // Create a closure function
            queries[term] = function(term)  {
                return function(callback) {
                    // Requests the database twice
                    async.parallel({
                        'ps': function(done){
                            var q = [];
                            q.push("SELECT to_char(created_at,'YYYY-MM') as dt, count as ct");
                            q.push("FROM cable_ngram_months_ps");
                            q.push("WHERE ngram = $1");
                            dbClient.query(q.join(" "), [term], done);
                        },
                        'cg': function(done) {
                            var q = [];
                            q.push("SELECT to_char(created_at,'YYYY-MM') as dt, count as ct");
                            q.push("FROM cable_ngram_months_cg");
                            q.push("WHERE ngram = $1");
                            dbClient.query(q.join(" "), [term], done);
                        }
                    // Merge the two dataset
                    }, function(error, data) {
                        // or stop of error
                        if(error) return callback(error, null)
                        // Merge the two dataset
                        var merge  = data.cg.rows.concat(data.ps.rows);
                        // Group items by date
                        var groups = _.groupBy(merge, function(d) { return d.dt });
                        var sums = _.map(groups, function(group, dt) {
                            // Sums the value
                            sum = _.reduce(group, function (previous, a) {
                                return a.ct + previous;
                            }, 0);
                            return { ct: sum, dt: dt }
                        });
                        // Callback function
                        callback(null, sums)
                    })


                }
            }(term);

            // Check and update the number of queries left
            if(--limit == 0) break;
        }
    }

    // Send all queries at the same time (maximum 3)
    async.parallel(queries, callback)

};

/**
 * Transpose database rows to document's count by moth
 * @param  {Array} rows Rows to transpose
 * @return {Array}      Rows transposed
 */
var transposeToMonthCount = module.exports.transposeToMonthCount = function(rows) {
    var all = [];
    // Dateset bounds
    for(year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
        for(month = 0; month < 12; month++) {

            date = new Date(year, month, 1)
            if(date <= startDate || date >= endDate) continue

            month = (month < 10 ? "0" : "")  + month
            dt    = year + "-" + month
            // Do not outisde the date range
            if(year >= startDate.getFullYear() && year <= endDate.getFullYear() ) {

                var row = _.find(rows, function(r) {
                    return r.dt == dt
                }),
                   part = _.find(module.exports.docCountByMonth, function(m) { return m.dt == dt }),
                   data = { dt: year + "-" + month, tt: 0, ct: 0, part: 0 };

                if(row) data.ct = 1*row.ct;
                if(part) data.tt = 1*part.ct
                if(row && part) data.part = row.ct / part.ct

                all.push(data);
            }
        }
    }

    return all;
};