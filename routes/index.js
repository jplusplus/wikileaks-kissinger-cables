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

/**
 * Play page
 * @param  {Object} req User request
 */
module.exports = function(app) {

    // Analyse every region files to extract there countries
    regionCountries = extractCountriesFromRegion()

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
        events    : []
    });
}


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

    // Return the data in JSON
    res.json(json);
}

/**
 * Get the region file matching to the given place
 * @param  {String} place  Place (or country) to filter with
 * @return {String}        Region's file name
 */ 
var getRegionFromPlace = function(place) {

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
var goToRegionfile = function(req, res) {
    
    // Get the country to look for
    var countryCode = (req.params.country || "").toUpperCase(),
           fileName = getRegionFromPlace(countryCode);

    if(fileName) {
        res.redirect("/data/" + fileName);
    } else {
        res.send(404, 'Sorry, we cannot find that region!');
    }    
}

var isInRegionFile = function(code, fileName) {
    return regionCountries[fileName].indexOf(code)  > -1;
}

/**
 * Redirect to Play page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var goToPlay = function(req, res) {
    res.redirect("/play");
}


/**
 * Aggregates every given documents by location key
 * @param  {Array} docs Documents list
 * @return {Array}      Documents aggregated
 */
function aggregateDocsByLocation(docs) {

    var groupedDocs = _.groupBy(docs, "lc");

    return _.map(groupedDocs, function(docs) {

        doc = docs[0];
        doc.ct = _.reduce(docs, function(sum,n) {                                        
            return sum += 1*n.ct;
        }, 0);

        return doc;
    });

}


function extractCountriesFromRegion() {

    // Library to parse XML
    var libxmljs = require('libxmljs');
    // Files directory
    var dir = './public/data/';
    // Files to fetch
    var regionFiles = [
        "region-na.svg",
        "region-eu.svg",
        "region-sa.svg",
        "region-as.svg",
        "region-af.svg",
        "region-oc.svg"
    ];                

    // Object to recolt the regions' countries
    var res = {};
    
    // Analyse each files
    regionFiles.forEach(function(fileName) {
        
        var file = libxmljs.parseXml( fs.readFileSync(dir+fileName) ),
        // Get every paths containing country id
           paths = file.find('//xmlns:path[@data-iso2]', 'http://www.w3.org/2000/svg');

        // Extract every country ids
        res[fileName] = _.map(paths, function(path) { 
            return (path.attr('data-iso2').value()  || "").toUpperCase();
        });

    });

    return res;
}