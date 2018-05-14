/*
    Copyright 2018 Thomas Horn
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
// ==UserScript==
// @name          nuWebBounty
// @description   Planets.nu plugin to record web drain bounties
// @version       0.01.01
// @date          2018-05-12
// @author        drgirasol
// @include       http://planets.nu/*
// @include       http://play.planets.nu/*
// @include       http://test.planets.nu/*
// @resource	  Documentation https://github.com/drgirasol/nuwebbounty/wiki
// @updateURL     https://greasyfork.org/scripts/26189-nupilot/code/nuWebBounty.js
// @downloadURL   https://greasyfork.org/scripts/26189-nupilot/code/nuWebBounty.js

// ==/UserScript==

function wrapper () { // wrapper for injection

    
    /*
     *  DASHBOARD OVERWRITE
     */
	// display NuPilot Information & Settings (Dashboard)
    vgapDashboard.prototype.showWebBountyList = function()
    {
        this.content.empty();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li class='SelectedFilter'>Web Reports</li>").tclick(function() {
            vgap.dash.showWebBountyList()
        }).appendTo(".FilterMenu");
        $("<li>Something else...</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");

        this.pane = $("<div class='DashPane'></div>").appendTo(this.content);
        let a = $("<div id='webReportList'><hr></div>").appendTo(this.pane);
        let table = $("<table width='100%'></table>").appendTo(a);
        let headerRow = $("<tr></tr>").appendTo(table);
        let headerCells = $("<th>Ship</th><th>Name</th><th>Hull</th><th>Owner</th><th>Location</th><th>Turn</th><th>Hidden</th>").appendTo(headerRow);
        webbounty.data.sort(
            function (a, b) {
                return a.shipId - b.shipId;
            }
        );
        webbounty.data.forEach(function (r) {
            let reportRow = $("<tr></tr>").appendTo(table);
            let hullName = r.hullId;
            if (hullName) hullName = vgap.getHull(r.hullId).name;
            let raceName = r.ownerId;
            if (raceName) raceName = vgap.getRace(r.ownerId).adjective;
            $("<td>" + r.shipId + "</td><td>" + r.shipName + "</td><td>" + hullName + "</td><td>" + raceName + "</td><td>" + r.location + "</td><td>" + r.turn + "</td><td>" + r.hidden + "</td>").appendTo(reportRow);
        });
        console.log(webbounty.data);
        this.pane.jScrollPane();
    };
    vgapDashboard.prototype.showNuWebBountyDash = function()
    {
        vgap.playSound("button");
        this.content.empty();
        //
        this.dipMenu();
        $("<ul class='FilterMenu'></ul>").appendTo(this.content);
        $("<li class='SelectedFilter'>Web Reports</li>").tclick(function() {
            vgap.dash.showWebBountyList()
        }).appendTo(".FilterMenu");
        $("<li>Something else...</li>").tclick(function() {
            vgap.dash.showNuPilotCollectorSettings()
        }).appendTo(".FilterMenu");
        //
        this.pane = $("<div class='DashPane'>Settings & Infos.</div>").appendTo(this.content);
        vgap.dash.showWebBountyList();
        this.pane.jScrollPane();
    };
/*
     *
     * Web Bounty Control
     *
     */
