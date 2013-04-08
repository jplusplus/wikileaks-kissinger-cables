# Pepper Spray
## Installation
### Software dependencies
To make the project up and running, you need:

* **Node** 0.8.19
* **NPM** 1.1.32
* **PostGreSQL** 9.1

### Step 0:
Esnure that postgresql-server-dev-9.1, libxml2, libxml2-dev and gyp packages are present on your system.

### Step 1: Download the dependencies
The app is build at the top of the pleasant [Node Package Manager](http://npmjs.org/). To download and set up the whole dependancies three, simply run from the project's root directory :

    $ npm install

### Step 2: Edit the configuration
#### Use configuration file
The default configuration is present into *config/default.json*. Every modifications in this file will be commited. The *runtime.json* file is an auto-generated file that you shouldn't edit.

* **Development mode**: If you want to overide default values, you have to create a file named *config/development.json* and corresponding to your local configuration. This file will be ignored by git. 
* **Production mode**: if you want to overide default values, you have to edit the *config/production.json* file to fit with your production environment. This file will be ignored by git.

#### Alternative: use environment variables
The following environment variables can be use with the highest priority :

* **PORT** defines the port to listen to (ex: *80*);
* **DATABASE_URL** defines the database URL;
* **NODE_ENV** defines the runtime mode that affects the configuration (ex: *development*, *production*, etc).

### Step 3: Build the database

1. Download the ngram's database [from that link](http://domain/ngrams.sql.bz2) into your */tmp* folder:
    
    $ cd /tmp
    $ wget http://domain/ngrams.sql.bz2

1. Extract the downloaded archive:

    $ bzip2 -d ngrams.sql.bz2

1. Import the sql file into your database. **214,549,557 lines, it can be long**:

    $ psql DATABASE_NAME < ngrams.sql


### Step 4: Run!
To launch the application enter the following commad: 

    $ node app.js

Your application is now available from [localhost:3000](http://localhost:3000)!



### Common issues
* **Error: watch ENOSPC**: Do not run the application with DropBox on the same system.
Link: [https://groups.google.com/forum/?fromgroups=#!topic/nodejs/LX7sz9f-fmY](https://groups.google.com/forum/?fromgroups=#!topic/nodejs/LX7sz9f-fmY)

## GNU General Public License
This software is the property of [Journalism++](http://jplusplus.org) and licensed under the [GNU Genral Public License](https://www.gnu.org/licenses/gpl-3.0.txt).