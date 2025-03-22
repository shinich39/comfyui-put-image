"""
@author: shinich39
@title: comfyui-put-image
@nickname: comfyui-put-image
@version: 1.0.3
@description: Load image from directory.
"""

from .nodes.image import PutImage

NODE_CLASS_MAPPINGS = {
  "PutImage": PutImage,
}

NODE_DISPLAY_NAME_MAPPINGS = {
  "PutImage": "Put Image",
}

WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]