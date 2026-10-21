# Photo slots and image prompts

The app ships with drawn illustrations. Any photo you drop into `app/src/main/res/drawable-nodpi/` with the
right name replaces the illustration automatically. No code change is needed.

## Naming

| Slot | File name | Size |
|---|---|---|
| Product photo | `prod_<slug>.webp` (slug = product id without `p-`, `-` becomes `_`) | 1000x1000 |
| Welcome backdrop | `welcome_hero.webp` | 1080x1600 |

Use WebP at quality ~80 to keep the APK small. Lowercase letters, digits and underscores only.
If a product has an `imageUrl` from the server, that wins over the bundled photo.

## Prompt pack

Shared style: *overhead 45-degree food photograph, warm natural window light, soft shadows, rustic dark wood
or cream linen surface, shallow depth of field, appetising, no text, no logos, no hands.*

- **Margherita** (`prod_margherita`): a wood-fired Margherita pizza, blistered crust, fresh mozzarella, basil leaves, tomato sauce.
- **Pepperoni** (`prod_pepperoni`): pepperoni pizza with cupped, crisp-edged pepperoni and melted cheese.
- **Sides**: a basket of golden fries; garlic bread with herb butter.
- **Desserts**: a molten chocolate lava cake in a ramekin, dusted with sugar, one cherry on top.
- **Welcome backdrop**: a pizza fresh from a brick oven on a dark wooden board, steam rising, dark moody
  background with empty space in the lower half for text. Portrait orientation.

Generated images must be checked for licence terms of the tool you use before shipping.
