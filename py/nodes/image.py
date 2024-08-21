import numpy as np
import torch
import os
import inspect
import json
import time
import shutil
import traceback
import folder_paths

from pathlib import Path
from io import BytesIO
from urllib.parse import unquote
from PIL import Image

from server import PromptServer
from aiohttp import web

from PIL import ImageFile, Image, ImageOps

# fix
ImageFile.LOAD_TRUNCATED_IMAGES = True

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")

def chk_dir(p):
  if os.path.exists(p) == False:
    os.makedirs(p, exist_ok=True)

def get_dir_path(d):
  dp = os.path.dirname(inspect.getfile(PromptServer))
  return os.path.join(dp, d)

def get_now():
  return round(time.time() * 1000)

def get_images(dir_path):
  image_list = []
  if os.path.isdir(dir_path):
    for file in os.listdir(dir_path):  
      # not image
      if not file.endswith(IMAGE_EXTENSIONS):
        continue

      # mask, draw, result
      if file.startswith("."):
        continue

      image_name, image_ext = os.path.splitext(file)
      image_path = Path(os.path.join(dir_path, file)).as_posix()
      draw_name = "." + image_name + "_d"
      draw_path = Path(os.path.join(dir_path, draw_name + ".png")).as_posix()
      mask_name = "." + image_name + "_m"
      mask_path = Path(os.path.join(dir_path, mask_name + ".png")).as_posix()

      is_draw_exists = os.path.exists(draw_path)
      is_mask_exists = os.path.exists(mask_path)
      image_list.append({
        "dir_path": dir_path,
        "original_path": image_path,
        "original_name": image_name,
        "draw_path": draw_path if is_draw_exists else None,
        "draw_name": draw_name if is_draw_exists else None,
        "mask_path": mask_path if is_mask_exists else None,
        "mask_name": mask_name if is_mask_exists else None,
      })
  
  return image_list

@PromptServer.instance.routes.get("/shinich39/put-image/image")
async def routes_get_image(request):
  if "path" in request.rel_url.query:
    file_path = unquote(request.rel_url.query["path"])
    if os.path.isfile(file_path):
      filename = os.path.basename(file_path)
      with Image.open(file_path) as img:
        image_format = 'webp'
        quality = 90
        buffer = BytesIO()
        img.save(buffer, format=image_format, quality=quality)
        buffer.seek(0)

        return web.Response(body=buffer.read(), content_type=f'image/{image_format}',
          headers={"Content-Disposition": f"filename=\"{filename}\""})

  return web.Response(status=404)

@PromptServer.instance.routes.post("/shinich39/put-image/load-images")
async def routes_load_images(request):
  try:
    req = await request.json()
    file_path = req["path"]
    image_list = get_images(file_path)
    return web.json_response(image_list)
  except Exception:
    print(traceback.format_exc())
    return web.Response(status=400)

@PromptServer.instance.routes.post("/shinich39/put-image/save-image")
async def routes_save_image(request):
  try:
    req = await request.json()
    src_path = req["path"]
    dirname = req["dirname"]
    dir_path = get_dir_path(dirname)
    src_name, src_ext = os.path.splitext(src_path)
    dst_name = f"{str(get_now())}{src_ext}"
    dst_path = os.path.join(dir_path, dst_name)

    chk_dir(dir_path)

    shutil.copyfile(src_path, dst_path)

    return web.Response(status=200)
  except Exception:
    print(traceback.format_exc())
    return web.Response(status=400)

@PromptServer.instance.routes.post("/shinich39/put-image/edit-image")
async def routes_edit_image(request):
  post = await request.post()
  draw_image = post.get("draw")
  mask_image = post.get("mask")
  original_path = post.get("path")
  dir_path = os.path.dirname(original_path)
  original_name = os.path.basename(original_path)
  image_name, image_ext = os.path.splitext(original_name)

  draw_name = "." + image_name + "_d"
  draw_path = os.path.join(dir_path, draw_name + ".png")
  mask_name = "." + image_name + "_m"
  mask_path = os.path.join(dir_path, mask_name + ".png")
  res_name = "." + image_name + "_r"
  res_path = os.path.join(dir_path, res_name + ".png")

  # save draw image
  draw_pil = Image.open(draw_image.file).convert("RGBA")
  draw_pil.save(draw_path, compress_level=4)
  
  # save mask image
  mask_pil = Image.open(mask_image.file).convert('RGBA')
  mask_pil.save(mask_path, compress_level=4)

  # create result image
  orig_pil = Image.open(original_path).convert("RGBA")

  # merge draw image
  orig_pil.paste(draw_pil, (0,0), draw_pil)

  # merge mask image
  mask_alpha = mask_pil.getchannel('A')
  orig_pil.putalpha(mask_alpha)

  # save result image
  orig_pil.save(res_path, compress_level=4)

  return web.json_response({
    "draw_name": draw_name,
    "draw_path": draw_path,
    "mask_name": mask_name,
    "mask_path": mask_path,
  })

@PromptServer.instance.routes.post("/shinich39/put-image/clear-image")
async def clear_image(request):
  req = await request.json()
  original_path = req["path"]
  dir_path = os.path.dirname(original_path)
  original_name = os.path.basename(original_path)
  image_name, image_ext = os.path.splitext(original_name)

  draw_name = "." + image_name + "_d"
  draw_path = os.path.join(dir_path, draw_name + ".png")
  mask_name = "." + image_name + "_m"
  mask_path = os.path.join(dir_path, mask_name + ".png")
  res_name = "." + image_name + "_r"
  res_path = os.path.join(dir_path, res_name + ".png")

  if os.path.exists(draw_path):
    os.remove(draw_path)

  if os.path.exists(mask_path):
    os.remove(mask_path)

  if os.path.exists(res_path):
    os.remove(res_path)

  return web.Response(status=200)

class PutImage():
  def __init__(self):
    pass

  # prevent starting cached queue
  @classmethod
  def IS_CHANGED(s):
    return None

  @classmethod
  def INPUT_TYPES(cls):
    return {
      "required": {
        "dir_path": ("STRING", {"default": os.path.relpath(folder_paths.get_input_directory()), "multiline": True}),
        "index":  ("INT", {"default": 0, "min": -1, "step": 1}),
        "mode": (["fixed", "increment", "decrement", "randomize",],),
        "filename": ("STRING", {"default": "",}),
      }
    }
  
  CATEGORY = "image"
  FUNCTION = "exec"
  RETURN_TYPES = ("IMAGE", "MASK", "STRING",)
  RETURN_NAMES = ("IMAGE", "MASK", "FILENAME",)

  def exec(self, dir_path, index, mode, filename, **kwargs):
    orig_name = filename
    orig_path = os.path.join(dir_path, orig_name + ".png")
    res_name = "." + orig_name + "_r"
    res_path = os.path.join(dir_path, res_name + ".png")
    is_res_exists = os.path.exists(res_path)

    file_path = None
    if is_res_exists:
      file_path = res_path
    else:
      file_path = orig_path

    image = Image.open(file_path)
    img = ImageOps.exif_transpose(image)
    image = img.convert("RGB")
    image = np.array(image).astype(np.float32) / 255.0
    image = torch.from_numpy(image)[None,]
    if 'A' in img.getbands():
      mask = np.array(img.getchannel('A')).astype(np.float32) / 255.0
      mask = 1. - torch.from_numpy(mask)
    else:
      mask = torch.zeros((64, 64), dtype=torch.float32, device="cpu")

    return (image, mask.unsqueeze(0), filename,)