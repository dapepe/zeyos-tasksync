(function() {
	try {
		// Load libraries
		var querystring = require('querystring');
		var request     = require('request');
		var path        = require('path');
		var fs          = require('fs');
		var util        = require('util');
		var nopt        = require('nopt');
		var read        = require('read');
		var Table       = require('cli-table');
		var prettyjson  = require('prettyjson');
		var Stream      = require('stream').Stream;

		var AppName    = 'ZeyOS TaskSync client';  // Application name
		var AppBin     = 'zeyos-tasksync';         // Application executable
		var AppVersion = '1.0.0';                  // The required API version
		var AppConfig  = 'tasksync.json';          // Default configuration fiel

		var ApiDoc;         // {object} The current API documentation
		var ApiName;        // {string} The API name (e.g. project, user, etc.)
		var ApiTask;        // {string} The API task
		var ApiParams;      // {array}  Additional CLI parameters
		var ApiDefinition;  // {object} API definition

		// Default CLI options and short hands
		var CliParams = [
			{
				'name': 'help',
				'type': 'boolean',
				'description': 'Show help'
			},
			{
				'name': 'config',
				'type': 'string',
				'description': 'Configuration file'
			},
			{
				'name': 'username',
				'type': 'string',
				'description': 'User name',
				'input': 'text'
			},
			{
				'name': 'password',
				'type': 'string',
				'description': 'User password',
				'input': 'hidden'
			},
			{
				'name': 'host',
				'type': 'string',
				'description': 'ZeyOS instance ID or host URL'
			},
			{
				'name': 'file',
				'type': 'string',
				'description': 'Output filename'
			}
		];
		var CliInputs = {};

		var CliShortcuts = {
			'c': ['--config'],
			'h': ['--help'],
			'f': ['--file']
		}

		// Get the API definition
		function initialize() {
			fs.readFile(path.join(path.dirname(fs.realpathSync(__filename)), 'api.json'), 'utf8', function (err, json) {
				ApiDoc = JSON.parse(json);
				initOptions();
				console.log();
			});
		}

		/**
		 * Initialize an option type
		 *
		 * @param  {mixed} t
		 * @return {mixed}
		 */
		function getParamType(t) {
			if (t == undefined)
				return String;

			if (typeof t != 'string')
				return t;

			switch (t.toLowerCase()) {
				case 'string':
					return String;
				case 'bool':
				case 'boolean':
					return Boolean;
				case 'int':
				case 'integer':
				case 'num':
				case 'numeric':
				case 'float':
					return Number;
				case 'object':
					return Object;
				case 'array':
					return Array;
				default:
					return String;
			}
		}

		/**
		 * Get the API options from the DOC object
		 *
		 * @param  {string} api
		 * @param  {string} task
		 * @return {object}
		 */
		function getApiOptions(api, task) {
			try {
				if (ApiDoc.data == null)
					throw 'Invalid API documentation file.';

				if (ApiDoc.data[api] == null)
					throw 'Unknown API: ' + api;

				var opts = false;
				ApiDoc.data[api].forEach(function(cmd) {
					if (cmd.cmd == task) {
						opts = cmd;
						return;
					}
				});

				if (opts)
					return opts;

				throw 'Unknown task: ' + api + ' -> ' + task;
			} catch (e) {
				console.log();
				console.log('Failed to initialize API options - ' + e);
				console.log('Use "--help" to get general help and a list of all API classes');
				console.log('Use "--help {API}" to get a list of all API tasks.')
				return false;
			}
		}

		/**
		 * Build the option list from the definition object
		 *
		 * @param {array}
		 * @return {object} Parameter list
		 */
		function getParamList(opts) {
			var r = {};
			opts.forEach(function(opt) {
				if (opt.name == null)
					return;

				r[opt.name] = getParamType(opt['type']);
			});

			return r;
		}

		/**
		 * Initialize the CLI Options
		 *
		 * @return void
		 */
		function initOptions() {
			try {
				var argsDefault = getParamList(CliParams);
				var opts  = nopt(argsDefault, CliShortcuts, process.argv, 2);

				ApiTask = opts.argv.remain.pop();
				ApiName = opts.argv.remain.pop();

				// Display CLI help
				if (opts.help) {
					showCliHelp();
					return;
				}

				if (typeof ApiName != 'string')
					throw 'No API specified';
				if (typeof ApiTask != 'string')
					throw 'No task specified';

				// Task definition
				ApiDefinition = getApiOptions(ApiName, ApiTask);
				ApiParams  = ApiDefinition.param == null ? [] : ApiDefinition.param
				var argsApi = getParamList(ApiParams);

				// Read the options from a config file
				if (AppConfig != false && !opts.config && fs.existsSync(AppConfig))
					opts.config = AppConfig;
				if (opts.config) {
					if (!fs.existsSync(opts.config))
						throw 'Config file does not exist: ' + opts.config;

					// TODO
					// options = JSON.parse(fs.readFile(opts.config));
				}

				var args = {};

				// Merge the required configs
				Object.keys(argsApi).forEach(function(key) {
					args[key] = argsApi[key];
				});
				Object.keys(argsDefault).forEach(function(key) {
					args[key] = argsDefault[key];
				});

				// Validate the options
				var missing = [];
				var params  = {};
				var opts = nopt(args, CliShortcuts, process.argv, 2);
				[CliParams, ApiParams].forEach(function(d) {
					d.forEach(function(p) {
						if (opts[p.name] != null)
							params[p.name] = opts[p.name];
						else if (p.optional === false && p.input != null)
							missing.push(p);

						if (p.input != null)
							CliInputs[p.name] = p;
					});
				})

				if (missing.length > 0) {
					listParams('The following parameters are missing', missing);
					console.log();
					console.log('Type --help to see more details')
					return;
				}

				if (ApiDefinition.method == null)
					ApiDefinition.method = 'POST';

				ApiDefinition.method = ApiDefinition.method.toUpperCase();
				switch (ApiDefinition.method) {
					case 'GET':
					case 'PUT':
					case 'DELETE':
						break;
					default:
						ApiDefinition.method = 'POST';
						break;
				}

				execRequest(params, ApiDefinition);

			} catch (e) {
				console.log();
				console.log('Failed to initialize options - ' + e);
				console.log();
				showCliHelp();
			}
		}

		/**
		 * Execute the API request
		 *
		 * @param {object} params Call params
		 * @param {object} def API definition
		 * @return {[type]} [description]
		 */
		function execRequest(params, def) {
			try {
				// Promt the user for
				for (var key in CliInputs) {
					if (params[key] == null) {
						read({prompt: CliInputs[key].description + ' <' + key + '>: ', 'silent': CliInputs[key].input == 'hidden'}, function(er, input) {
							params[key] = input;
							execRequest(params, def);
						});
						return;
					}
				}

				console.log(params, def);return;

				var filename = false;
				if (params.file) {
					filename = params.file;
					delete params.file;
				}

				// Initialize the call parameters
				var callparams = {
					'uri':    apiurl,
					'method': def.method
				};
				switch (def.method) {
					case 'GET':
					case 'DELETE':
						callparams.uri += '?' + querystring.stringify(params);
						break;
					case 'POST':
					case 'PUT':
						callparams.form = params;
						break;
				}

				// console.log(callparams);return;

				// Perform the HTTP request
				request(callparams, function(err, response, body) {
					if (err) throw err;

					if (filename) {
						fs.writeFile(filename, body, function (err) {
						if (err) throw err;
							console.log('Output written to ' + filename);
						});
					} else {
						console.log(body);
						// console.log(prettyjson.render(data));
						/*
						table
						pretty
						success
						 */
					}
				});
			} catch(e) {
				console.log('Failed to execute API call - ' + e);
			}
		}

		/**
		 * Displays a parameter list
		 *
		 * @param  {string} title
		 * @param  {array} params
		 */
		function listParams(title, params) {
			console.log();
			console.log(title+':');
			console.log();
			var len = 0;
			var lines = [];
			params.forEach(function(opt) {
				var l = opt.name + (opt.optional === false ? '*' : '') + ' {' + opt['type'] + '}';
				if (l.length > len)
					len = l.length;
				lines.push([l, opt.description]);
			});
			lines.forEach(function(line) {
				console.log('	' + line[0] + Array(len - line[0].length + 3).join(' ') + ': ' + line[1]);
			});
		}

		/**
		 * Display the help dialog
		 *
		 * @return void
		 */
		function showCliHelp() {
			console.log(AppName + ' (Version: ' + AppVersion + ')');
			console.log();
			console.log('USAGE:');
			console.log();
			console.log('	' + AppBin + ' [OPTIONS] API TASK');

			if (ApiName == null && ApiTask != null) {
				console.log();
				showApiHelp(ApiTask);
				return;
			} else if (ApiName != null && ApiTask != null) {
				var def = getApiOptions(ApiName, ApiTask);
				if (def) {
					console.log();
					console.log('Help for ' + ApiName + ' -> ' + ApiTask);
					console.log();
					if (def.description != null)
						console.log('	' + def.description);
					if (def.method != null)
						console.log('	Request method: ' + def.method);
					if (def['return'] != null)
						console.log('	Return {' + def['return']['type'] + '} ' + (def['return']['description'] != null ? def['return']['description'] : ''))
					if (def.param != null)
						listParams('Call parameters', def.param)
				}
				return;
			}

			listParams('General parameters', CliParams);

			console.log();
			showApiHelp();
		}

		/**
		 * Displays API help
		 *
		 * @param  {string|null} api The API name
		 */
		function showApiHelp(api) {
			if (api != null && ApiDoc.data[api] == null) {
				console.log('Unknown API: ' + api);
				console.log();
				api = null;
			}
			if (api == null) {
				console.log('Available API classes:');
				Object.keys(ApiDoc.data).forEach(function(a) {
					console.log('	* ' + a);
				});
				return;
			}

			console.log('Showing API tasks for: ' + api);
			console.log();
			var table = new Table({
				head: ['Task', 'Method', 'Description', 'Returns']
			});

			ApiDoc.data[api].forEach(function(cmd) {
				table.push([
					cmd.cmd,
					(cmd.method != null ? cmd.method : 'any').toUpperCase(),
					cmd.description != null ? cmd.description : '-',
					cmd['return'] != null && cmd['return']['type'] != null ? cmd['return']['type'] : '-'
				]);
			});
			console.log(table.toString());
		}

		initialize();

	} catch(e) {
		console.log('ERROR', e);
	}
}).call(this);
