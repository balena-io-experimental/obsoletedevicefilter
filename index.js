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

  console.log(stuff);
  _.each(stuff, app => {
    console.log(app.user);
    console.log(app.owns__device);
  });
};

getDevices();
