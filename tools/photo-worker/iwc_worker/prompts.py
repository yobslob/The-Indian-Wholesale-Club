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
}


def on_model(category: str | None, wears: str | None) -> bool:
    return category in ON_MODEL and wears in ("women", "men", "unisex")


def try_on_prompt(view: str, category: str, wears: str | None) -> str:
    word = ON_MODEL[category]
    who = "man" if wears == "men" else "woman"
    style = f", {STYLE[category]}" if category in STYLE else ""
    keep = (f"Keep the {word}'s exact colour, pattern, print, embroidery, neckline, sleeves, hem and length exactly as "
            f"in image 2.")
    if view == "back":
        return (f"The {who} from image 1, seen from behind exactly as in image 1, wearing the {word} shown from the back "
                f"in image 2{style}. {keep} Show only what image 2 shows; do not add designs that are not in it. Same "
                f"pose, framing, studio background and lighting as image 1. Photorealistic e-commerce catalogue photo.")
    return (f"The {who} from image 1 wearing the {word} shown in image 2{style}. {keep} Same pose, framing, face, studio "
            f"background and lighting as image 1. Photorealistic e-commerce catalogue photo.")
