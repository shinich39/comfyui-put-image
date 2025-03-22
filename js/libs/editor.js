"use strict";

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { selectNode } from "./utils.js";

const DEFAULT_DRAW_COLOR = "rgb(0,0,0)";
const DEFAULT_MASK_RGB = [0,0,0];
const DEFAULT_MASK_COLOR = "rgb(0,0,0)";
const DEFAULT_BRUSH_COLOR = "rgba(0,0,0,0.2)";
let movingMode = false;

// global event
document.addEventListener('pointerup', pointerUpEvent, true);
document.addEventListener('keydown', (e) => {
  const { key, ctrlKey, metaKey, shiftKey } = e;
  if (key !== " ") {
    return;
  }
  if (e.target != document.getElementById("graph-canvas") && e.target != document.body) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  spaceBarDownEvent(e);
}, true);
document.addEventListener('pointermove', (e) => {
  if (!movingMode) {
    return;
  }
  e.preventDefault();
  // e.stopPropagation();
  moveCanvas(e.movementX, e.movementY);
});

function initMaskEditor() {
  const self = this;

  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "relative",
    display: "flex",
    justifyContent: "center", 
    alignItems: "center",
    color: "var(--descrip-text)",
    fontFamily: "Verdana, Arial, Helvetica, sans-serif",
    fontSize: "0.8rem",
    letterSpacing: 0,
    pointerEvents: "none",
  });

  const origCanvas = document.createElement("canvas");
  const origCtx = origCanvas.getContext("2d", {willReadFrequently: true});
  Object.assign(origCanvas.style, {
    position: "absolute",
    maxWidth: "100%",
    maxHeight: "100%",
    pointerEvents: "auto",
  });
  
  const drawCanvas = document.createElement("canvas");
  const drawCtx = drawCanvas.getContext("2d", {willReadFrequently: true});
  Object.assign(drawCanvas.style, {
    position: "absolute",
    mixBlendMode: "initial",
    opacity: 1,
    maxWidth: "100%",
    maxHeight: "100%",
    pointerEvents: "auto",
  });

  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d", {willReadFrequently: true});
  Object.assign(maskCanvas.style, {
    position: "absolute",
    mixBlendMode: "initial",
    opacity: 0.5,
    maxWidth: "100%",
    maxHeight: "100%",
    pointerEvents: "auto",
  });

  container.appendChild(origCanvas);
  container.appendChild(drawCanvas);
  container.appendChild(maskCanvas);
  
  const widget = this.addDOMWidget("maskeditor", "", container, {
    serialize: false,
    getMinHeight: function() {
      return self.size[0];
    },
  });

  ;(() => {
    if (this.widgets.find(e => e.name === "Sketch")) {
      return;
    }
    const w = this.addWidget("toggle", "Sketch", false, () => {}, {
      serialize: false,
    });
  
    // w.computeSize = () => [0, 26];
    w.serializeValue = () => undefined;
    widget.sketchWidget = w;
  })();

  ;(() => {
    if (this.widgets.find(e => e.name === "Clear")) {
      return;
    }

    const w = this.addWidget("button", "Clear", null, () => {}, {
      serialize: false,
    });
  
    w.computeSize = () => [0, 26];
    w.serializeValue = () => undefined;
    w.callback = function() {
      self.statics.MASK.clearEvent();
    }
    widget.clearWidget = w;
  })();

  widget.node = this;
  widget.container = container;

  widget.serializeValue = () => undefined;

  widget.origImgLoaded = false;
  widget.origImg = new Image();
  widget.origCanvas = origCanvas;
  widget.origCtx = origCtx;

  widget.drawImgLoaded = false;
  widget.drawImg = new Image();
  widget.drawCanvas = drawCanvas;
  widget.drawCtx = drawCtx;

  widget.maskImgLoaded = false;
  widget.maskImg = new Image();
  widget.maskCanvas = maskCanvas;
  widget.maskCtx = maskCtx;

  widget.containerSize = [container.clientWidth, container.clientHeight];
  widget.zoomRatio = 1.0;
  widget.panX = 0;
  widget.panY = 0;
  widget.brushSize = 100;
  widget.drawingMode = false;
  widget.drawColor = DEFAULT_DRAW_COLOR;
  widget.brushColor = DEFAULT_BRUSH_COLOR;
  widget.lastx = -1;
  widget.lasty = -1;
  widget.lasttime = 0;

  widget.origImg.onload = function() {
    widget.origImgLoaded = true;
    widget.origCanvas.width = widget.origImg.width;
    widget.origCanvas.height = widget.origImg.height;
    widget.origCtx.drawImage(widget.origImg, 0, 0, widget.origImg.width, widget.origImg.height);

    if (widget.drawImg.src === window.location.href) {
      widget.drawImgLoaded = false;
      widget.drawImg.src = createEmptyCanvas(widget.origImg.width,widget.origImg.height);
    }

    if (widget.maskImg.src === window.location.href) {
      widget.maskImgLoaded = false;
      widget.maskImg.src = createEmptyCanvas(widget.origImg.width,widget.origImg.height, "rgba(0,0,0,255)");
    }

    imagesLoaded();
  }

  widget.drawImg.onload = function() {
    widget.drawImgLoaded = true;
    widget.drawCanvas.width = widget.drawImg.width;
    widget.drawCanvas.height = widget.drawImg.height;
    widget.drawCtx.drawImage(widget.drawImg, 0, 0, widget.drawImg.width, widget.drawImg.height);
    imagesLoaded();
  }

  widget.maskImg.onload = function() {
    widget.maskImgLoaded = true;
    widget.maskCanvas.width = widget.maskImg.width;
    widget.maskCanvas.height = widget.maskImg.height;
    widget.maskCtx.drawImage(widget.maskImg, 0, 0, widget.maskImg.width, widget.maskImg.height);
    imagesLoaded();
  }

  widget.updateContainerSize = updateContainerSize;
  widget.initializeCanvasPanZoom = initializeCanvasPanZoom;
  widget.invalidatePanZoom = invalidatePanZoom;
  widget.showBrush = showBrush;
  widget.hideBrush = hideBrush;
  widget.setBrushColor = setBrushColor;
  widget.handleWheelEvent = handleWheelEvent;
  widget.pointerMoveEvent = pointerMoveEvent;
  widget.pointerDownEvent = pointerDownEvent;
  widget.drawMoveEvent = drawMoveEvent;
  widget.saveEvent = saveEvent;
  widget.getMaskBlob = getMaskBlob;
  widget.getDrawBlob = getDrawBlob;
  widget.clearEvent = clearEvent;

  widget.maskCanvas.addEventListener('wheel', (e) => widget.handleWheelEvent(widget, e));
  widget.maskCanvas.addEventListener('pointerleave', (e) => widget.hideBrush(widget, e));
  widget.maskCanvas.addEventListener('pointerdown', (e) => widget.pointerDownEvent(widget, e));
  widget.maskCanvas.addEventListener('pointermove', (e) => widget.drawMoveEvent(widget, e));

  // prevent context menu for removing mask
  widget.origCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  widget.drawCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  widget.maskCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // node resize event
  const onResize = this.onResize;
  this.onResize = function (size) {
    widget.initializeCanvasPanZoom();
    onResize?.apply(this, arguments);
  };

  // node keydown event
  const onKeyDown = this.onKeyDown;
  this.onKeyDown = function (e) {
    keyDownEvent.apply(this, [e]);
    onKeyDown?.apply(this, arguments);
    selectNode(this);
  };

  // canvas
  function imagesLoaded() {
    if (!widget.origImgLoaded || !widget.drawImgLoaded || !widget.maskImgLoaded) {
      return;
    }

    // paste mask data into alpha channel
    const maskData = widget.maskCtx.getImageData(0, 0, widget.maskCanvas.width, widget.maskCanvas.height);

    // invert mask
    for (let i = 0; i < maskData.data.length; i += 4) {
      maskData.data[i] = DEFAULT_MASK_RGB[0];
      maskData.data[i+1] = DEFAULT_MASK_RGB[1];
      maskData.data[i+2] = DEFAULT_MASK_RGB[2];
      if(maskData.data[i+3] == 255) {
        maskData.data[i+3] = 0;
      } else {
        maskData.data[i+3] = 255;
      }
    }

    widget.maskCtx.globalCompositeOperation = 'source-over';
    widget.maskCtx.putImageData(maskData, 0, 0);
    widget.initializeCanvasPanZoom();
  }

  return widget;
}

