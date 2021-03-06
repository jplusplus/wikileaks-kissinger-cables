// Dependencies
var    _ = require("underscore"),
  config = require("config"),
    data = require("./data")(); // Initialize data

/**
 * Play page
 * @param  {Object} req User request
 */
module.exports = function(app) {

    // Mains routers
    app.get(config.root + "map", playTheHistory);
    app.get("/map", playTheHistory);
    app.get(config.root + "graph", diggIntoArchive);
    app.get("/graph", diggIntoArchive);

    // Contextual routers
    app.get(config.root + "map/sidebar", playTheHistorySidebar);
    app.get("/map/sidebar", playTheHistorySidebar);

    // Data files
    app.get("/count/:resource.json", dataFile);
    app.get(config.root + "count/:resource.json", dataFile);
    app.get("/events.json", function(req, res) { res.json(data.events) });
    app.get(config.root + "events.json", function(req, res) { res.json(data.events) });

    // Right region file according a country code
    app.get("/region/:country.svg", goToRegionfile)
    app.get(config.root + "region/:country.svg", goToRegionfile)

    // Default redirection
    app.get("/", goToPlay);
    app.get(config.root + "", goToPlay);
};



/**
 * Play The History page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var playTheHistory =  module.exports.playTheHistory = function(req, res) {
    res.render("play", { title: "Browse Map" });
}

/**
 * Dive Into Archive page
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var diggIntoArchive =  module.exports.diggIntoArchive = function (req, res) {
    res.render("dive", { title: "Make Timegraph" });
}

/**
 * Play The History sidebar
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var playTheHistorySidebar =  module.exports.playTheHistorySidebar = function(req, res) {

    // Looks for the country
    var country = _.findWhere(data.countries, {iso2:req.query.country});

    // Gets events from freebase
    var events  = _.filter(data.freebaseEvents, function(ev) {
        // Events in the given date basket
        return (  ( ev.start_date >= req.query.startYear && ev.start_date <= req.query.endYear )
               || ( ev.end_date   >= req.query.startYear && ev.end_date   <= req.query.endYear )
            ) && (
                // Do not take the indian cricket season (not related to india)
                ev.name.toLowerCase().indexOf("indian cricket") == -1
            ) && (
                // With the country in its name
                ev.name.toUpperCase().indexOf( country.name.toUpperCase() ) > -1
                // OR matching to the location
                || ev.locations.indexOf(country.name) > -1
            );
    });

    // Gets events from our manual database
    events = events.concat(_.filter(data.events, function(e) {

        // Work on clone of the event (to edit it)
        var ev = _.clone(e);
        ev.start_date = new Date(ev.start_date).getFullYear();
        ev.end_date   = new Date(ev.end_date).getFullYear();

        // Events in the given date basket
        return (  ( ev.start_date >= req.query.startYear && ev.start_date <= req.query.endYear )
               || ( ev.end_date   >= req.query.startYear && ev.end_date   <= req.query.endYear )
            ) && (
                // It's a world event
                ev.locations.indexOf("WORLD") > -1
                // With the country in its name
                || ev.name.toUpperCase().indexOf( country.name.toUpperCase() ) > -1
                // OR matching to the location
                || ev.locations.indexOf(country.name) > -1
                || ev.locations.indexOf(req.query.country) > -1
            );
    }));

    // Country not found
    if(!country) return res.send(404, 'Sorry, we cannot find that country!');

    // Build the query
    var q = country.name;
    // Old patch for USSR code
    // if(country.iso2 == "SU") q += " USSR"

    var searchUrl = config["search-engine"]["url"];
    searchUrl += "?q=" + escape(q);
    searchUrl += "&amp;qtfrom=" +  escape(req.query.startYear + "-01-01");
    searchUrl += "&amp;qtto=" +  escape(req.query.endYear + "-12-31");

    res.render("play/sidebar", {
        country   : country,
        startYear : req.query.startYear,
        endYear   : req.query.endYear == 1977 ? 1976 : req.query.endYear,
        // Get the events for the given query
        events    : events,
        searchUrl : searchUrl
    });

};




/**
 * Data File generator
 * @param  {Object} req User request
 * @param  {Object} res Server result
 */
var dataFile = module.exports.dataFile = function (req, res) {

    var json = [],
    resource = req.params.resource;

    // Get the data according the resource name
    switch(resource) {

        case "ngrams":
            return data.getNgramByMonth(req.query.q, function(err, result) {
                if(err) {
                    res.json({"error": err});
                } else {
                    // Keep only the rows from the query
                    for(var r in result) {
                        // Transposes rows to month's docs count
                        result[r] = data.transposeToMonthCount(result[r]);
                    }
                    // Return the data in JSON
                    res.json(result);
                }
            });
            break;

        case "countries":
            json = data.countriesByYear;
            break;

        case "cities":
            json = data.citiesByYear;
            break;

        default:
            return res.send(404);
            break;

    }

    // Determines how many month are grouped by backet
    var slotSize = req.query.slotSize || 1;

    // Aggregate the data
    json = data.aggregateDocs(json, slotSize, resource);

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
        res.redirect(config.root + "data/" + fileName);
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
    res.redirect(config.root + "map");
}

