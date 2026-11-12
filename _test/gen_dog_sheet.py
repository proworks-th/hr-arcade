# Draws assets/pixel/hra_dog.png — HR Arcade's own pet dog (original art), in the same 3 greys as the cat sheet
# so every coat colour in village.js COATS recolours it: base 224, shade 181, outline 47. 32x32 cells, faces right.
# Rows: 0 idle (4) · 1 run (6) · 2 sleep (4) · 3 jump (4) · 4 sniff (4).  Run: python _test/gen_dog_sheet.py
from PIL import Image

B, S, O, P = (224, 224, 224, 255), (181, 181, 181, 255), (47, 47, 46, 255), (222, 117, 134, 255)
CELL, COLS = 32, 8


def frame(parts, dots=(), ox=7, oy=18):
    """parts = [(x0, y0, x1, y1, colour)] filled boxes (inclusive); then an outline is added round the shape; dots = [(x, y, colour)] on top"""
    g = {}
    for x0, y0, x1, y1, c in parts:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                g[(x, y)] = c
    out = dict(g)
    for (x, y) in g:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in g:
                out[(x + dx, y + dy)] = O
    for x, y, c in dots:
        out[(x, y)] = c
    im = Image.new('RGBA', (CELL, CELL))
    for (x, y), c in out.items():
        X, Y = x + ox, y + oy
        if 0 <= X < CELL and 0 <= Y < CELL:
            im.putpixel((X, Y), c)
    return im


def dog(legs, tail, head_dy=0, body_dy=0, tongue=False, blink=False, ear_up=False):
    """standing dog; legs = ((back_shift, back_lift), (front_shift, front_lift)); tail = list of boxes"""
    bd, hd = body_dy, head_dy + body_dy
    parts = [
        (3, 6 + bd, 12, 9 + bd, B),          # body
        (4, 9 + bd, 11, 9 + bd, S),          # belly shade
        (11, 4 + min(hd - bd, 2) + bd, 13, 7 + bd, B),   # neck
        (12, 1 + hd, 16, 5 + hd, B),         # head
        (17, 3 + hd, 18, 5 + hd, B),         # snout
    ]
    (bx, bl), (fx, fl) = legs
    parts += [(4 + bx, 10 + bd, 5 + bx, 12 + bd - bl, S), (10 + fx, 10 + bd, 11 + fx, 12 + bd - fl, B)]
    parts += [(x0, y0 + bd, x1, y1 + bd, c) for x0, y0, x1, y1, c in tail]
    parts += [(12, 0 + hd, 13, 2 + hd, S)] if ear_up else [(12, 1 + hd, 13, 4 + hd, S)]   # ear
    dots = [(15, 2 + hd, S if blink else O), (19, 3 + hd, O)]          # eye, nose
    if tongue:
        dots += [(17, 6 + hd, P)]
    return frame(parts, dots)


TAIL_UP = [(1, 3, 2, 5, B)]
TAIL_WAG = [(0, 4, 1, 5, B), (2, 5, 2, 5, B)]
TAIL_RUN = [(0, 6, 2, 6, B)]
STILL = ((0, 0), (0, 0))

rows = []
# idle: tail wag + a blink
rows.append([dog(STILL, TAIL_UP), dog(STILL, TAIL_WAG), dog(STILL, TAIL_UP, blink=True), dog(STILL, TAIL_WAG, tongue=True)])
# run: legs swing, body bobs, tongue out
RUN = [((-1, 0), (1, 1)), ((0, 1), (0, 0)), ((1, 0), (-1, 1)), ((0, 1), (0, 0)), ((-1, 0), (1, 1)), ((1, 0), (-1, 0))]
rows.append([dog(l, TAIL_RUN, body_dy=(i % 2) * -1, tongue=True, ear_up=i % 2 == 1) for i, l in enumerate(RUN)])


def sleep(breath):
    h = breath
    parts = [(2, 9 - h, 12, 11, B), (3, 11, 11, 11, S), (12, 6, 16, 10, B), (17, 8, 18, 10, B), (12, 6, 13, 9, S), (0, 10, 1, 11, B), (13, 11, 18, 11, B)]   # body, head on its paws, ear, tail
    return frame(parts, [(14, 8, O), (15, 8, O), (19, 8, O)])          # shut eye, nose


rows.append([sleep(0), sleep(1), sleep(1), sleep(0)])
# jump: crouch, up, top, land
rows.append([dog(STILL, TAIL_UP, body_dy=1), dog(((0, 1), (0, 1)), TAIL_RUN, body_dy=-3, ear_up=True),
             dog(((0, 1), (0, 1)), TAIL_UP, body_dy=-5, tongue=True, ear_up=True), dog(STILL, TAIL_WAG, body_dy=0)])
# sniff: head down to the ground, tail wagging
rows.append([dog(STILL, TAIL_UP, head_dy=3), dog(STILL, TAIL_WAG, head_dy=4), dog(STILL, TAIL_UP, head_dy=4), dog(STILL, TAIL_WAG, head_dy=3)])

sheet = Image.new('RGBA', (CELL * COLS, CELL * len(rows)))
for r, fr in enumerate(rows):
    for i, im in enumerate(fr):
        sheet.paste(im, (i * CELL, r * CELL))
sheet.save('assets/pixel/hra_dog.png')
print('ok', sheet.size, [len(r) for r in rows])