// Helper function to convert a data URL to a Blob object
function dataURLToBlob(dataURL) {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const byteString = atob(parts[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  return new Blob([arrayBuffer], { type: contentType });
}

function initializeCanvasPanZoom() {
  // set containerSize
  this.updateContainerSize();

  // set initialize
  let drawWidth = this.origImg.width;
  let drawHeight = this.origImg.height;

  let width = this.containerSize[0];
  let height = this.containerSize[1];
  
  if (this.origImg.width > width) {
    drawWidth = width;
    drawHeight = (drawWidth / this.origImg.width) * this.origImg.height;
  }

  if (drawHeight > height) {
    drawHeight = height;
    drawWidth = (drawHeight / this.origImg.height) * this.origImg.width;
  }

  this.zoomRatio = drawWidth / this.origImg.width;

  const canvasX = (width - drawWidth) / 2;
  const canvasY = (height - drawHeight) / 2;
  this.panX = canvasX;
  this.panY = canvasY;

  this.invalidatePanZoom();
}

function invalidatePanZoom() {
  let rawWidth = this.origImg.width * this.zoomRatio;
  let rawHeight = this.origImg.height * this.zoomRatio;

  if(this.panX + rawWidth < 10) {
    this.panX = 10 - rawWidth;
  }

  if(this.panY + rawHeight < 10) {
    this.panY = 10 - rawHeight;
  }

  let width = `${rawWidth}px`;
  let height = `${rawHeight}px`;

  let left = `${this.panX}px`;
  let top = `${this.panY}px`;

  this.maskCanvas.style.width = width;
  this.maskCanvas.style.height = height;
  this.maskCanvas.style.left = left;
  this.maskCanvas.style.top = top;

  this.drawCanvas.style.width = width;
  this.drawCanvas.style.height = height;
  this.drawCanvas.style.left = left;
  this.drawCanvas.style.top = top;

  this.origCanvas.style.width = width;
  this.origCanvas.style.height = height;
  this.origCanvas.style.left = left;
  this.origCanvas.style.top = top;
}

function setBrushColor(self, e) {
  const maskRect = this.maskCanvas.getBoundingClientRect();

  var x = e.offsetX;
  var y = e.offsetY
  if(e.offsetX == null) {
    x = e.targetTouches[0].clientX - maskRect.left;
  }
  if(e.offsetY == null) {
    y = e.targetTouches[0].clientY - maskRect.top;
  }
  x /= this.zoomRatio;
  y /= this.zoomRatio;

  const p = getPixelColor(this.origCtx, x, y);
  const [r, g, b] = p;
  this.drawColor = `rgb(${r},${g},${b})`;
  this.brushColor = `rgba(${r},${g},${b},0.5)`;
  this.showBrush();
}

function showBrush() {
  if (!this.brush) {
    this.brush = document.createElement("div");
    document.body.appendChild(this.brush);
  }

  const brushColor = this.brushColor;
  const canvasScale = app.canvas.ds.scale;

  this.brush.style.backgroundColor = brushColor;
  // this.brush.style.boxShadow = "0 0 0 1px white";
  this.brush.style.borderRadius = "50%";
  this.brush.style.MozBorderRadius = "50%";
  this.brush.style.WebkitBorderRadius = "50%";
  this.brush.style.position = "absolute";
  this.brush.style.zIndex = 8889;
  this.brush.style.pointerEvents = "none";
  this.brush.style.width = this.brushSize * 2 * this.zoomRatio * canvasScale + "px";
  this.brush.style.height = this.brushSize * 2 * this.zoomRatio * canvasScale + "px";
  this.brush.style.left = (this.cursorX - this.brushSize * this.zoomRatio * canvasScale) + "px";
  this.brush.style.top = (this.cursorY - this.brushSize * this.zoomRatio * canvasScale) + "px";
}

function hideBrush() {
  if (this.brush) {
    this.brush.parentNode.removeChild(this.brush);
    this.brush = null;
  }
}

function handleWheelEvent(self, e) {
  e.preventDefault();

  const imageScale = this.origCanvas.offsetWidth / this.origCanvas.width;
  let factor = (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) ? 3 : 0.5;

  // adjust brush size
  if(e.deltaY < 0)
    this.brushSize = Math.min(this.brushSize+(factor / imageScale), 100 / imageScale);
  else
    this.brushSize = Math.max(this.brushSize-(factor / imageScale), 1);

  this.showBrush();
}

function pointerMoveEvent(self, e) {
  this.cursorX = e.pageX;
  this.cursorY = e.pageY;
  this.showBrush();
}

function pointerDownEvent(self, e) {  
  // wheel click
  if (e.buttons == 4) {
    e.preventDefault();
    movingMode = true;
    return;
  }

  var brushSize = this.brushSize;
  if(e instanceof PointerEvent && e.pointerType == 'pen') {
    brushSize *= e.pressure;
    this.last_pressure = e.pressure;
  }

  // left click and right click
  if ([0, 2, 5].includes(e.button)) {
    e.preventDefault();

    // set brush color
    if ((e.ctrlKey || e.metaKey || e.altKey)) {
      this.setBrushColor(self, e);
      return;
    }

    // select node
    selectNode(this.node);

    this.drawingMode = true;

    const { maskCanvas, maskCtx, drawCanvas, drawCtx, sketchWidget } = this;
    const maskRect = maskCanvas.getBoundingClientRect();
    const x = (e.offsetX || e.targetTouches[0].clientX - maskRect.left) / this.zoomRatio;
    const y = (e.offsetY || e.targetTouches[0].clientY - maskRect.top) / this.zoomRatio;

    if (!sketchWidget.value) {
      if (e.button == 0) {
        // left click
        maskCtx.beginPath();
        maskCtx.fillStyle = DEFAULT_MASK_COLOR;
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
        maskCtx.fill();
      } else {
        // right click
        maskCtx.beginPath();
        maskCtx.globalCompositeOperation = "destination-out";
        maskCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
        maskCtx.fill();
      }
    } else {
      if (e.button == 0) {
        // shift + left click
        drawCtx.beginPath();
        drawCtx.fillStyle = this.drawColor;
        drawCtx.globalCompositeOperation = "source-over";
        drawCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
        drawCtx.fill();
      } else {
        // shift + right click
        drawCtx.beginPath();
        drawCtx.globalCompositeOperation = "destination-out";
        drawCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
        drawCtx.fill();
      }
    }

    this.lastx = x;
    this.lasty = y;
    this.lasttime = performance.now();
  }
}

function drawMoveEvent(self, e) {
  e.preventDefault();

  this.cursorX = e.pageX;
  this.cursorY = e.pageY;

  this.showBrush();

  // wheel click
  if (movingMode) {
    return;
  }

  let left_button_down = window.TouchEvent && e instanceof TouchEvent || e.buttons == 1;
  let right_button_down = [2, 5, 32].includes(e.buttons);

  if ((e.ctrlKey || e.metaKey || e.altKey) && (left_button_down || right_button_down)) {
    this.setBrushColor(self, e);
    return;
  }
  if (!this.drawingMode) {
    return;
  }

  const { maskCanvas, maskCtx, drawCanvas, drawCtx, sketchWidget } = this;
  const maskRect = maskCanvas.getBoundingClientRect();

  if (left_button_down) {
    var diff = performance.now() - this.lasttime;
    var x = e.offsetX;
    var y = e.offsetY

    if(e.offsetX == null) {
      x = e.targetTouches[0].clientX - maskRect.left;
    }

    if(e.offsetY == null) {
      y = e.targetTouches[0].clientY - maskRect.top;
    }

    x /= this.zoomRatio;
    y /= this.zoomRatio;

    var brushSize = this.brushSize;
    if(e instanceof PointerEvent && e.pointerType == 'pen') {
      brushSize *= e.pressure;
      this.last_pressure = e.pressure;
    } else if(window.TouchEvent && e instanceof TouchEvent && diff < 20){
      // The firing interval of PointerEvents in Pen is unreliable, so it is supplemented by TouchEvents.
      brushSize *= this.last_pressure;
    } else {
      brushSize = this.brushSize;
    }

    if (diff > 20 && !this.drawingMode) {
      requestAnimationFrame(() => {
        if (!sketchWidget.value) {
          maskCtx.beginPath();
          maskCtx.fillStyle = DEFAULT_MASK_COLOR;
          maskCtx.globalCompositeOperation = "source-over";
          maskCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
          maskCtx.fill();
        } else {
          drawCtx.beginPath();
          drawCtx.fillStyle = this.drawColor;
          drawCtx.globalCompositeOperation = "source-over";
          drawCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
          drawCtx.fill();
        }
        
        this.lastx = x;
        this.lasty = y;
      });
    } else {
      requestAnimationFrame(() => {
        var dx = x -  this.lastx;
        var dy = y -  this.lasty;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var directionX = dx / distance;
        var directionY = dy / distance;
        if (!sketchWidget.value) {
          maskCtx.beginPath();
          maskCtx.fillStyle = DEFAULT_MASK_COLOR;
          maskCtx.globalCompositeOperation = "source-over";
        } else {
          drawCtx.beginPath();
          drawCtx.fillStyle = this.drawColor;
          drawCtx.globalCompositeOperation = "source-over";
        }
        for (var i = 0; i < distance; i+=5) {
          var px =  this.lastx + (directionX * i);
          var py =  this.lasty + (directionY * i);
          if (!sketchWidget.value) {
            maskCtx.arc(px, py, brushSize, 0, Math.PI * 2, false);
            maskCtx.fill();
          } else {
            drawCtx.arc(px, py, brushSize, 0, Math.PI * 2, false);
            drawCtx.fill();
          }
        }

        this.lastx = x;
        this.lasty = y;
      });
    }
    this.lasttime = performance.now();
  } else if (right_button_down) {
    const x = (e.offsetX || e.targetTouches[0].clientX - maskRect.left) / this.zoomRatio;
    const y = (e.offsetY || e.targetTouches[0].clientY - maskRect.top) / this.zoomRatio;

    var brushSize = this.brushSize;
    if (e instanceof PointerEvent && e.pointerType == 'pen') {
      brushSize *= e.pressure;
      this.last_pressure = e.pressure;
    } else if(window.TouchEvent && e instanceof TouchEvent && diff < 20){
      brushSize *= this.last_pressure;
    } else {
      brushSize = this.brushSize;
    }

    if(diff > 20 && !this.drawingMode) { // cannot tracking drawingMode for touch event
      requestAnimationFrame(() => {
        if (!sketchWidget.value) {
          maskCtx.beginPath();
          maskCtx.globalCompositeOperation = "destination-out";
          maskCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
          maskCtx.fill();
        } else {
          drawCtx.beginPath();
          drawCtx.globalCompositeOperation = "destination-out";
          drawCtx.arc(x, y, brushSize, 0, Math.PI * 2, false);
          drawCtx.fill();
        }

        this.lastx = x;
        this.lasty = y;
      });
    } else {
      requestAnimationFrame(() => {
        var dx = x - this.lastx;
        var dy = y - this.lasty;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var directionX = dx / distance;
        var directionY = dy / distance;
  
        if (!sketchWidget.value) {
          maskCtx.beginPath();
          maskCtx.globalCompositeOperation = "destination-out";
        } else {
          drawCtx.beginPath();
          drawCtx.globalCompositeOperation = "destination-out";
        }
        for (var i = 0; i < distance; i+=5) {
          var px = this.lastx + (directionX * i);
          var py = this.lasty + (directionY * i);
          if (!sketchWidget.value) {
            maskCtx.arc(px, py, brushSize, 0, Math.PI * 2, false);
            maskCtx.fill();
          } else {
            drawCtx.arc(px, py, brushSize, 0, Math.PI * 2, false);
            drawCtx.fill();
          }
        }

        this.lastx = x;
        this.lasty = y;
      });

      this.lasttime = performance.now();
    }
  }
}

function getMaskBlob() {
  const backupCanvas = document.createElement('canvas');
  const backupCtx = backupCanvas.getContext('2d', {willReadFrequently:true});
  backupCanvas.width = this.maskImg.width;
  backupCanvas.height = this.maskImg.height;

  backupCtx.clearRect(0,0, backupCanvas.width, backupCanvas.height);
  backupCtx.drawImage(this.maskCanvas,
    0, 0, this.maskCanvas.width, this.maskCanvas.height,
    0, 0, backupCanvas.width, backupCanvas.height);

  // paste mask data into alpha channel
  const backupData = backupCtx.getImageData(0, 0, backupCanvas.width, backupCanvas.height);

  // refine mask image
  for (let i = 0; i < backupData.data.length; i += 4) {
    backupData.data[i] = 0;
    backupData.data[i+1] = 0;
    backupData.data[i+2] = 0;
    if(backupData.data[i+3] == 255) {
      backupData.data[i+3] = 0;
    } else {
      backupData.data[i+3] = 255;
    }
  }

  backupCtx.globalCompositeOperation = 'source-over';
  backupCtx.putImageData(backupData, 0, 0);

  const dataURL = backupCanvas.toDataURL();
  const blob = dataURLToBlob(dataURL);
  return blob;
}

function getDrawBlob() {
  const dataURL = this.drawCanvas.toDataURL();
  const blob = dataURLToBlob(dataURL);
  return blob;
}

async function saveEvent() {
  const node = this.node;
  if (!node) {
    return;
  }

  const formData = new FormData();
  const dBlob = this.getDrawBlob();
  const mBlob = this.getMaskBlob();

  formData.append('draw', dBlob);
  formData.append('mask', mBlob);
  formData.append('path', node.statics.selectedImage.origPath);

  const response = await api.fetchApi('/shinich39/put-image/edit-image', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();

  // set to loaded image
  node.statics.selectedImage.drawName = data.draw_name;
  node.statics.selectedImage.drawPath = data.draw_path;
  node.statics.selectedImage.maskName = data.mask_name;
  node.statics.selectedImage.maskPath = data.mask_path;
}

async function clearEvent() {
  const node = this.node;
  if (!node || !node.statics || !node.statics.selectedImage) {
    return;
  }

  await api.fetchApi('/shinich39/put-image/clear-image', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: node.statics.selectedImage.origPath,
    }),
  });

  // set to loaded image
  node.statics.selectedImage.maskName = null;
  node.statics.selectedImage.maskPath = null;
  node.statics.selectedImage.drawName = null;
  node.statics.selectedImage.drawPath = null;

  // reload mask image
  this.maskImgLoaded = false;
  this.maskCtx.clearRect(0,0,this.maskCanvas.width,this.maskCanvas.height);
  this.maskImg.src = createEmptyCanvas(this.drawCanvas.width,this.drawCanvas.height, "rgba(0,0,0,255)");

  // reload draw image
  this.drawImgLoaded = false;
  this.drawCtx.clearRect(0,0,this.drawCanvas.width,this.drawCanvas.height);
  this.drawImg.src = createEmptyCanvas(this.drawCanvas.width,this.drawCanvas.height);

  // reload orig image
  // this.origImgLoaded = false;
  // this.origCtx.clearRect(0,0,this.origCanvas.width,this.origCanvas.height);
  // this.origImg.src = getImageURL(node.statics.selectedImage.origPath);
}

