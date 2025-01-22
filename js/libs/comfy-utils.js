"use strict";

import { app } from "../../../scripts/app.js";

function getImageURL(filePath) {
  return `/shinich39/put-image/image?path=${encodeURIComponent(filePath)}&rand=${Date.now()}`;
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
  renderCanvas,
  selectNode,
  parseObjectURL,
  getPathFromURL,
  parseURL,
}