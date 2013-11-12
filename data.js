// Dependencies
var    _ = require("underscore"),
      fs = require("fs"),
      pg = require("pg"),
   async = require("async"),
freebase = require("freebase"),
  config = require("config"),
     csv = require("csv"),
   cache = require('memory-cache');


module.exports = function() { 

    var dataDir = "./public/data/";

    // Get data from JSON files
    module.exports.docCountByWeek   = require(dataDir + "doc_count_by_week.json");

    // Get data from CSV files
    csv().from(dataDir + "countries_by_month.csv", { columns: ["dt","ct", "lc", "lt", "lg"] })
            .transform(dateStringToTimestamp)
            .to.array(function(data) {            
                module.exports.countriesByMonth = convertCoord(data);
                console.log("%d countries/count extracted from file.", data.length)
            });

    csv().from(dataDir + "cities_by_month.csv", { columns: ["dt","ct", "lc", "lt", "lg", "cy"] })
            .transform(dateStringToTimestamp)
            .to.array(function(data) {
                module.exports.citiesByMonth = convertCoord(data);
                console.log("%d cities/count extracted from file.", data.length)
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


    // Doc count must be date-formated
    module.exports.docCountByWeek   = _.map(module.exports.docCountByWeek, function(c) {
        c.dt = new Date( (c.dt)*1000);
        // Database rows have the date format YYYYMMDD
        // We must convet the week's date
        var dt = [ c.dt.getFullYear() ] 
        // Two digits format
        dt.push( ("0" + ( 1*c.dt.getMonth() + 1) ).slice(-2) );
        dt.push( ("0" + c.dt.getDate()).slice(-2) );
        c.dt = dt.join("");
        return c;
    });

    // Analyse every region files to extract there countries
    module.exports.regionCountries = extractCountriesFromRegion()

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

var dateStringToTimestamp = function(row, index) {
    row.dt = new Date(row.dt).getTime()/1000;
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

    // Get all different months
    // using the date attribute
    // and sort them.
    var months = _.uniq( 
                    _.pluck(
                        module.exports.countriesByMonth, "dt")
                    ).sort(function(a,b){ return a-b; }),
      monthLen = months.length;
    
    _.each(months, function(m, idx) {
        // Remove the time in the key
        m = new Date(m*1000);
        m = m.getFullYear() +""+ m.getMonth();

        // For each month, merge data along the slot site
        if(idx <= monthLen - slotSize + 1) {
            d[m] = [];
            for(var j=0; j<=slotSize; j++ ) {                
                d[m] = d[m].concat( _.where(docs, {dt: months[idx+j] }) );
            }
        }
        // Aggreagte by the location the final dataset
        d[m] = aggregateDocsByLocation(d[m]);  
        d[m] = _.map(d[m], function(e) {    
            // Looks for the country
            var country = _.findWhere(module.exports.countries, {
                iso_alph2_1970: e.cy || e.lc
            });
            e.label = country ? country.name : "";  
            // Remove the date (already in the key)
            delete e.dt;

            return e; 
        });    
    });


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
 * Analyse every region file to know wich countries are available in 
 * @return {Object} Countries available by region file
 */
var extractCountriesFromRegion = module.exports.extractCountriesFromRegion = function() {

    // Library to parse XML
    var libxmljs = require('libxmljs');
    // Files directory
    var dir = './public/data/';
    // Files to fetch 
    // ORDER IS IMPORTANT: it defines priority when a country is in 2 regions
    var regionFiles = [ 
        "afr.svg",
        "amc.svg",
        "amn.svg",
        "ams.svg",
        "asi.svg",
        "eue.svg",
        "euo.svg",
        "moo.svg",
        "su.svg"
    ];                

    // Object to recolt the regions' countries
    var res = {};
    
    // Analyse each files
    regionFiles.forEach(function(fileName) {
        
        var file = libxmljs.parseXml( fs.readFileSync(dir+fileName) ),
        // Get every paths containing country id
           paths = file.find('//xmlns:g[@id="countries"]//xmlns:path[@data-iso2]', 'http://www.w3.org/2000/svg');

        // Extract every country ids
        res[fileName] = _.map(paths, function(path) { 
            return (path.attr('data-iso2').value()  || "").toUpperCase();
        });

    });

    return res;
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
 * Get the region file matching to the given place
 * @param  {String} place  Place (or country) to filter with
 * @return {String}        Region's file name
 */ 
var getRegionFromPlace = module.exports.getRegionFromPlace = function(place) {

    // Get the region file
    for(var r in module.exports.regionCountries) {
        // Do the country exist in the curent region file ?
        if( isInRegionFile(place, r) ) {
            // File name is the key
            return r;            
        }
    } 

    return false;
}

/**
 * Checks if the given code is into the given file
 * @param  {String}  code       Country code to look for
 * @param  {String}  fileName   Key of the countries list
 * @return {Boolean}            True if we found the given code in the list
 */
var isInRegionFile = module.exports.isInRegionFile = function(code, fileName) {
    return module.exports.regionCountries[fileName].indexOf(code)  > -1;
}


/**
 * Get all ngram's count matching to the given query by week
 * @param  {String}   query    Term to look for
 * @param  {Function} callback Callback function
 */
var getNgramByWeek = module.exports.getNgramByWeek = function(query, callback) {

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
                    
                    var q = [];
                    q.push("SELECT to_char(created_at,'YYYYMMDD') as dt, count as ct");
                    q.push("FROM cable_ngram_weeks");
                    q.push("WHERE ngram = $1");

                    dbClient.query(q.join(" "), [term], callback); 
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
 * Transpose database rows to document's count by week
 * @param  {Array} rows Rows to transpose
 * @return {Array}      Rows transposed
 */
var transposeToWeekCount = module.exports.transposeToWeekCount = function(rows) {
    
    var all = _.map(module.exports.docCountByWeek, function(week) {
        
        var data = {
             // Total number of document
            tt: week.ct,
            dt: week.dt
        };

        var row = _.findWhere(rows, { dt: week.dt });

        if(row) {
            // Total of occurences 
            data.ct = row.ct;
            // Part of occurence following the total of document
            data.part = Math.round( (row.ct/data.tt)*100*1000 )/1000; 
        } else {        
            // Total of occurences (equal to its part)
            data.part = data.ct = 0;  
        }

        return data;
    });

    return all;
};