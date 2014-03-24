var path   = require('path');
var fs     = require('fs');
var yaml   = require('js-yaml');
var Table  = require('cli-table');
var ApiCli = require('api-cli');

var doc = JSON.parse(
	fs.readFileSync(path.join(path.dirname(fs.realpathSync(__filename)), '..', 'lib', 'api.json'))
);

var app = new ApiCli({
	AppName      : 'ZeyOS TaskSync Client',  // {string} Application name
	AppBin       : 'zeyos-tasksync',         // {string} Application executable
	AppVersion   : '1.0.0',                  // {string} The required API version

	ApiDoc       : doc,                      // {object} The API definition object
	ApiName      : 'tasks',                  // {string} The API name (e.g. project, user, etc.)
	ApiTask      : null,                     // {string} The API task
	ApiParams    : null,                     // {array}  Additional CLI parameters
	ApiDefinition: null,                     // {object} API definition

	CliParams: [                             // {array}  Default CLI options and short hands
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
			'description': 'ZeyOS instance ID or host URL',
			'input': 'text'
		}
	],
	CliInputs: {},
	CliShortcuts: {
		'c': ['--config'],
		'h': ['--help']
	},
	execute: function() {
		this.filename = this.CliArgs.pop();

		if (this.CliOptions.host.substr(0, 4) == 'http')
			this.ApiDoc.url = this.CliOptions.host;
		else
			this.ApiDoc.url = 'https://cloud.zeyos.com/' + this.CliOptions.host + '/remotecall/net.zeyon.task.textedit-' + this.ApiDoc.version + '.api';

		// Load the import file
		if (this.ApiTask == 'import') {
			if (this.filename == null)
				throw 'No import file specified!';
			if (!fs.existsSync(this.filename))
				throw 'Import file does not exists: ' + this.filename;

			this.CliOptions.data = yaml.safeLoad(fs.readFileSync(this.filename, 'utf8'));
		}

		this._execRequest();
	},
	evalResponse: function(err, response, body) {
		if (err) throw err;

		if (body == '')
			throw 'No result: Probably you did not install the TaskSync API on your ZeyOS system?';

		var res = JSON.parse(body);
		if (typeof res != 'object')
			throw 'Invalid result type! Object expected';
		if (res['error'] != null)
			throw 'Server error: ' + res['error'];
		if (res.result == null)
			throw 'Invalid result';

		function cellValue(v) {
			return (v == '' || v == null) ? '-' : v;
		}

		switch (this.ApiTask) {
			case 'export':
				if (this.filename != null) {
					var c = yaml.safeDump(res.result);
					fs.writeFile(this.filename, c, function(err) {
						if (err) throw err;
						console.log('Tasks written');
					});
				} else {
					var table = new Table({
						head: [
							'Name',
							'No.',
							'User',
							'Due date',
							'Priority',
							'Project'
						]
					});
					res.result.forEach(function(task) {
						table.push([
							task.name,
							cellValue(task.tasknum),
							cellValue(task.assigneduser),
							cellValue(task.duedate),
							cellValue(task.priority),
							cellValue(task.project)
						]);
					});
					console.log(table.toString());
				}
				break;
			case 'import':
				var table = new Table({
					head: [
						'Name',
						'No.',
						'State',
						'Changes'
					]
				});

				if (res.result.length == 0) {
					console.log('No changes recognized!')
					return;
				}

				console.log(res.result.length + ' tasks updated/created:');
				console.log();
				res.result.forEach(function(task) {
					table.push([
						task.name,
						cellValue(task.tasknum),
						task.state,
						task.changes
					]);
				});
				console.log(table.toString());
				break;
		}
		return;

		console.log(res);
	}
});
app.run();
