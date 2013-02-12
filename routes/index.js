// Dependencies
var    _ = require("underscore"),
    data = require("../data")(); // Initialize data

/**
 * Play page
 * @param  {Object} req User request
 */
module.exports = function(app) {

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
    res.render("play", {title: "Play the history"});
}

/**
 * Digg Into Archive page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var diggIntoArchive =  module.exports.diggIntoArchive = function (req, res) {
    res.render("digg", {title: "Digg into archive"});
}

/**
 * Play The History sidebar
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var playTheHistorySidebar =  module.exports.playTheHistorySidebar = function(req, res) {
    // Looks for the country
    var country = _.findWhere(data.countries, {iso:req.query.country});
    // Country not found
    if(!country) return res.send(404, 'Sorry, we cannot find that country!');

    res.render("play/sidebar", {
        country   : country, 
        startYear : req.query.startYear, 
        endYear   : req.query.endYear,
        // Get the events for the given query    
        events    : _.filter(data.freebaseEvents, function(ev) {
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
            json = data.countriesByMonth;            
            break;
        case "cities":
            json = data.citiesByMonth;            
            break;
        case "ngrams":
            return data.getNgramByWeek(req.query.q, function(err, result) {                
                if(err) {
                    res.json({"error": err});
                } else {             
                    // Keep only the rows from the query                           
                    for(var r in result) {                        
                        // Transposes rows to week's docs count 
                        result[r] = data.transposeToWeekCount(result[r].rows);
                    }
                    // Return the data in JSON
                    res.json(result);
                }
            });          
            break;
    }

    // Filter data from static files    
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
        var region = data.getRegionFromPlace(req.query.regionFrom);

        // Filters using this region
        json = _.filter(json, function(l) {
            return data.isInRegionFile(l.cy, region);
        });
    }

    // Aggregate the data
    json = data.aggregateDocsByLocation(json);    

    // Expend location label
    json = _.map(json, function(d) {
        // Looks for the country
        var country = _.findWhere(data.countries, {iso: d.cy || d.lc} );
        d.label = country ? country.name : "";
        return d;
    });

    // Return the data in JSON
    res.json(json);
}


/**
 * Redirect to the region file matching to the given country
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var goToRegionfile = module.exports.goToRegionfile = function(req, res) {
    
    // Get the country to look for
    var countryCode = (req.params.country || "").toUpperCase(),
           fileName = data.getRegionFromPlace(countryCode);

    if(fileName) {
        res.redirect("/data/" + fileName);
    } else {
        res.send(404, 'Sorry, we cannot find that region!');
    }    
}


/**
 * Redirect to Play page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var goToPlay =  module.exports.goToPlay = function(req, res) {
    res.redirect("/play");
}

