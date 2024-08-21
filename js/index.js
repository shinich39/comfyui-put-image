"use strict";

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { initMaskEditor } from "./libs/mask-editor.js";
import { random } from "./libs/util.min.js";
import {
  getImageURL,
  renderCanvas,
  selectNode,
  parseURL,
  parseObjectURL,
  getPathFromURL,
  getRandomSeed,
  cancelGeneration,
  isAutoQueueMode,
  unsetAutoQueue,
} from "./libs/comfy-utils.js";

const NODE_TYPE = "PutImage";

function initNode() {
  try {
    const self = this;

    this.statics = {
      isInitialized: false,
      countQueues: 0,
      countLoops: 0,
      countErrors: 0,
      loadedImages: [],
      selectedImage: null,
      selectedIndex: -1,
    };

    this.statics.init = (function() {
      const self = this;
      if (this.widgets) {
        this.statics.DIR_PATH = this.widgets.find(e => e.name === "dir_path");
        this.statics.INDEX = this.widgets.find(e => e.name === "index");
        this.statics.MODE = this.widgets.find(e => e.name === "mode");
        this.statics.FILENAME = this.widgets.find(e => e.name === "filename");

        if (!this.statics.MASK) {
          this.statics.MASK = initMaskEditor.apply(this);
        }

        if (!this.statics.DIR_PATH) {
          throw new Error("dir_path widget not found.");
        }
        if (!this.statics.INDEX) {
          throw new Error("index widget not found.");
        }
        if (!this.statics.MODE) {
          throw new Error("index widget not found.");
        }
        if (!this.statics.FILENAME) {
          throw new Error("filename widget not found.");
        }
        if (!this.statics.MASK) {
          throw new Error("maskeditor widget not found.");
        }

        this.statics.isInitialized = true;
      } else {
        throw new Error("widgets not found.");
      }
    }).bind(this);

    this.statics.getIndex = (function(idx) {
      try {
        if (!this.statics.isInitialized) {
          throw new Error(`node #${this.id} has not been initialized.`);
        }
        let i = typeof idx === "number" ? idx : this.statics.INDEX.value;
        const min = 0;
        const max = this.statics.loadedImages?.length || 0;
        if (i < min) {
          i = max + i;
        } else if (max && i >= max) {
          i = i % max;
        }
        return i;
      } catch(err) {
        console.error(err);
        return 0;
      }
    }).bind(this);

    this.statics.loadImageByPath = (async function(filePath) {
      if (!this.statics.isInitialized) {
        throw new Error(`node #${this.id} has not been initialized.`);
      }
      if (!filePath || filePath.trim() == "") {
        return;
      }

      filePath = filePath.replace(/[\\\/]+/g, "/");
      let dirPath = filePath.replace(/\/[^\/]+$/, "/");
      let basename = filePath.replace(dirPath, "");
      let filename = basename.replace(/.[^.]+$/, "");

      if (this.statics.DIR_PATH.value === dirPath && this.statics.FILENAME.value === filename) {
        throw new Error(`Image already loaded: ${dirPath}/${filename}`);
      }

      this.statics.resetCounter();
      await this.statics.updateDirPath(dirPath);
      await this.statics.loadImages();

      let idx = this.statics.loadedImages.findIndex(e => {
        return e.origName === filename;
      });

      if (idx === -1) {
        idx = 0;
      }

      this.statics.updateIndex(idx);
      this.statics.clearImage();
      this.statics.selectImage();
      this.statics.renderImage();
      selectNode(this);
    }).bind(this);

    this.statics.clearImage = (function() {
      if (!this.statics.isInitialized) {
        throw new Error(`node #${this.id} has not been initialized.`);
      }
      const w = this.statics.MASK;
      w.element.style.width = this.size[0] - 32;
      w.element.style.height = this.size[0] - 32;
      w.origImgLoaded = false;
      w.drawImgLoaded = false;
      w.maskImgLoaded = false;
      w.origCtx.clearRect(0,0,w.origCanvas.width,w.origCanvas.height);
      w.drawCtx.clearRect(0,0,w.drawCanvas.width,w.drawCanvas.height);
      w.maskCtx.clearRect(0,0,w.maskCanvas.width,w.maskCanvas.height);
      w.origImg.src = "";
      w.drawImg.src = "";
      w.maskImg.src = "";
    }).bind(this);

    this.statics.selectImage = (function() {
      if (!this.statics.isInitialized) {
        throw new Error(`node #${this.id} has not been initialized.`);
      }
      let i = this.statics.getIndex();
      this.statics.selectedIndex = i;
      this.statics.selectedImage = this.statics.loadedImages[i];
      if (!this.statics.selectedImage) {
        this.statics.FILENAME.prevValue = "NO IMAGE";
        this.statics.FILENAME.value = "NO IMAGE";
        throw new Error(`No image in ${this.statics.DIR_PATH.value}`);
      }
      this.statics.FILENAME.prevValue = this.statics.selectedImage.origName;
      this.statics.FILENAME.value = this.statics.selectedImage.origName;
    }).bind(this);

    this.statics.renderImage = (function() {
      if (!this.statics.isInitialized) {
        throw new Error(`node #${this.id} has not been initialized.`);
      }
      if (!this.statics.selectedImage) {
        return;
      }
      try {
        const { origPath, drawPath, maskPath, } = this.statics.selectedImage;
        this.statics.MASK.origImg.src = getImageURL(origPath);
        this.statics.MASK.drawImg.src = drawPath ? getImageURL(drawPath) : "";
        this.statics.MASK.maskImg.src = maskPath ? getImageURL(maskPath) : "";
      } catch(err) {
        console.error(err);
      }
    }).bind(this);

    this.statics.loadImages = (async function() {
      try {
        if (!this.statics.isInitialized) {
          throw new Error(`node #${this.id} has not been initialized.`);
        }

        // clear loaded images
        this.statics.loadedImages = [];
  
        // get images in directory
        let d = this.statics.DIR_PATH.value;
        if (d && d.trim() !== "") {
          const images = await loadImages(d);
          for (const image of images) {
            this.statics.loadedImages.push({
              origPath: image["original_path"],
              origName: image["original_name"],
              drawPath: image["draw_path"],
              drawName: image["draw_name"],
              maskPath: image["mask_path"],
              maskName: image["mask_name"],
            });
          }
        }
      } catch(err) {
        console.error(err);
      }
    }).bind(this);

    this.statics.updateDirPath = (function(str) {
      try {
        if (!this.statics.isInitialized) {
          throw new Error(`node #${this.id} has not been initialized.`);
        }
        this.statics.DIR_PATH.isCallbackEnabled = false;
        this.statics.DIR_PATH.prevValue = str;
        this.statics.DIR_PATH.value = str;
        this.statics.DIR_PATH.isCallbackEnabled = true;
      } catch(err) {
        console.error(err);
      }
    }).bind(this);

    this.statics.updateIndex = (function(idx) {
      this.statics.INDEX.isCallbackEnabled = false;
      try {
        if (!this.statics.isInitialized) {
          throw new Error(`node #${this.id} has not been initialized.`);
        }
        const isFixed = typeof idx === "number";
        const images = this.statics.loadedImages;
        const m = this.statics.MODE.value;

        if (!isFixed) {
          idx = this.statics.getIndex();
          if (m === "increment") {
            idx += 1;
          } else if (m === "decrement") {
            idx -= 1;
          } else if (m === "randomize") {
            idx = Math.floor(random(0, images.length));
          }
        }

        const clampedIdx = Math.round(this.statics.getIndex(idx));
        this.statics.INDEX.value = clampedIdx;
      } catch(err) {
        console.error(err);
      }
      this.statics.INDEX.isCallbackEnabled = true;
    }).bind(this);

    this.statics.updateCounter = (function() {
      try {
        if (!this.statics.isInitialized) {
          throw new Error(`node #${this.id} has not been initialized.`);
        }
        const m = this.statics.MODE.value;
        const images = this.statics.loadedImages;
        const idx = this.statics.INDEX.value;
        this.statics.countQueues += 1;
        if (m === "increment" && idx >= images.length - 1) {
          this.statics.countLoops += 1;
        } else if (m === "decrement" && idx <= 0) {
          this.statics.countLoops += 1;
        }
      } catch(err) {
        console.error(err);
      }
    }).bind(this);

    this.statics.resetCounter = (function() {
      try {
        if (!this.statics.isInitialized) {
          throw new Error(`node #${this.id} has not been initialized.`);
        }
        this.statics.countQueues = 0;
        this.statics.countLoops = 0;
        this.statics.countErrors = 0;
      } catch(err) {
        console.error(err);
      }
    }).bind(this);

    // create widgets
    this.statics.init();

    const dpWidget = this.statics.DIR_PATH;
    const idxWidget = this.statics.INDEX;
    const fnWidget = this.statics.FILENAME;
    const modeWidget = this.statics.MODE;
    const maskWidget = this.statics.MASK;

    // this.onSelected = (e) => this.setDirtyCanvas(true, true);
    const onKeyDown = this.onKeyDown;
    this.onKeyDown = async function(e) {
      const r = onKeyDown.apply(this, arguments);
      const { key, ctrlKey, metaKey, shiftKey } = e;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        this.statics.resetCounter();
        if (key === "ArrowLeft") {
          this.statics.updateIndex(this.statics.INDEX.value - 1);
        } else {
          this.statics.updateIndex(this.statics.INDEX.value + 1);
        }
        this.statics.clearImage();
        this.statics.selectImage();
        this.statics.renderImage();
        selectNode(this);
      } else if ((key === "r" && (ctrlKey || metaKey)) || key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        this.statics.resetCounter();
        await this.statics.loadImages();
        this.statics.updateIndex(this.statics.getIndex());
        this.statics.clearImage();
        this.statics.selectImage();
        this.statics.renderImage();
        selectNode(this);
      }
      return r;
    };

    dpWidget.isCallbackEnabled = false;
    dpWidget.options.getMinHeight = () => 64;
    dpWidget.options.getMaxHeight = () => 64;
    dpWidget.callback = async function(currValue) {
      if (!this.isCallbackEnabled) {
        return;
      }
      if (this.prevValue !== currValue) {
        this.prevValue = currValue;
        self.statics.resetCounter();
        await self.statics.loadImages();
        self.statics.updateIndex(0);
        self.statics.clearImage();
        self.statics.selectImage();
        self.statics.renderImage();
        selectNode(self);
      }
    }

    fnWidget.callback = function(currValue) {
      if (this.prevValue !== currValue) {
        this.value = this.prevValue;
        alert("You can not change filename.");
      }
    }

    idxWidget.isCallbackEnabled = false;
    idxWidget.timer = null;
    idxWidget.callback = function(v) {
      if (!this.isCallbackEnabled) {
        return;
      }
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(async () => {
        self.statics.resetCounter();
        self.statics.updateIndex(self.statics.getIndex());
        self.statics.clearImage();
        self.statics.selectImage();
        self.statics.renderImage();
        selectNode(self);
      }, 128);
    }

    // fix widget size
    setTimeout(() => {
      this.setSize(this.size);
      this.setDirtyCanvas(true, true);
    }, 128);
  } catch(err) {
    console.error(err);
  }
}

