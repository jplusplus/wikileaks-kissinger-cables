// Dependencies
var    _ = require("underscore"),
      fs = require("fs"),
      pg = require("pg"),
   async = require("async"),
freebase = require("freebase"),
  config = require("config");


module.exports = function() { 

    // Get data from JSON files
    module.exports.countriesByMonth = require("./public/data/countries_by_month.json");
    module.exports.citiesByMonth    = require("./public/data/cities_by_month.json");
    module.exports.countries        = require("./public/data/countries.json");
    module.exports.docCountByWeek   = require("./public/data/doc_count_by_week.json");
    module.exports.events           = require("./public/data/events.json");
    
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


/**
 * Aggregates every given documents by location key
 * @param  {Array} docs Documents list
 * @return {Array}      Documents aggregated
 */
var aggregateDocsByLocation = module.exports.aggregateDocsByLocation = function(docs) {

    var groupedDocs = _.groupBy(docs, "lc");

    return _.map(groupedDocs, function(docs) {

        doc = docs[0];
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
        "region-mo.svg",
        "region-na.svg",
        "region-ca.svg",
        "region-euw.svg",
        "region-eun.svg",
        "region-eus.svg",
        "region-eue.svg",
        "region-sa.svg",
        "region-oc.svg",
        "region-af.svg",
        "region-as.svg"
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

    var dateBasket = ["1973", "1974", "1975", "1976"];
    // Create the query to freebase to extract event
    query=[{
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
        "start_date>=": "1973",
        "end_date<=": "1976"
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