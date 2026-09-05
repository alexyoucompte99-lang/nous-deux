# Logo Nous : deux cercles qui se chevauchent (rose + violet) sur fond dégradé pêche → lavande, petit cœur au centre.
from PIL import Image, ImageDraw
def icon(size, out, maskable=False):
    s = size
    img = Image.new("RGBA", (s, s), (0,0,0,0))
    d = ImageDraw.Draw(img)
    top, bot = (253, 231, 214), (232, 220, 255)
    for y in range(s):
        t = y / (s-1)
        c = tuple(int(top[i]*(1-t)+bot[i]*t) for i in range(3))
        d.line([(0,y),(s,y)], fill=c+(255,))
    if not maskable:
        m = Image.new("L", (s,s), 0)
        ImageDraw.Draw(m).rounded_rectangle([0,0,s-1,s-1], radius=int(s*0.22), fill=255)
        img.putalpha(m)
    ov = Image.new("RGBA", (s, s), (0,0,0,0))
    od = ImageDraw.Draw(ov)
    r = s*0.26; cy = s*0.5
    od.ellipse([s*0.5-r*1.55, cy-r, s*0.5-r*1.55+2*r, cy+r], fill=(91,124,250,200))
    od.ellipse([s*0.5+r*1.55-2*r, cy-r, s*0.5+r*1.55, cy+r], fill=(240,98,146,200))
    img = Image.alpha_composite(img, ov)
    d = ImageDraw.Draw(img)
    # cœur blanc au centre
    hw = s*0.11; hx, hy = s*0.5, s*0.5
    d.ellipse([hx-hw, hy-hw*0.9, hx, hy+hw*0.1], fill=(255,255,255,255))
    d.ellipse([hx, hy-hw*0.9, hx+hw, hy+hw*0.1], fill=(255,255,255,255))
    d.polygon([(hx-hw, hy-hw*0.3), (hx+hw, hy-hw*0.3), (hx, hy+hw*0.9)], fill=(255,255,255,255))
    img.save(out)
icon(512, "icons/icon-512.png"); icon(192, "icons/icon-192.png"); icon(180, "icons/apple-touch-icon.png")
icon(512, "icons/maskable-512.png", maskable=True); icon(64, "icons/favicon.png")
print("ok")
