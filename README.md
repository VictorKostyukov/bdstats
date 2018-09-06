# Drive Statistics and Dashboard

This project shows an example on how to consume and analyze the host announcement logs from Kademlia directory service. The result will be shown as a dashboard page.

## Prerequisite

- NodeJS v8.10.0+
- NPM
- MongoDB v3.6.3+

The project has been verified on Ubuntu 18. These prerequisites can be installed as below:

```bash
sudo apt-get install nodejs npm mongodb
```

To install any NodeJS dependencies, run `npm install` in the corresponding folder which contains `package.json`.

## Analyzer

The analyzer code resides in `src/bin`. It queries the host announcement logs from Kademlia service, stores them in the local MongoDB datebase, and create aggregated analysis data in it.

A daily script is provided as `src/bin/daily_analyze.sh` which can be used as a crontab job to run every day.

## Dashboard

Dashboard project resides in `src/web`. Make sure `npm install` has run once to install any dependencies there. Then run the following command to start the web server:

```bash
node index.js
```

Then the dashboard page can be accessed from http://HostnameOrIP:7900.
