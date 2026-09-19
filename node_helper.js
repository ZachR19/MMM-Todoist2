"use strict";

/* Magic Mirror
 * Module: MMM-Todoist
 *
 * Managed by Zach Raudebaugh (ZachR19)
 * Fork of MMM-Todoist by Chris Brooker
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const request = require("request");
const showdown = require("showdown");

const markdown = new showdown.Converter();

module.exports = NodeHelper.create({
	start: function() {
		console.log("Starting node helper for: " + this.name);
	},

	socketNotificationReceived: async function(notification, payload) {
		const self = this;

		if (notification === "FETCH_TODOIST") 
		{
			this.config = payload;
			var tasks = await this.fetchTasks();
			var projects = await this.fetchProjects();
			var sections = await this.fetchSections();

			const allCollaborators = await Promise.all(
				projects.results.map((project) => this.fetchCollaborators(project.id))
			);
			
			const uniqueCollaborators = allCollaborators
				.flatMap((response) => response.results || [])
				.reduce((unique, collab) => {
					if (!unique.find((c) => c.id === collab.id))
						unique.push(collab);
			
					return unique;
				}, []);

			var result = {
				"tasks": tasks,
				"projects": projects,
				"sections": sections,
				"collaborators": uniqueCollaborators
			}

			self.sendSocketNotification("TASKS", result);
		}
	},


	async fetchTasks() {
		const self = this;
		const allResults = [];
		let cursor = self.config.api_cursor || null;

		try {
			while (true) {
				const params = new URLSearchParams({
					query: self.config.filter,
					lang: self.config.api_lang,
					limit: self.config.api_limit
				});

				if (cursor != null)
					params.append("cursor", cursor);

				const url = `${self.config.api_base}/${self.config.api_version}/${self.config.api_tasksEndpoint}/?${params}`;

				const response = await fetch(url, {
					headers: {
						"cache-control": "no-cache",
						"Authorization": `Bearer ${self.config.apiKey}`
					}
				});

				const body = await response.text();

				if (self.config.debug)
					console.log(body);

				if (!response.ok)
				{
					console.log(`Todoist api tasks request status=${response.status}`);
					return;
				}

				const tasks = JSON.parse(body);

				tasks.results.forEach((item) => {
					item.contentHtml = markdown.makeHtml(item.content);
					allResults.push(item);
				});

				cursor = tasks.next_cursor;
				if (cursor == null)
					break;
			}

			self.config.api_cursor = cursor;
			return {
				results: allResults,
				apiKey: self.config.apiKey
			};
		}
		catch (error)
		{
			self.sendSocketNotification("FETCH_ERROR", { error: error.message });
			console.error(" ERROR - MMM-Todoist2: " + error);
			return null;
		}
	},

	async fetchProjects() {
		const self = this;
		const allResults = [];
		let cursor = self.config.api_cursor || null;

		try {
			while (true) {
				const params = new URLSearchParams({
					limit: self.config.api_limit
				});

				if (cursor != null)
					params.append("cursor", cursor);

				const url = `${self.config.api_base}/${self.config.api_version}/${self.config.api_projectsEndpoint}/?${params}`;

				const response = await fetch(url, {
					headers: {
						"cache-control": "no-cache",
						"Authorization": `Bearer ${self.config.apiKey}`
					}
				});

				const body = await response.text();

				if (self.config.debug)
					console.log(body);

				if (!response.ok)
				{
					console.log(`Todoist api project request status=${response.status}`);
					return;
				}

				const projects = JSON.parse(body);

				projects.results.forEach((item) => {
					allResults.push(item);
				});

				cursor = projects.next_cursor;
				if (cursor == null)
					break;
			}

			self.config.api_cursor = cursor;
			return { results: allResults };
		}
		catch (error)
		{
			self.sendSocketNotification("FETCH_ERROR", { error: error.message });
			console.error(" ERROR - MMM-Todoist2: " + error);
			return null;
		}
	},

	async fetchSections() {
		const self = this;
		const allResults = [];
		let cursor = self.config.api_cursor || null;

		try {
			while (true) {
				const params = new URLSearchParams({
					limit: self.config.api_limit
				});

				if (cursor != null)
					params.append("cursor", cursor);

				const url = `${self.config.api_base}/${self.config.api_version}/${self.config.api_sectionsEndpoint}/?${params}`;

				const response = await fetch(url, {
					headers: {
						"cache-control": "no-cache",
						"Authorization": `Bearer ${self.config.apiKey}`
					}
				});

				const body = await response.text();

				if (self.config.debug)
					console.log(body);

				if (!response.ok)
				{
					console.log(`Todoist api section request status=${response.status}`);
					return;
				}

				const sections = JSON.parse(body);

				sections.results.forEach((item) => {
					allResults.push(item);
				});

				cursor = sections.next_cursor;
				if (cursor == null)
					break;
			}

			self.config.api_cursor = cursor;
			return { results: allResults };
		}
		catch (error)
		{
			self.sendSocketNotification("FETCH_ERROR", { error: error.message });
			console.error(" ERROR - MMM-Todoist2: " + error);
			return null;
		}
	},

	async fetchCollaborators(projectId) {
		const self = this;
		const allResults = [];
		let cursor = null;

		try {
			while (true) {
				const params = new URLSearchParams({
					limit: self.config.api_limit
				});

				if (cursor != null)
					params.append("cursor", cursor);

				const url = `${self.config.api_base}/${self.config.api_version}/${self.config.api_projectsEndpoint}/${projectId}/collaborators/?${params}`;

				const response = await fetch(url, {
					headers: {
						"cache-control": "no-cache",
						"Authorization": `Bearer ${self.config.apiKey}`
					}
				});

				const body = await response.text();

				if (self.config.debug)
					console.log(body);

				if (!response.ok)
				{
					console.log(`Todoist api project collaborators request status=${response.status}`);
					return;
				}

				const collaborators = JSON.parse(body);

				collaborators.results.forEach((item) => {
					allResults.push(item);
				});

				cursor = collaborators.next_cursor;
				if (cursor == null)
					break;
			}

			return { results: allResults };
		}
		catch (error)
		{
			self.sendSocketNotification("FETCH_ERROR", { error: error.message });
			console.error(" ERROR - MMM-Todoist2: " + error);
			return null;
		}
	}
});