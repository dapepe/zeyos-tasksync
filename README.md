ZeyOS TaskSync CLI
==================

[![NPM](https://nodei.co/npm/zeyos-tasksync.png)](https://nodei.co/npm/zeyos-tasksync/)

Purpose
-------

Sometimes a good, old fashioned text file is simply more conventient for fast editing than
a web interface. For this reason, I created this simple CLI tool in order to import/export
all my tasks from ZeyOS into a YAML file for fast editing.


Installation
------------

Simply install as global package via NPM:

```
npm install -g zeyos-tasksync
```

On ZeyOS, make sure that you install the Task Editor API (net.zeyon.task.textedit).


Usage
-----

### Export tasks ###

```
zeyos-tasksync export [filename.yml] -orderby={string} -assigneduser={string} -project={string} -priority={string} -search={string}
```


### Import tasks ###

```
zeyos-tasksync import filename.yml
```


Options
-------

### General options ###

| Parameter | shortcut |         Description         |
| --------- | -------- | --------------------------- |
| help      | -h       | The name of the applicaiton |
| config    | -c       | Config file                 |
| username  |          | ZeyOS Username              |
| password  |          | Password                    |
| host      |          | ZeyOS instance name or URL  |


### Export options ###

| Parameter |   Description   |                             Value                             |
| --------- | --------------- | ------------------------------------------------------------- |
| orderby   | Order by clause | [duedate, tasknum, status, priority, progress, project, name] |
| priority  | Priority filter | [lowest, low, medium, high, highest]                          |
| project   | Project filter  | Project name                                                  |
| user      | Assigned user   | Assigned user name                                            |
| category  | Tag or category | Tag name                                                      |
| search    | Search query    | Query string (applies to task name and project name)          |

