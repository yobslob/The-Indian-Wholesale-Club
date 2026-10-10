"""What the worker asks FLUX.2 [klein] for, per category and view. Image 1 is the house model, image 2 the garment.
Only the category's own word goes in; the vendor's free text (any language) never does."""

# Categories shown on a house model (D-101). Everything else, and anything for kids, is a product shot on white.
ON_MODEL = {
    "sarees": "saree",
    "kurtas": "kurta",
    "suits-and-sets": "outfit set",
    "lehengas": "lehenga set",
    "dhotis-and-mundus": "dhoti",
    "jeans-and-trousers": "trousers",
    "shirts-and-tops": "top",
    "co-ords-and-dresses": "outfit",
    "jackets-and-knitwear": "jacket",
    "shawls": "shawl",
    "dupattas-and-stoles": "dupatta",
}

# Extra words for garments a plain "wearing" gets wrong.
STYLE = {
    "sarees": "draped in the classic Nivi style with neat pleats at the front and the pallu over the left shoulder, "
              "with the blouse shown in image 2",
    "lehengas": "with its blouse and dupatta as shown in image 2",
    "shawls": "draped over the shoulders",
    "dupattas-and-stoles": "draped over the shoulders, over a plain matching outfit",
    "kurtas": "worn over plain slim trousers in a matching colour if image 2 shows no trousers or bottoms",
    "shirts-and-tops": "worn with plain trousers in a matching neutral colour if image 2 shows no bottoms",
}


# The house look (D-104, the founder's example w_1_green_kurti_set): a warm wall, styled like an Indian-wear catalogue.
SCENE = ("standing on a plain light floor in front of a softly lit, warm cream textured plaster wall, soft natural "
         "daylight from the side")
STYLING = {"women": "matching ethnic flat footwear (juttis) and small earrings", "men": "matching ethnic footwear (mojaris)"}


def on_model(category: str | None, wears: str | None) -> bool:
    return category in ON_MODEL and wears in ("women", "men", "unisex")


def try_on_prompt(view: str, category: str, wears: str | None) -> str:
    word = ON_MODEL[category]
    who = "man" if wears == "men" else "woman"
    style = f", {STYLE[category]}" if category in STYLE else ""
    keep = (f"Keep the {word}'s exact colour, pattern, print, embroidery, neckline, sleeves, hem and length exactly as "
            f"in image 2.")
    styling = STYLING["men" if wears == "men" else "women"]
    scene = (f"The whole body from head to feet, {SCENE}, wearing {styling}. Photorealistic Indian-wear catalogue "
             f"photo, sharp focus.")
    if view == "back":
        return (f"The {who} from image 1 in exactly the same pose as image 1, seen from behind with the head turned to "
                f"the side, wearing the {word} shown from the back in image 2{style}. {keep} Show only what image 2 "
                f"shows; do not add designs that are not in it. Same face, hair and body as image 1. {scene}")
    return (f"The {who} from image 1 in exactly the same pose as image 1, facing the camera, wearing the {word} shown in "
            f"image 2{style}. {keep} Same face, hair and body as image 1. {scene}")
