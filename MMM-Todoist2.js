/* global Module, Log, config, moment, MMMTodoist2List, MMMTodoist2Kanban, MMMTodoist2Calendar */

/* Magic Mirror
 * Module: MMM-Todoist2
 *
 * Managed by Zach Raudebaugh (ZachR19)
 * Fork of MMM-Todoist by Chris Brooker
 *
 * MIT Licensed.
 */

Module.register("MMM-Todoist2", {

	defaults: {
		maximumEntries: 25,                        // Maximum number of tasks to display at once
		filter: "view all",                        // Optional Todoist filter query, leave as "view all" to see all tasks. ref: https://www.todoist.com/help/todoist/features/introduction-to-filters-V98wIH
		updateInterval: 10 * 60 * 1000,            // How often the API is queried, defaults to every 10 minutes
		fade: true,
		fadePoint: 0.25,
		fadeMinimumOpacity: 0.25,

		displayLastUpdate: false,                  // add or not a line after the tasks with the last server update time
		displayLastUpdateFormat: "ddd - HH:mm:ss", // format to display the last update. See Moment.js documentation for all display possibilities
		maxTitleLength: 25,                        // 10 to 50. Value to cut the line if wrapEvents: true
		wrapEvents: false,                         // wrap events to multiple lines breaking at maxTitleLength
		displayTasksWithoutDue: true,              // Set to false to not print tasks without a due date
		displayTasksWithinDays: -1,                // If >= 0, do not print tasks with a due date more than this number of days into the future (e.g., 0 prints today and overdue)
		displaySubtasks: true,                     // set to false to exclude subtasks
		showProject: true,                         // show each task's project under its title (hidden when grouping by project)
		sortOrder: ["todoist"],

		// How the tasks are rendered. Only the files belonging to the chosen
		// display are loaded.
		displayMode: "list",                       // "list", "kanban" or "calendar"

		// List display, used when displayMode is "list"
		groupByProject: false,                     // group the tasks under a heading per project
		maximumEntriesPerProjectGroup: 5,          // max tasks displayed per project group when groupByProject is true
		groupBySection: false,                     // group the tasks under a heading per section. With groupByProject, sections nest inside their project
		maximumEntriesPerSectionGroup: 5,          // max tasks displayed per section group when groupBySection is true
		unsectionedListGroupLabel: "Other",        // heading for tasks outside any section, when grouping by section alone
		showListHeader: true,                      // show the list title and task count. When false, MagicMirror's own module header is used instead
		showListLegend: false,                     // show the priority legend in the list header
		listTitle: null,                           // list title, defaults to the module header or "My Tasks"

		// Kanban display, used when displayMode is "kanban"
		maximumEntriesPerKanbanColumn: 8,          // max tasks displayed per column, the rest are summarised as "+N more"
		kanbanColumnOrder: [],                     // optional section names, in the order the columns should appear. Ex. ["Daily", "Weekly"]
		mergeKanbanColumnsByName: true,            // sections with the same name in different projects share one column
		hideEmptyKanbanColumns: true,              // hide columns that have no tasks to show
		showUnsectionedKanbanColumn: true,         // show tasks that are not in a Todoist section in their own column
		unsectionedKanbanColumnLabel: "Other",     // label for that column
		showKanbanHeader: true,                    // show the board title and task count above the columns
		showKanbanLegend: true,                    // show the priority legend in the board header
		kanbanTitle: null,                         // board title, defaults to the module header or "My Tasks"
		highlightOverdueKanbanTasks: true,         // colour the due date of overdue tasks with the urgent priority colour

		// Calendar display, used when displayMode is "calendar"
		maximumEntriesPerCalendarDay: 3,           // max task chips displayed per day, the rest are summarised as "+N more"
		calendarMonthOffset: 0,                    // months from the current one to display. 0 is this month, 1 is next month
		calendarWeekStartsOn: 0,                   // first column of the grid. 0 is Sunday, 1 is Monday
		calendarAlwaysSixWeeks: true,              // always draw six rows, so the calendar keeps its height from month to month
		highlightTodayInCalendar: true,            // outline today's cell
		showCalendarDayTaskCounts: true,           // show "N tasks" next to the day number
		showCalendarHeader: true,                  // show the title bar above the calendar
		showCalendarLegend: true,                  // show the priority legend in that title bar
		calendarTitle: null,                       // title, defaults to the module header or "My Tasks"

		// This has been designed to use the Todoist Tasks API.
		api_version: "v1",
		api_base: "https://api.todoist.com/api",
		api_tasksEndpoint: "tasks/filter",
		api_sectionsEndpoint: "sections",
		api_projectsEndpoint: "projects",
		api_lang: "en",                            // language filters are written in. Ex. en, de, fr, etc.
		api_cursor: null,                          // holds the current cursor for api pagination
		api_limit: 200,                            // max number of tasks to fetch per request

		todoistResourceType: "[\"items\", \"projects\", \"collaborators\", \"user\", \"labels\"]",

		debug: false,
	},

	// The displays that can render the tasks, and the files each one needs.
	// Only the selected display's files are loaded, alongside the shared
	// MMM-Todoist2-display.{css,js}.
	displays: {
		list: { style: "MMM-Todoist2-list.css", script: "MMM-Todoist2-list.js" },
		kanban: { style: "MMM-Todoist2-kanban.css", script: "MMM-Todoist2-kanban.js" },
		calendar: { style: "MMM-Todoist2-calendar.css", script: "MMM-Todoist2-calendar.js" }
	},

	// Define required styles.
	getStyles: function () {
		var display = this.displays[this.getDisplayMode()];

		return ["MMM-Todoist2.css", "MMM-Todoist2-display.css", display.style];
	},

	// Define required scripts.
	getScripts: function () {
		var display = this.displays[this.getDisplayMode()];

		return ["MMM-Todoist2-display.js", display.script];
	},

	///////
	// The display to render, falling back to the task list when displayMode is
	// missing or not one we know about
	///////
	getDisplayMode: function () {
		var mode = String(this.config.displayMode || "list").trim().toLowerCase();

		return this.displays[mode] ? mode : "list";
	},

	///////
	// The core draws this above the module, and styles it with a rule of its
	// own. The displays carry their own title bar, so the core header is
	// suppressed rather than shown twice; each display still falls back to
	// `data.header` for its own title. A list without its title bar
	// (showListHeader: false) keeps the core header.
	///////
	getHeader: function () {
		if (this.getDisplayMode() === "list" && !this.config.showListHeader)
			return this.data.header;

		return "";
	},

	getTranslations: function () {
		return {
			en: "translations/en.json",
			de: "translations/de.json",
			nb: "translations/nb.json"
		};
	},

	start: function () {
		var self = this;
		Log.info("Starting module: " + this.name);

		this.updateIntervalID = 0;        // Definition of the IntervalID to be able to stop and start it again
		this.ModuleToDoIstHidden = false; // by default it is considered displayed. Note : core function "this.hidden" has strange behaviour, so not used here

		// to display "Loading..." at start-up
		this.title = "Loading...";
		this.loaded = false;

		if (this.config.apiKey === "") {
			Log.error("MMM-Todoist2: apiKey notset!");
			return;
		}

		// A typo here would otherwise fail silently back to the task list
		if (this.config.displayMode && this.getDisplayMode() !== String(this.config.displayMode).trim().toLowerCase())
			Log.warn(this.name + ": unknown displayMode \"" + this.config.displayMode +
				"\", showing the task list. Use \"list\", \"kanban\" or \"calendar\".");

		this.sendSocketNotification("FETCH_TODOIST", this.config);

		//add ID to the setInterval function to be able to stop it later on
		this.updateIntervalID = setInterval(function () {
			self.sendSocketNotification("FETCH_TODOIST", self.config);
		}, this.config.updateInterval);
	},

	///////
	// Called by core system when the module is not displayed anymore on the screen
	///////
	suspend: function () { 
		this.ModuleToDoIstHidden = true;
		//Log.log("Fct suspend - ModuleHidden = " + ModuleHidden);
		this.GestionUpdateIntervalToDoIst();
	},

	///////
	// Called by core system when the module is displayed on the screen
	///////
	resume: function () { 
		this.ModuleToDoIstHidden = false;
		//Log.log("Fct resume - ModuleHidden = " + ModuleHidden);
		this.GestionUpdateIntervalToDoIst();
	},

	///////
	// Called by core system when another module sends a notification
	///////
	notificationReceived: function (notification, payload) {
		// Log.log("notificationReceived: " + notification + " - payload : " + payload);
	},

	// Code from MichMich from default module Calendar : to manage task displayed on several lines
	/**
	 * Shortens a string if it's longer than maxLength and add a ellipsis to the end
	 *
	 * @param {string} string Text string to shorten
	 * @param {number} maxLength The max length of the string
	 * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
	 * @returns {string} The shortened string
	 */
	shorten: function (string, maxLength, wrapEvents) 
	{
		if (typeof string !== "string")
			return "";
	
		if (wrapEvents === true) {
			var temp = "";
			var currentLine = "";
			var words = string.split(" ");

			for (var i = 0; i < words.length; i++)
			{
				var word = words[i];

				// max - 1 to account for a space
				if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) 
					currentLine += (word + " "); 
				else 
				{
					if (currentLine.length > 0)
						temp += (currentLine + "<br>" + word + " ");
					else
						temp += (word + "<br>");

					currentLine = "";
				}
			}

			return (temp + currentLine).trim();
		} 
		else 
		{
			if (maxLength && typeof maxLength === "number" && string.length > maxLength)
				return string.trim().slice(0, maxLength) + "&hellip;";
			else
				return string.trim();
		}
	},

	////////
	// Override socket notification handler.
	// ******** Data sent from the Backend helper. This is the data from the Todoist API ************
	////////
	socketNotificationReceived: function (notification, payload) {
		if (notification === "TASKS") {
			this.filterTodoistData(payload);

			if (this.config.displayLastUpdate) 
			{
				//save the timestamp of the last update to be able to display it
				this.lastUpdate = Date.now() / 1000; 
				Log.log("Todoist update OK, project : " + this.config.projects + " at : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat));
			}

			this.loaded = true;
			this.updateDom(1000);
		} 
		else if (notification === "FETCH_ERROR") 
			Log.error("Todoist Error. Could not fetch todos: " + payload.error);
	},

	filterTodoistData: function (payload) {
		var self = this;
		var items = [];
		var tasks = payload.tasks.results;
		var projects = payload.projects.results;
		var sections = payload.sections.results;
		var collaborators = payload.collaborators;

		if (payload.tasks.apiKey != self.config.apiKey) return;
		if (tasks == undefined) return; 

		tasks.forEach(function (item) {
			item.project    = projects.find(p => p.id === item.project_id);
			item.section    = sections.find(s => s.id === item.section_id);
			item.assignedTo = collaborators.find(c => c.id === item.responsible_uid);
		});

		if (self.config.displayTasksWithinDays > -1 || !self.config.displayTasksWithoutDue) 
		{
			tasks = tasks.filter(function (item) {
				if (item.due === null)
					return self.config.displayTasksWithoutDue;

				var oneDay      = 24 * 60 * 60 * 1000;
				var dueDateTime = self.parseDueDate(item.due.date);
				var dueDate     = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth(), dueDateTime.getDate());
				var now         = new Date();
				var today       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				var diffDays    = Math.floor((dueDate - today) / (oneDay));

				return diffDays <= self.config.displayTasksWithinDays;
			});
		}

		//Filter the Todos by the criteria specified in the Config
		tasks.forEach(function (item) {
			// Ignore sub-tasks
			if (item.parent_id != null && !self.config.displaySubtasks)
				return;

			items.push(item);
		});

		//**** FOR DEBUGGING TO HELP PEOPLE GET THEIR PROJECT IDs */
		if (self.config.debug) {
			console.log("%c *** PROJECT -- ID ***", "background: #222; color: #bada55");
			tasks.forEach(task => {
				console.log("%c" + task.name + " -- " + task.project_id, "background: #222; color: #bada55");
			});
		};
		//****** */

		//Used for ordering by date
		items.forEach(function (item) {
			if (item.due === null) {
				item.due = {};
				item.due["date"] = "2100-12-31";
				item.all_day = true;
			}

			// Used to sort by date.
			item.date = self.parseDueDate(item.due.date);

			// as v8 API does not have 'all_day' field anymore then check due.date for presence of time
			// if due.date has a time then set item.all_day to false else all_day is true
			if (item.due.date.length > 10)
				item.all_day = false;
			else
				item.all_day = true;
		});

		//***** Sorting code if you want to add new methods. */
		// Multi-level sorting using sortOrder array
		function getComparator(type) {
			switch (type) {
				case "todoist":
					return self.sortByTodoistComparator;
				case "project":
					return self.sortByProjectComparator;
				case "priority":
					return self.sortByPriorityComparator;
				case "dueDateAsc":
					return self.sortByDueDateAscComparator;
				case "dueDateDesc":
					return self.sortByDueDateDescComparator;
				default:
					return function() { return 0; };
			}
		}

		// Sort by the specified sort types using their comparator functions
		var sortTypes = Array.isArray(self.config.sortOrder) ? self.config.sortOrder : [self.config.sortOrder];
		items.sort(function(a, b) {
			for (var i = 0; i < sortTypes.length; i++) {
				var cmp = getComparator(sortTypes[i])(a, b);

				if (cmp !== 0) 
					return cmp;
			}
			return 0;
		});

		//Slice by max Entries
		this.items = items.slice(0, this.config.maximumEntries);
	},


	/*
	 * The Todoist API returns task due dates as strings in these two formats: YYYY-MM-DD and YYYY-MM-DDThh:mm:ss
	 * This depends on whether a task only has a due day or a due day and time. You cannot pass this date string into
	 * "new Date()" - it is inconsistent. In one format, the date string is considered to be in UTC, the other in the
	 * local timezone. Additionally, if the task's due date has a timezone set, it is given in UTC (zulu format),
	 * otherwise it is local time. The parseDueDate function keeps Dates consistent by interpreting them all relative
	 * to the same timezone.
	 */
	parseDueDate: function (date) {
		let [year, month, day, hour = 0, minute = 0, second = 0] = date.split(/\D/).map(Number);

		// If the task's due date has a timezone set (as opposed to the default floating timezone), it's given in UTC time.
		if (date[date.length -1] === "Z")
			return new Date(Date.UTC(year, month - 1, day, hour, minute, second));

		return new Date(year, month - 1, day, hour, minute, second);
	},

	sortByTodoistComparator: function(a, b) {

		// neither have parent_id so both are parent tasks, sort by their id
		if (!a.parent_id && !b.parent_id) 
			return a.id - b.id;

		// both are children of the same parent task, sort by child order
		else if (a.parent_id === b.parent_id)
			return a.child_order - b.child_order;

		// a is a child of b, so it goes after b
		else if (a.parent_id === b.id) 
			return 1;

		// b is a child of a, so it goes after a
		else if (b.parent_id === a.id) 
			return -1;

		// a is a parent task, b is a child (but not of a), so compare a to b's parent
		else if (!a.parent_id) 
			return a.id - b.parent_id;
		
		// b is a parent task, a is a child (but not of b), so compare b to a's parent
		else if (!b.parent_id) 
			return a.parent_id - b.id;

		// both are child tasks, but with different parents so sort by their parents
		else
			return a.parent_id - b.parent_id;

	},

	sortByProjectComparator: function(a, b) {
		return a.project_id.localeCompare(b.project_id);
	},

	sortByPriorityComparator: function(a, b) {
		return b.priority - a.priority;
	},

	sortByDueDateAscComparator: function(a, b) {
		return a.date - b.date;
	},

	sortByDueDateDescComparator: function(a, b) {
		return b.date - a.date;
	},


	///////////////////////////////////////////////
	// UI METHODS BELOW
	///////////////////////////////////////////////

	getDom: function () {
		if (this.config.hideWhenEmpty && this.items != null && this.items.length === 0)
			return null;
	
		//Add a new div to be able to display the update time alone after all the task
		var wrapper = document.createElement("div");

		//display "loading..." if not loaded
		if (!this.loaded) 
		{
			wrapper.innerHTML = "Loading...";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.items === undefined)
			return wrapper;

		// The display renders the tasks, then everything that follows them
		// (last update time, debug output) is appended
		switch (this.getDisplayMode()) {
			case "kanban":
				wrapper.appendChild(MMMTodoist2Kanban.render(this, this.items));
				break;
			case "calendar":
				wrapper.appendChild(MMMTodoist2Calendar.render(this, this.items));
				break;
			default:
				wrapper.appendChild(MMMTodoist2List.render(this, this.items));
				break;
		}

		this.appendFooter(wrapper);

		return wrapper;
	},

	///////
	// Appends everything that follows the tasks themselves, so that every
	// display shows it
	///////
	appendFooter: function (wrapper) {
		// display the update time at the end, if defined so by the user config
		if (this.config.displayLastUpdate) 
		{
			var updateinfo = document.createElement("div");
			updateinfo.className = "xsmall light align-left";
			updateinfo.innerHTML = "Last Update : " + moment.unix(this.lastUpdate).format(this.config.displayLastUpdateFormat);
			wrapper.appendChild(updateinfo);
		}

		//**** FOR DEBUGGING TO HELP PEOPLE GET THEIR PROJECT IDs - (People who can't see console) */
		if (this.config.debug) 
		{
			var projectsids = document.createElement("div");
			projectsids.className = "xsmall light align-left";
			projectsids.innerHTML = "<span>*** PROJECT - ID ***</span><br />";
			
			const uniqueProjects = this.items
				.flatMap((task) => task.project || [])
				.reduce((unique, project) => {
					if (!unique.find((c) => c.id === project.id))
						unique.push(project);
			
					return unique;
				}, []);

			uniqueProjects.forEach(project => {
				projectsids.innerHTML += "<span>" + project.name + " - " + project.id + "</span><br />";
			});

			wrapper.appendChild(projectsids);
		};
		//****** */
	}
});
