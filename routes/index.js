// Dependencies
var    _ = require("underscore"),
      fs = require("fs"),
freebase = require("freebase");

// Get the data from JSON files
var countriesByMonth = require("../public/data/countries_by_month.json");
var citiesByMonth    = require("../public/data/cities_by_month.json");
var countries        = require("../public/data/countries.json");
// Every region analysed
var regionCountries = {};
// Every events recorded from Freebase
var freebaseEvents  = [];

/**
 * Play page
 * @param  {Object} req User request
 */
module.exports = function(app) {

    // Analyse every region files to extract there countries
    regionCountries = extractCountriesFromRegion()
    // Extract freebase events
    extractEventsFromFreebase(function(events) {        
        freebaseEvents = _.map(events, function(e) {
            e.start_date = new Date(e.start_date).getFullYear(); 
            e.end_date   = new Date(e.end_date).getFullYear(); 
            return e;
        });
    });

    // Mains routers
    app.get("/play", playTheHistory);
    app.get("/digg", diggIntoArchive);

    // Contextual routers
    app.get("/play/sidebar", playTheHistorySidebar);

    // Data files
    app.get("/count/:resource.json", dataFile);

    // Right region file according a country code
    app.get("/region/:country.svg", goToRegionfile)

    // Default redirection
    app.get("/", goToPlay);

};


/**
 * Play The History page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var playTheHistory =  module.exports.playTheHistory = function(req, res) {
    res.render("play");
}

/**
 * Digg Into Archive page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var diggIntoArchive =  module.exports.diggIntoArchive = function (req, res) {
    res.render("digg");
}

/**
 * Play The History sidebar
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var playTheHistorySidebar =  module.exports.playTheHistorySidebar = function(req, res) {
    // Looks for the country
    var country = _.findWhere(countries, {iso:req.query.country});
    // Country not found
    if(!country) return res.send(404, 'Sorry, we cannot find that country!');

    res.render("play/sidebar", {
        country   : country, 
        startYear : req.query.startYear, 
        endYear   : req.query.endYear,
        // Get the events for the given query    
        events    : _.filter(freebaseEvents, function(ev) {
            // Events in the given date basket
            return (  ( ev.start_date >= req.query.startYear && ev.start_date <= req.query.endYear )                
                   || ( ev.end_date   >= req.query.startYear && ev.end_date   <= req.query.endYear )                
                ) && ( 
                    // With the country in its name
                    ev.name.toUpperCase().indexOf( country.name.toUpperCase() ) > -1
                    // OR matching to the location
                    || ev.locations.indexOf(country.name) > -1 
                );
        })
    });

};




/**
 * Data File generator
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var dataFile = module.exports.dataFile = function (req, res) {
    var json = [];
    
    // Get the data according the resource name
    switch(req.params.resource) {
        case "countries":
            json = countriesByMonth;            
            break;
        case "cities":
            json = citiesByMonth;            
            break;
    }

    // Filter the data    
    // ...by start date
    if(req.query.start) {
        var start = ( Date.parse(req.query.start)-60 )/1000; // Fix UTC swift               
        var tmpJson = []
        // Fetch the json to find the right document
        for(var i in json) {            
            // The current document is valid
            if(json[i].dt >= start) tmpJson.push(json[i]);
            // The list is ordered by date, so we can't stop if we have any document
            else if( !! tmpJson.length ) break; 
        }
        json = tmpJson;
    }

    // ...by end date
    if(req.query.end) {
        var end = ( Date.parse(req.query.end)-60 )/1000; // Fix UTC swift
        var tmpJson = []
        // Fetch the json to find the right document
        for(var i in json) {            
            // The current document is valid
            if(json[i].dt < end) tmpJson.push(json[i]);
            // The list is ordered by date, so we can't stop if we have any document
            else if( !! tmpJson.length ) break; 
        }
        json = tmpJson;
    }

    // Filter the data    
    // ...by region
    if(req.query.regionFrom) {
        
        // Find the region matching to the given place
        var region = getRegionFromPlace(req.query.regionFrom);

        // Filters using this region
        json = _.filter(json, function(l) {
            return isInRegionFile(l.cy, region);
        });
    }

    // Aggregate the data
    json = aggregateDocsByLocation(json);    

    // Expend location label
    json = _.map(json, function(d) {
        // Looks for the country
        var country = _.findWhere(countries, {iso: d.cy || d.lc} );
        d.label = country ? country.name : "";
        return d;
    });

    // Return the data in JSON
    res.json(json);
}

/**
 * Get the region file matching to the given place
 * @param  {String} place  Place (or country) to filter with
 * @return {String}        Region's file name
 */ 
var getRegionFromPlace = module.exports.getRegionFromPlace = function(place) {

    // Get the region file
    for(var r in regionCountries) {
        // Do the country exist in the curent region file ?
        if( isInRegionFile(place, r) ) {
            // File name is the key
            return r;            
        }
    } 

    return false;
}

/**
 * Redirect to the region file matching to the given country
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var goToRegionfile = module.exports.goToRegionfile = function(req, res) {
    
    // Get the country to look for
    var countryCode = (req.params.country || "").toUpperCase(),
           fileName = getRegionFromPlace(countryCode);

    if(fileName) {
        res.redirect("/data/" + fileName);
    } else {
        res.send(404, 'Sorry, we cannot find that region!');
    }    
}

var isInRegionFile = module.exports.isInRegionFile = function(code, fileName) {
    return regionCountries[fileName].indexOf(code)  > -1;
}

/**
 * Redirect to Play page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var goToPlay =  module.exports.goToPlay = function(req, res) {
    res.redirect("/play");
}


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