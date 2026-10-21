package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import coil3.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.sharedProductArt
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.Product

/** What a product or category looks like in illustrations. Derived from the category name; real photos replace this. */
enum class ArtKind { Pizza, Sides, Drinks, Dessert, Deals, Other }

fun Category.artKind(): ArtKind {
    val n = name.lowercase()
    return when {
        "pizza" in n || "calzone" in n -> ArtKind.Pizza
        "side" in n || "imbiss" in n || "gyros" in n || "schnitzel" in n -> ArtKind.Sides
        "drink" in n || "beverage" in n || "getränk" in n -> ArtKind.Drinks
        "dessert" in n || "sweet" in n || "süß" in n -> ArtKind.Dessert
        else -> ArtKind.Other
    }
}

/** Looks up a product's art through its category. Falls back to [ArtKind.Other] when categories haven't loaded. */
fun List<Category>.artKindFor(product: Product): ArtKind = firstOrNull { it.id == product.categoryId }?.artKind() ?: ArtKind.Other

private fun DrawScope.fries(u: Float) {
    val yellow = Palette.Amber400
    listOf(-34f, -20f, -6f, 8f, 22f, 36f).forEachIndexed { i, x ->
        drawRoundRect(yellow, topLeft = Offset(size.width / 2 + (x - 5f) * u, size.height / 2 + (-52f + (i % 3) * 8f) * u), size = Size(10f * u, 60f * u), cornerRadius = CornerRadius(3f * u))
    }
    val box = Path().apply {
        moveTo(size.width / 2 - 46f * u, size.height / 2 - 4f * u)
        lineTo(size.width / 2 + 46f * u, size.height / 2 - 4f * u)
        lineTo(size.width / 2 + 36f * u, size.height / 2 + 56f * u)
        lineTo(size.width / 2 - 36f * u, size.height / 2 + 56f * u)
        close()
    }
    drawPath(box, Palette.Red600)
    drawCircle(Palette.Cream50, radius = 11f * u, center = Offset(size.width / 2, size.height / 2 + 28f * u))
}

private fun DrawScope.cup(u: Float) {
    val cx = size.width / 2
    val cy = size.height / 2
    drawLine(Palette.Red700, Offset(cx + 6f * u, cy - 62f * u), Offset(cx + 22f * u, cy - 20f * u), strokeWidth = 7f * u)
    val body = Path().apply {
        moveTo(cx - 38f * u, cy - 28f * u)
        lineTo(cx + 38f * u, cy - 28f * u)
        lineTo(cx + 28f * u, cy + 58f * u)
        lineTo(cx - 28f * u, cy + 58f * u)
        close()
    }
    drawPath(body, Palette.White)
    drawRoundRect(Palette.Red600, topLeft = Offset(cx - 34f * u, cy + 4f * u), size = Size(68f * u, 26f * u), cornerRadius = CornerRadius(2f * u))
    drawRoundRect(Palette.Cream300, topLeft = Offset(cx - 44f * u, cy - 38f * u), size = Size(88f * u, 12f * u), cornerRadius = CornerRadius(6f * u))
}

