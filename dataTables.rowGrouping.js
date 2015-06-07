/*
* File:        jquery.dataTables.rowGrouping.js
* Version:     1.3.0
* Author:      Michael Brade (based on row grouping add-on by Jovan Popovic)
*
* Copyright 2012 Jovan Popovic
* Copyright 2013 Michael Brade
*
* This source file is free software, under either the GPL v2 license or a
* BSD style license, as supplied with this software.
*
* This source file is distributed in the hope that it will be useful, but
* WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
* or FITNESS FOR A PARTICULAR PURPOSE.
*/


(function ($, window, document) {



function _getMonthName(iMonth) {
    var asMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return asMonths[iMonth - 1];
}

// TODO: pass oSettings to _fnGetGroup* stuff for iYearIndex etc.

// group name is the unmodified string of the column
function _fnGetGroupByName(s) {
    return s;
}

// group name is the first letter of the string
function _fnGetGroupByLetter(s) {
    return s.substr(0, 1);
}

// group name is the year of a given date
function _fnGetGroupByYear(sDate) {
    // Date.parseExact(sDate, properties.sDateFormat).getFullYear() is way to slooooow

    // extract the year from the date string
    if (sDate.length < (iYearIndex + iYearLength))
        return sDate;
    else
        return sDate.substr(iYearIndex, iYearLength);
}

// group name is the "year month" of a given date
function _fnGetGroupByYearMonth(sDate) {
    return sDate.substr(iYearIndex, iYearLength) + ' ' + _getMonthName(sDate.substr(iMonthIndex, iMonthLength));
}

// normalize the group name for use in attributes
function _fnGetCleanedGroup(sGroup) {
    return sGroup.toLowerCase().replace(/[^a-zA-Z0-9\u0080-\uFFFF]+/g, "-"); // fix for unicode characters (Issue 23)
}

// This function compares 'now' to 'prev' and returns a new JavaScript object that contains only
// differences between 'now' and 'prev'. If 'prev' contains members that are missing from 'now',
// those members are *not* returned. 'now' is treated as the master list.
function _fnGetChanges(prev, now) {
    var changes = {};
    var prop = {};
    var c = {};
    // -----

    if (!prev) {
        changes = now;
        return changes;
    }
    for (prop in now) {
        console.log(prop);
        if (prev[prop] !== now[prop]) {
            if (Array.isArray(now[prop])) {
                changes[prop] = now[prop];
            } else if (Object(now[prop]) == now[prop]) {
                c = _fnGetChanges(prev[prop], now[prop]);
                if (!isEmpty(c)) {
                    changes[prop] = c;
                }
            } else {
                changes[prop] = now[prop];
            }
        }
    }

    return changes;
}

function isEmpty(obj) {
    if (obj == null)
        return true;
    if (Array.isArray(obj) || typeof obj == 'string')
        return obj.length === 0;
    for (var key in obj)
        if (Object.prototype.hasOwnProperty(obj, key))
            return false;
    return true;
}




//switch (properties.sGroupBy) {
//case "name":
//  break;
//case "letter":
//
//  /* Create an array with the values of all the input boxes in a column */
//  oTable.fnSettings().aoColumns[properties.iGroupingOrderByColumnIndex].sSortDataType = "rg-letter";
//  $.fn.dataTableExt.afnSortData['rg-letter'] = function (oSettings, iColumn) {
//      var aData = [];
//      $('td:eq(' + iColumn + ')', oSettings.oApi._fnGetTrNodes(oSettings)).each(function () {
//          aData.push(_fnGetGroupByLetter(this.innerHTML));
//      });
//      return aData;
//  }
//  break;
//case "year":
//  /* Create an array with the values of all the input boxes in a column */
//  oTable.fnSettings().aoColumns[properties.iGroupingOrderByColumnIndex].sSortDataType = "rg-date";
//  $.fn.dataTableExt.afnSortData['rg-date'] = function (oSettings, iColumn) {
//      var aData = [];
//      var nTrs = oSettings.oApi._fnGetTrNodes(oSettings);
//      for(i = 0; i< nTrs.length; i++)
//      {
//          aData.push(_fnGetYear( oTable.fnGetData( nTrs[i], iColumn) ));
//      }
//
////      $('td:eq(' + iColumn + ')', oSettings.oApi._fnGetTrNodes(oSettings)).each(function () {
////          aData.push(_fnGetYear(this.innerHTML));
////      });
//
//      return aData;
//  }
//  break;
//default:
//  break;
//
//}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * DataTables plug-in API functions
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


$.fn.dataTableExt.oApi.fnGroupRows = function (oSettings, oOpts, bLoadingState) {
    oSettings.oRowGrouping._fnProcessOpts(oOpts);

    var oTable = oSettings.oInstance;
    var s = oSettings.oRowGrouping.s;

    if (s.iGroupingColumnIndex < 0) {    // just in case
        s.bEnableGrouping = false;
        return;
    }

    // don't install the grouping twice
    for (f = 0; f < oSettings.aoDrawCallback.length; f++) {
        if (oSettings.aoDrawCallback[f].sName == 'fnRowGrouping') {
            return;
        }
    }

    // hide grouping columns if requested - and if we are not loading state
    if (!bLoadingState) {
        if (s.bHideGroupingColumn)
            oTable.fnSetColumnVis(s.iGroupingColumnIndex, false);

        if (s.iGroupingOrderByColumnIndex != -1 && s.bHideGroupingOrderByColumn) {
            oTable.fnSetColumnVis(s.iGroupingOrderByColumnIndex, false);
        }

        if (s.bHideGroupingColumn2 && s.iGroupingColumnIndex2 != -1) {
            oTable.fnSetColumnVis(s.iGroupingColumnIndex2, false);
        }
        if (s.iGroupingOrderByColumnIndex2 != -1 && s.bHideGroupingOrderByColumn2) {
            oTable.fnSetColumnVis(s.iGroupingOrderByColumnIndex2, false);
        }
    }

    s.bEnableGrouping = true;

    // install the draw callback
    oSettings.aoDrawCallback.push({
        "fn": oSettings.oRowGrouping._fnDrawCallBackWithGrouping,
        "sName": "fnRowGrouping"
    });

    // set the fixed sorting, i.e., the grouping itself
    var aaSortingFixed = new Array();

    // first level
    var iOrderByCol = (s.iGroupingOrderByColumnIndex == -1 ? s.iGroupingColumnIndex : s.iGroupingOrderByColumnIndex);
    aaSortingFixed.push([iOrderByCol, s.sGroupingColumnSortDirection]);

    // second level
    if (s.iGroupingColumnIndex2 != -1) {
        iOrderByCol = (s.iGroupingOrderByColumnIndex2 == -1 ? s.iGroupingColumnIndex2 : s.iGroupingOrderByColumnIndex2);
        aaSortingFixed.push([iOrderByCol, s.sGroupingColumnSortDirection2]);
    }

    oSettings.aaSortingFixed = aaSortingFixed;

    // when only expanding a single group, initially expand the first one
    if (s.bExpandSingleGroup) {
        var nTrs = $('tbody tr:first', oTable);
        sGroupData = oTable.fnGetData(nTrs[0], s.iGroupingColumnIndex);

        var sGroup = sGroupData;
        if (s.sGroupBy != "year")
            sGroup = s.fnGetGroup(sGroupData);

        var sGroupCleaned = _fnGetCleanedGroup(sGroup);
        oSettings.oRowGrouping.fnExpandGroup(sGroupCleaned);
    }
    oSettings.oInstance.fnDraw();

    // state is automatically saved
};

$.fn.dataTableExt.oApi.fnUngroupRows = function (oSettings) {
    var s = oSettings.oRowGrouping.s;

    // show all hidden groups again
    var len = s.asCollapsedGroups.length;
    while (len--) {    // iterate in reverse since the array is modified in fnExpandGroups
        oSettings.oRowGrouping.fnExpandGroup(s.asCollapsedGroups[len]);
    }

    // reset internal settings
    s.asCollapsedGroups.length = 0;
    s.aoGroups.length = 0;

    for (f = 0; f < oSettings.aoDrawCallback.length; f++) {
        if (oSettings.aoDrawCallback[f].sName == 'fnRowGrouping') {
            oSettings.aoDrawCallback.splice(f, 1);
            break;
        }
    }

    s.bEnableGrouping = false;

    // TODO: also show other hidden columns: iGroupingColumnIndex, iGroupingColumnIndex2
    // iterate through the aaSortingFixed thing
    if (oSettings.aaSortingFixed != null && oSettings.oRowGrouping.s.bHideGroupingColumn) {
        // show the column that was used for grouping if it was hidden
        oSettings.oInstance.fnSetColumnVis(oSettings.aaSortingFixed[0][0], true);
        oSettings.aaSortingFixed = null;
    }

    oSettings.oInstance.fnDraw();

    // state is automatically saved
};


var RowGrouping = function(oDTSettings, oOpts) {

    if (!this instanceof RowGrouping)
    {
        alert("RowGrouping error: RowGrouping must be initialized with the 'new' keyword.");
        return;
    }

    if (typeof oOpts == 'undefined')
    {
        oOpts = {};
    }

    /**
     * Settings object which contains customizable information for the RowGrouping instance
     * @namespace
     * @extends RowGrouping.oDefaults
     */
    this.s = {
        /**
         * DataTables settings object
         * @type object
         * @default Passed in as first parameter to constructor
         */
        "dt": oDTSettings,

        "fnGetGroup": _fnGetGroupByName,

        // internal: store all groups and all collapsed groups
        "aoGroups": new Array(),
        "asCollapsedGroups": new Array()
    }

    this.s = $.extend(this.s, RowGrouping.oDefaults, oOpts);

    /* Attach the instance to the DataTables instance so it can be accessed */
    this.s.dt.oRowGrouping = this;

    this._fnConstruct();

    /* state loading */
    if (this.s.dt.oLoadedState && typeof this.s.dt.oLoadedState.RowGrouping != 'undefined') {
        oDTSettings.oInstance.fnGroupRows(this.s.dt.oLoadedState.RowGrouping, true);
    } else if (this.s.bEnableGrouping) {
        // if grouping is enabled, group rows immediately
        oDTSettings.oInstance.fnGroupRows();
    }
};

RowGrouping.prototype = {

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Public methods
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Determine if group is collapsed.
     * @param {sGroup} the group name
     * @returns true if group is collapsed, false otherwise
     */
    "fnIsGroupCollapsed" : function (sGroup) {
        if (this.s.aoGroups[sGroup] != null)
            return (this.s.aoGroups[sGroup].state == "collapsed");

        return ($.inArray(sGroup, this.s.asCollapsedGroups) > -1);
    },

    /**
     * Expand group if expandable grouping is used.
     * @param {sGroup} the group name
     */
    "fnExpandGroup" : function (sGroup) {
        var oTable = this.s.dt.oInstance;
        this.s.aoGroups[sGroup].state = "expanded";

        $("td[data-group^='" + sGroup + "']").removeClass("collapsed-group");
        $("td[data-group^='" + sGroup + "']").addClass("expanded-group");

        var index = $.inArray(sGroup, this.s.asCollapsedGroups);
        this.s.asCollapsedGroups.splice(index, 1);

        if (this.s.oShowEffect != null) {
            $(".group-item-" + sGroup, oTable)[this.s.oShowEffect.method]
                (this.s.oShowEffect.duration, this.s.oShowEffect.easing, function () { });
        } else
            $(".group-item-" + sGroup, oTable).show();

        /* Save the state */
        this.s.dt.oInstance.oApi._fnSaveState(this.s.dt);
    },

    /**
     * Collapse group if expandable grouping is used.
     * @param {sGroup} the group name
     */
    "fnCollapseGroup" : function (sGroup) {
        var oTable = this.s.dt.oInstance;
        var that = this;
        this.s.aoGroups[sGroup].state = "collapsed";

        $("td[data-group^='" + sGroup + "']").removeClass("expanded-group");
        $("td[data-group^='" + sGroup + "']").addClass("collapsed-group");

        if ($.inArray(sGroup, this.s.asCollapsedGroups) == -1)
            this.s.asCollapsedGroups.push(sGroup);

        $('.group-item-' + sGroup).each(function () {
            // Issue 24 - Patch provided by Bob Graham.
            if (oTable.fnIsOpen(this)) {
                if (that.s.fnOnRowClosed != null) {
                    that.s.fnOnRowClosed(this);
                }
                oTable.fnClose(this);
            }
        });

        if (this.s.oHideEffect != null) {
            $(".group-item-" + sGroup, oTable)[this.s.oHideEffect.method]
                (this.s.oHideEffect.duration, this.s.oHideEffect.easing, function () { });
        } else
            $(".group-item-" + sGroup, oTable).hide();

        /* Save the state */
        this.s.dt.oInstance.oApi._fnSaveState(this.s.dt);
    },



    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Private methods (they are of course public in JS, but recommended as private)
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Initialization for RowGrouping
     *  @returns {void}
     *  @private
     */
    "_fnConstruct": function ()
    {
        var that = this;

        /* Add a state saving parameter to the DT state saving so we can restore the grouping. */
        this.s.dt.oApi._fnCallbackReg(this.s.dt, 'aoStateSaveParams', function (oS, oData) {
//            var prop;
//            for (prop in RowGrouping.oDefaults) {
//                console.log(prop);
//            }

//            var diff = _fnGetChanges(RowGrouping.oDefaults, that.s);
//            console.log(JSON.stringify(RowGrouping.oDefaults));
//            console.log(JSON.stringify(that.s));
//            console.log(JSON.stringify(diff));

            if (that.s.bEnableGrouping) {
                console.log("save state");
                oData.RowGrouping = {
                    // don't store column visibility, it is saved by the dataTable already

                    "bEnableGrouping": true,
                    "iGroupingColumnIndex": that.s.iGroupingColumnIndex,
                    "bExpandableGrouping": that.s.bExpandableGrouping,
                    "asCollapsedGroups": that.s.asCollapsedGroups
                }
            }
        }, "RowGrouping_State");
    },

    "_fnProcessOpts": function (oOpts)
    {
        if (typeof oOpts == 'undefined') {
            oOpts = {};
        }

        this.s = $.extend(this.s, oOpts);

        // find the month and year positions
        var dateFormat = this.s.sDateFormat.toLowerCase();

        this.s.iYearIndex = dateFormat.indexOf('yy');
        this.s.iYearLength = dateFormat.lastIndexOf('y') - dateFormat.indexOf('y') + 1;

        this.s.iMonthIndex = dateFormat.indexOf('mm');
        this.s.iMonthLength = dateFormat.lastIndexOf('m') - dateFormat.indexOf('m') + 1;

        if (this.s.sGroupingColumnSortDirection == "") {
            if (this.s.sGroupBy == "year")
                this.s.sGroupingColumnSortDirection = "desc";
            else
                this.s.sGroupingColumnSortDirection = "asc";
        }

        if (this.s.sGroupingColumnSortDirection2 == "") {
            if (this.s.sGroupBy2 == "year")
                this.s.sGroupingColumnSortDirection2 = "desc";
            else
                this.s.sGroupingColumnSortDirection2 = "asc";
        }


        switch (this.s.sGroupBy) {
            case "letter":
                this.s.fnGetGroup = _fnGetGroupByLetter;
                break;
            case "year":
                this.s.fnGetGroup = _fnGetGroupByYear;
                break;
            case "month":
                this.s.fnGetGroup = _fnGetGroupByYearMonth;
                break;
            default:
                this.s.fnGetGroup = _fnGetGroupByName;
                break;
        }
    },

    /**
     * Fill the row count placeholder with the given number.
     *  @param {iNumberRowsInGroup} the number of rows
     *  @returns {void}
     *  @private
     */
    "_fnAppendRowCountToGroup" : function (iNumberRowsInGroup) {
        var nCount = $("#data-group-count", this.s.dt.oInstance);
        nCount.removeAttr("id");
        nCount.addClass("data-group-count");
        nCount.html(" (" + iNumberRowsInGroup + ")");
    },

    /**
     * Create a new group header.
     *  @param {sGroup} the string containing the group name
     *  @param {sGroupCleaned} the normalized group name
     *  @param {iColspan} the td colspan
     *  @private
     */
    "_fnCreateGroupRow" : function (sGroupCleaned, sGroup, iColspan) {
        var nGroup = document.createElement('tr');
        var nCell = document.createElement('td');
        nGroup.id = "group-id-" + this.s.dt.oInstance.attr("id") + "_" + sGroupCleaned;

        var oGroup = {
            id: nGroup.id,
            key: sGroupCleaned,
            text: sGroup,
            level: 0,
            groupItemClass: ".group-item-" + sGroupCleaned,
            dataGroup: sGroupCleaned,
            aoSubgroups: new Array()
        };

        if (this.s.bSetGroupingClassOnTR) {
            nGroup.className = this.s.sGroupingClass + " " + sGroupCleaned;
        } else {
            nCell.className = this.s.sGroupingClass + " " + sGroupCleaned;
        }

        nCell.colSpan = iColspan;
        nCell.innerHTML = this.s.sGroupLabelPrefix
                        + this.s.fnGroupLabelFormat(sGroup == "" ? this.s.sEmptyGroupLabel : sGroup, oGroup )
                        + "<span id='data-group-count' />";

        if (this.s.bExpandableGrouping) {
            if (!this.fnIsGroupCollapsed(sGroupCleaned)) {
                nCell.className += " expanded-group";
                oGroup.state = "expanded";
            } else {
                nCell.className += " collapsed-group";
                oGroup.state = "collapsed";
            }

            nCell.className += " group-item-expander";
            $(nCell).attr('data-group', oGroup.dataGroup); // Fix provided by mssskhalsa (Issue 5)
            $(nCell).attr("data-group-level", oGroup.level);
            $(nCell).click(this, this._fnOnGroupClick);
        }

        nGroup.appendChild(nCell);
        this.s.aoGroups[sGroupCleaned] = oGroup;
        oGroup.nGroup = nGroup;

        if (this.s.fnOnGroupCreated != null)
            this.s.fnOnGroupCreated(oGroup, sGroupCleaned, 1);

        return oGroup;
    },

    /**
     * Function that is called when the user clicks on the group cell (td) in order to
     * expand or collapse the group.
     *  @param {e} event object
     *  @private
     */
    "_fnOnGroupClick": function (e) {
        // "this" in here is the td cell, "e.data" holds the rowGrouping instance
        var sGroup = $(this).attr("data-group");
        //var iGroupLevel = $(this).attr("data-group-level"); // no needed right now

        var oTable = e.data.s.dt.oInstance;
        var bIsExpanded = !e.data.fnIsGroupCollapsed(sGroup);
        if (e.data.s.bExpandSingleGroup) {
            if (!bIsExpanded) {
                var sCurrentGroup = $("td.expanded-group").attr("data-group");

                e.data.fnCollapseGroup(sCurrentGroup);
                e.data.fnExpandGroup(sGroup);

                if (e.data.s.iExpandGroupOffset != -1) {
                    var position = $("#group-id-" + oTable.attr("id") + "-" + sGroup).offset().top - e.data.s.iExpandGroupOffset;
                    window.scroll(0, position);
                } else {
                    var position = oTable.offset().top;
                    window.scroll(0, position);
                }
            }
        } else {
            if (bIsExpanded) {
                e.data.fnCollapseGroup(sGroup);
            } else {
                e.data.fnExpandGroup(sGroup);
            }
        }
        e.preventDefault();
    },

    /**
     * The drawing callback that does the actual grouping.
     *  @returns {void}
     *  @private
     */
    "_fnDrawCallBackWithGrouping": function (oSettings) {

        // in here "this" is the table!
        var that = oSettings.oRowGrouping;

        if (that.s.iGroupingColumnIndex == -1) {
            // this shouldn't happen but you never know...
            console.log("warning: probably programming error - no grouping but grouping draw callback called!");
            return;
        }

        var bUseSecondaryGrouping = false;
        if (that.s.iGroupingColumnIndex2 != -1)
            bUseSecondaryGrouping = true;

        // are we displaying any rows at all?
        if (oSettings.aiDisplay.length == 0) { // or use aiDisplayMaster?
            return;
        }

        // all visible rows
        var nTrs = $('> tbody > tr', this);

        // get number of visible columns for colspan
        var iColspan = 0; // nTrs[0].getElementsByTagName('td').length;
        for (var iColIndex = 0; iColIndex < oSettings.aoColumns.length; iColIndex++) {
            if (oSettings.aoColumns[iColIndex].bVisible)
                iColspan++;
        }

        var sLastGroup = null;
        var sLastGroup2 = null;
        var iNumberRowsInGroup = 0;

        for (var i = 0; i < nTrs.length; i++) {

// TODO: not used yet - investigate!
//                var iDisplayIndex = oSettings._iDisplayStart + i;
//                if (oSettings.oFeatures.bServerSide)
//                    iDisplayIndex = i;
            var sGroupData = "";
            var sGroup = null;
            var sGroupData2 = "";
            var sGroup2 = null;

            // get the column with the sorting data for the column iGroupingColumnIndex
            var iDataGroupingColumnIndex = oSettings.aoColumns[that.s.iGroupingColumnIndex].aDataSort[0];

            // Issue 31 - fix provided by Fabien Taysse
            sGroupData = this.fnGetData(nTrs[i], iDataGroupingColumnIndex);

            sGroup = sGroupData;
            if (that.s.sGroupBy != "year")
                sGroup = that.s.fnGetGroup(sGroupData);

            if (bUseSecondaryGrouping) {
                iDataGroupingColumnIndex = oSettings.aoColumns[that.s.iGroupingColumnIndex2].aDataSort[0];
                sGroupData2 = this.fnGetData(nTrs[i], iDataGroupingColumnIndex);

                sGroup2 = sGroupData2;
                if (that.s.sGroupBy2 != "year")
                    sGroup2 = that.s.fnGetGroup(sGroupData2);
            }


            // new group encountered (or first group)
            if (sLastGroup == null || _fnGetCleanedGroup(sGroup) != _fnGetCleanedGroup(sLastGroup)) {
                var sGroupCleaned = _fnGetCleanedGroup(sGroup);

                if (sLastGroup != null)
                {
                    that._fnAppendRowCountToGroup(iNumberRowsInGroup);
                    iNumberRowsInGroup = 0;

                    if (that.s.fnOnGroupCompleted != null)
                        that.s.fnOnGroupCompleted(that.s.aoGroups[_fnGetCleanedGroup(sLastGroup)]);
                }

                // TODO: simplify?
                // when using an accordion initially collapse all groups
                if (that.s.bExpandSingleGroup && $.inArray(sGroupCleaned, that.s.asCollapsedGroups) == -1)
                    that.s.asCollapsedGroups.push(sGroupCleaned);

                var oGroup = that._fnCreateGroupRow(sGroupCleaned, sGroup, iColspan);
                var nGroup = oGroup.nGroup;

                if (nTrs[i].parentNode != null)
                    nTrs[i].parentNode.insertBefore(nGroup, nTrs[i]);
                else
                    $(nTrs[i]).before(nGroup);
                $(nTrs[i]).attr("data-group", oGroup.dataGroup);

                sLastGroup = sGroup;
                sLastGroup2 = null; // to reset second level grouping
            } // end if (sLastGroup == null || sGroup != sLastGroup)

            iNumberRowsInGroup++;

            if (that.s.bExpandableGrouping) {
                $(nTrs[i]).addClass("group-item-" + sGroupCleaned);
                if (that.fnIsGroupCollapsed(sGroupCleaned)) {
                    $(nTrs[i]).hide();
                }
            }

            if (bUseSecondaryGrouping) {

                if (sLastGroup2 == null || _fnGetCleanedGroup(sGroup2) != _fnGetCleanedGroup(sLastGroup2)) {
                    var sGroup2Id = _fnGetCleanedGroup(sGroup) + '-' + _fnGetCleanedGroup(sGroup2);
                    var oGroup2 = that._fnCreateGroup2Row(sGroup2Id, sGroup2, iColspan, that.s.aoGroups[sGroupCleaned])
                    var nGroup2 = oGroup2.nGroup;
                    nTrs[i].parentNode.insertBefore(nGroup2, nTrs[i]);

                    sLastGroup2 = sGroup2;
                }

                $(nTrs[i]).attr("data-group", oGroup2.dataGroup)
                          .addClass("group-item-" + oGroup2.dataGroup);
            } // end if (bUseSecondaryGrouping)

        } // end for (var i = 0; i < nTrs.length; i++)

        that._fnAppendRowCountToGroup(iNumberRowsInGroup);

        if (sLastGroup != null && that.s.fnOnGroupCompleted != null) {
            that.s.fnOnGroupCompleted(that.s.aoGroups[_fnGetCleanedGroup(sLastGroup)]);
        }

        if (that.s.fnOnGrouped != null) {
            that.s.fnOnGrouped(that.s.aoGroups);
        }
    }
};




/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Statics
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


/**
 * RowGrouping default settings for initialization.
 * @namespace
 * @static
 */
RowGrouping.oDefaults = {

    "bEnableGrouping": false,

    /**
     * Date format used for grouping.
     *  @default "dd/MM/yyyy"
     *  @type string
     */
    "sDateFormat": "dd/MM/yyyy",

    /**
     * Label that will be used as group name if the cells of that group are empty.
     *  @default "-"
     *  @type string
     */
    "sEmptyGroupLabel": "-",

    /**
     * If the class for the group row should be assigned the TR element instead
     * of the TD elements within the group TR.
     *  @default false
     *  @type boolean
     */
    "bSetGroupingClassOnTR": false,

    /**
     * Use accordion grouping, i.e., only ever expand at most one group.
     * @default false
     * @type boolean
     */
    "bExpandSingleGroup": false,

    /**
     * Number of pixels to set scroll position above the currently selected group.
     * If -1 scroll will be aligned to the table.
     *  @default 100
     *  @type int
     */
    "iExpandGroupOffset": 100,

    /**
     * A function that will be called when grouping is finished. The function takes no parameters.
     *  @default empty function
     *  @type function
     */
    "fnOnGrouped": null,

    /**
     *  A function that will be called when a new grouping row has been created.
     *  The function takes three parameters:
     *    - oGroup:
     *    - sGroup: group title this row belongs to
     *    - iLevel: grouping level of the row
     *  @default null
     *  @type function
     */
    "fnOnGroupCreated": null,

    /**
     *  A function that will be called when a whole group has been finished.
     *  The function takes three parameters:
     *    - oGroup: the group that has been finished
     *  @default null
     *  @type function
     */
    "fnOnGroupCompleted": null,

    oHideEffect: null, // { method: "hide", duration: "fast", easing: "linear" },
    oShowEffect: null, // { method: "show", duration: "slow", easing: "linear" }




    /**
     * @default false
     * @type boolean
     */
    bUseFilteringForGrouping: false, // This is not used yet (see Jovan's add-on for initial code)



    //*****************************************
    // options for the first level of grouping
    //*****************************************

    /**
     * Index of the column that will be used for grouping.
     *  @default -1 (no grouping)
     *  @type int
     */
    iGroupingColumnIndex: -1,

    /**
     * Sort direction of the group. Can be "desc" or "asc".
     *  @default ""
     *  @type string
     */
    sGroupingColumnSortDirection: "",

    /**
     * Index of the column that will be used for ordering the groups.
     *  @default -1
     *  @type int
     */
    iGroupingOrderByColumnIndex: -1,

    /**
     * CSS class that will be associated with the group row.
     *  @default "group"
     *  @type string
     */
    sGroupingClass: "group",

    /**
     * Hide the column used for grouping once the table is grouped.
     *  @default true
     *  @type boolean
     */
    bHideGroupingColumn: true,

    /**
     * Hide the column used for ordering the groups once the table is grouped.
     *  @default true
     *  @type boolean
     */
    bHideGroupingOrderByColumn: true,

    /**
     * The type of grouping that should be applied.
     * Valid types are "name", "letter", "year".
     *  @default "name"
     *  @type string
     */
    sGroupBy: "name",

    /**
     * A prefix that will be prepended to each group cell.
     *  @default ""
     *  @type string
     */
    sGroupLabelPrefix: "",

    /**
     *  @type function
     */
    fnGroupLabelFormat: function (label) { return label; },

    /**
     * Attach expand/collapse handlers to the grouping rows of the first level.
     *  @default false
     *  @type boolean
     */
    "bExpandableGrouping": false,


    //******************************************
    // options for the second level of grouping
    //******************************************

    /**
     * Index of the secondary column that will be used for grouping.
     *  @default -1 (no grouping)
     *  @type int
     */
    iGroupingColumnIndex2: -1,

    /**
     * Sort direction of the secondary group. Can be "desc" or "asc".
     *  @default ""
     *  @type string
     */
    sGroupingColumnSortDirection2: "",

    /**
     * Index of the column that will be used for ordering the secondary groups.
     *  @default -1
     *  @type int
     */
    iGroupingOrderByColumnIndex2: -1,

    /**
     * CSS class that will be associated with the secondary group row.
     *  @default "subgroup"
     *  @type string
     */
    sGroupingClass2: "subgroup",

    /**
     * Hide the column used for secondary grouping once the table is grouped.
     *  @default true
     *  @type boolean
     */
    bHideGroupingColumn2: true,

    /**
     * Hide the column used for ordering the secondary groups once the table is grouped.
     *  @default true
     *  @type boolean
     */
    bHideGroupingOrderByColumn2: true,

    /**
     * The type of grouping that should be applied to the secondary column.
     * Valid types are "name", "letter", "year".
     *  @default "name"
     *  @type string
     */
    sGroupBy2: "name",

    /**
     * A prefix that will be prepended to each group cell of the secondary groups.
     *  @default ""
     *  @type string
     */
    sGroupLabelPrefix2: "",

    /**
     *  @type function
     */
    fnGroupLabelFormat2: function (label) { return label; },

    /**
     * Attach expand/collapse handlers to the grouping rows of the second level.
     *  @default false
     *  @type boolean
     */
    "bExpandableGrouping2": false
}



/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Constants
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


/**
 * Name of this class
 * @type String
 * @default RowGrouping
 * @static
 */
RowGrouping.prototype.CLASS = "RowGrouping";


/**
 * RowGrouping version
 * @type String
 * @default See code
 * @static
 */
RowGrouping.VERSION = "1.3.0";
RowGrouping.prototype.VERSION = RowGrouping.VERSION;



/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Initialisation
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/*
 * Register a new feature with DataTables. Settings have to be given in the form:
 * $("#table").dataTable( {
 *     "oRowGrouping" : {
 *         .... // row grouping settings
 *     }
 * });
 */
if (typeof $.fn.dataTable == "function"
        && typeof $.fn.dataTableExt.fnVersionCheck == "function"
        && $.fn.dataTableExt.fnVersionCheck('1.9.0')) {
    $.fn.dataTableExt.aoFeatures
            .push({
                "fnInit" : function(oDTSettings) {
                    var init = (typeof oDTSettings.oInit.oRowGrouping == 'undefined') ? {} : oDTSettings.oInit.oRowGrouping;

                    oDTSettings.oInstance._oPluginRowGrouping = new RowGrouping(oDTSettings, init);

                    return null; /* No node for DataTables to insert */
                },
                "cFeature" : "G",
                "sFeature" : "RowGrouping"
            });
} else {
    alert("Warning: RowGrouping requires DataTables 1.9.0 or greater - www.datatables.net/download");
}


// Attach RowGrouping to DataTables so it can be accessed as an 'extra'
$.fn.dataTable.RowGrouping = RowGrouping;


})(jQuery, window, document);


