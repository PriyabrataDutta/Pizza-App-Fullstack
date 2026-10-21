package com.crustandco.customer.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.crustandco.customer.core.designsystem.CrustTheme
import com.crustandco.customer.core.designsystem.PriceMedium
import com.crustandco.customer.domain.DietaryType
import com.crustandco.customer.domain.Product

/** Veg / non-veg indicator: a bordered square with a dot, plus a spoken label. */
@Composable
fun DietaryMark(type: DietaryType, modifier: Modifier = Modifier) {
    val color = if (type == DietaryType.Veg) CrustTheme.status.success.foreground else CrustTheme.status.error.foreground
    val label = if (type == DietaryType.Veg) "Vegetarian" else "Non-vegetarian"
    Box(
        modifier = modifier
            .size(16.dp)
            .border(1.5.dp, color, RoundedCornerShape(3.dp))
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(8.dp).background(color, CircleShape))
    }
}

/** "From 7,50 €" when sizes differ, the price when there's one, or "Unavailable". Never truncated. */
fun Product.priceLabel(): String {
    val price = startingPrice ?: return "Unavailable"
    return if (hasMultipleSizes) "From ${price.format()}" else price.format()
}

/** Menu list row: art tile, name, description, price, and the red "+". */
@Composable
fun ProductRow(product: Product, kind: ArtKind, onClick: () -> Unit, onAdd: () -> Unit, modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth(), onClick = onClick) {
        Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            ProductArtTile(product, kind, Modifier.size(96.dp), corner = 16.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    DietaryMark(product.dietaryType)
                    Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                if (product.description.isNotBlank()) {
                    Text(
                        product.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        product.priceLabel(),
                        style = PriceMedium,
                        color = if (product.isAvailable) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (product.isAvailable) AddButton(onClick = onAdd, contentDescription = "Add ${product.name}")
                }
            }
        }
    }
}
