package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import com.crustandco.customer.core.designsystem.Motion
import com.crustandco.customer.core.designsystem.Palette
import com.crustandco.customer.core.designsystem.rememberReducedMotion
import kotlinx.coroutines.delay
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.PriceMedium
import com.crustandco.customer.core.designsystem.Tabular
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Promotion

/** Looks like a search field but opens the Menu, where searching actually happens. */
@Composable
fun SearchEntry(placeholder: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp).semantics { role = Role.Button },
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PhIcon(Ph.MagnifyingGlass, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(placeholder, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** How one offer looks: its gradient and its artwork. A photo named promo_<slug>.webp replaces the artwork when present. */
private class PromoLook(val from: Color, val to: Color, val art: ArtKind)

// Offers from the server carry no artwork, so each position in the carousel gets its own look. They repeat if there are more.
private val PromoLooks = listOf(
    PromoLook(Palette.Red800, Palette.Red600, ArtKind.Pizza),
    PromoLook(Palette.Brown800, Palette.Brown950, ArtKind.Sides),
    PromoLook(Color(0xFF9A4A08), Color(0xFFC2610C), ArtKind.Dessert),
    PromoLook(Palette.Green700, Color(0xFF2E8B57), ArtKind.Deals),
)

/** One offer card: headline, one line of detail, a code, a white "Order now" button and artwork (or a bundled photo). */
@Composable
fun PromoBanner(promotion: Promotion, onOrderNow: () -> Unit, modifier: Modifier = Modifier, index: Int = 0) {
    val look = PromoLooks[index.mod(PromoLooks.size)]
    val photoId = rememberPhotoId("promo_" + promotion.id.removePrefix("promo-").replace('-', '_'))
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.extraLarge)
            .background(Brush.horizontalGradient(listOf(look.from, look.to))),
    ) {
        if (photoId != 0) {
            Image(painterResource(photoId), contentDescription = null, modifier = Modifier.matchParentSize(), contentScale = ContentScale.Crop)
            // Keeps the words readable on any photo.
            Box(Modifier.matchParentSize().background(Brush.horizontalGradient(listOf(Color(0xCC000000), Color(0x22000000)))))
        } else {
            KindArt(look.art, Modifier.align(Alignment.CenterEnd).size(132.dp).offset(x = 24.dp))
        }
        Column(Modifier.padding(18.dp).fillMaxWidth(0.62f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(promotion.title, style = MaterialTheme.typography.headlineMedium, color = Color.White)
            Text(promotion.detail, style = MaterialTheme.typography.bodyMedium, color = Color.White)
            if (promotion.code != null) {
                Text("Code ${promotion.code}", style = MaterialTheme.typography.labelLarge.merge(Tabular), color = Color.White)
            }
            Surface(
                onClick = onOrderNow,
                modifier = Modifier.padding(top = 6.dp).heightIn(min = 36.dp),
                shape = MaterialTheme.shapes.small,
                color = Color.White,
            ) {
                Box(Modifier.padding(horizontal = 14.dp, vertical = 6.dp), contentAlignment = Alignment.Center) {
                    Text("Order now", style = MaterialTheme.typography.labelLarge, color = look.from)
                }
            }
        }
    }
}

private const val AUTO_SCROLL_MS = 4000L
private const val PAGER_SPAN = 10_000

/**
 * The offers, swiping sideways and advancing by themselves every few seconds. Auto-advance waits while a finger is on it
 * and never runs when the system has animations turned off; swiping always works. Dots show where you are.
 */
@Composable
fun PromoCarousel(promotions: List<Promotion>, onOrderNow: () -> Unit, modifier: Modifier = Modifier) {
    if (promotions.isEmpty()) return
    val count = promotions.size
    val pagerState = rememberPagerState(initialPage = PAGER_SPAN / 2 - (PAGER_SPAN / 2) % count, pageCount = { if (count > 1) PAGER_SPAN else 1 })
    val dragged by pagerState.interactionSource.collectIsDraggedAsState()
    val reduced = rememberReducedMotion()

    LaunchedEffect(count, dragged, reduced) {
        if (count < 2 || dragged || reduced) return@LaunchedEffect
        while (true) {
            delay(AUTO_SCROLL_MS)
            pagerState.animateScrollToPage(pagerState.currentPage + 1, animationSpec = tween(Motion.Slow + 200, easing = Motion.Standard))
        }
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalPager(state = pagerState, pageSpacing = 12.dp, modifier = Modifier.fillMaxWidth(), key = { it }) { page ->
            val index = page.mod(count)
            PromoBanner(promotions[index], onOrderNow = onOrderNow, index = index, modifier = Modifier.height(168.dp))
        }
        if (count > 1) {
            val current = pagerState.currentPage.mod(count)
            Row(
                Modifier.align(Alignment.CenterHorizontally).semantics { contentDescription = "Offer ${current + 1} of $count" },
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                repeat(count) { dot ->
                    val width by animateDpAsState(if (dot == current) 20.dp else 6.dp, tween(Motion.Medium), label = "dotWidth")
                    val color by animateColorAsState(
                        if (dot == current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                        tween(Motion.Medium),
                        label = "dotColor",
                    )
                    Box(Modifier.size(width = width, height = 6.dp).background(color, CircleShape))
                }
            }
        }
    }
}

/** Round category shortcut with a drawn icon and label. The selected one is red-tinted. */
@Composable
fun CategoryCircle(label: String, kind: ArtKind, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, imageUrl: String? = null) {
    Column(
        modifier = modifier
            .width(72.dp)
            .clip(MaterialTheme.shapes.medium)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier
                .size(58.dp)
                .background(if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface, CircleShape)
                .clip(CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl != null) {
                coil3.compose.AsyncImage(model = imageUrl, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
            } else if (kind == ArtKind.Other) {
                Text(label.take(1), style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            } else {
                CategoryGlyph(kind, size = 32.dp)
            }
        }
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Two-column grid card: art, name, short description, price and the red "+". */
@Composable
fun ProductTile(product: Product, kind: ArtKind, onClick: () -> Unit, onAdd: () -> Unit, modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth(), onClick = onClick) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            ProductArtTile(product, kind, Modifier.fillMaxWidth().aspectRatio(1.2f), corner = 16.dp)
            Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
            Text(
                product.description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(product.priceLabel(), style = PriceMedium)
                if (product.isAvailable) AddButton(onClick = onAdd, contentDescription = "Add ${product.name}")
            }
        }
    }
}