private fun DrawScope.dessert(u: Float) {
    // A chocolate lava cake in a ramekin, with a cherry and a dusting of sugar.
    val cx = size.width / 2
    val cy = size.height / 2
    val dome = Path().apply {
        moveTo(cx - 44f * u, cy + 8f * u)
        quadraticTo(cx, cy - 58f * u, cx + 44f * u, cy + 8f * u)
        close()
    }
    drawPath(dome, Palette.Brown900)
    // Molten centre running down the front.
    drawOval(Palette.Brown800, topLeft = Offset(cx - 14f * u, cy - 24f * u), size = Size(28f * u, 14f * u))
    drawRoundRect(Palette.Brown800, topLeft = Offset(cx - 5f * u, cy - 20f * u), size = Size(10f * u, 34f * u), cornerRadius = CornerRadius(5f * u))
    // Cherry and sugar.
    drawCircle(Palette.Red600, radius = 8f * u, center = Offset(cx, cy - 40f * u))
    listOf(-28f to -4f, -18f to -22f, 20f to -16f, 30f to -2f).forEach { (x, y) ->
        drawCircle(Palette.White, radius = 2.4f * u, center = Offset(cx + x * u, cy + y * u))
    }
    // Ramekin.
    val cup = Path().apply {
        moveTo(cx - 48f * u, cy + 8f * u)
        lineTo(cx + 48f * u, cy + 8f * u)
        lineTo(cx + 38f * u, cy + 56f * u)
        lineTo(cx - 38f * u, cy + 56f * u)
        close()
    }
    drawPath(cup, Palette.White)
    drawPath(cup, Palette.Cream300, style = Stroke(width = 2f * u))
    listOf(-20f, 0f, 20f).forEach { x ->
        drawLine(Palette.Cream300, Offset(cx + x * u, cy + 18f * u), Offset(cx + x * 0.8f * u, cy + 50f * u), strokeWidth = 2f * u, cap = StrokeCap.Round)
    }
}

private fun DrawScope.percent(u: Float) {
    val c = Offset(size.width / 2, size.height / 2)
    drawCircle(Palette.Red600, radius = 54f * u, center = c)
    drawCircle(Palette.White, radius = 11f * u, center = c + Offset(-20f * u, -20f * u))
    drawCircle(Palette.White, radius = 11f * u, center = c + Offset(20f * u, 20f * u))
    drawLine(Palette.White, c + Offset(26f * u, -28f * u), c + Offset(-26f * u, 28f * u), strokeWidth = 9f * u)
}

/** Large art for a product or category. [kind] picks the drawing; [Other] shows [fallbackLetter]. */
@Composable
fun KindArt(kind: ArtKind, modifier: Modifier = Modifier, fallbackLetter: String = "") {
    when (kind) {
        ArtKind.Pizza -> PizzaArt(modifier)
        ArtKind.Other -> Box(modifier, contentAlignment = Alignment.Center) {
            Text(fallbackLetter, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        else -> Canvas(modifier) {
            val u = size.minDimension / 140f
            when (kind) {
                ArtKind.Sides -> fries(u)
                ArtKind.Drinks -> cup(u)
                ArtKind.Dessert -> dessert(u)
                ArtKind.Deals -> percent(u)
                else -> Unit
            }
        }
    }
}

/**
 * Rounded warm tile holding a product's picture. Order of preference: a live image URL from the API, a bundled photo
 * (`prod_<slug>` in res/drawable-nodpi, see docs/IMAGES.md), then the drawn illustration. The artwork carries the
 * shared-element key, so it glides into the product screen hero.
 */
@Composable
fun ProductArtTile(product: Product, kind: ArtKind, modifier: Modifier = Modifier, corner: Dp = 14.dp, artPadding: Dp = 8.dp) {
    val shape = RoundedCornerShape(corner)
    val photoId = rememberPhotoId(productPhotoName(product))
    Box(
        modifier.clip(shape).background(Brush.radialGradient(listOf(Palette.White, Palette.Cream100))),
        contentAlignment = Alignment.Center,
    ) {
        when {
            (product.thumbUrl ?: product.imageUrl) != null ->
                AsyncImage(model = product.thumbUrl ?: product.imageUrl, contentDescription = null, modifier = Modifier.fillMaxSize().sharedProductArt(product.id), contentScale = ContentScale.Crop)
            photoId != 0 ->
                Image(painterResource(photoId), contentDescription = null, modifier = Modifier.fillMaxSize().sharedProductArt(product.id), contentScale = ContentScale.Crop)
            else ->
                KindArt(kind, Modifier.fillMaxSize().padding(artPadding).sharedProductArt(product.id), fallbackLetter = product.name.take(1))
        }
    }
}

/** Small round icon for a category, used in the Home category row. */
@Composable
fun CategoryGlyph(kind: ArtKind, modifier: Modifier = Modifier, size: Dp = 30.dp) {
    KindArt(kind, modifier.size(size))
}