function moveCanvas(x, y) {
  if (typeof x === "number" && typeof y === "number") {
    requestAnimationFrame(function() {
      app.canvas.ds.mouseDrag(x, y);
      app.canvas.draw(true, true);
    });
  }
}

async function keyDownEvent(e) {
  const { key, ctrlKey, metaKey, shiftKey } = e;
  if (key === "-" || key === "=") {
    e.preventDefault();
    e.stopPropagation();
    zoomHandler(e);
  } else if (key === " ") {
    e.preventDefault();
    e.stopPropagation();
    spaceBarDownEvent(e);
  }
}

function zoomHandler(e) {
  const { key, ctrlKey, metaKey, shiftKey } = e;
  let n = key === "-" ? 1 : -1;
  const prevScale = app.canvas.ds.scale;
  const nextScale = Math.max(0.5, Math.min(10, Math.round((prevScale - n) * 10) / 10));
  const cx = app.canvas.ds.element.width / 2;
  const cy = app.canvas.ds.element.height / 2;
  app.canvas.ds.changeScale(nextScale, [cx, cy]);
  app.canvas.graph.change();
  selectNode(this);

  // fix brush size
  if (this.statics?.MASK) {
    this.statics.MASK.showBrush();
  }
}

function spaceBarDownEvent(e) {
  const { key, ctrlKey, metaKey, shiftKey } = e;
  if (key === " ") {
    // e.preventDefault();
    movingMode = true;
    document.addEventListener("keyup", spaceBarUpEvent, true);
  }
}

function spaceBarUpEvent(e) {
  const { key } = e;
  if (key === " ") {
    // e.preventDefault();
    movingMode = false;
    document.removeEventListener("keyup", spaceBarUpEvent);
  }
}

function pointerUpEvent(e) {
  e.preventDefault();

  // reset all canvas
  for (const node of app.graph._nodes) {
    if (node.statics?.MASK) {
      const w = node.statics.MASK;

      if (w.drawingMode) {
        w.saveEvent();
        selectNode(node);
      }

      if (movingMode) {
        // selectNode(node);
        document.getElementById("graph-canvas").focus();
      }

      w.mousedown_x = null;
      w.mousedown_y = null;
      w.drawingMode = false;
      movingMode = false;
    }
  }
}

function updateContainerSize() {
  if (this.container.clientWidth && this.container.clientHeight) {
    this.containerSize = [this.container.clientWidth, this.container.clientHeight];
  }
}

function getPixelColor(ctx, x, y) {
  return ctx.getImageData(x, y, 1, 1).data;
}

function createEmptyCanvas(width, height, fill) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fill || 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL();
}

export { initMaskEditor }