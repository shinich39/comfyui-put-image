"use strict";

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const MIN_SEED = 0;
const MAX_SEED = parseInt("0xffffffffffffffff", 16);
const STEPS_OF_SEED = 10;

function getImageURL(filePath) {
  return `/shinich39/put-image/image?path=${encodeURIComponent(filePath)}&rand=${Date.now()}`;
}

function getRandomSeed() {
  let max = Math.min(1125899906842624, MAX_SEED);
  let min = Math.max(-1125899906842624, MIN_SEED);
  let range = (max - min) / (STEPS_OF_SEED / 10);
  return Math.floor(Math.random() * range) * (STEPS_OF_SEED / 10) + min;
}

function showError(err) {
  console.error(err);
  
  let msg;
  if (typeof err === "string") {
    msg = err;
  } else if (err.stack && err.message) {
    msg = err.toString(); 
  } else if (err.response) {
    let msg = err.response.error.message;
    if (err.response.error.details)
    msg += ": " + err.response.error.details;
    for (const [nodeID, nodeError] of Object.entries(err.response.node_errors)) {
    msg += "\n" + nodeError.class_type + ":"
      for (const errorReason of nodeError.errors) {
        msg += "\n    - " + errorReason.message + ": " + errorReason.details
      }
    }
  }

  if (msg) {
    app.ui.dialog.show(msg);
    renderCanvas();
  }
}

function hideError() {
  app.ui.dialog.close();
  app.lastNodeErrors = null;
}

function isErrorOccurred() {
  return app.lastNodeErrors && Object.keys(app.lastNodeErrors).length > 0;
  // if (app.ui?.dialog?.element) {
  //   return app.ui.dialog.element.style.display !== "none" && 
  //     app.ui.dialog.element.style.display !== "";
  // } else {
  //   return false;
  // }
}

function isAutoQueueMode() {
  return document.querySelector("input[name='AutoQueueMode']:checked")?.value === "instant";
}

function getQueueSize() {
  return app.ui.lastQueueSize ?? 0;
}

function startGeneration() {
  app.queuePrompt(0, app.ui.batchCount);
}

async function cancelGeneration() {
  await api.interrupt();
}

function setAutoQueue() {
  if (!isAutoQueueMode()) {
    document.querySelector("input[name='AutoQueueMode']")?.click();
  }
}

function unsetAutoQueue() {
  if (isAutoQueueMode()) {
    for (const elem of Array.prototype.slice.call(document.querySelectorAll("input[name='AutoQueueMode']"))) {
      if (elem.value === "") {
        elem.click();
        break;
      }
    }
  }
}

function renderCanvas() {
  app.canvas.draw(true, true);
}

function selectNode(node) {
  app.canvas.deselectAllNodes();
  app.canvas.selectNode(node);
}

function parseObjectURL(obj) {
  let filePath = "ComfyUI/";
  let dirPath = "ComfyUI/";
  let filename = obj.filename;
  if (obj.type && obj.type !== "") {
    filePath += obj.type + "/";
    dirPath += obj.type + "/";
  }
  if (obj.subfolder && obj.subfolder !== "") {
    filePath += obj.subfolder + "/";
    dirPath += obj.subfolder + "/";
  }

  filePath += filename;

  return {
    filePath,
    dirPath,
    filename,
  }
}

function getPathFromURL(url) {
  let filename = url.searchParams.get("filename");
  if (filename && filename !== "") {
    filename = "/" + filename;
  }
  let subdir = url.searchParams.get("subfolder");
  if (subdir && subdir !== "") {
    subdir = "/" + subdir;
  }
  let dir = url.searchParams.get("type");
  if (dir && dir !== "") {
    dir = "/" + dir;
  }
  return `ComfyUI${dir}${subdir}${filename}`;
}

function parseURL(url) {
  return {
    type: url.searchParams.get("type"),
    subfolder: url.searchParams.get("subfolder"),
    filename: url.searchParams.get("filename"),
  }
}

export {
  getImageURL,
  getRandomSeed,
  showError,
  hideError,
  isErrorOccurred,
  isAutoQueueMode,
  getQueueSize,
  startGeneration,
  cancelGeneration,
  setAutoQueue,
  unsetAutoQueue,
  renderCanvas,
  selectNode,
  parseObjectURL,
  getPathFromURL,
  parseURL,
}