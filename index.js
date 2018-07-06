#!/usr/bin/env node
const _ = require("lodash");
const capitano = require("capitano");
const semver = require("resin-semver");
const moment = require("moment");
const config = require("config");
const chalk = require("chalk");
var jsonfile = require("jsonfile");
var PinejsClient = require("pinejs-client");

const DAYS_AGO = 14;
const HIGHLIGHT_COUNT = 30;

const env = require("get-env")({
  staging: "staging",
  production: "production",
  devenv: "devenv"
});

const authToken = config.get("authToken");
const resinApi = new PinejsClient(`${config.get("apiEndpoint")}/v4/`);

var getDevices = async () => {
  const now = moment();
  const before = now
    .clone()
    .subtract(DAYS_AGO, "days")
    .startOf("day");

  console.log(`Non-MC devices provisioned between ${before} - ${now}\n`);

  const stuff = await resinApi.get({
    resource: "application",
    passthrough: {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    },
    options: {
      $filter: {
        owns__device: {
          $any: {
            $alias: "device",
            $expr: {
              created_at: {
                $gt: before.toISOString()
              }
            }
          }
        }
      },
      $select: ["id", "app_name"],
      $expand: [
        {
          owns__device: {
            $select: ["os_version"],
            $filter: {
              created_at: {
                $gt: before.toISOString()
              }
            }
          }
        },
        { user: { $select: ["username"] } }
      ]
    }
  });

  const total = _.map(stuff, app => {
    const devices = _.filter(app.owns__device, device => {
      version = semver.parse(device.os_version);
      return semver.lt(device.os_version, "2.12.0");
    });
    if (devices.length > 0) {
      // console.log(devices);
      const versions = _.map(devices, device => {
        const version = semver.parse(device.os_version)
          ? semver.parse(device.os_version).version
          : "Unknown";
        return version;
      });
      const counts = _.countBy(versions);
      const keys = _.keys(counts);
      const sorted_keys = keys.sort(semver.rcompare);
      const vers = _.map(sorted_keys, key => {
        return { version: key, count: counts[key] };
      });
      // console.log(vers)
      const result = {
        app_name: app.app_name,
        id: app.id,
        user: app.user[0].username,
        devices: vers,
        total_count: _.sumBy(vers, o => {
          return o.count;
        })
      };
      return result;
    } else {
      return null;
    }
  });
  const total2 = _.filter(total, o => {
    return o;
  });
  const total3 = _.sortBy(total2, "total_count").reverse();

  _.each(total3, app => {
    console.log(
      chalk.bold(app.app_name) + ` (id: ${app.id}, user: ${app.user})`
    );
    _.each(app.devices, version => {
      const message = `\t${version.version.padEnd(10)}: ${version.count}`;
      const line =
        version.count >= HIGHLIGHT_COUNT ? chalk.bgRed.bold(message) : message;
      console.log(line);
    });
    const message = `\t${"Total".padEnd(10)}: ${app.total_count}`;
    const line =
      app.total_count > HIGHLIGHT_COUNT
        ? chalk.bgRedBright.bold(message)
        : chalk.bold(message);
    console.log(line);
    console.log();
  });
};

getDevices();
