# comfyui-put-image

Load image from directory. 

## Features  
- Load image by index.  
- Quick inpainting.  
- Quick drawing.  

## Nodes  
Add node > image > Put Image

## Usage

### Controls \(while focus on the node\)  
Arrow left, right: Change index.  
F5 or Ctrl + r: Reload images.  
-, =: Change canvas zoom.  
Mouse wheel scroll: Change brush size.  
Mouse move while wheel click or press space bar: Move canvas.  

### Masking  
Mouse left click: Add mask.  
Mouse right click: Remove mask.  

### Painting  
Ctrl or Alt + Mouse L/R click: Change brush color to selected pixel.  
Mouse left click: Drawing.  
Mouse right click: Remove drawing.  

### Add menu items to Save Image and Preview Image  
- Send to input  

Copy selected image to "/ComfyUI/input" directory.  

- Send to output  

Copy selected image to "/ComfyUI/output" directory.  

- Send to Put Image  

Load selected image at the sepecific "Put Image" node.  

## References  

Thanks for ComfyUI core nodes!