// images store when preview node out of screen
function fixPreviewImages({ detail }) {
  // Filter the nodes that have the preview element.
  if (!detail?.output?.images) {
    return;
  }
  
  const imagePaths = detail.output.images.map(e => parseObjectURL(e).filePath);
  const node = app.graph._nodes?.find(e => e.id == detail.node);
  if (node) {
    node.imagePaths = imagePaths;
  }
}

async function loadImages(dirPath) {
  const response = await api.fetchApi(`/shinich39/put-image/load-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", },
    body: JSON.stringify({ path: dirPath }),
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  const data = await response.json();

  return data;
}

// api.addEventListener("promptQueued", () => {});
api.addEventListener("executed", fixPreviewImages);

app.registerExtension({
	name: `shinich39.${NODE_TYPE}`,
  setup() {

    // render before start a new queue
    const origQueuePrompt = app.queuePrompt;
    app.queuePrompt = async function(number, batchCount) {

      // end of queue
      for (const node of app.graph._nodes) {
        if (node.type === NODE_TYPE) {
          const isFirstQueue = node.statics.countQueues === 0;
          if (isFirstQueue) {
            node.statics.updateCounter();
          } else {
            const prevIndex = node.statics.getIndex();
            node.statics.updateIndex();
            node.statics.updateCounter();
            const currIndex = node.statics.getIndex();
            if (prevIndex !== currIndex) {
              node.statics.clearImage();
              node.statics.selectImage();
              node.statics.renderImage();
            }
          }
        }
      }

      const r = await origQueuePrompt.apply(this, arguments);
      return r;
    }
  },
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    
    function isNodeExists() {
      for (const node of app.graph._nodes) {
        if (node.type === NODE_TYPE) {
          return true;
        }
      }
      return false;
    }

    function getNodes() {
      let nodes = [];
      for (const node of app.graph._nodes) {
        if (node.type === NODE_TYPE) {
          nodes.push(node);
        }
      }
      return nodes;
    }

    async function saveImage(filePath, dirname) {
      const response = await api.fetchApi(`/shinich39/put-image/save-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ path: filePath, dirname, }),
      });
    
      if (response.status !== 200) {
        throw new Error(response.statusText);
      }
    
      return true;
    }

    async function sendToDir(dirname) {
      if (this.imgs) {
        // If this node has images then we add an open in new tab item
        let img;
        if (this.imageIndex != null) {
          // An image is selected so select that
          img = this.imgs[this.imageIndex];
        } else if (this.overIndex != null) {
          // No image is selected but one is hovered
          img = this.imgs[this.overIndex];
        }
        if (img) {
          const url = new URL(img.src);
          const filePath = getPathFromURL(url);
          await saveImage(filePath, dirname);
        }
      }
    }
    
    async function sendToNode(node) {
      if (this.imgs) {
        // If this node has images then we add an open in new tab item
        let img;
        if (this.imageIndex != null) {
          // An image is selected so select that
          img = this.imgs[this.imageIndex];
        } else if (this.overIndex != null) {
          // No image is selected but one is hovered
          img = this.imgs[this.overIndex];
        }
        if (img) {
          const url = new URL(img.src);
          const obj = parseURL(url);
          const filePath = parseObjectURL(obj).filePath;
          await node.statics.loadImageByPath(filePath);
        }
      }
    }    

    // add "Send to input" to preview image menu
		const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
		nodeType.prototype.getExtraMenuOptions = function (_, options) {
			const r = origGetExtraMenuOptions ? origGetExtraMenuOptions.apply(this, arguments) : undefined;
			let optionIndex = options.findIndex((o) => o?.content === "Save Image");
      if (optionIndex > -1) {
        let newOptions = [
          {
            content: "Send to input",
            callback: () => {
              sendToDir.apply(this, ["input"]);
            },
          }, {
            content: "Send to output",
            callback: () => {
              sendToDir.apply(this, ["output"]);
            },
          }, {
            content: "Send to Put Image",
            disabled: !isNodeExists(),
            submenu: {
              options: getNodes().map((node) => {
                return {
                  content: `#${node.id}`,
                  callback: () => {
                    sendToNode.apply(this, [node]);
                  },
                }
              }),
            },
          }, 
        ];
        
        options.splice(
          optionIndex + 1,
          0,
          ...newOptions
        );
      }
      return r;
		};

	},
  async afterConfigureGraph(missingNodeTypes) {
    for (const node of app.graph._nodes) {
      if (node.comfyClass === NODE_TYPE) {
        if (!node.statics || !node.statics.isInitialized) {
          initNode.apply(node);
        }
        node.statics.resetCounter();
        await node.statics.loadImages();
        // node.statics.updateIndex(node.statics.getIndex());
        node.statics.clearImage();
        node.statics.selectImage();
        node.statics.renderImage();

        node.statics.DIR_PATH.isCallbackEnabled = true;
        node.statics.INDEX.isCallbackEnabled = true;

        node.statics.DIR_PATH.prevValue = node.statics.DIR_PATH.value; 
        node.statics.FILENAME.prevValue = node.statics.FILENAME.value;
      }
    }
	},
  nodeCreated(node) {
    if (node.comfyClass === NODE_TYPE) {
      if (!node.statics || !node.statics.isInitialized) {
        initNode.apply(node);
      }
      if (!app.configuringGraph) {
        ;(async () => {
          node.statics.resetCounter();
          await node.statics.loadImages();
          // node.statics.updateIndex(node.statics.getIndex());
          node.statics.clearImage();
          node.statics.selectImage();
          node.statics.renderImage();

          node.statics.DIR_PATH.isCallbackEnabled = true;
          node.statics.INDEX.isCallbackEnabled = true;
        })();
      }
    }
  },
});