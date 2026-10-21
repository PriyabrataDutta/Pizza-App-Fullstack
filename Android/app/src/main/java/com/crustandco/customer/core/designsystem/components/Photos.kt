package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import com.crustandco.customer.domain.Product

// Photo slots. Drop a picture into res/drawable-nodpi/ with the right name and the app uses it automatically;
// until then the drawn illustration is shown. No code change is needed either way. See docs/IMAGES.md for the full list.
//
//   prod_<slug>.webp   product photo; slug is the product id without its "p-" prefix, with "-" as "_" (p-paneer -> prod_paneer)
//   cat_<slug>.webp    category tile
//   promo_banner.webp  Home promo banner
//   welcome_hero.webp  Welcome and sign-in backdrop
//
// This convention is for the demo data only. With the live API, products carry an image URL (Product.imageUrl) and Coil loads it.

fun productPhotoName(product: Product): String = "prod_" + product.id.removePrefix("p-").replace('-', '_')

/** The drawable resource ID for [name], or 0 when that photo hasn't been added yet. */
@Composable
fun rememberPhotoId(name: String): Int {
    val context = LocalContext.current
    return remember(name) { context.resources.getIdentifier(name, "drawable", context.packageName) }
}

/** Shows the bundled photo [name] cropped to fill, or runs [fallback] when it doesn't exist. */
@Composable
fun BundledPhoto(name: String, modifier: Modifier = Modifier, fallback: @Composable () -> Unit) {
    val id = rememberPhotoId(name)
    if (id != 0) {
        Image(painter = painterResource(id), contentDescription = null, modifier = modifier, contentScale = ContentScale.Crop)
    } else {
        fallback()
    }
}