let webbounty = {
    version: "0.1",
    /*
        @desc BROWSER STORAGE
    */
    data: [],               // storage for the nuPilot (ship missions, base, etc.)
    storageId: "",      // storage ID for the previous
    isChromeBrowser: false,
    realTurn: false,
    gameId: false,
    /*
        GENERAL GAME TASKS
     */
    scanReports: function()
    {
        // check messages for combat reports where APS might have been destroyed...
        // this is necessary due to the recycling of shipIDs
        vgap.messages.forEach(function (msg)
        {
            //console.log(msg);
            if (msg.body.match(/is out of fuel and energy/) !== null)
            {
                console.warn("Ship %s is out of fuel!", msg.target);
                //console.log(msg);
                let s = vgap.getShip(msg.target);
                let dataMatch;
                if (msg.data)
                {
                    dataMatch = msg.data[0].match(/^([A-Za-z0-9\s\-]+)\sID#\d+$/);
                } else
                {
                    dataMatch = msg.body.match(/^([A-Za-z0-9\s\-]+)\sID#\d+/);
                }
                let shipName = dataMatch[1];
                let hullId = false;
                let ownerId = false;
                let hidden = false;
                if (s)
                {
                    //console.log(s);
                    ownerId = s.ownerid;
                    hullId = s.hullid;
                } else
                {
                    console.log("Ship %s could not be scanned!", msg.target);
                    hidden = true;
                }
                let report = {
                    shipId: msg.target,
                    shipName: shipName,
                    hullId: hullId,
                    location: msg.x + "x" + msg.y,
                    turn: msg.turn,
                    ownerId: ownerId,
                    hidden: hidden
                };
                if (!webbounty.isInStorage(report))
                {
                    webbounty.data.push(report);
                }
            }
        });
    },
    /*
        LOCAL STORAGE HANDLING
     */
    setStorageId: function()
    {
        if (typeof(localStorage) === "undefined") {
            console.warn("Sorry! No Web Storage support..");
        }
        let isChromium = window.chrome,
            winNav = window.navigator,
            vendorName = winNav.vendor,
            isOpera = winNav.userAgent.indexOf("OPR") > -1,
            isIEedge = winNav.userAgent.indexOf("Edge") > -1,
            isIOSChrome = winNav.userAgent.match("CriOS");

        if(isIOSChrome){
            // is Google Chrome on IOS
            webbounty.isChromeBrowser = true;
        } else if(isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isOpera === false && isIEedge === false) {
            // is Google Chrome
            webbounty.isChromeBrowser = true;
        } else {
            // not Google Chrome
        }

        let createdBy = vgap.game.createdby;
        if (vgap.game.createdby === "none") createdBy = vgap.player.username;
        webbounty.storageId = "nuWebBounty" + createdBy + vgap.game.id;
    },
    isInStorage: function(report)
    {
        for(let i = 0; i < webbounty.data.length; i++)
        {
            // ...look for report
            if (webbounty.data[i].shipId === report.shipId &&
                webbounty.data[i].hullId === report.hullId &&
                webbounty.data[i].location === report.location &&
                webbounty.data[i].turn === report.turn &&
                webbounty.data[i].ownerId === report.ownerId)
            {
                return true;
            }
        }
        return false;
    },
    loadData: function()
    {
        let storedData = JSON.parse(localStorage.getItem(webbounty.storageId));
        if (storedData === null) // no storage setup yet
        {
            webbounty.data = [];
        } else {
            webbounty.data = storedData.reports;
        }
    },
    saveData: function()
    {
        console.log("save data");
        localStorage.setItem(webbounty.storageId, JSON.stringify(
            {
                status: true,
                reports: webbounty.data
            }
        ));
    },
    /*
     * processload: executed whenever a turn is loaded: either the current turn or
     * an older turn through time machine
     */
    processload: function() {
        webbounty.setStorageId();
        webbounty.loadData();
        webbounty.scanReports();
        console.log(webbounty.data);
        webbounty.saveData();
    },
    /*
     * loaddashboard: executed to rebuild the dashboard content after a turn is loaded
     */
    loaddashboard: function() {
        console.log("LoadDashboard: plugin called.");
        let a = $("<ul></ul>").appendTo("#DashboardMenu");
        vgap.dash.addLeftMenuItem("nuWeBounty" + " »", function() {
            vgap.dash.showNuWebBountyDash();
        }, a);
    },
    /*
     * showdashboard: executed when switching from starmap to dashboard
     */
    showdashboard: function() {
        //console.log("ShowDashboard: plugin called.");
    },
    /*
     * showsummary: executed when returning to the main screen of the dashboard
     */
    showsummary: function() {
        //console.log("ShowSummary: plugin called.");
    },
    /*
     * loadmap: executed after the first turn has been loaded to create the map
     * as far as I can tell not executed again when using time machine
     */
    loadmap: function() {
        //console.log("LoadMap: plugin called.");
    },
    /*
     * showmap: executed when switching from dashboard to starmap
     */
    showmap: function() {
        //console.log("ShowMap: plugin called.");
    },
    /*
     * loadplanet: executed when a planet is selected on dashboard or starmap
     *
     * Inside the function "load" of vgapPlanetScreen (vgapPlanetScreen.prototype.load) the normal planet screen
     * is set up. You can find the function in "nu.js" if you search for 'vgap.callPlugins("loadplanet");'.
     *
     * Things accessed inside this function several variables can be accessed. Elements accessed as "this.X"
     * can be accessed here as "vgap.planetScreen.X".
     */
    loadplanet: function() {
        //console.log("LoadPlanet: plugin called.");
    },
    /*
     * loadPlanet: executed when a planet is selected on dashboard or starmap
     *
     * Inside the function "load" of vgapStarbaseScreen (vgapStarbaseScreen.prototype.load) the normal starbase screen
     * is set up. You can find the function in "nu.js" if you search for 'vgap.callPlugins("loadstarbase");'.
     *
     * Things accessed inside this function several variables can be accessed. Elements accessed as "this.X"
     * can be accessed here as "vgap.starbaseScreen.X".
     */
    loadstarbase: function() {
        //console.log("LoadStarbase: plugin called.");
        //console.log("Starbase id: " + vgap.starbaseScreen.starbase.id + " on planet id: " + vgap.starbaseScreen.planet.id);
    },
    /*
     * loadship: executed when a planet is selected on dashboard or starmap
     * Inside the function "load" of vgapShipScreen (vgapShipScreen.prototype.load) the normal ship screen
     * is set up. You can find the function in "nu.js" if you search for 'vgap.callPlugins("loadship");'.
     *
     * Things accessed inside this function several variables can be accessed. Elements accessed as "this.X"
     * can be accessed here as "vgap.shipScreen.X".
     */
    loadship: function() {
        //console.log("LoadShip: plugin called.");
    }
};

	// register your plugin with NU
	vgap.registerPlugin(webbounty, "webbountyPlugin");
	console.log("nuWebBounty plugin registered");
} //wrapper for injection

var script = document.createElement("script");
script.type = "application/javascript";
script.textContent = "(" + wrapper + ")();";

document.body.appendChild(script);