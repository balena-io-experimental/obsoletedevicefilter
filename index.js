#!/usr/bin/env node
const _ = require("lodash");
const capitano = require("capitano");
const semver = require("resin-semver");
const moment = require("moment");
const config = require("config");
var jsonfile = require("jsonfile");
var PinejsClient = require("pinejs-client");

const env = require("get-env")({
  staging: "staging",
  production: "production",
  devenv: "devenv"
});

const authToken = config.get("authToken");
const resinApi = new PinejsClient(`${config.get("apiEndpoint")}/v4/`);
console.log(config.get("apiEndpoint"));
console.log(`Bearer ${authToken}`);

var getDevices = async () => {
  const before = moment()
    .subtract(14, "days")
    .startOf("day");

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
        { owns__device: { $select: ["os_version"] } },
        { user: { $select: ["username"] } }
      ]
    }
  });

  // console.log(stuff);
  // _.each(stuff, app => {
  //   console.log(app.user);
  //   console.log(app.owns__device);
  // });

  const total = _.map(stuff, app => {
    const devices = _.filter(app.owns__device, device => {
      version = semver.parse(device.os_version);
      return semver.lt(device.os_version, "2.12.0");
    });
    if (devices.length > 0) {
      console.log(app.app_name);
      // console.log(devices);
      const versions = _.map(devices, device => {
        const version = semver.parse(device.os_version)
          ? semver.parse(device.os_version).version
          : "1.0.0-pre";
        return version;
      });
      const counts = _.countBy(versions);
      console.log(counts);
      const keys = _.keys(counts);
      const sorted_keys = keys.sort(semver.rcompare);
      const vers = _.map(sorted_keys, key => {
        return { version: key, count: counts[key] };
      });
      // console.log(vers)
      const result = {
        app_name: app.app_name,
        user: app.user[0].username,
        devices: vers,
        total_count: _.sumBy(vers, o => {
          return o.count;
        })
      };
      console.log(result);
      return result;
      // const c2 = _.sortBy(counts, o => { return o})
      // console.log(c2)
      // const c3 = _.map(counts, o => {
      //   console.log(o)
      //   return o;
      // })
      // console.log(c3);
    } else {
      return null;
    }
    // _.map(app.owns__device, device => {
    //     console.log(semver.parse(device.os_version))
    // })
  });
  console.log("Total:");
  const total2 = _.filter(total, o => {
    return o;
  });
  const total3 = _.sortBy(total2, "total_count").reverse();
  console.log(total3);
};

getDevices();
